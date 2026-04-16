import { Command } from 'commander';
import { config as loadDotenv } from 'dotenv';
import { createPipeline } from '../pipeline/pipeline-factory.js';
import type { PipelineConfig, OutputFormat } from '../pipeline/types.js';
import type { BatchOptions, DriftOptions } from '../pipeline/types.js';
import type { EvaluationMode } from '../shared/types/enums.js';
import { formatJSON, formatHuman, formatCSV, csvHeader } from '../scoring-engine/index.js';
import { generateReport } from '../report/report-generator.js';
import { formatActionableHuman } from '../scoring-engine/report-formatter.js';
import { runBatch } from './batch-runner.js';
import { handleDrift } from './drift-handler.js';
import { parseSpec, validateSpecAgainstProject } from '../spec-parser/index.js';
import { createBaseline, saveBaseline } from '../baseline/index.js';
import { loadBaseline, compareBaseline } from '../baseline/index.js';

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
  .option('--baseline <path>', 'Compare against baseline violations file')
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
    baseline?: string;
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
            provider: 'gemini' as const,
            apiKey: process.env['GEMINI_API_KEY'] ?? process.env['ANTHROPIC_API_KEY'] ?? '',
          }
        : undefined,
    };

    // Validate API key for neuronal modes
    if (evaluationMode !== 'symbolic-only' && !config.llmConfig?.apiKey) {
      process.stderr.write(
        'Warning: No GEMINI_API_KEY set. Neuronal functions will be skipped (symbolic-only fallback).\n',
      );
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

      // Baseline comparison (if --baseline provided)
      let exitVerdict = report.verdict;
      if (opts.baseline) {
        const baselineResult = loadBaseline(opts.baseline);
        if (!baselineResult.success) {
          process.stderr.write(`Baseline error: ${baselineResult.errors[0]?.message}\n`);
          process.exitCode = 2;
          return;
        }
        const comparison = compareBaseline(report.violations, baselineResult.data, opts.baseline);
        if (opts.verbose) {
          process.stderr.write(`\nBaseline: ${String(comparison.baselineViolations.length)} existing, ${String(comparison.newViolations.length)} new, ${String(comparison.removedFromBaseline.length)} fixed\n`);
        }
        // Only new violations affect exit code
        exitVerdict = comparison.newViolations.length === 0 ? 'pass' : report.verdict;
      }

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

      process.exitCode = exitCodeFromVerdict(exitVerdict);
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

// ── validate command ─────────────────────────────────────────────────────────

program
  .command('validate')
  .description('Validate a spec YAML against a project')
  .requiredOption('--spec <path>', 'Path to AoC YAML spec')
  .option('--project <path>', 'Path to TypeScript project (for directory checks)', '.')
  .action(async (opts: {
    spec: string;
    project: string;
  }) => {
    const parseResult = await parseSpec({ specFilePath: opts.spec });
    if (!parseResult.success) {
      process.stderr.write(`Spec parse error: ${parseResult.errors.map((e) => e.message).join('; ')}\n`);
      process.exitCode = 1;
      return;
    }

    const report = validateSpecAgainstProject(parseResult.data, opts.project);

    if (report.valid) {
      process.stderr.write(
        `Spec valid: ${String(report.summary.enabledFunctions)} fitness functions (${String(report.summary.disabledFunctions)} disabled), ${String(report.summary.totalLayers)} layers, 0 errors\n`,
      );
      process.exitCode = 0;
    } else {
      process.stderr.write(`Spec validation failed with ${String(report.summary.totalErrors)} error(s):\n`);
      for (const error of report.errors) {
        process.stderr.write(`  - [${error.code}] ${error.message}\n`);
        if (error.suggestion) {
          process.stderr.write(`    Suggestion: ${error.suggestion}\n`);
        }
      }
      process.exitCode = 1;
    }

    for (const w of report.warnings) {
      process.stderr.write(`  Warning: [${w.code}] ${w.message}\n`);
    }
  });

// ── baseline command ─────────────────────────────────────────────────────────

program
  .command('baseline')
  .description('Create a baseline snapshot from current violations')
  .requiredOption('--spec <path>', 'Path to AoC YAML spec')
  .requiredOption('--project <path>', 'Path to TypeScript project')
  .option('-o, --output <path>', 'Output file path', 'baseline_violations.json')
  .option('--verbose', 'Enable verbose logging', false)
  .option('--neo4j-uri <uri>', 'Neo4j bolt URI', process.env['NEO4J_URI'] ?? 'bolt://localhost:7687')
  .action(async (opts: {
    spec: string;
    project: string;
    output: string;
    verbose: boolean;
    neo4jUri: string;
  }) => {
    const config: PipelineConfig = {
      projectPath: opts.project,
      specFilePath: opts.spec,
      neo4jUri: opts.neo4jUri,
      neo4jUser: process.env['NEO4J_USER'] ?? 'neo4j',
      neo4jPassword: process.env['NEO4J_PASSWORD'] ?? 'neo4j',
      evaluationMode: 'symbolic-only' as EvaluationMode,
      pipelineMode: 'stateless',
      persist: false,
      diff: false,
      verbose: opts.verbose,
      apgStorePath: process.env['APG_STORE_PATH'] ?? '.apg-store',
    };

    const { executor, cleanup } = createPipeline(config);

    try {
      if (opts.verbose) {
        process.stderr.write(`Running evaluation for baseline creation...\n`);
      }

      const result = await executor.execute();

      if (!result.success) {
        process.stderr.write(`Error: ${result.errors.map((e) => e.message).join('; ')}\n`);
        process.exitCode = 2;
        return;
      }

      const report = result.data;
      const snapshot = createBaseline(report.violations, opts.spec);
      const saveResult = saveBaseline(snapshot, opts.output);

      if (!saveResult.success) {
        process.stderr.write(`Error saving baseline: ${saveResult.errors[0]?.message}\n`);
        process.exitCode = 2;
        return;
      }

      process.stderr.write(
        `Baseline created with ${String(snapshot.totalViolations)} violation(s) at ${opts.output}\n`,
      );
      process.exitCode = 0;
    } finally {
      await cleanup();
    }
  });

// ── report command ──────────────────────────────────────────────────────────

program
  .command('report')
  .description('Generate an interactive HTML report from evaluation results')
  .requiredOption('--project <path>', 'Path to TypeScript project')
  .requiredOption('--spec <path>', 'Path to AoC YAML spec')
  .option('-o, --output <path>', 'Output HTML file path', 'report.html')
  .option('--verbose', 'Enable verbose logging', false)
  .option('--neo4j-uri <uri>', 'Neo4j bolt URI', process.env['NEO4J_URI'] ?? 'bolt://localhost:7687')
  .option('--symbolic-only', 'Run symbolic evaluation only', false)
  .option('--neuronal-only', 'Run neuronal evaluation only', false)
  .action(async (opts: {
    project: string;
    spec: string;
    output: string;
    verbose: boolean;
    neo4jUri: string;
    symbolicOnly: boolean;
    neuronalOnly: boolean;
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
      persist: false,
      diff: false,
      verbose: opts.verbose,
      apgStorePath: process.env['APG_STORE_PATH'] ?? '.apg-store',
      llmConfig: evaluationMode !== 'symbolic-only'
        ? {
            provider: 'gemini' as const,
            apiKey: process.env['GEMINI_API_KEY'] ?? process.env['ANTHROPIC_API_KEY'] ?? '',
          }
        : undefined,
    };

    if (evaluationMode !== 'symbolic-only' && !config.llmConfig?.apiKey) {
      process.stderr.write(
        'Warning: No GEMINI_API_KEY set. Neuronal functions will be skipped (symbolic-only fallback).\n',
      );
    }

    const { executor, context, cleanup } = createPipeline(config);

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

      const pipelineResult = await executor.execute();

      if (!pipelineResult.success) {
        process.stderr.write(`Error: ${pipelineResult.errors.map((e) => e.message).join('; ')}\n`);
        process.exit(2);
      }

      const report = context.getReport();
      const parsedSpec = context.getParsedSpec();
      const apgResult = context.getApgResult();

      const projectName = opts.project.split('/').filter(Boolean).pop() ?? opts.project;

      const reportResult = generateReport({
        evaluationReport: report,
        parsedSpec,
        apgResult,
        projectName,
        specFilePath: opts.spec,
        outputPath: opts.output,
      });

      if (!reportResult.success) {
        process.stderr.write(`Error generating report: ${reportResult.errors.map((e) => e.message).join('; ')}\n`);
        process.exit(2);
      }

      process.stderr.write(formatActionableHuman(report, parsedSpec.fitnessFunctions) + '\n');
      process.stderr.write(`\nReport written to ${reportResult.data.outputPath}\n`);

      process.exitCode = exitCodeFromVerdict(report.verdict);
    } finally {
      process.removeListener('SIGINT', onSignal);
      process.removeListener('SIGTERM', onSignal);
      await cleanup();
    }
  });

export { program };

/**
 * CLI entry point. Call with process.argv or custom argv for testing.
 */
export async function main(argv: string[] = process.argv): Promise<void> {
  await program.parseAsync(argv);
}
