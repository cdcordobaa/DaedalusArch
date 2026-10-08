/**
 * Pinned generator skeleton, read-only install and integrity check (FR-v1.2E-28; SECURITY-10; BR-U5a-42, 45;
 * D-U5a-4, D-U5a-9).
 *
 * - `installSkeleton(runner, repoRoot, harnessRoot, opts)`: copies `scripts/generator/skeleton/{package.json,
 *   package-lock.json}` into `<H>/skeleton-install/`, runs `npm ci --offline --ignore-scripts` there (the cache is
 *   warmed once by `warmSkeletonCache`, the only step that may use the network), records the install hash and
 *   makes the install read-only (`chmod -R a-w`). The record is written to `<H>/skeleton-install.json`.
 * - `installHash(dir)`: sha256 over the sorted list of `path\tsize\tsha256` lines of every file under `dir`
 *   (symlinks as `path\tlink\t<target>`, never followed), POSIX paths relative to `dir`.
 * - `prepareCellDir(install, repoRoot, cwd)`: a fresh, empty `cwd` with a copy of the skeleton `package.json` and a
 *   `node_modules` symlink to `<install>/node_modules`.
 * - `checkSkeletonIntact(...)` (BR-U5a-45): `package.json` byte-identical ∧ `node_modules` the same symlink ∧ the
 *   install's recorded hash unchanged; otherwise `skeleton-tampered` with the failing checks listed.
 * - `checkHarnessTsconfigMain(argv, repoRoot)`: the D-U5a-9 check run by `scripts/generator/check-harness-tsconfig.ts`
 *   (temp harness, real install, the BR-U5a-42 two-file project: 0 errors, then exactly 1 with a bad assignment).
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { ProcessRunner } from '../../../src/shared/interfaces/process-runner.js';
import { NodeProcessRunner, buildChildEnv } from '../../../src/shared/process/node-process-runner.js';
import { scrubSecrets } from '../../../src/shared/errors/scrub.js';
import { parseTscOutput } from '../mutation/typecheck.js';
import { harnessTscPath, typecheckCommand } from './argv.js';
import { writeHarnessTscLauncher, writeHarnessTsconfig } from './harness-tsconfig.js';

/** Repo-relative directory of the pinned skeleton (data files, never installed into the repository). */
export const SKELETON_REL_DIR = 'scripts/generator/skeleton';
export const SKELETON_FILES = ['package.json', 'package-lock.json'] as const;
export const NPM_TIMEOUT_MS = 10 * 60 * 1000;
const TSC_TIMEOUT_MS = 5 * 60 * 1000;
/** Parent variables npm may see (cache under `$HOME/.npm`); nothing else is inherited. */
const NPM_ENV_ALLOW = ['PATH', 'HOME', 'USER', 'LOGNAME', 'TMPDIR', 'LANG'] as const;

export interface SkeletonInstall {
  /** `<H>/skeleton-install`. */
  readonly dir: string;
  readonly installHash: string;
  /** sha256 of the skeleton `package.json` / `package-lock.json` installed. */
  readonly packageJsonSha256: string;
  readonly lockSha256: string;
  /** `<dir>/node_modules/typescript/lib/tsc.js`. */
  readonly tscJs: string;
  readonly tscVersion: string;
}

export interface SkeletonIntegrity {
  readonly skeletonIntact: boolean;
  /** Empty when intact; otherwise any of `package-json-changed`, `node-modules-not-symlink`, `node-modules-retargeted`, `install-hash-changed`. */
  readonly problems: readonly string[];
  readonly failureReason?: 'skeleton-tampered';
}

function sha256(buf: Buffer | string): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function skeletonSourceDir(repoRoot: string): string {
  return path.resolve(repoRoot, SKELETON_REL_DIR);
}

export function skeletonInstallDir(harnessRoot: string): string {
  return path.join(harnessRoot, 'skeleton-install');
}

function walk(root: string, rel: string, out: string[]): void {
  const abs = rel === '' ? root : path.join(root, ...rel.split('/'));
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const r = rel === '' ? e.name : `${rel}/${e.name}`;
    if (e.isDirectory()) walk(root, r, out);
    else out.push(r);
  }
}

/** Sorted `path\tsize\tsha256` (or `path\tlink\ttarget`) lines of every file under `dir`. */
export function installListing(dir: string): readonly string[] {
  const files: string[] = [];
  walk(dir, '', files);
  files.sort(cmp);
  return files.map((rel) => {
    const abs = path.join(dir, ...rel.split('/'));
    const st = fs.lstatSync(abs);
    if (st.isSymbolicLink()) return `${rel}\tlink\t${fs.readlinkSync(abs)}`;
    return `${rel}\t${String(st.size)}\t${sha256(fs.readFileSync(abs))}`;
  });
}

