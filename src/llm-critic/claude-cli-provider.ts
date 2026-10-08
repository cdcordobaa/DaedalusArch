/**
 * C14 Claude CLI judge provider (U4 Step 19; BR-U4-ISO-02..07, ISO-09, VRD-07, OPS-02, 03,
 * 05, 06; D-U0-7; DE §5.1-5.4; ADR-017 item 9; ADR-018).
 *
 * The judge is reached only through the headless CLI under the author's subscription login
 * in a dedicated `CLAUDE_CONFIG_DIR` (ISO-01, ISO-04). Every call:
 * - runs the frozen argv (ISO-02) with the prompt on stdin, never in argv;
 * - runs under `buildChildEnv` with the `JUDGE_ENV_ALLOW` names only, `CLAUDE_CONFIG_DIR`
 *   set to the judge dir and `DISABLE_AUTOUPDATER=1` (ISO-03, ISO-09, ADR-018 item 4);
 * - runs in a fresh neutral cwd with no `CLAUDE.md` or `.claude` on its ancestor chain (ISO-05).
 *
 * Before the first call of a record-mode run, `checkJudgeIsolation` checks, in this order
 * (BLM §6): the CLI version against `PINNED_CLI_VERSION` (ISO-09), the config-dir entry
 * names against the ADR-018 allow-list (ISO-04), the neutral cwd (ISO-05), and one
 * stream-json init probe against the frozen pass condition (ISO-06). Any failure is a stop
 * (`LLM_CLI_VERSION_DRIFT` or `LLM_CLI_ISOLATION`) before any judge call; the cassette
 * decorator never records a stop. Replay never reaches this provider (OPS-06).
 *
 * Errors are classified from `is_error` plus the result text and scrubbed stderr, never from
 * `subtype` (ADR-018 item 5). Every message passes `scrubSecrets` (OPS-05, NFR-08).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type {
  LLMCallContext, LLMEffort, LLMOptions, LLMProvider, LLMResponse,
} from '../shared/interfaces/llm-provider.js';
import type { ProcessResult, ProcessRunner } from '../shared/interfaces/process-runner.js';
import type { ProviderDescription } from '../shared/types/evaluation.js';
import type { VCRMode } from '../shared/types/llm-config.js';
import type { DomainError } from '../shared/errors/domain-result.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import { scrubSecrets } from '../shared/errors/scrub.js';
import { buildChildEnv } from '../shared/process/node-process-runner.js';
import { globToRegex } from '../fitness-compiler/glob-to-regex.js';
import { canonicalJSON, sha256Hex } from './canonical-json.js';
import {
  CLASSIFIER_PATTERNS, CLAUDE_CLI_FLAGS, CLAUDE_CLI_OUTPUT_FORMAT, CLAUDE_CLI_SETTING_SOURCES,
  CONFIG_DIR_ALLOWLIST, CONFIG_DIR_FORBIDDEN_NAMES, INIT_PASS_CONDITION, INIT_PROBE_PROMPT,
  JUDGE_EFFORT, JUDGE_ENV_ALLOW, JUDGE_ENV_SET, JUDGE_MODEL, JUDGE_PERSONA, JUDGE_TIMEOUT_MS,
  MODEL_USAGE_FIELD, NEUTRAL_CWD_PREFIX, PINNED_CLI_VERSION, SETTINGS_JSON_ALLOWED_ENV_KEYS,
  SETTINGS_JSON_ALLOWED_KEYS, STRUCTURED_OUTPUT_FIELD, TOOLS_FLAG, VERSION_CHECK_TIMEOUT_MS,
} from './frozen.js';
import type { ConfigAllowItem } from './frozen.js';
import { VERDICT_SCHEMA_TEXT } from './verdict-schema.js';
import { parseEnvelopeVerdict } from './verdict-parser.js';
import type { ArgvFlagSource, Interpretation, JudgeRequest, ResponseInterpreter } from './cassette-provider.js';
import { knownSecretsFrom } from './cassette-provider.js';

// ── Configuration (DE §5.3; the shared `ClaudeCliConfig` is U0-owned and left unchanged) ──

export interface ClaudeCliProviderConfig {
  /** Binary name or absolute path; resolved against the child `PATH` (default `claude`). */
  readonly binary?: string;
  readonly model?: string;                  // default JUDGE_MODEL
  readonly effort?: LLMEffort;              // default JUDGE_EFFORT
  readonly timeoutMs?: number;              // default JUDGE_TIMEOUT_MS
  /** Absolute, `~`-expanded judge config dir (ISO-04; expanded by `parseLLMOptions`). */
  readonly judgeConfigDir: string;
  readonly toolsFlag?: boolean;             // default TOOLS_FLAG (probe)
  readonly mode?: VCRMode;                  // default 'record'
  /** The evaluated project; the config dir must not lie inside it (ISO-04). */
  readonly projectRoot?: string;
}

export interface ClaudeCliProviderDeps {
  readonly runner: ProcessRunner;
  /** Parent environment the child env is built from (default `process.env`). */
  readonly parentEnv?: NodeJS.ProcessEnv;
  /** Root under which the neutral cwd is created (default `os.tmpdir()`). */
  readonly tmpRoot?: string;
}

