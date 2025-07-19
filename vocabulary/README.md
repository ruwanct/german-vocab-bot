# 📚 Vocabulary Folder Structure

This folder contains all your German vocabulary files organized for easy management.

## 📁 Folder Structure

```
vocabulary/
├── levels/          # Organized by CEFR levels
│   ├── a1-words.csv
│   ├── a2-words.csv
│   └── b1-words.csv
├── topics/          # Organized by themes
│   ├── food-drinks.csv
│   ├── family.csv
│   ├── travel.csv
│   └── work.csv
├── sources/         # Organized by source
│   ├── goethe-institute.csv
│   ├── textbook-chapter1.csv
│   └── pdf-extracts.csv
└── README.md        # This file
```

## 📝 CSV Format

All CSV files should follow this simple format:
```csv
german_word,english_translation
Saft,juice
trinken,to drink
schön,beautiful
Haus,house
```

**Rules:**
- ✅ No headers needed
- ✅ German word first, English translation second
- ✅ No articles needed (LLM adds them automatically)
- ✅ Any word type: nouns, verbs, adjectives, adverbs
- ✅ One word pair per line

## 🚀 How to Import

### Import by Level
```bash
npm run import-simple import ./vocabulary/levels/a1-words.csv A1
npm run import-simple import ./vocabulary/levels/a2-words.csv A2
npm run import-simple import ./vocabulary/levels/b1-words.csv B1
```

### Import by Topic
```bash
npm run import-simple import ./vocabulary/topics/food-drinks.csv A1
npm run import-simple import ./vocabulary/topics/family.csv A1
npm run import-simple import ./vocabulary/topics/travel.csv B1
```

### Import from Sources
```bash
npm run import-simple import ./vocabulary/sources/goethe-institute.csv A1
npm run import-simple import ./vocabulary/sources/textbook-chapter1.csv A2
```

## 📊 Check Your Progress

After importing, check statistics:
```bash
npm run import-simple stats
```

## 💡 Best Practices

### 1. **Start Small**
- Create files with 20-50 words each
- Test import and quiz functionality
- Gradually add more vocabulary

### 2. **Organize Logically**
- **By Level**: When you know the difficulty
- **By Topic**: When learning themed vocabulary
- **By Source**: When extracting from specific materials

### 3. **Consistent Naming**
- Use lowercase and hyphens: `food-drinks.csv`
- Include level if known: `a1-family.csv`
- Be descriptive: `goethe-a1-chapter1.csv`

### 4. **Quality Over Quantity**
- Better to have accurate, clean vocabulary
- LLM will provide articles and examples
- Focus on words you actually want to learn

## 🔄 Workflow Examples

### Scenario 1: Learning from Textbook
```bash
# Extract words from textbook chapter
echo "Hund,dog" > ./vocabulary/sources/textbook-chapter2.csv
echo "Katze,cat" >> ./vocabulary/sources/textbook-chapter2.csv
echo "laufen,to run" >> ./vocabulary/sources/textbook-chapter2.csv

# Import as A1 level
npm run import-simple import ./vocabulary/sources/textbook-chapter2.csv A1
```

### Scenario 2: Building Thematic Vocabulary
```bash
# Create food vocabulary
cat > ./vocabulary/topics/food-drinks.csv << EOF
Saft,juice
Wasser,water
Brot,bread
Käse,cheese
trinken,to drink
essen,to eat
EOF

# Import as mixed levels
npm run import-simple import ./vocabulary/topics/food-drinks.csv A1
```

### Scenario 3: PDF Extraction
```bash
# Extract from PDF first
npm run pdf-to-csv ./my-vocabulary.pdf A1 ./vocabulary/sources/

# Then import the generated CSV
npm run import-simple import ./vocabulary/sources/my-vocabulary-A1-vocabulary.csv A1
```

## 📈 Tips for Building Vocabulary

### **High-Frequency Words First**
Start with the most common German words:
- A1: der, die, das, sein, haben, ich, du, er, sie
- Basic nouns: Haus, Auto, Familie, Essen
- Basic verbs: gehen, kommen, sprechen, lernen

### **Themed Learning**
Group related words together:
- **Family**: Mutter, Vater, Kind, Bruder, Schwester
- **Food**: Brot, Milch, Fleisch, Gemüse, Obst  
- **Travel**: Flugzeug, Hotel, Ticket, Koffer

### **Progressive Difficulty**
- **A1**: Basic everyday vocabulary
- **A2**: Extended everyday situations
- **B1**: More complex topics and abstract concepts

## 🎯 Ready-to-Use Examples

Check the `levels/` folder for starter vocabulary files to get you going immediately!

Happy learning! 🇩🇪✨