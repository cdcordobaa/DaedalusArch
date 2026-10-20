/**
 * Study 2b confirmatory analysis: the pure part (pre-registration `Docs/v1.4/study2b-preregistration.md` §4; Fable
 * review 2026-10-20 findings 1, 2, 5, 7, 8 and 9). Used by `scripts/v1.4/study2b-analyse.ts` and its unit test.
 *
 * Every number here is a function of the inputs and the registered constants below; nothing is tuned on 2b data.
 * - The test: paired two-sided sign-flip on T = Σ d_b, d_b = D(reference) − D(other). The Monte Carlo p uses 99,999
 *   random sign assignments, p = (1 + #{|T*| ≥ |T|}) / (1 + 99,999); the exact p (`exactSignFlipP`, all 2ⁿ patterns
 *   by convolution) is reported beside it at every N. Holm runs over the family on each; when the two Holm decisions
 *   differ for any contrast, the exact-p decisions govern (§4, finding 8c).
 * - Intervals: 95 % percentile bootstrap, 10,000 resamples, (a) blocks resampled within task and (b) task clusters.
 * - E: two one-sided tests through the 90 % within-task block-bootstrap interval of mean(none@L3 − mcp@L2).
 * - Robustness: exact signed-rank (midranks) and exact sign tests; the task-level sign-flip over the task sums
 *   (descriptive: with 4 tasks its smallest two-sided p is 2/16).
 * - V4 parts A and B (ADR-V14-04 §4, as the pre-registration amends them).
 */
import { mulberry32 } from '../../lib/mutation/rng';
import { clusterBootstrap, createRng, quantileSorted, wilson } from '../../lib/stats';
import type { BootstrapResult, Interval } from '../../lib/stats';
import { exactSignFlipP } from './study2b-power';

// ── registered constants (§4) ─────────────────────────────────────────────────

export const ANALYSIS_SEED = 20261021;
export const MC_DRAWS = 99_999;
export const BOOT_RESAMPLES = 10_000;
export const FWER = 0.05;
export const DELTA = 0.55;
export const DELTA2 = 0.28;
export const V4_A_MARGIN = 0.05;
export const V4_B_MARGIN = 0.1;
export const CONCENTRATION_SHARE = 0.9;
export const CELLS = ['none@L2', 'none@L3', 'mcp@L2'] as const;
export type Cell = (typeof CELLS)[number];
export type HypothesisId = 'H1' | 'H2' | 'H3';

export interface Contrast {
  readonly id: HypothesisId;
  readonly reference: Cell;
  readonly other: Cell;
  /** H1 and H2 predict d_b > 0 (the other cell drifts less); H3 predicts nothing. */
  readonly predictsPositive: boolean;
}

export const CONTRASTS: readonly Contrast[] = [
  { id: 'H1', reference: 'none@L2', other: 'none@L3', predictsPositive: true },
  { id: 'H2', reference: 'none@L2', other: 'mcp@L2', predictsPositive: true },
  { id: 'H3', reference: 'none@L3', other: 'mcp@L2', predictsPositive: false },
];

// ── blocks ───────────────────────────────────────────────────────────────────

export interface Block {
  readonly block: string;
  readonly task: string;
  readonly rep: number;
  readonly Y1: number | null;
  readonly D: Readonly<Record<Cell, number | null>>;
  readonly Yk: Readonly<Record<Cell, number | null>>;
  /** Lane of each cell's run (run-order covariate), when an order file was given. */
  readonly lane?: Readonly<Partial<Record<Cell, string>>>;
}

/** A block enters a contrast only when every cell has a D (§4 Pairing, §5). */
export const isComplete = (b: Block): boolean => CELLS.every((c) => b.D[c] !== null);

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
const mean = (xs: readonly number[]): number => (xs.length === 0 ? Number.NaN : sum(xs) / xs.length);

export function diffsOf(blocks: readonly Block[], c: Contrast, value: (b: Block, cell: Cell) => number | null = (b, cell) => b.D[cell]): { block: Block; d: number }[] {
  return blocks.flatMap((b) => {
    const x = value(b, c.reference);
    const y = value(b, c.other);
    return x === null || y === null ? [] : [{ block: b, d: x - y }];
  });
}

// ── tests ────────────────────────────────────────────────────────────────────

