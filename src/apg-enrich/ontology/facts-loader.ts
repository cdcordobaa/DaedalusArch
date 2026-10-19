/**
 * A1 + A2 into a `GraphRepository` (v1.4 U3, design §3.4). The Sem rules then read the facts through the query layer
 * (C1c), never through prompts (N1, M4).
 *
 * - A1 goes in through the ingestion's own statements (`annotateNodes`, `ingestNodes`, `ingestEdges`), unchanged.
 *   Class nodes get three extra properties from the A2 parser facts (`layerKind`, `context`, `contextDeclared`),
 *   added to a copy of each node's properties: the APG object is never mutated.
 * - Sem nodes and edges go in through `nodeIngestCypher` / `edgeIngestCypher`, the shapes the in-process interpreter
 *   recognises and Neo4j accepts. Edge properties are scalars only (`factId`, `source`, `agreement`, `confidence`,
 *   `relation`, `same`, `verified`, `method`); evidence stays in A2.
 * - Only `kind: business` rules get a `SemBusinessRule` node and `SemENFORCES` edges (BR-U3-18).
 * - `SemRULE_VERIFIED` is written once per pair, from the lower method id to the higher.
 *
 * Neo4j would take the same statements; U3 never starts it.
 */
import { edgeIngestCypher, ingestEdges, ingestNodes, nodeIngestCypher } from '../../neo4j-ingestion/graph-ingester.js';
import { annotateNodes } from '../../neo4j-ingestion/layer-annotator.js';
import type { LayerAnnotation } from '../../neo4j-ingestion/types.js';
import { DomainResult } from '../../shared/errors/domain-result.js';
import type { GraphRepository } from '../../shared/interfaces/graph-repository.js';
import type { APGNode, APGResult } from '../../shared/types/apg.js';
import type { LayerModel } from '../../shared/types/spec.js';
import type { Fact, FactValues, FactsFile } from './facts.js';

/** The Sem labels and relationship types the loader writes. */
export const LOADED_SEM_LABELS = ['SemResponsibility', 'SemBusinessRule', 'SemBusinessConcept', 'SemCapability'] as const;
export const LOADED_SEM_EDGES = [
  'SemRESPONSIBLE_FOR', 'SemENFORCES', 'SemEMBODIES', 'SemREALIZES', 'SemSAME_RULE_AS', 'SemSAME_CONCEPT_AS', 'SemRULE_VERIFIED',
] as const;
type SemLabel = (typeof LOADED_SEM_LABELS)[number];
type SemEdgeName = (typeof LOADED_SEM_EDGES)[number];

export interface LoadSummary {
  readonly apgNodes: number;
  readonly apgEdges: number;
  readonly semNodes: number;
  readonly semEdges: number;
}

type Scalar = string | number | boolean | null;

function value<P extends keyof FactValues>(f: Fact, _p: P): FactValues[P] {
  return f.value as FactValues[P];
}

/** The A1 Class nodes, copied, with the A2 parser facts as properties. */
function classNodesWithFacts(apg: APGResult, facts: readonly Fact[]): APGNode[] {
  const layerOf = new Map<string, string>();
  const ctxOf = new Map<string, { context: string; declared: boolean }>();
  for (const f of facts) {
    if (f.source !== 'parser') continue;
    if (f.predicate === 'inLayer') layerOf.set(f.subject, value(f, 'inLayer'));
    if (f.predicate === 'inContext') ctxOf.set(f.subject, value(f, 'inContext'));
  }
  return apg.nodes.map((n) => {
    if (n.type !== 'Class') return n;
    const ctx = ctxOf.get(n.id);
    const extra: Record<string, unknown> = {
      ...(layerOf.has(n.id) ? { layerKind: layerOf.get(n.id) } : {}),
      ...(ctx !== undefined ? { context: ctx.context, contextDeclared: ctx.declared } : {}),
    };
    return Object.keys(extra).length === 0 ? n : { ...n, properties: { ...n.properties, ...extra } };
  });
}

function edgeProps(f: Fact, extra: Record<string, Scalar> = {}): Record<string, Scalar> {
  return { factId: f.id, source: f.source, agreement: f.agreement, confidence: f.confidence, ...extra };
}

