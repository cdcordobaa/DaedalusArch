# Seeded recall on agent snapshots (development data; not a registered SO4 estimate)

k = 2 positive and 1 twin site(s) per operator per snapshot, seed 20261019; final snapshot of each trajectory; cypher-interp (in process; scoring v1.3, instrument v2, post-seal rules on). Type-check: skeleton install of scripts/generator/skeleton (package-lock.json; express, @types/express, @types/node, typescript), harness tsconfig.

| Style | Operator | Blocking key | Snapshots | Sites eligible/candidates | Applied | Compiled | Evaluated | Detected | Rate [95 % Wilson] | Twin false fires | No key |
|---|---|---|---|---|---|---|---|---|---|---|---|
| clean-architecture | MO-S01 | yes | 5 | 73/73 | 10 | 10 | 10 | 10 | 1.00 [0.72, 1.00] | 0 | 0 |
| clean-architecture | MO-S01n | – | 5 | 62/82 | 5 | 5 | 5 | 0 | n/a | 0 | 0 |
| clean-architecture | MO-P01 | yes | 5 | 100/100 | 10 | 10 | 10 | 10 | 1.00 [0.72, 1.00] | 0 | 0 |
| clean-architecture | MO-P01n | – | 5 | 68/72 | 5 | 5 | 5 | 0 | n/a | 0 | 0 |
| clean-architecture | MO-C04 | no | 5 | 23/23 | 10 | 10 | 10 | 10 | 1.00 [0.72, 1.00] | 0 | 0 |
| clean-architecture | MO-C04n | – | 5 | 113/113 | 5 | 5 | 5 | 0 | n/a | 0 | 0 |
| clean-architecture | MO-SO01 | no | 5 | 82/85 | 10 | 10 | 10 | 8 | 0.80 [0.49, 0.94] | 0 | 0 |
| clean-architecture | MO-SO01n | – | 5 | 82/85 | 5 | 5 | 5 | 0 | n/a | 0 | 0 |
| clean-architecture | MO-CV02 | no | 5 | 12/12 | 7 | 7 | 7 | 0 | 0.00 [0.00, 0.35] | 0 | 0 |
| clean-architecture | MO-CV02n | – | 5 | 12/12 | 5 | 5 | 5 | 0 | n/a | 0 | 0 |
| clean-architecture | MO-DF01 | yes | 5 | 120/161 | 8 | 8 | 8 | 8 | 1.00 [0.68, 1.00] | 0 | 0 |
| clean-architecture | MO-DF01n | – | 5 | 24/149 | 3 | 3 | 3 | 0 | n/a | 0 | 0 |
| clean-architecture | MO-SO02 | no | 5 | 127/131 | 10 | 2 | 2 | 2 | 1.00 [0.34, 1.00] | 0 | 0 |
| clean-architecture | MO-SO02n | – | 5 | 124/131 | 5 | 2 | 2 | 0 | n/a | 0 | 0 |
| clean-architecture | MO-S03 | – | 5 | 0/0 | 0 | 0 | 0 | 0 | n/a | 0 | 0 |
| clean-architecture | MO-S03n | – | 5 | 0/0 | 0 | 0 | 0 | 0 | n/a | 0 | 0 |
| **clean-architecture** | **all positives with a key** | | 5 | | | | 57 | 48 | **0.84 [0.73, 0.91]** | | |
| hexagonal | MO-S01 | – | 11 | 192/192 | 20 | 20 | 0 | 0 | n/a | 0 | 20 |
| hexagonal | MO-S01n | – | 11 | 147/192 | 10 | 10 | 10 | 0 | n/a | 0 | 0 |
| hexagonal | MO-P01 | yes | 11 | 196/196 | 22 | 22 | 22 | 22 | 1.00 [0.85, 1.00] | 0 | 0 |
| hexagonal | MO-P01n | – | 11 | 172/172 | 10 | 10 | 10 | 0 | n/a | 0 | 0 |
| hexagonal | MO-C04 | no | 11 | 58/58 | 22 | 22 | 22 | 22 | 1.00 [0.85, 1.00] | 0 | 0 |
| hexagonal | MO-C04n | – | 11 | 206/206 | 11 | 11 | 11 | 0 | n/a | 0 | 0 |
| hexagonal | MO-SO01 | no | 11 | 164/166 | 22 | 22 | 22 | 19 | 0.86 [0.67, 0.95] | 0 | 0 |
| hexagonal | MO-SO01n | – | 11 | 163/166 | 11 | 11 | 11 | 0 | n/a | 0 | 0 |
| hexagonal | MO-CV02 | no | 11 | 40/40 | 19 | 19 | 19 | 0 | 0.00 [0.00, 0.17] | 0 | 0 |
| hexagonal | MO-CV02n | – | 11 | 40/40 | 10 | 10 | 10 | 0 | n/a | 0 | 0 |
| hexagonal | MO-DF01 | yes | 11 | 122/156 | 8 | 8 | 8 | 8 | 1.00 [0.68, 1.00] | 0 | 0 |
| hexagonal | MO-DF01n | – | 11 | 94/152 | 3 | 3 | 3 | 0 | n/a | 0 | 0 |
| hexagonal | MO-SO02 | no | 11 | 227/228 | 22 | 10 | 10 | 10 | 1.00 [0.72, 1.00] | 0 | 0 |
| hexagonal | MO-SO02n | – | 11 | 225/228 | 11 | 7 | 7 | 0 | n/a | 0 | 0 |
| hexagonal | MO-S03 | – | 11 | 86/87 | 20 | 20 | 0 | 0 | n/a | 0 | 20 |
| hexagonal | MO-S03n | – | 11 | 0/82 | 0 | 0 | 0 | 0 | n/a | 0 | 0 |
| hexagonal | MO-H01 | yes | 11 | 274/274 | 20 | 20 | 20 | 20 | 1.00 [0.84, 1.00] | 0 | 0 |
| hexagonal | MO-H01n | – | 11 | 147/186 | 10 | 10 | 10 | 0 | n/a | 0 | 0 |
| hexagonal | MO-H02 | yes | 11 | 170/170 | 20 | 20 | 20 | 20 | 1.00 [0.84, 1.00] | 0 | 0 |
| hexagonal | MO-H02n | – | 11 | 154/222 | 10 | 10 | 10 | 0 | n/a | 0 | 0 |
| hexagonal | MO-H03 | no | 11 | 86/86 | 20 | 20 | 20 | 20 | 1.00 [0.84, 1.00] | 0 | 0 |
| hexagonal | MO-H03n | – | 11 | 73/75 | 9 | 9 | 9 | 0 | n/a | 0 | 0 |
| hexagonal | MO-H04 | yes | 11 | 48/48 | 16 | 16 | 16 | 16 | 1.00 [0.81, 1.00] | 0 | 0 |
| hexagonal | MO-H04n | – | 11 | 48/48 | 8 | 8 | 8 | 0 | n/a | 0 | 0 |
| hexagonal | MO-H05 | yes | 11 | 49/49 | 22 | 22 | 22 | 22 | 1.00 [0.85, 1.00] | 0 | 0 |
| hexagonal | MO-H05n | – | 11 | 43/43 | 10 | 10 | 10 | 0 | n/a | 0 | 0 |
| hexagonal | MO-H06 | yes | 11 | 19/19 | 6 | 6 | 6 | 6 | 1.00 [0.61, 1.00] | 0 | 0 |
| hexagonal | MO-H06n | – | 11 | 10/16 | 1 | 1 | 1 | 0 | n/a | 0 | 0 |
| hexagonal | MO-H07 | yes | 11 | 19/19 | 9 | 9 | 9 | 9 | 1.00 [0.70, 1.00] | 0 | 0 |
| hexagonal | MO-H07n | – | 11 | 9/29 | 4 | 4 | 4 | 0 | n/a | 0 | 0 |
| **hexagonal** | **all positives with a key** | | 11 | | | | 216 | 194 | **0.90 [0.85, 0.93]** | | |
| layered | MO-S01 (direction mismatch) | yes | 6 | 90/154 | 12 | 12 | 12 | 0 | 0.00 [0.00, 0.24] | 0 | 0 |
| layered | MO-S01n (direction mismatch) | – | 6 | 160/168 | 6 | 6 | 6 | 0 | n/a | 6 | 0 |
| layered | MO-P01 | yes | 6 | 152/152 | 12 | 12 | 12 | 12 | 1.00 [0.76, 1.00] | 0 | 0 |
| layered | MO-P01n | – | 6 | 108/108 | 6 | 6 | 6 | 0 | n/a | 0 | 0 |
| layered | MO-C04 | no | 6 | 18/18 | 12 | 12 | 12 | 12 | 1.00 [0.76, 1.00] | 0 | 0 |
| layered | MO-C04n | – | 6 | 77/77 | 6 | 6 | 6 | 0 | n/a | 0 | 0 |
| layered | MO-SO01 | no | 6 | 58/58 | 12 | 12 | 12 | 12 | 1.00 [0.76, 1.00] | 0 | 0 |
| layered | MO-SO01n | – | 6 | 56/58 | 6 | 6 | 6 | 0 | n/a | 0 | 0 |
| layered | MO-CV02 | – | 6 | 0/0 | 0 | 0 | 0 | 0 | n/a | 0 | 0 |
| layered | MO-CV02n | – | 6 | 0/0 | 0 | 0 | 0 | 0 | n/a | 0 | 0 |
| layered | MO-DF01 (direction mismatch) | yes | 6 | 42/184 | 8 | 8 | 8 | 0 | 0.00 [0.00, 0.32] | 0 | 0 |
| layered | MO-DF01n (direction mismatch) | – | 6 | 18/168 | 2 | 2 | 2 | 0 | n/a | 2 | 0 |
| layered | MO-SO02 | no | 6 | 64/64 | 12 | 1 | 1 | 1 | 1.00 [0.21, 1.00] | 0 | 0 |
| layered | MO-SO02n | – | 6 | 64/64 | 6 | 0 | 0 | 0 | n/a | 0 | 0 |
| layered | MO-S03 | yes | 6 | 42/50 | 12 | 12 | 12 | 12 | 1.00 [0.76, 1.00] | 0 | 0 |
| layered | MO-S03n | – | 6 | 27/76 | 6 | 6 | 6 | 0 | n/a | 0 | 0 |
| **layered** | **all positives with a key** | | 6 | | | | 69 | 49 | **0.71 [0.59, 0.80]** | | |
| **layered** | **without the direction-mismatched operators** | | 6 | | | | 49 | 49 | **1.00 [0.93, 1.00]** | | |

