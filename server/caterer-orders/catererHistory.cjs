const pool = require('./db.cjs');

// Formats a Date to local YYYY-MM-DD to avoid timezone shifts from toISOString()
const formatDateLocal = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};


// Helper function to create bills for delivered orders that don't have bills yet
const createBillsForDeliveredOrders = async (connection) => {
  try {
    // Find delivered orders without bills
    const [deliveredOrders] = await connection.execute(`
      SELECT co.*
      FROM caterer_orders co
      LEFT JOIN caterer_bills cb ON co.id = cb.caterer_order_id
      WHERE co.status = 'delivered' AND cb.id IS NULL
    `);


    console.log(`📊 Found ${deliveredOrders.length} delivered orders without bills`);
    
    // Analyze potential caterer duplicates in the orders
    const catererPhoneCounts = {};
    const catererNameCounts = {};
    
    for (const order of deliveredOrders) {
      // Count by phone number
      catererPhoneCounts[order.caterer_phone] = (catererPhoneCounts[order.caterer_phone] || 0) + 1;
      
      // Count by name
      catererNameCounts[order.caterer_name] = (catererNameCounts[order.caterer_name] || 0) + 1;
    }
    
    console.log('📞 Phone number frequencies:', catererPhoneCounts);
    console.log('🏷️ Caterer name frequencies:', catererNameCounts);
    
    // Find potential duplicates
    const duplicatePhones = Object.entries(catererPhoneCounts).filter(([phone, count]) => count > 1);
    const duplicateNames = Object.entries(catererNameCounts).filter(([name, count]) => count > 1);
    
    if (duplicatePhones.length > 0) {
      console.log(`⚠️ Found ${duplicatePhones.length} phone numbers used by multiple orders:`, duplicatePhones);
    }
    
    if (duplicateNames.length > 0) {
      console.log(`⚠️ Found ${duplicateNames.length} caterer names used by multiple orders:`, duplicateNames);
    }


    for (const order of deliveredOrders) {
      console.log(`🔍 Processing order ${order.id}:`, {
        order_number: order.order_number,
        total_amount: order.total_amount,
        subtotal: order.subtotal,
        caterer_name: order.caterer_name,
        caterer_phone: order.caterer_phone
      });


      // First, find or create caterer in caterers table
      let catererId;


      // FIXED: Try to find existing caterer by phone with collation fix
      const [existingCaterer] = await connection.execute(`
        SELECT id FROM caterers WHERE phone_number COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
      `, [order.caterer_phone]);


      if (existingCaterer.length > 0) {
        catererId = existingCaterer[0].id;
        console.log(`📋 Found existing caterer ID: ${catererId} for phone: ${order.caterer_phone}`);
        
        // Additional check: see if there are other caterers with similar names
        const [similarCaterers] = await connection.execute(`
          SELECT id, caterer_name, phone_number FROM caterers
          WHERE caterer_name LIKE ? AND id != ?
        `, [`%${order.caterer_name}%`, catererId]);
        
        if (similarCaterers.length > 0) {
          console.log(`⚠️ Found ${similarCaterers.length} similar caterers for ${order.caterer_name}:`, similarCaterers);
        }
      } else {
        // Check for existing caterer by name (potential duplicate)
        const [nameMatch] = await connection.execute(`
          SELECT id FROM caterers WHERE caterer_name = ?
        `, [order.caterer_name]);


        if (nameMatch.length > 0) {
          console.log(`🔍 Caterer with name "${order.caterer_name}" already exists with ID: ${nameMatch[0].id}`);
          console.log(`📞 New phone: ${order.caterer_phone}, Existing phone: ${nameMatch[0].phone_number}`);
          
          // Ask user how to handle this scenario
          console.log(`💡 Consider updating existing caterer ${nameMatch[0].id} with new phone number instead of creating duplicate`);
        }
        
        // Create new caterer
        const [catererResult] = await connection.execute(`
          INSERT INTO caterers (
            caterer_name, contact_person, phone_number, email, address, gst_number
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
          order.caterer_name,
          order.contact_person,
          order.caterer_phone,
          order.caterer_email || null,
          order.caterer_address,
          order.gst_number || null
        ]);


        catererId = catererResult.insertId;
        console.log(`✅ Created new caterer ID: ${catererId} for ${order.caterer_name}`);
      }


      // Generate bill number
      const billNumber = `BILL-${order.id}-${Date.now()}`;


      // Use actual payment_amount from order for proper calculations
      const totalAmount = parseFloat(order.total_amount) || 0;
      const orderPaymentAmount = parseFloat(order.payment_amount) || 0; // Use actual advance payment
      const remainingAmount = Math.max(0, totalAmount - orderPaymentAmount);


      console.log(`💰 Bill amounts for order ${order.order_number}:`, {
        total_amount: order.total_amount,
        subtotal: order.subtotal,
        payment_amount: order.payment_amount,
        advance_paid: orderPaymentAmount,
        remaining: remainingAmount
      });


      // Create bill with proper payment status
      const initialBillStatus = remainingAmount <= 0 ? 'paid' : (orderPaymentAmount > 0 ? 'partial' : 'pending');
      const [billResult] = await connection.execute(`
        INSERT INTO caterer_bills (
          caterer_id, caterer_order_id, bill_number, bill_date,
          subtotal, total_amount, paid_amount, pending_amount, status
        ) VALUES (?, ?, ?, CURDATE(), ?, ?, ?, ?, ?)
      `, [
        catererId,
        order.id,
        billNumber,
        order.subtotal || 0,
        totalAmount,
        orderPaymentAmount,
        remainingAmount,
        initialBillStatus
      ]);

      const billId = billResult.insertId;

      // Record initial advance payment in payment history if any
      if (orderPaymentAmount > 0) {
        await connection.execute(`
          INSERT INTO caterer_payments (
            caterer_id, bill_id, amount, payment_method, payment_date,
            reference_number, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          catererId,
          billId,
          orderPaymentAmount,
          order.payment_method || 'cash',
          order.created_at || new Date(),
          `ADV-${order.order_number}`,
          `Advance payment for order ${order.order_number}`
        ]);
      }

      console.log(`✅ Created bill ${billNumber} for order ${order.order_number} with amount ₹${totalAmount}, paid: ₹${orderPaymentAmount}, remaining: ₹${remainingAmount}`);
    }
  } catch (error) {
    console.error('Error creating bills for delivered orders:', error);
  }
};


