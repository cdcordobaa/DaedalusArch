/**
 * The C4 scorer (v1.4 U9; `ops/notes/c4-01-interpretation-design.md` §6, §7, §10). Reads a case manifest
 * (`expected-c4.json`, written and hashed before any C4 call) against the A5 entries of that project.
 *
 * A target is **correct** when, in every run: the exception claim is right (claimed or not); a claim cites one of
 * the planted line ranges; `intentMatch.status` is the expected one; `severityClass` is in the allowed set.
 * A twin (or any project) is **clean** when no finding of it carries a grounded exception claim in any run.
 * The keyword baseline is scored on the same target by the same rule for the exception part.
 */
import type { A5Entry, BaselineAnswer } from './c4-contract.js';
import type { C4Finding } from './c4-findings.js';
import type { IntentStatus, SeverityClass } from './interpretation.js';

export interface PlantedLines {
  readonly path: string;
  readonly startLine: number;
  readonly endLine: number;
}

/** `expected-c4.json`. */
export interface C4CaseManifest {
  readonly schemaVersion: 1;
  readonly case: string;
  readonly pair: string;
  readonly role: 'case' | 'twin';
  readonly style: string;
  /** Repo-relative spec the C3 run uses; absent for a SEM-only case (no symbolic C3 run). */
  readonly spec?: string;
  /** Repo-relative project dir, when the project is not the manifest's own dir (a reused NS-02 twin). */
  readonly projectDir?: string;
  /** Who wrote the code and this manifest, and whether that author is independent of the C4 pipeline (C4-01 §6, §6.1). */
  readonly authorship: { readonly writtenBy: string; readonly independentOfC4: boolean; readonly signedByAuthor: boolean; readonly note: string };
  readonly writtenAt: string;
  /** The target blocking finding: rule and source file (and the edge target when there is one). */
  readonly target: { readonly rule: string; readonly file: string; readonly edgeTarget?: string };
  readonly expected: {
    readonly exceptionClaimed: boolean;
    /** Any of these line ranges is the planted grant (required non-empty when `exceptionClaimed`). */
    readonly citations: readonly PlantedLines[];
    readonly intentMatch: IntentStatus;
    readonly severityAllowed: readonly SeverityClass[];
  };
  /** What the case tests (C4-01 §6 table). */
  readonly tests: string;
  /** For a SEM case: where its A2 facts come from (mock until L3 has run live, C4-01 §6). */
  readonly a2?: { readonly mode: 'mock-scripted'; readonly answers: string; readonly layers: string };
}

export interface C4CaseScore {
  readonly case: string;
  readonly pair: string;
  readonly role: 'case' | 'twin';
  readonly targetFound: boolean;
  /** Null when the target was not among the findings or had no valid run. */
  readonly correct: boolean | null;
  readonly failures: readonly string[];
  /** No grounded exception claim on any finding of the project, in any run. */
  readonly clean: boolean;
  readonly falseExceptionClaims: number;
  readonly hallucinatedExceptions: number;
  readonly inconsistent: number;
  readonly baseline: { readonly correct: boolean | null; readonly clean: boolean };
}

const overlaps = (a: PlantedLines, b: PlantedLines): boolean => a.path === b.path && a.startLine <= b.endLine && b.startLine <= a.endLine;

/** The A5 entry of the manifest's target (rule and source file, and the edge target when given), or undefined. */
export function targetEntry<T extends { readonly finding: C4Finding }>(m: C4CaseManifest, entries: readonly T[]): T | undefined {
  return entries.find((e) => e.finding.rule === m.target.rule && e.finding.files[0] === m.target.file
    && (m.target.edgeTarget === undefined || e.finding.edge?.target === m.target.edgeTarget));
}

function claimRight(m: C4CaseManifest, claimed: boolean, citation: PlantedLines | null): boolean {
  if (claimed !== m.expected.exceptionClaimed) return false;
  return !claimed || (citation !== null && m.expected.citations.some((p) => overlaps(p, citation)));
}

