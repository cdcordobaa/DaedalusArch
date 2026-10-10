/**
 * Run harness (FR-36; BR-U5b-45..49, 53..56, 64; U5b domain-entities §6; business-logic-model §6).
 *
 * `runPlan` takes an `ExperimentPlan` file through the fixed pipeline:
 * 1. load and validate the plan (ajv, `scripts/lib/schemas/experiment-plan.schema.json`);
 * 2. the pre-registration gate first (BR-U5b-50, 51): a refusal writes one `rejected` / `prereg-refused` record per
 *    plan entry and runs nothing;
 * 3. the SO5 code tables (`Docs/analysis-plan.md`, BR-U5b-64), refused when the block is missing or malformed;
 * 4. one environment record per plan run (the recorder is injected; `record-env.ts`, Step 15);
 * 5. expansion: the plan's `projects`, plus the E1 grid (models × spec levels × tasks × runs, BR-U5b-54) joined to
 *    U5a's `GenerationOutcome` under U5a's field names; an E1 plan whose entries of one task carry different
 *    evaluator `specSha` is refused (BR-U5b-53). An E1 grid also needs its registered generator plan
 *    (`experiments/<id>/generator-plan.json`, SO5-03): unregistered → `prereg-refused`; different from the grid →
 *    `E1_GENERATOR_PLAN_MISMATCH`. Each outcome is checked against it (`orderSeed`, `pilot`, template sha, adapter
 *    and grid coordinates, and `schedule.json`); a breach is a not-run `protocol-mismatch` cell
 *    (`GEN-PROTOCOL-MISMATCH`), and a coordinate without `generation.json` is a not-run `missing` cell
 *    (`GEN-MISSING`, SO5-05), so every grid coordinate yields a record with a `cell`;
 * 6. per entry: `not-run` when the generation status is not `ok` (`GEN-*` code from the `failureReason`, file range
 *    and permission denials are flags only); otherwise the built CLI as a subprocess (`ProcessRunner`,
 *    `buildChildEnv`, BR-U5b-55) with the experiment's cassette directory for judge modes (BR-U5b-56); one retry
 *    for a transport error only (BR-U5b-47); `incomplete` on a usage-limit stop (U4 exit 3, `JUDGE_RUN_INCOMPLETE`);
 *    acceptance by `acceptReport` (BR-U5b-45); a `RunRecord` with full provenance for every entry (BR-U5b-46, 53);
 * 7. every written artefact goes through `scrubDeep` with the known secrets (BR-U5b-70).
 *
 * ADR-028: `--neural-aggregation registered|proportional` and `--cassette-mode record|replay` pass to every judge-mode
 * child (`evaluate --neural-aggregation`, `--cassette-mode`); judge-mode RunRecords carry `neuralAggregation` (default
 * `registered`) and, when given, `cassetteMode`. A replay answers only from the plan's cassettes (a miss stops the run),
 * so a replayed plan makes no judge call; with `--out-dir` it writes beside the registered results, never over them.
 *
 * `--check-prereg <plan>` runs only the gate; `--dry-run <plan>` prints the expansion. Neither starts a subprocess
 * or writes a record. Results are written to the plan's `outDir` (`results/<plan-id>/`) only when a registered plan
 * runs; tests pass a temp `--out-dir` (BR-U5b-56).
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { Ajv } from 'ajv';
import type { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import type { ProcessResult, ProcessRunner } from '../src/shared/interfaces/process-runner.js';
import { buildChildEnv, NodeProcessRunner } from '../src/shared/process/node-process-runner.js';
import { e1Coordinates, e1ProjectId, missingE1Cell } from './lib/e1-cells.js';
import { loadPromptTemplate } from './lib/generators/prompt.js';
import { armPlanPathsFor, e1ArmsMismatches, generatorPlanPathFor, outcomeProtocolMismatches, readRegisteredPlan } from './lib/generators/registered-plan.js';
import type { ProtocolFields } from './lib/generators/registered-plan.js';
import { scheduleFileName } from './lib/generators/schedule.js';
import { checkPreRegistration, repoRelative } from './lib/prereg.js';
import { INSTRUMENT_VERSION, parseInstrumentVersion } from '../src/fitness-compiler/role-exemptions.js';
import type { InstrumentVersion } from '../src/fitness-compiler/role-exemptions.js';
import type { PreregCheck, PreregCheckInput } from './lib/prereg.js';
import { acceptReport, knownSecretsOf, scrubbedJson, writeScrubbedJson } from './lib/report-io.js';
import type { GenerationCell, PinnedJudge, ReasonCode, RunRecord, RunStatus, SeedRef } from './lib/report-io.js';
import { cellGenCode, JOIN_GEN_CODES, loadSo5Codes } from './lib/so5-codes.js';
import { readGenerationEffort, treeLoc } from './lib/so5-size.js';
import type { So5Codes } from './lib/so5-codes.js';

export const RUN_RECORD_SCHEMA = 'scripts/lib/schemas/run-record.schema.json';
export const PLAN_SCHEMA = 'scripts/lib/schemas/experiment-plan.schema.json';
export const PLAN_INVALID = 'PLAN_INVALID';
export const E1_SPEC_MISMATCH = 'E1_SPEC_MISMATCH';
export const E1_GENERATOR_PLAN_MISMATCH = 'E1_GENERATOR_PLAN_MISMATCH';
/** ADR-015 item 5 / ADR-016 e: a cycle query over 30 s requires the Tarjan fallback. */
export const LATENCY_GATE_MS = 30_000;
export const USAGE_LIMIT_EXIT = 3;
export const JUDGE_RUN_INCOMPLETE = 'JUDGE_RUN_INCOMPLETE';
export const DEFAULT_CLI_TIMEOUT_MS = 1_800_000;
/** stdout cap of the CLI child (a corpus report can exceed the runner's 10 MiB default). */
export const MAX_REPORT_BYTES = 256 * 1024 * 1024;
/** Variables the CLI child sees (NFR-08); `buildChildEnv` copies only those defined in the parent. */
// USER and LOGNAME: the judge child (JUDGE_ENV_ALLOW) needs them to reach its macOS keychain login; without them
// the pinned CLI reports "Not logged in" at the init probe (E7 first attempt, 2026-10-09).
export const CLI_ENV_ALLOW: readonly string[] = Object.freeze([
  'PATH', 'HOME', 'USER', 'LOGNAME', 'TMPDIR', 'LANG', 'LC_ALL', 'NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD', 'GEMINI_API_KEY',
]);

