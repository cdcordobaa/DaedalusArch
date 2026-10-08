/**
 * Base preparation and copies (FR-v1.2E-24; BR-U5a-04, 08, 10 overlay part; `domain-entities.md` §2.1).
 *
 * - `makePreparedBase` is the only way U5a builds a `PreparedBase`: it validates the §2.1 invariants
 *   (`baseCommit` 40 hex for fixture | corpus and absent for generated; `baseGenerationTreeSha` 40 hex iff
 *   generated; `tscPath` absolute; `tsconfigPath` relative; overlay sha256 64 hex; `capped` equal to
 *   `judgeSelection?.some(s => s.capped) ?? false`) and returns a frozen value.
 * - `prepareFixtureBase` prepares a fixture base: `dir` = the fixture directory (read only), `baseCommit` =
 *   `git rev-parse HEAD` of the repository, `tscPath` = the repository's `node_modules/typescript/lib/tsc.js`,
 *   `tscVersion` measured with `node <tscPath> --version`, no overlays, no install, no judge selection.
 * - `copyBase` copies the prepared base (sources, overlays, lock file, install) to a fresh destination with
 *   `fs.cp` and checks every overlay's sha256 in the copy (`MUT_OVERLAY_MISMATCH`). The source is never written
 *   (BR-U5a-04); the destination must not exist.
 *
 * Every child process goes through `ProcessRunner` with an explicit environment (`PATH` only for `git`, none for
 * `node`, which runs as `process.execPath`); nothing is resolved through `npx` (BR-U5a-08).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { ProcessRunner } from '../../../src/shared/interfaces/process-runner.js';
import type { BaseKind, JudgeSelection, PreparedBase } from './types.js';

const SHA1_HEX = /^[0-9a-f]{40}$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;
const CHILD_TIMEOUT_MS = 60_000;

/** Fields of a `PreparedBase` except the derived `capped`. */
export type PreparedBaseInput = Omit<PreparedBase, 'capped'> & { readonly capped?: boolean };

function fail<T>(code: string, message: string, context?: Record<string, unknown>): DomainResult<T> {
  return DomainResult.fail([{ code, message, ...(context !== undefined ? { context } : {}) }]);
}

function isPosixRelative(p: string): boolean {
  return p.length > 0 && !path.isAbsolute(p) && !p.includes('\\') && !p.split('/').includes('..');
}

/** Validates the §2.1 invariants and returns a frozen `PreparedBase` (`PREP_INVALID` on any violation). */
export function makePreparedBase(input: PreparedBaseInput): DomainResult<PreparedBase> {
  const problems: string[] = [];
  const kinds: readonly BaseKind[] = ['fixture', 'corpus', 'generated'];
  if (input.projectId.length === 0 || input.projectId.includes('|')) problems.push('projectId must be non-empty without "|"');
  if (!kinds.includes(input.baseKind)) problems.push(`unknown baseKind '${input.baseKind as string}'`);
  if (input.baseKind === 'generated') {
    if (input.baseGenerationTreeSha === undefined || !SHA1_HEX.test(input.baseGenerationTreeSha)) {
      problems.push('generated base needs a 40-hex baseGenerationTreeSha');
    }
    if (input.baseCommit !== undefined) problems.push('generated base has no baseCommit');
  } else {
    if (input.baseCommit === undefined || !SHA1_HEX.test(input.baseCommit)) problems.push(`${input.baseKind} base needs a 40-hex baseCommit`);
    if (input.baseGenerationTreeSha !== undefined) problems.push(`${input.baseKind} base has no baseGenerationTreeSha`);
  }
  if (!path.isAbsolute(input.dir)) problems.push('dir must be absolute');
  if (!isPosixRelative(input.tsconfigPath)) problems.push('tsconfigPath must be POSIX relative to dir');
  if (!path.isAbsolute(input.tscPath)) problems.push('tscPath must be absolute');
  if (input.tscVersion.length === 0) problems.push('tscVersion must be measured');
  if (input.installLockSha256 !== undefined && !SHA256_HEX.test(input.installLockSha256)) problems.push('installLockSha256 must be 64 hex');
  for (const o of input.overlays) {
    if (!isPosixRelative(o.path)) problems.push(`overlay path '${o.path}' must be POSIX relative to dir`);
    if (!SHA256_HEX.test(o.sha256)) problems.push(`overlay '${o.path}' sha256 must be 64 hex`);
  }
  if (input.specPath.length === 0) problems.push('specPath must be non-empty');
  const derived = input.judgeSelection?.some((s) => s.capped) ?? false;
  if (input.capped !== undefined && input.capped !== derived) {
    problems.push(`capped (${String(input.capped)}) is inconsistent with judgeSelection (derived ${String(derived)})`);
  }
  if (problems.length > 0) return fail('PREP_INVALID', `invalid PreparedBase: ${problems.join('; ')}`, { problems });

  const judgeSelection: readonly JudgeSelection[] | undefined =
    input.judgeSelection === undefined
      ? undefined
      : Object.freeze(input.judgeSelection.map((s) => Object.freeze({ ...s, selectedFiles: Object.freeze([...s.selectedFiles]) })));
  const base: PreparedBase = {
    projectId: input.projectId,
    baseKind: input.baseKind,
    dir: input.dir,
    ...(input.baseCommit !== undefined ? { baseCommit: input.baseCommit } : {}),
    ...(input.baseGenerationTreeSha !== undefined ? { baseGenerationTreeSha: input.baseGenerationTreeSha } : {}),
    tsconfigPath: input.tsconfigPath,
    tscPath: input.tscPath,
    tscVersion: input.tscVersion,
    ...(input.installLockSha256 !== undefined ? { installLockSha256: input.installLockSha256 } : {}),
    overlays: Object.freeze(input.overlays.map((o) => Object.freeze({ path: o.path, sha256: o.sha256 }))),
    specPath: input.specPath,
    capped: derived,
    ...(judgeSelection !== undefined ? { judgeSelection } : {}),
  };
  return DomainResult.ok(Object.freeze(base));
}

