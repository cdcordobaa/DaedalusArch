```yaml
architecture:
  style: nestjs
  layers:
    - name: domain
      kind: domain
      directories:
        - src/app/**/models/**
        - src/app/interfaces/**
      roles: [entity, value-object]
    - name: infrastructure
      kind: infrastructure
      directories:
        - src/app/database/**
        - src/app/redis/**
        - src/app/config/**
        - src/app/cookie/**
        - src/app/options/**
      file_patterns:
        - "**/*.repository.ts"
        - "**/google/**"
        - "**/local/**"
      roles: [repository-impl, external-service]
    - name: application
      kind: application
      file_patterns:
        - "src/app/**/*.service.ts"
      roles: [application-service]
    - name: presentation
      kind: presentation
      file_patterns:
        - "src/app/**/*.controller.ts"
        - "src/app/**/*.module.ts"
        - "src/app/**/*.guard.ts"
      roles: [controller, module, guard]
      decorators: ["@Controller", "@Module"]
```

```json
{"units": [
{"id":"layer:domain","claim":"Model/DTO and interface folders hold the data shapes and form the innermost layer.","origin":"proposed","citations":[{"type":"doc","file":"README.md","line":11,"quote":"This project is written using [NestJS](https://docs.nestjs.com) for the server"},{"type":"pattern","glob":"src/app/**/models/**","count":25}]},
{"id":"layer:infrastructure","claim":"Database, redis, config, cookie and options modules are inner technical plumbing that services call.","origin":"proposed","citations":[{"type":"doc","file":"README.md","line":11,"quote":"This project is written using [NestJS](https://docs.nestjs.com) for the server"},{"type":"pattern","glob":"src/app/database/**","count":10}]},
{"id":"layer:application","claim":"Feature services (*.service.ts) hold the application logic.","origin":"proposed","citations":[{"type":"doc","file":"README.md","line":11,"quote":"This project is written using [NestJS](https://docs.nestjs.com) for the server"},{"type":"pattern","glob":"src/app/**/*.service.ts","count":12}]},
{"id":"layer:presentation","claim":"Controllers, guards and Nest modules form the outer HTTP/wiring layer.","origin":"proposed","citations":[{"type":"doc","file":"README.md","line":11,"quote":"This project is written using [NestJS](https://docs.nestjs.com) for the server"},{"type":"pattern","glob":"src/app/**/*.controller.ts","count":6}]},
{"id":"order","claim":"Order follows the NestJS preset: domain, infrastructure, application, presentation (controller → service → data access).","origin":"proposed","citations":[{"type":"doc","file":"README.md","line":11,"quote":"This project is written using [NestJS](https://docs.nestjs.com) for the server"},{"type":"pattern","glob":"src/app/**/*.module.ts","count":14}]}
]}
```