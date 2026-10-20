/**
 * Gemini generator over the Antigravity CLI `agy` (decision CDX; design
 * `aidlc-docs/construction/v1.4/U5/functional-design/design.md` Part B; `Docs/v1.4/gemini-generator.md`).
 *
 * NOT YET THROUGH S4: every confinement fact below that is marked UNVERIFIED is the first job of the S4 probe
 * (`Docs/v1.4/gemini-s4-probe-spec.md`, probe ids in brackets). A live grid refuses this adapter until a committed S4
 * result passes (`agy-gen-plan.ts` `checkS4Result`).
 *
 * Reused from the labeller (`src/llm-critic/agy-cli-provider.ts`, imported, never copied): the env allow-list and set
 * values, the forbidden home names, the ancestor list, the stream reader and the version parser. NOT reused:
 * `classifyAgyResult`, `checkAgySettings`, `checkAgyHome`. They encode the labeller's contract (any completed tool is an
 * isolation stop; writes, commands and MCP denied; empty allow list; empty MCP config), which a generator fails by
 * design. The generator has its own settings and home checks here, with the same "key names and expected values only"
 * reporting.
 *
 * - argv: `--output-format stream-json --model <id> --sandbox --disable-slash-commands --print-timeout <n>s`; the
 *   prompt goes on stdin, never in argv (agy has no system-prompt flag; the arm sentence is in the prompt).
 * - env: `AGY_ENV_ALLOW` from the parent, `HOME = <arm home>`, `AGY_CLI_DISABLE_AUTO_UPDATE=true`; every `*_KEY` and
 *   `*_TOKEN` (so `GEMINI_API_KEY`) removed.
 * - one dedicated generator home per arm (never the labeller home), outside the repository, the out-root and every cwd;
 *   one lane per home (the harness rewrites the home's settings and MCP config before every turn).
 * - CONFINEMENT (U12, after the failed S4 run of 2026-10-19), three layers:
 *   1. the PreToolUse hook `agy-confine-hook.mjs` (matcher ".*", every tool), copied into the home with
 *      `.gemini/config/hooks.json` and a per-turn config (work directory, the exact type-check command, the arm, the
 *      hook log) by `writeAgyTurnFiles`: an allow-list, everything else denied, fail-closed;
 *   2. permission rules of the seven real agy action kinds only (read_file, write_file, command, read_url,
 *      execute_url, mcp, unsandboxed; https://antigravity.google/docs/permissions/);
 *   3. `--sandbox` and `enableTerminalSandbox: true`.
 * - settings (`.gemini/antigravity-cli/settings.json`, harness-owned): `toolPermission: strict`,
 *   `enableTerminalSandbox: true`, `disableSlashCommands: true`, never `allowNonWorkspaceAccess: true`; the allow list
 *   is EXACTLY this run's and arm's set; the deny list is `read_url(*)`, `execute_url(*)`, `unsandboxed(*)` and
 *   `mcp(*)` (none) or `mcp(daedalus-arch/evaluate_project)` (daedalus-mcp). The enforced backstops are the hook and
 *   the tool-escape stop of `agy-gen-events.ts`.
 * - MCP (`.gemini/config/mcp_config.json`, the path the labeller checks for emptiness; UNVERIFIED that agy re-reads it
 *   per call [G0, G9]): the `none` home lists no server; the `daedalus-mcp` home lists exactly `daedalus-arch`, written
 *   per turn with `--project <cwd>` and, when on, `--call-log <path>`.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { DomainError } from '../../../src/shared/errors/domain-result.js';
import { buildChildEnv } from '../../../src/shared/process/node-process-runner.js';
import {
  AGY_ENV_ALLOW,
  AGY_ENV_SET,
  AGY_HOME_FORBIDDEN_NAMES,
  findAgyAncestorContext,
} from '../../../src/llm-critic/agy-cli-provider.js';
import { typecheckCommand } from './argv.js';
import { DAEDALUS_ARM_TOOLS, DAEDALUS_DENIED_TOOLS, DAEDALUS_MCP_SERVER, daedalusMcpConfig } from './arms.js';
import type { DaedalusServerInput } from './arms.js';
import { isInsideOrEqual } from './config.js';
import { AGY_GEN_CLI_ADAPTER_ID } from './types.js';
import type { GeneratorCliConfig } from './types.js';

export { AGY_GEN_CLI_ADAPTER_ID };

/** The two arms a generator home serves (the `gate` arm runs with the `none` home). */
export type AgyGenArm = 'none' | 'daedalus-mcp';

export const AGY_GEN_SETTINGS_REL = '.gemini/antigravity-cli/settings.json';
/** UNVERIFIED (S4 G0, G9): that agy re-reads this file per call. */
export const AGY_GEN_MCP_CONFIG_REL = '.gemini/config/mcp_config.json';
const AGY_BUILTIN_DIR = '.gemini/antigravity-cli/builtin';

