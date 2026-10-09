/**
 * Report I/O and acceptance (FR-36, FR-25; BR-U5b-25, 45, 53; U5b domain-entities §1, §6).
 *
 * - `RunRecord` and the harness types of domain-entities §6 (the ajv schema for `RunRecord` arrives with
 *   the harness, Step 14; here a record is checked for the fields acceptance and provenance read).
 * - `loadRun(reportPath, recordPath)` reads a stored report with its `RunRecord`.
 * - `acceptReport(report, options)` applies BR-U5b-45: schema validity against the frozen
 *   `schemas/report.schema.json` (C8 `validateReport`, Ajv over the embedded frozen schema), failed and
 *   timed-out functions (`EVAL_001` / `EVAL_002`), truncation (`truncated` rows or `EVAL_003`), failed
 *   universal metrics (`METRIC_001`) and the judge actual-model rule (U4 BR-U4-VRD-07) against the plan
 *   mode's pinned values. `METRIC_002`, disabled and cannot-fire functions are not failures.
 * - `scrubbedJson` / `writeScrubbedJson` (BR-U5b-70, NFR-05, NFR-08): every artefact U5b writes (cassettes,
 *   `RunRecord`s, `EnvironmentRecord`s, stored reports, subprocess output) goes through C10 `scrubDeep` with the
 *   known secrets (`NEO4J_PASSWORD`, `GEMINI_API_KEY` values of the parent environment) first.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { validateReport } from '../../src/scoring-engine/report-schema-validator.js';
import { scrubDeep } from '../../src/shared/errors/scrub.js';
import type { EvaluationReport } from '../../src/shared/types/evaluation.js';
import type { Split } from './manifest.js';
import type { BaseKind } from './mutation/types.js';

export type { Split, BaseKind };

// ---------------------------------------------------------------------------------------------
// Harness types (domain-entities §6)

export type EvaluationMode = EvaluationReport['evaluationMode'];

export interface GenerationCell {
  readonly requestedModelId: string; readonly resolvedModelId?: string; readonly adapterId: string;
  readonly promptTemplateId: string; readonly style: string; readonly specLevel: 'none' | 'minimal-prose' | 'full-aac';
  readonly taskId: string; readonly runIndex: 0 | 1 | 2; readonly generationOutcomePath: string;
  /**
   * U5a's status, or a U5b join status (ADR-021 SO5-03, SO5-05): `missing` = no `generation.json` for the grid
   * coordinate; `protocol-mismatch` = an outcome that breaks the registered generator plan. Both are not-run cells.
   */
  readonly generationStatus: 'ok' | 'failed-typecheck' | 'failed-agent' | 'missing' | 'protocol-mismatch';
  readonly failureReason?: 'typecheck' | 'agent-error' | 'model-mismatch' | 'skeleton-tampered'
    | 'infrastructure' | 'envelope-unreadable' | 'timeout';
  readonly fileCount: number; readonly fileCountInRange: boolean; readonly permissionDenials: number;
}

export interface SeedRef {
  readonly seedId: string; readonly baseProjectId: string; readonly split: Split; readonly baseKind: BaseKind;
  readonly manifestPath: string; readonly baselineReportPath: string;
}

export type RunStatus = 'accepted' | 'rejected' | 'not-run' | 'incomplete';

/** Acceptance reason codes (BR-U5b-45), in the order they are reported. */
export const ACCEPTANCE_REASON_CODES = [
  'schema-invalid', 'function-timeout', 'function-failed', 'function-truncated', 'metric-failed', 'judge-model-mismatch',
  'seeded-list-nonempty', 'missing-baseline-selection',
] as const;
export type AcceptanceReasonCode = (typeof ACCEPTANCE_REASON_CODES)[number];

export type ReasonCode = AcceptanceReasonCode | 'transport-error' | 'generation-failed' | 'usage-limit' | 'prereg-refused';

export interface RunRecord {
  readonly runId: string; readonly planId: string; readonly projectId: string;
  readonly status: RunStatus; readonly reasonCode?: ReasonCode; readonly reasonDetail?: string;
  readonly attempt: 1 | 2;
  readonly reportPath?: string;
  readonly specSha: string; readonly cliCommit: string;
  readonly preregVersion: number; readonly frozenHashes: Readonly<Record<string, string>>;
  readonly envRecordId: string;
  readonly startedAt: string; readonly wallMs: number;
  readonly cell?: GenerationCell; readonly seed?: SeedRef;
}

// ---------------------------------------------------------------------------------------------
// Acceptance (BR-U5b-45)

/** The judge pinned by the plan mode; `aliases` are ids that alias-resolve to `model` (BR-U4-VRD-07). */
export interface PinnedJudge {
  readonly provider: string;
  readonly model: string;
  readonly aliases?: readonly string[];
}

export interface AcceptOptions {
  /** Absent for a plan mode without a judge (symbolic-only): the judge check is skipped. */
  readonly pinnedJudge?: PinnedJudge;
  /**
   * The accepted baseline report this report is paired with (differential pair, BR-U4-SEL-07). When given,
   * every `neuralResults[]` row must carry `selection.source = 'baseline'` and the baseline row's
   * `selectedUnitIds` (OI-U4-8 consumer side, `missing-baseline-selection`).
   */
  readonly pairedBaseline?: EvaluationReport;
}

