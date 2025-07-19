const axios = require('axios');

class WordAnalyzer {
  constructor() {
    this.providers = {
      ollama: {
        url: process.env.OLLAMA_URL || 'http://localhost:11434/api/generate',
        model: process.env.OLLAMA_MODEL || 'llama3.1:8b'
      },
      openai: {
        url: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions',
        key: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo'
      },
      groq: {
        url: 'https://api.groq.com/openai/v1/chat/completions',
        key: process.env.GROQ_API_KEY,
        model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant'
      },
      anthropic: {
        url: 'https://api.anthropic.com/v1/messages',
        key: process.env.ANTHROPIC_API_KEY,
        model: 'claude-3-haiku-20240307'
      }
    };
    
    this.defaultProvider = process.env.LLM_PROVIDER || 'ollama';
  }

  /**
   * Analyze German word and provide complete flashcard information
   */
  async analyzeWord(germanWord, englishTranslation, userLevel = 'A1') {
    const prompt = this.buildAnalysisPrompt(germanWord, englishTranslation, userLevel);
    
    try {
      const analysis = await this.callLLM(prompt);
      return this.parseAnalysis(analysis, germanWord, englishTranslation);
    } catch (error) {
      console.error(`Word analysis failed for "${germanWord}": ${error.message}`);
      console.log('💡 Using fallback analysis - configure LLM provider in .env for better results');
      return this.getFallbackAnalysis(germanWord, englishTranslation);
    }
  }

  buildAnalysisPrompt(germanWord, englishTranslation, userLevel) {
    return `
You are a German language expert. Analyze this German word for language learners.

German word: "${germanWord}"
English translation: "${englishTranslation}"
User level: ${userLevel}

Provide ONLY a JSON response with this exact structure:
{
  "word_type": "noun|verb|adjective|adverb|other",
  "german_display": "the word with article if noun, or just the word",
  "pronunciation": "IPA pronunciation",
  "example_sentence": "simple German sentence using the word",
  "example_translation": "English translation of the example",
  "grammar_note": "brief grammar tip (max 10 words)",
  "difficulty": "easy|medium|hard",
  "level_suggestion": "A1|A2|B1|B2|C1|C2"
}

Rules:
- For NOUNS: Include correct article (der/die/das) in german_display
- For VERBS: Use infinitive form in german_display
- For ADJECTIVES/ADVERBS: Use base form in german_display
- Example sentences should be simple and appropriate for ${userLevel} level
- Grammar notes should be very brief and helpful
- Be accurate with articles and conjugations

Respond with ONLY the JSON, no other text.
    `;
  }

  async callLLM(prompt) {
    const providers = [this.defaultProvider, 'groq', 'ollama', 'openai', 'anthropic'];
    const uniqueProviders = [...new Set(providers)];
    
    for (const provider of uniqueProviders) {
      try {
        const result = await this.callProvider(provider, prompt);
        if (result) {
          console.log(`✅ Word analysis successful using ${provider}`);
          return result;
        }
      } catch (error) {
        console.log(`❌ ${provider} failed: ${error.message}`);
        continue;
      }
    }
    
    throw new Error('All LLM providers failed');
  }

