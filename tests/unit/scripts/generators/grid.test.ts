/**
 * Grid schedule, adapter, CLI main (U5a plan Step 22; Q16; ADR-017 item 3; BR-U5a-49, 51; D-U5a-13). Fake CLI
 * runner and fake adapters; no real CLI, no network.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import { buildGeneratorArgs, typecheckCommand } from '../../../../scripts/lib/generators/argv.js';
import { GENERATOR_ENV_ALLOW } from '../../../../scripts/lib/generators/env.js';
import { main } from '../../../../scripts/lib/generators/generate-main.js';
import type { GenerateMainDeps } from '../../../../scripts/lib/generators/generate-main.js';
import { ClaudeCodeAdapter, runGenerationGrid } from '../../../../scripts/lib/generators/grid.js';
import { GENERATION_JSON, makeGenerationOutcome } from '../../../../scripts/lib/generators/outcome.js';
import { SCHEDULE_JSON, cellOutputDir, requestForCell, scheduleGrid, validateGridPlan } from '../../../../scripts/lib/generators/schedule.js';
import type {
  GenerationOutcome,
  GenerationRequest,
  GeneratorAdapter,
  GridPlan,
  PromptProvider,
} from '../../../../scripts/lib/generators/types.js';
import { FakeGeneratorRunner, MODEL, REPO, envelope, makeHarness, request, sourceFiles } from './fake-generator-runner.js';
import type { Harness } from './fake-generator-runner.js';

let h: Harness;
beforeEach(() => {
  h = makeHarness();
});
afterEach(() => {
  h.cleanup();
});

function plan54(orderSeed: number): GridPlan {
  return {
    adapters: ['model-one', 'model-two', 'model-three'].map((modelId) => ({ adapterId: 'claude-code-cli' as const, modelId })),
    tasks: ['task-management', 'order-fulfilment'],
    style: 'clean-architecture',
    levels: ['none', 'minimal-prose', 'full-aac'],
    runs: 3,
    outRoot: '/tmp/u5a-grid-out',
    orderSeed,
  };
}

const key = (c: { modelId: string; taskId: string; specLevel: string }): string => `${c.modelId}|${c.taskId}|${c.specLevel}`;

const prompts: PromptProvider = (req, cmd) =>
  DomainResult.ok({
    promptTemplateId: req.promptTemplateId,
    promptTemplateSha256: 'c'.repeat(64),
    prompt: `Build ${req.taskId}. Type-check with: ${cmd}`,
    promptSha256: 'd'.repeat(64),
  });

describe('scheduleGrid (BR-U5a-51)', () => {
  it('a 54-cell plan yields 3 blocks of 18, each a permutation of the same 18 cells, deterministic per orderSeed', () => {
    const cells = scheduleGrid(plan54(20261008));
    expect(cells).toHaveLength(54);
    const blocks = [0, 1, 2].map((r) => cells.filter((c) => c.blockIndex === r));
    for (const [r, b] of blocks.entries()) {
      expect(b).toHaveLength(18);
      expect(b.every((c) => c.runIndex === r)).toBe(true);
      expect(b.map((c) => c.positionInBlock)).toEqual([...Array(18).keys()]);
      expect(new Set(b.map(key)).size).toBe(18);
      expect([...b.map(key)].sort()).toEqual([...(blocks[0] ?? []).map(key)].sort());
    }
    expect(cells.slice(0, 18).every((c) => c.blockIndex === 0) && cells.slice(36).every((c) => c.blockIndex === 2)).toBe(true);
    expect(scheduleGrid(plan54(20261008)).map(key)).toEqual(cells.map(key));
    expect(scheduleGrid(plan54(7)).map(key)).not.toEqual(cells.map(key));
    expect((blocks[0] ?? []).map(key)).not.toEqual((blocks[1] ?? []).map(key));
  });

  it('output path <outRoot>/<modelId>/<taskId>/<specLevel>/run-<i>/ and the request fields', () => {
    const p = plan54(1);
    const cell = scheduleGrid(p)[0];
    if (cell === undefined) throw new Error('no cell');
    expect(cellOutputDir('/o', { modelId: 'm', taskId: 'order-fulfilment', specLevel: 'full-aac', runIndex: 2 })).toBe('/o/m/order-fulfilment/full-aac/run-2');
    const req = requestForCell(p, cell);
    expect(req.outputDir).toBe(path.join(p.outRoot, cell.modelId, cell.taskId, cell.specLevel, 'run-0'));
    expect(req.runId).toBe(`${cell.modelId}/${cell.taskId}/${cell.specLevel}/run-0`);
    expect(req.promptTemplateId).toBe(`${cell.specLevel}/${cell.taskId}`);
    expect(req.orderSeed).toBe(1);
    expect(req.pilot).toBe(false);
  });

  it('validateGridPlan refuses duplicate model ids, runs < 1, a bad seed, unknown levels and an outRoot inside the repo', () => {
    const p = plan54(1);
    expect(validateGridPlan(p, REPO).success).toBe(true);
    const codes = (q: GridPlan): number => {
      const r = validateGridPlan(q, REPO);
      return r.success ? 0 : r.errors.length;
    };
    expect(codes({ ...p, adapters: [...p.adapters, { adapterId: 'claude-code-cli', modelId: 'model-one' }] })).toBeGreaterThan(0);
    expect(codes({ ...p, runs: 0 })).toBeGreaterThan(0);
    expect(codes({ ...p, orderSeed: -1 })).toBeGreaterThan(0);
    expect(codes({ ...p, levels: ['none', 'none'] })).toBeGreaterThan(0);
    expect(codes({ ...p, outRoot: path.join(REPO, 'out') })).toBeGreaterThan(0);
  });
});

/** A fake adapter: run `forceFail` ends `failed-typecheck`, every other run `ok`. */
class FakeAdapter implements GeneratorAdapter {
  readonly id = 'claude-code-cli';
  readonly calls: GenerationRequest[] = [];
  constructor(
    readonly modelId: string,
    private readonly forceFail: number,
  ) {}
  isAvailable(): Promise<boolean> {
    return Promise.resolve(true);
  }
  generate(req: GenerationRequest): Promise<DomainResult<GenerationOutcome>> {
    this.calls.push(req);
    fs.mkdirSync(req.outputDir, { recursive: true });
    const failed = req.runIndex === this.forceFail;
    return Promise.resolve(
      makeGenerationOutcome({
        status: failed ? 'failed-typecheck' : 'ok',
        ...(failed ? { failureReason: 'typecheck' as const } : {}),
        adapterId: this.id,
        taskId: req.taskId,
        specLevel: req.specLevel,
        runIndex: req.runIndex,
        orderSeed: req.orderSeed,
        requestedModelId: req.modelId,
        resolvedModelId: req.modelId,
        auxiliaryModels: [],
        promptTemplateId: req.promptTemplateId,
        promptTemplateSha256: 'e'.repeat(64),
        promptSha256: 'f'.repeat(64),
        prompt: 'p',
        skeletonIntact: true,
        fileCount: 30,
        permissionDenials: 0,
        typecheck: { tscVersion: '5.9.3', errors: failed ? 3 : 0 },
        attempts: [{ startedAt: '2026-10-08T00:00:00.000Z', outcome: 'completed' }],
        interruptions: [],
        treeSha: null,
        durationMs: 1,
        pilot: req.pilot,
        envelopePath: 'envelope.json',
      }),
    );
  }
}

