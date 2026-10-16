# ISE prototype: offline measurement (a)-(c), Options 1 and 3

## (a) Style classification

| Target | True style | Clean classified as | Confidence | Runner-up | Variants classified correctly |
|---|---|---|---|---|---|
| clean-architecture | clean-architecture | clean-architecture | 1.00 | layered 0.00 | 14/14 (100%) |
| layered | layered | layered | 1.00 | clean-architecture 0.00 | 13/13 (100%) |
| nestjs | nestjs | nestjs | 0.86 | clean-architecture 0.14 | 14/14 (100%) |
| hexagonal | hexagonal | hexagonal | 0.83 | clean-architecture 0.17 | 15/15 (100%) |
| ddd | ddd | ddd | 0.75 | clean-architecture 0.25 | 15/15 (100%) |
| P1-clean-architecture-renamed | clean-architecture | clean-architecture | 1.00 | layered 0.00 | 14/14 (100%) |
| P2-layered-renamed | layered | layered | 1.00 | clean-architecture 0.00 | 13/13 (100%) |
| P3-nestjs-renamed | nestjs | nestjs | 1.00 | clean-architecture 0.00 | 14/14 (100%) |
| P4-hexagonal-renamed | hexagonal | hexagonal | 1.00 | clean-architecture 0.00 | 15/15 (100%) |
| P5-ddd-renamed | ddd | ddd | 0.75 | clean-architecture 0.25 | 15/15 (100%) |

## (b) Per-file layer accuracy (clean variant vs expected-graph.json)

| Target | Preset-first | Infer-only | High-confidence accuracy (preset-first) | Wrong files (preset-first) |
|---|---|---|---|---|
| clean-architecture | 29/29 (100%) | 29/29 (100%) | 29/29 (100%) |  |
| layered | 27/27 (100%) | 27/27 (100%) | 26/26 (100%) |  |
| nestjs | 29/29 (100%) | 29/29 (100%) | 9/9 (100%) |  |
| hexagonal | 30/30 (100%) | 30/30 (100%) | 30/30 (100%) |  |
| ddd | 31/31 (100%) | 31/31 (100%) | 27/27 (100%) |  |
| P1-clean-architecture-renamed | 29/29 (100%) | 29/29 (100%) | n/a |  |
| P2-layered-renamed | 27/27 (100%) | 27/27 (100%) | n/a |  |
| P3-nestjs-renamed | 29/29 (100%) | 29/29 (100%) | n/a |  |
| P4-hexagonal-renamed | 30/30 (100%) | 30/30 (100%) | n/a |  |
| P5-ddd-renamed | 31/31 (100%) | 31/31 (100%) | 6/6 (100%) |  |

## (c) Spec equivalence (inferred vs true spec)

| Target | Spec valid | Glob differences (preset-first) | Files with another layer (preset-first) | Files with another layer (infer-only) | DDD block fields differing |
|---|---|---|---|---|---|
| clean-architecture | yes | 0 | 0/29 (0%) | 0/29 (0%) | n/a |
| layered | yes | 0 | 0/27 (0%) | 0/27 (0%) | n/a |
| nestjs | yes | 22 | 0/29 (0%) | 0/29 (0%) | n/a |
| hexagonal | yes | 0 | 0/30 (0%) | 0/30 (0%) | n/a |
| ddd | yes | 14 | 0/31 (0%) | 0/31 (0%) | 0 |
| P1-clean-architecture-renamed | yes | 0 | 0/29 (0%) | 0/29 (0%) | n/a |
| P2-layered-renamed | yes | 0 | 0/27 (0%) | 0/27 (0%) | n/a |
| P3-nestjs-renamed | yes | 23 | 0/29 (0%) | 0/29 (0%) | n/a |
| P4-hexagonal-renamed | yes | 0 | 0/30 (0%) | 0/30 (0%) | n/a |
| P5-ddd-renamed | yes | 14 | 0/31 (0%) | 0/31 (0%) | 0 |

