# User Stories — Architectural Firewall (DaedalusArch)

## Story Format

Each story follows: `As a [persona], I want [goal], so that [benefit]`

- **Priority**: Must / Should / Could / Won't (MoSCoW)
- **Persona**: DEV (Developer), ARCH (Architect), LEAD (Team Lead)
- **Traces to**: FR/NFR requirement ID
- **Acceptance Criteria**: Gherkin Given/When/Then
- **Constraints**: METH-01 (BDD), METH-02 (TDD), METH-03 (DDD) apply to all stories

---

# Epic 1: APG Extraction (FR-01)

## US-1.1: Parse TypeScript Project

**As a** DEV, **I want** the firewall to parse my TypeScript project using ts-morph in lenient mode, **so that** it can analyze my codebase even when some dependencies are missing.

- **Priority**: Must
- **Traces to**: FR-01.1
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given a TypeScript project at path "./my-project"
When the APG extractor runs with lenient mode enabled
Then the project is parsed without crashing on missing dependencies
And unresolvable imports are skipped with warnings
```

---

## US-1.2: Extract Node Types

**As a** DEV, **I want** the extractor to identify all Files, Classes, Interfaces, Methods, and Functions in my project, **so that** the architectural property graph captures the full code structure.

- **Priority**: Must
- **Traces to**: FR-01.2
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given a TypeScript project with classes, interfaces, methods, and functions
When the APG extractor runs
Then it produces nodes of exactly 5 types: File, Class, Interface, Method, Function
And each node has a unique identifier, name, and file path
```

---

## US-1.3: Extract Edge Types

**As a** DEV, **I want** the extractor to capture all relationships between code elements, **so that** the graph represents imports, inheritance, DI, and call patterns.

- **Priority**: Must
- **Traces to**: FR-01.3
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given a TypeScript project with imports, class inheritance, and DI
When the APG extractor runs
Then it produces edges of exactly 7 types: IMPORTS, IMPLEMENTS, EXTENDS, CONSTRUCTOR_INJECTS, CALLS, DECLARES, CONTAINS
And each edge references valid source and target node identifiers
```

---

## US-1.4: Resolve Complex Imports

**As a** DEV, **I want** the extractor to resolve barrel imports, path aliases, decorators, and DI type resolution, **so that** the graph is accurate even for projects with complex module structures.

- **Priority**: Must
- **Traces to**: FR-01.4
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given a project using barrel imports (index.ts re-exports) and tsconfig path aliases
When the APG extractor runs
Then barrel imports are resolved to their actual source files
And path aliases are resolved to their mapped directories
And decorator metadata is extracted
And constructor injection types are resolved to their concrete implementations
```

---

## US-1.5: Output APG as JSON

**As a** DEV, **I want** the APG output as structured JSON with nodes and edges arrays, **so that** it can be ingested by downstream pipeline stages.

- **Priority**: Must
- **Traces to**: FR-01.5
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given a successfully parsed TypeScript project
When the APG extractor completes
Then it outputs a JSON object with "nodes" and "edges" arrays
And the JSON conforms to the APG schema (5 node types, 7 edge types)
```

---

## US-1.6: Report Parse Coverage

**As a** DEV, **I want** the extractor to report what percentage of files were successfully parsed, **so that** I know if the analysis is comprehensive or partial.

- **Priority**: Must
- **Traces to**: FR-01.6
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given a project with 10 TypeScript files, 2 of which have unresolvable imports
When the APG extractor runs in lenient mode
Then it reports parse coverage as 80% (8/10 files)
And lists the 2 skipped files with reasons
```

---

# Epic 2: Neo4j Ingestion + Layer Annotation (FR-02)

## US-2.1: Ingest APG into Neo4j

**As a** DEV, **I want** the APG JSON to be loaded into Neo4j as graph nodes and relationships, **so that** fitness functions can query the architectural structure.

- **Priority**: Must
- **Traces to**: FR-02.1
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given a valid APG JSON with nodes and edges
When the ingestion module runs against a Neo4j instance
Then all nodes are created with correct labels and properties
And all edges are created as relationships with correct types
And the graph is queryable via Cypher
```

---

## US-2.2: Apply Layer Annotations

**As an** ARCH, **I want** nodes in the graph to be annotated with their architectural layer based on AoC spec mappings, **so that** layer-dependent fitness functions can evaluate compliance.

- **Priority**: Must
- **Traces to**: FR-02.2, FR-02.3
- **Persona**: ARCH

**Acceptance Criteria**:
```gherkin
Given an AoC YAML spec with layer definitions (directories, naming, decorators)
And an APG loaded in Neo4j
When layer annotation runs
Then each node receives "layer" and "role" properties
And annotations follow priority order: directory > naming > decorator
```

---

## US-2.3: Handle Unmapped Files

**As an** ARCH, **I want** files that match no mapping rule to be tagged with `layer: null`, **so that** they are excluded from layer-dependent evaluations without breaking the pipeline.

- **Priority**: Must
- **Traces to**: FR-02.4
- **Persona**: ARCH

**Acceptance Criteria**:
```gherkin
Given a file "src/utils/helpers.ts" that matches no layer mapping rule
When layer annotation runs
Then the file node has layer = null
And layer-dependent fitness functions skip this node
And the file still appears in universal metrics (orphan detection)
```

---

## US-2.4: Stateless Per-Project Evaluation

**As a** DEV, **I want** the graph to be cleared before each standalone evaluation, **so that** results are isolated and reproducible per project.

- **Priority**: Must
- **Traces to**: FR-02.5
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given a Neo4j instance with data from a previous evaluation
When I run "firewall evaluate" on a new project in stateless mode
Then the graph is cleared before ingestion
And results reflect only the current project's structure
```

---

# Epic 3: APG Persistence, Snapshots, and Drift Detection (FR-03)

## US-3.1: Versioned Snapshots

