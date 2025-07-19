#!/bin/bash

echo "🚀 Railway Database Setup Script"
echo "================================="

# Check if we're in Railway environment
if [ -z "$RAILWAY_ENVIRONMENT" ]; then
    echo "❌ This script should run on Railway"
    exit 1
fi

echo "📍 Environment: $RAILWAY_ENVIRONMENT"

# Initialize databases
echo "🔄 Initializing databases..."
npm run init-db
npm run init-flashcard-db

# Import vocabulary if available
echo "📥 Importing vocabulary..."
npm run import-simple

echo "✅ Database setup completed!"
echo "🤖 Bot is ready to start..."