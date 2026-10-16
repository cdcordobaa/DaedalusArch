# Warm in-process latency, one symbolic evaluation (scripts/v1.3/cypher-interp-bench.ts --n 8)

2026-10-15, this container (Linux, Node 22.22.0), Neo4j 5.26.24 Community + APOC on 127.0.0.1:7687 in the same container.
First run = cold (module load, ANTLR prediction warm-up, ts-morph); warm = median of the next 7 runs in the same process.

| variant | engine | first | warm median | extract+parse-spec | ingest-apg | evaluate-symbolic | compute-scores |
|---|---|---:|---:|---:|---:|---:|---:|
| clean-architecture/clean | cypher-interp | 765 ms | 149 ms | 146 | 6 | 11 | 4 |
| clean-architecture/clean | neo4j | 1285 ms | 728 ms | 127 | 513 | 31 | 58 |
| ddd/clean | cypher-interp | 1119 ms | 321 ms | 303 | 5 | 9 | 6 |
| ddd/clean | neo4j | 1039 ms | 866 ms | 286 | 513 | 15 | 56 |
