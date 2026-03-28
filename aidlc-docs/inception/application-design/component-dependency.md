# Component Dependencies — Architectural Firewall

## Dependency Matrix

| Component | Depends On | Depended By | Communication |
|-----------|-----------|-------------|---------------|
| C10: Shared Domain | — | All (C1-C9) | Type imports |
| C1: APG Extractor | C10 | C2, C5 (via PipelineContext) | Typed output: APGResult |
| C3: Spec Parser | C10 | C2, C4, C8 (via PipelineContext) | Typed output: ParsedSpec |
| C2: Neo4j Ingestion | C10, S2, S3 | C5, C6, C7, C8 (graph must be loaded) | Typed output: IngestionResult |
| C4: Fitness Compiler | C10 | C5 (via PipelineContext) | Typed output: CompiledFunctions |
| C5: Neuro-Symbolic Router | C10, C6, C7 | C8 (via PipelineContext) | Typed output: EvaluationResults |
| C6: Evaluation Engine | C10, S2 | C5 (invoked by Router) | Typed output: SymbolicResults |
| C7: LLM Critic Agent | C10, S2, S4, S5 | C5 (invoked by Router) | Typed output: NeuronalResults |
| C8: Scoring Engine | C10, S2 | C9 (via PipelineContext) | Typed output: EvaluationReport |
| C9: CLI | C10, S1, S2, S6 | — (entry point) | Commander.js commands |

## Service Dependencies

| Service | Depends On | Used By |
|---------|-----------|---------|
| S1: PipelineExecutor | C1-C8 (as Commands), S2, S3, S4 | C9 (CLI) |
| S2: GraphRepositoryService | Neo4j driver | C2, C6, C7, C8, S3 |
| S3: SnapshotService | S2, filesystem | C2 (via S1 pipeline) |
| S4: LLMProviderService | LLM APIs (Claude/OpenAI) | C7 |
| S5: AuditLogService | filesystem | C7, S1 |
| S6: ReportService | — | C9 |

---

## Data Flow Diagram

```
                    +-------------+
                    |   CLI (C9)  |
                    +------+------+
                           |
                           v
                  +------------------+
                  | PipelineExecutor |
                  |      (S1)       |
                  +--------+---------+
                           |
          +----------------+----------------+
          |                                 |
          v                                 v
  +---------------+                 +---------------+
  | APG Extractor |                 | Spec Parser   |
  |    (C1)       |                 |    (C3)       |
  +-------+-------+                 +-------+-------+
          |                                 |
          | APGResult                       | ParsedSpec
          v                                 |
  +------------------+                      |
  | Neo4j Ingestion  |<--------------------+
  |    (C2)          |    (layerMappings)
  +--------+---------+
           |
           | IngestionResult          ParsedSpec
           v                              |
  +------------------+                    |
  | Fitness Compiler |<-------------------+
  |    (C4)          |    (fitnessFunctions)
  +--------+---------+
           |
           | CompiledFunctions
           v
  +------------------------+
  | Neuro-Symbolic Router  |
  |    (C5)                |
  +---+------------+-------+
      |            |
      | symbolic   | neuronal
      v            v
  +----------+  +-------------+
  | Eval     |  | LLM Critic  |
  | Engine   |  | Agent       |
  | (C6)     |  | (C7)        |
  +----+-----+  +------+------+
       |               |
       | SymbolicResults| NeuronalResults
       +-------+-------+
               |
               v
       +---------------+
       | Scoring Engine |
       |    (C8)        |
       +-------+--------+
               |
               | EvaluationReport
               v
       +----------------+
       | ReportService  |
       |    (S6)        |
       +----------------+
```

---

## Pipeline Execution Order

### Sequential Dependencies (must complete before next starts)
1. **C1: APG Extractor** and **C3: Spec Parser** — run in **parallel** (no dependency between them)
2. **C2: Neo4j Ingestion** — requires C1 output (APGResult) + C3 output (layerMappings)
3. **C4: Fitness Compiler** — requires C3 output (fitnessFunctions)
4. **C5: Neuro-Symbolic Router** — requires C4 output + graph loaded (C2 complete)
   - **C6** and **C7** — dispatched by C5, may run in **parallel** for independent functions
5. **C8: Scoring Engine** — requires C5 output (all evaluation results)

### Parallelization Opportunities
- **C1 || C3**: Extraction and spec parsing are independent — run concurrently
- **C6 || C7**: Symbolic and neuronal evaluation paths — run concurrently (C5 dispatches both)
- **Hybrid sequencing**: C6 runs first for hybrid functions; C7 runs only if C6 passes

---

## Anti-Corruption Layers

Per DDD (METH-03), modules communicate via typed interfaces, not internal types:

| Boundary | ACL Mechanism |
|----------|---------------|
| C1 → C2 | `APGResult` value object (nodes[], edges[] — serializable JSON) |
| C3 → C2 | `LayerMapping[]` value object (directory, naming, decorator rules) |
| C3 → C4 | `FitnessFunction[]` value object (dimension, route, criteria) |
| C4 → C5 | `CompiledFunctions` value object (queries[], instructions[], pairs[]) |
| C5 → C8 | `EvaluationResults` value object (symbolic[], neuronal[], hybrid[]) |
| C8 → C9 | `EvaluationReport` value object (scores, verdict, violations, metrics) |
| All → S2 | `GraphRepository` interface (hides Neo4j driver internals) |
| C7 → S4 | `LLMProvider` interface (hides API-specific details) |

Each boundary uses immutable value objects defined in C10 (Shared Domain). Modules never reach into another module's internals.

---

## External Dependency Map

| External | Used By | Configuration |
|----------|---------|---------------|
| ts-morph | C1 | Bundled dependency |
| neo4j-driver | S2 | `--neo4j-uri`, env: `NEO4J_PASSWORD` |
| APOC plugin | C6 (via S2) | Installed in Neo4j container |
| Claude API | S4 → C7 | env: `ANTHROPIC_API_KEY` |
| OpenAI API | S4 → C7 | env: `OPENAI_API_KEY` |
| Commander.js | C9 | Bundled dependency |
| ajv (JSON Schema) | C3 | Bundled dependency |
| js-yaml | C3 | Bundled dependency |
