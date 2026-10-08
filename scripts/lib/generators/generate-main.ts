/**
 * `main` of `scripts/generate-projects.ts` (FR-v1.2E-28; BR-U5a-51; D-U5a-13 a).
 *
 * Usage (repository root):
 *   npx tsx scripts/generate-projects.ts --plan <plan.json> [--pilot]
 *   npx tsx scripts/generate-projects.ts --help
 *
 * The plan file (`GeneratorPlanFile`, `schedule.ts`) is the only source of the pinned model ids and `orderSeed`
 * (BR-U5a-51). `--pilot` runs one generation per level under `<outRoot>/pilot/` (§5.3 step 4). Before the grid the
 * harness root gets the read-only skeleton install and the `<H>/bin/tsc` launcher (`ensureHarness`); a tampered
 * install is rebuilt before the next cell. `--help` never calls the CLI. Exit codes: 0 grid completed (failed
 * generations are recorded outcomes, not errors), 1 the CLI is not available, 2 usage, plan or harness error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { DomainError } from '../../../src/shared/errors/domain-result.js';
import type { ProcessRunner } from '../../../src/shared/interfaces/process-runner.js';
import { NodeProcessRunner } from '../../../src/shared/process/node-process-runner.js';
import { scrubSecrets } from '../../../src/shared/errors/scrub.js';
import { createGeneratorCliConfig } from './config.js';
import { ClaudeCodeAdapter, runGenerationGrid } from './grid.js';
import { realSleep, systemClock } from './retry.js';
import type { Clock, Sleeper } from './retry.js';
import { loadGeneratorPlanFile, pilotPlan } from './schedule.js';
import { ensureHarness } from './skeleton.js';
import type { SkeletonInstall } from './skeleton.js';
import type { GenerationOutcome, PromptProvider } from './types.js';

export const GENERATE_USAGE = [
  'usage: npx tsx scripts/generate-projects.ts --plan <plan.json> [--pilot]',
  '       npx tsx scripts/generate-projects.ts --help',
  '',
  'Runs the FR-28 generation grid (Claude Code headless, confined argv) described by the plan file:',
  '{ adapters: [{ adapterId: "claude-code-cli", modelId }], tasks, style, levels, runs, outRoot, orderSeed,',
  '  binary, harnessRoot, timeoutMs?, allowBash }',
  'Pinned model ids and orderSeed come only from the plan file. --pilot: one generation per level under <outRoot>/pilot/.',
  '',
].join('\n');

export interface GenerateMainDeps {
  readonly runner: ProcessRunner;
  readonly prompts: PromptProvider;
  readonly clock: Clock;
  readonly sleep: Sleeper;
  readonly parentEnv: NodeJS.ProcessEnv;
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
}

/** Until the prompt templates are committed every request is refused (no generation without a frozen template). */
export const unavailablePrompts: PromptProvider = () =>
  DomainResult.fail([{ code: 'GEN_PROMPT_TEMPLATE_INVALID', message: 'prompt templates are not available' }]);

export function defaultGenerateDeps(_repoRoot: string): GenerateMainDeps {
  return {
    runner: new NodeProcessRunner(),
    prompts: unavailablePrompts,
    clock: systemClock,
    sleep: realSleep,
    parentEnv: process.env,
    out: (t) => process.stdout.write(t),
    err: (t) => process.stderr.write(t),
  };
}

interface ParsedArgs {
  readonly help: boolean;
  readonly plan?: string;
  readonly pilot: boolean;
}

export function parseGenerateArgs(argv: readonly string[]): DomainResult<ParsedArgs> {
  let help = false;
  let pilot = false;
  let plan: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') help = true;
    else if (a === '--pilot') pilot = true;
    else if (a === '--plan' && argv[i + 1] !== undefined && !(argv[i + 1] ?? '').startsWith('--')) plan = argv[++i];
    else return DomainResult.fail([{ code: 'GEN_USAGE', message: `unexpected argument ${JSON.stringify(a)}` }]);
  }
  if (!help && plan === undefined) return DomainResult.fail([{ code: 'GEN_USAGE', message: '--plan <file> is required' }]);
  return DomainResult.ok({ help, pilot, ...(plan !== undefined ? { plan } : {}) });
}

function report(deps: GenerateMainDeps, errors: readonly DomainError[]): number {
  deps.err(`${scrubSecrets(errors.map((e) => `${e.code}: ${e.message}`).join('\n'), [])}\n`);
  return 2;
}

export function summariseOutcomes(outcomes: readonly GenerationOutcome[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const o of outcomes) {
    const k = o.failureReason === undefined ? o.status : `${o.status}:${o.failureReason}`;
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

export async function main(argv: readonly string[], repoRoot: string, depsIn?: GenerateMainDeps): Promise<number> {
  const deps = depsIn ?? defaultGenerateDeps(repoRoot);
  const args = parseGenerateArgs(argv);
  if (!args.success) {
    deps.err(GENERATE_USAGE);
    return report(deps, args.errors);
  }
  if (args.data.help) {
    deps.out(GENERATE_USAGE);
    return 0;
  }
  if (!fs.existsSync(path.resolve(repoRoot, 'schemas/manifest.schema.json'))) {
    deps.err('run from the repository root\n');
    return 2;
  }
  const loaded = loadGeneratorPlanFile(path.resolve(repoRoot, args.data.plan ?? ''), repoRoot);
  if (!loaded.success) return report(deps, loaded.errors);
  const plan = args.data.pilot ? pilotPlan(loaded.data) : loaded.data;

  const configs = [];
  for (const a of plan.adapters) {
    const c = createGeneratorCliConfig(
      {
        binary: plan.binary,
        modelId: a.modelId,
        outputRoot: plan.outRoot,
        harnessRoot: plan.harnessRoot,
        allowBash: plan.allowBash,
        ...(plan.timeoutMs !== undefined ? { timeoutMs: plan.timeoutMs } : {}),
      },
      repoRoot,
    );
    if (!c.success) return report(deps, c.errors);
    configs.push(c.data);
  }
  const ready = await ensureHarness(deps.runner, repoRoot, plan.harnessRoot);
  if (!ready.success) return report(deps, ready.errors);
  let install: SkeletonInstall = ready.data.install;
  const adapters = configs.map(
    (config) =>
      new ClaudeCodeAdapter({
        runner: deps.runner,
        config,
        repoRoot,
        install: () => install,
        prompts: deps.prompts,
        parentEnv: deps.parentEnv,
        clock: deps.clock,
        sleep: deps.sleep,
      }),
  );
  for (const a of adapters) {
    if (!(await a.isAvailable())) {
      deps.err('the claude CLI is not available at the plan binary path\n');
      return 1;
    }
  }
  const grid = await runGenerationGrid(plan, adapters, {
    repoRoot,
    onSkeletonTampered: async () => {
      const again = await ensureHarness(deps.runner, repoRoot, plan.harnessRoot);
      if (!again.success) return DomainResult.fail(again.errors);
      install = again.data.install;
      return DomainResult.ok(undefined);
    },
    onOutcome: (o, cell) => {
      deps.out(`${cell.modelId}/${cell.taskId}/${cell.specLevel}/run-${String(cell.runIndex)}: ${o.status}${o.failureReason !== undefined ? ` (${o.failureReason})` : ''}\n`);
    },
  });
  if (!grid.success) return report(deps, grid.errors);
  deps.out(
    `${JSON.stringify(
      { outRoot: plan.outRoot, pilot: args.data.pilot, installHash: install.installHash, outcomes: grid.data.length, byStatus: summariseOutcomes(grid.data) },
      null,
      2,
    )}\n`,
  );
  return 0;
}
