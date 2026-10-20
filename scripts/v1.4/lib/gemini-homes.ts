/**
 * The two Gemini generator homes (decision CDX; `Docs/v1.4/gemini-generator.md`, "Before it may run live" item 2):
 * create them (`--create`) and validate them. NO sign-in is performed and NO credential file is opened: sign-in stays
 * the author's manual step (the labeller's pty relay). Names only are reported; the script writes nothing into the
 * repository.
 *
 * Checks per home: an absolute path, not the other home, not the labeller home (nor inside it or around it), outside
 * the repository, outside `--out-root` and `--harness-root` when given, mode 700, outside every git repository, and the
 * generator home check `checkAgyGenHome` (no rule, skill, plugin, agent, workflow or hook entry; conforming settings;
 * no MCP server in the `none` home; U12: the confinement hook installed). `--create` makes a missing home with mode 700
 * and writes the harness-owned baseline settings (strict, terminal sandbox, the arm's deny list, an empty allow list;
 * every turn rewrites them); in every home, new or existing, it (re)installs the harness-owned hook files: hooks.json,
 * the committed hook script and the baseline turn config (no work directory, so the hook blocks every call until a
 * turn writes its own), and resets the harness-owned settings keys to the baseline (other keys are kept). It touches no
 * other file of an existing home.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { AGY_HOME_DEFAULT, expandHome } from '../../../src/llm-critic/agy-cli-provider.js';
import {
  AGY_GEN_REQUIRED_SETTINGS,
  AGY_GEN_SETTINGS_REL,
  agyHookSourcePath,
  baselineHookConfig,
  checkAgyGenHome,
  expectedDeny,
  installAgyHook,
} from '../../lib/generators/agy-gen-cli.js';
import type { AgyGenArm } from '../../lib/generators/agy-gen-cli.js';
import { isInsideOrEqual } from '../../lib/generators/config.js';

export interface HomesInput {
  readonly homes: Readonly<Record<AgyGenArm, string>>;
  readonly repoRoot: string;
  readonly create: boolean;
  readonly allowCommand?: boolean;
  readonly outRoot?: string;
  readonly harnessRoot?: string;
  /** The labeller home (default `~/.firewall/labeller-agy-home`). */
  readonly labellerHome?: string;
}

export interface HomeReport {
  readonly arm: AgyGenArm;
  readonly created: boolean;
  /** `--create` (re)installed the hook files. */
  readonly hookInstalled: boolean;
  readonly problems: readonly string[];
  /** A name that looks like a credential file exists (names only; never opened). Sign-in is not checked further. */
  readonly credentialNamesPresent: boolean;
  readonly listingSha256: string | null;
}

export interface HomesReport {
  readonly schema: 'gemini-homes/v1';
  readonly ok: boolean;
  readonly homes: readonly HomeReport[];
  readonly note: string;
}

const CREDENTIAL_NAME = /oauth|credential|token|auth|secret|cookie/i;

function hasCredentialName(dir: string): boolean {
  const walk = (d: string, depth: number): boolean => {
    if (depth > 6 || !fs.existsSync(d)) return false;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (CREDENTIAL_NAME.test(e.name)) return true;
      if (e.isDirectory() && !e.isSymbolicLink() && walk(path.join(d, e.name), depth + 1)) return true;
    }
    return false;
  };
  return walk(dir, 0);
}

/** The baseline settings of a fresh generator home (every turn replaces the allow list with its own). */
export function baselineSettings(arm: AgyGenArm, allowCommand = true): Record<string, unknown> {
  return { ...AGY_GEN_REQUIRED_SETTINGS, permissions: { allow: [], deny: [...expectedDeny(arm, allowCommand)], ask: [] } };
}

/** Rewrites the harness-owned keys of an existing home's settings (required keys, the baseline permissions). */
function refreshBaselinePermissions(home: string, arm: AgyGenArm, allowCommand: boolean): void {
  const file = path.join(home, AGY_GEN_SETTINGS_REL);
  let current: Record<string, unknown> = {};
  if (fs.existsSync(file)) {
    try {
      const v: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) current = v as Record<string, unknown>;
    } catch {
      current = {};
    }
  }
  const next: Record<string, unknown> = { ...current, ...baselineSettings(arm, allowCommand) };
  delete next.allowNonWorkspaceAccess;
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
}

