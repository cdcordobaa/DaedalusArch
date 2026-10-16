/**
 * The loop's acceptance-check runner (gate D12, `Docs/v1.3/acceptance-checks.md`): parsing, start-command discovery,
 * the runner on the demo reference services (and a mutilated copy), and the loop wiring (off by default).
 * No model, no Neo4j. Spawns small node services on localhost.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  acceptanceFiles,
  acceptanceRunner,
  manifestSha256,
  parseTapSummary,
  resolveStartCommand,
} from '../../../../scripts/lib/loop/acceptance.js';
import type { AcceptanceRunner } from '../../../../scripts/lib/loop/acceptance.js';
import { runLoop, runDirFor } from '../../../../scripts/lib/loop/loop.js';
import { loopRunId, validatePlan, validateTasks } from '../../../../scripts/lib/loop/plan.js';
import type { AcceptanceRecord, StepRecord } from '../../../../scripts/lib/loop/types.js';
import { DEMO_TESTS_ROOT, referenceSnapshot } from '../../../../scripts/v1.3/acceptance-demo.js';
import { context, spec, tmpRoot } from './helpers.js';

jest.setTimeout(120_000);

let scratch: string;
beforeEach(() => {
  scratch = tmpRoot('acceptance-');
});
afterEach(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
});

const runner = (over: Partial<Parameters<typeof acceptanceRunner>[0]> = {}): AcceptanceRunner =>
  acceptanceRunner({ enabled: true, testsRoot: DEMO_TESTS_ROOT, startTimeoutMs: 10_000, timeoutMs: 30_000, ...over }, scratch);

describe('acceptance runner: pure parts', () => {
  it('parses the tap summary of node --test', () => {
    const out = 'TAP version 13\nok 1 - a\n1..1\n# tests 3\n# suites 0\n# pass 2\n# fail 1\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 5\n';
    expect(parseTapSummary(out)).toEqual({ passed: 2, failed: 1, skipped: 0, cancelled: 0, todo: 0 });
    expect(parseTapSummary('garbage')).toBeNull();
  });

  it('lists the test files of steps 1..k in order and hashes them order-independently', () => {
    const files = acceptanceFiles(DEMO_TESTS_ROOT, 'market-vendors', 2).map((f) => path.basename(f));
    expect(files).toEqual(['step-01.test.mjs', 'step-02.test.mjs', 'step-03.test.mjs']);
    expect(acceptanceFiles(DEMO_TESTS_ROOT, 'no-such-task', 3)).toEqual([]);
    const a = { file: 'a', sha256: '1' };
    const b = { file: 'b', sha256: '2' };
    expect(manifestSha256([a, b])).toBe(manifestSha256([b, a]));
  });

  it('takes the task start command first, then a package.json start script, else none', () => {
    const dir = path.join(scratch, 'svc');
    fs.mkdirSync(dir);
    expect(resolveStartCommand(dir, undefined)).toBeNull();
    fs.writeFileSync(path.join(dir, 'package.json'), '{ "name": "x" }');
    expect(resolveStartCommand(dir, undefined)).toBeNull();
    fs.writeFileSync(path.join(dir, 'package.json'), '{ "scripts": { "start": "node s.js" } }');
    expect(resolveStartCommand(dir, undefined)).toEqual(['npm', 'run', '--silent', 'start']);
    expect(resolveStartCommand(dir, { startCommand: ['node', 'dist/main.js'] })).toEqual(['node', 'dist/main.js']);
  });
});

describe('acceptance runner on services', () => {
  it('passes every demo test of steps 1-4 on the reference service, from outside the snapshot', async () => {
    const dir = referenceSnapshot('market-vendors', path.join(scratch, 'work'));
    const before = fs.readdirSync(dir).sort();
    const r = await runner().run({ taskId: 'market-vendors', stepIndex: 3, workDir: dir, logFile: path.join(scratch, 'logs', 'svc.log') });
    expect(r).toMatchObject({ schema: 'loop-acceptance/v1', status: 'ran', failed: 0, errors: 0 });
    expect(r.passed).toBeGreaterThan(0);
    expect(r.files.map((f) => f.file)).toEqual(['step-01.test.mjs', 'step-02.test.mjs', 'step-03.test.mjs', 'step-04.test.mjs']);
    expect(r.testFileSha256).toMatch(/^[0-9a-f]{64}$/);
    // The service ran on a copy: the snapshot is unchanged, and the scratch copy is gone.
    expect(fs.readdirSync(dir).sort()).toEqual(before);
    expect(fs.readdirSync(scratch).filter((d) => d.startsWith('loop-acceptance-'))).toEqual([]);
  });

  it('fails from the step whose route was removed onwards, and not before', async () => {
    const dir = referenceSnapshot('market-vendors', path.join(scratch, 'work'), true);
    const rs: AcceptanceRecord[] = [];
    for (let k = 0; k < 3; k++) rs.push(await runner().run({ taskId: 'market-vendors', stepIndex: k, workDir: dir }));
    expect(rs.map((r) => r.failed > 0)).toEqual([false, true, true]);
  });

  it('records no-tests, no-start-command and service-not-ready without running a test', async () => {
    const dir = path.join(scratch, 'empty');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'package.json'), '{ "name": "skeleton" }');
    expect((await runner().run({ taskId: 'no-such-task', stepIndex: 0, workDir: dir })).status).toBe('no-tests');
    const none = await runner().run({ taskId: 'market-vendors', stepIndex: 1, workDir: dir });
    expect(none).toMatchObject({ status: 'no-start-command', passed: 0, failed: 0, errors: 2 });
    const silent = await runner({ startTimeoutMs: 1_500 }).run({
      taskId: 'market-vendors',
      stepIndex: 0,
      workDir: dir,
      task: { startCommand: [process.execPath, '-e', 'setTimeout(() => {}, 60000)'] },
    });
    expect(silent).toMatchObject({ status: 'service-not-ready', passed: 0, errors: 1 });
  });
});

describe('acceptance checks in the loop', () => {
  it('writes no acceptance field unless a runner is wired (the default)', async () => {
    const r = await runLoop(context(scratch), spec('gate'));
    if (!r.success || r.data.kind !== 'completed') throw new Error('expected a completed run');
    for (const s of r.data.steps) {
      expect('acceptance' in s).toBe(false);
      for (const t of s.turns) expect('acceptance' in t.snapshot).toBe(false);
    }
  });

  it('records a check on every snapshot, and the final one on the step', async () => {
    const calls: { stepIndex: number; workDir: string; logFile?: string }[] = [];
    const fake: AcceptanceRunner = {
      run: (input) => {
        calls.push({ stepIndex: input.stepIndex, workDir: input.workDir, ...(input.logFile !== undefined ? { logFile: input.logFile } : {}) });
        return Promise.resolve({ schema: 'loop-acceptance/v1', status: 'ran', passed: calls.length, failed: 0, skipped: 0, errors: 0, durationMs: 1, testFileSha256: 'x', files: [] });
      },
    };
    const r = await runLoop(context(scratch, undefined, { acceptance: fake }), spec('gate'));
    if (!r.success || r.data.kind !== 'completed') throw new Error('expected a completed run');
    const steps: readonly StepRecord[] = r.data.steps;
    // The stub gate run has a repair turn at step 2: four snapshots, three steps.
    expect(calls.map((c) => c.stepIndex)).toEqual([0, 1, 1, 2]);
    expect(steps.map((s) => s.acceptance?.passed)).toEqual([1, 3, 4]);
    expect(steps[1]?.turns.map((t) => t.snapshot.acceptance?.passed)).toEqual([2, 3]);
    const runDir = runDirFor(scratch, loopRunId(spec('gate')));
    expect(calls.every((c) => c.workDir === path.join(runDir, 'work'))).toBe(true);
    expect(calls[2]?.logFile).toBe(path.join(runDir, 'turns', 'step-02', 'acceptance-step-02-repair.log'));
  });
});

describe('plan and tasks validation', () => {
  const base = { description: 'd', tasksFile: 't.json', outRoot: '/o', binary: '/b', harnessRoot: '/h', allowBash: false, runs: 1, orderSeed: 1, arms: ['none'], adapters: [{ adapterId: 'claude-code-cli', modelId: 'm' }], evaluatorSpec: 's.yaml' };

  it('accepts an optional acceptance block and rejects a malformed one', () => {
    expect(validatePlan(base).success).toBe(true);
    expect(validatePlan({ ...base, acceptance: { enabled: false, testsRoot: '/h/acceptance' } }).success).toBe(true);
    expect(validatePlan({ ...base, acceptance: { enabled: true, testsRoot: 'relative' } }).success).toBe(false);
    expect(validatePlan({ ...base, acceptance: { enabled: 'yes', testsRoot: '/x' } }).success).toBe(false);
  });

  it('keeps a task acceptance block when present and leaves tasks without one unchanged', () => {
    const t = validateTasks({ description: 'd', tasks: [{ id: 'a', title: 'A', steps: [{ id: 's', request: 'r' }] }] });
    expect(t.success && t.data.tasks[0]).toEqual({ id: 'a', title: 'A', steps: [{ id: 's', request: 'r' }] });
    const withA = validateTasks({ description: 'd', tasks: [{ id: 'a', title: 'A', steps: [{ id: 's', request: 'r' }], acceptance: { startCommand: ['node', 'dist/main.js'], port: 8080 } }] });
    expect(withA.success && withA.data.tasks[0]?.acceptance).toEqual({ startCommand: ['node', 'dist/main.js'], port: 8080 });
    expect(validateTasks({ description: 'd', tasks: [{ id: 'a', title: 'A', steps: [{ id: 's', request: 'r' }], acceptance: { port: 0 } }] }).success).toBe(false);
  });
});
