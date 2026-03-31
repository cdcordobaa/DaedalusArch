# Project Diagnosis — DaedalusArch
**Date**: 2026-03-30
**Current Stage**: CONSTRUCTION — U5 (Neuro-Symbolic Router + Evaluation) pending, U0–U4 complete

---

## The Big Picture

DaedalusArch is an **architectural compliance firewall** that evaluates TypeScript codebases against a YAML specification using a neuro-symbolic approach: symbolic Cypher queries against a Neo4j graph + LLM-based semantic evaluation. The project is roughly **60% through Construction**, with the foundational pipeline complete and the intelligent evaluation layer (U5–U7) remaining.

---

## Inventory

| Layer | Files | Lines | Status |
|-------|-------|-------|--------|
| **Source code** (`src/`) | 47 `.ts` files | ~4,600 LOC | 5 modules implemented, 6 stubs |
| **Tests** (`tests/`) | 23 files (17 unit, 2 integration, 4 BDD) | ~2,400 LOC | 19 suites, 197 tests, all passing |
| **Fixtures** (`fixtures/`) | 5 ground-truth projects | ~40 files | Calibrated with empirical AHS scores |
| **Spec** (`specs/`) | 1 YAML spec | 26 fitness functions | 11 spike-validated, 12 pending integration |
| **Infrastructure** | docker-compose, CI, GitHub Action, ESLint, Prettier | — | Fully configured |

---

## What Is Working (and How)

### 1. Shared Domain (U1) — The Type System

- 14 files defining every domain type, value object, interface, and error model
- `FirewallContext` aggregate root carries pipeline state between stages
- `DomainResult<T>` universal result monad — no exceptions thrown across the pipeline
- All modules implement `PipelineStage` interface (command pattern ready for U7 orchestrator)
- Violation taxonomy is extensible with built-in types

**Key files**:
- `src/shared/types/` — apg.ts, value-objects.ts, spec.ts, drift.ts, evaluation.ts, enums.ts
- `src/shared/context/firewall-context.ts` — aggregate root
- `src/shared/interfaces/` — GraphRepository, LLMProvider, SnapshotStore, PipelineStage
- `src/shared/errors/domain-result.ts` — DomainResult<T> monad
- `src/shared/taxonomy/violation-types.ts` — extensible violation classification

### 2. APG Extractor (U2) — Static Analysis Engine

- Uses `ts-morph` to parse TypeScript ASTs into an Architecture Property Graph
- Extracts 5 node types (File, Class, Interface, Method, Function) and 7 edge types (IMPORTS, IMPLEMENTS, EXTENDS, CONSTRUCTOR_INJECTS, CALLS, DECLARES, CONTAINS)
- Handles barrel imports, path aliases, decorator-based DI detection
- Reports parse coverage percentage
- 11 unit tests + 1 integration test — validated against all 5 fixture projects

**Key files**:
- `src/apg-extractor/apg-extractor.ts` — main orchestrator + PipelineStage
- `src/apg-extractor/node-extractor.ts` — AST node extraction
- `src/apg-extractor/edge-extractor.ts` — relationship extraction (357 LOC, largest file)
- `src/apg-extractor/id-generator.ts` — deterministic node IDs

### 3. Spec Parser + Fitness Compiler (U3) — Rule Engine

- Parses AoC YAML specs with 3-layer structure (Layer A definitions, Layer B fitness functions, Layer C scoring)
- Template registry with `clean-architecture` built-in template
- JSON Schema + business rule validation (weight sums, threshold ordering, semantic_criteria constraints)
- ADR parsing (MADR, Nygard, Y-Statement formats)
- Compiles fitness functions into: `CypherQuery` (symbolic), `NeuronalInstruction` (neuronal), or `HybridPair` (both)
- 24 parameterized Cypher templates covering all symbolic fitness functions
- 17 unit tests + 1 integration test (full parse-to-compile pipeline against `clean-arch.yaml`)

**Key files**:
- `src/spec-parser/spec-parser.ts` — YAML parsing + template resolution
- `src/spec-parser/spec-schema.ts` — JSON Schema definitions
- `src/spec-parser/spec-validator.ts` — schema + business rule validation
- `src/spec-parser/adr-parsers.ts` — MADR, Nygard, Y-Statement strategy parsers
- `src/spec-parser/template-registry.ts` — built-in architecture templates
- `src/fitness-compiler/fitness-compiler.ts` — route-aware compilation
- `src/fitness-compiler/cypher-templates.ts` — 24 parameterized Cypher query templates

### 4. Neo4j Ingestion + Persistence (U4) — Graph Database Layer

