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
    
    let vocabularyCount = 0;
    try {
      const row = db.get('SELECT COUNT(*) as count FROM vocabulary_simple');
      vocabularyCount = row.count;
    } catch (err) {
      // Table might not exist, that's ok
      console.log('📝 vocabulary_simple table not found, will be created during import');
      vocabularyCount = 0;
    }

    await db.close();
    console.log(`📚 Vocabulary words in database: ${vocabularyCount}`);

    if (vocabularyCount === 0) {
      console.log('📥 No vocabulary found. Auto-importing vocabulary...');
      
      // Initialize flashcard database first
      try {
        console.log('🔧 Initializing flashcard database...');
        const FlashcardInitializer = require('./src/database/flashcard-init');
        const flashcardInit = new FlashcardInitializer();
        await flashcardInit.init();
        console.log('✅ Flashcard database initialized');
      } catch (error) {
        console.log('⚠️  Flashcard database already exists or error:', error.message);
      }

      // Auto-import vocabulary from CSV files
      try {
        const SimpleVocabularyImporter = require('./src/scripts/importSimpleVocab');
        const importer = new SimpleVocabularyImporter();
        await importer.initialize();

        const vocabularyFiles = [
          { file: './vocabulary/levels/a1-words.csv', level: 'A1' },
          { file: './vocabulary/levels/a2-words.csv', level: 'A2' },
          { file: './vocabulary/levels/b1-words.csv', level: 'B1' },
          { file: './vocabulary/topics/food-drinks.csv', level: 'A1' },
          { file: './vocabulary/topics/family.csv', level: 'A1' },
          { file: './vocabulary/topics/travel.csv', level: 'A2' }
        ];

        let totalImported = 0;
        let totalUpdated = 0;

        for (const vocab of vocabularyFiles) {
          if (fs.existsSync(vocab.file)) {
            console.log(`📚 Importing ${vocab.file} (${vocab.level})...`);
            const result = await importer.importFromCSV(vocab.file, vocab.level);
            totalImported += result.database.imported;
            totalUpdated += result.database.updated;
            console.log(`✅ Imported ${result.database.imported} new, updated ${result.database.updated}`);
          } else {
            console.log(`⚠️  File not found: ${vocab.file}`);
          }
        }

        console.log(`🎉 Auto-import completed! Total: ${totalImported} new, ${totalUpdated} updated`);
        
        // Show final statistics
        const stats = await importer.getStatistics();
        console.log('📊 Final vocabulary statistics:');
        stats.forEach(stat => {
          console.log(`  - Level ${stat.level}: ${stat.count} words`);
        });
        const total = stats.reduce((sum, stat) => sum + stat.count, 0);
        console.log(`  - Total: ${total} words`);

      } catch (error) {
        console.error('❌ Auto-import failed:', error);
        console.log('📥 You can manually import later using: npm run import-simple');
      }
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