/**
 * EFF-01 repo trees (design DR-14 to DR-16). Every process call goes through the `ProcessRunner`, so tests mock git.
 *
 * The export is two runner calls, never a pipe: `git -C <clone> archive --format=tar -o <dest>.tar <sha>`, then
 * `tar -xf <dest>.tar -C <dest>`. The runner has no shell and returns stdout as capped text, so a tar stream on stdout
 * would be corrupted; no stdout is used as data.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { DomainError } from '../../../../src/shared/errors/domain-result.js';
import type { ProcessRunner } from '../../../../src/shared/interfaces/process-runner.js';

export const GIT_TIMEOUT_MS = 120_000;

function err(code: string, message: string, context?: Record<string, unknown>): DomainError {
  return context === undefined ? { code, message } : { code, message, context };
}

/** DR-14: `git -C <clone> rev-parse HEAD` must equal the pin. */
export async function checkPin(runner: ProcessRunner, clone: string, sha: string, env: Readonly<Record<string, string>>): Promise<DomainResult<void>> {
  const r = await runner.run('git', ['-C', clone, 'rev-parse', 'HEAD'], { env, timeoutMs: GIT_TIMEOUT_MS });
  if (!r.success) return DomainResult.fail(r.errors);
  if (r.data.exitCode !== 0) return DomainResult.fail([err('EFF01_PIN', `git rev-parse failed in ${path.basename(clone)} (exit ${String(r.data.exitCode)})`)]);
  const head = r.data.stdout.trim();
  if (head !== sha) return DomainResult.fail([err('EFF01_PIN', `${path.basename(clone)} HEAD is ${head}, the pin is ${sha}`, { head, pin: sha })]);
  return DomainResult.ok(undefined);
}

/** DR-15: exports the tracked files at `sha` into an empty or missing `dest`, through a tar file on disk. */
export async function exportTree(runner: ProcessRunner, clone: string, sha: string, dest: string, env: Readonly<Record<string, string>>): Promise<DomainResult<void>> {
  if (fs.existsSync(dest) && fs.readdirSync(dest).length > 0) return DomainResult.fail([err('EFF01_TREE', `tree destination ${path.basename(dest)} is not empty`)]);
  fs.mkdirSync(dest, { recursive: true });
  const tarFile = `${dest}.tar`;
  const a = await runner.run('git', ['-C', clone, 'archive', '--format=tar', '-o', tarFile, sha], { env, timeoutMs: GIT_TIMEOUT_MS });
  if (!a.success) return DomainResult.fail(a.errors);
  if (a.data.exitCode !== 0) return DomainResult.fail([err('EFF01_TREE', `git archive failed (exit ${String(a.data.exitCode)})`)]);
  const x = await runner.run('tar', ['-xf', tarFile, '-C', dest], { env, timeoutMs: GIT_TIMEOUT_MS });
  fs.rmSync(tarFile, { force: true });
  if (!x.success) return DomainResult.fail(x.errors);
  if (x.data.exitCode !== 0) return DomainResult.fail([err('EFF01_TREE', `tar -xf failed (exit ${String(x.data.exitCode)})`)]);
  return DomainResult.ok(undefined);
}

function listFiles(root: string, rel: string, out: string[]): void {
  const abs = rel === '' ? root : path.join(root, ...rel.split('/'));
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const r = rel === '' ? e.name : `${rel}/${e.name}`;
    if (e.isDirectory()) listFiles(root, r, out);
    else if (e.isFile() || e.isSymbolicLink()) out.push(r);
  }
}

/** DR-15: SHA-256 over the sorted `path\0sha256(content)` lines, dotfiles included, links not followed. */
export function treeFingerprint(dir: string): string {
  const files: string[] = [];
  listFiles(dir, '', files);
  files.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const h = createHash('sha256');
  for (const f of files) {
    const abs = path.join(dir, ...f.split('/'));
    const st = fs.lstatSync(abs);
    const content = st.isSymbolicLink() ? Buffer.from(`link:${fs.readlinkSync(abs)}`) : fs.readFileSync(abs);
    h.update(`${f}\0${createHash('sha256').update(content).digest('hex')}\n`);
  }
  return h.digest('hex');
}
