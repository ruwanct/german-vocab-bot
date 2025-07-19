const { Markup } = require('telegraf');
const vocabularyManager = require('../services/vocabularyManager');
const dictionaryAPIs = require('../api/dictionaries');

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
      [Markup.button.callback('📊 Statistiken', 'admin_stats')],
      [Markup.button.callback('🔄 Vokabeln aktualisieren', 'admin_enrich')],
      [Markup.button.callback('🗑️ Cache leeren', 'admin_clear_cache')],
      [Markup.button.callback('🔍 API Status', 'admin_api_status')],
      [Markup.button.callback('📈 Quota Status', 'admin_quota')]
    ]);

    const message = `
🔧 *Admin Panel*

Management options for the German Vocab Bot:

📊 *Statistics*: Show database and cache statistics
🔄 *Update Vocabulary*: Load new vocabulary from APIs
🗑️ *Clear Cache*: Reset temporary storage
🔍 *API Status*: Check connection to PONS and Linguatools
📈 *Quota Status*: Show current API usage
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
      case 'admin_api_status':
        await this.showApiStatus(ctx, db);
        break;
      case 'admin_quota':
        await this.showQuotaStatus(ctx, db);
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
• API entries: ${stats.database.api_words}
• PONS entries: ${stats.database.pons_words}
• Linguatools entries: ${stats.database.linguatools_words}
• Categories: ${stats.database.categories}
• Levels: ${stats.database.levels}
• Average confidence: ${(stats.database.avg_confidence || 0).toFixed(2)}

💾 *Cache:*
• Cache entries: ${stats.cache.total_cached}
• Total accesses: ${stats.cache.total_accesses}
• Average accesses: ${(stats.cache.avg_accesses || 0).toFixed(1)}
• Memory Cache: ${stats.cache.memory_cache_size}/${stats.cache.memory_cache_max}

🔌 *API Quota:*
• PONS: ${stats.api_quota.pons.used}/${stats.api_quota.pons.limit}
• Linguatools: ${stats.api_quota.linguatools.used}/${stats.api_quota.linguatools.limit}
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
      await ctx.editMessageText(`❌ Fehler beim Laden der Statistiken: ${error.message}`);
    }
  }

  async enrichVocabulary(ctx, db) {
    try {
      await ctx.editMessageText('🔄 Vokabeln werden aktualisiert... Bitte warten.');
      
      await vocabularyManager.initialize();
      const result = await vocabularyManager.autoEnrichVocabulary(10);
      
      let message = `
✅ *Vokabeln Aktualisierung abgeschlossen*

📈 *Ergebnis:*
• New words added: ${result.enriched}
• Fehler: ${result.errors.length}
      `;

      if (result.errors.length > 0) {
        message += '\n\n❌ *Fehler:*\n';
        result.errors.slice(0, 5).forEach(error => {
          message += `• ${error.word}: ${error.error}\n`;
        });
        
        if (result.errors.length > 5) {
          message += `• ... und ${result.errors.length - 5} weitere Fehler`;
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
      await ctx.editMessageText(`❌ Fehler bei der Aktualisierung: ${error.message}`);
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
        [Markup.button.callback('📊 Statistiken', 'admin_stats')],
        [Markup.button.callback('🔙 Back', 'admin_back')]
      ]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });
    } catch (error) {
      await ctx.editMessageText(`❌ Fehler beim Leeren des Caches: ${error.message}`);
    }
  }

  async showApiStatus(ctx, db) {
    try {
      await ctx.editMessageText('🔍 API status is being checked... Please wait.');
      
      const status = await dictionaryAPIs.validateConnection();
      
      const message = `
🔍 *API Verbindungsstatus*

🌐 *PONS Dictionary API:*
• Status: ${status.pons.connected ? '✅ Verbunden' : '❌ Nicht verbunden'}
${status.pons.error ? `• Fehler: ${status.pons.error}` : ''}

🌐 *Linguatools Dictionary API:*
• Status: ${status.linguatools.connected ? '✅ Verbunden' : '❌ Nicht verbunden'}
${status.linguatools.error ? `• Fehler: ${status.linguatools.error}` : ''}

📊 *Empfehlung:*
${status.pons.connected && status.linguatools.connected ? 
  '✅ Alle APIs funktionieren optimal' : 
  '⚠️ Check the API keys in settings'}
      `;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Check Again', 'admin_api_status')],
        [Markup.button.callback('🔙 Back', 'admin_back')]
      ]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });
    } catch (error) {
      await ctx.editMessageText(`❌ Error checking API status: ${error.message}`);
    }
  }

  async showQuotaStatus(ctx, db) {
    try {
      const quotaStatus = dictionaryAPIs.getQuotaStatus();
      
      const message = `
📈 *API Quota Status*

🔵 *PONS Dictionary API:*
• Verwendet: ${quotaStatus.pons.used}/${quotaStatus.pons.limit}
• Verbleibend: ${quotaStatus.pons.remaining}
• Reset: ${quotaStatus.pons.resetDate.toLocaleDateString('de-DE')}
• Prozentsatz: ${Math.round((quotaStatus.pons.used / quotaStatus.pons.limit) * 100)}%

🟢 *Linguatools Dictionary API:*
• Verwendet: ${quotaStatus.linguatools.used}/${quotaStatus.linguatools.limit}
• Verbleibend: ${quotaStatus.linguatools.remaining}
• Reset: ${quotaStatus.linguatools.resetDate.toLocaleDateString('de-DE')}
• Prozentsatz: ${Math.round((quotaStatus.linguatools.used / quotaStatus.linguatools.limit) * 100)}%

📊 *Total available requests:*
${quotaStatus.pons.remaining + quotaStatus.linguatools.remaining} / 2000

${quotaStatus.pons.remaining + quotaStatus.linguatools.remaining < 100 ? 
  '⚠️ Warning: Quota almost exhausted!' : 
  '✅ Quota in good condition'}
      `;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Refresh', 'admin_quota')],
        [Markup.button.callback('🔙 Back', 'admin_back')]
      ]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });
    } catch (error) {
      await ctx.editMessageText(`❌ Fehler beim Laden der Quota: ${error.message}`);
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
      await ctx.reply(`❌ Fehler bei der Suche: ${error.message}`);
    }
  }
}

module.exports = new AdminHandler();