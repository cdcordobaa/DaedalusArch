/**
 * Exploratory Study 2a, Stage C: the pure part of the analysis (registration `Docs/v1.4/exploratory-study-registration.md`
 * §7, §8, §9, Amendment 1). Descriptive only: no test statistic, no p-value. Used by `scripts/v1.4/stage-c-rescore.ts`.
 */
import { clusterBootstrap, createRng, wilson } from '../../lib/stats.js';
import type { BootstrapResult, Interval } from '../../lib/stats.js';

/** The registration's seed (§8, §9) and bootstrap size (§8). */
export const STAGE_C_SEED = 20261019;
export const STAGE_C_RESAMPLES = 10_000;

/** One run's D figures, as the analysis reads them. */
export interface RunD {
  readonly cell: string;
  readonly task: string;
  /** Replicate of the shared step-1 tree (1 or 2). */
  readonly rep: number;
  readonly D: number | null;
  readonly Y1: number | null;
  readonly Yk: number | null;
  readonly inheritedRemoved: number | null;
}

export const blockOf = (r: Pick<RunD, 'task' | 'rep'>): string => `${r.task}/rep${String(r.rep)}`;

const nums = (xs: readonly (number | null)[]): number[] => xs.filter((x): x is number => x !== null);
const mean = (xs: readonly number[]): number => (xs.length === 0 ? Number.NaN : xs.reduce((a, b) => a + b, 0) / xs.length);
/** Sample variance (n − 1); NaN below two values. */
export function sampleVariance(xs: readonly number[]): number {
  if (xs.length < 2) return Number.NaN;
  const m = mean(xs);
  return xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1);
}

/**
 * Negative-binomial θ by the method of moments, Var = μ + μ²/θ. Null when Var ≤ μ (no overdispersion: θ is infinite,
 * Poisson-like) or when μ = 0.
 */
export function momentTheta(xs: readonly number[]): number | null {
  const m = mean(xs);
  const v = sampleVariance(xs);
  if (!Number.isFinite(m) || !Number.isFinite(v) || m === 0 || v <= m) return null;
  return (m * m) / (v - m);
}

/**
 * Between-task variance by the method of moments (one-way random effects, balanced or not): σ²_task = (MSB − MSW)/n0,
 * truncated at 0. Needs at least two groups and some within-group replication.
 */
export function betweenTaskVariance(groups: readonly (readonly number[])[]): { readonly sigma2Task: number | null; readonly msb: number | null; readonly msw: number | null; readonly n0: number | null } {
  const gs = groups.filter((g) => g.length > 0);
  const k = gs.length;
  const N = gs.reduce((a, g) => a + g.length, 0);
  if (k < 2 || N - k < 1) return { sigma2Task: null, msb: null, msw: null, n0: null };
  const grand = mean(gs.flat());
  const ssb = gs.reduce((a, g) => a + g.length * (mean(g) - grand) ** 2, 0);
  const ssw = gs.reduce((a, g) => a + g.reduce((b, x) => b + (x - mean(g)) ** 2, 0), 0);
  const msb = ssb / (k - 1);
  const msw = ssw / (N - k);
  const n0 = (N - gs.reduce((a, g) => a + g.length ** 2, 0) / N) / (k - 1);
  return { sigma2Task: Math.max(0, (msb - msw) / n0), msb, msw, n0 };
}

/** Value → count, ascending keys (the distribution, not only the mean). */
export function histogram(xs: readonly number[]): Record<string, number> {
  const m = new Map<number, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return Object.fromEntries([...m].sort((a, b) => a[0] - b[0]).map(([k, v]) => [String(k), v]));
}

