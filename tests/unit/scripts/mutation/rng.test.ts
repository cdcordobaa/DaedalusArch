/**
 * Seeded RNG and seed derivation (U5a plan Step 6; BR-U5a-15, 16; D-U5a-12).
 * Pinned vectors were computed once by `rng.ts` and cross-checked with an independent `node -e`
 * one-liner (`crypto.createHash('sha256')` and the reference mulberry32), see the Step 6 Done note.
 */
import { deriveSeed, mulberry32 } from '../../../../scripts/lib/mutation/rng.js';

describe('mulberry32 (BR-U5a-16)', () => {
  it('pins the first three outputs of mulberry32(1)', () => {
    const rng = mulberry32(1);
    expect([rng.next(), rng.next(), rng.next()]).toEqual([0.6270739405881613, 0.002735721180215478, 0.5274470399599522]);
  });

  it('gives the same sequence and the same sample for the same seed', () => {
    const a = mulberry32(2184350454);
    const b = mulberry32(2184350454);
    expect(Array.from({ length: 20 }, () => a.next())).toEqual(Array.from({ length: 20 }, () => b.next()));
    const items = Array.from({ length: 50 }, (_, i) => i);
    expect(mulberry32(757368179).pickDistinct(items, 10)).toEqual(mulberry32(757368179).pickDistinct(items, 10));
  });

  it('stays in [0, 1)', () => {
    const rng = mulberry32(0);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('never repeats an index in pickDistinct and does not mutate the input', () => {
    const items = Object.freeze(Array.from({ length: 30 }, (_, i) => `site-${String(i)}`));
    for (let seed = 0; seed < 25; seed++) {
      const sample = mulberry32(seed).pickDistinct(items, 12);
      expect(sample).toHaveLength(12);
      expect(new Set(sample).size).toBe(12);
      for (const s of sample) expect(items).toContain(s);
    }
    expect(items[0]).toBe('site-0');
  });

  it('returns every item when n exceeds the list, and none for n = 0', () => {
    const items = ['a', 'b', 'c'];
    const all = mulberry32(5).pickDistinct(items, 10);
    expect([...all].sort()).toEqual(['a', 'b', 'c']);
    expect(mulberry32(5).pickDistinct(items, 0)).toEqual([]);
    expect(mulberry32(5).pickDistinct([], 3)).toEqual([]);
  });

  it('pick is pickDistinct(items, 1)[0] and refuses an empty list', () => {
    const items = ['x', 'y', 'z', 'w'];
    expect(mulberry32(9).pick(items)).toBe(mulberry32(9).pickDistinct(items, 1)[0]);
    expect(() => mulberry32(9).pick([])).toThrow(RangeError);
  });

  it('refuses a seed that is not a uint32 and a bad n', () => {
    expect(() => mulberry32(-1)).toThrow(RangeError);
    expect(() => mulberry32(2 ** 32)).toThrow(RangeError);
    expect(() => mulberry32(1.5)).toThrow(RangeError);
    expect(() => mulberry32(1).pickDistinct([1], -1)).toThrow(RangeError);
  });
});

describe('deriveSeed (BR-U5a-15)', () => {
  const ids = { projectId: 'correct-reference', operatorId: 'MO-S01' } as const;

  it('pins the vector masterSeed 20261008 / correct-reference / MO-S01 / k = 0', () => {
    expect(deriveSeed(20261008, { ...ids, k: 0 })).toBe(2184350454);
  });

  it("pins the site-selection vector k = 'select'", () => {
    expect(deriveSeed(20261008, { ...ids, k: 'select' })).toBe(757368179);
  });

  it('differs by k, project, operator and master seed', () => {
    const base = deriveSeed(20261008, { ...ids, k: 0 });
    expect(deriveSeed(20261008, { ...ids, k: 1 })).not.toBe(base);
    expect(deriveSeed(20261008, { ...ids, projectId: 'variant-a-structural', k: 0 })).not.toBe(base);
    expect(deriveSeed(20261008, { ...ids, operatorId: 'MO-S01n', k: 0 })).not.toBe(base);
    expect(deriveSeed(20261009, { ...ids, k: 0 })).not.toBe(base);
    expect(deriveSeed(20261008, { ...ids, k: 'subsample' })).not.toBe(base);
  });

  it("refuses an id containing '|' or empty, a negative or fractional k, an unknown label and a bad master seed", () => {
    expect(() => deriveSeed(20261008, { ...ids, projectId: 'a|b', k: 0 })).toThrow(RangeError);
    expect(() => deriveSeed(20261008, { ...ids, operatorId: 'MO|S01', k: 0 })).toThrow(RangeError);
    expect(() => deriveSeed(20261008, { ...ids, projectId: '', k: 0 })).toThrow(RangeError);
    expect(() => deriveSeed(20261008, { ...ids, k: -1 })).toThrow(RangeError);
    expect(() => deriveSeed(20261008, { ...ids, k: 0.5 })).toThrow(RangeError);
    expect(() => deriveSeed(20261008, { ...ids, k: 'pick' as 'select' })).toThrow(RangeError);
    expect(() => deriveSeed(-1, { ...ids, k: 0 })).toThrow(RangeError);
  });
});
