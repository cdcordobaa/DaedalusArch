/**
 * Git access of the diff-aware gate: resolve a ref, write a commit's tree to a directory, list renames between two
 * commits. `git` runs as a child process without a shell; a ref that starts with `-` is refused, so it can
 * never be read as an option.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export class GitError extends Error {}

function git(repo: string, args: readonly string[], maxBuffer = 64 * 1024 * 1024): Buffer {
  const r = spawnSync('git', ['-C', repo, ...args], { maxBuffer });
  if (r.error !== undefined) throw new GitError(`git ${args[0] ?? ''}: ${r.error.message}`);
  if (r.status !== 0) throw new GitError(`git ${args[0] ?? ''} failed: ${r.stderr.toString('utf8').trim()}`);
  return r.stdout;
}

function checkRef(ref: string): void {
  if (ref === '' || ref.startsWith('-')) throw new GitError(`invalid ref ${JSON.stringify(ref)}`);
}

/** The commit SHA of `ref`. */
export function resolveCommit(repo: string, ref: string): string {
  checkRef(ref);
  return git(repo, ['rev-parse', '--verify', '--quiet', '--end-of-options', `${ref}^{commit}`]).toString('utf8').trim();
}

/**
 * Writes the tree of commit `sha` (a resolved SHA) to `dir`, which must exist. Through a temporary index
 * (`read-tree` + `checkout-index`), not `git archive`, so `export-ignore` attributes cannot drop sources; the
 * repository's own index and work tree are not touched.
 */
export function exportTree(repo: string, sha: string, dir: string): void {
  checkRef(sha);
  const index = `${path.resolve(dir)}.index`;
  const env = { ...process.env, GIT_INDEX_FILE: index };
  for (const args of [['read-tree', sha], ['checkout-index', '--all', '--force', `--prefix=${path.resolve(dir)}/`]]) {
    const r = spawnSync('git', ['-C', repo, ...args], { env, maxBuffer: 16 * 1024 * 1024 });
    if (r.error !== undefined) throw new GitError(`git ${args[0] ?? ''}: ${r.error.message}`);
    if (r.status !== 0) throw new GitError(`git ${args[0] ?? ''} failed: ${r.stderr.toString('utf8').trim()}`);
  }
  fs.rmSync(index, { force: true });
}

/**
 * Renames between two commits, as paths relative to `project` (a repository-relative directory, `.` for the root).
 * Renames into or out of the project are left out.
 */
export function listRenames(repo: string, baseSha: string, headSha: string, project: string): Record<string, string> {
  checkRef(baseSha);
  checkRef(headSha);
  const out = git(repo, ['diff', '--name-status', '-M', '-z', baseSha, headSha]).toString('utf8');
  return parseRenames(out, project);
}

/** Parses `git diff --name-status -M -z` output. Pure. */
export function parseRenames(nameStatusZ: string, project: string): Record<string, string> {
  const prefix = project === '.' || project === '' ? '' : `${path.posix.normalize(project.replace(/\\/g, '/')).replace(/\/+$/, '')}/`;
  const fields = nameStatusZ.split('\0');
  const renames: Record<string, string> = {};
  for (let i = 0; i < fields.length; ) {
    const status = fields[i] ?? '';
    if (status === '') {
      i += 1;
      continue;
    }
    if (status.startsWith('R') || status.startsWith('C')) {
      const from = fields[i + 1] ?? '';
      const to = fields[i + 2] ?? '';
      i += 3;
      if (status.startsWith('R') && from.startsWith(prefix) && to.startsWith(prefix)) {
        renames[from.slice(prefix.length)] = to.slice(prefix.length);
      }
    } else i += 2;
  }
  return renames;
}
