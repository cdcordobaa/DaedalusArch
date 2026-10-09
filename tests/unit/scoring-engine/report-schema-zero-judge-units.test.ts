/**
 * ADR-021 (U6 SO4 lane, item 9): a full-mode report of a project with zero judge units is a valid, explicit state.
 *
 * With no judge unit, no model-judged dimension executes, so `ahsNeuronal` has no executed weight and is absent, and
 * `droppedDimensions` names `semantic` and `integrity` (`no-judge-units` when both functions are declared and have no
 * unit). The frozen schema required `ahsNeuronal` in full mode, so such a report failed validation (MarvinRF, Docs/corpus.md).
 * The amended rule: full mode requires `ahsNeuronal` unless `droppedDimensions` lists both model-judged dimensions.
 */
import { validateReport } from '../../../src/scoring-engine/report-schema-validator.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { functionId } from '../../../src/shared/types/value-objects.js';
import type { GraphRepository, QueryResult } from '../../../src/shared/interfaces/graph-repository.js';
import type { EvaluationReport, SymbolicFunctionResult } from '../../../src/shared/types/evaluation.js';
import type { FitnessFunction } from '../../../src/shared/types/spec.js';
import type { Dimension } from '../../../src/shared/types/enums.js';
import { scoreAndAssemble } from './assembled-report-fixture.js';

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

function sym(id: string, dimension: Dimension): SymbolicFunctionResult {
  return { functionId: functionId(id), dimension, passed: true, executionTimeMs: 1, deterministic: true, tag: 'structural', violations: [] };
}

function fn(id: string, dimension: Dimension, route: 'symbolic' | 'neuronal'): FitnessFunction {
  return { id: functionId(id), name: id, dimension, severity: 'major', route, isBuiltIn: true, validated: true, enabled: true, excludePaths: [] };
}

const WEIGHTS = { structural: 0.35, coupling: 0.2, pattern: 0.3, solid: 0.1, convention: 0.05, semantic: 0, integrity: 0 };
const FULL_WEIGHTS = { structural: 0.32, coupling: 0.18, pattern: 0.27, solid: 0.1, convention: 0.05, semantic: 0.04, integrity: 0.04 };

/** A full-mode report whose two judge functions (FF-N01 integrity, FF-N02 semantic) had no unit to judge. */
async function zeroUnitReport(): Promise<EvaluationReport> {
  const r = await scoreAndAssemble({
    evaluationResults: { symbolicResults: [sym('FF-S01', 'structural'), sym('FF-C04', 'coupling')], neuronalResults: [], failures: [] },
    scoringWeights: WEIGHTS,
    fullModeWeights: FULL_WEIGHTS,
    confidenceThresholds: { high: 0.85, medium: 0.6, iccMinimum: 0.7 },
    verdictThresholds: { pass: 0.8, warning: 0.65, softBlock: 0.5 },
    mode: 'full',
    projectPath: '/p',
    specVersion: '1',
    graphRepository: repo(),
    fitnessFunctions: [fn('FF-S01', 'structural', 'symbolic'), fn('FF-C04', 'coupling', 'symbolic'), fn('FF-N01', 'integrity', 'neuronal'), fn('FF-N02', 'semantic', 'neuronal')],
    compiled: { symbolicQueries: [], neuronalInstructions: [], hybridPairs: [], totalCompiled: 0, disabledFunctions: [], warnings: [] },
    noJudgeUnits: [functionId('FF-N01'), functionId('FF-N02')],
  });
  if (!r.success) throw new Error(`assembly failed: ${r.errors.map((e) => `${e.code} ${e.message}`).join('; ')}`);
  return r.data;
}

const stored = (r: EvaluationReport): Record<string, unknown> => JSON.parse(JSON.stringify(r)) as Record<string, unknown>;
const codes = (r: DomainResult<unknown>): string[] => (r.success ? [] : r.errors.map((e) => e.code));

describe('full mode with zero judge units (ADR-021 item 9)', () => {
  it('assembles a schema-valid report: no ahsNeuronal, both model-judged dimensions dropped as no-judge-units', async () => {
    const report = await zeroUnitReport();
    expect(report).not.toHaveProperty('ahsNeuronal');
    expect(report.ahsCombined).toBeDefined();
    expect(report.neuralResults).toEqual([]);
    const judged = report.droppedDimensions.filter((d) => d.dimension === 'semantic' || d.dimension === 'integrity');
    expect(judged.map((d) => [d.dimension, d.reason]).sort()).toEqual([
      ['integrity', 'no-judge-units'], ['semantic', 'no-judge-units'],
    ]);
    expect(codes(validateReport(stored(report)))).toEqual([]);
  });

  it('full mode without ahsNeuronal fails when a model-judged dimension is not dropped', async () => {
    const r = stored(await zeroUnitReport());
    const dropped = (r.droppedDimensions as { dimension: string }[]).filter((d) => d.dimension !== 'semantic');
    expect(codes(validateReport({ ...r, droppedDimensions: dropped }))).toEqual(['REPORT_SCHEMA_INVALID']);
    expect(codes(validateReport({ ...r, droppedDimensions: [] }))).toEqual(['REPORT_SCHEMA_INVALID']);
  });

  it('full mode still requires ahsCombined and neuralResults; neuronal-only still requires ahsNeuronal', async () => {
    const { ahsCombined: _c, ...noCombined } = stored(await zeroUnitReport());
    expect(codes(validateReport(noCombined))).toEqual(['REPORT_SCHEMA_INVALID']);
    const { neuralResults: _n, ...noRows } = stored(await zeroUnitReport());
    expect(codes(validateReport(noRows))).toEqual(['REPORT_SCHEMA_INVALID']);
    const r = stored(await zeroUnitReport());
    expect(codes(validateReport({ ...r, evaluationMode: 'neuronal-only' }))).toEqual(['REPORT_SCHEMA_INVALID']);
  });
});
