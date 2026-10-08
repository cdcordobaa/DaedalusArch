/**
 * U3-R9: one assembly point (FR-13, FR-14; ADR-016 c; BR-U3-01..03, 50..57, 62..64; TF-10, TF-16).
 * C6 failures and timeout pass-through, CompileCommand facts and warning routing on the real compiler,
 * AssembleReportCommand on a stub context, the run-level type test (BR-U3-55) and the golden-runner static.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { evaluateSymbolic, failureCodeOf } from '../../../src/evaluation-engine/symbolic-evaluator.js';
import { CompileCommand } from '../../../src/pipeline/commands/compile-command.js';
import type { CompileFactsHolder } from '../../../src/pipeline/commands/compile-command.js';
import { AssembleReportCommand } from '../../../src/pipeline/commands/assemble-report-command.js';
import { SymbolicEvaluateCommand } from '../../../src/pipeline/commands/symbolic-evaluate-command.js';
import { FirewallContext } from '../../../src/shared/context/firewall-context.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { GraphRepository, QueryOptions, QueryResult } from '../../../src/shared/interfaces/graph-repository.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import { ahsScore, avrScore, functionId, runId } from '../../../src/shared/types/value-objects.js';
import type { APGResult } from '../../../src/shared/types/apg.js';
import type {
  CompiledFunctions, CypherQuery, EvaluationReport, IngestionResult, ScoredReport,
} from '../../../src/shared/types/evaluation.js';
import type { Dimension, EvaluationMode } from '../../../src/shared/types/enums.js';
import type { FitnessFunction, ParsedSpec } from '../../../src/shared/types/spec.js';

const ROOT = path.resolve(__dirname, '../../..');

// ---------------------------------------------------------------- stubs

const PARAMETER_MISSING = 'Neo.ClientError.Statement.ParameterMissing';

/** The seven HEAD queries that failed on the unfixed spec (BR-U3-01; FR-13 acceptance via the stub). */
const HEAD_FAILING: readonly (readonly [string, string, Dimension])[] = [
  ['FF-CV02', 'naming-services', 'convention'],
  ['FF-CV03', 'naming-repos', 'convention'],
  ['FF-CV04', 'naming-controllers', 'convention'],
  ['FF-P01', 'domain-purity', 'pattern'],
  ['FF-SO01', 'single-responsibility-proxy', 'solid'],
  ['FF-SO02', 'interface-segregation-proxy', 'solid'],
  ['FF-SO03', 'inheritance-depth', 'solid'],
];

function query(id: string, name: string, dimension: Dimension): CypherQuery {
  return { functionId: functionId(id), name, cypher: `/*${id}*/ RETURN 1`, params: {}, dimension, severity: 'major', route: 'symbolic', source: 'template' };
}

const QUERIES: readonly CypherQuery[] = [
  query('FF-S01', 'dependency-direction', 'structural'),
  ...HEAD_FAILING.map(([id, name, dim]) => query(id, name, dim)),
  query('FF-C02', 'module-fan-out', 'coupling'),
];

interface Call { readonly cypher: string; readonly options: QueryOptions | undefined; readonly argCount: number }

function stubRepository(failing: ReadonlyMap<string, string>): { repo: GraphRepository; calls: Call[] } {
  const calls: Call[] = [];
  const repo: GraphRepository = {
    executeQuery(cypher: string, ...rest: [Record<string, unknown>?, QueryOptions?]): Promise<DomainResult<QueryResult>> {
      calls.push({ cypher, options: rest[1], argCount: 1 + rest.length });
      const id = /\/\*(.+?)\*\//.exec(cypher)?.[1] ?? '';
      const code = failing.get(id);
      if (code !== undefined) return Promise.resolve(DomainResult.fail<QueryResult>([{ code, message: `Expected parameter(s): x (${id})` }]));
      return Promise.resolve(DomainResult.ok({ records: [], summary: { resultAvailableAfter: 0, resultConsumedAfter: 0 } } as unknown as QueryResult));
    },
    clearGraph() { return Promise.resolve(DomainResult.ok(undefined)); },
    healthCheck() { return Promise.resolve(true); },
    close() { return Promise.resolve(); },
  };
  return { repo, calls };
}

// ---------------------------------------------------------------- C6 failures (BR-U3-01..03)

