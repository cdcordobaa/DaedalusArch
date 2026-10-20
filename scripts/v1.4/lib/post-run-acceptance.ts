/**
 * Study 2b post-run acceptance (gate line D12; pre-registration §4 "Post-run acceptance"; DELEG6 as refined by DELEG8).
 * Zero model calls. Never a filter on D and never an exclusion: it only produces the pass rate per cell (evasion item 1).
 *
 * The procedure, and nothing else:
 * 1. Build: copy the snapshot to a scratch directory outside every out-root and type-check it with the harness's `tsc`
 *    and the harness tsconfig (`buildHarnessTsconfig`, the step's own type-check command). Failure = `build-failed`.
 * 2. Entry (DELEG8): the first that exists of the `package.json` `main` field (if it names an existing file under
 *    `src/`), then DELEG6's list, then the four `src/presentation/` names. No entry = `not-started`.
 * 3. Start: `tsx <entry>` (the `npx tsx` of DELEG6, resolved to a pinned tsx binary so nothing is downloaded) with
 *    `PORT` set to a free port; readiness by polling the base URL every 250 ms, up to 20 s, else `not-started`.
 * 4. Tests: the step files `<acceptance root>/<task>/step-01..step-j.test.mjs` for step j, each in its own
 *    `node --test` process with `BASE_URL`, 60 s per file (the in-loop runner's default at the tag).
 * 5. Outcome: a step passes iff every test file passes (no failed, no error, no time-out). `build-failed` and
 *    `not-started` count as failing.
 */
import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import { acceptanceFiles, freePort, manifestSha256, parseTapSummary } from '../../lib/loop/acceptance.js';
import { buildHarnessTsconfig } from '../../lib/generators/harness-tsconfig.js';

export const POST_RUN_ACCEPTANCE_SCHEMA = 'study2b-post-run-acceptance/v1';
/** DELEG6's list, in its order. */
export const DELEG6_ENTRIES = ['src/main.ts', 'src/server.ts', 'src/index.ts', 'src/app.ts', 'main.ts', 'server.ts', 'index.ts'] as const;
/** DELEG8's additions, after DELEG6's list. */
export const DELEG8_ENTRIES = ['src/presentation/server.ts', 'src/presentation/main.ts', 'src/presentation/app.ts', 'src/presentation/index.ts'] as const;
export const POLL_MS = 250;
export const READY_TIMEOUT_MS = 20_000;
export const TEST_TIMEOUT_MS = 60_000;
export const BUILD_TIMEOUT_MS = 300_000;
const KILL_GRACE_MS = 2_000;

export type PostRunStatus = 'ran' | 'build-failed' | 'not-started' | 'no-tests' | 'runner-error';

export interface PostRunFile {
  readonly file: string;
  readonly sha256: string;
  readonly passed: number;
  readonly failed: number;
  readonly errors: number;
  readonly timedOut: boolean;
  readonly pass: boolean;
}

export interface PostRunRecord {
  readonly status: PostRunStatus;
  /** The entry used, or the reason none was used. */
  readonly entry: string | null;
  readonly files: readonly PostRunFile[];
  readonly testFileSha256: string;
  /** Step passes iff status is `ran` and every file passes. `no-tests` is null (nothing to pass). */
  readonly pass: boolean | null;
  readonly durationMs: number;
  readonly message?: string;
}

/** DELEG8 step 2: the entry file, relative to the snapshot root, or null. */
export function resolveEntry(dir: string): string | null {
  const isFile = (rel: string): boolean => {
    try {
      return fs.statSync(path.join(dir, rel)).isFile();
    } catch {
      return false;
    }
  };
  try {
    const pj = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) as { main?: unknown };
    if (typeof pj.main === 'string') {
      const rel = path.posix.normalize(pj.main.replace(/^\.\//, ''));
      if (rel.startsWith('src/') && !rel.includes('..') && isFile(rel)) return rel;
    }
  } catch {
    // no or unreadable package.json: fall through to the lists
  }
  for (const rel of [...DELEG6_ENTRIES, ...DELEG8_ENTRIES]) if (isFile(rel)) return rel;
  return null;
}

/** DELEG8 step 5 for one file. */
export function filePasses(f: { readonly failed: number; readonly errors: number; readonly timedOut: boolean }): boolean {
  return !f.timedOut && f.failed === 0 && f.errors === 0;
}

/** DELEG8 step 5 for one step. */
export function stepPasses(status: PostRunStatus, files: readonly PostRunFile[]): boolean | null {
  if (status === 'no-tests') return null;
  if (status !== 'ran') return false;
  return files.length > 0 && files.every((f) => f.pass);
}

/** Pass rate per cell over the steps that have tests (failing statuses count as failing). */
export function passRate(records: readonly { readonly cell: string; readonly pass: boolean | null }[]): Record<string, { readonly steps: number; readonly passed: number; readonly rate: number | null }> {
  const out: Record<string, { steps: number; passed: number; rate: number | null }> = {};
  for (const r of records) {
    if (r.pass === null) continue;
    const c = (out[r.cell] ??= { steps: 0, passed: 0, rate: null });
    c.steps += 1;
    if (r.pass) c.passed += 1;
  }
  for (const c of Object.values(out)) c.rate = c.steps === 0 ? null : c.passed / c.steps;
  return out;
}

function answers(url: string, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: ms }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => {
      resolve(false);
    });
  });
}

