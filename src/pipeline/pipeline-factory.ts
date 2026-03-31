import type { PipelineConfig } from './types.js';
import type { PipelineCommand } from '../shared/interfaces/pipeline-stage.js';
import type { DomainResult as DomainResultType } from '../shared/errors/domain-result.js';
import type { GraphRepository } from '../shared/interfaces/graph-repository.js';
import type { SnapshotStore } from '../shared/interfaces/snapshot-store.js';
import type { LLMProvider } from '../shared/interfaces/llm-provider.js';
import type { SharedSnapshotState } from './commands/snapshot-load-command.js';
import { PipelineExecutor } from './pipeline-executor.js';
import { FirewallContext } from '../shared/context/firewall-context.js';
import { runId as makeRunId } from '../shared/types/value-objects.js';
import { Neo4jRepository } from '../neo4j-ingestion/neo4j-repository.js';
import { FileSystemSnapshotStore } from '../neo4j-ingestion/fs-snapshot-store.js';
import { MockLLMProvider } from '../llm-critic/index.js';

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

/**
 * The value returned by `createPipeline`. Holds everything the caller needs
 * to run the pipeline and clean up resources afterwards.
 */
export interface PipelineBundle {
  /** Fully-wired executor — call `.execute()` to run the pipeline. */
  readonly executor: PipelineExecutor;
  /** The shared FirewallContext (useful for reading audit/warnings post-run). */
  readonly context: FirewallContext;
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
 */
export function createPipeline(config: PipelineConfig): PipelineBundle {
  // ------------------------------------------------------------------
  // 1. Create the shared FirewallContext
  // ------------------------------------------------------------------
  const context = new FirewallContext(makeRunId(`run-${Date.now()}`));

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

  // LLM provider is only needed for neuronal / full evaluation modes
  let llmProvider: LLMProvider | undefined;
  if (config.evaluationMode !== 'symbolic-only') {
    // TODO: Replace MockLLMProvider with real ClaudeProvider / OpenAIProvider
    //       once those modules exist. The factory will read config.llmConfig.provider
    //       to decide which concrete class to instantiate.
    llmProvider = new MockLLMProvider();
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

  // ---- Stage 1: Extract APG + Parse Spec (parallel) -------------------
  commands.push(
    new ParallelCommand([
      new ExtractCommand(config.projectPath),
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
  commands.push(new CompileCommand());

  // ---- Stage 4: Evaluate (mode-dependent) -----------------------------
  switch (config.evaluationMode) {
    case 'full':
      commands.push(
        new RouteEvaluateCommand(graphRepo, llmProvider!, config.evaluationMode),
      );
      break;

    case 'symbolic-only':
      commands.push(new SymbolicEvaluateCommand(graphRepo));
      break;

    case 'neuronal-only':
      commands.push(new NeuronalEvaluateCommand(graphRepo, llmProvider!));
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

  return { executor, context, cleanup };
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
    });

    return scoreCmd.execute(context);
  }
}
