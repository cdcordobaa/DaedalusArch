import { Command } from 'commander';
import { parseInstrumentVersion } from '../fitness-compiler/role-exemptions.js';
import type { InstrumentVersion } from '../fitness-compiler/role-exemptions.js';
import { config as loadDotenv } from 'dotenv';
import { createPipeline } from '../pipeline/pipeline-factory.js';
import type { PipelineConfig, OutputFormat, ExtractorDefaults } from '../pipeline/types.js';
import { EXTRACTOR_DEFAULTS } from '../pipeline/types.js';
import type { BatchOptions, DriftOptions } from '../pipeline/types.js';
import type { EvaluationMode } from '../shared/types/enums.js';
import { formatJSON, formatHuman, formatCSV, csvHeader } from '../scoring-engine/index.js';
import { NEURAL_AGGREGATIONS, parseNeuralAggregation } from '../scoring-engine/neural-aggregation.js';
import type { NeuralAggregation } from '../scoring-engine/neural-aggregation.js';
import { parseScoringMode, SCORING_MODES } from '../scoring-engine/tiered-scoring.js';
import type { ScoringMode } from '../shared/types/evaluation.js';
import { generateReport } from '../report/report-generator.js';
import { graphInputFromApg, writeArchitectReport } from '../report/architect/index.js';
import { formatActionableHuman } from '../scoring-engine/report-formatter.js';
import { buildReportFixHints, formatFixHintsHuman } from '../fix-hints/index.js';
import { runBatch } from './batch-runner.js';
import { requireEnvForCli } from './require-env.js';
import { ENGINE_OPTION_HELP, resolveEngineForCli } from './engine-default.js';
import type { GraphEngine } from '../cypher-interp/engine.js';
import { CypherSyntaxError, CypherUnsupportedError, parseCypher } from '../cypher-interp/parse.js';
import { EMPTY_AGGREGATE_POLICIES, parseEmptyAggregatePolicy } from '../fitness-compiler/empty-aggregates.js';
import { handleDrift } from './drift-handler.js';
import { parseSpec, validateSpecAgainstProject } from '../spec-parser/index.js';
import { compileFunctions, compilerInputFromSpec, V13_COMPILE_OPTIONS } from '../fitness-compiler/index.js';
import { createBaseline, saveBaseline } from '../baseline/index.js';
import { loadBaseline, compareBaseline } from '../baseline/index.js';
import * as path from 'node:path';
import * as fs from 'node:fs';
import type { LLMProviderConfig } from '../shared/types/llm-config.js';
import { parseLLMOptions } from './llm-options.js';
import { JUDGE_RUN_INCOMPLETE } from '../llm-critic/judge-stage.js';
import { GRAPH_MODES } from '../apg-extractor/types.js';
import type { GraphMode } from '../apg-extractor/types.js';
import { ADVISORY_FILTER_OPTIONS, parseAdvisoryFilterOptions } from '../advisory-filter/advisory-filter.js';
import type { AdvisoryFilterOption } from '../advisory-filter/advisory-filter.js';
import { runCheck, neo4jEngine, lexicalEngine, formatGateHuman, formatGateJSON, formatGateMarkdown } from '../ci-gate/index.js';
import type { GateEngine } from '../ci-gate/index.js';
import { defaultPropose, inferredBanner, inferredSpecFile, labelJsonReport, runInit } from './init-command.js';
import type { InferredSpecFile } from './init-command.js';
import { defaultPresetsDir, formatProposalHuman, proposeRules, summariseProposal } from '../rule-mining/index.js';
import { ISE_STYLES } from '../ise/index.js';
import type { IseStyle } from '../ise/index.js';

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

/** `--graph-mode` value (ADR-021 SO2): `full` (default) or the `ast-only` ablation arm; anything else exits 2. */
function resolveGraphMode(value: string): GraphMode | undefined {
  if ((GRAPH_MODES as readonly string[]).includes(value)) return value as GraphMode;
  process.stderr.write(`Error: --graph-mode must be one of ${GRAPH_MODES.join(' | ')}\n`);
  process.exitCode = 2;
  return undefined;
}

/** The scale flags of `evaluate` (Docs/v1.3/scale.md); absent flags leave the run as it was. */
interface ScaleCliOpts {
  readonly maxFiles?: string;
  readonly memoryLimitMb?: string;
  readonly queryEngine: string;
  readonly skipExcludedSources: boolean;
}

type ScaleConfig = Pick<PipelineConfig, 'maxFiles' | 'memoryLimitMb' | 'queryEngine' | 'sourceScope'>;

function positiveInt(flag: string, value: string): number | undefined {
  if (/^[1-9][0-9]*$/.test(value)) return Number(value);
  process.stderr.write(`Error: ${flag} must be a positive integer\n`);
  process.exitCode = 2;
  return undefined;
}

