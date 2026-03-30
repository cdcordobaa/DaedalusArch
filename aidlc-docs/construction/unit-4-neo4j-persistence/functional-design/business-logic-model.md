# Unit 4 — Neo4j + Persistence: Business Logic Model

## 1. Ingestion Lifecycle

```
APGResult + LayerMappings ─→ [Annotate Layers] ─→ [Ingest into Neo4j] ─→ IngestionResult
                                                          │
                              ┌────────────────────────────┘
                              ▼
                   (if persistent mode)
              [Save Snapshot] ─→ [Compute Delta] ─→ [Detect Drift] ─→ DriftReport
```

### Phase 1: Layer Annotation (in-memory, before ingestion)

1. **Load layer mappings** from `ParsedSpec.layerModel.layers[]`
2. **For each File node** in APGResult:
   - Attempt directory matching: iterate layers, picomatch each layer's directory globs against `node.filePath`
   - First matching layer wins (priority 1: directory)
   - If no directory match, attempt naming match: regex against class/file names using layer roles
   - If no naming match, attempt decorator match: check class decorator list against layer decorators
   - If no match at all → `layer: null`, `role: null`
3. **Propagate layer** to child nodes: Methods and Functions inherit their parent File's layer
4. **Build LayerAnnotationSummary**: count mapped vs unmapped, collect unmapped file paths

### Phase 2: Neo4j Ingestion

1. **Mode check**: if `stateless`, clear graph first (`MATCH (n) DETACH DELETE n`)
2. **Create nodes** via UNWIND bulk insert:
   ```cypher
   UNWIND $nodes AS node
   CREATE (n:APGNode)
   SET n = node, n:{type_label}
   ```
   - One UNWIND query per node type (File, Class, Interface, Method, Function)
   - Include layer/role annotations as node properties
3. **Create edges** via UNWIND bulk insert:
   ```cypher
   UNWIND $edges AS edge
   MATCH (src:APGNode {id: edge.sourceId})
   MATCH (tgt:APGNode {id: edge.targetId})
   CREATE (src)-[r:{edge_type}]->(tgt)
   SET r = edge.properties
   ```
   - One UNWIND query per edge type
4. **Verify** ingestion: count nodes/edges, build `GraphStats`
5. **Return** `IngestionResult` with graphStats + layerAnnotationSummary

### Phase 3: Snapshot Persistence (persistent mode only)

1. **Create snapshot directory**: `APG_Store/snapshot_{commitSha}/`
2. **Write files**:
   - `nodes.json` — serialized APGNode[] with layer annotations
   - `edges.json` — serialized APGEdge[]
   - `metadata.json` — SnapshotMetadata (commitSha, timestamp, projectPath, nodeCount, edgeCount)
3. **If previous snapshot exists**, compute delta

### Phase 4: Delta APG Computation

1. **Load previous snapshot** from SnapshotStore
2. **Compare node sets** by node ID:
   - Added = in current but not in previous
   - Removed = in previous but not in current
   - Modified = same ID but different properties (name, layer, decorators)
3. **Compare edge sets** by edge ID:
   - Added/removed same logic
4. **Build DeltaStats**: addedNodes, removedNodes, addedEdges, removedEdges
5. **Save delta**: `APG_Store/delta_{fromSha}_{toSha}/` with `added_nodes.json`, `removed_nodes.json`, `added_edges.json`, `removed_edges.json`

### Phase 5: Drift Detection

Run after delta computation, comparing current snapshot against previous.

#### 5a. Structural Drift (US-3.4)
- Detect new cross-module IMPORTS edges that didn't exist in previous snapshot
- Group by source-layer → target-layer pair
- Report: `{ newCrossModuleDeps: [{from, to, count}], removedDeps: [...] }`

#### 5b. Coupling Drift (US-3.5)
- Compute avg fan-out per layer in both snapshots
- Report percentage change per layer
- Flag layers where fan-out grew > configurable threshold (default 15%)
- Identify top N contributors (files with largest fan-out increase)

