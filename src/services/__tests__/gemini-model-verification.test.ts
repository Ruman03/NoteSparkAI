// Quick verification test for Gemini 2.5 Flash migration
// This test ensures we're using the correct model name

import { AIService } from '../AIService';

// Mock the Google Generative AI package
const mockGetGenerativeModel = jest.fn();
const mockGoogleGenerativeAI = jest.fn(() => ({
  getGenerativeModel: mockGetGenerativeModel
}));

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: mockGoogleGenerativeAI
}));

jest.mock('react-native-config', () => ({
  default: {
    GEMINI_API_KEY: 'test-key'
  }
}));

describe('Gemini 2.5 Flash Model Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton
    (AIService as any).instance = null;
  });

  it('should use gemini-2.5-flash model name', () => {
    AIService.getInstance();
    
    expect(mockGetGenerativeModel).toHaveBeenCalledWith({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 3000,
      }
    });
  });

  it('should not use the old gemini-2.0-flash-exp model', () => {
    AIService.getInstance();
    
    expect(mockGetGenerativeModel).not.toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-2.0-flash-exp"
      })
    );
    
    expect(mockGetGenerativeModel).not.toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-2.0-flash"
      })
    );
  });
});
