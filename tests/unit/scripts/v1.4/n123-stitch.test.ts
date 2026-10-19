import { findingFromKey, kmGreenwood365, stitch, type MapTransition } from '../../../../scripts/v1.4/tier-a/lib/n123-stitch';
import type { Lineage } from '../../../../scripts/lib/drift/types';

const f = (key: string, born: number, ended: number | null, extra: Partial<Lineage> = {}): Lineage => ({
  key, ruleIds: ['FF-S01'], edgeShaped: true, tier: 'blocking', born, ended, kind: 'finding', functionId: 'FF-S01', ...extra,
});
const t = (from: number, to: number, rename: [string, string][]): MapTransition => ({ from, to, rename, skipped: false });

describe('findingFromKey', () => {
  it('round-trips an edge key, a discriminator and a cycle key', () => {
    expect(findingFromKey('FF-S01#src/a.ts#src/b.ts#')).toEqual({ functionId: 'FF-S01', filePath: 'src/a.ts', target: 'src/b.ts' });
    expect(findingFromKey('FF-D03#src/a.ts##Order')?.discriminator).toEqual(['Order']);
    expect(findingFromKey('FF-S02#cycle#a.ts>b.ts>c.ts')?.filePath).toBe('a.ts,b.ts,c.ts');
  });
  it('rejects a key whose path holds a #', () => {
    expect(findingFromKey('FF-S01#src/a#b.ts#src/b.ts#')).toBeUndefined();
  });
});

describe('stitch', () => {
  it('continues a renamed finding and drops the successor as a birth', () => {
    const ls = [f('FF-S01#src/a.ts#src/b.ts#', 1, 3), f('FF-S01#src/a.ts#src/b2.ts#', 3, 6, { filesStay: true })];
    const r = stitch(ls, [t(1, 2, []), t(2, 3, [['src/b.ts', 'src/b2.ts']])]);
    expect(r.lineages).toHaveLength(1);
    expect(r.lineages[0]).toMatchObject({ born: 1, ended: 6, finalKey: 'FF-S01#src/a.ts#src/b2.ts#', renamedAt: [3], filesStay: true });
    expect(r.stats).toMatchObject({ stitched: 1, blockingStitched: 1 });
  });
  it('re-canonicalises a renamed cycle', () => {
    const c = (key: string, born: number, ended: number | null): Lineage => f(key, born, ended, { functionId: 'FF-S02', ruleIds: ['FF-S02'] });
    const r = stitch([c('FF-S02#cycle#b.ts>c.ts>d.ts', 1, 2), c('FF-S02#cycle#a.ts>b.ts>c.ts', 2, null)], [t(1, 2, [['d.ts', 'a.ts']])]);
    expect(r.lineages).toHaveLength(1);
    expect(r.lineages[0]?.ended).toBeNull();
  });
  it('stitches an unflagged edge, and leaves a non-rename ending alone', () => {
    const e = (key: string, born: number, ended: number | null): Lineage => ({ key, ruleIds: [], edgeShaped: true, born, ended, kind: 'edge', edgeKind: 'crossLayer' });
    const r = stitch([e('x.ts|y.ts', 1, 2), e('x.ts|z.ts', 1, 2), e('x2.ts|y.ts', 2, null)], [t(1, 2, [['x.ts', 'x2.ts']])]);
    expect(r.lineages.map((l) => [l.key, l.ended])).toEqual([['x.ts|y.ts', null], ['x.ts|z.ts', 2]]);
  });
  it('gives a merge successor to the earliest-born predecessor only', () => {
    const ls = [f('FF-S01#b.ts#t.ts#', 2, 4), f('FF-S01#a.ts#t.ts#', 1, 4), f('FF-S01#a2.ts#t.ts#', 4, null)];
    const r = stitch(ls, [t(3, 4, [['a.ts', 'a2.ts'], ['b.ts', 'a2.ts']])]);
    const byKey = new Map(r.lineages.map((l) => [l.key, l.ended]));
    expect(byKey.get('FF-S01#a.ts#t.ts#')).toBeNull();
    expect(byKey.get('FF-S01#b.ts#t.ts#')).toBe(4);
    expect(r.lineages).toHaveLength(2);
  });
  it('does not stitch to a lineage born at another grid point', () => {
    const r = stitch([f('FF-S01#a.ts#t.ts#', 1, 3), f('FF-S01#a2.ts#t.ts#', 5, null)], [t(1, 3, [['a.ts', 'a2.ts']])]);
    expect(r.lineages).toHaveLength(2);
  });
});

describe('kmGreenwood365', () => {
  it('matches a hand computation', () => {
    // 4 at risk; an event at 100 (S = 0.75), a censoring at 200, an event at 300 (S = 0.375), one censored at 400.
    const r = kmGreenwood365([{ t: 100, event: true }, { t: 200, event: false }, { t: 300, event: true }, { t: 400, event: false }]);
    expect(r.s365).toBeCloseTo(0.375, 10);
    expect(r.lo).toBeLessThan(0.375);
    expect(r.hi).toBeGreaterThan(0.375);
  });
});
