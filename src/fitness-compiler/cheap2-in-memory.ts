/**
 * In-memory mirrors of the batch-2 cheap-proxy templates (`cheap2-templates.ts`): pure predicates over the APG (with
 * the ingestion's layer annotation, `memGraph`) and the cheap facts (`CheapEnrichment`, or the edges and node facts of
 * a `ProvenanceResult`) that return the rows the Cypher returns, as the persistence convention of the template
 * catalogue lays the facts out. Exclude paths are not applied.
 */
import type { CheapEdge, CheapNodeFact, CheapVirtualNode } from '../apg-enrich/cheap/types.js';
import type { MemGraph, Row } from './apg2-in-memory.js';
import type { Apg2Params } from './apg2-in-memory.js';

export interface CheapFacts {
  readonly edges: readonly CheapEdge[];
  readonly nodeFacts: readonly CheapNodeFact[];
  readonly virtualNodes: readonly CheapVirtualNode[];
}

type Mirror = (g: MemGraph, facts: CheapFacts, p: Apg2Params) => Row[];

const cmp = (...keys: string[]) => (a: Row, b: Row): number => {
  for (const k of keys) {
    const x = JSON.stringify(a[k] ?? '');
    const y = JSON.stringify(b[k] ?? '');
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
};

const fact = (facts: CheapFacts, nodeId: string, key: string): unknown => facts.nodeFacts.find((f) => f.nodeId === nodeId && f.key === key)?.value;

export const CHEAP2_IN_MEMORY: ReadonlyMap<string, Mirror> = new Map<string, Mirror>([
  ['framework-exception-in-core', (g, facts, p) => facts.edges
    .filter((e) => e.type === 'THROWS' && e.properties.direct === true && e.properties.frameworkHttp === true)
    .flatMap((e) => {
      const m = g.byId.get(e.sourceId);
      const layer = m === undefined ? null : g.layer.get(m.id) ?? null;
      if (m === undefined || layer === null || !(layer === p.domainLayer || p.applicationLayers.includes(layer))) return [];
      return [{ filePath: m.filePath, member: e.properties.unit, errorType: e.properties.errorType, module: e.properties.module, layer }];
    }).sort(cmp('filePath', 'member', 'errorType'))],

  ['endpoint-bypasses-application', (g, facts) => {
    const eps = new Map(facts.virtualNodes.filter((n) => n.kind === 'EntryPoint').map((n) => [n.id, n]));
    return facts.edges.filter((e) => e.type === 'REACHES' && e.properties.withoutCore === true && e.properties.infrastructure === true).flatMap((e) => {
      const ep = eps.get(e.sourceId);
      if (ep === undefined || !['http', 'message'].includes(String(ep.properties.entryKind))) return [];
      return [{ filePath: ep.properties.file, entry: ep.name, target: e.properties.unit, targetFile: g.byId.get(e.targetId)?.filePath ?? null, depth: e.properties.depth }];
    }).sort(cmp('filePath', 'entry', 'target'));
  }],

  ['vendor-sdk-outside-adapters', (g, facts) => g.nodes.filter((n) => n.type === 'File').flatMap((f) => {
    const v = fact(facts, f.id, 'vendorSdkOutsideAdapters');
    return Array.isArray(v) ? v.map((sdk) => ({ filePath: f.filePath, sdk, layer: g.layer.get(f.id) ?? null })) : [];
  }).sort(cmp('filePath', 'sdk'))],

  ['untested-component', (g, facts) => {
    const by = new Map<string, string[]>();
    for (const f of g.nodes) {
      if (f.type !== 'File' || fact(facts, f.id, 'componentUntested') !== true) continue;
      const c = String(fact(facts, f.id, 'component'));
      by.set(c, [...(by.get(c) ?? []), f.filePath]);
    }
    return [...by.entries()].map(([component, files]) => ({ filePath: [...files].sort()[0], component, files: files.length })).sort(cmp('component'));
  }],

  ['env-read-outside-config', (g, facts) => {
    const keys = new Map(facts.virtualNodes.filter((n) => n.kind === 'EnvKey').map((n) => [n.id, n]));
    return facts.edges.filter((e) => e.type === 'READS_ENV' && e.properties.outsideConfig === true).flatMap((e) => {
      const m = g.byId.get(e.sourceId);
      const k = keys.get(e.targetId);
      if (m === undefined || k === undefined) return [];
      return [{ filePath: m.filePath, member: m.name, key: k.name, via: e.properties.via, lines: e.properties.lines }];
    }).sort(cmp('filePath', 'member', 'key'));
  }],

  ['hidden-coupling', (g, facts) => facts.edges.filter((e) => e.type === 'CO_CHANGES_WITH' && e.properties.hiddenCoupling === true).map((e) => ({
    filePath: g.byId.get(e.sourceId)?.filePath ?? null, target: g.byId.get(e.targetId)?.filePath ?? null,
    support: e.properties.support, confidence: e.properties.confidence, reverseConfidence: e.properties.reverseConfidence,
  })).sort(cmp('filePath', 'target'))],

  ['agent-reimplementation', (g, facts) => facts.edges.filter((e) => e.type === 'REIMPLEMENTS').flatMap((e) => {
    const n = g.byId.get(e.sourceId);
    const o = g.byId.get(e.targetId);
    if (n === undefined || o === undefined) return [];
    return [{ filePath: n.filePath, unit: n.name, existing: o.name, target: o.filePath, via: e.properties.via, step: e.properties.step, existingSince: e.properties.existingSince }];
  }).sort(cmp('filePath', 'unit', 'existing'))],
]);
