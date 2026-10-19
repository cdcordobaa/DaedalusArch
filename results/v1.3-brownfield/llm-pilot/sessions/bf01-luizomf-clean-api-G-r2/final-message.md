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
        - middleware
        - orm-entity
    - name: main
      directories:
        - src/main/**
      roles:
        - application-service
default_exclude_paths:
  - "node_modules/**"
  - "dist/**"
  - "**/*.spec.ts"
  - "**/*.test.ts"
```

```json
{"units": [
{"id": "layer:domain", "claim": "The domain layer is the entities layer, holding models and use-case contracts under src/domain.", "origin": "proposed", "citations": [{"type": "doc", "file": "README.md", "line": 17, "quote": "### domain layer"}]},
{"id": "layer:application", "claim": "The application layer holds use cases, ports, errors and validation under src/application.", "origin": "proposed", "citations": [{"type": "doc", "file": "README.md", "line": 25, "quote": "### application layer"}]},
{"id": "layer:presentation", "claim": "The presentation (interface adapters) layer holds controllers, middlewares and responses under src/presentation.", "origin": "proposed", "citations": [{"type": "doc", "file": "README.md", "line": 35, "quote": "### adapters (presentation) layer"}]},
{"id": "layer:infrastructure", "claim": "The infrastructure layer holds frameworks and drivers (express, knex, repositories) under src/infrastructure.", "origin": "proposed", "citations": [{"type": "doc", "file": "README.md", "line": 49, "quote": "### infrastructure layer"}]},
{"id": "layer:main", "claim": "The main layer is the composition root with the factories, under src/main.", "origin": "proposed", "citations": [{"type": "doc", "file": "README.md", "line": 59, "quote": "### main layer"}]},
{"id": "order", "claim": "Layers run from the innermost domain through application and presentation to infrastructure, with main outermost and allowed to depend on all other layers.", "origin": "proposed", "citations": [{"type": "doc", "file": "README.md", "line": 61, "quote": "This layer is where we put everything together. It's the \"dirty layer\", because most factories will be here. It may depend on all other layers in the system."}]}
]}
```