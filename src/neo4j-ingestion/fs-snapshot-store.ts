import * as fs from 'node:fs';
import * as path from 'node:path';
import type { APGResult } from '../shared/types/apg.js';
import type { CommitSha } from '../shared/types/value-objects.js';
import type { SnapshotStore, SnapshotMetadata, Snapshot, SnapshotSummary, DeltaAPG } from '../shared/interfaces/snapshot-store.js';
import type { DriftReport } from '../shared/types/drift.js';
import { DomainResult } from '../shared/errors/domain-result.js';

export class FileSystemSnapshotStore implements SnapshotStore {
  constructor(private readonly basePath: string) {}

  async saveSnapshot(commitSha: CommitSha, apg: APGResult, metadata: SnapshotMetadata): Promise<DomainResult<void>> {
    try {
      const dir = this.snapshotDir(commitSha);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'nodes.json'), JSON.stringify(apg.nodes, null, 2));
      fs.writeFileSync(path.join(dir, 'edges.json'), JSON.stringify(apg.edges, null, 2));
      fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify(metadata, null, 2));
      return DomainResult.ok(undefined);
    } catch (e) {
      return DomainResult.fromError(e);
    }
  }

  async loadSnapshot(commitSha: CommitSha): Promise<DomainResult<Snapshot | null>> {
    try {
      const dir = this.snapshotDir(commitSha);
      if (!fs.existsSync(dir)) return DomainResult.ok(null);

      const nodes = JSON.parse(fs.readFileSync(path.join(dir, 'nodes.json'), 'utf-8'));
      const edges = JSON.parse(fs.readFileSync(path.join(dir, 'edges.json'), 'utf-8'));
      const metadata: SnapshotMetadata = JSON.parse(fs.readFileSync(path.join(dir, 'metadata.json'), 'utf-8'));

      const snapshot: Snapshot = {
        metadata,
        apg: { nodes, edges, parseCoverage: { total: nodes.length, parsed: nodes.length, skipped: [], percentage: 100 }, warnings: [] },
      };
      return DomainResult.ok<Snapshot | null>(snapshot);
    } catch (e) {
      return DomainResult.fromError(e);
    }
  }

  async listSnapshots(): Promise<DomainResult<readonly SnapshotSummary[]>> {
    try {
      if (!fs.existsSync(this.basePath)) return DomainResult.ok([]);

      const entries = fs.readdirSync(this.basePath)
        .filter((d) => d.startsWith('snapshot_'))
        .sort()
        .reverse();

      const summaries: SnapshotSummary[] = [];
      for (const dir of entries) {
        const metaPath = path.join(this.basePath, dir, 'metadata.json');
        if (!fs.existsSync(metaPath)) continue;
        const meta: SnapshotMetadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        summaries.push({
          commitSha: meta.commitSha,
          timestamp: meta.timestamp,
          nodeCount: meta.nodeCount,
          edgeCount: meta.edgeCount,
        });
      }

      // Sort by timestamp descending
      summaries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      return DomainResult.ok(summaries);
    } catch (e) {
      return DomainResult.fromError(e);
    }
  }

  async getLatestSnapshot(): Promise<DomainResult<Snapshot | null>> {
    const listResult = await this.listSnapshots();
    if (!listResult.success) return DomainResult.fail(listResult.errors);
    const latest = listResult.data[0];
    if (!latest) return DomainResult.ok(null);
    return this.loadSnapshot(latest.commitSha);
  }

  async saveDelta(fromSha: CommitSha, toSha: CommitSha, delta: DeltaAPG): Promise<DomainResult<void>> {
    try {
      const dir = path.join(this.basePath, `delta_${String(fromSha)}_${String(toSha)}`);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'added_nodes.json'), JSON.stringify(delta.addedNodes, null, 2));
      fs.writeFileSync(path.join(dir, 'removed_nodes.json'), JSON.stringify(delta.removedNodes, null, 2));
      fs.writeFileSync(path.join(dir, 'added_edges.json'), JSON.stringify(delta.addedEdges, null, 2));
      fs.writeFileSync(path.join(dir, 'removed_edges.json'), JSON.stringify(delta.removedEdges, null, 2));
      return DomainResult.ok(undefined);
    } catch (e) {
      return DomainResult.fromError(e);
    }
  }

  async saveDriftReport(commitSha: CommitSha, report: DriftReport): Promise<DomainResult<void>> {
    try {
      fs.mkdirSync(this.basePath, { recursive: true });
      const filePath = path.join(this.basePath, `drift_report_${String(commitSha)}.json`);
      fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
      return DomainResult.ok(undefined);
    } catch (e) {
      return DomainResult.fromError(e);
    }
  }

  private snapshotDir(commitSha: CommitSha): string {
    return path.join(this.basePath, `snapshot_${String(commitSha)}`);
  }
}
