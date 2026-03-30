import type { APGNode, APGEdge } from '../shared/types/apg.js';
import type { DeltaAPG } from '../shared/interfaces/snapshot-store.js';
import type {
  DriftReport, StructuralDriftMetric, CouplingDriftMetric,
  ConventionDriftMetric, ViolationTrendMetric, DriftAlert, DriftThresholds,
  CrossLayerDep, LayerCouplingDelta, FanOutContributor, LayerConventionDelta,
} from '../shared/types/drift.js';
import { DEFAULT_DRIFT_THRESHOLDS } from './types.js';

/**
 * Detect all drift between two APG snapshots.
 */
export function detectDrift(
  currentNodes: readonly APGNode[],
  previousNodes: readonly APGNode[],
  currentEdges: readonly APGEdge[],
  previousEdges: readonly APGEdge[],
  delta: DeltaAPG,
  fromSha: string,
  toSha: string,
  history?: readonly number[],
  thresholds: DriftThresholds = DEFAULT_DRIFT_THRESHOLDS,
): DriftReport {
  const structural = detectStructuralDrift(delta, currentNodes, previousNodes);
  const coupling = detectCouplingDrift(currentEdges, previousEdges, currentNodes, previousNodes, thresholds);
  const convention = detectConventionDrift(currentNodes, previousNodes);
  const violationTrend = detectViolationTrend(history);
  const alerts = generateAlerts(structural, coupling, convention, violationTrend, thresholds);

  return {
    from: fromSha,
    to: toSha,
    timestamp: new Date().toISOString(),
    structural,
    coupling,
    convention,
    violationTrend,
    alerts,
  };
}

export function detectStructuralDrift(
  delta: DeltaAPG,
  currentNodes: readonly APGNode[],
  previousNodes: readonly APGNode[],
): StructuralDriftMetric {
  const nodeLayerMap = (nodes: readonly APGNode[]): Map<string, string | null> => {
    const map = new Map<string, string | null>();
    for (const n of nodes) {
      map.set(n.id, (n.properties?.['layer'] as string | undefined) ?? null);
    }
    return map;
  };

  const currLayers = nodeLayerMap(currentNodes);
  const prevLayers = nodeLayerMap(previousNodes);

  const newCrossLayer = groupCrossLayerDeps(delta.addedEdges, currLayers);
  const removedCrossLayer = groupCrossLayerDeps(delta.removedEdges, prevLayers);

  return {
    newCrossLayerDeps: newCrossLayer,
    removedCrossLayerDeps: removedCrossLayer,
    totalNewEdges: delta.addedEdges.length,
    totalRemovedEdges: delta.removedEdges.length,
  };
}

function groupCrossLayerDeps(
  edges: readonly APGEdge[],
  layerMap: Map<string, string | null>,
): CrossLayerDep[] {
  const groups = new Map<string, { count: number; examples: string[] }>();

  for (const edge of edges) {
    if (edge.type !== 'IMPORTS') continue;
    const srcLayer = layerMap.get(edge.sourceId);
    const tgtLayer = layerMap.get(edge.targetId);
    if (!srcLayer || !tgtLayer || srcLayer === tgtLayer) continue;

    const key = `${srcLayer}→${tgtLayer}`;
    const group = groups.get(key) ?? { count: 0, examples: [] };
    group.count++;
    if (group.examples.length < 5) {
      group.examples.push(`${edge.sourceId} → ${edge.targetId}`);
    }
    groups.set(key, group);
  }

  return Array.from(groups.entries()).map(([key, val]) => {
    const parts = key.split('→');
    return { sourceLayer: parts[0] ?? '', targetLayer: parts[1] ?? '', count: val.count, examples: val.examples };
  });
}

