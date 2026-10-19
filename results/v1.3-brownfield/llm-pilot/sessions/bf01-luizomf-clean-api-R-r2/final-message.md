```yaml
architecture:
  style: clean-architecture
  layers:
    - name: domain
      directories:
        - src/domain/**
      roles:
        - entity
        - value-object
        - domain-service
        - repository-interface
    - name: application
      directories:
        - src/application/**
      roles:
        - use-case
        - dto
        - application-service
    - name: presentation
      directories:
        - src/presentation/**
      roles:
        - controller
        - middleware
    - name: infrastructure
      directories:
        - src/infrastructure/**
      roles:
        - repository-impl
        - controller
        - middleware
        - orm-entity
    - name: main
      directories:
        - src/main/**
      roles:
        - factory
default_exclude_paths:
  - "node_modules/**"
  - "dist/**"
  - "**/*.spec.ts"
  - "**/*.test.ts"
```

```json
{"units": [
{"id":"layer:domain","claim":"The domain layer holds the entities/models and use-case interfaces under src/domain.","origin":"proposed","citations":[{"type":"doc","file":"README.md","line":17,"quote":"### domain layer"},{"type":"doc","file":"README.md","line":122,"quote":"├── domain - Domain Layer"}]},
{"id":"layer:application","claim":"The application layer holds use cases, ports, errors and validations under src/application.","origin":"proposed","citations":[{"type":"doc","file":"README.md","line":25,"quote":"### application layer"},{"type":"doc","file":"README.md","line":86,"quote":"├── application - Application or Use cases layer"}]},
{"id":"layer:presentation","claim":"The presentation (interface adapters) layer holds concrete controllers, middlewares and responses under src/presentation.","origin":"proposed","citations":[{"type":"doc","file":"README.md","line":39,"quote":"I'm using the name **\"Presentation\"** for this layer."},{"type":"doc","file":"README.md","line":157,"quote":"└── presentation - Presentation layer"}]},
{"id":"layer:infrastructure","claim":"The infrastructure layer holds express, knex and repository implementations under src/infrastructure.","origin":"proposed","citations":[{"type":"doc","file":"README.md","line":49,"quote":"### infrastructure layer"},{"type":"doc","file":"README.md","line":132,"quote":"├── infrastructure - Infrastructure layer"}]},
{"id":"layer:main","claim":"The main layer is the composition root with the factories under src/main and may depend on all other layers.","origin":"proposed","citations":[{"type":"doc","file":"README.md","line":59,"quote":"### main layer"},{"type":"doc","file":"README.md","line":61,"quote":"This layer is where we put everything together. It's the \"dirty layer\", because most factories will be here. It may depend on all other layers in the system."}]},
{"id":"order","claim":"Layers are ordered from innermost to outermost: domain, application, presentation, infrastructure, main, following the clean architecture flow.","origin":"proposed","citations":[{"type":"doc","file":"README.md","line":78,"quote":"In our case, data enter the system via \"express routes\" (infrastructure layer) to the \"controllers\" (adapters layer), to the \"use cases\" (application layer), to the \"domain\" (domain/entities layer). Then the system outputs via \"domain\" -> \"use cases\" -> \"presentation\" -> \"infrastructure\". I'm using the \"main\" layer to create factories for \"middlewares\", and \"controllers\" (and possibly other factories)."}]}
]}
```