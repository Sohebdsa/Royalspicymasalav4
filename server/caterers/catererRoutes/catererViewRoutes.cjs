const express = require('express');
const router = express.Router();
const db = require('../../config/database.cjs');

// Middleware to log requests
const logRequest = (req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
};

// FIXED: Health check endpoint - MUST come before dynamic routes
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Caterer view routes are healthy',
    timestamp: new Date().toISOString(),
    endpoint: '/api/caterer-view'
  });
});

// GET /api/caterer-view/:caterer_id/sales - Get filtered sales for a caterer
// FIXED: Specific route MUST come before the more general /:caterer_id route
router.get('/:caterer_id/sales', logRequest, async (req, res) => {
  try {
    const catererId = req.params.caterer_id;
    const {
      search,
      status,
      date_from,
      date_to,
      min_amount,
      max_amount,
      page = 1,
      limit = 20
    } = req.query;

    if (!catererId || isNaN(parseInt(catererId))) {
      return res.status(400).json({
        success: false,
        message: 'Valid caterer ID is required'
      });
    }

    let query = `
      SELECT cs.*,
             c.caterer_name,
             c.contact_person,
             c.phone_number as caterer_phone,
             c.email as caterer_email,
             c.address as caterer_address,
             (SELECT COUNT(*) 
              FROM caterer_sale_items 
              WHERE sale_id = cs.id AND parent_sale_item_id IS NULL) as items_count,
             (SELECT SUM(payment_amount) FROM caterer_sale_payments WHERE sale_id = cs.id) as total_paid
      FROM caterer_sales cs
      LEFT JOIN caterers c ON cs.caterer_id = c.id
      WHERE cs.caterer_id = ?
    `;

    const queryParams = [catererId];
    const conditions = [];

    // Add search filter
    if (search) {
      conditions.push('(cs.bill_number LIKE ? OR cs.notes LIKE ?)');
      const searchParam = `%${search}%`;
      queryParams.push(searchParam, searchParam);
    }

    // Add status filter
    if (status) {
      conditions.push('cs.payment_status = ?');
      queryParams.push(status);
    }

    // Add date range filter
    if (date_from) {
      conditions.push('DATE(cs.sell_date) >= ?');
      queryParams.push(date_from);
    }

    if (date_to) {
      conditions.push('DATE(cs.sell_date) <= ?');
      queryParams.push(date_to);
    }

    // Add amount range filter
    if (min_amount) {
      conditions.push('cs.grand_total >= ?');
      queryParams.push(parseFloat(min_amount));
    }

    if (max_amount) {
      conditions.push('cs.grand_total <= ?');
      queryParams.push(parseFloat(max_amount));
    }

    // Add conditions to query
    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    // Add LIMIT and OFFSET directly in query string
    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);
    const offset = (parsedPage - 1) * parsedLimit;

    const finalQuery = query + ` ORDER BY cs.sell_date DESC, cs.created_at DESC LIMIT ${parsedLimit} OFFSET ${offset}`;
    const finalParams = queryParams;

    // console.log('Final Query:', finalQuery);
    // console.log('Final Params:', finalParams);

    const [sales] = await db.pool.execute(finalQuery, finalParams);

    // Debug: Log sales data structure
    console.log('Sales data received:', {
      salesCount: sales.length,
      firstSale: sales[0] ? {
        id: sales[0].id,
        bill_number: sales[0].bill_number,
        items_count: sales[0].items_count,
        is_mix: sales[0].is_mix,
        mix_items: sales[0].mix_items
      } : null,
      sampleItems: sales.length > 0 ? sales[0].items?.slice(0, 2) : []
    });

    // Ensure sales is an array
    const salesArray = Array.isArray(sales) ? sales : [];

    // Get all sale items for these sales
    const saleIds = salesArray.map(sale => sale.id);
    let allItems = [];

    if (saleIds.length > 0) {
      const [items] = await db.pool.execute(
        `SELECT * FROM caterer_sale_items
         WHERE sale_id IN (${saleIds.map(() => '?').join(',')})
         ORDER BY id`,
        saleIds
      );
      allItems = items;
    }

    // Process sales with complete item details using Promise.all
    const salesWithDetails = await Promise.all(salesArray.map(async (sale) => {
      // Get parent items only for this sale
      const parentItems = allItems.filter(item =>
        item.sale_id === sale.id && item.parent_sale_item_id === null
      );

      const processedItems = parentItems.map(item => {
        // Check if this item has child items (mix components)
        const mixComponents = allItems.filter(childItem =>
          childItem.sale_id === sale.id &&
          childItem.parent_sale_item_id === item.id &&
          childItem.mix_id === item.mix_id
        );

        // If this is a mix header (has children OR is_mix flag is set), process as mix
        const isMix = (item.is_mix === 1 || item.is_mix === true) || mixComponents.length > 0;

        if (isMix && mixComponents.length > 0) {
          return {
            ...item,
            is_mix: true,
            mix_items: mixComponents.map(comp => ({
              product_id: comp.product_id,
              product_name: comp.product_name,
              quantity: parseFloat(comp.quantity),
              unit: comp.unit,
              rate: parseFloat(comp.rate),
              allocatedBudget: parseFloat(comp.total_amount),
              batch_number: comp.batch_number,
              expiry_date: comp.expiry_date
            }))
          };
        }

        // Regular item (not a mix)
        return {
          ...item,
          is_mix: false
        };
      });

      // Get payments for this sale
      const [payments] = await db.pool.execute(
        'SELECT * FROM caterer_sale_payments WHERE sale_id = ? ORDER BY payment_date DESC, created_at DESC',
        [sale.id]
      );

      // Get other charges for this sale
      const [charges] = await db.pool.execute(
        'SELECT * FROM caterer_sale_other_charges WHERE sale_id = ? ORDER BY id',
        [sale.id]
      );

      return {
        ...sale,
        items: processedItems,
        payments: payments || [],
        other_charges: charges || []
      };
    }));

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM caterer_sales cs
      WHERE cs.caterer_id = ?
    `;

    const countParams = [catererId];

    if (conditions.length > 0) {
      countQuery += ' AND ' + conditions.join(' AND ');
    }

    const [countResult] = await db.pool.execute(countQuery, countParams);
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / parsedLimit);

    res.json({
      success: true,
      data: salesWithDetails,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages
      },
      message: 'Caterer sales fetched successfully'
    });

  } catch (error) {
    console.error('Error fetching caterer sales:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch caterer sales',
      error: error.message
    });
  }
});

// GET /api/caterer-view/:caterer_id - Get complete caterer view with sales and stats
router.get('/:caterer_id', logRequest, async (req, res) => {
  try {
    const catererId = req.params.caterer_id;

    if (!catererId || isNaN(parseInt(catererId))) {
      return res.status(400).json({
        success: false,
        message: 'Valid caterer ID is required'
      });
    }

    // Get caterer basic information
    const [caterers] = await db.pool.execute(
      'SELECT * FROM caterers WHERE id = ?',
      [catererId]
    );

    if (caterers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Caterer not found'
      });
    }

    const caterer = caterers[0];

    // Get caterer sales with complete details
    const [sales] = await db.pool.execute(`
      SELECT cs.*,
             c.caterer_name,
             c.contact_person,
             c.phone_number as caterer_phone,
             c.email as caterer_email,
             c.address as caterer_address,
             (SELECT COUNT(*) 
              FROM caterer_sale_items 
              WHERE sale_id = cs.id AND parent_sale_item_id IS NULL) as items_count,
             (SELECT SUM(payment_amount) FROM caterer_sale_payments WHERE sale_id = cs.id) as total_paid
      FROM caterer_sales cs
      LEFT JOIN caterers c ON cs.caterer_id = c.id
      WHERE cs.caterer_id = ?
      ORDER BY cs.sell_date DESC, cs.created_at DESC
    `, [catererId]);

    // Get all sale items for these sales
    const saleIds = sales.map(sale => sale.id);
    let allItems = [];

    if (saleIds.length > 0) {
      const [items] = await db.pool.execute(
        `SELECT * FROM caterer_sale_items 
         WHERE sale_id IN (${saleIds.map(() => '?').join(',')})
         ORDER BY id`,
        saleIds
      );
      allItems = items;
    }

    // Process sales with complete item details using Promise.all
    const salesWithDetails = await Promise.all(sales.map(async (sale) => {
      // Get parent items only for this sale
      const parentItems = allItems.filter(item =>
        item.sale_id === sale.id && item.parent_sale_item_id === null
      );

      const processedItems = parentItems.map(item => {
        // Check if this item has child items (mix components)
        const mixComponents = allItems.filter(childItem =>
          childItem.sale_id === sale.id &&
          childItem.parent_sale_item_id === item.id &&
          childItem.mix_id === item.mix_id
        );

        // If this is a mix header (has children OR is_mix flag is set), process as mix
        const isMix = (item.is_mix === 1 || item.is_mix === true) || mixComponents.length > 0;

        if (isMix && mixComponents.length > 0) {
          return {
            ...item,
            is_mix: true,
            mix_items: mixComponents.map(comp => ({
              product_id: comp.product_id,
              product_name: comp.product_name,
              quantity: parseFloat(comp.quantity),
              unit: comp.unit,
              rate: parseFloat(comp.rate),
              allocatedBudget: parseFloat(comp.total_amount),
              batch_number: comp.batch_number,
              expiry_date: comp.expiry_date
            }))
          };
        }

        // Regular item (not a mix)
        return {
          ...item,
          is_mix: false
        };
      });

      // Get payments for this sale
      const [payments] = await db.pool.execute(
        'SELECT * FROM caterer_sale_payments WHERE sale_id = ? ORDER BY payment_date DESC, created_at DESC',
        [sale.id]
      );

      // Get other charges for this sale
      const [charges] = await db.pool.execute(
        'SELECT * FROM caterer_sale_other_charges WHERE sale_id = ? ORDER BY id',
        [sale.id]
      );

      return {
        ...sale,
        items: processedItems,
        payments: payments || [],
        other_charges: charges || []
      };
    }));

    // Calculate statistics
    const totalBills = sales.length;
    const totalAmount = sales.reduce((sum, sale) => sum + parseFloat(sale.grand_total || 0), 0);
    const paidBills = sales.filter(sale => sale.payment_status === 'paid').length;
    const pendingBills = sales.filter(sale => sale.payment_status === 'pending').length;
    const partialBills = sales.filter(sale => sale.payment_status === 'partial').length;
    const totalPaid = sales.reduce((sum, sale) => sum + parseFloat(sale.total_paid || 0), 0);
    const totalPending = sales.reduce((sum, sale) => {
      const pending = parseFloat(sale.grand_total || 0) - parseFloat(sale.total_paid || 0);
      return sum + (pending > 0 ? pending : 0);
    }, 0);

    // Get recent activity (last 10 transactions)
    const [recentActivity] = await db.pool.execute(`
      SELECT cs.id, cs.bill_number, cs.sell_date, cs.grand_total, cs.payment_status,
             (SELECT SUM(payment_amount) FROM caterer_sale_payments WHERE sale_id = cs.id) as total_paid
      FROM caterer_sales cs
      WHERE cs.caterer_id = ?
      ORDER BY cs.created_at DESC
      LIMIT 10
    `, [catererId]);

    // Get monthly sales data for the chart
    const [monthlySales] = await db.pool.execute(`
      SELECT 
        DATE_FORMAT(sell_date, '%Y-%m') as month,
        COUNT(*) as bill_count,
        COALESCE(SUM(grand_total), 0) as total_amount,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN grand_total ELSE 0 END), 0) as paid_amount
      FROM caterer_sales
      WHERE caterer_id = ? AND sell_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(sell_date, '%Y-%m')
      ORDER BY month
    `, [catererId]);

    // Get payment method distribution
    const [paymentMethods] = await db.pool.execute(`
      SELECT 
        payment_method,
        COUNT(*) as transaction_count,
        COALESCE(SUM(payment_amount), 0) as total_amount
      FROM caterer_sale_payments
      WHERE sale_id IN (SELECT id FROM caterer_sales WHERE caterer_id = ?)
      GROUP BY payment_method
    `, [catererId]);

    const catererViewData = {
      caterer: {
        ...caterer,
        balance_due: totalPending
      },
      sales: salesWithDetails,
      statistics: {
        totalBills,
        totalAmount,
        paidBills,
        pendingBills,
        partialBills,
        totalPaid,
        totalPending
      },
      recentActivity,
      monthlySales,
      paymentMethods
    };

    res.json({
      success: true,
      data: catererViewData,
      message: 'Caterer view data fetched successfully'
    });

  } catch (error) {
    console.error('Error fetching caterer view data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch caterer view data',
      error: error.message
    });
  }
});

// Error handler for invalid routes - MUST come last
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    requestedPath: req.originalUrl,
    availableRoutes: [
      'GET /health - Health check',
      'GET /:caterer_id - Get complete caterer view with sales and stats',
      'GET /:caterer_id/sales - Get filtered sales for a caterer'
    ]
  });
});

module.exports = router;
