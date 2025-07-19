require('dotenv').config();

module.exports = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN,
    webhookUrl: process.env.WEBHOOK_URL || null,
    port: process.env.PORT || 3000
  },
  database: {
    path: process.env.DATABASE_PATH || './data/bot.db'
  },
  quiz: {
    questionsPerSession: 10,
    timeoutSeconds: 30,
    streakReward: 5
  },
  vocabulary: {
    autoEnrichment: {
      enabled: process.env.AUTO_ENRICHMENT_ENABLED === 'true',
      maxWordsPerDay: parseInt(process.env.AUTO_ENRICHMENT_MAX_WORDS) || 10,
      schedule: process.env.AUTO_ENRICHMENT_SCHEDULE || '0 2 * * *' // 2 AM daily
    },
    cache: {
      expiryHours: parseInt(process.env.CACHE_EXPIRY_HOURS) || 24,
      maxMemoryEntries: parseInt(process.env.CACHE_MAX_MEMORY) || 500
    }
  },
  app: {
    environment: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info'
  }
};