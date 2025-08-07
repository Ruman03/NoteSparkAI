// Enhanced AIService with Firebase ecosystem preparation
// OPTIMIZED: Comprehensive error handling, retry logic, and performance monitoring
// Advanced features complementing the base AIService with structured content generation

import { GoogleGenerativeAI } from '@google/generative-ai';
import Config from 'react-native-config';
import { AuthService } from '../config/firebase';

// Enhanced interfaces for better type safety and functionality
interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

interface EnhancedAIMetrics {
  textTransformations: number;
  documentProcessing: number;
  structuredGeneration: number;
  titleGeneration: number;
  healthChecks: number;
  errorCount: number;
  averageResponseTime: number;
  lastSuccess?: Date;
  lastError?: string;
}

interface AITransformationRequest {
  text: string;
  tone: 'professional' | 'casual' | 'simplified';
}

interface AITransformationResponse {
  transformedText: string;
  title: string;
  wordCount: number;
  processingTime: number;
}

interface DocumentProcessingRequest {
  fileData: string;
  mimeType: string;
  prompt: string;
}

interface DocumentProcessingResponse {
  extractedContent: string;
  title: string;
  processingTime: number;
}

interface UsageMetrics {
  feature: string;
  variant: string;
  userId?: string;
  timestamp: Date;
  success: boolean;
  duration?: number;
}

// Enhanced constants
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2
};

const AI_OPERATION_TIMEOUT = 45000; // 45 seconds timeout for AI operations
const MAX_CONCURRENT_OPERATIONS = 3; // Maximum concurrent AI operations
const MAX_CONTENT_LENGTH = 100000; // Maximum content length for processing
const MAX_USAGE_METRICS = 1000; // Maximum stored usage metrics

const NON_RETRYABLE_ERRORS = [
  'quota exceeded',
  'invalid api key',
  'unauthorized',
  'permission denied',
  'content policy violation',
  'model not available'
];

/**
 * Enhanced AI Service with advanced features and comprehensive monitoring
 * OPTIMIZED: Comprehensive error handling, retry logic, and performance monitoring
 */
class EnhancedAIService {
  private static instance: EnhancedAIService;
  private model: any;
  private apiKey: string;
  private userId: string | null = null;
  private usageMetrics: UsageMetrics[] = [];
  private metrics: EnhancedAIMetrics = {
    textTransformations: 0,
    documentProcessing: 0,
    structuredGeneration: 0,
    titleGeneration: 0,
    healthChecks: 0,
    errorCount: 0,
    averageResponseTime: 0
  };
  private activeOperations = new Set<string>();