/** Monte Carlo two-sided sign-flip p (§4): (1 + #{|T*| ≥ |T|}) / (1 + draws). */
export function mcSignFlipP(diffs: readonly number[], draws = MC_DRAWS, seed = ANALYSIS_SEED): number {
  const t = Math.abs(sum(diffs));
  const rng = mulberry32(seed);
  let hit = 0;
  for (let s = 0; s < draws; s++) {
    let x = 0;
    for (const d of diffs) x += rng.next() < 0.5 ? -d : d;
    if (Math.abs(x) >= t - 1e-9) hit += 1;
  }
  return (1 + hit) / (1 + draws);
}

/** Exact two-sided sign test on the non-zero differences (robustness line, finding 8a). */
export function signTestP(diffs: readonly number[]): { readonly positive: number; readonly negative: number; readonly p: number } {
  const pos = diffs.filter((d) => d > 0).length;
  const neg = diffs.filter((d) => d < 0).length;
  const n = pos + neg;
  if (n === 0) return { positive: 0, negative: 0, p: 1 };
  const k = Math.min(pos, neg);
  let tail = 0;
  let c = 1;
  for (let i = 0; i <= n; i++) {
    if (i > 0) c = (c * (n - i + 1)) / i;
    if (i <= k) tail += c;
  }
  return { positive: pos, negative: neg, p: Math.min(1, (2 * tail) / 2 ** n) };
}

/** Exact two-sided Wilcoxon signed-rank p by the sign-flip of the (mid)ranks of |d| over the non-zero differences. */
export function signedRankP(diffs: readonly number[]): number {
  const nz = diffs.filter((d) => d !== 0);
  if (nz.length === 0) return 1;
  const order = nz.map((d, i) => ({ a: Math.abs(d), i })).sort((x, y) => x.a - y.a);
  const rank = new Array<number>(nz.length).fill(0);
  for (let i = 0; i < order.length;) {
    let j = i;
    while (j + 1 < order.length && order[j + 1]?.a === order[i]?.a) j++;
    const mid = (i + 1 + j + 1) / 2;
    for (let k = i; k <= j; k++) rank[order[k]?.i ?? 0] = mid;
    i = j + 1;
  }
  // Midranks are multiples of 1/2: doubling keeps the convolution on integers.
  return exactSignFlipP(nz.map((d, i) => Math.sign(d) * 2 * (rank[i] ?? 0)));
}

export interface HolmRow { readonly id: HypothesisId; readonly p: number; readonly alphaStep: number; readonly reject: boolean }

/** Holm step-down at familywise α over the given p values (stop at the first non-rejection). */
export function holmDecisions(ps: readonly { readonly id: HypothesisId; readonly p: number }[], fwer = FWER): HolmRow[] {
  const order = [...ps].sort((a, b) => a.p - b.p || (a.id < b.id ? -1 : 1));
  const m = order.length;
  let stopped = false;
  const out = order.map((x, rank) => {
    const alphaStep = fwer / (m - rank);
    const reject = !stopped && x.p <= alphaStep;
    if (!reject) stopped = true;
    return { id: x.id, p: x.p, alphaStep, reject };
  });
  return ps.map((x) => out.find((o) => o.id === x.id) as HolmRow);
}

// ── intervals ────────────────────────────────────────────────────────────────

/** Percentile bootstrap with blocks resampled within task strata (each stratum keeps its size). */
export function withinTaskBootstrap<T extends { readonly task: string }>(items: readonly T[], statistic: (s: readonly T[]) => number, seed = ANALYSIS_SEED, resamples = BOOT_RESAMPLES, alpha = 0.05): BootstrapResult {
  const tasks = [...new Set(items.map((x) => x.task))].sort();
  const strata = tasks.map((t) => items.filter((x) => x.task === t));
  const rng = createRng(seed);
  const values: number[] = [];
  let undef = 0;
  for (let r = 0; r < resamples; r++) {
    const s: T[] = [];
    for (const st of strata) for (let i = 0; i < st.length; i++) s.push(st[rng.int(st.length)] as T);
    const v = statistic(s);
    if (Number.isFinite(v)) values.push(v); else undef += 1;
  }
  values.sort((a, b) => a - b);
  const est = statistic(items);
  if (values.length === 0) return { estimate: est, low: Number.NaN, high: Number.NaN, method: 'cluster-bootstrap', resamples, seed, undefinedResamples: undef };
  return { estimate: est, low: quantileSorted(values, alpha / 2), high: quantileSorted(values, 1 - alpha / 2), method: 'cluster-bootstrap', resamples, seed, undefinedResamples: undef };
}

