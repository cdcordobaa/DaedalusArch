# Business Rules — Unit 1: Shared Domain

## 1. Violation Taxonomy

### 1.1 Built-in Violation Types (12 types across 7 dimensions)

| ViolationType | Dimension | Default Severity | Detected By |
|---------------|-----------|-----------------|-------------|
| `LAYER_VIOLATION` | structural | critical | symbolic (Cypher) |
| `CYCLIC_DEPENDENCY` | structural | critical | symbolic (APOC) |
| `FAN_OUT_EXCEEDED` | coupling | major | symbolic (Cypher) |
| `INSTABILITY_VIOLATION` | coupling | major | symbolic (Cypher) |
| `PATTERN_MISMATCH` | pattern | major | symbolic (Cypher) |
| `MISSING_PATTERN_ELEMENT` | pattern | major | symbolic (Cypher) |
| `SRP_VIOLATION` | solid | major | neuronal (LLM) |
| `DIP_VIOLATION` | solid | major | hybrid (Cypher + LLM) |
| `NAMING_CONVENTION` | convention | minor | symbolic (Cypher) |
| `PLACEMENT_CONVENTION` | convention | minor | symbolic (Cypher) |
| `SEMANTIC_RULE_VIOLATION` | semantic | major | neuronal (LLM) |
| `INTENT_VIOLATION` | intent | major | neuronal (LLM) |

### 1.2 Custom Violation Types (US-6.2)
- Custom types must be declared in AoC YAML under `custom_violation_types:`
- Must follow format: `CUSTOM_<SCREAMING_SNAKE_CASE>`
- Custom types are validated at spec parse time
- Custom types are scoped to the spec that declares them

### 1.3 Violation Severity → Verdict Override Rule
If any `critical`-severity violation is detected, the overall verdict is immediately `hard-block`, regardless of AHS score.

---

## 2. Scoring Weight Rules

### 2.1 Weight Sum Constraint
`structural + coupling + pattern + solid + convention + semantic + intent = 1.0`
If weights don't sum to 1.0 (within ±0.001 floating point tolerance), the Spec Parser must return an error.

### 2.2 Default Weights (clean-architecture template)

**Symbolic-only mode** (empirically validated by spike across 5 ground-truth projects):
```yaml
structural: 0.35   # highest — layer violations are most critical
coupling:   0.20
pattern:    0.30   # second highest — DI and domain purity are architectural pillars
solid:      0.10
convention: 0.05
# Total: 1.00
```

**Full evaluation mode** (symbolic + neuronal — semantic/intent added, others proportionally reduced):
```yaml
structural: 0.32
coupling:   0.18
pattern:    0.27
solid:      0.10
convention: 0.05
semantic:   0.04
intent:     0.04
# Total: 1.00
```

> ⚠️ Note: Spike validation only covered 5 symbolic dimensions. Full-mode weights are estimated proportional reductions pending neuronal path validation.

---

## 3. Confidence Calibration Rules (for Neuronal Results)

### 3.1 Default Thresholds
```
high   ≥ 0.85 → result weight: 1.0 (full weight in scoring)
medium ≥ 0.60 → result weight: 0.7 (partial downweighting)
low    < 0.60 → result weight: 0.3 (heavily downweighted)
```

### 3.2 ICC Stability Rule
If a function's ICC (across 3-5 runs) < 0.70:
- Flag the function as `flaggedUnstable: true`
- Apply additional 0.5× weight multiplier on top of confidence calibration
- Include stability warning in the report

---

## 4. AoC Spec Schema Versioning Rules

### 4.1 Version Format
`spec_version` must follow SemVer (`MAJOR.MINOR.PATCH`).

### 4.2 Compatibility Handshake
- Engine version: `1.x.x`
- Compatible spec versions: same MAJOR version
- On mismatch: Spec Parser returns a critical error with upgrade instructions

### 4.3 Version in Spec
```yaml
spec_version: "1.0.0"
```
This field is required. Missing `spec_version` is a parse error.

---

## 5. AoC YAML Layer Annotation Priority Rules

The Neo4j Ingestion layer annotation follows a **directory > naming > decorator** priority:

1. **Directory match** (highest priority): If file is in a directory listed for layer X, assign layer X
2. **Naming match** (second priority): If file matches a naming glob for layer X, assign layer X
3. **Decorator match** (third priority): If class has a decorator listed for layer X, assign layer X
4. **No match** (fallback): `layer: null`, `role: null` — file is unmapped, warning added

If a file matches multiple layers at the same priority level, this is a configuration error — Spec Parser must warn.

---

## 6. Built-in Clean Architecture Template — 17 Symbolic + 3 Neuronal

### 6.1 Symbolic Fitness Functions (deterministic, Cypher-executed)

**Legend**: ✅ spike-validated (100% detection proven) | 🔲 designed, pending integration test confirmation

