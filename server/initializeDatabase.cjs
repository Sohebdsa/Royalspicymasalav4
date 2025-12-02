const { initializeDatabase } = require('./config/database.cjs');

async function initializeAllDatabases() {
  try {
    console.log('🚀 Starting database initialization...');
    
    // Initialize main database tables
    const result = await initializeDatabase();
    
    if (result) {
      console.log('✅ All databases initialized successfully!');
      console.log('✅ Caterer sales tables created');
      console.log('✅ Inventory batches tables created');
      console.log('✅ Inventory deduction tables created');
      console.log('✅ All triggers and relations established');
    } else {
      console.log('❌ Database initialization failed');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during database initialization:', error.message);
    process.exit(1);
  }
}

// Run the initialization
initializeAllDatabases().catch(console.error);