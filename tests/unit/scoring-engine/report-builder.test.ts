/**
 * Report builder (FR-13, FR-14, FR-20, FR-33; U3 BR-U3-15, 51..55, 63..65; TF-06, TF-21, TF-22, TF-23).
 * Pure inputs only; the builder is wired by AssembleReportCommand at U3-R9.
 */
import * as path from 'node:path';
import {
  buildEvaluationReport, compileFactsOf, DISABLED_IN_SPEC, NO_JUDGE, skippedByModeOf,
} from '../../../src/scoring-engine/report-builder.js';
import type { RunFacts } from '../../../src/scoring-engine/report-builder.js';
import { dropReasonFor } from '../../../src/scoring-engine/renormaliser.js';
import { compileFunctions } from '../../../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import * as router from '../../../src/neuro-symbolic-router/router.js';
import { ahsScore, avrScore, confidence, functionId, runId } from '../../../src/shared/types/value-objects.js';
import type {
  CompiledFunctions, CypherQuery, EvaluationReport, EvaluationResults, FunctionFailure, NeuralResultRow,
  NeuronalFunctionResult, NeuronalInstruction, PerDimensionScore, ScoredReport, SymbolicFunctionResult,
} from '../../../src/shared/types/evaluation.js';
import type { Dimension, EvaluationMode } from '../../../src/shared/types/enums.js';
import type { FitnessFunction, ParsedSpec } from '../../../src/shared/types/spec.js';
import type { Violation } from '../../../src/shared/taxonomy/violation-types.js';
import type { PipelineWarning } from '../../../src/shared/errors/domain-result.js';

jest.mock('../../../src/neuro-symbolic-router/router.js', () => ({
  // BR-U3-15: a stubbed router that would report an altered totalCompiled; the builder never calls it.
  filterByMode: jest.fn(() => ({ totalCompiled: 999 })),
  routeAndEvaluate: jest.fn(),
}));

const ROOT = path.resolve(__dirname, '../../..');

// ---------------------------------------------------------------- factories

function query(id: string, name: string, dimension: Dimension, source: CypherQuery['source'] = 'template', route: CypherQuery['route'] = 'symbolic'): CypherQuery {
  return { functionId: functionId(id), name, cypher: 'RETURN 1', params: {}, dimension, severity: 'major', route, source };
}

function instruction(id: string, name: string, dimension: Dimension, source: NeuronalInstruction['source'] = 'fitness-function', route: NeuronalInstruction['route'] = 'neuronal'): NeuronalInstruction {
  return {
    functionId: functionId(id), name, dimension, severity: 'major', route,
    semanticCriteria: { rule: 'r', rubric: { pass: 'p', fail: 'f', evidenceRequired: 'e' } },
    contextAssembly: { includeAPGSubgraph: false, includeSourceCode: true },
    shadowModeEligible: false, source, judgeUnit: 'file',
  };
}

function compiledOf(parts: Partial<CompiledFunctions>): CompiledFunctions {
  const symbolicQueries = parts.symbolicQueries ?? [];
  const neuronalInstructions = parts.neuronalInstructions ?? [];
  const hybridPairs = parts.hybridPairs ?? [];
  return {
    symbolicQueries, neuronalInstructions, hybridPairs,
    totalCompiled: symbolicQueries.length + neuronalInstructions.length + hybridPairs.length,
    disabledFunctions: parts.disabledFunctions ?? [],
    warnings: [],
  };
}

function violation(fid: string, dimension: Dimension, file = 'src/a.ts'): Violation {
  return {
    id: `v-${fid}-${file}`, type: 'LAYER_VIOLATION', dimension, severity: 'major', functionId: functionId(fid),
    route: 'symbolic', filePath: file, message: 'm', deterministic: true,
  };
}

function symResult(id: string, dimension: Dimension, opts: Partial<SymbolicFunctionResult> = {}): SymbolicFunctionResult {
  const violations = opts.violations ?? [];
  return { functionId: functionId(id), dimension, passed: violations.length === 0, violations, executionTimeMs: 5, deterministic: true, ...opts };
}

