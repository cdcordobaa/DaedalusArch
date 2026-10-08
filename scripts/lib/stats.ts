/**
 * Statistical primitives for U5b (FR-25, FR-27, FR-36; BR-U5b-61, 62, 63; U5bP Q10, Q22).
 *
 * Every function is pure. Every random draw goes through a `SeededRng`, which carries the seed it was
 * created with so callers can record it (BR-U5b-63). Values are returned at full precision; rounding
 * happens only at display (`toFixed(6)` in CSVs, BR-U5b-63).
 *
 * - `wilson`, `clopperPearson`: binomial proportion intervals (two-sided, default 95 %).
 * - `clusterBootstrap`: cluster percentile bootstrap of any statistic over clusters (default 10 000 resamples).
 * - `permutationTest`: two-sided permutation test of a difference in means, labels permuted within blocks.
 * - `cohenKappa`, `gwetAC1` (square contingency tables), `fleissKappa` (subjects × categories counts).
 * - `holm`: Holm step-down adjusted p-values. `cliffsDelta`: dominance effect size.
 * - `selectIntervalMethod`, `proportionInterval`: the BR-U5b-61 interval rule.
 */

/** Two-sided standard normal quantile for 95 %. */
export const Z_95 = 1.959963984540054;

// ---------------------------------------------------------------------------------------------
// Seeded RNG (BR-U5b-63)

/** A seeded pseudo-random source (mulberry32) that records its seed and the number of draws. */
export interface SeededRng {
  readonly seed: number;
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer in [0, n). */
  int(n: number): number;
  /** Number of `next()` calls so far. */
  readonly draws: number;
}

/** Creates a seeded RNG. `seed` must be a safe integer; it is reduced to 32 bits for the generator. */
export function createRng(seed: number): SeededRng {
  if (!Number.isSafeInteger(seed)) throw new RangeError(`stats: seed must be a safe integer, got ${String(seed)}`);
  let state = seed >>> 0;
  let draws = 0;
  const next = (): number => {
    draws += 1;
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    seed,
    next,
    int: (n: number): number => {
      if (!Number.isInteger(n) || n <= 0) throw new RangeError(`stats: int(n) needs a positive integer, got ${String(n)}`);
      return Math.floor(next() * n);
    },
    get draws() { return draws; },
  };
}

/** `items[i]` for an index the caller has bounds-checked (throws otherwise). */
function pick<T>(items: readonly T[], i: number): T {
  if (i < 0 || i >= items.length) throw new RangeError(`stats: index ${String(i)} out of range`);
  return items[i] as T;
}

/** Fisher–Yates shuffle of a copy of `items`. */
export function shuffle<T>(items: readonly T[], rng: SeededRng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = rng.int(i + 1);
    const tmp = pick(out, i);
    out[i] = pick(out, j);
    out[j] = tmp;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Binomial intervals

export interface Interval {
  readonly low: number;
  readonly high: number;
}

function checkCounts(k: number, n: number): void {
  if (!Number.isInteger(k) || !Number.isInteger(n) || n <= 0 || k < 0 || k > n) {
    throw new RangeError(`stats: need integers 0 <= k <= n, n > 0 (k=${String(k)}, n=${String(n)})`);
  }
}

/** Wilson score interval for k successes out of n. */
export function wilson(k: number, n: number, z = Z_95): Interval {
  checkCounts(k, n);
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}

function logGamma(x: number): number {
  // Lanczos approximation (g = 7, n = 9), accurate to ~1e-15 for x > 0.
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  const xx = x - 1;
  const t = xx + 7.5;
  const a = c.reduce((sum, ci, i) => (i === 0 ? ci : sum + ci / (xx + i)), 0);
  return 0.5 * Math.log(2 * Math.PI) + (xx + 0.5) * Math.log(t) - t + Math.log(a);
}

function betaContinuedFraction(a: number, b: number, x: number): number {
  const tiny = 1e-300;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 1000; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return h;
}

/** Regularised incomplete beta function I_x(a, b). */
export function regularizedBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lnFront = logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x);
  if (x < (a + 1) / (a + b + 2)) return (Math.exp(lnFront) * betaContinuedFraction(a, b, x)) / a;
  return 1 - (Math.exp(lnFront) * betaContinuedFraction(b, a, 1 - x)) / b;
}

