# Unit 5 — Neuro-Symbolic Router + Evaluation: Business Logic Model

## 1. Router Dispatch Lifecycle

```
CompiledFunctions + EvaluationMode
  │
  ├─ filterByMode() ─→ filtered functions
  │
  ├─ symbolic functions ──→ [C6: Symbolic Engine] ──→ SymbolicFunctionResult[]
  │
  ├─ neuronal functions ──→ [C7: LLM Critic] ──→ NeuronalFunctionResult[]
  │
  ├─ hybrid functions ──→ [C6 first] ──→ if symbolic fails → skip neuronal
  │                                    → if symbolic passes → [C7] → merge
  │
  └─ tagDeterminism() + mergeResults() ──→ EvaluationResults
```

### Phase 1: Mode Filtering (C5)

1. Receive `CompiledFunctions` from U3 and `EvaluationMode` from CLI
2. Filter by mode:
   - `full`: all functions routed to their tagged path
   - `symbolic-only`: only symbolic + hybrid-symbolic. Skip neuronal entirely.
   - `neuronal-only`: only neuronal + hybrid-neuronal. Skip symbolic entirely.
3. Produce filtered set for dispatch

### Phase 2: Symbolic Dispatch (C5 → C6)

1. Collect all `TaggedCypherQuery[]` (symbolic + hybrid symbolic parts)
2. Dispatch to Evaluation Engine (C6)
3. C6 executes each query against Neo4j, collects violations
4. Returns `SymbolicFunctionResult[]` with pass/fail, violations, timing

### Phase 3: Neuronal Dispatch (C5 → C7)

1. Collect all `NeuronalInstruction[]` (neuronal-only functions)
2. Dispatch to LLM Critic Agent (C7)
3. C7 assembles context, calls LLM, parses verdicts
4. Returns `NeuronalFunctionResult[]` with verdict, confidence, reasoning

### Phase 4: Hybrid Dispatch (C5 → C6 then C7) — Q1:A Sequential

1. For each `HybridPair`:
   a. Run symbolic query via C6
   b. If symbolic **fails** (violations found) → skip neuronal, report symbolic result
   c. If symbolic **passes** → run neuronal via C7, report both results
2. This saves LLM tokens when symbolic already catches the violation

### Phase 5: Result Assembly (C5)

1. Tag all symbolic results with `deterministic: true`
2. Tag all neuronal results with `deterministic: false`
3. Merge into `EvaluationResults` (symbolicResults[], neuronalResults[])
4. Return to pipeline

## 2. Symbolic Evaluation Engine (C6)

### Query Execution Flow

```
TaggedCypherQuery[] ──→ for each query:
  1. Execute Cypher via GraphRepository
  2. Map result records to Violation[] via template resultMapping (Q3:B)
  3. Compute pass/fail based on threshold
  4. Record execution time
──→ SymbolicFunctionResult[]
```

### Result Mapping (Q3:B — Template-Annotated)

Each `CypherTemplate` includes a `resultMapping` that describes how to convert Neo4j result records to `Violation` objects:

```typescript
interface ResultMapping {
  filePathColumn: string;        // which column holds the violating file path
  messageTemplate: string;       // e.g., "File {filePath} in layer {srcLayer} imports from {tgtLayer}"
  metadataColumns?: string[];    // additional columns to include as violation metadata
}
```

The evaluator:
1. Iterates result records
2. Extracts `filePath` from the mapped column
3. Interpolates the message template with record values
4. Produces one `Violation` per record row

### Threshold Logic

- If threshold is defined: `pass = violations.length === 0` OR metric-based (ratio < threshold)
- If no threshold: `pass = violations.length === 0` (any violation = fail)
- For metric queries (e.g., dependency-inversion returns ratio): check returned metric against threshold

### Cycle Detection (US-9.2)

- `no-cyclic-deps` query uses path traversal: `MATCH path = (f:File)-[:IMPORTS*2..]->(f)`
- Each cycle path becomes a violation with the cycle participants listed
- No APOC dependency in v1 — pure Cypher path matching (APOC optional optimization for large graphs)

## 3. LLM Critic Agent (C7)

### Evaluation Flow

```
NeuronalInstruction ──→ assembleContext() ──→ constructPrompt()
  ──→ executeLLM() × N runs ──→ parseVerdict() per run
  ──→ computeStats() ──→ flagUnstable() ──→ NeuronalFunctionResult
```

### Context Assembly (US-10.1) — Q5:A Fixed Budget

Token budgets per component:
- **Rule + Rubric**: 300 tokens (always included in full)
- **Code snippet**: 2000 tokens (relevant source files, truncated)
- **APG subgraph**: 500 tokens (node + 1-hop neighbors, JSON)
- **ADR prose**: 500 tokens (if adr_ref exists)

