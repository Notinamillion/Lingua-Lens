// Content Script for Language Learning Extension
// Handles DOM manipulation and automatic word translation

(function() {
  'use strict';

  // State
  let knownWords = {};
  let settings = {};
  let isInitialized = false;
  let processedNodes = new WeakSet();
  let observer = null;
  let tooltipTimeout = null;

  // Pattern caching for performance optimization
  let cachedPatterns = null;
  let cachedKnownWordsHash = null;

  // Debounce timeout for storage changes
  let storageChangeTimeout = null;

  // Notification element
  let notificationElement = null;

  // Elements to skip (won't translate these)
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'CODE', 'PRE']);
  const SKIP_ATTRIBUTES = ['data-translated', 'contenteditable'];

  // Check if current URL is excluded
  function isUrlExcluded(currentUrl, excludedUrls) {
    if (!excludedUrls || excludedUrls.length === 0) {
      return false;
    }

    const hostname = new URL(currentUrl).hostname;

    return excludedUrls.some(excludedPattern => {
      // Normalize the pattern
      const pattern = excludedPattern.toLowerCase().trim();

      // Check if hostname contains the pattern
      if (hostname.includes(pattern)) {
        return true;
      }

      // Check if pattern matches any part of the full URL
      if (currentUrl.toLowerCase().includes(pattern)) {
        return true;
      }

      return false;
    });
  }

  // Initialize the extension
  async function initialize() {
    if (isInitialized) return;

    console.log('Language Learning Extension: Initializing...');

    // Load settings and known words
    await loadData();

    // Load Chinese known words for highlighting
    await loadChineseKnownWords();

    // Check if current URL is excluded
    if (settings.excludedUrls && isUrlExcluded(window.location.href, settings.excludedUrls)) {
      console.log('Language Learning Extension: Skipping excluded URL');
      return;
    }

    if (settings.autoTranslate) {
      // Start processing the page
      processPage();

      // Set up mutation observer for dynamic content
      setupMutationObserver();
    }

    // Always highlight Chinese known words (regardless of autoTranslate setting)
    highlightChineseKnownWords();

    isInitialized = true;
    console.log('Language Learning Extension: Ready');
  }

  // Load settings and known words from storage
  async function loadData() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['settings', 'knownWords'], (data) => {
        settings = data.settings || {};
        knownWords = data.knownWords || {};
        console.log(`Loaded ${Object.keys(knownWords).length} known words`);
        resolve();
      });
    });
  }

  // Process the entire page
  function processPage() {
    if (!settings.autoTranslate) return;

    const start = performance.now();

    // Detect page language
    const pageLanguage = detectPageLanguage();

    // Determine translation mode
    const mode = determineMode(pageLanguage);

    let stats = { totalOccurrences: 0, uniqueWords: new Set(), wordFrequency: {} };
    let modeLabel = 'Unknown';

    if (mode === 'learn') {
      // Translate known words to target language
      stats = translateKnownWords();
      modeLabel = `Learn (${settings.sourceLanguage || 'auto'} → ${settings.targetLanguage || 'target'})`;
    } else if (mode === 'practice') {
      // Translate all words except known ones
      translateUnknownWords();
      modeLabel = 'Practice';
    }

    const elapsed = performance.now() - start;

    // Log detailed performance stats
    if (stats.totalOccurrences > 0) {
      logPerformanceStats(stats, elapsed, modeLabel);
    } else {
      console.log(`%cLingua-Lens: No vocabulary words found on this page (${elapsed.toFixed(2)}ms)`, 'color: #999; font-style: italic;');
    }
  }

  // Detect the language of the page
  function detectPageLanguage() {
    // Check HTML lang attribute
    const htmlLang = document.documentElement.lang;
    if (htmlLang) {
      return htmlLang.split('-')[0].toLowerCase();
    }

    // Check meta tags
    const metaLang = document.querySelector('meta[http-equiv="content-language"]');
    if (metaLang) {
      return metaLang.content.split('-')[0].toLowerCase();
    }

    // Sample text from page
    const sampleText = document.body.innerText.substring(0, 200);

    // Simple detection based on character sets
    if (/[\u4e00-\u9fa5]/.test(sampleText)) return 'zh';
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(sampleText)) return 'ja';
    if (/[\uac00-\ud7af]/.test(sampleText)) return 'ko';
    if (/[\u0600-\u06ff]/.test(sampleText)) return 'ar';
    if (/[\u0400-\u04ff]/.test(sampleText)) return 'ru';

    // Default to English
    return 'en';
  }

  // Determine which mode to use (learn or practice)
  function determineMode(pageLanguage) {
    const targetLangCode = settings.targetLanguage?.split('-')[0].toLowerCase();
    const sourceLangCode = settings.sourceLanguage?.split('-')[0].toLowerCase();

    // If page is in source language (e.g., English), translate known words to target
    if (pageLanguage === sourceLangCode) {
      return 'learn';
    }

    // If page is in target language (e.g., Chinese), translate unknown words to source
    if (pageLanguage === targetLangCode) {
      return 'practice';
    }

    // Default to settings mode
    return settings.mode || 'learn';
  }

  // Translate known words to target language (learn mode)
  function translateKnownWords() {
    const wordList = Object.keys(knownWords);
    if (wordList.length === 0) return { totalOccurrences: 0, uniqueWords: new Set(), wordFrequency: {} };

    // Get compiled patterns (with caching)
    const patterns = getCompiledPatterns(knownWords);

    // Performance stats object
    const stats = {
      totalOccurrences: 0,
      uniqueWords: new Set(),
      wordFrequency: {}
    };

    // Walk through all text nodes
    walkTextNodes(document.body, (textNode) => {
      if (processedNodes.has(textNode)) return;

      const originalText = textNode.textContent;

      // Check if any pattern matches
      let hasMatches = false;
      for (const pattern of patterns) {
        pattern.lastIndex = 0;
        if (pattern.test(originalText)) {
          hasMatches = true;
          break;
        }
      }

      if (!hasMatches) return;

      // Process with all patterns (replaceTextNode will handle multiple patterns)
      replaceTextNode(textNode, originalText, patterns, 'learn', stats);
      processedNodes.add(textNode);
    });

    return stats;
  }

  // Translate unknown words to source language (practice mode)
  function translateUnknownWords() {
    // For practice mode, we would translate all text except known words
    // This is more complex and requires API calls, so we'll mark words differently

    console.log('Practice mode: Marking known words...');

    const wordList = Object.keys(knownWords).map(w => knownWords[w].translation);
    if (wordList.length === 0) {
      console.log('No known words to preserve');
      return;
    }

    // Create pattern for known translations (these we DON'T translate)
    const escapedWords = wordList.map(w => escapeRegex(w));
    const pattern = new RegExp(`(${escapedWords.join('|')})`, 'g');

    walkTextNodes(document.body, (textNode) => {
      if (processedNodes.has(textNode)) return;

      const originalText = textNode.textContent;
      const matches = originalText.match(pattern);

      if (matches) {
        // Mark known words (don't translate these)
        highlightKnownWords(textNode, originalText, pattern);
        processedNodes.add(textNode);
      }
    });
  }

  // Replace text node with translated content
  function replaceTextNode(textNode, originalText, patterns, mode, stats = {}) {
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match;

    // Collect all matches from all patterns
    const matches = [];

    // Handle both single pattern and array of patterns
    const patternsArray = Array.isArray(patterns) ? patterns : [patterns];

    for (const pattern of patternsArray) {
      pattern.lastIndex = 0;
      while ((match = pattern.exec(originalText)) !== null) {
        matches.push({
          text: match[0],
          index: match.index,
          endIndex: pattern.lastIndex
        });
      }
    }

    // Sort matches by index and remove duplicates/overlaps
    matches.sort((a, b) => a.index - b.index);
    const uniqueMatches = [];
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      // Skip if this match overlaps with the previous one
      if (uniqueMatches.length === 0 || current.index >= uniqueMatches[uniqueMatches.length - 1].endIndex) {
        uniqueMatches.push(current);
      }
    }

    // If compound words dictionary is available, check for compounds
    if (typeof window.findCompound === 'function' && uniqueMatches.length > 0) {
      const processedIndices = new Set();

      for (let i = 0; i < uniqueMatches.length; i++) {
        if (processedIndices.has(i)) continue;

        const currentMatch = uniqueMatches[i];
        const matchedWord = currentMatch.text;
        const wordKey = matchedWord.toLowerCase();
        const wordData = knownWords[wordKey];

        if (!wordData) continue;

        // Check if this is part of a compound word with following words
        const chineseWords = [wordData.translation];
        for (let j = i + 1; j < uniqueMatches.length && j <= i + 2; j++) {
          const nextWord = uniqueMatches[j].text.toLowerCase();
          const nextData = knownWords[nextWord];
          if (nextData) {
            chineseWords.push(nextData.translation);
          }
        }

        // Try to find compound if we have multiple words
        let compoundResult = null;
        if (chineseWords.length > 1) {
          compoundResult = window.findCompound(chineseWords, 0, 2);
        }

        // Add text before match
        if (currentMatch.index > lastIndex) {
          fragment.appendChild(
            document.createTextNode(originalText.slice(lastIndex, currentMatch.index))
          );
        }

        if (compoundResult) {
          // Found compound - use compound translation
          const compoundLength = compoundResult.length;

          // Track statistics for all words in compound
          if (stats) {
            for (let j = i; j < i + compoundLength && j < uniqueMatches.length; j++) {
              const word = uniqueMatches[j].text.toLowerCase();
              stats.totalOccurrences = (stats.totalOccurrences || 0) + 1;
              stats.uniqueWords = stats.uniqueWords || new Set();
              stats.uniqueWords.add(word);
              stats.wordFrequency = stats.wordFrequency || {};
              stats.wordFrequency[word] = (stats.wordFrequency[word] || 0) + 1;
              processedIndices.add(j);
            }
          }

          // Create span for compound translation
          const span = document.createElement('span');
          span.className = 'lang-learner-translated lang-learner-compound';
          span.textContent = compoundResult.translation;

          // Build data-original from all matched words
          const originalWords = [];
          for (let j = i; j < i + compoundLength && j < uniqueMatches.length; j++) {
            originalWords.push(uniqueMatches[j].text);
          }
          span.setAttribute('data-original', originalWords.join(' '));
          span.setAttribute('data-compound', compoundResult.compound);
          span.setAttribute('data-translated', 'true');
          span.style.cssText = 'text-decoration: underline dotted; cursor: help; color: inherit; font-weight: 500;';

          // Add tooltip showing compound
          if (settings.showTooltips) {
            const tooltipText = `${compoundResult.compound}\n(${originalWords.join(' ')})`;
            span.addEventListener('mouseover', (e) => {
              clearTimeout(tooltipTimeout);
              showTooltip(span, tooltipText);
            });
            span.addEventListener('mouseout', (e) => {
              tooltipTimeout = setTimeout(() => {
                hideTooltip();
              }, 100);
            });
          }

          fragment.appendChild(span);
          lastIndex = uniqueMatches[i + compoundLength - 1].endIndex;
        } else {
          // No compound - process single word normally
          if (stats) {
            stats.totalOccurrences = (stats.totalOccurrences || 0) + 1;
            stats.uniqueWords = stats.uniqueWords || new Set();
            stats.uniqueWords.add(wordKey);
            stats.wordFrequency = stats.wordFrequency || {};
            stats.wordFrequency[wordKey] = (stats.wordFrequency[wordKey] || 0) + 1;
          }

          const span = document.createElement('span');
          span.className = 'lang-learner-translated';
          span.textContent = wordData.translation;
          span.setAttribute('data-original', matchedWord);
          span.setAttribute('data-translated', 'true');
          span.style.cssText = 'text-decoration: underline dotted; cursor: help; color: inherit;';

          if (settings.showTooltips) {
            let tooltipText = matchedWord;
            if (wordData.pinyin) {
              tooltipText = `${matchedWord}\n${wordData.pinyin}`;
            }

            span.addEventListener('mouseover', (e) => {
              clearTimeout(tooltipTimeout);
              showTooltip(span, tooltipText);
            });

            span.addEventListener('mouseout', (e) => {
              tooltipTimeout = setTimeout(() => {
                hideTooltip();
              }, 100);
            });
          }

          fragment.appendChild(span);
          lastIndex = currentMatch.endIndex;
          processedIndices.add(i);
        }
      }
    } else {
      // No compound words support - use already collected matches
      for (const match of uniqueMatches) {
        const matchedWord = match.text;
        const wordKey = matchedWord.toLowerCase();
        const wordData = knownWords[wordKey];

        if (!wordData) continue;

        // Track word statistics
        if (stats) {
          stats.totalOccurrences = (stats.totalOccurrences || 0) + 1;
          stats.uniqueWords = stats.uniqueWords || new Set();
          stats.uniqueWords.add(wordKey);
          stats.wordFrequency = stats.wordFrequency || {};
          stats.wordFrequency[wordKey] = (stats.wordFrequency[wordKey] || 0) + 1;
        }

        // Add text before match
        if (match.index > lastIndex) {
          fragment.appendChild(
            document.createTextNode(originalText.slice(lastIndex, match.index))
          );
        }

        // Create translated span
        const span = document.createElement('span');
        span.className = 'lang-learner-translated';
        span.textContent = wordData.translation;
        span.setAttribute('data-original', matchedWord);
        span.setAttribute('data-translated', 'true');
        span.style.cssText = 'text-decoration: underline dotted; cursor: help; color: inherit;';

        // Add tooltip on hover
        if (settings.showTooltips) {
          // Prepare tooltip text with Pinyin if available
          let tooltipText = matchedWord;
          if (wordData.pinyin) {
            tooltipText = `${matchedWord}\n${wordData.pinyin}`;
          }

          // Custom tooltip with mouseover/mouseout (works inside links)
          span.addEventListener('mouseover', (e) => {
            clearTimeout(tooltipTimeout);
            showTooltip(span, tooltipText);
          });

          span.addEventListener('mouseout', (e) => {
            tooltipTimeout = setTimeout(() => {
              hideTooltip();
            }, 100);
          });
        }

        fragment.appendChild(span);
        lastIndex = match.endIndex;
      }
    }

    // Add remaining text
    if (lastIndex < originalText.length) {
      fragment.appendChild(
        document.createTextNode(originalText.slice(lastIndex))
      );
    }

    // Replace the text node with the fragment
    textNode.parentNode.replaceChild(fragment, textNode);
  }

  // Highlight known words in practice mode
  function highlightKnownWords(textNode, originalText, pattern) {
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match;

    pattern.lastIndex = 0;

    while ((match = pattern.exec(originalText)) !== null) {
      const matchedWord = match[0];

      // Add text before match
      if (match.index > lastIndex) {
        fragment.appendChild(
          document.createTextNode(originalText.slice(lastIndex, match.index))
        );
      }

      // Highlight known word
      const span = document.createElement('span');
      span.className = 'lang-learner-known';
      span.textContent = matchedWord;
      span.setAttribute('data-known', 'true');
      span.style.cssText = 'background-color: rgba(76, 175, 80, 0.2); padding: 0 2px; border-radius: 2px;';
      span.title = 'Known word';

      fragment.appendChild(span);
      lastIndex = pattern.lastIndex;
    }

    // Add remaining text
    if (lastIndex < originalText.length) {
      fragment.appendChild(
        document.createTextNode(originalText.slice(lastIndex))
      );
    }

    textNode.parentNode.replaceChild(fragment, textNode);
  }

  // Walk through all text nodes in the DOM
  function walkTextNodes(root, callback) {
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          // Skip empty nodes
          if (!node.textContent.trim()) {
            return NodeFilter.FILTER_REJECT;
          }

          // Skip elements we don't want to translate
          let parent = node.parentElement;
          while (parent) {
            if (SKIP_TAGS.has(parent.tagName)) {
              return NodeFilter.FILTER_REJECT;
            }

            // Skip if parent has skip attributes
            for (const attr of SKIP_ATTRIBUTES) {
              if (parent.hasAttribute(attr)) {
                return NodeFilter.FILTER_REJECT;
              }
            }

            parent = parent.parentElement;
          }

          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let node;
    while (node = walker.nextNode()) {
      callback(node);
    }
  }

  // Set up mutation observer for dynamic content
  // Process a specific subtree (for incremental mutation processing)
  function processSubtree(root, mode) {
    if (!settings.autoTranslate) return;
    if (!root || !root.nodeType) return;

    // Use the same mode as the page
    const actualMode = mode || determineMode(detectPageLanguage());

    if (actualMode === 'learn') {
      // Get cached patterns
      const patterns = getCompiledPatterns(knownWords);
      if (patterns.length === 0) return;

      // Walk through text nodes in this subtree only
      walkTextNodes(root, (textNode) => {
        if (processedNodes.has(textNode)) return;

        const originalText = textNode.textContent;

        // Check if any pattern matches (early exit)
        let hasMatches = false;
        for (const pattern of patterns) {
          pattern.lastIndex = 0;
          if (pattern.test(originalText)) {
            hasMatches = true;
            break;
          }
        }

        if (!hasMatches) return;

        // Process with all patterns
        const stats = { totalOccurrences: 0, uniqueWords: new Set(), wordFrequency: {} };
        replaceTextNode(textNode, originalText, patterns, 'learn', stats);
        processedNodes.add(textNode);
      });
    }
  }

  function setupMutationObserver() {
    if (observer) return;

    observer = new MutationObserver((mutations) => {
      // Collect mutated roots for incremental processing
      const mutatedRoots = new Set();

      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE && !processedNodes.has(node)) {
              mutatedRoots.add(node);
            }
          });
        }
      }

      if (mutatedRoots.size > 0) {
        // Debounce processing
        clearTimeout(setupMutationObserver.timeout);
        setupMutationObserver.timeout = setTimeout(() => {
          console.log('[Performance] Processing', mutatedRoots.size, 'mutated subtrees incrementally');

          // Detect mode once for all subtrees
          const pageLanguage = detectPageLanguage();
          const mode = determineMode(pageLanguage);

          // Process each mutated subtree instead of entire page
          mutatedRoots.forEach(root => {
            processSubtree(root, mode);
          });
        }, 500);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Show custom tooltip
  function showTooltip(element, text) {
    hideTooltip();

    const tooltip = document.createElement('div');
    tooltip.id = 'lang-learner-tooltip';
    tooltip.setAttribute('data-translated', 'true');
    tooltip.textContent = text;
    tooltip.style.cssText = `
      position: absolute;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 999999;
      pointer-events: none;
      white-space: pre-line;
      text-align: center;
      line-height: 1.4;
    `;

    document.body.appendChild(tooltip);

    const rect = element.getBoundingClientRect();
    tooltip.style.left = `${rect.left + window.scrollX}px`;
    tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
  }

  // Hide tooltip
  function hideTooltip() {
    clearTimeout(tooltipTimeout);
    const tooltip = document.getElementById('lang-learner-tooltip');
    if (tooltip) {
      tooltip.remove();
    }
  }

  // Safe string padding helper (replaces padEnd for compatibility)
  function safePad(value, length) {
    let str = String(value || '');
    while (str.length < length) {
      str += ' ';
    }
    return str;
  }

  // Log performance statistics
  function logPerformanceStats(stats, elapsed, mode) {
    try {
      // Safety checks
      if (!stats || typeof stats !== 'object') {
        console.error('Lingua-Lens: Invalid stats object');
        return;
      }

      // Use safe defaults
      const totalOccurrences = stats.totalOccurrences || 0;
      const uniqueWords = stats.uniqueWords || new Set();
      const wordFrequency = stats.wordFrequency || {};

      const totalVocab = Object.keys(knownWords).length;
      const uniqueWordsCount = uniqueWords.size;
      const coverage = totalVocab > 0 ? ((uniqueWordsCount / totalVocab) * 100).toFixed(1) : 0;
      const avgTime = totalOccurrences > 0 ? (elapsed / totalOccurrences).toFixed(2) : 0;

      // Sort words by frequency
      const topWords = Object.entries(wordFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      console.log('%c╔═══════════════════════════════════════════════════════╗', 'color: #4CAF50; font-weight: bold;');
      console.log('%c║         Lingua-Lens Performance Report               ║', 'color: #4CAF50; font-weight: bold;');
      console.log('%c╠═══════════════════════════════════════════════════════╣', 'color: #4CAF50; font-weight: bold;');
      console.log(`%c║ Page: ${safePad(window.location.href.substring(0, 45), 45)} ║`, 'color: #2196F3;');
      console.log(`%c║ Mode: ${safePad(mode, 47)} ║`, 'color: #2196F3;');
      console.log('%c║                                                       ║', 'color: #4CAF50;');
      console.log('%c║ Vocabulary Stats:                                    ║', 'color: #FF9800; font-weight: bold;');
      console.log(`%c║   • Total vocabulary size: ${safePad(totalVocab, 23)} ║`, 'color: #333;');
      console.log(`%c║   • Unique words found: ${safePad(uniqueWordsCount, 26)} ║`, 'color: #333;');
      console.log(`%c║   • Coverage: ${safePad(coverage + '%', 36)} ║`, 'color: #333;');
      console.log('%c║                                                       ║', 'color: #4CAF50;');
      console.log('%c║ Translation Stats:                                   ║', 'color: #FF9800; font-weight: bold;');
      console.log(`%c║   • Total occurrences: ${safePad(totalOccurrences, 26)} ║`, 'color: #333;');
      console.log(`%c║   • Processing time: ${safePad(elapsed.toFixed(2) + 'ms', 28)} ║`, 'color: #333;');
      console.log(`%c║   • Avg per occurrence: ${safePad(avgTime + 'ms/word', 25)} ║`, 'color: #333;');

      if (topWords.length > 0) {
        console.log('%c║                                                       ║', 'color: #4CAF50;');
        console.log('%c║ Top words on page:                                   ║', 'color: #FF9800; font-weight: bold;');
        topWords.forEach(([word, count], index) => {
          const line = `   ${index + 1}. "${word}" (${count} times)`;
          console.log(`%c║ ${safePad(line, 52)} ║`, 'color: #333;');
        });
      }

      console.log('%c╚═══════════════════════════════════════════════════════╝', 'color: #4CAF50; font-weight: bold;');
    } catch (error) {
      console.error('Lingua-Lens: Error logging performance stats:', error);
    }
  }

  // Show notification
  function showNotification(message, type = 'info', duration = 3000) {
    hideNotification();

    notificationElement = document.createElement('div');
    notificationElement.id = 'lang-learner-notification';
    notificationElement.textContent = message;

    const colors = {
      info: '#2196F3',
      success: '#4CAF50',
      error: '#F44336'
    };

    notificationElement.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${colors[type] || colors.info};
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 999999;
      font-size: 14px;
      max-width: 300px;
      animation: slideIn 0.3s ease-out;
    `;

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notificationElement);

    if (duration > 0) {
      setTimeout(hideNotification, duration);
    }
  }

  // Hide notification
  function hideNotification() {
    if (notificationElement) {
      notificationElement.remove();
      notificationElement = null;
    }
  }

  // Escape regex special characters
  function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Get compiled regex patterns with caching
  function getCompiledPatterns(knownWords) {
    const wordList = Object.keys(knownWords);

    // Create hash of known words (sorted for consistency)
    const currentHash = wordList.sort().join('|');

    // Return cached patterns if words haven't changed
    if (cachedPatterns && cachedKnownWordsHash === currentHash) {
      console.log('[Performance] Using cached regex patterns');
      return cachedPatterns;
    }

    console.log('[Performance] Compiling new regex patterns for', wordList.length, 'words');

    // Compile new patterns
    const escapedWords = wordList.map(w => escapeRegex(w));
    const patterns = [];
    const CHUNK_SIZE = 200;

    for (let i = 0; i < escapedWords.length; i += CHUNK_SIZE) {
      const chunk = escapedWords.slice(i, i + CHUNK_SIZE);
      patterns.push(new RegExp(`\\b(${chunk.join('|')})\\b`, 'gi'));
    }

    // Cache patterns and hash
    cachedPatterns = patterns;
    cachedKnownWordsHash = currentHash;

    return patterns;
  }

  // ============================================
  // Chinese Word Highlighting (Known Words)
  // ============================================

  let chineseKnownWords = new Set();
  let chineseHighlightStyle = 'underline';
  let chineseProcessedNodes = new WeakSet();

  // Load Chinese known words from storage
  async function loadChineseKnownWords() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['chineseKnownWords', 'chineseHighlightStyle'], function(result) {
        chineseKnownWords = new Set(result.chineseKnownWords || []);
        chineseHighlightStyle = result.chineseHighlightStyle || 'underline';
        console.log(`[Chinese Highlighting] Loaded ${chineseKnownWords.size} known Chinese words`);
        resolve();
      });
    });
  }

  // Check if a string contains Chinese characters
  function containsChinese(text) {
    return /[\u4e00-\u9fff]/.test(text);
  }

  // Highlight known Chinese words in the page
  function highlightChineseKnownWords() {
    if (chineseKnownWords.size === 0) {
      console.log('[Chinese Highlighting] No known words to highlight');
      return;
    }

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          // Skip script and style elements
          if (node.parentElement.tagName === 'SCRIPT' ||
              node.parentElement.tagName === 'STYLE' ||
              node.parentElement.classList.contains('chinese-known-word') ||
              node.parentElement.classList.contains('lang-learner-translated') ||
              node.parentElement.hasAttribute('data-translated')) {
            return NodeFilter.FILTER_REJECT;
          }
          return containsChinese(node.textContent) ?
            NodeFilter.FILTER_ACCEPT :
            NodeFilter.FILTER_REJECT;
        }
      }
    );

    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      if (!chineseProcessedNodes.has(node)) {
        textNodes.push(node);
      }
    }

    let highlightCount = 0;

    // Build sorted array of known words (longest first for greedy matching)
    const sortedWords = Array.from(chineseKnownWords).sort((a, b) => b.length - a.length);

    textNodes.forEach(textNode => {
      const text = textNode.textContent;
      const fragment = document.createDocumentFragment();
      const matches = []; // Store all match positions (kept sorted by start position)

      // Find all matches using optimized algorithm with binary search for overlap detection
      for (const word of sortedWords) {
        let startIndex = 0;
        let index;

        while ((index = text.indexOf(word, startIndex)) !== -1) {
          const end = index + word.length;

          // Binary search for overlaps - O(log n) instead of O(n)
          let overlaps = false;
          let left = 0;
          let right = matches.length - 1;

          while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const m = matches[mid];

            // Check if current position overlaps with match at mid
            if (index < m.end && end > m.start) {
              overlaps = true;
              break;
            }

            // Navigate to correct part of array
            if (end <= m.start) {
              right = mid - 1;
            } else {
              left = mid + 1;
            }
          }

          if (!overlaps) {
            // Insert in sorted position (left is the correct insertion point)
            matches.splice(left, 0, {
              start: index,
              end: end,
              word: word
            });
          }

          startIndex = index + 1;
        }
      }

      if (matches.length > 0) {
        // Matches are already sorted by start position from binary search insertion
        let lastIndex = 0;

        for (const match of matches) {
          // Add text before the match
          if (match.start > lastIndex) {
            fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.start)));
          }

          // Create highlighted span for known word
          const span = document.createElement('span');
          span.className = 'chinese-known-word ' + chineseHighlightStyle;
          span.textContent = match.word;
          span.dataset.word = match.word;
          span.title = 'Known word';
          fragment.appendChild(span);

          lastIndex = match.end;
          highlightCount++;
        }

        // Add remaining text
        if (lastIndex < text.length) {
          fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
        }

        textNode.parentNode.replaceChild(fragment, textNode);
        chineseProcessedNodes.add(textNode);
      }
    });

    if (highlightCount > 0) {
      console.log(`[Chinese Highlighting] Highlighted ${highlightCount} known words`);
    }
  }

  // Listen for Chinese known words storage changes
  chrome.storage.onChanged.addListener(function(changes, namespace) {
    // Invalidate pattern cache when known words change
    if (namespace === 'local' && changes.knownWords) {
      console.log('[Performance] Invalidating pattern cache due to knownWords change');
      cachedPatterns = null;
      cachedKnownWordsHash = null;
    }

    // Re-highlight Chinese words when they change (debounced)
    if (namespace === 'sync' && (changes.chineseKnownWords || changes.chineseHighlightStyle)) {
      clearTimeout(storageChangeTimeout);

      storageChangeTimeout = setTimeout(() => {
        console.log('[Performance] Debounced Chinese word re-highlighting');
        loadChineseKnownWords().then(() => {
          chineseProcessedNodes = new WeakSet();
          highlightChineseKnownWords();
        });
      }, 300); // Wait 300ms before re-highlighting
    }
  });

  // Extract original text from selection (handles auto-translated text)
  function getOriginalTextFromSelection(selectedText) {
    try {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return selectedText;
      }

      const range = selection.getRangeAt(0);
      const container = range.cloneContents();

      // Recursively extract original text from nodes
      function extractFromNode(node) {
        let text = '';

        if (node.nodeType === Node.TEXT_NODE) {
          // Regular text node - add it
          text += node.textContent;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          // Check if this is a translated span
          if (node.classList && node.classList.contains('lang-learner-translated')) {
            const original = node.getAttribute('data-original');
            if (original) {
              // Use original English instead of Chinese translation
              text += original + ' ';
            } else {
              // No original attribute, use text content
              text += node.textContent + ' ';
            }
          } else {
            // Not a translated span - process children
            for (let child of node.childNodes) {
              text += extractFromNode(child);
            }
          }
        }

        return text;
      }

      let originalText = '';
      for (let child of container.childNodes) {
        originalText += extractFromNode(child);
      }

      const result = originalText.replace(/\s+/g, ' ').trim();
      console.log('[ORIGINAL TEXT] Extracted:', result);
      return result || selectedText;
    } catch (error) {
      console.error('[ORIGINAL TEXT] Error extracting:', error);
      return selectedText;
    }
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'refreshTranslations') {
      loadData().then(() => {
        // Clear processed nodes
        processedNodes = new WeakSet();
        // Re-process page
        processPage();
        highlightChineseKnownWords();
      });
    } else if (request.action === 'showNotification') {
      showNotification(request.message, request.type, request.duration);
    } else if (request.action === 'storageChanged') {
      // Reload data when storage changes
      loadData().then(() => {
        processedNodes = new WeakSet();
        processPage();
        highlightChineseKnownWords();
      });
    } else if (request.action === 'readAloud') {
      // Handle read-aloud request
      if (window.ttsReader) {
        window.ttsReader.readText(request.text);
        showNotification('Reading text aloud...', 'info', 2000);
      } else {
        showNotification('TTS reader not available', 'error', 3000);
      }
    } else if (request.action === 'getOriginalText') {
      // Extract original text from selection
      const originalText = getOriginalTextFromSelection(request.selectedText);
      sendResponse({ originalText: originalText });
      return true; // Async response
    } else if (request.action === 'refreshChineseHighlights') {
      // Refresh Chinese word highlights
      highlightChineseKnownWords();
      sendResponse({ success: true });
    } else if (request.action === 'getSelection') {
      const selection = window.getSelection().toString().trim();
      sendResponse({ selection: selection });
    }
  });

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();