/** Task-cluster percentile bootstrap (tasks sorted, as Stage C's `cellRatio`). */
export function taskClusterBootstrap<T extends { readonly task: string }>(items: readonly T[], statistic: (s: readonly T[]) => number, seed = ANALYSIS_SEED, resamples = BOOT_RESAMPLES, alpha = 0.05): BootstrapResult {
  const tasks = [...new Set(items.map((x) => x.task))].sort();
  const clusters = tasks.map((t) => items.filter((x) => x.task === t));
  return clusterBootstrap(clusters, (s) => statistic(s.flat()), { seed, resamples, alpha });
}

interface Pair { readonly task: string; readonly ref: number; readonly oth: number }
const dbarOf = (s: readonly Pair[]): number => mean(s.map((p) => p.ref - p.oth));
const rrOf = (s: readonly Pair[]): number => {
  const den = sum(s.map((p) => p.ref));
  return den === 0 ? Number.NaN : sum(s.map((p) => p.oth)) / den;
};

// ── one contrast ─────────────────────────────────────────────────────────────

export interface ContrastResult {
  readonly id: HypothesisId;
  readonly reference: Cell;
  readonly other: Cell;
  readonly blocks: number;
  readonly diffs: readonly number[];
  readonly T: number;
  readonly mcP: number;
  readonly exactP: number;
  readonly nonZero: number;
  readonly dbar: number;
  /** ΣD(other) / ΣD(reference); null when the reference sum is 0 (undefined). */
  readonly rr: number | null;
  readonly dbarWithinTask: BootstrapResult;
  readonly dbarTaskCluster: BootstrapResult;
  readonly rrWithinTask: BootstrapResult | null;
  readonly rrTaskCluster: BootstrapResult | null;
  readonly signTest: ReturnType<typeof signTestP>;
  readonly signedRankP: number;
  /** Exact sign-flip over the task sums: descriptive (it cannot reject with 4 tasks). */
  readonly taskLevel: { readonly taskSums: Readonly<Record<string, number>>; readonly exactP: number; readonly smallestPossibleP: number };
}

export function analyseContrast(blocks: readonly Block[], c: Contrast, opts: { readonly seed?: number; readonly draws?: number; readonly resamples?: number; readonly value?: (b: Block, cell: Cell) => number | null } = {}): ContrastResult {
  const seed = opts.seed ?? ANALYSIS_SEED;
  const resamples = opts.resamples ?? BOOT_RESAMPLES;
  const value = opts.value ?? ((b: Block, cell: Cell) => b.D[cell]);
  const ds = diffsOf(blocks, c, value);
  const diffs = ds.map((x) => x.d);
  const pairs: Pair[] = ds.map((x) => ({ task: x.block.task, ref: value(x.block, c.reference) as number, oth: value(x.block, c.other) as number }));
  const taskSums: Record<string, number> = {};
  for (const x of ds) taskSums[x.block.task] = (taskSums[x.block.task] ?? 0) + x.d;
  const nTasks = Object.keys(taskSums).length;
  const rr = rrOf(pairs);
  const anyRef = pairs.some((p) => p.ref !== 0);
  return {
    id: c.id, reference: c.reference, other: c.other, blocks: ds.length, diffs,
    T: sum(diffs),
    mcP: diffs.length === 0 ? 1 : mcSignFlipP(diffs, opts.draws ?? MC_DRAWS, seed),
    exactP: exactSignFlipP(diffs),
    nonZero: diffs.filter((d) => d !== 0).length,
    dbar: mean(diffs),
    rr: Number.isFinite(rr) ? rr : null,
    dbarWithinTask: withinTaskBootstrap(pairs, dbarOf, seed, resamples),
    dbarTaskCluster: taskClusterBootstrap(pairs, dbarOf, seed, resamples),
    rrWithinTask: anyRef ? withinTaskBootstrap(pairs, rrOf, seed, resamples) : null,
    rrTaskCluster: anyRef ? taskClusterBootstrap(pairs, rrOf, seed, resamples) : null,
    signTest: signTestP(diffs),
    signedRankP: signedRankP(diffs),
    taskLevel: { taskSums, exactP: exactSignFlipP(Object.values(taskSums)), smallestPossibleP: nTasks === 0 ? 1 : 2 / 2 ** nTasks },
  };
}

