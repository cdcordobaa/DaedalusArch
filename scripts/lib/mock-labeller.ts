/**
 * The `llm-label --provider mock` labeller (P-U6 runbook dry run; ADR-021 item 7).
 *
 * U4's `MockLLMProvider` answers in the judge's verdict shape, so every labeller answer was invalid and every item
 * reconciled to `uncertain` (`invalid-run`): a dry run never reached the labelled paths. This Mock reads the options
 * and root causes the prompt presents (in the presented, possibly permuted, order) and answers one valid JSON object
 * by option *name*, so both runs agree after the permutation and the item reconciles to that label:
 *
 * - violation items: `TP`; judge units: `pass`; missed seeds: `FN` with root cause `RC-OTHER` (else the first);
 * - when the preferred option is not offered, the first presented option.
 *
 * It describes itself as provider `mock`, model `mock-labeller`, so its cassettes never collide with a live route.
 * It never reads the network or a CLI. Pure apart from the `evaluate` promise.
 */
import { DomainResult } from '../../src/shared/errors/domain-result.js';
import type { LLMCallContext, LLMOptions, LLMProvider, LLMResponse } from '../../src/shared/interfaces/llm-provider.js';
import type { ProviderDescription } from '../../src/shared/types/evaluation.js';

export const MOCK_LABELLER_MODEL = 'mock-labeller';
const PREFERRED: readonly string[] = ['TP', 'pass', 'FN'];
const PREFERRED_ROOT_CAUSE = 'RC-OTHER';

/** The numbered list under `## <heading>` of a rendered labeller prompt, in presented order. */
export function presentedList(prompt: string, heading: string): string[] {
  const at = prompt.indexOf(`## ${heading}\n`);
  if (at < 0) return [];
  const out: string[] = [];
  for (const line of prompt.slice(at).split('\n').slice(1)) {
    const m = /^\s*(\d+)\. (.+)$/.exec(line);
    if (m !== null) out.push(m[2] ?? '');
    else if (out.length > 0) break;
  }
  return out;
}

/** The answer the Mock gives to one rendered prompt (1-based option and root-cause numbers). */
export function mockLabelAnswer(prompt: string): { option: number; rootCause: number | null; rationale: string } {
  const options = presentedList(prompt, 'Label options');
  const causes = presentedList(prompt, 'Root causes');
  const pick = PREFERRED.find((p) => options.includes(p));
  const option = pick === undefined ? 1 : options.indexOf(pick) + 1;
  const needsCause = pick === 'FN';
  const rc = causes.indexOf(PREFERRED_ROOT_CAUSE);
  return { option, rootCause: needsCause ? (rc >= 0 ? rc + 1 : 1) : null, rationale: 'mock labeller answer (dry run, no model call)' };
}

export class MockLabellerProvider implements LLMProvider {
  readonly name = 'mock-labeller';

  describe(): ProviderDescription {
    return { provider: 'mock', model: MOCK_LABELLER_MODEL };
  }

  evaluate(prompt: string, _options: LLMOptions, _call?: LLMCallContext): Promise<DomainResult<LLMResponse>> {
    const content = JSON.stringify(mockLabelAnswer(prompt));
    return Promise.resolve(DomainResult.ok({ content, model: MOCK_LABELLER_MODEL, usage: { inputTokens: Math.ceil(prompt.length / 4), outputTokens: Math.ceil(content.length / 4) }, usedOptions: {}, ignoredOptions: [] }));
  }
}
