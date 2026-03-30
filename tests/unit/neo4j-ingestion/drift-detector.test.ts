import { detectStructuralDrift, detectCouplingDrift, detectViolationTrend, detectDrift } from '../../../src/neo4j-ingestion/drift-detector.js';
import type { APGNode, APGEdge } from '../../../src/shared/types/apg.js';
import type { DeltaAPG } from '../../../src/shared/interfaces/snapshot-store.js';
import { DEFAULT_DRIFT_THRESHOLDS } from '../../../src/neo4j-ingestion/types.js';

const n = (id: string, layer: string | null): APGNode => ({
  id, type: 'File', name: `${id}.ts`, filePath: `src/${id}.ts`,
  properties: { layer },
});

const e = (id: string, src: string, tgt: string, type: APGEdge['type'] = 'IMPORTS'): APGEdge => ({
  id, type, sourceId: src, targetId: tgt, properties: {},
});

describe('drift-detector', () => {
  describe('detectStructuralDrift', () => {
    it('detects new cross-layer IMPORTS edges', () => {
      const currentNodes = [n('a', 'domain'), n('b', 'infrastructure')];
      const previousNodes = [n('a', 'domain'), n('b', 'infrastructure')];
      const delta: DeltaAPG = {
        addedNodes: [],
        removedNodes: [],
        addedEdges: [e('e1', 'b', 'a', 'IMPORTS')],
        removedEdges: [],
      };
      const result = detectStructuralDrift(delta, currentNodes, previousNodes);
      expect(result.newCrossLayerDeps).toHaveLength(1);
      expect(result.newCrossLayerDeps[0].sourceLayer).toBe('infrastructure');
      expect(result.newCrossLayerDeps[0].targetLayer).toBe('domain');
    });

    it('ignores same-layer edges', () => {
      const nodes = [n('a', 'domain'), n('b', 'domain')];
      const delta: DeltaAPG = {
        addedNodes: [],
        removedNodes: [],
        addedEdges: [e('e1', 'a', 'b', 'IMPORTS')],
        removedEdges: [],
      };
      const result = detectStructuralDrift(delta, nodes, nodes);
      expect(result.newCrossLayerDeps).toHaveLength(0);
    });

    it('ignores non-IMPORTS edges', () => {
      const nodes = [n('a', 'domain'), n('b', 'infrastructure')];
      const delta: DeltaAPG = {
        addedNodes: [],
        removedNodes: [],
        addedEdges: [e('e1', 'a', 'b', 'EXTENDS')],
        removedEdges: [],
      };
      const result = detectStructuralDrift(delta, nodes, nodes);
      expect(result.newCrossLayerDeps).toHaveLength(0);
    });
  });

  describe('detectCouplingDrift', () => {
    it('detects fan-out increase per layer', () => {
      const prevNodes = [n('a', 'domain'), n('b', 'domain')];
      const prevEdges = [e('e1', 'a', 'b')];
      const currNodes = [n('a', 'domain'), n('b', 'domain'), n('c', 'domain')];
      const currEdges = [e('e1', 'a', 'b'), e('e2', 'a', 'c'), e('e3', 'b', 'c')];

      const result = detectCouplingDrift(currEdges, prevEdges, currNodes, prevNodes, DEFAULT_DRIFT_THRESHOLDS);
      const domainLayer = result.perLayer.find((l) => l.layer === 'domain');
      expect(domainLayer).toBeDefined();
      expect(domainLayer!.currentAvgFanOut).toBeGreaterThan(domainLayer!.previousAvgFanOut);
    });
  });

  describe('detectViolationTrend', () => {
    it('returns insufficient_data for < 3 data points', () => {
      expect(detectViolationTrend([0.8, 0.7]).direction).toBe('insufficient_data');
      expect(detectViolationTrend(undefined).direction).toBe('insufficient_data');
      expect(detectViolationTrend([]).direction).toBe('insufficient_data');
    });

    it('detects improving trend (decreasing scores)', () => {
      const result = detectViolationTrend([0.8, 0.6, 0.4, 0.2]);
      expect(result.direction).toBe('improving');
      expect(result.slope).toBeLessThan(0);
    });

    it('detects degrading trend (increasing scores)', () => {
      const result = detectViolationTrend([0.2, 0.4, 0.6, 0.8]);
      expect(result.direction).toBe('degrading');
      expect(result.slope).toBeGreaterThan(0);
    });

    it('detects stable trend', () => {
      const result = detectViolationTrend([0.5, 0.5, 0.5, 0.5]);
      expect(result.direction).toBe('stable');
    });
  });

  describe('detectDrift (full)', () => {
    it('produces complete drift report with alerts', () => {
      const prevNodes = [n('a', 'domain'), n('b', 'infrastructure')];
      const currNodes = [n('a', 'domain'), n('b', 'infrastructure')];
      const prevEdges: APGEdge[] = [];
      const currEdges = [e('e1', 'b', 'a')];
      const delta: DeltaAPG = {
        addedNodes: [],
        removedNodes: [],
        addedEdges: [e('e1', 'b', 'a')],
        removedEdges: [],
      };

      const report = detectDrift(currNodes, prevNodes, currEdges, prevEdges, delta, 'sha1', 'sha2');
      expect(report.from).toBe('sha1');
      expect(report.to).toBe('sha2');
      expect(report.structural).toBeDefined();
      expect(report.coupling).toBeDefined();
      expect(report.convention).toBeDefined();
      expect(report.violationTrend.direction).toBe('insufficient_data');
      // Should have structural alert for new cross-layer dep
      expect(report.alerts.some((a) => a.metric === 'structural')).toBe(true);
    });
  });
});