describe('C6 function failures (BR-U3-01, TF-16)', () => {
  it('seven failing HEAD queries give 7 failures, no result for them and 7 warnings with the same code and message', async () => {
    const failing = new Map(HEAD_FAILING.map(([id]) => [id, PARAMETER_MISSING]));
    const { repo } = stubRepository(failing);
    const out = await evaluateSymbolic({ queries: QUERIES, graphRepository: repo });
    if (!out.success) throw new Error('evaluateSymbolic failed');
    expect(out.data.failures).toHaveLength(7);
    expect(out.data.failures.map((f) => String(f.functionId))).toEqual(HEAD_FAILING.map(([id]) => id));
    expect(out.data.failures.every((f) => f.code === 'EVAL_001')).toBe(true);
    expect(out.data.failures.map((f) => f.name)).toEqual(HEAD_FAILING.map(([, name]) => name));
    expect(out.data.results.map((r) => String(r.functionId))).toEqual(['FF-S01', 'FF-C02']);
    expect(out.data.warnings).toHaveLength(7);
    expect(out.data.warnings.map((w) => [w.code, w.message, w.stage])).toEqual(out.data.failures.map((f) => [f.code, f.message, 'evaluation-engine']));
  });

  it('the same stub succeeding gives failures === [] and the field is present', async () => {
    const { repo } = stubRepository(new Map());
    const out = await evaluateSymbolic({ queries: QUERIES, graphRepository: repo });
    if (!out.success) throw new Error('evaluateSymbolic failed');
    expect(out.data).toHaveProperty('failures');
    expect(out.data.failures).toEqual([]);
    expect(out.data.results).toHaveLength(QUERIES.length);
    expect(out.data.warnings).toEqual([]);
  });

  it('SymbolicEvaluateCommand forwards the failures into EvaluationResults (7, then 0, present in both)', async () => {
    for (const [failing, expected] of [[new Map(HEAD_FAILING.map(([id]) => [id, PARAMETER_MISSING])), 7], [new Map<string, string>(), 0]] as const) {
      const context = new FirewallContext(runId('r9'));
      context.setCompiledFunctions({ symbolicQueries: QUERIES, neuronalInstructions: [], hybridPairs: [], totalCompiled: QUERIES.length, disabledFunctions: [], warnings: [] });
      const { repo } = stubRepository(failing);
      const res = await new SymbolicEvaluateCommand(repo).execute(context);
      expect(res.success).toBe(true);
      expect(context.getEvaluationResults().failures).toHaveLength(expected);
      expect(context.warnings.filter((w) => w.code === 'EVAL_001')).toHaveLength(expected);
    }
  });
});

describe('timeout code (BR-U3-02, TF-10)', () => {
  // Re-checked 2026-10-08 against the Neo4j 5 status-code list (Neo.ClientError.Transaction): both timeout codes exist.
  it.each([
    ['Neo.ClientError.Transaction.TransactionTimedOutClientConfiguration', 'EVAL_002'],
    ['Neo.ClientError.Transaction.TransactionTimedOut', 'EVAL_002'],
    [PARAMETER_MISSING, 'EVAL_001'],
    [undefined, 'EVAL_001'],
  ] as const)('%s maps to %s', (code, expected) => {
    expect(failureCodeOf(code)).toBe(expected);
  });

  it('the evaluator records EVAL_002 for a timed-out query and EVAL_001 for a missing parameter', async () => {
    const { repo } = stubRepository(new Map([
      ['FF-S01', 'Neo.ClientError.Transaction.TransactionTimedOutClientConfiguration'],
      ['FF-C02', 'Neo.ClientError.Transaction.TransactionTimedOut'],
      ['FF-P01', PARAMETER_MISSING],
    ]));
    const out = await evaluateSymbolic({ queries: QUERIES, graphRepository: repo });
    if (!out.success) throw new Error('evaluateSymbolic failed');
    expect(out.data.failures.map((f) => [String(f.functionId), f.code])).toEqual([
      ['FF-S01', 'EVAL_002'], ['FF-P01', 'EVAL_001'], ['FF-C02', 'EVAL_002'],
    ]);
  });
});

