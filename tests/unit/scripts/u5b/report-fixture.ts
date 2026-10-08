/**
 * U5b test helper: schema-valid stored reports built through the real C8 assembly path
 * (`scoreAndAssemble`, the U3 test helper), returned as JSON copies that tests may edit.
 * These are in-memory test inputs, not committed reports (D-U5b-7 covers committed ones).
 */
import { scoreAndAssemble } from '../../scoring-engine/assembled-report-fixture.js';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import { confidence, functionId } from '../../../../src/shared/types/value-objects.js';
import type { GraphRepository, QueryResult } from '../../../../src/shared/interfaces/graph-repository.js';
import type { NeuronalFunctionResult, SymbolicFunctionResult } from '../../../../src/shared/types/evaluation.js';
import type { Dimension, EvaluationMode } from '../../../../src/shared/types/enums.js';

export type StoredReport = Record<string, unknown> & {
  functionExecution: { failed: { functionId: string; name: string; code: string; message: string }[] } & Record<string, unknown>;
  functionResults: ({ functionId: string; truncated: boolean } & Record<string, unknown>)[];
  warnings: { code: string; message: string; stage: string; context?: Record<string, unknown> }[];
  judge: Record<string, unknown>;
  disabledFunctions: Record<string, unknown>[];
};

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

function neural(id: string, dimension: Dimension): NeuronalFunctionResult {
  return {
    functionId: functionId(id), dimension, verdict: 'pass', confidence: confidence(0.9), confidenceStdDev: 0.01, icc: 1,
    reasoning: 'r', evidence: [], violations: [], runs: [], deterministic: false, flaggedUnstable: false,
    unitResults: [], unitsSelected: 1, unitsCapped: 0,
  };
}

const WEIGHTS = { structural: 0.35, coupling: 0.2, pattern: 0.3, solid: 0.1, convention: 0.05, semantic: 0, integrity: 0 };
const FULL_WEIGHTS = { structural: 0.32, coupling: 0.18, pattern: 0.27, solid: 0.1, convention: 0.05, semantic: 0.04, integrity: 0.04 };

/** A schema-valid stored report for `mode` (two symbolic functions; two judged functions outside symbolic-only). */
export async function storedReport(mode: EvaluationMode = 'symbolic-only'): Promise<StoredReport> {
  const r = await scoreAndAssemble({
    evaluationResults: {
      symbolicResults: mode === 'neuronal-only' ? [] : [sym('FF-S01', 'structural'), sym('FF-S04', 'structural', false)],
      neuronalResults: mode === 'symbolic-only' ? [] : [neural('FF-N01', 'integrity'), neural('FF-N02', 'semantic')],
      failures: [],
    },
    scoringWeights: WEIGHTS,
    ...(mode !== 'symbolic-only' && { fullModeWeights: FULL_WEIGHTS }),
    confidenceThresholds: { high: 0.85, medium: 0.6, iccMinimum: 0.7 },
    verdictThresholds: { pass: 0.8, warning: 0.65, softBlock: 0.5 },
    mode,
    projectPath: 'fixtures/p',
    specVersion: '1',
    graphRepository: repo(),
    fitnessFunctions: [],
    compiled: { symbolicQueries: [], neuronalInstructions: [], hybridPairs: [], totalCompiled: 0, disabledFunctions: [], warnings: [] },
    noJudgeUnits: [],
  });
  if (!r.success) throw new Error(`fixture assembly failed: ${r.errors.map((e) => e.code).join(', ')}`);
  return JSON.parse(JSON.stringify(r.data)) as StoredReport;
}
