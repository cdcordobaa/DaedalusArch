/**
 * v1.5 Hexagonal study analysis (DRAFT pre-registration `Docs/v1.5/hexagonal-study-preregistration.md` §4). Pure
 * functions, zero calls. Adapted from the first study's `final-study-analyse.ts`: one style, one confirmatory
 * hypothesis (H-HX), so no Holm; the task-level check is the exact sign test over the nonzero task sums
 * (two-sided, smallest p = 2/2^n, so it needs n >= 6 tasks with a nonzero sum to reach 0.05).
 */
import { mulberry32 } from '../../lib/mutation/rng';
import type { BootstrapResult } from '../../lib/stats';
import { mcSignFlipP, signedRankP, signTestP, taskClusterBootstrap, withinTaskBootstrap } from '../../v1.4/lib/study2b-analyse';
import { exactSignFlipP } from '../../v1.4/lib/study2b-power';
import { ARMS, blocksOf, diffs, taskSums, type Block, type Cell } from './final-study-analyse';

export const HX_SEED = 20261030;
export const HX_MC_DRAWS = 99_999;
export const HX_BOOT_RESAMPLES = 10_000;
export const HX_ALPHA = 0.05;
/** The task-level sign test cannot reach HX_ALPHA with fewer nonzero task sums: 2/2^5 = 0.0625. */
export const MIN_NONZERO_TASKS = 6;

/** A Hexagonal study cell. `D` is the primary outcome (§1); `Dsem` the registered secondary (R-MIRROR-SEM, §1). */
export interface HxCell extends Cell { readonly Dsem?: number | null }

export const hxBlocks = (cells: readonly HxCell[]): Block[] => blocksOf(cells, 'hexagonal');

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
const mean = (xs: readonly number[]): number => (xs.length === 0 ? Number.NaN : sum(xs) / xs.length);

export interface HxResult {
  readonly blocks: number;
  readonly tasks: number;
  readonly T: number;
  readonly pExact: number;
  readonly pMc: number;
  readonly taskSums: readonly number[];
  readonly taskSign: { readonly positive: number; readonly negative: number; readonly nonzero: number; readonly p: number };
  readonly signedRankP: number;
  readonly blockSign: ReturnType<typeof signTestP>;
  readonly sumNone: number;
  readonly sumCombined: number;
  readonly rr: number | null;
  readonly dBar: number;
  readonly rrWithin: BootstrapResult | null;
  readonly rrCluster: BootstrapResult | null;
  readonly dBarWithin: BootstrapResult | null;
  readonly dBarCluster: BootstrapResult | null;
}

export interface HxOpts { readonly seed?: number; readonly draws?: number; readonly resamples?: number; readonly intervals?: boolean }

export function analyseHx(bs: readonly Block[], opts: HxOpts = {}): HxResult {
  const seed = opts.seed ?? HX_SEED;
  const ds = diffs(bs);
  const ts = taskSums(bs);
  const st = signTestP(ts);
  const sumNone = sum(bs.map((b) => b.none.D ?? 0));
  const sumCombined = sum(bs.map((b) => b.combined.D ?? 0));
  const items = bs.map((b) => ({ task: b.task, b }));
  const rrOf = (s: readonly { b: Block }[]): number => { const n = sum(s.map((x) => x.b.none.D ?? 0)); return n === 0 ? Number.NaN : sum(s.map((x) => x.b.combined.D ?? 0)) / n; };
  const dOf = (s: readonly { b: Block }[]): number => mean(s.map((x) => (x.b.combined.D ?? 0) - (x.b.none.D ?? 0)));
  const res = opts.resamples ?? HX_BOOT_RESAMPLES;
  const boot = (opts.intervals ?? true) && ts.length >= 2;
  return {
    blocks: bs.length, tasks: ts.length, T: sum(ds),
    pExact: exactSignFlipP(ds), pMc: opts.draws === 0 ? Number.NaN : mcSignFlipP(ds, opts.draws ?? HX_MC_DRAWS, seed),
    taskSums: ts, taskSign: { positive: st.positive, negative: st.negative, nonzero: st.positive + st.negative, p: st.p },
    signedRankP: signedRankP(ds), blockSign: signTestP(ds),
    sumNone, sumCombined, rr: sumNone === 0 ? null : sumCombined / sumNone, dBar: mean(ds),
    rrWithin: sumNone === 0 || !boot ? null : withinTaskBootstrap(items, rrOf, seed, res),
    rrCluster: sumNone === 0 || !boot ? null : taskClusterBootstrap(items, rrOf, seed, res),
    dBarWithin: boot ? withinTaskBootstrap(items, dOf, seed, res) : null,
    dBarCluster: boot ? taskClusterBootstrap(items, dOf, seed, res) : null,
  };
}

