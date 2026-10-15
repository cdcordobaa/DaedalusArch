/**
 * v1.3 scoring mode (FR-V6, unit U-D): verdict from blocking rules only, advisory findings reported apart,
 * FF-P06 FLOWS_TO rows N/A with denominators, style-dependent FF-S03, and the v1.2E mode unchanged.
 */
import { computeScoredReport } from '../../../src/scoring-engine/scoring-engine.js';
import { computeTieredScoring, overallVerdictOf, parseScoringMode, relTypeOf } from '../../../src/scoring-engine/tiered-scoring.js';
import { validateReport } from '../../../src/scoring-engine/report-schema-validator.js';
import { scoreAndAssemble } from './assembled-report-fixture.js';
import type { ScoringInput } from '../../../src/scoring-engine/types.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { confidence, functionId } from '../../../src/shared/types/value-objects.js';
import type { EvaluationResults, NeuronalFunctionResult, ScoredReport, SymbolicFunctionResult } from '../../../src/shared/types/evaluation.js';
import type { Violation } from '../../../src/shared/taxonomy/violation-types.js';
import type { Dimension } from '../../../src/shared/types/enums.js';
import type { FitnessFunction, ScoringWeights } from '../../../src/shared/types/spec.js';
import type { GraphRepository, QueryResult } from '../../../src/shared/interfaces/graph-repository.js';
import type { APGResult } from '../../../src/shared/types/apg.js';
import { LAYERED_TEMPLATE } from '../../../src/spec-parser/template-registry.js';

const WEIGHTS: ScoringWeights = { structural: 0.35, coupling: 0.20, pattern: 0.30, solid: 0.10, convention: 0.05, semantic: 0, integrity: 0 };
const FULL_WEIGHTS: ScoringWeights = { structural: 0.32, coupling: 0.18, pattern: 0.27, solid: 0.10, convention: 0.05, semantic: 0.04, integrity: 0.04 };

function graph(): GraphRepository {
  return {
    executeQuery: (): Promise<DomainResult<QueryResult>> =>
      Promise.resolve(DomainResult.ok({ records: [{ cnt: 0, val: 0 }], summary: { counters: {} } })),
    clearGraph: () => Promise.resolve(DomainResult.ok(undefined)),
    healthCheck: () => Promise.resolve(true),
    close: () => Promise.resolve(),
  };
}

const violation = (id: string, dim: Dimension, n: number, discriminator?: string[]): Violation => ({
  id: `v-${id}-${String(n)}`, type: 'LAYER_VIOLATION', dimension: dim, severity: 'critical', functionId: functionId(id),
  route: 'symbolic', filePath: `src/f${String(n)}.ts`, message: `row ${String(n)}`, deterministic: true,
  ...(discriminator !== undefined && { discriminator }),
});

const sym = (id: string, dim: Dimension, violations: number | Violation[] = 0): SymbolicFunctionResult => {
  const rows = typeof violations === 'number' ? Array.from({ length: violations }, (_, i) => violation(id, dim, i)) : violations;
  return { functionId: functionId(id), dimension: dim, passed: rows.length === 0, violations: rows, executionTimeMs: 1, deterministic: true };
};

const judge = (id: string, dim: Dimension, verdict: 'pass' | 'fail'): NeuronalFunctionResult => ({
  functionId: functionId(id), dimension: dim, verdict, confidence: confidence(0.9), confidenceStdDev: 0, icc: 0, reasoning: 'r', evidence: [],
  violations: verdict === 'fail' ? [{ ...violation(id, dim, 0), route: 'neuronal', deterministic: false, type: 'INTEGRITY_VIOLATION' }] : [],
  runs: [{ runIndex: 0, verdict, confidence: confidence(0.9), reasoning: 'r' }], deterministic: false, flaggedUnstable: false,
  unitResults: [], unitsSelected: 1, unitsCapped: 0,
});

const p06Row = (n: number, relType: 'FLOWS_TO' | 'CONSTRUCTOR_INJECTS'): Violation => ({
  ...violation('FF-P06', 'pattern', n, ['Order', 'Db', relType, 'db']),
  type: 'DOMAIN_STATE_PURITY_VIOLATION',
  message: `Domain class Order holds infrastructure Db via ${relType} (db)`,
});

