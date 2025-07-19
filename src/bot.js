const { Telegraf, Markup } = require('telegraf');
const Database = require('./database/models');
const DatabaseInitializer = require('./database/init');
const DatabaseSeeder = require('./database/seed');
const config = require('../config/config');
const fs = require('fs');

const QuizHandler = require('./commands/quiz');
const SettingsHandler = require('./commands/settings');
const progressHandler = require('./commands/progress');
const adminHandler = require('./commands/admin');
const utils = require('./utils/helpers');

class GermanVocabBot {
  constructor() {
    this.bot = new Telegraf(config.telegram.token);
    this.db = new Database();
    this.activeQuizzes = new Map();
    this.quizHandler = new QuizHandler();
    this.settingsHandler = new SettingsHandler();
    
    this.setupMiddleware();
    this.setupCommands();
    this.setupCallbacks();
    this.setupErrorHandling();
  }

  async initialize() {
    await this.db.connect();
    
    if (!fs.existsSync(config.database.path)) {
      console.log('Database not found. Initializing...');
      const initializer = new DatabaseInitializer();
      await initializer.init();
      
      console.log('Seeding database with vocabulary...');
      const seeder = new DatabaseSeeder();
      await seeder.seed();
    }
    
    console.log('Bot initialized successfully');
  }

  setupMiddleware() {
    this.bot.use(async (ctx, next) => {
      const start = Date.now();
      
      if (ctx.from && ctx.from.id) {
        let user = await this.db.getUserByTelegramId(ctx.from.id);
        
        if (!user) {
          await this.db.createUser(ctx.from.id, {
            username: ctx.from.username,
            first_name: ctx.from.first_name,
            last_name: ctx.from.last_name,
            language_code: ctx.from.language_code
          });
          user = await this.db.getUserByTelegramId(ctx.from.id);
        }
        
        ctx.dbUser = user;
      }
      
      await next();
      
      const ms = Date.now() - start;
      console.log(`Response time: ${ms}ms`);
    });
  }

  setupCommands() {
    this.bot.start((ctx) => {
      const welcomeMessage = `
🇩🇪 *Welcome to German Vocab Bot!*

I help you learn German vocabulary with focus on articles (der/die/das).

📚 *Available Commands:*
/quiz - Start a quiz
/progress - Show your progress
/settings - Adjust settings
/help - Show help

🎯 *Features:*
• Interactive quizzes with der/die/das
• Progress tracking
• Personal settings
• A1/A2/B1 Level German vocabulary

Use /quiz to get started!
      `;
      
      ctx.replyWithMarkdown(welcomeMessage);
    });

    this.bot.help((ctx) => {
      const helpMessage = `
🔧 *Hilfe - German Vocab Bot*

*Hauptbefehle:*
/start - Bot starten
/quiz - Quiz starten
/progress - Fortschritt anzeigen
/settings - Einstellungen

*Quiz-Typen:*
• Article Quiz (der/die/das)
• Translation Quiz
• Mixed Quiz

*Tipps:*
• Verwende die Inline-Buttons für bessere Interaktion
• Dein Fortschritt wird automatisch gespeichert
• Passe die Einstellungen an deine Bedürfnisse an

Bei Problemen schreibe an den Support.
      `;
      
      ctx.replyWithMarkdown(helpMessage);
    });

    this.bot.command('quiz', (ctx) => this.quizHandler.startQuiz(ctx, this.db));
    this.bot.command('progress', progressHandler.showProgress.bind(progressHandler));
    this.bot.command('settings', (ctx) => this.settingsHandler.showSettings(ctx, this.db));
    this.bot.command('admin', adminHandler.handleAdminCommand.bind(adminHandler));
  }

  setupCallbacks() {
    this.bot.on('callback_query', async (ctx) => {
      const data = ctx.callbackQuery.data;
      const userId = ctx.from.id;
      
      if (data.startsWith('quiz_') || data.startsWith('flashcard_')) {
        await this.quizHandler.handleQuizCallback(ctx, this.db, this.activeQuizzes);
      } else if (data.startsWith('settings_')) {
        await this.settingsHandler.handleSettingsCallback(ctx, this.db);
      } else if (data.startsWith('progress_')) {
        await progressHandler.handleProgressCallback(ctx, this.db);
      } else if (data.startsWith('admin_')) {
        await adminHandler.handleAdminCallback(ctx, this.db);
      }
      
      await ctx.answerCbQuery();
    });
  }

  setupErrorHandling() {
    this.bot.catch((err, ctx) => {
      console.error('Bot error:', err);
      ctx.reply('❌ An error occurred. Please try again later.');
    });

    process.on('uncaughtException', (err) => {
      console.error('Uncaught Exception:', err);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
  }

  async launch() {
    await this.initialize();
    
    if (config.telegram.webhookUrl) {
      await this.bot.telegram.setWebhook(config.telegram.webhookUrl);
      console.log('Webhook set successfully');
    } else {
      await this.bot.launch();
      console.log('Bot started in polling mode');
    }
  }

  async stop() {
    this.bot.stop();
    await this.db.close();
    console.log('Bot stopped');
  }
}

const bot = new GermanVocabBot();

bot.launch().catch(console.error);

process.once('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  bot.stop();
});

process.once('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  bot.stop();
});

module.exports = GermanVocabBot;