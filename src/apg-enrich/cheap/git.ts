/**
 * Batch 2: read-only git access for the co-change and agent-provenance proxies. Synchronous `spawnSync` with argument
 * arrays (no shell), no system or global configuration, `LC_ALL=C`. Every call returns `null` on failure (no git
 * binary, not a repository, unknown commit) so a caller can skip cleanly.
 */
import { spawnSync } from 'node:child_process';

function env(): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const k of ['PATH', 'HOME', 'TMPDIR']) {
    const v = process.env[k];
    if (v !== undefined) out[k] = v;
  }
  return { ...out, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' };
}

/** Runs git; `gitArgs` come before the subcommand (`--git-dir=…`, `-C dir`). */
export function git(gitArgs: readonly string[], args: readonly string[], input?: Buffer): string | null {
  const r = spawnSync('git', [...gitArgs, ...args], { env: env(), encoding: 'buffer', timeout: 120_000, maxBuffer: 256 * 1024 * 1024, ...(input !== undefined ? { input } : {}) });
  if (r.error !== undefined || r.status !== 0) return null;
  return r.stdout.toString('utf8');
}

/** Same as `git`, returning the raw bytes (for `archive`). */
export function gitBytes(gitArgs: readonly string[], args: readonly string[]): Buffer | null {
  const r = spawnSync('git', [...gitArgs, ...args], { env: env(), encoding: 'buffer', timeout: 120_000, maxBuffer: 512 * 1024 * 1024 });
  if (r.error !== undefined || r.status !== 0) return null;
  return r.stdout;
}

export interface CommitFiles {
  readonly sha: string;
  /** Changed paths relative to the history root (`pathPrefix` stripped). */
  readonly files: readonly string[];
}

/**
 * Non-merge commits, oldest first, with the paths each changed under `pathPrefix` (repository-relative, POSIX, '' for
 * the whole repository); renames are not followed. Null when `dir` is not in a git work tree.
 */
export function commitFileSets(gitArgs: readonly string[], pathPrefix: string): CommitFiles[] | null {
  const spec = pathPrefix === '' ? [] : ['--', pathPrefix];
  const out = git(gitArgs, ['log', '--reverse', '--no-merges', '--no-renames', '--name-only', '--format=@@%H', ...spec]);
  if (out === null) return null;
  const commits: CommitFiles[] = [];
  let cur: { sha: string; files: string[] } | undefined;
  for (const line of out.split('\n')) {
    if (line.startsWith('@@')) {
      if (cur !== undefined) commits.push(cur);
      cur = { sha: line.slice(2), files: [] };
    } else if (line.trim() !== '' && cur !== undefined) {
      const f = pathPrefix === '' ? line : line.startsWith(`${pathPrefix}/`) ? line.slice(pathPrefix.length + 1) : null;
      if (f !== null) cur.files.push(f);
    }
  }
  if (cur !== undefined) commits.push(cur);
  return commits;
}
