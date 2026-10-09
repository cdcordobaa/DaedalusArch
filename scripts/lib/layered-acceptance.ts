/**
 * FR-v1.2E-20 layered acceptance record (ADR-021 SO1-B; ADR-015 item 11; ADR-016 b, c; clarifications §2.3).
 *
 * The acceptance is one `evaluate --symbolic-only` run of the `layered` library on one public layered project,
 * recorded in `results/pre-tag/`. "100 % executed" is stated against **compiled**, with declared and disabled (with
 * reasons) next to it. In symbolic-only mode the compiled neuronal functions are skipped by mode, so the rule is:
 * every compiled function that the mode runs executed (`executed = compiled − skippedByMode`), none failed, and U3's
 * identities I1 and I2 hold (BR-U5b-24, `denominatorRow`). The report must also pass BR-U5b-45 acceptance.
 */
import type { EvaluationReport } from '../../src/shared/types/evaluation.js';
import { denominatorRow } from '../score-golden.js';

export const LAYERED_ACCEPTANCE_SCHEMA_VERSION = '1.0.0';

export interface LayeredAcceptanceMeta {
  readonly projectId: string;
  readonly originUrl: string;
  readonly projectCommit: string;
  readonly style: string;
  readonly specPath: string;
  readonly specSha256: string;
  /** The tool commit the run used (the `<sha>` of the file name). */
  readonly toolCommit: string;
  readonly command: string;
  /** BR-U5b-45 outcome of the stored report (`null` when accepted). */
  readonly rejection: string | null;
}

export interface LayeredAcceptance {
  readonly schemaVersion: string;
  readonly requirement: 'FR-v1.2E-20';
  readonly projectId: string;
  readonly originUrl: string;
  readonly projectCommit: string;
  readonly style: string;
  readonly specPath: string;
  readonly specSha256: string;
  readonly toolCommit: string;
  readonly command: string;
  readonly evaluationMode: EvaluationReport['evaluationMode'];
  readonly counts: {
    readonly declared: number;
    readonly adrDerived: number;
    readonly compiled: number;
    readonly disabled: number;
    readonly dropped: number;
    readonly skippedByMode: number;
    readonly executed: number;
    readonly failed: number;
  };
  readonly disabledFunctions: readonly { readonly functionId: string; readonly name: string; readonly reason: string }[];
  readonly failedFunctions: readonly { readonly functionId: string; readonly code: string }[];
  /** executed ÷ (compiled − skippedByMode); `null` when the mode runs no compiled function. */
  readonly executedShareOfRunnable: number | null;
  readonly identities: { readonly i1i2: boolean };
  readonly reportAccepted: boolean;
  readonly reportRejection: string | null;
  readonly verdict: EvaluationReport['verdict'];
  readonly ahsDeterministic: number | null;
  readonly violationCount: number;
  /** Every acceptance condition holds. */
  readonly accepted: boolean;
  /** The reasons `accepted` is false; empty when accepted. */
  readonly problems: readonly string[];
}

export function layeredAcceptance(report: EvaluationReport, meta: LayeredAcceptanceMeta): LayeredAcceptance {
  const fe = report.functionExecution;
  const d = denominatorRow(null, report.runId, report, 0, 0);
  const runnable = fe.compiled - fe.skippedByMode;
  const problems: string[] = [];
  if (meta.style !== 'layered') problems.push(`style ${meta.style} is not layered`);
  if (report.evaluationMode !== 'symbolic-only') problems.push(`mode ${report.evaluationMode} is not symbolic-only`);
  if (meta.rejection !== null) problems.push(`report rejected (BR-U5b-45): ${meta.rejection}`);
  if (!d.identityOk) problems.push('identity I1 or I2 does not hold');
  if (fe.failed.length > 0) problems.push(`${String(fe.failed.length)} compiled function(s) failed`);
  if (fe.executed !== runnable) problems.push(`executed ${String(fe.executed)} != compiled ${String(fe.compiled)} - skippedByMode ${String(fe.skippedByMode)}`);
  if (fe.disabled !== report.disabledFunctions.length) problems.push(`disabled ${String(fe.disabled)} != ${String(report.disabledFunctions.length)} disabled rows`);
  return {
    schemaVersion: LAYERED_ACCEPTANCE_SCHEMA_VERSION,
    requirement: 'FR-v1.2E-20',
    projectId: meta.projectId, originUrl: meta.originUrl, projectCommit: meta.projectCommit, style: meta.style,
    specPath: meta.specPath, specSha256: meta.specSha256, toolCommit: meta.toolCommit, command: meta.command,
    evaluationMode: report.evaluationMode,
    counts: {
      declared: fe.declared, adrDerived: fe.adrDerived, compiled: fe.compiled, disabled: fe.disabled, dropped: fe.dropped.length,
      skippedByMode: fe.skippedByMode, executed: fe.executed, failed: fe.failed.length,
    },
    disabledFunctions: [...report.disabledFunctions]
      .map((r) => ({ functionId: String(r.functionId), name: r.name, reason: r.reason }))
      .sort((a, b) => (a.functionId < b.functionId ? -1 : a.functionId > b.functionId ? 1 : 0)),
    failedFunctions: fe.failed.map((f) => ({ functionId: String(f.functionId), code: f.code })),
    executedShareOfRunnable: runnable === 0 ? null : fe.executed / runnable,
    identities: { i1i2: d.identityOk },
    reportAccepted: meta.rejection === null,
    reportRejection: meta.rejection,
    verdict: report.verdict,
    ahsDeterministic: report.ahsDeterministic ?? null,
    violationCount: report.violations.length,
    accepted: problems.length === 0,
    problems,
  };
}
