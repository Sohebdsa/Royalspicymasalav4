const { pool } = require('../config/database.cjs');

// Initialize products-related database tables
const initializeProductsDatabase = async () => {
  try {
    const connection = await pool.getConnection();

    // Create categories table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        sub_category VARCHAR(100) NULL,
        description TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_name (name),
        INDEX idx_sub_category (sub_category)
      )
    `);

    // Create products table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        category_id INT NOT NULL,
        sub_category VARCHAR(100) NULL,
        unit ENUM('kg', 'gram', 'pound', 'box', 'pack', 'litre', 'bottle', 'cane', 'packet', 'pouch') DEFAULT 'kg',
        market_price DECIMAL(10,2) NULL DEFAULT NULL,
        retail_price DECIMAL(10,2) NULL DEFAULT NULL,
        caterer_price DECIMAL(10,2) NULL DEFAULT NULL,
        description TEXT NULL,
        product_images JSON NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_name (name),
        INDEX idx_category (category_id),
        INDEX idx_active (is_active)
      )
    `);

    // Add foreign key constraint separately (if it doesn't exist)
    try {
      await connection.execute(`
        ALTER TABLE products
        ADD CONSTRAINT fk_products_category
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
      `);
    } catch (error) {
      // Foreign key constraint might already exist, ignore the error
      if (!error.message.includes('Duplicate key name')) {
        console.log('Note: Foreign key constraint may already exist or categories table not ready yet');
      }
    }



    // Insert default categories if they don't exist
    const defaultCategories = [
      { name: 'dryfruits', sub_category: '', description: 'Dry fruits and nuts' },
      { name: 'spices', sub_category: 'masalas', description: 'Various spices and masalas' },
      { name: 'grains', sub_category: '', description: 'Rice, wheat and other grains' },
      { name: 'pulses', sub_category: '', description: 'Lentils and legumes' }
    ];

    for (const category of defaultCategories) {
      // Check if category already exists
      const [existing] = await connection.execute(
        'SELECT id FROM categories WHERE name = ?',
        [category.name]
      );

      if (existing.length === 0) {
        await connection.execute(`
          INSERT INTO categories (name, sub_category, description)
          VALUES (?, ?, ?)
        `, [
          category.name,
          category.sub_category || null,
          category.description
        ]);
      }
    }

    // Sample products insertion removed - products will be created through the UI

    connection.release();
    console.log('✅ Products database tables initialized successfully!');
    return true;
  } catch (error) {
    console.error('❌ Error initializing products database tables:', error.message);
    return false;
  }
};

module.exports = {
  initializeProductsDatabase
};
