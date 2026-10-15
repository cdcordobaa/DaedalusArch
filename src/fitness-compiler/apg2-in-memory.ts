/**
 * In-memory mirrors of the APG v2 extension templates (`apg2-templates.ts`): pure predicates over an `APGResult` and a
 * spec's layer model that return the rows the Cypher returns (same columns, same order). They let the ablation
 * (`Docs/DiagnosticRuns/apg2-ablation-2026-10-15.md`) and the unit tests run without Neo4j. Exclude paths are not
 * applied (the `/*EXCLUDE*\/` anchors are the compiler's). Layers are annotated with the ingestion's own annotator
 * (`annotateNodes`), so a node's layer is the one Neo4j would hold.
 */
import type { APGEdge, APGNode, APGResult } from '../shared/types/apg.js';
import type { LayerModel } from '../shared/types/spec.js';
import { annotateNodes } from '../neo4j-ingestion/layer-annotator.js';
import { bindLayerParams } from './layer-binding.js';
import { IO_ADVISORY_CATEGORIES, IO_BLOCKING_CATEGORIES } from './apg2-templates.js';

export type Row = Readonly<Record<string, unknown>>;

/** An APG with each node's layer (null when unmapped) and adjacency helpers. */
export interface MemGraph {
  readonly nodes: readonly APGNode[];
  readonly edges: readonly APGEdge[];
  readonly byId: ReadonlyMap<string, APGNode>;
  readonly layer: ReadonlyMap<string, string | null>;
  edgesOf(type: string): readonly APGEdge[];
  /** The node with this id; throws on a dangling id (an extraction never writes one). */
  node(id: string): APGNode;
}

export function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list === undefined) map.set(key, [value]);
  else list.push(value);
}

export function memGraph(apg: Pick<APGResult, 'nodes' | 'edges'>, layerModel: LayerModel): MemGraph {
  const { annotations } = annotateNodes(apg.nodes, layerModel);
  const layer = new Map<string, string | null>();
  for (const n of apg.nodes) layer.set(n.id, annotations.get(n.id)?.layer ?? null);
  const byType = new Map<string, APGEdge[]>();
  for (const e of apg.edges) pushTo(byType, e.type, e);
  const byId = new Map(apg.nodes.map((n) => [n.id, n]));
  return {
    nodes: apg.nodes, edges: apg.edges, byId, layer,
    edgesOf: (type) => byType.get(type) ?? [],
    node: (id) => {
      const n = byId.get(id);
      if (n === undefined) throw new Error(`dangling node id ${id}`);
      return n;
    },
  };
}

export interface Apg2Params {
  readonly domainLayer?: string;
  readonly applicationLayers: readonly string[];
  readonly infraLayer?: string;
  readonly controllerLayer?: string;
  readonly threshold: number;
  readonly allowedAsync: readonly string[];
}

/**
 * Parameters as the compiler binds them (`bindLayerParams`), plus `threshold` (default 0.7 for the main-sequence
 * distance) and `allowedAsync`: "subscriber->publisher" component pairs, from the explicit list or, when absent,
 * from the hexagonal `allowedDependencies` (a subscriber may react to a component it may depend on).
 */
export function apg2Params(layerModel: LayerModel, extra: { threshold?: number; allowedAsync?: readonly string[] } = {}): Apg2Params {
  const b = bindLayerParams(layerModel.layers);
  return {
    ...(b.domainLayer !== undefined ? { domainLayer: b.domainLayer } : {}),
    applicationLayers: [...b.applicationLayers],
    ...(b.infraLayer !== undefined ? { infraLayer: b.infraLayer } : {}),
    ...(b.controllerLayer !== undefined ? { controllerLayer: b.controllerLayer } : {}),
    threshold: extra.threshold ?? 0.7,
    allowedAsync: extra.allowedAsync ?? (layerModel.allowedDependencies ?? []).map((d) => `${d.from}->${d.to}`),
  };
}

