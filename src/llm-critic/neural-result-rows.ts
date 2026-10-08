import * as fs from 'node:fs';
import { Ajv } from 'ajv';
import type { ValidateFunction } from 'ajv';
import type {
  BaselineSelection, ExclusionReason, InvalidCause, JudgeUnitResult, NeuralResultRow, NeuralUnitRow, NeuronalFunctionResult,
} from '../shared/types/evaluation.js';
import { DIMENSIONS } from '../shared/types/enums.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import { AGGREGATION_RULE } from './frozen.js';
import { EXCLUSION_REASONS } from './judge-unit-selector.js';
import { INVALID_CAUSES } from './aggregation.js';

/**
 * Persisted neural result rows (U4 plan Step 24; DE §4.8; OI-U4-8 settled by BR-U3-65, D-U4-8).
 *
 * `toNeuralResultRows` maps the critic's results to the closed `NeuralResultRow` shape that U3's
 * report builder places as the top-level `neuralResults[]` (required in full and neuronal-only
 * modes, absent in symbolic-only). Rows hold no reasoning, evidence, prompt or absolute path;
 * a function with a `FunctionFailure` or with no units has no result and therefore no row. There
 * is no sidecar writer. `readBaselineSelections` reads the `neuralResults[].selection` rows of any
 * JSON object holding that key (a U3 report, or a minimal `{neuralResults: [...]}`), for
 * `--judge-baseline-report` (BR-U4-SEL-07).
 */

const COUNT = { type: 'integer', minimum: 0 } as const;

function closedCounts(keys: readonly string[]): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: [...keys],
    properties: Object.fromEntries(keys.map((k) => [k, { $ref: '#/definitions/count' }])),
  };
}

/**
 * JSON Schema of one row (closed, every field required except `singleFileModules` and a unit's
 * `origin`, which C7 sets only for module units and variant runs). Its `properties` equal the
 * `neuralResultRow` / `neuralUnitRow` definitions of U3's frozen report schema (asserted by test).
 */
export const NEURAL_RESULT_ROW_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: [
    'functionId', 'dimension', 'aggregationRule', 'selection', 'unitsSelected', 'unitsCapped', 'candidateCount',
    'uncoveredFileCount', 'candidateExclusions', 'unitsInvalidByCause', 'truncatedUnits', 'excerptTruncatedUnits',
    'removedByVariant', 'unitResults',
  ],
  properties: {
    functionId: { type: 'string' },
    dimension: { $ref: '#/definitions/dimension' },
    aggregationRule: { type: 'string', enum: [AGGREGATION_RULE] },
    selection: {
      type: 'object',
      additionalProperties: false,
      required: ['source', 'candidateUnitIds', 'selectedUnitIds'],
      properties: {
        source: { type: 'string', enum: ['own', 'baseline'] },
        candidateUnitIds: { type: 'array', items: { type: 'string' } },
        selectedUnitIds: { type: 'array', items: { type: 'string' } },
      },
    },
    unitsSelected: { $ref: '#/definitions/count' },
    unitsCapped: { $ref: '#/definitions/count' },
    candidateCount: { $ref: '#/definitions/count' },
    uncoveredFileCount: { $ref: '#/definitions/count' },
    singleFileModules: { $ref: '#/definitions/count' },
    candidateExclusions: closedCounts(['unlayered', 'exclude-paths', 'barrel', 'test-path', 'e2e-spec', 'generated-path', 'generated-marker']),
    unitsInvalidByCause: closedCounts([
      'PARSE_FAILURE', 'MISSING_CONFIDENCE', 'MODEL_MISMATCH', 'TIMEOUT', 'BAD_ENVELOPE', 'CLI_EXIT', 'INSUFFICIENT_VALID_RUNS',
    ]),
    truncatedUnits: { $ref: '#/definitions/count' },
    excerptTruncatedUnits: { $ref: '#/definitions/count' },
    removedByVariant: { type: 'array', items: { type: 'string' } },
    unitResults: { type: 'array', items: { $ref: '#/definitions/neuralUnitRow' } },
  },
  definitions: {
    count: COUNT,
    unitInterval: { type: 'number', minimum: 0, maximum: 1 },
    nonNegativeNumber: { type: 'number', minimum: 0 },
    dimension: { type: 'string', enum: [...DIMENSIONS] },
    neuralUnitRow: {
      type: 'object',
      additionalProperties: false,
      required: [
        'unitId', 'unitKind', 'layer', 'filePaths', 'status', 'verdict', 'confidence', 'confidenceStdDev',
        'flaggedUnstable', 'validRunCount',
      ],
      properties: {
        unitId: { type: 'string' },
        unitKind: { type: 'string', enum: ['file', 'class', 'module'] },
        layer: { type: 'string' },
        filePaths: { type: 'array', items: { type: 'string' } },
        status: { type: 'string', enum: ['valid', 'invalid'] },
        verdict: { type: 'string', enum: ['pass', 'fail', 'warning'] },
        confidence: { $ref: '#/definitions/unitInterval' },
        confidenceStdDev: { $ref: '#/definitions/nonNegativeNumber' },
        flaggedUnstable: { type: 'boolean' },
        validRunCount: { $ref: '#/definitions/count' },
        origin: { type: 'string', enum: ['addedByVariant'] },
      },
    },
  },
});

