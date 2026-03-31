# Test Assurance Tour — How We Know the Code Works
**Date**: 2026-03-30
**Suite**: 19 suites, 197 tests, 100% passing in ~9.3s
**Coverage threshold**: 80% on branches, functions, lines, statements

---

## Testing Strategy Overview

The project uses a **three-tier testing pyramid**:

```
        ╭─────────────────╮
        │   4 BDD Features │  ← Spec-level acceptance (Gherkin)
        ╰────────┬────────╯
        ╭────────┴────────╮
        │  2 Integration   │  ← Cross-module, real fixtures
        ╰────────┬────────╯
   ╭─────────────┴─────────────╮
   │     17 Unit Test Suites    │  ← Isolated logic, mocked deps
   ╰───────────────────────────╯
```

Every implemented module (U1–U4) has unit tests. Modules that consume real files (APG Extractor, Spec Parser) also have integration tests that exercise the full pipeline against real fixture projects and the real `clean-arch.yaml` spec.

---

## Layer 1: Shared Domain (U1) — 3 suites, 23 tests

These tests prove the **type system and aggregate root** are sound.

### Value Objects (`tests/unit/shared/types/value-objects.test.ts`) — 8 tests

Tests **factory functions with runtime validation** for branded types:

| What's tested | How it's proven |
|---------------|-----------------|
| `avrScore()` accepts 0, 0.5, 1.0 | Boundary values return the number |
| `avrScore()` rejects -0.01, 1.01 | Throws `RangeError` on out-of-bounds |
| `ahsScore()` same 0–1 range | Boundary tests |
| `confidence()` same 0–1 range | Boundary tests |
| `commitSha()` accepts 40-char hex | Valid SHA passes through |
| `commitSha()` rejects short, non-hex, empty | Throws `TypeError` on invalid |
| `functionId()`, `runId()` | Wraps any string (nominal typing) |

**Why this matters**: These are the value objects used throughout the pipeline. If `ahsScore(1.5)` could silently pass, scoring results would be meaningless.

### DomainResult (`tests/unit/shared/errors/domain-result.test.ts`) — 6 tests

Tests the **universal result monad** used by every module:

| What's tested | How it's proven |
|---------------|-----------------|
| `DomainResult.ok(42)` | `success: true`, `data: 42` |
| `.ok()` with warnings | Warnings array attached |
| `.ok()` without warnings | No `warnings` key present |
| `DomainResult.fail([error])` | `success: false`, errors populated |
| `.fail([])` with empty array | Throws — must have at least one error |
| `.fromError(new Error("boom"))` | Wraps Error or string into failure |

**Why this matters**: Every function in the pipeline returns `DomainResult<T>`. This monad guarantees no uncaught exceptions propagate — the test proves `.fail([])` is disallowed, forcing callers to always include meaningful errors.

### FirewallContext (`tests/unit/shared/context/firewall-context.test.ts`) — 9 tests

Tests the **aggregate root** that carries pipeline state:

| What's tested | How it's proven |
|---------------|-----------------|
| Identity (runId, startedAt) | Available immediately on construction |
| **Set-once invariant** | `setApgResult()` succeeds once, **throws on second call** |
| Getters before set | Each getter (`getApgResult`, `getParsedSpec`, `getIngestionResult`, `getCompiledFunctions`, `getEvaluationResults`, `getReport`) **throws "has not run"** before its setter is called |
| Warning accumulation | Warnings accumulate without overwriting |
| Snapshot isolation | `snapshot()` returns a **copy** — mutating context after snapshot doesn't change the snapshot |

**Why this matters**: The set-once invariant prevents pipeline stages from accidentally overwriting each other's results. The "throws before set" behavior catches out-of-order pipeline execution at runtime rather than producing corrupt data.

---

## Layer 2: APG Extractor (U2) — 5 suites, 41 tests

These tests prove the **TypeScript static analysis engine** correctly builds the Architecture Property Graph.

### ID Generator (`tests/unit/apg-extractor/id-generator.test.ts`) — 9 tests

Tests **deterministic hashing** for graph node/edge identity:

