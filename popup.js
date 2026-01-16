// Popup UI logic for Language Learning Extension

document.addEventListener('DOMContentLoaded', async () => {
  // Load settings and words
  await loadSettings();
  await loadWords();
  await updateStats();

  // Set up event listeners
  setupEventListeners();
});

// Load settings from storage
async function loadSettings() {
  const settings = await StorageManager.getSettings();

  document.getElementById('targetLanguage').value = settings.targetLanguage || 'zh-CN';
  document.getElementById('sourceLanguage').value = settings.sourceLanguage || 'en';
  document.getElementById('apiKey').value = settings.apiKey || '';
  document.getElementById('autoTranslate').checked = settings.autoTranslate !== false;
  document.getElementById('showTooltips').checked = settings.showTooltips !== false;
  document.getElementById('youtubeSubtitles').checked = settings.youtubeSubtitles !== false;

  // Load excluded URLs
  const excludedUrls = settings.excludedUrls || [];
  document.getElementById('excludedUrls').value = excludedUrls.join('\n');

  // Update language hint
  updateLanguageHint(settings.sourceLanguage, settings.targetLanguage);
}

// Load and display known words
async function loadWords() {
  const knownWords = await StorageManager.getKnownWords();
  displayWords(knownWords);
}

// Update language hint display
function updateLanguageHint(sourceLang, targetLang) {
  const languageNames = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'ja': 'Japanese',
    'ko': 'Korean',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'zh-CN': 'Chinese (Simplified)',
    'zh-TW': 'Chinese (Traditional)',
    'ar': 'Arabic',
    'hi': 'Hindi'
  };

  document.getElementById('sourceLangName').textContent = languageNames[sourceLang] || sourceLang;
  document.getElementById('targetLangName').textContent = languageNames[targetLang] || targetLang;
}

