# Seeded recall on agent snapshots (development data; not a registered SO4 estimate)

k = 2 positive and 1 twin site(s) per operator per snapshot, seed 20261019; final snapshot of each trajectory; cypher-interp (in process; scoring v1.3, instrument v2, post-seal rules on). Type-check: skeleton install of scripts/generator/skeleton (package-lock.json; express, @types/express, @types/node, typescript), harness tsconfig.

| Style | Operator | Blocking key | Snapshots | Sites eligible/candidates | Applied | Compiled | Evaluated | Detected | Rate [95 % Wilson] | Twin false fires | No key |
|---|---|---|---|---|---|---|---|---|---|---|---|
| layered | MO-S01 (direction mismatch) | yes | 6 | 115/163 | 11 | 11 | 11 | 0 | 0.00 [0.00, 0.26] | 0 | 0 |
| layered | MO-S01n (direction mismatch) | – | 6 | 201/201 | 6 | 6 | 6 | 0 | n/a | 6 | 0 |
| layered | MO-P01 | yes | 6 | 152/152 | 12 | 12 | 12 | 0 | 0.00 [0.00, 0.24] | 0 | 0 |
| layered | MO-P01n | – | 6 | 132/132 | 6 | 6 | 6 | 0 | n/a | 0 | 0 |
| layered | MO-C04 | no | 6 | 18/18 | 12 | 12 | 12 | 12 | 1.00 [0.76, 1.00] | 0 | 0 |
| layered | MO-C04n | – | 6 | 84/84 | 6 | 6 | 6 | 0 | n/a | 0 | 0 |
| layered | MO-SO01 | no | 6 | 88/92 | 12 | 12 | 12 | 11 | 0.92 [0.65, 0.99] | 0 | 0 |
| layered | MO-SO01n | – | 6 | 88/92 | 6 | 6 | 6 | 0 | n/a | 0 | 0 |
| layered | MO-CV02 | – | 6 | 0/0 | 0 | 0 | 0 | 0 | n/a | 0 | 0 |
| layered | MO-CV02n | – | 6 | 0/0 | 0 | 0 | 0 | 0 | n/a | 0 | 0 |
| layered | MO-DF01 (direction mismatch) | yes | 6 | 108/345 | 12 | 12 | 12 | 0 | 0.00 [0.00, 0.24] | 0 | 0 |
| layered | MO-DF01n (direction mismatch) | – | 6 | 81/325 | 3 | 3 | 3 | 0 | n/a | 3 | 0 |
| layered | MO-SO02 | no | 6 | 91/91 | 12 | 3 | 3 | 3 | 1.00 [0.44, 1.00] | 0 | 0 |
| layered | MO-SO02n | – | 6 | 91/91 | 6 | 1 | 1 | 0 | n/a | 0 | 0 |
| layered | MO-S03 | yes | 6 | 41/62 | 11 | 11 | 11 | 9 | 0.82 [0.52, 0.95] | 0 | 0 |
| layered | MO-S03n | – | 6 | 37/78 | 6 | 6 | 6 | 0 | n/a | 0 | 0 |
| **layered** | **all positives with a key** | | 6 | | | | 73 | 35 | **0.48 [0.37, 0.59]** | | |
| **layered** | **without the direction-mismatched operators** | | 6 | | | | 50 | 35 | **0.70 [0.56, 0.81]** | | |

## Snapshots

| Snapshot | Style | Step | Files | tsc errors (unmutated) | Baseline violations | Excluded |
|---|---|---|---|---|---|---|
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/hive-health/none/run-0/step-05 | layered | 5 | 10 | 0 | 15 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/ice-rink/none/run-0/step-05 | layered | 5 | 14 | 0 | 21 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/youth-league/none/run-0/step-05 | layered | 5 | 18 | 0 | 26 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/hive-health/none/run-1/step-05 | layered | 5 | 9 | 0 | 15 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/ice-rink/none/run-1/step-05 | layered | 5 | 16 | 0 | 27 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/youth-league/none/run-1/step-05 | layered | 5 | 17 | 0 | 25 |  |