// Helper function to identify potential duplicate caterers
const identifyDuplicateCaterers = async (connection) => {
  try {
    console.log('🔍 Analyzing potential caterer duplicates...');
    
    // Get all caterers
    const [allCaterers] = await connection.execute(`
      SELECT id, caterer_name, phone_number, contact_person, email, created_at
      FROM caterers
      ORDER BY caterer_name, phone_number
    `);
    
    console.log(`📊 Total caterers in database: ${allCaterers.length}`);
    
    // Group by similar phone numbers (remove non-digits for comparison)
    const phoneGroups = {};
    const nameGroups = {};
    
    for (const caterer of allCaterers) {
      // Group by phone number (cleaned)
      const cleanPhone = caterer.phone_number.replace(/\D/g, '');
      if (!phoneGroups[cleanPhone]) {
        phoneGroups[cleanPhone] = [];
      }
      phoneGroups[cleanPhone].push(caterer);
      
      // Group by similar names
      const normalizedName = caterer.caterer_name.toLowerCase().trim();
      if (!nameGroups[normalizedName]) {
        nameGroups[normalizedName] = [];
      }
      nameGroups[normalizedName].push(caterer);
    }
    
    // Find duplicates by phone
    const phoneDuplicates = Object.values(phoneGroups).filter(group => group.length > 1);
    const nameDuplicates = Object.values(nameGroups).filter(group => group.length > 1);
    
    console.log(`📞 Found ${phoneDuplicates.length} phone number groups with duplicates:`);
    phoneDuplicates.forEach((group, index) => {
      console.log(`  Group ${index + 1}:`, group.map(c => ({ id: c.id, name: c.caterer_name, phone: c.phone_number })));
    });
    
    console.log(`🏷️ Found ${nameDuplicates.length} name groups with duplicates:`);
    nameDuplicates.forEach((group, index) => {
      console.log(`  Group ${index + 1}:`, group.map(c => ({ id: c.id, name: c.caterer_name, phone: c.phone_number })));
    });
    
    return {
      phoneDuplicates,
      nameDuplicates,
      totalCaterers: allCaterers.length,
      duplicateCount: phoneDuplicates.length + nameDuplicates.length
    };
  } catch (error) {
    console.error('Error identifying duplicate caterers:', error);
    return { error: error.message };
  }
};


