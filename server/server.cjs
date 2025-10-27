const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const session = require('express-session');

const { testConnection, initializeDatabase } = require('./config/database.cjs');
const { initializeAdminSystem } = require('./login/adminDatabase.cjs');
const { initializeProductsDatabase } = require('./products/productsDatabase.cjs');
const { initializeExpensesDatabase } = require('./financial/expenseDatabase.cjs');
const { initializeAssets } = require('./financial/initAssets.cjs');
const { initializeSuppliers } = require('./suppliers/supplierDatabase.cjs');
const { initializeSupplierPurchases } = require('./suppliers/supplierPurchaseDatabase.cjs');
const { initializeInventoryDatabase } = require('./inventory/inventoryDatabase.cjs');
const { initializeCaterersDatabase } = require('./caterers/catererDatabase.cjs'); // Add if exists
const { initializeOrdersDatabase } = require('./orders/ordersDatabase.cjs');
const { initializeCatererOrdersDatabase } = require('./caterer-orders/catererOrdersDatabase.cjs');
const { initializeCustomersDatabase } = require('./customers/customersDatabase.cjs');


const adminAuthRoutes = require('./login/adminAuthRoutes.cjs');
const productsRoutes = require('./products/index.cjs');
const expenseRoutes = require('./financial/expenseRoutes.cjs');
const assetRoutes = require('./financial/assetRoutes.cjs');
const supplierRoutes = require('./suppliers/supplierRoutes.cjs');
const supplierPurchaseRoutes = require('./suppliers/supplierPurchaseRoutes.cjs');
const paymentRecordsRoutes = require('./suppliers/paymentRecordsRoutes.cjs');
const inventoryRoutes = require('./inventory/inventoryRoutes.cjs');
const catererRoutes = require('./caterers/catererRoutes.cjs');
const catererSalesRoutes = require('./caterers/catererSalesRoutes.cjs');
const ordersRoutes = require('./orders/ordersRoutes.cjs');
const catererOrdersRoutes = require('./caterer-orders/catererOrdersRoutes.cjs');
const customersRoutes = require('./customers/customersRoutes.cjs');


const app = express();
const PORT = process.env.PORT || 5000;

// Create upload directories if they don't exist
const createUploadDirectories = () => {
  const directories = [
    path.join(__dirname, 'products/images'),
    path.join(__dirname, 'financial/receipts'),
    path.join(__dirname, 'financial/assets'),
    path.join(__dirname, 'financial/assets/receipts'),
    path.join(__dirname, 'suppliers/images'),
    path.join(__dirname, 'suppliers/receipts'),
    path.join(__dirname, 'caterers/images'), // *** CRITICAL: Caterer images directory ***
    path.join(__dirname, 'caterer-orders/images/reciept'), // *** CRITICAL: Caterer order receipts directory ***
  ];

  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  });
};

// Initialize upload directories
createUploadDirectories();

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add express-session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'royalspicysecret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // set to true if using HTTPS
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

// *** CRITICAL: Static file routes - Including the missing caterer images and receipts routes ***
app.use('/uploads/products', express.static(path.join(__dirname, 'products/images')));
app.use('/uploads/receipts', express.static(path.join(__dirname, 'financial/receipts')));
app.use('/uploads/assets', express.static(path.join(__dirname, 'financial/assets')));
app.use('/uploads/assets/receipts', express.static(path.join(__dirname, 'financial/assets/receipts')));
app.use('/uploads/suppliers', express.static(path.join(__dirname, 'suppliers/images')));
app.use('/uploads/supplier-receipts', express.static(path.join(__dirname, 'suppliers/receipts')));

// *** FIX: Add the missing caterer images static route ***
app.use('/images', express.static(path.join(__dirname, 'caterers/images')));

// *** FIX: Add the missing caterer order receipts static route ***
app.use('/uploads/caterer-receipts', express.static(path.join(__dirname, 'caterer-orders/images/reciept')));

// Log static routes configuration
console.log('🖼️  Static routes configured:');
console.log('   - Products: /uploads/products');
console.log('   - Receipts: /uploads/receipts');
console.log('   - Assets: /uploads/assets');
console.log('   - Asset Receipts: /uploads/assets/receipts');
console.log('   - Suppliers: /uploads/suppliers');
console.log('   - Supplier Receipts: /uploads/supplier-receipts');
console.log('   - Caterer Images: /images *** (FIXED) ***');
console.log('   - Caterer Receipts: /uploads/caterer-receipts *** (FIXED) ***');

// API Routes
app.use('/api/admin', adminAuthRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/supplier-purchases', supplierPurchaseRoutes);
app.use('/api/payment-records', paymentRecordsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/caterers', catererRoutes);
app.use('/api/caterer-sales', catererSalesRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/caterer-orders', catererOrdersRoutes);
app.use('/api/customers', customersRoutes);


// Health check route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Royal Spicy Masala API is running',
    timestamp: new Date().toISOString(),
    staticRoutes: {
      products: '/uploads/products',
      receipts: '/uploads/receipts',
      assets: '/uploads/assets',
      assetReceipts: '/uploads/assets/receipts',
      suppliers: '/uploads/suppliers',
      supplierReceipts: '/uploads/supplier-receipts',
      catererImages: '/images',
      catererReceipts: '/uploads/caterer-receipts'
    }
  });
});

