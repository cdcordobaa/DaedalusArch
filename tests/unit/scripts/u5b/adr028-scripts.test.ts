/**
 * ADR-028 script side: the re-scorer's `neural:proportional` row, the harness flags and RunRecord stamps, the
 * aggregate's rule check and column, the registered-vs-proportional comparison, the coding frame and the judge
 * diagnostics. No Neo4j, no CLI, no judge call: in-memory reports, a fake process runner and temp directories.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ProcessResult, ProcessRunner, ProcessRunOptions } from '../../../../src/shared/interfaces/process-runner.js';
import type { EvaluationReport, NeuralResultRow, NeuralUnitRow } from '../../../../src/shared/types/evaluation.js';
import type { CassetteEntry } from '../../../../src/llm-critic/types.js';
import { neuralVerdicts, proportionalAvailable, rescoreReport, storedAggregationOf } from '../../../../scripts/rescore.js';
import type { RescorableReport } from '../../../../scripts/rescore.js';
import { cliArgv, judgeStamp, main as runMain, runPlan, validateRunRecord } from '../../../../scripts/run-experiment.js';
import type { ExperimentPlan, HarnessDeps } from '../../../../scripts/run-experiment.js';
import { checkNeuralAggregation, neuralAggregationOf } from '../../../../scripts/aggregate.js';
import {
  comparisonCsv, contributionsCsv, judgeDecomposition, judgeWeightedReading, judgeWeightedReadingOf, judgeWeightedWeights, pairRuns, readingOf,
  summarise,
} from '../../../../scripts/compare-aggregations.js';
import type { Run } from '../../../../scripts/compare-aggregations.js';
import { codeRationale, codeRationaleGuarded, codesOf, JUDGE_CODING_FRAME_INVALID, loadCodingFrame, negatedAt, parseCodingFrame } from '../../../../scripts/lib/judge-coding-frame.js';
import type { CodingFrame } from '../../../../scripts/lib/judge-coding-frame.js';
import { cassetteVote, judgeDiagnostics } from '../../../../scripts/judge-diagnostics.js';
import type { PreregCheck } from '../../../../scripts/lib/prereg.js';
import type { RunRecord } from '../../../../scripts/lib/report-io.js';
import { ROOT } from './score-fixture.js';
import { scoreAndAssemble } from '../../scoring-engine/assembled-report-fixture.js';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { JudgeUnitResult, NeuronalFunctionResult } from '../../../../src/shared/types/evaluation.js';
import type { Dimension } from '../../../../src/shared/types/enums.js';
import { confidence, functionId } from '../../../../src/shared/types/value-objects.js';

const FULL = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/u5b/reports/full-mode/correct-reference.json'), 'utf8')) as EvaluationReport;

type MutableReport = { -readonly [K in keyof EvaluationReport]: EvaluationReport[K] };
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

function unit(id: string, layer: string, verdict: 'pass' | 'fail' | 'warning', conf: number, status: 'valid' | 'invalid' = 'valid'): NeuralUnitRow {
  return { unitId: id, unitKind: 'file', layer, filePaths: [id], status, verdict, confidence: conf, confidenceStdDev: 0, flaggedUnstable: false, validRunCount: status === 'valid' ? 3 : 1 };
}

/**
 * The committed full-mode fixture with hand-set unit rows. FF-N01 (integrity): layers a (N = 10, judged fail 0.9 and
 * pass) and b (N = 2, judged fail 0.7 twice): majority fail (3 of 4) at confidence (0.9 + 0.7 + 0.7) / 3 = 0.7667 →
 * weight 0.7; proportional (10·0.5 + 2·0.7) / 12 = 0.5333. FF-N02 (semantic): 1 of 4 fails at 0.9, uncapped →
 * majority warning (0); proportional 0.25. The stored violatedWeight is set to the registered contributions.
 */
function handReport(): MutableReport {
  const r = clone(FULL) as MutableReport;
  const rows = (r.neuralResults ?? []).map((row) => ({ ...row })) as (NeuralResultRow & { unitResults: NeuralUnitRow[]; candidatesByLayer?: Record<string, number> })[];
  for (const row of rows) {
    if (String(row.functionId) === 'FF-N01') {
      row.unitResults = [unit('m/a1', 'a', 'fail', 0.9), unit('m/a2', 'a', 'pass', 0.9), unit('m/b1', 'b', 'fail', 0.7), unit('m/b2', 'b', 'fail', 0.7)];
      row.candidatesByLayer = { a: 10, b: 2 };
    } else {
      row.unitResults = [unit('f/1', 'd', 'fail', 0.9), unit('f/2', 'd', 'pass', 0.9), unit('f/3', 'd', 'pass', 0.9), unit('f/4', 'd', 'pass', 0.9)];
      row.candidatesByLayer = { d: 4 };
    }
  }
  r.neuralResults = rows;
  return r;
}

