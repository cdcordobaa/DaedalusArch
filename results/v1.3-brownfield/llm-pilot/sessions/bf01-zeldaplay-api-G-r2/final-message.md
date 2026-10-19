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
{"id": "layer:infrastructure", "claim": "Database, Redis, config and options folders hold the infrastructure and data-access plumbing.", "origin": "proposed", "citations": [{"type": "pattern", "glob": "src/app/{database,redis,config,options}/**", "count": 27}]},
{"id": "layer:application", "claim": "Service and DTO files hold the application logic and its data shapes, co-located in feature folders.", "origin": "proposed", "citations": [{"type": "pattern", "glob": "**/*.{service,dto}.ts", "count": 20}]},
{"id": "layer:presentation", "claim": "Controllers, modules and guards form the outer transport and wiring layer.", "origin": "proposed", "citations": [{"type": "pattern", "glob": "**/*.{controller,module,guard}.ts", "count": 21}]},
{"id": "order", "claim": "Following the NestJS flow, controllers and modules (presentation) depend on services (application), which depend on infrastructure.", "origin": "proposed", "citations": [{"type": "pattern", "glob": "**/*.{controller,module,guard}.ts", "count": 21}]}
]}
```