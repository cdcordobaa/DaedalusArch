# Seeded recall on agent snapshots (development data; not a registered SO4 estimate)

k = 2 positive and 1 twin site(s) per operator per snapshot, seed 20261019; final snapshot of each trajectory; cypher-interp (in process; scoring v1.3, instrument v2, post-seal rules on). Type-check: skeleton install of scripts/generator/skeleton (package-lock.json; express, @types/express, @types/node, typescript), harness tsconfig.

| Style | Operator | Blocking key | Snapshots | Sites eligible/candidates | Applied | Compiled | Evaluated | Detected | Rate [95 % Wilson] | Twin false fires | No key |
|---|---|---|---|---|---|---|---|---|---|---|---|
| layered | MO-S01 (direction mismatch) | yes | 40 | 1583/2254 | 74 | 74 | 74 | 0 | 0.00 [0.00, 0.05] | 0 | 0 |
| layered | MO-S01n (direction mismatch) | – | 40 | 2414/2414 | 40 | 40 | 40 | 0 | n/a | 40 | 0 |
| layered | MO-P01 | yes | 40 | 1232/1232 | 80 | 80 | 80 | 0 | 0.00 [0.00, 0.05] | 0 | 0 |
| layered | MO-P01n | – | 40 | 1148/1148 | 40 | 40 | 40 | 0 | n/a | 0 | 0 |
| layered | MO-C04 | no | 40 | 120/120 | 80 | 80 | 80 | 80 | 1.00 [0.95, 1.00] | 0 | 0 |
| layered | MO-C04n | – | 40 | 677/677 | 40 | 40 | 40 | 0 | n/a | 0 | 0 |
| layered | MO-SO01 | no | 40 | 741/749 | 80 | 80 | 80 | 78 | 0.97 [0.91, 0.99] | 0 | 0 |
| layered | MO-SO01n | – | 40 | 739/749 | 40 | 40 | 40 | 0 | n/a | 0 | 0 |
| layered | MO-CV02 | – | 40 | 0/0 | 0 | 0 | 0 | 0 | n/a | 0 | 0 |
| layered | MO-CV02n | – | 40 | 0/0 | 0 | 0 | 0 | 0 | n/a | 0 | 0 |
| layered | MO-DF01 (direction mismatch) | yes | 40 | 2197/3546 | 76 | 76 | 76 | 0 | 0.00 [0.00, 0.05] | 0 | 0 |
| layered | MO-DF01n (direction mismatch) | – | 40 | 1196/3546 | 32 | 32 | 32 | 0 | n/a | 32 | 0 |
| layered | MO-SO02 | no | 40 | 432/432 | 80 | 1 | 1 | 1 | 1.00 [0.21, 1.00] | 0 | 0 |
| layered | MO-SO02n | – | 40 | 432/432 | 40 | 2 | 2 | 0 | n/a | 0 | 0 |
| layered | MO-S03 | yes | 40 | 437/545 | 79 | 79 | 79 | 71 | 0.90 [0.81, 0.95] | 0 | 0 |
| layered | MO-S03n | – | 40 | 426/633 | 40 | 40 | 40 | 0 | n/a | 0 | 0 |
| **layered** | **all positives with a key** | | 40 | | | | 470 | 230 | **0.49 [0.44, 0.53]** | | |
| **layered** | **without the direction-mismatched operators** | | 40 | | | | 320 | 230 | **0.72 [0.67, 0.77]** | | |

## Snapshots

