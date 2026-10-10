/**
 * Judge-diagnostics coding frame loader (ADR-028 item 4; `Docs/analysis-plan.md` §12.4).
 *
 * The frame is the one fenced machine block ```yaml judge-coding-frame of the analysis plan: per judged function, the
 * criteria derived from the fail clauses of the frozen rubrics, each a list of case-insensitive regular expressions.
 * `codeRationale` applies it mechanically: every criterion of the unit's function with at least one match (frame
 * order, multi-label), else the `uncoded` code. Frame 1.1.0 (ADR-028 v15, Fable review): the primary text is the
 * carrier run's violation messages only (`primary.textFields`); a secondary coding of the reasoning drops a match when
 * one of the `negationGuard` tokens (single words or a two-word phrase) is among the `window` tokens before it
 * (`codeRationaleGuarded`); a code is informative when its discrimination (share among failing units' messages minus
 * the guarded share among passing units' reasoning) is at least `informativeThreshold`. A missing, duplicated or malformed block is refused with
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

export type TextField = 'reasoning' | 'violations.message';
export const TEXT_FIELDS: readonly TextField[] = ['reasoning', 'violations.message'];

export interface NegationGuard {
  readonly window: number;
  /** Lower-case guard tokens; an entry with a space is a phrase matched as consecutive tokens (e.g. `free of`). */
  readonly tokens: readonly string[];
}

export interface CodingFrame {
  readonly version: string;
  readonly uncoded: string;
  readonly primaryTextFields: readonly TextField[];
  readonly secondaryTextFields: readonly TextField[];
  readonly negationGuard: NegationGuard;
  readonly informativeThreshold: number;
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
  const { version, uncoded, functions, primary, secondary, discrimination } = raw;
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) return refuse('version must be x.y.z');
  if (typeof uncoded !== 'string' || uncoded === '') return refuse('uncoded must be a code');
  const fieldsOf = (v: unknown, name: string): TextField[] | string => {
    const f = isRecord(v) ? v['textFields'] : undefined;
    if (!Array.isArray(f) || f.length === 0 || !f.every((x) => (TEXT_FIELDS as readonly unknown[]).includes(x))) return `${name}.textFields must list ${TEXT_FIELDS.join(' / ')}`;
    return f as TextField[];
  };
  const primaryFields = fieldsOf(primary, 'primary');
  if (typeof primaryFields === 'string') return refuse(primaryFields);
  const secondaryFields = fieldsOf(secondary, 'secondary');
  if (typeof secondaryFields === 'string') return refuse(secondaryFields);
  const guard = isRecord(secondary) ? secondary['negationGuard'] : undefined;
  if (!isRecord(guard) || !Number.isInteger(guard['window']) || (guard['window'] as number) < 1
    || !Array.isArray(guard['tokens']) || guard['tokens'].length === 0 || !guard['tokens'].every((t) => typeof t === 'string' && t.trim() !== '')) {
    return refuse('secondary.negationGuard needs an integer window ≥ 1 and a non-empty token list');
  }
  const threshold = isRecord(discrimination) ? discrimination['informativeThreshold'] : undefined;
  if (typeof threshold !== 'number' || threshold < 0 || threshold > 1) return refuse('discrimination.informativeThreshold must be in [0, 1]');
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
  return {
    ok: true,
    frame: {
      version, uncoded, functions: out, primaryTextFields: primaryFields, secondaryTextFields: secondaryFields,
      negationGuard: { window: guard['window'] as number, tokens: (guard['tokens'] as string[]).map((t) => t.trim().toLowerCase()) },
      informativeThreshold: threshold,
    },
  };
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

const TOKEN = /[a-z0-9'_-]+/g;

/** True when a guard token or phrase is among the `window` tokens before `index` in `text`. */
export function negatedAt(text: string, index: number, guard: NegationGuard): boolean {
  const before = text.slice(0, index).toLowerCase().match(TOKEN) ?? [];
  const win = before.slice(-guard.window);
  return guard.tokens.some((t) => {
    const parts = t.split(/\s+/);
    for (let i = 0; i + parts.length <= win.length; i++) {
      if (parts.every((p, j) => win[i + j] === p)) return true;
    }
    return false;
  });
}

/**
 * Secondary coding (frame 1.1.0): a criterion is coded when at least one of its matches is not negated
 * (`negatedAt`); `[uncoded]` when none survives.
 */
export function codeRationaleGuarded(frame: CodingFrame, functionId: string, text: string): readonly string[] {
  const hits = (frame.functions[functionId] ?? []).filter((c) => c.patterns.some((p) => {
    const re = new RegExp(p.source, 'gi');
    for (const m of text.matchAll(re)) {
      if (!negatedAt(text, m.index, frame.negationGuard)) return true;
    }
    return false;
  })).map((c) => c.code);
  return hits.length > 0 ? hits : [frame.uncoded];
}
