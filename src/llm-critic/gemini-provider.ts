import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ResponseSchema } from '@google/generative-ai';
import type { LLMCallContext, LLMProvider, LLMOptions, LLMResponse } from '../shared/interfaces/llm-provider.js';
import type { ProviderDescription } from '../shared/types/evaluation.js';
import type { GeminiConfig } from '../shared/types/llm-config.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import { JUDGE_PERSONA } from './frozen.js';
import { VERDICT_SCHEMA_TEXT } from './verdict-schema.js';

// Options the Gemini request never carries (FR-31, BR-U4-OPS-02): there is no effort or seed
// parameter. `model` is reported ignored only when it differs from the configured model.
const GEMINI_UNSENT_OPTIONS = ['effort', 'seed'] as const;

/** JSON-Schema keywords the Gemini response schema keeps; the rest are checked by the strict parser (VRD-03). */
const GEMINI_SCHEMA_KEYS: ReadonlySet<string> = new Set(['type', 'properties', 'required', 'items', 'maxItems', 'minItems', 'enum', 'description', 'nullable']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toGeminiSchemaNode(node: unknown): unknown {
  if (!isRecord(node)) return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (!GEMINI_SCHEMA_KEYS.has(key)) continue;
    if (key === 'properties' && isRecord(value)) {
      out[key] = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toGeminiSchemaNode(v)]));
    } else if (key === 'items') {
      out[key] = toGeminiSchemaNode(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * The verdict schema (canonical JSON text, BR-U4-VRD-01) as a Gemini `responseSchema`: the
 * subset Gemini accepts (`type`, `properties`, `required`, `items`, `maxItems`, ...).
 * `additionalProperties`, `maxLength`, `minimum` and `maximum` are enforced after the call by
 * `validateVerdict`, never relaxed.
 */
export function toGeminiResponseSchema(schemaText: string): ResponseSchema {
  return toGeminiSchemaNode(JSON.parse(schemaText)) as ResponseSchema;
}

/** A response candidate read loosely: it may arrive without content or parts (ADR-035 function-call check). */
interface LooseCandidate {
  readonly content?: { readonly parts?: readonly { readonly functionCall?: unknown }[] };
}

/**
 * LLM provider using Google's Gemini API via the @google/generative-ai SDK (BR-U4-VRD-01,
 * VRD-08, VRD-09, OPS-02). The model is the configured, pinned id (`--llm-model`, no
 * default); the persona goes as `systemInstruction` and the verdict schema as
 * `responseSchema` with a JSON response type.
 */
export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';
  private readonly client: GoogleGenerativeAI;
  private readonly modelName: string;
  private readonly defaultTemperature: number;
  private readonly thinkingLevel: 'low' | 'high' | undefined;
  /** Configured cap; every judge call passes `maxTokens` explicitly (D-U0-17), so this is informational. */
  readonly defaultMaxTokens: number;

  constructor(config: GeminiConfig) {
    if (config.model === '') {
      throw new Error('GeminiProvider requires a model id (--llm-model); there is no default (BR-U4-VRD-09)');
    }
    this.client = new GoogleGenerativeAI(config.apiKey);
    this.modelName = config.model;
    this.defaultTemperature = config.temperature;
    this.thinkingLevel = config.thinkingLevel;
    this.defaultMaxTokens = config.maxTokens;
  }

  getModelName(): string {
    return this.modelName;
  }

  describe(): ProviderDescription {
    return { provider: 'gemini', model: this.modelName };
  }

  async evaluate(prompt: string, options: LLMOptions, call?: LLMCallContext): Promise<DomainResult<LLMResponse>> {
    try {
      // The configured model is always used; effort and seed are never sent (FR-31, OPS-02).
      const temperature = options.temperature ?? this.defaultTemperature;
      const maxTokens = options.maxTokens;
      const model = this.client.getGenerativeModel({
        model: this.modelName,
        systemInstruction: call?.systemPrompt ?? JUDGE_PERSONA,
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          responseMimeType: 'application/json',
          responseSchema: toGeminiResponseSchema(call?.responseSchema ?? VERDICT_SCHEMA_TEXT),
          // ADR-035: Gemini 3 thinking level, only when configured (the request is otherwise unchanged).
          ...(this.thinkingLevel !== undefined && { thinkingConfig: { thinkingLevel: this.thinkingLevel } }),
        },
        // No `tools` and no `toolConfig`: the model is offered no tool (ADR-035).
      });

      const result = await model.generateContent(prompt);
      const response = result.response;
      // Fail closed (ADR-034/035): no tool is offered, so a function call in the answer is never accepted.
      // Read loosely: a candidate may arrive without content or parts.
      const candidates = (response as { readonly candidates?: readonly LooseCandidate[] }).candidates ?? [];
      if (candidates.some((c) => (c.content?.parts ?? []).some((part) => part.functionCall !== undefined))) {
        return DomainResult.fail<LLMResponse>([{ code: 'LLM_CLI_TOOL_USE', message: 'Gemini returned a function call although no tool was offered' }]);
      }
      const text = response.text();
      // The served model version (REST `modelVersion`; untyped in SDK 0.24.1), else the configured id.
      const served = (response as { readonly modelVersion?: unknown }).modelVersion;
      const usage = response.usageMetadata;
      const modelIgnored = options.model !== this.modelName;

      return DomainResult.ok<LLMResponse>({
        content: text,
        model: typeof served === 'string' && served !== '' ? served : this.modelName,
        usage: {
          inputTokens: usage?.promptTokenCount ?? Math.ceil(prompt.length / 4),
          outputTokens: usage?.candidatesTokenCount ?? Math.ceil(text.length / 4),
        },
        usedOptions: { ...(modelIgnored ? {} : { model: this.modelName }), temperature, maxTokens },
        ignoredOptions: [
          ...(modelIgnored ? (['model'] as const) : []),
          ...GEMINI_UNSENT_OPTIONS.filter((k) => options[k] !== undefined),
        ],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = (error as { readonly status?: unknown } | null)?.status;
      // ADR-035: quota, rate limit and overload are stops (never cached); the caller pauses and re-runs.
      if (status === 429 || status === 503 || /\b(429|503)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|quota|rate limit|overloaded/i.test(message)) {
        return DomainResult.fail<LLMResponse>([{ code: 'LLM_USAGE_LIMIT', message: `Gemini API limit or overload: ${message}` }]);
      }
      return DomainResult.fail<LLMResponse>([{
        code: 'LLM_API_ERROR',
        message: `Gemini API error: ${message}`,
      }]);
    }
  }
}
