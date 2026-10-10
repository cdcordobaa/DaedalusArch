/**
 * ADR-028: the proportional neural aggregation variant (`proportional-inclusion-weighted-v1`,
 * `Docs/analysis-plan.md` §12.2) and its wiring into the scorer. Every expected value below is computed by hand in
 * the comment above it.
 */
import {
  confidenceWeight, parseNeuralAggregation, proportionalShare, PROPORTIONAL_RULE_ID,
} from '../../../src/scoring-engine/neural-aggregation.js';
import type { ProportionalUnit } from '../../../src/scoring-engine/neural-aggregation.js';
import { scoreDimensions } from '../../../src/scoring-engine/score-computer.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { JudgeUnitResult, NeuronalFunctionResult, SymbolicFunctionResult } from '../../../src/shared/types/evaluation.js';
import type { Dimension } from '../../../src/shared/types/enums.js';
import { confidence, functionId } from '../../../src/shared/types/value-objects.js';
import { scoreAndAssemble } from './assembled-report-fixture.js';

const T = { high: 0.85, medium: 0.6, iccMinimum: 0.7 };

function u(layer: string, verdict: ProportionalUnit['verdict'], conf: number, status: 'valid' | 'invalid' = 'valid', flaggedUnstable = false): ProportionalUnit {
  return { layer, verdict, confidence: conf, status, flaggedUnstable };
}

describe('proportionalShare (ADR-028 §12.2)', () => {
  it('uncapped, all valid: the plain mean of the unit scores', () => {
    // 4 units of one layer, all candidates judged; one fail at 0.9 (weight 1.0): share = 1 / 4 = 0.25.
    const p = proportionalShare([u('domain', 'fail', 0.9), u('domain', 'pass', 0.9), u('domain', 'pass', 0.8), u('domain', 'pass', 0.7)], { domain: 4 }, T);
    expect(p?.share).toBeCloseTo(0.25, 12);
    expect(p).toMatchObject({ validUnits: 4, failedUnits: 1, warningUnits: 0 });
  });

  it('capped selection: each valid unit of layer h weighs N_h / V_h', () => {
    // Layer a: N = 10, judged 2 (fail 0.9 → 1.0, pass): ȳ_a = 0.5. Layer b: N = 2, judged 2 (fail 0.7 → 0.7 twice): ȳ_b = 0.7.
    // share = (10·0.5 + 2·0.7) / (10 + 2) = 6.4 / 12 = 0.533333…; the unweighted mean would be (1 + 0 + 0.7 + 0.7) / 4 = 0.6.
    const units = [u('a', 'fail', 0.9), u('a', 'pass', 0.9), u('b', 'fail', 0.7), u('b', 'fail', 0.7)];
    const p = proportionalShare(units, { a: 10, b: 2 }, T);
    expect(p?.share).toBeCloseTo(6.4 / 12, 12);
    expect(p?.strata).toEqual([
      { layer: 'a', candidates: 10, validUnits: 2, failedUnits: 1, meanScore: 0.5 },
      { layer: 'b', candidates: 2, validUnits: 2, failedUnits: 2, meanScore: 0.7 },
    ]);
  });

  it('a split-vote unit scores 0 and stays in the denominator; an invalid unit is left out', () => {
    // Layer a, N = 4: fail 0.9 (1.0), warning, invalid, pass → V = 3, ȳ = 1 / 3; share = 1 / 3.
    const p = proportionalShare([u('a', 'fail', 0.9), u('a', 'warning', 0.5), u('a', 'warning', 0, 'invalid'), u('a', 'pass', 0.9)], { a: 4 }, T);
    expect(p?.share).toBeCloseTo(1 / 3, 12);
    expect(p).toMatchObject({ validUnits: 3, failedUnits: 1, warningUnits: 1 });
  });

  it('a failed unit scores its own U3 confidence weight; unstable 0.2; the spec thresholds apply', () => {
    // 0.95 unstable → 0.2; 0.62 → 0.7; 0.4 → 0.3; mean over 3 = 1.2 / 3 = 0.4.
    expect(proportionalShare([u('a', 'fail', 0.95, 'valid', true), u('a', 'fail', 0.62), u('a', 'fail', 0.4)], { a: 3 }, T)?.share).toBeCloseTo(0.4, 12);
    // With high = 0.9 a 0.88 fail weighs 0.7 (default thresholds: 1.0).
    expect(proportionalShare([u('a', 'fail', 0.88)], { a: 1 }, { high: 0.9, medium: 0.6, iccMinimum: 0.7 })?.share).toBeCloseTo(0.7, 12);
    expect(proportionalShare([u('a', 'fail', 0.88)], { a: 1 })?.share).toBeCloseTo(1, 12);
    expect(confidenceWeight(0.85, false, T)).toBe(1);
    expect(confidenceWeight(0.6, false, T)).toBe(0.7);
    expect(confidenceWeight(0.59, false, T)).toBe(0.3);
    expect(confidenceWeight(1, true, T)).toBe(0.2);
  });

  it('a layer without a valid unit drops out of both sums', () => {
    // Layer a (N = 5): its one judged unit is invalid. Layer b (N = 5): two fails at 0.5 (0.3 each): share = 5·0.3 / 5 = 0.3.
    const p = proportionalShare([u('a', 'warning', 0, 'invalid'), u('b', 'fail', 0.5), u('b', 'fail', 0.5)], { a: 5, b: 5 }, T);
    expect(p?.share).toBeCloseTo(0.3, 12);
    expect(p?.strata.find((s) => s.layer === 'a')).toEqual({ layer: 'a', candidates: 5, validUnits: 0, failedUnits: 0, meanScore: 0 });
  });

  it('without candidatesByLayer (reports before ADR-028) the judged units are the strata sizes', () => {
    // a: 1 judged (fail 0.9 → 1.0), b: 3 judged (all pass): share = (1·1 + 3·0) / 4 = 0.25 (weights 1).
    expect(proportionalShare([u('a', 'fail', 0.9), u('b', 'pass', 0.9), u('b', 'pass', 0.9), u('b', 'pass', 0.9)], undefined, T)?.share).toBeCloseTo(0.25, 12);
  });

  it('no valid unit → undefined (U4 emits no result); all fail at high confidence → 1, none → 0', () => {
    expect(proportionalShare([u('a', 'fail', 0.9, 'invalid')], { a: 3 }, T)).toBeUndefined();
    expect(proportionalShare([], { a: 3 }, T)).toBeUndefined();
    expect(proportionalShare([u('a', 'fail', 0.9), u('b', 'fail', 0.99)], { a: 20, b: 3 }, T)?.share).toBeCloseTo(1, 12);
    expect(proportionalShare([u('a', 'pass', 0.9), u('b', 'warning', 0.5)], { a: 20, b: 3 }, T)?.share).toBe(0);
  });

  it('parses the option values; the rule id is registered', () => {
    expect(parseNeuralAggregation(undefined)).toBe('registered');
    expect(parseNeuralAggregation('registered')).toBe('registered');
    expect(parseNeuralAggregation('proportional')).toBe('proportional');
    expect(parseNeuralAggregation('share')).toBeUndefined();
    expect(PROPORTIONAL_RULE_ID).toBe('proportional-inclusion-weighted-v1');
  });
});

