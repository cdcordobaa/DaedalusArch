/**
 * Grid plan, schedule and output paths (FR-v1.2E-28; Q16; ADR-017 item 3; BR-U5a-51, 52).
 *
 * - `validateGridPlan(plan, repoRoot)`: the §5 `GridPlan` invariants (`runs ≥ 1`; model ids unique and safe; tasks
 *   and levels known and unique; `orderSeed` a uint32; `outRoot` absolute and outside the repository).
 * - `scheduleGrid(plan)`: cells blocked by run index; block r holds every (model, task, level) cell for run r, in an
 *   order drawn from `orderSeed` with mulberry32 (one generator, consumed block by block); block r + 1 follows
 *   block r. Deterministic per `orderSeed`.
 * - `cellOutputDir` = `<outRoot>/<modelId>/<taskId>/<specLevel>/run-<i>/`; `requestForCell` builds the
 *   `GenerationRequest` (`pilot` = `outRoot` ends in `pilot`, BR-U5a-52).
 * - `loadGeneratorPlanFile(file, repoRoot, local?)`: the JSON plan file of `scripts/generate-projects.ts --plan`. Pinned
 *   model ids and `orderSeed` come only from this file, never from code defaults (BR-U5a-51). A `"<local>"` `binary` or
 *   `harnessRoot` (the registered E1 plan, `registered-plan.ts`) is filled from `local`; a relative `outRoot` is
 *   resolved against the repository root.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { DomainError } from '../../../src/shared/errors/domain-result.js';
import { mulberry32 } from '../mutation/rng.js';
import { isInsideOrEqual, runIdFor } from './config.js';
import { resolvePlanFields } from './registered-plan.js';
import type { LocalPaths } from './registered-plan.js';
import { CLAUDE_CODE_ADAPTER_ID, CODEX_CLI_ADAPTER_ID_VALUE, FILE_RANGE, GENERATOR_ADAPTER_IDS, SPEC_LEVELS } from './types.js';
import type { GenerationCell, GenerationRequest, GridPlan, SpecLevel, TaskId } from './types.js';

export const TASK_IDS: readonly TaskId[] = ['task-management', 'order-fulfilment'];
/** The last path segment of a pilot output root (BR-U5a-52: pilot outputs never join `so5_grid.csv`). */
export const PILOT_DIR = 'pilot';
export const SCHEDULE_JSON = 'schedule.json';
/** Schedule file of a Codex-arm grid (ADR-029): beside the Claude `schedule.json`, never over it. */
export const CODEX_SCHEDULE_JSON = 'schedule-codex-cli.json';

/**
 * The schedule file a grid writes under its `outRoot`: `schedule.json` for a plan with only Claude adapters (unchanged since the
 * freeze), `schedule-codex-cli.json` for a plan with a Codex adapter (ADR-029), so the two arms of one `outRoot`
 * never overwrite each other's schedule.
 */
export function scheduleFileName(plan: Pick<GridPlan, 'adapters'>): string {
  return plan.adapters.some((a) => a.adapterId === CODEX_CLI_ADAPTER_ID_VALUE) ? CODEX_SCHEDULE_JSON : SCHEDULE_JSON;
}

const SAFE_MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** The plan file: a `GridPlan` plus the adapter configuration shared by every model. */
export interface GeneratorPlanFile extends GridPlan {
  /** Absolute path of the claude CLI. */
  readonly binary: string;
  /** `<H>`, absolute, outside the repository and outside `outRoot`. */
  readonly harnessRoot: string;
  readonly timeoutMs?: number;
  /** Set from the live confinement probes (BR-U5a-43): false = the no-Bash argument set. Required. */
  readonly allowBash: boolean;
  /** Required when a Codex adapter is listed (ADR-029); absent otherwise. */
  readonly codex?: CodexPlanBlock;
}

/** The Codex pins of a plan file (ADR-029; `Docs/generator-protocol.md` §12). */
export interface CodexPlanBlock {
  /** Exact `codex --version` (`codex-cli <x.y.z>`). */
  readonly cliVersion: string;
  /** `model_reasoning_effort`. */
  readonly reasoningEffort: string;
  /** Repository-relative path of the pinned model catalog JSON (`model_catalog_json`). */
  readonly modelCatalog: string;
  /** sha256 of that file. */
  readonly modelCatalogSha256: string;
}

const CODEX_BLOCK_FIELDS = ['cliVersion', 'reasoningEffort', 'modelCatalog', 'modelCatalogSha256'];