| Snapshot | Style | Step | Files | tsc errors (unmutated) | Baseline violations | Excluded |
|---|---|---|---|---|---|---|
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/community-radio/daedalus-mcp/run-0/step-05 | layered | 5 | 25 | 0 | 32 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/laundromat/daedalus-mcp/run-0/step-05 | layered | 5 | 11 | 0 | 15 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/lost-property/daedalus-mcp/run-0/step-05 | layered | 5 | 11 | 0 | 12 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/parking-permits/daedalus-mcp/run-0/step-05 | layered | 5 | 21 | 0 | 27 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/community-radio/daedalus-mcp/run-1/step-05 | layered | 5 | 17 | 0 | 22 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/laundromat/daedalus-mcp/run-1/step-05 | layered | 5 | 9 | 0 | 15 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/lost-property/daedalus-mcp/run-1/step-05 | layered | 5 | 17 | 0 | 19 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/parking-permits/daedalus-mcp/run-1/step-05 | layered | 5 | 19 | 0 | 36 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/community-radio/daedalus-mcp/run-2/step-05 | layered | 5 | 27 | 0 | 32 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/laundromat/daedalus-mcp/run-2/step-05 | layered | 5 | 4 | 0 | 6 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/lost-property/daedalus-mcp/run-2/step-05 | layered | 5 | 12 | 0 | 17 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/parking-permits/daedalus-mcp/run-2/step-05 | layered | 5 | 20 | 0 | 35 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/community-radio/daedalus-mcp/run-3/step-05 | layered | 5 | 23 | 0 | 29 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/laundromat/daedalus-mcp/run-3/step-05 | layered | 5 | 20 | 0 | 27 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/lost-property/daedalus-mcp/run-3/step-05 | layered | 5 | 10 | 0 | 16 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/parking-permits/daedalus-mcp/run-3/step-05 | layered | 5 | 22 | 0 | 38 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/community-radio/daedalus-mcp/run-4/step-05 | layered | 5 | 22 | 0 | 27 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/laundromat/daedalus-mcp/run-4/step-05 | layered | 5 | 8 | 0 | 10 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/lost-property/daedalus-mcp/run-4/step-05 | layered | 5 | 22 | 0 | 28 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/parking-permits/daedalus-mcp/run-4/step-05 | layered | 5 | 20 | 0 | 38 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/community-radio/daedalus-mcp/run-5/step-05 | layered | 5 | 24 | 0 | 38 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/laundromat/daedalus-mcp/run-5/step-05 | layered | 5 | 4 | 0 | 7 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/lost-property/daedalus-mcp/run-5/step-05 | layered | 5 | 13 | 0 | 18 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/parking-permits/daedalus-mcp/run-5/step-05 | layered | 5 | 19 | 0 | 20 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/community-radio/daedalus-mcp/run-6/step-05 | layered | 5 | 23 | 0 | 30 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/laundromat/daedalus-mcp/run-6/step-05 | layered | 5 | 20 | 0 | 33 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/lost-property/daedalus-mcp/run-6/step-05 | layered | 5 | 16 | 0 | 20 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/parking-permits/daedalus-mcp/run-6/step-05 | layered | 5 | 19 | 0 | 32 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/community-radio/daedalus-mcp/run-7/step-05 | layered | 5 | 20 | 0 | 25 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/laundromat/daedalus-mcp/run-7/step-05 | layered | 5 | 9 | 0 | 11 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/lost-property/daedalus-mcp/run-7/step-05 | layered | 5 | 16 | 0 | 22 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/parking-permits/daedalus-mcp/run-7/step-05 | layered | 5 | 20 | 0 | 36 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/community-radio/daedalus-mcp/run-8/step-05 | layered | 5 | 19 | 0 | 25 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/laundromat/daedalus-mcp/run-8/step-05 | layered | 5 | 16 | 0 | 32 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/lost-property/daedalus-mcp/run-8/step-05 | layered | 5 | 18 | 0 | 21 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/parking-permits/daedalus-mcp/run-8/step-05 | layered | 5 | 21 | 0 | 23 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/community-radio/daedalus-mcp/run-9/step-05 | layered | 5 | 18 | 0 | 23 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/laundromat/daedalus-mcp/run-9/step-05 | layered | 5 | 8 | 0 | 8 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/lost-property/daedalus-mcp/run-9/step-05 | layered | 5 | 15 | 0 | 20 |  |
| claude-code-cli/claude-sonnet-5-5:runs/claude-code-cli/claude-sonnet-5-5/parking-permits/daedalus-mcp/run-9/step-05 | layered | 5 | 19 | 0 | 33 |  |
