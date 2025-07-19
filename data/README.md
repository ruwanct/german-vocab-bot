# 📊 Data Folder

This folder contains the bot's database and generated files.

## 📁 Contents

### **Database Files**
- `bot.db` - SQLite database containing:
  - User data and settings
  - Vocabulary and flashcard progress
  - Quiz sessions and statistics
  - **Important**: Don't delete this file!

### **Generated Files** (Created automatically)
- PDF extraction outputs
- Import logs and error reports
- Temporary processing files

## ⚠️ Important Notes

### **Keep These Files:**
- ✅ `bot.db` - Your main database
- ✅ Any files you specifically created

### **Safe to Delete:**
- ❌ Temporary CSV files from PDF extraction
- ❌ Error logs (`.txt` files)
- ❌ Old backup files

## 🔄 Database Management

### **Backup Your Database**
```bash
# Create backup
cp ./data/bot.db ./data/bot.db.backup

# Or with timestamp
cp ./data/bot.db ./data/bot.db.$(date +%Y%m%d)
```

### **Reset Database (if needed)**
```bash
# Delete old database
rm ./data/bot.db

# Reinitialize
npm run init-flashcard-db

# Reimport vocabulary
./setup-vocabulary.sh
```

### **View Database Statistics**
```bash
npm run import-simple stats
```

## 📁 Folder Purpose

The `data/` folder is for:
- ✅ **Database storage** (bot.db)
- ✅ **Temporary processing** (PDF extraction)
- ✅ **Generated reports** (import logs)

For **vocabulary management**, use the `vocabulary/` folder instead:
- `vocabulary/levels/` - CEFR level files
- `vocabulary/topics/` - Themed vocabulary
- `vocabulary/sources/` - PDF extracts and sources

## 🔒 Backup Strategy

1. **Regular backups** of `bot.db`
2. **Version control** for vocabulary files (in `vocabulary/` folder)
3. **Export functionality** via bot's `/settings` → Data Export

Your database is precious - it contains all user progress and learning data! 🇩🇪✨