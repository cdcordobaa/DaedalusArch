/**
 * Claude generator isolation and version pin of the loop (gate S2, S3; TV-95; `Docs/v1.3/loop-isolation.md`).
 *
 * OFF by default: a plan without `adapters[].cliVersion` and `generatorIsolation` runs with the E1 environment as
 * before. With the isolation block, every Claude spawn of the loop (version probe, step turn, repair turn) runs with
 * the E1 allow-listed environment plus `HOME` = a per-run empty directory under `<H>`, `CLAUDE_CONFIG_DIR` = the
 * dedicated, logged-in config dir of the plan, and the judge's auto-update switch. Before every spawn the config dir
 * passes the judge's ADR-018 listing check (names only, never contents) and the run `HOME` holds no Claude config;
 * either failure stops the turn before the CLI runs (`LOOP_ISOLATION`). The judge's allow-list is reused unchanged.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { DomainError } from '../../../src/shared/errors/domain-result.js';
import { checkConfigListing, parseCliVersion } from '../../../src/llm-critic/claude-cli-provider.js';
import { JUDGE_ENV_SET } from '../../../src/llm-critic/frozen.js';
import { canonicalPath, isInsideOrEqual } from '../generators/config.js';
import { buildGeneratorChildEnv } from '../generators/env.js';

export { parseCliVersion };

/** The isolation of the Claude adapter (the plan's `generatorIsolation` block, local paths filled). */
export interface ClaudeIsolation {
  /** `CLAUDE_CONFIG_DIR`: dedicated, logged in once by the author; absolute, outside the repository and `outRoot`. */
  readonly configDir: string;
}

/** Names that must not appear at the top of an isolated `HOME`: each would load ambient Claude configuration. */
export const ISOLATED_HOME_FORBIDDEN: readonly string[] = Object.freeze(['.claude', '.claude.json', 'CLAUDE.md']);

/** The variables an isolated spawn sets on top of the E1 allow-listed environment. */
export const ISOLATION_ENV_NAMES: readonly string[] = Object.freeze(['HOME', 'CLAUDE_CONFIG_DIR', ...Object.keys(JUDGE_ENV_SET)]);

function err(code: string, message: string, context?: Record<string, unknown>): DomainError {
  return context === undefined ? { code, message } : { code, message, context };
}

/** `<H>/runs/<runId>/home`: the per-run `HOME` of every turn of a run. */
export function runHomeOf(harnessRoot: string, runId: string): string {
  return path.join(harnessRoot, 'runs', ...runId.split('/'), 'home');
}

/** `<H>/probe-home`: the `HOME` of the pre-run version probe. */
export function probeHomeOf(harnessRoot: string): string {
  return path.join(harnessRoot, 'probe-home');
}

/** The E1 allow-listed environment with `HOME`, `CLAUDE_CONFIG_DIR` and the auto-update switch set. */
export function isolatedClaudeEnv(parent: NodeJS.ProcessEnv, home: string, isolation: ClaudeIsolation): Readonly<Record<string, string>> {
  return Object.freeze({ ...buildGeneratorChildEnv(parent), HOME: home, CLAUDE_CONFIG_DIR: isolation.configDir, ...JUDGE_ENV_SET });
}

/** Where the isolation paths may live: absolute; outside the repository, `outRoot` and the real `~/.claude`. */
export function checkIsolationPaths(
  isolation: ClaudeIsolation,
  where: { readonly repoRoot: string; readonly outRoot: string; readonly harnessRoot: string; readonly realHome: string },
): readonly DomainError[] {
  const dir = isolation.configDir;
  if (!path.isAbsolute(dir)) return [err('LOOP_ISOLATION', 'generatorIsolation.claudeConfigDir must be an absolute path')];
  const errors: DomainError[] = [];
  if (isInsideOrEqual(where.repoRoot, dir)) errors.push(err('LOOP_ISOLATION', 'claudeConfigDir must lie outside the repository'));
  if (isInsideOrEqual(where.outRoot, dir)) errors.push(err('LOOP_ISOLATION', 'claudeConfigDir must not lie inside outRoot (every cwd is under it)'));
  if (isInsideOrEqual(path.join(where.harnessRoot, 'runs'), dir)) errors.push(err('LOOP_ISOLATION', 'claudeConfigDir must not lie inside <H>/runs'));
  const ambient = path.join(where.realHome, '.claude');
  if (isInsideOrEqual(ambient, dir) || canonicalPath(dir) === canonicalPath(where.realHome)) {
    errors.push(err('LOOP_ISOLATION', 'claudeConfigDir must not be the real ~/.claude or the real HOME'));
  }
  return errors;
}

/**
 * Before every isolated spawn: the `HOME` exists (created empty, 0700) and holds none of `ISOLATED_HOME_FORBIDDEN`;
 * the config dir passes the ADR-018 listing check. Returns the listing sha256 (names only).
 */
export function checkIsolationBeforeSpawn(home: string, isolation: ClaudeIsolation): DomainResult<{ readonly configListingSha256: string }> {
  try {
    fs.mkdirSync(home, { recursive: true, mode: 0o700 });
  } catch {
    return DomainResult.fail([err('LOOP_ISOLATION', 'the isolated HOME cannot be created')]);
  }
  const ambient = fs.readdirSync(home).filter((n) => ISOLATED_HOME_FORBIDDEN.includes(n)).sort();
  if (ambient.length > 0) return DomainResult.fail([err('LOOP_ISOLATION', 'the isolated HOME holds Claude configuration', { entries: ambient })]);
  const listing = checkConfigListing(isolation.configDir);
  if (!listing.pass) {
    return DomainResult.fail([err('LOOP_ISOLATION', 'the generator config dir fails the ADR-018 listing check', { failures: listing.failures })]);
  }
  return DomainResult.ok({ configListingSha256: listing.configListingSha256 });
}

/** `env-<turnId>.json` of an isolated turn: variable names, the isolation values, the CLI version, the listing hash. */
export interface TurnEnvRecord {
  readonly schema: 'loop-turn-env/v1';
  readonly envNames: readonly string[];
  readonly set: Readonly<Record<string, string>>;
  readonly cliVersion: string | null;
  readonly configListingSha256: string;
}

export function turnEnvRecord(env: Readonly<Record<string, string>>, cliVersion: string | null, configListingSha256: string): TurnEnvRecord {
  const set: Record<string, string> = {};
  for (const name of ISOLATION_ENV_NAMES) {
    const v = env[name];
    if (v !== undefined) set[name] = v;
  }
  return { schema: 'loop-turn-env/v1', envNames: Object.keys(env).sort(), set, cliVersion, configListingSha256 };
}