- `Neo4jRepository` implements `GraphRepository` interface with session pooling
- `ingestAPG()` creates labeled nodes + typed relationships in Neo4j
- `LayerAnnotator` maps files to architectural layers (directory > naming > decorator priority)
- `DeltaComputer` computes incremental APG diffs (added/removed nodes/edges)
- `DriftDetector` detects 4 drift types: structural, coupling, convention, violation trend
- `FileSystemSnapshotStore` persists APG snapshots for cross-commit comparison
- 10 unit tests — all snapshot, delta, drift, and ingestion logic tested with mocked Neo4j

**Key files**:
- `src/neo4j-ingestion/neo4j-ingestion.ts` — orchestrator + PipelineStage
- `src/neo4j-ingestion/neo4j-repository.ts` — GraphRepository implementation
- `src/neo4j-ingestion/graph-ingester.ts` — node/edge creation in Neo4j
- `src/neo4j-ingestion/layer-annotator.ts` — directory > naming > decorator layer mapping
- `src/neo4j-ingestion/delta-computer.ts` — incremental APG diff
- `src/neo4j-ingestion/drift-detector.ts` — 4-type drift detection (329 LOC)
- `src/neo4j-ingestion/fs-snapshot-store.ts` — filesystem snapshot persistence

### 5. Golden Test Data — Calibrated Fixtures

5 projects with empirical AHS scores from spike testing:

| Fixture | AHS | Verdict | Violations |
|---------|-----|---------|------------|
| `correct-reference` | 0.85 | PASS | None — clean architecture baseline |
| `variant-a-structural` | 0.54 | SOFT-BLOCK | 4 violations (FF-S01, FF-S02) — dependency direction + circular deps |
| `variant-b-pattern` | 0.58 | SOFT-BLOCK | 5 violations (FF-P01, FF-P02, FF-P03, FF-SO02) — DI, repo pattern, SOLID |
| `variant-c-everything` | 0.33 | HARD-BLOCK | 8 violations across all dimensions — god classes, wrong naming, cycles |
| `variant-d-subtle` | 0.66 | WARNING | 2 violations (FF-P02, FF-S01 transitive) — buried, hard-to-detect |

Each has a `MANIFEST.md` documenting expected violations and scores.

### 6. Infrastructure

- **package.json**: `daedalus-arch` v0.1.0, all deps locked (ts-morph, neo4j-driver, @anthropic-ai/sdk, openai, commander, zod, ajv, yaml, chalk, ora)
- **tsconfig.json**: ES2022 target, NodeNext modules, strict mode + extras, 11 path aliases (`@shared`, `@apg-extractor`, etc.)
- **jest.config.cjs**: ts-jest, 80% coverage thresholds, path alias resolution, supports BDD `.steps.ts`
- **docker-compose.yml**: Neo4j 5.26-community with APOC plugin, health checks, persistent volumes
- **.env.example**: Neo4j, LLM provider (Claude/OpenAI), evaluation params, storage paths
- **eslint.config.mjs**: TypeScript strict + stylistic, no-any (error), prefer-readonly, test relaxations
- **.prettierrc**: single quotes, trailing commas, 100 char width, 2-space indent
- **CI** (`.github/workflows/ci.yml`): Ubuntu + Node 22 + Neo4j service container, type check → lint → unit → integration → Codecov
- **GitHub Action** (`.github/actions/firewall/action.yml`): Reusable action for PR evaluation with configurable mode

---

## Health Metrics

| Metric | Value |
|--------|-------|
| TypeScript compilation | Clean (zero errors, strict mode) |
| Test pass rate | **197/197 (100%)** |
| Test execution time | ~9.3 seconds |
| Coverage threshold | 80% (branches, functions, lines, statements) |
| CI pipeline | Configured (Neo4j service, type check, lint, unit + integration) |
| Stub modules | 6 (router, evaluation-engine, llm-critic, scoring-engine, cli, firewall-context re-export) |

---

## Pipeline Flow (Current State)

What can run end-to-end today (programmatically, not via CLI):

```
TypeScript Project
    │
    ▼
[APG Extractor] ──→ APGResult (nodes + edges)
    │
    ▼
[Neo4j Ingestion] ──→ Graph in Neo4j (with layer annotations)
    │
    ▼                          [Spec Parser] ──→ ParsedSpec
                                     │
                               [Fitness Compiler] ──→ CompiledFunctions
                                                        (CypherQuery / NeuronalInstruction / HybridPair)
```

The two branches converge at **U5 (Router)**, which doesn't exist yet. Once it does, the compiled functions get dispatched against the loaded graph, producing `EvaluationResults` that flow into scoring (U6) and then CLI output (U7).

