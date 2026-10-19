```yaml
architecture:
  style: nestjs
  layers:
    - name: domain
      directories:
        - src/app/**/models/**
      roles:
        - entity
        - value-object
    - name: infrastructure
      directories:
        - src/app/database/**
        - src/app/redis/**
        - src/app/config/**
        - src/app/options/**
      file_patterns:
        - "**/*.repository.ts"
      roles:
        - repository-impl
        - external-service
    - name: application
      file_patterns:
        - "**/*.service.ts"
        - "**/*.dto.ts"
      roles:
        - application-service
        - dto
    - name: presentation
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
{"id": "layer:domain", "claim": "Per-feature models folders hold the data shapes (GraphQL models, payloads, DTO types) and form the innermost layer.", "origin": "proposed", "citations": [{"type": "pattern", "glob": "src/app/**/models/**", "count": 25}]},
{"id": "layer:infrastructure", "claim": "Database, Redis, config and options folders hold the technical data-access and configuration plumbing.", "origin": "proposed", "citations": [{"type": "pattern", "glob": "src/app/database/**", "count": 10}, {"type": "pattern", "glob": "src/app/redis/**", "count": 5}, {"type": "pattern", "glob": "src/app/config/**", "count": 6}, {"type": "pattern", "glob": "src/app/options/**", "count": 6}]},
{"id": "layer:application", "claim": "Feature services (*.service.ts) carry the application logic.", "origin": "proposed", "citations": [{"type": "pattern", "glob": "src/app/**/*.service.ts", "count": 12}]},
{"id": "layer:presentation", "claim": "Controllers, modules and guards form the outer, transport and wiring layer.", "origin": "proposed", "citations": [{"type": "pattern", "glob": "src/app/**/*.controller.ts", "count": 6}, {"type": "pattern", "glob": "src/app/**/*.module.ts", "count": 14}]},
{"id": "order", "claim": "The preset's order (domain, infrastructure, application, presentation) fits the NestJS flow of controllers calling services, which call data access and models.", "origin": "proposed", "citations": [{"type": "pattern", "glob": "src/app/**/*.controller.ts", "count": 6}, {"type": "pattern", "glob": "src/app/**/*.service.ts", "count": 12}]}
]}
```