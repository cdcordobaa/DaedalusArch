/**
 * U5b Step 14: run harness with a fake `ProcessRunner` (FR-36; BR-U5b-45..49, 53..56, 64; exit criterion 3,
 * rejection part). No Neo4j and no CLI: the runner returns stored reports.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { ProcessResult, ProcessRunner, ProcessRunOptions } from '../../../../src/shared/interfaces/process-runner.js';
import { buildPreRegistration, PREREG_FILE } from '../../../../scripts/lib/prereg.js';
import type { PreregCheck } from '../../../../scripts/lib/prereg.js';
import type { GenerationCell, RunRecord } from '../../../../scripts/lib/report-io.js';
import { FAILURE_REASONS, genCodeOf, loadSo5Codes, parseSo5Codes, SO5_CODES_INVALID } from '../../../../scripts/lib/so5-codes.js';
import { loadPromptTemplate } from '../../../../scripts/lib/generators/prompt.js';
import {
  cliArgv, cycleQueryTimes, E1_GENERATOR_PLAN_MISMATCH, E1_SPEC_MISMATCH, expandPlan, latencyGate, loadPlan, main, runPlan, sha256Of, validateRunRecord, relativizePaths,
} from '../../../../scripts/run-experiment.js';
import type { ExperimentPlan, HarnessDeps } from '../../../../scripts/run-experiment.js';
import { ROOT } from './score-fixture.js';

const REPORTS = join(ROOT, 'tests/fixtures/u5b/reports');
const INJECTED = join(ROOT, 'tests/fixtures/u5b/injected');
const read = (p: string): string => readFileSync(p, 'utf8');
const OK_REPORT = read(join(REPORTS, 'correct-reference.json'));
const PASS_GATE = (): PreregCheck => ({
  ok: true,
  prereg: { version: 1, registeredAt: '2026-10-01T00:00:00Z', matchingRuleVersion: '1.0.0', artefacts: [], labellingBudgetCalls: 0, e1Grid: { models: 3, specLevels: 3, tasks: 2, runs: 3 } },
  frozenHashes: { 'experiments/t/plan.json': 'a'.repeat(64) },
});

type Reply = Partial<ProcessResult> | 'spawn-fail';
class FakeRunner implements ProcessRunner {
  readonly calls: { command: string; args: readonly string[]; options: ProcessRunOptions }[] = [];
  constructor(private readonly script: (args: readonly string[], n: number) => Reply) {}
  run(command: string, args: readonly string[], options: ProcessRunOptions): ReturnType<ProcessRunner['run']> {
    this.calls.push({ command, args, options });
    const reply = this.script(args, this.calls.length);
    if (reply === 'spawn-fail') return Promise.resolve({ success: false, errors: [{ code: 'PROCESS_SPAWN_FAILED', message: 'ENOENT' }] });
    return Promise.resolve({ success: true, data: { exitCode: 0, stdout: '', stderr: '', timedOut: false, durationMs: 5, ...reply } });
  }
}

let out = '';
let envCalls = 0;
beforeEach(() => {
  out = mkdtempSync(join(tmpdir(), 'u5b-run-'));
  envCalls = 0;
});
afterEach(() => { rmSync(out, { recursive: true, force: true }); });

function deps(runner: ProcessRunner, over: Partial<HarnessDeps> = {}): HarnessDeps {
  let t = Date.parse('2026-10-08T12:00:00Z');
  return {
    runner, cli: { command: 'fake-cli', args: ['bin/firewall.ts'] }, parentEnv: { PATH: '/bin', NEO4J_PASSWORD: 'lane-secret-zz9876', SOME_TOKEN: 'never-copied' },
    now: () => new Date((t += 10)), cliCommit: 'a'.repeat(40),
    recordEnvironment: (planId) => { envCalls++; return Promise.resolve({ id: `env-${planId}`, record: { id: `env-${planId}` } }); },
    gate: PASS_GATE, outDir: out, ...over,
  };
}

const cell = (over: Partial<GenerationCell> = {}): GenerationCell => ({
  requestedModelId: 'model-a', adapterId: 'claude-code-cli', promptTemplateId: 'none/task-management', style: 'clean-architecture',
  specLevel: 'none', taskId: 'task-management', runIndex: 0, generationOutcomePath: 'gen/model-a/task-management/none/run-0/generation.json',
  generationStatus: 'ok', fileCount: 30, fileCountInRange: true, permissionDenials: 0, ...over,
});

function plan(projects: ExperimentPlan['projects'], over: Partial<ExperimentPlan> = {}): ExperimentPlan {
  return {
    id: 't', experiment: 'fixtures', mode: 'symbolic-only', seeds: { sampling: 1, bootstrap: 2, permutation: 3 },
    cassetteDir: 'experiments/t/cassettes', outDir: 'results/t', projects, ...over,
  };
}
const proj = (projectId: string, extra: Partial<ExperimentPlan['projects'][number]> = {}): ExperimentPlan['projects'][number] => ({
  projectId, path: `p/${projectId}`, specPath: 'specs/clean-arch.yaml', ...extra,
});
const projectOf = (args: readonly string[]): string => args[args.indexOf('--project') + 1] ?? '';
const records = (): RunRecord[] => readdirSync(join(out, 'runs')).sort().map((f) => JSON.parse(read(join(out, 'runs', f))) as RunRecord);

describe('run harness (BR-U5b-46..48)', () => {
  it('4 entries → accepted / rejected / not-run / incomplete; every outcome is a validated RunRecord', async () => {
    const runner = new FakeRunner((args) => {
      switch (projectOf(args)) {
        case 'p/ok': return { stdout: OK_REPORT };
        case 'p/failed': return { stdout: read(join(INJECTED, 'function-failed.json')), exitCode: 1 };
        case 'p/limit': return { exitCode: 3, stderr: 'JUDGE_RUN_INCOMPLETE: usage limit, 12 calls unissued' };
        default: throw new Error('unexpected call');
      }
    });
    const p = plan([proj('ok'), proj('failed'), proj('gen-failed', { cell: cell({ generationStatus: 'failed-typecheck', failureReason: 'typecheck' }) }), proj('limit')]);
    const r = await runPlan(p, join(ROOT, 'experiments/t/plan.json'), ROOT, deps(runner));
    expect(r.ok).toBe(true);
    expect(r.records.map((x) => [x.projectId, x.status, x.reasonCode ?? null])).toEqual([
      ['ok', 'accepted', null], ['failed', 'rejected', 'function-failed'], ['gen-failed', 'not-run', 'generation-failed'], ['limit', 'incomplete', 'usage-limit'],
    ]);
    expect(r.records[2]?.reasonDetail).toBe('GEN-TYPECHECK');
    expect(runner.calls).toHaveLength(3);
    expect(envCalls).toBe(1);
    const written = records();
    expect(written).toHaveLength(4);
    for (const rec of written) expect(validateRunRecord(rec, ROOT)).toEqual([]);
    expect(written[0]).toMatchObject({ attempt: 1, preregVersion: 1, envRecordId: 'env-t', cliCommit: 'a'.repeat(40), frozenHashes: { 'experiments/t/plan.json': 'a'.repeat(64) } });
    expect(written[0]?.specSha).toMatch(/^[0-9a-f]{64}$/);
    expect(read(join(out, written[0]?.reportPath ?? 'missing'))).toContain('"ahsDeterministic"');
  });

  it('transport error then success → accepted with attempt 2; a timeout and an EVAL_002 report are not retried', async () => {
    const flaky = new FakeRunner((_a, n) => (n === 1 ? { exitCode: 2, stderr: 'ServiceUnavailable: connect ECONNREFUSED lane-secret-zz9876' } : { stdout: OK_REPORT }));
    const r1 = await runPlan(plan([proj('a')]), 'experiments/t/plan.json', ROOT, deps(flaky));
    expect(r1.records[0]).toMatchObject({ status: 'accepted', attempt: 2 });
    expect(flaky.calls).toHaveLength(2);

    const twice = new FakeRunner(() => 'spawn-fail');
    const r2 = await runPlan(plan([proj('a')]), 'experiments/t/plan.json', ROOT, deps(twice));
    expect(r2.records[0]).toMatchObject({ status: 'rejected', reasonCode: 'transport-error', attempt: 2 });
    expect(twice.calls).toHaveLength(2);

    const slow = new FakeRunner(() => ({ timedOut: true, exitCode: -1, durationMs: 1_800_000 }));
    const r3 = await runPlan(plan([proj('a')]), 'experiments/t/plan.json', ROOT, deps(slow));
    expect(r3.records[0]).toMatchObject({ status: 'rejected', reasonCode: 'function-timeout', attempt: 1 });
    expect(slow.calls).toHaveLength(1);

    const report = JSON.parse(OK_REPORT) as { functionExecution: { failed: unknown[] } };
    report.functionExecution.failed = [{ functionId: 'FF-S02', name: 'no-cyclic-deps', code: 'EVAL_002', message: 'timeout' }];
    const eval2 = new FakeRunner(() => ({ stdout: JSON.stringify(report), exitCode: 1 }));
    const r4 = await runPlan(plan([proj('a')]), 'experiments/t/plan.json', ROOT, deps(eval2));
    expect(r4.records[0]).toMatchObject({ status: 'rejected', reasonCode: 'function-timeout', attempt: 1 });
    expect(eval2.calls).toHaveLength(1);
  });

  it('injected failed and truncated reports → function-failed, function-truncated (BR-U5b-48)', async () => {
    const runner = new FakeRunner((args) => ({ stdout: read(join(INJECTED, `${projectOf(args).slice(2)}.json`)), exitCode: 1 }));
    const r = await runPlan(plan([proj('function-failed'), proj('function-truncated')]), 'experiments/t/plan.json', ROOT, deps(runner));
    expect(r.records.map((x) => [x.status, x.reasonCode])).toEqual([['rejected', 'function-failed'], ['rejected', 'function-truncated']]);
  });

  it('the CLI child gets the allow-listed environment only and judge plans carry the cassette dir (BR-U5b-55, 56)', async () => {
    const runner = new FakeRunner(() => ({ stdout: OK_REPORT }));
    const full = plan([proj('a')], { id: 'e7-x', experiment: 'E7', mode: 'full', judge: { provider: 'claude-cli', model: 'claude-opus-5-5' }, cassetteDir: 'experiments/e7-x/cassettes' });
    await runPlan(full, 'experiments/e7-x/plan.json', ROOT, deps(runner, { gate: () => ({ ...(PASS_GATE() as Extract<PreregCheck, { ok: true }>) }) }));
    const call = runner.calls[0];
    expect(call?.args).toEqual(expect.arrayContaining(['--cassette-dir', 'experiments/e7-x/cassettes']));
    expect(call?.args.slice(call.args.indexOf('--cassette-dir'), call.args.indexOf('--cassette-dir') + 2)).toEqual(['--cassette-dir', 'experiments/e7-x/cassettes']);
    expect(call?.args).toEqual(expect.arrayContaining(['--llm-provider', 'claude-cli', '--llm-model', 'claude-opus-5-5']));
    expect(call?.args[0]).toBe('bin/firewall.ts');
    expect(Object.keys(call?.options.env ?? {}).sort()).toEqual(['NEO4J_PASSWORD', 'PATH']);
    expect(cliArgv(plan([proj('a')]), { index: 0, projectId: 'a', path: 'p/a', specPath: 's.yaml' })).toEqual(['evaluate', '--project', 'p/a', '--spec', 's.yaml', '--format', 'json', '--symbolic-only', '--instrument', 'v2']);
    expect(cliArgv(plan([proj('a')]), { index: 0, projectId: 'a', path: 'p/a', specPath: 's.yaml' }, 1).slice(-2)).toEqual(['--instrument', 'v1']); // ADR-026
  });

  it('every written artefact is scrubbed of the known secrets (BR-U5b-70)', async () => {
    const runner = new FakeRunner(() => ({ exitCode: 2, stderr: 'auth failed for bolt://neo4j:lane-secret-zz9876@localhost:7692 lane-secret-zz9876' }));
    await runPlan(plan([proj('a')]), 'experiments/t/plan.json', ROOT, deps(runner));
    const text = read(join(out, 'runs', readdirSync(join(out, 'runs'))[0] ?? ''));
    expect(text).toContain('transport-error');
    expect(text).not.toContain('lane-secret-zz9876');
  });
});

describe('E1 cells (BR-U5b-53, 54, 64)', () => {
  it('an E1 plan whose entries of one task carry different evaluator specSha is refused', () => {
    const p = plan([
      proj('c0', { cell: cell(), specPath: 'specs/clean-arch.yaml' }),
      proj('c1', { cell: cell({ specLevel: 'full-aac' }), specPath: 'specs/daedalus-arch.yaml' }),
    ], { experiment: 'E1' });
    expect(expandPlan(p, ROOT)).toMatchObject({ ok: false, code: E1_SPEC_MISMATCH });
  });

  it('every U5a failureReason maps to exactly one GEN code from the analysis-plan block; ok carries none', () => {
    const codes = loadSo5Codes(ROOT);
    if (!codes.ok) throw new Error(codes.detail);
    expect(Object.fromEntries(FAILURE_REASONS.map((f) => [f, genCodeOf(codes.codes, 'failed-agent', f)]))).toEqual({
      typecheck: 'GEN-TYPECHECK', 'agent-error': 'GEN-AGENT-ERROR', 'model-mismatch': 'GEN-MODEL-MISMATCH',
      'skeleton-tampered': 'GEN-SKELETON-TAMPERED', infrastructure: 'GEN-INFRA', 'envelope-unreadable': 'GEN-ENVELOPE-UNREADABLE', timeout: 'GEN-TIMEOUT',
    });
    expect(new Set(Object.values(codes.codes.genCodes)).size).toBe(7);
    expect(genCodeOf(codes.codes, 'ok', undefined)).toBeUndefined();
  });

  it('an ok cell with 15 files is run and flagged, never discarded', async () => {
    const runner = new FakeRunner(() => ({ stdout: OK_REPORT }));
    const r = await runPlan(plan([proj('g', { cell: cell({ fileCount: 15, fileCountInRange: false }) })], { experiment: 'E1' }), 'experiments/t/plan.json', ROOT, deps(runner));
    expect(runner.calls).toHaveLength(1);
    expect(r.records[0]).toMatchObject({ status: 'accepted', cell: { fileCount: 15, fileCountInRange: false } });
  });

  it('a grid entry is joined to U5a generation.json under U5a field names', async () => {
    const e = e1Repo(2);
    try {
      e.outcome(0, {});
      e.outcome(1, { status: 'failed-agent', failureReason: 'timeout' });
      const runner = new FakeRunner(() => ({ stdout: OK_REPORT }));
      const r = await runPlan(e.plan, 'experiments/t/plan.json', e.root, deps(runner, { schemaRoot: ROOT, gate: e.gate }));
      expect(r.records.map((x) => [x.status, x.reasonDetail ?? null])).toEqual([['accepted', null], ['not-run', 'GEN-TIMEOUT']]);
      expect(r.records[0]?.cell).toEqual({
        requestedModelId: 'm1', resolvedModelId: 'm1-2026', adapterId: 'claude-code-cli', promptTemplateId: 'none/task-management', style: 'clean-architecture',
        specLevel: 'none', taskId: 'task-management', runIndex: 0, generationOutcomePath: 'gen/m1/task-management/none/run-0/generation.json',
        generationStatus: 'ok', fileCount: 25, fileCountInRange: true, permissionDenials: 2, loc: 0,
      });
      expect(runner.calls).toHaveLength(1);
    } finally {
      e.cleanup();
    }
  });

  it('ADR-021 SO5-07, X-3: a joined cell carries the LOC of its src/**/*.ts tree and the generation effort', async () => {
    // Hand-computed: src/a.ts "x\n\n  y\n" → 2 non-blank lines; src/b/c.ts "z" → 1; src/d.js and src/node_modules/e.ts
    // are not counted → loc 3. generation.json durationMs 159340.5; envelope num_turns 43, total_cost_usd 0.6668696.
    // Run 1 has no envelope: only the duration is kept.
    const e = e1Repo(2);
    try {
      e.outcome(0, { durationMs: 159340.5, envelopePath: 'envelope.json' });
      e.outcome(1, { durationMs: 1000 });
      const dir = join(e.root, 'gen/m1/task-management/none/run-0');
      mkdirSync(join(dir, 'src/b'), { recursive: true });
      mkdirSync(join(dir, 'src/node_modules'), { recursive: true });
      writeFileSync(join(dir, 'src/a.ts'), 'x\n\n  y\n');
      writeFileSync(join(dir, 'src/b/c.ts'), 'z');
      writeFileSync(join(dir, 'src/d.js'), 'q\nq\n');
      writeFileSync(join(dir, 'src/node_modules/e.ts'), 'q\n');
      writeFileSync(join(dir, 'envelope.json'), JSON.stringify({ num_turns: 43, total_cost_usd: 0.6668696, duration_ms: 158326 }));
      const runner = new FakeRunner(() => ({ stdout: OK_REPORT }));
      const r = await runPlan(e.plan, 'experiments/t/plan.json', e.root, deps(runner, { schemaRoot: ROOT, gate: e.gate }));
      expect(r.records[0]?.cell).toMatchObject({ loc: 3, generationDurationMs: 159340.5, numTurns: 43, totalCostUsd: 0.6668696 });
      expect(r.records[1]?.cell).toMatchObject({ loc: 0, generationDurationMs: 1000 });
      expect(r.records[1]?.cell?.numTurns).toBeUndefined();
      for (const rec of records()) expect(validateRunRecord(rec, ROOT)).toEqual([]);
    } finally {
      e.cleanup();
    }
  });
});

