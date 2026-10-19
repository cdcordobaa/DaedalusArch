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
        - orm-entity
    - name: main
      directories:
        - src/main/**
      roles:
        - application-service
```

```json
{"units": [
{"id": "layer:domain", "claim": "The domain layer holds the models and the use-case interfaces under src/domain.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 17, "quote": "### domain layer"},
{"type": "pattern", "glob": "src/domain/**", "count": 16}]},
{"id": "layer:application", "claim": "The application layer holds use cases, ports, errors and validation under src/application.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 25, "quote": "### application layer"},
{"type": "pattern", "glob": "src/application/**", "count": 78}]},
{"id": "layer:presentation", "claim": "The presentation layer (interface adapters) holds the controllers, middlewares and responses under src/presentation.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 35, "quote": "### adapters (presentation) layer"},
{"type": "pattern", "glob": "src/presentation/**", "count": 26}]},
{"id": "layer:infrastructure", "claim": "The infrastructure layer holds the express, knex and repository implementations under src/infrastructure.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 49, "quote": "### infrastructure layer"},
{"type": "pattern", "glob": "src/infrastructure/**", "count": 32}]},
{"id": "layer:main", "claim": "The main layer holds the factories that wire everything together and may depend on all other layers.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 59, "quote": "### main layer"},
{"type": "pattern", "glob": "src/main/**", "count": 9}]},
{"id": "order", "claim": "Layers are ordered from the innermost to the outermost: domain, application, presentation, infrastructure, main. Data flows from infrastructure through presentation and application to domain.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 78, "quote": "In our case, data enter the system via \"express routes\" (infrastructure layer) to the \"controllers\" (adapters layer), to the \"use cases\" (application layer), to the \"domain\" (domain/entities layer)."},
{"type": "doc", "file": "README.md", "line": 61, "quote": "This layer is where we put everything together. It's the \"dirty layer\", because most factories will be here. It may depend on all other layers in the system."}]}
]}
```