**As an** ARCH, **I want** the APG to be persisted as a versioned snapshot tied to the commit SHA, **so that** I can track architectural state across releases.

- **Priority**: Must
- **Traces to**: FR-03.1
- **Persona**: ARCH

**Acceptance Criteria**:
```gherkin
Given a project evaluated at commit "abc123"
When the evaluation completes in persistent mode
Then a snapshot is stored at APG_Store/snapshot_abc123/
And it contains nodes.json, edges.json, and metadata.json
And metadata includes timestamp, author, and AVR at that commit
```

---

## US-3.2: Delta APG (Incremental Update)

**As a** DEV, **I want** the firewall to update only the nodes and edges affected by changed files, **so that** CI evaluations are fast on typical PR-sized changes.

- **Priority**: Must
- **Traces to**: FR-03.2
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given an existing APG snapshot for commit "abc123"
And a PR modifying 3 files since that commit
When delta APG computation runs
Then only nodes and edges from the 3 modified files are recomputed
And the base APG is updated incrementally
And delta computation completes in < 2 seconds
```

---

## US-3.3: Snapshot Storage Model

**As an** ARCH, **I want** snapshots to include full graphs, deltas between commits, and drift reports, **so that** I have a complete historical record.

- **Priority**: Must
- **Traces to**: FR-03.3
- **Persona**: ARCH

**Acceptance Criteria**:
```gherkin
Given evaluations at commit "abc123" and commit "def456"
When both evaluations complete in persistent mode
Then APG_Store contains snapshot_abc123/ and snapshot_def456/
And APG_Store contains delta_abc123_def456/ with added/removed nodes and edges
And APG_Store contains drift_report_def456.json
```

---

## US-3.4: Structural Drift Detection

**As an** ARCH, **I want** the tool to detect new dependencies between previously decoupled modules, **so that** I catch structural drift before it accumulates.

- **Priority**: Must
- **Traces to**: FR-03.4 (structural drift)
- **Persona**: ARCH

**Acceptance Criteria**:
```gherkin
Given snapshot A where modules "auth" and "billing" have zero IMPORTS edges between them
And snapshot B where a new IMPORTS edge exists between "auth" and "billing"
When drift detection compares A and B
Then it reports structural drift: new cross-module dependency between auth and billing
```

---

## US-3.5: Coupling Drift Detection

**As an** ARCH, **I want** the tool to detect sustained increases in average fan-out, **so that** I catch coupling degradation early.

- **Priority**: Must
- **Traces to**: FR-03.4 (coupling drift)
- **Persona**: ARCH

**Acceptance Criteria**:
```gherkin
Given consecutive release snapshots where average fan-out grows > 15%
When drift detection runs
Then it reports coupling drift with the fan-out delta percentage
And identifies the top contributors to fan-out growth
```

---

## US-3.6: Convention and Violation Trend Drift

**As an** ARCH, **I want** the tool to detect erosion of naming/layer conventions and cumulative AVR increases, **so that** gradual architectural decay is visible.

- **Priority**: Must
- **Traces to**: FR-03.4 (convention drift, violation trend)
- **Persona**: ARCH

**Acceptance Criteria**:
```gherkin
Given snapshots where the percentage of nodes meeting conventions decreases
When drift detection runs
Then it reports convention drift with the percentage delta
And reports violation trend drift if AVR increases steadily across commits
```

---

## US-3.7: Drift Reports Between Snapshots

**As an** ARCH, **I want** to generate a drift report comparing any two snapshots, **so that** I can visualize architectural changes across any time range.

- **Priority**: Should
- **Traces to**: FR-03.5
- **Persona**: ARCH

**Acceptance Criteria**:
```gherkin
Given two snapshot commit SHAs "abc123" and "xyz789"
When I run "firewall drift --from abc123 --to xyz789"
Then a drift report is generated with metrics for all 4 drift types
And the report includes delta visualization (added/removed nodes and edges)
```

---

## US-3.8: CI/CD Drift Threshold Alerts

**As a** LEAD, **I want** CI/CD to alert when drift metrics exceed configurable thresholds, **so that** PRs causing architectural degradation are flagged automatically.

- **Priority**: Should
- **Traces to**: FR-03.6
- **Persona**: LEAD

**Acceptance Criteria**:
```gherkin
Given a drift threshold configuration in .firewall.yaml (e.g., max coupling drift 15%)
When a PR evaluation detects coupling drift exceeding 15%
Then the PR comment includes a drift alert
And the check status reflects the drift violation
```

---

# Epic 4: AoC YAML Spec Parsing (FR-04)

## US-4.1: Parse 3-Layer AoC YAML

**As an** ARCH, **I want** the spec parser to read Layer A (model), Layer B (fitness functions), and Layer C (scoring), **so that** the full architectural specification is loaded.

- **Priority**: Must
- **Traces to**: FR-04.1
- **Persona**: ARCH

**Acceptance Criteria**:
```gherkin
Given a valid AoC YAML file with all 3 layers
When the spec parser runs
Then Layer A (model with layers and mappings) is parsed
And Layer B (fitness functions with dimensions and routes) is parsed
And Layer C (scoring weights and thresholds) is parsed
```

---

## US-4.2: Auto-Load Clean Architecture Template

**As an** ARCH, **I want** to specify `style: clean-architecture` to auto-load 17 symbolic + N semantic fitness functions, **so that** I don't have to define every function manually.

- **Priority**: Must
- **Traces to**: FR-04.2
- **Persona**: ARCH

**Acceptance Criteria**:
```gherkin
Given an AoC YAML with "style: clean-architecture"
When the spec parser runs
Then 17 symbolic fitness functions are loaded from the built-in template
And semantic fitness functions (abstraction-quality, naming-coherence) are loaded
And intent fitness functions (ADR-prose-compliance, framework-agnosticism) are loaded
And the architect can override any template function
```

---

## US-4.3: JSON Schema Validation

**As an** ARCH, **I want** the AoC YAML validated against a JSON Schema at parse time, **so that** spec errors are caught early with clear messages.

- **Priority**: Should
- **Traces to**: FR-04.3
- **Persona**: ARCH

**Acceptance Criteria**:
```gherkin
Given a malformed AoC YAML missing a required "dimension" field on a fitness function
When the spec parser runs
Then it reports a validation error with the line number and field name
And parsing halts with a clear, actionable error message
```

---

## US-4.4: Layer Definitions

**As an** ARCH, **I want** to define layers with directories, naming conventions, and decorator mappings, **so that** the tool knows how to annotate the APG.

- **Priority**: Must
- **Traces to**: FR-04.4
- **Persona**: ARCH

**Acceptance Criteria**:
```gherkin
Given an AoC YAML Layer A defining: domain layer = "src/domain/**", naming = "*Entity.ts", decorator = "@Entity"
When the spec parser runs
Then it produces 3 mapping rules for the domain layer (directory, naming, decorator)
And priority order is preserved: directory > naming > decorator
```

---

## US-4.5: Fitness Function Route Tags

**As an** ARCH, **I want** each fitness function to declare its route (symbolic / neuronal / hybrid), **so that** the neuro-symbolic router knows where to dispatch it.

- **Priority**: Must
- **Traces to**: FR-04.5
- **Persona**: ARCH

**Acceptance Criteria**:
```gherkin
Given an AoC YAML with fitness functions tagged route: "symbolic", "neuronal", "hybrid"
When the spec parser runs
Then each parsed fitness function includes a "route" property
And valid route values are: symbolic, neuronal, hybrid
And invalid route values produce a validation error
```

---

## US-4.6: Semantic Criteria Blocks

**As an** ARCH, **I want** neuronal/hybrid fitness functions to require a `semantic_criteria` block with rule, adr_ref, and rubric, **so that** the LLM Critic has structured evaluation context.

- **Priority**: Must
- **Traces to**: FR-04.6
- **Persona**: ARCH

**Acceptance Criteria**:
```gherkin
Given a neuronal fitness function without a semantic_criteria block
When the spec parser validates
Then it reports an error: "semantic_criteria required for neuronal/hybrid route"

