const { Markup } = require('telegraf');

class ProgressHandler {
  async showProgress(ctx) {
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📊 Overall Progress', 'progress_overall')],
      [Markup.button.callback('📈 Recent Activity', 'progress_recent')],
      [Markup.button.callback('🏆 Best Scores', 'progress_best')],
      [Markup.button.callback('📅 Weekly Report', 'progress_weekly')]
    ]);

    const message = `
📊 *Progress & Statistics*

Choose an option to view your learning progress:

📊 *Overall Progress*: All statistics
📈 *Recent Activity*: Latest quiz results
🏆 *Best Scores*: Your records
📅 *Weekly Report*: This week's progress
    `;

    await ctx.replyWithMarkdown(message, keyboard);
  }

  async handleProgressCallback(ctx, db) {
    const data = ctx.callbackQuery.data;
    const userId = ctx.from.id;
    
    if (data === 'progress_overall') {
      await this.showOverallProgress(ctx, db);
    } else if (data === 'progress_recent') {
      await this.showRecentActivity(ctx, db);
    } else if (data === 'progress_best') {
      await this.showBestScores(ctx, db);
    } else if (data === 'progress_weekly') {
      await this.showWeeklyReport(ctx, db);
    } else if (data === 'progress_show') {
      await this.showProgress(ctx);
    }
  }

  async showOverallProgress(ctx, db) {
    const userId = ctx.from.id;
    const flashcardProgress = db.all(`
      SELECT 
        fp.*,
        v.german_word,
        v.english_translation,
        v.level
      FROM flashcard_progress fp
      JOIN vocabulary_simple v ON fp.vocabulary_id = v.id
      WHERE fp.user_id = ? AND fp.times_shown > 0
    `, [ctx.dbUser.id]);
    
    if (flashcardProgress.length === 0) {
      await ctx.editMessageText('📊 Overall Progress\n\nYou haven\'t played any quizzes yet. Start with /quiz!');
      return;
    }

    const totalWords = flashcardProgress.length;
    const masteredWords = flashcardProgress.filter(p => p.mastery_level >= 4).length;
    const totalQuestions = flashcardProgress.reduce((sum, p) => sum + p.times_shown, 0);
    const totalCorrect = flashcardProgress.reduce((sum, p) => sum + p.times_correct, 0);
    const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

    const categoryStats = this.calculateCategoryStats(flashcardProgress);
    const levelStats = this.calculateLevelStats(flashcardProgress);

    const message = `📊 Overall Progress

🎯 Overview:
• Words practiced: ${totalWords}
• Words mastered: ${masteredWords}
• Overall accuracy: ${accuracy}%
• Total flashcards shown: ${totalQuestions}

🎓 By Mastery Level:
${categoryStats}

📚 By Difficulty Level:
${levelStats}

${this.getProgressMotivation(accuracy)}`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔄 New Quiz', 'quiz_start_articles')],
      [Markup.button.callback('🔙 Back', 'progress_show')]
    ]);

    await ctx.editMessageText(message, {
      reply_markup: keyboard.reply_markup
    });
  }

  async showRecentActivity(ctx, db) {
    const userId = ctx.from.id;
    
    const recentSessions = db.all(`
      SELECT 
        id,
        total_cards as total_questions,
        cards_known as correct_answers,
        'flashcards' as session_type,
        started_at,
        completed_at
      FROM flashcard_sessions 
      WHERE user_id = ? AND completed_at IS NOT NULL 
      ORDER BY completed_at DESC 
      LIMIT 10
    `, [ctx.dbUser.id]);

    if (recentSessions.length === 0) {
      await ctx.editMessageText('📈 Recent Activity\n\nNo quiz sessions found. Start with /quiz!');
      return;
    }

    let message = '📈 Recent Activity\n\n';
    
    recentSessions.forEach((session, index) => {
      const date = new Date(session.completed_at).toLocaleDateString('de-DE');
      const time = new Date(session.completed_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      const accuracy = session.total_questions > 0 ? 
        Math.round((session.correct_answers / session.total_questions) * 100) : 0;
      
      message += `${index + 1}. ${session.session_type} (${date} ${time})\n`;
      message += `   ${session.correct_answers}/${session.total_questions} (${accuracy}%)\n\n`;
    });

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔄 New Quiz', 'quiz_start_articles')],
      [Markup.button.callback('🔙 Back', 'progress_show')]
    ]);

    await ctx.editMessageText(message, {
      reply_markup: keyboard.reply_markup
    });
  }

  async showBestScores(ctx, db) {
    const userId = ctx.from.id;
    
    const bestScores = db.all(`
      SELECT 
        'flashcards' as session_type,
        MAX(cards_known) as best_correct,
        MAX(total_cards) as total_questions,
        MAX(ROUND((cards_known * 100.0) / NULLIF(total_cards, 0))) as best_accuracy
      FROM flashcard_sessions 
      WHERE user_id = ? AND completed_at IS NOT NULL 
      ORDER BY best_accuracy DESC
    `, [ctx.dbUser.id]);

    if (bestScores.length === 0) {
      await ctx.editMessageText('🏆 Best Scores\n\nNo quiz sessions found. Start with /quiz!');
      return;
    }

    let message = '🏆 Best Scores\n\n';
    
    bestScores.forEach((score, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
      message += `${medal} ${score.session_type}\n`;
      message += `   Best Accuracy: ${score.best_accuracy}%\n`;
      message += `   Best Score: ${score.best_correct}/${score.total_questions}\n\n`;
    });

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔄 New Quiz', 'quiz_start_articles')],
      [Markup.button.callback('🔙 Back', 'progress_show')]
    ]);

    await ctx.editMessageText(message, {
      reply_markup: keyboard.reply_markup
    });
  }

  async showWeeklyReport(ctx, db) {
    const userId = ctx.from.id;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const weeklyData = db.all(`
      SELECT 
        COUNT(*) as sessions_count,
        SUM(total_cards) as total_questions,
        SUM(cards_known) as correct_answers,
        'flashcards' as session_type
      FROM flashcard_sessions 
      WHERE user_id = ? AND completed_at > ? 
    `, [ctx.dbUser.id, weekAgo]);

    if (weeklyData.length === 0) {
      await ctx.editMessageText('📅 Weekly Report\n\nNo activity in the last 7 days. Start with /quiz!');
      return;
    }

    const totalSessions = weeklyData.reduce((sum, d) => sum + d.sessions_count, 0);
    const totalQuestions = weeklyData.reduce((sum, d) => sum + d.total_questions, 0);
    const totalCorrect = weeklyData.reduce((sum, d) => sum + d.correct_answers, 0);
    const weeklyAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

    let message = `📅 Weekly Report

📊 Last 7 Days:
• Quiz Sessions: ${totalSessions}
• Total Questions: ${totalQuestions}
• Correct Answers: ${totalCorrect}
• Accuracy: ${weeklyAccuracy}%

📈 By Quiz Type:
`;

    weeklyData.forEach(data => {
      const accuracy = data.total_questions > 0 ? 
        Math.round((data.correct_answers / data.total_questions) * 100) : 0;
      message += `• ${data.session_type}: ${data.sessions_count} Sessions, ${accuracy}% Accuracy\n`;
    });

    message += `\n${this.getWeeklyMotivation(totalSessions, weeklyAccuracy)}`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔄 New Quiz', 'quiz_start_articles')],
      [Markup.button.callback('🔙 Back', 'progress_show')]
    ]);

    await ctx.editMessageText(message, {
      reply_markup: keyboard.reply_markup
    });
  }

  calculateCategoryStats(flashcardProgress) {
    const masteryLevels = {};
    
    flashcardProgress.forEach(progress => {
      const level = progress.mastery_level;
      const levelName = this.getMasteryLevelName(level);
      if (!masteryLevels[levelName]) {
        masteryLevels[levelName] = {
          total: 0,
          correct: 0,
          shown: 0
        };
      }
      masteryLevels[levelName].total++;
      masteryLevels[levelName].correct += progress.times_correct;
      masteryLevels[levelName].shown += progress.times_shown;
    });

    let result = '';
    Object.entries(masteryLevels).forEach(([level, stats]) => {
      const accuracy = stats.shown > 0 ? 
        Math.round((stats.correct / stats.shown) * 100) : 0;
      result += `• ${level}: ${stats.total} words (${accuracy}%)\n`;
    });

    return result || '• No progress data found\n';
  }

  calculateLevelStats(flashcardProgress) {
    const levels = {};
    
    flashcardProgress.forEach(progress => {
      const level = progress.level || 'A1';
      if (!levels[level]) {
        levels[level] = {
          total: 0,
          correct: 0,
          shown: 0
        };
      }
      levels[level].total++;
      levels[level].correct += progress.times_correct;
      levels[level].shown += progress.times_shown;
    });

    let result = '';
    Object.entries(levels).forEach(([level, stats]) => {
      const accuracy = stats.shown > 0 ? 
        Math.round((stats.correct / stats.shown) * 100) : 0;
      result += `• ${level}: ${stats.total} words (${accuracy}%)\n`;
    });

    return result || '• No levels found\n';
  }

  getMasteryLevelName(level) {
    switch(level) {
      case 0: return 'New';
      case 1: return 'Level 1';
      case 2: return 'Level 2';
      case 3: return 'Level 3';
      case 4: return 'Level 4';
      case 5: return 'Mastered';
      default: return 'Unknown';
    }
  }

  getProgressMotivation(accuracy) {
    if (accuracy >= 90) return '🌟 Fantastic! You are a German vocabulary master!';
    if (accuracy >= 80) return '🎉 Excellent! You are making great progress!';
    if (accuracy >= 70) return '👍 Well done! You are on the right track!';
    if (accuracy >= 60) return '💪 Keep going! You will get better with practice!';
    return '🚀 Every beginning is hard. Keep it up!';
  }

  getWeeklyMotivation(sessions, accuracy) {
    if (sessions >= 10 && accuracy >= 80) return '🏆 Incredible! You were very active and successful this week!';
    if (sessions >= 5 && accuracy >= 70) return '🎯 Great! You had a productive week!';
    if (sessions >= 3) return '👍 Good! You are staying consistent!';
    if (sessions >= 1) return '🌱 A good start! Try a few more quizzes this week!';
    return '💭 This week was quiet. How about a new quiz?';
  }
}

module.exports = new ProgressHandler();