/**
 * In-memory mirrors of the v1.3 rules closest to each APG v2 enrichment, for the ablation's (b) column
 * (`scripts/apg2-ablation.ts`): what the v1.3 APG, without the APG v2 edges, reports at a planted case's locus.
 * Each mirrors the frozen template text under its v1.3 edge view (`Docs/v1.3/edge-views.md`); exclude paths are not
 * applied. `linkingEdges` is the information-level check: any v1.3 edge between two files' nodes.
 */
import type { APGEdge } from '../shared/types/apg.js';
import { EDGE_TYPES, V13_EDGE_TYPES } from '../shared/types/enums.js';
import { pushTo } from './apg2-in-memory.js';
import type { MemGraph, Row } from './apg2-in-memory.js';

const isLiteral = (e: APGEdge): boolean => e.type !== 'IMPORTS' || e.properties.viaReExport !== true;
const isResolved = (e: APGEdge): boolean => e.type !== 'IMPORTS' || e.properties.reExportHop !== true;

/** FF-S01 dependency-direction (literal view): a File in layer i imports or re-exports a File in layer j > i. */
export function v13DependencyDirection(g: MemGraph, layerOrder: readonly string[]): Row[] {
  const rows: Row[] = [];
  for (const e of g.edges) {
    if ((e.type !== 'IMPORTS' && e.type !== 'RE_EXPORTS') || !isLiteral(e)) continue;
    const s = g.node(e.sourceId);
    const t = g.node(e.targetId);
    if (s.type !== 'File' || t.type !== 'File') continue;
    const sl = g.layer.get(s.id) ?? null;
    const tl = g.layer.get(t.id) ?? null;
    if (sl === null || tl === null || sl === tl) continue;
    const si = layerOrder.indexOf(sl);
    const ti = layerOrder.indexOf(tl);
    if (si >= 0 && ti >= 0 && si < ti) rows.push({ rule: 'dependency-direction', source: s.filePath, target: t.filePath });
  }
  return rows;
}

/** FF-S02 no-cyclic-deps (literal view): files on an IMPORTS / RE_EXPORTS cycle, one row per strongly connected set. */
export function v13NoCyclicDeps(g: MemGraph): Row[] {
  const adj = new Map<string, string[]>();
  for (const e of g.edges) {
    if ((e.type !== 'IMPORTS' && e.type !== 'RE_EXPORTS') || !isLiteral(e)) continue;
    const s = g.node(e.sourceId);
    const t = g.node(e.targetId);
    if (s.type !== 'File' || t.type !== 'File') continue;
    pushTo(adj, s.filePath, t.filePath);
  }
  // Tarjan's SCC.
  let index = 0;
  const idx = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const on = new Set<string>();
  const rows: Row[] = [];
  const num = (m: Map<string, number>, k: string): number => m.get(k) ?? Number.POSITIVE_INFINITY;
  const visit = (v: string): void => {
    idx.set(v, index); low.set(v, index); index++;
    stack.push(v); on.add(v);
    for (const w of adj.get(v) ?? []) {
      if (!idx.has(w)) { visit(w); low.set(v, Math.min(num(low, v), num(low, w))); }
      else if (on.has(w)) low.set(v, Math.min(num(low, v), num(idx, w)));
    }
    if (low.get(v) === idx.get(v)) {
      const scc: string[] = [];
      for (let w = stack.pop(); w !== undefined; w = stack.pop()) {
        on.delete(w);
        scc.push(w);
        if (w === v) break;
      }
      if (scc.length > 1) rows.push({ rule: 'no-cyclic-deps', cycle: scc.sort(), source: scc[0], target: scc[1] });
    }
  };
  for (const v of [...adj.keys()].sort()) if (!idx.has(v)) visit(v);
  return rows;
}

/** FF-P01 domain-purity (resolved view): a domain File imports or re-exports a forbidden Package. */
export function v13DomainPurity(g: MemGraph, domainLayer: string | undefined, forbidden: readonly string[]): Row[] {
  if (domainLayer === undefined) return [];
  const rows: Row[] = [];
  for (const e of g.edges) {
    if ((e.type !== 'IMPORTS' && e.type !== 'RE_EXPORTS') || !isResolved(e)) continue;
    const s = g.node(e.sourceId);
    const p = g.node(e.targetId);
    if (s.type !== 'File' || p.type !== 'Package' || g.layer.get(s.id) !== domainLayer) continue;
    const hit = forbidden.some((fp) => p.name === fp || (fp.endsWith('/*') && p.name.startsWith(fp.slice(0, -1))));
    if (hit) rows.push({ rule: 'domain-purity', source: s.filePath, target: p.name });
  }
  return rows;
}

const V13_TYPES = new Set<string>([...EDGE_TYPES, ...V13_EDGE_TYPES]);

/** Every v1.3 edge (any v1.2E or v1.3 type) from a node of `fromFile` to a node of `toFile`, either direction. */
export function linkingEdges(g: MemGraph, fileA: string, fileB: string): APGEdge[] {
  return g.edges.filter((e) => {
    if (!V13_TYPES.has(e.type)) return false;
    const s = g.byId.get(e.sourceId)?.filePath;
    const t = g.byId.get(e.targetId)?.filePath;
    return (s === fileA && t === fileB) || (s === fileB && t === fileA);
  });
}

/**
 * FF-P06 domain-state-purity: a domain Class holding an infrastructure Class or Interface through its field half
 * (`fieldRel`: FLOWS_TO in the frozen text, HOLDS_STATE_OF in the field-state variant, `applyFieldState`) or through
 * CONSTRUCTOR_INJECTS. Same columns and order as the Cypher (`cypher-templates.ts`); `relType` is the edge type.
 */
export function v13DomainStatePurity(
  g: MemGraph, domainLayer: string, infraLayer: string, fieldRel: 'FLOWS_TO' | 'HOLDS_STATE_OF' = 'FLOWS_TO',
): Row[] {
  const rows: { filePath: string; class: string; target: string; targetName: string; relType: string; field: string; line: number | null }[] = [];
  for (const e of g.edges) {
    if (e.type !== fieldRel && e.type !== 'CONSTRUCTOR_INJECTS') continue;
    const c = g.node(e.sourceId);
    const t = g.node(e.targetId);
    if (c.type !== 'Class' || (t.type !== 'Class' && t.type !== 'Interface')) continue;
    if (g.layer.get(c.id) !== domainLayer || g.layer.get(t.id) !== infraLayer) continue;
    const p = e.properties;
    const field = typeof p.field === 'string' ? p.field : typeof p.parameterName === 'string' ? p.parameterName : '';
    rows.push({
      filePath: c.filePath, class: c.name, target: t.filePath, targetName: t.name, relType: e.type, field,
      line: typeof p.line === 'number' ? p.line : null,
    });
  }
  const key = (r: (typeof rows)[number]): string => [r.filePath, r.class, r.target, r.relType, r.field].join('\u0000');
  rows.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
  return rows.map((r) => ({ rule: 'domain-state-purity', ...r }));
}
