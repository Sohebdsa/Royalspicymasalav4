const mysql = require('mysql2/promise');

const initializeDatabase = async () => {
  try {
    console.log('🔧 Initializing caterers and caterer sales database...');

    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'spicymasalav2'
    });

    // --- Create caterers table ---
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS caterers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        caterer_name VARCHAR(255) NOT NULL,
        contact_person VARCHAR(255) NOT NULL,
        phone_number VARCHAR(20) NOT NULL,
        email VARCHAR(255) UNIQUE,
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        pincode VARCHAR(20),
        gst_number VARCHAR(50) UNIQUE,
        card_image VARCHAR(500),
        description TEXT,
        balance_due DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        total_orders INT DEFAULT 0,
        total_amount DECIMAL(12,2) DEFAULT 0.00,
        last_order_date DATE NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_caterer_name (caterer_name),
        INDEX idx_contact_person (contact_person),
        INDEX idx_phone_number (phone_number),
        INDEX idx_email (email),
        INDEX idx_is_active (is_active),
        INDEX idx_created_at (created_at),
        INDEX idx_last_order_date (last_order_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Caterers table created/verified successfully');

    // --- Create caterer_sales table ---
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS caterer_sales (
        id INT AUTO_INCREMENT PRIMARY KEY,
        caterer_id INT NOT NULL,
        bill_number VARCHAR(50) NOT NULL UNIQUE,
        sell_date DATE NOT NULL,
        subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        total_gst DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        items_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        other_charges_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        grand_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        payment_status ENUM('pending', 'partial', 'paid') DEFAULT 'pending',
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (caterer_id) REFERENCES caterers(id) ON DELETE RESTRICT,
        INDEX idx_caterer_id (caterer_id),
        INDEX idx_bill_number (bill_number),
        INDEX idx_sell_date (sell_date),
        INDEX idx_payment_status (payment_status),
        INDEX idx_created_at (created_at)
      )
    `);

    // --- Create caterer_sale_items table ---
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS caterer_sale_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sale_id INT NOT NULL,
        product_id VARCHAR(100) NULL,
        product_name VARCHAR(255) NOT NULL,
        quantity DECIMAL(10,3) NOT NULL,
        unit VARCHAR(50) NOT NULL DEFAULT 'kg',
        rate DECIMAL(10,2) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        gst_percentage DECIMAL(5,2) DEFAULT 0.00,
        gst_amount DECIMAL(10,2) DEFAULT 0.00,
        total_amount DECIMAL(12,2) NOT NULL,
        batch_number VARCHAR(100) NULL,
        expiry_date DATE NULL,
        is_mix BOOLEAN DEFAULT FALSE,
        mix_id INT NULL,
        parent_sale_item_id INT NULL,
        mix_item_data JSON NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sale_id) REFERENCES caterer_sales(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_sale_item_id) REFERENCES caterer_sale_items(id) ON DELETE CASCADE,
        INDEX idx_sale_id (sale_id),
        INDEX idx_product_id (product_id),
        INDEX idx_product_name (product_name),
        INDEX idx_mix_id (mix_id),
        INDEX idx_parent_sale_item_id (parent_sale_item_id),
        INDEX idx_is_mix (is_mix)
      )
    `);

    // --- Create caterer_sale_payments table ---
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS caterer_sale_payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sale_id INT NOT NULL,
        payment_date DATE NOT NULL,
        payment_method ENUM('cash', 'upi', 'card', 'bank_transfer', 'cheque', 'credit') NOT NULL,
        payment_option VARCHAR(20) NOT NULL DEFAULT 'full',
        payment_amount DECIMAL(12,2) NOT NULL,
        reference_number VARCHAR(100) NULL,
        transaction_id VARCHAR(100) NULL,
        bank_name VARCHAR(100) NULL,
        cheque_number VARCHAR(50) NULL,
        notes TEXT NULL,
        receipt_image VARCHAR(500) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(100) NULL,
        FOREIGN KEY (sale_id) REFERENCES caterer_sales(id) ON DELETE CASCADE,
        INDEX idx_sale_id (sale_id),
        INDEX idx_payment_date (payment_date),
        INDEX idx_payment_method (payment_method)
      )
    `);

    // --- Create caterer_sale_other_charges table ---
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS caterer_sale_other_charges (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sale_id INT NOT NULL,
        charge_name VARCHAR(255) NOT NULL,
        charge_amount DECIMAL(10,2) NOT NULL,
        charge_type ENUM('fixed', 'percentage') DEFAULT 'fixed',
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sale_id) REFERENCES caterer_sales(id) ON DELETE CASCADE,
        INDEX idx_sale_id (sale_id)
      )
    `);

    // --- Drop and recreate triggers ---
    await connection.query('DROP TRIGGER IF EXISTS after_caterer_sale_insert');
    await connection.query('DROP TRIGGER IF EXISTS after_payment_insert');

    await connection.query(`
      CREATE TRIGGER after_caterer_sale_insert
      AFTER INSERT ON caterer_sales
      FOR EACH ROW
      BEGIN
        UPDATE caterers 
        SET 
          total_orders = total_orders + 1,
          total_amount = total_amount + NEW.grand_total,
          last_order_date = NEW.sell_date,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.caterer_id;
      END
    `);

    await connection.query(`
      CREATE TRIGGER after_payment_insert
      AFTER INSERT ON caterer_sale_payments
      FOR EACH ROW
      BEGIN
        DECLARE total_paid DECIMAL(12,2);
        DECLARE grand_total DECIMAL(12,2);
        
        SELECT COALESCE(SUM(payment_amount), 0) INTO total_paid
        FROM caterer_sale_payments
        WHERE sale_id = NEW.sale_id;
        
        SELECT grand_total INTO grand_total
        FROM caterer_sales
        WHERE id = NEW.sale_id;
        
        UPDATE caterer_sales
        SET payment_status = CASE
          WHEN total_paid >= grand_total THEN 'paid'
          WHEN total_paid > 0 THEN 'partial'
          ELSE 'pending'
        END,
        updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.sale_id;
        
        UPDATE caterers
        SET balance_due = (
          SELECT COALESCE(SUM(cs.grand_total), 0) - COALESCE(SUM(p.paid_amount), 0)
          FROM caterer_sales cs
          LEFT JOIN (
            SELECT sale_id, SUM(payment_amount) as paid_amount
            FROM caterer_sale_payments
            GROUP BY sale_id
          ) p ON cs.id = p.sale_id
          WHERE cs.caterer_id = (SELECT caterer_id FROM caterer_sales WHERE id = NEW.sale_id)
        ),
        updated_at = CURRENT_TIMESTAMP
        WHERE id = (SELECT caterer_id FROM caterer_sales WHERE id = NEW.sale_id);
      END
    `);

    console.log('✅ Database initialized successfully with triggers and relations.');
    await connection.end();
  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    throw error;
  }
};

module.exports = { initializeDatabase };
