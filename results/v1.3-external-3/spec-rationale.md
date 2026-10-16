# v1.3 external set, wave 3: spec rationale (written before any tool run)

Wave 3 follows the wave-1 and wave-2 protocol (`results/v1.3-external-2/spec-rationale.md` on branch `v1.3-external-set-2`, PR #181). Each spec in `specs/<id>.yaml` copies the matching preset (`presets/<style>.yaml`) and replaces only its `architecture:` block. The `fitness_functions:` block and everything after it is the preset's text, unchanged (checked with `diff` for all 25). Nothing was tuned per project.

The mapping was written from the project's README and its folder and file names at the pinned SHA (`selection.json`). Only `cat`, `ls`, `find`, `grep`, `head`, `sed -n`, `wc` and read-only `git` read the source; `grep` listed imports and class declarations. The tool was not run on any project before these specs and this file were committed, and the commit history shows that order.

**Authorship.** The 25 specs were written by five parallel Claude-family sub-agents of one session (one per style), each given the same brief: wave 2's general rules and style section, the wave-2 specs as format reference, and the preset. The selection was made by the parent session. Selection and specs are therefore one model family's judgement over human code, as in waves 1 and 2.

General rules, the same as waves 1 and 2:

- **Layer names follow the style's roles, not the project's folder names.**
- **Unmapped means not part of the declared architecture**: bootstrap, config, cross-cutting utilities, export-only barrels, and folders the README places outside the architecture. Unmapped files are listed per project.
- **Ring order for the clean projects**: inner to outer, domain, application, presentation (interface adapters), infrastructure (frameworks and drivers), and `main` (composition root, `kind: application`).
- **Directory globs take precedence over file-name patterns**, and the first matching layer wins. Extglobs keep specific files out of a folder glob.
- **Project rules that disagree with the preset are kept as the preset says, and noted.**
- **Empty declarations.** DDD lists must be non-empty (BR-SPEC-10). Where a project has no such file, the project's or the preset's naming convention is declared; it matches nothing, so the rule checks nothing. Each case is listed.
- **Analysis roots.** Three projects are analysed from a sub-folder (`nalhin-movies` and `meetinger`: `backend/`; `ddd-libellis`: `application/`). Their globs are relative to that root.


## clean-architecture

Ring order as in waves 1 and 2, inner to outer: domain, application, presentation (interface adapters), infrastructure (frameworks and drivers), `main` (composition root, `kind: application`). Roles follow wave 2. `fitness_functions:` is the preset's text, appended with `sed` and checked with `diff` for all five specs.

### msc29-clean (MSC29/clean-architecture-typescript)

| Folder | Layer | Reason |
|---|---|---|
| `src/domain/**` | domain | Entities (`cat_fact_entity`, `dog_fact_entity`) and the `base/` entity, exception, payload, presenter and SPI-response base types. |
| `src/application/**` | application | Use cases, repository abstracts (`*_repository_abstract.ts`), mapper interfaces, use-case error helper. |
| `src/adapter/api/**` | presentation | Fastify controllers, presenters, payloads, request types, route schemas and routes; error presenters. |
| `src/adapter/spi/**`, `src/infrastructure/spi/**` | infrastructure | TypeORM and Axios connections, models and mappers, the db/http repository implementations, the repositories plugin; the TypeORM store plugin. |
| `src/infrastructure/app.ts`, `src/index.ts` | main | `app.ts` builds the Fastify instance and registers db, repositories and routes; `index.ts` starts it. |
| `src/infrastructure/config/**` | unmapped | Env and Swagger options (config). |
| `src/infrastructure/@types/**` | unmapped | `index.d.ts`, Fastify type augmentation. |
| `tests/**` | unmapped | Tests, outside `src/`. |

- **Style choice:** README title and first line: "Clean architecture: typescript", "A Clean Architecture template for a Rest API".
- **Judgement:** `adapter/` holds both sides. `api` (driving side: controllers, presenters) is presentation. `spi` (driven side: repository implementations over TypeORM and Axios) is infrastructure, as wave 2 put adilsonfuxe's `infra/` repositories.
- **Judgement:** the author's `src/infrastructure/` mixes the composition root (`app.ts`), a driver plugin (`spi/store.ts`), config and type declarations. It is split by file role, like jamielivingstone's `server.ts` in wave 2.
- **Note:** the source imports `adapters/...`, but the folder on disk is `src/adapter/` (singular). Neither tsconfig path (`*` -> `src/*`, `interfaces/*` -> `src/adapters/*`) resolves these imports to an existing folder. Every import of an adapter module (from `app.ts`, `store.ts`, `@types/index.d.ts` and between adapter files) is predictably unresolved, so those edges will be missing from the graph. The mapping is not changed for this.
- **Note:** `domain/base/` declares presenter, payload and SPI-response base types. This is outer-ring vocabulary in the domain, but it adds no import edge and so no finding.

### leal32b-webapi (leal32b/webapi-nodejs)

| Folder | Layer | Reason |
|---|---|---|
| `src/core/0.domain/**`, `src/modules/*/0.domain/**` | domain | Base entity/aggregate/value object/event, validators, errors; `user` aggregate, value objects, events; `communication` email entity and value objects. |
| `src/core/1.application/**`, `src/modules/*/1.application/**` | application | Use-case base, cryptography ports, application errors; user use cases and `UserRepository`; communication use case, handler, `EmailSender`. |
| `src/core/2.presentation/**`, `src/modules/*/2.presentation/**` | presentation | Controller and middleware bases, response factories; user controllers. |
| `src/core/3.infra/**`, `src/modules/*/3.infra/**` | infrastructure | Express/Ajv/Argon/JWT/Nodemailer adapters, API middlewares and docs, Postgres and MongoDB clients, entities, repositories, migrations, fixtures; user API routes. |
| `src/core/4.main/**`, `src/modules/*/4.main/**` | main | Container (`make-*`), setup (webapp, routers, middlewares, handlers, fixtures), `server.ts`; module factories and setup. |

- **Style choice:** README: "Applying concepts of TDD (Test-Driven Development), DDD (Domain-Driven Design) and Clean Architecture". Folder evidence: numbered rings `0.domain` to `4.main` in `src/core` and in each module.
- **Judgement:** the numbered folders map one-to-one. `3.infra/api/routes` (Express routes) stays in infrastructure, where the author placed it.
- **Judgement (predictable finding):** four infrastructure files import `@/core/4.main/container/index` (`persistence`): `postgres-user-repository.ts`, `mongodb-user-repository.ts`, `postgres-fixture.ts` and `mongodb-fixture.ts`. Infrastructure importing main is outward, so these are expected FF-S01 findings.
- **Note:** modules import each other (for example `user` application to `communication`). The clean preset has no module rule, so this is not checked.

### cersouza-boilerplate (cersouza/nodejs-app-boilerplate)

| Folder | Layer | Reason |
|---|---|---|
| `src/domain/**` | domain | `models/Customer`, `interfaces` (incl. `ICustomerRepository`, request types), `validators`, `Exceptions`. |
| `src/use-cases/**` | application | `CreateCustomerUseCase`, `ListCustomersUseCase`. |
| `src/api/{controllers,middlewares,routes}/**` | presentation | Express controller, error middleware, routers. |
| `src/infra/**` | infrastructure | `repositories/LocalCustomerRepository` and `injections.ts` (builds the use cases with the repository). |
| `src/api/server.ts` | main | package.json `main` and the `dev` entry: Express app, routes, `listen`. |
| `src/helpers/**` | unmapped | `functions.ts`, environment helper (cross-cutting). |
| `src/__tests__/**` | unmapped | Unit and integration tests. |

- **Style choice:** README subtitle: "A NodeJS API boilerplate using Clean Architecture."
- **Judgement:** `infra/injections.ts` is the project's only DI wiring. It stays in infrastructure, its folder's layer, following wave 2's rule for per-folder `di.ts` files.
- **Judgement (predictable finding):** `CustomerController` imports `CreateCustomerInjected`/`ListCustomersInjected` from `infra/injections`. Presentation importing infrastructure is an expected FF-S01 finding. Mapping `injections.ts` to main would only rename it to presentation -> main, which is also outward.
- **Note:** the use cases and the error middleware import `../domain/exceptions/...`, but the folder is `src/domain/Exceptions/`. On a case-sensitive file system these 4 imports are predictably unresolved.

### cartaxo-ts-boilerplate (leonardocartaxo/nodejs-ts-boilerplate)

| Folder | Layer | Reason |
|---|---|---|
| `src/microservices/*/entities/**`, `src/utils/base/entities/**` | domain | `User` entity; `BaseEntity`. |
| `src/microservices/*/services/**`, `src/microservices/*/dtos/**`, `src/utils/base/services/**` | application | `UsersService`, user DTOs and mappers; `BaseService`. |
| `src/microservices/*/controllers/**`, `src/utils/base/controllers/**` | presentation | `UsersController` (rest); `BaseController`. |
| `src/microservices/*/repositories/**`, `src/microservices/*/models/**`, `src/utils/base/repositories/**` | infrastructure | `UsersRepository` (Mongo), Typegoose `UserModel`; `BaseRepository`, `MongoBaseRepository`. |
| `src/main/**`, `src/microservices/*/index.ts` | main | AWS Lambda handlers and utils, Express placeholder; `UsersMicroservice` builds repository, service and controller and validates requests. |
| `src/utils/{dtos,helpers}/**`, `src/utils/*.ts` | unmapped | API request/response transport types, pagination and DB helpers, app config, error handlers, request validator (cross-cutting). |

- **Style choice:** README: "implements DDD, SOLID, clean architecture..." and "encapsulate project busisness and hook it to any entrypoint". The claim is brief, and there are no ring folders. The mapping is by role folder inside each microservice.
- **Judgement:** `src/utils/base/<role>/` holds one base class per role, each extended only by that role. Each is mapped with its role, not left unmapped as cross-cutting. `BaseRepository` is an abstract interface, but it lives in the repositories folder with the Mongo implementation and goes to infrastructure with it.
- **Judgement (predictable findings):** `UsersService` imports the concrete `UsersRepository`, and `BaseService` imports `MongoBaseRepository`. Application importing infrastructure gives expected FF-S01 findings, and probably FF-P02 dependency-inversion findings. `UsersController` imports the `User` entity (presentation -> domain), which may trigger FF-P05 controller-no-entity.
- **Note:** `src/main/express/index.ts` is a one-line comment ("hook here express server") and will be an orphan. `utils/helpers/db-manager.ts` imports `tests/utils/...` (unmapped).

### devnica-clean-backend (devNica/NodeJSBackendAppWithCleanCode)

| Folder | Layer | Reason |
|---|---|---|
| `src/core/domain/**` | domain | `models/user`, `models/token`. |
| `src/core/application/**` | application | Use cases (`auth/`, `add-user-information`) and ports (controllers, middlewares, repositories, requests, responses, schemas, security, errors). |
| `src/interface/**` | presentation | Controllers, middlewares, generic response, request schema (`validator/auth.schema`). |
| `src/infrastructure/{db,repositories,sequelize}/**`, `src/infrastructure/express/{adapters,api,setup}/**` | infrastructure | DB config and queries, the repository implementation, Sequelize connection/models/ORM loader, Express adapters, routers and setup. |
| `src/factories/**`, `src/infrastructure/express/server.ts` | main | Factories build use cases, repositories and controllers; `server.ts` (the `dev` script entry) boots Express and Sequelize. |
| `src/common/**` | unmapped | Helpers, constants, logger, security (cross-cutting). |
| `src/types/**` | unmapped | `env.d.ts`. |

- **Style choice:** README: "nodejs backend application with clean architecture and typescript". Folders `core/{domain,application}`, `interface`, `infrastructure`, `factories`.
- **Judgement:** `server.ts` is the bootstrap and goes to main, like jamielivingstone's `server.ts` in wave 2. The other `infrastructure/` subfolders are listed explicitly so that no infrastructure glob matches `server.ts` first.
- **Judgement (predictable finding):** `express/api/routes/auth.router.ts` and `user.router.ts` import `@factories/...`. Infrastructure importing main is an expected FF-S01 finding.
- **Judgement:** `common/security/{credential,token}-security.ts` implement application ports (`CredentialEncryption`, `JwtToken`), so by role they are adapters. They stay unmapped, as their declared cross-cutting folder; this follows wave 2's felixle `shared/`. As a result, the use cases' direct imports of the concrete `@common/security/credential-security` (`user-login`, `user-register`) are not checked.
- **Note:** imports use tsconfig `baseUrl: ./src` paths (`@core/*`, `@infrastructure/*`, ...). The run uses the project's `tsconfig.json`.

## layered

The layered preset is strict: persistence, then business, then presentation, and no layer may be skipped. FF-S03 is blocking for this style. All five specs declare the three preset layers, listed bottom-up; `fitness_functions:` is the preset's, verbatim (checked with `diff`).

### q00-api-server (Q00/api_server_boilerplate)

| Folder | Layer | Reason |
|---|---|---|
| `src/model/**`, `src/database/**` | persistence | README "model": TypeORM base models and entities; `database/` is the TypeORM connection config, naming strategy and sync CLI (wave-2 shihabmridha `database.ts` precedent). |
| `src/service/**`, `src/provider/**` | business | README "service": base services extended by child services; README "Provider: This module makes OAUTH logic ... Auth Conroller use this provider". |
| `src/controller/**`, `src/middleware/**`, `src/interceptor/**`, `src/dto/**` | presentation | README "Controller" (routing-controllers); Express middlewares, the response interceptor; DTOs are class-validator request bodies used only by controllers. |
| `src/utils/**`, `src/test/**`, `src/view/**`, `src/index.ts`, `src/server.ts` | unmapped | Utilities (JWT authentication, axios client, env, routing and swagger config), tests, a static HTML page (no TS), bootstrap. |

- **Style evidence:** folder structure plus the README "code" section, which documents model, service, provider and controller in that order. The README makes no explicit layering statement, so this is a folder-structure claim, like wave-2 geekyants.
- **Judgement:** `provider/` is an axios OAuth client for Kakao. It is placed in business because the README calls it OAuth logic and only controllers use it. Putting it in persistence (as an external gateway) would also be defensible; no import from business into it exists either way.
- **Judgement:** `dto/` goes to presentation (unlike shihabmridha's, which was unmapped) because no service imports a DTO here; the DTOs import service interfaces, which is a legal downward step.
- **Expected findings, not checked:** every controller imports `../model` (entities, `Enum`), and `middleware/WriteLog.ts` imports `model/Enum`; these are presentation-to-persistence skips (FF-S03).
- **Note:** three controllers import `../dto/commentDTO` while the file is `CommentDTO.ts`. On a case-sensitive filesystem that import may not resolve and its edge may be missing.

### bymi15-express-typeorm (bymi15/express-typeorm-rest-boilerplate)

| Folder | Layer | Reason |
|---|---|---|
| `src/api/entities/**` | persistence | README: "TypeORM Entities (Database models)". |
| `src/api/services/**` | business | README: "Service layer"; the generic `CRUD` base and the entity services. |
| `src/api/routes/**`, `src/api/middlewares/**` | presentation | Express route handlers; README "Custom middlewares" (auth, role check, attach user). |
| `src/database/**` | unmapped | README: factories "generate entities with mock data", seeds "save mock data"; test-data tooling. |
| `src/config/**`, `src/loaders/**`, `src/logger/**`, `src/helpers/**`, `src/types/**`, `src/app.ts`, `src/server.ts` | unmapped | Env config, README "Loader is where the app is configured and database is loaded", winston logger, the error handler, type definitions, bootstrap. |

- **Style evidence:** README "Clear and organised structure with different layers such as entities, services, middlewares, loaders".
- **Judgement:** there is no repository folder; services receive TypeORM's `MongoRepository<T>` by injection. The persistence layer is therefore the entities only, and services importing `typeorm` is an external import, not a layer edge.
- **Expected findings, not checked:** `routes/company.ts`, `routes/jobApplication.ts`, `middlewares/attachUser.ts` and `middlewares/checkRole.ts` import entities directly; these are presentation-to-persistence skips (FF-S03).
- **Provenance:** the pin is a semantic-release-bot commit (2021-11-17) that changes only `CHANGELOG.md` and `package.json`; the preceding human commits are the same day.

### pallavi-twitter-backend (pallavi-shekhar/twitter-clone-backend)

| Folder | Layer | Reason |
|---|---|---|
| `src/database/**` | persistence | README: "database: This contains the models and repositories classes which interact with mongo database"; includes the connection in `database/index.ts`. |
| `src/controllers/**` | business | README layer "Controller": the logic between route and model; controllers call the repositories. |
| `src/routes/**`, `src/middlewares/**` | presentation | README layer "Router"; Express middlewares (API key, authentication, validator, async handler). |
| `src/core/**`, `src/types/**`, `src/config.ts`, `src/app.ts`, `src/server.ts` | unmapped | README: core "conatains the classes which is shared across the project" (ApiError, ApiResponse, JWT, authUtils); request types; config; bootstrap. |

- **Style evidence:** README "architecture layers - Router, Controller and Model", with a layer diagram.
- **Judgement:** the README's three layers are mapped one-to-one onto the preset's roles, so `controllers/` is the business layer. Mapping controllers to presentation would leave business empty and every route a skip.
- **Expected findings, not checked:** every controller imports `middlewares/asyncHandler`, which is business importing presentation (FF-S01 direction). `middlewares/apikey.ts` and `middlewares/authentication.ts` import repositories directly, presentation-to-persistence skips (FF-S03). The mapping follows the folders and was not changed to avoid these.

### firmanjs-express-template (firmanJS/express-template-typescript)

| Folder | Layer | Reason |
|---|---|---|
| `src/repository/**`, `src/db/**` | persistence | README "Repository Layer"; "repository/ folder for repository / query logic" (Postgres and Mongo); "db/ folder for database" (Sequelize/Mongoose models, connection). |
| `src/usecase/**` | business | README "Usecase Layer"; "usecase/ folder for usecase / busines logic". |
| `src/transport/**`, `src/middlewares/**` | presentation | README "Transport Layer"; "transport/ folder for transport / api, grpc or graphql" (REST handlers, routes); auth and validation middlewares. |
| `src/interface/**`, `src/config/**`, `src/lang/**`, `src/utils/**`, `src/app.ts`, `src/server.ts` | unmapped | TypeScript interfaces for every layer (repository and usecase contracts, request/response, handler, config); DB config; locale messages; utilities; bootstrap. |

- **Style evidence:** README "This project has 3 Domain layer : Repository Layer, Usecase Layer, Transport Layer". The feature list also says "clean architecture folder"; the README's layer statement is the three-tier one, so the project is in the layered quota.
- **Judgement:** `interface/` holds the contracts of all three layers and is imported by all of them; it is unmapped as shared types, so the repository and usecase interfaces are not checked.
- **Expected findings, not checked:** `transport/rest/handler/auth_handler.ts` imports `db/models/Users`, a presentation-to-persistence skip (FF-S03).
- **Note:** `config/database.ts` creates the Sequelize and Mongoose connections and is imported by the models and by the health handler; as config it is unmapped, so those edges are not checked.

### lineldcosta-rest-api (lineldcosta/typescript-node-rest-api-boilerplate)

| Folder | Layer | Reason |
|---|---|---|
| `src/core/**` | persistence | README "model": `core/status` is `StatusModel`, which runs the SQL query through slonik. |
| `src/services/**` | business | README "services": `StatusService`. |
| `src/api/**` | presentation | README "router": route tables with Express handlers and swagger docs. |
| `src/bootstrap/**`, `src/cfg/**`, `src/interfaces/**`, `src/util/**`, `src/types/**` | unmapped | Express setup and typedi registration (`bootstrap/middleware/di/*`), environment config, config interfaces, route/middleware helpers, type declarations. |

- **Style evidence:** README "uses router-services-model architecture".
- **Caveat:** the smallest project in the quota: one file per layer. The service gets the model through a typedi string token (`@Inject('statusModel')`), so there is no static import from business to persistence; only the route-to-service edge is in the graph. FF-S03 and FF-S01 have almost nothing to check.
- **Note:** `tsconfig.json` maps `@interfaces/*` and `@cfg/*`; both targets are unmapped. The run uses the project's `tsconfig.json`.

## nestjs

The preset's role order is kept: domain innermost, then infrastructure, then application, then presentation; `*.module.ts` is presentation. Project globs are added; the preset's generic directories are dropped where the project has none, and where a project has a folder with a preset name but a different role (`src/core`, `src/models`) the role wins, as the general rules say. ORM/ODM data models (TypeORM entities, Mongoose schemas and document interfaces, Typegoose models) go to domain, the preset's entity choice (wave-1 neoteric, wave-2 bank-server). Export-only `index.ts` barrels are unmapped (wave-1 vivify), with `!(index).ts` globs where a mapped folder holds one. All five specs declare the four preset layers; `fitness_functions:` is the preset's, verbatim (checked with `diff`).

### neosoft-rest-nestjs (Neosoft-Private-Limited/rest-node-nestjs)

| Folder | Layer | Reason |
|---|---|---|
| `src/feature/*/entities/**`, `**/*.entity.ts` | domain | README: "Entities belongs to that Component"; TypeORM `User` entity. |
| `src/feature/*/repository/**`, `src/core/db/typeorm.config.ts`, `src/core/middleware/*` (not `index.ts`), `src/core/logger/AppLogger.ts`, `src/core/{hashing,crypto}/**`, `src/shared/mailer/` (service and interfaces), `**/*.strategy.ts` | infrastructure | README: "Repository belongs to that Component"; TypeORM config; README core "Http Request & Response Handler, Logger"; bcrypt and node-crypto wrappers; nodemailer/pug mail service; Passport JWT strategy. |
| `src/feature/*/services/**`, `src/feature/*/dto/**`, `**/*.service.ts` | application | README: "Services belongs to that Component", "DTO ... Schema, Validation"; `core/auth/auth.service.ts`, `app.service.ts`. |
| `**/*.controller.ts`, `**/*.module.ts`, `**/*.guard.ts`, `**/*.interceptor.ts`, `src/core/module.ts` | presentation | README: controllers and modules per component, core "Guards"; `core/module.ts` is the `CoreModule` (name does not match `*.module.ts`). |
| `src/config/**`, `src/swagger/**`, `src/main.ts`, `src/core/{bootstrap,cors.config,providers,index}.ts`, `src/core/compression/**`, `src/core/{logger,middleware}/index.ts`, `src/feature/*/constants/**`, `src/shared/mailer/mailer-interfaces/index.ts`, `src/shared/mailer/email-templates/` | unmapped | README "environment configuration"; Swagger setup; bootstrap (helmet, cors, compression); the CoreModule provider list; barrels; Swagger response-message constants; a pug template (no TS). |

- **Style evidence:** README "Project Structure" table (component folders with dto, entities, repository, services, controller, module; `src/core` "All core modules"). The README names `src/components`, the code at the pin uses `src/feature`; the folders inside match the table.
- **Judgement:** the preset maps `src/core/**` to domain. Here `core` is the README's cross-cutting module folder (auth, db, logger, middleware), so that glob is dropped and its files are mapped by role.
- **Judgement:** `src/core/middleware/` holds two `NestInterceptor`s and an `ExceptionFilter` ("Request & Response Handler"). The folder goes to infrastructure as the preset's middleware/filters role; the interceptors are therefore not presentation here.
- **Judgement:** `repository/user.repository.ts` is the repository interface (`UserDbRepository ... implements UserRepository`). The preset's `repository-interface` role is domain, but the README puts it in the component's repository folder and the file matches `*.repository.ts`, so it stays infrastructure with its implementation.
- **Judgement:** the preset's `**/*.dto.ts` pattern is not used; DTOs are matched by their `dto/` folder, so `constants/api.response.dto.ts` (message constants, not a DTO) stays unmapped.
- **Expected findings, not checked:** both repository files import `CreateUserDto`/`UpdateUserDto` (infrastructure to application, FF-S01); `core/auth/jwt.strategy.ts` imports `UsersService` (FF-S01); `users.controller.ts` imports the `User` entity (FF-P05 and a layer skip); the entity imports `typeorm` (FF-P01).

### ruslanguns-nestjs-starter (ruslanguns/nestjs-starter)

| Folder | Layer | Reason |
|---|---|---|
| `src/modules/*/entities/*` (not `index.ts`), `src/common/abstracts/entities/*` (not `index.ts`), `**/*.entity.ts` | domain | TypeORM entities and the abstract base-entity mixins they extend (README "Model / Entities Abstractions"). |
| `src/common/filters/*` (not `index.ts`), `src/common/pipes/**`, `src/core/scheduler/task.service.ts`, `**/strategies/**`, `**/*.strategy.ts` | infrastructure | Preset filters/pipes folders (exception filter and its `ApiException` model, validation pipe); a heartbeat `@Cron` job (worker role); Passport local and JWT strategies. |
| `src/modules/*/services/*`, `src/modules/*/{dto,dtos}/*` (not `index.ts`), `src/common/validators/*` (not `index.ts`), `**/*.service.ts`, `**/*.dto.ts` | application | Feature services (one extends `TypeOrmCrudService`), DTOs, class-validator constraints (wave-1 vivify). |
| `src/common/interceptors/**`, `**/*.controller.ts`, `**/*.module.ts`, `**/*.guard.ts`, `**/*.interceptor.ts` | presentation | Preset interceptors folder; controllers, modules (including all of `src/core/**`), auth guards. |
| `src/config/**`, `src/common/{enums,interfaces,transformers,utils}/**`, `src/common/test/**`, every `index.ts` barrel, `src/main.ts` | unmapped | Config and constants, shared enums and types, a class-transformer helper, a random-number utility, tests, barrels, bootstrap. |

- **Style evidence:** folder structure (Nest feature modules under `src/modules`, shared `common`, wiring `core`). The README roadmap ticks "Clean architecture", but the folders are the Nest module layout, not rings, so the nestjs preset is used.
- **Judgement:** the preset's `src/core/**` -> domain is dropped: `core` holds only Nest wiring modules and the scheduler job.
- **Judgement:** `common/validators/` query the DB with `getRepository(User)`; they stay application as class-validator constraints (wave-1 vivify), so their TypeORM use is an application-level finding, not infrastructure.
- **Note:** most cross-folder imports go through export-only barrels (`'./services'`, `'../entities'`, `'../dto'`). Those barrels are unmapped by the general rule, so edges that pass through them may not be checked as layer edges.
- **Expected findings, not checked:** `strategies/jwt.strategy.ts` imports `UsersService` and `local.strategy.ts` imports `AuthService` (infrastructure to application, FF-S01); `users.controller.ts` and `app.controller.ts` import entities (FF-P05); entities import `typeorm` (FF-P01); services inject TypeORM `Repository` directly, with no repository class (FF-P03).

### surgeharb-nestjs (surgeharb/nestjs-boilerplate)

| Folder | Layer | Reason |
|---|---|---|
| `src/*/schemas/**`, `src/users/interfaces/**`, `src/posts/interfaces/**`, `src/@schemas/**`, `**/*.schema.ts` | domain | README "Mongoose ODM integrated"; Mongoose schemas, the `IUser`/`IPost` document interfaces, and the `@schemas` registry of `{name, schema}` model definitions. |
| `src/@core/services/**`, `**/*.strategy.ts`, `**/*.filter.ts` | infrastructure | `PasswordService` (node `crypto` hashing) and `ScheduleService` (nest-schedule, worker role); Passport JWT strategy; `@core/utils/exceptions.filter.ts`. |
| `src/*/dtos/**`, `src/@core/ui-components/**`, `**/*.service.ts`, `**/*.dto.ts`, `**/*.mapper.ts` | application | Feature services and DTOs; `posts.mapper.ts` and the ui-components build the response view model (dto role) and are called by `PostsService`. |
| `src/@core/decorators/**`, `src/app.routes.ts`, `**/*.controller.ts`, `**/*.module.ts`, `**/*.guard.ts`, `**/*.interceptor.ts` | presentation | Parameter decorators (`@Lang`, `@User`; wave-1 neoteric), the nest-router route table, controllers, modules. |
| `src/@core/config/**` (not `*.module.ts`), `src/auth/interfaces/**`, `src/main.ts` | unmapped | README "Environment Configuration" (`ConfigService`, translations, multer config); JWT payload type; bootstrap. |

- **Style evidence:** folder structure only (feature modules `auth`, `users`, `posts`, `upload` with controller/service/module files). The README describes setup and endpoints, not structure.
- **Judgement:** `@core/services/*.service.ts` are infrastructure (technical wrappers), not application, because the directory glob wins over `*.service.ts` (wave-2 staart, saluki).
- **Judgement:** `@schemas/index.ts` is not an export-only barrel (it builds the `USERS`/`POSTS` model tokens), so it is mapped with the schemas it registers.
- **Expected findings, not checked:** `jwt.strategy.ts` imports `AuthService` (FF-S01); services use the injected Mongoose `Model` directly, with no repository (FF-P03); `auth.service.ts` imports the unmapped `ConfigService`, which is not checked.

### innei-nest-http (innei-template/nest-http-boilerplate)

| Folder | Layer | Reason |
|---|---|---|
| `src/shared/model/**`, `**/*.model.ts` | domain | README shared/model "basic data model" (`BaseModel`); Typegoose `UserModel`, `PostModel` in the feature modules. |
| `src/processors/**` (not `*.module.ts`), `src/common/{filters,middlewares,adapt}/**`, `src/transformers/model.transformer.ts`, `**/*.strategy.ts` | infrastructure | README processors "core helper modules": Redis cache, Mongo database, gateway, helper (axios), logger; README common filters, middlewares and adapters (the Fastify adapter); the Typegoose model-provider factory and `InjectModel`; Passport JWT strategy. |
| `src/shared/dto/**`, `**/*.service.ts`, `**/*.dto.ts` | application | README shared/dto "data validation models"; feature services and DTOs. |
| `src/common/{decorator,guard,interceptors}/**`, `**/*.controller.ts`, `**/*.module.ts`, `**/*.guard.ts`, `**/*.interceptor.ts` | presentation | README "business decorators", "guards and auth", "interceptors, data filtering and response formatting"; controllers, modules. |
| `src/constants/**`, `src/global/**`, `src/utils/**`, `src/shared/interface/**`, `src/common/exceptions/**`, `src/transformers/{get-req,paginate}.transformer.ts`, `src/app.config.ts`, `src/bootstrap.ts`, `src/main.ts` | unmapped | README "constants", "utility classes", "configuration", "bootstrap", "entry"; global registrations (consola, dayjs, env); shared paginator type; the `BizException`; request-context and pagination helpers. |

- **Style evidence:** README "File Structure" tree: `modules` = "business logic modules", `processors`, `common`, `shared`, with Nest controller/service/module files per feature.
- **Judgement:** `src/transformers/` is split: `model.transformer.ts` is persistence glue (Typegoose providers, `InjectModel`), the other two are request and pagination helpers and stay unmapped.
- **Note:** the README lists `common/adapters` and `common/pipes`; the code has `common/adapt` and no pipes. `processors/gateway` and `common/middlewares` hold only `.gitkeep`.
- **Note:** FF-P01's forbidden list (typeorm, express, prisma, sequelize) does not name Typegoose or Mongoose, so domain-purity checks see no forbidden import in these models.
- **Expected findings, not checked:** `common/interceptors/cache.interceptor.ts` imports `CacheService` (presentation to infrastructure, FF-S03); `filters/any-exception.filter.ts` imports `LoggingInterceptor` and `jwt.strategy.ts` imports `__secret` from `auth.module.ts` and `AuthService` (infrastructure to presentation/application, FF-S01).

### tannergabriel-nest-graphql (TannerGabriel/nestjs-graphql-boilerplate)

| Folder | Layer | Reason |
|---|---|---|
| `src/types/user.ts`, `**/*.schema.ts` | domain | The Mongoose `User` document interface and `user.schema.ts` (README "MongoDB"). |
| `src/filters/**`, `**/strategy/**`, `**/*.strategy.ts` | infrastructure | GraphQL exception filter (preset filters role); Passport JWT strategy (project folder `strategy/`). |
| `src/models/**`, `src/user/dto/**`, `**/*.service.ts`, `**/*.input.ts` | application | `models/*.type.ts` are GraphQL `@ObjectType` output types; `*.input.ts` are GraphQL input DTOs (wave-2 saluki `*.input.ts`); services. |
| `src/guards/**`, `src/interceptors/**`, `src/decorators/**`, `src/scalars/**`, `**/*.resolver.ts`, `**/*.module.ts`, `**/*.guard.ts`, `**/*.interceptor.ts` | presentation | README "Securing a specific route" with `GraphqlAuthGuard`/roles guard; resolvers (the GraphQL controllers), the `Email` scalar and parameter decorators (wave-1 neoteric). |
| `src/shared/**`, `src/types/payload.ts`, `src/main.ts` | unmapped | The `UserRoles` enum, the JWT payload type, bootstrap. `src/user/user.graphql` is not TypeScript. |

- **Style evidence:** folder structure only (feature modules `auth`, `user` with resolver/service/module files); the README lists features, mutations and queries.
- **Judgement:** the preset's `src/models/** -> domain` is replaced: these are GraphQL output types, a dto role (wave-1 zeldaplay mapped its GraphQL `models/` to application the same way).
- **Judgement:** `*.controller.ts` is replaced by `*.resolver.ts` (there are no REST controllers); the role is kept as `controller`.
- **Expected findings, not checked:** `strategy/jwt.strategy.ts` imports `AuthService` (FF-S01); both resolvers import `types/user` (presentation to domain, FF-P05 and a layer skip); `user.service.ts` uses the injected Mongoose `Model` directly (FF-P03).

## hexagonal

`allowed_dependencies` is the preset's: application to domain; inbound and outbound adapters to application and domain; config to everything. Two projects (twiddlle, canario) have no style text in a README; their claim is the repository name or description plus the folder structure, and is recorded as weak.

### nalhin-movies (Nalhin/Movies)

Analysis root `backend/`; globs are relative to it.

| Folder | Layer | Reason |
|---|---|---|
| `src/{movie,user}/domain/**` | domain | README: "domain (domain objects)": `model` (command models with business rules) and `read-model`. |
| `src/{movie,user}/application/**` | application | README: "application (application services and input/output ports interfaces)": `port/in` (use cases), `port/out`, `service/{command,query}`. |
| `src/{movie,user}/adapter/in/**` | adapters-inbound | README: "adapter ... input ... web (dto, controllers)"; also `user/adapter/in/auth` (Passport JWT strategy). |
| `src/{movie,user}/adapter/out/**` | adapters-outbound | README: "output: movie-data, persistance, plot-details, question-answering, data-aggregators"; also `user/adapter/out/token`. The adapters' own Nest modules stay in the folder. |
| `src/main.ts`, `src/app.module.ts`, `src/{movie,user}/{movie,user}.module.ts` | config | Bootstrap and the context modules that bind port tokens to services and adapters. |
| `src/common/**` | unmapped | Not named by the README. Guards, decorators, filter, interceptor, the `AppUser` model, the `SelfValidating` base class: cross-cutting. |
| `src/core/**` | unmapped | Not named by the README. `core/config` (config factories) and `core/http-cache` (cached axios service used by two outbound adapters' modules). |
| `src/global.d.ts` | unmapped | Type declarations. |
| `test/**`, `../client/**` | unmapped | Outside `src/`; e2e tests and the React client. |

- **Style claim:** README: "Nest.js hexagonal architecture implementation based on 'Get Your Hands Dirty on Clean Architecture' by Tom Hombergs" and "designed following the concepts of 'Clean Architecture' and hexagonal architecture".
- **Judgement:** `common/` is left unmapped like wave 2's felixle `shared/`. So the application ports' `extends SelfValidating` import from `common/self-validating` and the controllers' guard and decorator imports are not checked.
- **Judgement:** `core/http-cache` could be read as an outbound helper. The README does not place it, so it stays unmapped with the rest of `core/`.
- **Note:** `movie/adapter/out/persistance/movie-favourite-by-user.entity.ts` imports `user/adapter/out/persistance/database/user.entity`. Both files are adapters-outbound, so no layer rule sees this edge. The README calls the contexts "entirely independent". The edge crosses a context boundary but not a layer.
- **Note:** one import uses the `baseUrl` path `src/movie/domain/...`. The run uses `backend/tsconfig.json`.

### hexagonal-banking (auxdevelopment/hexagonal-banking-ts)

| Folder | Layer | Reason |
|---|---|---|
| `src/core/domain/**` | domain | README: "all domain objects (aggregates, entities, values, ...)"; also repository ports and `account-service.adapter.ts`. |
| `src/core/use-case/**` | application | README: "primary ports for all use cases". |
| `src/infrastructure/rest-api/controller/**`, `src/infrastructure/rest-api/controller.ts` | adapters-inbound | README: "everything related to the exposed REST API"; the account controller, resources, and the `Controller` interface. |
| `src/infrastructure/repository/**`, `src/infrastructure/knex/**` | adapters-outbound | README: "infrastructure related adapters (e.g. PostgresAccountRepository)"; the in-memory and Postgres repositories, row mapper, and the Knex connection (`schema.sql` is not TS). |
| `src/infrastructure/rest-api/server.ts`, `src/main.ts` | config | Express server bootstrap (as in wave 2's hexapinod `server.ts`); manual wiring of repository, service and controller. |

- **Style claim:** README: "This is a sample application aiming to showcase an example implementation of hexagonal architecture using TypeScript."
- **Judgement:** `core/domain/account/account-service.adapter.ts` calls itself "an application service that implements the account use cases". It lives in the folder the README calls domain, so it stays in domain. Its imports of the four `core/use-case` ports are domain-to-application edges. Expect direction and core-isolation findings.
- **Judgement:** `core/domain/account/account.aggregate.ts` imports `OpenAccountCommand` from `core/use-case/account/open-account.port`. This is a further domain-to-application finding.
- **Note:** the README marks the project "(WIP)".

### dsteles-nodejs-hexagonal (david-ds-teles/nodejs_hexagonal)

| Folder | Layer | Reason |
|---|---|---|
| `src/account/core/entities/**` | domain | `Account` entity. |
| `src/account/core/services/**` | application | `AccountService` (the use cases that the API and the CLI both call) and the `IAccountService` primary port. |
| `src/account/repository/**` | application | `IAccountRepository`, a secondary port (interface only) that `AccountService` depends on. |
| `src/account/cmd/**` | adapters-inbound | CLI command adapter (`AccountCmd`, `ICommand`). |
| `src/frameworks/api/**`, `src/frameworks/cli.ts` | adapters-inbound | Express and Fastify servers and routers; the CLI runner. |
| `src/frameworks/db/**`, `src/frameworks/i18n.message.ts` | adapters-outbound | MongoDB and MySQL drivers and repositories; the i18n implementation of the `IMessage` port. |
| `src/app.ts`, `src/app.cli.ts` | config | Entries that choose the DB and the API provider from env vars and start them. |
| `src/commons/**` | unmapped | `IApi`, `IDBDriver`, `IMessage`, `IApiReqRes`, `errors`: a shared kernel of interfaces and errors used by the core, the adapters and the entries. |
| `@types/**`, `__tests__/**`, `locales/**`, `scripts/**` | unmapped | Outside `src/`. |

- **Style claim:** README: "This project is a simple example of how implement an hexagonal architecture with NodeJS"; "2 api provider (express and fastify), to show how you can plug and unplug anything to our applicatio ports". The README describes no folders, so the mapping comes from folder and file names.
- **Judgement:** `account/repository` sits outside `core/` but holds only the port interface. Ports go in domain or application under the preset, so it is application, next to the service that uses it.
- **Judgement:** `commons/` is left unmapped as a shared kernel (wave 2's remix-hexagonal `src/shared/*`). So the core's imports of `commons/imessage` and `commons/errors` are not checked.
- **Known consequence:** `frameworks/api/{express,fastify}/*.api.ts` and `frameworks/cli.ts` import `frameworks/i18n.message`, which makes these inbound-to-outbound edges. Expect layer-skip findings (FF-S03). The routers also build `AccountService` themselves (inbound to application, allowed).

### twiddlle-nest-hexagonal (Twiddlle/nestjs-hexagonal-architecture-demo)

| Folder | Layer | Reason |
|---|---|---|
| `src/modules/{article,user}/domain/**` | domain | Entities, aggregates, `ports/*-repository.interface`, events, commands, queries, exceptions, and the domain services. |
| `src/modules/{article,user}/application/{query,event}/**` | application | CQRS query handlers and the event handler. |
| `src/modules/article/application/presenter/**` | adapters-inbound | REST controller, GraphQL resolver, and their DTOs. |
| `src/modules/app/application/filters/**` | adapters-inbound | HTTP exception filter (domain exceptions mapped to HTTP). |
| `src/common/application/**` | adapters-inbound | `ValidationIntPipe` and `EntityPresenterMapper`, used only by the presenters. |
| `src/modules/{article,user}/infrastructure/**`, `src/common/infrastructure/**` | adapters-outbound | TypeORM repositories and ORM entities, the event dispatcher, the TypeORM base repository, the entity-manager provider and ORM mapper. |
| `src/modules/{article,user}/*.module.ts`, `src/modules/app/application/app.module.ts`, `src/modules/config/application/app-config.module.ts`, `src/app.ts`, `src/main.ts` | config | Nest modules and bootstrap. |
| `src/config/**`, `src/modules/app/infrastructure/**` | unmapped | Env and TypeORM config objects, migration CLI config. |
| `src/migrations/**` | unmapped | Generated DB migrations. |

- **Style claim (weak, structure-only):** `README.md` is empty (0 bytes) at the pin. The claim is the repository name and description, "Hexagonal architecture demo project using nestjs framework", plus the folders `domain/ports`, `application` and `infrastructure`.
- **Judgement:** layer names follow roles, not folder names. The project's `application/presenter` holds controllers and resolvers, so it is adapters-inbound. Only the query and event handlers are application.
- **Judgement:** the domain services (`domain/service/*.service.ts`) work as the use cases the presenters call, and they depend on domain ports. They are in the domain folder, so they stay domain.
- **Known consequence:** `article/application/query/get-article-counts-by-user-id.query-handler.ts` imports `article/infrastructure/persistence/article.repository`, and `user/application/query/get-user-by-id.query-handler.ts` imports `user/infrastructure/persistence/user-repository`. These concrete repositories are application-to-outbound edges. Expect direction findings and port-dependency-inversion findings.
- **Note:** `src/config/db/database.config.ts` imports the ORM entities from two infrastructure folders. It is unmapped, so this is not checked.
- **Note:** `src/modules/app/infrastructure` holds config only, so the outbound globs name the `article` and `user` modules explicitly rather than `src/modules/*/infrastructure/**`.

### canario-hexagonal-express (Canario0/hexagonal-express)

| Folder | Layer | Reason |
|---|---|---|
| `src/contexts/**/domain/**` | domain | Cart aggregate and events, value objects, read views and repository ports, event-store port; `contexts/shared/domain` (aggregate root, command/query/event bus interfaces, logger port, value objects). |
| `src/contexts/**/application/**` | application | Read and write command and query handlers, event subscribers (`*On*`), `mailerMs/mail/application/send`. |
| `src/apps/*/back/controllers/**`, `src/apps/*/back/routes/**` | adapters-inbound | Express controllers and routes. |
| `src/contexts/**/infrastructure/**` | adapters-outbound | TypeORM repositories, event store and entities, in-memory command and query buses, RabbitMQ event bus, consumers and config, Winston logger. |
| `src/apps/*/back/dependencyInjection/**`, `src/apps/*/back/command/**`, `src/apps/*/back/{*BackendApp,server,start}.ts` | config | DI container (`index.ts` plus YAML service definitions), the one-off RabbitMQ setup command, app, server and start files. |
| `src/tests/**` | unmapped | Jest tests and mocks. |

- **Style claim (weak, structure-only):** there is no README at the pin. The claim is the GitHub description, "Express service using hexagonal architecture.", plus the Codely `apps/` + `contexts/<ms>/<module>/{application,domain,infrastructure}` layout (as in wave 2's quiz4devs-backend).
- **Judgement:** `contexts/shared/infrastructure/eventBus/rabbitMQ/rabbitMqConsumers.ts` is by role a driving (message-consumer) adapter. It sits in `infrastructure/`, so it stays adapters-outbound by folder, as in wave 2's quiz4devs.
- **Known consequence:** `apps/cart/back/routes/carts.ts` imports `../dependencyInjection` (the container). This is an inbound-to-config edge against the `config` edge. Expect a direction finding.
- **Note:** the controllers import only application commands, queries and responses, and domain errors and bus interfaces. No inbound-to-outbound edge was seen in the imports.

## ddd

`allowed_dependencies` and everything from `fitness_functions:` on are the preset's (tail appended with `sed`, checked with `diff` for all five). Contexts are declared from top-level modules or from the README's named bounded contexts. Aggregates come from the source tree (`grep 'class X extends'`, `*-aggregate` folder names, README), which reads the source and is not the tool. Globs are relative to each project's analysis root. Spec files (`*.spec.ts`) are not listed in the tables.

### meetinger (Arvinje/meetinger)

Analysis root `backend/`. Style evidence, README: "built with TypeScript to showcase Domain-Driven Design (DDD), Clean Architecture & SOLID"; "highly influenced by the articles and the SOLID book by Khalil Stemmler".

| Folder | Layer | Reason |
|---|---|---|
| `src/modules/*/domain/**` (incl. `meetings/domain/events/`) | domain | Aggregates, value objects, entities, domain events. |
| `src/modules/*/errors/**` | domain | Domain errors (`MeetingErrors`, `AttendeeErrors`), imported by `Meeting.ts`. |
| `src/modules/*/repos/*Repo.ts` | domain | Repository interfaces; they import only domain files (role `repository-interface`). |
| `src/shared/domain/**` | domain | AggregateRoot, Entity, ValueObject, DomainEvent, EventPublisher, WatchedList, ids. Shared kernel, outside every context. |
| `src/modules/*/usecase/*/*{UseCase,Request,Response}.ts` | application | Use cases and their input/output types. |
| `src/modules/*/{dtos,integrationEvents,emails,listeners}/**` | application | DTOs, integration-event types, the email payload type, domain-event listeners that publish integration events through the `MessageBroker` interface. |
| `src/modules/*/repos/implementations/**` | infrastructure | DynamoDB repositories. |
| `src/modules/*/mappers/**` | infrastructure | `dynamoToDomain`/`toDynamoFull` on aws-sdk `AttributeMap`, plus `toDTO`. |
| `src/shared/infra/{brokers,dynamodb,emailService,queues}/**` | infrastructure | SNS, DynamoDB config, SES, SQS, with their interfaces. Outside every context. |
| `src/modules/*/usecase/*/*Controller.ts`, `src/shared/infra/http/**` | api | Lambda controllers, `BaseController`, API Gateway handler types. |
| `src/modules/*/usecase/*/index.ts` | composition | Each is a Lambda `handler` that builds the broker, repo, use case, subscriptions and controller. |
| `src/shared/core/**` | unmapped | `AppError`, `BaseError`, the `UseCase` interface: cross-cutting, imported by every layer. |

- **Contexts:** `connection`, `meetings`, `users` under source root `src/modules/`; `src/shared/**` is outside. Public API: `meetings/integrationEvents/**` (the folder name says it is the published contract; it is consumed only by `shared/infra/brokers`). `connection` and `users` declare none.
- **Judgement:** repository interfaces sit in `repos/`, not `domain/`. They are mapped to domain, following the preset's `repository-interface` role. They import only domain files, so this causes no finding either way.
- **Judgement:** `mappers/` mix persistence and DTO mapping and import aws-sdk types, so they are infrastructure. `GetMeeting`, `ListMeetings` and `ListRegisteredMeetings` use cases call `*Map.toDTO`, so **application to infrastructure (FF-S01) findings are expected**.
- **Judgement:** the broker, email and queue interfaces live in `shared/infra/*` next to their implementations and stay infrastructure (wave-2 nutes `infrastructure/port`). `EmailSenderUseCase`, `EmailJoinedAttendeeUseCase` and the four listeners import them, and `EmailSenderController` imports `EmailMessage`. If the layering rules cover imports into files outside a context, these are FF-S01 findings.
- **Expected FF-DS02:** `meetings` imports `users/domain` (`UserName`, `UserFullName`, `UserEmail`, `User`) from its domain, mappers, repos and use cases, and `users/repos` (`UserRepo`, `DynamoDBUserRepo`) from use cases and `index.ts`. `users` publishes no API, so these are cross-context findings.
- **Aggregates:** `Meeting` and `Attendee` (both `extends AggregateRoot`, flat `meetings/domain/`, so they share the module glob as in wave-2 camps) and `User`. No inner entities.
- **Note:** `connection/domain/connection.ts` is a plain class with its own repository, and no `AggregateRoot` base. It is not declared an aggregate, so FF-DT02 may report `ConnectionRepo`. `MeetingID` extends `Entity<void>` and is not declared a value object.
- **Other declarations:** value objects are the 15 classes that extend `ValueObject` plus the base class; repositories `repos/*Repo.ts` and `repos/implementations/*Repo.ts`; event type `DomainEvent`; application services `usecase/*/*UseCase.ts`.
- **Note:** imports use the tsconfig aliases `@src/*`, `@meetings/*`, `@users/*`, `@connection/*` (baseUrl `backend/`).

### ddd-libellis (libellis/DDD-Libellis)

Analysis root `application/`. Style evidence, README: "There are currently two bounded contexts: Election System, and User Management"; "Core Domain ... represented by the election system bounded context"; the Master Ballot and Election aggregates are described and drawn.

| Folder | Layer | Reason |
|---|---|---|
| `src/*/core/domain/**` | domain | `model/*-aggregate`, `model/common/value-objects`, `model/events`. |
| `src/shared-kernel/*.ts`, `src/shared-kernel/{event-streams,exceptions,interfaces,value-objects}/**` | domain | Entity, ValueObject, Guard, `IDomainEvent`, `IClonable`, `DateTimeRange`, the rxjs `EventBus` the aggregates publish to. Shared kernel (preset convention), outside every context. |
| `src/*/core/application/**` | application | Services, repository interfaces (`abstractions/`), input/output models. |
| `src/shared-kernel/{services,models}/**` | application | `PayloadService` (jsonwebtoken, config) and the `Payload` type, used only by the application services. |
| `src/*/infrastructure/**` | infrastructure | `IPSQLPool`, `SQLRepositoryBase`, `SQLMasterBallotRepository`. |
| `src/*/api/**` (none) | api | README: "For now there is no web api layer". Preset convention glob; matches nothing. |
| `src/index.ts` | composition | Package entry point; empty file at the pin. |
| `src/*/tests/**`, `src/shared-kernel/test-factories/**` | unmapped | Test factories and mock repositories. |
| `src/config.ts`, `src/shared-kernel/configs/**` | unmapped | dotenv config; `automapper-config.ts` is empty. |

- **Contexts:** `election-system` and `user-management` under `src/`; public API none declared (no barrel or contracts folder, and no cross-context import exists at the pin). Outside: `src/shared-kernel/**`, `src/index.ts`, `src/config.ts`.
- **Judgement:** the shared kernel is domain by the preset's convention, but `services/` and `models/` hold JWT token handling used only by the application services, so they are application. The rest stays domain.
- **Judgement:** repository interfaces live in `core/application/abstractions/` and stay application, where the author put them.
- **Aggregates:** `Ballot` (inner `Vote`), `Election` (inner `Teller`, README: "under the direct control of the Election aggregate root"), `MasterBallot` (inner `Question`, `Choice`), `Voter`, `User`. Taken from the `*-aggregate` folders; every class extends `Entity` (no AggregateRoot base exists).
- **Expected FF-DT01:** `Election.model.ts` imports `ballot-aggregate/abstractions/IBallotData`, a non-root file of the Ballot module. Its imports of the `Ballot` and `MasterBallot` roots, and `Teller`'s import of `Ballot`, are root imports.
- **Note:** `shared-kernel/event-streams/EventBus.ts` imports the event classes of both contexts (`BallotCastEvent`, `UserCreatedEvent`, `UserUpdatedEvent`). It is outside every context. This is a finding only if FF-DS02 checks sources outside contexts.
- **Note:** the api layer matches no file, so `firewall validate` should report one `LAYER_DIR_NOT_FOUND` (staart-api precedent). This is left unchanged.
- **Note:** compiled `.js` and `.js.map` files are committed next to many `.ts` sources under `src/`. The globs would also match them if the extractor reads `.js`.
- **Other declarations:** value objects `core/domain/model/**/value-objects/*.model.ts` and `shared-kernel/value-objects/*.model.ts`. Repositories `abstractions/I?*Repository.ts` (leaves out the generic `IRepository`) and `SQL*Repository.model.ts`. `SQLMasterBallotRepository` is wholly commented out at the pin, so that glob matches a file with no code. Event type `IDomainEvent`; application services `core/application/*.service.ts`.

### miczeq-nodejs-ddd (Miczeq22/nodejs-ddd-example)

Style evidence, README: "This project shows a simple example how to write Tactical Domain Driven Design in Node.js". At the pin (commit "Platform Registration aggregate") only the domain is written.

| Folder | Layer | Reason |
|---|---|---|
| `src/core/**` | domain | `identity/platform-registration` (aggregate, repository interface, rules), `identity/shared-kernel` (value objects, domain-service interfaces), `errors/`. |
| `src/app/**` (none) | application | tsconfig alias `@app`; the folder does not exist yet. |
| `src/infrastructure/**` | infrastructure | winston logger. |
| `src/api/**` (none) | api | tsconfig alias `@api`; the folder does not exist yet. |
| `src/index.ts` | composition | Entry point (`console.log('Hello World')`). |
| `src/tools/**` | unmapped | `building-blocks` (AggregateRoot, Entity, ValueObject, DomainEvent, in-memory command/query buses, event dispatcher) is a framework library used by every layer, like wave-2 talyssonoc `_lib`. `mock-proxy.ts` is a test helper. |

- **Contexts:** `identity` under source root `src/core/`; `src/core/errors/**` is outside. Public API none (single context, so FF-DS02 cannot fire).
- **Judgement:** the tsconfig `paths` (`@app`, `@infrastructure`, `@api`, `@core`, `@tools`) are the project's own folder names, so they set the layer globs. Application and api match nothing, so `firewall validate` should report two `LAYER_DIR_NOT_FOUND`. They are left unchanged.
- **Judgement:** leaving `tools/building-blocks` unmapped means the base classes, and the buses' imports of `@infrastructure/logger`, are not checked.
- **Aggregates:** `PlatformRegistration` (`extends AggregateRoot`), no inner entities.
- **Empty declarations:** no application service exists. `application_services` is the `@app` folder (`src/app/**/*.ts`) and matches nothing, so FF-DT06 checks nothing. `DomainEvent` (`tools/building-blocks/domain-event.ts`) exists but no event implements it at the pin, so FF-DT05 has nothing to check.
- **Other declarations:** value objects `*.value-object.ts` (`AccountEmail`, `AccountPassword`); repositories `*.repository.ts` (the `PlatformRegistrationRepository` interface).
- **Note:** findings are expected to be near zero: the code base is a domain model only.

### dlydiard-ddd-cqrs-es (dlydiard/ddd-cqrs-es-aws-sam)

Style evidence, README: "Comprehensive Domain Driven Design, CQRS, and Event Sourcing example"; "this project uses Identity and Access Management (IAM) as an example Bounded Context. The Aggregate Roots for the IAM Bounded Context are User and Role."

| Folder | Layer | Reason |
|---|---|---|
| `src/iam/*/models/**` | domain | Aggregate roots and their class-validator validators. |
| `src/iam/*/events/` (event files and `*-events.ts`) | domain | Domain events (`extends Event`) and event-name constants. |
| `src/event-store/events/event.ts` | domain | Base `Event` class of every domain event. |
| `src/app/validation/**` | domain | `DomainValidator`, base of the aggregate validators (README "Validation": "Aggregate Roots actions are validated with domain specific logic"). |
| `src/iam/*/{commands,services}/**`, `src/iam/*/events/*.enricher.ts` | application | Commands, command handlers, services (set validation, publishing), event enrichers (README "Event Enrichment"). |
| `src/app/service/**`, `src/app/repository/*.interface.ts`, `src/event-store/**/*.interface.ts` | application | Service, repository, publisher, projection-repository, event-handler and enricher interfaces (ports). |
| `src/iam/*/events/*.handler.ts`, `src/iam/*/projections/**` | infrastructure | Projection event handlers and read models (wave-2 mustodon judgement). |
| `src/app/repository/dynamo*.ts`, `src/event-store/{publisher,projections,handler}/` (non-interface files) | infrastructure | DynamoDB repositories, the event publisher, projection base and repository, handler registry. |
| `src/iam/*/{controllers,dtos}/**`, `src/app/application.controller.ts`, `src/app/dto/**` | api | API Gateway Lambda controllers (template.yaml `CodeUri: src/iam/*/controllers`), DTOs, base controller. |
| `src/event-store/brokers/**`, `src/event-store/dynamo-kinesis-adaptor.ts` | api | Stream and queue Lambda entry points (README "DynamoDB / Kinesis Adaptor", "Lambda Event Broker"): driving adapters. |
| `src/app/application-container.ts` | composition | README: "All classes marked injectable() must be registered in application-container.ts". |
| `src/app/application-error.ts` | unmapped | Cross-cutting error, imported by services, projections and the publisher. |

- **Contexts:** one, `iam` (README), root `src/iam/`; `src/app/**` and `src/event-store/**` are outside. Public API none (single context, so FF-DS02 cannot fire).
- **Judgement:** `app/` and `event-store/` mix ports, adapters and entry points, so they are split by role. `*.interface.ts` go to application, the Dynamo and Lambda files to infrastructure and api. Extglobs (`!(*.handler|*.enricher).ts`, `!(*.interface).ts`) keep the file patterns from overlapping.
- **Aggregates:** `User` and `Role` (README; both `extends AggregateRoot` from `@node-ts/ddd`). Module = the aggregate's `models/` folder, no inner entities.
- **Expected FF-DT04:** the domain imports `class-validator` (`models/*.validator.ts`, `app/validation/domain-validator.ts`), which is on the preset's forbidden list, and the README presents this as the design. `user.ts` also imports `aws-sdk/clients/workmail`, which is not on the list.
- **Expected FF-DT01:** `role/models/role.ts` imports `user/models/user.validator`, a non-root file of the User module.
- **Expected FF-S01:** the services import `dynamo-set-validation.repository` and `dynamo-event-publisher` (application to infrastructure). The controllers import `dynamo-projection.repository` and the projections (api to infrastructure). The controllers, brokers and adaptor import `application-container` (api to composition).
- **Empty declarations:** no value-object file exists. `value_objects` is the preset's convention (`src/**/value-objects/**`) and matches nothing, so FF-DT03 checks nothing.
- **Note:** repositories are `app/repository/*.ts` and `event-store/projections/repository/*.ts`. There is no aggregate repository (event sourced). The projection and set-validation repositories store read models and constraints, so FF-DT02 may report them.
- **Other declarations:** event type `Event`; application services `services/*.service.ts` and `commands/*.handler.ts`.

### lucashang-ddd-payday (LucasHang/ddd-payday)

Style evidence, README: "Api de aplicação bancária aplicando clean architecture e DDD". Folder structure: Stemmler-style `modules/{accounts,users}/{domain,dtos,mappers,repositories,useCases,infra/http}` with `core/` and `shared/`.

| Folder | Layer | Reason |
|---|---|---|
| `src/modules/*/domain/` (non-barrel files) | domain | Entities `Account`, `User` and their value objects. |
| `src/modules/*/repositories/I*Repository.ts` | domain | Repository interfaces (role `repository-interface`). |
| `src/core/domain/**` | domain | Entity, ValueObject, Identifier, UniqueEntityID, the `UseCase` interface. Outside every context. |
| `src/modules/*/useCases/*/*{UseCase,DTO,DTOValidation}.ts`, `src/modules/*/dtos/**` | application | Use cases, request DTOs, the per-use-case validation rules, response DTOs. |
| `src/shared/validators/IValidator.ts` | application | Validator port injected into use cases. |
| `src/modules/*/repositories/implementations/**` | infrastructure | Fake (in-memory) repositories. |
| `src/modules/*/mappers/**` | infrastructure | Map domain to the persistence interfaces in `infra/database/entities` and to DTOs. |
| `src/infra/database/**`, `src/core/infra/BaseFakeRepository.ts`, `src/shared/infra/**`, `src/shared/validators/implementations/**` | infrastructure | TypeORM connection, entities, migration, persistence interfaces, enums, the fake-repo base, the validator implementation. |
| `src/modules/*/useCases/*/*Controller.ts`, `src/modules/*/infra/http/**`, `src/infra/http/{api/**,app.ts}`, `src/core/infra/BaseController.ts` | api | Controllers, module routes, the v1 router, the Express app, the base controller. |
| `src/modules/*/useCases/*/index.ts`, `src/infra/http/server.ts`, `src/index.ts` | composition | Per-use-case wiring, server start, entry point. |
| `src/modules/*/domain/index.ts` | unmapped | Export-only barrels. |
| `src/core/logic/**`, `src/shared/utils/**` | unmapped | Result, Guard, errors, types: cross-cutting. `src/shared/README.txt` says only "Just to keep it still". |
| `src/core/tests/**`, `src/modules/*/domain/tests/**` | unmapped | Specs. |

- **Contexts:** `accounts` and `users` under `src/modules/`. Public API none. Outside: `src/core/**`, `src/shared/**`, `src/infra/**`, `src/index.ts`.
- **Expected FF-DS02:** `users/useCases/createUser/CreateUserUseCase.ts` imports `accounts/useCases/createAccount/CreateAccountUseCase`, and its `index.ts` imports `accounts/useCases/createAccount`. `accounts/useCases/createAccount/CreateAccountUseCase.ts` imports `users/repositories/IUserRepository`, and its `index.ts` imports `users/.../fakeUserRepository`.
- **Expected FF-S01:** all four use cases import their module's mapper (application to infrastructure), and `Deposit`/`WithdrawDTOValidation` import `shared/validators/implementations/MyDtoValidator`.
- **Judgement:** the domain barrels are unmapped (general rule). Use cases that import `@modules/*/domain` through the barrel therefore have that edge go to an unmapped file.
- **Aggregates:** no class extends an AggregateRoot base (`core/domain` has only `Entity`). `Account` and `User` are the entities with their own repository, so they are the declared roots (wave-2 camps judgement). No inner entities.
- **Empty declarations:** no domain-event type exists. `domain_event_types` is the preset's `DomainEvent` and matches nothing, so FF-DT05 checks nothing.
- **Other declarations:** value objects are the four classes that extend `ValueObject` (`accountBalance`, `userAge`, `userEmail`, `userPassword`); repositories `I*Repository.ts` and `implementations/**/*Repository.ts`; application services `useCases/*/*UseCase.ts`.
- **Note:** imports use the tsconfig aliases `@core`, `@infra`, `@modules`, `@shared` (baseUrl `src/`).

## Addendum: after `firewall validate`, before any evaluation (second commit)

`firewall validate` was run on all 25 specs after the first commit (`validate/<id>.txt`). 23 are valid with 0 errors. Two report `LAYER_DIR_NOT_FOUND` exactly as the ddd section predicted, and are kept unchanged (wave 2's staart-api precedent): `ddd-libellis` layer `api` (the README says there is no web API layer yet) and `miczeq-nodejs-ddd` layers `application` and `api` (globs named after the tsconfig path aliases; no such folder exists at the pin). These layers carry no file, so the rules that read them check nothing on those projects. No spec changed.
