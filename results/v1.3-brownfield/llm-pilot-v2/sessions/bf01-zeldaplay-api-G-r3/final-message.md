```yaml
architecture:
  style: nestjs
  layers:
    - name: domain
      kind: domain
      directories:
        - "src/app/**/models/**"
      roles:
        - entity
        - value-object
    - name: infrastructure
      kind: infrastructure
      directories:
        - src/app/database/**
        - src/app/redis/**
        - src/app/cookie/**
        - src/app/config/**
        - src/app/options/**
        - src/app/auth/google/**
        - src/app/auth/local/**
      file_patterns:
        - "**/*.repository.ts"
        - "**/strategies/**"
      roles:
        - repository-impl
        - external-service
    - name: application
      kind: application
      file_patterns:
        - "**/*.service.ts"
        - "**/*.dto.ts"
      roles:
        - application-service
        - dto
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
{"id":"layer:domain","claim":"Domain holds the per-feature models/ folders (DTO and GraphQL model classes); no model file imports any non-model, non-validator file, and validators stay outside every layer as a cross-cutting helper.","origin":"proposed","citations":[
{"type":"doc","file":"README.md","line":11,"quote":"This project is written using [NestJS](https://docs.nestjs.com) for the server and [Angular](https://angular.io) as the front end service while using [Nx](https://nx.dev) as a tool for development."},
{"type":"pattern","glob":"src/app/**/models/**","count":24},
{"type":"stat","query":"MATCH (a:File)-[:IMPORTS]->(b:File) WHERE a.filePath CONTAINS '/models/' AND NOT b.filePath CONTAINS '/models/' AND NOT b.filePath CONTAINS '/validators/' RETURN count(*) AS numerator, count(DISTINCT a) AS denominator","numerator":0,"denominator":0}]},
{"id":"layer:infrastructure","claim":"Infrastructure is the data-access, cache, cookie, configuration and external-provider (google/local auth) modules that services call directly, following the NestJS preset's inner data-access layer.","origin":"proposed","citations":[
{"type":"doc","file":"README.md","line":11,"quote":"This project is written using [NestJS](https://docs.nestjs.com) for the server and [Angular](https://angular.io) as the front end service while using [Nx](https://nx.dev) as a tool for development."},
{"type":"pattern","glob":"src/app/database/**","count":10},
{"type":"pattern","glob":"src/app/redis/**","count":5},
{"type":"stat","query":"MATCH (a:File)-[:IMPORTS]->(b:File) WHERE (a.filePath ENDS WITH '.service.ts') AND (b.filePath STARTS WITH 'src/app/database/' OR b.filePath STARTS WITH 'src/app/redis/' OR b.filePath STARTS WITH 'src/app/config/' OR b.filePath STARTS WITH 'src/app/cookie/') RETURN count(*) AS numerator, count(DISTINCT a) AS denominator","numerator":16,"denominator":8}]},
{"id":"layer:application","claim":"Application is the feature services and DTOs, assigned by file name since services are co-located with their controllers.","origin":"proposed","citations":[
{"type":"doc","file":"README.md","line":11,"quote":"This project is written using [NestJS](https://docs.nestjs.com) for the server and [Angular](https://angular.io) as the front end service while using [Nx](https://nx.dev) as a tool for development."},
{"type":"pattern","glob":"**/*.service.ts","count":12},
{"type":"stat","query":"MATCH (a:File)-[:IMPORTS]->(b:File) WHERE a.filePath ENDS WITH '.controller.ts' AND b.filePath ENDS WITH '.service.ts' RETURN count(*) AS numerator, count(DISTINCT a) AS denominator","numerator":6,"denominator":6}]},
{"id":"layer:presentation","claim":"Presentation is the controllers, guards and Nest modules (DI wiring) that sit outermost and call services.","origin":"proposed","citations":[
{"type":"doc","file":"README.md","line":11,"quote":"This project is written using [NestJS](https://docs.nestjs.com) for the server and [Angular](https://angular.io) as the front end service while using [Nx](https://nx.dev) as a tool for development."},
{"type":"pattern","glob":"**/*.controller.ts","count":6},
{"type":"pattern","glob":"**/*.module.ts","count":14},
{"type":"stat","query":"MATCH (a:File)-[:IMPORTS]->(b:File) WHERE a.filePath ENDS WITH '.service.ts' AND b.filePath ENDS WITH '.controller.ts' RETURN count(*) AS numerator, count(DISTINCT a) AS denominator","numerator":0,"denominator":0}]},
{"id":"order","claim":"Order is domain, infrastructure, application, presentation (inner to outer): 16 service-to-infrastructure edges and 6 controller-to-service edges follow it, while 4 edges from infrastructure folders to services or controllers violate it.","origin":"proposed","citations":[
{"type":"doc","file":"README.md","line":11,"quote":"This project is written using [NestJS](https://docs.nestjs.com) for the server and [Angular](https://angular.io) as the front end service while using [Nx](https://nx.dev) as a tool for development."},
{"type":"stat","query":"MATCH (a:File)-[:IMPORTS]->(b:File) WHERE (a.filePath STARTS WITH 'src/app/database/' OR a.filePath STARTS WITH 'src/app/redis/' OR a.filePath STARTS WITH 'src/app/cookie/') AND (b.filePath ENDS WITH '.service.ts' OR b.filePath ENDS WITH '.controller.ts') AND NOT b.filePath STARTS WITH a.filePath RETURN count(*) AS numerator, count(DISTINCT a) AS denominator","numerator":4,"denominator":4}]}
]}
```