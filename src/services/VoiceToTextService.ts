/**
 * Real Voice-to-Text Service using @react-native-voice/voice
 * Replaces VoiceToTextServiceMock with production voice recognition
 * Maintains same interface for seamless component integration
 */

import Voice, {
  SpeechResultsEvent,
  SpeechErrorEvent,
  SpeechStartEvent,
  SpeechEndEvent,
  SpeechVolumeChangeEvent,
} from '@react-native-voice/voice';
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
// Note: Firebase analytics will be added when Firebase is properly set up
// import analytics from '@react-native-firebase/analytics';
// Note: FFmpeg will be added later for Whisper API integration

// Types (maintaining compatibility with existing components)
export interface VoiceTranscriptionResult {
  text: string;
  confidence: number;
  isFinal: boolean;
  timestamp: number;
  language: string;
  source: 'native' | 'whisper';
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

export interface VoiceSettings {
  language: string;
  enablePunctuation: boolean;
  enableCapitalization: boolean;
  enableNumbersAsWords: boolean;
  maxDuration: number; // in milliseconds
  pauseThreshold: number; // in milliseconds
  enableWhisperEnhancement: boolean; // Pro feature flag
}

type VoiceResultCallback = (result: VoiceTranscriptionResult) => void;
type VoiceErrorCallback = (error: string) => void;
type VoiceCompleteCallback = (metrics: VoiceSessionMetrics) => void;
type VoiceVolumeCallback = (volume: number) => void;

/**
 * Production Voice-to-Text Service
 * Uses @react-native-voice/voice for real speech recognition
 */
class VoiceToTextService {
  private static instance: VoiceToTextService;
  private isInitialized = false;
  private isListening = false;
  private currentSession: {
    onResult?: VoiceResultCallback;
    onError?: VoiceErrorCallback;
    onComplete?: VoiceCompleteCallback;
    onVolumeChange?: VoiceVolumeCallback;
  } = {};

  private settings: VoiceSettings = {
    language: 'en-US',
    enablePunctuation: true,
    enableCapitalization: true,
    enableNumbersAsWords: false,
    maxDuration: 60000, // 1 minute
    pauseThreshold: 1000, // 1 second
    enableWhisperEnhancement: false, // Pro feature
  };

  private sessionMetrics: VoiceSessionMetrics = {
    startTime: 0,
    endTime: 0,
    totalDuration: 0,
    wordsTranscribed: 0,
    averageConfidence: 0,
    pauseCount: 0,
    errorCount: 0,
    enhancementUsed: false,
  };

  private confidenceScores: number[] = [];
  private sessionTimeout?: NodeJS.Timeout;
  private lastSpeechTime = 0;

  /**
   * Singleton pattern - ensures single voice service instance
   */
  static getInstance(): VoiceToTextService {
    if (!VoiceToTextService.instance) {
      VoiceToTextService.instance = new VoiceToTextService();
    }
    return VoiceToTextService.instance;
  }

  constructor() {
    this.initializeVoiceRecognition();
  }

  /**
   * Initialize voice recognition service and event handlers
   */
  private async initializeVoiceRecognition(): Promise<void> {
    try {
      console.log('VoiceToTextService: Initializing real voice recognition...');

      // Set up event handlers
      Voice.onSpeechStart = this.onSpeechStart.bind(this);
      Voice.onSpeechRecognized = this.onSpeechRecognized.bind(this);
      Voice.onSpeechEnd = this.onSpeechEnd.bind(this);
      Voice.onSpeechError = this.onSpeechError.bind(this);
      Voice.onSpeechResults = this.onSpeechResults.bind(this);
      Voice.onSpeechPartialResults = this.onSpeechPartialResults.bind(this);
      Voice.onSpeechVolumeChanged = this.onSpeechVolumeChanged.bind(this);

      this.isInitialized = true;
      console.log('VoiceToTextService: Real voice recognition initialized successfully');
    } catch (error) {
      console.error('VoiceToTextService: Failed to initialize voice recognition:', error);
      throw new Error(`Voice initialization failed: ${error}`);
    }
  }

