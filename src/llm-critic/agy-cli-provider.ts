/**
 * Antigravity CLI (`agy`) labeller provider (ADR-019 item 4 as amended 2026-10-08; ADR-021 SO3-1, SO3-4;
 * FR-27; BR-U5b-31, 36, 44; BR-U4-VRD-02, 03, 09 contract).
 *
 * The labeller panel reaches Gemini only through the headless `agy` CLI, signed in with Google OAuth
 * inside a dedicated home (`~/.firewall/labeller-agy-home`, mode 700). The isolation probe
 * (`tests/fixtures/agy-cli/probe-values.json`) fixed every frozen value below:
 *
 * - **argv**: `--output-format stream-json --model <id> --json-schema <schema> --sandbox
 *   --disable-slash-commands --print-timeout <n>s`; the prompt goes on stdin, never in argv. agy has no
 *   system-prompt flag, so the persona is prepended to the prompt. It has no temperature, seed or
 *   max-token flags either; those options are reported as ignored (ADR-021: amendment to the
 *   determinism rule).
 * - **env**: `env -i` style allow-list (`PATH`, `USER`, `LOGNAME`, `TMPDIR`, `LANG`), `HOME` set to the
 *   dedicated home and `AGY_CLI_DISABLE_AUTO_UPDATE=true`. The value must be `true`: the probe saw `1`
 *   ignored and the background updater spawned.
 * - **tools**: agy always registers its tool set (60 tools in the init event). Tools are made inert in
 *   the home's `settings.json`: `toolPermission: strict` plus deny rules for `command`, `read_file`,
 *   `write_file`, `mcp` and `read_url`. A denied attempt is harmless and allowed. A tool step that
 *   completes (any tool other than `finish`) is an isolation stop.
 * - **ambient rules**: the canary positive control fired on a cwd `AGENTS.md` and on the home's
 *   `.gemini/GEMINI.md` and `.gemini/config/GEMINI.md`. Every call therefore runs in a fresh, empty
 *   `mkdtemp` cwd outside any git repository with no rule file on its ancestor chain, and the
 *   pre-flight fails closed on any rule, skill, plugin, agent or MCP entry in the home.
 * - **model**: the stream-json `init` event names the model; it must equal the requested id.
 *
 * Errors are classified from stderr and the `result` event, never from the exit code alone: a print
 * timeout exits 0 with status SUCCESS and an empty response (`[agy] print timeout after ...`).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { LLMCallContext, LLMOptions, LLMProvider, LLMResponse } from '../shared/interfaces/llm-provider.js';
import type { ProcessResult, ProcessRunner } from '../shared/interfaces/process-runner.js';
import type { ProviderDescription } from '../shared/types/evaluation.js';
import type { VCRMode } from '../shared/types/llm-config.js';
import type { DomainError } from '../shared/errors/domain-result.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import { scrubSecrets } from '../shared/errors/scrub.js';
import { buildChildEnv } from '../shared/process/node-process-runner.js';
import { canonicalJSON, sha256Hex } from './canonical-json.js';
import type { ArgvFlagSource } from './cassette-provider.js';
import { knownSecretsFrom } from './cassette-provider.js';

// ── Frozen probe values (ADR-019 item 4; probe 2026-10-08/09) ────────────────────────────

/** `agy --version` at the probe; the cask said 1.1.23 but the binary had self-updated in place. */
export const AGY_PINNED_VERSION = '1.3.2';
/** Strongest generally available Gemini Pro id listed by `agy models` (BR-U4-VRD-09; `Docs/labeller-route.md`). */
export const AGY_LABELLER_MODEL = 'gemini-3.1-pro-high';
export const AGY_HOME_DEFAULT = '~/.firewall/labeller-agy-home';
export const AGY_BINARY_DEFAULT = 'agy';
export const AGY_ENV_ALLOW: readonly string[] = Object.freeze(['PATH', 'USER', 'LOGNAME', 'TMPDIR', 'LANG', 'HOME', 'AGY_CLI_DISABLE_AUTO_UPDATE']);
export const AGY_ENV_SET: Readonly<Record<string, string>> = Object.freeze({ AGY_CLI_DISABLE_AUTO_UPDATE: 'true', LANG: 'en_US.UTF-8' });
/** Per-call print timeout handed to agy, and the runner's hard kill a little later. */
export const AGY_PRINT_TIMEOUT_S = 240;
export const AGY_PROCESS_TIMEOUT_MS = (AGY_PRINT_TIMEOUT_S + 30) * 1000;
export const AGY_VERSION_TIMEOUT_MS = 15_000;
export const AGY_NEUTRAL_CWD_PREFIX = 'daedalus-labeller-';

