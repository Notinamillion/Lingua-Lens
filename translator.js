// Translation module for Google Translate API
// Handles API calls, caching, and rate limiting

const TranslatorAPI = {
  // Cache for translations (reduces API calls)
  translationCache: new Map(),
  cacheTimeout: 24 * 60 * 60 * 1000, // 24 hours
  maxCacheSize: 5000, // Maximum number of cached translations
  isInitialized: false,

  // Rate limiting
  requestQueue: [],
  isProcessingQueue: false,
  maxRequestsPerSecond: 2,
  lastRequestTime: 0,

  // Translate a single word or phrase using Google Translate API
  async translate(text, targetLang, sourceLang = 'auto', apiKey) {
    if (!text || !targetLang) {
      throw new Error('Text and target language are required');
    }

    if (!apiKey) {
      throw new Error('Google Translate API key is required. Please add it in the extension settings.');
    }

    // Check cache first
    const cacheKey = `${text}:${sourceLang}:${targetLang}`;
    const cached = await this.getCachedTranslation(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Google Cloud Translation API v2
      const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: text,
          target: targetLang,
          source: sourceLang === 'auto' ? undefined : sourceLang,
          format: 'text'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.data || !data.data.translations || data.data.translations.length === 0) {
        throw new Error('No translation returned from API');
      }

      const translation = data.data.translations[0].translatedText;
      const detectedSourceLang = data.data.translations[0].detectedSourceLanguage || sourceLang;

      // Cache the result
      await this.cacheTranslation(cacheKey, translation);

      return {
        translatedText: translation,
        sourceLanguage: detectedSourceLang,
        targetLanguage: targetLang,
        originalText: text
      };

    } catch (error) {
      console.error('Translation error:', error);
      throw error;
    }
  },

  // Translate multiple words/phrases in batch
  async translateBatch(texts, targetLang, sourceLang = 'auto', apiKey) {
    if (!Array.isArray(texts) || texts.length === 0) {
      return [];
    }

    if (!apiKey) {
      throw new Error('Google Translate API key is required');
    }

    try {
      const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: texts,
          target: targetLang,
          source: sourceLang === 'auto' ? undefined : sourceLang,
          format: 'text'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.data || !data.data.translations) {
        throw new Error('No translations returned from API');
      }

      // Cache all results
      const results = await Promise.all(
        data.data.translations.map(async (translation, index) => {
          const cacheKey = `${texts[index]}:${sourceLang}:${targetLang}`;
          const translatedText = translation.translatedText;
          await this.cacheTranslation(cacheKey, translatedText);

          return {
            originalText: texts[index],
            translatedText: translatedText,
            sourceLanguage: translation.detectedSourceLanguage || sourceLang
          };
        })
      );

      return results;

    } catch (error) {
      console.error('Batch translation error:', error);
      throw error;
    }
  },

  // Cache management
  async getCachedTranslation(cacheKey) {
    // Check in-memory cache first
    const memCached = this.translationCache.get(cacheKey);
    if (memCached) {
      // Check if cache is expired
      if (Date.now() - memCached.timestamp > this.cacheTimeout) {
        this.translationCache.delete(cacheKey);
      } else {
        return memCached.translation;
      }
    }

    // Check persistent storage if not in memory
    try {
      const storageData = await chrome.storage.local.get(['translationCache']);
      const persistentCache = storageData.translationCache || {};

      if (persistentCache[cacheKey]) {
        const cached = persistentCache[cacheKey];

        // Check if cache is expired
        if (Date.now() - cached.timestamp > this.cacheTimeout) {
          // Delete expired entry
          delete persistentCache[cacheKey];
          await chrome.storage.local.set({ translationCache: persistentCache });
          return null;
        }

        // Load into memory cache for faster access
        this.translationCache.set(cacheKey, cached);
        return cached.translation;
      }
    } catch (error) {
      console.error('Error reading cache from storage:', error);
    }

    return null;
  },

  async cacheTranslation(cacheKey, translation) {
    const cacheEntry = {
      translation: translation,
      timestamp: Date.now()
    };

    // Add to in-memory cache
    this.translationCache.set(cacheKey, cacheEntry);

    // Limit in-memory cache size
    if (this.translationCache.size > 1000) {
      const firstKey = this.translationCache.keys().next().value;
      this.translationCache.delete(firstKey);
    }

    // Save to persistent storage
    try {
      const storageData = await chrome.storage.local.get(['translationCache']);
      const persistentCache = storageData.translationCache || {};

      persistentCache[cacheKey] = cacheEntry;

      // Limit persistent cache size
      const cacheKeys = Object.keys(persistentCache);
      if (cacheKeys.length > this.maxCacheSize) {
        // Remove oldest entries
        const sortedKeys = cacheKeys
          .map(key => ({ key, timestamp: persistentCache[key].timestamp }))
          .sort((a, b) => a.timestamp - b.timestamp);

        const keysToRemove = sortedKeys.slice(0, cacheKeys.length - this.maxCacheSize);
        keysToRemove.forEach(item => delete persistentCache[item.key]);
      }

      await chrome.storage.local.set({ translationCache: persistentCache });
    } catch (error) {
      console.error('Error saving cache to storage:', error);
    }
  },

  async clearCache() {
    this.translationCache.clear();
    try {
      await chrome.storage.local.set({ translationCache: {} });
    } catch (error) {
      console.error('Error clearing cache from storage:', error);
    }
  },

  // Load cache from storage on startup
  async loadCacheFromStorage() {
    if (this.isInitialized) return;

    try {
      const storageData = await chrome.storage.local.get(['translationCache']);
      const persistentCache = storageData.translationCache || {};

      const now = Date.now();
      let expiredCount = 0;

      // Load valid entries into memory and remove expired ones
      Object.entries(persistentCache).forEach(([key, entry]) => {
        if (now - entry.timestamp <= this.cacheTimeout) {
          // Only load recent entries into memory (last 1 hour)
          if (now - entry.timestamp <= 60 * 60 * 1000) {
            this.translationCache.set(key, entry);
          }
        } else {
          // Mark for deletion
          delete persistentCache[key];
          expiredCount++;
        }
      });

      // Clean up expired entries from storage if any were found
      if (expiredCount > 0) {
        await chrome.storage.local.set({ translationCache: persistentCache });
        console.log(`Cleaned up ${expiredCount} expired cache entries`);
      }

      const totalCached = Object.keys(persistentCache).length;
      console.log(`Loaded translation cache: ${totalCached} total entries, ${this.translationCache.size} in memory`);

      this.isInitialized = true;
    } catch (error) {
      console.error('Error loading cache from storage:', error);
      this.isInitialized = true; // Mark as initialized even on error to prevent retry loops
    }
  },

  // Get cache statistics
  async getCacheStats() {
    try {
      const storageData = await chrome.storage.local.get(['translationCache']);
      const persistentCache = storageData.translationCache || {};

      return {
        inMemoryCount: this.translationCache.size,
        persistentCount: Object.keys(persistentCache).length,
        maxSize: this.maxCacheSize
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        inMemoryCount: this.translationCache.size,
        persistentCount: 0,
        maxSize: this.maxCacheSize
      };
    }
  },

  // Detect language of text
  async detectLanguage(text, apiKey) {
    if (!text || !apiKey) {
      throw new Error('Text and API key are required');
    }

    try {
      const url = `https://translation.googleapis.com/language/translate/v2/detect?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: text
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.data || !data.data.detections || data.data.detections.length === 0) {
        throw new Error('No language detection result');
      }

      return {
        language: data.data.detections[0][0].language,
        confidence: data.data.detections[0][0].confidence,
        isReliable: data.data.detections[0][0].isReliable
      };

    } catch (error) {
      console.error('Language detection error:', error);
      throw error;
    }
  },

  // Simple language detection without API (fallback)
  detectLanguageSimple(text) {
    // Check for Chinese characters
    if (/[\u4e00-\u9fa5]/.test(text)) {
      return 'zh';
    }
    // Check for Japanese characters
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) {
      return 'ja';
    }
    // Check for Korean characters
    if (/[\uac00-\ud7af]/.test(text)) {
      return 'ko';
    }
    // Check for Arabic characters
    if (/[\u0600-\u06ff]/.test(text)) {
      return 'ar';
    }
    // Check for Cyrillic characters
    if (/[\u0400-\u04ff]/.test(text)) {
      return 'ru';
    }
    // Default to English
    return 'en';
  }
};

// Make available for background script and popup
if (typeof window !== 'undefined') {
  window.TranslatorAPI = TranslatorAPI;
}
