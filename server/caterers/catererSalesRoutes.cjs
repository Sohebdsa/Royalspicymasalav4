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
    // Check if request has JSON data
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Request body is required',
        error: 'EMPTY_REQUEST_BODY'
      });
    }

    // Basic validation - check if it's an object
    if (typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({
        success: false,
        message: 'Request body must be an object',
        error: 'INVALID_REQUEST_FORMAT'
      });
    }

    // Validate required fields
    const required = ['caterer_id', 'bill_number', 'sell_date', 'grand_total'];
    const missing = required.filter(field => !req.body[field]);
    
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`,
        error: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Validate items array
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

// POST /api/caterer-sales/create - Create new caterer sale
// POST /api/caterer-sales/create - Create new caterer sale
router.post('/create',
  logRequest,
  validateSalesData,
  async (req, res) => {
    let connection;
    
    try {
      // Check if db.pool exists
      if (!db || !db.pool) {
        console.error('❌ Database pool is not configured');
        return res.status(500).json({
          success: false,
          message: 'Database connection not configured',
          error: 'DB_POOL_NOT_FOUND'
        });
      }

      // Get connection from pool
      connection = await db.pool.getConnection();
      console.log('✅ Database connection acquired');
      
      // Start transaction
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
      
      // 2. Insert sale items
      if (saleData.items && saleData.items.length > 0) {
        console.log(`📝 Inserting ${saleData.items.length} sale items...`);
        for (const item of saleData.items) {
          const amount = (item.quantity || 0) * (item.rate || 0);
          const gstAmount = item.gst_amount || 0;
          const totalAmount = amount + gstAmount;
          
          // Handle batch information - support both single batch and multiple batches
          let batchNumber = null;
          let expiryDate = null;
          
          if (item.batch) {
            // Single batch case
            batchNumber = item.batch;
            expiryDate = item.expiry_date || null;
          } else if (item.batches && Array.isArray(item.batches) && item.batches.length > 0) {
            // Multiple batches case - use the first batch as primary for traceability
            const firstBatch = item.batches[0];
            batchNumber = firstBatch.batch;
            expiryDate = firstBatch.expiry_date || null;
          }
          
          await connection.execute(
            `INSERT INTO caterer_sale_items
             (sale_id, product_id, product_name, quantity, unit, rate,
              amount, gst_percentage, gst_amount, total_amount, batch_number, expiry_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
              expiryDate || null
            ]
          );
        }
        console.log(`✅ Inserted ${saleData.items.length} sale items`);
      }
      
      // 3. Insert other charges if any
      if (saleData.other_charges && Array.isArray(saleData.other_charges) && saleData.other_charges.length > 0) {
        console.log(`📝 Inserting ${saleData.other_charges.length} other charges...`);
        for (const charge of saleData.other_charges) {
          await connection.execute(
            `INSERT INTO caterer_sale_other_charges
             (sale_id, charge_name, charge_amount, charge_type)
             VALUES (?, ?, ?, ?)`,
            [
              saleId,
              charge.charge_name || '',
              charge.charge_amount || 0,
              charge.charge_type || 'fixed'
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
      
      // Commit transaction
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
      // Rollback on error
      if (connection) {
        await connection.rollback();
        console.error('🔄 Transaction rolled back');
      }
      
      // Enhanced error logging
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
              (SELECT COUNT(*) FROM caterer_sale_items WHERE sale_id = cs.id) as items_count,
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
    
    // Get sale items
    const [items] = await db.pool.execute(
      'SELECT * FROM caterer_sale_items WHERE sale_id = ?',
      [req.params.sale_id]
    );
    
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
        items,
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

// Test endpoint
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Caterer sales routes are working',
    testData: {
      caterer_id: "15",
      bill_number: "#0001",
      sell_date: "2025-10-28",
      items: [
        {
          product_id: "11",
          product_name: "rice",
          quantity: 1,
          unit: "bag",
          rate: 420
        }
      ],
      subtotal: 420,
      total_gst: 0,
      items_total: 420,
      other_charges: [],
      other_charges_total: 0,
      grand_total: 420,
      payment_date: "2025-10-28",
      payment_method: "cash",
      payment_option: "full",
      payment_amount: 420
    },
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
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Caterer sales API is available',
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      'POST /create - Create new sale',
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
      'GET /caterer/:caterer_id',
      'GET /:sale_id/details',
      'GET /next-bill-number',
      'GET /health',
      'GET /test'
    ]
  });
});

module.exports = router;
