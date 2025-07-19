const BetterSQLite = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../../config/config');

class DatabaseSeeder {
  constructor() {
    this.dbPath = path.resolve(config.database.path);
    this.vocabularyPath = path.resolve('./data/vocabulary.json');
  }

  async seed() {
    try {
      const db = new BetterSQLite(this.dbPath);
      console.log('Connected to SQLite database for seeding');

      const vocabularyData = JSON.parse(fs.readFileSync(this.vocabularyPath, 'utf8'));
      
      // Clear existing data
      db.exec('DELETE FROM vocabulary');
      
      const stmt = db.prepare(`
        INSERT INTO vocabulary (word, article, translation_en, translation_de, pronunciation, level, category, example_sentence)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      vocabularyData.vocabulary.forEach(item => {
        stmt.run(
          item.word,
          item.article,
          item.translation_en,
          item.translation_de,
          item.pronunciation,
          item.level,
          item.category,
          item.example_sentence
        );
      });

      console.log(`Seeded ${vocabularyData.vocabulary.length} vocabulary items`);
      db.close();
      console.log('Database seeding completed successfully');
    } catch (error) {
      console.error('Error seeding database:', error);
      throw error;
    }
  }
}

if (require.main === module) {
  const seeder = new DatabaseSeeder();
  seeder.seed().catch(console.error);
}

module.exports = DatabaseSeeder;