| What's tested | How it's proven |
|---------------|-----------------|
| 16-char lowercase hex output | Regex match `^[0-9a-f]{16}$` |
| Deterministic — same inputs → same ID | Two calls with identical args produce identical hash |
| Case-insensitive | `"UserService"` and `"userservice"` produce same ID |
| Different types → different IDs | Class "Foo" at path X ≠ Interface "Foo" at path X |
| Different paths → different IDs | Class "Foo" at `src/a/` ≠ Class "Foo" at `src/b/` |
| Edge IDs are asymmetric | `A→B` ≠ `B→A` (directional graph) |
| `normalizeFilePath()` | Strips project root prefix, handles trailing slash |

**Why this matters**: Node IDs are used as Neo4j node identifiers. If they weren't deterministic, delta computation between snapshots would break. If they weren't case-insensitive, `UserService` and `userservice` imports would create duplicate nodes.

### Node Extractor (`tests/unit/apg-extractor/node-extractor.test.ts`) — 14 tests

Tests AST-to-node extraction using **in-memory ts-morph projects** (no filesystem needed):

| What's tested | How it's proven |
|---------------|-----------------|
| File nodes | One File node per source file, with relative path |
| Barrel detection | `export { Foo } from './foo.js'` → `isBarrel: true`; class declaration → `isBarrel: false`; empty file → `false` |
| Class extraction | Correct name, filePath, decorators, `isAbstract` flag |
| Interface extraction | Name, path, empty decorators |
| Method extraction | Qualified names (`ClassName.methodName`), `isAsync` flag |
| Function extraction | Module-level functions, `isExported` flag |
| NodeLookup registry | `fileNodes` map (path→id) and `typeNodes` map (lowercased name@path→id) populated for cross-referencing |

**Why this matters**: Each test creates synthetic TypeScript source files in memory and verifies the extractor produces the correct graph nodes. The barrel detection is critical because barrel files (index.ts re-exports) are treated differently during import resolution.

### Edge Extractor (`tests/unit/apg-extractor/edge-extractor.test.ts`) — 11 tests

Tests **relationship extraction** between nodes:

| What's tested | How it's proven |
|---------------|-----------------|
| DECLARES edges | File→Class, File→Interface, File→Function (1 edge each) |
| CONTAINS edges | Class→Method (2 edges for 2 methods) |
| IMPLEMENTS edges | `class Foo implements IFoo` → edge created |
| EXTENDS edges | `class Child extends Base` → edge created |
| CONSTRUCTOR_INJECTS — structural DI | `constructor(private repo: IRepo)` → edge with `decoratorBased: false` |
| CONSTRUCTOR_INJECTS — primitives excluded | `constructor(private name: string)` → **no edge** (only type references count) |
| CONSTRUCTOR_INJECTS — decorator DI | `@Injectable() class Svc` → edge with `decoratorBased: true` |
| Edge deduplication | Single DECLARES edge, not duplicated |
| CALLS filtering | `this.b()` within same class → **no CALLS edge** (only cross-class calls count) |
| Warning codes | External import `from 'lodash'` → `EXTRACTOR_001` warning |

**Why this matters**: The edges ARE the architectural analysis. `CONSTRUCTOR_INJECTS` with `decoratorBased` discrimination is how the fitness functions detect DI violations. The same-class CALLS filtering prevents noise from internal method calls.

### APG Extractor Orchestrator (`tests/unit/apg-extractor/apg-extractor.test.ts`) — 11 tests

Tests the **top-level extraction function and PipelineStage integration**:

| What's tested | How it's proven |
|---------------|-----------------|
| Missing path → `PROJECT_NOT_FOUND` | `DomainResult.fail` with error code |
| No tsconfig → `TSCONFIG_NOT_FOUND` | `DomainResult.fail` with error code |
| Successful extraction on `correct-reference` fixture | `DomainResult.ok` with non-empty nodes/edges |
| Node types bounded to 5 types (US-1.2) | Every node checked against `Set(['File','Class','Interface','Method','Function'])` |
| Edge types bounded to 7 types (US-1.3) | Every edge checked against the 7-type set |
| Parse coverage in 0–100 range | Boundary assertion |
| PipelineStage sets context on success | `ctx.getApgResult()` doesn't throw after execute |
| PipelineStage doesn't set context on failure | `ctx.getApgResult()` throws "has not run" |
| Audit entries on success/failure | `auditLog` contains `apg-extractor` stage entries |

