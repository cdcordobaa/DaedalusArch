/**
 * Codex CLI generator: confined argument set, child environment, read-deny list and config-home check
 * (FR-v1.2E-28; SECURITY-11 per ADR-017 item 8; ADR-029; `Docs/generator-protocol.md` §12).
 *
 * The Claude arm confines its agent with a tool allow-list and one exact Bash command (BR-U5a-41). Codex has no
 * exact-command allow rule (an execpolicy `allow` rule would run the command *outside* the sandbox), so the Codex arm
 * confines by the OS sandbox instead: every model-issued command and patch runs under the Seatbelt permission profile
 * `daedalus_gen` built here:
 * - writes only inside the run `cwd` (`:workspace` roots), with `$TMPDIR` and `/tmp` made read-only and the skeleton
 *   entries `package.json` and the `node_modules` symlink read-only inside `cwd`;
 * - network disabled (no install, no download);
 * - reads denied for the credential homes and for every sibling of the path from the repository's parent down to
 *   `cwd` (the repository and its worktrees, the corpus, other generations), computed per call by `codexReadDenies`.
 * The model-visible context is locked: no user config (`--ignore-user-config`), no execpolicy rules
 * (`--ignore-rules`), no AGENTS.md (`project_doc_max_bytes=0`, no root markers), no skills, apps, plugins, hooks,
 * MCP, web search, image or browser tools, no sub-agents (the pinned model catalog `modelCatalog` carries no
 * `multi_agent_version`), approval policy `never`. The prompt goes on stdin (`-`).
 *
 * `allowBash: false` (the Q13 B analogue) disables the shell tool, so the agent can only write files.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { DomainError } from '../../../src/shared/errors/domain-result.js';
import { buildChildEnv } from '../../../src/shared/process/node-process-runner.js';
import { canonicalPath, isInsideOrEqual } from './config.js';
import { CODEX_CLI_ADAPTER_ID_VALUE, GENERATOR_ENV_ALLOW } from './types.js';
import type { GeneratorCliConfig } from './types.js';

/** Adapter id of the Codex arm (`GridPlan.adapters[].adapterId`). */
export const CODEX_CLI_ADAPTER_ID = CODEX_CLI_ADAPTER_ID_VALUE;
/** Name of the Seatbelt permission profile passed with `-c`. */
export const CODEX_PERMISSION_PROFILE = 'daedalus_gen';
/** Reasoning efforts the pinned catalog entry accepts (checked against the plan). */
export const CODEX_REASONING_EFFORTS: readonly string[] = ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'];

/**
 * Features switched off on every call (the CLI 0.162.1 names; `codex features list`). `shell_tool` and
 * `unified_exec` stay on when `allowBash` is true; `code_mode_host` stays on because the pinned model's
 * `tool_mode` is `code_mode_only` (its tool calls go through it; commands still run in the sandbox).
 */
export const CODEX_DISABLED_FEATURES: readonly string[] = Object.freeze([
  'apps',
  'plugins',
  'remote_plugin',
  'plugin_sharing',
  'multi_agent',
  'multi_agent_v2',
  'hooks',
  'memories',
  'browser_use',
  'browser_use_external',
  'browser_use_full_cdp_access',
  'in_app_browser',
  'computer_use',
  'image_generation',
  'view_image',
  'goals',
  'tool_suggest',
  'skill_search',
  'skill_mcp_dependency_install',
  'shell_snapshot',
  'workspace_dependencies',
  'daemon_auto_start',
  'worktrees',
  'realtime_conversation',
]);

/** Features that give the agent a shell; disabled only in the no-shell variant. */
export const CODEX_SHELL_FEATURES: readonly string[] = Object.freeze(['shell_tool', 'unified_exec']);

/** Flags never emitted (each would widen the sandbox or bypass approvals). */
export const FORBIDDEN_CODEX_FLAGS: readonly string[] = [
  '--dangerously-bypass-approvals-and-sandbox',
  '--dangerously-bypass-hook-trust',
  '--approve-for-me',
  '--add-dir',
  '--worktree',
  '--oss',
  '--full-auto',
];

