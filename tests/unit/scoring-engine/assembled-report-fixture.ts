/**
 * Test helper (U3-R10): score a `ScoringInput` and assemble the report as `AssembleReportCommand`
 * does (`computeScoredReport` → `buildEvaluationReport`), replacing the removed `computeScores`
 * placeholder path. The compiled set is derived from the results: one `dependency-direction`
 * symbolic query per symbolic result or failure, one neuronal instruction per neural result; in
 * full and neuronal-only modes a stub of U4's `toNeuralResultRows` supplies one row per neural result.
 */
import { computeScoredReport } from '../../../src/scoring-engine/scoring-engine.js';
import { buildEvaluationReport, NO_JUDGE } from '../../../src/scoring-engine/report-builder.js';
import type { ScoringInput } from '../../../src/scoring-engine/types.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type {
  CompiledFunctions, CypherQuery, EvaluationReport, NeuralResultRow, NeuronalFunctionResult, NeuronalInstruction,
} from '../../../src/shared/types/evaluation.js';

function queryOf(id: CypherQuery['functionId'], dimension: CypherQuery['dimension']): CypherQuery {
  return { functionId: id, name: 'dependency-direction', cypher: 'RETURN 1', params: {}, dimension, severity: 'major', route: 'symbolic', source: 'template' };
}

function instructionOf(r: NeuronalFunctionResult): NeuronalInstruction {
  return {
    functionId: r.functionId, name: `judge-${String(r.functionId)}`, dimension: r.dimension, severity: 'major', route: 'neuronal',
    semanticCriteria: { rule: 'r', rubric: { pass: 'p', fail: 'f', evidenceRequired: 'e' } },
    contextAssembly: { includeAPGSubgraph: false, includeSourceCode: true },
    shadowModeEligible: false, source: 'fitness-function', judgeUnit: 'file',
  };
}

/** Stub of U4's `toNeuralResultRows`: one row per neural result, every field filled. */
export function stubNeuralRows(results: readonly NeuronalFunctionResult[]): NeuralResultRow[] {
  return results.map((r) => ({
    functionId: r.functionId, dimension: r.dimension, aggregationRule: 'majority-of-valid-units-v1',
    selection: { source: 'own', candidateUnitIds: ['src/a.ts'], selectedUnitIds: ['src/a.ts'] },
    unitsSelected: 1, unitsCapped: 0, candidateCount: 1, uncoveredFileCount: 0,
    candidateExclusions: { unlayered: 0, 'exclude-paths': 0, barrel: 0, 'test-path': 0, 'e2e-spec': 0, 'generated-path': 0, 'generated-marker': 0 },
    unitsInvalidByCause: { PARSE_FAILURE: 0, MISSING_CONFIDENCE: 0, MODEL_MISMATCH: 0, TIMEOUT: 0, BAD_ENVELOPE: 0, CLI_EXIT: 0, INSUFFICIENT_VALID_RUNS: 0 },
    truncatedUnits: 0, excerptTruncatedUnits: 0, removedByVariant: [],
    unitResults: [{
      unitId: 'src/a.ts', unitKind: 'file', layer: 'domain', filePaths: ['src/a.ts'], status: 'valid', verdict: r.verdict,
      confidence: Number(r.confidence), confidenceStdDev: r.confidenceStdDev, flaggedUnstable: r.flaggedUnstable, validRunCount: 1,
    }],
  }));
}

export async function scoreAndAssemble(input: ScoringInput): Promise<DomainResult<EvaluationReport>> {
  const scored = await computeScoredReport(input);
  if (!scored.success) return DomainResult.fail(scored.errors, scored.warnings);
  const ev = input.evaluationResults;
  const symbolicQueries = [
    ...ev.symbolicResults.map((r) => queryOf(r.functionId, r.dimension)),
    ...(ev.failures ?? []).map((f) => queryOf(f.functionId, 'structural')),
  ];
  const neuronalInstructions = ev.neuronalResults.map(instructionOf);
  const compiled: CompiledFunctions = {
    symbolicQueries, neuronalInstructions, hybridPairs: [],
    totalCompiled: symbolicQueries.length + neuronalInstructions.length,
    disabledFunctions: input.compiled.disabledFunctions,
    warnings: [],
  };
  return buildEvaluationReport(scored.data, {
    apg: {
      parseCoverage: { total: 1, parsed: 1, percentage: 100, skipped: [] },
      importResolution: { resolvedInternal: 0, external: 0, unresolved: 0, unsupportedDynamic: 0, externalOutOfRootAlias: 0, droppedNoFileNode: 0 },
    },
    ingestion: {
      graphStats: { nodeCount: 1, edgeCount: 0, layerCoverage: 1, nodeCountByType: { File: 1 }, edgeCountByType: { IMPORTS: 0 } },
      layerAnnotationSummary: { mapped: 1, unmapped: 0, unmappedFiles: [] },
    },
    compiled,
    compileFacts: { declared: compiled.totalCompiled + compiled.disabledFunctions.length, adrDerived: 0, dropped: [] },
    evaluation: ev,
    timings: { stages: [{ name: 'compute-scores', durationMs: 1, status: 'success' }], totalMs: 1 },
    pipelineWarnings: (scored.warnings ?? []).map((w) => ({ ...w, stage: 'compute-scores' })),
    judge: NO_JUDGE,
    ...(input.mode !== 'symbolic-only' && { neuralRows: stubNeuralRows(ev.neuronalResults) }),
    knownSecrets: [],
    mode: input.mode,
  });
}