---

## What Does NOT Exist Yet

| Component | Unit | Purpose |
|-----------|------|---------|
| **Neuro-Symbolic Router** (C5) | U5 | Dispatches fitness functions to symbolic/neuronal/hybrid paths based on route tags and evaluation mode |
| **Evaluation Engine** (C6) | U5 | Executes Cypher queries against Neo4j, collects violations, determines pass/fail per function |
| **LLM Critic** (C7) | U5 | Assembles context packets, calls Claude/OpenAI, parses structured verdicts, multi-run consistency checks, VCR cassettes |
| **LLMProviderService** (S4) | U5 | Provider strategy (Claude + OpenAI adapters), retry/backoff, concurrency governor |
| **AuditLogService** (S5) | U5 | VCR record/replay/bypass, LLM call logging |
| **Scoring Engine** (C8) | U6 | AVR per dimension, AHS weighted complement, verdict merge, dual scoring modes, universal health metrics |
| **ReportService** (S6) | U6 | JSON / human-readable / CSV / PR comment output formats |
| **CLI** (C9) | U7 | `firewall evaluate`, `firewall batch`, `firewall drift` commands |
| **PipelineExecutor** (S1) | U7 | Command pattern orchestrator, parallel branch support, fail-fast on critical errors |
| **GitHub Action** | U7 | PR-triggered evaluation with Neo4j service container |

---

## Dependency Chain (Remaining)

```
U5 (Router + Eval) → U6 (Scoring + Reports) → U7 (CLI + CI/CD) → Build & Test
```

Strictly sequential — no parallelization opportunity from this point forward.

---

## Spec Coverage

`specs/clean-arch.yaml` defines 26 fitness functions:

- **Symbolic (20)**: Cypher queries against the graph — dependency direction, cycles, domain purity, DI, repo pattern, use-case isolation, coupling metrics, SRP/ISP proxies, naming conventions
- **Neuronal (2)**: LLM-evaluated — SRP semantic analysis, cohesion narrative
- **Hybrid (4)**: Both paths — pending final route tagging in Router

Of the 26, **11 are spike-validated** against the fixture projects with known-good results. The remaining 12 symbolic + 2 neuronal are pending integration testing post-U5.

---

## Design Decisions Locked In (from U5 Questions)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Hybrid dispatch strategy | Sequential — symbolic first, skip neuronal if symbolic fails | Saves LLM tokens; violations caught early |
| VCR implementation | File-based cassettes (`fixtures/cassettes/{functionId}.json`) | Simple, git-trackable, deterministic |
| Cypher result mapping | Template-annotated mapping in `CypherTemplate` config | Decouples DB query from app code; safe for custom rules |
| ICC computation | Simple stddev-based consistency check (threshold > 0.15 = unstable) | Avoids ICC edge cases (NaN on identical scores) |
| LLM context budget | Fixed budget per component (code: 2000, subgraph: 500, rule: 300, ADR: 500 tokens) | Predictable, forces concise context |

---

## Extensibility Analysis: Multi-Language and Multi-Architecture Support

### Language Coupling Map

The system has 3 distinct layers with different language dependencies:

| Layer | Components | Language-Coupled? |
|-------|-----------|-------------------|
| **APG Extractor** (C1) | `ts-morph`, node/edge extraction | **Hardcoded to TypeScript** — the only language-specific module |
| **Everything else** (C2–C9, S1–S6) | Neo4j, Cypher, Router, LLM Critic, Scoring, CLI | **Language-agnostic** — operates on the abstract graph |
| **AoC Spec + Templates** | YAML spec, template registry | **Language-agnostic** — directory patterns and rule definitions |

~85% of the system doesn't care what language produced the graph. The APG is an abstract representation — once nodes and edges are in Neo4j, all downstream modules work regardless of source language.

### The Plugin Boundary: APGResult Contract

Every language extractor must produce the same shape:

```typescript
interface APGResult {
  nodes: APGNode[];   // File, Class, Interface, Method, Function
  edges: APGEdge[];   // IMPORTS, IMPLEMENTS, EXTENDS, CONSTRUCTOR_INJECTS, CALLS, DECLARES, CONTAINS
  parseCoverage: ParseCoverage;
  warnings: ExtractorWarning[];
}
```