function betaQuantile(p: number, a: number, b: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 200; i += 1) {
    const mid = (lo + hi) / 2;
    if (regularizedBeta(mid, a, b) < p) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Clopper–Pearson exact interval for k successes out of n (two-sided, level 1 - alpha). */
export function clopperPearson(k: number, n: number, alpha = 0.05): Interval {
  checkCounts(k, n);
  const low = k === 0 ? 0 : betaQuantile(alpha / 2, k, n - k + 1);
  const high = k === n ? 1 : betaQuantile(1 - alpha / 2, k + 1, n - k);
  return { low, high };
}

// ---------------------------------------------------------------------------------------------
// Resampling

/** Percentile of sorted values with linear interpolation (type 7). */
export function quantileSorted(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) throw new RangeError('stats: quantile of an empty sample');
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const vlo = sorted[lo] ?? Number.NaN;
  const vhi = sorted[hi] ?? Number.NaN;
  return vlo + (vhi - vlo) * (pos - lo);
}

export interface BootstrapResult extends Interval {
  readonly estimate: number;
  readonly method: 'cluster-bootstrap';
  readonly resamples: number;
  readonly seed: number;
  /** Resamples whose statistic was not finite (e.g. 0/0); they are left out of the percentiles. */
  readonly undefinedResamples: number;
}

export interface BootstrapOptions {
  readonly seed: number;
  readonly resamples?: number;
  readonly alpha?: number;
}

/** Cluster percentile bootstrap: resample whole clusters with replacement and take percentiles of `statistic`. */
export function clusterBootstrap<T>(
  clusters: readonly T[],
  statistic: (sample: readonly T[]) => number,
  options: BootstrapOptions,
): BootstrapResult {
  if (clusters.length === 0) throw new RangeError('stats: bootstrap needs at least one cluster');
  const resamples = options.resamples ?? 10_000;
  const alpha = options.alpha ?? 0.05;
  const rng = createRng(options.seed);
  const values: number[] = [];
  let undefinedResamples = 0;
  for (let r = 0; r < resamples; r += 1) {
    const sample: T[] = clusters.map(() => pick(clusters, rng.int(clusters.length)));
    const v = statistic(sample);
    if (Number.isFinite(v)) values.push(v); else undefinedResamples += 1;
  }
  values.sort((a, b) => a - b);
  return {
    estimate: statistic(clusters),
    low: quantileSorted(values, alpha / 2),
    high: quantileSorted(values, 1 - alpha / 2),
    method: 'cluster-bootstrap',
    resamples,
    seed: options.seed,
    undefinedResamples,
  };
}

/** Ratio of sums over clusters, e.g. recall = sum(tp) / sum(tp + fn) (NaN when the denominator is 0). */
export function ratioOfSums(sample: readonly { readonly num: number; readonly den: number }[]): number {
  let num = 0;
  let den = 0;
  for (const c of sample) { num += c.num; den += c.den; }
  return den === 0 ? Number.NaN : num / den;
}

export interface PermutationObservation {
  readonly block: string;
  readonly group: 'A' | 'B';
  readonly value: number;
}

export interface PermutationResult {
  /** Observed mean(A) - mean(B). */
  readonly statistic: number;
  /** Two-sided p = (1 + #{|T*| >= |T|}) / (1 + resamples). */
  readonly p: number;
  readonly resamples: number;
  readonly seed: number;
}

function meanDiff(obs: readonly PermutationObservation[], groups: readonly ('A' | 'B')[]): number {
  let sa = 0; let na = 0; let sb = 0; let nb = 0;
  obs.forEach((o, i) => {
    if (groups[i] === 'A') { sa += o.value; na += 1; } else { sb += o.value; nb += 1; }
  });
  if (na === 0 || nb === 0) throw new RangeError('stats: permutation test needs both groups');
  return sa / na - sb / nb;
}