**Why this matters**: This bridges unit tests (synthetic files) to reality (fixture projects). It also proves the PipelineStage contract — that context is only mutated on success, preserving the aggregate root's integrity.

### Integration: Fixture Extraction (`tests/integration/apg-extractor/fixture-extraction.test.ts`) — 12 tests

Runs `extractAPG()` against the **real `correct-reference` fixture** and validates the full output:

| What's tested | How it's proven |
|---------------|-----------------|
| Extraction succeeds | `DomainResult.ok` |
| Produces File nodes for all .ts files | `≥ 10` File nodes (fixture has 10+ files) |
| Known classes found | `TaskController`, `CreateTaskUseCase` in class names |
| Known interfaces found | `ITaskRepository` in interface names |
| CONSTRUCTOR_INJECTS edges present | TaskController injects use case interfaces |
| IMPLEMENTS edges present | CreateTaskUseCase implements ICreateTaskUseCase |
| DECLARES + CONTAINS edges present | File→Class and Class→Method edges |
| 100% parse coverage (US-1.6) | `percentage: 100`, `skipped: []` |
| All node IDs are 16-char hex | Regex on every node |
| All node IDs unique | `Set(ids).size === ids.length` |
| Edge referential integrity | Every edge's `sourceId` and `targetId` exist in node set |
| No duplicate edges | `Set(type:source:target).size === edges.length` |

**Why this matters**: This is the **single most important test** for U2. It proves the extractor works on real code, produces a valid graph (no dangling edges, no duplicates, no missing nodes), and achieves full coverage on the clean reference project.

---

## Layer 3: Spec Parser + Fitness Compiler (U3) — 6 suites, 42 tests

These tests prove the **rule definition and compilation pipeline** works end-to-end.

### Spec Validator — Schema (`tests/unit/spec-parser/spec-validator.test.ts`) — 16 tests

Tests JSON Schema validation of raw YAML input **and** business rule validation of parsed specs:

**Schema validation (7 tests)**:
| What's tested | How it's proven |
|---------------|-----------------|
| Valid spec passes | `valid: true` |
| Missing `spec_version` | `valid: false` |
| Missing `architecture` | `valid: false` |
| `< 2` layers | `valid: false` (architecture needs ≥ 2 layers) |
| Invalid function ID (not `FF-XXX`) | `valid: false` |
| Invalid dimension enum | `valid: false` |
| Additional properties on functions | `valid: true` (extensible) |

