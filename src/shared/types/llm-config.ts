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
