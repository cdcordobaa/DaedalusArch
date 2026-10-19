Nothing was run, and I didn't open any files. The layers come from the tracked file list and the README, and the glob counts are my own tally from that list.

I put `src/app/validators/**`, `src/app/interfaces/**`, `src/main.ts`, `src/config.main.ts` and `src/spelunk.ts` outside every layer. The first two are cross-cutting helpers, and the other three are bootstrap or tooling files.

```yaml
architecture:
  style: nestjs
  layers:
    - name: domain
      kind: domain
      directories:
        - src/app/models/**
        - src/app/**/models/**
      roles:
        - entity
        - value-object
    - name: infrastructure
      kind: infrastructure
      directories:
        - src/app/database/**
        - src/app/redis/**
        - src/app/config/**
        - src/app/cookie/**
        - src/app/options/**
        - src/app/auth/google/**
        - src/app/auth/local/**
      file_patterns:
        - "**/*.repository.ts"
      roles:
        - external-service
        - repository-impl
    - name: application
      kind: application
      file_patterns:
        - "**/*.service.ts"
      roles:
        - application-service
    - name: presentation
      kind: presentation
      directories:
        - src/app/guards/**
      file_patterns:
        - "**/*.controller.ts"
        - "**/*.module.ts"
        - "**/*.guard.ts"
      roles:
        - controller
        - module
        - guard
      decorators:
        - "@Controller"
        - "@Module"
```

```json
{"units": [
{"id": "layer:domain", "claim": "Model/DTO/GraphQL type classes under models folders form the innermost data-shape layer.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 11, "quote": "This project is written using [NestJS](https://docs.nestjs.com) for the server"},
{"type": "pattern", "glob": "src/app/**/models/**", "count": 25}]},
{"id": "layer:infrastructure", "claim": "Database, redis, config, cookie, options and the google/local auth providers are the inner technical-service layer.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 11, "quote": "This project is written using [NestJS](https://docs.nestjs.com) for the server"},
{"type": "pattern", "glob": "src/app/database/**", "count": 10},
{"type": "pattern", "glob": "src/app/redis/**", "count": 5}]},
{"id": "layer:application", "claim": "Feature services (*.service.ts) outside the infrastructure folders hold the application logic.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 11, "quote": "This project is written using [NestJS](https://docs.nestjs.com) for the server"},
{"type": "pattern", "glob": "src/app/**/*.service.ts", "count": 12}]},
{"id": "layer:presentation", "claim": "Controllers, modules and guards are the outer HTTP/wiring layer.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 11, "quote": "This project is written using [NestJS](https://docs.nestjs.com) for the server"},
{"type": "pattern", "glob": "src/app/**/*.controller.ts", "count": 6},
{"type": "pattern", "glob": "src/app/**/*.module.ts", "count": 14}]},
{"id": "order", "claim": "Layer order follows the NestJS preset: domain, infrastructure, application, presentation (controller to service to data access to models).", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 11, "quote": "This project is written using [NestJS](https://docs.nestjs.com) for the server"},
{"type": "pattern", "glob": "src/app/**/*.controller.ts", "count": 6}]}
]}
```