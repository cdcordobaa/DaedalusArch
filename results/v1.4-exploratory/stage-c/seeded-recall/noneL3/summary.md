# Seeded recall on agent snapshots (development data; not a registered SO4 estimate)

k = 2 positive and 1 twin site(s) per operator per snapshot, seed 20261019; final snapshot of each trajectory; cypher-interp (in process; scoring v1.3, instrument v2, post-seal rules on). Type-check: skeleton install of scripts/generator/skeleton (package-lock.json; express, @types/express, @types/node, typescript), harness tsconfig.

| Style | Operator | Blocking key | Snapshots | Sites eligible/candidates | Applied | Compiled | Evaluated | Detected | Rate [95 % Wilson] | Twin false fires | No key |
|---|---|---|---|---|---|---|---|---|---|---|---|
| layered | MO-S01 (direction mismatch) | yes | 6 | 200/200 | 12 | 12 | 12 | 0 | 0.00 [0.00, 0.24] | 0 | 0 |
| layered | MO-S01n (direction mismatch) | – | 6 | 252/252 | 6 | 6 | 6 | 0 | n/a | 6 | 0 |
| layered | MO-P01 | yes | 6 | 208/208 | 12 | 12 | 12 | 0 | 0.00 [0.00, 0.24] | 0 | 0 |
| layered | MO-P01n | – | 6 | 120/120 | 6 | 6 | 6 | 0 | n/a | 0 | 0 |
| layered | MO-C04 | no | 6 | 18/18 | 12 | 12 | 12 | 12 | 1.00 [0.76, 1.00] | 0 | 0 |
| layered | MO-C04n | – | 6 | 96/96 | 6 | 6 | 6 | 0 | n/a | 0 | 0 |
| layered | MO-SO01 | no | 6 | 84/87 | 12 | 12 | 12 | 10 | 0.83 [0.55, 0.95] | 0 | 0 |
| layered | MO-SO01n | – | 6 | 82/87 | 6 | 6 | 6 | 0 | n/a | 0 | 0 |
| layered | MO-CV02 | – | 6 | 0/0 | 0 | 0 | 0 | 0 | n/a | 0 | 0 |
| layered | MO-CV02n | – | 6 | 0/0 | 0 | 0 | 0 | 0 | n/a | 0 | 0 |
| layered | MO-DF01 (direction mismatch) | yes | 6 | 240/314 | 12 | 12 | 12 | 0 | 0.00 [0.00, 0.24] | 0 | 0 |
| layered | MO-DF01n (direction mismatch) | – | 6 | 78/296 | 4 | 4 | 4 | 0 | n/a | 4 | 0 |
| layered | MO-SO02 | no | 6 | 202/207 | 12 | 4 | 4 | 4 | 1.00 [0.51, 1.00] | 0 | 0 |
| layered | MO-SO02n | – | 6 | 195/207 | 6 | 4 | 4 | 0 | n/a | 0 | 0 |
| layered | MO-S03 | yes | 6 | 52/60 | 12 | 12 | 12 | 11 | 0.92 [0.65, 0.99] | 0 | 0 |
| layered | MO-S03n | – | 6 | 76/116 | 6 | 6 | 6 | 0 | n/a | 0 | 0 |
| **layered** | **all positives with a key** | | 6 | | | | 76 | 37 | **0.49 [0.38, 0.60]** | | |
| **layered** | **without the direction-mismatched operators** | | 6 | | | | 52 | 37 | **0.71 [0.58, 0.82]** | | |

## Snapshots

| Snapshot | Style | Step | Files | tsc errors (unmutated) | Baseline violations | Excluded |
|---|---|---|---|---|---|---|
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/hive-health/none/run-0/step-05 | layered | 5 | 14 | 0 | 20 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/hive-health/none/run-1/step-05 | layered | 5 | 14 | 0 | 18 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/ice-rink/none/run-0/step-05 | layered | 5 | 16 | 0 | 17 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/ice-rink/none/run-1/step-05 | layered | 5 | 18 | 0 | 30 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/youth-league/none/run-0/step-05 | layered | 5 | 21 | 0 | 23 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/youth-league/none/run-1/step-05 | layered | 5 | 17 | 0 | 20 |  |
