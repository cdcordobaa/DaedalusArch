import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FileSystemSnapshotStore } from '../../../src/neo4j-ingestion/fs-snapshot-store.js';
import type { APGResult } from '../../../src/shared/types/apg.js';
import { commitSha } from '../../../src/shared/types/value-objects.js';

const makeAPG = (): APGResult => ({
  nodes: [{ id: 'n1', type: 'File', name: 'A.ts', filePath: 'src/A.ts', properties: {} }],
  edges: [{ id: 'e1', type: 'IMPORTS', sourceId: 'n1', targetId: 'n1', properties: {} }],
  parseCoverage: { total: 1, parsed: 1, skipped: [], percentage: 100 },
  warnings: [],
});

// Use a fixed fake SHA for tests
const SHA = commitSha('a'.repeat(40));
const SHA2 = commitSha('b'.repeat(40));

describe('FileSystemSnapshotStore', () => {
  let tmpDir: string;
  let store: FileSystemSnapshotStore;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apg-store-test-'));
    store = new FileSystemSnapshotStore(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('saveSnapshot + loadSnapshot', () => {
    it('round-trips a snapshot', async () => {
      const apg = makeAPG();
      const meta = { commitSha: SHA, timestamp: '2026-01-01T00:00:00Z', projectPath: '/test', nodeCount: 1, edgeCount: 1 };

      const saveResult = await store.saveSnapshot(SHA, apg, meta);
      expect(saveResult.success).toBe(true);

      const loadResult = await store.loadSnapshot(SHA);
      expect(loadResult.success).toBe(true);
      if (loadResult.success && loadResult.data) {
        expect(loadResult.data.metadata.commitSha).toBe(String(SHA));
        expect(loadResult.data.apg.nodes).toHaveLength(1);
        expect(loadResult.data.apg.edges).toHaveLength(1);
      }
    });

    it('returns null for non-existent snapshot', async () => {
      const result = await store.loadSnapshot(SHA);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeNull();
      }
    });
  });

  describe('listSnapshots', () => {
    it('lists snapshots ordered by timestamp descending', async () => {
      const apg = makeAPG();
      await store.saveSnapshot(SHA, apg, { commitSha: SHA, timestamp: '2026-01-01T00:00:00Z', projectPath: '/test', nodeCount: 1, edgeCount: 1 });
      await store.saveSnapshot(SHA2, apg, { commitSha: SHA2, timestamp: '2026-01-02T00:00:00Z', projectPath: '/test', nodeCount: 1, edgeCount: 1 });

      const result = await store.listSnapshots();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        // SHA2 is newer
        expect(result.data[0].commitSha).toBe(String(SHA2));
      }
    });

    it('returns empty array for empty store', async () => {
      const result = await store.listSnapshots();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });
  });

  describe('getLatestSnapshot', () => {
    it('returns most recent snapshot', async () => {
      const apg = makeAPG();
      await store.saveSnapshot(SHA, apg, { commitSha: SHA, timestamp: '2026-01-01T00:00:00Z', projectPath: '/test', nodeCount: 1, edgeCount: 1 });
      await store.saveSnapshot(SHA2, apg, { commitSha: SHA2, timestamp: '2026-01-02T00:00:00Z', projectPath: '/test', nodeCount: 1, edgeCount: 1 });

      const result = await store.getLatestSnapshot();
      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data.metadata.commitSha).toBe(String(SHA2));
      }
    });

    it('returns null when no snapshots exist', async () => {
      const result = await store.getLatestSnapshot();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeNull();
      }
    });
  });

  describe('saveDelta', () => {
    it('saves delta files', async () => {
      const delta = {
        addedNodes: [{ id: 'n2', type: 'File' as const, name: 'B.ts', filePath: 'src/B.ts', properties: {} }],
        removedNodes: [],
        addedEdges: [],
        removedEdges: [],
      };
      const result = await store.saveDelta(SHA, SHA2, delta);
      expect(result.success).toBe(true);

      const deltaDir = path.join(tmpDir, `delta_${String(SHA)}_${String(SHA2)}`);
      expect(fs.existsSync(path.join(deltaDir, 'added_nodes.json'))).toBe(true);
      expect(fs.existsSync(path.join(deltaDir, 'removed_nodes.json'))).toBe(true);
    });
  });

  describe('saveDriftReport', () => {
    it('saves drift report JSON', async () => {
      const report = {
        from: String(SHA), to: String(SHA2), timestamp: '2026-01-02T00:00:00Z',
        structural: { newCrossLayerDeps: [], removedCrossLayerDeps: [], totalNewEdges: 0, totalRemovedEdges: 0 },
        coupling: { perLayer: [], overallFanOutDelta: 0, topContributors: [] },
        convention: { perLayer: [], newlyNonCompliant: [] },
        violationTrend: { direction: 'stable' as const, dataPoints: 0, slope: 0, recentScores: [] },
        alerts: [],
      };
      const result = await store.saveDriftReport(SHA2, report);
      expect(result.success).toBe(true);

      const reportPath = path.join(tmpDir, `drift_report_${String(SHA2)}.json`);
      expect(fs.existsSync(reportPath)).toBe(true);
    });
  });
});
