# D3 · neurosymbolic-layers

**Title on slide:** A layered neuro-symbolic design

**What it shows.** Four layers, cheapest at the bottom. (1) Symbolic facts: the APG extracted from the code. (2) Cheap semantic proxies: deterministic analyses that propose candidate sites (no LLM). (3) The LLM judge and, as a planned companion, a grounded ontology. (4) Rules that read both the symbolic facts and the semantic layers' outputs. Each layer carries a status chip.

**One idea.** Spend the LLM only where code meaning is needed, after deterministic layers have done what they can.

**Numbers and sources.**
- Layer 1: E1 agreement with tsc 0.996684 / 0.991602 (`Docs/DiagnosticRuns/v1.3-graph-fidelity-2026-10-14.md`, Headline); 57/57 blocking recall and precision on the development set, author view (`Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md` §3).
- Layer 2: design and runtime (50 to 130 ms per reference project) in `Docs/v1.3/cheap-semantics-design.md`, "Purpose"; 11/11 on round-1 seeds (`Docs/DiagnosticRuns/cheap-semantics-2026-10-15.md` §2); 2/9 on DUP-RULE v2 (`Docs/DiagnosticRuns/v1.3-duprule-v2-2026-10-15.md` §5). "A proxy proposes candidate sites. It does not give a verdict." (design doc).
- Layer 3: judge pooled catch 30/35 (`Docs/DiagnosticRuns/v1.3-duprule-v2-2026-10-15.md` §3). The grounded ontology is not built: there is no committed design or run in the repository, so it is shown as an open item only.
- Layer 4: the judge dimensions are reported and never block (`Docs/v1.3/rule-tiers.md`, cited in `Docs/v1.3/pilot-outcome-memo.md` §4). Proxy flags are not yet persisted to Neo4j ("Nothing is written to Neo4j", design doc), so "rules over both" is partly built.

**Caveats to say.** The ontology is not built live. Layer 2 and 3 figures are development-set construct sensitivity, not validity estimates.
