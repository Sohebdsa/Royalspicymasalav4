const { pool } = require('../config/database.cjs');

const initializeSupplierPurchases = async () => {
  try {
    console.log('🔧 Initializing supplier purchases database...');

    // Create supplier_purchases table
    const createSupplierPurchasesTable = `
      CREATE TABLE IF NOT EXISTS supplier_purchases (
        id INT AUTO_INCREMENT PRIMARY KEY,
        supplier_id INT NOT NULL,
        bill_number VARCHAR(50) NOT NULL UNIQUE,
        purchase_date DATE NOT NULL,
        items JSON NOT NULL,
        other_charges JSON DEFAULT NULL,
        subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        total_gst DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        items_total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        other_charges_total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        grand_total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        payment_option ENUM('full', 'half', 'custom', 'later') NOT NULL DEFAULT 'full',
        payment_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        amount_pending DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        payment_method ENUM('cash', 'upi', 'bank', 'check', 'credit', 'other') NOT NULL DEFAULT 'cash',
        payment_date DATE NOT NULL,
        receipt_image VARCHAR(255),
        status ENUM('completed', 'pending', 'cancelled') NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
        INDEX idx_supplier_id (supplier_id),
        INDEX idx_bill_number (bill_number),
        INDEX idx_purchase_date (purchase_date),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await pool.execute(createSupplierPurchasesTable);
    console.log('✅ Supplier purchases table created/verified successfully');

    // Create payment_records table for tracking multiple payments per bill
    const createPaymentRecordsTable = `
      CREATE TABLE IF NOT EXISTS payment_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        purchase_id INT NOT NULL,
        payment_amount DECIMAL(10, 2) NOT NULL,
        payment_method ENUM('cash', 'upi', 'bank', 'check', 'credit', 'other') NOT NULL DEFAULT 'cash',
        payment_date DATE NOT NULL,
        payment_time TIME NOT NULL DEFAULT (CURRENT_TIME),
        notes TEXT,
        receipt_image VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (purchase_id) REFERENCES supplier_purchases(id) ON DELETE CASCADE,
        INDEX idx_purchase_id (purchase_id),
        INDEX idx_payment_date (payment_date),
        INDEX idx_payment_method (payment_method)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await pool.execute(createPaymentRecordsTable);
    console.log('✅ Payment records table created/verified successfully');

    return true;
  } catch (error) {
    console.error('❌ Error initializing supplier purchases database:', error);
    return false;
  }
};

module.exports = {
  initializeSupplierPurchases
};
