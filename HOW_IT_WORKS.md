# Lingua-Lens: How It Works

## Overview

Lingua-Lens is a Chrome extension that helps you learn foreign languages by translating words on any webpage and building your vocabulary list. When you visit a webpage, the extension automatically highlights and translates words you've previously saved, helping reinforce your learning through repeated exposure.

---

## Core Features

1. **Automatic Word Translation** - Highlights known words on webpages and shows translations on hover
2. **Quick Add Word** - Translate and save new words from the popup
3. **Context Menu Integration** - Right-click any selected text to translate and save
4. **Pinyin Support** - Displays Pinyin romanization for Chinese words (when target language is Chinese)
5. **Smart Translation (Claude AI)** - Translate only known English words to Chinese, keeping unknown words in English for easier reading comprehension
6. **Performance Metrics** - Console logging shows translation speed and statistics
7. **Vocabulary Management** - Search, export, and import your word list

---

## NEW: Smart Translation with Claude AI 🤖

### What is Smart Translation?

Smart Translation is a revolutionary feature that helps you practice reading Chinese by selectively translating only the English words you already know. Unknown words remain in English, providing context clues while you practice your Chinese vocabulary.

### Example

**Original English:**
> Thousands of species at risk of extinction in Wales have been revealed in a new study.

**Smart Translation (Known Words → Chinese):**
> 数千的 species 在 risk 的 extinction in Wales 有 been revealed in a 新的 study.

### How It Works

1. **Select English text** on any webpage
2. **Right-click** → "Smart Translate (EN→CN Mixed) [Claude AI]"
3. **Claude AI analyzes** your known vocabulary (550+ words)
4. **Translates only known words** to Chinese
5. **Displays result** in a modal with:
   - Original English text
   - Mixed English/Chinese translation
   - API usage statistics
   - Cost per translation

### Why Claude AI?

Unlike Google Translate's word-by-word approach, Claude AI offers:

✅ **Context-Aware Translation** - Understands phrases and idioms
✅ **Intelligent Word Selection** - Knows which words to translate
✅ **Natural Sentence Flow** - Maintains readable grammar
✅ **Cost Effective** - ~$0.0005 per typical sentence (Haiku model)
✅ **Offline After Load** - No external API calls after initial translation

### API Cost Comparison

| API | Cost per 1M Tokens | Typical Sentence Cost | Context-Aware |
|-----|-------------------|----------------------|---------------|
| **Claude Haiku** | $0.25 input / $1.25 output | **$0.0005** | ✅ Yes |
| Claude Sonnet | $3 input / $15 output | $0.0051 | ✅ Yes |
| Google Translate v2 | $20 per 1M chars | $0.0136 | ❌ No |

**Verdict:** Claude Haiku is **10x cheaper** than Google Translate and provides intelligent, context-aware translation!

### Setup Requirements

