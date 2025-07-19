const Database = require('../database/models');

class VocabularyCache {
  constructor() {
    this.db = new Database();
    this.memoryCache = new Map();
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
    this.maxMemoryCache = 500; // Maximum entries in memory
  }

  async initialize() {
    await this.db.connect();
    await this.createCacheTable();
    await this.loadFrequentWordsToMemory();
  }

  async createCacheTable() {
    return new Promise((resolve, reject) => {
      this.db.db.run(`
        CREATE TABLE IF NOT EXISTS vocabulary_cache (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          word TEXT NOT NULL,
          language_pair TEXT NOT NULL,
          api_response TEXT NOT NULL,
          parsed_data TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          access_count INTEGER DEFAULT 1,
          UNIQUE(word, language_pair)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async searchWord(word, sourceLanguage = 'de', targetLanguage = 'en') {
    const languagePair = `${sourceLanguage}-${targetLanguage}`;
    const cacheKey = `${word}_${languagePair}`;
    
    // Check memory cache first
    if (this.memoryCache.has(cacheKey)) {
      const cached = this.memoryCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheExpiry) {
        console.log(`Memory cache hit for: ${word}`);
        return cached.data;
      } else {
        this.memoryCache.delete(cacheKey);
      }
    }

    // Check database cache
    const dbCached = await this.getFromDbCache(word, languagePair);
    if (dbCached) {
      console.log(`Database cache hit for: ${word}`);
      await this.updateCacheAccess(word, languagePair);
      this.addToMemoryCache(cacheKey, dbCached);
      return dbCached;
    }

    // Dictionary APIs have been removed - return empty results
    console.log(`No external dictionary APIs configured for: ${word}`);
    return [];
  }

  async getFromDbCache(word, languagePair) {
    return new Promise((resolve, reject) => {
      this.db.db.get(`
        SELECT parsed_data, created_at 
        FROM vocabulary_cache 
        WHERE word = ? AND language_pair = ?
      `, [word, languagePair], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          const createdAt = new Date(row.created_at);
          const isExpired = Date.now() - createdAt.getTime() > this.cacheExpiry;
          
          if (isExpired) {
            this.removeFromDbCache(word, languagePair);
            resolve(null);
          } else {
            resolve(JSON.parse(row.parsed_data));
          }
        } else {
          resolve(null);
        }
      });
    });
  }

  async saveToDbCache(word, languagePair, data) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.db.prepare(`
        INSERT OR REPLACE INTO vocabulary_cache 
        (word, language_pair, api_response, parsed_data, created_at, accessed_at, access_count)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)
      `);
      
      stmt.run(
        word, 
        languagePair, 
        JSON.stringify(data), 
        JSON.stringify(data),
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
      stmt.finalize();
    });
  }

  async updateCacheAccess(word, languagePair) {
    return new Promise((resolve, reject) => {
      this.db.db.run(`
        UPDATE vocabulary_cache 
        SET accessed_at = CURRENT_TIMESTAMP, access_count = access_count + 1
        WHERE word = ? AND language_pair = ?
      `, [word, languagePair], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async removeFromDbCache(word, languagePair) {
    return new Promise((resolve, reject) => {
      this.db.db.run(`
        DELETE FROM vocabulary_cache 
        WHERE word = ? AND language_pair = ?
      `, [word, languagePair], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  addToMemoryCache(key, data) {
    // Remove oldest entries if cache is full
    if (this.memoryCache.size >= this.maxMemoryCache) {
      const oldestKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(oldestKey);
    }

    this.memoryCache.set(key, {
      data: data,
      timestamp: Date.now()
    });
  }

  async loadFrequentWordsToMemory() {
    return new Promise((resolve, reject) => {
      this.db.db.all(`
        SELECT word, language_pair, parsed_data, access_count
        FROM vocabulary_cache
        ORDER BY access_count DESC
        LIMIT 100
      `, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          rows.forEach(row => {
            const cacheKey = `${row.word}_${row.language_pair}`;
            this.addToMemoryCache(cacheKey, JSON.parse(row.parsed_data));
          });
          console.log(`Loaded ${rows.length} frequent words to memory cache`);
          resolve();
        }
      });
    });
  }

  async batchSearchAndCache(words, sourceLanguage = 'de', targetLanguage = 'en') {
    const results = [];
    const uncachedWords = [];

    // First pass: check cache for all words
    for (const word of words) {
      const cached = await this.searchWord(word, sourceLanguage, targetLanguage);
      if (cached && cached.length > 0) {
        results.push(...cached);
      } else {
        uncachedWords.push(word);
      }
    }

    // Dictionary APIs have been removed - uncached words return no results
    if (uncachedWords.length > 0) {
      console.log(`Dictionary APIs removed: ${uncachedWords.length} words not found in cache`);
    }

    return results;
  }

  async getRandomCachedWords(count = 10, level = null) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT parsed_data 
        FROM vocabulary_cache 
        WHERE language_pair = 'de-en'
      `;
      
      const params = [];
      
      if (level) {
        query += ` AND json_extract(parsed_data, '$[0].level') = ?`;
        params.push(level);
      }
      
      query += ` ORDER BY RANDOM() LIMIT ?`;
      params.push(count);

      this.db.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const words = [];
          rows.forEach(row => {
            const parsed = JSON.parse(row.parsed_data);
            if (Array.isArray(parsed)) {
              words.push(...parsed);
            }
          });
          resolve(words);
        }
      });
    });
  }

  async getCacheStats() {
    return new Promise((resolve, reject) => {
      this.db.db.get(`
        SELECT 
          COUNT(*) as total_cached,
          SUM(access_count) as total_accesses,
          AVG(access_count) as avg_accesses,
          MAX(access_count) as max_accesses
        FROM vocabulary_cache
      `, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            ...row,
            memory_cache_size: this.memoryCache.size,
            memory_cache_max: this.maxMemoryCache
          });
        }
      });
    });
  }

  async cleanupExpiredCache() {
    const expiredDate = new Date(Date.now() - this.cacheExpiry);
    
    return new Promise((resolve, reject) => {
      this.db.db.run(`
        DELETE FROM vocabulary_cache 
        WHERE created_at < ?
      `, [expiredDate.toISOString()], function(err) {
        if (err) {
          reject(err);
        } else {
          console.log(`Cleaned up ${this.changes} expired cache entries`);
          resolve(this.changes);
        }
      });
    });
  }

  async getPopularWords(limit = 50) {
    return new Promise((resolve, reject) => {
      this.db.db.all(`
        SELECT word, access_count, parsed_data
        FROM vocabulary_cache
        ORDER BY access_count DESC
        LIMIT ?
      `, [limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const popularWords = rows.map(row => {
            const parsed = JSON.parse(row.parsed_data);
            return {
              word: row.word,
              access_count: row.access_count,
              data: Array.isArray(parsed) ? parsed[0] : parsed
            };
          });
          resolve(popularWords);
        }
      });
    });
  }

  async prefetchCommonWords() {
    const commonGermanWords = [
      'Haus', 'Auto', 'Buch', 'Wasser', 'Brot', 'Zeit', 'Geld', 'Arbeit',
      'Familie', 'Freund', 'Schule', 'Lehrer', 'Computer', 'Telefon',
      'Restaurant', 'Hotel', 'Musik', 'Film', 'Wetter', 'Sonne'
    ];

    console.log('Prefetching common German words...');
    const results = await this.batchSearchAndCache(commonGermanWords);
    console.log(`Prefetched ${results.length} vocabulary entries`);
    return results;
  }

  clearMemoryCache() {
    this.memoryCache.clear();
    console.log('Memory cache cleared');
  }

  async shutdown() {
    this.clearMemoryCache();
    await this.db.close();
  }
}

module.exports = new VocabularyCache();