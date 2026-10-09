/**
 * ADR-021 SO2; audit SO2-1..5, X-2, X-4: the H13 gate over every RunRecord (a cycle-query timeout is
 * fallback-required), the scripted latency.csv and NFR-07 table, graph size and FLOWS_TO coverage, the FLOWS_TO
 * store accounting, the APG-full vs AST-only ablation and the PROFILE / SCC rows. Fixtures are hand-computed.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ProcessResult, ProcessRunner, ProcessRunOptions } from '../../../src/shared/interfaces/process-runner.js';
import { UNIVERSAL_CYCLE_STAGE } from '../../../src/scoring-engine/universal-metrics.js';
import type { APGResult } from '../../../src/shared/types/apg.js';
import type { PreregCheck } from '../../../scripts/lib/prereg.js';
import type { RunRecord } from '../../../scripts/lib/report-io.js';
import { cliArgv, cycleQueryTimes, loadPlan, runPlan, UNIVERSAL_CYCLE_STAGE as HARNESS_CYCLE_STAGE } from '../../../scripts/run-experiment.js';
import type { ExperimentPlan, HarnessDeps } from '../../../scripts/run-experiment.js';
import { f6 } from '../../../scripts/aggregate.js';
import {
  ablationChange, ablationCsvRows, ablationRows, ablationSummaryRows, ARMS_COLUMNS, armsRow, ffS02Observation, flowsToPerResolvedImport, flowsToStoreRow,
  graphCoverageRows, latencyGateOf, latencyRows, nfr07Rows, planGate, profileRows, sccRows, totalDbHits, universalCycleObservation,
} from '../../../scripts/lib/so2.js';
import type { So2Report, So2Run } from '../../../scripts/lib/so2.js';
import { gateSummary, main, SO2_ARMS_IDENTICAL } from '../../../scripts/so2-metrics.js';
import type { ProfileBackend, So2Deps } from '../../../scripts/so2-metrics.js';

const ROOT = join(__dirname, '../../..');
const read = (p: string): string => readFileSync(p, 'utf8');
const OK_REPORT = read(join(ROOT, 'tests/fixtures/u5b/reports/correct-reference.json'));
const FAILED_REPORT = read(join(ROOT, 'tests/fixtures/u5b/injected/function-failed.json'));
const TIMEOUT_CODE_NEO = 'Neo.ClientError.Transaction.TransactionTimedOutClientConfiguration';

function capture(): { out: (t: string) => void; err: (t: string) => void; writeFile: (p: string, t: string) => void; text: () => string; files: Map<string, string> } {
  let s = '';
  const files = new Map<string, string>();
  return { out: (t) => { s += t; }, err: (t) => { s += t; }, writeFile: (p, t) => { files.set(p, t); }, text: () => s, files };
}

// ---------------------------------------------------------------------------------------------
// Hand-made reports

function rec(over: Partial<RunRecord> = {}): RunRecord {
  return {
    runId: 'latency-gate-000-ghostfolio-test', planId: 'latency-gate', projectId: 'ghostfolio-test', status: 'accepted', attempt: 1,
    specSha: 'a'.repeat(64), cliCommit: 'b'.repeat(40), preregVersion: 2, frozenHashes: {}, envRecordId: 'env-1',
    startedAt: '2026-10-08T12:00:00Z', wallMs: 10, ...over,
  };
}

/** FF-S02 row of `s02Ms`, the universal cycle stage of `metricMs`, 1 200 files, 5 000 / 9 000 graph size. */
function report(s02Ms: number | 'timeout' | 'failed', metricMs: number | 'timeout' | 'absent', extra: Partial<So2Report> = {}): So2Report {
  const fr = typeof s02Ms === 'number' ? [{ functionId: 'FF-S02', name: 'no-cyclic-deps', dimension: 'structural', violationCount: 0, executionTimeMs: s02Ms }] : [];
  const failed = s02Ms === 'timeout' ? [{ functionId: 'FF-S02', name: 'no-cyclic-deps', code: 'EVAL_002' }] : s02Ms === 'failed' ? [{ functionId: 'FF-S02', name: 'no-cyclic-deps', code: 'EVAL_001' }] : [];
  const stages = [{ name: 'ingest-apg', durationMs: 4000, status: 'success' }];
  if (typeof metricMs === 'number') stages.push({ name: UNIVERSAL_CYCLE_STAGE, durationMs: metricMs, status: 'success' });
  if (metricMs === 'timeout') stages.push({ name: UNIVERSAL_CYCLE_STAGE, durationMs: 30_001, status: 'error' });
  return {
    functionResults: fr, functionExecution: { failed }, timings: { stages, totalMs: 50_000 },
    warnings: metricMs === 'timeout' ? [{ code: 'METRIC_001', context: { metric: 'cyclicDependencyCount', code: TIMEOUT_CODE_NEO } }] : [],
    parseCoverage: { total: 1200, percentage: 99.5 }, graphStats: { nodeCount: 5000, edgeCount: 9000 }, ...extra,
  };
}

