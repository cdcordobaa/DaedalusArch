/**
 * U5b Step 5: statistical primitives and the interval rule (BR-U5b-61, 62, 63; U5bP Q10, Q22).
 * Reference values: Wilson and Clopper–Pearson as published (R `binom.test`, Wilson 1927 formula);
 * κ / AC1 hand-computed from the 2×2 margins; Fleiss κ from Fleiss (1971) as reproduced on Wikipedia (0.210).
 */
import {
  clopperPearson, cliffsDelta, clusterBootstrap, cohenKappa, createRng, fleissKappa, gwetAC1, holm,
  permutationTest, proportionInterval, quantileSorted, ratioOfSums, selectIntervalMethod, shuffle, wilson,
} from '../../../../scripts/lib/stats.js';
import type { PermutationObservation } from '../../../../scripts/lib/stats.js';

const f3 = (x: number): string => x.toFixed(3);
const f6 = (x: number): string => x.toFixed(6);

describe('seeded RNG (BR-U5b-63)', () => {
  it('records its seed and reproduces the same stream', () => {
    const a = createRng(42);
    const b = createRng(42);
    const xs = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(xs);
    expect(a.seed).toBe(42);
    expect(a.draws).toBe(5);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(createRng(43).next()).not.toBe(xs[0]);
    expect(() => createRng(1.5)).toThrow(RangeError);
  });

  it('shuffle is a seeded permutation that leaves its input unchanged', () => {
    const items = [1, 2, 3, 4, 5, 6];
    const s1 = shuffle(items, createRng(7));
    expect(shuffle(items, createRng(7))).toEqual(s1);
    expect([...s1].sort()).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('binomial intervals (BR-U5b-62)', () => {
  it('Wilson 95 % for 8/10 = [0.490, 0.943] and 3/10 = [0.108, 0.603]', () => {
    const w = wilson(8, 10);
    expect([f3(w.low), f3(w.high)]).toEqual(['0.490', '0.943']);
    const w3 = wilson(3, 10);
    expect([f3(w3.low), f3(w3.high)]).toEqual(['0.108', '0.603']);
  });

  it('Clopper–Pearson matches R binom.test: 8/10 = [0.444, 0.975], 3/10 = [0.067, 0.652], 0/20 = [0, 0.168]', () => {
    const c8 = clopperPearson(8, 10);
    expect([f3(c8.low), f3(c8.high)]).toEqual(['0.444', '0.975']);
    const c3 = clopperPearson(3, 10);
    expect([f3(c3.low), f3(c3.high)]).toEqual(['0.067', '0.652']);
    const c0 = clopperPearson(0, 20);
    expect(c0.low).toBe(0);
    expect(f6(c0.high)).toBe(f6(1 - 0.025 ** (1 / 20)));
    const cn = clopperPearson(20, 20);
    expect(cn.high).toBe(1);
    expect(f6(cn.low)).toBe(f6(0.025 ** (1 / 20)));
  });

  it('refuses impossible counts', () => {
    expect(() => wilson(3, 2)).toThrow(RangeError);
    expect(() => clopperPearson(0, 0)).toThrow(RangeError);
  });
});

describe('cluster bootstrap and permutation test (seeded)', () => {
  const clusters = [
    { num: 3, den: 4 }, { num: 1, den: 2 }, { num: 5, den: 5 }, { num: 0, den: 3 }, { num: 2, den: 2 }, { num: 4, den: 6 },
  ];

  it('is reproducible for a seed and records seed and resamples', () => {
    const a = clusterBootstrap(clusters, ratioOfSums, { seed: 11, resamples: 2000 });
    const b = clusterBootstrap(clusters, ratioOfSums, { seed: 11, resamples: 2000 });
    expect(b).toEqual(a);
    expect(a).toMatchObject({ method: 'cluster-bootstrap', seed: 11, resamples: 2000 });
    expect(f6(a.estimate)).toBe(f6(15 / 22));
    expect(a.low).toBeLessThan(a.estimate);
    expect(a.high).toBeGreaterThan(a.estimate);
    expect(clusterBootstrap(clusters, ratioOfSums, { seed: 12, resamples: 2000 })).not.toEqual(a);
  });

  it('gives a zero-width interval when every cluster is identical, and counts undefined resamples', () => {
    const same = clusterBootstrap([{ num: 1, den: 2 }, { num: 1, den: 2 }, { num: 1, den: 2 }], ratioOfSums, { seed: 1, resamples: 500 });
    expect([same.low, same.high]).toEqual([0.5, 0.5]);
    const withEmpty = clusterBootstrap([{ num: 0, den: 0 }, { num: 1, den: 1 }], ratioOfSums, { seed: 3, resamples: 400 });
    expect(withEmpty.undefinedResamples).toBeGreaterThan(0);
    expect(withEmpty.low).toBe(1);
  });

  it('quantileSorted interpolates (type 7)', () => {
    expect(quantileSorted([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantileSorted([1, 2, 3, 4], 0)).toBe(1);
    expect(quantileSorted([1, 2, 3, 4], 1)).toBe(4);
  });

  it('permutation test: one block {1,2} vs {3,4} has exact two-sided p = 2/6', () => {
    const obs: PermutationObservation[] = [
      { block: 'b', group: 'A', value: 1 }, { block: 'b', group: 'A', value: 2 },
      { block: 'b', group: 'B', value: 3 }, { block: 'b', group: 'B', value: 4 },
    ];
    const r = permutationTest(obs, { seed: 5, resamples: 20_000 });
    expect(r.statistic).toBe(-2);
    expect(Math.abs(r.p - 1 / 3)).toBeLessThan(0.015);
    expect(permutationTest(obs, { seed: 5, resamples: 20_000 })).toEqual(r);
    expect(r.seed).toBe(5);
  });

  it('permutation test permutes within blocks only (exact p 2/8 within blocks vs 14/20 pooled)', () => {
    // Three blocks with A = B + 1: within-block permutations give T* = (±1 ±1 ±1) / 3, so |T*| >= 1 only
    // when all three agree (2 of 8). Pooling the blocks gives 14 of 20 (enumerated by hand).
    const obs: PermutationObservation[] = [
      { block: 'x', group: 'A', value: 11 }, { block: 'x', group: 'B', value: 10 },
      { block: 'y', group: 'A', value: 101 }, { block: 'y', group: 'B', value: 100 },
      { block: 'z', group: 'A', value: 51 }, { block: 'z', group: 'B', value: 50 },
    ];
    const r = permutationTest(obs, { seed: 9, resamples: 20_000 });
    expect(r.statistic).toBeCloseTo(1, 12);
    expect(Math.abs(r.p - 2 / 8)).toBeLessThan(0.015);
    const pooled = permutationTest(obs.map((o) => ({ ...o, block: 'all' })), { seed: 9, resamples: 20_000 });
    expect(Math.abs(pooled.p - 14 / 20)).toBeLessThan(0.015);
  });
});

describe('agreement statistics (BR-U5b-62)', () => {
  it("Cohen's κ and Gwet's AC1 on known 2×2 tables to 6 dp", () => {
    expect(f6(cohenKappa([[20, 5], [10, 15]]))).toBe('0.400000');
    expect(f6(gwetAC1([[20, 5], [10, 15]]))).toBe('0.405941');
    // Kappa paradox table: high agreement, skewed margins.
    expect(f6(cohenKappa([[118, 5], [2, 0]]))).toBe('-0.023392');
    expect(f6(gwetAC1([[118, 5], [2, 0]]))).toBe('0.940776');
    expect(f6(cohenKappa([[45, 15], [25, 15]]))).toBe('0.130435');
    expect(f6(gwetAC1([[45, 15], [25, 15]]))).toBe('0.266055');
    expect(() => cohenKappa([[1, 2, 3], [1, 2, 3]])).toThrow(RangeError);
  });

  it("Fleiss' κ on the Fleiss (1971) example = 0.210", () => {
    const m = [
      [0, 0, 0, 0, 14], [0, 2, 6, 4, 2], [0, 0, 3, 5, 6], [0, 3, 9, 2, 0], [2, 2, 8, 1, 1],
      [7, 7, 0, 0, 0], [3, 2, 6, 3, 0], [2, 5, 3, 2, 2], [6, 5, 2, 1, 0], [0, 2, 2, 3, 7],
    ];
    expect(f6(fleissKappa(m))).toBe('0.209931');
    expect(f3(fleissKappa(m))).toBe('0.210');
    expect(() => fleissKappa([[1, 1], [2, 1]])).toThrow(RangeError);
  });
});

describe('Holm and Cliff\'s δ (BR-U5b-62)', () => {
  it('Holm adjusts step-down, monotone, in input order', () => {
    expect(holm([0.01, 0.04, 0.03, 0.005]).map(f6)).toEqual(['0.030000', '0.060000', '0.060000', '0.020000']);
    expect(holm([0.5, 0.6])).toEqual([1, 1]);
    expect(holm([])).toEqual([]);
  });

  it("Cliff's δ on a hand-computed pair of samples", () => {
    expect(f6(cliffsDelta([1, 2, 3], [2, 2, 4]))).toBe(f6(-3 / 9));
    expect(cliffsDelta([5, 6], [1, 2])).toBe(1);
    expect(cliffsDelta([1, 1], [1, 1])).toBe(0);
  });
});

describe('interval rule (BR-U5b-61)', () => {
  const clustersOf = (sizes: readonly { num: number; den: number }[]) => sizes;

  it('5 clusters → wilson, with the cluster bootstrap as a sensitivity column', () => {
    const cell = proportionInterval(clustersOf([
      { num: 2, den: 4 }, { num: 3, den: 4 }, { num: 1, den: 4 }, { num: 4, den: 4 }, { num: 2, den: 4 },
    ]), { seed: 1, resamples: 500 });
    expect(cell.ciMethod).toBe('wilson');
    expect(cell.sensitivity?.method).toBe('cluster-bootstrap');
    const w = wilson(12, 20);
    expect([cell.ciLow, cell.ciHigh]).toEqual([w.low, w.high]);
    expect(selectIntervalMethod({ k: 12, n: 20, nClusters: 5 })).toBe('wilson');
  });

  it('12 clusters → cluster-bootstrap', () => {
    const clusters = Array.from({ length: 12 }, (_, i) => ({ num: i % 3, den: 3 }));
    const cell = proportionInterval(clusters, { seed: 2, resamples: 500 });
    expect(cell.ciMethod).toBe('cluster-bootstrap');
    expect(cell.sensitivity).toBeUndefined();
    expect(cell.seed).toBe(2);
  });

  it('count 0 of 20 → clopper-pearson', () => {
    const cell = proportionInterval([{ num: 0, den: 10 }, { num: 0, den: 10 }], { seed: 3, resamples: 200 });
    expect(cell.ciMethod).toBe('clopper-pearson');
    expect(cell.ciLow).toBe(0);
    expect(f6(cell.ciHigh ?? -1)).toBe(f6(clopperPearson(0, 20).high));
  });

  it('n = 7 → interval columns empty, counts present', () => {
    const cell = proportionInterval([{ num: 3, den: 4 }, { num: 2, den: 3 }], { seed: 4 });
    expect(cell).toEqual({ k: 5, n: 7, nClusters: 2, estimate: null, ciLow: null, ciHigh: null, ciMethod: null });
  });
});