/** Problems of a plan's `codex` block (`present` = a Codex adapter is listed). */
export function codexBlockProblems(block: unknown, present: boolean): readonly string[] {
  if (!present) return block === undefined ? [] : ['codex block given but no codex-cli adapter is listed'];
  if (typeof block !== 'object' || block === null || Array.isArray(block)) return ['a codex-cli adapter needs a codex block'];
  const b = block as Record<string, unknown>;
  const out: string[] = [];
  for (const k of Object.keys(b)) if (!CODEX_BLOCK_FIELDS.includes(k)) out.push(`unknown codex field ${k}`);
  if (typeof b.cliVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(b.cliVersion)) out.push('codex.cliVersion must be x.y.z');
  if (typeof b.reasoningEffort !== 'string' || b.reasoningEffort.length === 0) out.push('codex.reasoningEffort must be a non-empty string');
  if (typeof b.modelCatalog !== 'string' || b.modelCatalog.length === 0 || path.isAbsolute(b.modelCatalog)) out.push('codex.modelCatalog must be a repository-relative path');
  if (typeof b.modelCatalogSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(b.modelCatalogSha256)) out.push('codex.modelCatalogSha256 must be sha256 hex');
  return out;
}

function err(message: string, context?: Record<string, unknown>): DomainError {
  return context === undefined ? { code: 'GEN_PLAN_INVALID', message } : { code: 'GEN_PLAN_INVALID', message, context };
}

function uniqueList(list: unknown, allowed: readonly string[], field: string, errors: DomainError[]): void {
  if (!Array.isArray(list) || list.length === 0) {
    errors.push(err(`${field} must be a non-empty array`));
    return;
  }
  if (new Set(list).size !== list.length) errors.push(err(`${field} must not repeat a value`));
  for (const v of list) if (typeof v !== 'string' || !allowed.includes(v)) errors.push(err(`${field} has an unknown value`, { value: String(v) }));
}

/** §5 `GridPlan` invariants. `repoRoot = null` skips the outside-the-repository check. */
export function validateGridPlan(plan: GridPlan, repoRoot: string | null): DomainResult<GridPlan> {
  const errors: DomainError[] = [];
  // The plan may come from JSON: its adapter entries are read as unknown values.
  const adapters: unknown = plan.adapters;
  if (!Array.isArray(adapters) || adapters.length === 0) errors.push(err('adapters must be a non-empty array'));
  else {
    const entries = adapters.map((a: unknown) => (typeof a === 'object' && a !== null ? (a as Record<string, unknown>) : {}));
    const ids = entries.map((a) => a.modelId);
    if (new Set(ids).size !== ids.length) errors.push(err('model ids must be unique (one adapter per pinned model id)'));
    for (const a of entries) {
      if (typeof a.adapterId !== 'string' || !GENERATOR_ADAPTER_IDS.includes(a.adapterId)) {
        errors.push(err(`adapterId must be one of ${GENERATOR_ADAPTER_IDS.join(', ')} (default ${CLAUDE_CODE_ADAPTER_ID})`));
      }
      if (typeof a.modelId !== 'string' || !SAFE_MODEL_ID.test(a.modelId)) errors.push(err('modelId must match [A-Za-z0-9][A-Za-z0-9._-]*'));
    }
  }
  uniqueList(plan.tasks, TASK_IDS, 'tasks', errors);
  uniqueList(plan.levels, SPEC_LEVELS, 'levels', errors);
  if (typeof plan.style !== 'string' || plan.style.length === 0) errors.push(err('style must be a non-empty string'));
  if (!Number.isInteger(plan.runs) || plan.runs < 1) errors.push(err('runs must be an integer ≥ 1'));
  if (!Number.isInteger(plan.orderSeed) || plan.orderSeed < 0 || plan.orderSeed > 0xffffffff) errors.push(err('orderSeed must be a uint32'));
  if (typeof plan.outRoot !== 'string' || !path.isAbsolute(plan.outRoot)) errors.push(err('outRoot must be an absolute path'));
  else if (repoRoot !== null && isInsideOrEqual(repoRoot, plan.outRoot)) errors.push(err('outRoot must lie outside the repository'));
  return errors.length > 0 ? DomainResult.fail(errors) : DomainResult.ok(plan);
}

/** Every (model, task, level) cell of one run, in plan order. */
function blockCells(plan: GridPlan): { modelId: string; taskId: TaskId; specLevel: SpecLevel }[] {
  const out: { modelId: string; taskId: TaskId; specLevel: SpecLevel }[] = [];
  for (const a of plan.adapters) for (const taskId of plan.tasks) for (const specLevel of plan.levels) out.push({ modelId: a.modelId, taskId, specLevel });
  return out;
}

