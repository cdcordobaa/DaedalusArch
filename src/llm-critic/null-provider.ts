import type { LLMProvider, LLMOptions, LLMResponse } from '../shared/interfaces/llm-provider.js';
import { DomainResult } from '../shared/errors/domain-result.js';

/**
 * Null LLM provider for graceful degradation when no API key is configured.
 * Signals symbolic-only mode without error.
 */
export class NullLLMProvider implements LLMProvider {
  readonly name = 'null';

  isAvailable(): boolean {
    return false;
  }

  async evaluate(_prompt: string, _options: LLMOptions): Promise<DomainResult<LLMResponse>> {
    return DomainResult.fail<LLMResponse>([{
      code: 'LLM_NOT_CONFIGURED',
      message: 'No LLM provider configured. Running in symbolic-only mode.',
    }]);
  }
}
