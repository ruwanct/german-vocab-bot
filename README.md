# German Vocabulary Bot 🇩🇪

A comprehensive Telegram bot for learning German vocabulary with interactive quizzes, progress tracking, and real-time dictionary API integration.

## ✨ Features

- **Interactive Quiz System**: Article quizzes (der/die/das), translation quizzes, and mixed quizzes
- **Progress Tracking**: Detailed statistics, streaks, and performance analytics
- **User Settings**: Customizable difficulty, notification preferences, and learning goals
- **Dictionary API Integration**: Real-time vocabulary from PONS and Linguatools APIs
- **Smart Caching**: Intelligent vocabulary caching with 2000+ API calls per month
- **Automatic Vocabulary Enrichment**: Background tasks to expand vocabulary database
- **Admin Panel**: Monitor API usage, manage vocabulary, and view statistics
- **Data Export**: Export learning progress and statistics

## 🏗️ Project Structure

```
german-vocab-bot/
├── src/
│   ├── bot.js                    # Main bot logic with Telegraf
│   ├── commands/                 # Command handlers
│   │   ├── quiz.js              # Quiz functionality
│   │   ├── progress.js          # Progress tracking
│   │   └── settings.js          # User settings
│   ├── database/                 # Database layer
│   │   ├── init.js              # Database initialization
│   │   ├── models.js            # Database models and queries
│   │   └── seed.js              # Vocabulary data seeding
│   ├── utils/                    # Utility functions
│   │   ├── helpers.js           # General helpers
│   │   └── scheduler.js         # Cron job scheduler
│   ├── services/                 # Business logic services
│   │   ├── vocabularyCache.js   # Vocabulary caching system
│   │   └── vocabularyManager.js # Vocabulary management
│   └── api/                      # External integrations
│       └── dictionaries.js      # PONS & Linguatools API integration
├── config/
│   └── config.js                # Bot configuration
├── data/
│   └── vocabulary.json          # German B1 vocabulary database
├── .env.example                 # Environment variables template
├── package.json
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Telegram Bot Token (from @BotFather)
- PONS Dictionary API Key (free 1000 requests/month)
- Linguatools Dictionary API Key (free 1000 requests/month)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd german-vocab-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Initialize the database**
   ```bash
   npm run init-db
   ```

5. **Start the bot**
   ```bash
   npm start
   ```

### Configuration

Edit your `.env` file with the following variables:

```env
# Required
TELEGRAM_BOT_TOKEN=your_bot_token_here
PONS_API_KEY=your_pons_api_key_here
LINGUATOOLS_API_KEY=your_linguatools_api_key_here

