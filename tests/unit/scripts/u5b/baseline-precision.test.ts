/**
 * SO4 baseline precision (ADR-020 item 1): the Horvitz–Thompson weighted share of TP-class P2 labels, per function,
 * per corpus tier, per project and overall, under the BR-U5b-61 interval rule. Hand-computed fixture.
 */
import { baselineLabelsOf, baselinePrecision, isTpClass, stratumFunctionId } from '../../../../scripts/lib/baseline-precision.js';
import type { BaselineLabel } from '../../../../scripts/lib/baseline-precision.js';

const many = (n: number, projectId: string, functionId: string, label: string, p: number): BaselineLabel[] =>
  Array.from({ length: n }, () => ({ projectId, functionId, label, inclusionProbability: p }));

// Project X, FF-S01: a stratum of 40 capped at 20 (p = 0.5): 10 TP, 5 unseeded-TP, 5 FP.
// Project Y, FF-C04: an exhaustive stratum of 5 (p = 1): 1 TP, 3 FP, 1 uncertain.
const LABELS: BaselineLabel[] = [
  ...many(10, 'X', 'FF-S01', 'TP', 0.5), ...many(5, 'X', 'FF-S01', 'unseeded-TP', 0.5), ...many(5, 'X', 'FF-S01', 'FP', 0.5),
  ...many(1, 'Y', 'FF-C04', 'TP', 1), ...many(3, 'Y', 'FF-C04', 'FP', 1), ...many(1, 'Y', 'FF-C04', 'uncertain', 1),
];

describe('baseline precision (ADR-020 item 1)', () => {
  it('TP-class = {TP, unseeded-TP}', () => {
    expect(['TP', 'unseeded-TP', 'FP', 'uncertain'].map(isTpClass)).toEqual([true, true, false, false]);
  });

  it('overall HT estimate 31/45 with Kish-Wilson; FF-S01 15/20 with Wilson on 20; FF-C04 n = 5 → counts only; tiers and projects', () => {
    const tiers = new Map([['X', 'core' as const], ['Y', 'e7' as const]]);
    const rows = baselinePrecision(LABELS, { seed: 9, resamples: 200, tierOf: (p) => tiers.get(p) });
    expect(rows.map((r) => [r.scope, r.key])).toEqual([
      ['overall', ''], ['tier', 'core'], ['tier', 'e7'], ['function', 'FF-C04'], ['function', 'FF-S01'], ['project', 'X'], ['project', 'Y'],
    ]);
    const overall = rows[0];
    // Σw = 20·2 + 5 = 45; Σw·y = 15·2 + 1 = 31; uncertain stays in the denominator as non-TP.
    expect(overall).toMatchObject({ n: 25, nTpClass: 16, nUncertain: 1, weightedTpClass: 31, weightedTotal: 45, nClusters: 2, ciMethod: 'wilson-kish' });
    expect(overall?.estimate?.toFixed(6)).toBe('0.688889');
    expect([overall?.ciLow?.toFixed(6), overall?.ciHigh?.toFixed(6)]).toEqual(['0.488168', '0.837153']);
    const s01 = rows.find((r) => r.scope === 'function' && r.key === 'FF-S01');
    // Equal weights: the HT share equals 15 / 20 and n_eff = 20, so the interval is Wilson(15, 20) = [0.531299, 0.888138].
    expect(s01).toMatchObject({ n: 20, weightedTpClass: 30, weightedTotal: 40, nEffective: 20, ciMethod: 'wilson-kish' });
    expect(s01?.estimate).toBe(0.75);
    expect([s01?.ciLow?.toFixed(6), s01?.ciHigh?.toFixed(6)]).toEqual(['0.531299', '0.888138']);
    expect(rows.find((r) => r.key === 'FF-C04')).toMatchObject({ n: 5, nTpClass: 1, nUncertain: 1, estimate: null, ciMethod: null });
    expect(rows.find((r) => r.scope === 'tier' && r.key === 'core')).toMatchObject({ n: 20, estimate: 0.75 });
  });

  it('no tier function → no tier rows; no labels → no rows; a bad inclusion probability is refused', () => {
    expect(baselinePrecision(LABELS, { seed: 1, resamples: 50 }).some((r) => r.scope === 'tier')).toBe(false);
    expect(baselinePrecision([], { seed: 1 })).toEqual([]);
    expect(() => baselinePrecision([{ projectId: 'X', functionId: 'F', label: 'TP', inclusionProbability: 0 }], { seed: 1 })).toThrow(/BASELINE_PRECISION_INVALID/);
  });

  it('baselineLabelsOf keeps P2 violation labels and reads the function from the stratum', () => {
    expect(stratumFunctionId('ghostfolio-test, FF-S01')).toBe('FF-S01');
    expect(stratumFunctionId('nofunction')).toBeUndefined();
    const out = baselineLabelsOf([
      { population: 'P2', kind: 'violation', projectId: 'X', stratum: 'X, FF-S01', inclusionProbability: 0.5, label: 'TP' },
      { population: 'P1', kind: 'violation', projectId: 'X', stratum: 'X, FF-S01', inclusionProbability: 1, label: 'FP' },
      { population: 'P4', kind: 'judge-unit', projectId: 'c', stratum: 'c, semantic', inclusionProbability: 1, label: 'pass' },
    ]);
    expect(out).toEqual([{ projectId: 'X', functionId: 'FF-S01', label: 'TP', inclusionProbability: 0.5 }]);
  });
});
