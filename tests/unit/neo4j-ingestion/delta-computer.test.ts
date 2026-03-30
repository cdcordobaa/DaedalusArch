import { computeDelta, computeDeltaStats } from '../../../src/neo4j-ingestion/delta-computer.js';
import type { APGResult, APGNode, APGEdge } from '../../../src/shared/types/apg.js';

function makeAPG(nodes: APGNode[], edges: APGEdge[]): APGResult {
  return { nodes, edges, parseCoverage: { total: nodes.length, parsed: nodes.length, skipped: [], percentage: 100 }, warnings: [] };
}

const n = (id: string, name: string): APGNode => ({ id, type: 'File', name, filePath: `src/${name}`, properties: {} });
const e = (id: string, src: string, tgt: string): APGEdge => ({ id, type: 'IMPORTS', sourceId: src, targetId: tgt, properties: {} });

describe('delta-computer', () => {
  describe('computeDelta', () => {
    it('detects added nodes', () => {
      const prev = makeAPG([n('a', 'A.ts')], []);
      const curr = makeAPG([n('a', 'A.ts'), n('b', 'B.ts')], []);
      const delta = computeDelta(curr, prev);
      expect(delta.addedNodes).toHaveLength(1);
      expect(delta.addedNodes[0].id).toBe('b');
      expect(delta.removedNodes).toHaveLength(0);
    });

    it('detects removed nodes', () => {
      const prev = makeAPG([n('a', 'A.ts'), n('b', 'B.ts')], []);
      const curr = makeAPG([n('a', 'A.ts')], []);
      const delta = computeDelta(curr, prev);
      expect(delta.removedNodes).toHaveLength(1);
      expect(delta.removedNodes[0].id).toBe('b');
      expect(delta.addedNodes).toHaveLength(0);
    });

    it('detects added and removed edges', () => {
      const prev = makeAPG([], [e('e1', 'a', 'b')]);
      const curr = makeAPG([], [e('e2', 'a', 'c')]);
      const delta = computeDelta(curr, prev);
      expect(delta.addedEdges).toHaveLength(1);
      expect(delta.addedEdges[0].id).toBe('e2');
      expect(delta.removedEdges).toHaveLength(1);
      expect(delta.removedEdges[0].id).toBe('e1');
    });

    it('returns empty delta for identical APGs', () => {
      const apg = makeAPG([n('a', 'A.ts')], [e('e1', 'a', 'a')]);
      const delta = computeDelta(apg, apg);
      expect(delta.addedNodes).toHaveLength(0);
      expect(delta.removedNodes).toHaveLength(0);
      expect(delta.addedEdges).toHaveLength(0);
      expect(delta.removedEdges).toHaveLength(0);
    });
  });

  describe('computeDeltaStats', () => {
    it('computes correct counts', () => {
      const delta = {
        addedNodes: [n('b', 'B.ts'), n('c', 'C.ts')],
        removedNodes: [n('d', 'D.ts')],
        addedEdges: [e('e1', 'b', 'c')],
        removedEdges: [],
      };
      const stats = computeDeltaStats(delta);
      expect(stats.addedNodes).toBe(2);
      expect(stats.removedNodes).toBe(1);
      expect(stats.addedEdges).toBe(1);
      expect(stats.removedEdges).toBe(0);
    });
  });
});
