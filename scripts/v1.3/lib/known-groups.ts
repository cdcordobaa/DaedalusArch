/**
 * Helpers for the v1.3 known-groups and discriminant analysis (Docs/DiagnosticRuns/v1.3-known-groups-plan.md):
 * the name-based group rule, the size filter, an exact (fully enumerated) permutation test, Spearman's ρ with average
 * ranks and a percentile bootstrap for it. Pure functions; no I/O.
 */
import { cliffsDelta, createRng, quantileSorted } from '../../lib/stats.js';

export const SHOWCASE_TERMS = ['boilerplate', 'template', 'sample', 'example', 'starter', 'showcase'] as const;
export type Group = 'showcase' | 'application';

/** Showcase when any field, lower-cased, contains a showcase term (plan §2). Undefined fields are ignored. */
export function groupOf(fields: readonly (string | undefined)[]): Group {
  const text = fields.filter((f): f is string => f !== undefined).join('\n').toLowerCase();
  return SHOWCASE_TERMS.some((t) => text.includes(t)) ? 'showcase' : 'application';
}

/**
 * Size filter of plan §3 (the external selection's `srcTsFiles` filter), on a path relative to `<root>/src/`:
 * `.ts`, not `.d.ts`/`.spec.ts`/`.test.ts`, no `__tests__`/`test`/`tests` path segment.
 */
export function countsAsSource(relPath: string): boolean {
  const p = relPath.replace(/\\/g, '/');
  if (!p.endsWith('.ts') || p.endsWith('.d.ts') || p.endsWith('.spec.ts') || p.endsWith('.test.ts')) return false;
  return !p.split('/').some((s) => s === '__tests__' || s === 'test' || s === 'tests');
}

export function nonBlankLines(text: string): number {
  return text.split(/\r?\n/).filter((l) => l.trim() !== '').length;
}

/** All k-subsets of {0..n-1}, in lexicographic order. */
export function combinations(n: number, k: number): number[][] {
  const out: number[][] = [];
  const cur: number[] = [];
  const rec = (start: number): void => {
    if (cur.length === k) { out.push([...cur]); return; }
    for (let i = start; i <= n - (k - cur.length); i += 1) { cur.push(i); rec(i + 1); cur.pop(); }
  };
  rec(0);
  return out;
}

const mean = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;
const EPS = 1e-12;

export interface ExactPermutationResult {
  /** mean(application) − mean(showcase). */
  readonly observed: number;
  /** One-sided p of mean(application) − mean(showcase) ≥ observed. */
  readonly p: number;
  readonly labelings: number;
  readonly atLeastAsExtreme: number;
}

/** Exact one-sided permutation test of mean(application) − mean(showcase), over every labeling with the same group sizes. */
export function exactPermutation(values: readonly number[], groups: readonly Group[]): ExactPermutationResult {
  if (values.length !== groups.length) throw new RangeError('known-groups: values and groups differ in length');
  const k = groups.filter((g) => g === 'showcase').length;
  if (k === 0 || k === values.length) throw new RangeError('known-groups: both groups need at least one member');
  const stat = (showcase: ReadonlySet<number>): number => {
    const s: number[] = [];
    const a: number[] = [];
    values.forEach((v, i) => (showcase.has(i) ? s : a).push(v));
    return mean(a) - mean(s);
  };
  const observed = stat(new Set(groups.flatMap((g, i) => (g === 'showcase' ? [i] : []))));
  let hit = 0;
  const all = combinations(values.length, k);
  for (const c of all) if (stat(new Set(c)) >= observed - EPS) hit += 1;
  return { observed, p: hit / all.length, labelings: all.length, atLeastAsExtreme: hit };
}

/**
 * Exact stratified version: labels are permuted only within each stratum (group sizes per stratum kept). Enumerates
 * the Cartesian product of the per-stratum labelings.
 */
