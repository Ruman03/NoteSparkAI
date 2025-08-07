import { Alert } from 'react-native';
import Config from 'react-native-config';
import RNFS from 'react-native-fs';

// Enhanced interfaces for better type safety and functionality
interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

interface VisionServiceMetrics {
  textExtractionsCompleted: number;
  textExtractionsSucceeded: number;
  textExtractionsFailed: number;
  totalCharactersExtracted: number;
  averageConfidence: number;
  averageProcessingTime: number;
  lastSuccess?: Date;
  lastError?: string;
}

interface VisionOperation {
  id: string;
  type: 'text_extraction';
  imageUri: string;
  startTime: number;
  status: 'pending' | 'completed' | 'failed';
}

export interface VisionResult {
  text: string;
  confidence: number;
  blocks: TextBlock[];
  processingTime: number;
  imageSize?: { width: number; height: number };
}

export interface TextBlock {
  text: string;
  boundingBox: BoundingBox;
  confidence: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Enhanced constants
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2
};

const VISION_API_TIMEOUT = 30000; // 30 seconds timeout for Vision API calls
const MAX_CONCURRENT_OPERATIONS = 3; // Maximum concurrent vision operations
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB max image size
const SUPPORTED_IMAGE_FORMATS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];

const NON_RETRYABLE_ERRORS = [
  'invalid argument',
  'permission denied',
  'quota exceeded',
  'unauthenticated',
  'image too large',
  'unsupported image format'
];

/**
 * Enhanced Vision Service
 * OPTIMIZED: Comprehensive error handling, retry logic, and performance monitoring
 */
class VisionService {
  private static instance: VisionService;
  private apiKey: string;
  private baseUrl: string = 'https://vision.googleapis.com/v1';
  private metrics: VisionServiceMetrics = {
    textExtractionsCompleted: 0,
    textExtractionsSucceeded: 0,
    textExtractionsFailed: 0,
    totalCharactersExtracted: 0,
    averageConfidence: 0,
    averageProcessingTime: 0
  };
  private activeOperations = new Set<string>();

  private constructor() {
    this.apiKey = Config.GOOGLE_CLOUD_VISION_API_KEY || '';
    if (!this.apiKey) {
      console.warn('VisionService: Google Cloud Vision API key not configured');
    }
  }

  public static getInstance(): VisionService {
    if (!VisionService.instance) {
      VisionService.instance = new VisionService();
    }
    return VisionService.instance;
  }

  /**
   * Enhanced retry mechanism with exponential backoff
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    options: RetryOptions = DEFAULT_RETRY_OPTIONS
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
        
        // Don't retry for non-retryable errors
        if (NON_RETRYABLE_ERRORS.some(nonRetryableError => errorMessage.includes(nonRetryableError))) {
          this.updateMetrics('error', { error: errorMessage });
          throw error;
        }
        
        if (attempt === options.maxRetries) {
          break;
        }
        
        const delay = Math.min(
          options.baseDelay * Math.pow(options.backoffFactor, attempt),
          options.maxDelay
        );
        
        console.log(`${operationName} attempt ${attempt + 1} failed, retrying in ${delay}ms:`, errorMessage);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    this.updateMetrics('error', { error: lastError!.message });
    throw new Error(`${operationName} failed after ${options.maxRetries + 1} attempts: ${lastError!.message}`);
  }

  /**
   * Validate input parameters
   */
  private validateInput(imageUri: string, operation: string): void {
    if (!imageUri || typeof imageUri !== 'string' || imageUri.trim().length === 0) {
      throw new Error(`${operation}: Invalid imageUri provided`);
    }

    // Check file extension
    const extension = imageUri.toLowerCase().substring(imageUri.lastIndexOf('.'));
    if (!SUPPORTED_IMAGE_FORMATS.includes(extension)) {
      throw new Error(`${operation}: Unsupported image format. Supported: ${SUPPORTED_IMAGE_FORMATS.join(', ')}`);
    }
  }

  /**
   * Check if service is available and properly configured
   */
  private isServiceAvailable(): boolean {
    try {
      return !!this.apiKey && this.apiKey.trim().length > 0;
    } catch (error) {
      console.error('Vision Service not available:', error);
      return false;
    }
  }

