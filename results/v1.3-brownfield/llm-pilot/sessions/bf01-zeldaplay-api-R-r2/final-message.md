```yaml
architecture:
  style: nestjs
  layers:
    - name: infrastructure
      directories:
        - src/app/database/**
        - src/app/redis/**
      file_patterns:
        - "**/*.repository.ts"
      roles:
        - repository-impl
        - external-service
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
{"id": "layer:infrastructure", "claim": "The database and redis folders hold the data-access and external-store infrastructure.", "origin": "proposed", "citations": [{"type": "pattern", "glob": "src/app/database/**", "count": 10}, {"type": "pattern", "glob": "src/app/redis/**", "count": 5}]},
{"id": "layer:application", "claim": "Services and the per-feature models/DTO folders form the application layer.", "origin": "proposed", "citations": [{"type": "pattern", "glob": "src/**/*.service.ts", "count": 12}, {"type": "pattern", "glob": "src/**/models/**", "count": 25}]},
{"id": "layer:presentation", "claim": "Controllers, Nest modules and guards form the outer presentation and wiring layer.", "origin": "proposed", "citations": [{"type": "pattern", "glob": "src/**/*.controller.ts", "count": 6}, {"type": "pattern", "glob": "src/**/*.module.ts", "count": 14}, {"type": "pattern", "glob": "src/**/*.guard.ts", "count": 1}]},
{"id": "order", "claim": "The preset order is kept: infrastructure is inner, then application, then presentation, following the Controller to Service to data-access flow.", "origin": "proposed", "citations": [{"type": "pattern", "glob": "src/**/*.controller.ts", "count": 6}, {"type": "pattern", "glob": "src/**/*.service.ts", "count": 12}]}
]}
```