export interface HxDecision { readonly reject: boolean; readonly predicted: boolean; readonly taskCheck: boolean; readonly supported: boolean; readonly reading: string }

/**
 * §1 decision. Supported iff (a) block-level exact two-sided sign-flip p <= 0.05, (b) T < 0, and (c) the task-level
 * exact sign test over nonzero task sums has p <= 0.05 with more negative than positive sums (needs >= 6 nonzero).
 */
export function decideHx(r: HxResult, alpha = HX_ALPHA): HxDecision {
  const reject = r.pExact <= alpha;
  const predicted = r.T < 0;
  const taskCheck = r.taskSign.nonzero >= MIN_NONZERO_TASKS && r.taskSign.p <= alpha && r.taskSign.negative > r.taskSign.positive;
  const supported = reject && predicted && taskCheck;
  const reading = !reject ? 'not rejected: no difference detected at the stated MDE'
    : !predicted ? 'rejected against the predicted direction'
    : taskCheck ? 'supported'
    : r.taskSign.nonzero < MIN_NONZERO_TASKS ? `carried by a subset of tasks (only ${String(r.taskSign.nonzero)} tasks with a nonzero sum)`
    : 'carried by a subset of tasks';
  return { reject, predicted, taskCheck, supported, reading };
}

/**
 * Sensitivity (§4): drop the tasks with no oracle trap failure in any cell of either arm. The selection is a symmetric
 * function of both arms, so arm labels stay exchangeable within a block and the sign-flip stays valid under the null.
 * (The first study's `dropNoTrap` keeps blocks whose `none` cell trapped: that conditions on one arm's outcome and is
 * biased toward the predicted sign under the null; see the planted null in §9.)
 */
export function dropTasksWithoutTrap(bs: readonly Block[]): Block[] {
  const trapped = new Set(bs.filter((b) => b.none.trapFailed === true || b.combined.trapFailed === true).map((b) => b.task));
  return bs.filter((b) => trapped.has(b.task));
}

/**
 * §1 joint reading (evasion guard). Secondary 1's paired exact sign test on trap failure (combined − none per block)
 * moves with D when it is significant in the predicted direction: p <= 0.05 and more blocks lose the trap under
 * `combined` than gain it. A "supported" H-HX without that is qualified: "rule findings reduced, trap rate not".
 * (Direction alone is not enough: on planted data whose trap rate does not change it goes either way by chance.)
 */
export function jointReading(d: HxDecision, trapSign: { readonly positive: number; readonly negative: number; readonly p: number }, alpha = HX_ALPHA): { readonly reading: string; readonly trapSameDirection: boolean } {
  const same = trapSign.negative > trapSign.positive && trapSign.p <= alpha;
  return { reading: d.supported && !same ? 'supported, qualified: rule findings reduced, trap rate not' : d.reading, trapSameDirection: same };
}

/** §1 per-block table: did D fall (d_b < 0), and did the `combined` cell still fail a trap at its final step? */
export function jointTable(bs: readonly Block[]): { readonly dFellTrapPersisted: number; readonly dFellTrapGone: number; readonly dNotFellTrapPersisted: number; readonly dNotFellTrapGone: number; readonly unknownTrap: number; readonly rows: readonly { task: string; rep: number; d: number; combinedTrapFailed: boolean | null }[] } {
  const rows = bs.map((b) => ({ task: b.task, rep: b.rep, d: (b.combined.D ?? 0) - (b.none.D ?? 0), combinedTrapFailed: b.combined.trapFailed }));
  const n = (fell: boolean, persisted: boolean): number => rows.filter((r) => r.combinedTrapFailed !== null && (r.d < 0) === fell && r.combinedTrapFailed === persisted).length;
  return { dFellTrapPersisted: n(true, true), dFellTrapGone: n(true, false), dNotFellTrapPersisted: n(false, true), dNotFellTrapGone: n(false, false), unknownTrap: rows.filter((r) => r.combinedTrapFailed === null).length, rows };
}

/** The registered secondary on R-MIRROR-SEM identities (no decision weight): the same block test on `Dsem`. */
export function semSecondary(cells: readonly HxCell[]): { readonly blocks: number; readonly T: number; readonly pExact: number; readonly sumNone: number; readonly sumCombined: number } {
  const semCells: Cell[] = cells.map((c) => ({ ...c, D: c.Dsem === undefined ? null : c.Dsem }));
  const bs = hxBlocks(semCells);
  const ds = diffs(bs);
  return { blocks: bs.length, T: sum(ds), pExact: exactSignFlipP(ds), sumNone: sum(bs.map((b) => b.none.D ?? 0)), sumCombined: sum(bs.map((b) => b.combined.D ?? 0)) };
}

