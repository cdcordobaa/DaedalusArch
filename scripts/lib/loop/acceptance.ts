/**
 * Per-step acceptance checks of the loop (gate line D12, the feature-dropping guard; `Docs/v1.3/acceptance-checks.md`).
 *
 * After a snapshot is committed, the harness copies the work tree to a scratch directory outside it, starts the
 * service there with a fixed command (the task's `acceptance.startCommand`, else the snapshot's `package.json` `start`
 * script), waits until its port answers, and runs the black-box test files `<testsRoot>/<taskId>/step-01..step-k`
 * (`node:test` + `fetch`) from the test directory, each in its own `node --test` process with a timeout. The agent
 * never sees the tests: they live outside every cwd and no frame names them. The record holds the pass, fail, skip and
 * error counts and the sha256 of every file run.
 *
 * Off by default: the loop calls the runner only when the plan sets `acceptance.enabled` (`main.ts`); otherwise no
 * record carries an `acceptance` field.
 */
import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { performance } from 'node:perf_hooks';
import type { AcceptanceFileResult, AcceptanceRecord, TaskAcceptance } from './types.js';

export const ACCEPTANCE_SCHEMA = 'loop-acceptance/v1';
export const DEFAULT_START_TIMEOUT_MS = 30_000;
export const DEFAULT_TEST_TIMEOUT_MS = 60_000;
const KILL_GRACE_MS = 2_000;

/** The plan's `acceptance` block. */
export interface AcceptancePlan {
  readonly enabled: boolean;
  /** Absolute; outside the repository's work trees and the output root. */
  readonly testsRoot: string;
  /** Per test file. */
  readonly timeoutMs?: number;
  /** Build plus readiness wait. */
  readonly startTimeoutMs?: number;
}

export interface AcceptanceInput {
  readonly taskId: string;
  readonly stepIndex: number;
  /** The snapshot's work tree (only read; the service runs on a copy). */
  readonly workDir: string;
  /** The task's start block from the tasks file, if any. */
  readonly task?: TaskAcceptance;
  /** Where the service log goes (outside the work tree), or none. */
  readonly logFile?: string;
}

/** Runs the acceptance checks of one snapshot. */
export interface AcceptanceRunner {
  run(input: AcceptanceInput): Promise<AcceptanceRecord>;
}

function sha256(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** The test files of steps 1..k that exist for a task, in step order. */
export function acceptanceFiles(testsRoot: string, taskId: string, stepIndex: number): string[] {
  const dir = path.join(testsRoot, taskId);
  const out: string[] = [];
  for (let i = 0; i <= stepIndex; i++) {
    const f = path.join(dir, `step-${pad(i + 1)}.test.mjs`);
    if (fs.existsSync(f)) out.push(f);
  }
  return out;
}

/** sha256 of the sorted `file<TAB>sha256\n` manifest. */
export function manifestSha256(files: readonly { readonly file: string; readonly sha256: string }[]): string {
  return sha256(
    [...files]
      .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0))
      .map((f) => `${f.file}\t${f.sha256}\n`)
      .join(''),
  );
}

/** Counts of a `node --test --test-reporter=tap` run (its trailing `# pass N` lines). */
export function parseTapSummary(stdout: string): { passed: number; failed: number; skipped: number; cancelled: number; todo: number } | null {
  const get = (k: string): number | null => {
    const m = new RegExp(`^# ${k} (\\d+)$`, 'm').exec(stdout);
    return m?.[1] !== undefined ? Number(m[1]) : null;
  };
  const passed = get('pass');
  const failed = get('fail');
  if (passed === null || failed === null) return null;
  return { passed, failed, skipped: get('skipped') ?? 0, cancelled: get('cancelled') ?? 0, todo: get('todo') ?? 0 };
}

