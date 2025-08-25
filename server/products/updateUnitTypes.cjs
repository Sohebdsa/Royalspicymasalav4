const { pool } = require('../config/database.cjs');

const updateUnitTypes = async () => {
  try {
    const connection = await pool.getConnection();
    
    console.log('Updating unit types in products table...');
    
    // Modify the ENUM column to include new unit types
    await connection.execute(`
      ALTER TABLE products 
      MODIFY COLUMN unit ENUM('kg', 'gram', 'pound', 'box', 'pack', 'litre', 'bottle', 'cane', 'packet', 'pouch', 'bag') DEFAULT 'kg'
     `);
    
    console.log('✅ Unit types updated successfully!');
    
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Error updating unit types:', error.message);
    return false;
  }
};

// Run the update
updateUnitTypes().then(success => {
  if (success) {
    console.log('Database schema update completed successfully!');
    process.exit(0);
  } else {
    console.error('Database schema update failed!');
    process.exit(1);
  }
});
