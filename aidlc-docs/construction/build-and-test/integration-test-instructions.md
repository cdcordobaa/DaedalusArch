# Integration Test Instructions — DaedalusArch

## Purpose

Validate that modules work together correctly through the full pipeline, with real Neo4j graph database interactions.

## Prerequisites

- Neo4j running: `docker-compose up -d`
- Environment configured: `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`
- Fixture projects available in `fixtures/`
- Sample spec available in `specs/clean-arch.yaml`

## Run Integration Tests

```bash
npm run test:integration
```

**Expected**: 2 integration suites pass.

## Existing Integration Tests

### Scenario 1: APG Extractor → Fixture Projects

**File**: `tests/integration/apg-extractor/fixture-extraction.test.ts`

**What it tests**:
- Extract APG from each fixture project in `fixtures/`
- Verify node counts match expected values per project
- Verify edge types are within the 7 permitted types
- Verify parse coverage >= 90% for clean reference projects
- Cross-reference against fixture MANIFEST.md expected values

**Setup**: No special setup — reads fixture projects from filesystem.

### Scenario 2: Spec Parser → Full Pipeline Parse

**File**: `tests/integration/spec-parser/full-pipeline.test.ts`

**What it tests**:
- Parse `specs/clean-arch.yaml` end-to-end
- Resolve built-in clean-architecture template
- Validate all layer definitions
- Compile fitness functions from parsed output
- Verify Cypher query generation for all 7 dimensions

**Setup**: No special setup — reads spec files from filesystem.

## Recommended Additional Integration Tests

The following integration test scenarios should be added to achieve full pipeline validation:

### Scenario 3: APG → Neo4j Ingestion (requires Neo4j)

```bash
# Create: tests/integration/neo4j-ingestion/ingest-and-query.test.ts
```

**Steps**:
1. Extract APG from a clean fixture project
2. Ingest APG into Neo4j (`ingestAPG()`)
3. Verify nodes created in graph (`MATCH (n) RETURN count(n)`)
4. Verify layer annotations applied
5. Verify relationships match expected edge count
6. Clear graph after test

### Scenario 4: Full Symbolic Pipeline (requires Neo4j)

```bash
# Create: tests/integration/pipeline/symbolic-pipeline.test.ts
```

**Steps**:
1. Extract APG from `fixtures/correct-reference/`
2. Parse `specs/clean-arch.yaml`
3. Ingest into Neo4j
4. Compile fitness functions
5. Run symbolic evaluation
6. Compute scores
7. Verify: AHS >= 0.90 for clean project, verdict = "pass"

### Scenario 5: Violation Detection (requires Neo4j)

```bash
# Create: tests/integration/pipeline/violation-detection.test.ts
```

**Steps**:
1. Extract APG from a seeded-violation fixture
2. Parse spec, ingest, compile, evaluate (symbolic)
3. Score results
4. Verify: violations detected match MANIFEST.md entries
5. Verify: AHS < 0.90 for violated project
6. Verify: verdict = "soft-block" or "hard-block"

### Scenario 6: CLI End-to-End

```bash
# Create: tests/integration/cli/evaluate-command.test.ts
```

**Steps**:
1. Spawn `firewall evaluate --project fixtures/correct-reference --spec specs/clean-arch.yaml --format json --symbolic-only`
2. Capture stdout (JSON report)
3. Verify exit code = 0
4. Parse JSON, verify AHS field exists and is numeric
5. Verify verdict = "pass"

### Scenario 7: Batch Evaluation

```bash
# Create: tests/integration/cli/batch-command.test.ts
```

**Steps**:
1. Spawn `firewall batch --dir fixtures --spec specs/clean-arch.yaml --format csv --symbolic-only`
2. Capture stdout (CSV)
3. Verify CSV header row
4. Verify one row per fixture project
5. Verify exit code based on aggregate results

### Scenario 8: Snapshot and Drift

```bash
# Create: tests/integration/pipeline/drift-detection.test.ts
```

**Steps**:
1. Extract + ingest fixture project A, save snapshot
2. Extract + ingest modified fixture project A', save snapshot
3. Compute delta between snapshots
4. Run drift detection
5. Verify structural drift detected (added/removed nodes)

## Integration Test Environment Setup

```bash
# Start Neo4j
docker-compose up -d

# Wait for readiness (up to 60s)
for i in $(seq 1 12); do
  curl -sf http://localhost:7474 > /dev/null && break
  echo "Waiting for Neo4j... ($i/12)"
  sleep 5
done

# Set environment
export NEO4J_URI=bolt://localhost:7687
export NEO4J_USER=neo4j
export NEO4J_PASSWORD=test-password
export EVALUATION_MODE=symbolic-only
export PIPELINE_MODE=stateless

# Run integration tests
npm run test:integration

# Cleanup
docker-compose down
```

## CI Integration

The GitHub Actions CI workflow (`.github/workflows/ci.yml`) already includes:
- Neo4j 5.26-community service container with APOC
- Integration test step with correct env vars
- Symbolic-only mode for CI speed
