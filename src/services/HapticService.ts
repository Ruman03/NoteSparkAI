/**
 * Enhanced Haptic Feedback Service
 * Centralized haptic feedback for premium user interactions with comprehensive error handling
 * OPTIMIZED: Enhanced with retry logic, input validation, metrics tracking, and performance improvements
 */

import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { Platform } from 'react-native';
import { HAPTIC_TYPES, FEATURE_FLAGS } from '../constants/app';

// Enhanced interfaces for better type safety and functionality
interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

interface HapticServiceMetrics {
  totalTriggers: number;
  successCount: number;
  errorCount: number;
  typeUsageCount: Record<string, number>;
  lastSuccess?: Date;
  lastError?: string;
  averageResponseTime: number;
}

interface HapticCapabilities {
  isSupported: boolean;
  supportedTypes: string[];
  platform: string;
  hasVibrateFallback: boolean;
}

interface HapticSession {
  id: string;
  type: string;
  timestamp: number;
  duration?: number;
  success: boolean;
  errorMessage?: string;
}

interface HapticSettings {
  enabled: boolean;
  intensity: 'light' | 'medium' | 'heavy';
  enableVibrateFallback: boolean;
  ignoreSystemSettings: boolean;
  enableAnalytics: boolean;
  timeout: number;
}

// Enhanced constants
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 2,
  baseDelay: 100,
  maxDelay: 500,
  backoffFactor: 2
};

const HAPTIC_TIMEOUT = 1000; // 1 second timeout for haptic operations
const MAX_HAPTIC_FREQUENCY = 10; // Maximum 10 haptic events per second

const NON_RETRYABLE_ERRORS = [
  'not supported',
  'permission denied',
  'disabled by user',
  'unavailable'
];

/**
 * Enhanced Haptic Feedback Service
 * OPTIMIZED: Comprehensive error handling, retry logic, and performance monitoring
 */

export class HapticService {
  private static instance: HapticService;
  private readonly metrics: HapticServiceMetrics;
  private readonly retryOptions: RetryOptions;
  private recentSessions: HapticSession[] = [];
  private lastTriggerTime = 0;
  private isServiceAvailable = true;
  private capabilities: HapticCapabilities | null = null;

  private settings: HapticSettings = {
    enabled: FEATURE_FLAGS.HAPTIC_FEEDBACK_ENABLED,
    intensity: 'medium',
    enableVibrateFallback: true,
    ignoreSystemSettings: false,
    enableAnalytics: true,
    timeout: HAPTIC_TIMEOUT
  };

  private constructor() {
    // Initialize service metrics
    this.metrics = {
      totalTriggers: 0,
      successCount: 0,
      errorCount: 0,
      typeUsageCount: {},
      averageResponseTime: 0
    };

    this.retryOptions = { ...DEFAULT_RETRY_OPTIONS };
    console.log('HapticService: Enhanced instance created with comprehensive capabilities');
    
    this.initializeCapabilities();
  }

  static getInstance(): HapticService {
    if (!HapticService.instance) {
      HapticService.instance = new HapticService();
    }
    return HapticService.instance;
  }

  // OPTIMIZED: Initialize haptic capabilities detection
  private async initializeCapabilities(): Promise<void> {
    try {
      const isSupported = Platform.OS === 'ios' || Platform.OS === 'android';
      const supportedTypes = Object.values(HAPTIC_TYPES);
      
      this.capabilities = {
        isSupported,
        supportedTypes,
        platform: Platform.OS,
        hasVibrateFallback: true
      };

      console.log('HapticService: Capabilities initialized:', this.capabilities);
      
      this.logAnalyticsEvent('haptic_capabilities_detected', {
        is_supported: isSupported,
        platform: Platform.OS,
        supported_types_count: supportedTypes.length
      });
    } catch (error) {
      console.error('HapticService: Failed to initialize capabilities:', error);
      this.capabilities = {
        isSupported: false,
        supportedTypes: [],
        platform: Platform.OS,
        hasVibrateFallback: false
      };
    }
  }

