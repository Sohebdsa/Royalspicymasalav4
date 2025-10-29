const express = require('express');
const router = express.Router();
const db = require('../config/database.cjs');

// Middleware to log requests
const logRequest = (req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
};

// Middleware to validate sales data
const validateSalesData = (req, res, next) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Request body is required',
        error: 'EMPTY_REQUEST_BODY'
      });
    }

    if (typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({
        success: false,
        message: 'Request body must be an object',
        error: 'INVALID_REQUEST_FORMAT'
      });
    }

    const required = ['caterer_id', 'bill_number', 'sell_date', 'grand_total'];
    const missing = required.filter(field => !req.body[field]);
    
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`,
        error: 'MISSING_REQUIRED_FIELDS'
      });
    }

    if (!req.body.items || !Array.isArray(req.body.items) || req.body.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required',
        error: 'INVALID_ITEMS'
      });
    }

    next();
  } catch (error) {
    console.error('Validation error:', error);
    res.status(400).json({
      success: false,
      message: 'Invalid JSON data',
      error: 'JSON_PARSE_ERROR'
    });
  }
};

// POST /api/caterer-sales/create - Create new caterer sale with mix product support
router.post('/create',
  logRequest,
  validateSalesData,
  async (req, res) => {
    let connection;
    
    try {
      if (!db || !db.pool) {
        console.error('❌ Database pool is not configured');
        return res.status(500).json({
          success: false,
          message: 'Database connection not configured',
          error: 'DB_POOL_NOT_FOUND'
        });
      }

      connection = await db.pool.getConnection();
      console.log('✅ Database connection acquired');
      
      await connection.beginTransaction();
      console.log('🔄 Starting transaction for new sale');
      
      const saleData = req.body;
      const timestamp = new Date().toISOString();
      
      console.log('📊 Processing sale data:', {
        caterer_id: saleData.caterer_id,
        bill_number: saleData.bill_number,
        items_count: saleData.items?.length || 0,
        grand_total: saleData.grand_total
      });
      
      // 1. Insert into caterer_sales table
      console.log('📝 Inserting into caterer_sales table...');
      const [saleResult] = await connection.execute(
        `INSERT INTO caterer_sales 
         (caterer_id, bill_number, sell_date, subtotal, total_gst, 
          items_total, other_charges_total, grand_total, payment_status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          saleData.caterer_id,
          saleData.bill_number,
          saleData.sell_date,
          saleData.subtotal || 0,
          saleData.total_gst || 0,
          saleData.items_total || 0,
          saleData.other_charges_total || 0,
          saleData.grand_total,
          saleData.payment_option === 'full' ? 'paid' : 'partial'
        ]
      );
      
      const saleId = saleResult.insertId;
      console.log(`✅ Sale created with ID: ${saleId}`);
      
      // 2. Insert sale items (including mix products)
      if (saleData.items && saleData.items.length > 0) {
        console.log(`📝 Inserting ${saleData.items.length} sale items...`);
        
        let currentMixId = 1; // Mix ID counter for this sale
        
        for (const item of saleData.items) {
          const amount = (item.quantity || 0) * (item.rate || 0);
          const gstAmount = item.gst_amount || 0;
          const totalAmount = item.isMix || item.total ? parseFloat(item.total || amount) : (amount + gstAmount);
          
          // Check if this is a mix product
          const isMixProduct = item.isMix || (item.product_id && item.product_id.toString().startsWith('mix-'));
          
          // Handle batch information
          let batchNumber = null;
          let expiryDate = null;
          
          if (item.batch) {
            batchNumber = item.batch;
            expiryDate = item.expiry_date || null;
          } else if (item.batches && Array.isArray(item.batches) && item.batches.length > 0) {
            const firstBatch = item.batches[0];
            batchNumber = firstBatch.batch;
            expiryDate = firstBatch.expiry_date || null;
          }
          
          if (isMixProduct && item.mixItems && Array.isArray(item.mixItems) && item.mixItems.length > 0) {
            // Insert mix header item
            console.log(`📦 Inserting mix product: ${item.product_name} (Mix ID: ${currentMixId})`);
            
            const [mixHeaderResult] = await connection.execute(
              `INSERT INTO caterer_sale_items
               (sale_id, product_id, product_name, quantity, unit, rate,
                amount, gst_percentage, gst_amount, total_amount, batch_number, expiry_date,
                is_mix, mix_id, parent_sale_item_id, mix_item_data)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                saleId,
                item.product_id || null,
                item.product_name || '',
                item.quantity || 0,
                item.unit || 'mix',
                item.rate || 0,
                amount || 0,
                item.gst_percentage || item.gst || 0,
                gstAmount || 0,
                totalAmount || 0,
                batchNumber || null,
                expiryDate || null,
                true, // is_mix
                currentMixId, // mix_id
                null, // parent_sale_item_id (null for header)
                JSON.stringify(item.mixItems) // Store full mix data as JSON backup
              ]
            );
            
            const mixHeaderId = mixHeaderResult.insertId;
            
            // Insert individual mix items
            console.log(`   └─ Inserting ${item.mixItems.length} items in mix...`);
            for (const mixItem of item.mixItems) {
              // Get batch info for mix item
              let mixItemBatch = null;
              let mixItemExpiry = null;
              
              if (mixItem.batch) {
                mixItemBatch = mixItem.batch;
                mixItemExpiry = mixItem.expiry_date || null;
              } else if (mixItem.batches && Array.isArray(mixItem.batches) && mixItem.batches.length > 0) {
                const firstBatch = mixItem.batches[0];
                mixItemBatch = firstBatch.batch;
                mixItemExpiry = firstBatch.expiry_date || null;
              }
              
              await connection.execute(
                `INSERT INTO caterer_sale_items
                 (sale_id, product_id, product_name, quantity, unit, rate,
                  amount, gst_percentage, gst_amount, total_amount, batch_number, expiry_date,
                  is_mix, mix_id, parent_sale_item_id, mix_item_data)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  saleId,
                  mixItem.product_id || mixItem.id || null,
                  mixItem.product_name || mixItem.name || '',
                  mixItem.calculatedQuantity || mixItem.quantity || 0,
                  mixItem.unit || 'kg',
                  mixItem.rate || 0,
                  mixItem.allocatedBudget || 0,
                  0, // gst_percentage for mix items
                  0, // gst_amount for mix items
                  mixItem.allocatedBudget || 0,
                  mixItemBatch || null,
                  mixItemExpiry || null,
                  false, // is_mix (these are components, not mix headers)
                  currentMixId, // Same mix_id as parent
                  mixHeaderId, // Reference to parent mix header
                  null // No mix_item_data for components
                ]
              );
            }
            
            currentMixId++; // Increment mix ID for next mix product
          } else {
            // Regular product (non-mix)
            await connection.execute(
              `INSERT INTO caterer_sale_items
               (sale_id, product_id, product_name, quantity, unit, rate,
                amount, gst_percentage, gst_amount, total_amount, batch_number, expiry_date,
                is_mix, mix_id, parent_sale_item_id, mix_item_data)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                saleId,
                item.product_id || null,
                item.product_name || '',
                item.quantity || 0,
                item.unit || 'kg',
                item.rate || 0,
                amount || 0,
                item.gst_percentage || item.gst || 0,
                gstAmount || 0,
                totalAmount || 0,
                batchNumber || null,
                expiryDate || null,
                false, // is_mix
                null, // mix_id
                null, // parent_sale_item_id
                null // mix_item_data
              ]
            );
          }
        }
        console.log(`✅ Inserted all sale items`);
      }
      
      // 3. Insert other charges
      if (saleData.other_charges && Array.isArray(saleData.other_charges) && saleData.other_charges.length > 0) {
        console.log(`📝 Inserting ${saleData.other_charges.length} other charges...`);
        for (const charge of saleData.other_charges) {
          let chargeType = charge.type || 'fixed';
          if (chargeType === 'discount') {
            chargeType = charge.value_type === 'percentage' ? 'percentage' : 'fixed';
          }
          
          await connection.execute(
            `INSERT INTO caterer_sale_other_charges
             (sale_id, charge_name, charge_amount, charge_type)
             VALUES (?, ?, ?, ?)`,
            [
              saleId,
              charge.name || '',
              charge.value || 0,
              chargeType
            ]
          );
        }
        console.log(`✅ Inserted ${saleData.other_charges.length} other charges`);
      }
      
      // 4. Insert payment record
      console.log('📝 Inserting payment record...');
      await connection.execute(
        `INSERT INTO caterer_sale_payments
         (sale_id, payment_date, payment_method, payment_option, payment_amount)
         VALUES (?, ?, ?, ?, ?)`,
        [
          saleId,
          saleData.payment_date || new Date().toISOString().split('T')[0],
          saleData.payment_method || 'cash',
          saleData.payment_option || 'full',
          saleData.payment_amount || 0
        ]
      );
      console.log('✅ Payment record inserted');
      
      await connection.commit();
      console.log('✅ Transaction committed successfully');
      
      const responseData = {
        success: true,
        message: 'Sale created successfully',
        sale_id: saleId,
        bill_number: saleData.bill_number,
        grand_total: saleData.grand_total,
        createdAt: timestamp
      };
      
      console.log('📤 Sale creation response:', responseData);
      res.status(201).json(responseData);
      
    } catch (error) {
      if (connection) {
        await connection.rollback();
        console.error('🔄 Transaction rolled back');
      }
      
      console.error('❌ Error creating sale:', {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage,
        sql: error.sql,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to create sale',
        error: error.message,
        errorCode: error.code,
        sqlMessage: error.sqlMessage || 'Database error'
      });
    } finally {
      if (connection) {
        connection.release();
        console.log('🔓 Database connection released');
      }
    }
  }
);

// GET /api/caterer-sales/caterer/:caterer_id - Get all sales for a caterer
router.get('/caterer/:caterer_id', logRequest, async (req, res) => {
  try {
    const [sales] = await db.pool.execute(
      `SELECT cs.*, 
              (SELECT COUNT(*) 
               FROM caterer_sale_items 
               WHERE sale_id = cs.id AND parent_sale_item_id IS NULL) as items_count,
              (SELECT SUM(payment_amount) FROM caterer_sale_payments WHERE sale_id = cs.id) as total_paid
       FROM caterer_sales cs
       WHERE cs.caterer_id = ?
       ORDER BY cs.sell_date DESC, cs.created_at DESC`,
      [req.params.caterer_id]
    );
    
    res.json({
      success: true,
      sales,
      count: sales.length
    });
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales',
      error: error.message
    });
  }
});

// GET /api/caterer-sales/:sale_id/details - Get sale details with items and payments
router.get('/:sale_id/details', logRequest, async (req, res) => {
  try {
    // Get sale info
    const [sales] = await db.pool.execute(
      'SELECT * FROM caterer_sales WHERE id = ?',
      [req.params.sale_id]
    );
    
    if (sales.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }
    
    // Get all sale items
    const [allItems] = await db.pool.execute(
      'SELECT * FROM caterer_sale_items WHERE sale_id = ? ORDER BY id',
      [req.params.sale_id]
    );
    
    // ONLY RETURN PARENT ITEMS (parent_sale_item_id IS NULL)
    const parentItems = allItems.filter(item => item.parent_sale_item_id === null);
    
    const processedItems = parentItems.map(item => {
      // If this is a mix header (is_mix = 1), find its children
      if (item.is_mix === 1) {
        const mixComponents = allItems.filter(childItem => 
          childItem.parent_sale_item_id === item.id && 
          childItem.mix_id === item.mix_id
        );
        
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
    
    // Get payments
    const [payments] = await db.pool.execute(
      'SELECT * FROM caterer_sale_payments WHERE sale_id = ?',
      [req.params.sale_id]
    );
    
    // Get other charges
    const [charges] = await db.pool.execute(
      'SELECT * FROM caterer_sale_other_charges WHERE sale_id = ?',
      [req.params.sale_id]
    );
    
    res.json({
      success: true,
      sale: {
        ...sales[0],
        items: processedItems,
        payments,
        other_charges: charges
      }
    });
  } catch (error) {
    console.error('Error fetching sale details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sale details',
      error: error.message
    });
  }
});

// GET /api/caterer-sales/next-bill-number - Get next available bill number
router.get('/next-bill-number', logRequest, async (req, res) => {
  try {
    const [result] = await db.pool.execute(
      `SELECT bill_number FROM caterer_sales 
       ORDER BY id DESC LIMIT 1`
    );
    
    let nextBillNumber = '#0001';
    
    if (result.length > 0) {
      const lastBillNumber = result[0].bill_number;
      const numberPart = parseInt(lastBillNumber.replace('#', ''));
      const nextNumber = numberPart + 1;
      nextBillNumber = `#${String(nextNumber).padStart(4, '0')}`;
    }
    
    res.json({
      success: true,
      bill_number: nextBillNumber
    });
  } catch (error) {
    console.error('Error getting next bill number:', error);
    res.json({
      success: true,
      bill_number: '#0001'
    });
  }
});