## Snapshots

| Snapshot | Style | Step | Files | tsc errors (unmutated) | Baseline violations | Excluded |
|---|---|---|---|---|---|---|
| opus-by-hand:food-bank/none/step-05 | hexagonal | 5 | 19 | 0 | 20 |  |
| opus-by-hand:food-bank/tool/step-05 | hexagonal | 5 | 19 | 0 | 20 |  |
| opus-by-hand:garden-plots/none/step-05 | hexagonal | 5 | 15 | 0 | 16 |  |
| opus-by-hand:garden-plots/tool/step-05 | hexagonal | 5 | 15 | 0 | 16 |  |
| opus-by-hand:hive-health/none/step-05 | layered | 5 | 12 | 0 | 28 |  |
| opus-by-hand:hive-health/tool/step-05 | layered | 5 | 14 | 0 | 18 |  |
| opus-by-hand:market-vendors/none/step-04 | layered | 4 | 12 | 0 | 20 |  |
| opus-by-hand:market-vendors/tool/step-04 | layered | 4 | 13 | 0 | 15 |  |
| opus-by-hand:shelter-adoptions/none/step-04 | hexagonal | 4 | 18 | 0 | 26 |  |
| opus-by-hand:shelter-adoptions/tool/step-04 | hexagonal | 4 | 18 | 0 | 26 |  |
| opus-by-hand:youth-league/none/step-05 | layered | 5 | 12 | 0 | 19 |  |
| opus-by-hand:youth-league/tool/step-05 | layered | 5 | 14 | 0 | 17 |  |
| opus-by-hand:market-vendors/C1/step-04 | clean-architecture | 4 | 10 | 0 | 14 |  |
| opus-by-hand:market-vendors/C2/step-04 | clean-architecture | 4 | 21 | 0 | 29 |  |
| opus-by-hand:market-vendors/C3/step-04 | clean-architecture | 4 | 19 | 0 | 27 |  |
| opus-by-hand:shelter-adoptions/C1/step-04 | hexagonal | 4 | 19 | 0 | 28 |  |
| opus-by-hand:shelter-adoptions/C2/step-04 | hexagonal | 4 | 23 | 18 | 14 |  |
| opus-by-hand:shelter-adoptions/C3/step-04 | hexagonal | 4 | 16 | 0 | 24 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/market-vendors/gate/run-0/step-04 | clean-architecture | 4 | 8 | 0 | 9 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/market-vendors/none/run-0/step-04 | clean-architecture | 4 | 10 | 0 | 14 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/relief-volunteers/gate/run-0/step-04 | ddd | 4 |  |  |  | spec: spec experiments/loop-pilot/run-2026-10-16/outputs/runs/claude-code-cli/claude-sonnet-5-5/relief-volunteers/gate/run-0/spec/frozen-spec.yaml does not compile: BR-SPEC-10 FF-DT01: aggregates; BR-SPEC-10 FF-DT02: aggregates |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/relief-volunteers/none/run-0/step-04 | ddd | 4 |  |  |  | spec: spec experiments/loop-pilot/run-2026-10-16/outputs/runs/claude-code-cli/claude-sonnet-5-5/relief-volunteers/none/run-0/spec/frozen-spec.yaml does not compile: BR-SPEC-10 FF-DT01: aggregates; BR-SPEC-10 FF-DT02: aggregates |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/shelter-adoptions/gate/run-0/step-04 | hexagonal | 4 | 19 | 0 | 24 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/shelter-adoptions/none/run-0/step-04 | hexagonal | 4 | 14 | 0 | 16 |  |