// ── Argv (ISO-02) ────────────────────────────────────────────────────────────────────────

export interface ClaudeCliArgv {
  readonly binary: string;
  readonly args: readonly string[];
  /** The non-content argv, hashed into the cassette key (DE §3.5); content values are separate key fields. */
  readonly argvFlags: readonly string[];
}

export interface ClaudeCliArgsInput {
  readonly binary?: string;
  readonly model: string;
  readonly effort: LLMEffort;
  readonly schema: string;
  readonly persona: string;
  readonly toolsFlag?: boolean;
  /** `json` for judge calls; `stream-json` (with `--verbose`) for the init probe (ISO-06). */
  readonly outputFormat?: 'json' | 'stream-json';
}

/** Flags whose values are content already hashed as their own request fields. */
const CONTENT_VALUED_FLAGS: ReadonlySet<string> = new Set(['--model', '--effort', '--json-schema', '--system-prompt']);

/**
 * The frozen argv in `CLAUDE_CLI_FLAGS` order (ISO-02):
 * `-p --model <model> --effort <effort> --output-format json --json-schema <schema>
 * --system-prompt <persona> --setting-sources project --strict-mcp-config
 * --disable-slash-commands --no-session-persistence --tools ""`. The prompt goes on stdin.
 */
export function buildClaudeCliArgs(input: ClaudeCliArgsInput): ClaudeCliArgv {
  const toolsFlag = input.toolsFlag ?? TOOLS_FLAG;
  const outputFormat = input.outputFormat ?? CLAUDE_CLI_OUTPUT_FORMAT;
  const values: Readonly<Record<string, string | null>> = {
    '-p': null,
    '--model': input.model,
    '--effort': input.effort,
    '--output-format': outputFormat,
    '--json-schema': input.schema,
    '--system-prompt': input.persona,
    '--setting-sources': CLAUDE_CLI_SETTING_SOURCES,
    '--strict-mcp-config': null,
    '--disable-slash-commands': null,
    '--no-session-persistence': null,
    '--tools': '',
  };
  const args: string[] = [];
  const argvFlags: string[] = [];
  for (const flag of CLAUDE_CLI_FLAGS) {
    if (flag === '--tools' && !toolsFlag) continue;
    const value = values[flag];
    args.push(flag);
    if (value === null || value === undefined) {
      argvFlags.push(flag);
      continue;
    }
    args.push(value);
    argvFlags.push(CONTENT_VALUED_FLAGS.has(flag) ? flag : `${flag}=${value}`);
    if (flag === '--output-format' && outputFormat === 'stream-json') {
      args.push('--verbose');
      argvFlags.push('--verbose');
    }
  }
  return { binary: input.binary ?? 'claude', args, argvFlags };
}

/** Child environment (ISO-03): allow-listed names only, the judge dir and the auto-update switch set. */
export function buildJudgeChildEnv(parent: NodeJS.ProcessEnv, judgeConfigDir: string): Readonly<Record<string, string>> {
  return buildChildEnv({ ...parent, CLAUDE_CONFIG_DIR: judgeConfigDir, ...JUDGE_ENV_SET }, JUDGE_ENV_ALLOW);
}

// ── Envelope (DE §5.1) and the actual-model rule (VRD-07) ────────────────────────────────

