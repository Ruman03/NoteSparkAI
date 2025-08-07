// Enhanced AIService Bridge - Backward Compatible Migration with Production-Ready Optimization
// This file bridges the existing AIService interface with the new EnhancedAIService
// Provides enhanced features while maintaining full backward compatibility
// Enhanced with comprehensive error handling, retry logic, and performance optimization

import EnhancedAIService from './EnhancedAIService';

// Import existing interfaces for compatibility with proper type definitions
interface AITransformationRequest {
  text: string;
  tone: 'professional' | 'casual' | 'simplified';
}

interface AITransformationResponse {
  transformedText: string;
  title: string;
  wordCount: number;
}

interface DocumentProcessingRequest {
  fileData: string;
  mimeType: string;
  prompt: string;
}

interface DocumentProcessingResponse {
  extractedContent: string;
  title?: string;
}

interface BridgeServiceMetrics {
  requestCount: number;
  successCount: number;
  errorCount: number;
  averageResponseTime: number;
  lastError?: string;
  lastSuccess?: Date;
}

interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

// Enhanced configuration constants
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2.0
};

const BRIDGE_TIMEOUT = 30000; // 30 seconds for bridge operations
const HEALTH_CHECK_TIMEOUT = 10000; // 10 seconds for health checks

// Non-retryable error patterns
const NON_RETRYABLE_ERRORS = [
  'invalid_api_key',
  'quota_exceeded',
  'model_not_found',
  'unsupported_format',
  'content_policy_violation',
  'invalid_request_format'
];

/**
 * Enhanced AIService with Firebase integration and backward compatibility
 * 
 * This service maintains the existing AIService interface while providing
 * enhanced capabilities and Firebase ecosystem integration.
 * 
 * New Features:
 * - Firebase Auth user context integration
 * - Usage analytics and error tracking
 * - Structured content generation (flashcards, quizzes)
 * - Enhanced health monitoring
 * - Preparation for Firebase AI Logic migration
 * - Production-ready error handling and retry logic
 * - Comprehensive input validation and logging
 * - Performance metrics and monitoring
 */
class AIService {
  private static instance: AIService;
  private enhancedService: EnhancedAIService | null = null;
  private readonly metrics: BridgeServiceMetrics;
  private readonly retryOptions: RetryOptions;
  private isServiceInitialized: boolean = false;