/** The start command: the task's, else `npm run --silent start` when the snapshot's package.json has one. */
export function resolveStartCommand(dir: string, task: TaskAcceptance | undefined): readonly string[] | null {
  if (task?.startCommand !== undefined && task.startCommand.length > 0) return task.startCommand;
  try {
    const pj = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) as { scripts?: Record<string, unknown> };
    if (typeof pj.scripts?.start === 'string' && pj.scripts.start.trim() !== '') return ['npm', 'run', '--silent', 'start'];
  } catch {
    // no or unreadable package.json: no start command
  }
  return null;
}

function substitute(argv: readonly string[], vars: Readonly<Record<string, string>>): string[] {
  return argv.map((a) => a.replace(/\{\{(port|dir)\}\}/g, (_m, k: string) => vars[k] ?? ''));
}

export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
      srv.close(() => {
        resolve(port);
      });
    });
  });
}

/** True when `GET url` gets any HTTP response before `ms`. */
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

async function waitReady(url: string, deadline: number, child: ChildProcess): Promise<boolean> {
  while (performance.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) return false;
    if (await answers(url, 500)) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

function serviceEnv(port: number): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { PORT: String(port), NODE_ENV: 'test' };
  for (const k of ['PATH', 'HOME']) {
    const v = process.env[k];
    if (v !== undefined) env[k] = v;
  }
  return env;
}

async function stopGroup(child: ChildProcess): Promise<void> {
  const pid = child.pid;
  if (pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((r) => {
    child.once('exit', () => {
      r();
    });
  });
  const kill = (sig: NodeJS.Signals): void => {
    try {
      process.kill(-pid, sig);
    } catch {
      // already gone
    }
  };
  kill('SIGTERM');
  const timer = new Promise<'timeout'>((r) => {
    setTimeout(() => {
      r('timeout');
    }, KILL_GRACE_MS);
  });
  if ((await Promise.race([exited.then(() => 'exited' as const), timer])) === 'timeout') {
    kill('SIGKILL');
    await exited;
  }
}

function runTestFile(file: string, baseUrl: string, timeoutMs: number): Promise<{ stdout: string; timedOut: boolean; exitCode: number | null }> {
  return new Promise((resolve) => {
    const env: NodeJS.ProcessEnv = { BASE_URL: baseUrl, NODE_ENV: 'test' };
    for (const k of ['PATH', 'HOME']) {
      const v = process.env[k];
      if (v !== undefined) env[k] = v;
    }
    const child = spawn(process.execPath, ['--test', '--test-reporter=tap', path.basename(file)], { cwd: path.dirname(file), env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    let stdout = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (d: string) => {
      stdout += d;
    });
    child.stderr.resume();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      void stopGroup(child);
    }, timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, timedOut, exitCode: code });
    });
  });
}

function emptyRecord(status: AcceptanceRecord['status'], files: readonly AcceptanceFileResult[], durationMs: number, message?: string): AcceptanceRecord {
  return {
    schema: ACCEPTANCE_SCHEMA,
    status,
    passed: 0,
    failed: 0,
    skipped: 0,
    errors: files.length,
    durationMs,
    testFileSha256: manifestSha256(files),
    files,
    ...(message !== undefined ? { message } : {}),
  };
}

/** Copies the snapshot outside the work tree; `node_modules` stays a symlink (never a copy). */
function copySnapshot(workDir: string, into: string): void {
  fs.cpSync(workDir, into, { recursive: true, verbatimSymlinks: true });
}

