/**
 * U3-R7: seven dimensions, counting by dimension, renormalised AHS variants and verdict source
 * (FR-15, FR-32; U3 BR-U3-30..39, 85; TF-12, TF-13).
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeScoredReport } from '../../../src/scoring-engine/scoring-engine.js';
import { scoreDimensions, tallyDimensions } from '../../../src/scoring-engine/score-computer.js';
import type { DimensionScoringInput } from '../../../src/scoring-engine/score-computer.js';
import { renormaliseWeights } from '../../../src/scoring-engine/renormaliser.js';
import { determineVerdict } from '../../../src/scoring-engine/verdict.js';
import { noJudgeUnitIds } from '../../../src/pipeline/commands/score-command.js';
import { DIMENSIONS, SYMBOLIC_DIMENSIONS } from '../../../src/shared/types/enums.js';
import { BUILT_IN_VIOLATION_TYPES } from '../../../src/shared/taxonomy/violation-types.js';
import type { Dimension, EvaluationMode } from '../../../src/shared/types/enums.js';
import type {
  EvaluationResults, FunctionFailure, NeuronalFunctionResult, SymbolicFunctionResult,
} from '../../../src/shared/types/evaluation.js';
import type { FitnessFunction, ScoringWeights, VerdictThresholds } from '../../../src/shared/types/spec.js';
import { ahsScore, confidence, functionId } from '../../../src/shared/types/value-objects.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { GraphRepository, QueryResult } from '../../../src/shared/interfaces/graph-repository.js';

const ROOT = join(__dirname, '..', '..', '..');
const WEIGHTS: ScoringWeights = { structural: 0.35, coupling: 0.2, pattern: 0.3, solid: 0.1, convention: 0.05, semantic: 0, integrity: 0 };
const FULL: ScoringWeights = { structural: 0.32, coupling: 0.18, pattern: 0.27, solid: 0.1, convention: 0.05, semantic: 0.04, integrity: 0.04 };
const THRESHOLDS: VerdictThresholds = { pass: 0.8, warning: 0.65, softBlock: 0.5 };
const CONF = { high: 0.85, medium: 0.6, iccMinimum: 0.7 };

const sym = (id: string, dimension: Dimension, passed: boolean, extra: Partial<SymbolicFunctionResult> = {}): SymbolicFunctionResult => ({
  functionId: functionId(id),
  dimension,
  passed,
  violations: passed ? [] : [{
    id: `v-${id}`, type: 'LAYER_VIOLATION', dimension, severity: 'critical', functionId: functionId(id),
    route: 'symbolic', filePath: 'src/a.ts', message: 'violation', deterministic: true,
  }],
  executionTimeMs: 1,
  deterministic: true,
  ...extra,
});

const neur = (id: string, dimension: Dimension, verdict: 'pass' | 'fail' | 'warning', conf = 0.9): NeuronalFunctionResult => ({
  functionId: functionId(id),
  dimension,
  verdict,
  confidence: confidence(conf),
  confidenceStdDev: 0,
  icc: 1,
  reasoning: 'r',
  evidence: [],
  violations: verdict === 'fail' ? [{
    id: `n-${id}`, type: 'SEMANTIC_RULE_VIOLATION', dimension, severity: 'major', functionId: functionId(id),
    route: 'neuronal', filePath: 'src/a.ts', message: 'semantic', deterministic: false,
  }] : [],
  runs: [],
  deterministic: false,
  flaggedUnstable: false,
  unitResults: [],
  unitsSelected: 1,
  unitsCapped: 0,
});

const ff = (id: string, dimension: Dimension): FitnessFunction => ({
  id: functionId(id), name: id.toLowerCase(), dimension, severity: 'major', route: 'symbolic',
  isBuiltIn: true, validated: true, enabled: true, excludePaths: [],
});

const failure = (id: string): FunctionFailure => ({ functionId: functionId(id), name: id, code: 'EVAL_001', message: 'failed' });

function input(results: EvaluationResults, mode: EvaluationMode, extra: Partial<DimensionScoringInput> = {}): DimensionScoringInput {
  return {
    evaluationResults: results,
    scoringWeights: WEIGHTS,
    ...(mode !== 'symbolic-only' ? { fullModeWeights: FULL } : {}),
    confidenceThresholds: CONF,
    mode,
    fitnessFunctions: [],
    disabledFunctions: [],
    noJudgeUnits: [],
    ...extra,
  };
}

function scored(i: DimensionScoringInput) {
  const r = scoreDimensions(i);
  if (!r.ok) throw new Error(`${r.code}: ${r.message}`);
  return r.value;
}

const repo: GraphRepository = {
  executeQuery(): Promise<DomainResult<QueryResult>> {
    return Promise.resolve(DomainResult.ok({ records: [{ cnt: 0, val: 0 }], summary: { counters: {} } }));
  },
  clearGraph: () => Promise.resolve(DomainResult.ok(undefined)),
  healthCheck: () => Promise.resolve(true),
  close: () => Promise.resolve(),
};

const COMPILED = { symbolicQueries: [], neuronalInstructions: [], hybridPairs: [], totalCompiled: 0, disabledFunctions: [], warnings: [] };

/** One symbolic result per dimension, all passing, plus the given extra results. */
const fiveSymbolic = (failing: readonly Dimension[] = []): SymbolicFunctionResult[] =>
  SYMBOLIC_DIMENSIONS.map((d) => sym(`FF-${d}`, d, !failing.includes(d)));

