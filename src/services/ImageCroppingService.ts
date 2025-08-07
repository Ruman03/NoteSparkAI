/**
 * Enhanced Image Cropping Service
 * Provides image cropping functionality for document scanning with comprehensive error handling
 * OPTIMIZED: Enhanced with retry logic, input validation, metrics tracking, and performance improvements
 */

import ImageCropPicker, { ImageOrVideo } from 'react-native-image-crop-picker';
import { Alert, Platform } from 'react-native';
import RNFS from 'react-native-fs';

// Enhanced interfaces for better type safety and functionality
interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

interface CroppingServiceMetrics {
  cropCount: number;
  successCount: number;
  errorCount: number;
  averageCropTime: number;
  totalImagesCropped: number;
  cancelledCount: number;
  lastSuccess?: Date;
  lastError?: string;
}

interface CropSession {
  id: string;
  startTime: number;
  imagePath: string;
  options: CropOptions;
  status: 'pending' | 'completed' | 'cancelled' | 'failed';
}

export interface CropOptions {
  width?: number;
  height?: number;
  freeStyleCropEnabled?: boolean;
  showCropGuidelines?: boolean;
  cropperTitle?: string;
  quality?: number;
  timeout?: number;
}

export interface CropResult {
  path: string;
  width: number;
  height: number;
  size: number;
  originalPath?: string;
  cropTime?: number;
  sessionId?: string;
}

// Enhanced constants
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 5000,
  backoffFactor: 2
};

const CROPPING_TIMEOUT = 30000; // 30 seconds timeout for cropping operations
const MIN_IMAGE_SIZE = 50; // Minimum 50x50 pixels
const MAX_IMAGE_SIZE = 4096; // Maximum 4096x4096 pixels
const DEFAULT_QUALITY = 0.8;

const NON_RETRYABLE_ERRORS = [
  'user cancelled',
  'picker cancelled',
  'permission denied',
  'not found',
  'invalid path',
  'unsupported format'
];

/**
 * Enhanced Image Cropping Service
 * OPTIMIZED: Comprehensive error handling, retry logic, and performance monitoring
 */
class ImageCroppingService {
  private static instance: ImageCroppingService;
  private readonly metrics: CroppingServiceMetrics;
  private readonly retryOptions: RetryOptions;
  private activeSessions: Map<string, CropSession> = new Map();
  private isServiceAvailable = true;

  private constructor() {
    // Initialize service metrics
    this.metrics = {
      cropCount: 0,
      successCount: 0,
      errorCount: 0,
      averageCropTime: 0,
      totalImagesCropped: 0,
      cancelledCount: 0
    };

    this.retryOptions = { ...DEFAULT_RETRY_OPTIONS };
    console.log('ImageCroppingService: Enhanced instance created with comprehensive capabilities');
  }

  public static getInstance(): ImageCroppingService {
    if (!ImageCroppingService.instance) {
      ImageCroppingService.instance = new ImageCroppingService();
    }
    return ImageCroppingService.instance;
  }

