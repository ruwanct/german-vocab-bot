const Database = require('better-sqlite3');
const path = require('path');
const config = require('../../config/config');

class Database {
  constructor() {
    this.dbPath = path.resolve(config.database.path);
    this.db = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  async createUser(telegramId, userData) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO users (
          telegram_id, username, first_name, last_name, language_code,
          data_consent_given, privacy_policy_accepted
        )
        VALUES (?, ?, ?, ?, ?, 0, 0)
      `);
      
      stmt.run(
        telegramId,
        userData.username || null,
        userData.first_name || null,
        userData.last_name || null,
        userData.language_code || 'en',
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
      stmt.finalize();
    });
  }

  async getUserByTelegramId(telegramId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM users WHERE telegram_id = ?',
        [telegramId],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  }

  async getVocabularyByLevel(level = 'B1', limit = 100) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM vocabulary WHERE level = ? ORDER BY RANDOM() LIMIT ?',
        [level, limit],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }

  async getRandomVocabulary(limit = 1) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM vocabulary ORDER BY RANDOM() LIMIT ?',
        [limit],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }

  async updateUserProgress(userId, vocabularyId, isCorrect) {
    return new Promise((resolve, reject) => {
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
      
      stmt.run(
        userId, vocabularyId, userId, vocabularyId, isCorrect ? 1 : 0, 
        userId, vocabularyId, isCorrect ? 0 : 1,
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes);
          }
        }
      );
      stmt.finalize();
    });
  }

  async getUserProgress(userId) {
    return new Promise((resolve, reject) => {
      this.db.all(`
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
      `, [userId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async createQuizSession(userId, sessionType = 'articles') {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO quiz_sessions (user_id, session_type)
        VALUES (?, ?)
      `);
      
      stmt.run(userId, sessionType, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
      stmt.finalize();
    });
  }

  async updateQuizSession(sessionId, totalQuestions, correctAnswers) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        UPDATE quiz_sessions 
        SET total_questions = ?, correct_answers = ?, completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      
      stmt.run(totalQuestions, correctAnswers, sessionId, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
      stmt.finalize();
    });
  }

  async getUserSettings(userId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM user_settings WHERE user_id = ?',
        [userId],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  }

  async updateUserSettings(userId, settings) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO user_settings 
        (user_id, quiz_difficulty, questions_per_session, daily_goal, notifications_enabled, preferred_time, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      
      stmt.run(
        userId,
        settings.quiz_difficulty || 'medium',
        settings.questions_per_session || 10,
        settings.daily_goal || 20,
        settings.notifications_enabled ? 1 : 0,
        settings.preferred_time || '18:00',
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes);
          }
        }
      );
      stmt.finalize();
    });
  }

  // Consent management methods
  async updateUserConsent(userId, consentGiven, version = '1.0') {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        UPDATE users SET 
          data_consent_given = ?,
          data_consent_date = CURRENT_TIMESTAMP,
          data_consent_version = ?,
          privacy_policy_accepted = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      
      stmt.run(consentGiven ? 1 : 0, version, consentGiven ? 1 : 0, userId, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
      stmt.finalize();
    });
  }

  async hasUserConsent(userId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT data_consent_given, privacy_policy_accepted FROM users WHERE id = ?',
        [userId],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row && row.data_consent_given === 1 && row.privacy_policy_accepted === 1);
          }
        }
      );
    });
  }

  async getUserConsentInfo(userId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT data_consent_given, data_consent_date, data_consent_version, 
                privacy_policy_accepted
         FROM users WHERE id = ?`,
        [userId],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  }

  // Flashcard session methods
  async createFlashcardSession(userId, cardCount) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO flashcard_sessions (user_id, total_cards)
        VALUES (?, ?)
      `);
      
      stmt.run(userId, cardCount, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
      stmt.finalize();
    });
  }

  async updateFlashcardProgress(userId, vocabularyId, masteryLevel, timesShown, nextReview) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO flashcard_progress 
        (user_id, vocabulary_id, mastery_level, times_shown, next_review, last_reviewed)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      
      stmt.run(userId, vocabularyId, masteryLevel, timesShown, nextReview, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
      stmt.finalize();
    });
  }

  async recordFlashcardResponse(sessionId, vocabularyId, responseType, responseTime) {
    // For now, just update the flashcard progress instead of storing individual responses
    // This can be expanded later if detailed response tracking is needed
    return Promise.resolve(sessionId);
  }

}

module.exports = Database;