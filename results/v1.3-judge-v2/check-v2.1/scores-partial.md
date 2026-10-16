Split CHECK: 41 items; unit verdict: v1 = majority of 3 runs (recorded), v2 = majority of 3 runs; v2 = check-v2.1; v1 override = check-v1-current-graph.

| Judge | Catch | Paired catch | Twin false fail | Paired twin false fail | Clean false fail (units) | Invalid units |
|---|---|---|---|---|---|---|
| v1 | 3/3 = 1.00 [0.44, 1.00] | 3/3 = 1.00 [0.44, 1.00] | 2/15 = 0.13 [0.04, 0.38] | 0/15 = 0.00 [0.00, 0.20] | 2/21 = 0.10 [0.03, 0.29] | 0 |
| v2 | 3/3 = 1.00 [0.44, 1.00] | 3/3 = 1.00 [0.44, 1.00] | 4/15 = 0.27 [0.11, 0.52] | 1/15 = 0.07 [0.01, 0.30] | 3/21 = 0.14 [0.05, 0.35] | 0 |
| v1, without the v1 AP-DUP-RULEn twins | 3/3 = 1.00 [0.44, 1.00] | 3/3 = 1.00 [0.44, 1.00] | 2/15 = 0.13 [0.04, 0.38] | 0/15 = 0.00 [0.00, 0.20] | 2/21 = 0.10 [0.03, 0.29] | 0 |
| v2, without the v1 AP-DUP-RULEn twins | 3/3 = 1.00 [0.44, 1.00] | 3/3 = 1.00 [0.44, 1.00] | 4/15 = 0.27 [0.11, 0.52] | 1/15 = 0.07 [0.01, 0.30] | 3/21 = 0.14 [0.05, 0.35] | 0 |

| Operator family | Judge | Catch | Twin false fail |
|---|---|---|---|
| AP-DUP-RULE2 | v1 | 3/3 = 1.00 [0.44, 1.00] | 0/3 = 0.00 [0.00, 0.56] |
| AP-DUP-RULE2 | v2 | 3/3 = 1.00 [0.44, 1.00] | 1/3 = 0.33 [0.06, 0.79] |
| AP-FRAMEWORK-LEAK | v1 | — | 0/7 = 0.00 [0.00, 0.35] |
| AP-FRAMEWORK-LEAK | v2 | — | 0/7 = 0.00 [0.00, 0.35] |
| AP-PERSIST-IN-DOMAIN | v1 | — | 2/5 = 0.40 [0.12, 0.77] |
| AP-PERSIST-IN-DOMAIN | v2 | — | 3/5 = 0.60 [0.23, 0.88] |

Items whose verdict differs (v1 → v2):
- twin AP-DUP-RULE2n dv2 e1__claude-sonnet-5-5.task-management.minimal-prose.run-0__AP-DUP-RULE2n__0 FF-N01 src/application: pass → fail
- clean clean r1 base:layered/clean FF-N02 src/business/services/OrderService.ts: pass → fail
- twin AP-PERSIST-IN-DOMAINn r1 layered__clean__AP-PERSIST-IN-DOMAINn__0 FF-N02 src/business/services/OrderService.ts: pass → fail
