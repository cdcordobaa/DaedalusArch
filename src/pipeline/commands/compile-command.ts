import type { PipelineCommand } from '../../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../../shared/context/firewall-context.js';
import type { DomainResult as DomainResultType } from '../../shared/errors/domain-result.js';
import { DomainResult } from '../../shared/errors/domain-result.js';
import { compileFunctions } from '../../fitness-compiler/index.js';
import { compilerInputFromSpec } from '../../fitness-compiler/compiler-input.js';
import type { DomainWarning } from '../../shared/errors/domain-result.js';
import { compileFactsOf } from '../../scoring-engine/report-builder.js';
import type { CompileFacts } from '../../scoring-engine/report-builder.js';
import { toPipelineError, toPipelineWarning } from './map-helpers.js';

/**
 * Run-scoped holder for the declared-side counts (BR-U3-52), written by `CompileCommand` next to the
 * `CompiledFunctions` it stores on the context and read by `AssembleReportCommand` (BR-U3-50).
 * `createPipeline` shares one holder between the two commands, as it does `SharedSnapshotState`.
 */
export interface CompileFactsHolder {
  facts?: CompileFacts;
}

export class CompileCommand implements PipelineCommand {
  readonly name = 'compile-functions';

  constructor(private readonly factsHolder: CompileFactsHolder = {}) {}

  async execute(context: FirewallContext): Promise<DomainResultType<void>> {
    const parsedSpec = context.getParsedSpec();

    const result = compileFunctions(compilerInputFromSpec(parsedSpec));

    if (!result.success) {
      return DomainResult.fail<void>(
        result.errors.map((e) => toPipelineError(e, this.name, true)),
      );
    }

    context.setCompiledFunctions(result.data);
    // BR-U3-52: declared, adrDerived and dropped ids by id sets, computed where the spec is at hand.
    this.factsHolder.facts = compileFactsOf(parsedSpec.fitnessFunctions, result.data);

    // Compiler warnings travel in CompiledFunctions.warnings; route them to the context so
    // COMPILER_004 for style- and kind-disabled functions reaches the report (BR-U3-56, ADR-016 c).
    for (const w of result.data.warnings) {
      context.addWarning(toPipelineWarning(compilerWarningOf(w), this.name));
    }

    if (result.warnings) {
      for (const w of result.warnings) {
        context.addWarning(toPipelineWarning(w, this.name));
      }
    }

    context.addAuditEntry({
      timestamp: new Date().toISOString(),
      stage: this.name,
      event: `Compiled ${result.data.totalCompiled} functions: ${result.data.symbolicQueries.length} symbolic, ${result.data.neuronalInstructions.length} neuronal, ${result.data.hybridPairs.length} hybrid`,
    });

    return DomainResult.ok(undefined);
  }
}

/** A compiler warning as a domain warning; its `functionId` moves into `context.functionId`. */
function compilerWarningOf(w: DomainWarning & { readonly functionId?: unknown }): DomainWarning {
  const context = typeof w.functionId === 'string' ? { ...w.context, functionId: w.functionId } : w.context;
  return { code: w.code, message: w.message, ...(context !== undefined && { context }) };
}
