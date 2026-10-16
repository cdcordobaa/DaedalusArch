/**
 * Study 2 power simulation (an informal design aid, not a pre-registration): variates, the slope, the sign-flip test,
 * Holm, the simulated study's shape, and power's direction under the null and a large effect.
 */
import { createRng } from '../../../../scripts/lib/stats.js';
import {
  DEFAULT_ASSUMPTIONS, DESIGN_OPTIONS, count, gamma, holmReject, olsSlope, poisson, power, powerGrid, renderPowerMarkdown,
  signFlipP, simulateStudy,
} from '../../../../scripts/v1.3/lib/study2-power.js';
import type { DesignOption } from '../../../../scripts/v1.3/lib/study2-power.js';

const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const variance = (xs: readonly number[]): number => {
  const m = mean(xs);
  return xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
};

describe('random variates', () => {
  it('Poisson, gamma and negative binomial have their means and variances', () => {
    const rng = createRng(1);
    const p = Array.from({ length: 20_000 }, () => poisson(rng, 3));
    expect(mean(p)).toBeCloseTo(3, 1);
    expect(variance(p)).toBeCloseTo(3, 0);
    const g = Array.from({ length: 20_000 }, () => gamma(rng, 2));
    expect(mean(g)).toBeCloseTo(2, 1);
    expect(mean(Array.from({ length: 20_000 }, () => gamma(rng, 0.5)))).toBeCloseTo(0.5, 1);
    const nb = Array.from({ length: 40_000 }, () => count(rng, 4, 2));
    expect(mean(nb)).toBeCloseTo(4, 1);
    expect(variance(nb)).toBeGreaterThan(4 + 16 / 2 - 1.5);
    expect(variance(nb)).toBeLessThan(4 + 16 / 2 + 1.5);
    expect(poisson(rng, 0)).toBe(0);
    expect(poisson(rng, 1000)).toBeGreaterThan(800);
  });
});

describe('the analysis', () => {
  it('olsSlope is the least-squares slope on 1..k', () => {
    expect(olsSlope([1, 2, 3, 4])).toBeCloseTo(1);
    expect(olsSlope([5, 5, 5])).toBe(0);
    expect(olsSlope([0, 2, 1, 5])).toBeCloseTo(1.4);
  });

  it('signFlipP is exact for small n: six agreeing tasks give 2/64', () => {
    const rng = createRng(2);
    expect(signFlipP([1, 2, 3, 4, 5, 6], 999, rng)).toBeCloseTo(2 / 64);
    expect(signFlipP([1, -1], 999, rng)).toBe(1);
    expect(signFlipP([], 999, rng)).toBe(1);
    // Monte Carlo for n > 14: a strong shift is rejected, a symmetric sample is not.
    const big = Array.from({ length: 40 }, (_, i) => 1 + (i % 3));
    expect(signFlipP(big, 999, rng)).toBeLessThan(0.01);
    const sym = Array.from({ length: 40 }, (_, i) => (i % 2 === 0 ? 1 : -1));
    expect(signFlipP(sym, 999, rng)).toBeGreaterThan(0.5);
  });

  it('holmReject steps down', () => {
    expect(holmReject([0.01, 0.04])).toEqual([true, true]);
    expect(holmReject([0.03, 0.04])).toEqual([false, false]);
    expect(holmReject([0.04, 0.02])).toEqual([true, true]);
    expect(holmReject([0.02, 0.06])).toEqual([true, false]);
  });
});

describe('simulation', () => {
  const small: DesignOption = { name: 'test', tasks: 4, models: 2, replicates: 2, steps: 5 };

  it('gives one difference pair per block, deterministically by seed', () => {
    const a = simulateStudy(small, DEFAULT_ASSUMPTIONS, 'blocking', createRng(3));
    expect(a).toHaveLength(16);
    expect(new Set(a.map((d) => d.task))).toEqual(new Set([0, 1, 2, 3]));
    expect(simulateStudy(small, DEFAULT_ASSUMPTIONS, 'blocking', createRng(3))).toEqual(a);
    expect(simulateStudy(small, DEFAULT_ASSUMPTIONS, 'advisory-per-kloc', createRng(3))).toHaveLength(16);
  });

  it('a large effect on Poisson counts is found; no effect is rejected at about the nominal rate', () => {
    const design = DESIGN_OPTIONS.find((d) => d.name.startsWith('B'));
    if (design === undefined) throw new Error('no design B');
    const strong = power(design, { ...DEFAULT_ASSUMPTIONS, dispersion: null, sdEffectTask: 0, effects: { gate: 0.8, mcp: 0.8 } }, 'blocking', 'block', { sims: 40, flips: 199, seed: 4 });
    expect(strong.powerGate).toBeGreaterThan(0.9);
    expect(strong.blocks).toBe(54);
    expect(strong.runs).toBe(162);
    const none = power(design, { ...DEFAULT_ASSUMPTIONS, effects: { gate: 0, mcp: 0 } }, 'blocking', 'block', { sims: 60, flips: 199, seed: 5 });
    expect(none.powerAny).toBeLessThan(0.2);
  });

  it('a task-level test over six tasks can never reject at Holm\'s first step', () => {
    const six: DesignOption = { name: 'six', tasks: 6, models: 1, replicates: 1, steps: 5 };
    const t = power(six, { ...DEFAULT_ASSUMPTIONS, dispersion: null, effects: { gate: 0.9, mcp: 0.9 } }, 'blocking', 'task', { sims: 30, flips: 99, seed: 6 });
    expect(t.minP).toBeCloseTo(2 / 64);
    expect(t.powerAny).toBe(0);
  });

  it('the grid covers every design, effect, outcome and analysis and renders the assumptions', () => {
    const g = powerGrid(DEFAULT_ASSUMPTIONS, { sims: 2, flips: 9, seed: 7 }, [small], [{ gate: 0.5, mcp: 0.25 }]);
    expect(g.cells).toHaveLength(4);
    expect(g.sensitivity).toHaveLength(9);
    expect(g.note).toMatch(/not a pre-registration/);
    const md = renderPowerMarkdown(powerGrid(DEFAULT_ASSUMPTIONS, { sims: 2, flips: 9, seed: 7 }, [{ ...small, name: 'B: test' }], [{ gate: 0.5, mcp: 0.25 }]));
    expect(md).toMatch(/^# Study 2 power simulation \(informal design aid, not a pre-registration\)/);
    expect(md).toContain('negative binomial, size θ = 2');
    expect(md).toContain('Sensitivity');
  });
});
