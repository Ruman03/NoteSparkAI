// NoteSpark AI - Gemini AI Transformation Service
// Cost-effective migration from OpenAI to Google Gemini 2.5 Flash
// Maintains exact same interface and output format for seamless transition

import { GoogleGenerativeAI } from '@google/generative-ai';
import Config from 'react-native-config';

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
      console.log(`AIService: Processing ${imageUris.length} images with Gemini 2.5 Flash...`);
      
      let combinedText = '';
      const pageTexts: string[] = [];
      
      // Process images sequentially to avoid API rate limits
      for (let i = 0; i < imageUris.length; i++) {
        const imageUri = imageUris[i];
        
        // Report progress
        if (onProgress) {
          onProgress(i + 1, imageUris.length);
        }
        
        console.log(`AIService: Processing page ${i + 1}/${imageUris.length}`);
        
        try {
          // Use the existing OCR processing (via VisionService or ML Kit)
          // This would need to be extracted from ScannerScreen into a shared service
          const pageText = await this.extractTextFromImage(imageUri);
          
          if (pageText && pageText.trim()) {
            pageTexts.push(pageText.trim());
            console.log(`AIService: Extracted ${pageText.length} characters from page ${i + 1}`);
          } else {
            console.warn(`AIService: No text extracted from page ${i + 1}`);
          }
          
          // Add small delay to respect API rate limits
          if (i < imageUris.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (pageError) {
          console.error(`AIService: Error processing page ${i + 1}:`, pageError);
          // Continue with other pages even if one fails
        }
      }
      
      if (pageTexts.length === 0) {
        throw new Error('No text could be extracted from any of the provided images');
      }
      
      // Combine all page texts with proper formatting
      combinedText = this.combinePageTexts(pageTexts);
      
      console.log(`AIService: Combined text from ${pageTexts.length} pages (${combinedText.length} characters)`);
      
      // Transform the combined text using Gemini
      const transformationRequest: AITransformationRequest = {
        text: combinedText,
        tone
      };
      
      return await this.transformTextToNote(transformationRequest);
      
    } catch (error) {
      console.error('AIService: Error in transformImagesToNote:', error);
      if (error instanceof Error) {
        throw new Error(`Multi-page processing error: ${error.message}`);
      }
      throw new Error('Failed to process multiple images');
    }
  }

  // Helper method to extract text from a single image
  private async extractTextFromImage(imageUri: string): Promise<string> {
    // This is a placeholder - in the actual implementation, this would use
    // the same OCR logic from ScannerScreen (VisionService + ML Kit fallback)
    // For now, we'll import and use the existing services
    try {
      // Import VisionService dynamically to avoid circular dependencies
      const VisionService = (await import('./VisionService')).default;
      const textRecognition = (await import('@react-native-ml-kit/text-recognition')).default;
      
      const visionService = VisionService.getInstance();
      
      // Try Google Cloud Vision first (highest accuracy)
      if (visionService.isConfigured()) {
        const visionResult = await visionService.extractTextFromImage(imageUri);
        if (visionResult && visionResult.text && visionResult.text.trim().length > 5) {
          return visionResult.text;
        }
      }
      
      // Fallback to ML Kit
      const ocrResult = await textRecognition.recognize(imageUri);
      return ocrResult?.text || '';
      
    } catch (error) {
      console.error('AIService: Error extracting text from image:', error);
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

  // New method for document processing
  async processDocumentToNote(
    extractedText: string,
    documentType: string,
    tone: 'professional' | 'casual' | 'simplified',
    options: {
      preserveStructure?: boolean;
      generateSummary?: boolean;
      autoTag?: boolean;
    } = {}
  ): Promise<AITransformationResponse> {
    if (!this.apiKey || !this.model) {
      throw new Error('Gemini API key is not configured. Please check your environment setup.');
    }

    try {
      console.log(`AIService: Processing ${documentType} document with Gemini 2.5 Flash...`);
      
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
}

export { AIService, type AITransformationRequest, type AITransformationResponse };