describe('evaluator timeout (BR-U3-03)', () => {
  it('passes no timeout unless queryTimeoutMs is set', async () => {
    const { repo, calls } = stubRepository(new Map());
    await evaluateSymbolic({ queries: QUERIES, graphRepository: repo });
    expect(calls).toHaveLength(QUERIES.length);
    for (const c of calls) {
      expect(c.options).toBeUndefined();
      expect(c.argCount).toBe(2);
    }
  });

  it('passes exactly queryTimeoutMs when set', async () => {
    const { repo, calls } = stubRepository(new Map());
    await evaluateSymbolic({ queries: QUERIES, graphRepository: repo, queryTimeoutMs: 1234 });
    for (const c of calls) expect(c.options).toEqual({ timeoutMs: 1234 });
  });
});

// ---------------------------------------------------------------- CompileCommand on the real compiler

async function loadSpec(file: string): Promise<ParsedSpec> {
  const r = await parseSpec({ specFilePath: path.join(ROOT, file) });
  if (!r.success) throw new Error(`${file} did not parse`);
  return r.data;
}

describe('CompileCommand (BR-U3-52, BR-U3-56)', () => {
  it('a COMPILER_002 symbolic function and a neuronal function without semanticCriteria are both dropped, ascending', async () => {
    const spec = await loadSpec('specs/clean-arch.yaml');
    const extra: FitnessFunction[] = [
      { id: functionId('FF-X01'), name: 'no-such-template', dimension: 'pattern', severity: 'major', route: 'symbolic', isBuiltIn: false, validated: true, enabled: true, excludePaths: [] },
      { id: functionId('FF-N09'), name: 'judge-without-criteria', dimension: 'semantic', severity: 'major', route: 'neuronal', isBuiltIn: false, validated: true, enabled: true, excludePaths: [] },
    ];
    const context = new FirewallContext(runId('r9'));
    context.setParsedSpec({ ...spec, fitnessFunctions: [...spec.fitnessFunctions, ...extra] });
    const holder: CompileFactsHolder = {};
    const res = await new CompileCommand(holder).execute(context);
    expect(res.success).toBe(true);
    // U1's merged CompiledFunctions exposes no dropped ids, so the set difference is the only source.
    expect(context.getCompiledFunctions()).not.toHaveProperty('droppedFunctions');
    expect(holder.facts).toEqual({ declared: spec.fitnessFunctions.length + 2, adrDerived: 0, dropped: ['FF-N09', 'FF-X01'] });
    expect(context.warnings.filter((w) => w.code === 'COMPILER_002').map((w) => w.context?.functionId)).toEqual(['FF-X01']);
  });

  it('specs/clean-arch.yaml: exactly one COMPILER_004, naming FF-S03, reaches the context (BR-U3-56, BR-U1-18)', async () => {
    const context = new FirewallContext(runId('r9'));
    context.setParsedSpec(await loadSpec('specs/clean-arch.yaml'));
    await new CompileCommand().execute(context);
    const c004 = context.warnings.filter((w) => w.code === 'COMPILER_004');
    expect(c004).toHaveLength(1);
    expect(c004[0]).toMatchObject({ stage: 'compile-functions', context: { functionId: 'FF-S03' } });
    expect(c004.map((w) => w.message.includes('FF-S03'))).toEqual([true]);
  });
});

// ---------------------------------------------------------------- AssembleReportCommand

function scored(mode: EvaluationMode, functionCount: number): ScoredReport {
  return {
    runId: runId('run-r9'), projectPath: '/p', specVersion: '1', ahsDeterministic: ahsScore(1), verdict: 'pass',
    scoring: {
      weights: { structural: 0.35, coupling: 0.2, pattern: 0.3, solid: 0.1, convention: 0.05, semantic: 0, integrity: 0 },
      thresholds: { pass: 0.8, warning: 0.65, softBlock: 0.5 },
      confidenceThresholds: { high: 0.85, medium: 0.6, iccMinimum: 0.7 },
      verdictSource: 'ahsDeterministic',
    },
    perDimensionScores: functionCount > 0
      ? [{ dimension: 'structural', avr: avrScore(0), violatedWeight: 0, weight: 1, effectiveWeight: 1, violationCount: 0, functionCount }]
      : [],
    violations: [],
    universalMetrics: { cyclicDependencyCount: 0, maxFanOut: 0, maxFanIn: 0, abstractionRatio: null, averageInstability: null, orphanFileCount: 0 },
    evaluationMode: mode, durationMs: 1, droppedDimensions: [],
  };
}

const APG = {
  nodes: [], edges: [], warnings: [],
  parseCoverage: { total: 2, parsed: 2, percentage: 100, skipped: [] },
  importResolution: { resolvedInternal: 1, external: 3, unresolved: 0, unsupportedDynamic: 0, externalOutOfRootAlias: 0, droppedNoFileNode: 0 },
} as unknown as APGResult;

