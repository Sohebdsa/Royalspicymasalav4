const mysql = require('mysql2/promise');


const initializeCatererSalesDatabase = async () => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'spicymasalav2'
    });


    // Create caterer_sales table (main bill/invoice table)
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


    // Create caterer_sale_items table (line items for each bill, including mix products)
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


    // Create caterer_sale_payments table (payment records for each bill)
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


    // Create caterer_sale_other_charges table (additional charges)
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


    // Migrate existing table if it exists (change product_id from INT to VARCHAR)
    try {
      await connection.execute(`
        ALTER TABLE caterer_sale_items 
        MODIFY COLUMN product_id VARCHAR(100) NULL
      `);
      console.log('✅ Migrated product_id column to VARCHAR');
    } catch (error) {
      if (error.code !== 'ER_BAD_FIELD_ERROR') {
        console.log('ℹ️  product_id column migration skipped:', error.message);
      }
    }

    // Add new columns for mix product support
    const mixColumns = [
      { name: 'is_mix', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'mix_id', type: 'INT NULL' },
      { name: 'parent_sale_item_id', type: 'INT NULL' },
      { name: 'mix_item_data', type: 'JSON NULL' }
    ];

    for (const column of mixColumns) {
      try {
        await connection.execute(`
          ALTER TABLE caterer_sale_items 
          ADD COLUMN ${column.name} ${column.type}
        `);
        console.log(`✅ Added column: ${column.name}`);
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`ℹ️  Column ${column.name} already exists, skipping...`);
        } else {
          console.log(`⚠️  Error adding column ${column.name}:`, error.message);
        }
      }
    }

    // Add foreign key constraint for parent_sale_item_id if not exists
    try {
      await connection.execute(`
        ALTER TABLE caterer_sale_items
        ADD CONSTRAINT fk_parent_sale_item
        FOREIGN KEY (parent_sale_item_id) REFERENCES caterer_sale_items(id) ON DELETE CASCADE
      `);
      console.log('✅ Added foreign key constraint for parent_sale_item_id');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME' || error.code === 'ER_FK_DUP_NAME') {
        console.log('ℹ️  Foreign key constraint already exists, skipping...');
      } else {
        console.log('⚠️  Error adding foreign key constraint:', error.message);
      }
    }

    // Add indexes for mix product columns
    const mixIndexes = [
      { name: 'idx_mix_id', column: 'mix_id' },
      { name: 'idx_parent_sale_item_id', column: 'parent_sale_item_id' },
      { name: 'idx_is_mix', column: 'is_mix' }
    ];

    for (const index of mixIndexes) {
      try {
        await connection.execute(`
          CREATE INDEX ${index.name} ON caterer_sale_items(${index.column})
        `);
        console.log(`✅ Created index: ${index.name}`);
      } catch (error) {
        if (error.code === 'ER_DUP_KEYNAME') {
          console.log(`ℹ️  Index ${index.name} already exists, skipping...`);
        } else {
          console.log(`⚠️  Error creating index ${index.name}:`, error.message);
        }
      }
    }


    // Drop existing triggers if they exist
    await connection.query('DROP TRIGGER IF EXISTS after_caterer_sale_insert');
    await connection.query('DROP TRIGGER IF EXISTS after_payment_insert');


    // Create trigger to update caterer balance after sale
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


    // Create trigger to update payment status after payment
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


    console.log('✅ Caterer sales database tables initialized successfully');
    console.log('✅ Mix product support columns and indexes added');
    await connection.end();
    return true;
  } catch (error) {
    console.error('❌ Error initializing caterer sales database:', error);
    throw error;
  }
};


module.exports = {
  initializeCatererSalesDatabase
};
