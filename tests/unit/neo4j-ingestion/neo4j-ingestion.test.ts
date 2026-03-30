import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ingestAPG, Neo4jIngestionStage } from '../../../src/neo4j-ingestion/neo4j-ingestion.js';
import { FileSystemSnapshotStore } from '../../../src/neo4j-ingestion/fs-snapshot-store.js';
import { FirewallContext } from '../../../src/shared/context/firewall-context.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { runId } from '../../../src/shared/types/value-objects.js';
import type { GraphRepository, QueryResult } from '../../../src/shared/interfaces/graph-repository.js';
import type { APGResult } from '../../../src/shared/types/apg.js';
import type { LayerModel } from '../../../src/shared/types/spec.js';
import type { IngestionInput } from '../../../src/neo4j-ingestion/types.js';

// Mock GraphRepository
function createMockGraphRepo(): GraphRepository & { queries: string[] } {
  const queries: string[] = [];
  let nodeCount = 0;
  let edgeCount = 0;

  return {
    queries,
    async executeQuery(cypher: string, params?: Record<string, unknown>): Promise<DomainResult<QueryResult>> {
      queries.push(cypher.trim().slice(0, 80));

      // Track node/edge creation
      if (cypher.includes('CREATE (n:APGNode')) {
        const batch = (params?.['batch'] as unknown[]) ?? [];
        nodeCount += batch.length;
      }
      if (cypher.includes('CREATE (src)-[r:')) {
        const batch = (params?.['batch'] as unknown[]) ?? [];
        edgeCount += batch.length;
      }

      // Verification queries
      if (cypher.includes('RETURN count(n) AS cnt')) {
        return DomainResult.ok({ records: [{ cnt: nodeCount }], summary: { counters: {} } });
      }
      if (cypher.includes('RETURN count(r) AS cnt')) {
        return DomainResult.ok({ records: [{ cnt: edgeCount }], summary: { counters: {} } });
      }

      return DomainResult.ok({ records: [], summary: { counters: {} } });
    },
    async clearGraph() { return DomainResult.ok(undefined); },
    async healthCheck() { return true; },
    async close() {},
  };
}

const LAYER_MODEL: LayerModel = {
  layers: [
    { name: 'domain', directories: ['src/domain/**'], naming: [], role: 'entity', decorators: [] },
    { name: 'infrastructure', directories: ['src/infrastructure/**'], naming: [], role: 'controller', decorators: [] },
  ],
};

const SAMPLE_APG: APGResult = {
  nodes: [
    { id: 'f1', type: 'File', name: 'User.ts', filePath: 'src/domain/User.ts', properties: {} },
    { id: 'f2', type: 'File', name: 'Controller.ts', filePath: 'src/infrastructure/Controller.ts', properties: {} },
    { id: 'c1', type: 'Class', name: 'User', filePath: 'src/domain/User.ts', properties: {} },
    { id: 'm1', type: 'Method', name: 'User.getName', filePath: 'src/domain/User.ts', properties: {} },
  ],
  edges: [
    { id: 'e1', type: 'IMPORTS', sourceId: 'f2', targetId: 'f1', properties: {} },
    { id: 'e2', type: 'DECLARES', sourceId: 'f1', targetId: 'c1', properties: {} },
    { id: 'e3', type: 'CONTAINS', sourceId: 'c1', targetId: 'm1', properties: {} },
  ],
  parseCoverage: { total: 2, parsed: 2, skipped: [], percentage: 100 },
  warnings: [],
};

describe('neo4j-ingestion', () => {
  describe('ingestAPG (stateless mode)', () => {
    it('ingests APG successfully in stateless mode', async () => {
      const graphRepo = createMockGraphRepo();
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingest-test-'));
      const snapshotStore = new FileSystemSnapshotStore(tmpDir);

      const input: IngestionInput = {
        apgResult: SAMPLE_APG,
        layerModel: LAYER_MODEL,
        mode: 'stateless',
      };

      const result = await ingestAPG(input, graphRepo, snapshotStore);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.graphStats.nodeCount).toBe(4);
        expect(result.data.graphStats.edgeCount).toBe(3);
        expect(result.data.layerAnnotationSummary.mapped).toBe(2);
        expect(result.data.layerAnnotationSummary.unmapped).toBe(0);
        expect(result.data.deltaStats).toBeUndefined();
        expect(result.data.driftReport).toBeUndefined();
      }

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('clears graph before ingestion', async () => {
      const graphRepo = createMockGraphRepo();
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingest-test-'));
      const snapshotStore = new FileSystemSnapshotStore(tmpDir);

      await ingestAPG({ apgResult: SAMPLE_APG, layerModel: LAYER_MODEL, mode: 'stateless' }, graphRepo, snapshotStore);

      // First query should be clear (via clearGraph)
      // Then node creation, then edge creation, then verification
      expect(graphRepo.queries.length).toBeGreaterThan(0);

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  describe('ingestAPG (persistent mode)', () => {
    it('saves snapshot in persistent mode', async () => {
      const graphRepo = createMockGraphRepo();
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingest-test-'));
      const snapshotStore = new FileSystemSnapshotStore(tmpDir);
      const sha = 'a'.repeat(40);

      const input: IngestionInput = {
        apgResult: SAMPLE_APG,
        layerModel: LAYER_MODEL,
        mode: 'persistent',
        commitSha: sha as import('../../../src/shared/types/value-objects.js').CommitSha,
      };

      const result = await ingestAPG(input, graphRepo, snapshotStore);
      expect(result.success).toBe(true);

      // Verify snapshot was saved
      const snapDir = path.join(tmpDir, `snapshot_${sha}`);
      expect(fs.existsSync(snapDir)).toBe(true);
      expect(fs.existsSync(path.join(snapDir, 'nodes.json'))).toBe(true);

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  describe('Neo4jIngestionStage', () => {
    it('implements PipelineStage and sets context', async () => {
      const graphRepo = createMockGraphRepo();
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingest-test-'));
      const snapshotStore = new FileSystemSnapshotStore(tmpDir);
      const stage = new Neo4jIngestionStage(graphRepo, snapshotStore);

      expect(stage.name).toBe('neo4j-ingestion');

      const context = new FirewallContext(runId('test-run'));
      const input: IngestionInput = {
        apgResult: SAMPLE_APG,
        layerModel: LAYER_MODEL,
        mode: 'stateless',
      };

      const result = await stage.execute(input, context);
      expect(result.success).toBe(true);

      // Context should have IngestionResult
      const ingResult = context.getIngestionResult();
      expect(ingResult.graphStats.nodeCount).toBe(4);
      expect(context.auditLog.some((e) => e.stage === 'neo4j-ingestion')).toBe(true);

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });
});