  async callProvider(provider, prompt) {
    const config = this.providers[provider];
    
    switch (provider) {
      case 'ollama':
        return await this.callOllama(prompt, config);
      case 'openai':
        return await this.callOpenAI(prompt, config);
      case 'groq':
        return await this.callGroq(prompt, config);
      case 'anthropic':
        return await this.callAnthropic(prompt, config);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  async callOllama(prompt, config) {
    if (!config.url) {
      throw new Error('Ollama URL not configured');
    }

    const response = await axios.post(config.url, {
      model: config.model,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.1,
        top_p: 0.9
      }
    }, {
      timeout: 30000
    });

    return response.data.response;
  }

  async callOpenAI(prompt, config) {
    if (!config.key) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await axios.post(config.url, {
      model: config.model,
      messages: [
        { role: 'system', content: 'You are a German language expert. Respond only with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 300,
      temperature: 0.1
    }, {
      headers: {
        'Authorization': `Bearer ${config.key}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content;
  }

  async callGroq(prompt, config) {
    if (!config.key) {
      throw new Error('Groq API key not configured');
    }

    const response = await axios.post(config.url, {
      model: config.model,
      messages: [
        { role: 'system', content: 'You are a German language expert. Respond only with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 300,
      temperature: 0.1
    }, {
      headers: {
        'Authorization': `Bearer ${config.key}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content;
  }

  async callAnthropic(prompt, config) {
    if (!config.key) {
      throw new Error('Anthropic API key not configured');
    }

    const response = await axios.post(config.url, {
      model: config.model,
      max_tokens: 300,
      messages: [
        { role: 'user', content: prompt }
      ]
    }, {
      headers: {
        'x-api-key': config.key,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      }
    });

    return response.data.content[0].text;
  }

  parseAnalysis(llmResponse, germanWord, englishTranslation) {
    try {
      // Extract JSON from response
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const analysis = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      const required = ['word_type', 'german_display', 'example_sentence'];
      for (const field of required) {
        if (!analysis[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      return {
        word_type: analysis.word_type || 'unknown',
        german_display: analysis.german_display || germanWord,
        pronunciation: analysis.pronunciation || '',
        example_sentence: analysis.example_sentence || '',
        example_translation: analysis.example_translation || '',
        grammar_note: analysis.grammar_note || '',
        difficulty: analysis.difficulty || 'medium',
        level_suggestion: analysis.level_suggestion || 'A1',
        english_translation: englishTranslation,
        analyzed_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to parse LLM response:', error.message);
      throw new Error(`Invalid LLM response: ${error.message}`);
    }
  }

  getFallbackAnalysis(germanWord, englishTranslation) {
    // Simple rule-based fallback when LLM fails
    const wordType = this.guessWordType(germanWord);
    const article = this.guessArticle(germanWord);
    
    return {
      word_type: wordType,
      german_display: article ? `${article} ${germanWord}` : germanWord,
      pronunciation: '',
      example_sentence: this.generateSimpleExample(germanWord, article),
      example_translation: `This is an example with ${englishTranslation}`,
      grammar_note: wordType === 'noun' ? 'Remember the article!' : 'Practice conjugation',
      difficulty: 'medium',
      level_suggestion: 'A1',
      english_translation: englishTranslation,
      analyzed_at: new Date().toISOString(),
      fallback: true
    };
  }

  guessWordType(word) {
    // German nouns are capitalized
    if (word.charAt(0) === word.charAt(0).toUpperCase()) {
      return 'noun';
    }
    
    // Common verb endings
    if (word.endsWith('en') || word.endsWith('ieren')) {
      return 'verb';
    }
    
    // Common adjective endings
    if (word.endsWith('ig') || word.endsWith('lich') || word.endsWith('isch')) {
      return 'adjective';
    }
    
    return 'unknown';
  }

  guessArticle(word) {
    if (word.charAt(0) !== word.charAt(0).toUpperCase()) {
      return null; // Not a noun
    }
    
    // Simple heuristics
    if (word.endsWith('ung') || word.endsWith('heit') || word.endsWith('keit')) {
      return 'die';
    }
    if (word.endsWith('chen') || word.endsWith('lein')) {
      return 'das';
    }
    
    return 'der'; // Default
  }

  generateSimpleExample(word, article) {
    if (article) {
      return `Das ist ${article} ${word}.`;
    } else {
      return `Ich ${word}.`;
    }
  }

  /**
   * Batch analyze multiple words (for efficient processing)
   */
  async analyzeWordBatch(wordPairs, userLevel = 'A1') {
    const results = [];
    const errors = [];
    
    for (const [germanWord, englishTranslation] of wordPairs) {
      try {
        const analysis = await this.analyzeWord(germanWord, englishTranslation, userLevel);
        results.push({
          german_word: germanWord,
          ...analysis
        });
        
        // Small delay to be respectful to APIs
        await this.delay(500);
      } catch (error) {
        errors.push({
          german_word: germanWord,
          english_translation: englishTranslation,
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
      this.providers.ollama.url ||
      this.providers.openai.key ||
      this.providers.anthropic.key
    );
  }

  getAvailableProviders() {
    const available = [];
    
    if (this.providers.ollama.url) available.push('ollama');
    if (this.providers.openai.key) available.push('openai');
    if (this.providers.anthropic.key) available.push('anthropic');
    
    return available;
  }
}

module.exports = new WordAnalyzer();