describe('BR-U3-30 seven dimensions', () => {
  it('DIMENSIONS has seven members without intent; INTENT_VIOLATION stays', () => {
    expect([...DIMENSIONS]).toEqual(['structural', 'coupling', 'pattern', 'solid', 'convention', 'semantic', 'integrity']);
    expect(BUILT_IN_VIOLATION_TYPES).toContain('INTENT_VIOLATION');
  });

  it("static: no 'intent' literal in src/scoring-engine or enums.ts", () => {
    const out = execSync("grep -rn \"'intent'\" src/scoring-engine src/shared/types/enums.ts || true", { cwd: ROOT, encoding: 'utf8' });
    expect(out.trim()).toBe('');
  });

  it('static: no intent: key in the U1 weight literals (layer-parsers.ts, template-registry.ts)', () => {
    const out = execSync('grep -rnE "^\\s*intent:" src/spec-parser/layer-parsers.ts src/spec-parser/template-registry.ts || true', { cwd: ROOT, encoding: 'utf8' });
    expect(out.trim()).toBe('');
  });

  it('BR-U3-85 static: ScoringStage is not constructed in src/pipeline (unwired residual)', () => {
    const out = execSync('grep -rn "new ScoringStage(" src/pipeline || true', { cwd: ROOT, encoding: 'utf8' });
    expect(out.trim()).toBe('');
  });
});