// GET /api/caterer-sales - Get all caterer sales with complete details including mix products
router.get('/', logRequest, async (req, res) => {
  try {
    console.log('📊 Fetching all caterer sales with details...');
    
    const [sales] = await db.pool.execute(`
      SELECT cs.*,
             c.caterer_name,
             c.contact_person,
             c.phone_number,
             c.email,
             c.address,
             c.city,
             c.state,
             c.pincode,
             c.gst_number,
             (SELECT COUNT(*) 
              FROM caterer_sale_items 
              WHERE sale_id = cs.id AND parent_sale_item_id IS NULL) as items_count,
             (SELECT SUM(payment_amount) FROM caterer_sale_payments WHERE sale_id = cs.id) as total_paid
      FROM caterer_sales cs
      LEFT JOIN caterers c ON cs.caterer_id = c.id
      ORDER BY cs.sell_date DESC, cs.created_at DESC
    `);
    
    console.log(`✅ Found ${sales.length} sales, fetching related data...`);
    
    const salesWithDetails = await Promise.all(
      sales.map(async (sale) => {
        // Get all sale items
        const [allItems] = await db.pool.execute(
          `SELECT * FROM caterer_sale_items 
           WHERE sale_id = ? 
           ORDER BY id`,
          [sale.id]
        );
        
        // ONLY RETURN PARENT ITEMS (parent_sale_item_id IS NULL)
        const parentItems = allItems.filter(item => item.parent_sale_item_id === null);
        
        const processedItems = parentItems.map(item => {
          // If this is a mix header (is_mix = 1), find its children
          if (item.is_mix === 1) {
            const mixComponents = allItems.filter(childItem => 
              childItem.parent_sale_item_id === item.id && 
              childItem.mix_id === item.mix_id
            );
            
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
        
        // Get payments
        const [payments] = await db.pool.execute(
          'SELECT * FROM caterer_sale_payments WHERE sale_id = ? ORDER BY payment_date DESC, created_at DESC',
          [sale.id]
        );
        
        // Get other charges
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
      })
    );
    
    console.log(`✅ Successfully fetched complete details for ${salesWithDetails.length} sales`);
    
    res.json({
      success: true,
      data: salesWithDetails,
      count: salesWithDetails.length
    });
  } catch (error) {
    console.error('❌ Error fetching caterer sales:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch caterer sales',
      error: error.message
    });
  }
});

// Test endpoint
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Caterer sales routes are working',
    timestamp: new Date().toISOString()
  });
});

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Caterer sales routes are healthy',
    timestamp: new Date().toISOString(),
    endpoint: '/api/caterer-sales'
  });
});

// GET root endpoint
router.get('/root', (req, res) => {
  res.json({
    success: true,
    message: 'Caterer sales API is available',
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      'POST /create - Create new sale with mix product support',
      'GET / - Get all caterer sales with complete details',
      'GET /caterer/:caterer_id - Get caterer sales',
      'GET /:sale_id/details - Get sale details',
      'GET /next-bill-number - Get next bill number',
      'GET /health - Health check',
      'GET /test - Test endpoint'
    ]
  });
});

// Error handler
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    requestedPath: req.originalUrl,
    availableRoutes: [
      'POST /create',
      'GET /',
      'GET /caterer/:caterer_id',
      'GET /:sale_id/details',
      'GET /next-bill-number',
      'GET /health',
      'GET /test'
    ]
  });
});

module.exports = router;
