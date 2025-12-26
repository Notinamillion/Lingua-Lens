// OpenAI API Integration for Smart Translation
// OpenAI Chat Completions API

const OpenAIAPI = {
  // API Configuration
  API_BASE_URL: 'https://api.openai.com/v1',

  // Model options
  MODELS: {
    GPT4O_MINI: 'gpt-4o-mini',           // Cheapest ($0.15/$0.60 per 1M tokens)
    GPT4O: 'gpt-4o',                     // Balanced ($2.50/$10 per 1M tokens)
    GPT4_TURBO: 'gpt-4-turbo-preview'    // Most capable ($10/$30 per 1M tokens)
  },

  // Cost tracking
  usage: {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCost: 0
  },

  /**
   * Main translation function - Translates English to Chinese, only known words
   * @param {string} englishText - The English sentence to translate
   * @param {Object} knownWords - Dictionary of known English words with Chinese translations
   * @param {string} apiKey - OpenAI API key
   * @param {string} model - Model to use (default: GPT4O_MINI for cost efficiency)
   * @returns {Promise<Object>} - { mixedText, usage, cost }
   */
  async translateEnglishToChinese(englishText, knownWords, apiKey, model = this.MODELS.GPT4O_MINI) {
    try {
      // Validate API key
      if (!apiKey || typeof apiKey !== 'string') {
        throw new Error('API key is required and must be a string');
      }

      const trimmedKey = apiKey.trim();
      if (trimmedKey.length === 0) {
        throw new Error('API key cannot be empty');
      }

      if (!trimmedKey.startsWith('sk-')) {
        throw new Error('Invalid API key format. OpenAI API keys should start with "sk-"');
      }

      console.log('[OPENAI API] API Key Debug:', {
        originalLength: apiKey.length,
        trimmedLength: trimmedKey.length,
        prefix: trimmedKey.substring(0, 8),
        hasWhitespace: apiKey !== trimmedKey
      });

      // Build vocabulary list
      const knownWordsList = Object.values(knownWords)
        .filter(data => data.translation)
        .map(data => `  - ${data.original} → ${data.translation}`)
        .join('\n');

      console.log('[OPENAI API] Known words count:', Object.keys(knownWords).length);

      // Construct the prompt
      const prompt = this._buildTranslationPrompt(englishText, knownWordsList);

      console.log('[OPENAI API] Sending request to OpenAI...');
      console.log('[OPENAI API] Model:', model);
      console.log('[OPENAI API] Text length:', englishText.length);

      // Make API call
      const response = await this._makeRequest({
        model: model,
        messages: [{
          role: 'system',
          content: 'You are a Chinese language learning assistant helping users practice reading by selectively translating words.'
        }, {
          role: 'user',
          content: prompt
        }],
        temperature: 0.3,
        max_tokens: 4096
      }, trimmedKey);

      // Extract result
      const mixedText = response.choices[0].message.content.trim();

      // Track usage
      const usage = response.usage;
      this._trackUsage(usage, model);

      console.log('[OPENAI API] Translation complete');
      console.log('[OPENAI API] Input tokens:', usage.prompt_tokens);
      console.log('[OPENAI API] Output tokens:', usage.completion_tokens);
      console.log('[OPENAI API] Estimated cost: $', this._calculateCost(usage, model).toFixed(6));

      // Parse the mixed text to create word mappings for hover tooltips
      const wordMappings = this._parseWordMappings(englishText, mixedText, knownWords);

      return {
        mixedText: mixedText,
        originalText: englishText,
        wordMappings: wordMappings,  // NEW: Array of word mappings for tooltips
        usage: {
          input_tokens: usage.prompt_tokens,
          output_tokens: usage.completion_tokens
        },
        cost: this._calculateCost(usage, model),
        model: model
      };

    } catch (error) {
      console.error('[OPENAI API] Translation error:', error);
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  },

  /**
   * Build the translation prompt - Context-first approach
   */
  _buildTranslationPrompt(englishText, vocabList) {
    // Extract just the Chinese words the user knows from the vocab list
    const knownChineseWords = vocabList
      .split('\n')
      .map(line => {
        const match = line.match(/→\s*(.+)$/);
        return match ? match[1].trim() : null;
      })
      .filter(Boolean)
      .join(', ');

    return `You are a Chinese language learning assistant. Your task is to create a mixed English-Chinese text that helps learners practice reading Chinese words they know.

STEP 1: First, translate the entire English sentence to natural, contextually correct Chinese.

STEP 2: Then, identify which Chinese characters/words in your translation are NOT in the user's known vocabulary list below.

STEP 3: Replace those unknown Chinese characters/words with their corresponding English words from the original sentence.

KNOWN CHINESE VOCABULARY (keep these in Chinese):
${knownChineseWords}

CRITICAL INSTRUCTIONS:
1. First translate to completely natural Chinese (context-aware, not word-by-word)
2. Then ONLY keep Chinese characters/words that appear in the known vocabulary list
3. Replace all other Chinese with the corresponding English from the original sentence
4. Maintain proper spacing between mixed English and Chinese
5. Output ONLY the final mixed text, NO explanations

EXAMPLE:
Known Chinese vocabulary: 这, 是, 好
Step 1 - Full translation: "The weather is good today" → "今天天气很好"
Step 2 - Check vocabulary: 今天(unknown), 天气(unknown), 很(unknown), 好(known)
Step 3 - Replace unknown: "today weather very 好"
Final output: "today weather very 好"

NOW PROCESS THIS SENTENCE:
"${englishText}"

MIXED OUTPUT:`;
  },

  /**
   * Parse mixed text to create word mappings for hover tooltips
   * Returns array of {text, isChinese, englishWord, chineseWord}
   */
  _parseWordMappings(originalText, mixedText, knownWords) {
    const mappings = [];
    const mixedWords = mixedText.split(/\s+/);
    const originalWords = originalText.split(/\s+/);

    // Create lowercase lookup for known words
    const knownWordsLookup = {};
    Object.values(knownWords).forEach(data => {
      if (data.translation) {
        knownWordsLookup[data.original.toLowerCase()] = data.translation;
      }
    });

    // Helper to detect if text contains Chinese characters
    const hasChinese = (text) => /[\u4e00-\u9fa5]/.test(text);

    // Build mappings by comparing original and mixed
    for (let i = 0; i < mixedWords.length; i++) {
      const mixedWord = mixedWords[i];
      const originalWord = originalWords[i] || '';

      if (hasChinese(mixedWord)) {
        // This word was translated to Chinese
        mappings.push({
          text: mixedWord,
          isChinese: true,
          englishWord: originalWord,  // Original English word
          chineseWord: mixedWord
        });
      } else {
        // This word remained in English
        const chineseTranslation = knownWordsLookup[mixedWord.toLowerCase()];
        mappings.push({
          text: mixedWord,
          isChinese: false,
          englishWord: mixedWord,
          chineseWord: chineseTranslation || null  // null if not in vocab
        });
      }
    }

    console.log('[OPENAI API] Created', mappings.length, 'word mappings');
    return mappings;
  },

  /**
   * Make API request to OpenAI
   */
  async _makeRequest(payload, apiKey) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    const response = await fetch(`${this.API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const errorMessage = errorData.error?.message || response.statusText;
      const errorType = errorData.error?.type || 'unknown_error';

      console.error('[OPENAI API] Full error response:', errorData);
      console.error('[OPENAI API] Status:', response.status);
      console.error('[OPENAI API] Error type:', errorType);

      throw new Error(`${errorType}: ${errorMessage} (HTTP ${response.status})`);
    }

    return await response.json();
  },

  /**
   * Calculate cost for API usage
   */
  _calculateCost(usage, model) {
    const costs = {
      [this.MODELS.GPT4O_MINI]: { input: 0.15 / 1000000, output: 0.60 / 1000000 },
      [this.MODELS.GPT4O]: { input: 2.50 / 1000000, output: 10 / 1000000 },
      [this.MODELS.GPT4_TURBO]: { input: 10 / 1000000, output: 30 / 1000000 }
    };

    const modelCost = costs[model] || costs[this.MODELS.GPT4O_MINI];
    const inputCost = usage.prompt_tokens * modelCost.input;
    const outputCost = usage.completion_tokens * modelCost.output;

    return inputCost + outputCost;
  },

  /**
   * Track cumulative usage
   */
  _trackUsage(usage, model) {
    this.usage.totalInputTokens += usage.prompt_tokens;
    this.usage.totalOutputTokens += usage.completion_tokens;
    this.usage.totalCost += this._calculateCost(usage, model);
  },

  /**
   * Get usage statistics
   */
  getUsageStats() {
    return {
      totalInputTokens: this.usage.totalInputTokens,
      totalOutputTokens: this.usage.totalOutputTokens,
      totalCost: this.usage.totalCost.toFixed(6)
    };
  },

  /**
   * Reset usage statistics
   */
  resetUsageStats() {
    this.usage = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0
    };
  }
};

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.OpenAIAPI = OpenAIAPI;
}
