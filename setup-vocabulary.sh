#!/bin/bash

echo "🚀 Setting up German Vocabulary Bot with corrected vocabulary..."

# Initialize flashcard database (this will clear and recreate tables)
echo "📊 Initializing flashcard database..."
npm run init-flashcard-db

# Import corrected vocabulary
echo "📚 Importing A1 level vocabulary (corrected)..."
npm run import-simple import ./vocabulary/levels/a1-words.csv A1

echo "📖 Importing A2 level vocabulary (corrected)..."
npm run import-simple import ./vocabulary/levels/a2-words.csv A2

echo "🍽️ Importing food & drinks vocabulary..."
npm run import-simple import ./vocabulary/topics/food-drinks.csv A1

echo "👨‍👩‍👧‍👦 Importing family vocabulary..."
npm run import-simple import ./vocabulary/topics/family.csv A1

echo "✈️ Importing travel vocabulary..."
npm run import-simple import ./vocabulary/topics/travel.csv A2

# Show statistics
echo "📊 Vocabulary statistics:"
npm run import-simple stats

echo ""
echo "🎉 Setup complete!"
echo ""
echo "✅ Your bot now has:"
echo "   - Flashcard database initialized"
echo "   - 3000+ corrected German words imported"
echo "   - Multiple topics covered"
echo "   - A1/A2 levels ready with improved AI prompt"
echo ""
echo "🔄 Next steps:"
echo "   1. Add your Telegram bot token to .env"
echo "   2. Set up LLM (Ollama/OpenAI/Claude)"
echo "   3. Run: npm start"
echo "   4. Test with /quiz in Telegram"
echo ""
echo "📁 Add more vocabulary:"
echo "   - Put CSV files in ./vocabulary/topics/"
echo "   - Import with: npm run import-simple import <file> <level>"
echo ""
echo "Happy learning! 🇩🇪✨"