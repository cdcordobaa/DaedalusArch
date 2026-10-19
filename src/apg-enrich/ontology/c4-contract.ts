/**
 * The C4 output contract, A5 (v1.4 U9; `ops/notes/c4-01-interpretation-design.md` §4.2 to §4.4, §6.2).
 *
 * - `groundC4Answer`: rules 2 to 4 of §4.2 on one schema-valid answer. An exception claim must cite a **doc or comment**
 *   line, never code; the path must be a project doc (or a comment line of a source file), the lines must exist, and
 *   the quote (whitespace collapsed) must occur in them. A failing citation turns the claim into `claimed: false` and
 *   is counted as a hallucinated exception. The validator never repairs a citation. A claim that also says
 *   `contradicts-declared-intent` is kept and flagged `inconsistent` (falsifier 4).
 * - `mergeRuns`: rule 6, two runs per finding; a field is stable only when both runs agree. A claim made in one run
 *   only is `single-run` and never forwarded to C2.
 * - `buildA5`: `interpretations.json` and `proposed-exceptions.json` (§4.3). The C3 verdict is copied, never computed.
 * - `keywordBaseline`: the zero-call baseline of §6.2.
 *
 * Nothing in the scoring path reads A5 (§4.4); `tests/unit/apg-enrich/ontology/c4-invariance.test.ts` checks it.
 * Pure: the file reader and the project's docs are passed in.
 */
import { collapseWhitespace } from './grounding.js';
import type { FileReader } from './grounding.js';
import type { ProjectDoc } from './reading.js';
import type { C3Verdict, C4Finding } from './c4-findings.js';
import { c3VerdictOf } from './c4-findings.js';
import { COMMENT_LINE, fileStem } from './interpretation.js';
import type { C4Answer, ExceptionCitation, IntentStatus, SeverityClass } from './interpretation.js';

export type C4RejectionReason =
  | 'exception-without-citation'
  | 'citation-unknown-path'
  | 'citation-lines-out-of-range'
  | 'citation-not-doc-or-comment'
  | 'citation-quote-mismatch'
  | 'cite-unresolved';

export interface C4Rejection {
  readonly reason: C4RejectionReason;
  readonly detail: string;
}

export interface GroundedC4Answer {
  /** The answer after grounding: a rejected exception citation is `claimed: false`, `citation: null`. */
  readonly answer: C4Answer;
  readonly rejections: readonly C4Rejection[];
  /** The model claimed an exception whose citation failed grounding. */
  readonly hallucinatedException: boolean;
  /** `contradicts-declared-intent` and a (grounded) exception claim in one answer (C4-01 §10 falsifier 4). */
  readonly inconsistent: boolean;
}

/** The comment part of a source line (from `//` or `/*`, or the whole line inside a block comment), or null. */
export function commentPart(line: string): string | null {
  if (COMMENT_LINE.test(line)) return line.trim();
  const i = line.search(/\/\/|\/\*/);
  return i < 0 ? null : line.slice(i);
}

const PATH_LINE = /^(.+?):(\d+)(?:-(\d+))?$/;

/**
 * Grounds one exception citation. Docs: any line of a project doc. Source files: every cited line must hold a
 * comment, and the quote must lie in the comment parts. Returns the first failure, or null when grounded.
 */
export function checkExceptionCitation(c: ExceptionCitation, docs: readonly ProjectDoc[], read: FileReader): C4Rejection | null {
  const doc = docs.find((d) => d.path === c.path);
  const text = doc?.text ?? read(c.path);
  if (text === null) return { reason: 'citation-unknown-path', detail: `${c.path} is neither a project doc nor a project file` };
  const lines = text.split('\n');
  if (c.startLine < 1 || c.endLine < c.startLine || c.endLine > lines.length) {
    return { reason: 'citation-lines-out-of-range', detail: `${c.path}:${String(c.startLine)}-${String(c.endLine)} (file has ${String(lines.length)} lines)` };
  }
  const cited = lines.slice(c.startLine - 1, c.endLine);
  let haystack: string;
  if (doc !== undefined) {
    haystack = cited.join('\n');
  } else {
    const parts = cited.map(commentPart);
    if (parts.some((p) => p === null)) return { reason: 'citation-not-doc-or-comment', detail: `${c.path}:${String(c.startLine)}-${String(c.endLine)} cites code, not a comment` };
    haystack = parts.join('\n');
  }
  const quote = collapseWhitespace(c.quote);
  if (quote === '' || !collapseWhitespace(haystack).includes(quote)) return { reason: 'citation-quote-mismatch', detail: `quote not found in ${c.path}:${String(c.startLine)}-${String(c.endLine)}` };
  return null;
}