function onePlan(outRoot: string, runs = 3): GridPlan {
  return {
    adapters: [{ adapterId: 'claude-code-cli', modelId: MODEL }],
    tasks: ['task-management'],
    style: 'clean-architecture',
    levels: ['none'],
    runs,
    outRoot,
    orderSeed: 99,
  };
}

describe('runGenerationGrid (BR-U5a-49)', () => {
  it('a 3-run grid with one forced failed-typecheck writes three generation.json (one failed-typecheck) and no fourth run', async () => {
    const adapter = new FakeAdapter(MODEL, 1);
    const p = onePlan(h.outRoot);
    const r = await runGenerationGrid(p, [adapter], { repoRoot: REPO });
    expect(r.success).toBe(true);
    expect(adapter.calls).toHaveLength(3);
    const written = [0, 1, 2].map(
      (i) => JSON.parse(fs.readFileSync(path.join(h.outRoot, MODEL, 'task-management', 'none', `run-${String(i)}`, GENERATION_JSON), 'utf8')) as GenerationOutcome,
    );
    expect(written.map((o) => o.status)).toEqual(['ok', 'failed-typecheck', 'ok']);
    expect(fs.existsSync(path.join(h.outRoot, MODEL, 'task-management', 'none', 'run-3'))).toBe(false);
    expect(JSON.parse(fs.readFileSync(path.join(h.outRoot, SCHEDULE_JSON), 'utf8'))).toMatchObject({ orderSeed: 99, runs: 3 });
    // Resume: a re-run reads the existing outcomes and generates nothing.
    const again = await runGenerationGrid(p, [adapter], { repoRoot: REPO });
    expect(again.success && again.data.length).toBe(3);
    expect(adapter.calls).toHaveLength(3);
  });

  it('one adapter per pinned model id is required', async () => {
    const r = await runGenerationGrid({ ...onePlan(h.outRoot), adapters: [{ adapterId: 'claude-code-cli', modelId: 'other-model' }] }, [new FakeAdapter(MODEL, -1)]);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors[0]?.code).toBe('GEN_ADAPTER_MISSING');
  });
});