// ---------------------------------------------------------------------------------------------
// Scorer wiring

function unit(id: string, layer: string, verdict: 'pass' | 'fail' | 'warning', conf: number): JudgeUnitResult {
  return {
    unitId: id, unitKind: 'file', layer, filePaths: [id], status: 'valid', verdict, confidence: confidence(conf),
    confidenceStdDev: 0, flaggedUnstable: false, validRunCount: 3, runs: [], violations: [],
  };
}

function neural(id: string, dimension: Dimension, verdict: 'pass' | 'fail' | 'warning', conf: number, units: JudgeUnitResult[], byLayer: Record<string, number>): NeuronalFunctionResult {
  return {
    functionId: functionId(id), dimension, verdict, confidence: confidence(conf), confidenceStdDev: 0, icc: 1, reasoning: '', evidence: [],
    violations: [], runs: [], deterministic: false, flaggedUnstable: false, unitResults: units, unitsSelected: units.length, unitsCapped: 0,
    candidatesByLayer: byLayer,
  };
}

const sym = (id: string, dimension: Dimension, passed: boolean): SymbolicFunctionResult => ({
  functionId: functionId(id), dimension, passed, executionTimeMs: 1, deterministic: true, tag: 'structural', violations: [],
});

// FF-S01 structural fails (AVR 1). FF-N02 semantic: 5 units, 2 fail at 0.9 → registered warning (0); proportional 2/5 = 0.4.
// FF-N01 integrity: 4 units, 3 fail at 0.9 → registered fail at 0.9 (1.0); proportional 3/4 = 0.75.
const results = {
  symbolicResults: [sym('FF-S01', 'structural', false)],
  neuronalResults: [
    neural('FF-N02', 'semantic', 'warning', 0.9, ['a', 'b', 'c', 'd', 'e'].map((x, i) => unit(`src/${x}.ts`, 'domain', i < 2 ? 'fail' : 'pass', 0.9)), { domain: 5 }),
    neural('FF-N01', 'integrity', 'fail', 0.9, ['a', 'b', 'c', 'd'].map((x, i) => unit(`src/${x}`, 'domain', i < 3 ? 'fail' : 'pass', 0.9)), { domain: 4 }),
  ],
  failures: [],
};
// Weights over the executed dimensions: structural 0.4, semantic 0.3, integrity 0.3 (sum 1, no renormalisation).
const fullModeWeights = { structural: 0.4, coupling: 0, pattern: 0, solid: 0, convention: 0, semantic: 0.3, integrity: 0.3 };
const scoringWeights = { structural: 1, coupling: 0, pattern: 0, solid: 0, convention: 0, semantic: 0, integrity: 0 };

