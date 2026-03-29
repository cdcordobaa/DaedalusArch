# Unit of Work Dependencies — Architectural Firewall

## Dependency Matrix

| Unit | Depends On | Depended By | Can Parallelize With |
|------|-----------|-------------|---------------------|
| U0: Infrastructure | — | All | — |
| U1: Shared Domain + Validation | U0 | U2, U3, U4, U5, U6, U7 | — |
| U2: APG Extractor | U1 | U4 | **U3** |
| U3: Spec Parser + Compiler | U1 | U4, U5 | **U2** |
| U4: Neo4j Ingestion | U1, U2, U3 | U5 | — |
| U5: Router + Eval Paths | U1, U3, U4 | U6 | — |
| U6: Scoring + Reports | U1, U5 | U7 | — |
| U7: CLI + CI/CD | U1-U6 (all) | — | — |

## Critical Path

```
U0 -> U1 -> U4 -> U5 -> U6 -> U7
              ^
         U2 --+
         U3 --+
```

**Critical path length**: 7 units (U0 -> U1 -> U2 or U3 -> U4 -> U5 -> U6 -> U7)

**Parallelization opportunity**: U2 and U3 have no dependency on each other — both depend only on U1. Building them in parallel shortens the critical path by 1 unit.

## Dependency Details

### U0 -> U1
- U1 needs project scaffolding, package.json, tsconfig, Docker Compose ready
- U1 needs `fixtures/` and `specs/` directories created

### U1 -> U2
- U2 imports domain types (APGNode, APGEdge) from C10
- U2 validates output against fixture projects from FR-17

### U1 -> U3
- U3 imports domain types (FitnessFunction, Dimension, Route, SemanticCriteria) from C10
- U3 validates parsed spec against sample `specs/clean-arch.yaml` from U1

### U2 + U3 -> U4
- U4 ingests APGResult (from C1/U2) into Neo4j
- U4 uses LayerMapping[] (from C3/U3) for layer annotation
- U4 needs both extraction and spec parsing working to do full ingestion

### U3 + U4 -> U5
- U5 receives CompiledFunctions (from C4/U3) for routing
- U5 needs graph loaded in Neo4j (from C2/U4) for evaluation
- U5 uses LLMProvider interface (from C10/U1) for neuronal path

### U5 -> U6
- U6 receives EvaluationResults (from C5/U5) for scoring
- U6 uses ScoringWeights (from C3/U3 via pipeline context)
- U6 queries Neo4j (via S2/U4) for universal metrics

### U6 -> U7
- U7 orchestrates all modules via PipelineExecutor
- U7 formats EvaluationReport (from C8/U6) for CLI output
- U7 needs all modules working for end-to-end pipeline

## Integration Test Points

| After Unit | Integration Test |
|-----------|-----------------|
| U2 | Extract APG from fixture project, verify node/edge counts match manifest |
| U3 | Parse sample spec, compile to Cypher, verify query syntax |
| U4 | Extract -> Ingest -> Query graph, verify layer annotations |
| U5 | Extract -> Ingest -> Compile -> Route -> Evaluate, verify violations detected |
| U6 | Full pipeline through scoring, verify AHS discrimination |
| U7 | `firewall evaluate` CLI end-to-end, verify exit codes and output |
