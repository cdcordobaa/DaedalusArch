/**
 * ADR-020 statistical rules (items 1, 3, 7) with hand-computed fixtures:
 * - Kish-Wilson interval of a Horvitz–Thompson weighted proportion (baseline precision, item 1);
 * - recall intervals with the (project, operator) cell as the unit, the project bootstrap co-primary and the instance
 *   Wilson interval as the "if independent" bound (item 3);
 * - the one-sided permutation test of the directional self-preference check (item 7).
 */
import {
  kishEffectiveN, permutationTest, recallIntervals, weightedProportionInterval, wilson, wilsonProportion,
} from '../../../../scripts/lib/stats.js';
import type { RecallCell, WeightedObservation } from '../../../../scripts/lib/stats.js';

const obs = (n: number, weight: number, successes: number): WeightedObservation[] =>
  Array.from({ length: n }, (_, i) => ({ weight, success: i < successes }));

describe('wilsonProportion and the Kish effective size', () => {
  it('equals wilson on integer counts', () => {
    expect(wilsonProportion(8 / 12, 12)).toEqual(wilson(8, 12));
  });

  it('Kish n_eff: equal weights give n; 20 items of weight 2 and 5 of weight 1 give 45² / 85 = 23.823529', () => {
    expect(kishEffectiveN([3, 3, 3, 3])).toBeCloseTo(4, 12);
    expect(kishEffectiveN([...Array<number>(20).fill(2), ...Array<number>(5).fill(1)])).toBeCloseTo(2025 / 85, 12);
    expect(() => kishEffectiveN([1, 0])).toThrow(RangeError);
  });
});

describe('weightedProportionInterval (ADR-020 item 1; BR-U5b-61)', () => {
  it('two projects: a capped stratum (p = 0.5, 15 of 20 TP-class) and an exhaustive one (1 of 5) → HT 31/45, Kish-Wilson', () => {
    // Hand computation: Σw = 20·2 + 5·1 = 45, Σw·y = 15·2 + 1 = 31 → 0.688889; n_eff = 45² / (20·4 + 5) = 23.823529;
    // Wilson(0.688889, 23.823529) = [0.488168, 0.837153].
    const cell = weightedProportionInterval([obs(20, 2, 15), obs(5, 1, 1)], { seed: 7, resamples: 200 });
    expect(cell).toMatchObject({ n: 25, nClusters: 2, weightedSuccesses: 31, weightedTotal: 45, ciMethod: 'wilson-kish' });
    expect(cell.estimate).toBeCloseTo(31 / 45, 12);
    expect(cell.nEffective).toBeCloseTo(23.823529, 6);
    expect(cell.ciLow?.toFixed(6)).toBe('0.488168');
    expect(cell.ciHigh?.toFixed(6)).toBe('0.837153');
    expect(cell.sensitivity?.method).toBe('cluster-bootstrap');
  });

  it('n < 10 items → counts only; all TP-class → Clopper–Pearson on ⌊n_eff⌋; 10 clusters → cluster bootstrap', () => {
    expect(weightedProportionInterval([obs(9, 1, 4)], { seed: 1 })).toMatchObject({ n: 9, estimate: null, ciLow: null, ciMethod: null });
    const all = weightedProportionInterval([obs(12, 1, 12)], { seed: 1, resamples: 100 });
    expect(all).toMatchObject({ estimate: 1, ciMethod: 'clopper-pearson-kish', ciHigh: 1 });
    const ten = weightedProportionInterval(Array.from({ length: 10 }, (_, i) => obs(2, 1, i % 2)), { seed: 3, resamples: 300 });
    expect(ten.ciMethod).toBe('cluster-bootstrap');
    expect(ten.estimate).toBe(0.25);
  });
});

