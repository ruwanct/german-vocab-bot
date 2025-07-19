const { Markup } = require('telegraf');
const FlashcardQuizHandler = require('./flashcardQuiz');

class QuizHandler {
  constructor() {
    this.flashcardHandler = new FlashcardQuizHandler();
  }

  async startQuiz(ctx, db) {
    // Redirect to flashcard system
    await this.flashcardHandler.startFlashcardQuiz(ctx, db);
  }

  async handleQuizCallback(ctx, db, activeQuizzes) {
    // Redirect all quiz callbacks to flashcard system
    await this.flashcardHandler.handleFlashcardCallback(ctx, db);
  }
}

module.exports = QuizHandler;