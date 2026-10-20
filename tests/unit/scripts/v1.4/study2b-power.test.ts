/**
 * Study 2b sample-size helpers (scripts/v1.4/lib/study2b-power.ts): the exactness floor, the exact sign-flip p, the
 * half-size rounding, the 2a summaries and the resampling power.
 */
import {
  STUDY2B_ALPHA, cellStats, diffStats, exactSignFlipP, halfSize, minNonZeroPairs, pairedDiffs, resamplePower, smallestN,
} from '../../../../scripts/v1.4/lib/study2b-power';
import { mulberry32 } from '../../../../scripts/lib/mutation/rng';

/** Brute force over every sign pattern, for checking the convolution. */
function bruteP(d: readonly number[]): number {
  const t = Math.abs(d.reduce((a, b) => a + b, 0));
  let hit = 0;
  for (let mask = 0; mask < 2 ** d.length; mask++) {
    const s = d.reduce((acc, x, i) => acc + ((mask >> i) & 1 ? -x : x), 0);
    if (Math.abs(s) >= t) hit += 1;
  }
  return hit / 2 ** d.length;
}

describe('the exactness floor (§3 step 1)', () => {
  it('needs 7 non-zero pairs at Holm steps 1 and 2 and 6 at step 3', () => {
    expect(minNonZeroPairs(STUDY2B_ALPHA)).toBe(7);
    expect(minNonZeroPairs(0.05 / 2)).toBe(7);
    expect(minNonZeroPairs(0.05)).toBe(6);
  });
});

describe('exactSignFlipP', () => {
  it('gives 2 × 2⁻ⁿ when every non-zero difference has the same sign', () => {
    expect(exactSignFlipP([1, 1, 1, 1, 1, 1, 1])).toBeCloseTo(2 / 128, 12);
    expect(exactSignFlipP([0, 0, 3, 1, 2, 1, 1, 1, 1])).toBeCloseTo(2 / 128, 12);
  });
  it('gives 1 with no non-zero difference or a zero sum', () => {
    expect(exactSignFlipP([])).toBe(1);
    expect(exactSignFlipP([0, 0])).toBe(1);
    expect(exactSignFlipP([1, -1])).toBe(1);
  });
  it('equals brute force on mixed-sign integer differences', () => {
    const rng = mulberry32(7);
    for (let k = 0; k < 40; k++) {
      const d = Array.from({ length: 1 + Math.floor(rng.next() * 10) }, () => Math.floor(rng.next() * 7) - 3);
      expect(exactSignFlipP(d)).toBeCloseTo(bruteP(d), 12);
    }
  });
  it('rejects non-integer differences', () => {
    expect(() => exactSignFlipP([0.5])).toThrow(RangeError);
  });
});

describe('halfSize', () => {
  it('halves even differences exactly and sends odd ones to either neighbour', () => {
    expect(halfSize(2, () => 0)).toBe(1);
    expect(halfSize(-2, () => 0.9)).toBe(-1);
    expect(halfSize(1, () => 0.1)).toBe(0);
    expect(halfSize(1, () => 0.9)).toBe(1);
    expect(halfSize(3, () => 0.1)).toBe(1);
    expect(halfSize(-1, () => 0.1)).toBe(-1);
    expect(halfSize(-1, () => 0.9)).toBe(0);
  });
});

describe('2a summaries (P1, P2)', () => {
  const l2 = [1, 0, 1, 3, 2, 2];
  const mcp = [1, 0, 0, 0, 0, 2];
  it('cell statistics, with θ undefined when variance ≤ mean', () => {
    const s = cellStats(l2);
    expect(s.mean).toBeCloseTo(1.5, 12);
    expect(s.sd).toBeCloseTo(Math.sqrt(1.1), 12);
    expect(s.theta).toBeNull();
    expect(s.pZero).toBeCloseTo(1 / 6, 12);
    expect(cellStats(mcp).theta).toBeCloseTo(0.25 / (0.7 - 0.5), 10);
  });
  it('paired-difference statistics', () => {
    const s = diffStats(pairedDiffs(l2, mcp));
    expect(s.diffs).toEqual([0, 0, 1, 3, 2, 0]);
    expect(s.p0).toBeCloseTo(0.5, 12);
    expect(s.q).toBe(1);
    expect(s.mean).toBeCloseTo(1, 12);
    expect(diffStats([0, 0]).q).toBeNull();
    expect(() => pairedDiffs([1], [1, 2])).toThrow(RangeError);
  });
});

describe('resamplePower (§3 step 3)', () => {
  it('is deterministic for a seed', () => {
    const a = resamplePower([0, 0, 1, 3, 2, 0], { n: 16, half: true, directional: true, sims: 300 });
    const b = resamplePower([0, 0, 1, 3, 2, 0], { n: 16, half: true, directional: true, sims: 300 });
    expect(a).toEqual(b);
  });
  it('has power 1 when every draw is positive and n reaches the floor, and 0 below it', () => {
    expect(resamplePower([1, 2], { n: 8, half: false, directional: true, sims: 50 }).power).toBe(1);
    expect(resamplePower([1, 2], { n: 6, half: false, directional: true, sims: 50 }).power).toBe(0);
  });
  it('counts only the predicted sign when directional', () => {
    const r = resamplePower([-1, -2], { n: 8, half: false, directional: true, sims: 50 });
    expect(r.power).toBe(0);
    expect(r.rejectNegative).toBe(1);
    expect(resamplePower([-1, -2], { n: 8, half: false, directional: false, sims: 50 }).power).toBe(1);
  });
  it('has no power with all-zero differences', () => {
    expect(resamplePower([0, 0, 0], { n: 24, half: false, directional: false, sims: 50 }).power).toBe(0);
  });
});

describe('smallestN', () => {
  const row = (n: number, power: number) => ({ n, half: true, sims: 1, power, rejectPositive: power, rejectNegative: 0 });
  it('takes the smallest grid value at or above the bar, or null', () => {
    expect(smallestN([row(8, 0.1), row(12, 0.8), row(16, 0.9)])).toBe(12);
    expect(smallestN([row(8, 0.1), row(24, 0.79)])).toBeNull();
  });
});