// Test route for caterer images
app.get('/api/test-caterer-images', (req, res) => {
  try {
    const catererImagesDir = path.join(__dirname, 'caterers/images');
    const files = fs.readdirSync(catererImagesDir);
    res.json({
      success: true,
      message: 'Caterer images directory accessible',
      path: catererImagesDir,
      filesCount: files.length,
      files: files.slice(0, 10), // Show first 10 files
      testUrl: `http://localhost:${PORT}/images/`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Cannot access caterer images directory',
      error: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('🚨 Server Error:', err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    message: 'Route not found',
    requestedPath: req.originalUrl,
    availableEndpoints: {
      health: '/api/health',
      testCatererImages: '/api/test-caterer-images',
      caterers: '/api/caterers',
      catererImages: '/images'
    }
  });
});

// Initialize caterers database if function exists
const initializeCaterersSystem = async () => {
  try {
    // Check if caterer database initialization function exists
    if (typeof initializeCaterersDatabase === 'function') {
      console.log('🍽️  Initializing caterers system...');
      await initializeCaterersDatabase();
      console.log('✅ Caterers system initialized successfully!');
    } else {
      console.log('ℹ️  Caterers database initialization not found, skipping...');
    }
  } catch (error) {
    console.error('⚠️  Error initializing caterers system:', error.message);
    // Don't exit, just warn
  }
};

// Start server
const startServer = async () => {
  try {
    // Test database connection
    console.log('🔍 Testing database connection...');
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ Failed to connect to database. Please check your database configuration.');
      process.exit(1);
    }
    console.log('✅ Database connected successfully!');

    // Initialize database tables
    console.log('🔧 Initializing database tables...');
    const dbInitialized = await initializeDatabase();
    if (!dbInitialized) {
      console.error('❌ Failed to initialize database tables.');
      process.exit(1);
    }
    console.log('✅ Database tables initialized successfully!');

    // Initialize admin system
    console.log('👤 Initializing admin system...');
    const adminInitialized = await initializeAdminSystem();
    if (!adminInitialized) {
      console.error('❌ Failed to initialize admin system.');
      process.exit(1);
    }
    console.log('✅ Admin system initialized successfully!');

    // Initialize products system
    console.log('📦 Initializing products system...');
    const productsInitialized = await initializeProductsDatabase();
    if (!productsInitialized) {
      console.error('❌ Failed to initialize products system.');
      process.exit(1);
    }
    console.log('✅ Products system initialized successfully!');

    // Initialize expenses system
    console.log('💰 Initializing expenses system...');
    await initializeExpensesDatabase();
    console.log('✅ Expenses system initialized successfully!');

    // Initialize assets system
    console.log('🏢 Initializing assets system...');
    await initializeAssets();
    console.log('✅ Assets system initialized successfully!');

    // Initialize suppliers system
    console.log('🤝 Initializing suppliers system...');
    await initializeSuppliers();
    console.log('✅ Suppliers system initialized successfully!');

    // Initialize supplier purchases system
    console.log('🛒 Initializing supplier purchases system...');
    await initializeSupplierPurchases();
    console.log('✅ Supplier purchases system initialized successfully!');

    // Initialize inventory system
    console.log('📦 Initializing inventory system...');
    await initializeInventoryDatabase();
    console.log('✅ Inventory system initialized successfully!');

    // Initialize caterers system
    await initializeCaterersSystem();

    // Initialize orders system
    console.log('📋 Initializing orders system...');
    const ordersInitialized = await initializeOrdersDatabase();
    if (!ordersInitialized) {
      console.error('❌ Failed to initialize orders system.');
      process.exit(1);
    }
    console.log('✅ Orders system initialized successfully!');

    // Initialize caterer orders system
    console.log('📋 Initializing caterer orders system...');
    await initializeCatererOrdersDatabase();
    console.log('✅ Caterer orders system initialized successfully!');

    // Initialize customers system
    console.log('👥 Initializing customers system...');
    const customersInitialized = await initializeCustomersDatabase();
    if (!customersInitialized) {
      console.error('❌ Failed to initialize customers system.');
      process.exit(1);
    }
    console.log('✅ Customers system initialized successfully!');



    // Start the server
    app.listen(PORT, () => {
      console.log('\n🎉 ===== SERVER STARTED SUCCESSFULLY =====');
      console.log(`🚀 Backend Server: http://localhost:${PORT}`);
      console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
      console.log(`🔗 API Health Check: http://localhost:${PORT}/api/health`);
      console.log(`👤 Admin Login: http://localhost:${PORT}/api/admin/admin-login`);
      console.log(`🖼️  Caterer Images: http://localhost:${PORT}/images/`);
      console.log(`🧪 Test Caterer Images: http://localhost:${PORT}/api/test-caterer-images`);
      console.log('==========================================\n');


    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
