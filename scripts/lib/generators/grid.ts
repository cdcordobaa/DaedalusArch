/**
 * Claude Code headless adapter and the generation grid (FR-v1.2E-28; Q16; ADR-017 item 3; SECURITY-11;
 * BR-U5a-41..51; `business-logic-model.md` §5.1).
 *
 * `ClaudeCodeAdapter` (one instance per pinned model id) runs one cell over `ProcessRunner`:
 * per-run path checks → fresh `cwd` with the skeleton `package.json` and the read-only `node_modules` symlink →
 * pinned per-run tsconfig under `<H>/runs/<runId>/` → instantiated prompt → the exact confinement argv
 * (`buildGeneratorArgs`) with the allow-listed child environment and `timeoutMs` → retries and usage-limit pauses
 * (`runWithRetries`) → `finaliseRun` (envelope, model-usage rule, skeleton integrity, type-check of record, counts,
 * tree sha). `isAvailable()` runs `<binary> --version`.
 *
 * `runGenerationGrid(plan, adapters, hooks)` validates the plan, writes `<outRoot>/schedule.json`, runs the cells in
 * the seeded blocked order (`scheduleGrid`) and writes each outcome to `generation.json` beside its tree before the
 * next cell. Every outcome is kept: failed generations are recorded and never replaced (BR-U5a-49), so a cell may
 * hold fewer than `runs` valid projects. A cell whose `generation.json` already exists is not re-run (resume after a
 * stop). A `skeleton-tampered` outcome triggers `hooks.onSkeletonTampered` (rebuild the install) before the next
 * cell. A harness failure (an adapter `DomainResult.fail`) stops the grid.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { ProcessResult, ProcessRunner } from '../../../src/shared/interfaces/process-runner.js';
import { buildGeneratorArgs, typecheckCommand } from './argv.js';
import { checkRunDirs } from './config.js';
import { parseEnvelope } from './envelope.js';
import { buildGeneratorChildEnv } from './env.js';
import { writeHarnessTsconfig } from './harness-tsconfig.js';
import { agentFileCount, attemptDisposition, finaliseRun, generationJsonPath, writeGenerationJson } from './outcome.js';
import { DEFAULT_RETRY_POLICY, realSleep, runWithRetries, systemClock } from './retry.js';
import type { Clock, RetryPolicy, Sleeper } from './retry.js';
import { SCHEDULE_JSON, requestForCell, scheduleGrid, validateGridPlan } from './schedule.js';
import { prepareCellDir, removeTree } from './skeleton.js';
import type { SkeletonInstall } from './skeleton.js';
import { CLAUDE_CODE_ADAPTER_ID } from './types.js';
import type {
  GenerationCell,
  GenerationOutcome,
  GenerationRequest,
  GeneratorAdapter,
  GeneratorCliConfig,
  GridPlan,
  PromptProvider,
} from './types.js';

const VERSION_TIMEOUT_MS = 30_000;
export const INTERRUPTIONS_DIR = 'interruptions';

export interface ClaudeCodeAdapterDeps {
  readonly runner: ProcessRunner;
  readonly config: GeneratorCliConfig;
  readonly repoRoot: string;
  /** The current skeleton install (it changes when the grid rebuilds a tampered install). */
  readonly install: () => SkeletonInstall;
  readonly prompts: PromptProvider;
  /** Parent environment filtered by `GENERATOR_ENV_ALLOW` (default `process.env`). */
  readonly parentEnv?: NodeJS.ProcessEnv;
  readonly policy?: RetryPolicy;
  readonly clock?: Clock;
  readonly sleep?: Sleeper;
  readonly knownSecrets?: readonly string[];
  /** Parent of the throwaway git store for `treeSha` (default `os.tmpdir()`). */
  readonly tmpRoot?: string;
}

export class ClaudeCodeAdapter implements GeneratorAdapter {
  readonly id = CLAUDE_CODE_ADAPTER_ID;
  readonly modelId: string;

  constructor(private readonly deps: ClaudeCodeAdapterDeps) {
    this.modelId = deps.config.modelId;
  }

  private childEnv(): Readonly<Record<string, string>> {
    return buildGeneratorChildEnv(this.deps.parentEnv ?? process.env);
  }

  async isAvailable(): Promise<boolean> {
    const r = await this.deps.runner.run(this.deps.config.binary, ['--version'], { env: this.childEnv(), timeoutMs: VERSION_TIMEOUT_MS });
    return r.success && r.data.exitCode === 0 && !r.data.timedOut;
  }

  private prepare(req: GenerationRequest): DomainResult<void> {
    const prep = prepareCellDir(this.deps.install(), this.deps.repoRoot, req.outputDir);
    if (!prep.success) return prep;
    writeHarnessTsconfig(this.deps.config.harnessRoot, req.runId, req.outputDir);
    return DomainResult.ok(undefined);
  }