// ---------------------------------------------------------------------------------------------

describe('cycle query observations (ADR-016 e: both cycle queries)', () => {
  it('reads FF-S02 from its function row and the metric from its stage entry', () => {
    expect(ffS02Observation(report(1200, 800))).toEqual({ ms: 1200, status: 'ok' });
    expect(universalCycleObservation(report(1200, 800))).toEqual({ ms: 800, status: 'ok' });
  });
  it('FF-S02 EVAL_002 is a timeout, EVAL_001 a failure; a metric METRIC_001 with a transaction timeout is a timeout', () => {
    expect(ffS02Observation(report('timeout', 800))).toEqual({ ms: null, status: 'timeout', code: 'EVAL_002' });
    expect(ffS02Observation(report('failed', 800))).toEqual({ ms: null, status: 'failed', code: 'EVAL_001' });
    expect(universalCycleObservation(report(1200, 'timeout'))).toEqual({ ms: 30_001, status: 'timeout', code: TIMEOUT_CODE_NEO });
    expect(universalCycleObservation(report(1200, 'absent'))).toEqual({ ms: null, status: 'absent' });
  });
  it('cycleQueryTimes returns both cycle queries (FF-S02 row first, then the metric stage)', () => {
    expect(cycleQueryTimes(report(1200, 800) as Parameters<typeof cycleQueryTimes>[0])).toEqual([1200, 800]);
    expect(cycleQueryTimes(JSON.parse(OK_REPORT) as Parameters<typeof cycleQueryTimes>[0])).toEqual([3]);
  });
});

