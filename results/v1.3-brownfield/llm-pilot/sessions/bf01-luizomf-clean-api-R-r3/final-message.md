```yaml
architecture:
  style: clean-architecture
  layers:
    - name: domain
      directories:
        - src/domain/**
      file_patterns:
        - src/domain/**/*.ts
      roles:
        - entity
        - value-object
        - use-case-interface
    - name: application
      directories:
        - src/application/**
      file_patterns:
        - src/application/**/*.ts
      roles:
        - use-case
        - dto
        - application-service
        - port
    - name: presentation
      directories:
        - src/presentation/**
      file_patterns:
        - src/presentation/**/*.ts
      roles:
        - controller
        - middleware
        - response
    - name: infrastructure
      directories:
        - src/infrastructure/**
      file_patterns:
        - src/infrastructure/**/*.ts
      roles:
        - repository-impl
        - orm-entity
        - middleware
    - name: main
      directories:
        - src/main/**
      file_patterns:
        - src/main/**/*.ts
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
{"id": "layer:domain", "claim": "The domain layer holds the entities/models and use-case interfaces under src/domain.", "origin": "proposed", "citations": [{"type": "doc", "file": "README.md", "line": 17, "quote": "### domain layer"}]},
{"id": "layer:application", "claim": "The application layer holds use cases, ports, errors and validations under src/application.", "origin": "proposed", "citations": [{"type": "doc", "file": "README.md", "line": 25, "quote": "### application layer"}]},
{"id": "layer:presentation", "claim": "The presentation (interface adapters) layer holds controllers, middlewares and responses under src/presentation.", "origin": "proposed", "citations": [{"type": "doc", "file": "README.md", "line": 35, "quote": "### adapters (presentation) layer"}]},
{"id": "layer:infrastructure", "claim": "The infrastructure layer holds express, knex and repository implementations under src/infrastructure.", "origin": "proposed", "citations": [{"type": "doc", "file": "README.md", "line": 49, "quote": "### infrastructure layer"}]},
{"id": "layer:main", "claim": "The main layer is the composition root with factories under src/main, allowed to depend on all other layers.", "origin": "proposed", "citations": [{"type": "doc", "file": "README.md", "line": 61, "quote": "It may depend on all other layers in the system."}]},
{"id": "order", "claim": "Layers are ordered domain, application, presentation, infrastructure, main, from innermost to outermost, with dependencies pointing only inward.", "origin": "proposed", "citations": [{"type": "doc", "file": "README.md", "line": 74, "quote": "The overriding rule that makes this architecture work is The Dependency Rule."}]}
]}
```