```yaml
architecture:
  style: nestjs
  layers:
    - name: domain
      kind: domain
      directories:
        - src/app/models/**
        - src/app/interfaces/**
      roles:
        - entity
        - value-object
        - repository-interface
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
        - "**/strategies/**"
      roles:
        - repository-impl
        - external-service
        - middleware
    - name: application
      kind: application
      directories:
        - src/app/*/models/**
        - src/app/auth/user/models/**
      file_patterns:
        - "**/*.service.ts"
        - "**/*.processor.ts"
        - "**/dto/**"
        - "**/*.dto.ts"
      roles:
        - application-service
        - dto
        - processor
    - name: presentation
      kind: presentation
      directories:
        - src/app/guards/**
      file_patterns:
        - "**/*.controller.ts"
        - "**/*.module.ts"
        - "**/*.guard.ts"
        - "**/*.interceptor.ts"
        - "**/*.gateway.ts"
      roles:
        - controller
        - module
        - guard
        - interceptor
      decorators:
        - "@Controller"
        - "@Module"
```

```json
{"units": [
{"id": "layer:domain", "claim": "Domain is limited to the app-level shared models and interfaces; the validators folder is left out as a cross-cutting helper.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 11, "quote": "This project is written using [NestJS](https://docs.nestjs.com) for the server"},
{"type": "pattern", "glob": "src/app/{models,interfaces}/**", "count": 4}]},
{"id": "layer:infrastructure", "claim": "Infrastructure holds the technical plumbing modules (database, redis, config, cookie, options) and the Google/local auth adapters.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 11, "quote": "This project is written using [NestJS](https://docs.nestjs.com) for the server"},
{"type": "pattern", "glob": "src/app/{database,redis,config,cookie,options}/**", "count": 30}]},
{"id": "layer:application", "claim": "Application holds the feature services and the DTO/model classes in each feature's models folder.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 11, "quote": "This project is written using [NestJS](https://docs.nestjs.com) for the server"},
{"type": "pattern", "glob": "src/app/*/models/**", "count": 17}]},
{"id": "layer:presentation", "claim": "Presentation holds controllers, modules and guards, which sit next to the services in each feature folder.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 11, "quote": "This project is written using [NestJS](https://docs.nestjs.com) for the server"},
{"type": "pattern", "glob": "src/app/**/*.controller.ts", "count": 6}]},
{"id": "order", "claim": "The preset's NestJS order is kept: presentation calls application, application calls infrastructure, and domain is innermost.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 11, "quote": "This project is written using [NestJS](https://docs.nestjs.com) for the server"},
{"type": "pattern", "glob": "src/app/**/*.service.ts", "count": 12}]}
]}
```