## Options 1 and 3 on every variant (in memory)

Violation variants: planted violation touched (a new deviation names a file of an expected finding). Near-miss variants: new deviations (false alarms).

| Target | Opt 1 planted touched | Opt 1 near-miss false alarms | Opt 3 planted touched | Opt 3 near-miss false alarms |
|---|---|---|---|---|
| clean-architecture | 9/10 (90%) | 0 over 4 | 5/10 (50%) | 0 over 4 |
| layered | 9/9 (100%) | 0 over 4 | 2/9 (22%) | 0 over 4 |
| nestjs | 6/10 (60%) | 1 over 4 | 5/10 (50%) | 0 over 4 |
| hexagonal | 10/11 (91%) | 0 over 4 | 7/11 (64%) | 0 over 4 |
| ddd | 5/12 (42%) | 4 over 3 | 2/12 (17%) | 0 over 3 |
| P1-clean-architecture-renamed | 9/10 (90%) | 0 over 4 | 5/10 (50%) | 0 over 4 |
| P2-layered-renamed | 9/9 (100%) | 0 over 4 | 2/9 (22%) | 0 over 4 |
| P3-nestjs-renamed | 6/10 (60%) | 1 over 4 | 5/10 (50%) | 0 over 4 |
| P4-hexagonal-renamed | 10/11 (91%) | 0 over 4 | 7/11 (64%) | 0 over 4 |
| P5-ddd-renamed | 5/12 (42%) | 4 over 3 | 1/12 (8%) | 0 over 3 |

### clean-architecture

Units: `src/application/` = application (preset-glob; token application, structure application); `src/domain/` = domain (preset-glob; token domain, structure domain); `src/infrastructure/` = infrastructure (preset-glob; token infrastructure, structure infrastructure)

Evidence for clean-architecture: +3 top-level domain + application + infrastructure directories; +1 top-level core/domain directory; +1 top-level application/use-case directory; +1 top-level infrastructure directory; +1 use-case directory; +2 dependency inversion: 5/5 cross-unit implements point inward, one outer ring

| Variant | Kind | Classified | Opt 1 new | Opt 1 touched | Opt 3 new | Opt 3 touched |
|---|---|---|---|---|---|---|
| clean | clean | clean-architecture 1.00 | 0 |  | 0 |  |
| n01-second-composition-root-for-tests | near-miss | clean-architecture 1.00 | 0 |  | 0 |  |
| n02-report-writer-named-like-repo | near-miss | clean-architecture 1.00 | 0 |  | 0 |  |
| n03-controller-uses-dto-that-wraps-entity | near-miss | clean-architecture 1.00 | 0 |  | 0 |  |
| v01-domain-imports-application-port | violation | clean-architecture 1.00 | 2 | yes | 1 | yes |
| v02-domain-uses-infrastructure-clock | violation | clean-architecture 1.00 | 2 | yes | 1 | yes |
| v03-domain-entity-cycle | violation | clean-architecture 1.00 | 1 | yes | 0 | no |
| v04-domain-entity-typeorm-decorator | violation | clean-architecture 1.00 | 2 | yes | 0 | no |
| v05-use-case-injects-concrete-repository | violation | clean-architecture 1.00 | 3 | yes | 1 | yes |
| v06-repository-without-port | violation | clean-architecture 1.00 | 1 | yes | 0 | no |
| v07-controller-reads-entity | violation | clean-architecture 1.00 | 0 | no | 0 | no |
| v08-domain-service-holds-infrastructure-clock | violation | clean-architecture 1.00 | 2 | yes | 1 | yes |
| v09-dto-depends-on-http-adapter | violation | clean-architecture 1.00 | 2 | yes | 1 | yes |
| v10-domain-entity-type-imports-express | violation | clean-architecture 1.00 | 1 | yes | 0 | no |

### layered