#### 5c. Convention Drift (US-3.6)
- Compute % of nodes meeting naming conventions per layer in both snapshots
- Report percentage delta
- Detect new convention violations (files that were compliant, now aren't)

#### 5d. Violation Trend (US-3.6)
- Compare AVR scores across last N snapshots (if history available)
- Report trend direction (improving/stable/degrading)
- Flag sustained degradation (3+ consecutive snapshots with increasing AVR)

#### 5e. Drift Report Assembly (US-3.7)
- Combine all 4 drift metrics into `DriftReport`
- Generate drift alerts based on configurable thresholds (US-3.8)
- Save to `APG_Store/drift_report_{commitSha}.json`

## 2. GraphRepository Implementation (S2)

### Connection Management
- Neo4j driver with connection URI, auth credentials from environment
- Single driver instance, session-per-query pattern
- `executeQuery()` wraps `session.run()` with DomainResult error handling
- `clearGraph()` executes `MATCH (n) DETACH DELETE n`
- `healthCheck()` runs `RETURN 1` and checks response
- `close()` closes driver gracefully

### Query Execution Pattern
```typescript
async executeQuery(cypher, params) {
  const session = driver.session();
  try {
    const result = await session.run(cypher, params);
    return DomainResult.ok({ records: result.records, summary: result.summary });
  } catch (e) {
    return DomainResult.fromError(e);
  } finally {
    await session.close();
  }
}
```

## 3. SnapshotStore Implementation (S3)

### Filesystem Layout
```
APG_Store/
├── snapshot_{sha1}/
│   ├── nodes.json
│   ├── edges.json
│   └── metadata.json
├── snapshot_{sha2}/
│   ├── nodes.json
│   ├── edges.json
│   └── metadata.json
├── delta_{sha1}_{sha2}/
│   ├── added_nodes.json
│   ├── removed_nodes.json
│   ├── added_edges.json
│   └── removed_edges.json
└── drift_report_{sha2}.json
```

### Operations
- `saveSnapshot()` — mkdir + write 3 JSON files
- `loadSnapshot()` — read + parse 3 JSON files, return null if not found
- `listSnapshots()` — scan directory, read metadata.json from each snapshot dir
- `getLatestSnapshot()` — list all, sort by timestamp, return most recent
- `saveDelta()` — write 4 JSON files to delta directory
- `saveDriftReport()` — write single JSON file

## 4. Error Handling

### Fatal Errors
- Neo4j connection failure (driver can't connect)
- Neo4j query execution error (Cypher syntax, constraint violation)
- APG_Store base directory not writable

### Recoverable Errors
- Single node/edge creation failure in UNWIND → logged as warning, ingestion continues
- Snapshot directory already exists → overwrite with warning
- Previous snapshot not found for delta → skip delta computation, warn

### Warning Codes
| Code | Meaning |
|------|---------|
| INGEST_001 | Neo4j connection retry succeeded |
| INGEST_002 | Node creation partial failure (some nodes skipped) |
| INGEST_003 | Edge creation partial failure (some edges skipped) |
| INGEST_004 | Previous snapshot not found, delta skipped |
| INGEST_005 | Snapshot directory overwritten |
| DRIFT_001 | Insufficient history for violation trend (< 3 snapshots) |
| DRIFT_002 | Drift threshold exceeded |

## 5. PipelineStage Integration

```typescript
class Neo4jIngestionStage implements PipelineStage<IngestionInput, IngestionResult> {
  constructor(private graphRepo: GraphRepository, private snapshotStore: SnapshotStore)
  async execute(input: IngestionInput, context: FirewallContext): Promise<DomainResult<IngestionResult>>
  // On success: context.setIngestionResult(result)
}
```

### Dependencies
- `GraphRepository` injected (interface from U1)
- `SnapshotStore` injected (interface from U1)
- Consumes `context.getApgResult()` and `context.getParsedSpec().layerModel`