  async generate(req: GenerationRequest): Promise<DomainResult<GenerationOutcome>> {
    const { config, runner } = this.deps;
    const dirs = checkRunDirs(config, req, this.deps.repoRoot);
    if (!dirs.success) return DomainResult.fail(dirs.errors);
    const prompt = this.deps.prompts(req, typecheckCommand(config.harnessRoot, req.runId));
    if (!prompt.success) return DomainResult.fail(prompt.errors);
    const prepared = this.prepare(req);
    if (!prepared.success) return DomainResult.fail(prepared.errors);
    const args = buildGeneratorArgs(config, req, prompt.data.prompt);
    const env = this.childEnv();
    const knownSecrets = this.deps.knownSecrets ?? [];

    const retried = await runWithRetries<ProcessResult | null>(
      {
        runAttempt: async () => {
          const call = await runner.run(config.binary, args, { cwd: req.outputDir, env, timeoutMs: config.timeoutMs });
          const cli = call.success ? call.data : null;
          const parsed = cli === null ? null : parseEnvelope(cli.stdout, knownSecrets);
          const envelope = parsed?.success === true ? parsed.data : null;
          return DomainResult.ok({ disposition: attemptDisposition(cli, envelope, agentFileCount(req.outputDir)), value: cli });
        },
        onInterruption: (index) => {
          const rel = path.posix.join(INTERRUPTIONS_DIR, req.runId, String(index));
          const to = path.join(config.outputRoot, ...rel.split('/'));
          fs.mkdirSync(path.dirname(to), { recursive: true });
          if (fs.existsSync(to)) removeTree(to);
          fs.renameSync(req.outputDir, to);
          const again = this.prepare(req);
          return again.success ? DomainResult.ok(rel) : DomainResult.fail(again.errors);
        },
        onRetry: () => {
          removeTree(req.outputDir);
          return this.prepare(req);
        },
      },
      this.deps.policy ?? DEFAULT_RETRY_POLICY,
      this.deps.clock ?? systemClock,
      this.deps.sleep ?? realSleep,
    );
    if (!retried.success) return DomainResult.fail(retried.errors);
    return finaliseRun({
      runner,
      repoRoot: this.deps.repoRoot,
      config,
      req,
      install: this.deps.install(),
      prompt: prompt.data,
      cli: retried.data.last.value,
      infrastructureExhausted: retried.data.exhausted,
      attempts: retried.data.attempts,
      interruptions: retried.data.interruptions,
      knownSecrets,
      ...(this.deps.tmpRoot !== undefined ? { tmpRoot: this.deps.tmpRoot } : {}),
    });
  }
}

export interface GridHooks {
  /** Rebuild the shared install after a `skeleton-tampered` outcome (BR-U5a-45). */
  readonly onSkeletonTampered?: () => Promise<DomainResult<void>>;
  /** Called after each outcome is written. */
  readonly onOutcome?: (outcome: GenerationOutcome, cell: GenerationCell) => void;
  /** When given, `outRoot` must lie outside it. */
  readonly repoRoot?: string;
}

/** Runs the grid (see the module header). */
export async function runGenerationGrid(
  plan: GridPlan,
  adapters: readonly GeneratorAdapter[],
  hooks: GridHooks = {},
): Promise<DomainResult<readonly GenerationOutcome[]>> {
  const valid = validateGridPlan(plan, hooks.repoRoot ?? null);
  if (!valid.success) return DomainResult.fail(valid.errors);
  const byModel = new Map<string, GeneratorAdapter>();
  for (const a of adapters) byModel.set(a.modelId, a);
  const missing = plan.adapters.filter((a) => !byModel.has(a.modelId)).map((a) => a.modelId);
  if (missing.length > 0) {
    return DomainResult.fail([{ code: 'GEN_ADAPTER_MISSING', message: 'one adapter per pinned model id is required', context: { missing } }]);
  }
  const cells = scheduleGrid(plan);
  fs.mkdirSync(plan.outRoot, { recursive: true });
  fs.writeFileSync(
    path.join(plan.outRoot, SCHEDULE_JSON),
    `${JSON.stringify({ orderSeed: plan.orderSeed, runs: plan.runs, cells }, null, 2)}\n`,
  );
  const outcomes: GenerationOutcome[] = [];
  for (const cell of cells) {
    const req = requestForCell(plan, cell);
    const existing = generationJsonPath(req.outputDir);
    if (fs.existsSync(existing)) {
      outcomes.push(JSON.parse(fs.readFileSync(existing, 'utf8')) as GenerationOutcome);
      continue;
    }
    const adapter = byModel.get(cell.modelId);
    if (adapter === undefined) return DomainResult.fail([{ code: 'GEN_ADAPTER_MISSING', message: 'adapter missing' }]);
    const r = await adapter.generate(req);
    if (!r.success) return DomainResult.fail(r.errors);
    writeGenerationJson(req.outputDir, r.data);
    outcomes.push(r.data);
    hooks.onOutcome?.(r.data, cell);
    if (!r.data.skeletonIntact && hooks.onSkeletonTampered !== undefined) {
      const rebuilt = await hooks.onSkeletonTampered();
      if (!rebuilt.success) return DomainResult.fail(rebuilt.errors);
    }
  }
  return DomainResult.ok(Object.freeze(outcomes));
}
