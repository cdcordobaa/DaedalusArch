import type { DomainResult } from '../errors/domain-result.js';
import type { ProviderDescription } from '../types/evaluation.js';

// Effort levels the installed Claude CLI accepts (`--effort <level>`); FR-23, FR-31
export type LLMEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

// Revised port (FR-31): the model is named per call; providers report what they actually used.
export interface LLMOptions {
  readonly model: string;                // pinned model id
  readonly effort?: LLMEffort;
  readonly maxTokens: number;
  readonly temperature?: number;
  readonly seed?: number;
}

export interface LLMResponse {
  readonly content: string;
  readonly model: string;
  readonly usage: { readonly inputTokens: number; readonly outputTokens: number };
  readonly usedOptions: Partial<LLMOptions>;              // options actually sent to the model
  readonly ignoredOptions: readonly (keyof LLMOptions)[]; // options received but not sent
}

export interface LLMProvider {
  readonly name: string;
  evaluate(prompt: string, options: LLMOptions): Promise<DomainResult<LLMResponse>>;
  describe(): ProviderDescription;       // FR-23: provider, model and effort for every report
}
