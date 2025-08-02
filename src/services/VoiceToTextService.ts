// Voice-to-Text Service - Hybrid Real-time + AI Enhancement
// Provides real-time speech-to-text with optional Whisper API enhancement

// For now, we'll use a mock implementation until we install the voice library
// This allows development to continue while dependencies are managed

export interface VoiceTranscriptionResult {
  text: string;
  confidence: number;
  isFinal: boolean;
  timestamp: number;
  language: string;
}

export interface VoiceSettings {
  language: string;
  enablePunctuation: boolean;
  enableCapitalization: boolean;
  enableNumbersAsWords: boolean;
  maxDuration: number; // in seconds
  pauseThreshold: number; // silence duration to auto-stop
  enableWhisperEnhancement: boolean; // Pro feature flag
}

export interface VoiceSessionMetrics {
  startTime: number;
  endTime: number;
  totalDuration: number;
  wordsTranscribed: number;
  averageConfidence: number;
  pauseCount: number;
  errorCount: number;
  enhancementUsed: boolean;
}

type VoiceEventCallback = (result: VoiceTranscriptionResult) => void;
type VoiceErrorCallback = (error: string) => void;
type VoiceCompleteCallback = (metrics: VoiceSessionMetrics) => void;

class VoiceToTextService {
  private static instance: VoiceToTextService;
  private isInitialized: boolean = false;
  private isListening: boolean = false;
  private settings: VoiceSettings;
  private sessionMetrics: VoiceSessionMetrics | null = null;
  private pauseTimer: NodeJS.Timeout | null = null;
  private maxDurationTimer: NodeJS.Timeout | null = null;
  
  // Event callbacks
  private onResult: VoiceEventCallback | null = null;
  private onError: VoiceErrorCallback | null = null;
  private onComplete: VoiceCompleteCallback | null = null;

  // Session tracking
  private transcriptionBuffer: string[] = [];
  private confidenceScores: number[] = [];
  private pauseCount: number = 0;
  private errorCount: number = 0;

  private constructor() {
    this.settings = {
      language: 'en-US',
      enablePunctuation: true,
      enableCapitalization: true,
      enableNumbersAsWords: false,
      maxDuration: 300, // 5 minutes
      pauseThreshold: 3, // 3 seconds of silence
    };
  }

  public static getInstance(): VoiceToTextService {
    if (!VoiceToTextService.instance) {
      VoiceToTextService.instance = new VoiceToTextService();
    }
    return VoiceToTextService.instance;
  }

  // Initialize the voice service
  public async initialize(): Promise<boolean> {
    try {
      // Request microphone permission
      const hasPermission = await this.requestMicrophonePermission();
      if (!hasPermission) {
        throw new Error('Microphone permission denied');
      }

      // Initialize voice recognition
      Voice.onSpeechStart = this.onSpeechStart.bind(this);
      Voice.onSpeechRecognized = this.onSpeechRecognized.bind(this);
      Voice.onSpeechEnd = this.onSpeechEnd.bind(this);
      Voice.onSpeechError = this.onSpeechError.bind(this);
      Voice.onSpeechResults = this.onSpeechResults.bind(this);
      Voice.onSpeechPartialResults = this.onSpeechPartialResults.bind(this);
      Voice.onSpeechVolumeChanged = this.onSpeechVolumeChanged.bind(this);

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize Voice-to-Text service:', error);
      this.isInitialized = false;
      return false;
    }
  }