export interface FamilyDecision {
  readonly family: readonly HypothesisId[];
  readonly holmMc: readonly HolmRow[];
  readonly holmExact: readonly HolmRow[];
  /** True when the MC and the exact Holm decisions differ for some contrast: the exact ones then govern. */
  readonly disagree: boolean;
  readonly governing: 'mc' | 'exact';
  readonly decisions: Readonly<Record<string, { readonly reject: boolean; readonly predictedSign: boolean | null; readonly supportedUnderThisOutcome: boolean | null }>>;
}

/** Holm over the surviving family on MC and on exact p; H1/H2 "supported under this outcome" = rejected and T > 0. */
export function familyDecision(results: readonly ContrastResult[], family: readonly HypothesisId[] = ['H1', 'H2', 'H3'], fwer = FWER): FamilyDecision {
  const inFam = results.filter((r) => family.includes(r.id));
  const holmMc = holmDecisions(inFam.map((r) => ({ id: r.id, p: r.mcP })), fwer);
  const holmExact = holmDecisions(inFam.map((r) => ({ id: r.id, p: r.exactP })), fwer);
  const disagree = holmMc.some((h) => holmExact.find((e) => e.id === h.id)?.reject !== h.reject);
  const gov = disagree ? holmExact : holmMc;
  const decisions: Record<string, { reject: boolean; predictedSign: boolean | null; supportedUnderThisOutcome: boolean | null }> = {};
  for (const r of inFam) {
    const c = CONTRASTS.find((x) => x.id === r.id);
    const reject = gov.find((h) => h.id === r.id)?.reject ?? false;
    const predictedSign = c?.predictsPositive === true ? r.T > 0 : null;
    decisions[r.id] = { reject, predictedSign, supportedUnderThisOutcome: c?.predictsPositive === true ? reject && r.T > 0 : null };
  }
  return { family, holmMc, holmExact, disagree, governing: disagree ? 'exact' : 'mc', decisions };
}

/**
 * Finding 2 rule: H1 or H2 is "supported" only if the Holm decision and the sign agree under D and under D†.
 * Disagreement: "holds under the composition-root exemption only", and the claim is scoped.
 */
export function supportedUnderBoth(d: FamilyDecision, dagger: FamilyDecision | null): Record<string, { readonly supported: boolean; readonly reading: string }> {
  const out: Record<string, { supported: boolean; reading: string }> = {};
  for (const id of ['H1', 'H2'] as const) {
    const a = d.decisions[id];
    if (a === undefined) continue;
    const b = dagger?.decisions[id];
    // Signs are compared only for a rejection: two non-rejections agree whatever their signs (re-check note).
    const agree = b !== undefined && a.reject === b.reject && (!a.reject || a.predictedSign === b.predictedSign);
    if (dagger === null || b === undefined) out[id] = { supported: false, reading: 'D† not available: the claim cannot be called supported (finding 2 rule)' };
    else if (!agree) out[id] = { supported: false, reading: 'D and D† disagree: holds under the composition-root exemption only; claim scoped' };
    else out[id] = { supported: a.supportedUnderThisOutcome === true, reading: a.supportedUnderThisOutcome === true ? 'supported (D and D† agree)' : a.reject ? 'rejected against the prediction (D and D† agree): a finding against the hypothesis' : 'not rejected under D or D†: no difference detected at RR <= 0.25 MDE' };
  }
  return out;
}

/**
 * The registered D_sem reading (pre-registration §4, "Semantic layer"; DELEG11): per contrast, "the symbolic conclusion
 * survives semantic interpretation" when the Holm decision (and, for a rejection, the sign) is the same under D and
 * D_sem; otherwise "conclusion depends on the semantic layer". Descriptive: it changes no decision.
 */
export function semanticReading(d: FamilyDecision, sem: FamilyDecision | null): Record<string, { readonly survives: boolean | null; readonly reading: string }> {
  const out: Record<string, { survives: boolean | null; reading: string }> = {};
  for (const id of d.family) {
    const a = d.decisions[id];
    const b = sem?.decisions[id];
    if (a === undefined) continue;
    if (sem === null || b === undefined) { out[id] = { survives: null, reading: 'D_sem not available (semantic layer not run, or configuration pending)' }; continue; }
    const agree = a.reject === b.reject && (!a.reject || a.predictedSign === b.predictedSign);
    out[id] = { survives: agree, reading: agree ? 'the symbolic conclusion survives semantic interpretation' : 'conclusion depends on the semantic layer' };
  }
  return out;
}

