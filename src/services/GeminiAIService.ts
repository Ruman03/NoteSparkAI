import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import Config from 'react-native-config';

// Enhanced interfaces
interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

interface GeminiServiceMetrics {
  requestCount: number;
  successCount: number;
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
  wordCount: number;
  originalLength: number;
  confidence: number;
  tone: string;
  processingTime: number;
  success: boolean;
  metadata?: {
    model: string;
    timestamp: string;
    inputLength: number;
    outputLength: number;
    tone: string;
  };
}

interface AIResponse {
  text: string;
  success: boolean;
  metadata?: {
    model: string;
    timestamp: string;
    inputLength: number;
    outputLength: number;
    type?: string;
    maxLength?: number;
    tone?: string;
  };
}

// Enhanced constants
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 8000,
  backoffFactor: 2
};

const REQUEST_TIMEOUT = 30000; // 30 seconds
const MIN_TEXT_LENGTH = 10;
const MAX_TEXT_LENGTH = 50000;

const NON_RETRYABLE_ERRORS = [
  'invalid api key',
  'api key not valid',
  'authentication failed',
  'quota exceeded',
  'billing',
  'permission denied'
];

const TONE_PROMPTS = {
  professional: `Transform the following text into a well-structured, professional note. Use formal language, proper headings, and organize information clearly with bullet points and structured sections.`,
  casual: `Transform the following text into a friendly, easy-to-read note. Use conversational language while keeping it organized with simple headings and bullet points.`,
  simplified: `Transform the following text into a simple, clear note. Use basic language, short sentences, and simple bullet points that are easy to understand.`
};

class GeminiAIService {
  private static instance: GeminiAIService;
  private readonly apiKey: string;
  private readonly genAI: GoogleGenerativeAI | null = null;
  private readonly model: GenerativeModel | null = null;
  private readonly metrics: GeminiServiceMetrics;
  private readonly retryOptions: RetryOptions;

