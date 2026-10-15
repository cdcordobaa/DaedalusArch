/**
 * Proxy 9, COMMUNITIES: Louvain communities of the file graph compared with the declared layers and components.
 *
 * Graph: project File nodes; an undirected edge of weight 1 per literal-view IMPORTS edge (`Docs/v1.3/edge-views.md`),
 * per CONSTRUCTOR_INJECTS edge (class to class, mapped to their files) and per CALLS edge (method to method, mapped to
 * their files); self-loops dropped. Reports the adjusted Rand index of the partition against the declared layers (files
 * with a layer) and against the components, and flags each file of a community of two or more files whose majority
 * component differs from the file's own component.
 */
import { literalEdgeView } from '../../shared/apg-edge-view.js';
import type { CheapContext } from './context.js';
import { adjustedRandIndex, louvain } from './louvain.js';
import type { WeightedEdge } from './louvain.js';
import type { CheapFlag, CheapNodeFact, CheapProxyOutput } from './types.js';

const GRAPH_EDGE_TYPES = new Set(['IMPORTS', 'CONSTRUCTOR_INJECTS', 'CALLS']);

export function fileGraph(ctx: CheapContext): { nodes: string[]; edges: WeightedEdge[] } {
  const fileOf = new Map<string, string>();
  for (const n of ctx.apg.nodes) if (n.type !== 'Package' && ctx.files.has(n.filePath)) fileOf.set(n.id, n.filePath);
  const nodes = [...ctx.files.keys()];
  const acc = new Map<string, number>();
  for (const e of literalEdgeView(ctx.apg.edges)) {
    if (!GRAPH_EDGE_TYPES.has(e.type)) continue;
    const a = fileOf.get(e.sourceId);
    const b = fileOf.get(e.targetId);
    if (a === undefined || b === undefined || a === b) continue;
    const [x, y] = a < b ? [a, b] : [b, a];
    acc.set(`${x}\u0000${y}`, (acc.get(`${x}\u0000${y}`) ?? 0) + 1);
  }
  const edges = [...acc.entries()].map(([k, w]) => {
    const [a = '', b = ''] = k.split('\u0000');
    return { a, b, w };
  });
  return { nodes, edges };
}

export function runCommunities(ctx: CheapContext): CheapProxyOutput {
  const { nodes, edges } = fileGraph(ctx);
  const res = louvain(nodes, edges, ctx.options.louvainResolution);
  const layers = new Map<string, string>();
  const comps = new Map<string, string>();
  for (const f of nodes) {
    const i = ctx.info(f);
    if (i.layer !== null) layers.set(f, i.layer);
    comps.set(f, i.component);
  }
  const members = new Map<number, string[]>();
  for (const [f, c] of res.community) members.set(c, [...(members.get(c) ?? []), f]);
  const nodeFacts: CheapNodeFact[] = [];
  const flags: CheapFlag[] = [];
  for (const [c, files] of members) {
    const tally = new Map<string, number>();
    for (const f of files) tally.set(ctx.info(f).component, (tally.get(ctx.info(f).component) ?? 0) + 1);
    const [major, count] = [...tally.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0] ?? ['', 0];
    for (const f of files) {
      const id = ctx.info(f).fileNodeId;
      if (id !== undefined) nodeFacts.push({ proxy: 'communities', nodeId: id, key: 'community', value: c });
      if (files.length < 2 || ctx.info(f).component === major) continue;
      flags.push({ proxy: 'communities', kind: 'community-component-mismatch', score: count / files.length, evidence: { file: f, startLine: 1, endLine: 1 }, message: `${f} (component ${ctx.info(f).component}) clusters with community ${String(c)} whose majority component is ${major}` });
    }
  }
  return {
    edges: [], nodeFacts, flags,
    summary: {
      files: nodes.length, graphEdges: edges.length, communities: members.size, modularity: res.modularity, levels: res.levels,
      ariLayers: layers.size >= 2 ? adjustedRandIndex(res.community, layers) : null,
      ariComponents: adjustedRandIndex(res.community, comps),
      mismatchedFiles: flags.map((f) => f.evidence.file),
    },
  };
}
