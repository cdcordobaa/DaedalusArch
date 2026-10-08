/**
 * Violation identity (C6, FR-12; U3 domain-entities.md §1.1; BR-U3-05, BR-U3-13).
 *
 * The id is a hash of the row's own identity values, so it does not depend on record order
 * and two runs over the same graph give the same ids. The encoding is frozen (BR-U3-70 item 6):
 *
 *   id = "v-" + hex(sha256(utf8(JSON.stringify([functionId, filePath, target ?? "", line ?? "", ...discriminator])))).slice(0, 16)
 *
 * Neural violations use the same hasher with `discriminator: [unitId]` (U4 Q8 A).
 */
import { createHash } from 'node:crypto';
import type { FunctionId } from '../shared/types/value-objects.js';

export interface ViolationIdInput {
  readonly functionId: FunctionId | string;
  readonly filePath: string;
  readonly target?: string | undefined;
  readonly line?: number | undefined;
  /** Values of `ResultMapping.discriminatorColumns`, in declaration order. */
  readonly discriminator: readonly string[];
}

/** Literal `filePath` of project-level violations (BR-U3-12). */
export const PROJECT_FILE_PATH = '<project>';

export function computeViolationId(input: ViolationIdInput): string {
  const line = input.line !== undefined && Number.isFinite(input.line) ? input.line : '';
  const canonical = JSON.stringify([
    String(input.functionId),
    input.filePath,
    input.target ?? '',
    line,
    ...input.discriminator,
  ]);
  return `v-${createHash('sha256').update(canonical, 'utf8').digest('hex').slice(0, 16)}`;
}

/**
 * Numeric value of a row cell: a JS number, a Neo4j `Integer` (`toNumber()`), or a bigint.
 * Anything else, and any non-finite result, is `undefined`.
 */
export function toFiniteNumber(value: unknown): number | undefined {
  let n: number | undefined;
  if (typeof value === 'number') {
    n = value;
  } else if (typeof value === 'bigint') {
    n = Number(value);
  } else if (isNeo4jNumber(value)) {
    n = value.toNumber();
  }
  return n !== undefined && Number.isFinite(n) ? n : undefined;
}

/** A Neo4j driver `Integer` (or any object exposing `toNumber()`). */
export function isNeo4jNumber(value: unknown): value is { toNumber(): number } {
  return typeof value === 'object' && value !== null
    && typeof (value as { toNumber?: unknown }).toNumber === 'function';
}

/**
 * One discriminator value as a string (domain-entities.md §1.1): a list is `JSON.stringify(list)`,
 * `null`/missing is `""`, a number (incl. a Neo4j `Integer`) is `String(Number(x))`.
 */
export function discriminatorValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return JSON.stringify(value);
  const n = toFiniteNumber(value);
  if (n !== undefined) return String(n);
  return scalarText(value);
}

/** Text of a non-numeric cell: strings raw, other primitives via `String`, objects as JSON. */
export function scalarText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  if (value === null || value === undefined) return '';
  if (typeof value === 'function' || typeof value === 'symbol') return '';
  return JSON.stringify(value);
}

/** Discriminator values of `row` for `columns`, in declaration order. */
export function discriminatorValues(
  row: Readonly<Record<string, unknown>>,
  columns: readonly string[],
): readonly string[] {
  return columns.map((column) => discriminatorValue(row[column]));
}