/** The acceptance runner of a plan (see the module header). */
export function acceptanceRunner(plan: AcceptancePlan, scratchRoot: string = os.tmpdir()): AcceptanceRunner {
  const testTimeout = plan.timeoutMs ?? DEFAULT_TEST_TIMEOUT_MS;
  const startTimeout = plan.startTimeoutMs ?? DEFAULT_START_TIMEOUT_MS;
  return {
    async run(input: AcceptanceInput): Promise<AcceptanceRecord> {
      const t0 = performance.now();
      const elapsed = (): number => Math.round(performance.now() - t0);
      const testFiles = acceptanceFiles(plan.testsRoot, input.taskId, input.stepIndex);
      const unrun: AcceptanceFileResult[] = testFiles.map((f) => ({ file: path.basename(f), sha256: sha256(fs.readFileSync(f)), passed: 0, failed: 0, skipped: 0, errors: 1, timedOut: false }));
      if (testFiles.length === 0) return { ...emptyRecord('no-tests', [], elapsed()), errors: 0 };
      const scratch = fs.mkdtempSync(path.join(scratchRoot, 'loop-acceptance-'));
      const dir = path.join(scratch, 'service');
      let child: ChildProcess | null = null;
      const log = input.logFile !== undefined ? (fs.mkdirSync(path.dirname(input.logFile), { recursive: true }), fs.openSync(input.logFile, 'w')) : null;
      try {
        copySnapshot(input.workDir, dir);
        const start = resolveStartCommand(dir, input.task);
        if (start === null) return emptyRecord('no-start-command', unrun, elapsed(), 'no acceptance.startCommand in the tasks file and no package.json start script');
        const port = input.task?.port ?? (await freePort());
        const vars = { port: String(port), dir };
        const deadline = performance.now() + startTimeout;
        if (input.task?.buildCommand !== undefined && input.task.buildCommand.length > 0) {
          const [cmd, ...args] = substitute(input.task.buildCommand, vars);
          const b = spawnSync(cmd ?? '', args, { cwd: dir, env: serviceEnv(port), timeout: startTimeout, stdio: ['ignore', log ?? 'ignore', log ?? 'ignore'] });
          if (b.error !== undefined || b.status !== 0) return emptyRecord('build-failed', unrun, elapsed(), b.error?.message ?? `build exited ${String(b.status)}`);
        }
        const [cmd, ...args] = substitute(start, vars);
        child = spawn(cmd ?? '', args, { cwd: dir, env: serviceEnv(port), stdio: ['ignore', log ?? 'ignore', log ?? 'ignore'], detached: true });
        child.on('error', () => undefined);
        const baseUrl = `http://127.0.0.1:${String(port)}`;
        if (!(await waitReady(`${baseUrl}${input.task?.healthPath ?? '/'}`, deadline, child))) {
          return emptyRecord('service-not-ready', unrun, elapsed(), `no HTTP answer on port ${String(port)} within ${String(startTimeout)} ms`);
        }
        const files: AcceptanceFileResult[] = [];
        for (const f of testFiles) {
          const r = await runTestFile(f, baseUrl, testTimeout);
          const s = parseTapSummary(r.stdout);
          const base = { file: path.basename(f), sha256: sha256(fs.readFileSync(f)), timedOut: r.timedOut };
          if (s === null || r.timedOut) files.push({ ...base, passed: s?.passed ?? 0, failed: s?.failed ?? 0, skipped: s?.skipped ?? 0, errors: 1 + (s?.cancelled ?? 0) });
          else files.push({ ...base, passed: s.passed, failed: s.failed, skipped: s.skipped + s.todo, errors: s.cancelled });
        }
        const sum = (k: 'passed' | 'failed' | 'skipped' | 'errors'): number => files.reduce((a, f) => a + f[k], 0);
        return {
          schema: ACCEPTANCE_SCHEMA,
          status: 'ran',
          passed: sum('passed'),
          failed: sum('failed'),
          skipped: sum('skipped'),
          errors: sum('errors'),
          durationMs: elapsed(),
          testFileSha256: manifestSha256(files),
          files,
        };
      } catch (e) {
        return emptyRecord('runner-error', unrun, elapsed(), e instanceof Error ? e.message : String(e));
      } finally {
        if (child !== null) await stopGroup(child);
        if (log !== null) fs.closeSync(log);
        fs.rmSync(scratch, { recursive: true, force: true });
      }
    },
  };
}