// ── equivalence E ────────────────────────────────────────────────────────────

export interface EquivalenceResult {
  readonly blocks: number;
  readonly dbar: number;
  readonly interval90: BootstrapResult;
  readonly delta: number;
  readonly withinDelta: boolean;
  /** Secondary Δ₂ (descriptive). */
  readonly delta2: number;
  readonly withinDelta2: boolean;
  /** Pooled mean D over the two treated cells; E is "not established" when it is below Δ (finding 7). */
  readonly pooledTreatedMeanD: number;
  readonly established: boolean;
  readonly reading: string;
}

export function equivalence(blocks: readonly Block[], opts: { readonly seed?: number; readonly resamples?: number; readonly delta?: number; readonly delta2?: number } = {}): EquivalenceResult {
  const delta = opts.delta ?? DELTA;
  const delta2 = opts.delta2 ?? DELTA2;
  const pairs: Pair[] = blocks.filter((b) => b.D['none@L3'] !== null && b.D['mcp@L2'] !== null).map((b) => ({ task: b.task, ref: b.D['none@L3'] as number, oth: b.D['mcp@L2'] as number }));
  const iv = withinTaskBootstrap(pairs, dbarOf, opts.seed ?? ANALYSIS_SEED, opts.resamples ?? BOOT_RESAMPLES, 0.1);
  const within = iv.low > -delta && iv.high < delta;
  const pooled = mean(pairs.flatMap((p) => [p.ref, p.oth]));
  const established = within && pooled >= delta;
  const reading = !within ? 'E fails: nothing is claimed about the two cells being equal'
    : pooled < delta ? `E not established: the 90 % interval lies inside ±${String(delta)}, but the pooled treated-cell mean D (${pooled.toFixed(2)}) is below Δ`
      : `E holds: the two cells are within ±${String(delta)} D per block of each other`;
  return { blocks: pairs.length, dbar: dbarOf(pairs), interval90: iv, delta, withinDelta: within, delta2, withinDelta2: iv.low > -delta2 && iv.high < delta2, pooledTreatedMeanD: pooled, established, reading };
}

// ── distributions ────────────────────────────────────────────────────────────

export function histogram(xs: readonly number[]): Record<string, number> {
  const m = new Map<number, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return Object.fromEntries([...m].sort((a, b) => a[0] - b[0]).map(([k, v]) => [String(k), v]));
}

export interface CellDistribution {
  readonly cell: Cell;
  readonly n: number;
  readonly values: readonly number[];
  readonly sum: number;
  readonly mean: number;
  readonly histogram: Record<string, number>;
  readonly zero: number;
  readonly pZero: number;
  readonly pZeroWilson: Interval;
}

export function cellDistribution(blocks: readonly Block[], cell: Cell): CellDistribution {
  const v = blocks.map((b) => b.D[cell]).filter((x): x is number => x !== null);
  const z = v.filter((x) => x === 0).length;
  return { cell, n: v.length, values: v, sum: sum(v), mean: mean(v), histogram: histogram(v), zero: z, pZero: v.length === 0 ? Number.NaN : z / v.length, pZeroWilson: v.length === 0 ? { low: Number.NaN, high: Number.NaN } : wilson(z, v.length) };
}

/** 2 × 2 count of blocks by (D = 0 or not) in the reference and the other cell. */
export function zeroTable(blocks: readonly Block[], c: Contrast): { readonly bothZero: number; readonly refZeroOnly: number; readonly otherZeroOnly: number; readonly neitherZero: number } {
  let a = 0, b = 0, cc = 0, d = 0;
  for (const x of blocks) {
    const r = x.D[c.reference];
    const o = x.D[c.other];
    if (r === null || o === null) continue;
    if (r === 0 && o === 0) a++; else if (r === 0) b++; else if (o === 0) cc++; else d++;
  }
  return { bothZero: a, refZeroOnly: b, otherZeroOnly: cc, neitherZero: d };
}

// ── V4 ───────────────────────────────────────────────────────────────────────