Given a neuronal fitness function with semantic_criteria containing rule, rubric (pass/fail/evidence_required)
When the spec parser validates
Then it passes validation
And adr_ref is optional but validated if present
```

---

## US-4.7: Neuronal Confidence Thresholds

**As an** ARCH, **I want** Layer C to support separate confidence thresholds for neuronal assessments, **so that** I can tune how much weight LLM verdicts carry.

- **Priority**: Should
- **Traces to**: FR-04.7
- **Persona**: ARCH

**Acceptance Criteria**:
```gherkin
Given an AoC YAML Layer C with neuronal_confidence_thresholds: { high: 0.85, medium: 0.60 }
When the spec parser runs
Then neuronal confidence thresholds are available to the verdict merge logic
And default thresholds apply if not specified
```

---

# Epic 5: ADR Parsing and Ingestion (FR-05)

## US-5.1: Multi-Format ADR Parsing

**As an** ARCH, **I want** the tool to parse ADRs in MADR, Nygard, Y-Statements, and custom YAML formats, **so that** it works with whatever ADR format my team uses.

- **Priority**: Must
- **Traces to**: FR-05.1
- **Persona**: ARCH

**Acceptance Criteria**:
```gherkin
Given ADR files in MADR format
When the ADR parser runs
Then it extracts the decision, context, and consequences
And produces graph-queryable rules and semantic criteria

Given ADR files in Nygard format
When the ADR parser runs
Then it extracts the same structured output
```

---

## US-5.2: Dual Rule Production

**As an** ARCH, **I want** each ADR to produce both Cypher-queryable rules (symbolic) and natural language semantic criteria (neuronal), **so that** both evaluation paths can enforce ADR compliance.

- **Priority**: Must
- **Traces to**: FR-05.2
- **Persona**: ARCH

**Acceptance Criteria**:
```gherkin
Given an ADR stating "Domain layer must not depend on infrastructure"
When the ADR parser processes it
Then it produces a symbolic rule compilable to a Cypher query
And it produces a semantic criterion with rule text and rubric for LLM evaluation
```

---

## US-5.3: Manual AoC YAML Authoring (v1)

**As an** ARCH, **I want** to manually write AoC YAML with semantic criteria derived from my ADRs, **so that** I control exactly what is evaluated and how.

- **Priority**: Must
- **Traces to**: FR-05.3
- **Persona**: ARCH

**Acceptance Criteria**:
```gherkin
Given an architect manually writing AoC YAML
When they include adr_ref pointing to an ADR file
Then the system loads the ADR prose at evaluation time for LLM context
And the architect retains full control over rule and rubric definitions
```

---

## US-5.4: ADR Reference Validation

**As an** ARCH, **I want** `adr_ref` file paths validated at evaluation time, **so that** I'm warned if a referenced ADR is missing but the evaluation still proceeds.

- **Priority**: Should
- **Traces to**: FR-05.4
- **Persona**: ARCH

**Acceptance Criteria**:
```gherkin
Given a fitness function with adr_ref: "./docs/adr/ADR-005.md"
And the file does not exist
When evaluation runs
Then a warning is emitted: "ADR file not found: ./docs/adr/ADR-005.md"
And evaluation proceeds without the ADR prose context
And results are not blocked
```

---

# Epic 6: Violation Taxonomy (FR-06)

## US-6.1: Consolidated Violation Types

**As a** DEV, **I want** violations categorized by a consolidated taxonomy, **so that** I understand the type and severity of each violation.

- **Priority**: Must
- **Traces to**: FR-06.1, FR-06.2
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given a violation detected by a fitness function
When the violation is reported
Then it includes: violation type, detecting fitness function, route (symbolic/neuronal/hybrid), severity (critical/major/minor/advisory)
And the type maps to the consolidated taxonomy
```

