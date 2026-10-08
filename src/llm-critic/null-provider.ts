import type { LLMCallContext, LLMProvider, LLMOptions, LLMResponse } from '../shared/interfaces/llm-provider.js';
import type { ProviderDescription } from '../shared/types/evaluation.js';
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

  describe(): ProviderDescription {
    return { provider: 'null', model: 'none' };
  }

  evaluate(_prompt: string, _options: LLMOptions, _call?: LLMCallContext): Promise<DomainResult<LLMResponse>> {
    return Promise.resolve(DomainResult.fail<LLMResponse>([{
      code: 'LLM_NOT_CONFIGURED',
      message: 'No LLM provider configured. Running in symbolic-only mode.',
    }]));
  }
}
