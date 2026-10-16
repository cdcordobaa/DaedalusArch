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
 *
 * Per-task profiles (`taskProfiles`, optional): a task's target style (`clean | hexagonal | ddd`, the style slot of the
 * step frames) and its evaluator spec: `static` (a spec file) or `ise-step1` (DDD only: a spec the ISE infers from the
 * run's step-1 snapshot, constrained to the declared `contexts`, then frozen; `specs.ts`). `evaluatorSpec` is the
 * default spec and may be left out only when every task has a profile. `callBudget`, when present, must equal the
 * budget the plan implies (`planCallBudget`), so the recorded figure cannot drift from the plan.
 *
 * Frame extras (`frame`, optional, off by default; `Docs/v1.3/floor-escape-design-2026-10-16.md` §3.2, §3.3):
 * `specRung` L2 (today's frame, the default), L3 (one plain sentence per blocking rule of the task's evaluator spec)
 * or L4 (L3 plus the spec file in the cwd and a file-read log), and `attention` (one sentence, identical across arms).
 * L3 and L4 need a static spec for every task (a static profile or the default `evaluatorSpec`); a DDD spec frozen
 * after step 1 does not exist before step 1, so it cannot be stated in the frame (decision D15, not taken here).
 *
 * Spec equality (review finding R23; `Docs/v1.3/study2-tunables.md` §4): a plan may pin `specSha256`. `loadLoopPlan` then
 * checks that the evaluator spec and, for the `daedalus-mcp` arm, the MCP server's spec both hash to it, so the arm's
 * tools answer from the spec that is scored. A `daedalus-mcp` plan cannot carry `taskProfiles`, so one spec covers
 * every task. Without `specSha256` nothing changes, unless the caller asks for it (`requireSpecSha256`, from
 * `DAEDALUS_LOOP_REQUIRE_SPEC_SHA256=1` in `main.ts`; OFF by default).
 *
 * Pins and isolation (optional, OFF when absent; `Docs/v1.3/loop-isolation.md`): `adapters[].cliVersion` pins the CLI
 * version (a Codex value must equal `codex.cliVersion`); `generatorIsolation.claudeConfigDir` (`"<local>"` filled from
 * `--claude-config-dir`) isolates every Claude spawn and requires `cliVersion` on every Claude adapter.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { DomainError } from '../../../src/shared/errors/domain-result.js';
import { mulberry32 } from '../mutation/rng.js';
import type { AcceptancePlan } from './acceptance.js';
import type { DaedalusServerInput } from '../generators/arms.js';
import type { CodexPlanBlock } from '../generators/schedule.js';
import { GENERATOR_ADAPTER_IDS } from '../generators/types.js';
import type { GeneratorAdapterId } from '../generators/types.js';
import { CONTEXT_ROOT_RE, LOOP_STYLES } from './style.js';
import type { LoopContextDecl, LoopStyle } from './style.js';
import { SPEC_RUNGS } from './prompts.js';
import type { SpecRung } from './prompts.js';
import { LOOP_ARMS, parseLoopEngine } from './types.js';
import type { LoopArm, LoopEngine, LoopRunSpec, LoopTask, LoopTasksFile, TaskAcceptance } from './types.js';

/** A task's style and evaluator spec. */
export interface TaskProfilePlan {
  readonly style: LoopStyle;
  /** `static` (default): `evaluatorSpec` is the spec file. `ise-step1`: DDD spec inferred and frozen after step 1. */
  readonly specMode?: 'static' | 'ise-step1';
  /** Repository-relative or absolute; required for `static`. */
  readonly evaluatorSpec?: string;
  /** DDD: the bounded contexts the frame names and the spec declares. */
  readonly contexts?: readonly LoopContextDecl[];
}

/** Frame extras of a plan (module header). Absent, or `{ specRung: 'L2', attention: false }`: today's frames. */
export interface FramePlan {
  readonly specRung?: SpecRung;
  readonly attention?: boolean;
}

/** Model calls a plan implies: one per step turn, plus at most one repair turn per gate step. */
export interface CallBudget {
  readonly runs: number;
  readonly stepTurns: number;
  readonly maxRepairTurns: number;
  readonly maxCalls: number;
}

/** The gate arm's held-out-rule setting. */
export interface GatePlan {
  readonly shownRules?: readonly string[];
}

export interface LoopPlanFile {
  readonly description: string;
  /** Repository-relative or absolute path of the tasks file. */
  readonly tasksFile: string;
  readonly adapters: readonly { readonly adapterId: GeneratorAdapterId; readonly modelId: string; readonly cliVersion?: string }[];
  /** Claude generator isolation (gate S3); the E1 environment when absent. */
  readonly generatorIsolation?: { readonly claudeConfigDir: string };
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
  /** Default spec the firewall evaluates each snapshot against (repository-relative or absolute). */
  readonly evaluatorSpec?: string;
  /** Per-task style and spec, keyed by task id. */
  readonly taskProfiles?: Readonly<Record<string, TaskProfilePlan>>;
  /** Frame extras (module header); absent = today's frames. */
  readonly frame?: FramePlan;
  /** The recorded call budget; checked against `planCallBudget`. */
  readonly callBudget?: CallBudget;
  /**
   * Gate arm: the blocking rules its repair feedback may show; every other blocking rule is withheld but still scored.
   * Absent: every rule is shown (the default). `Docs/v1.3/gate-heldout-rules.md`.
   */
  readonly gate?: GatePlan;
  /**
   * The evaluator's graph engine (`Docs/v1.3/loop-engine-tee.md`); `--engine` overrides it. Absent = the default
   * wiring, unchanged.
   */
  readonly engine?: LoopEngine;
  /** Recorded for a judge-mode evaluator (the symbolic evaluator makes no model call). */
  readonly cassette?: { readonly dir: string; readonly mode: 'record' | 'replay' };
  /** sha256 of the spec file every task is scored against (and the `daedalus-mcp` server reads); checked at load. */
  readonly specSha256?: string;
  /** Per-snapshot acceptance checks (`acceptance.ts`, gate D12); off unless `enabled` is true. */
  readonly acceptance?: AcceptancePlan;
}

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
export const SPEC_SHA_ENV = 'DAEDALUS_LOOP_REQUIRE_SPEC_SHA256';
const VERSION_RE = /^\d+\.\d+\.\d+$/;
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
    if (t.acceptance !== undefined) {
      const a = validateTaskAcceptance(t.id, t.acceptance);
      errors.push(...a.errors);
      tasks.push({ id: t.id, title: t.title, steps, acceptance: a.value });
      continue;
    }
    tasks.push({ id: t.id, title: t.title, steps });
  }
  if (tasks.length === 0) errors.push(err('LOOP_TASKS_INVALID', 'the tasks file lists no task'));
  return errors.length > 0 ? DomainResult.fail(errors) : DomainResult.ok({ description: raw.description, tasks });
}

