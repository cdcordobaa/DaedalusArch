# Results report for the thesis director, October 2026

**Thesis**: *Governing AI-Agentic Development: A Spec-Driven Neuro-Symbolic Architectural Firewall* (MSc, Universidad Nacional de Colombia)
**Tool**: DaedalusArch, branch `v1.2e` at merge commit `1543ba9`
**Date of this report**: 2026-10-11
**Scope**: every result committed on `v1.2e` except E1 (SO5), which is still running (Section 4.8 is a placeholder).

**How to read this report**

- Every number carries the committed file it comes from, in brackets. Paths are relative to the repository root.
- A number with no direct source line was derived by me from the cited file. It is marked "derived", with the arithmetic.
- Every reading is labelled **pre-registered** or **post-hoc**. A post-hoc reading was defined or changed after some results were seen. The ADRs declare each one, and this report repeats the declaration.
- "Instrument v1" and "instrument v2" are the two versions of the rule set (ADR-026). "Rule 1.1.0" and "rule 1.2.0" are the two versions of the matching rule (ADR-025). Every table names the versions it uses.
- Figures are in `Docs/reports/figures/`. The script `make_figures.py` rebuilds them from the committed CSVs.

---

## 1. Executive summary

**What was built and frozen.** DaedalusArch compiles an architecture spec into graph queries (Cypher fitness functions) and runs them over an Architectural Property Graph (APG) extracted from TypeScript code. A frozen LLM judge (`claude-opus-5-5`) adds two semantic dimensions. Before any experiment ran, the analysis plan, the operator catalogue, the matching rule, the judge rubric and the corpus were registered under a hash-checked pre-registration. That registration now stands at version 20, with 77 registered artefacts [corpus/prereg.json]. `run-experiment` refuses any plan whose registered artefacts changed [Docs/threats-to-validity.md, TV-01].

**Main findings so far.**

1. **SO4, seeded detection (held-out, symbolic-only).**
   - Strict reading (instrument v1, rule 1.1.0, N = 75, pre-registered): recall 0.893, cell-bootstrap 95% CI 0.787 to 0.974. Seeded differential precision 0.838 (0.719 to 0.970) [results/so4-heldout/agg-strict/prf_overall.csv].
   - Corrected reading (rule 1.2.0, N = 73, post-hoc, ADR-025): recall 0.918 (0.818 to 1.000), precision 1.000, F1 0.957 (0.900 to 1.000) [results/so4-heldout/agg-corrected/prf_overall.csv].
   - Instrument v2 (post-hoc, ADR-026) gives identical seeded detection [results/so4-heldout/v2/agg/prf_overall.csv].
   - All 6 remaining misses are the dynamic `import()` operator, which is outside the extractor's coverage [results/labels/fn-causes.json].
2. **The golden set is below its registered floor.** N = 75 scored instances against the floor of 80; 10 of the 85 registered applications failed the type-check [results/so4-heldout/agg/golden_instances.csv].
3. **Real-code precision is low.** Baseline precision, the share of real (unseeded) findings that the labeller judged real, is 0.328, Kish-Wilson 95% CI 0.132 to 0.609. It rests on n = 24 labelled items, effective n 11.5, under instrument v2 [results/so4-heldout/agg/precision_baseline.csv]. This is the number that answers "how often is a reported violation real". It is far below the seeded differential precision, and the interval is wide.
4. **SO2 (performance).** Every evaluated graph parses completely. On the largest base (ghostfolio, 241 files), the full evaluation takes 5.3 s against a 30 s budget for the cycle queries [results/latency-gate/so2/latency.csv]. The data-flow edge type (FLOWS_TO) is empty on all four real core bases [results/apg-ablation/so2/flows_to_stores.csv], which is a declared limitation (ADR-023).
5. **SO3 (the LLM judge).** On the 9 E7 projects the judge failed 73 of 331 judged units. Under the registered aggregation it changed **no** verdict and no AHS value [results/e7-corpus/judge-diagnostics/judge_summary.csv; results/e7-corpus/agg-proportional/ahs_by_aggregation.csv]. With the registered judge weight of 0.08, the judge can lower the combined AHS by at most 0.08 and can never raise it. The post-hoc variants let the judge move between 0 and 8 of the 9 verdicts. The judge moves 8 only under the most aggressive one: any-fail with judge weight 2/7.
6. **Tool comparison.** Against dependency-cruiser on the same seeds, the comparable rules agree except on two points, both explained [results/tool-comparison/recall.csv; Docs/DiagnosticRuns/tool-comparison-real-pairs-2026-10-10.md]:
   - dependency-cruiser finds the 6 dynamic-import seeds that DaedalusArch misses.
   - DaedalusArch's apparent advantage on domain-purity seeds comes from a translation defect, found post-hoc. The defect favours DaedalusArch.
7. **Real fix commits.** Both tools flag the same 2 of 5 real fix commits through the same rules [results/real-pairs/summary.json].

**What this supports.** The symbolic engine finds the canonical violation constructs it was designed for, reproducibly, on held-out code, and fast enough for CI use. It matches a mature import-graph checker on the rules both can express. Its extra rule families (patterns, SOLID proxies, metrics, data-flow) have no external comparator yet.

**What it does not support yet.** It does not support these claims:

- that DaedalusArch's findings on real code are mostly correct (baseline precision 0.33, wide CI);
- that the LLM judge improves verdicts (no effect under the registered rule, and no panel validation of the judge yet);
- any SO5 claim about LLMs and spec quality (E1 is running).

**Decisions needed from the director** (Section 7):

- the E1 reporting plan;
- whether to fund the judge-vs-panel labelling (P4) before or after E1;
- the 30-item author audit;
- the API-robustness experiments;
- the split into three papers;
- the two proposed extensions (a Grok arm and an MCP firewall-in-the-loop).

---

## 2. Objectives SO1 to SO5 and their status

| Objective | What it promises | Status on `v1.2e` | Main evidence |
|---|---|---|---|
| SO1 | Spec language and style libraries (Clean, Hexagonal, Layered) that compile to executable checks | **Done for Clean, Layered and a NestJS library; Hexagonal not built.** All 27 declared functions have a template in each of the 3 libraries. A layered acceptance run passed | [results/pre-tag/so1-metrics-53cfaed4a313.json; results/pre-tag/layered-53cfaed4a313.json; ADR-027 context] |
| SO2 | APG extraction: coverage, latency, value of the graph over a plain AST | **Done.** Latency gate passed. Ablation run. FLOWS_TO limitation declared | [results/latency-gate/so2/gate.json; results/apg-ablation/so2/] |
| SO3 | Symbolic rules plus a neural judge producing an Architectural Health Score (AHS) and verdicts | **Partly done.** The E7 run is complete (9 of 9 projects). The judge's effect on verdicts is zero under the registered rule. Judge-vs-panel validation (P4) has not run | [results/e7-corpus/agg/; results/e7-corpus/agg-proportional/; results/labels/judge-verdicts.json is empty] |
| SO4 | P/R/F1 on a seeded golden dataset (80 to 120 instances) | **Done with a shortfall** (N = 75). Strict, corrected and v2 readings committed. Baseline precision labelled. Author audit pending | [results/so4-heldout/] |
| SO5 | LLM × spec-quality study (E1) | **Running.** 72 cells: 54 Claude cells plus an 18-cell Codex arm. Pass 1 was restarted after ADR-032 | [Docs/analysis-plan.md §2; ADR-029; ADR-032] |