export interface ClaudeCliEnvelope {
  readonly result?: string;
  readonly structured_output?: unknown;
  readonly model?: string;
  readonly modelUsage?: Readonly<Record<string, { readonly outputTokens?: number; readonly inputTokens?: number }>>;
  readonly usage?: {
    readonly input_tokens?: number;
    readonly output_tokens?: number;
    readonly cache_creation_input_tokens?: number;
    readonly cache_read_input_tokens?: number;
  };
  readonly is_error?: boolean;
  readonly subtype?: string;
  readonly api_error_status?: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parses the json-format stdout; `null` when it is not one JSON object. */
export function parseEnvelope(stdout: string): ClaudeCliEnvelope | null {
  try {
    const value: unknown = JSON.parse(stdout.trim());
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Alias resolution (VRD-07, probe): the requested id resolves to itself (no suffix observed
 * on 2.1.294); a dated snapshot of the requested id (`<id>-YYYYMMDD`) also counts as it.
 */
export function modelMatches(requested: string, actual: string): boolean {
  if (actual === requested) return true;
  return actual.startsWith(`${requested}-`) && /^[0-9]{8}$/.test(actual.slice(requested.length + 1));
}

export type ModelResolution =
  | { readonly kind: 'ok'; readonly resolvedModel: string; readonly auxiliaryModels: readonly string[] }
  | { readonly kind: 'mismatch'; readonly models: readonly string[] };

/**
 * VRD-07: the requested id must equal, or alias-resolve to, the single model carrying output
 * tokens (`modelUsage` key with `outputTokens > 0`; `model` when no map is present).
 * Auxiliary models with zero output tokens are reported, not counted.
 */
export function resolveActualModel(envelope: ClaudeCliEnvelope, requested: string): ModelResolution {
  const usage = envelope[MODEL_USAGE_FIELD];
  if (!isRecord(usage)) {
    const model = envelope.model;
    return typeof model === 'string' && modelMatches(requested, model)
      ? { kind: 'ok', resolvedModel: model, auxiliaryModels: [] }
      : { kind: 'mismatch', models: typeof model === 'string' ? [model] : [] };
  }
  const names = Object.keys(usage).sort();
  const carrying = names.filter((name) => {
    const entry = usage[name];
    return isRecord(entry) && typeof entry.outputTokens === 'number' && entry.outputTokens > 0;
  });
  const model = carrying.length === 1 ? carrying[0] : undefined;
  if (model !== undefined) {
    return modelMatches(requested, model)
      ? { kind: 'ok', resolvedModel: model, auxiliaryModels: names.filter((n) => n !== model) }
      : { kind: 'mismatch', models: carrying };
  }
  if (carrying.length === 0) {
    // No output at all: the requested model must still be the one named.
    const named = names.filter((n) => modelMatches(requested, n));
    const only = named.length === 1 ? named[0] : undefined;
    return only !== undefined
      ? { kind: 'ok', resolvedModel: only, auxiliaryModels: names.filter((n) => n !== only) }
      : { kind: 'mismatch', models: names };
  }
  return { kind: 'mismatch', models: carrying };
}

/**
 * The stored answer of a CLI call: a reduced envelope (canonical JSON) holding what the
 * interpreter reads. Session ids, uuids, costs and telemetry are never stored in a cassette.
 */
export function reduceEnvelope(envelope: ClaudeCliEnvelope): string {
  const usage = envelope[MODEL_USAGE_FIELD];
  const modelUsage: Record<string, { inputTokens: number; outputTokens: number }> = {};
  if (isRecord(usage)) {
    for (const [name, entry] of Object.entries(usage)) {
      const e = isRecord(entry) ? entry : {};
      modelUsage[name] = {
        inputTokens: typeof e.inputTokens === 'number' ? e.inputTokens : 0,
        outputTokens: typeof e.outputTokens === 'number' ? e.outputTokens : 0,
      };
    }
  }
  return canonicalJSON({
    is_error: envelope.is_error === true,
    ...(typeof envelope.model === 'string' ? { model: envelope.model } : {}),
    ...(isRecord(usage) ? { [MODEL_USAGE_FIELD]: modelUsage } : {}),
    result: typeof envelope.result === 'string' ? envelope.result : '',
    ...(envelope[STRUCTURED_OUTPUT_FIELD] !== undefined ? { [STRUCTURED_OUTPUT_FIELD]: envelope[STRUCTURED_OUTPUT_FIELD] } : {}),
  });
}

/**
 * The CLI response interpreter for the cassette decorator (VRD-02, VRD-03, VRD-07): an
 * unparsable envelope is `BAD_ENVELOPE` (retried once); another model carrying output tokens
 * is `MODEL_MISMATCH`; then `structured_output` first, `result` text otherwise.
 */
export const interpretClaudeEnvelope: ResponseInterpreter = (response: LLMResponse, request: JudgeRequest): Interpretation => {
  const envelope = parseEnvelope(response.content);
  if (envelope === null) return { outcome: { kind: 'invalid', cause: 'BAD_ENVELOPE' }, verdict: null };
  const resolution = resolveActualModel(envelope, request.model);
  if (resolution.kind === 'mismatch') {
    return { outcome: { kind: 'invalid', cause: 'MODEL_MISMATCH' }, verdict: null };
  }
  const parsed = parseEnvelopeVerdict(envelope);
  return parsed.kind === 'valid'
    ? { outcome: { kind: 'valid' }, verdict: parsed.verdict, resolvedModel: resolution.resolvedModel }
    : { outcome: { kind: 'invalid', cause: parsed.cause }, verdict: null, resolvedModel: resolution.resolvedModel };
};

// ── Error classification (OPS-03, OPS-05, ADR-018 item 5) ────────────────────────────────

export type ClaudeCliErrorCode =
  | 'LLM_CLI_NOT_FOUND' | 'LLM_CLI_TIMEOUT' | 'LLM_CLI_EXIT' | 'LLM_CLI_BAD_ENVELOPE'
  | 'LLM_AUTH' | 'LLM_USAGE_LIMIT' | 'LLM_CLI_ISOLATION' | 'LLM_CLI_VERSION_DRIFT';

const AUTH_PATTERNS = CLASSIFIER_PATTERNS.AUTH.map((p) => new RegExp(p, 'm'));
const USAGE_PATTERNS = CLASSIFIER_PATTERNS.USAGE_LIMIT.map((p) => new RegExp(p, 'm'));

/** Auth and usage-limit stops from the envelope text and stderr; `null` for anything else. */
export function classifyStop(text: string, apiErrorStatus?: number | null): 'LLM_AUTH' | 'LLM_USAGE_LIMIT' | null {
  if (AUTH_PATTERNS.some((p) => p.test(text))) return 'LLM_AUTH';
  if (apiErrorStatus === CLASSIFIER_PATTERNS.usageLimitHttpStatus || USAGE_PATTERNS.some((p) => p.test(text))) {
    return 'LLM_USAGE_LIMIT';
  }
  return null;
}

const STDERR_EXCERPT_CHARS = 500;

/**
 * Maps one finished CLI process to an error, or `null` when the envelope is a successful
 * answer (OPS-05): timeout → `LLM_CLI_TIMEOUT`; `is_error` or a non-zero exit → auth or
 * usage-limit stop when the text matches, else `LLM_CLI_EXIT`; unparsable stdout after exit 0
 * → `LLM_CLI_BAD_ENVELOPE`. Messages carry a scrubbed stderr excerpt only.
 */
export function classifyProcessResult(
  result: ProcessResult,
  secrets: readonly string[],
): { readonly envelope: ClaudeCliEnvelope | null; readonly error: DomainError | null } {
  const stderr = scrubSecrets(result.stderr.slice(0, STDERR_EXCERPT_CHARS), secrets);
  const fail = (code: ClaudeCliErrorCode, message: string): DomainError => ({
    code, message: scrubSecrets(message, secrets), context: { exitCode: result.exitCode, ...(stderr !== '' ? { stderr } : {}) },
  });
  if (result.timedOut) {
    return { envelope: null, error: fail('LLM_CLI_TIMEOUT', `Claude CLI timed out after ${String(Math.round(result.durationMs))} ms`) };
  }
  const envelope = parseEnvelope(result.stdout);
  if (envelope !== null && envelope.is_error === true) {
    const text = `${typeof envelope.result === 'string' ? envelope.result : ''}\n${result.stderr}`;
    const stop = classifyStop(text, envelope.api_error_status);
    const resultText = typeof envelope.result === 'string' ? envelope.result.slice(0, STDERR_EXCERPT_CHARS) : '';
    return { envelope, error: fail(stop ?? 'LLM_CLI_EXIT', `Claude CLI reported an error (exit ${String(result.exitCode)}): ${resultText}`) };
  }
  if (result.exitCode !== 0) {
    const stop = classifyStop(result.stderr);
    return { envelope, error: fail(stop ?? 'LLM_CLI_EXIT', `Claude CLI exited with code ${String(result.exitCode)}${stderr !== '' ? `: ${stderr}` : ''}`) };
  }
  if (envelope === null) {
    return { envelope: null, error: fail('LLM_CLI_BAD_ENVELOPE', 'Claude CLI output is not a JSON envelope') };
  }
  return { envelope, error: null };
}

// ── Version pin (ISO-09) ─────────────────────────────────────────────────────────────────

/** The first `x.y.z` token of `claude --version` output (`2.1.294 (Claude Code)`). */
export function parseCliVersion(stdout: string): string | null {
  const match = /\b([0-9]+\.[0-9]+\.[0-9]+)\b/.exec(stdout);
  return match?.[1] ?? null;
}

async function readCliVersion(
  runner: ProcessRunner, binary: string, env: Readonly<Record<string, string>>, secrets: readonly string[],
): Promise<DomainResult<string>> {
  const run = await runner.run(binary, ['--version'], { env, timeoutMs: VERSION_CHECK_TIMEOUT_MS });
  if (!run.success) {
    return DomainResult.fail([{ code: 'LLM_CLI_NOT_FOUND', message: scrubSecrets(run.errors[0]?.message ?? 'claude not found', secrets) }]);
  }
  if (run.data.timedOut || run.data.exitCode !== 0) {
    return DomainResult.fail([{ code: 'LLM_CLI_NOT_FOUND', message: `claude --version failed (exit ${String(run.data.exitCode)}${run.data.timedOut ? ', timed out' : ''})` }]);
  }
  const version = parseCliVersion(run.data.stdout);
  return version === null
    ? DomainResult.fail([{ code: 'LLM_CLI_NOT_FOUND', message: 'claude --version printed no version' }])
    : DomainResult.ok(version);
}

// ── Config-dir listing (ISO-04, ADR-018 items 1-3) ───────────────────────────────────────

export interface ConfigListingResult {
  readonly pass: boolean;
  /** Sorted distinct allow-list items that matched at least one entry. */
  readonly matchedItems: readonly string[];
  /** sha256(matchedItems joined by "\n"); variable state-file names do not change it. */
  readonly configListingSha256: string;
  /** Root-relative entry names that failed, with the reason (names only, never contents). */
  readonly failures: readonly { readonly entry: string; readonly reason: string }[];
}

function itemMatches(item: ConfigAllowItem, entry: string): boolean {
  if (item.match === 'exact') return entry === item.pattern;
  const source = item.match === 'glob' ? globToRegex(item.pattern) : item.pattern;
  return new RegExp(source).test(entry);
}

/** ADR-018 item 3: top-level keys ⊆ {theme, env}, env keys ⊆ {DISABLE_AUTOUPDATER}; key names only. */
export function checkSettingsJson(text: string): string | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return 'settings.json is not valid JSON';
  }
  if (!isRecord(value)) return 'settings.json is not a JSON object';
  const extra = Object.keys(value).filter((k) => !SETTINGS_JSON_ALLOWED_KEYS.includes(k)).sort();
  if (extra.length > 0) return `settings.json has disallowed keys: ${extra.join(', ')}`;
  if ('env' in value) {
    const env = value.env;
    if (!isRecord(env)) return 'settings.json env is not an object';
    const extraEnv = Object.keys(env).filter((k) => !SETTINGS_JSON_ALLOWED_ENV_KEYS.includes(k)).sort();
    if (extraEnv.length > 0) return `settings.json env has disallowed keys: ${extraEnv.join(', ')}`;
  }
  return null;
}

interface ListedEntry {
  readonly rel: string;
  readonly kind: 'dir' | 'file' | 'other';
  readonly empty: boolean;
}

function listEntries(root: string): ListedEntry[] {
  const out: ListedEntry[] = [];
  const walk = (abs: string, rel: string): void => {
    const names = fs.readdirSync(abs).sort();
    for (const name of names) {
      const childAbs = path.join(abs, name);
      const childRel = rel === '' ? name : `${rel}/${name}`;
      const stat = fs.lstatSync(childAbs);
      if (stat.isDirectory()) {
        const empty = fs.readdirSync(childAbs).length === 0;
        out.push({ rel: childRel, kind: 'dir', empty });
        walk(childAbs, childRel);
      } else {
        out.push({ rel: childRel, kind: stat.isFile() ? 'file' : 'other', empty: true });
      }
    }
  };
  walk(root, '');
  return out;
}

/**
 * Lists the judge config dir recursively (names only) and matches every entry: a forbidden
 * name on any path segment fails first (defence in depth, ISO-04); then an allow-list item
 * must match with its kind; symlinks and other special files fail; `projects/*\/memory` must
 * be empty; `settings.json` passes its key-name rule. Unmatched entries fail closed.
 */
export function checkConfigListing(judgeConfigDir: string): ConfigListingResult {
  const failures: { entry: string; reason: string }[] = [];
  const matched = new Set<string>();
  let entries: ListedEntry[];
  try {
    entries = listEntries(judgeConfigDir);
  } catch {
    return { pass: false, matchedItems: [], configListingSha256: sha256Hex(''), failures: [{ entry: '.', reason: 'judge config dir cannot be listed' }] };
  }
  for (const entry of entries) {
    const segments = entry.rel.split('/');
    const forbidden = segments.find((s) => CONFIG_DIR_FORBIDDEN_NAMES.includes(s));
    if (forbidden !== undefined) {
      failures.push({ entry: entry.rel, reason: `forbidden name ${forbidden}` });
      continue;
    }
    if (entry.kind === 'other') {
      failures.push({ entry: entry.rel, reason: 'not a regular file or directory' });
      continue;
    }
    const item = CONFIG_DIR_ALLOWLIST.find((i) => (i.kind === undefined || i.kind === entry.kind) && itemMatches(i, entry.rel));
    if (item === undefined) {
      failures.push({ entry: entry.rel, reason: 'matches no allow-list item' });
      continue;
    }
    if (item.emptyDirOnly === true && !entry.empty) {
      failures.push({ entry: entry.rel, reason: 'must be an empty directory' });
      continue;
    }
    if (item.contentRule === 'settings-json') {
      const problem = checkSettingsJson(fs.readFileSync(path.join(judgeConfigDir, entry.rel), 'utf8'));
      if (problem !== null) {
        failures.push({ entry: entry.rel, reason: problem });
        continue;
      }
    }
    matched.add(item.item);
  }
  const matchedItems = [...matched].sort();
  return { pass: failures.length === 0, matchedItems, configListingSha256: sha256Hex(matchedItems.join('\n')), failures };
}

/** Real path of `p`, or of its nearest existing ancestor joined with the missing rest. */
function realOrResolved(p: string): string {
  const abs = path.resolve(p);
  const missing: string[] = [];
  for (let at = abs; ; at = path.dirname(at)) {
    try {
      return path.join(fs.realpathSync(at), ...missing.reverse());
    } catch {
      if (path.dirname(at) === at) return abs;
      missing.push(path.basename(at));
    }
  }
}

function isInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * ISO-04 placement: the judge dir must not lie inside the evaluated project nor inside any
 * git repository (this one included). Returns the reason, or `null` when the placement holds.
 */
export function configDirPlacementProblem(judgeConfigDir: string, projectRoot?: string): string | null {
  const dir = realOrResolved(judgeConfigDir);
  if (projectRoot !== undefined && isInside(dir, realOrResolved(projectRoot))) {
    return 'judge config dir lies inside the evaluated project';
  }
  for (let at = dir; ; at = path.dirname(at)) {
    if (fs.existsSync(path.join(at, '.git'))) return 'judge config dir lies inside a git repository';
    if (path.dirname(at) === at) break;
  }
  return null;
}

// ── Neutral cwd (ISO-05) ─────────────────────────────────────────────────────────────────

/** The first ancestor (the dir itself included) holding `CLAUDE.md` or a `.claude` dir, or `null`. */
export function findAncestorInstructions(dir: string): string | null {
  for (let at = realOrResolved(dir); ; at = path.dirname(at)) {
    if (fs.existsSync(path.join(at, 'CLAUDE.md'))) return path.join(at, 'CLAUDE.md');
    if (fs.existsSync(path.join(at, '.claude'))) return path.join(at, '.claude');
    if (path.dirname(at) === at) return null;
  }
}

/** `mkdtemp(<tmpRoot>/daedalus-judge-)`; fails closed (and removes it) when an ancestor holds instructions. */
export function createNeutralCwd(tmpRoot: string = os.tmpdir()): DomainResult<string> {
  const dir = fs.mkdtempSync(path.join(tmpRoot, NEUTRAL_CWD_PREFIX));
  const hit = findAncestorInstructions(dir);
  if (hit !== null) {
    fs.rmSync(dir, { recursive: true, force: true });
    return DomainResult.fail([{
      code: 'LLM_CLI_ISOLATION',
      message: `Neutral cwd has ${path.basename(hit)} on its ancestor chain`,
      context: { found: path.basename(hit) },
    }]);
  }
  return DomainResult.ok(dir);
}

// ── Init probe (ISO-06; DE §5.4) ─────────────────────────────────────────────────────────

export interface InitEvent {
  readonly tools?: readonly string[];
  readonly mcp_servers?: readonly unknown[];
  readonly model?: string;
  readonly apiKeySource?: string;
  readonly claude_code_version?: string;
}

export interface IsolationProbeResult {
  readonly cliVersion: string;
  readonly tools: readonly string[];
  readonly mcpServers: readonly string[];
  readonly model: string;
  readonly apiKeySource: string;
  /** The matched allow-list items (stable across state-file names; see Step 19 deviation). */
  readonly configListing: readonly string[];
  readonly pass: boolean;
}

function mcpName(server: unknown): string {
  if (typeof server === 'string') return server;
  if (isRecord(server) && typeof server.name === 'string') return server.name;
  return canonicalJSON(server);
}

/** ISO-06 pass condition: tools ⊆ {StructuredOutput}, no MCP server, model per VRD-07, apiKeySource none. */
export function evaluateInitEvent(init: InitEvent, requestedModel: string = INIT_PASS_CONDITION.model): { readonly pass: boolean; readonly reasons: readonly string[] } {
  const reasons: string[] = [];
  const tools: readonly string[] | null = Array.isArray(init.tools) ? (init.tools as readonly unknown[]).map(String) : null;
  if (tools === null) reasons.push('init event has no tools list');
  else {
    const extra = tools.filter((t) => !INIT_PASS_CONDITION.tools.includes(t));
    if (extra.length > 0) reasons.push(`unexpected tools: ${[...extra].sort().join(', ')}`);
  }
  if (!Array.isArray(init.mcp_servers) || init.mcp_servers.length !== 0) reasons.push('MCP servers present');
  if (typeof init.model !== 'string' || !modelMatches(requestedModel, init.model)) reasons.push('model differs from the judge model');
  if (init.apiKeySource !== INIT_PASS_CONDITION.apiKeySource) reasons.push('apiKeySource is not none');
  return { pass: reasons.length === 0, reasons };
}

/** The `system`/`init` event of stream-json output, and a final `result` event if any. */
export function readStreamEvents(stdout: string): { readonly init: InitEvent | null; readonly result: ClaudeCliEnvelope | null } {
  let init: InitEvent | null = null;
  let result: ClaudeCliEnvelope | null = null;
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
    if (value.type === 'system' && value.subtype === 'init' && init === null) init = value;
    if (value.type === 'result') result = value;
  }
  return { init, result };
}