const cmp = (...keys: string[]) => (a: Row, b: Row): number => {
  for (const k of keys) {
    const x = JSON.stringify(a[k] ?? '');
    const y = JSON.stringify(b[k] ?? '');
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
};

export function boundaryTypeLeak(g: MemGraph, p: Apg2Params): Row[] {
  const rows: Row[] = [];
  for (const e of g.edgesOf('SIGNATURE_USES')) {
    if (e.properties.publicSurface !== true) continue;
    const m = g.node(e.sourceId);
    const ty = g.node(e.targetId);
    const ml = g.layer.get(m.id) ?? null;
    const tl = g.layer.get(ty.id) ?? null;
    if (ml === null || tl === null) continue;
    if (!(ml === p.controllerLayer || p.applicationLayers.includes(ml))) continue;
    if (tl !== p.infraLayer || ml === tl) continue;
    rows.push({ filePath: m.filePath, member: m.name, leakedType: ty.name, target: ty.filePath, fromLayer: ml, toLayer: tl,
      positions: e.properties.positions, inferred: e.properties.inferred });
  }
  return rows.sort(cmp('filePath', 'member', 'leakedType'));
}

function reaches(g: MemGraph, from: string, to: string): boolean {
  const adj = new Map<string, string[]>();
  for (const e of g.edgesOf('DEPENDS_ON')) pushTo(adj, e.sourceId, e.targetId);
  const seen = new Set<string>([from]);
  const stack = [from];
  for (let cur = stack.pop(); cur !== undefined; cur = stack.pop()) {
    for (const n of adj.get(cur) ?? []) {
      if (n === to) return true;
      if (!seen.has(n)) { seen.add(n); stack.push(n); }
    }
  }
  return false;
}

export function componentAdpCycle(g: MemGraph): Row[] {
  const rows: Row[] = [];
  for (const d of g.edgesOf('DEPENDS_ON')) {
    if (!reaches(g, d.targetId, d.sourceId)) continue;
    const a = g.node(d.sourceId);
    const b = g.node(d.targetId);
    rows.push({ component: a.name, target: b.name, kind: d.properties.kind, imports: d.properties.imports, filePath: a.name });
  }
  return rows.sort(cmp('kind', 'component', 'target'));
}

export function componentSdpViolation(g: MemGraph): Row[] {
  const rows: Row[] = [];
  for (const d of g.edgesOf('DEPENDS_ON')) {
    const a = g.node(d.sourceId);
    const b = g.node(d.targetId);
    const ia = a.properties.instability;
    const ib = b.properties.instability;
    if (typeof ia !== 'number' || typeof ib !== 'number' || !(ia < ib)) continue;
    rows.push({ component: a.name, target: b.name, kind: d.properties.kind, fromInstability: ia, toInstability: ib, filePath: a.name });
  }
  return rows.sort(cmp('kind', 'component', 'target'));
}

export function componentMainSequenceDistance(g: MemGraph, p: Apg2Params): Row[] {
  return g.nodes
    .filter((c) => c.type === 'Component' && typeof c.properties.distance === 'number' && (c.properties.distance) > p.threshold)
    .map((c) => ({ component: c.name, kind: c.properties.kind, abstractness: c.properties.abstractness,
      instability: c.properties.instability, distance: c.properties.distance, filePath: c.name }))
    .sort(cmp('kind', 'component'));
}

function deepImport(g: MemGraph, declared: boolean): Row[] {
  return g.edgesOf('DEEP_IMPORT')
    .filter((d) => d.properties.publicApiDeclared === declared)
    .map((d) => ({ filePath: g.node(d.sourceId).filePath, target: g.node(d.targetId).filePath,
      component: d.properties.component, kind: d.properties.kind, line: d.properties.line }))
    .sort(cmp('filePath', 'target'));
}
export const deepImportDeclaredApi = (g: MemGraph): Row[] => deepImport(g, true);
export const deepImportInferredApi = (g: MemGraph): Row[] => deepImport(g, false);

/** File path → its components (one per kind). */
function componentsByFile(g: MemGraph): Map<string, APGNode[]> {
  const out = new Map<string, APGNode[]>();
  for (const e of g.edgesOf('BELONGS_TO')) {
    const f = g.node(e.sourceId);
    pushTo(out, f.filePath, g.node(e.targetId));
  }
  return out;
}

export function undeclaredAsyncCoupling(g: MemGraph, p: Apg2Params): Row[] {
  const comps = componentsByFile(g);
  const subs = new Map<string, APGNode[]>();
  for (const e of g.edgesOf('SUBSCRIBES')) pushTo(subs, e.targetId, g.node(e.sourceId));
  const seen = new Set<string>();
  const rows: Row[] = [];
  for (const e of g.edgesOf('PUBLISHES')) {
    const pub = g.node(e.sourceId);
    const ch = g.node(e.targetId);
    for (const s of subs.get(ch.id) ?? []) {
      for (const pc of comps.get(pub.filePath) ?? []) {
        for (const sc of comps.get(s.filePath) ?? []) {
          if (pc.properties.kind !== sc.properties.kind || pc.id === sc.id) continue;
          if (p.allowedAsync.includes(`${sc.name}->${pc.name}`)) continue;
          const row = { filePath: pub.filePath, subscriberComponent: sc.name, publisherComponent: pc.name, kind: pc.properties.kind,
            transport: ch.properties.transport, channel: ch.name, target: s.filePath };
          const key = JSON.stringify(row);
          if (!seen.has(key)) { seen.add(key); rows.push(row); }
        }
      }
    }
  }
  return rows.sort(cmp('kind', 'filePath', 'channel', 'target'));
}

function io(g: MemGraph, p: Apg2Params, categories: readonly string[]): Row[] {
  const rows: Row[] = [];
  for (const e of g.edgesOf('PERFORMS_IO')) {
    const m = g.node(e.sourceId);
    const cat = g.node(e.targetId);
    const l = g.layer.get(m.id) ?? null;
    if (l === null || !(l === p.domainLayer || p.applicationLayers.includes(l)) || !categories.includes(cat.name)) continue;
    rows.push({ filePath: m.filePath, member: m.name, layer: l, category: cat.name, apis: e.properties.apis, line: e.properties.line, lines: e.properties.lines });
  }
  return rows.sort(cmp('filePath', 'member', 'category'));
}
export const ioOutsideAdapters = (g: MemGraph, p: Apg2Params): Row[] => io(g, p, IO_BLOCKING_CATEGORIES);
export const nondeterminismInCore = (g: MemGraph, p: Apg2Params): Row[] => io(g, p, IO_ADVISORY_CATEGORIES);

/** Each APG v2 template name → its in-memory mirror. */
export const APG2_IN_MEMORY: ReadonlyMap<string, (g: MemGraph, p: Apg2Params) => Row[]> = new Map([
  ['boundary-type-leak', boundaryTypeLeak],
  ['component-adp-cycle', (g: MemGraph) => componentAdpCycle(g)],
  ['component-sdp-violation', (g: MemGraph) => componentSdpViolation(g)],
  ['component-main-sequence-distance', componentMainSequenceDistance],
  ['deep-import-declared-api', (g: MemGraph) => deepImportDeclaredApi(g)],
  ['deep-import-inferred-api', (g: MemGraph) => deepImportInferredApi(g)],
  ['undeclared-async-coupling', undeclaredAsyncCoupling],
  ['io-outside-adapters', ioOutsideAdapters],
  ['nondeterminism-in-core', nondeterminismInCore],
]);
