// BR-U4-AGG-01, 02, 04, 05, 07, 08, 09; VIO-01..04; VRD-04; BLM §8, §9; T11, T15 (U4 plan Step 17).
// No score assertion on neural dimensions (POL-03): result-level fields only.

import type { InvalidCause, NeuronalInstruction } from '../../../src/shared/types/evaluation.js';
import { functionId } from '../../../src/shared/types/value-objects.js';
import {
  voteUnit, aggregateUnitVerdicts, countInvalidByCause, dominantInvalidCause, functionFailureOf, formUnitViolations,
  listFunctionViolations, violationTypeOf, aggregationWarnings, populationStdDev,
} from '../../../src/llm-critic/aggregation.js';
import type { UnitRun, UnitVote, ViolationIdFn } from '../../../src/llm-critic/aggregation.js';
import type { CriticVerdict } from '../../../src/llm-critic/types.js';

const ROOT = '/work/proj';

function run(runIndex: number, pass: boolean, confidence: number, violations: { filePath: string; message: string }[] = []): UnitRun {
  const verdict: CriticVerdict = { pass, confidence, reasoning: 'r', evidence: [], violations };
  return { runIndex, outcome: { kind: 'valid' }, verdict };
}
function bad(runIndex: number, cause: InvalidCause): UnitRun {
  return { runIndex, outcome: { kind: 'invalid', cause }, verdict: null };
}
const F = (i: number, c = 0.8): UnitRun => run(i, false, c);
const P = (i: number, c = 0.8): UnitRun => run(i, true, c);

function unit(verdict: UnitVote['verdict'], confidence = 0.8, flaggedUnstable = false): UnitVote {
  return { status: 'valid', verdict, confidence, confidenceStdDev: 0, flaggedUnstable, validRunCount: 3, invalidRunCauses: [] };
}
function invalidUnit(causes: InvalidCause[]): UnitVote {
  return { status: 'invalid', verdict: 'warning', confidence: 0, confidenceStdDev: 0, flaggedUnstable: false, validRunCount: 3 - causes.length, invalidRunCauses: causes };
}

const INSTRUCTION: Pick<NeuronalInstruction, 'functionId' | 'name' | 'dimension' | 'severity' | 'source'> = {
  functionId: functionId('FF-N02'), name: 'intent-alignment', dimension: 'semantic', severity: 'major', source: 'fitness-function',
};
const stubId: ViolationIdFn = ({ functionId: f, filePath, discriminator }) => `${f}|${filePath}|${discriminator.join(',')}`;

describe('AGG-01 unit vote', () => {
  it('(F,F,P) → fail, confidence = mean of the two fails', () => {
    const vote = voteUnit([F(0, 0.9), F(1, 0.7), P(2, 0.2)]);
    expect(vote.status).toBe('valid');
    expect(vote.verdict).toBe('fail');
    expect(vote.confidence).toBeCloseTo(0.8, 12);
    expect(vote.validRunCount).toBe(3);
  });

  it('(F,P,invalid) → warning over both valid runs', () => {
    const vote = voteUnit([F(0, 0.9), P(1, 0.5), bad(2, 'TIMEOUT')]);
    expect(vote.verdict).toBe('warning');
    expect(vote.confidence).toBeCloseTo(0.7, 12);
    expect(vote.invalidRunCauses).toEqual(['TIMEOUT']);
  });

  it('(F,invalid,invalid) → invalid unit, confidence 0, causes in run order', () => {
    const vote = voteUnit([bad(2, 'PARSE_FAILURE'), F(0), bad(1, 'TIMEOUT')]);
    expect(vote).toMatchObject({ status: 'invalid', verdict: 'warning', confidence: 0, validRunCount: 1, invalidRunCauses: ['TIMEOUT', 'PARSE_FAILURE'] });
  });

  it('(P,P,P) → pass', () => {
    expect(voteUnit([P(0), P(1), P(2)]).verdict).toBe('pass');
  });

  it('confidences (0.9, 0.5, 0.9) → unstable (population stddev > 0.15)', () => {
    const vote = voteUnit([F(0, 0.9), F(1, 0.5), F(2, 0.9)]);
    expect(vote.confidenceStdDev).toBeCloseTo(populationStdDev([0.9, 0.5, 0.9]), 12);
    expect(vote.confidenceStdDev).toBeGreaterThan(0.15);
    expect(vote.flaggedUnstable).toBe(true);
    expect(voteUnit([F(0, 0.9), F(1, 0.85), F(2, 0.8)]).flaggedUnstable).toBe(false);
  });
});

