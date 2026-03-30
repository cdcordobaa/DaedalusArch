export { Neo4jIngestionStage, ingestAPG } from './neo4j-ingestion.js';
export { Neo4jRepository } from './neo4j-repository.js';
export { FileSystemSnapshotStore } from './fs-snapshot-store.js';
export { annotateNodes, buildLayerMappings } from './layer-annotator.js';
export { computeDelta, computeDeltaStats } from './delta-computer.js';
export { detectDrift, detectStructuralDrift, detectCouplingDrift, detectConventionDrift, detectViolationTrend } from './drift-detector.js';
export type {
  IngestionInput, IngestionConfig, IngestionError, IngestionErrorCode,
  LayerAnnotation, LayerMapping, IngestionWarningCode,
} from './types.js';
export { DEFAULT_DRIFT_THRESHOLDS, DEFAULT_INGESTION_CONFIG } from './types.js';
