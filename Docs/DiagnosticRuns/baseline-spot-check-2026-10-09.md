# Baseline Violation Spot Check (SO4 held-out baselines), 2026-10-09

> **Status: informal sanity check by an agent (Claude), NOT the registered labelling.** It does not replace the P2 baseline-precision labelling (`Docs/analysis-plan.md` §3, ADR-020 item 1), uses no registered labeller, prompt or audit protocol, and no figure here enters a registered table. One agent read the cited code once and judged it. Context: ADR-025 ("Fix scoring, spot-check, then decide E7").

## Sample

- Source: the unseeded baseline reports `results/so4-heldout/reports/so4-heldout-000-realworld-test.json` (41 symbolic violations) and `so4-heldout-001-ghostfolio-test.json` (436), symbolic-only run of PR #40.
- Draw: 10 per project, stratified across functions: functions shuffled with `random.Random("20261009|<projectId>")` (Python 3), then taken round-robin, one violation per turn from each function's shuffled pool (pool sorted by file, target, discriminator, line before shuffling). **Seed 20261009.**
- Code read in `../daedalus-corpus/realworld-test/src` and `../daedalus-corpus/ghostfolio-test/apps/api/src`.
- Stratification over-weights rare functions: FF-CV05 is 25 of 41 (realworld) and 202 of 436 (ghostfolio) violations but 3 of 20 items here. The shares below describe the sample, not the reports.

## Judgements

| # | Project | Function | Location | Evidence | Verdict | Reason |
|---|---|---|---|---|---|---|
| 1 | realworld | FF-SO01 | `article/article.service.ts` `ArticleService` | 12 methods | DEBATABLE | One service for articles, comments and favourites, but all on the Article aggregate (CRUD shape). |
| 2 | realworld | FF-CV05 | `article/dto/create-article.dto.ts` | no test file | FALSE ALARM | A plain DTO has no behaviour to test; test pairing is not expected there. |
| 3 | realworld | FF-S02 | `article.entity.ts` ↔ `comment.entity.ts` | 2-cycle | DEBATABLE | Bidirectional TypeORM relation inside one aggregate and module; ORM idiom. |
| 4 | realworld | FF-C06 | `<project>` | abstraction ratio 0.25 | DEBATABLE | Low abstraction is normal for an application; project-level metric, no actionable site. |
| 5 | realworld | FF-P01 | `user/user.entity.ts` → `typeorm` | import | DEBATABLE | Spec maps `*.entity.ts` to domain; there is no separate domain model, so the ORM entity is the domain. A violation by the spec, idiomatic for NestJS + TypeORM. |
| 6 | realworld | FF-C03 | `app.module.ts` | instability 0.83 | FALSE ALARM | The composition root should be maximally unstable; high instability alone is not a violation. |
| 7 | realworld | FF-SO01 | `article/article.controller.ts` `ArticleController` | 11 methods | FALSE ALARM | One handler per REST route; method count does not measure controller responsibility. |
| 8 | realworld | FF-CV05 | `user/dto/update-user.dto.ts` | no test file | FALSE ALARM | DTO, as #2. |
| 9 | realworld | FF-S02 | `article.entity.ts` ↔ `user.entity.ts` | 2-cycle | REAL | Cross-module cycle between the article and user feature modules (author / favourites back-references). |
| 10 | realworld | FF-P01 | `article/comment.entity.ts` → `typeorm` | import | DEBATABLE | As #5. |
| 11 | ghostfolio | FF-SO02 | `services/data-provider/interfaces/data-provider.interface.ts` | 10 methods | REAL | Nine implementers; some stub methods (e.g. RapidApi `getDividends` returns `{}`), a fat-interface ISP smell. |
| 12 | ghostfolio | FF-C02 | `app/admin/admin.module.ts` | fan-out 16 | FALSE ALARM | A Nest module file is DI wiring; its imports list feature modules, not code coupling. |
| 13 | ghostfolio | FF-P01 | `models/rules/account-cluster-risk/current-investment.ts` → `@prisma/client` | import | REAL | Domain rule typed on the Prisma-generated `Account` model, coupling domain logic to the persistence schema. |
| 14 | ghostfolio | FF-CV05 | `app/portfolio/rules.service.ts` | no test file | DEBATABLE | A behavioural service without a test is a hygiene finding, not an architectural one. |
| 15 | ghostfolio | FF-P02 | `app/redis-cache/redis-cache.service.ts` `RedisCacheService` | ratio 0 | DEBATABLE | Injects concrete `ConfigurationService` (Nest idiom); the `Cache` interface it also takes is not counted as an abstraction. |
| 16 | ghostfolio | FF-C06 | `<project>` | abstraction ratio 0.17 | DEBATABLE | As #4. |
| 17 | ghostfolio | FF-C03 | `services/cron/cron.service.ts` | instability 0.875 | FALSE ALARM | Leaf scheduler with no importers; being unstable is correct for it (SDP is not broken). |
| 18 | ghostfolio | FF-S01 | `models/rules/regional-market-cluster-risk/asia-pacific.ts` → `exchange-rate-data.service.ts` | import | REAL | Domain rule depends on a concrete application service through its constructor. |
| 19 | ghostfolio | FF-C04 | `services/data-provider/rapid-api/interfaces/interfaces.ts` | orphan | REAL | `export interface RapidApiResponse {}`, imported by nothing: dead file. |
| 20 | ghostfolio | FF-S04 | `models/rules/asset-class-cluster-risk/equity.ts` → `exchange-rate-data.service.ts` | import | REAL | As #18 (domain → application). |

## Summary

| Verdict | realworld (10) | ghostfolio (10) | Total (20) | Share |
|---|---|---|---|---|
| REAL | 1 | 5 | 6 | 30 % |
| FALSE ALARM | 4 | 2 | 6 | 30 % |
| DEBATABLE | 5 | 3 | 8 | 40 % |

- **Dependency and purity rules hold up**: FF-S01, FF-S04, FF-SO02, FF-C04 and FF-P01 on ghostfolio were real. FF-P01 on realworld is debatable only because its spec calls TypeORM entities "domain".
- **False alarms come from**: FF-CV05 test-file-pairing on DTOs (#2, #8), FF-C03 component-instability on composition roots and leaf components (#6, #17), FF-SO01 method count on a REST controller (#7), and FF-C02 module fan-out on a Nest module file (#12). These are the metric and convention proxies (FPAT-COUPLING and convention). FF-CV05 is the largest single source of baseline volume (227 of 477 violations), so its false-alarm rate dominates the baseline precision more than this stratified sample shows.
- **Debatable items** are mostly project-level metrics (FF-C06) and the NestJS ORM-entity idiom read under a domain-purity rule.
- This check gives no estimate of baseline precision. The registered P2 labelling stays the measurement.
