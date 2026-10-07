# AoC Specification and Fitness Functions — System Description and Findings

As of 2026-09-20 · derived from commit `7cd15b4` · companion to the Notion draft of thesis Chapter 4.
Living copy: https://claude.ai/code/artifact/ffb34591-f8bf-4c98-9bc8-b16d024d1f08

## Purpose and provenance

This document describes how DaedalusArch's Architecture-as-Code (AoC) specification and its fitness functions actually work, and records every finding made while re-deriving Chapter 4 of the thesis from the code. Counts were obtained by parsing and compiling the shipped specifications with the tool's own parser and compiler. Design history comes from `Docs/ADR — Architectural Decision Records Firewall Tech.md`, `aidlc-docs/`, `Docs/DiagnosticRuns /project-diagnosis-2026-03-30.md`, and the approved proposal. Claims not confirmed by running the system are marked *unverified*.

## System overview

DaedalusArch takes a TypeScript project and an AoC YAML specification and returns a scored verdict. The specification drives every stage after extraction: layer assignment, which checks run, their parameters, and how results are weighed.

```
TypeScript source ──▶ APG extractor (ts-morph) ──▶ Layer annotator ──▶ Neo4j ingestion ──┐
                                                        ▲                                  │
AoC YAML spec ──▶ Spec parser (schema + rules) ─────────┘                                  ▼
                        │                                                             Router
                        └──▶ Fitness compiler (Layer B → Cypher / LLM instructions) ──▶  │
                                                                           ┌──────────────┴──────────────┐
                                                                    Symbolic evaluator             LLM critic
                                                                           └──────────────┬──────────────┘
                                                                              Scoring engine (Layer C) ──▶ Report + verdict
```

Graph: 5 node types (File, Class, Interface, Method, Function), 7 edge types (IMPORTS, IMPLEMENTS, EXTENDS, CONSTRUCTOR_INJECTS, CALLS, DECLARES, CONTAINS). Universal metrics are computed from the graph without a specification and reported outside the score.

## Theory, rationale and limits of the AoC approach

Architecture-as-Code means writing the intended architecture down as a machine-checkable artefact, versioned with the code it governs, instead of as a diagram or a document nobody can execute.

### Where the idea comes from
- **Erosion and conformance checking.** Perry & Wolf (1992) named architectural drift; Murphy, Notkin & Sullivan's reflexion models (1995) map source onto a small high-level model and compare actual vs allowed dependencies. Layer A is a reflexion mapping; dependency-direction is the reflexion comparison.
- **Architectural fitness functions.** Ford, Parsons & Kua (2017): any mechanism giving an objective integrity assessment of an architectural characteristic, run continuously. ArchUnit made them tests; Layer B keeps the concept and changes the medium to declarations.
- **Governance-as-code.** Infrastructure-as-Code showed a declarative, diffable file beats a runbook. SonarQube's Architecture-as-Code and Ford & Richards' ADL (2025) apply this to architecture; this format is more expressive than a forbidden-dependency list and compiles without a language model.

The thesis needs the artefact because generated code arrives faster than review, and existing gates check correctness, style and vulnerabilities but not architectural fit. A specification is the only oracle both precise enough to execute and stable across many generated projects.

### Why a written specification at all
Inferring architecture from the code fails for generated code: one-shot projects have no history, and a generator that misunderstood the architecture produces code consistent with its misunderstanding. A declared specification states intent independently, so the same document instructs the generator (formal-spec condition) and evaluates its output. Spec quality becomes an independent variable because the specification is a separate artefact.

### Why YAML
R1 forced data, not code. Within data formats:

| Candidate | Verdict |
| --- | --- |
| Embedded TS DSL (ArchUnit style) | Language-bound; not translatable without execution; violates R1, R3 |
| JSON authoring | Verbose; kept as the validation mechanism (JSON Schema) |
| TOML | Three-level nesting reads badly |
| Purpose-built DSL | Learning cost, no tooling, another parser |
| Formal ADLs | Expressive, poorly adopted and tooled |
| **YAML** | Convergence of AaC tooling; readable at needed depth; linters, editors, line diffs → reviewable in a PR |

Cost: permissiveness. Extra keys are forbidden on layers and scoring, warned at root, and silently allowed on fitness-function entries (that is where `forbidden_imports` etc. live). The same permissiveness that lets those parameters be written let the parser drop them unnoticed (F1).

### Why ordered layers with membership rules
Layer A answers two questions: which elements belong to which unit (declarative rules) and which units may depend on which (list order). Rules beat annotation (does not scale) and inference (variance, needs labels); they are reproducible and visible, and match how architects speak. Rule order goes from least accidental (directory) to most incidental (decorator).

List order replaced an explicit allowed-dependency graph during construction. Price: the format expresses only a **total order**. It cannot say peers may not import each other, that a module's internals are private behind a public API, or that adapters may depend on ports and core but not on other adapters. The self-spec shows the strain: eight pipeline modules declared as one flat layer with a comment that inter-module imports are not violations. Hexagonal, modular-monolith and feature-sliced styles need a partial order or per-module boundaries Layer A cannot state. This is the format's most important expressiveness limit, independent of the template set.

