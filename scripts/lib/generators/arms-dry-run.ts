/**
 * `main` of `scripts/generator/arms-dry-run.ts`: prints, for each tool arm of the v1.3 firewall-in-the-loop draft, the
 * exact Claude Code argv and the MCP config file it would write. It never spawns the CLI, never calls a model and
 * writes nothing (the config files are printed, not written).
 *
 * Usage (repository root):
 *   npx tsx scripts/generator/arms-dry-run.ts [--plan <generator-plan.json>] [--arm <arm>]... [--all] [--json]
 *
 * The models, tasks, runs and orderSeed come from the generator plan (default: the registered E1 plan, read only).
 * The arms are crossed with the spec levels `none` and `minimal-prose` only (draft §Design). A `"<local>"` binary or
 * harness root is shown as a placeholder path. Without `--all`, one cell per arm (the first of the schedule).
 * Exit codes: 0 printed, 2 usage or plan error.
 */
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { createGeneratorCliConfig } from './config.js';
import { E1_GENERATOR_PLAN } from './registered-plan.js';
import { cellOutputDir, loadGeneratorPlanFile, requestForCell, scheduleGrid } from './schedule.js';
import type { GeneratorPlanFile } from './schedule.js';
import { CONTEXT_GRAPH_PLACEHOLDER, EXPERIMENT_ARMS, buildArmCall } from './arms.js';
import type { ArmCall, ArmInput, ContextGraphProvider, ExperimentArm } from './arms.js';
import type { GenerationRequest, SpecLevel } from './types.js';

export const ARMS_DRY_RUN_USAGE = [
  'usage: npx tsx scripts/generator/arms-dry-run.ts [--plan <generator-plan.json>] [--arm none|context-graph|daedalus-mcp]...',
  '                                                [--all] [--json]',
  '',
  'Prints the argv and MCP config of each tool arm (v1.3 firewall-in-the-loop, DRAFT). Never calls the CLI or a model.',
  `Default plan: ${E1_GENERATOR_PLAN} (models, tasks, runs, orderSeed). Levels: none, minimal-prose.`,
  '',
].join('\n');

/** Spec levels the arms are crossed with (full-aac puts the whole spec in the prompt; draft §Design). */
export const ARM_LEVELS: readonly SpecLevel[] = Object.freeze(['none', 'minimal-prose']);

export const PLACEHOLDER_BINARY = '/path/to/claude';
export const PLACEHOLDER_HARNESS = '/path/to/daedalus-harness';
/** Output root of the loop experiment, beside the E1 outcomes (outside every checkout). */
export const LOOP_OUT_DIR = 'daedalus-mcp-loop-outcomes';

export interface ArmsDryRunOptions {
  readonly plan: string;
  readonly arms: readonly ExperimentArm[];
  readonly all: boolean;
  readonly json: boolean;
}

export function parseArmsDryRunArgs(argv: readonly string[]): ArmsDryRunOptions | { readonly error: string } | 'help' {
  let plan = E1_GENERATOR_PLAN;
  const arms: ExperimentArm[] = [];
  let all = false;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') return 'help';
    if (a === '--all') all = true;
    else if (a === '--json') json = true;
    else if (a === '--plan' || a === '--arm') {
      const v = argv[i + 1];
      if (v === undefined) return { error: `${a} needs a value` };
      i++;
      if (a === '--plan') plan = v;
      else if ((EXPERIMENT_ARMS as readonly string[]).includes(v)) arms.push(v as ExperimentArm);
      else return { error: `unknown arm ${v} (one of ${EXPERIMENT_ARMS.join(', ')})` };
    } else return { error: `unknown argument ${String(a)}` };
  }
  return { plan, arms: arms.length > 0 ? arms : EXPERIMENT_ARMS, all, json };
}

/** One printed row: an arm call, or the placeholder of an arm that cannot be built yet. */
export interface ArmDryRunRow {
  readonly arm: ExperimentArm;
  readonly runId: string;
  readonly cwd: string;
  readonly call?: ArmCall;
  readonly notConfigured?: { readonly message: string; readonly placeholder?: typeof CONTEXT_GRAPH_PLACEHOLDER };
}

export interface ArmsDryRunDeps {
  readonly repoRoot: string;
  readonly nodeBinary: string;
  /** A provider for the context-graph arm; absent until one is plugged in. */
  readonly contextGraph?: ContextGraphProvider;
}

/** The E1 prompt is not instantiated in a dry run: a stand-in names the template it would use. */
export function standInPrompt(req: GenerationRequest): string {
  return `<E1 prompt ${req.promptTemplateId}, scripts/generator/prompts/${req.specLevel}.md>`;
}

