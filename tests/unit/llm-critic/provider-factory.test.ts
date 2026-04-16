import { createLLMProvider } from '../../../src/llm-critic/provider-factory.js';
import { MockLLMProvider } from '../../../src/llm-critic/mock-provider.js';
import { NullLLMProvider } from '../../../src/llm-critic/null-provider.js';
import { GeminiProvider } from '../../../src/llm-critic/gemini-provider.js';

describe('createLLMProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env['GEMINI_API_KEY'];
    delete process.env['GEMINI_MODEL'];
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns NullLLMProvider when no config provided', () => {
    const provider = createLLMProvider();
    expect(provider).toBeInstanceOf(NullLLMProvider);
    expect(provider.name).toBe('null');
  });

  it('returns MockLLMProvider for mock config', () => {
    const provider = createLLMProvider({ provider: 'mock' });
    expect(provider).toBeInstanceOf(MockLLMProvider);
    expect(provider.name).toBe('mock');
  });

  it('returns GeminiProvider when API key is in config', () => {
    const provider = createLLMProvider({
      provider: 'gemini',
      gemini: { apiKey: 'test-key', model: 'gemini-2.0-flash', temperature: 0, maxTokens: 4096 },
    });
    expect(provider).toBeInstanceOf(GeminiProvider);
    expect(provider.name).toBe('gemini');
  });

  it('returns GeminiProvider when API key is in env', () => {
    process.env['GEMINI_API_KEY'] = 'env-key';
    const provider = createLLMProvider({ provider: 'gemini' });
    expect(provider).toBeInstanceOf(GeminiProvider);
  });

  it('returns NullLLMProvider when gemini config has no API key', () => {
    const provider = createLLMProvider({ provider: 'gemini' });
    expect(provider).toBeInstanceOf(NullLLMProvider);
  });

  it('prefers GEMINI_MODEL env var over config', () => {
    process.env['GEMINI_MODEL'] = 'gemini-1.5-pro';
    const provider = createLLMProvider({
      provider: 'gemini',
      gemini: { apiKey: 'test-key', model: 'gemini-2.0-flash', temperature: 0, maxTokens: 4096 },
    });
    expect(provider).toBeInstanceOf(GeminiProvider);
    expect((provider as GeminiProvider).getModelName()).toBe('gemini-1.5-pro');
  });
});

describe('NullLLMProvider', () => {
  it('returns non-critical error on evaluate', async () => {
    const provider = new NullLLMProvider();
    const result = await provider.evaluate('test', { temperature: 0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]?.code).toBe('LLM_NOT_CONFIGURED');
    }
  });

  it('reports unavailable', () => {
    const provider = new NullLLMProvider();
    expect(provider.isAvailable()).toBe(false);
  });
});