/**
 * Extractor graph mode of a plan entry: the values of C1 `GraphMode` (`src/apg-extractor/types.ts`, ADR-021 SO2),
 * restated here because the harness imports no C1 module (BR-U5b-55); a unit test keeps the two equal.
 */
export const PLAN_GRAPH_MODES = ['full', 'ast-only'] as const;

/**
 * Report stage name of the timed universal cycle metric: the value of C8 `UNIVERSAL_CYCLE_STAGE`
 * (`src/scoring-engine/universal-metrics.ts`, ADR-021 SO2-2), re-declared here because BR-U5b-55 does not list that
 * C8 symbol; a test keeps the two equal (ADR-021 item 8).
 */
export const UNIVERSAL_CYCLE_STAGE = 'universal-metric:cyclicDependencyCount';
export type GraphMode = (typeof PLAN_GRAPH_MODES)[number];

export type ExperimentKind = 'E1' | 'E7' | 'SO4' | 'latency-gate' | 'sensitivity' | 'fixtures' | 'apg-ablation';
export type PlanMode = 'symbolic-only' | 'neuronal-only' | 'full';
export type SpecLevel = GenerationCell['specLevel'];

export interface PlanProject {
  readonly projectId: string; readonly path: string; readonly specPath: string;
  readonly cell?: GenerationCell; readonly seed?: SeedRef;
  /** Extractor graph mode of this entry (default `full`); `ast-only` is the APG ablation arm (ADR-021 SO2). */
  readonly graphMode?: GraphMode;
}
export interface E1Grid {
  readonly outcomesRoot: string;
  readonly style: string;
  readonly models: readonly string[];
  readonly specLevels: readonly SpecLevel[];
  readonly tasks: readonly { readonly taskId: string; readonly specPath: string }[];
  readonly runs: number;
}
export interface ExperimentPlan {
  readonly id: string;
  readonly experiment: ExperimentKind;
  readonly mode: PlanMode;
  /**
   * Registered symbolic instrument version of every entry (ADR-026; default v2). A plan that registers `v1` (the
   * `e7-corpus-v1sym` re-evaluation, analysis plan §10 B8) runs v1 without a CLI flag; `--instrument` may only repeat it.
   */
  readonly instrument?: 'v1' | 'v2';
  readonly judge?: { readonly provider: string; readonly model: string };
  readonly seeds: { readonly sampling: number; readonly bootstrap: number; readonly permutation: number };
  readonly cassetteDir: string;
  readonly fixAttempts?: readonly { readonly functionId: string; readonly ref: string }[];
  readonly outDir: string;
  readonly projects: readonly PlanProject[];
  /** Registered E1 grid parameters (DV-U5b-14); expanded into entries joined to U5a outcomes. */
  readonly e1?: E1Grid;
}

/** One expanded plan entry. `grid` is set for E1 grid entries (joined to the outcome at run time). */
export interface PlanEntry {
  readonly index: number;
  readonly projectId: string;
  readonly path: string;
  readonly specPath: string;
  readonly cell?: GenerationCell;
  readonly seed?: SeedRef;
  readonly graphMode?: GraphMode;
  readonly grid?: { readonly modelId: string; readonly taskId: string; readonly specLevel: SpecLevel; readonly runIndex: number; readonly outcomeDir: string };
}

// ---------------------------------------------------------------------------------------------
// Validation (ajv)

const validators = new Map<string, { plan: ValidateFunction; record: ValidateFunction }>();

function schemaValidators(schemaRoot: string): { plan: ValidateFunction; record: ValidateFunction } {
  const key = resolve(schemaRoot);
  const cached = validators.get(key);
  if (cached !== undefined) return cached;
  const ajv = new Ajv({ strict: true, allErrors: true });
  addFormats(ajv);
  const recordSchema = JSON.parse(readFileSync(join(key, RUN_RECORD_SCHEMA), 'utf8')) as Record<string, unknown>;
  ajv.addSchema(recordSchema);
  const record = ajv.getSchema(String(recordSchema.$id));
  const plan = ajv.compile(JSON.parse(readFileSync(join(key, PLAN_SCHEMA), 'utf8')) as Record<string, unknown>);
  if (record === undefined) throw new Error('run-record schema did not compile');
  const v = { plan, record };
  validators.set(key, v);
  return v;
}

function ajvErrors(fn: ValidateFunction): string {
  return (fn.errors ?? []).map((e) => `${e.instancePath === '' ? '/' : e.instancePath} ${e.message ?? 'invalid'}`).join('; ');
}

/** Validates a `RunRecord` against `run-record.schema.json` (BR-U5b-53); returns the problems. */
export function validateRunRecord(value: unknown, schemaRoot: string): string[] {
  const { record } = schemaValidators(schemaRoot);
  return record(value) ? [] : [ajvErrors(record)];
}

export function loadPlan(planFile: string, schemaRoot: string): { ok: true; plan: ExperimentPlan } | { ok: false; code: string; detail: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(planFile, 'utf8')) as unknown;
  } catch (e) {
    return { ok: false, code: PLAN_INVALID, detail: `${planFile}: ${e instanceof Error ? e.message : String(e)}` };
  }
  const { plan } = schemaValidators(schemaRoot);
  if (!plan(raw)) return { ok: false, code: PLAN_INVALID, detail: `${planFile}: ${ajvErrors(plan)}` };
  const p = raw as ExperimentPlan;
  if (p.cassetteDir !== `experiments/${p.id}/cassettes`) {
    return { ok: false, code: PLAN_INVALID, detail: `${planFile}: cassetteDir must be experiments/${p.id}/cassettes (BR-U5b-56)` };
  }
  if (p.mode !== 'symbolic-only' && p.judge === undefined) return { ok: false, code: PLAN_INVALID, detail: `${planFile}: a ${p.mode} plan pins its judge` };
  return { ok: true, plan: p };
}

// ---------------------------------------------------------------------------------------------
// Expansion (BR-U5b-53, 54)

