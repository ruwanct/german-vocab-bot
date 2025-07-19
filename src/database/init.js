const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const config = require('../../config/config');

class DatabaseInitializer {
  constructor() {
    this.dbPath = path.resolve(config.database.path);
  }

  async init() {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
          return;
        }
        console.log('Connected to SQLite database');
      });

      db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          telegram_id INTEGER UNIQUE NOT NULL,
          username TEXT,
          first_name TEXT,
          last_name TEXT,
          language_code TEXT DEFAULT 'en',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS vocabulary (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          word TEXT NOT NULL,
          article TEXT,
          translation_en TEXT NOT NULL,
          translation_de TEXT,
          pronunciation TEXT,
          level TEXT DEFAULT 'B1',
          category TEXT,
          example_sentence TEXT,
          source TEXT DEFAULT 'manual',
          api_data TEXT,
          confidence REAL DEFAULT 1.0,
          frequency INTEGER DEFAULT 0,
          word_type TEXT,
          last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS user_progress (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          vocabulary_id INTEGER,
          correct_answers INTEGER DEFAULT 0,
          incorrect_answers INTEGER DEFAULT 0,
          last_practiced DATETIME,
          mastery_level INTEGER DEFAULT 0,
          streak INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id),
          FOREIGN KEY (vocabulary_id) REFERENCES vocabulary (id),
          UNIQUE(user_id, vocabulary_id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS quiz_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          total_questions INTEGER DEFAULT 0,
          correct_answers INTEGER DEFAULT 0,
          session_type TEXT DEFAULT 'articles',
          started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS user_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER UNIQUE,
          quiz_difficulty TEXT DEFAULT 'medium',
          questions_per_session INTEGER DEFAULT 10,
          daily_goal INTEGER DEFAULT 20,
          notifications_enabled BOOLEAN DEFAULT 1,
          preferred_time TEXT DEFAULT '18:00',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )`);


        db.run(`CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_vocabulary_level ON vocabulary(level)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user_id ON quiz_sessions(user_id)`);
      });

      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
          reject(err);
        } else {
          console.log('Database initialized successfully');
          resolve();
        }
      });
    });
  }
}

if (require.main === module) {
  const initializer = new DatabaseInitializer();
  initializer.init().catch(console.error);
}

module.exports = DatabaseInitializer;