```yaml
architecture:
  style: clean-architecture
  layers:
    - name: common
      kind: cross-cutting
      directories:
        - src/common/**
      file_patterns:
        - "src/common/**/*.ts"
      roles:
        - helper
        - adapter
    - name: domain
      directories:
        - src/domain/**
      file_patterns:
        - "src/domain/**/*.ts"
      roles:
        - entity
        - value-object
        - use-case-interface
    - name: application
      directories:
        - src/application/**
      file_patterns:
        - "src/application/**/*.ts"
      roles:
        - use-case
        - port
        - validation
        - application-error
    - name: presentation
      directories:
        - src/presentation/**
      file_patterns:
        - "src/presentation/**/*.ts"
      roles:
        - controller
        - middleware
        - response
    - name: infrastructure
      directories:
        - src/infrastructure/**
      file_patterns:
        - "src/infrastructure/**/*.ts"
      roles:
        - repository-impl
        - middleware
        - orm-entity
        - route
    - name: main
      directories:
        - src/main/**
      file_patterns:
        - "src/main/**/*.ts"
      roles:
        - factory

default_exclude_paths:
  - "node_modules/**"
  - "dist/**"
  - "**/*.spec.ts"
  - "**/*.test.ts"
  - "src/infrastructure/knex/migrations/**"
  - "src/infrastructure/knex/seeds/**"

fitness_overrides:
  - id: FF-S03
    enabled: false
    reason: "README says main may depend on all layers and the flow runs infrastructure -> presentation -> application -> domain, so layer skipping is normal here."
```

```json
{"units": [
{"id": "layer:common", "claim": "common is a cross-cutting layer of helpers and adapters usable by all other layers.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 9, "quote": "There's also another layer called \"common\" that you can use as a [cross-cutting concern](https://en.wikipedia.org/wiki/Cross-cutting_concern) layer."},
{"type": "pattern", "glob": "src/common/**/*.ts", "count": 20}]},
{"id": "layer:domain", "claim": "domain holds the entities (models) and the use-case interfaces, and is the innermost business layer.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 19, "quote": "This is the \"domain\" or \"entities\" layer. Here's the description by Uncle Bob:"},
{"type": "pattern", "glob": "src/domain/**/*.ts", "count": 16}]},
{"id": "layer:application", "claim": "application holds the use cases, their ports, validations and errors.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 27, "quote": "This is the **\"Use Cases\"** layer. Here you may add the application **Use cases**. Here's the description by Uncle Bob:"},
{"type": "pattern", "glob": "src/application/**/*.ts", "count": 72}]},
{"id": "layer:presentation", "claim": "presentation holds the controllers, middlewares and responses that adapt data between the use cases and the outside.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 39, "quote": "I'm using the name **\"Presentation\"** for this layer."},
{"type": "pattern", "glob": "src/presentation/**/*.ts", "count": 25}]},
{"id": "layer:infrastructure", "claim": "infrastructure holds the express, knex and repository implementations, which are the outermost frameworks and drivers.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 51, "quote": "This folder (layer) is where we add everything related to external \"**Frameworks and Drivers**\". Here you can add the repositories, external frameworks, web and so on."},
{"type": "pattern", "glob": "src/infrastructure/**/*.ts", "count": 31}]},
{"id": "layer:main", "claim": "main is the composition root where factories wire everything together, and it may depend on all layers.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 61, "quote": "This layer is where we put everything together. It's the \"dirty layer\", because most factories will be here. It may depend on all other layers in the system."},
{"type": "pattern", "glob": "src/main/**/*.ts", "count": 9}]},
{"id": "order", "claim": "Layers run from the innermost (common, domain) outward through application, presentation, infrastructure and main, and dependencies point inwards.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 74, "quote": "This rule says that source code dependencies can only point inwards."},
{"type": "doc", "file": "README.md", "line": 78, "quote": "In our case, data enter the system via \"express routes\" (infrastructure layer) to the \"controllers\" (adapters layer), to the \"use cases\" (application layer), to the \"domain\" (domain/entities layer)."}]},
{"id": "ff:FF-S03", "claim": "no-layer-skip is disabled because main may depend on every layer and the data flow crosses several layers.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 61, "quote": "This layer is where we put everything together. It's the \"dirty layer\", because most factories will be here. It may depend on all other layers in the system."}]},
{"id": "exclude:src/infrastructure/knex/migrations/**", "claim": "Knex migrations are database scripts, not architectural code.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 139, "quote": "│   │   ├── migrations - migrations"},
{"type": "pattern", "glob": "src/infrastructure/knex/migrations/**", "count": 4}]},
{"id": "exclude:src/infrastructure/knex/seeds/**", "claim": "Knex seeds are data-loading scripts, not architectural code.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 140, "quote": "│   │   └── seeds - seeds"},
{"type": "pattern", "glob": "src/infrastructure/knex/seeds/**", "count": 3}]}
]}
```