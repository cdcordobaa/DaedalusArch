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

// Per-call metadata (C10 row 15, U4 DE §3.6; OI-U4-3). The cassette decorator keys on
// runIndex and repetition; Null and Mock ignore it.
export interface LLMCallContext {
  readonly runIndex: number;            // 0..runsPerEvaluation-1 (judge) or 0/1 (labeller)
  readonly repetition: number;          // --judge-repetition, default 0
  readonly functionId: string;          // metadata only (labeller: `label:<kind>:<itemId>`)
  readonly unitId?: string;             // metadata only
  readonly systemPrompt?: string;       // persona; providers without a system channel prepend it
  readonly responseSchema?: string;     // verdict schema; CLI → --json-schema, Gemini → responseSchema
}

// The third parameter is optional (C10 row 15): two-parameter implementations still satisfy the port.
export interface LLMProvider {
  readonly name: string;
  evaluate(prompt: string, options: LLMOptions, call?: LLMCallContext): Promise<DomainResult<LLMResponse>>;
  describe(): ProviderDescription;       // FR-23: provider, model and effort for every report
}