/** Spec functions = the layered library (all 27 ids, names from the registry). */
const FUNCTIONS: readonly FitnessFunction[] = LAYERED_TEMPLATE.functions;

function input(results: EvaluationResults, extra: Partial<ScoringInput> = {}): ScoringInput {
  return {
    evaluationResults: results,
    scoringWeights: WEIGHTS,
    confidenceThresholds: { high: 0.85, medium: 0.6, iccMinimum: 0.7 },
    verdictThresholds: { pass: 0.8, warning: 0.65, softBlock: 0.5 },
    mode: 'symbolic-only',
    projectPath: '/p',
    specVersion: '1.0.0',
    graphRepository: graph(),
    fitnessFunctions: FUNCTIONS,
    compiled: { symbolicQueries: [], neuronalInstructions: [], hybridPairs: [], totalCompiled: 0, disabledFunctions: [], warnings: [] },
    noJudgeUnits: [],
    ...extra,
  };
}

const BLOCKING_CLEAN = [sym('FF-S01', 'structural'), sym('FF-S02', 'structural'), sym('FF-P01', 'pattern'), sym('FF-P03', 'pattern')];

async function scored(results: EvaluationResults, extra: Partial<ScoringInput> = {}): Promise<ScoredReport> {
  const r = await computeScoredReport(input(results, extra));
  if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
  return r.data;
}

/** The report without the run-dependent fields. */
const stable = (r: ScoredReport): Record<string, unknown> => {
  const { runId: _r, durationMs: _d, ...rest } = r;
  return rest;
};

describe('v1.3 verdict: only blocking rules fail it', () => {
  it('advisory-only violations (metric, convention, proxy, judge) give PASS, even when the v1.2E verdict blocks', async () => {
    const results: EvaluationResults = {
      symbolicResults: [...BLOCKING_CLEAN, sym('FF-C02', 'coupling', 3), sym('FF-C03', 'coupling', 1), sym('FF-CV05', 'convention', 4),
        sym('FF-SO01', 'solid', 2), sym('FF-P02', 'pattern', 1)],
      neuronalResults: [judge('FF-N01', 'integrity', 'fail')],
    };
    const report = await scored(results, { scoringMode: 'v1.3', mode: 'full', fullModeWeights: FULL_WEIGHTS });
    const tiers = report.tiers;
    expect(tiers).toBeDefined();
    if (tiers === undefined) return;
    expect(tiers.verdict).toBe('pass');
    expect(report.verdict).toBe('pass');
    expect(tiers.v12eVerdict).not.toBe('pass');
    expect(tiers.blockingAhs).toBe(1);
    expect(tiers.blocking).toMatchObject({ violatedRules: 0, violationCount: 0 });
    expect(tiers.advisory.violatedRules).toBe(6);
    expect(tiers.advisory.violationCount).toBe(12);
    expect(tiers.advisory.rules.map((r) => [String(r.functionId), r.violationCount])).toEqual([
      ['FF-C02', 3], ['FF-C03', 1], ['FF-CV05', 4], ['FF-N01', 1], ['FF-P02', 1], ['FF-SO01', 2],
    ]);
    expect(tiers.advisory.rules.find((r) => String(r.functionId) === 'FF-N01')?.judge).toBe(true);
  });

  it('one blocking violation gives FAIL (report verdict hard-block), with the count on its rule', async () => {
    const results: EvaluationResults = {
      symbolicResults: [sym('FF-S01', 'structural', 1), sym('FF-S02', 'structural'), sym('FF-P01', 'pattern'), sym('FF-P03', 'pattern'),
        sym('FF-C02', 'coupling', 2)],
      neuronalResults: [],
    };
    const report = await scored(results, { scoringMode: 'v1.3' });
    expect(report.tiers?.verdict).toBe('fail');
    expect(report.verdict).toBe('hard-block');
    expect(report.tiers?.verdictRule).toBe('any-blocking-violation');
    expect(report.tiers?.blocking.rules.filter((r) => r.violated).map((r) => [String(r.functionId), r.violationCount])).toEqual([['FF-S01', 1]]);
    // Blocking AHS: structural 1/2 violated, pattern 0; weights 0.35 and 0.30 renormalised -> 1 - 0.35/0.65 * 0.5.
    expect(report.tiers?.blockingAhs).toBe(Math.round((1 - (0.35 / 0.65) * 0.5) * 1000) / 1000);
    expect(report.tiers?.advisory.violationCount).toBe(2);
  });

  it('the v1.2E AHS fields are the same in both modes; only verdict and tiers differ', async () => {
    const results: EvaluationResults = { symbolicResults: [...BLOCKING_CLEAN, sym('FF-C02', 'coupling', 5), sym('FF-CV05', 'convention', 1)], neuronalResults: [] };
    const v12 = await scored(results);
    const v13 = await scored(results, { scoringMode: 'v1.3', style: 'layered' });
    const { tiers, verdict, ...v13rest } = stable(v13);
    const { verdict: v12verdict, ...v12rest } = stable(v12);
    expect(v13rest).toEqual(v12rest);
    expect((tiers as { v12eVerdict: string }).v12eVerdict).toBe(v12verdict);
    expect(verdict).toBe('pass');
  });

  it('a blocking rule that failed to execute is listed and does not count (as in v1.2E)', async () => {
    const results: EvaluationResults = {
      symbolicResults: [sym('FF-S01', 'structural'), sym('FF-P01', 'pattern', 2)],
      neuronalResults: [],
      failures: [{ functionId: functionId('FF-P01'), name: 'domain-purity', code: 'EVAL_001', message: 'timeout' }],
    };
    const report = await scored(results, { scoringMode: 'v1.3' });
    expect(report.tiers?.verdict).toBe('pass');
    expect(report.tiers?.blockingNotExecuted.map(String)).toEqual(['FF-P01']);
  });
});

