// FR-31: revised LLM port. Providers describe themselves, report the options they used and
// ignored, and the Gemini request stays exactly what it was before the port revision.

const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn();

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

import { GeminiProvider, toGeminiResponseSchema } from '../../../src/llm-critic/gemini-provider.js';
import { JUDGE_PERSONA } from '../../../src/llm-critic/frozen.js';
import { VERDICT_SCHEMA_TEXT } from '../../../src/llm-critic/verdict-schema.js';
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

describe('GeminiProvider request (BR-U4-VRD-01, VRD-08, OPS-02)', () => {
  const GEMINI_CONFIG = {
    model: 'gemini-2.0-flash',
    systemInstruction: JUDGE_PERSONA,
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 1000,
      responseMimeType: 'application/json',
      responseSchema: toGeminiResponseSchema(VERDICT_SCHEMA_TEXT),
    },
  };

  it('sends the persona as systemInstruction and the verdict schema as responseSchema', async () => {
    const result = await makeGemini().evaluate('prompt', CRITIC_OPTIONS);

    expect(result.success).toBe(true);
    expect(mockGetGenerativeModel).toHaveBeenCalledTimes(1);
    expect(mockGetGenerativeModel).toHaveBeenCalledWith(GEMINI_CONFIG);
    expect(mockGenerateContent).toHaveBeenCalledWith('prompt');
  });

  it('a call context overrides persona and schema', async () => {
    const schema = JSON.stringify({ type: 'object', additionalProperties: false, properties: { a: { type: 'string', maxLength: 3 } }, required: ['a'] });
    await makeGemini().evaluate('prompt', CRITIC_OPTIONS, { runIndex: 0, repetition: 0, functionId: 'f', systemPrompt: 'P', responseSchema: schema });
    expect(mockGetGenerativeModel).toHaveBeenCalledWith({
      ...GEMINI_CONFIG,
      systemInstruction: 'P',
      generationConfig: { ...GEMINI_CONFIG.generationConfig, responseSchema: { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] } },
    });
  });

  it('the Gemini schema keeps the supported subset of the verdict schema', () => {
    const schema = toGeminiResponseSchema(VERDICT_SCHEMA_TEXT) as unknown as Record<string, unknown>;
    expect(JSON.stringify(schema)).not.toMatch(/additionalProperties|maxLength|minimum|maximum/);
    expect(schema.required).toEqual(['pass', 'confidence', 'reasoning', 'evidence', 'violations']);
  });

  it('uses the configured model, never options.model, and does not send seed or effort', async () => {
    await makeGemini().evaluate('prompt', { ...CRITIC_OPTIONS, model: 'other-model', effort: 'high' });

    expect(mockGetGenerativeModel).toHaveBeenCalledWith(GEMINI_CONFIG);
  });

  it('OPS-02: effort and seed are reported ignored; model is used when it is the configured one', async () => {
    const result = await makeGemini().evaluate('prompt', { ...CRITIC_OPTIONS, effort: 'high' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.usedOptions).toEqual({ model: 'gemini-2.0-flash', temperature: 0, maxTokens: 1000 });
      expect(result.data.ignoredOptions).toEqual(['effort', 'seed']);
      expect(result.data.model).toBe('gemini-2.0-flash');
    }
  });

  it('a different options.model is reported ignored', async () => {
    const result = await makeGemini().evaluate('prompt', { model: 'other-model', maxTokens: 1000 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ignoredOptions).toEqual(['model']);
      expect(result.data.usedOptions).toEqual({ temperature: 0, maxTokens: 1000 });
    }
  });

  it('refuses an empty model id (no default Gemini id, VRD-09)', () => {
    expect(() => new GeminiProvider({ apiKey: 'k', model: '', temperature: 0, maxTokens: 1 })).toThrow(/--llm-model/);
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

describe('MockLLMProvider prompts and options (T1, T3 provider level; Step 20)', () => {
  it('getPrompts() returns every prompt in order; getLastOptions()/getLastCall() the last ones', async () => {
    const provider = new MockLLMProvider();
    const judge: LLMOptions = { model: 'claude-opus-5-5', effort: 'high', maxTokens: 8192 };
    await provider.evaluate('first prompt', judge, { runIndex: 0, repetition: 0, functionId: 'FF-N01' });
    await provider.evaluate('second prompt', judge, { runIndex: 1, repetition: 0, functionId: 'FF-N01', unitId: 'src/a.ts' });
    expect(provider.getPrompts()).toEqual(['first prompt', 'second prompt']);
    expect(provider.getLastOptions()).toEqual({ model: 'claude-opus-5-5', effort: 'high', maxTokens: 8192 });
    expect(provider.getLastCall()).toEqual({ runIndex: 1, repetition: 0, functionId: 'FF-N01', unitId: 'src/a.ts' });
    expect(provider.getCallCount()).toBe(2);
  });
});

describe('NullLLMProvider third parameter', () => {
  it('accepts the call context and still reports LLM_NOT_CONFIGURED', async () => {
    const result = await new NullLLMProvider().evaluate('p', CRITIC_OPTIONS, { runIndex: 0, repetition: 0, functionId: 'f' });
    expect(result.success ? null : result.errors[0]?.code).toBe('LLM_NOT_CONFIGURED');
  });
});
