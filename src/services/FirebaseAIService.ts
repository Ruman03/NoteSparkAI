// Firebase AI Logic Implementation for NoteSpark AI
// Migration from @google/generative-ai to Firebase Web SDK with AI Logic
// Uses Firebase Web SDK for AI features alongside React Native Firebase

import RNFS from 'react-native-fs';

// Import Firebase Web SDK for AI features
// Note: Install these packages first: npm install firebase @firebase/ai
declare var require: any;
const { initializeApp, getApps } = require('firebase/app');

// Firebase AI Logic import (will be available after Firebase upgrade)
// Note: This requires Firebase v12+ which includes @firebase/ai
interface FirebaseAI {
  generativeModel: (config: { modelName: string; generationConfig?: any }) => any;
}

// Temporarily declare the firebaseAI function until types are available
declare function firebaseAI(app: any, config?: { backend: string; location: string }): FirebaseAI;

// Interface definitions (keeping existing structure)
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

interface GeminiVisionOptions {
  preserveLayout?: boolean;
  extractTables?: boolean;
  enhanceHandwriting?: boolean;
}

interface GeminiVisionResult {
  text: string;
  confidence: number;
  sections?: any[];
}

class FirebaseAIService {
  private static instance: FirebaseAIService;
  private ai: any;
  private geminiModel: any;