describe('v1.3 N/A handling: FF-P06 FLOWS_TO rows', () => {
  const apg = { nodes: [], edges: [{ id: 'e1', type: 'FLOWS_TO', sourceId: 'a', targetId: 'b', properties: {} }] } as unknown as APGResult;

  it('reads the relType from the discriminator, or from the message', () => {
    expect(relTypeOf(p06Row(0, 'FLOWS_TO'))).toBe('FLOWS_TO');
    const { discriminator: _d, ...noDisc } = p06Row(0, 'CONSTRUCTOR_INJECTS');
    expect(relTypeOf(noDisc)).toBe('CONSTRUCTOR_INJECTS');
  });

  it('only FLOWS_TO rows: PASS, the rows reported N/A with their denominators', () => {
    const tiers = computeTieredScoring({
      evaluationResults: { symbolicResults: [...BLOCKING_CLEAN, sym('FF-P06', 'pattern', [p06Row(0, 'FLOWS_TO'), p06Row(1, 'FLOWS_TO')])], neuronalResults: [] },
      fitnessFunctions: FUNCTIONS, scoringWeights: WEIGHTS, v12eVerdict: 'warning', apg,
    });
    expect(tiers.verdict).toBe('pass');
    expect(tiers.blocking.rules.find((r) => String(r.functionId) === 'FF-P06')).toMatchObject({ tier: 'blocking', violationCount: 0, violated: false });
    expect(tiers.notApplicable).toEqual([{
      functionId: 'FF-P06', part: 'FLOWS_TO field rows', reason: tiers.notApplicable[0]?.reason,
      naRows: 2, totalRows: 2, flowsToEdges: 1,
    }]);
    expect(tiers.notApplicable[0]?.reason).toContain('FLOWS_TO');
    expect(tiers.blockingAhs).toBe(1);
  });

  it('one CONSTRUCTOR_INJECTS row: FAIL, counted alone; the FLOWS_TO row stays N/A', () => {
    const tiers = computeTieredScoring({
      evaluationResults: { symbolicResults: [...BLOCKING_CLEAN, sym('FF-P06', 'pattern', [p06Row(0, 'FLOWS_TO'), p06Row(1, 'CONSTRUCTOR_INJECTS')])], neuronalResults: [] },
      fitnessFunctions: FUNCTIONS, scoringWeights: WEIGHTS, v12eVerdict: 'warning',
    });
    expect(tiers.verdict).toBe('fail');
    expect(tiers.blocking.rules.find((r) => String(r.functionId) === 'FF-P06')).toMatchObject({ violationCount: 1, violated: true });
    expect(tiers.notApplicable[0]).toMatchObject({ naRows: 1, totalRows: 2, flowsToEdges: null });
  });

  it('FF-P06 with no rows still reports its N/A part (0 of 0) and the graph denominator', () => {
    const tiers = computeTieredScoring({
      evaluationResults: { symbolicResults: [sym('FF-P06', 'pattern')], neuronalResults: [] },
      fitnessFunctions: FUNCTIONS, scoringWeights: WEIGHTS, v12eVerdict: 'pass', apg,
    });
    expect(tiers.notApplicable[0]).toMatchObject({ naRows: 0, totalRows: 0, flowsToEdges: 1 });
  });
});

