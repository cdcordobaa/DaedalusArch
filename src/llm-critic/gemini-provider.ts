import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LLMProvider, LLMOptions, LLMResponse } from '../shared/interfaces/llm-provider.js';
import type { ProviderDescription } from '../shared/types/evaluation.js';
import type { GeminiConfig } from '../shared/types/llm-config.js';
import { DomainResult } from '../shared/errors/domain-result.js';

const DEFAULT_MODEL = 'gemini-2.0-flash';

// Options the Gemini request never carries (FR-31): the configured model is used instead of options.model.
const GEMINI_UNSENT_OPTIONS = ['model', 'effort', 'seed'] as const;

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

  describe(): ProviderDescription {
    return { provider: 'gemini', model: this.modelName };
  }

  async evaluate(prompt: string, options: LLMOptions): Promise<DomainResult<LLMResponse>> {
    try {
      // The configured model is always used; options.model, effort and seed are not sent (FR-31).
      const temperature = options.temperature ?? this.defaultTemperature;
      const maxTokens = options.maxTokens ?? this.defaultMaxTokens;
      const model = this.client.getGenerativeModel({
        model: this.modelName,
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
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
        usedOptions: { temperature, maxTokens },
        ignoredOptions: GEMINI_UNSENT_OPTIONS.filter((k) => options[k] !== undefined),
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
