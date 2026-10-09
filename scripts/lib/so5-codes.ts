/**
 * SO5 code tables loader (SO5, ADR-017 item 2; BR-U5b-30, 64; U5b domain-entities §6).
 *
 * `Docs/analysis-plan.md` holds the frozen function → failure-pattern family table (`FPAT-*`) and the
 * `failureReason` → generation-outcome code table (`GEN-*`) in one fenced machine block (```yaml so5-codes).
 * The GEN mapping of `run-experiment.ts` and the FPAT counting of `aggregate.ts` read only this loader. A missing,
 * duplicated or malformed block is refused with `SO5_CODES_INVALID` and a message naming the file.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

export const ANALYSIS_PLAN_DOC = 'Docs/analysis-plan.md';
export const SO5_CODES_INVALID = 'SO5_CODES_INVALID';

/** The ten BR-U5b-64 failure-pattern families, canonical order. */
export const FPAT_FAMILIES = [
  'FPAT-DEP-DIRECTION', 'FPAT-FRAMEWORK-LEAK', 'FPAT-CYCLE', 'FPAT-COUPLING', 'FPAT-SOLID', 'FPAT-NAMING',
  'FPAT-PATTERN', 'FPAT-DATAFLOW', 'FPAT-SEMANTIC', 'FPAT-INTEGRITY',
] as const;
export type FpatFamily = (typeof FPAT_FAMILIES)[number];

/** U5a `failureReason` values (BR-U5a-48) and the seven `GEN-*` codes (BR-U5b-64). */
export const FAILURE_REASONS = [
  'typecheck', 'agent-error', 'model-mismatch', 'skeleton-tampered', 'infrastructure', 'envelope-unreadable', 'timeout',
] as const;
export type FailureReason = (typeof FAILURE_REASONS)[number];
export const GEN_CODES = [
  'GEN-TYPECHECK', 'GEN-AGENT-ERROR', 'GEN-MODEL-MISMATCH', 'GEN-SKELETON-TAMPERED', 'GEN-INFRA',
  'GEN-ENVELOPE-UNREADABLE', 'GEN-TIMEOUT',
] as const;
export type GenCode = (typeof GEN_CODES)[number];

export const JUDGE_DIMENSIONS = ['semantic', 'integrity'] as const;
export type JudgeDimension = (typeof JUDGE_DIMENSIONS)[number];

export interface So5Codes {
  readonly version: string;
  readonly fpatFamilies: readonly FpatFamily[];
  /** Template id → family. */
  readonly functionFamilies: Readonly<Record<string, FpatFamily>>;
  readonly judgeDimensions: Readonly<Record<JudgeDimension, FpatFamily>>;
  readonly genCodes: Readonly<Record<FailureReason, GenCode>>;
}

export type So5Load =
  | { readonly ok: true; readonly codes: So5Codes }
  | { readonly ok: false; readonly code: typeof SO5_CODES_INVALID; readonly detail: string };

