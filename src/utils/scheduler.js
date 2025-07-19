const cron = require('node-cron');
const Database = require('../database/models');
const vocabularyManager = require('../services/vocabularyManager');
const utils = require('./helpers');
const config = require('../../config/config');

class Scheduler {
  constructor() {
    this.db = new Database();
    this.jobs = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    await this.db.connect();
    this.setupScheduledJobs();
    this.isInitialized = true;
    
    console.log('Scheduler initialized successfully');
  }

  setupScheduledJobs() {
    this.scheduleDailyReminders();
    this.scheduleWeeklyReports();
    this.scheduleInactivityChecks();
    this.scheduleDataCleanup();
    this.scheduleVocabularyEnrichment();
    this.scheduleCacheCleanup();
  }

  scheduleDailyReminders() {
    const job = cron.schedule('0 18 * * *', async () => {
      console.log('Running daily reminders...');
      await this.sendDailyReminders();
    }, {
      scheduled: true,
      timezone: 'Europe/Berlin'
    });
    
    this.jobs.set('daily_reminders', job);
  }

  scheduleWeeklyReports() {
    const job = cron.schedule('0 9 * * 1', async () => {
      console.log('Running weekly reports...');
      await this.sendWeeklyReports();
    }, {
      scheduled: true,
      timezone: 'Europe/Berlin'
    });
    
    this.jobs.set('weekly_reports', job);
  }

  scheduleInactivityChecks() {
    const job = cron.schedule('0 12 * * *', async () => {
      console.log('Checking for inactive users...');
      await this.checkInactiveUsers();
    }, {
      scheduled: true,
      timezone: 'Europe/Berlin'
    });
    
    this.jobs.set('inactivity_checks', job);
  }

  scheduleDataCleanup() {
    const job = cron.schedule('0 2 * * 0', async () => {
      console.log('Running data cleanup...');
      await this.cleanupOldData();
    }, {
      scheduled: true,
      timezone: 'Europe/Berlin'
    });
    
    this.jobs.set('data_cleanup', job);
  }

  scheduleVocabularyEnrichment() {
    if (!config.vocabulary.autoEnrichment.enabled) {
      console.log('Vocabulary auto-enrichment disabled');
      return;
    }

    const schedule = config.vocabulary.autoEnrichment.schedule;
    const job = cron.schedule(schedule, async () => {
      console.log('Running vocabulary enrichment...');
      await this.enrichVocabulary();
    }, {
      scheduled: true,
      timezone: 'Europe/Berlin'
    });
    
    this.jobs.set('vocabulary_enrichment', job);
  }

  scheduleCacheCleanup() {
    const job = cron.schedule('0 3 * * *', async () => {
      console.log('Running cache cleanup...');
      await this.cleanupCache();
    }, {
      scheduled: true,
      timezone: 'Europe/Berlin'
    });
    
    this.jobs.set('cache_cleanup', job);
  }

  async sendDailyReminders() {
    try {
      const users = await this.getUsersForDailyReminders();
      
      for (const user of users) {
        const settings = await this.db.getUserSettings(user.id) || {};
        
        if (settings.notifications_enabled) {
          const reminderTime = settings.preferred_time || '18:00';
          const currentTime = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
          
          if (this.isTimeForReminder(currentTime, reminderTime)) {
            await this.sendReminderToUser(user);
          }
        }
      }
    } catch (error) {
      console.error('Error sending daily reminders:', error);
    }
  }

  async sendWeeklyReports() {
    try {
      const users = await this.getUsersForWeeklyReports();
      
      for (const user of users) {
        const reportData = await this.generateWeeklyReport(user.id);
        
        if (reportData.hasActivity) {
          await this.sendWeeklyReportToUser(user, reportData);
        }
      }
    } catch (error) {
      console.error('Error sending weekly reports:', error);
    }
  }

  async checkInactiveUsers() {
    try {
      const inactiveUsers = await this.getInactiveUsers();
      
      for (const user of inactiveUsers) {
        await this.sendInactivityReminder(user);
      }
    } catch (error) {
      console.error('Error checking inactive users:', error);
    }
  }

