# Setup Instructions

## Quick Setup (Extension works immediately!)

The extension is ready to load in Chrome **right now**. Icons are optional and can be added later.

### Step 1: Load Extension in Chrome

1. Open Chrome and go to: `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top-right)
3. Click **"Load unpacked"**
4. Navigate to and select: `C:\Users\s.bateman\Programs\LanguageLearnerExtension`
5. Click **"Select Folder"**

✓ The extension should now be loaded! You'll see a default icon (puzzle piece) in your toolbar.

### Step 2: Get Google Translate API Key (FREE)

1. Go to: https://console.cloud.google.com/
2. Click **"Select a project"** → **"New Project"**
3. Name: "Language Learner" → **Create**
4. Search for: **"Cloud Translation API"** → **Enable**
5. Go to **"Credentials"** → **"+ CREATE CREDENTIALS"** → **"API Key"**
6. **Copy** your API key

**Free tier**: $10/month credit = 500,000 characters

### Step 3: Configure Extension

1. Click the extension icon (puzzle piece or custom icon)
2. Paste your **API key**
3. Select **Target Language** (language you're learning)
4. Keep **Source Language** as your native language
5. Check both boxes:
   - ✅ Auto-translate words on pages
   - ✅ Show original text on hover
6. Click **"Save Settings"**

### Step 4: Test It!

1. Go to any English website (Wikipedia, news, etc.)
2. **Select a word** (e.g., "beautiful")
3. **Right-click** → **"Translate & Save Word"**
4. Wait 1-2 seconds
5. You'll see: "beautiful → 美丽的 saved!"
6. **Refresh the page** - the word is now translated!
7. **Hover** to see the original

---

## Adding Custom Icons (Optional)

The extension works fine with Chrome's default icon, but you can add custom ones:

### Option A: Python Script (Recommended)

```bash
cd C:\Users\s.bateman\Programs\LanguageLearnerExtension
pip install pillow
python generate_icons.py
```

This creates three PNG files in the `icons/` folder.

### Option B: HTML Generator

1. Open `icons/generate-icons.html` in Chrome
2. Click the three download buttons
3. Move downloaded PNG files to the `icons/` folder

### Option C: Use Your Own Icons

Create three PNG files (16x16, 48x48, 128x128) and save as:
- `icons/icon16.png`
- `icons/icon48.png`
- `icons/icon128.png`

### Re-enable Icons in Manifest

After generating icons, update `manifest.json`:

```json
"action": {
  "default_popup": "popup.html",
  "default_icon": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
},
"icons": {
  "16": "icons/icon16.png",
  "48": "icons/icon48.png",
  "128": "icons/icon128.png"
}
```

Then reload the extension in `chrome://extensions/`.

---

## Troubleshooting

### "Could not load icon" error
- **Solution**: Icons are optional. Extension works without them.
- The manifest has been set up to work without icons by default.

### "API key not configured"
- Make sure you pasted the key and clicked "Save Settings"
- Check for extra spaces

### Extension not appearing
- Check "Developer mode" is ON
- Look in the extensions menu (puzzle piece icon)
- Pin the extension for easy access

### Words not translating
- Refresh the page after saving a word
- Check "Auto-translate" is enabled
- Verify API key is saved

---

## What's Next?

1. **Add 10-20 words** you want to learn
2. **Browse normally** - see them translated everywhere
3. **Visit foreign language sites** - test your knowledge
4. **Export your words** regularly for backup

See `README.md` for full documentation.

---

**Ready to learn!** 🎉