export function scoreC4Case(m: C4CaseManifest, entries: readonly A5Entry[], baseline: ReadonlyMap<string, BaselineAnswer>): C4CaseScore {
  const t = targetEntry(m, entries);
  const failures: string[] = [];
  let correct: boolean | null = null;
  if (t !== undefined && t.runs.length > 0 && t.runs.every((r) => r.grounded !== null)) {
    correct = true;
    for (const r of t.runs) {
      const a = r.grounded?.answer;
      if (a === undefined) continue;
      const tag = `run ${String(r.runIndex)}`;
      if (!claimRight(m, a.exceptionClaim.claimed, a.exceptionClaim.citation)) failures.push(`${tag}: exception claim ${String(a.exceptionClaim.claimed)}${a.exceptionClaim.citation !== null ? ` at ${a.exceptionClaim.citation.path}:${String(a.exceptionClaim.citation.startLine)}` : ''}`);
      if (a.intentMatch.status !== m.expected.intentMatch) failures.push(`${tag}: intent ${a.intentMatch.status}, expected ${m.expected.intentMatch}`);
      if (!m.expected.severityAllowed.includes(a.severityClass)) failures.push(`${tag}: severity ${a.severityClass} not in ${m.expected.severityAllowed.join('/')}`);
    }
    correct = failures.length === 0;
  } else if (t !== undefined) {
    failures.push('no valid run on the target');
  } else {
    failures.push('target finding not produced');
  }
  const claims = entries.flatMap((e) => e.runs.filter((r) => r.grounded?.answer.exceptionClaim.claimed === true));
  const exceptionExpected = m.role === 'case' && m.expected.exceptionClaimed;
  const falseClaims = entries.reduce((n, e) => n + e.runs.filter((r) => r.grounded?.answer.exceptionClaim.claimed === true && !(exceptionExpected && e === t)).length, 0);
  const b = t === undefined ? undefined : baseline.get(t.findingId);
  return {
    case: m.case, pair: m.pair, role: m.role, targetFound: t !== undefined, correct, failures,
    clean: claims.length === 0,
    falseExceptionClaims: falseClaims,
    hallucinatedExceptions: entries.reduce((n, e) => n + e.runs.filter((r) => r.grounded?.hallucinatedException === true).length, 0),
    inconsistent: entries.reduce((n, e) => n + e.runs.filter((r) => r.grounded?.inconsistent === true).length, 0),
    baseline: {
      correct: b === undefined ? null : claimRight(m, b.claimed, b.citation),
      clean: entries.every((e) => baseline.get(e.findingId)?.claimed !== true),
    },
  };
}

export interface C4Aggregate {
  readonly casesCorrect: number;
  readonly cases: number;
  readonly twinsClean: number;
  readonly twins: number;
  readonly falseExceptionClaimsOnTwins: number;
  readonly hallucinatedExceptions: number;
  readonly inconsistent: number;
  readonly baselineCasesCorrect: number;
  readonly baselineTwinsClean: number;
}

export function aggregateC4(scores: readonly C4CaseScore[]): C4Aggregate {
  const cases = scores.filter((s) => s.role === 'case');
  const twins = scores.filter((s) => s.role === 'twin');
  return {
    casesCorrect: cases.filter((s) => s.correct === true).length, cases: cases.length,
    twinsClean: twins.filter((s) => s.clean).length, twins: twins.length,
    falseExceptionClaimsOnTwins: twins.reduce((n, s) => n + s.falseExceptionClaims, 0),
    hallucinatedExceptions: scores.reduce((n, s) => n + s.hallucinatedExceptions, 0),
    inconsistent: scores.reduce((n, s) => n + s.inconsistent, 0),
    baselineCasesCorrect: cases.filter((s) => s.baseline.correct === true).length,
    baselineTwinsClean: twins.filter((s) => s.baseline.clean).length,
  };
}
