import type { APGResult } from '../shared/types/apg.js';
import type { LayerModel } from '../shared/types/spec.js';
import type { CommitSha } from '../shared/types/value-objects.js';
import type { PipelineMode } from '../shared/types/enums.js';
import type { PipelineError } from '../shared/errors/domain-result.js';
import type { DriftThresholds } from '../shared/types/drift.js';

// ── Ingestion Input ───────────────────────────────────────────────────────────

export interface IngestionInput {
  readonly apgResult: APGResult;
  readonly layerModel: LayerModel;
  readonly mode: PipelineMode;
  readonly commitSha?: CommitSha;
  readonly apgStorePath?: string;
  readonly driftThresholds?: DriftThresholds;
}

export interface IngestionConfig {
  readonly neo4jUri: string;
  readonly neo4jUser: string;
  readonly neo4jPassword: string;
  readonly apgStorePath: string;
}

export const DEFAULT_INGESTION_CONFIG: IngestionConfig = {
  neo4jUri: 'bolt://localhost:7687',
  neo4jUser: 'neo4j',
  neo4jPassword: 'password',
  apgStorePath: './APG_Store',
};

// ── Layer Annotation ──────────────────────────────────────────────────────────

export interface LayerAnnotation {
  readonly layer: string | null;
  readonly role: string | null;
  readonly matchMethod: 'directory' | 'filename' | 'naming' | 'decorator' | null;
}

export interface LayerMapping {
  readonly layerName: string;
  readonly directories: readonly string[];
  readonly roles: readonly string[];
  readonly decorators: readonly string[];
  readonly filePatterns: readonly string[];
}

// ── Error Types ───────────────────────────────────────────────────────────────

export type IngestionErrorCode =
  | 'NEO4J_CONNECTION_FAILED'
  | 'NEO4J_QUERY_FAILED'
  | 'INGESTION_FAILED'
  | 'SNAPSHOT_WRITE_FAILED'
  | 'SNAPSHOT_READ_FAILED'
  | 'APG_STORE_NOT_WRITABLE';

export interface IngestionError extends PipelineError {
  readonly code: IngestionErrorCode;
  readonly stage: 'neo4j-ingestion';
  readonly critical: true;
}

export type IngestionWarningCode =
  | 'INGEST_001' | 'INGEST_002' | 'INGEST_003'
  | 'INGEST_004' | 'INGEST_005'
  | 'DRIFT_001' | 'DRIFT_002';

// ── Defaults ──────────────────────────────────────────────────────────────────

export const DEFAULT_DRIFT_THRESHOLDS: DriftThresholds = {
  maxCouplingDriftPercent: 15,
  maxConventionDropPercent: 5,
  structuralAnyNewCrossLayer: true,
};