/** Required `settings.json` values in the dedicated home (tools inert; slash commands and skills off). */
export const AGY_REQUIRED_SETTINGS: Readonly<Record<string, unknown>> = Object.freeze({
  toolPermission: 'strict',
  enableTerminalSandbox: true,
  disableSlashCommands: true,
});
export const AGY_REQUIRED_DENY: readonly string[] = Object.freeze([
  'command(*)', 'mcp(*)', 'read_file(*)', 'read_file(/)', 'read_url(*)', 'write_file(*)', 'write_file(/)',
]);
/** `settings.json` keys that must not be set to these values. */
const AGY_FORBIDDEN_SETTINGS: Readonly<Record<string, unknown>> = Object.freeze({ allowNonWorkspaceAccess: true });

/** Home entries that would inject context or capabilities: rules, skills, plugins, agents, MCP, hooks. */
export const AGY_HOME_FORBIDDEN_NAMES: readonly string[] = Object.freeze([
  'GEMINI.md', 'AGENTS.md', 'rules', 'skills', 'plugins', 'plugins.json', 'skills.json', 'agents', 'workflows',
  'hooks', 'hooks.json', '.agents', '.agent', '_agents', '_agent',
]);
/** Builtin skills shipped by agy live here and are disabled by `--disable-slash-commands`; they are not ambient. */
const AGY_BUILTIN_DIR = '.gemini/antigravity-cli/builtin';
/** Rule and customisation files agy discovers from the cwd upwards (canary positive control). */
export const AGY_ANCESTOR_FORBIDDEN: readonly string[] = Object.freeze([
  'GEMINI.md', 'AGENTS.md', '.agents', '.agent', '_agents', '_agent', '.git',
]);

/** Tool steps that are part of answering, not tool use. */
const AGY_ANSWER_TOOLS: ReadonlySet<string> = new Set(['finish']);

export const AGY_CLASSIFIER = Object.freeze({
  TIMEOUT: [/\[agy\] print timeout after/],
  AUTH: [/authentication required/i, /authentication failed/i, /not logged in/i, /silent auth failed/i],
  MODEL: [/invalid model selection/i, /not recognized as a known model/i],
  /** Unverified: no natural sample was seen in the probe. */
  USAGE_LIMIT: [/RESOURCE_EXHAUSTED/, /MODEL_CAPACITY_EXHAUSTED/, /quota/i, /rate.?limit/i, /usage limit/i, /\b429\b/],
});

// ── Configuration ─────────────────────────────────────────────────────────────────────────

export interface AgyCliProviderConfig {
  readonly binary?: string;
  readonly model?: string;
  /** Absolute dedicated home (`~` expanded). */
  readonly home: string;
  readonly mode?: VCRMode;
  readonly printTimeoutS?: number;
}

export interface AgyCliProviderDeps {
  readonly runner: ProcessRunner;
  readonly parentEnv?: NodeJS.ProcessEnv;
  /** Root under which neutral cwds are created (default `os.tmpdir()`). */
  readonly tmpRoot?: string;
}

export function expandHome(p: string, home: string = os.homedir()): string {
  return p.replace(/^~(?=\/|$)/, home);
}

// ── Argv and env ──────────────────────────────────────────────────────────────────────────

export interface AgyArgv {
  readonly binary: string;
  readonly args: readonly string[];
  /** Non-content flags hashed into the cassette key. */
  readonly argvFlags: readonly string[];
}

export function buildAgyArgs(input: { readonly binary?: string; readonly model: string; readonly schema: string; readonly printTimeoutS?: number }): AgyArgv {
  const timeout = `${String(input.printTimeoutS ?? AGY_PRINT_TIMEOUT_S)}s`;
  const args = [
    '--output-format', 'stream-json', '--model', input.model, '--json-schema', input.schema,
    '--sandbox', '--disable-slash-commands', '--print-timeout', timeout,
  ];
  const argvFlags = ['--output-format=stream-json', '--model', '--json-schema', '--sandbox', '--disable-slash-commands', `--print-timeout=${timeout}`];
  return { binary: input.binary ?? AGY_BINARY_DEFAULT, args, argvFlags };
}

