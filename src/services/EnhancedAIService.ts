// Enhanced AIService with Firebase ecosystem preparation
// Immediate improvement to current Google Gemini API implementation
// Prepares for future Firebase AI Logic migration while providing enhanced features

import { GoogleGenerativeAI } from '@google/generative-ai';
import Config from 'react-native-config';
import { AuthService } from '../config/firebase';

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
  title: string;
}

interface UsageMetrics {
  feature: string;
  variant: string;
  userId?: string;
  timestamp: Date;
  success: boolean;
  duration?: number;
}

class EnhancedAIService {
  private static instance: EnhancedAIService;
  private model: any;
  private apiKey: string;
  private userId: string | null = null;
  private usageMetrics: UsageMetrics[] = [];

  constructor() {
    this.apiKey = Config.GEMINI_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('WARNING: No Gemini API key found. AI features will not work.');
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
    console.log('EnhancedAIService: Initialized with Firebase ecosystem integration');
  }

  static getInstance(): EnhancedAIService {
    if (!EnhancedAIService.instance) {
      EnhancedAIService.instance = new EnhancedAIService();
    }
    return EnhancedAIService.instance;
  }

  private setupFirebaseIntegration() {
    // Listen to Firebase Auth state changes for user context
    AuthService.onAuthStateChanged((user) => {
      this.userId = user?.uid || null;
      console.log('EnhancedAIService: Firebase user context updated:', 
        this.userId ? 'Authenticated' : 'Anonymous');
    });
  }

  // Enhanced text transformation with Firebase context
  async transformTextToNote(request: AITransformationRequest): Promise<AITransformationResponse> {
    const startTime = Date.now();
    
    try {
      if (!this.model) {
        throw new Error('Gemini model not initialized. Check API key configuration.');
      }

      console.log('EnhancedAIService: Processing text transformation with Firebase context...');
      
      // Enhanced prompt with user context
      const enhancedPrompt = this.buildEnhancedPrompt(request);
      
      const result = await this.model.generateContent(enhancedPrompt);
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

      // Track successful usage
      this.trackUsage('text_transformation', request.tone, true, Date.now() - startTime);

      console.log('EnhancedAIService: Text transformation completed successfully');

      return {
        transformedText,
        title,
        wordCount
      };

    } catch (error) {
      // Enhanced error tracking
      this.trackUsage('text_transformation', request.tone, false, Date.now() - startTime);
      this.trackError('text_transformation', error);
      
      console.error('EnhancedAIService: Text transformation error:', error);
      throw new Error(`Enhanced AI processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Enhanced document processing
  async processDocumentWithGemini(request: DocumentProcessingRequest): Promise<DocumentProcessingResponse> {
    const startTime = Date.now();
    
    try {
      if (!this.model) {
        throw new Error('Gemini model not initialized. Check API key configuration.');
      }

      console.log(`EnhancedAIService: Processing document with Firebase context (${request.mimeType})`);

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

      const result = await this.model.generateContent({
        contents,
        generationConfig: {
          temperature: 0.3,
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 8000,
        }
      });

      const response = await result.response;
      const extractedContent = response.text();

      if (!extractedContent || extractedContent.trim() === '') {
        throw new Error('No content extracted from document');
      }

      const title = await this.generateNoteTitle(extractedContent);

      // Track successful document processing
      this.trackUsage('document_processing', request.mimeType, true, Date.now() - startTime);

      console.log('EnhancedAIService: Document processing completed successfully');

      return {
        extractedContent: this.cleanupAIResponse(extractedContent),
        title
      };

    } catch (error) {
      this.trackUsage('document_processing', request.mimeType, false, Date.now() - startTime);
      this.trackError('document_processing', error);
      
      console.error('EnhancedAIService: Document processing error:', error);
      throw new Error(`Document processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  // Get usage analytics (preparing for Firebase Analytics)
  getUsageMetrics(): UsageMetrics[] {
    return [...this.usageMetrics];
  }

  // Clear metrics (for privacy)
  clearUsageMetrics(): void {
    this.usageMetrics = [];
    console.log('EnhancedAIService: Usage metrics cleared');
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
    const metric: UsageMetrics = {
      feature,
      variant,
      userId: this.userId || undefined,
      timestamp: new Date(),
      success,
      duration
    };

    this.usageMetrics.push(metric);

    // Keep only last 100 metrics to avoid memory issues
    if (this.usageMetrics.length > 100) {
      this.usageMetrics = this.usageMetrics.slice(-100);
    }

    console.log(`Usage tracked: ${feature}(${variant}) - ${success ? 'SUCCESS' : 'FAILED'}${duration ? ` in ${duration}ms` : ''}`);

    // TODO: When migrating to Firebase AI Logic, integrate with Firebase Analytics
    // analytics().logEvent('ai_feature_used', {
    //   feature,
    //   variant,
    //   success,
    //   duration,
    //   user_id: this.userId
    // });
  }

  private trackError(feature: string, error: any) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error tracked: ${feature} - ${errorMessage}`);

    // TODO: When migrating to Firebase AI Logic, integrate with Firebase Crashlytics
    // crashlytics().recordError(error);
    // crashlytics().log(`AI Service error in ${feature}: ${errorMessage}`);
  }
}

export default EnhancedAIService;