/** Credential homes under the real home whose reads are denied (names only; never read). */
export const CODEX_DENIED_HOME_ENTRIES: readonly string[] = ['.firewall', '.claude', '.codex', '.ssh', '.config', '.npmrc', '.netrc', '.aws', '.gnupg'];

/** Configuration of the Codex arm (the shared fields plus the Codex homes and pins). */
export interface CodexCliConfig extends GeneratorCliConfig {
  /** `CODEX_HOME`: the dedicated, logged-in config home (auth lives here; never read by the harness). */
  readonly codexHome: string;
  /** `HOME` of the child: a dedicated empty directory, so no user-level skills, shell profile or AGENTS.md leak in. */
  readonly userHome: string;
  /** The real home whose credential directories are read-denied in the sandbox. */
  readonly realHome: string;
  /** `model_reasoning_effort`, pinned by the plan. */
  readonly reasoningEffort: string;
  /** Exact CLI version (`codex --version` = `codex-cli <v>`), pinned by the plan. */
  readonly cliVersion: string;
  /** Absolute path of the pinned model catalog JSON (`model_catalog_json`). */
  readonly modelCatalog: string;
}

export interface CodexCliConfigInput {
  readonly base: GeneratorCliConfig;
  readonly codexHome: string;
  readonly userHome: string;
  readonly realHome: string;
  readonly reasoningEffort: string;
  readonly cliVersion: string;
  readonly modelCatalog: string;
}

const SAFE_VERSION = /^\d+\.\d+\.\d+$/;

function err(code: string, message: string, context?: Record<string, unknown>): DomainError {
  return context === undefined ? { code, message } : { code, message, context };
}

export function createCodexCliConfig(input: CodexCliConfigInput, repoRoot: string): DomainResult<CodexCliConfig> {
  const errors: DomainError[] = [];
  for (const [field, value] of [
    ['codexHome', input.codexHome],
    ['userHome', input.userHome],
    ['realHome', input.realHome],
    ['modelCatalog', input.modelCatalog],
  ] as const) {
    if (!path.isAbsolute(value)) errors.push(err('GEN_PATH_NOT_ABSOLUTE', `${field} must be an absolute path`, { field }));
  }
  if (!CODEX_REASONING_EFFORTS.includes(input.reasoningEffort)) errors.push(err('GEN_CODEX_CONFIG_INVALID', 'reasoningEffort is not a known effort'));
  if (!SAFE_VERSION.test(input.cliVersion)) errors.push(err('GEN_CODEX_CONFIG_INVALID', 'cliVersion must be x.y.z'));
  if (errors.length > 0) return DomainResult.fail(errors);
  for (const [field, value] of [
    ['codexHome', input.codexHome],
    ['userHome', input.userHome],
  ] as const) {
    if (isInsideOrEqual(repoRoot, value)) errors.push(err('GEN_CODEX_HOME_INSIDE_REPO', `${field} must lie outside the repository`));
    if (isInsideOrEqual(input.base.outputRoot, value)) errors.push(err('GEN_CODEX_HOME_INSIDE_CWD', `${field} must not lie inside outputRoot`));
  }
  if (canonicalPath(input.codexHome) === canonicalPath(input.userHome)) errors.push(err('GEN_CODEX_CONFIG_INVALID', 'userHome must differ from codexHome'));
  if (errors.length > 0) return DomainResult.fail(errors);
  return DomainResult.ok(
    Object.freeze({
      ...input.base,
      codexHome: path.normalize(input.codexHome),
      userHome: path.normalize(input.userHome),
      realHome: path.normalize(input.realHome),
      reasoningEffort: input.reasoningEffort,
      cliVersion: input.cliVersion,
      modelCatalog: path.normalize(input.modelCatalog),
    }),
  );
}

// --- read denials ----------------------------------------------------------------------------------------------

function listNames(dir: string): readonly string[] {
  try {
    return fs.readdirSync(dir).sort();
  } catch {
    return [];
  }
}

