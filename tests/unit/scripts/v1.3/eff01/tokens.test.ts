/**
 * T-TOK (design SC-4 to SC-6, DR-20). The fixture is shaped like the committed floor-probe envelope
 * (`experiments/v1.3-floor-probe-3/…/envelope-step-04.json`): numbers re-typed, cost removed.
 */
import { tokensFromEnvelope, tokensFromPartial, usageMismatch } from '../../../../../scripts/v1.3/lib/eff01/tokens.js';
import { readTranscript } from '../../../../../scripts/v1.3/lib/eff01/transcript.js';

const PINNED = 'claude-sonnet-5-5';
const ENVELOPE = {
  type: 'result',
  num_turns: 12,
  usage: { input_tokens: 18, cache_creation_input_tokens: 21050, cache_read_input_tokens: 135916, output_tokens: 6911, service_tier: 'standard' },
  modelUsage: {
    [PINNED]: { inputTokens: 18, outputTokens: 6911, cacheReadInputTokens: 135916, cacheCreationInputTokens: 21050, contextWindow: 1000000 },
  },
};

describe('EFF-01 tokens (T-TOK)', () => {
  it('sums the four camelCase fields of modelUsage (processed) and gives the secondary measures', () => {
    const t = tokensFromEnvelope(ENVELOPE, PINNED);
    expect(t?.processed).toBe(18 + 21050 + 135916 + 6911);
    expect(t?.uncached).toBe(18 + 21050 + 6911);
    expect(t?.output).toBe(6911);
    expect(t?.usageTotal).toBe(t?.processed);
    expect(t?.usageMismatch).toBe(false);
    expect(t?.auxProcessed).toBe(0);
  });

  it('keeps auxiliary models in the primary and reports their share; flags a usage mismatch', () => {
    const env = { ...ENVELOPE, modelUsage: { ...ENVELOPE.modelUsage, 'claude-haiku-x': { inputTokens: 100, outputTokens: 20, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 } } };
    const t = tokensFromEnvelope(env, PINNED);
    expect(t?.processed).toBe(18 + 21050 + 135916 + 6911 + 120);
    expect(t?.auxProcessed).toBe(120);
    expect(t?.usageMismatch).toBe(true);
    expect(usageMismatch(env, PINNED)).toBe(true);
  });

  it('returns null without modelUsage', () => {
    expect(tokensFromEnvelope({ type: 'result' }, PINNED)).toBeNull();
  });

  it('sums a killed session\'s assistant usage once per message id (DR-20)', () => {
    const msg = (id: string, out: number) => JSON.stringify({ type: 'assistant', message: { id, model: PINNED, content: [], usage: { input_tokens: 1, cache_creation_input_tokens: 10, cache_read_input_tokens: 100, output_tokens: out } } });
    const t = tokensFromPartial(readTranscript([msg('a', 5), msg('a', 5), msg('b', 7)].join('\n')), PINNED);
    expect(t.processed).toBe(2 * 111 + 5 + 7);
    expect(t.output).toBe(12);
    expect(t.usageTotal).toBeNull();
  });
});