  constructor() {
    try {
      // Use existing Firebase app configuration
      const apps = getApps();
      const app = apps.length > 0 ? apps[0] : null;
      
      if (!app) {
        throw new Error('No Firebase app found. Please initialize Firebase first.');
      }
      
      // Initialize Firebase AI Logic with Vertex AI backend
      this.ai = firebaseAI(app, {
        backend: 'vertex-ai',
        location: 'global' // Use global location for best availability
      });

      // Create Gemini 2.5 Flash model instance
      this.geminiModel = this.ai.generativeModel({
        modelName: 'gemini-2.5-flash'
      });

      console.log('FirebaseAIService: Successfully initialized with Vertex AI backend');
    } catch (error) {
      console.error('FirebaseAIService: Initialization error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to initialize Firebase AI Logic: ${errorMessage}`);
    }
  }

  static getInstance(): FirebaseAIService {
    if (!FirebaseAIService.instance) {
      FirebaseAIService.instance = new FirebaseAIService();
    }
    return FirebaseAIService.instance;
  }

  // Transform text to notes (replaces current AIService method)
  async transformTextToNote(request: AITransformationRequest): Promise<AITransformationResponse> {
    try {
      const prompt = this.buildTonePrompt(request.tone, request.text);
      
      console.log('FirebaseAIService: Sending transformation request to Vertex AI Gemini...');
      const result = await this.geminiModel.generateContent(prompt);
      const response = result.response;
      const transformedText = response.text();

      if (!transformedText) {
        throw new Error('No content received from Firebase AI Logic');
      }

      console.log('FirebaseAIService: Received response from Vertex AI');

      // Generate title and count words
      const title = await this.generateNoteTitle(transformedText);
      const wordCount = this.countWords(transformedText);

      return {
        transformedText: this.cleanupAIResponse(transformedText),
        title,
        wordCount
      };
    } catch (error) {
      console.error('FirebaseAIService: Error in transformTextToNote:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Firebase AI Logic error: ${errorMessage}`);
    }
  }

  // Process documents with multimodal capabilities
  async processDocumentWithFirebaseAI(request: DocumentProcessingRequest): Promise<DocumentProcessingResponse> {
    try {
      console.log(`FirebaseAIService: Processing document with Vertex AI Gemini (${request.mimeType})`);

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

      const result = await this.geminiModel.generateContent({
        contents,
        generationConfig: {
          temperature: 0.3,
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 8000,
        }
      });

      const response = result.response;
      const extractedContent = response.text();

      if (!extractedContent || extractedContent.trim() === '') {
        throw new Error('No content extracted from document');
      }

      const title = await this.generateNoteTitle(extractedContent);

      console.log('FirebaseAIService: Document processed successfully via Vertex AI');

      return {
        extractedContent: this.cleanupAIResponse(extractedContent),
        title
      };
    } catch (error) {
      console.error('FirebaseAIService: Document processing error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Firebase AI Logic document processing failed: ${errorMessage}`);
    }
  }

  // Generate structured output (JSON) - Enhanced capability
  async generateStructuredOutput(prompt: string, responseSchema: any): Promise<any> {
    try {
      const model = this.ai.generativeModel({
        modelName: 'gemini-2.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema
        }
      });

      console.log('FirebaseAIService: Generating structured output...');
      const result = await model.generateContent(prompt);
      const response = result.response;
      const jsonText = response.text();

      return JSON.parse(jsonText);
    } catch (error) {
      console.error('FirebaseAIService: Structured output error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Structured output generation failed: ${errorMessage}`);
    }
  }

  // Vision capabilities with Firebase AI Logic
  async analyzeImage(imageUri: string, prompt: string): Promise<string> {
    try {
      const imageData = await this.convertImageToBase64(imageUri);
      const imagePart = {
        inlineData: {
          data: imageData,
          mimeType: 'image/jpeg'
        }
      };

      console.log('FirebaseAIService: Analyzing image with Vertex AI...');
      const result = await this.geminiModel.generateContent([prompt, imagePart]);
      const response = result.response;
      return response.text();
    } catch (error) {
      console.error('FirebaseAIService: Image analysis error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Image analysis failed: ${errorMessage}`);
    }
  }

  // Extract text from image (GeminiVisionService replacement)
  async extractTextFromImage(imageUri: string, options: GeminiVisionOptions = {}): Promise<GeminiVisionResult> {
    try {
      const prompt = this.buildExtractionPrompt(options);
      const extractedText = await this.analyzeImage(imageUri, prompt);
      
      return {
        text: extractedText,
        confidence: 0.95, // Firebase AI typically has high confidence
        sections: this.parseExtractedText(extractedText)
      };
    } catch (error) {
      console.error('FirebaseAIService: Text extraction error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Text extraction failed: ${errorMessage}`);
    }
  }

  // Streaming support for real-time responses
  async generateContentStream(prompt: string, onChunk: (chunk: string) => void): Promise<void> {
    try {
      console.log('FirebaseAIService: Starting streaming generation...');
      const result = this.geminiModel.generateContentStream(prompt);
      
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          onChunk(chunkText);
        }
      }
    } catch (error) {
      console.error('FirebaseAIService: Streaming error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Streaming generation failed: ${errorMessage}`);
    }
  }

  // Enhanced error handling with Firebase integration
  async checkAPIHealth(): Promise<boolean> {
    try {
      console.log('FirebaseAIService: Checking API health...');
      const result = await this.geminiModel.generateContent('Test connection');
      const response = result.response;
      return response.text() !== null;
    } catch (error) {
      console.error('FirebaseAIService: Health check failed:', error);
      return false;
    }
  }

  // Generate note title using Firebase AI
  async generateNoteTitle(content: string): Promise<string> {
    try {
      const prompt = `Generate a concise, descriptive title (max 60 characters) for the following study notes. Return only the title, no quotes or extra text.\n\nContent: ${content.substring(0, 1000)}`;
      
      const result = await this.geminiModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 20,
        }
      });
      
      const response = result.response;
      return response.text()?.trim() || this.generateFallbackTitle(content);
    } catch (error) {
      console.warn('FirebaseAIService: Title generation failed, using fallback:', error);
      return this.generateFallbackTitle(content);
    }
  }

  // Generate document title using Firebase AI
  async generateDocumentTitle(content: string, documentType: string): Promise<string> {
    try {
      const prompt = `Generate a concise, descriptive title (max 60 characters) for this ${documentType} document. Return only the title, no quotes or extra text.\n\nContent: ${content.substring(0, 1000)}`;
      
      const result = await this.geminiModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 25,
        }
      });
      
