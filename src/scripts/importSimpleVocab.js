#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const Database = require('../database/models');

/**
 * Simple Vocabulary Importer for Flashcard System
 * 
 * Imports vocabulary in simple format: German word + English translation
 * No articles, no word types - LLM will analyze these in real-time
 */

class SimpleVocabularyImporter {
  constructor() {
    this.db = new Database();
  }

  async initialize() {
    await this.db.connect();
    
    // Create simple vocabulary table if it doesn't exist
    await this.ensureSimpleTable();
  }

  async ensureSimpleTable() {
    try {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS vocabulary_simple (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          german_word TEXT NOT NULL UNIQUE,
          english_translation TEXT NOT NULL,
          level TEXT DEFAULT 'A1',
          added_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          difficulty_score REAL DEFAULT 1.0
        )
      `);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Import from CSV file
   * Supports formats:
   * - "german_word,english_translation"
   * - "word_with_article,translation" (will strip articles)
   */
  async importFromCSV(filePath, level = 'A1') {
    const vocabulary = [];
    const errors = [];

    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath)
        .pipe(csv({
          headers: ['german', 'english'],
          skipEmptyLines: true
        }));

      stream.on('data', (row) => {
        try {
          const processed = this.processRow(row, level);
          if (processed) {
            vocabulary.push(processed);
          }
        } catch (error) {
          errors.push({
            row: row,
            error: error.message
          });
        }
      });

      stream.on('end', async () => {
        try {
          const dbResult = await this.importToDatabase(vocabulary);
          resolve({
            vocabulary,
            errors,
            database: dbResult,
            count: vocabulary.length
          });
        } catch (error) {
          reject(error);
        }
      });

      stream.on('error', (error) => {
        reject(error);
      });
    });
  }

  processRow(row, level) {
    let germanWord = row.german?.trim();
    let englishTranslation = row.english?.trim();

    if (!germanWord || !englishTranslation) {
      return null;
    }

    // Strip articles from German word if present
    germanWord = this.stripArticle(germanWord);

    // Clean up translations
    englishTranslation = this.cleanTranslation(englishTranslation);

    return {
      german_word: germanWord,
      english_translation: englishTranslation,
      level: level
    };
  }

  stripArticle(germanText) {
    // Remove articles at the beginning
    const withoutArticle = germanText.replace(/^(der|die|das)\s+/i, '');
    return withoutArticle.trim();
  }

  cleanTranslation(translation) {
    return translation
      .toLowerCase()
      .replace(/[^\w\s,;()-]/g, '') // Keep basic punctuation
      .trim();
  }

  async importToDatabase(vocabulary) {
    const results = {
      imported: 0,
      updated: 0,
      errors: []
    };

    for (const item of vocabulary) {
      try {
        const existing = await this.getExistingWord(item.german_word);
        
        if (existing) {
          // Update if needed
          await this.updateVocabularyItem(existing.id, item);
          results.updated++;
        } else {
          // Insert new word
          await this.insertVocabularyItem(item);
          results.imported++;
        }
      } catch (error) {
        results.errors.push({
          word: item.german_word,
          error: error.message
        });
      }
    }

    return results;
  }

  async getExistingWord(germanWord) {
    try {
      return this.db.get(`
        SELECT * FROM vocabulary_simple 
        WHERE german_word = ?
        LIMIT 1
      `, [germanWord]);
    } catch (error) {
      throw error;
    }
  }

  async insertVocabularyItem(item) {
    try {
      const result = this.db.run(`
        INSERT INTO vocabulary_simple (
          german_word, english_translation, level, added_date
        ) VALUES (?, ?, ?, datetime('now'))
      `, [
        item.german_word,
        item.english_translation,
        item.level
      ]);
      return result.lastInsertRowid;
    } catch (error) {
      console.error('Insert error:', error.message);
      throw error;
    }
  }

  async updateVocabularyItem(id, item) {
    try {
      const result = this.db.run(`
        UPDATE vocabulary_simple SET
          english_translation = ?, level = ?
        WHERE id = ?
      `, [
        item.english_translation,
        item.level,
        id
      ]);
      return result.changes;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Convert existing complex vocabulary to simple format
   */
  async convertExistingVocabulary() {
    console.log('Converting existing vocabulary to simple format...');

    try {
      const rows = this.db.all(`
        SELECT word, article, translation_en, level
        FROM vocabulary
        WHERE word IS NOT NULL AND translation_en IS NOT NULL
      `);

      const converted = [];
      const errors = [];

      for (const row of rows) {
        try {
          const germanWord = this.stripArticle(row.article ? `${row.article} ${row.word}` : row.word);
          const englishTranslation = this.cleanTranslation(row.translation_en);

          if (germanWord && englishTranslation) {
            converted.push({
              german_word: germanWord,
              english_translation: englishTranslation,
              level: row.level || 'A1'
            });
          }
        } catch (error) {
          errors.push({
            word: row.word,
            error: error.message
          });
        }
      }

      const dbResult = await this.importToDatabase(converted);
      console.log(`✅ Converted ${dbResult.imported} words, updated ${dbResult.updated}`);
      
      return {
        converted: converted.length,
        imported: dbResult.imported,
        updated: dbResult.updated,
        errors: errors.length
      };
    } catch (error) {
      throw error;
    }
  }

  async getStatistics() {
    try {
      return this.db.all(`
        SELECT 
          level,
          COUNT(*) as count
        FROM vocabulary_simple
        GROUP BY level
        ORDER BY level
      `);
    } catch (error) {
      throw error;
    }
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
📚 Simple Vocabulary Importer for Flashcard System

Usage:
  node src/scripts/importSimpleVocab.js <action> [options]

Actions:
  import <csv-file> [level]     Import from CSV file
  convert                       Convert existing vocabulary
  stats                         Show statistics

Examples:
  node src/scripts/importSimpleVocab.js import ./words.csv A1
  node src/scripts/importSimpleVocab.js convert
  node src/scripts/importSimpleVocab.js stats

CSV Format:
  german_word,english_translation
  Saft,juice
  trinken,to drink
  schön,beautiful

The system will:
  1. Strip articles from German words
  2. Clean English translations
  3. Store simple word pairs
  4. LLM will analyze them during quiz
    `);
    process.exit(1);
  }

