# 2. Writing a spec

A spec is a YAML file with three parts:

- `architecture`: the style and the layers. Each layer is a name plus the folders (globs) that belong to it.
- `fitness_functions`: the rules. Each has an id (`FF-S01`), a template name (`dependency-direction`) and settings
  such as forbidden packages or thresholds.
- `scoring`: weights and thresholds for the overall health score. You rarely need to change these.

## Start from a preset, do not write one from scratch

Each style has a preset in `presets/`:

| Style | Preset | Reference project in this repo |
|---|---|---|
| layered | `presets/layered.yaml` | `tests/fixtures/v1.3-reference/layered/project` |
| clean-architecture | `presets/clean-architecture.yaml` | `tests/fixtures/v1.3-reference/clean-architecture/project`, `fixtures/correct-reference` |
| hexagonal | `presets/hexagonal.yaml` | `tests/fixtures/v1.3-reference/hexagonal/project` |
| ddd | `presets/ddd.yaml` | `tests/fixtures/v1.3-reference/ddd/clean` |
| nestjs | `presets/nestjs.yaml` | `tests/fixtures/v1.3-reference/nestjs/project` |

Copy the preset for your style. Change the layer globs to match your folders, and change the settings of the rules
you care about. Leave the rest alone.

A short hand-written spec with only the rules you want does **not** work. The parser fills in the style's full rule
catalogue, and rules you left out fail compilation because they have no settings
(`[MISSING_REQUIRED_PARAM] BR-SPEC-10 FF-SO01: maxPublicMethods`). To switch a rule off, keep its entry and add
`enabled: false` with a `reason`:

```yaml
  - id: FF-CV05
    name: test-file-pairing
    dimension: convention
    severity: advisory
    route: symbolic
    enabled: false
    reason: "tests live under test/, not next to sources"
```

The `reason` is printed by `validate`, so the next reader knows why the rule is off.

## Validate before you evaluate

`validate` checks the YAML and the templates. It also checks that every layer glob matches at least one file in the
project:

```bash
npx tsx bin/firewall.ts validate --spec presets/hexagonal.yaml \
  --project tests/fixtures/v1.3-reference/hexagonal/project
# Spec valid: 22 fitness functions (2 disabled), 5 layers, 0 errors      (exit 0)

npx tsx bin/firewall.ts validate --spec presets/hexagonal.yaml --project fixtures/correct-reference
# Spec validation failed with 3 error(s):
#   - [LAYER_DIR_NOT_FOUND] Layer "adapters-inbound" matches no file of fixtures/correct-reference: no directory glob (src/adapters/inbound/**) matches
#   ...                                                                  (exit 1)
```

A glob that matches nothing is the most common mistake. When it happens, every rule about that layer passes and tells
you nothing.

## One example per style

Each example shows the part of the preset you would edit, then a run against the reference project. Every run used
`--engine cypher-interp --symbolic-only` on branch `v1.3`. The "violating" runs use a reference variant: a copy of the
project with one planted defect (`variants/<name>/variant.patch`, or `overlay/` for DDD).

### Layered

Layers are listed **bottom-up**. A layer may import only the layer directly below it. Skipping a layer
(`no-layer-skip`, FF-S03) is a defining rule only in this style.

```yaml
architecture:
  style: layered
  layers:
    - name: persistence
      kind: infrastructure
      directories: [src/persistence/**]
      roles: [repository, data-access-object, orm-entity]
    - name: business
      kind: domain
      directories: [src/business/**]
      roles: [business-service, entity, value-object]
    - name: presentation
      kind: presentation
      directories: [src/presentation/**]
      roles: [controller, view, presenter]
```

```bash
npx tsx bin/firewall.ts evaluate --engine cypher-interp --symbolic-only \
  --project tests/fixtures/v1.3-reference/layered/project --spec presets/layered.yaml
#   v1.3 scoring:        PASS ...  Blocking AHS: 1.000 (0 of 4 blocking rules violated)     exit 0
```

With variant `v03-controller-reads-gateway` applied (a controller imports a persistence gateway directly):

```
  v1.3 scoring:        FAIL (any-blocking-violation; v1.2E verdict pass)
  Blocking AHS:        0.821  (1 of 4 blocking rules violated, 1 violations)
    FF-S03   no-layer-skip: 1
    1. [critical] src/presentation/http/CatalogController.ts — src/presentation/http/CatalogController.ts (presentation) skips layers to import src/persistence/ProductGateway.ts (persistence)
```

### Clean Architecture

Layers are listed **inner to outer**. A layer may import itself and any layer inside it. `domain-purity` (FF-P01)
lists packages the domain may not import.