  /**
   * Update service metrics
   */
  private updateMetrics(operation: string, data: any = {}): void {
    try {
      switch (operation) {
        case 'text_extraction_completed':
          this.metrics.textExtractionsCompleted++;
          this.metrics.textExtractionsSucceeded++;
          this.metrics.lastSuccess = new Date();
          
          if (data.charactersExtracted) {
            this.metrics.totalCharactersExtracted += data.charactersExtracted;
          }
          
          if (data.confidence) {
            this.metrics.averageConfidence = 
              (this.metrics.averageConfidence * (this.metrics.textExtractionsSucceeded - 1) + data.confidence) / 
              this.metrics.textExtractionsSucceeded;
          }
          
          if (data.processingTime) {
            this.metrics.averageProcessingTime = 
              (this.metrics.averageProcessingTime * (this.metrics.textExtractionsSucceeded - 1) + data.processingTime) / 
              this.metrics.textExtractionsSucceeded;
          }
          break;
          
        case 'text_extraction_failed':
          this.metrics.textExtractionsCompleted++;
          this.metrics.textExtractionsFailed++;
          break;
          
        case 'error':
          this.metrics.lastError = data.error || 'Unknown error';
          break;
      }
    } catch (error) {
      console.error('Error updating vision service metrics:', error);
    }
  }

