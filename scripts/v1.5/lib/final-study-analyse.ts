/**
 * v1.5 final study analysis (pre-registration `Docs/v1.5/final-study-preregistration.md` §4). Pure functions, zero
 * calls. The tests and intervals are Study 2b's (`scripts/v1.4/lib/study2b-analyse.ts`), re-keyed from 2b's three
 * cells to the two arms `none` and `combined`, per style, with Holm over {H1, H2}.
 */
import { mulberry32 } from '../../lib/mutation/rng';
import { wilson } from '../../lib/stats';
import type { BootstrapResult, Interval } from '../../lib/stats';
import { mcSignFlipP, signedRankP, signTestP, taskClusterBootstrap, withinTaskBootstrap } from '../../v1.4/lib/study2b-analyse';
import { exactSignFlipP } from '../../v1.4/lib/study2b-power';

export const ANALYSIS_SEED = 20261029;
export const MC_DRAWS = 99_999;
export const BOOT_RESAMPLES = 10_000;
export const FWER = 0.05;
export const ARMS = ['none', 'combined'] as const;
export type Arm = (typeof ARMS)[number];
export type Style = 'ddd' | 'hexagonal';
export const HYPOTHESES: Readonly<Record<'H1' | 'H2', Style>> = { H1: 'ddd', H2: 'hexagonal' };

/** One scored cell: a task × replicate × arm session, all its steps scored (ITT). */
export interface Cell {
  readonly task: string;
  readonly style: Style;
  readonly rep: number;
  readonly arm: Arm;
  /** D_v15: new admitted-rule identities summed over the steps; null when a step is unscored. */
  readonly D: number | null;
  /** The oracle's trap sub-goal failed at the final step. */
  readonly trapFailed: boolean | null;
  /** The task tests pass at the final step. */
  readonly accepted: boolean | null;
  /** Integrity flag (combined arm): fail-open above 5 % or edit count ≠ hook count. */
  readonly flagged?: boolean;
}

/** A block: one task × replicate with both arms. */
export interface Block { readonly task: string; readonly style: Style; readonly rep: number; readonly none: Cell; readonly combined: Cell }

