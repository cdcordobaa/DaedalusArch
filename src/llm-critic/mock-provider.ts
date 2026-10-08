import type { LLMCallContext, LLMProvider, LLMOptions, LLMResponse } from '../shared/interfaces/llm-provider.js';
import type { ProviderDescription } from '../shared/types/evaluation.js';
import { DomainResult } from '../shared/errors/domain-result.js';

/**
 * Mock LLM provider for tests and the Mock-recorded fixture cassettes (D-U4-12). Returns
 * canned responses; records every prompt (`getPrompts()`, T1) and the last options and call
 * context (`getLastOptions()`, `getLastCall()`, T3).
 */
export class MockLLMProvider implements LLMProvider {
  readonly name = 'mock';
  private readonly responses = new Map<string, string>();
  private readonly defaultResponse: string;
  private callCount = 0;
  private lastOptions: LLMOptions | undefined;
  private lastCall: LLMCallContext | undefined;
  private readonly prompts: string[] = [];

  constructor(defaultResponse?: string) {
    this.defaultResponse = defaultResponse ?? JSON.stringify({
      pass: true,
      confidence: 0.85,
      reasoning: 'Mock evaluation — code appears compliant.',
      evidence: ['Mock evidence'],
      violations: [],
    });
  }

  /**
   * Register a canned response for a specific prompt substring.
   */
  setResponse(promptSubstring: string, response: string): void {
    this.responses.set(promptSubstring, response);
  }

  getCallCount(): number {
    return this.callCount;
  }

  /** Options received by the most recent evaluate() call (FR-31 test helper). */
  getLastOptions(): LLMOptions | undefined {
    return this.lastOptions;
  }

  /** Call context received by the most recent evaluate() call, if any. */
  getLastCall(): LLMCallContext | undefined {
    return this.lastCall;
  }

  /** Every prompt received, in call order (BR-U4-CTX-01 test helper, T1). */
  getPrompts(): readonly string[] {
    return [...this.prompts];
  }

  describe(): ProviderDescription {
    return { provider: 'mock', model: 'mock-model' };
  }

  evaluate(prompt: string, options: LLMOptions, call?: LLMCallContext): Promise<DomainResult<LLMResponse>> {
    this.callCount++;
    this.lastOptions = options;
    this.lastCall = call;
    this.prompts.push(prompt);
    // The mock sends nothing anywhere: every received option is reported as ignored.
    const ignoredOptions = Object.keys(options) as (keyof LLMOptions)[];

    // Check for matching canned response
    for (const [key, response] of this.responses) {
      if (prompt.includes(key)) {
        return Promise.resolve(DomainResult.ok({
          content: response,
          model: 'mock-model',
          usage: { inputTokens: prompt.length / 4, outputTokens: response.length / 4 },
          usedOptions: {},
          ignoredOptions,
        }));
      }
    }

    return Promise.resolve(DomainResult.ok({
      content: this.defaultResponse,
      model: 'mock-model',
      usage: { inputTokens: prompt.length / 4, outputTokens: this.defaultResponse.length / 4 },
      usedOptions: {},
      ignoredOptions,
    }));
  }
}