/** Print-timeout bounds: the default 1170 s makes the hard kill 1,200,000 ms = `DEFAULT_GENERATOR_TIMEOUT_MS`. */
export const AGY_GEN_PRINT_TIMEOUT_MIN_S = 60;
export const AGY_GEN_PRINT_TIMEOUT_MAX_S = 1170;
export const AGY_GEN_PRINT_TIMEOUT_DEFAULT_S = 1170;
export const AGY_GEN_KILL_GRACE_S = 30;

export const AGY_GEN_REQUIRED_SETTINGS: Readonly<Record<string, unknown>> = Object.freeze({
  toolPermission: 'strict',
  enableTerminalSandbox: true,
  disableSlashCommands: true,
});

/** Tools a generator turn may complete (file tools inside the workspace, the answer tool). */
export const AGY_GEN_FILE_TOOLS: readonly string[] = Object.freeze([
  'view_file',
  'list_dir',
  'find_by_name',
  'grep_search',
  'write_to_file',
  'replace_file_content',
  'multi_replace_file_content',
  'sed_file',
  // agy 1.4.2 stream-json names of the same file access (S4 run of 2026-10-19: `read_file` / `write_file` steps with
  // a `Path` parameter); the hook path-checks them like the others.
  'read_file',
  'write_file',
]);
export const AGY_GEN_COMMAND_TOOLS: readonly string[] = Object.freeze(['run_command', 'command_status']);
export const AGY_GEN_MCP_TOOL = 'call_mcp_tool';
export const AGY_GEN_ANSWER_TOOLS: readonly string[] = Object.freeze(['finish']);

/**
 * Deny rules of every generator home. 2026-10-19 (U12): agy permission rules have exactly seven action kinds,
 * `read_file`, `write_file`, `command`, `read_url`, `execute_url`, `mcp`, `unsandboxed`
 * (https://antigravity.google/docs/permissions/; https://agenticcontrolplane.com/controls/antigravity). The former
 * entries `search_web(*)`, `browser(*)`, `subagent(*)`, `schedule(*)`, `generate_image(*)`, `workflow(*)`, `inbox(*)`
 * and `plugin(*)` named no action and were ignored (agy 1.4.2 dropped them when it re-saved settings.json, and S4 saw
 * `invoke_subagent` and `schedule` run). Tools no action covers (search_web, invoke_subagent, schedule, browser_*,
 * generate_image, ...) are denied by the PreToolUse hook instead.
 */
export const AGY_GEN_DENY: readonly string[] = Object.freeze(['read_url(*)', 'execute_url(*)', 'unsandboxed(*)']);

// ── The PreToolUse hook (layer 1) ─────────────────────────────────────────────────────────────────────────────────

/** The committed hook script (repository-relative). */
export const AGY_HOOK_SOURCE_REL = 'scripts/lib/generators/agy-confine-hook.mjs';
/** agy's user-global hooks file (HOME = the generator home). The workspace `.agents/hooks.json` is never used. */
export const AGY_GEN_HOOKS_REL = '.gemini/config/hooks.json';
export const AGY_GEN_HOOK_SCRIPT_REL = '.gemini/config/daedalus-confine-hook.mjs';
export const AGY_GEN_HOOK_CONFIG_REL = '.gemini/config/daedalus-confine-turn.json';
export const AGY_HOOK_CONFIG_SCHEMA = 'agy-confine-turn/v1';
/** Seconds agy waits for the hook; a timeout blocks the call. */
export const AGY_HOOK_TIMEOUT_S = 10;
/** Where agy 1.4.2 keeps an MCP server's tool schemas in the home (it reads them before a call; S4 G9 stream). */
export const AGY_GEN_MCP_SCHEMA_REL = '.gemini/antigravity-cli/mcp';

/** The per-turn hook config (written next to hooks.json; never shown to the model). */
export interface AgyHookTurnConfig {
  readonly schema: typeof AGY_HOOK_CONFIG_SCHEMA;
  readonly arm: AgyGenArm;
  /** The turn's work directory (realpath); null in a home no turn has configured yet (every call is blocked). */
  readonly workDir: string | null;
  readonly allowCommand: boolean;
  readonly typecheckCommand: string | null;
  /** The turn's hook log (absolute, outside the work directory); null with `workDir: null`. */
  readonly logPath: string | null;
  readonly mcp?: { readonly server: string; readonly allowedTools: readonly string[]; readonly deniedTools: readonly string[]; readonly schemaDir: string };
}

/** One line of the hook log. */
export interface AgyHookLogLine {
  readonly tool: string | null;
  readonly decision: 'allow' | 'deny' | 'error';
  readonly reason: string;
  readonly stepIdx: number | null;
}

/** The repository's hook script for `repoRoot`. */
export function agyHookSourcePath(repoRoot: string): string {
  return path.join(repoRoot, AGY_HOOK_SOURCE_REL);
}