  const action = args[0];
  const importer = new SimpleVocabularyImporter();
  
  try {
    await importer.initialize();
    
    switch (action) {
      case 'import':
        const csvFile = args[1];
        const level = args[2] || 'A1';
        
        if (!csvFile || !fs.existsSync(csvFile)) {
          console.error('❌ CSV file not found');
          process.exit(1);
        }
        
        console.log(`📥 Importing from ${csvFile} for level ${level}...`);
        const result = await importer.importFromCSV(csvFile, level);
        
        console.log(`✅ Import completed!`);
        console.log(`📊 Results:`);
        console.log(`  - Processed: ${result.count} words`);
        console.log(`  - Database: ${result.database.imported} new, ${result.database.updated} updated`);
        console.log(`  - Errors: ${result.errors.length}`);
        break;
        
      case 'convert':
        console.log('🔄 Converting existing vocabulary...');
        const convertResult = await importer.convertExistingVocabulary();
        console.log(`✅ Conversion completed!`);
        console.log(`📊 Results:`);
        console.log(`  - Converted: ${convertResult.converted} words`);
        console.log(`  - Imported: ${convertResult.imported} new`);
        console.log(`  - Updated: ${convertResult.updated} existing`);
        console.log(`  - Errors: ${convertResult.errors}`);
        break;
        
      case 'stats':
        const stats = await importer.getStatistics();
        console.log(`📊 Vocabulary Statistics:`);
        stats.forEach(stat => {
          console.log(`  - Level ${stat.level}: ${stat.count} words`);
        });
        const total = stats.reduce((sum, stat) => sum + stat.count, 0);
        console.log(`  - Total: ${total} words`);
        break;
        
      default:
        console.error(`❌ Unknown action: ${action}`);
        process.exit(1);
    }
    
  } catch (error) {
    console.error(`❌ Failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = SimpleVocabularyImporter;