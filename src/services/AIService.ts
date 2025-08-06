// NoteSpark AI - Gemini AI Transformation Service
// Cost-effective migration from OpenAI to Google Gemini 2.5 Flash
// Maintains exact same interface and output format for seamless transition

import { GoogleGenerativeAI } from '@google/generative-ai';
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

const TONE_PROMPTS: TonePrompts = {
  professional: `Transform the following raw text into well-structured, professional study notes. Format the output as clean HTML with proper headings, bullet points, and emphasis where appropriate. Focus on clarity, organization, and academic tone. Use <h2>, <h3>, <ul>, <li>, <strong>, and <em> tags as needed. Make sure the content is comprehensive and well-organized for studying. IMPORTANT: Return only the HTML content without any markdown code blocks or backticks.`,
  
  casual: `Transform the following raw text into friendly, easy-to-read study notes. Use a conversational tone that makes the content approachable and engaging. Format as HTML with headings, bullet points, and emphasis. Use <h2>, <h3>, <ul>, <li>, <strong>, and <em> tags. Make it feel like notes from a study buddy who explains things clearly and simply. IMPORTANT: Return only the HTML content without any markdown code blocks or backticks.`,
  
  simplified: `Transform the following raw text into simple, concise study notes that are easy to understand. Break down complex concepts into digestible pieces. Use clear, straightforward language and format as HTML with basic structure. Use <h2>, <h3>, <ul>, <li>, <strong>, and <em> tags. Focus on the most important points and make everything crystal clear. IMPORTANT: Return only the HTML content without any markdown code blocks or backticks.`
};

class AIService {
  private static instance: AIService;
  private readonly apiKey: string;
  private readonly genAI: GoogleGenerativeAI | null = null;
  private readonly model: any = null;

  constructor() {
    // Use react-native-config for environment variables - now using Gemini
    this.apiKey = Config.GEMINI_API_KEY || '';
    
    console.log('=== AIService (Gemini) Debug ===');
    console.log('Config.GEMINI_API_KEY:', this.apiKey ? 'SET' : 'NOT SET');
    console.log('Available config keys:', Object.keys(Config));
    console.log('===============================');
    
    if (!this.apiKey) {
      console.warn('WARNING: No Gemini API key found. AI features will not work. Please set GEMINI_API_KEY in your .env file');
    } else {
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
    }
  }

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  async transformTextToNote(request: AITransformationRequest): Promise<AITransformationResponse> {
    if (!this.apiKey || !this.model) {
      throw new Error('Gemini API key is not configured. Please check your environment setup.');
    }

    try {
      const prompt = TONE_PROMPTS[request.tone] || TONE_PROMPTS.professional;
      
      const fullPrompt = `${prompt}

Raw text to transform:

${request.text}`;

      console.log('AIService: Sending request to Gemini 2.5 Flash...');
      const result = await this.model.generateContent(fullPrompt);
      const response = await result.response;
      
      // Add better debugging for response
      console.log('AIService: Response received, checking content...');
      console.log('AIService: Response candidates:', response.candidates?.length || 0);
      
      let transformedText = response.text();

      if (!transformedText || transformedText.trim() === '') {
        console.log('AIService: Empty response received from Gemini');
        console.log('AIService: Response candidates:', JSON.stringify(response.candidates, null, 2));
        
        // Fallback: return the original text with basic formatting
        transformedText = request.text.trim();
        console.log('AIService: Using fallback - returning original text');
      } else {
        console.log('AIService: Received valid response from Gemini');
      }

      // Clean up the response - remove markdown code blocks if present
      transformedText = this.cleanupAIResponse(transformedText);

      // Generate a title for the note
      const title = await this.generateNoteTitle(transformedText);
      const wordCount = this.countWords(transformedText);

      return {
        transformedText,
        title,
        wordCount
      };

    } catch (error) {
      console.error('AIService: Error in transformTextToNote:', error);
      if (error instanceof Error) {
        throw new Error(`Gemini API error: ${error.message}`);
      }
      throw new Error('Failed to transform text with Gemini API');
    }
  }