```yaml
architecture:
  style: clean-architecture
  layers:
    - name: domain
      directories: [src/domain/**]
      roles: [entity, value-object, domain-service, repository-interface]
    - name: application
      directories: [src/application/**]
      roles: [use-case, dto, application-service]
    - name: infrastructure
      directories: [src/infrastructure/**]
      roles: [repository-impl, controller, middleware, orm-entity]

fitness_functions:
  - id: FF-P01
    name: domain-purity
    dimension: pattern
    severity: critical
    route: symbolic
    forbidden_imports: ["@nestjs/*", "typeorm", "express", "prisma", "@prisma/*", "sequelize"]
```

The violating run is the one from the [quick start](01-quick-start.md) (`fixtures/variant-a-structural`: FF-S01 ×2,
FF-S02 ×2, FF-S04 ×1, exit 1).

### Hexagonal (ports and adapters)

The layers form a graph, not a line, so you list the allowed imports in `allowed_dependencies`. Any cross-layer import
not on the list is a violation. Only the `hexagonal` and `ddd` styles read this list.

```yaml
architecture:
  style: hexagonal
  layers:
    - { name: domain,            kind: domain,         directories: [src/domain/**],            roles: [entity, value-object, domain-service, port] }
    - { name: application,       kind: application,    directories: [src/application/**],       roles: [use-case, port, application-service] }
    - { name: adapters-inbound,  kind: presentation,   directories: [src/adapters/inbound/**],  roles: [controller, cli-command, message-consumer] }
    - { name: adapters-outbound, kind: infrastructure, directories: [src/adapters/outbound/**], roles: [repository, gateway, external-api-client] }
    - { name: config,            kind: application,    directories: [src/config/**],            roles: [composition-root, module] }
  allowed_dependencies:
    - { from: application,       to: [domain] }
    - { from: adapters-inbound,  to: [application, domain] }
    - { from: adapters-outbound, to: [application, domain] }
    - { from: config,            to: [domain, application, adapters-inbound, adapters-outbound] }
```

`config` is the composition root: the one place allowed to wire adapters to ports.

```bash
npx tsx bin/firewall.ts evaluate --engine cypher-interp --symbolic-only \
  --project tests/fixtures/v1.3-reference/hexagonal/project --spec presets/hexagonal.yaml
#   v1.3 scoring:        PASS ...  Blocking AHS: 1.000 (0 of 6 blocking rules violated)     exit 0
```

With variant `v03-use-case-injects-concrete-adapter` applied (a use case imports an in-memory repository adapter):

```
  v1.3 scoring:        FAIL (any-blocking-violation; v1.2E verdict warning)
  Blocking AHS:        0.821  (1 of 6 blocking rules violated, 1 violations)
    FF-S01   dependency-direction-graph: 1
    1. [critical] src/application/services/FindAvailableRoomsService.ts — src/application/services/FindAvailableRoomsService.ts (application) imports against the allowed direction from src/adapters/outbound/persistence/InMemoryRoomRepository.ts (adapters-outbound)
```

### Domain-Driven Design

The tool cannot work out from the code which folder is a bounded context or which class is an aggregate root, so you
declare them in `architecture.ddd`. The preset's block describes the reference project. Replace it with your own
contexts and aggregates:

```yaml
architecture:
  style: ddd
  layers:
    - { name: domain,         kind: domain,         directories: [src/*/domain/**, src/shared-kernel/**] , roles: [aggregate, entity, value-object, domain-event, repository-interface] }
    - { name: application,    kind: application,    directories: [src/*/application/**],                  roles: [application-service, port] }
    - { name: infrastructure, kind: infrastructure, directories: [src/*/infrastructure/**, src/*/acl/**], roles: [repository, anti-corruption-layer] }
    - { name: api,            kind: presentation,   directories: [src/*/api/**],                          roles: [controller] }
    - { name: composition,    kind: application,    directories: [src/main.ts],                           roles: [composition-root] }
  allowed_dependencies:
    - { from: application,    to: [domain] }
    - { from: infrastructure, to: [application, domain] }
    - { from: api,            to: [application, domain] }
    - { from: composition,    to: [domain, application, infrastructure, api] }
  ddd:
    source_root: src/
    contexts:
      - name: ordering
        root: src/ordering/
        public_api: [src/ordering/index.ts, src/ordering/contracts/**]
        acl: []
      - name: billing
        root: src/billing/
        public_api: [src/billing/index.ts, src/billing/contracts/**]
        acl: [src/billing/acl/**]
    outside_contexts: [src/shared-kernel/**, src/main.ts]
    aggregates:
      - name: Order
        context: ordering
        module: src/ordering/domain/order/**
        root: src/ordering/domain/order/Order.ts
        inner_entities: [src/ordering/domain/order/OrderLine.ts]
    value_objects: ["src/**/value-objects/**"]
    repositories: ["src/*/domain/**/*Repository.ts", "src/*/infrastructure/**/*Repository.ts"]
    domain_event_types: [DomainEvent]
    application_services: ["src/*/application/*.ts"]
```