/**
 * ADR-021 SO5-03 / SO5-05: an E1 temp repository with a registered generator plan (`experiments/t/generator-plan.json`),
 * the committed templates, and `gen/schedule.json` written from that plan. `outcome(i, over)` writes run i's
 * generation.json with the registered protocol fields (orderSeed 20261008, pilot false, real template sha).
 */
function e1Repo(runs: number, genOver: Record<string, unknown> = {}): {
  root: string; plan: ExperimentPlan; gate: () => PreregCheck; outcome: (i: number, over: Record<string, unknown>) => void;
  schedule: (over: Record<string, unknown>) => void; cleanup: () => void;
} {
  const root = mkdtempSync(join(tmpdir(), 'u5b-e1-'));
  for (const f of ['specs/clean-arch.yaml', 'Docs/analysis-plan.md', 'scripts/generator/prompts/none.md']) {
    mkdirSync(dirname(join(root, f)), { recursive: true });
    copyFileSync(join(ROOT, f), join(root, f));
  }
  const genPlan = {
    adapters: [{ adapterId: 'claude-code-cli', modelId: 'm1' }], tasks: ['task-management'], style: 'clean-architecture', levels: ['none'],
    runs, orderSeed: 20261008, outRoot: 'gen', binary: '<local>', harnessRoot: '<local>', timeoutMs: 1200000, allowBash: true, ...genOver,
  };
  mkdirSync(join(root, 'experiments/t'), { recursive: true });
  writeFileSync(join(root, 'experiments/t/generator-plan.json'), JSON.stringify(genPlan));
  const genSha = sha256Of(join(root, 'experiments/t/generator-plan.json'));
  const schedule = (over: Record<string, unknown>): void => {
    mkdirSync(join(root, 'gen'), { recursive: true });
    writeFileSync(join(root, 'gen/schedule.json'), JSON.stringify({ orderSeed: 20261008, runs, generatorPlan: { path: 'experiments/t/generator-plan.json', sha256: genSha }, cells: [], ...over }));
  };
  schedule({});
  const t = loadPromptTemplate(root, 'none', 'task-management');
  if (!t.success) throw new Error('template');
  const outcome = (i: number, over: Record<string, unknown>): void => {
    const dir = join(root, `gen/m1/task-management/none/run-${String(i)}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'generation.json'), JSON.stringify({
      status: 'ok', adapterId: 'claude-code-cli', taskId: 'task-management', specLevel: 'none', runIndex: i, requestedModelId: 'm1',
      resolvedModelId: 'm1-2026', promptTemplateId: 'none/task-management', promptTemplateSha256: t.data.promptTemplateSha256,
      orderSeed: 20261008, pilot: false, fileCount: 25, fileCountInRange: true, permissionDenials: 2, ...over,
    }));
  };
  const p = plan([], {
    experiment: 'E1', e1: { outcomesRoot: 'gen', style: 'clean-architecture', models: ['m1'], specLevels: ['none'], tasks: [{ taskId: 'task-management', specPath: 'specs/clean-arch.yaml' }], runs },
  });
  const gate = (): PreregCheck => {
    const g = PASS_GATE();
    return g.ok ? { ...g, frozenHashes: { ...g.frozenHashes, 'experiments/t/generator-plan.json': genSha } } : g;
  };
  return { root, plan: p, gate, outcome, schedule, cleanup: () => { rmSync(root, { recursive: true, force: true }); } };
}

describe('E1 registered generator plan and missing cells (ADR-021 SO5-03, SO5-05)', () => {
  it('SO5-05: a coordinate without generation.json is a not-run GEN-MISSING record with a missing cell; 3 coordinates → 3 cells', async () => {
    const e = e1Repo(3);
    try {
      e.outcome(0, {});
      e.outcome(2, { status: 'failed-typecheck', failureReason: 'typecheck' });
      const runner = new FakeRunner(() => ({ stdout: OK_REPORT }));
      const r = await runPlan(e.plan, 'experiments/t/plan.json', e.root, deps(runner, { schemaRoot: ROOT, gate: e.gate }));
      expect(r.records.map((x) => [x.projectId, x.status, x.reasonDetail?.split(':')[0] ?? null])).toEqual([
        ['m1/task-management/none/run-0', 'accepted', null],
        ['m1/task-management/none/run-1', 'not-run', 'GEN-MISSING'],
        ['m1/task-management/none/run-2', 'not-run', 'GEN-TYPECHECK'],
      ]);
      expect(r.records[1]?.cell).toEqual({
        requestedModelId: 'm1', adapterId: 'claude-code-cli', promptTemplateId: 'none/task-management', style: 'clean-architecture',
        specLevel: 'none', taskId: 'task-management', runIndex: 1, generationOutcomePath: 'gen/m1/task-management/none/run-1/generation.json',
        generationStatus: 'missing', fileCount: 0, fileCountInRange: false, permissionDenials: 0,
      });
      expect(r.records.every((x) => x.cell !== undefined)).toBe(true);
      for (const rec of records()) expect(validateRunRecord(rec, ROOT)).toEqual([]);
      expect(runner.calls).toHaveLength(1);
    } finally {
      e.cleanup();
    }
  });

  it('SO5-03: an outcome off the registered protocol is a not-run GEN-PROTOCOL-MISMATCH cell naming the field', async () => {
    const e = e1Repo(3);
    try {
      e.outcome(0, { orderSeed: 0 });
      e.outcome(1, { pilot: true });
      e.outcome(2, { promptTemplateSha256: 'a'.repeat(64), status: 'failed-agent', failureReason: 'timeout' });
      const runner = new FakeRunner(() => { throw new Error('must not run'); });
      const r = await runPlan(e.plan, 'experiments/t/plan.json', e.root, deps(runner, { schemaRoot: ROOT, gate: e.gate }));
      expect(r.records.map((x) => x.status)).toEqual(['not-run', 'not-run', 'not-run']);
      expect(r.records[0]?.reasonDetail).toMatch(/^GEN-PROTOCOL-MISMATCH: .*orderSeed 0 != 20261008/);
      expect(r.records[1]?.reasonDetail).toMatch(/pilot true != false/);
      expect(r.records[2]?.reasonDetail).toMatch(/promptTemplateSha256/);
      expect(r.records[2]?.cell).toMatchObject({ generationStatus: 'protocol-mismatch', fileCount: 25 });
      expect(r.records[2]?.cell?.failureReason).toBeUndefined();
      expect(runner.calls).toHaveLength(0);
    } finally {
      e.cleanup();
    }
  });

  it('SO5-03/SO5-05: an outcome declaring another task, model or run is a mismatch cell at its directory\'s own coordinate', async () => {
    // Hand-computed: run-0 declares task order-fulfilment (and its template id), run-1 declares model m9, run-2
    // declares run 0. Each is GEN-PROTOCOL-MISMATCH naming the field; each cell carries the grid coordinate
    // (m1 / task-management / none / its own run, template none/task-management) and the outcome's counts (25, true, 2).
    const e = e1Repo(3);
    try {
      e.outcome(0, { taskId: 'order-fulfilment', promptTemplateId: 'none/order-fulfilment' });
      e.outcome(1, { requestedModelId: 'm9', resolvedModelId: 'm9-2026', adapterId: 'other-cli' });
      e.outcome(2, { runIndex: 0 });
      const runner = new FakeRunner(() => { throw new Error('must not run'); });
      const r = await runPlan(e.plan, 'experiments/t/plan.json', e.root, deps(runner, { schemaRoot: ROOT, gate: e.gate }));
      expect(r.records).toHaveLength(3);
      expect(r.records[0]?.reasonDetail).toMatch(/^GEN-PROTOCOL-MISMATCH: .*taskId "order-fulfilment" != "task-management"/);
      expect(r.records[1]?.reasonDetail).toMatch(/requestedModelId "m9" != "m1"/);
      expect(r.records[2]?.reasonDetail).toMatch(/runIndex 0 != 2/);
      r.records.forEach((rec, i) => {
        expect(rec.projectId).toBe(`m1/task-management/none/run-${String(i)}`);
        expect(rec.cell).toEqual({
          requestedModelId: 'm1', adapterId: 'claude-code-cli', promptTemplateId: 'none/task-management', style: 'clean-architecture',
          specLevel: 'none', taskId: 'task-management', runIndex: i, generationOutcomePath: `gen/m1/task-management/none/run-${String(i)}/generation.json`,
          generationStatus: 'protocol-mismatch', fileCount: 25, fileCountInRange: true, permissionDenials: 2,
        });
      });
      for (const rec of records()) expect(validateRunRecord(rec, ROOT)).toEqual([]);
      expect(runner.calls).toHaveLength(0);
    } finally {
      e.cleanup();
    }
  });

  it('SO5-03: a schedule.json from another plan or seed marks every present outcome as a protocol mismatch', async () => {
    const e = e1Repo(1);
    try {
      e.outcome(0, {});
      e.schedule({ generatorPlan: { path: 'scratch.json', sha256: 'b'.repeat(64) } });
      const r1 = await runPlan(e.plan, 'experiments/t/plan.json', e.root, deps(new FakeRunner(() => ({ stdout: OK_REPORT })), { schemaRoot: ROOT, gate: e.gate }));
      expect(r1.records[0]?.reasonDetail).toMatch(/schedule\.json was not written from the registered experiments\/t\/generator-plan\.json/);
      e.schedule({ orderSeed: 0 });
      const r2 = await runPlan(e.plan, 'experiments/t/plan.json', e.root, deps(new FakeRunner(() => ({ stdout: OK_REPORT })), { schemaRoot: ROOT, gate: e.gate }));
      expect(r2.records[0]?.reasonDetail).toMatch(/schedule\.json orderSeed 0 != 20261008/);
    } finally {
      e.cleanup();
    }
  });

  it('SO5-03: an unregistered generator plan is a prereg refusal; one that differs from the e1 block is refused', async () => {
    const e = e1Repo(2);
    try {
      const runner = new FakeRunner(() => { throw new Error('must not run'); });
      const r = await runPlan(e.plan, 'experiments/t/plan.json', e.root, deps(runner, { schemaRoot: ROOT }));
      expect(r).toMatchObject({ ok: false, code: 'PREREG_REFUSED' });
      expect(r.records.map((x) => [x.status, x.reasonCode])).toEqual([['rejected', 'prereg-refused'], ['rejected', 'prereg-refused']]);
      expect(r.records[0]?.reasonDetail).toMatch(/^plan-unregistered: E1 generator plan experiments\/t\/generator-plan\.json/);
    } finally {
      e.cleanup();
    }
    const f = e1Repo(2, { runs: 3 });
    try {
      const r = await runPlan(f.plan, 'experiments/t/plan.json', f.root, deps(new FakeRunner(() => ({ stdout: OK_REPORT })), { schemaRoot: ROOT, gate: f.gate }));
      expect(r).toMatchObject({ ok: false, code: E1_GENERATOR_PLAN_MISMATCH });
      expect(r.detail).toContain('runs');
      expect(r.records).toHaveLength(0);
    } finally {
      f.cleanup();
    }
  });
});

describe('committed results carry no absolute path', () => {
  it('relativizePaths strips the repository root and maps its parent to ../ in every string, deep; other values unchanged', () => {
    const repo = '/abs/work/DaedalusArch';
    const v = {
      projectPath: '../daedalus-corpus/g',
      warnings: [{ message: 'CONSTRUCTOR_INJECTS type unresolvable: import("/abs/work/daedalus-corpus/g/src/x").X' }, { message: 'see /abs/work/DaedalusArch/specs/a.yaml' }],
      n: 3, ok: true, none: null,
    };
    expect(relativizePaths(v, repo)).toEqual({
      projectPath: '../daedalus-corpus/g',
      warnings: [{ message: 'CONSTRUCTOR_INJECTS type unresolvable: import("../daedalus-corpus/g/src/x").X' }, { message: 'see specs/a.yaml' }],
      n: 3, ok: true, none: null,
    });
    expect(relativizePaths('/abs/workother/x', repo)).toBe('/abs/workother/x');
  });
});

describe('latency gate (BR-U5b-49)', () => {
  it('31 s → fallback-required; 12 s → pass; a function timeout → fallback-required', () => {
    expect(latencyGate([31_000])).toBe('fallback-required');
    expect(latencyGate([12_000])).toBe('pass');
    expect(latencyGate([12_000, 30_000])).toBe('pass');
    expect(latencyGate([], true)).toBe('fallback-required');
    expect(cycleQueryTimes(JSON.parse(OK_REPORT) as Parameters<typeof cycleQueryTimes>[0])).toHaveLength(1);
  });
});

describe('records, gate order and CLI modes', () => {
  it('a RunRecord validates against run-record.schema.json; a rejected record without reasonCode does not', () => {
    const rec = JSON.parse(read(join(REPORTS, 'correct-reference.run.json'))) as Record<string, unknown>;
    expect(validateRunRecord(rec, ROOT)).toEqual([]);
    expect(validateRunRecord({ ...rec, status: 'rejected' }, ROOT)).not.toEqual([]);
    expect(validateRunRecord({ ...rec, attempt: 3 }, ROOT)).not.toEqual([]);
  });

  it('the pre-registration gate runs first: a refusal writes prereg-refused records and starts nothing', async () => {
    const runner = new FakeRunner(() => { throw new Error('must not run'); });
    const r = await runPlan(plan([proj('a'), proj('b')]), 'experiments/t/plan.json', ROOT, deps(runner, {
      gate: () => ({ ok: false, code: 'PREREG_REFUSED', refusal: 'artefact-changed', detail: 'registered artefact Docs/matching-rule.md changed' }),
    }));
    expect(r.ok).toBe(false);
    expect(r.records.map((x) => [x.status, x.reasonCode])).toEqual([['rejected', 'prereg-refused'], ['rejected', 'prereg-refused']]);
    expect(runner.calls).toHaveLength(0);
    expect(envCalls).toBe(0);
  });

  it('--dry-run on a fixture E1 plan prints 54 cells and never calls the runner', async () => {
    let text = '';
    const code = await main(['--dry-run', 'tests/fixtures/u5b/plans/e1-dry-run.json'], ROOT, { out: (t) => { text += t; }, err: (t) => { text += t; } }, () => { throw new Error('no deps in a dry run'); });
    expect(code).toBe(0);
    const lines = text.trim().split('\n');
    expect(lines.at(-1)).toBe('54 entries');
    expect(new Set(lines.slice(0, -1).map((l) => l.split('\t')[0])).size).toBe(54);
    expect(existsSyncSafe(join(ROOT, 'results/e1-dry-run'))).toBe(false);
  });

  it('--check-prereg exits 0 on a valid temp registration and 1 after one changed byte', async () => {
    const repo = mkdtempSync(join(tmpdir(), 'u5b-check-'));
    const g = (...args: string[]): void => { execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd: repo, env: { ...process.env, GIT_COMMITTER_DATE: '1700000000 +0000', GIT_AUTHOR_DATE: '1700000000 +0000' } }); };
    try {
      const put = (rel: string, text: string): void => { mkdirSync(dirname(join(repo, rel)), { recursive: true }); writeFileSync(join(repo, rel), text); };
      put('Docs/matching-rule.md', '# rule\n');
      put('specs/clean-arch.yaml', read(join(ROOT, 'specs/clean-arch.yaml')));
      put('experiments/fx/plan.json', JSON.stringify(plan([proj('a')], { id: 'fx', cassetteDir: 'experiments/fx/cassettes', outDir: 'results/fx' })));
      g('init', '-q');
      g('add', '-A');
      g('commit', '-q', '-m', 'a');
      put(PREREG_FILE, JSON.stringify(buildPreRegistration(repo, { version: 1, registeredAt: '2023-11-14T22:13:20Z', matchingRuleVersion: '1.0.0', labellingBudgetCalls: 0 })));
      g('add', '-A');
      g('commit', '-q', '-m', 'p');
      const io = { out: () => undefined, err: () => undefined };
      const noDeps = (): HarnessDeps => { throw new Error('gate only'); };
      expect(await main(['--check-prereg', 'experiments/fx/plan.json'], repo, io, noDeps, ROOT)).toBe(0);
      put('Docs/matching-rule.md', '# rulE\n');
      expect(await main(['--check-prereg', 'experiments/fx/plan.json'], repo, io, noDeps, ROOT)).toBe(1);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('SO5 block missing → refused with the file named; the run starts nothing', async () => {
    const refused = parseSo5Codes('# Analysis plan\n\nno block\n');
    expect(refused).toMatchObject({ ok: false, code: SO5_CODES_INVALID });
    if (!refused.ok) expect(refused.detail).toContain('Docs/analysis-plan.md');
    expect(parseSo5Codes('```yaml so5-codes\nversion: 1.0.0\nfpatFamilies: [FPAT-CYCLE]\n```\n')).toMatchObject({ ok: false });
    const root = mkdtempSync(join(tmpdir(), 'u5b-noso5-'));
    try {
      mkdirSync(join(root, 'specs'));
      copyFileSync(join(ROOT, 'specs/clean-arch.yaml'), join(root, 'specs/clean-arch.yaml'));
      const runner = new FakeRunner(() => { throw new Error('must not run'); });
      const r = await runPlan(plan([proj('a')]), 'experiments/t/plan.json', root, deps(runner, { schemaRoot: ROOT }));
      expect(r).toMatchObject({ ok: false, code: SO5_CODES_INVALID });
      expect(runner.calls).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('plan files: the fixture E1 plan validates; a wrong cassette dir is refused', () => {
    expect(loadPlan(join(ROOT, 'tests/fixtures/u5b/plans/e1-dry-run.json'), ROOT).ok).toBe(true);
    const bad = join(out, 'bad.json');
    writeFileSync(bad, JSON.stringify(plan([proj('a')], { cassetteDir: 'experiments/other/cassettes' })));
    expect(loadPlan(bad, ROOT)).toMatchObject({ ok: false });
  });
});

function existsSyncSafe(p: string): boolean {
  try {
    readdirSync(p);
    return true;
  } catch {
    return false;
  }
}
