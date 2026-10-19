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
    - name: application
      directories:
        - src/application/**
      roles:
        - use-case
        - dto
        - application-service
        - repository-interface
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
{"id":"layer:domain","claim":"The domain (entities) layer holds models and use-case contracts in src/domain.","origin":"proposed","citations":[{"type":"doc","file":"README.md","line":122,"quote":"├── domain - Domain Layer"},{"type":"pattern","glob":"src/domain/**","count":16}]},
{"id":"layer:application","claim":"The application layer holds use cases, ports, errors and validation.","origin":"proposed","citations":[{"type":"doc","file":"README.md","line":86,"quote":"├── application - Application or Use cases layer"},{"type":"pattern","glob":"src/application/**","count":76}]},
{"id":"layer:presentation","claim":"The presentation (interface adapters) layer holds controllers, middlewares and responses.","origin":"proposed","citations":[{"type":"doc","file":"README.md","line":157,"quote":"└── presentation - Presentation layer"},{"type":"pattern","glob":"src/presentation/**","count":26}]},
{"id":"layer:infrastructure","claim":"The infrastructure layer holds express, knex and repository implementations.","origin":"proposed","citations":[{"type":"doc","file":"README.md","line":132,"quote":"├── infrastructure - Infrastructure layer"},{"type":"pattern","glob":"src/infrastructure/**","count":33}]},
{"id":"layer:main","claim":"The main layer composes factories wiring all other layers and may depend on all of them.","origin":"proposed","citations":[{"type":"doc","file":"README.md","line":149,"quote":"├── main - Main layer"},{"type":"pattern","glob":"src/main/**","count":9}]},
{"id":"order","claim":"Layers are ordered from innermost (domain) to outermost (main), with dependencies pointing inward.","origin":"proposed","citations":[{"type":"doc","file":"README.md","line":61,"quote":"This layer is where we put everything together. It's the \"dirty layer\", because most factories will be here. It may depend on all other layers in the system."},{"type":"doc","file":"README.md","line":78,"quote":"In our case, data enter the system via \"express routes\" (infrastructure layer) to the \"controllers\" (adapters layer), to the \"use cases\" (application layer), to the \"domain\" (domain/entities layer). Then the system outputs via \"domain\" -> \"use cases\" -> \"presentation\" -> \"infrastructure\". I'm using the \"main\" layer to create factories for \"middlewares\", and \"controllers\" (and possibly other factories).".slice(0,0)}]}
]}
```