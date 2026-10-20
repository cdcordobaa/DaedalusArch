# Reference set: cypher-interp vs Neo4j 5.26.24, field by field

Runs: `results/v1.3-reference/after-construct-answers` (Neo4j) and `results/v1.3-reference/after-construct-answers-crosscheck-cypher-interp` (cypher-interp), both `ue-baseline-live --keep-cli`; reference `results/v1.3-reference/after-member-facts`.

| check | identical |
|---|---:|
| bytes: raw/ + report.json + report.md, interp vs Neo4j | 73/73 |
| bytes: interp vs committed reference | 57/73 |
| bytes: Neo4j rerun vs committed reference | 57/73 |
| evidence violations, every column (elapsedMs aside) | 71/71 |
| CLI result: ahsDeterministic | 0/0 |
| CLI result: verdict | 0/0 |
| CLI result: blockingAhs | 0/0 |
| CLI result: perDimensionScores | 0/0 |
| CLI result: universalMetrics | 0/0 |
| CLI result: tiers | 0/0 |
| CLI result: functionExecution | 0/0 |
| CLI result: functionResults | 0/0 |
| CLI result: graphStats | 0/0 |
| CLI result: violations | 0/0 |
| CLI result: warnings | 0/0 |
| CLI result: whole result | 0/0 |

CLI result = the whole `firewall evaluate --format json` output without `runId`, `durationMs`, `executionTimeMs`, `timings` (run-volatile) and with the temporary project path replaced by `<project>`.