function neuralResult(id: string, dimension: Dimension, verdict: NeuronalFunctionResult['verdict'] = 'pass', violations: readonly Violation[] = []): NeuronalFunctionResult {
  return {
    functionId: functionId(id), dimension, verdict, confidence: confidence(0.9), confidenceStdDev: 0, icc: 1,
    reasoning: 'r', evidence: [], violations, runs: [], deterministic: false, flaggedUnstable: false,
    unitResults: [], unitsSelected: 1, unitsCapped: 0,
  };
}

/** Stub of U4's `toNeuralResultRows` (TF-22): one row per neural result, in input order. */
function stubNeuralRows(results: readonly NeuronalFunctionResult[]): NeuralResultRow[] {
  return results.map((r) => ({
    functionId: r.functionId, dimension: r.dimension, aggregationRule: 'majority-of-valid-units-v1',
    selection: { source: 'own', candidateUnitIds: [], selectedUnitIds: [] },
    unitsSelected: 2, unitsCapped: 0, candidateCount: 2, uncoveredFileCount: 0,
    candidateExclusions: { unlayered: 0, 'exclude-paths': 0, barrel: 0, 'test-path': 0, 'e2e-spec': 0, 'generated-path': 0, 'generated-marker': 0 },
    unitsInvalidByCause: { PARSE_FAILURE: 0, MISSING_CONFIDENCE: 0, MODEL_MISMATCH: 0, TIMEOUT: 0, BAD_ENVELOPE: 0, CLI_EXIT: 0, INSUFFICIENT_VALID_RUNS: 0 },
    truncatedUnits: 0, excerptTruncatedUnits: 0, removedByVariant: [],
    unitResults: [
      { unitId: 'src/a.ts', unitKind: 'file', layer: 'domain', filePaths: ['src/a.ts'], status: 'valid', verdict: r.verdict, confidence: 0.9, confidenceStdDev: 0, flaggedUnstable: false, validRunCount: 3 },
      { unitId: 'src/b.ts', unitKind: 'file', layer: 'domain', filePaths: ['src/b.ts'], status: 'valid', verdict: 'pass', confidence: 0.9, confidenceStdDev: 0, flaggedUnstable: false, validRunCount: 3 },
    ],
  }));
}

/** Scorer stand-in: one row per dimension with executed functions (failed and neuralSkipped neural halves excluded). */
function scoredOf(evaluation: EvaluationResults, mode: EvaluationMode, droppedDimensions: ScoredReport['droppedDimensions'] = []): ScoredReport {
  const failed = new Set((evaluation.failures ?? []).map((f) => String(f.functionId)));
  const dims = new Map<string, Dimension>();
  for (const r of evaluation.symbolicResults) if (!failed.has(String(r.functionId))) dims.set(String(r.functionId), r.dimension);
  for (const r of evaluation.neuronalResults) if (!failed.has(String(r.functionId))) dims.set(String(r.functionId), r.dimension);
  const counts = new Map<Dimension, number>();
  for (const d of dims.values()) counts.set(d, (counts.get(d) ?? 0) + 1);
  const perDimensionScores: PerDimensionScore[] = [...counts].map(([dimension, functionCount]) => ({
    dimension, avr: avrScore(0), violatedWeight: 0, weight: 0.1, effectiveWeight: 0.1, violationCount: 0, functionCount,
  }));
  return {
    runId: runId('run-test'), projectPath: '/p', specVersion: '1', ahsDeterministic: ahsScore(1), verdict: 'pass',
    scoring: {
      weights: { structural: 0.35, coupling: 0.2, pattern: 0.3, solid: 0.1, convention: 0.05, semantic: 0, integrity: 0, intent: 0 },
      thresholds: { pass: 0.8, warning: 0.65, softBlock: 0.5 },
      confidenceThresholds: { high: 0.85, medium: 0.6, iccMinimum: 0.7 },
      verdictSource: 'ahsDeterministic',
    },
    perDimensionScores,
    violations: [...evaluation.symbolicResults, ...evaluation.neuronalResults].flatMap((r) => r.violations),
    universalMetrics: { cyclicDependencyCount: 0, maxFanOut: 1, maxFanIn: 1, abstractionRatio: null, averageInstability: 0.5, orphanFileCount: 0 },
    evaluationMode: mode, durationMs: 3, droppedDimensions,
  };
}

