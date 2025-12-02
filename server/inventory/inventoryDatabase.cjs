const mysql = require('mysql2/promise');

// Initialize inventory database
const initializeInventoryDatabase = async () => {
  try {
    console.log('🔄 Initializing inventory database...');

    // Create inventory table
    const createInventoryTable = `
      CREATE TABLE IF NOT EXISTS inventory (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        batch VARCHAR(100) NOT NULL,
        action ENUM('added', 'updated', 'deducted', 'merged') NOT NULL DEFAULT 'added',
        quantity DECIMAL(10, 3) NOT NULL DEFAULT 0.000,
        value DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        cost_per_kg DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        unit ENUM('kg', 'gram', 'pound', 'box', 'pack', 'litre') DEFAULT 'kg',
        status ENUM('active', 'inactive', 'expired', 'merged') NOT NULL DEFAULT 'active',
        notes TEXT,
        reference_type ENUM('purchase', 'manual', 'adjustment', 'transfer') DEFAULT 'manual',
        reference_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        INDEX idx_product_id (product_id),
        INDEX idx_batch (batch),
        INDEX idx_action (action),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at),
        INDEX idx_reference (reference_type, reference_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'spicymasalav2'
    });

    await connection.execute(createInventoryTable);
    console.log('✅ Inventory table created/verified successfully');

    // Create inventory_summary table for current stock levels
    const createInventorySummaryTable = `
      CREATE TABLE IF NOT EXISTS inventory_summary (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        total_quantity DECIMAL(10, 3) NOT NULL DEFAULT 0.000,
        total_value DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        average_cost_per_kg DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        unit ENUM('kg', 'gram', 'pound', 'box', 'pack', 'litre') DEFAULT 'kg',
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        UNIQUE KEY unique_product (product_id),
        INDEX idx_product_id (product_id),
        INDEX idx_total_quantity (total_quantity)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await connection.execute(createInventorySummaryTable);
    console.log('✅ Inventory summary table created/verified successfully');

    // Create inventory_history table for transaction logs
    const createInventoryHistoryTable = `
      CREATE TABLE IF NOT EXISTS inventory_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        batch VARCHAR(100) NOT NULL,
        action ENUM('added', 'deducted', 'adjusted', 'merged') NOT NULL,
        quantity DECIMAL(10, 3) NOT NULL,
        value DECIMAL(10, 2) NOT NULL,
        cost_per_kg DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        unit ENUM('kg', 'gram', 'pound', 'box', 'pack', 'litre') DEFAULT 'kg',
        notes TEXT,
        reference_type ENUM('purchase', 'sale', 'caterer_sale', 'manual', 'adjustment', 'transfer') DEFAULT 'manual',
        reference_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        INDEX idx_product_id (product_id),
        INDEX idx_batch (batch),
        INDEX idx_action (action),
        INDEX idx_reference (reference_type, reference_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await connection.execute(createInventoryHistoryTable);
    console.log('✅ Inventory history table created/verified successfully');

    // Add cost_per_kg column to existing inventory table if it doesn't exist
    try {
      await connection.execute(`
        ALTER TABLE inventory
        ADD COLUMN cost_per_kg DECIMAL(10, 2) NOT NULL DEFAULT 0.00
        AFTER value
      `);
      console.log('✅ Added cost_per_kg column to inventory table');
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ cost_per_kg column already exists in inventory table');
      }
    }

    // Add average_cost_per_kg column to existing inventory_summary table if it doesn't exist
    try {
      await connection.execute(`
        ALTER TABLE inventory_summary
        ADD COLUMN average_cost_per_kg DECIMAL(10, 2) NOT NULL DEFAULT 0.00
        AFTER total_value
      `);
      console.log('✅ Added average_cost_per_kg column to inventory_summary table');
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ average_cost_per_kg column already exists in inventory_summary table');
      }
    }

    // Update status ENUM to include 'merged' if it doesn't exist
    try {
      await connection.execute(`
        ALTER TABLE inventory
        MODIFY COLUMN status ENUM('active', 'inactive', 'expired', 'merged') NOT NULL DEFAULT 'active'
      `);
      console.log('✅ Updated status ENUM to include merged value');
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ Status ENUM already includes merged value or update failed:', error.message);
      }
    }

    // Create triggers to automatically update inventory_summary
    const createUpdateTrigger = `
      CREATE TRIGGER IF NOT EXISTS update_inventory_summary
      AFTER INSERT ON inventory
      FOR EACH ROW
      BEGIN
        INSERT INTO inventory_summary (product_id, product_name, total_quantity, total_value, average_cost_per_kg, unit)
        VALUES (NEW.product_id, NEW.product_name, NEW.quantity, NEW.value,
                CASE WHEN NEW.quantity > 0 THEN NEW.value / NEW.quantity ELSE 0 END, NEW.unit)
        ON DUPLICATE KEY UPDATE
          total_quantity = CASE
            WHEN NEW.action = 'added' OR NEW.action = 'updated' THEN total_quantity + NEW.quantity
            WHEN NEW.action = 'deducted' THEN total_quantity - NEW.quantity
            ELSE total_quantity
          END,
          total_value = CASE
            WHEN NEW.action = 'added' OR NEW.action = 'updated' THEN total_value + NEW.value
            WHEN NEW.action = 'deducted' THEN total_value - NEW.value
            ELSE total_value
          END,
          average_cost_per_kg = CASE
            WHEN (total_quantity + NEW.quantity) > 0 THEN (total_value + NEW.value) / (total_quantity + NEW.quantity)
            ELSE 0
          END,
          product_name = NEW.product_name,
          unit = NEW.unit,
          last_updated = CURRENT_TIMESTAMP;
      END;
    `;

    // Create trigger for UPDATE operations
    const createUpdateTriggerForUpdates = `
      CREATE TRIGGER IF NOT EXISTS update_inventory_summary_on_update
      AFTER UPDATE ON inventory
      FOR EACH ROW
      BEGIN
        IF NEW.quantity <> OLD.quantity THEN
          INSERT INTO inventory_summary (product_id, product_name, total_quantity, total_value, average_cost_per_kg, unit)
          SELECT
            i.product_id,
            i.product_name,
            SUM(CASE
              WHEN i.action = 'added' OR i.action = 'updated' OR i.action = 'merged' THEN i.quantity
              WHEN i.action = 'deducted' THEN -i.quantity
              ELSE 0
            END) as total_quantity,
            SUM(CASE
              WHEN i.action = 'added' OR i.action = 'updated' OR i.action = 'merged' THEN i.value
              WHEN i.action = 'deducted' THEN -i.value
              ELSE 0
            END) as total_value,
            CASE
              WHEN SUM(CASE
                WHEN i.action = 'added' OR i.action = 'updated' OR i.action = 'merged' THEN i.quantity
                WHEN i.action = 'deducted' THEN -i.quantity
                ELSE 0
              END) > 0 THEN
                SUM(CASE
                  WHEN i.action = 'added' OR i.action = 'updated' OR i.action = 'merged' THEN i.value
                  WHEN i.action = 'deducted' THEN -i.value
                  ELSE 0
                END) / SUM(CASE
                  WHEN i.action = 'added' OR i.action = 'updated' OR i.action = 'merged' THEN i.quantity
                  WHEN i.action = 'deducted' THEN -i.quantity
                  ELSE 0
                END)
              ELSE 0
            END as average_cost_per_kg,
            i.unit
          FROM inventory i
          WHERE i.product_id = NEW.product_id AND i.status != 'merged'
          GROUP BY i.product_id, i.product_name, i.unit
          ON DUPLICATE KEY UPDATE
            total_quantity = VALUES(total_quantity),
            total_value = VALUES(total_value),
            average_cost_per_kg = VALUES(average_cost_per_kg),
            product_name = VALUES(product_name),
            unit = VALUES(unit),
            last_updated = CURRENT_TIMESTAMP;
        END IF;
      END;
    `;

    try {
      await connection.execute(createUpdateTrigger);
      console.log('✅ Inventory summary trigger created/verified successfully');
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.log('⚠️ Trigger creation note:', error.message);
      }
    }

    await connection.end();
    return true;
  } catch (error) {
    console.error('❌ Error initializing inventory database:', error);
    return false;
  }
};

module.exports = {
  initializeInventoryDatabase
};
