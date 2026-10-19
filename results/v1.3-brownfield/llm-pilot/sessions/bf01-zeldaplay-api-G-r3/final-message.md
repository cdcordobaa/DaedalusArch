```yaml
architecture:
  style: nestjs
  layers:
    - name: infrastructure
      directories:
        - src/app/database/**
        - src/app/redis/**
        - src/app/config/**
        - src/app/options/**
      roles:
        - repository-impl
        - external-service
        - middleware
    - name: application
      directories:
        - src/app/**/models/**
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
{"id": "layer:infrastructure", "claim": "The database, redis, config and options folders hold the technical plumbing (DB provider, Redis client, env config) that services consume.", "origin": "proposed", "citations": [{"type": "pattern", "glob": "src/app/{database,redis,config,options}/**", "count": 27}]},
{"id": "layer:application", "claim": "Feature services and the DTO/model files under models folders carry the application logic and data shapes.", "origin": "proposed", "citations": [{"type": "pattern", "glob": "**/*.service.ts", "count": 12}, {"type": "pattern", "glob": "src/app/**/models/**", "count": 25}]},
{"id": "layer:presentation", "claim": "Controllers, Nest modules and guards form the outer transport and wiring layer.", "origin": "proposed", "citations": [{"type": "pattern", "glob": "**/*.controller.ts", "count": 6}, {"type": "pattern", "glob": "**/*.module.ts", "count": 14}, {"type": "pattern", "glob": "src/app/guards/**", "count": 2}]},
{"id": "order", "claim": "The preset order (infrastructure → application → presentation) holds: controllers call services, and services call the database, redis and config plumbing.", "origin": "proposed", "citations": [{"type": "pattern", "glob": "**/*.controller.ts", "count": 6}, {"type": "pattern", "glob": "**/*.service.ts", "count": 12}]}
]}
```