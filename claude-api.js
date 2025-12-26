// Claude API Integration for Smart Translation
// Anthropic API v1 - Messages endpoint

const ClaudeAPI = {
  // API Configuration
  API_BASE_URL: 'https://api.anthropic.com/v1',
  API_VERSION: '2023-06-01',

  // Model options
  MODELS: {
    HAIKU: 'claude-3-5-haiku-20241022',      // Fast & cheap ($0.25/$1.25 per 1M tokens)
    SONNET: 'claude-3-5-sonnet-20241022',    // Balanced ($3/$15 per 1M tokens)
    OPUS: 'claude-3-opus-20240229'           // Most capable (expensive)
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
   * @param {string} apiKey - Anthropic API key
   * @param {string} model - Model to use (default: HAIKU for cost efficiency)
   * @returns {Promise<Object>} - { mixedText, analysis, usage, cost }
   */
  async translateEnglishToChinese(englishText, knownWords, apiKey, model = this.MODELS.HAIKU) {
    try {
      // Validate API key
      if (!apiKey || typeof apiKey !== 'string') {
        throw new Error('API key is required and must be a string');
      }

      const trimmedKey = apiKey.trim();
      if (trimmedKey.length === 0) {
        throw new Error('API key cannot be empty');
      }

      if (!trimmedKey.startsWith('sk-ant-')) {
        throw new Error('Invalid API key format. Claude API keys should start with "sk-ant-"');
      }

      console.log('[CLAUDE API] API Key Debug:', {
        originalLength: apiKey.length,
        trimmedLength: trimmedKey.length,
        prefix: trimmedKey.substring(0, 12),
        hasWhitespace: apiKey !== trimmedKey,
        hasInternalWhitespace: /\s/.test(trimmedKey)
      });

      // Build known vocabulary list for prompt
      const knownWordsList = Object.entries(knownWords)
        .filter(([key, data]) => data.translation) // Only words with translations
        .map(([key, data]) => `${data.original} (${data.translation})`)
        .join(', ');

      // Build list of known English words for matching
      const knownEnglishWords = Object.values(knownWords)
        .filter(data => data.translation)
        .map(data => data.original.toLowerCase());

      console.log('[CLAUDE API] Known words count:', knownEnglishWords.length);

      // Construct the prompt
      const prompt = this._buildTranslationPrompt(englishText, knownWords);

      console.log('[CLAUDE API] Sending request to Claude...');
      console.log('[CLAUDE API] Model:', model);
      console.log('[CLAUDE API] Text length:', englishText.length);

      // Make API call (use trimmed key)
      const response = await this._makeRequest({
        model: model,
        max_tokens: 4096,
        temperature: 0.3, // Low temperature for consistent translation
        messages: [{
          role: 'user',
          content: prompt
        }]
      }, trimmedKey);

      // Extract result
      const mixedText = response.content[0].text.trim();

      // Track usage
      const usage = response.usage;
      this._trackUsage(usage, model);

      console.log('[CLAUDE API] Translation complete');
      console.log('[CLAUDE API] Input tokens:', usage.input_tokens);
      console.log('[CLAUDE API] Output tokens:', usage.output_tokens);
      console.log('[CLAUDE API] Estimated cost: $', this._calculateCost(usage, model).toFixed(6));

      // Parse the mixed text to create word mappings for hover tooltips
      const wordMappings = this._parseWordMappings(englishText, mixedText, knownWords);

      return {
        mixedText: mixedText,
        originalText: englishText,
        wordMappings: wordMappings,  // NEW: Array of word mappings for tooltips
        usage: usage,
        cost: this._calculateCost(usage, model),
        model: model
      };

    } catch (error) {
      console.error('[CLAUDE API] Translation error:', error);
      throw new Error(`Claude API error: ${error.message}`);
    }
  },

  /**
   * Build the translation prompt - Context-first approach
   */
  _buildTranslationPrompt(englishText, knownWords) {
    // Create vocabulary mapping
    const vocabList = Object.values(knownWords)
      .filter(data => data.translation)
      .map(data => `  - ${data.original} → ${data.translation}`)
      .join('\n');

    // Extract just the Chinese words the user knows
    const knownChineseWords = Object.values(knownWords)
      .filter(data => data.translation)
      .map(data => data.translation)
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

    console.log('[CLAUDE API] Created', mappings.length, 'word mappings');
    return mappings;
  },

  /**
   * Make API request to Claude
   */
  async _makeRequest(payload, apiKey) {
    if (!apiKey) {
      throw new Error('Claude API key is required');
    }

    const response = await fetch(`${this.API_BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': this.API_VERSION
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        // If we can't parse the error response, throw a generic error
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Extract detailed error information
      const errorMessage = errorData.error?.message || errorData.message || response.statusText;
      const errorType = errorData.error?.type || 'unknown_error';

      console.error('[CLAUDE API] Full error response:', errorData);
      console.error('[CLAUDE API] Status:', response.status);
      console.error('[CLAUDE API] Error type:', errorType);

      // Throw a detailed error message
      throw new Error(`${errorType}: ${errorMessage} (HTTP ${response.status})`);
    }

    return await response.json();
  },

  /**
   * Calculate cost for API usage
   */
  _calculateCost(usage, model) {
    const costs = {
      [this.MODELS.HAIKU]: { input: 0.25 / 1000000, output: 1.25 / 1000000 },
      [this.MODELS.SONNET]: { input: 3 / 1000000, output: 15 / 1000000 },
      [this.MODELS.OPUS]: { input: 15 / 1000000, output: 75 / 1000000 }
    };

    const modelCost = costs[model] || costs[this.MODELS.HAIKU];
    const inputCost = usage.input_tokens * modelCost.input;
    const outputCost = usage.output_tokens * modelCost.output;

    return inputCost + outputCost;
  },

  /**
   * Track cumulative usage
   */
  _trackUsage(usage, model) {
    this.usage.totalInputTokens += usage.input_tokens;
    this.usage.totalOutputTokens += usage.output_tokens;
    this.usage.totalCost += this._calculateCost(usage, model);
  },

  /**
   * Get usage statistics
   */
  getUsageStats() {
    return {
      totalInputTokens: this.usage.totalInputTokens,
      totalOutputTokens: this.usage.totalOutputTokens,
      totalCost: this.usage.totalCost.toFixed(6),
      totalRequests: this.usage.totalInputTokens > 0 ? 1 : 0
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
  window.ClaudeAPI = ClaudeAPI;
}