let rowValidator: ValidateFunction | undefined;

/** Validates one row against `NEURAL_RESULT_ROW_SCHEMA`; returns the error text, or `null`. */
export function neuralResultRowProblem(row: unknown): string | null {
  rowValidator ??= new Ajv({ strict: true, allErrors: true }).compile(NEURAL_RESULT_ROW_SCHEMA);
  if (rowValidator(row)) return null;
  return (rowValidator.errors ?? []).slice(0, 5).map((e) => `${e.instancePath === '' ? '/' : e.instancePath} ${e.message ?? ''}`).join('; ');
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function zeroCounts<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
}

function unitRow(u: JudgeUnitResult): NeuralUnitRow {
  return {
    unitId: u.unitId,
    unitKind: u.unitKind,
    layer: u.layer ?? '',
    filePaths: [...(u.filePaths ?? [])],
    status: u.status ?? 'valid',
    verdict: u.verdict,
    confidence: u.confidence,
    confidenceStdDev: u.confidenceStdDev,
    flaggedUnstable: u.flaggedUnstable ?? false,
    validRunCount: u.validRunCount ?? u.runs.length,
    ...(u.origin !== undefined ? { origin: u.origin } : {}),
  };
}

/**
 * One row per counted neural result, sorted by `functionId` (DE §4.8). Defaults (`0`, `[]`,
 * `'own'`) only where C7 legitimately sets nothing (e.g. `removedByVariant` on a baseline run).
 */
export function toNeuralResultRows(results: readonly NeuronalFunctionResult[]): readonly NeuralResultRow[] {
  return [...results]
    .sort((a, b) => compareStrings(String(a.functionId), String(b.functionId)))
    .map((r): NeuralResultRow => {
      const unitResults = [...r.unitResults].sort((a, b) => compareStrings(a.unitId, b.unitId));
      const unitIds = unitResults.map((u) => u.unitId);
      return {
        functionId: r.functionId,
        dimension: r.dimension,
        aggregationRule: r.aggregationRule ?? AGGREGATION_RULE,
        selection: {
          source: r.selection?.source ?? 'own',
          candidateUnitIds: [...(r.selection?.candidateUnitIds ?? unitIds)],
          selectedUnitIds: [...(r.selection?.selectedUnitIds ?? unitIds)],
        },
        unitsSelected: r.unitsSelected,
        unitsCapped: r.unitsCapped,
        candidateCount: r.candidateCount ?? r.unitsSelected + r.unitsCapped,
        uncoveredFileCount: r.uncoveredFileCount ?? 0,
        ...(r.singleFileModules !== undefined ? { singleFileModules: r.singleFileModules } : {}),
        candidateExclusions: { ...zeroCounts<ExclusionReason>(EXCLUSION_REASONS), ...r.candidateExclusions },
        unitsInvalidByCause: {
          ...zeroCounts<InvalidCause | 'INSUFFICIENT_VALID_RUNS'>([...INVALID_CAUSES, 'INSUFFICIENT_VALID_RUNS']),
          ...r.unitsInvalidByCause,
        },
        truncatedUnits: r.truncatedUnits ?? 0,
        excerptTruncatedUnits: r.excerptTruncatedUnits ?? 0,
        removedByVariant: [...(r.removedByVariant ?? [])],
        unitResults: unitResults.map(unitRow),
      };
    });
}

function missing(message: string, filePath: string): DomainResult<readonly BaselineSelection[]> {
  return DomainResult.fail([{ code: 'LLM_BASELINE_SELECTION_MISSING', message, context: { file: filePath } }]);
}

/**
 * `--judge-baseline-report <path>` (BR-U4-SEL-07): the `selection` of every `neuralResults[]` row
 * of the JSON object in `filePath` (a report or any object with that key). An unreadable file, a
 * file without `neuralResults[]` or an invalid row is `LLM_BASELINE_SELECTION_MISSING` (exit 2);
 * a function the variant judges without a row fails later, in `resolveBaselineSelection`.
 */
export function readBaselineSelections(filePath: string): DomainResult<readonly BaselineSelection[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return missing(`Baseline report could not be read: ${e instanceof Error ? e.message : String(e)}`, filePath);
  }
  const rows = typeof parsed === 'object' && parsed !== null ? (parsed as { neuralResults?: unknown }).neuralResults : undefined;
  if (!Array.isArray(rows)) return missing('Baseline report has no neuralResults[] rows', filePath);
  const selections: BaselineSelection[] = [];
  for (const [i, row] of (rows as unknown[]).entries()) {
    const problem = neuralResultRowProblem(row);
    if (problem !== null) return missing(`Baseline report row ${String(i)} is not a neural result row: ${problem}`, filePath);
    const r = row as NeuralResultRow;
    selections.push({
      functionId: r.functionId,
      candidateUnitIds: [...r.selection.candidateUnitIds],
      selectedUnitIds: [...r.selection.selectedUnitIds],
      source: r.selection.source,
    });
  }
  return DomainResult.ok(selections.sort((a, b) => compareStrings(String(a.functionId), String(b.functionId))));
}
