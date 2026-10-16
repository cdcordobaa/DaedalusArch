# ISE prototype: offline measurement (a)-(c), Options 1 and 3

## (a) Style classification

| Target | True style | Clean classified as | Confidence | Runner-up | Variants classified correctly |
|---|---|---|---|---|---|
| N1-clean-architecture | clean-architecture | clean-architecture | 1.00 | layered 0.00 | 14/14 (100%) |
| N1-layered | layered | layered | 1.00 | clean-architecture 0.00 | 13/13 (100%) |
| N1-nestjs | nestjs | nestjs | 1.00 | clean-architecture 0.00 | 14/14 (100%) |
| N1-hexagonal | hexagonal | hexagonal | 1.00 | clean-architecture 0.00 | 15/15 (100%) |
| N1-ddd | ddd | ddd | 0.75 | clean-architecture 0.25 | 15/15 (100%) |
| N2-clean-architecture | clean-architecture | clean-architecture | 1.00 | layered 0.00 | 14/14 (100%) |
| N2-layered | layered | layered | 1.00 | clean-architecture 0.00 | 13/13 (100%) |
| N2-nestjs | nestjs | nestjs | 1.00 | clean-architecture 0.00 | 14/14 (100%) |
| N2-hexagonal | hexagonal | hexagonal | 1.00 | clean-architecture 0.00 | 15/15 (100%) |
| N2-ddd | ddd | ddd | 0.75 | clean-architecture 0.25 | 15/15 (100%) |
| S-clean-architecture-scrambled | clean-architecture | clean-architecture | 1.00 | layered 0.00 | 14/14 (100%) |
| S-layered-scrambled | layered | layered | 1.00 | clean-architecture 0.00 | 13/13 (100%) |
| S-nestjs-scrambled | nestjs | nestjs | 1.00 | clean-architecture 0.00 | 14/14 (100%) |
| S-hexagonal-scrambled | hexagonal | hexagonal | 1.00 | clean-architecture 0.00 | 15/15 (100%) |
| S-ddd-scrambled | ddd | ddd | 0.75 | clean-architecture 0.25 | 15/15 (100%) |

## (b) Per-file layer accuracy (clean variant vs expected-graph.json)

| Target | Preset-first | Infer-only | High-confidence accuracy (preset-first) | Wrong files (preset-first) |
|---|---|---|---|---|
| N1-clean-architecture | 29/29 (100%) | 29/29 (100%) | n/a |  |
| N1-layered | 27/27 (100%) | 27/27 (100%) | n/a |  |
| N1-nestjs | 29/29 (100%) | 29/29 (100%) | n/a |  |
| N1-hexagonal | 30/30 (100%) | 30/30 (100%) | n/a |  |
| N1-ddd | 31/31 (100%) | 31/31 (100%) | 6/6 (100%) |  |
| N2-clean-architecture | 29/29 (100%) | 29/29 (100%) | n/a |  |
| N2-layered | 27/27 (100%) | 27/27 (100%) | n/a |  |
| N2-nestjs | 29/29 (100%) | 29/29 (100%) | n/a |  |
| N2-hexagonal | 30/30 (100%) | 30/30 (100%) | n/a |  |
| N2-ddd | 31/31 (100%) | 31/31 (100%) | 6/6 (100%) |  |
| S-clean-architecture-scrambled | 29/29 (100%) | 29/29 (100%) | n/a |  |
| S-layered-scrambled | 27/27 (100%) | 27/27 (100%) | n/a |  |
| S-nestjs-scrambled | 19/29 (66%) | 19/29 (66%) | n/a | src/meadow/attendees/attendees.bundle.ts: infrastructure (exp. presentation); src/meadow/attendees/attendees.endpoint.ts: infrastructure (exp. presentation); src/meadow/attendees/attendees.handler.ts: infrastructure (exp. application) (+7) |
| S-hexagonal-scrambled | 30/30 (100%) | 30/30 (100%) | n/a |  |
| S-ddd-scrambled | 31/31 (100%) | 31/31 (100%) | 6/6 (100%) |  |

## (c) Spec equivalence (inferred vs true spec)

