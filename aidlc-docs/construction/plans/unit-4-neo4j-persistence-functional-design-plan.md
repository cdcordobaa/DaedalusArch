# Unit 4 — Neo4j + Persistence: Functional Design Plan

## Stage Assessment

| Stage | Decision | Rationale |
|-------|----------|-----------|
| Functional Design | **EXECUTE** | Complex Neo4j ingestion, layer annotation algorithm, delta APG, 4 drift types, snapshot model |
| NFR Requirements | SKIP | Performance (delta < 2s) is a story acceptance criterion, not separate NFR |
| NFR Design | SKIP | N/A |
| Infrastructure Design | SKIP | Neo4j driver + filesystem — interfaces already in U1 |
| Code Generation | **ALWAYS** | — |

## Unit Context

- **Components**: C2 (Neo4j Ingestion), S2 (GraphRepositoryService), S3 (SnapshotService)
- **Stories**: 12 total (US-2.1–2.4, US-3.1–3.8) — 10 Must, 2 Should
- **Dependencies**: U1 (shared types, GraphRepository, SnapshotStore interfaces), U2 (APGResult), U3 (ParsedSpec layer mappings)
- **Depended by**: U5 (queries Neo4j graph), U6 (snapshot data for reports)
- **Existing stub**: `src/neo4j-ingestion/index.ts`

## Plan Steps

- [x] Step 1: Analyze unit context
- [x] Step 2: Create functional design plan (this document)
- [x] Step 3: Generate design questions
- [x] Step 4: Collect and analyze answers (AI defaults — user deferred)
- [x] Step 5: Generate business-logic-model.md
- [x] Step 6: Generate business-rules.md
- [x] Step 7: Generate domain-entities.md
- [x] Step 8: Present completion message and await approval — APPROVED
