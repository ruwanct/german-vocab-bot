#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const csv = require('csv-writer');

/**
 * PDF to German Vocabulary CSV Converter
 * 
 * This script extracts German vocabulary from PDF glossaries and converts them to CSV format
 * for import into the German Vocab Bot.
 * 
 * Supported formats:
 * - Goethe Institute PDFs
 * - Standard German-English glossaries
 * - Custom format detection
 */

class PDFVocabularyExtractor {
  constructor() {
    this.supportedFormats = [
      'goethe',      // "der Saft - juice"
      'standard',    // "Saft (der) - juice" 
      'simple',      // "der Saft, juice"
      'telc',        // "Saft, der - juice"
      'custom'       // User-defined patterns
    ];
    
    this.germanArticles = ['der', 'die', 'das'];
  }

  /**
   * Extract text from PDF using pdf-parse
   */
  async extractTextFromPDF(pdfPath) {
    try {
      // Try to require pdf-parse
      let pdfParse;
      try {
        pdfParse = require('pdf-parse');
      } catch (error) {
        console.error('❌ pdf-parse not found. Installing...');
        const { execSync } = require('child_process');
        execSync('npm install pdf-parse', { stdio: 'inherit' });
        pdfParse = require('pdf-parse');
      }

      const pdfBuffer = fs.readFileSync(pdfPath);
      const data = await pdfParse(pdfBuffer);
      
      console.log(`✅ Extracted ${data.text.length} characters from PDF`);
      return data.text;
    } catch (error) {
      throw new Error(`PDF extraction failed: ${error.message}`);
    }
  }

  /**
   * Detect the format of the vocabulary list
   */
  detectFormat(text) {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const sampleLines = lines.slice(0, 20);
    
    let formatScores = {
      goethe: 0,
      standard: 0,
      simple: 0,
      telc: 0
    };

    sampleLines.forEach(line => {
      const cleanLine = line.trim();
      
      // Goethe format: "der Saft - juice"
      if (/^(der|die|das)\s+\w+\s*[-–]\s*\w+/.test(cleanLine)) {
        formatScores.goethe++;
      }
      
      // Standard format: "Saft (der) - juice"
      if (/^\w+\s*\((der|die|das)\)\s*[-–]\s*\w+/.test(cleanLine)) {
        formatScores.standard++;
      }
      
      // Simple format: "der Saft, juice"
      if (/^(der|die|das)\s+\w+\s*,\s*\w+/.test(cleanLine)) {
        formatScores.simple++;
      }
      
      // TELC format: "Saft, der - juice"
      if (/^\w+\s*,\s*(der|die|das)\s*[-–]\s*\w+/.test(cleanLine)) {
        formatScores.telc++;
      }
    });

    const detectedFormat = Object.keys(formatScores).reduce((a, b) => 
      formatScores[a] > formatScores[b] ? a : b
    );
    
    console.log('📊 Format detection scores:', formatScores);
    console.log(`🎯 Detected format: ${detectedFormat}`);
    
    return detectedFormat;
  }

  /**
   * Parse vocabulary based on detected format
   */
  parseVocabulary(text, format) {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const vocabulary = [];
    let errors = [];

    console.log(`📝 Processing ${lines.length} lines with ${format} format...`);

    lines.forEach((line, index) => {
      try {
        const parsed = this.parseLine(line.trim(), format);
        if (parsed) {
          vocabulary.push({
            ...parsed,
            source_line: index + 1,
            original_text: line.trim()
          });
        }
      } catch (error) {
        errors.push({
          line: index + 1,
          text: line.trim(),
          error: error.message
        });
      }
    });

    console.log(`✅ Parsed ${vocabulary.length} vocabulary entries`);
    if (errors.length > 0) {
      console.log(`⚠️  ${errors.length} parsing errors (see output for details)`);
    }

    return { vocabulary, errors };
  }