describe('BR-U3-31/32 counting by dimension and AVR', () => {
  it('each function counts only in its own dimension, passing or failing (BR-U3-31)', () => {
    const t = tallyDimensions({ symbolicResults: [sym('A', 'structural', false), sym('B', 'structural', true), sym('C', 'coupling', true)], neuronalResults: [] });
    expect(t.get('structural')).toEqual({ functionCount: 2, violatedWeight: 1, violationCount: 1 });
    expect(t.get('coupling')).toEqual({ functionCount: 1, violatedWeight: 0, violationCount: 0 });
    expect(t.has('pattern')).toBe(false);
  });

  it('TF-13 FR-32: a passing integrity neural result keeps an integrity row (functionCount 1, avr 0, effectiveWeight > 0), not dropped', () => {
    const v = scored(input({ symbolicResults: fiveSymbolic(), neuronalResults: [neur('FF-N01', 'integrity', 'pass')] }, 'full'));
    const row = v.perDimensionScores.find((r) => r.dimension === 'integrity');
    expect(row).toMatchObject({ functionCount: 1, avr: 0, violationCount: 0 });
    expect(row?.effectiveWeight).toBeGreaterThan(0);
    expect(v.droppedDimensions.map((d) => d.dimension)).not.toContain('integrity');
  });

  it('a neural warning contributes 0 and is counted in functionCount (BR-U3-32)', () => {
    const t = tallyDimensions({ symbolicResults: [], neuronalResults: [neur('N1', 'semantic', 'warning'), neur('N2', 'semantic', 'fail', 0.7)] }, CONF);
    expect(t.get('semantic')).toEqual({ functionCount: 2, violatedWeight: 0.7, violationCount: 1 });
  });

  it('a hybrid pair in full mode with both halves run counts once in semantic (BR-U3-31)', () => {
    const t = tallyDimensions({ symbolicResults: [sym('FF-H1', 'semantic', true)], neuronalResults: [neur('FF-H1', 'semantic', 'fail')] });
    expect(t.get('semantic')).toEqual({ functionCount: 1, violatedWeight: 1, violationCount: 1 });
  });

  it('a hybrid symbolic half with neuralSkipped counts no neural result (BR-U3-53)', () => {
    const t = tallyDimensions({
      symbolicResults: [sym('FF-H1', 'semantic', false, { neuralSkipped: 'symbolic-fail' })],
      neuronalResults: [neur('FF-H1', 'semantic', 'pass')],
    });
    expect(t.get('semantic')).toEqual({ functionCount: 1, violatedWeight: 1, violationCount: 1 });
  });

  it('BR-U3-53: a failure plus a neural result for the same id scores as the failure alone', () => {
    const base = { symbolicResults: fiveSymbolic(), failures: [failure('FF-N09')] };
    const withNeural = scored(input({ ...base, neuronalResults: [neur('FF-N09', 'semantic', 'fail')] }, 'full'));
    const alone = scored(input({ ...base, neuronalResults: [] }, 'full'));
    expect(withNeural).toEqual(alone);
    expect(withNeural.perDimensionScores.map((r) => r.dimension)).not.toContain('semantic');
  });

  describe('BR-U3-32/35 baseline reproduction (GOLDEN_BASE_U3 53c8f7e, post-U1 snapshots)', () => {
    interface BaseCase {
      functionResults: { functionId: string; dimension: Dimension; passed: boolean }[];
      perDimensionScores: { dimension: Dimension; avr: number; weight: number }[];
      ahsDeterministic: number;
      verdict: string;
    }
    const fixture = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'golden-base-u3-scores.json'), 'utf8')) as { cases: Record<string, BaseCase> };
    it.each(Object.keys(fixture.cases))('%s: AVR per dimension, AHS and verdict recomputed exactly from the function results', (caseId) => {
      const c = fixture.cases[caseId];
      if (c === undefined) throw new Error(`no fixture case ${caseId}`);
      const v = scored(input({ symbolicResults: c.functionResults.map((r) => sym(r.functionId, r.dimension, r.passed)), neuronalResults: [] }, 'symbolic-only'));
      expect(v.perDimensionScores.map((r) => [r.dimension, Number(r.avr), r.weight])).toEqual(c.perDimensionScores.map((r) => [r.dimension, r.avr, r.weight]));
      expect(Number(v.ahsDeterministic)).toBe(c.ahsDeterministic);
      expect(determineVerdict(v.ahsDeterministic ?? ahsScore(Number.NaN), THRESHOLDS)).toBe(c.verdict);
    });

    it.each(['correct-reference', 'variant-a-structural', 'variant-b-pattern', 'variant-c-everything', 'variant-d-subtle'])(
      '%s: the current snapshot rows (functionCount per dimension, sum = executed) and AHS are reproduced', (caseId) => {
        const snap = JSON.parse(readFileSync(join(ROOT, 'tests', 'golden', '__snapshots__', `${caseId}.json`), 'utf8')) as BaseCase & {
          perDimensionScores: { dimension: Dimension; avr: number; functionCount: number; violationCount: number; weight: number }[];
        };
        const v = scored(input({ symbolicResults: snap.functionResults.map((r) => sym(r.functionId, r.dimension, r.passed)), neuronalResults: [] }, 'symbolic-only'));
        expect(v.perDimensionScores.map((r) => ({ dimension: r.dimension, avr: Number(r.avr), functionCount: r.functionCount, violationCount: r.violationCount, weight: r.weight })))
          .toEqual(snap.perDimensionScores);
        expect(v.perDimensionScores.reduce((s, r) => s + r.functionCount, 0)).toBe(snap.functionResults.length);
        expect(Number(v.ahsDeterministic)).toBe(snap.ahsDeterministic);
        expect(v.droppedDimensions).toEqual([]);
      },
    );
  });
});

