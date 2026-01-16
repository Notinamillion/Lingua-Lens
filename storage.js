// Storage module for managing known words and settings
// Can be used in both content script and popup contexts

const StorageManager = {
  // Default settings
  defaultSettings: {
    targetLanguage: 'zh-CN',  // Chinese (Simplified)
    sourceLanguage: 'en',      // English
    apiKey: '',                // Google Translate API key
    mode: 'learn',             // 'learn' = translate known words, 'practice' = translate unknown words
    autoTranslate: true,       // Enable automatic translation
    showTooltips: true,        // Show original text on hover
    excludedUrls: []           // List of URLs where extension won't run
  },

  // Initialize storage with defaults if needed
  async initialize() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['knownWords', 'settings'], (data) => {
        const updates = {};

        if (!data.knownWords) {
          updates.knownWords = {};
        }

        if (!data.settings) {
          updates.settings = this.defaultSettings;
        }

        if (Object.keys(updates).length > 0) {
          chrome.storage.local.set(updates, () => resolve(true));
        } else {
          resolve(true);
        }
      });
    });
  },

  // Get all known words
  async getKnownWords() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['knownWords'], (data) => {
        resolve(data.knownWords || {});
      });
    });
  },

  // Get a specific word translation
  async getWord(word) {
    const words = await this.getKnownWords();
    return words[word.toLowerCase()] || null;
  },

  // Add a new word with translation and optional pinyin
  async addWord(word, translation, sourceText = null, pinyin = null) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['knownWords'], (data) => {
        const knownWords = data.knownWords || {};
        const wordKey = word.toLowerCase();

        if (knownWords[wordKey]) {
          // Update existing word
          knownWords[wordKey].translation = translation;
          if (pinyin) {
            knownWords[wordKey].pinyin = pinyin;
          }
          knownWords[wordKey].timesEncountered++;
          knownWords[wordKey].lastSeen = Date.now();
        } else {
          // Add new word
          knownWords[wordKey] = {
            original: word,
            translation: translation,
            pinyin: pinyin,
            sourceText: sourceText,
            dateAdded: Date.now(),
            lastSeen: Date.now(),
            timesEncountered: 1
          };
        }

        chrome.storage.local.set({ knownWords }, async () => {
          // Also add Chinese translation to chineseKnownWords for highlighting
          if (translation && /[\u4e00-\u9fff]/.test(translation)) {
            chrome.storage.sync.get(['chineseKnownWords'], (result) => {
              const chineseKnownWords = result.chineseKnownWords || [];
              if (!chineseKnownWords.includes(translation)) {
                chineseKnownWords.push(translation);
                chrome.storage.sync.set({ chineseKnownWords });
                console.log(`[Auto-sync] Added '${translation}' to Chinese known words`);
              }
            });
          }
          resolve(knownWords[wordKey]);
        });
      });
    });
  },

  // Update an existing word's translation
  async updateWord(originalWord, newTranslation) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['knownWords'], (data) => {
        const knownWords = data.knownWords || {};
        const wordKey = originalWord.toLowerCase();

        if (knownWords[wordKey]) {
          knownWords[wordKey].translation = newTranslation;
          knownWords[wordKey].lastSeen = Date.now();
          chrome.storage.local.set({ knownWords }, () => {
            // Also add Chinese translation to chineseKnownWords for highlighting
            if (newTranslation && /[\u4e00-\u9fff]/.test(newTranslation)) {
              chrome.storage.sync.get(['chineseKnownWords'], (result) => {
                const chineseKnownWords = result.chineseKnownWords || [];
                if (!chineseKnownWords.includes(newTranslation)) {
                  chineseKnownWords.push(newTranslation);
                  chrome.storage.sync.set({ chineseKnownWords });
                  console.log(`[Auto-sync] Added '${newTranslation}' to Chinese known words`);
                }
              });
            }
            resolve(knownWords[wordKey]);
          });
        } else {
          resolve(null);
        }
      });
    });
  },

  // Remove a word
  async removeWord(word) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['knownWords'], (data) => {
        const knownWords = data.knownWords || {};
        const wordKey = word.toLowerCase();

        if (knownWords[wordKey]) {
          delete knownWords[wordKey];
          chrome.storage.local.set({ knownWords }, () => resolve(true));
        } else {
          resolve(false);
        }
      });
    });
  },

  // Clear all words
  async clearAllWords() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ knownWords: {} }, () => resolve(true));
    });
  },

  // Get settings
  async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['settings'], (data) => {
        resolve(data.settings || this.defaultSettings);
      });
    });
  },

  // Update settings
  async updateSettings(newSettings) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['settings'], (data) => {
        const settings = { ...(data.settings || this.defaultSettings), ...newSettings };
        chrome.storage.local.set({ settings }, () => resolve(settings));
      });
    });
  },

  // Export words to JSON
  async exportWords() {
    const knownWords = await this.getKnownWords();
    const settings = await this.getSettings();

    const exportData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      wordCount: Object.keys(knownWords).length,
      settings: settings,
      words: knownWords
    };

    return JSON.stringify(exportData, null, 2);
  },

  // Import words from JSON
  async importWords(jsonString) {
    try {
      const importData = JSON.parse(jsonString);

      if (!importData.words || typeof importData.words !== 'object') {
        throw new Error('Invalid import format: missing words object');
      }

      return new Promise((resolve, reject) => {
        chrome.storage.local.set({ knownWords: importData.words }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(Object.keys(importData.words).length);
          }
        });
      });
    } catch (error) {
      throw new Error(`Import failed: ${error.message}`);
    }
  },

  // Get statistics
  async getStats() {
    const knownWords = await this.getKnownWords();
    const wordArray = Object.values(knownWords);

    return {
      totalWords: wordArray.length,
      totalEncounters: wordArray.reduce((sum, w) => sum + w.timesEncountered, 0),
      oldestWord: wordArray.length > 0 ?
        Math.min(...wordArray.map(w => w.dateAdded)) : null,
      newestWord: wordArray.length > 0 ?
        Math.max(...wordArray.map(w => w.dateAdded)) : null,
      mostEncountered: wordArray.length > 0 ?
        wordArray.reduce((max, w) => w.timesEncountered > max.timesEncountered ? w : max) : null
    };
  }
};

// Initialize storage when module loads
if (typeof chrome !== 'undefined' && chrome.storage) {
  StorageManager.initialize();
}

// Make available globally for content scripts
if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
}
