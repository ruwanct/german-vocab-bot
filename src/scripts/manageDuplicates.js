#!/usr/bin/env node

const Database = require('../database/models');

class DuplicateManager {
  constructor() {
    this.db = new Database();
  }

  async initialize() {
    await this.db.connect();
  }

  /**
   * Find duplicate German words in vocabulary_simple table
   */
  async findDuplicates() {
    return new Promise((resolve, reject) => {
      this.db.db.all(`
        SELECT 
          german_word,
          COUNT(*) as count,
          GROUP_CONCAT(id) as ids,
          GROUP_CONCAT(english_translation, ' | ') as translations,
          GROUP_CONCAT(level, ' | ') as levels
        FROM vocabulary_simple 
        GROUP BY LOWER(german_word)
        HAVING COUNT(*) > 1
        ORDER BY count DESC, german_word
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Get detailed information about duplicates
   */
  async getDuplicateDetails(germanWord) {
    return new Promise((resolve, reject) => {
      this.db.db.all(`
        SELECT id, german_word, english_translation, level, added_date
        FROM vocabulary_simple 
        WHERE LOWER(german_word) = LOWER(?)
        ORDER BY added_date DESC
      `, [germanWord], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Remove duplicates keeping the most recent entry
   */
  async removeDuplicates(keepMostRecent = true) {
    const duplicates = await this.findDuplicates();
    const results = {
      found: duplicates.length,
      removed: 0,
      kept: 0,
      errors: []
    };

    console.log(`🔍 Found ${duplicates.length} duplicate word groups`);

    for (const duplicate of duplicates) {
      try {
        const details = await this.getDuplicateDetails(duplicate.german_word);
        
        // Decide which entries to keep and remove
        let toKeep, toRemove;
        
        if (keepMostRecent) {
          // Keep the most recent entry
          toKeep = details[0];
          toRemove = details.slice(1);
        } else {
          // Keep the first entry
          toKeep = details[details.length - 1];
          toRemove = details.slice(0, -1);
        }

        console.log(`\n📝 Processing: "${duplicate.german_word}"`);
        console.log(`   Keeping: ID ${toKeep.id} - "${toKeep.english_translation}" (${toKeep.level}) - ${toKeep.added_date}`);
        
        // Remove duplicates
        for (const entry of toRemove) {
          await this.removeEntry(entry.id);
          console.log(`   Removed: ID ${entry.id} - "${entry.english_translation}" (${entry.level}) - ${entry.added_date}`);
          results.removed++;
        }
        
        results.kept++;
      } catch (error) {
        results.errors.push({
          word: duplicate.german_word,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Remove a specific entry by ID
   */
  async removeEntry(id) {
    return new Promise((resolve, reject) => {
      this.db.db.run(`
        DELETE FROM vocabulary_simple WHERE id = ?
      `, [id], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  /**
   * Show duplicate report without removing
   */
  async showDuplicateReport() {
    const duplicates = await this.findDuplicates();
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicates found! Your vocabulary is clean.');
      return { found: 0, total: await this.getTotalWords() };
    }

    console.log(`\n🔍 Duplicate Report:`);
    console.log(`Found ${duplicates.length} duplicate word groups\n`);

    for (const duplicate of duplicates) {
      const details = await this.getDuplicateDetails(duplicate.german_word);
      
      console.log(`📝 Word: "${duplicate.german_word}" (${duplicate.count} entries)`);
      details.forEach((entry, index) => {
        const marker = index === 0 ? '🟢 NEWEST' : '🔴 DUPLICATE';
        console.log(`   ${marker} ID ${entry.id}: "${entry.english_translation}" (${entry.level}) - ${entry.added_date}`);
      });
      console.log('');
    }

    const totalDuplicates = duplicates.reduce((sum, dup) => sum + (dup.count - 1), 0);
    console.log(`📊 Summary:`);
    console.log(`   - Unique words with duplicates: ${duplicates.length}`);
    console.log(`   - Total duplicate entries: ${totalDuplicates}`);
    console.log(`   - Total vocabulary: ${await this.getTotalWords()}`);

    return { found: duplicates.length, totalDuplicates, total: await this.getTotalWords() };
  }

  /**
   * Get total word count
   */
  async getTotalWords() {
    return new Promise((resolve, reject) => {
      this.db.db.get(`
        SELECT COUNT(*) as count FROM vocabulary_simple
      `, (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
  }

  /**
   * Find similar words (fuzzy matching)
   */
  async findSimilarWords() {
    const allWords = await this.getAllWords();
    const similar = [];

    for (let i = 0; i < allWords.length; i++) {
      for (let j = i + 1; j < allWords.length; j++) {
        const word1 = allWords[i];
        const word2 = allWords[j];
        
        // Check for similar words (case-insensitive)
        if (this.areSimilar(word1.german_word, word2.german_word)) {
          similar.push({
            word1: word1,
            word2: word2,
            similarity: this.calculateSimilarity(word1.german_word, word2.german_word)
          });
        }
      }
    }

    return similar.sort((a, b) => b.similarity - a.similarity);
  }

  async getAllWords() {
    return new Promise((resolve, reject) => {
      this.db.db.all(`
        SELECT id, german_word, english_translation, level
        FROM vocabulary_simple 
        ORDER BY german_word
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  areSimilar(word1, word2) {
    const w1 = word1.toLowerCase();
    const w2 = word2.toLowerCase();
    
    // Exact match (case-insensitive) - this would be caught by findDuplicates
    if (w1 === w2) return false;
    
    // Very similar (edit distance of 1-2)
    const distance = this.levenshteinDistance(w1, w2);
    return distance <= 2 && Math.max(w1.length, w2.length) > 3;
  }

  calculateSimilarity(word1, word2) {
    const distance = this.levenshteinDistance(word1.toLowerCase(), word2.toLowerCase());
    const maxLength = Math.max(word1.length, word2.length);
    return 1 - (distance / maxLength);
  }

  levenshteinDistance(str1, str2) {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i += 1) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j += 1) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j += 1) {
      for (let i = 1; i <= str1.length; i += 1) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator, // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Export duplicates to CSV for manual review
   */
  async exportDuplicates(outputPath) {
    const duplicates = await this.findDuplicates();
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicates to export');
      return;
    }

    const csv = require('csv-writer');
    const csvWriter = csv.createObjectCsvWriter({
      path: outputPath,
      header: [
        { id: 'german_word', title: 'German Word' },
        { id: 'count', title: 'Duplicate Count' },
        { id: 'translations', title: 'All Translations' },
        { id: 'levels', title: 'All Levels' },
        { id: 'ids', title: 'All IDs' }
      ]
    });

    await csvWriter.writeRecords(duplicates);
    console.log(`📄 Duplicates exported to: ${outputPath}`);
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
🔍 German Vocabulary Duplicate Manager

Usage:
  node src/scripts/manageDuplicates.js <action> [options]

Actions:
  check                     Show duplicate report (no changes)
  remove [--keep-oldest]    Remove duplicates (keeps newest by default)
  similar                   Find similar words (potential typos)
  export <file.csv>         Export duplicates to CSV

Examples:
  node src/scripts/manageDuplicates.js check
  node src/scripts/manageDuplicates.js remove
  node src/scripts/manageDuplicates.js remove --keep-oldest
  node src/scripts/manageDuplicates.js similar
  node src/scripts/manageDuplicates.js export ./duplicates.csv

Default behavior:
  - Removes duplicates keeping the NEWEST entry
  - Use --keep-oldest to keep the OLDEST entry instead
  - Case-insensitive matching (Saft = saft = SAFT)
    `);
    process.exit(1);
  }

  const action = args[0];
  const manager = new DuplicateManager();
  
  try {
    await manager.initialize();
    
    switch (action) {
      case 'check':
        console.log('🔍 Checking for duplicates...\n');
        const report = await manager.showDuplicateReport();
        
        if (report.found > 0) {
          console.log('\n💡 To remove duplicates, run:');
          console.log('   node src/scripts/manageDuplicates.js remove');
        }
        break;
        
      case 'remove':
        const keepOldest = args.includes('--keep-oldest');
        console.log(`🧹 Removing duplicates (keeping ${keepOldest ? 'oldest' : 'newest'} entries)...\n`);
        
        const result = await manager.removeDuplicates(!keepOldest);
        
        console.log(`\n✅ Cleanup completed!`);
        console.log(`📊 Results:`);
        console.log(`   - Duplicate groups processed: ${result.found}`);
        console.log(`   - Entries removed: ${result.removed}`);
        console.log(`   - Entries kept: ${result.kept}`);
        console.log(`   - Errors: ${result.errors.length}`);
        
        if (result.errors.length > 0) {
          console.log('\n❌ Errors:');
          result.errors.forEach(error => {
            console.log(`   - ${error.word}: ${error.error}`);
          });
        }
        break;
        
      case 'similar':
        console.log('🔍 Finding similar words (potential typos)...\n');
        const similar = await manager.findSimilarWords();
        
        if (similar.length === 0) {
          console.log('✅ No similar words found!');
        } else {
          console.log(`Found ${similar.length} potentially similar word pairs:\n`);
          similar.slice(0, 20).forEach((pair, index) => {
            console.log(`${index + 1}. "${pair.word1.german_word}" vs "${pair.word2.german_word}"`);
            console.log(`   Translations: "${pair.word1.english_translation}" vs "${pair.word2.english_translation}"`);
            console.log(`   Similarity: ${(pair.similarity * 100).toFixed(1)}%\n`);
          });
          
          if (similar.length > 20) {
            console.log(`... and ${similar.length - 20} more similar pairs`);
          }
        }
        break;
        
      case 'export':
        const outputFile = args[1] || './duplicates.csv';
        console.log(`📄 Exporting duplicates to ${outputFile}...`);
        await manager.exportDuplicates(outputFile);
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

module.exports = DuplicateManager;