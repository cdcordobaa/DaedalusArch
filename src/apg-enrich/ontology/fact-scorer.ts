/**
 * Fact and verdict scoring against a manifest's `ns02` block (v1.4 U3, D7; NS-02 §3).
 *
 * - Subjects are APG names, `Class` or `Class.method`, resolved to A1 ids; a missing or ambiguous name is an error.
 * - A fact matches when subject and predicate match, the source matches when the manifest names one, and its value
 *   holds every key the manifest lists (a subset match; strings compare case-insensitively, `other` is an APG name).
 *   An `inContext` value written as a string matches the fact's `context`.
 * - Under `agreed-only` a model fact counts only when agreed; parser facts always count.
 * - Polarity: `required` → hit / missed; `forbidden` → false-fact / clear; `tolerated` → observed / absent.
 * - Verdicts: no row means `pass`. SEM-MISPLACED sites are compared at the owning class (`Class.method` → `Class`).
 */
import type { APGResult } from '../../shared/types/apg.js';
import type { Fact, FactsFile } from './facts.js';
import type { FactPolicy } from './pipeline.js';
import type { SemRuleId, SemVerdict } from './sem-rules.js';

export interface ExpectedFact {
  readonly subject: string;
  readonly predicate: string;
  readonly value?: unknown;
  readonly source?: 'parser' | 'model';
  readonly polarity: 'required' | 'forbidden' | 'tolerated';
  readonly note?: string;
}

export interface ExpectedVerdict {
  readonly rule: SemRuleId;
  readonly verdict: 'fail' | 'pass';
  readonly sites?: readonly string[];
  /** SEM-DUP only: when given, a `fail` is found only with this `verified` value. */
  readonly verified?: boolean;
}

/** The manifests' `ns02` block (and the parent-case sidecar blocks). Other keys are descriptive. */
export interface Ns02Block {
  readonly expectedFacts: readonly ExpectedFact[];
  readonly expectedVerdicts: readonly ExpectedVerdict[];
  readonly [key: string]: unknown;
}

export class FactScoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FactScoreError';
  }
}

/** `Class` or `Class.method` → the A1 node id. */
export function resolveSubject(name: string, apg: APGResult): string {
  const type = name.includes('.') ? 'Method' : 'Class';
  const hits = apg.nodes.filter((n) => n.type === type && n.name === name);
  if (hits.length === 0) throw new FactScoreError(`no ${type} named ${name} in A1`);
  if (hits.length > 1) throw new FactScoreError(`${type} name ${name} is ambiguous in A1 (${String(hits.length)} nodes)`);
  return hits[0]?.id ?? '';
}

function scalarMatches(actual: unknown, expected: unknown): boolean {
  if (typeof expected === 'string' && typeof actual === 'string') return actual.trim().toLowerCase() === expected.trim().toLowerCase();
  return actual === expected;
}

function valueMatches(f: Fact, expected: unknown, apg: APGResult): boolean {
  if (expected === undefined) return true;
  const actual = f.value as unknown;
  if (typeof expected !== 'object' || expected === null) {
    if (f.predicate === 'inContext' && typeof actual === 'object' && actual !== null) return scalarMatches((actual as { context?: unknown }).context, expected);
    return scalarMatches(actual, expected);
  }
  if (typeof actual !== 'object' || actual === null) return false;
  const a = actual as Record<string, unknown>;
  return Object.entries(expected as Record<string, unknown>).every(([k, v]) => (k === 'other' && typeof v === 'string' ? a.other === resolveSubject(v, apg) : scalarMatches(a[k], v)));
}

export interface FactItemScore {
  readonly subject: string;
  readonly predicate: string;
  readonly polarity: ExpectedFact['polarity'];
  readonly outcome: 'hit' | 'missed' | 'false-fact' | 'clear' | 'observed' | 'absent';
  readonly facts: readonly string[];
}

export interface FactScores {
  readonly policy: FactPolicy;
  readonly items: readonly FactItemScore[];
  readonly required: number;
  readonly hit: number;
  readonly forbidden: number;
  readonly falseFacts: number;
}

/** Pair predicates: the subject is the lower id of the pair, so a manifest may name the pair in either order. */
const SYMMETRIC: ReadonlySet<string> = new Set(['sameConceptAs', 'sameRuleAs', 'ruleEquivalenceVerified']);

function swapped(f: Fact): Fact {
  const v = f.value as { readonly other: string };
  return { ...f, subject: v.other, value: { ...v, other: f.subject } as Fact['value'] };
}

export function scoreFacts(ns02: Ns02Block, facts: FactsFile, apg: APGResult, policy: FactPolicy): FactScores {
  const items = ns02.expectedFacts.map((e): FactItemScore => {
    const id = resolveSubject(e.subject, apg);
    const matched = facts.facts.filter((f) => f.predicate === e.predicate
      && (e.source === undefined || f.source === e.source)
      && (policy === 'any' || f.source === 'parser' || f.agreement === 'agreed')
      && [f, ...(SYMMETRIC.has(f.predicate) ? [swapped(f)] : [])].some((g) => g.subject === id && valueMatches(g, e.value, apg)));
    const seen = matched.length > 0;
    const outcome = e.polarity === 'required' ? (seen ? 'hit' : 'missed') : e.polarity === 'forbidden' ? (seen ? 'false-fact' : 'clear') : seen ? 'observed' : 'absent';
    return { subject: e.subject, predicate: e.predicate, polarity: e.polarity, outcome, facts: matched.map((f) => f.id) };
  });
  return {
    policy, items,
    required: items.filter((i) => i.polarity === 'required').length,
    hit: items.filter((i) => i.outcome === 'hit').length,
    forbidden: items.filter((i) => i.polarity === 'forbidden').length,
    falseFacts: items.filter((i) => i.outcome === 'false-fact').length,
  };
}

export interface VerdictItemScore {
  readonly rule: SemRuleId;
  readonly expected: 'fail' | 'pass';
  readonly outcome: 'found' | 'missed' | 'clear' | 'false-verdict';
  readonly sites: readonly string[];
}

export function scoreVerdicts(ns02: Ns02Block, verdicts: readonly SemVerdict[], apg: APGResult): readonly VerdictItemScore[] {
  return ns02.expectedVerdicts.map((e): VerdictItemScore => {
    const names = (e.sites ?? []).map((s) => (e.rule === 'SEM-MISPLACED' && s.includes('.') ? s.slice(0, s.indexOf('.')) : s));
    const ids = names.map((s) => resolveSubject(s, apg));
    const rows = verdicts.filter((v) => v.rule === e.rule && ids.every((id) => v.sites.includes(id))
      && (e.verdict === 'pass' || e.verified === undefined || v.verified === e.verified));
    const seen = rows.length > 0;
    const outcome = e.verdict === 'fail' ? (seen ? 'found' : 'missed') : seen ? 'false-verdict' : 'clear';
    return { rule: e.rule, expected: e.verdict, outcome, sites: e.sites ?? [] };
  });
}
