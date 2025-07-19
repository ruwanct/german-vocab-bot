const BetterSQLite = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../../config/config');

class Database {
  constructor() {
    this.dbPath = path.resolve(config.database.path);
    this.db = null;
  }

  connect() {
    // Ensure directory exists
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new BetterSQLite(this.dbPath);
    
    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');
    
    return Promise.resolve();
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    return Promise.resolve();
  }

  async createUser(telegramId, userData) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO users (
        telegram_id, username, first_name, last_name, language_code,
        data_consent_given, privacy_policy_accepted
      )
      VALUES (?, ?, ?, ?, ?, 0, 0)
    `);
    
    const result = stmt.run(
      telegramId,
      userData.username || null,
      userData.first_name || null,
      userData.last_name || null,
      userData.language_code || 'en'
    );
    
    return result.lastInsertRowid;
  }

  async getUserByTelegramId(telegramId) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE telegram_id = ?');
    return stmt.get(telegramId);
  }

  async getVocabularyByLevel(level = 'B1', limit = 100) {
    const stmt = this.db.prepare('SELECT * FROM vocabulary WHERE level = ? ORDER BY RANDOM() LIMIT ?');
    return stmt.all(level, limit);
  }

  async getRandomVocabulary(limit = 1) {
    const stmt = this.db.prepare('SELECT * FROM vocabulary ORDER BY RANDOM() LIMIT ?');
    return stmt.all(limit);
  }

  async updateUserProgress(userId, vocabularyId, isCorrect) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO user_progress 
      (user_id, vocabulary_id, correct_answers, incorrect_answers, last_practiced, updated_at)
      VALUES (
        ?, ?, 
        COALESCE((SELECT correct_answers FROM user_progress WHERE user_id = ? AND vocabulary_id = ?), 0) + ?,
        COALESCE((SELECT incorrect_answers FROM user_progress WHERE user_id = ? AND vocabulary_id = ?), 0) + ?,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `);
    
    const result = stmt.run(
      userId, vocabularyId, userId, vocabularyId, isCorrect ? 1 : 0, 
      userId, vocabularyId, isCorrect ? 0 : 1
    );
    
    return result.changes;
  }

  async getUserProgress(userId) {
    const stmt = this.db.prepare(`
      SELECT 
        up.*,
        v.word,
        v.article,
        v.translation_en,
        v.level
      FROM user_progress up
      JOIN vocabulary v ON up.vocabulary_id = v.id
      WHERE up.user_id = ?
      ORDER BY up.updated_at DESC
    `);
    return stmt.all(userId);
  }

  async createQuizSession(userId, sessionType = 'articles') {
    const stmt = this.db.prepare(`
      INSERT INTO quiz_sessions (user_id, session_type)
      VALUES (?, ?)
    `);
    
    const result = stmt.run(userId, sessionType);
    return result.lastInsertRowid;
  }

  async updateQuizSession(sessionId, totalQuestions, correctAnswers) {
    const stmt = this.db.prepare(`
      UPDATE quiz_sessions 
      SET total_questions = ?, correct_answers = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    const result = stmt.run(totalQuestions, correctAnswers, sessionId);
    return result.changes;
  }

  async getUserSettings(userId) {
    const stmt = this.db.prepare('SELECT * FROM user_settings WHERE user_id = ?');
    return stmt.get(userId);
  }

  async updateUserSettings(userId, settings) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO user_settings 
      (user_id, quiz_difficulty, questions_per_session, daily_goal, notifications_enabled, preferred_time, preferred_level, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    const result = stmt.run(
      userId,
      settings.quiz_difficulty || 'medium',
      settings.questions_per_session || 10,
      settings.daily_goal || 20,
      settings.notifications_enabled ? 1 : 0,
      settings.preferred_time || '18:00',
      settings.preferred_level || 'A1'
    );
    
    return result.changes;
  }

  // Consent management methods
  async updateUserConsent(userId, consentGiven, version = '1.0') {
    const stmt = this.db.prepare(`
      UPDATE users SET 
        data_consent_given = ?,
        data_consent_date = CURRENT_TIMESTAMP,
        data_consent_version = ?,
        privacy_policy_accepted = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    const result = stmt.run(consentGiven ? 1 : 0, version, consentGiven ? 1 : 0, userId);
    return result.changes;
  }

  async hasUserConsent(userId) {
    const stmt = this.db.prepare('SELECT data_consent_given, privacy_policy_accepted FROM users WHERE id = ?');
    const row = stmt.get(userId);
    return row && row.data_consent_given === 1 && row.privacy_policy_accepted === 1;
  }

  async getUserConsentInfo(userId) {
    const stmt = this.db.prepare(`
      SELECT data_consent_given, data_consent_date, data_consent_version, 
             privacy_policy_accepted
      FROM users WHERE id = ?
    `);
    return stmt.get(userId);
  }

  // Flashcard session methods
  async createFlashcardSession(userId, cardCount) {
    const stmt = this.db.prepare(`
      INSERT INTO flashcard_sessions (user_id, total_cards)
      VALUES (?, ?)
    `);
    
    const result = stmt.run(userId, cardCount);
    return result.lastInsertRowid;
  }

  async updateFlashcardProgress(userId, vocabularyId, masteryLevel, timesShown, nextReview) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO flashcard_progress 
      (user_id, vocabulary_id, mastery_level, times_shown, next_review, last_reviewed)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    const result = stmt.run(userId, vocabularyId, masteryLevel, timesShown, nextReview);
    return result.changes;
  }

  async recordFlashcardResponse(sessionId, vocabularyId, responseType, responseTime) {
    // For now, just update the flashcard progress instead of storing individual responses
    return Promise.resolve(sessionId);
  }

  // Custom query method for raw SQL
  query(sql, params = []) {
    if (sql.trim().toLowerCase().startsWith('select')) {
      const stmt = this.db.prepare(sql);
      return stmt.all(...params);
    } else {
      const stmt = this.db.prepare(sql);
      return stmt.run(...params);
    }
  }

  // Get single row
  get(sql, params = []) {
    const stmt = this.db.prepare(sql);
    return stmt.get(...params);
  }

  // Get all rows
  all(sql, params = []) {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  // Run a statement
  run(sql, params = []) {
    const stmt = this.db.prepare(sql);
    return stmt.run(...params);
  }
}

module.exports = Database;