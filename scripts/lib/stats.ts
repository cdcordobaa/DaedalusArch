/**
 * Statistical primitives for U5b (FR-25, FR-27, FR-36; BR-U5b-61, 62, 63; U5bP Q10, Q22).
 *
 * Every function is pure. Every random draw goes through a `SeededRng`, which carries the seed it was
 * created with so callers can record it (BR-U5b-63). Values are returned at full precision; rounding
 * happens only at display (`toFixed(6)` in CSVs, BR-U5b-63).
 *
 * - `wilson`, `clopperPearson`: binomial proportion intervals (two-sided, default 95 %); `wilsonProportion` for a
 *   proportion on a non-integer size (Kish effective n, cell count).
 * - `clusterBootstrap`: cluster percentile bootstrap of any statistic over clusters (default 10 000 resamples).
 * - `permutationTest`: two-sided (or one-sided `greater`) permutation test of a difference in means, labels permuted
 *   within blocks.
 * - `cohenKappa`, `gwetAC1` (square contingency tables), `fleissKappa` (subjects × categories counts).
 * - `holm`: Holm step-down adjusted p-values. `cliffsDelta`: dominance effect size.
 * - `selectIntervalMethod`, `proportionInterval`: the BR-U5b-61 interval rule.
 * - `weightedProportionInterval`, `kishEffectiveN`: the BR-U5b-61 rule for a Horvitz–Thompson weighted proportion
 *   (SO4 baseline precision, ADR-020 item 1).
 * - `recallIntervals`: recall with the (project, operator) cell as the unit, the project bootstrap co-primary from
 *   10 projects (descriptive below) and the instance Wilson interval as the "if independent" bound (ADR-020 item 3).
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
  return wilsonProportion(k / n, n, z);
}

/**
 * Wilson score interval for a proportion `p` observed on a (possibly non-integer) sample size `n > 0`: the
 * effective size of a weighted proportion (Kish) or the number of (project, operator) cells (ADR-020 items 1, 3).
 */
export function wilsonProportion(p: number, n: number, z = Z_95): Interval {
  if (!(n > 0) || !Number.isFinite(n) || !(p >= 0 && p <= 1)) {
    throw new RangeError(`stats: need 0 <= p <= 1 and a finite n > 0 (p=${String(p)}, n=${String(n)})`);
  }
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
  /** Two-sided p = (1 + #{|T*| >= |T|}) / (1 + resamples); one-sided (`greater`) p = (1 + #{T* >= T}) / (1 + resamples). */
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

/**
 * Permutation test of mean(A) - mean(B); group labels are permuted within each block. Two-sided by default;
 * `alternative: 'greater'` is the one-sided test of mean(A) > mean(B), p = (1 + #{T* >= T}) / (1 + resamples)
 * (the pre-registered directional self-preference check, ADR-020 item 7).
 */
export function permutationTest(
  observations: readonly PermutationObservation[],
  options: { readonly seed: number; readonly resamples?: number; readonly alternative?: 'two-sided' | 'greater' },
): PermutationResult {
  const greater = options.alternative === 'greater';
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
    const t = meanDiff(observations, permuted);
    if (greater ? t >= observed - eps : Math.abs(t) >= Math.abs(observed) - eps) extreme += 1;
  }
  return { statistic: observed, p: (extreme + 1) / (resamples + 1), resamples, seed: options.seed };
}

/**
 * Permutes `items` within blocks: the item at index i only moves to an index of the same block (BR-U5b-65:
 * permutations never move a project across tasks). Blocks are visited in sorted order for reproducibility.
 */
export function permuteWithinBlocks<T>(items: readonly T[], blocks: readonly string[], rng: SeededRng): T[] {
  if (items.length !== blocks.length) throw new RangeError('stats: items and blocks differ in length');
  const byBlock = new Map<string, number[]>();
  blocks.forEach((b, i) => {
    const list = byBlock.get(b);
    if (list === undefined) byBlock.set(b, [i]); else list.push(i);
  });
  const out = [...items];
  for (const b of [...byBlock.keys()].sort()) {
    const idx = byBlock.get(b) ?? [];
    const shuffled = shuffle(idx.map((i) => pick(items, i)), rng);
    idx.forEach((i, j) => { out[i] = pick(shuffled, j); });
  }
  return out;
}

