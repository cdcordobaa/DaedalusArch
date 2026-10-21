# Seeded recall on agent snapshots (development data; not a registered SO4 estimate)

k = 2 positive and 1 twin site(s) per operator per snapshot, seed 20261019; final snapshot of each trajectory; cypher-interp (in process; scoring v1.3, instrument v2, post-seal rules on). Type-check: skeleton install of scripts/generator/skeleton (package-lock.json; express, @types/express, @types/node, typescript), harness tsconfig.

| Style | Operator | Blocking key | Snapshots | Sites eligible/candidates | Applied | Compiled | Evaluated | Detected | Rate [95 % Wilson] | Twin false fires | No key |
|---|---|---|---|---|---|---|---|---|---|---|---|
| layered | MO-S01 (direction mismatch) | yes | 40 | 2371/2433 | 80 | 80 | 80 | 0 | 0.00 [0.00, 0.05] | 0 | 0 |
| layered | MO-S01n (direction mismatch) | – | 40 | 2675/2675 | 40 | 38 | 38 | 0 | n/a | 38 | 0 |
| layered | MO-P01 | yes | 40 | 1268/1268 | 80 | 80 | 80 | 0 | 0.00 [0.00, 0.05] | 0 | 0 |
| layered | MO-P01n | – | 40 | 1216/1216 | 40 | 40 | 40 | 0 | n/a | 0 | 0 |
| layered | MO-C04 | no | 40 | 120/120 | 80 | 80 | 80 | 80 | 1.00 [0.95, 1.00] | 0 | 0 |
| layered | MO-C04n | – | 40 | 708/708 | 40 | 40 | 40 | 0 | n/a | 0 | 0 |
| layered | MO-SO01 | no | 40 | 711/726 | 80 | 80 | 80 | 77 | 0.96 [0.90, 0.99] | 0 | 0 |
| layered | MO-SO01n | – | 40 | 711/726 | 40 | 40 | 40 | 0 | n/a | 0 | 0 |
| layered | MO-CV02 | – | 40 | 0/0 | 0 | 0 | 0 | 0 | n/a | 0 | 0 |
| layered | MO-CV02n | – | 40 | 0/0 | 0 | 0 | 0 | 0 | n/a | 0 | 0 |
| layered | MO-DF01 (direction mismatch) | yes | 40 | 2858/3271 | 80 | 79 | 79 | 0 | 0.00 [0.00, 0.05] | 0 | 0 |
| layered | MO-DF01n (direction mismatch) | – | 40 | 1221/3263 | 31 | 31 | 31 | 0 | n/a | 31 | 0 |
| layered | MO-SO02 | no | 40 | 1342/1400 | 80 | 24 | 24 | 24 | 1.00 [0.86, 1.00] | 0 | 0 |
| layered | MO-SO02n | – | 40 | 1293/1400 | 40 | 10 | 10 | 0 | n/a | 0 | 0 |
| layered | MO-S03 | yes | 40 | 482/603 | 80 | 80 | 80 | 76 | 0.95 [0.88, 0.98] | 0 | 0 |
| layered | MO-S03n | – | 40 | 438/688 | 40 | 40 | 40 | 0 | n/a | 0 | 0 |
| **layered** | **all positives with a key** | | 40 | | | | 503 | 257 | **0.51 [0.47, 0.55]** | | |
| **layered** | **without the direction-mismatched operators** | | 40 | | | | 344 | 257 | **0.75 [0.70, 0.79]** | | |

## Snapshots

| Snapshot | Style | Step | Files | tsc errors (unmutated) | Baseline violations | Excluded |
|---|---|---|---|---|---|---|
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/community-radio/none/run-0/step-05 | layered | 5 | 26 | 0 | 29 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/laundromat/none/run-0/step-05 | layered | 5 | 12 | 0 | 12 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/lost-property/none/run-0/step-05 | layered | 5 | 13 | 0 | 14 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/parking-permits/none/run-0/step-05 | layered | 5 | 21 | 0 | 29 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/community-radio/none/run-1/step-05 | layered | 5 | 24 | 0 | 24 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/laundromat/none/run-1/step-05 | layered | 5 | 10 | 0 | 11 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/lost-property/none/run-1/step-05 | layered | 5 | 11 | 0 | 11 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/parking-permits/none/run-1/step-05 | layered | 5 | 20 | 0 | 34 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/community-radio/none/run-2/step-05 | layered | 5 | 23 | 0 | 38 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/laundromat/none/run-2/step-05 | layered | 5 | 6 | 0 | 12 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/lost-property/none/run-2/step-05 | layered | 5 | 13 | 0 | 19 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/parking-permits/none/run-2/step-05 | layered | 5 | 25 | 0 | 30 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/community-radio/none/run-3/step-05 | layered | 5 | 22 | 0 | 22 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/laundromat/none/run-3/step-05 | layered | 5 | 26 | 0 | 38 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/lost-property/none/run-3/step-05 | layered | 5 | 12 | 0 | 19 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/parking-permits/none/run-3/step-05 | layered | 5 | 24 | 0 | 29 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/community-radio/none/run-4/step-05 | layered | 5 | 19 | 0 | 33 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/laundromat/none/run-4/step-05 | layered | 5 | 11 | 0 | 12 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/lost-property/none/run-4/step-05 | layered | 5 | 22 | 0 | 23 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/parking-permits/none/run-4/step-05 | layered | 5 | 25 | 0 | 40 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/community-radio/none/run-5/step-05 | layered | 5 | 25 | 0 | 41 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/laundromat/none/run-5/step-05 | layered | 5 | 7 | 0 | 13 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/lost-property/none/run-5/step-05 | layered | 5 | 17 | 0 | 19 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/parking-permits/none/run-5/step-05 | layered | 5 | 19 | 0 | 22 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/community-radio/none/run-6/step-05 | layered | 5 | 20 | 0 | 25 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/laundromat/none/run-6/step-05 | layered | 5 | 24 | 0 | 40 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/lost-property/none/run-6/step-05 | layered | 5 | 11 | 0 | 17 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/parking-permits/none/run-6/step-05 | layered | 5 | 20 | 0 | 34 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/community-radio/none/run-7/step-05 | layered | 5 | 18 | 0 | 30 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/laundromat/none/run-7/step-05 | layered | 5 | 12 | 0 | 12 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/lost-property/none/run-7/step-05 | layered | 5 | 10 | 0 | 10 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/parking-permits/none/run-7/step-05 | layered | 5 | 25 | 0 | 40 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/community-radio/none/run-8/step-05 | layered | 5 | 24 | 0 | 29 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/laundromat/none/run-8/step-05 | layered | 5 | 19 | 0 | 18 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/lost-property/none/run-8/step-05 | layered | 5 | 13 | 0 | 13 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/parking-permits/none/run-8/step-05 | layered | 5 | 23 | 0 | 30 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/community-radio/none/run-9/step-05 | layered | 5 | 22 | 0 | 23 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/laundromat/none/run-9/step-05 | layered | 5 | 11 | 0 | 10 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/lost-property/none/run-9/step-05 | layered | 5 | 20 | 0 | 21 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/parking-permits/none/run-9/step-05 | layered | 5 | 20 | 0 | 35 |  |
