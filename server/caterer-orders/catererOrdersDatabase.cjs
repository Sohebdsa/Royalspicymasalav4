const mysql = require('mysql2/promise');

const initializeCatererOrdersDatabase = async () => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'spicymasalav2'
    });

    // Create caterer_orders table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS caterer_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_number VARCHAR(50) NOT NULL UNIQUE,
        caterer_name VARCHAR(255) NOT NULL,
        contact_person VARCHAR(255) NOT NULL,
        caterer_phone VARCHAR(20) NOT NULL,
        caterer_email VARCHAR(255) NULL,
        caterer_address TEXT NOT NULL,
        gst_number VARCHAR(50) NULL,
        notes TEXT NULL,
        subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        status ENUM('pending', 'confirmed', 'processing', 'ready', 'delivered', 'cancelled') DEFAULT 'pending',
        order_source ENUM('caterer_online', 'phone', 'walk_in') DEFAULT 'caterer_online',
        payment_status ENUM('pending', 'paid', 'partial', 'refunded') DEFAULT 'pending',
        payment_method ENUM('cash', 'upi', 'card', 'bank_transfer', 'credit', 'cheque') NULL,
        payment_amount DECIMAL(12,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        confirmed_at TIMESTAMP NULL,
        delivered_at TIMESTAMP NULL,
        cancelled_at TIMESTAMP NULL,
        confirmed_by VARCHAR(255) NULL,
        
        INDEX idx_order_number (order_number),
        INDEX idx_caterer_phone (caterer_phone),
        INDEX idx_caterer_name (caterer_name),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at),
        INDEX idx_order_source (order_source)
      )
    `);

    // Create caterer_order_items table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS caterer_order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        caterer_order_id INT NOT NULL,
        product_id INT NULL,
        product_name VARCHAR(255) NOT NULL,
        quantity DECIMAL(10,3) NOT NULL,
        unit VARCHAR(20) NOT NULL DEFAULT 'kg',
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(12,2) NOT NULL,
        source ENUM('manual', 'mix-calculator', 'custom') DEFAULT 'manual',
        mix_number INT NULL,
        is_custom BOOLEAN DEFAULT FALSE,
        custom_details JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (caterer_order_id) REFERENCES caterer_orders(id) ON DELETE CASCADE,
        INDEX idx_caterer_order_id (caterer_order_id),
        INDEX idx_product_id (product_id),
        INDEX idx_source (source),
        INDEX idx_mix_number (mix_number)
      )
    `);

    // Create caterers table for storing caterer information
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS caterers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        caterer_name VARCHAR(255) NOT NULL,
        contact_person VARCHAR(255) NOT NULL,
        phone VARCHAR(20) NOT NULL UNIQUE,
        email VARCHAR(255) NULL,
        address TEXT NOT NULL,
        gst_number VARCHAR(50) NULL,
        balance_due DECIMAL(12,2) DEFAULT 0.00,
        total_orders INT DEFAULT 0,
        total_amount DECIMAL(12,2) DEFAULT 0.00,
        last_order_date TIMESTAMP NULL,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_phone (phone),
        INDEX idx_caterer_name (caterer_name),
        INDEX idx_status (status)
      )
    `);

    // Create caterer_bills table for tracking bills and payments
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS caterer_bills (
        id INT AUTO_INCREMENT PRIMARY KEY,
        caterer_id INT NOT NULL,
        caterer_order_id INT NOT NULL,
        bill_number VARCHAR(50) NOT NULL UNIQUE,
        bill_date DATE NOT NULL,
        due_date DATE NULL,
        subtotal DECIMAL(12,2) NOT NULL,
        tax_amount DECIMAL(12,2) DEFAULT 0.00,
        total_amount DECIMAL(12,2) NOT NULL,
        paid_amount DECIMAL(12,2) DEFAULT 0.00,
        pending_amount DECIMAL(12,2) NOT NULL,
        status ENUM('pending', 'partial', 'paid', 'overdue') DEFAULT 'pending',
        payment_receipts JSON NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (caterer_id) REFERENCES caterers(id) ON DELETE CASCADE,
        FOREIGN KEY (caterer_order_id) REFERENCES caterer_orders(id) ON DELETE CASCADE,
        INDEX idx_bill_number (bill_number),
        INDEX idx_caterer_id (caterer_id),
        INDEX idx_caterer_order_id (caterer_order_id),
        INDEX idx_status (status),
        INDEX idx_bill_date (bill_date),
        INDEX idx_due_date (due_date)
      )
    `);

    // Create caterer_payments table for tracking payments
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS caterer_payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        caterer_id INT NOT NULL,
        bill_id INT NULL,
        payment_date DATE NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        payment_method ENUM('cash', 'upi', 'card', 'bank_transfer', 'cheque') NOT NULL,
        reference_number VARCHAR(100) NULL,
        receipt_image VARCHAR(500) NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (caterer_id) REFERENCES caterers(id) ON DELETE CASCADE,
        FOREIGN KEY (bill_id) REFERENCES caterer_bills(id) ON DELETE SET NULL,
        INDEX idx_caterer_id (caterer_id),
        INDEX idx_bill_id (bill_id),
        INDEX idx_payment_date (payment_date),
        INDEX idx_payment_method (payment_method)
      )
    `);

    console.log('Caterer orders database tables initialized successfully');
    await connection.end();
  } catch (error) {
    console.error('Error initializing caterer orders database:', error);
    throw error;
  }
};

module.exports = {
  initializeCatererOrdersDatabase
};
