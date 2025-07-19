# 📄 PDF to CSV Vocabulary Extraction Guide

Convert German vocabulary PDFs to CSV format for your Telegram bot!

## 🚀 Quick Start

```bash
# Extract vocabulary from PDF
npm run pdf-to-csv <pdf-file> [level] [output-dir]

# Example
npm run pdf-to-csv ./goethe-a1.pdf A1 ./data
```

## 📋 Supported PDF Formats

The script automatically detects these vocabulary formats:

### 1. **Goethe Institute Format**
```
der Saft - juice
die Milch - milk
das Brot - bread
```

### 2. **Standard Format**
```
Saft (der) - juice
Milch (die) - milk
Brot (das) - bread
```

### 3. **Simple Format**
```
der Saft, juice
die Milch, milk
das Brot, bread
```

### 4. **TELC Format**
```
Saft, der - juice
Milch, die - milk
Brot, das - bread
```

## 🔧 Usage Examples

### Basic Extraction
```bash
npm run pdf-to-csv ./my-vocabulary.pdf A1
```

### Specify Output Directory
```bash
npm run pdf-to-csv ./goethe-b1.pdf B1 ./vocabulary-data
```

### Different Levels
```bash
npm run pdf-to-csv ./beginner-words.pdf A1
npm run pdf-to-csv ./intermediate.pdf B1
npm run pdf-to-csv ./advanced.pdf B2
```

## 📊 What You Get

After extraction, you'll get:

### 1. **CSV File** (Ready for bot import)
```csv
German,English
der Saft,juice
die Milch,milk
das Brot,bread
```

### 2. **Error Report** (If any parsing issues)
```
Line 15: "unclear text" - Error: No article found
Line 23: "page 2" - Error: Invalid format
```

### 3. **Statistics**
```
📊 Summary:
  - Total entries: 150
  - Errors: 5
  - Success rate: 97%
```

## 🔄 Complete Workflow

### Step 1: Extract from PDF
```bash
npm run pdf-to-csv ./vocabulary.pdf A1 ./data
```

### Step 2: Import to Bot
```bash
npm run import-vocab ./data/vocabulary-A1-vocabulary.csv A1 goethe
```

### Step 3: Test in Bot
```bash
npm start
# Then use /quiz in Telegram
```

## 💡 Tips for Best Results

### PDF Quality
- ✅ **Good**: Clear text, proper formatting
- ❌ **Avoid**: Scanned images, handwritten text, complex layouts

### Vocabulary Format
- ✅ **Best**: Consistent format throughout PDF
- ✅ **Good**: One word per line with clear article/translation
- ❌ **Difficult**: Mixed formats, paragraphs, explanations

### File Preparation
1. **Use original PDFs** (not scanned copies)
2. **Check format** - does it match supported patterns?
3. **Test small sections** first with complex PDFs

## 🛠️ Troubleshooting

### No Vocabulary Found
```bash
❌ No vocabulary found in PDF. Check format or content.
```
**Solution**: Check if PDF contains recognizable vocabulary patterns

### Low Success Rate (<80%)
```bash
⚠️ Success rate: 65%
```
**Solution**: Review error file and adjust PDF or use manual cleanup

### PDF Extraction Failed
```bash
❌ PDF extraction failed: File corrupted
```
**Solution**: Try different PDF or convert to text first

## 📁 Output File Structure

```
./data/
├── vocabulary-A1-vocabulary.csv    # Ready for import
├── vocabulary-errors.txt           # Review and fix
└── original-vocabulary.pdf         # Your source file
```

## 🎯 Supported Sources

Works great with:
- **Goethe Institute** vocabulary lists
- **TELC** examination glossaries  
- **University** German course materials
- **Textbook** appendices
- **Custom** vocabulary lists

## 🔍 Format Detection

The script automatically:
1. **Analyzes** first 20 lines of PDF
2. **Scores** each format pattern
3. **Selects** best matching format
4. **Reports** detection confidence

## ⚡ Advanced Usage

### Custom Output Format
The script outputs in "Goethe" format by default (perfect for your bot):
```csv
German,English
der Saft,juice
```

### Error Review
Always check the error file to see what couldn't be parsed:
```bash
cat ./data/vocabulary-errors.txt
```

## 🎉 Success Story

```bash
🚀 Starting extraction from: ./goethe-a1.pdf
✅ Extracted 15847 characters from PDF
🎯 Detected format: goethe
📝 Processing 156 lines with goethe format...
✅ Parsed 150 vocabulary entries
✅ Exported 150 entries to ./data/goethe-a1-A1-vocabulary.csv

🎉 Extraction completed successfully!
📊 Summary:
  - Total entries: 150
  - Errors: 6
  - Success rate: 96%

🔄 Next steps:
  1. Review the CSV file
  2. Import to bot: npm run import-vocab "./data/goethe-a1-A1-vocabulary.csv" A1 goethe
```

Now you can convert any German vocabulary PDF into your bot! 🇩🇪✨