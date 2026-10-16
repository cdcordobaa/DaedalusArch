import {
  blockingFindingsOf, identitiesOf, intervalChanges, repoSlope, sampleIndices, signTest, smallMultiplesSvg,
} from '../../../../scripts/v1.3/lib/human-erosion.js';
import type { EvalReport } from '../../../../scripts/v1.3/lib/human-erosion.js';

describe('human erosion: sampling rule', () => {
  it('spaces 8 samples evenly and keeps the first and the pin', () => {
    expect(sampleIndices(211)).toEqual([0, 30, 60, 90, 120, 150, 180, 210]);
    expect(sampleIndices(73)).toEqual([0, 10, 21, 31, 41, 51, 62, 72]);
    expect(sampleIndices(8)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
  it('drops duplicates on short chains and rejects bad lengths', () => {
    expect(sampleIndices(3)).toEqual([0, 1, 2]);
    expect(sampleIndices(1)).toEqual([0]);
    expect(() => sampleIndices(0)).toThrow();
  });
});

const report = (violations: EvalReport['violations']): EvalReport => ({
  violations,
  tiers: {
    verdict: 'fail',
    blocking: { rules: [{ functionId: 'FF-S01', name: 'dependency-direction', tier: 'blocking', violationCount: 0 }] },
    advisory: { rules: [{ functionId: 'FF-C03', name: 'component-instability', tier: 'advisory', violationCount: 0 }] },
  },
});

describe('human erosion: blocking findings and identities', () => {
  it('keeps only the report own blocking rules and ignores lines in the identity', () => {
    const r = report([
      { id: 'v1', functionId: 'FF-S01', type: 'LAYER_VIOLATION', filePath: 'src/a.ts', target: 'src/b.ts', line: 3, message: 'm' },
      { id: 'v2', functionId: 'FF-S01', type: 'LAYER_VIOLATION', filePath: 'src/a.ts', target: 'src/b.ts', line: 9, message: 'm' },
      { id: 'v3', functionId: 'FF-C03', type: 'INSTABILITY_VIOLATION', filePath: 'src/a.ts', message: 'm' },
    ]);
    const bf = blockingFindingsOf(r);
    expect(bf).toHaveLength(2);
    expect(identitiesOf(bf)).toHaveLength(1);
  });
  it('counts new identities against every earlier evaluated sample, skipping unevaluated ones', () => {
    expect(intervalChanges([['a'], null, ['a', 'b'], ['b'], ['a', 'b', 'c']])).toEqual([
      { new: null, gone: null }, { new: null, gone: null }, { new: 1, gone: 0 }, { new: 0, gone: 1 }, { new: 1, gone: 0 },
    ]);
    expect(intervalChanges([null, ['x']])).toEqual([{ new: null, gone: null }, { new: null, gone: null }]);
  });
});

describe('human erosion: slope and sign test', () => {
  it('needs four evaluated points', () => {
    expect(repoSlope([{ x: 0, y: 1 }, { x: 1, y: 2 }, { x: 2, y: null }, { x: 3, y: null }])).toBeNull();
    expect(repoSlope([{ x: 0, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 3 }, { x: 3, y: null }, { x: 4, y: 5 }])).toBe(1);
  });
  it('is exact and two-sided', () => {
    expect(signTest([1, 2, 3, 4, 5, 6]).p).toBe(0.03125);
    expect(signTest([1, 2, 3, 4, 5, -1]).p).toBe(0.21875);
    expect(signTest([1, -1, 0, null])).toEqual({ positive: 1, negative: 1, zero: 1, missing: 1, n: 2, p: 1 });
    expect(signTest([null, 0]).p).toBeNull();
  });
});

describe('human erosion: figure', () => {
  it('is deterministic', () => {
    const panels = [{ id: 'r', style: 'ddd', points: [{ x: 0, y: 1 }, { x: 5, y: null }, { x: 10, y: 2.5 }], slope: 0.15 }];
    const a = smallMultiplesSvg(panels);
    expect(a).toBe(smallMultiplesSvg(panels));
    expect(a.startsWith('<svg')).toBe(true);
    expect(a).toContain('r (ddd)');
  });
});
