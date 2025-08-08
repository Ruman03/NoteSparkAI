/**
 * Real Voice-to-Text Service using @react-native-voice/voice
 * Replaces VoiceToTextServiceMock with production voice recognition
 * Maintains same interface for seamless component integration
 * OPTIMIZED: Enhanced with comprehensive error handling, retry logic, and metrics tracking
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

// Enhanced interfaces for better type safety
interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

interface VoiceServiceMetrics {
  requestCount: number;
  successCount: number;
  errorCount: number;
  averageSessionDuration: number;
  totalWordsTranscribed: number;
  lastSuccess?: Date;
  lastError?: string;
}

// Types (maintaining compatibility with existing components)
export interface VoiceTranscriptionResult {
  text: string;
  confidence: number;
  isFinal: boolean;
  timestamp: number;
  language: string;
  source: 'native' | 'whisper';
  metadata?: {
    wordCount: number;
    processingTime: number;
    sessionId: string;
  };
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
  sessionId: string;
}

export interface VoiceSettings {
  language: string;
  enablePunctuation: boolean;
  enableCapitalization: boolean;
  enableNumbersAsWords: boolean;
  maxDuration: number; // in milliseconds
  pauseThreshold: number; // in milliseconds
  enableWhisperEnhancement: boolean; // Pro feature flag
  timeout?: number;
}

type VoiceResultCallback = (result: VoiceTranscriptionResult) => void;
type VoiceErrorCallback = (error: string) => void;
type VoiceCompleteCallback = (metrics: VoiceSessionMetrics) => void;
type VoiceVolumeCallback = (volume: number) => void;

// Enhanced constants
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 5000,
  backoffFactor: 2
};

const VOICE_TIMEOUT = 60000; // 60 seconds default timeout
const SUPPORTED_LANGUAGES = [
  'en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 
  'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'
];

const NON_RETRYABLE_ERRORS = [
  'permission denied',
  'microphone access',
  'already listening',
  'not supported',
  'invalid language',
  'user denied'
];

/**
 * Production Voice-to-Text Service
 * Uses @react-native-voice/voice for real speech recognition
 * OPTIMIZED: Enhanced with retry logic, comprehensive error handling, and performance improvements
 */
class VoiceToTextService {
  private static instance: VoiceToTextService;
  private isInitialized = false;
  private isListening = false;
  private currentSessionId = '';
  private currentSession: {
    onResult?: VoiceResultCallback;
    onError?: VoiceErrorCallback;
    onComplete?: VoiceCompleteCallback;
    onVolumeChange?: VoiceVolumeCallback;
  } = {};

  private readonly metrics: VoiceServiceMetrics;
  private readonly retryOptions: RetryOptions;

  private settings: VoiceSettings = {
    language: 'en-US',
    enablePunctuation: true,
    enableCapitalization: true,
    enableNumbersAsWords: false,
    maxDuration: 60000, // 1 minute
    pauseThreshold: 1000, // 1 second
    enableWhisperEnhancement: false, // Pro feature
    timeout: VOICE_TIMEOUT
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
    sessionId: ''
  };

  private confidenceScores: number[] = [];
  private sessionTimeout?: NodeJS.Timeout;
  private lastSpeechTime = 0;
  private retryAttempts = 0;
  private maxRetryAttempts = 3;

  constructor() {
    // Initialize service metrics
    this.metrics = {
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      averageSessionDuration: 0,
      totalWordsTranscribed: 0
    };

    this.retryOptions = { ...DEFAULT_RETRY_OPTIONS };
    console.log('VoiceToTextService: Enhanced instance created with comprehensive capabilities');
    
    this.initializeVoiceRecognition();
  }

  // OPTIMIZED: Enhanced retry mechanism for voice operations
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 3,
    timeoutMs: number = 10000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let timeoutId: NodeJS.Timeout | undefined;
      
