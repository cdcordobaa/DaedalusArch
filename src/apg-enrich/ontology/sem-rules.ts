/**
 * The three C3 Sem rules over A1 + A2 (v1.4 U3, design §3.4; NS-02 §2). The Cypher text is the rule; it runs on the
 * in-process interpreter here (`MemoryGraphRepository`), and Neo4j would take the same text.
 *
 * - SEM-MISPLACED: a responsibility whose natural layer differs from the class's declared layer kind. Site: the Class.
 * - SEM-DUP: one business-rule cluster enforced in two contexts (a directory fallback counts as a context).
 *   Rows are pairs; one verdict per rule cluster, `verified` only when every pair is verified.
 * - SEM-FRAG (N4): two differently-named classes defining one concept inside one *declared* context. Rows are
 *   pairs; one verdict per (context, concept). Across contexts the rule is silent by construction.
 *
 * `$policy` is `agreed-only` (model facts used only when agreed) or `any`. It must equal the policy the run used
 * (`producer.factPolicy`, BR-U3-06). A rule with no row gives no verdict ("no row" = pass).
 */
import { DomainResult } from '../../shared/errors/domain-result.js';
import { hostIndependentCompare } from '../../shared/collation.js';
import type { GraphRepository } from '../../shared/interfaces/graph-repository.js';
import type { FactsFile } from './facts.js';
import type { FactPolicy } from './pipeline.js';

export const SEM_RULE_IDS = ['SEM-MISPLACED', 'SEM-DUP', 'SEM-FRAG'] as const;
export type SemRuleId = (typeof SEM_RULE_IDS)[number];

export const SEM_MISPLACED_CYPHER = `MATCH (c:Class)-[e:SemRESPONSIBLE_FOR]->(r:SemResponsibility)
WHERE c.layerKind IS NOT NULL AND r.naturalLayer <> c.layerKind
  AND ($policy = 'any' OR e.agreement = 'agreed')
RETURN c.id AS site, c.layerKind AS classLayer, r.naturalLayer AS naturalLayer, e.factId AS fact`;

export const SEM_DUP_CYPHER = `MATCH (c1:Class)-[:CONTAINS]->(m1:Method)-[e1:SemENFORCES]->(r:SemBusinessRule)<-[e2:SemENFORCES]-(m2:Method)<-[:CONTAINS]-(c2:Class)
WHERE m1.id < m2.id AND c1.context <> c2.context
  AND ($policy = 'any' OR (e1.agreement = 'agreed' AND e2.agreement = 'agreed'))
OPTIONAL MATCH (m1)-[v:SemRULE_VERIFIED]-(m2)
RETURN r.id AS rule, m1.id AS siteA, m2.id AS siteB, coalesce(v.verified, false) AS verified, e1.factId AS factA, e2.factId AS factB`;

export const SEM_FRAG_CYPHER = `MATCH (a:Class)-[ea:SemEMBODIES {relation: 'defines'}]->(k:SemBusinessConcept)<-[eb:SemEMBODIES {relation: 'defines'}]-(b:Class)
WHERE a.id < b.id AND a.name <> b.name
  AND a.contextDeclared = true AND b.contextDeclared = true AND a.context = b.context
  AND ($policy = 'any' OR (ea.agreement = 'agreed' AND eb.agreement = 'agreed'))
RETURN a.context AS context, k.name AS concept, a.id AS classA, b.id AS classB, ea.factId AS factA, eb.factId AS factB`;

export const SEM_RULES: Readonly<Record<SemRuleId, string>> = Object.freeze({
  'SEM-MISPLACED': SEM_MISPLACED_CYPHER,
  'SEM-DUP': SEM_DUP_CYPHER,
  'SEM-FRAG': SEM_FRAG_CYPHER,
});

/** One rule verdict (A4-like, not A4: `schemas/report.schema.json` is out of U3). */
export interface SemVerdict {
  readonly rule: SemRuleId;
  readonly verdict: 'fail';
  /** APG ids: the Class (SEM-MISPLACED, SEM-FRAG) or the Methods (SEM-DUP). */
  readonly sites: readonly string[];
  /** SEM-FRAG: the declared context; otherwise null. */
  readonly context: string | null;
  /** SEM-DUP only: every pair of the cluster verified by the deterministic checks. */
  readonly verified?: boolean;
  readonly facts: readonly string[];
  readonly policy: FactPolicy;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : String(v));
const sorted = (xs: Iterable<string>): string[] => [...new Set(xs)].sort(hostIndependentCompare);

/** Runs the three rules. Fails when `policy` differs from the policy the A2 run used (BR-U3-06). */
export async function runSemRules(repo: GraphRepository, facts: FactsFile, policy: FactPolicy): Promise<DomainResult<SemVerdict[]>> {
  if (policy !== facts.producer.factPolicy) {
    return DomainResult.fail([{
      code: 'SEM_POLICY_MISMATCH',
      message: `fact policy ${policy} differs from the run's ${facts.producer.factPolicy}: the policy is run-level (it changes the pass (b) prompts and the pass (d) pairs), so rerun with --fact-policy ${policy}`,
    }]);
  }
  const params = { policy };
  const run = async (id: SemRuleId): Promise<DomainResult<readonly Record<string, unknown>[]>> => {
    const r = await repo.executeQuery(SEM_RULES[id], params);
    return r.success ? DomainResult.ok(r.data.records) : DomainResult.fail(r.errors);
  };
  const out: SemVerdict[] = [];

  const mis = await run('SEM-MISPLACED');
  if (!mis.success) return DomainResult.fail(mis.errors);
  for (const row of mis.data) out.push({ rule: 'SEM-MISPLACED', verdict: 'fail', sites: [str(row.site)], context: null, facts: [str(row.fact)], policy });

  const dup = await run('SEM-DUP');
  if (!dup.success) return DomainResult.fail(dup.errors);
  const byRule = new Map<string, { sites: string[]; facts: string[]; verified: boolean }>();
  for (const row of dup.data) {
    const g = byRule.get(str(row.rule)) ?? { sites: [], facts: [], verified: true };
    g.sites.push(str(row.siteA), str(row.siteB));
    g.facts.push(str(row.factA), str(row.factB));
    g.verified = g.verified && row.verified === true;
    byRule.set(str(row.rule), g);
  }
  for (const g of byRule.values()) out.push({ rule: 'SEM-DUP', verdict: 'fail', sites: sorted(g.sites), context: null, verified: g.verified, facts: sorted(g.facts), policy });

  const frag = await run('SEM-FRAG');
  if (!frag.success) return DomainResult.fail(frag.errors);
  const byConcept = new Map<string, { context: string; sites: string[]; facts: string[] }>();
  for (const row of frag.data) {
    const key = `${str(row.context)}|${str(row.concept)}`;
    const g = byConcept.get(key) ?? { context: str(row.context), sites: [], facts: [] };
    g.sites.push(str(row.classA), str(row.classB));
    g.facts.push(str(row.factA), str(row.factB));
    byConcept.set(key, g);
  }
  for (const g of byConcept.values()) out.push({ rule: 'SEM-FRAG', verdict: 'fail', sites: sorted(g.sites), context: g.context, facts: sorted(g.facts), policy });

  return DomainResult.ok(out.sort((a, b) => hostIndependentCompare(`${a.rule}|${a.sites.join(',')}|${a.facts.join(',')}`, `${b.rule}|${b.sites.join(',')}|${b.facts.join(',')}`)));
}
