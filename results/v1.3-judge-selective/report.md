| Judge | Items | Class | Scored | Coverage (unanimous) | Accuracy, unanimous | Accuracy, split (2-1) | Incomplete |
|---|---|---|---|---|---|---|---|
| v1 | CHECK | all | 63 | 60/63 = 0.95 [0.87, 0.98] | 53/60 = 0.88 [0.78, 0.94] | 3/3 = 1.00 [0.44, 1.00] | 0 |
| v1 | CHECK | seed (catch) | 14 | 14/14 = 1.00 [0.78, 1.00] | 13/14 = 0.93 [0.69, 0.99] | — | 0 |
| v1 | CHECK | twin | 23 | 21/23 = 0.91 [0.73, 0.98] | 17/21 = 0.81 [0.60, 0.92] | 2/2 = 1.00 [0.34, 1.00] | 0 |
| v1 | CHECK | clean | 26 | 25/26 = 0.96 [0.81, 0.99] | 23/25 = 0.92 [0.75, 0.98] | 1/1 = 1.00 [0.21, 1.00] | 0 |
| v1 | CHECK | twin + clean (false fail) | 49 | 46/49 = 0.94 [0.83, 0.98] | 40/46 = 0.87 [0.74, 0.94] | 3/3 = 1.00 [0.44, 1.00] | 0 |
| v2.1 | CHECK | all | 63 | 60/63 = 0.95 [0.87, 0.98] | 54/60 = 0.90 [0.80, 0.95] | 0/3 = 0.00 [0.00, 0.56] | 0 |
| v2.1 | CHECK | seed (catch) | 14 | 14/14 = 1.00 [0.78, 1.00] | 14/14 = 1.00 [0.78, 1.00] | — | 0 |
| v2.1 | CHECK | twin | 23 | 22/23 = 0.96 [0.79, 0.99] | 18/22 = 0.82 [0.61, 0.93] | 0/1 = 0.00 [0.00, 0.79] | 0 |
| v2.1 | CHECK | clean | 26 | 24/26 = 0.92 [0.76, 0.98] | 22/24 = 0.92 [0.74, 0.98] | 0/2 = 0.00 [0.00, 0.66] | 0 |
| v2.1 | CHECK | twin + clean (false fail) | 49 | 46/49 = 0.94 [0.83, 0.98] | 40/46 = 0.87 [0.74, 0.94] | 0/3 = 0.00 [0.00, 0.56] | 0 |
| v1 | TUNE | all | 105 | 102/105 = 0.97 [0.92, 0.99] | 87/102 = 0.85 [0.77, 0.91] | 3/3 = 1.00 [0.44, 1.00] | 0 |
| v1 | TUNE | seed (catch) | 31 | 29/31 = 0.94 [0.79, 0.98] | 24/29 = 0.83 [0.65, 0.92] | 2/2 = 1.00 [0.34, 1.00] | 0 |
| v1 | TUNE | twin | 38 | 38/38 = 1.00 [0.91, 1.00] | 31/38 = 0.82 [0.67, 0.91] | — | 0 |
| v1 | TUNE | clean | 36 | 35/36 = 0.97 [0.86, 1.00] | 32/35 = 0.91 [0.78, 0.97] | 1/1 = 1.00 [0.21, 1.00] | 0 |
| v1 | TUNE | twin + clean (false fail) | 74 | 73/74 = 0.99 [0.93, 1.00] | 63/73 = 0.86 [0.77, 0.92] | 1/1 = 1.00 [0.21, 1.00] | 0 |
| v1 | ALL | all | 168 | 162/168 = 0.96 [0.92, 0.98] | 140/162 = 0.86 [0.80, 0.91] | 6/6 = 1.00 [0.61, 1.00] | 0 |
| v1 | ALL | seed (catch) | 45 | 43/45 = 0.96 [0.85, 0.99] | 37/43 = 0.86 [0.73, 0.93] | 2/2 = 1.00 [0.34, 1.00] | 0 |
| v1 | ALL | twin | 61 | 59/61 = 0.97 [0.89, 0.99] | 48/59 = 0.81 [0.70, 0.89] | 2/2 = 1.00 [0.34, 1.00] | 0 |
| v1 | ALL | clean | 62 | 60/62 = 0.97 [0.89, 0.99] | 55/60 = 0.92 [0.82, 0.96] | 2/2 = 1.00 [0.34, 1.00] | 0 |
| v1 | ALL | twin + clean (false fail) | 123 | 119/123 = 0.97 [0.92, 0.99] | 103/119 = 0.87 [0.79, 0.92] | 4/4 = 1.00 [0.51, 1.00] | 0 |

