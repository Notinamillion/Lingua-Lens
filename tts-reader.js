class TTSReader {
  constructor() {
    this.synth = window.speechSynthesis;
    this.currentUtterance = null;
    this.isPlaying = false;
    this.chineseVoice = null;

    // Initialize voices
    this.initVoices();

    // Voice list may load asynchronously
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = () => this.initVoices();
    }
  }

  initVoices() {
    const voices = this.synth.getVoices();

    // Prioritize Chinese voices (Huihui, Ting-Ting, or any Google Chinese voice)
    this.chineseVoice = voices.find(v =>
      v.lang.startsWith('zh') &&
      (v.name.includes('Huihui') || v.name.includes('Ting-Ting') || v.name.includes('Google'))
    ) || voices.find(v => v.lang.startsWith('zh'));

    console.log('[TTSReader] Selected Chinese voice:', this.chineseVoice?.name || 'Default voice');
  }

  readText(text) {
    if (!text || text.trim().length === 0) {
      console.warn('[TTSReader] No text to read');
      return;
    }

    // Stop any current speech
    this.stop();

    // Clean the text (remove excessive whitespace)
    const cleanedText = text.trim().replace(/\s+/g, ' ');

    // Create utterance
    this.currentUtterance = new SpeechSynthesisUtterance(cleanedText);

    // Set Chinese voice
    if (this.chineseVoice) {
      this.currentUtterance.voice = this.chineseVoice;
      this.currentUtterance.lang = this.chineseVoice.lang;
    } else {
      // Fallback to Chinese language code if no voice found
      this.currentUtterance.lang = 'zh-CN';
    }

    // Set speech parameters
    this.currentUtterance.rate = 0.9; // Slightly slower for better comprehension
    this.currentUtterance.pitch = 1.0;
    this.currentUtterance.volume = 1.0;

    // Event handlers
    this.currentUtterance.onstart = () => {
      this.isPlaying = true;
      console.log('[TTSReader] Started reading:', cleanedText.substring(0, 50) + '...');
    };

    this.currentUtterance.onend = () => {
      this.isPlaying = false;
      this.currentUtterance = null;
      console.log('[TTSReader] Finished reading');
    };

    this.currentUtterance.onerror = (event) => {
      console.error('[TTSReader] Speech error:', event.error);
      this.isPlaying = false;
      this.currentUtterance = null;
    };

    // Start speaking
    this.synth.speak(this.currentUtterance);
  }

  stop() {
    if (this.isPlaying || this.synth.speaking) {
      this.synth.cancel();
      this.isPlaying = false;
      this.currentUtterance = null;
      console.log('[TTSReader] Stopped reading');
    }
  }

  getStatus() {
    return {
      isPlaying: this.isPlaying,
      hasVoice: this.chineseVoice !== null,
      voiceName: this.chineseVoice?.name || 'Default'
    };
  }
}

// Create global instance
if (typeof window !== 'undefined' && !window.ttsReader) {
  window.ttsReader = new TTSReader();
}