```
                    ┌──────────────────┐
                    │  AoC YAML Spec   │  ← language-agnostic
                    │  + Template      │     (layers, fitness fns, weights)
                    └────────┬─────────┘
                             │
  ┌──────────────┐   ┌──────┴───────┐   ┌──────────────┐
  │ TS Extractor │   │ Py Extractor │   │ Java Extract  │  ← one per language
  │ (ts-morph)   │   │ (ast/astroid)│   │ (JavaParser)  │
  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
         │                  │                   │
         └──────────┬───────┴───────────────────┘
                    │
                    ▼
              ┌───────────┐
              │ APGResult  │  ← universal graph contract
              └─────┬─────┘
                    │
         ┌──────────┴──────────────────────────────┐
         │  Neo4j → Cypher → Router → LLM → Score  │  ← 100% shared
         └─────────────────────────────────────────┘
```

### Per-Language Viability

| Target | Effort | What Changes |
|--------|--------|-------------|
| **Angular / NestJS** | Low | New spec template only — extractor already handles decorators, DI |
| **React / Next.js** | Low-Medium | New spec template + possibly `RENDERS`/`COMPOSES` edge type for component composition |
| **Java / Spring** | Medium | New extractor (~900 LOC via JavaParser) + new spec template — maps 1:1 to current node/edge types |
| **Python / Django / FastAPI** | Medium | New extractor (via `ast`/`astroid`) + adapt Interface concept (ABC/Protocol → Interface node) + new spec template |
| **Go** | Medium-High | New extractor + rethink implicit interface satisfaction + struct-as-class mapping |
| **Multi-language monorepo** | High | Multiple extractors merging into one graph, cross-language edge resolution |

### NodeType / EdgeType Constraint

The current enums are fixed:
- **Nodes**: `File | Class | Interface | Method | Function`
- **Edges**: `IMPORTS | IMPLEMENTS | EXTENDS | CONSTRUCTOR_INJECTS | CALLS | DECLARES | CONTAINS`

These are referenced in the extractor, Cypher templates, Neo4j labels, and fitness functions. For languages without explicit interfaces (Python, Go) the pragmatic path is mapping to existing types (ABC/Protocol → Interface, struct → Class). Adding new types (e.g., `Component`, `Struct`, `RENDERS`) would touch Cypher templates and every fitness function that filters by type.

---

## Extensibility Analysis: Architecture Style Support

### How Style Flows Through the System

```
YAML spec                    Template Registry              Cypher Templates
─────────                    ─────────────────              ────────────────
architecture:                TEMPLATE_REGISTRY.get()        CYPHER_TEMPLATES.get()
  style: clean-architecture  → 26 FitnessFunction[]         → 24 CypherTemplate
  layers:                    → default weights              (keyed by function NAME)
    - name: domain           → default thresholds
    - name: application
    - name: infrastructure
```

### 4 Extension Points

**1. Layer Definitions (Fully Open — works today)**

`LayerDefinition` is completely user-defined. Nothing is hardcoded about "domain/application/infrastructure":

```typescript
interface LayerDefinition {
  readonly name: string;           // ANY string
  readonly directories: string[];   // ANY glob patterns
  readonly naming: string[];        // ANY patterns
  readonly decorators?: string[];   // ANY decorators
  readonly role: string;            // ANY description
}
```

A hexagonal spec can define `domain / ports / adapters`. A feature-sliced design can define `shared / entities / features / pages / app`. The layer annotator uses glob matching against `directories` — it doesn't know or care what the names are.

**2. Template Registry (Extensible — currently 1 entry)**

The registry is a `Map<string, BuiltInTemplate>`. Adding a new style = adding a new entry with curated fitness functions, default weights, and thresholds:

```typescript
export const TEMPLATE_REGISTRY = new Map([
  ['clean-architecture', CLEAN_ARCHITECTURE_TEMPLATE],
  // ['hexagonal', HEXAGONAL_TEMPLATE],
  // ['modular-monolith', MODULAR_MONOLITH_TEMPLATE],
]);
```

**3. Custom Fitness Functions in YAML (Fully Open — works today)**

The spec merge logic supports three modes:
- **Template + overrides**: Use a style, override specific functions by ID
- **Template + additions**: Use a style, append custom functions not in the template
- **No template (fully custom)**: Omit `style:`, define all functions yourself

Custom neuronal functions work today — any rule expressible in English can be evaluated by the LLM path:

```yaml
- id: FF-CUSTOM-01
  name: my-boundary-check
  dimension: pattern
  severity: major
  route: neuronal
  semantic_criteria:
    rule: "Boundary layer must only expose DTOs, never domain entities"
    rubric:
      pass: "All boundary exports are DTOs or interfaces"
      fail: "Boundary exports domain entities directly"
      evidence_required: "Cite the specific export that leaks domain types"
```

**4. Cypher Templates (The Real Constraint)**

