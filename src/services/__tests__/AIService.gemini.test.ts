// NoteSpark AI - AIService Tests (Gemini Implementation)
// Updated tests for Gemini 2.5 Flash migration

// Mock Google Generative AI first
const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn(() => ({
  generateContent: mockGenerateContent
}));

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel
  }))
}));

// Mock react-native-config
jest.mock('react-native-config', () => ({
  default: {
    GEMINI_API_KEY: 'test-gemini-api-key',
  }
}));

import { AIService } from '../AIService';

describe('AIService (Gemini Implementation)', () => {
  let aiService: AIService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateContent.mockClear();
    mockGetGenerativeModel.mockClear();
    
    // Reset the singleton instance
    (AIService as any).instance = null;
    aiService = AIService.getInstance();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getInstance', () => {
    it('should return a singleton instance', () => {
      const instance1 = AIService.getInstance();
      const instance2 = AIService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('transformTextToNote', () => {
    it('should transform text with professional tone successfully', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            content: "Professional note content",
            tone: "professional",
            wordCount: 20
          })
        }
      });

      const result = await aiService.transformTextToNote({
        text: 'Sample document text',
        tone: 'professional',
      });

      expect(result).toEqual({
        content: 'Professional note content',
        tone: 'professional',
        wordCount: 20,
      });
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('should transform text with casual tone successfully', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            content: "Casual note content",
            tone: "casual", 
            wordCount: 15
          })
        }
      });

      const result = await aiService.transformTextToNote({
        text: 'Sample document text',
        tone: 'casual',
      });

      expect(result).toEqual({
        content: 'Casual note content',
        tone: 'casual',
        wordCount: 15,
      });
    });

    it('should transform text with simplified tone successfully', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            content: "Simple note content",
            tone: "simplified",
            wordCount: 10
          })
        }
      });

      const result = await aiService.transformTextToNote({
        text: 'Sample document text',
        tone: 'simplified',
      });

      expect(result).toEqual({
        content: 'Simple note content',
        tone: 'simplified',
        wordCount: 10,
      });
    });

    it('should handle API errors gracefully', async () => {
      mockGenerateContent.mockRejectedValueOnce(new Error('API Error'));

      await expect(aiService.transformTextToNote({
        text: 'Sample document text',
        tone: 'professional',
      })).rejects.toThrow('Gemini API error: API Error');
    });

    it('should count words correctly', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => 'One two three four five words'
        }
      });

      const result = await aiService.transformTextToNote({
        text: 'Sample document text',
        tone: 'professional',
      });

      expect(result.wordCount).toBe(6);
    });

    it('should handle empty text word count', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => ''
        }
      });

      const result = await aiService.transformTextToNote({
        text: 'Sample document text',
        tone: 'professional',
      });

      expect(result.wordCount).toBe(0);
    });
  });

  describe('generateNoteTitle', () => {
    it('should generate a title successfully', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => 'Meeting Notes - Project Discussion'
        }
      });

      const result = await aiService.generateNoteTitle('This is a sample note about our project meeting');

      expect(result).toBe('Meeting Notes - Project Discussion');
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors with fallback title', async () => {
      mockGenerateContent.mockRejectedValueOnce(new Error('API Error'));

      const result = await aiService.generateNoteTitle('This is a sample note about our project meeting');

      expect(result).toMatch(/^Note - \d{1,2}\/\d{1,2}\/\d{4}$/);
    });
  });

  describe('checkAPIHealth', () => {
    it('should return true for healthy API', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => 'Test response'
        }
      });

      const result = await aiService.checkAPIHealth();

      expect(result).toBe(true);
    });

    it('should return false for unhealthy API', async () => {
      mockGenerateContent.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await aiService.checkAPIHealth();

      expect(result).toBe(false);
    });
  });
});