1. **Get Claude API Key** - Visit [console.anthropic.com](https://console.anthropic.com/)
2. **Add Key to Extension** - Open popup → Settings → "Claude API Key"
3. **Select Model** - Choose Haiku (recommended), Sonnet, or Opus
4. **Start Translating!** - Select any English text and use the context menu

---

## Architecture

### File Structure

```
Lingua-Lens/
├── manifest.json              # Extension configuration
├── background.js              # Service worker (API calls, context menu)
├── claude-api.js              # Claude AI integration for smart translation
├── content.js                 # DOM manipulation, translation display
├── popup.html                 # Popup UI structure
├── popup.js                   # Popup logic and vocabulary management
├── storage.js                 # Chrome storage wrapper
├── translator.js              # Google Translate API wrapper
├── pinyin-helper.js           # Pinyin generation utilities
├── pinyin-pro.min.js          # Pinyin library (stub or real)
├── icons/                     # Extension icons
├── PINYIN_SETUP.md            # Instructions for enabling Pinyin
└── test-claude-translation.html  # Test page for Claude API
```

### Component Roles

#### **background.js** (Service Worker)
- Handles Google Translate API calls
- Manages context menu ("Translate & Save Word", "Smart Translate")
- Processes translation requests from popup and content scripts
- Generates Pinyin for Chinese translations
- Coordinates Claude AI smart translation requests
- Runs in the background, independent of any specific webpage

#### **claude-api.js** (Claude AI Integration)
- Anthropic Claude API wrapper
- Handles smart English→Chinese translation
- Model selection (Haiku, Sonnet, Opus)
- Cost tracking and usage statistics
- Context-aware prompt engineering
- Error handling and fallback mechanisms

#### **content.js** (Content Script)
- Injected into every webpage (runs in page context)
- Scans page DOM to find known words
- Replaces known words with highlighted spans
- Shows tooltips with original text (and Pinyin) on hover
- Tracks performance metrics (words translated, processing time)
- Monitors DOM changes with MutationObserver for dynamic content

#### **popup.js** (Popup Interface)
- Powers the extension popup UI
- "Quick Add Word" feature - translate text without selecting on page
- Vocabulary search and filtering
- Word list display with delete functionality
- Export/Import functionality
- Target language selection

#### **storage.js** (Storage Manager)
- Wrapper around Chrome Storage API
- Manages saving/loading words, settings
- Handles word data structure (original, translation, pinyin, dates, encounters)

#### **pinyin-helper.js** (Pinyin Utilities)
- Checks if text contains Chinese characters
- Detects if target language is Chinese (zh, zh-CN, zh-TW)
- Generates Pinyin using pinyin-pro library
- Returns `null` if library not loaded (graceful degradation)

---

## How Translation Works

### 1. Adding Words

**Method A: Quick Add Word (Popup)**
```
User types word in popup → Click "Translate & Add"
→ popup.js sends message to background.js
→ background.js calls Google Translate API
→ If target language is Chinese, generate Pinyin via pinyin-helper.js
→ Save to Chrome storage with word data:
   {
     original: "hello",
     translation: "你好",
     pinyin: "nǐ hǎo",          // Only if target is Chinese
     sourceLanguage: "en",
     dateAdded: 1762095889020,
     lastSeen: 1762095889020,
     timesEncountered: 1
   }
```

**Method B: Context Menu (Right-click)**
```
User selects text on page → Right-click → "Translate & Save Word"
→ background.js receives selected text
→ Call Google Translate API
→ Generate Pinyin if needed
→ Save to Chrome storage
→ Reload page to show new word highlighted
```

### 2. Displaying Translations on Webpages

**Page Load Process:**
```
1. content.js loads with page (manifest: "run_at": "document_idle")
2. Load known words and settings from Chrome storage
3. Call translateKnownWords() function
4. Walk through entire DOM tree using TreeWalker
5. For each text node:
   - Check if it contains any known words (regex matching)
   - If match found, call replaceTextNode()
6. replaceTextNode() creates document fragment:
   - Splits text into parts (before, match, after)
   - Creates <span> for matched word with:
     * Yellow highlight background
     * data-translated="true" attribute (prevents re-translation)
     * Mouse event listeners (mouseover/mouseout)
7. Replace original text node with new fragment
8. Track statistics (words replaced, unique words, processing time)
```

**Tooltip Display:**
```
User hovers over highlighted word
→ mouseover event fires
→ showTooltip() function called
→ Check if wordData has pinyin field
→ Create tooltip text:
   - Without Pinyin: "original"
   - With Pinyin: "original\npinyin" (multi-line)
→ Create tooltip div with:
   * Black background, white text
   * Positioned above the word
   * white-space: pre-line (allows line breaks)
   * text-align: center
   * z-index: 999999 (appears above everything)
→ Append to document.body

User moves mouse away
→ mouseout event fires
→ hideTooltip() removes tooltip from DOM
```

### 3. Word Matching Algorithm

Words are matched using **regular expressions** with **word boundaries**:

```javascript
const pattern = new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi');
// Example: word "hello" becomes pattern /\bhello\b/gi
// Matches: "Hello world" ✓
// Doesn't match: "Helloworld" ✗ (no word boundary)
```

**Case Insensitive**: Matches "Hello", "hello", "HELLO"
**Whole Words Only**: Won't match "hello" inside "helloworld"
**Global**: Finds all occurrences on page

---

## Storage Structure

### Chrome Local Storage Schema

```json
{
  "knownWords": {
    "hello": {
      "original": "hello",
      "translation": "你好",
      "pinyin": "nǐ hǎo",
      "sourceText": null,
      "sourceLanguage": "en",
      "dateAdded": 1762095889020,
      "lastSeen": 1762095889020,
      "timesEncountered": 1
    },
    "world": { /* ... */ }
  },

  "settings": {
    "targetLanguage": "zh-CN",
    "apiKey": "your-google-api-key"
  }
}
```

**Key Points:**
- Words stored by **lowercase key** ("hello" not "Hello")
- `timesEncountered` increments each time word is seen on a page
- `lastSeen` timestamp updates when word is encountered
- `pinyin` field is `null` for non-Chinese translations
- Storage limit: ~5MB (Chrome local storage quota)

---

## Pinyin Feature

### How It Works

1. **Detection**: `PinyinHelper.shouldGeneratePinyin(targetLanguage)` checks if target is Chinese
2. **Generation**: Uses `pinyin-pro` library with settings:
   - `toneType: 'symbol'` → produces "nǐ hǎo" (not "ni3 hao3")
   - `type: 'string'` → returns single string
   - `separator: ' '` → space between syllables
3. **Display**: Tooltip shows:
   ```
   你好
   nǐ hǎo
   ```
4. **Fallback**: If library not loaded, `pinyin` field is `null`, only original text shown

### Setup Required

The extension ships with a **stub file** (`pinyin-pro.min.js`) to allow loading. To enable Pinyin:

1. Download real library from: https://cdn.jsdelivr.net/npm/pinyin-pro@3.18.2/dist/index.js
2. Save as `pinyin-pro.min.js` (replace stub)
3. File should be ~200KB (stub is only ~1KB)
4. Reload extension

See `PINYIN_SETUP.md` for detailed instructions.

---

## Performance Features

### Console Metrics

When you visit a page, content.js logs detailed performance data:

```
╔═══════════════════════════════════════════════════╗
║  LINGUA-LENS TRANSLATION COMPLETE                 ║
╠═══════════════════════════════════════════════════╣
║  Processing Time:      1,234 ms                   ║
║  Total Occurrences:    89                         ║
║  Unique Words:         23                         ║
║  Words/Second:         72.18                      ║
║  Coverage:             15.7%                      ║
╠═══════════════════════════════════════════════════╣
║  TOP 10 MOST FREQUENT WORDS:                      ║
║  1. the          23×                              ║
║  2. and          15×                              ║
║  3. hello        8×                               ║
╚═══════════════════════════════════════════════════╝
```

**Metrics Explained:**
- **Processing Time**: Total time to scan page and replace words
- **Total Occurrences**: How many times known words appeared
- **Unique Words**: Number of different known words found
- **Words/Second**: Translation throughput (higher = faster)
- **Coverage**: % of total words on page that are in your vocabulary

### Optimization Strategies

The extension is already optimized:
1. **Single Pass**: TreeWalker scans DOM once, not repeatedly
2. **Fragment Creation**: Batched DOM updates, not individual insertions
3. **Regex Caching**: Patterns compiled once per word
4. **Event Delegation**: Could be added for better tooltip performance
5. **Lazy Loading**: Only processes visible content (via MutationObserver for dynamic content)

---

## Google Translate API

### API Version: v2

**Endpoint**: `https://translation.googleapis.com/language/translate/v2`

**Request Format**:
```javascript
{
  q: "hello",           // Text to translate
  target: "zh-CN",      // Target language
  key: "YOUR_API_KEY"   // Google Cloud API key
}
```

**Response Format**:
```javascript
{
  data: {
    translations: [{
      translatedText: "你好",
      detectedSourceLanguage: "en"
    }]
  }
}
```

**Why v2 and not v3?**
- v2 is simpler, REST-based
- v3 Advanced has Pinyin support BUT NOT for Chinese translations
- We use client-side `pinyin-pro` library instead

### API Key Setup

1. Go to Google Cloud Console
2. Enable Cloud Translation API
3. Create API key
4. Enter in extension popup settings

---

## Dynamic Content Handling

### MutationObserver

The extension watches for page changes:

```javascript
const observer = new MutationObserver((mutations) => {
  // When page content changes (AJAX, React updates, etc.)
  translateKnownWords();  // Re-scan and translate new content
});

observer.observe(document.body, {
  childList: true,      // Watch for added/removed nodes
  subtree: true         // Watch entire tree, not just direct children
});
```

**Use Cases:**
- Single Page Applications (SPAs) - React, Vue, Angular
- Infinite scroll pages
- Dynamic content loading
- Chat applications

---

## Export/Import Format

### JSON Structure

```json
{
  "version": "1.0.0",
  "exportDate": "2025-11-09T20:48:07.915Z",
  "wordCount": 550,
  "settings": {
    "targetLanguage": "zh-CN",
    "apiKey": "[REDACTED]"
  },
  "words": {
    "hello": {
      "original": "hello",
      "translation": "你好",
      "pinyin": "nǐ hǎo",
      "dateAdded": 1762095889020,
      "lastSeen": 1762095889020,
      "timesEncountered": 1,
      "sourceLanguage": "en"
    }
  }
}
```

**Usage:**
1. **Export**: Click "Export All Words" in popup → Downloads JSON file
2. **Import**: Click "Import Words" → Select JSON file → Merges with existing words
3. **Migration**: Can edit JSON externally (e.g., add Pinyin via script) then re-import

---

## Known Issues & Limitations

### 1. Tooltips in Hyperlinks
**Issue**: Tooltips may not appear when hovering over highlighted words inside `<a>` tags
**Cause**: Event bubbling behavior with nested elements
**Status**: Known issue, not critical

### 2. Translation Quality
**Limitation**: Google Translate API quality varies by language pair
**Note**: Best results with major language pairs (EN↔ZH, EN↔ES, etc.)

### 3. Pinyin Library Size
**Issue**: Full `pinyin-pro` library is ~200KB
**Impact**: Adds to extension size, but necessary for offline Pinyin
**Alternative**: Could use Google's Pinyin API but requires network + not available for Chinese

### 4. Page Performance
**Impact**: Pages with 10,000+ words may take 1-2 seconds to process
**Mitigation**: Processing happens once on load, then only for new dynamic content

---

## Security Considerations

### Data Privacy
- All word data stored **locally** in Chrome storage
- Google Translate API calls only send the specific word being translated
- API key stored locally, never sent to third parties
- No analytics or tracking

### Content Security Policy
- Extension only injects necessary scripts
- No eval() usage (except in temporary Node.js scripts)
- Uses nonces for inline scripts where needed

### Permissions Used
```json
"permissions": [
  "storage",           // Save words locally
  "contextMenus",      // Right-click "Translate & Save"
  "activeTab"          // Access current page for translation
],
"host_permissions": [
  "https://translation.googleapis.com/*"  // Google Translate API
]
```

---

## Development Notes

### Manifest V3
Extension uses Manifest V3 (latest Chrome extension standard):
- Service workers instead of background pages
- Promises instead of callbacks
- Enhanced security model

### Browser Compatibility
- **Chrome**: Fully supported ✓
- **Edge**: Should work (Chromium-based)
- **Firefox**: Would require manifest modifications
- **Safari**: Not supported (different extension API)

### Testing
1. Load unpacked extension: `chrome://extensions/` → "Load unpacked"
2. Check console logs: Right-click page → Inspect → Console
3. Check background service worker: `chrome://extensions/` → "Service worker" link
4. Test dynamic content: Visit SPA sites (Twitter, Gmail, etc.)

---

## Future Enhancement Ideas

1. **Better Link Support**: Fix tooltip display in hyperlinks
2. **Spaced Repetition**: Show words based on forgetting curve
3. **Audio Pronunciation**: Add text-to-speech on tooltip
4. **Context Sentences**: Save example sentences with words
5. **Multiple Translations**: Store alternative translations
6. **Word Forms**: Handle plurals, verb conjugations (run/running/ran)
7. **Offline Mode**: Cache translations for offline use
8. **Statistics Dashboard**: Visualize learning progress over time
9. **Flashcard Mode**: Quiz mode in popup
10. **Sync Across Devices**: Chrome sync storage for cross-device vocabulary

---

## Support Files

- **PINYIN_SETUP.md**: Step-by-step guide for enabling Pinyin
- **add-pinyin.js**: Node.js script to add Pinyin to exported word lists

---

## Questions or Issues?

If you encounter problems:
1. Check Chrome DevTools Console for error messages
2. Verify API key is set correctly in settings
3. Ensure Pinyin library is downloaded (if using Chinese)
4. Try reloading the extension at `chrome://extensions/`

---

**Last Updated**: November 2025
**Extension Version**: 1.0.0