export interface CellSummary {
  readonly cell: string;
  readonly runs: number;
  readonly scoredRuns: number;
  readonly D: { readonly values: readonly (number | null)[]; readonly sum: number; readonly mean: number; readonly variance: number; readonly min: number; readonly max: number; readonly histogram: Record<string, number>; readonly thetaMoments: number | null; readonly meanInterval: BootstrapResult | null };
  readonly betweenTask: ReturnType<typeof betweenTaskVariance>;
  readonly Y1: readonly (number | null)[];
  readonly Yk: readonly (number | null)[];
  /** Runs whose step-5 snapshot holds no counted blocking identity. */
  readonly endStateZero: number;
  /** Runs that removed every inherited step-1 identity by step 5. */
  readonly allInheritedRemoved: number;
  /** D | R = 0: D over the runs that removed no inherited identity (estimand 3). */
  readonly DgivenNoInheritedRemoval: { readonly runs: number; readonly values: readonly number[]; readonly mean: number | null };
}

/** A cell's descriptive summary; the mean's interval is a task-clustered bootstrap (§8). */
export function summariseCell(cell: string, runs: readonly RunD[], seed = STAGE_C_SEED, resamples = STAGE_C_RESAMPLES): CellSummary {
  const rs = [...runs].sort((a, b) => (blockOf(a) < blockOf(b) ? -1 : 1));
  const d = nums(rs.map((r) => r.D));
  const tasks = [...new Set(rs.map((r) => r.task))].sort();
  const clusters = tasks.map((t) => nums(rs.filter((r) => r.task === t).map((r) => r.D)));
  const meanInterval = d.length === 0 ? null : clusterBootstrap(clusters, (s) => mean(s.flat()), { seed, resamples });
  const r0 = rs.filter((r) => r.inheritedRemoved === 0 && r.D !== null);
  return {
    cell,
    runs: rs.length,
    scoredRuns: d.length,
    D: {
      values: rs.map((r) => r.D),
      sum: d.reduce((a, b) => a + b, 0),
      mean: mean(d),
      variance: sampleVariance(d),
      min: Math.min(...d),
      max: Math.max(...d),
      histogram: histogram(d),
      thetaMoments: momentTheta(d),
      meanInterval,
    },
    betweenTask: betweenTaskVariance(clusters),
    Y1: rs.map((r) => r.Y1),
    Yk: rs.map((r) => r.Yk),
    endStateZero: rs.filter((r) => r.Yk === 0).length,
    allInheritedRemoved: rs.filter((r) => r.Y1 !== null && r.Y1 > 0 && r.inheritedRemoved === r.Y1).length,
    DgivenNoInheritedRemoval: { runs: r0.length, values: r0.map((r) => r.D as number), mean: r0.length === 0 ? null : mean(r0.map((r) => r.D as number)) },
  };
}

/**
 * Estimand 5: ΣD(cell) / ΣD(reference) over the blocks both cells share, with a task-clustered bootstrap of the
 * paired blocks (a resample whose reference sum is 0 is undefined and left out, and counted).
 */
export function cellRatio(cell: readonly RunD[], reference: readonly RunD[], seed = STAGE_C_SEED, resamples = STAGE_C_RESAMPLES): { readonly blocks: number; readonly sumCell: number; readonly sumReference: number; readonly ratio: BootstrapResult | null; readonly difference: BootstrapResult | null } {
  const ref = new Map(reference.map((r) => [blockOf(r), r]));
  const pairs = cell.flatMap((r) => {
    const q = ref.get(blockOf(r));
    return q !== undefined && r.D !== null && q.D !== null ? [{ task: r.task, a: r.D, b: q.D }] : [];
  });
  const tasks = [...new Set(pairs.map((p) => p.task))].sort();
  const clusters = tasks.map((t) => pairs.filter((p) => p.task === t));
  const sum = (s: readonly (readonly { a: number; b: number }[])[], k: 'a' | 'b'): number => s.flat().reduce((x, p) => x + p[k], 0);
  const sumCell = sum(clusters, 'a');
  const sumReference = sum(clusters, 'b');
  if (pairs.length === 0) return { blocks: 0, sumCell, sumReference, ratio: null, difference: null };
  return {
    blocks: pairs.length,
    sumCell,
    sumReference,
    ratio: clusterBootstrap(clusters, (s) => { const den = sum(s, 'b'); return den === 0 ? Number.NaN : sum(s, 'a') / den; }, { seed, resamples }),
    difference: clusterBootstrap(clusters, (s) => (sum(s, 'a') - sum(s, 'b')) / s.flat().length, { seed, resamples }),
  };
}