describe('latencyGateOf over RunRecords (BR-U5b-49; audit SO2-1)', () => {
  it('both within 30 s: pass', () => {
    expect(latencyGateOf(rec(), report(1200, 800))).toMatchObject({ result: 'pass', cause: 'both cycle queries within 30000 ms' });
  });
  it('a rejected run whose FF-S02 timed out (function-timeout) is fallback-required, not dropped', () => {
    const g = latencyGateOf(rec({ status: 'rejected', reasonCode: 'function-timeout' }), report('timeout', 800));
    expect(g).toMatchObject({ result: 'fallback-required', cause: 'FF-S02 timed out (EVAL_002)' });
  });
  it('a rejected run whose cycle metric timed out (metric-failed) is fallback-required', () => {
    const g = latencyGateOf(rec({ status: 'rejected', reasonCode: 'metric-failed' }), report(1200, 'timeout'));
    expect(g).toMatchObject({ result: 'fallback-required', cause: `universal cycle metric timed out (${TIMEOUT_CODE_NEO})` });
  });
  it('a cycle query over the budget is fallback-required (31 000 > 30 000; 30 000 is within)', () => {
    expect(latencyGateOf(rec(), report(31_000, 800)).result).toBe('fallback-required');
    expect(latencyGateOf(rec(), report(31_000, 800)).cause).toBe('FF-S02 31000 ms > 30000');
    expect(latencyGateOf(rec(), report(30_000, 30_000)).result).toBe('pass');
  });
  it('no report, a non-timeout failure or a missing metric time is inconclusive', () => {
    expect(latencyGateOf(rec({ status: 'rejected', reasonCode: 'transport-error' }), undefined))
      .toMatchObject({ result: 'inconclusive', cause: 'no report (rejected, transport-error): cycle query times unknown' });
    expect(latencyGateOf(rec({ status: 'rejected', reasonCode: 'function-failed' }), report('failed', 800)))
      .toMatchObject({ result: 'inconclusive', cause: 'FF-S02 failed (EVAL_001)' });
    expect(latencyGateOf(rec(), report(1200, 'absent'))).toMatchObject({ result: 'inconclusive', cause: 'universal cycle metric absent' });
  });
  it('a timeout of another function is named but does not decide the gate (the fallback replaces cycle queries only)', () => {
    const r = report(1200, 800, { functionExecution: { failed: [{ functionId: 'FF-C01', name: 'module-fan-out', code: 'EVAL_002' }] } });
    expect(latencyGateOf(rec({ status: 'rejected', reasonCode: 'function-timeout' }), r))
      .toMatchObject({ result: 'pass', cause: 'both cycle queries within 30000 ms; other timeouts (not cycle queries): FF-C01' });
  });
  it('planGate: any fallback wins, then any inconclusive (or no run), else pass', () => {
    const p = { result: 'pass' as const, cause: '', ffS02: { ms: 1, status: 'ok' as const }, universal: { ms: 1, status: 'ok' as const } };
    expect(planGate([p, { ...p, result: 'fallback-required' }, { ...p, result: 'inconclusive' }])).toBe('fallback-required');
    expect(planGate([p, { ...p, result: 'inconclusive' }])).toBe('inconclusive');
    expect(planGate([])).toBe('inconclusive');
    expect(planGate([p, p])).toBe('pass');
  });
});

describe('the harness path: a timed-out FF-S02 reaches latency.csv as fallback-required (audit SO2-1)', () => {
  let out = '';
  beforeEach(() => { out = mkdtempSync(join(tmpdir(), 'so2-gate-')); });
  afterEach(() => { rmSync(out, { recursive: true, force: true }); });

  const PASS_GATE = (): PreregCheck => ({
    ok: true,
    prereg: { version: 2, registeredAt: '2026-10-01T00:00:00Z', matchingRuleVersion: '1.0.0', artefacts: [], labellingBudgetCalls: 0, e1Grid: { models: 3, specLevels: 3, tasks: 2, runs: 3 } },
    frozenHashes: { 'experiments/latency-gate/plan.json': 'a'.repeat(64) },
  });

  it('rejected function-timeout RunRecord, stored report, then tables → gate.json fallback-required', async () => {
    const timedOut = JSON.parse(FAILED_REPORT) as { functionExecution: { failed: { code: string }[] } };
    for (const f of timedOut.functionExecution.failed) f.code = 'EVAL_002';
    const runner: ProcessRunner = {
      run: (_c: string, _a: readonly string[], _o: ProcessRunOptions) => Promise.resolve({
        success: true as const, data: { exitCode: 1, stdout: JSON.stringify(timedOut), stderr: '', timedOut: false, durationMs: 5 } satisfies ProcessResult,
      }),
    };
    let t = Date.parse('2026-10-08T12:00:00Z');
    const deps: HarnessDeps = {
      runner, cli: { command: 'fake-cli', args: [] }, parentEnv: { PATH: '/bin' }, now: () => new Date((t += 10)), cliCommit: 'c'.repeat(40),
      recordEnvironment: (id) => Promise.resolve({ id: `env-${id}`, record: { id: `env-${id}` } }), gate: PASS_GATE, outDir: out,
    };
    const plan: ExperimentPlan = {
      id: 'latency-gate', experiment: 'latency-gate', mode: 'symbolic-only', seeds: { sampling: 2101, bootstrap: 2102, permutation: 2103 },
      cassetteDir: 'experiments/latency-gate/cassettes', outDir: 'results/latency-gate',
      projects: [{ projectId: 'ghostfolio-test', path: 'p/g', specPath: 'specs/clean-arch.yaml' }],
    };
    const result = await runPlan(plan, join(ROOT, 'experiments/latency-gate/plan.json'), ROOT, deps);
    expect(result.records.map((r) => [r.status, r.reasonCode])).toEqual([['rejected', 'function-timeout']]);

    const files = new Map<string, string>();
    const io = { out: () => undefined, err: () => undefined, writeFile: (p: string, text: string) => { files.set(p, text); } };
    expect(await main(['tables', '--run-dir', out, '--out', join(out, 'so2')], ROOT, io)).toBe(0);
    const gate = JSON.parse(files.get(join(out, 'so2', 'gate.json')) ?? '{}') as Record<string, { result: string }>;
    expect(gate['latency-gate']?.result).toBe('fallback-required');
    const latency = (files.get(join(out, 'so2', 'latency.csv')) ?? '').trim().split('\n');
    expect(latency).toHaveLength(2);
    expect(latency[1]).toContain(',rejected,function-timeout,');
    expect(latency[1]).toContain(',timeout,');
    expect(latency[1]?.endsWith(',fallback-required,FF-S02 timed out (EVAL_002)')).toBe(true);
  });
});

