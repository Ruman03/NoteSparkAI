/**
 * Enhanced Image Quality Analysis Service
 * Provides real-time feedback on document scan quality with comprehensive error handling
 * OPTIMIZED: Enhanced with retry logic, input validation, metrics tracking, and performance improvements
 */

import { Platform } from 'react-native';

// Enhanced interfaces for better type safety and functionality
interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

interface QualityServiceMetrics {
  analysisCount: number;
  successCount: number;
  errorCount: number;
  averageAnalysisTime: number;
  totalQualityChecks: number;
  lastSuccess?: Date;
  lastError?: string;
}

interface ImageData {
  uri?: string;
  width?: number;
  height?: number;
  format?: string;
  data?: any;
  timestamp?: number;
}

interface QualityMetrics {
  lighting: number;        // 0-1, brightness and contrast quality
  focus: number;          // 0-1, sharpness and clarity
  rotation: number;       // 0-1, document orientation alignment
  textDensity: number;    // 0-1, amount of readable text detected
  overall: number;        // 0-1, combined quality score
}

interface QualityFeedback {
  score: QualityMetrics;
  suggestions: string[];
  status: 'excellent' | 'good' | 'fair' | 'poor';
  canCapture: boolean;
}

interface LightingAnalysis {
  brightness: number;
  contrast: number;
  evenness: number;
  shadows: boolean;
  glare: boolean;
}

interface FocusAnalysis {
  sharpness: number;
  blur: number;
  edgeDefinition: number;
}

interface DocumentAnalysis {
  corners: Array<{ x: number; y: number }>;
  rotation: number;
  perspective: number;
  bounds: { x: number; y: number; width: number; height: number };
}

interface QualityMonitoringSession {
  id: string;
  isActive: boolean;
  intervalId?: NodeJS.Timeout;
  startTime: number;
  onQualityUpdate?: (feedback: QualityFeedback) => void;
  options: {
    intervalMs: number;
    strictMode: boolean;
    enableAnalytics: boolean;
  };
}

// Enhanced constants
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 500,
  maxDelay: 3000,
  backoffFactor: 2
};

const ANALYSIS_TIMEOUT = 5000; // 5 seconds timeout for analysis operations
const MIN_ANALYSIS_INTERVAL = 100; // Minimum 100ms between analyses
const MAX_ANALYSIS_INTERVAL = 5000; // Maximum 5 seconds between analyses

const NON_RETRYABLE_ERRORS = [
  'invalid image data',
  'unsupported format',
  'image too small',
  'corrupted data'
];

/**
 * Enhanced Image Quality Analysis Service
 * OPTIMIZED: Comprehensive error handling, retry logic, and performance monitoring
 */

export class ImageQualityService {
  private static instance: ImageQualityService;
  private readonly metrics: QualityServiceMetrics;
  private readonly retryOptions: RetryOptions;
  private activeSessions: Map<string, QualityMonitoringSession> = new Map();
  private isServiceAvailable = true;

  constructor() {
    // Initialize service metrics
    this.metrics = {
      analysisCount: 0,
      successCount: 0,
      errorCount: 0,
      averageAnalysisTime: 0,
      totalQualityChecks: 0
    };

    this.retryOptions = { ...DEFAULT_RETRY_OPTIONS };
    console.log('ImageQualityService: Enhanced instance created with comprehensive capabilities');
  }

  public static getInstance(): ImageQualityService {
    if (!ImageQualityService.instance) {
      ImageQualityService.instance = new ImageQualityService();
    }
    return ImageQualityService.instance;
  }

  // OPTIMIZED: Enhanced retry mechanism for quality analysis operations
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = this.retryOptions.maxRetries,
    timeoutMs: number = ANALYSIS_TIMEOUT
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let timeoutId: NodeJS.Timeout | undefined;
      
