Stub derivation.

```yaml
architecture:
  style: clean-architecture
  layers:
    - name: domain
      directories:
        - src/domain/**
      roles:
        - entity
        - value-object
        - domain-service
        - repository-interface
    - name: application
      directories:
        - src/application/**
      roles:
        - use-case
        - dto
        - application-service
    - name: infrastructure
      directories:
        - src/infrastructure/**
      roles:
        - repository-impl
        - controller
        - middleware
        - orm-entity
```

```json
{"units":[{"id":"layer:domain","claim":"stub","origin":"proposed","citations":[{"type":"doc","file":"README.md","line":1,"quote":"**Disclaimer:** this API may change a lo"},{"type":"pattern","glob":"src/**","count":177},{"type":"stat","query":"MATCH (a:File)-[:IMPORTS]->(b:File) RETURN count(*) AS numerator, count(DISTINCT a) AS denominator","numerator":331,"denominator":96}]},{"id":"layer:application","claim":"stub","origin":"proposed","citations":[{"type":"doc","file":"README.md","line":1,"quote":"**Disclaimer:** this API may change a lo"},{"type":"pattern","glob":"src/**","count":177},{"type":"stat","query":"MATCH (a:File)-[:IMPORTS]->(b:File) RETURN count(*) AS numerator, count(DISTINCT a) AS denominator","numerator":331,"denominator":96}]},{"id":"layer:infrastructure","claim":"stub","origin":"proposed","citations":[{"type":"doc","file":"README.md","line":1,"quote":"**Disclaimer:** this API may change a lo"},{"type":"pattern","glob":"src/**","count":177},{"type":"stat","query":"MATCH (a:File)-[:IMPORTS]->(b:File) RETURN count(*) AS numerator, count(DISTINCT a) AS denominator","numerator":331,"denominator":96}]},{"id":"order","claim":"stub","origin":"proposed","citations":[{"type":"doc","file":"README.md","line":1,"quote":"certainly-not-on-line-1 \u0000"}]}]}
```