describe('v1.3 FF-S03 tier depends on the style', () => {
  const results: EvaluationResults = { symbolicResults: [...BLOCKING_CLEAN, sym('FF-S03', 'structural', 2)], neuronalResults: [] };
  const tiersFor = (style?: string) => computeTieredScoring({
    evaluationResults: results, fitnessFunctions: FUNCTIONS, scoringWeights: WEIGHTS, v12eVerdict: 'pass', ...(style !== undefined && { style }),
  });

  it('layered: a layer skip is blocking and fails the verdict', () => {
    const t = tiersFor('layered');
    expect(t.verdict).toBe('fail');
    expect(t.blocking.rules.map((r) => String(r.functionId))).toContain('FF-S03');
  });

  it.each(['clean-architecture', 'nestjs', 'hexagonal', undefined])('%s: a layer skip is advisory', (style) => {
    const t = tiersFor(style);
    expect(t.verdict).toBe('pass');
    expect(t.advisory.rules.find((r) => String(r.functionId) === 'FF-S03')).toMatchObject({ violationCount: 2, violated: true });
    expect(t.style).toBe(style ?? null);
  });
});

describe('v1.2E mode is unchanged', () => {
  const results: EvaluationResults = { symbolicResults: [sym('FF-S01', 'structural', 1), sym('FF-C02', 'coupling', 2)], neuronalResults: [] };

  it('no scoringMode and scoringMode v1.2e give the same report, without tiers', async () => {
    const a = await scored(results);
    const b = await scored(results, { scoringMode: 'v1.2e', style: 'layered' });
    expect(stable(b)).toEqual(stable(a));
    expect('tiers' in a).toBe(false);
    expect(JSON.stringify(stable(b))).toBe(JSON.stringify(stable(a)));
  });
});

describe('v1.3 report schema', () => {
  it('an assembled v1.3 report validates against the report schema; so does the v1.2E one', async () => {
    const results: EvaluationResults = {
      symbolicResults: [sym('FF-S01', 'structural', 1), sym('FF-P06', 'pattern', [p06Row(0, 'FLOWS_TO')]), sym('FF-C02', 'coupling', 2)],
      neuronalResults: [],
    };
    for (const scoringMode of ['v1.3', 'v1.2e'] as const) {
      const report = await scoreAndAssemble(input(results, { scoringMode, style: 'clean-architecture' }));
      expect(report.success).toBe(true);
      if (!report.success) return;
      const checked = validateReport(report.data);
      expect(checked.success ? [] : checked.errors).toEqual([]);
      expect(report.data.tiers !== undefined).toBe(scoringMode === 'v1.3');
    }
  });
});

describe('scoring mode values', () => {
  it('parses v1.3 and v1.2e only', () => {
    expect(parseScoringMode('v1.3')).toBe('v1.3');
    expect(parseScoringMode('V1.2E')).toBe('v1.2e');
    expect(parseScoringMode('v1.2')).toBeUndefined();
  });

  it('maps the tiered verdict onto the existing verdict structure', () => {
    const base = computeTieredScoring({ evaluationResults: { symbolicResults: [], neuronalResults: [] }, fitnessFunctions: [], scoringWeights: WEIGHTS, v12eVerdict: 'pass' });
    expect(overallVerdictOf(base)).toBe('pass');
    expect(base.blockingAhs).toBeNull();
    expect(overallVerdictOf({ ...base, verdict: 'fail' })).toBe('hard-block');
  });
});
