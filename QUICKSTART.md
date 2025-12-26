# Quick Start Guide

Get your Language Learning Extension up and running in 5 minutes!

## Step 1: Generate Icons (2 minutes)

1. Open `icons/generate-icons.html` in Chrome
2. Click the three download buttons:
   - Download 16x16
   - Download 48x48
   - Download 128x128
3. Move the downloaded PNG files from your Downloads folder to the `icons/` folder

**Note**: The extension will work without icons, but you'll see a default placeholder.

## Step 2: Load Extension in Chrome (1 minute)

1. Open Chrome and navigate to: `chrome://extensions/`
2. Toggle **"Developer mode"** ON (top-right corner)
3. Click **"Load unpacked"**
4. Select this folder: `C:\Users\s.bateman\Programs\LanguageLearnerExtension`
5. You should see "Language Learning Translator" appear in your extensions list

## Step 3: Get Google Translate API Key (FREE)

### Quick Method:
1. Go to: https://console.cloud.google.com/
2. Click **"Select a project"** → **"New Project"**
3. Name it "Language Learner" → **Create**
4. In the search bar, type **"Cloud Translation API"**
5. Click **"Enable"**
6. Go to **"Credentials"** (left sidebar)
7. Click **"+ CREATE CREDENTIALS"** → **"API Key"**
8. **Copy** the API key that appears

**Important**: You get $10/month FREE credit = 500,000 characters of translation!

## Step 4: Configure Extension (1 minute)

1. Click the extension icon in your Chrome toolbar (or find it in the extensions menu)
2. Paste your API key in the **"Google Translate API Key"** field
3. Select **Target Language**: Choose the language you're learning (e.g., "Chinese (Simplified)")
4. Keep **Source Language** as "English" (or your native language)
5. Ensure checkboxes are enabled:
   - ✅ Auto-translate words on pages
   - ✅ Show original text on hover
6. Click **"Save Settings"**

## Step 5: Try It Out! (1 minute)

1. Go to any English website (e.g., Wikipedia, news site, blog)
2. **Select a word** you want to learn (e.g., "beautiful")
3. **Right-click** → **"Translate & Save Word"**
4. Wait 1-2 seconds for the translation
5. You'll see a notification: "beautiful → 美丽的 saved!"
6. **Refresh the page** - the word now appears translated!
7. **Hover** over the translated word to see the original

## Usage Examples

### Example 1: Learning Chinese Vocabulary
```
1. Reading an English article about travel
2. See the word "adventure" → Select it
3. Right-click → "Translate & Save Word"
4. It translates to "冒险"
5. Now everywhere you read, "adventure" appears as "冒险"
6. Hover to see the English word when needed
```

### Example 2: Testing Your Knowledge
```
1. After learning 50+ words, visit a Chinese website
2. The extension translates everything to English
3. EXCEPT the 50 words you've learned
4. Those stay in Chinese - testing your knowledge!
```

## Common First-Time Issues

### "API key not configured"
- Make sure you pasted the API key and clicked "Save Settings"
- Check for extra spaces before/after the key

### "Words not showing up"
- Refresh the page after saving a new word
- Check that "Auto-translate" is enabled in settings

### "Can't see extension icon"
- Click the puzzle piece icon in Chrome toolbar
- Pin the "Language Learning Translator" extension

## Next Steps

- **Add 10-20 common words** you want to learn
- **Browse normally** - they'll appear translated automatically
- **Export your words** regularly as backup
- **Check stats** in the extension popup to track progress

## Tips for Best Results

1. **Start small**: Add 5-10 words first to test
2. **Use common words**: "good", "bad", "fast", "slow" appear everywhere
3. **Context matters**: Learn words while reading interesting content
4. **Export regularly**: Backup your vocabulary weekly
5. **Review hover tooltips**: Reinforces the connection to original word

---

## Troubleshooting

**Extension won't load?**
- Check Developer mode is ON
- Make sure you selected the correct folder
- Look for errors in chrome://extensions/

**API not working?**
- Verify API is enabled in Google Cloud Console
- Check you haven't exceeded free quota (unlikely in first use)
- Wait 1-2 minutes after creating API key for it to activate

**Need help?**
See the full README.md for detailed troubleshooting.

---

**You're all set!** Start learning vocabulary naturally while browsing the web. 🎉📚

Happy learning! 🌍