---

## US-6.2: Custom Violation Types

**As an** ARCH, **I want** to define custom violation types in the AoC YAML, **so that** the taxonomy fits my project's specific architectural rules.

- **Priority**: Should
- **Traces to**: FR-06.3
- **Persona**: ARCH

**Acceptance Criteria**:
```gherkin
Given an AoC YAML with a custom violation type "microservice-boundary-breach"
When the spec parser processes it
Then the custom type is added to the violation taxonomy
And fitness functions can reference it
```

---

# Epic 7: Fitness Function Compiler (FR-07)

## US-7.1: Compile to Cypher

**As a** DEV, **I want** each symbolic fitness function compiled to a parameterized Cypher query, **so that** evaluation runs deterministic graph queries.

- **Priority**: Must
- **Traces to**: FR-07.1, FR-07.2
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given a fitness function "dependency-direction" from the AoC YAML
When the compiler runs
Then it produces a valid parameterized Cypher query template
And template parameters are filled from the AoC YAML spec values
```

---

## US-7.2: Support 7 Dimensions

**As an** ARCH, **I want** the compiler to handle fitness functions across all 7 dimensions with correct route tagging, **so that** both symbolic and neuronal paths receive their functions.

- **Priority**: Must
- **Traces to**: FR-07.3, FR-07.4, FR-07.5
- **Persona**: ARCH

**Acceptance Criteria**:
```gherkin
Given a full AoC YAML with functions across structural, coupling, pattern, SOLID, convention, semantic, and intent dimensions
When the compiler runs
Then it outputs an array of executable queries with metadata: dimension, severity, threshold, route
And symbolic-only dimensions produce Cypher queries
And neuronal-only dimensions produce context assembly instructions
And hybrid dimensions produce both Cypher queries and neuronal fallback instructions
```

---

# Epic 8: Neuro-Symbolic Router (FR-08)

## US-8.1: Route Dispatch

**As a** DEV, **I want** each fitness function dispatched to the correct evaluation path based on its route tag, **so that** structural rules go through Cypher and semantic rules go through the LLM Critic.

- **Priority**: Must
- **Traces to**: FR-08.1, FR-08.2, FR-08.3
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given fitness functions with routes: structural (symbolic), semantic (neuronal), SOLID (hybrid)
When the router dispatches
Then structural functions execute via Cypher against Neo4j
And semantic functions execute via the LLM Critic Agent
And SOLID functions execute Cypher first, then LLM Critic if symbolic passes
And the same function always takes the same route (deterministic dispatch)
```

---

## US-8.2: Neuronal Result Tagging

**As a** DEV, **I want** neuronal evaluation results tagged as `deterministic: false`, **so that** I know which results may vary across runs.

- **Priority**: Must
- **Traces to**: FR-08.4
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given a neuronal fitness function evaluation result
When the result is produced
Then it includes "deterministic": false
And symbolic results include "deterministic": true
```

---

## US-8.3: Symbolic-Only Mode

**As a** LEAD, **I want** a `--symbolic-only` flag that skips all neuronal evaluations, **so that** I can get fully deterministic results for governance decisions.

- **Priority**: Must
- **Traces to**: FR-08.5
- **Persona**: LEAD

**Acceptance Criteria**:
```gherkin
Given the flag --symbolic-only is set
When evaluation runs
Then no LLM Critic calls are made
And only symbolic and hybrid-symbolic results are returned
And all results have "deterministic": true
And semantic/intent dimensions are excluded from AHS
```

---

# Epic 9: Evaluation Engine — Symbolic Path (FR-09)

## US-9.1: Execute Cypher Queries

**As a** DEV, **I want** compiled Cypher queries executed against the Neo4j graph, **so that** symbolic fitness functions produce deterministic violation results.

- **Priority**: Must
- **Traces to**: FR-09.1, FR-09.2, FR-09.3
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given compiled Cypher queries for 17 symbolic fitness functions
And an APG loaded in Neo4j
When the symbolic evaluation engine runs
Then each query executes against the graph
And violations include: violator file path, source layer, target layer
And pass/fail is determined per function based on thresholds
```

---

## US-9.2: Cycle Detection with APOC

**As a** DEV, **I want** the evaluation engine to detect circular dependencies using the APOC plugin, **so that** the no-circular-dependencies fitness function works.

- **Priority**: Must
- **Traces to**: FR-09.4
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given a project with a circular dependency: A -> B -> C -> A
When the no-circular-dependencies fitness function runs
Then the APOC expandConfig detects the cycle
And the violation report includes the cycle path: A -> B -> C -> A
```

---

# Epic 10: LLM Critic Agent — Neuronal Path (FR-10)

## US-10.1: Context Assembly

**As an** ARCH, **I want** the LLM Critic to receive a structured context packet for each evaluation, **so that** it has all the information needed for accurate semantic analysis.

- **Priority**: Must
- **Traces to**: FR-10.1
- **Persona**: ARCH

**Acceptance Criteria**:
```gherkin
Given a neuronal fitness function with adr_ref and semantic_criteria
When the LLM Critic evaluates a class
Then the context packet includes: code snippet, APG subgraph (node + neighborhood), semantic_criteria.rule, semantic_criteria.rubric
And if adr_ref exists and the file is found, full ADR prose is included
```

---

## US-10.2: Semantic Violation Detection

**As a** DEV, **I want** the LLM Critic to detect violations that graph queries cannot express, **so that** abstraction quality, naming coherence, and ADR intent compliance are evaluated.

- **Priority**: Must
- **Traces to**: FR-10.2
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given a class "PaymentAuthLogger" that mixes payment processing and logging responsibilities
When the LLM Critic evaluates soft-SRP
Then it detects the mixed responsibility violation
And returns: pass=false, reasoning explaining the mix, evidence pointing to specific methods
```

