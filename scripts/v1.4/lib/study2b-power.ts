/**
 * Study 2b sample size (pre-registration draft `Docs/v1.4/study2b-preregistration.md` §3, steps 1 and 3): the 2a Stage C
 * summaries (P1, P2), the exactness floor of the two-sided sign-flip test, and power at the actual grid by resampling 2a's
 * paired block differences, at the 2a effect size and at half of it.
 *
 * - The test is the registered paired two-sided sign-flip test on T = Σ d_b (§4). Its p is computed EXACTLY over all 2ⁿ
 *   sign patterns, by convolution over the integer differences (zeros flip to themselves). The registered decision p is
 *   the 99,999-draw Monte Carlo estimate of this same quantity; the exact value is its limit.
 * - Half size: each drawn d_b becomes round(d_b / 2); an odd d_b sits on a tie and goes to either neighbour with
 *   probability 1/2, drawn from the same seeded stream.
 * - Each (contrast, size, N) configuration has its own mulberry32 stream seeded with the registered seed, so a
 *   configuration's figure does not depend on which others ran.
 */
import { mulberry32 } from '../../lib/mutation/rng';
import { momentTheta, sampleVariance } from './stage-c';

/** Registered in §3 step 3 and §4. */
export const STUDY2B_SEED = 20261021;
export const STUDY2B_SIMS = 2000;
export const STUDY2B_GRID = [8, 12, 16, 20, 24, 32, 40] as const;
/** The strictest Holm step over 3 tests. */
export const STUDY2B_ALPHA = 0.05 / 3;
export const STUDY2B_POWER_BAR = 0.8;

/** The 2a block order the report and the pre-registration use. */
export const BLOCK_ORDER = ['hive-health/rep1', 'hive-health/rep2', 'ice-rink/rep1', 'ice-rink/rep2', 'youth-league/rep1', 'youth-league/rep2'] as const;
export const CELLS = ['none@L2', 'none@L3', 'mcp@L2'] as const;
export type Cell = (typeof CELLS)[number];

export interface Contrast {
  readonly id: 'H1' | 'H2' | 'H3';
  readonly reference: Cell;
  readonly other: Cell;
  /** true: power counts rejections with T > 0 only (H1, H2); false: any rejection (H3, not powered). */
  readonly directional: boolean;
}

/** d_b = D(reference) − D(other); H1 and H2 predict d_b > 0. */
export const CONTRASTS: readonly Contrast[] = [
  { id: 'H1', reference: 'none@L2', other: 'none@L3', directional: true },
  { id: 'H2', reference: 'none@L2', other: 'mcp@L2', directional: true },
  { id: 'H3', reference: 'none@L3', other: 'mcp@L2', directional: false },
];

const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

export interface CellStats {
  readonly n: number;
  readonly mean: number;
  readonly sd: number;
  /** NB θ by the method of moments; null when variance ≤ mean (undefined: no overdispersion). */
  readonly theta: number | null;
  readonly pZero: number;
}

export function cellStats(d: readonly number[]): CellStats {
  return { n: d.length, mean: mean(d), sd: Math.sqrt(sampleVariance(d)), theta: momentTheta(d), pZero: d.filter((x) => x === 0).length / d.length };
}

export interface DiffStats {
  readonly diffs: readonly number[];
  readonly p0: number;
  /** P(d > 0 | d ≠ 0); null when every difference is 0. */
  readonly q: number | null;
  readonly mean: number;
  readonly sd: number;
}

export function pairedDiffs(reference: readonly number[], other: readonly number[]): number[] {
  if (reference.length !== other.length) throw new RangeError('paired cells must have the same blocks');
  return reference.map((x, i) => x - (other[i] as number));
}

export function diffStats(diffs: readonly number[]): DiffStats {
  const nonZero = diffs.filter((x) => x !== 0);
  return {
    diffs,
    p0: (diffs.length - nonZero.length) / diffs.length,
    q: nonZero.length === 0 ? null : nonZero.filter((x) => x > 0).length / nonZero.length,
    mean: mean(diffs),
    sd: Math.sqrt(sampleVariance(diffs)),
  };
}

