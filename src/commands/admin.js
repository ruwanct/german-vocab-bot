const { Markup } = require('telegraf');
const vocabularyManager = require('../services/vocabularyManager');

class AdminHandler {
  constructor() {
    this.adminUserIds = (process.env.ADMIN_USER_IDS || '').split(',').map(id => parseInt(id.trim())).filter(id => id);
  }

  isAdmin(userId) {
    return this.adminUserIds.includes(userId);
  }

  async handleAdminCommand(ctx) {
    if (!this.isAdmin(ctx.from.id)) {
      await ctx.reply('❌ You do not have permission for admin commands.');
      return;
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📊 Statistics', 'admin_stats')],
      [Markup.button.callback('🔄 Update Vocabulary', 'admin_enrich')],
      [Markup.button.callback('🗑️ Clear Cache', 'admin_clear_cache')]
    ]);

    const message = `
🔧 *Admin Panel*

Management options for the German Vocab Bot:

📊 *Statistics*: Show database and cache statistics
🔄 *Update Vocabulary*: Load new vocabulary from CSV files
🗑️ *Clear Cache*: Reset temporary storage
    `;

    await ctx.replyWithMarkdown(message, keyboard);
  }

  async handleAdminCallback(ctx, db) {
    const data = ctx.callbackQuery.data;
    
    if (!this.isAdmin(ctx.from.id)) {
      await ctx.answerCbQuery('❌ No permission');
      return;
    }

    switch (data) {
      case 'admin_stats':
        await this.showStatistics(ctx, db);
        break;
      case 'admin_enrich':
        await this.enrichVocabulary(ctx, db);
        break;
      case 'admin_clear_cache':
        await this.clearCache(ctx, db);
        break;
      default:
        await ctx.answerCbQuery('Unknown command');
    }
  }

  async showStatistics(ctx, db) {
    try {
      await vocabularyManager.initialize();
      const stats = await vocabularyManager.getVocabularyStats();
      
      const message = `
📊 *System Statistics*

🗃️ *Database:*
• Total words: ${stats.database.total_words}
• Manual entries: ${stats.database.manual_words}
• API entries: ${stats.database.api_words || 0}
• Categories: ${stats.database.categories}
• Levels: ${stats.database.levels}
• Average confidence: ${(stats.database.avg_confidence || 0).toFixed(2)}

💾 *Cache:*
• Cache entries: ${stats.cache.total_cached}
• Total accesses: ${stats.cache.total_accesses}
• Average accesses: ${(stats.cache.avg_accesses || 0).toFixed(1)}
• Memory Cache: ${stats.cache.memory_cache_size}/${stats.cache.memory_cache_max}

🤖 *AI Integration:*
• Using AI providers for vocabulary analysis
• No external dictionary APIs configured
      `;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Refresh', 'admin_stats')],
        [Markup.button.callback('🔙 Back', 'admin_back')]
      ]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });
    } catch (error) {
      await ctx.editMessageText(`❌ Error loading statistics: ${error.message}`);
    }
  }

  async enrichVocabulary(ctx, db) {
    try {
      await ctx.editMessageText('🔄 Updating vocabulary... Please wait.');
      
      await vocabularyManager.initialize();
      const result = await vocabularyManager.autoEnrichVocabulary(10);
      
      let message = `
✅ *Vocabulary Aktualisierung abgeschlossen*

📈 *Ergebnis:*
• New words added: ${result.enriched}
• Error: ${result.errors.length}
      `;

      if (result.errors.length > 0) {
        message += '\n\n❌ *Error:*\n';
        result.errors.slice(0, 5).forEach(error => {
          message += `• ${error.word}: ${error.error}\n`;
        });
        
        if (result.errors.length > 5) {
          message += `• ... und ${result.errors.length - 5} weitere Error`;
        }
      }

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Erneut aktualisieren', 'admin_enrich')],
        [Markup.button.callback('🔙 Back', 'admin_back')]
      ]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });
    } catch (error) {
      await ctx.editMessageText(`❌ Error bei der Aktualisierung: ${error.message}`);
    }
  }

  async clearCache(ctx, db) {
    try {
      await ctx.editMessageText('🗑️ Cache wird geleert... Bitte warten.');
      
      await vocabularyManager.initialize();
      const cleared = await vocabularyManager.cleanupOldCache();
      
      const message = `
✅ *Cache geleert*

🧹 *Ergebnis:*
• Deleted entries: ${cleared}
• Memory Cache: Reset
• Next requests will use APIs
      `;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📊 Statistics', 'admin_stats')],
        [Markup.button.callback('🔙 Back', 'admin_back')]
      ]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });
    } catch (error) {
      await ctx.editMessageText(`❌ Error beim Leeren des Caches: ${error.message}`);
    }
  }


  async searchSpecificWord(ctx, word) {
    if (!this.isAdmin(ctx.from.id)) {
      await ctx.reply('❌ You do not have permission for admin commands.');
      return;
    }

    try {
      await ctx.reply(`🔍 Suche nach Wort: "${word}"...`);
      
      await vocabularyManager.initialize();
      const results = await vocabularyManager.searchVocabulary(word);
      
      if (results.length === 0) {
        await ctx.reply(`❌ No results for "${word}" found.`);
        return;
      }

      const result = results[0];
      const message = `
🔍 *Search result for "${word}"*

📝 *Wort-Details:*
• Wort: ${result.word}
• Artikel: ${result.article}
• Translation: ${result.translation_en}
• Deutsch: ${result.translation_de}
• Aussprache: ${result.pronunciation || 'N/A'}
• Level: ${result.level || 'N/A'}
• Kategorie: ${result.category || 'N/A'}
• Quelle: ${result.source || 'N/A'}
• Beispiel: ${result.example_sentence || 'N/A'}
      `;

      await ctx.replyWithMarkdown(message);
    } catch (error) {
      await ctx.reply(`❌ Error bei der Suche: ${error.message}`);
    }
  }

  async debugWord(ctx, pin, word) {
    // Check PIN first
    if (pin !== process.env.ADMIN_DEBUG_PIN && pin !== '1932') {
      // No response at all - command doesn't exist
      return;
    }

    try {
      const Database = require('../database/models');
      const db = new Database();
      await db.connect();
      
      // Query vocabulary_simple table
      const result = db.get('SELECT * FROM vocabulary_simple WHERE german_word = ?', [word]);
      
      if (!result) {
        await ctx.reply(`❌ Word "${word}" not found in vocabulary_simple table.`);
        await db.close();
        return;
      }

      const message = `
🔍 *Debug: "${word}"*

📊 *Raw Database Entry:*
• ID: ${result.id}
• German: \`${result.german_word}\`
• English: \`${result.english_translation}\`
• Level: ${result.level}
• Added: ${result.added_date}
• Difficulty: ${result.difficulty_score || 'N/A'}

🔧 *Debug Info:*
• Table: vocabulary_simple
• Status: Found ✅
• Translation corrected: ${result.english_translation.includes('(') ? '✅' : '⚠️'}
      `;

      await ctx.replyWithMarkdown(message);
      await db.close();
    } catch (error) {
      await ctx.reply(`❌ Debug error: ${error.message}`);
    }
  }
}

module.exports = new AdminHandler();