export function sha256Of(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function expandPlan(plan: ExperimentPlan, repoRoot: string): { ok: true; entries: PlanEntry[] } | { ok: false; code: string; detail: string } {
  const entries: PlanEntry[] = plan.projects.map((p, index) => ({
    index, projectId: p.projectId, path: p.path, specPath: p.specPath,
    ...(p.cell !== undefined && { cell: p.cell }), ...(p.seed !== undefined && { seed: p.seed }),
    ...(p.graphMode !== undefined && { graphMode: p.graphMode }),
  }));
  if (plan.e1 !== undefined) {
    for (const c of e1Coordinates(plan.e1)) {
      entries.push({
        index: entries.length, projectId: e1ProjectId(c), path: c.outcomeDir, specPath: c.specPath,
        grid: { modelId: c.modelId, taskId: c.taskId, specLevel: c.specLevel, runIndex: c.runIndex, outcomeDir: c.outcomeDir },
      });
    }
  }
  if (plan.experiment === 'E1') {
    const shaByTask = new Map<string, string>();
    for (const e of entries) {
      const taskId = e.grid?.taskId ?? e.cell?.taskId;
      if (taskId === undefined) continue;
      const file = resolve(repoRoot, e.specPath);
      if (!existsSync(file)) return { ok: false, code: PLAN_INVALID, detail: `spec ${e.specPath} not found` };
      const sha = sha256Of(file);
      const seen = shaByTask.get(taskId);
      if (seen !== undefined && seen !== sha) {
        return { ok: false, code: E1_SPEC_MISMATCH, detail: `task ${taskId}: entries carry different evaluator specSha (${seen.slice(0, 12)} vs ${sha.slice(0, 12)}); E1 evaluates every spec level of a task with one spec (BR-U5b-53)` };
      }
      shaByTask.set(taskId, sha);
    }
  }
  return { ok: true, entries };
}

interface OutcomeFile {
  readonly status: GenerationCell['generationStatus'];
  readonly failureReason?: GenerationCell['failureReason'];
  readonly requestedModelId: string; readonly resolvedModelId?: string; readonly adapterId: string;
  readonly promptTemplateId: string; readonly specLevel: SpecLevel; readonly taskId: string; readonly runIndex: number;
  readonly fileCount: number; readonly fileCountInRange: boolean; readonly permissionDenials: number;
}

export const GENERATION_JSON = 'generation.json';

/** The registered generator protocol an E1 outcome is checked against (SO5-03). */
export interface E1Protocol {
  readonly orderSeed: number;
  /** The committed template sha of `<specLevel>/<taskId>`; `undefined` when unreadable. */
  readonly templateSha: (specLevel: SpecLevel, taskId: string) => string | undefined;
  /** Set when `<outcomesRoot>/schedule.json` is missing or disagrees with the registered plan. */
  readonly scheduleProblem?: string;
  /**
   * Per model (ADR-029): the arm's `orderSeed`, adapter id and schedule problem. A model listed here is checked against
   * its own arm; the top-level fields apply to a model that is not (the single-arm form).
   */
  readonly arms?: Readonly<Record<string, E1ArmProtocol>>;
}

/** One registered arm plan as the join check reads it (ADR-029). */
export interface E1ArmProtocol {
  readonly orderSeed: number;
  readonly adapterId: string;
  readonly scheduleProblem?: string;
}

export type JoinResult =
  | { readonly ok: true; readonly cell: GenerationCell }
  /** `cell` is the not-run cell of a grid entry (`missing` or `protocol-mismatch`); `detail` starts with its GEN code. */
  | { readonly ok: false; readonly detail: string; readonly cell?: GenerationCell };

/**
 * Joins a grid entry to U5a's `generation.json` under U5a's field names (BR-U5a-48, BR-U5b-53). With `protocol`
 * (every E1 run), the outcome must also conform to the registered generator plan (SO5-03); a missing outcome is a
 * `missing` cell (SO5-05).
 */
export function joinOutcome(entry: PlanEntry, style: string, repoRoot: string, protocol?: E1Protocol): JoinResult {
  if (entry.grid === undefined) return entry.cell !== undefined ? { ok: true, cell: entry.cell } : { ok: false, detail: 'entry has no generation cell' };
  const g = entry.grid;
  const outcomePath = join(g.outcomeDir, GENERATION_JSON);
  const coord = { modelId: g.modelId, specLevel: g.specLevel, taskId: g.taskId, specPath: entry.specPath, runIndex: g.runIndex, outcomeDir: g.outcomeDir };
  const arm = protocol?.arms?.[g.modelId];
  const armAdapter = arm?.adapterId ?? 'claude-code-cli';
  const file = resolve(repoRoot, outcomePath);
  if (!existsSync(file)) {
    return { ok: false, detail: `${JOIN_GEN_CODES.missing}: generation outcome ${outcomePath} missing`, cell: missingE1Cell(coord, style, outcomePath, armAdapter) };
  }
  // A protocol-mismatch cell sits at the grid entry's own coordinate (model, task, level, run, template id, style,
  // adapter): the outcome's declared coordinates are what the check distrusts, so only its counts are kept as
  // evidence (SO5-03, SO5-05 "one row per E1 cell").
  const mismatch = (why: string, evidence?: GenerationCell): JoinResult => {
    const cell: GenerationCell = {
      ...missingE1Cell(coord, style, outcomePath, armAdapter),
      generationStatus: 'protocol-mismatch',
      ...(evidence !== undefined && typeof evidence.fileCount === 'number' && { fileCount: evidence.fileCount }),
      ...(evidence !== undefined && typeof evidence.fileCountInRange === 'boolean' && { fileCountInRange: evidence.fileCountInRange }),
      ...(evidence !== undefined && typeof evidence.permissionDenials === 'number' && { permissionDenials: evidence.permissionDenials }),
    };
    return { ok: false, detail: `${JOIN_GEN_CODES['protocol-mismatch']}: generation outcome ${outcomePath}: ${why}`, cell };
  };
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8')) as unknown;
  } catch {
    return mismatch('not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return mismatch('not a JSON object');
  const o = raw as OutcomeFile;
  const runIndex = o.runIndex;
  if (runIndex !== 0 && runIndex !== 1 && runIndex !== 2) return mismatch(`runIndex ${String(runIndex)}`);
  const joined: GenerationCell = {
      requestedModelId: o.requestedModelId,
      ...(o.resolvedModelId !== undefined && { resolvedModelId: o.resolvedModelId }),
      adapterId: o.adapterId, promptTemplateId: o.promptTemplateId, style, specLevel: o.specLevel, taskId: o.taskId, runIndex,
      generationOutcomePath: outcomePath, generationStatus: o.status,
      ...(o.failureReason !== undefined && { failureReason: o.failureReason }),
      fileCount: o.fileCount, fileCountInRange: o.fileCountInRange, permissionDenials: o.permissionDenials,
  };
  if (protocol !== undefined) {
    const scheduleProblem = arm !== undefined ? arm.scheduleProblem : protocol.scheduleProblem;
    const problems = [
      ...(scheduleProblem !== undefined ? [scheduleProblem] : []),
      ...outcomeProtocolMismatches(raw as Record<string, unknown>, {
        modelId: g.modelId, taskId: g.taskId, specLevel: g.specLevel, runIndex: g.runIndex, orderSeed: arm?.orderSeed ?? protocol.orderSeed,
        adapterId: armAdapter, promptTemplateSha256: protocol.templateSha(g.specLevel, g.taskId),
      }),
    ];
    if (problems.length > 0) return mismatch(problems.join('; '), joined);
  }
  // ADR-021 SO5-07, X-3: LOC of the tree this entry evaluates and the generation effort, on a joined outcome only.
  const outcomeDir = resolve(repoRoot, g.outcomeDir);
  return { ok: true, cell: { ...joined, loc: treeLoc(outcomeDir), ...readGenerationEffort(outcomeDir, raw as Record<string, unknown>) } };
}

/**
 * The registered generator protocol of an E1 plan (SO5-03; ADR-029): every arm plan beside the experiment plan
 * (`generator-plan.json`, `generator-plan-<arm>.json`) must be a registered artefact (`frozenHashes`); together they
 * must agree with the `e1` block (`e1ArmsMismatches`: same levels, tasks, runs, style and `outRoot`; disjoint model
 * sets covering `e1.models`); each arm's schedule file under `outcomesRoot` (`schedule.json`, or
 * `schedule-codex-cli.json` for the Codex arm) must carry that arm's `orderSeed` and plan sha256.
 */
export function e1ProtocolOf(
  plan: ExperimentPlan, planFile: string, repoRoot: string, frozenHashes: Readonly<Record<string, string>>,
): { ok: true; protocol: E1Protocol } | { ok: false; refusal: 'plan-unregistered' | 'mismatch' | 'invalid'; detail: string } {
  const grid = plan.e1;
  if (grid === undefined) return { ok: false, refusal: 'invalid', detail: 'plan has no e1 block' };
  const genRel = generatorPlanPathFor(repoRelative(repoRoot, planFile));
  const armRels = armPlanPathsFor(repoRelative(repoRoot, planFile), repoRoot);
  const rels = armRels.includes(genRel) ? armRels : [genRel, ...armRels];
  const arms: { rel: string; sha: string; plan: ProtocolFields }[] = [];
  for (const rel of rels) {
    const registeredSha = frozenHashes[rel];
    if (registeredSha === undefined) return { ok: false, refusal: 'plan-unregistered', detail: `E1 generator plan ${rel} is not a registered artefact` };
    const reg = readRegisteredPlan(resolve(repoRoot, rel), repoRoot);
    if (!reg.ok) return { ok: false, refusal: 'invalid', detail: reg.detail };
    arms.push({ rel, sha: registeredSha, plan: reg.plan });
  }
  const diff = e1ArmsMismatches(arms.map((a) => a.plan), grid, repoRoot);
  if (diff.length > 0) return { ok: false, refusal: 'mismatch', detail: `${rels.join(' + ')} differ from the e1 block in ${diff.join(', ')}` };
  const scheduleProblemOf = (arm: { rel: string; sha: string; plan: ProtocolFields }): string | undefined => {
    const name = scheduleFileName(arm.plan);
    const scheduleFile = join(resolve(repoRoot, grid.outcomesRoot), name);
    if (!existsSync(scheduleFile)) return `${name} missing under outcomesRoot`;
    try {
      const sched = JSON.parse(readFileSync(scheduleFile, 'utf8')) as { orderSeed?: unknown; generatorPlan?: { sha256?: unknown } };
      if (sched.orderSeed !== arm.plan.orderSeed) return `${name} orderSeed ${JSON.stringify(sched.orderSeed ?? null)} != ${String(arm.plan.orderSeed)}`;
      if (sched.generatorPlan?.sha256 !== arm.sha) return `${name} was not written from the registered ${arm.rel}`;
      return undefined;
    } catch {
      return `${name} is not JSON`;
    }
  };
  const armProtocols: Record<string, E1ArmProtocol> = {};
  for (const arm of arms) {
    const problem = scheduleProblemOf(arm);
    for (const a of arm.plan.adapters) {
      armProtocols[a.modelId] = { orderSeed: arm.plan.orderSeed, adapterId: a.adapterId, ...(problem !== undefined ? { scheduleProblem: problem } : {}) };
    }
  }
  const first = arms[0];
  if (first === undefined) return { ok: false, refusal: 'invalid', detail: 'no E1 generator plan' };
  const scheduleProblem = scheduleProblemOf(first);
  const shas = new Map<string, string | undefined>();
  const templateSha = (specLevel: SpecLevel, taskId: string): string | undefined => {
    const k = `${specLevel}/${taskId}`;
    if (!shas.has(k)) {
      const t = loadPromptTemplate(repoRoot, specLevel, taskId as never);
      shas.set(k, t.success ? t.data.promptTemplateSha256 : undefined);
    }
    return shas.get(k);
  };
  return { ok: true, protocol: { orderSeed: first.plan.orderSeed, templateSha, arms: armProtocols, ...(scheduleProblem !== undefined ? { scheduleProblem } : {}) } };
}

// ---------------------------------------------------------------------------------------------
// Latency gate (BR-U5b-49)

export type LatencyGateResult = 'pass' | 'fallback-required';

/**
 * A cycle query over 30 s, or a function timeout on the project, requires the Tarjan fallback. This is the
 * per-report rule for an accepted report; the gate over every RunRecord of the latency-gate plan, including
 * rejected runs whose cycle query timed out, is `latencyGateOf` in `scripts/lib/so2.ts` (ADR-021 SO2; audit SO2-1).
 */
export function latencyGate(cycleQueryMs: readonly number[], functionTimeout = false): LatencyGateResult {
  return functionTimeout || cycleQueryMs.some((ms) => ms > LATENCY_GATE_MS) ? 'fallback-required' : 'pass';
}

/** Report fields the cycle query times are read from. */
export interface CycleTimedReport {
  readonly functionResults?: readonly { readonly name?: string; readonly executionTimeMs?: number }[];
  readonly timings?: { readonly stages?: readonly { readonly name: string; readonly durationMs: number }[] };
}

/**
 * Cycle query times of a report (ADR-016 e: both cycle queries): the `no-cyclic-deps` function rows
 * (`executionTimeMs`, FF-S02) and the universal cycle metric's timing entry (`UNIVERSAL_CYCLE_STAGE`,
 * ADR-021 SO2; audit SO2-2), in that order.
 */
export function cycleQueryTimes(report: CycleTimedReport): number[] {
  const template = (report.functionResults ?? []).filter((r) => r.name === 'no-cyclic-deps' && typeof r.executionTimeMs === 'number').map((r) => r.executionTimeMs ?? 0);
  const metric = (report.timings?.stages ?? []).filter((st) => st.name === UNIVERSAL_CYCLE_STAGE).map((st) => st.durationMs);
  return [...template, ...metric];
}

// ---------------------------------------------------------------------------------------------
// Subprocess (BR-U5b-47, 55, 56)

export function modeFlags(mode: PlanMode): string[] {
  return mode === 'symbolic-only' ? ['--symbolic-only'] : mode === 'neuronal-only' ? ['--neuronal-only'] : [];
}

/**
 * The CLI arguments of one entry. Judge modes add the plan's pinned judge and the experiment's cassette directory
 * (BR-U5b-56); a symbolic-only run makes no judge call and passes neither (DV-U5b-15).
 */
/** ADR-028 judge-mode options of a plan run (absent = the CLI defaults: record, registered). */
export interface JudgeRunOptions {
  readonly cassetteMode?: CassetteMode;
  readonly neuralAggregation?: NeuralAggregationRule;
}
export type CassetteMode = 'record' | 'replay';
export type NeuralAggregationRule = 'registered' | 'proportional';
export const CASSETTE_MODES: readonly CassetteMode[] = ['record', 'replay'];
export const NEURAL_AGGREGATION_RULES: readonly NeuralAggregationRule[] = ['registered', 'proportional'];

export function cliArgv(
  plan: ExperimentPlan, entry: PlanEntry, instrumentVersion: InstrumentVersion = INSTRUMENT_VERSION, judge: JudgeRunOptions = {},
): string[] {
  const argv = ['evaluate', '--project', entry.path, '--spec', entry.specPath, '--format', 'json', ...modeFlags(plan.mode)];
  if (entry.graphMode !== undefined && entry.graphMode !== 'full') argv.push('--graph-mode', entry.graphMode);
  argv.push('--instrument', `v${String(instrumentVersion)}`); // ADR-026
  if (plan.mode !== 'symbolic-only') {
    if (plan.judge !== undefined) argv.push('--llm-provider', plan.judge.provider, '--llm-model', plan.judge.model);
    // ADR-021 SO3-5: the judge cassette entries carry the run's project id (repetition reliability keys on it).
    argv.push('--cassette-dir', plan.cassetteDir, '--cassette-project-id', entry.projectId);
    if (judge.cassetteMode !== undefined) argv.push('--cassette-mode', judge.cassetteMode);
    if (judge.neuralAggregation !== undefined) argv.push('--neural-aggregation', judge.neuralAggregation);
  }
  return argv;
}

export type AttemptOutcome =
  | { readonly kind: 'report'; readonly report: unknown; readonly exitCode: number }
  | { readonly kind: 'transport'; readonly detail: string }
  | { readonly kind: 'timeout'; readonly detail: string }
  | { readonly kind: 'incomplete'; readonly detail: string };

function tail(text: string, n = 400): string {
  const t = text.trim();
  return t.length <= n ? t : `…${t.slice(t.length - n)}`;
}

/** Classifies one CLI attempt. A run that wrote no report (not timed out, not a usage stop) is a transport error. */
export function classifyAttempt(spawn: { ok: true; result: ProcessResult } | { ok: false; detail: string }): AttemptOutcome {
  if (!spawn.ok) return { kind: 'transport', detail: `spawn failed: ${spawn.detail}` };
  const r = spawn.result;
  if (r.timedOut) return { kind: 'timeout', detail: `CLI timed out after ${String(r.durationMs)} ms` };
  if (r.exitCode === USAGE_LIMIT_EXIT || r.stderr.includes(JUDGE_RUN_INCOMPLETE)) {
    return { kind: 'incomplete', detail: `usage limit or auth stop (exit ${String(r.exitCode)}): ${tail(r.stderr)}` };
  }
  const text = r.stdout.trim();
  if (text.startsWith('{')) {
    try {
      return { kind: 'report', report: JSON.parse(text) as unknown, exitCode: r.exitCode };
    } catch {
      // fall through: no readable report
    }
  }
  return { kind: 'transport', detail: `CLI exit ${String(r.exitCode)} before a report was written: ${tail(r.stderr)}` };
}

// ---------------------------------------------------------------------------------------------
// The run (BR-U5b-45..48, 53, 70)

export interface EnvironmentStamp { readonly id: string; readonly record: unknown }

export interface HarnessDeps {
  readonly runner: ProcessRunner;
  /** The built CLI: `command` and leading `args` (default `tsx bin/firewall.ts`, DV-U5b-4 note of Step 7). */
  readonly cli: { readonly command: string; readonly args: readonly string[] };
  readonly parentEnv: NodeJS.ProcessEnv;
  readonly now: () => Date;
  readonly cliCommit: string;
  /** One environment record per plan run (Step 15 `record-env.ts`). */
  readonly recordEnvironment: (planId: string) => Promise<EnvironmentStamp>;
  /** The pre-registration gate (default `checkPreRegistration`). */
  readonly gate?: (input: PreregCheckInput) => PreregCheck;
  /** Where the schemas are read from (default the repository root). */
  readonly schemaRoot?: string;
  /** Overrides the plan's `outDir` (tests write to a temp directory, BR-U5b-56). */
  readonly outDir?: string;
  /** Symbolic instrument version passed to every child and stamped into every RunRecord (ADR-026; default 2). */
  readonly instrumentVersion?: InstrumentVersion;
  /** ADR-028: cassette mode and neural aggregation passed to every judge-mode child and stamped into its RunRecord. */
  readonly judge?: JudgeRunOptions;
  readonly timeoutMs?: number;
  /** Working directory of the CLI child (default the repository root). */
  readonly cwd?: string;
  /** Extra child variables (e.g. `APG_STORE_PATH` of a temp store). */
  readonly extraEnv?: Readonly<Record<string, string>>;
}

export interface RunPlanResult {
  readonly ok: boolean;
  readonly code?: string;
  readonly detail?: string;
  readonly records: readonly RunRecord[];
  readonly outDir: string;
}

/** Known secrets (BR-U5b-70): the values of `NEO4J_PASSWORD` and `GEMINI_API_KEY` in the parent environment. */
export const knownSecrets = knownSecretsOf;

export function runIdOf(planId: string, entry: PlanEntry): string {
  return `${planId}-${String(entry.index).padStart(3, '0')}-${entry.projectId.replace(/[^A-Za-z0-9._-]/g, '_')}`;
}

/** Existing records of the plan in `<outDir>/runs/` (for gate condition (b)). */
/**
 * Committed results carry no absolute path (`Docs/analysis-plan.md` §2 paths; NFR-05 portability): every string of a
 * RunRecord or report has the repository root prefix removed and the prefix of the repository's parent (where the
 * sibling `../daedalus-*` directories live) replaced by `../`. Extractor warnings quote ts-morph type text such as
 * `import("/abs/clone/src/x")`, which otherwise lands in `results/` verbatim.
 */
export function relativizePaths<T>(value: T, repoRoot: string): T {
  const root = resolve(repoRoot);
  const pairs: [string, string][] = [[`${root}${sep}`, ''], [`${dirname(root)}${sep}`, `..${sep}`]];
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return pairs.reduce((t, [from, to]) => t.split(from).join(to), v);
    if (Array.isArray(v)) return v.map(walk);
    if (v !== null && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value) as T;
}

export function existingRecords(outDir: string): RunRecord[] {
  const dir = join(outDir, 'runs');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.run.json')).sort().map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as RunRecord);
}

/**
 * The instrument version of a plan run: the plan's registered `instrument`, else the caller's (`--instrument`), else
 * the default. A caller version that differs from the registered one is a refusal (`detail`), never an override.
 */
export function planInstrumentVersion(plan: ExperimentPlan, requested: InstrumentVersion | undefined): { ok: true; version: InstrumentVersion } | { ok: false; detail: string } {
  const registered = plan.instrument === undefined ? undefined : parseInstrumentVersion(plan.instrument);
  if (registered !== undefined && requested !== undefined && registered !== requested) {
    return { ok: false, detail: `plan ${plan.id} registers instrument v${String(registered)}; --instrument v${String(requested)} cannot override it (ADR-026)` };
  }
  return { ok: true, version: registered ?? requested ?? INSTRUMENT_VERSION };
}

export async function runPlan(plan: ExperimentPlan, planFile: string, repoRoot: string, callerDeps: HarnessDeps): Promise<RunPlanResult> {
  const instrument = planInstrumentVersion(plan, callerDeps.instrumentVersion);
  if (!instrument.ok) return { ok: false, code: PLAN_INVALID, detail: instrument.detail, records: [], outDir: resolve(repoRoot, callerDeps.outDir ?? plan.outDir) };
  const deps: HarnessDeps = { ...callerDeps, instrumentVersion: instrument.version };
  const schemaRoot = deps.schemaRoot ?? repoRoot;
  const outDir = resolve(repoRoot, deps.outDir ?? plan.outDir);
  const secrets = knownSecrets(deps.parentEnv);
  const scrub = <T>(v: T): T => relativizePaths(scrubbedJson(v, secrets), repoRoot);
  const records: RunRecord[] = [];
  const emit = (record: RunRecord): void => {
    const clean = scrub(record);
    const problems = validateRunRecord(clean, schemaRoot);
    if (problems.length > 0) throw new Error(`RunRecord ${clean.runId} fails run-record.schema.json: ${problems.join('; ')}`);
    writeScrubbedJson(join(outDir, 'runs', `${clean.runId}.run.json`), clean, secrets);
    records.push(clean);
  };

  const expanded = expandPlan(plan, repoRoot);
  if (!expanded.ok) return { ok: false, code: expanded.code, detail: expanded.detail, records, outDir };
  const entries = expanded.entries;
  const specPaths = [...new Set(entries.map((e) => e.specPath))];

  // Pre-registration gate first (BR-U5b-50).
  const gate = (deps.gate ?? checkPreRegistration)({
    repoRoot, schemaRoot, planPath: repoRelative(repoRoot, planFile), specPaths,
    records: existingRecords(outDir).filter((r) => r.planId === plan.id), now: deps.now(),
  });
  const specShaOf = (spec: string): string => sha256Of(resolve(repoRoot, spec));
  const refuseAll = (refusal: string, detail: string): RunPlanResult => {
    for (const entry of entries) {
      emit({
        runId: runIdOf(plan.id, entry), planId: plan.id, projectId: entry.projectId, status: 'rejected',
        reasonCode: 'prereg-refused', reasonDetail: `${refusal}: ${detail}`, attempt: 1,
        specSha: specShaOf(entry.specPath), cliCommit: deps.cliCommit, preregVersion: 0, frozenHashes: {},
        instrumentVersion: deps.instrumentVersion ?? INSTRUMENT_VERSION,
        envRecordId: 'none (pre-registration refused)', startedAt: deps.now().toISOString(), wallMs: 0,
        ...(entry.seed !== undefined && { seed: entry.seed }),
      });
    }
    return { ok: false, code: 'PREREG_REFUSED', detail, records, outDir };
  };
  if (!gate.ok) return refuseAll(gate.refusal, gate.detail);

  // SO5-03: an E1 grid runs only against its registered generator plan.
  let e1Protocol: E1Protocol | undefined;
  if (plan.e1 !== undefined) {
    const proto = e1ProtocolOf(plan, planFile, repoRoot, gate.frozenHashes);
    if (!proto.ok) {
      if (proto.refusal === 'plan-unregistered') return refuseAll(proto.refusal, proto.detail);
      return { ok: false, code: proto.refusal === 'mismatch' ? E1_GENERATOR_PLAN_MISMATCH : PLAN_INVALID, detail: proto.detail, records, outDir };
    }
    e1Protocol = proto.protocol;
  }

  const so5 = loadSo5Codes(repoRoot);
  if (!so5.ok) return { ok: false, code: so5.code, detail: so5.detail, records, outDir };

  const env = await deps.recordEnvironment(plan.id);
  writeScrubbedJson(join(outDir, 'env', `${env.id}.json`), env.record, secrets);

  const pinnedJudge: PinnedJudge | undefined = plan.mode === 'symbolic-only' || plan.judge === undefined ? undefined : plan.judge;
  const childEnv = { ...buildChildEnv(deps.parentEnv, CLI_ENV_ALLOW), ...(deps.extraEnv ?? {}) };
  for (const entry of entries) {
    const record = await runEntry(plan, entry, {
      repoRoot, deps, so5: so5.codes, envRecordId: env.id, preregVersion: gate.prereg.version,
      frozenHashes: gate.frozenHashes, pinnedJudge, childEnv, outDir, scrub, secrets, specSha: specShaOf(entry.specPath),
      ...(e1Protocol !== undefined && { e1Protocol }),
    });
    emit(record);
  }
  return { ok: true, records, outDir };
}

interface EntryContext {
  readonly repoRoot: string;
  readonly deps: HarnessDeps;
  readonly so5: So5Codes;
  readonly envRecordId: string;
  readonly preregVersion: number;
  readonly frozenHashes: Readonly<Record<string, string>>;
  readonly pinnedJudge: PinnedJudge | undefined;
  readonly childEnv: Readonly<Record<string, string>>;
  readonly outDir: string;
  readonly scrub: <T>(v: T) => T;
  readonly secrets: readonly string[];
  readonly specSha: string;
  readonly e1Protocol?: E1Protocol;
}

/** ADR-028 RunRecord fields of a judge-mode plan: the neural aggregation (default registered) and a given cassette mode. */
export function judgeStamp(plan: ExperimentPlan, judge: JudgeRunOptions | undefined): Pick<RunRecord, 'neuralAggregation' | 'cassetteMode'> {
  if (plan.mode === 'symbolic-only') return {};
  return {
    neuralAggregation: judge?.neuralAggregation ?? 'registered',
    ...(judge?.cassetteMode !== undefined && { cassetteMode: judge.cassetteMode }),
  };
}

async function runEntry(plan: ExperimentPlan, entry: PlanEntry, ctx: EntryContext): Promise<RunRecord> {
  const startedAt = ctx.deps.now();
  const runId = runIdOf(plan.id, entry);
  let cell: GenerationCell | undefined = entry.cell;
  if (entry.grid !== undefined) {
    const joined = joinOutcome(entry, plan.e1?.style ?? 'unknown', ctx.repoRoot, ctx.e1Protocol);
    if (!joined.ok) {
      cell = joined.cell;
      return base('not-run', 'generation-failed', joined.detail, 1);
    }
    cell = joined.cell;
  }
  function base(status: RunStatus, reasonCode: ReasonCode | undefined, reasonDetail: string | undefined, attempt: 1 | 2, reportPath?: string): RunRecord {
    return {
      runId, planId: plan.id, projectId: entry.projectId, status,
      ...(reasonCode !== undefined && { reasonCode }), ...(reasonDetail !== undefined && { reasonDetail }),
      attempt, ...(reportPath !== undefined && { reportPath }),
      specSha: ctx.specSha, cliCommit: ctx.deps.cliCommit, preregVersion: ctx.preregVersion, frozenHashes: ctx.frozenHashes,
      instrumentVersion: ctx.deps.instrumentVersion ?? INSTRUMENT_VERSION,
      ...judgeStamp(plan, ctx.deps.judge),
      envRecordId: ctx.envRecordId, startedAt: startedAt.toISOString(), wallMs: Math.max(0, ctx.deps.now().getTime() - startedAt.getTime()),
      ...(cell !== undefined && { cell }), ...(entry.seed !== undefined && { seed: entry.seed }),
    };
  }
  if (cell !== undefined && cell.generationStatus !== 'ok') {
    const gen = cellGenCode(ctx.so5, cell);
    return base('not-run', 'generation-failed', gen ?? `generation ${cell.generationStatus} without failureReason`, 1);
  }

  const argv = [...ctx.deps.cli.args, ...cliArgv(plan, entry, ctx.deps.instrumentVersion ?? INSTRUMENT_VERSION, ctx.deps.judge)];
  let attempt: 1 | 2 = 1;
  let outcome: AttemptOutcome;
  for (;;) {
    const spawned = await ctx.deps.runner.run(ctx.deps.cli.command, argv, {
      cwd: ctx.deps.cwd ?? ctx.repoRoot, env: ctx.childEnv, timeoutMs: ctx.deps.timeoutMs ?? DEFAULT_CLI_TIMEOUT_MS,
      maxOutputBytes: MAX_REPORT_BYTES,
    });
    outcome = classifyAttempt(spawned.success ? { ok: true, result: spawned.data } : { ok: false, detail: spawned.errors.map((e) => e.message).join('; ') });
    if (outcome.kind === 'transport' && attempt === 1) {
      attempt = 2;
      continue;
    }
    break;
  }
  switch (outcome.kind) {
    case 'transport':
      return base('rejected', 'transport-error', ctx.scrub(outcome.detail), attempt);
    case 'timeout':
      return base('rejected', 'function-timeout', outcome.detail, attempt);
    case 'incomplete':
      return base('incomplete', 'usage-limit', ctx.scrub(outcome.detail), attempt);
    case 'report':
      break;
  }
  const reportPath = `reports/${runId}.json`;
  writeScrubbedJson(join(ctx.outDir, reportPath), relativizePaths(outcome.report, ctx.repoRoot), ctx.secrets);
  const acceptance = acceptReport(outcome.report, ctx.pinnedJudge === undefined ? {} : { pinnedJudge: ctx.pinnedJudge });
  if (acceptance.accepted) return base('accepted', undefined, undefined, attempt, reportPath);
  return base('rejected', acceptance.reasonCode, ctx.scrub(acceptance.reasonDetail), attempt, reportPath);
}

// ---------------------------------------------------------------------------------------------
// CLI

export const RUN_USAGE = [
  'Usage: npx tsx scripts/run-experiment-cli.ts <plan.json> [--out-dir <dir>] [--neo4j-container <name>] [--instrument v1|v2]',
  '         [--neural-aggregation registered|proportional] [--cassette-mode record|replay]   (judge modes, ADR-028)',
  '       npx tsx scripts/run-experiment-cli.ts --check-prereg <plan.json>   (gate only; exit 0 / 1)',
  '       npx tsx scripts/run-experiment-cli.ts --dry-run <plan.json>        (print the expansion)',
  '       npx tsx scripts/run-experiment-cli.ts --self-test',
].join('\n');

export interface RunMainIo {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
}

/** `deps` builds the harness dependencies lazily (only a real run needs them). */
export async function main(
  argv: readonly string[], repoRoot: string, io: RunMainIo,
  makeDeps: (opts: { readonly neo4jContainer?: string }) => HarnessDeps, schemaRoot: string = repoRoot,
): Promise<number> {
  const [first, second] = argv;
  if (first === '--self-test') {
    // Known-bad input: a plan whose spec lies outside corpus/specs/ and the fixture specs (BR-U5b-51).
    const refused = checkPreRegistration({ repoRoot, schemaRoot, planPath: 'experiments/self-test/plan.json', specPaths: ['specs/daedalus-arch.yaml'], records: [], now: new Date() });
    io.err(`${refused.ok ? 'gate passed' : `${refused.code}: ${refused.detail}`}\n`);
    return 1;
  }
  const loadAt = (p: string | undefined): { ok: true; plan: ExperimentPlan; file: string } | { ok: false } => {
    if (p === undefined) {
      io.err(`${RUN_USAGE}\n`);
      return { ok: false };
    }
    const file = isAbsolute(p) ? p : resolve(repoRoot, p);
    const loaded = loadPlan(file, schemaRoot);
    if (!loaded.ok) {
      io.err(`${loaded.code}: ${loaded.detail}\n`);
      return { ok: false };
    }
    return { ok: true, plan: loaded.plan, file };
  };
  if (first === '--check-prereg') {
    const l = loadAt(second);
    if (!l.ok) return 1;
    const expanded = expandPlan(l.plan, repoRoot);
    if (!expanded.ok) {
      io.err(`${expanded.code}: ${expanded.detail}\n`);
      return 1;
    }
    const outDir = resolve(repoRoot, l.plan.outDir);
    const gate = checkPreRegistration({
      repoRoot, schemaRoot, planPath: repoRelative(repoRoot, l.file), specPaths: [...new Set(expanded.entries.map((e) => e.specPath))],
      records: existingRecords(outDir).filter((r) => r.planId === l.plan.id), now: new Date(),
    });
    if (!gate.ok) {
      io.err(`${gate.code} (${gate.refusal}): ${gate.detail}\n`);
      return 1;
    }
    io.out(`pre-registration v${String(gate.prereg.version)} ok: ${String(Object.keys(gate.frozenHashes).length)} registered artefacts unchanged\n`);
    return 0;
  }
  if (first === '--dry-run') {
    const l = loadAt(second);
    if (!l.ok) return 1;
    const expanded = expandPlan(l.plan, repoRoot);
    if (!expanded.ok) {
      io.err(`${expanded.code}: ${expanded.detail}\n`);
      return 1;
    }
    for (const e of expanded.entries) io.out(`${runIdOf(l.plan.id, e)}\t${e.path}\t${e.specPath}\n`);
    io.out(`${String(expanded.entries.length)} entries\n`);
    return 0;
  }
  if (first === undefined || first.startsWith('--')) {
    io.err(`${RUN_USAGE}\n`);
    return 2;
  }
  let outDir: string | undefined;
  let neo4jContainer: string | undefined;
  let instrumentVersion: InstrumentVersion | undefined;
  let cassetteMode: CassetteMode | undefined;
  let neuralAggregation: NeuralAggregationRule | undefined;
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    const v = argv[i + 1];
    if (a === '--out-dir' && v !== undefined) outDir = argv[++i];
    else if (a === '--neo4j-container' && v !== undefined) neo4jContainer = argv[++i];
    else if (a === '--instrument' && v !== undefined && parseInstrumentVersion(v) !== undefined) {
      instrumentVersion = parseInstrumentVersion(v);
      i++;
    }
    else if (a === '--cassette-mode' && v !== undefined && (CASSETTE_MODES as readonly string[]).includes(v)) {
      cassetteMode = v as CassetteMode;
      i++;
    }
    else if (a === '--neural-aggregation' && v !== undefined && (NEURAL_AGGREGATION_RULES as readonly string[]).includes(v)) {
      neuralAggregation = v as NeuralAggregationRule;
      i++;
    }
    else {
      io.err(`${RUN_USAGE}\n`);
      return 2;
    }
  }
  const l = loadAt(first);
  if (!l.ok) return 1;
  const deps = makeDeps(neo4jContainer !== undefined ? { neo4jContainer } : {});
  const result = await runPlan(l.plan, l.file, repoRoot, {
    ...deps, schemaRoot, ...(outDir !== undefined && { outDir }), ...(instrumentVersion !== undefined && { instrumentVersion }),
    ...((cassetteMode !== undefined || neuralAggregation !== undefined) && {
      judge: { ...(cassetteMode !== undefined && { cassetteMode }), ...(neuralAggregation !== undefined && { neuralAggregation }) },
    }),
  });
  if (!result.ok) {
    io.err(`${result.code ?? 'RUN_FAILED'}: ${result.detail ?? ''}\n`);
    return 1;
  }
  const counts = new Map<string, number>();
  for (const r of result.records) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
  io.out(`${String(result.records.length)} records in ${result.outDir}: ${[...counts].map(([k, v]) => `${k} ${String(v)}`).join(', ')}\n`);
  return 0;
}

/** The default dependencies of a real run: the Node process runner and the `tsx bin/firewall.ts` CLI. */
export function defaultDeps(repoRoot: string, recordEnvironment: HarnessDeps['recordEnvironment'], cliCommit: string): HarnessDeps {
  return {
    runner: new NodeProcessRunner(),
    cli: { command: join(repoRoot, 'node_modules/.bin/tsx'), args: [join(repoRoot, 'bin/firewall.ts')] },
    parentEnv: process.env,
    now: () => new Date(),
    cliCommit,
    recordEnvironment,
  };
}
