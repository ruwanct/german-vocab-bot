#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const vocabularyImporter = require('../services/vocabularyImporter');

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
📚 German Vocabulary Importer

Usage:
  npm run import-vocab <file> <level> [format]

Examples:
  npm run import-vocab ./data/A1-words.csv A1 goethe
  npm run import-vocab ./data/B1-vocabulary.json B1 json
  npm run import-vocab ./data/vocab.csv A2 standard

Supported formats:
  - goethe: "der Saft,juice" format
  - standard: "word,article,translation" format
  - json: JSON format with vocabulary array
  - auto: Auto-detect format (default)

Supported levels: A1, A2, B1, B2, C1, C2
    `);
    process.exit(1);
  }

  const filePath = args[0];
  const level = args[1];
  const format = args[2] || 'auto';

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  if (!['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(level)) {
    console.error(`❌ Invalid level: ${level}. Must be A1, A2, B1, B2, C1, or C2`);
    process.exit(1);
  }

  console.log(`📥 Importing vocabulary from ${filePath} for level ${level}...`);

  try {
    await vocabularyImporter.initialize();
    
    let result;
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.json') {
      result = await vocabularyImporter.importFromJSON(filePath, level);
    } else if (ext === '.csv' || ext === '.txt') {
      if (format === 'goethe') {
        result = await vocabularyImporter.importFromGoetheFormat(filePath, level);
      } else {
        result = await vocabularyImporter.importFromCSV(filePath, level, {
          format: format === 'auto' ? 'goethe' : format
        });
      }
    } else {
      throw new Error(`Unsupported file format: ${ext}`);
    }

    console.log(`✅ Import completed!`);
    console.log(`📊 Results:`);
    console.log(`  - Processed: ${result.imported?.length || 0} words`);
    console.log(`  - Errors: ${result.errors?.length || 0}`);
    
    if (result.database) {
      console.log(`  - Database: ${result.database.imported} new, ${result.database.updated} updated`);
    }

    if (result.errors && result.errors.length > 0) {
      console.log(`\n❌ Errors:`);
      result.errors.slice(0, 5).forEach(error => {
        console.log(`  - ${error.word || 'Unknown'}: ${error.error}`);
      });
      if (result.errors.length > 5) {
        console.log(`  ... and ${result.errors.length - 5} more errors`);
      }
    }

    // Show import statistics
    const stats = await vocabularyImporter.getImportStatistics();
    console.log(`\n📈 Import Statistics:`);
    stats.forEach(stat => {
      console.log(`  - Level ${stat.level}: ${stat.count} words (avg confidence: ${stat.avg_confidence?.toFixed(2)})`);
    });

    // Skip the interactive part for now
    console.log(`\n✅ Import completed successfully!`);
    console.log(`\nTo enrich vocabulary with AI later, use: /admin → Enrich Vocabulary`);

  } catch (error) {
    console.error(`❌ Import failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}