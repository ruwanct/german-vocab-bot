# German Vocabulary Bot 🇩🇪

A comprehensive Telegram bot for learning German vocabulary with AI-powered flashcards, interactive quizzes, and intelligent progress tracking.

## ✨ Features

- 🎴 **AI-Powered Flashcard System**: Intelligent spaced repetition with real-time word analysis
- 🎯 **Interactive Quiz System**: Article quizzes (der/die/das), translation quizzes, and mixed modes  
- 🤖 **Multiple AI Provider Support**: Groq, OpenAI, Anthropic, and local Ollama integration
- 📊 **Progress Tracking**: Detailed statistics, streaks, and performance analytics
- ⚙️ **User Settings**: Customizable difficulty, notification preferences, and learning goals
- 🗃️ **Smart Database**: SQLite with better-sqlite3 for performance and reliability
- 👑 **Admin Panel**: Monitor usage, manage vocabulary, and view statistics
- 📤 **Data Export**: Export learning progress and statistics

## 🏗️ Project Structure

```
german-vocab-bot/
├── src/
│   ├── bot.js                    # Main bot logic with Telegraf
│   ├── commands/                 # Command handlers
│   │   ├── quiz.js              # Traditional quiz functionality
│   │   ├── flashcardQuiz.js     # AI-powered flashcard system
│   │   ├── progress.js          # Progress tracking
│   │   ├── settings.js          # User settings
│   │   └── admin.js             # Administrative functions
│   ├── database/                 # Database layer
│   │   ├── init.js              # Database initialization
│   │   ├── flashcard-init.js    # Flashcard database setup
│   │   ├── models-sqlite3.js    # Database models using better-sqlite3
│   │   ├── models.js            # Legacy database models
│   │   └── seed.js              # Vocabulary data seeding
│   ├── services/                 # Business logic services
│   │   ├── vocabularyManager.js # Vocabulary CRUD operations
│   │   ├── vocabularyCache.js   # Multi-level caching system
│   │   ├── aiEnrichment.js      # AI-powered vocabulary analysis
│   │   └── wordAnalyzer.js      # Word type and article detection
│   ├── utils/                    # Utility functions
│   │   ├── helpers.js           # General helpers
│   │   └── scheduler.js         # Cron job scheduler
│   ├── scripts/                  # Data management scripts
│   │   ├── importSimpleVocab.js # Import simplified CSV vocabulary
│   │   └── manageDuplicates.js  # Duplicate detection and cleanup
│   └── api/
│       └── dictionaries.js      # External API integrations
├── config/
│   └── config.js                # Bot configuration
├── data/
│   ├── bot.db                   # Main SQLite database
│   └── german_vocab.db          # Vocabulary database
├── vocabulary/                   # Vocabulary source files
│   ├── levels/                  # CSV files by CEFR level (A1, A2, B1)
│   └── topics/                  # Topic-based vocabulary sets
├── .env.example                 # Environment variables template
├── package.json
└── README.md
```

## 🚀 Getting Started

### Prerequisites

**✅ What You Actually Need:**
- Node.js (v16 or higher)
- Telegram Bot Token (free from @BotFather)
- AI Provider API Key (choose one):
  - **Groq API Key** (recommended for speed and cost)
  - OpenAI API Key
  - Anthropic API Key
  - Local Ollama installation

**❌ What You DON'T Need:**
- No external dictionary APIs required
- No PONS or Linguatools API keys
- Works completely offline after setup

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
   npm run init-flashcard-db
   ```

5. **Import vocabulary (optional)**
   ```bash
   npm run import-simple
   ```

6. **Start the bot**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

### Configuration

Create your `.env` file (minimal setup):

```env
# Required - Get from @BotFather on Telegram
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# Required - Choose ONE AI provider
GROQ_API_KEY=your_groq_api_key_here

# Optional - Database location
DATABASE_PATH=./data/german_vocab.db