---

## 3. Method in brief

### 3.1 Pre-registration and the hash gate (pre-registered)

- The analysis plan, threats register, operator catalogue, matching rule, judge pre-registration, plans, specs and seeds are hashed in `corpus/prereg.json`. It is at version 20, with 77 artefacts [corpus/prereg.json].
- `run-experiment` refuses a plan when a registered artefact changed, or when `prereg.json` is uncommitted or newer than the first run. Every result records its `preregVersion` [Docs/threats-to-validity.md, TV-01].
- CI runs `--check-prereg` on every plan for pull requests to `v1.2e` [Docs/threats-to-validity.md, TV-91].
- Each bump has a dated reason in `Docs/prereg-reasons.md`. The bumps that matter for this report:

| Bump | Version | What it registered |
|---|---|---|
| P-1 | v2 | catalogue frozen, k = 2 |
| P-M | v3 | methodology corrections, ADR-020 |
| P-U6 | v4 | U6 integration unit |
| P-4 | v7 | judge freeze |
| P-SO4 | v8 | seeded SO4 entries |
| (ADR-025) | v9 | matching rule 1.2.0 |
| (ADR-026) | v10 | instrument v2 |
| (ADR-027) | v11 | E7 extension |
| P-A28 | v14 | proportional judge variant |
| P-A28R | v15 | review fixes to the variant |
| P-JW | v17 | judge-weighted variant |
| P-CX | v18 | Codex arm |
| P-TC | v19 | tool comparison |
| P-TS | v20 | E1 tsconfig fix |

Sources: [Docs/prereg-reasons.md; ADR-025, ADR-026, ADR-027].

### 3.2 Versions

| Component | Version | Source |
|---|---|---|
| Runtime | Node v24.5.0; Neo4j 5.26 community, APOC 5.26.24 | [aidlc-docs/construction/build-and-test/build-and-test-summary.md §1] |
| Judge | `claude-opus-5-5` through Claude CLI 2.1.294, pinned under a dedicated prefix. Rubric frozen 2026-10-09, `FROZEN_SHA256 f8b2dabb…eac5a` | [Docs/judge-preregistration.md; ADR-018 item 4; ADR-022 item 5] |
| Labeller | `gemini-3.1-pro-high` through the Antigravity CLI `agy` 1.3.2 | [results/labels/live-call-ledger.md; ADR-019 item 4] |
| Rule set | instrument v1 (last commit `febc918`) and instrument v2, which adds role exemptions for three proxy rules | [ADR-026] |
| Matching rule | 1.1.0 (registered) and 1.2.0 (post-hoc, ADR-025) | [Docs/matching-rule.md; ADR-025] |
| Baseline tool | dependency-cruiser 18.4.0 with typescript 5.9.3; translation 1.0.0 | [ADR-030 item 1] |
| E1 generators | `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-4-5`; `gpt-5.6-terra` through Codex CLI 0.162.1 | [Docs/analysis-plan.md §2; ADR-029] |

### 3.3 Corpus and selection rules (pre-registered, with post-hoc steps declared)

**Inclusion criteria C1 to C6** [Docs/corpus-criteria.md §1]:

- C1: an OSI licence.
- C2: 20 to 300 TypeScript source files (20 to 800 in the E7-x round).
- C3: a TypeScript back end.
- C4: a named style.
- C5: an npm lock file.
- C6: not archived, not a fork, not a duplicate.

Candidates are drawn by a seeded RNG (`mulberry32`), never by stars or names [Docs/corpus-criteria.md §2].

**SO4 held-out set: 7 bases** [Docs/analysis-plan.md §2]:

- 4 core bases: realworld-test, ghostfolio-test `apps/api`, truthy-demo, dry-run-test.
- 3 E7 round-1 bases: zhuravlevma__nestjs-active-record, nestjslatam__ddd, v-aguiar__valex.

**E7 set: 9 projects.** These are the 7 bases above plus 2 E7-x additions: zhuravlevma__typescript-ddd-architecture and raouf-b-dev__ecommerce-store-api. The E7-x round searched 246 candidates; 22 were eligible, 6 were drawn and 2 admitted [Docs/corpus.md, "E7-x additions"].

**Exclusions by name** [aidlc-docs/construction/build-and-test/build-and-test-summary.md §6.4; Docs/corpus.md]:

- dev-nest and eryzerz: type errors.
- MarvinRF: a report-schema defect; it stays excluded for good (ADR-021 item 5).
- 4 of the 6 E7-x draws.

**Style imbalance.** The held-out set has 5 `nestjs` bases, 1 `clean-architecture` and 1 `layered`, by spec style [Docs/threats-to-validity.md, TV-89].

**Post-hoc or floor-motivated steps, declared:**

- the domain-layer remap;
- the ghostfolio preparation;
- the generated E7 specs, which were produced mechanically by the registered rule `Docs/e7-spec-rule.md`.

All three are declared [Docs/threats-to-validity.md, TV-06, TV-08, TV-88]. The E7-x extension was drafted after an API-only research pass had seen the candidates [ADR-027; TV-98].

### 3.4 The seeded golden set: operators and twins (pre-registered)

The frozen catalogue has 11 operators and 11 twins [Docs/operator-catalogue.md §1].

- **Operators.** Each operator is a literal negation of a rule template, applied at a site where the change is feasible. Example: MO-S01 makes a domain file import an infrastructure symbol.
- **Twins.** Each twin is a near-identical edit that the rule should not flag. Example: MO-S01n makes an infrastructure file import a domain symbol.
- **Seeding.** The catalogue was frozen at k = 2 applications per (operator, base), master seed 20261008 [ADR-019 item 6; ADR-024].
- **Count.** The registered feasibility count gave 85 held-out instances. Ten applications failed the type-check and are never re-drawn, so N = 75 (ADR-024, diagnosed as infeasible sites, not operator defects). The post-hoc MO-S01 style guard removed 2 more as not applicable to a layered spec, so N = 73 [ADR-025 item 2].
- **Coverage.** Held-out seeds exercise 9 of the 22 executed functions (FF-C04, FF-CV02, FF-P01, FF-P06, FF-S01, FF-S03, FF-S04, FF-SO01, FF-SO02) [results/so4-heldout/agg-corrected/prf_by_function.csv; results/so4-heldout/score-corrected.json `executedFunctions`].

### 3.5 The matching rule

**Registered core (pre-registered)** [Docs/matching-rule.md §3]:

- A violation's key is (function, file, target, discriminator). Line numbers never enter the key (MAT-02).
- The new violations of a seeded copy are the multiset difference against its own unseeded baseline (MAT-03).
- A seed is a true positive (TP) when a new violation of an expected function carries an expected key (MAT-04).
- Every other new violation that is not declared collateral is FP-strict (MAT-09).
- FP-labelled is FP-strict minus the items the labeller judged real (MAT-10).

