/**
 * The facts the construct switches read, as one small in-memory graph (no Neo4j). Built from the extractor's APG and
 * the spec's layer model with the same layer assignment as ingestion (`annotateNodes`), so a file or class has the
 * layer the templates see. The offline re-score builds the same graph from a re-extraction of each reference variant.
 */
import type { APGNode, APGResult } from '../shared/types/apg.js';
import type { LayerModel } from '../shared/types/spec.js';
import { annotateNodes } from '../neo4j-ingestion/layer-annotator.js';

export interface CgEdge {
  readonly from: string;
  readonly to: string;
  readonly type: 'IMPORTS' | 'RE_EXPORTS';
  readonly typeOnly: boolean;
  /** The resolved edge of a barrel import (ADR-V13-01); the literal view drops it. */
  readonly viaReExport: boolean;
  /** The literal edge to a barrel whose names are all re-exported; the resolved view drops it. */
  readonly reExportHop: boolean;
  readonly line?: number;
}

export interface CgPackageEdge {
  readonly from: string;
  readonly pkg: string;
  readonly typeOnly: boolean;
  readonly viaReExport: boolean;
  readonly line?: number;
}

export interface CgClass {
  readonly id: string;
  readonly name: string;
  readonly file: string;
  readonly kind: 'Class' | 'Interface';
  readonly layer: string | null;
  /** Own method names (unqualified). */
  readonly methods: readonly string[];
}

export interface CgClassEdge {
  readonly from: string;
  readonly to: string;
  readonly type: 'CONSTRUCTOR_INJECTS' | 'FLOWS_TO' | 'IMPLEMENTS';
  readonly field?: string;
  readonly line?: number;
}

export interface ConstructGraph {
  readonly files: ReadonlyMap<string, string | null>;
  readonly edges: readonly CgEdge[];
  readonly packageEdges: readonly CgPackageEdge[];
  readonly classes: readonly CgClass[];
  readonly classEdges: readonly CgClassEdge[];
}

export const EMPTY_CONSTRUCT_GRAPH: ConstructGraph = {
  files: new Map(), edges: [], packageEdges: [], classes: [], classEdges: [],
};

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/**
 * The graph of one APG. `relPath` maps an APG file path to the form the rows use (identity in the pipeline, where
 * rows carry the APG's own paths; project-relative in the offline re-score).
 */
export function constructGraphFromApg(apg: APGResult, layerModel: LayerModel, relPath: (p: string) => string = (p) => p): ConstructGraph {
  const nodes: APGNode[] = apg.nodes.map((n) => (n.filePath === relPath(n.filePath) ? n : { ...n, filePath: relPath(n.filePath) }));
  const { annotations } = annotateNodes(nodes, layerModel);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const layerOf = (id: string): string | null => annotations.get(id)?.layer ?? null;

  const files = new Map<string, string | null>();
  for (const n of nodes) if (n.type === 'File') files.set(n.filePath, layerOf(n.id));

  const methods = new Map<string, string[]>();
  const edges: CgEdge[] = [];
  const packageEdges: CgPackageEdge[] = [];
  const classEdges: CgClassEdge[] = [];
  for (const e of apg.edges) {
    const s = byId.get(e.sourceId);
    const t = byId.get(e.targetId);
    if (s === undefined || t === undefined) continue;
    const p = e.properties;
    if ((e.type === 'IMPORTS' || e.type === 'RE_EXPORTS') && s.type === 'File') {
      const line = num(p.line);
      if (t.type === 'File') {
        edges.push({
          from: s.filePath, to: t.filePath, type: e.type, typeOnly: p.isTypeOnly === true,
          viaReExport: p.viaReExport === true, reExportHop: p.reExportHop === true, ...(line !== undefined ? { line } : {}),
        });
      } else if (t.type === 'Package') {
        packageEdges.push({ from: s.filePath, pkg: t.name, typeOnly: p.isTypeOnly === true, viaReExport: p.viaReExport === true, ...(line !== undefined ? { line } : {}) });
      }
    } else if (e.type === 'CONTAINS' && (s.type === 'Class' || s.type === 'Interface') && t.type === 'Method') {
      const list = methods.get(s.id) ?? [];
      list.push(t.name.slice(t.name.lastIndexOf('.') + 1));
      methods.set(s.id, list);
    } else if (e.type === 'CONSTRUCTOR_INJECTS' || e.type === 'FLOWS_TO' || e.type === 'IMPLEMENTS') {
      const field = typeof p.field === 'string' ? p.field : typeof p.parameterName === 'string' ? p.parameterName : undefined;
      const line = num(p.line);
      classEdges.push({ from: s.id, to: t.id, type: e.type, ...(field !== undefined ? { field } : {}), ...(line !== undefined ? { line } : {}) });
    }
  }
  const classes: CgClass[] = nodes
    .filter((n) => n.type === 'Class' || n.type === 'Interface')
    .map((n) => ({ id: n.id, name: n.name, file: n.filePath, kind: n.type as 'Class' | 'Interface', layer: layerOf(n.id), methods: methods.get(n.id) ?? [] }));
  return { files, edges, packageEdges, classes, classEdges };
}

/** The literal view (Docs/v1.3/edge-views.md): the module graph as the import statements state it. */
export function literalEdges(g: ConstructGraph): readonly CgEdge[] {
  return g.edges.filter((e) => !e.viaReExport);
}

/** The resolved view: the v1.2E graph (one edge per declaring file). */
export function resolvedEdges(g: ConstructGraph): readonly CgEdge[] {
  return g.edges.filter((e) => !e.reExportHop);
}

export function layerOfFile(g: ConstructGraph, file: string): string | null {
  return g.files.get(file) ?? null;
}
