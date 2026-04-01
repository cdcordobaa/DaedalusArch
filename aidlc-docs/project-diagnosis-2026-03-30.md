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

---

## v1.1 Gap Analysis — What's Required for True Plug-and-Play

**Date added**: 2026-04-01
**Source**: Self-evaluation of DaedalusArch's own codebase revealed that while the engine is solid, the path from "I have a project" to "I get useful feedback" is blocked by fundamental gaps in the developer experience, spec flexibility, and rule engine.

### How the Gaps Were Discovered

We ran `firewall evaluate --project . --spec specs/clean-arch.yaml --symbolic-only` against DaedalusArch itself. The journey:

| Run | AHS | Violations | Problem |
|-----|-----|------------|---------|
| 1 (generic spec) | 0.867 | 10 | Looks fine — but layer directories (`src/domain/`) don't match our project (`src/shared/`) |
| 2 (custom layers) | 0.180 | 485 | Every module→shared import flagged as LAYER_VIOLATION |
| 3 (fixed layer order) | 0.180 | 569 | dependency-direction Cypher was inverted (bug) |
| 4 (bug fixed) | 0.180 | 452 | application→modules imports flagged despite being valid |
| 5 (flat module layer) | 0.180 | 377 | Same-layer imports match both inner/outer sets |
| 6 (proper Cypher rewrite) | 0.180 | 423 | no-layer-skip fires on every cross-layer import in 3-layer model |
| 7 (removed template) | 0.530 | 171 | Template-injected rules can't be disabled; exclude_paths is cosmetic |

**Conclusion**: A developer attempting to use this tool on any non-trivial project would hit the same wall at Run 2 and give up.

---

### GAP-01: No Guided Setup (`firewall init`)

**What's missing**: There is no command or tool that helps a developer create a spec for their project. They must manually author YAML, understand layer hierarchies, know which fitness functions apply, and configure scoring weights.

**Why it matters**: This is the #1 adoption barrier. A developer who can't get past "what YAML do I write?" will never see value from the tool. The 24 fitness functions and clean-architecture template are reference material for one specific style — useless for NestJS, Next.js, Express, React, or any custom architecture.

**What's required**:
- A `firewall init` CLI command that scans the project, detects patterns, and generates a starter spec
- An LLM-powered agent skill (MCP tool / Claude skill / Cursor tool) that reads the codebase and produces a tailored spec with architectural understanding, not just folder-name matching
- Framework presets (NestJS, Next.js, Express, React/Vite, plain TS, monorepo) that provide sensible defaults

**Acceptance criteria**: A developer runs `firewall init` on any TypeScript project and gets a working spec in under 60 seconds, producing fewer than 20 violations on the first evaluation with >80% being genuine issues.

---

### GAP-02: `exclude_paths` Not Wired to Cypher

**What's missing**: The spec YAML supports `exclude_paths` as a field on fitness functions, but the fitness compiler ignores it. The Cypher queries execute without any path exclusion predicates. Every rule applies to every file globally.

**Why it matters**: Every real project has files that intentionally violate certain rules:
- Composition roots (factory files) have high fan-out by design
- Shared kernel types have high fan-in by design
- Index/barrel files re-export without logic
- Test utilities and fixtures shouldn't be evaluated
- Generated code (Prisma client, GraphQL codegen) follows its own patterns

Without exclusions, the signal-to-noise ratio is unacceptable. Our self-evaluation produced 171 violations even after every other fix — most were false positives on files that should be excluded.

**What's required**:
- Fitness compiler reads `exclude_paths` from each function definition
- Converts glob patterns to regex predicates
- Injects `WHERE NOT src.filePath =~ $excludePattern` into Cypher templates
- Supports both per-function and global exclusions

**Acceptance criteria**: Adding `exclude_paths: ["src/pipeline/pipeline-factory.ts"]` to FF-C02 causes that file to be skipped in fan-out evaluation.

