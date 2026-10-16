Split TUNE: 105 items; unit verdict: v1 = majority of 3 runs (recorded), v2 = run 0 only; v2 = tune-v2.0.

| Judge | Catch | Paired catch | Twin false fail | Paired twin false fail | Clean false fail (units) | Invalid units |
|---|---|---|---|---|---|---|
| v1 | 26/30 = 0.87 [0.70, 0.95] | 24/30 = 0.80 [0.63, 0.90] | 6/35 = 0.17 [0.08, 0.33] | 4/35 = 0.11 [0.05, 0.26] | 3/36 = 0.08 [0.03, 0.22] | 0 |
| v2 | 30/30 = 1.00 [0.89, 1.00] | 22/30 = 0.73 [0.56, 0.86] | 8/35 = 0.23 [0.12, 0.39] | 0/35 = 0.00 [0.00, 0.10] | 7/36 = 0.19 [0.10, 0.35] | 0 |
| v1, without the v1 AP-DUP-RULEn twins | 26/30 = 0.87 [0.70, 0.95] | 24/30 = 0.80 [0.63, 0.90] | 2/31 = 0.06 [0.02, 0.21] | 1/31 = 0.03 [0.01, 0.16] | 3/36 = 0.08 [0.03, 0.22] | 0 |
| v2, without the v1 AP-DUP-RULEn twins | 30/30 = 1.00 [0.89, 1.00] | 22/30 = 0.73 [0.56, 0.86] | 6/31 = 0.19 [0.09, 0.36] | 0/31 = 0.00 [0.00, 0.11] | 7/36 = 0.19 [0.10, 0.35] | 0 |

| Operator family | Judge | Catch | Twin false fail |
|---|---|---|---|
| AP-DUP-RULE | v1 | 6/6 = 1.00 [0.61, 1.00] | 4/4 = 1.00 [0.51, 1.00] |
| AP-DUP-RULE | v2 | 6/6 = 1.00 [0.61, 1.00] | 2/4 = 0.50 [0.15, 0.85] |
| AP-DUP-RULE2 | v1 | 6/6 = 1.00 [0.61, 1.00] | 2/6 = 0.33 [0.10, 0.70] |
| AP-DUP-RULE2 | v2 | 6/6 = 1.00 [0.61, 1.00] | 2/6 = 0.33 [0.10, 0.70] |
| AP-FAT-CONTROLLER | v1 | 1/1 = 1.00 [0.21, 1.00] | 0/1 = 0.00 [0.00, 0.79] |
| AP-FAT-CONTROLLER | v2 | 1/1 = 1.00 [0.21, 1.00] | 0/1 = 0.00 [0.00, 0.79] |
| AP-FRAMEWORK-LEAK | v1 | 5/8 = 0.63 [0.31, 0.86] | 0/18 = 0.00 [0.00, 0.18] |
| AP-FRAMEWORK-LEAK | v2 | 8/8 = 1.00 [0.68, 1.00] | 4/18 = 0.22 [0.09, 0.45] |
| AP-PERSIST-IN-DOMAIN | v1 | 1/1 = 1.00 [0.21, 1.00] | 0/2 = 0.00 [0.00, 0.66] |
| AP-PERSIST-IN-DOMAIN | v2 | 1/1 = 1.00 [0.21, 1.00] | 0/2 = 0.00 [0.00, 0.66] |
| AP-REPO-BYPASS | v1 | 4/4 = 1.00 [0.51, 1.00] | 0/4 = 0.00 [0.00, 0.49] |
| AP-REPO-BYPASS | v2 | 4/4 = 1.00 [0.51, 1.00] | 0/4 = 0.00 [0.00, 0.49] |
| hand-planted | v1 | 3/4 = 0.75 [0.30, 0.95] | — |
| hand-planted | v2 | 4/4 = 1.00 [0.51, 1.00] | — |

Items whose verdict differs (v1 → v2):
- clean clean dv2 base:e1/gpt-5.6-terra.order-fulfilment.minimal-prose.run-2 FF-N01 src/application: pass → fail
- twin AP-DUP-RULE2n dv2 e1__claude-haiku-4-5.order-fulfilment.minimal-prose.run-2__AP-DUP-RULE2n__0 FF-N01 src/application/usecases: fail → pass
- twin AP-DUP-RULE2n dv2 e1__claude-sonnet-5-5.order-fulfilment.full-aac.run-1__AP-DUP-RULE2n__0 FF-N01 src/application: fail → pass
- twin AP-DUP-RULE2n dv2 e1__gpt-5.6-terra.order-fulfilment.minimal-prose.run-2__AP-DUP-RULE2n__0 FF-N01 src/application: pass → fail
- twin AP-DUP-RULEn r1 antipattern-nest__AP-DUP-RULEn__0 FF-N01 src/invoice#application: fail → pass
- seed AP-FAT-CONTROLLER r1 antipattern-nest__AP-FAT-CONTROLLER__0 FF-N02 src/order/order.service.ts: pass → fail
- seed AP-FRAMEWORK-LEAK r1 antipattern-nest__AP-FRAMEWORK-LEAK__0 FF-N02 src/invoice/invoice.service.ts: pass → fail
- seed AP-FRAMEWORK-LEAK r1 antipattern-nest__AP-FRAMEWORK-LEAK__1 FF-N02 src/invoice/invoice.service.ts: pass → fail
- twin AP-FRAMEWORK-LEAKn r1 antipattern-nest__AP-FRAMEWORK-LEAKn__0 FF-N02 src/invoice/invoice.service.ts: pass → fail
- twin AP-FRAMEWORK-LEAKn r1 antipattern-nest__AP-FRAMEWORK-LEAKn__1 FF-N02 src/invoice/invoice.service.ts: pass → fail
- twin AP-FRAMEWORK-LEAKn r1 antipattern-nest__AP-FRAMEWORK-LEAKn__2 FF-N02 src/order/order.service.ts: pass → fail
- twin AP-FRAMEWORK-LEAKn r1 antipattern-nest__AP-FRAMEWORK-LEAKn__3 FF-N02 src/order/order.service.ts: pass → fail
- clean clean r1 base:antipattern-nest FF-N02 src/invoice/invoice.service.ts: pass → fail
- clean clean r1 base:antipattern-nest FF-N02 src/order/order.service.ts: pass → fail
- clean clean r2 base:e1/gpt-5.6-terra.order-fulfilment.minimal-prose.run-2 FF-N01 src/application: pass → fail
- seed AP-FRAMEWORK-LEAK r2 e1__claude-haiku-4-5.order-fulfilment.none.run-0__AP-FRAMEWORK-LEAK__0 FF-N02 src/application/CancelOrderUseCase.ts: pass → fail
- twin AP-DUP-RULEn r2 e1__claude-sonnet-5-5.order-fulfilment.minimal-prose.run-1__AP-DUP-RULEn__0 FF-N01 src/application: fail → pass
- seed HP:hexagonal/v07-domain-service-nestjs-decorator r2 hp__hexagonal__v07 FF-N02 src/domain/services/AvailabilityChecker.ts: pass → fail
