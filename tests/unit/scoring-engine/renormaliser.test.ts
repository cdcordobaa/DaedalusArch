/**
 * Weight renormaliser and drop-reason rule (FR-15, FR-26; U3 BR-U3-33, 34, 35; TF-12, TF-13, TF-21).
 */
import {
  ahsFromEffectiveWeights, dropReasonFor, renormaliseWeights,
} from '../../../src/scoring-engine/renormaliser.js';
import type { DimensionDeclaration } from '../../../src/scoring-engine/renormaliser.js';
import * as scoringEngine from '../../../src/scoring-engine/index.js';
import { MODEL_JUDGED_DIMENSIONS, SYMBOLIC_DIMENSIONS } from '../../../src/shared/types/enums.js';
import type { Dimension } from '../../../src/shared/types/enums.js';

const SHIPPED = { structural: 0.35, coupling: 0.2, pattern: 0.3, solid: 0.1, convention: 0.05 };

describe('renormaliseWeights (BR-U3-33)', () => {
  it('is exported from the scoring-engine index (FR-26)', () => {
    expect(scoringEngine.renormaliseWeights).toBe(renormaliseWeights);
    expect(scoringEngine.dropReasonFor).toBe(dropReasonFor);
  });

  it('TF-12 FR-15: solid not executed renormalises over four dimensions (.389/.222/.333/.056), unrounded', () => {
    const executed = { structural: 3, coupling: 6, pattern: 5, solid: 0, convention: 6 };
    const declared = { structural: 3, coupling: 6, pattern: 5, solid: 3, convention: 6 };
    const r = renormaliseWeights(SHIPPED, executed, declared, {}, SYMBOLIC_DIMENSIONS);
    expect(r.executedDimensions).toEqual(['structural', 'coupling', 'pattern', 'convention']);
    expect(r.effectiveWeights.structural).toBeCloseTo(0.3888888888888889, 15);
    expect(r.effectiveWeights.coupling).toBeCloseTo(0.2222222222222222, 15);
    expect(r.effectiveWeights.pattern).toBeCloseTo(0.3333333333333333, 15);
    expect(r.effectiveWeights.convention).toBeCloseTo(0.05555555555555556, 15);
    expect(r.effectiveWeights.solid).toBeUndefined();
    expect(['structural', 'coupling', 'pattern', 'convention'].map((d) => (r.effectiveWeights[d as Dimension] ?? 0).toFixed(3)))
      .toEqual(['0.389', '0.222', '0.333', '0.056']);
    expect(r.dropped).toEqual([{ dimension: 'solid', declared: 3, disabled: 0 }]);
    expect(r.executedWeight).toBeCloseTo(0.9, 15);
    // AHS over four dimensions: structural avr .25, coupling .167, pattern 0, convention .5.
    const ahs = ahsFromEffectiveWeights(r.effectiveWeights, { structural: 0.25, coupling: 0.167, pattern: 0, convention: 0.5 });
    expect(ahs).toBe(Math.round((1 - (0.35 * 0.25 + 0.2 * 0.167 + 0.05 * 0.5) / 0.9) * 1000) / 1000);
    expect(ahs).toBe(0.838);
  });

  it('every dimension executed reproduces the configured weights (post-U1 correct-reference AHS .958)', () => {
    const all = { structural: 3, coupling: 6, pattern: 5, solid: 3, convention: 6 };
    const r = renormaliseWeights(SHIPPED, all, all, {}, SYMBOLIC_DIMENSIONS);
    expect(r.dropped).toEqual([]);
    expect(ahsFromEffectiveWeights(r.effectiveWeights, { coupling: 0.167, convention: 0.167 })).toBe(0.958);
  });

  it('out-of-mode dimensions are never candidates (symbolic-only never lists semantic/integrity)', () => {
    const r = renormaliseWeights({ ...SHIPPED, semantic: 0.04, integrity: 0.04 }, { structural: 1 }, {}, {}, SYMBOLIC_DIMENSIONS);
    expect(r.dropped.map((d) => d.dimension)).toEqual(['coupling', 'pattern', 'solid', 'convention']);
    expect(r.effectiveWeights).toEqual({ structural: 1 });
  });

  it('TF-13 FR-32: an executed integrity dimension with avr 0 keeps a positive effective weight', () => {
    const r = renormaliseWeights({ semantic: 0.04, integrity: 0.04 }, { semantic: 1, integrity: 1 }, { semantic: 1, integrity: 1 }, {}, MODEL_JUDGED_DIMENSIONS);
    expect(r.effectiveWeights.integrity).toBe(0.5);
    expect(r.dropped).toEqual([]);
    // BR-U3-35: semantic avr .5, integrity avr 0 → ahsNeuronal .75.
    expect(ahsFromEffectiveWeights(r.effectiveWeights, { semantic: 0.5, integrity: 0 })).toBe(0.75);
  });

  it('zero executed weight produces no effective weights (caller raises SCORING_NO_EXECUTED_WEIGHT)', () => {
    const none = renormaliseWeights(SHIPPED, {}, {}, {}, SYMBOLIC_DIMENSIONS);
    expect(none.executedWeight).toBe(0);
    expect(none.effectiveWeights).toEqual({});
    const zeroWeight = renormaliseWeights({ structural: 0 }, { structural: 2 }, {}, {}, ['structural']);
    expect(zeroWeight.executedWeight).toBe(0);
    expect(zeroWeight.effectiveWeights).toEqual({});
  });
});

describe('dropReasonFor (BR-U3-34, BR-U3-70 item 11)', () => {
  const decl = (declared: number, disabled: number, activeFunctionIds: readonly string[]): DimensionDeclaration =>
    ({ declared, disabled, activeFunctionIds });

  it('none_declared when nothing is declared (or the dimension is absent)', () => {
    expect(dropReasonFor('solid', { solid: decl(0, 0, []) }, [])).toBe('none_declared');
    expect(dropReasonFor('solid', {}, [])).toBe('none_declared');
  });

  it('disabled_by_spec when every declared function is disabled', () => {
    expect(dropReasonFor('structural', { structural: decl(2, 2, []) }, [])).toBe('disabled_by_spec');
  });

  it('TF-21: no-judge-units when every declared, non-disabled function has no judge units', () => {
    expect(dropReasonFor('integrity', { integrity: decl(1, 0, ['FF-N02']) }, ['FF-N02'])).toBe('no-judge-units');
    expect(dropReasonFor('integrity', { integrity: decl(2, 1, ['FF-N02']) }, ['FF-N02'])).toBe('no-judge-units');
  });

  it('execution_failure otherwise', () => {
    expect(dropReasonFor('coupling', { coupling: decl(2, 0, ['FF-C01', 'FF-C02']) }, [])).toBe('execution_failure');
  });

  it('one disabled and one failed function gives execution_failure', () => {
    expect(dropReasonFor('solid', { solid: decl(2, 1, ['FF-SO01']) }, [])).toBe('execution_failure');
  });

  it('mixed: one no-units function and one failed function gives execution_failure', () => {
    expect(dropReasonFor('semantic', { semantic: decl(2, 0, ['FF-N01', 'FF-N03']) }, ['FF-N01'])).toBe('execution_failure');
  });

  it('the precedence is fixed: disabled_by_spec wins over no-judge-units', () => {
    expect(dropReasonFor('integrity', { integrity: decl(1, 1, []) }, ['FF-N02'])).toBe('disabled_by_spec');
  });
});
