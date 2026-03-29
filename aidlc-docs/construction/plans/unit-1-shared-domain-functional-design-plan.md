# Functional Design Plan — Unit 1: Shared Domain + Validation Set

## Unit Context
- **Unit**: U1 — Shared Domain + Validation Set
- **Components**: C10 (Shared Domain), C11 (FirewallContext), FR-17 (Sample Projects)
- **Stories**: US-6.1, US-6.2, US-17.1, US-17.2, US-17.3, US-17.4
- **Dependencies**: None (foundation layer)

## Plan Checklist

- [ ] Step 1: Clarify unknowns via Q&A (4 targeted questions)
- [ ] Step 2: Generate `domain-entities.md` — all types, value objects, interfaces
- [ ] Step 3: Generate `business-logic-model.md` — DomainResult<T>, FirewallContext, pipeline contracts
- [ ] Step 4: Generate `business-rules.md` — violation taxonomy, validation rules, AoC YAML schema
- [ ] Step 5: Define fixture project structure (clean-ref, violated-ref) + MANIFEST schema
- [ ] Step 6: Define `specs/clean-arch.yaml` fitness function list

---

## Clarifying Questions

### Q1: Violation Taxonomy
The PRD and stories reference a "consolidated taxonomy" (US-6.1) and "custom violation types" (US-6.2) but the actual violation type names aren't enumerated in the design artifacts.

Please review this proposed taxonomy and correct/add/remove:

**Proposed built-in violation types (by dimension)**:
| Dimension | Violation Type | Description |
|-----------|---------------|-------------|
| Structural | `LAYER_VIOLATION` | Dependency crosses layer boundaries in wrong direction |
| Structural | `CYCLIC_DEPENDENCY` | Circular dependency detected (APOC) |
| Coupling | `FAN_OUT_EXCEEDED` | File has too many outgoing dependencies |
| Coupling | `INSTABILITY_VIOLATION` | Module instability > threshold |
| Pattern | `PATTERN_MISMATCH` | Class doesn't match its declared pattern role |
| Pattern | `MISSING_PATTERN_ELEMENT` | Required element of a pattern is absent |
| SOLID | `SRP_VIOLATION` | Single Responsibility Principle violation |
| SOLID | `DIP_VIOLATION` | Dependency Inversion Principle violation |
| Convention | `NAMING_CONVENTION` | File/class doesn't match naming convention |
| Convention | `PLACEMENT_CONVENTION` | File placed in wrong directory |
| Semantic | `SEMANTIC_RULE_VIOLATION` | LLM-detected semantic rule violation |
| Intent | `INTENT_VIOLATION` | LLM-detected intent/ADR violation |

[Answer]:

---

### Q2: Clean Reference Fixture Complexity
US-17.1 requires "2-3 clean reference projects with zero violations, AHS >= 0.90".

What level of complexity should the clean fixture projects demonstrate?

**A** — Minimal: ~5-10 TypeScript files per project with clear layered structure (Controller → Service → Repository → Entity), just enough to exercise all node/edge types. Fast to generate, easy to maintain.

**B** — Moderate: ~15-25 TypeScript files. Includes decorators, barrel imports, path aliases, DI container patterns — exercises complex import resolution from C1 and all 7 dimension checks.

**C** — Something specific: describe what you have in mind.

[Answer]:

---

### Q3: `clean-architecture` Template — Fitness Functions
US-4.2 says the spec parser resolves `style: clean-architecture` to **17 symbolic + N semantic fitness functions**. These are the "built-in" functions for the most common template.

Please review this proposed starter set and confirm/adjust:

**Proposed 17 symbolic functions (by dimension)**:
| ID | Name | Dimension | Severity | Description |
|----|------|-----------|----------|-------------|
| FF-S01 | no-layer-skip | structural | critical | No layer can be skipped (Controller cannot call Repository directly) |
| FF-S02 | no-upward-dependency | structural | critical | Inner layers cannot depend on outer layers |
| FF-S03 | no-domain-outward-dep | structural | major | Domain layer has no outgoing dependencies |
| FF-S04 | no-cyclic-deps | structural | critical | No cyclic dependencies (APOC) |
| FF-C01 | max-fan-out | coupling | major | File fan-out <= threshold (default: 10) |
| FF-C02 | max-fan-in | coupling | minor | File fan-in <= threshold (default: 15) |
| FF-C03 | stable-abstractions | coupling | major | Instability <= threshold for core modules |
| FF-C04 | no-orphan-files | coupling | minor | No unreachable/unimported files |
| FF-P01 | repository-interface | pattern | major | Repositories must implement an interface |
| FF-P02 | service-no-db | pattern | major | Service layer must not import db drivers directly |
| FF-P03 | controller-no-domain | pattern | major | Controllers must not instantiate domain entities |
| FF-CV01 | naming-services | convention | minor | Service classes must end in `Service` |
| FF-CV02 | naming-repos | convention | minor | Repository classes must end in `Repository` or `Repo` |
| FF-CV03 | naming-entities | convention | minor | Domain entities must be in `domain/` or `entities/` dir |
| FF-CV04 | naming-controllers | convention | minor | Controller classes must end in `Controller` |
| FF-CV05 | no-index-re-export-violations | convention | advisory | Index files should only re-export, not contain logic |
| FF-CV06 | consistent-layer-dirs | convention | minor | Each layer must map to exactly one directory pattern |

**Proposed semantic functions (neuronal path)**:
| ID | Name | Dimension | Severity |
|----|------|-----------|----------|
| FF-N01 | srp-semantic | SOLID | major |
| FF-N02 | meaningful-names | semantic | minor |
| FF-N03 | layering-intent | intent | major |

[Answer]:

---

### Q4: FirewallContext Mutability Strategy
The FirewallContext is the "aggregate root" that travels through pipeline Commands (S1). Two patterns are possible:

**A — Mutable context** (simpler): Commands write their output directly to the shared context object (`context.apgResult = result`). Single object, no copies.

**B — Immutable snapshots** (stricter DDD): Each command receives the context and returns a new context with its results merged in. Context is never mutated in place — commands return `{ ...context, apgResult: result }`. Enables time-travel debugging, pure command signatures.

**C — Mixed** (pragmatic): Context is a class. Commands mutate it via typed setter methods (`context.setApgResult(result)`) — looks like immutability from outside, but internally just assignment. Good for DDD without the copy overhead of B.

[Answer]:

---