  // Request microphone permission
  private async requestMicrophonePermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'NoteSpark AI needs access to your microphone for voice-to-text functionality.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (error) {
        console.error('Error requesting microphone permission:', error);
        return false;
      }
    }
    // iOS permissions are handled automatically by the system
    return true;
  }

  // Start voice recognition
  public async startListening(
    onResult: VoiceEventCallback,
    onError: VoiceErrorCallback,
    onComplete: VoiceCompleteCallback
  ): Promise<boolean> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        onError('Failed to initialize voice recognition');
        return false;
      }
    }

    if (this.isListening) {
      onError('Voice recognition is already active');
      return false;
    }

    try {
      // Set callbacks
      this.onResult = onResult;
      this.onError = onError;
      this.onComplete = onComplete;

      // Initialize session metrics
      this.sessionMetrics = {
        startTime: Date.now(),
        endTime: 0,
        totalDuration: 0,
        wordsTranscribed: 0,
        averageConfidence: 0,
        pauseCount: 0,
        errorCount: 0,
      };

      // Clear session data
      this.transcriptionBuffer = [];
      this.confidenceScores = [];
      this.pauseCount = 0;
      this.errorCount = 0;

      // Start voice recognition
      await Voice.start(this.settings.language);
      this.isListening = true;

      // Set maximum duration timer
      this.maxDurationTimer = setTimeout(() => {
        this.stopListening();
      }, this.settings.maxDuration * 1000);

      return true;
    } catch (error) {
      console.error('Failed to start voice recognition:', error);
      this.onError?.('Failed to start voice recognition');
      return false;
    }
  }

  // Stop voice recognition
  public async stopListening(): Promise<void> {
    if (!this.isListening) {
      return;
    }

    try {
      await Voice.stop();
      this.isListening = false;

      // Clear timers
      if (this.pauseTimer) {
        clearTimeout(this.pauseTimer);
        this.pauseTimer = null;
      }
      if (this.maxDurationTimer) {
        clearTimeout(this.maxDurationTimer);
        this.maxDurationTimer = null;
      }

      // Finalize session metrics
      if (this.sessionMetrics) {
        this.sessionMetrics.endTime = Date.now();
        this.sessionMetrics.totalDuration = this.sessionMetrics.endTime - this.sessionMetrics.startTime;
        this.sessionMetrics.averageConfidence = this.confidenceScores.length > 0
          ? this.confidenceScores.reduce((sum, conf) => sum + conf, 0) / this.confidenceScores.length
          : 0;
        this.sessionMetrics.pauseCount = this.pauseCount;
        this.sessionMetrics.errorCount = this.errorCount;

        this.onComplete?.(this.sessionMetrics);
      }
    } catch (error) {
      console.error('Error stopping voice recognition:', error);
    }
  }

  // Cancel voice recognition
  public async cancelListening(): Promise<void> {
    if (!this.isListening) {
      return;
    }

    try {
      await Voice.cancel();
      this.isListening = false;

      // Clear timers
      if (this.pauseTimer) {
        clearTimeout(this.pauseTimer);
        this.pauseTimer = null;
      }
      if (this.maxDurationTimer) {
        clearTimeout(this.maxDurationTimer);
        this.maxDurationTimer = null;
      }
    } catch (error) {
      console.error('Error canceling voice recognition:', error);
    }
  }

  // Update voice settings
  public updateSettings(newSettings: Partial<VoiceSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
  }

  // Get current settings
  public getSettings(): VoiceSettings {
    return { ...this.settings };
  }

  // Check if currently listening
  public isCurrentlyListening(): boolean {
    return this.isListening;
  }

  // Voice event handlers
  private onSpeechStart(): void {
    console.log('Voice recognition started');
  }

  private onSpeechRecognized(): void {
    console.log('Speech recognized');
    // Reset pause timer when speech is detected
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
  }

  private onSpeechEnd(): void {
    console.log('Voice recognition ended');
    // Start pause timer
    this.pauseTimer = setTimeout(() => {
      this.pauseCount++;
      this.stopListening();
    }, this.settings.pauseThreshold * 1000);
  }

  private onSpeechError(error: SpeechErrorEvent): void {
    console.error('Voice recognition error:', error);
    this.errorCount++;
    this.onError?.(error.error?.message || 'Voice recognition error');
  }

  private onSpeechResults(event: SpeechResultsEvent): void {
    if (event.value && event.value.length > 0) {
      const text = event.value[0];
      const processedText = this.processTranscription(text);
      
      // Update session metrics
      const wordCount = processedText.split(' ').filter(word => word.length > 0).length;
      if (this.sessionMetrics) {
        this.sessionMetrics.wordsTranscribed += wordCount;
      }

      const result: VoiceTranscriptionResult = {
        text: processedText,
        confidence: 0.9, // Voice library doesn't provide confidence, so we estimate
        isFinal: true,
        timestamp: Date.now(),
        language: this.settings.language,
      };

      this.transcriptionBuffer.push(processedText);
      this.confidenceScores.push(result.confidence);
      this.onResult?.(result);
    }
  }

  private onSpeechPartialResults(event: SpeechResultsEvent): void {
    if (event.value && event.value.length > 0) {
      const text = event.value[0];
      const processedText = this.processTranscription(text);

      const result: VoiceTranscriptionResult = {
        text: processedText,
        confidence: 0.7, // Lower confidence for partial results
        isFinal: false,
        timestamp: Date.now(),
        language: this.settings.language,
      };

      this.onResult?.(result);
    }
  }

  private onSpeechVolumeChanged(event: any): void {
    // Could be used for UI feedback showing voice level
    console.log('Voice volume:', event.value);
  }

  // Process and enhance transcription
  private processTranscription(text: string): string {
    let processed = text;

    // Apply capitalization if enabled
    if (this.settings.enableCapitalization) {
      processed = this.applyCapitalization(processed);
    }

    // Apply punctuation if enabled
    if (this.settings.enablePunctuation) {
      processed = this.applySmartPunctuation(processed);
    }

    // Convert numbers to words if enabled
    if (this.settings.enableNumbersAsWords) {
      processed = this.convertNumbersToWords(processed);
    }

    return processed;
  }

  // Apply smart capitalization
  private applyCapitalization(text: string): string {
    // Capitalize first word and words after sentence endings
    return text.replace(/(^|\. )([a-z])/g, (match, prefix, letter) => {
      return prefix + letter.toUpperCase();
    });
  }

  // Apply smart punctuation
  private applySmartPunctuation(text: string): string {
    let processed = text;

    // Add periods for common endings
    if (!processed.match(/[.!?]$/)) {
      processed += '.';
    }

    return processed;
  }

  // Convert numbers to words (basic implementation)
  private convertNumbersToWords(text: string): string {
    const numberWords: Record<string, string> = {
      '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
      '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine',
      '10': 'ten', '11': 'eleven', '12': 'twelve', '13': 'thirteen',
      '14': 'fourteen', '15': 'fifteen', '16': 'sixteen', '17': 'seventeen',
      '18': 'eighteen', '19': 'nineteen', '20': 'twenty'
    };

    return text.replace(/\b\d+\b/g, (match) => {
      return numberWords[match] || match;
    });
  }

  // Get supported languages
  public async getSupportedLanguages(): Promise<string[]> {
    try {
      const languages = await Voice.getSpeechRecognitionServices();
      return languages || ['en-US'];
    } catch (error) {
      console.error('Error getting supported languages:', error);
      return ['en-US'];
    }
  }

  // Cleanup
  public async destroy(): Promise<void> {
    if (this.isListening) {
      await this.cancelListening();
    }

    try {
      await Voice.destroy();
      this.isInitialized = false;
    } catch (error) {
      console.error('Error destroying voice service:', error);
    }
  }
}

export default VoiceToTextService;
