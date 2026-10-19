/** T-PLAN (design DR-1 to DR-4; A1 DR-A1-6): counts, variants, seeded order, lanes, pilot cells, determinism. */
import { countSessions, planSessions, serialisePlan, sessionsOfBlocks } from '../../../../../scripts/v1.3/lib/eff01/plan.js';
import type { Eff01Plan } from '../../../../../scripts/v1.3/lib/eff01/plan.js';
import { EFF01_SEED } from '../../../../../scripts/v1.3/lib/eff01/types.js';
import { inputs } from './helpers.js';

const ins = inputs();

function plan(opts: { runs?: number; withN?: boolean; seed?: number } = {}): Eff01Plan {
  const r = planSessions({ inputs: ins, ...opts });
  if (!r.success) throw new Error(r.errors[0]?.message);
  return r.data;
}

const facts = { model: 'm', cliVersion: '2.1.301', caps: { turns: 30 }, hashes: { questions: 'q' }, treeFingerprints: { a: 'f' }, stripSpecComments: false, dryRun: true };

describe('EFF-01 plan (T-PLAN)', () => {
  it('plans 2 / 8 / 120 / 20 = 150 sessions (unchanged by A1)', () => {
    expect(countSessions(plan())).toEqual({ calibration: 2, pilot: 8, main: 120, n: 20, total: 150 });
  });

  it('has the 90 and 50 variants', () => {
    expect(countSessions(plan({ runs: 2, withN: false })).total).toBe(90);
    expect(countSessions(plan({ runs: 1, withN: false })).total).toBe(50);
  });

  it('names sessions per DR-1 and runs calibration on R and G of ddd-forum', () => {
    const p = plan();
    expect(sessionsOfBlocks(p, ['calibration']).map((s) => s.sessionId)).toEqual(['calibration/ddd-forum/calib/R/run-1', 'calibration/ddd-forum/calib/G/run-1']);
    const ids = new Set(p.sessions.map((s) => s.sessionId));
    expect(ids.size).toBe(150);
    expect(ids.has('main/event-sourcing-ddd/ES-Q03/G/run-3')).toBe(true);
    expect(ids.has('n/ddd-forum/DF-Q10/N/run-1')).toBe(true);
  });

  it('pilot cells are exactly ES-Q02, DF-Q02, ES-Q06 and DF-Q06 × {R, G}, on lane 0, after calibration', () => {
    const p = plan();
    const pilot = sessionsOfBlocks(p, ['pilot']);
    expect(pilot.map((s) => `${s.questionId ?? ''}/${s.condition}`)).toEqual([
      'ES-Q02/R', 'ES-Q02/G', 'DF-Q02/R', 'DF-Q02/G', 'ES-Q06/R', 'ES-Q06/G', 'DF-Q06/R', 'DF-Q06/G',
    ]);
    expect([...sessionsOfBlocks(p, ['calibration']), ...pilot].every((s) => s.lane === 0)).toBe(true);
    const blocks: string[] = [];
    for (const [b, k] of [['calibration', 2], ['pilot', 8], ['main', 120], ['n', 20]] as const) for (let i = 0; i < k; i++) blocks.push(b);
    expect(p.sessions.map((s) => s.block)).toEqual(blocks);
    expect(p.sessions.map((s) => s.orderIndex)).toEqual(p.sessions.map((_, i) => i));
  });

  it('gives the same order and bytes for the same seed, and another order for another seed', () => {
    expect(serialisePlan(plan(), facts)).toBe(serialisePlan(plan(), facts));
    expect(plan({ seed: EFF01_SEED + 7 }).sessions.map((s) => s.sessionId)).not.toEqual(plan().sessions.map((s) => s.sessionId));
  });

  it('interleaves the conditions and does not keep the runs of a cell together', () => {
    const main = sessionsOfBlocks(plan(), ['main']);
    let switches = 0;
    for (let i = 1; i < main.length; i++) if (main[i]?.condition !== main[i - 1]?.condition) switches++;
    expect(switches).toBeGreaterThan(40);
    const pos = new Map<string, number[]>();
    main.forEach((s, i) => {
      const cell = s.sessionId.replace(/\/run-\d+$/, '');
      pos.set(cell, [...(pos.get(cell) ?? []), i]);
    });
    const adjacent = [...pos.values()].filter((xs) => xs[2] !== undefined && xs[0] !== undefined && xs[2] - xs[0] === 2).length;
    expect(pos.size).toBe(40);
    expect(adjacent).toBeLessThan(4);
  });

  it('deals balanced lanes overall and per condition, for the default seed and 50 others', () => {
    for (const seed of [EFF01_SEED, ...Array.from({ length: 50 }, (_, i) => 1000 + i * 7919)]) {
      const p = plan({ seed });
      for (const block of ['main', 'n'] as const) {
        const list = sessionsOfBlocks(p, [block]);
        const lane0 = list.filter((s) => s.lane === 0).length;
        expect(Math.abs(list.length - 2 * lane0)).toBeLessThanOrEqual(1);
        for (const c of ['R', 'G', 'N'] as const) {
          const of = list.filter((s) => s.condition === c);
          const l0 = of.filter((s) => s.lane === 0).length;
          expect(Math.abs(of.length - 2 * l0)).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('keeps per-invocation facts out of plan.json', () => {
    const text = serialisePlan(plan(), facts);
    for (const k of ['startedAt', 'commit', 'cliVersionStart', 'lanes']) expect(text).not.toContain(`"${k}"`);
  });

  it('refuses an unknown calibration repo and a run count outside 1 to 3', () => {
    expect(planSessions({ inputs: ins, calibrationRepo: 'nope' }).success).toBe(false);
    expect(planSessions({ inputs: ins, runs: 4 }).success).toBe(false);
  });
});