function shellQuote(s: string): string {
  return `'${s.split("'").join(`'\\''`)}'`;
}

/** The hook command line of a home: the absolute node binary, the copied script, the turn config. */
export function agyHookCommand(home: string, nodeBinary: string = process.execPath): string {
  return [nodeBinary, path.join(home, AGY_GEN_HOOK_SCRIPT_REL), path.join(home, AGY_GEN_HOOK_CONFIG_REL)].map(shellQuote).join(' ');
}

/** The exact hooks.json of a home: one PreToolUse group, matcher ".*", the confinement hook; no other event. */
export function agyHooksJson(home: string, nodeBinary: string = process.execPath): Record<string, unknown> {
  return { hooks: { PreToolUse: [{ matcher: '.*', hooks: [{ type: 'command', command: agyHookCommand(home, nodeBinary), timeout: AGY_HOOK_TIMEOUT_S }] }] } };
}

/** The schema files of the allowed daedalus-arch tools in a home (the only home files the daedalus-mcp arm may read). */
export function agyMcpSchemaFiles(home: string): readonly string[] {
  return DAEDALUS_ARM_TOOLS.map((t) => path.join(home, AGY_GEN_MCP_SCHEMA_REL, DAEDALUS_MCP_SERVER, `${t}.json`));
}

/** The baseline turn config of a home no turn has configured: no work directory, so the hook blocks every call. */
export function baselineHookConfig(arm: AgyGenArm, allowCommand: boolean): AgyHookTurnConfig {
  return { schema: AGY_HOOK_CONFIG_SCHEMA, arm, workDir: null, allowCommand, typecheckCommand: null, logPath: null };
}

function sha256Of(file: string): string | null {
  try {
    return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  } catch {
    return null;
  }
}

/** sha256 of the committed hook script (null when it is missing). */
export function agyHookSourceSha256(hookSource: string): string | null {
  return sha256Of(hookSource);
}

/** Writes hooks.json, the hook script (copied from `hookSource`) and the given turn config into the home. */
export function installAgyHook(home: string, hookSource: string, config: AgyHookTurnConfig): DomainResult<void> {
  if (!fs.existsSync(hookSource)) return DomainResult.fail([err('GEN_AGY_HOOK_MISSING', 'the committed hook script is missing')]);
  fs.mkdirSync(path.join(home, path.dirname(AGY_GEN_HOOKS_REL)), { recursive: true, mode: 0o700 });
  const script = path.join(home, AGY_GEN_HOOK_SCRIPT_REL);
  fs.copyFileSync(hookSource, script);
  fs.chmodSync(script, 0o600);
  fs.writeFileSync(path.join(home, AGY_GEN_HOOK_CONFIG_REL), `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  fs.writeFileSync(path.join(home, AGY_GEN_HOOKS_REL), `${JSON.stringify(agyHooksJson(home), null, 2)}\n`, { mode: 0o600 });
  return DomainResult.ok(undefined);
}

/** `installAgyHook` with the baseline config in both homes (what `gemini-homes.ts --create` does). */
export function installBaselineAgyHooks(homes: Readonly<Record<AgyGenArm, string>>, repoRoot: string, allowCommand: boolean): DomainResult<void> {
  for (const arm of ['none', 'daedalus-mcp'] as const) {
    const r = installAgyHook(homes[arm], agyHookSourcePath(repoRoot), baselineHookConfig(arm, allowCommand));
    if (!r.success) return r;
  }
  return DomainResult.ok(undefined);
}

const QUOTED_ABS =/^'(\/[^']*)'$/;

function hooksJsonProblem(home: string): string | null {
  const file = path.join(home, AGY_GEN_HOOKS_REL);
  if (!fs.existsSync(file)) return 'hooks.json is missing';
  let v: unknown;
  try {
    v = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return 'hooks.json is not valid JSON';
  }
  const hooks = isRecord(v) && Object.keys(v).length === 1 && isRecord(v.hooks) ? v.hooks : null;
  const groups: unknown[] = hooks !== null && Object.keys(hooks).length === 1 && Array.isArray(hooks.PreToolUse) ? (hooks.PreToolUse as unknown[]) : [];
  const group = groups.length === 1 && isRecord(groups[0]) ? groups[0] : null;
  const list: unknown[] = group !== null && Array.isArray(group.hooks) ? (group.hooks as unknown[]) : [];
  const inner = list.length === 1 && isRecord(list[0]) ? list[0] : null;
  const command = inner !== null && typeof inner.command === 'string' ? inner.command : '';
  const node = QUOTED_ABS.exec(command.split(' ')[0] ?? '');
  const ok =
    group !== null && group.matcher === '.*' && inner !== null && inner.type === 'command' && inner.timeout === AGY_HOOK_TIMEOUT_S && node !== null && command === agyHookCommand(home, node[1] ?? '');
  return ok ? null : 'hooks.json must be exactly the confinement hook (one PreToolUse group, matcher ".*")';
}

