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

> **Source**: Validated by spike against 5 ground-truth projects. 100% detection rate on seeded structural violations.

| ID | Name | Dimension | Severity | Threshold | Description |
|----|------|-----------|----------|-----------|-------------|
| FF-S01 | dependency-direction | structural | critical | 0 violations | Layer dependency direction: domain ← application ← infrastructure |
| FF-S02 | no-cyclic-deps | structural | critical | 0 violations | No cyclic dependencies (uses APOC apoc.path.expandConfig) |
| FF-P01 | domain-purity | pattern | critical | 0 violations | Domain layer must not import framework libs (@nestjs, typeorm, express, prisma, sequelize) |
| FF-P02 | dependency-inversion | pattern | critical | 0.85 | >= 85% of dependencies must go through interfaces, not concrete implementations |
| FF-P03 | repository-pattern | pattern | critical | 0 violations | Repository impls must depend on an interface (not concrete class) |
| FF-P04 | use-case-isolation | pattern | major | 0 violations | Use cases must not directly import infrastructure (controllers, ORM, etc.) |
| FF-C01 | domain-stability | coupling | major | 0.3 | Domain layer instability (fan-out / (fan-in + fan-out)) <= 0.3 |
| FF-C02 | module-fan-out | coupling | major | 10 | File outgoing dependency count <= 10 |
| FF-C03 | component-instability | coupling | major | — | Components with high fan-out must not be depended on by stable components |
| FF-SO01 | single-responsibility-proxy | solid | major | methods ≤ 10, deps ≤ 5 | SRP proxy: public method count and dependency count as heuristics |
| FF-SO02 | interface-segregation-proxy | solid | major | methods ≤ 5 | ISP proxy: interface method count as heuristic |
| FF-CV01 | naming-conventions | convention | minor | 0 violations | File/class names follow layer naming conventions |

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