const BLOCK = /^```yaml so5-codes[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/gm;

function refuse(detail: string): So5Load {
  return { ok: false, code: SO5_CODES_INVALID, detail: `${ANALYSIS_PLAN_DOC}: ${detail}` };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function sameSet(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && new Set(a).size === a.length && a.every((x) => b.includes(x));
}

/** Parses the document text into `So5Codes`, or refuses. */
export function parseSo5Codes(doc: string): So5Load {
  const blocks = [...doc.matchAll(BLOCK)];
  if (blocks.length !== 1) return refuse(`expected exactly one \`\`\`yaml so5-codes block, found ${String(blocks.length)}`);
  let raw: unknown;
  try {
    raw = parseYaml(blocks[0]?.[1] ?? '');
  } catch (e) {
    return refuse(`so5-codes block is not YAML: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!isRecord(raw)) return refuse('so5-codes block is not a mapping');
  const { version, fpatFamilies, functionFamilies, judgeDimensions, genCodes } = raw;
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) return refuse('version must be x.y.z');
  if (!Array.isArray(fpatFamilies) || !sameSet(fpatFamilies, FPAT_FAMILIES)) return refuse('fpatFamilies must be the ten BR-U5b-64 families');
  const families = new Set<string>(FPAT_FAMILIES);
  if (!isRecord(functionFamilies) || Object.keys(functionFamilies).length === 0) return refuse('functionFamilies must be a non-empty mapping');
  for (const [fn, fam] of Object.entries(functionFamilies)) {
    if (typeof fam !== 'string' || !families.has(fam)) return refuse(`functionFamilies.${fn} is not an FPAT family`);
  }
  if (!isRecord(judgeDimensions) || !sameSet(Object.keys(judgeDimensions), JUDGE_DIMENSIONS)) return refuse('judgeDimensions must map semantic and integrity');
  for (const [dim, fam] of Object.entries(judgeDimensions)) {
    if (typeof fam !== 'string' || !families.has(fam)) return refuse(`judgeDimensions.${dim} is not an FPAT family`);
  }
  if (!isRecord(genCodes) || !sameSet(Object.keys(genCodes), FAILURE_REASONS)) return refuse('genCodes must map exactly the seven U5a failureReason values');
  const genValues = Object.values(genCodes);
  if (!sameSet(genValues, GEN_CODES)) return refuse('genCodes values must be the seven GEN-* codes, one each');
  return {
    ok: true,
    codes: {
      version,
      fpatFamilies: fpatFamilies as FpatFamily[],
      functionFamilies: functionFamilies as Record<string, FpatFamily>,
      judgeDimensions: judgeDimensions as Record<JudgeDimension, FpatFamily>,
      genCodes: genCodes as Record<FailureReason, GenCode>,
    },
  };
}

export function loadSo5Codes(repoRoot: string): So5Load {
  const file = join(repoRoot, ANALYSIS_PLAN_DOC);
  if (!existsSync(file)) return refuse('file not found');
  return parseSo5Codes(readFileSync(file, 'utf8'));
}

/** The GEN code of a generation outcome: none for `ok` (BR-U5b-64). */
export function genCodeOf(codes: So5Codes, status: string, failureReason: string | undefined): GenCode | undefined {
  if (status === 'ok' || failureReason === undefined) return undefined;
  return (codes.genCodes as Record<string, GenCode | undefined>)[failureReason];
}

/** The FPAT family of a template id, or of a judge dimension (`semantic` / `integrity`). */
export function familyOf(codes: So5Codes, templateOrDimension: string): FpatFamily | undefined {
  return (codes.functionFamilies as Record<string, FpatFamily | undefined>)[templateOrDimension]
    ?? (codes.judgeDimensions as Record<string, FpatFamily | undefined>)[templateOrDimension];
}

/**
 * Join codes of an E1 cell that U5a never produced an outcome for, or whose outcome breaks the registered generator
 * plan (ADR-021 SO5-03, SO5-05). They are not U5a `failureReason` values, so they sit outside the registered
 * `genCodes` table of `Docs/analysis-plan.md`; the P-U6 bump documents them beside it.
 */
export const JOIN_GEN_CODES = Object.freeze({ missing: 'GEN-MISSING', 'protocol-mismatch': 'GEN-PROTOCOL-MISMATCH' } as const);
export type JoinGenCode = (typeof JOIN_GEN_CODES)[keyof typeof JOIN_GEN_CODES];

/**
 * The GEN code of an E1 cell (`RunRecord.cell`): a join code for a `missing` or `protocol-mismatch` cell, else the
 * registered code of its U5a `failureReason` (`genCodeOf`); none for an `ok` cell.
 */
export function cellGenCode(
  codes: So5Codes,
  cell: { readonly generationStatus: string; readonly failureReason?: string },
): GenCode | JoinGenCode | undefined {
  if (cell.generationStatus === 'missing') return JOIN_GEN_CODES.missing;
  if (cell.generationStatus === 'protocol-mismatch') return JOIN_GEN_CODES['protocol-mismatch'];
  return genCodeOf(codes, cell.generationStatus, cell.failureReason);
}
