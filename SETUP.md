# 🚀 Quick Setup Guide

## Prerequisites

1. **Node.js** (v16 or higher)
2. **Telegram Bot Token** from [@BotFather](https://t.me/BotFather)
3. **PONS API Key** from [PONS Developer Portal](https://api.pons.com/)
4. **Linguatools API Key** from [Linguatools API](https://www.linguatools.de/api/)

## Step-by-Step Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd german-vocab-bot
npm install
```

### 2. Environment Configuration

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Required
TELEGRAM_BOT_TOKEN=your_bot_token_here
PONS_API_KEY=your_pons_api_key_here
LINGUATOOLS_API_KEY=your_linguatools_api_key_here

# Optional (recommended defaults)
AUTO_ENRICHMENT_ENABLED=true
AUTO_ENRICHMENT_MAX_WORDS=10
```

### 3. Database Setup

```bash
npm run init-db
```

### 4. Start the Bot

```bash
npm start
```

## 🔧 Getting API Keys

### PONS Dictionary API

1. Go to [PONS Developer Portal](https://api.pons.com/)
2. Register for a free account
3. Create a new API application
4. Copy your API key
5. **Free Tier**: 1000 requests/month

### Linguatools Dictionary API

1. Go to [Linguatools API](https://www.linguatools.de/api/)
2. Register for a free account
3. Generate your API key
4. **Free Tier**: 1000 requests/month

## 🎯 First Steps

### 1. Test the Bot

Send `/start` to your bot to verify it's working.

### 2. Check API Status

Use `/admin` command to verify your API keys are working:
- Check API connection status
- Monitor quota usage
- View vocabulary statistics

### 3. Try a Quiz

Use `/quiz` to test the vocabulary system:
- The bot will automatically fetch vocabulary from APIs
- Cached results will be used for subsequent requests
- Admin panel shows API usage statistics

## 📊 Admin Features

Set admin user IDs in your `.env`:

```env
ADMIN_USER_IDS=123456789,987654321
```

Admin commands:
- `/admin` - Open admin panel
- View API quota usage
- Monitor vocabulary statistics
- Manually enrich vocabulary
- Clear cache

## 🔄 Automatic Features

The bot includes several automatic features:

### Background Vocabulary Enrichment
- Runs daily at 2 AM (configurable)
- Enriches popular words automatically
- Respects API quota limits

### Smart Caching
- Memory cache for frequent words
- Database cache for persistence
- Automatic cache cleanup

### API Management
- Automatic failover between APIs
- Quota monitoring and management
- Quality scoring for best results

## 🐛 Troubleshooting

### Bot Not Starting
- Check `TELEGRAM_BOT_TOKEN` is correct
- Verify environment variables are loaded
- Check Node.js version (v16+)

### No Vocabulary Found
- Verify API keys are correct
- Check internet connection
- Use `/admin` to check API status
- Try manual vocabulary enrichment

### Database Issues
- Check file permissions
- Verify database path exists
- Re-run `npm run init-db`

## 📈 Monitoring

### Check API Usage
```bash
# Use admin panel in bot
/admin → API Status
/admin → Quota Status
```

### View Logs
```bash
# Development mode with detailed logs
npm run dev
```

### Database Stats
```bash
# Check via admin panel
/admin → Statistics
```

## 🎯 Production Deployment

For production deployment:

1. **Set Environment**:
   ```env
   NODE_ENV=production
   LOG_LEVEL=error
   ```

2. **Use PM2** (recommended):
   ```bash
   npm install -g pm2
   pm2 start src/bot.js --name german-vocab-bot
   ```

3. **Set up Webhook** (optional):
   ```env
   WEBHOOK_URL=https://your-domain.com/webhook
   ```

4. **Monitor Resources**:
   - API quota usage
   - Database size
   - Memory usage
   - Error rates

## 📚 Next Steps

1. **Customize Vocabulary**: Add manual vocabulary to `data/vocabulary.json`
2. **Adjust Settings**: Configure auto-enrichment in `.env`
3. **Monitor Usage**: Use admin panel to track API usage
4. **Scale Up**: Consider upgrading API plans for higher usage
5. **Extend Features**: Add new quiz types or language pairs

---

**Your German vocabulary bot is now ready to help users learn! 🇩🇪🎉**