export function exactStratifiedPermutation(
  values: readonly number[], groups: readonly Group[], strata: readonly string[],
): ExactPermutationResult {
  const byStratum = new Map<string, number[]>();
  strata.forEach((s, i) => { const l = byStratum.get(s); if (l === undefined) byStratum.set(s, [i]); else l.push(i); });
  const options: number[][][] = [...byStratum.keys()].sort().map((s) => {
    const idx = byStratum.get(s) ?? [];
    const k = idx.filter((i) => groups[i] === 'showcase').length;
    return combinations(idx.length, k).map((c) => c.map((j) => idx[j] ?? -1));
  });
  const stat = (showcase: ReadonlySet<number>): number => {
    const s: number[] = [];
    const a: number[] = [];
    values.forEach((v, i) => (showcase.has(i) ? s : a).push(v));
    return mean(a) - mean(s);
  };
  const observed = stat(new Set(groups.flatMap((g, i) => (g === 'showcase' ? [i] : []))));
  let hit = 0;
  let total = 0;
  const rec = (d: number, chosen: number[]): void => {
    if (d === options.length) { total += 1; if (stat(new Set(chosen)) >= observed - EPS) hit += 1; return; }
    for (const o of options[d] ?? []) rec(d + 1, [...chosen, ...o]);
  };
  rec(0, []);
  return { observed, p: hit / total, labelings: total, atLeastAsExtreme: hit };
}

/** Average ranks (1-based), ties share the mean rank. */
export function averageRanks(x: readonly number[]): number[] {
  const order = x.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const r = new Array<number>(x.length).fill(0);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && (order[j + 1] as { v: number }).v === (order[i] as { v: number }).v) j += 1;
    const avg = (i + j) / 2 + 1;
    for (let t = i; t <= j; t += 1) r[(order[t] as { i: number }).i] = avg;
    i = j + 1;
  }
  return r;
}

function pearson(x: readonly number[], y: readonly number[]): number {
  const mx = mean(x);
  const my = mean(y);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  x.forEach((xi, i) => { const dx = xi - mx; const dy = (y[i] ?? Number.NaN) - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; });
  return sxx === 0 || syy === 0 ? Number.NaN : sxy / Math.sqrt(sxx * syy);
}

/** Spearman's ρ: Pearson correlation of average ranks. NaN when either variable is constant. */
export function spearman(x: readonly number[], y: readonly number[]): number {
  if (x.length !== y.length) throw new RangeError('known-groups: spearman needs equal lengths');
  return pearson(averageRanks(x), averageRanks(y));
}

export interface SpearmanCi {
  readonly rho: number;
  readonly lo: number;
  readonly hi: number;
  readonly resamples: number;
  /** Resamples skipped because a variable was constant in them. */
  readonly skipped: number;
}

/** Spearman ρ with a 95% percentile bootstrap CI over units (resampled with replacement). */
export function spearmanBootstrap(
  x: readonly number[], y: readonly number[], options: { readonly seed: number; readonly resamples?: number },
): SpearmanCi {
  const resamples = options.resamples ?? 10_000;
  const rng = createRng(options.seed);
  const n = x.length;
  const draws: number[] = [];
  let skipped = 0;
  for (let r = 0; r < resamples; r += 1) {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < n; i += 1) {
      const j = Math.floor(rng.next() * n);
      xs.push(x[j] ?? Number.NaN);
      ys.push(y[j] ?? Number.NaN);
    }
    const rho = spearman(xs, ys);
    if (Number.isNaN(rho)) skipped += 1; else draws.push(rho);
  }
  draws.sort((a, b) => a - b);
  return {
    rho: spearman(x, y),
    lo: draws.length > 0 ? quantileSorted(draws, 0.025) : Number.NaN,
    hi: draws.length > 0 ? quantileSorted(draws, 0.975) : Number.NaN,
    resamples, skipped,
  };
}

export type KnownGroupsReading = 'supported' | 'direction only' | 'not supported';

/** Plan §6: supported when p ≤ 0.05 and δ ≥ 0.33; direction only when δ > 0 otherwise; not supported when δ ≤ 0. */
export function readKnownGroups(p: number, delta: number): KnownGroupsReading {
  if (delta <= 0) return 'not supported';
  return p <= 0.05 && delta >= 0.33 ? 'supported' : 'direction only';
}

export function knownGroupsEffect(values: readonly number[], groups: readonly Group[]): number {
  const a = values.filter((_, i) => groups[i] === 'application');
  const s = values.filter((_, i) => groups[i] === 'showcase');
  return cliffsDelta(a, s);
}
