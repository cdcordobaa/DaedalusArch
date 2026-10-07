import type { LLMProvider, LLMOptions, LLMResponse } from '../shared/interfaces/llm-provider.js';
import type { ProviderDescription } from '../shared/types/evaluation.js';
import { DomainResult } from '../shared/errors/domain-result.js';

/**
 * Mock LLM provider for testing. Returns canned responses.
 */
export class MockLLMProvider implements LLMProvider {
  readonly name = 'mock';
  private responses: Map<string, string> = new Map();
  private defaultResponse: string;
  private callCount = 0;
  private lastOptions: LLMOptions | undefined;

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

  describe(): ProviderDescription {
    return { provider: 'mock', model: 'mock-model' };
  }

  async evaluate(prompt: string, options: LLMOptions): Promise<DomainResult<LLMResponse>> {
    this.callCount++;
    this.lastOptions = options;
    // The mock sends nothing anywhere: every received option is reported as ignored.
    const ignoredOptions = Object.keys(options) as (keyof LLMOptions)[];

    // Check for matching canned response
    for (const [key, response] of this.responses) {
      if (prompt.includes(key)) {
        return DomainResult.ok({
          content: response,
          model: 'mock-model',
          usage: { inputTokens: prompt.length / 4, outputTokens: response.length / 4 },
          usedOptions: {},
          ignoredOptions,
        });
      }
    }

    return DomainResult.ok({
      content: this.defaultResponse,
      model: 'mock-model',
      usage: { inputTokens: prompt.length / 4, outputTokens: this.defaultResponse.length / 4 },
      usedOptions: {},
      ignoredOptions,
    });
  }
}
