#!/bin/bash

echo "🚀 Railway Database Refresh Script"
echo "=================================="

# Check if we're in Railway environment
if [ -z "$RAILWAY_ENVIRONMENT" ]; then
    echo "❌ This script should run on Railway"
    exit 1
fi

echo "📍 Environment: $RAILWAY_ENVIRONMENT"

# Run the database refresh
echo "🔄 Starting database refresh..."
npm run refresh-db

echo "✅ Database refresh completed!"
echo "🤖 Bot is ready to start..."