---

### GAP-03: No Rule Enable/Disable Mechanism

**What's missing**: When using a template (`style: clean-architecture`), all template functions are injected into the compiled output. There is no way to disable a specific template function from the YAML spec. Removing the function from `fitness_functions` doesn't help — the template merge logic (`parseLayerB`) adds it back.

**Why it matters**: The clean-architecture template includes 24 functions. A given project may only want 15 of them. Currently the only option is to abandon the template entirely (`style:` commented out) and redeclare every function manually — defeating the purpose of templates.

**What's required**:
- An `enabled: false` field on fitness function declarations
- Template merge logic respects `enabled: false` overrides — function is excluded from compiled output
- Optional `reason` field for documentation: why this rule was disabled

**Acceptance criteria**: Adding `enabled: false` to an FF-S03 override in the spec causes `no-layer-skip` to be excluded from the evaluation, even when the clean-architecture template includes it.

---

### GAP-04: Template Registry Forces All Functions

**What's missing**: Related to GAP-03 but a distinct issue. The template registry (`template-registry.ts`) defines a fixed set of functions per style. There is no concept of "optional template functions" or "recommended vs required" within a template. The merge logic in `parseLayerB` treats every template function as mandatory.

**Why it matters**: Architecture styles are spectrums, not fixed configurations. A "clean architecture" project might follow dependency direction rules strictly but not care about naming conventions. The template should suggest functions, not mandate them.

**What's required**:
- Templates should categorize functions as `required` (always included) vs `recommended` (included by default, can be disabled) vs `optional` (not included unless explicitly enabled)
- The agent skill / `firewall init` command selects which recommended/optional functions to include based on project analysis

---

### GAP-05: dependency-direction Cypher Was Inverted

**What's missing**: Fixed during self-evaluation, but indicative of a broader problem — the Cypher templates lacked real-world testing against diverse project structures.

**The bug**: The `dependency-direction` template had `WHERE src.layer IN $outerLayers AND tgt.layer IN $innerLayers`, which finds outer→inner imports (the **valid** direction). It should find inner→outer imports (violations). Additionally, `$outerLayers` and `$innerLayers` had overlapping elements, causing same-layer imports to match.

**What was fixed**:
- Cypher rewritten to use `apoc.coll.indexOf($layerOrder, ...)` for proper ordinal comparison
- `WHERE srcIdx < tgtIdx` correctly identifies lower-layer files importing from higher layers
- Same-layer imports (`srcIdx == tgtIdx`) are excluded via `src.layer <> tgt.layer`

**What's still required**:
- Integration tests that validate every Cypher template against real Neo4j with known-good fixture projects
- Tests with 2-layer, 3-layer, and 4-layer configurations to catch edge cases
- Tests with custom layer names (not just domain/application/infrastructure)

---

### GAP-06: `buildParams()` Hardcodes Layer Names

**What's missing**: The `buildParams()` function in `fitness-compiler.ts` finds layers by name:

```typescript
const domainLayer = layers.find(l => l.name === 'domain')?.name;
const infraLayer = layers.find(l => l.name === 'infrastructure')?.name;
```

Projects using `core`, `shared`, `kernel`, `boundary`, `adapters`, `shell`, or any other naming get `undefined` params, causing Cypher queries to silently match nothing or match everything.

**Why it matters**: This is the single line of code that prevents the tool from working with any architecture style other than clean-architecture with exact layer names. It contradicts the system's otherwise flexible layer model.

**What's required**:
- Replace name-based lookup with ordinal/role-based lookup
- `domain` equivalent = first layer (index 0, innermost)
- `infrastructure` equivalent = second-to-last or last layer (depends on hierarchy)
- Or: use the `roles` field already defined on each layer in the spec
- Parametrize Cypher templates to accept generic layer sets rather than named layers