/**
 * The hook part of the home check (names and expected values only): hooks.json is exactly the confinement hook, the
 * copied script has the committed script's sha256, and the turn config is valid for the arm. With `allow` (a turn's
 * exact allow list), the config must name that turn's work directory, type-check command and MCP tools.
 */
export function checkAgyHook(home: string, arm: AgyGenArm, allow: readonly string[] | null, allowCommand: boolean, hookSource: string): readonly string[] {
  const problems: string[] = [];
  const hooksProblem = hooksJsonProblem(home);
  if (hooksProblem !== null) problems.push(hooksProblem);
  const want = sha256Of(hookSource);
  const got = sha256Of(path.join(home, AGY_GEN_HOOK_SCRIPT_REL));
  if (want === null) problems.push('the committed hook script is missing');
  else if (got === null) problems.push('the hook script is missing from the home');
  else if (got !== want) problems.push('the hook script differs from the committed one (sha256)');
  const configFile = path.join(home, AGY_GEN_HOOK_CONFIG_REL);
  if (!fs.existsSync(configFile)) return [...problems, 'the hook turn config is missing'];
  let c: unknown;
  try {
    c = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  } catch {
    return [...problems, 'the hook turn config is not valid JSON'];
  }
  if (!isRecord(c) || c.schema !== AGY_HOOK_CONFIG_SCHEMA) return [...problems, `the hook turn config must have schema ${AGY_HOOK_CONFIG_SCHEMA}`];
  if (c.arm !== arm) problems.push('the hook turn config names another arm');
  if (c.allowCommand !== allowCommand) problems.push('the hook turn config has another allowCommand');
  if (allow === null) return problems;
  const real = (p: string): string => (fs.existsSync(p) ? fs.realpathSync(p) : path.resolve(p));
  const workRule = allow.find((r) => r.startsWith('read_file(') && r.endsWith('/**)'));
  const ruleDir = workRule === undefined ? null : workRule.slice('read_file('.length, -'/**)'.length);
  const workDir = typeof c.workDir === 'string' ? c.workDir : null;
  if (workDir === null || ruleDir === null || real(workDir) !== real(ruleDir)) problems.push("the hook turn config must name this turn's work directory");
  if (typeof c.logPath !== 'string' || !path.isAbsolute(c.logPath)) problems.push('the hook turn config needs an absolute hook log path');
  else if (workDir !== null && isInsideOrEqual(real(workDir), path.resolve(c.logPath))) problems.push('the hook log must lie outside the work directory');
  if (allowCommand && (typeof c.typecheckCommand !== 'string' || !allow.includes(commandAllowRule(c.typecheckCommand)))) problems.push("the hook turn config must name this turn's type-check command");
  if (!allowCommand && c.typecheckCommand !== null) problems.push('the hook turn config names a command although none is allowed');
  if (arm === 'daedalus-mcp') {
    const m = isRecord(c.mcp) ? c.mcp : null;
    const tools = m !== null && Array.isArray(m.allowedTools) ? (m.allowedTools as unknown[]).map(String) : [];
    const denied = m !== null && Array.isArray(m.deniedTools) ? (m.deniedTools as unknown[]).map(String) : [];
    if (m?.server !== DAEDALUS_MCP_SERVER || !sameSet(tools, DAEDALUS_ARM_TOOLS) || !sameSet(denied, DAEDALUS_DENIED_TOOLS)) {
      problems.push(`the hook turn config must allow exactly the spec-only ${DAEDALUS_MCP_SERVER} tools`);
    }
  } else if (c.mcp !== undefined) problems.push('the hook turn config of the none arm must name no MCP server');
  return problems;
}

/** Reads a hook log (null when absent; an unparsable line is kept as an `error` line). */
export function readAgyHookLog(file: string | undefined): readonly AgyHookLogLine[] | null {
  if (file === undefined || !fs.existsSync(file)) return null;
  const out: AgyHookLogLine[] = [];
  const bad: AgyHookLogLine = { tool: null, decision: 'error', reason: 'unparsable hook log line', stepIdx: null };
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (line.trim() === '') continue;
    try {
      const v: unknown = JSON.parse(line);
      if (isRecord(v) && (v.decision === 'allow' || v.decision === 'deny' || v.decision === 'error')) {
        out.push({ tool: typeof v.tool === 'string' ? v.tool : null, decision: v.decision, reason: typeof v.reason === 'string' ? v.reason : '', stepIdx: typeof v.stepIdx === 'number' ? v.stepIdx : null });
      } else out.push(bad);
    } catch {
      out.push(bad);
    }
  }
  return out;
}

/** Hook decisions by kind. */
export function hookDecisionCounts(lines: readonly AgyHookLogLine[] | null): { readonly allow: number; readonly deny: number; readonly error: number } {
  const l = lines ?? [];
  return { allow: l.filter((x) => x.decision === 'allow').length, deny: l.filter((x) => x.decision === 'deny').length, error: l.filter((x) => x.decision === 'error').length };
}