export function blocksOf(cells: readonly Cell[], style: Style): Block[] {
  const key = (c: Cell): string => `${c.task}#${String(c.rep)}`;
  const by = new Map<string, Partial<Record<Arm, Cell>>>();
  for (const c of cells) if (c.style === style) by.set(key(c), { ...(by.get(key(c)) ?? {}), [c.arm]: c });
  const out: Block[] = [];
  for (const [k, v] of [...by.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (v.none === undefined || v.combined === undefined) continue;
    if (v.none.D === null || v.combined.D === null) continue; // §5: both cells fully scored
    const [task, rep] = k.split('#');
    out.push({ task: task!, style, rep: Number(rep), none: v.none, combined: v.combined });
  }
  return out;
}

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
const mean = (xs: readonly number[]): number => (xs.length === 0 ? Number.NaN : sum(xs) / xs.length);

export interface ContrastResult {
  readonly id: 'H1' | 'H2';
  readonly style: Style;
  readonly blocks: number;
  readonly tasks: number;
  readonly T: number;
  readonly pExact: number;
  readonly pMc: number;
  readonly taskLevel: { readonly T: number; readonly pExact: number };
  readonly signedRankP: number;
  readonly signTest: { readonly positive: number; readonly negative: number; readonly p: number };
  readonly sumNone: number;
  readonly sumCombined: number;
  readonly rr: number | null;
  readonly dBar: number;
  readonly rrWithin: BootstrapResult | null;
  readonly rrCluster: BootstrapResult | null;
  readonly dBarWithin: BootstrapResult | null;
  readonly dBarCluster: BootstrapResult | null;
}

/** d_b = D(combined) − D(none): negative is the predicted direction. */
export const diffs = (bs: readonly Block[]): number[] => bs.map((b) => (b.combined.D ?? 0) - (b.none.D ?? 0));

export function taskSums(bs: readonly Block[]): number[] {
  const m = new Map<string, number>();
  for (const b of bs) m.set(b.task, (m.get(b.task) ?? 0) + (b.combined.D ?? 0) - (b.none.D ?? 0));
  return [...m.keys()].sort().map((k) => m.get(k)!);
}

export function analyse(id: 'H1' | 'H2', bs: readonly Block[], opts: { readonly seed?: number; readonly draws?: number; readonly resamples?: number } = {}): ContrastResult {
  const seed = opts.seed ?? ANALYSIS_SEED;
  const ds = diffs(bs);
  const ts = taskSums(bs);
  const sumNone = sum(bs.map((b) => b.none.D ?? 0));
  const sumCombined = sum(bs.map((b) => b.combined.D ?? 0));
  const items = bs.map((b) => ({ task: b.task, b }));
  const rrOf = (s: readonly { b: Block }[]): number => { const n = sum(s.map((x) => x.b.none.D ?? 0)); return n === 0 ? Number.NaN : sum(s.map((x) => x.b.combined.D ?? 0)) / n; };
  const dOf = (s: readonly { b: Block }[]): number => mean(s.map((x) => (x.b.combined.D ?? 0) - (x.b.none.D ?? 0)));
  const res = opts.resamples ?? BOOT_RESAMPLES;
  // Intervals need at least two tasks (a sensitivity subset can be smaller); the tests still run.
  const boot = ts.length >= 2;
  return {
    id, style: HYPOTHESES[id], blocks: bs.length, tasks: ts.length, T: sum(ds),
    pExact: exactSignFlipP(ds), pMc: mcSignFlipP(ds, opts.draws ?? MC_DRAWS, seed),
    taskLevel: { T: sum(ts), pExact: exactSignFlipP(ts) },
    signedRankP: signedRankP(ds), signTest: signTestP(ds),
    sumNone, sumCombined, rr: sumNone === 0 ? null : sumCombined / sumNone, dBar: mean(ds),
    rrWithin: sumNone === 0 || !boot ? null : withinTaskBootstrap(items, rrOf, seed, res),
    rrCluster: sumNone === 0 || !boot ? null : taskClusterBootstrap(items, rrOf, seed, res),
    dBarWithin: boot ? withinTaskBootstrap(items, dOf, seed, res) : null,
    dBarCluster: boot ? taskClusterBootstrap(items, dOf, seed, res) : null,
  };
}

export interface Decision { readonly id: 'H1' | 'H2'; readonly p: number; readonly alphaStep: number; readonly reject: boolean; readonly supported: boolean; readonly reading: string }

/** Holm over {H1, H2} on the exact p (§4); "supported" also needs the predicted sign and the task-level sign (§1). */
export function decide(results: readonly ContrastResult[], fwer = FWER): Decision[] {
  const order = [...results].sort((a, b) => a.pExact - b.pExact || (a.id < b.id ? -1 : 1));
  let stopped = false;
  const rows = order.map((r, rank) => {
    const alphaStep = fwer / (order.length - rank);
    const reject = !stopped && r.pExact <= alphaStep;
    if (!reject) stopped = true;
    const predicted = r.T < 0;
    const taskSame = Math.sign(r.taskLevel.T) === Math.sign(r.T) && r.taskLevel.T !== 0;
    const supported = reject && predicted && taskSame;
    const reading = !reject ? 'not rejected: no difference detected at the stated MDE'
      : !predicted ? 'rejected against the predicted direction'
      : taskSame ? 'supported' : 'carried by a subset of tasks';
    return { id: r.id, p: r.pExact, alphaStep, reject, supported, reading };
  });
  return results.map((r) => rows.find((x) => x.id === r.id)!);
}

export interface RateRow { readonly arm: Arm; readonly k: number; readonly n: number; readonly rate: number; readonly ci: Interval | null }

/** Secondary 1–2: a per-arm proportion with its Wilson interval. */
export function rate(cells: readonly Cell[], style: Style, pick: (c: Cell) => boolean | null): RateRow[] {
  return ARMS.map((arm) => {
    const xs = cells.filter((c) => c.style === style && c.arm === arm).map(pick).filter((x): x is boolean => x !== null);
    const k = xs.filter(Boolean).length;
    return { arm, k, n: xs.length, rate: xs.length === 0 ? Number.NaN : k / xs.length, ci: xs.length === 0 ? null : wilson(k, xs.length) };
  });
}

/** Paired exact sign test on a boolean outcome over blocks (secondary 1). */
export function pairedBooleanSign(bs: readonly Block[], pick: (c: Cell) => boolean | null): ReturnType<typeof signTestP> {
  const d = bs.flatMap((b) => { const x = pick(b.none); const y = pick(b.combined); return x === null || y === null ? [] : [Number(y) - Number(x)]; });
  return signTestP(d);
}

/** Registered sensitivities: drop blocks whose `none` cell did not fall into the trap; drop flagged blocks; run-order halves. */
export const dropNoTrap = (bs: readonly Block[]): Block[] => bs.filter((b) => b.none.trapFailed === true);
export const dropFlagged = (bs: readonly Block[]): Block[] => bs.filter((b) => !b.combined.flagged && !b.none.flagged);
export function halves(bs: readonly Block[]): { readonly first: Block[]; readonly second: Block[] } {
  const reps = [...new Set(bs.map((b) => b.rep))].sort((a, b) => a - b);
  const cut = reps[Math.floor((reps.length - 1) / 2)] ?? 0;
  return { first: bs.filter((b) => b.rep <= cut), second: bs.filter((b) => b.rep > cut) };
}

/**
 * Planted data for the pre-registration test: tasks × reps blocks per style; `none` D ~ count with P(violation) =
 * `trap` per step over `steps`; `combined` keeps each `none`-like violation with probability `keep` (RR ≈ keep).
 */
export function planted(opts: { readonly tasks: Readonly<Record<Style, number>>; readonly reps: number; readonly trap: number; readonly keep: number; readonly steps?: number; readonly seed?: number }): Cell[] {
  const rng = mulberry32(opts.seed ?? ANALYSIS_SEED);
  const steps = opts.steps ?? 3;
  const out: Cell[] = [];
  for (const style of ['ddd', 'hexagonal'] as const) {
    for (let t = 0; t < opts.tasks[style]; t++) {
      for (let r = 1; r <= opts.reps; r++) {
        for (const arm of ARMS) {
          let D = 0;
          for (let s = 0; s < steps; s++) if (rng.next() < opts.trap && (arm === 'none' || rng.next() < opts.keep)) D += 1;
          out.push({ task: `${style}-${String(t + 1).padStart(2, '0')}`, style, rep: r, arm, D, trapFailed: D > 0, accepted: true });
        }
      }
    }
  }
  return out;
}
