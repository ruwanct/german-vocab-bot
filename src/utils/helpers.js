const crypto = require('crypto');

class Utils {
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  generateSessionId() {
    return crypto.randomBytes(16).toString('hex');
  }

  calculateAccuracy(correct, total) {
    if (total === 0) return 0;
    return Math.round((correct / total) * 100);
  }

  formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  }

  formatDate(date) {
    return new Date(date).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  formatTime(date) {
    return new Date(date).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDateTime(date) {
    return `${this.formatDate(date)} ${this.formatTime(date)}`;
  }

  getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  getRandomElements(array, count) {
    const shuffled = this.shuffleArray(array);
    return shuffled.slice(0, count);
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  generateProgressEmoji(percentage) {
    if (percentage >= 90) return '🌟';
    if (percentage >= 80) return '🎉';
    if (percentage >= 70) return '👍';
    if (percentage >= 60) return '💪';
    return '🚀';
  }

  generateStreakEmoji(streak) {
    if (streak >= 30) return '🔥';
    if (streak >= 14) return '⚡';
    if (streak >= 7) return '✨';
    if (streak >= 3) return '💫';
    return '⭐';
  }

  getDifficultyMultiplier(difficulty) {
    switch (difficulty) {
      case 'easy': return 0.8;
      case 'medium': return 1.0;
      case 'hard': return 1.2;
      default: return 1.0;
    }
  }

  calculateXPGain(correct, total, difficulty = 'medium') {
    const baseXP = 10;
    const accuracyBonus = this.calculateAccuracy(correct, total) / 100;
    const difficultyMultiplier = this.getDifficultyMultiplier(difficulty);
    
    return Math.round(baseXP * correct * accuracyBonus * difficultyMultiplier);
  }

  isValidArticle(article) {
    return ['der', 'die', 'das'].includes(article);
  }

  sanitizeInput(input) {
    return input.toString().trim().toLowerCase();
  }

  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  escapeMarkdown(text) {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
  }

  generateQuizSummary(session) {
    const accuracy = this.calculateAccuracy(session.correctAnswers, session.totalQuestions);
    const emoji = this.generateProgressEmoji(accuracy);
    
    return {
      emoji,
      accuracy,
      correctAnswers: session.correctAnswers,
      totalQuestions: session.totalQuestions,
      duration: this.formatDuration(Math.round((Date.now() - session.startTime) / 1000)),
      grade: this.getGrade(accuracy)
    };
  }

  getGrade(accuracy) {
    if (accuracy >= 90) return 'A+';
    if (accuracy >= 80) return 'A';
    if (accuracy >= 70) return 'B';
    if (accuracy >= 60) return 'C';
    if (accuracy >= 50) return 'D';
    return 'F';
  }

  generateMotivationalMessage(accuracy, streak = 0) {
    const messages = {
      high: [
        'Fantastic! You are a true vocabulary master! 🌟',
        'Incredible! Your German skills are impressive! 🎉',
        'Perfect! You master the articles like a pro! 👑'
      ],
      medium: [
        'Very good! You are making great progress! 👍',
        'Great! You are on the right track! 🎯',
        'Keep it up! Your efforts are paying off! 💪'
      ],
      low: [
        'Well done! Practice makes perfect! 🚀',
        'Keep practicing! Every step takes you further! 🌱',
        'Keep your head up! You are getting better! 💫'
      ]
    };

    let category = 'low';
    if (accuracy >= 80) category = 'high';
    else if (accuracy >= 60) category = 'medium';

    const baseMessage = this.getRandomElement(messages[category]);
    
    if (streak >= 7) {
      return `${baseMessage} And your ${streak}-day streak is impressive! ${this.generateStreakEmoji(streak)}`;
    }
    
    return baseMessage;
  }

  generateWeeklyInsights(weeklyData) {
    const insights = [];
    
    if (weeklyData.totalSessions > 10) {
      insights.push('🔥 You were very active this week!');
    }
    
    if (weeklyData.averageAccuracy > 80) {
      insights.push('🎯 Your accuracy is excellent!');
    }
    
    if (weeklyData.improvementRate > 10) {
      insights.push('📈 You are making great progress!');
    }
    
    if (weeklyData.consistentDays >= 5) {
      insights.push('⭐ You are very consistent in learning!');
    }
    
    return insights.length > 0 ? insights : ['💪 Keep it up! Every day gets better!'];
  }

  calculateStreak(sessions) {
    if (sessions.length === 0) return 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let streak = 0;
    let currentDate = new Date(today);
    
    for (let i = 0; i < sessions.length; i++) {
      const sessionDate = new Date(sessions[i].completed_at);
      sessionDate.setHours(0, 0, 0, 0);
      
      if (sessionDate.getTime() === currentDate.getTime()) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else if (sessionDate.getTime() < currentDate.getTime()) {
        break;
      }
    }
    
    return streak;
  }

  getTimeBasedGreeting() {
    const hour = new Date().getHours();
    
    if (hour < 12) return 'Guten Morgen';
    if (hour < 18) return 'Guten Tag';
    return 'Guten Abend';
  }

  isWeekend() {
    const day = new Date().getDay();
    return day === 0 || day === 6;
  }

  getDayOfWeek() {
    const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    return days[new Date().getDay()];
  }

  formatLargeNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async retry(fn, maxRetries = 3, delayMs = 1000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await this.delay(delayMs * Math.pow(2, i));
      }
    }
  }

  truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  }

  generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

module.exports = new Utils();