Units: `src/business/` = business (preset-glob; token business, structure business); `src/main.ts` = - (none; token -, structure -); `src/persistence/` = persistence (preset-glob; token persistence, structure persistence); `src/presentation/` = presentation (preset-glob; token presentation, structure presentation)

Evidence for layered: +3 top-level presentation + business + persistence directories; +1 top-level presentation directory; +1 top-level business directory; +1 top-level persistence/data directory; +2 a chain of 4 unit levels without dependency inversion

| Variant | Kind | Classified | Opt 1 new | Opt 1 touched | Opt 3 new | Opt 3 touched |
|---|---|---|---|---|---|---|
| clean | clean | layered 1.00 | 0 |  | 0 |  |
| n01-controller-parses-money | near-miss | layered 1.00 | 0 |  | 0 |  |
| n02-reporting-service-reads-database | near-miss | layered 1.00 | 0 |  | 0 |  |
| n03-views-import-model-barrel | near-miss | layered 1.00 | 0 |  | 0 |  |
| v01-gateway-returns-business-money | violation | layered 1.00 | 2 | yes | 1 | yes |
| v02-service-renders-view | violation | layered 1.00 | 2 | yes | 1 | yes |
| v03-controller-reads-gateway | violation | layered 1.00 | 1 | yes | 0 | no |
| v04-view-types-persistence-record | violation | layered 1.00 | 1 | yes | 0 | no |
| v05-business-model-cycle | violation | layered 1.00 | 1 | yes | 0 | no |
| v06-router-controller-cycle | violation | layered 1.00 | 1 | yes | 0 | no |
| v07-business-model-typeorm-decorator | violation | layered 1.00 | 2 | yes | 0 | no |
| v08-business-service-takes-express-request | violation | layered 1.00 | 1 | yes | 0 | no |
| v09-presentation-root-builds-database | violation | layered 1.00 | 1 | yes | 0 | no |

### nestjs

Units: `src/app.module.ts` = presentation (file-pattern; token -, structure presentation); `src/attendees/` = - (file-pattern; token -, structure infrastructure); `src/common/filters/` = infrastructure (preset-glob; token -, structure infrastructure); `src/common/guards/` = presentation (preset-glob; token -, structure domain); `src/domain/` = domain (preset-glob; token domain, structure domain); `src/main.ts` = - (none; token -, structure -); `src/registrations/` = - (file-pattern; token -, structure application); `src/workshops/` = - (file-pattern; token -, structure infrastructure)

Evidence for nestjs: +3 4 @Module classes; +2 15/25 classes carry NestJS decorators; +1 20 files with NestJS dot suffixes

