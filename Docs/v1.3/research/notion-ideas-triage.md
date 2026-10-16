# Notion ideas triage (2026-10-16)

**Scope.** This file checks every distinct idea, open item, decision, promise and conflict in the author's Notion thesis hub ("🧱 Governing AI-Agentic Development: A Spec-Driven Neuro-Symbolic Architectural Firewall", `2d5b9aaddac84c9da6c0681666d51812`) against the repository. It covers the hub's own content, every page the hub mentions (document chain #1–#7, the writing instruments, the readiness audit, the golden dataset design, the compliance register, the experiment protocol, the plan of record, the Chapter 4 drafts and the DSR frame), the hub's inline Next Actions database, and three more pages: long-term ideas (`3f750d30822781f491c0f00cedcd075b`), the v1.3 brief (`3f950d308227810a8225e3b3f0be58f2`) and the roadmap (`3f550d308227814f9ad0ed16b356f196`).

**Baseline.** `origin/v1.3` at `d65fddbb` (#163). Sources checked: `Docs/v1.3/`, `Docs/DiagnosticRuns/`, `Docs/*.md`, `aidlc-docs/`, `src/`, `presets/`, `results/`, and all 170 PRs (merged, closed and open). Open PRs are cited as evidence of work in flight, not as done work. Notion was only read, except for one status callout inserted at the top of the hub.

> **Update 2026-10-16T05:26Z.** After the baseline, a late merge train merged #142 (loop replay), #153 (model panel harness) and #157 (neural arm as MCP tools) into v1.3 (tip `1dfddfab`). Rows that call these PRs open describe the baseline state. In Part 2, rank 1 ("merge #142") and rank 7's harness half are now done. The Gemini key and the panel run itself are still with the author.

**Status vocabulary.**
- **DONE**: cites a PR, doc or commit.
- **SUPERSEDED**: names what replaced the item.
- **OPEN**: relevant to SO1–SO5 or to Study 2 running once. Mapped to a job in `Docs/v1.3/night-backlog-2026-10-16.md` ("night-backlog X"), in `aidlc-docs/construction/plans/v1.3-night-2026-10-16-plan.md` ("night-plan X"), to an open PR, or marked NEW.
- **OUT**: doctoral or future work, or on the backlog kill list.
- **UNCLEAR**: the evidence does not settle it. No fact was invented to close an UNCLEAR.

Rows with a split status (for example "DONE / OPEN") are counted under their first status. Counts are per page row. The same idea often appears on several pages, so the totals count rows, not unique ideas.

## Summary counts

| Source group | Rows | DONE | SUPERSEDED | OPEN | OUT | UNCLEAR |
|---|---|---|---|---|---|---|
| Hub own content, chain #1 (research foundations), chain #2 (ADRs) | 99 | 35 | 42 | 7 | 7 | 8 |
| Chain #3 spike, #4 SRS, #5 diagnosis, #6 scope evolution | 103 | 49 | 30 | 7 | 8 | 9 |
| Chain #7 proposal, document outline, plan de cierre, Ch4 draft v1 | 99 | 40 | 23 | 18 | 9 | 9 |
| Ch4 draft v2, DSR frame, Ch5–7 outline, readiness audit | 110 | 49 | 29 | 19 | 5 | 8 |
| Golden dataset, compliance register, experiment protocol, plan of record | 96 | 66 | 17 | 5 | 3 | 5 |
| Long-term ideas, v1.3 brief, roadmap, Next Actions DB | 90 | 24 | 6 | 39 | 11 | 10 |
| **Total** | **597** | **263** | **147** | **95** | **43** | **49** |

**The one-line reading.** Almost everything planned in the pages written before 2026-10-07 has been built in the v1.2E cycle (PRs #1–#73) or replaced in v1.3. The OPEN rows cluster on five themes:
- Study 2 readiness;
- the author-only gates (the construct sheet, judge v2.2, the freeze, the Gemini key);
- SO4 evidence on human-written code;
- a thesis structure that has no place for Study 2 yet;
- a method statement that still says "no inference".

---

## Part 1: Per-page tables

Repo state checked: `origin/v1.3` tip d65fddbb, read only. Notion was only read (fetch); nothing was edited.

### Governing AI-Agentic Development: A Spec-Driven Neuro-Symbolic Architectural Firewall (2d5b9aaddac84c9da6c0681666d51812)
Project hub page (Projects DB). It holds the status table, conflict callout, writing instruments and the Chapter 4 narrative outline. Last edited 2026-10-07. Only the hub's own content is triaged here; the linked pages are covered by other agents.

| # | Idea / open item / decision / promise / conflict | Status | Evidence | Next action |
|---|---|---|---|---|
| 1 | Status: Implementation SO1–SO3 "Done, 17 Cypher rules, 5 ground-truth projects" | SUPERSEDED | 27 FF-* IDs plus the hexagonal and DDD rules (`Docs/v1.3/rule-tiers.md`); 5 presets; golden N=75 (`Docs/threats-to-validity.md` TV-17) | Rewrite the row |
| 2 | Status: Measurement SO4 "Pending, needs freezing, dataset expansion, protocol run" | DONE (v1.2E) / OPEN (v1.3) | `results/so4-heldout/`, ADR-024/025/033, catalogue freeze P-1; v1.3 SO4 work in night-plan §1 (R1 #131, X1 #133, A1 #168, A3 #166) | Update the row. Open items map to night-plan §1 and night-backlog X1/K2/K1 |
| 3 | Status: Writing "Pending, not yet turned into chapters" | SUPERSEDED | night-plan §5: "Ch7–9 drafts carry the corrected numbers" (`draft/ch7-9-v13` @8ba525a, private repo) | Update the row (not verifiable from this repo) |
| 4 | Status: LLM judge "Not implemented, open decision" | SUPERSEDED | `src/llm-critic/` (claude-cli, agy, gemini providers); judge v1 frozen (`Docs/v1.3/judge-catch-frozen.md`); v2 #126; v2.2 #141 open | Author's local v2.2 run (night-plan X4, open PR #141) |
| 5 | Conflict: rule count 17 vs 24 vs "26+" | SUPERSEDED | 27 FF-* IDs plus hex/DDD library rules, tiered blocking/advisory (`rule-tiers.md`, #84) | Use the v1.3 catalogue count everywhere |
| 6 | Conflict: graph scope AST-only vs CPG vs APG (5 nodes / 7 edges) | SUPERSEDED | `src/shared/types/enums.ts`: 6 node types (+Package), 9 edge types (+FLOWS_TO, RE_EXPORTS), v1.3 module edges, APG2 opt-in (#98); AST-only ablation `results/apg-ablation/` (#23, #38) | State 6/9 plus the opt-in layers |
| 7 | Conflict: method, "quantitative-descriptive, no inferential testing" | SUPERSEDED | `Docs/analysis-plan.md` §6: Holm-corrected confirmatory permutation tests for SO5; `Docs/v1.3/study2-outline.md` §5 sign-flip permutation test | Restate the method as descriptive SO1/SO2/SO4 plus registered permutation tests for SO5 and Study 2 |
| 8 | Conflict: neural path "no real LLM providers wired" | SUPERSEDED | `src/llm-critic/claude-cli-provider.ts`, `gemini-provider.ts`, `agy-cli-provider.ts`; live judge pass on E1 (`results/e1-grid/judge-diagnostics`) | Delete the bullet |
| 9 | AI-DLC cycle v1.2 "18 FR … awaiting approval to proceed to Workflow Planning" | SUPERSEDED | `aidlc-docs/aidlc-state.md`: v1.2E built (U0–U5b merged) and B&T stopped at Step 49 (E-1/E-2); the v1.3 validity cycle is now in CONSTRUCTION | Replace with the v1.3 cycle status |
| 10 | Frame 1: numbering 4.1–4.6 + Appendices A/B, no 4.7 | UNCLEAR | Thesis repo is private; no evidence in this repo | Author to confirm in the thesis repo |
| 11 | Frame 2: two hand-offs (Ch.5 graph, Ch.6.1 compiler) | UNCLEAR | Writing decision; no repo evidence | Keep. Verify in the private draft |
| 12 | Frame 3: use AaC, not AoC | OPEN | Repo still says AoC (`Docs/ADR …` ADR-004, `Docs/AoC Specification …md`) | NEW: terminology pass in the thesis only (kill list #12 forbids a repo doc sweep) |
| 13 | Frame 4 + register rules: master's framing with doctoral rigour; "configurable checker, not a language"; by-construction vs by-measurement; provenance on every number | OPEN | Open PR #169 "research gaps … master's vs doctoral scope" | Align with #169 when merged |
| 14 | Frame 5: running example FF-S01 / `dependency-direction` / `layerOrder`, Layer C weight 0.35 | DONE (built) / UNCLEAR (still valid) | FF-S01 still in the catalogue (`rule-tiers.md`); v1.3 tiers make it blocking | Re-verify the template and the tier at the freeze commit before citing it |
| 15 | Frame 6: language of the final text (open) | UNCLEAR | No decision in the repo; only `Docs/v1.3/human-labelling-protocol.md` App. B is in Spanish | Author decision |
| 16 | Provenance: "all counts re-derived at `7cd15b4` (2026-09-20)" | SUPERSEDED | Catalogue, presets, graph and validator changed through v1.2E/v1.3 (d65fddbb) | Re-derive every Ch4 count at the v1.3 freeze commit |
| 17 | Gap: verify F1 on live Neo4j (7 × EVAL_001) | SUPERSEDED | F1 fixed in v1.2E: FR-v1.2E-07/08 (typed fields + always-fatal BR-SPEC-10; `src/fitness-compiler/bound-param-checker.ts`) | Narrate F1 as a found-and-fixed defect, with a before/after probe |
| 18 | Gap: six engine defects itemised (Table 4.11) | DONE | Hub checklist; commits 7e5b043, 178f0d3, 747e762, a63cc05 | — |
| 19 | Gap: fix the Listing 4.1 caption count (37/33) | UNCLEAR | Thesis-only; private repo | Author/writing pass |
| 20 | Gap: decide strict mode or state stage 2 as advisory | OPEN | `strictMode: false` default (`src/spec-parser/types.ts`); BR-SPEC-10 fatal regardless (requirements D-7) | NEW: state it in Ch4 as "stage 2 advisory except BR-SPEC-10" |
| 21 | Gap: settle the three PENDING REFs in 4.1 | UNCLEAR | Thesis-only | Writing pass |
| 22 | Gap/decision: "In-memory evaluator: none exists in src/" | SUPERSEDED | In-process Cypher interpreter `src/cypher-interp/` (#128); `apg2-in-memory.ts`, `cheap2-in-memory.ts`; npx mode #135 | Rewrite the item. The Ch4 claim must now cover two engines |
| 23 | Decision: tier tag "never built, not narrated" (2026-09-21) | SUPERSEDED | FR-29 catalogue tags (`TemplateTag` in `enums.ts`; ADR-017 item 6); v1.3 blocking/advisory tiers (`rule-tiers.md`, #84) | Re-open: Ch4 must narrate tiers |
| 24 | 4.3: "predicate (15) / metric (9)", "closed catalogue of 24 names", 26-row Appendix B | SUPERSEDED | 27 FF-* IDs plus hex/DDD; v1.3 templates (`src/fitness-compiler/v13-templates.ts`, `hexagonal-templates.ts`, `ddd-templates.ts`) | Recount at the freeze |
| 25 | 4.4: "two libraries vs 2–3/3–4 promised"; name binding blocks hexagonal/onion | SUPERSEDED | 5 presets (`presets/`); FR-v1.2E-19 binds by `kind`; hexagonal and DDD libraries exist | Rewrite 4.4 |
| 26 | 4.4: loading a preset emits 26 SPEC_002 + 1 SPEC_001 | UNCLEAR | Not re-checked at d65fddbb | Re-run the validator at the freeze |
| 27 | 4.5.2: total-order limit; fix = reinstate `allowed_dependencies`, add `modules:`, two T1 templates | DONE (partly) | `allowed_dependencies` is back for hexagonal (`src/spec-parser/spec-schema.ts`); DDD `contexts`; no generic `modules:` | Narrate it as partly lifted (style-scoped) |
| 28 | 4.5.2: "FF-N01 has no template; FF-CV01 cannot fail" | SUPERSEDED | FF-N01/N02 are judge-reported, non-blocking in v1.3; FF-CV01 excluded (ADR-022 item 1) | Restate |
| 29 | 4.5.4 threats: empty dimension earns full credit (F9); every AHS computed without F1 checks | SUPERSEDED | FR-v1.2E-15 renormalisation + `droppedDimensions`; F1 fixed (FR-07/08) | Move to the "defects fixed" history |
| 30 | 4.2: "ADR-007 weight sensitivity analysis never run" | OUT (kill list #14) | night-backlog §4 #14; registered aggregation variant only (ADR-028) | Keep the sentence: weights are a judgement |
| 31 | 4.5.3: R5 style libraries "designed for, not demonstrated"; no usability study | SUPERSEDED (R5) / OUT (usability) | Layered held-out run (TV-20, `results/pre-tag/`); hex/DDD dev data #162; human studies out (night-backlog §4 #15) | Update R5 wording |
| 32 | Closing: "spike 0.85→0.33; 0.54/0.78/0.80 on 3 NestJS projects; <5 s" as headline evidence | SUPERSEDED | Registered SO4 held-out, E1, E7 and v1.3 external-set results (`results/so4-heldout`, `results/e1-grid`, #133) | Replace with registered results |
| 33 | Closing: "neuronal path is a separate experiment with its own validity argument" | DONE / OPEN | Judge v1 frozen, judge-catch; v2.2 pending (#141) | night-plan X4 |
| 34 | Conflicts table (Listing length, stages, defects count, spike naming, exclusions, unbound counts, hedging, terminology, hand-off) | UNCLEAR | Thesis-text conflicts; in-memory row superseded (#22); unbound-count row moot after F1 fix (#17) | Resolve in the private draft |

#### Wrong statements
- "LLM judge (Semantic / Integrity) — Not implemented" → Judge v1 is frozen (`Docs/v1.3/judge-catch-frozen.md`), judge v2 merged opt-in (#126), and v2.2 is prepared (#141).
- "Neuronal path: … no real LLM providers wired" → Claude CLI, agy and Gemini providers exist (`src/llm-critic/*-provider.ts`), and live judge passes ran on E1.
- "17 Cypher rules, 5 ground-truth projects" → 27 FF-* IDs plus hex/DDD rules (`rule-tiers.md`). Ground truth is the golden dataset, N=75 held-out (TV-17).
- "quantitative-descriptive with no inferential hypothesis testing" → SO5 has Holm-corrected permutation tests (`Docs/analysis-plan.md` §6). Study 2 plans a permutation test (`study2-outline.md` §5).
- "In-memory evaluator: none exists in `src/`" → `src/cypher-interp/` (#128), byte-identical on the 71 reference cases.
- "the tier tag was never built" → FR-29 tags and v1.3 blocking/advisory tiers (#84, `rule-tiers.md`).
- "two libraries" / "name-based binding blocks a hexagonal or onion library" → 5 presets; kind binding (FR-v1.2E-19).
- "awaiting approval to proceed to Workflow Planning" (v1.2 cycle) → v1.2E fully built; v1.3 cycle in construction (`aidlc-state.md`).
- "Verify F1 … expected 7 × EVAL_001" → F1 is fixed (FR-v1.2E-07/08, BR-SPEC-10). Today the run would not reproduce the defect.
- "Writing — not yet turned into chapters" → Ch7–9 drafts exist (night-plan §5, private repo).

### thesis-research: Evaluating Architectural Alignment of LLM-Generated Code: Research Foundations + Experimental Design companion (32c50d30822780b1a2f9d10505d62516)
Doc chain #1. March-2026 research compilation: benchmark review, CPG vs APG, tool landscape, gaps, APG proposal, fitness functions, reconciled SOs/H1–H4, ISE, and the experimental design v1.0. Last edited 2026-06-03.

| # | Idea / open item / decision / promise / conflict | Status | Evidence | Next action |
|---|---|---|---|---|
| 1 | Benchmark / tool review §2–6 (HumanEval, SWE-bench, BaxBench, LoCoBench, SonarQube AaC, CodeRabbit, CodeQL, Joern) | DONE (as source) / OUT (update) | Feeds Ch2; literature review is on kill list #10 | Re-check SonarQube's "deprecated Jan 2026" claim at writing time |
| 2 | Research gaps 1–5 (§7) | DONE (source) | Gap 5 (analysis depth vs detection) answered by the AST-only ablation (`results/apg-ablation/`, #23) | Re-map the gaps to the v1.3 evidence map (open PR #169) |
| 3 | APG five-layer graph (file, declaration, dependency, annotation, **violation** layer with VIOLATES/BYPASSES stored in the graph) | SUPERSEDED | `src/shared/types/enums.ts` has no Violation nodes or edges; violations live in the report | Describe the APG as 6 node / 9 edge types |
| 4 | Directory/Module nodes, DEPENDS_ON, INJECTS, type aliases/enums | SUPERSEDED | NODE_TYPES = File, Class, Interface, Method, Function, Package; APG2 `DEPENDS_ON` is opt-in (#98) | — |
| 5 | Performance estimate <10 s/project; hundreds of projects | DONE (measured) | H13 latency gate (`results/latency-gate/`, #23); interpreter ~20 ms per graph stage (night-backlog §4 #8) | Cite the measured figures |
| 6 | "Graph persists across analyses; cross-project queries" (§9.7) | SUPERSEDED | ADR-010 stateless fresh graph per run | — |
| 7 | Neo4j GDS (Louvain, PageRank, community detection) | OUT (kill list #9) | night-backlog §4 #9 | — |
| 8 | H4 / §9.8: APG vs CodeQL gap study (≥85 % at ≤15 % cost) | SUPERSEDED | Replaced by the AST-only ablation (#23/#38), the dependency-cruiser comparison (ADR-030, #51) and convergent validity (#166) | Drop CodeQL from the claims |
| 9 | LLM-as-judge for soft qualities, calibrated vs human experts (ICC > 0.70) | SUPERSEDED | Judge built; validity rests on non-human evidence (night-plan author decision 2; kill list #15) | night-plan X4 (#141) |
| 10 | Layer A/B/C examples (`contains.roles`, `allowed: from/to`, `rule:` names, scoring `aggregation: worst-case`, weights .35/.20/.30/.10/.05) | SUPERSEDED (format) / DONE (weights) | Implemented schema `src/spec-parser/spec-schema.ts`; the weights match the FR-v1.2E-15 test; per-dimension aggregation modes never built | — |
| 11 | domain-purity on `b.module` strings | DONE (changed) | Package nodes (FR-v1.2E, enums.ts); FR-11 via IMPORTS\|RE_EXPORTS (ADR-017 item 5) | — |
| 12 | Neuro-symbolic split: semantic FFs as "future extension" | SUPERSEDED | Semantic + Integrity dimensions (`enums.ts` DIMENSIONS); FF-N01/N02 reported, non-blocking | — |
| 13 | Spec quality as IV (formal / semi / informal) | DONE | E1 grid: 3 spec levels (ADR-017 item 3; `results/e1-grid/`) | — |
| 14 | Reconciled SO1–SO4 (4 SOs) | SUPERSEDED | Now SO1–SO5; SO5 = firewall effect on agent code (Study 2), ADR-017 item 2 | Use the SO1–SO5 wording |
| 15 | H1: P ≥ 0.90, R ≥ 0.85, κ ≥ 0.60 vs human expert ground truth | SUPERSEDED | Seeded golden dataset + non-human validity evidence (TV-10…TV-21; night-plan §1) | — |
| 16 | H2 failure taxonomy (clustering of per-dimension AVR) | DONE (partly) | FPAT-* family counts and open coding, exploratory (`analysis-plan.md` SO5 row) | — |
| 17 | H3 ANOVA (p < 0.05) | SUPERSEDED | Holm permutation tests (analysis-plan §6) | — |
| 18 | Thesis structure §13 incl. RQ1 across styles (clean, layered, hexagonal, MVC) | SUPERSEDED | Official outline + DSR frame (hub); styles = 5 presets, no MVC | — |
| 19 | Open Q1: compiler completeness, which checks resist Cypher | OPEN | Rule-gap catalogue, open PR #144 (night-plan Y2) | night-plan Y2 |
| 20 | Open Q2: weight calibration | OUT (kill list #14) | night-backlog §4 #14 | — |
| 21 | Open Q3: spec usability by architects | OPEN (partial) | Spec-author reliability (night-backlog K2); human usability study out (kill #15) | night-backlog K2 |
| 22 | Open Q4: judge rubric reliability | OPEN | Judge v2.2 + CHECK-2 (#141); selective prediction (night-backlog N1) | night-backlog N1, night-plan X4 |
| 23 | Open Q5: ground-truth size and violation types | DONE | Operator catalogue (`Docs/operator-catalogue.md`), N=75 (TV-17); hex/DDD operators #162 | night-plan Y1 (#162) |
| 24 | Open Q7: default FFs from the style name alone | DONE | ISE `src/ise/style-classifier.ts`, `preset.ts` (#96, #105) | — |
| 25 | Open Q8: generalisation beyond TypeScript | OUT | Doctoral/future work (ADR-001) | — |
| 26 | Open Q9: interaction effects / correlated checks | DONE (declared) | TV-14 (one injection fires FF-S01, S04, P06) | — |
| 27 | ISE: Mode B intrinsic consistency, ICS, RQ5, 2×2 space | DONE (exploratory) | `src/ise/`, #96, #100 (ISE on E1), #105, `results/v1.3-ise*` | — |
| 28 | ADRs are not specs; ADR→spec translation out of scope | DONE | Hub 4.1 exclusions; ADR parsers yield only neuronal rules (hub 4.6) | — |
| 29 | Style templates with `{{param}}` placeholders; ~30 lines of YAML "authored in minutes" | SUPERSEDED | Presets + id merge + kind binding; "minutes" is unsupported (hub CONFLICT) | — |
| 30 | Template libraries to build: clean (primary), layered, hexagonal | DONE | `presets/` clean-architecture, layered, hexagonal (+ddd, nestjs) | — |
| 31 | Constant evaluation spec across conditions; 3 prompt templates | DONE | E1 generator plan (`experiments/e1-grid/generator-plan.json`) | — |
| 32 | Universal health metrics, reported separately | DONE (partly) | Universal cycle metric (#23), orphan metric (ADR-016 g) | — |
| 33 | Design: LLMs GPT-4o / Claude / DeepSeek; 135–288 projects; within-subjects spec quality | SUPERSEDED | E1: 3 Claude models + Codex arm (ADR-029), 54 cells (ADR-017 item 3) | — |
| 34 | Phase 1: 20–30 hand-crafted projects annotated by 2–3 experts | SUPERSEDED | Seeded golden dataset on a real corpus (E7) + external set #133 | — |
| 35 | Deferral: pre-generation context injection ("AoC specs as system prompts for agents") | SUPERSEDED (now in scope) | Study 2 / SO5: MCP firewall in the loop (`Docs/mcp-firewall-in-the-loop.md`, #122, gate #146) | Study 2 runs once (night-backlog S1–S4, D1, D2) |
| 36 | Deferral: brownfield evaluation | OPEN (as probe) | Brownfield precedent probe (night-backlog F2); rule mining #145 | night-backlog F2 |
| 37 | Deferral: remediation / fix generation | OUT (partly built) | Fix hints #143 (tool behaviour, opt-in) | — |

#### Wrong statements
- "SO1–SO4 … Empirical Validation & Benchmark" (4 objectives) → there are 5 objectives. SO5 (Study 2, firewall effect on agent code) is in scope (ADR-017 item 2).
- "H3 … p < 0.05, ANOVA" / "3 × 3 factorial ANOVA" → ANOVA was dropped. E1 uses Holm-corrected permutation tests (`analysis-plan.md` §6). ADR-011 is superseded (ADR-017 item 3).
- "H4: APG detects ≥85 % of what CodeQL finds" → no CodeQL study exists. Its replacements are the AST-only ablation (#23/#38), dependency-cruiser (ADR-030) and convergent validity (#166).
- "Layer 5 — Violation: VIOLATES edges … stored in the graph" → no violation nodes or edges exist (`src/shared/types/enums.ts`).
- "Semantic fitness functions (future extension)" → the judge is built and frozen (judge-catch-frozen.md); there are 7 dimensions.
- "annotated by 2–3 software architecture experts" → ground truth is seeded by construction (operator catalogue). Validity uses non-human evidence (author decision 2).
- "GPT-4o, Claude Sonnet 4, DeepSeek-V3" → E1 models are claude-haiku-4-5, claude-sonnet-5-5 and claude-opus-5-5, plus a Codex arm (`experiments/e1-grid/generator-plan.json`, ADR-029).
- "Pre-generation context injection … deferred" → this is now Study 2's subject (MCP in the loop).

### ADR — Architectural Decision Records: Firewall Technical Foundations (ab1531ca2eea4cca82b3a57cde5b3d92)
Doc chain #2. ADR-001…014 as of 2026-03-27, plus a summary log that lists ADR-015…018. Last edited 2026-03-27. The repo copy has grown to ADR-038 plus ADR-V13-*.

| # | Idea / open item / decision / promise / conflict | Status | Evidence | Next action |
|---|---|---|---|---|
| 1 | ADR-001 TypeScript only | DONE | Still in force; external-validity threat | — |
| 2 | ADR-002 ts-morph, lenient parsing, parse coverage % | DONE | `src/apg-extractor/`; report `parseCoverage` (FR-v1.2E-14) | — |
| 3 | ADR-003 Neo4j Community + Browser | DONE / partly SUPERSEDED | Neo4j is the reference engine; in-process interpreter #128; npx no-DB mode #135 open | night-plan I3b (#135); night-backlog P1, E1 |
| 4 | ADR-004 Layer A `allowed_dependencies` + `mappings` | SUPERSEDED | Replaced by layer order; `allowed_dependencies` re-added for hexagonal only (`spec-schema.ts`); `mappings` never built (hub 4.6, F10) | — |
| 5 | ADR-004 Layer C weights .25/.15/.25/.20/.15, pass 0.70 | SUPERSEDED | Implemented .35/.20/.30/.10/.05 (FR-v1.2E-15) + semantic/integrity weights | — |
| 6 | ADR-004 "17 pre-built FFs auto-loaded by style" | SUPERSEDED | 27 FF-* IDs; 5 presets (`presets/`) | — |
| 7 | ADR-004 consequence: publish JSON Schema | DONE | `src/spec-parser/spec-schema.ts`; report schema `schemas/report.schema.json` (FR-14) | — |
| 8 | ADR-005 APG 5 node / 7 edge types | SUPERSEDED | 6 node (Package) / 9 edge (FLOWS_TO, RE_EXPORTS) + MODULE_* + HOLDS_STATE_OF + APG2 opt-in (`enums.ts`) | — |
| 9 | ADR-005: no data-flow; "H4 quantifies vs CodeQL" | SUPERSEDED | FLOWS_TO (FR-v1.2E-21), near-empty on real projects (ADR-023); CodeQL replaced (see chain #1 #8) | — |
| 10 | ADR-006 parameterised Cypher; `$allowedDeps` example; APOC for cycles | DONE (drifted) | Query text differs (`layerOrder`; hub F10); Neo4j 5.26.24 + bundled APOC (night-backlog rule 8) | — |
| 11 | ADR-006 "no JS post-processing needed" | DONE | Kill list #8 forbids rewriting rules in TS ("one-definition claim") | — |
| 12 | ADR-007 AVR/AHS, 5 dimensions; binary AVR | SUPERSEDED | 7 dimensions (`enums.ts`); empty-dimension renormalisation (FR-15); ahsDeterministic/ahsCombined; v1.3 tier scoring mode (#84) | — |
| 13 | ADR-007 rationale "enables ANOVA" | SUPERSEDED | Permutation tests (analysis-plan §6) | — |
| 14 | ADR-007 count-weighted AVR (Should-Have v1.1) | UNCLEAR | No evidence found; v1.3 reports blocking counts (study2-outline) | — |
| 15 | ADR-007 weight sensitivity analysis | OUT (kill list #14) | Only the registered aggregation variant (ADR-028) | — |
| 16 | ADR-008 seeded violations, MANIFEST.md, "100 % detection", "20+ variants" | DONE (evolved) | Operator catalogue + golden N=75 below the 80 floor (TV-17); MO-X01 0/6 missed (ADR-030 context); real-pair and external sets (ADR-030, #133) | night-backlog X1 |
| 17 | ADR-009 CLI `evaluate` / `batch` | DONE | `src/cli/`; also MCP server (#122), HTML report #140, CI gate #138 (open, tool behaviour) | — |
| 18 | ADR-009 Could-Have: GitHub Action | OUT | Open PR #138 (night-plan J6), not an SO deliverable | — |
| 19 | ADR-010 stateless fresh graph per run | DONE | Reference-case byte identity per run (night-backlog rule 3) | — |
| 20 | ADR-011 3×3 factorial, 135 projects, ANOVA, Claude 3.5 / GPT-4o / Gemini | SUPERSEDED | ADR-017 item 3: E1 = 3 Claude models × 3 spec levels × 2 tasks × 3 runs = 54; Codex arm ADR-029 | — |
| 21 | ADR-012 mapping strategies (directory, naming, decorator); ML classifier deferred to ISE | DONE (decorator mapping UNCLEAR) | Mapping rules implemented; ISE built (`src/ise/`); ADR-022 says decorators are not ingested (BR-U2-31) | Verify the decorator mapping before citing it |
| 22 | ADR-013 universal metrics outside AVR/AHS | DONE (partly) | Universal cycle metric (#23); orphan metric (ADR-016 g) | — |
| 23 | ADR-014 Node.js + TypeScript | DONE | Repo | — |
| 24 | Log ADR-015 "LLM Critic Agent — Not started" | SUPERSEDED (and numbering collides) | Built: `src/llm-critic/`, judge v1 frozen. Repo ADR-015 is "Evaluation-readiness design decisions" | Renumber/flag on the Notion page |
| 25 | Log ADR-016 "Deterministic neuro-symbolic routing — Not started" | DONE | `src/neuro-symbolic-router/`; Route = symbolic/neuronal/hybrid (`enums.ts`) | — |
| 26 | Log ADR-017 "Dual scoring — Not started" | DONE | ahsDeterministic / ahsCombined (analysis-plan §6; ADR-020 item 7) | — |
| 27 | Log ADR-018 "Ablation study design — Not started" | DONE | APG-full vs AST-only ablation `results/apg-ablation/` (#23, #38); APG2 ablation #98 | — |
| 28 | Performance "<5 s per project" | DONE (measured) | H13 latency gate (`results/latency-gate/`) | — |

#### Wrong statements
- Log: "015 LLM Critic Agent … 🔲 Not started" (and 016–018 the same) → all four are built: llm-critic, router, dual AHS, ablation. Repo ADR-015…018 are different decisions ("Evaluation-readiness…", "Lane-2…", "Scope and requirement amendments…", "Judge config-directory allow-list"). A reader citing "ADR-017" gets a different decision depending on the source.
- ADR-011 "3 × 3 … 135 projects … Two-way ANOVA" listed as Accepted → superseded by ADR-017 item 3 (54-cell E1 grid, permutation tests).
- ADR-005 "5 node types + 7 edge types" → 6 node / 9 edge types, plus opt-in v1.3 and APG2 types (`src/shared/types/enums.ts`).
- ADR-004 weights ".25/.15/.25/.20/.15" and "17 pre-built fitness functions" → the weights are .35/.20/.30/.10/.05 (FR-v1.2E-15), and the catalogue has 27 FF-* IDs.
- ADR-007 "Scoring Dimensions (5)" → 7 dimensions (semantic and integrity added).
- ADR-008 "Spike 3 validated: 100% detection rate" → held-out SO4 misses MO-X01 0/6 (dynamic import) and N=75 is below the floor (TV-17, ADR-030).
- ADR-005 "Cannot detect data flow violations" → a limited FLOWS_TO edge exists (FR-21) but is near-empty on real projects (ADR-023).


Repo state: origin/v1.3 tip d65fddbb (2026-10-16). Notion was fetched read-only. Unless a row says otherwise, evidence is a repo path or PR number.

### Spike Strategy: Validating the Firewall with Claude Code (177fc8a8efa8464baa82efedc9bc0dcd)
This page holds the spike plan from March 2026 (3 spikes plus integration) and the spike report written afterwards. Last edited 2026-03-27.

| # | Idea / open item / decision / promise / conflict | Status | Evidence | Next action |
|---|---|---|---|---|
| 1 | Spike 1: ts-morph APG extractor (File/Class/Interface/Method/Function; IMPORTS/IMPLEMENTS/EXTENDS/CONSTRUCTOR_INJECTS/CALLS) | DONE | src/apg-extractor/ (node-extractor.ts, edge-extractor.ts); #2 U2; since extended by APG v2 #98, re-export edges #85 | — |
| 2 | Fidelity checks (barrels, path aliases, DI interface vs concrete, decorators) | DONE | #85 (re-export edges, ADR-V13-01), src/apg-extractor/import-resolver.ts, graph fidelity work #114, #131 | — |
| 3 | Spike 2: Neo4j ingestion + YAML layer/role annotation | DONE | src/neo4j-ingestion/ | — |
| 4 | Catalogue of 12 fitness functions compiled to Cypher | SUPERSEDED | 27 FF-* IDs plus hexagonal/DDD rules (Docs/v1.3/rule-tiers.md) | — |
| 5 | GO/PIVOT/STOP thresholds (>=10/12 Cypher compile) | DONE | Catalogue compiles; cypher-interp parity vs Neo4j #128 | — |
| 6 | Spike 3: seeded-violation ground truth (correct project + variants A–D with MANIFEST) | DONE | fixtures/correct-reference, variant-a..d; seeded SO4 held-out #40; devset-b #137 (open) | — |
| 7 | Integration: `evaluate.ts --project --spec` runner, AVR/AHS | DONE | src/cli/cli.ts `evaluate`; src/scoring-engine/ | — |
| 8 | Expected AHS/AVR bands per variant (e.g. reference AVR 0.00 / AHS 1.00) | SUPERSEDED | Spike report gave reference AHS 0.85; v1.3 tier scoring (#84, rule-tiers.md) replaces AHS-only verdicts | — |
| 9 | Session 4.3: Formal < Semi < Informal AVR as "early evidence for H3" | SUPERSEDED | Study 1 E1 grid, 72 cells, descriptive (#56, #57); SO5 is now descriptive only | — |
| 10 | Fallback: skip Neo4j, query JSON with graphology | SUPERSEDED | In-process Cypher interpreter `--engine cypher-interp` (#128); npx mode #135 (open) | — |
| 11 | Spike report: 17-rule catalogue across 5 dimensions | SUPERSEDED | 27 FF-* IDs, tiered blocking/advisory (rule-tiers.md, 2026-10-14) | — |
| 12 | Report claim: 100% detection of seeded structural violations | SUPERSEDED | Measured P/R/F1 on held-out seeded set replaces it (#40, #41, #102) | — |
| 13 | Report claim: Neo4j query time O(1)/O(log N), "scalability PASSED" | UNCLEAR | No repo measurement backs the complexity claim; latency gate exists (#36) | — |
| 14 | "Next: Phase 4.3 LLM benchmarking" (formal AoC spec vs LLM quality) | DONE | Study 1 E1 (#56, Papers 1–2 #61, #68) | — |
| 15 | CLAUDE.md spike directory layout (/spike-1-extractor etc.) | SUPERSEDED | Production src/ layout | — |

#### Wrong statements
- "evaluates it against 17 codified architectural fitness functions" → there are now 27 FF-* IDs plus the hexagonal and DDD library rules (Docs/v1.3/rule-tiers.md).
- "Repeat for all 12 fitness functions" → the catalogue is now much larger (see above).
- "The 0.85 score for the reference project ... demonstrating the firewall's industrial-grade rigor" → a clean reference that loses 15% is a false-positive problem, not rigor. v1.3 handles this with tiers, where only blocking rules fail a verdict (rule-tiers.md), and role exemptions (instrument v2, #42).
- "Monotonic Scoring: AHS scores worsened linearly" → the 5-point spike sample does not show linearity (A 0.54 is below B 0.58 even though A has fewer seeded issues). It is not evidence.
- "Neo4j handles the APG complexity with O(1) or O(log N) query time" → nothing in the repo measures this. Neo4j is no longer required either: the in-process interpreter is merged (#128).
- "Cypher queries never missed a seeded structural violation" → this is spike-only. The registered SO4 held-out numbers (#40, #41, #102) supersede it.

### System Requirements Specification — Neuro-Symbolic Architectural Firewall (5120aceda28947ffa2799ff861695f21)
This page is the March 2026 SRS. It maps the old SO1–SO4 to FR/NF requirements. Last edited 2026-03-28.

| # | Idea / open item / decision / promise / conflict | Status | Evidence | Next action |
|---|---|---|---|---|
| 1 | FR-SPEC-01 multi-format ADR parsing (MADR, Nygard, Y-Statement) | DONE | src/spec-parser/adr-parsers.ts | — |
| 2 | FR-SPEC-02 3-layer AoC YAML (A model / B fitness functions / C scoring) | DONE | src/spec-parser/layer-parsers.ts; presets/*.yaml | — |
| 3 | FR-SPEC-03 violation taxonomy from OX/Slater/Sobania/GIST with severity | DONE | src/shared/taxonomy/violation-types.ts; tiers replace severity for verdict (rule-tiers.md) | — |
| 4 | FR-SPEC-04 style template library: clean-arch only, "future: layered, hexagonal" | DONE | presets/: clean-architecture, layered, hexagonal, ddd, nestjs | — |
| 5 | FR-SPEC-05 `semantic_criteria` (rule, adr_ref, rubric) and LLM Critic context assembly | DONE | src/llm-critic/ (#7 U4); judge v2 rubric #126 | — |
| 6 | NF-SPEC-01 JSON Schema spec validation with line numbers | DONE | src/spec-parser/spec-validator.ts; `validate` command in src/cli/cli.ts; defect fix #105 | — |
| 7 | FR-APG-01..03 APG construction, layer annotation, Neo4j ingestion | DONE | src/apg-extractor/, src/neo4j-ingestion/ | — |
| 8 | NF-APG-01 persisted versioned snapshots, delta APG, 4-type drift detection | DONE (drift, snapshots) / OUT (delta-per-PR as thesis claim) | `drift` command (src/cli/drift-handler.ts); diff-aware CI gate #138 (open) | — |
| 9 | NF-APG-01 "drift detection on real commit history" as an SO4 validation dimension | OPEN | night-backlog M1 (erosion trajectories in human projects) | night-backlog M1 |
| 10 | NF-APG-02 APG < 5 s, delta < 2 s | SUPERSEDED | Latency gate (#36) and NFR-07 (#38); the interpreter takes about 20 ms per graph stage (night-backlog §4 #8) | — |
| 11 | FR-GATE-01 symbolic path: 17 Cypher functions across 5 dimensions | SUPERSEDED | 27 FF-* IDs plus hex/DDD rules (rule-tiers.md) | — |
| 12 | FR-GATE-02 LLM Critic with semantic/intent/soft-SRP functions | DONE (partly SUPERSEDED) | Judge v1 frozen (judge-catch-frozen.md), v2 #126, v2.2 #141 open; `intent` dimension branch removed (#4) | open PR #141 (author's one local run) |
| 13 | FR-GATE-03/04 static routing, hybrid symbolic→neuronal cascade | DONE | src/neuro-symbolic-router/router.ts | — |
| 14 | FR-GATE-05 hard/soft block/warning/pass merge, where neuronal can hard-block | SUPERSEDED | v1.3: only blocking-tier symbolic rules fail a verdict; FF-N01/N02 are reported, not blocking (rule-tiers.md) | — |
| 15 | FR-GATE-06 AVR/AHS, deterministic vs combined score | DONE | src/scoring-engine/; two AHS versions reported (rule-tiers.md; kill list #14) | — |
| 16 | FR-GATE-07 JSON violation report | DONE | src/report/ | — |
| 17 | NF-GATE-01 3–5 runs, ICC > 0.70, downweight unstable | SUPERSEDED | 3 cassette runs per item; selective-prediction / unanimity analysis replaces ICC (#165 open, night-backlog N1) | open PR #165 |
| 18 | NF-GATE-02 confidence thresholds 0.85/0.60 calibrated in SO4 | SUPERSEDED | Judge does not block; abstain-on-disagreement framing (night-backlog §0 SO3, N1) | — |
| 19 | NF-GATE-03 end-to-end < 30 s | UNCLEAR | Latency measured (#36, #122 MCP latency); no 30 s gate found | — |
| 20 | FR-VAL-01 seeded ground truth (3–4 refs, 10–12 projects, MANIFEST, emergent violations) | DONE | v1.3 reference projects #82, #83; seeded held-out #40; devset-b #137 (open) | — |
| 21 | FR-VAL-01/05 2–3 human expert evaluators, inter-rater κ ≥ 0.60 | SUPERSEDED | Validity rests on non-human evidence by author decision (night-backlog kill list #15); minimal human component in role-separation plan (#130) | — |
| 22 | FR-VAL-02 targets P ≥ 0.90, R ≥ 0.85, κ ≥ 0.60, ICC ≥ 0.70 | SUPERSEDED | Notion Stage 5 dropped numeric targets; descriptive P/R/F1 (#40, #41, #102) | — |
| 23 | FR-VAL-03 ablation: symbolic-only vs neuronal-only vs combined | OPEN | SO2 ablation done (#38, #23); symbolic–neural complementarity matrix is night-backlog N2 | night-backlog N2 |
| 24 | FR-VAL-04 135 projects, Claude/GPT-4o/Gemini, two-way ANOVA, Tukey | SUPERSEDED | E1 grid 72 cells with a Codex arm (#50, #56), descriptive SO5 | — |
| 25 | FR-VAL-04 H4: 20-project APG vs CodeQL comparison | SUPERSEDED | Tool comparison vs dependency-cruiser (#51); convergent validity vs dependency-cruiser, eslint-plugin-boundaries, ArchUnitTS (#166 open) | — |
| 26 | "Does the LLM Critic compensate for low-quality specs?" interaction question | OUT | Not in Study 1/Study 2 design; doctoral/future work | — |
| 27 | NF-VAL-01 reproducibility (pinned versions, published prompts, public suite, scripts) | DONE | Replication package #117; Docs/judge-preregistration.md; sealed-hashes.md | — |
| 28 | Traceability: "ADR multi-format parsing not started", "neuronal path not started" | SUPERSEDED | adr-parsers.ts; judge v1/v2 (#7, #126) | — |

#### Wrong statements
- "`style: clean-architecture` → 17 symbolic + N semantic fitness functions; Future: `style: layered`, `style: hexagonal`" → five style libraries now ship in presets/ (clean-architecture, layered, hexagonal, ddd, nestjs), and the rule count is 27 FF-* IDs plus hex/DDD rules.
- "17 validated symbolic fitness functions across 5 dimensions ... < 5 seconds for all 17" → outdated. See rule-tiers.md.
- "Hard block: ... OR neuronal violation with confidence ≥ threshold → PR cannot merge" → in v1.3 the judge (FF-N01/N02) is reported and never blocks. Only blocking-tier rules fail a verdict (rule-tiers.md l.13).
- "Precision ≥ 0.90, Recall ≥ 0.85, κ ≥ 0.60, ICC ≥ 0.70" as targets → these targets were dropped. P/R/F1 are now reported descriptively over violation instances (Notion Stage 5; #40/#41/#102).
- "Minimum 2–3 independent human evaluators" → validity no longer depends on human raters, by author decision (night-backlog §4 #15).
- "5 tasks × 3 LLMs × 3 conditions × 3 repetitions = 135 projects ... Two-way ANOVA" → Study 1 E1 ran 72 cells and reports descriptively (#56, #57). Inferential tests were removed from the objectives.
- "H4: 20-project subset comparison APG vs. CodeQL" → no CodeQL comparison was run. The comparison is against dependency-cruiser (#51) plus convergent validity (#166, open).
- "Neuronal path not started" → judge v1 is frozen, v2 is merged (#126) and v2.2 is prepared (#141).

### Project Diagnosis — DaedalusArch (2026-04-11) (33f50d308227819cb97ae3fc8ca56ff1)
This page diagnoses the code state at v1.0 and sets out the v1.1 gap analysis (GAP-01..16) and the roadmap. Last edited 2026-04-15.

| # | Idea / open item / decision / promise / conflict | Status | Evidence | Next action |
|---|---|---|---|---|
| 1 | v1.0 code-complete: 84 files, 312 tests, 76% coverage, 12 modules | SUPERSEDED | Now 285 src .ts files and 371 *.test.ts files (find, 2026-10-16), 19 src modules | — |
| 2 | Coverage 76% vs 80% threshold gap | UNCLEAR | No current coverage figure checked; flaky env suites quarantined (night-backlog §4 #11) | — |
| 3 | GAP-01 `firewall init` guided setup | OPEN | #150 (open): firewall init, evaluate --from-inferred, MCP propose_spec; ISE #96/#105 merged | open PR #150 |
| 4 | GAP-02 `exclude_paths` wired into Cypher | DONE | src/fitness-compiler/cypher-templates.ts (`/*EXCLUDE:...*/`, BR-U1-32/44); `default_exclude_paths` (ADR file) | — |
| 5 | GAP-03 rule enable/disable | DONE | `enabled` handling in src/fitness-compiler/fitness-compiler.ts, hexagonal-compiler.ts, ddd-compiler.ts | — |
| 6 | GAP-04 template function categories required/recommended/optional | SUPERSEDED | A priori blocking/advisory tiers (rule-tiers.md, #84) | — |
| 7 | GAP-05 Cypher template integration tests (2/3/4-layer) | DONE | Live Cypher verification #103; interpreter parity vs Neo4j #128, #151 (open) | — |
| 8 | GAP-06 `buildParams()` hardcoded layer names | DONE | buildParams with layerModel/binding (src/fitness-compiler/fitness-compiler.ts:406); hexagonal/DDD libraries work (#83) | — |
| 9 | GAP-07 no-layer-skip with 4+ layers | UNCLEAR | Not checked in this pass | — |
| 10 | GAP-08 inline suppression `// firewall-ignore` | OUT | No implementation found (grep); not needed for SO1–SO5 | — |
| 11 | GAP-09 actionable messages with fix hints | DONE / OPEN | src/report/actionable-formatter.ts; deterministic fix hints `--hints` #143 (open) | open PR #143 |
| 12 | GAP-10 framework presets (NestJS, Next, Express, React) | DONE (partly) | presets/nestjs.yaml plus 4 style presets; Next/Express/React presets not present | — |
| 13 | GAP-11 in-memory graph, Neo4j optional | DONE / OPEN | cypher-interp merged #128; npx default mode #135 (open); Neo4j still reference engine | open PR #135 |
| 14 | GAP-12 real LLM providers (Claude, OpenAI) | DONE | src/llm-critic/claude-cli-provider.ts (#7); agy/Gemini labeller route (#21) | — |
| 15 | GAP-13 React/JSX/TSX extraction (RENDERS edges, hooks) | OUT | No RENDERS edge in src; backend-only scope | — |
| 16 | GAP-14 incremental adoption flags `--dimensions/--rules/--min-severity` | UNCLEAR | `--rules` exists only on `validate` (template set); others not found | — |
| 17 | GAP-15 ADR-to-spec via LLM | SUPERSEDED | ISE infers spec from graph (#96, #105); MCP infer_spec (#122) | — |
| 18 | GAP-16 `firewall validate --spec` | DONE | `validate` command, src/cli/cli.ts:405 | — |
| 19 | Self-eval: 7 iterations to useful output (DX crisis) | SUPERSEDED | Dogfood on own src/ #155 (open) | — |
| 20 | Verdict thresholds pass ≥0.80 / warning ≥0.65 / soft ≥0.50 / hard <0.50 | SUPERSEDED | v1.3 tier verdict: only blocking rules fail (rule-tiers.md) | — |
| 21 | specs/clean-arch.yaml 26 functions (20 sym / 2 neu / 4 hybrid); 15 of 26 not integration-tested | SUPERSEDED | 27 FF-* IDs; live verification #103 | — |
| 22 | GitHub Action for PR evaluation | OPEN | Diff-aware `check --base --head` + Action #138 (open) | open PR #138 |
| 23 | v2.0: multi-language extractors, style marketplace, monorepo, web dashboard | OUT | Kill list #9 (web dashboard); doctoral/future work | — |
| 24 | v2.0: MCP tool / Claude skill for spec authoring | DONE / OPEN | MCP v2 #122 merged; neural MCP tools #157 (open); propose_spec #150 (open) | open PR #157 |
| 25 | Open question: in-memory = Cypher parser or JS rewrite? | DONE | Cypher interpreter chosen (#128); TS rewrite on kill list #8 | — |
| 26 | Open question: npm package name `daedalus-arch` vs `@daedalus/firewall` | OPEN | npx packaging in #135 (open) | open PR #135 |
| 27 | Open question: `firewall init` LLM-powered vs heuristic | OPEN | #150 (open) | open PR #150 |
| 28 | Open question: drift detection without Neo4j | UNCLEAR | Interpreter may cover it; not verified | — |
| 29 | Risk: false-positive flood on real projects | DONE (mitigated) | External set: 283/283 blocking findings correct on human code #167 (open); role exemptions #42; tiers | open PR #167 |
| 30 | Risk: Cypher templates silently wrong | DONE (mitigated) | Live verification #103, interpreter parity #128 | — |

#### Wrong statements
- "Neuronal evaluation framework ... no live LLM providers" / "Only `MockLLMProvider` exists" → a live Claude CLI judge exists (src/llm-critic/claude-cli-provider.ts, #7). Judge v1 is frozen and v2 is merged (#126).
- "Only clean-architecture template exists" / "Template Registry (currently 1 entry)" → presets/ has five libraries: clean-architecture, layered, hexagonal, ddd, nestjs.
- "Neo4j mandatory = Docker mandatory" → `--engine cypher-interp` runs without a Neo4j server (#128). Neo4j stays the reference engine.
- "`exclude_paths` is cosmetic" / "Template-injected rules can't be disabled" → both are implemented in src/fitness-compiler/.
- "all 24 functions forced on every project" / "24 parameterized Cypher templates" → there are 27 FF-* IDs, rules can be disabled, and tiers apply.
- "Verdict thresholds ... pass ≥ 0.80, warning ≥ 0.65 ..." → the v1.3 verdict is tier-based: only blocking rules fail it (rule-tiers.md).
- "84 files ... 312 tests ... 76% coverage" → the codebase is now about 285 src .ts files and 371 test files.

### Research Goals Audit Trail (263db4c6a46743fdb35839ad9eb46c96)
This page tracks how scope evolved across Stages 1–5: SOTA, then problem definition, then the methodological analysis, then the APG pivot and spike, then objective polishing in June 2026. Last edited 2026-06-02.

| # | Idea / open item / decision / promise / conflict | Status | Evidence | Next action |
|---|---|---|---|---|
| 1 | Stage 1 UAGF, AVR < 5%, professional teams, CE-VSM, maturity model | OUT | Deferred to future work by the page itself | — |
| 2 | Brownfield validation deferred | SUPERSEDED (partly) | External set of 15 human-written pre-2023 backends (#133, open); brownfield precedent probe night-backlog F2 | night-backlog F2 |
| 3 | Human-on-the-loop protocols (RQ3/OE3) | OUT | Consistently deferred | — |
| 4 | Scope to Python + TypeScript | SUPERSEDED | TypeScript only (src/apg-extractor uses ts-morph) | — |
| 5 | Full CPG, later APG with selective CPG approximations | DONE | APG v2: type flow, components, I/O (#98, #104); FLOWS_TO (#23) | — |
| 6 | AVR < 10% target for firewall | SUPERSEDED | Stage 5 removed numeric targets; descriptive reporting | — |
| 7 | Drop ADR pipeline, adopt AoC YAML; ADR-to-spec = future work | DONE | AoC YAML presets; ADR parsers kept (src/spec-parser/adr-parsers.ts) | — |
| 8 | Style-derived template libraries (2–3 styles) as SO1 expressiveness | DONE | presets/ (5 libraries) | — |
| 9 | 10 evaluation dimensions (testability, cohesion, complexity, evolvability, security) | DONE (partly) / UNCLEAR | Cheap proxies batches #99, #110; APG v2 metrics #98; full mapping not verified | — |
| 10 | APG schema extensions (CALLS_STATIC, INSTANTIATES, RETURNS_TYPE, DATA_FLOWS_FROM, EXPOSES_TYPE) | DONE (equivalent) | APG v2 generic edges (#98), HOLDS_STATE_OF (#121), FLOWS_TO | — |
| 11 | Neo4j GDS topology (Louvain, betweenness, PageRank, LCAS) | OUT (kill list #9) | night-backlog §4 #9 | — |
| 12 | ISE (implicit spec extraction), Mode A/B, RQ5 | DONE (exploratory) | ISE prototype #96, on E1 #100, robustness #105, wild #114 | — |
| 13 | ISE scope ambiguity: core vs stretch | DONE | Kept exploratory (#96/#100 banners); init via #150 open | — |
| 14 | archguard reverse pipeline product | OUT | Product/future; partial via #150 (open) | — |
| 15 | H4 APG vs CodeQL (≥85% at ≤15% cost) | SUPERSEDED | dependency-cruiser comparison #51; convergent validity #166 (open) | open PR #166 |
| 16 | H5 structural compliance ≠ testability | UNCLEAR | No dedicated result found | — |
| 17 | Stage 5: 5 SOs, descriptive build-and-measure DSR | DONE | Docs/analysis-plan.md; SO1–SO5 in ADR file | — |
| 18 | SO4 per-violation-instance P/R/F1 and FP/FN analysis | DONE | #40, #41, #102; blind misses / false alarms #134 (open) | open PR #134 |
| 19 | Written matching/oracle rule | DONE | Docs/matching-rule.md | — |
| 20 | Freeze and release benchmark + matching script | DONE | Replication package #117; sealed-hashes.md | — |
| 21 | Open decision: neural-path exposure in SO4, (a) whole-instrument vs (b) symbolic-only P/R/F1 | DONE | Option (b): SO4 is symbolic-only, neural results go in a separate column (ADR file, A5 item 5) | — |
| 22 | SO5 generation matrix (3 models × 3 spec levels × k runs) | DONE | E1 grid 72 cells (#56), Codex arm (#50) | — |
| 23 | SO5 reproducible failure-pattern taxonomy (open coding) | UNCLEAR | Open-coding input #33; final taxonomy artifact not located | NEW: confirm the SO5 taxonomy artifact path, or create it from #33 output |
| 24 | SO5 redefined by v1.3 as firewall effect on agent code (Study 2) | OPEN | Docs/v1.3/study2-outline.md; gate #146 (1/42 green); pilot #170 (open) | open PR #146 / #170 |
| 25 | "Reproducible at analysis level, not generation" | DONE | #117 replication package; prereg docs | — |
| 26 | Developer study out of scope | DONE | Kill list #15 (no human-rater recruitment) | — |
| 27 | Deferred: reconcile proposal body (Methodology, Activities, Tables 2/4, Gantt, Risks, Ethics) with new SOs | UNCLEAR | Proposal document is not in the repo | NEW: run a one-pass proposal-body reconciliation against the final SOs (author) |
| 28 | Thread an LLM-judge reliability check (κ vs human) into SO4 | SUPERSEDED | Judge vs panel P4 (#64, #65); multi-vendor panel #153 (open) | open PR #153 |
| 29 | Threshold calibration of coupling rules (theory-derived) | SUPERSEDED | Coupling rules advisory tier (rule-tiers.md); advisory noise #139 (open) | — |
| 30 | AVR discrepancy note (5% vs 10%) to acknowledge in thesis | SUPERSEDED | Targets removed in Stage 5 | — |

#### Wrong statements
- "17-rule Cypher catalog ... 17/17 rules ... 100% detection" (used as current validation status) → the catalogue now has 27 FF-* IDs plus hex/DDD rules. Detection is reported as measured P/R/F1 on the held-out seeded set (#40/#41/#102), not as a spike 100%.
- "Neuronal Evaluation ... Framework only — no live LLM providers yet" → a live Claude CLI judge exists. Judge v1 is frozen, v2 is merged (#126) and v2.2 is pending (#141).
- "only 1 template (clean-architecture). `buildParams()` hardcodes layer names" → there are 5 preset libraries, and buildParams is layer-model based.
- "Neo4j mandatory" / "Graph topology GDS deferred to post-v1.1" → the interpreter removes the need for a Neo4j server (#128), and GDS is on the kill list (§4 #9).
- "Precision ≥ 90% (confirmed feasible via spike)" → there was no such confirmation, and Stage 5 itself removed the target.
- "Everything after spike is refinement and scaling, not discovery" → v1.3 found major construct issues: construct decisions #88/#91/#129, the floor finding #161 and the tier redesign. This framing misleads.
- Stage 5 SO5 = "descriptive failure-pattern characterization across LLM × spec" → in v1.3, SO5 is the effect of the firewall on agent-generated code (Study 2, study2-outline.md). LLM × spec characterization is Study 1.
- "Scope to Python + TypeScript" (Stage 2 decision still listed in the log) → the scope is TypeScript only.


Repo checked at origin/v1.3 tip d65fddbb (read only). All four pages predate v1.3 (last edits 2026-09-20/21).

### V4: Thesis Proposal — Neuro-Symbolic Architectural Firewall Submission (35450d30822780da8b16cdb8ce061120)
The approved proposal (doc chain #7): the objectives SO1–SO5, methods, timeline, budget, references [1]–[51], IP, ethics and risks. Last edited 2026-09-21.

| # | Idea / open item / decision / promise / conflict | Status | Evidence | Next action |
|---|---|---|---|---|
| 1 | SO1: AaC YAML format, 3 layers, 2–3 (activity list: 3–4) style template libraries plus a validator | DONE | presets/ has 5 libraries (clean-architecture, layered, hexagonal, ddd, nestjs); src/spec-parser/template-registry.ts:163-174; #27 (SO1 metrics), #83 (DDD) | Thesis: say "5 libraries", not 2–3 |
| 2 | SO2: APG pipeline, coverage, latency < 5 s per project, type-resolution rate | DONE | #23 (SO2 metrics), #36 (latency gate), #38 (SO2 results); APG v2 #98 | — |
| 3 | SO2: APG-full vs AST-only ablation | DONE | #23; results/apg-ablation | — |
| 4 | SO3: fitness-function-to-Cypher compiler, "30+ Cypher rules" | DONE | 27 FF-* IDs plus the hexagonal and DDD library rules (Docs/v1.3/rule-tiers.md); src/fitness-compiler/ | Give the exact total from rule-tiers.md in the thesis |
| 5 | SO3: LLM judge for the Semantic and Integrity dimensions | DONE | judge v1 frozen (Docs/v1.3/judge-catch-frozen.md); v2 #126; src/shared/types/enums.ts:54 `MODEL_JUDGED_DIMENSIONS = ['semantic','integrity']` | — |
| 6 | SO3: judge v2.2 claim level (one local run on CHECK-2) | OPEN | open PR #141; night-backlog §3 (author-only) | Author runs judge-v22-check2-local.sh once |
| 7 | Nine dimensions: 7 symbolic (structural, pattern, convention, testability, evolvability, cohesion, security) + 2 judged | SUPERSEDED | Built: 5 symbolic (structural, coupling, pattern, solid, convention) + semantic, integrity (src/shared/types/enums.ts:42-54) | Rewrite the dimension list in Ch3/Ch6 |
| 8 | Neo4j GDS topology (Louvain, betweenness, SCC, PageRank), Layer–Community Alignment | OUT (kill list #9) | night-backlog §4 #9; only a cheap Louvain proxy in src/apg-enrich/cheap/louvain.ts | Drop from the thesis scope or move to future work |
| 9 | AHS, per-dimension scores, PASS/BLOCK, JSON violation report | DONE | src/scoring-engine, src/report; v1.3 adds a tiered verdict (#84, rule-tiers.md) | Thesis: report the tiered verdict next to AHS |
| 10 | T1/T2 tag on every fitness function and on every violation | SUPERSEDED | blocking/advisory tiers sealed a priori (Docs/v1.3/rule-tiers.md, #84); `tier` field in presets/ddd.yaml | Explain the T1/T2 → blocking/advisory change in Ch4 |
| 11 | SO4: golden dataset, 5–10 projects, ≈150–300 seeded instances | DONE (changed) | k = 2, 85 held-out instances (ADR-019, build-and-test-summary §9); #40, #41; results/so4-heldout | State N = 85 against the 80–120 floor |
| 12 | SO4: matching protocol fixed before the run | DONE | Docs/matching-rule.md; prereg (Docs/judge-preregistration.md, prereg-drafts/) | — |
| 13 | SO4: independent ground-truth labelling by 2 human evaluators; "evaluators recruited" (week 10) | SUPERSEDED | non-human labelling: #48 (live agy labelling), #64 (judge vs panel); human-rater recruitment is kill list #15 | Amend the proposal text and the budget row "Ground-truth evaluators (×2)" |
| 14 | SO4: per-dimension threshold calibration and per-dimension contribution ablation | UNCLEAR | results/sensitivity holds per-function sensitivity (function-sensitivity.json); no per-dimension ablation found | Check the analysis plan or ask the author |
| 15 | SO4: qualitative FP/FN analysis | OPEN | open PR #134 (blind misses); open PR #167 (X1, 283/283 correct on human code) | Merge #134 and #167 after review |
| 16 | SO4 sub-study: judge reliability against human labels (Cohen's κ) | DONE (changed) | agreement against a model panel and agy labels: #64, #48, #26 (weighted agreement CIs); open PR #153 (multi-vendor panel) | Reword: reliability is measured against a model panel, not humans |
| 17 | SO5 as proposed: LLM × spec-quality factorial, 3 runs per cell, failure-pattern taxonomy | DONE | Study 1 E1 grid, 72 cells: #56, #57; Codex arm #50; Paper 1 #68 | Report as Study 1 SO5 result |
| 18 | SO5 now also means the effect of the firewall on agent code (Study 2, run exactly once) — the proposal does not cover it | OPEN | Docs/v1.3/study2-outline.md; readiness gate #146 (1/42 green); pilot #170 open | NEW: add a short proposal amendment or director note that defines Study 2 under SO5 |
| 19 | Scope: greenfield only, generated TypeScript only | SUPERSEDED | human-written external set (open PR #133); real-world "wild" wave #114 | Update the scope paragraph (still TypeScript only) |
| 20 | Tool stack ts-morph + Neo4j + Cypher | DONE | Neo4j is still the reference engine; in-process interpreter #128; npx mode open PR #135 | — |
| 21 | CodeQL / Joern as comparison baseline | SUPERSEDED | dependency-cruiser comparison #51 (ADR-030); convergent validity vs dependency-cruiser, eslint-plugin-boundaries and ArchUnitTS (open PR #166) | Replace CodeQL/Joern in the text |
| 22 | Translating ADRs into specs is out of scope (future work) | OUT | still future work; but an ADR parsing path exists in src/spec-parser/adr-parsers.ts (intent-only) | See Ch4 row 3 |
| 23 | Reverse spec extraction as future work | DONE (exploratory) | ISE #96, #100, #105; zero-config init open PR #150 | Mention as an exploratory result, not future work |
| 24 | 20-week timeline (Jan–May 2026), milestones W6–W20 | SUPERSEDED | v1.2E and v1.3 cycles run to Oct 2026 (aidlc-docs/aidlc-state.md) | — |
| 25 | Contingency: SO5 deferred if the time runs out | SUPERSEDED | SO5 E1 ran (#56) | — |
| 26 | Budget: API on "Claude 3.5 Sonnet", ChatGPT Pro, evaluator hours | UNCLEAR | the generators actually used were the Claude Code CLI, gpt-5.6-terra Codex (#50) and a Gemini route (#63) | The author decides whether the budget needs an update |
| 27 | Ethics: no human participants, REC approval = NO | UNCLEAR | Study 2 uses agents only (study2-outline.md), but Docs/v1.3/human-labelling-protocol.md and the role-separation plan (#130) name a minimal human component | Author: confirm that the REC answer still holds |
| 28 | Study with real developer teams left for future work | OUT | the proposal itself defers it | — |
| 29 | IP: artefacts released open-source | DONE | replication package #117; internal comms moved out of the public repo #132 | — |
| 30 | Originality report to be generated at completion | OPEN | no Turnitin artefact in the repo | NEW: author generates it at submission (author-only) |
| 31 | Research group / research line "[TBD]" | UNCLEAR | not in the repo | Author fills in |
| 32 | Feasibility spike (5 fixtures, 7 self-run iterations) | DONE | historical; Docs/DiagnosticRuns/ | — |

#### Wrong statements
- "30+ Cypher rules across 7 symbolic dimensions + 2 LLM-judged dimensions" and the testability, evolvability, cohesion and security dimensions → there are 5 symbolic dimensions plus semantic and integrity (src/shared/types/enums.ts:42-54).
- "Integrate Neo4j GDS topology algorithms (Louvain, betweenness, SCC, PageRank)" → not built; it is kill list #9 (night-backlog §4).
- "Layer B: fitness functions with T1/T2 tags" and "the violation report includes tier" → the tiers are blocking/advisory (Docs/v1.3/rule-tiers.md, #84).
- "independent ground-truth labeling", "Ground-truth evaluators (×2)", "evaluators recruited" → validity now rests on non-human evidence; human-rater recruitment is kill list #15.
- "Evaluation is limited to greenfield TypeScript projects" → human-written pre-2023 backends are now in use (#133 open, #114 merged).
- "CodeQL relegated to comparison baseline" / "Joern … reference comparison baseline" → the comparison baseline is dependency-cruiser (#51), with convergent validity in #166.
- "≈150–300 seeded violation instances" → 85 held-out instances at k = 2 (ADR-019).
- SO5 is defined only as the LLM × spec characterisation → that ran as Study 1 E1 (#56); in v1.3, SO5 also covers the Study 2 firewall effect (study2-outline.md).

### 🗂️ Document Structure — Master's Final Project (v1) (d9cb35d1efdd420eb2c37b20bd7215c1)
The official chapter outline (front matter, Ch1–9, appendices, IEEE references). Last edited 2026-09-21.

| # | Idea / open item / decision / promise / conflict | Status | Evidence | Next action |
|---|---|---|---|---|
| 1 | Ch4 SO1 incl. 4.3 "T1/T2 tagging of fitness functions" | SUPERSEDED | rule-tiers.md (blocking/advisory), #84 | Rename 4.3 to "Rule tiers (blocking/advisory)" |
| 2 | 4.4 template libraries per style | DONE | presets/ ×5 | — |
| 3 | Ch5 APG: five-layer schema, ts-morph, call graph, Neo4j ingestion, coverage, latency | DONE | #23, #36, #38 | — |
| 4 | Ch5 lacks APG v2 edges, re-export edges and the in-process Cypher interpreter | OPEN | #98, #85, #128; npx mode open PR #135 | NEW: add 5.x "APG v2 and engine independence" |
| 5 | 6.4 Neo4j GDS topology algorithms | OUT (kill list #9) | night-backlog §4 #9 | Remove section 6.4 |
| 6 | 6.3 scoring engine and AHS | DONE | src/scoring-engine; tiered verdict #84 | NEW: add the v1.3 tiered verdict to 6.3 |
| 7 | Ch6 has no section on the LLM judge (the neural half of SO3) | OPEN | judge v1 frozen, v2 #126, v2.2 open PR #141 | NEW: add 6.x "LLM judge" |
| 8 | Ch7 SO4: golden dataset, matching, P/R/F1 per dimension | DONE | #40, #41, #102 (v1.3 rerun); Docs/matching-rule.md | — |
| 9 | Ch7 lacks the v1.3 validity evidence (external set, X1, convergent validity, known-groups) | OPEN | open PRs #133, #167, #166; night-backlog K1, K2 | NEW: add 7.x "Validity on human-written code" |
| 10 | 7.4 threshold calibration and per-dimension ablation | UNCLEAR | results/sensitivity (per-function only) | Ask the author whether 7.4 stays |
| 11 | 7.5 latency and structural coverage | DONE | #36 latency gate, #23 | — |
| 12 | No Study 2 chapter (agent-in-the-loop, run once) | OPEN | study2-outline.md; gate #146; pilot #170 | NEW: add a chapter "Study 2: firewall in the loop (SO5)" |
| 13 | 9.3 future work: "factorial characterization LLM × spec quality (SO5)" | SUPERSEDED | E1 grid ran (#56, #57, #68) | Move it to Ch7 results |
| 14 | 9.3 future work: "LLM judge" | SUPERSEDED | judge built and frozen (judge-catch-frozen.md, #126) | Remove from future work |
| 15 | 9.3 future work: brownfield, multi-language, reverse spec extraction | OUT | multi-language is still future work; human-code set #133 and ISE #96 partly cover the other two | Reword |
| 16 | 3.1 "DSR and descriptive evaluation" | UNCLEAR | Study 2 power notes (Docs/v1.3/study2-power-notes.md) and preregistrations suggest inferential analysis | Author to confirm the framing |
| 17 | 8.3 threats to validity | DONE | Docs/threats-to-validity.md; register open PR #130 | — |
| 18 | Appendices: schema, Cypher catalogue, golden dataset, raw outputs | DONE | replication package #117; Docs/v1.3/sealed-hashes.md | — |
| 19 | Originality report (Turnitin) | OPEN | none in the repo | NEW: author-only at submission |

#### Wrong statements
- "9.3 Future work: factorial characterization LLM × spec quality (SO5), LLM judge" → both are done: E1 (#56) and judge v1/v2 (#126, judge-catch-frozen.md).
- "6.4 Neo4j GDS topology algorithms" → not built; kill list #9.
- "4.3 T1 / T2 tagging" → blocking/advisory tiers (rule-tiers.md).
- "6.2 Evaluation dimensions" combined with the proposal's "nine" → the code has 7 (enums.ts).

### 📐 Plan de cierre — Medición y escritura del Trabajo Final (1757627317fe446bacdad891297ba80f)
The closing plan in Spanish: Phase 1 measurement, Phase 2 writing order, reproducibility package and risks. It ends with a pasted older ToC. Last edited 2026-09-20.

| # | Idea / open item / decision / promise / conflict | Status | Evidence | Next action |
|---|---|---|---|---|
| 1 | Decision: the LLM judge is in only if a second human labeller is available | SUPERSEDED | judge in (v1 frozen, v2 #126); non-human validity is the author's decision (kill list #15) | — |
| 2 | "Hoy hay 17 implementadas" (17 rules) | SUPERSEDED | 27 FF-* plus hexagonal and DDD rules (rule-tiers.md) | — |
| 3 | Step 1: freeze the system with a release tag | DONE (v1.2E) / OPEN (v1.3) | v1.2E catalogue P-1, judge P-4, prereg v7, results/pre-tag; v1.3 freeze runbook open PR #164 | Review #164 |
| 4 | Step 1: document the environment (Node, ts-morph, Neo4j, hardware) | DONE | Docs/environment.md | — |
| 5 | Step 2: circularity, via blind labelling or a taxonomy derived first | DONE (partly) | literature taxonomy Docs/operator-catalogue.md; sealed hold-out Docs/v1.3/sealed-hashes.md; same-vendor threat remains | night-backlog H1 (non-Claude manifest writer) |
| 6 | Step 2: grow beyond 5 projects; per-instance manifests (file, line, type, severity, rule) | DONE | U5a manifests #6; #40; N = 85 (ADR-019) | — |
| 7 | Step 3: matching protocol before the results | DONE | Docs/matching-rule.md | — |
| 8 | Step 4: full run, P/R/F1 per type and dimension, latency, type resolution, raw JSON | DONE | #40, #41, #36, #38; results/ | — |
| 9 | Step 5: AHS weight sensitivity / calibration | OUT (kill list #14) | judge-weighted variant #49; per-function sensitivity results/sensitivity | Report the two existing AHS versions only |
| 10 | Step 6: FP/FN catalogue with root cause | OPEN | open PR #134; open PR #167 (X1) | Merge after review |
| 11 | The reference project scored 0.85 instead of 1.00 | SUPERSEDED | spike-era figure; v1.3 reference projects #82, #86 | — |
| 12 | Phase 2: writing order, centre outwards (Ch5 → Ch6 → Ch7 → Ch2 → Ch3/4 → Ch8 → Ch1) | OPEN | no thesis chapters in the repo | NEW: author starts drafting Ch5/Ch6 from frozen results |
| 13 | Reframing: SO5 leaves the body as future work | SUPERSEDED | E1 ran (#56); Study 2 is SO5 in v1.3 | — |
| 14 | Reproducibility package: public repo with tag, clean-machine instructions, dataset, raw outputs | DONE (tag OPEN) | replication package #117; reproduction audit #54; tag pending #164 | — |
| 15 | Reproducibility package: Turnitin | OPEN | none | NEW: author-only |
| 16 | Risk: keep developing instead of measuring | OPEN | v1.3 scope is controlled by the kill list | night-backlog §4 |
| 17 | Risk: spike numbers cannot be reproduced | DONE | reproduction audit #54; #117 | — |
| 18 | Risk: promising 30+ rules and backing only 17 | SUPERSEDED | 27+ rules | — |
| 19 | Pasted old ToC: 7.3 factorial benchmark, 7.4 "Controlled Developer Study (Treatment vs Control)", App. D developer-study protocol | OUT | developer study deferred in the proposal; factorial done (#56) | Delete the pasted ToC |
| 20 | Pasted old ToC: "6.2 The Ten Evaluation Dimensions" | SUPERSEDED | 7 dimensions (enums.ts) | — |
| 21 | State of the art: "51 referencias" | UNCLEAR | proposal bibliography [1]–[51] | — |

#### Wrong statements
- "Hoy hay 17 implementadas" → 27 FF-* IDs plus the library rules (rule-tiers.md).
- "Sin él [segundo etiquetador], las dimensiones Semantic e Integrity pasan a trabajo futuro" → the judge is built and frozen with no human second labeller (judge-catch-frozen.md; kill list #15).
- "SO5 sale del cuerpo y entra como trabajo futuro" → SO5 E1 ran (#56); Study 2 is the v1.3 SO5.
- "7.4 Phase 3: Controlled Developer Study (Treatment vs. Control)" → there is no developer study; Study 2 is agent-in-the-loop.
- "The Ten Evaluation Dimensions" → there are 7.

### Chapter 4 — AaC Specification Format (SO1) (2e907664d1b24287a9ec27b80803eb67)
A working draft of Ch4, organised by artefact. Every count comes from commit 7cd15b4 (2026-09-20), which is before v1.2E U1 and before v1.3. Now used as a source. Last edited 2026-09-21.

| # | Idea / open item / decision / promise / conflict | Status | Evidence | Next action |
|---|---|---|---|---|
| 1 | R1–R6 requirements derived from governance mechanisms | DONE | draft text | Keep |
| 2 | CONFLICT: 2–3 vs 3–4 styles; "two were delivered, the second a framework layout" | SUPERSEDED | 5 presets incl. hexagonal, layered, ddd (template-registry.ts:163-174; #83) | Rewrite 4.4 |
| 3 | CONFLICT: ADR multi-format parsing is still in code although ADRs are out of scope | OPEN | src/spec-parser/adr-parsers.ts still exists | NEW: say in D-7 that the ADR path is intent-only and outside the evaluation, or remove it |
| 4 | Schema extension 2026-04-15 (file_patterns, enabled/reason, exclude_paths) | DONE | spec-schema.ts; exclude-paths.ts | — |
| 5 | Layer list order as the implicit allowed-dependency graph | DONE (extended) | layers now also carry `kind:` (presets/hexagonal.yaml:21) | Describe `kind` in 4.2.1 |
| 6 | Binding by literal layer names domain/application/infrastructure | DONE (fixed) | src/spec-parser/layer-kind-resolver.ts; LAYER_KINDS enums.ts:56 (FR-19, PR #3) | Rewrite 4.4 last para |
| 7 | Six function-specific fields dropped by the parser → 7 templates unbound; "executable catalogue = 17" | DONE (fixed) | src/spec-parser/function-fields.ts; bound-param-checker.ts, BR-SPEC-10 always fatal (commit 45049477, PR #3) | Rewrite 4.5.2 as a defect found and fixed |
| 8 | FF-CV01 per-layer naming patterns bound to `.*`, so it cannot fail | OPEN | still `.*` at src/fitness-compiler/fitness-compiler.ts:453-455; FF-CV01 is advisory (rule-tiers.md) | NEW: bind the patterns or declare FF-CV01 vacuous in the thesis |
| 9 | FF-N01 declared hybrid `srp-semantic` with no template | SUPERSEDED | FF-N01 is now `architectural-integrity`, neuronal, integrity (presets/clean-architecture.yaml:250); old names retired (src/llm-critic/rubric.ts:43) | — |
| 10 | Dimensions `semantic` and `intent` | SUPERSEDED | semantic and integrity (enums.ts:54; dimension-alias.ts) | — |
| 11 | Catalogue: 26 functions, 24 templates | SUPERSEDED | 27 FF-* plus library rules (rule-tiers.md) | Regenerate Table 4.5 |
| 12 | T1/T2 tag not implemented; Table 4.6 classification as a substitute | SUPERSEDED | blocking/advisory tiers sealed before measurement (rule-tiers.md, #84; `tier` in ddd.yaml) | Rewrite 4.3 around the sealed tiers |
| 13 | Registry: both entries identical, differing only by name | SUPERSEDED | 5 distinct registry entries; hexagonal-template.ts, ddd-template.ts | — |
| 14 | Library fidelity to the named style never validated | DONE | Docs/v1.3/style-rule-sources.md, rule-source-verification.md, errata (#116); open PR #136 | — |
| 15 | Strict mode never enabled; stage-2 errors only warnings | OPEN | spec-parser.ts:116 still opt-in; BR-SPEC-10 is fatal regardless | NEW: enable strict in CLI or state stage 2 is advisory |
| 16 | Missing cross-reference checks (template layers declared, mapping overlap, scoring dims) | DONE (partly) / UNCLEAR | bound-parameter check BR-SPEC-10 exists; the other two not found | Check spec-validator.ts |
| 17 | An empty dimension still adds its full weight to AHS | UNCLEAR | not re-checked; v1.3 headline is the tiered verdict | Verify in src/scoring-engine |
| 18 | Weight vector is a judgement; ADR-007 sensitivity analysis not done | OUT (kill list #14) | judge-weighted variant #49; no further re-weighting | State it as a judgement |
| 19 | R5 not demonstrated (7 iterations to self-spec) | OPEN | dogfood open PR #155; zero-config init open PR #150; spec-author reliability night-backlog K2 | Keep the finding; add K2 result |
| 20 | VERIFY unbound-parameter behaviour on live Neo4j | SUPERSEDED | made moot by the BR-SPEC-10 fix | Drop the marker |
| 21 | Open item: decide tier field vs Table 4.6 | DONE | rule-tiers.md (committed 2026-10-14) | Tick |
| 22 | Open item: find the reason the tier was dropped (U3 conversation) | OUT | moot after the tiers were introduced | — |
| 23 | Open item: confirm the six external-validation engine defects | UNCLEAR | no source cross-checked | Check Docs/DiagnosticRuns/ |
| 24 | Open item: do the LLM-judged dimensions stay in scope? | DONE | yes: judge v1 frozen, v2 #126 | Tick |
| 25 | Figures/tables to produce (three-layer diagram, style→constraints table, annotated spec) | OPEN | presentation kit #115/#123 has related figures | NEW: produce the Ch4 figures from kit #115 |
| 26 | D-6 spec-independent metrics reported outside the score | DONE | src/baseline | — |
| 27 | D-8 CONFLICT: semantic criteria in spec (future vs first-class vs in-scope) | DONE | semantic_criteria in presets, judge v1/v2 in scope | Resolve the conflict note |

#### Wrong statements
- "seven of the twenty-four templates require parameters that no shipped specification binds … the executable symbolic catalogue at this commit is seventeen" → fixed in v1.2E U1: the fields are parsed (function-fields.ts) and unbound parameters are always fatal (BR-SPEC-10, commit 45049477). The "17 executable" claim no longer holds.
- "Two libraries were implemented … they point at the same list … differ in nothing but their name" → there are 5 distinct libraries (template-registry.ts:163-174).
- "The tag was not implemented … the violation record … carries no tier" → v1.3 findings carry blocking/advisory tiers (evaluation.ts:380; rule-tiers.md).
- "FF-N01 is declared hybrid but has no query template" → FF-N01 is now neuronal `architectural-integrity` (clean-architecture.yaml:250).
- "The compiler binds layer parameters by looking for layers literally named domain, application and infrastructure" → layers resolve by `kind` (layer-kind-resolver.ts).
- "Twenty-six functions … twenty-four query templates" → 27 FF-* IDs plus the library rules.
- "two, `semantic` and `intent`" → semantic and integrity.


Checked against branch v1.3-ideas-triage at d65fddbb (read only). Repo-relative paths. "FR-v1.2E-nn" = `aidlc-docs/inception/requirements/v1.2-evaluation-readiness-requirements.md`. "backlog" = `Docs/v1.3/night-backlog-2026-10-16.md`.

General finding: all four pages were written against commit `7cd15b4` (2026-09-20) and the 2026-10-05 audit. The v1.2E cycle (PRs #1–#60, 2026-10-06..10) built nearly everything the audit asked for (WP0–WP6), and v1.3 (#82–#170) added three style libraries, rule tiers, an in-process Cypher engine and Study 2. Read as they stand, the pages describe a system that no longer exists.

### Chapter 4 — Draft (AaC Specification Format) (3e250d30822781aea2a3d4609a35d8cc)
Narrative draft of thesis Chapter 4 (SO1, AaC format) in the DSR frame. It describes commit `7cd15b4`. Content as of 2026-09-21; last edited around 2026-09-21. This is the version called "v2" in the brief.

| # | Idea / open item / decision / promise / conflict | Status | Evidence | Next action |
|---|---|---|---|---|
| 1 | Chapter describes commit `7cd15b4`; "changes after it are out of scope" | SUPERSEDED | Frozen instrument `corpus/frozen-instrument.json` (scripts/export-frozen-instrument.ts); v1.3 `Docs/v1.3/sealed-hashes.md` | Re-anchor chapter to the Study 1 frozen instrument / v1.3 freeze |
| 2 | R-4.13: 7 of 24 templates run unbound (parser drops 6 function-specific fields) | DONE | FR-v1.2E-07/08 (BR-SPEC-10, always fatal), PR #3; `src/fitness-compiler/bound-param-checker.ts` | Keep as history ("not met at 7cd15b4, fixed in U1") |
| 3 | R-4.9: only 2 libraries (clean, nestjs); hexagonal/onion blocked by literal layer names | DONE | `presets/` has 5 (clean, layered, hexagonal, ddd, nestjs); FR-v1.2E-19/20 `src/fitness-compiler/layer-binding.ts`; #83 (DDD), hexagonal in v1.3 | Rewrite 4.4 and Table 4.6 |
| 4 | R-4.12: no tier tag per declaration/violation | DONE | FR-v1.2E-29 (structural/topological/pattern-proxy); `Docs/v1.3/rule-tiers.md` blocking/advisory, #84 | Rewrite R-4.12 verdict |
| 5 | Total-order bound (no `allowed_dependencies`, Table 4.8) | DONE (partly) | `presets/hexagonal.yaml` `architecture.allowed_dependencies`; `src/shared/types/spec.ts:98` | Restrict the limit to non-hexagonal styles |
| 6 | `modules:` block plus `module-boundary`/`module-acyclic` templates | OUT | Not implemented (no `module-boundary` in src); kill list #7 (no new rules after seeing results) | Future work, 9.3 |
| 7 | `cypher_rule` on declarations, checked by EXPLAIN; template packs from files | OUT | Only `src/spec-parser/adr-parsers.ts` reads `cypher_rule`; kill list #7 | Future work |
| 8 | FF-N01 hybrid names a template that does not exist (COMPILER_002) | SUPERSEDED | FR-v1.2E-22: FF-N01 is now `integrity`, route `neuronal` (`presets/clean-architecture.yaml:250`) | Drop the R-4.10 caveat |
| 9 | FF-CV01 cannot fail, yet `validated: true` | DONE | `presets/clean-architecture.yaml:204-205`: `enabled: false`, reason ADR-016 b | Cite the disablement |
| 10 | Empty dimension earns full credit | DONE | FR-v1.2E-15; `src/scoring-engine/renormaliser.ts`, `droppedDimensions` | Rewrite 4.2.3 |
| 11 | Order-sensitive templates (`no-cyclic-deps` LIMIT without ORDER BY) | DONE | FR-v1.2E-35; `src/evaluation-engine/cycle-canonicaliser.ts` | Update 4.3.3 |
| 12 | Weights are a judgement; sensitivity analysis not run | DONE | `results/sensitivity/` (#36); two AHS versions reported (kill list #14) | Cite the sensitivity run |
| 13 | Stage-2 validation advisory (strictMode defaults off) | OPEN | `src/spec-parser/types.ts:20` still `strictMode: false`; BR-SPEC-10 is fatal regardless | NEW: decide whether strict is the default, or state the advisory stage in Ch 4 |
| 14 | Three designed stage-2 checks never implemented (needed layers declared, no double match, scoring dims) | UNCLEAR | Not verified in `src/spec-parser/` | Check validator rules before writing |
| 15 | Unknown keys silently accepted on fitness-function entries | UNCLEAR | Not verified in `schemas/` | Check schema `additionalProperties` |
| 16 | [VERIFY] runtime effect of unbound params (EVAL_001 dropped) | DONE | FR-v1.2E-13 `functionExecution` in the report | Remove marker |
| 17 | [VERIFY] FF-P02 depends on extractor resolving injected interfaces | UNCLEAR | Type edges changed (#108, FF-P05 via type edges) | Check template text |
| 18 | Spike fixture scores (0.85/0.66/0.58/0.54/0.33) used to set thresholds | SUPERSEDED | FR-v1.2E-18 `results/pre-tag/` (development numbers, renormalised) | Label as spike history only |
| 19 | NestJS library on 3 external projects: "no false positive on inspection" | SUPERSEDED | E7 corpus `results/e7-corpus/` (#45); v1.3 external set #133 (open) and X1 #167 (open) | Replace with Study 1/v1.3 evidence |
| 20 | Authorability: one record (7 runs), no usability study, author only | OPEN | backlog K2 (second blind spec author on external set) | Run K2; cite as reliability |
| 21 | Dimensions `semantic` + `intent` | SUPERSEDED | FR-v1.2E-22: Semantic + Integrity; `intent` maps to semantic with SPEC_004 | Update 4.2.2 and Table 4.5 |
| 22 | Catalogue "26 declared / 24 templates / 17 bound" | SUPERSEDED | 27 FF IDs + hex/DDD rules (`Docs/v1.3/rule-tiers.md`) | Redo Table 4.5 |
| 23 | D-7: ADRs excluded, yet four ADR parsers exist | OPEN | `src/spec-parser/adr-parsers.ts` | NEW: one thesis sentence; no code work |
| 24 | ADR-004/012 drift reconciliation (`mappings`, `allowed_dependencies`) | OPEN | Hexagonal reinstated allowed_dependencies (row 5) | NEW: update the drift paragraph |
| 25 | [REF]/[XREF]/Figures 4.1, 4.2, Appendix A/B/D placeholders | OPEN | Page text | NEW: thesis typesetting pass |
| 26 | Chapter as a whole predates v1.2E/v1.3 (no tiers, no Study 2, no blocking verdict) | OPEN | `Docs/v1.3/adr-v13.md`, rule-tiers.md, study2-outline.md | NEW: redraft Ch 4 on the v1.3 frozen instrument |

#### Wrong statements
- "Two were delivered … A library whose layers are `core`, `ports` and `adapters` would leave five templates without their infrastructure parameter" → five presets ship (`presets/`); binding by `kind`/position (FR-v1.2E-19, `layer-binding.ts`).
- "Seven of the 24 templates require parameters that no shipped specification binds … The executable symbolic catalogue at this commit is therefore seventeen functions" → fixed by FR-v1.2E-07/08 (PR #3); the catalogue is now 27 FF IDs plus hexagonal and DDD rules.
- "a dimension with no evaluated function … earns its full weight" → renormalised, with dropped dimensions listed (FR-v1.2E-15).
- "FF-N01, the hybrid function, names a template that does not exist" → FF-N01 is a neuronal Integrity rubric (FR-v1.2E-22), reported and non-blocking in v1.3 (rule-tiers.md).
- "the tier tag the proposal promised does not exist" → FR-v1.2E-29 tags plus v1.3 blocking/advisory tiers.
- "a list can only express a chain … Hexagonal ports and adapters: cannot be stated" → `allowed_dependencies` graph in `presets/hexagonal.yaml`.
- "two model-judged (semantic, intent)" → semantic + integrity.
- "no false positive" on the three NestJS projects as the external evidence → superseded by the E7 corpus and the v1.3 external set (283 blocking findings, #133/#167).

### DSR frame — how the Final Project tells its story chapter by chapter (3e250d30822781d2ad4efa3dd06d6767)
Methodology page that fixes the DSR structure (nested cycles, SO-S1..S8, requirement template, Ch 4–7 templates) and records author decisions of 2026-09-21 and 2026-10-05. Last edited 2026-10-06.

| # | Idea / open item / decision / promise / conflict | Status | Evidence | Next action |
|---|---|---|---|---|
| 1 | Nested DSR cycles, DSRM/FEDS/Hevner mapping for Ch 3 | OPEN | Thesis text only | NEW: write Ch 3 to this frame, adding Studies 1 and 2 |
| 2 | Three outer iterations (spike, unit build, v1.1) | SUPERSEDED | Further iterations: v1.2E (PRs #1–#60), v1.3 (#82–#170) | Extend the iteration table to 5 iterations |
| 3 | "Quantitative-descriptive, no inferential testing; no human participants" | SUPERSEDED | Study 1 is pre-registered (`corpus/prereg.json`, `Docs/analysis-plan.md`, stratified permutations #33); Study 2 is the agent-in-the-loop study (`Docs/v1.3/study2-outline.md`, power simulation #119) | Rewrite 3.1 method statement |
| 4 | Supersede the March requirements spec (still open) | OPEN | Page section 8 "Still open" #2 | NEW: author decision; one paragraph in 3.1 |
| 5 | Dimension taxonomy reconciliation in 6.2 | OPEN | Dimensions now 5 symbolic + semantic/integrity (FR-v1.2E-22) | NEW: write 6.2 on the current taxonomy |
| 6 | Not delivered: LLM-judge reliability sub-study | DONE | judge robustness #71, P4 judge-vs-panel #64, judge catch #92/#101, judge v2 #126 | Report in Ch 7 |
| 7 | Not delivered: GDS topology metrics | OUT (kill list #9) | backlog §4 #9 | Future work |
| 8 | Not delivered: data-flow edges and APG-full vs AST-only ablation | DONE | FR-v1.2E-21 FLOWS_TO; #23 AST-only ablation; `results/apg-ablation/`; APG v2 #98 | Report, with FLOWS_TO near-empty caveat |
| 9 | Not delivered: hexagonal/layered libraries | DONE | `presets/hexagonal.yaml`, `presets/layered.yaml` | — |
| 10 | Not delivered: CodeQL comparison baseline | SUPERSEDED | dependency-cruiser comparison #51 (ADR-030); convergent validity #166 (open) | Name the replacement in 9.2 |
| 11 | Not delivered: SO5 corpus | DONE | E1 grid, 72 cells #56; generate-projects.ts (FR-v1.2E-28) | — |
| 12 | Not delivered: independent ground-truth labellers | SUPERSEDED | LLM labeller panel FR-v1.2E-27 (#48); `Docs/v1.3/human-labelling-protocol.md` (second rater, nothing labelled yet) | See row 18 |
| 13 | Scope: "catalogue of 24 checks"; "one graph store" | SUPERSEDED | 27 FF IDs + library rules; in-process Cypher interpreter #128 beside Neo4j | Update 1.4 scope |
| 14 | Frozen-tag rule as method | DONE | `corpus/frozen-instrument.json`, `Docs/environment.md`, `Docs/v1.3/sealed-hashes.md` (no git tag in repo) | Fill 3.1 paragraph with real refs |
| 15 | Corpus warning: add never-seen projects (decision 2026-09-21 #1) | DONE | E7 corpus 9 bases #45, E7-x #43; v1.3 hold-out `Docs/v1.3/holdout-prespec.md` | — |
| 16 | SO-S8: neural path as separate reliability sub-study (decision #2) | OPEN | Study 1 done (#64, #71); v1.3 judge v2.2 + CHECK-2 waits for the author's one run | open PR #141 (backlog §3 author action) |
| 17 | Unbound-parameter fix before tag; re-run all scores (decision #3) | DONE | FR-v1.2E-07, FR-v1.2E-18 `results/pre-tag/` | — |
| 18 | Decision 2026-10-05: author-only labelling, kappa model-vs-author | SUPERSEDED | LLM panel FR-v1.2E-27; v1.3 human union protocol | Human rating: OUT (kill list #15) beyond the minimal role-separation component |
| 19 | Decision: Package nodes + `specifier`/`line` on IMPORTS | DONE | FR-v1.2E-09/10; `src/apg-extractor/package-node-factory.ts` | — |
| 20 | Decision: drop empty dimensions and renormalise | DONE | FR-v1.2E-15 | — |
| 21 | Decision: optional `line`/`target` on violations | DONE | FR-v1.2E-12; `src/evaluation-engine/violation-id.ts` | — |
| 22 | Decision: golden dataset 8–10 projects, 80–120 hand-seeded instances | SUPERSEDED | Mutation operators + seeded copies (FR-v1.2E-24, `scripts/mutate.ts`, SO4 held-out #40) | — |
| 23 | Decision: judge = Anthropic SDK with `ant auth login` OAuth, pinned `claude-opus-5-5` | SUPERSEDED (route) / DONE (pin) | Claude Code headless CLI `src/llm-critic/claude-cli-provider.ts` (FR-v1.2E-23, #7); `src/llm-critic/frozen.ts:26` JUDGE_MODEL = 'claude-opus-5-5' | Correct the decision text |
| 24 | Still open: SO5, deliver or defer | DONE | E1 grid #56; Study 2 (`study2-outline.md`) now carries SO5 | — |
| 25 | Still open: language of the final text | UNCLEAR | No repo evidence | Author decision |
| 26 | SO-S7: under 5 s per project on the symbolic path | DONE | `results/latency-gate/` (#36) | Report |
| 27 | Ch 4 change checklist (section 7, six items) | OPEN | All unticked; several overtaken (see Ch 4 table) | NEW: fold into the Ch 4 redraft |
| 28 | References 15, 18, 22 to confirm; reconcile with the proposal's 51 refs | OPEN | Page text | NEW: bibliography pass |

#### Wrong statements
- "Judge: Anthropic SDK provider authenticated through the author's Claude account OAuth profile (`ant auth login`), no API key" → the judge runs through the Claude Code headless CLI (`claude-cli-provider.ts`, FR-v1.2E-23, PR #7). The model pin `claude-opus-5-5` is correct (`frozen.ts:26`).
- "Labelling by the author only … kappa is model-versus-author" → an LLM labeller panel ran (#48, FR-v1.2E-27); the v1.3 human protocol adds a second rater.
- "Golden dataset: 8 to 10 projects, 80 to 120 instances" → replaced by mutation-seeded copies (SO4 held-out #40, E7 corpus #45).
- "Still open: SO5. Deliver a minimal generation matrix, or invoke the … contingency" → the E1 grid (72 cells) was delivered (#56).
- "there is no inferential hypothesis testing" / "No phase involves human participants" as the thesis's method → Study 1 is pre-registered and includes permutation analyses (#33). Study 2 is an agent-in-the-loop study with a power simulation (#119). The method chapter has to describe both.
- "Promised, neither delivered nor cut: … data-flow edges and the APG-full versus AST-only ablation; hexagonal/layered libraries … SO5 corpus" → all delivered (FR-21, #23, presets, #56).
- "a catalogue of 24 checks" → 27 FF IDs plus hexagonal and DDD rules.

### Chapters 5, 6, 7 — section-by-section outline (DSR frame) (3e250d308227819fa020cd30bba672e4)
Working outline for Ch 5 (APG), Ch 6 (gate) and Ch 7 (evaluation), with proposed requirement rows and a list of Ch 7 completion work. Last edited 2026-09-21.

| # | Idea / open item / decision / promise / conflict | Status | Evidence | Next action |
|---|---|---|---|---|
| 1 | Ch 5 claim: 5 node types / 7 edge types are enough | SUPERSEDED | Package nodes (FR-v1.2E-09), RE_EXPORTS (FR-34, #85), FLOWS_TO (FR-21), APG v2 edges #98 | Redo the schema table |
| 2 | R-5.3 resolution rate reported per run | DONE | FR-v1.2E-14 `importResolution` in the report | — |
| 3 | R-5.5 under 5 s per project | DONE | `results/latency-gate/` (#36) | — |
| 4 | R-5.7 data-flow edges not met | DONE (caveat) | FR-v1.2E-21 FLOWS_TO (near-empty on corpus); APG v2 type flow #98 | Report caveat |
| 5 | R-5.8 APG vs AST-only ablation never run | DONE | #23; `results/apg-ablation/`; `scripts/apg2-ablation.ts` | — |
| 6 | 5.6 ADR-003: "no in-memory mode" | SUPERSEDED | Cypher interpreter #128; npx mode #135 (open) | Add the decision to 5.6 |
| 7 | 5.4 owned defects (generated-code exclusion, glob matcher) | OPEN | Thesis text only | NEW: write 5.4 as history |
| 8 | R-6.4 executed-function count in report [CHECK] | DONE | FR-v1.2E-13 `functionExecution` | — |
| 9 | R-6.7 neural route via Gemini provider | SUPERSEDED | Claude CLI judge (#7), cassettes `tests/fixtures/judge-cassettes*` | Rewrite 6.5 |
| 10 | R-6.8 hybrid has no pair (FF-N01 no template) | SUPERSEDED | FF-N01 is neuronal (FR-v1.2E-22) | Drop row or restate |
| 11 | R-6.9 "30+ rules across 7 dimensions" not met (24/5) | UNCLEAR | 27 FF IDs plus hex/DDD library rules; the total against 30 was not counted | Count registry plus library rules |
| 12 | R-6.10 / 6.4 GDS topology | OUT (kill list #9) | backlog §4 #9 | Keep as "not delivered" |
| 13 | 6.2 dimension reconciliation (coupling/SOLID vs proposal's 7) | OPEN | Integrity/semantic since FR-v1.2E-22 | NEW: write 6.2 on the current taxonomy |
| 14 | 6.3 sensitivity analysis "not run" | DONE | `results/sensitivity/` (#36); `scripts/rescore.ts` | — |
| 15 | 6.6 re-produce spike/external scores after the R-4.13 fix | DONE | `results/pre-tag/` (FR-v1.2E-18) | — |
| 16 | 7.0/7.1 never-seen projects, selection rule | DONE | `Docs/corpus-criteria.md`, E7 #45, E7-x #43 | — |
| 17 | 7.1 `fixtures/*/MANIFEST.md` [CHECK exists] | DONE | Prose MANIFEST.md in 5 fixtures; JSON manifests via `scripts/mutate.ts` | — |
| 18 | 7.2 matching rule dated before run | DONE | `Docs/matching-rule.md` v1.0.0 (2026-10-08), registered in `corpus/prereg.json` | — |
| 19 | 7.2 second labeller | SUPERSEDED | LLM panel #48; v1.3 human protocol (nothing labelled) | Human rating beyond the minimal component: OUT (kill list #15) |
| 20 | 7.3 per-instance P/R/F1 per check and dimension | DONE | `scripts/score-golden.ts`; `results/so4-heldout/` (#40, #41) | — |
| 21 | 7.4 ablation/threshold tooling [CHECK] | DONE | `scripts/rescore.ts` (FR-v1.2E-26) | — |
| 22 | Completion work 1–8 (fix, re-run, choose, protocol, seed, neural setup, tag, run) | DONE | v1.2E cycle; frozen instrument; `results/e1-grid`, `e7-corpus`, `so4-heldout` | — |
| 23 | Completion work 9: write Ch 7, then Ch 8 from FP/FN | OPEN | Blind misses #134 (open) feed 8.1 | open PR #134; NEW: write Ch 7–8 for Study 1 + v1.3 |
| 24 | Ch 7 shaped as "SO4 + neural sub-study" on one tag | SUPERSEDED | Study 1 (v1.2E) + Study 2 (`Docs/v1.3/study2-outline.md`, gate #146) | Restructure Ch 7 into two studies |
| 25 | Study 2 not in the outline at all | OPEN | gate #146 1/42 green; pilot #170 open | backlog S1/S2/D1/D2 and open PR #146 |

#### Wrong statements
- "a purpose-built graph with five node types and seven edge types is enough for the catalogue" → Package, RE_EXPORTS, FLOWS_TO and APG v2 edges were added (FR-09/21/34, #98).
- "R-5.7 … not met (base schema only)"; "R-5.8 … not met (never run)" → FLOWS_TO exists and the ablation ran (#23, `results/apg-ablation/`).
- "note there is no in-memory mode" (ADR-003) → in-process Cypher interpreter merged (#128).
- "the Gemini provider wired 2026-04-16 … one provider" → the judge is the Claude CLI provider pinned to claude-opus-5-5 (#7, `frozen.ts`). Judge v1 frozen; v2 opt-in (#126).
- "R-6.8 … FF-N01 has no template, so no hybrid pair exists" → FF-N01 is a neuronal Integrity rubric.
- "Chapter 7 needs completion work first" (items 1–8) → done in the v1.2E cycle (matching-rule.md, score-golden.ts, rescore.ts, E7 corpus, E1 grid).

### Evaluation readiness audit and data-generation plan (Chapters 7–9) (3f150d308227812c9073e29fb963892f)
Read-only audit of `7cd15b4` (2026-10-05): a gap table, 8 defects, 7 work packages (WP0–WP7) and 6 author decisions. Last edited 2026-10-06. The v1.2E cycle (FR-v1.2E-01..36) turned it into requirements and executed it.

| # | Idea / open item / decision / promise / conflict | Status | Evidence | Next action |
|---|---|---|---|---|
| 1 | Verdict: "Chapters 7–9 cannot be written from what exists" | SUPERSEDED | v1.2E results (`results/e1-grid`, `so4-heldout`, `e7-corpus`), reproduction audit #54 | Mark page historical |
| 2 | Prose manifests with wrong rows / no machine ground truth | DONE | FR-v1.2E-24 manifest JSON Schema, `scripts/mutate.ts` (#6) | — |
| 3 | Violation record without line / unstable id | DONE | FR-v1.2E-12; `src/evaluation-engine/violation-id.ts` | — |
| 4 | No matching / no P-R-F1 | DONE | `Docs/matching-rule.md`; `scripts/score-golden.ts` (#8) | — |
| 5 | JSON report gaps (EVAL_001 dropped, warnings empty, no counts/timings/graph size) | DONE | FR-v1.2E-13/14; `src/scoring-engine/report-schema.ts` | — |
| 6 | `batch` provider/key mismatch, thin output | DONE | FR-v1.2E-16; `src/cli/batch-runner.ts` | — |
| 7 | No ablation/calibration tooling | DONE | `scripts/rescore.ts` (FR-v1.2E-26); `results/sensitivity/` | — |
| 8 | Judge receives a placeholder, never code | DONE | FR-v1.2E-23; `src/llm-critic/source-context.ts` | — |
| 9 | Zero cassettes; vcrMode unwired | DONE | `tests/fixtures/judge-cassettes*`; `cassette-provider.ts` (#7, #13) | — |
| 10 | Model alias `gemini-2.0-flash` | SUPERSEDED | `frozen.ts:26` claude-opus-5-5 | — |
| 11 | ICC hard-coded 0; compute ICC(2,1) | UNCLEAR | Not verified | Check `aggregation.ts` |
| 12 | Human labels and kappa missing | SUPERSEDED | LLM panel + agreement CIs (#26, #48); human union protocol defined, nothing labelled | Human sheet runs after hold-out (holdout-prespec §7) |
| 13 | External projects: HTML only; DevNest 0.398 vs 0.54 discrepancy | UNCLEAR | Dev-exposed clones superseded by E7 corpus; the discrepancy was never explicitly settled | One line in Ch 7: dev-exposed numbers retired |
| 14 | Reproducible environment (lockfile, engines, versions) | DONE | `package-lock.json` tracked, `engines.node >=22`, `Docs/environment.md` (FR-01..03) | — |
| 15 | Defect: extractor skips non-relative imports | DONE | FR-v1.2E-09/11 (Package, domain-purity on Package) | — |
| 16 | Defect: empty dimension full credit | DONE | FR-v1.2E-15 | — |
| 17 | Defect: fixture scores are spike numbers | DONE | FR-v1.2E-18 `results/pre-tag/` | — |
| 18 | WP0 freeze the ground | DONE | FR-v1.2E-01..06 (#1); `Docs/corpus.md` | — |
| 19 | WP1 engine fixes | DONE | FR-v1.2E-07..18, #3, #2, #5 | — |
| 20 | WP2 hand-seeded golden dataset, 80–120 instances | SUPERSEDED | Mutation-seeded copies; SO4 held-out #40; devset-b #137 (open) | — |
| 21 | WP3 matching rule "line within ±2" | SUPERSEDED | `Docs/matching-rule.md` `lineTolerance: 0`, differential scoring of seeded copies | — |
| 22 | WP4 ablation/threshold sweep | DONE | `scripts/rescore.ts`; `results/sensitivity/` | — |
| 23 | WP5 wire `--adr <dir>` or declare ADR rules out | UNCLEAR | Not verified | Check `src/cli/cli.ts` |
| 24 | WP6 cut `v1.2-eval` git tag; second machine reproduces | SUPERSEDED (tag) / DONE (repro) | No git tags; frozen instrument + prereg instead; reproduction audit #54, replication package #117 | — |
| 25 | WP7 FP/FN root-cause catalogue (8.1) | OPEN | Labelled FP (#48); blind misses #134 (open) | open PR #134 |
| 26 | WP7 threats (8.3), contributions/limits (9.x) | OPEN | `Docs/threats-to-validity.md`; threats register #130 (open) | open PR #130; NEW: write Ch 8–9 |
| 27 | Decision 5: author-only labelling, no second labeller | SUPERSEDED | FR-v1.2E-27 LLM panel; v1.3 human protocol | — |
| 28 | Decision 6: Anthropic SDK `new Anthropic()` + `ant auth login`, `anthropic-provider.ts` | SUPERSEDED | Claude CLI provider (FR-v1.2E-23, #7); no anthropic-provider.ts | — |
| 29 | Estimate 19–25 working days | SUPERSEDED | Executed 2026-10-06..10 (v1.2E PRs #1–#60) | — |
| 30 | Neo4j without GDS | OUT (kill list #9) | backlog §4 #9 | — |
| 31 | Ch 4/5/6 consequence lists (section 7) | OPEN | Overtaken by v1.2E/v1.3 | NEW: fold into chapter redrafts |

#### Wrong statements
- "there is no per-instance matching, no precision or recall computation, no machine-readable ground truth, no stored timings, no replayable neural run" → all exist: `Docs/matching-rule.md`, `scripts/score-golden.ts`, mutation manifests, report `timings`, judge cassettes.
- "`llm-critic.ts:43` passes the literal string … The judge has never seen code" → fixed (FR-v1.2E-23).
- "Model from `GEMINI_MODEL`, default `gemini-2.0-flash`" → claude-opus-5-5 via the Claude CLI (`frozen.ts`).
- Decision 6: implement `src/llm-critic/anthropic-provider.ts` with `new Anthropic()` and `ant auth login` → never built. The Claude CLI route was chosen (FR-v1.2E-23).
- "Cut `v1.2-eval` tag" → no git tag exists. The freeze is `corpus/frozen-instrument.json` plus the prereg.
- "No second labeller. Kappa … model versus author only" → LLM labeller panel (#48); v1.3 adds a second human rater in the protocol.
- "matching … `line` is within ±2" → the registered rule uses `lineTolerance: 0`.


Checked against origin/v1.3 at d65fddbb (2026-10-16), read only. All four pages date from 2026-10-05 to 2026-10-07, which is before the v1.2E build/run cycle (PRs #1-#73) and before v1.3. Most of their planned work has since been carried out, often in a changed form. Their status columns (🔴/⚪) and their counts are now badly out of date.

### 🧬 Golden dataset design — what we generate and what we evaluate (WP2) (3f150d308227811b98a2d2c857d8adcb)
This is the WP2 design for the Ch.7–9 data: tiers A–D, 15 mutation operators, manifest schema and expected findings. Last edited 2026-10-06.

| # | Idea / open item / decision / promise / conflict | Status | Evidence | Next action |
|---|---|---|---|---|
| 1 | Machine-readable manifests + JSON Schema validation | DONE | `schemas/manifest.schema.json`; U5a #6; `results/so4-heldout/case/manifest.json` | — |
| 2 | Dated matching rule frozen before seeding | DONE | `Docs/matching-rule.md` v1.0.0 2026-10-08 (now 1.2.0); `corpus/prereg.json` | — |
| 3 | Tier A new hand-built variants e/f/g/h (44 seeded + 12 negative controls) | SUPERSEDED | Replaced by mutation-seeded held-out (#40, #41), v1.3 reference projects (#82) and devset-b (#137, open) | — |
| 4 | Correct the a–d manifests and convert them to `manifest.json` | UNCLEAR | `fixtures/variant-*/` still has only `MANIFEST.md`; fixture runs are in `experiments/fixtures/plan.json`, `results/fixtures` | Check whether corrections landed |
| 5 | 15 mutation operators, each with a negative twin | SUPERSEDED | `Docs/operator-catalogue.md` FROZEN: 11 operators + 11 twins (#6); hex/DDD operators #162 (open) | — |
| 6 | Operators write code and manifest row in one step | DONE | `scripts/mutate.ts` (#6) | — |
| 7 | Tier B unseeded runs on DevNest/RealWorld/Ghostfolio | DONE | `Docs/corpus.md`, `corpus/` (#10), E7 (#45) | — |
| 8 | Tier B: 20 seeded mutations on RealWorld | SUPERSEDED | SO4 held-out seeding over corpus bases (#40; ADR-024/025) | — |
| 9 | Tier C: 1–2 never-seen public projects | SUPERSEDED | E1 generated projects (#56), E7/E7-x (#43, #45), v1.3 external set of 15 (#133, open), sealed hold-out (`Docs/v1.3/holdout-prespec.md`, `sealed-hashes.md`) | — |
| 10 | Tier D: author labels 40–60 neural units; κ model vs author | SUPERSEDED | Model panel (#48, #64), judge catch (`Docs/v1.3/judge-catch-frozen.md`), human protocol only defined (`Docs/v1.3/human-labelling-protocol.md`) | — |
| 11 | Expected finding 9: "executed-function count 24 of 24" | SUPERSEDED | 27 FF-* IDs (`Docs/v1.3/rule-tiers.md`) | — |
| 12 | Expected finding 7: latency < 5 s up to 267 files | DONE | `experiments/latency-gate`, #36 | — |
| 13 | Expected findings pre-registered | DONE | `Docs/analysis-plan.md`, `corpus/prereg.json` (#20) | — |
| 14 | FP/FN root-cause list and blind spots as `expectedMiss` | DONE | Root-cause list in matching-rule (FR-v1.2E-27); MO-X01 "outside coverage" rows | — |
| 15 | Threshold step (t−1/t/t+1) for metric functions | DONE | Twins at the threshold (MO-SO01n, MO-SO02n); SP probes; sensitivity run (#36) | — |
| 16 | Band sweep, leave-one-dimension-out, symbolic vs full | DONE | `scripts/rescore.ts`, `results/sensitivity`, #36 | — |
| 17 | FF-CV01 repaired or excluded with a reason | DONE | Operator catalogue: CV01/CV04 measured by SP probes only (ADR-016 b) | — |
| 18 | Domain purity fires on packages (WP1) | DONE | MO-P01 `package-import` operator; U2/U3 (#2, #5) | — |
| 19 | [CHECK] template semantics: type-only imports, ≥ vs >, P05 hop depth | UNCLEAR | FF-P05 now uses type edges (#108); other checks not verified | Verify against `cypher-templates` |
| 20 | Neural sub-study with `claude-opus-5-5` | DONE | Judge robustness Sonnet vs Opus (#71), `results/judge-robustness` | — |
| 21 | Section 6 limits (author-only labels, synthetic share, no generalisation) | DONE | `Docs/threats-to-validity.md` | — |

#### Wrong statements
- "Executed-function count is 24 of 24" / "Recall is relative to the 24-function catalogue": the catalogue has 27 FF-* IDs plus the hex/DDD rules (`Docs/v1.3/rule-tiers.md`).
- "the fifteen operators": the frozen catalogue has 11 operators with 11 twins (`Docs/operator-catalogue.md`).
- "Decisions in force: … author-only labelling": labels came from a model panel (Gemini via agy and API, Codex) plus a 30-item author audit (#48, #64, #95).
- "Tier A total … 63 seeded" / "Total 98–113": SO4 was scored on 75 strict and 73 corrected held-out instances, which is below the 80–120 floor (`Docs/threats-to-validity.md` TV-17).
- "Two existing-variant manifests … converted to manifest.json": the fixtures still hold only `MANIFEST.md`.

### 📜 Proposal compliance register and delivery plan (3f150d30822781408819cbe4a23e55fc)
This register lists each proposal commitment with a status, the planned WPs (S, D, DF, G, A, 5G) and seven decisions. Last edited 2026-10-07.

| # | Idea / open item / decision / promise / conflict | Status | Evidence | Next action |
|---|---|---|---|---|
| 1 | GO-1: instrument at a frozen tag + summative run | OPEN | Study 1 done (#56, #40); v1.3 freeze dry run #164 (open) | night-backlog T1; open PR #164 |
| 2 | GO-2 / WP5: judge on real code via the Anthropic provider | DONE | U4 Claude CLI judge (#7); judge v1 frozen; v2 (#126) | — |
| 3 | SO1-1: AaC schema + validator | DONE | U1 (#3); `schemas/` | — |
| 4 | SO1-2 / WP-S / decision 1: Clean + Layered (+ Hexagonal) libraries | DONE | `presets/`: 5 libraries; layered acceptance (#27); DDD (#83) | — |
| 5 | SO1-3 / SO1-4: spec line counts and SO1 metrics | DONE | `scripts/so1-metrics.ts` (#27) | — |
| 6 | SO1-5: comparison with the Ford & Richards ADL | UNCLEAR | No table found in `Docs/` | NEW: one comparison table in thesis Ch.4 |
| 7 | SO2-1: graph content (files, declarations, types, calls, packages) | DONE | U2 (#2) | — |
| 8 | SO2-2 / WP-DF / decision 4: one FLOWS_TO edge + check | DONE | #23, #38; MO-DF01 → `domain-state-purity`; HOLDS_STATE_OF (#121) | — |
| 9 | SO2-3: coverage and latency stored | DONE | `scripts/so2-metrics.ts` (#23); latency gate (#36) | — |
| 10 | SO2-4: five-layer schema mapping | UNCLEAR | Not verified | Writing task |
| 11 | SO2-5 / WP-A: APG-full vs AST-only ablation | DONE | #23, #24; `results/apg-ablation`; APG v2 ablation (#98) | — |
| 12 | SO2-6: CPG approximations | OUT | Deviation, as the page plans | — |
| 13 | SO3-1: rules → Cypher, AHS, report | DONE | U3 (#5) | — |
| 14 | SO3-2 / decision 3: Semantic and Integrity dimensions | DONE | `src/shared/types/enums.ts` `MODEL_JUDGED_DIMENSIONS = ['semantic','integrity']` | — |
| 15 | SO3-3 / WP-D / decision 2: 30+ rules over 7 symbolic dimensions | OUT (kill list #7) | 27 FF-* over 5 symbolic + 2 judged dimensions; no new blocking rules (night-backlog §4 #7); advisory gaps #144 (open) | State as a deviation |
| 16 | SO3-4 / WP-G / decision 7: GDS SCC and Louvain | OUT (kill list #9) | Only an in-process Louvain proxy exists (`src/apg-enrich/cheap/louvain.ts`); topological tag done (`TemplateTag`) | — |
| 17 | SO3-5: judge reliability, κ | DONE | P4 judge-vs-panel (#64); judge catch (#92, #101); v2.2 pending | open PR #141 |
| 18 | SO4-1: seeded golden dataset | DONE | `results/so4-heldout` (#40, #41) | — |
| 19 | SO4-2: 150–300 instances | DONE (reduced) | N = 75 strict / 73 corrected, below the floor; a declared deviation (TV-17) | — |
| 20 | SO4-3 / SO4-6: scorer and matching protocol | DONE | `scripts/score-golden.ts` (#8); `Docs/matching-rule.md` | — |
| 21 | SO4-4: qualitative FP/FN review | DONE | Labelling (#48); blind misses (#134, open) | open PR #134 |
| 22 | SO4-5: threshold calibration and ablation | DONE | Sensitivity (#36); `scripts/rescore.ts` | — |
| 23 | SO4-7 / decision 5: independent human labeller | SUPERSEDED | Model panel (#48, #64); v1.3 human protocol defined but not run; recruitment on the kill list | OUT (kill list #15) |
| 24 | SO5-1 / WP-5G / decision 6: multi-LLM × spec-level grid | DONE | E1, 72 cells (54 Claude + 18 Codex) (#50, #56) | — |
| 25 | SO5-2: contingency clause | SUPERSEDED | SO5 delivered, then redefined in v1.3 as the Study 2 firewall effect (`Docs/v1.3/study2-outline.md`) | — |
| 26 | Proposal model mix (GPT, Claude, open-source) | DONE (partial) | Codex `gpt-5.6-terra` arm (#50); no open-source or other new vendor | OUT (kill list #5) |
| 27 | X-1: descriptive DSR, no human participants | DONE | Ch.3 frame; v1.3 Study 2 uses agents only | — |
| 28 | X-2: reproducibility at analysis level | DONE | Reproduction audit (#54); replication package (#117) | — |
| 29 | X-3: CodeQL/Joern baseline | SUPERSEDED | dependency-cruiser comparison (#51); convergent validity vs depcruise/boundaries/ArchUnitTS (#166, open) | — |
| 30 | X-4: reproducibility package at submission | OPEN | `replication/` (#117); final at freeze | open PR #164; night-backlog T1 |
| 31 | WP0/WP1 engine fixes | DONE | v1.2E U0–U3 (#1–#5) | — |
| 32 | Delivery plan: order and 38–51 day estimate | SUPERSEDED | Results plan page, then v1.3 night plan (`aidlc-docs/construction/plans/v1.3-night-2026-10-16-plan.md`) | — |

#### Wrong statements
- "The only line of engine work is `main` at `7cd15b4` … nothing after it adds templates, dimensions, style libraries, data-flow edges or GDS": the v1.2E and v1.3 branches added layered/hexagonal/DDD/nestjs libraries, FLOWS_TO, the semantic/integrity dimensions and many rules (#2–#5, #23, #83, #84, #121).
- SO1-2 "🔴 Clean + a NestJS layout": five presets exist (`presets/`).
- SO2-2 "🔴 none built": FLOWS_TO and its check exist (#23, #38).
- SO3-2 "🔴 implemented dimensions are `semantic` … and `intent`": `intent` is now only a deprecated alias; the dimensions are `semantic` and `integrity` (`enums.ts`, `src/spec-parser/dimension-alias.ts`).
- SO3-3 "24 templates, 5 dimensions": 27 FF-* IDs across 7 dimensions (5 symbolic + 2 judged).
- SO4-3 "⚪ no scorer": `scripts/score-golden.ts` (#8).
- SO4-2 "Designed: 98–113 instances": the actual N was 75/73 (TV-17).
- "Reported as deviations: … Hexagonal library": `presets/hexagonal.yaml` exists.
- SO5 described as "failure-pattern characterisation": in v1.3, SO5 is the firewall's effect on agent code (Study 2, `Docs/v1.3/study2-outline.md`).

### 🧫 Experiment protocol — asset generation and validation of results and conclusions (3f150d30822781918262d3d42d1115c4)
This page defines the asset pipeline, the no-human-label revision, validation checks, the claim register and gates G1–G6. Last edited 2026-10-07.

| # | Idea / open item / decision / promise / conflict | Status | Evidence | Next action |
|---|---|---|---|---|
| 1 | `experiments/PROTOCOL.md` frozen before the first run | SUPERSEDED | Registered artefacts `Docs/analysis-plan.md`, `Docs/matching-rule.md`, `corpus/prereg.json` (v1 at #20; bumps v2–v25) | — |
| 2 | Pipeline tools: select/fetch corpus, record-env, run-experiment, mutate, score, rescore, aggregate, figures | DONE | `scripts/*-cli.ts` (#6, #8, #9, #10) | — |
| 3 | Assets under `experiments/` and `results/`; third-party code by SHA only | DONE | `experiments/`, `results/`, `corpus/corpus.json` | — |
| 4 | Claim register `experiments/CLAIMS.md` | OPEN | Not found anywhere in the repo | NEW: build the claim register from the E-tables before Ch.7–9 |
| 5 | Selection rule (layout, 20–300 files, licence, not a fork) | DONE | `Docs/corpus-criteria.md`; selection reproduced byte for byte (`Docs/corpus.md` §6) | — |
| 6 | LLM labeller panel: two labellers, one non-Claude, majority rule | DONE (modified) | agy/Gemini route (#21, #48), Gemini API (#63, #64), Codex meaningful labeller (#95) | — |
| 7 | Constructed-truth units for the judge | DONE | Judge probes MO-X02/X03; judge catch (#92, #101); anti-pattern hosts (#127) | — |
| 8 | Judge self-consistency over three runs | DONE | Cassettes, 3 runs per item; selective prediction (#165, open) | open PR #165 |
| 9 | Optional 30-item author audit | DONE | Blind audit (#26); author audit sheet (#95); `Docs/labeller-route.md` | — |
| 10 | Intra-rater re-label after 7 days | SUPERSEDED | Dropped by the page's own revision; panel run-vs-run instead | — |
| 11 | Author review sheets / `export-review.ts` | SUPERSEDED | `scripts/llm-label.ts`, `scripts/v1.3/audit-sheet.ts` | — |
| 12 | SO5 grid: 3 Claude models (+ Gemini as a 4th column) | DONE (modified) | 54 Claude + 18 Codex cells (#50, #56); no Gemini generator | Gemini arm: OUT (kill list #5) |
| 13 | Taxonomy by LLM-assisted open coding | DONE | `scripts/so5-open-coding.ts` (#33) | — |
| 14 | Template tag structural/topological/pattern-proxy (FR-29) | DONE | `TemplateTag` in `src/shared/types/enums.ts` | — |
| 15 | Differential check on every seeded project | DONE | `Docs/matching-rule.md` | — |
| 16 | Root-cause codes fixed before review | DONE | Root-cause list in matching-rule (FR-v1.2E-27) | — |
| 17 | G1 protocol frozen | DONE | prereg v1 (#20) | — |
| 18 | G2 instrument validated (known answers, determinism, scorer checks) | DONE | Build and Test A–H (#9–#14, #35–#37: "Ready for experiments: yes") | — |
| 19 | G3 corpus frozen | DONE | #10, #20; `corpus/` | — |
| 20 | G4 runs complete | DONE (Study 1) | E1 (#56), E7 (#45), SO4 (#40) | — |
| 21 | G5 reproduced | DONE | Reproduction audit (#54); replication package (#117) | — |
| 22 | G6 claims reviewed with adversarial review | OPEN | Adversarial reviews done (#67, #120, #152), but there is no claim register | NEW (same as #4) |
| 23 | "No inferential test is run" | SUPERSEDED | Study 2 uses inference (`Docs/v1.3/study2-power-notes.md`; night-backlog A1 exact inference) | — |
| 24 | Tier A vs Tier C recall gap reported | UNCLEAR | Not found | Check the Ch.7 tables |
| 25 | GDS left out | DONE (as decided) | Kill list #9 | — |

#### Wrong statements
- "`experiments/PROTOCOL.md` … `experiments/CLAIMS.md`": neither file exists. The registered protocol is `Docs/analysis-plan.md` + `Docs/matching-rule.md` + `corpus/prereg.json`.
- "`functionExecution.executed == compiled` (24 or 25 symbolic functions)": there are 27 FF-* IDs (`rule-tiers.md`).
- "Cassettes … `tests/cassettes/<tag>/`": cassettes are stored in `experiments/*/cassettes`, and `tests/cassettes` does not exist.
- "No inferential test is run (proposal commitment)": Study 2 in v1.3 has a power analysis and inference (`Docs/v1.3/study2-power-notes.md`).
- "Neural labels: Author, blind to model output … committed before the model run": no author neural labels exist; panel and constructed truth were used instead.

### 🎯 Results plan — plan of record (simplified) (3f250d3082278191984ec4a831101792)
This page is the plan of record for the results: five phases, experiments E1–E7, totals and risks. Last edited 2026-10-07.

| # | Idea / open item / decision / promise / conflict | Status | Evidence | Next action |
|---|---|---|---|---|
| 1 | Phase 1 engine fixes and the four compliance items | DONE | #1–#5, #23, #27, `enums.ts` | — |
| 2 | Mutation tool with eight operators | SUPERSEDED | 11 operators + twins (`Docs/operator-catalogue.md`, #6) | — |
| 3 | Generator with an Anthropic SDK adapter | SUPERSEDED | Claude CLI generator (`Docs/generator-protocol.md`, frozen 2026-10-08) | — |
| 4 | Labeller with a Gemini adapter | DONE | #21, #63, #64 | — |
| 5 | Run harness with env, invariants, aggregation, figures | DONE | `scripts/run-experiment.ts`, `aggregate.ts`, `figures.ts` | — |
| 6 | Phase 3 instrument validation gate + protocol freeze | DONE | #37; prereg #20 | — |
| 7 | E1 generation grid, 54 projects | DONE | 72 cells incl. Codex (#50, #56); size reading (#57) | — |
| 8 | E2 detection accuracy, about 150–180 seeded | DONE (reduced) | N = 75/73 held-out (TV-17; #40, #41) | — |
| 9 | E3 FP analysis: Gemini labels + 30-label audit | DONE | #48, #64, #26 | — |
| 10 | E4 judge reliability: constructed + natural units | DONE | #64, #71, #92, #101; v2.2 pending | open PR #141 |
| 11 | E5 coverage, latency, band sweep, ablation | DONE | #23, #36, `results/sensitivity` | — |
| 12 | E6 library validation | DONE | #27; v1.3 reference projects (#82, #83) | — |
| 13 | E7 open-source projects (8–10, three mapping iterations each) | DONE | E7 9 bases (#45), E7-x (#43), `Docs/e7-spec-rule.md`; v1.3 external set of 15 (#133, open) | open PR #133 |
| 14 | Phase 5: Gemini/Antigravity CLI and Codex generator arms | DONE (Codex) / OUT (others) | #50; new vendor arms on the kill list | OUT (kill list #5) |
| 15 | Phase 5: tag, clean-machine reproduction, claim register, write Ch.7–9 | OPEN | Freeze dry run #164 (open); no claim register | open PR #164; night-backlog T1 |
| 16 | Risk: failed generations recorded, never replaced | DONE | `Docs/generator-protocol.md` BR-U5a-49 | — |
| 17 | Risk: circular seeded recall is reported separately | DONE | SO4 strata by corpus tier (matching-rule MAT-20) | — |
| 18 | Totals of 25–33 days; "this page wins" | SUPERSEDED | v1.3 ADR (`Docs/v1.3/adr-v13.md`) and night plan/backlog | — |

#### Wrong statements
- "Where it disagrees with the dataset design, the protocol or the compliance register, this page wins": the v1.3 plan of record (`Docs/v1.3/adr-v13.md`, night backlog/plan) now governs, and Study 2 is the remaining run.
- "Seeded instances: About 150–180": the actual N was 75 strict / 73 corrected, below even the 80–120 floor (`Docs/threats-to-validity.md` TV-17).
- "Mutation tool with eight operators": there are 11 operators plus twins.
- "Generator with one adapter (Anthropic SDK…)": the generator is the Claude CLI under `Docs/generator-protocol.md`, plus Codex CLI.
- "54 generated" projects and "SO5 still stands on three Claude models": E1 has 72 cells (Codex arm #50), and SO5 is now Study 2.


Read only. Notion was fetched and queried, never edited. Repo checked at `origin/v1.3` tip `d65fddbb`. Open PR heads were read with `git show`.

### DaedalusArch long-term ideas and future work (2026-10-11) (3f750d30822781f491c0f00cedcd075b)
Reference Cabinet page listing post-v1.2E ideas by theme. Last edited 2026-10-12.

| # | Idea / open item / decision / promise / conflict | Status | Evidence | Next action |
|---|---|---|---|---|
| 1 | DaedalusArch as an MCP server queried during generation | DONE | #74 integrated into v1.3 via #80; MCP v2 #122 merged; `src/mcp-server/` | none |
| 2 | Three-way experiment: no tool / context-graph tool (graphify, Serena) / DaedalusArch MCP | SUPERSEDED | `Docs/v1.3/study2-outline.md` §3: arms `none`, `daedalus-mcp`, `gate`; the context-graph arm was dropped | none |
| 3 | Firewall in the loop as the next big study (Study 2) | OPEN | readiness gate #146 (1/42 green); pilot run #170 open; `study2-outline.md` | night-backlog §3 "Go for the loop pilot"; open PR #170 |
| 4 | B: realistic anti-pattern judge test | DONE | `Docs/v1.3/judge-catch-frozen.md`; claim 16/21 = 0.76 (#120) | none (v2.2 tracked in #141) |
| 5 | Judge weighting and aggregation as a research question (Paper 3) | DONE | ADR-028; `papers/paper3-judge` (#66, #73) | none |
| 6 | Judge as a diagnostic layer (explanations as output) | DONE | filter-and-explain merged in #126; neural MCP tools `explain_and_fix` in open #157 | merge #157 (night roadmap item) |
| 7 | Real-violation mining at scale | OPEN | open PR #168 (fixes mined from 36 histories); research-gaps §3a rank 3 (#169) | open PR #168; scale to ≥50 pairs |
| 8 | Human expert labelling with inter-rater agreement | SUPERSEDED | night-plan author decision 2: non-human evidence first; kill list #15 | optional 2 architects only (#169 §3a rank 9) |
| 9 | Practitioner study | OUT | #169 §3a "Out of master's scope"; kill list #15 | future work |
| 10 | Break the full-AaC confound (spec without grading rules, hint-free arm) | OPEN | `Docs/v1.3/study1-addenda.md` A1 | night-backlog F1 |
| 11 | Corpus beyond NestJS (Express, Fastify, plain TS) | OPEN | open PR #133 (15 human-written backends, 3 per style) | open PR #133 |
| 12 | pnpm and yarn support in the installer | OUT | #77 open and parked (v1.3 brief decisions); not on any backlog | none |
| 13 | Lift the 800-file limit | UNCLEAR | no v1.3 doc found on it | check whether the limit still exists |
| 14 | Python or Java extractors | OUT | #169 §3b (doctoral agenda) | future work |
| 15 | Grok arm and more vendors for E1 | OUT (kill list #5) | `night-backlog-2026-10-16.md` §4 | after the director meeting |
| 16 | Full LLM-review baseline (finish 25/42, more vendors) | OUT | not on night-backlog or night-plan; ADR-036 pilot stands as exploratory | none |
| 17 | Dynamic `import()` and NestJS module wiring edges | DONE | #69 integrated via #80; SO4 recall 67/73 to 73/73 under v1.3 | none |
| 18 | Hexagonal style library | DONE | `presets/hexagonal.yaml` (#76 via #80); DDD too (#83) | none |
| 19 | Wider FLOWS_TO edge | OUT | stays a declared limitation (v1.3 brief decisions; FF-P06 3 N/A, #120); APG v2 type flow merged in #114 | limitation paragraph |
| 20 | Less proxy-rule noise (demote CV05) | DONE | `Docs/v1.3/rule-tiers.md`: FF-CV01..CV06 advisory; post-filters in open #139 | #139 decision (night-backlog U1) |
| 21 | More baselines: jQAssistant, ArchUnitTS | OPEN | open PR #166 (dependency-cruiser, eslint-plugin-boundaries, ArchUnitTS); no jQAssistant | open PR #166 |
| 22 | Graph adapter for graphify / CodeGraphContext | OUT | #75 open and parked | none |
| 23 | Paper 1 (E1) | OPEN | `papers/STATUS.md`: MSR 2027 abstracts 20 Oct, papers 23 Oct (to verify); 30-item audit unanswered | NEW: decide this week whether to target MSR 2027 or EMSE |
| 24 | Paper 2: apply the review's fixes | OPEN | revised in #73; `papers/STATUS.md` lists the hold-out and labels as missing | NEW: finish after the sealed hold-out run |
| 25 | Paper 3 workshop draft | DONE | #66, #73 | venue choice (`papers/STATUS.md`) |
| 26 | Paper 4 = firewall in the loop | SUPERSEDED | Paper 4 is now cheap semantics: `papers/paper4-cheap-semantics` (#112) | none |
| 27 | PhD path | OUT | #169 §3b | future work |
| 28 | Commercial or open-source product | OUT | outside SO1–SO5 | none |
| 29 | Suggested order: audit, deviations list, director meeting | OPEN | `papers/STATUS.md` (audits unanswered); night-plan §6 decisions | night-plan author decisions 1–7 |

#### Wrong statements
- "prototype built in draft PR #55 … exposes 5 tools" → #55 is closed. The MCP server is in v1.3 (#74 via #80, MCP v2 #122), and Study 2 uses 7 spec-only tools plus `evaluate_project` (`study2-outline.md` §3).
- "A Hexagonal style library. SO1 promised it and it was not built" → `presets/hexagonal.yaml` exists, along with DDD. Five presets in total.
- "Dynamic import() … draft PR #69, behind a flag that is off by default" → integrated via #80. SO4 is 73/73 under v1.3.
- "Paper 4 (future): firewall in the loop" → Paper 4 is cheap semantics (`papers/paper4-cheap-semantics`, #112).
- "agents with a popular context-graph tool, such as graphify or Serena" → this arm is not in the Study 2 outline (`study2-outline.md` §3).
- "B … designed and on hold" → B was run: 16/21 = 0.76 (`judge-catch-frozen.md`, #120).
- "Human expert labelling … would replace … the LLM panel" → the author decided validity rests on non-human evidence (night-plan decision 2).

### v1.3 validity cycle: make the tool provably work (greenfield) (3f950d308227810a8225e3b3f0be58f2)
Live brief for the v1.3 validity cycle, a child of the roadmap. Last edited 2026-10-15 18:21 UTC.

| # | Idea / open item / decision / promise / conflict | Status | Evidence | Next action |
|---|---|---|---|---|
| 1 | Four-link validity framing (code→graph, spec, spec→rules, finding→problem) | DONE | `Docs/v1.3/validation-protocol.md` | none |
| 2 | Study 1 frozen; Study 2 pre-registered, run once on fresh tasks | OPEN | gate #146 (1/42); kill list #4 (no prereg draft yet) | night-backlog §3 "Go for the loop pilot" |
| 3 | Target: import-edge fidelity ≥0.95, every disagreement classified | OPEN | adjudication prep in open #131; `human_verdict` empty (`papers/STATUS.md`) | open PR #131 (author spot-check) |
| 4 | Target: file-to-layer accuracy ≥0.95 | UNCLEAR | only ISE per-file 2088/2089 in open #150 | find the reference-project measurement |
| 5 | Targets: blocking recall and precision ≥0.90 per style | OPEN | development-set only; sealed hold-out not run (#169 §3a rank 1) | run the hold-out once after the freeze (#164) |
| 6 | Target: judge catch ≥0.80 | OPEN | 0.76 [0.55, 0.89], not met (#120) | open PR #141 (author's one local v2.2 run) |
| 7 | Units U-A to U-F and U-H | DONE | #80, #81, #83, `rule-tiers.md`, `study2-outline.md` | none |
| 8 | U-G spec-influence pilot, with a hint-free arm (addendum A1) | OPEN | `validation-protocol.md` (U-G deferred); `study1-addenda.md` A1 | night-backlog F1 |
| 9 | Blind-manifest gap, adjudication sheet (96 rows) | OPEN | open #134: all 18 gaps are rule/construct gaps | construct sheet #129 (night-plan decision 1) |
| 10 | Barrel fix ADR-V13-01 | DONE | `Docs/v1.3/adr-v13.md` | none |
| 11 | Monorepo libraries treated as external (ghostfolio) | UNCLEAR | no fix found | check whether this is still a limitation |
| 12 | Reference projects must include a literal `import()` | OPEN | dynamic-import reference cases in open #131 | open PR #131 |
| 13 | Database isolation as a required fix | UNCLEAR | no lock commit found; #128 interpreter removes the shared server for dev runs | confirm |
| 14 | Sealed hold-out, run once after the construct decisions | OPEN | 207 cases, `Docs/v1.3/sealed-hashes.md` | #164 freeze dry run, then one run |
| 15 | Construct decisions | OPEN | `construct-decisions-answer-sheet.md`: every `[Answer]:` is blank | night-plan decision 1 |
| 16 | Duplicated-rule twin is a flawed control | SUPERSEDED | the claim is limited to the 2 clean types, 16/21 (#120) | none |
| 17 | APG v2 generic edges | DONE | #114 | none |
| 18 | Cheap semantic proxies | DONE | #114; Paper 4 | none |
| 19 | ISE prototype | DONE | #105, #114; onboarding in open #150 | open PR #150 |
| 20 | Labelling: Gemini labeller and meaningful labels | OPEN | Gemini key missing; panel harness in open #153 | night-plan decision 7 |
| 21 | Study 1 re-run under v1.3 (SO4 73/73) | DONE | night roadmap; #80 | none |
| 22 | F-P01-ALIAS fix | DONE | `Docs/DiagnosticRuns/apg2-live-2026-10-15.md` | none |
| 23 | Author's random-sample audit of labels and reference projects | OPEN | `papers/STATUS.md`: 40-item sheet unanswered | NEW: one-hour audit before the director meeting |
| 24 | Check the literature quotes against the books | DONE | #116 errata | none |
| 25 | Review the validation report before the director meeting | OPEN | night-plan §6 | night-plan author decisions |
| 26 | FLOWS_TO stays a limitation; ISE gets its own cycle; #75 and #77 parked | OUT | #75 and #77 still open | none |
| 27 | Rule tiers fixed a priori | DONE | `rule-tiers.md` (2026-10-14) | none |
| 28 | Study 2 task list sealed outside the repo, hash committed | UNCLEAR | `sealed-hashes.md` covers the hold-out; Study 2 task hash not checked | verify |

#### Wrong statements
- "Recall 57/57 and precision 57/57" → corrected to 54/54 + 3 N/A (FF-P06's FLOWS_TO half), #120.
- "Judge catch … Round 2: 21/24 (0.88)" → the defensible claim is 16/21 = 0.76 [0.55, 0.89], below the 0.80 target (#120).
- "Sealed hold-out set ready: 62 cases … hash a94360e1" → superseded. 207 cases (`cddec14a…`). It was enlarged after the development results and written by the same vendor (`sealed-hashes.md` honest note).
- "0 incorrect findings out of 2,668" → should read 2,669 (#147).
- "Labels: the Gemini labeller plus your random-sample audit" → no Gemini key (decision 7). Validity strategy is non-human first (decision 2).
- Unit statuses "🔄 running" and "⏳" → U-A to U-F and U-H are done; see the roadmap.

### DaedalusArch roadmap and dependency map (v1.2E, live) (3f550d308227814f9ad0ed16b356f196)
Roadmap and status log, newest first, plus the v1.2E checklist, reading guide and ADR log. Last edited 2026-10-16 03:56 UTC.

| # | Idea / open item / decision / promise / conflict | Status | Evidence | Next action |
|---|---|---|---|---|
| 1 | Merge #153, #142, #157, #135 (gates green, 0 behind) | OPEN | all four still open (prs.txt); only #163 merged since `50a32841` | author merge (night-plan MT) |
| 2 | #135 changes the default engine; Neo4j parity check; TS fast-path decision | OPEN | open #135; live check in open #151 | open PR #135, #151 |
| 3 | 6 PRs 26 commits behind (#134, #137, #138, #140, #150, #143) | OPEN | all still open | rebase and merge train |
| 4 | 15 PRs held for review | OPEN | still open (prs.txt) | author review queue |
| 5 | `--check-prereg` PLAN_INVALID on `loop-pilot/plan.json` | UNCLEAR | not re-checked | verify |
| 6 | Close the blind-key gap (Layered 7/10, Hexagonal 12/18) | OPEN | open #134: all 18 are rule/construct gaps | construct sheet #129 |
| 7 | Fix hints for agents | OPEN | open #143 | open PR #143 |
| 8 | Fewer noisy warnings | OPEN | open #139 | night-backlog U1 |
| 9 | `npx` + MCP without a database | OPEN | open #135; MCP parity | night-backlog V1 |
| 10 | Judge v2.2 on fresh cases | OPEN | open #141 | author's one local run (night-backlog §3) |
| 11 | Sequence: construct answers → freeze → sealed test → human labels → pilot → Study 2 plan | OPEN | #164 freeze dry run; #170 pilot run open ("DDD unscored") | night-plan decisions 1, 4 |
| 12 | Answer the score-free sheet (#129) | OPEN | answer sheet blank | night-plan decision 1 |
| 13 | New Gemini key | OPEN | — | night-plan decision 7 |
| 14 | Hexagonal ports audit | UNCLEAR | no audit file found | ask the author |
| 15 | Spot-check the graph-fidelity proposals | OPEN | open #131 | open PR #131 |
| 16 | Find a second human rater (not the director) | SUPERSEDED | night-plan decision 2; kill list #15 | none |
| 17 | Is the repo still public? | OPEN | — | night-plan decision 6 |
| 18 | Credits and billing notes, `claude --cloud` test | OUT | operational, not SO1–SO5 | none |
| 19 | Cypher interpreter; Neo4j stays the reference engine | DONE | #128 | none |
| 20 | Adversarial-review fixes | DONE | #120 | none |
| 21 | Rule-source verification and errata | DONE | #116 | none |
| 22 | Construct switches and score-free sheet built | DONE | #124, #129 | none |
| 23 | Judge v2 (opt-in, v1 frozen default) | DONE | #126 | none |
| 24 | Internal comms out of the public repo | DONE | #132 | none |
| 25 | Threats register | OPEN | #130 is still open, not merged | open PR #130 |
| 26 | Thesis SO3 validation section (Ch7–9 draft) | OPEN | waits on the audit (`papers/STATUS.md`) | NEW: write the SO3 section with 0.76 as "not met" (#169 rank 6) |
| 27 | 30-item blind audit | OPEN | `papers/STATUS.md`: unanswered | author action |
| 28 | Director meeting | OPEN | night-plan §6 | bring decisions 1–7 |
| 29 | Review v1.3 drafts #69, #74–#77, #79 | SUPERSEDED | #69, #74, #76, #79 integrated via #80; #75 and #77 parked | none |
| 30 | Housekeeping: rotate Gemini key and Neo4j password, remove worktrees | UNCLEAR | not checkable from the repo | ask the author |
| 31 | Duplicated-rule operator fix (frozen operator) | UNCLEAR | no fix commit found | ask the author |

#### Wrong statements
- "v1.3 is still at `50a32841` (#152)" → v1.3 is now at `d65fddbb`; since `50a32841` only the docs PR #163 merged.
- "Running now: Merge train: 14 PRs into v1.3" → none of the listed PRs merged after `50a32841` (the earlier train did merge #105–#129). #153, #142, #157, #135 and the rest are still open.
- "Threats register done: PR #130" → #130 is open, not merged.
- Step 3: "There is no Hexagonal library" → `presets/hexagonal.yaml` (and DDD) on v1.3.
- Step 4: "The 6 misses are all dynamic import(), which is out of coverage" → covered in v1.3; SO4 is 73/73.
- Checklist "MCP server prototype … neither is merged" → the MCP server is in v1.3 (#80, #122).
- "construct answers → freeze → sealed test once → human labels" and "Find a second human rater" → validity strategy is non-human first (night-plan decision 2).
- Hygiene: the page ends with a stray chat prompt ("I need to spend credits against my subscription usage…"). It is not roadmap content.

### Hub "Next Actions" inline database (View of Tasks 3e150d308227801a9fabe41054c08f84, collection://33b50d30-8227-813e-9527-000b73332b4d)
An inline view of the GTD Tasks data source, filtered to Project = "Governing AI-Agentic Development…" (2d5b9aad…). I queried it three ways (view mode, rows mode with relation filter, SQL LIKE), and each query returned **0 rows**. A title search in the whole Tasks source found one unlinked thesis row.

| # | Idea / open item / decision / promise / conflict | Status | Evidence | Next action |
|---|---|---|---|---|
| 1 | No task is linked to the project, although the author has 7 pending decisions | OPEN | view `3e150d30-…-80bf` returns 0 rows | NEW: add one Next Action per night-backlog §3 row and night-plan decision 1–7 |
| 2 | "Next Steps Thesis Work?" (Inbox, created 2026-07-07, empty, no project link) | UNCLEAR | page 39650d30822780c88079d3f9519174ce | link it to the project or close it |

#### Wrong statements
- None. The database has no rows, so it has nothing to be wrong about. Its emptiness does mislead: the hub shows no next actions while the author gates are pending.


---

## Part 2: Consolidated STILL-OPEN items, ranked by impact on the objectives

Duplicates across pages are merged. The ranking weighs:
1. whether the item blocks Study 2 running once (SO5);
2. whether it decides a claim level (SO3, SO4);
3. whether it would leave a measured result unwritten;
4. everything else (SO1 polish, housekeeping).

| Rank | Open item (Notion sources) | Objective | Owner / mapping | Next action |
|---|---|---|---|---|
| 1 | Study 2 readiness: the gate is 1/42 green, and the pilot ran without reaching its §5 decision (DDD unscored). Sources: v1.3 brief, roadmap, Ch5–7 outline | SO5, Study 2 once | Open PRs #146, #170. Night-backlog S1, S2, D1, D2, S3, E1, S4, C1. Night-plan B1/B2, W3-3 | #142 merged 2026-10-16 (late merge train), so loop-dependent jobs D1, D2, E1, S3 can start. Author: go for the dress rehearsal |
| 2 | Construct sheet unanswered → freeze → sealed hold-out run once (207 cases). Sources: v1.3 brief, roadmap | SO4 headline, Study 2 timing | Author (night-backlog §3, row 1). Open PR #129 sheet, #164 freeze dry run. Night-backlog T1 | Author answers #129 and records ADR-V13-03, then freezes and runs the hold-out once |
| 3 | Judge v2.2 single local run on CHECK-2. Sources: hub status, DSR frame, compliance register, v1.3 brief | SO3 claim level | Author (night-backlog §3, row 2). Open PR #141; night-plan X4 | Run `judge-v22-check2-local.sh` once. If it fails the pre-fixed rule, narrow the claim to "evidence beside the verdict, 0.76" |
| 4 | Judge reframing without new calls: selective prediction and the symbolic–neural complementarity matrix. Sources: SRS (ICC/ablation promises), long-term ideas | SO3 | Open PR #165 (N1: unanimity does not meet the rule). Night-backlog N2 | Run N2; report N1's null honestly |
| 5 | Study 2 has no place in the proposal, the official outline or the Ch5–7/DSR chapter plan. Sources: proposal, outline, DSR frame, Ch5–7 outline | SO5 write-up | NEW | Add a Study 2 chapter slot and a short scope amendment to the outline, written after the gate goes green |
| 6 | Method statement still says "quantitative-descriptive, no inferential testing, no human participants". Sources: hub callout, DSR frame, plan de cierre | SO4/SO5 framing | NEW | Rewrite Ch3: descriptive SO4, plus registered permutation tests (`Docs/analysis-plan.md` §6, `study2-outline.md` §5). Re-check the ethics answer (rank 14) |
| 7 | Same-vendor threat V10: a non-Claude model panel and a third blind manifest. Sources: v1.3 brief, roadmap | SO4 | Author: Gemini key (night-plan decision 7). Harness merged (#153, late merge train). Night-backlog H1 | Provide the key; run the panel and H1 locally |
| 8 | SO4 evidence on human-written code: external set, deterministic correctness, convergent validity, spec-author reliability, known-groups validity, FP/FN analysis. Sources: proposal ("greenfield only"), readiness audit, SRS (CodeQL H4) | SO4 | Open PRs #133, #167, #166, #134. Night-backlog K2, K1, M1, U1 | Review and merge #133 → #167 → #166. Run K2 next |
| 9 | Claim register with evidence, scope and strength for each Ch7–9 conclusion (gate G6 of the experiment protocol; `experiments/CLAIMS.md` never written) | SO3–SO5 | NEW | One table, one row per claim, citing file:line. Write it only after the freeze, so the numbers are final |
| 10 | Floor levers before the Study 2 design locks: the layout sentence and brownfield precedent. Sources: long-term ideas, roadmap (hint-free arm) | SO5 | Night-backlog F1, F2 (after #161) | One Opus session each, sequential |
| 11 | Threats register and role-separation plan still unmerged (the roadmap says "done") | SO4 | Open PR #130 | Review and merge |
| 12 | Thesis chapters still describe the 7cd15b4 instrument (Ch4 drafts, Ch6 has no judge section, Ch7 has no v1.3 validity section) | SO1–SO4 write-up | NEW (private thesis repo) | Redraft after the freeze; use this file's Part 3 as the errata list |
| 13 | SO1 validator claims: stage-2 validation is non-strict (`strictMode: false`); FF-CV01 cannot fail (`.*` patterns); the rule-gap catalogue; the Listing 4.1 caption; the FF-P02 semantics check | SO1 | Open PR #144 (rule gaps), #158 (FF-CV03 question). Rest NEW | Decide the strict default, or disclose stage 2 as advisory. State FF-CV01 as a known no-op |
| 14 | Ethics answer: the proposal says "no human participants"; `human-labelling-protocol.md` and #130 describe a small human component | SO4, admin | UNCLEAR, author decision | Author confirms with the director whether an ethics statement is needed |
| 15 | ADR numbering collision: Notion ADR-015–018 (LLM critic, routing, dual scoring, ablation) are not the repo's ADR-015–018 | Writing | NEW | Cite repo ADRs only; add one mapping line in the thesis |
| 16 | The hub's Next Actions database is empty although several author gates are pending | Housekeeping | NEW | Author adds rows for ranks 2, 3, 7 and 14 |
| 17 | Paper 1 venue: MSR 2027, with abstracts due 20 Oct and papers 23 Oct 2026 per `papers/STATUS.md` (marked "verify" there). The fallback is EMSE | Outside SO1–SO5 (papers) | Author | Verify the deadline today, or move to EMSE |

**Doctoral or future work (OUT), for the record.** These are not to be scheduled:
- Neo4j GDS algorithms (kill list #9)
- ontology v1, community detection and the web dashboard (kill list #9)
- a Grok or other new-vendor arm (kill list #5)
- human-rater recruitment as the primary validity route (kill list #15)
- Python scope
- a CodeQL/Joern comparison (replaced by dependency-cruiser and convergent validity)
- a controlled developer study
- the graphify/Serena context-graph arm
- testability, evolvability and security dimensions
- the five-layer APG with VIOLATES edges stored in the graph
- module-oriented (non-total-order) specs beyond hexagonal `allowed_dependencies`

---

## Part 3: Statements in the Notion pages that are now WRONG and would mislead a reader

The full list is under "Wrong statements" for each page in Part 1. These are the ones most likely to mislead, grouped by topic.

1. **"LLM judge (Semantic / Integrity): not implemented" / "no real LLM providers wired" / "only MockLLMProvider exists"** (hub status table and conflicts callout, SRS, diagnosis, audit trail, outline 9.3 "future work").
   - A Claude CLI judge exists (`src/llm-critic/claude-cli-provider.ts`, #7), pinned in `src/llm-critic/frozen.ts`.
   - Judge v1 is frozen (`Docs/v1.3/judge-catch-frozen.md`); v2 was merged opt-in (#126); v2.2 is prepared (#141).
   - FF-N01/N02 are reported but do not block in v1.3.
2. **"17 Cypher rules" / "24 templates" / "26 functions" / "two style libraries" / "Hexagonal library was not built"** (hub, spike, SRS, Ch4 drafts, compliance register, long-term ideas, roadmap).
   - The registry has 27 FF-* IDs, plus the hexagonal and DDD library rules, tiered blocking/advisory (`Docs/v1.3/rule-tiers.md`).
   - `presets/` ships five libraries: clean-architecture, layered, hexagonal, ddd and nestjs.
   - Layers bind by `kind`, not by literal name.
3. **"Measurement (SO4): pending" / "Chapters 7–9 cannot be written: no matching, no P/R, no ground truth, no timings"** (hub status, readiness audit).
   - All of these exist: `Docs/matching-rule.md`, `scripts/score-golden.ts`, mutation manifests, report timings, judge cassettes, `results/so4-heldout`, `results/e1-grid` and `results/e7-corpus`.
4. **"Recall 57/57, precision 57/57" and "Judge catch 21/24 (0.88)"** (v1.3 brief).
   - These were corrected to 54/54 plus 3 N/A, and to 16/21 = 0.76, which is below the 0.80 target (#120).
5. **"Sealed hold-out ready: 62 cases, hash a94360e1"** (v1.3 brief).
   - It was superseded by a 207-case set (`cddec14a…`). That set was enlarged after the development results were known and written by the same vendor (`Docs/v1.3/sealed-hashes.md`).
6. **Seeded-instance totals "98–113", "150–180", "150–300"** (dataset design, plan of record, proposal).
   - SO4 was scored on 75 strict and 73 corrected held-out instances, below the registered 80–120 floor. This is a declared deviation (`Docs/threats-to-validity.md` TV-17).
7. **"Quantitative-descriptive, no inferential hypothesis testing" (hub) versus "3×3 ANOVA, 135 projects" (chain #1, ADR-011, SRS).** Both are wrong, in opposite directions.
   - E1 is a 72-cell grid with Holm-corrected permutation tests (`Docs/analysis-plan.md` §6).
   - Study 2 plans a sign-flip permutation test (`Docs/v1.3/study2-outline.md` §5).
8. **SO5 = "LLM × spec characterisation", or "SO5 leaves the body as future work"** (audit trail, plan de cierre, outline, compliance register).
   - The characterisation ran as Study 1 E1 (#56, #57).
   - In v1.3, SO5 is the firewall's effect on agent-generated code (Study 2).
9. **"Hard block: neuronal violation with confidence ≥ threshold → PR cannot merge"; targets "Precision ≥ 0.90, κ ≥ 0.60, ICC ≥ 0.70"** (SRS).
   - Only blocking-tier rules fail a verdict.
   - The numeric targets were dropped. P/R/F1 are reported descriptively.
10. **"In-memory evaluator: none exists" / "Neo4j mandatory"** (hub, diagnosis, ADR-003).
    - The in-process Cypher interpreter is merged (`src/cypher-interp/`, #128). Neo4j stays the reference engine.
11. **Judge route "Anthropic SDK provider, `ant auth login`, `anthropic-provider.ts`"; "Gemini `gemini-2.0-flash` default"** (readiness audit decision 6, DSR frame).
    - Neither was built. The Claude Code headless CLI route was chosen (FR-v1.2E-23).
12. **"Unbound parameters: the executable catalogue is seventeen" / "verify F1 on a live Neo4j"** (hub gaps, Ch4 drafts).
    - This was fixed in v1.2E U1: the parameters are parsed, and an unbound parameter is a fatal error (BR-SPEC-10, PR #3). The F1 check is moot.
13. **"APG: 5 node types / 7 edge types"; "violation layer stored in the graph"** (hub callout, ADR-005, chain #1).
    - The graph has 6 node types and 9 edge types, plus opt-in v1.3 and APG2 types (`src/shared/types/enums.ts`).
    - It has no violation nodes.
14. **ADR log "ADR-015 to 018: not started"** (ADR page).
    - All four were built.
    - The repo reuses those numbers for different decisions, so a citation of "ADR-017" is ambiguous.
15. **`experiments/PROTOCOL.md`, `experiments/CLAIMS.md`, "fifteen operators" / "eight operators"** (experiment protocol, dataset design, plan of record).
    - Neither file exists. The registered protocol is `Docs/analysis-plan.md`, `Docs/matching-rule.md` and `corpus/prereg.json`.
    - The frozen catalogue has 11 operators plus 11 twins (`Docs/operator-catalogue.md`).
16. **Roadmap: "v1.3 at 50a32841", "merge train of 14 PRs running", "threats register done (#130)"; long-term ideas: "MCP server is draft PR #55", "dynamic import() off by default", "Paper 4 = firewall in the loop".**
    - v1.3 is at `d65fddbb`.
    - #130 and most of that merge train's PRs are still open.
    - The MCP server is in v1.3 (#80, #122).
    - Dynamic import went in via #80.
    - Paper 4 is cheap semantics.

---

## Appendix: mentioned pages not fetched

The pages above mention more Notion pages that were not fetched because they are second-level links. They include:
- research foundations (`32c50d30822780549069fc163c31f9e7`)
- the PRD (`d09cbd0643f1497887f788ff1ed8c70b`)
- the APG extension and CPG pages (`33550d30822781…` series)
- Lab DSL vs Thesis Firewall (`34850d30822781f98800d2bbbb6cb415`)
- the Background pages (`35450d30822780e8ad73cd1dce428807`, `d9b656f1c169441582d64526f74dac33`)
- Updated References (`7c48d4f993e14dfda53bebe07212ecc3`)
- the Governance Engine hub (`a81d98a7b4684835b55d41ced1a59226`)
- the methodological analysis pages (`6f9c196293144165bf1b37b57cd0deeb`, `31e50d30822780ecbc69fa1a323b74af`)
- four untitled roadmap links (`3f550d30822781ab…`, `3f550d308227816c…`, `3f450d30822781dd…`, `3f550d30822781f5…`)

A second pass could triage them if needed.