describe('rows (hand-computed)', () => {
  const runs: So2Run[] = [
    { record: rec(), report: report(1200, 800) },
    { record: rec({ runId: 'e7-corpus-001-dry-run-test', planId: 'e7-corpus', projectId: 'dry-run-test' }), report: report(40, 25, { parseCoverage: { total: 120, percentage: 100 } }) },
    { record: rec({ runId: 'latency-gate-001-x', projectId: 'x', status: 'rejected', reasonCode: 'transport-error' }), report: undefined },
  ];

  it('latency.csv: one row per RunRecord, including the run without a report', () => {
    const rows = latencyRows(runs);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual([
      'latency-gate-000-ghostfolio-test', 'latency-gate', 'ghostfolio-test', 'accepted', '', '1200', '50000',
      `ingest-apg:4000;${UNIVERSAL_CYCLE_STAGE}:800`, '1200', 'ok', '800', 'ok', '30000', 'pass', 'both cycle queries within 30000 ms',
    ]);
    expect(rows[2]?.slice(3, 6)).toEqual(['rejected', 'transport-error', '']);
    expect(rows[2]?.[13]).toBe('inconclusive');
  });

  it('nfr07_latency.csv: runs with a report, sorted by project; NFR-07 scope is <= 300 files', () => {
    const rows = nfr07Rows(runs);
    expect(rows.map((r) => r[0])).toEqual(['dry-run-test', 'ghostfolio-test']);
    expect(rows[0]).toEqual(['dry-run-test', 'e7-corpus', 'e7-corpus-001-dry-run-test', 'accepted', '120', 'true', '5000', '9000', '50000', '40', '25', '40', '30000', 'true']);
    expect(rows[1]?.[5]).toBe('false');
  });

  it('nfr07_latency.csv leaves out the AST-only arm of an apg-ablation run', () => {
    const ablation: So2Run[] = [
      { record: rec({ runId: 'apg-ablation-004', planId: 'apg-ablation', projectId: 'truthy-demo' }), report: report(30, 20, { parseCoverage: { total: 250, percentage: 100 } }) },
      { record: rec({ runId: 'apg-ablation-005', planId: 'apg-ablation', projectId: 'truthy-demo@ast-only' }), report: report(10, 5) },
    ];
    expect(nfr07Rows(ablation).map((r) => [r[0], r[1], r[5], r[11]])).toEqual([['truthy-demo', 'apg-ablation', 'true', '30']]);
  });

  it('graph_coverage.csv: by-type counts and FLOWS_TO per resolved import (3 / 12 = 0.25)', () => {
    const r = report(1, 1, {
      importResolution: { resolvedInternal: 12 },
      graphStats: { nodeCount: 40, edgeCount: 70, layerCoverage: 0.875, nodeCountByType: { File: 10, Class: 20 }, edgeCountByType: { IMPORTS: 30, FLOWS_TO: 3, CONSTRUCTOR_INJECTS: 5 } },
      parseCoverage: { total: 10, percentage: 90 },
    });
    const [row] = graphCoverageRows([{ record: rec(), report: r }], f6);
    expect(row?.slice(0, 7)).toEqual(['latency-gate-000-ghostfolio-test', 'ghostfolio-test', '10', '0.900000', '40', '70', '0.875000']);
    expect(row?.slice(-2)).toEqual(['12', '0.250000']);
    expect(row).toContain('30');
    expect(flowsToPerResolvedImport(3, 0)).toBeNull();
  });

  it('flows_to_stores.csv row: yield = edges / candidates (2 / 3), per resolved import (2 / 8)', () => {
    expect(flowsToStoreRow('p', { stores: 5, candidates: 3, skippedUnionOrIntersection: 0, skippedUnextractedTarget: 1, skippedSelfLoop: 1, edges: 2 }, 8, f6))
      .toEqual(['p', '5', '3', '0', '1', '1', '2', '0.666667', '8', '0.250000']);
    expect(flowsToStoreRow('q', { stores: 0, candidates: 0, skippedUnionOrIntersection: 0, skippedUnextractedTarget: 0, skippedSelfLoop: 0, edges: 0 }, 0, f6).slice(7))
      .toEqual(['', '0', '']);
  });
});

