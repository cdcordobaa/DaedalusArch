import type { APGEdge, APGNode } from '../shared/types/apg.js';
import type { EdgeType } from '../shared/types/enums.js';
import type { GraphMode } from './types.js';

/**
 * Edge types kept by the `ast-only` graph mode (ADR-021 SO2-5, X-2): the register's allow-list
 * "IMPORTS, DECLARES and CONTAINS against the full graph". Import resolution (aliases, `baseUrl`,
 * barrels) is the full extraction's; only the other edge types are removed.
 */
export const AST_ONLY_EDGE_TYPES: readonly EdgeType[] = Object.freeze(['IMPORTS', 'DECLARES', 'CONTAINS']);

/** The edge types a graph mode keeps; `undefined` = every type (`full`). */
export function edgeTypesOf(mode: GraphMode): readonly EdgeType[] | undefined {
  return mode === 'ast-only' ? AST_ONLY_EDGE_TYPES : undefined;
}

export interface GraphView {
  readonly edges: readonly APGEdge[];
  /** Package nodes (targets of IMPORTS / RE_EXPORTS edges only). */
  readonly packageNodes: readonly APGNode[];
}

/**
 * Pure post-filter of a full extraction to a graph mode. `full` returns the input unchanged. `ast-only`
 * keeps the edges whose type is in `AST_ONLY_EDGE_TYPES`, in their order, and the Package nodes that a
 * kept edge still targets, in their order (a Package referenced only by RE_EXPORTS would dangle).
 * Extracted nodes, warnings and the import-resolution and FLOWS_TO accounting are not touched: they
 * describe the full extraction the view was taken from.
 */
export function restrictToGraphMode(view: GraphView, mode: GraphMode): GraphView {
  const allowed = edgeTypesOf(mode);
  if (allowed === undefined) return view;
  const edges = view.edges.filter((e) => allowed.includes(e.type));
  const targets = new Set(edges.map((e) => e.targetId));
  return { edges, packageNodes: view.packageNodes.filter((n) => targets.has(n.id)) };
}