Assembly steps:
1. Extract rule and rubric from `NeuronalInstruction.semanticCriteria` (always full)
2. Get relevant source code from `contextAssembly.sourceCodeFilter` or include files matching node filter
3. Get APG subgraph from Neo4j (nodes + edges within filter)
4. If `semanticCriteria.adrRef` exists, include ADR file content
5. Truncate each section to its budget

### Prompt Construction

Structured prompt template:
```
You are an architectural reviewer evaluating code compliance.

## Rule
{semanticCriteria.rule}

## Rubric
- PASS if: {rubric.pass}
- FAIL if: {rubric.fail}
- Evidence required: {rubric.evidenceRequired}

## Source Code
{truncated code snippets}

## Architectural Graph Context
{APG subgraph JSON}

{optional: ## ADR Context\n{adr prose}}

## Instructions
Evaluate the code against the rule and rubric above.
Return your verdict as JSON: { "pass": boolean, "confidence": 0.0-1.0, "reasoning": "...", "evidence": ["..."], "violations": [{"filePath": "...", "message": "..."}] }
```

### Multi-Run Execution (US-10.6)

1. Execute prompt N times (default: 3, configurable)
2. Each run: `temperature=0`, fixed seed when API supports it
3. Parse each response into `CriticVerdict`
4. Compute mean confidence ± stddev across runs
5. If stddev > 0.15 → flag as unstable (Q4:B)

### VCR Mode (Q2:A — File-Based Cassettes)

- **Record**: Call LLM, save response to `fixtures/cassettes/{functionId}_{runIndex}.json`
- **Replay**: Load cassette file, return recorded response (no LLM call)
- **Bypass**: Call LLM, don't save (default production mode)

Cassette format:
```json
{
  "functionId": "FF-N01",
  "runIndex": 0,
  "prompt": "...",
  "response": "...",
  "parsedVerdict": { "pass": true, "confidence": 0.92, ... },
  "timestamp": "2026-01-01T00:00:00Z"
}
```

## 4. Verdict Merge Logic (US-11.1, US-11.2)

### Merge Rules

After all paths complete, merge results:
- **Critical symbolic violation** → counts as hard evidence
- **Neuronal verdict with confidence ≥ high (0.85)** → treated as strong signal
- **Neuronal verdict with confidence medium (0.60–0.85)** → treated as moderate signal
- **Neuronal verdict with confidence < low (0.60)** → informational only, downweighted
- **Unstable neuronal result (stddev > 0.15)** → downweighted regardless of confidence

The actual AHS/AVR scoring happens in U6. U5 produces raw `EvaluationResults` with all metadata for U6 to score.

## 5. LLM Provider Strategy (S4)

### Provider Interface (from U1)

```typescript
interface LLMProvider {
  evaluate(prompt: string, options?: LLMOptions): Promise<LLMResponse>;
  readonly name: string;
  readonly supportsDeterminism: boolean;
}
```

### Implementations

- **ClaudeLLMProvider**: Anthropic SDK, `claude-sonnet-4-6`, temperature=0
- **OpenAILLMProvider**: OpenAI SDK, `gpt-4o`, temperature=0, seed support
- **MockLLMProvider**: For testing — returns canned responses (used in bypass/unit tests)

### Concurrency Governor

- `p-limit` based concurrency cap (default: 3 concurrent LLM calls)
- Exponential backoff for 429/5xx (max 3 retries, base 1s)

## 6. PipelineStage Integration

```typescript
class RouterStage implements PipelineStage<CompiledFunctions, EvaluationResults> {
  constructor(
    private evaluationEngine: EvaluationEngine,
    private llmCritic: LLMCriticAgent,
    private mode: EvaluationMode,
  )
  async execute(input: CompiledFunctions, context: FirewallContext): Promise<DomainResult<EvaluationResults>>
  // On success: context.setEvaluationResults(result)
}
```

## 7. Error Handling

### Fatal Errors
- Neo4j connection failure during symbolic evaluation
- LLM provider authentication failure
- All LLM runs fail for a function (retries exhausted)

### Recoverable (continue with warnings)
- Single Cypher query failure → skip function, warn
- Single LLM run failure out of N → use remaining runs
- Cassette file not found in replay mode → fall back to bypass, warn
- Context assembly exceeds budget → truncate, warn

### Warning Codes
| Code | Meaning |
|------|---------|
| ROUTER_001 | Function skipped due to mode filter |
| EVAL_001 | Cypher query execution failed (function skipped) |
| EVAL_002 | No violations but metric exceeds threshold |
| CRITIC_001 | LLM run failed (using remaining runs) |
| CRITIC_002 | Verdict parse failure (raw response logged) |
| CRITIC_003 | Function flagged as unstable (stddev > 0.15) |
| CRITIC_004 | Context truncated to fit budget |
| CRITIC_005 | Cassette not found, falling back to bypass |
| CRITIC_006 | ADR file not found for adr_ref |