describe('APG-full vs AST-only ablation (audit SO2-5, X-2)', () => {
  const fr = (functionId: string, violationCount: number): { functionId: string; name: string; dimension: string; violationCount: number } =>
    ({ functionId, name: functionId.toLowerCase(), dimension: 'structural', violationCount });
  const v = (functionId: string, id: string): { functionId: string; id: string } => ({ functionId, id });
  const full: So2Report = {
    functionResults: [fr('FF-S01', 2), fr('FF-S02', 1), fr('FF-P06', 0), fr('FF-C01', 3), fr('FF-C02', 1), fr('FF-X', 4)],
    violations: [v('FF-S01', 'a'), v('FF-S01', 'b'), v('FF-S02', 'c'), v('FF-C01', 'd'), v('FF-C01', 'e'), v('FF-C01', 'f'), v('FF-C02', 'g')],
  };
  const ast: So2Report = {
    functionResults: [fr('FF-S01', 1), fr('FF-S02', 0), fr('FF-P06', 2), fr('FF-C01', 3), fr('FF-C02', 2)],
    violations: [v('FF-S01', 'a'), v('FF-P06', 'h'), v('FF-P06', 'i'), v('FF-C01', 'd'), v('FF-C01', 'e'), v('FF-C01', 'z'), v('FF-C02', 'g'), v('FF-C02', 'k')],
  };
  const runs: So2Run[] = [
    { record: rec({ projectId: 'p@ast-only', runId: 'r2' }), report: ast },
    { record: rec({ projectId: 'p', runId: 'r1' }), report: full },
  ];

  it('ablationChange covers every case', () => {
    expect([ablationChange(2, 0), ablationChange(0, 2), ablationChange(3, 1), ablationChange(1, 3), ablationChange(2, 2), ablationChange(null, 1)])
      .toEqual(['lost', 'gained', 'fewer', 'more', 'same', 'not-run']);
  });

  it('per function: counts, change and violation-id differences', () => {
    const rows = ablationRows(runs);
    expect(rows.map((r) => [r.functionId, r.violationsFull, r.violationsAstOnly, r.change, r.lostIds, r.gainedIds])).toEqual([
      ['FF-C01', 3, 3, 'same', 1, 1],
      ['FF-C02', 1, 2, 'more', 0, 1],
      ['FF-P06', 0, 2, 'gained', 0, 2],
      ['FF-S01', 2, 1, 'fewer', 1, 0],
      ['FF-S02', 1, 0, 'lost', 1, 0],
      ['FF-X', 4, null, 'not-run', 0, 0],
    ]);
    expect(ablationCsvRows(rows)[4]).toEqual(['p', 'FF-S02', 'ff-s02', 'structural', '1', '0', 'true', 'false', 'lost', '1', '0']);
    expect(ablationCsvRows(rows)[5]?.slice(4, 8)).toEqual(['4', '', 'true', '']);
  });

  it('summary over the functions run in both arms: 5 compared; detected 4 / 4; violations 7 -> 8', () => {
    expect(ablationSummaryRows(ablationRows(runs))).toEqual([['p', '5', '4', '4', '1', '1', '1', '1', '7', '8', '1']]);
  });
});