| ID | Name | Dimension | Severity | Threshold | Validated | Description |
|----|------|-----------|----------|-----------|-----------|-------------|
| FF-S01 | dependency-direction | structural | critical | 0 | ✅ | Layer direction: domain ← application ← infrastructure |
| FF-S02 | no-cyclic-deps | structural | critical | 0 | ✅ | No cyclic dependencies (APOC) |
| FF-S03 | no-layer-skip | structural | critical | 0 | 🔲 | No layer skipping (controller cannot call repository directly, bypassing application) |
| FF-S04 | no-domain-outward-dep | structural | major | 0 | 🔲 | Domain has zero outgoing deps (stricter sub-case of FF-S01, high signal) |
| FF-P01 | domain-purity | pattern | critical | 0 | ✅ | Domain must not import framework libs (@nestjs, typeorm, express, prisma, sequelize) |
| FF-P02 | dependency-inversion | pattern | critical | 0.85 | ✅ | ≥ 85% of DI injections go through interfaces, not concrete classes |
| FF-P03 | repository-pattern | pattern | critical | 0 | ✅ | Repository impls must implement an interface |
| FF-P04 | use-case-isolation | pattern | major | 0 | ✅ | Use cases must not import infrastructure directly |
| FF-P05 | controller-no-entity | pattern | major | 0 | 🔲 | Controllers must not instantiate domain entities directly |
| FF-C01 | domain-stability | coupling | major | 0.3 | ✅ | Domain instability (fan-out / (fan-in + fan-out)) ≤ 0.3 |
| FF-C02 | module-fan-out | coupling | major | 10 | ✅ | File outgoing dependency count ≤ 10 |
| FF-C03 | component-instability | coupling | major | — | ✅ | High-fan-out components must not be depended on by stable components |
| FF-C04 | no-orphan-files | coupling | minor | 0 | 🔲 | No files with fan-in = 0 (unreachable dead code) |
| FF-C05 | max-fan-in | coupling | minor | 15 | 🔲 | File incoming dependency count ≤ 15 (too-depended-on = hidden fragility) |
| FF-C06 | abstraction-ratio | coupling | advisory | 0.3 | 🔲 | Interface count / total class count ≥ 0.3 (Martin's abstractness metric) |
| FF-SO01 | single-responsibility-proxy | solid | major | methods ≤ 10, deps ≤ 5 | ✅ | SRP proxy: public method count + dependency count as structural heuristic |
| FF-SO02 | interface-segregation-proxy | solid | major | methods ≤ 5 | ✅ | ISP proxy: interface method count ≤ 5 |
| FF-SO03 | inheritance-depth | solid | minor | depth ≤ 3 | 🔲 | EXTENDS chain depth ≤ 3 (deep hierarchies = brittle coupling) |
| FF-CV01 | naming-conventions | convention | minor | 0 | ✅ | Generic naming check (spike-level) |
| FF-CV02 | naming-services | convention | minor | 0 | 🔲 | Service classes must end in `Service` |
| FF-CV03 | naming-repos | convention | minor | 0 | 🔲 | Repository classes must end in `Repository` or `Repo` |
| FF-CV04 | naming-controllers | convention | minor | 0 | 🔲 | Controller classes must end in `Controller` |
| FF-CV05 | test-file-pairing | convention | advisory | — | 🔲 | Every `Foo.ts` should have a corresponding `Foo.spec.ts` (what dropped clean-ref from 1.0 to 0.85 in spike) |
| FF-CV06 | no-index-logic | convention | advisory | 0 | 🔲 | Barrel/index files must only re-export, not contain business logic |

### 6.2 Neuronal Fitness Functions (stochastic, LLM-evaluated)

| ID | Name | Dimension | Severity | Route | Description |
|----|------|-----------|----------|-------|-------------|
| FF-N01 | srp-semantic | solid | major | hybrid | SRP: Cypher counts methods/deps; LLM judges whether responsibilities are cohesive |
| FF-N02 | layering-intent | intent | major | neuronal | Code respects documented architectural intent — LLM checks reasoning, not just structure |

### 6.3 Template Resolution Rule
When `style: clean-architecture` is present in an AoC YAML spec:
- The 17 symbolic + 3 neuronal functions above are injected automatically
- Any functions declared in Layer B of the YAML are **appended** (not replaced)
- Layer A (layer model) is still required — the template needs layer definitions to compile
- Layer C weights can override defaults

---

## 7. FirewallContext Invariants (Business Rules)

| Rule | Enforcement |
|------|-------------|
| Each setter can only be called once | Typed setter throws `Error` on second call |
| Getters require prerequisite stage completion | Getter throws descriptive `Error` if undefined |
| Warnings accumulate, never cleared | `_warnings` array only grows |
| Audit log append-only | `_auditLog` array only grows |
| RunId is immutable after construction | `readonly` field, no setter |

---

## 8. Validation Set Acceptance Criteria (US-17.x)

| Criterion | Rule |
|-----------|------|
| Clean-ref AHS | `ahs_deterministic >= 0.90` when run with symbolic-only mode |
| Clean-ref violations | `violations.length === 0` |
| Violated-ref manifest coverage | Every violation in MANIFEST.md is detected |
| Violated-ref false negatives | Semantic/intent violations are NOT detected in `--symbolic-only` mode |
| Violated-ref AHS | `ahs_deterministic < 0.90` |
| MANIFEST.md format | Each row contains: type, filePath, functionId, dimension, route, severity |
