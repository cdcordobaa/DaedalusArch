/**
 * Study 2 level-outcome power simulation (gate D3): the measured inputs, the NB fit, the sign-flip test (exact, Monte
 * Carlo and the simulated p), Holm, the cell model, determinism, and power's direction.
 */
import { createRng } from '../../../../scripts/lib/stats.js';
import {
  CELLS, FLIPS, STYLE_DATA, binomialDraw, blocksOf, cellMeans, cellSeed, fitNb, holmReject, lateIncrement, minAttainableP,
  nbDraw, nbZeroProb, signFlipExactP, signFlipMcP, signFlipSimP, signFlipTest, simulatePower, smallestGrid, stepTurnsOf,
  styleParams, usesExact, valueAtStep,
} from '../../../../scripts/v1.3/lib/level-power-sim.js';
import type { SweepRow } from '../../../../scripts/v1.3/lib/level-power-sim.js';

const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const variance = (xs: readonly number[]): number => {
  const m = mean(xs);
  return xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
};
const style = (id: string) => {
  const s = STYLE_DATA.find((x) => x.id === id);
  if (s === undefined) throw new Error(id);
  return s;
};

/** Brute-force enumeration, the definition the subset-sum count must match. */
function enumerateP(d: readonly number[]): number {
  const obs = Math.abs(d.reduce((a, b) => a + b, 0));
  let hits = 0;
  for (let m = 0; m < 2 ** d.length; m += 1) {
    let s = 0;
    d.forEach((x, i) => (s += (m >> i) & 1 ? -x : x));
    if (Math.abs(s) >= obs) hits += 1;
  }
  return hits / 2 ** d.length;
}

describe('measured inputs', () => {
  it('Layered as measured: step-4 distinct edges 3, 4, 9; step 1 dedups to 2/2/4 as the design states', () => {
    const s = style('layered-measured');
    expect(s.runs.map((r) => r.edgesPerStep[0])).toEqual([2, 2, 4]);
    const p = styleParams(s, 4, 'locf');
    expect(p.fit.values).toEqual([3, 4, 9]);
    expect(p.fit.mean).toBeCloseTo(16 / 3, 10);
    expect(p.fit.variance).toBeCloseTo(31 / 3, 10);
    // θ = m² / (v − m) = (256/9) / 5
    expect(p.fit.theta).toBeCloseTo(256 / 45, 10);
  });

  it('k = 6 carries the last step forward (locf) or adds the late increment (linear)', () => {
    const s = style('layered-measured');
    expect(styleParams(s, 6, 'locf').fit.values).toEqual([3, 4, 9]);
    // increments from step 3 on: market 0, 1; league 0, 0, 0; hive 2, 0, 0 → 3 / 8
    expect(lateIncrement(s.runs)).toBeCloseTo(0.375, 10);
    const r = s.runs[0];
    if (r === undefined) throw new Error('no run');
    expect(valueAtStep(r, 6, 'linear', 0.375)).toBeCloseTo(3.75, 10);
    expect(valueAtStep(r, 2, 'linear', 0.375)).toBe(2);
  });

  it('the repaired Layered fit is under-dispersed (Poisson) and the zero stratum has no θ', () => {
    expect(styleParams(style('layered-repaired'), 4, 'locf').fit.theta).toBe(Number.POSITIVE_INFINITY);
    const z = styleParams(style('zero'), 4, 'locf').fit;
    expect(z.mean).toBe(0);
    expect(Number.isNaN(z.theta)).toBe(true);
  });

  it('fitNb rejects fewer than two values', () => {
    expect(() => fitNb([1])).toThrow();
  });
});

describe('variates', () => {
  it('NB draws have the requested mean and variance μ + μ²/θ', () => {
    const rng = createRng(11);
    const xs = Array.from({ length: 40_000 }, () => nbDraw(rng, 5, 2));
    expect(mean(xs)).toBeCloseTo(5, 0);
    expect(variance(xs) / (5 + 25 / 2)).toBeGreaterThan(0.9);
    expect(variance(xs) / (5 + 25 / 2)).toBeLessThan(1.1);
    expect(nbDraw(rng, 0, 2)).toBe(0);
  });

  it('binomial draws have mean np in both regimes', () => {
    const rng = createRng(12);
    for (const [n, p] of [[99_999, 0.0001], [99_999, 0.03], [99_999, 0.9999]] as const) {
      const xs = Array.from({ length: 4000 }, () => binomialDraw(rng, n, p));
      expect(Math.abs(mean(xs) - n * p) / Math.max(1, Math.sqrt(n * p * (1 - p)))).toBeLessThan(0.1);
    }
    expect(binomialDraw(rng, 10, 0)).toBe(0);
    expect(binomialDraw(rng, 10, 1)).toBe(10);
  });

  it('nbZeroProb matches the formula and the limits', () => {
    expect(nbZeroProb(0, 3)).toBe(1);
    expect(nbZeroProb(2, Number.POSITIVE_INFINITY)).toBeCloseTo(Math.exp(-2), 12);
    expect(nbZeroProb(1.5, 2)).toBeCloseTo((2 / 3.5) ** 2, 12);
  });
});

