# v1.3 validity-fixes-mined: spec rationale

Written 2026-10-16, before any tool run on any corpus project. One spec per project in `specs/`. Each new spec is the style preset with its `architecture:` block replaced by this project's folders; `fitness_functions:` (templates, thresholds, severities) is the preset's, verbatim. The 15 v1.3-external specs are copied verbatim from `results/v1.3-external/specs/` at `f800e9af` (branch `v1.3-external-set`, written before that set's own run; rationale in that branch's `spec-rationale.md`).

Spec source per project: the README (or a docs file it names) where it makes an architecture claim, else the folder layout and file suffixes at the pin. The spec describes the layout **at the pin**; earlier history may use other folders, and files outside every layer are not checked (§ threats in the report).

| id | style | source of the layer mapping |
|---|---|---|
| hoppscotch-backend | nestjs | NestJS feature modules (team, team-collection, user-*, auth, admin). No architecture claim in the README; the folders and suffixes give the NestJS roles: GraphQL resolvers and REST controllers + modules + guards (presentation), *.service.ts (application), prisma/pubsub/mailer/posthog adapters (infrastructure), shared types (domain). |
| immich-server | nestjs | NestJS, layered by technical role (folders controllers/, services/, repositories/, dtos/, schema/). Controllers call services, services call repositories; DTOs are shared by controllers and services (application). schema/ (Kysely tables, migrations) and repositories/ are infrastructure; commands/ and workers/ are entry points. |
| podkrepi-api | nestjs | NestJS + Prisma, one folder per feature (README points to the NestJS / Prisma recipes). Per feature: *.controller.ts + *.module.ts (presentation), *.service.ts + dto/ (application), entities/ and the generated src/domain/generated Prisma classes (domain model), prisma/, s3/ and notification providers (infrastructure). |
| hedgedoc-backend | nestjs | NestJS feature modules (notes, revisions, realtime, auth, media...) over Knex. The public and private HTTP API live in src/api/ (presentation); feature *.service.ts and src/dtos (application); src/database and the media storage backends (infrastructure); src/errors (domain error types). |
| awesome-nest-boilerplate | nestjs | NestJS boilerplate with CQRS (README: TypeORM, CQRS, modules under src/modules). TypeORM *.entity.ts, database/, entity subscribers and shared external services (AWS S3, translation, config) are infrastructure; services, commands, queries and DTOs are application; controllers, modules, guards, interceptors and filters are presentation; constants and interfaces are the framework-free core. |
| mikro-orm-realworld | nestjs | RealWorld (Conduit) backend on NestJS + MikroORM: one folder per feature (article, user, profile, tag) with *.entity.ts (MikroORM entities, infrastructure), *.service.ts and dto/ (application), *.controller.ts, *.module.ts and middleware (presentation), *.interface.ts response shapes (domain). |
| clean-ts-api | clean-architecture | Clean Architecture teaching API (README: "API em NodeJs usando Typescript, TDD, Clean Architecture, Design Patterns e SOLID"). Inner -> outer: domain (models + use-case interfaces), data (use-case implementations and protocols = application), presentation + validation (interface adapters), infra (db, cryptography, validators), main (composition root: factories, routes, config, adapters to Express/Apollo). |
| standardnotes-auth | clean-architecture | Production auth service with explicit Domain/, Infra/, Controller/, Bootstrap/ folders (Clean Architecture; the use cases live in Domain/UseCase). Inner -> outer: Domain (entities, repository interfaces, handlers, use cases), Mapping and Projection (application-level mappers), Controller + Infra/InversifyExpressUtils (presentation), Infra (TypeORM, Redis, S3, HTTP clients), Bootstrap (container, composition root). |
| domain-driven-hexagon | hexagonal | The reference TypeScript DDD + hexagonal project (README: "Domain-Driven Hexagon"; per module: domain/, commands/ + queries/ (application, with their HTTP/GraphQL/CLI controllers inside), database/ (repository adapter), dtos/; libs/ holds the shared ddd, ports and api building blocks). |
| bitloops-ddd-backend | hexagonal | DDD + hexagonal + CQRS + event sourcing reference (README: bounded contexts, hexagonal architecture). src/lib/bounded-contexts/<ctx>/<module>/ holds domain/, application/ (commands, queries, ports), contracts/; src/lib/infra and src/bounded-contexts/* hold the outbound adapters and the context wiring; src/api is inbound. |
| medplum-server | layered | Large Express FHIR server. No architecture claim; folders: fhir/repository + database.ts + migrations + redis/keyvalue/storage (persistence), fhir operations, auth/oauth logic, bots, workers' job logic, email, admin logic (business), the Express routers (app.ts, the *routes.ts files, ws/, wellknown, healthcheck) (presentation). |
| ts-express-starter-prisma | layered | Express starter template (README: routes -> controllers -> services -> repositories, Prisma). |
| reactive-resume-api | layered | oRPC API, feature-sliced (src/features/<feature>). No preset models the style (the wild run used it as the negative control); the spec maps the recognisable roles: routers + middleware + context (presentation), the feature modules and dto/ (business), redis and storage access (persistence). |
| etherpad | layered | Long-lived Express application (src/node, migrated to TypeScript). No architecture claim; the folders give db/ (persistence: ueberdb access, Pad/Author managers), the pad logic, security and utils (business), handler/ and hooks/express (HTTP and socket.io presentation). |
| pvarentsov-clean | clean-architecture | v1.3-external spec, verbatim |
| luizomf-clean-api | clean-architecture | v1.3-external spec, verbatim |
| dannielhugo-clean | clean-architecture | v1.3-external spec, verbatim |
| bulletproof-nodejs | layered | v1.3-external spec, verbatim |
| w3tec-express-boilerplate | layered | v1.3-external spec, verbatim |
| talento90-typescript-node | layered | v1.3-external spec, verbatim |
| zeldaplay-api | nestjs | v1.3-external spec, verbatim |
| neoteric-nestjs-auth | nestjs | v1.3-external spec, verbatim |
| vivify-nestjs-boilerplate | nestjs | v1.3-external spec, verbatim |
| conduit-ports-adapters | hexagonal | v1.3-external spec, verbatim |
| ddialar-hexagonal-boilerplate | hexagonal | v1.3-external spec, verbatim |
| nest-products-hexagonal | hexagonal | v1.3-external spec, verbatim |
| ddd-forum | ddd | v1.3-external spec, verbatim |
| finance-project-ddd | ddd | v1.3-external spec, verbatim |
| event-sourcing-ddd | ddd | v1.3-external spec, verbatim |
| ghostfolio-api | nestjs | NestJS API of the Nx monorepo: feature modules under src/app (controllers, services, modules), shared services under src/services (data providers, Prisma, queues, external APIs), src/models (portfolio rules, domain model), guards / interceptors / decorators (presentation). No architecture claim in the README. |
| directus-api | layered | Express API. The Directus docs describe services as the layer between controllers and the database; folders: database/ (Knex, migrations, run-ast), services/ (business), controllers/ + middleware/ (presentation). |
| outline-server | layered | Koa API. docs/ARCHITECTURE.md: routes (API), commands ("complex commands that perform actions across multiple models"), models (Sequelize), presenters ("the interface between backend -> frontend"), policies (authorisation), queues (processors, tasks). |
| logto-core | layered | Koa core service. Folders: queries/ (Slonik SQL access), libraries/ (business logic used by routes), routes/ + routes-me/ + middleware/ (HTTP presentation). No architecture claim in the README. |
| unleash | layered | Express server (src/lib). Classic stores / services / routes layering: db/ and the *-store.ts files (persistence), services/ and the feature *-service.ts files (business), routes/, middleware/ and the feature *-controller.ts files (presentation). The README's Architecture section is a system diagram. |
| budibase-server | layered | Koa server. Folders: api/routes + api/controllers + middleware (presentation), sdk/ (business), db/ + integrations/ (persistence and data-source access). No architecture claim in the README. |
| amplication-server | nestjs | NestJS GraphQL server: feature modules under src/core/<feature> (resolvers, services, modules, dto), Prisma access in src/prisma, models in src/models (GraphQL object types = domain model), guards / interceptors / filters / decorators (presentation). No architecture claim in the README. |