describe('BR-U3-33/35 renormalised AHS variants', () => {
  it('TF-12 FR-15 (solid not executed): rows over four dimensions with effective .389/.222/.333/.056 and the AHS over four dimensions', () => {
    const results = { symbolicResults: fiveSymbolic(['structural']).filter((r) => r.dimension !== 'solid'), neuronalResults: [] };
    const v = scored(input(results, 'symbolic-only', { fitnessFunctions: [ff('FF-SO01', 'solid')], disabledFunctions: [] }));
    expect(v.perDimensionScores.map((r) => r.dimension)).toEqual(['structural', 'coupling', 'pattern', 'convention']);
    expect(v.perDimensionScores.map((r) => r.effectiveWeight.toFixed(3))).toEqual(['0.389', '0.222', '0.333', '0.056']);
    expect(v.perDimensionScores[0]?.effectiveWeight).toBeCloseTo(0.35 / 0.9, 15);
    expect(Number(v.ahsDeterministic)).toBe(Math.round((1 - 0.35 / 0.9) * 1000) / 1000); // .611
    expect(v.droppedDimensions).toEqual([{ dimension: 'solid', reason: 'execution_failure', declared: 1, executed: 0 }]);
  });

  it('neuronal-only: semantic avr .5 and integrity avr 0 with weights .04/.04 give ahsNeuronal .75 and no ahsDeterministic', () => {
    const v = scored(input({ symbolicResults: [], neuronalResults: [neur('N1', 'semantic', 'fail', 0.9), neur('N2', 'semantic', 'pass'), neur('N3', 'integrity', 'pass')] }, 'neuronal-only'));
    expect(Number(v.ahsNeuronal)).toBe(0.75);
    expect(v.ahsDeterministic).toBeUndefined();
    expect(v.ahsCombined).toBeUndefined();
    expect(v.verdictSource).toBe('ahsNeuronal');
    expect(v.perDimensionScores.map((r) => [r.dimension, Number(r.avr), r.weight, r.effectiveWeight])).toEqual([['semantic', 0.5, 0.04, 0.5], ['integrity', 0, 0.04, 0.5]]);
  });

  it('full mode gives all three variants', () => {
    const v = scored(input({ symbolicResults: fiveSymbolic(['coupling']), neuronalResults: [neur('N1', 'semantic', 'fail'), neur('N2', 'integrity', 'pass')] }, 'full'));
    expect(v.ahsDeterministic).toBeDefined();
    expect(v.ahsCombined).toBeDefined();
    expect(v.ahsNeuronal).toBeDefined();
    expect(Number(v.ahsNeuronal)).toBe(0.5);
  });

  it('BR-U3-38: ahsDeterministic is equal in symbolic-only and full modes for an ADR hybrid (semantic), symbolic half passing and violating', () => {
    const symOnly = scored(input({ symbolicResults: fiveSymbolic(['pattern']), neuronalResults: [] }, 'symbolic-only'));
    const passing = scored(input({ symbolicResults: [...fiveSymbolic(['pattern']), sym('ADR-001', 'semantic', true)], neuronalResults: [neur('ADR-001', 'semantic', 'fail')] }, 'full'));
    const violating = scored(input({
      symbolicResults: [...fiveSymbolic(['pattern']), sym('ADR-001', 'semantic', false, { neuralSkipped: 'symbolic-fail' })],
      neuronalResults: [],
    }, 'full'));
    expect(passing.ahsDeterministic).toEqual(symOnly.ahsDeterministic);
    expect(violating.ahsDeterministic).toEqual(symOnly.ahsDeterministic);
  });

  it('BR-U3-39 (row weight source = verdict source): full-mode rows carry the full-mode weights; Σ effectiveWeight × avr = 1 − ahsCombined and renormaliseWeights(scoring.weights) reproduces ahsDeterministic', () => {
    const results = { symbolicResults: fiveSymbolic(['structural', 'convention']), neuronalResults: [neur('N1', 'semantic', 'fail', 0.7), neur('N2', 'integrity', 'pass')] };
    const v = scored(input(results, 'full'));
    expect(v.verdictSource).toBe('ahsCombined');
    expect(v.perDimensionScores.map((r) => r.weight)).toEqual(DIMENSIONS.map((d) => FULL[d]));
    const violated = v.perDimensionScores.reduce((s, r) => s + r.effectiveWeight * Number(r.avr), 0);
    expect(Math.abs((1 - violated) - Number(v.ahsCombined))).toBeLessThanOrEqual(0.0005);
    const symbolicRows = v.perDimensionScores.filter((r) => (SYMBOLIC_DIMENSIONS as readonly string[]).includes(r.dimension));
    const executed = Object.fromEntries(symbolicRows.map((r) => [r.dimension, r.functionCount]));
    const det = renormaliseWeights(WEIGHTS, executed, {}, {}, SYMBOLIC_DIMENSIONS);
    const ahsDet = Math.round((1 - symbolicRows.reduce((s, r) => s + (det.effectiveWeights[r.dimension] ?? 0) * Number(r.avr), 0)) * 1000) / 1000;
    expect(ahsDet).toBe(Number(v.ahsDeterministic));
    expect(symbolicRows.map((r) => r.effectiveWeight)).not.toEqual(symbolicRows.map((r) => det.effectiveWeights[r.dimension]));
  });
});

