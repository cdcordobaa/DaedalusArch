/**
 * C4 inputs (v1.4 U9; `ops/notes/c4-01-interpretation-design.md` §3 gap 1, §4.1): one shape for every blocking
 * finding C4 reads, whether a symbolic rule produced it (an A4 report row: FF-S03, FF-DT04, FF-DS02, FF-S04, ...) or a
 * Sem rule over A1 + A2 (SEM-MISPLACED, SEM-DUP, SEM-FRAG). C4 is not blind to the rule: the rule id is given.
 *
 * The C3 verdict is copied into `c3Verdict` and never computed here (N1). Only blocking findings are accepted: an
 * advisory row is not C4's input (`blockingFindings` drops it; `fromViolation` refuses it).
 *
 * Pure and deterministic: no I/O, no clock.
 */
import { canonicalJSON, sha256Hex } from '../../llm-critic/canonical-json.js';
import { hostIndependentCompare } from '../../shared/collation.js';
import type { Violation } from '../../shared/taxonomy/violation-types.js';
import type { APGResult } from '../../shared/types/apg.js';
import type { EvaluationReport } from '../../shared/types/evaluation.js';
import type { FactPolicy } from './pipeline.js';
import type { SemVerdict } from './sem-rules.js';
import { SEM_RULE_IDS } from './sem-rules.js';

/** The C3 verdict a finding carries, copied unchanged into every C4 output (C4-01 §4.3). */
export interface C3Verdict {
  readonly rule: string;
  readonly tier: 'blocking';
  readonly verdict: 'fail';
}

export interface C4Finding {
  /** `c4f:<sha256[0..16]>` of the rule, the files, the edge and the sites: stable across runs and machines. */
  readonly id: string;
  readonly rule: string;
  readonly origin: 'symbolic' | 'sem';
  readonly tier: 'blocking';
  readonly message: string;
  /** APG ids the finding is about: the classes of the source file (symbolic), or the Sem rule's sites. */
  readonly sites: readonly string[];
  /** Project-relative files, the source file first. */
  readonly files: readonly string[];
  /** A symbolic import edge (file, line, target); null for a SEM verdict or a row with no edge. */
  readonly edge: { readonly file: string; readonly line: number | null; readonly target: string | null } | null;
  /** SEM-FRAG's declared context; otherwise null. */
  readonly context: string | null;
  /** A2 fact ids the finding cites (SEM verdicts); empty for a symbolic row. */
  readonly facts: readonly string[];
  /** SEM verdict details, when `origin` is `sem`. */
  readonly sem: { readonly verified: boolean | null; readonly policy: FactPolicy } | null;
}

const SEM_TEXT: Readonly<Record<SemVerdict['rule'], string>> = {
  'SEM-MISPLACED': 'a responsibility sits in a layer other than the one it naturally belongs to',
  'SEM-DUP': 'one business rule is enforced in more than one bounded context',
  'SEM-FRAG': 'one business concept is defined by differently-named classes inside one declared bounded context',
};

export function c3VerdictOf(f: C4Finding): C3Verdict {
  return { rule: f.rule, tier: 'blocking', verdict: 'fail' };
}

function idOf(parts: Omit<C4Finding, 'id' | 'message' | 'origin' | 'tier' | 'sem'>): string {
  return `c4f:${sha256Hex(canonicalJSON({ rule: parts.rule, files: parts.files, edge: parts.edge, sites: parts.sites, context: parts.context })).slice(0, 16)}`;
}

/** True when `x` is a Sem rule verdict (the U3 shape). */
export function isSemVerdict(x: unknown): x is SemVerdict {
  return typeof x === 'object' && x !== null && (SEM_RULE_IDS as readonly string[]).includes((x as { rule?: unknown }).rule as string)
    && (x as { verdict?: unknown }).verdict === 'fail' && Array.isArray((x as { sites?: unknown }).sites);
}

/** A Sem verdict as a C4 finding. A Sem verdict is always a failing, blocking finding (no row = pass). */
export function fromSemVerdict(v: SemVerdict, apg: APGResult | null = null): C4Finding {
  const byId = new Map((apg?.nodes ?? []).map((n) => [n.id, n]));
  const files = [...new Set(v.sites.flatMap((s) => { const n = byId.get(s); return n === undefined ? [] : [n.filePath]; }))].sort(hostIndependentCompare);
  const base = { rule: v.rule, sites: [...v.sites], files, edge: null, context: v.context, facts: [...v.facts] };
  return {
    id: idOf(base), origin: 'sem', tier: 'blocking', message: `${v.rule}: ${SEM_TEXT[v.rule]}`, ...base,
    sem: { verified: v.verified ?? null, policy: v.policy },
  };
}

const SITE_TYPES: ReadonlySet<string> = new Set(['Class', 'Interface']);

/** The class and interface nodes declared in `file`, sorted by id. */
function classesIn(apg: APGResult, file: string): string[] {
  return apg.nodes.filter((n) => SITE_TYPES.has(n.type) && n.filePath === file).map((n) => n.id).sort(hostIndependentCompare);
}

/**
 * A symbolic A4 row as a C4 finding. `tier` is the row's tier from the report (`tierOf`); an advisory row is refused
 * (null), because C4 reads blocking findings only (C4-01 §1).
 */
export function fromViolation(v: Violation, tier: 'blocking' | 'advisory', apg: APGResult): C4Finding | null {
  if (tier !== 'blocking') return null;
  const target = v.target ?? null;
  const targetIsFile = target !== null && apg.nodes.some((n) => n.type === 'File' && n.filePath === target);
  const files = [v.filePath, ...(targetIsFile && target !== v.filePath ? [target] : [])];
  const base = {
    rule: String(v.functionId), sites: classesIn(apg, v.filePath), files,
    edge: target !== null || v.line !== undefined ? { file: v.filePath, line: v.line ?? null, target } : null,
    context: null, facts: [],
  };
  return { id: idOf(base), origin: 'symbolic', tier: 'blocking', message: v.message, ...base, sem: null };
}

/** The tier of a rule in a v1.3 report (`tiers.blocking.rules`); `advisory` when the report has no tier table. */
export function tierOf(report: Pick<EvaluationReport, 'tiers'>, rule: string): 'blocking' | 'advisory' {
  return report.tiers?.blocking.rules.some((r) => String(r.functionId) === rule) === true ? 'blocking' : 'advisory';
}

/**
 * Every blocking finding C4 reads (C4-01 §4.1): the report's blocking rows plus every Sem verdict, sorted by rule then
 * id. Rows with no project file (`<project>`) are kept: their site list is empty.
 */
export function blockingFindings(report: Pick<EvaluationReport, 'tiers' | 'violations'>, apg: APGResult, sem: readonly SemVerdict[] = []): C4Finding[] {
  const out = new Map<string, C4Finding>();
  for (const v of report.violations) {
    const f = fromViolation(v, tierOf(report, String(v.functionId)), apg);
    if (f !== null) out.set(f.id, f);
  }
  for (const v of sem) {
    const f = fromSemVerdict(v, apg);
    out.set(f.id, f);
  }
  return [...out.values()].sort((a, b) => hostIndependentCompare(a.rule, b.rule) || hostIndependentCompare(a.id, b.id));
}
