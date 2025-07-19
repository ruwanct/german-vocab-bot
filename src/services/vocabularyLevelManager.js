const fs = require('fs');
const path = require('path');
const vocabularyManager = require('./vocabularyManager');

class VocabularyLevelManager {
  constructor() {
    this.levelData = null;
    this.levelWordsPath = path.resolve('./data/german-levels.json');
    this.commonWordsFrequency = null;
    this.loadLevelData();
  }

  loadLevelData() {
    try {
      // Use simplified level data since we're using database now
      console.log('Using database-based vocabulary system');
      this.levelData = { 
        A1: { nouns: [], verbs: [], mixed: [] }, 
        A2: { nouns: [], verbs: [], mixed: [] }, 
        B1: { nouns: [], verbs: [], mixed: [] } 
      };
    } catch (error) {
      console.error('Error loading level data:', error);
      this.levelData = { A1: { nouns: [], verbs: [] }, A2: { nouns: [], verbs: [] }, B1: { nouns: [], verbs: [] } };
    }
  }

  async getVocabularyForLevel(level, count = 10, wordType = 'mixed') {
    if (!this.levelData[level]) {
      throw new Error(`Level ${level} not supported`);
    }

    const levelWords = this.levelData[level];
    let targetWords = [];

    // Select words based on type
    switch (wordType) {
      case 'nouns':
        targetWords = levelWords.nouns || [];
        break;
      case 'verbs':
        targetWords = levelWords.verbs || [];
        break;
      case 'mixed':
      default:
        targetWords = [...(levelWords.nouns || []), ...(levelWords.verbs || [])];
        break;
    }

    // Shuffle and select random words
    const shuffled = this.shuffleArray(targetWords);
    const selectedWords = shuffled.slice(0, Math.min(count * 2, shuffled.length)); // Get more than needed

    // Fetch vocabulary data for selected words
    const vocabularyResults = [];
    
    for (const word of selectedWords) {
      try {
        await vocabularyManager.initialize();
        const results = await vocabularyManager.searchVocabulary(word);
        
        if (results.length > 0) {
          const enrichedResult = {
            ...results[0],
            level: level,
            word_type: this.classifyWordType(word, level),
            frequency_score: this.calculateFrequencyScore(word),
            difficulty_score: this.calculateDifficultyScore(word, level)
          };
          
          vocabularyResults.push(enrichedResult);
          
          if (vocabularyResults.length >= count) {
            break;
          }
        }
      } catch (error) {
        console.error(`Error fetching vocabulary for ${word}:`, error);
      }
    }

    return vocabularyResults;
  }

  async enrichVocabularyWithLevels(maxWordsPerLevel = 20) {
    const results = {
      A1: { processed: 0, errors: [] },
      A2: { processed: 0, errors: [] },
      B1: { processed: 0, errors: [] }
    };

    for (const level of ['A1', 'A2', 'B1']) {
      console.log(`Enriching vocabulary for level ${level}...`);
      
      try {
        const vocabularyResults = await this.getVocabularyForLevel(level, maxWordsPerLevel);
        results[level].processed = vocabularyResults.length;
        console.log(`Successfully enriched ${vocabularyResults.length} words for level ${level}`);
      } catch (error) {
        console.error(`Error enriching level ${level}:`, error);
        results[level].errors.push(error.message);
      }
    }

    return results;
  }

  classifyWordType(word, level) {
    const levelData = this.levelData[level];
    
    if (levelData.nouns && levelData.nouns.includes(word)) {
      return 'noun';
    } else if (levelData.verbs && levelData.verbs.includes(word)) {
      return 'verb';
    }
    
    // Additional classification based on word characteristics
    if (word.charAt(0) === word.charAt(0).toUpperCase()) {
      return 'noun'; // German nouns are capitalized
    }
    
    return 'unknown';
  }

  calculateFrequencyScore(word) {
    // Simple frequency scoring based on word length and common patterns
    let score = 0;
    
    // Shorter words are generally more frequent
    if (word.length <= 4) score += 3;
    else if (word.length <= 6) score += 2;
    else if (word.length <= 8) score += 1;
    
    // Common German word patterns
    const commonPatterns = [
      /^(der|die|das|ein|eine)$/i,  // articles
      /^(ich|du|er|sie|es|wir|ihr)$/i,  // pronouns
      /^(und|oder|aber|wenn|dass)$/i,  // conjunctions
      /^(haben|sein|werden|können|müssen)$/i,  // auxiliary verbs
      /^(gehen|kommen|machen|sagen|sehen)$/i   // common verbs
    ];
    
    for (const pattern of commonPatterns) {
      if (pattern.test(word)) {
        score += 4;
        break;
      }
    }
    
    return Math.min(score, 10);
  }