### The total-order limit in practice
Formally: a list of layers plus a membership function. Dependency-direction flags *i → j* with *i < j*; layer-skip flags any cross-layer import not *i+1 → i*. Together they express one shape: a chain. Real architectures are DAGs or module graphs.

| Situation | What the format does | Example |
| --- | --- | --- |
| Peers that must not import each other | Same layer → *i = j* → nothing fires | HTTP vs persistence adapters; `users` vs `orders` modules |
| Internals private behind an entry point | No module or entry-file notion (only `isBarrel`) | "import `orders` only via `orders/index.ts`" |
| DAG that is not a chain | Linearised; the linear extension permits forbidden edges, skip forbids permitted ones | Presentation using domain types |
| Peers that may import each other but must stay acyclic at module level | Flattened into one layer; file cycles caught, module cycles not | The self-spec's eight modules as `core-modules` |

In the self-spec a `spec-parser` file importing `scoring-engine` is as acceptable as one importing `shared`. The NestJS preset flattens every feature into four pseudo-layers: `users.service.ts` importing `orders.repository.ts` is an allowed application→infrastructure edge regardless of feature isolation.

This is a regression against ADR-004 (`allowed_dependencies` per layer, an explicit DAG) and ADR-006's example query (`NOT target.layer IN $allowedDeps[source.layer]`); the chain replaced both during construction.

Why it matters more than the template set: most TypeScript code bases a governance tool meets (NestJS, Next.js, Angular, Nx/Turborepo monorepos) are module-oriented, and the property their teams most want gated, module isolation, is the one the format cannot state. The proposal's extra styles (hexagonal, layered, onion) are layer-shaped and would fit; the likely users' styles are not.

