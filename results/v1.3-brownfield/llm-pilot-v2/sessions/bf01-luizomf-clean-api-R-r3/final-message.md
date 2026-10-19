```yaml
architecture:
  style: clean-architecture
  layers:
    - name: domain
      kind: domain
      directories:
        - src/domain/**
      file_patterns:
        - src/domain/**/*.ts
      roles:
        - entity
        - value-object
        - repository-interface
      decorators: []
    - name: application
      kind: application
      directories:
        - src/application/**
      file_patterns:
        - src/application/**/*.ts
      roles:
        - use-case
        - dto
        - application-service
        - repository-interface
      decorators: []
    - name: presentation
      kind: presentation
      directories:
        - src/presentation/**
      file_patterns:
        - src/presentation/**/*.ts
      roles:
        - controller
        - middleware
      decorators: []
    - name: infrastructure
      kind: infrastructure
      directories:
        - src/infrastructure/**
      file_patterns:
        - src/infrastructure/**/*.ts
      roles:
        - repository-impl
        - orm-entity
      decorators: []
    - name: main
      kind: infrastructure
      directories:
        - src/main/**
      file_patterns:
        - src/main/**/*.ts
      roles:
        - application-service
      decorators: []
default_exclude_paths:
  - "node_modules/**"
  - "dist/**"
  - "**/*.spec.ts"
  - "**/*.test.ts"
fitness_overrides:
  - id: FF-P01
    enabled: true
    reason: "Domain must stay free of frameworks; this repo uses express and knex, so both are added to the forbidden imports."
    params:
      forbidden_imports:
        - "@nestjs/*"
        - typeorm
        - express
        - knex
        - prisma
        - "@prisma/*"
        - sequelize
```

```json
{"units": [
{"id": "layer:domain", "claim": "The domain layer holds the models and the use-case interfaces and depends on nothing else.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 19, "quote": "This is the \"domain\" or \"entities\" layer. Here's the description by Uncle Bob:"},
{"type": "pattern", "glob": "src/domain/**/*.ts", "count": 16}]},
{"id": "layer:application", "claim": "The application layer holds the use cases, ports, errors and concrete validations.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 27, "quote": "This is the **\"Use Cases\"** layer. Here you may add the application **Use cases**. Here's the description by Uncle Bob:"},
{"type": "pattern", "glob": "src/application/**/*.ts", "count": 66}]},
{"id": "layer:presentation", "claim": "The presentation layer holds the controllers, middlewares and response classes that adapt use cases to the web.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 39, "quote": "I'm using the name **\"Presentation\"** for this layer."},
{"type": "pattern", "glob": "src/presentation/**/*.ts", "count": 22}]},
{"id": "layer:infrastructure", "claim": "The infrastructure layer holds the express, knex and repository implementations (frameworks and drivers).", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 51, "quote": "This folder (layer) is where we add everything related to external \"**Frameworks and Drivers**\". Here you can add the repositories, external frameworks, web and so on."},
{"type": "pattern", "glob": "src/infrastructure/**/*.ts", "count": 36}]},
{"id": "layer:main", "claim": "The main layer is the composition root. It holds the factories that wire everything together and may depend on all other layers. src/common is a cross-cutting folder and belongs to no layer.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 61, "quote": "This layer is where we put everything together. It's the \"dirty layer\", because most factories will be here. It may depend on all other layers in the system."},
{"type": "pattern", "glob": "src/main/**/*.ts", "count": 9}]},
{"id": "order", "claim": "Layers are ordered from innermost to outermost: domain, application, presentation, infrastructure, main. Dependencies point inwards, and main may depend on everything.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 74, "quote": ">The overriding rule that makes this architecture work is The Dependency Rule. This rule says that source code dependencies can only point inwards. Nothing in an inner circle can know anything at all about something in an outer circle. In particular, the name of something declared in an outer circle must not be mentioned by the code in the an inner circle. That includes, functions, classes. variables, or any other named software entity."},
{"type": "doc", "file": "README.md", "line": 61, "quote": "This layer is where we put everything together. It's the \"dirty layer\", because most factories will be here. It may depend on all other layers in the system."}]},
{"id": "ff:FF-P01", "claim": "Domain purity also forbids express and knex, the frameworks this repository uses.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 45, "quote": ">Similarly, data is converted, in this layer, from the form most convenient for entities and use cases, into the form most convenient for whatever persistence framework is being used. i.e. The Database. No code inward of this circle should know anything at all about the database. If the database is a SQL database, then all the SQL should be restricted to this layer, and in particular to the parts of this layer that have to do with the database."},
{"type": "pattern", "glob": "src/domain/**/*.ts", "count": 16}]}
]}
```