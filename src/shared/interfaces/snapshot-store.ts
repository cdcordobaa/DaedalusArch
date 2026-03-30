import type { DomainResult } from '../errors/domain-result.js';
import type { APGResult } from '../types/apg.js';
import type { CommitSha } from '../types/value-objects.js';

export interface SnapshotMetadata {
  readonly commitSha: CommitSha;
  readonly timestamp: string;
  readonly projectPath: string;
  readonly nodeCount: number;
  readonly edgeCount: number;
}

export interface Snapshot {
  readonly metadata: SnapshotMetadata;
  readonly apg: APGResult;
}

export interface SnapshotSummary {
  readonly commitSha: CommitSha;
  readonly timestamp: string;
  readonly nodeCount: number;
  readonly edgeCount: number;
}

export interface SnapshotStore {
  saveSnapshot(commitSha: CommitSha, apg: APGResult, metadata: SnapshotMetadata): Promise<DomainResult<void>>;
  loadSnapshot(commitSha: CommitSha): Promise<DomainResult<Snapshot | null>>;
  listSnapshots(): Promise<DomainResult<readonly SnapshotSummary[]>>;
  getLatestSnapshot(): Promise<DomainResult<Snapshot | null>>;
}
