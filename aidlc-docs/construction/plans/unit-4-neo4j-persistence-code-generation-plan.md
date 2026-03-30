# Unit 4 — Neo4j + Persistence: Code Generation Plan

## Pre-Requisites
- U1 shared types: GraphRepository, SnapshotStore, IngestionResult, DeltaStats, etc.
- U2 APGResult with deterministic node/edge IDs
- U3 ParsedSpec with LayerModel for annotation
- Dependencies installed: neo4j-driver, picomatch

## Type Alignment Note
U1's `SnapshotStore` interface needs extension for delta/drift operations. U1's `evaluation.ts` has `IngestionResult` but missing drift report field. Strategy: extend shared types, then build U4 implementations.

## Steps

### Step 1: Extend shared types for U4 needs
- [x] Add drift types to shared types (new file `src/shared/types/drift.ts`)
- [x] Add `DriftReport` field to `IngestionResult` in evaluation.ts
- [x] Extend `SnapshotStore` with `saveDelta()`, `saveDriftReport()`, `loadDelta()` methods
- [x] Export new types from shared/index.ts
- [x] Run typecheck

### Step 2: Create neo4j-ingestion types (`src/neo4j-ingestion/types.ts`)
- [x] `IngestionInput`, `IngestionConfig`
- [x] `LayerAnnotation`, `AnnotatedNode`, `LayerMapping`
- [x] `DeltaAPG`
- [x] `IngestionErrorCode`, `IngestionError`, `IngestionWarningCode`
- [x] `DriftThresholds`, `DEFAULT_DRIFT_THRESHOLDS`

### Step 3: Create layer annotator (`src/neo4j-ingestion/layer-annotator.ts`)
- [x] `annotateNodes(nodes, layerModel)` → `{ annotated, summary }`
- [x] `matchDirectory(filePath, layer)` — picomatch glob matching
- [x] `matchNaming(node, layer)` — role-based regex
- [x] `matchDecorator(node, layer)` — exact decorator match
- [x] `buildLayerMappings(layerModel)` → `LayerMapping[]`

### Step 4: Create Neo4j repository implementation (`src/neo4j-ingestion/neo4j-repository.ts`)
- [x] `Neo4jRepository` implementing `GraphRepository`
- [x] Constructor with URI/auth, driver creation
- [x] `executeQuery()`, `clearGraph()`, `healthCheck()`, `close()`
- [x] Session-per-query pattern with proper cleanup

### Step 5: Create graph ingester (`src/neo4j-ingestion/graph-ingester.ts`)
- [x] `ingestNodes(nodes, graphRepo)` — UNWIND bulk insert per node type
- [x] `ingestEdges(edges, graphRepo)` — UNWIND bulk insert per edge type
- [x] `verifyIngestion(graphRepo)` → `GraphStats`
- [x] UNWIND Cypher query builders

### Step 6: Create filesystem snapshot store (`src/neo4j-ingestion/fs-snapshot-store.ts`)
- [x] `FileSystemSnapshotStore` implementing `SnapshotStore`
- [x] `saveSnapshot()`, `loadSnapshot()`, `listSnapshots()`, `getLatestSnapshot()`
- [x] `saveDelta()`, `saveDriftReport()`, `loadDelta()`
- [x] Directory creation, JSON read/write helpers

### Step 7: Create delta computer (`src/neo4j-ingestion/delta-computer.ts`)
- [x] `computeDelta(current, previous)` → `DeltaAPG`
- [x] `computeDeltaStats(delta)` → `DeltaStats`
- [x] Node/edge set comparison by ID

### Step 8: Create drift detector (`src/neo4j-ingestion/drift-detector.ts`)
- [x] `detectDrift(current, previous, delta, history?, thresholds?)` → `DriftReport`
- [x] `detectStructuralDrift(delta, currentNodes, previousNodes)` → `StructuralDriftMetric`
- [x] `detectCouplingDrift(currentEdges, previousEdges, currentNodes, previousNodes)` → `CouplingDriftMetric`
- [x] `detectConventionDrift(currentNodes, previousNodes)` → `ConventionDriftMetric`
- [x] `detectViolationTrend(history)` → `ViolationTrendMetric`
- [x] `generateAlerts(report, thresholds)` → `DriftAlert[]`

### Step 9: Create main orchestrator (`src/neo4j-ingestion/neo4j-ingestion.ts`)
- [x] `ingestAPG(input, graphRepo, snapshotStore)` → `DomainResult<IngestionResult>`
- [x] `Neo4jIngestionStage` implementing `PipelineStage<IngestionInput, IngestionResult>`
- [x] Full lifecycle: annotate → clear → ingest → verify → snapshot → delta → drift

### Step 10: Update neo4j-ingestion index (`src/neo4j-ingestion/index.ts`)
- [x] Export public API

### Step 11: Unit tests — layer annotator
- [x] Test directory matching (glob patterns, nested dirs, no match)
- [x] Test annotation priority (directory > naming > decorator)
- [x] Test unmapped files (layer: null)
- [x] Test layer propagation to methods/functions

### Step 12: Unit tests — graph ingester (mocked Neo4j)
- [x] Test UNWIND query generation per node type
- [x] Test UNWIND query generation per edge type
- [x] Test stateless mode (clear before ingest)
- [x] Test GraphStats verification queries

### Step 13: Unit tests — filesystem snapshot store
- [x] Test saveSnapshot/loadSnapshot round-trip
- [x] Test listSnapshots ordering
- [x] Test getLatestSnapshot
- [x] Test saveDelta/saveDriftReport

### Step 14: Unit tests — delta computer
- [x] Test added/removed node detection
- [x] Test added/removed edge detection
- [x] Test identical APGs (empty delta)
- [x] Test DeltaStats computation

### Step 15: Unit tests — drift detector
- [x] Test structural drift (new cross-layer deps)
- [x] Test coupling drift (fan-out increase per layer)
- [x] Test convention drift (compliance decrease)
- [x] Test violation trend (improving/stable/degrading/insufficient)
- [x] Test alert generation against thresholds

### Step 16: Unit tests — main orchestrator
- [x] Test full ingestAPG() stateless mode
- [x] Test full ingestAPG() persistent mode with snapshot
- [x] Test PipelineStage integration with FirewallContext
- [x] Test error handling (Neo4j connection failure)

### Step 17: TypeCheck + full test run
- [x] `npm run typecheck` — 0 errors
- [x] `npm run test:unit` — all passing

## Story Traceability
| Story | Coverage |
|-------|----------|
| US-2.1 | Steps 5, 9 (APG ingestion into Neo4j) |
| US-2.2 | Step 3 (layer annotation with directory/naming/decorator priority) |
| US-2.3 | Step 3 (unmapped files → layer: null) |
| US-2.4 | Steps 5, 9 (stateless mode — clear graph before ingestion) |
| US-3.1 | Step 6 (versioned snapshots tied to commit SHA) |
| US-3.2 | Step 7 (delta APG computation) |
| US-3.3 | Step 6 (snapshot storage model — nodes.json, edges.json, metadata.json) |
| US-3.4 | Step 8 (structural drift detection) |
| US-3.5 | Step 8 (coupling drift detection) |
| US-3.6 | Step 8 (convention + violation trend drift) |
| US-3.7 | Step 8 (drift report between snapshots) |
| US-3.8 | Step 8 (drift threshold alerts) |