describe('re-scorer: the neural:proportional row (ADR-028 §12.2)', () => {
  it('is added when every judged row carries candidatesByLayer; its contributions are the hand values', () => {
    const report = handReport();
    expect(proportionalAvailable(report)).toBe(true);
    expect(storedAggregationOf(report)).toBe('majority');
    const v = neuralVerdicts(report, 'proportional');
    expect(v.get('FF-N01')?.proportionalShare).toBeCloseTo(6.4 / 12, 12);
    expect(v.get('FF-N02')?.proportionalShare).toBeCloseTo(0.25, 12);
    expect(neuralVerdicts(report, 'majority').get('FF-N01')?.verdict).toBe('fail');
    // v15: undefined for SEL-07 baseline reuse, so no proportional row.
    const reused = { ...report, neuralResults: (report.neuralResults ?? []).map((r) => ({ ...r, selection: { ...r.selection, source: 'baseline' as const } })) };
    expect(proportionalAvailable(reused)).toBe(false);
    const rr = rescoreReport(reused);
    if (!rr.ok) throw new Error(rr.detail);
    expect(rr.value.sensitivity.map((x) => x.scenarioId)).not.toContain('neural:proportional');
  });

  it('is absent for a report without candidatesByLayer (written before ADR-028)', () => {
    const r = rescoreReport(FULL);
    if (!r.ok) throw new Error(r.detail);
    expect(r.value.sensitivity.map((s) => s.scenarioId)).not.toContain('neural:proportional');
    expect(r.value.sensitivity.map((s) => s.scenarioId)).toContain('neural:majority');
  });

  it('on a report scored under the variant, the proportional row reproduces the stored AHS and majority restores the registered one', async () => {
    const prop = await scoredReport('proportional');
    const reg = await scoredReport('registered');
    expect(storedAggregationOf(prop)).toBe('proportional');
    const p = rescoreReport(prop);
    const r = rescoreReport(reg);
    if (!p.ok || !r.ok) throw new Error('rescore failed');
    const pRows = new Map(p.value.sensitivity.map((x) => [x.scenarioId, x]));
    const rRows = new Map(r.value.sensitivity.map((x) => [x.scenarioId, x]));
    expect(pRows.get('neural:proportional')?.reproducesStored).toBe(true);
    expect(rRows.get('neural:majority')?.reproducesStored).toBe(true);
    // Each reading's variant row equals the other reading's stored AHS.
    expect(pRows.get('neural:majority')?.ahs).toEqual(r.value.reproduction.ahs);
    expect(rRows.get('neural:proportional')?.ahs).toEqual(p.value.reproduction.ahs);
    // Hand values: integrity AVR 0.7 (registered) vs 0.533 (proportional); semantic 0 vs 0.25.
    expect(r.value.reproduction.avr.get('integrity')).toBe(0.7);
    expect(p.value.reproduction.avr.get('integrity')).toBe(0.533);
    expect(r.value.reproduction.avr.get('semantic')).toBe(0);
    expect(p.value.reproduction.avr.get('semantic')).toBe(0.25);
  });
});

/** Scores the hand units of `handReport` through the real C8 path under `rule`, rows carrying the same units. */
async function scoredReport(rule: 'registered' | 'proportional'): Promise<RescorableReport> {
  const hand = handReport();
  const rows = hand.neuralResults ?? [];
  const toUnit = (x: NeuralUnitRow): JudgeUnitResult => ({
    unitId: x.unitId, unitKind: x.unitKind, layer: x.layer, filePaths: x.filePaths, status: x.status, verdict: x.verdict,
    confidence: confidence(x.confidence), confidenceStdDev: 0, flaggedUnstable: false, validRunCount: 3, runs: [], violations: [],
  });
  const neural = (id: 'FF-N01' | 'FF-N02', dimension: Dimension, verdict: 'fail' | 'warning', conf: number): NeuronalFunctionResult => {
    const row = rows.find((x) => String(x.functionId) === id);
    return {
      functionId: functionId(id), dimension, verdict, confidence: confidence(conf), confidenceStdDev: 0, icc: 1, reasoning: '', evidence: [],
      violations: [], runs: [], deterministic: false, flaggedUnstable: false, unitResults: (row?.unitResults ?? []).map(toUnit),
      unitsSelected: row?.unitResults.length ?? 0, unitsCapped: 0, ...(row?.candidatesByLayer !== undefined && { candidatesByLayer: row.candidatesByLayer }),
    };
  };
  const sym = (id: string, dimension: Dimension, passed: boolean) => ({
    functionId: functionId(id), dimension, passed, executionTimeMs: 1, deterministic: true as const, tag: 'structural' as const, violations: [],
  });
  const res = await scoreAndAssemble({
    evaluationResults: {
      symbolicResults: [sym('FF-S01', 'structural', true), sym('FF-C01', 'coupling', false)],
      neuronalResults: [neural('FF-N01', 'integrity', 'fail', (0.9 + 0.7 + 0.7) / 3), neural('FF-N02', 'semantic', 'warning', 0.9)],
      failures: [],
    },
    scoringWeights: { structural: 0.35, coupling: 0.2, pattern: 0.3, solid: 0.1, convention: 0.05, semantic: 0, integrity: 0 },
    fullModeWeights: { structural: 0.32, coupling: 0.18, pattern: 0.27, solid: 0.1, convention: 0.05, semantic: 0.04, integrity: 0.04 },
    confidenceThresholds: { high: 0.85, medium: 0.6, iccMinimum: 0.7 },
    verdictThresholds: { pass: 0.8, warning: 0.65, softBlock: 0.5 },
    mode: 'full', projectPath: 'fixtures/p', specVersion: '1', fitnessFunctions: [], noJudgeUnits: [], neuralAggregation: rule,
    graphRepository: {
      executeQuery: () => Promise.resolve(DomainResult.ok({ records: [{ cnt: 0, val: 0 }], summary: { counters: {} } })),
      clearGraph: () => Promise.resolve(DomainResult.ok(undefined)),
      healthCheck: () => Promise.resolve(true),
      close: () => Promise.resolve(),
    },
    compiled: { symbolicQueries: [], neuronalInstructions: [], hybridPairs: [], totalCompiled: 0, disabledFunctions: [], warnings: [] },
  });
  if (!res.success) throw new Error(res.errors.map((e) => e.code).join(', '));
  const report = JSON.parse(JSON.stringify(res.data)) as MutableReport;
  report.neuralResults = (report.neuralResults ?? []).map((row) => {
    const hr = rows.find((x) => x.functionId === row.functionId);
    return { ...row, unitResults: hr?.unitResults ?? [], ...(hr?.candidatesByLayer !== undefined && { candidatesByLayer: hr.candidatesByLayer }) };
  });
  return report;
}

