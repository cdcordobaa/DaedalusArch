# Unit 5 — Neuro-Symbolic Router + Evaluation: Business Rules

## Router Rules

### BR-ROUTE-01: Mode Filtering
- `full` mode: all functions dispatched
- `symbolic-only`: symbolic + hybrid-symbolic only. Neuronal instructions dropped.
- `neuronal-only`: neuronal + hybrid-neuronal only. Symbolic queries dropped.

### BR-ROUTE-02: Route Dispatch
- `route: 'symbolic'` → C6 Evaluation Engine
- `route: 'neuronal'` → C7 LLM Critic
- `route: 'hybrid'` → C6 first, then C7 conditionally

### BR-ROUTE-03: Hybrid Sequential (Q1:A)
- Symbolic query runs first
- If symbolic **fails** (violations found) → neuronal skipped for this function
- If symbolic **passes** (no violations) → neuronal runs
- Both results recorded regardless of which path executes

### BR-ROUTE-04: Determinism Tagging
- All `SymbolicFunctionResult` have `deterministic: true`
- All `NeuronalFunctionResult` have `deterministic: false`
- Hybrid functions: symbolic part tagged true, neuronal part tagged false

### BR-ROUTE-05: Parallel Dispatch
- Symbolic functions dispatched in parallel (all Cypher queries)
- Neuronal functions dispatched with concurrency limit (p-limit, default: 3)
- Hybrid functions dispatched sequentially per function (symbolic → neuronal)

## Symbolic Evaluation Rules

### BR-EVAL-01: Query Execution
- Each `TaggedCypherQuery` executed via `GraphRepository.executeQuery()`
- Params passed as Neo4j parameterized query (no string interpolation)
- Execution timed (start → end in ms)

### BR-EVAL-02: Result Mapping (Q3:B)
- Each `CypherTemplate` has a `resultMapping` config
- `resultMapping.filePathColumn` identifies which column holds the file path
- `resultMapping.messageTemplate` uses `{columnName}` placeholders
- One `Violation` produced per result record row

### BR-EVAL-03: Threshold Evaluation
- Functions with explicit threshold: compare returned metric against threshold
- Functions without threshold: `pass = resultRecords.length === 0`
- Special case: ratio queries (e.g., dependency-inversion) — extract ratio column, compare to threshold

### BR-EVAL-04: Query Failure Handling
- If a query fails → function skipped with EVAL_001 warning
- Skipped functions do NOT contribute to pass/fail counts
- Remaining functions continue evaluation

### BR-EVAL-05: Violation Types
- Violations use types from U1 taxonomy (`BUILT_IN_VIOLATION_TYPES`)
- Violation type derived from fitness function dimension + name
- `filePath` always required on violations

## LLM Critic Rules

### BR-CRITIC-01: Context Assembly (Q5:A Fixed Budget)
- Rule + Rubric: 300 tokens (never truncated)
- Code snippet: 2000 tokens max (truncate from end)
- APG subgraph: 500 tokens max (truncate node list)
- ADR prose: 500 tokens max (truncate from end)
- Total budget: ~3300 tokens

### BR-CRITIC-02: Prompt Structure
- Always includes: rule, rubric, code, instructions
- Conditionally includes: APG subgraph (if contextAssembly.includeAPGSubgraph), ADR prose (if adr_ref)
- Response format: JSON with pass, confidence, reasoning, evidence, violations

### BR-CRITIC-03: Multi-Run (Q4:B Stddev Consistency)
- Default: 3 runs per function (configurable)
- Each run: temperature=0, seed=42 (when supported)
- Mean confidence = average of all run confidences
- Stddev = standard deviation of all run confidences
- If stddev > 0.15 → `flaggedUnstable: true`

### BR-CRITIC-04: Verdict Parsing
- Response must be valid JSON matching expected schema
- If JSON parse fails → CRITIC_002 warning, run discarded
- If < 2 valid runs remain → function evaluation fails with warning

### BR-CRITIC-05: Confidence Values
- Confidence must be 0.0 to 1.0
- Values outside range clamped: < 0 → 0, > 1 → 1
- Pass verdict requires confidence (how sure the LLM is about pass/fail)

### BR-CRITIC-06: VCR Mode (Q2:A File-Based Cassettes)
- **Record**: execute LLM call + write cassette to `fixtures/cassettes/`
- **Replay**: read cassette, return recorded response (no LLM call)
- **Bypass**: execute LLM call, no cassette I/O (default)
- Cassette key: `{functionId}_{runIndex}`
- Missing cassette in replay → fallback to bypass with CRITIC_005 warning

### BR-CRITIC-07: LLM Provider Retry
- Retry on 429 (rate limit) and 5xx (server error)
- Exponential backoff: 1s, 2s, 4s (max 3 retries)
- Other errors (401, 400) → fail immediately
- Concurrency governor: max 3 concurrent LLM calls (p-limit)

## Verdict Merge Rules

### BR-MERGE-01: Result Aggregation
- U5 produces raw `EvaluationResults` with all symbolic + neuronal results
- No scoring in U5 — raw results passed to U6 for AVR/AHS computation

### BR-MERGE-02: Confidence Thresholds (from ParsedSpec)
- High ≥ `confidenceThresholds.high` (default 0.85)
- Medium ≥ `confidenceThresholds.medium` (default 0.60)
- Low < `confidenceThresholds.medium`
- These thresholds used by U6 for weighting, not by U5

### BR-MERGE-03: Unstable Function Handling
- Unstable functions (stddev > 0.15) flagged in result
- U6 will downweight unstable results in combined score
- U5 preserves all run data for U6 to make this decision
