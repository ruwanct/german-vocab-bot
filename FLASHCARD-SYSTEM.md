# 🎴 AI-Powered Flashcard System

Your German vocabulary bot now features an intelligent flashcard system powered by LLM!

## 🧠 How It Works

### **Simple Storage + Smart Analysis**
1. **Database**: Stores only `German word` + `English translation`
2. **LLM Analysis**: Real-time word analysis during quiz
3. **Flashcard Style**: Think → Reveal → Self-assess

### **Quiz Flow:**
```
📱 Show: "juice"
🤔 User thinks: "der Saft?"
👁️ Click: "View Answer"
🤖 LLM analyzes: Word type, article, example
📝 Show: "der Saft" + example sentence
✅ User marks: "I knew it" / "I'm learning"
```

## 🚀 Quick Setup

### 1. Initialize Flashcard Database
```bash
npm run init-flashcard-db
```

### 2. Import Simple Vocabulary
```bash
# Import the sample vocabulary
npm run import-simple import ./data/simple-vocabulary.csv A1

# Or convert existing vocabulary
npm run import-simple convert
```

### 3. Configure LLM (Choose One)

#### Option A: Free Local LLM (Ollama)
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull llama3.1:8b

# Update .env
OLLAMA_URL=http://localhost:11434/api/generate
OLLAMA_MODEL=llama3.1:8b
LLM_PROVIDER=ollama
```

#### Option B: OpenAI (Paid)
```bash
# Update .env
OPENAI_API_KEY=your_openai_key_here
LLM_PROVIDER=openai
```

#### Option C: Anthropic Claude (Paid)
```bash
# Update .env
ANTHROPIC_API_KEY=your_anthropic_key_here
LLM_PROVIDER=anthropic
```

### 4. Start Your Bot
```bash
npm start
```

### 5. Test Flashcards
```
/quiz → 🎴 Flashcards → Start session
```

## 📊 What LLM Provides

For each German word, the LLM analyzes and provides:

### **Word Classification**
- **Type**: noun, verb, adjective, adverb
- **Article**: der/die/das (for nouns)
- **Display**: Proper German format

### **Learning Context**
- **Example Sentence**: German usage
- **Translation**: English meaning
- **Grammar Tip**: Brief helpful note
- **Pronunciation**: IPA format

### **Example LLM Output**
```json
{
  "word_type": "noun",
  "german_display": "der Saft",
  "pronunciation": "zaːft",
  "example_sentence": "Ich trinke gern Orangensaft.",
  "example_translation": "I like to drink orange juice.",
  "grammar_note": "Remember: der is masculine",
  "difficulty": "easy",
  "level_suggestion": "A1"
}
```

## 📁 Vocabulary Format

### **CSV Input (Simple)**
```csv
german_word,english_translation
Saft,juice
trinken,to drink
schön,beautiful
```

### **What Gets Stored**
```sql
CREATE TABLE vocabulary_simple (
  id INTEGER PRIMARY KEY,
  german_word TEXT,           -- "Saft" (no article)
  english_translation TEXT,   -- "juice"
  level TEXT                  -- "A1"
);
```

### **What LLM Generates (Real-time)**
- Article detection: "Saft" → "der Saft"
- Word type: noun/verb/adjective
- Example sentences
- Grammar tips

## 🔄 Complete Workflow

### **PDF → CSV → Import → Quiz**

#### Step 1: Extract from PDF
```bash
npm run pdf-to-csv ./vocabulary.pdf A1
```

#### Step 2: Import to Flashcard System
```bash
npm run import-simple import ./data/vocabulary-A1.csv A1
```

#### Step 3: Quiz with LLM Analysis
```bash
npm start
# Use /quiz in Telegram
```

## 🎯 Flashcard Features

### **Spaced Repetition**
- Known words: Review in 1 day → 3 days → 1 week
- Learning words: Review in 1 hour
- Automatic scheduling

### **Progress Tracking**
- Mastery levels (0-5)
- Success rates
- Review statistics

### **Smart Selection**
- Prioritizes difficult words
- Balances new vs review
- User-specific difficulty

## 💡 Usage Examples

### **Basic Session**
```bash
# Import vocabulary
npm run import-simple import ./words.csv A1

# Start bot and use /quiz
# Bot shows: "juice"
# User thinks, clicks "View Answer"
# Bot shows: "der Saft" + analysis
```

### **Mixed Word Types**
Your CSV can contain any mix:
```csv
Saft,juice               # → noun: "der Saft"
trinken,to drink         # → verb: "trinken"
schön,beautiful          # → adjective: "schön"
schnell,quickly          # → adverb: "schnell"
```

LLM handles each type appropriately!

### **Bulk Import from Multiple Sources**
```bash
npm run import-simple import ./goethe-a1.csv A1
npm run import-simple import ./verbs.csv A2
npm run import-simple import ./adjectives.csv B1
```

## 🛠️ Advanced Configuration

### **LLM Settings in .env**
```env
# Provider priority (first available is used)
LLM_PROVIDER=ollama

# Ollama settings
OLLAMA_URL=http://localhost:11434/api/generate
OLLAMA_MODEL=llama3.1:8b

# OpenAI settings
OPENAI_API_KEY=sk-...

# Anthropic settings
ANTHROPIC_API_KEY=ant-...
```

### **Fallback System**
If LLM fails, the system uses:
- Rule-based article guessing
- Simple example generation
- Basic word type detection

### **Performance Tips**
- **Ollama**: Best for privacy, requires local setup
- **OpenAI**: Fast, costs ~$0.01 per 100 words
- **Claude**: Most accurate, similar cost

## 📈 Benefits Over Traditional System

### **Old System:**
- ❌ Pre-store articles, word types, examples
- ❌ Static content
- ❌ Manual classification
- ❌ Limited scalability

### **New Flashcard System:**
- ✅ Store only essential data
- ✅ Dynamic LLM analysis
- ✅ Smart word classification
- ✅ Unlimited vocabulary support
- ✅ Context-aware examples
- ✅ Spaced repetition
- ✅ Self-assessment learning

## 🎉 Success Story

```
🚀 Starting flashcard system...
✅ Initialized flashcard database
📥 Importing 500 German words...
✅ Imported 500 words to vocabulary_simple
🤖 LLM provider: ollama (local)
🎴 Starting flashcard session...

User sees: "juice"
🤔 User thinks...
👁️ Clicks "View Answer"
🤖 LLM analyzes "Saft"...
📝 Shows: "der Saft" + "Ich trinke Saft zum Frühstück."
✅ User: "I knew it!"
📊 Progress: 1/20 cards, 100% known
```

Your flashcard system is ready! 🇩🇪✨

## 🔄 Next Steps

1. **Test with sample vocabulary**: Use the included simple-vocabulary.csv
2. **Set up LLM**: Choose Ollama (free) or paid API
3. **Import your vocabulary**: From PDFs or CSV files
4. **Start learning**: Use /quiz for flashcard sessions
5. **Track progress**: Monitor learning with spaced repetition