export function installHash(dir: string): string {
  return sha256(installListing(dir).join('\n') + '\n');
}

function chmodTree(dir: string, change: (mode: number) => number): void {
  const st = fs.lstatSync(dir);
  if (st.isSymbolicLink()) return;
  if (st.isDirectory()) {
    // Make a directory writable before descending (so children can be changed), read-only after.
    const target = change(st.mode & 0o7777);
    if ((target & 0o200) !== 0) fs.chmodSync(dir, target);
    for (const e of fs.readdirSync(dir)) chmodTree(path.join(dir, e), change);
    if ((target & 0o200) === 0) fs.chmodSync(dir, target);
    return;
  }
  fs.chmodSync(dir, change(st.mode & 0o7777));
}

/** `chmod -R a-w`. */
export function makeReadOnly(dir: string): void {
  chmodTree(dir, (m) => m & ~0o222);
}

/** `chmod -R u+w` (cleanup and rebuild only). */
export function makeWritable(dir: string): void {
  if (fs.existsSync(dir)) chmodTree(dir, (m) => m | 0o200);
}

export function removeTree(dir: string): void {
  if (!fs.existsSync(dir)) return;
  makeWritable(dir);
  fs.rmSync(dir, { recursive: true, force: true });
}

function npmEnv(): Readonly<Record<string, string>> {
  return buildChildEnv(process.env, NPM_ENV_ALLOW);
}

/**
 * Warms the npm cache for the pinned lock (the one networked step, D-U5a-9 / P-2): `npm ci --ignore-scripts
 * --prefer-offline` in a throwaway directory, then removed.
 */
export async function warmSkeletonCache(runner: ProcessRunner, repoRoot: string, tmpRoot = os.tmpdir()): Promise<DomainResult<void>> {
  const dir = fs.mkdtempSync(path.join(tmpRoot, 'u5a-skeleton-warm-'));
  try {
    for (const f of SKELETON_FILES) fs.copyFileSync(path.join(skeletonSourceDir(repoRoot), f), path.join(dir, f));
    const r = await runner.run('npm', ['ci', '--ignore-scripts', '--prefer-offline', '--no-audit', '--no-fund'], {
      cwd: dir,
      env: npmEnv(),
      timeoutMs: NPM_TIMEOUT_MS,
    });
    if (!r.success) return DomainResult.fail(r.errors);
    if (r.data.exitCode !== 0 || r.data.timedOut) {
      return DomainResult.fail([
        { code: 'GEN_SKELETON_WARM_FAILED', message: scrubSecrets(r.data.stderr.slice(-2000), []) },
      ]);
    }
    return DomainResult.ok(undefined);
  } finally {
    removeTree(dir);
  }
}

export interface InstallOptions {
  /** Default true (BR-U5a-45: `npm ci --offline --ignore-scripts`). */
  readonly offline?: boolean;
}

/** Installs the pinned skeleton under `<H>/skeleton-install/` (replacing any previous install) and makes it read-only. */
export async function installSkeleton(
  runner: ProcessRunner,
  repoRoot: string,
  harnessRoot: string,
  opts: InstallOptions = {},
): Promise<DomainResult<SkeletonInstall>> {
  const dir = skeletonInstallDir(harnessRoot);
  removeTree(dir);
  fs.mkdirSync(dir, { recursive: true });
  const src = skeletonSourceDir(repoRoot);
  for (const f of SKELETON_FILES) fs.copyFileSync(path.join(src, f), path.join(dir, f));
  const args = ['ci', '--ignore-scripts', '--no-audit', '--no-fund'];
  if (opts.offline ?? true) args.splice(1, 0, '--offline');
  const r = await runner.run('npm', args, { cwd: dir, env: npmEnv(), timeoutMs: NPM_TIMEOUT_MS });
  if (!r.success) return DomainResult.fail(r.errors);
  if (r.data.exitCode !== 0 || r.data.timedOut) {
    return DomainResult.fail([
      {
        code: 'GEN_SKELETON_INSTALL_FAILED',
        message: scrubSecrets(r.data.stderr.slice(-2000), []),
        context: { exitCode: r.data.exitCode, timedOut: r.data.timedOut },
      },
    ]);
  }
  const tscJs = path.join(dir, 'node_modules', 'typescript', 'lib', 'tsc.js');
  const tsPkg = path.join(dir, 'node_modules', 'typescript', 'package.json');
  if (!fs.existsSync(tscJs) || !fs.existsSync(tsPkg)) {
    return DomainResult.fail([{ code: 'GEN_SKELETON_INSTALL_FAILED', message: 'typescript missing from the install' }]);
  }
  const rawVersion = (JSON.parse(fs.readFileSync(tsPkg, 'utf8')) as { version?: unknown }).version;
  const tscVersion = typeof rawVersion === 'string' ? rawVersion : '';
  const record: SkeletonInstall = {
    dir,
    installHash: installHash(dir),
    packageJsonSha256: sha256(fs.readFileSync(path.join(dir, 'package.json'))),
    lockSha256: sha256(fs.readFileSync(path.join(dir, 'package-lock.json'))),
    tscJs,
    tscVersion,
  };
  makeReadOnly(dir);
  fs.writeFileSync(path.join(harnessRoot, 'skeleton-install.json'), `${JSON.stringify(record, null, 2)}\n`);
  return DomainResult.ok(Object.freeze(record));
}