**MAT-04a (post-hoc, rule 1.2.0, ADR-025).** It re-keys pre-existing violations of a class that a seed renamed. Without it, a rename counts old violations as new false positives.

### 3.6 Judge isolation and freeze (pre-registered)

**Isolation.** The judge runs with a dedicated config directory under a fail-closed allow-list, a pinned CLI version with auto-update off, `StructuredOutput` as its only tool, no MCP servers, and a fresh neutral working directory [ADR-018; aidlc-docs/construction/build-and-test/build-and-test-summary.md §4].

**Freeze.** The rubric was frozen on 2026-10-09, after the sensitivity check SEN-01 passed for both neural functions. It changes only through a registered ladder step [Docs/judge-preregistration.md].

**Residual channels.** These were not positively controlled:

- the user-level `CLAUDE.md` and the `UserPromptSubmit` hook;
- the ancestor `CLAUDE.md` channel, which is closed only by the neutral-cwd check (ISO-05).

They are listed as residual threats [Docs/threats-to-validity.md, TV-36].

**Recordings.** Every judge call is recorded as a cassette and replays without new calls [Docs/analysis-plan.md §12.2].

### 3.7 Labelling design (pre-registered; sizes amended before any live call)

**Labeller.** One Gemini model of a different vendor from the judge, run twice with permuted option order [Docs/analysis-plan.md §4, §10 B3].

**Populations** [Docs/analysis-plan.md §4; results/labels/label-plan-summary.json]:

- **P1**: every new violation of a seeded copy that is not an expected key (a census; 34 items under rule 1.1.0).
- **MS**: missed seeds without a mechanical cause (2 items).
- **P2**: baseline violations of the E7 projects (30 items, drawn with probability proportional to stratum size). Of these, 24 come from the v2 population and 6 from the rows only v1 reports.
- **P3**: 0 items (dropped, ADR-021 item 8.1).
- **P4**: judge units of E1 (0 items so far, because E1 has not finished).

**Budget and calls.** The budget is 300 agy invocations, re-asks and retries included. Live labelling used 142 [results/labels/live-call-ledger.md].

**Validity rule.** Run-vs-run κ of at least 0.60 keeps the FP/FN taxonomy "as registered"; below that it is descriptive only [Docs/analysis-plan.md §5].

**Author audit.** A 30-item audit was drawn label-blind before any call (seed 6105), and its allocation is sealed. The author has not labelled it yet [results/labels/live-call-ledger.md; results/so4-heldout/agg/agreement.csv, panel-vs-audit n = 0].

### 3.8 Post-hoc declarations

Each item below was decided after some outputs were seen. Every one is reported beside the registered reading and replaces none.

| ADR | Post-hoc change | Effect on reported numbers |
|---|---|---|
| ADR-022 | FF-CV01 and FF-CV04 excluded after failed probes. FF-CV06 template fixed. Tooling fixes | Convention dimension rests on 4 functions. No measured value changed by the tooling fixes |
| ADR-024 | Type-check losses diagnosed. Declared post-hoc, but made before any SO4 evaluation | N = 75 instead of 85 |
| ADR-025 | Matching rule 1.2.0 (MAT-04a) and the MO-S01 layered style guard | Strict and corrected SO4 readings side by side |
| ADR-026 | Instrument v2 role exemptions for FF-CV05, FF-C02 and FF-C03 | Baseline volume on the 7 bases 1066 → 826. No seeded detection changed |
| ADR-027 | E7-x criteria drafted after the candidate research | E7 sample composition |
| ADR-028 | Proportional and judge-weighted variants | Their E7 readings are post-hoc. Their E1 readings are pre-registered |
| ADR-030 | Translation defect found after the run; sensitivity variant `dts` | Tool comparison has a registered and a post-hoc reading |
| ADR-032 | E1 extraction uses the pinned per-run tsconfig | Operational. All pass-1 E1 records discarded |

---

## 4. Results

### 4.1 SO1: spec language and style libraries

| Measure | Value | 95% CI | Reading | Source |
|---|---|---|---|---|
| Template coverage per library (functions with a template ÷ declared) | clean-architecture 27/27, layered 27/27, nestjs 27/27 | none | pre-registered (descriptive) | [results/pre-tag/so1-metrics-53cfaed4a313.json `libraries`] |
| Compiled ÷ declared, corpus specs | clean-architecture 48/54 (0.889); nestjs 144/162 (0.889); layered 36/54 (0.667) | none | pre-registered (descriptive) | [same file, `compiledShares`] |
| Validator first-pass rate, corpus specs | 6/10 (0.60) | Wilson 0.313 to 0.832 | pre-registered | [same file, `groups`] |
| Validator current pass rate, corpus specs | 10/10 (1.00) | Wilson 0.722 to 1.000 | pre-registered | [same file] |
| First-failure codes (corpus) | `INVALID_TEMPLATE_REF` 4 | none | descriptive | [same file] |
| Layered acceptance run (FR-20) on v-aguiar__valex | declared 27, compiled 18, disabled 9, skipped by mode 2, executed 16, failed 0; AHS 0.553, soft-block | none | pre-registered | [results/pre-tag/layered-53cfaed4a313.json] |
| Sensitivity probes (each check can fire on a seeded fixture) | 23 of 25 fire; FF-CV01 and FF-CV04 excluded after failure | none | registered procedure; FF-CV06 fix post-hoc | [results/sensitivity/step31/agg/function_sensitivity.csv; ADR-022] |

**Interpretation.**

- Each of the three built libraries maps every declared function to an executable template, and the layered library runs end to end on a real layered project with no failed function.
- The first-pass validator rate (0.60 on 10 specs) measures how often a spec passed at its first commit. It is not a usability result [Docs/threats-to-validity.md, TV-93].
- The Hexagonal library promised in SO1 does not exist [ADR-027 context]. Hexagonal projects are mapped to `clean-architecture`.

### 4.2 SO2: coverage, latency, the ablation, and the FLOWS_TO limitation

**Coverage and graph size** (full arm; instrument v1; pre-registered) [results/apg-ablation/so2/graph_coverage.csv]:

| Base | Files | Parse coverage | Nodes | Edges | Resolved internal imports | FLOWS_TO edges |
|---|---|---|---|---|---|---|
| realworld-test | 35 | 1.000 | 142 | 257 | 72 | 0 |
| ghostfolio-test | 241 | 1.000 | 1232 | 3666 | 1023 | 0 |
| truthy-demo | 131 | 1.000 | 494 | 1009 | 307 | 0 |
| dry-run-test | 155 | 1.000 | 468 | 1136 | 409 | 0 |

**Latency** (pre-registered gate; budget 30 000 ms per cycle query):

