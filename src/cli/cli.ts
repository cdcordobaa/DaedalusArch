import { Command } from 'commander';
import { config as loadDotenv } from 'dotenv';
import { createPipeline } from '../pipeline/pipeline-factory.js';
import type { PipelineConfig, OutputFormat } from '../pipeline/types.js';
import type { BatchOptions, DriftOptions } from '../pipeline/types.js';
import type { EvaluationMode } from '../shared/types/enums.js';
import { formatJSON, formatHuman, formatCSV, csvHeader } from '../scoring-engine/index.js';
import { runBatch } from './batch-runner.js';
import { handleDrift } from './drift-handler.js';

// Load .env before anything else
loadDotenv();

/**
 * Resolve evaluation mode from mutually-exclusive CLI flags.
 */
function resolveEvaluationMode(symbolicOnly: boolean, neuronalOnly: boolean): EvaluationMode {
  if (symbolicOnly && neuronalOnly) {
    process.stderr.write('Error: --symbolic-only and --neuronal-only are mutually exclusive\n');
    process.exit(2);
  }
  if (symbolicOnly) return 'symbolic-only';
  if (neuronalOnly) return 'neuronal-only';
  return 'full';
}

/**
 * Map verdict string to process exit code.
 *   0 = pass / warning
 *   1 = soft-block / hard-block (violations)
 *   2 = unexpected / error
 */
function exitCodeFromVerdict(verdict: string): number {
  if (verdict === 'pass' || verdict === 'warning') return 0;
  if (verdict === 'soft-block' || verdict === 'hard-block') return 1;
  return 2;
}

// ── Build the CLI program ────────────────────────────────────────────────────

const program = new Command();
program
  .name('firewall')
  .description('Architectural Firewall — spec-driven compliance evaluation')
  .version('1.0.0');

// ── evaluate command ─────────────────────────────────────────────────────────

program
  .command('evaluate')
  .description('Evaluate a single TypeScript project for architectural compliance')
  .requiredOption('--project <path>', 'Path to TypeScript project')
  .requiredOption('--spec <path>', 'Path to AoC YAML spec')
  .option('--format <fmt>', 'Output format: json | human | csv', 'human')
  .option('--verbose', 'Enable verbose logging', false)
  .option('--neo4j-uri <uri>', 'Neo4j bolt URI', process.env['NEO4J_URI'] ?? 'bolt://localhost:7687')
  .option('--symbolic-only', 'Run symbolic evaluation only', false)
  .option('--neuronal-only', 'Run neuronal evaluation only', false)
  .option('--persist', 'Save snapshot after evaluation', false)
  .option('--diff', 'Compare against latest snapshot', false)
  .action(async (opts: {
    project: string;
    spec: string;
    format: string;
    verbose: boolean;
    neo4jUri: string;
    symbolicOnly: boolean;
    neuronalOnly: boolean;
    persist: boolean;
    diff: boolean;
  }) => {
    const evaluationMode = resolveEvaluationMode(opts.symbolicOnly, opts.neuronalOnly);

    const config: PipelineConfig = {
      projectPath: opts.project,
      specFilePath: opts.spec,
      neo4jUri: opts.neo4jUri,
      neo4jUser: process.env['NEO4J_USER'] ?? 'neo4j',
      neo4jPassword: process.env['NEO4J_PASSWORD'] ?? 'neo4j',
      evaluationMode,
      pipelineMode: 'stateless',
      persist: opts.persist,
      diff: opts.diff,
      verbose: opts.verbose,
      apgStorePath: process.env['APG_STORE_PATH'] ?? '.apg-store',
      llmConfig: evaluationMode !== 'symbolic-only'
        ? {
            provider: (process.env['LLM_PROVIDER'] as 'claude' | 'openai' | undefined) ?? 'claude',
            apiKey: process.env['ANTHROPIC_API_KEY'] ?? process.env['OPENAI_API_KEY'] ?? '',
          }
        : undefined,
    };

    // Validate API key for neuronal modes
    if (evaluationMode !== 'symbolic-only' && !config.llmConfig?.apiKey) {
      process.stderr.write(
        'Error: LLM API key required for neuronal/full mode. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.\n',
      );
      process.exit(2);
    }

    const { executor, cleanup } = createPipeline(config);

    // Graceful shutdown on signals
    const onSignal = (): void => {
      process.stderr.write('\nShutdown requested, finishing current stage...\n');
      executor.requestShutdown();
    };
    process.on('SIGINT', onSignal);
    process.on('SIGTERM', onSignal);

    try {
      if (opts.verbose) {
        process.stderr.write(`Evaluating ${opts.project} (mode: ${evaluationMode})...\n`);
      }

      const result = await executor.execute();

      if (!result.success) {
        process.stderr.write(`Error: ${result.errors.map((e) => e.message).join('; ')}\n`);
        process.exit(2);
      }

      const report = result.data;
      const format = opts.format as OutputFormat;

      // Route output: machine-readable to stdout, human to stderr
      switch (format) {
        case 'json':
          process.stdout.write(formatJSON(report) + '\n');
          break;
        case 'human':
          process.stderr.write(formatHuman(report) + '\n');
          break;
        case 'csv':
          process.stdout.write(csvHeader() + '\n');
          process.stdout.write(formatCSV(report) + '\n');
          break;
      }

      // Print stage timings in verbose mode
      if (opts.verbose) {
        const timings = executor.getTimings();
        process.stderr.write(`\nPipeline completed in ${String(timings.totalMs)}ms\n`);
        for (const stage of timings.stages) {
          process.stderr.write(`  ${stage.name}: ${String(stage.durationMs)}ms (${stage.status})\n`);
        }
      }

      process.exitCode = exitCodeFromVerdict(report.verdict);
    } finally {
      process.removeListener('SIGINT', onSignal);
      process.removeListener('SIGTERM', onSignal);
      await cleanup();
    }
  });