// Get caterer history with real bills and payments data
const getCatererHistory = async (req, res) => {
  try {
    console.log('📊 Fetching caterer history...');


    const {
      status = 'all', // all, pending, partial, paid, overdue
      search = '',
      min_amount = '',
      max_amount = '',
      date_filter = 'all', // all, this_week, this_month, last_15_days, 6_months
      selected_date = '', // specific date in YYYY-MM-DD format
      page = 1,
      limit = 50
    } = req.query;


    const connection = await pool.getConnection();


    // First, check if we need to create bills for delivered orders
    await createBillsForDeliveredOrders(connection);


    // Build where conditions
    let whereConditions = [];
    let queryParams = [];


    // Status filter - these don't need parameters since they're direct conditions
    if (status !== 'all') {
      if (status === 'pending_caterers') {
        // Show caterers with any pending bills
        whereConditions.push('cb.pending_amount > 0');
      } else if (status === 'pending') {
        // Show bills with full pending amount
        whereConditions.push('cb.pending_amount > 0 AND (cb.paid_amount IS NULL OR cb.paid_amount = 0)');
      } else if (status === 'partial') {
        // Show bills with partial payment
        whereConditions.push('cb.paid_amount > 0 AND cb.pending_amount > 0');
      } else if (status === 'paid') {
        // Show fully paid bills
        whereConditions.push('cb.pending_amount <= 0');
      } else if (status === 'overdue') {
        // Show overdue bills (you might want to add a due_date check here)
        whereConditions.push('cb.pending_amount > 0 AND cb.due_date < CURDATE()');
      } else {
        // For other statuses, use the status column directly
        whereConditions.push('cb.status = ?');
        queryParams.push(status);
      }
    }


    // Search filter (caterer name, contact person, phone, bill number)
    if (search.trim()) {
      whereConditions.push(`(
        cb.bill_number LIKE ? OR
        c.caterer_name LIKE ? OR
        c.contact_person LIKE ? OR
        c.phone_number LIKE ?
      )`);
      const searchTerm = `%${search.trim()}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }


    // Amount filters
    if (min_amount && !isNaN(parseFloat(min_amount))) {
      whereConditions.push('cb.total_amount >= ?');
      queryParams.push(parseFloat(min_amount));
    }
    if (max_amount && !isNaN(parseFloat(max_amount))) {
      whereConditions.push('cb.total_amount <= ?');
      queryParams.push(parseFloat(max_amount));
    }

    // Date filters
    if (selected_date) {
      // Filter by specific date
      whereConditions.push('DATE(cb.bill_date) = ?');
      queryParams.push(selected_date);
    } else if (date_filter && date_filter !== 'all') {
      // Filter by preset date ranges
      const today = new Date();
      const startDate = new Date();
      
      switch (date_filter) {
        case 'this_week':
          // Get start of week (Monday)
          const dayOfWeek = today.getDay();
          const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
          startDate.setDate(diff);
          startDate.setHours(0, 0, 0, 0);
          break;
          
        case 'this_month':
          startDate.setDate(1);
          startDate.setHours(0, 0, 0, 0);
          break;
          
        case 'last_15_days':
          startDate.setDate(today.getDate() - 14);
          startDate.setHours(0, 0, 0, 0);
          break;
          
        case '6_months':
          startDate.setMonth(today.getMonth() - 5);
          startDate.setDate(1);
          startDate.setHours(0, 0, 0, 0);
          break;
      }
      
      if (date_filter !== 'all') {
        whereConditions.push('cb.bill_date >= ?');
        queryParams.push(formatDateLocal(startDate));
      }
    }


    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';


    // Calculate pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offset = (pageNum - 1) * limitNum;

    let bills = [];
    let total = 0;

    // First try to get bills from caterer_bills table
    try {
      const countQuery = `
        SELECT COUNT(DISTINCT cb.id) as total
        FROM caterer_bills cb
        LEFT JOIN caterer_orders co ON cb.caterer_order_id = co.id
        LEFT JOIN caterers c ON cb.caterer_id = c.id
        ${whereClause}
      `;

      console.log('📊 Count query for caterer_bills:', countQuery);
      console.log('📊 Count params:', queryParams);

      const [countResult] = await connection.execute(countQuery, queryParams);
      total = countResult[0].total;

      if (total > 0) {
        // Get bills from caterer_bills
        const billsQuery = `
          SELECT
            cb.*,
            co.order_number,
            co.delivered_at,
            co.created_at as order_created_at,
            c.caterer_name,
            c.contact_person,
            c.phone_number as caterer_phone,
            c.email as caterer_email,
            c.address as caterer_address,
            c.gst_number
          FROM caterer_bills cb
          LEFT JOIN caterer_orders co ON cb.caterer_order_id = co.id
          LEFT JOIN caterers c ON cb.caterer_id = c.id
          ${whereClause}
          ORDER BY cb.created_at DESC, cb.bill_date DESC
          LIMIT ${limitNum} OFFSET ${offset}
        `;
        
        const finalParams = [...queryParams];
        console.log('📊 Bills query for caterer_bills:', billsQuery);
        console.log('📊 Final params:', finalParams);
        
        [bills] = await connection.execute(billsQuery, finalParams);
        console.log(`📊 Found ${bills.length} bills in caterer_bills`);

        // Debug: Log first bill data
        if (bills.length > 0) {
          console.log('🔍 First bill data from caterer_bills:', {
            id: bills[0].id,
            bill_number: bills[0].bill_number,
            total_amount: bills[0].total_amount,
            subtotal: bills[0].subtotal,
            pending_amount: bills[0].pending_amount,
            order_number: bills[0].order_number,
            caterer_order_id: bills[0].caterer_order_id,
            caterer_name: bills[0].caterer_name,
            caterer_phone: bills[0].caterer_phone
          });
        }
      } else {
        // No bills found in caterer_bills, try caterer_sales table
        console.log('🔍 No bills found in caterer_bills, checking caterer_sales table...');
        
        // Build caterer_sales query with similar conditions
        let salesWhereConditions = [...whereConditions];
        let salesQueryParams = [...queryParams];
        
        // Replace caterer_bills references with caterer_sales
        const salesWhereClause = salesWhereConditions.length > 0
          ? salesWhereConditions.map(cond =>
              cond.replace('cb.', 'cs.').replace('caterer_bills', 'caterer_sales')
            ).join(' AND ')
          : '';
        
        // Count query for caterer_sales
        const salesCountQuery = `
          SELECT COUNT(DISTINCT cs.id) as total
          FROM caterer_sales cs
          LEFT JOIN caterers c ON cs.caterer_id = c.id
          ${salesWhereClause ? 'WHERE ' + salesWhereClause : ''}
        `;
        
        const [salesCountResult] = await connection.execute(salesCountQuery, salesQueryParams);
        const salesTotal = salesCountResult[0].total;
        
        if (salesTotal > 0) {
          console.log(`📊 Found ${salesTotal} sales records, converting to bill format...`);
          total = salesTotal;
          
          // Get sales data and convert to bill format
          const salesQuery = `
            SELECT
              cs.id as bill_id,
              cs.bill_number,
              cs.sell_date as bill_date,
              cs.subtotal,
              cs.total_gst,
              cs.items_total,
              cs.other_charges_total,
              cs.grand_total as total_amount,
              cs.payment_status as status,
              cs.notes,
              cs.created_at,
              cs.updated_at,
              cs.caterer_id,
              c.caterer_name,
              c.contact_person,
              c.phone_number as caterer_phone,
              c.email as caterer_email,
              c.address as caterer_address,
              c.gst_number
            FROM caterer_sales cs
            LEFT JOIN caterers c ON cs.caterer_id = c.id
            ${salesWhereClause ? 'WHERE ' + salesWhereClause : ''}
            ORDER BY cs.created_at DESC
            LIMIT ${limitNum} OFFSET ${offset}
          `;
          
          const [salesData] = await connection.execute(salesQuery, salesQueryParams);
          
          // Convert sales data to bill format
          bills = salesData.map(sale => ({
            id: sale.bill_id,
            bill_number: sale.bill_number,
            bill_date: sale.bill_date,
            subtotal: sale.subtotal,
            total_gst: sale.total_gst,
            items_total: sale.items_total,
            other_charges_total: sale.other_charges_total,
            total_amount: sale.total_amount,
            paid_amount: 0, // No payment tracking in caterer_sales
            pending_amount: sale.total_amount, // Full amount is pending
            status: sale.status,
            notes: sale.notes,
            created_at: sale.created_at,
            updated_at: sale.updated_at,
            caterer_id: sale.caterer_id,
            caterer_name: sale.caterer_name,
            contact_person: sale.contact_person,
            caterer_phone: sale.caterer_phone,
            caterer_email: sale.caterer_email,
            caterer_address: sale.caterer_address,
            gst_number: sale.gst_number,
            order_number: sale.bill_number, // Use bill_number as order_number
            items: [], // No items data in caterer_sales
            payment_history: [] // No payment history in caterer_sales
          }));
          
          console.log(`✅ Converted ${bills.length} sales records to bill format`);
        }
      }
    } catch (error) {
      console.error('Error fetching bills:', error);
      // Return empty result on error
      connection.release();
      return res.json({
        success: true,
        data: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          pages: 0
        }
      });
    }


    // Process the bills to add items and payment history
    const processedBills = await Promise.all(bills.map(async (bill) => {
      // Get items for this bill
      const [items] = await connection.execute(`
        SELECT
          coi.*
        FROM caterer_order_items coi
        WHERE coi.caterer_order_id = ?
        ORDER BY coi.id
      `, [bill.caterer_order_id]);


      // Process items to parse mix components
      const processedItems = items.map(item => {
        let parsedItem = { ...item };


        // If it's a mix item and has custom_details, parse the mix components
        if (item.custom_details) {
          try {
            const customDetails = typeof item.custom_details === 'string'
              ? JSON.parse(item.custom_details)
              : item.custom_details;


            if (customDetails && customDetails.mixItems) {
              parsedItem.mix_components = customDetails.mixItems;
            }
          } catch (error) {
            console.error(`Error parsing custom_details for item ${item.id}:`, error);
          }
        }


        return parsedItem;
      });


      console.log(`🛒 Items for bill ${bill.bill_number} (order ${bill.caterer_order_id}):`, {
        items_count: processedItems.length,
        items: processedItems.map(item => ({
          id: item.id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          mix_number: item.mix_number,
          source: item.source,
          has_mix_components: !!item.mix_components,
          mix_components_count: item.mix_components ? item.mix_components.length : 0
        }))
      });


      // Get payment history for this bill
      const [payments] = await connection.execute(`
        SELECT
          cp.*
        FROM caterer_payments cp
        WHERE cp.bill_id = ?
        ORDER BY cp.payment_date DESC, cp.created_at DESC
      `, [bill.id]);


      return {
        ...bill,
        items: processedItems || [],
        payment_history: payments || [],
        // Calculate status based on amounts
        status: bill.pending_amount <= 0 ? 'paid' :
                bill.paid_amount > 0 ? 'partial' : 'pending'
      };
    }));


    connection.release();


    res.json({
      success: true,
      data: processedBills,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching caterer history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch caterer history'
    });
  }
};


// Get caterer history statistics
const getCatererHistoryStats = async (req, res) => {
  try {
    const {
      date_filter = 'all', // all, this_week, this_month, last_15_days, 6_months
      selected_date = '' // specific date in YYYY-MM-DD format
    } = req.query;

    const connection = await pool.getConnection();

    // Build where conditions for stats
    let whereConditions = [];
    let queryParams = [];

    // Date filters for stats
    if (selected_date) {
      // Filter by specific date
      whereConditions.push('DATE(cb.bill_date) = ?');
      queryParams.push(selected_date);
    } else if (date_filter && date_filter !== 'all') {
      // Filter by preset date ranges
      const today = new Date();
      const startDate = new Date();
      
      switch (date_filter) {
        case 'this_week':
          // Get start of week (Monday)
          const dayOfWeek = today.getDay();
          const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
          startDate.setDate(diff);
          startDate.setHours(0, 0, 0, 0);
          break;
          
        case 'this_month':
          startDate.setDate(1);
          startDate.setHours(0, 0, 0, 0);
          break;
          
        case 'last_15_days':
          startDate.setDate(today.getDate() - 14);
          startDate.setHours(0, 0, 0, 0);
          break;
          
        case '6_months':
          startDate.setMonth(today.getMonth() - 5);
          startDate.setDate(1);
          startDate.setHours(0, 0, 0, 0);
          break;
      }
      
      if (date_filter !== 'all') {
        whereConditions.push('cb.bill_date >= ?');
        queryParams.push(formatDateLocal(startDate));
      }
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Get overall statistics
    const [stats] = await connection.execute(`
      SELECT
        COUNT(DISTINCT cb.id) as total_bills,
        COUNT(DISTINCT cb.caterer_id) as unique_caterers,
        COALESCE(SUM(cb.total_amount), 0) as total_revenue,
        COALESCE(SUM(cb.paid_amount), 0) as total_paid,
        COALESCE(SUM(cb.pending_amount), 0) as total_pending,
        COUNT(CASE WHEN cb.status = 'pending' THEN 1 END) as pending_bills,
        COUNT(CASE WHEN cb.status = 'partial' THEN 1 END) as partial_bills,
        COUNT(CASE WHEN cb.status = 'paid' THEN 1 END) as paid_bills,
        COUNT(CASE WHEN cb.status = 'overdue' THEN 1 END) as overdue_bills,
        COUNT(CASE WHEN cb.pending_amount > 0 THEN 1 END) as bills_with_pending_amount
      FROM caterer_bills cb
      ${whereClause}
    `, queryParams);


    connection.release();


    res.json({
      success: true,
      data: stats[0]
    });
  } catch (error) {
    console.error('Error fetching caterer history stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch caterer history statistics'
    });
  }
};


// FIXED: Record payment for caterer bill with collation fix
const recordCatererPayment = async (req, res) => {
  try {
    console.log('📝 Raw request data:', {
      body: req.body,
      file: req.file ? req.file.filename : 'No file'
    });


    // Extract data from FormData (sent by payment collection dialog)
    const {
      caterer_phone,
      caterer_name,
      order_id,
      amount,
      paymentMethod,
      referenceNumber,
      notes
    } = req.body;


    console.log('📝 Payment data received:', {
      caterer_phone,
      caterer_name,
      order_id,
      amount,
      paymentMethod,
      referenceNumber,
      notes,
      hasFile: !!req.file
    });


    // Validate required fields
    if (!amount || !paymentMethod || (!caterer_phone && !order_id)) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: amount, paymentMethod, and either caterer_phone or order_id'
      });
    }


    const connection = await pool.getConnection();
    await connection.beginTransaction();


    try {
      let catererId;
      let orderId = order_id;
      
      // FIXED: Find caterer by phone if provided with collation fix
      if (caterer_phone) {
        const [catererRows] = await connection.execute(`
          SELECT id FROM caterers WHERE phone_number COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
        `, [caterer_phone]);


        if (catererRows.length === 0) {
          // Create caterer if doesn't exist
          const [catererResult] = await connection.execute(`
            INSERT INTO caterers (caterer_name, phone_number, contact_person)
            VALUES (?, ?, ?)
          `, [caterer_name || 'Unknown', caterer_phone, caterer_name || 'Unknown']);
          
          catererId = catererResult.insertId;
          console.log('✅ Created new caterer:', catererId);
        } else {
          catererId = catererRows[0].id;
          console.log('📋 Found existing caterer:', catererId);
        }
      }


      // FIXED: If order_id provided, get order details and ensure caterer exists with collation fix
      let order = null;
      if (orderId) {
        const [orderRows] = await connection.execute(`
          SELECT co.*, c.id as caterer_id
          FROM caterer_orders co
          LEFT JOIN caterers c ON co.caterer_phone COLLATE utf8mb4_unicode_ci = c.phone_number COLLATE utf8mb4_unicode_ci
          WHERE co.id = ?
        `, [orderId]);


        if (orderRows.length === 0) {
          await connection.rollback();
          connection.release();
          return res.status(404).json({
            success: false,
            message: 'Order not found'
          });
        }


        order = orderRows[0];
        catererId = order.caterer_id;


        // If caterer doesn't exist, create from order data
        if (!catererId) {
          const [catererResult] = await connection.execute(`
            INSERT INTO caterers (caterer_name, contact_person, phone_number, email, address, gst_number)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [
            order.caterer_name,
            order.contact_person,
            order.caterer_phone,
            order.caterer_email,
            order.caterer_address,
            order.gst_number
          ]);
          
          catererId = catererResult.insertId;
          console.log('✅ Created caterer from order data:', catererId);
        }
      }


      const paymentAmount = parseFloat(amount);


      // Find existing bill for this order or create one
      let bill = null;
      let billId = null;


      if (orderId) {
        // Look for existing bill for this order
        const [billRows] = await connection.execute(`
          SELECT * FROM caterer_bills WHERE caterer_order_id = ?
        `, [orderId]);


        if (billRows.length > 0) {
          bill = billRows[0];
          billId = bill.id;
          console.log('📋 Found existing bill:', billId);
        } else {
          // Create new bill for this order
          const billNumber = `BILL-${orderId}-${Date.now()}`;
          const totalAmount = parseFloat(order.total_amount) || 0;
          const advancePayment = parseFloat(order.payment_amount) || 0;
          const remainingAmount = Math.max(0, totalAmount - advancePayment);
          
          const [billResult] = await connection.execute(`
            INSERT INTO caterer_bills (
              caterer_id, caterer_order_id, bill_number, bill_date,
              subtotal, total_amount, paid_amount, pending_amount, status
            ) VALUES (?, ?, ?, CURDATE(), ?, ?, ?, ?, ?)
          `, [
            catererId,
            orderId,
            billNumber,
            order.subtotal || 0,
            totalAmount,
            0, // do not pre-add advance here; will be recorded via payment record below
            totalAmount, // full pending; will be reduced by inserted payment
            'pending'
          ]);
          
          billId = billResult.insertId;
          console.log('✅ Created new bill:', billId, 'with remaining amount:', remainingAmount);
          
          // Get the newly created bill
          const [newBillRows] = await connection.execute(`
            SELECT * FROM caterer_bills WHERE id = ?
          `, [billId]);
          
          bill = newBillRows[0];
        }
      }


      if (!bill) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: 'Unable to find or create bill for payment'
        });
      }


      const currentPendingAmount = parseFloat(bill.pending_amount) || 0;


      // Validate payment amount
      if (paymentAmount <= 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: 'Payment amount must be greater than 0'
        });
      }


      // Payment should not exceed pending amount (optional warning, not blocking)
      if (paymentAmount > currentPendingAmount && currentPendingAmount > 0) {
        console.log(`⚠️ Payment amount (₹${paymentAmount}) exceeds pending amount (₹${currentPendingAmount})`);
      }


      // Handle receipt image if uploaded
      let receiptImage = null;
      if (req.file) {
        receiptImage = req.file.filename;
        console.log('📎 Receipt image uploaded:', receiptImage);
      }


      // Insert payment record
      const [paymentResult] = await connection.execute(`
        INSERT INTO caterer_payments (
          caterer_id, bill_id, amount, payment_method, payment_date,
          reference_number, notes, receipt_image
        ) VALUES (?, ?, ?, ?, CURDATE(), ?, ?, ?)
      `, [
        catererId,
        billId,
        paymentAmount,
        paymentMethod,
        referenceNumber || null,
        notes || null,
        receiptImage
      ]);


      console.log('✅ Payment record created:', paymentResult.insertId);


      // Update bill amounts
      const newPaidAmount = (parseFloat(bill.paid_amount) || 0) + paymentAmount;
      const newPendingAmount = Math.max(0, (parseFloat(bill.total_amount) || 0) - newPaidAmount);


      await connection.execute(`
        UPDATE caterer_bills
        SET paid_amount = ?, pending_amount = ?, updated_at = NOW()
        WHERE id = ?
      `, [newPaidAmount, newPendingAmount, billId]);


      // Update bill status based on payment
      let billStatus = 'partial';
      if (newPendingAmount <= 0) {
        billStatus = 'paid';
      } else if (newPaidAmount === 0) {
        billStatus = 'pending';
      }


      await connection.execute(`
        UPDATE caterer_bills SET status = ? WHERE id = ?
      `, [billStatus, billId]);


      console.log('✅ Payment recorded successfully:', {
        billId,
        paymentAmount,
        newPaidAmount,
        newPendingAmount,
        billStatus
      });


      await connection.commit();
      connection.release();


      res.json({
        success: true,
        message: 'Payment recorded successfully',
        data: {
          payment_id: paymentResult.insertId,
          payment_amount: paymentAmount,
          new_paid_amount: newPaidAmount,
          new_pending_amount: newPendingAmount,
          bill_status: billStatus,
          receipt_image: receiptImage
        }
      });


    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }


  } catch (error) {
    console.error('Error recording caterer payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record payment: ' + error.message
    });
  }
};


module.exports = {
  getCatererHistory,
  getCatererHistoryStats,
  recordCatererPayment,
  identifyDuplicateCaterers
};
