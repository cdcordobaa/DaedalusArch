/**
 * Fail-closed report validation (FR-14, FR-36; U3 BR-U3-59, 60; SECURITY-13, 15).
 *
 * `validateReport` checks an assembled report against the embedded frozen schema (`REPORT_SCHEMA`);
 * an invalid report fails with `REPORT_SCHEMA_INVALID` and the first 10 errors (`path: message`).
 * `parseReport` narrows a stored report (JSON text or parsed value) for readers such as C15.
 * No file is read at run time.
 */
import { Ajv } from 'ajv';
import type { ErrorObject, ValidateFunction } from 'ajv';
import type { EvaluationReport } from '../shared/types/evaluation.js';
import type { PipelineError } from '../shared/errors/domain-result.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import { REPORT_SCHEMA } from './report-schema.js';
import { REPORT_STAGE } from './warning-merge.js';

/** Number of schema errors listed in a `REPORT_SCHEMA_INVALID` message (BR-U3-59). */
export const REPORT_SCHEMA_ERROR_LIMIT = 10;

export interface ReportSchemaError extends PipelineError {
  readonly code: 'REPORT_SCHEMA_INVALID';
  readonly stage: typeof REPORT_STAGE;
  readonly critical: true;
}

let compiled: ValidateFunction | undefined;

function validator(): ValidateFunction {
  if (compiled === undefined) {
    // Strict mode; union types (`["integer","null"]`) are part of the frozen schema, and the mode
    // conditions (`if`/`then`) name properties declared at the top level, not inside `then`.
    const ajv = new Ajv({ strict: true, allErrors: true, allowUnionTypes: true, strictRequired: false });
    compiled = ajv.compile(REPORT_SCHEMA);
  }
  return compiled;
}

function describe(e: ErrorObject): string {
  const where = e.instancePath === '' ? '/' : e.instancePath;
  const params = e.params as { readonly additionalProperty?: unknown; readonly missingProperty?: unknown };
  const detail = params.additionalProperty ?? params.missingProperty;
  return `${where}: ${e.message ?? e.keyword}${typeof detail === 'string' ? ` (${detail})` : ''}`;
}

function invalid(lines: readonly string[], total: number): ReportSchemaError {
  return {
    code: 'REPORT_SCHEMA_INVALID',
    stage: REPORT_STAGE,
    critical: true,
    message: `Report does not match the frozen schema (${String(total)} error(s)): ${lines.join('; ')}`,
    context: { errors: [...lines], total },
  };
}

/** Validates `report` against the frozen schema; fails closed with `REPORT_SCHEMA_INVALID`. */
export function validateReport(report: unknown): DomainResult<EvaluationReport> {
  const validate = validator();
  if (validate(report)) return DomainResult.ok(report as EvaluationReport);
  const errors = validate.errors ?? [];
  return DomainResult.fail([invalid(errors.slice(0, REPORT_SCHEMA_ERROR_LIMIT).map(describe), errors.length)]);
}

/** Parses (when given text) and validates a stored report. */
export function parseReport(input: unknown): DomainResult<EvaluationReport> {
  if (typeof input !== 'string') return validateReport(input);
  let value: unknown;
  try {
    value = JSON.parse(input) as unknown;
  } catch (e) {
    return DomainResult.fail([invalid([`/: not JSON (${e instanceof Error ? e.message : String(e)})`], 1)]);
  }
  return validateReport(value);
}