  /**
   * Request microphone permission based on platform
   */
  private async requestMicrophonePermission(): Promise<boolean> {
    try {
      const permission = Platform.OS === 'ios' 
        ? PERMISSIONS.IOS.MICROPHONE 
        : PERMISSIONS.ANDROID.RECORD_AUDIO;

      console.log(`VoiceToTextService: Requesting ${Platform.OS} microphone permission...`);
      
      const result = await request(permission);
      const granted = result === RESULTS.GRANTED;
      
      console.log(`VoiceToTextService: Permission result: ${result}`);
      return granted;
    } catch (error) {
      console.error('VoiceToTextService: Permission request failed:', error);
      return false;
    }
  }

  /**
   * Reset session metrics for new voice session
   */
  private resetSessionMetrics(): void {
    this.sessionMetrics = {
      startTime: Date.now(),
      endTime: 0,
      totalDuration: 0,
      wordsTranscribed: 0,
      averageConfidence: 0,
      pauseCount: 0,
      errorCount: 0,
      enhancementUsed: false,
    };
    this.confidenceScores = [];
    this.lastSpeechTime = Date.now();
  }

  /**
   * Start listening for voice input
   */
  async startListening(
    onResult: VoiceResultCallback,
    onError: VoiceErrorCallback,
    onComplete: VoiceCompleteCallback,
    onVolumeChange?: VoiceVolumeCallback
  ): Promise<void> {
    try {
      if (!this.isInitialized) {
        await this.initializeVoiceRecognition();
      }

      if (this.isListening) {
        onError('Voice recognition is already active');
        return;
      }

      // Request microphone permission
      const hasPermission = await this.requestMicrophonePermission();
      if (!hasPermission) {
        onError('Microphone permission denied. Please enable microphone access in settings.');
        this.logAnalyticsEvent('voice_error', { error_type: 'permission_denied' });
        return;
      }

      // Store callbacks
      this.currentSession = {
        onResult,
        onError,
        onComplete,
        onVolumeChange,
      };

      // Reset metrics
      this.resetSessionMetrics();

      // Start voice recognition
      await Voice.start(this.settings.language);
      this.isListening = true;

      console.log('VoiceToTextService: Started listening...');

      // Set maximum session timeout
      this.sessionTimeout = setTimeout(() => {
        this.stopListening();
      }, this.settings.maxDuration);

      // Log analytics
      this.logAnalyticsEvent('voice_started', { 
        settings: this.settings 
      });

    } catch (error) {
      console.error('VoiceToTextService: Failed to start listening:', error);
      this.isListening = false;
      onError(`Failed to start voice recognition: ${error}`);
      this.logAnalyticsEvent('voice_error', { 
        error_type: 'start_failed', 
        error_message: String(error) 
      });
    }
  }

  /**
   * Stop listening for voice input
   */
  async stopListening(): Promise<void> {
    try {
      if (!this.isListening) {
        return;
      }

      console.log('VoiceToTextService: Stopping voice recognition...');
      
      // Clear timeout
      if (this.sessionTimeout) {
        clearTimeout(this.sessionTimeout);
        this.sessionTimeout = undefined;
      }

      // Stop voice recognition
      await Voice.stop();
      this.isListening = false;

      // Calculate final metrics
      const metrics = this.calculateSessionMetrics();
      
      console.log('VoiceToTextService: Session completed', metrics);

      // Call completion callback
      if (this.currentSession.onComplete) {
        this.currentSession.onComplete(metrics);
      }

      // Clean up temporary files
      await this.cleanupTempFiles();

      // Log analytics
      this.logAnalyticsEvent('voice_session_complete', metrics);

      // Clear callbacks
      this.currentSession = {};

    } catch (error) {
      console.error('VoiceToTextService: Failed to stop listening:', error);
      this.sessionMetrics.errorCount++;
    }
  }