export function buildAgyChildEnv(parent: NodeJS.ProcessEnv, home: string): Readonly<Record<string, string>> {
  return buildChildEnv({ ...parent, HOME: home, ...AGY_ENV_SET }, AGY_ENV_ALLOW);
}

/** agy has no system channel: the persona leads the prompt. */
export function composeAgyPrompt(prompt: string, systemPrompt: string | undefined): string {
  return systemPrompt === undefined || systemPrompt.trim() === '' ? prompt : `${systemPrompt.trim()}\n\n${prompt}`;
}

// ── Stream parsing ────────────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface AgyInit {
  readonly model?: string;
  readonly tools?: readonly string[];
  readonly permission_mode?: string;
}

export interface AgyToolStep {
  readonly tool: string;
  readonly state: string;
}

export interface AgyResult {
  readonly status?: string;
  readonly response?: string;
  readonly error?: string;
  readonly structured_output?: unknown;
  readonly denied_actions?: readonly unknown[];
  readonly usage?: { readonly input_tokens?: number; readonly output_tokens?: number; readonly thinking_tokens?: number; readonly cache_read_tokens?: number };
}

export interface AgyStream {
  readonly init: AgyInit | null;
  readonly result: AgyResult | null;
  /** Final state of every tool step, by step index. */
  readonly tools: readonly AgyToolStep[];
}

/** Reads `stream-json` stdout (one event per line); a single `json` envelope is read as its result. */
export function readAgyStream(stdout: string): AgyStream {
  let init: AgyInit | null = null;
  let result: AgyResult | null = null;
  const steps = new Map<number, AgyToolStep>();
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    let value: unknown;
    try {
      value = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (!isRecord(value)) continue;
    if (value.event === 'init' && isRecord(value.init) && init === null) init = value.init;
    else if (value.event === 'result' && isRecord(value.result)) result = value.result;
    else if (value.event === 'step_update' && isRecord(value.step_update)) {
      const s = value.step_update;
      if (s.step_type === 'tool' && typeof s.step_index === 'number') {
        steps.set(s.step_index, { tool: typeof s.tool_name === 'string' ? s.tool_name : '', state: typeof s.state === 'string' ? s.state : '' });
      }
    } else if (value.event === undefined && typeof value.status === 'string') result = value;
  }
  const tools = [...steps.entries()].sort((a, b) => a[0] - b[0]).map(([, s]) => s);
  return { init, result, tools };
}

/** Tool steps that ran (not denied, not the answer tool): any one is an isolation breach. */
export function executedTools(stream: AgyStream): readonly string[] {
  return stream.tools.filter((t) => !AGY_ANSWER_TOOLS.has(t.tool) && t.state !== 'ERROR').map((t) => t.tool);
}

export function deniedToolCount(stream: AgyStream): number {
  return stream.tools.filter((t) => !AGY_ANSWER_TOOLS.has(t.tool) && t.state === 'ERROR').length + (stream.result?.denied_actions?.length ?? 0);
}

/** The answer text: `structured_output` as canonical JSON first, the `response` text otherwise. */
export function answerText(result: AgyResult): string {
  if (isRecord(result.structured_output)) return canonicalJSON(result.structured_output);
  return typeof result.response === 'string' ? result.response.trim() : '';
}

// ── Error classification ──────────────────────────────────────────────────────────────────

export type AgyErrorCode =
  | 'LLM_CLI_NOT_FOUND' | 'LLM_CLI_TIMEOUT' | 'LLM_CLI_EXIT' | 'LLM_CLI_BAD_ENVELOPE'
  | 'LLM_AUTH' | 'LLM_USAGE_LIMIT' | 'LLM_CLI_ISOLATION' | 'LLM_CLI_VERSION_DRIFT' | 'LLM_NOT_CONFIGURED';

const EXCERPT = 500;

function matches(patterns: readonly RegExp[], text: string): boolean {
  return patterns.some((p) => p.test(text));
}