/** Loads A1 and A2 into `repo` (a fresh repository: the loader does not wipe it). */
export async function loadFacts(apg: APGResult, layerModel: LayerModel | undefined, facts: FactsFile, repo: GraphRepository): Promise<DomainResult<LoadSummary>> {
  const annotations: ReadonlyMap<string, LayerAnnotation> = layerModel === undefined ? new Map() : annotateNodes(apg.nodes, layerModel).annotations;
  const nodes = await ingestNodes(classNodesWithFacts(apg, facts.facts), annotations, repo);
  if (!nodes.success) return DomainResult.fail(nodes.errors);
  const edges = await ingestEdges(apg.edges, repo);
  if (!edges.success) return DomainResult.fail(edges.errors);

  const semNodes = new Map<SemLabel, Map<string, Record<string, Scalar>>>(LOADED_SEM_LABELS.map((l) => [l, new Map()]));
  const semEdges = new Map<SemEdgeName, { sourceId: string; targetId: string; props: Record<string, Scalar> }[]>(LOADED_SEM_EDGES.map((t) => [t, []]));
  const node = (label: SemLabel, id: string, props: Record<string, Scalar>): string => {
    const m = semNodes.get(label);
    if (m !== undefined && !m.has(id)) m.set(id, { id, type: label, ...props });
    return id;
  };
  const edge = (type: SemEdgeName, sourceId: string, targetId: string, props: Record<string, Scalar>): void => {
    semEdges.get(type)?.push({ sourceId, targetId, props });
  };

  for (const f of facts.facts) {
    switch (f.predicate) {
      case 'hasResponsibility': {
        const v = value(f, 'hasResponsibility');
        const id = node('SemResponsibility', `sem:resp:${f.id}`, { name: v.name, description: v.description, naturalLayer: v.naturalLayer });
        edge('SemRESPONSIBLE_FOR', f.subject, id, edgeProps(f));
        break;
      }
      case 'embodiesConcept': {
        const v = value(f, 'embodiesConcept');
        const id = node('SemBusinessConcept', v.conceptId ?? `sem:concept:${f.id}`, { name: v.concept });
        edge('SemEMBODIES', f.subject, id, edgeProps(f, { relation: v.relation }));
        break;
      }
      case 'enforcesRule': {
        const v = value(f, 'enforcesRule');
        if (v.kind !== 'business') break; // input checks stay A2 facts only (BR-U3-18)
        const id = node('SemBusinessRule', v.ruleId ?? `sem:rule:${f.id}`, { name: v.statement, subject: v.subject, operator: v.operator, threshold: v.threshold, unit: v.unit });
        edge('SemENFORCES', f.subject, id, edgeProps(f));
        break;
      }
      case 'realizesCapability': {
        const v = value(f, 'realizesCapability');
        const id = node('SemCapability', v.capabilityId ?? `sem:cap:${f.id}`, { name: v.capability });
        edge('SemREALIZES', f.subject, id, edgeProps(f));
        break;
      }
      case 'sameConceptAs':
        edge('SemSAME_CONCEPT_AS', f.subject, value(f, 'sameConceptAs').other, edgeProps(f, { same: value(f, 'sameConceptAs').same }));
        break;
      case 'sameRuleAs':
        edge('SemSAME_RULE_AS', f.subject, value(f, 'sameRuleAs').other, edgeProps(f, { same: value(f, 'sameRuleAs').same }));
        break;
      case 'ruleEquivalenceVerified': {
        const v = value(f, 'ruleEquivalenceVerified');
        const [lo, hi] = f.subject < v.other ? [f.subject, v.other] : [v.other, f.subject];
        edge('SemRULE_VERIFIED', lo, hi, edgeProps(f, { verified: v.verified, method: v.method }));
        break;
      }
      default:
        break; // inLayer, inContext, logicDensity: Class / Method properties or A2 only
    }
  }

  let nSem = 0;
  for (const [label, m] of semNodes) {
    if (m.size === 0) continue;
    const r = await repo.executeQuery(nodeIngestCypher(label), { batch: [...m.values()] });
    if (!r.success) return DomainResult.fail(r.errors);
    nSem += m.size;
  }
  let nSemEdges = 0;
  for (const [type, list] of semEdges) {
    // Once per pair: a second fact on the same verified pair (both orientations) is not written twice.
    const unique = type === 'SemRULE_VERIFIED' ? [...new Map(list.map((e) => [`${e.sourceId}|${e.targetId}`, e])).values()] : list;
    if (unique.length === 0) continue;
    const r = await repo.executeQuery(edgeIngestCypher(type), { batch: unique });
    if (!r.success) return DomainResult.fail(r.errors);
    nSemEdges += unique.length;
  }
  return DomainResult.ok({ apgNodes: nodes.data, apgEdges: edges.data, semNodes: nSem, semEdges: nSemEdges });
}
