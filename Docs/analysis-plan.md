# Analysis plan — v1.2E evaluation (SO1–SO5)

> **Status: DRAFT until Step 32** (U5b Code Generation, Step 14, 2026-10-08). This draft holds only the SO5 code
> tables as a fenced machine block. The full analysis plan (outcomes, factors, tests, intervals, exclusions, the
> registered plans) is written in Step 31 and registered with `corpus/prereg.json` version 1 in Step 32, before the
> first E1 run (BR-U5b-50, 51, 64; OI-6). Requirements: FR-v1.2E-36, SO5 (ADR-017 item 2); rules BR-U5b-30, 64, 65.

## 1. SO5 code tables (frozen at registration)

Two closed code sets describe E1 outcomes. They are disjoint from each other and from the instrument root-cause
codes `RC-*` of `Docs/matching-rule.md` (BR-U5b-30).

**Failure-pattern families (`FPAT-*`)**. Every compiled template id maps to exactly one family; the two judge
dimensions map to their own family. Families are counted per E1 cell on violations labelled `TP` (weight 1) and
`unseeded-TP` (weighted by the inverse of their P3 inclusion probability), and on failing judge units, by
dimension. No labeller assigns a pattern code; the family is a function of the function id only (BR-U5b-64).

| Family | Meaning | Templates / judge dimension |
|---|---|---|
| `FPAT-DEP-DIRECTION` | a dependency points against the layer model | `dependency-direction`, `no-layer-skip`, `no-domain-outward-dep` |
| `FPAT-FRAMEWORK-LEAK` | framework or outer-layer types inside the domain or exposed by controllers | `domain-purity`, `controller-no-entity` |
| `FPAT-CYCLE` | an import cycle | `no-cyclic-deps` |
| `FPAT-COUPLING` | coupling and stability metrics out of bounds | `domain-stability`, `module-fan-out`, `component-instability`, `max-fan-in`, `abstraction-ratio`, `no-orphan-files` |
| `FPAT-SOLID` | SOLID proxies (inversion, responsibility, segregation, inheritance) | `dependency-inversion`, `single-responsibility-proxy`, `interface-segregation-proxy`, `inheritance-depth` |
| `FPAT-NAMING` | naming conventions of the layer roles | `naming-conventions`, `naming-services`, `naming-repos`, `naming-controllers` |
| `FPAT-PATTERN` | pattern and convention structure (repositories, use cases, tests, barrels) | `repository-pattern`, `use-case-isolation`, `test-file-pairing`, `no-index-logic` |
| `FPAT-DATAFLOW` | domain state reached by an outer-layer data flow | `domain-state-purity` |
| `FPAT-SEMANTIC` | failing Semantic judge units | judge dimension `semantic` |
| `FPAT-INTEGRITY` | failing Integrity judge units | judge dimension `integrity` |

**Generation-outcome codes (`GEN-*`)**. Each U5a `failureReason` (BR-U5a-48) maps to exactly one code; a cell with
`status = 'ok'` carries none. File range and permission denials are flag columns on every cell
(`file_count`, `file_count_in_range`, `permission_denials`), not codes; an `ok` cell out of range is evaluated and
flagged.

| `failureReason` | Code |
|---|---|
| `typecheck` | `GEN-TYPECHECK` |
| `agent-error` | `GEN-AGENT-ERROR` |
| `model-mismatch` | `GEN-MODEL-MISMATCH` |
| `skeleton-tampered` | `GEN-SKELETON-TAMPERED` |
| `infrastructure` | `GEN-INFRA` |
| `envelope-unreadable` | `GEN-ENVELOPE-UNREADABLE` |
| `timeout` | `GEN-TIMEOUT` |

The block below is the machine-readable form that `scripts/lib/so5-codes.ts` loads. The tables above and the
block are equal (tested); the GEN mapping and the FPAT counting of `scripts/aggregate.ts` read only the block.

```yaml so5-codes
version: 1.0.0
fpatFamilies:
  - FPAT-DEP-DIRECTION
  - FPAT-FRAMEWORK-LEAK
  - FPAT-CYCLE
  - FPAT-COUPLING
  - FPAT-SOLID
  - FPAT-NAMING
  - FPAT-PATTERN
  - FPAT-DATAFLOW
  - FPAT-SEMANTIC
  - FPAT-INTEGRITY
functionFamilies:
  dependency-direction: FPAT-DEP-DIRECTION
  no-layer-skip: FPAT-DEP-DIRECTION
  no-domain-outward-dep: FPAT-DEP-DIRECTION
  domain-purity: FPAT-FRAMEWORK-LEAK
  controller-no-entity: FPAT-FRAMEWORK-LEAK
  no-cyclic-deps: FPAT-CYCLE
  domain-stability: FPAT-COUPLING
  module-fan-out: FPAT-COUPLING
  component-instability: FPAT-COUPLING
  max-fan-in: FPAT-COUPLING
  abstraction-ratio: FPAT-COUPLING
  no-orphan-files: FPAT-COUPLING
  dependency-inversion: FPAT-SOLID
  single-responsibility-proxy: FPAT-SOLID
  interface-segregation-proxy: FPAT-SOLID
  inheritance-depth: FPAT-SOLID
  naming-conventions: FPAT-NAMING
  naming-services: FPAT-NAMING
  naming-repos: FPAT-NAMING
  naming-controllers: FPAT-NAMING
  repository-pattern: FPAT-PATTERN
  use-case-isolation: FPAT-PATTERN
  test-file-pairing: FPAT-PATTERN
  no-index-logic: FPAT-PATTERN
  domain-state-purity: FPAT-DATAFLOW
judgeDimensions:
  semantic: FPAT-SEMANTIC
  integrity: FPAT-INTEGRITY
genCodes:
  typecheck: GEN-TYPECHECK
  agent-error: GEN-AGENT-ERROR
  model-mismatch: GEN-MODEL-MISMATCH
  skeleton-tampered: GEN-SKELETON-TAMPERED
  infrastructure: GEN-INFRA
  envelope-unreadable: GEN-ENVELOPE-UNREADABLE
  timeout: GEN-TIMEOUT
```
