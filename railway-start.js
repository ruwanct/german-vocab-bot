#!/usr/bin/env node

/**
 * Railway-specific startup script
 * Handles database initialization and migration before starting the bot
 */

const fs = require('fs');
const path = require('path');
const config = require('./config/config');

async function initializeForRailway() {
  console.log('🚂 Railway startup script started...');
  
  try {
    // 1. Ensure data directory exists
    const dataDir = path.dirname(config.database.path);
    if (!fs.existsSync(dataDir)) {
      console.log('📁 Creating data directory:', dataDir);
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // 2. Check if database exists
    const dbExists = fs.existsSync(config.database.path);
    console.log('💾 Database exists:', dbExists);

    if (!dbExists) {
      console.log('🔧 Initializing database...');
      const DatabaseInitializer = require('./src/database/init');
      const initializer = new DatabaseInitializer();
      await initializer.init();
      console.log('✅ Database initialized');
    }

    // 3. Run consent migration (safe to run multiple times)
    console.log('🔄 Running consent migration...');
    const ConsentMigration = require('./src/database/migrate-consent');
    const migration = new ConsentMigration();
    await migration.migrate();
    console.log('✅ Consent migration completed');

    // 4. Check if vocabulary exists, if not, import it
    const Database = require('./src/database/models');
    const db = new Database();
    await db.connect();
    
    const vocabularyCount = await new Promise((resolve, reject) => {
      db.db.get('SELECT COUNT(*) as count FROM vocabulary_simple', (err, row) => {
        if (err) {
          // Table might not exist, that's ok
          console.log('📝 vocabulary_simple table not found, will be created during import');
          resolve(0);
        } else {
          resolve(row.count);
        }
      });
    });

    await db.close();
    console.log(`📚 Vocabulary words in database: ${vocabularyCount}`);

    if (vocabularyCount === 0) {
      console.log('📥 Importing vocabulary...');
      const CleanAndInject = require('./src/scripts/cleanAndInjectCSV');
      const importer = new CleanAndInject();
      await importer.initialize();
      const results = await importer.importAllCSVFiles();
      console.log('✅ Vocabulary imported:', results.length, 'levels');
      await importer.close();
    }

    // 5. Start the bot
    console.log('🤖 Starting German Vocab Bot...');
    require('./src/bot.js');

  } catch (error) {
    console.error('❌ Railway startup failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Start the initialization process
initializeForRailway();