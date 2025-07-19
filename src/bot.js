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
        
        // Check consent before allowing any commands except /start and consent-related callbacks
        const hasConsent = await this.db.hasUserConsent(user.id);
        const isStartCommand = ctx.message && ctx.message.text === '/start';
        const isConsentCallback = ctx.callbackQuery && ctx.callbackQuery.data.startsWith('consent_');
        
        if (!hasConsent && !isStartCommand && !isConsentCallback) {
          await this.showConsentDialog(ctx);
          return; // Don't continue to next middleware
        }
      }
      
      await next();
      
      const ms = Date.now() - start;
      console.log(`Response time: ${ms}ms`);
    });
  }

  async showConsentDialog(ctx) {
    const message = `
🔒 *Data Privacy & Consent*

Before you can use German Vocab Bot, we need your consent to store your learning data.

📊 *What we store:*
• Your quiz progress and scores
• Vocabulary mastery levels  
• Learning preferences and settings
• Quiz session history

🛡️ *Your rights:*
• Data is used only to improve your learning
• You can delete your data anytime via /settings
• No data is shared with third parties
• GDPR compliant

⚖️ *Legal basis:* Your explicit consent

By clicking "I Agree", you consent to storing your learning data as described above.
    `;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('✅ I Agree', 'consent_accept')],
      [Markup.button.callback('❌ Decline', 'consent_decline')],
      [Markup.button.callback('📋 Privacy Policy', 'consent_privacy_policy')]
    ]);

    await ctx.replyWithMarkdown(message, keyboard);
  }

  async showPrivacyPolicy(ctx) {
    const message = `
📋 *Privacy Policy - German Vocab Bot*

*Data Controller:* German Vocab Bot
*Version:* 1.0
*Last Updated:* ${new Date().toDateString()}

*1. Data We Collect:*
• Telegram user ID (for account identification)
• Quiz scores and progress
• Vocabulary learning data
• User preferences

*2. Purpose:*
• Provide personalized German learning experience
• Track your learning progress
• Improve learning recommendations

*3. Data Retention:*
• Data stored until you delete your account
• You can export or delete data via /settings

*4. Your Rights:*
• Access your data
• Delete your data
• Export your data
• Withdraw consent

*5. Contact:*
For privacy questions, use /settings → Data Export

This bot is GDPR compliant and respects your privacy.
    `;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('✅ Accept & Continue', 'consent_accept')],
      [Markup.button.callback('🔙 Back', 'consent_back')]
    ]);

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup
    });
  }

  setupCommands() {
    this.bot.start(async (ctx) => {
      // Check if user has given consent
      const hasConsent = await this.db.hasUserConsent(ctx.dbUser.id);
      
      if (!hasConsent) {
        await this.showConsentDialog(ctx);
        return;
      }

      const welcomeMessage = `
🇩🇪 *Welcome to German Vocab Bot!*

I help you learn German vocabulary with focus on articles (der/die/das).

📚 *Available Commands:*
/quiz - Start a quiz
/level - Choose your learning level (A1/A2/B1)
/words - Browse available vocabulary
/progress - Show your progress
/settings - Adjust settings
/help - Show help

🎯 *Features:*
• Interactive flashcards with AI analysis
• Multiple difficulty levels (A1/A2/B1)
• Progress tracking with spaced repetition
• Personal settings
• Level-specific vocabulary

Use /words to explore vocabulary, /level to choose your level, then /quiz to get started!
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
    this.bot.command('level', (ctx) => this.showLevelSelector(ctx));
    this.bot.command('words', (ctx) => this.showVocabularyPreview(ctx));
    this.bot.command('vocabulary', (ctx) => this.showVocabularyPreview(ctx));
    this.bot.command('progress', progressHandler.showProgress.bind(progressHandler));
    this.bot.command('settings', (ctx) => this.settingsHandler.showSettings(ctx, this.db));
    this.bot.command('admin', adminHandler.handleAdminCommand.bind(adminHandler));
  }

  async showLevelSelector(ctx) {
    const settings = await this.db.getUserSettings(ctx.dbUser.id) || {};
    const currentLevel = settings.preferred_level || 'A1';
    
    const message = `
📚 *Choose Your Learning Level*

*Current Level:* ${currentLevel}

Select the level you want to practice:

🟢 *A1* - Beginner (Basic vocabulary)
🟡 *A2* - Elementary (Expanded vocabulary)  
🟠 *B1* - Intermediate (Advanced vocabulary)

Your flashcards will show words from the selected level.
    `;

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback(currentLevel === 'A1' ? '✅ A1' : 'A1', 'level_select_A1'),
        Markup.button.callback(currentLevel === 'A2' ? '✅ A2' : 'A2', 'level_select_A2'),
        Markup.button.callback(currentLevel === 'B1' ? '✅ B1' : 'B1', 'level_select_B1')
      ],
      [Markup.button.callback('🎴 Start Quiz', 'level_start_quiz')]
    ]);

    await ctx.replyWithMarkdown(message, keyboard);
  }

  async showVocabularyPreview(ctx) {
    // Get vocabulary statistics for each level
    const stats = await this.getVocabularyStats();
    
    const message = `
📖 *Available Vocabulary*

Here's what you can learn at each level:

🟢 *A1 (Beginner)*
• ${stats.A1.count} words available
• Topics: Basic words, everyday items
• Examples: ${stats.A1.examples.join(', ')}

🟡 *A2 (Elementary)*
• ${stats.A2.count} words available  
• Topics: Expanded vocabulary, activities
• Examples: ${stats.A2.examples.join(', ')}

🟠 *B1 (Intermediate)*
• ${stats.B1.count} words available
• Topics: Advanced concepts, society
• Examples: ${stats.B1.examples.join(', ')}

*Total: ${stats.total} German words*
    `;

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('📝 A1 Sample', 'vocab_sample_A1'),
        Markup.button.callback('📝 A2 Sample', 'vocab_sample_A2'),
        Markup.button.callback('📝 B1 Sample', 'vocab_sample_B1')
      ],
      [Markup.button.callback('🎴 Start Learning', 'vocab_start_learning')]
    ]);

    await ctx.replyWithMarkdown(message, keyboard);
  }

  async getVocabularyStats() {
    return new Promise((resolve, reject) => {
      this.db.db.all(`
        SELECT level, COUNT(*) as count,
               GROUP_CONCAT(german_word, ', ') as all_words
        FROM vocabulary_simple 
        GROUP BY level
        ORDER BY level
      `, async (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const stats = { total: 0 };
        
        for (const row of rows) {
          const words = row.all_words.split(', ');
          const examples = words.slice(0, 3); // First 3 words as examples
          
          stats[row.level] = {
            count: row.count,
            examples: examples
          };
          stats.total += row.count;
        }
        
        // Ensure all levels exist with defaults
        if (!stats.A1) stats.A1 = { count: 0, examples: ['No words'] };
        if (!stats.A2) stats.A2 = { count: 0, examples: ['No words'] };
        if (!stats.B1) stats.B1 = { count: 0, examples: ['No words'] };
        
        resolve(stats);
      });
    });
  }

  setupCallbacks() {
    this.bot.on('callback_query', async (ctx) => {
      const data = ctx.callbackQuery.data;
      const userId = ctx.from.id;
      
      if (data.startsWith('consent_')) {
        await this.handleConsentCallback(ctx);
      } else if (data.startsWith('quiz_') || data.startsWith('flashcard_')) {
        await this.quizHandler.handleQuizCallback(ctx, this.db, this.activeQuizzes);
      } else if (data.startsWith('settings_')) {
        await this.settingsHandler.handleSettingsCallback(ctx, this.db);
      } else if (data.startsWith('level_')) {
        await this.handleLevelCallback(ctx);
      } else if (data.startsWith('vocab_')) {
        await this.handleVocabCallback(ctx);
      } else if (data.startsWith('progress_')) {
        await progressHandler.handleProgressCallback(ctx, this.db);
      } else if (data.startsWith('admin_')) {
        await adminHandler.handleAdminCallback(ctx, this.db);
      }
      
      await ctx.answerCbQuery();
    });
  }

  async handleConsentCallback(ctx) {
    const data = ctx.callbackQuery.data;
    
    if (data === 'consent_accept') {
      // Grant consent
      await this.db.updateUserConsent(ctx.dbUser.id, true, '1.0');
      
      await ctx.editMessageText(
        `✅ *Thank you for your consent!*\n\nYou can now use all features of German Vocab Bot.\n\nUse /words to explore vocabulary or /quiz to start learning!`,
        {
          parse_mode: 'Markdown',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('🎴 Start Learning', 'level_start_quiz')],
            [Markup.button.callback('📖 Browse Words', 'vocab_start_learning')]
          ]).reply_markup
        }
      );
    } else if (data === 'consent_decline') {
      await ctx.editMessageText(
        `❌ *Consent Declined*\n\nWe respect your choice. However, we cannot provide learning features without storing your progress.\n\nYou can give consent anytime by typing /start.`,
        {
          parse_mode: 'Markdown',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('🔄 Reconsider', 'consent_back')]
          ]).reply_markup
        }
      );
    } else if (data === 'consent_privacy_policy') {
      await this.showPrivacyPolicy(ctx);
    } else if (data === 'consent_back') {
      await this.showConsentDialog(ctx);
    }
  }

  async handleLevelCallback(ctx) {
    const data = ctx.callbackQuery.data;
    
    if (data.startsWith('level_select_')) {
      const level = data.split('_')[2];
      
      // Update user's preferred level
      const currentSettings = await this.db.getUserSettings(ctx.dbUser.id) || {};
      const newSettings = { ...currentSettings, preferred_level: level };
      await this.db.updateUserSettings(ctx.dbUser.id, newSettings);
      
      await ctx.editMessageText(
        `✅ Level changed to ${level}!\n\nYour flashcards will now show ${level} vocabulary words.`,
        {
          parse_mode: 'Markdown',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('🎴 Start Quiz', 'level_start_quiz')],
            [Markup.button.callback('📚 Change Level', 'level_change_again')]
          ]).reply_markup
        }
      );
    } else if (data === 'level_start_quiz') {
      await this.quizHandler.startQuiz(ctx, this.db);
    } else if (data === 'level_change_again') {
      await this.showLevelSelector(ctx);
    }
  }

  async handleVocabCallback(ctx) {
    const data = ctx.callbackQuery.data;
    
    if (data.startsWith('vocab_sample_')) {
      const level = data.split('_')[2];
      await this.showVocabularySample(ctx, level);
    } else if (data === 'vocab_start_learning') {
      await this.showLevelSelector(ctx);
    } else if (data === 'vocab_back_to_overview') {
      await this.showVocabularyPreview(ctx);
    }
  }

  async showVocabularySample(ctx, level) {
    // Get random sample words from the specified level
    const sampleWords = await this.getVocabularySample(level, 10);
    
    if (sampleWords.length === 0) {
      await ctx.editMessageText(`❌ No words found for level ${level}.`);
      return;
    }

    const levelEmojis = { A1: '🟢', A2: '🟡', B1: '🟠' };
    const levelNames = { A1: 'Beginner', A2: 'Elementary', B1: 'Intermediate' };
    
    let message = `
${levelEmojis[level]} *${level} (${levelNames[level]}) - Sample Words*

Here are some words you'll learn at this level:

`;

    sampleWords.forEach((word, index) => {
      message += `${index + 1}. **${word.german_word}** - ${word.english_translation}\n`;
    });

    message += `\n*Total ${level} words available: ${await this.getLevelCount(level)}*`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback(`🎴 Start ${level} Quiz`, `level_select_${level}`)],
      [Markup.button.callback('🔙 Back to Overview', 'vocab_back_to_overview')]
    ]);

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup
    });
  }

  async getVocabularySample(level, limit = 10) {
    return new Promise((resolve, reject) => {
      this.db.db.all(`
        SELECT german_word, english_translation
        FROM vocabulary_simple 
        WHERE level = ?
        ORDER BY RANDOM()
        LIMIT ?
      `, [level, limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async getLevelCount(level) {
    return new Promise((resolve, reject) => {
      this.db.db.get(`
        SELECT COUNT(*) as count
        FROM vocabulary_simple 
        WHERE level = ?
      `, [level], (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
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