// Display words in the list
function displayWords(knownWords, filterText = '') {
  const wordsList = document.getElementById('wordsList');
  wordsList.innerHTML = '';

  const words = Object.values(knownWords);

  if (words.length === 0) {
    wordsList.innerHTML = '<p class="empty-state">No words saved yet. Select and translate words on any webpage to get started!</p>';
    return;
  }

  // Filter words if search text provided
  const filteredWords = filterText
    ? words.filter(w =>
        w.original.toLowerCase().includes(filterText.toLowerCase()) ||
        (w.translation && w.translation.toLowerCase().includes(filterText.toLowerCase()))
      )
    : words;

  // Sort by most recently seen
  filteredWords.sort((a, b) => b.lastSeen - a.lastSeen);

  // Display words
  filteredWords.forEach(wordData => {
    const wordItem = document.createElement('div');
    wordItem.className = 'word-item';

    const wordInfo = document.createElement('div');
    wordInfo.className = 'word-info';

    const original = document.createElement('div');
    original.className = 'word-original';
    original.textContent = wordData.original;

    const translation = document.createElement('div');
    translation.className = 'word-translation';
    translation.textContent = wordData.translation;

    const meta = document.createElement('div');
    meta.className = 'word-meta';
    meta.textContent = `Seen ${wordData.timesEncountered} time${wordData.timesEncountered !== 1 ? 's' : ''}`;

    wordInfo.appendChild(original);
    wordInfo.appendChild(translation);
    wordInfo.appendChild(meta);

    const editBtn = document.createElement('button');
    editBtn.className = 'word-edit';
    editBtn.innerHTML = '✎';
    editBtn.title = 'Edit translation';
    editBtn.addEventListener('click', () => {
      editWord(wordItem, wordData);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'word-delete';
    deleteBtn.innerHTML = '×';
    deleteBtn.title = 'Remove word';
    deleteBtn.addEventListener('click', async () => {
      await StorageManager.removeWord(wordData.original);
      await loadWords();
      await updateStats();
      showStatus('Word removed', 'success');
      notifyContentScripts();
    });

    wordItem.appendChild(wordInfo);
    wordItem.appendChild(editBtn);
    wordItem.appendChild(deleteBtn);
    wordsList.appendChild(wordItem);
  });

  if (filteredWords.length === 0 && filterText) {
    wordsList.innerHTML = '<p class="empty-state">No words match your search.</p>';
  }
}

// Edit a word's translation
function editWord(wordItem, wordData) {
  // Prevent multiple edits
  if (wordItem.classList.contains('editing')) {
    return;
  }

  wordItem.classList.add('editing');

  // Create edit form
  const editForm = document.createElement('div');
  editForm.className = 'edit-inputs';

  const translationInput = document.createElement('input');
  translationInput.type = 'text';
  translationInput.value = wordData.translation;
  translationInput.placeholder = 'New translation';

  const editActions = document.createElement('div');
  editActions.className = 'edit-actions';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-primary';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', async () => {
    const newTranslation = translationInput.value.trim();
    if (!newTranslation) {
      showStatus('Translation cannot be empty', 'error');
      return;
    }

    await StorageManager.updateWord(wordData.original, newTranslation);
    await loadWords();
    showStatus('Translation updated', 'success');
    notifyContentScripts();
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-secondary';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', async () => {
    await loadWords();
  });

  editActions.appendChild(saveBtn);
  editActions.appendChild(cancelBtn);
  editForm.appendChild(translationInput);
  editForm.appendChild(editActions);

  wordItem.appendChild(editForm);

  // Focus the input
  translationInput.focus();
  translationInput.select();
}

// Update statistics
async function updateStats() {
  const stats = await StorageManager.getStats();

  document.getElementById('wordCount').textContent = stats.totalWords;
}

// Set up event listeners
function setupEventListeners() {
  // Save settings button
  document.getElementById('saveSettings').addEventListener('click', async () => {
    // Parse excluded URLs
    const excludedUrlsText = document.getElementById('excludedUrls').value.trim();
    const excludedUrls = excludedUrlsText
      ? excludedUrlsText.split('\n').map(url => url.trim()).filter(url => url.length > 0)
      : [];

    const settings = {
      targetLanguage: document.getElementById('targetLanguage').value,
      sourceLanguage: document.getElementById('sourceLanguage').value,
      apiKey: document.getElementById('apiKey').value.trim(),
      autoTranslate: document.getElementById('autoTranslate').checked,
      showTooltips: document.getElementById('showTooltips').checked,
      youtubeSubtitles: document.getElementById('youtubeSubtitles').checked,
      excludedUrls: excludedUrls
    };

    await StorageManager.updateSettings(settings);
    showStatus('Settings saved successfully!', 'success');

    // Update language hint
    updateLanguageHint(settings.sourceLanguage, settings.targetLanguage);

    // Notify content scripts to refresh
    notifyContentScripts();
  });

  // Translate & Add button
  document.getElementById('translateAndAdd').addEventListener('click', async () => {
    const word = document.getElementById('quickWord').value.trim();

    if (!word) {
      showStatus('Please enter a word', 'error');
      return;
    }

    const settings = await StorageManager.getSettings();
    if (!settings.apiKey) {
      showStatus('Please add Google Translate API key in settings first', 'error');
      return;
    }

    try {
      // Show loading state
      const btn = document.getElementById('translateAndAdd');
      const originalText = btn.textContent;
      btn.textContent = 'Translating...';
      btn.disabled = true;

      // Call translation API via background script
      const response = await chrome.runtime.sendMessage({
        action: 'translate',
        text: word,
        sourceLang: settings.sourceLanguage,
        targetLang: settings.targetLanguage
      });

      if (response.error) {
        throw new Error(response.error);
      }

      const translation = response.result.translatedText;

      // Generate Pinyin if target language is Chinese
      let pinyin = null;
      if (PinyinHelper && PinyinHelper.shouldGeneratePinyin(settings.targetLanguage)) {
        pinyin = PinyinHelper.generatePinyin(translation);
      }

      // Fill translation field
      document.getElementById('quickTranslation').value = translation;

      // Add to storage with Pinyin
      await StorageManager.addWord(word, translation, null, pinyin);

      // Clear inputs
      document.getElementById('quickWord').value = '';
      document.getElementById('quickTranslation').value = '';

      // Refresh display
      await loadWords();
      await updateStats();

      showStatus(`Added: ${word} → ${response.result.translatedText}`, 'success');
      notifyContentScripts();

      // Restore button
      btn.textContent = originalText;
      btn.disabled = false;
    } catch (error) {
      showStatus(`Translation failed: ${error.message}`, 'error');
      const btn = document.getElementById('translateAndAdd');
      btn.textContent = 'Translate & Add';
      btn.disabled = false;
    }
  });

  // Add Manually button
  document.getElementById('addManually').addEventListener('click', async () => {
    const word = document.getElementById('quickWord').value.trim();
    const translation = document.getElementById('quickTranslation').value.trim();

    if (!word) {
      showStatus('Please enter a word', 'error');
      return;
    }

    if (!translation) {
      showStatus('Please enter a translation', 'error');
      return;
    }

    // Add to storage
    await StorageManager.addWord(word, translation);

    // Clear inputs
    document.getElementById('quickWord').value = '';
    document.getElementById('quickTranslation').value = '';

    // Refresh display
    await loadWords();
    await updateStats();

    showStatus(`Added: ${word} → ${translation}`, 'success');
    notifyContentScripts();
  });

  // Search words
  document.getElementById('searchWords').addEventListener('input', async (e) => {
    const filterText = e.target.value;
    const knownWords = await StorageManager.getKnownWords();
    displayWords(knownWords, filterText);
  });

  // Export words
  document.getElementById('exportWords').addEventListener('click', async () => {
    try {
      const jsonData = await StorageManager.exportWords();

      // Create blob and download
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `language-learner-words-${Date.now()}.json`;
      a.click();

      URL.revokeObjectURL(url);

      showStatus('Words exported successfully!', 'success');
    } catch (error) {
      showStatus(`Export failed: ${error.message}`, 'error');
    }
  });

  // Import words
  document.getElementById('importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const count = await StorageManager.importWords(text);

      await loadWords();
      await updateStats();

      showStatus(`Successfully imported ${count} words!`, 'success');

      // Clear file input
      e.target.value = '';

      // Notify content scripts
      notifyContentScripts();
    } catch (error) {
      showStatus(`Import failed: ${error.message}`, 'error');
    }
  });

  // Clear all words
  document.getElementById('clearWords').addEventListener('click', async () => {
    if (confirm('Are you sure you want to delete all saved words? This cannot be undone.')) {
      await StorageManager.clearAllWords();
      await loadWords();
      await updateStats();
      showStatus('All words cleared', 'success');
      notifyContentScripts();
    }
  });

  // Listen for storage changes
  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === 'local' && changes.knownWords) {
      await loadWords();
      await updateStats();
    }
  });

}

