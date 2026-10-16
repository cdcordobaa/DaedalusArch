/**
 * Judge selective prediction (development set; no LLM call): the Wilson interval, agreement grouping, correctness,
 * the pre-stated decision rule, the agent view and the cassette fingerprint.
 */
import { wilson } from '../../../../scripts/lib/stats.js';
import { DECISION, cellOf, classify, decide, fingerprintMatches, isCorrect, per10 } from '../../../../scripts/v1.3/judge-selective.js';
import type { Row } from '../../../../scripts/v1.3/judge-selective.js';

const row = (kind: Row['kind'], votes: boolean[]): Row => ({ judge: 'v1', itemId: 'x', split: 'CHECK', kind, operatorId: '', source: 'h', votes });

describe('Wilson 95% interval', () => {
  it('matches known values', () => {
    const w = wilson(16, 21);
    expect(w.low).toBeCloseTo(0.5491, 3);
    expect(w.high).toBeCloseTo(0.8933, 3);
    expect(wilson(14, 14).low).toBeCloseTo(0.7847, 3);
    expect(wilson(0, 10).low).toBe(0);
  });
});

describe('classify', () => {
  it('groups three valid runs into unanimous or split', () => {
    expect(classify([false, false, false])).toEqual({ validRuns: 3, fails: 3, verdict: 'fail', agreement: 'unanimous' });
    expect(classify([true, true, true]).agreement).toBe('unanimous');
    expect(classify([true, false, false])).toEqual({ validRuns: 3, fails: 2, verdict: 'fail', agreement: 'split' });
    expect(classify([true, true, false])).toMatchObject({ verdict: 'pass', agreement: 'split' });
  });
  it('marks fewer than three valid runs incomplete and a tie as no verdict', () => {
    expect(classify([true, false])).toMatchObject({ verdict: 'none', agreement: 'incomplete' });
    expect(classify([])).toMatchObject({ verdict: 'none', agreement: 'incomplete' });
  });
});

describe('isCorrect', () => {
  it('seed should fail, twin and clean should pass', () => {
    expect(isCorrect('seed', 'fail')).toBe(true);
    expect(isCorrect('seed', 'pass')).toBe(false);
    expect(isCorrect('twin', 'pass')).toBe(true);
    expect(isCorrect('clean', 'fail')).toBe(false);
    expect(isCorrect('clean', 'none')).toBe(false);
  });
});

describe('cellOf and decide', () => {
  const F = false; const P = true;
  it('counts unanimous and split accuracy and coverage', () => {
    const c = cellOf([row('seed', [F, F, F]), row('seed', [P, F, F]), row('clean', [P, P, P]), row('clean', [P, F, F]), row('twin', [P, P])]);
    expect(c).toEqual({ n: 4, incomplete: 1, unanimous: 2, unanimousCorrect: 2, splitN: 2, splitCorrect: 1, fail: 3, unanimousFail: 1 });
  });
  it('applies the pre-stated rule (accuracy, Wilson lower bound, coverage)', () => {
    expect(DECISION).toEqual({ minAccuracy: 0.9, minWilsonLow: 0.8, minCoverage: 0.6, split: 'CHECK' });
    // 40/40 unanimous correct, 10 split: coverage 0.8, Wilson low 0.912 → met.
    const ok = [...Array(40).fill(0).map(() => row('clean', [P, P, P])), ...Array(10).fill(0).map(() => row('clean', [P, P, F]))];
    expect(decide(cellOf(ok)).passed).toBe(true);
    // 10/10 correct: accuracy 1.0 but Wilson low 0.72 < 0.8 → not met.
    expect(decide(cellOf(Array(10).fill(0).map(() => row('seed', [F, F, F])))).passed).toBe(false);
    // 40/40 correct but coverage 40/80 = 0.5 → not met.
    const lowCov = [...ok.slice(0, 40), ...Array(40).fill(0).map(() => row('clean', [P, P, F]))];
    expect(decide(cellOf(lowCov))).toMatchObject({ coverage: 0.5, passed: false });
    expect(decide(cellOf([]))).toEqual({ accuracy: null, wilsonLow: null, coverage: null, passed: false });
  });
  it('gives the agent view per 10 units', () => {
    const c = cellOf([row('clean', [F, F, F]), row('clean', [P, F, F]), row('clean', [P, P, P]), row('clean', [P, P, P])]);
    expect(per10(c)).toEqual({ all: 5, unanimousOnly: 2.5 });
    expect(per10(cellOf([]))).toBeNull();
  });
});

describe('fingerprintMatches', () => {
  const run = (i: number, pass: boolean, confidence: number, unitId = 'src/a.ts') => ({
    requestHash: 'h', functionId: 'FF-N02', unitId, runIndex: i, outcome: { kind: 'valid' }, parsedVerdict: { pass, confidence },
  });
  const runs = [run(0, true, 0.65), run(1, true, 0.6), run(2, false, 0.6)];
  const unit = { unitId: 'src/a.ts', filePaths: ['src/a.ts'], verdict: 'pass', confidence: 0.625, confidenceStdDev: 0.023570226039551608, validRunCount: 3 };
  it('matches on the majority runs’ mean confidence and the std dev of all runs', () => {
    expect(fingerprintMatches(unit, 'FF-N02', runs)).toBe(true);
  });
  it('rejects another verdict, function, unit or confidence', () => {
    expect(fingerprintMatches({ ...unit, verdict: 'fail' }, 'FF-N02', runs)).toBe(false);
    expect(fingerprintMatches(unit, 'FF-N01', runs)).toBe(false);
    expect(fingerprintMatches({ ...unit, unitId: 'src/b.ts', filePaths: ['src/b.ts'] }, 'FF-N02', runs)).toBe(false);
    expect(fingerprintMatches({ ...unit, confidence: 0.6167 }, 'FF-N02', runs)).toBe(false);
  });
  it('matches a module unit through its id', () => {
    const m = [run(0, false, 0.8, 'src/application'), run(1, false, 0.8, 'src/application'), run(2, false, 0.8, 'src/application')];
    expect(fingerprintMatches({ unitId: 'src/application', filePaths: ['src/application/x.ts'], verdict: 'fail', confidence: 0.8000000000000002, confidenceStdDev: 1.1e-16, validRunCount: 3 }, 'FF-N02', m)).toBe(true);
  });
});