/** `--max-files`, `--memory-limit-mb`, `--query-engine`, `--skip-excluded-sources`; an invalid value exits 2. */
function resolveScaleOptions(opts: ScaleCliOpts): ScaleConfig | undefined {
  if (!(QUERY_ENGINES as readonly string[]).includes(opts.queryEngine)) {
    process.stderr.write(`Error: --query-engine must be one of ${QUERY_ENGINES.join(' | ')}\n`);
    process.exitCode = 2;
    return undefined;
  }
  const maxFiles = opts.maxFiles !== undefined ? positiveInt('--max-files', opts.maxFiles) : undefined;
  if (opts.maxFiles !== undefined && maxFiles === undefined) return undefined;
  const memoryLimitMb = opts.memoryLimitMb !== undefined ? positiveInt('--memory-limit-mb', opts.memoryLimitMb) : undefined;
  if (opts.memoryLimitMb !== undefined && memoryLimitMb === undefined) return undefined;
  return {
    ...(maxFiles !== undefined && { maxFiles }),
    ...(memoryLimitMb !== undefined && { memoryLimitMb }),
    ...(opts.queryEngine === 'neo4j' && { queryEngine: 'neo4j' as const }),
    ...(opts.skipExcludedSources && { sourceScope: 'analysed' as const }),
  };
}

const QUERY_ENGINES = ['accelerated', 'neo4j'] as const;
/** `functionId name: reason` for every compiled query the interpreter's parser refuses. */
function interpreterRejections(queries: readonly { functionId: unknown; name: string; cypher: string }[]): string[] {
  const out: string[] = [];
  for (const q of queries) {
    try {
      parseCypher(q.cypher);
    } catch (err) {
      if (!(err instanceof CypherUnsupportedError) && !(err instanceof CypherSyntaxError)) throw err;
      out.push(`${String(q.functionId)} ${q.name}: ${err.message}`);
    }
  }
  return out;
}

/** The command's graph engine (`engine-default.ts`): prints the one engine line; undefined (exit 2) for an unknown value. */
function engineFor(flag: string | undefined, cmd: Command): GraphEngine | undefined {
  return resolveEngineForCli({ flag, neo4jUriFlag: cmd.getOptionValueSource('neo4jUri') === 'cli', env: process.env });
}

/** `--neural-aggregation` value (ADR-028): `registered` (default) or `proportional`; anything else exits 2. */
function resolveNeuralAggregation(value: string): NeuralAggregation | undefined {
  const v = parseNeuralAggregation(value);
  if (v !== undefined) return v;
  process.stderr.write(`Error: --neural-aggregation must be one of ${NEURAL_AGGREGATIONS.join(' | ')}\n`);
  process.exitCode = 2;
  return undefined;
}

/** `--scoring` / `--rules` value (FR-V6): `v1.3` (default) or `v1.2e`; anything else exits 2. */
function resolveScoringMode(value: string, flag: string): ScoringMode | undefined {
  const v = parseScoringMode(value);
  if (v !== undefined) return v;
  process.stderr.write(`Error: ${flag} must be one of ${SCORING_MODES.join(' | ')}\n`);
  process.exitCode = 2;
  return undefined;
}