# Optional - For production deployment
# WEBHOOK_URL=https://your-domain.com/webhook
# PORT=3000
```

**🎯 That's it! No complex API keys needed.**

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
4. **🎴 AI Flashcards**: Intelligent spaced repetition system

### 🎴 AI-Powered Flashcard System

**How it works:**
- **Simple Storage**: Just German word + English translation in database
- **AI Analysis**: Real-time analysis determines articles, word types, examples
- **Smart Learning**: Spaced repetition adapts to your progress

**Example Flow:**
```
📱 Bot: "What's the German word for 'juice'?"
🤔 You: Think about it...
👁️ Click: "Show Answer"  
🤖 AI: "der Saft" + usage example + word type
✅ You: "I knew it!" / "I'm learning"
```

**Perfect for beginners** - no need to pre-define articles or word types!

### Interactive Features

- **Inline Keyboards**: Easy navigation with clickable buttons
- **Real-time Feedback**: Immediate results after each question
- **AI-Powered Analysis**: Intelligent word analysis during flashcards
- **Progress Tracking**: Automatic saving of quiz results and mastery levels
- **Spaced Repetition**: Optimized review timing based on memory retention
- **Streak System**: Daily learning streak tracking
- **Motivational Messages**: Personalized encouragement based on performance

## 🔧 Development

### Available Scripts

**Running the Bot:**
- `npm start` - Start the bot in production mode
- `npm run start-local` - Start the bot locally
- `npm run dev` - Start the bot in development mode with nodemon

**Database Management:**
- `npm run init-db` - Initialize main database and create tables
- `npm run init-flashcard-db` - Initialize flashcard database
- `npm run migrate-consent` - Run consent system migration

**Vocabulary Management:**
- `npm run import-simple` - Import simplified vocabulary from CSV
- `npm run check-duplicates` - Find and manage duplicate entries

**Testing:**
- `npm test` - Run Jest tests

### Database Schema

The bot uses SQLite with better-sqlite3 and the following main tables:

**User Management:**
- `users` - User information, registration data, and consent tracking
- `user_settings` - User preferences and configuration
- `user_progress` - Traditional quiz progress tracking
- `flashcard_progress` - Spaced repetition progress with mastery levels

**Vocabulary Storage:**
- `vocabulary` - Complex vocabulary with articles, examples, and API data
- `vocabulary_simple` - Basic German-English word pairs for flashcards

**Session Tracking:**
- `quiz_sessions` - Traditional quiz session results and statistics
- `flashcard_sessions` - Flashcard session tracking and analytics

### Adding New Vocabulary

**🎯 Simple CSV Import (Recommended)**

1. **Create CSV files** in the `vocabulary/levels/` directory:

```csv
german_word,english_translation,level,difficulty_score
Haus,house,A1,1.0
Auto,car,A1,1.2
Wasser,water,A1,1.0
Brot,bread,A1,1.1
```

2. **Import vocabulary**:
```bash
npm run import-simple
```

**📁 Suggested structure:**
```
vocabulary/
├── levels/
│   ├── a1-words.csv    # Beginner vocabulary
│   ├── a2-words.csv    # Elementary vocabulary  
│   └── b1-words.csv    # Intermediate vocabulary
└── topics/
    ├── food.csv        # Food & drinks
    ├── family.csv      # Family members
    └── travel.csv      # Travel vocabulary
```

**That's it!** The AI will handle articles, word types, and examples automatically.

## 🤖 AI Integration

The bot features AI-powered vocabulary analysis for enhanced learning:

### **Supported AI Providers**
- **Groq** - Fast inference (recommended)
- **OpenAI** - GPT models for detailed analysis
- **Anthropic** - Claude models for nuanced understanding
- **Ollama** - Local AI models for privacy

### **AI-Powered Features**
- **Real-time Word Analysis**: Determines articles, word types, and usage
- **Contextual Examples**: Generates relevant example sentences
- **Flashcard Intelligence**: Adaptive difficulty based on user performance
- **Smart Categorization**: Automatic tagging and level classification

### **Configuration**
Configure your preferred AI provider in `.env`:
```env
# Choose your provider
GROQ_API_KEY=your_key_here
# or OPENAI_API_KEY=your_key_here
# or ANTHROPIC_API_KEY=your_key_here
```

## 📊 Features Overview

### Quiz System
- **Traditional Quizzes**: Article and translation quizzes with immediate feedback
- **AI Flashcards**: Intelligent spaced repetition with real-time word analysis
- **Adaptive Difficulty**: Questions adjust based on user performance
- **Randomized Selection**: Smart algorithms prevent repetition
- **Progress Tracking**: Detailed statistics and mastery level tracking

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
- **better-sqlite3** - High-performance SQLite database
- **Multiple AI Providers** - Groq, OpenAI, Anthropic, Ollama support
- **node-cron** - Scheduled task automation
- **Axios** - HTTP client for API requests
- **dotenv** - Environment variable management
- **CSV Processing** - Vocabulary import and management

### Performance Optimizations

- **better-sqlite3**: Synchronous database operations for improved performance
- **Multi-Level Caching**: Memory cache + Database cache for vocabulary lookup
- **Smart Query Optimization**: Database indexes and efficient SQL queries
- **AI Response Caching**: Cache AI analysis results to reduce API calls
- **Background Processing**: Automated vocabulary import and data management
- **Foreign Key Constraints**: Database integrity with referential constraints

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
5. Check that your AI provider API key is valid and has sufficient quota
6. Use the `/admin` command to check system status
7. Verify database file permissions and paths
8. Ensure vocabulary CSV files are properly formatted

## 🎉 Acknowledgments

- **AI Providers** (Groq, OpenAI, Anthropic) for powering intelligent vocabulary analysis
- **better-sqlite3** for high-performance database operations
- **Telegram Bot API** for the excellent bot framework
- **CEFR Standards** for vocabulary level classification
- **German language learning community** for vocabulary sources and feedback
- **Contributors and users** who help improve the bot

---

**Happy Learning! Viel Erfolg beim Deutsch lernen! 🇩🇪📚**