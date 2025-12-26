# Pinyin-Pro Library Setup Instructions

## Current Status

The extension currently has a **stub file** for `pinyin-pro.min.js`. This allows the extension to load and work normally, but **Pinyin support is NOT active**.

To enable Pinyin support, you need to REPLACE the stub with the real library.

---

## Download and Install the Real Library

1. **Go to this URL:**
   https://cdn.jsdelivr.net/npm/pinyin-pro@3.18.2/dist/index.js

2. **Save the file:**
   - Right-click on the page → "Save As"
   - Save as: `pinyin-pro.min.js`
   - Location: `C:\Users\s.bateman\Programs\LanguageLearnerExtension\Lingua-Lens\`
   - **IMPORTANT:** When saving, choose to **REPLACE** the existing `pinyin-pro.min.js` stub file

3. **Verify:**
   - File should be ~200KB (if it's only a few KB, it's still the stub!)
   - Named exactly: `pinyin-pro.min.js`
   - In the same folder as manifest.json

4. **Reload the extension:**
   - Go to `chrome://extensions/`
   - Find "Lingua-Lens"
   - Click the reload icon 🔄

## That's it!

Once the file is in place, the Pinyin feature will work automatically.

The extension will:
- Generate Pinyin when you add Chinese words
- Show Pinyin in tooltips (only when your target language is Chinese)
- Work offline (no external API calls needed)
