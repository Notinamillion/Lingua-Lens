// Background Service Worker for Language Learning Extension
// Handles context menus, API calls, and inter-script communication

importScripts('translator.js', 'jieba-full.js', 'claude-api.js', 'openai-api.js', 'gemini-api.js');

// Version and debug info
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║  LINGUA-LENS BACKGROUND SERVICE WORKER LOADED            ║');
console.log('╠══════════════════════════════════════════════════════════╣');
console.log('║  Version: 1.2.0 - Gemini 2.5 Models                      ║');
console.log('║  Gemini 1.5 deprecated - migrated to 2.5 series          ║');
console.log('╠══════════════════════════════════════════════════════════╣');
console.log('║  Gemini API Base URL:', GeminiAPI.API_BASE_URL.padEnd(28), '║');
console.log('║  Gemini Models:', JSON.stringify(GeminiAPI.MODELS).substring(0,36), '║');
console.log('╚══════════════════════════════════════════════════════════╝');

// Load translation cache when service worker starts
TranslatorAPI.loadCacheFromStorage().then(() => {
  console.log('Translation cache loaded');
}).catch(error => {
  console.error('Failed to load translation cache:', error);
});

// Migrate old Gemini model names to new 2.5 models (1.5 series deprecated)
async function migrateSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['settings'], (data) => {
      if (!data.settings) {
        resolve(false);
        return;
      }

      const settings = data.settings;
      let needsUpdate = false;

      // Migrate all old Gemini 1.5 model names to new 2.5 series
      const oldToNewModels = {
        'gemini-1.5-flash-8b-latest': 'gemini-2.5-flash-lite',
        'gemini-1.5-flash-latest': 'gemini-2.5-flash',
        'gemini-1.5-flash': 'gemini-2.5-flash',
        'gemini-1.5-pro-latest': 'gemini-2.5-pro',
        'gemini-1.5-pro': 'gemini-2.5-pro'
      };

      if (settings.geminiModel && oldToNewModels[settings.geminiModel]) {
        const oldModel = settings.geminiModel;
        settings.geminiModel = oldToNewModels[oldModel];
        needsUpdate = true;
        console.log(`[MIGRATION] Updated ${oldModel} → ${settings.geminiModel}`);
      }

      if (needsUpdate) {
        chrome.storage.local.set({ settings }, () => {
          console.log('[MIGRATION] Settings migrated to Gemini 2.5 models');
          resolve(true);
        });
      } else {
        console.log('[MIGRATION] No migration needed - settings are up to date');
        resolve(false);
      }
    });
  });
}

// Run migration on service worker startup
migrateSettings().then((migrated) => {
  if (migrated) {
    console.log('[MIGRATION] Settings migration completed');
  }
}).catch(error => {
  console.error('[MIGRATION] Failed to migrate settings:', error);
});

// Create context menus on startup (in case service worker was restarted)
function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'translate-and-save',
      title: 'Translate & Save Word',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'translate-only',
      title: 'Translate (Don\'t Save)',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'mark-chinese-known',
      title: 'Mark Chinese Word as Known',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'read-aloud',
      title: 'Read Selected Text Aloud',
      contexts: ['selection']
    });
  });
}

// Initialize context menus immediately
createContextMenus();

// Initialize extension on install
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Language Learning Extension installed:', details.reason);

  // Load translation cache
  await TranslatorAPI.loadCacheFromStorage();

  // Initialize storage
  const result = await chrome.storage.local.get(['knownWords', 'settings']);

  if (!result.knownWords) {
    await chrome.storage.local.set({ knownWords: {} });
  }

  if (!result.settings) {
    await chrome.storage.local.set({
      settings: {
        targetLanguage: 'zh-CN',
        sourceLanguage: 'en',
        apiKey: '',
        mode: 'learn',
        autoTranslate: true,
        showTooltips: true
      }
    });
  }

  // Create context menus
  createContextMenus();
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const selectedText = info.selectionText?.trim();

  if (!selectedText) return;

  const settings = await getSettings();

  if (info.menuItemId === 'translate-and-save') {
    await translateAndSave(selectedText, settings, tab.id);
  } else if (info.menuItemId === 'translate-only') {
    await translateOnly(selectedText, settings, tab.id);
  } else if (info.menuItemId === 'mark-chinese-known') {
    await markChineseWordAsKnown(selectedText, tab.id);
  } else if (info.menuItemId === 'read-aloud') {
    // Send message to content script to read the text aloud
    chrome.tabs.sendMessage(tab.id, {
      action: 'readAloud',
      text: selectedText
    });
  }
});