describe('PROFILE and SCC rows (Steps 23, 25)', () => {
  it('totalDbHits sums the plan tree', () => {
    expect(totalDbHits({ dbHits: 5, children: [{ dbHits: 7, children: [{ dbHits: 1 }] }, { dbHits: 2 }] })).toBe(15);
    expect(totalDbHits(undefined)).toBeNull();
  });
  it('repetition 0 is the warm-up; FF-S02 truncation is rows > cap; a timeout row has no times', () => {
    const rows = profileRows('g', 'ff-s02', [
      { availableMs: 10, consumedMs: 5, dbHits: 100, rows: 101, timedOut: false },
      { availableMs: 8, consumedMs: 4, dbHits: 100, rows: 3, timedOut: false },
      { availableMs: null, consumedMs: null, dbHits: null, rows: null, timedOut: true, code: TIMEOUT_CODE_NEO },
    ], 10, 100);
    expect(rows).toEqual([
      ['g', 'ff-s02', '0', 'true', '10', '5', '15', '100', '101', '10', '100', 'true', 'false', ''],
      ['g', 'ff-s02', '1', 'false', '8', '4', '12', '100', '3', '10', '100', 'false', 'false', ''],
      ['g', 'ff-s02', '2', 'false', '', '', '', '', '', '10', '100', '', 'true', TIMEOUT_CODE_NEO],
    ]);
    expect(profileRows('g', 'universal-cycle-metric', [{ availableMs: 1, consumedMs: 1, dbHits: 9, rows: 1, timedOut: false }], 10, 100)[0]?.[11]).toBe('');
  });
  it('scc rows flag components larger than MAX_CYCLE_LENGTH', () => {
    const big = Array.from({ length: 11 }, (_, i) => `f${String(i).padStart(2, '0')}.ts`);
    expect(sccRows('g', [['a.ts', 'b.ts'], big], 10)).toEqual([
      ['g', '0', '2', 'false', 'a.ts'],
      ['g', '1', '11', 'true', 'f00.ts'],
    ]);
  });
});

