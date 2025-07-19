const Database = require('../database/models');
const vocabularyCache = require('./vocabularyCache');
const dictionaryAPIs = require('../api/dictionaries');

class VocabularyManager {
  constructor() {
    this.db = new Database();
    this.cache = vocabularyCache;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    await this.db.connect();
    await this.cache.initialize();
    await this.updateDatabaseSchema();
    
    this.isInitialized = true;
    console.log('VocabularyManager initialized successfully');
  }

  async updateDatabaseSchema() {
    return new Promise((resolve, reject) => {
      this.db.db.serialize(() => {
        // Add new columns for API-sourced vocabulary
        this.db.db.run(`
          ALTER TABLE vocabulary ADD COLUMN source TEXT DEFAULT 'manual'
        `, () => {});
        
        this.db.db.run(`
          ALTER TABLE vocabulary ADD COLUMN api_data TEXT
        `, () => {});
        
        this.db.db.run(`
          ALTER TABLE vocabulary ADD COLUMN confidence REAL DEFAULT 1.0
        `, () => {});
        
        this.db.db.run(`
          ALTER TABLE vocabulary ADD COLUMN frequency INTEGER DEFAULT 0
        `, () => {});
        
        this.db.db.run(`
          ALTER TABLE vocabulary ADD COLUMN last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
        `, () => {});

        // Create index for better performance
        this.db.db.run(`
          CREATE INDEX IF NOT EXISTS idx_vocabulary_source ON vocabulary(source)
        `, () => {});
        
        this.db.db.run(`
          CREATE INDEX IF NOT EXISTS idx_vocabulary_word_lower ON vocabulary(LOWER(word))
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  async searchVocabulary(word, sourceLanguage = 'de', targetLanguage = 'en') {
    // First check if word exists in our database
    const existingWord = await this.getWordFromDatabase(word);
    if (existingWord) {
      return [existingWord];
    }

    // Only use APIs if they're configured and available
    if (this.hasApiKeys()) {
      try {
        // Search using cache (which will use APIs if needed)
        const results = await this.cache.searchWord(word, sourceLanguage, targetLanguage);
        
        // Store the best result in our database for future use
        if (results.length > 0) {
          const bestResult = this.selectBestResult(results);
          await this.saveWordToDatabase(bestResult);
        }

        return results;
      } catch (error) {
        console.log(`API search failed for "${word}": ${error.message}`);
        return [];
      }
    }

    // No APIs available, return empty result
    return [];
  }

  async getWordFromDatabase(word) {
    return new Promise((resolve, reject) => {
      this.db.db.get(`
        SELECT * FROM vocabulary 
        WHERE LOWER(word) = LOWER(?) 
        ORDER BY confidence DESC, frequency DESC
        LIMIT 1
      `, [word], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async saveWordToDatabase(wordData) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.db.prepare(`
        INSERT OR REPLACE INTO vocabulary (
          word, article, translation_en, translation_de, pronunciation, 
          level, category, example_sentence, source, api_data, confidence, frequency, last_updated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      
      stmt.run(
        wordData.word,
        wordData.article,
        wordData.translation_en,
        wordData.translation_de,
        wordData.pronunciation || '',
        wordData.level || 'B1',
        wordData.category || 'general',
        wordData.example_sentence || '',
        wordData.source || 'api',
        JSON.stringify(wordData),
        wordData.confidence || 1.0,
        wordData.frequency || 0,
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
      stmt.finalize();
    });
  }

  selectBestResult(results) {
    if (results.length === 0) return null;
    if (results.length === 1) return results[0];

    // Sort by confidence and frequency (if available)
    const scored = results.map(result => ({
      ...result,
      score: this.calculateResultScore(result)
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored[0];
  }

  calculateResultScore(result) {
    let score = 0;
    
    // Confidence score (if available)
    if (result.confidence) {
      score += result.confidence * 0.4;
    }
    
    // Frequency score (if available)
    if (result.frequency) {
      score += Math.min(result.frequency / 1000, 1) * 0.3;
    }
    
    // Source preference (PONS usually more reliable)
    if (result.source === 'pons') {
      score += 0.2;
    } else if (result.source === 'linguatools') {
      score += 0.1;
    }
    
    // Penalize if missing important fields
    if (!result.article || !['der', 'die', 'das'].includes(result.article)) {
      score -= 0.3;
    }
    
    if (!result.translation_en || result.translation_en.length < 2) {
      score -= 0.2;
    }
    
    if (!result.example_sentence || result.example_sentence.length < 10) {
      score -= 0.1;
    }
    
    return Math.max(0, score);
  }

  async getQuizVocabulary(count = 10, level = null, category = null) {
    // First try to get from database
    const dbWords = await this.getVocabularyFromDatabase(count, level, category);
    
    if (dbWords.length >= count) {
      return dbWords.slice(0, count);
    }

    // If not enough words in database and APIs are available, get from cache
    if (this.hasApiKeys() && dbWords.length < count) {
      try {
        const cachedWords = await this.cache.getRandomCachedWords(count - dbWords.length, level);
        
        // Save cached words to database for future use
        for (const word of cachedWords) {
          await this.saveWordToDatabase(word);
        }
        
        return [...dbWords, ...cachedWords].slice(0, count);
      } catch (error) {
        console.log(`Cache retrieval failed: ${error.message}`);
      }
    }
    
    // Return whatever we have from database
    return dbWords.slice(0, count);
  }

  async getVocabularyFromDatabase(count, level = null, category = null) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM vocabulary';
      const params = [];
      const conditions = [];
      
      if (level) {
        conditions.push('level = ?');
        params.push(level);
      }
      
      if (category) {
        conditions.push('category = ?');
        params.push(category);
      }
      
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      
      query += ' ORDER BY RANDOM() LIMIT ?';
      params.push(count);

      this.db.db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async enrichVocabulary(word) {
    console.log(`Enriching vocabulary for: ${word}`);
    
    try {
      const results = await this.cache.searchWord(word);
      
      if (results.length > 0) {
        const bestResult = this.selectBestResult(results);
        const wordId = await this.saveWordToDatabase(bestResult);
        
        return {
          success: true,
          wordId,
          word: bestResult.word,
          data: bestResult
        };
      }
      
      return {
        success: false,
        word,
        error: 'No results found'
      };
    } catch (error) {
      console.error(`Error enriching vocabulary for ${word}:`, error);
      return {
        success: false,
        word,
        error: error.message
      };
    }
  }

  async batchEnrichVocabulary(words) {
    const results = [];
    const batchSize = 10;
    
    for (let i = 0; i < words.length; i += batchSize) {
      const batch = words.slice(i, i + batchSize);
      
      const batchPromises = batch.map(word => this.enrichVocabulary(word));
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            word: batch[index],
            error: result.reason?.message || 'Unknown error'
          });
        }
      });
      
      // Add delay between batches to respect API limits
      if (i + batchSize < words.length) {
        await this.delay(1000);
      }
    }
    
    return results;
  }

  async getVocabularyStats() {
    return new Promise((resolve, reject) => {
      this.db.db.get(`
        SELECT 
          COUNT(*) as total_words,
          COUNT(CASE WHEN source = 'manual' THEN 1 END) as manual_words,
          COUNT(CASE WHEN source = 'api' THEN 1 END) as api_words,
          COUNT(CASE WHEN source = 'pons' THEN 1 END) as pons_words,
          COUNT(CASE WHEN source = 'linguatools' THEN 1 END) as linguatools_words,
          COUNT(DISTINCT level) as levels,
          COUNT(DISTINCT category) as categories,
          AVG(confidence) as avg_confidence
        FROM vocabulary
      `, async (err, row) => {
        if (err) {
          reject(err);
        } else {
          const cacheStats = await this.cache.getCacheStats();
          resolve({
            database: row,
            cache: cacheStats,
            api_quota: dictionaryAPIs.getQuotaStatus()
          });
        }
      });
    });
  }

  async suggestWordsForEnrichment(count = 10) {
    // Get most frequently requested words that aren't in database
    const popularWords = await this.cache.getPopularWords(count * 2);
    const suggestions = [];
    
    for (const popular of popularWords) {
      const exists = await this.getWordFromDatabase(popular.word);
      if (!exists) {
        suggestions.push({
          word: popular.word,
          access_count: popular.access_count,
          priority: this.calculateEnrichmentPriority(popular)
        });
      }
      
      if (suggestions.length >= count) break;
    }
    
    return suggestions.sort((a, b) => b.priority - a.priority);
  }

  calculateEnrichmentPriority(wordData) {
    let priority = 0;
    
    // High access count = high priority
    priority += Math.min(wordData.access_count / 10, 5);
    
    // Complete data = higher priority
    if (wordData.data.article && ['der', 'die', 'das'].includes(wordData.data.article)) {
      priority += 2;
    }
    
    if (wordData.data.translation_en && wordData.data.translation_en.length > 2) {
      priority += 1;
    }
    
    if (wordData.data.example_sentence && wordData.data.example_sentence.length > 10) {
      priority += 1;
    }
    
    return priority;
  }

  async autoEnrichVocabulary(maxWords = 5) {
    const suggestions = await this.suggestWordsForEnrichment(maxWords);
    
    if (suggestions.length === 0) {
      console.log('No words need enrichment');
      return { enriched: 0, errors: [] };
    }
    
    const words = suggestions.map(s => s.word);
    const results = await this.batchEnrichVocabulary(words);
    
    const successful = results.filter(r => r.success);
    const errors = results.filter(r => !r.success);
    
    console.log(`Auto-enriched ${successful.length} words, ${errors.length} errors`);
    
    return {
      enriched: successful.length,
      errors: errors.map(e => ({ word: e.word, error: e.error }))
    };
  }

  async prefetchCommonWords() {
    return await this.cache.prefetchCommonWords();
  }

  async cleanupOldCache() {
    return await this.cache.cleanupExpiredCache();
  }

  hasApiKeys() {
    const config = require('../../config/config');
    return !!(config.apis?.pons?.apiKey || config.apis?.linguatools?.apiKey);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async shutdown() {
    if (this.hasApiKeys()) {
      await this.cache.shutdown();
    }
    await this.db.close();
  }
}

module.exports = new VocabularyManager();