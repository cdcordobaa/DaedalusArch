/**
 * U5b Step 8: `score-golden` CLI main (BR-U5b-01, 73): usage, self-test, rule refusal.
 */
import { loadMatchingRule } from '../../../../scripts/lib/matching-rule.js';
import { main } from '../../../../scripts/score-golden.js';
import { ROOT } from './score-fixture.js';

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, io: { out: (t: string) => out.push(t), err: (t: string) => err.push(t), writeFile: () => undefined } };
}

describe('score-golden main (BR-U5b-73)', () => {
  it('--help exits 0; unknown arguments and a missing --case exit 2', async () => {
    const a = io();
    expect(await main(['--help'], ROOT, a.io, (r) => loadMatchingRule(r))).toBe(0);
    expect(a.out.join('')).toContain('usage:');
    expect(await main(['--bogus'], ROOT, io().io, (r) => loadMatchingRule(r))).toBe(2);
    expect(await main([], ROOT, io().io, (r) => loadMatchingRule(r))).toBe(2);
  });

  it('--self-test exits 1 on the built-in known-bad input', async () => {
    const a = io();
    expect(await main(['--self-test'], ROOT, a.io, (r) => loadMatchingRule(r))).toBe(1);
    expect(a.err.join('')).toContain('SCORE_INPUT_REJECTED');
  });

  it('a rule document whose version differs from the registered one exits 1 with SCORE_RULE_MISMATCH, no score', async () => {
    const a = io();
    expect(await main(['--case', 'tests/fixtures/u5b/hand-computed'], ROOT, a.io, (r) => loadMatchingRule(r, '9.9.9'))).toBe(1);
    expect(a.err.join('')).toContain('SCORE_RULE_MISMATCH');
    expect(a.out).toEqual([]);
  });
});