const INGESTION: IngestionResult = {
  graphStats: { nodeCount: 4, edgeCount: 2, layerCoverage: 1, nodeCountByType: { File: 2 }, edgeCountByType: { IMPORTS: 2, FLOWS_TO: 0 } },
  layerAnnotationSummary: { mapped: 2, unmapped: 0, unmappedFiles: [] },
};

const COMPILED: CompiledFunctions = {
  symbolicQueries: [query('FF-S01', 'dependency-direction', 'structural'), query('FF-S04', 'no-domain-outward-dep', 'structural')],
  neuronalInstructions: [], hybridPairs: [], totalCompiled: 2,
  disabledFunctions: [{ id: functionId('FF-S03'), name: 'no-layer-skip', reason: 'not applicable to style clean-architecture' }],
  warnings: [],
};

function assemblyContext(mode: EvaluationMode): FirewallContext {
  const context = new FirewallContext(runId('r9'));
  context.setApgResult(APG);
  context.setIngestionResult(INGESTION);
  context.setCompiledFunctions(COMPILED);
  context.setEvaluationResults({
    symbolicResults: [{ functionId: functionId('FF-S04'), dimension: 'structural', passed: true, violations: [], executionTimeMs: 3, deterministic: true, tag: 'structural' }],
    neuronalResults: [],
    failures: [{ functionId: functionId('FF-S01'), name: 'dependency-direction', code: 'EVAL_001', message: 'Query failed for FF-S01 (dependency-direction): x' }],
  });
  context.setScoredReport(scored(mode, 1));
  context.addWarning({ stage: 'compile-functions', code: 'COMPILER_004', message: 'FF-S03 (no-layer-skip) disabled', context: { functionId: 'FF-S03' } });
  context.addWarning({ stage: 'evaluation-engine', code: 'EVAL_001', message: 'Query failed for FF-S01 (dependency-direction): x' });
  return context;
}

const FACTS: CompileFactsHolder = { facts: { declared: 3, adrDerived: 0, dropped: [] } };
const TIMINGS = { stages: [{ name: 'compute-scores', durationMs: 4, status: 'success' as const }], totalMs: 4 };

describe('AssembleReportCommand (BR-U3-50, 51, 55, 57, 63, 64)', () => {
  it('builds the one report from the context facts in symbolic-only mode and writes setReport', async () => {
    const context = assemblyContext('symbolic-only');
    const res = await new AssembleReportCommand({ mode: 'symbolic-only', timingSource: () => TIMINGS, compileFacts: FACTS, knownSecrets: [] }).execute(context);
    expect(res.success).toBe(true);
    const report = context.getReport();
    expect(report.functionExecution).toEqual({
      declared: 3, adrDerived: 0, compiled: 2, disabled: 1, dropped: [], skippedByMode: 0, noJudgeUnits: [], executed: 1,
      failed: [{ functionId: 'FF-S01', name: 'dependency-direction', code: 'EVAL_001', message: 'Query failed for FF-S01 (dependency-direction): x' }],
    });
    expect(report.functionResults.map((r) => [String(r.functionId), r.tag, r.truncated])).toEqual([['FF-S04', 'structural', false]]);
    expect(report.disabledFunctions).toEqual([{ functionId: 'FF-S03', name: 'no-layer-skip', reason: 'not applicable to style clean-architecture' }]);
    expect(report.judge).toEqual({ provider: 'none', model: 'none', runsPerUnit: 0 });
    expect(report.importResolution.external).toBe(3);
    expect(report.graphStats.edgeCountByType).toHaveProperty('FLOWS_TO');
    expect(report.layerAnnotation).toEqual(INGESTION.layerAnnotationSummary);
    expect(report.timings).toEqual(TIMINGS);
    // Warnings merged in stage order (compile before evaluation), BR-U3-57.
    expect(report.warnings.map((w) => w.code)).toEqual(['COMPILER_004', 'EVAL_001']);
    expect(report).not.toHaveProperty('neuralResults');
  });

  it('reads the stage timings at assembly time, last', async () => {
    const order: string[] = [];
    const context = assemblyContext('symbolic-only');
    const spied = new Proxy(context, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver) as unknown;
        if (typeof value === 'function' && String(prop).startsWith('get')) {
          return (...args: unknown[]) => { order.push(String(prop)); return (value as (...a: unknown[]) => unknown).apply(target, args); };
        }
        if (prop === 'warnings') order.push('warnings');
        return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
      },
    });
    await new AssembleReportCommand({
      mode: 'symbolic-only', timingSource: () => { order.push('timings'); return TIMINGS; }, compileFacts: FACTS, knownSecrets: [],
    }).execute(spied);
    expect(order).toEqual([
      'getScoredReport', 'getApgResult', 'getIngestionResult', 'getCompiledFunctions', 'getEvaluationResults', 'warnings', 'timings',
    ]);
  });

  it('fails closed with REPORT_NEURAL_ROWS_UNAVAILABLE in full mode until U4 wires the row mapper (BR-U3-65, D-U3-11)', async () => {
    const context = assemblyContext('full');
    const res = await new AssembleReportCommand({ mode: 'full', timingSource: () => TIMINGS, compileFacts: FACTS, knownSecrets: [] }).execute(context);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.errors.map((e) => e.code)).toEqual(['REPORT_NEURAL_ROWS_UNAVAILABLE']);
    expect(() => context.getReport()).toThrow();
  });

  it('fails without CompileFacts and on an identity violation (REPORT_COUNTS_INCONSISTENT)', async () => {
    const missing = await new AssembleReportCommand({ mode: 'symbolic-only', timingSource: () => TIMINGS, compileFacts: {}, knownSecrets: [] })
      .execute(assemblyContext('symbolic-only'));
    expect(missing.success ? [] : missing.errors.map((e) => e.code)).toEqual(['REPORT_COUNTS_INCONSISTENT']);
    const wrong = await new AssembleReportCommand({
      mode: 'symbolic-only', timingSource: () => TIMINGS, compileFacts: { facts: { declared: 9, adrDerived: 0, dropped: [] } }, knownSecrets: [],
    }).execute(assemblyContext('symbolic-only'));
    expect(wrong.success ? [] : wrong.errors.map((e) => e.code)).toEqual(['REPORT_COUNTS_INCONSISTENT']);
  });
});