  /**
   * Extract text from image with enhanced error handling and validation
   */
  public async extractTextFromImage(imageUri: string): Promise<VisionResult | null> {
    const operationId = `extract_${Date.now()}`;
    const startTime = Date.now();

    try {
      // Input validation
      this.validateInput(imageUri, 'extractTextFromImage');

      // Service availability check
      if (!this.isServiceAvailable()) {
        throw new Error('Vision Service is not available - API key not configured');
      }

      // Concurrency control
      if (this.activeOperations.size >= MAX_CONCURRENT_OPERATIONS) {
        throw new Error('Maximum concurrent vision operations limit reached');
      }

      this.activeOperations.add(operationId);

      console.log('VisionService: Starting text extraction for image:', imageUri);

      return await this.withRetry(async () => {
        // Convert image to base64 with validation
        const { imageBase64, imageSize } = await this.convertImageToBase64(imageUri);
        
        // Prepare request payload
        const requestBody = {
          requests: [
            {
              image: {
                content: imageBase64,
              },
              features: [
                {
                  type: 'TEXT_DETECTION',
                  maxResults: 50, // Increased for better text block detection
                },
              ],
              imageContext: {
                languageHints: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh'], // Extended language support
              },
            },
          ],
        };

        // Make API request with enhanced timeout handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), VISION_API_TIMEOUT);

        const apiCallStart = Date.now();
        const response = await fetch(
          `${this.baseUrl}/images:annotate?key=${this.apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'NoteSpark-AI/1.0',
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('VisionService: API error response:', errorText);
          throw new Error(`Google Cloud Vision API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        const apiCallTime = Date.now() - apiCallStart;
        console.log(`VisionService: API response received in ${apiCallTime}ms`);

        // Check for errors in response
        if (result.responses?.[0]?.error) {
          const error = result.responses[0].error;
          console.error('VisionService: API returned error:', error);
          throw new Error(`Vision API error: ${error.message}`);
        }

        // Extract text annotations
        const textAnnotations = result.responses?.[0]?.textAnnotations;
        if (!textAnnotations || textAnnotations.length === 0) {
          console.log('VisionService: No text detected in image');
          return null;
        }

        // The first annotation contains the full text
        const fullTextAnnotation = textAnnotations[0];
        const extractedText = fullTextAnnotation.description || '';

        // Calculate confidence (average of all annotations)
        const totalConfidence = textAnnotations.reduce(
          (sum: number, annotation: any) => sum + (annotation.confidence || 0.9),
          0
        );
        const averageConfidence = totalConfidence / textAnnotations.length;

        // Extract individual text blocks for advanced processing
        const blocks: TextBlock[] = textAnnotations.slice(1).map((annotation: any) => {
          const vertices = annotation.boundingPoly?.vertices || [];
          const boundingBox = this.calculateBoundingBox(vertices);
          
          return {
            text: annotation.description || '',
            boundingBox,
            confidence: annotation.confidence || 0.9,
          };
        });

        const processingTime = Date.now() - startTime;
        const visionResult: VisionResult = {
          text: extractedText.trim(),
          confidence: averageConfidence,
          blocks,
          processingTime,
          imageSize,
        };

        console.log('VisionService: Text extraction successful');
        console.log(`VisionService: Extracted ${extractedText.length} characters with ${averageConfidence.toFixed(2)} confidence in ${processingTime}ms`);

        this.updateMetrics('text_extraction_completed', {
          charactersExtracted: extractedText.length,
          confidence: averageConfidence,
          processingTime
        });

        return visionResult;
      }, 'extractTextFromImage');

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('VisionService: Text extraction failed:', error);
      this.updateMetrics('text_extraction_failed', { 
        error: error instanceof Error ? error.message : String(error),
        processingTime
      });
      return null;
    } finally {
      this.activeOperations.delete(operationId);
    }
  }

  /**
   * Convert image file to base64 string with enhanced validation
   */
  private async convertImageToBase64(imageUri: string): Promise<{
    imageBase64: string;
    imageSize: { width: number; height: number };
  }> {
    try {
      // Remove file:// prefix if present
      const cleanUri = imageUri.replace('file://', '');
      
      // Check if file exists
      const fileExists = await RNFS.exists(cleanUri);
      if (!fileExists) {
        throw new Error('Image file does not exist');
      }

      // Get file stats for size validation
      const fileStats = await RNFS.stat(cleanUri);
      if (fileStats.size > MAX_IMAGE_SIZE) {
        throw new Error(`Image file too large: ${fileStats.size} bytes (max: ${MAX_IMAGE_SIZE} bytes)`);
      }

      // Read file as base64
      const base64String = await RNFS.readFile(cleanUri, 'base64');
      
      if (!base64String || base64String.length === 0) {
        throw new Error('Failed to read image file or file is empty');
      }

      // For now, return estimated dimensions (actual dimensions would require image processing library)
      const estimatedSize = {
        width: 1920, // Default estimate
        height: 1080 // Default estimate
      };

      return {
        imageBase64: base64String,
        imageSize: estimatedSize
      };
    } catch (error) {
      console.error('VisionService: Failed to convert image to base64:', error);
      throw new Error(`Failed to process image file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Calculate bounding box from vertices with enhanced validation
   */
  private calculateBoundingBox(vertices: any[]): BoundingBox {
    try {
      if (!vertices || vertices.length === 0) {
        return { x: 0, y: 0, width: 0, height: 0 };
      }

      const xCoords = vertices.map((v: any) => typeof v.x === 'number' ? v.x : 0);
      const yCoords = vertices.map((v: any) => typeof v.y === 'number' ? v.y : 0);

      if (xCoords.length === 0 || yCoords.length === 0) {
        return { x: 0, y: 0, width: 0, height: 0 };
      }

      const minX = Math.min(...xCoords);
      const maxX = Math.max(...xCoords);
      const minY = Math.min(...yCoords);
      const maxY = Math.max(...yCoords);

      // Ensure valid dimensions
      const width = Math.max(0, maxX - minX);
      const height = Math.max(0, maxY - minY);

      return {
        x: Math.max(0, minX),
        y: Math.max(0, minY),
        width,
        height,
      };
    } catch (error) {
      console.warn('VisionService: Error calculating bounding box:', error);
      return { x: 0, y: 0, width: 0, height: 0 };
    }
  }

  /**
   * Check if Vision API is properly configured
   */
  public isConfigured(): boolean {
    return this.isServiceAvailable();
  }

  /**
   * Get API configuration status for debugging
   */
  public getStatus(): { 
    configured: boolean; 
    hasApiKey: boolean; 
    activeOperations: number;
    serviceHealth: string;
  } {
    const isHealthy = this.isServiceAvailable() && this.metrics.textExtractionsFailed < 10;
    
    return {
      configured: this.isConfigured(),
      hasApiKey: !!this.apiKey,
      activeOperations: this.activeOperations.size,
      serviceHealth: isHealthy ? 'healthy' : 'degraded'
    };
  }

  /**
   * Get service health status and metrics
   */
  public getServiceHealth(): {
    isHealthy: boolean;
    metrics: VisionServiceMetrics;
    activeOperations: number;
    serviceStatus: string;
  } {
    const isHealthy = this.isServiceAvailable() && this.metrics.textExtractionsFailed < 10;
    
    return {
      isHealthy,
      metrics: { ...this.metrics },
      activeOperations: this.activeOperations.size,
      serviceStatus: isHealthy ? 'healthy' : 'degraded'
    };
  }

  /**
   * Get service statistics
   */
  public getServiceStatistics(): {
    totalExtractions: number;
    successRate: number;
    averageConfidence: number;
    averageProcessingTime: number;
    totalCharactersExtracted: number;
    uptime: string;
  } {
    const successRate = this.metrics.textExtractionsCompleted > 0 ? 
      (this.metrics.textExtractionsSucceeded / this.metrics.textExtractionsCompleted) * 100 : 100;

    return {
      totalExtractions: this.metrics.textExtractionsCompleted,
      successRate: Math.round(successRate * 100) / 100,
      averageConfidence: Math.round(this.metrics.averageConfidence * 10000) / 10000,
      averageProcessingTime: Math.round(this.metrics.averageProcessingTime),
      totalCharactersExtracted: this.metrics.totalCharactersExtracted,
      uptime: this.metrics.lastSuccess ? 
        `Last success: ${this.metrics.lastSuccess.toISOString()}` : 
        'No successful operations yet'
    };
  }

  /**
   * Reset service metrics (for testing/debugging)
   */
  public resetMetrics(): void {
    this.metrics = {
      textExtractionsCompleted: 0,
      textExtractionsSucceeded: 0,
      textExtractionsFailed: 0,
      totalCharactersExtracted: 0,
      averageConfidence: 0,
      averageProcessingTime: 0
    };
    this.activeOperations.clear();
  }
}

export default VisionService;