function factsOf(over: Partial<RunFacts> & Pick<RunFacts, 'compiled' | 'evaluation' | 'mode'>): RunFacts {
  return {
    apg: {
      parseCoverage: { total: 3, parsed: 3, percentage: 100, skipped: [] },
      importResolution: { resolvedInternal: 4, external: 3, unresolved: 0, unsupportedDynamic: 0, externalOutOfRootAlias: 0, droppedNoFileNode: 0 },
    },
    ingestion: {
      graphStats: { nodeCount: 10, edgeCount: 12, layerCoverage: 1, nodeCountByType: { File: 3 }, edgeCountByType: { IMPORTS: 4, FLOWS_TO: 0 } },
      layerAnnotationSummary: { mapped: 3, unmapped: 0, unmappedFiles: [] },
    },
    compileFacts: { declared: over.compiled.totalCompiled + over.compiled.disabledFunctions.length, adrDerived: 0, dropped: [] },
    timings: { stages: [{ name: 'compute-scores', durationMs: 4, status: 'success' }], totalMs: 9 },
    pipelineWarnings: [],
    judge: NO_JUDGE,
    knownSecrets: [],
    ...over,
  };
}

function ok(scored: ScoredReport, facts: RunFacts): EvaluationReport {
  const r = buildEvaluationReport(scored, facts);
  if (!r.success) throw new Error(`builder failed: ${r.errors.map((e) => `${e.code}: ${e.message}`).join('; ')}`);
  return r.data;
}

function failCode(scored: ScoredReport, facts: RunFacts): string {
  const r = buildEvaluationReport(scored, facts);
  if (r.success) throw new Error('builder unexpectedly succeeded');
  return `${r.errors[0]?.code ?? ''} ${(r.errors[0]?.context as { identity?: string } | undefined)?.identity ?? ''}`.trim();
}

async function loadSpec(file: string): Promise<ParsedSpec> {
  const r = await parseSpec({ specFilePath: path.join(ROOT, file) });
  if (!r.success) throw new Error(`${file} did not parse`);
  return r.data;
}

function compileSpec(spec: ParsedSpec): CompiledFunctions {
  const r = compileFunctions(compilerInputFromSpec(spec));
  if (!r.success) throw new Error('compile failed');
  return r.data;
}

// ---------------------------------------------------------------- BR-U3-51, 52, 64 on the shipped specs

