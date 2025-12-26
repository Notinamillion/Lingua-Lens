# Jieba Dictionary Upgrade

## Summary

Upgraded the Chinese word segmentation dictionary from **900 words** to **10,000 words** to dramatically improve Smart Translate quality.

## Changes Made

### 1. Created jieba-full.js (106KB)
- Extracted top 10,000 most common Chinese words from official jieba dictionary
- Words filtered to 2-4 characters in length
- Frequency range: 795 to 142,747 occurrences
- File size: 106KB (very reasonable for 10,000 words)

### 2. Updated background.js
- Changed `importScripts('jieba-simple.js')` to `importScripts('jieba-full.js')`
- Changed `JiebaSimple.cut()` to `JiebaFull.cut()`

## Expected Improvements

### Before (900 words):
```
Original: Thousands of species at risk of extinction in Wales have been revealed in a new study.
Output: 一 item new Research Uncover Show Already Wei you scholar number thousand kind near Approaching Extinction Absolute 的 thing kind
```

### After (10,000 words):
```
Should segment properly:
- 研究 (research) - stays as one word
- 数千 (thousands) - stays as one word
- 物种 (species) - stays as one word
- 濒临 (at risk of) - stays as one word
- 灭绝 (extinction) - stays as one word
```

## Dictionary Coverage

- **jieba-simple.js**: 900 words (0.3% of Python jieba)
- **jieba-full.js**: 10,000 words (3.3% of Python jieba)
- **Improvement**: 11x more words, 10x better coverage

## Common Words Now Included

Top frequency words now in dictionary:
- 一个 (one), 中国 (China), 我们 (we), 他们 (they)
- 研究 (research), 发展 (development), 工作 (work)
- 问题 (problem), 进行 (conduct), 地方 (place)
- 经济 (economy), 社会 (society), 知道 (know)
- 开始 (start), 技术 (technology), 重要 (important)
- 因为 (because), 通过 (through), 文化 (culture)
- 历史 (history), 世界 (world), 现在 (now)

## Testing

To test the upgrade:

1. Reload extension in `chrome://extensions/`
2. Select text: "Thousands of species at risk of extinction in Wales have been revealed in a new study"
3. Right-click → "Smart Translate Sentence"
4. Check console for `[Jieba Full] Loaded dictionary with 10000 words`
5. Verify segmentation is much better - words like "研究", "物种", "濒临", "灭绝" should stay together

## File Size Impact

- Old: jieba-simple.js (13KB)
- New: jieba-full.js (106KB)
- **Increase: +93KB** (very reasonable for 11x improvement)

## Future Improvements

If segmentation quality is still not sufficient, we can:

1. Increase to 20,000 or 50,000 words (still manageable file size)
2. Add Named Entity Recognition (NER) to preserve proper nouns like "Wales", "Snowdon"
3. Integrate full jieba.js library with 300,000+ words (8MB)

## Notes

- Traditional and simplified Chinese both included in dictionary
- Maximum word length still 4 characters (maxWordLen = 4)
- Maximum Matching algorithm unchanged
- Compatible with existing Chrome extension service worker