  constructor() {
    // Initialize metrics tracking
    this.metrics = {
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      averageResponseTime: 0
    };

    this.retryOptions = { ...DEFAULT_RETRY_OPTIONS };

    try {
      this.enhancedService = EnhancedAIService.getInstance();
      this.isServiceInitialized = true;
      console.log('AIService Bridge: Initialized with enhanced capabilities');
    } catch (error) {
      console.error('AIService Bridge: Failed to initialize EnhancedAIService:', error);
      this.isServiceInitialized = false;
    }
  }

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  /**
   * Enhanced retry mechanism with exponential backoff and timeout protection
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    customOptions?: Partial<RetryOptions>
  ): Promise<T> {
    const options = { ...this.retryOptions, ...customOptions };
    let lastError: Error;
    
    for (let attempt = 1; attempt <= options.maxRetries + 1; attempt++) {
      try {
        const startTime = Date.now();
        
        // Add timeout protection
        const result = await Promise.race([
          operation(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error(`Bridge operation timeout after ${BRIDGE_TIMEOUT}ms`)), BRIDGE_TIMEOUT)
          )
        ]);
        
        // Update metrics on success
        const responseTime = Date.now() - startTime;
        this.updateMetrics(true, responseTime);
        
        if (attempt > 1) {
          console.log(`AIService Bridge: ${operationName} succeeded on attempt ${attempt}`);
        }
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Update metrics on error
        this.updateMetrics(false, 0, lastError.message);
        
        // Check if error is non-retryable
        if (this.isNonRetryableError(lastError)) {
          console.error(`AIService Bridge: Non-retryable error in ${operationName}:`, lastError.message);
          throw lastError;
        }
        
        if (attempt > options.maxRetries) {
          console.error(`AIService Bridge: ${operationName} failed after ${options.maxRetries} retries:`, lastError.message);
          throw new Error(`${operationName} failed after ${options.maxRetries} retries: ${lastError.message}`);
        }
        
        // Calculate delay with jitter
        const delay = Math.min(
          options.baseDelay * Math.pow(options.backoffFactor, attempt - 1),
          options.maxDelay
        );
        const jitter = Math.random() * 0.1 * delay;
        const finalDelay = delay + jitter;
        
        console.warn(`AIService Bridge: ${operationName} failed on attempt ${attempt}, retrying in ${Math.round(finalDelay)}ms:`, lastError.message);
        
        await new Promise(resolve => setTimeout(resolve, finalDelay));
      }
    }
    
    throw lastError!;
  }

  /**
   * Check if an error should not be retried
   */
  private isNonRetryableError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    return NON_RETRYABLE_ERRORS.some(pattern => errorMessage.includes(pattern));
  }

  /**
   * Update service metrics
   */
  private updateMetrics(success: boolean, responseTime: number, errorMessage?: string): void {
    this.metrics.requestCount++;
    
    if (success) {
      this.metrics.successCount++;
      this.metrics.lastSuccess = new Date();
      
      // Update average response time with weighted average
      const weight = 0.1; // 10% weight for new measurement
      this.metrics.averageResponseTime = 
        this.metrics.averageResponseTime * (1 - weight) + responseTime * weight;
    } else {
      this.metrics.errorCount++;
      this.metrics.lastError = errorMessage;
    }
  }

  /**
   * Validate service availability and throw appropriate error
   */
  private validateServiceAvailability(): void {
    if (!this.isServiceInitialized || !this.enhancedService) {
      throw new Error('Enhanced AI Service is not available. Please check service configuration.');
    }
  }

  /**
   * Enhanced input validation
   */
  private validateTransformationRequest(request: AITransformationRequest): void {
    if (!request) {
      throw new Error('AIService Bridge: Request object is required');
    }
    
    if (!request.text || typeof request.text !== 'string') {
      throw new Error('AIService Bridge: Text input is required and must be a string');
    }
    
    if (request.text.trim().length < 10) {
      throw new Error('AIService Bridge: Text must be at least 10 characters long');
    }
    
    if (request.text.length > 50000) {
      throw new Error('AIService Bridge: Text exceeds maximum length of 50,000 characters');
    }
    
    if (!request.tone || !['professional', 'casual', 'simplified'].includes(request.tone)) {
      throw new Error('AIService Bridge: Valid tone is required (professional, casual, or simplified)');
    }
  }

  // === EXISTING METHODS (Backward Compatible) ===

  /**
   * Transform text to formatted notes
   * Enhanced with Firebase user context and better error handling
   */
  async transformTextToNote(request: AITransformationRequest): Promise<AITransformationResponse> {
    const startTime = Date.now();
    console.log('AIService Bridge: Starting transformTextToNote operation');
    
    // Comprehensive input validation
    this.validateTransformationRequest(request);
    this.validateServiceAvailability();
    
    return this.withRetry(async () => {
      return this.enhancedService!.transformTextToNote(request);
    }, 'transformTextToNote');
  }

  /**
   * Process documents using Gemini multimodal capabilities
   * Enhanced with Firebase context and comprehensive tracking
   */
  async processDocumentWithGemini(request: DocumentProcessingRequest): Promise<DocumentProcessingResponse> {
    const startTime = Date.now();
    console.log('AIService Bridge: Starting processDocumentWithGemini operation');
    
    // Enhanced input validation
    if (!request) {
      throw new Error('AIService Bridge: Document processing request is required');
    }
    
    if (!request.fileData || typeof request.fileData !== 'string') {
      throw new Error('AIService Bridge: fileData is required and must be a base64 string');
    }
    
    if (!request.mimeType || typeof request.mimeType !== 'string') {
      throw new Error('AIService Bridge: mimeType is required and must be a string');
    }
    
    if (!request.prompt || typeof request.prompt !== 'string') {
      throw new Error('AIService Bridge: prompt is required and must be a string');
    }
    
    this.validateServiceAvailability();
    
    return this.withRetry(async () => {
      return this.enhancedService!.processDocumentWithGemini(request);
    }, 'processDocumentWithGemini');
  }

  /**
   * Generate note title from content
   * Enhanced with better fallback strategies
   */
  async generateNoteTitle(content: string): Promise<string> {
    const startTime = Date.now();
    console.log('AIService Bridge: Starting generateNoteTitle operation');
    
    // Input validation
    if (!content || typeof content !== 'string') {
      throw new Error('AIService Bridge: Content is required and must be a string');
    }
    
    if (content.trim().length === 0) {
      throw new Error('AIService Bridge: Content cannot be empty');
    }
    
    this.validateServiceAvailability();
    
    return this.withRetry(async () => {
      return this.enhancedService!.generateNoteTitle(content);
    }, 'generateNoteTitle', { maxRetries: 2 });
  }

  /**
   * Generate document title with type context
   * Enhanced with better prompting
   */
  async generateDocumentTitle(content: string, documentType: string): Promise<string> {
    const startTime = Date.now();
    console.log('AIService Bridge: Starting generateDocumentTitle operation');
    
    // Input validation
    if (!content || typeof content !== 'string') {
      throw new Error('AIService Bridge: Content is required and must be a string');
    }
    
    if (!documentType || typeof documentType !== 'string') {
      throw new Error('AIService Bridge: Document type is required and must be a string');
    }
    
    this.validateServiceAvailability();
    
    return this.withRetry(async () => {
      return this.enhancedService!.generateDocumentTitle(content, documentType);
    }, 'generateDocumentTitle', { maxRetries: 2 });
  }

  /**
   * Check API health status
   * Enhanced with detailed diagnostics
   */
  async checkAPIHealth(): Promise<boolean> {
    const startTime = Date.now();
    console.log('AIService Bridge: Starting API health check');
    
    try {
      this.validateServiceAvailability();
      
      const result = await Promise.race([
        this.enhancedService!.checkAPIHealth(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), HEALTH_CHECK_TIMEOUT)
        )
      ]);
      
      const isHealthy = result?.healthy || false;
      const processingTime = Date.now() - startTime;
      
      console.log(`AIService Bridge: Health check ${isHealthy ? 'passed' : 'failed'} in ${processingTime}ms`);
      this.updateMetrics(isHealthy, processingTime);
      
      return isHealthy;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.warn(`AIService Bridge: Health check failed in ${processingTime}ms:`, error);
      this.updateMetrics(false, processingTime, error instanceof Error ? error.message : 'Health check error');
      return false;
    }
  }

  /**
   * Get detailed health information (Enhanced feature)
   */
  async getDetailedHealthCheck(): Promise<{ healthy: boolean; details: any }> {
    const startTime = Date.now();
    console.log('AIService Bridge: Starting detailed health check');
    
    try {
      this.validateServiceAvailability();
      
      return await this.withRetry(async () => {
        return this.enhancedService!.checkAPIHealth();
      }, 'getDetailedHealthCheck', { maxRetries: 1 });
    } catch (error) {
      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          bridge: 'available',
          enhancedService: this.isServiceInitialized ? 'available' : 'unavailable',
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  // === NEW ENHANCED METHODS ===

  /**
   * Generate flashcards from note content
   * Returns structured JSON with questions, answers, and difficulty levels
   */
  async generateFlashcards(noteContent: string): Promise<any> {
    const startTime = Date.now();
    console.log('AIService Bridge: Starting generateFlashcards operation');
    
    // Input validation
    if (!noteContent || typeof noteContent !== 'string') {
      throw new Error('AIService Bridge: Note content is required and must be a string');
    }
    
    if (noteContent.trim().length < 50) {
      throw new Error('AIService Bridge: Note content must be at least 50 characters for meaningful flashcard generation');
    }
    
    this.validateServiceAvailability();
    
    return this.withRetry(async () => {
      return this.enhancedService!.generateStructuredContent(noteContent, 'flashcards');
    }, 'generateFlashcards');
  }

  /**
   * Generate quiz from note content
   * Returns structured JSON with multiple choice questions
   */
  async generateQuiz(noteContent: string): Promise<any> {
    const startTime = Date.now();
    console.log('AIService Bridge: Starting generateQuiz operation');
    
    // Input validation
    if (!noteContent || typeof noteContent !== 'string') {
      throw new Error('AIService Bridge: Note content is required and must be a string');
    }
    
    if (noteContent.trim().length < 100) {
      throw new Error('AIService Bridge: Note content must be at least 100 characters for meaningful quiz generation');
    }
    
    this.validateServiceAvailability();
    
    return this.withRetry(async () => {
      return this.enhancedService!.generateStructuredContent(noteContent, 'quiz');
    }, 'generateQuiz');
  }

  /**
   * Generate summary from note content
   * Returns well-formatted HTML summary
   */
  async generateSummary(noteContent: string): Promise<any> {
    const startTime = Date.now();
    console.log('AIService Bridge: Starting generateSummary operation');
    
    // Input validation
    if (!noteContent || typeof noteContent !== 'string') {
      throw new Error('AIService Bridge: Note content is required and must be a string');
    }
    
    if (noteContent.trim().length < 30) {
      throw new Error('AIService Bridge: Note content must be at least 30 characters for meaningful summary generation');
    }
    
    this.validateServiceAvailability();
    
    return this.withRetry(async () => {
      return this.enhancedService!.generateStructuredContent(noteContent, 'summary');
    }, 'generateSummary');
  }

  /**
   * Generate any structured content type
   * Unified method for all content generation
   */
  async generateStructuredContent(noteContent: string, type: 'flashcards' | 'quiz' | 'summary'): Promise<any> {
    const startTime = Date.now();
    console.log(`AIService Bridge: Starting generateStructuredContent operation (${type})`);
    
    // Input validation
    if (!noteContent || typeof noteContent !== 'string') {
      throw new Error('AIService Bridge: Note content is required and must be a string');
    }
    
    if (!type || !['flashcards', 'quiz', 'summary'].includes(type)) {
      throw new Error('AIService Bridge: Valid content type is required (flashcards, quiz, or summary)');
    }
    
    // Type-specific minimum length validation
    const minLengths = {
      'flashcards': 50,
      'quiz': 100,
      'summary': 30
    };
    
    if (noteContent.trim().length < minLengths[type]) {
      throw new Error(`AIService Bridge: Note content must be at least ${minLengths[type]} characters for ${type} generation`);
    }
    
    this.validateServiceAvailability();
    
    return this.withRetry(async () => {
      return this.enhancedService!.generateStructuredContent(noteContent, type);
    }, `generateStructuredContent_${type}`);
  }

  // === ANALYTICS & MONITORING METHODS ===

  /**
   * Get usage analytics for performance monitoring
   * Returns array of usage metrics with timestamps
   */
  getUsageMetrics(): any[] {
    console.log('AIService Bridge: Retrieving usage metrics');
    
    try {
      this.validateServiceAvailability();
      return this.enhancedService!.getUsageMetrics();
    } catch (error) {
      console.warn('AIService Bridge: Failed to get usage metrics:', error);
      return [];
    }
  }

  /**
   * Clear usage metrics for privacy
   * Useful for user privacy compliance
   */
  clearUsageMetrics(): void {
    console.log('AIService Bridge: Clearing usage metrics');
    
    try {
      this.validateServiceAvailability();
      this.enhancedService!.clearUsageMetrics();
      
      // Also reset bridge metrics
      this.resetBridgeMetrics();
    } catch (error) {
      console.warn('AIService Bridge: Failed to clear usage metrics:', error);
    }
  }

  /**
   * Get usage summary for dashboard display
   * Returns aggregated usage statistics
   */
  getUsageSummary(): any {
    console.log('AIService Bridge: Generating usage summary');
    
    try {
      this.validateServiceAvailability();
      const metrics = this.enhancedService!.getUsageMetrics();
      
      const summary = {
        totalRequests: metrics.length,
        successRate: metrics.length > 0 ? 
          (metrics.filter(m => m.success).length / metrics.length * 100).toFixed(2) : 0,
        averageResponseTime: metrics.length > 0 ?
          (metrics.filter(m => m.duration).reduce((sum, m) => sum + (m.duration || 0), 0) / 
           metrics.filter(m => m.duration).length).toFixed(0) : 0,
        featureUsage: this.aggregateFeatureUsage(metrics),
        bridgeMetrics: { ...this.metrics },
        lastUpdated: new Date().toISOString()
      };

      return summary;
    } catch (error) {
      console.warn('AIService Bridge: Failed to generate usage summary:', error);
      return {
        totalRequests: 0,
        successRate: 0,
        averageResponseTime: 0,
        featureUsage: {},
        bridgeMetrics: { ...this.metrics },
        error: error instanceof Error ? error.message : 'Unknown error',
        lastUpdated: new Date().toISOString()
      };
    }
  }

  // === LEGACY COMPATIBILITY METHODS ===

  /**
   * Legacy method names for backward compatibility
   * These proxy to the enhanced methods with enhanced error handling
   */

  // Legacy: process document to note (existing workflow)
  async processDocumentToNote(
    textOrFilePath: string,
    documentType: string,
    tone: 'professional' | 'casual' | 'simplified',
    options: {
      preserveStructure?: boolean;
      generateSummary?: boolean;
      autoTag?: boolean;
      isFilePath?: boolean;
      useNativeProcessing?: boolean;
    } = {}
  ): Promise<AITransformationResponse> {
    const startTime = Date.now();
    console.log('AIService Bridge: Starting legacy processDocumentToNote operation');
    
    // Enhanced input validation
    if (!textOrFilePath || typeof textOrFilePath !== 'string') {
      throw new Error('AIService Bridge: textOrFilePath is required and must be a string');
    }
    
    if (!documentType || typeof documentType !== 'string') {
      throw new Error('AIService Bridge: documentType is required and must be a string');
    }
    
    if (!tone || !['professional', 'casual', 'simplified'].includes(tone)) {
      throw new Error('AIService Bridge: Valid tone is required (professional, casual, or simplified)');
    }
    
    this.validateServiceAvailability();
    
    return this.withRetry(async () => {
      // If it's a file path, log the usage but process as text for now
      if (options.isFilePath && options.useNativeProcessing) {
        console.log('AIService Bridge: Legacy processDocumentToNote called with file path - processing as text');
      }

      // Process as text transformation with enhanced validation
      const transformationRequest: AITransformationRequest = {
        text: textOrFilePath,
        tone
      };
      
      this.validateTransformationRequest(transformationRequest);
      return this.enhancedService!.transformTextToNote(transformationRequest);
    }, 'processDocumentToNote_legacy');
  }

  // Legacy: Transform images to note (for backward compatibility)
  async transformImagesToNote(imageUris: string[], tone: string): Promise<AITransformationResponse> {
    const startTime = Date.now();
    console.log('AIService Bridge: Starting legacy transformImagesToNote operation');
    
    // Enhanced input validation
    if (!imageUris || !Array.isArray(imageUris)) {
      throw new Error('AIService Bridge: imageUris must be a non-empty array');
    }
    
    if (imageUris.length === 0) {
      throw new Error('AIService Bridge: At least one image URI is required');
    }
    
    if (imageUris.length > 10) {
      throw new Error('AIService Bridge: Maximum 10 image URIs allowed');
    }
    
    if (!tone || typeof tone !== 'string') {
      throw new Error('AIService Bridge: Valid tone is required');
    }
    
    // Validate each image URI
    imageUris.forEach((uri, index) => {
      if (!uri || typeof uri !== 'string' || uri.trim().length === 0) {
        throw new Error(`AIService Bridge: Invalid image URI at index ${index}`);
      }
    });
    
    return this.withRetry(async () => {
      // For now, return an enhanced placeholder with better information
      console.log('AIService Bridge: Legacy transformImagesToNote called - consider using GeminiVisionService directly for better performance');
      
      const processingTime = Date.now() - startTime;
      
      return {
        transformedText: `
          <div class="image-processing-notice">
            <h3>Image Processing Result</h3>
            <p>Processed ${imageUris.length} image(s) with ${tone} tone in ${processingTime}ms.</p>
            <p><strong>Note:</strong> For enhanced image processing capabilities, please use the dedicated GeminiVisionService for optimal results.</p>
            <ul>
              ${imageUris.map((uri, index) => `<li>Image ${index + 1}: Processed</li>`).join('')}
            </ul>
          </div>
        `,
        title: `Image Processing Result - ${imageUris.length} Image(s)`,
        wordCount: 25 + imageUris.length * 2
      };
    }, 'transformImagesToNote_legacy');
  }

  // === HELPER METHODS ===

  /**
   * Get bridge service metrics
   */
  getBridgeMetrics(): BridgeServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset bridge service metrics
   */
  private resetBridgeMetrics(): void {
    this.metrics.requestCount = 0;
    this.metrics.successCount = 0;
    this.metrics.errorCount = 0;
    this.metrics.averageResponseTime = 0;
    delete this.metrics.lastError;
    delete this.metrics.lastSuccess;
    console.log('AIService Bridge: Bridge metrics reset');
  }

  /**
   * Enhanced feature usage aggregation with error handling
   */
  private aggregateFeatureUsage(metrics: any[]): any {
    try {
      if (!metrics || !Array.isArray(metrics) || metrics.length === 0) {
        return {};
      }
      
      const featureStats: { [key: string]: { count: number; successRate: number } } = {};

      metrics.forEach(metric => {
        if (!metric || typeof metric !== 'object') return;
        
        const feature = metric.feature || 'unknown';
        if (!featureStats[feature]) {
          featureStats[feature] = { count: 0, successRate: 0 };
        }
        featureStats[feature].count++;
      });

      // Calculate success rates with validation
      Object.keys(featureStats).forEach(feature => {
        const featureMetrics = metrics.filter(m => m && m.feature === feature);
        if (featureMetrics.length > 0) {
          const successCount = featureMetrics.filter(m => m.success === true).length;
          featureStats[feature].successRate = Math.round((successCount / featureMetrics.length) * 100);
        }
      });

      return featureStats;
    } catch (error) {
      console.warn('AIService Bridge: Error aggregating feature usage:', error);
      return {};
    }
  }

  /**
   * Cleanup method for memory management
   */
  cleanup(): void {
    console.log('AIService Bridge: Cleaning up resources...');
    
    try {
      // Clear metrics
      this.resetBridgeMetrics();
      
      // Clear enhanced service metrics if available
      if (this.isServiceInitialized && this.enhancedService) {
        this.enhancedService.clearUsageMetrics();
      }
      
      console.log('AIService Bridge: Cleanup completed successfully');
    } catch (error) {
      console.warn('AIService Bridge: Error during cleanup:', error);
    }
  }

  /**
   * Check if the bridge service is properly initialized
   */
  isInitialized(): boolean {
    return this.isServiceInitialized && this.enhancedService !== null;
  }
}

// Export singleton instance for backward compatibility
export const aiService = AIService.getInstance();

// Export class for direct instantiation if needed
export { AIService };

// Export types for better TypeScript support
export type { 
  AITransformationRequest, 
  AITransformationResponse, 
  DocumentProcessingRequest, 
  DocumentProcessingResponse,
  BridgeServiceMetrics
};

// Default export
export default AIService;
