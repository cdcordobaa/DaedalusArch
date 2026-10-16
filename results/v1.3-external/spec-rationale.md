# v1.3 external set: spec rationale (written before any tool run)

Each spec in `specs/<id>.yaml` copies the matching preset (`presets/<style>.yaml`) and replaces only its `architecture:` block. The `fitness_functions:` block is the preset's, unchanged. Nothing was tuned per project.

The mapping was written from two sources only: the project's own README and its folder and file names at the pinned SHA (`selection.json`). The tool was not run on any project before these specs and this file were committed. The commit history shows that order.

General rules applied to every project:

- **Layer names follow the style's roles, not the project's folder names.** For example, pvarentsov calls its outer ring `src/application/`, and the spec maps that folder to `presentation`.
- **Unmapped means not part of the declared architecture.** That covers bootstrap, config, cross-cutting utilities, and folders the README says are outside the architecture. Unmapped files are listed per project, so they can be read as a choice, not a gap.
- **Ring order for the clean projects.** The clean preset has three layers. When a project names more rings, the spec adds them inner to outer: domain, application, presentation (interface adapters), infrastructure (frameworks and drivers), and `main` (composition root, `kind: application`).
  - Placing presentation inside infrastructure is a judgement. Uncle Bob puts both controllers and gateways in the interface-adapter ring.
  - Under this order, an infrastructure file importing a presentation file is a direction finding. A presentation file importing infrastructure is not.
- **Directory globs take precedence over file-name patterns**, and the first matching layer wins (`src/neo4j-ingestion/layer-annotator.ts`). Where a Nest module file sits inside an infrastructure folder, an extglob (`!(*.module).ts`) keeps it in presentation with the other module files.
- **Project rules that disagree with the preset are kept as the preset says, and noted.** These specs measure the style, not the project's private variant.

## clean-architecture

### pvarentsov-clean (pvarentsov/typescript-clean-architecture)

| Folder | Layer | Reason |
|---|---|---|
| `src/core/domain/**` | domain | Entities, value objects, persistence ports and use-case ports per aggregate (media, post, user). |
| `src/core/common/**` | domain | Shared kernel: entity and value-object base classes, the use-case interface, message ports, exceptions. It sits inside `core`, and the README diagram places it at the centre. |
| `src/core/service/**` | application | Use-case implementations (`*Service`) and handlers. |
| `src/application/api/**` | presentation | NestJS HTTP controllers, guards and documentation DTOs. This is the project's "application" folder, but it plays the delivery role. |
| `src/infrastructure/**` | infrastructure | TypeORM repositories and entities, adapters, config, transaction. |
| `src/application/di/**`, `src/application/*.ts`, `src/Main.ts` | main | Nest DI modules and bootstrap. |

- **Judgement:** `core/domain/*/usecase/**` holds use-case *ports* (interfaces), so it stays in domain with the other ports. The use-case *implementations* are in `core/service`.
- **Judgement:** `infrastructure/adapter/usecase/**` holds adapter classes that wrap services for Nest DI. They stay in infrastructure because they are in that folder.

### luizomf-clean-api (luizomf/clean-architecture-api-boilerplate)