/** A fresh, empty `cwd` with the skeleton `package.json` and a `node_modules` symlink to the install (BR-U5a-45). */
export function prepareCellDir(install: Pick<SkeletonInstall, 'dir'>, repoRoot: string, cwd: string): DomainResult<void> {
  if (fs.existsSync(cwd) && fs.readdirSync(cwd).length > 0) {
    return DomainResult.fail([{ code: 'GEN_CWD_NOT_EMPTY', message: 'the run cwd must be fresh and empty' }]);
  }
  fs.mkdirSync(cwd, { recursive: true });
  fs.copyFileSync(path.join(skeletonSourceDir(repoRoot), 'package.json'), path.join(cwd, 'package.json'));
  fs.symlinkSync(path.join(install.dir, 'node_modules'), path.join(cwd, 'node_modules'), 'dir');
  return DomainResult.ok(undefined);
}

/** BR-U5a-45 integrity check after a run. */
export function checkSkeletonIntact(
  install: Pick<SkeletonInstall, 'dir' | 'installHash'>,
  repoRoot: string,
  cwd: string,
): SkeletonIntegrity {
  const problems: string[] = [];
  const pj = path.join(cwd, 'package.json');
  const expected = fs.readFileSync(path.join(skeletonSourceDir(repoRoot), 'package.json'));
  let pjOk = false;
  try {
    pjOk = fs.lstatSync(pj).isFile() && fs.readFileSync(pj).equals(expected);
  } catch {
    pjOk = false;
  }
  if (!pjOk) problems.push('package-json-changed');
  const nm = path.join(cwd, 'node_modules');
  let isLink = false;
  try {
    isLink = fs.lstatSync(nm).isSymbolicLink();
  } catch {
    isLink = false;
  }
  if (!isLink) problems.push('node-modules-not-symlink');
  else if (fs.readlinkSync(nm) !== path.join(install.dir, 'node_modules')) problems.push('node-modules-retargeted');
  let hashNow = '';
  try {
    hashNow = installHash(install.dir);
  } catch {
    hashNow = '';
  }
  if (hashNow !== install.installHash) problems.push('install-hash-changed');
  return problems.length === 0
    ? { skeletonIntact: true, problems }
    : { skeletonIntact: false, problems, failureReason: 'skeleton-tampered' };
}

// --- D-U5a-9 harness tsconfig check ----------------------------------------------------------------------------

/** The BR-U5a-42 two-file project (`process.env` and `import express from 'express'`). */
export const HARNESS_CHECK_FILES: Readonly<Record<string, string>> = {
  'src/config.ts': "export const port: number = Number(process.env.PORT ?? '3000');\n",
  'src/server.ts':
    "import express from 'express';\nimport { port } from './config';\n\n" +
    'const app = express();\n' +
    "app.get('/health', (_req, res) => {\n  res.json({ ok: true });\n});\n" +
    'export const start = (): void => {\n  app.listen(port);\n};\n',
};

/** Appended to `src/config.ts` for the negative case: exactly one TS2322. */
export const HARNESS_CHECK_BAD_LINE = "export const bad: number = String(port);\n";

export interface HarnessCheckReport {
  readonly installMode: 'offline' | 'warmed-then-offline';
  readonly installHash: string;
  readonly lockSha256: string;
  readonly tscVersion: string;
  readonly cleanErrors: number;
  readonly badErrors: number;
  readonly badCodes: readonly string[];
  readonly skeletonIntact: boolean;
  readonly passed: boolean;
}

