# Unit 4 — Neo4j + Persistence: Design Questions

## Q1: Neo4j Transaction Strategy

Ingesting a full APG into Neo4j involves creating many nodes + edges. Options:

**A) Single transaction** — All nodes and edges in one `session.writeTransaction()`. Atomic (all-or-nothing). Simple. But may hit memory limits on very large projects (10k+ nodes).

**B) Batched transactions** — Chunk nodes/edges into batches (e.g., 500 per transaction). More resilient for large graphs. Need to handle partial failure (rollback all batches on error, or mark ingestion as partial).

**C) UNWIND-based bulk insert** — Use Neo4j `UNWIND $batch` Cypher pattern to bulk-insert in a single query per entity type. Fast, idiomatic Neo4j, fewer round-trips. Combines the atomicity of single-transaction with the performance of batching.

[Answer]:

---

## Q2: Layer Annotation Matching

The AoC spec defines layers with directories (globs), roles, and optional decorators. Annotation priority: directory > naming > decorator. How to match?

**A) Glob matching on normalized filePath** — For each node, iterate layers in priority order. First glob match wins. `minimatch` or `picomatch` for glob evaluation. Naming = regex on class name. Decorators = exact match from node properties.

**B) Neo4j-side annotation** — After ingestion, run Cypher queries to SET layer/role on nodes. E.g., `MATCH (f:File) WHERE f.filePath =~ $dirPattern SET f.layer = $layerName`. Keeps annotation logic in Cypher, but glob-to-regex conversion is needed.

**C) Hybrid** — Directory matching on the TypeScript side (before ingestion, as node properties), naming + decorator matching via Cypher after ingestion. Each phase in its natural environment.

[Answer]:

---

## Q3: Delta APG Scope

US-3.2 requires incremental updates. How to determine "changed files"?

**A) Git diff** — Run `git diff --name-only <prevCommitSha>..HEAD` to get changed files. Re-extract APG only for those files. Merge delta nodes/edges into existing graph. Fast, accurate, but requires git access.

**B) APG comparison** — Compare new full APG against previous snapshot's APG. Diff node sets (by ID) and edge sets. No git dependency, works for any source. Slightly more work but simpler contract.

**C) Hash-based** — Each node/edge has a content hash. Compare hashes between runs. Only update changed entries. Very granular but adds hash computation overhead.

[Answer]:

---

## Q4: Snapshot Storage Backend

Snapshots can be stored in:

**A) Filesystem only** — `APG_Store/snapshot_{sha}/` with `nodes.json`, `edges.json`, `metadata.json`, `drift_report.json`. Simple, portable, no extra infra. Neo4j is ephemeral (cleared/reloaded each run). Snapshots are the persistent record.

**B) Neo4j + Filesystem** — Graph data stays in Neo4j (labeled by snapshot version). Metadata + drift on filesystem. Allows cross-snapshot Cypher queries. But increases Neo4j storage and complexity.

**C) Filesystem with SQLite index** — JSON files for data, SQLite for metadata/querying snapshot history. More structured than pure filesystem, but adds a dependency.

[Answer]:

---

## Q5: Drift Detection Granularity

US-3.4–3.6 define 4 drift types. How granular should detection be?

**A) Summary-level only** — Compare aggregate metrics between snapshots (total edges, avg fan-out, % convention compliance, AVR score). Simple deltas. Enough for CI/CD alerts.

**B) Component-level** — Break down drift per module/layer. E.g., "fan-out in infrastructure layer grew 20%". More actionable but requires layer-level aggregation.

**C) File-level** — Track drift per file. "auth/UserService.ts added 3 new cross-module dependencies." Most granular, most useful in PR comments, but expensive to compute and store.

[Answer]:
