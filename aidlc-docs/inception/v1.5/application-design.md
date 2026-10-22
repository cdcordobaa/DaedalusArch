# v1.5 Semantic Instrument: Application Design (minimal)

**Depth:** minimal, one page, as `workflow-plan.md` decided. Inputs: `requirements.md` (FR-1 to FR-14, NFR-1 to NFR-5), `ops/notes/v15-plan.md`, `ops/notes/v15-semantic-programme.md`, `ops/notes/v15-edit-gate-design.md`. **Decided:** 2026-10-22, under the author's standing delegation for gate-level calls. No design question is open: the scope questions were settled in `requirements-questions.md`, so no `[Answer]:` plan was issued (rule `application-design.md` step 4: questions only where input is needed). The four companion files of the rule (components, methods, services, dependencies) are folded into this page, as in the v1.4 cycle.

**Placement rule (Q2 = A).** Every new component lives under `experiments/` until it passes its own test (`ops/04-north-star.md`), then moves into `src/` in U1, U2 or U7. Until then `src/`, `presets/`, `scripts/lib/` and `scripts/v1.3/` are imported read-only, never edited, and the tag `v1.4-freeze-2026-10-20` is never touched (NFR-1).

## 1. New components

| Id | Component | Responsibility | Interface (input → output) | Part | Unit |
|---|---|---|---|---|---|
| S1 | **Severity rubric** | Ranks a blocking finding by grant, declared rule, then what the dependency does | a C4 prompt variant: the frozen `c4-v0.2` prompt with item 4 replaced (`rubricPrompt(ctx)`) → the same A5 answer schema | C4 | U3 |
| S2 | **Candidate confirmer** | Confirms or rejects a symbolic candidate (D5 rule placement and the other DETECT-02 families), citing code lines | (candidate: rule, exact lines, subgraph; code) → `{confirmed, cites[], reason}` per candidate | C4 over C3 | U4 |
| S3 | **Aggregate and ownership facts** | Says which classes are aggregate roots and which context owns which store, when the spec is silent | (A1 graph, code, docs) → A2 facts `isAggregateRoot`, `ownedBy` with code or doc citations | C1d | U4 |
| S4 | **Spec-inference pipeline** (BF-01 v3) | Infer → compile → run → interpret → refine; majority and outlier signals against circularity | (project) → inferred spec YAML + provenance per rule; refined after S1 reads the findings | C2 derived | U5 |
| S5 | **Grounded fix hint** | Writes the fix in terms of the agent's own code | (finding, A5 explanation, code) → `{fix, cites[]}` | C6 | U2 |
| EG | **Edit gate** | After each agent `Edit`/`Write`, runs the symbolic checks on the changed tree and shows new findings like a compiler error | PostToolUse hook stdin JSON → relay → warm hub → `additionalContext` text (where, rule, why, fix); Stop hook re-shows open findings once | C6 | U2 |
| H3 | **Three-arm harness** | Runs symbolic, semantic and both arms on the same dev cases and reports per family | (case set, arm) → recall, twin discrimination, false positives on legitimate patterns | evaluation | U6 |

## 2. Contracts with the existing parts

| Existing part | Contract | Direction | Rule |
|---|---|---|---|
| **C1d** (`src/apg-enrich/ontology/`, A2 facts) | S3 emits facts in the A2 shape (`FactsFile`, cited, `fact:<hash>` ids); new predicates are added by the variant, not by editing `FACT_PREDICATES` until promotion | S3 → C1d → C3 | A fact without a citation is dropped (I6). A declared spec always wins over a model fact |
| **C4** (`c4-contract.ts`, `c4-scorer.ts`, A5) | S1 and S2 reuse the frozen answer schema, `groundC4Answer`, `mergeRuns` and the scorer; only prompt text changes | S1/S2 → A5 | C4 never sets a verdict (N1); an exception claim needs a doc or comment citation; a single-run claim is never forwarded |
| **C3 rules** (fitness functions, DETECT-02 Cypher) | S2 receives candidates only from C3 and never adds a finding of its own; S3 facts become rule inputs when the spec is silent | C3 → S2; S3 → C3 | The symbolic verdict stays deterministic for a fixed facts file (NFR-2) |
| **MCP server** (`src/mcp-server/`, `experiments/detect-02/mcp/`) | `check_consistency` and every rule's message in the actionable format (where, rule, why, fix); EG calls the same checks as pull; S5 adds a grounded `fix` field behind a flag | EG/S5 → MCP | `--confine` stays on; under 200 ms per symbolic call; the agent sees only findings about its own tree |
| **Fitness compiler** (`src/fitness-compiler/`, style presets) | S4 emits a spec in the existing YAML format; the compiler instantiates the presets' rule templates from it unchanged; mined project rules are extra candidates, never silently blocking | S4 → compiler → C3 | The hidden-spec test compares the inferred spec with the declared one before any inferred rule blocks |

## 3. Data flow

```text
code + docs --> C1a/b extractor --> A1 graph --------------------+
                                       |                           |
                                       v                           v
                         S3 facts (C1d, A2) ---> C3 rules <--- spec (declared, or S4 inferred)
                                                    |
                                    candidates      v       findings
                                  +---------- S2 confirm ----------+
                                  v                                 v
                         S1 interpret (C4, A5) ----------> S5 fix hint
                                  |                                 |
                                  v                                 v
                       S4 refine the inferred spec       MCP pull / edit gate --> agent
```

Text alternative: the extractor builds the graph; S3 adds aggregate and ownership facts; C3 runs the rules against a declared or S4-inferred spec; S2 confirms symbolic candidates; S1 interprets each finding (exception, intent, severity); S5 writes a grounded fix; findings reach the agent through MCP pull or the edit gate; S1's readings feed S4's refinement.

## 4. Cross-cutting rules (NFR-1 to NFR-5)

- Every model-calling component records model id, prompt version and hash, and date per answer; cassettes make a replay cost zero calls; the vendor is a parameter (NFR-2).
- Every pilot has a thinking note and a call cap before its first call, and a ledger of calls (NFR-3).
- Docs and comments are data, never instructions; no secrets or personal paths in records (NFR-4).
- Each component reports under `Docs/DiagnosticRuns/` with exact numbers (NFR-5).

## Changelog
- 2026-10-22: v1, minimal.