/**
 * Maps one finished agy process to its stream and an error, or `null` for an answer:
 * runner timeout or `[agy] print timeout` → TIMEOUT (retry); auth text → AUTH (stop); unknown model →
 * NOT_CONFIGURED (stop); quota text → USAGE_LIMIT (stop, unverified patterns); a completed tool step →
 * ISOLATION (stop); init model differing from the requested id → ISOLATION (stop); no result event →
 * BAD_ENVELOPE (retry); status ERROR, non-zero exit or an empty answer → CLI_EXIT (retry).
 */
export function classifyAgyResult(
  run: ProcessResult,
  requestedModel: string,
  secrets: readonly string[],
): { readonly stream: AgyStream; readonly error: DomainError | null } {
  const stream = readAgyStream(run.stdout);
  const stderr = scrubSecrets(run.stderr.slice(0, EXCERPT), secrets);
  const fail = (code: AgyErrorCode, message: string, extra: Record<string, unknown> = {}): { stream: AgyStream; error: DomainError } => ({
    stream,
    error: { code, message: scrubSecrets(message, secrets), context: { exitCode: run.exitCode, ...(stderr !== '' ? { stderr } : {}), ...extra } },
  });
  const errorText = `${stream.result?.error ?? ''}\n${run.stderr}`;
  if (run.timedOut || matches(AGY_CLASSIFIER.TIMEOUT, run.stderr)) {
    return fail('LLM_CLI_TIMEOUT', `agy timed out after ${String(Math.round(run.durationMs))} ms`);
  }
  if (matches(AGY_CLASSIFIER.AUTH, errorText)) return fail('LLM_AUTH', 'agy is not signed in to the dedicated home');
  if (matches(AGY_CLASSIFIER.MODEL, errorText)) return fail('LLM_NOT_CONFIGURED', `agy does not know the model ${requestedModel}`);
  const ran = executedTools(stream);
  if (ran.length > 0) return fail('LLM_CLI_ISOLATION', `agy executed tool(s): ${[...new Set(ran)].sort().join(', ')}`);
  if (stream.result?.status === 'ERROR' || run.exitCode !== 0) {
    if (matches(AGY_CLASSIFIER.USAGE_LIMIT, errorText)) return fail('LLM_USAGE_LIMIT', 'agy reported a quota or capacity limit');
    return fail('LLM_CLI_EXIT', `agy failed (exit ${String(run.exitCode)}): ${(stream.result?.error ?? '').slice(0, EXCERPT)}`);
  }
  if (stream.result === null) return fail('LLM_CLI_BAD_ENVELOPE', 'agy printed no result event');
  if (stream.init !== null && stream.init.model !== requestedModel) {
    return fail('LLM_CLI_ISOLATION', `agy ran model ${String(stream.init.model)} instead of ${requestedModel}`);
  }
  if (answerText(stream.result) === '') {
    return fail('LLM_CLI_EXIT', 'agy returned an empty answer', { deniedTools: deniedToolCount(stream) });
  }
  return { stream, error: null };
}

// ── Pre-flight (version, home, settings, MCP and plugins) ─────────────────────────────────

export function parseAgyVersion(stdout: string): string | null {
  return /\b([0-9]+\.[0-9]+\.[0-9]+)\b/.exec(stdout)?.[1] ?? null;
}

/** Checks the home's `settings.json` key values; key names and expected values only are reported. */
export function checkAgySettings(text: string): readonly string[] {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return ['settings.json is not valid JSON'];
  }
  if (!isRecord(value)) return ['settings.json is not a JSON object'];
  const problems: string[] = [];
  for (const [key, expected] of Object.entries(AGY_REQUIRED_SETTINGS)) {
    if (value[key] !== expected) problems.push(`settings.json ${key} must be ${JSON.stringify(expected)}`);
  }
  for (const [key, bad] of Object.entries(AGY_FORBIDDEN_SETTINGS)) {
    if (value[key] === bad) problems.push(`settings.json ${key} must not be ${JSON.stringify(bad)}`);
  }
  for (const key of ['mcpServers', 'hooks', 'plugins', 'customModelsConfig', 'modelProvider', 'agentMode']) {
    const v = value[key];
    if (v !== undefined && v !== null && v !== '' && !(isRecord(v) && Object.keys(v).length === 0)) problems.push(`settings.json ${key} must be unset`);
  }
  const permissions = isRecord(value.permissions) ? value.permissions : {};
  const deny = Array.isArray(permissions.deny) ? (permissions.deny as unknown[]).map(String) : [];
  const missing = AGY_REQUIRED_DENY.filter((rule) => !deny.includes(rule));
  if (missing.length > 0) problems.push(`settings.json permissions.deny lacks ${missing.join(', ')}`);
  for (const key of ['allow', 'ask']) {
    const list = permissions[key];
    if (Array.isArray(list) && list.length > 0) problems.push(`settings.json permissions.${key} must be empty`);
  }
  return problems;
}