describe('scoreDimensions under each neural aggregation (ADR-028)', () => {
  const run = (neuralAggregation?: 'registered' | 'proportional') => {
    const r = scoreDimensions({
      evaluationResults: results, scoringWeights, fullModeWeights, confidenceThresholds: T, mode: 'full',
      fitnessFunctions: [], disabledFunctions: [], noJudgeUnits: [], ...(neuralAggregation !== undefined && { neuralAggregation }),
    });
    if (!r.ok) throw new Error(r.code);
    return r.value;
  };

  it('registered (the default): AVR semantic 0, integrity 1; ahsCombined = 1 − (0.4 + 0 + 0.3) = 0.3; ahsNeuronal = 1 − 0.5·1 = 0.5', () => {
    for (const v of [run(), run('registered')]) {
      expect(v.perDimensionScores.map((p) => [p.dimension, Number(p.avr)])).toEqual([['structural', 1], ['semantic', 0], ['integrity', 1]]);
      expect(Number(v.ahsCombined)).toBeCloseTo(0.3, 3);
      expect(Number(v.ahsNeuronal)).toBeCloseTo(0.5, 3);
      expect(Number(v.ahsDeterministic)).toBe(0);
    }
  });

  it('proportional: AVR semantic 0.4, integrity 0.75; ahsCombined = 1 − (0.4 + 0.12 + 0.225) = 0.255; ahsNeuronal = 1 − (0.2 + 0.375) = 0.425', () => {
    const v = run('proportional');
    expect(v.perDimensionScores.map((p) => [p.dimension, Number(p.avr), p.functionCount])).toEqual([
      ['structural', 1, 1], ['semantic', 0.4, 1], ['integrity', 0.75, 1],
    ]);
    expect(Number(v.ahsCombined)).toBeCloseTo(0.255, 3);
    expect(Number(v.ahsNeuronal)).toBeCloseTo(0.425, 3);
    // The rules-only field is the same under both rules.
    expect(Number(v.ahsDeterministic)).toBe(0);
  });
});

describe('the report names its neural aggregation (ADR-028)', () => {
  const graphRepository = {
    executeQuery: () => Promise.resolve(DomainResult.ok({ records: [{ cnt: 0, val: 0 }], summary: { counters: {} } })),
    clearGraph: () => Promise.resolve(DomainResult.ok(undefined)),
    healthCheck: () => Promise.resolve(true),
    close: () => Promise.resolve(),
  };
  const input = (mode: 'full' | 'symbolic-only', neuralAggregation?: 'registered' | 'proportional') => ({
    evaluationResults: mode === 'full' ? results : { ...results, neuronalResults: [] },
    scoringWeights, fullModeWeights, confidenceThresholds: T, verdictThresholds: { pass: 0.8, warning: 0.65, softBlock: 0.5 },
    mode, projectPath: 'fixtures/p', specVersion: '1', fitnessFunctions: [], noJudgeUnits: [], graphRepository,
    compiled: { symbolicQueries: [], neuronalInstructions: [], hybridPairs: [], totalCompiled: 0, disabledFunctions: [], warnings: [] },
    ...(neuralAggregation !== undefined && { neuralAggregation }),
  });

  it('full mode stamps scoring.neuralAggregation (default registered) and the report validates', async () => {
    const reg = await scoreAndAssemble(input('full'));
    const prop = await scoreAndAssemble(input('full', 'proportional'));
    if (!reg.success || !prop.success) throw new Error('scoring failed');
    expect(reg.data.scoring.neuralAggregation).toBe('registered');
    expect(prop.data.scoring.neuralAggregation).toBe('proportional');
    expect(Number(reg.data.ahsCombined)).toBeCloseTo(0.3, 3);
    expect(Number(prop.data.ahsCombined)).toBeCloseTo(0.255, 3);
  });

  it('symbolic-only reports carry no neural aggregation', async () => {
    const r = await scoreAndAssemble(input('symbolic-only'));
    if (!r.success) throw new Error('scoring failed');
    expect(r.data.scoring.neuralAggregation).toBeUndefined();
  });
});
