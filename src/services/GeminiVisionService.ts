import { GenerativeModel, Part } from '@google/generative-ai';
import RNFS from 'react-native-fs';

export interface GeminiVisionResult {
  text: string;
  confidence: number;
  metadata: {
    hasTablesDetected: boolean;
    hasHandwritingDetected: boolean;
    documentType: 'text' | 'form' | 'receipt' | 'presentation' | 'handwritten' | 'mixed';
    languagesDetected: string[];
    pageCount: number;
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
}

export interface GeminiVisionOptions {
  preserveLayout?: boolean;
  extractTables?: boolean;
  enhanceHandwriting?: boolean;
  detectLanguages?: boolean;
  analyzeStructure?: boolean;
  describeImages?: boolean;
}

/**
 * Enhanced vision service using Gemini 2.5 Flash multimodal capabilities
 * Replaces ML Kit and Google Cloud Vision with superior AI-powered processing
 */
export class GeminiVisionService {
  private static instance: GeminiVisionService;
  private geminiModel: GenerativeModel | null = null;

  private constructor() {
    // Model will be initialized when AIService provides it
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
    this.geminiModel = model;
  }

  /**
   * Check if the service is properly configured
   */
  public isConfigured(): boolean {
    return this.geminiModel !== null;
  }

  /**
   * Extract text from a single image using Gemini 2.5 Flash
   */
  public async extractTextFromImage(
    imageUri: string, 
    options: GeminiVisionOptions = {}
  ): Promise<GeminiVisionResult> {
    if (!this.geminiModel) {
      throw new Error('GeminiVisionService not initialized. Call setGeminiModel() first.');
    }

    try {
      console.log('GeminiVisionService: Processing image with Gemini 2.5 Flash...');

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
      const result = await this.geminiModel.generateContent([prompt, imagePart]);
      const response = await result.response;
      const responseText = response.text();

      if (!responseText) {
        throw new Error('No response received from Gemini');
      }

      // Parse Gemini's response
      const parsedResult = this.parseGeminiResponse(responseText, options);
      
      console.log('GeminiVisionService: Successfully processed image');
      return parsedResult;

    } catch (error) {
      console.error('GeminiVisionService: Error processing image:', error);
      throw new Error(`Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process multiple images as a single document
   */
  public async processMultipleImages(
    imageUris: string[], 
    options: GeminiVisionOptions & { combinePages?: boolean; preservePageBreaks?: boolean } = {}
  ): Promise<GeminiVisionResult> {
    if (!this.geminiModel) {
      throw new Error('GeminiVisionService not initialized. Call setGeminiModel() first.');
    }

    if (imageUris.length === 0) {
      throw new Error('No images provided for processing');
    }

    try {
      console.log(`GeminiVisionService: Processing ${imageUris.length} images as multi-page document...`);

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
      const result = await this.geminiModel.generateContent(content);
      const response = await result.response;
      const responseText = response.text();

      if (!responseText) {
        throw new Error('No response received from Gemini for multi-page processing');
      }

      // Parse multi-page response
      const parsedResult = this.parseGeminiResponse(responseText, options);
      parsedResult.metadata.pageCount = imageUris.length;
      
      console.log(`GeminiVisionService: Successfully processed ${imageUris.length} page document`);
      return parsedResult;

    } catch (error) {
      console.error('GeminiVisionService: Error processing multiple images:', error);
      throw new Error(`Multi-page processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze image content beyond just text extraction
   */
  public async analyzeImageContent(imageUri: string): Promise<ImageAnalysis> {
    if (!this.geminiModel) {
      throw new Error('GeminiVisionService not initialized');
    }

    try {
      const imageBase64 = await this.convertImageToBase64(imageUri);
      const imagePart: Part = {
        inlineData: {
          data: imageBase64,
          mimeType: this.getMimeTypeFromUri(imageUri)
        }
      };

      const analysisPrompt = `Analyze this image comprehensively:

1. Provide a detailed description of what you see
2. Extract all text content (if any)
3. Assess image quality and suggest improvements if needed
4. Identify the type of document/content

Format your response as JSON:
{
  "description": "detailed description",
  "textContent": "extracted text",
  "confidence": 0.95,
  "suggestedImprovements": ["improvement suggestions"]
}`;

      const result = await this.geminiModel.generateContent([analysisPrompt, imagePart]);
      const response = await result.response;
      const responseText = response.text();

      // Parse JSON response
      try {
        const cleanedResponse = this.cleanJsonResponse(responseText);
        return JSON.parse(cleanedResponse);
      } catch (parseError) {
        // Fallback if JSON parsing fails
        return {
          description: responseText,
          textContent: '',
          confidence: 0.8,
          suggestedImprovements: []
        };
      }

    } catch (error) {
      console.error('GeminiVisionService: Error analyzing image:', error);
      throw error;
    }
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
   * Parse Gemini's response into structured format
   */
  private parseGeminiResponse(responseText: string, options: GeminiVisionOptions): GeminiVisionResult {
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
        pageCount: 1
      }
    };
  }

  /**
   * Convert image to base64 for Gemini API
   */
  private async convertImageToBase64(imageUri: string): Promise<string> {
    try {
      // Handle different URI formats
      let filePath = imageUri;
      if (imageUri.startsWith('file://')) {
        filePath = imageUri.replace('file://', '');
      }

      // Read file as base64
      const base64String = await RNFS.readFile(filePath, 'base64');
      return base64String;

    } catch (error) {
      console.error('GeminiVisionService: Error converting image to base64:', error);
      throw new Error(`Failed to read image file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get MIME type from image URI
   */
  private getMimeTypeFromUri(imageUri: string): string {
    const extension = imageUri.toLowerCase().split('.').pop();
    
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
        return 'image/jpeg'; // Default fallback
    }
  }

  /**
   * Clean JSON response from Gemini (remove markdown formatting)
   */
  private cleanJsonResponse(response: string): string {
    // Remove markdown code blocks if present
    let cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    // Find JSON content between first { and last }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    
    return cleaned;
  }
}

export default GeminiVisionService;
