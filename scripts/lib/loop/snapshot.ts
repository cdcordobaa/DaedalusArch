/**
 * Per-step snapshots of a loop run's work directory.
 *
 * The git store lives OUTSIDE the work directory (`<runDir>/snapshots.git`, used with `--git-dir` and `--work-tree`),
 * so the agent never sees a `.git` entry, the E1 file counts are unchanged and the history cannot be edited from the
 * agent's cwd. `node_modules` (the read-only skeleton symlink) is excluded through `info/exclude`; `package.json` is
 * tracked, so a restore also puts back a skeleton manifest the agent changed. Files a `.gitignore` written by the
 * agent would hide are still snapshotted (`add --force`) and still removed by a restore (`clean -x`).
 *
 * Calls are synchronous (`spawnSync`, argument arrays, no shell) because the retry hooks of `runWithRetries` are
 * synchronous. Git runs with no system or global configuration and a fixed identity, so a snapshot commit depends only
 * on the tree, the message and the commit time.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';

export const SNAPSHOT_GIT_DIR = 'snapshots.git';

const GIT_TIMEOUT_MS = 120_000;
const IDENTITY = ['-c', 'user.name=loop-harness', '-c', 'user.email=loop-harness@localhost', '-c', 'commit.gpgsign=false'];

export interface DiffCounts {
  readonly added: number;
  readonly modified: number;
  readonly deleted: number;
}

function gitEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const k of ['PATH', 'HOME', 'LANG', 'TMPDIR']) {
    const v = process.env[k];
    if (v !== undefined) env[k] = v;
  }
  return { ...env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' };
}

export class WorkTreeSnapshots {
  constructor(
    readonly gitDir: string,
    readonly workTree: string,
  ) {}

  private git(args: readonly string[]): DomainResult<string> {
    const r = spawnSync('git', [...IDENTITY, `--git-dir=${this.gitDir}`, `--work-tree=${this.workTree}`, ...args], {
      cwd: this.workTree,
      env: gitEnv(),
      encoding: 'utf8',
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: 64 * 1024 * 1024,
    });
    if (r.error !== undefined || r.status !== 0) {
      const detail = r.error !== undefined ? r.error.message : r.stderr.trim().split('\n').slice(-3).join(' | ');
      return DomainResult.fail([{ code: 'LOOP_SNAPSHOT_GIT', message: `git ${args[0] ?? ''} failed: ${detail}` }]);
    }
    return DomainResult.ok(r.stdout);
  }

  /** True when the store already exists (a resumed run). */
  exists(): boolean {
    return fs.existsSync(path.join(this.gitDir, 'HEAD'));
  }

  /** Creates the store and excludes the skeleton symlink. */
  init(): DomainResult<void> {
    fs.mkdirSync(this.gitDir, { recursive: true });
    const r = spawnSync('git', ['init', '--quiet', '--bare', this.gitDir], { env: gitEnv(), encoding: 'utf8', timeout: GIT_TIMEOUT_MS });
    if (r.error !== undefined || r.status !== 0) {
      return DomainResult.fail([{ code: 'LOOP_SNAPSHOT_GIT', message: `git init failed: ${r.error?.message ?? r.stderr.trim()}` }]);
    }
    const bare = this.git(['config', 'core.bare', 'false']);
    if (!bare.success) return DomainResult.fail(bare.errors);
    fs.mkdirSync(path.join(this.gitDir, 'info'), { recursive: true });
    fs.writeFileSync(path.join(this.gitDir, 'info', 'exclude'), '/node_modules\n');
    return DomainResult.ok(undefined);
  }

  /** Commits the whole tree (an unchanged tree still gets a commit) and returns its sha. */
  commit(message: string): DomainResult<string> {
    const add = this.git(['add', '--all', '--force', '--', '.', ':(exclude)node_modules']);
    if (!add.success) return DomainResult.fail(add.errors);
    const c = this.git(['commit', '--quiet', '--allow-empty', '--no-verify', '-m', message]);
    if (!c.success) return DomainResult.fail(c.errors);
    return this.head();
  }

  head(): DomainResult<string> {
    const r = this.git(['rev-parse', 'HEAD']);
    return r.success ? DomainResult.ok(r.data.trim()) : DomainResult.fail(r.errors);
  }

  /** Puts the work tree back to `commit`: tracked files reset, untracked files removed (`node_modules` kept). */
  restore(commit: string): DomainResult<void> {
    const reset = this.git(['reset', '--quiet', '--hard', commit]);
    if (!reset.success) return DomainResult.fail(reset.errors);
    const clean = this.git(['clean', '-fdxq', '-e', '/node_modules']);
    if (!clean.success) return DomainResult.fail(clean.errors);
    return DomainResult.ok(undefined);
  }

  /** Paths changed in the work tree since HEAD (untracked included, `node_modules` excluded). */
  changedCount(): number {
    const r = this.git(['status', '--porcelain', '--untracked-files=all', '--ignored=matching']);
    if (!r.success) return 0;
    return r.data.split('\n').filter((l) => l.trim() !== '' && !/^!! node_modules\/?$/.test(l)).length;
  }

  /** Added, modified and deleted files between two commits. */
  diff(from: string, to: string): DomainResult<DiffCounts> {
    const r = this.git(['diff', '--name-status', '--no-renames', from, to]);
    if (!r.success) return DomainResult.fail(r.errors);
    let added = 0;
    let modified = 0;
    let deleted = 0;
    for (const line of r.data.split('\n')) {
      const s = line.charAt(0);
      if (s === 'A') added++;
      else if (s === 'D') deleted++;
      else if (s !== '') modified++;
    }
    return DomainResult.ok({ added, modified, deleted });
  }

  /** Tracked files of a commit, sorted. */
  files(commit: string): DomainResult<readonly string[]> {
    const r = this.git(['ls-tree', '-r', '--name-only', commit]);
    return r.success ? DomainResult.ok(r.data.split('\n').filter((l) => l !== '').sort()) : DomainResult.fail(r.errors);
  }

  /** Commit subjects from the root to HEAD. */
  log(): DomainResult<readonly string[]> {
    const r = this.git(['log', '--reverse', '--format=%s']);
    return r.success ? DomainResult.ok(r.data.split('\n').filter((l) => l !== '')) : DomainResult.fail(r.errors);
  }
}