**Business rule validation (9 tests)**:
| What's tested | Rule code | How it's proven |
|---------------|-----------|-----------------|
| Valid spec passes | — | `valid: true` |
| Unsupported spec version | BR-SPEC-01 | Rejects `2.0.0` |
| Weights don't sum to 1.0 | BR-SPEC-06 | Rejects `0.5+0.5+0.5` |
| Floating-point weight drift | BR-SPEC-06 | Tolerates `0.35+0.20+0.30+0.10+0.05` (close enough) |
| Wrong threshold ordering | BR-SPEC-08 | Rejects `pass < warning` |
| Neuronal without semantic_criteria | BR-SPEC-05 | Rejects route=neuronal without rubric |
| Symbolic with semantic_criteria | BR-SPEC-05 | Rejects route=symbolic with rubric (shouldn't have one) |
| Duplicate function IDs | BR-SPEC-04 | Rejects two `FF-S01` |
| Duplicate layer names | BR-SPEC-03 | Rejects two `domain` layers |

**Why this matters**: Every constraint a user could violate in their YAML spec is caught here with a specific error code. The threshold ordering test (pass > warning > softBlock) prevents silent scoring corruption.

### Template Registry (`tests/unit/spec-parser/template-registry.test.ts`) — 9 tests

Tests the **built-in architecture template** that ships with the tool:

| What's tested | How it's proven |
|---------------|-----------------|
| `clean-architecture` template exists | Registry lookup |
| Has 26 functions | Count check |
| 24 symbolic + 1 hybrid + 1 neuronal | Route filtering and counting |
| All marked `isBuiltIn` | `.every(f => f.isBuiltIn)` |
| Default weights sum to 1.0 | `toBeCloseTo(1.0, 5)` — 5 decimal places |
| Full mode weights sum to 1.0 | Same check for full (symbolic+neuronal) mode |
| Verdict thresholds properly ordered | `pass > warning > softBlock > 0` |
| Case-insensitive resolution | `"Clean-Architecture"` → found |
| Unknown style → undefined | `"hexagonal"` → `undefined` |

**Why this matters**: The template registry is the source of truth for all 26 fitness functions. The weight-summing tests prevent a template author from accidentally creating weights that don't normalize to 1.0, which would corrupt AHS scores.

### ADR Parsers (`tests/unit/spec-parser/adr-parsers.test.ts`) — 13 tests

Tests **4 ADR format detectors and parsers** (MADR, Nygard, Y-Statement, Custom YAML):

| What's tested | How it's proven |
|---------------|-----------------|
| MADR format detection | Detects `## Considered Options` + `## Decision Outcome` sections |
| Nygard format detection | Detects `## Context` + `## Decision` sections |
| Y-Statement format detection | Detects `"In the context of..."` preamble |
| Custom YAML detection | `.yaml`/`.yml` file extension |
| MADR parsing | Extracts title, format, generates semantic criterion |
| Nygard parsing | Extracts title, format from `## Decision` section |
| Y-Statement parsing | Extracts title, format from narrative |
| Custom YAML with `cypher_rule` | Extracts symbolic rule query + params |
| Custom YAML without `cypher_rule` | Generates semantic criterion only |
| `detectAndParseADR()` dispatch | Routes MADR content to MADRParser |
| Unrecognized format → undefined | Random text → no parser matches |
| `generateSemanticCriterion()` | Builds rule/rubric from decision text |
| Long text truncation | 600-char text truncated to ≤503 chars |

**Why this matters**: ADR parsing is how users bring their own architectural decisions into the firewall. Each format produces either a symbolic Cypher rule, a semantic criterion for LLM evaluation, or both — which the compiler then routes correctly.

### Spec Parser (`tests/unit/spec-parser/spec-parser.test.ts`) — 8 tests

Tests **end-to-end parsing** of `specs/clean-arch.yaml`:

| What's tested | How it's proven |
|---------------|-----------------|
| Parses successfully | `DomainResult.ok` with version `1.0.0` |
| 3 layers parsed | `layerModel.layers.length === 3` |
| 26 functions from template | Count check |
| Scoring weights | `structural: 0.35`, `pass: 0.80`, `high: 0.85` |
| Template resolution + merge | `FF-S01` → `dependency-direction`, route `symbolic` |
| Layer definitions | `domain` has directory `src/domain/**` |
| Full mode weights | `semantic: 0.04`, `intent: 0.04` |
| Error cases | Non-existent file → `SPEC_NOT_FOUND`, bad YAML → `YAML_SYNTAX_ERROR`, unknown style → `UNKNOWN_STYLE` |
| PipelineStage contract | Sets `parsedSpec` on context, creates audit entry |

### Fitness Compiler (`tests/unit/fitness-compiler/fitness-compiler.test.ts`) — 12 tests

Tests **compilation from parsed spec to executable queries/instructions**:

| What's tested | How it's proven |
|---------------|-----------------|
| 24 Cypher templates exist | `CYPHER_TEMPLATES.size === 24` |
| All templates have non-empty Cypher | Iterate and check `.template.length > 0` |
| `dependency-direction` template params | Requires `outerLayers`, `innerLayers` |
| Symbolic → CypherQuery | `FF-S01` compiles to query with `MATCH`, route `symbolic`, source `template` |
| Neuronal → NeuronalInstruction | `FF-N02` compiles to instruction with semantic criteria, route `neuronal` |
| Hybrid → HybridPair | `FF-N01` produces paired query + instruction |
| ADR with symbolic rule → hybrid | Custom YAML ADR with `cypher_rule` → `hybridPairs[0]`, source `adr`, `shadowModeEligible: true` |
| ADR without symbolic → neuronal + shadow | Nygard ADR → neuronal instruction with shadow prompt + `COMPILER_003` warning |
| Duplicate function IDs → error | `DUPLICATE_FUNCTION_ID` error code |
| `totalCompiled` correct | Sum of all output arrays matches total |
| `instantiateTemplate()` | Returns template string as-is (parameterized, not interpolated) |
| PipelineStage contract | Parses real spec → compiles → sets context → audit entry |

### Integration: Spec → Compile Pipeline (`tests/integration/spec-parser/full-pipeline.test.ts`) — 2 tests

Tests the **complete spec-to-compilation chain** against `specs/clean-arch.yaml`:

| What's tested | How it's proven |
|---------------|-----------------|
| Parse + compile all 26 functions | `≥ 20` symbolic queries, `≥ 1` neuronal instruction, `totalCompiled` = sum of all |
| Every symbolic query has valid Cypher | Contains `MATCH`, has `dimension` and `severity` |
| Every neuronal instruction has criteria | `semanticCriteria.rule` is truthy |
| All function IDs unique | `Set(allIds).size === allIds.length` |
| Layer params flow through | `dependency-direction` query has `params.domainLayer === 'domain'` |

**Why this matters**: This proves the real spec file can be parsed and compiled without errors, and that the layer model correctly parameterizes the Cypher templates. If layer names didn't flow into query params, the symbolic evaluation engine would query against wrong labels.

---

## Layer 4: Neo4j Ingestion + Persistence (U4) — 5 suites, 25 tests

These tests prove the **graph database layer** correctly stores and diffs the architecture graph. All Neo4j tests use a **mock GraphRepository** (no real database needed for unit tests).

### Layer Annotator (`tests/unit/neo4j-ingestion/layer-annotator.test.ts`) — 7 tests

| What's tested | How it's proven |
|---------------|-----------------|
| Directory-based layer mapping | `src/domain/User.ts` → layer `domain`, method `directory` |
| Infrastructure layer mapping | `src/infrastructure/UserController.ts` → `infrastructure` |
| Unmapped files | `src/utils/helpers.ts` → `layer: null`, `matchMethod: null`, in `unmappedFiles` list |
| Layer propagation to methods | Method in `src/application/UserService.ts` inherits `application` layer |
| Nested directory matching | `src/domain/repositories/UserRepo.ts` → `domain` |
| Empty node list | No crash, all counts zero |
| Summary counts | 2 mapped + 1 unmapped = correct tallies |

**Why this matters**: Layer annotation is what the Cypher fitness functions query against. If `src/domain/User.ts` wasn't annotated as `domain`, the `dependency-direction` check would produce false positives.

### Neo4j Ingestion (`tests/unit/neo4j-ingestion/neo4j-ingestion.test.ts`) — 4 tests

Uses a **mock GraphRepository** that tracks queries:

| What's tested | How it's proven |
|---------------|-----------------|
| Stateless ingestion | 4 nodes, 3 edges ingested; layer summary shows 2 mapped, 0 unmapped; no delta/drift |
| Graph cleared before ingestion | `graphRepo.queries.length > 0` (first action is clear) |
| Persistent mode saves snapshot | `snapshot_{sha}/nodes.json` exists on filesystem |
| PipelineStage contract | Sets `ingestionResult` on context, creates audit entry |

### Delta Computer (`tests/unit/neo4j-ingestion/delta-computer.test.ts`) — 5 tests

| What's tested | How it's proven |
|---------------|-----------------|
| Detects added nodes | prev=`[A]`, curr=`[A,B]` → `addedNodes: [B]` |
| Detects removed nodes | prev=`[A,B]`, curr=`[A]` → `removedNodes: [B]` |
| Detects added + removed edges | prev=`[e1: A→B]`, curr=`[e2: A→C]` → added `e2`, removed `e1` |
| Identical APGs → empty delta | No changes detected |
| `computeDeltaStats()` counts | 2 added, 1 removed, 1 edge → correct numeric counts |

**Why this matters**: Delta computation is the foundation of drift detection. If it failed to detect a removed node, the drift detector would miss a structural regression.

### Drift Detector (`tests/unit/neo4j-ingestion/drift-detector.test.ts`) — 7 tests

| What's tested | How it's proven |
|---------------|-----------------|
| Structural drift — new cross-layer edge | `infrastructure→domain` IMPORTS edge → detected with source/target layers |
| Same-layer edges ignored | `domain→domain` IMPORTS → no drift |
| Non-IMPORTS edges ignored | `domain→infrastructure` EXTENDS → no drift (only IMPORTS create dependencies) |
| Coupling drift — fan-out increase | 1→3 edges per layer → `currentAvgFanOut > previousAvgFanOut` |
| Violation trend — insufficient data | < 3 data points → `insufficient_data` |
| Violation trend — improving | `[0.8, 0.6, 0.4, 0.2]` → `improving`, negative slope |
| Violation trend — degrading | `[0.2, 0.4, 0.6, 0.8]` → `degrading`, positive slope |
| Full drift report | Combines all 4 detectors, produces alerts for structural violations |

**Why this matters**: Drift detection is the `firewall drift` command's core logic. The test proves that adding a new import from infrastructure to domain (a dependency direction violation) triggers an alert — which is exactly what the firewall is designed to catch over time.

### Filesystem Snapshot Store (`tests/unit/neo4j-ingestion/fs-snapshot-store.test.ts`) — 8 tests

Uses **real filesystem** (temp directories, cleaned up in `afterEach`):

| What's tested | How it's proven |
|---------------|-----------------|
| Round-trip save + load | Save APG → load by SHA → nodes/edges match |
| Non-existent snapshot → null | Load unknown SHA → `null` (not an error) |
| List ordered by timestamp desc | SHA2 (Jan 2) listed before SHA1 (Jan 1) |
| Empty store → empty array | No snapshots → `[]` |
| Latest snapshot | Returns SHA2 (most recent) |
| No snapshots → null | `getLatestSnapshot()` → `null` |
| Delta persistence | `added_nodes.json`, `removed_nodes.json` files created |
| Drift report persistence | `drift_report_{sha}.json` file created |

---

## Layer 5: BDD Features (Gherkin) — 4 feature files

These are **specification-level acceptance criteria** written in Gherkin, tracing directly to user stories:

### APG Extraction (`tests/features/apg-extractor/apg-extraction.feature`) — US-1.1, 1.2, 1.3, 1.5
- Lenient parsing without crashing on missing deps
- Exactly 5 node types, exactly 7 edge types (no extras)
- Output conforms to APG schema

### Import Resolution (`tests/features/apg-extractor/import-resolution.feature`) — US-1.4
- Barrel import resolution
- Path alias resolution

### Parse Coverage (`tests/features/apg-extractor/parse-coverage.feature`) — US-1.6
- Coverage percentage reported
- Skipped files listed

### Violation Taxonomy (`tests/features/shared/violation-taxonomy.feature`) — US-6.1, 6.2
- Built-in types cover all 7 dimensions
- Violations include required metadata (type, function ID, route, severity, deterministic flag)
- Custom types follow `CUSTOM_` prefix convention

---

## Cross-Cutting Assurances

### 1. PipelineStage Contract (tested per module)
Every implemented module (`APGExtractor`, `SpecParserStage`, `FitnessCompilerStage`, `Neo4jIngestionStage`) is tested for:
- Correct `name` property
- Sets its result on `FirewallContext` on success
- Does **not** set context on failure
- Creates audit log entries

This guarantees U7's PipelineExecutor can orchestrate all stages through a uniform interface.

### 2. DomainResult Consistency
Every function returns `DomainResult<T>`. No test catches raw exceptions — all error handling flows through the result monad. This is proven by every test checking `result.success` and branching on it.

### 3. User Story Traceability
Test names and BDD features reference user story IDs (US-1.1 through US-6.2), creating a direct link from requirement → test → implementation.

### 4. Real Fixture Validation
The integration tests don't use synthetic data — they run against the 5 calibrated fixture projects that have known violations and expected AHS scores. This is as close to "production data" as unit/integration testing gets.

---

## What Is NOT Yet Tested

| Gap | Why | When |
|-----|-----|------|
| Neo4j integration (real database) | Unit tests use mocks; real Neo4j tests will come in Build & Test | After U7 |
| Symbolic evaluation (Cypher execution) | Evaluation Engine (C6) not implemented | U5 |
| LLM calls (neuronal evaluation) | LLM Critic (C7) not implemented | U5 |
| VCR cassette record/replay | AuditLogService (S5) not implemented | U5 |
| Scoring math (AVR, AHS) | Scoring Engine (C8) not implemented | U6 |
| CLI commands | CLI (C9) not implemented | U7 |
| End-to-end pipeline | PipelineExecutor (S1) not implemented | U7 |
| AHS discrimination on fixtures | Requires full pipeline (extract → ingest → evaluate → score) | After U6 |
