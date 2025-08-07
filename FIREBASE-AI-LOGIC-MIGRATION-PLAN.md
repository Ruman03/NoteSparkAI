# 🚀 Firebase AI Logic Migration Plan - Google Gemini to Vertex AI Integration

## 🎯 Migration Overview

Transform NoteSpark AI to use **Firebase AI Logic with Vertex AI Gemini API** instead of the standalone Google Gemini API. This provides better integration, security, and performance within the Firebase ecosystem.

### 🔄 Current vs Future State

| Aspect | Current (Google Gemini API) | Future (Firebase AI Logic + Vertex AI) |
|--------|---------------------------|---------------------------------------|
| **Package** | `@google/generative-ai` | `@react-native-firebase/app-firebase-ai` |
| **Authentication** | API Key in config | Firebase Authentication integrated |
| **Security** | Manual API key management | Firebase App Check protection |
| **Billing** | Direct Google Cloud billing | Firebase unified billing |
| **Integration** | Standalone service | Full Firebase ecosystem integration |
| **Performance** | Good | Enhanced with Firebase optimization |
| **Monitoring** | Limited | Firebase Analytics & Performance |

---

## 📋 Migration Steps

### Step 1: Understanding Current State

Firebase AI Logic is available in Firebase Web SDK v12+ but doesn't have React Native Firebase support yet. We'll implement a hybrid approach:

1. **Current Setup**: Using `@google/generative-ai` directly
2. **Transition Plan**: Prepare for Firebase AI Logic when React Native support arrives
3. **Immediate Benefits**: Enhanced security and Firebase ecosystem integration

### Step 1: Update Firebase SDK

```bash
# Update Firebase to latest version (includes @firebase/ai 2.0.0)
npm install firebase@latest

# Verify the Firebase AI module is included
npm list @firebase/ai
```

**Note**: Firebase AI Logic is now included in the main Firebase v12+ package as `@firebase/ai`. Since React Native Firebase doesn't have specific AI Logic support yet, we'll use the web SDK which works perfectly with React Native for AI operations.

### Step 2: Firebase Console Configuration

