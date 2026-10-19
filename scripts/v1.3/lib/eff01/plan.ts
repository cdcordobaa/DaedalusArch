/**
 * EFF-01 session plan (design DR-1 to DR-4; A1 DR-A1-6: the count is unchanged).
 *
 * - Blocks: calibration (R, G on one repo, 2), pilot (Q02, Q06 × 2 repos × R, G, 8), main (20 × R, G × runs, 120 at 3
 *   runs), n (20 × N × 1). Total 150; `runs 2, no N` = 90; `runs 1, no N` = 50.
 * - The shuffle unit is the session. Main uses `createRng(seed)`, N `createRng(seed + 1)`.
 * - Lanes are dealt per condition after the shuffle (the i-th session of a condition goes to lane i mod 2), so each lane
 *   holds a balanced half overall and per condition. The deal does not depend on `--lanes`, so the plan does not either.
 * - Calibration and pilot run on lane 0, in order.
 */
import { createRng, shuffle } from '../../../lib/stats.js';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { Eff01Inputs } from './inputs.js';
import { DEFAULT_CALIBRATION_REPO, EFF01_BLOCKS, EFF01_SEED, PILOT_QUESTION_SUFFIXES } from './types.js';
import type { Eff01Block, Eff01Condition, SessionSpec } from './types.js';

export interface PlanOptions {
  readonly inputs: Pick<Eff01Inputs, 'questions' | 'repos'>;
  readonly runs?: number;
  readonly withN?: boolean;
  readonly calibrationRepo?: string;
  readonly seed?: number;
}

export interface Eff01Plan {
  readonly seed: number;
  readonly runs: number;
  readonly withN: boolean;
  readonly calibrationRepo: string;
  readonly sessions: readonly SessionSpec[];
}

export function sessionIdOf(block: Eff01Block, repoId: string, questionId: string | null, condition: Eff01Condition, run: number, rerun = false): string {
  return `${block}/${repoId}/${questionId ?? 'calib'}/${condition}/run-${String(run)}${rerun ? '-rerun' : ''}`;
}

type Draft = Omit<SessionSpec, 'lane' | 'orderIndex'>;

function draft(block: Eff01Block, repoId: string, questionId: string | null, condition: Eff01Condition, run: number): Draft {
  return { sessionId: sessionIdOf(block, repoId, questionId, condition, run), block, repoId, questionId, condition, run, rerun: false };
}

/** Lane = i mod 2 within each condition, in the given order (DR-4). */
function dealPerCondition(list: readonly Draft[]): (0 | 1)[] {
  const seen: Record<string, number> = {};
  return list.map((s) => {
    const i = seen[s.condition] ?? 0;
    seen[s.condition] = i + 1;
    return (i % 2) as 0 | 1;
  });
}

export function planSessions(opts: PlanOptions): DomainResult<Eff01Plan> {
  const runs = opts.runs ?? 3;
  const withN = opts.withN ?? true;
  const seed = opts.seed ?? EFF01_SEED;
  const calibrationRepo = opts.calibrationRepo ?? DEFAULT_CALIBRATION_REPO;
  if (!Number.isInteger(runs) || runs < 1 || runs > 3) return DomainResult.fail([{ code: 'EFF01_PLAN', message: '--runs must be 1, 2 or 3' }]);
  const repoIds = opts.inputs.repos.map((r) => r.id);
  if (!repoIds.includes(calibrationRepo)) return DomainResult.fail([{ code: 'EFF01_PLAN', message: `calibration repo ${calibrationRepo} is not in repos.json` }]);

  const calibration: Draft[] = (['R', 'G'] as const).map((c) => draft('calibration', calibrationRepo, null, c, 1));
  const pilot: Draft[] = [];
  for (const suffix of PILOT_QUESTION_SUFFIXES) {
    for (const repoId of repoIds) {
      const q = (opts.inputs.questions[repoId] ?? []).find((x) => x.id.endsWith(`-${suffix}`));
      if (q === undefined) return DomainResult.fail([{ code: 'EFF01_PLAN', message: `repo ${repoId} has no ${suffix} question for the pilot` }]);
      for (const c of ['R', 'G'] as const) pilot.push(draft('pilot', repoId, q.id, c, 1));
    }
  }
  const mainCells: Draft[] = [];
  const nCells: Draft[] = [];
  for (const repoId of repoIds) {
    for (const q of opts.inputs.questions[repoId] ?? []) {
      for (const c of ['R', 'G'] as const) for (let k = 1; k <= runs; k++) mainCells.push(draft('main', repoId, q.id, c, k));
      if (withN) nCells.push(draft('n', repoId, q.id, 'N', 1));
    }
  }
  const main = shuffle(mainCells, createRng(seed));
  const n = shuffle(nCells, createRng(seed + 1));

  const sessions: SessionSpec[] = [];
  const push = (list: readonly Draft[], lanes: readonly (0 | 1)[]): void => {
    list.forEach((d, i) => sessions.push({ ...d, lane: lanes[i] ?? 0, orderIndex: sessions.length }));
  };
  push(calibration, calibration.map(() => 0));
  push(pilot, pilot.map(() => 0));
  push(main, dealPerCondition(main));
  push(n, dealPerCondition(n));
  return DomainResult.ok({ seed, runs, withN, calibrationRepo, sessions });
}

export function sessionsOfBlocks(plan: Eff01Plan, blocks: readonly Eff01Block[]): readonly SessionSpec[] {
  return plan.sessions.filter((s) => blocks.includes(s.block));
}

/** Session counts per block and in total. */
export function countSessions(plan: Eff01Plan, blocks: readonly Eff01Block[] = EFF01_BLOCKS): Readonly<Record<Eff01Block | 'total', number>> {
  const out: Record<Eff01Block | 'total', number> = { calibration: 0, pilot: 0, main: 0, n: 0, total: 0 };
  for (const s of plan.sessions) {
    if (!blocks.includes(s.block)) continue;
    out[s.block] += 1;
    out.total += 1;
  }
  return out;
}

/** Facts fixed for the whole run that go into `plan.json` beside the sessions (nothing per invocation, DR-3). */
export interface PlanFacts {
  readonly model: string;
  readonly cliVersion: string;
  readonly caps: Readonly<Record<string, number>>;
  readonly hashes: Readonly<Record<string, string>>;
  readonly treeFingerprints: Readonly<Record<string, string>>;
  readonly stripSpecComments: boolean;
  readonly dryRun: boolean;
}

/** Deterministic `plan.json` text (DR-3, DR-28): fixed key order, no per-invocation facts. */
export function serialisePlan(plan: Eff01Plan, facts: PlanFacts): string {
  const sortObj = (o: Readonly<Record<string, unknown>>): Record<string, unknown> =>
    Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
  const body = {
    schema: 'eff-01-plan/v1',
    dryRun: facts.dryRun,
    seed: plan.seed,
    runs: plan.runs,
    withN: plan.withN,
    calibrationRepo: plan.calibrationRepo,
    model: facts.model,
    cliVersion: facts.cliVersion,
    caps: sortObj(facts.caps),
    stripSpecComments: facts.stripSpecComments,
    hashes: sortObj(facts.hashes),
    treeFingerprints: sortObj(facts.treeFingerprints),
    counts: countSessions(plan),
    sessions: plan.sessions.map((s) => ({
      sessionId: s.sessionId,
      block: s.block,
      repoId: s.repoId,
      questionId: s.questionId,
      condition: s.condition,
      run: s.run,
      lane: s.lane,
      orderIndex: s.orderIndex,
    })),
  };
  return `${JSON.stringify(body, null, 1)}\n`;
}