/** §3 step 1: the smallest n of non-zero pairs with 2 × 2⁻ⁿ ≤ α. */
export function minNonZeroPairs(alpha: number): number {
  let n = 1;
  while (2 * 2 ** -n > alpha) n += 1;
  return n;
}

/** Exact two-sided sign-flip p: P(|T*| ≥ |T|) over all 2ⁿ sign patterns of integer differences. */
export function exactSignFlipP(diffs: readonly number[]): number {
  const mags = diffs.map((x) => {
    if (!Number.isInteger(x)) throw new RangeError(`differences must be integers, got ${String(x)}`);
    return Math.abs(x);
  }).filter((x) => x !== 0);
  const t = Math.abs(diffs.reduce((a, b) => a + b, 0));
  const total = mags.reduce((a, b) => a + b, 0);
  if (mags.length === 0) return 1;
  // counts[s + total] = number of sign patterns with T* = s.
  let counts = new Float64Array(2 * total + 1);
  counts[total] = 1;
  for (const m of mags) {
    const next = new Float64Array(counts.length);
    for (let i = 0; i < counts.length; i++) {
      const c = counts[i] as number;
      if (c === 0) continue;
      next[i + m] = (next[i + m] as number) + c;
      next[i - m] = (next[i - m] as number) + c;
    }
    counts = next;
  }
  let tail = 0;
  for (let i = 0; i < counts.length; i++) if (Math.abs(i - total) >= t) tail += counts[i] as number;
  return tail / 2 ** mags.length;
}

/** round(d / 2) with an odd d's tie sent to either neighbour with probability 1/2. */
export function halfSize(d: number, next: () => number): number {
  if (d % 2 === 0) return d / 2;
  const lo = Math.floor(d / 2);
  return next() < 0.5 ? lo : lo + 1;
}

export interface PowerOptions {
  readonly n: number;
  readonly half: boolean;
  readonly directional: boolean;
  readonly alpha?: number;
  readonly sims?: number;
  readonly seed?: number;
}

export interface PowerResult {
  readonly n: number;
  readonly half: boolean;
  readonly sims: number;
  /** Rejections counted: p ≤ α and, when directional, T > 0. */
  readonly power: number;
  readonly rejectPositive: number;
  readonly rejectNegative: number;
}

/** §3 step 3: draw n block differences with replacement from `source`, apply the test, count rejections. */
export function resamplePower(source: readonly number[], o: PowerOptions): PowerResult {
  const alpha = o.alpha ?? STUDY2B_ALPHA;
  const sims = o.sims ?? STUDY2B_SIMS;
  const rng = mulberry32(o.seed ?? STUDY2B_SEED);
  const cache = new Map<string, number>();
  let pos = 0;
  let neg = 0;
  for (let s = 0; s < sims; s++) {
    const draw: number[] = [];
    for (let i = 0; i < o.n; i++) {
      const d = source[Math.floor(rng.next() * source.length)] as number;
      draw.push(o.half ? halfSize(d, rng.next) : d);
    }
    // p depends only on the multiset of magnitudes and |T|; cache on the sorted draw.
    const key = [...draw].sort((a, b) => a - b).join(',');
    let p = cache.get(key);
    if (p === undefined) {
      p = exactSignFlipP(draw);
      cache.set(key, p);
    }
    if (p <= alpha) {
      const t = draw.reduce((a, b) => a + b, 0);
      if (t > 0) pos += 1;
      else if (t < 0) neg += 1;
    }
  }
  return { n: o.n, half: o.half, sims, power: (o.directional ? pos : pos + neg) / sims, rejectPositive: pos / sims, rejectNegative: neg / sims };
}

/** §3 step 3 rule: the smallest grid N with power ≥ the bar, or null (the contrast is demoted; the grid is not extended). */
export function smallestN(rows: readonly PowerResult[], bar = STUDY2B_POWER_BAR): number | null {
  const ok = rows.filter((r) => r.power >= bar).map((r) => r.n);
  return ok.length === 0 ? null : Math.min(...ok);
}
