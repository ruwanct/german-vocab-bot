const axios = require('axios');

class AIEnrichment {
  constructor() {
    this.models = {
      openai: {
        url: 'https://api.openai.com/v1/chat/completions',
        key: process.env.OPENAI_API_KEY,
        model: 'gpt-3.5-turbo'
      },
      anthropic: {
        url: 'https://api.anthropic.com/v1/messages',
        key: process.env.ANTHROPIC_API_KEY,
        model: 'claude-3-haiku-20240307'
      },
      ollama: {
        url: process.env.OLLAMA_URL || 'http://localhost:11434/api/generate',
        model: 'llama3.1:8b'
      }
    };
  }

  async enrichGermanWord(word, existingTranslation) {
    const prompt = `
You are a German language expert. For the German word "${word}" with English translation "${existingTranslation}", provide:

1. Correct German article (der, die, das) - if it's a noun
2. Pronunciation in IPA format
3. A simple German example sentence
4. Word type (noun, verb, adjective, etc.)
5. CEFR level (A1, A2, B1, B2, C1, C2)
6. Category (e.g., food, family, transportation, etc.)

Respond ONLY in this JSON format:
{
  "article": "der|die|das|null",
  "pronunciation": "IPA pronunciation",
  "example_sentence": "German example sentence",
  "word_type": "noun|verb|adjective|etc",
  "level": "A1|A2|B1|B2|C1|C2",
  "category": "category_name"
}
    `;

    try {
      // Try different models in order of preference
      return await this.tryWithModels(prompt, word);
    } catch (error) {
      console.error(`AI enrichment failed for "${word}":`, error.message);
      return this.getFallbackEnrichment(word, existingTranslation);
    }
  }

  async tryWithModels(prompt, word) {
    const models = ['ollama', 'openai', 'anthropic']; // Order by cost (free first)
    
    for (const modelName of models) {
      try {
        const result = await this.callModel(modelName, prompt);
        if (result) {
          console.log(`AI enrichment successful for "${word}" using ${modelName}`);
          return result;
        }
      } catch (error) {
        console.log(`${modelName} failed for "${word}": ${error.message}`);
        continue;
      }
    }
    
    throw new Error('All AI models failed');
  }

  async callModel(modelName, prompt) {
    const model = this.models[modelName];
    
    switch (modelName) {
      case 'openai':
        return await this.callOpenAI(prompt);
      case 'anthropic':
        return await this.callAnthropic(prompt);
      case 'ollama':
        return await this.callOllama(prompt);
      default:
        throw new Error(`Unknown model: ${modelName}`);
    }
  }

  async callOpenAI(prompt) {
    if (!this.models.openai.key) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await axios.post(this.models.openai.url, {
      model: this.models.openai.model,
      messages: [
        { role: 'system', content: 'You are a German language expert.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 200,
      temperature: 0.1
    }, {
      headers: {
        'Authorization': `Bearer ${this.models.openai.key}`,
        'Content-Type': 'application/json'
      }
    });

    const content = response.data.choices[0].message.content;
    return this.parseAIResponse(content);
  }

  async callAnthropic(prompt) {
    if (!this.models.anthropic.key) {
      throw new Error('Anthropic API key not configured');
    }

    const response = await axios.post(this.models.anthropic.url, {
      model: this.models.anthropic.model,
      max_tokens: 200,
      messages: [
        { role: 'user', content: prompt }
      ]
    }, {
      headers: {
        'x-api-key': this.models.anthropic.key,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      }
    });

    const content = response.data.content[0].text;
    return this.parseAIResponse(content);
  }

  async callOllama(prompt) {
    // Ollama (free local model)
    const response = await axios.post(this.models.ollama.url, {
      model: this.models.ollama.model,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.1,
        top_p: 0.9
      }
    }, {
      timeout: 30000
    });

    return this.parseAIResponse(response.data.response);
  }

  parseAIResponse(content) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Validate the response structure
        if (this.validateAIResponse(parsed)) {
          return parsed;
        }
      }
      
      throw new Error('Invalid AI response format');
    } catch (error) {
      console.error('Failed to parse AI response:', error.message);
      throw error;
    }
  }

  validateAIResponse(response) {
    const required = ['word_type', 'level', 'category'];
    return required.every(field => response.hasOwnProperty(field));
  }

  getFallbackEnrichment(word, translation) {
    // Simple fallback when AI fails
    return {
      article: this.guessArticle(word),
      pronunciation: '',
      example_sentence: this.generateSimpleExample(word),
      word_type: this.guessWordType(word),
      level: this.guessLevel(word),
      category: this.guessCategory(word, translation)
    };
  }

  guessArticle(word) {
    // German nouns are capitalized
    if (word.charAt(0) === word.charAt(0).toUpperCase()) {
      // Simple heuristics for German articles
      if (word.endsWith('ung') || word.endsWith('heit') || word.endsWith('keit')) {
        return 'die';
      }
      if (word.endsWith('chen') || word.endsWith('lein')) {
        return 'das';
      }
      // Default to 'der' for unknown nouns
      return 'der';
    }
    return null; // Not a noun
  }

  guessWordType(word) {
    if (word.charAt(0) === word.charAt(0).toUpperCase()) {
      return 'noun';
    }
    if (word.endsWith('en') || word.endsWith('ieren')) {
      return 'verb';
    }
    return 'unknown';
  }

  guessLevel(word) {
    if (word.length <= 5) return 'A1';
    if (word.length <= 8) return 'A2';
    if (word.length <= 12) return 'B1';
    return 'B2';
  }

  guessCategory(word, translation) {
    const categories = {
      'food': ['essen', 'trinken', 'brot', 'food', 'eat', 'drink'],
      'family': ['mutter', 'vater', 'kind', 'family', 'mother', 'father'],
      'home': ['haus', 'wohnung', 'zimmer', 'house', 'room', 'home'],
      'body': ['kopf', 'hand', 'auge', 'head', 'hand', 'eye'],
      'clothing': ['kleidung', 'hemd', 'hose', 'clothes', 'shirt']
    };

    const combined = `${word} ${translation}`.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => combined.includes(keyword))) {
        return category;
      }
    }
    
    return 'general';
  }

  generateSimpleExample(word) {
    if (word.charAt(0) === word.charAt(0).toUpperCase()) {
      // It's a noun
      return `Das ist ${this.guessArticle(word)} ${word}.`;
    } else {
      // It's likely a verb
      return `Ich ${word}.`;
    }
  }

  async batchEnrichVocabulary(words, maxWords = 10) {
    const results = [];
    const errors = [];
    
    for (const word of words.slice(0, maxWords)) {
      try {
        const enriched = await this.enrichGermanWord(word.word, word.translation_en);
        results.push({
          ...word,
          ...enriched,
          source: 'ai_enriched'
        });
        
        // Small delay to be respectful to APIs
        await this.delay(1000);
      } catch (error) {
        errors.push({
          word: word.word,
          error: error.message
        });
      }
    }
    
    return { results, errors };
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  isConfigured() {
    return !!(
      this.models.openai.key || 
      this.models.anthropic.key || 
      this.models.ollama.url
    );
  }
}

module.exports = new AIEnrichment();