function groupMeans(keys: readonly string[], values: readonly number[]): Map<string, { n: number; mean: number }> {
  const acc = new Map<string, { n: number; sum: number }>();
  keys.forEach((k, i) => {
    const a = acc.get(k) ?? { n: 0, sum: 0 };
    a.n += 1;
    a.sum += pick(values, i);
    acc.set(k, a);
  });
  return new Map([...acc].map(([k, a]) => [k, { n: a.n, mean: a.sum / a.n }]));
}

/** Between-level sum of squares: sum over levels of n_l (mean_l - grand mean)^2. */
export function betweenSS(levels: readonly string[], values: readonly number[]): number {
  if (values.length === 0) return 0;
  const grand = values.reduce((a, b) => a + b, 0) / values.length;
  let ss = 0;
  for (const { n, mean } of groupMeans(levels, values).values()) ss += n * (mean - grand) ** 2;
  return ss;
}

/** Interaction sum of squares of factors a and b: sum over cells n_ab (mean_ab - mean_a - mean_b + grand)^2. */
export function interactionSS(a: readonly string[], b: readonly string[], values: readonly number[]): number {
  if (values.length === 0) return 0;
  const grand = values.reduce((x, y) => x + y, 0) / values.length;
  const ma = groupMeans(a, values);
  const mb = groupMeans(b, values);
  const cells = groupMeans(a.map((x, i) => JSON.stringify([x, pick(b, i)])), values);
  let ss = 0;
  for (const [key, { n, mean }] of cells) {
    const [ka, kb] = JSON.parse(key) as [string, string];
    ss += n * (mean - (ma.get(ka)?.mean ?? 0) - (mb.get(kb)?.mean ?? 0) + grand) ** 2;
  }
  return ss;
}

export interface FactorObservation {
  readonly block: string;
  readonly level: string;
  readonly value: number;
}

/**
 * Permutation test of a factor main effect (statistic: between-level sum of squares), with the level labels
 * permuted within blocks (task as blocking factor, BR-U5b-65). p = (1 + #{T* >= T}) / (1 + resamples).
 */
export function permutationFactorTest(
  observations: readonly FactorObservation[],
  options: { readonly seed: number; readonly resamples?: number },
): PermutationResult {
  const resamples = options.resamples ?? 10_000;
  const rng = createRng(options.seed);
  const levels = observations.map((o) => o.level);
  const blocks = observations.map((o) => o.block);
  const values = observations.map((o) => o.value);
  const observed = betweenSS(levels, values);
  const eps = 1e-12;
  let extreme = 0;
  for (let r = 0; r < resamples; r += 1) {
    if (betweenSS(permuteWithinBlocks(levels, blocks, rng), values) >= observed - eps) extreme += 1;
  }
  return { statistic: observed, p: (extreme + 1) / (resamples + 1), resamples, seed: options.seed };
}

export interface TwoFactorObservation {
  readonly block: string;
  readonly a: string;
  readonly b: string;
  readonly value: number;
}

/**
 * Permutation test of the a × b interaction (statistic: interaction sum of squares). Residuals of the additive
 * model (value - mean_a - mean_b + grand) are permuted within blocks (permutation of reduced-model residuals).
 */
