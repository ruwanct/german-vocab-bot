const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const Database = require('../database/models');
const vocabularyManager = require('./vocabularyManager');

class VocabularyImporter {
  constructor() {
    this.db = new Database();
    this.supportedFormats = ['csv', 'json', 'txt'];
  }

  async initialize() {
    await this.db.connect();
  }

  /**
   * Import vocabulary from CSV file
   * Expected format: "der Saft,juice" or "word,article,translation"
   */
  async importFromCSV(filePath, level, options = {}) {
    const results = [];
    const errors = [];

    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath)
        .pipe(csv({
          headers: options.headers || ['word_with_article', 'translation'],
          separator: options.separator || ',',
          skipEmptyLines: true
        }));

      stream.on('data', (row) => {
        try {
          const processed = this.processCSVRow(row, level, options);
          if (processed) {
            results.push(processed);
          }
        } catch (error) {
          errors.push({
            row: row,
            error: error.message
          });
        }
      });

      stream.on('end', () => {
        resolve({
          imported: results,
          errors: errors,
          count: results.length
        });
      });

      stream.on('error', (error) => {
        reject(error);
      });
    });
  }

  processCSVRow(row, level, options) {
    let word, article, translation;

    if (options.format === 'goethe') {
      // Goethe format: "der Saft,juice"
      const wordWithArticle = row.word_with_article?.trim();
      translation = row.translation?.trim();

      if (!wordWithArticle || !translation) {
        return null;
      }

      const parts = wordWithArticle.split(' ');
      if (parts.length >= 2) {
        article = parts[0].toLowerCase();
        word = parts.slice(1).join(' ');
      } else {
        // No article, assume it's a verb or adjective
        word = wordWithArticle;
        article = null;
      }
    } else if (options.format === 'standard') {
      // Standard format: "word,article,translation"
      word = row.word?.trim();
      article = row.article?.trim()?.toLowerCase();
      translation = row.translation?.trim();
    } else {
      // Auto-detect format
      const keys = Object.keys(row);
      if (keys.length === 2) {
        // Assume "word_with_article,translation" format
        return this.processCSVRow(row, level, { ...options, format: 'goethe' });
      } else if (keys.length >= 3) {
        // Assume "word,article,translation" format
        return this.processCSVRow(row, level, { ...options, format: 'standard' });
      }
    }

    if (!word || !translation) {
      return null;
    }

    // Validate article
    if (article && !['der', 'die', 'das'].includes(article)) {
      article = null;
    }

    // Determine word type
    const wordType = this.determineWordType(word, article);

    return {
      word: word,
      article: article,
      translation_en: translation,
      translation_de: article ? `${article} ${word}` : word,
      level: level,
      word_type: wordType,
      source: 'imported',
      category: this.guessCategory(word, translation),
      confidence: 1.0,
      frequency: this.estimateFrequency(word, level)
    };
  }

  determineWordType(word, article) {
    if (article) {
      return 'noun';
    }
    
    // Check if word is capitalized (German nouns are capitalized)
    if (word.charAt(0) === word.charAt(0).toUpperCase()) {
      return 'noun';
    }
    
    // Check for common verb patterns
    const verbEndings = ['en', 'eln', 'ern', 'ieren'];
    for (const ending of verbEndings) {
      if (word.endsWith(ending)) {
        return 'verb';
      }
    }
    
    // Check for common adjective patterns
    const adjEndings = ['ig', 'lich', 'isch', 'bar', 'los', 'voll'];
    for (const ending of adjEndings) {
      if (word.endsWith(ending)) {
        return 'adjective';
      }
    }
    
    return 'unknown';
  }

  guessCategory(word, translation) {
    const categories = {
      'food_drink': ['essen', 'trinken', 'brot', 'wasser', 'milch', 'saft', 'food', 'drink', 'bread', 'water', 'milk', 'juice'],
      'family': ['familie', 'mutter', 'vater', 'kind', 'family', 'mother', 'father', 'child', 'parent', 'son', 'daughter'],
      'housing': ['haus', 'wohnung', 'zimmer', 'küche', 'house', 'apartment', 'room', 'kitchen', 'home'],
      'transportation': ['auto', 'bus', 'zug', 'flugzeug', 'car', 'train', 'plane', 'transport', 'travel'],
      'body': ['körper', 'kopf', 'auge', 'hand', 'body', 'head', 'eye', 'hand', 'foot', 'arm', 'leg'],
      'clothing': ['kleidung', 'hemd', 'hose', 'kleid', 'clothes', 'shirt', 'pants', 'dress', 'shoe'],
      'time': ['zeit', 'tag', 'woche', 'monat', 'jahr', 'time', 'day', 'week', 'month', 'year'],
      'work': ['arbeit', 'beruf', 'büro', 'work', 'job', 'office', 'profession', 'career'],
      'education': ['schule', 'lehrer', 'buch', 'lernen', 'school', 'teacher', 'book', 'learn', 'study'],
      'weather': ['wetter', 'sonne', 'regen', 'schnee', 'weather', 'sun', 'rain', 'snow', 'wind'],
      'colors': ['farbe', 'rot', 'blau', 'grün', 'gelb', 'color', 'red', 'blue', 'green', 'yellow'],
      'animals': ['tier', 'hund', 'katze', 'vogel', 'animal', 'dog', 'cat', 'bird', 'fish']
    };

    const combined = `${word} ${translation}`.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => combined.includes(keyword))) {
        return category;
      }
    }
    
    return 'general';
  }

  estimateFrequency(word, level) {
    // Estimate frequency based on level and word characteristics
    let frequency = 0;
    
    // Base frequency by level
    switch (level) {
      case 'A1': frequency = 8; break;
      case 'A2': frequency = 6; break;
      case 'B1': frequency = 4; break;
      case 'B2': frequency = 2; break;
      default: frequency = 1;
    }
    
    // Adjust for word length (shorter words tend to be more frequent)
    if (word.length <= 4) frequency += 2;
    else if (word.length <= 6) frequency += 1;
    else if (word.length > 10) frequency -= 1;
    
    // Common patterns
    const commonWords = ['der', 'die', 'das', 'sein', 'haben', 'werden', 'können', 'müssen'];
    if (commonWords.includes(word.toLowerCase())) {
      frequency = 10;
    }
    
    return Math.max(1, Math.min(10, frequency));
  }

  async importFromJSON(filePath, level) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const results = [];
      
      let words = data;
      if (data.words) words = data.words;
      if (data.vocabulary) words = data.vocabulary;
      
      for (const item of words) {
        const processed = {
          word: item.word,
          article: item.article,
          translation_en: item.translation_en || item.translation,
          translation_de: item.translation_de || (item.article ? `${item.article} ${item.word}` : item.word),
          level: level,
          word_type: item.word_type || this.determineWordType(item.word, item.article),
          source: 'imported',
          category: item.category || this.guessCategory(item.word, item.translation_en || item.translation),
          confidence: item.confidence || 1.0,
          frequency: item.frequency || this.estimateFrequency(item.word, level)
        };
        
        results.push(processed);
      }
      
      return {
        imported: results,
        errors: [],
        count: results.length
      };
    } catch (error) {
      throw new Error(`Error importing JSON: ${error.message}`);
    }
  }

  async importToDatabase(vocabularyData) {
    const results = {
      imported: 0,
      updated: 0,
      errors: []
    };

    for (const item of vocabularyData) {
      try {
        // Check if word already exists
        const existing = await this.getExistingWord(item.word);
        
        if (existing) {
          // Update existing word if imported version has higher confidence
          if ((item.confidence || 1.0) >= (existing.confidence || 1.0)) {
            await this.updateVocabularyItem(existing.id, item);
            results.updated++;
          }
        } else {
          // Insert new word
          await this.insertVocabularyItem(item);
          results.imported++;
        }
      } catch (error) {
        results.errors.push({
          word: item.word,
          error: error.message
        });
      }
    }

    return results;
  }

  async insertVocabularyItem(item) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.db.prepare(`
        INSERT INTO vocabulary (
          word, article, translation_en, translation_de, level, 
          category, source, confidence, frequency, word_type, last_updated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      
      stmt.run(
        item.word || '',
        item.article || null,
        item.translation_en || '',
        item.translation_de || '',
        item.level || 'A1',
        item.category || 'general',
        item.source || 'imported',
        item.confidence || 1.0,
        item.frequency || 1,
        item.word_type || 'unknown',
        function(err) {
          if (err) {
            console.error('Insert error:', err.message);
            console.error('Item:', item);
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
      stmt.finalize();
    });
  }

  async updateVocabularyItem(id, item) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.db.prepare(`
        UPDATE vocabulary SET
          article = ?, translation_en = ?, translation_de = ?, level = ?,
          category = ?, source = ?, confidence = ?, frequency = ?, 
          word_type = ?, last_updated = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      
      stmt.run(
        item.article,
        item.translation_en,
        item.translation_de,
        item.level,
        item.category,
        item.source,
        item.confidence,
        item.frequency,
        item.word_type,
        id,
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
      stmt.finalize();
    });
  }

  async importFromGoetheFormat(filePath, level) {
    console.log(`Importing Goethe format vocabulary for level ${level}...`);
    
    const importResult = await this.importFromCSV(filePath, level, {
      format: 'goethe',
      headers: ['word_with_article', 'translation']
    });
    
    if (importResult.imported.length > 0) {
      const dbResult = await this.importToDatabase(importResult.imported);
      
      console.log(`Import completed: ${dbResult.imported} new, ${dbResult.updated} updated, ${dbResult.errors.length} errors`);
      
      return {
        ...importResult,
        database: dbResult
      };
    }
    
    return importResult;
  }

  async enrichImportedVocabulary(maxWords = 50) {
    console.log('Enriching imported vocabulary with API data...');
    
    // Get imported words that haven't been enriched yet
    const wordsToEnrich = await this.getWordsForEnrichment(maxWords);
    
    const results = {
      enriched: 0,
      errors: []
    };

    for (const word of wordsToEnrich) {
      try {
        await vocabularyManager.initialize();
        const apiResults = await vocabularyManager.searchVocabulary(word.word);
        
        if (apiResults.length > 0) {
          const enriched = {
            ...word,
            pronunciation: apiResults[0].pronunciation || word.pronunciation,
            example_sentence: apiResults[0].example_sentence || word.example_sentence,
            api_data: JSON.stringify(apiResults[0])
          };
          
          await this.updateVocabularyItem(word.id, enriched);
          results.enriched++;
        }
      } catch (error) {
        results.errors.push({
          word: word.word,
          error: error.message
        });
      }
    }

    return results;
  }

  async getExistingWord(word) {
    return new Promise((resolve, reject) => {
      this.db.db.get(`
        SELECT * FROM vocabulary 
        WHERE word = ?
        LIMIT 1
      `, [word], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async getWordsForEnrichment(limit) {
    return new Promise((resolve, reject) => {
      this.db.db.all(`
        SELECT * FROM vocabulary 
        WHERE source = 'imported' 
        AND (pronunciation IS NULL OR pronunciation = '')
        AND (example_sentence IS NULL OR example_sentence = '')
        ORDER BY frequency DESC, level ASC
        LIMIT ?
      `, [limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async getImportStatistics() {
    return new Promise((resolve, reject) => {
      this.db.db.all(`
        SELECT 
          level,
          COUNT(*) as count,
          AVG(confidence) as avg_confidence,
          AVG(frequency) as avg_frequency
        FROM vocabulary 
        WHERE source = 'imported'
        GROUP BY level
        ORDER BY level
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = new VocabularyImporter();