// ---------------------------------------------------------------------------------------------
// Harness

class FakeRunner implements ProcessRunner {
  readonly calls: { args: readonly string[] }[] = [];
  constructor(private readonly stdout: string) {}
  run(_command: string, args: readonly string[], _options: ProcessRunOptions): ReturnType<ProcessRunner['run']> {
    this.calls.push({ args });
    const data: ProcessResult = { exitCode: 0, stdout: this.stdout, stderr: '', timedOut: false, durationMs: 5 };
    return Promise.resolve({ success: true, data });
  }
}
const PASS_GATE = (): PreregCheck => ({
  ok: true,
  prereg: { version: 14, registeredAt: '2026-10-10T00:00:00Z', matchingRuleVersion: '1.2.0', artefacts: [], labellingBudgetCalls: 0, e1Grid: { models: 3, specLevels: 3, tasks: 2, runs: 3 } },
  frozenHashes: { 'experiments/e7-x/plan.json': 'a'.repeat(64) },
});

describe('run harness: --neural-aggregation and --cassette-mode (ADR-028)', () => {
  let out = '';
  beforeEach(() => { out = mkdtempSync(join(tmpdir(), 'adr028-run-')); });
  afterEach(() => { rmSync(out, { recursive: true, force: true }); });
  const full: ExperimentPlan = {
    id: 'e7-x', experiment: 'E7', mode: 'full', judge: { provider: 'claude-cli', model: 'claude-opus-5-5' },
    seeds: { sampling: 1, bootstrap: 2, permutation: 3 }, cassetteDir: 'experiments/e7-x/cassettes', outDir: 'results/e7-x',
    projects: [{ projectId: 'a', path: 'p/a', specPath: 'specs/clean-arch.yaml' }],
  };
  const entry = { index: 0, projectId: 'a', path: 'p/a', specPath: 's.yaml' };
  function deps(runner: ProcessRunner, over: Partial<HarnessDeps> = {}): HarnessDeps {
    let t = Date.parse('2026-10-10T12:00:00Z');
    return {
      runner, cli: { command: 'fake-cli', args: ['bin/firewall.ts'] }, parentEnv: { PATH: '/bin' }, now: () => new Date((t += 10)),
      cliCommit: 'a'.repeat(40), recordEnvironment: (planId) => Promise.resolve({ id: `env-${planId}`, record: { id: `env-${planId}` } }),
      gate: PASS_GATE, outDir: out, ...over,
    };
  }

  it('cliArgv passes the options to judge-mode children only; the default argv is unchanged', () => {
    const base = cliArgv(full, entry);
    expect(base).not.toContain('--neural-aggregation');
    expect(base).not.toContain('--cassette-mode');
    const replay = cliArgv(full, entry, 2, { cassetteMode: 'replay', neuralAggregation: 'proportional' });
    expect(replay.slice(-4)).toEqual(['--cassette-mode', 'replay', '--neural-aggregation', 'proportional']);
    const sym = cliArgv({ ...full, mode: 'symbolic-only' }, entry, 2, { cassetteMode: 'replay', neuralAggregation: 'proportional' });
    expect(sym).not.toContain('--neural-aggregation');
  });

  it('judge-mode RunRecords carry neuralAggregation (default registered) and a given cassetteMode; symbolic-only none', () => {
    expect(judgeStamp(full, undefined)).toEqual({ neuralAggregation: 'registered' });
    expect(judgeStamp(full, { cassetteMode: 'replay', neuralAggregation: 'proportional' })).toEqual({ neuralAggregation: 'proportional', cassetteMode: 'replay' });
    expect(judgeStamp({ ...full, mode: 'symbolic-only' }, { neuralAggregation: 'proportional' })).toEqual({});
  });

  it('a replayed proportional plan run writes validated RunRecords with both stamps', async () => {
    const runner = new FakeRunner(JSON.stringify(FULL));
    const r = await runPlan(full, 'experiments/e7-x/plan.json', ROOT, deps(runner, { judge: { cassetteMode: 'replay', neuralAggregation: 'proportional' } }));
    expect(r.records).toHaveLength(1);
    const rec: RunRecord | undefined = r.records[0];
    if (rec === undefined) throw new Error('no record');
    expect(rec).toMatchObject({ neuralAggregation: 'proportional', cassetteMode: 'replay' });
    expect(validateRunRecord(rec, ROOT)).toEqual([]);
    expect(runner.calls[0]?.args).toEqual(expect.arrayContaining(['--cassette-mode', 'replay', '--neural-aggregation', 'proportional']));
    expect(validateRunRecord({ ...rec, neuralAggregation: 'share' }, ROOT).length).toBeGreaterThan(0);
  });

  it('the CLI refuses an unknown value with the usage (exit 2)', async () => {
    const err: string[] = [];
    const io = { out: () => undefined, err: (t: string) => err.push(t) };
    expect(await runMain(['experiments/e7-corpus/plan.json', '--neural-aggregation', 'share'], ROOT, io, () => { throw new Error('no deps'); })).toBe(2);
    expect(await runMain(['experiments/e7-corpus/plan.json', '--cassette-mode', 'bypass'], ROOT, io, () => { throw new Error('no deps'); })).toBe(2);
    expect(err.join('')).toContain('--neural-aggregation registered|proportional');
  });
});