export function isolationProbeSha256Of(result: IsolationProbeResult): string {
  const { pass: _pass, ...rest } = result;
  return sha256Hex(canonicalJSON(rest));
}

// ── Isolation check (BLM §6) ─────────────────────────────────────────────────────────────

export interface JudgeIsolation {
  readonly cliVersion: string;
  readonly neutralCwd: string;
  readonly configListingSha256: string;
  readonly probe: IsolationProbeResult;
  readonly isolationProbeSha256: string;
}

export interface JudgeIsolationInput {
  readonly runner: ProcessRunner;
  readonly judgeConfigDir: string;
  readonly binary?: string;
  readonly model?: string;
  readonly effort?: LLMEffort;
  readonly toolsFlag?: boolean;
  readonly projectRoot?: string;
  readonly parentEnv?: NodeJS.ProcessEnv;
  readonly tmpRoot?: string;
  readonly timeoutMs?: number;
}

function isolationFail<T>(message: string, context?: Record<string, unknown>): DomainResult<T> {
  return DomainResult.fail([{ code: 'LLM_CLI_ISOLATION', message, ...(context !== undefined ? { context } : {}) }]);
}

/**
 * Record-mode pre-flight (BLM §6, ISO-04..06, ISO-09), in order: version pin, config-dir
 * placement and listing, neutral cwd, init probe. Any failure stops before any judge call.
 * On success the neutral cwd is kept for the run (the caller removes it at run end).
 */
