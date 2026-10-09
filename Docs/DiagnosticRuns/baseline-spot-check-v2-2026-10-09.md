# Baseline Violation Spot Check under instrument v2 (SO4 held-out baselines), seed 20261010

> **Status: informal sanity check by an agent (Claude), NOT the registered labelling.** Same standing as `baseline-spot-check-2026-10-09.md`: one agent read the cited code once and judged it; no registered labeller, prompt or audit protocol; no figure here enters a registered table. Context: ADR-026 (instrument v2, POST-HOC; final after the Fable review fixes). The sample was drawn **after** the tuning, with a **new seed**, so it does not reuse the items that motivated the tuning (two items, #8 and #12, coincide with earlier items because their function has one or few rows).

## Sample

- Source: the seven unseeded held-out baseline reports of the final instrument v2 SO4 run (prereg v10), `results/so4-heldout/v2/reports/so4-heldout-00{0..6}-*.json` (826 symbolic violations, 17 functions).
- Redraw: the first draw used the draft v2 (with an `index.ts` exemption, 824 rows). After review fix 1 dropped that glob, the same procedure and seed were re-run on the final reports; the FF-CV05 pool changed (365 → 367 rows), so item 4 changed, and the other 19 items are the same.
- Draw: pooled over the seven bases, stratified by function. The function list (sorted) is shuffled with Python 3 `random.Random("20261010")`; each function's pool is sorted by (project, file, target, discriminator, line) and shuffled with `random.Random("20261010|<functionId>")`; items are taken round-robin, one per function per turn, until 20 (17 functions in turn one, then FF-C06, FF-C01, FF-SO01 again). **Seed 20261010.**
- Code read in `../daedalus-corpus/<project>` (ghostfolio: `ghostfolio-test/apps/api`).
- Stratification gives every function the same weight: FF-CV05 is 367 of 826 rows but 1 of 20 items. The shares describe the sample, not the reports, and give no precision estimate.

## Judgements

| # | Project | Function | Location | Evidence | Verdict | Reason |
|---|---|---|---|---|---|---|
| 1 | zhuravlevma | FF-C06 | `<project>` | abstraction ratio 0 | DEBATABLE | Project-level metric with no actionable site; low abstraction is normal for an active-record application. |
| 2 | ghostfolio | FF-C01 | `models/rules/asset-class-cluster-risk/fixed-income.ts` | instability 0.5 | REAL | A domain rule imports two application services (`ExchangeRateDataService`, `I18nService`); its instability comes from outward dependencies. |
| 3 | ghostfolio | FF-SO01 | `services/benchmark/benchmark.service.ts` `BenchmarkService` | 8 methods, 6 dependencies | DEBATABLE | One over the dependency limit; the six injected services all serve benchmark data. |
| 4 | nestjslatam | FF-CV05 | `products/application/use-cases/create-product/create-product.command.ts` | no test file | FALSE ALARM | A CQRS command: a data-only message (three readonly fields copied in the constructor), nothing to unit-test. Its `*.command.ts` name is not one of the v2 conventions, so v2 still reports it (not added post hoc). The draft-v2 item here was `auth-device.controller.ts`, judged DEBATABLE. |
| 5 | ghostfolio | FF-C05 | `services/prisma/prisma.service.ts` | fan-in 29 | DEBATABLE | A 47-line client wrapper, not a god module; the fan-in shows direct ORM use across services, a design concern of a different rule. |
| 6 | nestjslatam | FF-C02 | `orders/domain/order-aggregate/order.ts` | fan-out 12 | DEBATABLE | A 630-line aggregate root; its imports are almost all its own entities, value objects, events and validators. |
| 7 | dry-run | FF-P03 | `session/.../document/repositories/session.repository.ts` `SessionDocumentRepository` | no implemented interface | FALSE ALARM | It `implements SessionRepository`, an abstract-class port (the NestJS DI idiom); the template counts only `Interface` targets. |
| 8 | ghostfolio | FF-SO02 | `services/data-provider/interfaces/data-provider.interface.ts` | 10 methods | REAL | As the 2026-10-09 check #11: nine implementers, stub methods, a fat interface. |
| 9 | dry-run | FF-C03 | `users/.../relational/repositories/user.repository.ts` | instability 0.875 | FALSE ALARM | An edge adapter imported only by its module file; being unstable is correct for it. |
| 10 | valex | FF-S03 | `middlewares/apiKeyValidator.ts` → `repositories/companyRepository.ts` | import | REAL | Presentation middleware reads the repository directly, skipping the service layer of the layered spec. |
| 11 | ghostfolio | FF-S01 | `services/queues/portfolio-snapshot/portfolio-snapshot.module.ts` → `app/account-balance/account-balance.module.ts` | import | DEBATABLE | Module-to-module DI wiring, but it exposes a queue service in `services/` that needs an `app/` feature. |
| 12 | ghostfolio | FF-C04 | `services/data-provider/rapid-api/interfaces/interfaces.ts` | orphan | REAL | As the 2026-10-09 check #19: dead file. |
| 13 | realworld | FF-S02 | `article.entity.ts` ↔ `comment.entity.ts` | 2-cycle | DEBATABLE | As the 2026-10-09 check #3: ORM bidirectional relation inside one aggregate. |
| 14 | dry-run | FF-P01 | `session/infrastructure/persistence/relational/entities/session.entity.ts` → `typeorm` | import | FALSE ALARM | An ORM persistence entity under `infrastructure/` (a separate domain model exists in `session/domain/`); the spec's `**/*.entity.ts` file pattern maps it to the domain because `src/infrastructure/**` does not match nested feature folders. Spec mapping error. |
| 15 | zhuravlevma | FF-P04 | `delivery/deliveryman/services/change-deliverymans-status.ts` | depends on `DeliverymanRepository` | DEBATABLE | A concrete repository dependency, which is the project's declared active-record style. |
| 16 | ghostfolio | FF-S04 | `models/rules/regional-market-cluster-risk/emerging-markets.ts` → `exchange-rate-data.service.ts` | import | REAL | As the 2026-10-09 check #20: domain → application. |
| 17 | ghostfolio | FF-P02 | `services/data-provider/google-sheets/google-sheets.service.ts` | ratio 0 | DEBATABLE | Injects concrete Nest services (idiom), as the 2026-10-09 check #15. |
| 18 | dry-run | FF-C06 | `<project>` | abstraction ratio 0.03 | DEBATABLE | As #1. |
| 19 | ghostfolio | FF-C01 | `models/rules/regional-market-cluster-risk/europe.ts` | instability 0.5 | REAL | As #2. |
| 20 | nestjslatam | FF-SO01 | `libs/ddd/src/valueobjects/id.valueobject.ts` `IdValueObject` | 14 methods, 0 dependencies | FALSE ALARM | Every method (factories, validation, equality, serialisation) serves one identity value. |

## Summary

| Verdict | Count (20) | Share | 2026-10-09 check (v1, seed 20261009, 2 projects) |
|---|---|---|---|
| REAL | 6 | 30 % | 6 (30 %) |
| FALSE ALARM | 5 | 25 % | 6 (30 %) |
| DEBATABLE | 9 | 45 % | 8 (40 %) |

- The false alarms come from FF-CV05 on a data-only file outside the v2 naming conventions (a CQRS command), FF-P03 (abstract-class ports), FF-C03 (a leaf adapter with only a module importer), FF-P01 (a spec layer-mapping error on nested `infrastructure/` folders) and FF-SO01 (a value object). ADR-026 records why the last four rules stay unchanged; the first shows the naming conventions do not cover every data-only file.
- The two samples differ in seed, pool (two projects vs seven) and instrument, so the shares are not a before/after comparison. The registered P2 labelling stays the measurement of baseline precision.
