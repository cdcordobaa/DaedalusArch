# Unit 3 — Spec Parser + Fitness Compiler: Design Questions

## Q1: Cypher Template Strategy

The Fitness Compiler must produce Cypher queries for 24 symbolic functions (FF-S01..FF-CV06). Two approaches:

**A) Hardcoded Cypher per function** — Each function ID maps to a handwritten Cypher template string with `$param` placeholders. Instantiation = string interpolation. Simple, explicit, easy to test. But 24 separate template strings to maintain.

**B) Template composition from primitives** — Build a small Cypher DSL (e.g., `matchNode()`, `filterByLayer()`, `countEdges()`) and compose queries from building blocks. More DRY, but adds complexity and an abstraction layer that may not pay off until 50+ functions.

**C) Hybrid** — Handwritten templates for the 12 spike-validated functions (proven Cypher from spike repo), composed templates for the 12 pending ones.

[Answer]: A (Hardcoded Cypher per function)
Rationale: Cypher queries for architecture often involve APOC path expansions, cyclic checks, and complex existential subqueries. Storing them as explicit, hardcoded template strings keeps them highly readable, easy to test against Neo4j, and avoids the immense maintenance overhead of building a custom TypeScript-to-Cypher DSL.
---

## Q2: ADR Parser Extensibility

The spec supports 4 ADR formats: MADR, Nygard, Y-Statement, custom-yaml. Options:

**A) Strategy pattern** — `ADRParser` interface with 4 implementations. A registry detects format by file content/extension. Easy to add new formats later.

**B) Single parser with format branches** — One `parseADR()` function with internal if/switch on detected format. Simpler, fewer files. Adding a format = adding a branch.

**C) Format-specific parsers, no interface** — Separate exported functions (`parseMADR()`, `parseNygard()`, etc.) with a top-level dispatcher. No abstraction overhead.

[Answer]: A (Strategy pattern)
Rationale: This follows the Open/Closed Principle. Using an `ADRParser` interface allows the system to support multiple ADR formats (MADR, Nygard, etc.) without modifying the core parsing loop. Adding a new format simply requires implementing a new Strategy class.
---

## Q3: Built-in Template Resolution

When `style: clean-architecture` is declared, we resolve to the 26 built-in fitness functions. How should the template system work?

**A) Static registry** — A `Map<string, FitnessFunction[]>` with `clean-architecture` as the only key for now. Template data lives in a TypeScript constant (not YAML). When the spec declares `style: X`, look up X, merge with any spec-level overrides.

**B) YAML-based templates** — Built-in templates are themselves YAML files (e.g., `templates/clean-architecture.yaml`). The parser reads them the same way it reads user specs. More uniform, but adds file I/O to template resolution.

**C) No template system** — The `clean-arch.yaml` spec already lists all 26 functions explicitly. Template resolution just validates that the listed functions match the built-in set. No merging, no override logic.

[Answer]: A (Static registry)
Rationale: Distributing predefined templates (like `clean-architecture`) as strongly-typed TypeScript constants avoids brittle runtime file I/O operations and path resolution bugs (especially critical when deploying as a CLI tool or GitHub Action). It guarantees availability and immutability of core templates.
---

## Q4: Dual-Rule Production from ADRs

FR-05.2 requires producing both a Cypher rule AND semantic criterion from each parsed ADR. Options:

**A) ADR parser produces raw ADRRule, Fitness Compiler generates dual rules** — Clean separation: parser extracts content, compiler converts to executable form. But compiler needs to understand ADR content to generate Cypher.

**B) ADR parser produces dual rules directly** — The parser itself outputs `{ symbolicRule: CypherRule, semanticCriterion: SemanticCriteria }` since it already understands the ADR structure. Compiler only handles fitness functions.

**C) ADR parser produces ADRRule with optional user-provided Cypher** — v1 reality: ADR-to-Cypher auto-generation is complex (likely needs LLM). For v1, ADRRules carry `semanticCriterion` (always generated from prose) + optional `symbolicRule` (only if user manually provides Cypher in the ADR YAML). Full auto-generation deferred to v2.

[Answer]: Experimental Shadow Mode (Variant of C)
Rationale: We will provide handcrafted deterministic Cypher for the symbolic rules. However, to push the neuro-symbolic research forward, the compiler will *also* trigger the LLM to auto-generate Cypher from the English prose at runtime. We will execute both in parallel ("shadow mode") and test the LLM's generated query results against the handcrafted ground truth. This safely tests the LLM's Cypher-generation capability without crashing the main deterministic evaluation pipeline.
---

## Q5: JSON Schema Validation Approach

FR-04.3 requires JSON Schema validation with line-number errors. Options:

**A) Ajv + custom error mapping** — Use Ajv for schema validation, then map JSON pointer errors back to YAML line numbers using a YAML parser that preserves source positions (e.g., `yaml` package's `CST` mode).

**B) Schema-in-code validation** — Skip JSON Schema entirely. Use a typed validation function (like Zod or manual checks) that validates each field and reports errors with field paths. Simpler but not standard.

**C) JSON Schema for structure + code for semantics** — Ajv validates the overall shape (required fields, types, enum values). Code validation handles cross-field rules (e.g., weights sum to 1.0, threshold ranges, semantic_criteria only with neuronal/hybrid route). Best of both — standard schema for structure, programmatic for business rules.

[Answer]: C (JSON Schema for structure + code for semantics)
Rationale: JSON Schema (via Ajv) is the industry standard for validating structural shape and types, providing excellent syntax validation. However, complex business logic (e.g., "weights must sum exactly to 1.0" or inter-field dependencies) cannot be cleanly expressed in standard JSON Schema, making programmatic TypeScript validation the necessary second layer.