| Run | Total ms | FF-S02 cycle query ms | Universal cycle metric ms | Gate | Source |
|---|---|---|---|---|---|
| latency-gate, ghostfolio (241 files) | 5343 | 547 | 1346 | pass | [results/latency-gate/so2/latency.csv; results/latency-gate/so2/gate.json] |
| apg-ablation, 9 full-arm runs | 630 to 5244 | 1 to 552 | 2 to 1335 | 18/18 runs pass | [results/apg-ablation/so2/nfr07_latency.csv; results/apg-ablation/so2/gate.json] |
| apg-ablation v2 (post-hoc instrument), 9 full-arm runs | 592 to 5977 | 1 to 542 | 2 to 1313 | within budget | [results/apg-ablation/v2/so2/nfr07_latency.csv] |
| PROFILE, ghostfolio (3 repetitions after warm-up) | none | 594 to 654 | 1396 to 1415 | none truncated or timed out | [results/latency-gate/so2/profile-ghostfolio-test/profile.csv] |

No strongly connected component on the four core bases exceeds the cycle-length bound of 10. The largest has 4 files (truthy-demo) [results/latency-gate/so2/profile-*/scc_components.csv].

**Ablation: full APG vs AST-only** (IMPORTS, DECLARES and CONTAINS edges only; instrument v1; pre-registered, descriptive) [results/apg-ablation/so2/apg_ablation_summary.csv; results/apg-ablation/so2/apg_ablation.csv]:

| Base | Edges removed | Functions detecting (full → AST-only) | Functions lost | Violations (full → AST-only) |
|---|---|---|---|---|
| realworld-test | 32 | 6 → 6 | none | 41 → 41 |
| ghostfolio-test | 1012 | 13 → 12 | FF-P02; FF-SO01 fewer (22 → 16) | 436 → 375 |
| truthy-demo | 142 | 12 → 10 | FF-P02, FF-P04 | 125 → 112 |
| dry-run-test | 159 | 11 → 9 | FF-P02, FF-P04 | 156 → 142 |

Edges removed are from [results/apg-ablation/so2/apg_arms.csv]. On the five fixtures the AST-only arm loses FF-P02 and FF-P04 on four of them, and also gains detections that the full arm does not report: FF-P03 on correct-reference and on variants a and d, and FF-C04 on variant d [results/apg-ablation/so2/apg_ablation.csv].

**FLOWS_TO limitation** (pre-registered evidence step; limitation declared in ADR-023) [results/apg-ablation/so2/flows_to_stores.csv]:

| Base | Field stores found | Skipped: target not extracted | Skipped: union or intersection type | FLOWS_TO edges |
|---|---|---|---|---|
| realworld-test | 2 | 2 | 0 | 0 |
| ghostfolio-test | 23 | 21 | 2 | 0 |
| truthy-demo | 3 | 3 | 0 | 0 |
| dry-run-test | 3 | 3 | 0 | 0 |
| fixtures variant-a, variant-c | 2, 8 | 1, 7 | 0 | 1, 1 |

**Interpretation.**

- Extraction is complete on every base. The slowest cycle query took 1.35 s against its 30 s budget, and the whole evaluation of the largest base took 5.3 s [results/latency-gate/so2/latency.csv].
- The type-checker edges (CALLS, CONSTRUCTOR_INJECTS, EXTENDS, IMPLEMENTS) carry the pattern rules. Without them, dependency inversion (FF-P02) and use-case isolation (FF-P04) go blind on every real base where they fired, and the fixtures show false gains.
- The data-flow edge type is empty on real NestJS-style code, because collaborators arrive by constructor injection. SO4 domain purity therefore rests on CONSTRUCTOR_INJECTS plus IMPORTS, not on FLOWS_TO [ADR-023 item 4].
- The ablation cannot show what FLOWS_TO adds on real code: there are no such edges to remove [Docs/threats-to-validity.md, TV-96].

### 4.3 SO4: seeded detection, held-out, symbolic-only

![SO4 readings with intervals](figures/fig1-so4-readings.svg)

**Overall rows.** The primary interval is the cell-percentile bootstrap over (project, operator) cells. Precision here is **seeded differential precision**.

| Reading | Status | N | TP | FP | FN | Recall (95% CI) | Precision (95% CI) | F1 (95% CI) | Twin specificity | Source |
|---|---|---|---|---|---|---|---|---|---|---|
| Strict: instrument v1, rule 1.1.0 | **pre-registered** | 75 | 67 | 13 (strict) | 8 | 0.893 (0.787 to 0.974; 40 cells) | 0.838 (0.719 to 0.970; 36 cells) | 0.865 (0.784 to 0.943) | 60/73 | [results/so4-heldout/agg-strict/prf_overall.csv; results/so4-heldout/score-strict.json] |
| Labelled: instrument v1, scorer at rule 1.2.0, original case | registered labelling procedure; rule post-hoc | 75 | 67 | 0 (labelled) | 8 | 0.893 (0.787 to 0.974) | 1.000 (cell bootstrap 1.000 to 1.000; Clopper-Pearson if independent 0.946 to 1.000) | 0.944 (0.881 to 0.987) | 68/73 | [results/so4-heldout/agg/prf_overall.csv; results/so4-heldout/agg/twins.csv] |
| Corrected: instrument v1, rule 1.2.0 plus style guard | **post-hoc** (ADR-025) | 73 | 67 | 0 | 6 | 0.918 (0.818 to 1.000; 39 cells) | 1.000 (bootstrap degenerate; Clopper-Pearson 0.946 to 1.000) | 0.957 (0.900 to 1.000) | 68/73 | [results/so4-heldout/agg-corrected/prf_overall.csv; results/so4-heldout/score-corrected.json] |
| v2: instrument v2, rule 1.2.0 plus style guard | **post-hoc** (ADR-026) | 73 | 67 | 0 | 6 | 0.918 (0.818 to 1.000) | 1.000 | 0.957 (0.900 to 1.000) | 68/73 | [results/so4-heldout/v2/agg/prf_overall.csv; results/so4-heldout/v2/score.json] |

**Strata** (corrected reading unless stated) [results/so4-heldout/agg-corrected/prf_overall.csv; results/so4-heldout/agg-strict/prf_overall.csv]:

| Stratum | Corrected recall (95% CI) | Strict recall (95% CI) |
|---|---|---|
| Core (4 bases, seen in development) | 0.950 (0.846 to 1.000) | 0.950 |
| E7 round 1 (3 bases, the only unseen stratum) | 0.879 (0.697 to 1.000; 17 cells) | 0.829 (0.647 to 1.000) |
| In coverage | 1.000 (36 cells) | 0.971 |

The project cluster bootstrap is descriptive only, because there are 7 projects and the registered threshold is 10. It gives corrected recall 0.865 to 0.972.

**Per operator** (status of every held-out instance) [results/so4-heldout/agg-strict/instances.csv; results/so4-heldout/agg-corrected/instances.csv]:

| Operator | Matched | Missed (strict) | Corrected status of the misses |
|---|---|---|---|
| MO-C04 | 14 | 0 | none |
| MO-P01 | 13 | 0 | none |
| MO-CV02 | 12 | 0 | none |
| MO-SO01 | 11 | 0 | none |
| MO-S01 | 8 | 2 | 2 not applicable (layered style guard) |
| MO-DF01 | 5 | 0 | none |
| MO-S03 | 2 | 0 | none |
| MO-SO02 | 2 | 0 | none |
| MO-X01 | 0 | 6 | 6 missed |