  calculateDifficultyScore(word, level) {
    let difficulty = 0;
    
    // Base difficulty by level
    switch (level) {
      case 'A1': difficulty = 1; break;
      case 'A2': difficulty = 2; break;
      case 'B1': difficulty = 3; break;
      case 'B2': difficulty = 4; break;
      case 'C1': difficulty = 5; break;
      case 'C2': difficulty = 6; break;
      default: difficulty = 3;
    }
    
    // Adjust for word complexity
    if (word.length > 12) difficulty += 2;
    else if (word.length > 8) difficulty += 1;
    
    // Complex German features
    if (word.includes('ß')) difficulty += 0.5;
    if (word.includes('ä') || word.includes('ö') || word.includes('ü')) difficulty += 0.5;
    if (word.match(/[A-Z][a-z]+[A-Z]/)) difficulty += 1; // compound words
    
    return Math.min(difficulty, 10);
  }

  async validateWordForLevel(word, targetLevel) {
    const levelHierarchy = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const targetIndex = levelHierarchy.indexOf(targetLevel);
    
    if (targetIndex === -1) return false;
    
    // Check if word exists in target level or lower levels
    for (let i = 0; i <= targetIndex; i++) {
      const level = levelHierarchy[i];
      if (this.levelData[level]) {
        const allWords = [
          ...(this.levelData[level].nouns || []),
          ...(this.levelData[level].verbs || [])
        ];
        
        if (allWords.includes(word)) {
          return true;
        }
      }
    }
    
    return false;
  }

  async getQuizVocabularyByLevel(level, count = 10) {
    // First try to get from curated level-specific vocabulary
    let vocabulary = await this.getVocabularyForLevel(level, count);
    
    // If not enough words, supplement with database vocabulary filtered by level
    if (vocabulary.length < count) {
      await vocabularyManager.initialize();
      const additionalWords = await vocabularyManager.getQuizVocabulary(
        count - vocabulary.length, 
        level
      );
      vocabulary = [...vocabulary, ...additionalWords];
    }
    
    // Filter and validate words for the target level
    const validatedVocabulary = vocabulary.filter(word => 
      this.isAppropriateForLevel(word, level)
    );
    
    return validatedVocabulary.slice(0, count);
  }

  isAppropriateForLevel(wordData, targetLevel) {
    // Check word complexity
    const difficulty = this.calculateDifficultyScore(wordData.word || '', targetLevel);
    const maxDifficulty = targetLevel === 'A1' ? 2 : targetLevel === 'A2' ? 3 : 4;
    
    if (difficulty > maxDifficulty) return false;
    
    // Check word length (very long words are usually not beginner-friendly)
    const word = wordData.word || '';
    if (targetLevel === 'A1' && word.length > 10) return false;
    if (targetLevel === 'A2' && word.length > 15) return false;
    
    // Ensure it has proper German article for nouns
    if (wordData.article && !['der', 'die', 'das'].includes(wordData.article)) {
      return false;
    }
    
    return true;
  }

  getLevelStatistics() {
    const stats = {};
    
    for (const [level, data] of Object.entries(this.levelData)) {
      stats[level] = {
        total_words: (data.nouns?.length || 0) + (data.verbs?.length || 0),
        nouns: data.nouns?.length || 0,
        verbs: data.verbs?.length || 0,
        description: data.description || ''
      };
    }
    
    return stats;
  }

  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  async addCustomWordToLevel(word, level, wordType = 'noun') {
    if (!this.levelData[level]) {
      throw new Error(`Level ${level} not supported`);
    }
    
    const targetArray = wordType === 'noun' ? 'nouns' : 'verbs';
    
    if (!this.levelData[level][targetArray]) {
      this.levelData[level][targetArray] = [];
    }
    
    if (!this.levelData[level][targetArray].includes(word)) {
      this.levelData[level][targetArray].push(word);
      await this.saveLevelData();
      return true;
    }
    
    return false;
  }

  async saveLevelData() {
    try {
      const data = JSON.stringify(this.levelData, null, 2);
      fs.writeFileSync(this.levelWordsPath, data, 'utf8');
      console.log('Saved level data successfully');
    } catch (error) {
      console.error('Error saving level data:', error);
      throw error;
    }
  }
}

module.exports = new VocabularyLevelManager();