describe('functionExecution on the golden shape (BR-U3-51, BR-U3-52)', () => {
  let spec: ParsedSpec;
  let compiled: CompiledFunctions;
  beforeAll(async () => {
    spec = await loadSpec('specs/clean-arch.yaml');
    compiled = compileSpec(spec);
  });

  it('specs/clean-arch.yaml with FF-P06 (as after R6) gives {27, 0, 26, 1, [], 2, [], 24, []} in symbolic-only mode', () => {
    // FF-P06 arrives with U3-R6 (Step 17); here it is appended as the 27th declared, 24th symbolic function.
    const ffP06: FitnessFunction = {
      id: functionId('FF-P06'), name: 'domain-state-purity', dimension: 'pattern', severity: 'major', route: 'symbolic',
      isBuiltIn: true, validated: true, enabled: true, excludePaths: [],
    };
    const fitnessFunctions = [...spec.fitnessFunctions, ffP06];
    const withP06 = compiledOf({ ...compiled, symbolicQueries: [...compiled.symbolicQueries, query('FF-P06', 'domain-state-purity', 'pattern')] });
    const evaluation: EvaluationResults = { symbolicResults: withP06.symbolicQueries.map((q) => symResult(String(q.functionId), q.dimension)), neuronalResults: [], failures: [] };
    const report = ok(scoredOf(evaluation, 'symbolic-only'), factsOf({ compiled: withP06, compileFacts: compileFactsOf(fitnessFunctions, withP06), evaluation, mode: 'symbolic-only' }));
    expect(report.functionExecution).toEqual({
      declared: 27, adrDerived: 0, compiled: 26, disabled: 1, dropped: [], skippedByMode: 2, noJudgeUnits: [], executed: 24, failed: [],
    });
    expect(report.functionResults).toHaveLength(24);
  });

  it('a corrupted input (one result removed without a failure) raises REPORT_COUNTS_INCONSISTENT', () => {
    const results = compiled.symbolicQueries.map((q) => symResult(String(q.functionId), q.dimension));
    const evaluation: EvaluationResults = { symbolicResults: results.slice(1), neuronalResults: [], failures: [] };
    expect(failCode(scoredOf(evaluation, 'symbolic-only'), factsOf({ compiled, compileFacts: compileFactsOf(spec.fitnessFunctions, compiled), evaluation, mode: 'symbolic-only' })))
      .toBe('REPORT_COUNTS_INCONSISTENT I2');
  });

  it('BR-U3-64: clean-arch gives the FF-S03 row with U1 reason; length = functionExecution.disabled', () => {
    const evaluation: EvaluationResults = { symbolicResults: compiled.symbolicQueries.map((q) => symResult(String(q.functionId), q.dimension)), neuronalResults: [], failures: [] };
    const report = ok(scoredOf(evaluation, 'symbolic-only'), factsOf({ compiled, compileFacts: compileFactsOf(spec.fitnessFunctions, compiled), evaluation, mode: 'symbolic-only' }));
    expect(report.disabledFunctions).toEqual([{ functionId: 'FF-S03', name: 'no-layer-skip', reason: 'not applicable to style clean-architecture' }]);
    expect(report.disabledFunctions).toHaveLength(report.functionExecution.disabled);
  });

  it('BR-U3-64: the compiled presets/layered.yaml gives 9 disabledFunctions rows sorted by id', async () => {
    const layeredSpec = await loadSpec('presets/layered.yaml');
    const layered = compileSpec(layeredSpec);
    const evaluation: EvaluationResults = { symbolicResults: layered.symbolicQueries.map((q) => symResult(String(q.functionId), q.dimension)), neuronalResults: [], failures: [] };
    const report = ok(scoredOf(evaluation, 'symbolic-only'), factsOf({ compiled: layered, compileFacts: compileFactsOf(layeredSpec.fitnessFunctions, layered), evaluation, mode: 'symbolic-only' }));
    expect(report.disabledFunctions).toHaveLength(9);
    expect(report.functionExecution.disabled).toBe(9);
    const ids = report.disabledFunctions.map((d) => String(d.functionId));
    expect(ids).toEqual([...ids].sort());
  });

  it('BR-U3-52: compileFactsOf drops a symbolic function without template and a neuronal one without criteria', () => {
    const declared: FitnessFunction[] = [
      { id: functionId('FF-X01'), name: 'no-such-template', dimension: 'pattern', severity: 'major', route: 'symbolic', isBuiltIn: false, validated: true, enabled: true, excludePaths: [] },
      { id: functionId('FF-N09'), name: 'judge-without-criteria', dimension: 'semantic', severity: 'major', route: 'neuronal', isBuiltIn: false, validated: true, enabled: true, excludePaths: [] },
      { id: functionId('FF-S01'), name: 'dependency-direction', dimension: 'structural', severity: 'major', route: 'symbolic', isBuiltIn: true, validated: true, enabled: true, excludePaths: [] },
    ];
    const c = compiledOf({ symbolicQueries: [query('FF-S01', 'dependency-direction', 'structural')] });
    expect(compileFactsOf(declared, c)).toEqual({ declared: 3, adrDerived: 0, dropped: ['FF-N09', 'FF-X01'] });
  });
});

// ---------------------------------------------------------------- BR-U3-15

