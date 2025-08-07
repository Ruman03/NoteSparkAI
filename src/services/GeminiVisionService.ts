import { GenerativeModel, Part } from '@google/generative-ai';
import RNFS from 'react-native-fs';

// Enhanced interfaces
interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

interface VisionServiceMetrics {
  requestCount: number;
  successCount: number;
  errorCount: number;
  averageProcessingTime: number;
  totalBytesProcessed: number;
  lastSuccess?: Date;
  lastError?: string;
}

export interface GeminiVisionResult {
  text: string;
  confidence: number;
  metadata: {
    hasTablesDetected: boolean;
    hasHandwritingDetected: boolean;
    documentType: 'text' | 'form' | 'receipt' | 'presentation' | 'handwritten' | 'mixed';
    languagesDetected: string[];
    pageCount: number;
    processingTime: number;
    imageSize?: number;
  };
  structure?: {
    sections: DocumentSection[];
    tables: TableData[];
  };
}

export interface DocumentSection {
  type: 'heading' | 'paragraph' | 'list' | 'table' | 'image';
  content: string;
  level?: number; // For headings
  confidence: number;
}

export interface TableData {
  headers: string[];
  rows: string[][];
  caption?: string;
  confidence: number;
}

export interface ImageAnalysis {
  description: string;
  textContent: string;
  confidence: number;
  suggestedImprovements: string[];
  metadata?: {
    imageQuality: 'high' | 'medium' | 'low';
    hasText: boolean;
    contentType: string;
    processingTime: number;
  };
}

export interface GeminiVisionOptions {
  preserveLayout?: boolean;
  extractTables?: boolean;
  enhanceHandwriting?: boolean;
  detectLanguages?: boolean;
  analyzeStructure?: boolean;
  describeImages?: boolean;
  timeout?: number;
}

// Enhanced constants
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 2000,
  maxDelay: 10000,
  backoffFactor: 2
};

const VISION_TIMEOUT = 45000; // 45 seconds for vision processing
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB max file size
const SUPPORTED_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];

const NON_RETRYABLE_ERRORS = [
  'invalid api key',
  'api key not valid',
  'authentication failed',
  'quota exceeded',
  'billing',
  'permission denied',
  'file not found',
  'unsupported format'
];

/**
 * Enhanced vision service using Gemini 2.5 Flash multimodal capabilities
 * Replaces ML Kit and Google Cloud Vision with superior AI-powered processing
 */
export class GeminiVisionService {
  private static instance: GeminiVisionService;
  private geminiModel: GenerativeModel | null = null;
  private readonly metrics: VisionServiceMetrics;
  private readonly retryOptions: RetryOptions;

  private constructor() {
    // Initialize metrics tracking
    this.metrics = {
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      averageProcessingTime: 0,
      totalBytesProcessed: 0
    };

    this.retryOptions = { ...DEFAULT_RETRY_OPTIONS };
    console.log('GeminiVisionService: Instance created with enhanced capabilities');
  }

  public static getInstance(): GeminiVisionService {
    if (!GeminiVisionService.instance) {
      GeminiVisionService.instance = new GeminiVisionService();
    }
    return GeminiVisionService.instance;
  }

  /**
   * Initialize with Gemini model from AIService
   */
  public setGeminiModel(model: GenerativeModel): void {
    if (!model) {
      throw new Error('GeminiVisionService: Invalid model provided');
    }
    this.geminiModel = model;
    console.log('GeminiVisionService: Successfully initialized with Gemini model');
  }

  /**
   * Check if the service is properly configured
   */
  public isConfigured(): boolean {
    return this.geminiModel !== null;
  }