async function runHarnessTsc(
  runner: ProcessRunner,
  harnessRoot: string,
  runId: string,
  cwd: string,
): Promise<DomainResult<readonly string[]>> {
  const cmd = typecheckCommand(harnessRoot, runId).split(' ');
  const r = await runner.run(cmd[0] ?? harnessTscPath(harnessRoot), cmd.slice(1), {
    cwd,
    env: buildChildEnv(process.env, ['PATH']),
    timeoutMs: TSC_TIMEOUT_MS,
  });
  if (!r.success) return DomainResult.fail(r.errors);
  const errs = parseTscOutput(`${r.data.stdout}\n${r.data.stderr}`).map((d) => d.code);
  if (errs.length === 0 && (r.data.exitCode !== 0 || r.data.timedOut)) {
    return DomainResult.ok([r.data.timedOut ? 'TSC_TIMEOUT' : `TSC_EXIT_${String(r.data.exitCode)}`]);
  }
  return DomainResult.ok(errs);
}

/** Runs the D-U5a-9 check in a throwaway harness under `tmpRoot` (outside the repository). */
export async function runHarnessTsconfigCheck(
  runner: ProcessRunner,
  repoRoot: string,
  tmpRoot = os.tmpdir(),
): Promise<DomainResult<HarnessCheckReport>> {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(tmpRoot), 'u5a-harness-check-'));
  try {
    const h = path.join(root, 'h');
    fs.mkdirSync(h);
    let installMode: HarnessCheckReport['installMode'] = 'offline';
    let inst = await installSkeleton(runner, repoRoot, h);
    if (!inst.success) {
      const warmed = await warmSkeletonCache(runner, repoRoot, root);
      if (!warmed.success) return DomainResult.fail(warmed.errors);
      installMode = 'warmed-then-offline';
      inst = await installSkeleton(runner, repoRoot, h);
      if (!inst.success) return DomainResult.fail(inst.errors);
    }
    const install = inst.data;
    writeHarnessTscLauncher(h, install.tscJs, process.execPath);
    const runId = 'harness-check/task-management/none/run-0';
    const cwd = path.join(root, 'out', ...runId.split('/'));
    const prep = prepareCellDir(install, repoRoot, cwd);
    if (!prep.success) return DomainResult.fail(prep.errors);
    for (const [rel, text] of Object.entries(HARNESS_CHECK_FILES)) {
      fs.mkdirSync(path.dirname(path.join(cwd, rel)), { recursive: true });
      fs.writeFileSync(path.join(cwd, rel), text);
    }
    writeHarnessTsconfig(h, runId, cwd);
    const clean = await runHarnessTsc(runner, h, runId, cwd);
    if (!clean.success) return DomainResult.fail(clean.errors);
    fs.appendFileSync(path.join(cwd, 'src/config.ts'), HARNESS_CHECK_BAD_LINE);
    const bad = await runHarnessTsc(runner, h, runId, cwd);
    if (!bad.success) return DomainResult.fail(bad.errors);
    const integrity = checkSkeletonIntact(install, repoRoot, cwd);
    return DomainResult.ok({
      installMode,
      installHash: install.installHash,
      lockSha256: install.lockSha256,
      tscVersion: install.tscVersion,
      cleanErrors: clean.data.length,
      badErrors: bad.data.length,
      badCodes: bad.data,
      skeletonIntact: integrity.skeletonIntact,
      passed: clean.data.length === 0 && bad.data.length === 1 && integrity.skeletonIntact,
    });
  } finally {
    removeTree(root);
  }
}

/** `main` of `scripts/generator/check-harness-tsconfig.ts` (D-U5a-13 a): exit 0 pass, 1 fail, 2 usage/infra. */
export async function checkHarnessTsconfigMain(argv: readonly string[], repoRoot: string): Promise<number> {
  if (!fs.existsSync(path.resolve(repoRoot, 'schemas/manifest.schema.json'))) {
    process.stderr.write('run from the repository root\n');
    return 2;
  }
  if (argv.length > 0) {
    process.stderr.write('usage: npx tsx scripts/generator/check-harness-tsconfig.ts\n');
    return 2;
  }
  const r = await runHarnessTsconfigCheck(new NodeProcessRunner(), repoRoot);
  if (!r.success) {
    process.stderr.write(`${scrubSecrets(r.errors.map((e) => `${e.code}: ${e.message}`).join('\n'), [])}\n`);
    return 2;
  }
  process.stdout.write(`${JSON.stringify(r.data, null, 2)}\n`);
  return r.data.passed ? 0 : 1;
}
