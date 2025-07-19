#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Database = require('../database/models');
const SimpleVocabularyImporter = require('./importSimpleVocab');

/**
 * Clean Database and Inject CSV Data
 * 
 * This script will:
 * 1. Clear existing vocabulary data
 * 2. Import fresh data from CSV files
 * 3. Suitable for Railway deployment
 */

class DatabaseCleanAndInject {
  constructor() {
    this.db = new Database();
    this.importer = new SimpleVocabularyImporter();
  }

  async initialize() {
    await this.db.connect();
    await this.importer.initialize();
  }

  async cleanDatabase() {
    console.log('🧹 Cleaning existing vocabulary data...');
    
    return new Promise((resolve, reject) => {
      // Clean vocabulary_simple table
      this.db.db.run('DELETE FROM vocabulary_simple', (err) => {
        if (err) {
          console.error('Error cleaning vocabulary_simple:', err);
          reject(err);
          return;
        }
        
        // Also clean the main vocabulary table if it exists
        this.db.db.run('DELETE FROM vocabulary', (err2) => {
          if (err2) {
            console.log('Note: vocabulary table might not exist (OK for simple vocab setup)');
          }
          
          // Reset auto-increment counters
          this.db.db.run('DELETE FROM sqlite_sequence WHERE name="vocabulary_simple"', (err3) => {
            if (err3) {
              console.log('Note: Could not reset sequence (table might be empty)');
            }
            
            console.log('✅ Database cleaned successfully');
            resolve();
          });
        });
      });
    });
  }

  async importCSVFile(filePath, level) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`CSV file not found: ${filePath}`);
    }

    console.log(`📥 Importing ${filePath} for level ${level}...`);
    const result = await this.importer.importFromCSV(filePath, level);
    
    console.log(`✅ Import completed for ${level}!`);
    console.log(`  - Processed: ${result.count} words`);
    console.log(`  - Imported: ${result.database.imported} new`);
    console.log(`  - Updated: ${result.database.updated} existing`);
    console.log(`  - Errors: ${result.errors.length}`);
    
    if (result.errors.length > 0) {
      console.log('❌ Errors encountered:');
      result.errors.forEach(error => {
        console.log(`  - ${error.row}: ${error.error}`);
      });
    }
    
    return result;
  }

  async importAllCSVFiles() {
    const csvFiles = [
      {
        path: path.join(process.cwd(), 'vocabulary/levels/a1-words.csv'),
        level: 'A1'
      },
      {
        path: path.join(process.cwd(), 'vocabulary/levels/a2-words.csv'),
        level: 'A2'
      }
    ];

    const results = [];
    
    for (const csvFile of csvFiles) {
      try {
        const result = await this.importCSVFile(csvFile.path, csvFile.level);
        results.push({
          level: csvFile.level,
          success: true,
          result
        });
      } catch (error) {
        console.error(`❌ Failed to import ${csvFile.level}: ${error.message}`);
        results.push({
          level: csvFile.level,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }

  async getStatistics() {
    const stats = await this.importer.getStatistics();
    console.log('📊 Final Database Statistics:');
    
    let total = 0;
    stats.forEach(stat => {
      console.log(`  - Level ${stat.level}: ${stat.count} words`);
      total += stat.count;
    });
    console.log(`  - Total: ${total} words`);
    
    return stats;
  }

  async close() {
    await this.db.close();
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  const action = args[0] || 'full';

  const cleaner = new DatabaseCleanAndInject();
  
  try {
    await cleaner.initialize();
    
    switch (action) {
      case 'clean':
        await cleaner.cleanDatabase();
        break;
        
      case 'import':
        const results = await cleaner.importAllCSVFiles();
        console.log('\n📋 Import Summary:');
        results.forEach(r => {
          if (r.success) {
            console.log(`✅ ${r.level}: ${r.result.count} words imported`);
          } else {
            console.log(`❌ ${r.level}: ${r.error}`);
          }
        });
        break;
        
      case 'full':
        console.log('🚀 Starting full database refresh...\n');
        
        // Step 1: Clean
        await cleaner.cleanDatabase();
        console.log('');
        
        // Step 2: Import
        const importResults = await cleaner.importAllCSVFiles();
        console.log('\n📋 Import Summary:');
        importResults.forEach(r => {
          if (r.success) {
            console.log(`✅ ${r.level}: ${r.result.count} words imported`);
          } else {
            console.log(`❌ ${r.level}: ${r.error}`);
          }
        });
        console.log('');
        
        // Step 3: Statistics
        await cleaner.getStatistics();
        
        console.log('\n🎉 Database refresh completed successfully!');
        break;
        
      case 'stats':
        await cleaner.getStatistics();
        break;
        
      default:
        console.error(`❌ Unknown action: ${action}`);
        process.exit(1);
    }
    
  } catch (error) {
    console.error(`❌ Failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await cleaner.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = DatabaseCleanAndInject;