// Show status message
function showStatus(message, type = 'info') {
  const statusElement = document.getElementById('status');
  statusElement.textContent = message;
  statusElement.className = `status ${type}`;
  statusElement.style.display = 'block';

  setTimeout(() => {
    statusElement.style.display = 'none';
  }, 3000);
}

// Notify all content scripts to refresh
function notifyContentScripts() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, {
        action: 'refreshTranslations'
      }).catch(() => {
        // Ignore errors for tabs without content script
      });
    });
  });
}

// ============================================
// Chinese Known Words Management
// ============================================

let chineseKnownWords = [];

// Load Chinese known words
async function loadChineseWords() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['chineseKnownWords', 'chineseHighlightStyle'], (result) => {
      chineseKnownWords = result.chineseKnownWords || [];
      const highlightStyle = result.chineseHighlightStyle || 'underline';

      document.getElementById('chineseWordCount').textContent = chineseKnownWords.length;
      document.getElementById('highlightStyle').value = highlightStyle;

      resolve();
    });
  });
}

// Add Chinese word
async function addChineseWord() {
  const input = document.getElementById('chineseWord');
  const word = input.value.trim();

  if (!word) {
    showStatus('Please enter a Chinese word', 'error');
    return;
  }

  if (!/[\u4e00-\u9fff]/.test(word)) {
    showStatus('Please enter Chinese characters', 'error');
    return;
  }

  if (chineseKnownWords.includes(word)) {
    showStatus('This word is already in your list', 'error');
    return;
  }

  chineseKnownWords.push(word);
  await chrome.storage.sync.set({ chineseKnownWords });

  input.value = '';
  await loadChineseWords();

  // Refresh content scripts
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, { action: 'refreshChineseHighlights' }).catch(() => {});
    });
  });

  showStatus(`"${word}" added successfully!`, 'success');
}

