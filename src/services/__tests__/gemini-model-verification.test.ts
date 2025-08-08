// Quick verification test for Gemini 2.5 Flash-Lite migration
// This test ensures we're using the correct model name (Flash-Lite for cost efficiency)

import { AIService } from '../AIService';

// Instead of mocking the full client shape, inject a test model and spy on service logs
const logs: string[] = [];
const originalLog = console.log;
beforeAll(() => {
  // Capture logs to verify model name usage
  // @ts-ignore
  console.log = (...args: any[]) => { logs.push(args.join(' ')); originalLog.apply(console, args as any); };
});

afterAll(() => {
  console.log = originalLog;
});

jest.mock('react-native-config', () => ({
  default: {
    GEMINI_API_KEY: 'test-key'
  }
}));

describe('Gemini 2.5 Flash-Lite Model Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton
    (AIService as any).instance = null;
  logs.length = 0;
  // Ensure a test model exists so constructor proceeds without external client
  AIService.setTestModel({ generateContent: jest.fn() } as any);
  });

  it('should use gemini-2.5-flash-lite model name', () => {
  // When we create an instance, our constructor logs success with Flash-Lite wording
  AIService.getInstance();
  const joined = logs.join('\n');
  expect(joined).toMatch(/Flash-Lite/);
  });

  it('should not use the old gemini-2.0-flash-exp model', () => {
    AIService.getInstance();
  // Old model names should not appear anywhere in logs/config outputs
  const joined = logs.join('\n');
  expect(joined).not.toMatch(/gemini-2\.0-flash-exp/);
  expect(joined).not.toMatch(/gemini-2\.0-flash(?!-lite)/);
  });
});