describe('BR-U3-34 dropped dimensions', () => {
  it('symbolic-only never lists semantic or integrity, even when declared', () => {
    const v = scored(input({ symbolicResults: fiveSymbolic(), neuronalResults: [] }, 'symbolic-only', { fitnessFunctions: [ff('FF-N01', 'integrity'), ff('FF-N02', 'semantic')] }));
    expect(v.droppedDimensions).toEqual([]);
  });

  it('full mode: none_declared, disabled_by_spec, no-judge-units, execution_failure', () => {
    const v = scored(input({ symbolicResults: fiveSymbolic().filter((r) => r.dimension !== 'solid'), neuronalResults: [neur('N1', 'semantic', 'pass')] }, 'full', {
      fitnessFunctions: [ff('FF-SO01', 'solid'), ff('FF-N01', 'integrity'), ff('FF-N02', 'semantic'), ff('FF-S01', 'structural')],
      disabledFunctions: [],
      noJudgeUnits: [functionId('FF-N01')],
    }));
    expect(v.droppedDimensions).toEqual([
      { dimension: 'solid', reason: 'execution_failure', declared: 1, executed: 0 },
      { dimension: 'integrity', reason: 'no-judge-units', declared: 1, executed: 0 },
    ]);
    const disabled = scored(input({ symbolicResults: fiveSymbolic().filter((r) => r.dimension !== 'solid'), neuronalResults: [] }, 'symbolic-only', {
      fitnessFunctions: [ff('FF-SO01', 'solid')],
      disabledFunctions: [{ id: functionId('FF-SO01'), name: 'so01' }],
    }));
    expect(disabled.droppedDimensions).toEqual([{ dimension: 'solid', reason: 'disabled_by_spec', declared: 1, executed: 0 }]);
    const none = scored(input({ symbolicResults: fiveSymbolic().filter((r) => r.dimension !== 'solid'), neuronalResults: [] }, 'symbolic-only'));
    expect(none.droppedDimensions).toEqual([{ dimension: 'solid', reason: 'none_declared', declared: 0, executed: 0 }]);
  });

  it('neuronal-only: integrity with JUDGE_NO_UNITS is dropped no-judge-units and ahsNeuronal is over semantic alone', () => {
    const v = scored(input({ symbolicResults: [], neuronalResults: [neur('FF-N03', 'semantic', 'fail', 0.9), neur('FF-N04', 'semantic', 'pass')] }, 'neuronal-only', {
      fitnessFunctions: [ff('FF-N02', 'integrity'), ff('FF-N03', 'semantic'), ff('FF-N04', 'semantic')],
      noJudgeUnits: [functionId('FF-N02')],
    }));
    expect(v.droppedDimensions).toEqual([{ dimension: 'integrity', reason: 'no-judge-units', declared: 1, executed: 0 }]);
    expect(Number(v.ahsNeuronal)).toBe(0.5);
  });

  it('noJudgeUnitIds reads JUDGE_NO_UNITS context.functionId, ascending', () => {
    expect(noJudgeUnitIds([
      { code: 'JUDGE_NO_UNITS', message: 'm', stage: 'llm-critic', context: { functionId: 'FF-N02' } },
      { code: 'SPEC_002', message: 'm', stage: 'spec-parser', context: { functionId: 'FF-X' } },
      { code: 'JUDGE_NO_UNITS', message: 'm', stage: 'llm-critic', context: { functionId: 'FF-N01' } },
    ])).toEqual(['FF-N01', 'FF-N02']);
  });
});