Glob differences: domain: +[] -[src/core/**, src/entities/**, src/models/**]; infrastructure: +[] -[pattern:**/*.worker.ts, pattern:**/strategies/**, pattern:**/workers/**, src/adapters/**, src/common/middleware/**, src/common/pipes/**, src/infrastructure/**, src/lib/**, src/persistence/**, src/prisma/**]; application: +[] -[pattern:**/*.processor.ts, src/application/**, src/services/**, src/use-cases/**]; presentation: +[] -[pattern:**/*.gateway.ts, pattern:**/*.interceptor.ts, src/common/interceptors/**, src/controllers/**, src/gateways/**]

| Variant | Kind | Classified | Opt 1 new | Opt 1 touched | Opt 3 new | Opt 3 touched |
|---|---|---|---|---|---|---|
| clean | clean | nestjs 0.86 | 0 |  | 0 |  |
| n01-controller-catches-domain-error | near-miss | nestjs 0.86 | 0 |  | 0 |  |
| n02-domain-port-named-dot-repository | near-miss | nestjs 0.86 | 0 |  | 0 |  |
| n03-service-injects-sibling-service | near-miss | nestjs 0.86 | 1 |  | 0 |  |
| v01-domain-entity-imports-dto | violation | nestjs 0.86 | 2 | yes | 1 | yes |
| v02-repository-builds-response-dto | violation | nestjs 0.86 | 0 | no | 1 | yes |
| v03-service-imports-guard | violation | nestjs 0.86 | 0 | no | 1 | yes |
| v04-response-dto-cycle | violation | nestjs 0.86 | 3 | yes | 1 | yes |
| v05-domain-entity-typeorm-decorator | violation | nestjs 0.86 | 2 | yes | 0 | no |
| v06-domain-entity-type-imports-express | violation | nestjs 0.86 | 1 | yes | 0 | no |
| v07-service-injects-concrete-repository | violation | nestjs 0.86 | 0 | no | 0 | no |
| v08-repository-without-port | violation | nestjs 0.86 | 1 | yes | 0 | no |
| v09-controller-returns-entity | violation | nestjs 0.86 | 0 | no | 0 | no |
| v10-domain-policy-holds-repository | violation | nestjs 0.86 | 2 | yes | 1 | yes |

### hexagonal

Units: `src/adapters/inbound/` = adapters-inbound (preset-glob; token adapters-inbound, structure adapters-inbound); `src/adapters/outbound/` = adapters-outbound (preset-glob; token adapters-outbound, structure adapters-outbound); `src/application/` = application (preset-glob; token application, structure application); `src/config/` = config (preset-glob; token config, structure config); `src/domain/` = domain (preset-glob; token domain, structure domain)

Evidence for hexagonal: +3 top-level adapters directory; +2 inbound/outbound (driving/driven) adapter directories; +1 ports split by direction; +1 top-level composition-root directory; +2 dependency inversion with separate inbound (src/adapters/inbound/) and outbound (src/adapters/outbound/) adapter units and a composition root; +1 3 driving port(s): core-owned interfaces implemented in the core and called by an inbound adapter

| Variant | Kind | Classified | Opt 1 new | Opt 1 touched | Opt 3 new | Opt 3 touched |
|---|---|---|---|---|---|---|
| clean | clean | hexagonal 0.83 | 0 |  | 0 |  |
| n01-inbound-adapter-parses-domain-value | near-miss | hexagonal 0.83 | 0 |  | 0 |  |
| n02-test-composition-root | near-miss | hexagonal 0.83 | 0 |  | 0 |  |
| n03-gateway-named-helper | near-miss | hexagonal 0.83 | 0 |  | 0 |  |
| v01-domain-uses-outbound-adapter-constant | violation | hexagonal 0.78 | 2 | yes | 1 | yes |
| v02-domain-entity-uses-driven-port | violation | hexagonal 0.83 | 2 | yes | 1 | yes |
| v03-use-case-injects-concrete-adapter | violation | hexagonal 0.78 | 3 | yes | 1 | yes |
| v04-use-case-throws-http-error | violation | hexagonal 0.78 | 2 | yes | 1 | yes |
| v05-inbound-adapter-reads-outbound-adapter | violation | hexagonal 0.83 | 2 | yes | 1 | yes |
| v06-outbound-adapter-uses-cli-formatter | violation | hexagonal 0.83 | 1 | yes | 1 | yes |
| v07-domain-service-nestjs-decorator | violation | hexagonal 0.83 | 2 | yes | 0 | no |
| v08-adapter-without-port | violation | hexagonal 0.83 | 0 | no | 0 | no |
| v09-adapter-implements-local-interface | violation | hexagonal 0.83 | 1 | yes | 0 | no |
| v10-domain-service-holds-adapter | violation | hexagonal 0.78 | 2 | yes | 1 | yes |
| v11-domain-model-cycle | violation | hexagonal 0.83 | 1 | yes | 0 | no |

### ddd

Units: `src/billing/` = - (public-api; token -, structure application); `src/billing/acl/` = infrastructure (preset-glob; token infrastructure, structure infrastructure); `src/billing/api/` = api (preset-glob; token api, structure api); `src/billing/application/` = application (preset-glob; token application, structure application); `src/billing/contracts/` = - (public-api; token -, structure domain); `src/billing/domain/` = domain (preset-glob; token domain, structure domain); `src/billing/infrastructure/` = infrastructure (preset-glob; token infrastructure, structure infrastructure); `src/main.ts` = composition (preset-glob; token composition, structure composition); `src/ordering/` = - (public-api; token -, structure application); `src/ordering/api/` = api (preset-glob; token api, structure api); `src/ordering/application/` = application (preset-glob; token application, structure application); `src/ordering/contracts/` = - (public-api; token -, structure domain); `src/ordering/domain/` = domain (preset-glob; token domain, structure domain); `src/ordering/infrastructure/` = infrastructure (preset-glob; token infrastructure, structure infrastructure); `src/shared-kernel/` = domain (preset-glob; token domain, structure domain)

Evidence for ddd: +4 2 bounded-context-like folders (src/billing/, src/ordering/) each with its own domain layer; +1 shared kernel next to the contexts; +1 context boundary directories (acl / contracts)

Glob differences: domain: +[src/billing/domain/**, src/ordering/domain/**] -[src/*/domain/**]; application: +[src/billing/application/**, src/ordering/application/**] -[src/*/application/**]; infrastructure: +[src/billing/acl/**, src/billing/infrastructure/**, src/ordering/infrastructure/**] -[src/*/acl/**, src/*/infrastructure/**]; api: +[src/billing/api/**, src/ordering/api/**] -[src/*/api/**]

| Variant | Kind | Classified | Opt 1 new | Opt 1 touched | Opt 3 new | Opt 3 touched |
|---|---|---|---|---|---|---|
| clean | clean | ddd 0.75 | 0 |  | 0 |  |
| g01-value-object-setter-accessor | violation | ddd 0.75 | 0 | no | 0 | no |
| g02-barrel-reexported-service | near-miss | ddd 0.75 | 3 |  | 0 |  |
| g03-deep-import-of-reexported-file | violation | ddd 0.75 | 2 | yes | 0 | no |
| n01-acl-internal-import | near-miss | ddd 0.75 | 1 |  | 0 |  |
| v01-aggregate-boundary | violation | ddd 0.75 | 0 | no | 0 | no |
| v02-repository-for-inner-entity | violation | ddd 0.75 | 0 | no | 0 | no |
| v03-mutable-value-object | violation | ddd 0.75 | 0 | no | 0 | no |
| v04-framework-in-domain | violation | ddd 0.75 | 1 | yes | 0 | no |
| v05-event-outside-domain | violation | ddd 0.75 | 0 | no | 0 | no |
| v06-fat-application-service | violation | ddd 0.75 | 0 | no | 0 | no |
| v07-module-outside-context | violation | ddd 0.75 | 0 | no | 0 | no |
| v08-cross-context-internal-import | violation | ddd 0.75 | 1 | yes | 0 | no |
| v09-domain-imports-application | violation | ddd 0.75 | 3 | yes | 1 | yes |
| v10-api-imports-infrastructure | violation | ddd 0.75 | 1 | yes | 1 | yes |

### P1-clean-architecture-renamed

Units: `src/kernel/` = domain (structure; token -, structure domain); `src/orchestration/` = application (structure; token -, structure application); `src/platform/` = infrastructure (structure; token -, structure infrastructure)

Evidence for clean-architecture: +1 use-case directory; +2 dependency inversion: 5/5 cross-unit implements point inward, one outer ring

| Variant | Kind | Classified | Opt 1 new | Opt 1 touched | Opt 3 new | Opt 3 touched |
|---|---|---|---|---|---|---|
| clean | clean | clean-architecture 1.00 | 0 |  | 0 |  |
| n01-second-composition-root-for-tests | near-miss | clean-architecture 1.00 | 0 |  | 0 |  |
| n02-report-writer-named-like-repo | near-miss | clean-architecture 1.00 | 0 |  | 0 |  |
| n03-controller-uses-dto-that-wraps-entity | near-miss | clean-architecture 1.00 | 0 |  | 0 |  |
| v01-domain-imports-application-port | violation | clean-architecture 1.00 | 2 | yes | 1 | yes |
| v02-domain-uses-infrastructure-clock | violation | clean-architecture 1.00 | 2 | yes | 1 | yes |
| v03-domain-entity-cycle | violation | clean-architecture 1.00 | 1 | yes | 0 | no |
| v04-domain-entity-typeorm-decorator | violation | clean-architecture 1.00 | 2 | yes | 0 | no |
| v05-use-case-injects-concrete-repository | violation | clean-architecture 1.00 | 3 | yes | 1 | yes |
| v06-repository-without-port | violation | clean-architecture 1.00 | 1 | yes | 0 | no |
| v07-controller-reads-entity | violation | clean-architecture 1.00 | 0 | no | 0 | no |
| v08-domain-service-holds-infrastructure-clock | violation | clean-architecture 1.00 | 2 | yes | 1 | yes |
| v09-dto-depends-on-http-adapter | violation | clean-architecture 1.00 | 2 | yes | 1 | yes |
| v10-domain-entity-type-imports-express | violation | clean-architecture 1.00 | 1 | yes | 0 | no |

### P2-layered-renamed

Units: `src/frontend/` = presentation (structure; token -, structure presentation); `src/kernel/` = business (structure; token -, structure business); `src/main.ts` = - (none; token -, structure -); `src/platform/` = persistence (structure; token -, structure persistence)

Evidence for layered: +2 a chain of 4 unit levels without dependency inversion

| Variant | Kind | Classified | Opt 1 new | Opt 1 touched | Opt 3 new | Opt 3 touched |
|---|---|---|---|---|---|---|
| clean | clean | layered 1.00 | 0 |  | 0 |  |
| n01-controller-parses-money | near-miss | layered 1.00 | 0 |  | 0 |  |
| n02-reporting-service-reads-database | near-miss | layered 1.00 | 0 |  | 0 |  |
| n03-views-import-model-barrel | near-miss | layered 1.00 | 0 |  | 0 |  |
| v01-gateway-returns-business-money | violation | layered 1.00 | 2 | yes | 1 | yes |
| v02-service-renders-view | violation | layered 1.00 | 2 | yes | 1 | yes |
| v03-controller-reads-gateway | violation | layered 1.00 | 1 | yes | 0 | no |
| v04-view-types-persistence-record | violation | layered 1.00 | 1 | yes | 0 | no |
| v05-business-model-cycle | violation | layered 1.00 | 1 | yes | 0 | no |
| v06-router-controller-cycle | violation | layered 1.00 | 1 | yes | 0 | no |
| v07-business-model-typeorm-decorator | violation | layered 1.00 | 2 | yes | 0 | no |
| v08-business-service-takes-express-request | violation | layered 1.00 | 1 | yes | 0 | no |
| v09-presentation-root-builds-database | violation | layered 1.00 | 1 | yes | 0 | no |

### P3-nestjs-renamed

Units: `src/app.module.ts` = presentation (file-pattern; token -, structure presentation); `src/attendees/` = - (file-pattern; token -, structure infrastructure); `src/kernel/` = domain (structure; token -, structure domain); `src/main.ts` = - (none; token -, structure -); `src/platform/filters/` = infrastructure (structure; token -, structure infrastructure); `src/platform/guards/` = presentation (file-pattern; token -, structure domain); `src/registrations/` = - (file-pattern; token -, structure application); `src/workshops/` = - (file-pattern; token -, structure infrastructure)

Evidence for nestjs: +3 4 @Module classes; +2 15/25 classes carry NestJS decorators; +1 20 files with NestJS dot suffixes

Glob differences: domain: +[] -[src/core/**, src/entities/**, src/models/**]; infrastructure: +[] -[pattern:**/*.worker.ts, pattern:**/strategies/**, pattern:**/workers/**, src/adapters/**, src/infrastructure/**, src/lib/**, src/persistence/**, src/platform/middleware/**, src/platform/pipes/**, src/prisma/**]; application: +[] -[pattern:**/*.processor.ts, src/application/**, src/services/**, src/use-cases/**]; presentation: +[] -[pattern:**/*.gateway.ts, pattern:**/*.interceptor.ts, src/controllers/**, src/gateways/**, src/platform/guards/**, src/platform/interceptors/**]

| Variant | Kind | Classified | Opt 1 new | Opt 1 touched | Opt 3 new | Opt 3 touched |
|---|---|---|---|---|---|---|
| clean | clean | nestjs 1.00 | 0 |  | 0 |  |
| n01-controller-catches-domain-error | near-miss | nestjs 1.00 | 0 |  | 0 |  |
| n02-domain-port-named-dot-repository | near-miss | nestjs 1.00 | 0 |  | 0 |  |
| n03-service-injects-sibling-service | near-miss | nestjs 1.00 | 1 |  | 0 |  |
| v01-domain-entity-imports-dto | violation | nestjs 1.00 | 2 | yes | 1 | yes |
| v02-repository-builds-response-dto | violation | nestjs 1.00 | 0 | no | 1 | yes |
| v03-service-imports-guard | violation | nestjs 1.00 | 0 | no | 1 | yes |
| v04-response-dto-cycle | violation | nestjs 1.00 | 3 | yes | 1 | yes |
| v05-domain-entity-typeorm-decorator | violation | nestjs 1.00 | 2 | yes | 0 | no |
| v06-domain-entity-type-imports-express | violation | nestjs 1.00 | 1 | yes | 0 | no |
| v07-service-injects-concrete-repository | violation | nestjs 1.00 | 0 | no | 0 | no |
| v08-repository-without-port | violation | nestjs 1.00 | 1 | yes | 0 | no |
| v09-controller-returns-entity | violation | nestjs 1.00 | 0 | no | 0 | no |
| v10-domain-policy-holds-repository | violation | nestjs 1.00 | 2 | yes | 1 | yes |

### P4-hexagonal-renamed

Units: `src/kernel/` = domain (structure; token -, structure domain); `src/orchestration/` = application (structure; token -, structure application); `src/plugins/entry/` = adapters-inbound (structure; token -, structure adapters-inbound); `src/plugins/exit/` = adapters-outbound (structure; token -, structure adapters-outbound); `src/setup/` = config (structure; token -, structure config)

Evidence for hexagonal: +1 ports split by direction; +2 dependency inversion with separate inbound (src/plugins/entry/) and outbound (src/plugins/exit/) adapter units and a composition root; +1 3 driving port(s): core-owned interfaces implemented in the core and called by an inbound adapter

| Variant | Kind | Classified | Opt 1 new | Opt 1 touched | Opt 3 new | Opt 3 touched |
|---|---|---|---|---|---|---|
| clean | clean | hexagonal 1.00 | 0 |  | 0 |  |
| n01-inbound-adapter-parses-domain-value | near-miss | hexagonal 1.00 | 0 |  | 0 |  |
| n02-test-composition-root | near-miss | hexagonal 1.00 | 0 |  | 0 |  |
| n03-gateway-named-helper | near-miss | hexagonal 1.00 | 0 |  | 0 |  |
| v01-domain-uses-outbound-adapter-constant | violation | hexagonal 1.00 | 2 | yes | 1 | yes |
| v02-domain-entity-uses-driven-port | violation | hexagonal 1.00 | 2 | yes | 1 | yes |
| v03-use-case-injects-concrete-adapter | violation | hexagonal 1.00 | 3 | yes | 1 | yes |
| v04-use-case-throws-http-error | violation | hexagonal 1.00 | 2 | yes | 1 | yes |
| v05-inbound-adapter-reads-outbound-adapter | violation | hexagonal 1.00 | 2 | yes | 1 | yes |
| v06-outbound-adapter-uses-cli-formatter | violation | hexagonal 1.00 | 1 | yes | 1 | yes |
| v07-domain-service-nestjs-decorator | violation | hexagonal 1.00 | 2 | yes | 0 | no |
| v08-adapter-without-port | violation | hexagonal 1.00 | 0 | no | 0 | no |
| v09-adapter-implements-local-interface | violation | hexagonal 1.00 | 1 | yes | 0 | no |
| v10-domain-service-holds-adapter | violation | hexagonal 1.00 | 2 | yes | 1 | yes |
| v11-domain-model-cycle | violation | hexagonal 1.00 | 1 | yes | 0 | no |

### P5-ddd-renamed

Units: `src/billing/` = - (public-api; token -, structure application); `src/billing/acl/` = infrastructure (preset-glob; token infrastructure, structure infrastructure); `src/billing/api/` = api (preset-glob; token api, structure api); `src/billing/contracts/` = - (public-api; token -, structure domain); `src/billing/kernel/` = domain (structure; token -, structure domain); `src/billing/orchestration/` = application (structure; token -, structure application); `src/billing/platform/` = infrastructure (structure; token -, structure infrastructure); `src/main.ts` = composition (preset-glob; token composition, structure composition); `src/ordering/` = - (public-api; token -, structure application); `src/ordering/api/` = api (preset-glob; token api, structure api); `src/ordering/contracts/` = - (public-api; token -, structure domain); `src/ordering/kernel/` = domain (structure; token -, structure domain); `src/ordering/orchestration/` = application (structure; token -, structure application); `src/ordering/platform/` = infrastructure (structure; token -, structure infrastructure); `src/shared-kernel/` = domain (preset-glob; token domain, structure domain)

Evidence for ddd: +4 2 bounded-context-like folders (src/billing/, src/ordering/) each with its own domain layer; +1 shared kernel next to the contexts; +1 context boundary directories (acl / contracts)

Glob differences: domain: +[src/billing/kernel/**, src/ordering/kernel/**] -[src/*/kernel/**]; application: +[src/billing/orchestration/**, src/ordering/orchestration/**] -[src/*/orchestration/**]; infrastructure: +[src/billing/acl/**, src/billing/platform/**, src/ordering/platform/**] -[src/*/acl/**, src/*/platform/**]; api: +[src/billing/api/**, src/ordering/api/**] -[src/*/api/**]

| Variant | Kind | Classified | Opt 1 new | Opt 1 touched | Opt 3 new | Opt 3 touched |
|---|---|---|---|---|---|---|
| clean | clean | ddd 0.75 | 0 |  | 0 |  |
| g01-value-object-setter-accessor | violation | ddd 0.75 | 0 | no | 0 | no |
| g02-barrel-reexported-service | near-miss | ddd 0.75 | 3 |  | 0 |  |
| g03-deep-import-of-reexported-file | violation | ddd 0.75 | 2 | yes | 0 | no |
| n01-acl-internal-import | near-miss | ddd 0.75 | 1 |  | 0 |  |
| v01-aggregate-boundary | violation | ddd 0.75 | 0 | no | 0 | no |
| v02-repository-for-inner-entity | violation | ddd 0.75 | 0 | no | 0 | no |
| v03-mutable-value-object | violation | ddd 0.75 | 0 | no | 0 | no |
| v04-framework-in-domain | violation | ddd 0.75 | 1 | yes | 0 | no |
| v05-event-outside-domain | violation | ddd 0.75 | 0 | no | 0 | no |
| v06-fat-application-service | violation | ddd 0.75 | 0 | no | 0 | no |
| v07-module-outside-context | violation | ddd 0.75 | 0 | no | 0 | no |
| v08-cross-context-internal-import | violation | ddd 0.75 | 1 | yes | 0 | no |
| v09-domain-imports-application | violation | ddd 0.75 | 3 | yes | 1 | yes |
| v10-api-imports-infrastructure | violation | ddd 0.75 | 1 | yes | 0 | no |
