import type { APGResult } from '../shared/types/apg.js';
import type { ParsedSpec } from '../shared/types/spec.js';
import type { ActionableViolation } from '../shared/taxonomy/violation-types.js';
import type { CytoscapeGraphData, CytoscapeNode, CytoscapeEdge } from './types.js';

const DEFAULT_LAYER_COLORS: Record<string, string> = {
  domain: '#6366f1',
  application: '#8b5cf6',
  infrastructure: '#f59e0b',
  presentation: '#10b981',
  adapter: '#f97316',
  framework: '#ef4444',
  shared: '#6b7280',
  config: '#9ca3af',
  test: '#64748b',
};

const FALLBACK_COLOR = '#94a3b8';

/**
 * Assign a color for a given layer name.
 */
function layerColor(layer: string): string {
  return DEFAULT_LAYER_COLORS[layer.toLowerCase()] ?? FALLBACK_COLOR;
}

/**
 * Build a set of file paths that have violations for quick lookup.
 */
function buildViolationFileSet(violations: readonly ActionableViolation[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const v of violations) {
    counts.set(v.filePath, (counts.get(v.filePath) ?? 0) + 1);
  }
  return counts;
}

/**
 * Build a set of edges (source→target) that represent violations.
 */
function buildViolationEdgeSet(violations: readonly ActionableViolation[]): Set<string> {
  const set = new Set<string>();
  for (const v of violations) {
    if (v.type === 'LAYER_VIOLATION' || v.type === 'LAYER_SKIP' || v.type === 'DOMAIN_OUTWARD_DEP') {
      if (v.evidence && v.evidence.length > 0) {
        for (const e of v.evidence) {
          const match = e.match(/imports?\s+(?:from\s+)?['"]?([^'";\s]+)/i);
          if (match?.[1]) {
            set.add(`${v.filePath}→${match[1]}`);
          }
        }
      }
    }
  }
  return set;
}

/**
 * Build Cytoscape.js graph data from APG result, parsed spec, and violations.
 *
 * Nodes represent File-type APG nodes, colored by their architectural layer.
 * Edges represent IMPORTS relationships, with violation edges highlighted.
 */
export function buildGraphData(
  apgResult: APGResult,
  spec: ParsedSpec,
  violations: readonly ActionableViolation[],
): CytoscapeGraphData {
  const violationCounts = buildViolationFileSet(violations);
  const violationEdges = buildViolationEdgeSet(violations);

  // Build layer colors from spec layer model
  const layerColors: Record<string, string> = {};
  for (const layerDef of spec.layerModel.layers) {
    layerColors[layerDef.name] = layerColor(layerDef.name);
  }

  // Filter to File nodes only for graph visualization
  const fileNodes = apgResult.nodes.filter((n) => n.type === 'File');

  const nodes: CytoscapeNode[] = fileNodes.map((node) => ({
    data: {
      id: node.id,
      label: node.name,
      layer: node.layer ?? 'unknown',
      type: node.type,
      filePath: node.filePath,
      violationCount: violationCounts.get(node.filePath) ?? 0,
    },
  }));

  // Filter to IMPORTS edges between File nodes
  const fileNodeIds = new Set(fileNodes.map((n) => n.id));
  const importEdges = apgResult.edges.filter(
    (e) => e.type === 'IMPORTS' && fileNodeIds.has(e.sourceId) && fileNodeIds.has(e.targetId),
  );

  // Build lookup from node ID to file path
  const idToPath = new Map<string, string>();
  for (const node of fileNodes) {
    idToPath.set(node.id, node.filePath);
  }

  const edges: CytoscapeEdge[] = importEdges.map((edge) => {
    const sourcePath = idToPath.get(edge.sourceId) ?? '';
    const targetPath = idToPath.get(edge.targetId) ?? '';
    const edgeKey = `${sourcePath}→${targetPath}`;
    const isViolation = violationEdges.has(edgeKey);

    return {
      data: {
        id: edge.id,
        source: edge.sourceId,
        target: edge.targetId,
        type: edge.type,
        isViolation,
      },
    };
  });

  return { nodes, edges, layerColors };
}
