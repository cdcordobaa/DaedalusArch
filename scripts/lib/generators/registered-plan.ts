/**
 * The registered E1 generator plan (ADR-021 SO5; SO5-03, THR-8; BR-U5a-51, BR-U5b-51).
 *
 * `experiments/e1-grid/generator-plan.json` is the committed, pre-registered `GeneratorPlanFile` of the E1 grid: the
 * pinned full model ids in schedule order, both tasks, the three levels, `runs` 3, `orderSeed` 20261008, `allowBash`,
 * `timeoutMs` and the repository-relative `outRoot` (the E1 plan's `outcomesRoot`). Only the machine-local fields
 * `binary` and `harnessRoot` hold the placeholder `"<local>"`; `generate-projects.ts --binary --harness-root` fills
 * them. The file sits beside the experiment plan (`generatorPlanPathFor`).
 *
 * - `resolvePlanFields(raw, repoRoot, local)`: substitutes the placeholders and resolves a relative `outRoot` against
 *   the repository root (the loader of `schedule.ts` then validates the result).
 * - `protocolMismatches(plan, registered)`: the frozen fields that differ (adapter order and ids, tasks, levels,
 *   style, runs, `orderSeed`, `allowBash`, effective `timeoutMs`, canonical `outRoot`). `binary`/`harnessRoot` are
 *   local and never compared.
 * - `e1GridMismatches(registered, grid, repoRoot)`: the registered plan against the `e1` block of the E1 experiment
 *   plan (same model, level and task sets, runs, style, and `outRoot` = resolved `outcomesRoot`).
 * - `outcomeProtocolMismatches(outcome, expected)`: one `generation.json` against the registered protocol and its
 *   grid coordinates (`orderSeed`, `pilot` false, template id and sha, adapter id, model, task, level, run index).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { canonicalPath } from './config.js';
import { DEFAULT_GENERATOR_TIMEOUT_MS } from './types.js';
import type { GridPlan } from './types.js';

/** Repository path of the registered E1 generator plan (the Claude arm; unchanged by ADR-029). */
export const E1_GENERATOR_PLAN = 'experiments/e1-grid/generator-plan.json';
/** Repository path of the registered Codex-arm generator plan (ADR-029). */
export const E1_CODEX_GENERATOR_PLAN = 'experiments/e1-grid/generator-plan-codex.json';
/** Every registered E1 generator plan, one per arm, in run order. */
export const E1_GENERATOR_PLANS: readonly string[] = [E1_GENERATOR_PLAN, E1_CODEX_GENERATOR_PLAN];
/** File-name pattern of an arm plan beside its experiment plan (`generator-plan.json`, `generator-plan-<arm>.json`). */
export const GENERATOR_PLAN_FILE_PATTERN = /^generator-plan(?:-[a-z0-9]+)?\.json$/;
/** File name of a generator plan beside its experiment plan. */
export const GENERATOR_PLAN_FILE = 'generator-plan.json';
/** Placeholder of a machine-local path in a registered plan. */
export const LOCAL_PLACEHOLDER = '<local>';
/** The E1 `orderSeed`, fixed at the catalogue freeze (ADR-019 item 6). */
export const E1_ORDER_SEED = 20261008;

export interface LocalPaths {
  readonly binary?: string;
  readonly harnessRoot?: string;
}

