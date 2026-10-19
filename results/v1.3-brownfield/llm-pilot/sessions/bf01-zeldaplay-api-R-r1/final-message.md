```yaml
architecture:
  style: nestjs
  layers:
    - name: infrastructure
      directories:
        - src/app/database/**
        - src/app/redis/**
      roles:
        - external-service
        - repository-impl
    - name: application
      directories:
        - src/app/models/**
        - src/app/**/models/**
      file_patterns:
        - "**/*.service.ts"
        - "**/*.dto.ts"
      roles:
        - application-service
        - dto
    - name: presentation
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
{"id": "layer:infrastructure", "claim": "The database and redis folders hold the data-access and external-service wiring that application services call.", "origin": "proposed", "citations": [{"type": "pattern", "glob": "src/app/{database,redis}/**", "count": 15}]},
{"id": "layer:application", "claim": "Services and the per-feature models folders (DTOs and GraphQL types) form the application layer.", "origin": "proposed", "citations": [{"type": "pattern", "glob": "src/app/**/*.service.ts", "count": 12}, {"type": "pattern", "glob": "src/app/**/models/**", "count": 25}]},
{"id": "layer:presentation", "claim": "Controllers, modules and guards are the outermost presentation layer.", "origin": "proposed", "citations": [{"type": "pattern", "glob": "src/app/**/*.controller.ts", "count": 6}, {"type": "pattern", "glob": "src/app/**/*.module.ts", "count": 14}]},
{"id": "order", "claim": "The layer order is the preset's NestJS flow: infrastructure, then application, then presentation, with controllers calling services and services calling data access.", "origin": "proposed", "citations": [{"type": "pattern", "glob": "src/app/**/*.controller.ts", "count": 6}, {"type": "pattern", "glob": "src/app/**/*.service.ts", "count": 12}]}
]}
```