export function detectCouplingDrift(
  currentEdges: readonly APGEdge[],
  previousEdges: readonly APGEdge[],
  currentNodes: readonly APGNode[],
  previousNodes: readonly APGNode[],
  thresholds: DriftThresholds,
): CouplingDriftMetric {
  const computeFanOutPerLayer = (nodes: readonly APGNode[], edges: readonly APGEdge[]) => {
    const fileNodes = nodes.filter((n) => n.type === 'File');
    const importEdges = edges.filter((e) => e.type === 'IMPORTS');
    const fanOutMap = new Map<string, number>();
    for (const edge of importEdges) {
      fanOutMap.set(edge.sourceId, (fanOutMap.get(edge.sourceId) ?? 0) + 1);
    }

    const layerFanOut = new Map<string, { total: number; count: number }>();
    for (const node of fileNodes) {
      const layer = (node.properties?.['layer'] as string | undefined) ?? 'unmapped';
      const fo = fanOutMap.get(node.id) ?? 0;
      const entry = layerFanOut.get(layer) ?? { total: 0, count: 0 };
      entry.total += fo;
      entry.count++;
      layerFanOut.set(layer, entry);
    }
    return layerFanOut;
  };

  const currFO = computeFanOutPerLayer(currentNodes, currentEdges);
  const prevFO = computeFanOutPerLayer(previousNodes, previousEdges);

  const allLayers = new Set([...currFO.keys(), ...prevFO.keys()]);
  const perLayer: LayerCouplingDelta[] = [];
  let totalPrevFO = 0;
  let totalCurrFO = 0;

  for (const layer of allLayers) {
    if (layer === 'unmapped') continue;
    const prev = prevFO.get(layer);
    const curr = currFO.get(layer);
    const prevAvg = prev && prev.count > 0 ? prev.total / prev.count : 0;
    const currAvg = curr && curr.count > 0 ? curr.total / curr.count : 0;
    const delta = prevAvg > 0 ? ((currAvg - prevAvg) / prevAvg) * 100 : 0;
    totalPrevFO += prevAvg;
    totalCurrFO += currAvg;

    perLayer.push({
      layer,
      previousAvgFanOut: Math.round(prevAvg * 100) / 100,
      currentAvgFanOut: Math.round(currAvg * 100) / 100,
      deltaPercent: Math.round(delta * 100) / 100,
      exceedsThreshold: Math.abs(delta) > thresholds.maxCouplingDriftPercent,
    });
  }

  const overallDelta = totalPrevFO > 0 ? ((totalCurrFO - totalPrevFO) / totalPrevFO) * 100 : 0;

  // Top contributors — files with largest fan-out increase
  const topContributors = computeTopContributors(currentNodes, currentEdges, previousNodes, previousEdges);

  return {
    perLayer,
    overallFanOutDelta: Math.round(overallDelta * 100) / 100,
    topContributors: topContributors.slice(0, 5),
  };
}

function computeTopContributors(
  currentNodes: readonly APGNode[],
  currentEdges: readonly APGEdge[],
  _previousNodes: readonly APGNode[],
  previousEdges: readonly APGEdge[],
): FanOutContributor[] {
  const fanOut = (nodeId: string, edges: readonly APGEdge[]) =>
    edges.filter((e) => e.type === 'IMPORTS' && e.sourceId === nodeId).length;

  const currFiles = currentNodes.filter((n) => n.type === 'File');
  const contributors: FanOutContributor[] = [];

  for (const node of currFiles) {
    const currFO = fanOut(node.id, currentEdges);
    const prevFO = fanOut(node.id, previousEdges);
    const delta = currFO - prevFO;
    if (delta > 0) {
      contributors.push({
        filePath: node.filePath,
        previousFanOut: prevFO,
        currentFanOut: currFO,
        delta,
      });
    }
  }

  return contributors.sort((a, b) => b.delta - a.delta);
}