# Optional
WEBHOOK_URL=https://your-domain.com/webhook
PORT=3000
DATABASE_PATH=./data/bot.db
AUTO_ENRICHMENT_ENABLED=true
AUTO_ENRICHMENT_MAX_WORDS=10
NODE_ENV=development
LOG_LEVEL=info
```

## 🎯 Usage

### Bot Commands

- `/start` - Welcome message and bot introduction
- `/quiz` - Start an interactive quiz session
- `/progress` - View detailed learning statistics
- `/settings` - Customize bot preferences
- `/admin` - Admin panel (for authorized users)
- `/help` - Show available commands and features

### Quiz Types

1. **Article Quiz**: Choose the correct article (der/die/das) for German nouns
2. **Translation Quiz**: Translate German words to English
3. **Mixed Quiz**: Combination of article and translation questions

### Interactive Features

- **Inline Keyboards**: Easy navigation with clickable buttons
- **Real-time Feedback**: Immediate results after each question
- **Progress Tracking**: Automatic saving of quiz results
- **Streak System**: Daily learning streak tracking
- **Motivational Messages**: Personalized encouragement based on performance

## 🔧 Development

### Available Scripts

- `npm start` - Start the bot in production mode
- `npm run dev` - Start the bot in development mode with nodemon
- `npm run init-db` - Initialize database and create tables
- `npm test` - Run tests (when implemented)

### Database Schema

The bot uses SQLite with the following main tables:

- `users` - User information and registration data
- `vocabulary` - German vocabulary with articles and translations (API-enhanced)
- `user_progress` - Individual word learning progress
- `quiz_sessions` - Quiz session results and statistics
- `user_settings` - User preferences and configuration
- `vocabulary_cache` - API response caching for performance

### Adding New Vocabulary

Edit `data/vocabulary.json` to add new German words:

```json
{
  "word": "Beispiel",
  "article": "das",
  "translation_en": "example",
  "translation_de": "das Beispiel",
  "pronunciation": "ˈbaɪʃpiːl",
  "level": "B1",
  "category": "general",
  "example_sentence": "Das ist ein gutes Beispiel."
}
```

Then run the seeding script:
```bash
node src/database/seed.js
```

**Note**: Manual vocabulary is still supported, but the bot will automatically enrich its database using the dictionary APIs for a much larger vocabulary.

## 🔄 Dictionary API Integration

The bot integrates with two professional dictionary APIs:

### **PONS Dictionary API**
- **Free Tier**: 1000 requests/month
- **Features**: Comprehensive German-English translations, pronunciation, example sentences
- **Registration**: [PONS Developer Portal](https://api.pons.com/)

### **Linguatools Dictionary API**
- **Free Tier**: 1000 requests/month  
- **Features**: Translation confidence scores, frequency data, multiple options
- **Registration**: [Linguatools API](https://www.linguatools.de/api/)

### **Smart Vocabulary System**
- **Total API Capacity**: 2000 requests/month (1000 + 1000)
- **Multi-Level Caching**: Memory + Database + API fallback
- **Automatic Enrichment**: Background tasks populate vocabulary
- **Quality Scoring**: Selects best translations from multiple sources

## 📊 Features Overview

### Quiz System
- Multiple quiz types with different difficulty levels
- Randomized question selection
- Progress tracking and statistics
- Instant feedback and explanations

### Progress Tracking
- Overall statistics and accuracy rates
- Category-based progress (animals, food, transportation, etc.)
- Level-based progress (A1, A2, B1, B2, C1, C2)
- Daily and weekly activity reports
- Learning streaks and achievements

### User Settings
- Quiz difficulty adjustment
- Questions per session customization
- Daily learning goals
- Notification preferences
- Time zone and language settings
- Data export functionality

### Automation
- Automatic vocabulary enrichment from APIs
- Background caching optimization
- Automated data cleanup
- Performance optimization
- API quota management

## 🛠️ Technical Details

### Technologies Used

- **Node.js** - Runtime environment
- **Telegraf** - Telegram Bot API framework
- **SQLite3** - Database for data persistence
- **node-cron** - Scheduled task automation
- **Axios** - HTTP client for API requests
- **dotenv** - Environment variable management

### Performance Optimizations

- **Multi-Level Caching**: Memory cache + Database cache + API fallback
- **Smart API Usage**: Quota management and automatic failover
- **Efficient Query Optimization**: Database indexes and optimized queries
- **Automatic Data Cleanup**: Remove old cache entries and sessions
- **Response Time Monitoring**: Performance logging and optimization
- **Background Processing**: Vocabulary enrichment and cache management

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the troubleshooting section in this README
2. Review the bot logs for error messages
3. Ensure all environment variables are properly set
4. Verify your Telegram Bot Token is valid
5. Check that your PONS and Linguatools API keys are valid
6. Use the `/admin` command to check API status and quota
7. Check database permissions and file paths

## 🎉 Acknowledgments

- **PONS Dictionary** for providing comprehensive German-English translations
- **Linguatools** for additional vocabulary and translation confidence data
- **Telegram Bot API** for the excellent bot framework
- **German B1 level learning resources** for vocabulary classification
- **Contributors and users** who help improve the bot

---

**Happy Learning! Viel Erfolg beim Deutsch lernen! 🇩🇪📚**