  /**
   * Cancel current voice session
   */
  async cancelListening(): Promise<void> {
    try {
      if (!this.isListening) {
        return;
      }

      console.log('VoiceToTextService: Cancelling voice recognition...');

      // Clear timeout
      if (this.sessionTimeout) {
        clearTimeout(this.sessionTimeout);
        this.sessionTimeout = undefined;
      }

      // Cancel voice recognition
      await Voice.cancel();
      this.isListening = false;

      // Log analytics
      this.logAnalyticsEvent('voice_session_cancelled', {
        duration: Date.now() - this.sessionMetrics.startTime,
        reason: 'user_cancelled'
      });

      // Clear callbacks
      this.currentSession = {};

      console.log('VoiceToTextService: Voice session cancelled');

    } catch (error) {
      console.error('VoiceToTextService: Failed to cancel listening:', error);
    }
  }

  /**
   * Update voice recognition settings
   */
  updateSettings(newSettings: Partial<VoiceSettings>): void {
    const oldSettings = { ...this.settings };
    this.settings = { ...this.settings, ...newSettings };
    
    console.log('VoiceToTextService: Settings updated', this.settings);
    
    // Log settings change
    Object.keys(newSettings).forEach(key => {
      this.logAnalyticsEvent('voice_settings_changed', {
        setting: key,
        old_value: oldSettings[key as keyof VoiceSettings],
        new_value: newSettings[key as keyof VoiceSettings]
      });
    });
  }

  /**
   * Get current settings
   */
  getSettings(): VoiceSettings {
    return { ...this.settings };
  }

  /**
   * Check if currently listening
   */
  isCurrentlyListening(): boolean {
    return this.isListening;
  }

  // Event Handlers

  private onSpeechStart(event: SpeechStartEvent): void {
    console.log('VoiceToTextService: Speech started');
    this.lastSpeechTime = Date.now();
  }

  private onSpeechRecognized(): void {
    console.log('VoiceToTextService: Speech recognized');
    this.lastSpeechTime = Date.now();
  }

  private onSpeechEnd(): void {
    console.log('VoiceToTextService: Speech ended');
    // Auto-stop if no speech for pause threshold
    setTimeout(() => {
      if (this.isListening && Date.now() - this.lastSpeechTime > this.settings.pauseThreshold) {
        this.sessionMetrics.pauseCount++;
        this.stopListening();
      }
    }, this.settings.pauseThreshold);
  }

  private onSpeechError(error: SpeechErrorEvent): void {
    console.error('VoiceToTextService: Speech error:', error);
    this.sessionMetrics.errorCount++;
    
    let errorMessage = 'An error occurred during voice recognition';
    
    // Handle specific error codes
    if (error.error) {
      switch (error.error.code) {
        case '7':
          errorMessage = 'No speech detected. Please try speaking more clearly.';
          break;
        case '8':
          errorMessage = 'Recognition timeout. Please try again.';
          break;
        case '9':
          errorMessage = 'Audio recording error. Please check your microphone.';
          break;
        default:
          errorMessage = `Recognition error: ${error.error.message || 'Unknown error'}`;
      }
    }

    this.isListening = false;
    
    if (this.currentSession.onError) {
      this.currentSession.onError(errorMessage);
    }

    this.logAnalyticsEvent('voice_error', {
      error_type: error.error?.code || 'unknown',
      error_message: errorMessage
    });
  }

  private onSpeechResults(event: SpeechResultsEvent): void {
    const results = event.value || [];
    if (results.length > 0) {
      const text = results[0];
      const confidence = this.estimateConfidence(text, true);
      
      this.confidenceScores.push(confidence);
      this.sessionMetrics.wordsTranscribed = this.calculateWordCount(text);
      
      const result: VoiceTranscriptionResult = {
        text: this.processText(text),
        confidence,
        isFinal: true,
        timestamp: Date.now(),
        language: this.settings.language,
        source: 'native'
      };

      console.log('VoiceToTextService: Final result:', result);

      if (this.currentSession.onResult) {
        this.currentSession.onResult(result);
      }

      this.logAnalyticsEvent('voice_transcription', {
        text_length: result.text.length,
        confidence: result.confidence,
        is_final: result.isFinal,
        source: result.source
      });
    }
  }

