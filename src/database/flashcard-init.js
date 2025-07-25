const Database = require('better-sqlite3');
const path = require('path');
const config = require('../../config/config');

class FlashcardDatabaseInitializer {
  constructor() {
    this.dbPath = path.resolve(config.database.path);
  }

  async init() {
    try {
      const db = new Database(this.dbPath);
      console.log('Connected to SQLite database');
      // Simplified vocabulary table - just word + translation
      db.exec(`CREATE TABLE IF NOT EXISTS vocabulary_simple (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        german_word TEXT NOT NULL UNIQUE,
        english_translation TEXT NOT NULL,
        level TEXT DEFAULT 'A1',
        added_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        difficulty_score REAL DEFAULT 1.0
      )`);

      // User progress for flashcards
      db.exec(`CREATE TABLE IF NOT EXISTS flashcard_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        vocabulary_id INTEGER,
        times_shown INTEGER DEFAULT 0,
        times_correct INTEGER DEFAULT 0,
        times_incorrect INTEGER DEFAULT 0,
        last_shown DATETIME,
        mastery_level INTEGER DEFAULT 0,
        next_review DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (vocabulary_id) REFERENCES vocabulary_simple (id),
        UNIQUE(user_id, vocabulary_id)
      )`);

      // Flashcard sessions
      db.exec(`CREATE TABLE IF NOT EXISTS flashcard_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        total_cards INTEGER DEFAULT 0,
        cards_reviewed INTEGER DEFAULT 0,
        cards_known INTEGER DEFAULT 0,
        cards_learning INTEGER DEFAULT 0,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`);

      // Keep existing users table
      db.exec(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id INTEGER UNIQUE NOT NULL,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        language_code TEXT DEFAULT 'en',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // User settings for flashcards
      db.exec(`CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE,
        cards_per_session INTEGER DEFAULT 20,
        difficulty_preference TEXT DEFAULT 'mixed',
        review_mode TEXT DEFAULT 'spaced',
        show_pronunciation BOOLEAN DEFAULT 1,
        show_examples BOOLEAN DEFAULT 1,
        llm_provider TEXT DEFAULT 'ollama',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`);

      // Indexes for performance
      db.exec(`CREATE INDEX IF NOT EXISTS idx_vocabulary_simple_level ON vocabulary_simple(level)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_flashcard_progress_user_id ON flashcard_progress(user_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_flashcard_progress_next_review ON flashcard_progress(next_review)`);

      db.close();
      console.log('Flashcard database initialized successfully');
    } catch (error) {
      console.error('Error initializing flashcard database:', error);
      throw error;
    }
  }
}

if (require.main === module) {
  const initializer = new FlashcardDatabaseInitializer();
  initializer.init().catch(console.error);
}

module.exports = FlashcardDatabaseInitializer;