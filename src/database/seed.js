const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('../../config/config');

class DatabaseSeeder {
  constructor() {
    this.dbPath = path.resolve(config.database.path);
    this.vocabularyPath = path.resolve('./data/vocabulary.json');
  }

  async seed() {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
          return;
        }
        console.log('Connected to SQLite database for seeding');
      });

      const vocabularyData = JSON.parse(fs.readFileSync(this.vocabularyPath, 'utf8'));
      
      db.serialize(() => {
        db.run('DELETE FROM vocabulary');
        
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

        stmt.finalize();
        console.log(`Seeded ${vocabularyData.vocabulary.length} vocabulary items`);
      });

      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
          reject(err);
        } else {
          console.log('Database seeding completed successfully');
          resolve();
        }
      });
    });
  }
}

if (require.main === module) {
  const seeder = new DatabaseSeeder();
  seeder.seed().catch(console.error);
}

module.exports = DatabaseSeeder;