/** Creates (when asked) and validates both homes. */
export function setupGeminiHomes(i: HomesInput): HomesReport {
  const labeller = path.resolve(i.labellerHome ?? expandHome(AGY_HOME_DEFAULT, os.homedir()));
  const allowCommand = i.allowCommand ?? true;
  const hookSource = agyHookSourcePath(i.repoRoot);
  const reports: HomeReport[] = [];
  for (const arm of ['none', 'daedalus-mcp'] as const) {
    const home = i.homes[arm];
    const problems: string[] = [];
    let created = false;
    let hookInstalled = false;
    if (!path.isAbsolute(home)) {
      reports.push({ arm, created, hookInstalled, problems: ['the home must be an absolute path'], credentialNamesPresent: false, listingSha256: null });
      continue;
    }
    const other = i.homes[arm === 'none' ? 'daedalus-mcp' : 'none'];
    if (path.isAbsolute(other) && (isInsideOrEqual(other, home) || isInsideOrEqual(home, other))) problems.push('the two homes must be separate (neither inside the other)');
    if (isInsideOrEqual(labeller, home) || isInsideOrEqual(home, labeller)) problems.push('a generator home must not be, contain or lie inside the labeller home');
    if (isInsideOrEqual(i.repoRoot, home)) problems.push('the home must lie outside the repository');
    if (i.outRoot !== undefined && isInsideOrEqual(i.outRoot, home)) problems.push('the home must lie outside the out-root');
    if (i.harnessRoot !== undefined && isInsideOrEqual(i.harnessRoot, home)) problems.push('the home must lie outside the harness root');
    if (problems.length === 0 && i.create && !fs.existsSync(home)) {
      fs.mkdirSync(home, { recursive: true, mode: 0o700 });
      fs.chmodSync(home, 0o700);
      const settings = path.join(home, AGY_GEN_SETTINGS_REL);
      fs.mkdirSync(path.dirname(settings), { recursive: true, mode: 0o700 });
      fs.writeFileSync(settings, `${JSON.stringify(baselineSettings(arm, allowCommand), null, 2)}\n`, { mode: 0o600 });
      created = true;
    }
    if (problems.length === 0 && i.create && fs.existsSync(home)) {
      // U12: an existing home's settings get the corrected baseline rules (the turn rewrites them anyway); other keys
      // of the file, which agy itself re-saves, are kept.
      refreshBaselinePermissions(home, arm, allowCommand);
      const installed = installAgyHook(home, hookSource, baselineHookConfig(arm, allowCommand));
      if (installed.success) hookInstalled = true;
      else problems.push(...installed.errors.map((e) => e.message));
    }
    if (problems.length > 0) {
      reports.push({ arm, created, hookInstalled, problems, credentialNamesPresent: false, listingSha256: null });
      continue;
    }
    const check = checkAgyGenHome(home, arm, null, allowCommand, hookSource);
    problems.push(...check.problems);
    reports.push({ arm, created, hookInstalled, problems, credentialNamesPresent: fs.existsSync(home) && hasCredentialName(home), listingSha256: fs.existsSync(home) ? check.listingSha256 : null });
  }
  return {
    schema: 'gemini-homes/v1',
    ok: reports.every((r) => r.problems.length === 0),
    homes: reports,
    note: 'No sign-in was performed and no credential file was opened. Sign each home in by hand (the labeller pty relay), then run this check again.',
  };
}

export const GEMINI_HOMES_USAGE =
  'usage: npx tsx scripts/v1.4/gemini-homes.ts [--create] --home-none <abs> --home-mcp <abs>\n' +
  '       [--out-root <abs>] [--harness-root <abs>] [--labeller-home <abs>] [--no-command]\n';

/** `{ [key]: expanded path }` when the flag was given, else `{}`. */
function homeFlag<K extends string>(flags: ReadonlyMap<string, string>, flag: string, key: K): Partial<Record<K, string>> {
  const v = flags.get(flag);
  return v === undefined ? {} : ({ [key]: expandHome(v) } as Record<K, string>);
}

/** `main`: exit 0 both homes valid, 1 a problem, 2 usage. */
export function geminiHomesMain(argv: readonly string[], repoRoot: string, out: (t: string) => void, err: (t: string) => void): number {
  const flags = new Map<string, string>();
  let create = false;
  let allowCommand = true;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? '';
    if (a === '--create') {
      create = true;
      continue;
    }
    if (a === '--no-command') {
      allowCommand = false;
      continue;
    }
    const v = argv[i + 1];
    if (['--home-none', '--home-mcp', '--out-root', '--harness-root', '--labeller-home'].includes(a) && v !== undefined && !v.startsWith('--')) {
      flags.set(a, v);
      i++;
      continue;
    }
    err(GEMINI_HOMES_USAGE);
    return 2;
  }
  const none = flags.get('--home-none');
  const mcp = flags.get('--home-mcp');
  if (none === undefined || mcp === undefined) {
    err(GEMINI_HOMES_USAGE);
    return 2;
  }
  const report = setupGeminiHomes({
    homes: { none: expandHome(none), 'daedalus-mcp': expandHome(mcp) },
    repoRoot,
    create,
    allowCommand,
    ...homeFlag(flags, '--out-root', 'outRoot'),
    ...homeFlag(flags, '--harness-root', 'harnessRoot'),
    ...homeFlag(flags, '--labeller-home', 'labellerHome'),
  });
  out(`${JSON.stringify(report, null, 2)}\n`);
  return report.ok ? 0 : 1;
}