function isArgv(v: unknown): v is string[] {
  return Array.isArray(v) && v.length > 0 && v.every((a) => typeof a === 'string' && a !== '');
}

/** A task's optional acceptance start block (`acceptance.ts`). */
function validateTaskAcceptance(taskId: string, raw: unknown): { readonly value: TaskAcceptance; readonly errors: DomainError[] } {
  const bad = (m: string): DomainError => err('LOOP_TASKS_INVALID', `task ${taskId}: acceptance ${m}`);
  if (!isRecord(raw)) return { value: {}, errors: [bad('must be { startCommand?, buildCommand?, port?, healthPath? }')] };
  const errors: DomainError[] = [];
  if (raw.startCommand !== undefined && !isArgv(raw.startCommand)) errors.push(bad('startCommand must be a non-empty argv array of strings'));
  if (raw.buildCommand !== undefined && !isArgv(raw.buildCommand)) errors.push(bad('buildCommand must be a non-empty argv array of strings'));
  if (raw.port !== undefined && (!Number.isInteger(raw.port) || (raw.port as number) < 1 || (raw.port as number) > 65535)) errors.push(bad('port must be an integer in 1..65535'));
  if (raw.healthPath !== undefined && (typeof raw.healthPath !== 'string' || !raw.healthPath.startsWith('/'))) errors.push(bad('healthPath must start with /'));
  return { value: raw, errors };
}

