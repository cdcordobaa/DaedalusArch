import { dropNoTrap } from '../../../../scripts/v1.5/lib/final-study-analyse';
import { loadStudySet } from '../../../../experiments/v15-study/lib/study-set';
import { D9, HX_PRIMARY_TASKS, analyseHx, d9Rule, decideHx, dropTasksWithoutTrap, hxBlocks, jointReading, jointTable, plantedHx, semSecondary, sizeFromPilot, type HxCell } from '../../../../scripts/v1.5/lib/hx-study-analyse';
import * as path from 'node:path';

const cell = (task: string, rep: number, arm: 'none' | 'combined', D: number | null, Dsem = 0): HxCell => ({ task, style: 'hexagonal', rep, arm, D, trapFailed: D !== null && D > 0, accepted: true, Dsem });
const C = [...Array.from({ length: 8 }, () => 0.58), ...Array.from({ length: 5 }, () => 0)];

describe('v1.5 Hexagonal study analysis (draft registration)', () => {
  it('supports a planted RR 0.25 and does not support the null (13 tasks, r = 8)', () => {
    const eff = decideHx(analyseHx(hxBlocks(plantedHx({ pTrap: C, reps: 8, keep: 0.25, ids: 2 })), { draws: 999, resamples: 200 }));
    expect(eff.supported).toBe(true);
    const nul = decideHx(analyseHx(hxBlocks(plantedHx({ pTrap: C, reps: 8, keep: 1, ids: 2, seed: 20261031 })), { draws: 999, resamples: 200 }));
    expect(nul.supported).toBe(false);
  });

  it('needs at least 6 tasks with a nonzero sum for the task-level check', () => {
    const cells: HxCell[] = [];
    for (let t = 0; t < 5; t++) for (let r = 1; r <= 6; r++) { cells.push(cell(`t${String(t)}`, r, 'none', 1)); cells.push(cell(`t${String(t)}`, r, 'combined', 0)); }
    const d = decideHx(analyseHx(hxBlocks(cells), { draws: 99, resamples: 50 }));
    expect(d.reject).toBe(true);
    expect(d.taskCheck).toBe(false);
    expect(d.reading).toContain('carried by a subset of tasks');
  });

  it('reads a rejection against the predicted sign as such', () => {
    const cells: HxCell[] = [];
    for (let t = 0; t < 10; t++) { cells.push(cell(`t${String(t)}`, 1, 'none', 0)); cells.push(cell(`t${String(t)}`, 1, 'combined', 2)); }
    expect(decideHx(analyseHx(hxBlocks(cells), { draws: 99, resamples: 50 })).reading).toBe('rejected against the predicted direction');
  });

  it('keeps R-MIRROR-SEM out of the primary and scores it apart', () => {
    const cells = [cell('a', 1, 'none', 0, 3), cell('a', 1, 'combined', 0, 0)];
    expect(analyseHx(hxBlocks(cells), { draws: 9, intervals: false }).T).toBe(0);
    expect(semSecondary(cells).T).toBe(-3);
  });
});

describe('joint reading (evasion guard)', () => {
  it('qualifies "supported" when the trap rate does not move with D, and tabulates (D fell, trap persisted)', () => {
    const cells: HxCell[] = [];
    // D falls in every block, but the combined cell still fails its trap (the agent hid the finding, not the trap)
    for (let t = 0; t < 8; t++) for (let r = 1; r <= 2; r++) {
      cells.push({ ...cell(`t${String(t)}`, r, 'none', 2), trapFailed: true });
      cells.push({ ...cell(`t${String(t)}`, r, 'combined', 0), trapFailed: true });
    }
    const bs = hxBlocks(cells);
    const d = decideHx(analyseHx(bs, { draws: 99, resamples: 50 }));
    expect(d.supported).toBe(true);
    expect(jointReading(d, { positive: 0, negative: 0, p: 1 }).reading).toBe('supported, qualified: rule findings reduced, trap rate not');
    expect(jointReading(d, { positive: 0, negative: 9, p: 0.004 }).reading).toBe('supported');
    expect(jointTable(bs)).toMatchObject({ dFellTrapPersisted: 16, dFellTrapGone: 0, dNotFellTrapPersisted: 0, dNotFellTrapGone: 0 });
  });
});

describe('trap sensitivity under the null', () => {
  it('the symmetric task-level drop keeps the false-support rate low; the one-arm block drop does not', () => {
    let sym = 0; let oneArm = 0;
    for (let i = 0; i < 100; i++) {
      const bs = hxBlocks(plantedHx({ pTrap: C, reps: 8, keep: 1, ids: 2, seed: 7000 + i }));
      if (decideHx(analyseHx(dropTasksWithoutTrap(bs), { draws: 0, intervals: false })).supported) sym += 1;
      if (decideHx(analyseHx(dropNoTrap(bs), { draws: 0, intervals: false })).supported) oneArm += 1;
    }
    expect(sym).toBeLessThanOrEqual(5);
    expect(oneArm).toBeGreaterThan(50);
  });
});

describe('§3 re-size rule from the pilot', () => {
  it('gives Jeffreys rates per task and picks the largest r when the target is not reached', () => {
    const none: HxCell[] = [];
    for (let t = 0; t < 13; t++) for (let r = 1; r <= 2; r++) none.push(cell(`t${String(t).padStart(2, '0')}`, r, 'none', t < 2 && r === 1 ? 1 : 0));
    const s = sizeFromPilot(none, { draws: 50 });
    expect(s.pTrap[0]).toBeCloseTo(0.5);
    expect(s.pTrap[12]).toBeCloseTo(0.5 / 3);
    expect(s.ids).toBe(1);
    expect([6, 8, 10]).toContain(s.r);
    if (!s.reached) expect(s.r).toBe(10);
  });
});

describe('B11: the study set is the 11 tasks', () => {
  it('the analysis task list agrees with the study set', () => {
    const set = loadStudySet(path.resolve(__dirname, '../../../..'), 'experiments/hx-study-set/study-set.json');
    expect([...HX_PRIMARY_TASKS]).toEqual([...set.confirmatory.hexagonal]);
    expect(HX_PRIMARY_TASKS).toHaveLength(11);
  });
});

describe('D9: the registered r rule', () => {
  it('pins the rule and gives r = 10 (power at r = 8 below 0.80)', () => {
    expect(D9).toEqual({ tasks: 11, pTrap: 0.31, detect: 14 / 19, keep: 0.25, ids: 1, draws: 400, base: 8, fallback: 10, target: 0.8 });
    const d = d9Rule();
    expect(d.powerAtBase).toBeCloseTo(0.645, 3);
    expect(d.powerAtFallback).toBeCloseTo(0.765, 3);
    expect(d.r).toBe(10);
  });
});