// Update highlight style
function updateHighlightStyle() {
  const style = document.getElementById('highlightStyle').value;
  chrome.storage.sync.set({ chineseHighlightStyle: style }, () => {
    // Refresh content scripts
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, { action: 'refreshChineseHighlights' }).catch(() => {});
      });
    });
  });
}

// Sync all known word translations to Chinese known words
async function syncKnownWordsToChinese() {
  const btn = document.getElementById('syncKnownWords');
  const originalText = btn.textContent;
  btn.textContent = 'Syncing...';
  btn.disabled = true;

  try {
    // Get all known words
    const knownWords = await StorageManager.getWords();

    // Get current Chinese known words
    const result = await chrome.storage.sync.get(['chineseKnownWords']);
    let chineseKnownWords = result.chineseKnownWords || [];

    let addedCount = 0;

    // Add all Chinese translations
    for (const [key, wordData] of Object.entries(knownWords)) {
      const translation = wordData.translation;
      // Check if translation contains Chinese characters
      if (translation && /[\u4e00-\u9fff]/.test(translation)) {
        if (!chineseKnownWords.includes(translation)) {
          chineseKnownWords.push(translation);
          addedCount++;
        }
      }
    }

    // Save updated list
    await chrome.storage.sync.set({ chineseKnownWords });

    // Reload Chinese words display
    await loadChineseWords();

    // Refresh content scripts
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, { action: 'refreshChineseHighlights' }).catch(() => {});
      });
    });

    showStatus(`Added ${addedCount} Chinese words to highlight list!`, 'success');
  } catch (error) {
    console.error('Sync error:', error);
    showStatus('Failed to sync words', 'error');
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

// ============================================
// Synology Server Sync
// ============================================

const WEBSITE_URL = 'http://192.168.1.222:3000';

// Format timestamp to readable time
function formatTime(timestamp) {
  if (!timestamp) return 'Never';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

// Load and display sync status
async function loadSyncStatus() {
  const result = await chrome.storage.local.get(['syncAuthToken', 'syncUsername', 'lastSync', 'lastSyncCount', 'lastSyncStatus', 'autoSyncEnabled']);

  const syncStatusEl = document.getElementById('syncStatus');
  const syncUsernameEl = document.getElementById('syncUsername');
  const syncUserInfo = document.getElementById('syncUserInfo');
  const lastSyncTimeEl = document.getElementById('lastSyncTime');
  const lastSyncCountEl = document.getElementById('lastSyncCount');
  const autoSyncCheckbox = document.getElementById('autoSync');

  const loginForm = document.getElementById('loginForm');
  const loggedInControls = document.getElementById('loggedInControls');

  const isLoggedIn = !!result.syncAuthToken;

  if (isLoggedIn) {
    // Show logged in state
    loginForm.style.display = 'none';
    loggedInControls.style.display = 'block';
    syncUserInfo.style.display = 'block';

    syncUsernameEl.textContent = result.syncUsername || 'Unknown';

    // Update status
    if (result.lastSyncStatus === 'success') {
      syncStatusEl.textContent = 'Synced';
      syncStatusEl.className = 'status-success';
    } else if (result.lastSyncStatus === 'error') {
      syncStatusEl.textContent = 'Error';
      syncStatusEl.className = 'status-error';
    } else {
      syncStatusEl.textContent = 'Ready to sync';
      syncStatusEl.className = 'status-never';
    }
  } else {
    // Show login form
    loginForm.style.display = 'block';
    loggedInControls.style.display = 'none';
    syncUserInfo.style.display = 'none';

    syncStatusEl.textContent = 'Not logged in';
    syncStatusEl.className = 'status-never';
  }

  // Update last sync info
  lastSyncTimeEl.textContent = formatTime(result.lastSync);
  lastSyncCountEl.textContent = result.lastSyncCount || 0;

  if (autoSyncCheckbox) {
    autoSyncCheckbox.checked = result.autoSyncEnabled !== false; // Default to true
  }
}

// Login to server
async function loginToServer() {
  const username = document.getElementById('syncUsernameInput').value.trim();
  const password = document.getElementById('syncPassword').value;

  if (!username || !password) {
    showStatus('Please enter username and password', 'error');
    return;
  }

  const btn = document.getElementById('loginBtn');
  const originalText = btn.textContent;
  btn.textContent = 'Logging in...';
  btn.disabled = true;

  try {
    const response = await fetch(`${WEBSITE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Login failed');
    }

    // Save auth token and username
    await chrome.storage.local.set({
      syncAuthToken: data.token,
      syncUsername: data.username,
      autoSyncEnabled: true
    });

    // Clear password field
    document.getElementById('syncPassword').value = '';
    document.getElementById('syncUsernameInput').value = '';

    showStatus('Logged in successfully!', 'success');
    await loadSyncStatus();

    // Trigger initial sync
    chrome.runtime.sendMessage({ action: 'syncNow' });

  } catch (error) {
    console.error('Login error:', error);
    showStatus(`Login failed: ${error.message}`, 'error');
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

// Logout
async function logout() {
  await chrome.storage.local.remove(['syncAuthToken', 'syncUsername']);
  showStatus('Logged out successfully', 'success');
  await loadSyncStatus();
}

// Manual sync
async function syncNow() {
  const btn = document.getElementById('syncNow');
  btn.disabled = true;
  btn.textContent = 'Syncing...';

  chrome.runtime.sendMessage({ action: 'syncNow' }, async (response) => {
    btn.disabled = false;
    btn.textContent = 'Sync Now';

    if (response && response.success) {
      showStatus(`Successfully synced ${response.count} Chinese words!`, 'success');
      await loadChineseWords();
      await loadSyncStatus();
    } else {
      showStatus(`Sync failed: ${response ? response.error : 'Unknown error'}`, 'error');
      await loadSyncStatus();
    }
  });
}

// Toggle auto-sync
function toggleAutoSync() {
  const enabled = document.getElementById('autoSync').checked;
  chrome.storage.local.set({ autoSyncEnabled: enabled }, () => {
    chrome.runtime.sendMessage({ action: 'toggleAutoSync', enabled });
    loadSyncStatus();
  });
}

// Open website
function visitWebsite() {
  chrome.tabs.create({ url: WEBSITE_URL });
}

// Event listeners for Chinese words
document.getElementById('addChineseWord').addEventListener('click', addChineseWord);
document.getElementById('chineseWord').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    addChineseWord();
  }
});
document.getElementById('syncKnownWords').addEventListener('click', syncKnownWordsToChinese);
document.getElementById('highlightStyle').addEventListener('change', updateHighlightStyle);

// Event listeners for sync
document.getElementById('loginBtn').addEventListener('click', loginToServer);
document.getElementById('logoutBtn').addEventListener('click', logout);
document.getElementById('syncNow').addEventListener('click', syncNow);
document.getElementById('autoSync').addEventListener('change', toggleAutoSync);

// Allow Enter key to submit login
document.getElementById('syncPassword').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    loginToServer();
  }
});
document.getElementById('syncUsernameInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    loginToServer();
  }
});

// Load Chinese words and sync status on popup open
loadChineseWords();
loadSyncStatus();

// Auto-refresh sync status every 5 seconds
setInterval(loadSyncStatus, 5000);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + S to save settings
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    document.getElementById('saveSettings').click();
  }

  // Ctrl/Cmd + F to focus search
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    document.getElementById('searchWords').focus();
  }
});