**N against the floor of 80.** 75 scored golden instances, 5 below the floor. The registered total was 85; 10 yielded no scored instance [results/so4-heldout/agg/golden_instances.csv]. The 10 losses were type-check rejections: MO-SO02 5, MO-X01 2, MO-P01 1, MO-SO01 1, MO-DF01 1. Each was diagnosed as an infeasible site, not an operator defect [ADR-024]. The corrected reading has N = 73 [ADR-025 item 2]. Under ADR-019 item 1, k stays frozen and the shortfall is reported as a deviation.

**Causes of the misses.**

- **Six MO-X01 seeds:** RC-DYNAMIC-IMPORT, assigned mechanically. The extractor does not ingest `import()` [results/labels/fn-causes.json; results/so4-heldout/agg/fp_fn_taxonomy.csv].
- **Two MO-S01 seeds on v-aguiar__valex (strict reading only):** an oracle error. Under the layered spec the seeded business → persistence import is allowed, so no rule should fire [ADR-025 context]. The labeller marked both as `uncertain` [results/labels/labels.json, population MS].

**Twins.**

- **Specificity 68/73 = 0.932** [results/so4-heldout/agg/twins.csv].
- **Three dirty twins** (FF-CV05 on `index.ts` in nestjslatam__ddd) are a twin-site artefact: the twin edit turns a barrel into a non-barrel [ADR-026 item 3].
- **Two dirty twins** (valex MO-S01n) are real upward violations under a layered spec, so these twins are not true negatives [ADR-025 effect].
- **The strict reading's 60/73** is lower because MO-CV02n renames re-keyed old violations [ADR-025 context].
- **Registered caveat:** twin specificity holds by construction of the twin preconditions. It is not a false-alarm rate on real code [Docs/analysis-plan.md §10 B2].

**Interpretation.**

- On held-out code, every in-coverage seed is detected under the corrected reading. Under the strict reading, 2 seeds and 13 false positives come from defects in the oracle and scorer, which were fixed after they were seen.
- The registered strict figures (recall 0.893, precision 0.838) must be quoted first. The corrected figures go beside them, labelled post-hoc.
- Recall is **construct sensitivity**: whether the query matches the canonical construct that the same author wrote. It is not detection of naturally occurring violations [Docs/analysis-plan.md §10 B1].
- The unseen E7 stratum has a lower point estimate (0.879) than the core (0.950), with overlapping intervals.

### 4.4 Real-code precision and the FP/FN taxonomy from labelling

