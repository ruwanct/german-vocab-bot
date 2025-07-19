const axios = require('axios');
const config = require('../../config/config');

class DictionaryAPIs {
  constructor() {
    this.ponsApiKey = config.apis.pons.apiKey;
    this.linguatoolsApiKey = config.apis.linguatools.apiKey;
    this.ponsBaseUrl = 'https://api.pons.com/v1';
    this.linguatoolsBaseUrl = 'https://api.linguatools.org/v1';
    
    this.quotaManager = {
      pons: {
        used: 0,
        limit: 1000,
        resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
      },
      linguatools: {
        used: 0,
        limit: 1000,
        resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
      }
    };
  }

  async searchPONS(word, sourceLanguage = 'de', targetLanguage = 'en') {
    if (!this.ponsApiKey) {
      throw new Error('PONS API key not configured');
    }

    if (!this.hasQuotaAvailable('pons')) {
      throw new Error('PONS API quota exceeded');
    }

    try {
      const response = await axios.get(`${this.ponsBaseUrl}/dictionary`, {
        params: {
          q: word,
          l: `${sourceLanguage}${targetLanguage}`,
          in: sourceLanguage,
          format: 'json'
        },
        headers: {
          'X-Secret': this.ponsApiKey
        },
        timeout: 10000
      });

      this.incrementQuotaUsage('pons');
      return this.parsePONSResponse(response.data, word);
    } catch (error) {
      console.error('PONS API error:', error.message);
      throw error;
    }
  }

  async searchLinguatools(word, sourceLanguage = 'de', targetLanguage = 'en') {
    if (!this.linguatoolsApiKey) {
      throw new Error('Linguatools API key not configured');
    }

    if (!this.hasQuotaAvailable('linguatools')) {
      throw new Error('Linguatools API quota exceeded');
    }

    try {
      const response = await axios.get(`${this.linguatoolsBaseUrl}/translate`, {
        params: {
          q: word,
          src: sourceLanguage,
          dst: targetLanguage,
          format: 'json'
        },
        headers: {
          'Authorization': `Bearer ${this.linguatoolsApiKey}`
        },
        timeout: 10000
      });

      this.incrementQuotaUsage('linguatools');
      return this.parseLinguatoolsResponse(response.data, word);
    } catch (error) {
      console.error('Linguatools API error:', error.message);
      throw error;
    }
  }

  parsePONSResponse(data, searchWord) {
    const results = [];
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      return results;
    }

    data.forEach(entry => {
      if (entry.hits && Array.isArray(entry.hits)) {
        entry.hits.forEach(hit => {
          if (hit.roms && Array.isArray(hit.roms)) {
            hit.roms.forEach(rom => {
              if (rom.arabs && Array.isArray(rom.arabs)) {
                rom.arabs.forEach(arab => {
                  const translations = this.extractPONSTranslations(arab);
                  const wordData = this.extractPONSWordData(arab, searchWord);
                  
                  if (wordData && translations.length > 0) {
                    results.push({
                      word: wordData.word,
                      article: wordData.article,
                      translation_en: translations[0].translation,
                      translation_de: `${wordData.article} ${wordData.word}`,
                      pronunciation: wordData.pronunciation,
                      level: this.guessLevel(wordData.word),
                      category: this.guessCategory(wordData.word, translations[0].translation),
                      example_sentence: wordData.example || `${wordData.article} ${wordData.word} ist wichtig.`,
                      source: 'pons',
                      all_translations: translations,
                      grammar_info: wordData.grammar
                    });
                  }
                });
              }
            });
          }
        });
      }
    });