  /**
   * Get service metrics
   */
  public getMetrics(): VisionServiceMetrics {
    return { ...this.metrics };
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
            setTimeout(() => reject(new Error(`Operation timeout after ${VISION_TIMEOUT}ms`)), VISION_TIMEOUT)
          )
        ]);
        
        // Update metrics on success
        const processingTime = Date.now() - startTime;
        this.updateMetrics(true, processingTime);
        
        if (attempt > 1) {
          console.log(`GeminiVisionService: ${operationName} succeeded on attempt ${attempt}`);
        }
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Update metrics on error
        this.updateMetrics(false, 0, lastError.message);
        
        // Check if error is non-retryable
        if (this.isNonRetryableError(lastError)) {
          console.error(`GeminiVisionService: Non-retryable error in ${operationName}:`, lastError.message);
          throw lastError;
        }
        
        if (attempt > options.maxRetries) {
          console.error(`GeminiVisionService: ${operationName} failed after ${options.maxRetries} retries:`, lastError.message);
          throw new Error(`${operationName} failed after ${options.maxRetries} retries: ${lastError.message}`);
        }
        
        // Calculate delay with jitter
        const delay = Math.min(
          options.baseDelay * Math.pow(options.backoffFactor, attempt - 1),
          options.maxDelay
        );
        const jitter = Math.random() * 0.1 * delay;
        const finalDelay = delay + jitter;
        
        console.warn(`GeminiVisionService: ${operationName} failed on attempt ${attempt}, retrying in ${Math.round(finalDelay)}ms:`, lastError.message);
        
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
  private updateMetrics(success: boolean, processingTime: number, errorMessage?: string, bytesProcessed?: number): void {
    this.metrics.requestCount++;
    
    if (success) {
      this.metrics.successCount++;
      this.metrics.lastSuccess = new Date();
      
      // Update average processing time with weighted average
      const weight = 0.1; // 10% weight for new measurement
      this.metrics.averageProcessingTime = 
        this.metrics.averageProcessingTime * (1 - weight) + processingTime * weight;
      
      if (bytesProcessed) {
        this.metrics.totalBytesProcessed += bytesProcessed;
      }
    } else {
      this.metrics.errorCount++;
      this.metrics.lastError = errorMessage;
    }
  }

  /**
   * Comprehensive input validation for image processing
   */
  private async validateImageInput(imageUri: string, operationName: string): Promise<{ size: number; format: string }> {
    if (!imageUri || typeof imageUri !== 'string') {
      throw new Error(`${operationName}: Image URI is required and must be a string`);
    }

    let filePath = imageUri;
    if (imageUri.startsWith('file://')) {
      filePath = imageUri.replace('file://', '');
    }

    try {
      // Check if file exists
      const exists = await RNFS.exists(filePath);
      if (!exists) {
        throw new Error(`${operationName}: Image file not found at ${filePath}`);
      }

      // Get file stats
      const stats = await RNFS.stat(filePath);
      const fileSize = stats.size; // Already a number, no need to parse

      if (fileSize > MAX_IMAGE_SIZE) {
        throw new Error(`${operationName}: Image file too large (${fileSize} bytes). Maximum allowed: ${MAX_IMAGE_SIZE} bytes`);
      }

      if (fileSize === 0) {
        throw new Error(`${operationName}: Image file is empty`);
      }

      // Validate file format
      const extension = filePath.toLowerCase().split('.').pop() || '';
      if (!SUPPORTED_FORMATS.includes(extension)) {
        throw new Error(`${operationName}: Unsupported image format '${extension}'. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`);
      }

      return { size: fileSize, format: extension };
    } catch (error) {
      if (error instanceof Error && error.message.includes(operationName)) {
        throw error;
      }
      throw new Error(`${operationName}: Failed to validate image file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate vision options
   */
  private validateVisionOptions(options: GeminiVisionOptions, operationName: string): void {
    if (options.timeout && (options.timeout < 1000 || options.timeout > 300000)) {
      throw new Error(`${operationName}: Timeout must be between 1000ms and 300000ms (5 minutes)`);
    }
  }

  /**
   * Extract text from a single image using Gemini 2.5 Flash with enhanced error handling
   */
  public async extractTextFromImage(
    imageUri: string, 
    options: GeminiVisionOptions = {}
  ): Promise<GeminiVisionResult> {
    return this.withRetry(async () => {
      if (!this.isConfigured()) {
        throw new Error('GeminiVisionService: Service not initialized. Call setGeminiModel() first.');
      }

      // Validate inputs
      const { size, format } = await this.validateImageInput(imageUri, 'extractTextFromImage');
      this.validateVisionOptions(options, 'extractTextFromImage');

      const startTime = Date.now();

      try {
        console.log(`GeminiVisionService: Processing ${format.toUpperCase()} image (${size} bytes) with Gemini 2.5 Flash...`);

        // Convert image to base64
        const imageBase64 = await this.convertImageToBase64(imageUri);
        
        // Create image part for Gemini
        const imagePart: Part = {
          inlineData: {
            data: imageBase64,
            mimeType: this.getMimeTypeFromUri(imageUri)
          }
        };

        // Build comprehensive prompt based on options
        const prompt = this.buildExtractionPrompt(options);

        console.log('GeminiVisionService: Sending request to Gemini...');
        const result = await this.geminiModel!.generateContent([prompt, imagePart]);
        const response = await result.response;
        const responseText = response.text();

        if (!responseText || responseText.trim().length === 0) {
          throw new Error('GeminiVisionService: No text content extracted from image');
        }

        // Parse Gemini's response
        const processingTime = Date.now() - startTime;
        const parsedResult = this.parseGeminiResponse(responseText, options, processingTime, size);
        
        console.log(`GeminiVisionService: Successfully processed image in ${processingTime}ms`);
        return parsedResult;

      } catch (error) {
        console.error('GeminiVisionService: Error processing image:', error);
        throw new Error(`Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }, 'extractTextFromImage');
  }

  /**
   * Process multiple images as a single document with enhanced error handling
   */
  public async processMultipleImages(
    imageUris: string[], 
    options: GeminiVisionOptions & { combinePages?: boolean; preservePageBreaks?: boolean } = {}
  ): Promise<GeminiVisionResult> {
    return this.withRetry(async () => {
      if (!this.isConfigured()) {
        throw new Error('GeminiVisionService: Service not initialized. Call setGeminiModel() first.');
      }

      if (!imageUris || imageUris.length === 0) {
        throw new Error('GeminiVisionService: No images provided for processing');
      }

      if (imageUris.length > 10) {
        throw new Error('GeminiVisionService: Maximum 10 images allowed per request');
      }

      this.validateVisionOptions(options, 'processMultipleImages');

      const startTime = Date.now();
      let totalSize = 0;

      try {
        console.log(`GeminiVisionService: Processing ${imageUris.length} images as multi-page document...`);

        // Validate all images first
        for (const imageUri of imageUris) {
          const { size } = await this.validateImageInput(imageUri, 'processMultipleImages');
          totalSize += size;
        }

        // Convert all images to base64 and create parts
        const imageParts: Part[] = [];
        for (const imageUri of imageUris) {
          const imageBase64 = await this.convertImageToBase64(imageUri);
          imageParts.push({
            inlineData: {
              data: imageBase64,
              mimeType: this.getMimeTypeFromUri(imageUri)
            }
          });
        }

        // Build multi-page processing prompt
        const prompt = this.buildMultiPagePrompt(imageUris.length, options);

        // Send all images in a single request to Gemini
        const content = [prompt, ...imageParts];
        
        console.log('GeminiVisionService: Sending multi-page request to Gemini...');
        const result = await this.geminiModel!.generateContent(content);
        const response = await result.response;
        const responseText = response.text();

        if (!responseText || responseText.trim().length === 0) {
          throw new Error('GeminiVisionService: No content extracted from multi-page document');
        }

        // Parse multi-page response
        const processingTime = Date.now() - startTime;
        const parsedResult = this.parseGeminiResponse(responseText, options, processingTime, totalSize);
        parsedResult.metadata.pageCount = imageUris.length;
        
        console.log(`GeminiVisionService: Successfully processed ${imageUris.length} page document in ${processingTime}ms`);
        return parsedResult;

      } catch (error) {
        console.error('GeminiVisionService: Error processing multiple images:', error);
        throw new Error(`Multi-page processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }, 'processMultipleImages');
  }

  /**
   * Analyze image content beyond just text extraction with enhanced error handling
   */
  public async analyzeImageContent(imageUri: string): Promise<ImageAnalysis> {
    return this.withRetry(async () => {
      if (!this.isConfigured()) {
        throw new Error('GeminiVisionService: Service not initialized. Call setGeminiModel() first.');
      }

      const { size, format } = await this.validateImageInput(imageUri, 'analyzeImageContent');
      const startTime = Date.now();

      try {
        console.log(`GeminiVisionService: Analyzing ${format.toUpperCase()} image content (${size} bytes)...`);

        const imageBase64 = await this.convertImageToBase64(imageUri);
        const imagePart: Part = {
          inlineData: {
            data: imageBase64,
            mimeType: this.getMimeTypeFromUri(imageUri)
          }
        };

        const analysisPrompt = `Analyze this image comprehensively and provide detailed insights:

1. Provide a detailed description of what you see
2. Extract all text content (if any)
3. Assess image quality and suggest improvements if needed
4. Identify the type of document/content
5. Determine if the image contains meaningful text

Format your response as JSON:
{
  "description": "detailed description of the image content",
  "textContent": "all extracted text",
  "confidence": 0.95,
  "suggestedImprovements": ["specific improvement suggestions"],
  "imageQuality": "high|medium|low",
  "hasText": true|false,
  "contentType": "document|photo|diagram|handwritten|mixed"
}`;

        console.log('GeminiVisionService: Sending analysis request to Gemini...');
        const result = await this.geminiModel!.generateContent([analysisPrompt, imagePart]);
        const response = await result.response;
        const responseText = response.text();

        if (!responseText || responseText.trim().length === 0) {
          throw new Error('GeminiVisionService: No analysis received from Gemini API');
        }

        // Parse JSON response
        const processingTime = Date.now() - startTime;
        try {
          const cleanedResponse = this.cleanJsonResponse(responseText);
          const parsedResult = JSON.parse(cleanedResponse);
          
          // Add metadata
          parsedResult.metadata = {
            imageQuality: parsedResult.imageQuality || 'medium',
            hasText: parsedResult.hasText || false,
            contentType: parsedResult.contentType || 'unknown',
            processingTime
          };
          
          console.log(`GeminiVisionService: Successfully analyzed image in ${processingTime}ms`);
          return parsedResult;
        } catch (parseError) {
          console.warn('GeminiVisionService: Failed to parse JSON response, using fallback format');
          // Fallback if JSON parsing fails
          return {
            description: responseText,
            textContent: '',
            confidence: 0.8,
            suggestedImprovements: ['Unable to parse detailed analysis'],
            metadata: {
              imageQuality: 'medium',
              hasText: false,
              contentType: 'unknown',
              processingTime
            }
          };
        }

      } catch (error) {
        console.error('GeminiVisionService: Error analyzing image:', error);
        throw new Error(`Image analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }, 'analyzeImageContent');
  }

  /**
   * Build prompt for text extraction based on options
   */
  private buildExtractionPrompt(options: GeminiVisionOptions): string {
    let prompt = `Extract all text from this image with high accuracy. `;

    if (options.preserveLayout) {
      prompt += `Preserve the original layout, spacing, and structure of the text. `;
    }

    if (options.extractTables) {
      prompt += `If tables are present, format them clearly with proper rows and columns. `;
    }

    if (options.enhanceHandwriting) {
      prompt += `Pay special attention to handwritten text and ensure accurate recognition. `;
    }

    if (options.detectLanguages) {
      prompt += `Detect and preserve text in multiple languages. `;
    }

    if (options.analyzeStructure) {
      prompt += `Identify document structure including headings, paragraphs, lists, and sections. `;
    }

    prompt += `

Please provide the extracted text in a clean, readable format. If the image contains structured content like forms, tables, or formatted documents, preserve that structure in your response.

For complex documents, organize the output logically and maintain the original hierarchy of information.`;

    return prompt;
  }

  /**
   * Build prompt for multi-page document processing
   */
  private buildMultiPagePrompt(pageCount: number, options: any): string {
    let prompt = `I'm providing you with ${pageCount} images that represent pages of a single document. 
Please extract all text from these images and combine them into a coherent document.

Instructions:
- Process all ${pageCount} pages in sequence
- Maintain the document flow and structure across pages
- Preserve page breaks where appropriate
- Combine related content intelligently
- Ensure no text is lost or duplicated

`;

    if (options.preservePageBreaks) {
      prompt += `- Clearly mark page transitions with "--- Page X ---" markers\n`;
    }

    if (options.extractTables) {
      prompt += `- If tables span multiple pages, combine them properly\n`;
    }

    prompt += `
Please provide the complete extracted text as a single, well-organized document.`;

    return prompt;
  }

  /**
   * Parse Gemini's response into structured format with enhanced metadata
   */
  private parseGeminiResponse(
    responseText: string, 
    options: GeminiVisionOptions, 
    processingTime: number, 
    imageSize: number
  ): GeminiVisionResult {
    // Basic metadata analysis
    const hasTablesDetected = responseText.includes('|') || /table|row|column/i.test(responseText);
    const hasHandwritingDetected = /handwrit|cursive|script/i.test(responseText);
    
    // Detect document type based on content patterns
    let documentType: GeminiVisionResult['metadata']['documentType'] = 'text';
    if (/receipt|invoice|bill/i.test(responseText)) documentType = 'receipt';
    else if (/form|application|field/i.test(responseText)) documentType = 'form';
    else if (/slide|presentation|bullet/i.test(responseText)) documentType = 'presentation';
    else if (hasHandwritingDetected) documentType = 'handwritten';
    else if (hasTablesDetected) documentType = 'mixed';

    return {
      text: responseText.trim(),
      confidence: 0.95, // Gemini typically provides high-quality results
      metadata: {
        hasTablesDetected,
        hasHandwritingDetected,
        documentType,
        languagesDetected: ['en'], // Basic implementation, could be enhanced
        pageCount: 1,
        processingTime,
        imageSize
      }
    };
  }

  /**
   * Convert image to base64 for Gemini API with enhanced error handling
   */
  private async convertImageToBase64(imageUri: string): Promise<string> {
    try {
      // Handle different URI formats
      let filePath = imageUri;
      if (imageUri.startsWith('file://')) {
        filePath = imageUri.replace('file://', '');
      }

      // Read file as base64 with proper error handling
      const base64String = await RNFS.readFile(filePath, 'base64');
      
      if (!base64String || base64String.length === 0) {
        throw new Error('Failed to convert image to base64: empty result');
      }

      console.log(`GeminiVisionService: Successfully converted image to base64 (${base64String.length} characters)`);
      return base64String;

    } catch (error) {
      console.error('GeminiVisionService: Error converting image to base64:', error);
      throw new Error(`Failed to read image file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get MIME type from image URI with validation
   */
  private getMimeTypeFromUri(imageUri: string): string {
    const extension = imageUri.toLowerCase().split('.').pop() || '';
    
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'heic':
        return 'image/heic';
      case 'heif':
        return 'image/heif';
      default:
        console.warn(`GeminiVisionService: Unknown image extension '${extension}', defaulting to image/jpeg`);
        return 'image/jpeg'; // Default fallback
    }
  }

  /**
   * Clean JSON response from Gemini (remove markdown formatting) with enhanced parsing
   */
  private cleanJsonResponse(response: string): string {
    try {
      // Remove markdown code blocks if present
      let cleaned = response.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
      
      // Remove any extra text before or after JSON
      const jsonStart = cleaned.indexOf('{');
      const jsonEnd = cleaned.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
      }
      
      // Basic JSON validation
      JSON.parse(cleaned); // This will throw if invalid
      return cleaned;
    } catch (error) {
      console.warn('GeminiVisionService: Failed to clean JSON response:', error);
      // Return original response if cleaning fails
      return response;
    }
  }

  /**
   * Health check method to verify vision service connectivity
   */
  public async checkServiceHealth(): Promise<boolean> {
    try {
      if (!this.isConfigured()) {
        return false;
      }
      
      // Test with a simple text prompt (no image required)
      const result = await this.geminiModel!.generateContent('Health check test');
      return !!(result && result.response);
    } catch (error) {
      console.warn('GeminiVisionService: Health check failed:', error);
      return false;
    }
  }

  /**
   * Get processing statistics
   */
  public getProcessingStats(): {
    totalRequests: number;
    successRate: number;
    averageProcessingTime: number;
    totalDataProcessed: string;
  } {
    const successRate = this.metrics.requestCount > 0 
      ? (this.metrics.successCount / this.metrics.requestCount) * 100 
      : 0;
    
    const totalDataProcessed = this.formatBytes(this.metrics.totalBytesProcessed);
    
    return {
      totalRequests: this.metrics.requestCount,
      successRate: Math.round(successRate * 100) / 100,
      averageProcessingTime: Math.round(this.metrics.averageProcessingTime),
      totalDataProcessed
    };
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}

export default GeminiVisionService;