  /**
   * Parse individual line based on format
   */
  parseLine(line, format) {
    // Skip empty lines, headers, page numbers
    if (!line || line.length < 3 || /^\d+$/.test(line) || /^page|seite/i.test(line)) {
      return null;
    }

    let word, article, translation;

    switch (format) {
      case 'goethe':
        // "der Saft - juice"
        const goetheMatch = line.match(/^(der|die|das)\s+([^-–]+)[-–]\s*(.+)$/i);
        if (goetheMatch) {
          article = goetheMatch[1].toLowerCase();
          word = goetheMatch[2].trim();
          translation = goetheMatch[3].trim();
        }
        break;

      case 'standard':
        // "Saft (der) - juice"
        const standardMatch = line.match(/^([^(]+)\s*\((der|die|das)\)\s*[-–]\s*(.+)$/i);
        if (standardMatch) {
          word = standardMatch[1].trim();
          article = standardMatch[2].toLowerCase();
          translation = standardMatch[3].trim();
        }
        break;

      case 'simple':
        // "der Saft, juice"
        const simpleMatch = line.match(/^(der|die|das)\s+([^,]+),\s*(.+)$/i);
        if (simpleMatch) {
          article = simpleMatch[1].toLowerCase();
          word = simpleMatch[2].trim();
          translation = simpleMatch[3].trim();
        }
        break;

      case 'telc':
        // "Saft, der - juice"
        const telcMatch = line.match(/^([^,]+),\s*(der|die|das)\s*[-–]\s*(.+)$/i);
        if (telcMatch) {
          word = telcMatch[1].trim();
          article = telcMatch[2].toLowerCase();
          translation = telcMatch[3].trim();
        }
        break;

      default:
        return null;
    }

    if (word && translation) {
      return {
        word: this.cleanWord(word),
        article: article || null,
        translation: this.cleanTranslation(translation),
        word_with_article: article ? `${article} ${this.cleanWord(word)}` : this.cleanWord(word)
      };
    }

    return null;
  }

  /**
   * Clean and normalize German word
   */
  cleanWord(word) {
    return word
      .replace(/[^\w\säöüÄÖÜß-]/g, '') // Remove special chars except German umlauts
      .trim()
      .replace(/\s+/g, ' '); // Normalize spaces
  }

  /**
   * Clean and normalize English translation
   */
  cleanTranslation(translation) {
    return translation
      .replace(/[^\w\s,;()-]/g, '') // Keep basic punctuation
      .trim()
      .replace(/\s+/g, ' ') // Normalize spaces
      .toLowerCase();
  }

  /**
   * Export vocabulary to CSV
   */
  async exportToCSV(vocabulary, outputPath, format = 'goethe') {
    const csvWriter = csv.createObjectCsvWriter({
      path: outputPath,
      header: format === 'goethe' ? [
        { id: 'word_with_article', title: 'German' },
        { id: 'translation', title: 'English' }
      ] : [
        { id: 'word', title: 'Word' },
        { id: 'article', title: 'Article' },
        { id: 'translation', title: 'Translation' }
      ]
    });

    const csvData = vocabulary.map(item => {
      if (format === 'goethe') {
        return {
          word_with_article: item.word_with_article,
          translation: item.translation
        };
      } else {
        return {
          word: item.word,
          article: item.article || '',
          translation: item.translation
        };
      }
    });

    await csvWriter.writeRecords(csvData);
    console.log(`✅ Exported ${csvData.length} entries to ${outputPath}`);
  }

  /**
   * Save errors to file for review
   */
  saveErrors(errors, errorPath) {
    if (errors.length === 0) return;

    const errorContent = errors.map(err => 
      `Line ${err.line}: "${err.text}" - Error: ${err.error}`
    ).join('\n');

    fs.writeFileSync(errorPath, errorContent);
    console.log(`📋 Saved ${errors.length} errors to ${errorPath}`);
  }

  /**
   * Main extraction process
   */
  async extractVocabulary(pdfPath, outputDir, level = 'A1', options = {}) {
    try {
      console.log(`🚀 Starting extraction from: ${pdfPath}`);
      
      // Extract text from PDF
      const text = await this.extractTextFromPDF(pdfPath);
      
      // Detect format
      const format = options.format || this.detectFormat(text);
      
      // Parse vocabulary
      const { vocabulary, errors } = this.parseVocabulary(text, format);
      
      if (vocabulary.length === 0) {
        throw new Error('No vocabulary found in PDF. Check format or content.');
      }

      // Create output directory
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Generate file names
      const baseName = path.basename(pdfPath, path.extname(pdfPath));
      const csvPath = path.join(outputDir, `${baseName}-${level}-vocabulary.csv`);
      const errorPath = path.join(outputDir, `${baseName}-errors.txt`);

      // Export to CSV
      await this.exportToCSV(vocabulary, csvPath, 'goethe');
      
      // Save errors if any
      if (errors.length > 0) {
        this.saveErrors(errors, errorPath);
      }

      console.log(`\n🎉 Extraction completed successfully!`);
      console.log(`📁 Output files:`);
      console.log(`  - Vocabulary: ${csvPath}`);
      if (errors.length > 0) {
        console.log(`  - Errors: ${errorPath}`);
      }

      console.log(`\n📊 Summary:`);
      console.log(`  - Total entries: ${vocabulary.length}`);
      console.log(`  - Errors: ${errors.length}`);
      console.log(`  - Success rate: ${Math.round((vocabulary.length / (vocabulary.length + errors.length)) * 100)}%`);

      console.log(`\n🔄 Next steps:`);
      console.log(`  1. Review the CSV file: ${csvPath}`);
      console.log(`  2. Import to bot: npm run import-vocab "${csvPath}" ${level} goethe`);
      
      return {
        csvPath,
        vocabulary,
        errors,
        stats: {
          total: vocabulary.length,
          errors: errors.length,
          successRate: Math.round((vocabulary.length / (vocabulary.length + errors.length)) * 100)
        }
      };

    } catch (error) {
      console.error(`❌ Extraction failed: ${error.message}`);
      throw error;
    }
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
📄 PDF to German Vocabulary CSV Converter

Usage:
  node src/scripts/pdfToVocab.js <pdf-file> [level] [output-dir]

Examples:
  node src/scripts/pdfToVocab.js ./goethe-a1.pdf A1 ./output
  node src/scripts/pdfToVocab.js ./vocabulary.pdf B1
  node src/scripts/pdfToVocab.js ./german-words.pdf A2 ./data

Parameters:
  pdf-file    Path to the PDF glossary file
  level       CEFR level (A1, A2, B1, B2, C1, C2) - default: A1
  output-dir  Output directory - default: ./data

Supported PDF formats:
  - Goethe Institute glossaries
  - Standard German-English word lists
  - Custom vocabulary PDFs

The script will:
  1. Extract text from PDF
  2. Auto-detect vocabulary format
  3. Parse German words with articles
  4. Export to CSV for bot import
  5. Generate error report for review
    `);
    process.exit(1);
  }

  const pdfPath = args[0];
  const level = args[1] || 'A1';
  const outputDir = args[2] || './data';

  if (!fs.existsSync(pdfPath)) {
    console.error(`❌ PDF file not found: ${pdfPath}`);
    process.exit(1);
  }

  const extractor = new PDFVocabularyExtractor();
  
  try {
    await extractor.extractVocabulary(pdfPath, outputDir, level);
  } catch (error) {
    console.error(`❌ Failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = PDFVocabularyExtractor;