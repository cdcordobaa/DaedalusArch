import type { APGResult } from '../types/apg.js';
import type { ParsedSpec } from '../types/spec.js';
import type { RunId } from '../types/value-objects.js';
import type { PipelineWarning, PipelineAuditEntry } from '../errors/domain-result.js';
import type {
  IngestionResult,
  CompiledFunctions,
  EvaluationResults,
  EvaluationReport,
} from '../types/evaluation.js';

export interface FirewallContextSnapshot {
  readonly runId: RunId;
  readonly startedAt: string;
  readonly apgResult?: APGResult;
  readonly parsedSpec?: ParsedSpec;
  readonly ingestionResult?: IngestionResult;
  readonly compiledFunctions?: CompiledFunctions;
  readonly evaluationResults?: EvaluationResults;
  readonly report?: EvaluationReport;
  readonly warnings: readonly PipelineWarning[];
  readonly auditLog: readonly PipelineAuditEntry[];
}

export class FirewallContext {
  private readonly _runId: RunId;
  private readonly _startedAt: string;
  private _apgResult?: APGResult;
  private _parsedSpec?: ParsedSpec;
  private _ingestionResult?: IngestionResult;
  private _compiledFunctions?: CompiledFunctions;
  private _evaluationResults?: EvaluationResults;
  private _report?: EvaluationReport;
  private readonly _warnings: PipelineWarning[] = [];
  private readonly _auditLog: PipelineAuditEntry[] = [];

  constructor(runId: RunId) {
    this._runId = runId;
    this._startedAt = new Date().toISOString();
  }

  // ── Typed Setters (set-once invariant) ──────────────────────────────────────

  setApgResult(result: APGResult): void {
    if (this._apgResult !== undefined) {
      throw new Error('APGResult already set on FirewallContext — cannot overwrite');
    }
    this._apgResult = result;
  }

  setParsedSpec(spec: ParsedSpec): void {
    if (this._parsedSpec !== undefined) {
      throw new Error('ParsedSpec already set on FirewallContext — cannot overwrite');
    }
    this._parsedSpec = spec;
  }

  setIngestionResult(result: IngestionResult): void {
    if (this._ingestionResult !== undefined) {
      throw new Error('IngestionResult already set on FirewallContext — cannot overwrite');
    }
    this._ingestionResult = result;
  }

  setCompiledFunctions(functions: CompiledFunctions): void {
    if (this._compiledFunctions !== undefined) {
      throw new Error('CompiledFunctions already set on FirewallContext — cannot overwrite');
    }
    this._compiledFunctions = functions;
  }

  setEvaluationResults(results: EvaluationResults): void {
    if (this._evaluationResults !== undefined) {
      throw new Error('EvaluationResults already set on FirewallContext — cannot overwrite');
    }
    this._evaluationResults = results;
  }

  setReport(report: EvaluationReport): void {
    if (this._report !== undefined) {
      throw new Error('EvaluationReport already set on FirewallContext — cannot overwrite');
    }
    this._report = report;
  }

  // ── Typed Getters (throw with descriptive message if prereq not met) ─────────

  get runId(): RunId { return this._runId; }
  get startedAt(): string { return this._startedAt; }
  get warnings(): readonly PipelineWarning[] { return this._warnings; }
  get auditLog(): readonly PipelineAuditEntry[] { return this._auditLog; }

  getApgResult(): APGResult {
    if (this._apgResult === undefined) {
      throw new Error('APGResult not available — APG Extractor stage has not run');
    }
    return this._apgResult;
  }

  getParsedSpec(): ParsedSpec {
    if (this._parsedSpec === undefined) {
      throw new Error('ParsedSpec not available — Spec Parser stage has not run');
    }
    return this._parsedSpec;
  }

  getIngestionResult(): IngestionResult {
    if (this._ingestionResult === undefined) {
      throw new Error('IngestionResult not available — Neo4j Ingestion stage has not run');
    }
    return this._ingestionResult;
  }

  getCompiledFunctions(): CompiledFunctions {
    if (this._compiledFunctions === undefined) {
      throw new Error('CompiledFunctions not available — Fitness Compiler stage has not run');
    }
    return this._compiledFunctions;
  }

  getEvaluationResults(): EvaluationResults {
    if (this._evaluationResults === undefined) {
      throw new Error('EvaluationResults not available — Router/Evaluation stage has not run');
    }
    return this._evaluationResults;
  }

  getReport(): EvaluationReport {
    if (this._report === undefined) {
      throw new Error('EvaluationReport not available — Scoring Engine stage has not run');
    }
    return this._report;
  }

  // ── Accumulation Methods ─────────────────────────────────────────────────────

  addWarning(warning: PipelineWarning): void {
    this._warnings.push(warning);
  }

  addAuditEntry(entry: PipelineAuditEntry): void {
    this._auditLog.push(entry);
  }

  // ── Read-only Snapshot ───────────────────────────────────────────────────────

  snapshot(): FirewallContextSnapshot {
    return {
      runId: this._runId,
      startedAt: this._startedAt,
      ...(this._apgResult !== undefined && { apgResult: this._apgResult }),
      ...(this._parsedSpec !== undefined && { parsedSpec: this._parsedSpec }),
      ...(this._ingestionResult !== undefined && { ingestionResult: this._ingestionResult }),
      ...(this._compiledFunctions !== undefined && { compiledFunctions: this._compiledFunctions }),
      ...(this._evaluationResults !== undefined && { evaluationResults: this._evaluationResults }),
      ...(this._report !== undefined && { report: this._report }),
      warnings: [...this._warnings],
      auditLog: [...this._auditLog],
    };
  }
}
