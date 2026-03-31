import type { LLMProvider, LLMOptions, LLMResponse } from '../shared/interfaces/llm-provider.js';
import { DomainResult } from '../shared/errors/domain-result.js';

/**
 * Mock LLM provider for testing. Returns canned responses.
 */
export class MockLLMProvider implements LLMProvider {
  readonly name = 'mock';
  private responses: Map<string, string> = new Map();
  private defaultResponse: string;
  private callCount = 0;

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

  async evaluate(prompt: string, _options: LLMOptions): Promise<DomainResult<LLMResponse>> {
    this.callCount++;

    // Check for matching canned response
    for (const [key, response] of this.responses) {
      if (prompt.includes(key)) {
        return DomainResult.ok({
          content: response,
          model: 'mock-model',
          usage: { inputTokens: prompt.length / 4, outputTokens: response.length / 4 },
        });
      }
    }

    return DomainResult.ok({
      content: this.defaultResponse,
      model: 'mock-model',
      usage: { inputTokens: prompt.length / 4, outputTokens: this.defaultResponse.length / 4 },
    });
  }
}