export async function checkJudgeIsolation(input: JudgeIsolationInput): Promise<DomainResult<JudgeIsolation>> {
  const parentEnv = input.parentEnv ?? process.env;
  const secrets = knownSecretsFrom(parentEnv);
  const binary = input.binary ?? 'claude';
  const model = input.model ?? JUDGE_MODEL;
  const env = buildJudgeChildEnv(parentEnv, input.judgeConfigDir);

  const version = await readCliVersion(input.runner, binary, env, secrets);
  if (!version.success) return DomainResult.fail(version.errors);
  if (version.data !== PINNED_CLI_VERSION) {
    return DomainResult.fail([{
      code: 'LLM_CLI_VERSION_DRIFT',
      message: `Claude CLI ${version.data} differs from the pinned ${PINNED_CLI_VERSION}`,
      context: { found: version.data, pinned: PINNED_CLI_VERSION },
    }]);
  }

  if (!fs.existsSync(input.judgeConfigDir) || !fs.lstatSync(input.judgeConfigDir).isDirectory()) {
    return isolationFail('Judge config dir does not exist');
  }
  const placement = configDirPlacementProblem(input.judgeConfigDir, input.projectRoot);
  if (placement !== null) return isolationFail(placement);
  const listing = checkConfigListing(input.judgeConfigDir);
  if (!listing.pass) {
    return isolationFail(`Judge config dir holds ${String(listing.failures.length)} entry(ies) outside the allow-list`, {
      failures: listing.failures.map((f) => `${f.entry}: ${f.reason}`),
    });
  }

  const cwd = createNeutralCwd(input.tmpRoot);
  if (!cwd.success) return DomainResult.fail(cwd.errors);
  const neutralCwd = cwd.data;
  const cleanup = <T>(r: DomainResult<T>): DomainResult<T> => {
    fs.rmSync(neutralCwd, { recursive: true, force: true });
    return r;
  };

  const argv = buildClaudeCliArgs({
    binary, model, effort: input.effort ?? JUDGE_EFFORT, schema: VERDICT_SCHEMA_TEXT, persona: JUDGE_PERSONA,
    ...(input.toolsFlag !== undefined ? { toolsFlag: input.toolsFlag } : {}), outputFormat: 'stream-json',
  });
  const run = await input.runner.run(argv.binary, argv.args, {
    stdin: INIT_PROBE_PROMPT, cwd: neutralCwd, env, timeoutMs: input.timeoutMs ?? JUDGE_TIMEOUT_MS,
  });
  if (!run.success) {
    return cleanup(DomainResult.fail([{ code: 'LLM_CLI_NOT_FOUND', message: scrubSecrets(run.errors[0]?.message ?? 'claude not found', secrets) }]));
  }
  const events = readStreamEvents(run.data.stdout);
  if (events.result !== null && events.result.is_error === true) {
    const stop = classifyStop(`${events.result.result ?? ''}\n${run.data.stderr}`, events.result.api_error_status);
    if (stop !== null) return cleanup(DomainResult.fail([{ code: stop, message: `Init probe: ${stop === 'LLM_AUTH' ? 'not authenticated' : 'usage limit reached'}` }]));
  }
  if (events.init === null) return cleanup(isolationFail('Init probe printed no init event'));
  const verdict = evaluateInitEvent(events.init, model);
  const probe: IsolationProbeResult = {
    cliVersion: version.data,
    tools: [...(events.init.tools ?? [])].sort(),
    mcpServers: (events.init.mcp_servers ?? []).map(mcpName).sort(),
    model: events.init.model ?? '',
    apiKeySource: events.init.apiKeySource ?? '',
    configListing: listing.matchedItems,
    pass: verdict.pass,
  };
  if (!verdict.pass) return cleanup(isolationFail('Init probe failed the isolation condition', { reasons: verdict.reasons }));
  return DomainResult.ok({
    cliVersion: version.data,
    neutralCwd,
    configListingSha256: listing.configListingSha256,
    probe,
    isolationProbeSha256: isolationProbeSha256Of(probe),
  });
}