  // OPTIMIZED: Enhanced retry mechanism for cropping operations
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = this.retryOptions.maxRetries,
    timeoutMs: number = CROPPING_TIMEOUT
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`ImageCroppingService: ${operationName} attempt ${attempt}/${maxRetries}`);
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          const timeoutId = setTimeout(() => reject(new Error('Cropping operation timeout')), timeoutMs);
          (timeoutPromise as any).timeoutId = timeoutId;
        });
        
        const result = await Promise.race([operation(), timeoutPromise]);
        console.log(`ImageCroppingService: ${operationName} succeeded on attempt ${attempt}`);
        
        if ((timeoutPromise as any).timeoutId) {
          clearTimeout((timeoutPromise as any).timeoutId);
        }
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`ImageCroppingService: ${operationName} failed on attempt ${attempt}:`, lastError.message);
        
        // Don't retry for certain errors
        if (this.isNonRetryableError(lastError)) {
          console.log(`ImageCroppingService: Non-retryable error for ${operationName}, stopping retries`);
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
        console.log(`ImageCroppingService: Retrying ${operationName} in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error(`All ${maxRetries} attempts failed for ${operationName}: ${lastError!.message}`);
  }

  // OPTIMIZED: Check if error should not be retried
  private isNonRetryableError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    const errorCode = (error as any).code?.toLowerCase() || '';
    
    return NON_RETRYABLE_ERRORS.some(msg => 
      errorMessage.includes(msg) || errorCode.includes(msg)
    );
  }

  // OPTIMIZED: Enhanced input validation for cropping parameters
  private validateCropInput(imagePath: string, options: CropOptions = {}, operationName: string): void {
    if (!imagePath || typeof imagePath !== 'string') {
      throw new Error(`${operationName}: Image path is required and must be a string`);
    }

    if (imagePath.trim().length === 0) {
      throw new Error(`${operationName}: Image path cannot be empty`);
    }

    // Validate crop dimensions
    if (options.width !== undefined) {
      if (options.width < MIN_IMAGE_SIZE || options.width > MAX_IMAGE_SIZE) {
        throw new Error(`Width must be between ${MIN_IMAGE_SIZE} and ${MAX_IMAGE_SIZE} pixels`);
      }
    }
    
    if (options.height !== undefined) {
      if (options.height < MIN_IMAGE_SIZE || options.height > MAX_IMAGE_SIZE) {
        throw new Error(`Height must be between ${MIN_IMAGE_SIZE} and ${MAX_IMAGE_SIZE} pixels`);
      }
    }

    // Validate quality
    if (options.quality !== undefined) {
      if (options.quality < 0.1 || options.quality > 1.0) {
        throw new Error('Quality must be between 0.1 and 1.0');
      }
    }

    // Validate timeout
    if (options.timeout !== undefined) {
      if (options.timeout < 5000 || options.timeout > 60000) { // 5 seconds to 1 minute
        throw new Error('Timeout must be between 5 seconds and 1 minute');
      }
    }
  }

  // OPTIMIZED: Update service metrics with comprehensive tracking
  private updateMetrics(success: boolean, cropTime?: number, cancelled: boolean = false, errorMessage?: string): void {
    this.metrics.cropCount++;
    
    if (success) {
      this.metrics.successCount++;
      this.metrics.totalImagesCropped++;
      this.metrics.lastSuccess = new Date();
      
      if (cropTime) {
        // Update average crop time with weighted average
        const weight = 0.1; // 10% weight for new measurement
        this.metrics.averageCropTime = 
          this.metrics.averageCropTime * (1 - weight) + cropTime * weight;
      }
    } else if (cancelled) {
      this.metrics.cancelledCount++;
    } else {
      this.metrics.errorCount++;
      this.metrics.lastError = errorMessage;
      
      // Mark service as temporarily unavailable if too many consecutive errors
      const recentErrorRate = this.metrics.errorCount / Math.max(this.metrics.cropCount, 1);
      if (recentErrorRate > 0.5 && this.metrics.cropCount > 10) {
        this.isServiceAvailable = false;
        console.warn('ImageCroppingService: Service marked as unavailable due to high error rate');
      }
    }
  }

  // OPTIMIZED: Check if the service is available and properly initialized
  public isServiceHealthy(): boolean {
    return this.isServiceAvailable && this.isAvailable();
  }

  // OPTIMIZED: Get service metrics
  public getServiceMetrics(): CroppingServiceMetrics {
    return { ...this.metrics };
  }

  // OPTIMIZED: Generate unique session ID
  private generateSessionId(): string {
    return `crop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * OPTIMIZED: Enhanced image cropping with comprehensive error handling and validation
   */
  public async cropImageForTextExtraction(imagePath: string, options: CropOptions = {}): Promise<CropResult | null> {
    return this.withRetry(async () => {
      const startTime = Date.now();
      const sessionId = this.generateSessionId();
      
      try {
        console.log(`ImageCroppingService: Starting crop session ${sessionId} for image:`, imagePath);
        
        // Validate input parameters
        this.validateCropInput(imagePath, options, 'cropImageForTextExtraction');
        
        // Check if image file exists
        const fileExists = await RNFS.exists(imagePath);
        if (!fileExists) {
          throw new Error(`Image file not found: ${imagePath}`);
        }

        // Get file info for validation
        const fileInfo = await RNFS.stat(imagePath);
        if (fileInfo.size === 0) {
          throw new Error('Image file is empty or corrupted');
        }

        // Create crop session
        const session: CropSession = {
          id: sessionId,
          startTime,
          imagePath,
          options,
          status: 'pending'
        };
        this.activeSessions.set(sessionId, session);

        const defaultOptions = {
          width: 800,
          height: 600,
          freeStyleCropEnabled: true,
          showCropGuidelines: true,
          cropperTitle: 'Select Text Area to Scan',
          quality: DEFAULT_QUALITY,
          timeout: CROPPING_TIMEOUT,
          ...options,
        };

        console.log(`ImageCroppingService: Opening cropper with options:`, defaultOptions);

        // Open the cropper with enhanced configuration
        const croppedImage: ImageOrVideo = await ImageCropPicker.openCropper({
          path: imagePath,
          width: defaultOptions.width,
          height: defaultOptions.height,
          cropping: true,
          cropperToolbarTitle: defaultOptions.cropperTitle,
          showCropGuidelines: defaultOptions.showCropGuidelines,
          freeStyleCropEnabled: defaultOptions.freeStyleCropEnabled,
          mediaType: 'photo',
          includeBase64: false,
          compressImageMaxWidth: Math.min(defaultOptions.width! * 1.5, 1800),
          compressImageMaxHeight: Math.min(defaultOptions.height! * 1.5, 1600),
          compressImageQuality: defaultOptions.quality,
          enableRotationGesture: true,
          avoidEmptySpaceAroundImage: true,
          cropperStatusBarColor: '#000000',
          cropperToolbarColor: '#000000',
          cropperActiveWidgetColor: '#2196F3',
          cropperToolbarWidgetColor: '#FFFFFF',
          hideBottomControls: false,
          cropperCircleOverlay: false,
        });

        if (!croppedImage || !croppedImage.path) {
          console.log(`ImageCroppingService: User cancelled cropping for session ${sessionId}`);
          session.status = 'cancelled';
          this.updateMetrics(false, Date.now() - startTime, true);
          this.activeSessions.delete(sessionId);
          
          this.logAnalyticsEvent('cropping_cancelled', {
            session_id: sessionId,
            original_path: imagePath,
            duration: Date.now() - startTime
          });
          
          return null;
        }

        // Validate cropped result
        if (croppedImage.width < MIN_IMAGE_SIZE || croppedImage.height < MIN_IMAGE_SIZE) {
          throw new Error(`Cropped image too small: ${croppedImage.width}x${croppedImage.height}`);
        }

        const cropTime = Date.now() - startTime;
        const result: CropResult = {
          path: croppedImage.path,
          width: croppedImage.width,
          height: croppedImage.height,
          size: croppedImage.size || 0,
          originalPath: imagePath,
          cropTime,
          sessionId
        };

        session.status = 'completed';
        this.updateMetrics(true, cropTime);
        this.activeSessions.delete(sessionId);

        console.log(`ImageCroppingService: Cropping successful for session ${sessionId}`);
        console.log(`ImageCroppingService: Cropped image dimensions: ${result.width}x${result.height}`);
        console.log(`ImageCroppingService: Cropped image size: ${(result.size / 1024).toFixed(2)}KB`);
        console.log(`ImageCroppingService: Crop time: ${cropTime}ms`);

        this.logAnalyticsEvent('cropping_completed', {
          session_id: sessionId,
          original_path: imagePath,
          cropped_path: result.path,
          width: result.width,
          height: result.height,
          file_size: result.size,
          crop_time: cropTime
        });

        return result;
      } catch (error: any) {
        const cropTime = Date.now() - startTime;
        const session = this.activeSessions.get(sessionId);
        if (session) {
          session.status = 'failed';
          this.activeSessions.delete(sessionId);
        }

        console.error(`ImageCroppingService: Cropping failed for session ${sessionId}:`, error);

        // Handle user cancellation gracefully
        if (this.isUserCancellation(error)) {
          console.log(`ImageCroppingService: User cancelled cropping operation for session ${sessionId}`);
          this.updateMetrics(false, cropTime, true);
          
          this.logAnalyticsEvent('cropping_cancelled', {
            session_id: sessionId,
            original_path: imagePath,
            duration: cropTime,
            error_type: 'user_cancellation'
          });
          
          return null;
        }

        // Update metrics for actual errors
        const errorMessage = error?.message || 'Unknown cropping error';
        this.updateMetrics(false, cropTime, false, errorMessage);

        this.logAnalyticsEvent('cropping_error', {
          session_id: sessionId,
          original_path: imagePath,
          error_message: errorMessage,
          error_code: error?.code,
          duration: cropTime
        });

        // Show error for other failures
        Alert.alert(
          'Cropping Error',
          'Failed to crop the image. Please try again.',
          [{ text: 'OK' }]
        );

        throw error;
      }
    }, 'cropImageForTextExtraction', 2); // Fewer retries for cropping due to user interaction
  }

  /**
   * OPTIMIZED: Enhanced quick crop with predefined settings optimized for text extraction
   */
  public async quickCropForText(imagePath: string): Promise<CropResult | null> {
    return this.cropImageForTextExtraction(imagePath, {
      width: 1000,
      height: 800,
      freeStyleCropEnabled: true,
      showCropGuidelines: true,
      cropperTitle: '📄 Select Document Area',
      quality: 0.85,
    });
  }

  // OPTIMIZED: Check if error is user cancellation
  private isUserCancellation(error: any): boolean {
    if (!error) return false;
    
    const errorCode = error.code?.toLowerCase() || '';
    const errorMessage = error.message?.toLowerCase() || '';
    
    return (
      errorCode === 'e_picker_cancelled' ||
      errorCode.includes('cancelled') ||
      errorMessage.includes('cancelled') ||
      errorMessage.includes('user cancelled') ||
      errorMessage.includes('picker cancelled')
    );
  }

  /**
   * OPTIMIZED: Enhanced availability check with comprehensive validation
   */
  public isAvailable(): boolean {
    try {
      if (!ImageCropPicker) {
        console.warn('ImageCroppingService: ImageCropPicker library not available');
        return false;
      }
      
      // Additional platform-specific checks could be added here
      console.log('ImageCroppingService: Service is available');
      return true;
    } catch (error) {
      console.error('ImageCroppingService: Library not available:', error);
      return false;
    }
  }

  /**
   * OPTIMIZED: Enhanced cleanup with comprehensive error handling
   */
  public async cleanupTempImages(imagePaths: string[]): Promise<void> {
    return this.withRetry(async () => {
      if (!imagePaths || !Array.isArray(imagePaths)) {
        console.warn('ImageCroppingService: Invalid image paths provided for cleanup');
        return;
      }

      console.log(`ImageCroppingService: Starting cleanup of ${imagePaths.length} temporary images`);
      
      const cleanupResults: Array<{ path: string; success: boolean; error?: string }> = [];
      
      for (const path of imagePaths) {
        try {
          if (!path || typeof path !== 'string') {
            console.warn('ImageCroppingService: Invalid path provided for cleanup:', path);
            continue;
          }

          // Check if file exists before attempting cleanup
          const exists = await RNFS.exists(path);
          if (!exists) {
            console.log(`ImageCroppingService: File already removed: ${path}`);
            cleanupResults.push({ path, success: true });
            continue;
          }

          await ImageCropPicker.cleanSingle(path);
          console.log(`ImageCroppingService: Successfully cleaned up: ${path}`);
          cleanupResults.push({ path, success: true });
          
        } catch (cleanupError: any) {
          const errorMessage = cleanupError?.message || 'Unknown cleanup error';
          console.warn(`ImageCroppingService: Failed to cleanup image: ${path}`, errorMessage);
          cleanupResults.push({ path, success: false, error: errorMessage });
        }
      }

      const successCount = cleanupResults.filter(r => r.success).length;
      const failureCount = cleanupResults.filter(r => !r.success).length;
      
      console.log(`ImageCroppingService: Cleanup completed - Success: ${successCount}, Failed: ${failureCount}`);
      
      this.logAnalyticsEvent('temp_images_cleanup', {
        total_images: imagePaths.length,
        success_count: successCount,
        failure_count: failureCount,
        cleanup_results: cleanupResults
      });
      
      if (failureCount > 0) {
        console.warn(`ImageCroppingService: ${failureCount} images failed to cleanup`);
      }
    }, 'cleanupTempImages', 2);
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
        active_sessions: this.activeSessions.size
      };
      
      // TODO: Replace with actual Firebase analytics when available
      // analytics().logEvent(eventName, safeParameters);
      console.log(`ImageCroppingService Analytics: ${eventName}`, safeParameters);
    } catch (error) {
      console.warn('ImageCroppingService: Failed to log analytics event:', error);
    }
  }

  // OPTIMIZED: Enhanced service health check
  public async checkServiceHealth(): Promise<boolean> {
    try {
      if (!this.isServiceAvailable) {
        console.log('ImageCroppingService: Service marked as unavailable');
        return false;
      }
      
      // Check if the library is available
      const libraryAvailable = this.isAvailable();
      if (!libraryAvailable) {
        this.isServiceAvailable = false;
        return false;
      }
      
      // Test basic functionality by checking library methods
      const hasRequiredMethods = typeof ImageCropPicker.openCropper === 'function' &&
                                typeof ImageCropPicker.cleanSingle === 'function';
      
      if (!hasRequiredMethods) {
        console.warn('ImageCroppingService: Required methods not available');
        this.isServiceAvailable = false;
        return false;
      }
      
      // Reset service availability if health check passes
      this.isServiceAvailable = true;
      console.log('ImageCroppingService: Health check passed');
      return true;
    } catch (error) {
      console.warn('ImageCroppingService: Health check failed:', error);
      this.isServiceAvailable = false;
      return false;
    }
  }

  // OPTIMIZED: Enhanced service cleanup with comprehensive session management
  public async cleanup(): Promise<void> {
    try {
      console.log('ImageCroppingService: Starting service cleanup...');
      
      // Cancel all active cropping sessions
      const activeSessions = Array.from(this.activeSessions.values());
      for (const session of activeSessions) {
        try {
          session.status = 'cancelled';
          console.log(`ImageCroppingService: Cancelled session ${session.id}`);
        } catch (error) {
          console.warn(`ImageCroppingService: Error cancelling session ${session.id}:`, error);
        }
      }
      
      this.activeSessions.clear();
      
      this.logAnalyticsEvent('service_cleanup_completed', {
        sessions_cancelled: activeSessions.length,
        total_crops: this.metrics.cropCount,
        success_rate: this.metrics.cropCount > 0 ? (this.metrics.successCount / this.metrics.cropCount) * 100 : 0
      });
      
      console.log('ImageCroppingService: Service cleanup completed successfully');
    } catch (error) {
      console.error('ImageCroppingService: Error during cleanup:', error);
      throw new Error(`Service cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // OPTIMIZED: Get comprehensive service statistics
  public getServiceStatistics(): {
    metrics: CroppingServiceMetrics;
    activeSessions: {
      count: number;
      sessions: Array<{
        id: string;
        duration: number;
        imagePath: string;
        status: CropSession['status'];
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
      imagePath: session.imagePath,
      status: session.status
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

// Export enhanced types for better integration (interfaces already exported above)
export type { 
  CroppingServiceMetrics,
  CropSession,
  RetryOptions
};

export default ImageCroppingService;
