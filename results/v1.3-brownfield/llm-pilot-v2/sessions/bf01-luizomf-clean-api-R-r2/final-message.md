The layer order below puts `presentation` before `infrastructure`. That follows the README's data flow, where express routes (infrastructure) call controllers (presentation). I made two choices the README doesn't state outright:
- **`common`:** It is left out of every layer, as a cross-cutting concern.
- **`main`:** It is a composition-root layer with `kind: infrastructure`, placed outermost.

Two greps support the layering: `src/domain` has no imports from the outer layers or `common`, and `src/application` has no imports from `presentation`, `infrastructure` or `main`. I did not read the other layers' imports, so the order for those layers rests on the README.

The one fitness-function change is FF-P01. Its `forbidden_imports` gain `knex` and `pg`, since the README names knex as the data-storage detail. The preset's default excludes are unchanged.

```yaml
architecture:
  style: clean-architecture
  layers:
    - name: domain
      kind: domain
      directories:
        - src/domain/**
      file_patterns:
        - "src/domain/**/*.ts"
      roles: [entity, value-object, domain-service]
    - name: application
      kind: application
      directories:
        - src/application/**
      file_patterns:
        - "src/application/**/*.ts"
      roles: [use-case, dto, application-service, repository-interface]
    - name: presentation
      kind: presentation
      directories:
        - src/presentation/**
      file_patterns:
        - "src/presentation/**/*.ts"
      roles: [controller, middleware]
    - name: infrastructure
      kind: infrastructure
      directories:
        - src/infrastructure/**
      file_patterns:
        - "src/infrastructure/**/*.ts"
      roles: [repository-impl, orm-entity]
    - name: main
      kind: infrastructure
      directories:
        - src/main/**
      file_patterns:
        - "src/main/**/*.ts"
      roles: [factory]
fitness_overrides:
  - id: FF-P01
    enabled: true
    reason: "README names knex as the replaceable data-storage detail; inner layers must not import it"
    params:
      forbidden_imports: ["@nestjs/*", typeorm, express, prisma, "@prisma/*", sequelize, knex, pg]
```

```json
{"units": [
{"id":"layer:domain","claim":"Domain holds entities/models and use-case interfaces and imports nothing from outer layers.","origin":"proposed","citations":[{"type":"doc","file":"README.md","line":19,"quote":"This is the \"domain\" or \"entities\" layer. Here's the description by Uncle Bob:"},{"type":"pattern","glob":"src/domain/**","count":17}]},
{"id":"layer:application","claim":"Application holds use cases, ports, errors and validations, depending only on domain.","origin":"proposed","citations":[{"type":"doc","file":"README.md","line":27,"quote":"This is the **\"Use Cases\"** layer. Here you may add the application **Use cases**. Here's the description by Uncle Bob:"},{"type":"pattern","glob":"src/application/**","count":68}]},
{"id":"layer:presentation","claim":"Presentation holds controllers, middlewares and response classes.","origin":"proposed","citations":[{"type":"doc","file":"README.md","line":39,"quote":"I'm using the name **\"Presentation\"** for this layer."},{"type":"pattern","glob":"src/presentation/**","count":24}]},
{"id":"layer:infrastructure","claim":"Infrastructure holds express, knex and repository implementations (frameworks and drivers).","origin":"proposed","citations":[{"type":"doc","file":"README.md","line":51,"quote":"This folder (layer) is where we add everything related to external \"**Frameworks and Drivers**\". Here you can add the repositories, external frameworks, web and so on."},{"type":"pattern","glob":"src/infrastructure/**","count":38}]},
{"id":"layer:main","claim":"Main is the composition root with factories and may depend on all layers.","origin":"proposed","citations":[{"type":"doc","file":"README.md","line":61,"quote":"This layer is where we put everything together. It's the \"dirty layer\", because most factories will be here. It may depend on all other layers in the system."},{"type":"pattern","glob":"src/main/**","count":9}]},
{"id":"order","claim":"Order from inner to outer: domain, application, presentation, infrastructure, main; dependencies point inwards; common is cross-cutting and in no layer.","origin":"proposed","citations":[{"type":"doc","file":"README.md","line":74,"quote":"The overriding rule that makes this architecture work is The Dependency Rule. This rule says that source code dependencies can only point inwards. Nothing in an inner circle can know anything at all about something in an outer circle. In particular, the name of something declared in an outer circle must not be mentioned by the code in the an inner circle. That includes, functions, classes. variables, or any other named software entity."},{"type":"doc","file":"README.md","line":78,"quote":"In our case, data enter the system via \"express routes\" (infrastructure layer) to the \"controllers\" (adapters layer), to the \"use cases\" (application layer), to the \"domain\" (domain/entities layer)."},{"type":"pattern","glob":"src/common/**","count":21}]},
{"id":"ff:FF-P01","claim":"Domain purity also forbids knex and pg imports in inner layers.","origin":"proposed","citations":[{"type":"doc","file":"README.md","line":7,"quote":"For data storage, I'm using [knex query builder](http://knexjs.org/), so you can use Postgres, MSSQL, MySQL, MariaDB, SQLite3, Oracle, and Amazon Redshift."},{"type":"pattern","glob":"src/infrastructure/knex/**","count":9}]}
]}
```