function isInsideGit(dir: string): boolean {
  for (let at = path.resolve(dir); ; at = path.dirname(at)) {
    if (fs.existsSync(path.join(at, '.git'))) return true;
    if (path.dirname(at) === at) return false;
  }
}

function walkNames(root: string, rel: string, out: string[]): void {
  const abs = rel === '' ? root : path.join(root, rel);
  for (const name of fs.readdirSync(abs).sort()) {
    const childRel = rel === '' ? name : `${rel}/${name}`;
    out.push(childRel);
    const stat = fs.lstatSync(path.join(root, childRel));
    if (stat.isDirectory() && childRel !== AGY_BUILTIN_DIR) walkNames(root, childRel, out);
  }
}

export interface AgyHomeCheck {
  readonly problems: readonly string[];
  /** sha256 of the canonical settings and the sorted forbidden-name scan (names only). */
  readonly configListingSha256: string;
}

/**
 * The dedicated home (names only, never file contents except `settings.json` and the MCP config's
 * emptiness): it exists, is not group- or world-accessible, lies outside every git repository, holds a
 * conforming `settings.json`, an empty MCP config, and no rule, skill, plugin, agent or hook entry
 * outside agy's own builtin directory.
 */
export function checkAgyHome(home: string): AgyHomeCheck {
  const problems: string[] = [];
  if (!fs.existsSync(home) || !fs.lstatSync(home).isDirectory()) {
    return { problems: ['dedicated agy home does not exist'], configListingSha256: sha256Hex('') };
  }
  if ((fs.statSync(home).mode & 0o077) !== 0) problems.push('dedicated agy home is accessible to group or others');
  if (isInsideGit(home)) problems.push('dedicated agy home lies inside a git repository');
  const names: string[] = [];
  walkNames(home, '', names);
  const forbidden = names.filter((n) => n.split('/').some((seg) => AGY_HOME_FORBIDDEN_NAMES.includes(seg)));
  for (const n of forbidden) problems.push(`forbidden entry ${n}`);
  const settingsPath = path.join(home, '.gemini/antigravity-cli/settings.json');
  let settingsCanon = '';
  if (!fs.existsSync(settingsPath)) problems.push('settings.json is missing');
  else {
    const text = fs.readFileSync(settingsPath, 'utf8');
    problems.push(...checkAgySettings(text));
    try {
      settingsCanon = canonicalJSON(JSON.parse(text));
    } catch {
      settingsCanon = '';
    }
  }
  const mcpPath = path.join(home, '.gemini/config/mcp_config.json');
  if (fs.existsSync(mcpPath)) {
    const text = fs.readFileSync(mcpPath, 'utf8').trim();
    let empty = text === '';
    if (!empty) {
      try {
        const v: unknown = JSON.parse(text);
        empty = isRecord(v) && (Object.keys(v).length === 0 || (isRecord(v.mcpServers) && Object.keys(v.mcpServers).length === 0));
      } catch {
        empty = false;
      }
    }
    if (!empty) problems.push('mcp_config.json is not empty');
  }
  return { problems, configListingSha256: sha256Hex(`${settingsCanon}\n${forbidden.join('\n')}`) };
}

/** The first ancestor (the dir itself included) holding a rule file, a customisation dir or `.git`. */
export function findAgyAncestorContext(dir: string): string | null {
  for (let at = fs.realpathSync(dir); ; at = path.dirname(at)) {
    for (const name of AGY_ANCESTOR_FORBIDDEN) {
      if (fs.existsSync(path.join(at, name))) return path.join(at, name);
    }
    if (path.dirname(at) === at) return null;
  }
}