export function buildDryRunRows(plan: GeneratorPlanFile, opts: ArmsDryRunOptions, deps: ArmsDryRunDeps): readonly ArmDryRunRow[] {
  const outRoot = path.join(path.dirname(plan.outRoot), LOOP_OUT_DIR);
  const claudeAdapters = plan.adapters.filter((a) => a.adapterId === 'claude-code-cli');
  const grid = { ...plan, adapters: claudeAdapters, levels: ARM_LEVELS, outRoot };
  const cells = scheduleGrid(grid);
  const chosen = opts.all ? cells : cells.slice(0, 1);
  const rows: ArmDryRunRow[] = [];
  for (const cell of chosen) {
    // All arms of one (model, task, level, run) tuple run in the same block, one after the other (draft §Design).
    for (const arm of opts.arms) {
      const req: GenerationRequest = {
        ...requestForCell(grid, cell),
        outputDir: cellOutputDir(path.join(outRoot, arm), cell),
      };
      const config = createGeneratorCliConfig(
        {
          binary: plan.binary,
          modelId: cell.modelId,
          outputRoot: path.join(outRoot, arm),
          harnessRoot: plan.harnessRoot,
          allowBash: plan.allowBash,
          ...(plan.timeoutMs !== undefined ? { timeoutMs: plan.timeoutMs } : {}),
        },
        deps.repoRoot,
      );
      if (!config.success) {
        rows.push({ arm, runId: req.runId, cwd: req.outputDir, notConfigured: { message: config.errors.map((e) => e.message).join('; ') } });
        continue;
      }
      const input: ArmInput = {
        arm,
        daedalus: {
          nodeBinary: deps.nodeBinary,
          serverEntry: path.join(deps.repoRoot, 'dist', 'mcp-server', 'main.js'),
          specPath: path.join(deps.repoRoot, 'specs', 'clean-arch.yaml'),
        },
        ...(deps.contextGraph !== undefined ? { contextGraph: deps.contextGraph } : {}),
      };
      const call = buildArmCall(config.data, req, standInPrompt(req), input);
      if (call.success) rows.push({ arm, runId: req.runId, cwd: req.outputDir, call: call.data });
      else {
        rows.push({
          arm,
          runId: req.runId,
          cwd: req.outputDir,
          notConfigured: {
            message: call.errors.map((e) => e.message).join('; '),
            ...(arm === 'context-graph' ? { placeholder: CONTEXT_GRAPH_PLACEHOLDER } : {}),
          },
        });
      }
    }
  }
  return rows;
}

/** Shell-quoted argv for reading (single quotes; the prompt is abbreviated to its length and sha256). */
export function formatArgv(binary: string, args: readonly string[], prompt: string): string {
  const q = (s: string): string => (/^[A-Za-z0-9_./=:,@+-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`);
  const sha = createHash('sha256').update(prompt).digest('hex').slice(0, 12);
  return [binary, ...args.map((a) => (a === prompt ? `<prompt ${String(prompt.length)} chars sha256:${sha}>` : q(a)))].join(' ');
}

export function formatRows(rows: readonly ArmDryRunRow[], binary: string, cellCount: number): string {
  const out: string[] = [`# arms dry run: ${String(cellCount)} cells per arm, ${String(rows.length)} row(s) shown; nothing is executed`];
  for (const r of rows) {
    out.push('', `== arm ${r.arm} | ${r.runId}`, `cwd: ${r.cwd}`);
    if (r.call !== undefined) {
      out.push(`argv: ${formatArgv(binary, r.call.args, r.call.prompt)}`);
      const sentence = r.call.prompt.split('\n\n').slice(1).join(' ').trim();
      out.push(`tool sentence: ${sentence === '' ? '(none)' : sentence}`);
      if (r.call.mcpConfigPath !== null) {
        out.push(`mcp config -> ${r.call.mcpConfigPath}:`, JSON.stringify(r.call.mcpConfig, null, 2));
      } else out.push('mcp config: none (--strict-mcp-config, no server)');
    } else if (r.notConfigured !== undefined) {
      out.push(`NOT CONFIGURED: ${r.notConfigured.message}`);
      if (r.notConfigured.placeholder !== undefined) {
        out.push(`candidates: ${r.notConfigured.placeholder.candidates.join('; ')}`);
        r.notConfigured.placeholder.steps.forEach((s, i) => out.push(`  ${String(i + 1)}. ${s}`));
      }
    }
  }
  return `${out.join('\n')}\n`;
}

export interface ArmsDryRunIo {
  readonly stdout: (s: string) => void;
  readonly stderr: (s: string) => void;
}

export function armsDryRunMain(argv: readonly string[], deps: ArmsDryRunDeps, io: ArmsDryRunIo): number {
  const opts = parseArmsDryRunArgs(argv);
  if (opts === 'help') {
    io.stdout(ARMS_DRY_RUN_USAGE);
    return 0;
  }
  if ('error' in opts) {
    io.stderr(`${opts.error}\n${ARMS_DRY_RUN_USAGE}`);
    return 2;
  }
  const planFile = path.resolve(deps.repoRoot, opts.plan);
  const loaded = loadGeneratorPlanFile(planFile, deps.repoRoot, { binary: PLACEHOLDER_BINARY, harnessRoot: PLACEHOLDER_HARNESS });
  if (!loaded.success) {
    io.stderr(`plan error: ${loaded.errors.map((e) => e.message).join('; ')}\n`);
    return 2;
  }
  const plan = loaded.data;
  const rows = buildDryRunRows(plan, opts, deps);
  const claudeModels = plan.adapters.filter((a) => a.adapterId === 'claude-code-cli').length;
  const cellCount = claudeModels * plan.tasks.length * ARM_LEVELS.length * plan.runs;
  if (opts.json) io.stdout(`${JSON.stringify({ cellsPerArm: cellCount, arms: opts.arms, rows }, null, 2)}\n`);
  else io.stdout(formatRows(rows, plan.binary, cellCount));
  return 0;
}
