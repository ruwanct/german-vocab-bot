# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Database Management:**
- `npm run init-db` - Initialize SQLite database and create tables
- `npm run init-flashcard-db` - Initialize flashcard-specific database  
- `npm run migrate-consent` - Run consent system migration

**Running the Bot:**
- `npm start` - Production mode (uses railway-start.js)
- `npm run start-local` - Local development mode
- `npm run dev` - Development with nodemon auto-restart

**Vocabulary Management:**
- `npm run import-vocab` - Import vocabulary from JSON files
- `npm run import-simple` - Import simplified vocabulary from CSV
- `npm run pdf-to-csv` - Extract vocabulary from PDF files
- `npm run check-duplicates` - Find and manage duplicate vocabulary entries
- `npm run refresh-db` - Clean database and inject fresh CSV data

**Testing:**
- `npm test` - Run Jest tests

## Architecture Overview

### Core Structure
This is a Telegram bot built with Telegraf that provides German vocabulary learning through quizzes and flashcards. The bot uses **SQLite with better-sqlite3** for data persistence and supports both manual vocabulary and AI-powered word analysis.

### Key Components

**Main Application (`src/bot.js`):**
- Telegraf bot initialization with middleware
- Command routing and callback handling
- Database initialization and seeding on startup
- Quiz session management with Map-based state

**Database Layer:**
- `src/database/models-sqlite3.js` - Database operations using better-sqlite3
- `src/database/init.js` - Schema initialization with foreign keys enabled
- Two main vocabulary tables: `vocabulary` (complex) and `vocabulary_simple` (basic German-English pairs)
- Progress tracking with `user_progress` and `flashcard_progress` tables

**Command Handlers (`src/commands/`):**
- `quiz.js` - Traditional article and translation quizzes
- `flashcardQuiz.js` - AI-powered flashcard system
- `progress.js` - User statistics and learning analytics  
- `settings.js` - User preferences and configuration
- `admin.js` - Administrative functions and monitoring

**Services (`src/services/`):**
- `vocabularyManager.js` - Vocabulary CRUD operations and caching
- `vocabularyCache.js` - Multi-level caching (memory + database)
- `aiEnrichment.js` - AI-powered vocabulary analysis
- `wordAnalyzer.js` - Word type detection and article determination

### Database Schema

**Primary Tables:**
- `users` - User registration with consent tracking
- `vocabulary` - Complex vocabulary with articles, examples, API data
- `vocabulary_simple` - Basic German-English word pairs for flashcards
- `user_progress` - Traditional quiz progress tracking
- `flashcard_progress` - Spaced repetition progress with mastery levels
- `quiz_sessions` / `flashcard_sessions` - Session tracking and analytics
- `user_settings` - Customizable preferences per user

### AI Integration
The bot supports multiple AI providers configured through environment variables:
- **Groq API** (recommended for speed)
- **OpenAI API** (GPT models)
- **Anthropic API** (Claude models)  
- **Local Ollama** (self-hosted)

AI is used for real-time vocabulary analysis in flashcard mode, determining word types, articles, and generating contextual examples.

### Configuration
Environment variables are managed through `config/config.js` which loads from `.env`:
- Telegram bot token and webhook settings
- Database path configuration
- AI provider API keys and model selection
- Quiz settings and vocabulary automation parameters

### Development Notes
- Uses `better-sqlite3` for synchronous database operations
- Database foreign keys are enabled for referential integrity
- Supports both development and production environments
- Railway deployment configured via `railway-start.js`
- Vocabulary can be imported from CSV files in `vocabulary/` directory
- Bot initialization includes automatic database setup and seeding if not present

### Key Patterns
- Command handlers are instantiated in `src/bot.js` and routed via middleware
- Database operations are promise-wrapped for async/await compatibility
- Quiz state is managed in-memory with Map objects for active sessions
- User consent is tracked and required for data processing operations
- Multi-level caching reduces API calls and improves response times