/** A fresh empty `mkdtemp` cwd with no rule file, customisation dir or repository on its ancestor chain. */
export function createAgyNeutralCwd(tmpRoot: string = os.tmpdir()): DomainResult<string> {
  const dir = fs.mkdtempSync(path.join(tmpRoot, AGY_NEUTRAL_CWD_PREFIX));
  const hit = findAgyAncestorContext(dir);
  if (hit !== null) {
    fs.rmSync(dir, { recursive: true, force: true });
    return DomainResult.fail([{ code: 'LLM_CLI_ISOLATION', message: `Neutral cwd has ${path.basename(hit)} on its ancestor chain`, context: { found: path.basename(hit) } }]);
  }
  return DomainResult.ok(dir);
}

export interface AgyIsolation {
  readonly cliVersion: string;
  readonly configListingSha256: string;
  /** sha256 of the canonical probe facts (version, MCP and plugin listings, home check). */
  readonly isolationProbeSha256: string;
}

const MCP_EMPTY = 'No MCP servers configured.';
const PLUGINS_EMPTY = 'No imported plugins.';

/**
 * Record-mode pre-flight, in order: `agy --version` against the pin (VERSION_DRIFT), the home check,
 * `agy mcp list` and `agy plugin list` reporting none (ISOLATION). None of these is a model call.
 */
