/**
 * Bundled C10 patch, U3 rows (U3-R1; U3 domain-entities.md §8; D-U0-2, D-U0-4; D-U3-7).
 * Type-level pins: each `@ts-expect-error` line must fail to compile, so a later change
 * that loosens a required field breaks `npx tsc -p tsconfig.u3-tests.json`.
 */
import { ahsScore, avrScore, functionId, runId } from '../../../src/shared/types/value-objects.js';
import type {
  DisabledFunctionRow, DroppedReason, EvaluationReport, EvaluationResults, FunctionExecution,
  FunctionResultRow, NeuralResultRow, PerDimensionScore, ReportScoring, ScoredReport,
  SymbolicFunctionResult, UniversalHealthMetrics,
} from '../../../src/shared/types/evaluation.js';
import type { ResultMapping } from '../../../src/fitness-compiler/types.js';

const scoring: ReportScoring = {
  weights: { structural: 0.35, coupling: 0.2, pattern: 0.3, solid: 0.1, convention: 0.05, semantic: 0, integrity: 0 },
  thresholds: { pass: 0.8, warning: 0.65, softBlock: 0.5 },
  confidenceThresholds: { high: 0.85, medium: 0.6, iccMinimum: 0.7 },
  verdictSource: 'ahsDeterministic',
};

const functionExecution: FunctionExecution = {
  declared: 2, adrDerived: 0, compiled: 1, disabled: 1, dropped: [], skippedByMode: 0,
  noJudgeUnits: [], executed: 1, failed: [],
};

const row: FunctionResultRow = {
  functionId: functionId('FF-S01'), name: 'dependency-direction', dimension: 'structural', route: 'symbolic',
  tag: 'structural', passed: true, violationCount: 0, executionTimeMs: 3, truncated: false,
};

const disabled: DisabledFunctionRow = { functionId: functionId('FF-P05'), name: 'repository-pattern', reason: 'disabled in spec' };

const score: PerDimensionScore = {
  dimension: 'structural', avr: avrScore(0), violatedWeight: 0, weight: 0.35, effectiveWeight: 1, violationCount: 0, functionCount: 1,
};

const report: EvaluationReport = {
  runId: runId('run-c10'), projectPath: '/p', specVersion: '1.0', ahsDeterministic: ahsScore(1), verdict: 'pass',
  scoring, perDimensionScores: [score], violations: [],
  universalMetrics: {
    cyclicDependencyCount: 0, maxFanOut: 0, maxFanIn: 0, abstractionRatio: null, averageInstability: null, orphanFileCount: 0,
  },
  evaluationMode: 'symbolic-only', durationMs: 1, warnings: [],
  functionExecution, functionResults: [row], disabledFunctions: [disabled],
  graphStats: { nodeCount: 0, edgeCount: 0, layerCoverage: 0, nodeCountByType: {}, edgeCountByType: {} },
  layerAnnotation: { mapped: 0, unmapped: 0, unmappedFiles: [] },
  parseCoverage: { total: 0, parsed: 0, percentage: 0, skipped: [] },
  importResolution: { resolvedInternal: 0, external: 0, unresolved: 0, unsupportedDynamic: 0, externalOutOfRootAlias: 0, droppedNoFileNode: 0 },
  timings: { stages: [], totalMs: 0 },
  droppedDimensions: [],
  judge: { provider: 'none', model: 'none', runsPerUnit: 0 },
};

const { disabledFunctions: _disabledFunctions, ...reportWithoutDisabled } = report;
const { noJudgeUnits: _noJudgeUnits, ...executionWithoutNoJudgeUnits } = functionExecution;
const { truncated: _truncated, ...rowWithoutTruncated } = row;
const { scoring: _scoring, ...reportWithoutScoring } = report;
const { violatedWeight: _violatedWeight, ...scoreWithoutViolatedWeight } = score;
const { effectiveWeight: _effectiveWeight, ...scoreWithoutEffectiveWeight } = score;