describe('AGG-02 validity by cause', () => {
  it('two TIMEOUT and one PARSE_FAILURE units → counts by cause', () => {
    const counts = countInvalidByCause([
      invalidUnit(['TIMEOUT', 'TIMEOUT']), invalidUnit(['TIMEOUT', 'PARSE_FAILURE', 'TIMEOUT']), invalidUnit(['PARSE_FAILURE', 'PARSE_FAILURE']),
      unit('fail'),
    ]);
    expect(counts).toEqual({
      PARSE_FAILURE: 1, MISSING_CONFIDENCE: 0, MODEL_MISMATCH: 0, TIMEOUT: 2, BAD_ENVELOPE: 0, CLI_EXIT: 0, INSUFFICIENT_VALID_RUNS: 0,
    });
  });

  it('dominant cause ties follow the InvalidCause order; no invalid run → INSUFFICIENT_VALID_RUNS', () => {
    expect(dominantInvalidCause(['TIMEOUT', 'PARSE_FAILURE'])).toBe('PARSE_FAILURE');
    expect(dominantInvalidCause(['CLI_EXIT', 'MODEL_MISMATCH', 'CLI_EXIT'])).toBe('CLI_EXIT');
    expect(dominantInvalidCause([])).toBe('INSUFFICIENT_VALID_RUNS');
  });
});

describe('AGG-04 function verdict', () => {
  const units = (fails: number, passes: number): UnitVote[] => [
    ...Array.from({ length: fails }, () => unit('fail', 0.9)), ...Array.from({ length: passes }, () => unit('pass', 0.6)),
  ];

  it('3 of 5 fail → fail; 2 of 5 → warning; 0 of 5 → pass; rule name set', () => {
    const three = aggregateUnitVerdicts(units(3, 2));
    const two = aggregateUnitVerdicts(units(2, 3));
    const zero = aggregateUnitVerdicts(units(0, 5));
    expect(three).toMatchObject({ kind: 'result', verdict: 'fail', aggregationRule: 'majority-of-valid-units-v1' });
    expect(two).toMatchObject({ kind: 'result', verdict: 'warning', aggregationRule: 'majority-of-valid-units-v1' });
    expect(zero).toMatchObject({ kind: 'result', verdict: 'pass', aggregationRule: 'majority-of-valid-units-v1' });
  });

  it('with 3 of 5 failing, the passing units do not change confidence or flaggedUnstable (T11)', () => {
    const failing = [unit('fail', 0.9, true), unit('fail', 0.7, true), unit('fail', 0.8, false)];
    const a = aggregateUnitVerdicts([...failing, unit('pass', 0.1, true), unit('pass', 0.2, true)]);
    const b = aggregateUnitVerdicts([...failing, unit('pass', 0.99, false), unit('pass', 0.95, false)]);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    if (a.kind !== 'result') throw new Error('expected a result');
    expect(a.confidence).toBeCloseTo(0.8, 12);
    expect(a.flaggedUnstable).toBe(true);
  });

  it('a third passing unit (3 of 6 failing) turns the verdict to warning, never a lower-weight fail', () => {
    const r = aggregateUnitVerdicts(units(3, 3));
    expect(r).toMatchObject({ kind: 'result', verdict: 'warning' });
  });

  it('a warning unit alone makes the function a warning; carriers are all valid units', () => {
    const r = aggregateUnitVerdicts([unit('pass', 0.9), unit('warning', 0.5)]);
    expect(r).toMatchObject({ kind: 'result', verdict: 'warning' });
    if (r.kind === 'result') expect(r.confidence).toBeCloseTo(0.7, 12);
  });

  it('pass carriers are the passing units; instability needs strictly more than half', () => {
    const r = aggregateUnitVerdicts([unit('pass', 0.9, true), unit('pass', 0.7, false)]);
    expect(r).toMatchObject({ kind: 'result', verdict: 'pass', flaggedUnstable: false });
  });

  it('invalid units neither vote nor carry', () => {
    const r = aggregateUnitVerdicts([unit('fail', 0.9), unit('fail', 0.7), invalidUnit(['TIMEOUT', 'TIMEOUT'])]);
    expect(r).toMatchObject({ kind: 'result', verdict: 'fail' });
    if (r.kind === 'result') expect(r.confidence).toBeCloseTo(0.8, 12);
  });
});