/** A `path:line` or `path:start-end` cite resolves when the path is a doc or project file and the lines exist. */
function citeResolves(cite: string, docs: readonly ProjectDoc[], read: FileReader): boolean {
  const m = PATH_LINE.exec(cite.trim());
  if (m === null) return false;
  const p = m[1] ?? '';
  const text = docs.find((d) => d.path === p)?.text ?? read(p);
  if (text === null) return false;
  const n = text.split('\n').length;
  const a = Number(m[2]);
  const b = m[3] !== undefined ? Number(m[3]) : a;
  return a >= 1 && b >= a && b <= n;
}

/** C4-01 §4.2 rules 2 to 4 on one schema-valid answer. Unresolved `cites` are dropped and listed, not fatal. */
export function groundC4Answer(answer: C4Answer, docs: readonly ProjectDoc[], read: FileReader): GroundedC4Answer {
  const rejections: C4Rejection[] = [];
  let claim = answer.exceptionClaim;
  let hallucinated = false;
  if (claim.claimed) {
    const r = claim.citation === null
      ? { reason: 'exception-without-citation' as const, detail: 'an exception claim needs a doc or comment citation' }
      : checkExceptionCitation(claim.citation, docs, read);
    if (r !== null) {
      rejections.push(r);
      hallucinated = true;
      claim = { claimed: false, citation: null, scope: null };
    }
  }
  const keep = (cites: readonly string[]): string[] => cites.filter((c) => {
    const ok = citeResolves(c, docs, read);
    if (!ok) rejections.push({ reason: 'cite-unresolved', detail: c });
    return ok;
  });
  const grounded: C4Answer = {
    ...answer,
    intentMatch: { status: answer.intentMatch.status, cites: keep(answer.intentMatch.cites) },
    exceptionClaim: claim,
    cites: keep(answer.cites),
  };
  return { answer: grounded, rejections, hallucinatedException: hallucinated, inconsistent: claim.claimed && answer.intentMatch.status === 'contradicts-declared-intent' };
}

// ── Two runs (§4.2 rule 6) ──────────────────────────────────────────────────────────────────────────────────────────

export interface C4Run {
  readonly runIndex: number;
  /** Null when the run gave no valid answer (schema failure twice, budget, cassette miss). */
  readonly grounded: GroundedC4Answer | null;
  readonly modelId: string | null;
  readonly promptHash: string;
  /** When the answer was recorded (a replay keeps the recorded date); null without an answer. */
  readonly date: string | null;
  readonly invalidReason: string | null;
}

export type Stability = 'agreed' | 'single-run' | 'disagreed' | 'none';

export interface MergedInterpretation {
  readonly exception: { readonly claimed: boolean; readonly stability: Stability; readonly citation: ExceptionCitation | null; readonly scope: string | null };
  readonly intentMatch: { readonly status: IntentStatus | null; readonly stability: Stability };
  readonly severityClass: { readonly value: SeverityClass | null; readonly stability: Stability };
  /** The first valid run's explanation (free text is never merged). */
  readonly explanation: string | null;
  readonly validRuns: number;
}

const sameLines = (a: ExceptionCitation, b: ExceptionCitation): boolean => a.path === b.path && a.startLine <= b.endLine && b.startLine <= a.endLine;

function field<T>(values: readonly T[], runs: number, eq: (a: T, b: T) => boolean = (a, b) => a === b): { value: T | null; stability: Stability } {
  if (values.length === 0) return { value: null, stability: 'none' };
  const first = values[0] as T;
  if (values.length < runs) return { value: null, stability: 'single-run' };
  return values.every((v) => eq(v, first)) ? { value: first, stability: 'agreed' } : { value: null, stability: 'disagreed' };
}