/** The generator plan beside an experiment plan (`experiments/<id>/plan.json` → `experiments/<id>/generator-plan.json`). */
export function generatorPlanPathFor(experimentPlanPath: string): string {
  return path.posix.join(path.posix.dirname(experimentPlanPath.split(path.sep).join('/')), GENERATOR_PLAN_FILE);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Fills `<local>` placeholders from `local` and resolves a relative `outRoot` against `repoRoot`. Returns the
 * problems when a placeholder has no local value, or a local value is given for a field that is not a placeholder.
 */
export function resolvePlanFields(
  raw: Record<string, unknown>,
  repoRoot: string,
  local: LocalPaths = {},
): { readonly plan: Record<string, unknown>; readonly problems: readonly string[] } {
  const plan: Record<string, unknown> = { ...raw };
  const problems: string[] = [];
  for (const field of ['binary', 'harnessRoot'] as const) {
    const given = local[field];
    if (plan[field] === LOCAL_PLACEHOLDER) {
      if (given === undefined) problems.push(`${field} is ${LOCAL_PLACEHOLDER} in the plan file: pass --${field === 'binary' ? 'binary' : 'harness-root'} <absolute path>`);
      else plan[field] = given;
    } else if (given !== undefined) {
      problems.push(`${field} is set in the plan file; --${field === 'binary' ? 'binary' : 'harness-root'} applies only to a ${LOCAL_PLACEHOLDER} field`);
    }
  }
  if (typeof plan.outRoot === 'string' && plan.outRoot.length > 0 && !path.isAbsolute(plan.outRoot)) {
    plan.outRoot = path.resolve(repoRoot, plan.outRoot);
  }
  return { plan, problems };
}

/** Every arm plan beside an experiment plan (`generator-plan.json` first, then `generator-plan-<arm>.json` sorted). */
export function armPlanPathsFor(experimentPlanPath: string, repoRoot: string): readonly string[] {
  const dir = path.posix.dirname(experimentPlanPath.split(path.sep).join('/'));
  let names: string[];
  try {
    names = fs.readdirSync(path.resolve(repoRoot, dir)).filter((n) => GENERATOR_PLAN_FILE_PATTERN.test(n));
  } catch {
    names = [];
  }
  names.sort((a, b) => (a === GENERATOR_PLAN_FILE ? -1 : b === GENERATOR_PLAN_FILE ? 1 : a < b ? -1 : a > b ? 1 : 0));
  return names.map((n) => path.posix.join(dir, n));
}

/** The registered plan, read without the local-path checks (placeholders kept, `outRoot` resolved). */
export function readRegisteredPlan(file: string, repoRoot: string): { ok: true; plan: ProtocolFields } | { ok: false; detail: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  } catch (e) {
    return { ok: false, detail: `cannot read ${file}: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!isRecord(raw)) return { ok: false, detail: `${file} must hold a JSON object` };
  const { plan } = resolvePlanFields(raw, repoRoot);
  const problems: string[] = [];
  if (!Array.isArray(plan.adapters) || !plan.adapters.every((a) => isRecord(a) && typeof a.modelId === 'string')) problems.push('adapters');
  for (const k of ['tasks', 'levels']) if (!Array.isArray(plan[k]) || !(plan[k] as unknown[]).every((v) => typeof v === 'string')) problems.push(k);
  if (typeof plan.style !== 'string') problems.push('style');
  if (!Number.isInteger(plan.runs)) problems.push('runs');
  if (!Number.isInteger(plan.orderSeed)) problems.push('orderSeed');
  if (typeof plan.outRoot !== 'string') problems.push('outRoot');
  if (typeof plan.allowBash !== 'boolean') problems.push('allowBash');
  if (plan.timeoutMs !== undefined && !Number.isInteger(plan.timeoutMs)) problems.push('timeoutMs');
  if (problems.length > 0) return { ok: false, detail: `${file}: invalid field(s) ${problems.join(', ')}` };
  return { ok: true, plan: plan as unknown as ProtocolFields };
}

/** The frozen fields of a generator plan (`codex` only on a Codex-arm plan, ADR-029). */
export type ProtocolFields = GridPlan & { readonly allowBash: boolean; readonly timeoutMs?: number; readonly codex?: unknown };

function same(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

function sameSet(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && new Set(a).size === a.length && a.every((x) => b.includes(x));
}

/** Frozen fields of `plan` that differ from `registered` (order matters: it decides the schedule). */
export function protocolMismatches(plan: ProtocolFields, registered: ProtocolFields): readonly string[] {
  const out: string[] = [];
  if (!same(plan.adapters.map((a) => `${a.adapterId}:${a.modelId}`), registered.adapters.map((a) => `${a.adapterId}:${a.modelId}`))) out.push('adapters');
  if (!same(plan.tasks, registered.tasks)) out.push('tasks');
  if (!same(plan.levels, registered.levels)) out.push('levels');
  if (plan.style !== registered.style) out.push('style');
  if (plan.runs !== registered.runs) out.push('runs');
  if (plan.orderSeed !== registered.orderSeed) out.push('orderSeed');
  if (plan.allowBash !== registered.allowBash) out.push('allowBash');
  if ((plan.timeoutMs ?? DEFAULT_GENERATOR_TIMEOUT_MS) !== (registered.timeoutMs ?? DEFAULT_GENERATOR_TIMEOUT_MS)) out.push('timeoutMs');
  if (canonicalPath(plan.outRoot) !== canonicalPath(registered.outRoot)) out.push('outRoot');
  if (JSON.stringify(plan.codex ?? null) !== JSON.stringify(registered.codex ?? null)) out.push('codex');
  return out;
}

/** The `e1` block of an experiment plan, as far as it is compared. */
export interface E1GridFields {
  readonly outcomesRoot: string;
  readonly style: string;
  readonly models: readonly string[];
  readonly specLevels: readonly string[];
  readonly tasks: readonly { readonly taskId: string }[];
  readonly runs: number;
}

/** The registered generator plan against the E1 experiment plan's grid. */
export function e1GridMismatches(registered: ProtocolFields, grid: E1GridFields, repoRoot: string): readonly string[] {
  const out: string[] = [];
  if (!sameSet(registered.adapters.map((a) => a.modelId), grid.models)) out.push('models');
  if (!sameSet(registered.levels, grid.specLevels)) out.push('specLevels');
  if (!sameSet(registered.tasks, grid.tasks.map((t) => t.taskId))) out.push('tasks');
  if (registered.runs !== grid.runs) out.push('runs');
  if (registered.style !== grid.style) out.push('style');
  if (canonicalPath(registered.outRoot) !== canonicalPath(path.resolve(repoRoot, grid.outcomesRoot))) out.push('outRoot');
  return out;
}

/**
 * Several registered arm plans against one `e1` block (ADR-029): every arm must match the block's levels, tasks,
 * runs, style and `outRoot`; the arms' model sets must be disjoint and their union must equal `e1.models`.
 */
export function e1ArmsMismatches(arms: readonly ProtocolFields[], grid: E1GridFields, repoRoot: string): readonly string[] {
  if (arms.length === 0) return ['no arm plan'];
  const out = new Set<string>();
  const models: string[] = [];
  for (const a of arms) {
    for (const m of e1GridMismatches(a, { ...grid, models: a.adapters.map((x) => x.modelId) }, repoRoot)) out.add(m);
    models.push(...a.adapters.map((x) => x.modelId));
  }
  if (!sameSet(models, grid.models)) out.add('models');
  return [...out];
}

/** What a `generation.json` of one grid coordinate must carry. */
export interface ExpectedOutcome {
  readonly modelId: string;
  readonly taskId: string;
  readonly specLevel: string;
  readonly runIndex: number;
  readonly orderSeed: number;
  readonly adapterId: string;
  /** The template sha of `<specLevel>/<taskId>` from the committed templates; `undefined` when unreadable. */
  readonly promptTemplateSha256: string | undefined;
}

/** Fields of `outcome` (a parsed `generation.json`) that break the registered protocol; empty when it conforms. */
export function outcomeProtocolMismatches(outcome: Record<string, unknown>, expected: ExpectedOutcome): readonly string[] {
  const out: string[] = [];
  const check = (field: string, want: unknown): void => {
    if (outcome[field] !== want) out.push(`${field} ${JSON.stringify(outcome[field] ?? null)} != ${JSON.stringify(want)}`);
  };
  check('orderSeed', expected.orderSeed);
  check('pilot', false);
  check('adapterId', expected.adapterId);
  check('requestedModelId', expected.modelId);
  check('taskId', expected.taskId);
  check('specLevel', expected.specLevel);
  check('runIndex', expected.runIndex);
  check('promptTemplateId', `${expected.specLevel}/${expected.taskId}`);
  if (expected.promptTemplateSha256 === undefined) out.push('promptTemplateSha256: the committed template is unreadable');
  else check('promptTemplateSha256', expected.promptTemplateSha256);
  return out;
}

/** Outcome of `guardE1Plan`. */
export type E1PlanGuard =
  | { readonly ok: true; readonly e1: boolean; readonly warning?: string }
  | { readonly ok: false; readonly detail: string };

/**
 * The generator-side check (SO5-03): a grid whose `outRoot` lies in the registered E1 `outRoot` (the E1 grid or its
 * pilot) must be started from the registered plan file itself, every frozen field must equal it, and when
 * `corpus/prereg.json` lists the file (`registeredSha256`), its bytes must still hash to that value. Before the file
 * is registered the run is allowed with a warning. A plan outside the E1 `outRoot` (a probe or test grid) passes.
 */
export function guardE1Plan(
  planFile: string,
  plan: ProtocolFields,
  repoRoot: string,
  registeredSha256: string | undefined | ((repoPath: string) => string | undefined),
  sha256Of: (file: string) => string,
): E1PlanGuard {
  const registeredFile = path.resolve(repoRoot, E1_GENERATOR_PLAN);
  if (!fs.existsSync(registeredFile)) return { ok: true, e1: false };
  const reg = readRegisteredPlan(registeredFile, repoRoot);
  if (!reg.ok) return { ok: false, detail: reg.detail };
  const rel = path.relative(canonicalPath(reg.plan.outRoot), canonicalPath(plan.outRoot));
  const inside = rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  if (!inside) return { ok: true, e1: false };
  // The arm plan the grid was started from must be one of the registered E1 plans (ADR-029 adds the Codex arm).
  const armRel = E1_GENERATOR_PLANS.find((p) => fs.existsSync(path.resolve(repoRoot, p)) && canonicalPath(planFile) === canonicalPath(path.resolve(repoRoot, p)));
  if (armRel === undefined) {
    return { ok: false, detail: `outRoot lies in the E1 outRoot: start the grid from ${E1_GENERATOR_PLANS.join(' or ')}, not another plan file` };
  }
  const armFile = path.resolve(repoRoot, armRel);
  const arm = armRel === E1_GENERATOR_PLAN ? reg : readRegisteredPlan(armFile, repoRoot);
  if (!arm.ok) return { ok: false, detail: arm.detail };
  const mismatches = protocolMismatches(plan, arm.plan);
  if (mismatches.length > 0) return { ok: false, detail: `the plan differs from ${armRel} in ${mismatches.join(', ')}` };
  const sha = sha256Of(armFile);
  const expected = typeof registeredSha256 === 'function' ? registeredSha256(armRel) : registeredSha256;
  if (expected === undefined) {
    return { ok: true, e1: true, warning: `${armRel} is not yet listed in corpus/prereg.json (registered by a pre-registration bump)` };
  }
  if (sha !== expected) return { ok: false, detail: `${armRel} changed since its registration (sha256 ${sha} != ${expected})` };
  return { ok: true, e1: true };
}
