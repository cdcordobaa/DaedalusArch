/**
 * Plan and tasks files of the multi-step loop, and the run schedule.
 *
 * The plan names the adapters (pinned model ids), the arms, the runs, the seed, the roots and the tasks file. The
 * tasks file holds the loop tasks (each a list of feature steps). The repository ships only a made-up demo tasks file
 * (`experiments/loop-demo/`); the study tasks are sealed elsewhere and are supplied at run time.
 *
 * Schedule: for each run index r, for each adapter, for each task, one block holding every arm, the arms in an order
 * drawn from `orderSeed` with mulberry32 (one generator consumed block by block, as BR-U5a-51), so drift during a
 * session window hits every arm of a block alike.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { DomainError } from '../../../src/shared/errors/domain-result.js';
import { mulberry32 } from '../mutation/rng.js';
import type { DaedalusServerInput } from '../generators/arms.js';
import type { CodexPlanBlock } from '../generators/schedule.js';
import { GENERATOR_ADAPTER_IDS } from '../generators/types.js';
import type { GeneratorAdapterId } from '../generators/types.js';
import { LOOP_ARMS } from './types.js';
import type { LoopArm, LoopRunSpec, LoopTask, LoopTasksFile } from './types.js';

export interface LoopPlanFile {
  readonly description: string;
  /** Repository-relative or absolute path of the tasks file. */
  readonly tasksFile: string;
  readonly adapters: readonly { readonly adapterId: GeneratorAdapterId; readonly modelId: string }[];
  readonly arms: readonly LoopArm[];
  readonly runs: number;
  readonly orderSeed: number;
  /** Absolute; outside the repository. Holds `runs/`, `interruptions/` and `schedule.json`. */
  readonly outRoot: string;
  /** Absolute claude CLI path (or codex for a Codex-only plan); `"<local>"` filled from `--binary`. */
  readonly binary: string;
  /** `<H>`; `"<local>"` filled from `--harness-root`. */
  readonly harnessRoot: string;
  readonly allowBash: boolean;
  readonly timeoutMs?: number;
  readonly codex?: CodexPlanBlock;
  /** The DaedalusArch MCP server of the `daedalus-mcp` arm (absolute paths, outside every cwd). */
  readonly daedalus?: DaedalusServerInput;
  /** Spec the firewall evaluates each snapshot against (repository-relative or absolute). */
  readonly evaluatorSpec: string;
  /** Recorded for a judge-mode evaluator (the symbolic evaluator makes no model call). */
  readonly cassette?: { readonly dir: string; readonly mode: 'record' | 'replay' };
}

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
export const LOCAL = '<local>';

