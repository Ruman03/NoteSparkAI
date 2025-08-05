// NoteSpark AI - Gemini AI Transformation Service
// Cost-effective migration from OpenAI to Google Gemini 2.5 Flash
// Maintains exact same interface and output format

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

class GeminiAIService {
  private static instance: GeminiAIService;
  private readonly apiKey: string;
  private readonly genAI: GoogleGenerativeAI | null = null;
  private readonly model: any = null;

  constructor() {
    // Use react-native-config for environment variables
    this.apiKey = Config.GEMINI_API_KEY || '';
    
    console.log('=== GeminiAIService Debug ===');
    console.log('Config.GEMINI_API_KEY:', this.apiKey ? 'SET' : 'NOT SET');
    console.log('Available config keys:', Object.keys(Config));
    console.log('=============================');
    
    if (!this.apiKey) {
      console.warn('WARNING: No Gemini API key found. AI features will not work. Please set GEMINI_API_KEY in your .env file');
    } else {
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
    }
  }

  static getInstance(): GeminiAIService {
    if (!GeminiAIService.instance) {
      GeminiAIService.instance = new GeminiAIService();
    }
    return GeminiAIService.instance;
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

      console.log('GeminiAIService: Sending request to Gemini 2.5 Flash...');
      const result = await this.model.generateContent(fullPrompt);
      const response = await result.response;
      let transformedText = response.text();

      if (!transformedText) {
        throw new Error('No content received from Gemini API');
      }

      console.log('GeminiAIService: Received response from Gemini');

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
      console.error('GeminiAIService: Error in transformTextToNote:', error);
      if (error instanceof Error) {
        throw new Error(`Gemini API error: ${error.message}`);
      }
      throw new Error('Failed to transform text with Gemini API');
    }
  }

  async generateNoteTitle(content: string): Promise<string> {
    try {
      if (!this.model) {
        return this.generateFallbackTitle(content);
      }

      const prompt = `Generate a concise, descriptive title (max 60 characters) for the following study notes. Return only the title, no quotes or extra text.

Content: ${content.substring(0, 1000)}`;

      console.log('GeminiAIService: Generating title with Gemini...');
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
      console.warn('GeminiAIService: Failed to generate title, using fallback:', error);
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
      console.log('GeminiAIService: Cleaned up AI response - removed markdown code blocks');
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
      console.warn('GeminiAIService: Health check failed:', error);
      return false;
    }
  }
}

export { GeminiAIService, type AITransformationRequest, type AITransformationResponse };
