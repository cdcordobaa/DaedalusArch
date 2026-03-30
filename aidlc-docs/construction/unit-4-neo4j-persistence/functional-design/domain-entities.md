# Unit 4 — Neo4j + Persistence: Domain Entities

## Shared Types (from U1 — no redefinition)

Used directly from `src/shared/`:
- `APGResult`, `APGNode`, `APGEdge`, `ParseCoverage` (types/apg.ts)
- `IngestionResult`, `GraphStats`, `LayerAnnotationSummary`, `DeltaStats` (types/evaluation.ts)
- `ParsedSpec`, `LayerModel`, `LayerDefinition` (types/spec.ts)
- `DomainResult<T>`, `PipelineError`, `PipelineWarning` (errors/domain-result.ts)
- `GraphRepository`, `QueryResult` (interfaces/graph-repository.ts)
- `SnapshotStore`, `SnapshotMetadata`, `Snapshot`, `SnapshotSummary` (interfaces/snapshot-store.ts)
- `PipelineStage<I, O>` (interfaces/pipeline-stage.ts)
- `FirewallContext` (context/firewall-context.ts)
- `CommitSha`, `RunId` (types/value-objects.ts)
- `PipelineMode` (types/enums.ts)

## New Public Types

### Ingestion Input/Config

```typescript
interface IngestionInput {
  readonly apgResult: APGResult;
  readonly layerModel: LayerModel;
  readonly mode: PipelineMode;           // 'stateless' | 'persistent'
  readonly commitSha?: CommitSha;        // required for persistent mode
  readonly apgStorePath?: string;        // default: './APG_Store'
}

interface IngestionConfig {
  readonly neo4jUri: string;              // default: bolt://localhost:7687
  readonly neo4jUser: string;             // default: neo4j
  readonly neo4jPassword: string;
  readonly apgStorePath: string;          // default: ./APG_Store
}
```

### Layer Annotation Types

```typescript
interface LayerAnnotation {
  readonly layer: string | null;
  readonly role: string | null;
  readonly matchMethod: 'directory' | 'naming' | 'decorator' | null;
}

interface AnnotatedNode extends APGNode {
  readonly layer: string | null;
  readonly role: string | null;
}

interface LayerMapping {
  readonly layerName: string;
  readonly directories: readonly string[];  // glob patterns
  readonly roles: readonly string[];
  readonly decorators: readonly string[];
}
```

### Delta Types

```typescript
interface DeltaAPG {
  readonly addedNodes: readonly APGNode[];
  readonly removedNodes: readonly APGNode[];
  readonly addedEdges: readonly APGEdge[];
  readonly removedEdges: readonly APGEdge[];
}

// DeltaStats already exists in evaluation.ts:
// { addedNodes, removedNodes, addedEdges, removedEdges } (counts)
```

### Drift Detection Types

```typescript
interface DriftReport {
  readonly from: string;                  // commit SHA
  readonly to: string;
  readonly timestamp: string;
  readonly structural: StructuralDriftMetric;
  readonly coupling: CouplingDriftMetric;
  readonly convention: ConventionDriftMetric;
  readonly violationTrend: ViolationTrendMetric;
  readonly alerts: readonly DriftAlert[];
}

interface StructuralDriftMetric {
  readonly newCrossLayerDeps: readonly CrossLayerDep[];
  readonly removedCrossLayerDeps: readonly CrossLayerDep[];
  readonly totalNewEdges: number;
  readonly totalRemovedEdges: number;
}

interface CrossLayerDep {
  readonly sourceLayer: string;
  readonly targetLayer: string;
  readonly count: number;
  readonly examples: readonly string[];   // up to 5 file paths
}

interface CouplingDriftMetric {
  readonly perLayer: readonly LayerCouplingDelta[];
  readonly overallFanOutDelta: number;     // percentage
  readonly topContributors: readonly FanOutContributor[];
}

interface LayerCouplingDelta {
  readonly layer: string;
  readonly previousAvgFanOut: number;
  readonly currentAvgFanOut: number;
  readonly deltaPercent: number;
  readonly exceedsThreshold: boolean;
}

interface FanOutContributor {
  readonly filePath: string;
  readonly previousFanOut: number;
  readonly currentFanOut: number;
  readonly delta: number;
}

interface ConventionDriftMetric {
  readonly perLayer: readonly LayerConventionDelta[];
  readonly newlyNonCompliant: readonly string[];  // file paths
}

interface LayerConventionDelta {
  readonly layer: string;
  readonly previousCompliance: number;     // 0–1
  readonly currentCompliance: number;
  readonly deltaPercent: number;
}

type ViolationTrendDirection = 'improving' | 'stable' | 'degrading' | 'insufficient_data';

interface ViolationTrendMetric {
  readonly direction: ViolationTrendDirection;
  readonly dataPoints: number;             // how many snapshots
  readonly slope: number;                  // linear regression slope
  readonly recentScores: readonly number[]; // last N AVR scores
}

interface DriftAlert {
  readonly metric: 'structural' | 'coupling' | 'convention' | 'violation_trend';
  readonly severity: 'critical' | 'warning';
  readonly message: string;
  readonly actualValue: number;
  readonly threshold: number;
}

interface DriftThresholds {
  readonly maxCouplingDriftPercent: number;   // default: 15
  readonly maxConventionDropPercent: number;  // default: 5
  readonly structuralAnyNewCrossLayer: boolean; // default: true
}

const DEFAULT_DRIFT_THRESHOLDS: DriftThresholds = {
  maxCouplingDriftPercent: 15,
  maxConventionDropPercent: 5,
  structuralAnyNewCrossLayer: true,
};
```

### Error Types

```typescript
type IngestionErrorCode =
  | 'NEO4J_CONNECTION_FAILED'
  | 'NEO4J_QUERY_FAILED'
  | 'INGESTION_FAILED'
  | 'SNAPSHOT_WRITE_FAILED'
  | 'SNAPSHOT_READ_FAILED'
  | 'APG_STORE_NOT_WRITABLE';

interface IngestionError extends PipelineError {
  readonly code: IngestionErrorCode;
  readonly stage: 'neo4j-ingestion';
  readonly critical: true;
}

type IngestionWarningCode =
  | 'INGEST_001' | 'INGEST_002' | 'INGEST_003'
  | 'INGEST_004' | 'INGEST_005'
  | 'DRIFT_001' | 'DRIFT_002';
```

## External Dependencies

- `neo4j-driver` ^5.x — Neo4j Bolt protocol driver
- `picomatch` ^4.x — Fast glob matching for layer annotation