function err(code: string, message: string): DomainError {
  return { code, message };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function validateTasks(raw: unknown): DomainResult<LoopTasksFile> {
  if (!isRecord(raw) || !Array.isArray(raw.tasks) || typeof raw.description !== 'string') {
    return DomainResult.fail([err('LOOP_TASKS_INVALID', 'a tasks file is { description, tasks: [...] }')]);
  }
  const errors: DomainError[] = [];
  const ids = new Set<string>();
  const tasks: LoopTask[] = [];
  for (const t of raw.tasks as unknown[]) {
    if (!isRecord(t) || typeof t.id !== 'string' || typeof t.title !== 'string' || !Array.isArray(t.steps)) {
      errors.push(err('LOOP_TASKS_INVALID', 'a task is { id, title, steps: [{ id, request }] }'));
      continue;
    }
    if (!ID_RE.test(t.id) || ids.has(t.id)) errors.push(err('LOOP_TASKS_INVALID', `task id ${JSON.stringify(t.id)} is invalid or repeated`));
    ids.add(t.id);
    const stepIds = new Set<string>();
    const steps: { id: string; request: string }[] = [];
    for (const s of t.steps as unknown[]) {
      if (!isRecord(s) || typeof s.id !== 'string' || typeof s.request !== 'string' || s.request.trim() === '') {
        errors.push(err('LOOP_TASKS_INVALID', `task ${t.id}: a step is { id, request } with a non-empty request`));
        continue;
      }
      if (!ID_RE.test(s.id) || stepIds.has(s.id)) errors.push(err('LOOP_TASKS_INVALID', `task ${t.id}: step id ${JSON.stringify(s.id)} is invalid or repeated`));
      stepIds.add(s.id);
      steps.push({ id: s.id, request: s.request });
    }
    if (steps.length === 0) errors.push(err('LOOP_TASKS_INVALID', `task ${t.id} has no steps`));
    tasks.push({ id: t.id, title: t.title, steps });
  }
  if (tasks.length === 0) errors.push(err('LOOP_TASKS_INVALID', 'the tasks file lists no task'));
  return errors.length > 0 ? DomainResult.fail(errors) : DomainResult.ok({ description: raw.description, tasks });
}

export function validatePlan(raw: unknown): DomainResult<LoopPlanFile> {
  if (!isRecord(raw)) return DomainResult.fail([err('LOOP_PLAN_INVALID', 'the plan must be a JSON object')]);
  const errors: DomainError[] = [];
  const str = (k: string): void => {
    if (typeof raw[k] !== 'string' || raw[k] === '') errors.push(err('LOOP_PLAN_INVALID', `${k} must be a non-empty string`));
  };
  for (const k of ['description', 'tasksFile', 'outRoot', 'binary', 'harnessRoot', 'evaluatorSpec']) str(k);
  if (typeof raw.allowBash !== 'boolean') errors.push(err('LOOP_PLAN_INVALID', 'allowBash must be a boolean'));
  if (!Number.isInteger(raw.runs) || (raw.runs as number) < 1) errors.push(err('LOOP_PLAN_INVALID', 'runs must be a positive integer'));
  if (!Number.isInteger(raw.orderSeed) || (raw.orderSeed as number) < 0 || (raw.orderSeed as number) > 0xffffffff) {
    errors.push(err('LOOP_PLAN_INVALID', 'orderSeed must be a uint32'));
  }
  if (raw.timeoutMs !== undefined && (!Number.isInteger(raw.timeoutMs) || (raw.timeoutMs as number) <= 0)) {
    errors.push(err('LOOP_PLAN_INVALID', 'timeoutMs must be a positive integer'));
  }
  const arms = raw.arms;
  if (!Array.isArray(arms) || arms.length === 0 || !arms.every((a) => (LOOP_ARMS as readonly unknown[]).includes(a)) || new Set(arms).size !== arms.length) {
    errors.push(err('LOOP_PLAN_INVALID', `arms must be distinct values of ${LOOP_ARMS.join(', ')}`));
  }
  const adapters = raw.adapters;
  if (
    !Array.isArray(adapters) ||
    adapters.length === 0 ||
    !adapters.every((a) => isRecord(a) && GENERATOR_ADAPTER_IDS.includes(String(a.adapterId)) && typeof a.modelId === 'string' && MODEL_RE.test(a.modelId))
  ) {
    errors.push(err('LOOP_PLAN_INVALID', 'adapters must be [{ adapterId: claude-code-cli | codex-cli, modelId }]'));
  }
  if (Array.isArray(arms) && arms.includes('daedalus-mcp') && !isRecord(raw.daedalus)) {
    errors.push(err('LOOP_PLAN_INVALID', 'the daedalus-mcp arm needs a daedalus block { nodeBinary, serverEntry, specPath }'));
  }
  if (raw.cassette !== undefined && (!isRecord(raw.cassette) || typeof raw.cassette.dir !== 'string' || !['record', 'replay'].includes(String(raw.cassette.mode)))) {
    errors.push(err('LOOP_PLAN_INVALID', 'cassette must be { dir, mode: record | replay }'));
  }
  return errors.length > 0 ? DomainResult.fail(errors) : DomainResult.ok(raw as unknown as LoopPlanFile);
}

function readJson(file: string): DomainResult<unknown> {
  try {
    return DomainResult.ok(JSON.parse(fs.readFileSync(file, 'utf8')) as unknown);
  } catch (e) {
    return DomainResult.fail([err('LOOP_FILE_UNREADABLE', `${file}: ${e instanceof Error ? e.message : String(e)}`)]);
  }
}

export interface LocalOverrides {
  readonly binary?: string;
  readonly harnessRoot?: string;
  readonly outRoot?: string;
}

export interface LoadedPlan {
  readonly plan: LoopPlanFile;
  readonly tasks: LoopTasksFile;
  readonly tasksPath: string;
}

/** Loads the plan (with `"<local>"` fields filled from the overrides) and its tasks file. */
export function loadLoopPlan(planFile: string, repoRoot: string, local: LocalOverrides = {}): DomainResult<LoadedPlan> {
  const raw = readJson(planFile);
  if (!raw.success) return DomainResult.fail(raw.errors);
  const filled: Record<string, unknown> = isRecord(raw.data) ? { ...raw.data } : {};
  for (const k of ['binary', 'harnessRoot', 'outRoot'] as const) {
    const v = local[k];
    if (v !== undefined && (filled[k] === LOCAL || filled[k] === undefined)) filled[k] = v;
    else if (v !== undefined) return DomainResult.fail([err('LOOP_PLAN_INVALID', `--${k === 'harnessRoot' ? 'harness-root' : k === 'outRoot' ? 'out-root' : k} given but the plan pins ${k}`)]);
  }
  const plan = validatePlan(filled);
  if (!plan.success) return DomainResult.fail(plan.errors);
  const tasksPath = path.resolve(repoRoot, plan.data.tasksFile);
  const rawTasks = readJson(tasksPath);
  if (!rawTasks.success) return DomainResult.fail(rawTasks.errors);
  const tasks = validateTasks(rawTasks.data);
  if (!tasks.success) return DomainResult.fail(tasks.errors);
  return DomainResult.ok({ plan: plan.data, tasks: tasks.data, tasksPath });
}

/** `<adapterId>/<modelId>/<taskId>/<arm>/run-<r>`. */
export function loopRunId(spec: LoopRunSpec): string {
  return `${spec.adapterId}/${spec.modelId}/${spec.taskId}/${spec.arm}/run-${String(spec.runIndex)}`;
}

/** The seeded blocked order of every loop run (see the module header). */
export function scheduleLoopRuns(plan: Pick<LoopPlanFile, 'adapters' | 'arms' | 'runs' | 'orderSeed'>, tasks: readonly LoopTask[]): readonly LoopRunSpec[] {
  const rng = mulberry32(plan.orderSeed);
  const out: LoopRunSpec[] = [];
  for (let r = 0; r < plan.runs; r++) {
    for (const a of plan.adapters) {
      for (const t of tasks) {
        for (const arm of rng.pickDistinct(plan.arms, plan.arms.length)) {
          out.push({ adapterId: a.adapterId, modelId: a.modelId, taskId: t.id, arm, runIndex: r });
        }
      }
    }
  }
  return out;
}
