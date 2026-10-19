/**
 * Drift outcome of the Study 2 power simulation (s2d-01 §3; drift record §4): D from new identities per step, the
 * three-cell model, Holm over two (size at RR 1), step turns, the Student t lower bound and the pilot mode. The level
 * path is pinned by `level-power-sim.test.ts`, which this change leaves untouched.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRng } from '../../../../scripts/lib/stats.js';
import {
  CELLS_DRIFT, DRIFT_DATA, HYPOTHESES, HYPOTHESES_DRIFT, STYLE_DATA, blocksOfDrift, cellMeansDrift, driftAtStep, driftParams,
  lateIncrement, lateNewIncrement, meanLowerBound, parseThetaBand, pilotPower, renderPilotReport, simulateDriftPower,
  stepTurnsOfDrift, studentTCdf, studentTQuantile, validatePilot,
} from '../../../../scripts/v1.3/lib/level-power-sim.js';

const FIXTURE = path.resolve(__dirname, '../../../fixtures/v1.4-drift-pilot/synthetic-pilot.json');

describe('drift data and D', () => {
  it('probe 1: D at k = 5 is 1, 2, 5 (mean 2.67, variance 4.33, θ 4.27)', () => {
    const p = driftParams(DRIFT_DATA, 5, 'locf');
    expect(p.fit.values).toEqual([1, 2, 5]);
    expect(p.fit.mean).toBeCloseTo(8 / 3, 10);
    expect(p.fit.variance).toBeCloseTo(13 / 3, 10);
    expect(p.fit.theta).toBeCloseTo(64 / 15, 10);
    expect(p.fit.theta.toFixed(2)).toBe('4.27');
  });

  it('the linear k = 5 sensitivity gives market-vendors +0.375 and mean 2.79', () => {
    expect(lateNewIncrement(DRIFT_DATA.runs)).toBeCloseTo(0.375, 10);
    const p = driftParams(DRIFT_DATA, 5, 'linear');
    expect(p.fit.values[0]).toBeCloseTo(1.375, 10);
    expect(p.fit.mean.toFixed(2)).toBe('2.79');
  });

  it('newPerStep agrees with the level increments (probe 1 removed nothing) and step 1 never counts', () => {
    const level = STYLE_DATA.find((s) => s.id === 'layered-measured');
    if (level === undefined) throw new Error('no level data');
    DRIFT_DATA.runs.forEach((r, i) => {
      const e = level.runs[i]?.edgesPerStep ?? [];
      expect(r.edgesPerStep).toEqual(e);
      expect(r.newPerStep).toEqual(e.map((v, s) => (s === 0 ? v : v - (e[s - 1] ?? 0))));
    });
    expect(lateNewIncrement(DRIFT_DATA.runs)).toBeCloseTo(lateIncrement(level.runs), 10);
    const run = DRIFT_DATA.runs[2];
    if (run === undefined) throw new Error('no run');
    expect(driftAtStep(run, 1, 'locf', 0)).toBe(0);
    expect(driftAtStep(run, 2, 'locf', 0)).toBe(3);
    expect(driftAtStep(run, 9, 'locf', 0)).toBe(5);
    expect(() => driftAtStep({ task: 'x', edgesPerStep: [1] }, 3, 'locf', 0)).toThrow(/newPerStep/);
  });
});

describe('drift cells, grid and turns', () => {
  it('three cells, two hypotheses, means μ / μ·RR', () => {
    expect([...CELLS_DRIFT]).toEqual(['noneL2', 'noneL3', 'mcpL2']);
    expect(HYPOTHESES_DRIFT.map((h) => `${h.id}:${h.a}-${h.b}`)).toEqual(['H1:noneL2-noneL3', 'H2:noneL2-mcpL2']);
    expect(cellMeansDrift(4, 0.25)).toEqual({ noneL2: 4, noneL3: 1, mcpL2: 1 });
    // the level outcome keeps its three hypotheses
    expect(HYPOTHESES.map((h) => h.id)).toEqual(['H1', 'H2', 'H3']);
  });

  it('blocks = tasks × replicates × generators; step turns = blocks × (1 + 3(k − 1)) (s2d-01 §7: 416 for 32 blocks)', () => {
    const g = { tasks: 4, replicates: 4, generators: 2, k: 5 };
    expect(blocksOfDrift(g)).toBe(32);
    expect(stepTurnsOfDrift(g)).toBe(416);
    expect(stepTurnsOfDrift({ ...g, generators: 1 })).toBe(208);
  });

  it('size at RR 1: Holm over two keeps each rejection rate and the family-wise rate at ≤ 0.05 (+ MC tolerance)', () => {
    for (const corr of ['independent', 'shared'] as const) {
      const sims = 3000;
      const r = simulateDriftPower([{ mean: 8 / 3, theta: 64 / 15 }], { tasks: 4, replicates: 4, generators: 2, k: 5 }, 1, corr, sims, createRng(7));
      const tol = 3 * Math.sqrt((0.05 * 0.95) / sims);
      expect(r.power.H1).toBeLessThanOrEqual(0.05 + tol);
      expect(r.power.H2).toBeLessThanOrEqual(0.05 + tol);
      expect(r.all).toBeLessThanOrEqual(r.power.H1);
    }
  });

  it('power rises as RR falls, and is deterministic per seed', () => {
    const g = { tasks: 4, replicates: 4, generators: 2, k: 5 };
    const s = [{ mean: 8 / 3, theta: 64 / 15 }];
    const a = simulateDriftPower(s, g, 0.25, 'independent', 300, createRng(1));
    const b = simulateDriftPower(s, g, 0.75, 'independent', 300, createRng(1));
    expect(a.power.H1).toBeGreaterThan(b.power.H1);
    expect(simulateDriftPower(s, g, 0.5, 'shared', 200, createRng(3))).toEqual(simulateDriftPower(s, g, 0.5, 'shared', 200, createRng(3)));
  });

  it('per-generator inputs: zero-mean generators give zero power', () => {
    const g = { tasks: 2, replicates: 3, generators: 2, k: 5 };
    const r = simulateDriftPower([{ mean: 0, theta: 4 }, { mean: 0, theta: 4 }], g, 0.25, 'independent', 50, createRng(5));
    expect(r.power).toEqual({ H1: 0, H2: 0 });
  });
});

describe('Student t and the pilot lower bound (drift record §4)', () => {
  it('quantiles match tables', () => {
    expect(studentTQuantile(0.8, 5)).toBeCloseTo(0.9195, 4);
    expect(studentTQuantile(0.975, 10)).toBeCloseTo(2.2281, 4);
    expect(studentTQuantile(0.95, 1)).toBeCloseTo(6.3138, 3);
    expect(studentTQuantile(0.9, 1000)).toBeCloseTo(1.2824, 3);
    expect(studentTQuantile(0.2, 5)).toBeCloseTo(-0.9195, 4);
    expect(studentTCdf(0, 7)).toBeCloseTo(0.5, 12);
  });

  it('the bound is mean − t·s/√n, floored at 0', () => {
    const b = meanLowerBound([1, 2, 3, 0, 2, 4], 0.8);
    const sd = Math.sqrt(2);
    expect(b.mean).toBe(2);
    expect(b.sd).toBeCloseTo(sd, 10);
    expect(b.lowerBound).toBeCloseTo(2 - (0.919544 * sd) / Math.sqrt(6), 4);
    expect(meanLowerBound([0, 0, 5], 0.95).lowerBound).toBe(0);
    expect(meanLowerBound([2, 2], 0.8).lowerBound).toBe(2);
    expect(() => meanLowerBound([1], 0.8)).toThrow();
  });

  it('θ band and pilot file validation', () => {
    expect(parseThetaBand('1, 4,inf')).toEqual([1, 4, Number.POSITIVE_INFINITY]);
    expect(() => parseThetaBand('0,4')).toThrow();
    expect(() => validatePilot({ generators: { a: [1] } })).toThrow();
    expect(() => validatePilot({ generators: { a: [1, 1.5] } })).toThrow();
    expect(() => validatePilot({})).toThrow();
  });

  it('pilot mode: 32 blocks, every θ × both models × three RRs, and a verdict per hypothesis', () => {
    const pilot = validatePilot(JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as unknown);
    const rep = pilotPower(pilot, 0.8, [1, 4, Number.POSITIVE_INFINITY], 100, 11);
    expect(rep.grid).toEqual({ tasks: 4, replicates: 4, generators: 2, k: 5 });
    expect(rep.rows).toHaveLength(3 * 2 * 3);
    expect(rep.rows.every((r) => r.blocks === 32)).toBe(true);
    expect(Object.keys(rep.bounds)).toEqual(['sonnet', 'gemini']);
    expect(rep.bounds.sonnet?.lowerBound).toBeLessThan(rep.bounds.sonnet?.mean ?? 0);
    for (const h of ['H1', 'H2'] as const) {
      expect(rep.verdict[h].perTheta.map((x) => x.theta)).toEqual([1, 4, Number.POSITIVE_INFINITY]);
      expect(rep.verdict[h].keep).toBe(rep.verdict[h].perTheta.every((x) => x.power >= 0.8));
    }
    expect(renderPilotReport(rep)).toMatch(/H1 .* → \*\*(keep as confirmatory|demote to secondary)\*\*/);
  });
});
