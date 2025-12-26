// YouTube Subtitle Translation Module - With Pre-Translation
// Translates known words in YouTube subtitles with zero lag

(function() {
  'use strict';

  // State
  let knownWords = {};
  let settings = {};
  let observer = null;
  let isActive = false;
  let playerCheckInterval = null;

  // Pre-translation cache
  let subtitleCache = new Map(); // timestamp -> translated text
  let isPreTranslated = false;
  let currentVideoId = null;

  // TTS integration
  let ttsDebounceTimeout = null;
  const TTS_DEBOUNCE_DELAY = 300; // Wait 300ms for translation to complete

  // Initialize YouTube subtitle translation
  async function initialize() {
    console.log('YouTube Subtitle Translator: Initializing...');

    // Load settings and words
    await loadData();

    // Check if feature is enabled
    if (!settings.youtubeSubtitles || !settings.autoTranslate) {
      console.log('YouTube subtitle translation disabled in settings');
      return;
    }

    // Check if we're on a YouTube watch page
    if (!isYouTubeWatchPage()) {
      console.log('Not on YouTube watch page');
      return;
    }

    // Get current video ID
    const videoId = getVideoId();
    if (videoId !== currentVideoId) {
      currentVideoId = videoId;
      subtitleCache.clear();
      isPreTranslated = false;
    }

    console.log('YouTube Subtitle Translator: Feature enabled');

    // Wait for video player to load
    waitForVideoPlayer();
  }

  // Check if we're on a YouTube watch page
  function isYouTubeWatchPage() {
    return window.location.hostname === 'www.youtube.com' &&
           window.location.pathname === '/watch';
  }

  // Get current video ID from URL
  function getVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
  }

  // Load settings and known words from storage
  async function loadData() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['settings', 'knownWords'], (data) => {
        settings = data.settings || {};
        knownWords = data.knownWords || {};
        console.log(`Loaded ${Object.keys(knownWords).length} known words for YouTube`);
        resolve();
      });
    });
  }

  // Wait for YouTube video player to load
  function waitForVideoPlayer() {
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max

    playerCheckInterval = setInterval(async () => {
      attempts++;

      const player = document.querySelector('#movie_player');
      const container = document.querySelector('.ytp-caption-window-container');

      if (player && container) {
        clearInterval(playerCheckInterval);
        console.log('YouTube player and subtitle container found');

        // Try to pre-translate subtitles
        await attemptPreTranslation(player);

        // Set up observer for display
        setupSubtitleObserver(container);

        showActivationIndicator();
      } else if (attempts >= maxAttempts) {
        clearInterval(playerCheckInterval);
        console.log('YouTube player not found after 30 seconds');
      }
    }, 1000);
  }

  // Attempt to pre-translate all subtitles
  async function attemptPreTranslation(player) {
    try {
      console.log('Attempting to pre-translate subtitles...');

      // Show loading indicator
      showLoadingIndicator();

      // Get subtitle track data
      const subtitles = await getSubtitleTrackData(player);

      if (subtitles && subtitles.length > 0) {
        console.log(`Found ${subtitles.length} subtitle entries to pre-translate`);

        // Pre-translate all subtitles
        subtitles.forEach(subtitle => {
          const translatedText = translateText(subtitle.text);
          // Store with start time as key
          subtitleCache.set(subtitle.text.trim(), translatedText);
        });

        isPreTranslated = true;
        console.log('✓ Pre-translation complete!');
        hideLoadingIndicator();
      } else {
        console.log('Could not access subtitle track data, falling back to real-time translation');
        hideLoadingIndicator();
      }
    } catch (error) {
      console.log('Pre-translation failed, using real-time translation:', error.message);
      hideLoadingIndicator();
    }
  }

  // Get subtitle track data from YouTube player
  async function getSubtitleTrackData(player) {
    try {
      // Try to access YouTube's internal player API
      const ytPlayer = player;

      // Method 1: Try to get from player's caption tracks
      if (ytPlayer.getOption && ytPlayer.getOption('captions')) {
        const tracks = ytPlayer.getOption('captions', 'tracklist');
        if (tracks && tracks.length > 0) {
          const currentTrack = tracks.find(t => t.is_servable && t.is_default) || tracks[0];
          if (currentTrack && currentTrack.baseUrl) {
            return await fetchSubtitleTrack(currentTrack.baseUrl);
          }
        }
      }

      // Method 2: Try to access from player config
      const videoId = getVideoId();
      if (videoId) {
        // Try multiple caption URL patterns
        const lang = document.documentElement.lang || 'en';
        const captionUrls = [
          `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}`,
          `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en`,
          `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&kind=asr` // auto-generated
        ];

        for (const url of captionUrls) {
          try {
            const subtitles = await fetchSubtitleTrack(url);
            if (subtitles && subtitles.length > 0) {
              return subtitles;
            }
          } catch (e) {
            continue; // Try next URL
          }
        }
      }

      return null;
    } catch (error) {
      console.log('Error getting subtitle track:', error);
      return null;
    }
  }

  // Fetch and parse subtitle track from URL
  async function fetchSubtitleTrack(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;

      const text = await response.text();

      // Parse XML/JSON subtitle format
      return parseSubtitleData(text);
    } catch (error) {
      console.log('Error fetching subtitles:', error);
      return null;
    }
  }

  // Parse subtitle data (handles XML timedtext format)
  function parseSubtitleData(data) {
    const subtitles = [];

    try {
      // Try parsing as XML (YouTube's timedtext format)
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(data, 'text/xml');

      const textElements = xmlDoc.getElementsByTagName('text');

      for (let i = 0; i < textElements.length; i++) {
        const element = textElements[i];
        const start = parseFloat(element.getAttribute('start')) || 0;
        const duration = parseFloat(element.getAttribute('dur')) || 0;
        const text = element.textContent || '';

        // Decode HTML entities
        const decodedText = decodeHTMLEntities(text);

        subtitles.push({
          start: start,
          duration: duration,
          text: decodedText
        });
      }

      return subtitles;
    } catch (error) {
      console.log('Error parsing subtitle data:', error);
      return [];
    }
  }

  // Decode HTML entities in subtitle text
  function decodeHTMLEntities(text) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }

  // Translate text using known words
  function translateText(text) {
    if (!text) return text;

    // Split text into words, preserving whitespace
    const parts = text.split(/(\s+)/);
    const translated = [];
    let hasTranslations = false;

    parts.forEach((part) => {
      // If it's just whitespace, keep it
      if (/^\s+$/.test(part)) {
        translated.push(part);
        return;
      }

      // Clean word for matching
      const cleanWord = part.toLowerCase().replace(/[.,!?;:'"()[\]{}]/g, '');
      const wordData = knownWords[cleanWord];

      if (wordData && wordData.translation) {
        // Create styled span for translation
        translated.push(`<span class="lang-learner-yt-translated" data-original="${part}" style="color: #FFD700; font-weight: bold; text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.9), -1px -1px 2px rgba(0, 0, 0, 0.9), 1px -1px 2px rgba(0, 0, 0, 0.9), -1px 1px 2px rgba(0, 0, 0, 0.9);">${wordData.translation}</span>`);
        hasTranslations = true;
      } else {
        translated.push(part);
      }
    });

    return hasTranslations ? translated.join('') : text;
  }

  // Set up MutationObserver for subtitle display
  function setupSubtitleObserver(container) {
    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.matches && node.matches('.ytp-caption-segment')) {
              processSubtitleElement(node);
            } else if (node.querySelector) {
              const segments = node.querySelectorAll('.ytp-caption-segment');
              segments.forEach(segment => processSubtitleElement(segment));
            }
          }
        });
      });
    });

    observer.observe(container, {
      childList: true,
      subtree: true
    });

    isActive = true;
    console.log('YouTube subtitle observer active');
  }

  // Process a subtitle element (instant if pre-translated)
  function processSubtitleElement(element) {
    // Skip if already processed
    if (element.hasAttribute('data-yt-translated')) {
      return;
    }

    const originalText = element.textContent.trim();

    if (!originalText) {
      return;
    }

    // Check if we have pre-translated version
    let translatedHTML;

    if (isPreTranslated && subtitleCache.has(originalText)) {
      // Use pre-translated version (instant!)
      translatedHTML = subtitleCache.get(originalText);
    } else {
      // Fall back to real-time translation
      translatedHTML = translateText(originalText);
    }

    // Apply translation if it changed
    if (translatedHTML !== originalText) {
      element.innerHTML = translatedHTML;
      element.setAttribute('data-yt-translated', 'true');
    }

    // TTS Integration: Extract translated text and pass to TTS controller after debounce
    notifyTTSOfSubtitle();
  }

  // Notify TTS controller of new subtitle (with debounce to wait for translation)
  function notifyTTSOfSubtitle() {
    // Clear any existing debounce timer
    if (ttsDebounceTimeout) {
      clearTimeout(ttsDebounceTimeout);
    }

    // Debounce: wait 300ms for all translations to complete
    ttsDebounceTimeout = setTimeout(() => {
      // Extract fully translated text from subtitle elements
      const translatedText = extractTranslatedSubtitleText();

      if (translatedText && window.linguaLensTTS) {
        window.linguaLensTTS.speakSubtitle(translatedText);
      }
    }, TTS_DEBOUNCE_DELAY);
  }

  // Extract translated subtitle text from DOM
  function extractTranslatedSubtitleText() {
    const allSegments = document.querySelectorAll('.ytp-caption-segment');

    if (allSegments.length > 0) {
      // Combine all lines with a space, extracting text content (including HTML translations)
      const text = Array.from(allSegments)
        .map(el => {
          // Extract text from translated spans if present, otherwise use textContent
          const translatedSpans = el.querySelectorAll('.lang-learner-yt-translated');
          if (translatedSpans.length > 0) {
            // Has translations - extract both translated and original text
            let result = '';
            el.childNodes.forEach(node => {
              if (node.nodeType === Node.TEXT_NODE) {
                result += node.textContent;
              } else if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('lang-learner-yt-translated')) {
                result += node.textContent; // Use Chinese translation
              }
            });
            return result.trim();
          } else {
            // No translations - use original text
            return el.textContent.trim();
          }
        })
        .filter(t => t)
        .join(' ')
        .trim();

      return text;
    }

    return null;
  }

  // Show loading indicator during pre-translation
  function showLoadingIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'lang-learner-yt-loading';
    indicator.innerHTML = '⏳ Pre-translating subtitles...';
    indicator.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: rgba(0, 0, 0, 0.9);
      color: #FFD700;
      padding: 10px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      pointer-events: none;
    `;

    document.body.appendChild(indicator);
  }

  // Hide loading indicator
  function hideLoadingIndicator() {
    const indicator = document.getElementById('lang-learner-yt-loading');
    if (indicator) {
      indicator.remove();
    }
  }

  // Show activation indicator
  function showActivationIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'lang-learner-yt-indicator';
    indicator.innerHTML = isPreTranslated ?
      '🌐 YouTube Subtitles Pre-Translated ✓' :
      '🌐 Translating YouTube Subtitles';
    indicator.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: rgba(0, 0, 0, 0.9);
      color: ${isPreTranslated ? '#00FF00' : '#FFD700'};
      padding: 10px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      pointer-events: none;
      animation: slideIn 0.3s ease-out;
    `;

    // Add animation keyframes
    if (!document.getElementById('lang-learner-yt-style')) {
      const style = document.createElement('style');
      style.id = 'lang-learner-yt-style';
      style.textContent = `
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(indicator);

    // Fade out after 3 seconds
    setTimeout(() => {
      indicator.style.transition = 'opacity 1s';
      indicator.style.opacity = '0';
      setTimeout(() => {
        if (indicator.parentNode) {
          indicator.remove();
        }
      }, 1000);
    }, 3000);
  }

  // Handle YouTube's SPA navigation
  function handleYouTubeNavigation() {
    let lastUrl = location.href;

    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        console.log('YouTube navigation detected');

        // Disconnect existing observer
        if (observer) {
          observer.disconnect();
          observer = null;
          isActive = false;
        }

        // Clear cache for new video
        const newVideoId = getVideoId();
        if (newVideoId !== currentVideoId) {
          currentVideoId = newVideoId;
          subtitleCache.clear();
          isPreTranslated = false;
        }

        // Reinitialize if still on watch page
        if (isYouTubeWatchPage()) {
          console.log('Reinitializing for new video');
          setTimeout(() => {
            initialize();
          }, 1000);
        }
      }
    }).observe(document, { subtree: true, childList: true });
  }

  // Listen for storage changes
  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === 'local') {
      if (changes.knownWords || changes.settings) {
        console.log('Storage changed, reloading data');
        await loadData();

        // Clear cache when words change
        if (changes.knownWords) {
          subtitleCache.clear();
          isPreTranslated = false;
        }

        // Handle settings toggle
        if (changes.settings) {
          const newSettings = changes.settings.newValue;
          const oldSettings = changes.settings.oldValue || {};

          if (newSettings.youtubeSubtitles && !oldSettings.youtubeSubtitles) {
            if (!isActive && isYouTubeWatchPage()) {
              console.log('YouTube subtitle translation enabled');
              initialize();
            }
          }

          if (!newSettings.youtubeSubtitles && oldSettings.youtubeSubtitles) {
            if (observer) {
              console.log('YouTube subtitle translation disabled');
              observer.disconnect();
              observer = null;
              isActive = false;
            }
          }
        }
      }
    }
  });

  // Initialize when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initialize();
      handleYouTubeNavigation();
    });
  } else {
    initialize();
    handleYouTubeNavigation();
  }

  console.log('YouTube Subtitle Translator (Pre-Translation) script loaded');

})();
