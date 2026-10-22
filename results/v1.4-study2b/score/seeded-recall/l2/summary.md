# Seeded recall on agent snapshots (development data; not a registered SO4 estimate)

k = 2 positive and 1 twin site(s) per operator per snapshot, seed 20261019; final snapshot of each trajectory; cypher-interp (in process; scoring v1.3, instrument v2, post-seal rules on). Type-check: skeleton install of scripts/generator/skeleton (package-lock.json; express, @types/express, @types/node, typescript), harness tsconfig.

| Style | Operator | Blocking key | Snapshots | Sites eligible/candidates | Applied | Compiled | Evaluated | Detected | Rate [95 % Wilson] | Twin false fires | No key |
|---|---|---|---|---|---|---|---|---|---|---|---|
| layered | MO-S01 (direction mismatch) | yes | 40 | 1412/1956 | 72 | 72 | 72 | 0 | 0.00 [0.00, 0.05] | 0 | 0 |
| layered | MO-S01n (direction mismatch) | – | 40 | 2099/2099 | 40 | 40 | 40 | 0 | n/a | 40 | 0 |
| layered | MO-P01 | yes | 40 | 1052/1052 | 80 | 80 | 80 | 0 | 0.00 [0.00, 0.05] | 0 | 0 |
| layered | MO-P01n | – | 40 | 1148/1148 | 40 | 40 | 40 | 0 | n/a | 0 | 0 |
| layered | MO-C04 | no | 40 | 120/120 | 80 | 80 | 80 | 80 | 1.00 [0.95, 1.00] | 0 | 0 |
| layered | MO-C04n | – | 40 | 630/630 | 40 | 40 | 40 | 0 | n/a | 0 | 0 |
| layered | MO-SO01 | no | 40 | 729/739 | 80 | 80 | 80 | 77 | 0.96 [0.90, 0.99] | 0 | 0 |
| layered | MO-SO01n | – | 40 | 729/739 | 40 | 40 | 40 | 0 | n/a | 0 | 0 |
| layered | MO-CV02 | – | 40 | 0/0 | 0 | 0 | 0 | 0 | n/a | 0 | 0 |
| layered | MO-CV02n | – | 40 | 0/0 | 0 | 0 | 0 | 0 | n/a | 0 | 0 |
| layered | MO-DF01 (direction mismatch) | yes | 40 | 2123/3383 | 76 | 73 | 73 | 0 | 0.00 [0.00, 0.05] | 0 | 0 |
| layered | MO-DF01n (direction mismatch) | – | 40 | 1237/3383 | 32 | 32 | 32 | 0 | n/a | 32 | 0 |
| layered | MO-SO02 | no | 40 | 409/409 | 80 | 2 | 2 | 2 | 1.00 [0.34, 1.00] | 0 | 0 |
| layered | MO-SO02n | – | 40 | 409/409 | 40 | 1 | 1 | 0 | n/a | 0 | 0 |
| layered | MO-S03 | yes | 40 | 321/528 | 74 | 74 | 74 | 71 | 0.96 [0.89, 0.99] | 0 | 0 |
| layered | MO-S03n | – | 40 | 279/526 | 40 | 40 | 40 | 0 | n/a | 0 | 0 |
| **layered** | **all positives with a key** | | 40 | | | | 461 | 230 | **0.50 [0.45, 0.54]** | | |
| **layered** | **without the direction-mismatched operators** | | 40 | | | | 316 | 230 | **0.73 [0.68, 0.77]** | | |

## Snapshots

| Snapshot | Style | Step | Files | tsc errors (unmutated) | Baseline violations | Excluded |
|---|---|---|---|---|---|---|
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/community-radio/none/run-0/step-05 | layered | 5 | 21 | 0 | 26 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/laundromat/none/run-0/step-05 | layered | 5 | 9 | 0 | 16 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/lost-property/none/run-0/step-05 | layered | 5 | 11 | 0 | 12 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/parking-permits/none/run-0/step-05 | layered | 5 | 21 | 0 | 26 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/community-radio/none/run-1/step-05 | layered | 5 | 16 | 0 | 28 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/laundromat/none/run-1/step-05 | layered | 5 | 8 | 0 | 14 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/lost-property/none/run-1/step-05 | layered | 5 | 10 | 0 | 10 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/parking-permits/none/run-1/step-05 | layered | 5 | 18 | 0 | 34 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/community-radio/none/run-2/step-05 | layered | 5 | 22 | 0 | 39 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/laundromat/none/run-2/step-05 | layered | 5 | 4 | 0 | 7 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/lost-property/none/run-2/step-05 | layered | 5 | 13 | 0 | 18 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/parking-permits/none/run-2/step-05 | layered | 5 | 19 | 0 | 34 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/community-radio/none/run-3/step-05 | layered | 5 | 19 | 0 | 36 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/laundromat/none/run-3/step-05 | layered | 5 | 19 | 0 | 34 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/lost-property/none/run-3/step-05 | layered | 5 | 9 | 0 | 15 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/parking-permits/none/run-3/step-05 | layered | 5 | 19 | 0 | 37 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/community-radio/none/run-4/step-05 | layered | 5 | 22 | 0 | 38 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/laundromat/none/run-4/step-05 | layered | 5 | 6 | 0 | 10 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/lost-property/none/run-4/step-05 | layered | 5 | 21 | 0 | 36 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/parking-permits/none/run-4/step-05 | layered | 5 | 19 | 0 | 36 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/community-radio/none/run-5/step-05 | layered | 5 | 23 | 0 | 41 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/laundromat/none/run-5/step-05 | layered | 5 | 4 | 0 | 7 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/lost-property/none/run-5/step-05 | layered | 5 | 13 | 0 | 19 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/parking-permits/none/run-5/step-05 | layered | 5 | 18 | 0 | 19 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/community-radio/none/run-6/step-05 | layered | 5 | 19 | 0 | 26 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/laundromat/none/run-6/step-05 | layered | 5 | 21 | 0 | 34 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/lost-property/none/run-6/step-05 | layered | 5 | 15 | 0 | 24 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/parking-permits/none/run-6/step-05 | layered | 5 | 19 | 0 | 32 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/community-radio/none/run-7/step-05 | layered | 5 | 21 | 0 | 36 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/laundromat/none/run-7/step-05 | layered | 5 | 8 | 0 | 13 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/lost-property/none/run-7/step-05 | layered | 5 | 8 | 0 | 15 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/parking-permits/none/run-7/step-05 | layered | 5 | 18 | 0 | 34 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/community-radio/none/run-8/step-05 | layered | 5 | 24 | 0 | 30 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/laundromat/none/run-8/step-05 | layered | 5 | 18 | 0 | 36 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/lost-property/none/run-8/step-05 | layered | 5 | 15 | 0 | 17 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/parking-permits/none/run-8/step-05 | layered | 5 | 20 | 0 | 20 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/community-radio/none/run-9/step-05 | layered | 5 | 20 | 0 | 26 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/laundromat/none/run-9/step-05 | layered | 5 | 8 | 0 | 8 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/lost-property/none/run-9/step-05 | layered | 5 | 13 | 0 | 18 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/parking-permits/none/run-9/step-05 | layered | 5 | 19 | 0 | 34 |  |