export function permutationInteractionTest(
  observations: readonly TwoFactorObservation[],
  options: { readonly seed: number; readonly resamples?: number },
): PermutationResult {
  const resamples = options.resamples ?? 10_000;
  const rng = createRng(options.seed);
  const a = observations.map((o) => o.a);
  const b = observations.map((o) => o.b);
  const blocks = observations.map((o) => o.block);
  const values = observations.map((o) => o.value);
  const observed = interactionSS(a, b, values);
  const grand = values.reduce((x, y) => x + y, 0) / Math.max(1, values.length);
  const ma = groupMeans(a, values);
  const mb = groupMeans(b, values);
  const residuals = values.map((v, i) => v - (ma.get(pick(a, i))?.mean ?? 0) - (mb.get(pick(b, i))?.mean ?? 0) + grand);
  const eps = 1e-12;
  let extreme = 0;
  for (let r = 0; r < resamples; r += 1) {
    if (interactionSS(a, b, permuteWithinBlocks(residuals, blocks, rng)) >= observed - eps) extreme += 1;
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

// ---------------------------------------------------------------------------------------------
// Weighted proportions (ADR-020 item 1: Horvitz–Thompson baseline precision under BR-U5b-61)

/** One labelled item: its design weight (1 / inclusion probability) and whether it is a success. */
export interface WeightedObservation {
  readonly weight: number;
  readonly success: boolean;
}

/** Kish effective sample size (Σw)² / Σw² (= n for equal weights; 0 for no weights). */
export function kishEffectiveN(weights: readonly number[]): number {
  let s = 0;
  let s2 = 0;
  for (const w of weights) {
    if (!(w > 0) || !Number.isFinite(w)) throw new RangeError(`stats: weights must be finite and > 0, got ${String(w)}`);
    s += w;
    s2 += w * w;
  }
  return s2 === 0 ? 0 : (s * s) / s2;
}

export type WeightedCiMethod = 'cluster-bootstrap' | 'wilson-kish' | 'clopper-pearson-kish';

export interface WeightedProportionCell {
  /** Labelled items (unweighted count). */
  readonly n: number;
  readonly nClusters: number;
  /** Kish effective sample size of all items. */
  readonly nEffective: number;
  /** Σ w over successes and over all items. */
  readonly weightedSuccesses: number;
  readonly weightedTotal: number;
  /** HT ratio Σ w·y / Σ w; `null` when n < 10 (counts only). */
  readonly estimate: number | null;
  readonly ciLow: number | null;
  readonly ciHigh: number | null;
  readonly ciMethod: WeightedCiMethod | null;
  /** Kish-Wilson primary cells carry the cluster bootstrap as a sensitivity column. */
  readonly sensitivity?: BootstrapResult;
  readonly seed?: number;
}

/**
 * A weighted (Horvitz–Thompson ratio) proportion under the BR-U5b-61 rule: n < 10 items → counts only; ≥ 10
 * clusters → cluster percentile bootstrap of Σ w·y / Σ w; otherwise Wilson on the Kish effective size n_eff with the
 * weighted estimate (Clopper–Pearson on ⌊n_eff⌋ when the estimate is 0 or 1), the bootstrap as sensitivity. The Kish
 * size makes the interval account for unequal weights, which a Wilson interval on the raw item count ignores.
 */
export function weightedProportionInterval(
  clusters: readonly (readonly WeightedObservation[])[],
  options: { readonly seed: number; readonly resamples?: number },
): WeightedProportionCell {
  const items = clusters.flat();
  const n = items.length;
  const nonEmpty = clusters.filter((c) => c.length > 0);
  const nClusters = nonEmpty.length;
  const nEffective = kishEffectiveN(items.map((i) => i.weight));
  const weightedTotal = items.reduce((s, i) => s + i.weight, 0);
  const weightedSuccesses = items.reduce((s, i) => s + (i.success ? i.weight : 0), 0);
  const base = { n, nClusters, nEffective, weightedSuccesses, weightedTotal };
  if (n < MIN_INTERVAL_N) return { ...base, estimate: null, ciLow: null, ciHigh: null, ciMethod: null };
  const estimate = weightedSuccesses / weightedTotal;
  const asRatio = nonEmpty.map((c) => ({ num: c.reduce((s, i) => s + (i.success ? i.weight : 0), 0), den: c.reduce((s, i) => s + i.weight, 0) }));
  const boot = (): BootstrapResult => clusterBootstrap(asRatio, ratioOfSums, {
    seed: options.seed, ...(options.resamples !== undefined && { resamples: options.resamples }),
  });
  if (nClusters >= MIN_BOOTSTRAP_CLUSTERS) {
    const b = boot();
    return { ...base, estimate, ciLow: b.low, ciHigh: b.high, ciMethod: 'cluster-bootstrap', seed: options.seed };
  }
  const extreme = weightedSuccesses === 0 || weightedSuccesses === weightedTotal;
  const m = Math.max(1, Math.floor(nEffective));
  const iv = extreme ? clopperPearson(weightedSuccesses === 0 ? 0 : m, m) : wilsonProportion(estimate, nEffective);
  return {
    ...base, estimate, ciLow: iv.low, ciHigh: iv.high, ciMethod: extreme ? 'clopper-pearson-kish' : 'wilson-kish',
    sensitivity: boot(), seed: options.seed,
  };
}

// ---------------------------------------------------------------------------------------------
// Recall intervals with the (project, operator) cell as the unit (ADR-020 item 3)

/** One (project, operator) cell: `num` detected of its `den` scored copies (cell recall = num / den). */
export interface RecallCell {
  readonly project: string;
  readonly operator: string;
  readonly num: number;
  readonly den: number;
}

export type CellCiMethod = 'cell-bootstrap' | 'wilson-cells' | 'clopper-pearson-cells';

export interface IntervalColumns<M extends string> {
  readonly ciLow: number | null;
  readonly ciHigh: number | null;
  readonly ciMethod: M | null;
}

export interface RecallIntervals {
  readonly k: number;
  readonly n: number;
  readonly nCells: number;
  readonly nProjects: number;
  /** k / n; `null` when n < 10 (counts only, BR-U5b-61). */
  readonly estimate: number | null;
  /** Primary: the cell is the unit. ≥ 10 cells → cell bootstrap; else Wilson with n = cells (CP at 0 or n). */
  readonly cell: IntervalColumns<CellCiMethod>;
  /**
   * Project cluster bootstrap, reported from 2 projects. Co-primary only with ≥ 10 projects (BR-U5b-61);
   * with 2..9 projects a percentile bootstrap over so few clusters undercovers, so it is descriptive.
   */
  readonly project: IntervalColumns<'cluster-bootstrap'> & {
    /** `true` with 2..9 projects (descriptive), `false` with ≥ 10 (co-primary), `null` when no interval is reported. */
    readonly descriptive: boolean | null;
  };
  /** The "if independent" bound: Wilson on instances (Clopper–Pearson at 0 or n). */
  readonly independent: IntervalColumns<'wilson' | 'clopper-pearson'>;
  readonly seed: number;
}

const NO_INTERVAL = { ciLow: null, ciHigh: null, ciMethod: null } as const;
const NO_PROJECT_INTERVAL = { ...NO_INTERVAL, descriptive: null } as const;

/**
 * Recall intervals of ADR-020 item 3. The k copies of one operator on one base are not independent, so the
 * (project, operator) cell is the unit: with ≥ 10 cells the cluster bootstrap over cells is primary; with fewer,
 * Wilson on the pooled recall with n = the number of cells (Clopper–Pearson when every cell or none detects).
 * The project cluster bootstrap is reported from 2 projects and is co-primary only with ≥ 10 projects (the BR-U5b-61
 * cluster floor); below that it is flagged `descriptive`. The instance Wilson interval is reported only as the bound
 * that would hold if the copies were independent. Cells with `den = 0` are ignored.
 */
export function recallIntervals(cells: readonly RecallCell[], options: { readonly seed: number; readonly resamples?: number }): RecallIntervals {
  const used = cells.filter((c) => c.den > 0);
  const k = used.reduce((s, c) => s + c.num, 0);
  const n = used.reduce((s, c) => s + c.den, 0);
  const byProject = new Map<string, { num: number; den: number }>();
  for (const c of used) {
    const p = byProject.get(c.project) ?? { num: 0, den: 0 };
    p.num += c.num;
    p.den += c.den;
    byProject.set(c.project, p);
  }
  const projects = [...byProject.keys()].sort().map((p) => byProject.get(p) ?? { num: 0, den: 0 });
  const base = { k, n, nCells: used.length, nProjects: projects.length, seed: options.seed };
  if (n < MIN_INTERVAL_N) return { ...base, estimate: null, cell: NO_INTERVAL, project: NO_PROJECT_INTERVAL, independent: NO_INTERVAL };
  const resamples = options.resamples !== undefined ? { resamples: options.resamples } : {};
  const estimate = k / n;
  const extreme = k === 0 || k === n;
  let cell: IntervalColumns<CellCiMethod>;
  if (used.length >= MIN_BOOTSTRAP_CLUSTERS) {
    const key = (c: RecallCell): string => JSON.stringify([c.project, c.operator]);
    const sorted = [...used].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
    const b = clusterBootstrap(sorted, ratioOfSums, { seed: options.seed, ...resamples });
    cell = { ciLow: b.low, ciHigh: b.high, ciMethod: 'cell-bootstrap' };
  } else {
    const iv = extreme ? clopperPearson(k === 0 ? 0 : used.length, used.length) : wilsonProportion(estimate, used.length);
    cell = { ciLow: iv.low, ciHigh: iv.high, ciMethod: extreme ? 'clopper-pearson-cells' : 'wilson-cells' };
  }
  let project: RecallIntervals['project'] = NO_PROJECT_INTERVAL;
  if (projects.length >= 2) {
    const b = clusterBootstrap(projects, ratioOfSums, { seed: options.seed, ...resamples });
    project = { ciLow: b.low, ciHigh: b.high, ciMethod: 'cluster-bootstrap', descriptive: projects.length < MIN_BOOTSTRAP_CLUSTERS };
  }
  const ind = extreme ? clopperPearson(k, n) : wilson(k, n);
  return { ...base, estimate, cell, project, independent: { ciLow: ind.low, ciHigh: ind.high, ciMethod: extreme ? 'clopper-pearson' : 'wilson' } };
}

// ---------------------------------------------------------------------------------------------
// Precision and F1 intervals with the (project, operator) cell as the unit (ADR-021 SO4-06)

/** One (project, operator) cell of a P/R/F1 row: its TP, FP and FN counts. */
export interface ConfusionCell {
  readonly project: string;
  readonly operator: string;
  readonly tp: number;
  readonly fp: number;
  readonly fn: number;
}

/** Interval columns of a project cluster bootstrap, with the BR-U5b-61 floor flag (ADR-020 item 3 amendment). */
export type ProjectIntervalColumns = IntervalColumns<'cluster-bootstrap'> & { readonly descriptive: boolean | null };

export interface PrecisionF1Intervals {
  readonly tp: number;
  readonly fp: number;
  readonly fn: number;
  /** Cells with TP + FP > 0 (the precision units) and with TP + FP + FN > 0 (the F1 units). */
  readonly nPrecisionCells: number;
  readonly nF1Cells: number;
  readonly nProjects: number;
  readonly precision: {
    /** TP / (TP + FP); `null` when TP + FP < 10 (counts only, BR-U5b-61). */
    readonly estimate: number | null;
    /** Primary: ≥ 10 cells → cell bootstrap; else Wilson on the pooled precision with n = cells (CP at 0 or 1). */
    readonly cell: IntervalColumns<CellCiMethod>;
    /** Project cluster bootstrap from 2 projects; co-primary only with ≥ 10 projects, else descriptive. */
    readonly project: ProjectIntervalColumns;
    /** The "if independent" bound: Wilson on the TP + FP violations (Clopper–Pearson at 0 or n). */
    readonly independent: IntervalColumns<'wilson' | 'clopper-pearson'>;
  };
  readonly f1: {
    /** 2TP / (2TP + FP + FN); `null` when TP + FP < 10 or TP + FN < 10 (counts only). */
    readonly estimate: number | null;
    /** ≥ 10 cells → cell bootstrap; F1 is not a binomial proportion, so below 10 cells there is no cell interval. */
    readonly cell: IntervalColumns<'cell-bootstrap'>;
    readonly project: ProjectIntervalColumns;
  };
  readonly seed: number;
}

/** Pooled F1 of a sample of cells: 2TP / (2TP + FP + FN), `NaN` when precision or recall is undefined. */
export function f1OfSums(sample: readonly { readonly tp: number; readonly fp: number; readonly fn: number }[]): number {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  for (const c of sample) {
    tp += c.tp;
    fp += c.fp;
    fn += c.fn;
  }
  return tp + fp === 0 || tp + fn === 0 ? Number.NaN : (2 * tp) / (2 * tp + fp + fn);
}

function byCellKey<T extends { readonly project: string; readonly operator: string }>(cells: readonly T[]): T[] {
  const key = (c: T): string => JSON.stringify([c.project, c.operator]);
  return [...cells].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}

function projectSums(cells: readonly ConfusionCell[]): { tp: number; fp: number; fn: number }[] {
  const by = new Map<string, { tp: number; fp: number; fn: number }>();
  for (const c of cells) {
    const p = by.get(c.project) ?? { tp: 0, fp: 0, fn: 0 };
    p.tp += c.tp;
    p.fp += c.fp;
    p.fn += c.fn;
    by.set(c.project, p);
  }
  return [...by.keys()].sort().map((p) => by.get(p) ?? { tp: 0, fp: 0, fn: 0 });
}

/**
 * Precision and F1 intervals (ADR-021 SO4-06), under the same unit rule as `recallIntervals` (ADR-020 item 3 and its
 * amendment). Precision: with ≥ 10 cells (TP + FP > 0) the cell bootstrap of Σ TP / Σ (TP + FP) is primary; with fewer,
 * Wilson on the pooled precision with n = the number of such cells (Clopper–Pearson when it is 0 or 1). The project
 * cluster bootstrap is reported from 2 projects, co-primary only with ≥ 10 projects and `descriptive` below. Wilson on
 * the TP + FP violations is reported only as the "if independent" bound: FP counts are violations, several per copy,
 * so they are not independent trials. F1 is not a binomial proportion: it gets the cell bootstrap (≥ 10 cells) and the
 * project cluster bootstrap (descriptive below 10 projects), never a Wilson interval. Below n = 10 (TP + FP for
 * precision; TP + FP and TP + FN for F1) only counts are reported (BR-U5b-61).
 */
export function precisionF1Intervals(cells: readonly ConfusionCell[], options: { readonly seed: number; readonly resamples?: number }): PrecisionF1Intervals {
  const f1Cells = byCellKey(cells.filter((c) => c.tp + c.fp + c.fn > 0));
  const pCells = f1Cells.filter((c) => c.tp + c.fp > 0);
  const tp = f1Cells.reduce((s, c) => s + c.tp, 0);
  const fp = f1Cells.reduce((s, c) => s + c.fp, 0);
  const fn = f1Cells.reduce((s, c) => s + c.fn, 0);
  const resamples = options.resamples !== undefined ? { resamples: options.resamples } : {};
  const boot = <T>(units: readonly T[], stat: (s: readonly T[]) => number): BootstrapResult => clusterBootstrap(units, stat, { seed: options.seed, ...resamples });
  const asRatio = (c: { tp: number; fp: number }): { num: number; den: number } => ({ num: c.tp, den: c.tp + c.fp });
  const projectCols = (n: number, run: () => BootstrapResult): ProjectIntervalColumns => {
    if (n < 2) return NO_PROJECT_INTERVAL;
    const b = run();
    return { ciLow: b.low, ciHigh: b.high, ciMethod: 'cluster-bootstrap', descriptive: n < MIN_BOOTSTRAP_CLUSTERS };
  };

  let precision: PrecisionF1Intervals['precision'] = { estimate: null, cell: NO_INTERVAL, project: NO_PROJECT_INTERVAL, independent: NO_INTERVAL };
  const nP = tp + fp;
  if (nP >= MIN_INTERVAL_N) {
    const estimate = tp / nP;
    const extreme = tp === 0 || tp === nP;
    let cell: IntervalColumns<CellCiMethod>;
    if (pCells.length >= MIN_BOOTSTRAP_CLUSTERS) {
      const b = boot(pCells.map(asRatio), ratioOfSums);
      cell = { ciLow: b.low, ciHigh: b.high, ciMethod: 'cell-bootstrap' };
    } else {
      const m = pCells.length;
      const iv = extreme ? clopperPearson(tp === 0 ? 0 : m, m) : wilsonProportion(estimate, m);
      cell = { ciLow: iv.low, ciHigh: iv.high, ciMethod: extreme ? 'clopper-pearson-cells' : 'wilson-cells' };
    }
    const pProjects = projectSums(pCells).map(asRatio);
    const ind = extreme ? clopperPearson(tp, nP) : wilson(tp, nP);
    precision = {
      estimate, cell, project: projectCols(pProjects.length, () => boot(pProjects, ratioOfSums)),
      independent: { ciLow: ind.low, ciHigh: ind.high, ciMethod: extreme ? 'clopper-pearson' : 'wilson' },
    };
  }

  let f1: PrecisionF1Intervals['f1'] = { estimate: null, cell: NO_INTERVAL, project: NO_PROJECT_INTERVAL };
  if (nP >= MIN_INTERVAL_N && tp + fn >= MIN_INTERVAL_N) {
    let cell: IntervalColumns<'cell-bootstrap'> = NO_INTERVAL;
    if (f1Cells.length >= MIN_BOOTSTRAP_CLUSTERS) {
      const b = boot(f1Cells, f1OfSums);
      cell = { ciLow: b.low, ciHigh: b.high, ciMethod: 'cell-bootstrap' };
    }
    const projects = projectSums(f1Cells);
    f1 = { estimate: f1OfSums(f1Cells), cell, project: projectCols(projects.length, () => boot(projects, f1OfSums)) };
  }
  return {
    tp, fp, fn, nPrecisionCells: pCells.length, nF1Cells: f1Cells.length, nProjects: projectSums(f1Cells).length,
    precision, f1, seed: options.seed,
  };
}