/** Two-sided permutation test of mean(A) - mean(B); group labels are permuted within each block. */
export function permutationTest(
  observations: readonly PermutationObservation[],
  options: { readonly seed: number; readonly resamples?: number },
): PermutationResult {
  const resamples = options.resamples ?? 10_000;
  const rng = createRng(options.seed);
  const labels = observations.map((o) => o.group);
  const observed = meanDiff(observations, labels);
  const blocks = new Map<string, number[]>();
  observations.forEach((o, i) => {
    const list = blocks.get(o.block);
    if (list === undefined) blocks.set(o.block, [i]); else list.push(i);
  });
  const blockList = [...blocks.keys()].sort().map((b) => blocks.get(b) ?? []);
  let extreme = 0;
  const eps = 1e-12;
  for (let r = 0; r < resamples; r += 1) {
    const permuted = [...labels];
    for (const idx of blockList) {
      const shuffled = shuffle(idx.map((i) => pick(labels, i)), rng);
      idx.forEach((i, j) => { permuted[i] = pick(shuffled, j); });
    }
    if (Math.abs(meanDiff(observations, permuted)) >= Math.abs(observed) - eps) extreme += 1;
  }
  return { statistic: observed, p: (extreme + 1) / (resamples + 1), resamples, seed: options.seed };
}

// ---------------------------------------------------------------------------------------------
// Agreement

function checkSquare(table: readonly (readonly number[])[]): { q: number; n: number } {
  const q = table.length;
  if (q < 2 || table.some((row) => row.length !== q)) throw new RangeError('stats: need a square table with >= 2 categories');
  const n = table.reduce((s, row) => s + row.reduce((a, b) => a + b, 0), 0);
  if (n <= 0) throw new RangeError('stats: empty agreement table');
  return { q, n };
}

function marginals(table: readonly (readonly number[])[], q: number, n: number): { po: number; rows: number[]; cols: number[] } {
  let diag = 0;
  const rows = new Array<number>(q).fill(0);
  const cols = new Array<number>(q).fill(0);
  table.forEach((row, i) => {
    row.forEach((v, j) => {
      rows[i] = (rows[i] ?? 0) + v / n;
      cols[j] = (cols[j] ?? 0) + v / n;
      if (i === j) diag += v;
    });
  });
  return { po: diag / n, rows, cols };
}

/** Cohen's κ for a q×q table (rows: rater 1, columns: rater 2). */
export function cohenKappa(table: readonly (readonly number[])[]): number {
  const { q, n } = checkSquare(table);
  const { po, rows, cols } = marginals(table, q, n);
  const pe = rows.reduce((s, r, i) => s + r * (cols[i] ?? 0), 0);
  return (po - pe) / (1 - pe);
}

/** Gwet's AC1 for a q×q table: pe = (1 / (q - 1)) Σ π_k (1 - π_k), π_k the mean marginal of category k. */
export function gwetAC1(table: readonly (readonly number[])[]): number {
  const { q, n } = checkSquare(table);
  const { po, rows, cols } = marginals(table, q, n);
  const pe = rows.reduce((s, r, i) => { const pi = (r + (cols[i] ?? 0)) / 2; return s + pi * (1 - pi); }, 0) / (q - 1);
  return (po - pe) / (1 - pe);
}

/** Fleiss' κ for subjects × categories counts; every subject must have the same number of ratings (≥ 2). */
export function fleissKappa(counts: readonly (readonly number[])[]): number {
  const subjects = counts.length;
  if (subjects === 0) throw new RangeError('stats: Fleiss kappa needs subjects');
  const k = (counts[0] ?? []).length;
  const raters = (counts[0] ?? []).reduce((a, b) => a + b, 0);
  if (raters < 2 || counts.some((row) => row.length !== k || row.reduce((a, b) => a + b, 0) !== raters)) {
    throw new RangeError('stats: Fleiss kappa needs the same number (>= 2) of ratings per subject');
  }
  const pj = new Array<number>(k).fill(0);
  let pBar = 0;
  for (const row of counts) {
    row.forEach((v, j) => { pj[j] = (pj[j] ?? 0) + v / (subjects * raters); });
    pBar += (row.reduce((s, v) => s + v * v, 0) - raters) / (raters * (raters - 1));
  }
  pBar /= subjects;
  const pe = pj.reduce((s, p) => s + p * p, 0);
  return (pBar - pe) / (1 - pe);
}