  async cleanupOldData() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - 6);
      
      const deleted = await this.deleteOldSessions(cutoffDate);
      console.log(`Cleaned up ${deleted} old sessions`);
      
      await this.optimizeDatabase();
    } catch (error) {
      console.error('Error cleaning up old data:', error);
    }
  }

  async enrichVocabulary() {
    try {
      await vocabularyManager.initialize();
      
      const maxWords = config.vocabulary.autoEnrichment.maxWordsPerDay;
      const result = await vocabularyManager.autoEnrichVocabulary(maxWords);
      
      console.log(`Vocabulary enrichment completed: ${result.enriched} words enriched`);
      
      if (result.errors.length > 0) {
        console.log(`Enrichment errors: ${result.errors.length}`);
        result.errors.forEach(error => {
          console.log(`- ${error.word}: ${error.error}`);
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error enriching vocabulary:', error);
      return { enriched: 0, errors: [{ word: 'system', error: error.message }] };
    }
  }

  async cleanupCache() {
    try {
      await vocabularyManager.initialize();
      
      const cleaned = await vocabularyManager.cleanupOldCache();
      console.log(`Cache cleanup completed: ${cleaned} entries removed`);
      
      return cleaned;
    } catch (error) {
      console.error('Error cleaning up cache:', error);
      return 0;
    }
  }

  async getUsersForDailyReminders() {
    return new Promise((resolve, reject) => {
      this.db.db.all(`
        SELECT u.*, us.notifications_enabled, us.preferred_time
        FROM users u
        LEFT JOIN user_settings us ON u.id = us.user_id
        WHERE us.notifications_enabled = 1 OR us.notifications_enabled IS NULL
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async getUsersForWeeklyReports() {
    return new Promise((resolve, reject) => {
      this.db.db.all(`
        SELECT DISTINCT u.*
        FROM users u
        JOIN quiz_sessions qs ON u.id = qs.user_id
        WHERE qs.completed_at > datetime('now', '-7 days')
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async getInactiveUsers() {
    return new Promise((resolve, reject) => {
      this.db.db.all(`
        SELECT u.*, MAX(qs.completed_at) as last_activity
        FROM users u
        LEFT JOIN quiz_sessions qs ON u.id = qs.user_id
        WHERE qs.completed_at < datetime('now', '-3 days')
        OR qs.completed_at IS NULL
        GROUP BY u.id
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async generateWeeklyReport(userId) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const sessions = await new Promise((resolve, reject) => {
      this.db.db.all(`
        SELECT * FROM quiz_sessions
        WHERE user_id = ? AND completed_at > ?
        ORDER BY completed_at DESC
      `, [userId, weekAgo.toISOString()], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    if (sessions.length === 0) {
      return { hasActivity: false };
    }

    const totalSessions = sessions.length;
    const totalQuestions = sessions.reduce((sum, s) => sum + (s.total_questions || 0), 0);
    const totalCorrect = sessions.reduce((sum, s) => sum + (s.correct_answers || 0), 0);
    const averageAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

    const sessionsByDay = this.groupSessionsByDay(sessions);
    const consistentDays = Object.keys(sessionsByDay).length;

    return {
      hasActivity: true,
      weekStart: weekAgo.toISOString(),
      weekEnd: new Date().toISOString(),
      totalSessions,
      totalQuestions,
      totalCorrect,
      averageAccuracy,
      consistentDays,
      sessionsByDay,
      insights: utils.generateWeeklyInsights({
        totalSessions,
        averageAccuracy,
        consistentDays
      })
    };
  }

  groupSessionsByDay(sessions) {
    const grouped = {};
    
    sessions.forEach(session => {
      const day = utils.formatDate(session.completed_at);
      if (!grouped[day]) {
        grouped[day] = [];
      }
      grouped[day].push(session);
    });
    
    return grouped;
  }

  async sendReminderToUser(user) {
    try {
      const greeting = utils.getTimeBasedGreeting();
      const dayOfWeek = utils.getDayOfWeek();
      
      console.log(`Would send daily reminder to user ${user.telegram_id}: ${greeting}! 🇩🇪 Quiz reminder for ${dayOfWeek}`);
      
      // Note: In a production environment, you could send reminders via:
      // 1. Direct bot message (if you store chat context)
      // 2. External service (email, SMS, etc.)
      // 3. Database queue for the bot to process
      
    } catch (error) {
      console.error(`Error processing reminder for user ${user.telegram_id}:`, error);
    }
  }

  async sendWeeklyReportToUser(user, reportData) {
    try {
      console.log(`Would send weekly report to user ${user.telegram_id}: ${reportData.totalSessions} sessions, ${reportData.averageAccuracy}% accuracy`);
      
      // Note: Weekly reports could be implemented via:
      // 1. Direct bot message with stored user context
      // 2. Email service integration
      // 3. Database notification queue
      
    } catch (error) {
      console.error(`Error processing weekly report for user ${user.telegram_id}:`, error);
    }
  }

  async sendInactivityReminder(user) {
    try {
      const daysInactive = this.calculateDaysInactive(user.last_activity);
      
      console.log(`Would send inactivity reminder to user ${user.telegram_id}: ${daysInactive} days inactive`);
      
      // Note: Inactivity reminders could be implemented via:
      // 1. Direct bot message with stored user context
      // 2. Email/SMS service integration
      // 3. Database notification queue
      
    } catch (error) {
      console.error(`Error processing inactivity reminder for user ${user.telegram_id}:`, error);
    }
  }

  calculateDaysInactive(lastActivity) {
    if (!lastActivity) return 999;
    
    const last = new Date(lastActivity);
    const now = new Date();
    const diffTime = Math.abs(now - last);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }

  async deleteOldSessions(cutoffDate) {
    return new Promise((resolve, reject) => {
      this.db.db.run(
        'DELETE FROM quiz_sessions WHERE completed_at < ?',
        [cutoffDate.toISOString()],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  async optimizeDatabase() {
    return new Promise((resolve, reject) => {
      this.db.db.run('VACUUM', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  isTimeForReminder(currentTime, preferredTime) {
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const [preferredHour, preferredMinute] = preferredTime.split(':').map(Number);
    
    const currentMinutes = currentHour * 60 + currentMinute;
    const preferredMinutes = preferredHour * 60 + preferredMinute;
    
    return Math.abs(currentMinutes - preferredMinutes) <= 15;
  }

  startJob(jobName) {
    const job = this.jobs.get(jobName);
    if (job) {
      job.start();
      console.log(`Started job: ${jobName}`);
    }
  }

  stopJob(jobName) {
    const job = this.jobs.get(jobName);
    if (job) {
      job.stop();
      console.log(`Stopped job: ${jobName}`);
    }
  }

  stopAllJobs() {
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`Stopped job: ${name}`);
    });
  }

  getJobStatus() {
    const status = {};
    this.jobs.forEach((job, name) => {
      status[name] = job.running;
    });
    return status;
  }

  async shutdown() {
    this.stopAllJobs();
    await this.db.close();
    console.log('Scheduler shutdown completed');
  }
}

module.exports = new Scheduler();