describe('sign-flip test', () => {
  it('the subset-sum count equals brute-force enumeration', () => {
    const rng = createRng(3);
    for (let t = 0; t < 60; t += 1) {
      const n = 1 + rng.int(10);
      const d = Array.from({ length: n }, () => rng.int(9) - 4);
      expect(signFlipExactP(d)).toBeCloseTo(enumerateP(d), 12);
    }
  });

  it('known values: all-zero gives 1, n same-sign blocks give 2/2^n', () => {
    expect(signFlipExactP([0, 0, 0])).toBe(1);
    expect(signFlipExactP([])).toBe(1);
    expect(signFlipExactP([3, 1, 2, 5, 1, 1])).toBeCloseTo(2 / 64, 12);
    expect(minAttainableP(6)).toBeCloseTo(2 / 64, 12);
    expect(minAttainableP(8)).toBeLessThan(0.05 / 3);
    expect(minAttainableP(6)).toBeGreaterThan(0.05 / 3);
  });

  it('rejects non-integer differences', () => {
    expect(() => signFlipExactP([0.5, 1])).toThrow();
  });

  it('exact when 2^n ≤ 99,999 (n ≤ 16), Monte Carlo above', () => {
    expect(usesExact(16)).toBe(true);
    expect(usesExact(17)).toBe(false);
    expect(signFlipTest([2, 1, -1, 3], createRng(1)).exact).toBe(true);
  });

  it('the literal Monte Carlo p agrees with the exact p, and the simulated p has the same distribution', () => {
    const d = [3, 1, 2, -1, 0, 2, 1, -2, 4, 1, 0, 2, 1, -1, 3, 2, 1, 0];
    const pe = signFlipExactP(d);
    const flips = 20_000;
    const pmc = signFlipMcP(d, flips, createRng(5));
    expect(Math.abs(pmc - pe)).toBeLessThan(4 * Math.sqrt((pe * (1 - pe)) / flips) + 1 / flips);
    const rng = createRng(6);
    const sims = Array.from({ length: 300 }, () => signFlipSimP(d, rng, flips));
    expect(Math.abs(mean(sims) - (1 + flips * pe) / (1 + flips))).toBeLessThan(0.002);
    expect(signFlipTest(d, createRng(7), 999).exact).toBe(false);
  });

  it('Holm rejects in order and stops at the first failure', () => {
    expect(holmReject([0.01, 0.02, 0.04])).toEqual([true, true, true]);
    expect(holmReject([0.01, 0.03, 0.04])).toEqual([true, false, false]);
    expect(holmReject([0.03, 0.001, 0.2])).toEqual([false, true, false]);
  });
});

describe('cell model and power', () => {
  it('cell means follow the scenario rate ratio; mcp@L4 compounds it', () => {
    expect(cellMeans(4, 0.5)).toEqual({ noneL2: 4, noneL3: 2, noneL4: 2, mcpL2: 2, mcpL4: 1 });
    expect(CELLS).toHaveLength(5);
  });

  it('grid arithmetic: design §3.7 grid is 12 blocks and 240 step turns', () => {
    const g = { tasks: 4, replicates: 3, k: 4 };
    expect(blocksOf(g)).toBe(12);
    expect(stepTurnsOf(g)).toBe(240);
  });

  it('is deterministic for a seed', () => {
    const run = () => simulatePower([{ mean: 3, theta: 2 }], { tasks: 4, replicates: 3, k: 4 }, 0.5, 'independent', 50, createRng(cellSeed(1, 'x')));
    expect(run()).toEqual(run());
  });

  it('power is 0 at a zero base rate, and at 6 or fewer blocks whatever the effect', () => {
    const z = simulatePower([{ mean: 0, theta: 2 }], { tasks: 6, replicates: 4, k: 4 }, 0.25, 'shared', 50, createRng(2));
    expect(z.power).toEqual({ H1: 0, H2: 0, H3: 0 });
    const small = simulatePower([{ mean: 20, theta: 50 }], { tasks: 2, replicates: 3, k: 4 }, 0.1, 'shared', 50, createRng(3));
    expect(small.power).toEqual({ H1: 0, H2: 0, H3: 0 });
  });

  it('size under the null stays at or below α', () => {
    const r = simulatePower([{ mean: 5, theta: 5 }], { tasks: 6, replicates: 4, k: 4 }, 1, 'independent', 400, createRng(4), 999);
    for (const h of ['H1', 'H2', 'H3'] as const) expect(r.power[h]).toBeLessThan(0.05 + 3 * Math.sqrt(0.05 * 0.95 / 400));
  });

  it('power rises with blocks and effect size, and the shared frailty helps pairing', () => {
    const p = (tasks: number, reps: number, rr: number, corr: 'independent' | 'shared') =>
      simulatePower([{ mean: 5, theta: 5 }], { tasks, replicates: reps, k: 4 }, rr, corr, 300, createRng(9), 999).power.H2;
    expect(p(6, 4, 0.25, 'independent')).toBeGreaterThan(p(2, 4, 0.25, 'independent'));
    expect(p(6, 4, 0.25, 'independent')).toBeGreaterThan(p(6, 4, 0.75, 'independent'));
    expect(p(4, 3, 0.5, 'shared')).toBeGreaterThan(p(4, 3, 0.5, 'independent'));
    expect(p(6, 4, 0.25, 'independent')).toBeGreaterThan(0.8);
  });

  it('smallestGrid picks the fewest step turns that reach the target, or null', () => {
    const row = (tasks: number, replicates: number, k: number, h2: number): SweepRow => ({
      scenario: 's', corr: 'independent', tasks, replicates, k, rr: 0.5, blocks: tasks * replicates,
      stepTurns: stepTurnsOf({ tasks, replicates, k }), exact: true, minP: 0, power: { H1: 0, H2: h2, H3: 0 }, all: 0,
    });
    const rows = [row(6, 4, 4, 0.95), row(4, 3, 4, 0.81), row(4, 3, 6, 0.9), row(2, 4, 4, 0.5)];
    expect(smallestGrid(rows, (r) => r.power.H2)).toMatchObject({ tasks: 4, replicates: 3, k: 4 });
    expect(smallestGrid(rows, (r) => r.power.H3)).toBeNull();
  });

  it('the flip count is the registered 99,999', () => {
    expect(FLIPS).toBe(99_999);
  });
});