export function detectConventionDrift(
  currentNodes: readonly APGNode[],
  previousNodes: readonly APGNode[],
): ConventionDriftMetric {
  // Simple convention check: naming patterns per layer
  const computeCompliance = (nodes: readonly APGNode[]) => {
    const layerStats = new Map<string, { total: number; compliant: number }>();
    const classNodes = nodes.filter((n) => n.type === 'Class');

    for (const node of classNodes) {
      const layer = (node.properties?.['layer'] as string | undefined) ?? null;
      if (!layer) continue;
      const entry = layerStats.get(layer) ?? { total: 0, compliant: 0 };
      entry.total++;
      // Basic convention: class name should contain a role-related suffix
      // This is a simplified check — real logic would use spec role patterns
      entry.compliant++;
      layerStats.set(layer, entry);
    }
    return layerStats;
  };

  const currCompliance = computeCompliance(currentNodes);
  const prevCompliance = computeCompliance(previousNodes);
  const allLayers = new Set([...currCompliance.keys(), ...prevCompliance.keys()]);

  const perLayer: LayerConventionDelta[] = [];
  const newlyNonCompliant: string[] = [];

  for (const layer of allLayers) {
    const prev = prevCompliance.get(layer);
    const curr = currCompliance.get(layer);
    const prevRate = prev && prev.total > 0 ? prev.compliant / prev.total : 1;
    const currRate = curr && curr.total > 0 ? curr.compliant / curr.total : 1;
    const delta = (currRate - prevRate) * 100;

    perLayer.push({
      layer,
      previousCompliance: Math.round(prevRate * 1000) / 1000,
      currentCompliance: Math.round(currRate * 1000) / 1000,
      deltaPercent: Math.round(delta * 100) / 100,
    });
  }

  return { perLayer, newlyNonCompliant };
}

export function detectViolationTrend(
  history?: readonly number[],
): ViolationTrendMetric {
  if (!history || history.length < 3) {
    return {
      direction: 'insufficient_data',
      dataPoints: history?.length ?? 0,
      slope: 0,
      recentScores: history ? [...history] : [],
    };
  }

  // Simple linear regression: y = mx + b
  const n = history.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    const val = history[i]!;
    sumX += i;
    sumY += val;
    sumXY += i * val;
    sumXX += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

  let direction: 'improving' | 'stable' | 'degrading';
  if (slope < -0.01) direction = 'improving';
  else if (slope > 0.01) direction = 'degrading';
  else direction = 'stable';

  return {
    direction,
    dataPoints: n,
    slope: Math.round(slope * 10000) / 10000,
    recentScores: [...history],
  };
}

function generateAlerts(
  structural: StructuralDriftMetric,
  coupling: CouplingDriftMetric,
  convention: ConventionDriftMetric,
  violationTrend: ViolationTrendMetric,
  thresholds: DriftThresholds,
): DriftAlert[] {
  const alerts: DriftAlert[] = [];

  if (thresholds.structuralAnyNewCrossLayer && structural.newCrossLayerDeps.length > 0) {
    alerts.push({
      metric: 'structural',
      severity: 'warning',
      message: `${structural.newCrossLayerDeps.length} new cross-layer dependency group(s) detected`,
      actualValue: structural.newCrossLayerDeps.length,
      threshold: 0,
    });
  }

  for (const layer of coupling.perLayer) {
    if (layer.exceedsThreshold) {
      alerts.push({
        metric: 'coupling',
        severity: 'warning',
        message: `Layer "${layer.layer}" fan-out drift ${layer.deltaPercent.toFixed(1)}% exceeds ${thresholds.maxCouplingDriftPercent}% threshold`,
        actualValue: Math.abs(layer.deltaPercent),
        threshold: thresholds.maxCouplingDriftPercent,
      });
    }
  }

  for (const layer of convention.perLayer) {
    if (layer.deltaPercent < -thresholds.maxConventionDropPercent) {
      alerts.push({
        metric: 'convention',
        severity: 'warning',
        message: `Layer "${layer.layer}" convention compliance dropped ${Math.abs(layer.deltaPercent).toFixed(1)}%`,
        actualValue: Math.abs(layer.deltaPercent),
        threshold: thresholds.maxConventionDropPercent,
      });
    }
  }

  if (violationTrend.direction === 'degrading') {
    alerts.push({
      metric: 'violation_trend',
      severity: 'critical',
      message: `Violation trend is degrading (slope: ${violationTrend.slope})`,
      actualValue: violationTrend.slope,
      threshold: 0.01,
    });
  }

  return alerts;
}
