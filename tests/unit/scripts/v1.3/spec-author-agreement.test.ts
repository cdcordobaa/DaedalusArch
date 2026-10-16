/**
 * v1.3 K2 statistics (scripts/v1.3/lib/spec-author-agreement.ts): Cohen's kappa, Spearman's rho with ties, and the
 * blocking summary read from a v1.3 evaluation report.
 */
import { cohenKappa, spearman, summariseEvaluation } from '../../../../scripts/v1.3/lib/spec-author-agreement.js';

describe('cohenKappa', () => {
  it('is 1 for identical labels and undefined for a single label', () => {
    expect(cohenKappa(['a', 'b', 'a'], ['a', 'b', 'a']).kappa).toBeCloseTo(1);
    expect(cohenKappa(['a', 'a'], ['a', 'a']).kappa).toBeNull();
  });

  it('matches a hand-computed value', () => {
    // po = 0.7; pe = 0.5*0.6 + 0.5*0.4 = 0.5; kappa = 0.4
    const a = ['x', 'x', 'x', 'x', 'x', 'y', 'y', 'y', 'y', 'y'];
    const b = ['x', 'x', 'x', 'x', 'y', 'x', 'x', 'y', 'y', 'y'];
    const r = cohenKappa(a, b);
    expect(r.po).toBeCloseTo(0.7);
    expect(r.pe).toBeCloseTo(0.5);
    expect(r.kappa).toBeCloseTo(0.4);
  });
});

describe('spearman', () => {
  it('is 1 for monotone data and handles ties with mid-ranks', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1);
    expect(spearman([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1);
    expect(spearman([0, 0, 1, 2], [0, 0, 5, 9])).toBeCloseTo(1);
    expect(spearman([1, 1], [2, 3])).toBeNull();
  });
});

describe('summariseEvaluation', () => {
  it('sums blocking-rule violation counts and reads the v1.3 verdict', () => {
    const report = { tiers: { verdict: 'fail', blocking: { rules: [
      { functionId: 'FF-S01', violationCount: 3 }, { functionId: 'FF-P01', violationCount: 0 },
    ] } } };
    expect(summariseEvaluation(report)).toEqual({ blocking: 3, perRule: { 'FF-S01': 3 }, verdict: 'fail' });
  });

  it('refuses a report without the tiers block', () => {
    expect(() => summariseEvaluation({ verdict: 'pass' })).toThrow(/tiers/);
  });
});
