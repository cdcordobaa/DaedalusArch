import type { APGResult } from '../shared/types/apg.js';
import type { DeltaStats } from '../shared/types/evaluation.js';
import type { DeltaAPG } from '../shared/interfaces/snapshot-store.js';

/**
 * Compute delta between current and previous APG by comparing node/edge IDs.
 */
export function computeDelta(current: APGResult, previous: APGResult): DeltaAPG {
  const prevNodeIds = new Set(previous.nodes.map((n) => n.id));
  const currNodeIds = new Set(current.nodes.map((n) => n.id));
  const prevEdgeIds = new Set(previous.edges.map((e) => e.id));
  const currEdgeIds = new Set(current.edges.map((e) => e.id));

  const addedNodes = current.nodes.filter((n) => !prevNodeIds.has(n.id));
  const removedNodes = previous.nodes.filter((n) => !currNodeIds.has(n.id));
  const addedEdges = current.edges.filter((e) => !prevEdgeIds.has(e.id));
  const removedEdges = previous.edges.filter((e) => !currEdgeIds.has(e.id));

  return { addedNodes, removedNodes, addedEdges, removedEdges };
}

/**
 * Compute summary stats from a DeltaAPG.
 */
export function computeDeltaStats(delta: DeltaAPG): DeltaStats {
  return {
    addedNodes: delta.addedNodes.length,
    removedNodes: delta.removedNodes.length,
    addedEdges: delta.addedEdges.length,
    removedEdges: delta.removedEdges.length,
  };
}
