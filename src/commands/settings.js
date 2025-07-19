const { Markup } = require('telegraf');

class SettingsHandler {
  async showSettings(ctx, db) {
    const settings = await db.getUserSettings(ctx.dbUser.id) || {};
    const currentLevel = settings.preferred_level || 'A1';
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📚 Learning Level', 'settings_level')],
      [Markup.button.callback('📝 Quiz Settings', 'settings_quiz')],
      [Markup.button.callback('🔔 Notifications', 'settings_notifications')],
      [Markup.button.callback('🎯 Learning Goals', 'settings_goals')],
      [Markup.button.callback('🌐 Language', 'settings_language')],
      [Markup.button.callback('📊 Data & Privacy', 'settings_privacy')]
    ]);

    const message = `
⚙️ *Settings*

*Current Level:* ${currentLevel}

Personalize your learning experience:

📚 *Learning Level*: Choose A1, A2, or B1
📝 *Quiz Settings*: Difficulty, questions per session
🔔 *Notifications*: Reminders and schedules
🎯 *Learning Goals*: Daily goals and progress targets
🌐 *Language*: Change interface language
📊 *Data & Privacy*: Export or delete your data
    `;

    await ctx.replyWithMarkdown(message, keyboard);
  }

  async handleSettingsCallback(ctx, db) {
    const data = ctx.callbackQuery.data;
    const userId = ctx.from.id;
    
    if (data === 'settings_level') {
      await this.showLevelSettings(ctx, db);
    } else if (data === 'settings_quiz') {
      await this.showQuizSettings(ctx, db);
    } else if (data === 'settings_notifications') {
      await this.showNotificationSettings(ctx, db);
    } else if (data === 'settings_goals') {
      await this.showGoalSettings(ctx, db);
    } else if (data === 'settings_language') {
      await this.showLanguageSettings(ctx, db);
    } else if (data === 'settings_privacy') {
      await this.showPrivacySettings(ctx, db);
    } else if (data === 'settings_export') {
      await this.exportUserData(ctx, db);
    } else if (data === 'settings_delete_data') {
      await this.showDataDeletionConfirm(ctx, db);
    } else if (data === 'settings_delete_confirm') {
      await this.deleteUserData(ctx, db);
    } else if (data === 'settings_back') {
      await this.showSettings(ctx, db);
    } else if (data.startsWith('settings_set_')) {
      await this.handleSettingChange(ctx, db, data);
    }
  }

  async showLevelSettings(ctx, db) {
    const settings = await db.getUserSettings(ctx.dbUser.id) || {};
    const currentLevel = settings.preferred_level || 'A1';
    
    // Get vocabulary count for each level
    const levelStats = await this.getLevelStatistics(db);
    
    const message = `
📚 *Learning Level*

*Current Level:* ${currentLevel}

Choose your learning level:

🟢 *A1 (Beginner)*
• Basic vocabulary and phrases
• ${levelStats.A1 || 0} words available

🟡 *A2 (Elementary)*  
• Expanded vocabulary
• ${levelStats.A2 || 0} words available

🟠 *B1 (Intermediate)*
• Advanced vocabulary
• ${levelStats.B1 || 0} words available

Your flashcards will show words from the selected level.
    `;

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback(currentLevel === 'A1' ? '✅ A1' : 'A1', 'settings_set_level_A1'),
        Markup.button.callback(currentLevel === 'A2' ? '✅ A2' : 'A2', 'settings_set_level_A2'),
        Markup.button.callback(currentLevel === 'B1' ? '✅ B1' : 'B1', 'settings_set_level_B1')
      ],
      [Markup.button.callback('🔙 Back', 'settings_back')]
    ]);

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup
    });
  }

  async getLevelStatistics(db) {
    const rows = db.all(`
      SELECT level, COUNT(*) as count
      FROM vocabulary_simple
      GROUP BY level
    `);
    
    const stats = {};
    rows.forEach(row => {
      stats[row.level] = row.count;
    });
    
    return stats;
  }

  async showQuizSettings(ctx, db) {
    const userId = ctx.from.id;
    const settings = await db.getUserSettings(ctx.dbUser.id) || {};
    
    const message = `
📝 *Quiz Settings*

*Current Settings:*
• Questions per session: ${settings.questions_per_session || 10}
• Difficulty: ${settings.quiz_difficulty || 'medium'}
• Timeout: ${settings.timeout_seconds || 30}s

Choose an option to change:
    `;

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('5 Questions', 'settings_set_questions_5'),
        Markup.button.callback('10 Questions', 'settings_set_questions_10'),
        Markup.button.callback('15 Questions', 'settings_set_questions_15')
      ],
      [
        Markup.button.callback('Easy', 'settings_set_difficulty_easy'),
        Markup.button.callback('Medium', 'settings_set_difficulty_medium'),
        Markup.button.callback('Hard', 'settings_set_difficulty_hard')
      ],
      [Markup.button.callback('🔙 Back', 'settings_back')]
    ]);

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup
    });
  }

  async showNotificationSettings(ctx, db) {
    const userId = ctx.from.id;
    const settings = await db.getUserSettings(ctx.dbUser.id) || {};
    
    const message = `
🔔 *Notifications*

*Current Settings:*
• Notifications: ${settings.notifications_enabled ? '✅ Enabled' : '❌ Disabled'}
• Preferred time: ${settings.preferred_time || '18:00'}
• Daily reminders: ${settings.daily_reminders ? '✅ Enabled' : '❌ Disabled'}

Choose an option:
    `;

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback(
          settings.notifications_enabled ? '❌ Disable' : '✅ Enable',
          `settings_set_notifications_${!settings.notifications_enabled}`
        )
      ],
      [
        Markup.button.callback('🕘 09:00', 'settings_set_time_09:00'),
        Markup.button.callback('🕕 18:00', 'settings_set_time_18:00'),
        Markup.button.callback('🕘 21:00', 'settings_set_time_21:00')
      ],
      [Markup.button.callback('🔙 Back', 'settings_back')]
    ]);

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup
    });
  }

  async showGoalSettings(ctx, db) {
    const userId = ctx.from.id;
    const settings = await db.getUserSettings(ctx.dbUser.id) || {};
    
    const message = `
🎯 *Learning Goals*

*Current Settings:*
• Daily goal: ${settings.daily_goal || 20} questions
• Weekly goal: ${settings.weekly_goal || 100} questions  
• Streak goal: ${settings.streak_goal || 7} days

Choose your new goal:
    `;

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('10/Tag', 'settings_set_daily_10'),
        Markup.button.callback('20/Tag', 'settings_set_daily_20'),
        Markup.button.callback('30/Tag', 'settings_set_daily_30')
      ],
      [
        Markup.button.callback('50/Woche', 'settings_set_weekly_50'),
        Markup.button.callback('100/Woche', 'settings_set_weekly_100'),
        Markup.button.callback('150/Woche', 'settings_set_weekly_150')
      ],
      [Markup.button.callback('🔙 Back', 'settings_back')]
    ]);

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup
    });
  }

  async showLanguageSettings(ctx, db) {
    const userId = ctx.from.id;
    const settings = await db.getUserSettings(ctx.dbUser.id) || {};
    
    const message = `
🌐 *Language*

*Current Language:* English

*Available Languages:*
• 🇺🇸 English (Default)

Interface language for the bot.
    `;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🇺🇸 English', 'settings_set_lang_en')],
      [Markup.button.callback('🔙 Back', 'settings_back')]
    ]);

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup
    });
  }

  async showPrivacySettings(ctx, db) {
    const consentInfo = await db.getUserConsentInfo(ctx.dbUser.id);
    const consentDate = consentInfo?.data_consent_date ? 
      new Date(consentInfo.data_consent_date).toLocaleDateString() : 'Not recorded';
    
    const message = `
📊 *Data & Privacy*

*Your Data Status:*
• Consent given: ${consentInfo?.data_consent_given ? '✅ Yes' : '❌ No'}
• Consent date: ${consentDate}
• Privacy policy: ${consentInfo?.privacy_policy_accepted ? '✅ Accepted' : '❌ Not accepted'}

*Available Actions:*
• Export your data (GDPR compliant)
• Delete all your data permanently
• View privacy policy
• Withdraw consent (disables bot)

⚠️ *Important:* Deleting your data cannot be undone.
    `;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📎 Export Data', 'settings_export')],
      [Markup.button.callback('🗑️ Delete My Data', 'settings_delete_data')],
      [Markup.button.callback('📋 Privacy Policy', 'consent_privacy_policy')],
      [Markup.button.callback('🔙 Back', 'settings_back')]
    ]);

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup
    });
  }

  async showDataDeletionConfirm(ctx, db) {
    const message = `
🗑️ *Delete All Data*

⚠️ *WARNING: This action cannot be undone!*

This will permanently delete:
• All your quiz progress and scores
• Vocabulary mastery levels and statistics
• Learning preferences and settings
• Quiz session history
• Your user account

After deletion:
• You will need to give consent again to use the bot
• All progress will be lost
• This action complies with GDPR "Right to be forgotten"

Are you absolutely sure?
    `;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('❌ Cancel', 'settings_privacy')],
      [Markup.button.callback('🗑️ Yes, Delete Everything', 'settings_delete_confirm')]
    ]);

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup
    });
  }

  async deleteUserData(ctx, db) {
    try {
      const userId = ctx.dbUser.id;
      
      // Delete all user data from all tables
      db.run('DELETE FROM flashcard_progress WHERE user_id = ?', [userId]);
      db.run('DELETE FROM user_progress WHERE user_id = ?', [userId]);
      db.run('DELETE FROM quiz_sessions WHERE user_id = ?', [userId]);
      db.run('DELETE FROM flashcard_sessions WHERE user_id = ?', [userId]);
      db.run('DELETE FROM user_settings WHERE user_id = ?', [userId]);
      db.run('DELETE FROM users WHERE id = ?', [userId]);

      await ctx.editMessageText(
        `✅ *Data Deleted Successfully*\n\nAll your data has been permanently deleted from our system.\n\nTo use the bot again, you'll need to give consent by typing /start.\n\nThank you for using German Vocab Bot!`,
        { parse_mode: 'Markdown' }
      );

    } catch (error) {
      console.error('Data deletion error:', error);
      await ctx.editMessageText('❌ Error deleting data. Please try again later or contact support.');
    }
  }

  async exportUserData(ctx, db) {
    const userId = ctx.from.id;
    
    try {
      const userData = await this.getUserDataForExport(db, ctx.dbUser.id);
      const exportData = JSON.stringify(userData, null, 2);
      
      const message = `
📊 *Data Export*

Your learning data is ready for export:

*Included Data:*
• Progress data: ${userData.progress?.length || 0} entries
• Quiz sessions: ${userData.sessions?.length || 0} sessions
• Settings: ✅ Included
• Statistics: ✅ Included

Data will be provided as a JSON file.
      `;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Back', 'settings_privacy')]
      ]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });

      await ctx.replyWithDocument({
        source: Buffer.from(exportData, 'utf8'),
        filename: `german-vocab-bot-export-${userId}-${Date.now()}.json`
      });

    } catch (error) {
      console.error('Export error:', error);
      await ctx.editMessageText('❌ Error exporting data. Please try again later.');
    }
  }

  async handleSettingChange(ctx, db, data) {
    const userId = ctx.from.id;
    const parts = data.split('_');
    const setting = parts[2];
    const value = parts[3];
    
    try {
      const currentSettings = await db.getUserSettings(ctx.dbUser.id) || {};
      const newSettings = { ...currentSettings };
      
      switch (setting) {
        case 'level':
          newSettings.preferred_level = value;
          break;
        case 'questions':
          newSettings.questions_per_session = parseInt(value);
          break;
        case 'difficulty':
          newSettings.quiz_difficulty = value;
          break;
        case 'notifications':
          newSettings.notifications_enabled = value === 'true';
          break;
        case 'time':
          newSettings.preferred_time = value;
          break;
        case 'daily':
          newSettings.daily_goal = parseInt(value);
          break;
        case 'weekly':
          newSettings.weekly_goal = parseInt(value);
          break;
        case 'lang':
          newSettings.interface_language = value;
          break;
      }
      
      await db.updateUserSettings(ctx.dbUser.id, newSettings);
      
      await ctx.editMessageText(
        `✅ Setting successfully changed!\n\n${this.getSettingDescription(setting, value)}`,
        {
          parse_mode: 'Markdown',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Back to Settings', 'settings_back')]
          ]).reply_markup
        }
      );
      
    } catch (error) {
      console.error('Setting change error:', error);
      await ctx.editMessageText('❌ Error changing setting. Please try again later.');
    }
  }

  async getUserDataForExport(db, userId) {
    const progress = await db.getUserProgress(userId);
    
    const sessions = db.all(
      'SELECT * FROM quiz_sessions WHERE user_id = ? ORDER BY started_at DESC',
      [userId]
    );

    const settings = await db.getUserSettings(userId);
    
    return {
      exportDate: new Date().toISOString(),
      progress,
      sessions,
      settings,
      statistics: {
        totalSessions: sessions.length,
        totalQuestions: sessions.reduce((sum, s) => sum + (s.total_questions || 0), 0),
        totalCorrect: sessions.reduce((sum, s) => sum + (s.correct_answers || 0), 0),
        wordsLearned: progress.length,
        averageAccuracy: this.calculateAverageAccuracy(sessions)
      }
    };
  }

  calculateAverageAccuracy(sessions) {
    if (sessions.length === 0) return 0;
    
    const totalQuestions = sessions.reduce((sum, s) => sum + (s.total_questions || 0), 0);
    const totalCorrect = sessions.reduce((sum, s) => sum + (s.correct_answers || 0), 0);
    
    return totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  }

  getSettingDescription(setting, value) {
    switch (setting) {
      case 'level':
        return `Learning level changed to: ${value}`;
      case 'questions':
        return `Questions per quiz session: ${value}`;
      case 'difficulty':
        return `Difficulty: ${value}`;
      case 'notifications':
        return `Notifications: ${value === 'true' ? 'Enabled' : 'Disabled'}`;
      case 'time':
        return `Preferred time: ${value}`;
      case 'daily':
        return `Daily goal: ${value} questions`;
      case 'weekly':
        return `Weekly goal: ${value} questions`;
      case 'lang':
        return `Language: ${value}`;
      default:
        return 'Setting changed';
    }
  }
}

module.exports = SettingsHandler;