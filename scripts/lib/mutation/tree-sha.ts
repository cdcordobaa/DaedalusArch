/**
 * `baseTreeSha` of a prepared copy (FR-v1.2E-24; Q9; BR-U5a-33).
 *
 * A git tree sha over the copy's source files (tsconfig `include`, never `node_modules`), overlay targets and
 * provisioned stub files, POSIX paths relative to the copy root. Each call uses a **throwaway object store**:
 * `fs.mkdtemp` under `os.tmpdir()` → `git init --bare --quiet <tmp>/objects.git`; every git call goes through
 * `ProcessRunner` with an explicit environment (`PATH`, `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`,
 * `GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=/dev/null`, `GIT_OPTIONAL_LOCKS=0`; nothing inherited from the
 * parent's `GIT_*`) and the same `--git-dir` / `--work-tree` flags; `git add -f -- <files>` (so a `.gitignore` in
 * the copy cannot drop a stub), then `git write-tree`. The temporary directory is removed in `finally`. No object
 * is written to any repository the copy might sit in.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { ProcessRunner } from '../../../src/shared/interfaces/process-runner.js';
import { readTsconfig } from './stubs.js';
import type { PreparedBase, ProvisionedStub } from './types.js';

const GIT_TIMEOUT_MS = 120_000;
/** Paths per `git add` call (keeps argv well under platform limits). */
const ADD_CHUNK = 200;

export interface TreeShaOptions {
  /** Parent of the throwaway store (default `os.tmpdir()`). */
  readonly tmpRoot?: string;
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function listFilesUnder(root: string, rel: string): string[] {
  const abs = path.join(root, ...rel.split('/'));
  if (!fs.existsSync(abs)) return [];
  if (!fs.statSync(abs).isDirectory()) return [rel];
  const out: string[] = [];
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    out.push(...listFilesUnder(root, `${rel}/${e.name}`));
  }
  return out;
}

/**
 * The files `baseTreeSha` covers: tsconfig root files outside `node_modules`, overlay targets and every file under
 * each stub directory; POSIX, relative to `copyRoot`, sorted, unique.
 */
export function treeShaFiles(
  copyRoot: string,
  tsconfigRel: string,
  overlays: PreparedBase['overlays'],
  stubs: readonly ProvisionedStub[],
): DomainResult<readonly string[]> {
  const cfg = readTsconfig(copyRoot, tsconfigRel);
  if (!cfg.success) return cfg;
  const files = new Set<string>();
  for (const abs of cfg.data.fileNames) {
    const rel = path.relative(copyRoot, abs).split(path.sep).join('/');
    if (rel.startsWith('../') || rel.split('/').includes('node_modules')) continue;
    files.add(rel);
  }
  for (const o of overlays) files.add(o.path);
  for (const s of stubs) for (const f of listFilesUnder(copyRoot, s.path)) files.add(f);
  return DomainResult.ok([...files].sort(cmp));
}

function gitEnv(extra: Record<string, string>): Record<string, string> {
  return {
    ...(process.env.PATH !== undefined ? { PATH: process.env.PATH } : {}),
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_OPTIONAL_LOCKS: '0',
    ...extra,
  };
}

function gitFailure<T>(step: string, detail: string): DomainResult<T> {
  return DomainResult.fail([{ code: 'MUT_TREE_SHA', message: `git ${step} failed: ${detail.trim().slice(0, 500)}` }]);
}

/** Tree sha of `files` (POSIX, relative to `copyRoot`) through a throwaway object store. */
export async function computeTreeSha(
  runner: ProcessRunner,
  copyRoot: string,
  files: readonly string[],
  options: TreeShaOptions = {},
): Promise<DomainResult<string>> {
  const root = path.resolve(copyRoot);
  const tmp = await fs.promises.mkdtemp(path.join(options.tmpRoot ?? os.tmpdir(), 'u5a-tree-'));
  try {
    const gitDir = path.join(tmp, 'objects.git');
    const init = await runner.run('git', ['init', '--bare', '--quiet', gitDir], { cwd: tmp, env: gitEnv({}), timeoutMs: GIT_TIMEOUT_MS });
    if (!init.success) return init;
    if (init.data.exitCode !== 0) return gitFailure('init', init.data.stderr);
    const env = gitEnv({ GIT_DIR: gitDir, GIT_WORK_TREE: root, GIT_INDEX_FILE: path.join(tmp, 'index') });
    const flags = [`--git-dir=${gitDir}`, `--work-tree=${root}`];
    for (let i = 0; i < files.length; i += ADD_CHUNK) {
      const chunk = files.slice(i, i + ADD_CHUNK);
      const add = await runner.run('git', [...flags, 'add', '-f', '--', ...chunk], { cwd: root, env, timeoutMs: GIT_TIMEOUT_MS });
      if (!add.success) return add;
      if (add.data.exitCode !== 0) return gitFailure('add', add.data.stderr);
    }
    const tree = await runner.run('git', [...flags, 'write-tree'], { cwd: root, env, timeoutMs: GIT_TIMEOUT_MS });
    if (!tree.success) return tree;
    const sha = tree.data.stdout.trim();
    if (tree.data.exitCode !== 0 || !/^[0-9a-f]{40}$/.test(sha)) return gitFailure('write-tree', tree.data.stderr);
    return DomainResult.ok(sha);
  } finally {
    await fs.promises.rm(tmp, { recursive: true, force: true });
  }
}

/** `baseTreeSha` of a prepared copy of `base` with its provisioned stubs (BR-U5a-33). */
export async function computeBaseTreeSha(
  runner: ProcessRunner,
  base: PreparedBase,
  copyRoot: string,
  stubs: readonly ProvisionedStub[],
  options: TreeShaOptions = {},
): Promise<DomainResult<string>> {
  const files = treeShaFiles(copyRoot, base.tsconfigPath, base.overlays, stubs);
  if (!files.success) return files;
  return computeTreeSha(runner, copyRoot, files.data, options);
}