  // New method for multi-page batch processing
  /**
   * Transform multiple images to note using Gemini 2.5 Flash multimodal processing
   * Enhanced with single API call for better performance and context understanding
   */
  async transformImagesToNote(
    imageUris: string[], 
    tone: 'professional' | 'casual' | 'simplified',
    onProgress?: (current: number, total: number) => void
  ): Promise<AITransformationResponse> {
    if (!this.apiKey || !this.model) {
      throw new Error('Gemini API key is not configured. Please check your environment setup.');
    }

    if (imageUris.length === 0) {
      throw new Error('No images provided for processing');
    }

    try {
      console.log(`AIService: Processing ${imageUris.length} images with Gemini 2.5 Flash multimodal...`);
      
      // Initialize Gemini Vision Service
      const geminiVision = GeminiVisionService.getInstance();
      if (!geminiVision.isConfigured()) {
        geminiVision.setGeminiModel(this.model);
      }

      // Report initial progress
      if (onProgress) {
        onProgress(1, 2); // Step 1: Processing images
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
        throw new Error('No text could be extracted from the provided images');
      }

      console.log(`AIService: Successfully extracted ${combinedText.length} characters from ${imageUris.length} image(s)`);
      
      // Report progress before transformation
      if (onProgress) {
        onProgress(2, 2); // Step 2: Transforming text
      }

      // Transform the extracted text using tone-specific prompts
      const transformationRequest: AITransformationRequest = {
        text: combinedText,
        tone
      };

      const transformedResult = await this.transformTextToNote(transformationRequest);
      
      console.log('AIService: Multi-image processing completed successfully');
      return transformedResult;
      
    } catch (error) {
      console.error('AIService: Error in transformImagesToNote:', error);
      if (error instanceof Error) {
        throw new Error(`Multi-image processing error: ${error.message}`);
      }
      throw new Error('Failed to process multiple images');
    }
  }