  constructor() {
    // Initialize metrics tracking
    this.metrics = {
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      averageResponseTime: 0
    };

    this.retryOptions = { ...DEFAULT_RETRY_OPTIONS };

    // Use react-native-config for environment variables
    this.apiKey = Config.GEMINI_API_KEY || '';
    
    console.log('=== GeminiAIService (Legacy) Initialization ===');
    console.log('Config.GEMINI_API_KEY:', this.apiKey ? 'SET' : 'NOT SET');
    console.log('Available config keys:', Object.keys(Config));
    console.log('==============================================');
    
    if (!this.apiKey) {
      console.warn('WARNING: No Gemini API key found. AI features will not work. Please set GEMINI_API_KEY in your .env file');
    } else {
      try {
        // @ts-ignore - Assign to readonly property in constructor
        this.genAI = new GoogleGenerativeAI(this.apiKey);
        // Use Gemini 2.5 Flash for optimal speed and cost
        // @ts-ignore - Assign to readonly property in constructor
        this.model = this.genAI.getGenerativeModel({ 
          model: "gemini-2.5-flash",
          generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            topK: 40,
            maxOutputTokens: 3000,
          }
        });
        console.log('GeminiAIService: Successfully initialized Gemini 2.5 Flash model');
      } catch (error) {
        console.error('GeminiAIService: Failed to initialize Gemini model:', error);
      }
    }
  }

  static getInstance(): GeminiAIService {
    if (!GeminiAIService.instance) {
      GeminiAIService.instance = new GeminiAIService();
    }
    return GeminiAIService.instance;
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
            setTimeout(() => reject(new Error(`Operation timeout after ${REQUEST_TIMEOUT}ms`)), REQUEST_TIMEOUT)
          )
        ]);
        
        // Update metrics on success
        const responseTime = Date.now() - startTime;
        this.updateMetrics(true, responseTime);
        
        if (attempt > 1) {
          console.log(`GeminiAIService: ${operationName} succeeded on attempt ${attempt}`);
        }
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Update metrics on error
        this.updateMetrics(false, 0, lastError.message);
        
        // Check if error is non-retryable
        if (this.isNonRetryableError(lastError)) {
          console.error(`GeminiAIService: Non-retryable error in ${operationName}:`, lastError.message);
          throw lastError;
        }
        
        if (attempt > options.maxRetries) {
          console.error(`GeminiAIService: ${operationName} failed after ${options.maxRetries} retries:`, lastError.message);
          throw new Error(`${operationName} failed after ${options.maxRetries} retries: ${lastError.message}`);
        }
        
        // Calculate delay with jitter
        const delay = Math.min(
          options.baseDelay * Math.pow(options.backoffFactor, attempt - 1),
          options.maxDelay
        );
        const jitter = Math.random() * 0.1 * delay;
        const finalDelay = delay + jitter;
        
        console.warn(`GeminiAIService: ${operationName} failed on attempt ${attempt}, retrying in ${Math.round(finalDelay)}ms:`, lastError.message);
        
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
   * Comprehensive input validation for text processing
   */
  private validateTextInput(text: string, operationName: string): void {
    if (!text || typeof text !== 'string') {
      throw new Error(`${operationName}: Text input is required and must be a string`);
    }
    
    if (text.trim().length < MIN_TEXT_LENGTH) {
      throw new Error(`${operationName}: Text must be at least ${MIN_TEXT_LENGTH} characters long`);
    }
    
    if (text.length > MAX_TEXT_LENGTH) {
      throw new Error(`${operationName}: Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters`);
    }
  }

  /**
   * Validate transformation request parameters
   */
  private validateTransformationRequest(request: AITransformationRequest): void {
    if (!request) {
      throw new Error('GeminiAIService: Request object is required');
    }
    
    this.validateTextInput(request.text, 'TransformTextToNote');
    
    if (!request.tone || !['professional', 'casual', 'simplified'].includes(request.tone)) {
      throw new Error('GeminiAIService: Valid tone is required (professional, casual, or simplified)');
    }
  }

  /**
   * Check service availability
   */
  isServiceAvailable(): boolean {
    return !!(this.apiKey && this.model);
  }

  /**
   * Get service metrics
   */
  getMetrics(): GeminiServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Transform text to a structured note with enhanced error handling
   */
  async transformTextToNote(request: AITransformationRequest): Promise<AITransformationResponse> {
    return this.withRetry(async () => {
      if (!this.isServiceAvailable()) {
        throw new Error('GeminiAIService: Service not available. Please check API key configuration.');
      }

      this.validateTransformationRequest(request);

      const prompt = TONE_PROMPTS[request.tone] || TONE_PROMPTS.professional;
      
      const fullPrompt = `${prompt}

Raw text to transform:

${request.text}`;

      console.log('GeminiAIService: Sending request to Gemini 2.5 Flash...');

      const result = await this.model!.generateContent(fullPrompt);
      
      if (!result?.response) {
        throw new Error('GeminiAIService: No response received from Gemini API');
      }

      const responseText = result.response.text();
      
      if (!responseText || responseText.trim().length === 0) {
        throw new Error('GeminiAIService: Empty response from Gemini API');
      }

      const cleanedResponse = this.cleanupAIResponse(responseText);
      const wordCount = this.countWords(cleanedResponse);

      console.log('GeminiAIService: Successfully transformed text to note');

      return {
        transformedText: cleanedResponse,
        wordCount: wordCount,
        originalLength: request.text.length,
        confidence: 0.95, // High confidence for Gemini 2.5 Flash
        tone: request.tone,
        processingTime: Date.now(),
        success: true,
        metadata: {
          model: 'gemini-2.5-flash',
          timestamp: new Date().toISOString(),
          inputLength: request.text.length,
          outputLength: cleanedResponse.length,
          tone: request.tone
        }
      };
    }, 'transformTextToNote');
  }

  /**
   * Analyze text sentiment with enhanced error handling
   */
  async analyzeSentiment(text: string): Promise<AIResponse> {
    return this.withRetry(async () => {
      if (!this.isServiceAvailable()) {
        throw new Error('GeminiAIService: Service not available. Please check API key configuration.');
      }

      this.validateTextInput(text, 'analyzeSentiment');

      const prompt = `Analyze the sentiment of the following text. Provide a brief analysis including:
      1. Overall sentiment (positive, negative, or neutral)
      2. Confidence level (high, medium, low)
      3. Key emotional indicators
      4. Brief explanation

      Text: ${text}`;

      console.log('GeminiAIService: Analyzing sentiment...');

      const result = await this.model!.generateContent(prompt);
      
      if (!result?.response) {
        throw new Error('GeminiAIService: No response received from Gemini API');
      }

      const responseText = result.response.text();
      
      if (!responseText || responseText.trim().length === 0) {
        throw new Error('GeminiAIService: Empty response from Gemini API');
      }

      console.log('GeminiAIService: Successfully analyzed sentiment');

      return {
        text: responseText.trim(),
        success: true,
        metadata: {
          model: 'gemini-2.5-flash',
          timestamp: new Date().toISOString(),
          inputLength: text.length,
          outputLength: responseText.length,
          type: 'sentiment-analysis'
        }
      };
    }, 'analyzeSentiment');
  }

  /**
   * Summarize text with enhanced error handling
   */
  async summarizeText(text: string, maxLength?: number): Promise<AIResponse> {
    return this.withRetry(async () => {
      if (!this.isServiceAvailable()) {
        throw new Error('GeminiAIService: Service not available. Please check API key configuration.');
      }

      this.validateTextInput(text, 'summarizeText');

      const lengthInstruction = maxLength 
        ? `Keep the summary under ${maxLength} words.` 
        : 'Provide a concise summary.';

      const prompt = `Summarize the following text. ${lengthInstruction} Focus on the key points and main ideas.

      Text: ${text}`;

      console.log('GeminiAIService: Summarizing text...');

      const result = await this.model!.generateContent(prompt);
      
      if (!result?.response) {
        throw new Error('GeminiAIService: No response received from Gemini API');
      }

      const responseText = result.response.text();
      
      if (!responseText || responseText.trim().length === 0) {
        throw new Error('GeminiAIService: Empty response from Gemini API');
      }

      console.log('GeminiAIService: Successfully summarized text');

      return {
        text: responseText.trim(),
        success: true,
        metadata: {
          model: 'gemini-2.5-flash',
          timestamp: new Date().toISOString(),
          inputLength: text.length,
          outputLength: responseText.length,
          type: 'summary',
          maxLength: maxLength
        }
      };
    }, 'summarizeText');
  }

  /**
   * Generate a title for note content with enhanced error handling
   */
  async generateNoteTitle(content: string): Promise<string> {
    return this.withRetry(async () => {
      if (!this.isServiceAvailable()) {
        return this.generateFallbackTitle(content);
      }

      this.validateTextInput(content, 'generateNoteTitle');

      const prompt = `Generate a concise, descriptive title (max 60 characters) for the following study notes. Return only the title, no quotes or extra text.

Content: ${content.substring(0, 500)}...`;

      const result = await this.model!.generateContent(prompt);
      
      if (!result?.response) {
        return this.generateFallbackTitle(content);
      }

      const responseText = result.response.text();
      
      if (!responseText || responseText.trim().length === 0) {
        return this.generateFallbackTitle(content);
      }

      const title = responseText.trim().replace(/^["']|["']$/g, '');
      
      // Ensure title is not too long
      return title.length > 60 ? title.substring(0, 57) + '...' : title;
    }, 'generateNoteTitle', { maxRetries: 1 }); // Fewer retries for title generation
  }

  /**
   * Generate fallback title when AI generation fails
   */
  private generateFallbackTitle(content: string): string {
    // Extract first meaningful line as title
    const lines = content.replace(/<[^>]*>/g, '').split('\n');
    const meaningfulLine = lines.find(line => line.trim().length > 0);
    
    if (meaningfulLine) {
      const title = meaningfulLine.trim().substring(0, 60);
      return title.length === 60 ? title + '...' : title;
    }
    
    // Generate timestamp-based title as last resort
    const date = new Date().toLocaleDateString();
    return `Study Notes - ${date}`;
  }

  /**
   * Clean up AI response by removing markdown code blocks and extra formatting
   */
  private cleanupAIResponse(response: string): string {
    // Remove markdown code blocks (```html, ```text, etc.)
    let cleaned = response.replace(/^```\w*\n?/gm, '').replace(/\n?```$/gm, '');
    
    // Remove any leading/trailing whitespace
    cleaned = cleaned.trim();
    
    // Remove any HTML comments that might have been added
    cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
    
    // Log the cleanup for debugging
    if (response !== cleaned) {
      console.log('GeminiAIService: Cleaned up AI response - removed markdown code blocks');
    }
    
    return cleaned;
  }

  /**
   * Count words in text (excluding HTML tags)
   */
  private countWords(text: string): number {
    // Remove HTML tags and count words
    const plainText = text.replace(/<[^>]*>/g, '');
    const words = plainText.trim().split(/\s+/).filter(word => word.length > 0);
    return words.length;
  }

  /**
   * Health check method to verify API connectivity
   */
  async checkAPIHealth(): Promise<boolean> {
    try {
      if (!this.isServiceAvailable()) {
        return false;
      }
      
      // Test with a simple prompt
      const result = await this.model!.generateContent('Test connection');
      return !!(result && result.response);
    } catch (error) {
      console.warn('GeminiAIService: Health check failed:', error);
      return false;
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  async testService(): Promise<{ text: string; success: boolean }> {
    if (!this.apiKey) {
      return { 
        text: 'Service not available: No API key configured. Please set GEMINI_API_KEY in your .env file', 
        success: false 
      };
    }

    if (!this.model) {
      return { 
        text: 'Service not available: Model not initialized', 
        success: false 
      };
    }

    try {
      const result = await this.model.generateContent("Say 'Hello from Gemini AI Service!'");
      if (result?.response) {
        return {
          text: result.response.text(),
          success: true
        };
      }
      return {
        text: 'Service test failed: No response received',
        success: false
      };
    } catch (error) {
      console.error('GeminiAIService: Test service failed:', error);
      return {
        text: `Service test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false
      };
    }
  }
}

export { GeminiAIService, type AITransformationRequest, type AITransformationResponse, type AIResponse };
