import type { LLMEffort } from '../interfaces/llm-provider.js';

export interface GeminiConfig {
  readonly apiKey: string;
  readonly model: string;
  readonly temperature: number;
  readonly maxTokens: number;
}

// FR-23: 'claude-cli' and the cassette settings are contract only in U0 ('claude-cli' still builds
// NullLLMProvider; nothing reads `cassette` until U4).
export interface LLMProviderConfig {
  readonly provider: 'mock' | 'gemini' | 'claude-cli';
  readonly gemini?: GeminiConfig;
  readonly claudeCli?: ClaudeCliConfig;
  readonly cassette: { readonly mode: VCRMode; readonly dir: string };
}

// C10 cassette mode (FR-23). C7 (src/llm-critic/types.ts) re-exports this type since U4-K2 (D-U0-3).
export type VCRMode = 'record' | 'replay';

// Claude CLI judge settings (FR-23, D-1); no credential field by construction. Not used in U0.
export interface ClaudeCliConfig {
  readonly binary: string;
  readonly model: string;
  readonly effort?: LLMEffort;
  readonly timeoutMs: number;
  readonly neutralCwd: string;
}