describe('so2-metrics CLI', () => {

  it('--self-test runs a known-bad input (missing run directory) and exits 1', async () => {
    const io = capture();
    expect(await main(['--self-test'], ROOT, io)).toBe(1);
    expect(io.text()).toContain('AGGREGATE_INPUT_INVALID');
    expect(io.files.size).toBe(0);
  });

  it('usage errors exit 2', async () => {
    expect(await main([], ROOT, capture())).toBe(2);
    expect(await main(['tables', '--run-dir'], ROOT, capture())).toBe(2);
    expect(await main(['nope', '--out', 'x'], ROOT, capture())).toBe(2);
  });

  it('flows-to extracts every full entry of a plan (injected extractor) and skips ast-only entries', async () => {
    const io = capture();
    const seen: string[] = [];
    const apg = { importResolution: { resolvedInternal: 8 }, flowsTo: { stores: 5, candidates: 3, skippedUnionOrIntersection: 0, skippedUnextractedTarget: 1, skippedSelfLoop: 1, edges: 2 } } as unknown as APGResult;
    const deps: So2Deps = { extract: (p, mode) => { seen.push(`${p}:${mode}`); return Promise.resolve(apg); } };
    expect(await main(['flows-to', '--plan', 'experiments/apg-ablation/plan.json', '--out', '/o'], ROOT, io, deps)).toBe(0);
    expect(seen).toHaveLength(9);
    expect(seen.every((s) => s.endsWith(':full'))).toBe(true);
    const csv = (io.files.get('/o/flows_to_stores.csv') ?? '').trim().split('\n');
    expect(csv).toHaveLength(10);
    expect(csv[1]).toBe('realworld-test,5,3,0,1,1,2,0.666667,8,0.250000');
  });

  it('profile: warm-up plus --reps per query through the backend, SCC rows from the extracted APG', async () => {
    const io = capture();
    const calls: string[] = [];
    const backend: ProfileBackend = {
      ingest: () => { calls.push('ingest'); return Promise.resolve(); },
      cycleTemplate: () => Promise.resolve({ cypher: 'MATCH cycle', params: { maxLen: 10 } }),
      profile: (cypher) => { calls.push(cypher.startsWith('MATCH cycle') ? 'ff' : 'metric'); return Promise.resolve({ availableMs: 2, consumedMs: 1, dbHits: 7, rows: 1, timedOut: false }); },
      close: () => { calls.push('close'); return Promise.resolve(); },
    };
    const apg = {
      nodes: [{ id: 'fa', type: 'File', filePath: 'a.ts' }, { id: 'fb', type: 'File', filePath: 'b.ts' }],
      edges: [{ id: 'e1', type: 'IMPORTS', sourceId: 'fa', targetId: 'fb' }, { id: 'e2', type: 'IMPORTS', sourceId: 'fb', targetId: 'fa' }],
    } as unknown as APGResult;
    const deps: So2Deps = { extract: () => Promise.resolve(apg), profileBackend: () => Promise.resolve(backend) };
    expect(await main(['profile', '--project', 'p', '--spec', 's.yaml', '--project-id', 'g', '--out', '/o', '--reps', '2'], ROOT, io, deps)).toBe(0);
    expect(calls).toEqual(['ingest', 'ff', 'ff', 'ff', 'metric', 'metric', 'metric', 'close']);
    expect((io.files.get('/o/profile.csv') ?? '').trim().split('\n')).toHaveLength(7);
    expect((io.files.get('/o/scc_components.csv') ?? '').trim().split('\n')[1]).toBe('g,0,2,false,a.ts');
  });

  it('gateSummary groups runs by plan id', () => {
    const s = gateSummary([{ record: rec(), report: report(1, 1) }, { record: rec({ planId: 'e7-corpus', runId: 'e' }), report: report('timeout', 1) }]);
    expect(Object.keys(s)).toEqual(['e7-corpus', 'latency-gate']);
    expect(s['e7-corpus']?.result).toBe('fallback-required');
    expect(s['latency-gate']?.result).toBe('pass');
  });
});

