const BetterSQLite = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../../config/config');

class DatabaseInitializer {
  constructor() {
    this.dbPath = path.resolve(config.database.path);
  }

  async init() {
    try {
      // Ensure directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      const db = new BetterSQLite(this.dbPath);
      console.log('Connected to SQLite database');

      // Enable foreign keys
      db.pragma('foreign_keys = ON');

      // Create tables
      db.exec(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id INTEGER UNIQUE NOT NULL,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        language_code TEXT DEFAULT 'en',
        data_consent_given BOOLEAN DEFAULT 0,
        data_consent_date DATETIME,
        data_consent_version TEXT DEFAULT '1.0',
        privacy_policy_accepted BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.exec(`CREATE TABLE IF NOT EXISTS vocabulary (
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

      db.exec(`CREATE TABLE IF NOT EXISTS vocabulary_simple (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        german_word TEXT NOT NULL UNIQUE,
        english_translation TEXT NOT NULL,
        level TEXT DEFAULT 'A1',
        added_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        difficulty_score REAL DEFAULT 1.0
      )`);

      db.exec(`CREATE TABLE IF NOT EXISTS user_progress (
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

      db.exec(`CREATE TABLE IF NOT EXISTS flashcard_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        vocabulary_id INTEGER NOT NULL,
        times_shown INTEGER DEFAULT 0,
        times_correct INTEGER DEFAULT 0,
        times_incorrect INTEGER DEFAULT 0,
        mastery_level INTEGER DEFAULT 0,
        last_shown DATETIME,
        next_review DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (vocabulary_id) REFERENCES vocabulary_simple (id),
        UNIQUE(user_id, vocabulary_id)
      )`);

      db.exec(`CREATE TABLE IF NOT EXISTS flashcard_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        total_cards INTEGER DEFAULT 0,
        cards_reviewed INTEGER DEFAULT 0,
        cards_known INTEGER DEFAULT 0,
        cards_learning INTEGER DEFAULT 0,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`);

      db.exec(`CREATE TABLE IF NOT EXISTS quiz_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        total_questions INTEGER DEFAULT 0,
        correct_answers INTEGER DEFAULT 0,
        session_type TEXT DEFAULT 'articles',
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`);

      db.exec(`CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE,
        quiz_difficulty TEXT DEFAULT 'medium',
        questions_per_session INTEGER DEFAULT 10,
        daily_goal INTEGER DEFAULT 20,
        notifications_enabled BOOLEAN DEFAULT 1,
        preferred_time TEXT DEFAULT '18:00',
        preferred_level TEXT DEFAULT 'A1',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`);

      // Create indexes
      db.exec(`CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_vocabulary_level ON vocabulary(level)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_vocabulary_simple_level ON vocabulary_simple(level)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user_id ON quiz_sessions(user_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_flashcard_progress_user_id ON flashcard_progress(user_id)`);

      db.close();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }
}

if (require.main === module) {
  const initializer = new DatabaseInitializer();
  initializer.init().catch(console.error);
}

module.exports = DatabaseInitializer;