| Target | Spec valid | Glob differences (preset-first) | Files with another layer (preset-first) | Files with another layer (infer-only) | DDD block fields differing |
|---|---|---|---|---|---|
| N1-clean-architecture | yes | 0 | 0/29 (0%) | 0/29 (0%) | n/a |
| N1-layered | yes | 0 | 0/27 (0%) | 0/27 (0%) | n/a |
| N1-nestjs | yes | 23 | 0/29 (0%) | 0/29 (0%) | n/a |
| N1-hexagonal | yes | 0 | 0/30 (0%) | 0/30 (0%) | n/a |
| N1-ddd | yes | 14 | 0/31 (0%) | 0/31 (0%) | 0 |
| N2-clean-architecture | yes | 0 | 0/29 (0%) | 0/29 (0%) | n/a |
| N2-layered | yes | 0 | 0/27 (0%) | 0/27 (0%) | n/a |
| N2-nestjs | yes | 23 | 0/29 (0%) | 0/29 (0%) | n/a |
| N2-hexagonal | yes | 0 | 0/30 (0%) | 0/30 (0%) | n/a |
| N2-ddd | yes | 14 | 0/31 (0%) | 0/31 (0%) | 0 |
| S-clean-architecture-scrambled | yes | 0 | 0/29 (0%) | 0/29 (0%) | n/a |
| S-layered-scrambled | yes | 0 | 0/27 (0%) | 0/27 (0%) | n/a |
| S-nestjs-scrambled | yes | 43 | 10/29 (34%) | 10/29 (34%) | n/a |
| S-hexagonal-scrambled | yes | 0 | 0/30 (0%) | 0/30 (0%) | n/a |
| S-ddd-scrambled | yes | 14 | 0/31 (0%) | 0/31 (0%) | repositories |

## Options 1 and 3 on every variant (in memory)

Violation variants: planted violation touched (a new deviation names a file of an expected finding). Near-miss variants: new deviations (false alarms).

| Target | Opt 1 planted touched | Opt 1 near-miss false alarms | Opt 3 planted touched | Opt 3 near-miss false alarms |
|---|---|---|---|---|
| N1-clean-architecture | 9/10 (90%) | 0 over 4 | 5/10 (50%) | 0 over 4 |
| N1-layered | 9/9 (100%) | 0 over 4 | 2/9 (22%) | 0 over 4 |
| N1-nestjs | 6/10 (60%) | 1 over 4 | 5/10 (50%) | 0 over 4 |
| N1-hexagonal | 10/11 (91%) | 0 over 4 | 7/11 (64%) | 0 over 4 |
| N1-ddd | 5/12 (42%) | 4 over 3 | 1/12 (8%) | 0 over 3 |
| N2-clean-architecture | 9/10 (90%) | 0 over 4 | 5/10 (50%) | 0 over 4 |
| N2-layered | 9/9 (100%) | 0 over 4 | 2/9 (22%) | 0 over 4 |
| N2-nestjs | 6/10 (60%) | 1 over 4 | 5/10 (50%) | 0 over 4 |
| N2-hexagonal | 10/11 (91%) | 0 over 4 | 7/11 (64%) | 0 over 4 |
| N2-ddd | 5/12 (42%) | 4 over 3 | 1/12 (8%) | 0 over 3 |
| S-clean-architecture-scrambled | 8/10 (80%) | 0 over 4 | 5/10 (50%) | 0 over 4 |
| S-layered-scrambled | 9/9 (100%) | 0 over 4 | 2/9 (22%) | 0 over 4 |
| S-nestjs-scrambled | 5/10 (50%) | 1 over 4 | 4/10 (40%) | 0 over 4 |
| S-hexagonal-scrambled | 9/11 (82%) | 0 over 4 | 7/11 (64%) | 0 over 4 |
| S-ddd-scrambled | 5/12 (42%) | 4 over 3 | 1/12 (8%) | 0 over 3 |

### N1-clean-architecture

Units: `src/zinnia/glacier/` = domain (structure; token -, structure domain); `src/zinnia/sage/` = application (structure; token -, structure application); `src/zinnia/sequoia/` = infrastructure (structure; token -, structure infrastructure)

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

### N1-layered

Units: `src/oasis/lagoon/` = persistence (structure; token -, structure persistence); `src/oasis/main.ts` = - (none; token -, structure -); `src/oasis/raven/` = presentation (structure; token -, structure presentation); `src/oasis/yarrow/` = business (structure; token -, structure business)

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

### N1-nestjs

Units: `src/meadow/app.module.ts` = presentation (file-pattern; token -, structure presentation); `src/meadow/attendees/` = - (file-pattern; token -, structure infrastructure); `src/meadow/main.ts` = - (none; token -, structure -); `src/meadow/prairie/` = domain (structure; token -, structure domain); `src/meadow/registrations/` = - (file-pattern; token -, structure application); `src/meadow/willow/filters/` = infrastructure (structure; token -, structure infrastructure); `src/meadow/willow/guards/` = presentation (file-pattern; token -, structure domain); `src/meadow/workshops/` = - (file-pattern; token -, structure infrastructure)