---

## US-10.3: Structured Verdict Output

**As a** DEV, **I want** the LLM Critic to return a structured verdict with pass/fail, confidence, reasoning, and evidence, **so that** results are machine-readable and actionable.

- **Priority**: Must
- **Traces to**: FR-10.3
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given an LLM Critic evaluation
When the verdict is produced
Then it includes: { pass: boolean, confidence: 0.0-1.0, reasoning: string, evidence: string[], violations: Violation[] }
And confidence reflects the LLM's certainty in the assessment
```

---

## US-10.4: Configurable LLM Provider

**As a** LEAD, **I want** to configure which LLM provider the Critic uses, **so that** my team can use Claude, GPT-4o, or other providers.

- **Priority**: Should
- **Traces to**: FR-10.4
- **Persona**: LEAD

**Acceptance Criteria**:
```gherkin
Given a configuration setting "llm_provider: claude"
When the LLM Critic initializes
Then it uses the Claude API adapter
And switching to "llm_provider: gpt-4o" uses the OpenAI adapter
And the adapter interface is consistent regardless of provider
```

---

## US-10.5: Determinism Controls

**As a** LEAD, **I want** the LLM Critic to use temperature=0 and fixed seed, **so that** results are as reproducible as possible.

- **Priority**: Must
- **Traces to**: FR-10.5
- **Persona**: LEAD

**Acceptance Criteria**:
```gherkin
Given LLM Critic configuration
When API calls are made
Then temperature is set to 0
And seed is set to a fixed value (when API supports it)
```

---

## US-10.6: Multi-Run Reproducibility

**As an** ARCH, **I want** each neuronal evaluation to run 3-5 times and report mean +/- standard deviation, **so that** I know how stable the assessment is.

- **Priority**: Must
- **Traces to**: FR-10.6, FR-10.7
- **Persona**: ARCH

**Acceptance Criteria**:
```gherkin
Given a neuronal fitness function evaluation
When the LLM Critic runs 3 times
Then the report includes mean confidence +/- standard deviation
And ICC is computed across runs
And if ICC < 0.70 the function is flagged as unstable
And unstable functions are downweighted in the combined score
```

---

## US-10.7: Rubric-Based Evaluation

**As an** ARCH, **I want** evaluations driven by structured rubrics, **so that** the LLM Critic has calibrated, consistent scoring criteria.

- **Priority**: Must
- **Traces to**: FR-10.8
- **Persona**: ARCH

**Acceptance Criteria**:
```gherkin
Given a semantic_criteria rubric with pass/fail/evidence_required fields
When the LLM Critic evaluates
Then it applies the rubric criteria explicitly
And the reasoning references specific rubric conditions
```

---

## US-10.8: Full Audit Logging

**As a** LEAD, **I want** every LLM Critic call logged with input context, prompt, and response, **so that** evaluations are auditable and reproducible.

- **Priority**: Must
- **Traces to**: FR-10.9
- **Persona**: LEAD

**Acceptance Criteria**:
```gherkin
Given an LLM Critic evaluation
When the API call completes
Then the log includes: input context packet, full prompt sent, raw API response, parsed verdict
And logs are stored in a reviewable format
```

---

# Epic 11: Verdict Merge Logic (FR-11)

## US-11.1: Merge Symbolic and Neuronal Results

**As a** DEV, **I want** results from both paths merged into a unified verdict, **so that** I get one clear outcome per PR.

- **Priority**: Must
- **Traces to**: FR-11.1
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given symbolic results (3 violations) and neuronal results (1 warning, confidence 0.72)
When verdict merge runs
Then it produces a unified verdict: hard block / soft block / warning / pass
And critical symbolic violations produce hard block
And neuronal violations with confidence >= 0.85 produce hard block
And neuronal violations with confidence 0.60-0.85 produce soft block
And neuronal assessments with confidence < 0.60 are informational only
```

---

## US-11.2: Confidence Calibration

**As a** LEAD, **I want** configurable confidence thresholds for neuronal verdicts, **so that** I control how much weight LLM assessments carry in merge decisions.

- **Priority**: Must
- **Traces to**: FR-11.2
- **Persona**: LEAD

**Acceptance Criteria**:
```gherkin
Given confidence thresholds: high >= 0.85, medium 0.60-0.85, low < 0.60
When a neuronal verdict has confidence 0.72
Then it is classified as medium confidence
And counts as a warning (soft block) not a hard block
And the thresholds are tunable in AoC YAML Layer C
```

---

# Epic 12: Scoring Engine (FR-12)

## US-12.1: Compute AVR Per Dimension

**As a** DEV, **I want** AVR (Architectural Violation Ratio) computed per dimension, **so that** I know which architectural aspect has the most violations.

- **Priority**: Must
- **Traces to**: FR-12.1
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given a dimension "structural" with 3 fitness functions, 1 of which has violations
When scoring runs
Then AVR_structural = 1/3 = 0.333
And AVR is computed for all 7 dimensions
```

---

## US-12.2: Compute AHS (Weighted Complement)

**As a** DEV, **I want** AHS computed as the weighted complement of AVRs, **so that** I get a single health score reflecting all dimensions.

- **Priority**: Must
- **Traces to**: FR-12.2, FR-12.3
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given AVR values across 7 dimensions and Layer C scoring weights
When AHS is computed
Then AHS = Sum(wi * (1 - AVRi)) for all dimensions
And default weights are: structural 0.20, coupling 0.10, pattern 0.20, SOLID 0.15, convention 0.10, semantic 0.15, intent 0.10
```

---

## US-12.3: Universal Health Metrics

**As a** DEV, **I want** spec-independent metrics computed regardless of the AoC YAML, **so that** I get baseline architectural health indicators.