function validateAcceptancePlan(raw: unknown): DomainError[] {
  const bad = (m: string): DomainError => err('LOOP_PLAN_INVALID', `acceptance ${m}`);
  if (!isRecord(raw)) return [bad('must be { enabled, testsRoot, timeoutMs?, startTimeoutMs? }')];
  const errors: DomainError[] = [];
  if (typeof raw.enabled !== 'boolean') errors.push(bad('enabled must be a boolean'));
  if (typeof raw.testsRoot !== 'string' || !path.isAbsolute(raw.testsRoot)) errors.push(bad('testsRoot must be an absolute path'));
  for (const k of ['timeoutMs', 'startTimeoutMs']) {
    if (raw[k] !== undefined && (!Number.isInteger(raw[k]) || (raw[k] as number) <= 0)) errors.push(bad(`${k} must be a positive integer`));
  }
  return errors;
}

export function validatePlan(raw: unknown): DomainResult<LoopPlanFile> {
  if (!isRecord(raw)) return DomainResult.fail([err('LOOP_PLAN_INVALID', 'the plan must be a JSON object')]);
  const errors: DomainError[] = [];
  const str = (k: string): void => {
    if (typeof raw[k] !== 'string' || raw[k] === '') errors.push(err('LOOP_PLAN_INVALID', `${k} must be a non-empty string`));
  };
  for (const k of ['description', 'tasksFile', 'outRoot', 'binary', 'harnessRoot']) str(k);
  if (raw.evaluatorSpec !== undefined) str('evaluatorSpec');
  if (raw.engine !== undefined && parseLoopEngine(raw.engine) === undefined) errors.push(err('LOOP_PLAN_INVALID', 'engine must be neo4j, cypher-interp or both'));
  if (raw.evaluatorSpec === undefined && raw.taskProfiles === undefined) errors.push(err('LOOP_PLAN_INVALID', 'evaluatorSpec must be a non-empty string (or every task needs a taskProfiles entry)'));
  if (raw.taskProfiles !== undefined) errors.push(...validateProfiles(raw.taskProfiles));
  if (raw.taskProfiles !== undefined && Array.isArray(raw.arms) && raw.arms.includes('daedalus-mcp')) {
    errors.push(err('LOOP_PLAN_INVALID', 'taskProfiles cannot be combined with the daedalus-mcp arm (its MCP server has one spec)'));
  }
  if (raw.callBudget !== undefined) {
    const b = raw.callBudget;
    if (!isRecord(b) || !['runs', 'stepTurns', 'maxRepairTurns', 'maxCalls'].every((k) => Number.isInteger(b[k]) && (b[k] as number) >= 0)) {
      errors.push(err('LOOP_PLAN_INVALID', 'callBudget must be { runs, stepTurns, maxRepairTurns, maxCalls } (non-negative integers)'));
    }
  }
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
  if (Array.isArray(adapters)) errors.push(...pinProblems(adapters, raw.codex, raw.generatorIsolation));
  if (Array.isArray(arms) && arms.includes('daedalus-mcp') && !isRecord(raw.daedalus)) {
    errors.push(err('LOOP_PLAN_INVALID', 'the daedalus-mcp arm needs a daedalus block { nodeBinary, serverEntry, specPath }'));
  }
  if (raw.frame !== undefined) errors.push(...validateFrame(raw.frame, raw.taskProfiles));
  if (raw.gate !== undefined) errors.push(...validateGate(raw.gate, raw.arms));
  if (raw.acceptance !== undefined) errors.push(...validateAcceptancePlan(raw.acceptance));
  if (raw.cassette !== undefined && (!isRecord(raw.cassette) || typeof raw.cassette.dir !== 'string' || !['record', 'replay'].includes(String(raw.cassette.mode)))) {
    errors.push(err('LOOP_PLAN_INVALID', 'cassette must be { dir, mode: record | replay }'));
  }
  if (raw.specSha256 !== undefined && (typeof raw.specSha256 !== 'string' || !SHA256_RE.test(raw.specSha256))) {
    errors.push(err('LOOP_PLAN_INVALID', 'specSha256 must be a lower-case 64-hex sha256'));
  }
  return errors.length > 0 ? DomainResult.fail(errors) : DomainResult.ok(raw as unknown as LoopPlanFile);
}

