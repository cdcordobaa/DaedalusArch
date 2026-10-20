/**
 * Stage C per-rule exposure (Docs/v1.4/exposure-definitions.md; registered 2026-10-20 in
 * Docs/v1.4/exploratory-study-registration.md). Shared by `scripts/v1.4/exposure-count.ts` and its unit test.
 *
 * Each opportunity query is the rule's own compiled Cypher with its violation predicate deleted (an exact text match
 * that must occur once), so no rule is restated here: the edge views, layer properties and parameters the compiler
 * wrote stay in the text. The cycle rule's predicate is its closed variable-length path; deleting it leaves its single
 * step, built from the relationship types and the edge-view predicate read from the compiled text.
 *
 * Counts on one graph (`GraphRepository`, the evaluated graph the scorer used): the opportunity rows, the rule's own
 * rows, and a row check that every violation row is an opportunity row. Zero opportunities = `not-exercised`.
 */
import { ruleTier } from '../../../src/scoring-engine/rule-tiers.js';
import type { GraphRepository } from '../../../src/shared/interfaces/graph-repository.js';

export interface RuleQuery {
  readonly functionId: string;
  /** The template name (presets name each function by its template). */
  readonly name: string;
  readonly cypher: string;
  readonly params: Readonly<Record<string, unknown>>;
}

export type OpportunityUnit = 'cross-layer-import-edge' | 'restricted-layer-package-import' | 'module-dependency-edge';

export interface OpportunityQuery {
  readonly ruleId: string;
  readonly template: string;
  readonly unit: OpportunityUnit;
  readonly cypher: string;
  readonly params: Readonly<Record<string, unknown>>;
  /** `edge`: a violation row is the opportunity row with the same (source, target, relType); `cycle`: every edge of the cycle is one. */
  readonly rowCheck: 'edge' | 'cycle';
}

export class ExposureDerivationError extends Error {}

/** Deletes `re` from `cypher`; it must match exactly once (else the compiled text has drifted from the definition). */
export function deletePredicate(cypher: string, re: RegExp, label: string): string {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  const n = [...cypher.matchAll(g)].length;
  if (n !== 1) throw new ExposureDerivationError(`${label}: violation predicate found ${String(n)} times in the compiled text (expected 1)`);
  return cypher.replace(g, '');
}

