/**
 * U3-R10: frozen report schema and fail-closed validation (FR-14, FR-36; BR-U3-59, 60, 63, 65).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPORT_SCHEMA, REPORT_SCHEMA_ID } from '../../../src/scoring-engine/report-schema.js';
import { parseReport, REPORT_SCHEMA_ERROR_LIMIT, validateReport } from '../../../src/scoring-engine/report-schema-validator.js';
import { NO_JUDGE } from '../../../src/scoring-engine/report-builder.js';
import { AssembleReportCommand } from '../../../src/pipeline/commands/assemble-report-command.js';
import { FirewallContext } from '../../../src/shared/context/firewall-context.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { SHAPES_ONLY } from '../../../src/shared/errors/scrub.js';
import { ahsScore, avrScore, confidence, functionId, runId } from '../../../src/shared/types/value-objects.js';
import type { GraphRepository, QueryResult } from '../../../src/shared/interfaces/graph-repository.js';
import type { APGResult } from '../../../src/shared/types/apg.js';
import type {
  EvaluationReport, EvaluationResults, NeuronalFunctionResult, SymbolicFunctionResult,
} from '../../../src/shared/types/evaluation.js';
import type { Dimension, EvaluationMode } from '../../../src/shared/types/enums.js';
import { scoreAndAssemble } from './assembled-report-fixture.js';

const ROOT = resolve(__dirname, '../../..');

function repo(): GraphRepository {
  return {
    executeQuery(): Promise<DomainResult<QueryResult>> {
      return Promise.resolve(DomainResult.ok({ records: [{ cnt: 0, val: 0 }], summary: { counters: {} } }));
    },
    clearGraph() { return Promise.resolve(DomainResult.ok(undefined)); },
    healthCheck() { return Promise.resolve(true); },
    close() { return Promise.resolve(); },
  };
}

function sym(id: string, dimension: Dimension, passed = true): SymbolicFunctionResult {
  return {
    functionId: functionId(id), dimension, passed, executionTimeMs: 2, deterministic: true, tag: 'structural',
    violations: passed ? [] : [{
      id: `v-${id}`, type: 'LAYER_VIOLATION', dimension, severity: 'major', functionId: functionId(id), route: 'symbolic',
      filePath: 'src/a.ts', message: 'm', deterministic: true, tag: 'structural', line: 2, target: 'src/b.ts', discriminator: ['IMPORTS'],
    }],
  };
}

function neural(id: string, dimension: Dimension, verdict: 'pass' | 'fail' = 'pass'): NeuronalFunctionResult {
  return {
    functionId: functionId(id), dimension, verdict, confidence: confidence(0.9), confidenceStdDev: 0.01, icc: 1,
    reasoning: 'r', evidence: [], violations: [], runs: [], deterministic: false, flaggedUnstable: false,
    unitResults: [], unitsSelected: 1, unitsCapped: 0,
  };
}

const WEIGHTS = { structural: 0.35, coupling: 0.2, pattern: 0.3, solid: 0.1, convention: 0.05, semantic: 0, integrity: 0 };
const FULL_WEIGHTS = { structural: 0.32, coupling: 0.18, pattern: 0.27, solid: 0.1, convention: 0.05, semantic: 0.04, integrity: 0.04 };

async function exampleReport(mode: EvaluationMode): Promise<EvaluationReport> {
  const evaluationResults: EvaluationResults = {
    symbolicResults: mode === 'neuronal-only' ? [] : [sym('FF-S01', 'structural'), sym('FF-S04', 'structural', false)],
    neuronalResults: mode === 'symbolic-only' ? [] : [neural('FF-N01', 'integrity'), neural('FF-N02', 'semantic', 'fail')],
    failures: [],
  };
  const r = await scoreAndAssemble({
    evaluationResults,
    scoringWeights: WEIGHTS,
    ...(mode !== 'symbolic-only' && { fullModeWeights: FULL_WEIGHTS }),
    confidenceThresholds: { high: 0.85, medium: 0.6, iccMinimum: 0.7 },
    verdictThresholds: { pass: 0.8, warning: 0.65, softBlock: 0.5 },
    mode,
    projectPath: '/p',
    specVersion: '1',
    graphRepository: repo(),
    fitnessFunctions: [],
    compiled: { symbolicQueries: [], neuronalInstructions: [], hybridPairs: [], totalCompiled: 0, disabledFunctions: [], warnings: [] },
    noJudgeUnits: [],
  });
  if (!r.success) throw new Error(`assembly failed: ${r.errors.map((e) => `${e.code} ${e.message}`).join('; ')}`);
  return r.data;
}

/** JSON copy as a mutable record (the report as stored). */
function stored(report: EvaluationReport): Record<string, unknown> {
  return JSON.parse(JSON.stringify(report)) as Record<string, unknown>;
}

function codes(r: DomainResult<unknown>): string[] {
  return r.success ? [] : r.errors.map((e) => e.code);
}

