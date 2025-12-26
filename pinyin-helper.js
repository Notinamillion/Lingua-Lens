// Pinyin Helper - Wrapper for pinyin-pro library
// Provides utility functions for generating Pinyin from Chinese characters

const PinyinHelper = {
  // Check if text contains Chinese characters
  containsChinese(text) {
    if (!text) return false;
    return /[\u4e00-\u9fa5]/.test(text);
  },

  // Check if target language is Chinese
  isChineseLanguage(langCode) {
    if (!langCode) return false;
    const code = langCode.toLowerCase();
    return code === 'zh' || code === 'zh-cn' || code === 'zh-tw' || code.startsWith('zh-');
  },

  // Generate Pinyin from Chinese text
  // Returns null if pinyinPro library is not loaded or text is not Chinese
  generatePinyin(text, settings = {}) {
    // Check if text contains Chinese
    if (!this.containsChinese(text)) {
      return null;
    }

    // Check if pinyinPro library is loaded
    if (typeof pinyinPro === 'undefined' || !pinyinPro.pinyin) {
      console.warn('Pinyin-pro library not loaded. Pinyin generation skipped.');
      return null;
    }

    try {
      // Generate Pinyin with tone marks
      const pinyin = pinyinPro.pinyin(text, {
        toneType: 'symbol',  // Use tone marks (nǐ hǎo) instead of numbers (ni3 hao3)
        type: 'string',      // Return as string
        separator: ' ',      // Space between syllables
        ...settings
      });

      return pinyin;
    } catch (error) {
      console.error('Error generating Pinyin:', error);
      return null;
    }
  },

  // Check if Pinyin should be generated based on target language
  shouldGeneratePinyin(targetLanguage) {
    return this.isChineseLanguage(targetLanguage);
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.PinyinHelper = PinyinHelper;
}