- **Priority**: Must
- **Traces to**: FR-12.4
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given an APG loaded in Neo4j
When universal metrics are computed
Then the report includes: cycle count, average fan-out, average fan-in, abstraction ratio, instability index, orphan file count
And these metrics are computed without requiring an AoC spec
```

---

## US-12.4: Dual Scoring

**As a** LEAD, **I want** both `ahs_deterministic` (symbolic only) and `ahs_combined` (symbolic + neuronal) reported, **so that** governance decisions can use the deterministic score.

- **Priority**: Must
- **Traces to**: FR-12.5, FR-12.6
- **Persona**: LEAD

**Acceptance Criteria**:
```gherkin
Given a full neuro-symbolic evaluation
When scoring completes
Then the report includes both ahs_deterministic and ahs_combined
And ahs_deterministic excludes neuronal dimensions (semantic, intent)
And each result is tagged with its evaluation route and determinism flag
```

---

## US-12.5: Symbolic-Only Scoring Mode

**As a** LEAD, **I want** `--symbolic-only` to exclude neuronal dimensions entirely from AHS, **so that** the score is fully deterministic.

- **Priority**: Must
- **Traces to**: FR-12.7
- **Persona**: LEAD

**Acceptance Criteria**:
```gherkin
Given the flag --symbolic-only
When scoring runs
Then only structural, coupling, pattern, SOLID (symbolic part), and convention dimensions contribute to AHS
And semantic and intent dimensions are excluded
And the reported AHS equals ahs_deterministic
```

---

# Epic 13: Structured Violation Report (FR-13)

## US-13.1: JSON Report Output

**As a** DEV, **I want** a structured JSON report with all evaluation results, **so that** tooling can consume the output programmatically.

- **Priority**: Must
- **Traces to**: FR-13.1
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given a completed evaluation
When the JSON report is generated
Then it includes: project name, commit SHA, ahs_deterministic, ahs_combined, verdict, per-dimension breakdown (AVR, path, confidence), violations array, universal metrics
```

---

## US-13.2: Human-Readable Summary

**As a** DEV, **I want** a human-readable summary for CLI and PR comments, **so that** I can quickly understand results without parsing JSON.

- **Priority**: Must
- **Traces to**: FR-13.2
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given a completed evaluation
When the human-readable format is selected
Then it shows: AHS scores, verdict, top violations with file paths and descriptions
And the output is scannable in < 30 seconds
```

---

## US-13.3: CSV Batch Output

**As an** ARCH, **I want** CSV output for batch evaluation, **so that** I can compare multiple projects in a spreadsheet.

- **Priority**: Must
- **Traces to**: FR-13.3
- **Persona**: ARCH

**Acceptance Criteria**:
```gherkin
Given a batch evaluation of 5 projects
When CSV output is generated
Then it contains one row per project
And columns include: project name, AVR overall, AVR per-dimension, ahs_deterministic, ahs_combined, universal metrics
```

---

# Epic 14: CLI (FR-14)

## US-14.1: Single Project Evaluation

**As a** DEV, **I want** to run `firewall evaluate --project PATH --spec YAML`, **so that** I can evaluate one project from the command line.

- **Priority**: Must
- **Traces to**: FR-14.1
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given a TypeScript project and an AoC YAML spec
When I run "firewall evaluate --project ./my-project --spec ./clean-arch.yaml"
Then the full pipeline runs (extract -> ingest -> compile -> route -> evaluate -> score -> report)
And results are printed to stdout (JSON) and stderr (human summary)
```

---

## US-14.2: Batch Evaluation

**As an** ARCH, **I want** to run `firewall batch --dir PATH --spec YAML --output CSV`, **so that** I can evaluate multiple projects at once.

- **Priority**: Must
- **Traces to**: FR-14.2
- **Persona**: ARCH

**Acceptance Criteria**:
```gherkin
Given a directory containing 5 TypeScript projects
When I run "firewall batch --dir ./projects --spec ./clean-arch.yaml --output results.csv"
Then all 5 projects are evaluated sequentially
And results are written to results.csv with one row per project
```

---

## US-14.3: CLI Flags

**As a** DEV, **I want** flags for output format, verbosity, Neo4j URI, and symbolic-only mode, **so that** I can customize evaluation behavior.

- **Priority**: Must
- **Traces to**: FR-14.3
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given the CLI
When I run with --format json, --format human, or --format csv
Then output is in the specified format

When I run with --verbose
Then detailed pipeline progress is shown

When I run with --neo4j-uri bolt://custom:7687
Then the custom Neo4j instance is used

When I run with --symbolic-only
Then neuronal evaluation is skipped
```

---

## US-14.4: Exit Codes

**As a** LEAD, **I want** meaningful exit codes, **so that** CI scripts can react to evaluation outcomes.

- **Priority**: Must
- **Traces to**: FR-14.6
- **Persona**: LEAD

**Acceptance Criteria**:
```gherkin
Given a completed evaluation
When the result is pass (no violations)
Then exit code is 0

When the result has violations (soft/hard block)
Then exit code is 1

When an evaluation error occurs (Neo4j down, parse failure)
Then exit code is 2
```

---

## US-14.5: Commander.js Framework

**As a** DEV, **I want** the CLI built with Commander.js, **so that** it has standard help, version, and subcommand behavior.

- **Priority**: Must
- **Traces to**: FR-14.5
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given the CLI
When I run "firewall --help"
Then it displays usage information for evaluate, batch, and drift subcommands
When I run "firewall --version"
Then it displays the current version
```

---

# Epic 15: CI/CD Integration (FR-15)

## US-15.1: GitHub Action on PR

**As a** LEAD, **I want** a GitHub Action that runs on PR creation and synchronization, **so that** every PR is automatically evaluated.

