/**
 * Atomic cell restart (ADR-021 SO5-04; BR-U5a-49, 50). Hand-built directory fixtures for every `recoverCell` case,
 * then grids stopped mid-cell (a harness failure after files were written, and `GEN_USAGE_LIMIT_PERSISTS` through the
 * real adapter) that resume on the next start. Fake CLI runner only; no real CLI, no network.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import {
  RESTARTS_DIR, RESTARTS_LOG, STAGING_DIR, commitCell, recoverCell, stagingDirFor,
} from '../../../../scripts/lib/generators/cell-restart.js';
import type { CellRestartRecord } from '../../../../scripts/lib/generators/cell-restart.js';
import { ClaudeCodeAdapter, runGenerationGrid } from '../../../../scripts/lib/generators/grid.js';
import { GENERATION_JSON, makeGenerationOutcome, writeGenerationJson } from '../../../../scripts/lib/generators/outcome.js';
import type { GenerationOutcome, GenerationRequest, GeneratorAdapter, GridPlan, PromptProvider } from '../../../../scripts/lib/generators/types.js';
import { FakeGeneratorRunner, MODEL, REPO, envelope, makeHarness, sourceFiles } from './fake-generator-runner.js';
import type { Harness } from './fake-generator-runner.js';

let h: Harness;
beforeEach(() => {
  h = makeHarness();
});
afterEach(() => {
  h.cleanup();
});

const RUN_ID = `${MODEL}/task-management/none/run-0`;
const AT = new Date('2026-10-08T12:00:00.000Z');
const now = (): Date => AT;

function cellDir(): string {
  return path.join(h.outRoot, ...RUN_ID.split('/'));
}

function write(file: string, text: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

function logLines(): CellRestartRecord[] {
  const f = path.join(h.outRoot, RESTARTS_LOG);
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as CellRestartRecord);
}

function outcomeFor(req: GenerationRequest, status: 'ok' | 'failed-typecheck' = 'ok'): GenerationOutcome {
  const r = makeGenerationOutcome({
    status,
    ...(status === 'failed-typecheck' ? { failureReason: 'typecheck' as const } : {}),
    adapterId: 'claude-code-cli', taskId: req.taskId, specLevel: req.specLevel, runIndex: req.runIndex, orderSeed: req.orderSeed,
    requestedModelId: req.modelId, resolvedModelId: req.modelId, auxiliaryModels: [], promptTemplateId: req.promptTemplateId,
    promptTemplateSha256: 'e'.repeat(64), promptSha256: 'f'.repeat(64), prompt: 'p', skeletonIntact: true, fileCount: 30,
    permissionDenials: 0, typecheck: { tscVersion: '5.9.3', errors: status === 'ok' ? 0 : 1 },
    attempts: [{ startedAt: '2026-10-08T00:00:00.000Z', outcome: 'completed' }], interruptions: [], treeSha: null, durationMs: 1,
    pilot: req.pilot, envelopePath: 'envelope.json',
  });
  if (!r.success) throw new Error(r.errors.map((e) => e.message).join(';'));
  return r.data;
}

describe('recoverCell (SO5-04)', () => {
  it('stagingDirFor = <outRoot>/.staging/<runId>', () => {
    expect(stagingDirFor('/o', 'm/task-management/none/run-2')).toBe('/o/.staging/m/task-management/none/run-2');
  });

  it('nothing on disk → fresh, no log; a cell with generation.json → complete, untouched', () => {
    expect(recoverCell(h.outRoot, RUN_ID, cellDir(), now)).toEqual({ kind: 'fresh' });
    expect(logLines()).toEqual([]);
    write(path.join(cellDir(), GENERATION_JSON), '{}\n');
    write(path.join(cellDir(), 'src/a.ts'), 'export {};\n');
    expect(recoverCell(h.outRoot, RUN_ID, cellDir(), now)).toEqual({ kind: 'complete' });
    expect(fs.existsSync(path.join(cellDir(), 'src/a.ts'))).toBe(true);
    expect(logLines()).toEqual([]);
  });

  it('a partial staging dir and the cell\'s interruptions → discarded whole to restarts/<runId>/0, logged', () => {
    const staging = stagingDirFor(h.outRoot, RUN_ID);
    write(path.join(staging, 'package.json'), '{}\n');
    write(path.join(staging, 'src/half.ts'), 'export const x =\n');
    write(path.join(h.outRoot, 'interruptions', ...RUN_ID.split('/'), '0', 'src/a.ts'), 'export {};\n');
    const r = recoverCell(h.outRoot, RUN_ID, cellDir(), now);
    const movedTo = `${RESTARTS_DIR}/${RUN_ID}/0`;
    expect(r).toEqual({ kind: 'discarded', movedTo, parts: ['staging', 'interruptions'] });
    expect(fs.existsSync(staging)).toBe(false);
    expect(fs.existsSync(path.join(h.outRoot, 'interruptions', ...RUN_ID.split('/')))).toBe(false);
    expect(fs.readFileSync(path.join(h.outRoot, ...movedTo.split('/'), 'staging', 'src/half.ts'), 'utf8')).toBe('export const x =\n');
    expect(fs.existsSync(path.join(h.outRoot, ...movedTo.split('/'), 'interruptions', '0', 'src/a.ts'))).toBe(true);
    expect(logLines()).toEqual([{ at: '2026-10-08T12:00:00.000Z', runId: RUN_ID, kind: 'discarded', parts: ['staging', 'interruptions'], movedTo }]);
  });

  it('a non-empty cell dir without generation.json (the old in-place harness) → discarded as "cell"; a second restart uses index 1', () => {
    write(path.join(cellDir(), 'package.json'), '{}\n');
    expect(recoverCell(h.outRoot, RUN_ID, cellDir(), now)).toMatchObject({ kind: 'discarded', parts: ['cell'], movedTo: `${RESTARTS_DIR}/${RUN_ID}/0` });
    expect(fs.existsSync(cellDir())).toBe(false);
    write(path.join(stagingDirFor(h.outRoot, RUN_ID), 'package.json'), '{}\n');
    expect(recoverCell(h.outRoot, RUN_ID, cellDir(), now)).toMatchObject({ kind: 'discarded', parts: ['staging'], movedTo: `${RESTARTS_DIR}/${RUN_ID}/1` });
    expect(logLines().map((l) => l.movedTo)).toEqual([`${RESTARTS_DIR}/${RUN_ID}/0`, `${RESTARTS_DIR}/${RUN_ID}/1`]);
  });

  it('a staging dir with a complete generation.json (stop before the rename) → promoted, its interruptions kept', () => {
    const staging = stagingDirFor(h.outRoot, RUN_ID);
    write(path.join(staging, GENERATION_JSON), '{"status":"ok"}\n');
    write(path.join(staging, 'src/a.ts'), 'export {};\n');
    const intr = path.join(h.outRoot, 'interruptions', ...RUN_ID.split('/'), '0', 'x.ts');
    write(intr, 'export {};\n');
    expect(recoverCell(h.outRoot, RUN_ID, cellDir(), now)).toEqual({ kind: 'promoted' });
    expect(fs.readFileSync(path.join(cellDir(), GENERATION_JSON), 'utf8')).toBe('{"status":"ok"}\n');
    expect(fs.existsSync(staging)).toBe(false);
    expect(fs.existsSync(intr)).toBe(true);
    expect(logLines()).toEqual([{ at: '2026-10-08T12:00:00.000Z', runId: RUN_ID, kind: 'promoted', parts: [] }]);
  });

  it('commitCell renames the staging dir onto the absent cell dir; writeGenerationJson leaves no temp file', () => {
    const staging = stagingDirFor(h.outRoot, RUN_ID);
    write(path.join(staging, 'src/a.ts'), 'export {};\n');
    commitCell(staging, cellDir());
    expect(fs.existsSync(path.join(cellDir(), 'src/a.ts'))).toBe(true);
    expect(fs.existsSync(path.join(h.outRoot, STAGING_DIR, MODEL))).toBe(true);
    const req = { runId: RUN_ID, promptTemplateId: 'none/task-management', taskId: 'task-management', modelId: MODEL, style: 's', specLevel: 'none', runIndex: 0, outputDir: cellDir(), fileRange: { min: 20, max: 100 }, orderSeed: 1, pilot: false } as const;
    writeGenerationJson(cellDir(), outcomeFor(req));
    expect(fs.readdirSync(cellDir()).sort()).toEqual([GENERATION_JSON, 'src']);
  });
});

function onePlan(outRoot: string, runs: number): GridPlan {
  return { adapters: [{ adapterId: 'claude-code-cli', modelId: MODEL }], tasks: ['task-management'], style: 'clean-architecture', levels: ['none'], runs, outRoot, orderSeed: 5 };
}

/** Writes files into its cwd; `stopAt` = the call index (0-based) that fails as a harness stop after writing. */
class StoppingAdapter implements GeneratorAdapter {
  readonly id = 'claude-code-cli';
  readonly calls: GenerationRequest[] = [];
  constructor(readonly modelId: string, private readonly stopAt: number) {}
  isAvailable(): Promise<boolean> {
    return Promise.resolve(true);
  }
  generate(req: GenerationRequest): Promise<DomainResult<GenerationOutcome>> {
    const n = this.calls.length;
    this.calls.push(req);
    write(path.join(req.outputDir, 'src/f.ts'), `export const n = ${String(n)};\n`);
    if (n === this.stopAt) return Promise.resolve(DomainResult.fail([{ code: 'GEN_USAGE_LIMIT_PERSISTS', message: 'stop' }]));
    return Promise.resolve(DomainResult.ok(outcomeFor(req)));
  }
}