async function waitReady(url: string, child: ChildProcess): Promise<boolean> {
  const deadline = performance.now() + READY_TIMEOUT_MS;
  while (performance.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) return false;
    if (await answers(url, POLL_MS)) return true;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  return false;
}

function baseEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { NODE_ENV: 'test', ...extra };
  for (const k of ['PATH', 'HOME']) {
    const v = process.env[k];
    if (v !== undefined) env[k] = v;
  }
  return env;
}

async function stopGroup(child: ChildProcess): Promise<void> {
  const pid = child.pid;
  if (pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((r) => child.once('exit', () => r()));
  const kill = (sig: NodeJS.Signals): void => {
    try {
      process.kill(-pid, sig);
    } catch {
      // already gone
    }
  };
  kill('SIGTERM');
  const t = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), KILL_GRACE_MS));
  if ((await Promise.race([exited.then(() => 'exited' as const), t])) === 'timeout') {
    kill('SIGKILL');
    await exited;
  }
}

function runTestFile(file: string, baseUrl: string): Promise<{ stdout: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--test', '--test-reporter=tap', path.basename(file)], { cwd: path.dirname(file), env: baseEnv({ BASE_URL: baseUrl }), stdio: ['ignore', 'pipe', 'ignore'], detached: true });
    let stdout = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (d: string) => {
      stdout += d;
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      void stopGroup(child);
    }, TEST_TIMEOUT_MS);
    child.on('close', () => {
      clearTimeout(timer);
      resolve({ stdout, timedOut });
    });
  });
}

const sha = (f: string): string => createHash('sha256').update(fs.readFileSync(f)).digest('hex');

export interface PostRunInput {
  /** Materialises the snapshot tree into the given (absent) directory. */
  readonly materialise: (into: string) => void;
  readonly task: string;
  /** 1-based step. */
  readonly step: number;
  readonly acceptanceRoot: string;
  /** The skeleton install's `node_modules` (symlinked, never copied). */
  readonly nodeModules: string;
  /** The harness's `tsc` launcher (`<H>/bin/tsc`). */
  readonly tsc: string;
  /** A tsx binary (the `npx tsx` of DELEG6). */
  readonly tsx: string;
  /** A scratch root outside every out-root. */
  readonly scratchRoot: string;
}

/** Steps 1–5 on one stored snapshot. */
export async function runPostRunAcceptance(input: PostRunInput): Promise<PostRunRecord> {
  const t0 = performance.now();
  const ms = (): number => Math.round(performance.now() - t0);
  const testFiles = acceptanceFiles(input.acceptanceRoot, input.task, input.step - 1);
  const unrun = (): PostRunFile[] => testFiles.map((f) => ({ file: path.basename(f), sha256: sha(f), passed: 0, failed: 0, errors: 1, timedOut: false, pass: false }));
  const rec = (status: PostRunStatus, entry: string | null, files: PostRunFile[], message?: string): PostRunRecord => ({
    status, entry, files, testFileSha256: manifestSha256(files), pass: stepPasses(status, files), durationMs: ms(), ...(message !== undefined ? { message } : {}),
  });
  if (testFiles.length === 0) return rec('no-tests', null, []);
  const scratch = fs.mkdtempSync(path.join(input.scratchRoot, 'post-run-acc-'));
  const dir = path.join(scratch, 'service');
  let child: ChildProcess | null = null;
  try {
    input.materialise(dir);
    fs.rmSync(path.join(dir, 'node_modules'), { recursive: true, force: true });
    fs.symlinkSync(input.nodeModules, path.join(dir, 'node_modules'));
    // 1. Build: the harness type-check of record on the copy.
    const tsconfig = path.join(scratch, 'tsconfig.json');
    fs.writeFileSync(tsconfig, `${JSON.stringify(buildHarnessTsconfig(dir), null, 2)}\n`);
    const b = spawnSync(input.tsc, ['-p', tsconfig, '--pretty', 'false'], { cwd: dir, env: baseEnv({}), timeout: BUILD_TIMEOUT_MS, stdio: 'ignore' });
    if (b.error !== undefined || b.status !== 0) return rec('build-failed', null, unrun(), b.error?.message ?? `tsc exited ${String(b.status)}`);
    // 2. Entry.
    const entry = resolveEntry(dir);
    if (entry === null) return rec('not-started', null, unrun(), 'no entry file');
    // 3. Start.
    const port = await freePort();
    child = spawn(input.tsx, [entry], { cwd: dir, env: baseEnv({ PORT: String(port) }), stdio: 'ignore', detached: true });
    child.on('error', () => undefined);
    const baseUrl = `http://127.0.0.1:${String(port)}`;
    if (!(await waitReady(`${baseUrl}/`, child))) return rec('not-started', entry, unrun(), `no HTTP answer within ${String(READY_TIMEOUT_MS)} ms`);
    // 4. Tests.
    const files: PostRunFile[] = [];
    for (const f of testFiles) {
      const r = await runTestFile(f, baseUrl);
      const s = parseTapSummary(r.stdout);
      const row = { file: path.basename(f), sha256: sha(f), passed: s?.passed ?? 0, failed: s?.failed ?? 0, errors: s === null || r.timedOut ? 1 + (s?.cancelled ?? 0) : s.cancelled, timedOut: r.timedOut };
      files.push({ ...row, pass: filePasses(row) });
    }
    return rec('ran', entry, files);
  } catch (e) {
    return rec('runner-error', null, unrun(), e instanceof Error ? e.message : String(e));
  } finally {
    if (child !== null) await stopGroup(child);
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}