describe('ClaudeCodeAdapter over ProcessRunner', () => {
  it('runs the exact argv with the allow-listed env in a fresh cwd and returns the outcome; a grid writes it', async () => {
    const runner = new FakeGeneratorRunner(h.binary, [{ files: sourceFiles(24), stdout: envelope() }]);
    const adapter = new ClaudeCodeAdapter({
      runner,
      config: h.config,
      repoRoot: REPO,
      install: () => h.install,
      prompts,
      parentEnv: { PATH: '/usr/bin', HOME: '/home/x', ANTHROPIC_API_KEY: 'not-a-real-key', GITHUB_TOKEN: 'ghp_x', NEO4J_PASSWORD: 'pw' },
    });
    const grid = await runGenerationGrid(onePlan(h.outRoot, 1), [adapter], { repoRoot: REPO });
    if (!grid.success) throw new Error(grid.errors.map((e) => e.message).join(';'));
    const req = request(h);
    expect(runner.cliCalls).toHaveLength(1);
    const call = runner.cliCalls[0];
    const p = prompts(req, typecheckCommand(h.harnessRoot, req.runId));
    if (!p.success) throw new Error('prompt');
    expect(call?.args).toEqual(buildGeneratorArgs(h.config, req, p.data.prompt));
    expect(call?.options.cwd).toBe(req.outputDir);
    expect(call?.options.timeoutMs).toBe(1_200_000);
    expect(Object.keys(call?.options.env ?? {}).sort()).toEqual(['HOME', 'PATH']);
    expect(Object.keys(call?.options.env ?? {}).every((k) => GENERATOR_ENV_ALLOW.includes(k))).toBe(true);
    const o = grid.data[0];
    expect(o?.status).toBe('ok');
    expect(o?.promptTemplateId).toBe('none/task-management');
    expect(fs.existsSync(path.join(req.outputDir, GENERATION_JSON))).toBe(true);
    expect(fs.existsSync(path.join(h.harnessRoot, 'runs', ...req.runId.split('/'), 'tsconfig.json'))).toBe(true);
  });

  it('a tampered skeleton triggers the install rebuild before the next cell', async () => {
    const runner = new FakeGeneratorRunner(h.binary, [
      { files: sourceFiles(21), stdout: envelope(), effect: (cwd) => { fs.appendFileSync(path.join(cwd, 'package.json'), ' '); } },
      { files: sourceFiles(21), stdout: envelope() },
    ]);
    const adapter = new ClaudeCodeAdapter({ runner, config: h.config, repoRoot: REPO, install: () => h.install, prompts, parentEnv: {} });
    let rebuilds = 0;
    const grid = await runGenerationGrid(onePlan(h.outRoot, 2), [adapter], {
      onSkeletonTampered: () => {
        rebuilds++;
        return Promise.resolve(DomainResult.ok(undefined));
      },
    });
    if (!grid.success) throw new Error('grid');
    expect(grid.data.map((o) => o.failureReason ?? o.status)).toEqual(['skeleton-tampered', 'ok']);
    expect(rebuilds).toBe(1);
  });

  it('isAvailable runs <binary> --version; a refused prompt or a cwd inside the repo fails the request', async () => {
    const runner = new FakeGeneratorRunner(h.binary, [{ stdout: '2.0.0 (Claude Code)' }, { spawnFails: true }]);
    const adapter = new ClaudeCodeAdapter({ runner, config: h.config, repoRoot: REPO, install: () => h.install, prompts, parentEnv: {} });
    expect(await adapter.isAvailable()).toBe(true);
    expect(runner.cliCalls[0]?.args).toEqual(['--version']);
    expect(await adapter.isAvailable()).toBe(false);
    const refused = new ClaudeCodeAdapter({
      runner,
      config: h.config,
      repoRoot: REPO,
      install: () => h.install,
      prompts: () => DomainResult.fail([{ code: 'GEN_PROMPT_TEMPLATE_INVALID', message: 'x' }]),
    });
    const r1 = await refused.generate(request(h));
    expect(r1.success).toBe(false);
    const r2 = await adapter.generate({ ...request(h), outputDir: path.join(REPO, 'tmp-out') });
    expect(r2.success).toBe(false);
    expect(fs.existsSync(path.join(REPO, 'tmp-out'))).toBe(false);
  });
});

describe('generate-main (D-U5a-13)', () => {
  function deps(runner: FakeGeneratorRunner, out: string[], err: string[]): GenerateMainDeps {
    return {
      runner,
      prompts,
      clock: { now: () => 0 },
      sleep: () => Promise.resolve(),
      parentEnv: {},
      out: (t) => out.push(t),
      err: (t) => err.push(t),
    };
  }

  it('--help prints usage and exits 0 without calling the CLI; a missing --plan or a bad plan exits 2', async () => {
    const runner = new FakeGeneratorRunner(h.binary);
    const out: string[] = [];
    const err: string[] = [];
    expect(await main(['--help'], REPO, deps(runner, out, err))).toBe(0);
    expect(out.join('')).toContain('--plan <plan.json>');
    expect(runner.cliCalls).toHaveLength(0);
    expect(await main([], REPO, deps(runner, out, err))).toBe(2);
    expect(await main(['--model', 'x'], REPO, deps(runner, out, err))).toBe(2);
    const bad = path.join(h.tmp, 'plan.json');
    fs.writeFileSync(bad, JSON.stringify({ ...onePlan(h.outRoot), binary: h.binary, harnessRoot: h.harnessRoot }));
    expect(await main(['--plan', bad], REPO, deps(runner, out, err))).toBe(2);
    expect(err.join('')).toContain('allowBash must be set');
    expect(runner.cliCalls).toHaveLength(0);
  });
});