/** r_f from the development record run (F-RF, prespec addendum 2 §2): tp/(tp+fn), n = 0 → 1 − pooled miss rate. */
export function recallByFamily(perRule: readonly { readonly ruleId: string; readonly blocking: boolean; readonly counts: { readonly tp: number; readonly fn: number } }[]): { readonly rf: Record<string, number>; readonly pooled: number; readonly n: Record<string, number> } {
  const blocking = perRule.filter((r) => r.blocking);
  const tp = sum(blocking.map((r) => r.counts.tp));
  const fn = sum(blocking.map((r) => r.counts.fn));
  const pooled = tp + fn === 0 ? Number.NaN : tp / (tp + fn);
  const rf: Record<string, number> = {};
  const n: Record<string, number> = {};
  for (const r of blocking) {
    const m = r.counts.tp + r.counts.fn;
    n[r.ruleId] = m;
    rf[r.ruleId] = m === 0 ? pooled : r.counts.tp / m;
  }
  return { rf, pooled, n };
}

export interface PartACell { readonly cell: Cell; readonly identities: number; readonly shares: Readonly<Record<string, number>>; readonly m: number; readonly vacuous: boolean }
export interface PartA {
  readonly cells: readonly PartACell[];
  readonly pairs: readonly { readonly a: Cell; readonly b: Cell; readonly diff: number; readonly pass: boolean }[];
  readonly pass: boolean;
  /** A single family carries ≥ 90 % of counted identities in every cell with identities: part A cannot see a within-family channel. */
  readonly uninformative: boolean;
  readonly dominantFamily: string | null;
}

/** ADR-V14-04 §4 part A, as amended (finding 5): m_c = Σ_f s_c(f)(1 − r_f); s_c ≡ 0 when the cell has no identity. */
export function partA(identitiesByCell: Readonly<Record<Cell, readonly string[]>>, rf: Readonly<Record<string, number>>, pooledRecall: number, pairs: readonly (readonly [Cell, Cell])[], margin = V4_A_MARGIN): PartA {
  const rOf = (f: string): number => rf[f] ?? pooledRecall;
  const cells: PartACell[] = CELLS.map((cell) => {
    const ids = identitiesByCell[cell];
    const shares: Record<string, number> = {};
    for (const f of ids) shares[f] = (shares[f] ?? 0) + 1 / ids.length;
    return { cell, identities: ids.length, shares, m: sum(Object.entries(shares).map(([f, s]) => s * (1 - rOf(f)))), vacuous: ids.length === 0 };
  });
  const out = pairs.map(([a, b]) => {
    const diff = Math.abs((cells.find((c) => c.cell === a)?.m ?? 0) - (cells.find((c) => c.cell === b)?.m ?? 0));
    return { a, b, diff, pass: diff <= margin + 1e-12 };
  });
  const withIds = cells.filter((c) => c.identities > 0);
  const families = [...new Set(withIds.flatMap((c) => Object.keys(c.shares)))];
  const dominant = families.find((f) => withIds.length > 0 && withIds.every((c) => (c.shares[f] ?? 0) >= CONCENTRATION_SHARE)) ?? null;
  return { cells, pairs: out, pass: out.every((p) => p.pass), uninformative: dominant !== null, dominantFamily: dominant };
}

export interface RecallSite { readonly cell: Cell; readonly snapshotId: string; readonly file: string; readonly detected: boolean; readonly exempt: boolean }
export interface PartB {
  readonly cells: readonly { readonly cell: Cell; readonly detected: number; readonly evaluated: number; readonly rate: number | null; readonly exemptSites: number; readonly allSites: number; readonly exemptShare: number | null }[];
  readonly pairs: readonly { readonly a: Cell; readonly b: Cell; readonly diff: number | null; readonly interval: Interval | null; readonly coversZero: boolean; readonly pass: boolean }[];
  readonly pass: boolean;
}

/**
 * ADR-V14-04 §4 part B, as amended (finding 5): seeded recall of the firing blocking operator on NON-EXEMPT sites per
 * cell; per pair, the snapshot-clustered bootstrap interval of the rate difference covers 0 and |difference| ≤ 0.10.
 * The exempt-site share is reported beside it.
 */
