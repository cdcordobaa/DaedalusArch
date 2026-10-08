import type { PipelineCommand } from '../../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../../shared/context/firewall-context.js';
import type { DomainResult as DomainResultType, PipelineError } from '../../shared/errors/domain-result.js';
import type { EvaluationMode } from '../../shared/types/enums.js';
import type { JudgeProvenance, NeuralResultRow, StageTimings } from '../../shared/types/evaluation.js';
import { DomainResult } from '../../shared/errors/domain-result.js';
import { buildEvaluationReport, NO_JUDGE } from '../../scoring-engine/report-builder.js';
import type { RunFacts } from '../../scoring-engine/report-builder.js';
import { validateReport } from '../../scoring-engine/report-schema-validator.js';
import type { CompileFactsHolder } from './compile-command.js';

export interface AssembleReportConfig {
  readonly mode: EvaluationMode;
  /** Stage timings at assembly time (`executor.getTimings()`), read last (BR-U3-50). */
  readonly timingSource: () => StageTimings;
  /** Shared with `CompileCommand`, which writes the declared-side counts (BR-U3-52). */
  readonly compileFacts: CompileFactsHolder;
  /** Values scrubbed from every warning (BR-U3-58). */
  readonly knownSecrets: readonly string[];
  /** U4 `judgeProvenanceOf`; the symbolic-only stub `NO_JUDGE` until U4 merges (BR-U3-63). */
  readonly judge?: JudgeProvenance;
  /** U4 `toNeuralResultRows`; absent until U4 merges, so full / neuronal-only fail closed (BR-U3-65, D-U3-11). */
  readonly neuralRows?: (context: FirewallContext) => readonly NeuralResultRow[];
}

/**
 * S1: the one assembly point (FR-13, FR-14; BR-U3-50). Appended last by `createPipeline`; reads, in
 * order, the scored report, the APG facts, the ingestion facts, the compiled functions with their
 * `CompileFacts`, the evaluation results, the context warnings and the stage timings, calls
 * `buildEvaluationReport`, validates the result against the frozen schema (`REPORT_SCHEMA_INVALID`,
 * BR-U3-59) and writes `setReport`. JSON, HTML, batch, golden and harness read this report.
 */
export class AssembleReportCommand implements PipelineCommand {
  readonly name = 'assemble-report';

  constructor(private readonly config: AssembleReportConfig) {}

  execute(context: FirewallContext): Promise<DomainResultType<undefined>> {
    return Promise.resolve(this.assemble(context));
  }

  private assemble(context: FirewallContext): DomainResultType<undefined> {
    const scored = context.getScoredReport();
    const apg = context.getApgResult();
    const ingestion = context.getIngestionResult();
    const compiled = context.getCompiledFunctions();
    const compileFacts = this.config.compileFacts.facts;
    if (compileFacts === undefined) {
      const missing: PipelineError = {
        code: 'REPORT_COUNTS_INCONSISTENT',
        message: 'CompileFacts not available: the compile stage did not record declared, adrDerived and dropped',
        stage: this.name,
        critical: true,
      };
      return DomainResult.fail<undefined>([missing]);
    }
    const evaluation = context.getEvaluationResults();
    const pipelineWarnings = [...context.warnings];
    const neuralRows = this.config.neuralRows?.(context);
    const timings = this.config.timingSource();

    const facts: RunFacts = {
      apg: { parseCoverage: apg.parseCoverage, importResolution: apg.importResolution },
      ingestion,
      compiled,
      compileFacts,
      evaluation,
      timings,
      pipelineWarnings,
      judge: this.config.judge ?? NO_JUDGE,
      ...(neuralRows !== undefined && { neuralRows }),
      knownSecrets: this.config.knownSecrets,
      mode: this.config.mode,
    };

    const built = buildEvaluationReport(scored, facts);
    if (!built.success) return DomainResult.fail<undefined>(built.errors);

    // Fail closed: only a report that matches the frozen schema is written (BR-U3-59).
    const valid = validateReport(built.data);
    if (!valid.success) return DomainResult.fail<undefined>(valid.errors);

    context.setReport(valid.data);
    context.addAuditEntry({
      timestamp: new Date().toISOString(),
      stage: this.name,
      event: `Report assembled: ${String(built.data.functionExecution.executed)} executed, ${String(built.data.functionExecution.failed.length)} failed, ${String(built.data.warnings.length)} warnings`,
    });
    return DomainResult.ok(undefined);
  }
}