describe('apg-ablation plan and the --graph-mode argument (audit SO2-5)', () => {
  it('the registered-candidate plan loads: 9 bases x 2 arms, symbolic-only', () => {
    const l = loadPlan(join(ROOT, 'experiments/apg-ablation/plan.json'), ROOT);
    if (!l.ok) throw new Error(l.detail);
    expect(l.plan.projects).toHaveLength(18);
    expect(l.plan.mode).toBe('symbolic-only');
    expect(l.plan.projects.filter((p) => p.graphMode === 'ast-only').map((p) => p.projectId).every((id) => id.endsWith('@ast-only'))).toBe(true);
  });
  it('an ast-only entry passes --graph-mode ast-only; a full entry passes nothing', () => {
    const plan = { mode: 'symbolic-only' } as ExperimentPlan;
    expect(cliArgv(plan, { index: 0, projectId: 'a@ast-only', path: 'p', specPath: 's', graphMode: 'ast-only' }))
      .toEqual(['evaluate', '--project', 'p', '--spec', 's', '--format', 'json', '--symbolic-only', '--graph-mode', 'ast-only']);
    expect(cliArgv(plan, { index: 0, projectId: 'a', path: 'p', specPath: 's', graphMode: 'full' })).not.toContain('--graph-mode');
  });
});

describe('apg_arms.csv: the two arms differ (ADR-021 item 8; audit SO2-5, X-2)', () => {
  const g = (types: string[], resolvedInternal: number): APGResult =>
    ({ edges: types.map((type) => ({ type })), importResolution: { resolvedInternal } }) as unknown as APGResult;
  // Full: IMPORTS 2, DECLARES 1, CONTAINS 1, CALLS 2, FLOWS_TO 1, RE_EXPORTS 1 = 8; ast-only keeps 4: removed 4
  // (RE_EXPORTS 1, CALLS 2, FLOWS_TO 1), resolved internal 2 in both.
  const full = g(['IMPORTS', 'IMPORTS', 'RE_EXPORTS', 'DECLARES', 'CONTAINS', 'CALLS', 'CALLS', 'FLOWS_TO'], 2);
  const ast = g(['IMPORTS', 'IMPORTS', 'DECLARES', 'CONTAINS'], 2);

  it('armsRow counts removed edges per type', () => {
    const row = armsRow('b', full, ast);
    const col = (c: string): string | undefined => row[ARMS_COLUMNS.indexOf(c)];
    expect(row).toHaveLength(ARMS_COLUMNS.length);
    expect([col('edges_full'), col('edges_ast_only'), col('edges_removed')]).toEqual(['8', '4', '4']);
    expect([col('removed_imports'), col('removed_re_exports'), col('removed_calls'), col('removed_flows_to'), col('removed_contains')]).toEqual(['0', '1', '2', '1', '0']);
    expect([col('resolved_internal_full'), col('resolved_internal_ast_only'), col('arms_differ')]).toEqual(['2', '2', 'true']);
  });

  it('identical arms give arms_differ false', () => {
    expect(armsRow('b', ast, ast).at(-1)).toBe('false');
  });

  it('arms extracts both arms of each pair of the apg-ablation plan (injected extractor)', async () => {
    const io = capture();
    const seen: string[] = [];
    const deps: So2Deps = { extract: (_p, mode) => { seen.push(mode); return Promise.resolve(mode === 'full' ? full : ast); } };
    expect(await main(['arms', '--plan', 'experiments/apg-ablation/plan.json', '--out', '/o'], ROOT, io, deps)).toBe(0);
    expect(seen).toHaveLength(18);
    const csv = (io.files.get('/o/apg_arms.csv') ?? '').trim().split('\n');
    expect(csv).toHaveLength(10);
    expect(csv[1]?.startsWith('realworld-test,8,4,4,')).toBe(true);
  });

  it('arms exits 1 with SO2_ARMS_IDENTICAL when no pair differs', async () => {
    const io = capture();
    const deps: So2Deps = { extract: () => Promise.resolve(ast) };
    expect(await main(['arms', '--plan', 'experiments/apg-ablation/plan.json', '--out', '/o'], ROOT, io, deps)).toBe(1);
    expect(io.text()).toContain(SO2_ARMS_IDENTICAL);
  });

  it('the harness cycle stage name equals the C8 UNIVERSAL_CYCLE_STAGE (BR-U5b-55 keeps them apart)', () => {
    expect(HARNESS_CYCLE_STAGE).toBe(UNIVERSAL_CYCLE_STAGE);
  });
});