The DDD rules include context isolation (other contexts may import only a context's `public_api` or `acl`), aggregate
boundary (outside code references only the aggregate root), repositories only for aggregate roots, value-object
immutability and a framework-free domain.

```bash
npx tsx bin/firewall.ts evaluate --engine cypher-interp --symbolic-only \
  --project tests/fixtures/v1.3-reference/ddd/clean --spec presets/ddd.yaml
#   v1.3 scoring:        PASS ...  Blocking AHS: 1.000 (0 of 7 blocking rules violated)     exit 0
```

With variant `v04-framework-in-domain` (copy `overlay/` over the project; a value object imports `class-transformer`):

```
  v1.3 scoring:        FAIL (any-blocking-violation; v1.2E verdict pass)
  Blocking AHS:        0.846  (1 of 7 blocking rules violated, 1 violations)
    FF-DT04  domain-purity: 1
    1. [critical] src/billing/domain/invoice/value-objects/InvoiceId.ts — Domain file src/billing/domain/invoice/value-objects/InvoiceId.ts imports forbidden package class-transformer
```

### NestJS

The NestJS preset follows the usual Nest flow: controller → service → repository → entity. It recognises files by
suffix as well as by folder (`file_patterns`, for example `**/*.service.ts` and `**/*.repository.ts`), because Nest
projects are often organised by feature rather than by layer.

```yaml
architecture:
  style: nestjs
  layers:                        # inner to outer: domain, infrastructure, application, presentation
    - name: domain
      directories: [src/domain/**, src/core/**, src/entities/**, src/models/**]
      roles: [entity, value-object, domain-service, repository-interface]
    - name: infrastructure
      directories: [src/infrastructure/**, src/persistence/**, src/adapters/**, src/prisma/**, src/lib/**]
      file_patterns: ["**/*.repository.ts", "**/*.worker.ts", "**/workers/**", "**/strategies/**"]
      roles: [repository-impl, orm-entity, external-service, middleware, worker]
    # application and presentation: see presets/nestjs.yaml
```

```bash
npx tsx bin/firewall.ts evaluate --engine cypher-interp --symbolic-only \
  --project tests/fixtures/v1.3-reference/nestjs/project --spec presets/nestjs.yaml
#   v1.3 scoring:        PASS ...  Blocking AHS: 1.000 (0 of 6 blocking rules violated)     exit 0
```

With variant `v05-domain-entity-typeorm-decorator` applied:

```
  v1.3 scoring:        FAIL (any-blocking-violation; v1.2E verdict pass)
  Blocking AHS:        0.846  (1 of 6 blocking rules violated, 1 violations)
    FF-P01   domain-purity: 1
    1. [critical] src/domain/workshop.ts — Domain file src/domain/workshop.ts imports forbidden package typeorm
```

## Reproducing the violating runs

```bash
S=$(mktemp -d)
cp -r tests/fixtures/v1.3-reference/hexagonal/project "$S/hex-v03"
(cd "$S/hex-v03" && patch -p1 < "$OLDPWD/tests/fixtures/v1.3-reference/hexagonal/variants/v03-use-case-injects-concrete-adapter/variant.patch")
npx tsx bin/firewall.ts evaluate --engine cypher-interp --symbolic-only --project "$S/hex-v03" --spec presets/hexagonal.yaml

cp -r tests/fixtures/v1.3-reference/ddd/clean "$S/ddd-v04"
cp -r tests/fixtures/v1.3-reference/ddd/variants/v04-framework-in-domain/overlay/. "$S/ddd-v04/"
npx tsx bin/firewall.ts evaluate --engine cypher-interp --symbolic-only --project "$S/ddd-v04" --spec presets/ddd.yaml
```

## Excluding paths

By default, extraction skips `node_modules`, `dist`, `build`, `*.d.ts`, `*.spec.ts` and `*.test.ts`. A single rule can
skip more paths with `exclude_paths` (a list of globs) on its entry.

## Don't have a spec yet?

See [chapter 7](07-init-existing-codebase.md): `init` proposes a spec from your existing folders.
