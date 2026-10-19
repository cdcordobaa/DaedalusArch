Stub derivation.

```yaml
architecture:
  style: nestjs
  layers:
    - name: domain
      directories:
        - src/domain/**
        - src/core/**
        - src/entities/**
        - src/models/**
      roles:
        - entity
        - value-object
        - domain-service
        - repository-interface
    - name: infrastructure
      directories:
        - src/infrastructure/**
        - src/persistence/**
        - src/adapters/**
        - src/prisma/**
        - src/lib/**
        - src/common/middleware/**
        - src/common/filters/**
        - src/common/pipes/**
      file_patterns:
        - "**/*.repository.ts"
        - "**/*.worker.ts"
        - "**/workers/**"
        - "**/strategies/**"
      roles:
        - repository-impl
        - orm-entity
        - external-service
        - middleware
        - worker
    - name: application
      directories:
        - src/application/**
        - src/use-cases/**
        - src/services/**
      file_patterns:
        - "**/*.service.ts"
        - "**/*.processor.ts"
        - "**/dto/**"
        - "**/*.dto.ts"
      roles:
        - use-case
        - dto
        - application-service
        - processor
    - name: presentation
      directories:
        - src/controllers/**
        - src/gateways/**
        - src/common/guards/**
        - src/common/interceptors/**
      file_patterns:
        - "**/*.controller.ts"
        - "**/*.module.ts"
        - "**/*.guard.ts"
        - "**/*.interceptor.ts"
        - "**/*.gateway.ts"
      roles:
        - controller
        - module
        - gateway
        - guard
        - interceptor
      decorators:
        - "@Controller"
        - "@Module"
```

```json
{"units":[{"id":"layer:domain","claim":"stub","origin":"proposed","citations":[{"type":"doc","file":"README.md","line":1,"quote":"# Tabletop Companion"},{"type":"pattern","glob":"src/**","count":102},{"type":"stat","query":"MATCH (a:File)-[:IMPORTS]->(b:File) RETURN count(*) AS numerator, count(DISTINCT a) AS denominator","numerator":200,"denominator":57}]},{"id":"layer:infrastructure","claim":"stub","origin":"proposed","citations":[{"type":"doc","file":"README.md","line":1,"quote":"# Tabletop Companion"},{"type":"pattern","glob":"src/**","count":102},{"type":"stat","query":"MATCH (a:File)-[:IMPORTS]->(b:File) RETURN count(*) AS numerator, count(DISTINCT a) AS denominator","numerator":200,"denominator":57}]},{"id":"layer:application","claim":"stub","origin":"proposed","citations":[{"type":"doc","file":"README.md","line":1,"quote":"# Tabletop Companion"},{"type":"pattern","glob":"src/**","count":102},{"type":"stat","query":"MATCH (a:File)-[:IMPORTS]->(b:File) RETURN count(*) AS numerator, count(DISTINCT a) AS denominator","numerator":200,"denominator":57}]},{"id":"layer:presentation","claim":"stub","origin":"proposed","citations":[{"type":"doc","file":"README.md","line":1,"quote":"# Tabletop Companion"},{"type":"pattern","glob":"src/**","count":102},{"type":"stat","query":"MATCH (a:File)-[:IMPORTS]->(b:File) RETURN count(*) AS numerator, count(DISTINCT a) AS denominator","numerator":200,"denominator":57}]},{"id":"order","claim":"stub","origin":"proposed","citations":[{"type":"doc","file":"README.md","line":1,"quote":"certainly-not-on-line-1 \u0000"}]}]}
```
