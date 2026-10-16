import type { PipelineCommand } from '../../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../../shared/context/firewall-context.js';
import type { DomainResult as DomainResultType } from '../../shared/errors/domain-result.js';
import { DomainResult } from '../../shared/errors/domain-result.js';
import { compileFunctions, V13_COMPILE_OPTIONS } from '../../fitness-compiler/index.js';
import { compilerInputFromSpec } from '../../fitness-compiler/compiler-input.js';
import type { DomainWarning } from '../../shared/errors/domain-result.js';
import { INSTRUMENT_VERSION } from '../../fitness-compiler/role-exemptions.js';
import type { InstrumentVersion } from '../../fitness-compiler/role-exemptions.js';
import { compileFactsOf } from '../../scoring-engine/report-builder.js';
import type { CompileFacts } from '../../scoring-engine/report-builder.js';
import { toPipelineError, toPipelineWarning } from './map-helpers.js';
import { CONSTRUCT_ANSWERS } from '../../shared/construct-switches.js';
import { applyConstructCompileOverlays } from '../../construct-switches/compile.js';
import type { ConstructAnswers } from '../../shared/construct-switches.js';
import { excludeAggregateRules } from '../../fitness-compiler/empty-aggregates.js';
import type { EmptyAggregatePolicy } from '../../fitness-compiler/empty-aggregates.js';

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

  constructor(
    private readonly factsHolder: CompileFactsHolder = {},
    private readonly instrumentVersion: InstrumentVersion = INSTRUMENT_VERSION,
    /**
     * The construct-switch answers the compile overlays read; undefined = none (the v1.2e scoring mode, where the row
     * stage and the tier overrides do not run either, R30). Absent constructor argument = the switch file.
     */
    private readonly constructAnswers: ConstructAnswers | undefined = CONSTRUCT_ANSWERS,
    /** Loop-pilot T1 (`empty-aggregates.ts`): undefined = the compiler's default, `fail` (BR-SPEC-10). */
    private readonly emptyAggregates?: EmptyAggregatePolicy,
  ) {}

  async execute(context: FirewallContext): Promise<DomainResultType<void>> {
    const parsedSpec = context.getParsedSpec();

    // v1.3 edge views (ADR-V13-01): a no-op on a v1.2E graph, so the frozen results are unchanged.
    const { constructSwitches: _fromFile, ...v13 } = { ...V13_COMPILE_OPTIONS };
    const options = { ...v13, ...(this.constructAnswers !== undefined ? { constructSwitches: this.constructAnswers } : {}), instrumentVersion: this.instrumentVersion,
      ...(this.emptyAggregates !== undefined ? { emptyAggregates: this.emptyAggregates } : {}) };
    const result = compileFunctions(compilerInputFromSpec(parsedSpec), options);

    if (!result.success) {
      return DomainResult.fail<void>(
        result.errors.map((e) => toPipelineError(e, this.name, true)),
      );
    }

    context.setCompiledFunctions(result.data);
    // BR-U3-52: declared, adrDerived and dropped ids by id sets, computed where the spec is at hand.
    // The declared side is the spec as the switches declare it: a carrier rule a switch adds (Q5 D, Q16 B, Q17 C) is
    // declared by the switch, so identity I1 holds (R09); at the status quo the overlay is the spec itself.
    const overlaid = applyConstructCompileOverlays(compilerInputFromSpec(parsedSpec), this.constructAnswers);
    // T1 option c: an excluded aggregate rule is not declared either (it is recorded by the COMPILER_006 warning).
    const declared = (this.emptyAggregates === 'exclude' ? excludeAggregateRules(overlaid).input : overlaid).fitnessFunctions;
    this.factsHolder.facts = compileFactsOf(declared, result.data, this.instrumentVersion);

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