// Translate selected text and save to known words
async function translateAndSave(text, settings, tabId) {
  try {
    if (!settings.apiKey) {
      chrome.tabs.sendMessage(tabId, {
        action: 'showNotification',
        message: 'Please set your Google Translate API key in extension settings',
        type: 'error'
      });
      return;
    }

    // Show loading notification
    chrome.tabs.sendMessage(tabId, {
      action: 'showNotification',
      message: `Translating "${text}"...`,
      type: 'info'
    });

    // Translate the text
    const result = await TranslatorAPI.translate(
      text,
      settings.targetLanguage,
      settings.sourceLanguage,
      settings.apiKey
    );

    // Pinyin generation is handled by content scripts
    // No pinyin in background worker since libraries aren't compatible with service workers
    let pinyin = null;

    // Save to storage
    const knownWords = await getKnownWords();
    const wordKey = text.toLowerCase();

    if (knownWords[wordKey]) {
      knownWords[wordKey].translation = result.translatedText;
      if (pinyin) {
        knownWords[wordKey].pinyin = pinyin;
      }
      knownWords[wordKey].timesEncountered++;
      knownWords[wordKey].lastSeen = Date.now();
    } else {
      knownWords[wordKey] = {
        original: text,
        translation: result.translatedText,
        pinyin: pinyin,
        dateAdded: Date.now(),
        lastSeen: Date.now(),
        timesEncountered: 1,
        sourceLanguage: result.sourceLanguage
      };
    }

    await chrome.storage.local.set({ knownWords });

    // Show success notification
    chrome.tabs.sendMessage(tabId, {
      action: 'showNotification',
      message: `✓ "${text}" → "${result.translatedText}" saved!`,
      type: 'success'
    });

    // Trigger page refresh to apply translation
    chrome.tabs.sendMessage(tabId, {
      action: 'refreshTranslations'
    });

  } catch (error) {
    console.error('Translation error:', error);
    chrome.tabs.sendMessage(tabId, {
      action: 'showNotification',
      message: `Translation failed: ${error.message}`,
      type: 'error'
    });
  }
}

// Translate without saving
async function translateOnly(text, settings, tabId) {
  try {
    if (!settings.apiKey) {
      chrome.tabs.sendMessage(tabId, {
        action: 'showNotification',
        message: 'Please set your Google Translate API key in extension settings',
        type: 'error'
      });
      return;
    }

    const result = await TranslatorAPI.translate(
      text,
      settings.targetLanguage,
      settings.sourceLanguage,
      settings.apiKey
    );

    chrome.tabs.sendMessage(tabId, {
      action: 'showNotification',
      message: `"${text}" → "${result.translatedText}"`,
      type: 'info',
      duration: 5000
    });

  } catch (error) {
    console.error('Translation error:', error);
    chrome.tabs.sendMessage(tabId, {
      action: 'showNotification',
      message: `Translation failed: ${error.message}`,
      type: 'error'
    });
  }
}


// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    handleTranslateRequest(request, sendResponse);
    return true; // Async response
  } else if (request.action === 'translateBatch') {
    handleTranslateBatchRequest(request, sendResponse);
    return true;
  } else if (request.action === 'getSettings') {
    getSettings().then(sendResponse);
    return true;
  } else if (request.action === 'getKnownWords') {
    getKnownWords().then(sendResponse);
    return true;
  } else if (request.action === 'syncNow') {
    syncChineseKnownWords().then(sendResponse);
    return true;
  } else if (request.action === 'getSyncStatus') {
    getSyncStatus().then(sendResponse);
    return true;
  }
});

// Handle single translation request
async function handleTranslateRequest(request, sendResponse) {
  try {
    const settings = await getSettings();

    if (!settings.apiKey) {
      sendResponse({ error: 'API key not configured' });
      return;
    }

    const result = await TranslatorAPI.translate(
      request.text,
      request.targetLang || settings.targetLanguage,
      request.sourceLang || settings.sourceLanguage,
      settings.apiKey
    );

    sendResponse({ success: true, result });
  } catch (error) {
    sendResponse({ error: error.message });
  }
}

// Handle batch translation request
async function handleTranslateBatchRequest(request, sendResponse) {
  try {
    const settings = await getSettings();

    if (!settings.apiKey) {
      sendResponse({ error: 'API key not configured' });
      return;
    }

    const results = await TranslatorAPI.translateBatch(
      request.texts,
      request.targetLang || settings.targetLanguage,
      request.sourceLang || settings.sourceLanguage,
      settings.apiKey
    );

    sendResponse({ success: true, results });
  } catch (error) {
    sendResponse({ error: error.message });
  }
}

// Helper functions
async function getSettings() {
  const result = await chrome.storage.local.get(['settings']);
  return result.settings || {};
}

async function getKnownWords() {
  const result = await chrome.storage.local.get(['knownWords']);
  return result.knownWords || {};
}

// Listen for storage changes and notify content scripts
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    // Notify all tabs about storage changes
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'storageChanged',
          changes: changes
        }).catch(() => {
          // Ignore errors for tabs without content script
        });
      });
    });
  }
});

// ============================================
// Chinese Known Words Functionality
// ============================================

const WEBSITE_URL = 'http://192.168.1.222:3000';

