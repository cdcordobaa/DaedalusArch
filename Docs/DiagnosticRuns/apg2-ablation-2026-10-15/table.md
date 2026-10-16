| Case | Kind | Template | APG v2 | APG v1.3 graph (template) | v1.3 rules at locus | v1.3 edge between locus files | dep-cruiser (translated) | dep-cruiser (hand-written) | Pass |
|---|---|---|---|---|---|---|---|---|---|
| TF1 | planted | boundary-type-leak | yes | no | no | none | no | no | pass |
| TF2 | planted | boundary-type-leak | yes | no | no | none | no | no | pass |
| TF3 | planted | boundary-type-leak | yes | no | no | none | no | no | pass |
| TF4 | planted | boundary-type-leak | yes | no | no | none | no | no | pass |
| TF5 | planted | boundary-type-leak | yes | no | no | IMPORTS | no | yes (H-presentation-no-persistence-model: src/presentation/admin.controller.ts -> src/infrastructure/user.record.ts) | pass |
| NM-TF1 | near-miss | boundary-type-leak | no | no | no | n/a | no | no | pass |
| NM-TF2 | near-miss | boundary-type-leak | no | no | no | n/a | no | no | pass |
| NM-TF3 | near-miss | boundary-type-leak | no | no | no | n/a | no | no | pass |
| NM-TF4 | near-miss | boundary-type-leak | no | no | no | n/a | no | no | pass |
| CP1 | planted | component-adp-cycle | yes | no | no | IMPORTS, FLOWS_TO | no | yes (H-folder-cycle: src/shipping -> src/billing) | pass |
| CP2 | planted | component-adp-cycle | yes | no | no | IMPORTS, FLOWS_TO | no | yes (H-folder-cycle: src/promo -> src/catalog; H-folder-sdp: src/promo -> src/catalog) | pass |
| CP3 | planted | component-sdp-violation | yes | no | no | IMPORTS, FLOWS_TO | no | yes (H-folder-sdp: src/kernel -> src/plugins) | pass |
| CP4 | planted | component-main-sequence-distance | yes | no | no | n/a | no | no | pass |
| CP5 | planted | component-main-sequence-distance | yes | no | no | n/a | no | no | pass |
| NM-CP1 | near-miss | component-adp-cycle | no | no | yes (no-cyclic-deps: src/audit/a.ts -> src/audit/b.ts) | IMPORTS, IMPORTS | yes (FF-S02--cycle: src/audit/a.ts -> src/audit/b.ts) | yes (H-module-cycle: src/audit/a.ts -> src/audit/b.ts) | pass |
| NM-CP2 | near-miss | component-sdp-violation | no | no | no | n/a | no | no | pass |
| NM-CP3 | near-miss | component-main-sequence-distance | no | no | no | n/a | no | no | pass |
| CP6 | planted | component-adp-cycle | yes | no | no | IMPORTS, FLOWS_TO | no | no | pass |
| PA1 | planted | deep-import-declared-api | yes | no | no | IMPORTS, FLOWS_TO | no | yes (H-deep-import: src/checkout/checkout.ts -> src/orders/internal/order-repo.ts) | pass |
| PA2 | planted | deep-import-inferred-api | yes | no | no | IMPORTS, FLOWS_TO | no | yes (H-deep-import: src/checkout/checkout.ts -> src/payments/gateway/stripe.ts) | pass |
| PA3 | planted | deep-import-declared-api | yes | no | no | IMPORTS | no | yes (H-deep-import: src/checkout/summary.ts -> src/orders/internal/order-row.ts) | pass |
| PA4 | planted | deep-import-declared-api | yes | no | no | IMPORTS, FLOWS_TO | no | yes (H-deep-import: src/reports/report.ts -> src/orders/internal/order-repo.ts) | pass |
| NM-PA1 | near-miss | deep-import-declared-api | no | no | no | n/a | no | no | pass |
| NM-PA2 | near-miss | deep-import-inferred-api | no | no | no | n/a | no | no | pass |
| NM-PA3 | near-miss | deep-import-declared-api | no | no | no | n/a | no | no | pass |
| AS1 | planted | undeclared-async-coupling | yes | no | no | none | no | no | pass |
| AS2 | planted | undeclared-async-coupling | yes | no | no | none | no | no | pass |
| AS3 | planted | undeclared-async-coupling | yes | no | no | none | no | no | pass |
| AS4 | planted | undeclared-async-coupling | yes | no | no | none | no | no | pass |
| AS5 | planted | undeclared-async-coupling | yes | no | no | none | no | no | pass |
| NM-AS1 | near-miss | undeclared-async-coupling | no | no | no | n/a | no | no | pass |
| NM-AS2 | near-miss | undeclared-async-coupling | no | no | no | n/a | no | no | pass |
| NM-AS3 | near-miss | undeclared-async-coupling | no | no | no | n/a | no | no | pass |
| NM-AS4 | near-miss | undeclared-async-coupling | no | no | no | n/a | no | no | pass |
| IO1 | planted | nondeterminism-in-core | yes | no | no | n/a | no | no | pass |
| IO2 | planted | nondeterminism-in-core | yes | no | no | n/a | no | no | pass |
| IO3 | planted | nondeterminism-in-core | yes | no | no | n/a | no | no | pass |
| IO4 | planted | nondeterminism-in-core | yes | no | no | n/a | no | no | pass |
| IO5 | planted | io-outside-adapters | yes | no | no | n/a | no | no | pass |
| IO6 | planted | io-outside-adapters | yes | no | no | n/a | no | yes (H-core-no-io-packages: src/application/report.service.ts -> typeorm) | pass |
| IO7 | planted | io-outside-adapters | yes | no | no | n/a | no | yes (H-core-no-io-packages: src/application/report.service.ts -> fs; H-core-no-node-builtins: src/application/report.service.ts -> fs) | pass |
| NM-IO1 | near-miss | nondeterminism-in-core | no | no | no | n/a | no | no | pass |
| NM-IO2 | near-miss | nondeterminism-in-core | no | no | no | n/a | no | no | pass |
| NM-IO3 | near-miss | io-outside-adapters | no | no | yes (domain-purity: src/domain/stats.ts -> fs) | n/a | yes (FF-P01--domain--packages--0: src/domain/stats.ts -> fs) | yes (H-core-no-io-packages: src/domain/stats.ts -> fs; H-core-no-node-builtins: src/domain/stats.ts -> fs) | pass |
| NM-IO4 | near-miss | io-outside-adapters | no | no | no | n/a | no | no | pass |
| NM-IO5 | near-miss | nondeterminism-in-core | no | no | no | n/a | no | no | pass |
| CTL | control | * | no | no | no | n/a | no | no | pass |
