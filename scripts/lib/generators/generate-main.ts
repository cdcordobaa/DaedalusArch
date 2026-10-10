/**
 * `main` of `scripts/generate-projects.ts` (FR-v1.2E-28; BR-U5a-51; D-U5a-13 a).
 *
 * Usage (repository root):
 *   npx tsx scripts/generate-projects.ts --plan <plan.json> [--pilot] [--binary <abs>] [--harness-root <abs>]
 *   npx tsx scripts/generate-projects.ts --help
 *
 * The E1 grid and its pilot start from the registered plan `experiments/e1-grid/generator-plan.json`, whose `binary`
 * and `harnessRoot` are `"<local>"` and come from `--binary` / `--harness-root` (`guardE1Plan`, SO5-03). The plan
 * file's path and sha256 are written to `schedule.json`. A grid stopped mid-cell resumes by an atomic cell restart
 * (`cell-restart.ts`, SO5-04).
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
import { CodexCliAdapter } from './codex-adapter.js';
import { CODEX_CLI_ADAPTER_ID } from './codex-cli.js';
import { codexConfigFromPlan } from './codex-plan.js';
import type { CodexHomes } from './codex-plan.js';
import type { CodexCliConfig } from './codex-cli.js';
import { ClaudeCodeAdapter, runGenerationGrid } from './grid.js';
import { filePromptProvider } from './prompt.js';
import { realSleep, systemClock } from './retry.js';
import type { Clock, Sleeper } from './retry.js';
import { loadPreRegistration, repoRelative, sha256File } from '../prereg.js';
import { E1_CODEX_GENERATOR_PLAN, E1_GENERATOR_PLAN, guardE1Plan } from './registered-plan.js';
import type { LocalPaths } from './registered-plan.js';
import { loadGeneratorPlanFile, pilotPlan } from './schedule.js';
import { ensureHarness } from './skeleton.js';
import type { SkeletonInstall } from './skeleton.js';
import type { GenerationOutcome, GeneratorAdapter, GeneratorCliConfig, PromptProvider } from './types.js';

export const GENERATE_USAGE = [
  'usage: npx tsx scripts/generate-projects.ts --plan <plan.json> [--pilot] [--binary <abs>] [--harness-root <abs>]',
  '                                            [--codex-home <abs>] [--codex-user-home <abs>]',
  '       npx tsx scripts/generate-projects.ts --help',
  '',
  'Runs the FR-28 generation grid (Claude Code headless or Codex exec, confined) described by the plan file:',
  '{ adapters: [{ adapterId: "claude-code-cli" | "codex-cli", modelId }], tasks, style, levels, runs, outRoot, orderSeed,',
  '  binary, harnessRoot, timeoutMs?, allowBash, codex? }',
  'Pinned model ids and orderSeed come only from the plan file. --pilot: one generation per level under <outRoot>/pilot/.',
  `The E1 grid and pilot use ${E1_GENERATOR_PLAN} (Claude arm) and ${E1_CODEX_GENERATOR_PLAN} (Codex arm, ADR-029);`,
  'their "<local>" binary and harnessRoot come from --binary / --harness-root. A Codex arm uses CODEX_HOME',
  '~/.firewall/generator-codex-home and the child HOME ~/.firewall/generator-codex-userhome unless overridden.',
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

export function defaultGenerateDeps(repoRoot: string): GenerateMainDeps {
  return {
    runner: new NodeProcessRunner(),
    prompts: filePromptProvider(repoRoot),
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
  readonly local: LocalPaths;
  readonly codexHomes: CodexHomes;
}

export function parseGenerateArgs(argv: readonly string[]): DomainResult<ParsedArgs> {
  let help = false;
  let pilot = false;
  let plan: string | undefined;
  let binary: string | undefined;
  let harnessRoot: string | undefined;
  let codexHome: string | undefined;
  let codexUserHome: string | undefined;
  const value = (i: number): string | undefined => {
    const v = argv[i + 1];
    return v !== undefined && !v.startsWith('--') ? v : undefined;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') help = true;
    else if (a === '--pilot') pilot = true;
    else if (a === '--plan' && value(i) !== undefined) plan = argv[++i];
    else if (a === '--binary' && value(i) !== undefined) binary = argv[++i];
    else if (a === '--harness-root' && value(i) !== undefined) harnessRoot = argv[++i];
    else if (a === '--codex-home' && value(i) !== undefined) codexHome = argv[++i];
    else if (a === '--codex-user-home' && value(i) !== undefined) codexUserHome = argv[++i];
    else return DomainResult.fail([{ code: 'GEN_USAGE', message: `unexpected argument ${JSON.stringify(a)}` }]);
  }
  if (!help && plan === undefined) return DomainResult.fail([{ code: 'GEN_USAGE', message: '--plan <file> is required' }]);
  const local: LocalPaths = { ...(binary !== undefined ? { binary } : {}), ...(harnessRoot !== undefined ? { harnessRoot } : {}) };
  const codexHomes: CodexHomes = { ...(codexHome !== undefined ? { codexHome } : {}), ...(codexUserHome !== undefined ? { userHome: codexUserHome } : {}) };
  return DomainResult.ok({ help, pilot, local, codexHomes, ...(plan !== undefined ? { plan } : {}) });
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
  const planFile = path.resolve(repoRoot, args.data.plan ?? '');
  const loaded = loadGeneratorPlanFile(planFile, repoRoot, args.data.local);
  if (!loaded.success) return report(deps, loaded.errors);
  const prereg = loadPreRegistration(repoRoot);
  const registeredSha = (rel: string): string | undefined => (prereg.ok ? prereg.value.artefacts.find((a) => a.path === rel)?.sha256 : undefined);
  const guard = guardE1Plan(planFile, loaded.data, repoRoot, registeredSha, sha256File);
  if (!guard.ok) return report(deps, [{ code: 'GEN_PLAN_UNREGISTERED', message: guard.detail }]);
  if (guard.warning !== undefined) deps.err(`warning: ${guard.warning}\n`);
  const plan = args.data.pilot ? pilotPlan(loaded.data) : loaded.data;

  type Built = { readonly kind: 'codex'; readonly config: CodexCliConfig } | { readonly kind: 'claude'; readonly config: GeneratorCliConfig };
  const built: Built[] = [];
  for (const a of plan.adapters) {
    if (a.adapterId === CODEX_CLI_ADAPTER_ID) {
      const c = codexConfigFromPlan(plan, a.modelId, repoRoot, args.data.codexHomes);
      if (!c.success) return report(deps, c.errors);
      built.push({ kind: 'codex', config: c.data });
      continue;
    }
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
    built.push({ kind: 'claude', config: c.data });
  }
  const ready = await ensureHarness(deps.runner, repoRoot, plan.harnessRoot);
  if (!ready.success) return report(deps, ready.errors);
  let install: SkeletonInstall = ready.data.install;
  const common = { runner: deps.runner, repoRoot, install: () => install, prompts: deps.prompts, parentEnv: deps.parentEnv, clock: deps.clock, sleep: deps.sleep };
  const adapters: GeneratorAdapter[] = built.map((b) =>
    b.kind === 'codex' ? new CodexCliAdapter({ ...common, config: b.config }) : new ClaudeCodeAdapter({ ...common, config: b.config }),
  );
  for (const a of adapters) {
    if (!(await a.isAvailable())) {
      deps.err(`the ${a.id === CODEX_CLI_ADAPTER_ID ? 'codex CLI (pinned version)' : 'claude CLI'} is not available at the plan binary path\n`);
      return 1;
    }
  }
  const grid = await runGenerationGrid(plan, adapters, {
    repoRoot,
    planProvenance: { path: repoRelative(repoRoot, planFile), sha256: sha256File(planFile) },
    onRecovery: (r, cell) => {
      deps.err(`${cell.modelId}/${cell.taskId}/${cell.specLevel}/run-${String(cell.runIndex)}: ${r.kind === 'discarded' ? `partial cell discarded to ${r.movedTo}, regenerating` : 'finished staging directory committed'}\n`);
    },
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
