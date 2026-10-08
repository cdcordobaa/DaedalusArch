import * as path from 'node:path';
import type { CriticVerdict, CriticViolation } from './types.js';
import { VERDICT_JSON_SCHEMA } from './verdict-schema.js';
import { STRUCTURED_OUTPUT_FIELD } from './frozen.js';

/**
 * Strict verdict parsing (BR-U4-VRD-02..06, Q2 A).
 *
 * - The structured-output field of a Claude CLI envelope (`structured_output`, probe) is read
 *   first; only when it is absent is the text `result` parsed (first top-level JSON object,
 *   code fences ignored). Gemini and Mock answers are parsed as text.
 * - The verdict is validated against `VERDICT_JSON_SCHEMA` without defaults: a verdict that
 *   fails the schema is `PARSE_FAILURE`; one without `confidence` is `MISSING_CONFIDENCE`.
 *   Both make the run invalid (recorded, not retried).
 * - Violation paths are normalised to root-relative POSIX and confined to `projectRoot`
 *   (VRD-05); a path that is not one of the unit's files is dropped and counted (VRD-06).
 */

export type VerdictInvalidCause = 'PARSE_FAILURE' | 'MISSING_CONFIDENCE';

export type VerdictParseOutcome =
  | { readonly kind: 'valid'; readonly verdict: CriticVerdict }
  | { readonly kind: 'invalid'; readonly cause: VerdictInvalidCause; readonly detail: string };

const PROPS = VERDICT_JSON_SCHEMA.properties;
const VIOLATION_PROPS = PROPS.violations.items.properties;
const TOP_KEYS: readonly string[] = VERDICT_JSON_SCHEMA.required;
const VIOLATION_KEYS: readonly string[] = PROPS.violations.items.required;

function invalid(cause: VerdictInvalidCause, detail: string): VerdictParseOutcome {
  return { kind: 'invalid', cause, detail };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** JSON Schema `maxLength` counts code points, not UTF-16 units. */
function codePoints(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (unit < 0xdc00 || unit > 0xdfff || i === 0 || text.charCodeAt(i - 1) < 0xd800 || text.charCodeAt(i - 1) > 0xdbff) count++;
  }
  return count;
}

/** Validates an already-parsed value against the verdict schema (VRD-03); no defaults. */
export function validateVerdict(value: unknown): VerdictParseOutcome {
  if (!isRecord(value)) return invalid('PARSE_FAILURE', 'verdict is not a JSON object');
  if (!('confidence' in value)) return invalid('MISSING_CONFIDENCE', 'verdict has no confidence');
  for (const key of Object.keys(value)) {
    if (!TOP_KEYS.includes(key)) return invalid('PARSE_FAILURE', `unexpected property ${key}`);
  }
  for (const key of TOP_KEYS) {
    if (!(key in value)) return invalid('PARSE_FAILURE', `missing property ${key}`);
  }
  const { pass, confidence, reasoning, evidence, violations } = value;
  if (typeof pass !== 'boolean') return invalid('PARSE_FAILURE', 'pass is not a boolean');
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) {
    return invalid('PARSE_FAILURE', 'confidence is not a number');
  }
  if (confidence < PROPS.confidence.minimum || confidence > PROPS.confidence.maximum) {
    return invalid('PARSE_FAILURE', 'confidence is outside [0, 1]');
  }
  if (typeof reasoning !== 'string' || codePoints(reasoning) > PROPS.reasoning.maxLength) {
    return invalid('PARSE_FAILURE', 'reasoning is not a string within its length');
  }
  if (!Array.isArray(evidence) || evidence.length > PROPS.evidence.maxItems) {
    return invalid('PARSE_FAILURE', 'evidence is not an array within its size');
  }
  const evidenceOut: string[] = [];
  for (const item of evidence as unknown[]) {
    if (typeof item !== 'string' || codePoints(item) > PROPS.evidence.items.maxLength) {
      return invalid('PARSE_FAILURE', 'evidence item is not a string within its length');
    }
    evidenceOut.push(item);
  }
  if (!Array.isArray(violations) || violations.length > PROPS.violations.maxItems) {
    return invalid('PARSE_FAILURE', 'violations is not an array within its size');
  }
  const violationsOut: CriticViolation[] = [];
  for (const item of violations as unknown[]) {
    if (!isRecord(item)) return invalid('PARSE_FAILURE', 'violation is not an object');
    for (const key of Object.keys(item)) {
      if (!VIOLATION_KEYS.includes(key)) return invalid('PARSE_FAILURE', `unexpected violation property ${key}`);
    }
    const { filePath, message } = item;
    if (typeof filePath !== 'string') return invalid('PARSE_FAILURE', 'violation filePath is not a string');
    if (typeof message !== 'string' || codePoints(message) > VIOLATION_PROPS.message.maxLength) {
      return invalid('PARSE_FAILURE', 'violation message is not a string within its length');
    }
    violationsOut.push({ filePath, message });
  }
  return {
    kind: 'valid',
    verdict: { pass, confidence, reasoning, evidence: evidenceOut, violations: violationsOut },
  };
}

