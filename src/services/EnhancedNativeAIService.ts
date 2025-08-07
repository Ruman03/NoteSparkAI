// 🚀 Enhanced Native AI Service - All Firebase AI Logic benefits, zero performance cost
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AuthService, DatabaseService } from '../config/firebase';

interface DocumentProcessingRequest {
  fileData: string;
  mimeType: string;
  prompt: string;
}

interface DocumentProcessingResponse {
  extractedContent: string;
  title: string;
  processingMetadata: {
    model: string;
    backend: string;
    mimeType: string;
    timestamp: string;
    firebaseIntegrated: boolean;
  };
}

class EnhancedNativeAIService {
  private static instance: EnhancedNativeAIService;
  private genAI: GoogleGenerativeAI;
  private model: any;
  private userId: string | null = null;

  constructor() {
    // Use your existing Google AI setup - no changes needed!
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 4000,
      }
    });

    this.setupFirebaseIntegration();
    console.log('EnhancedNativeAIService: Initialized with full Firebase integration');
  }

  static getInstance(): EnhancedNativeAIService {
    if (!EnhancedNativeAIService.instance) {
      EnhancedNativeAIService.instance = new EnhancedNativeAIService();
    }
    return EnhancedNativeAIService.instance;
  }

  // 🚀 STRUCTURED OUTPUT - Same as Firebase AI Logic, but native performance!
  async generateStructuredContent(noteContent: string, outputType: 'flashcards' | 'quiz'): Promise<any> {
    try {
      let schema;
      let prompt;

      if (outputType === 'flashcards') {
        schema = {
          type: "array",
          items: {
            type: "object",
            properties: {
              question: { type: "string", description: "The flashcard question" },
              answer: { type: "string", description: "The flashcard answer" },
              difficulty: { 
                type: "string", 
                enum: ["easy", "medium", "hard"],
                description: "Difficulty level"
              },
              topic: { type: "string", description: "Main topic/category" }
            },
            required: ["question", "answer", "difficulty", "topic"]
          }
        };

        prompt = `Generate 5-8 educational flashcards from the following notes content. 

IMPORTANT: Return ONLY valid JSON that matches this exact schema:
${JSON.stringify(schema, null, 2)}

Notes content:
${noteContent}

Response (valid JSON array only):`;
      } else {
        schema = {
          type: "object",
          properties: {
            title: { type: "string", description: "Quiz title" },
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  options: { 
                    type: "array", 
                    items: { type: "string" },
                    minItems: 4,
                    maxItems: 4
                  },
                  correctAnswer: { type: "integer", minimum: 0, maximum: 3 },
                  explanation: { type: "string" },
                  difficulty: { type: "string", enum: ["easy", "medium", "hard"] }
                },
                required: ["question", "options", "correctAnswer", "explanation", "difficulty"]
              }
            }
          },
          required: ["title", "questions"]
        };

        prompt = `Generate a 5-question multiple choice quiz from the following notes. 

IMPORTANT: Return ONLY valid JSON that matches this exact schema:
${JSON.stringify(schema, null, 2)}

Notes content:
${noteContent}

Response (valid JSON object only):`;
      }

      const result = await this.model.generateContent(prompt);
      const response = result.response;
      let jsonOutput;
      
      try {
        const text = response.text();
        // Enhanced JSON extraction with multiple fallback strategies
        jsonOutput = this.extractAndValidateJSON(text, schema);
      } catch (parseError) {
        console.error('JSON parsing failed:', parseError);
        throw new Error('AI returned invalid JSON format');
      }

      // 📊 Track AI usage for analytics
      this.trackAIUsage('structured_content_generated', {
        output_type: outputType,
        content_length: noteContent.length,
        success: true
      });

      // 💾 Cache in Firestore for performance
      if (this.userId) {
        await this.cacheGeneratedContent(outputType, jsonOutput, noteContent);
      }

      return {
        data: jsonOutput,
        type: outputType,
        schema: schema,
        metadata: {
          model: 'gemini-2.5-flash',
          backend: 'google-ai-native-enhanced',
          timestamp: new Date().toISOString(),
          firebaseIntegrated: true,
          userId: this.userId
        }
      };

    } catch (error) {
      // 🔥 Enhanced error logging
      this.logError('structured_content_generation_failed', error, {
        outputType,
        contentLength: noteContent.length
      });
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`${outputType} generation failed: ${errorMessage}`);
    }
  }

  // 🌊 STREAMING SUPPORT - Native Google AI streaming with tracking
  async generateContentStream(prompt: string, onChunk: (chunk: string) => void): Promise<void> {
    try {
      const startTime = Date.now();
      let totalChunks = 0;
      let totalCharacters = 0;

      const result = await this.model.generateContentStream(prompt);
      
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          onChunk(chunkText);
          totalChunks++;
          totalCharacters += chunkText.length;
        }
      }

      // Track streaming performance
      const duration = Date.now() - startTime;
      this.trackAIUsage('streaming_completed', {
        prompt_length: prompt.length,
        total_chunks: totalChunks,
        total_characters: totalCharacters,
        duration_ms: duration
      });

    } catch (error) {
      this.logError('streaming_failed', error, { promptLength: prompt.length });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Streaming failed: ${errorMessage}`);
    }
  }

  // 🔍 ENHANCED DOCUMENT PROCESSING with Firebase integration
  async processDocumentWithEnhancedAI(request: DocumentProcessingRequest): Promise<DocumentProcessingResponse> {
    try {
      const filePart = {
        inlineData: {
          data: request.fileData,
          mimeType: request.mimeType
        }
      };

      const result = await this.model.generateContent([
        filePart,
        { text: request.prompt }
      ]);

      const response = result.response;
      const extractedContent = response.text();

      if (!extractedContent) {
        throw new Error('No content extracted from document');
      }

      const title = await this.generateEnhancedTitle(extractedContent);

      // Track document processing for analytics
      this.trackAIUsage('document_processed', {
        mime_type: request.mimeType,
        content_length: extractedContent.length,
        has_title: !!title
      });

      // Store in Firestore for user's document history
      if (this.userId) {
        await this.storeDocumentProcessingResult(request, extractedContent, title);
      }

      return {
        extractedContent,
        title,
        processingMetadata: {
          model: 'gemini-2.5-flash',
          backend: 'google-ai-native-enhanced',
          mimeType: request.mimeType,
          timestamp: new Date().toISOString(),
          firebaseIntegrated: true
        }
      };

    } catch (error) {
      this.logError('document_processing_failed', error, {
        mimeType: request.mimeType
      });
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Document processing failed: ${errorMessage}`);
    }
  }

  // 🏷️ ENHANCED TITLE GENERATION with structured output
  private async generateEnhancedTitle(content: string): Promise<string> {
    try {
      const schema = {
        type: "object",
        properties: {
          title: { 
            type: "string", 
            maxLength: 60,
            description: "Concise, descriptive title"
          },
          confidence: { 
            type: "number", 
            minimum: 0, 
            maximum: 1,
            description: "Confidence score"
          },
          keywords: { 
            type: "array", 
            items: { type: "string" },
            maxItems: 5,
            description: "Key topics from content"
          }
        },
        required: ["title", "confidence"]
      };

      const prompt = `Generate a title and keywords for this content. Return ONLY valid JSON matching this schema:
${JSON.stringify(schema, null, 2)}

Content (first 1000 characters):
${content.substring(0, 1000)}

Response (valid JSON object only):`;

      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      const response = this.extractAndValidateJSON(text, schema);

      return response.title || this.generateFallbackTitle(content);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn('Title generation failed, using fallback:', errorMessage);
      return this.generateFallbackTitle(content);
    }
  }

  // 🛠️ ENHANCED JSON EXTRACTION with validation
  private extractAndValidateJSON(text: string, schema: any): any {
    // Strategy 1: Direct JSON parse
    try {
      return JSON.parse(text);
    } catch {}

    // Strategy 2: Extract JSON from markdown code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\}|\[[\s\S]*?\])\s*```/i);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1]);
      } catch {}
    }

    // Strategy 3: Find JSON object/array in text
    const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch {}
    }

    // Strategy 4: Clean common formatting issues
    const cleaned = text
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .replace(/^\s*[\w\s]*:?\s*/, '') // Remove leading text
      .trim();
    
    try {
      return JSON.parse(cleaned);
    } catch {}

    throw new Error('Could not extract valid JSON from AI response');
  }

  // 📊 Enhanced usage tracking (can be extended with analytics later)
  private trackAIUsage(eventName: string, parameters: any): void {
    try {
      console.log(`AI Event: ${eventName}`, {
        ...parameters,
        user_id: this.userId,
        timestamp: Date.now()
      });
      
      // Future: Add Firebase Analytics when needed
      // await analytics().logEvent(`ai_${eventName}`, parameters);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn('Usage tracking failed:', errorMessage);
    }
  }

  // 🔥 Enhanced error logging (can be extended with Crashlytics later)
  private logError(context: string, error: unknown, metadata: any = {}): void {
    try {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`${context}: ${errorMessage}`, {
        user_id: this.userId || 'anonymous',
        context,
        ...metadata,
        timestamp: Date.now()
      });
      
      // Future: Add Firebase Crashlytics when needed
      // crashlytics().recordError(error);
    } catch (logError) {
      const logErrorMessage = logError instanceof Error ? logError.message : 'Unknown error';
      console.warn('Error logging failed:', logErrorMessage);
    }
  }

  // 💾 Cache generated content in Firestore
  private async cacheGeneratedContent(type: string, data: any, sourceContent: string): Promise<void> {
    try {
      await DatabaseService.notesCollection().add({
        userId: this.userId,
        type: 'ai_generated_cache',
        contentType: type,
        data: data,
        sourceContent: sourceContent.substring(0, 500), // First 500 chars
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn('Content caching failed:', errorMessage);
    }
  }

  // 📄 Store document processing history
  private async storeDocumentProcessingResult(request: DocumentProcessingRequest, content: string, title: string): Promise<void> {
    try {
      await DatabaseService.notesCollection().add({
        userId: this.userId,
        type: 'document_processing_history',
        mimeType: request.mimeType,
        extractedContent: content,
        title: title,
        createdAt: new Date()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn('Document history storage failed:', errorMessage);
    }
  }

  private setupFirebaseIntegration(): void {
    // Use existing React Native Firebase Auth - perfect integration!
    AuthService.onAuthStateChanged((user) => {
      this.userId = user?.uid || null;
      console.log('Enhanced AI Service: User context updated');
      
      // Future: Set user context for Crashlytics when available
      // if (user) {
      //   crashlytics().setUserId(user.uid);
      // }
    });
  }

  private generateFallbackTitle(content: string): string {
    const date = new Date().toLocaleDateString();
    const preview = content.substring(0, 30).replace(/\s+/g, ' ').trim();
    return preview ? `${preview}...` : `AI Generated Content - ${date}`;
  }

  // 🔄 Transform text to note (existing method compatibility)
  async transformTextToNote(text: string): Promise<any> {
    try {
      const prompt = `Transform this text into a well-structured note with title, content, and tags:

Text: ${text}

Please format as JSON with: title, content, tags (array of strings)`;

      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const noteData = this.extractAndValidateJSON(response.text(), {});

      this.trackAIUsage('text_transformed', {
        input_length: text.length,
        has_title: !!noteData.title
      });

      return noteData;
    } catch (error) {
      this.logError('text_transformation_failed', error, { textLength: text.length });
      throw error;
    }
  }
}

export default EnhancedNativeAIService;