Decision rule (fixed before computing; CHECK, all classes): unanimous accuracy >= 0.9, Wilson lower bound >= 0.8, coverage >= 0.6.

| Judge | Unanimous accuracy | Wilson low | Coverage | Rule met |
|---|---|---|---|---|
| v1 | 0.88 | 0.78 | 0.95 | no |
| v2.1 | 0.90 | 0.80 | 0.95 | no |

What an agent would see (CHECK), per 10 units submitted:

| Judge | Clean units: false alarms, all shown | Clean units: false alarms, unanimous only | Twin units: false alarms, all / unanimous only | Seeded units: catches, all shown | Seeded units: catches, unanimous only |
|---|---|---|---|---|---|
| v1 | 0.8 | 0.8 | 1.7 / 1.7 | 9.3 | 9.3 |
| v2.1 | 1.5 | 0.8 | 2.2 / 1.7 | 10.0 | 10.0 |

v1 run matching: unique 135, ambiguous-same-votes 29, unresolved 0, override 4.

Wrong CHECK verdicts (judge, class, operator, item, fail votes of valid runs):
- v2.1 twin AP-DUP-RULE2n `dv2|e1__claude-sonnet-5-5.task-management.minimal-prose.run-0__AP-DUP-RULE2n__0|FF-N01|src/application`: 3/3 fail (unanimous)
- v1 twin AP-PERSIST-IN-DOMAINn `r1|antipattern-nest__AP-PERSIST-IN-DOMAINn__0|FF-N02|src/invoice/invoice.entity.ts`: 3/3 fail (unanimous)
- v2.1 twin AP-PERSIST-IN-DOMAINn `r1|antipattern-nest__AP-PERSIST-IN-DOMAINn__0|FF-N02|src/invoice/invoice.entity.ts`: 3/3 fail (unanimous)
- v1 twin AP-PERSIST-IN-DOMAINn `r1|antipattern-nest__AP-PERSIST-IN-DOMAINn__2|FF-N02|src/order/order.entity.ts`: 3/3 fail (unanimous)
- v2.1 twin AP-PERSIST-IN-DOMAINn `r1|antipattern-nest__AP-PERSIST-IN-DOMAINn__2|FF-N02|src/order/order.entity.ts`: 3/3 fail (unanimous)
- v1 clean clean `r1|base:antipattern-nest|FF-N02|src/invoice/invoice.entity.ts`: 3/3 fail (unanimous)
- v2.1 clean clean `r1|base:antipattern-nest|FF-N02|src/invoice/invoice.entity.ts`: 3/3 fail (unanimous)
- v1 clean clean `r1|base:antipattern-nest|FF-N02|src/order/order.entity.ts`: 3/3 fail (unanimous)
- v2.1 clean clean `r1|base:antipattern-nest|FF-N02|src/order/order.entity.ts`: 3/3 fail (unanimous)
- v2.1 clean clean `r1|base:layered/clean|FF-N02|src/business/services/OrderService.ts`: 2/3 fail (split)
- v2.1 twin AP-PERSIST-IN-DOMAINn `r1|layered__clean__AP-PERSIST-IN-DOMAINn__0|FF-N02|src/business/services/OrderService.ts`: 2/3 fail (split)
- v2.1 clean clean `r2|base:layered/clean|FF-N02|src/business/services/OrderService.ts`: 2/3 fail (split)
- v1 seed AP-FRAMEWORK-LEAK `r2|e1__claude-opus-5-5.order-fulfilment.minimal-prose.run-0__AP-FRAMEWORK-LEAK__0|FF-N02|src/application/AdvanceOrderUseCase.ts`: 0/3 fail (unanimous)
- v1 twin AP-DUP-RULEn `r2|e1__claude-sonnet-5-5.order-fulfilment.minimal-prose.run-0__AP-DUP-RULEn__1|FF-N01|src/application`: 3/3 fail (unanimous)
- v1 twin AP-DUP-RULEn `r2|e1__claude-sonnet-5-5.task-management.minimal-prose.run-0__AP-DUP-RULEn__0|FF-N01|src/application`: 3/3 fail (unanimous)
- v2.1 twin AP-DUP-RULEn `r2|e1__claude-sonnet-5-5.task-management.minimal-prose.run-0__AP-DUP-RULEn__0|FF-N01|src/application`: 3/3 fail (unanimous)