describe('bundled C10 patch, U3 rows (U3-R1; DE §8)', () => {
  it('rejects a report literal without disabledFunctions (row 12) or scoring (row 7)', () => {
    // @ts-expect-error disabledFunctions is required (row 12, D-U0-2)
    const a: EvaluationReport = reportWithoutDisabled;
    // @ts-expect-error scoring is required (row 7)
    const b: EvaluationReport = reportWithoutScoring;
    expect(a).not.toHaveProperty('disabledFunctions');
    expect(b).not.toHaveProperty('scoring');
  });

  it('rejects a report whose functionExecution lacks noJudgeUnits (row 4)', () => {
    // @ts-expect-error noJudgeUnits is required (row 4)
    const e: FunctionExecution = executionWithoutNoJudgeUnits;
    // @ts-expect-error the report's functionExecution needs noJudgeUnits too
    const r: EvaluationReport = { ...report, functionExecution: executionWithoutNoJudgeUnits };
    expect(e).not.toHaveProperty('noJudgeUnits');
    expect(r.functionExecution).not.toHaveProperty('noJudgeUnits');
  });

  it('rejects a FunctionResultRow without truncated (row 5)', () => {
    // @ts-expect-error truncated is required on the report row (row 5)
    const r: FunctionResultRow = rowWithoutTruncated;
    expect(r).not.toHaveProperty('truncated');
  });

  it('requires violatedWeight and effectiveWeight on PerDimensionScore (row 8)', () => {
    // @ts-expect-error violatedWeight is required (row 8)
    const a: PerDimensionScore = scoreWithoutViolatedWeight;
    // @ts-expect-error effectiveWeight is required (row 8, D-U0-2)
    const b: PerDimensionScore = scoreWithoutEffectiveWeight;
    expect(a).not.toHaveProperty('violatedWeight');
    expect(b).not.toHaveProperty('effectiveWeight');
  });

  it("accepts 'no-judge-units' as a DroppedReason (row 13) and nothing outside the four members", () => {
    const reasons: DroppedReason[] = ['none_declared', 'disabled_by_spec', 'no-judge-units', 'execution_failure'];
    // @ts-expect-error the member is hyphenated, as U4 names it
    const wrong: DroppedReason = 'no_judge_units';
    expect(reasons).toContain('no-judge-units');
    expect(wrong).toBe('no_judge_units');
  });

  it('makes ahsDeterministic optional (row 9) and universal metrics nullable (row 10)', () => {
    const { ahsDeterministic: _ahs, ...neuronalOnly } = report;
    const r: EvaluationReport = { ...neuronalOnly, evaluationMode: 'neuronal-only' };
    const m: UniversalHealthMetrics = { ...report.universalMetrics, maxFanIn: null };
    expect(r.ahsDeterministic).toBeUndefined();
    expect(m.maxFanIn).toBeNull();
  });

  it('accepts truncated and neuralSkipped on SymbolicFunctionResult (rows 5, 6) and failures (row 1)', () => {
    const sym: SymbolicFunctionResult = {
      functionId: functionId('FF-S02'), dimension: 'structural', passed: false, violations: [],
      executionTimeMs: 1, deterministic: true, truncated: true, neuralSkipped: 'symbolic-fail',
    };
    const results: EvaluationResults = {
      symbolicResults: [sym], neuronalResults: [],
      failures: [{ functionId: functionId('FF-X'), name: 'x', code: 'EVAL_001', message: 'm' }],
    };
    expect(results.failures).toHaveLength(1);
  });

  it('accepts neuralResults rows in U4 DE §4.8 shape (row 14) and ScoredReport omits the builder fields (row 16)', () => {
    const neural: NeuralResultRow = {
      functionId: functionId('FF-I01'), dimension: 'integrity', aggregationRule: 'majority-of-valid-units-v1',
      selection: { source: 'own', candidateUnitIds: ['a.ts'], selectedUnitIds: ['a.ts'] },
      unitsSelected: 1, unitsCapped: 0, candidateCount: 1, uncoveredFileCount: 0,
      candidateExclusions: {
        unlayered: 0, 'exclude-paths': 0, barrel: 0, 'test-path': 0, 'e2e-spec': 0, 'generated-path': 0, 'generated-marker': 0,
      },
      unitsInvalidByCause: {
        PARSE_FAILURE: 0, MISSING_CONFIDENCE: 0, MODEL_MISMATCH: 0, TIMEOUT: 0, BAD_ENVELOPE: 0, CLI_EXIT: 0,
        INSUFFICIENT_VALID_RUNS: 0,
      },
      truncatedUnits: 0, excerptTruncatedUnits: 0, removedByVariant: [],
      unitResults: [{
        unitId: 'a.ts', unitKind: 'file', layer: 'domain', filePaths: ['a.ts'], status: 'valid', verdict: 'pass',
        confidence: 0.9, confidenceStdDev: 0, flaggedUnstable: false, validRunCount: 3,
      }],
    };
    const full: EvaluationReport = { ...report, evaluationMode: 'full', neuralResults: [neural] };
    const {
      warnings: _w, functionExecution: _fe, functionResults: _fr, graphStats: _gs, layerAnnotation: _la,
      parseCoverage: _pc, importResolution: _ir, timings: _t, judge: _j, disabledFunctions: _df, neuralResults: _nr,
      ...scored
    } = full;
    const s: ScoredReport = scored;
    // @ts-expect-error ScoredReport has no disabledFunctions (row 16)
    const leaked: ScoredReport = { ...s, disabledFunctions: [] };
    expect(full.neuralResults).toHaveLength(1);
    expect(Object.keys(s)).not.toContain('neuralResults');
    expect(leaked).toHaveProperty('disabledFunctions');
  });

  it('requires discriminatorColumns on ResultMapping (row 11, D-U0-4) and allows evidenceColumns', () => {
    const ok: ResultMapping = { filePathColumn: 'filePath', messageTemplate: 'm', discriminatorColumns: [], evidenceColumns: ['fanIn'] };
    // @ts-expect-error discriminatorColumns is required
    const missing: ResultMapping = { filePathColumn: 'filePath', messageTemplate: 'm' };
    expect(ok.discriminatorColumns).toEqual([]);
    expect(missing).not.toHaveProperty('discriminatorColumns');
  });
});