describe('REPORT_SCHEMA (BR-U3-59)', () => {
  it('deep-equals schemas/report.schema.json and carries REPORT_SCHEMA_ID', () => {
    const file = JSON.parse(readFileSync(resolve(ROOT, 'schemas/report.schema.json'), 'utf8')) as unknown;
    expect(REPORT_SCHEMA).toEqual(file);
    expect(REPORT_SCHEMA.$id).toBe(REPORT_SCHEMA_ID);
  });

  it('has no reportSchemaVersion and no intent dimension (BR-U3-60)', () => {
    expect(Object.keys(REPORT_SCHEMA.properties)).not.toContain('reportSchemaVersion');
    expect(REPORT_SCHEMA.definitions.dimension.enum).not.toContain('intent');
  });
});

describe('validateReport: BR-U3-60 rules', () => {
  it.each(['symbolic-only', 'full', 'neuronal-only'] as const)('one valid assembled example passes (%s)', async (mode) => {
    const report = await exampleReport(mode);
    expect(codes(validateReport(stored(report)))).toEqual([]);
    expect(codes(validateReport(report))).toEqual([]);
  });

  it('neuronal-only without ahsDeterministic passes; symbolic-only without it fails', async () => {
    const neuronal = stored(await exampleReport('neuronal-only'));
    expect(neuronal).not.toHaveProperty('ahsDeterministic');
    expect(codes(validateReport(neuronal))).toEqual([]);
    const { ahsDeterministic: _a, ...symbolic } = stored(await exampleReport('symbolic-only'));
    expect(codes(validateReport(symbolic))).toEqual(['REPORT_SCHEMA_INVALID']);
  });

  it("a perDimensionScores row with dimension 'intent' fails", async () => {
    const r = stored(await exampleReport('symbolic-only'));
    const rows = r.perDimensionScores as Record<string, unknown>[];
    expect(codes(validateReport({ ...r, perDimensionScores: [{ ...rows[0], dimension: 'intent' }] }))).toEqual(['REPORT_SCHEMA_INVALID']);
  });

  it('a full-mode report without neuralResults fails; a symbolic-only report with neuralResults: [] fails', async () => {
    const { neuralResults: _n, ...full } = stored(await exampleReport('full'));
    expect(codes(validateReport(full))).toEqual(['REPORT_SCHEMA_INVALID']);
    expect(codes(validateReport({ ...stored(await exampleReport('symbolic-only')), neuralResults: [] }))).toEqual(['REPORT_SCHEMA_INVALID']);
  });

  it('a functionResults row with an extra unitResults key fails (rows stay narrow)', async () => {
    const r = stored(await exampleReport('full'));
    const rows = r.functionResults as Record<string, unknown>[];
    expect(codes(validateReport({ ...r, functionResults: [{ ...rows[0], unitResults: [] }, ...rows.slice(1)] }))).toEqual(['REPORT_SCHEMA_INVALID']);
  });

  it('a symbolic functionResults row without tag fails; a neural row with a tag fails', async () => {
    const r = stored(await exampleReport('full'));
    const rows = r.functionResults as Record<string, unknown>[];
    const symbolicIdx = rows.findIndex((x) => x.route === 'symbolic');
    const neuralIdx = rows.findIndex((x) => x.route === 'neuronal');
    const noTag = rows.map((x, i) => {
      if (i !== symbolicIdx) return x;
      const { tag: _t, ...untagged } = x;
      return untagged;
    });
    expect(codes(validateReport({ ...r, functionResults: noTag }))).toEqual(['REPORT_SCHEMA_INVALID']);
    const tagged = rows.map((x, i) => (i === neuralIdx ? { ...x, tag: 'structural' } : x));
    expect(codes(validateReport({ ...r, functionResults: tagged }))).toEqual(['REPORT_SCHEMA_INVALID']);
  });

  it("a droppedDimensions entry with reason 'no-judge-units' passes", async () => {
    const r = stored(await exampleReport('neuronal-only'));
    const dropped = [{ dimension: 'semantic', reason: 'no-judge-units', declared: 1, executed: 0 }];
    expect(codes(validateReport({ ...r, droppedDimensions: dropped }))).toEqual([]);
  });

  it('a missing functionExecution or noJudgeUnits fails with REPORT_SCHEMA_INVALID listing at most 10 errors', async () => {
    const r = stored(await exampleReport('symbolic-only'));
    const { functionExecution: fe, ...noFe } = r;
    expect(codes(validateReport(noFe))).toEqual(['REPORT_SCHEMA_INVALID']);
    const { noJudgeUnits: _nj, ...feRest } = fe as Record<string, unknown>;
    expect(codes(validateReport({ ...r, functionExecution: feRest }))).toEqual(['REPORT_SCHEMA_INVALID']);
    const bad = validateReport({ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9, j: 10, k: 11, l: 12 });
    if (bad.success) throw new Error('expected failure');
    const ctx = bad.errors[0]?.context as { errors: string[]; total: number };
    expect(ctx.errors).toHaveLength(REPORT_SCHEMA_ERROR_LIMIT);
    expect(ctx.total).toBeGreaterThan(REPORT_SCHEMA_ERROR_LIMIT);
    expect(bad.errors[0]?.message).toContain('frozen schema');
  });

  it('null universal metrics pass (number|null), a negative count fails', async () => {
    const r = stored(await exampleReport('symbolic-only'));
    const um = r.universalMetrics as Record<string, unknown>;
    expect(codes(validateReport({ ...r, universalMetrics: { ...um, cyclicDependencyCount: null, abstractionRatio: null } }))).toEqual([]);
    expect(codes(validateReport({ ...r, universalMetrics: { ...um, maxFanIn: -1 } }))).toEqual(['REPORT_SCHEMA_INVALID']);
  });
});

