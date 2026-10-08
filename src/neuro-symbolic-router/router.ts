import type {
  CompiledFunctions, FunctionFailure, NeuronalFunctionResult, NeuronalInstruction, SymbolicFunctionResult,
} from '../shared/types/evaluation.js';
import type { EvaluationMode } from '../shared/types/enums.js';
import type { PipelineStage } from '../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../shared/context/firewall-context.js';
import type { PipelineWarning } from '../shared/errors/domain-result.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import { evaluateSymbolic } from '../evaluation-engine/symbolic-evaluator.js';
import { evaluateNeuronal } from '../llm-critic/llm-critic.js';
import type { NeuronalEvalOutput } from '../llm-critic/llm-critic.js';
import type { RunCompleteness, RunManifest } from '../llm-critic/types.js';
import type { RouterInput, RouterError, RoutedEvaluation } from './types.js';

/**
 * C5 router (U4 single owner, BR-U4-RTR-01..03; aligned with BR-U3-15 and BR-U3-53).
 *
 * Symbolic-only runs the symbolic queries only and neuronal-only the neuronal instructions only;
 * in both, hybrid pairs run in neither half (U3 counts them as `skippedByMode`) and
 * `totalCompiled` is never overridden. Full mode runs every symbolic query and every hybrid
 * symbolic half first; a hybrid pair's neural half runs only when its symbolic half ran and found
 * no violation. A symbolic half with violations is marked `neuralSkipped: 'symbolic-fail'`; a
 * symbolic half that failed to run (`EVAL_001`/`EVAL_002`) gets no neural half and its failure is
 * forwarded. All neural instructions go to the critic in one call (one pool, one completeness),
 * with `projectRoot` and `NeuronalRunOptions`; symbolic and neural failures are both forwarded.
 * The LLM provider is dereferenced only when a neural half runs.
 */
export async function routeAndEvaluate(input: RouterInput): Promise<DomainResult<RoutedEvaluation>> {
  const { compiledFunctions, mode, graphRepository } = input;
  const warnings: PipelineWarning[] = [];

  // 1. Filter by mode
  const filtered = filterByMode(compiledFunctions, mode);
  if (filtered.symbolicQueries.length === 0 && filtered.neuronalInstructions.length === 0 && filtered.hybridPairs.length === 0) {
    return DomainResult.fail<RoutedEvaluation>([routerError('NO_FUNCTIONS_TO_EVALUATE', 'No functions to evaluate after mode filtering')]);
  }

  const symbolicResults: SymbolicFunctionResult[] = [];
  const neuronalResults: NeuronalFunctionResult[] = [];
  const failures: FunctionFailure[] = [];

  // 2. Symbolic half: symbolic queries, then the hybrid symbolic halves (full mode only)
  const queries = [...filtered.symbolicQueries, ...filtered.hybridPairs.map((p) => p.symbolicQuery)];
  let symbolicRan = false;
  if (queries.length > 0) {
    const symResult = await evaluateSymbolic({
      queries,
      graphRepository,
      ...(input.knownSecrets !== undefined && { knownSecrets: input.knownSecrets }),
      ...(input.apg !== undefined && { apg: input.apg }),
    });
    if (symResult.success) {
      symbolicRan = true;
      symbolicResults.push(...symResult.data.results);
      failures.push(...symResult.data.failures);
      warnings.push(...symResult.data.warnings);
    } else {
      warnings.push({ code: 'ROUTER_001', message: `Symbolic evaluation failed: ${symResult.errors[0]?.message ?? ''}`, stage: 'neuro-symbolic-router' });
    }
  }

  // 3. Hybrid pairs (full mode): neural half only after a symbolic half that ran and passed
  const neural: NeuronalInstruction[] = [...filtered.neuronalInstructions];
  for (const pair of filtered.hybridPairs) {
    const id = String(pair.functionId);
    if (!symbolicRan || failures.some((f) => String(f.functionId) === id)) continue; // BR-U3-53
    const index = symbolicResults.findIndex((r) => String(r.functionId) === id);
    const sym = symbolicResults[index];
    if (sym === undefined) continue;
    if (!sym.passed) {
      symbolicResults[index] = { ...sym, neuralSkipped: 'symbolic-fail' };   // BR-U4-RTR-02
      continue;
    }
    neural.push(pair.neuronalInstruction);
  }

  // 4. Neural half: one critic call over every neural instruction
  let neuralCompleteness: RunCompleteness = { status: 'complete' };
  let neuralManifest: RunManifest | undefined;
  let neuralOutput: NeuronalEvalOutput | undefined;
  if (neural.length > 0) {
    if (input.llmProvider === undefined) {
      return DomainResult.fail<RoutedEvaluation>([routerError('LLM_NOT_CONFIGURED', `${mode} mode needs an LLM provider for ${String(neural.length)} neural function(s)`)]);
    }
    const neurResult = await evaluateNeuronal({
      instructions: neural,
      graphRepository,
      provider: input.llmProvider,
      ...(input.projectRoot !== undefined && { projectRoot: input.projectRoot }),
      ...(input.neuronalOptions !== undefined && { options: input.neuronalOptions }),
      ...(input.excludePaths !== undefined && { excludePaths: input.excludePaths }),
      ...(input.adrProse !== undefined && { adrProse: input.adrProse }),
      ...(input.knownSecrets !== undefined && { knownSecrets: input.knownSecrets }),
    });
    if (!neurResult.success) {
      // A configuration error (e.g. LLM_BASELINE_SELECTION_MISSING, SEL-07): no evaluation, exit 2
      return DomainResult.fail<RoutedEvaluation>(neurResult.errors);
    }
    neuralOutput = neurResult.data;
    neuronalResults.push(...neurResult.data.results);
    failures.push(...neurResult.data.failures);
    warnings.push(...neurResult.data.warnings);
    neuralCompleteness = neurResult.data.completeness;
    neuralManifest = neurResult.data.manifest;
  }

  const results: RoutedEvaluation = {
    symbolicResults,
    neuronalResults,
    failures,
    neuralCompleteness,
    ...(neuralManifest !== undefined && { neuralManifest }),
    ...(neuralOutput !== undefined && { neuralOutput }),
  };
  return DomainResult.ok(results, warnings.length > 0 ? warnings : undefined);
}