**Acceptance criteria**: A spec with layers named `core`, `services`, `gateway` works identically to one named `domain`, `application`, `infrastructure`.

---

### GAP-07: no-layer-skip Rule Assumes 4+ Layers

**What's missing**: The `no-layer-skip` fitness function flags imports that skip intermediate layers (e.g., presentation → domain, skipping application). In a 3-layer model, every cross-layer import is "adjacent" — there's nothing to skip. The rule fires on every valid import, producing hundreds of false positives.

**Why it matters**: Most projects have 2-4 layers. A rule that only works correctly with 4+ layers is a trap — it looks useful in the template but destroys the signal-to-noise ratio on most real projects.

**What's required**:
- The rule should auto-disable when fewer than 4 layers are defined
- Or: the rule should compute actual layer distance and only flag when distance > 1
- Template should mark this rule as `recommended` (not required) with a note about minimum layer count

---

### GAP-08: No Per-Violation Inline Suppression

**What's missing**: No way to suppress a specific violation in source code. Unlike ESLint's `// eslint-disable-next-line` or TypeScript's `// @ts-ignore`, there's no `// firewall-ignore FF-C02` mechanism.

**Why it matters**: Some violations are intentional architectural decisions. A developer should be able to annotate the code at the point of the decision, not manage a global exclusion list in the YAML spec. This is especially important for reviewed decisions — the comment serves as documentation.

**What's required**:
- APG extractor parses `// firewall-ignore <rule-id>` comments from source files
- Stores ignore annotations on the corresponding APGNode
- Evaluation engine skips violations on annotated nodes
- Report shows suppressed violations separately (audit trail)

---

### GAP-09: Violations Lack Actionable Guidance

**What's missing**: Current violation output:
```
[major] FAN_OUT_EXCEEDED — src/pipeline/pipeline-factory.ts
```

This tells the developer **what** but not **why** or **how to fix it**.

**Why it matters**: A developer seeing 10 violations needs to understand each one well enough to decide: fix it, suppress it, or tune the rule. Without context, they'll either ignore all violations (tool becomes shelfware) or waste time investigating obvious false positives.

**What's required**:
- **Line number**: which import/declaration triggered the violation
- **Explanation**: "This file has 12 imports, exceeding the max_fan_out threshold of 10"
- **Context**: "Files with high fan-out often indicate a God class or composition root"
- **Suggestion**: "Consider extracting a factory function, or add `exclude_paths` if this is a composition root"
- **Suppress hint**: "Add `// firewall-ignore FF-C02` to suppress this violation"

---

### GAP-10: No Framework Presets

**What's missing**: The tool ships with one template (`clean-architecture`) that assumes `src/domain/`, `src/application/`, `src/infrastructure/`. The vast majority of TypeScript projects use framework-specific layouts:

- **NestJS**: `src/modules/*/`, `src/common/`, `src/config/`, decorator-based DI
- **Next.js**: `app/`, `pages/`, `components/`, `lib/`, `api/`, server/client boundary
- **Express**: `src/routes/`, `src/controllers/`, `src/services/`, `src/models/`
- **React/Vite**: `src/components/`, `src/hooks/`, `src/store/`, `src/services/`
- **Monorepo**: `packages/*/src/`, cross-package dependency rules

**Why it matters**: Without presets, every non-clean-architecture project requires manual YAML authoring from scratch. This is the difference between "30 seconds to first value" and "30 minutes of YAML debugging."

**What's required**:
- `presets/` directory with YAML templates per framework
- `firewall init` auto-detects framework and suggests the right preset
- Each preset includes tailored layer mappings, fitness functions, and scoring weights
- Presets are extensible — users can fork and customize

---

### GAP-11: Neo4j Is Mandatory (High Infrastructure Barrier)

**What's missing**: Every evaluation requires a running Neo4j instance. For a static analysis tool, this is an unusually heavy dependency. Most developers expect `npx tool-name .` to work without Docker.