    return results;
  }

  parseLinguatoolsResponse(data, searchWord) {
    const results = [];
    
    if (!data || !data.translations || !Array.isArray(data.translations)) {
      return results;
    }

    data.translations.forEach(translation => {
      const wordData = this.extractLinguatoolsWordData(translation, searchWord);
      
      if (wordData) {
        results.push({
          word: wordData.word,
          article: wordData.article,
          translation_en: wordData.translation,
          translation_de: `${wordData.article} ${wordData.word}`,
          pronunciation: wordData.pronunciation,
          level: this.guessLevel(wordData.word),
          category: this.guessCategory(wordData.word, wordData.translation),
          example_sentence: wordData.example || `${wordData.article} ${wordData.word} ist wichtig.`,
          source: 'linguatools',
          confidence: translation.confidence || 0,
          frequency: translation.frequency || 0
        });
      }
    });

    return results;
  }

  extractPONSTranslations(arab) {
    const translations = [];
    
    if (arab.translations && Array.isArray(arab.translations)) {
      arab.translations.forEach(trans => {
        if (trans.target) {
          translations.push({
            translation: this.cleanText(trans.target),
            source: this.cleanText(trans.source || ''),
            context: trans.context || ''
          });
        }
      });
    }

    return translations;
  }

  extractPONSWordData(arab, searchWord) {
    const header = arab.header || '';
    const cleanHeader = this.cleanText(header);
    
    const article = this.extractArticle(cleanHeader);
    const word = this.extractWord(cleanHeader, searchWord);
    const pronunciation = this.extractPronunciation(cleanHeader);
    const grammar = this.extractGrammar(cleanHeader);
    const example = this.extractExample(arab);

    if (!word) return null;

    return {
      word,
      article: article || 'das',
      pronunciation,
      grammar,
      example
    };
  }

  extractLinguatoolsWordData(translation, searchWord) {
    const sourceText = translation.source || searchWord;
    const targetText = translation.target || '';
    
    const article = this.extractArticle(sourceText);
    const word = this.extractWord(sourceText, searchWord);
    const pronunciation = translation.pronunciation || '';
    const example = translation.example || '';

    if (!word || !targetText) return null;

    return {
      word,
      article: article || 'das',
      translation: this.cleanText(targetText),
      pronunciation,
      example
    };
  }

  extractArticle(text) {
    const articleMatch = text.match(/\b(der|die|das)\b/i);
    return articleMatch ? articleMatch[1].toLowerCase() : null;
  }

  extractWord(text, searchWord) {
    const cleanText = this.cleanText(text);
    const words = cleanText.split(/\s+/);
    
    for (const word of words) {
      if (word.toLowerCase().includes(searchWord.toLowerCase()) && 
          !['der', 'die', 'das'].includes(word.toLowerCase())) {
        return word;
      }
    }
    
    return searchWord;
  }

  extractPronunciation(text) {
    const phoneticMatch = text.match(/\[([^\]]+)\]/);
    return phoneticMatch ? phoneticMatch[1] : '';
  }

  extractGrammar(text) {
    const grammarMatch = text.match(/\{([^}]+)\}/);
    return grammarMatch ? grammarMatch[1] : '';
  }

  extractExample(arab) {
    if (arab.examples && Array.isArray(arab.examples) && arab.examples.length > 0) {
      return this.cleanText(arab.examples[0].source || '');
    }
    return '';
  }

  cleanText(text) {
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  guessLevel(word) {
    // More comprehensive level classification
    const levelData = {
      A1: [
        'der', 'die', 'das', 'und', 'oder', 'aber', 'ist', 'sind', 'haben', 'sein',
        'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'mit', 'von', 'zu', 'in', 'auf',
        'haus', 'auto', 'buch', 'wasser', 'brot', 'zeit', 'tag', 'jahr', 'mann', 'frau',
        'machen', 'gehen', 'kommen', 'sehen', 'hören', 'sagen', 'essen', 'trinken'
      ],
      A2: [
        'wohnung', 'familie', 'freund', 'arbeit', 'schule', 'urlaub', 'wetter', 'gesund',
        'problem', 'leben', 'sprechen', 'verstehen', 'kaufen', 'verkaufen', 'fahren',
        'arbeiten', 'lernen', 'studieren', 'wohnen', 'besuchen', 'helfen', 'fragen'
      ],
      B1: [
        'gesellschaft', 'politik', 'wirtschaft', 'umwelt', 'kultur', 'bildung', 'erfahrung',
        'entwicklung', 'möglichkeit', 'entscheiden', 'diskutieren', 'organisieren', 'planen'
      ]
    };
    
    const lowerWord = word.toLowerCase();
    
    // Check exact matches first
    if (levelData.A1.includes(lowerWord)) return 'A1';
    if (levelData.A2.includes(lowerWord)) return 'A2';
    if (levelData.B1.includes(lowerWord)) return 'B1';
    
    // Length-based classification with adjustments
    const length = word.length;
    
    // Very short words are usually basic
    if (length <= 3) return 'A1';
    if (length <= 5) return 'A2';
    
    // Check for complex German features
    const hasUmlaut = /[äöü]/.test(word);
    const hasEszett = /ß/.test(word);
    const isCompound = /[A-Z][a-z]+[A-Z]/.test(word); // compound words
    const hasComplexEnding = /(ung|heit|keit|schaft|tion|ismus)$/i.test(word);
    
    let complexityScore = 0;
    if (hasUmlaut) complexityScore += 1;
    if (hasEszett) complexityScore += 1;
    if (isCompound) complexityScore += 2;
    if (hasComplexEnding) complexityScore += 2;
    
    // Determine level based on length and complexity
    if (length <= 6 && complexityScore === 0) return 'A1';
    if (length <= 8 && complexityScore <= 1) return 'A2';
    if (length <= 10 && complexityScore <= 2) return 'B1';
    if (length <= 12 && complexityScore <= 3) return 'B2';
    
    // Default for very long or complex words
    return 'C1';
  }

  guessCategory(germanWord, englishTranslation) {
    const categories = {
      'animals': ['tier', 'hund', 'katze', 'pferd', 'vogel', 'fisch', 'animal', 'dog', 'cat', 'horse', 'bird', 'fish'],
      'food_drink': ['essen', 'trinken', 'brot', 'wasser', 'milch', 'food', 'drink', 'bread', 'water', 'milk'],
      'transportation': ['auto', 'zug', 'bus', 'flugzeug', 'car', 'train', 'plane', 'transport'],
      'housing': ['haus', 'wohnung', 'zimmer', 'fenster', 'tür', 'house', 'apartment', 'room', 'window', 'door'],
      'family': ['familie', 'mutter', 'vater', 'kind', 'family', 'mother', 'father', 'child'],
      'work': ['arbeit', 'beruf', 'büro', 'work', 'job', 'office', 'profession'],
      'education': ['schule', 'universität', 'buch', 'lernen', 'school', 'university', 'book', 'learn'],
      'technology': ['computer', 'telefon', 'internet', 'handy', 'phone', 'mobile'],
      'clothing': ['kleid', 'hose', 'hemd', 'schuh', 'clothes', 'dress', 'pants', 'shirt', 'shoe'],
      'time': ['zeit', 'tag', 'nacht', 'woche', 'monat', 'jahr', 'time', 'day', 'night', 'week', 'month', 'year']
    };

    const combined = `${germanWord} ${englishTranslation}`.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => combined.includes(keyword))) {
        return category;
      }
    }
    
    return 'general';
  }

  hasQuotaAvailable(api) {
    const quota = this.quotaManager[api];
    const now = new Date();
    
    if (now >= quota.resetDate) {
      quota.used = 0;
      quota.resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }
    
    return quota.used < quota.limit;
  }

  incrementQuotaUsage(api) {
    this.quotaManager[api].used++;
  }

  getQuotaStatus() {
    return {
      pons: {
        used: this.quotaManager.pons.used,
        limit: this.quotaManager.pons.limit,
        remaining: this.quotaManager.pons.limit - this.quotaManager.pons.used,
        resetDate: this.quotaManager.pons.resetDate
      },
      linguatools: {
        used: this.quotaManager.linguatools.used,
        limit: this.quotaManager.linguatools.limit,
        remaining: this.quotaManager.linguatools.limit - this.quotaManager.linguatools.used,
        resetDate: this.quotaManager.linguatools.resetDate
      }
    };
  }

  async searchWithFallback(word, sourceLanguage = 'de', targetLanguage = 'en') {
    const results = [];
    
    try {
      if (this.hasQuotaAvailable('pons')) {
        const ponsResults = await this.searchPONS(word, sourceLanguage, targetLanguage);
        results.push(...ponsResults);
      }
    } catch (error) {
      console.log('PONS search failed, trying Linguatools:', error.message);
    }

    try {
      if (this.hasQuotaAvailable('linguatools') && results.length === 0) {
        const linguatoolsResults = await this.searchLinguatools(word, sourceLanguage, targetLanguage);
        results.push(...linguatoolsResults);
      }
    } catch (error) {
      console.log('Linguatools search failed:', error.message);
    }

    return results;
  }

  async batchSearch(words, sourceLanguage = 'de', targetLanguage = 'en') {
    const results = [];
    const errors = [];
    
    for (const word of words) {
      try {
        const wordResults = await this.searchWithFallback(word, sourceLanguage, targetLanguage);
        results.push(...wordResults);
        
        await this.delay(100);
      } catch (error) {
        errors.push({ word, error: error.message });
        console.error(`Error searching for word "${word}":`, error.message);
      }
    }

    return { results, errors };
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async validateConnection() {
    const status = {
      pons: { connected: false, error: null },
      linguatools: { connected: false, error: null }
    };

    try {
      await this.searchPONS('test');
      status.pons.connected = true;
    } catch (error) {
      status.pons.error = error.message;
    }

    try {
      await this.searchLinguatools('test');
      status.linguatools.connected = true;
    } catch (error) {
      status.linguatools.error = error.message;
    }

    return status;
  }
}

module.exports = new DictionaryAPIs();