/**
 * Planted data (power and the registration test). Each task t has a per-cell trap probability `pTrap[t]`; a trapped
 * cell is seen by the counted rules with probability `detect`; a seen `none` cell has `ids` new identities; in a seen
 * `combined` cell each identity is kept with probability `keep` (so RR ≈ keep). Arms draw independently.
 */
export interface PlantedHx { readonly pTrap: readonly number[]; readonly reps: number; readonly keep: number; readonly detect?: number; readonly ids?: number; readonly seed?: number }

export function plantedHx(o: PlantedHx): HxCell[] {
  const rng = mulberry32(o.seed ?? HX_SEED);
  const detect = o.detect ?? 1;
  const ids = o.ids ?? 1;
  const out: HxCell[] = [];
  o.pTrap.forEach((p, t) => {
    for (let r = 1; r <= o.reps; r++) {
      for (const arm of ARMS) {
        const trapped = rng.next() < p;
        const seen = trapped && rng.next() < detect;
        let D = 0;
        if (seen) for (let i = 0; i < ids; i++) if (arm === 'none' || rng.next() < o.keep) D += 1;
        out.push({ task: `hx-${String(t + 1).padStart(2, '0')}`, style: 'hexagonal', rep: r, arm, D, trapFailed: trapped, accepted: true, Dsem: 0 });
      }
    }
  });
  return out;
}

/** Share of `draws` planted data sets on which §1 reads "supported". Intervals are skipped (they do not decide). */
export function powerHx(o: Omit<PlantedHx, 'seed'> & { readonly draws: number; readonly seed?: number }): { readonly power: number; readonly rejectShare: number; readonly medianNonzeroTasks: number } {
  const base = o.seed ?? HX_SEED;
  let sup = 0;
  let rej = 0;
  const nz: number[] = [];
  for (let i = 0; i < o.draws; i++) {
    const r = analyseHx(hxBlocks(plantedHx({ ...o, seed: (base + i * 7919) >>> 0 })), { draws: 0, intervals: false });
    const d = decideHx(r);
    if (d.supported) sup += 1;
    if (d.reject && d.predicted) rej += 1;
    nz.push(r.taskSign.nonzero);
  }
  nz.sort((a, b) => a - b);
  return { power: sup / o.draws, rejectShare: rej / o.draws, medianNonzeroTasks: nz[Math.floor(nz.length / 2)] ?? 0 };
}

/**
 * §3 re-size rule, fixed before the pilot: from the pilot's `none` cells (2 runs per task), each task's chance of a
 * cell with D > 0 is the Jeffreys posterior mean (k + 0.5) / (n + 1); `ids` is the mean D of the `none` cells with
 * D > 0 (rounded, at least 1); detection is already inside D, so `detect` = 1. r is the smallest of `ladder` whose
 * power at RR 0.25 is >= `target`, else the largest, with its achieved power stated.
 */
export function sizeFromPilot(pilotNone: readonly HxCell[], o: { readonly ladder?: readonly number[]; readonly target?: number; readonly draws?: number } = {}): { readonly pTrap: readonly number[]; readonly ids: number; readonly r: number; readonly power: number; readonly reached: boolean; readonly table: readonly { r: number; power: number }[] } {
  const ladder = o.ladder ?? [6, 8, 10];
  const target = o.target ?? 0.8;
  const none = pilotNone.filter((c) => c.arm === 'none' && c.D !== null);
  const tasks = [...new Set(none.map((c) => c.task))].sort();
  const pTrap = tasks.map((t) => {
    const xs = none.filter((c) => c.task === t);
    return (xs.filter((c) => (c.D ?? 0) > 0).length + 0.5) / (xs.length + 1);
  });
  const pos = none.filter((c) => (c.D ?? 0) > 0).map((c) => c.D ?? 0);
  const ids = Math.max(1, Math.round(pos.length === 0 ? 1 : sum(pos) / pos.length));
  const table = ladder.map((r) => ({ r, power: powerHx({ pTrap, reps: r, keep: 0.25, detect: 1, ids, draws: o.draws ?? 400 }).power }));
  const hit = table.find((x) => x.power >= target);
  const pick = hit ?? table[table.length - 1]!;
  return { pTrap, ids, r: pick.r, power: pick.power, reached: hit !== undefined, table };
}