// ── batch command ────────────────────────────────────────────────────────────

program
  .command('batch')
  .description('Evaluate multiple TypeScript projects in batch')
  .requiredOption('--dir <path>', 'Directory containing project subdirectories')
  .requiredOption('--spec <path>', 'Path to AoC YAML spec')
  .option('--format <fmt>', 'Output format: json | csv', 'csv')
  .option('--verbose', 'Enable verbose logging', false)
  .option('--neo4j-uri <uri>', 'Neo4j bolt URI', process.env['NEO4J_URI'] ?? 'bolt://localhost:7687')
  .option('--symbolic-only', 'Run symbolic evaluation only', false)
  .option('--neuronal-only', 'Run neuronal evaluation only', false)
  .action(async (opts: {
    dir: string;
    spec: string;
    format: string;
    verbose: boolean;
    neo4jUri: string;
    symbolicOnly: boolean;
    neuronalOnly: boolean;
  }) => {
    const evaluationMode = resolveEvaluationMode(opts.symbolicOnly, opts.neuronalOnly);

    const batchOpts: BatchOptions = {
      dir: opts.dir,
      spec: opts.spec,
      format: opts.format as 'json' | 'csv',
      verbose: opts.verbose,
      neo4jUri: opts.neo4jUri,
      symbolicOnly: opts.symbolicOnly,
      neuronalOnly: opts.neuronalOnly,
    };

    const exitCode = await runBatch(batchOpts, evaluationMode);
    process.exitCode = exitCode;
  });

// ── drift command ────────────────────────────────────────────────────────────

program
  .command('drift')
  .description('Detect architectural drift between snapshots')
  .option('--project <path>', 'Path to TypeScript project (for latest-vs-current mode)')
  .option('--spec <path>', 'Path to AoC YAML spec (for latest-vs-current mode)')
  .option('--from <sha>', 'Source snapshot commit SHA')
  .option('--to <sha>', 'Target snapshot commit SHA')
  .option('--format <fmt>', 'Output format: json | human', 'human')
  .option('--neo4j-uri <uri>', 'Neo4j bolt URI', process.env['NEO4J_URI'] ?? 'bolt://localhost:7687')
  .option('--persist', 'Save new snapshot after evaluation', false)
  .action(async (opts: {
    project?: string;
    spec?: string;
    from?: string;
    to?: string;
    format: string;
    neo4jUri: string;
    persist: boolean;
  }) => {
    const driftOpts: DriftOptions = {
      project: opts.project,
      spec: opts.spec,
      from: opts.from,
      to: opts.to,
      format: opts.format as 'json' | 'human',
      neo4jUri: opts.neo4jUri,
      persist: opts.persist,
    };

    const exitCode = await handleDrift(driftOpts);
    process.exitCode = exitCode;
  });

export { program };

/**
 * CLI entry point. Call with process.argv or custom argv for testing.
 */
export async function main(argv: string[] = process.argv): Promise<void> {
  await program.parseAsync(argv);
}