describe('recallIntervals with the (project, operator) cell as the unit (ADR-020 item 3)', () => {
  const cells: RecallCell[] = [
    { project: 'p1', operator: 'MO-S01', num: 3, den: 3 }, { project: 'p1', operator: 'MO-C04', num: 3, den: 3 },
    { project: 'p2', operator: 'MO-S01', num: 2, den: 3 }, { project: 'p2', operator: 'MO-C04', num: 0, den: 3 },
  ];

  it('4 cells of k = 3 (8 of 12 detected): Wilson on 4 cells is primary, the instance Wilson is the narrower "if independent" bound', () => {
    // Hand computation: p = 8/12; Wilson with n = 4 cells → [0.245120, 0.924917]; on 12 instances → [0.390622, 0.861880].
    const r = recallIntervals(cells, { seed: 11, resamples: 500 });
    expect(r).toMatchObject({ k: 8, n: 12, nCells: 4, nProjects: 2 });
    expect(r.estimate).toBeCloseTo(2 / 3, 12);
    expect(r.cell.ciMethod).toBe('wilson-cells');
    expect([r.cell.ciLow?.toFixed(6), r.cell.ciHigh?.toFixed(6)]).toEqual(['0.245120', '0.924917']);
    expect(r.independent.ciMethod).toBe('wilson');
    expect([r.independent.ciLow?.toFixed(6), r.independent.ciHigh?.toFixed(6)]).toEqual(['0.390622', '0.861880']);
    expect((r.cell.ciHigh ?? 0) - (r.cell.ciLow ?? 0)).toBeGreaterThan((r.independent.ciHigh ?? 0) - (r.independent.ciLow ?? 0));
    expect(r.project.ciMethod).toBe('cluster-bootstrap');
  });

  it('every cell detects → Clopper–Pearson on cells; 10 cells → cell bootstrap; one project → no project interval; n < 10 → counts only', () => {
    const full = recallIntervals(cells.map((c) => ({ ...c, num: c.den })), { seed: 1, resamples: 100 });
    expect(full.cell).toMatchObject({ ciMethod: 'clopper-pearson-cells', ciHigh: 1 });
    expect(full.independent.ciMethod).toBe('clopper-pearson');
    // Clopper–Pearson lower bound for 4 of 4 is 0.025^(1/4) = 0.397635.
    expect(full.cell.ciLow?.toFixed(6)).toBe('0.397635');
    const ten = recallIntervals(Array.from({ length: 10 }, (_, i) => ({ project: 'p1', operator: `MO-${String(i)}`, num: i % 3 === 0 ? 0 : 1, den: 1 })), { seed: 2, resamples: 300 });
    expect(ten.cell.ciMethod).toBe('cell-bootstrap');
    expect(ten.project.ciMethod).toBeNull();
    const small = recallIntervals([{ project: 'p', operator: 'o', num: 2, den: 3 }], { seed: 1 });
    expect(small).toMatchObject({ estimate: null, cell: { ciMethod: null }, independent: { ciMethod: null } });
  });
});

describe('one-sided permutation test (ADR-020 item 7)', () => {
  it('A = {1, 1}, B = {0, 0} in one block: one-sided p ≈ 1/6 (1 of 6 labelings), two-sided ≈ 2/6', () => {
    const o = [
      { block: 't', group: 'A' as const, value: 1 }, { block: 't', group: 'A' as const, value: 1 },
      { block: 't', group: 'B' as const, value: 0 }, { block: 't', group: 'B' as const, value: 0 },
    ];
    const greater = permutationTest(o, { seed: 5, resamples: 20_000, alternative: 'greater' });
    const two = permutationTest(o, { seed: 5, resamples: 20_000 });
    expect(greater.statistic).toBe(1);
    expect(greater.p).toBeGreaterThan(1 / 6 - 0.015);
    expect(greater.p).toBeLessThan(1 / 6 + 0.015);
    expect(two.p).toBeGreaterThan(2 / 6 - 0.015);
    expect(two.p).toBeLessThan(2 / 6 + 0.015);
  });
});