  // OPTIMIZED: Enhanced retry mechanism for haptic operations
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = this.retryOptions.maxRetries,
    timeoutMs: number = this.settings.timeout
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let timeoutId: NodeJS.Timeout | undefined;
      
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Haptic operation timeout')), timeoutMs);
          (timeoutId as any).unref?.();
        });
        
        const result = await Promise.race([operation(), timeoutPromise]);
        
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        return result;
      } catch (error) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry for certain errors
        if (this.isNonRetryableError(lastError)) {
          break;
        }
        
        if (attempt === maxRetries) {
          break;
        }
        
        // Progressive delay between retries
        const delay = Math.min(
          this.retryOptions.baseDelay * Math.pow(this.retryOptions.backoffFactor, attempt - 1),
          this.retryOptions.maxDelay
        );
  await new Promise(resolve => { const t = setTimeout(resolve, delay); (t as any).unref?.(); });
      }
    }
    
    throw lastError!;
  }

  // OPTIMIZED: Check if error should not be retried
  private isNonRetryableError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    return NON_RETRYABLE_ERRORS.some(msg => errorMessage.includes(msg));
  }

  // OPTIMIZED: Enhanced input validation for haptic operations
  private validateHapticType(type: string, operationName: string): void {
    if (!type || typeof type !== 'string') {
      throw new Error(`${operationName}: Haptic type is required and must be a string`);
    }

    if (!this.capabilities?.supportedTypes.includes(type)) {
      throw new Error(`${operationName}: Unsupported haptic type: ${type}`);
    }
  }

  // OPTIMIZED: Rate limiting for haptic feedback
  private checkRateLimit(): boolean {
    const now = Date.now();
    if (now - this.lastTriggerTime < (1000 / MAX_HAPTIC_FREQUENCY)) {
      console.warn('HapticService: Rate limit exceeded, skipping haptic feedback');
      return false;
    }
    this.lastTriggerTime = now;
    return true;
  }

  // OPTIMIZED: Update service metrics with comprehensive tracking
  private updateMetrics(success: boolean, type: string, responseTime?: number, errorMessage?: string): void {
    this.metrics.totalTriggers++;
    
    if (success) {
      this.metrics.successCount++;
      this.metrics.lastSuccess = new Date();
      
      // Track usage by type
      this.metrics.typeUsageCount[type] = (this.metrics.typeUsageCount[type] || 0) + 1;
      
      if (responseTime) {
        // Update average response time with weighted average
        const weight = 0.1;
        this.metrics.averageResponseTime = 
          this.metrics.averageResponseTime * (1 - weight) + responseTime * weight;
      }
    } else {
      this.metrics.errorCount++;
      this.metrics.lastError = errorMessage;
      
      // Mark service as temporarily unavailable if too many consecutive errors
      const recentErrorRate = this.metrics.errorCount / Math.max(this.metrics.totalTriggers, 1);
      if (recentErrorRate > 0.5 && this.metrics.totalTriggers > 20) {
        this.isServiceAvailable = false;
        console.warn('HapticService: Service marked as unavailable due to high error rate');
      }
    }
  }

  // OPTIMIZED: Generate unique session ID
  private generateSessionId(): string {
    return `haptic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // OPTIMIZED: Check if the service is available and properly initialized
  public isServiceHealthy(): boolean {
    return this.isServiceAvailable && (this.capabilities?.isSupported ?? false);
  }

  // OPTIMIZED: Get service metrics
  public getServiceMetrics(): HapticServiceMetrics {
    return { ...this.metrics };
  }

  // OPTIMIZED: Get haptic capabilities
  public getCapabilities(): HapticCapabilities | null {
    return this.capabilities ? { ...this.capabilities } : null;
  }

  // OPTIMIZED: Enhanced enable/disable haptic feedback with validation
  public setEnabled(enabled: boolean): void {
    try {
      if (typeof enabled !== 'boolean') {
        throw new Error('Enabled parameter must be a boolean');
      }

      const oldValue = this.settings.enabled;
      this.settings.enabled = enabled;
      
      console.log(`HapticService: Haptic feedback ${enabled ? 'enabled' : 'disabled'}`);
      
      this.logAnalyticsEvent('haptic_settings_changed', {
        setting: 'enabled',
        old_value: oldValue,
        new_value: enabled
      });
    } catch (error) {
      console.error('HapticService: Failed to set enabled state:', error);
      throw new Error(`Settings update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // OPTIMIZED: Enhanced trigger with comprehensive error handling and session tracking
  private async trigger(type: string): Promise<void> {
    return this.withRetry(async () => {
      const startTime = Date.now();
      const sessionId = this.generateSessionId();
      
      try {
        // Validate service availability
        if (!this.settings.enabled) {
          console.log('HapticService: Haptic feedback is disabled, skipping trigger');
          return;
        }

        if (!this.isServiceHealthy()) {
          console.warn('HapticService: Service not healthy, skipping trigger');
          return;
        }

        // Rate limiting check
        if (!this.checkRateLimit()) {
          return;
        }

        // Validate haptic type
        this.validateHapticType(type, 'trigger');

        // Only trigger on supported platforms
        if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
          console.log(`HapticService: Platform ${Platform.OS} not supported for haptic feedback`);
          return;
        }

        console.log(`HapticService: Triggering haptic feedback - Session: ${sessionId}, Type: ${type}`);

        const options = {
          enableVibrateFallback: this.settings.enableVibrateFallback,
          ignoreAndroidSystemSettings: this.settings.ignoreSystemSettings,
        };

        // Create session record
        const session: HapticSession = {
          id: sessionId,
          type,
          timestamp: startTime,
          success: false
        };

        // Trigger haptic feedback
        await new Promise<void>((resolve, reject) => {
          try {
            ReactNativeHapticFeedback.trigger(type as any, options);
            resolve();
          } catch (error) {
            reject(error);
          }
        });

        const responseTime = Date.now() - startTime;
        session.success = true;
        session.duration = responseTime;

        // Update metrics and session tracking
        this.updateMetrics(true, type, responseTime);
        this.recentSessions.push(session);
        
        // Keep only recent sessions (last 100)
        if (this.recentSessions.length > 100) {
          this.recentSessions = this.recentSessions.slice(-100);
        }

        this.logAnalyticsEvent('haptic_triggered', {
          session_id: sessionId,
          type,
          response_time: responseTime,
          platform: Platform.OS
        });

        console.log(`HapticService: Haptic feedback triggered successfully - Session: ${sessionId}, Response time: ${responseTime}ms`);
      } catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown haptic error';
        
        // Update session with error
        const session: HapticSession = {
          id: sessionId,
          type,
          timestamp: startTime,
          duration: responseTime,
          success: false,
          errorMessage
        };
        this.recentSessions.push(session);

        this.updateMetrics(false, type, responseTime, errorMessage);
        
        this.logAnalyticsEvent('haptic_error', {
          session_id: sessionId,
          type,
          error_message: errorMessage,
          response_time: responseTime
        });

        console.error(`HapticService: Haptic feedback failed - Session: ${sessionId}:`, error);
        throw error;
      }
    }, `trigger-${type}`, 1); // Reduced retries for haptic feedback
  }

  // OPTIMIZED: Enhanced haptic feedback methods with async support and error handling
  async light(): Promise<void> {
    await this.trigger(HAPTIC_TYPES.LIGHT);
  }

  async medium(): Promise<void> {
    await this.trigger(HAPTIC_TYPES.MEDIUM);
  }

  async heavy(): Promise<void> {
    await this.trigger(HAPTIC_TYPES.HEAVY);
  }

  async selection(): Promise<void> {
    await this.trigger(HAPTIC_TYPES.SELECTION);
  }

  async success(): Promise<void> {
    await this.trigger(HAPTIC_TYPES.SUCCESS);
  }

  async warning(): Promise<void> {
    await this.trigger(HAPTIC_TYPES.WARNING);
  }

  async error(): Promise<void> {
    await this.trigger(HAPTIC_TYPES.ERROR);
  }

  // OPTIMIZED: Enhanced convenience methods for common UI interactions with better error handling
  async buttonPress(): Promise<void> {
    await this.medium();
  }

  async tabPress(): Promise<void> {
    await this.light();
  }

  async deleteAction(): Promise<void> {
    await this.heavy();
  }

  async saveAction(): Promise<void> {
    await this.success();
  }

  async scanComplete(): Promise<void> {
    await this.success();
  }

  async aiProcessingComplete(): Promise<void> {
    await this.success();
  }

  async navigationTransition(): Promise<void> {
    await this.light();
  }

  async swipeAction(): Promise<void> {
    await this.selection();
  }

  async longPress(): Promise<void> {
    await this.medium();
  }

  async pullToRefresh(): Promise<void> {
    await this.light();
  }

  async errorOccurred(): Promise<void> {
    await this.error();
  }

  async warningAction(): Promise<void> {
    await this.warning();
  }

  // OPTIMIZED: Enhanced analytics logging with comprehensive error handling
  private logAnalyticsEvent(eventName: string, parameters: any): void {
    try {
      if (!this.settings.enableAnalytics) {
        return;
      }

      // Enhanced analytics logging with error handling
      const safeParameters = {
        ...parameters,
        timestamp: Date.now(),
        platform: Platform.OS,
        service_version: '2.0.0',
        settings: {
          enabled: this.settings.enabled,
          intensity: this.settings.intensity
        }
      };
      
      // TODO: Replace with actual Firebase analytics when available
      // analytics().logEvent(eventName, safeParameters);
      console.log(`HapticService Analytics: ${eventName}`, safeParameters);
    } catch (error) {
      console.warn('HapticService: Failed to log analytics event:', error);
    }
  }

  // OPTIMIZED: Enhanced service health check
  public async checkServiceHealth(): Promise<boolean> {
    try {
      if (!this.isServiceAvailable) {
        console.log('HapticService: Service marked as unavailable');
        return false;
      }
      
      // Check platform support
      if (!this.capabilities?.isSupported) {
        console.log('HapticService: Platform not supported for haptic feedback');
        return false;
      }
      
      // Test basic functionality with a light haptic
      try {
        await this.trigger(HAPTIC_TYPES.LIGHT);
        
        // Reset service availability if health check passes
        this.isServiceAvailable = true;
        console.log('HapticService: Health check passed');
        return true;
      } catch (error) {
        console.warn('HapticService: Health check test trigger failed:', error);
        return false;
      }
    } catch (error) {
      console.warn('HapticService: Health check failed:', error);
      this.isServiceAvailable = false;
      return false;
    }
  }

  // OPTIMIZED: Update service settings with validation
  public updateSettings(newSettings: Partial<HapticSettings>): void {
    try {
      const oldSettings = { ...this.settings };
      
      // Validate new settings
      if (newSettings.intensity !== undefined) {
        const validIntensities = ['light', 'medium', 'heavy'];
        if (!validIntensities.includes(newSettings.intensity)) {
          throw new Error(`Invalid intensity. Must be one of: ${validIntensities.join(', ')}`);
        }
      }
      
      if (newSettings.timeout !== undefined) {
        if (newSettings.timeout < 100 || newSettings.timeout > 5000) {
          throw new Error('Timeout must be between 100ms and 5 seconds');
        }
      }

      this.settings = { ...this.settings, ...newSettings };
      
      console.log('HapticService: Settings updated successfully', this.settings);
      
      // Log settings changes for each modified property
      Object.keys(newSettings).forEach(key => {
        this.logAnalyticsEvent('haptic_settings_changed', {
          setting: key,
          old_value: oldSettings[key as keyof HapticSettings],
          new_value: newSettings[key as keyof HapticSettings]
        });
      });
    } catch (error) {
      console.error('HapticService: Failed to update settings:', error);
      throw new Error(`Settings update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // OPTIMIZED: Get current settings (immutable copy)
  public getSettings(): HapticSettings {
    return { ...this.settings };
  }

  // OPTIMIZED: Enhanced service cleanup with comprehensive session management
  public async cleanup(): Promise<void> {
    try {
      console.log('HapticService: Starting service cleanup...');
      
      // Clear recent sessions
      const sessionCount = this.recentSessions.length;
      this.recentSessions = [];
      
      this.logAnalyticsEvent('service_cleanup_completed', {
        sessions_cleared: sessionCount,
        total_triggers: this.metrics.totalTriggers,
        success_rate: this.metrics.totalTriggers > 0 ? (this.metrics.successCount / this.metrics.totalTriggers) * 100 : 0
      });
      
      console.log('HapticService: Service cleanup completed successfully');
    } catch (error) {
      console.error('HapticService: Error during cleanup:', error);
      throw new Error(`Service cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // OPTIMIZED: Get comprehensive service statistics
  public getServiceStatistics(): {
    metrics: HapticServiceMetrics;
    recentSessions: {
      count: number;
      sessions: HapticSession[];
    };
    capabilities: HapticCapabilities | null;
    settings: HapticSettings;
    health: {
      isAvailable: boolean;
      lastSuccessTime?: Date;
      lastErrorMessage?: string;
    };
  } {
    return {
      metrics: this.getServiceMetrics(),
      recentSessions: {
        count: this.recentSessions.length,
        sessions: [...this.recentSessions] // Create copy
      },
      capabilities: this.getCapabilities(),
      settings: this.getSettings(),
      health: {
        isAvailable: this.isServiceAvailable,
        lastSuccessTime: this.metrics.lastSuccess,
        lastErrorMessage: this.metrics.lastError
      }
    };
  }
}

// Export enhanced types for better integration
export type { 
  HapticServiceMetrics,
  HapticCapabilities,
  HapticSession,
  HapticSettings,
  RetryOptions
};

// Export singleton instance
export const hapticService = HapticService.getInstance();

// OPTIMIZED: Export individual async methods for easier imports
export const {
  light,
  medium,
  heavy,
  selection,
  success,
  warning,
  error,
  buttonPress,
  tabPress,
  deleteAction,
  saveAction,
  scanComplete,
  aiProcessingComplete,
  navigationTransition,
  swipeAction,
  longPress,
  pullToRefresh,
  errorOccurred,
  warningAction,
} = hapticService;
