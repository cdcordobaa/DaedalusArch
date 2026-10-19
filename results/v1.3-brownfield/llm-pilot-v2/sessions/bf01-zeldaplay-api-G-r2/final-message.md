```yaml
architecture:
  style: nestjs
  layers:
    - name: domain
      kind: domain
      directories:
        - src/app/**/models/**
        - src/app/interfaces/**
      roles:
        - entity
        - value-object
        - dto
      
    - name: infrastructure
      kind: infrastructure
      directories:
        - src/app/database/**
        - src/app/redis/**
        - src/app/cookie/**
        - src/app/config/**
        - src/app/options/**
      file_patterns:
        - "**/*.repository.ts"
        - "**/strategies/**"
      roles:
        - repository-impl
        - external-service
        - middleware
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
{"id": "layer:domain", "claim": "Domain holds the per-feature models folders (DTO/GraphQL types) and shared interfaces; the 11 files under models import non-models files in 25 edges (mostly the cross-cutting validators, which are left out of every layer).", "origin": "proposed", "citations": [
{"type": "pattern", "glob": "src/app/**/models/**", "count": 25},
{"type": "doc", "file": "README.md", "line": 11, "quote": "This project is written using [NestJS](https://docs.nestjs.com) for the server"},
{"type": "stat", "query": "MATCH (a:File)-[:IMPORTS]->(b:File) WHERE a.filePath CONTAINS '/models/' AND NOT b.filePath CONTAINS '/models/' RETURN count(*) AS numerator, count(DISTINCT a) AS denominator", "numerator": 25, "denominator": 11}]},
{"id": "layer:infrastructure", "claim": "Infrastructure is the inner data-access and technical-config layer (database, redis, cookie, config, options) that services call directly, per the NestJS preset; 16 import edges from 8 services/controllers go into these folders.", "origin": "proposed", "citations": [
{"type": "pattern", "glob": "src/app/database/**", "count": 10},
{"type": "pattern", "glob": "src/app/redis/**", "count": 5},
{"type": "doc", "file": "README.md", "line": 11, "quote": "This project is written using [NestJS](https://docs.nestjs.com) for the server"},
{"type": "stat", "query": "MATCH (a:File)-[:IMPORTS]->(b:File) WHERE (a.filePath =~ '.*\\.(service|controller)\\.ts') AND b.filePath =~ 'src/app/(database|redis|cookie|config)/.*' RETURN count(*) AS numerator, count(DISTINCT a) AS denominator", "numerator": 16, "denominator": 8}]},
{"id": "layer:application", "claim": "Application consists of the co-located *.service.ts feature services, which orchestrate the infrastructure layer; 16 edges from services/controllers go to infrastructure.", "origin": "proposed", "citations": [
{"type": "pattern", "glob": "**/*.service.ts", "count": 12},
{"type": "doc", "file": "README.md", "line": 11, "quote": "This project is written using [NestJS](https://docs.nestjs.com) for the server"},
{"type": "stat", "query": "MATCH (a:File)-[:IMPORTS]->(b:File) WHERE (a.filePath =~ '.*\\.(service|controller)\\.ts') AND b.filePath =~ 'src/app/(database|redis|cookie|config)/.*' RETURN count(*) AS numerator, count(DISTINCT a) AS denominator", "numerator": 16, "denominator": 8}]},
{"id": "layer:presentation", "claim": "Presentation holds controllers, Nest modules and guards, the outermost entry points of the API.", "origin": "proposed", "citations": [
{"type": "pattern", "glob": "**/*.controller.ts", "count": 6},
{"type": "doc", "file": "README.md", "line": 11, "quote": "This project is written using [NestJS](https://docs.nestjs.com) for the server"},
{"type": "stat", "query": "MATCH (a:File)-[:IMPORTS]->(b:File) WHERE (a.filePath =~ 'src/app/(database|redis|cookie|config|options)/.*') AND (b.filePath =~ '.*(controller|guard)\\.ts' OR b.filePath =~ '.*\\.service\\.ts') AND NOT b.filePath =~ 'src/app/(database|redis|cookie|config|options)/.*' RETURN count(*) AS numerator, count(DISTINCT a) AS denominator", "numerator": 0, "denominator": 0}]},
{"id": "order", "claim": "Order is domain, infrastructure, application, presentation (preset NestJS flow Controller to Service to data access); 16 service/controller edges follow it into infrastructure and 0 edges from infrastructure folders go back to services, controllers or guards.", "origin": "proposed", "citations": [
{"type": "doc", "file": "README.md", "line": 11, "quote": "This project is written using [NestJS](https://docs.nestjs.com) for the server"},
{"type": "pattern", "glob": "src/app/**/models/**", "count": 25},
{"type": "stat", "query": "MATCH (a:File)-[:IMPORTS]->(b:File) WHERE (a.filePath =~ '.*\\.(service|controller)\\.ts') AND b.filePath =~ 'src/app/(database|redis|cookie|config)/.*' RETURN count(*) AS numerator, count(DISTINCT a) AS denominator", "numerator": 16, "denominator": 8}]}
]}
```