describe('BR-U3-36/37 verdict source and scoring errors', () => {
  const base = {
    scoringWeights: WEIGHTS, confidenceThresholds: CONF, verdictThresholds: THRESHOLDS, projectPath: '/p', specVersion: '1',
    graphRepository: repo, fitnessFunctions: [], compiled: COMPILED, noJudgeUnits: [],
  };
  const results: EvaluationResults = { symbolicResults: fiveSymbolic(['structural']), neuronalResults: [neur('N1', 'semantic', 'fail'), neur('N2', 'integrity', 'pass')] };

  it.each<[EvaluationMode, 'ahsDeterministic' | 'ahsCombined' | 'ahsNeuronal']>([
    ['symbolic-only', 'ahsDeterministic'], ['full', 'ahsCombined'], ['neuronal-only', 'ahsNeuronal'],
  ])('%s: verdict === determineVerdict(%s) and scoring.verdictSource names it', async (mode, source) => {
    const r = await computeScoredReport({ ...base, evaluationResults: results, mode, ...(mode !== 'symbolic-only' ? { fullModeWeights: FULL } : {}) });
    if (!r.success) throw new Error(JSON.stringify(r.errors));
    expect(r.data.scoring.verdictSource).toBe(source);
    expect(r.data.verdict).toBe(determineVerdict(r.data[source] ?? ahsScore(Number.NaN), THRESHOLDS));
    expect(r.data.scoring.thresholds).toEqual(THRESHOLDS);
  });

  it('shipped thresholds stay .80 / .65 / .50 in every preset and spec (D-9; never tuned by U3)', () => {
    for (const f of ['presets/clean-architecture.yaml', 'presets/nestjs.yaml', 'presets/layered.yaml', 'specs/clean-arch.yaml', 'specs/daedalus-arch.yaml']) {
      const text = readFileSync(join(ROOT, f), 'utf8');
      expect(text).toMatch(/thresholds:\n\s+pass: 0\.80\n\s+warning: 0\.65\n\s+soft_block: 0\.50/);
    }
  });

  it('every function failed → SCORING_NO_EXECUTED_WEIGHT, no score or verdict', async () => {
    const r = await computeScoredReport({
      ...base, mode: 'symbolic-only',
      evaluationResults: { symbolicResults: [sym('FF-S01', 'structural', true)], neuronalResults: [], failures: [failure('FF-S01')] },
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors.map((e) => e.code)).toEqual(['SCORING_NO_EXECUTED_WEIGHT']);
  });

  it('executed dimensions with zero configured weight → SCORING_NO_EXECUTED_WEIGHT', () => {
    const r = scoreDimensions(input({ symbolicResults: [sym('FF-S01', 'structural', true)], neuronalResults: [] }, 'symbolic-only', {
      scoringWeights: { ...WEIGHTS, structural: 0 },
    }));
    expect(r.ok ? 'ok' : r.code).toBe('SCORING_NO_EXECUTED_WEIGHT');
  });

  it('neuronal-only without full_mode_weights → CONFIG_MISSING_FULL_MODE_WEIGHTS, no score or verdict', async () => {
    const r = await computeScoredReport({ ...base, mode: 'neuronal-only', evaluationResults: { symbolicResults: [], neuronalResults: [neur('N1', 'semantic', 'pass')] } });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors.map((e) => e.code)).toEqual(['CONFIG_MISSING_FULL_MODE_WEIGHTS']);
  });

  it('a symbolic-only report carries ahsDeterministic only and the configured weights in scoring', async () => {
    const r = await computeScoredReport({ ...base, mode: 'symbolic-only', evaluationResults: { symbolicResults: fiveSymbolic(), neuronalResults: [] } });
    if (!r.success) throw new Error(JSON.stringify(r.errors));
    expect(r.data.ahsDeterministic).toEqual(ahsScore(1));
    expect(r.data.ahsCombined).toBeUndefined();
    expect(r.data.ahsNeuronal).toBeUndefined();
    expect(r.data.scoring.weights).toEqual(WEIGHTS);
    expect(r.data.droppedDimensions).toEqual([]);
  });
});