/** Merges the runs of one finding. A stable exception needs every run to claim it, citing overlapping lines of one path. */
export function mergeRuns(runs: readonly C4Run[]): MergedInterpretation {
  const valid = runs.flatMap((r) => (r.grounded === null ? [] : [r.grounded.answer]));
  const n = runs.length;
  const claims = valid.map((a) => a.exceptionClaim);
  const anyClaim = claims.some((c) => c.claimed);
  let exception: MergedInterpretation['exception'];
  if (!anyClaim) {
    exception = { claimed: false, stability: valid.length === n ? 'agreed' : valid.length === 0 ? 'none' : 'single-run', citation: null, scope: null };
  } else {
    const first = claims.find((c) => c.claimed && c.citation !== null);
    const allClaim = valid.length === n && claims.every((c) => c.claimed && c.citation !== null && first?.citation !== null && first?.citation !== undefined && sameLines(c.citation, first.citation));
    exception = allClaim && first !== undefined
      ? { claimed: true, stability: 'agreed', citation: first.citation, scope: first.scope }
      : { claimed: false, stability: claims.filter((c) => c.claimed).length === 1 && n > 1 ? 'single-run' : 'disagreed', citation: null, scope: null };
  }
  const intent = field(valid.map((a) => a.intentMatch.status), n);
  const sev = field(valid.map((a) => a.severityClass), n);
  return {
    exception,
    intentMatch: { status: intent.value, stability: intent.stability },
    severityClass: { value: sev.value, stability: sev.stability },
    explanation: valid[0]?.explanation ?? null,
    validRuns: valid.length,
  };
}

// ── A5 (§4.3) ────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface A5Entry {
  readonly findingId: string;
  readonly finding: C4Finding;
  /** Copied from C3, unchanged. */
  readonly c3Verdict: C3Verdict;
  readonly promptVersion: string;
  readonly runs: readonly C4Run[];
  readonly merged: MergedInterpretation;
}

export interface A5File {
  readonly schemaVersion: 1;
  readonly artifact: 'A5';
  readonly project: { readonly id: string };
  readonly producer: {
    readonly part: 'C4';
    readonly promptVersion: string;
    readonly provider: string;
    readonly model: string;
    readonly runs: number;
    readonly exploratory: boolean;
  };
  readonly entries: readonly A5Entry[];
}

export interface ProposedException {
  readonly findingId: string;
  readonly rule: string;
  readonly files: readonly string[];
  readonly citation: ExceptionCitation;
  readonly scope: string | null;
  /** A human accepts or refuses each proposal in C2; until then it changes nothing (C4-01 §1). */
  readonly status: 'proposed';
}

export function a5Entry(finding: C4Finding, promptVersion: string, runs: readonly C4Run[]): A5Entry {
  return { findingId: finding.id, finding, c3Verdict: c3VerdictOf(finding), promptVersion, runs, merged: mergeRuns(runs) };
}

/** Stable, grounded exception claims only (`agreed`); a `single-run` claim is never forwarded to C2. */
export function proposedExceptions(a5: A5File): ProposedException[] {
  return a5.entries.flatMap((e) => (e.merged.exception.claimed && e.merged.exception.stability === 'agreed' && e.merged.exception.citation !== null
    ? [{ findingId: e.findingId, rule: e.finding.rule, files: e.finding.files, citation: e.merged.exception.citation, scope: e.merged.exception.scope, status: 'proposed' as const }]
    : []));
}

// ── The zero-call keyword baseline (§6.2) ────────────────────────────────────────────────────────────────────────────

export const BASELINE_KEYWORDS = /\b(allow\w*|permit\w*|exceptions?|legacy|shared)\b/i;

export interface BaselineAnswer {
  readonly claimed: boolean;
  /** The first matching line: docs first (in path order), then comment lines of the finding's files. */
  readonly citation: ExceptionCitation | null;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * "An exception is claimed if any doc or comment line names the site file or class and contains allow, permit,
 * exception, legacy or shared." `classNames` are the site classes' names. Deterministic; no model.
 */
export function keywordBaseline(finding: C4Finding, classNames: readonly string[], docs: readonly ProjectDoc[], read: FileReader): BaselineAnswer {
  const names = [...new Set([...classNames, ...finding.files, ...finding.files.map(fileStem)])].filter((s) => s.length >= 3);
  if (names.length === 0) return { claimed: false, citation: null };
  const re = new RegExp(`(^|[^A-Za-z0-9_])(${names.map(escapeRe).join('|')})(?![A-Za-z0-9_])`);
  const hit = (text: string): boolean => re.test(text) && BASELINE_KEYWORDS.test(text);
  for (const d of [...docs].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    const lines = d.text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i] ?? '';
      if (hit(l)) return { claimed: true, citation: { path: d.path, startLine: i + 1, endLine: i + 1, quote: l.trim() } };
    }
  }
  for (const f of finding.files) {
    const lines = (read(f) ?? '').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const c = commentPart(lines[i] ?? '');
      if (c !== null && hit(c)) return { claimed: true, citation: { path: f, startLine: i + 1, endLine: i + 1, quote: c } };
    }
  }
  return { claimed: false, citation: null };
}