export async function checkAgyIsolation(input: {
  readonly runner: ProcessRunner;
  readonly home: string;
  readonly binary?: string;
  readonly parentEnv?: NodeJS.ProcessEnv;
  readonly tmpRoot?: string;
}): Promise<DomainResult<AgyIsolation>> {
  const parentEnv = input.parentEnv ?? process.env;
  const secrets = knownSecretsFrom(parentEnv);
  const binary = input.binary ?? AGY_BINARY_DEFAULT;
  const env = buildAgyChildEnv(parentEnv, input.home);
  const cwd = createAgyNeutralCwd(input.tmpRoot);
  if (!cwd.success) return DomainResult.fail(cwd.errors);
  const runIn = async (args: readonly string[]): Promise<DomainResult<ProcessResult>> =>
    input.runner.run(binary, args, { cwd: cwd.data, env, timeoutMs: AGY_VERSION_TIMEOUT_MS, stdin: '' });
  try {
    const version = await runIn(['--version']);
    if (!version.success) {
      return DomainResult.fail([{ code: 'LLM_CLI_NOT_FOUND', message: scrubSecrets(version.errors[0]?.message ?? 'agy not found', secrets) }]);
    }
    const found = version.data.exitCode === 0 ? parseAgyVersion(version.data.stdout) : null;
    if (found === null) return DomainResult.fail([{ code: 'LLM_CLI_NOT_FOUND', message: 'agy --version printed no version' }]);
    if (found !== AGY_PINNED_VERSION) {
      return DomainResult.fail([{ code: 'LLM_CLI_VERSION_DRIFT', message: `agy ${found} differs from the pinned ${AGY_PINNED_VERSION}`, context: { found, pinned: AGY_PINNED_VERSION } }]);
    }
    const home = checkAgyHome(input.home);
    if (home.problems.length > 0) {
      return DomainResult.fail([{ code: 'LLM_CLI_ISOLATION', message: `agy home fails ${String(home.problems.length)} check(s)`, context: { problems: [...home.problems] } }]);
    }
    const mcp = await runIn(['mcp', 'list']);
    const plugins = await runIn(['plugin', 'list']);
    const mcpOut = mcp.success ? mcp.data.stdout.trim() : '';
    const pluginOut = plugins.success ? plugins.data.stdout.trim() : '';
    if (mcpOut !== MCP_EMPTY) return DomainResult.fail([{ code: 'LLM_CLI_ISOLATION', message: 'agy mcp list reports configured servers' }]);
    if (pluginOut !== PLUGINS_EMPTY) return DomainResult.fail([{ code: 'LLM_CLI_ISOLATION', message: 'agy plugin list reports plugins' }]);
    const facts = { cliVersion: found, mcp: mcpOut, plugins: pluginOut, configListingSha256: home.configListingSha256 };
    return DomainResult.ok({ cliVersion: found, configListingSha256: home.configListingSha256, isolationProbeSha256: sha256Hex(canonicalJSON(facts)) });
  } finally {
    fs.rmSync(cwd.data, { recursive: true, force: true });
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────────────────

/** Options agy cannot send: no temperature, seed, max-token or effort flags are used (ADR-021). */
const AGY_UNSENT_OPTIONS = ['temperature', 'seed', 'maxTokens', 'effort'] as const;

export class AgyCliProvider implements LLMProvider, ArgvFlagSource {
  readonly name = 'agy';
  private readonly binary: string;
  private readonly model: string;
  private readonly mode: VCRMode;
  private readonly printTimeoutS: number;
  private readonly parentEnv: NodeJS.ProcessEnv;
  private readonly secrets: readonly string[];
  private preparing: Promise<DomainResult<AgyIsolation>> | null = null;
  private isolation: AgyIsolation | null = null;

  constructor(private readonly config: AgyCliProviderConfig, private readonly deps: AgyCliProviderDeps) {
    this.binary = config.binary ?? AGY_BINARY_DEFAULT;
    this.model = config.model ?? AGY_LABELLER_MODEL;
    this.mode = config.mode ?? 'record';
    this.printTimeoutS = config.printTimeoutS ?? AGY_PRINT_TIMEOUT_S;
    this.parentEnv = deps.parentEnv ?? process.env;
    this.secrets = knownSecretsFrom(this.parentEnv);
  }

  describe(): ProviderDescription {
    return { provider: 'agy', model: this.model, ...(this.isolation !== null ? { cliVersion: this.isolation.cliVersion } : {}) };
  }

  requestArgvFlags(options: LLMOptions, call: LLMCallContext): readonly string[] {
    return buildAgyArgs({ binary: this.binary, model: options.model, schema: call.responseSchema ?? '', printTimeoutS: this.printTimeoutS }).argvFlags;
  }

  /** Memoised record-mode pre-flight; replay never spawns. */
  prepare(): Promise<DomainResult<AgyIsolation>> {
    if (this.mode === 'replay') {
      return Promise.resolve(DomainResult.fail([{ code: 'LLM_CLI_ISOLATION', message: 'agy provider is not used in replay mode' }]));
    }
    this.preparing ??= checkAgyIsolation({
      runner: this.deps.runner, home: this.config.home, binary: this.binary, parentEnv: this.parentEnv,
      ...(this.deps.tmpRoot !== undefined ? { tmpRoot: this.deps.tmpRoot } : {}),
    }).then((r) => {
      if (r.success) this.isolation = r.data;
      return r;
    });
    return this.preparing;
  }

  isolationResult(): AgyIsolation | null {
    return this.isolation;
  }

  async evaluate(prompt: string, options: LLMOptions, call?: LLMCallContext): Promise<DomainResult<LLMResponse>> {
    const prepared = await this.prepare();
    if (!prepared.success) return DomainResult.fail(prepared.errors);
    if (call?.responseSchema === undefined) {
      return DomainResult.fail([{ code: 'LLM_NOT_CONFIGURED', message: 'agy labeller calls need a response schema' }]);
    }
    const cwd = createAgyNeutralCwd(this.deps.tmpRoot);
    if (!cwd.success) return DomainResult.fail(cwd.errors);
    try {
      const argv = buildAgyArgs({ binary: this.binary, model: options.model, schema: call.responseSchema, printTimeoutS: this.printTimeoutS });
      const run = await this.deps.runner.run(argv.binary, argv.args, {
        stdin: composeAgyPrompt(prompt, call.systemPrompt),
        cwd: cwd.data,
        env: buildAgyChildEnv(this.parentEnv, this.config.home),
        timeoutMs: (this.printTimeoutS + 30) * 1000,
      });
      if (!run.success) {
        return DomainResult.fail([{ code: 'LLM_CLI_NOT_FOUND', message: scrubSecrets(run.errors[0]?.message ?? 'agy could not be started', this.secrets) }]);
      }
      const { stream, error } = classifyAgyResult(run.data, options.model, this.secrets);
      if (error !== null || stream.result === null) {
        return DomainResult.fail([error ?? { code: 'LLM_CLI_BAD_ENVELOPE', message: 'agy printed no result event' }]);
      }
      const usage = stream.result.usage ?? {};
      return DomainResult.ok({
        content: answerText(stream.result),
        model: stream.init?.model ?? options.model,
        usage: {
          inputTokens: (usage.input_tokens ?? 0) + (usage.cache_read_tokens ?? 0),
          outputTokens: usage.output_tokens ?? 0,
        },
        usedOptions: { model: options.model },
        ignoredOptions: AGY_UNSENT_OPTIONS.filter((k) => options[k] !== undefined),
      });
    } finally {
      fs.rmSync(cwd.data, { recursive: true, force: true });
    }
  }
}