describe('AGG-05 function failure', () => {
  it('1 valid of 3 selected → failure with a scrubbed message; 2 of 4 → result', () => {
    const r = aggregateUnitVerdicts([unit('fail'), invalidUnit(['TIMEOUT', 'TIMEOUT']), invalidUnit(['PARSE_FAILURE', 'PARSE_FAILURE'])]);
    expect(r).toMatchObject({ kind: 'failure', validUnits: 1, selectedUnits: 3 });
    if (r.kind !== 'failure') throw new Error('expected a failure');
    const failure = functionFailureOf(INSTRUCTION, r, ['sekret-value-123']);
    expect(failure).toEqual({
      functionId: INSTRUCTION.functionId, name: 'intent-alignment', code: 'INSUFFICIENT_VALID_RUNS',
      message: '1 of 3 selected units valid for intent-alignment (invalid units by cause: PARSE_FAILURE: 1, TIMEOUT: 1)',
    });
    const leaky = functionFailureOf({ ...INSTRUCTION, name: 'fn sekret-value-123' }, r, ['sekret-value-123']);
    expect(leaky.message).not.toContain('sekret-value-123');
    expect(aggregateUnitVerdicts([unit('fail'), unit('pass'), invalidUnit(['TIMEOUT']), invalidUnit(['TIMEOUT'])]).kind).toBe('result');
  });
});

describe('AGG-07, AGG-08, AGG-09', () => {
  it('verdict is one of pass, warning, fail for every aggregation (no score assertion, POL-03)', () => {
    for (const set of [[unit('fail')], [unit('pass')], [unit('warning')], [unit('fail'), unit('pass')]]) {
      const r = aggregateUnitVerdicts(set);
      if (r.kind === 'result') expect(['pass', 'warning', 'fail']).toContain(r.verdict);
    }
  });

  it('an all-pass Integrity function keeps its dimension (forming carries the instruction dimension)', () => {
    const integrity = { ...INSTRUCTION, dimension: 'integrity' as const };
    const formed = formUnitViolations({ id: 'src/m', filePaths: ['src/m/a.ts'] }, [P(0), P(1), P(2)], { status: 'valid', verdict: 'pass' }, integrity, ROOT, stubId);
    expect(formed.violations).toEqual([]);
    expect(aggregateUnitVerdicts([unit('pass')])).toMatchObject({ kind: 'result', verdict: 'pass' });
    expect(violationTypeOf(integrity)).toBe('INTEGRITY_VIOLATION');
  });

  it('zero selected units → no result and no failure', () => {
    expect(aggregateUnitVerdicts([])).toEqual({ kind: 'no-units' });
  });
});

describe('VRD-04 verdict consistency', () => {
  const u = { id: 'src/a.ts', filePaths: ['src/a.ts'] };
  it('a pass=true run with 2 violations forms none and counts one inconsistent run', () => {
    const runs = [run(0, true, 0.9, [{ filePath: 'src/a.ts', message: 'x' }, { filePath: 'src/a.ts', message: 'y' }]), P(1), P(2)];
    const vote = voteUnit(runs);
    const formed = formUnitViolations(u, runs, vote, INSTRUCTION, ROOT, stubId);
    expect(formed.violations).toEqual([]);
    expect(formed.inconsistentRuns).toBe(1);
    const warnings = aggregationWarnings('FF-N02', { inconsistentRuns: formed.inconsistentRuns, droppedPaths: 0 }, []);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ code: 'VERDICT_INCONSISTENT', context: { count: 1 } });
    expect(warnings[0]?.message).toContain('1 passing run(s)');
  });

  it('pass=false with violations: [] → the unit can fail and lists no violation', () => {
    const runs = [F(0), F(1), P(2)];
    const vote = voteUnit(runs);
    expect(vote.verdict).toBe('fail');
    expect(formUnitViolations(u, runs, vote, INSTRUCTION, ROOT, stubId).violations).toEqual([]);
  });
});