/** `--instrument` value (ADR-026): `v1` or `v2`; anything else exits 2. */
function resolveInstrument(value: string): InstrumentVersion | undefined {
  const v = parseInstrumentVersion(value);
  if (v !== undefined) return v;
  process.stderr.write('Error: --instrument must be one of v1 | v2\n');
  process.exitCode = 2;
  return undefined;
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

// ── U4 C9 hunk: judge options (FR-23, FR-31, D-U0-8; BR-U4-ISO-01, AGG-03) ──────

/** The judge options both `evaluate` and `report` accept (DE §5.6); values are parsed by `parseLLMOptions`. */
interface LLMCliOpts {
  llmProvider?: string;
  llmModel?: string;
  llmEffort?: string;
  cassetteMode?: string;
  cassetteDir?: string;
  judgeRepetition?: string;
  judgeConfigDir?: string;
  judgeBaselineReport?: string;
  cassetteOmitPrompt?: boolean;
  cassetteProjectId?: string;
  judgeCli?: string;
  judgeVersion?: string;
}

function withLLMOptions(command: Command): Command {
  return command
    .option('--llm-provider <name>', 'Judge provider: claude-cli | gemini | mock (default claude-cli)')
    .option('--llm-model <id>', 'Judge model id (default claude-opus-5-5; required for gemini)')
    .option('--llm-effort <level>', 'Judge effort: low | medium | high | xhigh | max (default high)')
    .option('--cassette-mode <mode>', 'Cassette mode: record | replay (default record)')
    .option('--cassette-dir <dir>', 'Cassette directory (default ./.firewall/cassettes)')
    .option('--judge-repetition <n>', 'Judge repetition index (default 0)')
    .option('--judge-config-dir <dir>', 'Judge CLI config dir (default ~/.firewall/judge-claude-config)')
    .option('--judge-baseline-report <path>', 'Baseline report whose neuralResults[].selection a variant reuses')
    .option('--cassette-omit-prompt', 'Record cassettes without prompts (corpus runs)', false)
    .option('--cassette-project-id <id>', 'Project id written on every judge cassette entry (repetition reliability)')
    .option('--judge-cli <path>', 'Judge CLI binary (default ~/.firewall/judge-cli/node_modules/.bin/claude when present, else claude)')
    .option('--judge-version <v>', 'Judge rubric version: v1 (frozen, default) | v2 (v1.3 development, revision v2.1) | v2.2 (v1.3 development)');
}

/** The argv `parseLLMOptions` reads, rebuilt from the parsed options (so `main(argv)` tests work). */
function llmArgv(opts: LLMCliOpts): string[] {
  const pairs: [string, string | undefined][] = [
    ['--llm-provider', opts.llmProvider], ['--llm-model', opts.llmModel], ['--llm-effort', opts.llmEffort],
    ['--cassette-mode', opts.cassetteMode], ['--cassette-dir', opts.cassetteDir], ['--judge-repetition', opts.judgeRepetition],
    ['--judge-config-dir', opts.judgeConfigDir], ['--judge-baseline-report', opts.judgeBaselineReport],
    ['--cassette-project-id', opts.cassetteProjectId], ['--judge-cli', opts.judgeCli],
    ['--judge-version', opts.judgeVersion],
  ];
  const argv = pairs.flatMap(([name, value]) => (value === undefined ? [] : [`${name}=${value}`]));
  if (opts.cassetteOmitPrompt === true) argv.push('--cassette-omit-prompt');
  return argv;
}

/**
 * LLM configuration of a full or neuronal-only run (`undefined` for symbolic-only). Only
 * `GEMINI_API_KEY` is read, and only for `--llm-provider gemini` (BR-U4-ISO-01); a configuration
 * error is reported and the process exits 2 before any connection.
 */
function llmConfigFor(mode: EvaluationMode, projectPath: string, opts: LLMCliOpts): LLMProviderConfig | undefined | null {
  if (mode === 'symbolic-only') return undefined;
  const parsed = parseLLMOptions(llmArgv(opts), process.env, { projectRoot: path.resolve(projectPath) });
  if (!parsed.success) {
    process.stderr.write(`Error: ${parsed.errors.map((e) => e.message).join('; ')}\n`);
    process.exitCode = 2;
    return null;
  }
  return parsed.data;
}

/** Exit code of a failed pipeline: 3 when the judge run is incomplete (resume in record mode), else 2. */
function exitCodeFromErrors(errors: readonly { readonly code: string }[]): number {
  return errors.some((e) => e.code === JUDGE_RUN_INCOMPLETE) ? 3 : 2;
}

// ── Build the CLI program ────────────────────────────────────────────────────

const program = new Command();
program
  .name('firewall')
  .description('Architectural Firewall — spec-driven compliance evaluation')
  .version('1.0.0');

// ── evaluate command ─────────────────────────────────────────────────────────

withLLMOptions(program
  .command('evaluate')
  .description('Evaluate a single TypeScript project for architectural compliance'))
  .argument('[project]', 'Path to TypeScript project (same as --project)')
  .option('--project <path>', 'Path to TypeScript project (or the positional argument)')
  // Required unless --from-inferred (checked in the action, with commander's own message).
  .option('--spec <path>', 'Path to AoC YAML spec (required unless --from-inferred)')
  .option('--from-inferred', 'Evaluate under the spec ISE infers from the project (`firewall init`), labelled "inferred spec, not author-declared"; excludes --spec', false)
  .option('--format <fmt>', 'Output format: json | human | csv', 'human')
  .option('--verbose', 'Enable verbose logging', false)
  .option('--neo4j-uri <uri>', 'Neo4j bolt URI', process.env['NEO4J_URI'] ?? 'bolt://localhost:7687')
  .option('--symbolic-only', 'Run symbolic evaluation only', false)
  .option('--neuronal-only', 'Run neuronal evaluation only', false)
  .option('--persist', 'Save snapshot after evaluation', false)
  .option('--diff', 'Compare against latest snapshot', false)
  .option('--baseline <path>', 'Compare against baseline violations file')
  .option('--graph-mode <mode>', 'Graph mode: full | ast-only (APG ablation arm: IMPORTS, DECLARES and CONTAINS edges only)', 'full')
  .option('--instrument <version>', 'Symbolic instrument: v2 (role exemptions, default) | v1 (ADR-026)', 'v2')
  .option('--neural-aggregation <rule>', 'Neural aggregation of the AHS: registered (default, primary) | proportional (ADR-028 sensitivity variant)', 'registered')
  .option('--tsconfig <path>', 'Explicit tsconfig for APG extraction; the project\'s own tsconfig.json is then ignored (ADR-032)')
  .option('--scoring <mode>', 'Scoring mode: v1.3 (rule tiers, default; verdict from blocking rules) | v1.2e (the registered Study 1 scoring; on the default v1.3 graph its universal metrics count both re-export edge views, so pair it with --extractor v1.2e for the v1.2E graph)', 'v1.3')
  .option('--extractor <defaults>', 'Extractor defaults: v1.3 (default; literal and resolved re-export edges, dynamic imports, module wiring, member facts) | v1.2e (the registered v1.2E graph)', 'v1.3')
  .option('--resolved-edges-in-literal-view', 'Off by default. Keep an import\'s edge to the declaring file in the literal view when it goes through a barrel (MT-B1, Docs/DiagnosticRuns/v1.3-metamorphic-2026-10-16.md)', false)
  .option('--literal-through-layerless-barrels', 'Off by default. At graph build, an import through barrels that belong to no layer (and are no declared DDD public API) also keeps its edge to the declaring file in the literal view (MT-B1 fix, Docs/DiagnosticRuns/v1.3-mtb1-fix-2026-10-16.md)', false)
  .option('--advisory-filter <options>', `Advisory post-filters, off by default (comma list, all or none): ${ADVISORY_FILTER_OPTIONS.join(', ')}. Matched advisory rows move to advisoryFilter.suppressed; blocking rows never change`, 'none')
  .option('--html <out.html>', 'Also write a self-contained architect HTML report (layer diagram, findings in plain language, filters)')
  .option('--hints', 'Add a deterministic fix hint to every blocking finding (json: `fixHints`; human: a Fix hints section). Off by default: the output is then unchanged', false)
  .option('--engine <name>', ENGINE_OPTION_HELP)
  .option('--empty-aggregates <policy>', 'A ddd spec with no aggregate (loop-pilot T1): fail (default, BR-SPEC-10) | not-applicable (FF-DT01/02 disabled, recorded) | exclude (FF-DT01/02 not scored, recorded) | vacuous (FF-DT01/02 run on an empty list)', 'fail')
  .option('--max-files <n>', 'Stop with PROJECT_TOO_LARGE before parsing when more than n source files remain after the exclusions')
  .option('--memory-limit-mb <n>', 'Stop with MEMORY_LIMIT_EXCEEDED when resident memory passes n MB (the heap guard is always on)')
  .option('--query-engine <engine>', 'accelerated (default: the bounded cycle queries answered in memory, same rows) | neo4j (every query on Neo4j)', 'accelerated')
  .option('--skip-excluded-sources', 'Load only the analysed files and declaration files into ts-morph (faster, less memory; output not guaranteed identical)', false)
  .action(async (projectArg: string | undefined, opts: LLMCliOpts & ScaleCliOpts & {
    engine?: string;
    emptyAggregates: string;
    project?: string;
    tsconfig?: string;
    resolvedEdgesInLiteralView: boolean;
    literalThroughLayerlessBarrels: boolean;
    spec?: string;
    fromInferred: boolean;
    format: string;
    verbose: boolean;
    neo4jUri: string;
    symbolicOnly: boolean;
    neuronalOnly: boolean;
    persist: boolean;
    diff: boolean;
    baseline?: string;
    graphMode: string;
    instrument: string;
    neuralAggregation: string;
    scoring: string;
    advisoryFilter: string;
    extractor: string;
    hints: boolean;
    html?: string;
  }, cmd: Command) => {
    const project = opts.project ?? projectArg;
    if (project === undefined || (opts.project !== undefined && projectArg !== undefined && opts.project !== projectArg)) {
      process.stderr.write(project === undefined
        ? "error: required option '--project <path>' not specified (or pass the project as the first argument)\n"
        : 'error: the positional project and --project differ; pass one\n');
      process.exitCode = 2;
      return;
    }
    opts.project = project;
    if (opts.fromInferred && opts.spec !== undefined) {
      process.stderr.write('Error: --spec and --from-inferred are mutually exclusive\n');
      process.exitCode = 2;
      return;
    }
    if (!opts.fromInferred && opts.spec === undefined) {
      cmd.error("error: required option '--spec <path>' not specified");
    }
    const evaluationMode = resolveEvaluationMode(opts.symbolicOnly, opts.neuronalOnly);
    let advisoryFilter: AdvisoryFilterOption[];
    try {
      advisoryFilter = parseAdvisoryFilterOptions(opts.advisoryFilter);
    } catch (e) {
      process.stderr.write(`Error: --advisory-filter: ${e instanceof Error ? e.message : String(e)}\n`);
      process.exitCode = 2;
      return;
    }
    const graphMode = resolveGraphMode(opts.graphMode);
    if (graphMode === undefined) return;
    const scoringMode = resolveScoringMode(opts.scoring, '--scoring');
    if (scoringMode === undefined) return;
    if (!(EXTRACTOR_DEFAULTS as readonly string[]).includes(opts.extractor)) {
      process.stderr.write(`Error: --extractor must be one of ${EXTRACTOR_DEFAULTS.join(' | ')}\n`);
      process.exitCode = 2;
      return;
    }
    const extractorDefaults = opts.extractor as ExtractorDefaults;
    const instrumentVersion = resolveInstrument(opts.instrument);
    if (instrumentVersion === undefined) return;
    const neuralAggregation = resolveNeuralAggregation(opts.neuralAggregation);
    if (neuralAggregation === undefined) return;
    const graphEngine = engineFor(opts.engine, cmd);
    if (graphEngine === undefined) return;
    const emptyAggregates = parseEmptyAggregatePolicy(opts.emptyAggregates);
    if (emptyAggregates === undefined) {
      process.stderr.write(`Error: --empty-aggregates must be one of ${EMPTY_AGGREGATE_POLICIES.join(' | ')}\n`);
      process.exitCode = 2;
      return;
    }
    const scale = resolveScaleOptions(opts);
    if (scale === undefined) return;
    // BR-U3-80: no default password; stop before any connection. The in-process engine opens none and reads none.
    const neo4jPassword = graphEngine === 'cypher-interp' ? '' : requireEnvForCli('NEO4J_PASSWORD');
    if (neo4jPassword === undefined) return;
    // U4 C9 hunk: judge options parsed before any connection (no key fallback, D-U0-8)
    const llmConfig = llmConfigFor(evaluationMode, opts.project, opts);
    if (llmConfig === null) return;

    // --from-inferred: the ISE proposal in a temporary file (never written into the project).
    let inferred: InferredSpecFile | undefined;
    if (opts.fromInferred) {
      try {
        inferred = await inferredSpecFile(opts.project, defaultPropose);
      } catch (e: unknown) {
        process.stderr.write(`Error: cannot infer a spec for ${opts.project}: ${e instanceof Error ? e.message : String(e)}\n`);
        process.exitCode = 2;
        return;
      }
      process.stderr.write(inferredBanner(inferred.proposal) + '\n');
    }

    const config: PipelineConfig = {
      ...scale,
      projectPath: opts.project,
      specFilePath: inferred?.specPath ?? opts.spec ?? '',
      neo4jUri: opts.neo4jUri,
      neo4jUser: process.env['NEO4J_USER'] ?? 'neo4j',
      neo4jPassword,
      evaluationMode,
      pipelineMode: 'stateless',
      persist: opts.persist,
      diff: opts.diff,
      verbose: opts.verbose,
      apgStorePath: process.env['APG_STORE_PATH'] ?? '.apg-store',
      llmConfig,
      ...(graphMode !== 'full' && { graphMode }),
      ...(opts.tsconfig !== undefined && { tsconfigPath: opts.tsconfig }),
      ...(opts.resolvedEdgesInLiteralView && { resolvedEdgesInLiteralView: true }),
      ...(opts.literalThroughLayerlessBarrels && { literalThroughLayerlessBarrels: true }),
      instrumentVersion,
      neuralAggregation,
      scoringMode,
      ...(advisoryFilter.length > 0 && { advisoryFilter }),
      ...(extractorDefaults !== 'v1.3' && { extractorDefaults }),
      ...(graphEngine !== 'neo4j' && { graphEngine }),
      ...(emptyAggregates !== 'fail' && { emptyAggregates }),
    };

    const { executor, context, cleanup } = createPipeline(config);

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
        inferred?.dispose();
        process.stderr.write(`Error: ${result.errors.map((e) => e.message).join('; ')}${inferred !== undefined ? ' (under the inferred spec)' : ''}\n`);
        process.exit(exitCodeFromErrors(result.errors));
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

      // Fix hints (Docs/v1.3/fix-hints.md): only with --hints, so the default output is byte-identical.
      const fixHints = opts.hints
        ? buildReportFixHints(report.violations, context.getParsedSpec(), opts.project, context.getApgResult())
        : undefined;

      // Route output: machine-readable to stdout, human to stderr
      switch (format) {
        case 'json':
          process.stdout.write((inferred !== undefined ? labelJsonReport(formatJSON(fixHints === undefined ? report : { ...report, fixHints }), inferred.proposal) : formatJSON(fixHints === undefined ? report : { ...report, fixHints })) + '\n');
          break;
        case 'human':
          process.stderr.write(formatHuman(report) + '\n');
          if (fixHints !== undefined) process.stderr.write(formatFixHintsHuman(fixHints) + '\n');
          break;
        case 'csv':
          process.stdout.write(csvHeader() + '\n');
          process.stdout.write(formatCSV(report) + '\n');
          break;
      }
      if (inferred !== undefined && format !== 'json') process.stderr.write(`${inferredBanner(inferred.proposal).split('\n')[0] ?? ''}\n`);

      // Architect HTML report: only with --html, so the default outputs stay as they were.
      if (opts.html !== undefined) {
        try {
          const apg = (() => {
            try { return context.getApgResult(); } catch { return undefined; }
          })();
          const written = writeArchitectReport({
            report,
            spec: context.getParsedSpec(),
            ...(apg !== undefined && { graph: graphInputFromApg(apg) }),
            projectRoot: path.resolve(opts.project),
            projectName: path.basename(path.resolve(opts.project)),
            specPath: config.specFilePath,
          }, opts.html);
          process.stderr.write(`HTML report written to ${written}\n`);
        } catch (err: unknown) {
          process.stderr.write(`Error writing HTML report: ${err instanceof Error ? err.message : String(err)}\n`);
          process.exitCode = 2;
          return;
        }
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
      inferred?.dispose();
      process.removeListener('SIGINT', onSignal);
      process.removeListener('SIGTERM', onSignal);
      await cleanup();
    }
  });

// ── init command ─────────────────────────────────────────────────────────────

program
  .command('init')
  .description('Zero-config onboarding: infer a spec (style and layer map) from a project that has none, and write it commented with confidence and evidence; never overwrites a spec')
  .requiredOption('--project <path>', 'Path to TypeScript project (needs src/ and tsconfig.json)')
  .option('-o, --out <path>', 'Spec file to write (default <project>/firewall.spec.yaml); refused if it exists')
  .option('--print', 'Print the proposed spec to stdout and write nothing', false)
  .option('--format <fmt>', 'Summary format: human (stderr) | json (the whole proposal on stdout)', 'human')
  .action(async (opts: { project: string; out?: string; print: boolean; format: string }) => {
    process.exitCode = await runInit(opts, {
      propose: defaultPropose,
      out: (t) => process.stdout.write(t),
      err: (t) => process.stderr.write(t),
    });
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
  .option('--engine <name>', ENGINE_OPTION_HELP)
  .action(async (opts: {
    dir: string;
    spec: string;
    format: string;
    verbose: boolean;
    neo4jUri: string;
    symbolicOnly: boolean;
    neuronalOnly: boolean;
    engine?: string;
  }, cmd: Command) => {
    const graphEngine = engineFor(opts.engine, cmd);
    if (graphEngine === undefined) return;
    // FR-16 (reduced): batch is symbolic-only; without a flag it runs symbolic-only, and
    // `--neuronal-only` reaches runBatch's mode guard, which exits 2 (BR-U3-82).
    const evaluationMode: EvaluationMode = opts.neuronalOnly
      ? resolveEvaluationMode(opts.symbolicOnly, opts.neuronalOnly)
      : 'symbolic-only';

    const batchOpts: BatchOptions = {
      dir: opts.dir,
      spec: opts.spec,
      format: opts.format as 'json' | 'csv',
      verbose: opts.verbose,
      neo4jUri: opts.neo4jUri,
      symbolicOnly: opts.symbolicOnly,
      neuronalOnly: opts.neuronalOnly,
      graphEngine,
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
  .option('--engine <name>', `${ENGINE_OPTION_HELP} Used by the latest-vs-current mode only (--from/--to read snapshots).`)
  .action(async (opts: {
    project?: string;
    spec?: string;
    from?: string;
    to?: string;
    format: string;
    neo4jUri: string;
    persist: boolean;
    engine?: string;
  }, cmd: Command) => {
    // Only the latest-vs-current mode evaluates; snapshot-vs-snapshot opens no graph and prints no engine line.
    let graphEngine: GraphEngine | undefined;
    if (opts.from === undefined && opts.to === undefined) {
      graphEngine = engineFor(opts.engine, cmd);
      if (graphEngine === undefined) return;
    }
    const driftOpts: DriftOptions = {
      project: opts.project,
      spec: opts.spec,
      from: opts.from,
      to: opts.to,
      format: opts.format as 'json' | 'human',
      neo4jUri: opts.neo4jUri,
      persist: opts.persist,
      ...(graphEngine !== undefined && { graphEngine }),
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
  .option('--rules <set>', 'Rule set the template check accepts: v1.3 (default; adds the v1.3 extension templates) | v1.2e (frozen templates only)', 'v1.3')
  .option('--reject-empty-aggregates', 'Reject a ddd spec that keeps FF-DT01/FF-DT02 with no aggregate declared (loop-pilot T1 option b; off by default)', false)
  .option('--engine <name>', `${ENGINE_OPTION_HELP} validate never connects; with cypher-interp it also parses every compiled query with the interpreter (subset check).`)
  .action(async (opts: {
    spec: string;
    project: string;
    rules: string;
    rejectEmptyAggregates: boolean;
    engine?: string;
  }, cmd: Command) => {
    const rules = resolveScoringMode(opts.rules, '--rules');
    if (rules === undefined) return;
    const graphEngine = engineFor(opts.engine, cmd);
    if (graphEngine === undefined) return;
    const parseResult = await parseSpec({ specFilePath: opts.spec });
    if (!parseResult.success) {
      process.stderr.write(`Spec parse error: ${parseResult.errors.map((e) => e.message).join('; ')}\n`);
      process.exitCode = 1;
      return;
    }

    const report = validateSpecAgainstProject(parseResult.data, opts.project, { rules, ...(opts.rejectEmptyAggregates && { rejectEmptyAggregates: true }) });

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

    // C9 parity (FR-08, BR-U1-11): the spec must also compile; the denominator is visible (FR-20, BR-U1-19).
    const spec = parseResult.data;
    // v1.3 rules also resolve the v1.3 module-wiring templates; v1.2e compiles exactly as before.
    const compiled = compileFunctions(compilerInputFromSpec(spec), rules === 'v1.3' ? { ...V13_COMPILE_OPTIONS, v13Templates: true } : {});
    if (!compiled.success) {
      process.stderr.write(`Spec compilation failed with ${String(compiled.errors.length)} error(s):\n`);
      for (const error of compiled.errors) {
        process.stderr.write(`  - [${error.code}] ${error.message}\n`);
      }
      process.exitCode = 1;
      return;
    }
    const { totalCompiled, disabledFunctions } = compiled.data;
    process.stderr.write(
      `declared ${String(spec.fitnessFunctions.length)}, compiled ${String(totalCompiled)}, disabled ${String(disabledFunctions.length)}\n`,
    );
    for (const d of disabledFunctions) {
      process.stderr.write(`  Disabled: ${String(d.id)} ${d.name}: ${d.reason ?? ''}\n`);
    }
    if (graphEngine === 'cypher-interp') {
      // The compiled text is the rule; the interpreter must accept it as is (Docs/v1.3/cypher-interpreter.md §3).
      const queries = [...compiled.data.symbolicQueries, ...compiled.data.hybridPairs.map((h) => h.symbolicQuery)];
      const rejected = interpreterRejections(queries);
      for (const r of rejected) process.stderr.write(`  - [CYPHER_INTERP_UNSUPPORTED] ${r}\n`);
      process.stderr.write(`cypher-interp: ${String(queries.length - rejected.length)}/${String(queries.length)} compiled queries parse\n`);
      if (rejected.length > 0) process.exitCode = 1;
    }
  });

// ── mine-rules command ───────────────────────────────────────────────────────

program
  .command('mine-rules')
  .description('PROPOSE the implicit rules of a project that has no spec: mined from its graph (deterministic, no LLM, no Neo4j), each with evidence, confidence and exceptions (candidate violations), plus a spec that compiles to the existing templates. Proposals to review, not a spec.')
  .option('--project <path>', 'Path to the TypeScript project (its src/ and tsconfig.json are read)', '.')
  .option('--out <path>', 'Write the proposed spec YAML to this file')
  .option('--format <fmt>', 'Output format: human | json', 'human')
  .option('--min-confidence <n>', 'Leave rules below this confidence (0-1) out of the proposed spec (they are still reported)', '0')
  .option('--style <style>', `Skip the style classification and use this style (${ISE_STYLES.join(', ')})`)
  .option('--max-exceptions <n>', 'Exceptions listed per rule in the human output', '5')
  .action(async (opts: { project: string; out?: string; format: string; minConfidence: string; style?: string; maxExceptions: string }) => {
    const minConfidence = Number(opts.minConfidence);
    if (!Number.isFinite(minConfidence) || minConfidence < 0 || minConfidence > 1) {
      process.stderr.write('Error: --min-confidence takes a number between 0 and 1\n');
      process.exitCode = 2;
      return;
    }
    if (opts.style !== undefined && !(ISE_STYLES as readonly string[]).includes(opts.style)) {
      process.stderr.write(`Error: --style takes one of ${ISE_STYLES.join(', ')}\n`);
      process.exitCode = 2;
      return;
    }
    if (opts.format !== 'human' && opts.format !== 'json') {
      process.stderr.write('Error: --format takes human or json\n');
      process.exitCode = 2;
      return;
    }
    try {
      const proposal = await proposeRules(path.resolve(opts.project), {
        presetsDir: defaultPresetsDir(), minConfidence, ...(opts.style !== undefined ? { style: opts.style as IseStyle } : {}),
      });
      if (opts.out !== undefined) fs.writeFileSync(opts.out, proposal.specYaml);
      process.stdout.write(opts.format === 'json'
        ? JSON.stringify(summariseProposal(proposal, { includeSpec: opts.out === undefined }), null, 2) + '\n'
        : formatProposalHuman(proposal, Number(opts.maxExceptions) || 5));
      if (opts.out !== undefined) process.stderr.write(`Proposed spec written to ${opts.out}\n`);
      process.exitCode = 0;
    } catch (e: unknown) {
      process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
      process.exitCode = 2;
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
  .option('--engine <name>', ENGINE_OPTION_HELP)
  .action(async (opts: {
    spec: string;
    project: string;
    output: string;
    verbose: boolean;
    neo4jUri: string;
    engine?: string;
  }, cmd: Command) => {
    const graphEngine = engineFor(opts.engine, cmd);
    if (graphEngine === undefined) return;
    // BR-U3-80: no default password; stop before any connection. The in-process engine opens none and reads none.
    const neo4jPassword = graphEngine === 'cypher-interp' ? '' : requireEnvForCli('NEO4J_PASSWORD');
    if (neo4jPassword === undefined) return;

    const config: PipelineConfig = {
      projectPath: opts.project,
      specFilePath: opts.spec,
      neo4jUri: opts.neo4jUri,
      neo4jUser: process.env['NEO4J_USER'] ?? 'neo4j',
      neo4jPassword,
      evaluationMode: 'symbolic-only' as EvaluationMode,
      pipelineMode: 'stateless',
      persist: false,
      diff: false,
      verbose: opts.verbose,
      apgStorePath: process.env['APG_STORE_PATH'] ?? '.apg-store',
      ...(graphEngine !== 'neo4j' && { graphEngine }),
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

withLLMOptions(program
  .command('report')
  .description('Generate an interactive HTML report from evaluation results'))
  .requiredOption('--project <path>', 'Path to TypeScript project')
  .requiredOption('--spec <path>', 'Path to AoC YAML spec')
  .option('-o, --output <path>', 'Output HTML file path', 'report.html')
  .option('--verbose', 'Enable verbose logging', false)
  .option('--neo4j-uri <uri>', 'Neo4j bolt URI', process.env['NEO4J_URI'] ?? 'bolt://localhost:7687')
  .option('--symbolic-only', 'Run symbolic evaluation only', false)
  .option('--neuronal-only', 'Run neuronal evaluation only', false)
  .option('--engine <name>', ENGINE_OPTION_HELP)
  .action(async (opts: LLMCliOpts & {
    project: string;
    spec: string;
    output: string;
    verbose: boolean;
    neo4jUri: string;
    symbolicOnly: boolean;
    neuronalOnly: boolean;
    engine?: string;
  }, cmd: Command) => {
    const evaluationMode = resolveEvaluationMode(opts.symbolicOnly, opts.neuronalOnly);
    const graphEngine = engineFor(opts.engine, cmd);
    if (graphEngine === undefined) return;
    // BR-U3-80: no default password; stop before any connection. The in-process engine opens none and reads none.
    const neo4jPassword = graphEngine === 'cypher-interp' ? '' : requireEnvForCli('NEO4J_PASSWORD');
    if (neo4jPassword === undefined) return;
    // U4 C9 hunk: judge options parsed before any connection (no key fallback, D-U0-8)
    const llmConfig = llmConfigFor(evaluationMode, opts.project, opts);
    if (llmConfig === null) return;

    const config: PipelineConfig = {
      projectPath: opts.project,
      specFilePath: opts.spec,
      neo4jUri: opts.neo4jUri,
      neo4jUser: process.env['NEO4J_USER'] ?? 'neo4j',
      neo4jPassword,
      evaluationMode,
      pipelineMode: 'stateless',
      persist: false,
      diff: false,
      verbose: opts.verbose,
      apgStorePath: process.env['APG_STORE_PATH'] ?? '.apg-store',
      llmConfig,
      ...(graphEngine !== 'neo4j' && { graphEngine }),
    };

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
        process.exit(exitCodeFromErrors(pipelineResult.errors));
      }

      const report = context.getReport();
      const parsedSpec = context.getParsedSpec();
      const apgResult = context.getApgResult();
      const evaluationResults = (() => {
        try { return context.getEvaluationResults(); } catch { return undefined; }
      })();

      const projectName = opts.project.split('/').filter(Boolean).pop() ?? opts.project;

      const reportResult = generateReport({
        evaluationReport: report,
        parsedSpec,
        apgResult,
        evaluationResults,
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

// ── check command (diff-aware PR gate, Docs/v1.3/ci-gate.md) ────────────────

program
  .command('check')
  .description('Diff-aware gate: evaluate two commits, report findings new in head, fixed and unchanged; exit 1 only on new blocking findings')
  .requiredOption('--base <ref>', 'Base commit (the pull request base)')
  .requiredOption('--head <ref>', 'Head commit (the pull request head)')
  .requiredOption('--spec <path>', 'AoC YAML spec, relative to the repository root (read from the base commit unless --spec-from head)')
  .option('--project <dir>', 'Project directory relative to the repository root', '.')
  .option('--repo <path>', 'Git repository', '.')
  .option('--engine <name>', 'Engine: neo4j (full symbolic pipeline; needs NEO4J_PASSWORD) | lexical (in-process, no database; import and naming rules only)', 'neo4j')
  .option('--spec-from <commit>', 'Commit the spec is read from: base | head', 'base')
  .option('--format <fmt>', 'Output format: human | markdown | json', 'human')
  .option('--out <path>', 'Write the --format output to this file instead of the terminal')
  .option('--json-out <path>', 'Also write the JSON result to this file')
  .option('--neo4j-uri <uri>', 'Neo4j bolt URI (neo4j engine)', process.env.NEO4J_URI ?? 'bolt://localhost:7687')
  .option('--verbose', 'Enable verbose logging', false)
  .action(async (opts: {
    base: string;
    head: string;
    spec: string;
    project: string;
    repo: string;
    engine: string;
    specFrom: string;
    format: string;
    out?: string;
    jsonOut?: string;
    neo4jUri: string;
    verbose: boolean;
  }) => {
    if (opts.engine !== 'neo4j' && opts.engine !== 'lexical') {
      process.stderr.write('Error: --engine must be one of neo4j | lexical\n');
      process.exitCode = 2;
      return;
    }
    if (opts.specFrom !== 'base' && opts.specFrom !== 'head') {
      process.stderr.write('Error: --spec-from must be one of base | head\n');
      process.exitCode = 2;
      return;
    }
    if (!['human', 'markdown', 'json'].includes(opts.format)) {
      process.stderr.write('Error: --format must be one of human | markdown | json\n');
      process.exitCode = 2;
      return;
    }
    let engine: GateEngine;
    if (opts.engine === 'neo4j') {
      // BR-U3-80: no default password; stop before any connection.
      const neo4jPassword = requireEnvForCli('NEO4J_PASSWORD');
      if (neo4jPassword === undefined) return;
      engine = neo4jEngine({
        neo4jUri: opts.neo4jUri,
        neo4jUser: process.env.NEO4J_USER ?? 'neo4j',
        neo4jPassword,
        apgStorePath: process.env.APG_STORE_PATH ?? '.apg-store',
        verbose: opts.verbose,
        makePipeline: createPipeline,
      });
    } else {
      engine = lexicalEngine();
    }
    try {
      const result = await runCheck({
        repo: opts.repo,
        base: opts.base,
        head: opts.head,
        spec: opts.spec,
        project: opts.project,
        specFrom: opts.specFrom,
        engine,
        ...(opts.verbose ? { log: (t: string) => { process.stderr.write(t); } } : {}),
      });
      const text = opts.format === 'json' ? formatGateJSON(result) + '\n' : opts.format === 'markdown' ? formatGateMarkdown(result) : formatGateHuman(result) + '\n';
      if (opts.out !== undefined) fs.writeFileSync(opts.out, text);
      else if (opts.format === 'human') process.stderr.write(text);
      else process.stdout.write(text);
      if (opts.jsonOut !== undefined) fs.writeFileSync(opts.jsonOut, formatGateJSON(result) + '\n');
      process.exitCode = result.verdict === 'fail' ? 1 : 0;
    } catch (err) {
      process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 2;
    }
  });

export { program };

/**
 * CLI entry point. Call with process.argv or custom argv for testing.
 */
export async function main(argv: string[] = process.argv): Promise<void> {
  await program.parseAsync(argv);
}
