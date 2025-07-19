const { Markup } = require('telegraf');
const wordAnalyzer = require('../services/wordAnalyzer');

class FlashcardQuizHandler {
  constructor() {
    this.activeSessions = new Map(); // userId -> session data
  }

  async startFlashcardQuiz(ctx, db) {
    const userId = ctx.from.id;
    const userSettings = await db.getUserSettings(ctx.dbUser.id) || {};
    const cardsPerSession = userSettings.cards_per_session || 20;
    const preferredLevel = userSettings.preferred_level || 'A1';
    
    // Get vocabulary for flashcards from selected level
    const vocabulary = await this.getFlashcardVocabulary(db, userId, cardsPerSession, preferredLevel);
    
    if (vocabulary.length === 0) {
      await ctx.reply(`❌ No ${preferredLevel} vocabulary found for review. Try changing your level in /settings or check back later.`);
      return;
    }

    // Create session
    const sessionId = await db.createFlashcardSession(ctx.dbUser.id, vocabulary.length);
    
    const session = {
      sessionId,
      userId,
      vocabulary: vocabulary,
      currentCard: 0,
      cardsKnown: 0,
      cardsLearning: 0,
      startTime: Date.now(),
      userLevel: preferredLevel
    };

    this.activeSessions.set(userId, session);
    
    await this.showCurrentCard(ctx, db);
  }

  async getFlashcardVocabulary(db, userId, limit, preferredLevel = 'A1') {
    return new Promise((resolve, reject) => {
      // Get vocabulary that needs review, prioritizing difficult words from selected level
      db.db.all(`
        SELECT v.id, v.german_word, v.english_translation, v.level,
               COALESCE(fp.mastery_level, 0) as mastery_level,
               COALESCE(fp.times_shown, 0) as times_shown,
               COALESCE(fp.next_review, datetime('now')) as next_review
        FROM vocabulary_simple v
        LEFT JOIN flashcard_progress fp ON v.id = fp.vocabulary_id AND fp.user_id = ?
        WHERE v.level = ? AND (fp.next_review IS NULL OR fp.next_review <= datetime('now'))
        ORDER BY 
          fp.mastery_level ASC,
          fp.times_shown ASC,
          RANDOM()
        LIMIT ?
      `, [userId, preferredLevel, limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async showCurrentCard(ctx, db) {
    const userId = ctx.from.id;
    const session = this.activeSessions.get(userId);
    
    if (!session || session.currentCard >= session.vocabulary.length) {
      await this.endFlashcardSession(ctx, db);
      return;
    }

    const currentWord = session.vocabulary[session.currentCard];
    const cardNumber = session.currentCard + 1;
    const totalCards = session.vocabulary.length;

    const message = `
🎴 *Flashcard* ${cardNumber}/${totalCards} (${session.userLevel})

🇺🇸 *English:*
**${currentWord.english_translation}**

Think of the German word...
    `;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('👁️ View Answer', `flashcard_reveal_${currentWord.id}`)],
      [Markup.button.callback('❌ End Session', 'flashcard_end')]
    ]);

    if (session.currentCard === 0) {
      await ctx.replyWithMarkdown(message, keyboard);
    } else {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });
    }
  }

