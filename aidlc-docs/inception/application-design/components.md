# Component Definitions — Architectural Firewall

## Component Overview

8 bounded context modules + CLI entry point + shared domain layer. Each module is a pipeline stage that consumes a typed input and produces a typed output (Pipeline Pattern). Stages are orchestrated as Command objects by a PipelineExecutor.

---

## C1: APG Extractor (`src/apg-extractor/`)

**Bounded Context**: ts-morph parsing, AST traversal, node/edge extraction

**Responsibilities**:
- Parse TypeScript projects using ts-morph in lenient mode
- Extract 5 node types (File, Class, Interface, Method, Function)
- Extract 7 edge types (IMPORTS, IMPLEMENTS, EXTENDS, CONSTRUCTOR_INJECTS, CALLS, DECLARES, CONTAINS)
- Resolve barrel imports, path aliases, decorators, DI type resolution
- Report parse coverage percentage
- Output structured APG JSON

**Input**: `ProjectPath` (path to TypeScript project root)
**Output**: `APGResult` (nodes[], edges[], parseCoverage, warnings[])

**Dependencies**: None (first stage in pipeline)
**External**: ts-morph

---

## C2: Neo4j Ingestion (`src/neo4j-ingestion/`)

**Bounded Context**: Graph database operations, layer annotation, delta APG, snapshot persistence, drift detection

**Responsibilities**:
- Ingest APG JSON into Neo4j (create nodes with labels/properties, create relationships)
- Apply layer annotations based on AoC spec mappings (directory > naming > decorator priority)
- Assign `layer` and `role` properties to nodes; unmapped files get `layer: null`
- Clear graph before ingestion in stateless mode (ADR-010)
- Compute delta APG (incremental update from previous snapshot)
- Persist versioned snapshots (Neo4j for graph data, filesystem for metadata/drift)
- Detect architectural drift (structural, coupling, convention, violation trend)
- Generate drift reports between any two snapshots

**Input**: `IngestionInput` (apgResult, aocSpec.layerMappings, mode: stateless|persistent, commitSha?)
**Output**: `IngestionResult` (graphStats, layerAnnotationSummary, deltaStats?, driftReport?)

**Dependencies**: C1 (APG Extractor output), C4 (AoC Spec for layer mappings)
**External**: Neo4j driver, filesystem (APG_Store)

---

## C3: Spec Parser (`src/spec-parser/`)

**Bounded Context**: AoC YAML parsing, ADR parsing, JSON Schema validation, template resolution

**Responsibilities**:
- Parse 3-layer AoC YAML: Layer A (model), Layer B (fitness functions), Layer C (scoring weights)
- Resolve `style: clean-architecture` to built-in template (17 symbolic + N semantic functions)
- Validate AoC YAML against JSON Schema at parse time (clear errors with line numbers)
- Parse layer definitions (directories, naming conventions, decorator mappings)
- Parse fitness function declarations with dimension, severity, threshold, route
- Validate `semantic_criteria` blocks (rule, rubric required; adr_ref optional)
- Parse neuronal confidence thresholds from Layer C
- Parse ADRs in multiple formats (MADR, Nygard, Y-Statements, custom YAML)
- Produce dual rules per ADR: Cypher-queryable + semantic criteria

**Input**: `SpecInput` (specFilePath, adrDirPath?)
**Output**: `ParsedSpec` (layerModel, fitnessFunctions[], scoringWeights, confidenceThresholds, adrRules[])

**Dependencies**: None (independent stage, runs in parallel with C1)
**External**: YAML parser, JSON Schema validator

---

## C4: Fitness Compiler (`src/fitness-compiler/`)

**Bounded Context**: Cypher query generation, template instantiation

**Responsibilities**:
- Compile each symbolic fitness function to a parameterized Cypher query template
- Instantiate templates with values from AoC YAML spec
- Tag each function with route type (symbolic/neuronal/hybrid) for the router
- Output array of executable queries with metadata (dimension, severity, threshold, route)
- For neuronal/hybrid functions, produce context assembly instructions (not Cypher)

**Input**: `CompilerInput` (parsedSpec.fitnessFunctions)
**Output**: `CompiledFunctions` (symbolicQueries[], neuronalInstructions[], hybridPairs[])

**Dependencies**: C3 (Spec Parser output)
**External**: None

---

## C5: Neuro-Symbolic Router (`src/neuro-symbolic-router/`)

**Bounded Context**: Route dispatch, activation rules, mode selection

**Responsibilities**:
- Route each compiled fitness function to the correct evaluation path based on route tag
- Apply static activation rules: structural/coupling/pattern/convention -> symbolic, semantic/intent -> neuronal, SOLID -> hybrid
- Support `--symbolic-only` mode (skip all neuronal evaluations)
- Support `--neuronal-only` mode (skip all symbolic evaluations — neuronal + hybrid-neuronal only)
- Three modes enable built-in ablation: symbolic-only vs neuronal-only vs full
- Dispatch symbolic functions to Evaluation Engine (C6)
- Dispatch neuronal functions to LLM Critic Agent (C7)
- Dispatch hybrid functions: symbolic first via C6, then neuronal via C7 if symbolic passes
- Tag neuronal results as `deterministic: false`

**Input**: `RouterInput` (compiledFunctions, mode: full|symbolic-only|neuronal-only)
**Output**: `EvaluationResults` (symbolicResults[], neuronalResults[], hybridResults[])

**Dependencies**: C4 (Fitness Compiler output), C6 (Evaluation Engine), C7 (LLM Critic Agent)
**External**: None (orchestrates C6 and C7)

