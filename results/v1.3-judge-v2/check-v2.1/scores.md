Split CHECK: 63 items; unit verdict: v1 = majority of 3 runs (recorded), v2 = majority of 3 runs; v2 = check-v2.1; v1 override = check-v1-current-graph.

| Judge | Catch | Paired catch | Twin false fail | Paired twin false fail | Clean false fail (units) | Invalid units |
|---|---|---|---|---|---|---|
| v1 | 13/14 = 0.93 [0.69, 0.99] | 13/14 = 0.93 [0.69, 0.99] | 4/21 = 0.19 [0.08, 0.40] | 2/21 = 0.10 [0.03, 0.29] | 2/26 = 0.08 [0.02, 0.24] | 0 |
| v2 | 14/14 = 1.00 [0.78, 1.00] | 13/14 = 0.93 [0.69, 0.99] | 5/21 = 0.24 [0.11, 0.45] | 2/21 = 0.10 [0.03, 0.29] | 4/26 = 0.15 [0.06, 0.34] | 0 |
| v1, without the v1 AP-DUP-RULEn twins | 13/14 = 0.93 [0.69, 0.99] | 13/14 = 0.93 [0.69, 0.99] | 2/19 = 0.11 [0.03, 0.31] | 0/19 = 0.00 [0.00, 0.17] | 2/26 = 0.08 [0.02, 0.24] | 0 |
| v2, without the v1 AP-DUP-RULEn twins | 14/14 = 1.00 [0.78, 1.00] | 13/14 = 0.93 [0.69, 0.99] | 4/19 = 0.21 [0.09, 0.43] | 1/19 = 0.05 [0.01, 0.25] | 4/26 = 0.15 [0.06, 0.34] | 0 |

| Operator family | Judge | Catch | Twin false fail |
|---|---|---|---|
| AP-DUP-RULE | v1 | 3/3 = 1.00 [0.44, 1.00] | 2/2 = 1.00 [0.34, 1.00] |
| AP-DUP-RULE | v2 | 3/3 = 1.00 [0.44, 1.00] | 1/2 = 0.50 [0.09, 0.91] |
| AP-DUP-RULE2 | v1 | 3/3 = 1.00 [0.44, 1.00] | 0/3 = 0.00 [0.00, 0.56] |
| AP-DUP-RULE2 | v2 | 3/3 = 1.00 [0.44, 1.00] | 1/3 = 0.33 [0.06, 0.79] |
| AP-FRAMEWORK-LEAK | v1 | 3/4 = 0.75 [0.30, 0.95] | 0/11 = 0.00 [0.00, 0.26] |
| AP-FRAMEWORK-LEAK | v2 | 4/4 = 1.00 [0.51, 1.00] | 0/11 = 0.00 [0.00, 0.26] |
| AP-PERSIST-IN-DOMAIN | v1 | — | 2/5 = 0.40 [0.12, 0.77] |
| AP-PERSIST-IN-DOMAIN | v2 | — | 3/5 = 0.60 [0.23, 0.88] |
| hand-planted | v1 | 4/4 = 1.00 [0.51, 1.00] | — |
| hand-planted | v2 | 4/4 = 1.00 [0.51, 1.00] | — |

Items whose verdict differs (v1 → v2):
- twin AP-DUP-RULE2n dv2 e1__claude-sonnet-5-5.task-management.minimal-prose.run-0__AP-DUP-RULE2n__0 FF-N01 src/application: pass → fail
- clean clean r1 base:layered/clean FF-N02 src/business/services/OrderService.ts: pass → fail
- twin AP-PERSIST-IN-DOMAINn r1 layered__clean__AP-PERSIST-IN-DOMAINn__0 FF-N02 src/business/services/OrderService.ts: pass → fail
- clean clean r2 base:layered/clean FF-N02 src/business/services/OrderService.ts: pass → fail
- seed AP-FRAMEWORK-LEAK r2 e1__claude-opus-5-5.order-fulfilment.minimal-prose.run-0__AP-FRAMEWORK-LEAK__0 FF-N02 src/application/AdvanceOrderUseCase.ts: pass → fail
- twin AP-DUP-RULEn r2 e1__claude-sonnet-5-5.order-fulfilment.minimal-prose.run-0__AP-DUP-RULEn__1 FF-N01 src/application: fail → pass
