const mysql = require('mysql2/promise');
require('dotenv').config();
const { initializeDatabase: initializeCaterersDatabase } = require('../caterers/caterer_Db_init/catererDatabase.cjs');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'spicymasalav2',
  port: process.env.DB_PORT || 3306
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test database connection
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully!');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

// Initialize database tables
const initializeDatabase = async () => {
  try {
    const connection = await pool.getConnection();

    // Create admin_users table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        safety_password VARCHAR(255) DEFAULT 'admin123',
        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        role ENUM('super_admin', 'admin', 'manager') DEFAULT 'admin',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_login TIMESTAMP NULL
      )
    `);

    // Add safety_password column if it doesn't exist (for existing databases)
    try {
      await connection.execute(`
        ALTER TABLE admin_users
        ADD COLUMN safety_password VARCHAR(255) DEFAULT 'admin123'
      `);
    } catch (error) {
      // Column might already exist, ignore the error
      if (!error.message.includes('Duplicate column name')) {
        console.log('Note: safety_password column may already exist');
      }
    }

    connection.release();
    // Initialize caterers table after suppliers
    await initializeCaterersDatabase();
    console.log('✅ Database tables initialized successfully!');
    return true;
  } catch (error) {
    console.error('❌ Error initializing database tables:', error.message);
    return false;
  }
};

module.exports = {
  pool,
  testConnection,
  initializeDatabase
};