/** Configuration of the Gemini arm: the shared fields (binary = the agy CLI) plus the homes and pins. */
export interface AgyGenCliConfig extends GeneratorCliConfig {
  /** One dedicated generator home per arm (absolute; never the labeller home). */
  readonly homes: Readonly<Record<AgyGenArm, string>>;
  /** Exact `agy --version`. */
  readonly cliVersion: string;
  readonly printTimeoutS: number;
  /** False: the type-check command is not allowed (the Q13 B analogue, S4 G5 fallback). */
  readonly allowCommand: boolean;
  /** The committed PreToolUse hook script (`<repo>/scripts/lib/generators/agy-confine-hook.mjs`). */
  readonly hookSource: string;
}

export interface AgyGenCliConfigInput {
  readonly base: GeneratorCliConfig;
  readonly homes: Readonly<Record<AgyGenArm, string>>;
  readonly cliVersion: string;
  readonly printTimeoutS?: number;
  readonly allowCommand?: boolean;
}

const SAFE_VERSION = /^\d+\.\d+\.\d+$/;

function err(code: string, message: string, context?: Record<string, unknown>): DomainError {
  return context === undefined ? { code, message } : { code, message, context };
}

/** Validated config; `timeoutMs` (the runner's hard kill) is `(printTimeoutS + 30) × 1000`. */
export function createAgyGenCliConfig(input: AgyGenCliConfigInput, repoRoot: string): DomainResult<AgyGenCliConfig> {
  const errors: DomainError[] = [];
  const printTimeoutS = input.printTimeoutS ?? AGY_GEN_PRINT_TIMEOUT_DEFAULT_S;
  if (!SAFE_VERSION.test(input.cliVersion)) errors.push(err('GEN_AGY_CONFIG_INVALID', 'cliVersion must be x.y.z'));
  if (!Number.isInteger(printTimeoutS) || printTimeoutS < AGY_GEN_PRINT_TIMEOUT_MIN_S || printTimeoutS > AGY_GEN_PRINT_TIMEOUT_MAX_S) {
    errors.push(err('GEN_AGY_CONFIG_INVALID', `printTimeoutS must be an integer from ${String(AGY_GEN_PRINT_TIMEOUT_MIN_S)} to ${String(AGY_GEN_PRINT_TIMEOUT_MAX_S)}`));
  }
  for (const arm of ['none', 'daedalus-mcp'] as const) {
    const home = input.homes[arm];
    if (typeof home !== 'string' || !path.isAbsolute(home)) {
      errors.push(err('GEN_PATH_NOT_ABSOLUTE', `homes.${arm} must be an absolute path`, { field: `homes.${arm}` }));
      continue;
    }
    if (isInsideOrEqual(repoRoot, home)) errors.push(err('GEN_AGY_HOME_INSIDE_REPO', `homes.${arm} must lie outside the repository`));
    if (isInsideOrEqual(input.base.outputRoot, home)) errors.push(err('GEN_AGY_HOME_INSIDE_CWD', `homes.${arm} must not lie inside outputRoot (every cwd is under it)`));
    if (isInsideOrEqual(input.base.harnessRoot, home)) errors.push(err('GEN_AGY_HOME_INSIDE_HARNESS', `homes.${arm} must not lie inside harnessRoot`));
  }
  if (errors.length === 0 && path.resolve(input.homes.none) === path.resolve(input.homes['daedalus-mcp'])) {
    errors.push(err('GEN_AGY_CONFIG_INVALID', 'each arm needs its own generator home'));
  }
  if (errors.length > 0) return DomainResult.fail(errors);
  return DomainResult.ok(
    Object.freeze({
      ...input.base,
      timeoutMs: (printTimeoutS + AGY_GEN_KILL_GRACE_S) * 1000,
      allowBash: input.allowCommand ?? true,
      homes: Object.freeze({ none: path.normalize(input.homes.none), 'daedalus-mcp': path.normalize(input.homes['daedalus-mcp']) }),
      cliVersion: input.cliVersion,
      printTimeoutS,
      allowCommand: input.allowCommand ?? true,
      hookSource: agyHookSourcePath(repoRoot),
    }),
  );
}

/** The exact argv (the prompt goes on stdin). */
export function buildAgyGenArgs(config: Pick<AgyGenCliConfig, 'modelId' | 'printTimeoutS'>): readonly string[] {
  return Object.freeze(['--output-format', 'stream-json', '--model', config.modelId, '--sandbox', '--disable-slash-commands', '--print-timeout', `${String(config.printTimeoutS)}s`]);
}

const DENY_SUFFIX = /_(?:TOKEN|KEY)$/i;