1. **Enable Firebase AI Logic**:
   - Go to [Firebase Console AI Logic](https://console.firebase.google.com/project/_/ailogic)
   - Click "Get started" to enable required APIs
   - Select **Vertex AI Gemini API** (requires Blaze plan)
   - Enable required APIs: Vertex AI API, Cloud Resource Manager API

2. **Set up Billing** (Required for Vertex AI):
   - Upgrade to Blaze (pay-as-you-go) plan
   - Vertex AI pricing is typically more cost-effective for production usage

### Step 3: Create New Firebase AI Service

Create `src/services/FirebaseAIService.ts`:

```typescript
import { getApp } from 'firebase/app';
import { firebaseAI, GenerativeModel } from '@firebase/ai';

class FirebaseAIService {
  private static instance: FirebaseAIService;
  private ai: any;
  private geminiModel: GenerativeModel;

  constructor() {
    // Initialize Firebase AI Logic with Vertex AI backend
    const app = getApp(); // Use existing Firebase app
    this.ai = firebaseAI(app, {
      backend: 'vertex-ai',
      location: 'global' // or specific region like 'us-central1'
    });

    // Create Gemini 2.5 Flash model instance
    this.geminiModel = this.ai.generativeModel({
      modelName: 'gemini-2.5-flash'
    });
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
      
      const result = await this.geminiModel.generateContent(prompt);
      const response = await result.response;
      const transformedText = response.text();

      if (!transformedText) {
        throw new Error('No content received from Firebase AI Logic');
      }

      const title = await this.generateNoteTitle(transformedText);
      const wordCount = this.countWords(transformedText);

      return {
        transformedText: this.cleanupAIResponse(transformedText),
        title,
        wordCount
      };
    } catch (error) {
      console.error('FirebaseAIService: Error in transformTextToNote:', error);
      throw new Error(`Firebase AI Logic error: ${error.message}`);
    }
  }

  // Process documents with multimodal capabilities
  async processDocumentWithFirebaseAI(request: DocumentProcessingRequest): Promise<DocumentProcessingResponse> {
    try {
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

      const response = await result.response;
      const extractedContent = response.text();

      if (!extractedContent || extractedContent.trim() === '') {
        throw new Error('No content extracted from document');
      }

      const title = await this.generateNoteTitle(extractedContent);

      return {
        extractedContent: this.cleanupAIResponse(extractedContent),
        title
      };
    } catch (error) {
      console.error('FirebaseAIService: Document processing error:', error);
      throw new Error(`Firebase AI Logic document processing failed: ${error.message}`);
    }
  }

  // Generate structured output (JSON) - New capability
  async generateStructuredOutput(prompt: string, responseSchema: any): Promise<any> {
    try {
      const model = this.ai.generativeModel({
        modelName: 'gemini-2.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema
        }
      });

      const result = await model.generateContent(prompt);
      const response = result.response;
      const jsonText = response.text();

      return JSON.parse(jsonText);
    } catch (error) {
      console.error('FirebaseAIService: Structured output error:', error);
      throw new Error(`Structured output generation failed: ${error.message}`);
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

      const result = await this.geminiModel.generateContent([prompt, imagePart]);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('FirebaseAIService: Image analysis error:', error);
      throw new Error(`Image analysis failed: ${error.message}`);
    }
  }

  // Streaming support for real-time responses
  async generateContentStream(prompt: string, onChunk: (chunk: string) => void): Promise<void> {
    try {
      const result = this.geminiModel.generateContentStream(prompt);
      
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          onChunk(chunkText);
        }
      }
    } catch (error) {
      console.error('FirebaseAIService: Streaming error:', error);
      throw new Error(`Streaming generation failed: ${error.message}`);
    }
  }

  // Enhanced error handling with Firebase integration
  async checkAPIHealth(): Promise<boolean> {
    try {
      const result = await this.geminiModel.generateContent('Test connection');
      return result.response.text() !== null;
    } catch (error) {
      console.error('FirebaseAIService: Health check failed:', error);
      return false;
    }
  }

  // Private helper methods
  private buildTonePrompt(tone: string, text: string): string {
    const tonePrompts = {
      professional: `Transform the following raw text into well-structured, professional study notes...`,
      casual: `Transform the following raw text into friendly, easy-to-read study notes...`,
      simplified: `Transform the following raw text into simple, concise study notes...`
    };

    return `${tonePrompts[tone] || tonePrompts.professional}\n\nRaw text to transform:\n\n${text}`;
  }

  private async convertImageToBase64(imageUri: string): Promise<string> {
    // Implementation depends on your current image handling
    // This would integrate with your existing RNFS setup
    const RNFS = require('react-native-fs');
    return await RNFS.readFile(imageUri, 'base64');
  }

  private cleanupAIResponse(response: string): string {
    return response.replace(/```html\s*/g, '').replace(/```\s*/g, '').trim();
  }

  private countWords(text: string): number {
    const cleanText = text.replace(/<[^>]*>/g, '');
    return cleanText.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  private async generateNoteTitle(content: string): Promise<string> {
    try {
      const prompt = `Generate a concise, descriptive title (max 60 characters) for the following study notes. Return only the title, no quotes or extra text.\n\nContent: ${content.substring(0, 1000)}`;
      
      const result = await this.geminiModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 20,
        }
      });
      
      const response = await result.response;
      return response.text()?.trim() || this.generateFallbackTitle(content);
    } catch (error) {
      return this.generateFallbackTitle(content);
    }
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
}

export default FirebaseAIService;
```

### Step 4: Update Service Integration

Modify `src/services/AIService.ts` to use Firebase AI Logic:

```typescript
// Import Firebase AI Service instead of Google Generative AI
import FirebaseAIService from './FirebaseAIService';

class AIService {
  private static instance: AIService;
  private firebaseAI: FirebaseAIService;

  constructor() {
    this.firebaseAI = FirebaseAIService.getInstance();
  }

  // Update all existing methods to use Firebase AI Logic
  async transformTextToNote(request: AITransformationRequest): Promise<AITransformationResponse> {
    return await this.firebaseAI.transformTextToNote(request);
  }

  async processDocumentWithGemini(request: DocumentProcessingRequest): Promise<DocumentProcessingResponse> {
    return await this.firebaseAI.processDocumentWithFirebaseAI(request);
  }

  // Add new capabilities available through Firebase AI Logic
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

    const prompt = `Generate 5-10 flashcards from the following notes content:\n\n${noteContent}`;
    return await this.firebaseAI.generateStructuredOutput(prompt, schema);
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

    const prompt = `Generate a 5-question multiple choice quiz from the following notes:\n\n${noteContent}`;
    return await this.firebaseAI.generateStructuredOutput(prompt, schema);
  }
}
```

### Step 5: Enhanced GeminiVisionService with Firebase AI Logic

Update `src/services/GeminiVisionService.ts`:

```typescript
import FirebaseAIService from './FirebaseAIService';

export class GeminiVisionService {
  private firebaseAI: FirebaseAIService;

  constructor() {
    this.firebaseAI = FirebaseAIService.getInstance();
  }

  async extractTextFromImage(imageUri: string, options: GeminiVisionOptions = {}): Promise<GeminiVisionResult> {
    const prompt = this.buildExtractionPrompt(options);
    const extractedText = await this.firebaseAI.analyzeImage(imageUri, prompt);
    
    return this.parseGeminiResponse(extractedText, options);
  }

  async processMultipleImages(imageUris: string[], options: any): Promise<any> {
    // Enhanced multi-image processing with Firebase AI Logic
    const results = await Promise.all(
      imageUris.map(uri => this.extractTextFromImage(uri, options))
    );

    return this.combineResults(results, options);
  }
}
```

---

## 🔐 Security Enhancements

### Firebase App Check Integration

Add to `src/config/firebase.ts`:

```typescript
import appCheck from '@react-native-firebase/app-check';

// Initialize App Check for production
if (!__DEV__) {
  appCheck().activate('site-key', true); // Replace with your actual site key
}
```

### Environment Configuration

Update your environment configuration to remove the Gemini API key (no longer needed):

```typescript
// src/config/environment.ts
export const ENV = {
  // Remove GEMINI_API_KEY - not needed with Firebase AI Logic
  FIREBASE_PROJECT_ID: 'your-project-id',
  FIREBASE_APP_ID: 'your-app-id',
  // Other Firebase config...
};
```

---

## 📊 Benefits of Migration

### 1. **Enhanced Security**
- ✅ **No API Keys in Code**: Authentication through Firebase
- ✅ **App Check Protection**: Protects against unauthorized API usage
- ✅ **Firebase Security Rules**: Integrated access control
- ✅ **Automatic Token Management**: Firebase handles authentication tokens

### 2. **Better Integration**
- ✅ **Unified Dashboard**: All Firebase services in one console
- ✅ **Integrated Analytics**: Track AI usage with Firebase Analytics
- ✅ **Performance Monitoring**: Monitor AI response times
- ✅ **Unified Billing**: Single Firebase bill for all services

### 3. **Enhanced Capabilities**
- ✅ **Structured Output**: Native JSON schema support
- ✅ **Streaming Responses**: Real-time content generation
- ✅ **Function Calling**: Connect AI to external systems
- ✅ **Grounding with Search**: Enhanced AI responses with web data

### 4. **Cost Optimization**
- ✅ **Vertex AI Pricing**: Often more cost-effective for production
- ✅ **Firebase Optimization**: Built-in caching and optimization
- ✅ **Usage Analytics**: Better tracking of AI costs
- ✅ **Quota Management**: Integrated quota and rate limiting

---

## 🧪 Testing Strategy

### Phase 1: Parallel Implementation
```typescript
// Create toggle for testing both implementations
const USE_FIREBASE_AI = __DEV__ ? false : true; // Enable for production

if (USE_FIREBASE_AI) {
  return await firebaseAI.transformTextToNote(request);
} else {
  return await geminiAI.transformTextToNote(request);
}
```

### Phase 2: A/B Testing
- Test with subset of users
- Compare response quality and performance
- Monitor error rates and user satisfaction

### Phase 3: Full Migration
- Switch all users to Firebase AI Logic
- Remove old Google Gemini API implementation
- Update documentation and guides

---

## 📈 Migration Timeline

### Week 1: Setup & Core Migration
- [ ] Install Firebase AI Logic SDK
- [ ] Configure Firebase Console settings
- [ ] Create FirebaseAIService implementation
- [ ] Update core AI transformation methods

### Week 2: Enhanced Features
- [ ] Implement structured output capabilities
- [ ] Add streaming support for real-time responses
- [ ] Integrate with existing vision processing
- [ ] Add Firebase App Check security

### Week 3: Testing & Optimization
- [ ] Comprehensive testing of all AI features
- [ ] Performance optimization and monitoring
- [ ] Error handling and fallback strategies
- [ ] Documentation updates

### Week 4: Production Deployment
- [ ] Gradual rollout to production users
- [ ] Monitor performance and costs
- [ ] Remove old Google Gemini API dependencies
- [ ] Celebrate enhanced AI capabilities! 🎉

---

## 🎯 Expected Outcomes

### Performance Improvements
- **Better Response Times**: Firebase optimization for AI requests
- **Enhanced Reliability**: Enterprise-grade infrastructure
- **Improved Caching**: Firebase-level response optimization
- **Better Error Handling**: Integrated Firebase error management

### Cost Benefits
- **Potential Cost Savings**: Vertex AI pricing can be more efficient
- **Better Cost Tracking**: Integrated Firebase billing analytics
- **Quota Management**: Built-in rate limiting and quota controls
- **No API Key Management**: Reduced operational overhead

### Developer Experience
- **Unified Ecosystem**: All services in Firebase console
- **Better Debugging**: Integrated logging and monitoring
- **Enhanced Testing**: Firebase testing environment
- **Future-Proof**: Access to latest Firebase AI features

---

## 🚀 Ready to Transform NoteSpark AI with Firebase AI Logic!

This migration will position NoteSpark AI as a cutting-edge application leveraging the full power of Firebase's AI ecosystem while maintaining all existing functionality and adding powerful new capabilities like structured output generation and enhanced security.

The migration maintains backward compatibility while opening doors to advanced features like automated flashcard generation, quiz creation, and enhanced document processing - all secured by Firebase's enterprise-grade infrastructure.
