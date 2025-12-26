// Google Gemini API Integration for Smart Translation
// Gemini API - Generate Content endpoint

const GeminiAPI = {
  // API Configuration
  API_BASE_URL: 'https://generativelanguage.googleapis.com/v1',

  // Model options (Gemini 2.5 series - 1.5 series deprecated)
  MODELS: {
    FLASH_LITE: 'gemini-2.5-flash-lite',  // Smallest & cheapest ($0.10/$0.40 per 1M tokens)
    FLASH: 'gemini-2.5-flash',            // Fast & balanced ($0.30/$0.60 per 1M tokens)
    PRO: 'gemini-2.5-pro'                 // Most capable ($1.25/$5 per 1M tokens)
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
   * @param {string} apiKey - Google Gemini API key
   * @param {string} model - Model to use (default: FLASH for cost efficiency)
   * @returns {Promise<Object>} - { mixedText, usage, cost }
   */
  async translateEnglishToChinese(englishText, knownWords, apiKey, model = this.MODELS.FLASH_LITE) {
    try {
      // Validate API key
      if (!apiKey || typeof apiKey !== 'string') {
        throw new Error('API key is required and must be a string');
      }

      const trimmedKey = apiKey.trim();
      if (trimmedKey.length === 0) {
        throw new Error('API key cannot be empty');
      }

      if (!trimmedKey.startsWith('AIza')) {
        throw new Error('Invalid API key format. Gemini API keys should start with "AIza"');
      }

      console.log('[GEMINI API] API Key Debug:', {
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

      console.log('[GEMINI API] Known words count:', Object.keys(knownWords).length);

      // Debug: Log first 5 vocabulary items
      const vocabPreview = knownWordsList.split('\n').slice(0, 5).join('\n');
      console.log('[GEMINI API] Vocabulary preview (first 5):');
      console.log(vocabPreview);

      // Extract known Chinese words for logging
      const knownChineseWords = knownWordsList
        .split('\n')
        .map(line => {
          const match = line.match(/→\s*(.+)$/);
          return match ? match[1].trim() : null;
        })
        .filter(Boolean);
      console.log('[GEMINI API] Known Chinese words (first 10):', knownChineseWords.slice(0, 10).join(', '));

      // Construct the prompt
      const prompt = this._buildTranslationPrompt(englishText, knownWordsList);

      console.log('[GEMINI API] Sending request to Gemini...');
      console.log('[GEMINI API] Model:', model);
      console.log('[GEMINI API] Text length:', englishText.length);
      console.log('[GEMINI API] Full prompt:');
      console.log(prompt);

      // Make API call
      const response = await this._makeRequest({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.5,  // Increased from 0.3 for more confident translations
          maxOutputTokens: 4096,
          topP: 0.95,
          topK: 40
        }
      }, trimmedKey, model);

      // Extract result
      const mixedText = response.candidates[0].content.parts[0].text.trim();

      // Track usage
      const usage = response.usageMetadata || {};
      this._trackUsage(usage, model);

      console.log('[GEMINI API] Translation complete');
      console.log('[GEMINI API] Input tokens:', usage.promptTokenCount || 0);
      console.log('[GEMINI API] Output tokens:', usage.candidatesTokenCount || 0);
      console.log('[GEMINI API] Estimated cost: $', this._calculateCost(usage, model).toFixed(6));

      // Parse the mixed text to create word mappings for hover tooltips
      const wordMappings = this._parseWordMappings(englishText, mixedText, knownWords);

      return {
        mixedText: mixedText,
        originalText: englishText,
        wordMappings: wordMappings,  // NEW: Array of word mappings for tooltips
        usage: {
          input_tokens: usage.promptTokenCount || 0,
          output_tokens: usage.candidatesTokenCount || 0
        },
        cost: this._calculateCost(usage, model),
        model: model
      };

    } catch (error) {
      console.error('[GEMINI API] Translation error:', error);
      throw new Error(`Gemini API error: ${error.message}`);
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

    console.log('[GEMINI API] Created', mappings.length, 'word mappings');
    return mappings;
  },

  /**
   * Make API request to Gemini
   */
  async _makeRequest(payload, apiKey, model) {
    if (!apiKey) {
      throw new Error('Gemini API key is required');
    }

    // Gemini uses the API key as a query parameter
    const url = `${this.API_BASE_URL}/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
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
      const errorStatus = errorData.error?.status || 'unknown_error';

      console.error('[GEMINI API] Full error response:', errorData);
      console.error('[GEMINI API] Status:', response.status);
      console.error('[GEMINI API] Error status:', errorStatus);

      throw new Error(`${errorStatus}: ${errorMessage} (HTTP ${response.status})`);
    }

    return await response.json();
  },

  /**
   * Calculate cost for API usage
   */
  _calculateCost(usage, model) {
    const costs = {
      [this.MODELS.FLASH_LITE]: { input: 0.10 / 1000000, output: 0.40 / 1000000 },
      [this.MODELS.FLASH]: { input: 0.30 / 1000000, output: 0.60 / 1000000 },
      [this.MODELS.PRO]: { input: 1.25 / 1000000, output: 5 / 1000000 }
    };

    const modelCost = costs[model] || costs[this.MODELS.FLASH_LITE]; // Default to cheapest
    const inputTokens = usage.promptTokenCount || 0;
    const outputTokens = usage.candidatesTokenCount || 0;

    const inputCost = inputTokens * modelCost.input;
    const outputCost = outputTokens * modelCost.output;

    return inputCost + outputCost;
  },

  /**
   * Track cumulative usage
   */
  _trackUsage(usage, model) {
    this.usage.totalInputTokens += usage.promptTokenCount || 0;
    this.usage.totalOutputTokens += usage.candidatesTokenCount || 0;
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
  window.GeminiAPI = GeminiAPI;
}