// ── Provider ─────────────────────────────────────────────────────────────────────────────

/** Options the CLI never sends (FR-31, OPS-02): there are no such flags. */
const CLI_UNSENT_OPTIONS = ['temperature', 'seed', 'maxTokens'] as const;

export class ClaudeCliProvider implements LLMProvider, ArgvFlagSource {
  readonly name = 'claude-cli';
  private readonly binary: string;
  private readonly model: string;
  private readonly effort: LLMEffort;
  private readonly timeoutMs: number;
  private readonly toolsFlag: boolean;
  private readonly mode: VCRMode;
  private readonly parentEnv: NodeJS.ProcessEnv;
  private readonly secrets: readonly string[];
  private preparing: Promise<DomainResult<JudgeIsolation>> | null = null;
  private isolation: JudgeIsolation | null = null;

  constructor(private readonly config: ClaudeCliProviderConfig, private readonly deps: ClaudeCliProviderDeps) {
    this.binary = config.binary ?? 'claude';
    this.model = config.model ?? JUDGE_MODEL;
    this.effort = config.effort ?? JUDGE_EFFORT;
    this.timeoutMs = config.timeoutMs ?? JUDGE_TIMEOUT_MS;
    this.toolsFlag = config.toolsFlag ?? TOOLS_FLAG;
    this.mode = config.mode ?? 'record';
    this.parentEnv = deps.parentEnv ?? process.env;
    this.secrets = knownSecretsFrom(this.parentEnv);
  }

