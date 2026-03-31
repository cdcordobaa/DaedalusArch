# Performance Test Instructions — DaedalusArch

## Performance Requirements (from NFRs)

| Metric | Target | Mode | Story |
|--------|--------|------|-------|
| APG extraction | < 5s per project | Any | US-NFR-2 |
| Symbolic evaluation | < 5s per project | symbolic-only | US-NFR-2 |
| Full neuro-symbolic pipeline | < 30s per project | full | US-NFR-2 |
| Delta APG computation | < 2s | persistent | US-NFR-2 |
| Batch throughput | < 5s per project | symbolic-only | US-16.4 |
| Install-to-first-evaluation | < 5 minutes | Any | US-NFR-6 |
| ICC (neuronal reproducibility) | >= 0.70 | neuronal/full | US-NFR-1 |
| Detection precision | >= 90% | Any | US-NFR-3 |
| Detection recall | >= 85% | Any | US-NFR-3 |

## Setup

```bash
# Ensure Neo4j is running
docker-compose up -d

# Set environment
export NEO4J_URI=bolt://localhost:7687
export NEO4J_USER=neo4j
export NEO4J_PASSWORD=test-password
```

## Test 1: APG Extraction Performance

```bash
# Time extraction on each fixture project
time npx tsx -e "
  const { extractAPG } = require('./src/apg-extractor/index.js');
  const start = Date.now();
  extractAPG('./fixtures/correct-reference').then(r => {
    console.log('Duration:', Date.now() - start, 'ms');
    console.log('Nodes:', r.data?.nodes.length, 'Edges:', r.data?.edges.length);
  });
"
```

**Target**: < 5,000ms per project.
**Typical**: 500-2,000ms for projects under 100 files.

## Test 2: Symbolic-Only Pipeline Performance

```bash
time npx tsx src/cli/cli.ts evaluate \
  --project ./fixtures/correct-reference \
  --spec ./specs/clean-arch.yaml \
  --format json \
  --symbolic-only \
  > /dev/null
```

**Target**: < 5,000ms total (extraction + parsing + ingestion + Cypher evaluation + scoring).

## Test 3: Batch Performance

```bash
time npx tsx src/cli/cli.ts batch \
  --dir ./fixtures \
  --spec ./specs/clean-arch.yaml \
  --format csv \
  --symbolic-only
```

**Target**: < 5,000ms per project average (total time / number of projects).

## Test 4: Full Neuro-Symbolic Pipeline (requires LLM API key)

```bash
export ANTHROPIC_API_KEY=<your-key>

time npx tsx src/cli/cli.ts evaluate \
  --project ./fixtures/correct-reference \
  --spec ./specs/clean-arch.yaml \
  --format json \
  > /dev/null
```

**Target**: < 30,000ms total.
**Note**: LLM API latency is the dominant factor. Use `--verbose` to see per-stage timings.

## Test 5: Detection Accuracy (Precision / Recall)

```bash
# Run symbolic evaluation against all fixture projects
# Compare detected violations against MANIFEST.md expected violations

npx tsx src/cli/cli.ts batch \
  --dir ./fixtures \
  --spec ./specs/clean-arch.yaml \
  --format json \
  --symbolic-only \
  > accuracy-results.json
```

Then verify:
- **Clean reference projects**: AHS >= 0.90, verdict = "pass", 0 violations
- **Seeded violation projects**: violations match MANIFEST.md entries
- **Precision**: (true violations detected) / (total violations reported) >= 0.90
- **Recall**: (true violations detected) / (known violations in manifests) >= 0.85

## Test 6: Install-to-First-Evaluation (Developer Experience)

**Manual timer test** — from a clean checkout:

```bash
# Start timer
START=$(date +%s)

git clone <repository-url> /tmp/firewall-test
cd /tmp/firewall-test
npm ci
docker-compose up -d
sleep 15  # wait for Neo4j

npx tsx src/cli/cli.ts evaluate \
  --project ./fixtures/correct-reference \
  --spec ./specs/clean-arch.yaml \
  --symbolic-only

END=$(date +%s)
echo "Total: $((END - START)) seconds"

# Cleanup
docker-compose down
rm -rf /tmp/firewall-test
```

**Target**: < 300 seconds (5 minutes).

## Test 7: Neuronal Reproducibility (ICC)

```bash
# Requires LLM API key
# Run the same evaluation 5 times and compute ICC

for i in 1 2 3 4 5; do
  npx tsx src/cli/cli.ts evaluate \
    --project ./fixtures/correct-reference \
    --spec ./specs/clean-arch.yaml \
    --format json \
    > "run-$i.json"
done

# Compare AHS scores across runs
# ICC >= 0.70 means acceptable reproducibility
# Temperature=0 + fixed seed should yield ICC > 0.90
```

## Performance Optimization Guide

If targets are not met:

1. **APG extraction slow**: Check project size, enable `lenientMode` to skip unparsable files
2. **Neo4j queries slow**: Add indexes on `:APGNode(id)` and `:APGNode(layer)`, increase Java heap
3. **LLM calls slow**: Increase `maxConcurrency` in LLMConfig (default: 3), use `p-limit` throttle
4. **Batch slow**: Verify Neo4j `clearGraph()` isn't bottleneck, consider connection pool reuse between projects
5. **Scoring slow**: Universal metrics Cypher queries may need APOC optimization
