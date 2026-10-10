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
import { comparisonCsv, contributionsCsv, pairRuns, summarise } from '../../../../scripts/compare-aggregations.js';
import type { Run } from '../../../../scripts/compare-aggregations.js';
import { codeRationale, codesOf, JUDGE_CODING_FRAME_INVALID, loadCodingFrame, parseCodingFrame } from '../../../../scripts/lib/judge-coding-frame.js';
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

function run(projectId: string, report: EvaluationReport, runId: string): Run {
  const record = {
    runId, planId: 'e7-x', projectId, status: 'accepted', attempt: 1, specSha: 'b'.repeat(64), cliCommit: 'a'.repeat(40),
    preregVersion: 14, frozenHashes: {}, envRecordId: 'env', startedAt: '2026-10-10T00:00:00Z', wallMs: 1,
  } as RunRecord;
  return { record, report };
}

describe('compare-aggregations (ADR-028 §12.3)', () => {
  it('pairs by project, checks the rules-only AHS and the judge units, and counts verdict changes', () => {
    const reg = handReport() as EvaluationReport;
    const variant = {
      ...handReport(), scoring: { ...reg.scoring, neuralAggregation: 'proportional' as const },
      ahsCombined: 0.5 as EvaluationReport['ahsCombined'], verdict: 'soft-block' as const,
    } as EvaluationReport;
    const rows = pairRuns([run('a', reg, 'r-a')], [run('a', variant, 'v-a')]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ projectId: 'a', sameJudgeUnits: true, verdictChanged: reg.verdict !== 'soft-block' });
    const csv = comparisonCsv(rows, 'post-hoc').trimEnd().split('\n');
    expect(csv[0]?.split(',')).toContain('verdict_rules_only');
    expect(csv[1]).toContain(',post-hoc,');
    expect(csv[1]).toContain(',0.500,');
    const contrib = contributionsCsv(rows).trimEnd().split('\n');
    // FF-N01: registered 0.7, proportional 0.533333, strata a:10/2/1;b:2/2/2. FF-N02: registered 0, proportional 0.25.
    expect(contrib.find((l) => l.includes(',FF-N01,'))).toContain(',fail,0.700000,0.533333,');
    expect(contrib.find((l) => l.includes(',FF-N01,'))).toContain('a:10/2/1;b:2/2/2');
    expect(contrib.find((l) => l.includes(',FF-N02,'))).toContain(',warning,0.000000,0.250000,');
    expect(summarise(rows).verdictChanges).toBe(reg.verdict !== 'soft-block' ? 1 : 0);
  });

  it('refuses a missing pair, a wrong rule and a different rules-only AHS', () => {
    const reg = handReport() as EvaluationReport;
    const prop = { ...reg, scoring: { ...reg.scoring, neuralAggregation: 'proportional' as const } } as EvaluationReport;
    expect(() => pairRuns([run('a', reg, 'r')], [run('b', prop, 'v')])).toThrow(/no accepted variant run for a/);
    expect(() => pairRuns([run('a', reg, 'r')], [run('a', reg, 'v')])).toThrow(/not a proportional-rule report/);
    expect(() => pairRuns([run('a', prop, 'r')], [run('a', prop, 'v')])).toThrow(/not a registered-rule report/);
    const other = { ...prop, ahsDeterministic: 0.1 as EvaluationReport['ahsDeterministic'] } as EvaluationReport;
    expect(() => pairRuns([run('a', reg, 'r')], [run('a', other, 'v')])).toThrow(/rules-only AHS differs/);
    const changedUnits = clone(prop) as MutableReport;
    const rows = (changedUnits.neuralResults ?? []) as (NeuralResultRow & { unitResults: NeuralUnitRow[] })[];
    if (rows[0] !== undefined) rows[0].unitResults = [unit('x', 'a', 'pass', 0.9)];
    expect(pairRuns([run('a', reg, 'r')], [run('a', changedUnits as EvaluationReport, 'v')])[0]?.sameJudgeUnits).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
// Coding frame and diagnostics

describe('judge coding frame (ADR-028 item 4, §12.4)', () => {
  const loaded = loadCodingFrame(ROOT);
  if (!loaded.ok) throw new Error(loaded.detail);
  const frame: CodingFrame = loaded.frame;

  it('the registered frame is one machine block with the rubric criteria of FF-N01 and FF-N02', () => {
    expect(frame.version).toBe('1.0.0');
    expect(frame.uncoded).toBe('JC-UNCODED');
    expect(codesOf(frame, 'FF-N01')).toEqual(['JC-N01-SPLIT', 'JC-N01-DUP', 'JC-N01-BYPASS', 'JC-UNCODED']);
    expect(codesOf(frame, 'FF-N02')).toEqual(['JC-N02-PERSISTENCE', 'JC-N02-TRANSPORT', 'JC-N02-FRAMEWORK', 'JC-N02-BUSINESS', 'JC-UNCODED']);
  });

  it('codes mechanically: multi-label, own function only, case-insensitive, uncoded otherwise', () => {
    expect(codeRationale(frame, 'FF-N01', 'The module mixes unrelated concerns and DUPLICATES the price rule.')).toEqual(['JC-N01-SPLIT', 'JC-N01-DUP']);
    expect(codeRationale(frame, 'FF-N01', 'The service reaches into the repository and bypasses the facade.')).toEqual(['JC-N01-BYPASS']);
    expect(codeRationale(frame, 'FF-N02', 'Runs a Prisma query and builds the HTTP response with @Injectable.')).toEqual(['JC-N02-PERSISTENCE', 'JC-N02-TRANSPORT', 'JC-N02-FRAMEWORK']);
    expect(codeRationale(frame, 'FF-N02', 'The controller computes the discount, a business rule.')).toEqual(['JC-N02-BUSINESS']);
    // A persistence word is not an FF-N01 criterion; nested is not nest.
    expect(codeRationale(frame, 'FF-N01', 'Uses the database.')).toEqual(['JC-UNCODED']);
    expect(codeRationale(frame, 'FF-N02', 'deeply nested conditionals')).toEqual(['JC-UNCODED']);
    expect(codeRationale(frame, 'FF-X99', 'anything')).toEqual(['JC-UNCODED']);
  });

  it('refuses a missing, doubled or malformed block', () => {
    expect(parseCodingFrame('no block')).toMatchObject({ ok: false, code: JUDGE_CODING_FRAME_INVALID });
    const block = (body: string): string => `\`\`\`yaml judge-coding-frame\n${body}\n\`\`\`\n`;
    const good = 'version: 1.0.0\nuncoded: JC-UNCODED\nfunctions:\n  FF-N01:\n    - code: JC-A\n      rubricClause: c\n      patterns: [\'\\bx\\b\']';
    expect(parseCodingFrame(block(good))).toMatchObject({ ok: true });
    expect(parseCodingFrame(block(good) + block(good))).toMatchObject({ ok: false });
    expect(parseCodingFrame(block(good.replace("'\\bx\\b'", "'(unclosed'")))).toMatchObject({ ok: false });
    expect(parseCodingFrame(block(good.replace('JC-A', 'XX')))).toMatchObject({ ok: false });
    expect(parseCodingFrame(block(good.replace('JC-A', 'JC-UNCODED')))).toMatchObject({ ok: false });
  });
});

function entry(projectId: string, functionId: string, unitId: string, runIndex: number, pass: boolean | null, conf: number, reasoning: string): CassetteEntry {
  return {
    schemaVersion: 2, key: `k-${unitId}-${String(runIndex)}`, requestHash: 'h', repetition: 0, runIndex, functionId, unitId, projectId,
    provider: 'claude-cli', model: 'claude-opus-5-5', effort: 'high', usedOptions: {}, ignoredOptions: [], attempts: 1,
    outcome: pass === null ? { kind: 'invalid', cause: 'PARSE_FAILURE' } : { kind: 'valid' },
    response: '', parsedVerdict: pass === null ? null : { pass, confidence: conf, reasoning, evidence: [], violations: pass ? [] : [{ filePath: unitId, message: `msg ${String(runIndex)}` }] },
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

  it('writes the unit, criteria and summary tables from a run directory and cassettes, with no judge call', () => {
    const dir = mkdtempSync(join(tmpdir(), 'adr028-diag-'));
    try {
      const report = handReport() as EvaluationReport;
      const record = run('proj', report, 'e7-x-000-proj').record;
      mkdirSync(join(dir, 'runs/runs'), { recursive: true });
      mkdirSync(join(dir, 'runs/reports'), { recursive: true });
      writeFileSync(join(dir, 'runs/runs/e7-x-000-proj.run.json'), JSON.stringify({ ...record, reportPath: 'reports/e7-x-000-proj.json' }));
      writeFileSync(join(dir, 'runs/reports/e7-x-000-proj.json'), JSON.stringify(report));
      const entries: CassetteEntry[] = [];
      for (const row of report.neuralResults ?? []) {
        for (const u of row.unitResults) {
          const fail = u.verdict === 'fail';
          for (let i = 0; i < 3; i++) {
            const text = String(row.functionId) === 'FF-N01' ? 'Duplicates the invariant in two places.' : 'Persists through a repository query.';
            entries.push(entry('proj', String(row.functionId), u.unitId, i, !fail, fail ? 0.9 - i * 0.01 : 0.9, fail ? text : 'Clean.'));
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
      const units = (out.files.get('judge_units.csv') ?? '').trimEnd().split('\n');
      expect(units).toHaveLength(9);
      const a1 = units.find((l) => l.includes(',m/a1,')) ?? '';
      expect(a1).toContain(',fail,');
      expect(a1).toContain(',JC-N01-DUP,Duplicates the invariant in two places.,msg 0');
      expect(units.find((l) => l.includes(',f/2,'))).toContain(',false,');
      const criteria = (out.files.get('judge_criteria.csv') ?? '').trimEnd().split('\n');
      // FF-N01 failing units pooled: 3 coded JC-N01-DUP of 3 → share 1.
      expect(criteria).toContain('FF-N01,*,fail,JC-N01-DUP,3,3,1.000000');
      expect(criteria).toContain('FF-N02,proj,fail,JC-N02-PERSISTENCE,1,1,1.000000');
      expect(criteria).toContain('FF-N02,proj,pass,JC-UNCODED,3,3,1.000000');
      const summary = (out.files.get('judge_summary.csv') ?? '').trimEnd().split('\n');
      expect(summary).toContain('FF-N01,proj,4,4,0,3,1,0,0,0.800000,0');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