describe('VIO-01 granularity and message', () => {
  const u = { id: 'src/a.ts', filePaths: ['src/a.ts', 'src/b.ts'] };
  it('three fail runs citing src/a.ts in three wordings → one violation with the most confident message', () => {
    const runs = [
      run(0, false, 0.7, [{ filePath: 'src/a.ts', message: 'first' }]),
      run(1, false, 0.95, [{ filePath: './src/a.ts', message: 'second' }, { filePath: 'src/b.ts', message: 'only once' }]),
      run(2, false, 0.95, [{ filePath: 'src\\a.ts', message: 'third' }, { filePath: 'b.ts', message: 'basename' }]),
    ];
    const formed = formUnitViolations(u, runs, voteUnit(runs), INSTRUCTION, ROOT, stubId);
    expect(formed.violations).toHaveLength(1);
    expect(formed.violations[0]).toMatchObject({
      filePath: 'src/a.ts', message: 'second', route: 'neuronal', deterministic: false, dimension: 'semantic', severity: 'major',
      type: 'SEMANTIC_RULE_VIOLATION', id: 'FF-N02|src/a.ts|src/a.ts',
    });
    expect(formed.droppedPaths).toBe(1);
  });

  it('a path cited by exactly half of the valid runs is not formed (strict majority)', () => {
    const runs = [run(0, false, 0.9, [{ filePath: 'src/a.ts', message: 'm' }]), run(1, false, 0.9)];
    expect(formUnitViolations(u, runs, voteUnit(runs), INSTRUCTION, ROOT, stubId).violations).toEqual([]);
  });

  it('dropped paths are counted in one VIOLATION_PATH_DROPPED warning; invalid units warn with their causes', () => {
    const warnings = aggregationWarnings('FF-N02', { inconsistentRuns: 0, droppedPaths: 3 }, [
      { unitId: 'src/x.ts', invalidRunCauses: ['TIMEOUT', 'PARSE_FAILURE'], validRunCount: 1 },
    ]);
    expect(warnings.map((w) => w.code)).toEqual(['VIOLATION_PATH_DROPPED', 'INSUFFICIENT_VALID_RUNS']);
    expect(warnings[1]?.message).toContain('TIMEOUT, PARSE_FAILURE');
  });
});

describe('VIO-02 ids', () => {
  const u = { id: 'src/a.ts', filePaths: ['src/a.ts'] };
  const runs = [run(0, false, 0.9, [{ filePath: 'src/a.ts', message: 'one' }]), run(1, false, 0.8, [{ filePath: 'src/a.ts', message: 'two' }]), P(2)];
  const ids = (rs: UnitRun[]): string[] => formUnitViolations(u, rs, voteUnit(rs), INSTRUCTION, ROOT, stubId).violations.map((v) => v.id);

  it('same input twice → same ids; reversed run order → same ids; changed message → same id', () => {
    expect(ids(runs)).toEqual(ids(runs));
    expect(ids([...runs].reverse())).toEqual(ids(runs));
    const reworded = runs.map((r) => (r.verdict === null ? r : { ...r, verdict: { ...r.verdict, violations: r.verdict.violations.map((v) => ({ ...v, message: `${v.message}!` })) } }));
    expect(ids(reworded)).toEqual(ids(runs));
    expect(ids(runs)).toEqual(['FF-N02|src/a.ts|src/a.ts']);
  });
});

describe('VIO-03 type table', () => {
  it.each([
    [{ source: 'adr' as const, dimension: 'semantic' as const }, 'INTENT_VIOLATION'],
    [{ source: 'adr' as const, dimension: 'integrity' as const }, 'INTENT_VIOLATION'],
    [{ source: 'fitness-function' as const, dimension: 'integrity' as const }, 'INTEGRITY_VIOLATION'],
    [{ source: 'fitness-function' as const, dimension: 'semantic' as const }, 'SEMANTIC_RULE_VIOLATION'],
  ])('%o → %s', (instruction, expected) => {
    expect(violationTypeOf(instruction)).toBe(expected);
  });
});

describe('VIO-04 listing', () => {
  it('a warning function lists the violation of its failing unit; order by unitId then filePath', () => {
    const v = (unitId: string, filePath: string) => ({
      id: `${unitId}:${filePath}`, type: 'SEMANTIC_RULE_VIOLATION' as const, dimension: 'semantic' as const, severity: 'major' as const,
      functionId: INSTRUCTION.functionId, route: 'neuronal' as const, filePath, message: 'm', deterministic: false,
    });
    const listed = listFunctionViolations([
      { unitId: 'src/b', violations: [v('src/b', 'src/b/z.ts'), v('src/b', 'src/b/a.ts')] },
      { unitId: 'src/a', violations: [v('src/a', 'src/a/x.ts')] },
      { unitId: 'src/c', violations: [] },
    ]);
    expect(listed.map((x) => x.id)).toEqual(['src/a:src/a/x.ts', 'src/b:src/b/a.ts', 'src/b:src/b/z.ts']);
    expect(aggregateUnitVerdicts([unit('fail'), unit('pass'), unit('pass')])).toMatchObject({ verdict: 'warning' });
  });
});