describe('runGenerationGrid resumes after a mid-cell stop (SO5-04)', () => {
  it('stop in cell 2 of 3 → grid fails; restart discards the partial cell, regenerates it and finishes; no GEN_CWD_NOT_EMPTY', async () => {
    const p = onePlan(h.outRoot, 3);
    const first = new StoppingAdapter(MODEL, 1);
    const r1 = await runGenerationGrid(p, [first], { repoRoot: REPO, now });
    expect(r1.success).toBe(false);
    const done = (i: number): boolean => fs.existsSync(path.join(h.outRoot, MODEL, 'task-management', 'none', `run-${String(i)}`, GENERATION_JSON));
    expect([0, 1, 2].map(done)).toEqual([true, false, false]);
    expect(fs.existsSync(path.join(h.outRoot, MODEL, 'task-management', 'none', 'run-1'))).toBe(false);

    const second = new StoppingAdapter(MODEL, -1);
    const recovered: string[] = [];
    const r2 = await runGenerationGrid(p, [second], { repoRoot: REPO, now, onRecovery: (rec, cell) => recovered.push(`${String(cell.runIndex)}:${rec.kind}`) });
    if (!r2.success) throw new Error(r2.errors.map((e) => e.code).join(','));
    expect(r2.data).toHaveLength(3);
    expect(second.calls.map((c) => c.runIndex)).toEqual([1, 2]);
    expect(recovered).toEqual(['1:discarded']);
    expect([0, 1, 2].map(done)).toEqual([true, true, true]);
    expect(fs.readFileSync(path.join(h.outRoot, MODEL, 'task-management', 'none', 'run-1', 'src/f.ts'), 'utf8')).toBe('export const n = 0;\n');
    const runId1 = `${MODEL}/task-management/none/run-1`;
    expect(fs.readFileSync(path.join(h.outRoot, RESTARTS_DIR, ...runId1.split('/'), '0', 'staging', 'src/f.ts'), 'utf8')).toBe('export const n = 1;\n');
    expect(fs.existsSync(path.join(h.outRoot, STAGING_DIR, MODEL, 'task-management', 'none', 'run-1'))).toBe(false);
  });

  it('GEN_USAGE_LIMIT_PERSISTS through the real adapter leaves a re-prepared staging dir; the next start discards it and generates', async () => {
    const limited = { files: { 'src/partial.ts': 'export {};\n' }, stdout: 'Claude AI usage limit reached', exitCode: 1 };
    const prompts: PromptProvider = (req, cmd) => DomainResult.ok({ promptTemplateId: req.promptTemplateId, promptTemplateSha256: 'c'.repeat(64), prompt: `Build. ${cmd}`, promptSha256: 'd'.repeat(64) });
    const policy = { maxInfrastructureRetries: 2, backoffMs: [0], defaultUsagePauseMs: 0, usageResumeMarginMs: 0, maxInterruptions: 1 };
    const mk = (runner: FakeGeneratorRunner): ClaudeCodeAdapter =>
      new ClaudeCodeAdapter({ runner, config: h.config, repoRoot: REPO, install: () => h.install, prompts, parentEnv: {}, policy, clock: { now: () => 0 }, sleep: () => Promise.resolve() });
    const p = onePlan(h.outRoot, 1);
    const r1 = await runGenerationGrid(p, [mk(new FakeGeneratorRunner(h.binary, [limited, limited]))], { repoRoot: REPO, now });
    expect(r1.success ? 'ok' : r1.errors[0]?.code).toBe('GEN_USAGE_LIMIT_PERSISTS');
    const staging = stagingDirFor(h.outRoot, RUN_ID);
    expect(fs.readdirSync(staging).length).toBeGreaterThan(0);

    const runner = new FakeGeneratorRunner(h.binary, [{ files: sourceFiles(22), stdout: envelope() }]);
    const r2 = await runGenerationGrid(p, [mk(runner)], { repoRoot: REPO, now });
    if (!r2.success) throw new Error(r2.errors.map((e) => `${e.code} ${e.message}`).join(','));
    expect(r2.data[0]?.status).toBe('ok');
    expect(r2.data[0]?.interruptions).toEqual([]);
    expect(runner.cliCalls).toHaveLength(1);
    expect(fs.existsSync(path.join(cellDir(), GENERATION_JSON))).toBe(true);
    expect(logLines()).toEqual([{ at: '2026-10-08T12:00:00.000Z', runId: RUN_ID, kind: 'discarded', parts: ['staging', 'interruptions'], movedTo: `${RESTARTS_DIR}/${RUN_ID}/0` }]);
  });
});
