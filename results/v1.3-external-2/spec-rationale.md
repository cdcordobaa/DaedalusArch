# v1.3 external set, wave 2: spec rationale (written before any tool run)

Wave 2 follows the wave-1 protocol (`results/v1.3-external/spec-rationale.md` on branch `v1.3-external-set`, PR #133). Each spec in `specs/<id>.yaml` copies the matching preset (`presets/<style>.yaml`) and replaces only its `architecture:` block. The `fitness_functions:` block is the preset's, unchanged (checked with `diff` for all 20). Nothing was tuned per project.

The mapping was written from two sources only: the project's own README and its folder and file names at the pinned SHA (`selection.json`). `git`, `ls`, `find`, `grep` and `head` read the source; `grep` was used to list imports and class declarations. The tool was not run on any project before these specs and this file were committed, and the commit history shows that order.

General rules, the same as wave 1:

- **Layer names follow the style's roles, not the project's folder names.**
- **Unmapped means not part of the declared architecture**: bootstrap, config, cross-cutting utilities, export-only barrels, and folders the README places outside the architecture. Unmapped files are listed per project.
- **Ring order for the clean projects**: inner to outer, domain, application, presentation (interface adapters), infrastructure (frameworks and drivers), and `main` (composition root, `kind: application`). Because the layers are listed inner to outer, an import from presentation into infrastructure is FF-S01 (wave-1 erratum 1, stated correctly here).
- **Directory globs take precedence over file-name patterns**, and the first matching layer wins. Extglobs (`!(*.module).ts`) keep Nest module files out of an infrastructure folder.
- **Project rules that disagree with the preset are kept as the preset says, and noted.**
- **Empty declarations.** `value_objects`, `repositories` and similar DDD lists must be non-empty (BR-SPEC-10, wave-1 addendum). Where a project has no such file, the project's or the preset's naming convention is declared; it matches nothing, so the rule checks nothing. Each case is listed.

## clean-architecture

### jamielivingstone-clean (JamieLivingstone/node-clean-architecture)

| Folder | Layer | Reason |
|---|---|---|
| `src/domain/**` | domain | Entities (`post.ts`). |
| `src/application/**` | application | Commands, queries, validators, mappers, the `IPostsRepository`/`ILogger` ports, and `application/di.ts`. |
| `src/web/api/{controllers,middlewares}/**`, `src/web/api/app.ts` | presentation | Express controllers, request/response middlewares, the Express app. |
| `src/infrastructure/**` | infrastructure | Prisma repository, logger, `infrastructure/di.ts`. |
| `src/web/crosscutting/**`, `src/web/api/server.ts` | main | Awilix container and the server bootstrap. |

- **Judgement:** each layer registers its own services in a `di.ts` file in its own folder. They stay in their folder's layer as placed by the author, so `infrastructure/di.ts` importing application ports is inward and allowed.
- **Judgement:** Jason Taylor's template, which the README credits, lets the Web project reference Infrastructure. Under this set's ring order, presentation importing infrastructure is a direction finding. Expected only if a controller imports infrastructure directly.

### nutes-template-base (nutes-uepb/template-base-ts)

| Folder | Layer | Reason |
|---|---|---|
| `src/application/domain/**` | domain | Entity base class, exceptions, serialisable interface. |
| `src/application/port/**`, `src/application/integration-event/**` | application | Repository, service and query ports; integration events and handler interfaces. |
| `src/ui/**` | presentation | Inversify-express controllers and the API exception mapping. |
| `src/infrastructure/**` | infrastructure | Mongo and RabbitMQ connections, the event bus, the base repository, query objects, and `infrastructure/port/*` (infrastructure-side interfaces). |
| `src/di/**`, `src/background/**`, `src/app.ts` | main | Inversify container, the background service that opens connections, the Express app. |
| `src/utils/**` | unmapped | Logger and defaults, used by every ring. |

- **Judgement:** `infrastructure/port/*` are interfaces, but they describe infrastructure connections (DB, RabbitMQ), live in the infrastructure folder, and are used only there. They stay in infrastructure.
- **Style choice:** the GitHub description says "hexagonal and clean"; the README says only clean, so the project is in the clean quota.

### felixle-node-core (felixle236/node-core)

| Folder | Layer | Reason |
|---|---|---|
| `src/domain/**` | domain | README: common, entities, enums, value-objects. |
| `src/application/**` | application | README: "interfaces/repositories", "interfaces/services", "usecases: Business logic". |
| `src/exposes/**` | presentation | README: mobile and web APIs (controllers, middlewares, authenticators), socket channels, doc and web UI. |
| `src/infras/**` | infrastructure | README: TypeORM and Redis data, HTTP and socket servers, mail/SMS/storage/payment/notification services, and the `*Register.ts` DI registrations. |
| `src/app.ts` | main | README: "Main application". |
| `src/shared/**`, `src/config/**`, `src/utils/**`, `src/resources/**` | unmapped | README: shared is "Common defination" (exceptions, decorators, types, the use-case base classes, database interfaces); config and utils are cross-cutting. |

- **Judgement:** leaving `shared/` unmapped follows wave 1's luizomf `common/`: mapping a declared cross-cutting folder would turn a design choice into findings. It also means that the use-case base classes and the database interfaces in `shared/` are not checked.
- **Note:** imports use `baseUrl` paths (`application/...`, `shared/...`). The run uses the project's `tsconfig.json`.

### adilsonfuxe-auth (AdilsonFuxe/auth-microservice)

| Folder | Layer | Reason |
|---|---|---|
| `src/domain/**` | domain | Models and use-case interfaces (`domain/usecases`). |
| `src/data/**` | application | Use-case implementations (`db-*`) and the protocols they need (cryptography, db, remote). |
| `src/interface/**`, `src/validation/**` | presentation | Controllers, HTTP helpers, errors, middlewares, presentation protocols; validators of request input. |
| `src/infra/**` | infrastructure | Bcrypt/JWT adapters, Mongoose models and repositories, remote mail, validator adapters. |
| `src/main/**` | main | Factories, Express adapters, routes, config, middlewares. |

- **Judgement:** `validation/` implements the presentation layer's `Validation` protocol in the course layout this project follows, so it is an interface adapter (presentation), not application.

## layered

The layered preset is strict: persistence, then business, then presentation, and no layer may be skipped. FF-S03 is blocking for this style.

### typeplate (steve-lebleu/typeplate)

| Folder | Layer | Reason |
|---|---|---|
| `src/api/core/{repositories,models,subscribers}/**` | persistence | README "repositories, models"; TypeORM entity subscribers are lifecycle hooks of the models. |
| `src/api/core/services/**`, `src/api/shared/services/**` | business | README "services"; `shared/services/business.service.ts` is the business-rule base. |
| `src/api/core/{controllers,routes,middlewares,validations}/**` | presentation | README "controllers"; Express routes, middlewares, Joi validations. |
| `src/api/config/**`, `src/api/core/{types,utils,factories}/**`, `src/api/app.bootstrap.ts` | unmapped | Config, shared types/enums/errors, utilities, error/token factories, bootstrap. |

- **Judgement:** `models/` goes to persistence because they are TypeORM entities (wave-1 w3tec choice). Services and controllers that pass models around will produce skip or direction findings for humans to judge.
- **Provenance:** the pin is a 2022-12-24 snyk-bot commit; the last human commit is 2021-12-25 and no `src/` file changed in between (`selection.json`).

### geekyants-express (GeekyAnts/express-typescript)

| Folder | Layer | Reason |
|---|---|---|
| `src/models/**` | persistence | Mongoose `User` model. |
| `src/services/**` | business | `services/strategies`: the Passport strategies (Local, Google, Twitter), which hold the login and account-linking logic. |
| `src/controllers/**`, `src/routes/**`, `src/middlewares/**` | presentation | Web and API controllers, route tables, Express middlewares. |
| `src/providers/**`, `src/exception/**`, `src/interfaces/**`, `src/index.ts` | unmapped | Providers are framework bootstrap (Express, Database, Passport, Queue, Locals config); exception handlers; interface types. |

- **Caveat:** the weakest claim in the layered quota after ngduc: the README shows the folder tree but makes no layering statement. The business layer is thin (three strategies).
- **Expected tension, not checked:** controllers that use the `User` model directly skip the business layer (FF-S03) by construction of the project.

### ngduc-node-rem (ngduc/node-rem)

| Folder | Layer | Reason |
|---|---|---|
| `src/api/models/**` | persistence | Mongoose models. |
| `src/api/services/**` | business | Auth providers and the socket service. |
| `src/api/{controllers,routes,validations,middlewares}/**` | presentation | Express controllers, routes, Joi validations, middlewares. |
| `src/api/utils/**`, `src/config/**`, `src/index.ts` | unmapped | Utilities (errors, constants, model helpers), Express/Mongoose/Passport config, bootstrap. |

- **Caveat:** folder-structure claim only. Most controllers call models directly, which is the boilerplate's shape; FF-S03 findings are expected.
- **Note:** the licence names a 2017 JavaScript ancestor (Daniel Sousa). The TypeScript code at the pin is the author's port; the history from 2018-09 is in this repository.

### shihabmridha-repo-ioc (shihabmridha/nodejs-repository-pattern-and-ioc)

| Folder | Layer | Reason |
|---|---|---|
| `src/repositories/**`, `src/database.ts` | persistence | README: "The base repository is src/repositories/repository.ts"; the Mongo connection. |
| `src/services/**` | business | User service. |
| `src/controllers/**`, `src/routes.ts` | presentation | Controller and route table. |
| `src/dto/**`, `src/errors/**`, `src/utils/**`, `src/app.ts`, `src/server.ts`, `src/inversify.ts`, `src/logger.ts`, `src/constants.ts`, `src/types.ts` | unmapped | DTOs, errors, utilities, bootstrap, DI container and symbols. |

- **Judgement:** `dto/` is unmapped because the DTOs are the service signatures, used by both controller and service. Putting them in presentation would make every service import a direction finding.

## nestjs

The preset's role order is kept: domain innermost, then infrastructure, then application, then presentation; `*.module.ts` is presentation. Project globs are added; the preset's generic directories are dropped where the project has none, as in wave 1.

### staart-api (staart/api)

| Files | Layer | Reason |
|---|---|---|
| `src/providers/**` (not `*.module.ts`), `src/middleware/**`, `src/filters/**`, `src/pipes/**`, `**/*.strategy.ts` | infrastructure | Wrappers for Prisma, mail, S3, Twilio, Elasticsearch, DNS, GitHub, Slack, ...; middleware, filters and pipes (preset roles). |
| `**/*.service.ts`, `**/*.dto.ts` | application | Feature services and DTOs. |
| `src/interceptors/**`, `**/*.controller.ts`, `**/*.module.ts`, `**/*.guard.ts`, `**/*.decorator.ts` | presentation | Preset roles; parameter/scope decorators. |
| `src/errors/**`, `src/helpers/**`, `src/config/**`, `src/templates/**`, `**/*.interface.ts`, `**/*.constants.ts`, `src/main.ts` | unmapped | Error messages, helpers, config, email templates, shared types and constants, bootstrap. |

- **Judgement:** the domain layer is empty: data access is through the Prisma client, with no entity classes. Domain-only rules have nothing to check here (wave-1 zeldaplay).
- **Judgement:** `providers/*/*.service.ts` are infrastructure, not application, because the directory glob takes precedence over the `*.service.ts` pattern.

### bank-server (pietrzakadrian/bank-server)

| Files | Layer | Reason |
|---|---|---|
| `src/common/entities/**`, `src/modules/*/entities/**`, `**/*.entity.ts` | domain | TypeORM entities and the abstract entity (preset choice, wave-1 neoteric). |
| `src/migrations/**`, `src/middlewares/**`, `src/filters/**`, `src/modules/*/{repositories,subscribers,strategies}/**`, `src/utils/strategies/**`, `src/utils/ormconfig.ts` | infrastructure | Repositories, TypeORM subscribers, Passport strategies, the snake-naming strategy and ORM config. |
| `src/common/dtos/**`, `src/modules/*/{dtos,services,crons}/**`, `src/utils/services/**` | application | DTOs, services, scheduled jobs that call services, generator/validator utility services. |
| `src/modules/*/controllers/**`, `src/guards/**`, `src/interceptors/**`, `src/decorators/**`, `**/*.module.ts` | presentation | Controllers, guards, interceptors, decorators, modules. |
| `src/common/constants/**`, `src/exceptions/**`, `src/interfaces/**`, `src/providers/**`, `src/modules/*/{exceptions,templates}/**`, `src/utils/{index,swagger}.ts`, `src/main.ts` | unmapped | Constants, exceptions, interfaces, request-context providers, email templates, Swagger setup, bootstrap. |

- **Judgement:** entities in domain carry TypeORM decorators, so FF-P01 domain-purity findings are likely. As in wave 1, humans judge whether that is meaningful for a Nest + TypeORM app.
- **Judgement:** `*.cron.ts` are application (they orchestrate services on a schedule), like the preset's `*.processor.ts`.

### saluki-nestjs-template (Saluki/nestjs-template)

| Files | Layer | Reason |
|---|---|---|
| `**/*.entity.ts` | domain | README: "passenger.entity.ts: The actual TypeORM entity". |
| `src/migrations/**`, `src/modules/*/provider/**` | infrastructure | Migrations; providers (config provider, logger service, repository providers). |
| `src/modules/*/service/**`, `**/*.data.ts`, `**/*.input.ts` | application | Services; README: `.data.ts` "returned in the response", `.input.ts` "used in the request" (DTOs). |
| `src/modules/*/{controller,flow,security}/**`, `**/*.module.ts` | presentation | Controllers; README: flow is "pipes, interceptors and everything that may change the request or response flow"; guards. |
| `src/modules/common/model/**`, `src/modules/tokens.ts`, `src/server.ts` | unmapped | Config type, DI tokens, bootstrap. |

- **Judgement:** `provider/logger.service.ts` is infrastructure because the directory glob wins over `*.service.ts`.

### monstarlab-nestjs-starter (monstar-lab-oss/nestjs-starter-rest-api)

| Files | Layer | Reason |
|---|---|---|
| `src/*/entities/**` | domain | TypeORM entities. |
| `src/*/{repositories,strategies}/**`, `src/shared/{filters,middlewares}/**`, `src/shared/logger/**` (not module) | infrastructure | Repositories, Passport strategies, exception filter, request-id middleware, logger service. |
| `src/*/{services,dtos}/**`, `src/shared/acl/**`, `src/shared/request-context/**` | application | Services, DTOs, the ACL service and rules, the request-context DTO and helpers. |
| `src/*/{controllers,guards,decorators}/**`, `src/shared/interceptors/**`, `**/*.module.ts` | presentation | Controllers, guards, decorators, logging interceptor, modules. |
| `src/shared/{configs,constants,exceptions}/**`, `src/*/constants/**`, `src/cli.ts`, `src/main.ts` | unmapped | Config, constants, base exception, CLI and HTTP bootstrap. |

## hexagonal

`allowed_dependencies` is the preset's: application to domain; inbound and outbound adapters to application and domain; config to everything.

### hexapinod (cecric/hexapinod)

| Files | Layer | Reason |
|---|---|---|
| `src/core/*/{models,interfaces,services,exceptions}/**` | domain | README: "core: your business core. It is also called 'Domain'"; `interfaces/repositories` "describe the interface to be used by your repositories into the infrastructure". |
| `src/core/*/{usecases,eventslisteners}/**` | application | Use cases and event listeners. |
| `src/application/api/rest/**`, `src/application/api/apicallwrapper.ts`, `src/application/cli/**` | adapters-inbound | README: "application: the code of the adapters for your input part ... REST Api input, the CLI input". |
| `src/infrastructure/**` | adapters-outbound | README: "adapters for your infrastructure ... repositories". |
| `src/application/api/server.ts`, `src/application/api/wsserver.ts` | config | HTTP and WebSocket server bootstrap. |
| `src/dependencies/**` | unmapped | README: "dependencies libraries that could be used in the three previous part ... automatic loaders and the base class from the framework". |

- **Judgement:** the README's "core" is one folder for both domain and use cases. The spec splits it by subfolder role.
- **Judgement:** `dependencies/` holds the framework base classes (`model`, `usecases`, `service-manager`) that core extends. Leaving it unmapped means those inheritance edges are not checked; mapping it to any ring would contradict the README, which puts it beside all three parts.

### ts-seed-hexagonal (somosphi/ts-seed-hexagonal)

| Files | Layer | Reason |
|---|---|---|
| `src/core/service/**` | domain | Domain services (payment, user). |
| `src/core/useCase/**` | application | Use cases. |
| `src/interface/{http,amqp}/**` | adapters-inbound | HTTP controllers, schemas, middlewares; AMQP consumers. |
| `src/infrastructure/{adapter,repository}/**` | adapters-outbound | MySQL, HTTP and message-bus adapters; repositories. |
| `src/{core,infrastructure,interface}/container.ts`, `src/index.ts` | config | Each ring's wiring and the app entry. |
| `src/types/**`, `src/util/**` | unmapped | Shared type declarations (mostly `.d.ts`), env/logger/client factories. |

- **Caveat:** published as one commit (2021-06-10, before the Copilot preview), so the in-repository history is a single import of company code.

### remix-hexagonal (antoinechalifour/remix-hexagonal-architecture)

| Files | Layer | Reason |
|---|---|---|
| `src/*/domain/**` | domain | README: "domain modeling ... domain interfaces, behaviors and ports"; errors and events. |
| `src/*/usecase/**`, `src/*/application/**` | application | README: use cases and "the application layer (glue between layers)". |
| `src/web/{authenticator,controllers,remix}/**` | adapters-inbound | Session authenticator, event controllers, Remix loaders/actions and DTOs. |
| `src/*/infrastructure/**`, `src/shared/database/**` | adapters-outbound | README: "repositories are implemented"; Prisma client and base repository. |
| `src/web/ApplicationModule.ts`, `src/web/index.ts`, `src/main.ts`, `src/keys.ts` | config | Nest application module, entry, DI keys. |
| `src/{authentication,todo-list-manager}/index.ts` | unmapped | Export-only barrels (wave-1 vivify). |
| `src/shared/{client,events,id,lib,mail,time}/**` | unmapped | Each folder holds a port together with its implementations (`Mailer` with `SendGridMailer` and `FakeMailer`, `Clock` with `RealClock`). It is a shared kernel, not one ring. |
| `app/**` | unmapped | React/Remix UI (`.tsx`), outside `src/`. |

- **Judgement:** `src/web` is the Nest-plus-Remix inbound side. The README notes it was written for a front-end-heavy app, but every file under `src/` is server code.
- **Known consequence:** the module barrels re-export infrastructure classes, so `src/web` reaching infrastructure through a barrel is resolved by the default graph to the declaring file (ADR-V13-01) and may appear as an inbound-to-outbound finding.

### quiz4devs-backend (pabloleonalcaide/quiz4devs-backend)

| Files | Layer | Reason |
|---|---|---|
| `src/contexts/**/domain/**` | domain | Quiz, Answer, the repository interface, the shared `GenericError`. |
| `src/contexts/**/application/**` | application | Creator, finder, searcher, updater use cases. |
| `src/apps/*/{controllers,routes}/**` | adapters-inbound | Express controllers and routes. |
| `src/contexts/**/infrastructure/**`, `src/database.ts` | adapters-outbound | In-memory repository, DB connection. |
| `src/apps/*/config/**`, `src/app.ts`, `src/server.ts`, `src/environment.ts` | config | Dependency-injection registration, bootstrap. |

- **Style choice:** the README claims DDD, hexagonal and CQRS. It is in the hexagonal quota because the layout is ports and adapters (Codely `apps` + `contexts`) and it has one aggregate only.

## ddd

`allowed_dependencies` is the preset's. Contexts are declared from top-level modules. Aggregates come from the source tree, found with `grep 'class X extends|type X = AggregateRoot'`, which reads the source and is not the tool.

### pezzetti-base-app (pezzetti/base-app-nestjs)

- **Source root:** `src/modules/`, with contexts `auth` and `users`. `src/common`, `src/config` and the root files are outside every context.
- **Public API:** none declared for either context; neither publishes a barrel or contracts folder. `auth/shared/auth.service.ts` imports `users/domain` and `users/interfaces`, so FF-DS02 findings are expected. Whether `users/interfaces` counts as a published contract is a question for the labeller.
- **Layers:**
  - **domain:** `*/domain/**` (`user.domain.ts`, a validated input class, and `user.entity.ts`, the TypeORM entity).
  - **application:** `*/applications/**`, `*/interfaces/**` (application and service ports, DI symbols), and auth's service, token and user types.
  - **infrastructure:** `*/services/**` and the auth Passport strategies.
  - **api:** controllers, the GraphQL resolver, auth guards, `src/common/**` (validation pipe).
  - **composition:** `src/main.ts`, `src/app.module.ts`, `src/ormconfig.ts`, `src/config/**`, `*/*.module.ts`.
- **Judgement:** `users/services/*` inject the TypeORM `Repository<User>` and implement the service interfaces; that is the persistence side, so they are infrastructure even though the folder is called services.
- **Aggregates:** `User` (root `user.entity.ts`, no inner entities). `auth` has no aggregate.
- **Empty declarations:** no value-object, repository or domain-event file exists at the pin. The declared globs (`*.value-object.ts`, `repositories/**`, `DomainEvent`) match nothing, so FF-DT03, the repository rules and FF-DT05 check nothing.
- **Provenance:** the pin is a 2022-12-11 dependabot commit; the last human commit is 2022-07-26 and no `src/` file changed in between.

### talyssonoc-node-api (talyssonoc/node-api-boilerplate)

- **Source root:** `src/`, with contexts `article` and `comment`. `_sharedKernel`, `_lib`, `_boot` and the root files are outside every context.
- **Public API:** each context's `index.ts`, which is its DI module (`makeModule`). `comment/application/useCases/CreateComment.ts` imports `article/domain/ArticleRepository`, and `article/infrastructure/MongoFindArticles.ts` imports `comment/infrastructure/CommentCollection`. Both are cross-context imports outside the public API, so FF-DS02 findings are expected; the second also crosses at the infrastructure level.
- **Layers:** domain `*/domain/**` and `_sharedKernel/domain`; application `*/application/**`; infrastructure `*/infrastructure/**` and `_sharedKernel/infrastructure`; api `*/interface/**` (HTTP handlers, the email listener) and `_sharedKernel/interface`; composition the two `index.ts`, `_boot/**` and the root files. `_lib/**` (DI adapters, HTTP helpers, pub/sub, errors) is unmapped.
- **Judgement:** `_lib` is a framework library used by every layer (like hexapinod's `dependencies/` above). Mapping it would turn the design into findings.
- **Aggregates:** `Article` and `Comment` (both `AggregateRoot<...>` types), no inner entities.
- **Type-only files:** `ArticleRepository.d.ts`, `ArticleId.d.ts`, `CommentId.d.ts`, `CommentRepository.d.ts` and `FindArticles.d.ts` are declaration files. They are excluded from the file count and are expected to be absent from the graph, so the value-object and repository-interface globs that name them may match nothing. Recorded here before the run; the run will show which.
- **Other declarations:** event type `Event` (`_lib/events/Event.d.ts`); application services `*/application/useCases/*.ts`.

### camps-graphql-api (christophe-chausseray/camps-graphql-api)

- **Project shape:** one model, organised layer-first (`src/{domain,application,infrastructure}/camping`).
- **How contexts were declared:** as wave-1 event-sourcing-ddd. The one domain folder `src/domain/camping` is the single context under source root `src/domain/`, and its **public API is the whole folder**, so FF-DS02 cannot fire. The spec does not assert strategic isolation that the project never claimed.
- **Layers:** domain `src/domain/**`; application `src/application/**` (command and query handlers); infrastructure `src/infrastructure/persistance/**` (in-memory and Knex repositories and queries); api `src/infrastructure/{api,cli}/**` (GraphQL resolvers and types, the import CLI); composition `src/infrastructure/server/**`, `src/index.ts`.
- **Aggregates:** `Camping` and `Comment`. Each has its own identifier value object and its own repository, so they are separate aggregates. The domain folder is flat, so both modules are `src/domain/camping/**` (wave-1 ddd-forum judgement): an import between them is never an FF-DT01 finding.
- **Other declarations:** value objects `valueObject/**`; repositories the Knex and in-memory `*Repository.ts`; no domain-event type exists (`DomainEvent` declared, matching nothing); application services `*Handler.ts`.

### mustodon (victormonserrat/mustodon)

- **Source root:** `src/`, with context `todos`. `src/common/**` (AggregateRoot, Entity, ValueObject, Id) is the shared kernel, outside the context. `config/` (Nest modules and providers, outside `src/`) is the composition.
- **Public API:** none declared; there is only one context.
- **Layers:** domain `*/domain/**` and `common/domain`; application `*/application/**` (commands, queries, handlers, the `TodoViews` read repository port, view model); infrastructure the event-store and Mongoose repositories, the Mongoose view model and the projection event handlers; api the controllers and the three API DTO files; composition `src/main.ts`, `config/**`. `todos/infrastructure/models/index.ts` (a barrel over both groups) is unmapped.
- **Aggregates:** `Todo` (root `domain/models/Todo.ts`), no inner entities.
- **Other declarations:** value objects `TodoId`, `TodoTitle` and the shared `Id`; repositories the domain `Todos`, the application `TodoViews` and the infrastructure implementations; event type `IEvent` (from `@nestjs/cqrs`); application services the command and query handlers.
- **Note:** `domain/events/CompletedTodo.ts` implements `ICommand`, not `IEvent`, at the pin; FF-DT05 reads the declared type and will treat it accordingly.