  /** The cassette interpreter for this provider's answers (VRD-02, VRD-07). */
  readonly interpret: ResponseInterpreter = interpretClaudeEnvelope;

  describe(): ProviderDescription {
    return {
      provider: 'claude-cli',
      model: this.model,
      effort: this.effort,
      ...(this.isolation !== null ? { cliVersion: this.isolation.cliVersion } : {}),
    };
  }

  /** Non-content argv hashed into the key (DE §3.5); identical for every judge call. */
  requestArgvFlags(options: LLMOptions, call: LLMCallContext): readonly string[] {
    return this.argvFor(options, call).argvFlags;
  }

  /** OPS-06: `claude --version` within 10 s, record mode only; replay never spawns. */
  async isAvailable(): Promise<boolean> {
    if (this.mode === 'replay') return true;
    const env = buildJudgeChildEnv(this.parentEnv, this.config.judgeConfigDir);
    const version = await readCliVersion(this.deps.runner, this.binary, env, this.secrets);
    return version.success;
  }

  /**
   * Record-mode pre-flight, run once (memoised): `checkJudgeIsolation`. Replay never needs it
   * and fails here instead of spawning (the decorator answers replay from cassettes).
   */
  prepare(): Promise<DomainResult<JudgeIsolation>> {
    if (this.mode === 'replay') {
      return Promise.resolve(isolationFail('Claude CLI provider is not used in replay mode'));
    }
    this.preparing ??= checkJudgeIsolation({
      runner: this.deps.runner,
      judgeConfigDir: this.config.judgeConfigDir,
      binary: this.binary,
      model: this.model,
      effort: this.effort,
      toolsFlag: this.toolsFlag,
      ...(this.config.projectRoot !== undefined ? { projectRoot: this.config.projectRoot } : {}),
      parentEnv: this.parentEnv,
      ...(this.deps.tmpRoot !== undefined ? { tmpRoot: this.deps.tmpRoot } : {}),
      timeoutMs: this.timeoutMs,
    }).then((r) => {
      if (r.success) this.isolation = r.data;
      return r;
    });
    return this.preparing;
  }