      try {
        console.log(`VoiceToTextService: ${operationName} attempt ${attempt}/${maxRetries}`);
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Voice operation timeout')), timeoutMs);
          (timeoutId as any).unref?.();
        });
        
        const result = await Promise.race([operation(), timeoutPromise]);
        console.log(`VoiceToTextService: ${operationName} succeeded on attempt ${attempt}`);
        
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        return result;
      } catch (error) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`VoiceToTextService: ${operationName} failed on attempt ${attempt}:`, lastError.message);
        
        // Don't retry for certain errors
        if (this.isNonRetryableError(lastError)) {
          console.log(`VoiceToTextService: Non-retryable error for ${operationName}, stopping retries`);
          break;
        }
        
        if (attempt === maxRetries) {
          break;
        }
        
        // Progressive delay between retries
        const delay = Math.min(1000 * attempt, 3000);
        console.log(`VoiceToTextService: Retrying ${operationName} in ${delay}ms...`);
  await new Promise(resolve => { const t = setTimeout(resolve, delay); (t as any).unref?.(); });
      }
    }
    
    throw new Error(`All ${maxRetries} attempts failed for ${operationName}: ${lastError!.message}`);
  }

  // OPTIMIZED: Check if error should not be retried
  private isNonRetryableError(error: Error): boolean {
    const nonRetryableMessages = [
      'permission denied',
      'microphone access',
      'already listening',
      'not supported',
      'invalid language',
      'user denied'
    ];
    
    const errorMessage = error.message.toLowerCase();
    return nonRetryableMessages.some(msg => errorMessage.includes(msg));
  }

  // OPTIMIZED: Enhanced input validation
  private validateVoiceSettings(settings?: Partial<VoiceSettings>): void {
    if (settings?.language) {
      const validLanguages = ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'];
      if (!validLanguages.includes(settings.language)) {
        throw new Error(`Unsupported language: ${settings.language}`);
      }
    }
    
    if (settings?.maxDuration !== undefined) {
      if (settings.maxDuration < 1000 || settings.maxDuration > 300000) { // 1 second to 5 minutes
        throw new Error('Max duration must be between 1 second and 5 minutes');
      }
    }
    
    if (settings?.pauseThreshold !== undefined) {
      if (settings.pauseThreshold < 100 || settings.pauseThreshold > 10000) { // 100ms to 10 seconds
        throw new Error('Pause threshold must be between 100ms and 10 seconds');
      }
    }
  }

  /**
   * Singleton pattern - ensures single voice service instance
   */
  static getInstance(): VoiceToTextService {
    if (!VoiceToTextService.instance) {
      VoiceToTextService.instance = new VoiceToTextService();
    }
    return VoiceToTextService.instance;
  }

  /**
   * Update service metrics
   */
  private updateMetrics(success: boolean, sessionDuration?: number, wordsTranscribed?: number, errorMessage?: string): void {
    this.metrics.requestCount++;
    
    if (success) {
      this.metrics.successCount++;
      this.metrics.lastSuccess = new Date();
      
      if (sessionDuration) {
        // Update average session duration with weighted average
        const weight = 0.1; // 10% weight for new measurement
        this.metrics.averageSessionDuration = 
          this.metrics.averageSessionDuration * (1 - weight) + sessionDuration * weight;
      }
      
      if (wordsTranscribed) {
        this.metrics.totalWordsTranscribed += wordsTranscribed;
      }
    } else {
      this.metrics.errorCount++;
      this.metrics.lastError = errorMessage;
    }
  }

  /**
   * Check if the service is available and properly initialized
   */
  isServiceAvailable(): boolean {
    return this.isInitialized && !this.isListening;
  }

  /**
   * Get service metrics
   */
  getServiceMetrics(): VoiceServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
    this.currentSessionId = this.generateSessionId();
    this.sessionMetrics = {
      startTime: Date.now(),
      endTime: 0,
      totalDuration: 0,
      wordsTranscribed: 0,
      averageConfidence: 0,
      pauseCount: 0,
      errorCount: 0,
      enhancementUsed: false,
      sessionId: this.currentSessionId
    };
    this.confidenceScores = [];
    this.lastSpeechTime = Date.now();
    console.log(`VoiceToTextService: Session initialized with ID: ${this.currentSessionId}`);
  }

  /**
   * Start listening for voice input with enhanced error handling
   */
  async startListening(
    onResult: VoiceResultCallback,
    onError: VoiceErrorCallback,
    onComplete: VoiceCompleteCallback,
    onVolumeChange?: VoiceVolumeCallback
  ): Promise<void> {
    return this.withRetry(async () => {
      if (!this.isInitialized) {
        await this.initializeVoiceRecognition();
      }

      if (this.isListening) {
        throw new Error('VoiceToTextService: Voice recognition is already active');
      }

      // Validate callbacks
      if (!onResult || !onError || !onComplete) {
        throw new Error('VoiceToTextService: Required callbacks (onResult, onError, onComplete) must be provided');
      }

      // Request microphone permission
      const hasPermission = await this.requestMicrophonePermission();
      if (!hasPermission) {
        const error = 'Microphone permission denied. Please enable microphone access in settings.';
        this.updateMetrics(false, undefined, undefined, error);
        this.logAnalyticsEvent('voice_error', { error_type: 'permission_denied' });
        throw new Error(error);
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

      // Start voice recognition with timeout protection
      await Promise.race([
        Voice.start(this.settings.language),
        new Promise<never>((_, reject) => { const t = setTimeout(() => reject(new Error('Voice start timeout')), this.settings.timeout || VOICE_TIMEOUT); (t as any).unref?.(); })
      ]);

      this.isListening = true;
      console.log(`VoiceToTextService: Started listening with session ID: ${this.currentSessionId}`);

      // Set maximum session timeout
  this.sessionTimeout = setTimeout(() => {
        console.log('VoiceToTextService: Session timeout reached, stopping...');
        this.stopListening();
      }, this.settings.maxDuration);
  (this.sessionTimeout as any).unref?.();

      // Log analytics
      this.logAnalyticsEvent('voice_started', { 
        sessionId: this.currentSessionId,
        settings: this.settings 
      });

    }, 'startListening');
  }

  /**
   * Stop listening for voice input with enhanced cleanup
   */
  async stopListening(): Promise<void> {
    return this.withRetry(async () => {
      if (!this.isListening) {
        console.log('VoiceToTextService: Already stopped, ignoring stop request');
        return;
      }

      console.log(`VoiceToTextService: Stopping voice recognition for session ${this.currentSessionId}...`);
      
      // Clear timeout
      if (this.sessionTimeout) {
        clearTimeout(this.sessionTimeout);
        this.sessionTimeout = undefined;
      }

      // Stop voice recognition with timeout protection
      await Promise.race([
        Voice.stop(),
        new Promise<void>((resolve) => { const t = setTimeout(() => {
            console.warn('VoiceToTextService: Stop operation timed out, forcing stop');
            resolve();
          }, 5000); (t as any).unref?.(); })
      ]);

      this.isListening = false;

      // Calculate final metrics
      const metrics = this.calculateSessionMetrics();
      
      // Update service metrics
      this.updateMetrics(true, metrics.totalDuration, metrics.wordsTranscribed);
      
      console.log('VoiceToTextService: Session completed', metrics);

      // Call completion callback if available
      if (this.currentSession.onComplete) {
        this.currentSession.onComplete(metrics);
      }

      // Clean up temporary files
      await this.cleanupTempFiles();

      // Log analytics
      this.logAnalyticsEvent('voice_session_complete', metrics);

      // Clear callbacks
      this.currentSession = {};
      this.currentSessionId = '';

    }, 'stopListening', 2); // Fewer retries for stop operation
  }

  /**
   * Cancel current voice session with enhanced cleanup
   */
  async cancelListening(): Promise<void> {
    return this.withRetry(async () => {
      if (!this.isListening) {
        console.log('VoiceToTextService: No active session to cancel');
        return;
      }

      console.log(`VoiceToTextService: Cancelling voice recognition for session ${this.currentSessionId}...`);

      // Clear timeout
      if (this.sessionTimeout) {
        clearTimeout(this.sessionTimeout);
        this.sessionTimeout = undefined;
      }

      // Cancel voice recognition with timeout protection
      await Promise.race([
        Voice.cancel(),
        new Promise<void>((resolve) => { const t = setTimeout(() => {
            console.warn('VoiceToTextService: Cancel operation timed out, forcing cancellation');
            resolve();
          }, 3000); (t as any).unref?.(); })
      ]);

      this.isListening = false;

      // Update service metrics for cancelled session
      this.updateMetrics(false, undefined, undefined, 'User cancelled session');

      // Log analytics
      this.logAnalyticsEvent('voice_session_cancelled', {
        sessionId: this.currentSessionId,
        duration: Date.now() - this.sessionMetrics.startTime,
        reason: 'user_cancelled'
      });

      // Clear callbacks and session data
      this.currentSession = {};
      this.currentSessionId = '';

      console.log('VoiceToTextService: Voice session cancelled successfully');

    }, 'cancelListening', 2); // Fewer retries for cancel operation
  }

  /**
   * Update voice recognition settings with validation
   */
  updateSettings(newSettings: Partial<VoiceSettings>): void {
    try {
      // Validate new settings
      this.validateVoiceSettings(newSettings);
      
      const oldSettings = { ...this.settings };
      this.settings = { ...this.settings, ...newSettings };
      
      console.log('VoiceToTextService: Settings updated successfully', this.settings);
      
      // Log settings change for each modified property
      Object.keys(newSettings).forEach(key => {
        this.logAnalyticsEvent('voice_settings_changed', {
          setting: key,
          old_value: oldSettings[key as keyof VoiceSettings],
          new_value: newSettings[key as keyof VoiceSettings]
        });
      });
    } catch (error) {
      console.error('VoiceToTextService: Failed to update settings:', error);
      throw new Error(`Settings update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current settings (immutable copy)
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

  /**
   * Get current session ID (if active)
   */
  getCurrentSessionId(): string | null {
    return this.isListening ? this.currentSessionId : null;
  }

  // Enhanced Event Handlers with better error handling

  private onSpeechStart(event: SpeechStartEvent): void {
    try {
      console.log(`VoiceToTextService: Speech started for session ${this.currentSessionId}`);
      this.lastSpeechTime = Date.now();
      
      this.logAnalyticsEvent('voice_speech_start', {
        sessionId: this.currentSessionId,
        timestamp: this.lastSpeechTime
      });
    } catch (error) {
      console.error('VoiceToTextService: Error in onSpeechStart:', error);
    }
  }

  private onSpeechRecognized(): void {
    try {
      console.log(`VoiceToTextService: Speech recognized for session ${this.currentSessionId}`);
      this.lastSpeechTime = Date.now();
      
      this.logAnalyticsEvent('voice_speech_recognized', {
        sessionId: this.currentSessionId,
        timestamp: this.lastSpeechTime
      });
    } catch (error) {
      console.error('VoiceToTextService: Error in onSpeechRecognized:', error);
    }
  }

  private onSpeechEnd(): void {
    try {
      console.log(`VoiceToTextService: Speech ended for session ${this.currentSessionId}`);
      
      // Auto-stop if no speech for pause threshold
      setTimeout(() => {
        if (this.isListening && Date.now() - this.lastSpeechTime > this.settings.pauseThreshold) {
          console.log('VoiceToTextService: Pause threshold exceeded, stopping session');
          this.sessionMetrics.pauseCount++;
          this.stopListening();
        }
      }, this.settings.pauseThreshold);
      
      this.logAnalyticsEvent('voice_speech_end', {
        sessionId: this.currentSessionId,
        pauseThreshold: this.settings.pauseThreshold
      });
    } catch (error) {
      console.error('VoiceToTextService: Error in onSpeechEnd:', error);
    }
  }

  private onSpeechError(error: SpeechErrorEvent): void {
    try {
      console.error(`VoiceToTextService: Speech error for session ${this.currentSessionId}:`, error);
      this.sessionMetrics.errorCount++;
      
      let errorMessage = 'An error occurred during voice recognition';
      
      // Handle specific error codes with enhanced messaging
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
          case '6':
            errorMessage = 'No network connection. Please check your internet connection.';
            break;
          case '5':
            errorMessage = 'Recognition service error. Please try again later.';
            break;
          default:
            errorMessage = `Recognition error: ${error.error.message || 'Unknown error'}`;
        }
      }

      this.isListening = false;
      
      // Update service metrics
      this.updateMetrics(false, undefined, undefined, errorMessage);
      
      // Call error callback if available
      if (this.currentSession.onError) {
        this.currentSession.onError(errorMessage);
      }

      this.logAnalyticsEvent('voice_error', {
        sessionId: this.currentSessionId,
        error_type: error.error?.code || 'unknown',
        error_message: errorMessage
      });
    } catch (handlerError) {
      console.error('VoiceToTextService: Error in onSpeechError handler:', handlerError);
    }
  }

  private onSpeechResults(event: SpeechResultsEvent): void {
    try {
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
          source: 'native',
          metadata: {
            wordCount: this.sessionMetrics.wordsTranscribed,
            processingTime: Date.now() - this.sessionMetrics.startTime,
            sessionId: this.currentSessionId
          }
        };

        console.log(`VoiceToTextService: Final result for session ${this.currentSessionId}:`, result);

        // Call result callback if available
        if (this.currentSession.onResult) {
          this.currentSession.onResult(result);
        }

        this.logAnalyticsEvent('voice_transcription', {
          sessionId: this.currentSessionId,
          text_length: result.text.length,
          confidence: result.confidence,
          is_final: result.isFinal,
          source: result.source,
          word_count: result.metadata?.wordCount
        });
      }
    } catch (error) {
      console.error('VoiceToTextService: Error in onSpeechResults:', error);
      this.sessionMetrics.errorCount++;
    }
  }

  private onSpeechPartialResults(event: SpeechResultsEvent): void {
    try {
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
          source: 'native',
          metadata: {
            wordCount: this.calculateWordCount(text),
            processingTime: Date.now() - this.sessionMetrics.startTime,
            sessionId: this.currentSessionId
          }
        };

        // Call result callback if available
        if (this.currentSession.onResult) {
          this.currentSession.onResult(result);
        }

        this.logAnalyticsEvent('voice_transcription', {
          sessionId: this.currentSessionId,
          text_length: result.text.length,
          confidence: result.confidence,
          is_final: result.isFinal,
          source: result.source,
          word_count: result.metadata?.wordCount
        });
      }
    } catch (error) {
      console.error('VoiceToTextService: Error in onSpeechPartialResults:', error);
    }
  }

  private onSpeechVolumeChanged(event: SpeechVolumeChangeEvent): void {
    try {
      const volume = event.value || 0;
      
      // Call volume callback if available
      if (this.currentSession.onVolumeChange) {
        this.currentSession.onVolumeChange(volume);
      }
    } catch (error) {
      console.error('VoiceToTextService: Error in onSpeechVolumeChanged:', error);
    }
  }

  // Enhanced Utility Methods

  private processText(text: string): string {
    try {
      if (!text || typeof text !== 'string') {
        return '';
      }

      let processed = text.trim();

      // Apply capitalization
      if (this.settings.enableCapitalization && processed.length > 0) {
        processed = processed.charAt(0).toUpperCase() + processed.slice(1);
      }

      // Apply punctuation (basic implementation)
      if (this.settings.enablePunctuation && processed.length > 0 && !processed.match(/[.!?]$/)) {
        processed += '.';
      }

      return processed;
    } catch (error) {
      console.error('VoiceToTextService: Error processing text:', error);
      return text || '';
    }
  }

  private estimateConfidence(text: string, isFinal: boolean): number {
    try {
      if (!text || typeof text !== 'string') {
        return 0.5; // Default medium confidence for invalid input
      }

      // Simple confidence estimation based on text length and finality
      const baseConfidence = isFinal ? 0.85 : 0.70;
      const lengthBonus = Math.min(text.length * 0.01, 0.15);
      const result = Math.min(baseConfidence + lengthBonus, 1.0);
      
      return Math.max(result, 0.1); // Minimum confidence of 10%
    } catch (error) {
      console.error('VoiceToTextService: Error estimating confidence:', error);
      return 0.5;
    }
  }

  private calculateWordCount(text: string): number {
    try {
      if (!text || typeof text !== 'string') {
        return 0;
      }
      return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    } catch (error) {
      console.error('VoiceToTextService: Error calculating word count:', error);
      return 0;
    }
  }

  private calculateSessionMetrics(): VoiceSessionMetrics {
    try {
      const endTime = Date.now();
      const totalDuration = endTime - this.sessionMetrics.startTime;
      const averageConfidence = this.confidenceScores.length > 0
        ? this.confidenceScores.reduce((sum, score) => sum + score, 0) / this.confidenceScores.length
        : 0;

      return {
        ...this.sessionMetrics,
        endTime,
        totalDuration,
        averageConfidence: Math.round(averageConfidence * 100) / 100, // Round to 2 decimal places
      };
    } catch (error) {
      console.error('VoiceToTextService: Error calculating session metrics:', error);
      return {
        ...this.sessionMetrics,
        endTime: Date.now(),
        totalDuration: Date.now() - this.sessionMetrics.startTime,
        averageConfidence: 0
      };
    }
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
      // Enhanced analytics logging with error handling
      const safeParameters = {
        ...parameters,
        timestamp: Date.now(),
        platform: Platform.OS,
        service_version: '2.0.0'
      };
      
      // TODO: Replace with actual Firebase analytics when available
      // analytics().logEvent(eventName, safeParameters);
      console.log(`VoiceToTextService Analytics: ${eventName}`, safeParameters);
    } catch (error) {
      console.warn('VoiceToTextService: Failed to log analytics event:', error);
    }
  }

  /**
   * Get available languages for voice recognition with enhanced error handling
   */
  async getAvailableLanguages(): Promise<string[]> {
    return this.withRetry(async () => {
      try {
        const languages = await Voice.getSpeechRecognitionServices();
        
        if (Array.isArray(languages) && languages.length > 0) {
          console.log('VoiceToTextService: Retrieved languages from device:', languages);
          return languages;
        }
        
        // Fallback to supported languages if device query fails
        console.log('VoiceToTextService: Using fallback language list');
        return SUPPORTED_LANGUAGES;
      } catch (error) {
        console.warn('VoiceToTextService: Failed to get device languages, using fallback:', error);
        return SUPPORTED_LANGUAGES;
      }
    }, 'getAvailableLanguages', 2);
  }

  /**
   * Health check for voice service
   */
  async checkServiceHealth(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        return false;
      }
      
      // Check if Voice module is available
      const isAvailable = await Voice.isAvailable();
      const result = Boolean(isAvailable);
      console.log('VoiceToTextService: Service health check result:', result);
      return result;
    } catch (error) {
      console.warn('VoiceToTextService: Health check failed:', error);
      return false;
    }
  }

  /**
   * Cleanup and destroy voice service with enhanced cleanup
   */
  async destroy(): Promise<void> {
    return this.withRetry(async () => {
      try {
        console.log('VoiceToTextService: Destroying service...');
        
        if (this.isListening) {
          await this.cancelListening();
        }
        
        // Voice.destroy() will clean up event handlers automatically
        await Voice.destroy();
        
        this.isInitialized = false;
        this.currentSession = {};
        this.currentSessionId = '';
        
        console.log('VoiceToTextService: Service destroyed successfully');
        
        this.logAnalyticsEvent('voice_service_destroyed', {
          total_sessions: this.metrics.requestCount,
          success_rate: this.metrics.requestCount > 0 ? (this.metrics.successCount / this.metrics.requestCount) * 100 : 0
        });
      } catch (error) {
        console.error('VoiceToTextService: Failed to destroy service:', error);
        throw error;
      }
    }, 'destroy', 2);
  }

  /**
   * Get comprehensive service statistics
   */
  getServiceStatistics(): {
    metrics: VoiceServiceMetrics;
    currentSession: {
      isActive: boolean;
      sessionId: string | null;
      duration: number;
    };
    settings: VoiceSettings;
  } {
    const currentDuration = this.isListening 
      ? Date.now() - this.sessionMetrics.startTime 
      : 0;
    
    return {
      metrics: this.getServiceMetrics(),
      currentSession: {
        isActive: this.isListening,
        sessionId: this.getCurrentSessionId(),
        duration: currentDuration
      },
      settings: this.getSettings()
    };
  }
}

// Export singleton instance
export default VoiceToTextService.getInstance();