/**
 * Filter compiled functions by evaluation mode (BR-U4-RTR-01, BR-U3-15). Hybrid pairs run only in
 * full mode; in symbolic-only and neuronal-only they run in neither half and U3 counts them as
 * `skippedByMode`. `totalCompiled` is always the compiler's value, never recomputed here.
 */
export function filterByMode(compiled: CompiledFunctions, mode: EvaluationMode): CompiledFunctions {
  switch (mode) {
    case 'symbolic-only':
      return { ...compiled, neuronalInstructions: [], hybridPairs: [] };
    case 'neuronal-only':
      return { ...compiled, symbolicQueries: [], hybridPairs: [] };
    case 'full':
    default:
      return compiled;
  }
}

// ── PipelineStage Implementation ──────────────────────────────────────────────

export class RouterStage implements PipelineStage<RouterInput, RoutedEvaluation> {
  readonly name = 'neuro-symbolic-router';

  async execute(input: RouterInput, context: FirewallContext): Promise<DomainResult<RoutedEvaluation>> {
    const start = Date.now();
    const result = await routeAndEvaluate(input);

    if (result.success) {
      context.setEvaluationResults(result.data);
      context.addAuditEntry({
        timestamp: new Date().toISOString(),
        stage: 'neuro-symbolic-router',
        event: 'Evaluation completed',
        durationMs: Date.now() - start,
        metadata: {
          symbolicCount: result.data.symbolicResults.length,
          neuronalCount: result.data.neuronalResults.length,
          mode: input.mode,
        },
      });
    } else {
      context.addAuditEntry({
        timestamp: new Date().toISOString(),
        stage: 'neuro-symbolic-router',
        event: `Routing failed: ${result.errors[0]?.message ?? ''}`,
        durationMs: Date.now() - start,
      });
    }

    return result;
  }
}

function routerError(code: RouterError['code'], message: string): RouterError {
  return { code, message, stage: 'router', critical: true };
}