  constructor() {
    this.apiKey = Config.GEMINI_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('WARNING: No Gemini API key found. Enhanced AI features will not work.');
    } else {
      const genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 4000,
        }
      });
    }

    // Setup Firebase integration
    this.setupFirebaseIntegration();
    console.log('EnhancedAIService: Initialized with comprehensive monitoring and Firebase ecosystem integration');
  }

  static getInstance(): EnhancedAIService {
    if (!EnhancedAIService.instance) {
      EnhancedAIService.instance = new EnhancedAIService();
    }
    return EnhancedAIService.instance;
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
  private validateInput(operation: string, data: any): void {
    switch (operation) {
      case 'transformText':
        if (!data.text || typeof data.text !== 'string' || data.text.trim().length === 0) {
          throw new Error('transformText: Invalid text provided');
        }
        if (data.text.length > MAX_CONTENT_LENGTH) {
          throw new Error(`transformText: Content too long (max ${MAX_CONTENT_LENGTH} characters)`);
        }
        if (!data.tone || !['professional', 'casual', 'simplified'].includes(data.tone)) {
          throw new Error('transformText: Invalid tone provided');
        }
        break;
      case 'processDocument':
        if (!data.fileData || typeof data.fileData !== 'string') {
          throw new Error('processDocument: Invalid fileData provided');
        }
        if (!data.mimeType || typeof data.mimeType !== 'string') {
          throw new Error('processDocument: Invalid mimeType provided');
        }
        if (!data.prompt || typeof data.prompt !== 'string') {
          throw new Error('processDocument: Invalid prompt provided');
        }
        break;
    }
  }

  /**
   * Check if service is available
   */
  private isServiceAvailable(): boolean {
    try {
      return !!this.apiKey && !!this.model;
    } catch (error) {
      console.error('Enhanced AI Service not available:', error);
      return false;
    }
  }

  /**
   * Update service metrics
   */
  private updateMetrics(operation: string, data: any = {}): void {
    try {
      switch (operation) {
        case 'text_transformation':
          this.metrics.textTransformations++;
          this.metrics.lastSuccess = new Date();
          if (data.responseTime) {
            this.updateAverageResponseTime(data.responseTime);
          }
          break;
        case 'document_processing':
          this.metrics.documentProcessing++;
          this.metrics.lastSuccess = new Date();
          if (data.responseTime) {
            this.updateAverageResponseTime(data.responseTime);
          }
          break;
        case 'structured_generation':
          this.metrics.structuredGeneration++;
          this.metrics.lastSuccess = new Date();
          if (data.responseTime) {
            this.updateAverageResponseTime(data.responseTime);
          }
          break;
        case 'title_generation':
          this.metrics.titleGeneration++;
          this.metrics.lastSuccess = new Date();
          break;
        case 'health_check':
          this.metrics.healthChecks++;
          break;
        case 'error':
          this.metrics.errorCount++;
          this.metrics.lastError = data.error || 'Unknown error';
          break;
      }
    } catch (error) {
      console.error('Error updating enhanced AI service metrics:', error);
    }
  }

  /**
   * Update average response time
   */
  private updateAverageResponseTime(responseTime: number): void {
    const totalOperations = this.metrics.textTransformations + this.metrics.documentProcessing + this.metrics.structuredGeneration;
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (totalOperations - 1) + responseTime) / totalOperations;
  }

  private setupFirebaseIntegration() {
    // Listen to Firebase Auth state changes for user context
    AuthService.onAuthStateChanged((user) => {
      this.userId = user?.uid || null;
      console.log('EnhancedAIService: Firebase user context updated:', 
        this.userId ? 'Authenticated' : 'Anonymous');
    });
  }

  // Enhanced text transformation with comprehensive error handling and validation
  async transformTextToNote(request: AITransformationRequest): Promise<AITransformationResponse> {
    const operationId = `transform_${Date.now()}`;
    const startTime = Date.now();
    
    try {
      // Input validation
      this.validateInput('transformText', request);

      // Service availability check
      if (!this.isServiceAvailable()) {
        throw new Error('Enhanced AI Service is not available - check API key configuration');
      }

      // Concurrency control
      if (this.activeOperations.size >= MAX_CONCURRENT_OPERATIONS) {
        throw new Error('Maximum concurrent operations limit reached');
      }

      this.activeOperations.add(operationId);

      console.log('EnhancedAIService: Processing text transformation with comprehensive error handling...');
      
      return await this.withRetry(async () => {
        // Enhanced prompt with user context
        const enhancedPrompt = this.buildEnhancedPrompt(request);
        
        // API call with timeout protection
        const apiCallPromise = this.model.generateContent(enhancedPrompt);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AI operation timeout')), AI_OPERATION_TIMEOUT)
        );

        const result = await Promise.race([apiCallPromise, timeoutPromise]);
        const response = await result.response;
        let transformedText = response.text();

        if (!transformedText) {
          throw new Error('No content received from Gemini API');
        }

        // Clean up response
        transformedText = this.cleanupAIResponse(transformedText);
        
        // Generate title and count words
        const title = await this.generateNoteTitle(transformedText);
        const wordCount = this.countWords(transformedText);
        const processingTime = Date.now() - startTime;

        // Track successful usage
        this.trackUsage('text_transformation', request.tone, true, processingTime);
        this.updateMetrics('text_transformation', { responseTime: processingTime });

        console.log('EnhancedAIService: Text transformation completed successfully');

        return {
          transformedText,
          title,
          wordCount,
          processingTime
        };
      }, 'transformTextToNote');

    } catch (error) {
      const processingTime = Date.now() - startTime;
      // Enhanced error tracking
      this.trackUsage('text_transformation', request.tone, false, processingTime);
      this.trackError('text_transformation', error);
      this.updateMetrics('error', { error: error instanceof Error ? error.message : String(error) });
      
      console.error('EnhancedAIService: Text transformation error:', error);
      throw new Error(`Enhanced AI processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.activeOperations.delete(operationId);
    }
  }

  // Enhanced document processing with comprehensive error handling
  async processDocumentWithGemini(request: DocumentProcessingRequest): Promise<DocumentProcessingResponse> {
    const operationId = `process_${Date.now()}`;
    const startTime = Date.now();
    
    try {
      // Input validation
      this.validateInput('processDocument', request);

      // Service availability check
      if (!this.isServiceAvailable()) {
        throw new Error('Enhanced AI Service is not available - check API key configuration');
      }

      // Concurrency control
      if (this.activeOperations.size >= MAX_CONCURRENT_OPERATIONS) {
        throw new Error('Maximum concurrent operations limit reached');
      }

      this.activeOperations.add(operationId);

      console.log(`EnhancedAIService: Processing document with enhanced error handling (${request.mimeType})`);

      return await this.withRetry(async () => {
        const fileData = {
          inlineData: {
            data: request.fileData,
            mimeType: request.mimeType
          }
        };

        const contents = [
          {
            role: 'user',
            parts: [fileData, { text: request.prompt }]
          }
        ];

        // API call with timeout protection
        const apiCallPromise = this.model.generateContent({
          contents,
          generationConfig: {
            temperature: 0.3,
            topP: 0.9,
            topK: 40,
            maxOutputTokens: 8000,
          }
        });

        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Document processing timeout')), AI_OPERATION_TIMEOUT)
        );

        const result = await Promise.race([apiCallPromise, timeoutPromise]);
        const response = await result.response;
        const extractedContent = response.text();

        if (!extractedContent || extractedContent.trim() === '') {
          throw new Error('No content extracted from document');
        }

        const title = await this.generateNoteTitle(extractedContent);
        const processingTime = Date.now() - startTime;

        // Track successful document processing
        this.trackUsage('document_processing', request.mimeType, true, processingTime);
        this.updateMetrics('document_processing', { responseTime: processingTime });

        console.log('EnhancedAIService: Document processing completed successfully');

        return {
          extractedContent: this.cleanupAIResponse(extractedContent),
          title,
          processingTime
        };
      }, 'processDocumentWithGemini');

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.trackUsage('document_processing', request.mimeType, false, processingTime);
      this.trackError('document_processing', error);
      this.updateMetrics('error', { error: error instanceof Error ? error.message : String(error) });
      
      console.error('EnhancedAIService: Document processing error:', error);
      throw new Error(`Document processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.activeOperations.delete(operationId);
    }
  }

  // New: Structured content generation (preparing for Firebase AI Logic)
  async generateStructuredContent(noteContent: string, outputType: 'flashcards' | 'quiz' | 'summary'): Promise<any> {
    const startTime = Date.now();
    
    try {
      if (!this.model) {
        throw new Error('Gemini model not initialized. Check API key configuration.');
      }

      console.log(`EnhancedAIService: Generating ${outputType} with structured output`);

      let prompt = '';
      
      switch (outputType) {
        case 'flashcards':
          prompt = `Generate 5-8 educational flashcards from the following notes content. 
Return as a clean JSON array with objects containing: question, answer, and difficulty (easy/medium/hard).
Ensure JSON is properly formatted without markdown formatting.

Notes content:
${noteContent}`;
          break;
          
        case 'quiz':
          prompt = `Generate a 5-question multiple choice quiz from the following notes. 
Return as clean JSON with a "questions" array containing objects with: question, options (array of 4 choices), correctAnswer (0-3 index), and explanation.
Ensure JSON is properly formatted without markdown formatting.

Notes content:
${noteContent}`;
          break;
          
        case 'summary':
          prompt = `Generate a concise, well-structured summary of the following notes. 
Focus on key points, main concepts, and important details. Format as clean HTML with headings and bullet points.

Notes content:
${noteContent}`;
          break;
      }

      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 3000,
        }
      });

      const response = await result.response;
      const content = response.text();

      // Track successful generation
      this.trackUsage(`generate_${outputType}`, 'structured', true, Date.now() - startTime);

      if (outputType === 'flashcards' || outputType === 'quiz') {
        try {
          // Clean and parse JSON response
          const cleanedContent = this.cleanJsonResponse(content);
          const parsedContent = JSON.parse(cleanedContent);
          
          console.log(`EnhancedAIService: ${outputType} generated successfully`);
          return { data: parsedContent, type: outputType };
        } catch (parseError) {
          console.warn(`Failed to parse ${outputType} JSON, returning raw content`);
          return { content, type: outputType, parseError: true };
        }
      }

      console.log(`EnhancedAIService: ${outputType} generated successfully`);
      return { content, type: outputType };

    } catch (error) {
      this.trackUsage(`generate_${outputType}`, 'structured', false, Date.now() - startTime);
      this.trackError(`generate_${outputType}`, error);
      
      console.error(`EnhancedAIService: ${outputType} generation error:`, error);
      throw new Error(`${outputType} generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Enhanced title generation
  async generateNoteTitle(content: string): Promise<string> {
    try {
      if (!this.model) {
        return this.generateFallbackTitle(content);
      }

      const prompt = `Generate a concise, descriptive title (max 60 characters) for the following study notes. 
Return only the title, no quotes or extra text.

Content: ${content.substring(0, 1000)}`;

      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 20,
        }
      });
      
      const response = await result.response;
      const title = response.text()?.trim() || '';
      
      return title || this.generateFallbackTitle(content);
    } catch (error) {
      console.warn('EnhancedAIService: Title generation failed, using fallback:', error);
      return this.generateFallbackTitle(content);
    }
  }

  // Generate document title (for compatibility)
  async generateDocumentTitle(content: string, documentType: string): Promise<string> {
    try {
      if (!this.model) {
        return this.generateFallbackDocumentTitle(content, documentType);
      }

      const prompt = `Generate a concise, descriptive title (max 60 characters) for this ${documentType} document. Return only the title, no quotes or extra text.

Content: ${content.substring(0, 1000)}`;

      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 25,
        }
      });
      
      const response = await result.response;
      const title = response.text()?.trim() || '';
      
      return title || this.generateFallbackDocumentTitle(content, documentType);
    } catch (error) {
      console.warn('EnhancedAIService: Document title generation failed, using fallback:', error);
      return this.generateFallbackDocumentTitle(content, documentType);
    }
  }

  // Health check with enhanced diagnostics
  async checkAPIHealth(): Promise<{ healthy: boolean; details: any }> {
    try {
      if (!this.model) {
        return { 
          healthy: false, 
          details: { error: 'Model not initialized', hasApiKey: !!this.apiKey } 
        };
      }

      const startTime = Date.now();
      const result = await this.model.generateContent('Test connection: respond with "OK"');
      const response = await result.response;
      const responseTime = Date.now() - startTime;
      const responseText = response.text();

      const healthy = responseText?.includes('OK') || false;

      return {
        healthy,
        details: {
          responseTime,
          responseText: responseText?.substring(0, 50),
          userId: this.userId,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  // Get usage analytics with enhanced filtering (preparing for Firebase Analytics)
  getUsageMetrics(filter?: { feature?: string; timeRange?: number }): UsageMetrics[] {
    try {
      let metrics = [...this.usageMetrics];
      
      if (filter?.feature) {
        metrics = metrics.filter(m => m.feature === filter.feature);
      }
      
      if (filter?.timeRange) {
        const cutoff = new Date(Date.now() - filter.timeRange);
        metrics = metrics.filter(m => m.timestamp >= cutoff);
      }
      
      return metrics;
    } catch (error) {
      console.error('Error getting usage metrics:', error);
      return [];
    }
  }

  // Clear metrics with enhanced confirmation (for privacy)
  clearUsageMetrics(): { cleared: number; success: boolean } {
    try {
      const count = this.usageMetrics.length;
      this.usageMetrics = [];
      console.log(`EnhancedAIService: ${count} usage metrics cleared`);
      return { cleared: count, success: true };
    } catch (error) {
      console.error('Error clearing usage metrics:', error);
      return { cleared: 0, success: false };
    }
  }

  /**
   * Get service health status and metrics
   */
  public getServiceHealth(): {
    isHealthy: boolean;
    metrics: EnhancedAIMetrics;
    activeOperations: number;
    serviceStatus: string;
    configurationStatus: any;
  } {
    try {
      const isHealthy = this.isServiceAvailable() && this.metrics.errorCount < 10;
      
      return {
        isHealthy,
        metrics: { ...this.metrics },
        activeOperations: this.activeOperations.size,
        serviceStatus: isHealthy ? 'healthy' : 'degraded',
        configurationStatus: {
          hasApiKey: !!this.apiKey,
          hasModel: !!this.model,
          userId: this.userId,
          firebaseConnected: !!this.userId
        }
      };
    } catch (error) {
      console.error('Error getting service health:', error);
      return {
        isHealthy: false,
        metrics: { ...this.metrics },
        activeOperations: 0,
        serviceStatus: 'failed',
        configurationStatus: null
      };
    }
  }

  /**
   * Get service statistics
   */
  public getServiceStatistics(): {
    totalOperations: number;
    successRate: number;
    averageResponseTime: number;
    usageByFeature: Record<string, number>;
    uptime: string;
  } {
    try {
      const totalOperations = this.metrics.textTransformations + this.metrics.documentProcessing + 
                             this.metrics.structuredGeneration + this.metrics.titleGeneration;
      const successfulOperations = totalOperations - this.metrics.errorCount;
      const successRate = totalOperations > 0 ? (successfulOperations / totalOperations) * 100 : 100;

      // Calculate usage by feature
      const usageByFeature: Record<string, number> = {};
      this.usageMetrics.forEach(metric => {
        usageByFeature[metric.feature] = (usageByFeature[metric.feature] || 0) + 1;
      });

      return {
        totalOperations,
        successRate: Math.round(successRate * 100) / 100,
        averageResponseTime: Math.round(this.metrics.averageResponseTime),
        usageByFeature,
        uptime: this.metrics.lastSuccess ? 
          `Last success: ${this.metrics.lastSuccess.toISOString()}` : 
          'No successful operations yet'
      };
    } catch (error) {
      console.error('Error getting service statistics:', error);
      return {
        totalOperations: 0,
        successRate: 0,
        averageResponseTime: 0,
        usageByFeature: {},
        uptime: 'Error retrieving statistics'
      };
    }
  }

  /**
   * Reset service metrics (for testing/debugging)
   */
  public resetMetrics(): void {
    try {
      this.metrics = {
        textTransformations: 0,
        documentProcessing: 0,
        structuredGeneration: 0,
        titleGeneration: 0,
        healthChecks: 0,
        errorCount: 0,
        averageResponseTime: 0
      };
      this.usageMetrics = [];
      this.activeOperations.clear();
      console.log('EnhancedAIService metrics reset successfully');
    } catch (error) {
      console.error('Error resetting EnhancedAIService metrics:', error);
    }
  }

  // Private helper methods
  private buildEnhancedPrompt(request: AITransformationRequest): string {
    const tonePrompts = {
      professional: `Transform the following raw text into well-structured, professional study notes. Format the output as clean HTML with proper headings, bullet points, and emphasis where appropriate. Focus on clarity, organization, and academic tone. Use <h2>, <h3>, <ul>, <li>, <strong>, and <em> tags as needed. Make sure the content is comprehensive and well-organized for studying. IMPORTANT: Return only the HTML content without any markdown code blocks or backticks.`,
      casual: `Transform the following raw text into friendly, easy-to-read study notes. Use a conversational tone that makes the content approachable and engaging. Format as HTML with headings, bullet points, and emphasis. Use <h2>, <h3>, <ul>, <li>, <strong>, and <em> tags. Make it feel like notes from a study buddy who explains things clearly and simply. IMPORTANT: Return only the HTML content without any markdown code blocks or backticks.`,
      simplified: `Transform the following raw text into simple, concise study notes that are easy to understand. Break down complex concepts into digestible pieces. Use clear, straightforward language and format as HTML with basic structure. Use <h2>, <h3>, <ul>, <li>, <strong>, and <em> tags. Focus on the most important points and make everything crystal clear. IMPORTANT: Return only the HTML content without any markdown code blocks or backticks.`
    } as const;

    const basePrompt = tonePrompts[request.tone];
    
    // Add Firebase user context (when available)
    const userContext = this.userId 
      ? `\n[User Context: Authenticated user - personalize content appropriately]` 
      : `\n[User Context: Anonymous user - provide general educational content]`;
    
    return `${basePrompt}${userContext}\n\nRaw text to transform:\n\n${request.text}`;
  }

  private cleanJsonResponse(response: string): string {
    // Remove markdown code blocks if present
    let cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    // Find JSON content between first { or [ and last } or ]
    const firstJson = Math.min(
      cleaned.indexOf('{') === -1 ? Infinity : cleaned.indexOf('{'),
      cleaned.indexOf('[') === -1 ? Infinity : cleaned.indexOf('[')
    );
    
    const lastJson = Math.max(
      cleaned.lastIndexOf('}'),
      cleaned.lastIndexOf(']')
    );
    
    if (firstJson !== Infinity && lastJson !== -1) {
      cleaned = cleaned.substring(firstJson, lastJson + 1);
    }
    
    return cleaned;
  }

  private cleanupAIResponse(response: string): string {
    return response
      .replace(/```html\s*/g, '')
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();
  }

  private countWords(text: string): number {
    const cleanText = text.replace(/<[^>]*>/g, '');
    return cleanText.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  private generateFallbackTitle(content: string): string {
    const lines = content.replace(/<[^>]*>/g, '').split('\n');
    const meaningfulLine = lines.find(line => line.trim().length > 0);
    
    if (meaningfulLine) {
      const title = meaningfulLine.trim().substring(0, 60);
      return title.length === 60 ? title + '...' : title;
    }
    
    const date = new Date().toLocaleDateString();
    return `Study Notes - ${date}`;
  }

  private generateFallbackDocumentTitle(content: string, documentType: string): string {
    const lines = content.replace(/<[^>]*>/g, '').split('\n');
    const meaningfulLine = lines.find(line => line.trim().length > 0);
    
    if (meaningfulLine) {
      const title = meaningfulLine.trim().substring(0, 50);
      return title.length === 50 ? title + '...' : title;
    }
    
    const date = new Date().toLocaleDateString();
    return `${documentType} Document - ${date}`;
  }

  private trackUsage(feature: string, variant: string, success: boolean, duration?: number) {
    try {
      const metric: UsageMetrics = {
        feature,
        variant,
        userId: this.userId || undefined,
        timestamp: new Date(),
        success,
        duration
      };

      this.usageMetrics.push(metric);

      // Keep only last MAX_USAGE_METRICS to avoid memory issues
      if (this.usageMetrics.length > MAX_USAGE_METRICS) {
        this.usageMetrics = this.usageMetrics.slice(-MAX_USAGE_METRICS);
      }

      console.log(`Usage tracked: ${feature}(${variant}) - ${success ? 'SUCCESS' : 'FAILED'}${duration ? ` in ${duration}ms` : ''}`);

      // TODO: When migrating to Firebase AI Logic, integrate with Firebase Analytics
      // analytics().logEvent('enhanced_ai_feature_used', {
      //   feature,
      //   variant,
      //   success,
      //   duration,
      //   user_id: this.userId
      // });
    } catch (error) {
      console.error('Error tracking usage metrics:', error);
    }
  }

  private trackError(feature: string, error: any) {
    try {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error tracked: ${feature} - ${errorMessage}`);

      // TODO: When migrating to Firebase AI Logic, integrate with Firebase Crashlytics
      // crashlytics().recordError(error);
      // crashlytics().log(`Enhanced AI Service error in ${feature}: ${errorMessage}`);
    } catch (trackingError) {
      console.error('Error in error tracking:', trackingError);
    }
  }
}

export default EnhancedAIService;