/** Absolute path of the repository's pinned tsc (fixture bases, BR-U5a-08). */
export function repoTscPath(repoRoot: string): string {
  return path.resolve(repoRoot, 'node_modules/typescript/lib/tsc.js');
}

/** `node <tscPath> --version` → e.g. `5.9.3` (`PREP_TSC_VERSION` when it cannot be measured). */
export async function measureTscVersion(runner: ProcessRunner, tscPath: string): Promise<DomainResult<string>> {
  const run = await runner.run(process.execPath, [tscPath, '--version'], { env: {}, timeoutMs: CHILD_TIMEOUT_MS });
  if (!run.success) return run;
  const m = /Version\s+(\S+)/.exec(run.data.stdout);
  if (run.data.exitCode !== 0 || m === null) {
    return fail('PREP_TSC_VERSION', `cannot measure the tsc version of ${path.basename(tscPath)} (exit ${String(run.data.exitCode)})`);
  }
  return DomainResult.ok(m[1] ?? '');
}

/** `git rev-parse HEAD` in `repoRoot`, with `PATH` only (no inherited `GIT_*`). */
export async function repoHeadCommit(runner: ProcessRunner, repoRoot: string): Promise<DomainResult<string>> {
  const env: Record<string, string> = process.env.PATH !== undefined ? { PATH: process.env.PATH } : {};
  const run = await runner.run('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, env, timeoutMs: CHILD_TIMEOUT_MS });
  if (!run.success) return run;
  const sha = run.data.stdout.trim();
  if (run.data.exitCode !== 0 || !SHA1_HEX.test(sha)) return fail('PREP_GIT_HEAD', 'git rev-parse HEAD failed');
  return DomainResult.ok(sha);
}

/**
 * Prepares a fixture base (`baseKind: 'fixture'`). `fixtureDir` is absolute or relative to `repoRoot`;
 * `specPath` is kept as given (repository-relative). The fixture must hold a `tsconfig.json`.
 */
export async function prepareFixtureBase(
  runner: ProcessRunner,
  repoRoot: string,
  fixtureDir: string,
  specPath: string,
): Promise<DomainResult<PreparedBase>> {
  const dir = path.resolve(repoRoot, fixtureDir);
  if (!fs.existsSync(path.join(dir, 'tsconfig.json'))) {
    return fail('PREP_NO_TSCONFIG', `fixture ${path.basename(dir)} has no tsconfig.json`);
  }
  const tscPath = repoTscPath(repoRoot);
  const version = await measureTscVersion(runner, tscPath);
  if (!version.success) return version;
  const head = await repoHeadCommit(runner, repoRoot);
  if (!head.success) return head;
  return makePreparedBase({
    projectId: path.basename(dir),
    baseKind: 'fixture',
    dir,
    baseCommit: head.data,
    tsconfigPath: 'tsconfig.json',
    tscPath,
    tscVersion: version.data,
    overlays: [],
    specPath,
  });
}

/** sha256 hex of a file's bytes. */
export function sha256File(file: string): string {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/**
 * Copies the prepared base to `dest` (must not exist; its parent is created) and checks each overlay in the copy
 * against its recorded sha256. On a mismatch the copy is removed and `MUT_OVERLAY_MISMATCH` returned. The source
 * directory is only read (BR-U5a-04).
 */
export async function copyBase(base: PreparedBase, dest: string): Promise<DomainResult<string>> {
  const target = path.resolve(dest);
  const source = path.resolve(base.dir);
  if (fs.existsSync(target)) return fail('MUT_COPY_EXISTS', `copy destination ${path.basename(target)} already exists`);
  const rel = path.relative(source, target);
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
    return fail('MUT_COPY_INSIDE_BASE', 'copy destination lies inside the prepared base');
  }
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  await fs.promises.cp(source, target, { recursive: true, errorOnExist: true, force: false, preserveTimestamps: true, verbatimSymlinks: true });
  for (const o of base.overlays) {
    const file = path.join(target, ...o.path.split('/'));
    const actual = fs.existsSync(file) ? sha256File(file) : null;
    if (actual !== o.sha256) {
      await fs.promises.rm(target, { recursive: true, force: true });
      return fail('MUT_OVERLAY_MISMATCH', `overlay ${o.path} does not match its recorded sha256`, {
        path: o.path,
        expected: o.sha256,
        actual,
      });
    }
  }
  return DomainResult.ok(target);
}