// ---------------------------------------------------------------------------------------------
// Aggregate and comparison

describe('aggregate: one rule per CSV set (ADR-028)', () => {
  it('names the rule of each report and refuses a mixed directory', () => {
    const reg = clone(FULL);
    const prop = { ...clone(FULL), scoring: { ...FULL.scoring, neuralAggregation: 'proportional' as const } };
    expect(neuralAggregationOf(reg)).toBe('registered');
    expect(neuralAggregationOf(prop)).toBe('proportional');
    expect(neuralAggregationOf({ ...reg, evaluationMode: 'symbolic-only' })).toBe('');
    expect(() => { checkNeuralAggregation(new Map([['r1', reg]]), 'registered'); }).not.toThrow();
    expect(() => { checkNeuralAggregation(new Map([['r1', reg], ['r2', prop]]), 'proportional'); }).toThrow(/AGGREGATE_INPUT_INVALID.*r1/);
  });
});

function run(projectId: string, report: EvaluationReport, runId: string, preregVersion = 14): Run {
  const record = {
    runId, planId: 'e7-x', projectId, status: 'accepted', attempt: 1, specSha: 'b'.repeat(64), cliCommit: 'a'.repeat(40),
    preregVersion, frozenHashes: {}, envRecordId: 'env', startedAt: '2026-10-10T00:00:00Z', wallMs: 1,
  } as RunRecord;
  return { record, report };
}

const col = (csv: string, name: string, line = 1): string => {
  const rows = csv.trimEnd().split('\n').map((l) => l.split(','));
  return rows[line]?.[rows[0]?.indexOf(name) ?? -1] ?? '';
};

describe('compare-aggregations (ADR-028 §12.3)', () => {
  /*
   * scoredReport: executed dimensions structural (AVR 0), coupling (1), semantic, integrity; full-mode weights
   * .32 / .18 / .04 / .04 over Σ = .58, so W_n = .08 / .58 = 0.137931.
   * Registered: integrity 0.7, semantic 0 → ahsCombined = 1 − (.18 + .028) / .58 = 0.641 (soft-block).
   * Judge-blind: 1 − .18 / .58 = 0.690 (warning) → judge_mattered true; delta_judge = 0.641 − 0.690 = −0.049 ≥ −W_n.
   * ahsDeterministic = 1 − .2 / .55 = 0.636 → delta_dilution = 0.690 − 0.636 = 0.054; identity W_n · (1 − .636) = 0.050.
   * Proportional: integrity 0.533, semantic 0.25 → 1 − (.18 + .02132 + .01) / .58 = 0.636 (soft-block).
   * any-fail: semantic 1 (1 fail at 0.9), integrity 0.7 → 1 − (.18 + .04 + .028) / .58 = 0.572 (soft-block).
   */
  it('the decomposition, the any-fail companion and the derived reading, from hand values', async () => {
    const reg = await scoredReport('registered') as EvaluationReport;
    const prop = await scoredReport('proportional') as EvaluationReport;
    const d = judgeDecomposition(reg);
    expect(d?.wNeural).toBeCloseTo(0.08 / 0.58, 9);
    expect(d?.ahsCombinedJudgeBlind).toBeCloseTo(0.69, 9);
    expect(d?.verdictJudgeBlind).toBe('warning');
    expect(d?.deltaJudge).toBeCloseTo(-0.049, 9);
    expect(d?.deltaDilution).toBeCloseTo(0.054, 9);
    expect(d?.dilutionIdentity).toBeCloseTo((0.08 / 0.58) * (1 - 0.636), 9);
    const rows = pairRuns([run('a', reg, 'r-a')], [run('a', prop, 'v-a')]);
    const csv = comparisonCsv(rows);
    expect(col(csv, 'reading')).toBe('pre-registered');
    expect(col(csv, 'ahs_combined_registered')).toBe('0.641');
    expect(col(csv, 'ahs_combined_proportional')).toBe('0.636');
    expect(col(csv, 'verdict_registered')).toBe('soft-block');
    expect(col(csv, 'verdict_judge_blind')).toBe('warning');
    expect(col(csv, 'judge_mattered_registered')).toBe('true');
    expect(col(csv, 'judge_bound')).toBe('-0.138');
    expect(col(csv, 'delta_judge_proportional')).toBe('-0.054');
    expect(col(csv, 'ahs_combined_any_fail')).toBe('0.572');
    expect(col(csv, 'verdict_any_fail')).toBe('soft-block');
    expect(col(csv, 'any_fail_changed')).toBe('false');
    expect(col(csv, 'registered_prereg_version')).toBe('14');
    expect(summarise(rows)).toMatchObject({ judgeMattered: 1, verdictChanges: 0, anyFailChanges: 0 });
    // Reading: derived from the registered run's preregVersion; a contradicting override is refused.
    expect(readingOf(run('a', reg, 'r', 11).record)).toBe('post-hoc');
    expect(col(comparisonCsv(pairRuns([run('a', reg, 'r', 11)], [run('a', prop, 'v')])), 'reading')).toBe('post-hoc');
    expect(() => pairRuns([run('a', reg, 'r', 11)], [run('a', prop, 'v')], 'pre-registered')).toThrow(/contradicts/);
    expect(() => pairRuns([run('a', reg, 'r')], [run('a', prop, 'v')], 'pre-registered')).not.toThrow();
    // Contributions: FF-N01 proportional 0.533333, confidence-free (10·0.5 + 2·1) / 12 = 0.583333.
    const contrib = contributionsCsv(rows).trimEnd().split('\n');
    expect(contrib.find((l) => l.includes(',FF-N01,'))).toContain(',fail,0.700000,0.533333,0.583333,');
    expect(contrib.find((l) => l.includes(',FF-N02,'))).toContain(',warning,0.000000,0.250000,0.250000,');
    expect(contrib.find((l) => l.includes(',FF-N01,'))).toContain('a:10/2/1;b:2/2/2');
  });

  it('refuses a missing pair, a wrong rule, a different rules-only AHS and a stored AHS that does not reproduce', async () => {
    const reg = await scoredReport('registered') as EvaluationReport;
    const prop = await scoredReport('proportional') as EvaluationReport;
    expect(() => pairRuns([run('a', reg, 'r')], [run('b', prop, 'v')])).toThrow(/no accepted variant run for a/);
    expect(() => pairRuns([run('a', reg, 'r')], [run('a', reg, 'v')])).toThrow(/not a proportional-rule report/);
    expect(() => pairRuns([run('a', prop, 'r')], [run('a', prop, 'v')])).toThrow(/not a registered-rule report/);
    const other = { ...prop, ahsDeterministic: 0.1 as EvaluationReport['ahsDeterministic'] } as EvaluationReport;
    expect(() => pairRuns([run('a', reg, 'r')], [run('a', other, 'v')])).toThrow(/rules-only AHS differs/);
    expect(() => judgeDecomposition({ ...reg, ahsCombined: 0.9 } as EvaluationReport)).toThrow(/does not reproduce/);
    const changedUnits = clone(prop) as MutableReport;
    const rows = (changedUnits.neuralResults ?? []) as (NeuralResultRow & { unitResults: NeuralUnitRow[] })[];
    if (rows[0] !== undefined) rows[0].unitResults = [unit('x', 'a', 'pass', 0.9)];
    expect(pairRuns([run('a', reg, 'r')], [run('a', changedUnits as EvaluationReport, 'v')])[0]?.sameJudgeUnits).toBe(false);
  });
});

