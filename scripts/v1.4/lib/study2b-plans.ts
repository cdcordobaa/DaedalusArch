/**
 * Study 2b plan filling (runbook `Docs/v1.4/study2b-runbook.md`): turns the three templates of `experiments/study2b/`
 * into runnable loop plans for one tasks file and one replicate count, without any task id or text leaving the process.
 *
 * Placeholders a template may hold, and what fills them:
 * - `tasksFile: "<tasks>"`: the absolute tasks file path given at run time (for 2b, the sealed one);
 * - `taskProfiles: { "<every-task>": profile }`: one copy of the profile per task id of that file;
 * - `runs`: the replicate count R; `sharedStart.fromOutRoot`: R `"<local>"` entries (filled by `--shared-start-from`);
 * - `acceptance.testsRoot: "<acceptance-root>"`: the absolute acceptance root, or the block is dropped (`acceptanceRoot: null`);
 * - `"<daedalus-build>"` at the start of a `daedalus` path: the absolute MCP build directory;
 * - `callBudget`: recomputed with the harness's own `planCallBudget`, so it equals what `loadLoopPlan` checks.
 * The filled plan is then checked with the harness's `validatePlan` and `checkPlanAgainstTasks`; their messages are
 * returned with every task id replaced by `<task-N>`, so a caller can print them for a sealed tasks file.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { checkPlanAgainstTasks, LOCAL, planCallBudget, validatePlan, validateTasks } from '../../lib/loop/plan.js';
import type { CallBudget, LoopPlanFile } from '../../lib/loop/plan.js';
import type { LoopTasksFile } from '../../lib/loop/types.js';

export const STUDY2B_TEMPLATES = ['plan-none-L2', 'plan-none-L3', 'plan-mcp-L2'] as const;
export type Study2bTemplate = (typeof STUDY2B_TEMPLATES)[number];
export const EVERY_TASK = '<every-task>';
export const TASKS_HOLE = '<tasks>';
export const ACCEPTANCE_HOLE = '<acceptance-root>';
export const DAEDALUS_HOLE = '<daedalus-build>';
export const DEFAULT_REPLICATES = 2;

export interface FillOptions {
  /** Absolute tasks file path, written into the plan. */
  readonly tasksPath: string;
  readonly replicates: number;
  /** Absolute acceptance root, or null to drop the acceptance block. */
  readonly acceptanceRoot: string | null;
  /** Absolute MCP build directory (needed only by a template with a `daedalus` block). */
  readonly daedalusBuild: string | null;
}

