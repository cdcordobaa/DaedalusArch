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
      roles:
        - entity
        - value-object
        - repository-interface
    - name: application
      kind: application
      directories:
        - src/application/**
      file_patterns:
        - "src/application/**/*.ts"
      roles:
        - use-case
        - dto
        - application-service
    - name: presentation
      kind: presentation
      directories:
        - src/presentation/**
      file_patterns:
        - "src/presentation/**/*.ts"
      roles:
        - controller
        - middleware
    - name: infrastructure
      kind: infrastructure
      directories:
        - src/infrastructure/**
      file_patterns:
        - "src/infrastructure/**/*.ts"
      roles:
        - repository-impl
        - orm-entity
    - name: main
      kind: infrastructure
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
```

```json
{"units": [
{"id": "layer:domain", "claim": "The domain layer holds the models and use-case interfaces in src/domain and imports nothing from outside itself.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 19, "quote": "This is the \"domain\" or \"entities\" layer. Here's the description by Uncle Bob:"},
{"type": "pattern", "glob": "src/domain/**", "count": 17},
{"type": "stat", "query": "MATCH (a:File)-[:IMPORTS]->(b:File) WHERE a.filePath STARTS WITH 'src/domain/' AND NOT b.filePath STARTS WITH 'src/domain/' RETURN count(*) AS numerator, count(DISTINCT a) AS denominator", "numerator": 0, "denominator": 0}]},
{"id": "layer:application", "claim": "The application layer holds use cases, ports, validations and errors, and depends only on the domain (plus common adapters' ports).", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 27, "quote": "This is the **\"Use Cases\"** layer. Here you may add the application **Use cases**. Here's the description by Uncle Bob:"},
{"type": "pattern", "glob": "src/application/**", "count": 64},
{"type": "stat", "query": "MATCH (a:File)-[:IMPORTS]->(b:File) WHERE a.filePath STARTS WITH 'src/application/' AND b.filePath STARTS WITH 'src/domain/' RETURN count(*) AS numerator, count(DISTINCT a) AS denominator", "numerator": 39, "denominator": 25}]},
{"id": "layer:presentation", "claim": "The presentation layer holds controllers, middlewares and responses, importing application and domain only.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 39, "quote": "I'm using the name **\"Presentation\"** for this layer."},
{"type": "pattern", "glob": "src/presentation/**", "count": 24},
{"type": "stat", "query": "MATCH (a:File)-[:IMPORTS]->(b:File) WHERE a.filePath STARTS WITH 'src/presentation/' AND b.filePath STARTS WITH 'src/application/' RETURN count(*) AS numerator, count(DISTINCT a) AS denominator", "numerator": 47, "denominator": 13}]},
{"id": "layer:infrastructure", "claim": "The infrastructure layer holds express, knex and repository implementations that implement application ports, the outermost framework-and-driver code below main.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 51, "quote": "This folder (layer) is where we add everything related to external \"**Frameworks and Drivers**\". Here you can add the repositories, external frameworks, web and so on."},
{"type": "pattern", "glob": "src/infrastructure/**", "count": 36},
{"type": "stat", "query": "MATCH (a:File)-[:IMPORTS]->(b:File) WHERE a.filePath STARTS WITH 'src/infrastructure/' AND b.filePath STARTS WITH 'src/application/' RETURN count(*) AS numerator, count(DISTINCT a) AS denominator", "numerator": 28, "denominator": 7}]},
{"id": "layer:main", "claim": "The main layer holds the composition-root factories and may depend on every other layer.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 61, "quote": "This layer is where we put everything together. It's the \"dirty layer\", because most factories will be here. It may depend on all other layers in the system."},
{"type": "pattern", "glob": "src/main/**", "count": 9},
{"type": "stat", "query": "MATCH (a:File)-[:IMPORTS]->(b:File) WHERE a.filePath STARTS WITH 'src/main/' AND b.filePath STARTS WITH 'src/presentation/' RETURN count(*) AS numerator, count(DISTINCT a) AS denominator", "numerator": 16, "denominator": 9}]},
{"id": "order", "claim": "Dependencies point inward, in the order domain, application, presentation, infrastructure, main (inner to outer). About 170 cross-layer edges follow it; the 9 edges from infrastructure to main (3 files) violate it.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 74, "quote": ">The overriding rule that makes this architecture work is The Dependency Rule. This rule says that source code dependencies can only point inwards. Nothing in an inner circle can know anything at all about something in an outer circle. In particular, the name of something declared in an outer circle must not be mentioned by the code in the an inner circle. That includes, functions, classes. variables, or any other named software entity."},
{"type": "stat", "query": "MATCH (a:File)-[:IMPORTS]->(b:File) WHERE a.filePath STARTS WITH 'src/infrastructure/' AND b.filePath STARTS WITH 'src/main/' RETURN count(*) AS numerator, count(DISTINCT a) AS denominator", "numerator": 9, "denominator": 3}]}
]}
```