describe('compare-aggregations: judge-weighted sensitivity variant judge-weighted-v1 (§12.5, prereg v16)', () => {
  const SPEC = { structural: 0.32, coupling: 0.18, pattern: 0.27, solid: 0.1, convention: 0.05, semantic: 0.04, integrity: 0.04 } as const;

  it('weights: judge dimensions 2/7 and symbolic 5/7, each group proportional, sum 1; undefined without a judge or symbolic weight', () => {
    // All seven executed (the E7 case): effective = spec weights. Symbolic Σ .92 → structural .32 · (5/7) / .92 = 0.248447.
    const w = judgeWeightedWeights(new Map(Object.entries(SPEC)) as Map<Dimension, number>);
    expect(w?.get('semantic')).toBeCloseTo(1 / 7, 12);
    expect(w?.get('integrity')).toBeCloseTo(1 / 7, 12);
    expect(w?.get('structural')).toBeCloseTo((0.32 * 5) / 7 / 0.92, 12);
    expect(w?.get('convention')).toBeCloseTo((0.05 * 5) / 7 / 0.92, 12);
    expect([...(w?.values() ?? [])].reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect((w?.get('structural') ?? 0) / (w?.get('coupling') ?? 1)).toBeCloseTo(0.32 / 0.18, 12);
    expect(judgeWeightedWeights(new Map<Dimension, number>([['structural', 0.6], ['coupling', 0.4]]))).toBeUndefined();
    expect(judgeWeightedWeights(new Map<Dimension, number>([['semantic', 0.5], ['integrity', 0.5]]))).toBeUndefined();
  });

  /*
   * Seven executed dimensions, every symbolic AVR 0.4, semantic 0.7, integrity 0; thresholds .8 / .65 / .5.
   * Registered weights (W_n = .08): 1 − (.92 · .4 + .04 · .7) = 0.604 soft-block; judge-blind 1 − .368 = 0.632
   * soft-block → the judge moves nothing. judge-weighted-v1: 1 − (5/7 · .4 + 1/7 · .7) = 1 − .285714 − .1 = 0.614
   * soft-block; judge-blind 1 − .285714 = 0.714 warning → the judge moves the verdict (delta_judge −0.100 ≥ −2/7).
   */
  it('a verdict the registered weights cannot move moves under judge-weighted-v1 (hand values)', () => {
    const r = clone(FULL) as MutableReport;
    const template = r.perDimensionScores[0];
    if (template === undefined) throw new Error('fixture has no perDimensionScores');
    r.perDimensionScores = (Object.keys(SPEC) as Dimension[]).map((d) => ({
      ...template, dimension: d, functionCount: 1,
      avr: (d === 'semantic' ? 0.7 : d === 'integrity' ? 0 : 0.4) as EvaluationReport['perDimensionScores'][number]['avr'],
    }));
    r.ahsCombined = 0.604 as EvaluationReport['ahsCombined'];
    r.scoring = { ...r.scoring, fullModeWeights: { ...SPEC }, thresholds: { pass: 0.8, warning: 0.65, softBlock: 0.5 } };
    const j = judgeWeightedReading(r);
    expect(j?.wNeural).toBeCloseTo(2 / 7, 12);
    expect(j?.rules.registered).toEqual({ ahs: 0.614, verdict: 'soft-block' });
    expect(j?.judgeBlind).toEqual({ ahs: 0.714, verdict: 'warning' });
    expect(j?.rules.proportional).toBeUndefined();
    expect(j?.rules.any_fail).toBeUndefined();
    // Symbolic-only report (no ahsCombined): not defined.
    const sym = clone(r);
    delete (sym as Partial<MutableReport>).ahsCombined;
    expect(judgeWeightedReading(sym as EvaluationReport)).toBeUndefined();
  });

  /*
   * The scoredReport pair (executed structural AVR 0, coupling 1, semantic, integrity; effective weights over Σ .58).
   * judge-weighted-v1: structural (.32 / .50) · 5/7 = 0.457143, coupling (.18 / .50) · 5/7 = 0.257143, semantic and
   * integrity 1/7 each.
   * - judge-blind: 1 − .257143 = 0.743 (warning);
   * - registered (integrity .7, semantic 0): 1 − .257143 − .1 = 0.643 (soft-block); delta_jw vs 0.641 = +0.002;
   *   delta_judge −0.100; judge_mattered true;
   * - proportional (integrity .533, semantic .25): 1 − .257143 − (.533 + .25) / 7 = 0.631 (soft-block); vs 0.636 → −0.005;
   * - any-fail (semantic 1, integrity .7): 1 − .257143 − 1.7 / 7 = 0.500 (soft-block, at the threshold); vs 0.572 → −0.072.
   */
  it('writes the judge-weighted columns beside the registered and proportional rows, with the any-fail row (hand values)', async () => {
    const reg = await scoredReport('registered') as EvaluationReport;
    const prop = await scoredReport('proportional') as EvaluationReport;
    const rows = pairRuns([run('a', reg, 'r-a', 15)], [run('a', prop, 'v-a', 15)]);
    const csv = comparisonCsv(rows);
    expect(col(csv, 'reading_judge_weighted')).toBe('post-hoc');
    expect(col(csv, 'w_neural_jw')).toBe('0.286');
    expect(col(csv, 'judge_bound_jw')).toBe('-0.286');
    expect(col(csv, 'ahs_combined_jw_judge_blind')).toBe('0.743');
    expect(col(csv, 'verdict_jw_judge_blind')).toBe('warning');
    expect(col(csv, 'ahs_combined_jw_registered')).toBe('0.643');
    expect(col(csv, 'verdict_jw_registered')).toBe('soft-block');
    expect(col(csv, 'delta_jw_registered')).toBe('0.002');
    expect(col(csv, 'verdict_changed_jw_registered')).toBe('false');
    expect(col(csv, 'delta_judge_jw_registered')).toBe('-0.100');
    expect(col(csv, 'judge_mattered_jw_registered')).toBe('true');
    expect(col(csv, 'ahs_combined_jw_proportional')).toBe('0.631');
    expect(col(csv, 'delta_jw_proportional')).toBe('-0.005');
    expect(col(csv, 'judge_mattered_jw_proportional')).toBe('true');
    expect(col(csv, 'ahs_combined_jw_any_fail')).toBe('0.500');
    expect(col(csv, 'verdict_jw_any_fail')).toBe('soft-block');
    expect(col(csv, 'delta_jw_any_fail')).toBe('-0.072');
    expect(col(csv, 'delta_judge_jw_any_fail')).toBe('-0.243');
    expect(col(csv, 'judge_mattered_jw_any_fail')).toBe('true');
    // The registered columns are unchanged by the variant.
    expect(col(csv, 'ahs_combined_registered')).toBe('0.641');
    expect(col(csv, 'ahs_combined_any_fail')).toBe('0.572');
    expect(summarise(rows).judgeWeighted).toEqual({
      registered: { verdictChanges: 0, judgeMattered: 1 }, proportional: { verdictChanges: 0, judgeMattered: 1 }, any_fail: { verdictChanges: 0, judgeMattered: 1 },
    });
    // Reading: pre-registered from prereg v16 on.
    expect(judgeWeightedReadingOf(run('a', reg, 'r', 16).record)).toBe('pre-registered');
    expect(col(comparisonCsv(pairRuns([run('a', reg, 'r', 16)], [run('a', prop, 'v', 16)])), 'reading_judge_weighted')).toBe('pre-registered');
  });
});

// ---------------------------------------------------------------------------------------------
// Coding frame and diagnostics

describe('judge coding frame 1.1.0 (ADR-028 item 4, §12.4)', () => {
  const loaded = loadCodingFrame(ROOT);
  if (!loaded.ok) throw new Error(loaded.detail);
  const frame: CodingFrame = loaded.frame;

  it('the registered frame: message-only primary, guarded reasoning, threshold 0.3, the rubric criteria', () => {
    expect(frame.version).toBe('1.1.0');
    expect(frame.uncoded).toBe('JC-UNCODED');
    expect(frame.primaryTextFields).toEqual(['violations.message']);
    expect(frame.secondaryTextFields).toEqual(['reasoning']);
    expect(frame.negationGuard).toEqual({ window: 5, tokens: ['no', 'not', 'without', 'none', 'neither', 'avoids', 'free of'] });
    expect(frame.informativeThreshold).toBe(0.3);
    expect(codesOf(frame, 'FF-N01')).toEqual(['JC-N01-SPLIT', 'JC-N01-DUP', 'JC-N01-BYPASS', 'JC-UNCODED']);
    expect(codesOf(frame, 'FF-N02')).toEqual(['JC-N02-PERSISTENCE', 'JC-N02-TRANSPORT', 'JC-N02-FRAMEWORK', 'JC-N02-BUSINESS', 'JC-UNCODED']);
  });

  it('codes mechanically: multi-label, own function only, case-insensitive, uncoded otherwise', () => {
    expect(codeRationale(frame, 'FF-N01', 'The module mixes unrelated concerns and DUPLICATES the price rule.')).toEqual(['JC-N01-SPLIT', 'JC-N01-DUP']);
    expect(codeRationale(frame, 'FF-N01', 'The service reaches into the repository and bypasses the facade.')).toEqual(['JC-N01-BYPASS']);
    expect(codeRationale(frame, 'FF-N02', 'Runs a Prisma query and builds the HTTP response with @Injectable.')).toEqual(['JC-N02-PERSISTENCE', 'JC-N02-TRANSPORT', 'JC-N02-FRAMEWORK']);
    expect(codeRationale(frame, 'FF-N02', 'The controller computes the discount, a business rule.')).toEqual(['JC-N02-BUSINESS']);
    expect(codeRationale(frame, 'FF-N01', 'Uses the database.')).toEqual(['JC-UNCODED']);
    expect(codeRationale(frame, 'FF-N02', 'deeply nested conditionals')).toEqual(['JC-UNCODED']);
    expect(codeRationale(frame, 'FF-X99', 'anything')).toEqual(['JC-UNCODED']);
  });

  it('the negation guard drops a match with a guard token or phrase among the 5 tokens before it', () => {
    // "no duplicated rule": "no" is 1 token before → dropped. "is free of any database access" → phrase in window.
    expect(codeRationaleGuarded(frame, 'FF-N01', 'There is no duplicated rule here.')).toEqual(['JC-UNCODED']);
    expect(codeRationaleGuarded(frame, 'FF-N02', 'The entity is free of any database access.')).toEqual(['JC-UNCODED']);
    // 6 tokens between "not" and the match: outside the window → kept.
    expect(codeRationaleGuarded(frame, 'FF-N01', 'It is not a b c d e duplicated.')).toEqual(['JC-N01-DUP']);
    // One negated and one plain match of the same criterion → kept.
    expect(codeRationaleGuarded(frame, 'FF-N02', 'Without a repository here, but the service runs a SQL query.')).toEqual(['JC-N02-PERSISTENCE']);
    // The unguarded coding keeps the negated match.
    expect(codeRationale(frame, 'FF-N01', 'There is no duplicated rule here.')).toEqual(['JC-N01-DUP']);
    expect(negatedAt('it avoids duplication', 10, frame.negationGuard)).toBe(true);
    expect(negatedAt('Freedom of duplication', 11, frame.negationGuard)).toBe(false);
  });

  it('refuses a missing, doubled or malformed block', () => {
    expect(parseCodingFrame('no block')).toMatchObject({ ok: false, code: JUDGE_CODING_FRAME_INVALID });
    const block = (body: string): string => `\`\`\`yaml judge-coding-frame\n${body}\n\`\`\`\n`;
    const good = [
      'version: 1.1.0', 'uncoded: JC-UNCODED', 'primary:', '  textFields: [violations.message]', 'secondary:', '  textFields: [reasoning]',
      '  negationGuard:', '    window: 5', '    tokens: [no, free of]', 'discrimination:', '  informativeThreshold: 0.3',
      'functions:', '  FF-N01:', '    - code: JC-A', '      rubricClause: c', "      patterns: ['\\bx\\b']",
    ].join('\n');
    expect(parseCodingFrame(block(good))).toMatchObject({ ok: true });
    expect(parseCodingFrame(block(good) + block(good))).toMatchObject({ ok: false });
    expect(parseCodingFrame(block(good.replace("'\\bx\\b'", "'(unclosed'")))).toMatchObject({ ok: false });
    expect(parseCodingFrame(block(good.replace('JC-A', 'XX')))).toMatchObject({ ok: false });
    expect(parseCodingFrame(block(good.replace('JC-A', 'JC-UNCODED')))).toMatchObject({ ok: false });
    expect(parseCodingFrame(block(good.replace('[violations.message]', '[prompt]')))).toMatchObject({ ok: false });
    expect(parseCodingFrame(block(good.replace('window: 5', 'window: 0')))).toMatchObject({ ok: false });
    expect(parseCodingFrame(block(good.replace('informativeThreshold: 0.3', 'informativeThreshold: 2')))).toMatchObject({ ok: false });
  });
});

function entry(projectId: string, functionId: string, unitId: string, runIndex: number, pass: boolean | null, conf: number, reasoning: string, message = `msg ${String(runIndex)}`): CassetteEntry {
  return {
    schemaVersion: 2, key: `k-${unitId}-${String(runIndex)}`, requestHash: 'h', repetition: 0, runIndex, functionId, unitId, projectId,
    provider: 'claude-cli', model: 'claude-opus-5-5', effort: 'high', usedOptions: {}, ignoredOptions: [], attempts: 1,
    outcome: pass === null ? { kind: 'invalid', cause: 'PARSE_FAILURE' } : { kind: 'valid' },
    response: '', parsedVerdict: pass === null ? null : { pass, confidence: conf, reasoning, evidence: [], violations: pass ? [] : [{ filePath: unitId, message }] },
    usage: { inputTokens: 0, outputTokens: 0 }, durationMs: 1, recordedAt: '2026-10-10T00:00:00Z',
  };
}

describe('judge diagnostics (ADR-028 item 4)', () => {
  it('cassetteVote: majority, carrier by highest confidence then lowest runIndex, split and invalid', () => {
    const e = (i: number, pass: boolean | null, c: number): CassetteEntry => entry('p', 'FF-N02', 'u', i, pass, c, `r${String(i)}`);
    expect(cassetteVote([e(0, false, 0.7), e(1, false, 0.9), e(2, true, 0.95)])).toMatchObject({ verdict: 'fail', failRuns: 2, passRuns: 1, carrier: { runIndex: 1 } });
    expect(cassetteVote([e(0, false, 0.8), e(1, false, 0.8), e(2, true, 0.95)]).carrier?.runIndex).toBe(0);
    expect(cassetteVote([e(0, false, 0.8), e(1, true, 0.9), e(2, null, 0)])).toMatchObject({ verdict: 'warning', carrier: { runIndex: 1 } });
    expect(cassetteVote([e(0, false, 0.8), e(1, null, 0), e(2, null, 0)]).verdict).toBe('invalid');
  });

  it('writes the unit, criteria, discrimination and summary tables from a run directory and cassettes, with no judge call', () => {
    const dir = mkdtempSync(join(tmpdir(), 'adr028-diag-'));
    try {
      const report = clone<MutableReport>(handReport());
      // One symbolic violation on m/a1 (an FF-N01 unit file) for rules_also_flag.
      report.violations = [...report.violations, { ...(FULL.violations[0] ?? ({} as never)), route: 'symbolic', filePath: 'm/a1', id: 'sym-1' }];
      const record = run('proj', report, 'e7-x-000-proj').record;
      mkdirSync(join(dir, 'runs/runs'), { recursive: true });
      mkdirSync(join(dir, 'runs/reports'), { recursive: true });
      writeFileSync(join(dir, 'runs/runs/e7-x-000-proj.run.json'), JSON.stringify({ ...record, reportPath: 'reports/e7-x-000-proj.json' }));
      writeFileSync(join(dir, 'runs/reports/e7-x-000-proj.json'), JSON.stringify(report));
      const entries: CassetteEntry[] = [];
      for (const row of report.neuralResults ?? []) {
        for (const u of row.unitResults) {
          const fail = u.verdict === 'fail';
          const n01 = String(row.functionId) === 'FF-N01';
          for (let i = 0; i < 3; i++) {
            // Fail messages carry the criterion; pass reasoning names it negated ("no duplication", "without any repository").
            const reasoning = fail ? 'See the violation.' : n01 ? 'There is no duplication here.' : 'It works without any repository access.';
            const message = n01 ? 'Duplicates the invariant in two places.' : 'Persists through a repository query.';
            entries.push(entry('proj', String(row.functionId), u.unitId, i, !fail, fail ? 0.9 - i * 0.01 : 0.9, reasoning, message));
          }
        }
      }
      // Make one unit's cassette vote differ from its report row: FF-N02 f/2 passes in the report, fails in the cassettes.
      for (const e of entries) {
        if (e.unitId === 'f/2' && e.parsedVerdict !== null) Object.assign(e, { parsedVerdict: { ...e.parsedVerdict, pass: false } });
      }
      entries.forEach((e, i) => {
        const shard = join(dir, 'cassettes', String(i % 3));
        mkdirSync(shard, { recursive: true });
        writeFileSync(join(shard, `${String(i)}.json`), JSON.stringify(e));
      });
      const loaded = loadCodingFrame(ROOT);
      if (!loaded.ok) throw new Error(loaded.detail);
      const out = judgeDiagnostics(join(dir, 'runs'), join(dir, 'cassettes'), loaded.frame);
      expect(out.units).toBe(8);
      expect(out.missingCassettes).toBe(0);
      expect(out.voteMismatches).toBe(1);
      const units = out.files.get('judge_units.csv') ?? '';
      const lines = units.trimEnd().split('\n');
      expect(lines).toHaveLength(9);
      const at = (unitId: string, name: string): string => col(units, name, lines.findIndex((l) => l.includes(`,${unitId},`)));
      expect(at('m/a1', 'codes')).toBe('JC-N01-DUP');
      expect(at('m/a1', 'rules_also_flag')).toBe('true');
      expect(at('m/b1', 'rules_also_flag')).toBe('false');
      // A passing unit has no messages, so no primary code; its guarded reasoning code is uncoded.
      expect(at('m/a2', 'codes')).toBe('');
      expect(at('m/a2', 'codes_reasoning_guarded')).toBe('JC-UNCODED');
      const criteria = (out.files.get('judge_criteria.csv') ?? '').trimEnd().split('\n');
      expect(criteria).toContain('FF-N01,*,fail,JC-N01-DUP,3,0,3,1.000000,0.000000');
      expect(criteria).toContain('FF-N02,proj,fail,JC-N02-PERSISTENCE,1,0,1,1.000000,0.000000');
      const disc = (out.files.get('judge_discrimination.csv') ?? '').trimEnd().split('\n');
      // FF-N01 DUP: fail message share 3/3 − guarded pass share 0/1 = 1 → informative; SPLIT: 0 − 0 = 0 → not.
      expect(disc).toContain('FF-N01,*,JC-N01-DUP,3,1.000000,1,0.000000,1.000000,true');
      expect(disc).toContain('FF-N01,*,JC-N01-SPLIT,3,0.000000,1,0.000000,0.000000,false');
      const summary = (out.files.get('judge_summary.csv') ?? '').trimEnd().split('\n');
      expect(summary).toContain('FF-N01,proj,4,4,0,3,1,0,0,0.800000,0,3,1');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
