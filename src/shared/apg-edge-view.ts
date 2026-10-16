/**
 * The literal edge view over an in-memory APG (ADR-V13-01; `Docs/v1.3/edge-views.md`, addendum 2026-10-15).
 *
 * With `reExportEdges: 'both'` an import through a barrel gives a literal IMPORTS edge to the barrel and a resolved
 * IMPORTS edge to the declaring file marked `viaReExport: true`. The literal view keeps every edge except the
 * resolved ones: it is the module graph the import statements state. On a v1.2E graph no edge carries `viaReExport`,
 * so the view is the whole edge list and every reader's output is unchanged.
 */
import type { APGEdge } from './types/apg.js';

/** True for a resolved re-export IMPORTS edge (`viaReExport: true`), which the literal view drops. */
export function isResolvedReExportEdge(edge: Pick<APGEdge, 'type' | 'properties'>): boolean {
  // Snapshot and test edges may lack `properties` at run time, whatever the type says.
  const props: unknown = edge.properties;
  return edge.type === 'IMPORTS' && typeof props === 'object' && props !== null && 'viaReExport' in props && props.viaReExport === true;
}

/** The edges of the literal view, in their original order. */
export function literalEdgeView<E extends Pick<APGEdge, 'type' | 'properties'>>(edges: readonly E[]): E[] {
  return edges.filter((e) => !isResolvedReExportEdge(e));
}