| Folder | Layer | Reason |
|---|---|---|
| `src/domain/**` | domain | README "domain layer" (Uncle Bob's entities). It also holds the use-case *interfaces* (`domain/use-cases`). |
| `src/application/**` | application | README "application layer": use cases, ports, validation, errors. |
| `src/presentation/**` | presentation | README "adapters (presentation) layer": controllers, middlewares, responses. |
| `src/infrastructure/**` | infrastructure | README "infrastructure layer": express, knex, repositories. |
| `src/main/**` | main | README "main layer ... may depend on all other layers": factories. |
| `src/common/**` | unmapped | The README makes it a cross-cutting layer that may be used by every layer. Mapping it would turn a declared design into findings. |

### dannielhugo-clean (dannielhugo/typescript-clean-architecture)

| Folder | Layer | Reason |
|---|---|---|
| `src/app/core/**` | domain | README "Core business rules: entities, definitions". |
| `src/app/**` (other) | application | README "{feat-name} - Business features": the use cases per feature (deposit, signup, transfer). |
| `src/data/**` | presentation | README "data - Interfaces adapters". |
| `src/frameworks/**` | infrastructure | README "frameworks - Frameworks and drivers that exposes the app": the REST api and script entry points with their presenters. |
| `src/test-environment.ts` | unmapped | Test helper. |

- **Judgement:** there is no separate composition root. The two framework entry points wire the app themselves, so they stay in infrastructure, and no `main` layer is declared.

## layered

The layered preset is strict: the order is persistence, then business, then presentation, and no layer may be skipped. FF-S03 is blocking for this style.

### bulletproof-nodejs (santiq/bulletproof-nodejs)

| Folder | Layer | Reason |
|---|---|---|
| `src/models/**` | persistence | Mongoose models: the data access layer of the 3-layer pattern in the README's companion post. |
| `src/services/**`, `src/subscribers/**` | business | Service layer; the event subscribers run business reactions. |
| `src/api/**` | presentation | Express routes and middlewares (the "controller" layer). |
| `src/loaders/**`, `src/config/**`, `src/jobs/**`, `src/decorators/**`, `src/interfaces/**`, `src/types/**`, `src/app.ts` | unmapped | Bootstrap, DI loaders, cross-cutting types and the job scheduler. They belong to no layer in the README. |

- **Expected tension, not checked:** the post's services use the injected Mongoose models directly. That is the intended shape, adjacent layers only.

### w3tec-express-boilerplate (w3tecch/express-typescript-boilerplate)

| Folder | Layer | Reason |
|---|---|---|
| `src/api/repositories/**`, `src/api/models/**`, `src/database/**` | persistence | The README's folder table names the repositories folder the "Repository / DB layer". TypeORM models, factories, seeds and migrations go with it. |
| `src/api/services/**`, `src/api/subscribers/**` | business | README "Service layer"; event subscribers. |
| `src/api/controllers/**`, `src/api/resolvers/**`, `src/api/middlewares/**`, `src/api/types/**` | presentation | REST controllers, GraphQL resolvers and their object types, middlewares. |
| `src/api/errors/**`, `src/auth/**`, `src/decorators/**`, `src/lib/**`, `src/loaders/**`, `src/app.ts`, `src/env.ts` | unmapped | Errors are shared by services and controllers. Auth, decorators, lib and loaders are framework plumbing. |

- **Judgement:** `models/` goes to persistence, not business, because these are TypeORM-decorated entities. Services and controllers that pass models around will produce skip or direction findings for humans to judge. That is a known weak point of strict layering with ORM entities.

### talento90-typescript-node (Talento90/typescript-node)

| Folder | Layer | Reason |
|---|---|---|
| `src/repositories/**`, `src/lib/database/**` | persistence | Knex repositories and the connection/migrations. |
| `src/managers/**`, `src/entities/**` | business | Managers hold the business operations, and the entities are plain business types they use. |
| `src/server/**` | presentation | Koa server, controllers, validators and middlewares. |
| `src/lib/{authentication,hasher,health}/**`, `src/container.ts`, `src/errors.ts`, `src/index.ts` | unmapped | Cross-cutting libraries, DI container, bootstrap. |

- **Caveat:** this is the weakest style claim in the set. The README makes no architecture claim; only the folder structure does.

## nestjs

The preset's own globs and file patterns are kept, and project globs are added. In the preset the domain is innermost, then infrastructure, then application, then presentation, and `*.module.ts` belongs to presentation.

### zeldaplay-api (jmcdo29/zeldaPlay, root `apps/api`)

| Files | Layer | Reason |
|---|---|---|
| `src/app/{database,redis,cookie,config}/**` (not `*.module.ts`), `src/app/options/**` | infrastructure | The database service (raw SQL), the Redis and cookie wrappers, and the config providers and options. |
| `**/*.service.ts`, `**/models/**`, `src/app/validators/**` | application | Feature services, and DTOs and GraphQL models. `models/` is this project's name for its DTO folder, so it was added to the preset's `dto` patterns. |
| `**/*.controller.ts`, `**/*.module.ts`, `**/*.guard.ts`, `src/app/guards/**` | presentation | Preset roles. |
| `src/main.ts`, `src/config.main.ts`, `src/spelunk.ts`, `*.constants.ts`, `*.interface.ts` outside `models/` | unmapped | Bootstrap and shared constants. |

- **Judgement:** the domain layer stays empty. The project has no ORM entities or domain classes; data is plain DTOs over SQL. Domain-only rules therefore have nothing to check, and that is reported as such.

### neoteric-nestjs-auth (neoteric-eu/nestjs-auth)

| Files | Layer | Reason |
|---|---|---|
| `src/app/*/entity/**`, `src/app/_helpers/entity/**` | domain | Entity folders. The preset maps `src/entities/**` to domain, and the same choice is applied to per-feature `entity/` folders. |
| `_helpers/{database,mail,sms,push,middleware,filters}/**`, `src/app/database/**` (not modules), `src/migrations/**`, `**/*.providers.ts`, `**/stategies/**` | infrastructure | Persistence helpers and external senders. `*.providers.ts` are TypeORM repository providers. `stategies` is the project's own spelling. |
| `**/*.service.ts`, `**/services/**`, `**/dto/**`, `**/*.validator.ts`, `**/*.voter.ts`, `src/app/security/**`, `src/app/*/security/**` | application | Services, DTOs, and the authorisation voters (decision logic). |
| `**/*.controller.ts`, `**/*.resolver.ts`, `**/resolvers/**`, `**/*.module.ts`, `**/*.guard.ts`, `**/*.command.ts`, `**/*.pipe.ts`, `**/*.scalar.ts`, `_helpers/{graphql,decorators}/**` | presentation | REST and GraphQL entry points, CLI commands (inbound), pipes, scalars and parameter decorators. |
| `src/base/**`, `src/config/**`, `_helpers/*.ts`, `*.constants.ts`, `*.enum.ts`, `home/attom/**` | unmapped | Base classes, config, request context, constants, and a typed API client. |

- **Judgement:** entities go to domain even though they carry TypeORM decorators. That follows the preset's own `src/entities/** -> domain`, and it makes FF-P01 domain-purity findings likely. Humans should judge whether those findings are meaningful for a Nest-plus-TypeORM app.

### vivify-nestjs-boilerplate (Vivify-Ideas/nestjs-boilerplate)

| Files | Layer | Reason |
|---|---|---|
| `**/*.entity.ts` | domain | TypeORM entity (same preset choice as above). |
| `src/migrations/**`, `src/modules/config/*` (not module), `**/*.strategy.ts`, `**/*.transformer.ts` | infrastructure | Migrations, config service, passport strategy, column transformer. |
| `**/*.service.ts`, `**/*.payload.ts`, `src/modules/common/validator/**` | application | Services, request payloads (DTOs) and class-validator constraints. |
| `**/*.controller.ts`, `**/*.module.ts`, `**/*guard.ts`, `**/*.pipe.ts`, `src/swagger/**`, `src/modules/common/{decorator,transformer}/**` | presentation | The pattern is `*guard.ts` because the file is named `jwt-guard.ts`. |
| `src/main.ts`, `src/main.hmr.ts`, `src/utils/**`, `index.ts` barrels | unmapped | Bootstrap and utilities. Barrels are left unmapped so they do not inherit a layer. |

## hexagonal

`allowed_dependencies` is the preset's: application to domain; inbound and outbound adapters to application and domain; config to everything.

### conduit-ports-adapters (rharison/conduit)

| Files | Layer | Reason |
|---|---|---|
| `src/core/types/**`, `src/core/*/types.ts` | domain | README: "core = pure domain implementations"; types are the model. |
| `src/core/*/use-cases/**` | application | README: "core/use-cases: functions with business rules". This includes the `*-adapter.ts` files there, which the README calls the "domain adapters" that ports call to reach the core. |
| `src/ports/express/**` | adapters-inbound | HTTP server. |
| `src/ports/adapters/**`, `src/ports/db-in-memory/**`, `src/ports/jwt/**` | adapters-outbound | README: "ports/adapters = adapters for ports (database adapter)"; DB and JWT implementations. |
| `src/config/**`, `src/app.ts`, `src/index.ts` | config | Module alias, entry points. |
| `src/helpers/**` | unmapped | Env helper. |

- **Judgement:** the README's "ports" means the outside world, which reverses the usual meaning. The spec maps by role (inbound HTTP versus outbound DB/JWT), not by the folder word.

### ddialar-hexagonal-boilerplate (rafagarcia/typescript.service.boilerplate)

| Files | Layer | Reason |
|---|---|---|
| `src/core/**` | domain | README "Core". |
| `src/ports/**` | application | README: "On this layer we implement the most part of our code business logic" (interactors and repositories). |
| `src/adapters/transportLayer/**` | adapters-inbound | README `transportLayer`: connectivity from outside. |
| `src/adapters/dataSources/**` | adapters-outbound | README `dataSources`: ORMs, persistence. |
| `src/server.ts`, `src/adapters/index.ts` | config | Entry and adapter barrel. |
| `src/utils/**` | unmapped | README: "this section doesn't belong to the Hexagonal Architecture at all". |

- **Known disagreement with the preset:** the README lets `ports/repositories` call `adapters/dataSources` directly. The preset forbids application-to-outbound-adapter edges, so such edges will be FF-S01 findings. They are *correct by the style* and *contrary to the project's own rules*. Humans should judge both columns.

### nest-products-hexagonal (fmcarrero/nest-js-products-api)

| Files | Layer | Reason |
|---|---|---|
| `src/domain/**` | domain | Domain model and `domain/ports`. |
| `src/application/**` | application | Use cases, commands, factory. |
| `src/infrastructure/controllers/**`, `src/infrastructure/exceptions/**` | adapters-inbound | HTTP controller and HTTP exception filter. |
| `src/infrastructure/adapters/**`, `src/infrastructure/mapper/**` | adapters-outbound | Mongo repository, schema, entity, mapper. |
| `src/infrastructure/*.ts`, `src/app.module.ts`, `src/main.ts` | config | Nest modules and config service, bootstrap. |

- **Judgement:** `domain/domain.module.ts` and `application/application.module.ts` stay in their folder's layer, as placed by the author. A Nest import from the domain is then a domain-purity finding.

## ddd

`allowed_dependencies` is the preset's. Contexts are declared from top-level modules; aggregates come from the `AggregateRoot` subclasses in the source tree. The listing used was `grep 'class X extends AggregateRoot|Entity|ValueObject'`, which reads the source and is not the tool.

### ddd-forum (stemmlerjs/ddd-forum)

- **Source root:** `src/modules/`, with contexts `forum` and `users`. The shared kernel is in `src/shared/`, outside the source root.
- **Public API:** none declared for either context, because neither publishes a barrel or contracts folder. Consequence: FF-DS02 reports every cross-context import, for example `forum/subscriptions/afterUserCreated.ts` importing `users` domain events. Whether domain events count as a published language is a question for the human labeller.
- **Layers:**
  - **domain:** `*/domain/**`, `*/repos/*.ts` (the repository *interfaces*), `src/shared/{domain,core}/**`.
  - **application:** use cases except their controllers, plus `subscriptions/`, `dtos/`, and `services/*.ts` (the auth service interface).
  - **infrastructure:** `repos/implementations/**`, `mappers/**`, `services/redis/**`, `src/shared/infra/database/**`, `src/shared/infra/*.ts`.
  - **api:** `*/infra/http/**`, `*Controller.ts`, `src/shared/infra/http/**`.
  - **composition:** `src/index.ts`, `src/config/**`.
  - **unmapped:** `src/shared/utils/**`.
- **Aggregates:**
  - `Post` (root `post.ts`; inner entities `comment.ts`, `postVote.ts`, `commentVote.ts`, which are `Entity` subclasses held through `Comments`, `PostVotes` and `CommentVotes`).
  - `Member` (no inner entities).
  - `User` (no inner entities).
- **Judgement:** the forum domain folder is flat, so each aggregate's `module` is the whole `forum/domain/**`. Imports of inner entities from other domain files are therefore never FF-DT01 findings.
- **Expected:** the project has a `commentRepo`, a repository for an inner entity, so an FF-DT02 finding is expected. Evans says that is wrong, while the project chose it.
- **Value objects:** the 12 files whose class extends `ValueObject`. `*Id` classes extend `Entity` and are not listed.
- **Repositories:** `src/modules/*/repos/**`. **Event base type:** `IDomainEvent`. **Application services:** use-case files other than Controller, DTO, Errors and index.

### finance-project-ddd (4lessandrodev/finance-project-ddd)

- **Source root:** `src/modules/`, with contexts `budget-box`, `transaction` and `user`. `src/modules/shared/**` is the shared kernel, outside every context.
- **Public API:** the `user` context publishes `src/modules/user/domain/index.ts`, which is its only barrel. The other two contexts declare none.
- **Layers:** `infra/` is split by role.
  - **api:** `resolver/`, `inputs/`, `types/`, and auth `guards/`, `strategies/` and `decorators/`.
  - **infrastructure:** `repo/`, `entities/` (Mongoose schemas), `services/queries/`, and the shared kernel's `infra/connections/`.
  - **composition:** `infra/*.ts`, which are each context's Nest module and service facade, plus `src/main.ts`, `src/app.module.ts` and `src/config/**`.
  - **unmapped:** `src/docs`, `src/health-check`, `src/types`, `src/utils`, the shared kernel's `interfaces/`, `proxies/`, `utils/` and `domain/`, and `application/mocks`.
- **Judgement:** the shared kernel's own domain services (`src/modules/shared/domain/**`) are left unmapped rather than put in `domain`. They are outside every context, and FF-DS02 does not check them (DDD notes §4).
- **Judgement:** `infra/<ctx>.service.ts` are Nest facade services that call use cases. They are placed in composition (wiring), not application, because they live in `infra/` beside the module.
- **Aggregates:**
  - `BudgetBox` (inner entity `reason.domain-entity.ts`, the only `Entity` subclass).
  - `Transaction` (no inner entities).
  - `User` (no inner entities).
- **Other declarations:** value objects are `*.value-object.ts`. Repositories are the domain interfaces plus `infra/repo/*.repository.ts`. The event type is `IDomainEvent`. Application services are `*.use-case.ts`.

### event-sourcing-ddd (yerinadler/typescript-event-sourcing-sample-app)

- **Project shape:** this is a single model organised by technical top-level folders, not by context.
- **How contexts were declared:**
  - The tool's DDD model needs top-level context modules. The two aggregate folders `src/domain/book` and `src/domain/user` are therefore declared as contexts under source root `src/domain/`.
  - Each context's **public API is the whole folder**. FF-DS02 can then not fire, so the spec does *not* assert strategic isolation that the project never claimed.
  - FF-DS01 is satisfied by construction.
  - **This is the most consequential judgement in the set.**
- **Layers:**
  - **domain:** `src/domain/**` and `src/core/**`. The README places `core` (AggregateRoot, Event, bus, store and repository interfaces) at the centre of the onion.
  - **application:** commands, command handlers, event handlers.
  - **infrastructure:** `src/infrastructure/**` and `src/projection/**` (Redis read-model facades).
  - **api:** `src/interfaces/http/**`.
  - **composition:** `entrypoint.ts`, `index.ts`, `config/**`, `constants/**` (DI symbols).
- **Judgement:** event handlers that write the Redis read model are application, as the README's "event processor" description suggests, not infrastructure. Their direct Redis use will appear as findings.
- **Aggregates:** `Book` and `User`, with no inner entities. No value-object files.
- **Other declarations:** the event types are `IEvent` and `Event`. Repositories are `src/domain/*/I*Repository.ts` plus `src/infrastructure/repositories/**`. The application services are the command handlers.

## Addendum: after `firewall validate`, before any evaluation (second commit)

`firewall validate --spec <spec> --project <clone>` was run on all 15 specs after the first commit. It parses and compiles the spec and checks each layer directory exists; it does not analyse the code. Outputs are in `validate/`.

- **event-sourcing-ddd: one real defect.** Compilation failed with `MISSING_REQUIRED_PARAM BR-SPEC-10 FF-DT03: valueObjectPatterns`, because `value_objects: []` is not allowed.
  - **Fix:** the spec now declares `value_objects: ["src/domain/**/*ValueObject.ts"]`. That glob matches no file at the pin, so FF-DT03 checks nothing on this project, which matches the rationale: the project has no value objects.
- **Ten other specs: `LAYER_DIR_NOT_FOUND` errors, left unchanged.** These are not defects:
  - The validator strips only a trailing `/**` or `/*` and then checks that the literal path exists. A glob with a wildcard mid-path (`src/modules/*/domain/**`, `src/core/*/use-cases/**`) or a file glob (`src/application/*.ts`, `!(*.module).ts`) is reported as missing even when it matches files.
  - The NestJS preset's own default directories (`src/domain`, `src/services`, and so on) are also reported, because these projects do not have them.
  - `firewall evaluate` does not run this check; `ValidateSpecCommand` is not wired into the evaluate pipeline. The specs are therefore left unchanged, and the errors are reported here.