      const response = result.response;
      const title = response.text()?.trim() || '';
      
      return title || this.generateFallbackDocumentTitle(content, documentType);
    } catch (error) {
      console.warn('FirebaseAIService: Document title generation failed, using fallback:', error);
      return this.generateFallbackDocumentTitle(content, documentType);
    }
  }

  // Enhanced capabilities for future features
  async generateFlashcards(noteContent: string): Promise<any> {
    const schema = {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          answer: { type: "string" },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] }
        },
        required: ["question", "answer", "difficulty"]
      }
    };

    const prompt = `Generate 5-10 educational flashcards from the following notes content. Focus on key concepts, definitions, and important facts:\n\n${noteContent}`;
    return await this.generateStructuredOutput(prompt, schema);
  }

  async generateQuiz(noteContent: string): Promise<any> {
    const schema = {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              options: { type: "array", items: { type: "string" } },
              correctAnswer: { type: "number" },
              explanation: { type: "string" }
            },
            required: ["question", "options", "correctAnswer", "explanation"]
          }
        }
      },
      required: ["questions"]
    };

    const prompt = `Generate a 5-question multiple choice quiz from the following notes. Include explanations for correct answers:\n\n${noteContent}`;
    return await this.generateStructuredOutput(prompt, schema);
  }

  // Private helper methods
  private buildTonePrompt(tone: 'professional' | 'casual' | 'simplified', text: string): string {
    const tonePrompts: Record<'professional' | 'casual' | 'simplified', string> = {
      professional: `Transform the following raw text into well-structured, professional study notes. Format the output as clean HTML with proper headings, bullet points, and emphasis where appropriate. Focus on clarity, organization, and academic tone. Use <h2>, <h3>, <ul>, <li>, <strong>, and <em> tags as needed. Make sure the content is comprehensive and well-organized for studying. IMPORTANT: Return only the HTML content without any markdown code blocks or backticks.`,
      casual: `Transform the following raw text into friendly, easy-to-read study notes. Use a conversational tone that makes the content approachable and engaging. Format as HTML with headings, bullet points, and emphasis. Use <h2>, <h3>, <ul>, <li>, <strong>, and <em> tags. Make it feel like notes from a study buddy who explains things clearly and simply. IMPORTANT: Return only the HTML content without any markdown code blocks or backticks.`,
      simplified: `Transform the following raw text into simple, concise study notes that are easy to understand. Break down complex concepts into digestible pieces. Use clear, straightforward language and format as HTML with basic structure. Use <h2>, <h3>, <ul>, <li>, <strong>, and <em> tags. Focus on the most important points and make everything crystal clear. IMPORTANT: Return only the HTML content without any markdown code blocks or backticks.`
    };

    return `${tonePrompts[tone]}\n\nRaw text to transform:\n\n${text}`;
  }

  private buildExtractionPrompt(options: GeminiVisionOptions): string {
    let prompt = `Please extract all visible text from this image. `;

    if (options.enhanceHandwriting) {
      prompt += `Pay special attention to handwritten text and convert it accurately. `;
    }

    if (options.extractTables) {
      prompt += `If there are tables, preserve their structure using appropriate formatting. `;
    }

    if (options.preserveLayout) {
      prompt += `Maintain the original layout and structure of the document. `;
    }

    prompt += `Please provide the extracted text in a clean, readable format. If the image contains structured content like forms, tables, or formatted documents, preserve that structure in your response.`;

    return prompt;
  }

  private parseExtractedText(text: string): any[] {
    // Basic parsing for sections - can be enhanced
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    return lines.map((line, index) => ({
      id: index,
      content: line.trim(),
      type: line.match(/^#+\s/) ? 'heading' : 'text'
    }));
  }

  private async convertImageToBase64(imageUri: string): Promise<string> {
    try {
      return await RNFS.readFile(imageUri, 'base64');
    } catch (error) {
      console.error('FirebaseAIService: Image conversion error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to convert image to base64: ${errorMessage}`);
    }
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
}

export default FirebaseAIService;