**Baseline precision** (registered secondary outcome; labeller `gemini-3.1-pro-high`; frame = the 9 E7 projects' baseline violations) [results/so4-heldout/agg/precision_baseline.csv]:

| Row | Instrument | n | TP-class | Uncertain | Effective n | Precision | 95% CI (Kish-Wilson) |
|---|---|---|---|---|---|---|---|
| Overall | v2 (post-hoc instrument) | 24 | 11 | 8 | 11.5 | 0.328 | 0.132 to 0.609 |
| Overall | v1 (registered instrument) | 30 | 11 | 11 | 15.8 | 0.264 | 0.110 to 0.510 |
| Tier: core | v2 | 10 | 7 | 3 | 8.3 | 0.591 | 0.285 to 0.840 |
| Tier: E7 | v2 | 14 | 4 | 5 | 6.4 | 0.212 | 0.047 to 0.593 |
| v1-only set alone | v1 | 6 | 0 | 3 | 5.4 | counts only | none |

`uncertain` counts as not real, as registered [Docs/analysis-plan.md §3]. Per-function rows have n ≤ 6 and give counts only.

**Labeller reliability.** Run-vs-run agreement 0.875, n = 64, Wilson 0.772 to 0.935. Cohen's κ 0.774 (bootstrap 0.617 to 0.913). AC1 0.859. Taxonomy rule: `as-registered` [results/so4-heldout/agg/agreement.csv]. Under the registered wording this is **order sensitivity of one model**, not inter-rater reliability [Docs/analysis-plan.md §10 B3].

**P1 census** (34 new non-expected violations on seeded copies, strict rule 1.1.0) [results/so4-heldout/label-items.json; results/labels/labels.json]:

- 20 labelled `unseeded-TP`: real violations the seed did not intend.
- 9 labelled FP.
- 5 labelled `uncertain`.

**FP/FN taxonomy** (labeller root causes; pre-specified closed list; the κ rule keeps it as registered) [results/so4-heldout/agg/fp_fn_taxonomy.csv]:

| Population | Root cause | Count | Weighted count |
|---|---|---|---|
| P1 | RC-GENUINE-UNSEEDED | 20 | 20 |
| P1 | RC-EXTRACT-BARREL | 3 | 3 |
| P1 | RC-LAYER-MAP | 3 | 3 |
| P1 | RC-TYPE-ONLY | 3 | 3 |
| P2 | RC-GENUINE-UNSEEDED | 10 | 546.5 |
| P2 | RC-TYPE-ONLY | 3 | 237.5 |
| P2 | RC-TEST-CODE | 2 | 91.1 |
| P2 | RC-LAYER-MAP | 1 | 126.0 |
| P2 | RC-STYLE-INAPPLICABLE | 1 | 74.0 |
| P2 | RC-OTHER | 1 | 45.1 |
| MS | RC-DYNAMIC-IMPORT | 6 | 6 (mechanical) |

**Informal agent spot checks.** These are not registered and enter no table [ADR-026 items 9, 10]:

| Check | REAL | FALSE ALARM | DEBATABLE | Source |
|---|---|---|---|---|
| v1, 20 baseline items, seed 20261009 | 6 | 6 | 8 | [Docs/DiagnosticRuns/baseline-spot-check-2026-10-09.md] |
| v2, 20 items, seed 20261010 | 6 | 5 | 9 | [Docs/DiagnosticRuns/baseline-spot-check-v2-2026-10-09.md] |

**Interpretation.**

- About one in three real-code findings is judged real (0.33 under v2, 0.26 under v1), with intervals that run from about 0.1 to 0.6. Precision on the core tier (0.59) is higher than on the E7 tier (0.21), but n is 10 and 14.
- The false alarms come from metric and convention proxies, type-only imports, and spec layer mapping, not from the structural import rules.
- Instrument v2 lowered baseline volume by 22.5% on the 7 bases. That is not a validity gain: v2's precision interval overlaps v1's [ADR-026 rationale; Docs/threats-to-validity.md, TV-97].

### 4.5 SO3 and E7: verdicts and the judge effect

**Runs.** E7 ran in full mode on 9 projects; 9 of 9 runs were accepted, under prereg v11 and instrument v2 [Docs/analysis-plan.md §12; results/e7-corpus/agg/ahs_by_project.csv].

**Judge units.** FF-N01 (architectural integrity) judged 152 units and failed 31. FF-N02 (intent alignment) judged 179 and failed 42. No unit was invalid or a split vote [results/e7-corpus/judge-diagnostics/judge_summary.csv]. In 25 of the 31 FF-N01 fails and 38 of the 42 FF-N02 fails, a symbolic rule also flags a file of the unit [same file, `units_fail_rules_also_flag`].

**Verdicts and readings** (registered spec weights unless stated). Every reading except "Registered" is post-hoc for E7 [results/e7-corpus/agg-proportional/ahs_by_aggregation.csv; results/e7-corpus/agg/ahs_by_project.csv]:

| Project | Rules-only AHS | Rules-only verdict | Registered AHS | Registered verdict | Proportional AHS | Any-fail AHS | Any-fail verdict | Judge-weighted, registered: AHS and verdict | Judge-weighted, any-fail: AHS and verdict |
|---|---|---|---|---|---|---|---|---|---|
| realworld-test | 0.721 | warning | 0.743 | warning | 0.723 | 0.687 | warning | 0.800 pass | 0.600 soft-block |
| ghostfolio-test | 0.387 | hard-block | 0.437 | hard-block | 0.416 | 0.381 | hard-block | 0.563 soft-block | 0.363 hard-block |
| truthy-demo | 0.387 | hard-block | 0.441 | hard-block | 0.430 | 0.385 | hard-block | 0.566 soft-block | 0.366 hard-block |
| dry-run-test | 0.504 | soft-block | 0.547 | soft-block | 0.531 | 0.491 | **hard-block** | 0.649 soft-block | 0.449 hard-block |
| zhuravlevma__nestjs-active-record | 0.571 | soft-block | 0.608 | soft-block | 0.603 | 0.552 | soft-block | 0.695 warning | 0.495 hard-block |
| nestjslatam__ddd | 0.354 | hard-block | 0.411 | hard-block | 0.400 | 0.355 | hard-block | 0.542 soft-block | 0.342 hard-block |
| v-aguiar__valex | 0.553 | soft-block | 0.591 | soft-block | 0.586 | 0.563 | soft-block | 0.683 warning | 0.583 soft-block |
| zhuravlevma__typescript-ddd-architecture | 0.392 | hard-block | 0.443 | hard-block | 0.437 | 0.387 | hard-block | 0.568 soft-block | 0.368 hard-block |
| raouf-b-dev__ecommerce-store-api | 0.175 | hard-block | 0.247 | hard-block | 0.233 | 0.191 | hard-block | 0.415 hard-block | 0.215 hard-block |

**Judge effect under every reading and weight.** "Judge mattered" means the verdict differs from the judge-blind verdict under the same weights. Counts are derived from [results/e7-corpus/agg-proportional/ahs_by_aggregation.csv], columns `judge_mattered_*`, `any_fail_changed` and `verdict_changed_jw_*`.

| Weights | Aggregation | Status for E7 | Judge mattered (of 9) | Range of delta_judge | Bound |
|---|---|---|---|---|---|
| Registered (W_n = 0.08) | registered (majority of units) | pre-registered | 0 | 0.000 | [−0.08, 0] |
| Registered | proportional | post-hoc (pre-registered for E1) | 0 | −0.021 to −0.005 | [−0.08, 0] |
| Registered | any-fail | post-hoc | 1 (dry-run-test, soft-block → hard-block) | −0.056 to −0.028 (derived: any-fail AHS minus judge-blind AHS) | [−0.08, 0] |
| Judge-weighted (2/7) | registered | post-hoc (pre-registered for E1) | 0 | 0.000 | [−2/7, 0] |
| Judge-weighted | proportional | post-hoc | 2 (ghostfolio-test, realworld-test) | −0.075 to −0.017 | [−2/7, 0] |
| Judge-weighted | any-fail | post-hoc | 8 (all but raouf) | −0.200 to −0.100 | [−2/7, 0] |

![Judge effect, registered weights](figures/fig3-judge-effect-registered-weights.svg)

![Judge effect, judge-weighted](figures/fig4-judge-effect-judge-weighted.svg)

**The algebraic bound** [Docs/analysis-plan.md §10 B9, §12.3]:

- With every neural AVR (violation ratio) in [0, 1], the judge's effect on the combined AHS lies in [−W_n, 0].
- So the judge can lower `ahsCombined` by at most W_n and can never raise it above the judge-blind value.
- A verdict can move only when the judge-blind AHS is within W_n of a threshold.
- Under the registered weights W_n = 0.08, so the judge's stated role of moving verdicts is nearly unreachable by construction.

**Diagnostics.**

- **Dilution artefact.** The combined AHS sits 0.022 to 0.072 above the rules-only AHS (`delta_dilution`). This is an artefact of adding a clean-scoring dimension with weight 0.08, not a judge finding [results/e7-corpus/agg-proportional/ahs_by_aggregation.csv; Docs/analysis-plan.md §10 B9 rule (i)].
- **Reweighting is not a judge effect.** Changing to judge-weighted weights moves 7 of 9 registered verdicts (`verdict_changed_jw_registered`) without any judge effect (`judge_mattered_jw_registered` = 0). The judge dimensions score clean, so a larger weight raises the AHS [same file; B9 rule (iv)].
- **Coding frame 1.1.0** (post-hoc for E7) [results/e7-corpus/judge-diagnostics/judge_discrimination.csv]:
  - Pooled over projects, only one of 7 criteria separates fail from pass rationales at the pre-declared threshold of 0.3: JC-N01-DUP, duplicated rules, discrimination 0.323.
  - 15 of 63 per-project rows pass the threshold, each on 1 to 9 failing units.
- **Instrument v1 sensitivity row.** Under v1 the rules-only AHS and verdicts are unchanged on 8 of 9 projects. zhuravlevma__nestjs-active-record goes 0.538 (v1) → 0.571 (v2), soft-block in both [results/e7-corpus/v1/ahs_v1_sensitivity.csv].

**Interpretation.**

- The judge works as a process: 331 units judged, 0 invalid, 73 fails, most of them on files that the rules also flag. Under the registered rule, though, it never changes a score or a verdict.
- The only readings in which it moves verdicts are post-hoc for E7 and use the any-fail rule. Under that rule a single failing unit fails the function.
- None of these judge outputs has been validated against the panel (P4 n = 0). Every judge claim stays conditional on that validation [Docs/analysis-plan.md §10 B9].

### 4.6 Tool comparison against dependency-cruiser

![Seed recall by tool](figures/fig2-tool-comparison.svg)

Setup: symbolic-only, DaedalusArch instrument v2, dependency-cruiser 18.4.0 with translation 1.0.0. Registered under prereg v19 before it ran [ADR-030].

| Operator (rule) | n | DaedalusArch hits (Wilson 95%) | dependency-cruiser hits (Wilson 95%), registered | dependency-cruiser, `dts` variant (post-hoc) | Source |
|---|---|---|---|---|---|
| MO-S01 (FF-S01) | 8 | 8 (0.676 to 1) | 8 (0.676 to 1) | 8 | [results/tool-comparison/recall.csv; results/tool-comparison/recall-dts.csv] |
| MO-S03 (FF-S03) | 2 | 2 (0.342 to 1) | 2 (0.342 to 1) | 2 | same |
| MO-P01 (FF-P01) | 13 | 13 (0.772 to 1) | 4 (0.127 to 0.576) | 12 (0.667 to 0.986) | same |
| MO-C04 (FF-C04) | 14 | 14 (0.785 to 1) | 14 (0.785 to 1) | 14 | same |
| MO-X01 (FF-S01, dynamic `import()`) | 6 | 0 (0 to 0.39) | 6 (0.61 to 1) | 6 | same |
| In-coverage seeds | 37 | 37 (0.906 to 1) | 28 (0.599 to 0.866) | 36 (0.862 to 0.995) | same |
| All seeds | 43 | 37 (0.727 to 0.934) | 34 (0.648 to 0.886) | 42 (0.879 to 0.996) | same |
| Twins fired (lower is better) | 42 | 2 (0.013 to 0.158) | 2 (0.013 to 0.158) | 2 | same |

**Baseline volume on the 7 unseeded bases** (unique keys, DaedalusArch / dependency-cruiser / overlap) [results/tool-comparison/baseline-volume.csv]:

| Rule | DaedalusArch | dependency-cruiser | Overlap |
|---|---|---|---|
| FF-S01 | 69 | 25 | 25 |
| FF-S04 | 33 | 0 | 0 |
| FF-S03 | 3 | 3 | 3 |
| FF-P01 | 20 | 19 | 19 |
| FF-S02 (cycles) | 27 | 78 | 11 |
| FF-C04 | 6 | 7 | 4 |

**Runtime** (indicative only, on a shared machine): median wall time per run 2.66 s for DaedalusArch and 0.76 s for dependency-cruiser, over 94 runs [results/tool-comparison/summary.json].

**Interpretation.**

- On the rules both tools can state, they agree on every seed except two groups:
  - MO-X01: dependency-cruiser parses `import()` and DaedalusArch does not, as stated before the run.
  - MO-P01: a post-hoc-declared translation defect that dropped `.d.ts` package targets and favoured DaedalusArch. Under the `dts` variant dependency-cruiser scores 42/43, against DaedalusArch's 37/43.
- The baseline volume gap is almost all ghostfolio: dependency-cruiser does not resolve the monorepo alias, and it follows a second alias into `libs/`. Cycle counts use different units, so their overlap is not a precision measure [Docs/DiagnosticRuns/tool-comparison-real-pairs-2026-10-10.md].
- DaedalusArch's distinct value is in the rules dependency-cruiser cannot express: patterns, SOLID proxies, metrics, data-flow and the judge [ADR-030 item 3]. No external comparator measures those yet.

### 4.7 Real fix-commit pairs

Setup: 5 author-mined before/after pairs; 4 from raouf-b-dev__ecommerce-store-api and 1 from zhuravlevma__typescript-ddd-architecture. Symbolic-only, instrument v2. Descriptive only, n = 5 [ADR-030 item 6].

| Pair | Fix | DaedalusArch, all symbolic rules | DaedalusArch, comparable rules | dependency-cruiser | Source |
|---|---|---|---|---|---|
| p1 | domain service moved to application | no | no | no | [results/real-pairs/pairs.csv] |
| p2 (merge) | cross-module dependency replaced by a port | no | no | no | same |
| p3 (merge) | bounded contexts isolated with gateway adapters | yes, 3 resolved (strict: no) | yes, 2 (strict: no) | yes, 2 (strict: no) | same |
| p4 | DDD boundaries hardened | yes, 30 resolved (strict: no) | yes, 22 (strict: yes) | yes, 22 (strict: yes) | same |
| p5 | wiring only: typeorm moved to infra module | no | no | no | same |
| **Detected, primary / strict** | | **2 / 0** | **2 / 1** | **2 / 1** | [results/real-pairs/summary.json] |

**Interpretation.**

- Both tools flag the same 2 of 5 real fixes, through the same import-direction findings. DaedalusArch's extra rules resolve more findings on p3 and p4 but detect no additional fix.
- p1 is invisible because the generated spec maps both locations to the domain layer.
- p5 is a module-wiring change that no rule reads.
- With four pairs from one repository, this is a set of cases, not an estimate [Docs/threats-to-validity.md, TV-106].

### 4.8 SO5 / E1: placeholder (still running)

E1 is not reported here. The run is in progress, and `results/e1-grid` was deliberately not read for this report.

What is fixed in advance [Docs/analysis-plan.md §2, §6, §6.1, §12; ADR-029; ADR-032]:

**Grid.** 72 cells:

- 3 Claude models × 3 spec levels (`none`, `minimal-prose`, `full-aac`) × 2 tasks × 3 runs = 54 registered cells;
- plus 18 Codex cells (`gpt-5.6-terra`), an added arm registered before any of its cells ran.

**Primary analysis.** The registered AHS of each valid cell. `ahsDeterministic` is co-primary for the model effect. Holm-corrected permutation tests and Cliff's δ are used. The directional self-preference check and the vendor self-preference check are pre-registered.

**Pre-registered for E1 (not post-hoc, unlike E7):**

- the proportional and judge-weighted variants;
- the judge diagnostics, coding frame 1.1.0.

**Operational post-hoc fix (ADR-032).** E1 trees are extracted with the pinned per-run tsconfig. All pass-1 records were discarded and pass 1 re-runs under prereg v20.

**Known confounds to state with every E1 effect** [Docs/analysis-plan.md §10 B5, B10]:

- `full-aac` shows the generator the evaluator spec;
- tier is confounded with model generation;
- the judge is a Claude model;
- the Codex arm differs in harness, confinement and time.

*Section to be completed when E1 finishes: valid-generation yield per model × spec level; AHS grid with intervals; registered tests; self-preference checks; judge variants (pre-registered); P4 judge-vs-panel agreement.*

---

## 5. Honest limitations

1. **Circularity.**
   - The operators, the expected keys, the rules and the dependency-cruiser translation were all written by the same author. SO4 recall measures whether the queries match the author's canonical constructs (construct sensitivity) [Docs/threats-to-validity.md, TV-12, TV-104].
   - The only naturally occurring positives are the labelled P2 and P1 items (11 TP-class of 24 in P2 v2) [results/so4-heldout/agg/precision_baseline.csv] and the 5 real fix pairs.
   - Twin specificity holds by construction [TV-13].
2. **A NestJS-heavy corpus.**
   - 5 of the 7 held-out bases are `nestjs` by spec style. Only 1 is layered and 1 is clean-architecture [TV-89].
   - Every core base is NestJS [Docs/analysis-plan.md §10 B1].
   - Two E7 projects share an owner [TV-99].
   - Generalisation is limited to TypeScript NestJS or layered back ends of 35 to 819 files [TV-82; Docs/corpus.md].
3. **A single-model labeller.**
   - One Gemini model was run twice. κ 0.774 measures order sensitivity, not agreement between independent raters [results/so4-heldout/agg/agreement.csv; TV-31].
   - The labeller sees a 31-line window. It cannot see the APG excerpt that the judge sees [TV-34, TV-94].
   - The author audit, the only human check, is pending and is not blind to the rule [TV-33].
4. **The post-hoc fixes.** Matching rule 1.2.0, the style guard, instrument v2, the FF-CV06 template fix, the `dts` translation variant, the E7 judge readings and the ADR-032 extraction fix were all decided after outputs were seen (Section 3.8). The registered readings stay primary and are reported first.
5. **v1 vs v2.**
   - v2 removes 240 baseline violations on the 7 bases (1066 → 826) by role conventions chosen after a spot check named the noisy rules [ADR-026 item 8; TV-97].
   - It exempts some files that hold real logic: 3 named files, and 17 of 102 `*.module.ts` files [ADR-026 item 5].
   - SO4 and SO2 report v1 as primary. E7 and E1 run on v2 with a v1 sensitivity row.
6. **The judge weight bound.** With W_n = 0.08 the judge cannot raise an AHS and can lower it by at most 0.08 [Docs/analysis-plan.md §12.3]. Under the registered design the judge therefore cannot fulfil its stated role of moving verdicts. The judge-weighted variant (2/7) is a sensitivity analysis, not a redesign.
7. **No Hexagonal library.** SO1 promises Clean, Hexagonal and Layered. Only Clean, Layered and NestJS exist, and hexagonal projects are mapped to `clean-architecture` [ADR-027 context; Docs/corpus.md].
8. **The dynamic-import gap.** The extractor ignores `import()`. All 6 MO-X01 seeds are missed [results/labels/fn-causes.json], and dependency-cruiser finds them [results/tool-comparison/recall.csv]. Real code that loads layers lazily is invisible to DaedalusArch's structural rules.
9. **Other limits named in the register.**
   - N = 75 is below the floor of 80.
   - The 7-project cluster bootstrap is descriptive only.
   - FLOWS_TO is empty on real code.
   - Cycles longer than 10 files are not detected (none found).
   - Two canary channels of the judge are not positively controlled.
   - Runtimes come from a shared machine.

   Sources: [results/so4-heldout/agg/golden_instances.csv; Docs/analysis-plan.md §5; ADR-023; TV-36, TV-52, TV-105].
10. **Two stale register entries.** `Docs/threats-to-validity.md` still reads "No run has happened yet" in its §3 deviation table. TV-17 still says the floor is met (N = 85). Both predate the SO4 run. They should be updated by a registered bump before the thesis cites the register.

---

## 6. What the results support and what they do not

**Supported, with the stated caveats.**

- The registered pipeline (spec → compiled queries → APG → scores) runs reproducibly on 9 real projects and the fixtures. Every run was accepted, and the replays are byte-identical [results/e7-corpus/agg/ahs_by_project.csv; results/labels/live-call-ledger.md].
- On held-out code, the symbolic rules detect the seeded canonical constructs that are in coverage: recall 0.971 strict and 1.000 corrected [results/so4-heldout/agg-strict/prf_overall.csv; results/so4-heldout/agg-corrected/prf_overall.csv]. They stay silent on most twins (68/73).
- Latency is compatible with CI use on projects up to about 240 files: 5.3 s total [results/latency-gate/so2/latency.csv].
- The type-checker edges of the APG are needed for the pattern rules. Without them FF-P02 and FF-P04 stop firing [results/apg-ablation/so2/apg_ablation.csv].
- On import-graph rules, DaedalusArch is equivalent to dependency-cruiser on the same specs, apart from the dynamic-import gap [results/tool-comparison/recall-dts.csv].

**Not supported (yet).**

- That most DaedalusArch findings on real code are correct. Baseline precision is 0.33 (0.13 to 0.61) under v2 [results/so4-heldout/agg/precision_baseline.csv].
- That the LLM judge improves verdicts or AHS. It has no effect under the registered rule, and only post-hoc readings move verdicts. No panel validation exists.
- That DaedalusArch detects real architectural fixes better than an import checker. Both detect 2 of 5, the same two.
- Anything about the Hexagonal style, non-NestJS frameworks, projects beyond about 800 files, or languages other than TypeScript.
- Any SO5 conclusion about LLM models or spec levels. E1 is running.
- Recall on naturally occurring violations. SO4 recall is construct sensitivity.

---

## 7. Next steps and decisions for the director

**Running now.**

- **E1 (SO5).** Finish pass 1 and pass 2 under prereg v20, then aggregate (runbook 7.2), then run the replays for the registered variants.
  - *Decision:* whether the Codex arm's 18 cells are reported in the thesis body or in an appendix. They are exploratory except the vendor self-preference check [Docs/analysis-plan.md §6.1].

**Decisions requested.**

1. **P4 judge-vs-panel labelling.** This is the only planned validation of the judge.
   - Its P4 budget was registered at up to 46 items. With n_eff = 36 the E1 headline has a half-width of about ±0.155 at p = 0.5 [Docs/analysis-plan.md §4]. The weekly quota of about 180 calls allows it within the 300-call ceiling: 158 of the 300 calls remain [results/labels/live-call-ledger.md; derived 300 − 142].
   - *Decision:* label P4 as soon as E1 run-0 cells exist, before writing any judge claim. Or accept the judge as "unvalidated, diagnostic only" in the thesis.
2. **The 30-item author audit.** The view is drawn and the allocation sealed. It needs about one sitting of author time [results/labels/live-call-ledger.md].
   - *Decision:* complete it before the thesis draft, so that the panel-vs-audit row is not empty. It is a sanity check, not a validation (B6).
3. **API robustness experiments.** These are not yet in any committed plan. *Proposal to register before running:*
   - repeat the judge on a fixed sample, to measure verdict stability across days and quota windows;
   - inject faults (timeouts, malformed responses, usage limits) to exercise the degradation ladder;
   - re-run the labeller on the same items after a quota reset.

   Each needs its own registered plan and budget.
4. **Three papers.**
   - **E1 empirical paper:** LLM × spec quality, after E1. Main risks: the confounds B5 and B10, and the self-preference check.
   - **Tool paper:** DaedalusArch with SO1, SO2 and SO4, the dependency-cruiser comparison and the real pairs. It must lead with the circularity caveat and the baseline precision of 0.33.
   - **LLM-judge lessons paper:** a negative result. A registered majority rule with an 8% weight leaves the judge without effect. It covers the algebraic bound, the dilution artefact, the post-hoc variants, and a coding frame in which only 1 of 7 criteria discriminates.
   - *Decision:* order and venues. The judge paper needs the P4 result to say anything about judge validity.
5. **Extensions.** Neither is in a committed plan; both would be new registrations.
   - **A Grok arm in E1.** It would follow the ADR-029 pattern: its own plan, seed and sandbox confinement, and the vendor families only.
   - **An MCP firewall-in-the-loop.** DaedalusArch served as an MCP tool the generating agent calls during generation, compared with post-hoc evaluation. This is a new experiment with its own isolation design. It cannot reuse the E1 confinement unchanged, because that confinement forbids MCP [ADR-029 item 4; Docs/threats-to-validity.md, TV-95].
   - *Decision:* thesis scope or future work. My recommendation is future work for both, given the time left and the open P4 validation.

**Housekeeping before the thesis draft** (one registered bump):

- Update the stale entries of the threats register (Section 5, item 10).
- Close the open threat TV-84: the developer study was dropped with no ADR recording it [Docs/threats-to-validity.md, TV-84].
- Note that ADR-031 does not appear in the ADR file (the numbering jumps from ADR-030 to ADR-032).
