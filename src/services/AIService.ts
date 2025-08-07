// NoteSpark AI - Gemini AI Transformation Service
// Cost-effective migration from OpenAI to Google Gemini 2.5 Flash
// Maintains exact same interface and output format for seamless transition
// Enhanced with comprehensive error handling, retry logic, and performance optimization

import { GoogleGenerativeAI, GenerativeModel, GenerateContentResult } from '@google/generative-ai';
import Config from 'react-native-config';
import { GeminiVisionService } from './GeminiVisionService';

interface TonePrompts {
  [key: string]: string;
}

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
  fileData: string; // base64 encoded file data
  mimeType: string;
  prompt: string;
}

interface DocumentProcessingResponse {
  extractedContent: string;
  title?: string;
}

interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

interface AIServiceMetrics {
  requestCount: number;
  successCount: number;
  errorCount: number;
  averageResponseTime: number;
  lastError?: string;
  lastSuccess?: Date;
}

const TONE_PROMPTS: TonePrompts = {
  professional: `Transform the following raw text into well-structured, professional study notes. Format the output as clean HTML with proper headings, bullet points, and emphasis where appropriate. Focus on clarity, organization, and academic tone. Use <h2>, <h3>, <ul>, <li>, <strong>, and <em> tags as needed. Make sure the content is comprehensive and well-organized for studying. IMPORTANT: Return only the HTML content without any markdown code blocks or backticks.`,
  
  casual: `Transform the following raw text into friendly, easy-to-read study notes. Use a conversational tone that makes the content approachable and engaging. Format as HTML with headings, bullet points, and emphasis. Use <h2>, <h3>, <ul>, <li>, <strong>, and <em> tags. Make it feel like notes from a study buddy who explains things clearly and simply. IMPORTANT: Return only the HTML content without any markdown code blocks or backticks.`,
  
  simplified: `Transform the following raw text into simple, concise study notes that are easy to understand. Break down complex concepts into digestible pieces. Use clear, straightforward language and format as HTML with basic structure. Use <h2>, <h3>, <ul>, <li>, <strong>, and <em> tags. Focus on the most important points and make everything crystal clear. IMPORTANT: Return only the HTML content without any markdown code blocks or backticks.`
};

// Enhanced retry configuration
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2.0
};

// Request timeout configuration
const REQUEST_TIMEOUT = 60000; // 60 seconds for AI requests
const TITLE_GENERATION_TIMEOUT = 15000; // 15 seconds for title generation
const HEALTH_CHECK_TIMEOUT = 10000; // 10 seconds for health checks

// Text length limits for optimization
const MAX_TEXT_LENGTH = 50000; // Maximum text length for processing
const MAX_TITLE_LENGTH = 80; // Maximum title length
const MIN_TEXT_LENGTH = 10; // Minimum meaningful text length

// Non-retryable error patterns
const NON_RETRYABLE_ERRORS = [
  'invalid_api_key',
  'quota_exceeded',
  'model_not_found',
  'unsupported_format',
  'content_policy_violation',
  'invalid_request_format'
];

class AIService {
  private static instance: AIService;
  private readonly apiKey: string;
  private readonly genAI: GoogleGenerativeAI | null = null;
  private readonly model: GenerativeModel | null = null;
  private readonly metrics: AIServiceMetrics;
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

    // Use react-native-config for environment variables - now using Gemini
    this.apiKey = Config.GEMINI_API_KEY || '';
    
    console.log('=== AIService (Gemini) Initialization ===');
    console.log('Config.GEMINI_API_KEY:', this.apiKey ? 'SET' : 'NOT SET');
    console.log('Available config keys:', Object.keys(Config));
    console.log('==========================================');
    