/** Estimand 2: share of blocks with Y1 = 0, with its Wilson interval. */
export function y1ZeroShare(blocks: readonly { readonly Y1: number | null }[]): { readonly k: number; readonly n: number; readonly interval: Interval } {
  const ys = nums(blocks.map((b) => b.Y1));
  const k = ys.filter((y) => y === 0).length;
  return { k, n: ys.length, interval: wilson(k, ys.length) };
}

/**
 * The staged stop rule (§7, Amendment 1 items 2 and 4), for the one generator that ran: stop the style iff mean D < 0.5
 * over the Stage A trajectories **and** Y1 = 0 in at least 2 of the 3 blocks. Only complete blocks count.
 */
export function stopCheck(stageA: readonly RunD[]): { readonly blocks: number; readonly meanD: number | null; readonly y1Zero: number; readonly meanBelow: boolean; readonly y1ZeroInMost: boolean; readonly stop: boolean } {
  const complete = stageA.filter((r) => r.D !== null && r.Y1 !== null);
  const meanD = complete.length === 0 ? null : mean(complete.map((r) => r.D as number));
  const y1Zero = complete.filter((r) => r.Y1 === 0).length;
  const meanBelow = meanD !== null && meanD < 0.5;
  const y1ZeroInMost = y1Zero >= 2;
  return { blocks: complete.length, meanD, y1Zero, meanBelow, y1ZeroInMost, stop: meanBelow && y1ZeroInMost };
}

/**
 * Estimand 4, coarse and declared: the edge kind of a blocking identity. An FF-S03 edge from a composition root (a
 * file named server, app, main, index, composition, container or bootstrap directly in the presentation layer) is
 * `wiring`; any other FF-S03 edge is `layer-skip`; FF-S01 `direction`, FF-S02 `cycle`. A file-name heuristic, not a
 * reading of the code. `composition`, `container` and `bootstrap` were added after the first pass had shown one
 * `composition.ts` (declared in the Stage C report).
 */
export const COMPOSITION_ROOT = /^src\/presentation\/(server|app|main|index|composition|container|bootstrap)\.ts$/;
export function edgeKind(f: { readonly functionId: string; readonly filePath: string }): string {
  if (f.functionId === 'FF-S02') return 'cycle';
  if (f.functionId === 'FF-S01') return 'direction';
  if (f.functionId === 'FF-S03') return COMPOSITION_ROOT.test(f.filePath) ? 'wiring' : 'layer-skip';
  return `other:${f.functionId}`;
}

/**
 * The semantic sample (§9, Amendment 1 item 6): per stratum (cell), `m` step-5 snapshots, at most `perTask` per task,
 * drawn with the seed. With 3 cells and 12 snapshots, m = 4: every stratum then spans at least two tasks.
 * Deterministic: a seeded Fisher-Yates over the candidates in sorted order.
 */
export function drawSemanticSample<T extends { readonly cell: string; readonly task: string; readonly id: string }>(candidates: readonly T[], m: number, seed = STAGE_C_SEED, perTask = 2): T[] {
  const out: T[] = [];
  const cells = [...new Set(candidates.map((c) => c.cell))].sort();
  cells.forEach((cell, i) => {
    const pool = candidates.filter((c) => c.cell === cell).sort((a, b) => (a.id < b.id ? -1 : 1));
    const rng = createRng(seed + i);
    for (let j = pool.length - 1; j > 0; j--) {
      const k = rng.int(j + 1);
      [pool[j], pool[k]] = [pool[k] as T, pool[j] as T];
    }
    const taken: T[] = [];
    for (const c of pool) {
      if (taken.length >= m) break;
      if (taken.filter((t) => t.task === c.task).length >= perTask) continue;
      taken.push(c);
    }
    if (new Set(taken.map((t) => t.task)).size < 2 && pool.length >= 2) throw new Error(`semantic sample: stratum ${cell} spans fewer than two tasks`);
    out.push(...taken.sort((a, b) => (a.id < b.id ? -1 : 1)));
  });
  return out;
}
