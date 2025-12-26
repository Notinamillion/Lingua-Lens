# Language Learning Translator - Chrome Extension

A powerful Chrome extension for immersive language learning. Select words you want to learn, and they'll automatically translate across all websites you visit.

## Features

- **Smart Word Translation**: Select any word on a webpage, translate it to your target language, and it will automatically appear translated on all future pages
- **Hover to Reveal**: Hover over translated words to see the original text
- **Reverse Learning Mode**: On foreign language websites, all words are translated EXCEPT the ones you've marked as "known"
- **Export/Import**: Save your vocabulary list and import it across devices
- **Visual Learning**: Words remain in context, helping you learn through natural reading
- **Customizable**: Choose from 12+ languages including Chinese, Spanish, French, German, Japanese, and more

## How It Works

### Learn Mode (English → Target Language)
1. You're reading an English article
2. You select the word "beautiful" and choose "Translate & Save Word"
3. It translates to "美丽的" (Chinese)
4. Now, every time you see "beautiful" on ANY website, it appears as "美丽的"
5. Hover to see the original English word

### Practice Mode (Foreign Language → English)
1. You're on a Chinese website
2. The extension automatically translates all Chinese text to English
3. EXCEPT words you've marked as "known" - these stay in Chinese
4. This helps you practice reading while learning new vocabulary

## Installation

### Prerequisites
- Google Chrome browser (or Chromium-based browser like Edge, Brave)
- Google Cloud Translation API key ([Get one free](https://cloud.google.com/translate/docs/setup))

### Setup Instructions

1. **Generate Extension Icons** (Optional)
   - Open `icons/generate-icons.html` in your browser
   - Click each download button to get the three icon sizes
   - Icons will be saved to your Downloads folder
   - Move them to the `icons/` folder

2. **Load Extension in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `LanguageLearnerExtension` folder
   - The extension icon should appear in your toolbar

3. **Configure Settings**
   - Click the extension icon in your toolbar
   - Enter your Google Translate API key
   - Select your target language (language you're learning)
   - Select your source language (your native language)
   - Enable "Auto-translate words on pages"
   - Click "Save Settings"

## Getting a Google Translate API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable the "Cloud Translation API"
4. Go to "Credentials" → "Create Credentials" → "API Key"
5. Copy your API key
6. Paste it into the extension settings

**Cost**: Google Cloud Translation API offers:
- $10 free credit per month (500,000 characters)
- After that: $20 per 1 million characters

## Usage Guide

### Adding Words

**Method 1: Context Menu**
1. Select any word on a webpage
2. Right-click and choose "Translate & Save Word"
3. The word will be saved and automatically translated everywhere

**Method 2: Translate Without Saving**
1. Select any word
2. Right-click and choose "Translate (Don't Save)"
3. See the translation without adding to your vocabulary

### Managing Your Vocabulary

- **View Words**: Click the extension icon to see all saved words
- **Search**: Use the search box to find specific words
- **Remove Words**: Click the × button next to any word
- **Export**: Click "Export Words" to save as JSON file
- **Import**: Click "Import Words" to load vocabulary from JSON file
- **Clear All**: Remove all saved words (with confirmation)

### Translation Modes

The extension automatically detects page language and switches modes:

- **English page** → Translates your known words to target language
- **Foreign page** → Translates unknown words to English (keeps known words in target language)

You can also manually toggle this in settings.

## Project Structure

```
LanguageLearnerExtension/
├── manifest.json           # Extension configuration
├── background.js           # Service worker (API calls, context menus)
├── content.js              # DOM manipulation and word replacement
├── storage.js              # Storage management utilities
├── translator.js           # Google Translate API wrapper
├── popup.html              # Extension popup UI
├── popup.js                # Popup logic
├── popup.css               # Popup styling
├── icons/
│   ├── generate-icons.html # Icon generator tool
│   ├── icon16.png          # 16x16 toolbar icon
│   ├── icon48.png          # 48x48 management icon
│   └── icon128.png         # 128x128 store icon
└── README.md               # This file
```

## Technical Details

### Architecture

- **Manifest V3**: Uses latest Chrome extension standards
- **Service Worker**: Background script handles API calls and state
- **Content Script**: Injects into pages for DOM manipulation
- **Chrome Storage API**: Local storage with export/import
- **TreeWalker API**: Efficient DOM traversal
- **MutationObserver**: Handles dynamically loaded content

### Performance Optimizations

- **Translation Caching**: Reduces API calls (24-hour cache)
- **Lazy Processing**: Only translates visible content
- **Debounced Updates**: Batches DOM modifications
- **WeakSet Tracking**: Prevents re-processing nodes

### Word Replacement Algorithm

1. Detect page language using HTML lang attribute and text sampling
2. Determine mode (learn vs practice) based on page language
3. Use TreeWalker to efficiently traverse text nodes
4. Skip non-translatable elements (scripts, inputs, buttons)
5. Create regex pattern for all known words
6. Replace matching words with `<span>` elements
7. Add hover tooltips showing original text
8. Track processed nodes to avoid duplicates

## Supported Languages

**Target Languages** (languages you're learning):
- Chinese (Simplified & Traditional)
- Spanish
- French
- German
- Japanese
- Korean
- Italian
- Portuguese
- Russian
- Arabic
- Hindi

**Source Languages** (your native language):
- English
- Spanish
- French
- German
- Japanese
- Korean
- Italian
- Portuguese
- Russian
- Chinese

## Troubleshooting

### Extension Not Working
1. Check if API key is entered correctly
2. Verify you have internet connection
3. Check Chrome's developer console for errors (`F12`)
4. Try reloading the extension

### Words Not Translating
1. Ensure "Auto-translate" is enabled in settings
2. Refresh the page after adding new words
3. Check if page language is detected correctly
4. Some websites may block content scripts (rare)

### API Errors
- **"API key not configured"**: Add your API key in settings
- **"API error: 403"**: Check API key permissions in Google Cloud Console
- **"API error: 429"**: You've exceeded your rate limit, wait a few minutes

### Performance Issues
- Large vocabulary (1000+ words) may slow down page loads
- Clear cache and reduce word count if needed
- Disable auto-translate on complex pages

## Privacy & Data

- **All data stored locally** in browser storage
- **No data sent to external servers** except Google Translate API
- **API calls only when translating** new words
- **No tracking or analytics**
- **Export your data anytime** for full control

## Development

### Making Changes

1. Edit source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on your extension
4. Test changes

### Adding Features

Key files to modify:
- `content.js` - DOM manipulation logic
- `background.js` - API calls and context menus
- `popup.html/js/css` - User interface
- `storage.js` - Storage operations

## Roadmap

**Potential Future Features**:
- [ ] Spaced repetition flashcards
- [ ] Word frequency analytics
- [ ] Pronunciation audio
- [ ] Example sentences
- [ ] Support for phrases (not just words)
- [ ] Custom translation styling
- [ ] Firefox support
- [ ] Offline mode with local dictionary

## License

This is a personal project. Feel free to use, modify, and distribute as needed.

## Support

For issues or questions:
1. Check the Troubleshooting section
2. Review Chrome extension logs (`chrome://extensions/` → Details → Errors)
3. Check Google Cloud Console for API status

## Credits

Built with:
- Chrome Extension Manifest V3
- Google Cloud Translation API
- Modern JavaScript (ES6+)
- HTML5/CSS3

---

**Happy Learning!** 🎓📚🌍
