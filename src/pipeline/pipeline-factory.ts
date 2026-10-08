import * as fs from 'node:fs';
import YAML from 'yaml';
import type { PipelineConfig } from './types.js';
import type { PipelineCommand } from '../shared/interfaces/pipeline-stage.js';
import type { DomainResult as DomainResultType } from '../shared/errors/domain-result.js';
import type { GraphRepository } from '../shared/interfaces/graph-repository.js';
import type { SnapshotStore } from '../shared/interfaces/snapshot-store.js';
import type { LLMProvider } from '../shared/interfaces/llm-provider.js';
import type { SharedSnapshotState } from './commands/snapshot-load-command.js';
import { PipelineExecutor } from './pipeline-executor.js';
import type { FirewallContext } from '../shared/context/firewall-context.js';
import { ScrubbingFirewallContext } from './scrubbing-context.js';
import { neo4jScrubPolicy } from '../shared/errors/scrub.js';
import { runId as makeRunId } from '../shared/types/value-objects.js';
import { Neo4jRepository } from '../neo4j-ingestion/neo4j-repository.js';
import { FileSystemSnapshotStore } from '../neo4j-ingestion/fs-snapshot-store.js';
import * as path from 'node:path';
import { createLLMProvider } from '../llm-critic/provider-factory.js';
import { judgeKnownSecrets, judgeRunSettingsOf, neuralRowsOf, specShaOf } from '../llm-critic/judge-stage.js';
import type { JudgeRunHolder, JudgeStageSettings } from '../llm-critic/judge-stage.js';

// Commands
import { ExtractCommand } from './commands/extract-command.js';
import { ParseCommand } from './commands/parse-command.js';
import { ParallelCommand } from './commands/parallel-command.js';
import { IngestCommand } from './commands/ingest-command.js';
import { CompileCommand } from './commands/compile-command.js';
import { RouteEvaluateCommand } from './commands/route-evaluate-command.js';
import { SymbolicEvaluateCommand } from './commands/symbolic-evaluate-command.js';
import { NeuronalEvaluateCommand } from './commands/neuronal-evaluate-command.js';
import { ScoreCommand } from './commands/score-command.js';
import { SnapshotSaveCommand } from './commands/snapshot-save-command.js';
import { SnapshotLoadCommand } from './commands/snapshot-load-command.js';
import { DriftDetectCommand } from './commands/drift-detect-command.js';
import { AssembleReportCommand } from './commands/assemble-report-command.js';
import type { AssembleReportConfig } from './commands/assemble-report-command.js';
import { NO_JUDGE } from '../scoring-engine/report-builder.js';
import type { JudgeProvenance } from '../shared/types/evaluation.js';
import type { CompileFactsHolder } from './commands/compile-command.js';

/**
 * The value returned by `createPipeline`. Holds everything the caller needs
 * to run the pipeline and clean up resources afterwards.
 */
export interface PipelineBundle {
  /** Fully-wired executor — call `.execute()` to run the pipeline. */
  readonly executor: PipelineExecutor;
  /** The shared FirewallContext (useful for reading audit/warnings post-run). */
  readonly context: FirewallContext;
  /** The command sequence in execution order; the last is always `assemble-report` (BR-U3-50). */
  readonly commands: readonly PipelineCommand[];
  /** Must be called in a `finally` block to close the Neo4j driver. */
  readonly cleanup: () => Promise<void>;
}

/**
 * Composition root: wires all services and commands based on PipelineConfig.
 *
 * The command sequence is:
 *   1. (optional) SnapshotLoad          — if `--diff`
 *   2. ExtractAPG || ParseSpec          — parallel
 *   3. IngestAPG                        — sequential (needs APG + Spec)
 *   4. CompileFunctions                 — sequential (needs ParsedSpec)
 *   5. Evaluate (mode-dependent)        — route-and-evaluate | symbolic | neuronal
 *   6. Score                            — sequential (needs EvaluationResults + ParsedSpec)
 *   7. (optional) SnapshotSave          — if `--persist` and commitSha present
 *   8. (optional) DriftDetect           — if `--diff`
 *   9. AssembleReport                   — always last: the one EvaluationReport (BR-U3-50)
 */