- **Priority**: Must
- **Traces to**: FR-15.1
- **Persona**: LEAD

**Acceptance Criteria**:
```gherkin
Given a GitHub repository with the firewall action configured
When a PR is opened or updated
Then the firewall evaluation runs automatically
And the action completes within typical CI job timeframes
```

---

## US-15.2: PR Comment with Results

**As a** DEV, **I want** evaluation results posted as a PR comment, **so that** I see the architectural health of my changes inline.

- **Priority**: Must
- **Traces to**: FR-15.3
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given a completed CI evaluation
When results are posted to the PR
Then the comment includes: AHS (deterministic and combined), per-dimension breakdown with route tags, violations with file paths and descriptions, verdict
And the comment is scannable and actionable
```

---

## US-15.3: Check Status Based on Verdict

**As a** LEAD, **I want** the GitHub check status set based on the verdict and configurable AHS threshold, **so that** PRs below the threshold are blocked.

- **Priority**: Must
- **Traces to**: FR-15.4
- **Persona**: LEAD

**Acceptance Criteria**:
```gherkin
Given a configurable AHS threshold of 0.70
When evaluation produces AHS = 0.65 (hard block verdict)
Then the GitHub check status is set to "failure"
And the PR cannot merge until the check passes

When evaluation produces AHS = 0.85 (pass verdict)
Then the GitHub check status is set to "success"
```

---

## US-15.4: Manual Trigger

**As a** DEV, **I want** to trigger evaluation via workflow dispatch or `/firewall` PR comment command, **so that** I can re-evaluate after fixing violations.

- **Priority**: Should
- **Traces to**: FR-15.5
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given a PR with a failed firewall check
When I comment "/firewall" on the PR
Then a new evaluation is triggered
And results replace the previous PR comment
```

---

## US-15.5: Neo4j Service Container

**As a** LEAD, **I want** Neo4j provisioned as a service container within the GitHub Action, **so that** no external database setup is needed.

- **Priority**: Must
- **Traces to**: FR-15.6
- **Persona**: LEAD

**Acceptance Criteria**:
```gherkin
Given the GitHub Action workflow
When the action runs
Then a Neo4j service container starts automatically
And the firewall connects to it via the configured bolt URI
And the container is cleaned up after the action completes
```

---

## US-15.6: Configurable CI Mode

**As a** LEAD, **I want** to configure whether CI runs symbolic-only (fast) or full neuro-symbolic (comprehensive), **so that** I balance speed vs depth.

- **Priority**: Should
- **Traces to**: FR-15.7
- **Persona**: LEAD

**Acceptance Criteria**:
```gherkin
Given a GitHub Action configuration with "mode: symbolic-only"
When the action runs
Then only symbolic evaluation executes
And results are fully deterministic
And evaluation completes faster (< 5 seconds per project)

Given "mode: full"
When the action runs
Then full neuro-symbolic evaluation executes (< 30 seconds per project)
```

---

# Epic 16: Batch Runner (FR-16)

## US-16.1: Sequential Batch Evaluation

**As an** ARCH, **I want** N projects evaluated sequentially against a spec, **so that** I can benchmark multiple projects at once.

- **Priority**: Must
- **Traces to**: FR-16.1
- **Persona**: ARCH

**Acceptance Criteria**:
```gherkin
Given a directory with 10 TypeScript projects
When batch evaluation runs
Then each project is evaluated in sequence
And results are aggregated
```

---

## US-16.2: Batch CSV Output

**As an** ARCH, **I want** CSV output with one row per project including all metrics and route tags, **so that** I can analyze results in a spreadsheet.

- **Priority**: Must
- **Traces to**: FR-16.2
- **Persona**: ARCH

**Acceptance Criteria**:
```gherkin
Given a completed batch evaluation
When CSV is generated
Then each row includes: project name, AVR overall, AVR per dimension, ahs_deterministic, ahs_combined, universal metrics, route tags
```

---

## US-16.3: Graceful Failure Handling

**As an** ARCH, **I want** failed projects skipped without stopping the batch, **so that** one broken project doesn't block the entire evaluation.

- **Priority**: Must
- **Traces to**: FR-16.3
- **Persona**: ARCH

**Acceptance Criteria**:
```gherkin
Given a batch of 10 projects, 1 of which has a parse error
When batch evaluation runs
Then 9 projects are evaluated successfully
And the failed project is reported in the output with the error reason
And the batch completes without crashing
```

---

## US-16.4: Batch Performance

**As a** DEV, **I want** symbolic-only batch evaluation to complete in < 5 seconds per project, **so that** large batches don't take unreasonably long.

- **Priority**: Must
- **Traces to**: FR-16.4
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given a batch of 10 projects in symbolic-only mode
When batch evaluation runs
Then total time is < 50 seconds (< 5 seconds per project)
And neuronal evaluations add LLM latency proportional to the number of neuronal functions
```

---

# Epic 17: Sample Projects + Validation Set (FR-17)

## US-17.1: Clean Reference Projects

**As a** DEV, **I want** 2-3 clean reference projects with zero violations and AHS >= 0.90, **so that** I have a baseline for what "good" looks like.

- **Priority**: Must
- **Traces to**: FR-17.1, FR-17.2
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given a clean reference project in fixtures/
When evaluated with the clean-architecture spec
Then AHS >= 0.90
And zero violations are detected
And the project serves as a usage example for new adopters
```

---

## US-17.2: Seeded Violation Projects

**As an** ARCH, **I want** projects with known violations across all 7 dimensions, **so that** I can validate the tool detects what it should — including semantic and intent violations only detectable by the neuronal path.

- **Priority**: Must
- **Traces to**: FR-17.3
- **Persona**: ARCH