describe('skippedByMode never reads filterByMode (BR-U3-15)', () => {
  it('one hybrid pair and two neuronal functions in symbolic-only mode give skippedByMode 3 whatever filterByMode returns', () => {
    const compiled = compiledOf({
      symbolicQueries: [query('FF-S01', 'dependency-direction', 'structural')],
      neuronalInstructions: [instruction('FF-N01', 'n1', 'semantic'), instruction('FF-N02', 'n2', 'integrity')],
      hybridPairs: [{ functionId: functionId('FF-H01'), symbolicQuery: query('FF-H01', 'domain-purity', 'semantic', 'template', 'hybrid'), neuronalInstruction: instruction('FF-H01', 'h', 'semantic', 'fitness-function', 'hybrid') }],
    });
    const evaluation: EvaluationResults = { symbolicResults: [symResult('FF-S01', 'structural')], neuronalResults: [], failures: [] };
    const report = ok(scoredOf(evaluation, 'symbolic-only'), factsOf({ compiled, evaluation, mode: 'symbolic-only' }));
    expect(report.functionExecution.skippedByMode).toBe(3);
    expect(report.functionExecution.compiled).toBe(4);
    expect(skippedByModeOf(compiled, 'neuronal-only')).toBe(2);
    expect(skippedByModeOf(compiled, 'full')).toBe(0);
    const mocked = router as unknown as { filterByMode: jest.Mock; routeAndEvaluate: jest.Mock };
    expect(mocked.filterByMode).not.toHaveBeenCalled();
    expect(mocked.routeAndEvaluate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------- TF-06 hybrid accounting (BR-U3-53)

describe('TF-06 ADR hybrid pair (BR-U3-53, I6)', () => {
  const adrPair = {
    functionId: functionId('ADR-003-1'),
    symbolicQuery: query('ADR-003-1', 'adr-003-rule-1', 'semantic', 'adr', 'hybrid'),
    neuronalInstruction: instruction('ADR-003-1', 'adr-003-rule-1', 'semantic', 'adr', 'hybrid'),
  };
  const compiled = compiledOf({ symbolicQueries: [query('FF-S01', 'dependency-direction', 'structural')], hybridPairs: [adrPair] });
  const base = { compileFacts: { declared: 1, adrDerived: 1, dropped: [] }, compiled };
  const s01 = symResult('FF-S01', 'structural');

  function full(evaluation: EvaluationResults, neuralRows = stubNeuralRows(evaluation.neuronalResults)): RunFacts {
    return factsOf({ ...base, evaluation, mode: 'full', neuralRows });
  }

  it('symbolic-only: the pair is skippedByMode 1; adrDerived > 0 and I1 holds', () => {
    const evaluation: EvaluationResults = { symbolicResults: [s01], neuronalResults: [], failures: [] };
    const report = ok(scoredOf(evaluation, 'symbolic-only'), factsOf({ ...base, evaluation, mode: 'symbolic-only' }));
    expect(report.functionExecution).toMatchObject({ declared: 1, adrDerived: 1, compiled: 2, skippedByMode: 1, executed: 1 });
    expect(report.functionResults.map((r) => r.functionId)).toEqual(['FF-S01']);
    expect(report.neuralResults).toBeUndefined();
  });

  it('full, symbolic half passes: one symbolic + one neural result, one hybrid row, one neuralResults row, functionCount 1', () => {
    const evaluation: EvaluationResults = { symbolicResults: [s01, symResult('ADR-003-1', 'semantic')], neuronalResults: [neuralResult('ADR-003-1', 'semantic')], failures: [] };
    const scored = scoredOf(evaluation, 'full');
    const report = ok(scored, full(evaluation));
    expect(report.functionResults.find((r) => r.functionId === 'ADR-003-1')).toMatchObject({ route: 'hybrid', passed: true });
    expect(report.neuralResults?.map((r) => r.functionId)).toEqual(['ADR-003-1']);
    expect(scored.perDimensionScores.find((s) => s.dimension === 'semantic')?.functionCount).toBe(1);
    expect(report.functionExecution.executed).toBe(2);
  });

  it('full, symbolic half violates: neuralSkipped set, no neuralResults row (I6), row not passed', () => {
    const violating = symResult('ADR-003-1', 'semantic', { violations: [violation('ADR-003-1', 'semantic')], neuralSkipped: 'symbolic-fail' });
    const evaluation: EvaluationResults = { symbolicResults: [s01, violating], neuronalResults: [], failures: [] };
    const report = ok(scoredOf(evaluation, 'full'), full(evaluation));
    expect(report.functionResults.find((r) => r.functionId === 'ADR-003-1')).toMatchObject({ route: 'hybrid', passed: false, violationCount: 1 });
    expect(report.neuralResults).toEqual([]);
  });

  it('I6: a neuralResults row for a neuralSkipped hybrid is rejected', () => {
    const violating = symResult('ADR-003-1', 'semantic', { violations: [violation('ADR-003-1', 'semantic')], neuralSkipped: 'symbolic-fail' });
    const evaluation: EvaluationResults = { symbolicResults: [s01, violating], neuronalResults: [], failures: [] };
    const rows = stubNeuralRows([neuralResult('ADR-003-1', 'semantic')]);
    expect(failCode(scoredOf(evaluation, 'full'), full(evaluation, rows))).toBe('REPORT_COUNTS_INCONSISTENT I6');
  });

  it('full, symbolic query fails: one failure, no row, no neural row, no violation; a stray neural result changes nothing', () => {
    const failure: FunctionFailure = { functionId: functionId('ADR-003-1'), name: 'adr-003-rule-1', code: 'EVAL_001', message: 'query failed' };
    const clean: EvaluationResults = { symbolicResults: [s01], neuronalResults: [], failures: [failure] };
    const report = ok(scoredOf(clean, 'full'), full(clean));
    expect(report.functionExecution).toMatchObject({ executed: 1, failed: [failure] });
    expect(report.functionResults.map((r) => r.functionId)).toEqual(['FF-S01']);
    expect(report.neuralResults).toEqual([]);
    expect(report.violations.some((v) => v.functionId === 'ADR-003-1')).toBe(false);
    expect(report.perDimensionScores.find((s) => s.dimension === 'semantic')).toBeUndefined();

    // Synthetic input that also carries a neural result (with a violation) for the failed pair.
    const stray = neuralResult('ADR-003-1', 'semantic', 'fail', [{ ...violation('ADR-003-1', 'semantic'), route: 'neuronal' }]);
    const dirty: EvaluationResults = { symbolicResults: [s01], neuronalResults: [stray], failures: [failure] };
    const dirtyScored: ScoredReport = { ...scoredOf(dirty, 'full'), violations: stray.violations };
    expect(ok(dirtyScored, full(dirty))).toEqual(report);
  });
});

// ---------------------------------------------------------------- TF-21, TF-22 neural rows (BR-U3-65)

describe('neuralResults (BR-U3-65)', () => {
  it('TF-21: neuronal-only, FF-N01 with two units and FF-N02 with JUDGE_NO_UNITS: noJudgeUnits [FF-N02], I2 holds, one row', () => {
    const compiled = compiledOf({
      symbolicQueries: [query('FF-S01', 'dependency-direction', 'structural')],
      neuronalInstructions: [instruction('FF-N01', 'n1', 'semantic'), instruction('FF-N02', 'n2', 'integrity')],
    });
    const evaluation: EvaluationResults = { symbolicResults: [], neuronalResults: [neuralResult('FF-N01', 'semantic')], failures: [] };
    const warnings: PipelineWarning[] = [{ stage: 'evaluate-neuronal', code: 'JUDGE_NO_UNITS', message: 'FF-N02 selected no units', context: { functionId: 'FF-N02' } }];
    const dropped = [{ dimension: 'integrity' as const, reason: dropReasonFor('integrity', { integrity: { declared: 1, disabled: 0, activeFunctionIds: ['FF-N02'] } }, ['FF-N02']), declared: 1, executed: 0 }];
    const report = ok(scoredOf(evaluation, 'neuronal-only', dropped), factsOf({ compiled, evaluation, mode: 'neuronal-only', pipelineWarnings: warnings, neuralRows: stubNeuralRows(evaluation.neuronalResults) }));
    expect(report.functionExecution).toMatchObject({ compiled: 3, executed: 1, skippedByMode: 1, noJudgeUnits: ['FF-N02'], failed: [] });
    expect(report.neuralResults).toHaveLength(1);
    expect(report.neuralResults?.[0]?.unitResults).toHaveLength(2);
    expect(report.droppedDimensions).toEqual([{ dimension: 'integrity', reason: 'no-judge-units', declared: 1, executed: 0 }]);
    expect(report.functionResults[0]).toMatchObject({ functionId: 'FF-N01', route: 'neuronal' });
    expect(report.functionResults[0]?.tag).toBeUndefined();
  });

  it('a JUDGE_NO_UNITS warning without context.functionId raises REPORT_COUNTS_INCONSISTENT', () => {
    const compiled = compiledOf({ neuronalInstructions: [instruction('FF-N02', 'n2', 'integrity')] });
    const evaluation: EvaluationResults = { symbolicResults: [], neuronalResults: [], failures: [] };
    const warnings: PipelineWarning[] = [{ stage: 'evaluate-neuronal', code: 'JUDGE_NO_UNITS', message: 'no units' }];
    expect(failCode(scoredOf(evaluation, 'neuronal-only'), factsOf({ compiled, evaluation, mode: 'neuronal-only', pipelineWarnings: warnings, neuralRows: [] })))
      .toBe('REPORT_COUNTS_INCONSISTENT I2');
  });

  const compiled = compiledOf({ neuronalInstructions: [instruction('FF-N02', 'n2', 'integrity'), instruction('FF-N01', 'n1', 'semantic')] });
  const evaluation: EvaluationResults = { symbolicResults: [], neuronalResults: [neuralResult('FF-N02', 'integrity'), neuralResult('FF-N01', 'semantic', 'fail')], failures: [] };

  it('TF-22: full mode with a stub mapper gives two rows in id order', () => {
    const report = ok(scoredOf(evaluation, 'full'), factsOf({ compiled, evaluation, mode: 'full', neuralRows: stubNeuralRows(evaluation.neuronalResults) }));
    expect(report.neuralResults?.map((r) => r.functionId)).toEqual(['FF-N01', 'FF-N02']);
    expect(report.functionResults.map((r) => [r.functionId, r.passed])).toEqual([['FF-N01', false], ['FF-N02', true]]);
  });

  it('TF-22: the same input without the mapper fails closed with REPORT_NEURAL_ROWS_UNAVAILABLE', () => {
    expect(failCode(scoredOf(evaluation, 'full'), factsOf({ compiled, evaluation, mode: 'full' }))).toBe('REPORT_NEURAL_ROWS_UNAVAILABLE');
    expect(failCode(scoredOf(evaluation, 'neuronal-only'), factsOf({ compiled, evaluation, mode: 'neuronal-only' }))).toBe('REPORT_NEURAL_ROWS_UNAVAILABLE');
  });

  it('symbolic-only never carries neuralResults, even if rows are supplied', () => {
    const c = compiledOf({ symbolicQueries: [query('FF-S01', 'dependency-direction', 'structural')] });
    const ev: EvaluationResults = { symbolicResults: [symResult('FF-S01', 'structural')], neuronalResults: [], failures: [] };
    const report = ok(scoredOf(ev, 'symbolic-only'), factsOf({ compiled: c, evaluation: ev, mode: 'symbolic-only', neuralRows: [] }));
    expect('neuralResults' in report).toBe(false);
  });
});

// ---------------------------------------------------------------- TF-23 disabled functions (BR-U3-64)

describe('TF-23 disabledFunctions (BR-U3-64)', () => {
  it('style-, kind- and spec-disabled functions give three rows in id order; a missing reason is "disabled in spec"', () => {
    const compiled = compiledOf({
      symbolicQueries: [query('FF-S01', 'dependency-direction', 'structural')],
      disabledFunctions: [
        { id: functionId('FF-S03'), name: 'no-layer-skip', reason: 'not applicable to style clean-architecture' },
        { id: functionId('FF-CV01'), name: 'naming-conventions', reason: 'no application layer' },
        { id: functionId('FF-C02'), name: 'max-fan-in' },
      ],
    });
    const evaluation: EvaluationResults = { symbolicResults: [symResult('FF-S01', 'structural')], neuronalResults: [], failures: [] };
    const report = ok(scoredOf(evaluation, 'symbolic-only'), factsOf({ compiled, evaluation, mode: 'symbolic-only' }));
    expect(DISABLED_IN_SPEC).toBe('disabled in spec');
    expect(report.disabledFunctions).toEqual([
      { functionId: 'FF-C02', name: 'max-fan-in', reason: 'disabled in spec' },
      { functionId: 'FF-CV01', name: 'naming-conventions', reason: 'no application layer' },
      { functionId: 'FF-S03', name: 'no-layer-skip', reason: 'not applicable to style clean-architecture' },
    ]);
    expect(report.functionExecution.disabled).toBe(3);
  });
});

// ---------------------------------------------------------------- BR-U3-54, 55, 57, 63

describe('functionResults, run-level fields and warnings (BR-U3-54, 55, 57, 63)', () => {
  const compiled = compiledOf({
    symbolicQueries: [
      query('FF-P01', 'domain-purity', 'pattern'),
      query('FF-S02', 'no-cyclic-deps', 'structural'),
      query('FF-S01', 'dependency-direction', 'structural'),
      query('FF-C04', 'max-fan-in', 'coupling'),
    ],
  });
  const evaluation: EvaluationResults = {
    symbolicResults: [
      symResult('FF-P01', 'pattern', { tag: 'pattern-proxy' }),
      symResult('FF-S02', 'structural', { violations: [violation('FF-S02', 'structural', 'a.ts'), violation('FF-S02', 'structural', 'b.ts')], truncated: true }),
      symResult('FF-S01', 'structural'),
      symResult('FF-C04', 'coupling', { tag: 'topological' }),
    ],
    neuronalResults: [],
    failures: [],
  };
  const secret = 'u3-builder-secret-1234';
  const warnings: PipelineWarning[] = [
    { stage: 'compute-scores', code: 'METRIC_002', message: 'ratio undefined' },
    { stage: 'ingest-apg', code: 'INGEST_009', message: `could not reach host with ${secret}` },
  ];

  it('rows are ordered by tag rank then id, carry tags, counts and truncated', () => {
    const report = ok(scoredOf(evaluation, 'symbolic-only'), factsOf({ compiled, evaluation, mode: 'symbolic-only', pipelineWarnings: warnings, knownSecrets: [secret] }));
    expect(report.functionResults.map((r) => [r.functionId, r.tag, r.violationCount, r.truncated, r.passed])).toEqual([
      ['FF-S01', 'structural', 0, false, true],
      ['FF-C04', 'topological', 0, false, true],
      ['FF-S02', 'topological', 2, true, false],
      ['FF-P01', 'pattern-proxy', 0, false, true],
    ]);
    expect(report.functionResults.every((r) => r.route === 'symbolic' && r.executionTimeMs === 5)).toBe(true);
  });

  it('copies the run-level fields and the symbolic-only judge stub; merges and scrubs warnings', () => {
    const facts = factsOf({ compiled, evaluation, mode: 'symbolic-only', pipelineWarnings: warnings, knownSecrets: [secret] });
    const report = ok(scoredOf(evaluation, 'symbolic-only'), facts);
    expect(report.graphStats).toEqual(facts.ingestion.graphStats);
    expect(report.layerAnnotation).toEqual(facts.ingestion.layerAnnotationSummary);
    expect(report.parseCoverage).toEqual(facts.apg.parseCoverage);
    expect(report.importResolution.external).toBe(3);
    expect(report.timings).toEqual(facts.timings);
    expect(report.judge).toEqual({ provider: 'none', model: 'none', runsPerUnit: 0 });
    expect(report.warnings.map((w) => w.code)).toEqual(['INGEST_009', 'METRIC_002']);
    expect(JSON.stringify(report.warnings)).not.toContain(secret);
    expect(report.runId).toBe('run-test');
  });

  it('I4: perDimensionScores functionCount must sum to executed', () => {
    const scored = scoredOf(evaluation, 'symbolic-only');
    const broken: ScoredReport = { ...scored, perDimensionScores: scored.perDimensionScores.slice(1) };
    expect(failCode(broken, factsOf({ compiled, evaluation, mode: 'symbolic-only' }))).toBe('REPORT_COUNTS_INCONSISTENT I4');
  });

  it('I1: declared + adrDerived must equal compiled + disabled + dropped', () => {
    expect(failCode(scoredOf(evaluation, 'symbolic-only'), factsOf({ compiled, evaluation, mode: 'symbolic-only', compileFacts: { declared: 9, adrDerived: 0, dropped: [] } })))
      .toBe('REPORT_COUNTS_INCONSISTENT I1');
  });

  it('I3: a dropped id that was compiled is rejected', () => {
    expect(failCode(scoredOf(evaluation, 'symbolic-only'), factsOf({ compiled, evaluation, mode: 'symbolic-only', compileFacts: { declared: 5, adrDerived: 0, dropped: [functionId('FF-S01')] } })))
      .toBe('REPORT_COUNTS_INCONSISTENT I3');
  });

  it('I5: a result for a function that was not compiled is rejected', () => {
    const extra: EvaluationResults = { ...evaluation, symbolicResults: [...evaluation.symbolicResults, symResult('FF-Z99', 'solid')] };
    expect(failCode(scoredOf(extra, 'symbolic-only'), factsOf({ compiled, evaluation: extra, mode: 'symbolic-only' }))).toBe('REPORT_COUNTS_INCONSISTENT I5');
  });
});