const S01_PREDICATE = / AND srcIdx < tgtIdx/;
const S03_PREDICATE = /\s+AND NOT \(src\.layer \+ '>' \+ tgt\.layer\) IN \$allowedTransitions/;
const P01_PREDICATE = /\n[ \t]*AND ANY\(fp IN \$forbiddenImports WHERE [^\n]*/;
const S02_PATH = /MATCH p = \(f:File\)-\[(\w+):([A-Z_|]+)\*\d+\.\.\d+\]->\(f\)/;

/** The single-edge step of the cycle rule: its relationship types and edge-view predicate, one row per edge. */
function cycleStep(cypher: string, ruleId: string): string {
  const m = S02_PATH.exec(cypher);
  if (m === null) throw new ExposureDerivationError(`${ruleId}: no closed variable-length path in the compiled text`);
  const [, relVar = '', types = ''] = m;
  const view = new RegExp(`ALL\\((\\w+) IN ${relVar} WHERE (.*?)\\) AND `).exec(cypher);
  let pred = 'f <> g';
  if (view !== null) {
    const [, elem = '', body = ''] = view;
    pred = `(${body.replace(new RegExp(`\\b${elem}\\b`, 'g'), 'r')}) AND f <> g`;
  }
  return `MATCH (f:File)-[r:${types}]->(g:File)\nWHERE ${pred}\nRETURN f.filePath AS source, g.filePath AS target, type(r) AS relType\nORDER BY source, target, relType`;
}

/** The opportunity query of a compiled rule, or null for a template with no definition (counts only). */
export function opportunityQuery(q: RuleQuery): OpportunityQuery | null {
  const base = { ruleId: q.functionId, template: q.name, params: q.params };
  switch (q.name) {
    case 'dependency-direction':
      return { ...base, unit: 'cross-layer-import-edge', rowCheck: 'edge', cypher: deletePredicate(q.cypher, S01_PREDICATE, q.functionId) };
    case 'no-layer-skip':
      return { ...base, unit: 'cross-layer-import-edge', rowCheck: 'edge', cypher: deletePredicate(q.cypher, S03_PREDICATE, q.functionId) };
    case 'domain-purity':
      return { ...base, unit: 'restricted-layer-package-import', rowCheck: 'edge', cypher: deletePredicate(q.cypher, P01_PREDICATE, q.functionId) };
    case 'no-cyclic-deps':
      return { ...base, unit: 'module-dependency-edge', rowCheck: 'cycle', cypher: cycleStep(q.cypher, q.functionId) };
    default:
      return null;
  }
}

/** The blocking rules of a style among the compiled queries and the disabled functions, by the v1.3 tiers. */
export function blockingRules(
  compiled: readonly RuleQuery[],
  disabled: readonly { readonly id: string; readonly reason: string }[],
  style: string,
): { compiled: RuleQuery[]; notCompiled: { ruleId: string; reason: string }[] } {
  const isBlocking = (id: string): boolean => ruleTier(id, style).tier === 'blocking';
  return {
    compiled: compiled.filter((q) => isBlocking(q.functionId)).sort((a, b) => (a.functionId < b.functionId ? -1 : 1)),
    notCompiled: disabled.filter((d) => isBlocking(d.id)).map((d) => ({ ruleId: d.id, reason: d.reason })).sort((a, b) => (a.ruleId < b.ruleId ? -1 : 1)),
  };
}

export interface RuleExposure {
  readonly ruleId: string;
  readonly template: string;
  readonly unit: OpportunityUnit | null;
  readonly status: 'exercised' | 'not-exercised' | 'no-definition';
  readonly opportunities: number | null;
  /** The scorer's counted blocking violations of the rule (`report.tiers.blocking.rules`). */
  readonly violations: number;
  /** Rows of the rule's own compiled query on the same graph. */
  readonly violationRows: number;
  /** Violation rows that are not opportunity rows (must be 0). */
  readonly rowsOutsideOpportunities: number | null;
  /** violations / opportunities; null when not exercised. Cycle rule: cycles per dependency edge. */
  readonly violationsPerOpportunity: number | null;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : JSON.stringify(v));
const edgeKey = (r: Record<string, unknown>): string => `${str(r.source)}\u0000${str(r.target)}\u0000${str(r.relType)}`;
const pairKey = (a: unknown, b: unknown): string => `${str(a)}\u0000${str(b)}`;

async function rows(repo: GraphRepository, cypher: string, params: Readonly<Record<string, unknown>>, label: string): Promise<Record<string, unknown>[]> {
  const r = await repo.executeQuery(cypher, { ...params });
  if (!r.success) throw new Error(`${label}: ${r.errors.map((e) => e.message).join('; ')}`);
  return [...r.data.records];
}

/** Violation rows outside the opportunity rows (edge rules: by (source, target, relType); cycle rule: by edge). */
export function outsideOpportunities(o: OpportunityQuery, violationRows: readonly Record<string, unknown>[], opportunityRows: readonly Record<string, unknown>[]): number {
  if (o.rowCheck === 'edge') {
    const keys = new Set(opportunityRows.map(edgeKey));
    return violationRows.filter((v) => !keys.has(edgeKey(v))).length;
  }
  const pairs = new Set(opportunityRows.map((r) => pairKey(r.source, r.target)));
  return violationRows.filter((v) => {
    const cycle = Array.isArray(v.cycle) ? (v.cycle as unknown[]) : [];
    if (cycle.length < 2) return true;
    for (let i = 0; i + 1 < cycle.length; i += 1) if (!pairs.has(pairKey(cycle[i], cycle[i + 1]))) return true;
    return false;
  }).length;
}

/** One rule's exposure on one graph. `violations` is the scorer's count for the rule. */
export async function ruleExposure(repo: GraphRepository, q: RuleQuery, violations: number): Promise<RuleExposure> {
  const own = await rows(repo, q.cypher, q.params, `${q.functionId} rule`);
  const o = opportunityQuery(q);
  if (o === null) {
    return { ruleId: q.functionId, template: q.name, unit: null, status: 'no-definition', opportunities: null, violations, violationRows: own.length, rowsOutsideOpportunities: null, violationsPerOpportunity: null };
  }
  const opp = await rows(repo, o.cypher, o.params, `${q.functionId} opportunity`);
  const n = opp.length;
  return {
    ruleId: q.functionId,
    template: q.name,
    unit: o.unit,
    status: n === 0 ? 'not-exercised' : 'exercised',
    opportunities: n,
    violations,
    violationRows: own.length,
    rowsOutsideOpportunities: outsideOpportunities(o, own, opp),
    violationsPerOpportunity: n === 0 ? null : violations / n,
  };
}

export interface ExposureAggregate {
  readonly group: string;
  readonly ruleId: string;
  readonly snapshots: number;
  readonly exercised: number;
  readonly notExercised: number;
  readonly opportunities: number;
  readonly violations: number;
  /** Pooled: sum of violations / sum of opportunities over the exercised snapshots; null when none is exercised. */
  readonly violationsPerOpportunity: number | null;
}

/** Per group and rule, over snapshot rows; `no-definition` rows count snapshots and violations only. */
export function aggregate(rows_: readonly { readonly group: string; readonly rule: RuleExposure }[]): ExposureAggregate[] {
  const m = new Map<string, { group: string; ruleId: string; snapshots: number; exercised: number; notExercised: number; opportunities: number; violations: number; exercisedViolations: number }>();
  for (const { group, rule } of rows_) {
    const k = `${group}\u0000${rule.ruleId}`;
    const e = m.get(k) ?? { group, ruleId: rule.ruleId, snapshots: 0, exercised: 0, notExercised: 0, opportunities: 0, violations: 0, exercisedViolations: 0 };
    e.snapshots += 1;
    e.violations += rule.violations;
    if (rule.status === 'exercised') {
      e.exercised += 1;
      e.opportunities += rule.opportunities ?? 0;
      e.exercisedViolations += rule.violations;
    } else if (rule.status === 'not-exercised') {
      e.notExercised += 1;
    }
    m.set(k, e);
  }
  return [...m.values()]
    .sort((a, b) => (a.group === b.group ? (a.ruleId < b.ruleId ? -1 : 1) : a.group < b.group ? -1 : 1))
    .map(({ exercisedViolations, ...e }) => ({ ...e, violationsPerOpportunity: e.opportunities === 0 ? null : exercisedViolations / e.opportunities }));
}