// ---------------------------------------------------------------------------------------------
// Multiplicity and effect size

/** Holm step-down adjusted p-values, returned in input order (monotone, capped at 1). */
export function holm(pValues: readonly number[]): number[] {
  const m = pValues.length;
  const order = pValues.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p || a.i - b.i);
  const adjusted = new Array<number>(m).fill(0);
  let running = 0;
  order.forEach(({ p, i }, rank) => {
    running = Math.max(running, Math.min(1, (m - rank) * p));
    adjusted[i] = running;
  });
  return adjusted;
}

/** Cliff's δ = (#{x > y} - #{x < y}) / (|x| |y|). */
export function cliffsDelta(x: readonly number[], y: readonly number[]): number {
  if (x.length === 0 || y.length === 0) throw new RangeError('stats: Cliff\'s delta needs two non-empty samples');
  let s = 0;
  for (const a of x) for (const b of y) s += a > b ? 1 : a < b ? -1 : 0;
  return s / (x.length * y.length);
}

// ---------------------------------------------------------------------------------------------
// Interval rule (BR-U5b-61)

export type CiMethod = 'cluster-bootstrap' | 'wilson' | 'clopper-pearson';

/** Clusters needed for the bootstrap to be primary. */
export const MIN_BOOTSTRAP_CLUSTERS = 10;
/** Cells with fewer instances report counts only. */
export const MIN_INTERVAL_N = 10;

/**
 * BR-U5b-61: n < 10 → no interval (`null`, counts only); ≥ 10 clusters → cluster bootstrap;
 * otherwise Wilson on instances, Clopper–Pearson when the count is 0 or n.
 */
export function selectIntervalMethod(args: { readonly k: number; readonly n: number; readonly nClusters: number }): CiMethod | null {
  if (args.n < MIN_INTERVAL_N) return null;
  if (args.nClusters >= MIN_BOOTSTRAP_CLUSTERS) return 'cluster-bootstrap';
  return args.k === 0 || args.k === args.n ? 'clopper-pearson' : 'wilson';
}

export interface ProportionCell {
  readonly k: number;
  readonly n: number;
  readonly nClusters: number;
  /** `null` when n < 10 (counts only). */
  readonly estimate: number | null;
  readonly ciLow: number | null;
  readonly ciHigh: number | null;
  readonly ciMethod: CiMethod | null;
  /** Wilson/Clopper–Pearson primary cells carry the cluster bootstrap as a sensitivity column when clusters are given. */
  readonly sensitivity?: BootstrapResult;
  readonly seed?: number;
}

/**
 * A proportion cell under BR-U5b-61. `clusters` are per-cluster `{num, den}` counts (projects; E1: generation
 * cells) whose sums are k and n; the bootstrap uses them with `seed`.
 */
export function proportionInterval(
  clusters: readonly { readonly num: number; readonly den: number }[],
  options: { readonly seed: number; readonly resamples?: number },
): ProportionCell {
  const k = clusters.reduce((s, c) => s + c.num, 0);
  const n = clusters.reduce((s, c) => s + c.den, 0);
  const nClusters = clusters.length;
  const method = selectIntervalMethod({ k, n, nClusters });
  if (method === null) return { k, n, nClusters, estimate: null, ciLow: null, ciHigh: null, ciMethod: null };
  const boot = (): BootstrapResult => clusterBootstrap(clusters, ratioOfSums, {
    seed: options.seed, ...(options.resamples !== undefined && { resamples: options.resamples }),
  });
  if (method === 'cluster-bootstrap') {
    const b = boot();
    return { k, n, nClusters, estimate: k / n, ciLow: b.low, ciHigh: b.high, ciMethod: method, seed: options.seed };
  }
  const iv = method === 'wilson' ? wilson(k, n) : clopperPearson(k, n);
  return { k, n, nClusters, estimate: k / n, ciLow: iv.low, ciHigh: iv.high, ciMethod: method, sensitivity: boot(), seed: options.seed };
}