/**
 * Returns the first top-level JSON object in `text` (a balanced `{...}` that parses), or
 * `undefined`. Code fences and surrounding prose are skipped by construction.
 */
export function firstJsonObject(text: string): unknown {
  for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
    const end = matchingBrace(text, start);
    if (end === -1) continue;
    try {
      const parsed: unknown = JSON.parse(text.slice(start, end + 1));
      if (isRecord(parsed)) return parsed;
    } catch {
      // not JSON at this brace; try the next one
    }
  }
  return undefined;
}

function matchingBrace(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Text answer (Gemini, Mock, CLI `result` fallback): first top-level JSON object, then the schema. */
export function parseVerdictText(text: string): VerdictParseOutcome {
  const value = firstJsonObject(text);
  if (value === undefined) return invalid('PARSE_FAILURE', 'no JSON object in the answer');
  return validateVerdict(value);
}

/**
 * Claude CLI envelope (VRD-02): `structured_output` first; the text `result` only when the
 * structured field is absent. The envelope itself must already be a parsed JSON object.
 */
export function parseEnvelopeVerdict(envelope: unknown): VerdictParseOutcome {
  if (!isRecord(envelope)) return invalid('PARSE_FAILURE', 'envelope is not a JSON object');
  if (STRUCTURED_OUTPUT_FIELD in envelope && envelope[STRUCTURED_OUTPUT_FIELD] !== undefined) {
    return validateVerdict(envelope[STRUCTURED_OUTPUT_FIELD]);
  }
  const result = envelope.result;
  if (typeof result !== 'string') return invalid('PARSE_FAILURE', 'envelope has no structured output and no result text');
  return parseVerdictText(result);
}

/**
 * Compatibility entry for the pre-Step-21 critic: the strict text parse, `null` when invalid.
 * No default is ever filled in.
 */
export function parseVerdict(raw: string): CriticVerdict | null {
  const outcome = parseVerdictText(raw);
  return outcome.kind === 'valid' ? outcome.verdict : null;
}

/**
 * VRD-05: `\` → `/`, leading `./` stripped, resolved against `projectRoot`; `null` when the
 * result is outside `projectRoot` (or is the root itself); otherwise root-relative POSIX.
 */
export function normaliseViolationPath(raw: string, projectRoot: string): string | null {
  let candidate = raw.trim().replace(/\\/g, '/');
  while (candidate.startsWith('./')) candidate = candidate.slice(2);
  if (candidate === '') return null;
  const root = path.posix.resolve(projectRoot.replace(/\\/g, '/'));
  const absolute = path.posix.resolve(root, candidate);
  const relative = path.posix.relative(root, absolute);
  if (relative === '' || relative === '..' || relative.startsWith('../') || path.posix.isAbsolute(relative)) {
    return null;
  }
  return relative;
}

export interface MembershipResult<T> {
  readonly kept: readonly T[];
  readonly droppedOutside: number;   // VRD-05: outside projectRoot or empty
  readonly droppedNonMember: number; // VRD-06: inside the root but not one of the unit's files
}

/**
 * VRD-05 and VRD-06 over a run's violations: each `filePath` is normalised; violations whose
 * path is outside the root or not a unit member are dropped and counted (no basename guessing).
 * Kept violations carry the normalised path.
 */
export function filterMembers<T extends { readonly filePath: string }>(
  items: readonly T[],
  unit: { readonly filePaths: readonly string[] },
  projectRoot: string,
): MembershipResult<T> {
  const members = new Set(unit.filePaths);
  const kept: T[] = [];
  let droppedOutside = 0;
  let droppedNonMember = 0;
  for (const item of items) {
    const normalised = normaliseViolationPath(item.filePath, projectRoot);
    if (normalised === null) {
      droppedOutside++;
    } else if (!members.has(normalised)) {
      droppedNonMember++;
    } else {
      kept.push({ ...item, filePath: normalised });
    }
  }
  return { kept, droppedOutside, droppedNonMember };
}