/** `AGY_ENV_ALLOW` from the parent, `HOME = home`, `AGY_ENV_SET`; every `*_KEY` / `*_TOKEN` removed. */
export function buildAgyGenChildEnv(parent: NodeJS.ProcessEnv, home: string): Readonly<Record<string, string>> {
  const base = buildChildEnv({ ...parent, HOME: home, ...AGY_ENV_SET }, AGY_ENV_ALLOW);
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(base)) if (!DENY_SUFFIX.test(k)) env[k] = v;
  return Object.freeze(env);
}

/** The arm a loop arm's turns use (`gate` runs with the `none` home and argv). */
export function agyGenArmOf(arm: string): AgyGenArm {
  return arm === 'daedalus-mcp' ? 'daedalus-mcp' : 'none';
}

export interface TurnAllowInput {
  readonly arm: AgyGenArm;
  readonly runId: string;
  readonly harnessRoot: string;
  readonly cwd: string;
  readonly allowCommand: boolean;
}

/**
 * The exact-command allow rule. 2026-10-19 (U12): `command(<text>)` is a PREFIX rule in agy 1.4.2 (the docs'
 * `command(prefix)`), and the S4 run saw `<type-check> && touch ../chain-and.txt` and `<type-check> --tsBuildInfoFile
 * ../x` complete under the old `command(<type-check>)` rule. The anchored regex form allows exactly the command.
 */
export function commandAllowRule(command: string): string {
  return `command(regex:^${command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$)`;
}

/**
 * The exact allow list of one turn (layer 2; the hook is layer 1): reads and writes inside the cwd, the run's exact
 * type-check command (`typecheckCommand(harnessRoot, runId)`, anchored regex) when allowed, and the nine spec-only
 * tools in `daedalus-mcp`.
 */
export function expectedAllow(i: TurnAllowInput): readonly string[] {
  const cwd = path.resolve(i.cwd);
  return Object.freeze([
    `read_file(${cwd}/**)`,
    `write_file(${cwd}/**)`,
    ...(i.allowCommand ? [commandAllowRule(typecheckCommand(i.harnessRoot, i.runId))] : []),
    ...(i.arm === 'daedalus-mcp' ? DAEDALUS_ARM_TOOLS.map((t) => `mcp(${DAEDALUS_MCP_SERVER}/${t})`) : []),
  ]);
}

/**
 * The deny list of an arm's home: `read_url(*)`, `execute_url(*)`, `unsandboxed(*)`, then `mcp(*)` (none) or
 * `mcp(daedalus-arch/evaluate_project)` (daedalus-mcp), and `command(*)` without allowCommand.
 */
export function expectedDeny(arm: AgyGenArm, allowCommand: boolean): readonly string[] {
  return Object.freeze([
    ...AGY_GEN_DENY,
    ...(arm === 'none' ? ['mcp(*)'] : DAEDALUS_DENIED_TOOLS.map((t) => `mcp(${DAEDALUS_MCP_SERVER}/${t})`)),
    ...(allowCommand ? [] : ['command(*)']),
  ]);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && [...a].sort().join('\n') === [...b].sort().join('\n');
}

/**
 * The generator settings check (key names and expected values only). `allow === null` skips the exact allow-list
 * check (the pre-run probe, before any turn has written it).
 */
export function checkAgyGenSettings(text: string, arm: AgyGenArm, allow: readonly string[] | null, allowCommand = true): readonly string[] {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return ['settings.json is not valid JSON'];
  }
  if (!isRecord(value)) return ['settings.json is not a JSON object'];
  const problems: string[] = [];
  for (const [key, expected] of Object.entries(AGY_GEN_REQUIRED_SETTINGS)) {
    if (value[key] !== expected) problems.push(`settings.json ${key} must be ${JSON.stringify(expected)}`);
  }
  if (value.allowNonWorkspaceAccess === true) problems.push('settings.json allowNonWorkspaceAccess must not be true');
  for (const key of ['mcpServers', 'hooks', 'plugins', 'customModelsConfig', 'modelProvider', 'agentMode']) {
    const v = value[key];
    if (v !== undefined && v !== null && v !== '' && !(isRecord(v) && Object.keys(v).length === 0)) problems.push(`settings.json ${key} must be unset`);
  }
  const perms = isRecord(value.permissions) ? value.permissions : {};
  const deny = Array.isArray(perms.deny) ? (perms.deny as unknown[]).map(String) : [];
  const missing = expectedDeny(arm, allowCommand).filter((r) => !deny.includes(r));
  if (missing.length > 0) problems.push(`settings.json permissions.deny lacks ${missing.join(', ')}`);
  if (Array.isArray(perms.ask) && perms.ask.length > 0) problems.push('settings.json permissions.ask must be empty');
  if (allow !== null) {
    const got = Array.isArray(perms.allow) ? (perms.allow as unknown[]).map(String) : [];
    if (!sameSet(got, allow)) problems.push(`settings.json permissions.allow must be exactly this turn's ${String(allow.length)} rule(s)`);
  }
  return problems;
}