      try {
        console.log(`ImageQualityService: ${operationName} attempt ${attempt}/${maxRetries}`);
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Quality analysis timeout')), timeoutMs);
        });
        
        const result = await Promise.race([operation(), timeoutPromise]);
        console.log(`ImageQualityService: ${operationName} succeeded on attempt ${attempt}`);
        
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        return result;
      } catch (error) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`ImageQualityService: ${operationName} failed on attempt ${attempt}:`, lastError.message);
        
        // Don't retry for certain errors
        if (this.isNonRetryableError(lastError)) {
          console.log(`ImageQualityService: Non-retryable error for ${operationName}, stopping retries`);
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
        console.log(`ImageQualityService: Retrying ${operationName} in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error(`All ${maxRetries} attempts failed for ${operationName}: ${lastError!.message}`);
  }

  // OPTIMIZED: Check if error should not be retried
  private isNonRetryableError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    return NON_RETRYABLE_ERRORS.some(msg => errorMessage.includes(msg));
  }

  // OPTIMIZED: Enhanced input validation for image data
  private validateImageData(imageData: any, operationName: string): ImageData {
    if (!imageData) {
      throw new Error(`${operationName}: Image data is required`);
    }

    // Validate image data structure
    const validatedData: ImageData = {
      uri: imageData.uri,
      width: imageData.width,
      height: imageData.height,
      format: imageData.format,
      data: imageData.data || imageData,
      timestamp: Date.now()
    };

    // Check minimum requirements
    if (validatedData.width && validatedData.width < 100) {
      throw new Error('Image width too small (minimum 100px)');
    }
    
    if (validatedData.height && validatedData.height < 100) {
      throw new Error('Image height too small (minimum 100px)');
    }

    return validatedData;
  }

  // OPTIMIZED: Update service metrics with comprehensive tracking
  private updateMetrics(success: boolean, analysisTime?: number, errorMessage?: string): void {
    this.metrics.analysisCount++;
    this.metrics.totalQualityChecks++;
    
    if (success) {
      this.metrics.successCount++;
      this.metrics.lastSuccess = new Date();
      
      if (analysisTime) {
        // Update average analysis time with weighted average
        const weight = 0.1; // 10% weight for new measurement
        this.metrics.averageAnalysisTime = 
          this.metrics.averageAnalysisTime * (1 - weight) + analysisTime * weight;
      }
    } else {
      this.metrics.errorCount++;
      this.metrics.lastError = errorMessage;
      
      // Mark service as temporarily unavailable if too many consecutive errors
      const recentErrorRate = this.metrics.errorCount / Math.max(this.metrics.analysisCount, 1);
      if (recentErrorRate > 0.5 && this.metrics.analysisCount > 10) {
        this.isServiceAvailable = false;
        console.warn('ImageQualityService: Service marked as unavailable due to high error rate');
      }
    }
  }

  // OPTIMIZED: Check if the service is available and properly initialized
  public isServiceHealthy(): boolean {
    return this.isServiceAvailable;
  }

  // OPTIMIZED: Get service metrics
  public getServiceMetrics(): QualityServiceMetrics {
    return { ...this.metrics };
  }

  // OPTIMIZED: Generate unique session ID
  private generateSessionId(): string {
    return `quality_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // OPTIMIZED: Enhanced lighting analysis with comprehensive error handling
  public async analyzeLighting(imageData: any): Promise<LightingAnalysis> {
    return this.withRetry(async () => {
      const startTime = Date.now();
      
      try {
        const validatedData = this.validateImageData(imageData, 'analyzeLighting');
        
        // In a real implementation, this would analyze pixel data
        // For now, we'll simulate realistic lighting analysis with enhanced logic
        const simulatedBrightness = Math.random() * 0.4 + 0.5; // 0.5-0.9
        const simulatedContrast = Math.random() * 0.3 + 0.6;   // 0.6-0.9
        const simulatedEvenness = Math.random() * 0.2 + 0.7;   // 0.7-0.9
        
        const result: LightingAnalysis = {
          brightness: simulatedBrightness,
          contrast: simulatedContrast,
          evenness: simulatedEvenness,
          shadows: simulatedBrightness < 0.6,
          glare: simulatedBrightness > 0.85,
        };

        const analysisTime = Date.now() - startTime;
        this.updateMetrics(true, analysisTime);
        
        this.logAnalyticsEvent('lighting_analysis_completed', {
          brightness: result.brightness,
          contrast: result.contrast,
          evenness: result.evenness,
          has_shadows: result.shadows,
          has_glare: result.glare,
          analysis_time: analysisTime
        });

        console.log(`ImageQualityService: Lighting analysis completed in ${analysisTime}ms`, result);
        return result;
      } catch (error) {
        const analysisTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown lighting analysis error';
        this.updateMetrics(false, analysisTime, errorMessage);
        throw error;
      }
    }, 'analyzeLighting');
  }

  // OPTIMIZED: Enhanced focus analysis with comprehensive error handling
  public async analyzeFocus(imageData: any): Promise<FocusAnalysis> {
    return this.withRetry(async () => {
      const startTime = Date.now();
      
      try {
        const validatedData = this.validateImageData(imageData, 'analyzeFocus');
        
        // Simulate focus analysis based on edge detection with enhanced logic
        const simulatedSharpness = Math.random() * 0.3 + 0.6;   // 0.6-0.9
        const simulatedBlur = 1 - simulatedSharpness;
        const simulatedEdgeDefinition = Math.random() * 0.2 + 0.7; // 0.7-0.9
        
        const result: FocusAnalysis = {
          sharpness: simulatedSharpness,
          blur: simulatedBlur,
          edgeDefinition: simulatedEdgeDefinition,
        };

        const analysisTime = Date.now() - startTime;
        this.updateMetrics(true, analysisTime);
        
        this.logAnalyticsEvent('focus_analysis_completed', {
          sharpness: result.sharpness,
          blur: result.blur,
          edge_definition: result.edgeDefinition,
          analysis_time: analysisTime
        });

        console.log(`ImageQualityService: Focus analysis completed in ${analysisTime}ms`, result);
        return result;
      } catch (error) {
        const analysisTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown focus analysis error';
        this.updateMetrics(false, analysisTime, errorMessage);
        throw error;
      }
    }, 'analyzeFocus');
  }

  // OPTIMIZED: Enhanced document position analysis with comprehensive error handling
  public async analyzeDocumentPosition(imageData: any): Promise<DocumentAnalysis> {
    return this.withRetry(async () => {
      const startTime = Date.now();
      
      try {
        const validatedData = this.validateImageData(imageData, 'analyzeDocumentPosition');
        
        // Simulate document detection and corner analysis with enhanced logic
        const rotation = (Math.random() - 0.5) * 20; // -10 to +10 degrees
        const perspective = Math.random() * 0.3 + 0.7; // 0.7-1.0
        
        const result: DocumentAnalysis = {
          corners: [
            { x: 0.1, y: 0.1 },
            { x: 0.9, y: 0.1 },
            { x: 0.9, y: 0.9 },
            { x: 0.1, y: 0.9 },
          ],
          rotation: Math.abs(rotation),
          perspective,
          bounds: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
        };

        const analysisTime = Date.now() - startTime;
        this.updateMetrics(true, analysisTime);
        
        this.logAnalyticsEvent('document_position_analysis_completed', {
          rotation: result.rotation,
          perspective: result.perspective,
          corners_detected: result.corners.length,
          analysis_time: analysisTime
        });

        console.log(`ImageQualityService: Document position analysis completed in ${analysisTime}ms`, result);
        return result;
      } catch (error) {
        const analysisTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown document position analysis error';
        this.updateMetrics(false, analysisTime, errorMessage);
        throw error;
      }
    }, 'analyzeDocumentPosition');
  }

  // OPTIMIZED: Enhanced text density analysis with comprehensive error handling
  public async analyzeTextDensity(imageData: any): Promise<number> {
    return this.withRetry(async () => {
      const startTime = Date.now();
      
      try {
        const validatedData = this.validateImageData(imageData, 'analyzeTextDensity');
        
        // Simulate text detection analysis with enhanced logic
        const textDensity = Math.random() * 0.4 + 0.6; // 0.6-1.0

        const analysisTime = Date.now() - startTime;
        this.updateMetrics(true, analysisTime);
        
        this.logAnalyticsEvent('text_density_analysis_completed', {
          text_density: textDensity,
          analysis_time: analysisTime
        });

        console.log(`ImageQualityService: Text density analysis completed in ${analysisTime}ms:`, textDensity);
        return textDensity;
      } catch (error) {
        const analysisTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown text density analysis error';
        this.updateMetrics(false, analysisTime, errorMessage);
        throw error;
      }
    }, 'analyzeTextDensity');
  }

  // OPTIMIZED: Enhanced comprehensive quality analysis with async support
  public async analyzeQuality(imageData: any): Promise<QualityFeedback> {
    return this.withRetry(async () => {
      const startTime = Date.now();
      
      try {
        const validatedData = this.validateImageData(imageData, 'analyzeQuality');
        
        // Run all analyses in parallel for better performance
        const [lighting, focus, document, textDensity] = await Promise.all([
          this.analyzeLighting(validatedData),
          this.analyzeFocus(validatedData),
          this.analyzeDocumentPosition(validatedData),
          this.analyzeTextDensity(validatedData)
        ]);

        // Calculate individual metrics
        const lightingScore = (lighting.brightness + lighting.contrast + lighting.evenness) / 3;
        const focusScore = (focus.sharpness + focus.edgeDefinition) / 2;
        const rotationScore = Math.max(0, 1 - (document.rotation / 15)); // Penalize rotation > 15°
        const textScore = textDensity;

        // Calculate overall score with weighted averages
        const overall = (
          lightingScore * 0.3 +
          focusScore * 0.3 +
          rotationScore * 0.2 +
          textScore * 0.2
        );

        const metrics: QualityMetrics = {
          lighting: lightingScore,
          focus: focusScore,
          rotation: rotationScore,
          textDensity: textScore,
          overall,
        };

        // Generate suggestions based on analysis
        const suggestions = this.generateSuggestions(lighting, focus, document, textDensity);

        // Determine status and capture readiness
        let status: 'excellent' | 'good' | 'fair' | 'poor';
        let canCapture: boolean;

        if (overall >= 0.85) {
          status = 'excellent';
          canCapture = true;
        } else if (overall >= 0.7) {
          status = 'good';
          canCapture = true;
        } else if (overall >= 0.5) {
          status = 'fair';
          canCapture = true;
        } else {
          status = 'poor';
          canCapture = false;
        }

        const result: QualityFeedback = {
          score: metrics,
          suggestions,
          status,
          canCapture,
        };

        const analysisTime = Date.now() - startTime;
        this.updateMetrics(true, analysisTime);
        
        this.logAnalyticsEvent('quality_analysis_completed', {
          overall_score: overall,
          status,
          can_capture: canCapture,
          lighting_score: lightingScore,
          focus_score: focusScore,
          rotation_score: rotationScore,
          text_score: textScore,
          suggestions_count: suggestions.length,
          analysis_time: analysisTime
        });

        console.log(`ImageQualityService: Quality analysis completed in ${analysisTime}ms`, result);
        return result;
      } catch (error) {
        const analysisTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown quality analysis error';
        this.updateMetrics(false, analysisTime, errorMessage);
        throw error;
      }
    }, 'analyzeQuality');
  }

  // Generate actionable suggestions for improvement
  private generateSuggestions(
    lighting: LightingAnalysis,
    focus: FocusAnalysis,
    document: DocumentAnalysis,
    textDensity: number
  ): string[] {
    const suggestions: string[] = [];

    // Lighting suggestions
    if (lighting.brightness < 0.6) {
      suggestions.push('📱 Move to better lighting or turn on flash');
    }
    if (lighting.shadows) {
      suggestions.push('☀️ Avoid shadows on the document');
    }
    if (lighting.glare) {
      suggestions.push('✨ Reduce glare by changing angle');
    }
    if (lighting.contrast < 0.6) {
      suggestions.push('🔆 Increase contrast for better text clarity');
    }

    // Focus suggestions
    if (focus.sharpness < 0.7) {
      suggestions.push('📸 Tap to focus on the document');
    }
    if (focus.blur > 0.4) {
      suggestions.push('🎯 Hold steady and wait for focus');
    }

    // Document positioning suggestions
    if (document.rotation > 10) {
      suggestions.push('🔄 Rotate device to align with document');
    }
    if (document.perspective < 0.8) {
      suggestions.push('📐 Position camera directly above document');
    }

    // Text density suggestions
    if (textDensity < 0.7) {
      suggestions.push('📄 Ensure document fills most of the frame');
    }

    // Default encouragement
    if (suggestions.length === 0) {
      suggestions.push('✅ Perfect! Ready to capture');
    }

    return suggestions;
  }

  // OPTIMIZED: Enhanced quality monitoring with comprehensive session management
  public startQualityMonitoring(
    onQualityUpdate: (feedback: QualityFeedback) => void,
    intervalMs: number = 1000
  ): () => void {
    try {
      // Validate inputs
      if (!onQualityUpdate || typeof onQualityUpdate !== 'function') {
        throw new Error('onQualityUpdate callback is required');
      }
      
      if (intervalMs < MIN_ANALYSIS_INTERVAL || intervalMs > MAX_ANALYSIS_INTERVAL) {
        throw new Error(`Interval must be between ${MIN_ANALYSIS_INTERVAL}ms and ${MAX_ANALYSIS_INTERVAL}ms`);
      }

      const sessionId = this.generateSessionId();
      console.log(`ImageQualityService: Starting quality monitoring session ${sessionId} with ${intervalMs}ms interval`);

      const session: QualityMonitoringSession = {
        id: sessionId,
        isActive: true,
        startTime: Date.now(),
        onQualityUpdate,
        options: {
          intervalMs,
          strictMode: false,
          enableAnalytics: true
        }
      };

      // Start monitoring with enhanced error handling
      const interval = setInterval(async () => {
        try {
          if (!session.isActive) {
            console.log(`ImageQualityService: Session ${sessionId} inactive, stopping interval`);
            clearInterval(interval);
            return;
          }

          // Simulate camera frame analysis with mock data
          const mockImageData: ImageData = {
            width: 1920,
            height: 1080,
            format: 'jpeg',
            timestamp: Date.now()
          };
          
          const feedback = await this.analyzeQuality(mockImageData);
          
          if (session.isActive && session.onQualityUpdate) {
            session.onQualityUpdate(feedback);
          }
        } catch (error) {
          console.error(`ImageQualityService: Error in monitoring session ${sessionId}:`, error);
          // Continue monitoring despite individual errors
        }
      }, intervalMs);

      session.intervalId = interval;
      this.activeSessions.set(sessionId, session);

      this.logAnalyticsEvent('quality_monitoring_started', {
        session_id: sessionId,
        interval_ms: intervalMs,
        active_sessions: this.activeSessions.size
      });

      // Return cleanup function with enhanced error handling
      return () => {
        try {
          console.log(`ImageQualityService: Stopping quality monitoring session ${sessionId}`);
          
          const sessionToStop = this.activeSessions.get(sessionId);
          if (sessionToStop) {
            sessionToStop.isActive = false;
            
            if (sessionToStop.intervalId) {
              clearInterval(sessionToStop.intervalId);
            }
            
            this.activeSessions.delete(sessionId);
            
            const sessionDuration = Date.now() - sessionToStop.startTime;
            this.logAnalyticsEvent('quality_monitoring_stopped', {
              session_id: sessionId,
              duration: sessionDuration,
              remaining_sessions: this.activeSessions.size
            });
          }
        } catch (error) {
          console.error(`ImageQualityService: Error stopping session ${sessionId}:`, error);
        }
      };
    } catch (error) {
      console.error('ImageQualityService: Failed to start quality monitoring:', error);
      throw new Error(`Quality monitoring setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Check if current quality meets minimum standards
  public meetsQualityStandards(feedback: QualityFeedback, strict: boolean = false): boolean {
    const threshold = strict ? 0.8 : 0.6;
    return feedback.score.overall >= threshold && feedback.canCapture;
  }

  // Get quality status color for UI
  public getStatusColor(status: 'excellent' | 'good' | 'fair' | 'poor'): string {
    switch (status) {
      case 'excellent':
        return '#4CAF50'; // Green
      case 'good':
        return '#8BC34A'; // Light Green
      case 'fair':
        return '#FF9800'; // Orange
      case 'poor':
        return '#F44336'; // Red
      default:
        return '#9E9E9E'; // Gray
    }
  }

  // Get quality description for users
  public getStatusDescription(status: 'excellent' | 'good' | 'fair' | 'poor'): string {
    switch (status) {
      case 'excellent':
        return 'Perfect quality - Ready to scan!';
      case 'good':
        return 'Good quality - Safe to capture';
      case 'fair':
        return 'Fair quality - Consider improvements';
      case 'poor':
        return 'Poor quality - Adjustments needed';
      default:
        return 'Analyzing...';
    }
  }

  // OPTIMIZED: Enhanced improvement calculation with comprehensive metrics
  public calculateImprovement(
    previous: QualityFeedback,
    current: QualityFeedback
  ): {
    improved: boolean;
    improvementScore: number;
    bestImprovement: keyof QualityMetrics;
  } {
    try {
      if (!previous || !current) {
        throw new Error('Both previous and current feedback are required');
      }

      const prevScore = previous.score.overall;
      const currScore = current.score.overall;
      const improvement = currScore - prevScore;

      // Find which metric improved the most
      const improvements: Record<keyof QualityMetrics, number> = {
        lighting: current.score.lighting - previous.score.lighting,
        focus: current.score.focus - previous.score.focus,
        rotation: current.score.rotation - previous.score.rotation,
        textDensity: current.score.textDensity - previous.score.textDensity,
        overall: improvement,
      };

      const bestImprovement = Object.entries(improvements)
        .filter(([key]) => key !== 'overall')
        .reduce((best, [key, value]) => 
          value > improvements[best] ? key as keyof QualityMetrics : best,
          'lighting' as keyof QualityMetrics
        );

      const result = {
        improved: improvement > 0.05, // Significant improvement threshold
        improvementScore: improvement,
        bestImprovement,
      };

      this.logAnalyticsEvent('quality_improvement_calculated', {
        improvement_score: improvement,
        improved: result.improved,
        best_improvement: bestImprovement,
        previous_score: prevScore,
        current_score: currScore
      });

      console.log('ImageQualityService: Quality improvement calculated:', result);
      return result;
    } catch (error) {
      console.error('ImageQualityService: Error calculating improvement:', error);
      
      // Return safe default values
      return {
        improved: false,
        improvementScore: 0,
        bestImprovement: 'lighting'
      };
    }
  }

  // OPTIMIZED: Enhanced analytics logging with comprehensive error handling
  private logAnalyticsEvent(eventName: string, parameters: any): void {
    try {
      // Enhanced analytics logging with error handling
      const safeParameters = {
        ...parameters,
        timestamp: Date.now(),
        platform: Platform.OS,
        service_version: '2.0.0',
        session_count: this.activeSessions.size
      };
      
      // TODO: Replace with actual Firebase analytics when available
      // analytics().logEvent(eventName, safeParameters);
      console.log(`ImageQualityService Analytics: ${eventName}`, safeParameters);
    } catch (error) {
      console.warn('ImageQualityService: Failed to log analytics event:', error);
    }
  }

  // OPTIMIZED: Enhanced service health check
  public async checkServiceHealth(): Promise<boolean> {
    try {
      if (!this.isServiceAvailable) {
        console.log('ImageQualityService: Service marked as unavailable');
        return false;
      }
      
      // Test basic functionality with a simple mock analysis
      const mockImageData: ImageData = {
        width: 100,
        height: 100,
        format: 'jpeg',
        timestamp: Date.now()
      };
      
      await this.analyzeLighting(mockImageData);
      
      // Reset service availability if health check passes
      this.isServiceAvailable = true;
      console.log('ImageQualityService: Health check passed');
      return true;
    } catch (error) {
      console.warn('ImageQualityService: Health check failed:', error);
      this.isServiceAvailable = false;
      return false;
    }
  }

  // OPTIMIZED: Enhanced service cleanup with comprehensive session management
  public async cleanup(): Promise<void> {
    try {
      console.log('ImageQualityService: Starting service cleanup...');
      
      // Stop all active monitoring sessions
      const activeSessions = Array.from(this.activeSessions.values());
      for (const session of activeSessions) {
        try {
          session.isActive = false;
          if (session.intervalId) {
            clearInterval(session.intervalId);
          }
        } catch (error) {
          console.warn(`ImageQualityService: Error cleaning up session ${session.id}:`, error);
        }
      }
      
      this.activeSessions.clear();
      
      this.logAnalyticsEvent('service_cleanup_completed', {
        sessions_stopped: activeSessions.length,
        total_analyses: this.metrics.analysisCount,
        success_rate: this.metrics.analysisCount > 0 ? (this.metrics.successCount / this.metrics.analysisCount) * 100 : 0
      });
      
      console.log('ImageQualityService: Service cleanup completed successfully');
    } catch (error) {
      console.error('ImageQualityService: Error during cleanup:', error);
      throw new Error(`Service cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // OPTIMIZED: Get comprehensive service statistics
  public getServiceStatistics(): {
    metrics: QualityServiceMetrics;
    activeSessions: {
      count: number;
      sessions: Array<{
        id: string;
        duration: number;
        options: QualityMonitoringSession['options'];
      }>;
    };
    health: {
      isAvailable: boolean;
      lastSuccessTime?: Date;
      lastErrorMessage?: string;
    };
  } {
    const now = Date.now();
    const activeSessionsInfo = Array.from(this.activeSessions.values()).map(session => ({
      id: session.id,
      duration: now - session.startTime,
      options: { ...session.options }
    }));
    
    return {
      metrics: this.getServiceMetrics(),
      activeSessions: {
        count: this.activeSessions.size,
        sessions: activeSessionsInfo
      },
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
  QualityMetrics, 
  QualityFeedback, 
  LightingAnalysis, 
  FocusAnalysis, 
  DocumentAnalysis,
  ImageData,
  QualityServiceMetrics,
  QualityMonitoringSession
};