export interface AcceptanceRejection {
  readonly code: AcceptanceReasonCode;
  readonly detail: string;
}

export type Acceptance =
  | { readonly accepted: true; readonly report: EvaluationReport }
  | {
    readonly accepted: false;
    /** First reason in `ACCEPTANCE_REASON_CODES` order. */
    readonly reasonCode: AcceptanceReasonCode;
    readonly reasonDetail: string;
    readonly rejections: readonly AcceptanceRejection[];
  };

const TIMEOUT_CODE = 'EVAL_002';
const TRUNCATION_CODE = 'EVAL_003';
const METRIC_FAILED_CODE = 'METRIC_001';

function judgeMismatch(judge: EvaluationReport['judge'], pinned: PinnedJudge): string | undefined {
  if (judge.provider !== pinned.provider) return `judge.provider ${judge.provider} != pinned ${pinned.provider}`;
  if (judge.model !== pinned.model) return `judge.model ${judge.model} != pinned ${pinned.model}`;
  // `resolvedModel` is in the frozen schema (judgeProvenance); the TS type gains it with U4 (U4 DE §2.4).
  const resolvedRaw = (judge as { readonly resolvedModel?: unknown }).resolvedModel;
  const resolved = typeof resolvedRaw === 'string' ? resolvedRaw : undefined;
  if (resolved !== undefined && resolved !== pinned.model && !(pinned.aliases ?? []).includes(resolved)) {
    return `judge.resolvedModel ${resolved} does not resolve to pinned ${pinned.model}`;
  }
  return undefined;
}

type NeuralRows = NonNullable<EvaluationReport['neuralResults']>;

function neuralRowsOf(r: EvaluationReport): NeuralRows {
  return r.neuralResults ?? [];
}

/** BR-U4-SEL-07: each neural row of a variant uses the paired baseline's selection. Returns problems. */
export function baselineSelectionProblems(variant: EvaluationReport, baseline: EvaluationReport): string[] {
  const base = new Map(neuralRowsOf(baseline).map((row) => [String(row.functionId), row.selection.selectedUnitIds] as const));
  const problems: string[] = [];
  for (const row of neuralRowsOf(variant)) {
    const id = String(row.functionId);
    if (row.selection.source !== 'baseline') { problems.push(`${id}: selection.source ${row.selection.source}`); continue; }
    const expected = base.get(id);
    if (expected === undefined) { problems.push(`${id}: no row in the paired baseline`); continue; }
    if (JSON.stringify(row.selection.selectedUnitIds) !== JSON.stringify(expected)) problems.push(`${id}: selectedUnitIds differ from the baseline's`);
  }
  return problems;
}

/** BR-U5b-45: accept or reject a stored report (parsed JSON value). */
export function acceptReport(report: unknown, options: AcceptOptions = {}): Acceptance {
  const valid = validateReport(report);
  if (!valid.success) {
    const detail = valid.errors.map((e) => e.message).join('; ');
    return { accepted: false, reasonCode: 'schema-invalid', reasonDetail: detail, rejections: [{ code: 'schema-invalid', detail }] };
  }
  const r = valid.data;
  const found: AcceptanceRejection[] = [];
  const failed = r.functionExecution.failed;
  const timeouts = failed.filter((f) => f.code === TIMEOUT_CODE);
  const others = failed.filter((f) => f.code !== TIMEOUT_CODE);
  if (timeouts.length > 0) {
    found.push({ code: 'function-timeout', detail: `${TIMEOUT_CODE}: ${timeouts.map((f) => f.functionId).join(', ')}` });
  }
  if (others.length > 0) {
    found.push({ code: 'function-failed', detail: others.map((f) => `${f.functionId} (${f.code})`).join(', ') });
  }
  const truncatedRows = r.functionResults.filter((row) => row.truncated).map((row) => String(row.functionId));
  const truncWarnings = r.warnings.filter((w) => w.code === TRUNCATION_CODE);
  if (truncatedRows.length > 0 || truncWarnings.length > 0) {
    const parts = [
      ...(truncatedRows.length > 0 ? [`truncated rows: ${truncatedRows.join(', ')}`] : []),
      ...(truncWarnings.length > 0 ? [`${TRUNCATION_CODE} warnings: ${String(truncWarnings.length)}`] : []),
    ];
    found.push({ code: 'function-truncated', detail: parts.join('; ') });
  }
  const metricFailures = r.warnings.filter((w) => w.code === METRIC_FAILED_CODE);
  if (metricFailures.length > 0) {
    const metrics = metricFailures.map((w) => {
      const metric = (w.context as { readonly metric?: unknown } | undefined)?.metric;
      return typeof metric === 'string' ? metric : '?';
    });
    found.push({ code: 'metric-failed', detail: `${METRIC_FAILED_CODE}: ${metrics.join(', ')}` });
  }
  if (options.pinnedJudge !== undefined) {
    const mismatch = judgeMismatch(r.judge, options.pinnedJudge);
    if (mismatch !== undefined) found.push({ code: 'judge-model-mismatch', detail: mismatch });
  }
  const seededList = (r.judge as { readonly seededList?: readonly string[] }).seededList ?? [];
  if (seededList.length > 0) {
    found.push({ code: 'seeded-list-nonempty', detail: `judge.seededList has ${String(seededList.length)} entries: ${seededList.join(', ')}` });
  }
  if (options.pairedBaseline !== undefined) {
    const problems = baselineSelectionProblems(r, options.pairedBaseline);
    if (problems.length > 0) found.push({ code: 'missing-baseline-selection', detail: problems.join('; ') });
  }
  found.sort((a, b) => ACCEPTANCE_REASON_CODES.indexOf(a.code) - ACCEPTANCE_REASON_CODES.indexOf(b.code));
  const [first] = found;
  if (first === undefined) return { accepted: true, report: r };
  return { accepted: false, reasonCode: first.code, reasonDetail: first.detail, rejections: found };
}

