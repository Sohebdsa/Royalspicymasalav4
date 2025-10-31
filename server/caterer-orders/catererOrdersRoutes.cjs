const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const {
  getCatererOrders,
  getCatererOrderById,
  createCatererOrder,
  updateCatererOrderStatus,
  getCatererOrderStats,
  getCatererHistory,
  getCatererHistoryStats,
  recordCatererPayment
} = require('./index.cjs');

// Configure multer for receipt image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const receiptsDir = path.join(__dirname, 'images', 'reciept');
    if (!require('fs').existsSync(receiptsDir)) {
      require('fs').mkdirSync(receiptsDir, { recursive: true });
    }
    cb(null, receiptsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'receipt-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept images only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// Routes for caterer orders
router.get('/', getCatererOrders);
router.get('/stats', getCatererOrderStats);
router.get('/history', getCatererHistory);
router.get('/history/stats', getCatererHistoryStats);
router.get('/:id', getCatererOrderById);
router.post('/', createCatererOrder);
router.put('/:id/status', updateCatererOrderStatus);

// Bills endpoint for caterer orders
router.get('/:orderId/bills', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { pool } = require('./db.cjs');
    const connection = await pool.getConnection();
    
    const query = `
      SELECT * FROM caterer_bills 
      WHERE caterer_order_id = ? 
      ORDER BY created_at DESC
    `;
    
    const [bills] = await connection.execute(query, [orderId]);
    connection.release();
    
    res.json({
      success: true,
      data: bills
    });
  } catch (error) {
    console.error('Error fetching bills:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bills'
    });
  }
});

// Debug route to identify duplicate caterers
router.get('/debug/duplicate-caterers', async (req, res) => {
  try {
    const { pool } = require('./db.cjs');
    const connection = await pool.getConnection();
    
    // Check for duplicate caterers in caterers table
    const [duplicateCaterers] = await connection.execute(`
      SELECT phone_number, COUNT(*) as count, GROUP_CONCAT(id) as ids
      FROM caterers
      GROUP BY phone_number
      HAVING count > 1
    `);
    
    // Check for caterers in orders but not in caterers table
    const [orphansInOrders] = await connection.execute(`
      SELECT DISTINCT co.caterer_phone, co.caterer_name, co.contact_person
      FROM caterer_orders co
      LEFT JOIN caterers c ON co.caterer_phone = c.phone
      WHERE c.id IS NULL
      LIMIT 10
    `);
    
    // Get total counts
    const [catererCount] = await connection.execute('SELECT COUNT(*) as total FROM caterers');
    const [orderCount] = await connection.execute('SELECT COUNT(*) as total FROM caterer_orders');
    const [uniqueCaterersInOrders] = await connection.execute(`
      SELECT COUNT(DISTINCT caterer_phone) as unique_count
      FROM caterer_orders
      WHERE caterer_phone IS NOT NULL
    `);
    
    const result = {
      duplicate_caterers: duplicateCaterers,
      orphans_in_orders: orphansInOrders,
      statistics: {
        total_caterers: catererCount[0].total,
        total_orders: orderCount[0].total,
        unique_caterers_in_orders: uniqueCaterersInOrders[0].unique_count,
        potential_duplicates: uniqueCaterersInOrders[0].unique_count - catererCount[0].total
      }
    };
    
    connection.release();
    
    res.json({
      success: true,
      message: 'Duplicate caterer analysis completed',
      data: result
    });
  } catch (error) {
    console.error('Error in duplicate caterer analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze duplicate caterers',
      error: error.message
    });
  }
});

// Payment routes
router.post('/payments', upload.single('receipt_image'), recordCatererPayment);

module.exports = router;