The compiler looks up templates by `CYPHER_TEMPLATES.get(ff.name)`. Custom symbolic functions either reuse a built-in template name (and get that Cypher) or have no symbolic query (warning `COMPILER_002`).

Users can bring their own Cypher via ADR files with `cypher_rule`:

```yaml
# In an ADR YAML file:
adr:
  title: Module Boundary Enforcement
  cypher_rule:
    query: "MATCH (src:File)-[:IMPORTS]->(tgt:File) WHERE src.module <> tgt.module AND NOT tgt.isPublicAPI RETURN src, tgt"
    params: {}
    description: Cross-module imports must go through public API
```

### The `buildParams()` Bottleneck

The function in `fitness-compiler.ts:204-257` **hardcodes layer name lookups**:

```typescript
// Current — brittle, assumes clean-architecture naming:
const domainLayer = layers.find(l => l.name === 'domain')?.name;
const applicationLayer = layers.find(l => l.name === 'application')?.name;
const infraLayer = layers.find(l => l.name === 'infrastructure')?.name;
```

With layers named `core / boundary / shell`, these params become `undefined` and Cypher queries silently match nothing. The spec already has `roles` on each layer — connecting roles to params would make the system truly style-agnostic:

```typescript
// Fix — role-based (uses existing data):
const domainLayer = layers.find(l => l.role.includes('entity'))?.name;
// Or ordinal — innermost layer = domain-equivalent:
const domainLayer = layers[0]?.name;
const infraLayer = layers[layers.length - 1]?.name;
```

**Fix scope**: ~50 lines in `fitness-compiler.ts` + ~10 Cypher templates accepting role-based layer sets.

### The `ScoringWeights` Constraint

The 7 dimensions are hardcoded as a type:

```typescript
type Dimension = 'structural' | 'coupling' | 'pattern' | 'solid' | 'convention' | 'semantic' | 'intent';

interface ScoringWeights {
  structural: number; coupling: number; pattern: number;
  solid: number; convention: number; semantic: number; intent: number;
}
```

Custom dimensions (e.g., `modularity`, `isolation`, `api-surface`) would require refactoring: enums, spec types, scoring logic (U6), and report formatting. **Pragmatic take**: the 7 dimensions are general enough for most architecture styles — `structural` applies to any layered system, `coupling` to any graph, `pattern` to any design paradigm.

### Per-Style Viability

| Style | Layers | Reusable Cypher | New Templates | Effort |
|-------|--------|-----------------|---------------|--------|
| **Clean Architecture** | domain / application / infrastructure | All 24 | 0 | Done |
| **Onion Architecture** | domain / domain-services / application / infrastructure | ~20 | ~4 (service layer) | Low |
| **Hexagonal / Ports & Adapters** | domain / ports / adapters | ~15 (coupling, SOLID, convention) | ~9 (port-adapter wiring) | Medium |
| **Vertical Slice** | per-feature slices + shared | ~8 (coupling, SOLID, convention) | ~16 (slice isolation) | Medium-High |
| **Modular Monolith** | modules with public APIs | ~10 (coupling, convention) | ~14 (module boundaries) | Medium-High |
| **Feature-Sliced Design** | shared / entities / features / pages / app | ~12 (coupling, naming) | ~12 (5-layer ordering) | Medium |
| **Fully Custom** (no template) | User-defined | Reuse by function name | User writes YAML | Works today (neuronal); needs `buildParams()` fix (symbolic) |

### What Needs Changing for Full Style Flexibility

| Change | Scope | Effort | Impact |
|--------|-------|--------|--------|
| Fix `buildParams()` to use roles/ordinals instead of hardcoded layer names | `fitness-compiler.ts` ~50 LOC | Low | Unlocks all architecture styles for symbolic path |
| Parameterize ~10 Cypher templates for generic layer references | `cypher-templates.ts` | Low | Templates work with any layer naming |
| Add new built-in templates (hexagonal, modular monolith, etc.) | `template-registry.ts` + new Cypher templates per style | Medium per style | Out-of-box support for popular styles |
| Make Dimension enum extensible | `enums.ts`, `spec.ts`, scoring (U6), reports (U6) | High | Custom scoring dimensions — not needed for most styles |

### Summary

The system is **80% ready for arbitrary architecture styles**. Layer definitions are fully open. The spec format supports full customization. The neuronal path (LLM evaluation) works for any rule describable in English. ADR-driven custom Cypher is supported today. The gap is `buildParams()` assuming clean-architecture layer names — a focused ~50 LOC fix that would unlock hexagonal, onion, vertical slice, and fully custom architectures for the symbolic evaluation path.