Evidence for nestjs: +3 4 @Module classes; +2 15/25 classes carry NestJS decorators; +1 20 files with NestJS dot suffixes

Glob differences: domain: +[] -[src/meadow/core/**, src/meadow/entities/**, src/meadow/models/**]; infrastructure: +[] -[pattern:**/*.worker.ts, pattern:**/strategies/**, pattern:**/workers/**, src/meadow/adapters/**, src/meadow/infrastructure/**, src/meadow/lib/**, src/meadow/persistence/**, src/meadow/prisma/**, src/meadow/willow/middleware/**, src/meadow/willow/pipes/**]; application: +[] -[pattern:**/*.processor.ts, src/meadow/application/**, src/meadow/services/**, src/meadow/use-cases/**]; presentation: +[] -[pattern:**/*.gateway.ts, pattern:**/*.interceptor.ts, src/meadow/controllers/**, src/meadow/gateways/**, src/meadow/willow/guards/**, src/meadow/willow/interceptors/**]

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

### N1-hexagonal

Units: `src/saffron/anvil/` = domain (structure; token -, structure domain); `src/saffron/jasper/maple/` = adapters-inbound (structure; token -, structure adapters-inbound); `src/saffron/jasper/ridge/` = adapters-outbound (structure; token -, structure adapters-outbound); `src/saffron/oasis/` = config (structure; token -, structure config); `src/saffron/thistle/` = application (structure; token -, structure application)

Evidence for hexagonal: +1 ports split by direction; +2 dependency inversion with separate inbound (src/saffron/jasper/maple/) and outbound (src/saffron/jasper/ridge/) adapter units and a composition root; +1 3 driving port(s): core-owned interfaces implemented in the core and called by an inbound adapter

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

### N1-ddd

Units: `src/indigo/billing/` = - (public-api; token -, structure application); `src/indigo/billing/acl/` = infrastructure (token+structure; token infrastructure, structure infrastructure); `src/indigo/billing/api/` = api (token+structure; token api, structure api); `src/indigo/billing/contracts/` = - (public-api; token -, structure domain); `src/indigo/billing/jasper/` = infrastructure (structure; token -, structure infrastructure); `src/indigo/billing/orchid/` = application (structure; token -, structure application); `src/indigo/billing/prairie/` = domain (structure; token -, structure domain); `src/indigo/main.ts` = composition (token+structure; token composition, structure composition); `src/indigo/ordering/` = - (public-api; token -, structure application); `src/indigo/ordering/api/` = api (token+structure; token api, structure api); `src/indigo/ordering/contracts/` = - (public-api; token -, structure domain); `src/indigo/ordering/jasper/` = infrastructure (structure; token -, structure infrastructure); `src/indigo/ordering/orchid/` = application (structure; token -, structure application); `src/indigo/ordering/prairie/` = domain (structure; token -, structure domain); `src/indigo/shared-kernel/` = domain (token+structure; token domain, structure domain)

Evidence for ddd: +4 2 bounded-context-like folders (src/indigo/billing/, src/indigo/ordering/) each with its own domain layer; +1 shared kernel next to the contexts; +1 context boundary directories (acl / contracts)

Glob differences: domain: +[src/indigo/billing/prairie/**, src/indigo/ordering/prairie/**] -[src/indigo/*/prairie/**]; application: +[src/indigo/billing/orchid/**, src/indigo/ordering/orchid/**] -[src/indigo/*/orchid/**]; infrastructure: +[src/indigo/billing/acl/**, src/indigo/billing/jasper/**, src/indigo/ordering/jasper/**] -[src/indigo/*/acl/**, src/indigo/*/jasper/**]; api: +[src/indigo/billing/api/**, src/indigo/ordering/api/**] -[src/indigo/*/api/**]

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

### N2-clean-architecture

Units: `src/basalt/` = infrastructure (structure; token -, structure infrastructure); `src/thistle/` = domain (structure; token -, structure domain); `src/willow/` = application (structure; token -, structure application)

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

### N2-layered

Units: `src/main.ts` = - (none; token -, structure -); `src/oasis/` = presentation (structure; token -, structure presentation); `src/sierra/` = persistence (structure; token -, structure persistence); `src/thistle/` = business (structure; token -, structure business)

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

### N2-nestjs

Units: `src/app.module.ts` = presentation (file-pattern; token -, structure presentation); `src/attendees/` = - (file-pattern; token -, structure infrastructure); `src/bramble/` = domain (structure; token -, structure domain); `src/cedar/flint/filters/` = infrastructure (structure; token -, structure infrastructure); `src/cedar/flint/guards/` = presentation (file-pattern; token -, structure domain); `src/main.ts` = - (none; token -, structure -); `src/registrations/` = - (file-pattern; token -, structure application); `src/workshops/` = - (file-pattern; token -, structure infrastructure)

Evidence for nestjs: +3 4 @Module classes; +2 15/25 classes carry NestJS decorators; +1 20 files with NestJS dot suffixes

Glob differences: domain: +[] -[src/core/**, src/entities/**, src/models/**]; infrastructure: +[] -[pattern:**/*.worker.ts, pattern:**/strategies/**, pattern:**/workers/**, src/adapters/**, src/cedar/flint/middleware/**, src/cedar/flint/pipes/**, src/infrastructure/**, src/lib/**, src/persistence/**, src/prisma/**]; application: +[] -[pattern:**/*.processor.ts, src/application/**, src/services/**, src/use-cases/**]; presentation: +[] -[pattern:**/*.gateway.ts, pattern:**/*.interceptor.ts, src/cedar/flint/guards/**, src/cedar/flint/interceptors/**, src/controllers/**, src/gateways/**]

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

### N2-hexagonal

Units: `src/juniper/` = config (structure; token -, structure config); `src/raven/` = application (structure; token -, structure application); `src/saffron/` = domain (structure; token -, structure domain); `src/zephyr/oasis/harbor/` = adapters-inbound (structure; token -, structure adapters-inbound); `src/zephyr/oasis/meadow/` = adapters-outbound (structure; token -, structure adapters-outbound)

Evidence for hexagonal: +1 ports split by direction; +2 dependency inversion with separate inbound (src/zephyr/oasis/harbor/) and outbound (src/zephyr/oasis/meadow/) adapter units and a composition root; +1 3 driving port(s): core-owned interfaces implemented in the core and called by an inbound adapter

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

### N2-ddd

Units: `src/billing/` = - (public-api; token -, structure application); `src/billing/garnet/acl/` = infrastructure (token+structure; token infrastructure, structure infrastructure); `src/billing/garnet/api/` = api (token+structure; token api, structure api); `src/billing/garnet/aspen/` = domain (structure; token -, structure domain); `src/billing/garnet/contracts/` = - (public-api; token -, structure domain); `src/billing/garnet/kelp/` = infrastructure (structure; token -, structure infrastructure); `src/billing/garnet/ridge/` = application (structure; token -, structure application); `src/main.ts` = composition (preset-glob; token composition, structure composition); `src/ordering/` = - (public-api; token -, structure application); `src/ordering/garnet/api/` = api (token+structure; token api, structure api); `src/ordering/garnet/aspen/` = domain (structure; token -, structure domain); `src/ordering/garnet/contracts/` = - (public-api; token -, structure domain); `src/ordering/garnet/kelp/` = infrastructure (structure; token -, structure infrastructure); `src/ordering/garnet/ridge/` = application (structure; token -, structure application); `src/shared-kernel/` = domain (preset-glob; token domain, structure domain)

Evidence for ddd: +4 2 bounded-context-like folders (src/billing/, src/ordering/) each with its own domain layer; +1 shared kernel next to the contexts; +1 context boundary directories (acl / contracts)

Glob differences: domain: +[src/billing/garnet/aspen/**, src/ordering/garnet/aspen/**] -[src/*/garnet/aspen/**]; application: +[src/billing/garnet/ridge/**, src/ordering/garnet/ridge/**] -[src/*/garnet/ridge/**]; infrastructure: +[src/billing/garnet/acl/**, src/billing/garnet/kelp/**, src/ordering/garnet/kelp/**] -[src/*/garnet/acl/**, src/*/garnet/kelp/**]; api: +[src/billing/garnet/api/**, src/ordering/garnet/api/**] -[src/*/garnet/api/**]

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

### S-clean-architecture-scrambled

Units: `src/zinnia/glacier/` = domain (structure; token -, structure domain); `src/zinnia/sage/` = application (structure; token -, structure application); `src/zinnia/sequoia/` = infrastructure (structure; token -, structure infrastructure)

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
| v06-repository-without-port | violation | clean-architecture 1.00 | 0 | no | 0 | no |
| v07-controller-reads-entity | violation | clean-architecture 1.00 | 0 | no | 0 | no |
| v08-domain-service-holds-infrastructure-clock | violation | clean-architecture 1.00 | 2 | yes | 1 | yes |
| v09-dto-depends-on-http-adapter | violation | clean-architecture 1.00 | 2 | yes | 1 | yes |
| v10-domain-entity-type-imports-express | violation | clean-architecture 1.00 | 1 | yes | 0 | no |

### S-layered-scrambled

Units: `src/oasis/lagoon/` = persistence (structure; token -, structure persistence); `src/oasis/main.ts` = - (none; token -, structure -); `src/oasis/raven/` = presentation (structure; token -, structure presentation); `src/oasis/yarrow/` = business (structure; token -, structure business)

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

### S-nestjs-scrambled

Units: `src/meadow/app.bundle.ts` = presentation (structure; token -, structure presentation); `src/meadow/attendees/` = infrastructure (structure; token -, structure infrastructure); `src/meadow/main.ts` = - (none; token -, structure -); `src/meadow/prairie/` = domain (structure; token -, structure domain); `src/meadow/registrations/` = application (structure; token -, structure application); `src/meadow/willow/filters/` = infrastructure (structure; token -, structure infrastructure); `src/meadow/willow/guards/` = domain (structure; token -, structure domain); `src/meadow/workshops/` = infrastructure (structure; token -, structure infrastructure)

Evidence for nestjs: +3 4 @Module classes; +2 15/25 classes carry NestJS decorators

Glob differences: domain: +[src/meadow/willow/guards/**] -[src/meadow/core/**, src/meadow/entities/**, src/meadow/models/**]; infrastructure: +[src/meadow/attendees/attendees.bundle.ts, src/meadow/attendees/attendees.endpoint.ts, src/meadow/attendees/attendees.handler.ts, src/meadow/attendees/in-memory-attendee.store.ts, src/meadow/workshops/in-memory-workshop.store.ts, src/meadow/workshops/workshops.bundle.ts, src/meadow/workshops/workshops.endpoint.ts, src/meadow/workshops/workshops.handler.ts] -[pattern:**/*.store.ts, pattern:**/*.worker.ts, pattern:**/strategies/**, pattern:**/workers/**, src/meadow/adapters/**, src/meadow/infrastructure/**, src/meadow/lib/**, src/meadow/persistence/**, src/meadow/prisma/**, src/meadow/willow/middleware/**, src/meadow/willow/pipes/**]; application: +[src/meadow/registrations/in-memory-registration.store.ts, src/meadow/registrations/registrations.bundle.ts, src/meadow/registrations/registrations.endpoint.ts, src/meadow/registrations/registrations.handler.ts] -[pattern:**/*.handler.ts, pattern:**/*.payload.ts, pattern:**/*.processor.ts, src/meadow/application/**, src/meadow/services/**, src/meadow/use-cases/**]; presentation: +[src/meadow/app.bundle.ts] -[pattern:**/*.bundle.ts, pattern:**/*.endpoint.ts, pattern:**/*.interceptor.ts, pattern:**/*.link.ts, pattern:**/*.sentry.ts, src/meadow/controllers/**, src/meadow/gateways/**, src/meadow/willow/guards/**, src/meadow/willow/interceptors/**]

Files with another layer: src/meadow/attendees/attendees.bundle.ts infrastructure (true presentation); src/meadow/attendees/attendees.endpoint.ts infrastructure (true presentation); src/meadow/attendees/attendees.handler.ts infrastructure (true application); src/meadow/registrations/in-memory-registration.store.ts application (true infrastructure); src/meadow/registrations/registrations.bundle.ts application (true presentation); src/meadow/registrations/registrations.endpoint.ts application (true presentation); src/meadow/willow/guards/api-key.sentry.ts domain (true presentation); src/meadow/workshops/workshops.bundle.ts infrastructure (true presentation); src/meadow/workshops/workshops.endpoint.ts infrastructure (true presentation); src/meadow/workshops/workshops.handler.ts infrastructure (true application)

| Variant | Kind | Classified | Opt 1 new | Opt 1 touched | Opt 3 new | Opt 3 touched |
|---|---|---|---|---|---|---|
| clean | clean | nestjs 1.00 | 0 |  | 0 |  |
| n01-controller-catches-domain-error | near-miss | nestjs 1.00 | 0 |  | 0 |  |
| n02-domain-port-named-dot-repository | near-miss | nestjs 1.00 | 0 |  | 0 |  |
| n03-service-injects-sibling-service | near-miss | nestjs 1.00 | 1 |  | 0 |  |
| v01-domain-entity-imports-dto | violation | nestjs 1.00 | 2 | yes | 1 | yes |
| v02-repository-builds-response-dto | violation | nestjs 1.00 | 0 | no | 1 | yes |
| v03-service-imports-guard | violation | nestjs 1.00 | 0 | no | 0 | no |
| v04-response-dto-cycle | violation | nestjs 1.00 | 3 | yes | 1 | yes |
| v05-domain-entity-typeorm-decorator | violation | nestjs 1.00 | 2 | yes | 0 | no |
| v06-domain-entity-type-imports-express | violation | nestjs 1.00 | 1 | yes | 0 | no |
| v07-service-injects-concrete-repository | violation | nestjs 1.00 | 0 | no | 0 | no |
| v08-repository-without-port | violation | nestjs 1.00 | 0 | no | 0 | no |
| v09-controller-returns-entity | violation | nestjs 1.00 | 0 | no | 0 | no |
| v10-domain-policy-holds-repository | violation | nestjs 1.00 | 2 | yes | 1 | yes |

### S-hexagonal-scrambled

Units: `src/saffron/anvil/` = domain (structure; token -, structure domain); `src/saffron/jasper/maple/` = adapters-inbound (structure; token -, structure adapters-inbound); `src/saffron/jasper/ridge/` = adapters-outbound (structure; token -, structure adapters-outbound); `src/saffron/oasis/` = config (structure; token -, structure config); `src/saffron/thistle/` = application (structure; token -, structure application)

Evidence for hexagonal: +1 ports split by direction; +2 dependency inversion with separate inbound (src/saffron/jasper/maple/) and outbound (src/saffron/jasper/ridge/) adapter units and a composition root; +1 3 driving port(s): core-owned interfaces implemented in the core and called by an inbound adapter

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
| v09-adapter-implements-local-interface | violation | hexagonal 1.00 | 0 | no | 0 | no |
| v10-domain-service-holds-adapter | violation | hexagonal 1.00 | 2 | yes | 1 | yes |
| v11-domain-model-cycle | violation | hexagonal 1.00 | 1 | yes | 0 | no |

### S-ddd-scrambled

Units: `src/indigo/billing/` = - (public-api; token -, structure application); `src/indigo/billing/acl/` = infrastructure (token+structure; token infrastructure, structure infrastructure); `src/indigo/billing/api/` = api (token+structure; token api, structure api); `src/indigo/billing/contracts/` = - (public-api; token -, structure domain); `src/indigo/billing/jasper/` = infrastructure (structure; token -, structure infrastructure); `src/indigo/billing/orchid/` = application (structure; token -, structure application); `src/indigo/billing/prairie/` = domain (structure; token -, structure domain); `src/indigo/main.ts` = composition (token+structure; token composition, structure composition); `src/indigo/ordering/` = - (public-api; token -, structure application); `src/indigo/ordering/api/` = api (token+structure; token api, structure api); `src/indigo/ordering/contracts/` = - (public-api; token -, structure domain); `src/indigo/ordering/jasper/` = infrastructure (structure; token -, structure infrastructure); `src/indigo/ordering/orchid/` = application (structure; token -, structure application); `src/indigo/ordering/prairie/` = domain (structure; token -, structure domain); `src/indigo/shared-kernel/` = domain (token+structure; token domain, structure domain)

Evidence for ddd: +4 2 bounded-context-like folders (src/indigo/billing/, src/indigo/ordering/) each with its own domain layer; +1 shared kernel next to the contexts; +1 context boundary directories (acl / contracts)

Glob differences: domain: +[src/indigo/billing/prairie/**, src/indigo/ordering/prairie/**] -[src/indigo/*/prairie/**]; application: +[src/indigo/billing/orchid/**, src/indigo/ordering/orchid/**] -[src/indigo/*/orchid/**]; infrastructure: +[src/indigo/billing/acl/**, src/indigo/billing/jasper/**, src/indigo/ordering/jasper/**] -[src/indigo/*/acl/**, src/indigo/*/jasper/**]; api: +[src/indigo/billing/api/**, src/indigo/ordering/api/**] -[src/indigo/*/api/**]

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