**Note**: The Router is both a pipeline stage and an internal orchestrator — it coordinates the parallel/branching execution of symbolic and neuronal paths. This aligns with the Command pattern (Q2: C) where the router issues sub-commands to C6 and C7.

---

## C6: Evaluation Engine (`src/evaluation-engine/`)

**Bounded Context**: Cypher query execution, result collection

**Responsibilities**:
- Execute compiled Cypher queries against Neo4j graph
- Collect per-function results with violation details (violator file path, source layer, target layer)
- Compute pass/fail per fitness function based on thresholds
- Support APOC plugin for cycle detection (`apoc.path.expandConfig`)
- Return structured symbolic results

**Input**: `SymbolicEvalInput` (cypherQueries[], neo4jConnection)
**Output**: `SymbolicResults` (results[]: { functionId, pass/fail, violations[], executionTimeMs })

**Dependencies**: C2 (graph must be loaded in Neo4j), C4 (compiled queries)
**External**: Neo4j driver (via GraphRepository)

---

## C7: LLM Critic Agent (`src/llm-critic/`)

**Bounded Context**: Context assembly, prompt construction, rubric evaluation, structured verdicts

**Responsibilities**:
- Assemble context packet per evaluation: code snippet + APG subgraph + rule + rubric + optional ADR prose
- Construct evaluation prompts based on semantic_criteria
- Execute LLM API calls (temperature=0, fixed seed) via provider strategy
- Parse structured verdict: { pass/fail/warning, confidence, reasoning, evidence[], violations[] }
- Execute 3-5 runs per evaluation, compute mean +/- stddev and ICC
- Flag unstable functions (ICC < 0.70) for downweighting
- Apply rubric-based evaluation with calibrated scoring criteria
- Log every call (input context, prompt, response) for auditability

**Input**: `NeuronalEvalInput` (neuronalInstructions[], projectSourceFiles, apgSubgraphs, adrFiles?)
**Output**: `NeuronalResults` (results[]: { functionId, verdict, confidence, confidenceStdDev, icc, reasoning, evidence[], violations[], runs[], auditLog })

**Dependencies**: C2 (APG subgraphs from Neo4j), C4 (neuronal instructions from compiler)
**External**: LLM API (Claude/OpenAI via strategy pattern), Neo4j driver (for subgraph queries)

---

## C8: Scoring Engine (`src/scoring-engine/`)

**Bounded Context**: AVR/AHS computation, dual scoring, verdict merge, universal metrics

**Responsibilities**:
- Merge results from symbolic and neuronal paths (Verdict Merge Logic — FR-11)
- Apply confidence calibration thresholds (high >= 0.85, medium 0.60-0.85, low < 0.60)
- Compute AVR per dimension: violated functions / total functions in dimension
- Compute AHS: weighted complement — AHS = Sum(wi * (1 - AVRi))
- Apply Layer C scoring weights across 7 dimensions
- Produce dual scores: `ahs_deterministic` (symbolic only) and `ahs_combined`
- Compute universal health metrics (cycles, fan-out, fan-in, abstraction ratio, instability, orphans)
- Support `--neuronal-only` scoring mode (compute `ahs_neuronal` from semantic + intent + hybrid-neuronal only)
- Tag each result with route and determinism flag
- Produce unified verdict: hard block / soft block / warning / pass
- Generate structured violation report (JSON, human-readable, CSV)

**Input**: `ScoringInput` (symbolicResults, neuronalResults, scoringWeights, confidenceThresholds, mode)
**Output**: `EvaluationReport` (ahsDeterministic, ahsCombined, verdict, perDimensionBreakdown[], violations[], universalMetrics, reportJson, reportHuman, reportCsv?)

**Dependencies**: C5 (Router output — merged symbolic + neuronal results), C3 (scoring weights)
**External**: Neo4j driver (for universal metrics queries)

---

## C9: CLI (`src/cli/`)

**Bounded Context**: Command-line interface, user interaction, output formatting

**Responsibilities**:
- Define CLI commands: `evaluate`, `batch`, `drift`
- Parse flags: `--project`, `--spec`, `--dir`, `--output`, `--format`, `--verbose`, `--neo4j-uri`, `--symbolic-only`
- Orchestrate the pipeline via PipelineExecutor (Command pattern)
- Route JSON output to stdout, human-readable summary to stderr
- Handle exit codes: 0 (pass), 1 (violations), 2 (evaluation error)
- Configure pipeline mode (stateless vs persistent, symbolic-only vs full)

**Input**: CLI arguments
**Output**: Evaluation report to stdout/stderr + exit code

**Dependencies**: All modules (C1-C8) via PipelineExecutor
**External**: Commander.js

---

## C10: Shared Domain (`src/shared/`)

**Bounded Context**: Cross-cutting domain types, value objects, interfaces, violation taxonomy

**Responsibilities**:
- Define domain types: APGNode, APGEdge, FitnessFunction, Violation, Dimension, Severity, Route
- Define value objects (immutable): AVRScore, AHSScore, Confidence, Verdict, CommitSha
- Define interfaces: GraphRepository, LLMProvider, SnapshotStore, PipelineStage, PipelineCommand
- Define violation taxonomy (extensible)
- Define typed intermediate representations for pipeline data flow
- Define Result<T, E> type for error propagation

**Input**: N/A (library, no pipeline input)
**Output**: N/A (types consumed by all modules)

**Dependencies**: None (foundation layer — all modules depend on this)
**External**: None