/** BR-U5a-51: blocks by run index, each block in a seeded order. */
export function scheduleGrid(plan: GridPlan): readonly GenerationCell[] {
  const rng = mulberry32(plan.orderSeed);
  const base = blockCells(plan);
  const cells: GenerationCell[] = [];
  for (let r = 0; r < plan.runs; r++) {
    const order = rng.pickDistinct(base, base.length);
    order.forEach((c, i) => {
      cells.push(Object.freeze({ ...c, runIndex: r, blockIndex: r, positionInBlock: i }));
    });
  }
  return Object.freeze(cells);
}

export function cellOutputDir(outRoot: string, cell: Pick<GenerationCell, 'modelId' | 'taskId' | 'specLevel' | 'runIndex'>): string {
  return path.join(outRoot, cell.modelId, cell.taskId, cell.specLevel, `run-${String(cell.runIndex)}`);
}

export function isPilotOutRoot(outRoot: string): boolean {
  return path.basename(path.normalize(outRoot)) === PILOT_DIR;
}

export function requestForCell(plan: GridPlan, cell: GenerationCell): GenerationRequest {
  return Object.freeze({
    runId: runIdFor(cell.modelId, cell.taskId, cell.specLevel, cell.runIndex),
    promptTemplateId: `${cell.specLevel}/${cell.taskId}`,
    taskId: cell.taskId,
    modelId: cell.modelId,
    style: plan.style,
    specLevel: cell.specLevel,
    runIndex: cell.runIndex,
    outputDir: cellOutputDir(plan.outRoot, cell),
    fileRange: FILE_RANGE,
    orderSeed: plan.orderSeed,
    pilot: isPilotOutRoot(plan.outRoot),
  });
}

/**
 * The pilot of §5.3 step 4: one generation per level (first model, first task, run 0) under `<outRoot>/pilot/`.
 * Its outcomes carry `pilot: true` and are never joined into `so5_grid.csv`.
 */
export function pilotPlan<P extends GridPlan>(plan: P): P {
  const first = plan.adapters[0];
  const task = plan.tasks[0];
  return {
    ...plan,
    adapters: first === undefined ? [] : [first],
    tasks: task === undefined ? [] : [task],
    runs: 1,
    outRoot: path.join(plan.outRoot, PILOT_DIR),
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Reads and validates the plan file (JSON). */
export function loadGeneratorPlanFile(file: string, repoRoot: string, local: LocalPaths = {}): DomainResult<GeneratorPlanFile> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  } catch (e) {
    return DomainResult.fail([err(`cannot read the plan file: ${e instanceof Error ? e.message : String(e)}`)]);
  }
  if (!isRecord(parsed)) return DomainResult.fail([err('the plan file must hold a JSON object')]);
  const resolved = resolvePlanFields(parsed, repoRoot, local);
  const raw = resolved.plan;
  const errors: DomainError[] = resolved.problems.map((m) => err(m));
  const allowed = ['adapters', 'tasks', 'style', 'levels', 'runs', 'outRoot', 'orderSeed', 'binary', 'harnessRoot', 'timeoutMs', 'allowBash', 'codex'];
  for (const k of Object.keys(raw)) if (!allowed.includes(k)) errors.push(err('unknown plan field', { field: k }));
  for (const k of ['binary', 'harnessRoot']) {
    if (typeof raw[k] !== 'string' || !path.isAbsolute(raw[k])) errors.push(err(`${k} must be an absolute path`));
  }
  if (typeof raw.allowBash !== 'boolean') errors.push(err('allowBash must be set (true, or false after a failed confinement probe)'));
  if (raw.timeoutMs !== undefined && (!Number.isInteger(raw.timeoutMs) || (raw.timeoutMs as number) <= 0)) {
    errors.push(err('timeoutMs must be a positive integer'));
  }
  if (!Array.isArray(raw.adapters) || !raw.adapters.every(isRecord)) errors.push(err('adapters must be an array of objects'));
  else {
    const hasCodex = raw.adapters.some((a) => isRecord(a) && a.adapterId === CODEX_CLI_ADAPTER_ID_VALUE);
    for (const m of codexBlockProblems(raw.codex, hasCodex)) errors.push(err(m));
  }
  if (errors.length > 0) return DomainResult.fail(errors);
  const plan = raw as unknown as GeneratorPlanFile;
  const v = validateGridPlan(plan, repoRoot);
  if (!v.success) return DomainResult.fail(v.errors);
  return DomainResult.ok(plan);
}