**Why it matters**: The install-to-first-evaluation flow requires: install Node deps → install Docker → pull Neo4j image → start container → wait for health check → run evaluation. This easily takes 5-10 minutes and fails on machines without Docker (corporate laptops, CI runners without service containers).

**What's required**:
- An in-memory `GraphRepository` implementation using a simple adjacency list
- Supports the subset of Cypher queries used by the most common fitness functions (structural, coupling, convention)
- Falls back to Neo4j only for advanced features (APOC algorithms, persistent snapshots, drift detection)
- Default mode: in-memory. Neo4j opt-in via `--neo4j-uri` flag.

**Acceptance criteria**: `firewall evaluate --project . --spec firewall.spec.yaml --symbolic-only` works with zero Docker dependency on a typical project.

---

### GAP-12: No Real LLM Providers

**What's missing**: Only `MockLLMProvider` exists. `ClaudeProvider` and `OpenAIProvider` are not implemented. The neuronal evaluation path (semantic and intent dimensions) is non-functional in production.

**Why it matters**: The neuronal path is half of the tool's value proposition. It's also required for:
- Agent skill spec generation (GAP-01) — LLM reads codebase and generates spec
- ADR-to-spec mapping — LLM extracts constraints from ADR prose
- Semantic dimension evaluation — LLM judges whether code respects architectural intent

**What's required**:
- `ClaudeProvider` using `@anthropic-ai/sdk` (already in dependencies)
- `OpenAIProvider` using `openai` SDK (already in dependencies)
- Provider factory that selects based on `LLM_PROVIDER` env var
- Retry/backoff for 429/5xx (p-limit already available)
- Integration into pipeline factory

---

### GAP-13: React/JSX/TSX Support in APG Extractor

**What's missing**: The `ts-morph` extractor handles TypeScript but doesn't understand React patterns:
- Function components are extracted as functions, not as "components"
- Hook dependencies aren't tracked
- JSX composition (parent renders child) isn't captured as an edge
- Client/server boundary (`'use client'` / `'use server'`) is invisible
- Props type flow isn't modeled

**Why it matters**: React is the dominant frontend framework. A TypeScript architectural tool that can't understand React component trees, hook dependency chains, and client/server boundaries is missing the largest user segment.

**What's required**:
- Detect React components (function returning JSX, React.FC, class extending React.Component)
- Extract component composition edges (parent renders child → RENDERS edge)
- Extract hook usage (component uses hook → CALLS edge to hook function)
- Detect `'use client'` / `'use server'` directives → metadata on File nodes
- Fitness functions for React: component purity, hook rules, prop drilling depth, client/server boundary violations

---

### GAP-14: No Incremental Rule Adoption

**What's missing**: The tool runs all fitness functions in the spec. There's no way to run a subset for gradual adoption:
- "Start with just circular dependency detection"
- "Only check structural rules this sprint"
- "Show me coupling issues but don't block on convention"

**Why it matters**: Teams adopting architectural governance need a ramp-up path. Going from 0 rules to 24 rules in one step produces overwhelm. Incremental adoption lets teams fix one category at a time.

**What's required**:
- CLI flags: `--dimensions structural,coupling`, `--rules FF-S01,FF-S02`, `--min-severity major`
- Filtered evaluation: only compile and execute matching functions
- Report shows which functions were skipped and why

---

### GAP-15: ADR-to-Spec Mapping Needs LLM

**What's missing**: The ADR parser (v1.0) can read MADR, Nygard, and Y-Statement formats and extract structured fields. But it doesn't **generate fitness functions** from ADR content. The mapping from "ADR says X" to "enforce X via Cypher query" requires understanding architectural intent — which requires an LLM.

**Why it matters**: ADRs are the source of truth for architectural decisions in many teams. If the tool can automatically extract "we chose PostgreSQL" → "no MongoDB imports allowed", or "domain must not depend on infrastructure" → FF-S01, it becomes a living enforcement mechanism for documented decisions.