export interface FilledPlan {
  readonly plan: Record<string, unknown>;
  readonly budget: CallBudget;
  /** Harness validation messages, task ids redacted. Empty = the harness accepts the plan for these tasks. */
  readonly problems: readonly string[];
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Replaces each task id in a message by `<task-N>` (longest id first, so no id is a prefix of a replaced one). */
export function redactTaskIds(message: string, ids: readonly string[]): string {
  const order = ids.map((id, i) => ({ id, i })).sort((a, b) => b.id.length - a.id.length);
  return order.reduce((m, { id, i }) => m.split(id).join(`<task-${String(i + 1)}>`), message);
}

/** Parses a tasks file's bytes; the errors are redacted. */
export function parseTasks(bytes: Buffer): { readonly tasks: LoopTasksFile | null; readonly sha256: string; readonly problems: readonly string[] } {
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  let raw: unknown;
  try {
    raw = JSON.parse(bytes.toString('utf8'));
  } catch {
    return { tasks: null, sha256, problems: ['the tasks file is not JSON'] };
  }
  const ids = isRecord(raw) && Array.isArray(raw.tasks) ? raw.tasks.flatMap((t) => (isRecord(t) && typeof t.id === 'string' ? [t.id] : [])) : [];
  const v = validateTasks(raw);
  if (!v.success) return { tasks: null, sha256, problems: v.errors.map((e) => `${e.code}: ${redactTaskIds(e.message, ids)}`) };
  return { tasks: v.data, sha256, problems: [] };
}

/** Fills one template for a tasks file and a replicate count. */
export function fillTemplate(template: unknown, tasks: LoopTasksFile, opts: FillOptions): FilledPlan {
  if (!isRecord(template)) return { plan: {}, budget: { runs: 0, stepTurns: 0, maxRepairTurns: 0, maxCalls: 0 }, problems: ['the template is not a JSON object'] };
  if (!Number.isInteger(opts.replicates) || opts.replicates < 1) throw new Error('replicates must be a positive integer');
  const ids = tasks.tasks.map((t) => t.id);
  const problems: string[] = [];
  const plan: Record<string, unknown> = { ...template };
  if (plan.tasksFile !== TASKS_HOLE) problems.push(`tasksFile must be "${TASKS_HOLE}" in a template`);
  plan.tasksFile = opts.tasksPath;
  plan.runs = opts.replicates;
  const profiles = plan.taskProfiles;
  if (!isRecord(profiles) || Object.keys(profiles).length !== 1 || profiles[EVERY_TASK] === undefined) {
    problems.push(`taskProfiles must be { "${EVERY_TASK}": profile } in a template`);
  } else {
    plan.taskProfiles = Object.fromEntries(ids.map((id) => [id, profiles[EVERY_TASK]]));
  }
  if (isRecord(plan.sharedStart)) {
    plan.sharedStart = { ...plan.sharedStart, fromOutRoot: Array.from({ length: opts.replicates }, () => LOCAL) };
  }
  if (isRecord(plan.acceptance)) {
    if (opts.acceptanceRoot === null) delete plan.acceptance;
    else {
      if (plan.acceptance.testsRoot !== ACCEPTANCE_HOLE) problems.push(`acceptance.testsRoot must be "${ACCEPTANCE_HOLE}" in a template`);
      plan.acceptance = { ...plan.acceptance, testsRoot: opts.acceptanceRoot };
    }
  }
  if (isRecord(plan.daedalus)) {
    if (opts.daedalusBuild === null) problems.push('this template has a daedalus block: give the MCP build directory');
    else {
      const build = opts.daedalusBuild;
      plan.daedalus = Object.fromEntries(
        Object.entries(plan.daedalus).map(([k, v]) => [k, typeof v === 'string' && v.startsWith(`${DAEDALUS_HOLE}/`) ? path.join(build, v.slice(DAEDALUS_HOLE.length + 1)) : v]),
      );
    }
  }
  const budget = planCallBudget(plan as unknown as LoopPlanFile, tasks.tasks);
  plan.callBudget = budget;
  // The harness's own checks, with placeholder roots (the out-root and binary come from the CLI flags at run time).
  const probe: Record<string, unknown> = { ...plan, outRoot: '/study2b-probe/out', binary: '/study2b-probe/claude', harnessRoot: '/study2b-probe/h' };
  if (isRecord(probe.sharedStart)) probe.sharedStart = { ...probe.sharedStart, fromOutRoot: Array.from({ length: opts.replicates }, (_, i) => `/study2b-probe/src-${String(i)}`) };
  const v = validatePlan(probe);
  if (!v.success) problems.push(...v.errors.map((e) => `${e.code}: ${e.message}`));
  else problems.push(...checkPlanAgainstTasks(v.data, tasks).map((e) => `${e.code}: ${e.message}`));
  return { plan, budget, problems: problems.map((p) => redactTaskIds(p, ids)) };
}

/** Structural check of an acceptance root: how many `<root>/<task>/step-NN.test.mjs` exist. Counts only. */
export function acceptanceCoverage(root: string, tasks: LoopTasksFile): { readonly expected: number; readonly present: number; readonly tasksComplete: number; readonly tasks: number } {
  let present = 0;
  let complete = 0;
  let expected = 0;
  for (const t of tasks.tasks) {
    let here = 0;
    for (let k = 1; k <= t.steps.length; k++) {
      expected++;
      if (fs.existsSync(path.join(root, t.id, `step-${String(k).padStart(2, '0')}.test.mjs`))) here++;
    }
    present += here;
    if (here === t.steps.length) complete++;
  }
  return { expected, present, tasksComplete: complete, tasks: tasks.tasks.length };
}

/** How many tasks carry an acceptance start block (counts only). */
export function acceptanceStartBlocks(tasks: LoopTasksFile): { readonly tasks: number; readonly startCommand: number; readonly buildCommand: number } {
  return {
    tasks: tasks.tasks.length,
    startCommand: tasks.tasks.filter((t) => t.acceptance?.startCommand !== undefined).length,
    buildCommand: tasks.tasks.filter((t) => t.acceptance?.buildCommand !== undefined).length,
  };
}

/** Calls of the 2b grid for R replicates and n tasks of k steps: step 1 is nR; each cell's steps 2..k are nR(k-1). */
export function study2bCalls(replicates: number, tasks = 4, steps = 5): { readonly step1: number; readonly noneL2Steps2toK: number; readonly perBranchCell: number; readonly total: number } {
  const step1 = tasks * replicates;
  const perBranchCell = tasks * replicates * (steps - 1);
  return { step1, noneL2Steps2toK: perBranchCell, perBranchCell, total: step1 + 3 * perBranchCell };
}