/**
 * Paths whose reads the sandbox denies for one run (sorted, unique, absolute):
 * - at every directory level from `anchor` (the repository's parent: the repository, its worktrees, the corpus and
 *   the other experiment roots are siblings there) down to `dirname(cwd)`, every entry that is not on the path to
 *   `cwd` and does not hold `harnessRoot` (so other generations, schedules, pilots and probes are denied as well);
 *   when `cwd` is not below `anchor`, the walk starts at `dirname(outputRoot)`;
 * - `codexHome`, and `CODEX_DENIED_HOME_ENTRIES` under `realHome`.
 * Ancestors of `cwd` are never denied (a denied ancestor breaks path resolution inside the sandbox), nor is the
 * harness (the type-check command and the skeleton install are read through it).
 */
export function codexReadDenies(
  config: Pick<CodexCliConfig, 'outputRoot' | 'harnessRoot' | 'codexHome' | 'realHome'>,
  cwd: string,
  anchor?: string,
): readonly string[] {
  const out = new Set<string>();
  const target = path.resolve(cwd);
  const inside = (root: string): boolean => {
    const r = path.relative(root, target);
    return r !== '' && !r.startsWith('..') && !path.isAbsolute(r);
  };
  const start = anchor !== undefined && inside(path.resolve(anchor)) ? path.resolve(anchor) : path.dirname(path.resolve(config.outputRoot));
  if (inside(start)) {
    let dir = start;
    for (const seg of path.relative(start, target).split(path.sep)) {
      for (const name of listNames(dir)) {
        if (name === seg) continue;
        const p = path.join(dir, name);
        if (!isInsideOrEqual(p, config.harnessRoot)) out.add(p);
      }
      dir = path.join(dir, seg);
    }
  }
  out.add(path.resolve(config.codexHome));
  for (const e of CODEX_DENIED_HOME_ENTRIES) out.add(path.join(config.realHome, e));
  for (const p of [...out]) {
    if (isInsideOrEqual(p, target) || isInsideOrEqual(p, config.harnessRoot)) out.delete(p);
  }
  return [...out].sort();
}

/** TOML string literal (JSON escaping is valid TOML basic-string escaping for these paths). */
function tomlString(s: string): string {
  return JSON.stringify(s);
}

/** The `-c permissions={…}` value: the `daedalus_gen` profile. */
export function codexPermissionsToml(denies: readonly string[]): string {
  const fsEntries = [
    '":tmpdir"="read"',
    '":slash_tmp"="read"',
    ...denies.map((p) => `${tomlString(p)}="deny"`),
    '":workspace_roots"={"node_modules"="read","package.json"="read"}',
  ];
  return `permissions={${CODEX_PERMISSION_PROFILE}={extends=":workspace", filesystem={${fsEntries.join(', ')}}, network={enabled=false}}}`;
}

/**
 * The exact Codex argument set (prompt on stdin): `exec --json --skip-git-repo-check --ignore-user-config
 * --ignore-rules -m <model> -C <cwd>`, the locked `-c` overrides, `--disable <feature>` for every
 * `CODEX_DISABLED_FEATURES` (plus the shell features when `allowBash` is false), then `-`.
 * Sessions are persisted (no `--ephemeral`): the rollout is the per-call model evidence (`codex-events.ts`) and is
 * moved out of `codexHome` after the call.
 */
