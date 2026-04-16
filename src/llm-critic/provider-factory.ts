import type { LLMProvider } from '../shared/interfaces/llm-provider.js';
import type { LLMProviderConfig, GeminiConfig } from '../shared/types/llm-config.js';
import { MockLLMProvider } from './mock-provider.js';
import { GeminiProvider } from './gemini-provider.js';
import { NullLLMProvider } from './null-provider.js';

const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';

/**
 * Factory for creating LLM providers.
 * Configuration priority: GEMINI_MODEL env > config.model > default.
 */
export function createLLMProvider(config?: LLMProviderConfig): LLMProvider {
  if (!config) {
    return new NullLLMProvider();
  }

  switch (config.provider) {
    case 'gemini': {
      const apiKey = config.gemini?.apiKey ?? process.env['GEMINI_API_KEY'];
      if (!apiKey) {
        return new NullLLMProvider();
      }

      const geminiConfig: GeminiConfig = {
        apiKey,
        model: process.env['GEMINI_MODEL'] ?? config.gemini?.model ?? DEFAULT_GEMINI_MODEL,
        temperature: config.gemini?.temperature ?? 0,
        maxTokens: config.gemini?.maxTokens ?? 4096,
      };

      return new GeminiProvider(geminiConfig);
    }

    case 'mock':
      return new MockLLMProvider();

    default:
      return new NullLLMProvider();
  }
}