  async revealAnswer(ctx, db, vocabularyId) {
    const userId = ctx.from.id;
    const session = this.activeSessions.get(userId);
    
    if (!session) {
      await ctx.answerCbQuery('❌ Session expired');
      return;
    }

    const currentWord = session.vocabulary[session.currentCard];
    
    if (currentWord.id !== parseInt(vocabularyId)) {
      await ctx.answerCbQuery('❌ Card mismatch');
      return;
    }

    // Show loading message
    await ctx.answerCbQuery('🤖 Analyzing word...');
    
    try {
      // Get LLM analysis
      const analysis = await wordAnalyzer.analyzeWord(
        currentWord.german_word,
        currentWord.english_translation,
        session.userLevel
      );

      const cardNumber = session.currentCard + 1;
      const totalCards = session.vocabulary.length;

      let message = `
🎴 *Flashcard* ${cardNumber}/${totalCards} (${session.userLevel})

🇺🇸 *English:*
${currentWord.english_translation}

🇩🇪 *German:*
**${analysis.german_display}**
`;

      // Add pronunciation if available
      if (analysis.pronunciation) {
        message += `\n🔊 *Pronunciation:* /${analysis.pronunciation}/`;
      }

      // Add example sentence
      if (analysis.example_sentence) {
        message += `\n\n📝 *Example:*\n"${analysis.example_sentence}"`;
        if (analysis.example_translation) {
          message += `\n_"${analysis.example_translation}"_`;
        }
      }

      // Add grammar note
      if (analysis.grammar_note) {
        message += `\n\n💡 *Tip:* ${analysis.grammar_note}`;
      }

      // Add word type info
      const typeEmoji = this.getWordTypeEmoji(analysis.word_type);
      message += `\n\n${typeEmoji} *Type:* ${analysis.word_type}`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ I knew it', `flashcard_known_${currentWord.id}`),
          Markup.button.callback('❓ I\'m learning', `flashcard_learning_${currentWord.id}`)
        ],
        [Markup.button.callback('❌ End Session', 'flashcard_end')]
      ]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });

    } catch (error) {
      console.error('Word analysis failed:', error);
      
      // Fallback to simple display
      const message = `
🎴 *Flashcard* ${session.currentCard + 1}/${session.vocabulary.length}

🇺🇸 *English:* ${currentWord.english_translation}
🇩🇪 *German:* **${currentWord.german_word}**

_Analysis temporarily unavailable_
      `;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ I knew it', `flashcard_known_${currentWord.id}`),
          Markup.button.callback('❓ I\'m learning', `flashcard_learning_${currentWord.id}`)
        ],
        [Markup.button.callback('❌ End Session', 'flashcard_end')]
      ]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });
    }
  }

  getWordTypeEmoji(wordType) {
    const emojis = {
      'noun': '🏷️',
      'verb': '⚡',
      'adjective': '🎨',
      'adverb': '⚙️',
      'other': '📝'
    };
    return emojis[wordType] || '📝';
  }

  async handleCardResponse(ctx, db, vocabularyId, response) {
    const userId = ctx.from.id;
    const session = this.activeSessions.get(userId);
    
    if (!session) {
      await ctx.answerCbQuery('❌ Session expired');
      return;
    }

    const currentWord = session.vocabulary[session.currentCard];
    
    if (currentWord.id !== parseInt(vocabularyId)) {
      await ctx.answerCbQuery('❌ Card mismatch');
      return;
    }

    // Update progress
    await this.updateCardProgress(db, userId, vocabularyId, response);
    
    // Update session stats
    if (response === 'known') {
      session.cardsKnown++;
      await ctx.answerCbQuery('✅ Great!');
    } else {
      session.cardsLearning++;
      await ctx.answerCbQuery('📚 Keep practicing!');
    }

    // Move to next card
    session.currentCard++;
    
    // Small delay for better UX
    setTimeout(async () => {
      await this.showCurrentCard(ctx, db);
    }, 1000);
  }

  async updateCardProgress(db, userId, vocabularyId, response) {
    return new Promise((resolve, reject) => {
      const isCorrect = response === 'known';
      const masteryChange = isCorrect ? 1 : 0;
      const nextReview = this.calculateNextReview(isCorrect);

      db.db.run(`
        INSERT INTO flashcard_progress (
          user_id, vocabulary_id, times_shown, times_correct, times_incorrect,
          last_shown, mastery_level, next_review
        ) VALUES (?, ?, 1, ?, ?, datetime('now'), ?, datetime('now', ?))
        ON CONFLICT(user_id, vocabulary_id) DO UPDATE SET
          times_shown = times_shown + 1,
          times_correct = times_correct + ?,
          times_incorrect = times_incorrect + ?,
          last_shown = datetime('now'),
          mastery_level = MAX(0, MIN(5, mastery_level + ?)),
          next_review = datetime('now', ?)
      `, [
        userId, vocabularyId,
        isCorrect ? 1 : 0, isCorrect ? 0 : 1, masteryChange, nextReview,
        isCorrect ? 1 : 0, isCorrect ? 0 : 1, masteryChange, nextReview
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  calculateNextReview(isCorrect) {
    if (isCorrect) {
      // Spaced repetition: 1 day, 3 days, 1 week, 2 weeks, 1 month
      return '+1 day';
    } else {
      // Review again soon
      return '+1 hour';
    }
  }

  async endFlashcardSession(ctx, db) {
    const userId = ctx.from.id;
    const session = this.activeSessions.get(userId);
    
    if (!session) {
      await ctx.editMessageText('❌ No active session found.');
      return;
    }

    const duration = Math.round((Date.now() - session.startTime) / 1000);
    const totalCards = session.currentCard;
    const accuracy = totalCards > 0 ? Math.round((session.cardsKnown / totalCards) * 100) : 0;

    // Update session in database
    await this.updateFlashcardSession(db, session.sessionId, totalCards, session.cardsKnown);

    const message = `
🎉 *Flashcard Session Complete!*

📊 *Results:*
• Cards reviewed: ${totalCards}
• Cards you knew: ${session.cardsKnown}
• Cards you're learning: ${session.cardsLearning}
• Accuracy: ${accuracy}%
• Duration: ${duration} seconds

${this.getSessionMotivation(accuracy)}
    `;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔄 New Session', 'flashcard_start')],
      [Markup.button.callback('📊 Progress', 'progress_show')]
    ]);

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup
    });

    // Clean up session
    this.activeSessions.delete(userId);
  }

  getSessionMotivation(accuracy) {
    if (accuracy >= 90) return '🌟 Outstanding! You\'re mastering German!';
    if (accuracy >= 80) return '🎉 Excellent work! Keep it up!';
    if (accuracy >= 70) return '👍 Good progress! You\'re learning well!';
    if (accuracy >= 60) return '💪 Nice effort! Practice makes perfect!';
    return '🚀 Great start! Every word counts!';
  }

  async updateFlashcardSession(db, sessionId, totalCards, cardsKnown) {
    return new Promise((resolve, reject) => {
      db.db.run(`
        UPDATE flashcard_sessions SET
          cards_reviewed = ?,
          cards_known = ?,
          cards_learning = ?,
          completed_at = datetime('now')
        WHERE id = ?
      `, [totalCards, cardsKnown, totalCards - cardsKnown, sessionId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async handleFlashcardCallback(ctx, db) {
    const data = ctx.callbackQuery.data;
    const userId = ctx.from.id;
    
    if (data.startsWith('flashcard_reveal_')) {
      const vocabularyId = data.split('_')[2];
      await this.revealAnswer(ctx, db, vocabularyId);
    } else if (data.startsWith('flashcard_known_')) {
      const vocabularyId = data.split('_')[2];
      await this.handleCardResponse(ctx, db, vocabularyId, 'known');
    } else if (data.startsWith('flashcard_learning_')) {
      const vocabularyId = data.split('_')[2];
      await this.handleCardResponse(ctx, db, vocabularyId, 'learning');
    } else if (data === 'flashcard_start') {
      await this.startFlashcardQuiz(ctx, db);
    } else if (data === 'flashcard_end') {
      await this.endFlashcardSession(ctx, db);
    }
  }
}

module.exports = FlashcardQuizHandler;