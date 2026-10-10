/**
 * Judge-diagnostics coding frame loader (ADR-028 item 4; `Docs/analysis-plan.md` §12.4).
 *
 * The frame is the one fenced machine block ```yaml judge-coding-frame of the analysis plan: per judged function, the
 * criteria derived from the fail clauses of the frozen rubrics, each a list of case-insensitive regular expressions.
 * `codeRationale` applies it mechanically: every criterion of the unit's function with at least one match (frame
 * order, multi-label), else the `uncoded` code. A missing, duplicated or malformed block is refused with
 * `JUDGE_CODING_FRAME_INVALID` naming the file. Pure apart from `loadCodingFrame` reading the plan.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

export const ANALYSIS_PLAN_DOC = 'Docs/analysis-plan.md';
export const JUDGE_CODING_FRAME_INVALID = 'JUDGE_CODING_FRAME_INVALID';

export interface CodingCriterion {
  readonly code: string;
  readonly rubricClause: string;
  readonly patterns: readonly RegExp[];
}

export interface CodingFrame {
  readonly version: string;
  readonly uncoded: string;
  /** Function id → criteria in frame order. */
  readonly functions: Readonly<Record<string, readonly CodingCriterion[]>>;
}

export type CodingFrameLoad =
  | { readonly ok: true; readonly frame: CodingFrame }
  | { readonly ok: false; readonly code: typeof JUDGE_CODING_FRAME_INVALID; readonly detail: string };

const BLOCK = /^```yaml judge-coding-frame[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/gm;

function refuse(detail: string): CodingFrameLoad {
  return { ok: false, code: JUDGE_CODING_FRAME_INVALID, detail: `${ANALYSIS_PLAN_DOC}: ${detail}` };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Parses the analysis-plan text into a `CodingFrame`, or refuses. */
export function parseCodingFrame(doc: string): CodingFrameLoad {
  const blocks = [...doc.matchAll(BLOCK)];
  if (blocks.length !== 1) return refuse(`expected exactly one \`\`\`yaml judge-coding-frame block, found ${String(blocks.length)}`);
  let raw: unknown;
  try {
    raw = parseYaml(blocks[0]?.[1] ?? '');
  } catch (e) {
    return refuse(`judge-coding-frame block is not YAML: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!isRecord(raw)) return refuse('judge-coding-frame block is not a mapping');
  const { version, uncoded, functions } = raw;
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) return refuse('version must be x.y.z');
  if (typeof uncoded !== 'string' || uncoded === '') return refuse('uncoded must be a code');
  if (!isRecord(functions) || Object.keys(functions).length === 0) return refuse('functions must be a non-empty mapping');
  const seen = new Set<string>([uncoded]);
  const out: Record<string, CodingCriterion[]> = {};
  for (const [fn, list] of Object.entries(functions)) {
    if (!Array.isArray(list) || list.length === 0) return refuse(`functions.${fn} must be a non-empty list`);
    const criteria: CodingCriterion[] = [];
    for (const [i, c] of (list as unknown[]).entries()) {
      if (!isRecord(c)) return refuse(`functions.${fn}[${String(i)}] is not a mapping`);
      const { code, rubricClause, patterns } = c;
      if (typeof code !== 'string' || !/^JC-[A-Z0-9-]+$/.test(code)) return refuse(`functions.${fn}[${String(i)}].code must match JC-*`);
      if (seen.has(code)) return refuse(`code ${code} appears twice`);
      seen.add(code);
      if (typeof rubricClause !== 'string' || rubricClause === '') return refuse(`${code}: rubricClause is required`);
      if (!Array.isArray(patterns) || patterns.length === 0 || !patterns.every((p) => typeof p === 'string' && p !== '')) {
        return refuse(`${code}: patterns must be a non-empty list of strings`);
      }
      const compiled: RegExp[] = [];
      for (const p of patterns as string[]) {
        try {
          compiled.push(new RegExp(p, 'i'));
        } catch (e) {
          return refuse(`${code}: pattern ${p} is not a regular expression (${e instanceof Error ? e.message : String(e)})`);
        }
      }
      criteria.push({ code, rubricClause, patterns: compiled });
    }
    out[fn] = criteria;
  }
  return { ok: true, frame: { version, uncoded, functions: out } };
}

export function loadCodingFrame(repoRoot: string): CodingFrameLoad {
  const file = join(repoRoot, ANALYSIS_PLAN_DOC);
  if (!existsSync(file)) return refuse('file not found');
  return parseCodingFrame(readFileSync(file, 'utf8'));
}

/** Every code of the frame for one function, frame order, then the uncoded code. */
export function codesOf(frame: CodingFrame, functionId: string): readonly string[] {
  return [...(frame.functions[functionId] ?? []).map((c) => c.code), frame.uncoded];
}

/**
 * Codes of one rationale: every criterion of `functionId` with a matching pattern (frame order), else `[uncoded]`.
 * A function the frame does not list gets `[uncoded]`.
 */
export function codeRationale(frame: CodingFrame, functionId: string, text: string): readonly string[] {
  const hits = (frame.functions[functionId] ?? []).filter((c) => c.patterns.some((p) => p.test(text))).map((c) => c.code);
  return hits.length > 0 ? hits : [frame.uncoded];
}