  private onSpeechPartialResults(event: SpeechResultsEvent): void {
    const results = event.value || [];
    if (results.length > 0) {
      const text = results[0];
      const confidence = this.estimateConfidence(text, false);
      
      const result: VoiceTranscriptionResult = {
        text: this.processText(text),
        confidence,
        isFinal: false,
        timestamp: Date.now(),
        language: this.settings.language,
        source: 'native'
      };

      if (this.currentSession.onResult) {
        this.currentSession.onResult(result);
      }

      this.logAnalyticsEvent('voice_transcription', {
        text_length: result.text.length,
        confidence: result.confidence,
        is_final: result.isFinal,
        source: result.source
      });
    }
  }

  private onSpeechVolumeChanged(event: SpeechVolumeChangeEvent): void {
    const volume = event.value || 0;
    
    if (this.currentSession.onVolumeChange) {
      this.currentSession.onVolumeChange(volume);
    }
  }

  // Utility Methods

  private processText(text: string): string {
    let processed = text;

    // Apply capitalization
    if (this.settings.enableCapitalization) {
      processed = processed.charAt(0).toUpperCase() + processed.slice(1);
    }

    // Apply punctuation (basic)
    if (this.settings.enablePunctuation && !processed.match(/[.!?]$/)) {
      processed += '.';
    }

    return processed;
  }

  private estimateConfidence(text: string, isFinal: boolean): number {
    // Simple confidence estimation based on text length and finality
    const baseConfidence = isFinal ? 0.85 : 0.70;
    const lengthBonus = Math.min(text.length * 0.01, 0.15);
    return Math.min(baseConfidence + lengthBonus, 1.0);
  }

  private calculateWordCount(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  private calculateSessionMetrics(): VoiceSessionMetrics {
    const endTime = Date.now();
    const totalDuration = endTime - this.sessionMetrics.startTime;
    const averageConfidence = this.confidenceScores.length > 0
      ? this.confidenceScores.reduce((sum, score) => sum + score, 0) / this.confidenceScores.length
      : 0;

    return {
      ...this.sessionMetrics,
      endTime,
      totalDuration,
      averageConfidence,
    };
  }

  private async cleanupTempFiles(): Promise<void> {
    try {
      const tempPath = `${RNFS.TemporaryDirectoryPath}/voice_temp.wav`;
      const exists = await RNFS.exists(tempPath);
      if (exists) {
        await RNFS.unlink(tempPath);
        console.log('VoiceToTextService: Cleaned up temporary files');
      }
    } catch (error) {
      console.warn('VoiceToTextService: Failed to clean up temp files:', error);
    }
  }

  private logAnalyticsEvent(eventName: string, parameters: any): void {
    try {
      // TODO: Replace with actual Firebase analytics when available
      // analytics().logEvent(eventName, parameters);
      console.log(`VoiceToTextService Analytics: ${eventName}`, parameters);
    } catch (error) {
      console.warn('VoiceToTextService: Failed to log analytics event:', error);
    }
  }

  /**
   * Get available languages for voice recognition
   */
  async getAvailableLanguages(): Promise<string[]> {
    try {
      const languages = await Voice.getSpeechRecognitionServices();
      return Array.isArray(languages) ? languages : ['en-US'];
    } catch (error) {
      console.warn('VoiceToTextService: Failed to get available languages:', error);
      return ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE'];
    }
  }

  /**
   * Cleanup and destroy voice service
   */
  async destroy(): Promise<void> {
    try {
      if (this.isListening) {
        await this.cancelListening();
      }
      
      await Voice.destroy();
      console.log('VoiceToTextService: Service destroyed');
    } catch (error) {
      console.error('VoiceToTextService: Failed to destroy service:', error);
    }
  }
}

// Export singleton instance
export default VoiceToTextService.getInstance();
