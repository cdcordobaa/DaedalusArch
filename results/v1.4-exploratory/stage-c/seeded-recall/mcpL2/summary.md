# Seeded recall on agent snapshots (development data; not a registered SO4 estimate)

k = 2 positive and 1 twin site(s) per operator per snapshot, seed 20261019; final snapshot of each trajectory; cypher-interp (in process; scoring v1.3, instrument v2, post-seal rules on). Type-check: skeleton install of scripts/generator/skeleton (package-lock.json; express, @types/express, @types/node, typescript), harness tsconfig.

| Style | Operator | Blocking key | Snapshots | Sites eligible/candidates | Applied | Compiled | Evaluated | Detected | Rate [95 % Wilson] | Twin false fires | No key |
|---|---|---|---|---|---|---|---|---|---|---|---|
| layered | MO-S01 (direction mismatch) | yes | 6 | 126/204 | 12 | 12 | 12 | 0 | 0.00 [0.00, 0.24] | 0 | 0 |
| layered | MO-S01n (direction mismatch) | – | 6 | 251/251 | 6 | 6 | 6 | 0 | n/a | 6 | 0 |
| layered | MO-P01 | yes | 6 | 188/188 | 12 | 12 | 12 | 0 | 0.00 [0.00, 0.24] | 0 | 0 |
| layered | MO-P01n | – | 6 | 128/128 | 6 | 6 | 6 | 0 | n/a | 0 | 0 |
| layered | MO-C04 | no | 6 | 18/18 | 12 | 12 | 12 | 12 | 1.00 [0.76, 1.00] | 0 | 0 |
| layered | MO-C04n | – | 6 | 92/92 | 6 | 6 | 6 | 0 | n/a | 0 | 0 |
| layered | MO-SO01 | no | 6 | 90/92 | 12 | 12 | 12 | 12 | 1.00 [0.76, 1.00] | 0 | 0 |
| layered | MO-SO01n | – | 6 | 89/92 | 6 | 6 | 6 | 0 | n/a | 0 | 0 |
| layered | MO-CV02 | – | 6 | 0/0 | 0 | 0 | 0 | 0 | n/a | 0 | 0 |
| layered | MO-CV02n | – | 6 | 0/0 | 0 | 0 | 0 | 0 | n/a | 0 | 0 |
| layered | MO-DF01 (direction mismatch) | yes | 6 | 110/345 | 12 | 12 | 12 | 0 | 0.00 [0.00, 0.24] | 0 | 0 |
| layered | MO-DF01n (direction mismatch) | – | 6 | 75/326 | 3 | 3 | 3 | 0 | n/a | 3 | 0 |
| layered | MO-SO02 | no | 6 | 90/90 | 12 | 1 | 1 | 1 | 1.00 [0.21, 1.00] | 0 | 0 |
| layered | MO-SO02n | – | 6 | 90/90 | 6 | 1 | 1 | 0 | n/a | 0 | 0 |
| layered | MO-S03 | yes | 6 | 57/60 | 12 | 12 | 12 | 10 | 0.83 [0.55, 0.95] | 0 | 0 |
| layered | MO-S03n | – | 6 | 68/101 | 6 | 6 | 6 | 0 | n/a | 0 | 0 |
| **layered** | **all positives with a key** | | 6 | | | | 73 | 35 | **0.48 [0.37, 0.59]** | | |
| **layered** | **without the direction-mismatched operators** | | 6 | | | | 49 | 35 | **0.71 [0.58, 0.82]** | | |

## Snapshots

| Snapshot | Style | Step | Files | tsc errors (unmutated) | Baseline violations | Excluded |
|---|---|---|---|---|---|---|
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/hive-health/daedalus-mcp/run-0/step-05 | layered | 5 | 12 | 0 | 15 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/hive-health/daedalus-mcp/run-1/step-05 | layered | 5 | 11 | 0 | 16 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/ice-rink/daedalus-mcp/run-0/step-05 | layered | 5 | 19 | 0 | 26 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/ice-rink/daedalus-mcp/run-1/step-05 | layered | 5 | 16 | 0 | 21 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/youth-league/daedalus-mcp/run-0/step-05 | layered | 5 | 18 | 0 | 25 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/youth-league/daedalus-mcp/run-1/step-05 | layered | 5 | 16 | 0 | 23 |  |