**What's required**:
- LLM reads ADR content and extracts architectural constraints
- Constraint types: forbidden imports, required patterns, layer rules, naming conventions
- Maps constraints to existing fitness function templates where possible
- Generates custom neuronal functions for constraints that need semantic evaluation
- Adds `source: adr` and `adr_ref: path/to/adr.md` to generated functions

---

### GAP-16: Spec Validation / Linting

**What's missing**: No way to validate a spec before running the pipeline. Invalid YAML, non-existent layer directories, impossible threshold combinations, and typos in function names all fail silently or produce confusing runtime errors.

**Why it matters**: The spec is the configuration surface for the entire tool. A bad spec produces bad results with no explanation. Validation catches mistakes early and guides users toward correct configuration.

**What's required**:
- `firewall validate --spec firewall.spec.yaml` CLI command
- Checks: layer directories exist, function IDs unique, Cypher templates exist for symbolic functions, threshold values in valid ranges, exclude_paths patterns are valid globs, scoring weights sum to 1.0, ADR refs resolve
- Human-readable error messages with fix suggestions

---

### Priority Matrix

| Priority | Gap | Impact | Effort |
|----------|-----|--------|--------|
| **P0 — Blocking** | GAP-01: Agent skill / `firewall init` | No adoption without guided setup | High |
| **P0 — Blocking** | GAP-02: `exclude_paths` in Cypher | Every project needs exclusions | Medium |
| **P0 — Blocking** | GAP-03: Rule enable/disable | Can't customize templates | Low |
| **P0 — Blocking** | GAP-06: `buildParams()` hardcoded names | Breaks all non-clean-arch projects | Low |
| **P0 — Blocking** | GAP-10: Framework presets | 30s vs 30min time-to-value | Medium |
| **P1 — High** | GAP-09: Actionable violation messages | Signal-to-noise ratio | Medium |
| **P1 — High** | GAP-12: Real LLM providers | Neuronal mode + agent skill | Medium |
| **P1 — High** | GAP-13: React/TSX support | Largest user segment | Medium |
| **P1 — High** | GAP-11: In-memory graph | Removes Docker barrier | High |
| **P1 — High** | GAP-15: ADR-to-spec via LLM | Living ADR enforcement | Medium |
| **P2 — Medium** | GAP-04: Template function categories | Better preset UX | Low |
| **P2 — Medium** | GAP-05: Cypher template integration tests | Prevent regressions | Medium |
| **P2 — Medium** | GAP-07: no-layer-skip 4+ layer guard | Prevents false positive trap | Low |
| **P2 — Medium** | GAP-08: Inline suppression | Developer ergonomics | Medium |
| **P2 — Medium** | GAP-14: Incremental adoption flags | Team onboarding | Low |
| **P2 — Medium** | GAP-16: Spec validation CLI | Error prevention | Low |

---

### The Plug-and-Play Target State

When all gaps are closed, the experience is:

```bash
# Any TypeScript project — no Docker, no manual YAML, under 2 minutes
npx daedalus-arch init                  # agent/CLI scans project, generates spec
npx daedalus-arch evaluate              # runs in-memory, shows actionable results

# Output:
# Architectural Health: 0.91 (PASS)
# 4 issues found:
#   1. [major] Circular dependency between orders/ and users/ (line 12, 47)
#      Fix: Extract shared types into shared/
#   2. [minor] Domain imports infrastructure (models/user.ts:4 → database/pool.ts)
#      Fix: Depend on a repository interface instead
#   ...
# 20 rules checked, 16 passed, 4 issues, 0 suppressed
```

And in CI:
```yaml
# One line in GitHub Actions — no Neo4j service needed for basic checks
- uses: daedalus-arch/firewall-action@v1
  with:
    spec: firewall.spec.yaml
```

**That** is plug-and-play.