/** The MCP server names a home's MCP config lists (empty when the file is absent or empty). */
export function mcpServersOf(home: string): readonly string[] | null {
  const file = path.join(home, AGY_GEN_MCP_CONFIG_REL);
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, 'utf8').trim();
  if (text === '') return [];
  try {
    const v: unknown = JSON.parse(text);
    if (!isRecord(v)) return null;
    if (v.mcpServers === undefined) return [];
    return isRecord(v.mcpServers) ? Object.keys(v.mcpServers).sort() : null;
  } catch {
    return null;
  }
}

function walkNames(root: string, rel: string, out: string[]): void {
  const abs = rel === '' ? root : path.join(root, rel);
  for (const name of fs.readdirSync(abs).sort()) {
    const childRel = rel === '' ? name : `${rel}/${name}`;
    out.push(childRel);
    if (fs.lstatSync(path.join(root, childRel)).isDirectory() && childRel !== AGY_BUILTIN_DIR) walkNames(root, childRel, out);
  }
}

function insideGit(dir: string): boolean {
  for (let at = path.resolve(dir); ; at = path.dirname(at)) {
    if (fs.existsSync(path.join(at, '.git'))) return true;
    if (path.dirname(at) === at) return false;
  }
}

/** Names that look like credential files: left out of the listing hash (never opened either way). */
const CREDENTIAL_NAME = /oauth|credential|token|auth|secret|cookie/i;

export interface AgyGenHomeCheck {
  readonly problems: readonly string[];
  /** sha256 of the home's sorted name listing (credential-looking names left out; names only). */
  readonly listingSha256: string;
}

/**
 * A generator home (names only, except the harness-owned settings and MCP config): it exists, is not group- or
 * world-accessible, lies outside every git repository, holds no rule, skill, plugin, agent, workflow or hook entry
 * (outside agy's builtin directory), conforming settings when present (required once `allow` is given), and the
 * arm's MCP servers: none for `none`, exactly `daedalus-arch` for `daedalus-mcp` (once a turn has written it).
 * U12: the confinement hook is required (`checkAgyHook`): hooks.json at `.gemini/config/hooks.json` (the one hooks
 * entry exempt from the forbidden names), the copied script with the committed sha256, and the turn config.
 */
export function checkAgyGenHome(home: string, arm: AgyGenArm, allow: readonly string[] | null, allowCommand: boolean, hookSource: string): AgyGenHomeCheck {
  const empty = createHash('sha256').update('').digest('hex');
  if (!fs.existsSync(home) || !fs.lstatSync(home).isDirectory()) return { problems: ['generator home does not exist'], listingSha256: empty };
  const problems: string[] = [];
  if ((fs.statSync(home).mode & 0o077) !== 0) problems.push('generator home is accessible to group or others');
  if (insideGit(home)) problems.push('generator home lies inside a git repository');
  const names: string[] = [];
  walkNames(home, '', names);
  for (const n of names.filter((x) => x !== AGY_GEN_HOOKS_REL && x.split('/').some((seg) => AGY_HOME_FORBIDDEN_NAMES.includes(seg)))) problems.push(`forbidden entry ${n}`);
  problems.push(...checkAgyHook(home, arm, allow, allowCommand, hookSource));
  const settings = path.join(home, AGY_GEN_SETTINGS_REL);
  if (fs.existsSync(settings)) problems.push(...checkAgyGenSettings(fs.readFileSync(settings, 'utf8'), arm, allow, allowCommand));
  else if (allow !== null) problems.push('settings.json is missing');
  const servers = mcpServersOf(home);
  if (servers === null) problems.push('mcp_config.json is not a JSON object with mcpServers');
  else if (arm === 'none' && servers.length > 0) problems.push('the none home must list no MCP server');
  else if (arm === 'daedalus-mcp' && allow !== null && !(servers.length === 1 && servers[0] === DAEDALUS_MCP_SERVER)) {
    problems.push(`the daedalus-mcp home must list exactly the ${DAEDALUS_MCP_SERVER} server`);
  }
  const listing = names.filter((n) => !n.startsWith(`${AGY_BUILTIN_DIR}/`) && !CREDENTIAL_NAME.test(path.posix.basename(n))).join('\n');
  return { problems, listingSha256: createHash('sha256').update(listing).digest('hex') };
}

/** Fails closed on a rule file, customisation directory or `.git` in the cwd or on its ancestor chain. */
export function checkAncestors(cwd: string): DomainResult<void> {
  const hit = findAgyAncestorContext(cwd);
  return hit === null
    ? DomainResult.ok(undefined)
    : DomainResult.fail([err('LOOP_GEMINI_AMBIENT', `the cwd has ${path.basename(hit)} on its ancestor chain`, { found: path.basename(hit) })]);
}