describe('judge provenance (BR-U3-63)', () => {
  it("a symbolic-only report has judge {provider:'none', model:'none', runsPerUnit:0} and validates", async () => {
    const r = await exampleReport('symbolic-only');
    expect(r.judge).toEqual({ provider: 'none', model: 'none', runsPerUnit: 0 });
    expect(r.judge).toEqual(NO_JUDGE);
    expect(codes(validateReport(r))).toEqual([]);
  });

  it('accepts the U4 DE §4.6 optional fields, rejects an unknown judge key', async () => {
    const r = stored(await exampleReport('full'));
    const judge = { provider: 'claude-cli', model: 'm', runsPerUnit: 3, resolvedModel: 'm-1', repetition: 1, isolationProbeSha256: 'a', configListingSha256: 'b', provenanceMixed: false, seededList: [] };
    expect(codes(validateReport({ ...r, judge }))).toEqual([]);
    expect(codes(validateReport({ ...r, judge: { ...judge, apiKey: 'x' } }))).toEqual(['REPORT_SCHEMA_INVALID']);
  });
});

describe('parseReport', () => {
  it('parses and validates stored JSON text; rejects non-JSON and invalid reports', async () => {
    const r = await exampleReport('symbolic-only');
    const parsed = parseReport(JSON.stringify(r));
    expect(parsed.success && parsed.data.verdict).toBe(r.verdict);
    expect(codes(parseReport('{not json'))).toEqual(['REPORT_SCHEMA_INVALID']);
    expect(codes(parseReport(JSON.stringify({ runId: 'x' })))).toEqual(['REPORT_SCHEMA_INVALID']);
  });
});

describe('assembly fails closed on an invalid report (BR-U3-59)', () => {
  it('AssembleReportCommand returns REPORT_SCHEMA_INVALID and writes no report', async () => {
    const valid = await exampleReport('symbolic-only');
    const context = new FirewallContext(runId('r10'));
    const apg: APGResult = { nodes: [], edges: [], warnings: [], parseCoverage: valid.parseCoverage, importResolution: valid.importResolution };
    context.setApgResult(apg);
    context.setIngestionResult({ graphStats: valid.graphStats, layerAnnotationSummary: valid.layerAnnotation });
    context.setCompiledFunctions({
      symbolicQueries: [{ functionId: functionId('FF-S01'), name: 'dependency-direction', cypher: 'RETURN 1', params: {}, dimension: 'structural', severity: 'major', route: 'symbolic', source: 'template' }],
      neuronalInstructions: [], hybridPairs: [], totalCompiled: 1, disabledFunctions: [], warnings: [],
    });
    context.setEvaluationResults({ symbolicResults: [sym('FF-S01', 'structural')], neuronalResults: [], failures: [] });
    // A negative weight is outside the frozen schema (nonNegativeNumber): the builder accepts it, the validator does not.
    context.setScoredReport({
      runId: runId('run'), projectPath: '/p', specVersion: '1', ahsDeterministic: ahsScore(1), verdict: 'pass',
      scoring: { weights: { ...WEIGHTS, structural: -1 }, thresholds: { pass: 0.8, warning: 0.65, softBlock: 0.5 }, confidenceThresholds: { high: 0.85, medium: 0.6, iccMinimum: 0.7 }, verdictSource: 'ahsDeterministic' },
      perDimensionScores: [{ dimension: 'structural', avr: avrScore(0), violatedWeight: 0, weight: 1, effectiveWeight: 1, violationCount: 0, functionCount: 1 }],
      violations: [], universalMetrics: valid.universalMetrics, evaluationMode: 'symbolic-only', durationMs: 1, droppedDimensions: [],
    });
    const res = await new AssembleReportCommand({
      mode: 'symbolic-only', timingSource: () => ({ stages: [], totalMs: 0 }), compileFacts: { facts: { declared: 1, adrDerived: 0, dropped: [] } }, scrubPolicy: SHAPES_ONLY,
    }).execute(context);
    expect(codes(res)).toEqual(['REPORT_SCHEMA_INVALID']);
    expect(() => context.getReport()).toThrow();
  });
});