export function partB(sites: readonly RecallSite[], pairs: readonly (readonly [Cell, Cell])[], seed = ANALYSIS_SEED, resamples = BOOT_RESAMPLES, margin = V4_B_MARGIN): PartB {
  const cells = CELLS.map((cell) => {
    const all = sites.filter((s) => s.cell === cell);
    const ne = all.filter((s) => !s.exempt);
    const k = ne.filter((s) => s.detected).length;
    return { cell, detected: k, evaluated: ne.length, rate: ne.length === 0 ? null : k / ne.length, exemptSites: all.length - ne.length, allSites: all.length, exemptShare: all.length === 0 ? null : (all.length - ne.length) / all.length };
  });
  const clustersOf = (cell: Cell): RecallSite[][] => {
    const ne = sites.filter((s) => s.cell === cell && !s.exempt);
    return [...new Set(ne.map((s) => s.snapshotId))].sort().map((id) => ne.filter((s) => s.snapshotId === id));
  };
  const rate = (cs: readonly (readonly RecallSite[])[]): number => {
    const f = cs.flat();
    return f.length === 0 ? Number.NaN : f.filter((s) => s.detected).length / f.length;
  };
  const out = pairs.map(([a, b], i) => {
    const ca = clustersOf(a);
    const cb = clustersOf(b);
    if (ca.length === 0 || cb.length === 0) return { a, b, diff: null, interval: null, coversZero: false, pass: false };
    const rng = createRng(seed + i);
    const vals: number[] = [];
    for (let r = 0; r < resamples; r++) {
      const sa = ca.map(() => ca[rng.int(ca.length)] as RecallSite[]);
      const sb = cb.map(() => cb[rng.int(cb.length)] as RecallSite[]);
      const v = rate(sa) - rate(sb);
      if (Number.isFinite(v)) vals.push(v);
    }
    vals.sort((x, y) => x - y);
    const diff = rate(ca) - rate(cb);
    const interval = { low: quantileSorted(vals, 0.025), high: quantileSorted(vals, 0.975) };
    const coversZero = interval.low <= 1e-12 && interval.high >= -1e-12;
    return { a, b, diff, interval, coversZero, pass: coversZero && Math.abs(diff) <= margin + 1e-12 };
  });
  return { cells, pairs: out, pass: out.every((p) => p.pass) };
}

// ── sensitivity helpers ──────────────────────────────────────────────────────

/** Run-index halves: replicates 1..⌈R/2⌉ and the rest (finding 4 time sensitivity). */
export function halves(blocks: readonly Block[]): { readonly first: Block[]; readonly second: Block[]; readonly cut: number } {
  const reps = [...new Set(blocks.map((b) => b.rep))].sort((a, b) => a - b);
  const cut = reps[Math.ceil(reps.length / 2) - 1] ?? 0;
  return { first: blocks.filter((b) => b.rep <= cut), second: blocks.filter((b) => b.rep > cut), cut };
}

// ── planted effect (D9) ──────────────────────────────────────────────────────

/**
 * A synthetic 2b-shaped data set for D9: `tasks` × `reps` blocks; none@L2 D and Y₁ are drawn (with replacement, seeded)
 * from the given pilot blocks; each treated cell keeps every none@L2 identity with probability `keep` (binomial
 * thinning: RR ≈ keep). `keep = 1` with independent redraws is the null check.
 */
export function plantedBlocks(pilot: readonly { readonly D: number; readonly Y1: number }[], opts: { readonly tasks: number; readonly reps: number; readonly keep: Readonly<Record<'none@L3' | 'mcp@L2', number>>; readonly nullRedraw?: boolean; readonly seed?: number }): Block[] {
  const rng = mulberry32(opts.seed ?? ANALYSIS_SEED);
  const pick = (): { D: number; Y1: number } => pilot[Math.floor(rng.next() * pilot.length)] as { D: number; Y1: number };
  const thin = (d: number, p: number): number => {
    let k = 0;
    for (let i = 0; i < d; i++) if (rng.next() < p) k++;
    return k;
  };
  const out: Block[] = [];
  for (let r = 1; r <= opts.reps; r++) {
    for (let t = 1; t <= opts.tasks; t++) {
      const base = pick();
      const l3 = opts.nullRedraw === true ? pick().D : thin(base.D, opts.keep['none@L3']);
      const mcp = opts.nullRedraw === true ? pick().D : thin(base.D, opts.keep['mcp@L2']);
      out.push({ block: `planted-task-${String(t)}/rep${String(r)}`, task: `planted-task-${String(t)}`, rep: r, Y1: base.Y1, D: { 'none@L2': base.D, 'none@L3': l3, 'mcp@L2': mcp }, Yk: { 'none@L2': null, 'none@L3': null, 'mcp@L2': null } });
    }
  }
  return out;
}