// ---------------------------------------------------------------------------------------------
// Loading

const RECORD_STRING_FIELDS = ['runId', 'planId', 'projectId', 'status', 'specSha', 'cliCommit', 'envRecordId', 'startedAt'] as const;
const RUN_STATUSES: readonly RunStatus[] = ['accepted', 'rejected', 'not-run', 'incomplete'];

/** Field-level check of a `RunRecord` (the full ajv schema is added with the harness). Returns problems. */
export function checkRunRecord(value: unknown): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return ['run record is not an object'];
  const v = value as Record<string, unknown>;
  const problems: string[] = [];
  for (const f of RECORD_STRING_FIELDS) if (typeof v[f] !== 'string' || v[f] === '') problems.push(`${f} missing or not a string`);
  if (typeof v.status === 'string' && !RUN_STATUSES.includes(v.status as RunStatus)) problems.push(`status ${v.status} unknown`);
  if (v.attempt !== 1 && v.attempt !== 2) problems.push('attempt must be 1 or 2');
  if (typeof v.preregVersion !== 'number' || !Number.isInteger(v.preregVersion)) problems.push('preregVersion must be an integer');
  if (typeof v.wallMs !== 'number' || v.wallMs < 0) problems.push('wallMs must be a non-negative number');
  if (typeof v.frozenHashes !== 'object' || v.frozenHashes === null || Array.isArray(v.frozenHashes)) problems.push('frozenHashes must be an object');
  return problems;
}

export type LoadedRun =
  | { readonly ok: true; readonly report: unknown; readonly record: RunRecord }
  | { readonly ok: false; readonly reason: 'report-unreadable' | 'record-missing' | 'record-invalid'; readonly detail: string };

function readJson(path: string): { ok: true; value: unknown } | { ok: false; detail: string } {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (e) {
    return { ok: false, detail: `cannot read ${path}: ${(e as NodeJS.ErrnoException).code ?? 'error'}` };
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (e) {
    return { ok: false, detail: `${path} is not JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * Reads a stored report with its `RunRecord`. The report is returned as parsed JSON (pass it to
 * `acceptReport`); a report without a readable, well-formed record is not loaded (BR-U5b-25).
 */
export function loadRun(reportPath: string, recordPath: string | undefined): LoadedRun {
  const report = readJson(reportPath);
  if (!report.ok) return { ok: false, reason: 'report-unreadable', detail: report.detail };
  if (recordPath === undefined) return { ok: false, reason: 'record-missing', detail: `no RunRecord given for ${reportPath}` };
  const record = readJson(recordPath);
  if (!record.ok) return { ok: false, reason: 'record-missing', detail: record.detail };
  const problems = checkRunRecord(record.value);
  if (problems.length > 0) return { ok: false, reason: 'record-invalid', detail: problems.join('; ') };
  return { ok: true, report: report.value, record: record.value as RunRecord };
}

// ---------------------------------------------------------------------------------------------
// Scrubbed artefacts (BR-U5b-70)

/** The environment variables whose values are known secrets (BR-U5b-70). */
export const KNOWN_SECRET_VARIABLES: readonly string[] = Object.freeze(['NEO4J_PASSWORD', 'GEMINI_API_KEY']);

/** The known secret values present in `env`. */
export function knownSecretsOf(env: NodeJS.ProcessEnv): string[] {
  return KNOWN_SECRET_VARIABLES.map((k) => env[k]).filter((v): v is string => typeof v === 'string' && v.trim() !== '');
}

/** Deep copy of `value` with every string scrubbed (C10 `scrubDeep`: known secrets, credentialed URIs, key shapes). */
export function scrubbedJson<T>(value: T, secrets: readonly string[]): T {
  return scrubDeep(value, secrets);
}

/** Writes `value` as pretty JSON after scrubbing; creates the parent directory. */
export function writeScrubbedJson(path: string, value: unknown, secrets: readonly string[]): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(scrubbedJson(value, secrets), null, 2)}\n`);
}