function validateFrame(raw: unknown, profiles: unknown): DomainError[] {
  if (!isRecord(raw) || Object.keys(raw).some((k) => k !== 'specRung' && k !== 'attention')) {
    return [err('LOOP_PLAN_INVALID', 'frame must be { specRung?: L2 | L3 | L4, attention?: boolean }')];
  }
  const errors: DomainError[] = [];
  if (raw.specRung !== undefined && !(SPEC_RUNGS as readonly unknown[]).includes(raw.specRung)) {
    errors.push(err('LOOP_PLAN_INVALID', `frame.specRung must be one of ${SPEC_RUNGS.join(', ')}`));
  }
  if (raw.attention !== undefined && typeof raw.attention !== 'boolean') errors.push(err('LOOP_PLAN_INVALID', 'frame.attention must be a boolean'));
  if ((raw.specRung === 'L3' || raw.specRung === 'L4') && isRecord(profiles)) {
    for (const [id, p] of Object.entries(profiles)) {
      if (isRecord(p) && p.specMode === 'ise-step1') errors.push(err('LOOP_PLAN_INVALID', `taskProfiles.${id}: an ${raw.specRung} frame needs a static spec (ise-step1 has none before step 1)`));
    }
  }
  return errors;
}

function validateGate(raw: unknown, arms: unknown): DomainError[] {
  if (!isRecord(raw) || Object.keys(raw).some((k) => k !== 'shownRules')) return [err('LOOP_PLAN_INVALID', 'gate must be { shownRules? }')];
  const errors: DomainError[] = [];
  const shown = raw.shownRules;
  if (shown !== undefined) {
    if (!Array.isArray(shown) || shown.length === 0 || !shown.every((r) => typeof r === 'string' && r.trim() !== '') || new Set(shown).size !== shown.length) {
      errors.push(err('LOOP_PLAN_INVALID', 'gate.shownRules must be a non-empty list of distinct rule ids'));
    }
    if (!Array.isArray(arms) || !arms.includes('gate')) errors.push(err('LOOP_PLAN_INVALID', 'gate.shownRules needs the gate arm'));
  }
  return errors;
}

/** The rung and attention flag a plan's frames carry (defaults: L2, no attention). */
export function planFrame(plan: Pick<LoopPlanFile, 'frame'>): { readonly specRung: SpecRung; readonly attention: boolean } {
  return { specRung: plan.frame?.specRung ?? 'L2', attention: plan.frame?.attention ?? false };
}

