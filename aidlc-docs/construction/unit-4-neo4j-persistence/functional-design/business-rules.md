# Unit 4 — Neo4j + Persistence: Business Rules

## Layer Annotation Rules

### BR-LAYER-01: Annotation Priority
- Directory matching has highest priority, then naming, then decorator
- First match at each priority level wins (no multi-layer assignment)

### BR-LAYER-02: Directory Matching
- Each layer's `directories[]` globs are evaluated via picomatch against normalized file paths
- Globs are case-sensitive on Linux, case-insensitive on macOS/Windows (follow OS default)
- A file matching multiple layers at directory level → first declared layer wins (spec order)

### BR-LAYER-03: Naming Matching
- Layer roles define expected naming patterns (e.g., role "entity" → `*Entity`, role "use-case" → `*UseCase`)
- Applied to class names within the file, not the file name itself
- If a file contains multiple classes matching different layers → use majority vote, tie breaks to first declared layer

### BR-LAYER-04: Decorator Matching
- Layer's optional `decorators[]` checked against class node decorator arrays
- Exact string match (e.g., `@Controller` matches decorator `Controller`)

### BR-LAYER-05: Unmapped Files
- Files matching no rule get `layer: null`, `role: null`
- Unmapped files are excluded from layer-dependent fitness functions
- Unmapped files are included in universal metrics (orphan detection, fan-out)

### BR-LAYER-06: Layer Propagation
- Method and Function nodes inherit their containing File's layer/role
- If a File has `layer: null`, its Methods/Functions also get `layer: null`

## Neo4j Ingestion Rules

### BR-INGEST-01: Node Labels
- Every node gets label `APGNode` plus its type label (File, Class, Interface, Method, Function)
- Properties include all APGNode fields + `layer` + `role` from annotation

### BR-INGEST-02: Edge Relationships
- Edge type maps directly to Neo4j relationship type (IMPORTS, DECLARES, CONTAINS, EXTENDS, IMPLEMENTS, CONSTRUCTOR_INJECTS, CALLS)
- Edge properties include `id`, `type`, any additional properties from APGEdge

### BR-INGEST-03: UNWIND Bulk Insert
- Nodes inserted per-type: one UNWIND query per NodeType (5 queries total)
- Edges inserted per-type: one UNWIND query per EdgeType (7 queries total)
- Batch size within UNWIND: all at once (Neo4j handles memory for UNWIND)

### BR-INGEST-04: Stateless Mode
- Graph fully cleared before ingestion (`MATCH (n) DETACH DELETE n`)
- No snapshot persistence in stateless mode
- No delta computation in stateless mode

### BR-INGEST-05: Persistent Mode
- Graph cleared before ingestion (same as stateless)
- Snapshot saved after successful ingestion
- Delta computed if previous snapshot exists
- Drift detection runs if delta was computed

### BR-INGEST-06: Idempotent Node IDs
- APG node IDs are deterministic (from U2 SHA-256 generation)
- UNWIND uses MERGE instead of CREATE for idempotency when in persistent mode
- CREATE used in stateless mode (graph was cleared)

### BR-INGEST-07: GraphStats
- `nodeCount` = total nodes created in Neo4j (verified by `MATCH (n) RETURN count(n)`)
- `edgeCount` = total relationships (verified by `MATCH ()-[r]->() RETURN count(r)`)
- `layerCoverage` = mapped nodes / total file nodes (0.0 to 1.0)

## Snapshot Rules

### BR-SNAP-01: Directory Naming
- Snapshot dir: `{apgStorePath}/snapshot_{commitSha}/`
- Delta dir: `{apgStorePath}/delta_{fromSha}_{toSha}/`
- Drift report: `{apgStorePath}/drift_report_{commitSha}.json`
- `apgStorePath` defaults to `./APG_Store` relative to project root

### BR-SNAP-02: Metadata
- `metadata.json` must include: commitSha, timestamp (ISO 8601), projectPath, nodeCount, edgeCount
- Timestamp is ingestion time, not commit time

### BR-SNAP-03: Snapshot Overwrite
- If snapshot directory already exists for same commitSha → overwrite with warning (INGEST_005)
- Previous snapshot data is lost (no versioning within same commit)

### BR-SNAP-04: Snapshot Listing
- List ordered by timestamp descending (newest first)
- Return SnapshotSummary[] (commitSha, timestamp, nodeCount, edgeCount)

## Delta APG Rules

### BR-DELTA-01: Node Comparison
- Compare by node `id` (deterministic from U2)
- Added = present in current, absent in previous
- Removed = present in previous, absent in current
- Property changes not tracked in v1 (node ID changes if path/name changes)

### BR-DELTA-02: Edge Comparison
- Compare by edge `id` (deterministic from U2)
- Same added/removed logic as nodes

### BR-DELTA-03: Delta Storage
- `added_nodes.json`, `removed_nodes.json` = full APGNode objects
- `added_edges.json`, `removed_edges.json` = full APGEdge objects

### BR-DELTA-04: No Previous Snapshot
- If no previous snapshot exists → skip delta computation
- Emit INGEST_004 warning
- IngestionResult.deltaStats = undefined

## Drift Detection Rules

### BR-DRIFT-01: Structural Drift
- New cross-layer IMPORTS edges not in previous snapshot
- Grouped by `{sourceLayer} → {targetLayer}` pair
- Each pair reports: edge count, example file paths (up to 5)

### BR-DRIFT-02: Coupling Drift
- Compute average fan-out per layer: `sum(outgoing edges per file) / file count`
- Report percentage change: `(current - previous) / previous * 100`
- Flag layers exceeding threshold (default 15%)
- Top 5 contributors: files with largest absolute fan-out increase

### BR-DRIFT-03: Convention Drift
- Compute convention compliance per layer: `files matching naming pattern / total files in layer`
- Report percentage delta
- List newly non-compliant files (compliant in previous, non-compliant in current)

### BR-DRIFT-04: Violation Trend
- Requires 3+ snapshots for trend analysis
- If < 3 snapshots → emit DRIFT_001, report "insufficient_data"
- Trend = linear regression on AVR scores across snapshots
- Direction: "improving" (negative slope), "stable" (slope near 0), "degrading" (positive slope)

### BR-DRIFT-05: Drift Alerts
- Each drift metric checked against configurable thresholds
- Default thresholds: structural (any new cross-layer dep), coupling (15%), convention (5% drop)
- Exceeded threshold → `DriftAlert` with severity, metric name, actual value, threshold

### BR-DRIFT-06: Drift Report
- Contains all 4 drift metrics + alerts array
- `from` and `to` commit SHAs
- Timestamp of report generation
- Saved as JSON to APG_Store