**Acceptance Criteria**:
```gherkin
Given a violated project with seeded violations in structural, coupling, pattern, SOLID, convention, semantic, and intent dimensions
When evaluated with the clean-architecture spec
Then violations matching the MANIFEST are detected
And semantic/intent violations are detected only when neuronal path is active
And with --symbolic-only, semantic/intent violations are not reported
```

---

## US-17.3: Project Manifests

**As an** ARCH, **I want** each project to include a MANIFEST.md listing expected violations, **so that** the tool's accuracy can be measured.

- **Priority**: Must
- **Traces to**: FR-17.4
- **Persona**: ARCH

**Acceptance Criteria**:
```gherkin
Given a sample project with MANIFEST.md
When MANIFEST.md is read
Then each entry includes: violation type, file path, expected detecting fitness function, dimension, expected route, expected severity
And the manifest serves as ground truth for precision/recall measurement
```

---

## US-17.4: Usage Examples for Adopters

**As a** DEV, **I want** sample projects to serve as getting-started examples, **so that** I can understand how to use the firewall on my own project.

- **Priority**: Should
- **Traces to**: FR-17.5
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given a new user installing the firewall
When they run "firewall evaluate --project ./fixtures/clean-ref --spec ./specs/clean-arch.yaml"
Then the evaluation completes successfully
And the output demonstrates all report features (AHS, violations, universal metrics)
And time from install to first evaluation is < 5 minutes
```

---

# Non-Functional Stories

## US-NFR-1: Deterministic Reproducibility

**As a** LEAD, **I want** symbolic evaluations to be fully deterministic, **so that** the same code + same spec always produces the same score.

- **Priority**: Must
- **Traces to**: NFR-01
- **Persona**: LEAD

**Acceptance Criteria**:
```gherkin
Given a project and spec
When "firewall evaluate" runs twice in symbolic-only mode
Then both runs produce identical AHS, AVR, and violations
And no result variance exists
```

---

## US-NFR-2: Performance Targets

**As a** DEV, **I want** evaluations to meet performance targets, **so that** the tool doesn't slow down my workflow.

- **Priority**: Must
- **Traces to**: NFR-02
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given a typical TypeScript project
When full APG construction runs
Then it completes in < 5 seconds

When delta APG update runs for a PR
Then it completes in < 2 seconds

When symbolic-only evaluation runs
Then it completes in < 5 seconds

When full neuro-symbolic evaluation runs
Then it completes in < 30 seconds
```

---

## US-NFR-3: Detection Accuracy

**As an** ARCH, **I want** precision >= 90% and recall >= 85% against the validation set, **so that** the tool's results are trustworthy.

- **Priority**: Must
- **Traces to**: NFR-03
- **Persona**: ARCH

**Acceptance Criteria**:
```gherkin
Given the validation set with MANIFESTs
When batch evaluation runs
Then precision >= 90% (detected violations are real)
And recall >= 85% (manifest violations are detected)
And AHS discriminates monotonically: clean > semi-violated > fully-violated
```

---

## US-NFR-4: Resilience

**As a** DEV, **I want** the tool to handle partially broken TypeScript projects gracefully, **so that** I get partial results rather than crashes.

- **Priority**: Must
- **Traces to**: NFR-04
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given a project with 5 files, 2 of which have unresolvable imports
When evaluation runs
Then 3 files are fully analyzed
And 2 files are skipped with warnings
And parse coverage is reported as 60%
And the evaluation completes without crashing
```

---

## US-NFR-5: Reproducible Environment

**As a** DEV, **I want** Docker Compose for Neo4j and locked dependencies, **so that** my environment matches everyone else's.

- **Priority**: Must
- **Traces to**: NFR-05
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given a fresh clone of the repository
When I run "docker-compose up -d" and "npm install"
Then Neo4j starts on the expected port
And all dependencies install from the lock file
And "firewall evaluate" works end-to-end
```

---

## US-NFR-6: Developer Experience

**As a** DEV, **I want** to go from install to first evaluation in < 5 minutes, **so that** adoption is frictionless.

- **Priority**: Must
- **Traces to**: NFR-06
- **Persona**: DEV

**Acceptance Criteria**:
```gherkin
Given a developer with Node.js and Docker installed
When they run "npm install -g @daedalus/firewall" and "docker-compose up -d"
And then "firewall evaluate --project ./fixtures/clean-ref --spec ./specs/clean-arch.yaml"
Then the first evaluation completes within 5 minutes of starting
And error messages are clear and actionable (no raw stack traces)
```

---

# Story Summary

| Epic | Stories | Must | Should | Could |
|------|---------|------|--------|-------|
| 1. APG Extraction | 6 | 6 | 0 | 0 |
| 2. Neo4j Ingestion | 4 | 4 | 0 | 0 |
| 3. Persistence/Drift | 8 | 6 | 2 | 0 |
| 4. AoC YAML Parsing | 7 | 5 | 2 | 0 |
| 5. ADR Parsing | 4 | 3 | 1 | 0 |
| 6. Violation Taxonomy | 2 | 1 | 1 | 0 |
| 7. Fitness Compiler | 2 | 2 | 0 | 0 |
| 8. Neuro-Symbolic Router | 3 | 3 | 0 | 0 |
| 9. Symbolic Evaluation | 2 | 2 | 0 | 0 |
| 10. LLM Critic Agent | 8 | 6 | 1 | 0 |
| 11. Verdict Merge | 2 | 2 | 0 | 0 |
| 12. Scoring Engine | 5 | 5 | 0 | 0 |
| 13. Violation Report | 3 | 3 | 0 | 0 |
| 14. CLI | 5 | 5 | 0 | 0 |
| 15. CI/CD Integration | 6 | 4 | 2 | 0 |
| 16. Batch Runner | 4 | 4 | 0 | 0 |
| 17. Sample Projects | 4 | 3 | 1 | 0 |
| NFR Stories | 6 | 6 | 0 | 0 |
| **TOTAL** | **81** | **70** | **10** | **0** |