/** `adapters[].cliVersion` and `generatorIsolation` (module header). */
function pinProblems(adapters: readonly unknown[], codex: unknown, isolation: unknown): DomainError[] {
  const errors: DomainError[] = [];
  const bad = (m: string): void => {
    errors.push(err('LOOP_PLAN_INVALID', m));
  };
  const codexVersion = isRecord(codex) ? codex.cliVersion : undefined;
  for (const a of adapters) {
    if (!isRecord(a) || a.cliVersion === undefined) continue;
    if (typeof a.cliVersion !== 'string' || !VERSION_RE.test(a.cliVersion)) bad(`adapters[${String(a.adapterId)}].cliVersion must be x.y.z`);
    else if (a.adapterId === 'codex-cli' && a.cliVersion !== codexVersion) bad(`adapters[codex-cli].cliVersion ${a.cliVersion} differs from codex.cliVersion`);
  }
  if (isolation === undefined) return errors;
  if (!isRecord(isolation) || typeof isolation.claudeConfigDir !== 'string' || isolation.claudeConfigDir === '' || Object.keys(isolation).some((k) => k !== 'claudeConfigDir')) {
    bad('generatorIsolation must be { claudeConfigDir }');
  }
  if (adapters.some((a) => isRecord(a) && a.adapterId === 'claude-code-cli' && a.cliVersion === undefined)) {
    bad('generatorIsolation needs cliVersion on every claude-code-cli adapter');
  }
  return errors;
}