// ---------------------------------------------------------------- BR-U3-55 type test

describe('EvaluationReport run-level fields are required (BR-U3-55, D-U0-2)', () => {
  it('a literal missing any run-level field does not type-check', () => {
    const without = <K extends keyof EvaluationReport>(_k: K): Omit<EvaluationReport, K> => ({} as Omit<EvaluationReport, K>);
    const checks: unknown[] = [
      // @ts-expect-error graphStats is required
      ((): EvaluationReport => without('graphStats'))(),
      // @ts-expect-error layerAnnotation is required
      ((): EvaluationReport => without('layerAnnotation'))(),
      // @ts-expect-error parseCoverage is required
      ((): EvaluationReport => without('parseCoverage'))(),
      // @ts-expect-error importResolution is required
      ((): EvaluationReport => without('importResolution'))(),
      // @ts-expect-error timings is required
      ((): EvaluationReport => without('timings'))(),
      // @ts-expect-error judge is required
      ((): EvaluationReport => without('judge'))(),
      // @ts-expect-error droppedDimensions is required
      ((): EvaluationReport => without('droppedDimensions'))(),
      // @ts-expect-error disabledFunctions is required
      ((): EvaluationReport => without('disabledFunctions'))(),
      // @ts-expect-error scoring is required
      ((): EvaluationReport => without('scoring'))(),
      // @ts-expect-error functionExecution is required
      ((): EvaluationReport => without('functionExecution'))(),
      // @ts-expect-error functionResults is required
      ((): EvaluationReport => without('functionResults'))(),
      // neuralResults is mode-conditional (BR-U3-65): omitting it type-checks.
      ((): EvaluationReport => without('neuralResults'))(),
    ];
    expect(checks).toHaveLength(12);
  });
});

// ---------------------------------------------------------------- BR-U3-62 static

describe('golden runner collapse (BR-U3-62, D-U0-12)', () => {
  it('golden-runner.ts and normalise.ts never read evaluationResults or the compiled functions', () => {
    for (const file of ['tests/golden/golden-runner.ts', 'tests/golden/normalise.ts']) {
      const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
      expect({ file, hits: text.match(/evaluationResults|getEvaluationResults|compiledSymbolic|getCompiledFunctions|symbolicQueries/g) ?? [] })
        .toEqual({ file, hits: [] });
    }
  });
});
