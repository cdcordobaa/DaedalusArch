/**
 * v1.5 final study: the run plan (pure, zero calls). Design: `ops/notes/v15-combined-delivery-design-2026-10-26.md`
 * §3 (arms `none` vs `combined`), §7 steps 5–10.
 *
 * Cells are task × arm × replicate. One session per cell runs all of the task's steps in order from the task seed
 * (no shared step 1: the seeds are fixed). Order: replicate round by replicate round (run-order decay control: every
 * task and arm is covered once before the next round starts); inside a round the task × arm cells are shuffled with
 * mulberry32 (the harness's generator), one stream seeded once with the order seed, so the plan is a pure function of
 * (tasks, arms, replicates, orderSeed).
 *
 * Caps: the planned turns are the sum of the cells' steps; the sessions cap is planned × 1.06 (rounded up). The
 * margin above the plan is for infrastructure redraws only; a session is never redrawn on agent behaviour.
 */
import { mulberry32 } from '../../puzzle-01-baseline/run-baseline.js';

export type Arm = 'none' | 'combined';
export const ARMS: readonly Arm[] = Object.freeze(['none', 'combined']);
export const ORDER_SEED = 20261029;
export const DEFAULT_REPLICATES = 3;
export const REDRAW_MARGIN = 1.06;

export interface PlanTask { readonly id: string; readonly steps: number }
export interface PlanInput { readonly tasks: readonly PlanTask[]; readonly arms: readonly Arm[]; readonly replicates: number; readonly orderSeed: number }
export interface PlannedSession {
  /** Neutral id (`c001`, …), in run order. */
  readonly id: string;
  readonly taskId: string;
  readonly arm: Arm;
  /** 0-based replicate round. */
  readonly rep: number;
  /** Number of steps (turns) the session runs, all of the task's, from the seed. */
  readonly steps: number;
}

function shuffleWith<T>(items: readonly T[], rnd: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

export function buildPlan(input: PlanInput): PlannedSession[] {
  if (!Number.isInteger(input.replicates) || input.replicates < 1) throw new Error(`replicates must be a positive integer, got ${String(input.replicates)}`);
  const ids = new Set(input.tasks.map((t) => t.id));
  if (ids.size !== input.tasks.length) throw new Error('duplicate task ids');
  const rnd = mulberry32(input.orderSeed);
  const cells: Omit<PlannedSession, 'id'>[] = [];
  for (let rep = 0; rep < input.replicates; rep++) {
    const round = input.tasks.flatMap((t) => input.arms.map((arm) => ({ taskId: t.id, arm, rep, steps: t.steps })));
    cells.push(...shuffleWith(round, rnd));
  }
  const width = Math.max(3, String(cells.length).length);
  return cells.map((c, i) => ({ id: `c${String(i + 1).padStart(width, '0')}`, ...c }));
}

export const plannedTurns = (plan: readonly PlannedSession[]): number => plan.reduce((n, s) => n + s.steps, 0);

export interface Caps { readonly smoke: number; readonly probes: number; readonly sessions: number; readonly total: number }

/** Smoke: 1 call per arm. Probes: the one READ probe. Sessions: planned turns × 1.06, rounded up. */
export function capsFor(plan: readonly PlannedSession[], arms: readonly Arm[]): Caps {
  const sessions = Math.ceil(plannedTurns(plan) * REDRAW_MARGIN);
  const smoke = arms.length;
  const probes = 1;
  return { smoke, probes, sessions, total: smoke + probes + sessions };
}

/** Whether a whole-session redraw of `steps` turns still fits the sessions cap, given the calls used so far. */
export function redrawFits(sessionCallsUsed: number, plannedRemaining: number, steps: number, caps: Pick<Caps, 'sessions'>): boolean {
  return sessionCallsUsed + plannedRemaining + steps <= caps.sessions;
}
