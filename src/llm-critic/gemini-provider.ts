import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LLMProvider, LLMOptions, LLMResponse } from '../shared/interfaces/llm-provider.js';
import type { GeminiConfig } from '../shared/types/llm-config.js';
import { DomainResult } from '../shared/errors/domain-result.js';

const DEFAULT_MODEL = 'gemini-2.0-flash';

/**
 * LLM provider using Google's Gemini API via the @google/generative-ai SDK.
 * Used for neuronal evaluation (semantic fitness functions).
 */
export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';
  private readonly client: GoogleGenerativeAI;
  private readonly modelName: string;
  private readonly defaultTemperature: number;
  private readonly defaultMaxTokens: number;

  constructor(config: GeminiConfig) {
    this.client = new GoogleGenerativeAI(config.apiKey);
    this.modelName = config.model || DEFAULT_MODEL;
    this.defaultTemperature = config.temperature ?? 0;
    this.defaultMaxTokens = config.maxTokens ?? 4096;
  }

  getModelName(): string {
    return this.modelName;
  }

  async evaluate(prompt: string, options: LLMOptions): Promise<DomainResult<LLMResponse>> {
    try {
      const model = this.client.getGenerativeModel({
        model: this.modelName,
        generationConfig: {
          temperature: options.temperature ?? this.defaultTemperature,
          maxOutputTokens: options.maxTokens ?? this.defaultMaxTokens,
        },
      });

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      const usage = response.usageMetadata;

      return DomainResult.ok<LLMResponse>({
        content: text,
        model: this.modelName,
        usage: {
          inputTokens: usage?.promptTokenCount ?? Math.ceil(prompt.length / 4),
          outputTokens: usage?.candidatesTokenCount ?? Math.ceil(text.length / 4),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return DomainResult.fail<LLMResponse>([{
        code: 'LLM_API_ERROR',
        message: `Gemini API error: ${message}`,
      }]);
    }
  }
}