Fix (no extractor or node-type change):
1. Reinstate optional `allowed_dependencies` per layer; dependency-direction checks set membership as ADR-006 specified; layer-skip disabled when present.
2. Add `modules:` (name, root globs, optional `public_api` globs); annotator sets `File.module` like `layer`.
3. Two T1 templates: `module-boundary` (cross-module import must hit the target's `public_api`) and `module-acyclic` (aggregate IMPORTS to module level, report cycles). Plus one validator rule: no file matches two modules' roots.

Until then, the thesis should state scope: the format and results cover layered architectures with a linear dependency order; module-oriented architectures are outside the evaluated scope and their central constraint is not expressible.

### Why fitness functions are declared, not written
1. **Portability and reuse (R1, R5):** a declaration names a check and parameters, not how it runs; libraries are only possible because content is data.
2. **Determinism (R3):** template bound by name, instantiated from the spec; no generative step.
3. **Auditability:** template text runs unchanged, so the exact query can be published and re-run; a query reads as a claim about the graph.
4. **Scoring (R4):** dimension and severity on each declaration let pass/fail aggregate into AVR/AHS, which the statistical design needs.

A test-style fitness function is a program; a declared one is a record. The program carries its own semantics (expresses anything, runs only where written, only on code that compiles, understood only by reading it). The record carries a name and parameters and the engine carries the semantics, like SQL vs a hand-written scan. The record can be validated before running, published as the exact instrument, calibrated per function, aggregated by dimension, and handed to a generator as its instruction. Compilation is a map lookup plus a parameter map, so the same spec provably yields the same query.

### The closed template set in practice
`name` must be one of 24 strings. Most fitness functions in practice are project-specific (Ford et al.), and that long tail has no symbolic home. Options today:

| Option | Works | Cost |
| --- | --- | --- |
| Neuronal declaration (prose + rubric) | yes | Non-deterministic; Gemini-only provider; tokens; confidence-weighted, not a hard gate; full mode only |
| Custom YAML ADR with `cypher_rule` | yes, emitted as-is | Forced into `intent`/`major`; hybrid with an LLM instruction; no `exclude_paths`; default mapping expects `filePath`; needs an ADR dir |
| Add a template in `cypher-templates.ts` | by forking | Code change + release; map is compiled in |

Why it hurts: the generic layered invariants are what every project shares; what distinguishes a project's architecture is what the catalogue cannot state, and the only route that can is the least trustworthy.

Fix that keeps determinism: allow `cypher_rule` (query, params, result mapping) on a fitness-function declaration, honour dimension/severity/`exclude_paths`, tag `source: custom` and a declared tier, validate with `EXPLAIN` at `validate` time. The ADR path proves the plumbing exists. Second step: load template packs from YAML/JSON at start-up so a style library ships its own templates.

### Why a declaration at all, if every check needs a query
Objection: with a template behind each of the 24 declarations, the declaration looks like indirection. Answer: the two are written by different people, at different times, in different quantities.

Linter analogy: every rule in an ESLint config has an engine implementation written once as an AST visitor; the config is data (which rules, options, severity). Nobody calls the config pointless. Template = rule implementation (once per kind of check); declaration = config entry (once per project); registry = shareable preset.

| Written by | How often | Artefact | Fixes |
| --- | --- | --- | --- |
| Tool author | once per check kind (24) | Cypher template + params + result mapping | meaning against the graph |
| Style author | once per style (2) | library: templates, thresholds, weights | what a style considers canonical |
| Architect | once per project | declarations + Layer A | which checks, which values, which weights |

What the split buys: (1) one template, many meanings via Layer A (`dependency-direction` with different `layerOrder`); (2) a reviewable, promptable 30-line artefact, used both in code review and as the generator's formal-spec input; (3) scoring metadata (dimension, severity, tier, threshold, enable, exclude) on the declaration; (4) validation before execution (known name, bound param, consistent route, valid glob). Limit: only as far as the catalogue reaches; the project-specific tail falls back to ADR Cypher or prose.

### Determinism of the queries
Two senses. **Fixed graph + fixed params → fixed result set:** Cypher is declarative and side-effect free, so verdicts are reproducible. Not fixed, affecting listings only: no `ORDER BY` anywhere (report order); `no-cyclic-deps` has unordered `LIMIT 100` (which cycle paths, and one row per start file/direction so rows ≠ cycles); `use-case-isolation` uses `collect()` (message order). Fix: `ORDER BY` everywhere and before `LIMIT`.

**Across graphs the query is identical and results differ by design.** Graph determinism for a source tree: ts-morph extraction, id generation, annotation and per-run wipe are deterministic. Caveat: `CONSTRUCTOR_INJECTS` targets an `Interface` only when the type resolves, which depends on `tsconfig.json`, installed `node_modules` and the TypeScript version; the same tree with and without dependencies installed gives different dependency-inversion results. Reproducibility holds for source **plus resolution environment**; record it with every run.

**Deterministic ≠ correct.** The April 2026 defects were deterministic wrong queries. Determinism is the precondition for calibrating once against fixtures and trusting afterwards, not a substitute. The neuronal path lacks the precondition (hence confidence weights and instability checks). The `deterministic: true` flag on symbolic results is set by construction, not measured.

### What it gives
~30-line spec when a library fits, reviewable, doubling as prompt and oracle; deterministic published checks (spike: 100% detection, 0.85 → 0.33 monotonic); discrimination on real code (0.54, 0.78, 0.80 on three NestJS projects, no false positives found on inspection, F1 caveat); per-dimension profile; sub-5 s per project.

### What it cannot do
Static only · TypeScript only · linear layering only · closed catalogue (24) · binary per function · mapping unverifiable (seven iterations once) · T2 proxies unlabeled · weights are judgement, no sensitivity analysis · semantic path not reproducible as a gate.

## The AoC specification document

One YAML file, JSON Schema draft-07, version `1.0.0` only.

| Key | Layer | Required | Holds |
| --- | --- | --- | --- |
| `spec_version` | — | yes | Must be `"1.0.0"` |
| `architecture` | A | yes | Optional `style` plus an ordered list of at least two `layers` |
| `fitness_functions` | B | no | Declarations, overrides, disablements; merged over the style library when `style` is set |
| `scoring` | C | yes | `weights` (5 symbolic dims), optional `full_mode_weights` (7), `thresholds` (`pass`, `warning`, `soft_block`) |
| `confidence_thresholds` | C | yes | `high`, `medium`, `icc_minimum`; required even with no neuronal function |

### Layer A: architectural model
Each layer: `name`, non-empty `roles`, and up to three mapping rules: `directories`, `file_patterns`, `decorators`. No other keys. Layers are listed inner to outer and **the order is the dependency rule**: an import from position *i* to *j > i* is a dependency-direction violation; only *i+1 → i* counts as adjacent for layer-skip. There is no `allowed_dependencies` field (the ADR-004 example was replaced by list order). clean-architecture: `domain, application, infrastructure`; nestjs: `domain, infrastructure, application, presentation`.

### Layer B: fitness functions
Required: `id` (`FF-[A-Z]{1,3}[0-9]{2}`), `name`, `dimension`, `severity`, `route`. Optional: `threshold`, `validated`, `enabled`+`reason`, `exclude_paths`, `semantic_criteria`, function-specific parameters. `id` is the merge key against a library; `name` is the lookup key into the fixed Cypher template map.

### Layer C: scoring
`weights` must name structural, coupling, pattern, solid, convention in [0,1], sum 1.0 ± 0.001; semantic/intent default 0. `full_mode_weights` optional, all 7. `thresholds`: pass > warning > soft_block > 0. `confidence_thresholds`: high > medium > 0, icc_minimum > 0.

### Complete example (34 lines, inherits clean-architecture)

```yaml
spec_version: "1.0.0"

architecture:                          # Layer A
  style: clean-architecture            # loads the library's 26 functions and defaults
  layers:                              # inner to outer; order is the dependency rule
    - name: domain
      directories: ["src/domain/**"]
      roles: [entity, value-object, repository-interface]
    - name: application
      directories: ["src/application/**"]
      roles: [use-case, dto]
    - name: infrastructure
      directories: ["src/infrastructure/**"]
      roles: [repository-impl, controller]
      decorators: ["@Controller"]

fitness_functions:                     # Layer B: only what differs from the library
  - id: FF-C02
    name: module-fan-out
    dimension: coupling
    severity: major
    route: symbolic
    threshold: 15                      # library default is 10
    exclude_paths: ["src/composition-root.ts"]
  - id: FF-S03
    name: no-layer-skip
    dimension: structural
    severity: critical
    route: symbolic
    enabled: false
    reason: "three layers: every cross-layer import is adjacent"

scoring:                               # Layer C
  weights: { structural: 0.35, coupling: 0.20, pattern: 0.30, solid: 0.10, convention: 0.05 }
  thresholds: { pass: 0.80, warning: 0.65, soft_block: 0.50 }

confidence_thresholds: { high: 0.85, medium: 0.60, icc_minimum: 0.70 }
```

Without `style`, every function must be declared: `specs/daedalus-arch.yaml` does this in 297 lines with 25 functions.

## Layer annotation

Runs after extraction, before ingestion. First match wins.

| Priority | Rule | Field | Node types | Recorded as |
| --- | --- | --- | --- | --- |
| 1 | Directory glob on file path (picomatch, dot: true) | `directories` | File, Class, Interface | `directory` |
| 2 | File-name glob on file path | `file_patterns` | File, Class, Interface | `filename` |
| 3 | Suffix derived from a role name on the class name | `roles` | Class, Interface | `naming` |
| 4 | Decorator present on the declaration | `decorators` | Class, Interface | `decorator` |
| — | Inherit declaring file's annotation | — | Method, Function | parent's |

Non-obvious behaviours:
- `roles` doubles as the naming rule: `use-case` → `/UseCase$/i`.
- On a directory/file-pattern match the node's `role` is the layer's *first* role; `use-case-isolation` and `controller-no-entity` filter on role names, so role order matters.
- Unmatched nodes get `layer: null`: excluded from layer-filtered templates, included in graph-wide checks and universal metrics. Each run reports mapped/unmapped counts.
- The internal `naming` field is never populated from YAML; the ADR-004 `mappings` block was never implemented.

## Fitness functions

A fitness function is a named, parameterised check over the annotated graph that passes or fails for the whole project, declared as data and executed as Cypher, an LLM judgement, or both.

Lifecycle: declare/inherit → merge by `id` → validate → compile by `name` (template + params) → route → evaluate → AVR/AHS/verdict.

### Declaration fields

| Field | Required | Values | Who reads it |
| --- | --- | --- | --- |
| `id` | yes | `FF-[A-Z]{1,3}[0-9]{2}`, unique | Merge; violation ids; report |
| `name` | yes | Key of a Cypher template | Compiler lookup; evaluator result mapping |
| `dimension` | yes | structural, coupling, pattern, solid, convention, semantic, intent | Scoring |
| `severity` | yes | critical, major, minor, advisory | Report ordering only; not in the score |
| `route` | yes | symbolic, neuronal, hybrid | Compiler output type; router |
| `threshold` | no | number | `$threshold` in metric templates |
| `validated` | no | boolean, default false | Recorded only (spike-validated) |
| `enabled`, `reason` | no | boolean default true; text | Compiler drops and lists as disabled |
| `exclude_paths` | no | glob list | Injected as `AND NONE(ep IN $excludePatterns WHERE <alias>.filePath =~ ep)` before `RETURN` |
| `semantic_criteria` | neuronal/hybrid | `rule`, `adr_ref`?, `rubric{pass, fail, evidence_required}` | LLM critic |
| function-specific | no | `forbidden_imports`, `max_public_methods`, `max_dependencies`, `max_interface_methods`, `max_depth`, `pattern` | Intended for template params; **dropped by the parser (F1)** |

### Template anatomy
Each of the 24 templates: Cypher text with `$param` placeholders, required/optional params, description, result mapping (file-path column + message pattern). Text is sent unchanged with a parameter map; no string interpolation. `dependency-direction` uses `apoc.coll.indexOf` (APOC plugin required, installed by `docker-compose.yml`).

### Parameter binding
1. Layer A: `domainLayer`/`applicationLayer`/`infraLayer` = layers literally named `domain`/`application`/`infrastructure`; `layerOrder`; `allowedTransitions` (`outer>inner` adjacent pairs).
2. Declaration: `threshold`; the six function-specific fields (never arrive, F1).
3. Fixed defaults: `useCaseRoles` = UseCase, Service, Handler; `entityRoles` = Entity, Aggregate, ValueObject; per-layer naming patterns = `.*`.

A template with a missing required parameter still compiles; the gap surfaces only at Neo4j execution.

### Pass and fail
Predicate templates: pass iff zero rows. Metric templates: `violation` boolean column or `ratio` column vs threshold. Each row → violation record (id, type, dimension, severity, function id, file path, message). A query error → warning `EVAL_001`, function omitted from results.

### Routes
- **Symbolic**: one Cypher query, deterministic.
- **Neuronal**: rubric + context packet (code 2000, subgraph 500, rule 300, ADR 500 tokens) to an LLM provider (Gemini, mock, null; cassettes for tests). Verdict has confidence and instability flag.
- **Hybrid**: symbolic first; if it fails, LLM skipped; if it passes, LLM consulted.

### ADR-derived rules
Formats: MADR, Nygard, Y-Statement, custom YAML (`adr:` root). Compiled to neuronal `intent` rules, severity `major`, rubric generated mechanically. Hybrid only when custom YAML carries `cypher_rule`. Shadow-mode comparison is metadata only, not implemented. No ADR yields a deterministic check on its own.

### Auto-disablement
`no-layer-skip` disabled with `COMPILER_004` when < 3 layers and no `file_patterns`.

## The fitness-function catalogue

Tier assigned by construction (predicate = T1, thresholded metric = T2, LLM = T3); no tier field exists. "Bound" = all required params supplied from a shipped library.

| ID | Name | Dim | Sev | Route | Tier | Checks | Parameters | Bound | Spike |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FF-S01 | dependency-direction | structural | critical | symbolic | T1 | Inner→outer import | layerOrder | yes | yes |
| FF-S02 | no-cyclic-deps | structural | critical | symbolic | T1 | Import cycles ≥ 2 (max 100) | — | yes | yes |
| FF-S03 | no-layer-skip | structural | critical | symbolic | T1 | Non-adjacent cross-layer import | allowedTransitions | yes | no |
| FF-S04 | no-domain-outward-dep | structural | major | symbolic | T1 | Domain file importing another layer | domainLayer | yes | no |
| FF-P01 | domain-purity | pattern | critical | symbolic | T1 | Domain importing forbidden package | domainLayer, forbidden_imports | **no** | yes |
| FF-P02 | dependency-inversion | pattern | critical | symbolic | T2 | Interface share of injected deps per app class | applicationLayer, threshold 0.85 | yes | yes |
| FF-P03 | repository-pattern | pattern | critical | symbolic | T1 | Infra repository without domain interface | domainLayer, infraLayer | yes | yes |
| FF-P04 | use-case-isolation | pattern | major | symbolic | T1 | Use case injecting outside domain/app | applicationLayer, domainLayer, useCaseRoles | yes | yes |
| FF-P05 | controller-no-entity | pattern | major | symbolic | T1 | Controller reaching entity ≤ 2 hops | infraLayer, domainLayer, entityRoles | yes | no |
| FF-C01 | domain-stability | coupling | major | symbolic | T2 | Domain instability > threshold | domainLayer, threshold 0.3 | yes | yes |
| FF-C02 | module-fan-out | coupling | major | symbolic | T2 | Fan-out > threshold | threshold 10 (nestjs 12) | yes | yes |
| FF-C03 | component-instability | coupling | major | symbolic | T2 | Instability > threshold | threshold 0.8 | yes | yes |
| FF-C04 | no-orphan-files | coupling | minor | symbolic | T1 | Mapped non-barrel file with no imports | — | yes | no |
| FF-C05 | max-fan-in | coupling | minor | symbolic | T2 | Fan-in > threshold | threshold 15 (nestjs 20) | yes | no |
| FF-C06 | abstraction-ratio | coupling | advisory | symbolic | T2 | Interfaces/(classes+interfaces) < threshold | threshold 0.3 | yes | no |
| FF-SO01 | single-responsibility-proxy | solid | major | symbolic | T2 | Too many methods or deps | max_public_methods 10, max_dependencies 5 | **no** | yes |
| FF-SO02 | interface-segregation-proxy | solid | major | symbolic | T2 | Interface with too many methods | max_interface_methods 5 | **no** | yes |
| FF-SO03 | inheritance-depth | solid | minor | symbolic | T2 | EXTENDS chain > limit | max_depth 3 | **no** | no |
| FF-CV01 | naming-conventions | convention | minor | symbolic | T1 | Class name vs layer pattern | 3 layer names; patterns fixed `.*` | yes, cannot fail | yes |
| FF-CV02 | naming-services | convention | minor | symbolic | T1 | Service/UseCase name pattern | applicationLayer, pattern | **no** | no |
| FF-CV03 | naming-repos | convention | minor | symbolic | T1 | Repository name pattern | pattern | **no** | no |
| FF-CV04 | naming-controllers | convention | minor | symbolic | T1 | Controller name pattern | infraLayer, pattern | **no** | no |
| FF-CV05 | test-file-pairing | convention | advisory | symbolic | T1 | No `.spec.ts`/`.test.ts` sibling | — | yes | no |
| FF-CV06 | no-index-logic | convention | advisory | symbolic | T1 | Barrel file declaring anything | — | yes | no |
| FF-N01 | srp-semantic | solid | major | hybrid | T3 | One reason to change | rubric; **no template** | n/a | no |
| FF-N02 | layering-intent | intent | major | neuronal | T3 | Respects documented intent | rubric | n/a | no |

Totals: 15 T1, 9 T2, 2 T3. 12/26 `validated: true`. 17/24 templates compile fully bound from a shipped library.

## Style libraries and presets

**Template registry** (`src/spec-parser/template-registry.ts`): `clean-architecture` and `nestjs` both point at the same 26 functions, weights and thresholds. Unknown style = fatal.

**Presets** (`presets/*.yaml`): full specs merged with project overrides by `/firewall-init`. This is where the libraries differ.

Merge: library is base; same `id` overrides field-by-field (`SPEC_002` per override); new `id` appended; unmentioned kept; `enabled: false` removes. Loading a preset yields 26 `SPEC_002` warnings (it names `style` and lists every function) and one `SPEC_001` for `default_exclude_paths` (read separately by extraction).

| Property | clean-architecture | nestjs |
| --- | --- | --- |
| Layers, inner→outer | domain, application, infrastructure | domain, infrastructure, application, presentation |
| Mapping rules | directories only | directories, file patterns, decorators |
| Directory globs per layer | 1 | 3–8 |
| File patterns | none | `*.repository.ts`, `*.service.ts`, `*.controller.ts`, `*.module.ts`, guards, interceptors, gateways, DTOs, workers |
| Decorators | none | `@Controller`, `@Module` |
| Forbidden domain imports | `@nestjs/*`, typeorm, express, prisma, `@prisma/*`, sequelize | same without `@nestjs/*` |
| Per-function exclusions | none | `**/*.module.ts` from no-layer-skip |
| Global exclusions | node_modules, dist, spec/test | + `test/**`, `src/generated/**` |
| Fan-out / fan-in | 10 / 15 | 12 / 20 |
| Threshold provenance | spike, 5 fixtures | 3 external NestJS projects, 2026-04-15 |
| Functions / validated | 26 / 12 | 26 / 12 |

Limit on a third library: layer params bind by exact name; `core, ports, adapters` would leave 5 templates without `infraLayer` and 8 without `domainLayer`/`applicationLayer`. The self-spec (`core-modules`) loses four templates this way.

## Validation

Stage 1 fatal. Stage 2 fatal only in strict mode (`strictMode` defaults false; no caller sets it) → warnings in practice. Stage 3 only via `validate`.

| Stage | Code | Condition | On failure |
| --- | --- | --- | --- |
| 1 | `BR-SCHEMA-01` | JSON Schema draft-07 conformance | fatal |
| 1 | `SPEC_NOT_FOUND`, `YAML_SYNTAX_ERROR`, `UNKNOWN_STYLE`, `ZERO_FITNESS_FUNCTIONS` | preconditions | fatal |
| 2 | `BR-SPEC-01` | version 1.0.0 | error → warning |
| 2 | `BR-SPEC-03` | unique layer names | error → warning |
| 2 | `BR-SPEC-04` | unique function ids | error → warning |
| 2 | `BR-SPEC-05` | route ↔ semantic_criteria consistency | error → warning |
| 2 | `BR-SPEC-06/07` | weights sum 1.0 ± 0.001 (`SPEC_003` on normalisation) | error → warning |
| 2 | `BR-SPEC-08` | pass > warning > soft_block > 0 | error → warning |
| 2 | `BR-SPEC-09` | high > medium > 0, icc_minimum > 0 | error → warning |
| 2 | `SPEC_001/002` | unknown key; library override | warning |
| 3 | `LAYER_DIR_NOT_FOUND` | layer directories exist | error |
| 3 | `INVALID_TEMPLATE_REF` | symbolic/hybrid names an existing template | error |
| 3 | `DUPLICATE_FUNCTION_ID`, `INVALID_THRESHOLD`, `INVALID_GLOB_PATTERN` | ids, thresholds, globs | error |

Not implemented though designed: template-layer references declared; no element matches two layers; scoring names only catalogue dimensions; **every required template parameter bound** (would catch F1).

`validate` results: clean-architecture vs `fixtures/correct-reference` → 1 error (FF-N01); nestjs → 17 (16 missing dirs + FF-N01); daedalus-arch vs `.` → 1 (FF-N01).

## Scoring and verdicts

AVR_d = Σ v_f / |functions in d|, with v_f = 1 (symbolic fail), c_f (neuronal fail), 0 (pass). AHS = Σ_d w_d (1 − AVR_d). c_f = 1.0 (≥ high), 0.7 (≥ medium), 0.3 (below), 0.2 (unstable). Symbolic-only uses `weights` (5 dims); full uses `full_mode_weights` (7). Rounded to 3 decimals.

| Verdict | Default condition |
| --- | --- |
| pass | AHS ≥ 0.80 |
| warning | 0.65 ≤ AHS < 0.80 |
| soft-block | 0.50 ≤ AHS < 0.65 |
| hard-block | AHS < 0.50 |

Defaults: 0.35/0.20/0.30/0.10/0.05; full mode 0.32/0.18/0.27/0.10/0.05/0.04/0.04. Thresholds from spike (0.85, 0.66, 0.58, 0.54, 0.33). Weights are a judgement; ADR-007's sensitivity analysis was not done.

Properties: empty dimension → AVR 0 → full weight earned; severity not in score; binary per function (1 vs 50 violating files score the same).

Universal metrics (outside the score): cycle count, max fan-out, max fan-in, abstraction ratio, average instability, orphan-file count.

## Using the system

Neo4j + APOC required (`docker compose up`); no in-memory mode.

| Command | Purpose | Key options |
| --- | --- | --- |
| `evaluate --project <dir> --spec <yaml>` | Full pipeline | `--symbolic-only`, `--neuronal-only`, `--format json\|human\|csv`, `--persist`, `--diff`, `--baseline <file>` |
| `validate --spec <yaml> [--project <dir>]` | Stages 1–3, exit 1 on error | — |
| `batch <dir> --spec <yaml>` | Many projects, CSV row each | `--format`, mode flags |
| `baseline --project --spec -o <file>` | Accept current violations | — |
| `drift --from <sha> --to <sha>` / `--project --spec` | Compare snapshots | `--persist` |
| `report --project --spec -o report.html` | Interactive HTML | mode flags |

Workflow: pick library or `/firewall-init` → set `directories`/`file_patterns` until unmapped count ≈ 0 → `validate` → `evaluate --symbolic-only` and read `EVAL_001` warnings first → `enabled: false`/`exclude_paths`/thresholds with reasons → `baseline`.

## From declarations to Cypher: the hand-off to the next chapter

The specification chapter ends where the compiler emits queries; the conformance-gate chapter (SO3) starts with them.

### What the compiler hands over
Per enabled symbolic/hybrid declaration, one `CypherQuery`:

| Field | Content | Source |
| --- | --- | --- |
| `functionId` | `FF-S01` | declaration `id` |
| `name` | `dependency-direction` | declaration `name`; evaluator's key into result mapping |
| `cypher` | template text unchanged + injected `NONE(...)` exclusion if `exclude_paths` | registry + exclude injector |
| `params` | `layerOrder`, `allowedTransitions`, `domainLayer`, `threshold`, `excludePatterns`, … | Layer A; declaration; fixed defaults |
| `dimension`, `severity`, `threshold` | as declared | declaration |
| `route` | symbolic or hybrid | declaration |
| `source` | `template` or `adr` | compiler |

Per neuronal/hybrid declaration, one `NeuronalInstruction` (rubric + context recipe). Hybrid pairs link one of each. Disabled functions and warnings travel alongside.

### What the queries assume about the graph
Labels `File`, `Class`, `Interface`, `Method`, `Function` with `filePath`, `name`; `layer` set by Layer A or null; `File.isBarrel`; `Class.decorators`; edges IMPORTS, IMPLEMENTS, EXTENDS, CONSTRUCTOR_INJECTS (type-resolved), CONTAINS, DECLARES, CALLS; APOC for `apoc.coll.indexOf`. Queries are only as good as type resolution: dependency-inversion under-reports if ts-morph cannot resolve an interface type.

### How results come back
Rows → violations via result mapping; pass = no rows (predicates) or no flagged row / ratio ≥ threshold (metrics); hybrid runs the query first, LLM only on pass; every result carries its dimension for AVR; an erroring query is logged (`EVAL_001`) and dropped, so executed-function counts must be reported next to every score.

### What the next chapter must show
1. Semantics of each of the 24 templates (15 predicates, 9 metrics) against the graph model.
2. Correctness evidence: five seeded fixtures (A: FF-S01/S02; B: FF-P01/P02/P03/SO02; C: eight across all dims; D: two buried) and three external projects; the six engine defects of 2026-04-15 as how correctness was established.
3. Exclusion as a query transformation and its limits (anchors on the file-path alias).
4. Execution facts: < 5 s per project, APOC, stateless graph per run.
5. Inherited open items: F1 (unbound params) and F6 (layer names). Report with those functions excluded and say so, or fix first.

### The neuronal path
Two T3 functions and ADR rules go to the LLM critic with rubric and bounded context: confidence weighting, instability detection, cassettes, Gemini-only provider. They enter AHS only in full mode via `full_mode_weights`. Treat as a separate experiment with its own validity argument.

## Findings

**F1. Function-specific parameters never reach the compiler** (defect, high, *unverified at runtime*). `parseLayerB` builds declarations from a fixed field list; `buildParams` reads the six custom fields from that object and never finds them. Seven templates compile unbound in every shipped spec (domain-purity, SRP proxy, ISP proxy, inheritance-depth, naming-services, naming-repos, naming-controllers). No parser revision ever preserved the fields. Expected effect: Neo4j parameter error → `EVAL_001` → function absent from AVR numerator and denominator → executable catalogue is 17, the external-project "zero false positives" ran without these checks, every reported AHS omits them. Remedy: carry the fields in `parseLayerB`; add a bound-parameter check; re-run all fixtures and external projects.

**F2. T1/T2 tier tag never implemented** (discrepancy, high on claims). No `tier` anywhere; only `route` (T3) and template shape (T1 vs T2) separate tiers. 0.30 of weight sits in mostly-T2 dimensions; pattern mixes 4 T1 + 1 T2.

**F3. Stage-2 validation is advisory** (gap, medium). `strictMode` false everywhere; malformed weights/thresholds compile with a warning.

**F4. Library fails its own validator** (defect, low). FF-N01 hybrid without template → `INVALID_TEMPLATE_REF` on every spec; degrades to neuronal-only.

**F5. `naming-conventions` cannot fail** (defect, low). Patterns fixed to `.*`, yet `validated: true`.

**F6. Layer params bind by fixed names** (limitation, medium). Non-standard layer names lose 5–8 templates; self-spec loses 4.

**F7. Three designed cross-reference checks missing** (gap, medium). Would have caught F1 and F6.

**F8. Two libraries share one catalogue** (discrepancy, medium). Proposal: 2–4 styles; delivered: 1 style + 1 framework layout; fidelity to named styles never validated.

**F9. Empty dimension earns full credit** (design consequence, low–medium). Combined with F1, execution failures silently improve scores.

**F10. ADR/implementation drift** (documentation, low). `allowed_dependencies`/`mappings` never built; mapping order differs; ADR-006 Cypher differs; ADR-007 weights superseded; ADR parser does produce (neuronal) rules.

## How the design was arrived at

| Date | Event | What it changed |
| --- | --- | --- |
| March 2026 | Spike: 17 queries, 5 fixtures, AHS 0.85→0.33, 100% detection, < 5 s | Data-not-code rules viable; graph schema; thresholds 0.80/0.65/0.50 |
| 2026-03-27 | ADR-001..014 | YAML, 3 layers, parameterised Cypher, name-based mapping, AVR/AHS, universal metrics |
| 2026-03-30 | Unit 3: parser, schema, validator, registry, compiler | 17 → 24 templates + 2 rubrics; `route`, `semantic_criteria`, `validated`; ADR parsers; the field list behind F1 |
| 2026-04-01 | Self-evaluation, 7 runs (0.867 → 0.180 → 0.530) | Found inverted direction query, overlapping sets, layer-skip on 3 layers, undisableable functions, cosmetic `exclude_paths`; 16-gap analysis |
| 2026-04-15/16 | v1.1 + 3 external projects | `enabled`/`reason`, `exclude_paths` injection, `file_patterns`, `validate`, presets, `/firewall-init`; 6 engine bugs fixed; NestJS thresholds |

Self-evaluation record:

| Run | AHS | Violations | Change | Revealed | Class |
| --- | --- | --- | --- | --- | --- |
| 1 | 0.867 | 10 | Unmodified library | Layer dirs absent; checks vacuous | spec |
| 2 | 0.180 | 485 | Layers remapped | Every module→kernel import flagged | spec, then engine |
| 3 | 0.180 | 569 | Order reversed | Query matched permitted direction | engine |
| 4 | 0.180 | 452 | Direction fixed | Overlapping inner/outer sets | engine |
| 5 | 0.180 | 377 | Modules collapsed | Still both sets | engine |
| 6 | 0.180 | 423 | Ordinal rewrite | No-layer-skip fires on all cross-layer imports | engine |
| 7 | 0.530 | 171 | Library removed | Undisableable functions; `exclude_paths` no effect | format |

Two runs fixed the spec, four the engine, one the format.

## Delivered against the proposal

| Commitment | Delivered | Status |
| --- | --- | --- |
| 3-layer YAML with formal schema | Draft-07 schema, 3 layers, 2 + 1 validation stages | met |
| Layer B carries T1/T2 tags | none | not met |
| Violation report includes tier | none | not met |
| 2–3 / 3–4 styles (clean, hexagonal, layered, onion) | 2 libraries, one catalogue | partly |
| ~30 lines per spec | 34 with library; 297 without; 7 iterations to correct | length met, effort not shown |
| Schema validator | yes; business rules advisory | met with caveat |
| 30+ Cypher rules, 7 symbolic dims | 24 templates, 5 dims; 17 fully bound (pending F1) | not met |
| 2 LLM-judged dims | semantic, intent; 2 rubric functions; Gemini only | partly |
| Non-compiling rules documented as boundary | Ch. 4 §4.5.2: schema, template set, binder | met |
| Expressiveness / coverage / pass-rate metrics | undefined / 1+1 / not measured | not met |

## Recommended actions

1. Verify F1 on live Neo4j (`evaluate --symbolic-only` on `fixtures/correct-reference`, expect 7 × `EVAL_001`); record the error text in Ch. 4.
2. Fix F1 in `parseLayerB`; add a bound-parameter stage-2 rule; re-run fixtures and external projects; update all quoted AHS values.
3. Decide on tiers (F2): add optional `tier` enum or report by construction.
4. Make stage 2 fatal or document it as advisory (F3).
5. Repair FF-N01 and FF-CV01 (F4, F5).
6. Resolve layers by position/role (F6); then a hexagonal library becomes possible (F8).
7. Add the three missing cross-reference checks (F7).
8. Decide how to report F9.
9. Reconcile ADRs (F10).
10. Fix thesis wording for library and rule counts.

### Reproducing the counts

```typescript
import { parseSpec, validateSpecAgainstProject } from './src/spec-parser/index.js';
import { compileFunctions } from './src/fitness-compiler/fitness-compiler.js';
import { CYPHER_TEMPLATES } from './src/fitness-compiler/cypher-templates.js';

(async () => {
  for (const [spec, proj] of [
    ['presets/clean-architecture.yaml', 'fixtures/correct-reference'],
    ['presets/nestjs.yaml', 'fixtures/correct-reference'],
    ['specs/daedalus-arch.yaml', '.'],
  ]) {
    const r = await parseSpec({ specFilePath: spec });
    if (!r.success) { console.log(spec, r.errors); continue; }
    const v = validateSpecAgainstProject(r.data, proj);
    const c = compileFunctions({ ...r.data, adrRules: r.data.adrRules });
    if (!c.success) { console.log(spec, c.errors); continue; }
    const unbound = c.data.symbolicQueries.flatMap(q =>
      CYPHER_TEMPLATES.get(q.name)!.requiredParams
        .filter(p => q.params[p] === undefined).map(p => `${q.name}:$${p}`));
    console.log(spec, { declared: r.data.fitnessFunctions.length,
      symbolic: c.data.symbolicQueries.length, neuronal: c.data.neuronalInstructions.length,
      validationErrors: v.errors.map(e => e.code), unbound });
  }
})();
```

Output at `7cd15b4`: clean-architecture 26/24/2, 1 validation error, 8 unbound params across 7 functions; nestjs identical + 16 missing-directory errors vs that fixture; daedalus-arch 25/23/2, 1 error, 13 unbound across 11 functions.