/** R23's one hashing helper: the sha256 of a spec file's bytes, or the read error's message. */
export function specFileSha256(file: string): { readonly sha256: string } | { readonly error: string } {
  try {
    return { sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex') };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * R23 (post-merge review 2026-10-16): in the daedalus-mcp arm the MCP server's spec (`daedalus.specPath`) and the
 * evaluator's spec (`evaluatorSpec`, repository-relative) must hold the same rules, or the tool's advice and the score
 * disagree. Compares the two files by sha256; returns both hashes, or undefined when the arm is not in the plan.
 */
export function mcpSpecCheck(
  plan: Pick<LoopPlanFile, 'arms' | 'evaluatorSpec' | 'daedalus'>, repoRoot: string,
): DomainResult<{ readonly mcpSpecSha256: string; readonly evaluatorSpecSha256: string } | undefined> {
  if (!plan.arms.includes('daedalus-mcp')) return DomainResult.ok(undefined);
  if (plan.daedalus === undefined || plan.evaluatorSpec === undefined) {
    return DomainResult.fail([err('LOOP_PLAN_SPEC_MISMATCH', 'the daedalus-mcp arm needs daedalus.specPath and evaluatorSpec')]);
  }
  const hash = (file: string): string | undefined => {
    const h = specFileSha256(file);
    return 'sha256' in h ? h.sha256 : undefined;
  };
  const evaluatorFile = path.resolve(repoRoot, plan.evaluatorSpec);
  const mcp = hash(plan.daedalus.specPath);
  const ev = hash(evaluatorFile);
  if (mcp === undefined || ev === undefined) {
    return DomainResult.fail([err('LOOP_PLAN_SPEC_MISMATCH', `cannot read ${mcp === undefined ? plan.daedalus.specPath : evaluatorFile}`)]);
  }
  if (mcp !== ev) {
    return DomainResult.fail([err('LOOP_PLAN_SPEC_MISMATCH', `the MCP server's spec ${plan.daedalus.specPath} (sha256 ${mcp.slice(0, 12)}) differs from the evaluator spec ${plan.evaluatorSpec} (sha256 ${ev.slice(0, 12)})`)]);
  }
  return DomainResult.ok({ mcpSpecSha256: mcp, evaluatorSpecSha256: ev });
}

function validateProfiles(raw: unknown): DomainError[] {
  if (!isRecord(raw)) return [err('LOOP_PLAN_INVALID', 'taskProfiles must be an object keyed by task id')];
  const errors: DomainError[] = [];
  for (const [id, p] of Object.entries(raw)) {
    const bad = (m: string): void => {
      errors.push(err('LOOP_PLAN_INVALID', `taskProfiles.${id}: ${m}`));
    };
    if (!isRecord(p)) {
      bad('must be { style, specMode?, evaluatorSpec?, contexts? }');
      continue;
    }
    if (!(LOOP_STYLES as readonly unknown[]).includes(p.style)) bad(`style must be one of ${LOOP_STYLES.join(', ')}`);
    const mode = p.specMode ?? 'static';
    if (mode !== 'static' && mode !== 'ise-step1') bad('specMode must be static or ise-step1');
    if (mode === 'static' && (typeof p.evaluatorSpec !== 'string' || p.evaluatorSpec === '')) bad('a static profile needs evaluatorSpec');
    if (mode === 'ise-step1' && p.evaluatorSpec !== undefined) bad('an ise-step1 profile has no evaluatorSpec (the spec is frozen after step 1)');
    if (mode === 'ise-step1' && p.style !== 'ddd') bad('ise-step1 is for the ddd style only');
    const ctx = p.contexts;
    if (p.style === 'ddd') {
      const ok =
        Array.isArray(ctx) &&
        ctx.length > 0 &&
        ctx.every((c) => isRecord(c) && typeof c.root === 'string' && CONTEXT_ROOT_RE.test(c.root) && typeof c.part === 'string' && c.part.trim() !== '') &&
        new Set(ctx.map((c) => (c as { root: string }).root)).size === ctx.length;
      if (!ok) bad('a ddd profile needs contexts [{ root: "src/<name>/", part }] with distinct roots');
    } else if (ctx !== undefined) bad('only a ddd profile has contexts');
  }
  return errors;
}

/** The model calls of a plan (module header). */
export function planCallBudget(plan: Pick<LoopPlanFile, 'adapters' | 'arms' | 'runs'>, tasks: readonly LoopTask[]): CallBudget {
  const reps = plan.adapters.length * plan.runs;
  const steps = tasks.reduce((a, t) => a + t.steps.length, 0);
  const gate = plan.arms.includes('gate') ? 1 : 0;
  const stepTurns = steps * plan.arms.length * reps;
  const maxRepairTurns = steps * gate * reps;
  return { runs: tasks.length * plan.arms.length * reps, stepTurns, maxRepairTurns, maxCalls: stepTurns + maxRepairTurns };
}

/** Checks the profiles and the budget against the tasks file. */
export function checkPlanAgainstTasks(plan: LoopPlanFile, tasks: LoopTasksFile): DomainError[] {
  const errors: DomainError[] = [];
  const ids = new Set(tasks.tasks.map((t) => t.id));
  for (const id of Object.keys(plan.taskProfiles ?? {})) if (!ids.has(id)) errors.push(err('LOOP_PLAN_INVALID', `taskProfiles.${id}: no such task`));
  if (plan.evaluatorSpec === undefined) {
    for (const id of ids) if (plan.taskProfiles?.[id] === undefined) errors.push(err('LOOP_PLAN_INVALID', `task ${id} has no profile and the plan has no evaluatorSpec`));
  }
  if (plan.callBudget !== undefined) {
    const want = planCallBudget(plan, tasks.tasks);
    const b = plan.callBudget;
    if (b.runs !== want.runs || b.stepTurns !== want.stepTurns || b.maxRepairTurns !== want.maxRepairTurns || b.maxCalls !== want.maxCalls) {
      errors.push(err('LOOP_PLAN_INVALID', `callBudget ${JSON.stringify(plan.callBudget)} differs from the plan's ${JSON.stringify(want)}`));
    }
  }
  return errors;
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
  readonly claudeConfigDir?: string;
}

/** Plan-load checks a caller turns on (all OFF by default). */
export interface PlanLoadChecks {
  /** A plan with the `daedalus-mcp` arm must pin `specSha256` (R23). */
  readonly requireSpecSha256?: boolean;
}

/**
 * R23: when the plan pins `specSha256`, the evaluator spec and (for the `daedalus-mcp` arm) the MCP server's spec must
 * hash to it. With `requireSpecSha256`, a `daedalus-mcp` plan without the pin is refused.
 */
export function checkSpecEquality(plan: LoopPlanFile, repoRoot: string, checks: PlanLoadChecks = {}): DomainError[] {
  const mcp = plan.arms.includes('daedalus-mcp');
  if (plan.specSha256 === undefined) {
    return mcp && checks.requireSpecSha256 === true
      ? [err('LOOP_PLAN_INVALID', `the daedalus-mcp arm needs specSha256 (${SPEC_SHA_ENV}=1)`)]
      : [];
  }
  const files: [string, string][] = [];
  if (plan.evaluatorSpec !== undefined) files.push(['evaluatorSpec', path.resolve(repoRoot, plan.evaluatorSpec)]);
  for (const [id, p] of Object.entries(plan.taskProfiles ?? {})) {
    if (p.evaluatorSpec !== undefined) files.push([`taskProfiles.${id}.evaluatorSpec`, path.resolve(repoRoot, p.evaluatorSpec)]);
  }
  if (mcp && plan.daedalus !== undefined) files.push(['daedalus.specPath', path.resolve(repoRoot, plan.daedalus.specPath)]);
  const errors: DomainError[] = [];
  for (const [field, file] of files) {
    const h = specFileSha256(file);
    if ('error' in h) {
      errors.push(err('LOOP_FILE_UNREADABLE', `${field} ${file}: ${h.error}`));
      continue;
    }
    const got = h.sha256;
    if (got !== plan.specSha256) errors.push(err('LOOP_PLAN_SPEC_MISMATCH', `${field} ${file} has sha256 ${got}, the plan pins ${plan.specSha256}`));
  }
  return errors;
}

export interface LoadedPlan {
  readonly plan: LoopPlanFile;
  readonly tasks: LoopTasksFile;
  readonly tasksPath: string;
}

/** Loads the plan (with `"<local>"` fields filled from the overrides) and its tasks file. */
export function loadLoopPlan(planFile: string, repoRoot: string, local: LocalOverrides = {}, checks: PlanLoadChecks = {}): DomainResult<LoadedPlan> {
  const raw = readJson(planFile);
  if (!raw.success) return DomainResult.fail(raw.errors);
  const filled: Record<string, unknown> = isRecord(raw.data) ? { ...raw.data } : {};
  for (const k of ['binary', 'harnessRoot', 'outRoot'] as const) {
    const v = local[k];
    if (v !== undefined && (filled[k] === LOCAL || filled[k] === undefined)) filled[k] = v;
    else if (v !== undefined) return DomainResult.fail([err('LOOP_PLAN_INVALID', `--${k === 'harnessRoot' ? 'harness-root' : k === 'outRoot' ? 'out-root' : k} given but the plan pins ${k}`)]);
  }
  const cfg = local.claudeConfigDir;
  if (cfg !== undefined) {
    const iso = filled.generatorIsolation;
    if (!isRecord(iso)) return DomainResult.fail([err('LOOP_PLAN_INVALID', '--claude-config-dir given but the plan has no generatorIsolation block')]);
    if (iso.claudeConfigDir !== LOCAL) return DomainResult.fail([err('LOOP_PLAN_INVALID', '--claude-config-dir given but the plan pins claudeConfigDir')]);
    filled.generatorIsolation = { ...iso, claudeConfigDir: cfg };
  }
  const plan = validatePlan(filled);
  if (!plan.success) return DomainResult.fail(plan.errors);
  const tasksPath = path.resolve(repoRoot, plan.data.tasksFile);
  const rawTasks = readJson(tasksPath);
  if (!rawTasks.success) return DomainResult.fail(rawTasks.errors);
  const tasks = validateTasks(rawTasks.data);
  if (!tasks.success) return DomainResult.fail(tasks.errors);
  const cross = [...checkPlanAgainstTasks(plan.data, tasks.data), ...checkSpecEquality(plan.data, repoRoot, checks)];
  if (cross.length > 0) return DomainResult.fail(cross);
  const acc = plan.data.acceptance;
  if (acc?.enabled === true) {
    const rel = path.relative(path.resolve(plan.data.outRoot), path.resolve(acc.testsRoot));
    if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
      return DomainResult.fail([err('LOOP_PLAN_INVALID', 'acceptance.testsRoot must lie outside outRoot (the agents work under it)')]);
    }
  }
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
