import type { DomainResult } from '../errors/domain-result.js';

export interface LLMOptions {
  readonly temperature: 0;
  readonly seed?: number;
  readonly maxTokens?: number;
}

export interface LLMResponse {
  readonly content: string;
  readonly model: string;
  readonly usage: { readonly inputTokens: number; readonly outputTokens: number };
}

export interface LLMProvider {
  readonly name: string;
  evaluate(prompt: string, options: LLMOptions): Promise<DomainResult<LLMResponse>>;
}
