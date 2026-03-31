import type {
  CompiledFunctions,
  EvaluationResults, SymbolicFunctionResult, NeuronalFunctionResult,
} from '../shared/types/evaluation.js';
import type { EvaluationMode } from '../shared/types/enums.js';
import type { PipelineStage } from '../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../shared/context/firewall-context.js';
import type { PipelineWarning } from '../shared/errors/domain-result.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import { evaluateSymbolic } from '../evaluation-engine/symbolic-evaluator.js';
import { evaluateNeuronal } from '../llm-critic/llm-critic.js';
import type { RouterInput, RouterError } from './types.js';

/**
 * Route compiled functions to symbolic and neuronal evaluation paths.
 */
export async function routeAndEvaluate(input: RouterInput): Promise<DomainResult<EvaluationResults>> {
  const { compiledFunctions, mode, graphRepository, llmProvider } = input;
  const warnings: PipelineWarning[] = [];

  // 1. Filter by mode
  const filtered = filterByMode(compiledFunctions, mode);
  if (filtered.symbolicQueries.length === 0 && filtered.neuronalInstructions.length === 0 && filtered.hybridPairs.length === 0) {
    return DomainResult.fail<EvaluationResults>([routerError('NO_FUNCTIONS_TO_EVALUATE', 'No functions to evaluate after mode filtering')]);
  }

  const symbolicResults: SymbolicFunctionResult[] = [];
  const neuronalResults: NeuronalFunctionResult[] = [];

  // 2. Dispatch symbolic functions
  if (filtered.symbolicQueries.length > 0) {
    const symResult = await evaluateSymbolic({
      queries: filtered.symbolicQueries,
      graphRepository,
    });
    if (symResult.success) {
      symbolicResults.push(...symResult.data.results);
      for (const w of symResult.data.warnings) warnings.push(w);
    } else {
      warnings.push({ code: 'ROUTER_001', message: `Symbolic evaluation failed: ${symResult.errors[0]?.message}`, stage: 'neuro-symbolic-router' });
    }
  }

  // 3. Dispatch neuronal functions
  if (filtered.neuronalInstructions.length > 0) {
    const neurResult = await evaluateNeuronal({
      instructions: filtered.neuronalInstructions,
      graphRepository,
      provider: llmProvider,
    });
    if (neurResult.success) {
      neuronalResults.push(...neurResult.data.results);
      for (const w of neurResult.data.warnings) warnings.push(w);
    } else {
      warnings.push({ code: 'ROUTER_001', message: `Neuronal evaluation failed: ${neurResult.errors[0]?.message}`, stage: 'neuro-symbolic-router' });
    }
  }

  // 4. Dispatch hybrid functions — sequential (Q1:A)
  for (const pair of filtered.hybridPairs) {
    // Run symbolic first
    const symResult = await evaluateSymbolic({
      queries: [pair.symbolicQuery],
      graphRepository,
    });

    if (symResult.success && symResult.data.results.length > 0) {
      const symFnResult = symResult.data.results[0]!;
      symbolicResults.push(symFnResult);

      // Q1:A — If symbolic FAILS, skip neuronal
      if (!symFnResult.passed) {
        continue;
      }
    }

    // Symbolic passed (or failed to run) → run neuronal
    const neurResult = await evaluateNeuronal({
      instructions: [pair.neuronalInstruction],
      graphRepository,
      provider: llmProvider,
    });
    if (neurResult.success && neurResult.data.results.length > 0) {
      neuronalResults.push(neurResult.data.results[0]!);
    }
  }

  const results: EvaluationResults = { symbolicResults, neuronalResults };
  return DomainResult.ok(results, warnings.length > 0 ? warnings : undefined);
}

/**
 * Filter compiled functions by evaluation mode.
 */
function filterByMode(compiled: CompiledFunctions, mode: EvaluationMode): CompiledFunctions {
  switch (mode) {
    case 'symbolic-only':
      return {
        symbolicQueries: compiled.symbolicQueries,
        neuronalInstructions: [],
        hybridPairs: compiled.hybridPairs.map((p) => p), // keep hybrid, but only symbolic part runs
        totalCompiled: compiled.symbolicQueries.length + compiled.hybridPairs.length,
        warnings: compiled.warnings,
      };
    case 'neuronal-only':
      return {
        symbolicQueries: [],
        neuronalInstructions: compiled.neuronalInstructions,
        hybridPairs: [], // skip hybrid entirely in neuronal-only (no symbolic to run first)
        totalCompiled: compiled.neuronalInstructions.length,
        warnings: compiled.warnings,
      };
    case 'full':
    default:
      return compiled;
  }
}

// ── PipelineStage Implementation ──────────────────────────────────────────────

export class RouterStage implements PipelineStage<RouterInput, EvaluationResults> {
  readonly name = 'neuro-symbolic-router';

  async execute(input: RouterInput, context: FirewallContext): Promise<DomainResult<EvaluationResults>> {
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
        event: `Routing failed: ${result.errors[0]?.message}`,
        durationMs: Date.now() - start,
      });
    }

    return result;
  }
}

function routerError(code: RouterError['code'], message: string): RouterError {
  return { code, message, stage: 'router', critical: true };
}
