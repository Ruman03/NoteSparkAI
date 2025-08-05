// NoteSpark AI - AI Transformation Service
// Clean, modern implementation with proper TypeScript support

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
  private readonly baseUrl = 'https://api.openai.com/v1/chat/completions';

  constructor() {
    // Use react-native-config for environment variables
    this.apiKey = Config.OPENAI_API_KEY || '';
    
    console.log('=== AIService Debug ===');
    console.log('Config.OPENAI_API_KEY:', this.apiKey ? 'SET' : 'NOT SET');
    console.log('Available config keys:', Object.keys(Config));
    console.log('=======================');
    
    if (!this.apiKey) {
      console.warn('WARNING: No OpenAI API key found. AI features will not work. Please set OPENAI_API_KEY in your .env file');
    }
  }

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  async transformTextToNote(request: AITransformationRequest): Promise<AITransformationResponse> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is not configured. Please check your environment setup.');
    }

    try {
      const prompt = TONE_PROMPTS[request.tone] || TONE_PROMPTS.professional;
      
      // Try GPT-4o-mini first for cost efficiency
      let requestBody = {
        model: 'gpt-4o-mini', // Primary model: GPT-4o-mini
        messages: [
          {
            role: 'system',
            content: prompt
          },
          {
            role: 'user',
            content: `Raw text to transform:\n\n${request.text}`
          }
        ],
        max_tokens: 3000, // GPT-4o-mini supports higher token limits
        temperature: 0.7,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000); // Increased timeout

      let response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // If GPT-4o-mini fails, try GPT-4o as fallback
      if (!response.ok && response.status === 404) {
        console.log('GPT-4o-mini not available, trying GPT-4o...');
        requestBody.model = 'gpt-4o';
        
        const fallbackController = new AbortController();
        const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 45000);
        
        response = await fetch(this.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(requestBody),
          signal: fallbackController.signal,
        });
        
        clearTimeout(fallbackTimeoutId);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      let transformedText = data.choices?.[0]?.message?.content || '';

      if (!transformedText) {
        throw new Error('No content received from OpenAI API');
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
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timed out. Please try again.');
        }
        throw error;
      }
      throw new Error('Failed to transform text');
    }
  }

  async generateNoteTitle(content: string): Promise<string> {
    try {
      const requestBody = {
        model: 'gpt-4o-mini', // Use GPT-4o-mini for title generation
        messages: [
          {
            role: 'system',
            content: 'Generate a concise, descriptive title (max 60 characters) for the following study notes. Return only the title, no quotes or extra text.'
          },
          {
            role: 'user',
            content: content.substring(0, 1000) // First 1000 chars for title generation
          }
        ],
        max_tokens: 20,
        temperature: 0.3,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const title = data.choices?.[0]?.message?.content?.trim() || '';
        return title || this.generateFallbackTitle(content);
      }
      
      return this.generateFallbackTitle(content);
    } catch (error) {
      console.warn('Failed to generate AI title, using fallback:', error);
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
      if (!this.apiKey || this.apiKey === 'your_openai_api_key_here') {
        return false;
      }
      
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export { AIService, type AITransformationRequest, type AITransformationResponse };