export interface TurnFilesInput extends TurnAllowInput {
  readonly callLogPath?: string;
  readonly daedalus?: DaedalusServerInput;
  /** The committed hook script (`AgyGenCliConfig.hookSource`). */
  readonly hookSource: string;
  /** The turn's hook log (absolute, outside the cwd); default `<H>/runs/<runId>/hooks/turn.jsonl`. */
  readonly hookLogPath?: string;
}

/** The hook turn config of one turn (the work directory as its realpath). */
export function hookTurnConfig(home: string, i: TurnFilesInput): DomainResult<AgyHookTurnConfig> {
  const workDir = fs.existsSync(i.cwd) ? fs.realpathSync(i.cwd) : path.resolve(i.cwd);
  const logPath = path.resolve(i.hookLogPath ?? path.join(i.harnessRoot, 'runs', i.runId, 'hooks', 'turn.jsonl'));
  const logReal = path.join(fs.existsSync(path.dirname(logPath)) ? fs.realpathSync(path.dirname(logPath)) : path.dirname(logPath), path.basename(logPath));
  if (isInsideOrEqual(workDir, logReal) || isInsideOrEqual(path.resolve(i.cwd), logPath)) {
    return DomainResult.fail([err('GEN_AGY_HOOK_LOG_INSIDE_CWD', 'the hook log must lie outside the work directory')]);
  }
  const homeReal = fs.existsSync(home) ? fs.realpathSync(home) : path.resolve(home);
  return DomainResult.ok({
    schema: AGY_HOOK_CONFIG_SCHEMA,
    arm: i.arm,
    workDir,
    allowCommand: i.allowCommand,
    typecheckCommand: i.allowCommand ? typecheckCommand(i.harnessRoot, i.runId) : null,
    logPath,
    ...(i.arm === 'daedalus-mcp'
      ? { mcp: { server: DAEDALUS_MCP_SERVER, allowedTools: [...DAEDALUS_ARM_TOOLS], deniedTools: [...DAEDALUS_DENIED_TOOLS], schemaDir: path.join(homeReal, AGY_GEN_MCP_SCHEMA_REL, DAEDALUS_MCP_SERVER) } }
      : {}),
  });
}

/**
 * Writes the turn's home files: the confinement hook (hooks.json, the copied script, this turn's hook config), the
 * settings with this turn's exact allow list (the run's type-check rule) and, for `daedalus-mcp`, the MCP config
 * (`daedalusMcpConfig` with `--project <cwd>`, plus `--call-log` when on). No credential file is read or written;
 * other settings keys are kept.
 */
export function writeAgyTurnFiles(home: string, i: TurnFilesInput): DomainResult<{ readonly allow: readonly string[]; readonly mcpConfig: unknown; readonly hookLogPath: string }> {
  const hookConfig = hookTurnConfig(home, i);
  if (!hookConfig.success) return DomainResult.fail(hookConfig.errors);
  const installed = installAgyHook(home, i.hookSource, hookConfig.data);
  if (!installed.success) return DomainResult.fail(installed.errors);
  const hookLogPath = hookConfig.data.logPath ?? '';
  fs.mkdirSync(path.dirname(hookLogPath), { recursive: true });
  const settingsFile = path.join(home, AGY_GEN_SETTINGS_REL);
  let current: Record<string, unknown> = {};
  if (fs.existsSync(settingsFile)) {
    try {
      const v: unknown = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
      if (isRecord(v)) current = v;
    } catch {
      current = {};
    }
  }
  const allow = expectedAllow(i);
  const next = { ...current, ...AGY_GEN_REQUIRED_SETTINGS, permissions: { allow: [...allow], deny: [...expectedDeny(i.arm, i.allowCommand)], ask: [] } };
  delete (next as Record<string, unknown>).allowNonWorkspaceAccess;
  fs.mkdirSync(path.dirname(settingsFile), { recursive: true, mode: 0o700 });
  fs.writeFileSync(settingsFile, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  if (i.arm !== 'daedalus-mcp') return DomainResult.ok({ allow, mcpConfig: null, hookLogPath });
  if (i.daedalus === undefined) return DomainResult.fail([err('ARM_NOT_CONFIGURED', 'the daedalus-mcp arm needs nodeBinary, serverEntry and specPath')]);
  const base = daedalusMcpConfig(i.daedalus, { runId: i.runId, outputDir: path.resolve(i.cwd) });
  const server = base.mcpServers[DAEDALUS_MCP_SERVER];
  const config = {
    mcpServers: {
      [DAEDALUS_MCP_SERVER]: { ...server, args: [...(server?.args ?? []), ...(i.callLogPath !== undefined ? ['--call-log', i.callLogPath] : [])] },
    },
  };
  const mcpFile = path.join(home, AGY_GEN_MCP_CONFIG_REL);
  fs.mkdirSync(path.dirname(mcpFile), { recursive: true, mode: 0o700 });
  fs.writeFileSync(mcpFile, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  return DomainResult.ok({ allow, mcpConfig: config, hookLogPath });
}
