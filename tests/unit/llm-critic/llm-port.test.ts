// FR-31: revised LLM port. Providers describe themselves, report the options they used and
// ignored, and the Gemini request stays exactly what it was before the port revision.

const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn();

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

import { GeminiProvider } from '../../../src/llm-critic/gemini-provider.js';
import { MockLLMProvider } from '../../../src/llm-critic/mock-provider.js';
import { NullLLMProvider } from '../../../src/llm-critic/null-provider.js';
import type { LLMOptions } from '../../../src/shared/interfaces/llm-provider.js';

// The options the critic sends (llm-critic.ts), with the model taken from describe().
const CRITIC_OPTIONS: LLMOptions = { model: 'gemini-2.0-flash', temperature: 0, seed: 42, maxTokens: 1000 };

function makeGemini(): GeminiProvider {
  return new GeminiProvider({ apiKey: 'test-key', model: 'gemini-2.0-flash', temperature: 0, maxTokens: 4096 });
}

beforeEach(() => {
  mockGenerateContent.mockReset();
  mockGetGenerativeModel.mockReset();
  mockGenerateContent.mockResolvedValue({
    response: {
      text: () => '{"pass":true}',
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
    },
  });
  mockGetGenerativeModel.mockReturnValue({ generateContent: mockGenerateContent });
});

describe('describe()', () => {
  it('Gemini names its configured model', () => {
    expect(makeGemini().describe()).toEqual({ provider: 'gemini', model: 'gemini-2.0-flash' });
  });

  it('Mock names the mock model', () => {
    expect(new MockLLMProvider().describe()).toEqual({ provider: 'mock', model: 'mock-model' });
  });

  it('Null names no model', () => {
    expect(new NullLLMProvider().describe()).toEqual({ provider: 'null', model: 'none' });
  });
});

describe('GeminiProvider request', () => {
  it('sends exactly the generation config sent before the port revision', async () => {
    const result = await makeGemini().evaluate('prompt', CRITIC_OPTIONS);

    expect(result.success).toBe(true);
    expect(mockGetGenerativeModel).toHaveBeenCalledTimes(1);
    expect(mockGetGenerativeModel).toHaveBeenCalledWith({
      model: 'gemini-2.0-flash',
      generationConfig: { temperature: 0, maxOutputTokens: 1000 },
    });
    expect(mockGenerateContent).toHaveBeenCalledWith('prompt');
  });

  it('uses the configured model, never options.model, and does not send seed or effort', async () => {
    await makeGemini().evaluate('prompt', { ...CRITIC_OPTIONS, model: 'other-model', effort: 'high' });

    expect(mockGetGenerativeModel).toHaveBeenCalledWith({
      model: 'gemini-2.0-flash',
      generationConfig: { temperature: 0, maxOutputTokens: 1000 },
    });
  });

  it('reports used and ignored options', async () => {
    const result = await makeGemini().evaluate('prompt', { ...CRITIC_OPTIONS, effort: 'low' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.usedOptions).toEqual({ temperature: 0, maxTokens: 1000 });
      expect(result.data.ignoredOptions).toEqual(['model', 'effort', 'seed']);
      expect(result.data.model).toBe('gemini-2.0-flash');
    }
  });

  it('lists only the unsent options that were present', async () => {
    const result = await makeGemini().evaluate('prompt', { model: 'gemini-2.0-flash', maxTokens: 1000 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ignoredOptions).toEqual(['model']);
      expect(result.data.usedOptions).toEqual({ temperature: 0, maxTokens: 1000 });
    }
  });
});

describe('MockLLMProvider', () => {
  it('records the last options and reports every option as ignored', async () => {
    const provider = new MockLLMProvider();
    expect(provider.getLastOptions()).toBeUndefined();

    const result = await provider.evaluate('prompt', CRITIC_OPTIONS);

    expect(provider.getLastOptions()).toEqual(CRITIC_OPTIONS);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.usedOptions).toEqual({});
      expect([...result.data.ignoredOptions].sort()).toEqual(['maxTokens', 'model', 'seed', 'temperature']);
    }
  });
});
