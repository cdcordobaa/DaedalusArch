/**
 * U5b Step 10: hand-computed acceptance and its provenance (BR-U5b-26, 27; exit criterion 1).
 *
 * The scorer over `tests/fixtures/u5b/hand-computed/` must equal `expected.canonical.json` byte for byte, and git
 * history must show that file committed before the first commit of `scripts/score-golden.ts`. The provenance test
 * needs full history: it fails (never skips) on a shallow clone; CI checks out with `fetch-depth: 0`.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadMatchingRule } from '../../../../scripts/lib/matching-rule.js';
import { canonicalGoldenScore, judgeProbeOperators, loadCase, metricThresholds, scoreDifferential } from '../../../../scripts/score-golden.js';
import { ROOT, specRootAt } from './score-fixture.js';

const CASE = 'tests/fixtures/u5b/hand-computed';

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

describe('hand-computed acceptance (BR-U5b-26, 27)', () => {
  it('the scorer reproduces expected.canonical.json byte for byte', async () => {
    const rule = loadMatchingRule(ROOT);
    if (!rule.ok) throw new Error(rule.detail);
    const loaded = loadCase(ROOT, join(ROOT, CASE));
    if (!loaded.ok) throw new Error(loaded.detail);
    // The spec as the fixture's runs saw it (RunRecord.cliCommit), DV-U5b-21.
    const row0 = loaded.value.manifest.rows[0];
    if (row0 === undefined) throw new Error('empty manifest');
    const runCommit = (JSON.parse(readFileSync(join(ROOT, CASE, 'reports/baseline.run.json'), 'utf8')) as { cliCommit: string }).cliCommit;
    const thresholds = await metricThresholds(specRootAt(runCommit, row0.specPath), loaded.value.manifest.rows);
    if (!thresholds.ok) throw new Error(thresholds.detail);
    const out = scoreDifferential({
      rule: rule.rule, seeds: loaded.value.seeds, rejections: loaded.value.manifest.rejections,
      thresholds: thresholds.value, judgeProbeOperators: judgeProbeOperators(ROOT),
    });
    if (!out.ok) throw new Error(`${out.code}: ${out.detail}`);
    const expected = readFileSync(join(ROOT, CASE, 'expected.canonical.json'));
    expect(Buffer.from(canonicalGoldenScore(out.score), 'utf8').equals(expected)).toBe(true);
    // Spot checks named by BR-U5b-27: pre-existing, both collateral kinds, FP-strict, twin specificity, FLOWS_TO.
    expect(out.score.preExistingIgnored).toBe(58);
    expect(out.score.collateralByFunction.get('FF-S02')).toBe(4);
    expect(out.score.collateralByFunction.get('FF-S01')).toBe(1);
    expect(out.labelItems).toEqual([]);
    expect(out.score.twinSpecificity).toEqual({ clean: 1, scored: 1 });
    expect(out.score.edgeEvidence.every((e) => e.pass)).toBe(true);
  });

  it('git history: expected.canonical.json is committed before the first commit of scripts/score-golden.ts', () => {
    expect(git('rev-parse', '--is-shallow-repository')).toBe('false');
    const a = git('log', '--diff-filter=A', '--format=%H', '--', 'scripts/score-golden.ts').split('\n').filter(Boolean);
    const f = git('log', '--diff-filter=A', '--format=%H', '--', `${CASE}/expected.canonical.json`).split('\n').filter(Boolean);
    expect(a).toHaveLength(1);
    expect(f).toHaveLength(1);
    const [A, F] = [a[0] ?? '', f[0] ?? ''];
    expect(F).not.toBe(A);
    expect(Number(git('log', '-1', '--format=%ct', F))).toBeLessThan(Number(git('log', '-1', '--format=%ct', A)));
    // `merge-base --is-ancestor` exits 0 when F is an ancestor of A (execFileSync throws otherwise).
    expect(() => execFileSync('git', ['merge-base', '--is-ancestor', F, A], { cwd: ROOT })).not.toThrow();
  });
});
