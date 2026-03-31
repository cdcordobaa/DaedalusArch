# Business Rules — U7: CLI + CI/CD + Pipeline Orchestration

## BR-1: Exit Code Determination

| Condition | Exit Code | Meaning |
|-----------|-----------|---------|
| Verdict = `pass` or `warning` | `0` | Evaluation completed, no blocking violations |
| Verdict = `soft-block` or `hard-block` | `1` | Violations detected |
| Pipeline error (any stage critical failure) | `2` | Execution error |
| Invalid arguments / missing required flags | `2` | Usage error |

**Batch exit code**: highest exit code across all projects.
- All pass → 0
- Any violations → 1
- Any errors → 2 (errors take precedence over violations)

---

## BR-2: Mode Filtering

### Evaluation Mode Resolution

| `--symbolic-only` | `--neuronal-only` | Resolved Mode |
|--------------------|--------------------|---------------|
| false | false | `full` |
| true | false | `symbolic-only` |
| false | true | `neuronal-only` |
| true | true | **Error**: mutually exclusive flags |

### Command Sequence Filtering

- `symbolic-only`: Router dispatches only to C6 (EvaluationEngine). LLMProvider is **not instantiated** (no API key required).
- `neuronal-only`: Router dispatches only to C7 (LLM Critic). Ingestion still runs (C7 needs subgraph context from Neo4j).
- `full`: Router dispatches C6||C7 in parallel. Both providers required.

### API Key Validation

| Mode | ANTHROPIC_API_KEY / OPENAI_API_KEY |
|------|------------------------------------|
| `symbolic-only` | Not required — skip validation |
| `neuronal-only` | Required — error if missing |
| `full` | Required — error if missing |

---

## BR-3: Fail-Fast vs Warning Accumulation

### Critical Errors (Fail-Fast)

Pipeline halts immediately on:
- Neo4j connection failure
- Project path does not exist or has no TypeScript files
- Spec file not found or invalid YAML
- APG extraction produces zero nodes
- Neo4j ingestion fails completely
- LLM API returns non-retryable error after exhausting retries

**On critical error**:
1. Log error to context audit log with full stack trace
2. Skip remaining commands
3. Return `PipelineError` with stage name, error message, partial timings
4. CLI prints error to stderr, exits with code 2

### Warnings (Accumulate)

Pipeline continues on:
- Parse coverage < 100% (some files unparsable)
- Unmapped files during layer annotation
- LLM confidence below threshold (flagged as unstable)
- Snapshot save failure in non-critical mode
- Individual Cypher query timeout (function marked as inconclusive)

**On warning**:
1. Add `PipelineWarning` to context
2. Continue to next command
3. Warnings included in final report
4. Verbose mode prints warnings inline

---

## BR-4: Batch Graceful Failure

### Per-Project Isolation

Each project in a batch run:
- Gets a **fresh** `FirewallContext` (new RunId)
- Gets a **fresh** `PipelineExecutor` (new command sequence)
- Neo4j graph is **cleared** before each project (`clearGraph()`)
- Errors in one project do **not** affect others

### Error Row Format

```
project_path, ERROR, "error message", 0, 0, 0ms
```

### Batch Abort Conditions

Batch **never** aborts early. Even if Neo4j is down, each project attempt produces an error row. The only abort case:
- User interrupt (SIGINT) — graceful shutdown, output CSV with results so far

---

## BR-5: GitHub Action Check Status

### Verdict → Check Conclusion Mapping

| Verdict | Check Conclusion | PR Status |
|---------|-----------------|-----------|
| `pass` | `success` | Green check |
| `warning` | `success` | Green check (warnings in summary) |
| `soft-block` | `failure` | Red X |
| `hard-block` | `failure` | Red X |

### AHS Threshold (Optional)

If `ahs-threshold` input is provided:
- AHS >= threshold → `success` (regardless of verdict)
- AHS < threshold → `failure` (overrides verdict)

Default: no threshold, rely on verdict logic.

---

## BR-6: Configuration Resolution Order

CLI options resolve in priority order (highest first):

1. **Explicit CLI flags** (`--neo4j-uri bolt://custom:7687`)
2. **Environment variables** (`NEO4J_URI`, `ANTHROPIC_API_KEY`)
3. **`.env` file** (loaded via dotenv at startup)
4. **Defaults** (neo4j-uri: `bolt://localhost:7687`, format: `human`, mode: `stateless`)

### Required vs Optional

| Option | evaluate | batch | drift |
|--------|----------|-------|-------|
| `--project` | Required | — | Required (default mode) |
| `--spec` | Required | Required | Required (default mode) |
| `--dir` | — | Required | — |
| `--from` / `--to` | — | — | Optional (explicit mode) |
| `--neo4j-uri` | Optional | Optional | Optional |
| `--format` | Optional | Optional | Optional |
| LLM API key | Required unless symbolic-only | Required unless symbolic-only | Not required |

---

## BR-7: Signal Handling and Graceful Shutdown

### SIGINT (Ctrl+C)

1. Set shutdown flag
2. Current command completes (no mid-stage abort)
3. Skip remaining commands
4. Close Neo4j connection pool
5. Output partial results if available
6. Exit code 2

### SIGTERM

Same as SIGINT — graceful shutdown.

### Cleanup Guarantee

`finally` block ensures:
- Neo4j connection pool closed
- Temporary files cleaned up
- Partial batch CSV flushed to stdout

---

## BR-8: Output Routing

| Stream | Content |
|--------|---------|
| `stdout` | Machine-readable output (JSON report, CSV rows) |
| `stderr` | Human-readable content (summary, progress spinners, warnings, errors, verbose logs) |

This enables piping: `firewall evaluate ... > report.json` captures only the structured output while the user sees progress on stderr.

### Format × Command Matrix

| Command | `json` | `human` | `csv` |
|---------|--------|---------|-------|
| evaluate | Full JSON report to stdout | Summary to stderr only | Single CSV row to stdout |
| batch | JSON array to stdout | Summary table to stderr | CSV with header to stdout |
| drift | JSON drift report to stdout | Drift summary to stderr | Not supported |