// Mark a Chinese word as known
async function markChineseWordAsKnown(word, tabId) {
  const trimmedWord = word.trim();

  // Check if it contains Chinese characters
  if (!/[\u4e00-\u9fff]/.test(trimmedWord)) {
    chrome.tabs.sendMessage(tabId, {
      action: 'showNotification',
      message: 'Please select Chinese characters',
      type: 'error'
    });
    return;
  }

  // Get current known words
  const result = await chrome.storage.sync.get(['chineseKnownWords']);
  let chineseKnownWords = result.chineseKnownWords || [];

  if (!chineseKnownWords.includes(trimmedWord)) {
    chineseKnownWords.push(trimmedWord);
    await chrome.storage.sync.set({ chineseKnownWords: chineseKnownWords });

    // Notify content script to refresh
    chrome.tabs.sendMessage(tabId, { action: 'refreshChineseHighlights' });

    // Show notification
    chrome.notifications.create({
      type: 'basic',
      title: 'Chinese Word Added',
      message: `"${trimmedWord}" has been marked as known`,
      iconUrl: 'icons/icon48.png'
    });
  } else {
    chrome.tabs.sendMessage(tabId, {
      action: 'showNotification',
      message: `"${trimmedWord}" is already marked as known`,
      type: 'info'
    });
  }
}

// Sync Chinese known words from Synology server
async function syncChineseKnownWords() {
  try {
    // Get auth token from local storage
    const result = await chrome.storage.local.get(['syncAuthToken', 'autoSyncEnabled']);

    if (!result.syncAuthToken) {
      console.log('[Sync] Not logged in');
      return { success: false, error: 'Not logged in' };
    }

    if (result.autoSyncEnabled === false) {
      console.log('[Sync] Auto-sync is disabled');
      return { success: false, error: 'Auto-sync disabled' };
    }

    // Fetch progress data from API using Bearer token
    const response = await fetch(`${WEBSITE_URL}/api/progress`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${result.syncAuthToken}`
      }
    });

    // Handle 401 Unauthorized (token expired or invalid)
    if (response.status === 401) {
      console.error('[Sync] Token expired or invalid');
      // Clear auth token
      await chrome.storage.local.remove(['syncAuthToken', 'syncUsername']);
      return { success: false, error: 'Authentication failed - please log in again', expired: true };
    }

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const progressData = await response.json();

    // Extract known words from compoundProgress
    const knownWords = [];
    if (progressData.compoundProgress) {
      Object.values(progressData.compoundProgress).forEach(charData => {
        if (charData.known && Array.isArray(charData.known)) {
          knownWords.push(...charData.known);
        }
      });
    }

    // Remove duplicates
    const uniqueKnownWords = [...new Set(knownWords)];

    // Update Chinese known words in storage
    await chrome.storage.sync.set({ chineseKnownWords: uniqueKnownWords });

    // Update sync status
    const syncStatus = {
      lastSync: Date.now(),
      lastSyncCount: uniqueKnownWords.length,
      lastSyncStatus: 'success'
    };
    await chrome.storage.local.set(syncStatus);

    // Refresh all tabs
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { action: 'refreshChineseHighlights' }).catch(() => {});
    });

    console.log(`[Sync] Successfully synced ${uniqueKnownWords.length} Chinese words`);

    return {
      success: true,
      count: uniqueKnownWords.length,
      message: `Synced ${uniqueKnownWords.length} Chinese words from server`
    };

  } catch (error) {
    console.error('[Sync] Error:', error);

    // Update sync status with error
    await chrome.storage.local.set({
      lastSyncStatus: 'error',
      lastSyncError: error.message
    });

    return { success: false, error: error.message };
  }
}

// Get sync status
async function getSyncStatus() {
  const result = await chrome.storage.local.get([
    'lastSync',
    'lastSyncCount',
    'lastSyncStatus',
    'lastSyncError',
    'syncToken',
    'syncEnabled'
  ]);

  return {
    configured: !!result.syncToken,
    enabled: result.syncEnabled !== false,
    lastSync: result.lastSync || null,
    lastSyncCount: result.lastSyncCount || 0,
    status: result.lastSyncStatus || 'never',
    error: result.lastSyncError || null
  };
}

// Set up periodic sync alarm (30 minutes)
chrome.alarms.create('periodicChineseSync', { periodInMinutes: 30 });

// Handle periodic sync alarm
chrome.alarms.onAlarm.addListener(async function(alarm) {
  if (alarm.name === 'periodicChineseSync') {
    console.log('[Sync] Periodic sync triggered');
    const result = await syncChineseKnownWords();

    if (result.success) {
      // Silent success for periodic sync
      console.log(`[Sync] Periodic sync complete: ${result.count} Chinese words`);
    } else if (result.expired) {
      // Notify about expired token
      chrome.notifications.create({
        type: 'basic',
        title: 'Sync Token Expired',
        message: 'Please generate a new sync token from the Chinese Word Map website',
        iconUrl: 'icons/icon48.png'
      });
    }
  }
});

console.log('Language Learning Extension background script loaded');
