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
 * - settings (`.gemini/antigravity-cli/settings.json`, harness-owned): `toolPermission: strict`,
 *   `enableTerminalSandbox: true`, `disableSlashCommands: true`, never `allowNonWorkspaceAccess: true`; the allow list
 *   is EXACTLY this run's and arm's set (UNVERIFIED rule syntax [G1, G5, G9]); the deny list holds the network,
 *   browser, sub-agent, schedule, image, workflow, inbox and plugin tools and `evaluate_project` (UNVERIFIED [G6, G8,
 *   G9]; agy 1.3.2 could not deny `search_web` for the labeller, so the enforced backstop is the tool-escape stop of
 *   `agy-gen-events.ts`).
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
]);
export const AGY_GEN_COMMAND_TOOLS: readonly string[] = Object.freeze(['run_command', 'command_status']);
export const AGY_GEN_MCP_TOOL = 'call_mcp_tool';
export const AGY_GEN_ANSWER_TOOLS: readonly string[] = Object.freeze(['finish']);

/** Deny rules of every generator home (UNVERIFIED syntax, S4 G6, G8, G9). */
export const AGY_GEN_DENY: readonly string[] = Object.freeze([
  'read_url(*)',
  'search_web(*)',
  'browser(*)',
  'subagent(*)',
  'schedule(*)',
  'generate_image(*)',
  'workflow(*)',
  'inbox(*)',
  'plugin(*)',
  ...DAEDALUS_DENIED_TOOLS.map((t) => `mcp(${DAEDALUS_MCP_SERVER}/${t})`),
]);

/** Configuration of the Gemini arm: the shared fields (binary = the agy CLI) plus the homes and pins. */
export interface AgyGenCliConfig extends GeneratorCliConfig {
  /** One dedicated generator home per arm (absolute; never the labeller home). */
  readonly homes: Readonly<Record<AgyGenArm, string>>;
  /** Exact `agy --version`. */
  readonly cliVersion: string;
  readonly printTimeoutS: number;
  /** False: the type-check command is not allowed (the Q13 B analogue, S4 G5 fallback). */
  readonly allowCommand: boolean;
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
 * The exact allow list of one turn (UNVERIFIED rule syntax, S4 G1, G5, G9): reads and writes inside the cwd, the
 * run's type-check command (`typecheckCommand(harnessRoot, runId)`) when allowed, and the nine spec-only tools in
 * `daedalus-mcp`.
 */
export function expectedAllow(i: TurnAllowInput): readonly string[] {
  const cwd = path.resolve(i.cwd);
  return Object.freeze([
    `read_file(${cwd}/**)`,
    `write_file(${cwd}/**)`,
    ...(i.allowCommand ? [`command(${typecheckCommand(i.harnessRoot, i.runId)})`] : []),
    ...(i.arm === 'daedalus-mcp' ? DAEDALUS_ARM_TOOLS.map((t) => `mcp(${DAEDALUS_MCP_SERVER}/${t})`) : []),
  ]);
}

/** The deny list of an arm's home. */
export function expectedDeny(arm: AgyGenArm, allowCommand: boolean): readonly string[] {
  return Object.freeze([...AGY_GEN_DENY, ...(arm === 'none' ? ['mcp(*)'] : []), ...(allowCommand ? [] : ['command(*)'])]);
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
 */
export function checkAgyGenHome(home: string, arm: AgyGenArm, allow: readonly string[] | null, allowCommand = true): AgyGenHomeCheck {
  const empty = createHash('sha256').update('').digest('hex');
  if (!fs.existsSync(home) || !fs.lstatSync(home).isDirectory()) return { problems: ['generator home does not exist'], listingSha256: empty };
  const problems: string[] = [];
  if ((fs.statSync(home).mode & 0o077) !== 0) problems.push('generator home is accessible to group or others');
  if (insideGit(home)) problems.push('generator home lies inside a git repository');
  const names: string[] = [];
  walkNames(home, '', names);
  for (const n of names.filter((x) => x.split('/').some((seg) => AGY_HOME_FORBIDDEN_NAMES.includes(seg)))) problems.push(`forbidden entry ${n}`);
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
}

/**
 * Writes the turn's home files: the settings with this turn's exact allow list (the run's type-check rule) and, for
 * `daedalus-mcp`, the MCP config (`daedalusMcpConfig` with `--project <cwd>`, plus `--call-log` when on). No
 * credential file is read or written; other settings keys are kept.
 */
export function writeAgyTurnFiles(home: string, i: TurnFilesInput): DomainResult<{ readonly allow: readonly string[]; readonly mcpConfig: unknown }> {
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
  if (i.arm !== 'daedalus-mcp') return DomainResult.ok({ allow, mcpConfig: null });
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
  return DomainResult.ok({ allow, mcpConfig: config });
}
