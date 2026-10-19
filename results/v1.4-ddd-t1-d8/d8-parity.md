# D8: cypher-interp vs Neo4j 5.26.24 on the TIER-A3 snapshots

Neo4j `results/v1.4-ddd-t1-d8/neo4j`, interpreter `results/v1.4-ddd-b2-v9/cypher-interp`. T1 rows identical 124/124; drift rows identical 30/30; Neo4j evaluation errors 0.

| subject | reports | whole result identical | violations identical | rule rows (with findings) | counts agree | identities agree | file sets agree | violations neo4j / interp |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| ddd | 64 | 64 | 64 | 180 (180) | 180 | 180 | 180 | 292 / 292 |
| layered | 28 | 28 | 28 | 116 (116) | 116 | 116 | 116 | 512 / 512 |
| loop-static | 32 | 32 | 32 | 110 (110) | 110 | 110 | 110 | 406 / 406 |

## Per rule

| subject | rule | reports with the rule | violations neo4j / interp | file sets agree | identities agree |
|---|---|---:|---|---:|---:|
| ddd | FF-DS01 | 64 | 64 / 64 | 64 | 64 |
| ddd | FF-DS02 | 48 | 96 / 96 | 48 | 48 |
| ddd | FF-DT06 | 64 | 128 / 128 | 64 | 64 |
| ddd | FF-S02 | 4 | 4 / 4 | 4 | 4 |
| layered | FF-C03 | 28 | 40 / 40 | 28 | 28 |
| layered | FF-CV03 | 4 | 4 / 4 | 4 | 4 |
| layered | FF-CV05 | 28 | 276 / 276 | 28 | 28 |
| layered | FF-S01 | 28 | 62 / 62 | 28 | 28 |
| layered | FF-S03 | 28 | 130 / 130 | 28 | 28 |
| loop-static | FF-C03 | 18 | 20 / 20 | 18 | 18 |
| loop-static | FF-CV05 | 32 | 320 / 320 | 32 | 32 |
| loop-static | FF-P02 | 4 | 4 / 4 | 4 | 4 |
| loop-static | FF-S03 | 8 | 8 / 8 | 8 | 8 |
| loop-static | FF-SO01 | 30 | 36 / 36 | 30 | 30 |
| loop-static | FF-SO02 | 18 | 18 / 18 | 18 | 18 |
