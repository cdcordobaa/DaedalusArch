# Reference set: cypher-interp vs Neo4j 5.26.24, field by field

Runs: `results/v1.3-cypher-interp/neo4j-control` (Neo4j) and `results/v1.3-cypher-interp/ue-baseline-live` (cypher-interp), both `ue-baseline-live --keep-cli`; reference `results/v1.3-reference/after-member-facts`.

| check | identical |
|---|---:|
| bytes: raw/ + report.json + report.md, interp vs Neo4j | 73/73 |
| bytes: interp vs committed reference | 73/73 |
| bytes: Neo4j rerun vs committed reference | 73/73 |
| evidence violations, every column (elapsedMs aside) | 71/71 |
| CLI result: ahsDeterministic | 71/71 |
| CLI result: verdict | 71/71 |
| CLI result: blockingAhs | 71/71 |
| CLI result: perDimensionScores | 71/71 |
| CLI result: universalMetrics | 71/71 |
| CLI result: tiers | 71/71 |
| CLI result: functionExecution | 71/71 |
| CLI result: functionResults | 71/71 |
| CLI result: graphStats | 71/71 |
| CLI result: violations | 71/71 |
| CLI result: warnings | 71/71 |
| CLI result: whole result | 71/71 |

CLI result = the whole `firewall evaluate --format json` output without `runId`, `durationMs`, `executionTimeMs`, `timings` (run-volatile) and with the temporary project path replaced by `<project>`.