export function buildCodexArgs(config: CodexCliConfig, cwd: string, denies: readonly string[]): readonly string[] {
  const args: string[] = [
    'exec',
    '--json',
    '--skip-git-repo-check',
    '--ignore-user-config',
    '--ignore-rules',
    '-m',
    config.modelId,
    '-C',
    cwd,
    '-c',
    `model_catalog_json=${tomlString(config.modelCatalog)}`,
    '-c',
    `model_reasoning_effort=${tomlString(config.reasoningEffort)}`,
    '-c',
    'approval_policy="never"',
    '-c',
    'project_doc_max_bytes=0',
    '-c',
    'project_root_markers=[]',
    '-c',
    'skills.include_instructions=false',
    '-c',
    'skills.bundled.enabled=false',
    '-c',
    'include_apps_instructions=false',
    '-c',
    'web_search="disabled"',
    '-c',
    'check_for_update_on_startup=false',
    '-c',
    'history.persistence="none"',
    '-c',
    'shell_environment_policy.inherit="core"',
    '-c',
    codexPermissionsToml(denies),
    '-c',
    `default_permissions=${tomlString(CODEX_PERMISSION_PROFILE)}`,
  ];
  const disabled = config.allowBash ? CODEX_DISABLED_FEATURES : [...CODEX_DISABLED_FEATURES, ...CODEX_SHELL_FEATURES];
  for (const f of disabled) args.push('--disable', f);
  args.push('-');
  return Object.freeze(args);
}

// --- child environment -----------------------------------------------------------------------------------------

/** Removed by name whatever the allow-list says. */
export const CODEX_ENV_DENY: readonly string[] = Object.freeze(['OPENAI_API_KEY', 'CODEX_API_KEY', 'OPENAI_BASE_URL', 'OPENAI_ORG_ID', 'OPENAI_PROJECT_ID']);
const DENY_SUFFIX = /_(?:TOKEN|KEY)$/i;

/**
 * `GENERATOR_ENV_ALLOW` from the parent, minus `HOME`; then `HOME = userHome`, `CODEX_HOME = codexHome`. API keys
 * and every `*_TOKEN` / `*_KEY` are removed, so the ChatGPT-plan login in `codexHome` is the only credential.
 */
export function buildCodexChildEnv(parent: NodeJS.ProcessEnv, config: Pick<CodexCliConfig, 'codexHome' | 'userHome'>): Readonly<Record<string, string>> {
  const base = buildChildEnv(parent, GENERATOR_ENV_ALLOW.filter((n) => n !== 'HOME'));
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(base)) {
    if (!CODEX_ENV_DENY.includes(name) && !DENY_SUFFIX.test(name)) env[name] = value;
  }
  env.HOME = config.userHome;
  env.CODEX_HOME = config.codexHome;
  return Object.freeze(env);
}

// --- config-home and version checks ----------------------------------------------------------------------------

/**
 * Top-level entries of `codexHome` that fail the run closed: each would inject instructions, tools or policy
 * (`config.toml` is also ignored by `--ignore-user-config`; `rules` by `--ignore-rules`).
 */
export const CODEX_HOME_FORBIDDEN: readonly string[] = Object.freeze([
  'config.toml',
  'AGENTS.md',
  'AGENTS.override.md',
  'rules',
  'hooks.json',
  'hooks',
  'plugins',
  'prompts',
  'agents',
  'mcp.json',
]);

/** Names only (auth.json is never opened). `skills/` may hold only the bundled `.system` directory. */
export function checkCodexHome(codexHome: string): DomainResult<readonly string[]> {
  let names: string[];
  try {
    names = fs.readdirSync(codexHome).sort();
  } catch {
    return DomainResult.fail([err('GEN_CODEX_HOME_UNREADABLE', 'codexHome cannot be listed')]);
  }
  const problems = names.filter((n) => CODEX_HOME_FORBIDDEN.includes(n));
  const skills = path.join(codexHome, 'skills');
  if (names.includes('skills')) {
    for (const s of listNames(skills)) if (s !== '.system') problems.push(`skills/${s}`);
  }
  if (problems.length > 0) {
    return DomainResult.fail([err('GEN_CODEX_HOME_FORBIDDEN', 'codexHome holds entries that would inject instructions, tools or policy', { entries: problems })]);
  }
  return DomainResult.ok(names);
}

/** `codex --version` prints `codex-cli <x.y.z>`. */
export function parseCodexVersion(stdout: string): string | null {
  const m = /codex-cli\s+(\d+\.\d+\.\d+)/.exec(stdout);
  return m?.[1] ?? null;
}