  // Helper method to extract text from a single image
  /**
   * Extract text from image using Gemini 2.5 Flash multimodal capabilities
   * Replaces ML Kit and Google Cloud Vision with superior AI processing
   */
  private async extractTextFromImage(imageUri: string): Promise<string> {
    try {
      console.log('AIService: Extracting text from image using Gemini 2.5 Flash...');
      
      // Initialize Gemini Vision Service
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
        console.log(`AIService: Successfully extracted ${result.text.length} characters from image`);
        console.log(`AIService: Document type detected: ${result.metadata.documentType}`);
        return result.text;
      } else {
        console.warn('AIService: No text extracted from image');
        return '';
      }

    } catch (error) {
      console.error('AIService: Error extracting text from image with Gemini:', error);
      // Return empty string instead of throwing to maintain backward compatibility
      return '';
    }
  }

  // Helper method to combine page texts with proper formatting
  private combinePageTexts(pageTexts: string[]): string {
    if (pageTexts.length === 0) return '';
    if (pageTexts.length === 1) return pageTexts[0];
    
    // Combine pages with clear page breaks
    return pageTexts
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
    if (!this.apiKey || !this.model) {
      throw new Error('Gemini API key is not configured. Please check your environment setup.');
    }

    try {
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

      console.log('AIService: Sending document processing request to Gemini 2.5 Flash...');
      const result = await this.model.generateContent(fullPrompt);
      const response = await result.response;
      let transformedText = response.text();

      if (!transformedText) {
        throw new Error('No content received from Gemini API');
      }

      console.log('AIService: Received document processing response from Gemini');

      // Clean up the response
      transformedText = this.cleanupAIResponse(transformedText);

      // Generate document-specific title
      const title = await this.generateDocumentTitle(transformedText, documentType);
      const wordCount = this.countWords(transformedText);

      return {
        transformedText,
        title,
        wordCount
      };

    } catch (error) {
      console.error('AIService: Error in processDocumentToNote:', error);
      if (error instanceof Error) {
        throw new Error(`Document processing error: ${error.message}`);
      }
      throw new Error('Failed to process document with Gemini API');
    }
  }

  async generateDocumentTitle(content: string, documentType: string): Promise<string> {
    try {
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
      console.warn('AIService: Failed to generate document title, using fallback:', error);
      return this.generateFallbackDocumentTitle(content, documentType);
    }
  }

  private generateFallbackDocumentTitle(content: string, documentType: string): string {
    // Extract meaningful content for title
    const cleanContent = content.replace(/<[^>]*>/g, '');
    const lines = cleanContent.split('\n').filter(line => line.trim().length > 0);
    
    // Look for the first substantial line that could be a title
    const meaningfulLine = lines.find(line => {
      const trimmed = line.trim();
      return trimmed.length > 5 && trimmed.length < 100 && !trimmed.match(/^(page|slide|document)\s+\d+/i);
    });
    
    if (meaningfulLine) {
      const title = meaningfulLine.trim().substring(0, 60);
      return title.length === 60 ? title + '...' : title;
    }
    
    // Generate type-based title as fallback
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
    try {
      if (!this.model) {
        return this.generateFallbackTitle(content);
      }

      const prompt = `Generate a concise, descriptive title (max 60 characters) for the following study notes. Return only the title, no quotes or extra text.

Content: ${content.substring(0, 1000)}`;

      console.log('AIService: Generating title with Gemini...');
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
      console.warn('AIService: Failed to generate title, using fallback:', error);
      return this.generateFallbackTitle(content);
    }
  }

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

  private cleanupAIResponse(response: string): string {
    // Remove markdown code blocks (```html, ```text, etc.)
    let cleaned = response.replace(/^```\w*\n?/gm, '').replace(/\n?```$/gm, '');
    
    // Remove any leading/trailing whitespace
    cleaned = cleaned.trim();
    
    // Remove any HTML comments that might have been added
    cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
    
    // Log the cleanup for debugging
    if (response !== cleaned) {
      console.log('AIService: Cleaned up AI response - removed markdown code blocks');
    }
    
    return cleaned;
  }

  private countWords(text: string): number {
    // Remove HTML tags and count words
    const plainText = text.replace(/<[^>]*>/g, '');
    const words = plainText.trim().split(/\s+/).filter(word => word.length > 0);
    return words.length;
  }

  // Health check method
  async checkAPIHealth(): Promise<boolean> {
    try {
      if (!this.apiKey || !this.model) {
        return false;
      }
      
      // Test with a simple prompt
      const result = await this.model.generateContent('Test connection');
      return result && result.response;
    } catch (error) {
      console.warn('AIService: Health check failed:', error);
      return false;
    }
  }

  /**
   * Process documents using Gemini 2.5 Flash native multimodal capabilities
   */
  async processDocumentWithGemini(request: DocumentProcessingRequest): Promise<DocumentProcessingResponse> {
    if (!this.apiKey || !this.model) {
      throw new Error('Gemini API key is not configured. Please check your environment setup.');
    }

    try {
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
          role: 'user',
          parts: [
            fileData,
            { text: request.prompt }
          ]
        }
      ];

      // Use Gemini's document understanding capabilities
      const result = await this.model.generateContent({
        contents,
        generationConfig: {
          temperature: 0.3, // Lower temperature for more accurate extraction
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 8000, // Higher limit for document content
        }
      });

      const response = await result.response;
      const extractedContent = response.text();

      if (!extractedContent || extractedContent.trim() === '') {
        throw new Error('No content extracted from document');
      }

      // Generate a title from the content
      const title = await this.generateNoteTitle(extractedContent);

      console.log('AIService: Document processed successfully via Gemini 2.5 Flash');
      
      return {
        extractedContent: this.cleanupAIResponse(extractedContent),
        title
      };

    } catch (error) {
      console.error('AIService: Document processing failed:', error);
      
      // Provide specific error messages for common issues
      if (error instanceof Error) {
        if (error.message.includes('quota') || error.message.includes('limit')) {
          throw new Error('API quota exceeded. Please try again later.');
        } else if (error.message.includes('invalid') || error.message.includes('unsupported')) {
          throw new Error('Document format not supported or file is corrupted.');
        }
      }
      
      throw new Error(`Document processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export { AIService, type AITransformationRequest, type AITransformationResponse, type DocumentProcessingRequest, type DocumentProcessingResponse };