export function createPipeline(config: PipelineConfig): PipelineBundle {
  // ------------------------------------------------------------------
  // 1. Create the shared FirewallContext
  // ------------------------------------------------------------------
  // NFR-05 (BR-U3-58): one scrub policy per run; warnings and audit entries are scrubbed on entry.
  const scrubPolicy = neo4jScrubPolicy(config);
  const context = new ScrubbingFirewallContext(makeRunId(`run-${Date.now()}`), scrubPolicy);

  // ------------------------------------------------------------------
  // 2. Instantiate infrastructure services
  // ------------------------------------------------------------------
  const graphRepo: GraphRepository = new Neo4jRepository({
    neo4jUri: config.neo4jUri,
    neo4jUser: config.neo4jUser,
    neo4jPassword: config.neo4jPassword,
    apgStorePath: config.apgStorePath,
  });

  const snapshotStore: SnapshotStore = new FileSystemSnapshotStore(
    config.apgStorePath,
  );

  // LLM provider is only needed for neuronal / full evaluation modes.
  // U4 C9 hunk (D-U4-7, D-U4-8): the inner provider is built here; the evaluation command wraps it
  // once in the cassette decorator (record-mode C14 pre-flight) through the judge stage, which
  // also carries the run settings, the manifest key and the holder the report assembly reads.
  let llmProvider: LLMProvider | undefined;
  let judgeStage: JudgeStageSettings | undefined;
  const judgeHolder: JudgeRunHolder = {};
  if (config.evaluationMode !== 'symbolic-only') {
    const projectRoot = path.resolve(config.projectPath);
    llmProvider = createLLMProvider(config.llmConfig, { projectRoot });
    judgeStage = {
      projectRoot,
      specSha: specShaOf(config.specFilePath),
      run: judgeRunSettingsOf(config.llmConfig),
      knownSecrets: judgeKnownSecrets(scrubPolicy.secrets), // BR-U4-CAS-07: env-derived list plus the Neo4j policy secrets
      holder: judgeHolder,
    };
  }

  // ------------------------------------------------------------------
  // 3. Build the command sequence
  // ------------------------------------------------------------------
  const commands: PipelineCommand[] = [];

  // Shared mutable bucket used to pass the loaded snapshot from
  // SnapshotLoadCommand to DriftDetectCommand without context coupling.
  const sharedState: SharedSnapshotState = {};

  // ---- Optional: load previous snapshot for drift comparison ----------
  if (config.diff) {
    commands.push(
      new SnapshotLoadCommand(snapshotStore, sharedState),
    );
  }

  // ---- Pre-read spec exclude paths for APG extraction ------------------
  // The spec and APG extraction run in parallel, so we do a lightweight
  // YAML read here to get exclude patterns before building commands.
  let specExcludePaths: string[] = [];
  try {
    const rawYaml = fs.readFileSync(config.specFilePath, 'utf-8');
    const parsed = YAML.parse(rawYaml) as Record<string, unknown>;
    const rawExcludes = parsed['default_exclude_paths'];
    if (Array.isArray(rawExcludes)) {
      specExcludePaths = rawExcludes.map(String);
    }
  } catch {
    // If we can't read the spec, ParseCommand will report the error later.
  }

  // ---- Stage 1: Extract APG + Parse Spec (parallel) -------------------
  commands.push(
    new ParallelCommand([
      new ExtractCommand(config.projectPath, specExcludePaths),
      new ParseCommand(config.specFilePath),
    ]),
  );

  // ---- Stage 2: Ingest APG into Neo4j ---------------------------------
  const ingestConfig: import('./commands/ingest-command.js').IngestCommandConfig = {
    mode: config.pipelineMode,
    apgStorePath: config.apgStorePath,
    ...(config.commitSha !== undefined && { commitSha: config.commitSha }),
  };
  commands.push(new IngestCommand(graphRepo, snapshotStore, ingestConfig));

  // ---- Stage 3: Compile fitness functions -----------------------------
  // CompileCommand records the declared-side counts that AssembleReportCommand reads (BR-U3-52).
  const compileFacts: CompileFactsHolder = {};
  commands.push(new CompileCommand(compileFacts));

  // ---- Stage 4: Evaluate (mode-dependent) -----------------------------
  switch (config.evaluationMode) {
    case 'full':
      commands.push(
        new RouteEvaluateCommand(graphRepo, llmProvider!, config.evaluationMode, judgeStage),
      );
      break;

    case 'symbolic-only':
      commands.push(new SymbolicEvaluateCommand(graphRepo, scrubPolicy.secrets));
      break;

    case 'neuronal-only':
      commands.push(new NeuronalEvaluateCommand(graphRepo, llmProvider!, judgeStage));
      break;
  }

  // ---- Stage 5: Score -------------------------------------------------
  // ScoreCommand reads ParsedSpec from the context at execution time to
  // obtain scoring weights, verdict thresholds, and confidence thresholds.
  // We must supply them at construction because ScoreCommandConfig is a
  // static value. To avoid reading the spec twice we use a lazy proxy
  // command that defers ScoreCommand construction until execute().
  commands.push(new LazyScoreCommand(graphRepo, config));

  // ---- Optional: save snapshot ----------------------------------------
  if (config.persist && config.commitSha !== undefined) {
    commands.push(
      new SnapshotSaveCommand(snapshotStore, config.commitSha, config.projectPath),
    );
  }

  // ---- Optional: detect drift -----------------------------------------
  if (config.diff && config.commitSha !== undefined) {
    commands.push(
      new DriftDetectCommand(sharedState, config.commitSha),
    );
  }

  // ---- Last: assemble the one report (BR-U3-50) -----------------------
  // The timing source reads the executor (created below) when the command runs: timings at assembly time.
  // U4 C9 hunk (D-U4-8, BR-U3-63, BR-U3-65): judge provenance and neural rows are read at assembly
  // time from the holder the evaluation command filled; symbolic-only keeps the NO_JUDGE stub.
  const assembleConfig: AssembleReportConfig = {
    mode: config.evaluationMode,
    timingSource: () => executor.getTimings(),
    compileFacts,
    scrubPolicy,
  };
  commands.push(new AssembleReportCommand(judgeStage === undefined ? assembleConfig : {
    ...assembleConfig,
    // a getter, not a value: the provenance exists only once the evaluation command has run
    get judge(): JudgeProvenance { return judgeHolder.judge ?? NO_JUDGE; },
    neuralRows: () => neuralRowsOf(judgeHolder),
  }));

  // ------------------------------------------------------------------
  // 4. Create the executor
  // ------------------------------------------------------------------
  const executor = new PipelineExecutor(commands, context);

  // ------------------------------------------------------------------
  // 5. Cleanup function (call in `finally`)
  // ------------------------------------------------------------------
  const cleanup = async (): Promise<void> => {
    await graphRepo.close();
  };

  return { executor, context, commands, cleanup };
}

// ======================================================================
// Internal helper: LazyScoreCommand
// ======================================================================

/**
 * A thin adapter that defers ScoreCommand construction until execution,
 * so that ParsedSpec (which lives on the context) can be read for
 * scoring weights, verdict thresholds, etc.
 */
class LazyScoreCommand implements PipelineCommand {
  readonly name = 'compute-scores';

  constructor(
    private readonly graphRepository: GraphRepository,
    private readonly config: PipelineConfig,
  ) {}

  async execute(context: FirewallContext): Promise<DomainResultType<void>> {
    const parsedSpec = context.getParsedSpec();

    const scoreCmd = new ScoreCommand(this.graphRepository, {
      scoringWeights: parsedSpec.scoringWeights,
      ...(parsedSpec.fullModeWeights !== undefined && { fullModeWeights: parsedSpec.fullModeWeights }),
      verdictThresholds: parsedSpec.verdictThresholds,
      confidenceThresholds: parsedSpec.confidenceThresholds,
      evaluationMode: this.config.evaluationMode,
      projectPath: this.config.projectPath,
      specVersion: parsedSpec.specVersion,
      fitnessFunctions: parsedSpec.fitnessFunctions,
    });

    return scoreCmd.execute(context);
  }
}
