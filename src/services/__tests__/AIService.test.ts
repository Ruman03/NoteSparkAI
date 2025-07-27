import { AIService } from '../AIService';
import Config from 'react-native-config';

// Mock react-native-config
jest.mock('react-native-config', () => ({
  OPENAI_API_KEY: 'test-api-key',
}));

// Mock fetch
global.fetch = jest.fn();

describe('AIService', () => {
  let aiService: AIService;

  // Mock response structure for OpenAI API
  const mockSuccessResponse = {
    id: 'test-id',
    object: 'chat.completion',
    created: 1234567890,
    model: 'gpt-4',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: 'This is a transformed note in professional tone.',
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 50,
      completion_tokens: 100,
      total_tokens: 150,
    },
  };

  beforeEach(() => {
    aiService = AIService.getInstance();
    jest.clearAllMocks();
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
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      const result = await aiService.transformTextToNote({
        text: 'Sample document text',
        tone: 'professional',
      });

      expect(result).toEqual({
        transformedText: 'This is a transformed note in professional tone.',
        title: expect.any(String),
        wordCount: 8,
      });

      expect(fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key',
          },
          body: expect.stringContaining('"model":"gpt-4"'),
        })
      );
    });

    it('should transform text with casual tone successfully', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          ...mockSuccessResponse,
          choices: [
            {
              ...mockSuccessResponse.choices[0],
              message: {
                role: 'assistant',
                content: 'Hey! This is a casual note style.',
              },
            },
          ],
        }),
      });

      const result = await aiService.transformTextToNote({
        text: 'Sample document text',
        tone: 'casual',
      });

      expect(result.transformedText).toBe('Hey! This is a casual note style.');
      expect(result.wordCount).toBe(7);
    });

    it('should transform text with simplified tone successfully', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          ...mockSuccessResponse,
          choices: [
            {
              ...mockSuccessResponse.choices[0],
              message: {
                role: 'assistant',
                content: 'Simple notes here.',
              },
            },
          ],
        }),
      });

      const result = await aiService.transformTextToNote({
        text: 'Complex document with many details',
        tone: 'simplified',
      });

      expect(result.transformedText).toBe('Simple notes here.');
      expect(result.wordCount).toBe(3);
    });

    it('should handle API errors gracefully', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(
        aiService.transformTextToNote({
          text: 'Sample text',
          tone: 'professional',
        })
      ).rejects.toThrow('AI service error: 401 - Unauthorized');
    });

    it('should handle network errors', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        aiService.transformTextToNote({
          text: 'Sample text',
          tone: 'professional',
        })
      ).rejects.toThrow('Network error');
    });

    it('should fallback to GPT-3.5 on GPT-4 failure', async () => {
      // First call (GPT-4) fails
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Rate limit exceeded',
        })
        // Second call (GPT-3.5) succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            ...mockSuccessResponse,
            model: 'gpt-3.5-turbo',
            choices: [
              {
                ...mockSuccessResponse.choices[0],
                message: {
                  role: 'assistant',
                  content: 'Fallback response from GPT-3.5',
                },
              },
            ],
          }),
        });

      const result = await aiService.transformTextToNote({
        text: 'Sample text',
        tone: 'professional',
      });

      expect(result.transformedText).toBe('Fallback response from GPT-3.5');
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('generateNoteTitle', () => {
    const mockTitleResponse = {
      id: 'test-id',
      object: 'chat.completion',
      created: 1234567890,
      model: 'gpt-3.5-turbo',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'Meeting Notes - Project Discussion',
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 30,
        completion_tokens: 10,
        total_tokens: 40,
      },
    };

    it('should generate a title successfully', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTitleResponse),
      });

      const title = await aiService.generateNoteTitle(
        'This is a note about our project meeting where we discussed various topics and made important decisions.'
      );

      expect(title).toBe('Meeting Notes - Project Discussion');
      expect(fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key',
          },
          body: expect.stringContaining('"model":"gpt-3.5-turbo"'),
        })
      );
    });

    it('should handle empty content gracefully', async () => {
      const title = await aiService.generateNoteTitle('');
      expect(title).toBe('Untitled Note');
    });

    it('should handle API errors with fallback title', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const title = await aiService.generateNoteTitle('Some content');
      expect(title).toBe('Untitled Note');
    });

    it('should truncate very long titles', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          ...mockTitleResponse,
          choices: [
            {
              ...mockTitleResponse.choices[0],
              message: {
                role: 'assistant',
                content: 'This is a very long title that exceeds the reasonable length limit for a note title and should be truncated',
              },
            },
          ],
        }),
      });

      const title = await aiService.generateNoteTitle('Some content');
      expect(title.length).toBeLessThanOrEqual(60);
      expect(title).toMatch(/\.\.\.$/); // Should end with ellipsis
    });
  });

  describe('error handling and timeouts', () => {
    it('should timeout after 30 seconds', async () => {
      (fetch as jest.Mock).mockImplementationOnce(
        () => new Promise(resolve => setTimeout(resolve, 31000))
      );

      await expect(
        aiService.transformTextToNote({
          text: 'Sample text',
          tone: 'professional',
        })
      ).rejects.toThrow('Request timeout');
    }, 35000);

    it('should handle malformed API responses', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          // Missing required fields
          choices: [],
        }),
      });

      await expect(
        aiService.transformTextToNote({
          text: 'Sample text',
          tone: 'professional',
        })
      ).rejects.toThrow();
    });
  });

  describe('word count calculation', () => {
    it('should calculate word count correctly', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          ...mockSuccessResponse,
          choices: [
            {
              ...mockSuccessResponse.choices[0],
              message: {
                role: 'assistant',
                content: 'One two three four five words',
              },
            },
          ],
        }),
      });

      const result = await aiService.transformTextToNote({
        text: 'Input text with four words',
        tone: 'professional',
      });

      expect(result.wordCount).toBe(6); // "One two three four five words"
    });

    it('should handle empty text word count', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          ...mockSuccessResponse,
          choices: [
            {
              ...mockSuccessResponse.choices[0],
              message: {
                role: 'assistant',
                content: '',
              },
            },
          ],
        }),
      });

      const result = await aiService.transformTextToNote({
        text: '',
        tone: 'professional',
      });

      expect(result.wordCount).toBe(0);
    });
  });
});
