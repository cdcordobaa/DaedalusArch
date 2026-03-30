# Unit 5 — Neuro-Symbolic Router + Evaluation: Design Questions

## Q1: Hybrid Dispatch Strategy

For hybrid functions (e.g., FF-N01 srp-semantic), both symbolic and neuronal paths run. Options:

**A) Sequential — symbolic first, neuronal only if symbolic passes** — Saves LLM tokens when the symbolic check already catches violations. But if symbolic passes and neuronal fails, the violation is purely semantic (useful data).

**B) Always parallel** — Both paths always run regardless of symbolic result. Maximum information. LLM cost is fixed per hybrid function. Enables full ablation comparison (symbolic vs neuronal vs combined).

**C) Sequential — symbolic first, neuronal always** — Symbolic runs first (fast), then neuronal always runs. The symbolic result is available to inform neuronal context, but neuronal is not skipped. Best of both: fast symbolic feedback + full neuronal data.

[Answer]:

---

## Q2: VCR/Cassette Implementation

US-10.8 requires full audit logging and deterministic testing. VCR options:

**A) File-based cassettes** — Record LLM responses to `fixtures/cassettes/{functionId}.json`. In replay mode, return recorded response instead of calling LLM. Simple, portable, git-trackable.

**B) In-memory mock provider** — A `MockLLMProvider` that implements `LLMProvider` with canned responses per prompt hash. No file I/O. Faster for unit tests. Less useful for integration.

**C) Both** — File-based cassettes for integration tests (realistic), in-memory mock for unit tests (fast). VCR mode selects: `record` (call LLM + save), `replay` (load cassette), `bypass` (call LLM, don't save).

[Answer]:

---

## Q3: Violation Collection from Cypher Results

When Cypher queries return violation records, how to map them to `Violation` objects?

**A) Convention-based column mapping** — Cypher returns specific column names: `filePath`, `source`, `target`, `srcLayer`, `tgtLayer`, `class`, `methodCount`, etc. The evaluator maps known column names to Violation fields. Unknown columns ignored.

**B) Template-annotated mapping** — Each `CypherTemplate` (from U3) includes a `resultMapping` config that describes how to convert result records to Violations. More explicit but adds template complexity.

**C) Generic record-to-violation** — Every Cypher result row becomes one Violation. The `filePath` column is required; all other columns become violation metadata. Simple, flexible.

[Answer]:

---

## Q4: ICC Computation Method

US-10.6 requires Intraclass Correlation Coefficient across multiple LLM runs. Options:

**A) ICC(3,1) — Two-way mixed, single measures** — Standard for inter-rater reliability where raters are fixed. Treats each LLM run as a "rater" evaluating the same function. Most appropriate for our case (same model, same prompt, different random seeds).

**B) Simple consistency check** — Skip formal ICC. Just compute stddev of confidence scores across runs. Flag as unstable if stddev > 0.15. Simpler, avoids ICC's edge cases (all-same scores → NaN).

**C) ICC with fallback** — Compute ICC(3,1). If undefined (all scores identical or single run), fall back to stddev-based check. Handles edge cases gracefully.

[Answer]:

---

## Q5: LLM Context Budget

Context assembly (US-10.1) must fit within LLM token limits. How to manage?

**A) Fixed budget per component** — Allocate fixed token budgets: code snippet (2000 tokens), APG subgraph (500 tokens), rule+rubric (300 tokens), ADR prose (500 tokens). Truncate to fit. Simple, predictable.

**B) Adaptive budget** — Estimate total available tokens from model context window. Allocate proportionally based on what's available. Code gets most, subgraph gets remainder. More complex but better utilization.

**C) Priority-based truncation** — Include everything, but if total exceeds limit, truncate in priority order: ADR prose first, then subgraph, then code. Rule+rubric always included in full. Simple priority, no budget math.

[Answer]:
