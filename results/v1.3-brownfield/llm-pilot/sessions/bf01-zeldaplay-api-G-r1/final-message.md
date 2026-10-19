The repository has no layer folders. It is organised as feature modules under `src/app`, so I classified files by suffix and put the two data-access folders (`database`, `redis`) in infrastructure. I left the preset's fitness functions and excludes unchanged. I didn't read any file contents, and I didn't check the DTO globs I put in the application layer (`**/models/*.dto.ts`, `**/models/*.graphql.ts`) against the repository, so those two have no pattern citation.

```yaml
architecture:
  style: nestjs
  layers:
    - name: infrastructure
      directories:
        - src/app/database/**
        - src/app/redis/**
      roles:
        - repository-impl
        - external-service
    - name: application
      file_patterns:
        - "**/*.service.ts"
        - "**/models/*.dto.ts"
        - "**/models/*.graphql.ts"
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
{"id": "layer:infrastructure", "claim": "The database and redis folders hold the data-access and connection code that services call into.", "origin": "proposed", "citations": [{"type": "pattern", "glob": "src/app/database/**", "count": 10}, {"type": "pattern", "glob": "src/app/redis/**", "count": 5}]},
{"id": "layer:application", "claim": "Business logic lives in *.service.ts files co-located in feature modules.", "origin": "proposed", "citations": [{"type": "pattern", "glob": "**/*.service.ts", "count": 12}]},
{"id": "layer:presentation", "claim": "Controllers, Nest modules and guards form the outer transport and wiring layer.", "origin": "proposed", "citations": [{"type": "pattern", "glob": "**/*.controller.ts", "count": 6}, {"type": "pattern", "glob": "**/*.module.ts", "count": 14}, {"type": "pattern", "glob": "src/app/guards/**", "count": 2}]},
{"id": "order", "claim": "Dependencies flow from presentation (controllers) to application (services) to infrastructure (database, redis), as in the NestJS preset.", "origin": "proposed", "citations": [{"type": "pattern", "glob": "**/*.controller.ts", "count": 6}, {"type": "pattern", "glob": "**/*.service.ts", "count": 12}]}
]}
```