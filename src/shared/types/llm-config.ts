import type { LLMEffort } from '../interfaces/llm-provider.js';

export interface GeminiConfig {
  readonly apiKey: string;
  readonly model: string;
  readonly temperature: number;
  readonly maxTokens: number;
}

export interface LLMProviderConfig {
  readonly provider: 'mock' | 'gemini';
  readonly gemini?: GeminiConfig;
}

// C10 cassette mode (FR-23). The C7 copy in src/llm-critic/types.ts (with 'bypass') stays until U4
// swaps it to this type (D-U0-3).
export type VCRMode = 'record' | 'replay';

// Claude CLI judge settings (FR-23, D-1); no credential field by construction. Not used in U0.
export interface ClaudeCliConfig {
  readonly binary: string;
  readonly model: string;
  readonly effort?: LLMEffort;
  readonly timeoutMs: number;
  readonly neutralCwd: string;
}