  /** The isolation result of a prepared run (provenance: version, probe and listing hashes). */
  isolationResult(): JudgeIsolation | null {
    return this.isolation;
  }

  /** Removes the neutral cwd at run end (ISO-05). */
  dispose(): void {
    if (this.isolation !== null) fs.rmSync(this.isolation.neutralCwd, { recursive: true, force: true });
  }

  async evaluate(prompt: string, options: LLMOptions, call?: LLMCallContext): Promise<DomainResult<LLMResponse>> {
    const prepared = await this.prepare();
    if (!prepared.success) return DomainResult.fail(prepared.errors);
    const argv = this.argvFor(options, call);
    const run = await this.deps.runner.run(argv.binary, argv.args, {
      stdin: prompt,
      cwd: prepared.data.neutralCwd,
      env: buildJudgeChildEnv(this.parentEnv, this.config.judgeConfigDir),
      timeoutMs: this.timeoutMs,
    });
    if (!run.success) {
      // D-U0-7: PROCESS_SPAWN_FAILED → LLM_CLI_NOT_FOUND (stop).
      const error = run.errors[0];
      return DomainResult.fail([{
        code: 'LLM_CLI_NOT_FOUND',
        message: scrubSecrets(error?.message ?? 'Claude CLI could not be started', this.secrets),
        ...(error?.context !== undefined ? { context: { errno: error.context.errno } } : {}),
      }]);
    }
    const { envelope, error } = classifyProcessResult(run.data, this.secrets);
    if (error !== null || envelope === null) {
      return DomainResult.fail([error ?? { code: 'LLM_CLI_BAD_ENVELOPE', message: 'Claude CLI output is not a JSON envelope' }]);
    }
    const resolution = resolveActualModel(envelope, options.model);
    const usage = envelope.usage ?? {};
    const effort = options.effort ?? this.effort;
    return DomainResult.ok({
      content: reduceEnvelope(envelope),
      model: resolution.kind === 'ok' ? resolution.resolvedModel : options.model,
      usage: {
        inputTokens: (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0),
        outputTokens: usage.output_tokens ?? 0,
      },
      usedOptions: { model: options.model, effort },
      ignoredOptions: CLI_UNSENT_OPTIONS.filter((k) => options[k] !== undefined),
    });
  }

  private argvFor(options: LLMOptions, call?: LLMCallContext): ClaudeCliArgv {
    return buildClaudeCliArgs({
      binary: this.binary,
      model: options.model,
      effort: options.effort ?? this.effort,
      schema: call?.responseSchema ?? VERDICT_SCHEMA_TEXT,
      persona: call?.systemPrompt ?? JUDGE_PERSONA,
      toolsFlag: this.toolsFlag,
    });
  }
}
