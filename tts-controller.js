// TTS Controller for Lingua-Lens YouTube Subtitle Reader
// Integrates text-to-speech with Lingua-Lens's translated subtitles

class LinguaLensTTSController {
    constructor() {
        this.enabled = false;
        this.lastSubtitle = '';
        this.settings = {
            language: 'english',
            speed: 1.0,
            volume: 0.8,
            enabled: false,
            chinesePauseDuration: 200  // Pause between consecutive Chinese characters (ms)
        };

        // Overlay and highlighting properties
        this.overlayElement = null;
        this.currentSegments = [];
        this.currentSubtitleText = '';
        this.currentHighlightIndex = -1;
        this.resizeObserver = null;

        // Keyboard control state
        this.isPlayingSegment = false;
        this.currentPlaybackIndex = -1;
        this.currentUtterance = null;
        this.keyboardEnabled = false;

        // Pause timeout tracking
        this.pauseTimeout = null;

        // Sequential speaking flag (prevents repetition)
        this.isSpeakingSequentially = false;

        // Load settings and initialize
        this.loadSettings();
        this.init();
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.local.get(['ttsSettings']);
            if (result.ttsSettings) {
                this.settings = { ...this.settings, ...result.ttsSettings };
            }
        } catch (error) {
            console.log('[Lingua-Lens TTS] Using default settings');
        }
    }

    init() {
        // Listen for messages from popup
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'updateTTSSettings') {
                this.settings = message.settings;
                if (this.settings.enabled) {
                    this.start();
                } else {
                    this.stop();
                }
                sendResponse({ success: true });
            } else if (message.action === 'getTTSStatus') {
                sendResponse({
                    enabled: this.enabled
                });
            }
            return true; // Keep message channel open
        });

        // Setup video play listener for auto-start
        this.setupVideoPlayListener();

        // Auto-start if enabled in settings
        if (this.settings.enabled) {
            setTimeout(() => this.start(), 2000);
        }
    }

    start() {
        this.enabled = true;
        this.keyboardEnabled = true;
        this.log('Starting TTS controller...');

        // Reset last subtitle to avoid carrying over old text
        this.lastSubtitle = '';

        // Stop any existing TTS
        speechSynthesis.cancel();

        // Create overlay
        this.createOverlay();

        // Setup keyboard controls
        this.setupKeyboardControls();

        // Hide YouTube native subtitles
        this.hideNativeSubtitles();
    }

    stop() {
        this.enabled = false;
        this.keyboardEnabled = false;
        this.log('Stopping TTS controller...');

        // Stop TTS
        speechSynthesis.cancel();

        // Cancel any segment playback
        if (this.currentUtterance) {
            this.currentUtterance = null;
        }
        this.isPlayingSegment = false;
        this.currentPlaybackIndex = -1;

        // Clear any pending pause timeout
        if (this.pauseTimeout) {
            clearTimeout(this.pauseTimeout);
            this.pauseTimeout = null;
        }

        // Reset sequential speaking flag
        this.isSpeakingSequentially = false;

        // Destroy overlay
        this.destroyOverlay();

        // Show YouTube native subtitles
        this.showNativeSubtitles();

        // Disconnect resize observer
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
    }

    hideNativeSubtitles() {
        const captionContainer = document.querySelector('.ytp-caption-window-container');
        if (captionContainer) {
            captionContainer.style.display = 'none';
            this.log('Hidden native YouTube subtitles');
        }
    }

    showNativeSubtitles() {
        const captionContainer = document.querySelector('.ytp-caption-window-container');
        if (captionContainer) {
            captionContainer.style.display = '';
            this.log('Shown native YouTube subtitles');
        }
    }

    // ========================================
    // OVERLAY MANAGEMENT METHODS
    // ========================================

    createOverlay() {
        if (this.overlayElement) return;

        const overlay = document.createElement('div');
        overlay.className = 'lingua-lens-tts-overlay';
        overlay.id = 'lingua-lens-tts-overlay';
        document.body.appendChild(overlay);

        this.overlayElement = overlay;
        this.log('Overlay created');

        // Inject CSS
        this.injectOverlayStyles();

        // Setup resize observer
        this.initResizeObserver();
    }

    destroyOverlay() {
        if (this.overlayElement) {
            this.overlayElement.remove();
            this.overlayElement = null;
            this.log('Overlay destroyed');
        }
    }

    getOrCreateOverlay() {
        if (!this.overlayElement) {
            this.createOverlay();
        }
        return this.overlayElement;
    }

    positionOverlay() {
        if (!this.overlayElement) return;

        const videoPlayer = document.querySelector('.html5-video-player');
        if (!videoPlayer) return;

        const playerRect = videoPlayer.getBoundingClientRect();

        this.overlayElement.style.position = 'fixed';
        this.overlayElement.style.left = playerRect.left + 'px';
        this.overlayElement.style.width = playerRect.width + 'px';
        this.overlayElement.style.bottom = (window.innerHeight - playerRect.bottom + 60) + 'px';
        this.overlayElement.style.zIndex = '10000';
        this.overlayElement.style.textAlign = 'center';
        this.overlayElement.style.pointerEvents = 'none';
    }

    showOverlay() {
        if (this.overlayElement) {
            this.overlayElement.style.opacity = '1';
        }
    }

    hideOverlay() {
        if (this.overlayElement) {
            this.overlayElement.style.opacity = '0';
        }
    }

    initResizeObserver() {
        // Observe video player resize
        const videoPlayer = document.querySelector('.html5-video-player');
        if (videoPlayer) {
            this.resizeObserver = new ResizeObserver(() => {
                if (this.overlayElement && this.enabled) {
                    this.positionOverlay();
                }
            });
            this.resizeObserver.observe(videoPlayer);
        }

        // Handle window resize
        window.addEventListener('resize', () => {
            if (this.enabled) {
                this.positionOverlay();
            }
        });

        // Handle fullscreen changes
        document.addEventListener('fullscreenchange', () => {
            setTimeout(() => {
                if (this.enabled) {
                    this.positionOverlay();
                }
            }, 100);
        });

        this.log('Resize observers initialized');
    }

    injectOverlayStyles() {
        // Check if styles already injected
        if (document.getElementById('lingua-lens-tts-styles')) return;

        const style = document.createElement('style');
        style.id = 'lingua-lens-tts-styles';
        style.textContent = `
            /* TTS Overlay container */
            .lingua-lens-tts-overlay {
                position: fixed;
                text-align: center;
                pointer-events: none;
                font-family: 'YouTube Noto', Roboto, Arial, sans-serif;
                transition: opacity 0.3s ease;
                opacity: 1;
            }

            /* Subtitle text wrapper */
            .lingua-lens-tts-text {
                display: inline-block;
                padding: 8px 16px;
                background: rgba(8, 8, 8, 0.75);
                border-radius: 4px;
                font-size: 20px;
                line-height: 1.4;
                color: #fff;
                text-shadow:
                    1px 1px 2px rgba(0, 0, 0, 0.9),
                    -1px -1px 2px rgba(0, 0, 0, 0.9);
            }

            /* Individual segment */
            .lingua-lens-tts-segment {
                display: inline;
                transition: background-color 0.15s ease, color 0.15s ease;
                padding: 2px 4px;
                border-radius: 3px;
                pointer-events: auto;
                cursor: pointer;
            }

            /* Hover effect */
            .lingua-lens-tts-segment:hover {
                background-color: rgba(255, 255, 255, 0.15);
            }

            /* Chinese: no extra spacing */
            .lingua-lens-tts-chinese {
                letter-spacing: 0;
            }

            /* English: normal spacing */
            .lingua-lens-tts-english {
                letter-spacing: normal;
            }

            /* Highlighted state */
            .lingua-lens-tts-segment.lingua-lens-tts-highlighted {
                background-color: #ffd700;
                color: #000;
                font-weight: 600;
                text-shadow: none;
            }
        `;

        document.head.appendChild(style);
        this.log('Overlay styles injected');
    }

    // ========================================
    // TEXT SEGMENTATION METHODS
    // ========================================

    segmentText(text) {
        const segments = [];

        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            // Skip punctuation
            if (this.isPunctuation(char)) {
                continue;
            }

            // Chinese character: single character segment
            if (this.isChineseCharacter(char)) {
                segments.push({
                    start: i,
                    end: i + 1,
                    text: char,
                    language: 'chinese'
                });
                continue;
            }

            // English word: collect until whitespace/punctuation
            if (/[a-zA-Z]/.test(char)) {
                let wordEnd = i;
                while (wordEnd < text.length && /[a-zA-Z0-9]/.test(text[wordEnd])) {
                    wordEnd++;
                }
                segments.push({
                    start: i,
                    end: wordEnd,
                    text: text.substring(i, wordEnd),
                    language: 'english'
                });
                i = wordEnd - 1; // Skip ahead
                continue;
            }

            // Skip whitespace and other characters
        }

        return segments;
    }

    isChineseCharacter(char) {
        return /[\u4e00-\u9fa5]/.test(char);
    }

    isPunctuation(char) {
        return /[.,!?;:，。！？；：、]/.test(char);
    }

    // ========================================
    // OVERLAY RENDERING
    // ========================================

    renderOverlay(text, segments) {
        const overlayContainer = this.getOrCreateOverlay();
        overlayContainer.innerHTML = '';

        const textWrapper = document.createElement('div');
        textWrapper.className = 'lingua-lens-tts-text';

        segments.forEach((segment, index) => {
            const span = document.createElement('span');
            span.className = 'lingua-lens-tts-segment';
            span.textContent = segment.text;
            span.dataset.segmentIndex = index;
            span.classList.add(`lingua-lens-tts-${segment.language}`);

            // Add click handler for click-to-resume feature
            span.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleSegmentClick(index);
            });

            // Add cursor pointer for clickable segments
            span.style.cursor = 'pointer';

            textWrapper.appendChild(span);

            // Add space after English words
            if (segment.language === 'english') {
                textWrapper.appendChild(document.createTextNode(' '));
            }
        });

        overlayContainer.appendChild(textWrapper);
        this.positionOverlay();
        this.showOverlay();
    }

    // ========================================
    // HIGHLIGHTING SYNCHRONIZATION
    // ========================================

    updateHighlight(segmentIndex) {
        if (segmentIndex < 0 || segmentIndex >= this.currentSegments.length) {
            return;
        }

        this.clearHighlights();

        const span = this.overlayElement?.querySelector(
            `[data-segment-index="${segmentIndex}"]`
        );

        if (span) {
            span.classList.add('lingua-lens-tts-highlighted');
            this.currentHighlightIndex = segmentIndex;
        }
    }

    clearHighlights() {
        if (!this.overlayElement) return;

        const highlighted = this.overlayElement.querySelectorAll('.lingua-lens-tts-highlighted');
        highlighted.forEach(el => el.classList.remove('lingua-lens-tts-highlighted'));
    }

    // ========================================
    // KEYBOARD CONTROLS - SEGMENT PLAYBACK
    // ========================================

    speakSingleSegment(segmentIndex) {
        if (segmentIndex < 0 || segmentIndex >= this.currentSegments.length) {
            return;
        }

        // Cancel any ongoing speech
        speechSynthesis.cancel();
        if (this.currentUtterance) {
            this.currentUtterance = null;
        }

        const segment = this.currentSegments[segmentIndex];
        this.currentPlaybackIndex = segmentIndex;
        this.isPlayingSegment = true;

        // Highlight this segment
        this.updateHighlight(segmentIndex);

        // Create utterance for just this segment
        const utterance = new SpeechSynthesisUtterance(segment.text);

        // Set voice based on language
        const voices = speechSynthesis.getVoices();
        if (segment.language === 'chinese') {
            const chineseVoice = voices.find(v =>
                v.lang.startsWith('zh') && (
                    v.name.includes('Huihui') ||
                    v.name.includes('Ting-Ting') ||
                    v.name.includes('Google') ||
                    v.name.includes('Microsoft')
                )
            ) || voices.find(v => v.lang.startsWith('zh'));
            if (chineseVoice) utterance.voice = chineseVoice;
        } else {
            const englishVoice = voices.find(v =>
                v.lang.startsWith('en') && (
                    v.name.includes('Google') ||
                    v.name.includes('Microsoft') ||
                    v.name.includes('Natural')
                )
            ) || voices.find(v => v.lang.startsWith('en'));
            if (englishVoice) utterance.voice = englishVoice;
        }

        utterance.rate = this.settings.speed;
        utterance.volume = this.settings.volume;

        utterance.addEventListener('end', () => {
            this.isPlayingSegment = false;
            this.currentUtterance = null;
        });

        utterance.addEventListener('error', () => {
            this.isPlayingSegment = false;
            this.currentUtterance = null;
        });

        this.currentUtterance = utterance;
        speechSynthesis.speak(utterance);

        this.log(`Speaking segment ${segmentIndex}: "${segment.text}" (${segment.language})`);
    }

    findPreviousChineseSegment(fromIndex) {
        // Search backwards from fromIndex
        for (let i = fromIndex - 1; i >= 0; i--) {
            if (this.currentSegments[i].language === 'chinese') {
                return i;
            }
        }
        return -1; // No previous Chinese segment found
    }

    findNextSegment(fromIndex) {
        if (fromIndex + 1 < this.currentSegments.length) {
            return fromIndex + 1;
        }
        return -1; // End of segments
    }

    // ========================================
    // KEYBOARD EVENT HANDLERS
    // ========================================

    setupKeyboardControls() {
        // Add global keyboard listener
        document.addEventListener('keydown', (event) => {
            // Only handle if extension is enabled and we have segments
            if (!this.keyboardEnabled || this.currentSegments.length === 0) {
                return;
            }

            // Ignore if user is typing in an input field
            const activeElement = document.activeElement;
            if (activeElement && (
                activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.isContentEditable
            )) {
                return;
            }

            switch(event.key.toLowerCase()) {
                case 'e':
                    // Go back to previous Chinese character
                    event.preventDefault();
                    this.handleGoBack();
                    break;

                case 'r':
                    // Repeat current word
                    event.preventDefault();
                    this.handleRepeat();
                    break;

                case 't':
                    // Continue/play from current position
                    event.preventDefault();
                    this.handleContinue();
                    break;
            }
        });

        this.log('Keyboard controls initialized (E: back, R: repeat, T: continue)');
    }

    handleGoBack() {
        // Pause the video
        const video = document.querySelector('video');
        if (video && !video.paused) {
            video.pause();
            this.log('Video paused');
        }

        // Stop any current speech immediately
        speechSynthesis.cancel();
        if (this.currentUtterance) {
            this.currentUtterance = null;
        }

        // Determine starting point
        let startIndex;
        if (this.currentPlaybackIndex >= 0) {
            // We have a playback position, go back from there
            startIndex = this.currentPlaybackIndex;
        } else if (this.currentHighlightIndex >= 0) {
            // Use current highlight position
            startIndex = this.currentHighlightIndex;
        } else {
            // Start from end
            startIndex = this.currentSegments.length;
        }

        // Find previous Chinese segment
        const prevIndex = this.findPreviousChineseSegment(startIndex);

        if (prevIndex >= 0) {
            // Speak the previous Chinese character
            this.speakSingleSegment(prevIndex);
        } else {
            this.log('No previous Chinese character found');
        }
    }

    handleRepeat() {
        // Stop current speech
        speechSynthesis.cancel();
        if (this.currentUtterance) {
            this.currentUtterance = null;
        }

        // Repeat the current segment
        let indexToRepeat;
        if (this.currentPlaybackIndex >= 0) {
            indexToRepeat = this.currentPlaybackIndex;
        } else if (this.currentHighlightIndex >= 0) {
            indexToRepeat = this.currentHighlightIndex;
        } else {
            this.log('No current word to repeat');
            return;
        }

        // Speak the same segment again
        this.speakSingleSegment(indexToRepeat);
    }

    handleContinue() {
        // Unpause the video (only if paused)
        const video = document.querySelector('video');
        if (video && video.paused) {
            video.play();
            this.log('Video unpaused');
        }

        // If no segments yet, wait for subtitles to appear
        if (this.currentSegments.length === 0) {
            this.log('No segments available, waiting for subtitles');
            return;
        }

        // If already playing segments, continue to next
        // If not playing, start from current position

        let startIndex;
        if (this.currentPlaybackIndex >= 0) {
            // Continue from current playback position
            startIndex = this.currentPlaybackIndex;
        } else if (this.currentHighlightIndex >= 0) {
            // Start from current highlight
            startIndex = this.currentHighlightIndex;
        } else {
            // No current position - let automatic subtitle reading handle it
            this.log('No current position, letting automatic reading continue');
            return;
        }

        const nextIndex = this.findNextSegment(startIndex);

        if (nextIndex >= 0) {
            this.speakSingleSegment(nextIndex);
        } else {
            this.log('Reached end of segments, waiting for next subtitle');
        }
    }

    handleSegmentClick(segmentIndex) {
        this.log(`User clicked segment ${segmentIndex}: "${this.currentSegments[segmentIndex].text}"`);

        // Pause the video
        const video = document.querySelector('video');
        if (video && !video.paused) {
            video.pause();
            this.log('Video paused (clicked segment)');
        }

        // Cancel current playback
        speechSynthesis.cancel();
        this.isSpeakingSequentially = false;

        if (this.pauseTimeout) {
            clearTimeout(this.pauseTimeout);
            this.pauseTimeout = null;
        }

        // Start playing from clicked segment
        this.speakSegmentsSequentially(segmentIndex);
    }

    // ========================================
    // VIDEO PLAY INTEGRATION
    // ========================================

    setupVideoPlayListener() {
        const video = document.querySelector('video');
        if (!video) {
            // Retry after delay if video not found yet
            this.log('Video element not found, retrying in 1 second...');
            setTimeout(() => this.setupVideoPlayListener(), 1000);
            return;
        }

        video.addEventListener('play', () => {
            // Only handle if extension is enabled
            if (!this.settings.enabled) return;

            if (!this.enabled) {
                // Extension enabled but not started - auto-start
                this.log('Video playing, auto-starting TTS');
                this.start();
            } else if (this.currentSegments.length > 0) {
                // Extension running - continue from current position (like T key)
                this.log('Video playing, continuing subtitle reading');
                this.handleContinue();
            }
        });

        this.log('Video play listener initialized');
    }

    // ========================================
    // SEGMENT PLAYBACK WITH PAUSES
    // ========================================

    shouldPauseAfterSegment(segmentIndex) {
        // Only pause between consecutive Chinese characters when there are 2+ in a row
        // Single Chinese characters between English should flow naturally

        if (this.settings.chinesePauseDuration === 0) {
            return false;
        }

        const currentSegment = this.currentSegments[segmentIndex];
        const nextSegment = this.currentSegments[segmentIndex + 1];

        // Current and next must both be Chinese
        if (!currentSegment || currentSegment.language !== 'chinese' ||
            !nextSegment || nextSegment.language !== 'chinese') {
            return false;
        }

        // Count consecutive Chinese characters from current position
        let chineseCount = 0;
        let i = segmentIndex;

        // Count backwards from current
        while (i >= 0 && this.currentSegments[i].language === 'chinese') {
            chineseCount++;
            i--;
        }

        // Count forwards from next
        i = segmentIndex + 1;
        while (i < this.currentSegments.length && this.currentSegments[i].language === 'chinese') {
            chineseCount++;
            i++;
        }

        // Only pause if there are 2 or more consecutive Chinese characters total
        return chineseCount >= 2;
    }

    speakBatchedSegments(startIndex, endIndex) {
        // Speak multiple segments as one utterance (mixed language content)
        const segments = this.currentSegments.slice(startIndex, endIndex);
        const combinedText = segments.map(s => s.text).join(' ');

        const utterance = new SpeechSynthesisUtterance(combinedText);

        // For mixed content, use the user's selected language voice setting
        // This allows the TTS to handle mixed text naturally
        const voices = speechSynthesis.getVoices();

        if (this.settings.language === 'chinese') {
            // Use Chinese voice - will handle mixed content
            const chineseVoice = voices.find(v =>
                v.lang.startsWith('zh') && (
                    v.name.includes('Huihui') ||
                    v.name.includes('Ting-Ting') ||
                    v.name.includes('Google') ||
                    v.name.includes('Microsoft')
                )
            ) || voices.find(v => v.lang.startsWith('zh'));
            if (chineseVoice) utterance.voice = chineseVoice;
        } else {
            // Use English voice - will handle mixed content
            const englishVoice = voices.find(v =>
                v.lang.startsWith('en') && (
                    v.name.includes('Google') ||
                    v.name.includes('Microsoft') ||
                    v.name.includes('Natural')
                )
            ) || voices.find(v => v.lang.startsWith('en'));
            if (englishVoice) utterance.voice = englishVoice;
        }

        utterance.rate = this.settings.speed;
        utterance.volume = this.settings.volume;

        // Use boundary events to highlight individual words
        utterance.addEventListener('boundary', (event) => {
            if (event.name === 'word') {
                // Map character index to segment index
                const segIndex = this.mapCharToSegmentInBatch(startIndex, endIndex, event.charIndex);
                if (segIndex !== -1) {
                    this.updateHighlight(segIndex);
                    this.currentPlaybackIndex = segIndex;
                }
            }
        });

        utterance.addEventListener('end', () => {
            // Continue to next segment (which will be Chinese or end)
            this.speakSegmentsSequentially(endIndex);
        });

        utterance.addEventListener('error', (event) => {
            console.error('[Lingua-Lens TTS] Speech error:', event);
            this.isSpeakingSequentially = false;
            this.speakSegmentsSequentially(endIndex);
        });

        this.currentUtterance = utterance;
        speechSynthesis.speak(utterance);
        this.log(`Speaking batched: "${combinedText}" (${endIndex - startIndex} segments)`);
    }

    speakSingleCharacter(startIndex) {
        const segment = this.currentSegments[startIndex];
        this.currentPlaybackIndex = startIndex;
        this.updateHighlight(startIndex);

        const utterance = new SpeechSynthesisUtterance(segment.text);

        // Set Chinese voice
        const voices = speechSynthesis.getVoices();
        const chineseVoice = voices.find(v =>
            v.lang.startsWith('zh') && (
                v.name.includes('Huihui') ||
                v.name.includes('Ting-Ting') ||
                v.name.includes('Google') ||
                v.name.includes('Microsoft')
            )
        ) || voices.find(v => v.lang.startsWith('zh'));
        if (chineseVoice) utterance.voice = chineseVoice;

        utterance.rate = this.settings.speed;
        utterance.volume = this.settings.volume;

        utterance.addEventListener('end', () => {
            // Check if we need to pause before next segment
            if (this.shouldPauseAfterSegment(startIndex)) {
                this.log(`Pausing ${this.settings.chinesePauseDuration}ms between Chinese characters`);
                this.pauseTimeout = setTimeout(() => {
                    this.pauseTimeout = null;
                    if (this.enabled) {
                        this.speakSegmentsSequentially(startIndex + 1);
                    }
                }, this.settings.chinesePauseDuration);
            } else {
                this.speakSegmentsSequentially(startIndex + 1);
            }
        });

        utterance.addEventListener('error', (event) => {
            console.error('[Lingua-Lens TTS] Speech error:', event);
            this.isSpeakingSequentially = false;
            this.speakSegmentsSequentially(startIndex + 1);
        });

        this.currentUtterance = utterance;
        speechSynthesis.speak(utterance);
        this.log(`Speaking Chinese char: "${segment.text}"`);
    }

    mapCharToSegmentInBatch(startIndex, endIndex, charIndex) {
        // Map character position in combined text back to segment index
        let currentCharPos = 0;

        for (let i = startIndex; i < endIndex; i++) {
            const segment = this.currentSegments[i];
            const segmentEnd = currentCharPos + segment.text.length;

            if (charIndex >= currentCharPos && charIndex < segmentEnd) {
                return i;
            }

            currentCharPos = segmentEnd + 1; // +1 for space between words
        }

        return -1;
    }

    speakSegmentsSequentially(startIndex) {
        if (startIndex >= this.currentSegments.length) {
            // Finished speaking all segments
            this.log('Finished speaking all segments');
            this.clearHighlights();
            this.isSpeakingSequentially = false;  // Reset flag when done
            return;
        }

        // Set flag when starting the sequence
        if (startIndex === 0) {
            this.isSpeakingSequentially = true;
        }

        // Check if current position starts a group of 2+ consecutive Chinese characters
        if (this.currentSegments[startIndex].language === 'chinese') {
            let chineseEndIndex = startIndex;
            while (chineseEndIndex < this.currentSegments.length &&
                   this.currentSegments[chineseEndIndex].language === 'chinese') {
                chineseEndIndex++;
            }

            const chineseCount = chineseEndIndex - startIndex;

            if (chineseCount >= 2) {
                // Group of 2+ Chinese characters: speak first one with pause
                this.speakSingleCharacter(startIndex);
                return;
            }
        }

        // For everything else: batch until we hit a group of 2+ consecutive Chinese
        let endIndex = startIndex + 1;

        while (endIndex < this.currentSegments.length) {
            // Check if next segment starts a 2+ Chinese character sequence
            if (this.currentSegments[endIndex].language === 'chinese') {
                let chineseEnd = endIndex;
                while (chineseEnd < this.currentSegments.length &&
                       this.currentSegments[chineseEnd].language === 'chinese') {
                    chineseEnd++;
                }

                if (chineseEnd - endIndex >= 2) {
                    // Stop batching before this Chinese sequence
                    break;
                }
            }
            endIndex++;
        }

        // Batch everything from startIndex to endIndex (mixed English, single Chinese, etc.)
        this.speakBatchedSegments(startIndex, endIndex);
    }

    // ========================================
    // PUBLIC API FOR LINGUA-LENS INTEGRATION
    // ========================================

    /**
     * Called by Lingua-Lens when a new translated subtitle is ready
     * @param {string} translatedText - The fully translated subtitle text
     */
    speakSubtitle(translatedText) {
        if (!this.enabled) {
            return;
        }

        // Check if this is the exact same subtitle already being spoken
        if (this.isSpeakingSequentially && translatedText === this.currentSubtitleText) {
            this.log('Already speaking this subtitle, skipping duplicate');
            return;
        }

        // New subtitle: cancel ongoing speech and reset flag
        speechSynthesis.cancel();
        this.isSpeakingSequentially = false;  // Reset for new subtitle

        // Clear any pending pause timeout
        if (this.pauseTimeout) {
            clearTimeout(this.pauseTimeout);
            this.pauseTimeout = null;
        }

        // Segment text and render overlay
        this.currentSegments = this.segmentText(translatedText);
        this.currentSubtitleText = translatedText;
        this.currentHighlightIndex = -1;

        // Reset playback tracking when speaking full subtitle
        this.currentPlaybackIndex = -1;
        this.isPlayingSegment = false;
        if (this.currentUtterance) {
            this.currentUtterance = null;
        }

        this.renderOverlay(translatedText, this.currentSegments);

        this.log(`Segmented text into ${this.currentSegments.length} parts`);

        // Start speaking segments sequentially with pauses
        this.speakSegmentsSequentially(0);
    }

    log(message, level = 'info') {
        const prefix = '[Lingua-Lens TTS]';
        if (level === 'warn') {
            console.warn(prefix, message);
        } else {
            console.log(prefix, message);
        }
    }
}

// Initialize TTS controller when page loads (Lingua-Lens will call speakSubtitle)
if (typeof window.linguaLensTTS === 'undefined') {
    window.linguaLensTTS = new LinguaLensTTSController();
    console.log('[Lingua-Lens TTS] Controller initialized and ready');
}
