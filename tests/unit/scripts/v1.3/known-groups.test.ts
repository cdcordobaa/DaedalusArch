/**
 * Known-groups and discriminant helpers (`scripts/v1.3/lib/known-groups.ts`, Docs/DiagnosticRuns/v1.3-known-groups-plan.md).
 */
import {
  averageRanks, combinations, countsAsSource, exactPermutation, exactStratifiedPermutation, groupOf, nonBlankLines,
  readKnownGroups, spearman, spearmanBootstrap,
} from '../../../../scripts/v1.3/lib/known-groups.js';

describe('groupOf', () => {
  it('flags showcase terms case-insensitively in any field', () => {
    expect(groupOf(['luizomf/clean-architecture-api-BOILERPLATE'])).toBe('showcase');
    expect(groupOf(['x', undefined, 'mikro-orm/nestjs-realworld-example-app'])).toBe('showcase');
    expect(groupOf(['santiq/bulletproof-nodejs', 'https://github.com/santiq/bulletproof-nodejs.git'])).toBe('application');
  });
});

describe('countsAsSource', () => {
  it('keeps plain .ts and drops declarations, tests and test folders', () => {
    expect(countsAsSource('core/user.ts')).toBe(true);
    expect(countsAsSource('core/user.d.ts')).toBe(false);
    expect(countsAsSource('core/user.spec.ts')).toBe(false);
    expect(countsAsSource('core/user.test.ts')).toBe(false);
    expect(countsAsSource('core/__tests__/user.ts')).toBe(false);
    expect(countsAsSource('test/util.ts')).toBe(false);
    expect(countsAsSource('core/testing/util.ts')).toBe(true);
    expect(countsAsSource('core/user.tsx')).toBe(false);
  });
  it('counts non-blank lines', () => {
    expect(nonBlankLines('a\n\n  \nb\r\nc\n')).toBe(3);
  });
});

describe('exact permutation', () => {
  it('enumerates C(n,k) labelings', () => {
    expect(combinations(5, 2)).toHaveLength(10);
    expect(combinations(15, 5)).toHaveLength(3003);
  });
  it('gives the minimum p when the showcase group holds the k smallest values', () => {
    const r = exactPermutation([1, 2, 10, 11, 12], ['showcase', 'showcase', 'application', 'application', 'application']);
    expect(r.labelings).toBe(10);
    expect(r.atLeastAsExtreme).toBe(1);
    expect(r.p).toBeCloseTo(0.1);
    expect(r.observed).toBeCloseTo(11 - 1.5);
  });
  it('gives p = 1 when the showcase group holds the largest values', () => {
    const r = exactPermutation([1, 2, 3, 10], ['application', 'application', 'application', 'showcase']);
    expect(r.p).toBe(1);
  });
  it('stratified version permutes only within strata', () => {
    const v = [1, 5, 6, 2, 7, 8];
    const g = ['showcase', 'application', 'application', 'showcase', 'application', 'application'] as const;
    const r = exactStratifiedPermutation(v, g, ['a', 'a', 'a', 'b', 'b', 'b']);
    expect(r.labelings).toBe(9);
    expect(r.atLeastAsExtreme).toBe(1);
  });
});

describe('spearman', () => {
  it('uses average ranks for ties', () => {
    expect(averageRanks([10, 20, 20, 30])).toEqual([1, 2.5, 2.5, 4]);
  });
  it('is 1 for monotone, -1 for reversed, NaN for constant', () => {
    expect(spearman([1, 2, 3, 4], [10, 100, 1000, 10000])).toBeCloseTo(1);
    expect(spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1);
    expect(spearman([1, 2, 3], [5, 5, 5])).toBeNaN();
  });
  it('bootstrap is deterministic under a seed and brackets the estimate', () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const y = [2, 1, 4, 3, 6, 5, 8, 7, 10, 9];
    const a = spearmanBootstrap(x, y, { seed: 20261016, resamples: 500 });
    const b = spearmanBootstrap(x, y, { seed: 20261016, resamples: 500 });
    expect(a).toEqual(b);
    expect(a.lo).toBeLessThanOrEqual(a.rho);
    expect(a.hi).toBeGreaterThanOrEqual(a.rho - 1e-9);
  });
});

describe('readKnownGroups', () => {
  it('applies the plan §6 reading', () => {
    expect(readKnownGroups(0.01, 0.5)).toBe('supported');
    expect(readKnownGroups(0.2, 0.5)).toBe('direction only');
    expect(readKnownGroups(0.01, 0.2)).toBe('direction only');
    expect(readKnownGroups(0.01, 0)).toBe('not supported');
  });
});