    if (!this.apiKey) {
      console.warn('WARNING: No Gemini API key found. AI features will not work. Please set GEMINI_API_KEY in your .env file');
    } else {
      try {
        // @ts-ignore - Assign to readonly property in constructor
        this.genAI = new GoogleGenerativeAI(this.apiKey);
        // Use Gemini 2.5 Flash for best price-performance and adaptive thinking
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
        console.log('AIService: Successfully initialized Gemini 2.5 Flash model');
      } catch (error) {
        console.error('AIService: Failed to initialize Gemini model:', error);
      }
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
            setTimeout(() => reject(new Error(`Operation timeout after ${REQUEST_TIMEOUT}ms`)), REQUEST_TIMEOUT)
          )
        ]);
        
        // Update metrics on success
        const responseTime = Date.now() - startTime;
        this.updateMetrics(true, responseTime);
        
        if (attempt > 1) {
          console.log(`AIService: ${operationName} succeeded on attempt ${attempt}`);
        }
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Update metrics on error
        this.updateMetrics(false, 0, lastError.message);
        
        // Check if error is non-retryable
        if (this.isNonRetryableError(lastError)) {
          console.error(`AIService: Non-retryable error in ${operationName}:`, lastError.message);
          throw lastError;
        }
        
        if (attempt > options.maxRetries) {
          console.error(`AIService: ${operationName} failed after ${options.maxRetries} retries:`, lastError.message);
          throw new Error(`${operationName} failed after ${options.maxRetries} retries: ${lastError.message}`);
        }
        
        // Calculate delay with jitter
        const delay = Math.min(
          options.baseDelay * Math.pow(options.backoffFactor, attempt - 1),
          options.maxDelay
        );
        const jitter = Math.random() * 0.1 * delay;
        const finalDelay = delay + jitter;
        
        console.warn(`AIService: ${operationName} failed on attempt ${attempt}, retrying in ${Math.round(finalDelay)}ms:`, lastError.message);
        
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
      throw new Error('TransformTextToNote: Request object is required');
    }
    
    this.validateTextInput(request.text, 'TransformTextToNote');
    
    if (!request.tone || !['professional', 'casual', 'simplified'].includes(request.tone)) {
      throw new Error('TransformTextToNote: Valid tone is required (professional, casual, or simplified)');
    }
  }

  async transformTextToNote(request: AITransformationRequest): Promise<AITransformationResponse> {
    const startTime = Date.now();
    console.log('AIService: Starting transformTextToNote operation');
    
    // Comprehensive input validation
    this.validateTransformationRequest(request);
    
    if (!this.apiKey || !this.model) {
      throw new Error('Gemini API key is not configured. Please check your environment setup.');
    }

    return this.withRetry(async () => {
      const prompt = TONE_PROMPTS[request.tone] || TONE_PROMPTS.professional;
      
      const fullPrompt = `${prompt}

Raw text to transform:

${request.text}`;

      console.log(`AIService: Sending request to Gemini 2.5 Flash (${request.text.length} chars, ${request.tone} tone)...`);
      
      const result = await this.model!.generateContent(fullPrompt);
      const response = await result.response;
      
      // Enhanced response validation
      console.log('AIService: Response received, validating content...');
      console.log('AIService: Response candidates:', response.candidates?.length || 0);
      
      let transformedText = response.text();

      if (!transformedText || transformedText.trim() === '') {
        console.log('AIService: Empty response received from Gemini');
        console.log('AIService: Response candidates:', JSON.stringify(response.candidates, null, 2));
        
        // Enhanced fallback with basic HTML formatting
        const basicHtml = this.createBasicHtmlFormatting(request.text.trim());
        transformedText = basicHtml;
        console.log('AIService: Using enhanced fallback with basic HTML formatting');
      } else {
        console.log(`AIService: Received valid response from Gemini (${transformedText.length} chars)`);
      }

      // Clean up the response - remove markdown code blocks if present
      transformedText = this.cleanupAIResponse(transformedText);

      // Generate a title for the note with timeout protection
      const title = await this.generateNoteTitle(transformedText);
      const wordCount = this.countWords(transformedText);

      const processingTime = Date.now() - startTime;
      console.log(`AIService: transformTextToNote completed successfully in ${processingTime}ms`);

      return {
        transformedText,
        title,
        wordCount
      };

    }, 'transformTextToNote');
  }

  /**
   * Create basic HTML formatting as fallback
   */
  private createBasicHtmlFormatting(text: string): string {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length === 0) {
      return '<p>No content available</p>';
    }
    
    // Simple paragraph formatting
    const htmlLines = lines.map(line => {
      const trimmed = line.trim();
      if (trimmed.length > 0) {
        return `<p>${trimmed}</p>`;
      }
      return '';
    }).filter(line => line.length > 0);
    
    return htmlLines.join('\n');
  }

  // New method for multi-page batch processing
  /**
   * Transform multiple images to note using Gemini 2.5 Flash multimodal processing
   * Enhanced with single API call for better performance and context understanding
   * Includes comprehensive validation and error handling
   */
  async transformImagesToNote(
    imageUris: string[], 
    tone: 'professional' | 'casual' | 'simplified',
    onProgress?: (current: number, total: number) => void
  ): Promise<AITransformationResponse> {
    const startTime = Date.now();
    console.log(`AIService: Starting transformImagesToNote operation for ${imageUris.length} images`);
    
    // Enhanced input validation
    if (!imageUris || !Array.isArray(imageUris)) {
      throw new Error('TransformImagesToNote: imageUris must be a non-empty array');
    }
    
    if (imageUris.length === 0) {
      throw new Error('TransformImagesToNote: No images provided for processing');
    }
    
    if (imageUris.length > 20) { // Reasonable limit for batch processing
      throw new Error('TransformImagesToNote: Too many images provided (maximum 20 allowed)');
    }
    
    if (!tone || !['professional', 'casual', 'simplified'].includes(tone)) {
      throw new Error('TransformImagesToNote: Valid tone is required (professional, casual, or simplified)');
    }
    
    // Validate image URIs
    imageUris.forEach((uri, index) => {
      if (!uri || typeof uri !== 'string' || uri.trim().length === 0) {
        throw new Error(`TransformImagesToNote: Invalid image URI at index ${index}`);
      }
    });

    if (!this.apiKey || !this.model) {
      throw new Error('Gemini API key is not configured. Please check your environment setup.');
    }

    return this.withRetry(async () => {
      console.log(`AIService: Processing ${imageUris.length} images with Gemini 2.5 Flash multimodal...`);
      
      // Initialize Gemini Vision Service with error handling
      const geminiVision = GeminiVisionService.getInstance();
      if (!geminiVision.isConfigured()) {
        geminiVision.setGeminiModel(this.model!);
      }

      // Report initial progress
      if (onProgress) {
        onProgress(1, 3); // Step 1: Initializing
      }

      let combinedText = '';

      if (imageUris.length === 1) {
        // Single image processing
        console.log('AIService: Processing single image...');
        const result = await geminiVision.extractTextFromImage(imageUris[0], {
          preserveLayout: true,
          extractTables: true,
          enhanceHandwriting: true,
          detectLanguages: true,
          analyzeStructure: true
        });
        combinedText = result.text;
        
      } else {
        // Multi-image processing - let Gemini handle all images in one call
        console.log(`AIService: Processing ${imageUris.length} images as multi-page document...`);
        if (onProgress) {
          onProgress(2, 3); // Step 2: Processing images
        }
        
        const result = await geminiVision.processMultipleImages(imageUris, {
          preserveLayout: true,
          extractTables: true,
          enhanceHandwriting: true,
          detectLanguages: true,
          analyzeStructure: true,
          combinePages: true,
          preservePageBreaks: true
        });
        combinedText = result.text;
      }

      if (!combinedText || combinedText.trim().length === 0) {
        throw new Error('No text could be extracted from the provided images. Please ensure images contain readable text.');
      }

      // Validate extracted text length
      if (combinedText.trim().length < MIN_TEXT_LENGTH) {
        throw new Error(`Extracted text is too short (${combinedText.trim().length} chars). Minimum ${MIN_TEXT_LENGTH} characters required.`);
      }

      console.log(`AIService: Successfully extracted ${combinedText.length} characters from ${imageUris.length} image(s)`);
      
      // Report progress before transformation
      if (onProgress) {
        onProgress(3, 3); // Step 3: Transforming text
      }

      // Transform the extracted text using tone-specific prompts
      const transformationRequest: AITransformationRequest = {
        text: combinedText,
        tone
      };

      const transformedResult = await this.transformTextToNote(transformationRequest);
      
      const processingTime = Date.now() - startTime;
      console.log(`AIService: Multi-image processing completed successfully in ${processingTime}ms`);
      return transformedResult;
      
    }, 'transformImagesToNote');
  }

  // Helper method to extract text from a single image
  /**
   * Extract text from image using Gemini 2.5 Flash multimodal capabilities
   * Replaces ML Kit and Google Cloud Vision with superior AI processing
   * Enhanced with comprehensive error handling and validation
   */
  private async extractTextFromImage(imageUri: string): Promise<string> {
    const startTime = Date.now();
    
    // Input validation
    if (!imageUri || typeof imageUri !== 'string' || imageUri.trim().length === 0) {
      throw new Error('ExtractTextFromImage: Valid image URI is required');
    }

    return this.withRetry(async () => {
      console.log('AIService: Extracting text from image using Gemini 2.5 Flash...');
      
      // Initialize Gemini Vision Service with error handling
      const geminiVision = GeminiVisionService.getInstance();
      if (!geminiVision.isConfigured()) {
        // Set the Gemini model from this service
        if (!this.model) {
          throw new Error('Gemini model not initialized');
        }
        geminiVision.setGeminiModel(this.model);
      }

      // Extract text using Gemini's advanced vision capabilities
      const result = await geminiVision.extractTextFromImage(imageUri, {
        preserveLayout: true,
        extractTables: true,
        enhanceHandwriting: true,
        detectLanguages: true,
        analyzeStructure: true
      });

      if (result.text && result.text.trim().length > 0) {
        const processingTime = Date.now() - startTime;
        console.log(`AIService: Successfully extracted ${result.text.length} characters from image in ${processingTime}ms`);
        console.log(`AIService: Document type detected: ${result.metadata.documentType}`);
        return result.text;
      } else {
        console.warn('AIService: No text extracted from image - image may not contain readable text');
        return '';
      }

    }, 'extractTextFromImage');
  }

  // Helper method to combine page texts with proper formatting
  private combinePageTexts(pageTexts: string[]): string {
    // Input validation
    if (!pageTexts || !Array.isArray(pageTexts)) {
      throw new Error('CombinePageTexts: pageTexts must be an array');
    }
    
    if (pageTexts.length === 0) return '';
    if (pageTexts.length === 1) return pageTexts[0] || '';
    
    // Filter out empty pages and combine with clear page breaks
    const validPages = pageTexts.filter(text => text && text.trim().length > 0);
    
    if (validPages.length === 0) return '';
    if (validPages.length === 1) return validPages[0];
    
    return validPages
      .map((text, index) => {
        const pageHeader = `\n\n--- Page ${index + 1} ---\n\n`;
        return index === 0 ? text : pageHeader + text;
      })
      .join('');
  }

  // Enhanced method for document processing with optional native file processing
  async processDocumentToNote(
    textOrFilePath: string,
    documentType: string,
    tone: 'professional' | 'casual' | 'simplified',
    options: {
      preserveStructure?: boolean;
      generateSummary?: boolean;
      autoTag?: boolean;
      isFilePath?: boolean; // New option to indicate if input is a file path
      useNativeProcessing?: boolean; // New option to use Gemini native processing
    } = {}
  ): Promise<AITransformationResponse> {
    const startTime = Date.now();
    console.log(`AIService: Starting processDocumentToNote operation for ${documentType}`);
    
    // Enhanced input validation
    if (!textOrFilePath || typeof textOrFilePath !== 'string') {
      throw new Error('ProcessDocumentToNote: textOrFilePath is required and must be a string');
    }
    
    if (!documentType || typeof documentType !== 'string') {
      throw new Error('ProcessDocumentToNote: documentType is required and must be a string');
    }
    
    if (!tone || !['professional', 'casual', 'simplified'].includes(tone)) {
      throw new Error('ProcessDocumentToNote: Valid tone is required (professional, casual, or simplified)');
    }

    if (!this.apiKey || !this.model) {
      throw new Error('Gemini API key is not configured. Please check your environment setup.');
    }

    return this.withRetry(async () => {
      console.log(`AIService: Processing ${documentType} document with Gemini 2.5 Flash...`);
      
      let extractedText: string;
      let useNativeGeminiProcessing = false;
      
      // Determine if we should use native Gemini processing
      if (options.isFilePath && options.useNativeProcessing) {
        try {
          // Import DocumentProcessor for file handling
          const { DocumentProcessor } = await import('../services/DocumentProcessor');
          const documentProcessor = new DocumentProcessor();
          
          // Create DocumentFile object from file path
          const fileName = textOrFilePath.split('/').pop() || 'document';
          const documentFile = {
            uri: textOrFilePath,
            name: fileName,
            type: documentType,
            size: 0 // Size not available when using file path, but required by interface
          };
          
          // Process document using DocumentProcessor which has Gemini integration
          const processingResult = await documentProcessor.processDocument(documentFile, {
            extractImages: false,
            preserveFormatting: options.preserveStructure || false,
            autoTagging: options.autoTag || false,
            generateSummary: options.generateSummary || false,
            chunkLargeDocuments: false
          });
          
          if (processingResult.extractedText && processingResult.extractedText.includes('GEMINI_PROCESSING_MARKER')) {
            // Native Gemini processing was used
            extractedText = processingResult.extractedText.replace('GEMINI_PROCESSING_MARKER: ', '');
            useNativeGeminiProcessing = true;
            console.log('AIService: Successfully used native Gemini document processing via DocumentProcessor');
          } else {
            // Regular text extraction was used
            extractedText = processingResult.extractedText;
            console.log('AIService: Used regular text extraction as fallback');
          }
          
        } catch (nativeError) {
          console.warn('AIService: Document processing failed, falling back to provided text:', nativeError);
          // Fall back to text extraction approach
          extractedText = textOrFilePath; // This should be extracted text as fallback
        }
      } else {
        // Use provided text (either extracted text or file path treated as text)
        extractedText = textOrFilePath;
      }
      
      // Validate extracted text
      this.validateTextInput(extractedText, 'ProcessDocumentToNote');
      
      // Enhanced prompts based on document type
      const documentPrompts: { [key: string]: string } = {
        'application/pdf': `Transform this PDF document content into well-structured study notes. Preserve important headings, maintain bullet points, and organize the content logically. Format as clean HTML.`,
        
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': `Transform this Word document into comprehensive study notes. Maintain the original structure including headings, lists, and emphasis. Format as clean HTML.`,
        
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': `Transform this PowerPoint presentation into detailed study notes. Convert slides into organized sections with clear headings. Expand bullet points into full explanations where helpful. Format as clean HTML.`,
        
        'text/plain': `Transform this text document into well-organized study notes. Add proper structure with headings and bullet points where appropriate. Format as clean HTML.`,
        
        'default': `Transform this document content into comprehensive, well-structured study notes. Organize the information logically with proper headings and formatting. Format as clean HTML.`
      };

      const documentPrompt = documentPrompts[documentType] || documentPrompts['default'];
      const tonePrompt = TONE_PROMPTS[tone] || TONE_PROMPTS.professional;
      
      // Smart prompting based on document type and content
      let enhancedPrompt = `${documentPrompt}\n\n${tonePrompt}`;
      
      // Add structure preservation instruction if requested
      if (options.preserveStructure) {
        enhancedPrompt += `\n\nIMPORTANT: Preserve the original document structure including headings, subheadings, lists, and paragraph organization.`;
      }

      // Add content-specific instructions based on document characteristics
      if (extractedText.length > 5000) {
        enhancedPrompt += `\n\nThis is a long document. Create a clear hierarchy with main sections and subsections for easy navigation.`;
      }

      if (extractedText.includes('slide') || extractedText.includes('presentation')) {
        enhancedPrompt += `\n\nThis appears to be presentation content. Expand brief bullet points into complete explanations and connect ideas between slides.`;
      }

      const fullPrompt = `${enhancedPrompt}

Document content to transform:

${extractedText}`;

      console.log(`AIService: Sending document processing request to Gemini 2.5 Flash (${extractedText.length} chars)...`);
      const result = await this.model!.generateContent(fullPrompt);
      const response = await result.response;
      let transformedText = response.text();

      if (!transformedText) {
        throw new Error('No content received from Gemini API');
      }

      console.log(`AIService: Received document processing response from Gemini (${transformedText.length} chars)`);

      // Clean up the response
      transformedText = this.cleanupAIResponse(transformedText);

      // Generate document-specific title
      const title = await this.generateDocumentTitle(transformedText, documentType);
      const wordCount = this.countWords(transformedText);

      const processingTime = Date.now() - startTime;
      console.log(`AIService: processDocumentToNote completed successfully in ${processingTime}ms`);

      return {
        transformedText,
        title,
        wordCount
      };

    }, 'processDocumentToNote');
  }

  async generateDocumentTitle(content: string, documentType: string): Promise<string> {
    const startTime = Date.now();
    
    // Input validation
    if (!content || typeof content !== 'string') {
      return this.generateFallbackDocumentTitle('', documentType);
    }
    
    if (!documentType || typeof documentType !== 'string') {
      documentType = 'document';
    }

    return this.withRetry(async () => {
      if (!this.model) {
        return this.generateFallbackDocumentTitle(content, documentType);
      }

      // Document-type specific title generation
      const typeHints: { [key: string]: string } = {
        'application/pdf': 'research paper, report, or academic document',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document or report',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'presentation or slides',
        'text/plain': 'text document'
      };

      const typeHint = typeHints[documentType] || 'document';

      const prompt = `Generate a concise, descriptive title (max 60 characters) for this ${typeHint} content. Focus on the main topic or subject matter. Return only the title, no quotes or extra text.

Content preview: ${content.substring(0, 1000)}`;

      console.log('AIService: Generating document title with Gemini...');
      
      // Use timeout protection for title generation
      const result = await Promise.race([
        this.model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 25,
          }
        }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Title generation timeout')), TITLE_GENERATION_TIMEOUT)
        )
      ]);
      
      const response = await result.response;
      const title = response.text()?.trim() || '';
      
      // Validate and clean title
      const cleanTitle = this.cleanupTitle(title);
      
      const processingTime = Date.now() - startTime;
      console.log(`AIService: Generated document title in ${processingTime}ms`);
      
      return cleanTitle || this.generateFallbackDocumentTitle(content, documentType);
    }, 'generateDocumentTitle', { maxRetries: 2 });
  }

  /**
   * Clean and validate generated titles
   */
  private cleanupTitle(title: string): string {
    if (!title || typeof title !== 'string') return '';
    
    // Remove quotes and extra formatting
    let cleaned = title.replace(/^["']|["']$/g, '').trim();
    
    // Truncate if too long
    if (cleaned.length > MAX_TITLE_LENGTH) {
      cleaned = cleaned.substring(0, MAX_TITLE_LENGTH - 3) + '...';
    }
    
    // Ensure it's not just punctuation or numbers
    if (!/[a-zA-Z]/.test(cleaned)) {
      return '';
    }
    
    return cleaned;
  }

  private generateFallbackDocumentTitle(content: string, documentType: string): string {
    try {
      // Enhanced fallback title generation
      if (!content || typeof content !== 'string') {
        return this.generateTypeBasedTitle(documentType);
      }
      
      // Extract meaningful content for title
      const cleanContent = content.replace(/<[^>]*>/g, '');
      const lines = cleanContent.split('\n').filter(line => line.trim().length > 0);
      
      // Look for the first substantial line that could be a title
      const meaningfulLine = lines.find(line => {
        const trimmed = line.trim();
        return trimmed.length > 5 && 
               trimmed.length < 100 && 
               !trimmed.match(/^(page|slide|document)\s+\d+/i) &&
               !/^\d+[.,)]\s/.test(trimmed); // Avoid numbered list items
      });
      
      if (meaningfulLine) {
        const title = meaningfulLine.trim().substring(0, MAX_TITLE_LENGTH - 3);
        return title.length === MAX_TITLE_LENGTH - 3 ? title + '...' : title;
      }
      
      // Look for patterns that suggest document sections
      const sectionPattern = lines.find(line => {
        const trimmed = line.trim();
        return trimmed.match(/^(chapter|section|part|module|lesson|unit)\s+\d+/i) ||
               trimmed.match(/^[A-Z][A-Z\s]{3,30}$/); // All caps titles
      });
      
      if (sectionPattern) {
        const title = sectionPattern.trim().substring(0, MAX_TITLE_LENGTH - 3);
        return title.length === MAX_TITLE_LENGTH - 3 ? title + '...' : title;
      }
      
      // Generate type-based title as final fallback
      return this.generateTypeBasedTitle(documentType);
    } catch (error) {
      console.warn('AIService: Error in generateFallbackDocumentTitle:', error);
      return this.generateTypeBasedTitle(documentType);
    }
  }

  /**
   * Generate a title based on document type when content analysis fails
   */
  private generateTypeBasedTitle(documentType: string): string {
    const typeNames: { [key: string]: string } = {
      'application/pdf': 'PDF Notes',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document Notes',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'Presentation Notes',
      'text/plain': 'Text Notes'
    };
    
    const typeName = typeNames[documentType] || 'Document Notes';
    const date = new Date().toLocaleDateString();
    return `${typeName} - ${date}`;
  }

  async generateNoteTitle(content: string): Promise<string> {
    const startTime = Date.now();
    
    // Input validation
    if (!content || typeof content !== 'string') {
      return this.generateFallbackTitle('');
    }

    return this.withRetry(async () => {
      if (!this.model) {
        return this.generateFallbackTitle(content);
      }

      const prompt = `Generate a concise, descriptive title (max 60 characters) for the following study notes. Return only the title, no quotes or extra text.

Content: ${content.substring(0, 1000)}`;

      console.log('AIService: Generating title with Gemini...');
      
      // Use timeout protection for title generation
      const result = await Promise.race([
        this.model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 20,
          }
        }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Title generation timeout')), TITLE_GENERATION_TIMEOUT)
        )
      ]);
      
      const response = await result.response;
      const title = response.text()?.trim() || '';
      
      // Clean and validate title
      const cleanTitle = this.cleanupTitle(title);
      
      const processingTime = Date.now() - startTime;
      console.log(`AIService: Generated note title in ${processingTime}ms`);
      
      return cleanTitle || this.generateFallbackTitle(content);
    }, 'generateNoteTitle', { maxRetries: 2 });
  }

  private generateFallbackTitle(content: string): string {
    try {
      // Enhanced fallback title generation
      if (!content || typeof content !== 'string') {
        return this.generateTimestampTitle();
      }
      
      // Extract first meaningful line as title
      const lines = content.replace(/<[^>]*>/g, '').split('\n');
      const meaningfulLine = lines.find(line => {
        const trimmed = line.trim();
        return trimmed.length > 0 && 
               trimmed.length <= MAX_TITLE_LENGTH &&
               !/^(\d+[.,)\s]|[-*+]\s)/.test(trimmed) && // Avoid list items
               !/^(page|slide|document)\s+\d+/i.test(trimmed); // Avoid page numbers
      });
      
      if (meaningfulLine) {
        const title = meaningfulLine.trim().substring(0, MAX_TITLE_LENGTH - 3);
        return title.length === MAX_TITLE_LENGTH - 3 ? title + '...' : title;
      }
      
      // Look for meaningful keywords in content
      const keywords = this.extractKeywords(content);
      if (keywords.length > 0) {
        const keywordTitle = keywords.slice(0, 3).join(' ');
        return keywordTitle.length > MAX_TITLE_LENGTH ? 
               keywordTitle.substring(0, MAX_TITLE_LENGTH - 3) + '...' : 
               keywordTitle;
      }
      
      // Generate timestamp-based title as last resort
      return this.generateTimestampTitle();
    } catch (error) {
      console.warn('AIService: Error in generateFallbackTitle:', error);
      return this.generateTimestampTitle();
    }
  }

  /**
   * Extract meaningful keywords from content for title generation
   */
  private extractKeywords(content: string): string[] {
    try {
      if (!content) return [];
      
      const cleanContent = content.replace(/<[^>]*>/g, '').toLowerCase();
      const words = cleanContent.split(/\s+/)
        .filter(word => word.length > 3) // Filter short words
        .filter(word => !/^\d+$/.test(word)) // Filter pure numbers
        .filter(word => !/[^\w]/.test(word)); // Filter words with special chars
      
      // Count word frequency
      const wordCount = new Map<string, number>();
      words.forEach(word => {
        wordCount.set(word, (wordCount.get(word) || 0) + 1);
      });
      
      // Get most frequent meaningful words
      return Array.from(wordCount.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([word]) => word)
        .filter(word => word.length > 3);
    } catch (error) {
      console.warn('AIService: Error extracting keywords:', error);
      return [];
    }
  }

  /**
   * Generate timestamp-based title
   */
  private generateTimestampTitle(): string {
    const date = new Date().toLocaleDateString();
    return `Study Notes - ${date}`;
  }

  private cleanupAIResponse(response: string): string {
    try {
      if (!response || typeof response !== 'string') {
        return '';
      }
      
      // Remove markdown code blocks (```html, ```text, etc.)
      let cleaned = response.replace(/^```\w*\n?/gm, '').replace(/\n?```$/gm, '');
      
      // Remove any leading/trailing whitespace
      cleaned = cleaned.trim();
      
      // Remove any HTML comments that might have been added
      cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
      
      // Remove excessive line breaks (more than 2 consecutive)
      cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
      
      // Log the cleanup for debugging
      if (response !== cleaned) {
        console.log('AIService: Cleaned up AI response - removed markdown code blocks and excessive whitespace');
      }
      
      return cleaned;
    } catch (error) {
      console.warn('AIService: Error cleaning up AI response:', error);
      return response || '';
    }
  }

  private countWords(text: string): number {
    try {
      if (!text || typeof text !== 'string') {
        return 0;
      }
      
      // Remove HTML tags and count words
      const plainText = text.replace(/<[^>]*>/g, '');
      const words = plainText.trim().split(/\s+/).filter(word => word.length > 0);
      return words.length;
    } catch (error) {
      console.warn('AIService: Error counting words:', error);
      return 0;
    }
  }

  // OPTIMIZED: Health check method with proper boolean return and timeout protection
  async checkAPIHealth(): Promise<boolean> {
    const startTime = Date.now();
    console.log('AIService: Starting API health check...');
    
    try {
      if (!this.apiKey || !this.model) {
        console.log('AIService: Health check failed - API key or model not configured');
        return false;
      }
      
      // Test with a simple prompt with timeout protection
      const result = await Promise.race([
        this.model.generateContent('Test connection'),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), HEALTH_CHECK_TIMEOUT)
        )
      ]);
      
      const isHealthy = !!(result && result.response && result.response.text());
      const processingTime = Date.now() - startTime;
      
      console.log(`AIService: Health check ${isHealthy ? 'passed' : 'failed'} in ${processingTime}ms`);
      
      // Update metrics
      this.updateMetrics(isHealthy, processingTime, isHealthy ? undefined : 'Health check failed');
      
      return isHealthy;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.warn(`AIService: Health check failed in ${processingTime}ms:`, error);
      this.updateMetrics(false, processingTime, error instanceof Error ? error.message : 'Health check error');
      return false;
    }
  }

  /**
   * Get service performance metrics
   */
  getMetrics(): AIServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset service metrics
   */
  resetMetrics(): void {
    this.metrics.requestCount = 0;
    this.metrics.successCount = 0;
    this.metrics.errorCount = 0;
    this.metrics.averageResponseTime = 0;
    delete this.metrics.lastError;
    delete this.metrics.lastSuccess;
    console.log('AIService: Metrics reset');
  }

  /**
   * OPTIMIZED: Cleanup method to manage memory usage
   * Call this when the service is no longer needed to free resources
   */
  cleanup(): void {
    console.log('AIService: Cleaning up resources...');
    
    try {
      // Reset metrics
      this.resetMetrics();
      
      // Log final statistics
      console.log('AIService: Final cleanup completed');
      
      // Reset the singleton instance to allow garbage collection
      AIService.instance = null as any;
    } catch (error) {
      console.warn('AIService: Error during cleanup:', error);
    }
  }

  /**
   * OPTIMIZED: Memory-efficient batch processing with enhanced error handling
   * Process multiple requests with automatic cleanup between batches
   */
  async processBatch<T>(
    requests: Array<() => Promise<T>>,
    batchSize: number = 3,
    delayBetweenBatches: number = 1000
  ): Promise<T[]> {
    // Input validation
    if (!requests || !Array.isArray(requests)) {
      throw new Error('ProcessBatch: requests must be an array');
    }
    
    if (requests.length === 0) {
      return [];
    }
    
    if (batchSize <= 0 || batchSize > 10) {
      throw new Error('ProcessBatch: batchSize must be between 1 and 10');
    }
    
    if (delayBetweenBatches < 0 || delayBetweenBatches > 30000) {
      throw new Error('ProcessBatch: delayBetweenBatches must be between 0 and 30000ms');
    }
    
    const results: T[] = [];
    const totalBatches = Math.ceil(requests.length / batchSize);
    
    console.log(`AIService: Processing ${requests.length} requests in ${totalBatches} batches (size: ${batchSize})`);
    
    for (let i = 0; i < requests.length; i += batchSize) {
      const batchNumber = Math.floor(i / batchSize) + 1;
      const batch = requests.slice(i, i + batchSize);
      const startTime = Date.now();
      
      console.log(`AIService: Processing batch ${batchNumber}/${totalBatches} (${batch.length} requests)`);
      
      try {
        // Process batch concurrently with error handling for individual requests
        const batchResults = await Promise.allSettled(
          batch.map(async (request, index) => {
            try {
              return await request();
            } catch (error) {
              console.error(`AIService: Request ${i + index} failed:`, error);
              throw error;
            }
          })
        );
        
        // Extract successful results and handle failures
        const successfulResults = batchResults.map((result, index) => {
          if (result.status === 'fulfilled') {
            return result.value;
          } else {
            console.error(`AIService: Batch ${batchNumber}, request ${index + 1} failed:`, result.reason);
            throw new Error(`Batch request failed: ${result.reason instanceof Error ? result.reason.message : result.reason}`);
          }
        });
        
        results.push(...successfulResults);
        
        const batchTime = Date.now() - startTime;
        console.log(`AIService: Batch ${batchNumber} completed in ${batchTime}ms`);
        
        // Add delay between batches to prevent rate limiting and reduce memory pressure
        if (i + batchSize < requests.length && delayBetweenBatches > 0) {
          console.log(`AIService: Waiting ${delayBetweenBatches}ms before next batch...`);
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
        
      } catch (error) {
        console.error(`AIService: Batch ${batchNumber} failed:`, error);
        throw new Error(`Batch processing failed at batch ${batchNumber}: ${error instanceof Error ? error.message : error}`);
      }
    }
    
    console.log(`AIService: Batch processing completed successfully. Processed ${results.length} items.`);
    return results;
  }

  /**
   * Process documents using Gemini 2.5 Flash native multimodal capabilities
   * Enhanced with comprehensive validation and error handling
   */
  async processDocumentWithGemini(request: DocumentProcessingRequest): Promise<DocumentProcessingResponse> {
    const startTime = Date.now();
    console.log('AIService: Starting processDocumentWithGemini operation');
    
    // Enhanced input validation
    if (!request) {
      throw new Error('ProcessDocumentWithGemini: Request object is required');
    }
    
    if (!request.fileData || typeof request.fileData !== 'string') {
      throw new Error('ProcessDocumentWithGemini: fileData is required and must be a base64 string');
    }
    
    if (!request.mimeType || typeof request.mimeType !== 'string') {
      throw new Error('ProcessDocumentWithGemini: mimeType is required and must be a string');
    }
    
    if (!request.prompt || typeof request.prompt !== 'string') {
      throw new Error('ProcessDocumentWithGemini: prompt is required and must be a string');
    }
    
    // Validate base64 data
    if (!this.isValidBase64(request.fileData)) {
      throw new Error('ProcessDocumentWithGemini: fileData must be valid base64 encoded data');
    }
    
    // Validate MIME type
    const supportedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];
    
    if (!supportedMimeTypes.includes(request.mimeType)) {
      throw new Error(`ProcessDocumentWithGemini: Unsupported MIME type: ${request.mimeType}. Supported types: ${supportedMimeTypes.join(', ')}`);
    }

    if (!this.apiKey || !this.model) {
      throw new Error('Gemini API key is not configured. Please check your environment setup.');
    }

    return this.withRetry(async () => {
      console.log(`AIService: Processing document with Gemini 2.5 Flash (${request.mimeType})`);

      // Prepare the file data for Gemini API
      const fileData = {
        inlineData: {
          data: request.fileData,
          mimeType: request.mimeType
        }
      };

      // Create the request with both file and prompt
      const contents = [
        {
          role: 'user' as const,
          parts: [
            fileData,
            { text: request.prompt }
          ]
        }
      ];

      // Use Gemini's document understanding capabilities with timeout protection
      const result = await Promise.race([
        this.model!.generateContent({
          contents,
          generationConfig: {
            temperature: 0.3, // Lower temperature for more accurate extraction
            topP: 0.9,
            topK: 40,
            maxOutputTokens: 8000, // Higher limit for document content
          }
        }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Document processing timeout')), REQUEST_TIMEOUT)
        )
      ]);

      const response = await result.response;
      const extractedContent = response.text();

      if (!extractedContent || extractedContent.trim() === '') {
        throw new Error('No content extracted from document');
      }

      // Generate a title from the content with fallback
      let title: string;
      try {
        title = await this.generateNoteTitle(extractedContent);
      } catch (titleError) {
        console.warn('AIService: Failed to generate title, using fallback:', titleError);
        title = this.generateTimestampTitle();
      }

      const processingTime = Date.now() - startTime;
      console.log(`AIService: Document processed successfully via Gemini 2.5 Flash in ${processingTime}ms`);
      
      return {
        extractedContent: this.cleanupAIResponse(extractedContent),
        title
      };

    }, 'processDocumentWithGemini');
  }

  /**
   * Validate base64 string format
   */
  private isValidBase64(str: string): boolean {
    try {
      if (!str || typeof str !== 'string') return false;
      
      // Basic base64 pattern check
      const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
      
      // Remove potential data URL prefix
      const base64Data = str.includes(',') ? str.split(',')[1] : str;
      
      return base64Pattern.test(base64Data) && base64Data.length > 0;
    } catch (error) {
      return false;
    }
  }
}

export { AIService, type AITransformationRequest, type AITransformationResponse, type DocumentProcessingRequest, type DocumentProcessingResponse, type AIServiceMetrics };
