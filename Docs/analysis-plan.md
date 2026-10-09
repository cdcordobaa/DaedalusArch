# Analysis plan — v1.2E evaluation (SO1–SO5)

> **Status**: registered with `corpus/prereg.json` version 1 (U5b Step 32). Written in U5b Code Generation
> (Step 14: the SO5 code tables; Step 31: the rest, 2026-10-08), before the FR-18 re-baseline, any corpus run and the
> first E1 run (BR-U5b-50, 51, 64; OI-6). This file is a registered artefact: after registration any change to it is a
> pre-registration version bump with a reason (BR-U5b-50), and every earlier run keeps its own `preregVersion`.
> **Amended 2026-10-08 (ADR-020, pre-registration P-2)**, after the Fable adversarial review
> (`Docs/DiagnosticRuns/methodology-review-2026-10-08.md`) and before any so4-heldout, e7-corpus, e1-grid or
> live-labelling run: SO4 baseline precision (§3, item 1), TP-class label weighting (§1, §6, item 2), the cell-level
> recall unit (§5, item 3), symbolic-only SO4 (§2, item 5), descriptive pairwise CIs (§6, item 6), self-preference
> rows and the directional check (§3, §6, item 7), the E7 stratum (§3, item 8) and the reporting duties (§10, item 9).
> §11 lists every change.
> **Amended 2026-10-09 (ADR-021, pre-registration P-U6, `corpus/prereg.json` version 4)**, after the U6 lanes and before
> any so4-heldout, e7-corpus, e1-grid, apg-ablation or live-labelling run: the held-out set and the E7 bases named in
> the plans and the `apg-ablation` plan (§2); the SO2 outputs, gate source and NFR-07 source, the SO4 N outcome and
> per-style rows (§3); the label-size corrections of ADR-021 item 8 (§4, §5, §6); the SO4 precision and F1 intervals
> (§5); rejected pairs (§8). §11 lists every change.
> **Requirements**: FR-v1.2E-25, 27, 36; SO1–SO5 (ADR-017 items 1–3, 6, 7); ADR-015 items 1, 2, 5, 10; ADR-016 b, e.
> **Design source**: `aidlc-docs/construction/v1.2E-u5b-scoring-harness/functional-design/business-rules.md`
> (BR-U5b-20, 30, 33, 34, 45..49, 53, 54, 61..65, 78). The matching of seeds to violations is `Docs/matching-rule.md`
> (version 1.1.0 from P-2; 1.0.0 before); this plan does not restate it. The code lists (`RC-*` there, `FPAT-*` / `GEN-*` here) are disjoint
> (BR-U5b-30).

Sections: §1 the SO5 code tables (machine block); §2 registered plans and seeds; §3 outcomes per objective; §4
labelling populations, caps and budget; §5 interval rule; §6 SO5 factors, tests and Holm families; §7 flag columns;
§8 missingness and exclusions; §9 what is fixed by registration; §10 reporting duties; §11 amendments.

## 1. SO5 code tables (frozen at registration)

Two closed code sets describe E1 outcomes. They are disjoint from each other and from the instrument root-cause
codes `RC-*` of `Docs/matching-rule.md` (BR-U5b-30).

**Failure-pattern families (`FPAT-*`)**. Every compiled template id maps to exactly one family; the two judge
dimensions map to their own family. Families are counted per E1 cell on violations labelled TP-class (`TP` or
`unseeded-TP`, each weighted by the inverse of its P3 inclusion probability; nothing is seeded in P3, so the two
labels are one class, ADR-020 item 2), and on failing judge units, by dimension (weight 1, from the judge's own
verdict). No labeller assigns a pattern code; the family is a function of the function id only (BR-U5b-64). The
family counts are a pre-specified rule-family profile, not a derived failure taxonomy (§10, B4).

| Family | Meaning | Templates / judge dimension |
|---|---|---|
| `FPAT-DEP-DIRECTION` | a dependency points against the layer model | `dependency-direction`, `no-layer-skip`, `no-domain-outward-dep` |
| `FPAT-FRAMEWORK-LEAK` | framework or outer-layer types inside the domain or exposed by controllers | `domain-purity`, `controller-no-entity` |
| `FPAT-CYCLE` | an import cycle | `no-cyclic-deps` |
| `FPAT-COUPLING` | coupling and stability metrics out of bounds | `domain-stability`, `module-fan-out`, `component-instability`, `max-fan-in`, `abstraction-ratio`, `no-orphan-files` |
| `FPAT-SOLID` | SOLID proxies (inversion, responsibility, segregation, inheritance) | `dependency-inversion`, `single-responsibility-proxy`, `interface-segregation-proxy`, `inheritance-depth` |
| `FPAT-NAMING` | naming conventions of the layer roles | `naming-conventions`, `naming-services`, `naming-repos`, `naming-controllers` |
| `FPAT-PATTERN` | pattern and convention structure (repositories, use cases, tests, barrels) | `repository-pattern`, `use-case-isolation`, `test-file-pairing`, `no-index-logic` |
| `FPAT-DATAFLOW` | domain state reached by an outer-layer data flow | `domain-state-purity` |
| `FPAT-SEMANTIC` | failing Semantic judge units | judge dimension `semantic` |
| `FPAT-INTEGRITY` | failing Integrity judge units | judge dimension `integrity` |

**Generation-outcome codes (`GEN-*`)**. Each U5a `failureReason` (BR-U5a-48) maps to exactly one code; a cell with
`status = 'ok'` carries none. File range and permission denials are flag columns on every cell
(`file_count`, `file_count_in_range`, `permission_denials`), not codes; an `ok` cell out of range is evaluated and
flagged.

| `failureReason` | Code |
|---|---|
| `typecheck` | `GEN-TYPECHECK` |
| `agent-error` | `GEN-AGENT-ERROR` |
| `model-mismatch` | `GEN-MODEL-MISMATCH` |
| `skeleton-tampered` | `GEN-SKELETON-TAMPERED` |
| `infrastructure` | `GEN-INFRA` |
| `envelope-unreadable` | `GEN-ENVELOPE-UNREADABLE` |
| `timeout` | `GEN-TIMEOUT` |

**Join codes (amended 2026-10-09 for P-U6, ADR-021 SO5-03, SO5-05).** Two not-run codes come from the join of a grid
coordinate with its outcome, not from a U5a `failureReason`, so they sit outside the table and the block:
`GEN-MISSING` (no `generation.json` for the coordinate, or no RunRecord at all) and `GEN-PROTOCOL-MISMATCH` (an
outcome that breaks the registered generator plan). Both appear in `so5_grid.csv` `gen_code` and `so5_patterns.csv`.

The block below is the machine-readable form that `scripts/lib/so5-codes.ts` loads. The tables above and the
block are equal (tested); the GEN mapping and the FPAT counting of `scripts/aggregate.ts` read only the block.

```yaml so5-codes
version: 1.0.0
fpatFamilies:
  - FPAT-DEP-DIRECTION
  - FPAT-FRAMEWORK-LEAK
  - FPAT-CYCLE
  - FPAT-COUPLING
  - FPAT-SOLID
  - FPAT-NAMING
  - FPAT-PATTERN
  - FPAT-DATAFLOW
  - FPAT-SEMANTIC
  - FPAT-INTEGRITY
functionFamilies:
  dependency-direction: FPAT-DEP-DIRECTION
  no-layer-skip: FPAT-DEP-DIRECTION
  no-domain-outward-dep: FPAT-DEP-DIRECTION
  domain-purity: FPAT-FRAMEWORK-LEAK
  controller-no-entity: FPAT-FRAMEWORK-LEAK
  no-cyclic-deps: FPAT-CYCLE
  domain-stability: FPAT-COUPLING
  module-fan-out: FPAT-COUPLING
  component-instability: FPAT-COUPLING
  max-fan-in: FPAT-COUPLING
  abstraction-ratio: FPAT-COUPLING
  no-orphan-files: FPAT-COUPLING
  dependency-inversion: FPAT-SOLID
  single-responsibility-proxy: FPAT-SOLID
  interface-segregation-proxy: FPAT-SOLID
  inheritance-depth: FPAT-SOLID
  naming-conventions: FPAT-NAMING
  naming-services: FPAT-NAMING
  naming-repos: FPAT-NAMING
  naming-controllers: FPAT-NAMING
  repository-pattern: FPAT-PATTERN
  use-case-isolation: FPAT-PATTERN
  test-file-pairing: FPAT-PATTERN
  no-index-logic: FPAT-PATTERN
  domain-state-purity: FPAT-DATAFLOW
judgeDimensions:
  semantic: FPAT-SEMANTIC
  integrity: FPAT-INTEGRITY
genCodes:
  typecheck: GEN-TYPECHECK
  agent-error: GEN-AGENT-ERROR
  model-mismatch: GEN-MODEL-MISMATCH
  skeleton-tampered: GEN-SKELETON-TAMPERED
  infrastructure: GEN-INFRA
  envelope-unreadable: GEN-ENVELOPE-UNREADABLE
  timeout: GEN-TIMEOUT
```

## 2. Registered plans and seeds

Each registered `ExperimentPlan` lives at `experiments/<plan-id>/plan.json` with its cassette directory
`experiments/<plan-id>/cassettes` (BR-U5b-56) and validates against `scripts/lib/schemas/experiment-plan.schema.json`.
Results are written to `results/<plan-id>/` only when the registered plan runs through `run-experiment`, after the
pre-registration gate (BR-U5b-50). Judge modes pin the judge of `Docs/judge-preregistration.md`
(`claude-cli`, `claude-opus-5-5`, actual-model rule); a report whose judge differs is rejected
(`judge-model-mismatch`, BR-U5b-45).

| Plan id | Experiment | Mode | Entries at registration | Seeds (sampling / bootstrap / permutation) |
|---|---|---|---|---|
| `fixtures` | fixtures | `full` | the five C16 fixtures (`fixtures/correct-reference`, `fixtures/variant-a-structural`, `-b-pattern`, `-c-everything`, `-d-subtle`) with `specs/clean-arch.yaml` | 1101 / 1102 / 1103 |
| `latency-gate` | latency-gate | `symbolic-only` | ghostfolio `apps/api` with `corpus/specs/ghostfolio-test.yaml` | 2101 / 2102 / 2103 |
| `sensitivity` | sensitivity | `symbolic-only` | none yet; `fixAttempts: []` | 3101 / 3102 / 3103 |
| `so4-heldout` | SO4 | `symbolic-only` (ADR-020 item 5; was `full`) | the seven frozen held-out bases as baseline entries, each with its corpus spec (P-U6, ADR-021 item 5): `realworld-test`, `ghostfolio-test` `apps/api`, `truthy-demo`, `dry-run-test`, `zhuravlevma__nestjs-active-record`, `nestjslatam__ddd`, `v-aguiar__valex`; the seeded entries follow `mutate` (below) | 4101 / 4102 / 4103 |
| `e1-grid` | E1 | `full` | the `e1` block: 3 models × 3 spec levels × 2 tasks × 3 runs = 54 cells | 5101 / 5102 / 5103 |
| `e7-corpus` | E7 | `full` | the four core projects (`realworld-test`, `ghostfolio-test` `apps/api`, `truthy-demo`, `dry-run-test`) and the three frozen E7 bases (P-U6, ADR-021 item 5): `zhuravlevma__nestjs-active-record`, `nestjslatam__ddd`, `v-aguiar__valex` | 7101 / 7102 / 7103 |
| `apg-ablation` | SO2 ablation (ADR-021 SO2-5, X-2, item 8) | `symbolic-only` | 18 entries: the full arm and the `ast-only` arm (`graphMode`, the IMPORTS / DECLARES / CONTAINS allow-list over the full extraction) of the four core bases and the five fixtures; MO-DF01 seeded copies are not added (P-U6 decision, `Docs/threats-to-validity.md` TV-96) | 8101 / 8102 / 8103 |

**Paths.** Corpus projects are read from `../daedalus-corpus/<name>` relative to the repository root, the
destination of `fetch-corpus --dest ../daedalus-corpus` (pinned SHA, overlays and install policy of
`corpus/corpus.json`, BR-U5b-66, 67). E1 generation outcomes are read from `../daedalus-e1-outcomes`
(`<outRoot>/<modelId>/<taskId>/<specLevel>/run-<i>/`, the U5a cell layout; the generator writes outside the
repository, BR-U5a-42). Both directories are outside every checkout and are never committed.

**E1 grid.** Models `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-4-5` (one per current Claude tier; ADR-017
item 3), spec levels `none`, `minimal-prose`, `full-aac`, tasks `task-management` and `order-fulfilment`, runs 3,
style `clean-architecture`. Every spec level of a task is evaluated with one evaluator spec, `specs/clean-arch.yaml`
(the generator's folder layout `src/domain`, `src/application`, `src/infrastructure` is that spec's layer model;
BR-U5b-53, U4 CTX-07). The model pins are confirmed at the generator-protocol freeze (`Docs/generator-protocol.md`,
after the pilot); a different pin is a version bump of this file and of `experiments/e1-grid/plan.json` with a
reason, before the first E1 run.

**Entries added later.** The SO4 seeded entries (`seed` references to the U5a manifest) and the SP-* probe entries
of `sensitivity` exist only after Build and Test has run the FR-18 re-baseline, `prepare-bases` and `mutate`. A
seeded `so4-heldout` entry names `seed.baselineReportPath = reports/<runId>.json` of the baseline entry of the same
base, `runId = runIdOf('so4-heldout', entry)` (ADR-021 item 9, SO4-04), and the case is built by
`build-score-case-cli`. `dev-nest` (10 type errors), `eryzerz__nestjs-ddd` (type errors) and `MarvinRF__nest-docfy`
(excluded for good from SO4, ADR-021 item 5) are not entries. Each addition is registered as a new
`corpus/prereg.json` version with a reason before the first run of that plan; it adds entries and changes no other
field of a registered plan.

## 3. Outcomes per objective

| Objective | Primary outcome | Secondary outcomes (exploratory unless stated) | Output |
|---|---|---|---|
| SO4 instrument validity | seeded differential precision (FP-labelled, `Docs/matching-rule.md` MAT-10 1.1.0), recall and F1 on `split = held-out` seeded instances, overall and per function, dimension, tag (with the `structural / data-flow` sub-row) and project; recall intervals per §5 (cell unit); the pooled E7 row (`base_kind = corpus-e7`, the only unseen stratum) next to the all-bases figure (ADR-020 item 8) | **registered secondary: SO4 baseline precision** (ADR-020 item 1), per function, per corpus tier and overall: the Horvitz–Thompson weighted share of P2 items labelled TP-class (`TP`, `unseeded-TP`), each weighing 1 / p, `uncertain` kept in the denominator as non-TP, with the §5 interval rule; reported beside the differential precision wherever a precision is quoted. Exploratory: precision FP-strict and incl. twins; recall in coverage; twin specificity; `corpus-core` rows; `dev` rows (never pooled with held-out); the neural column `neural_new` (never in symbolic P/R/F1, MAT-19 1.1.0) | `prf_*.csv`, `precision_baseline.csv`, `precision_figure.csv`, `instances.csv`, `twins.csv` |
| SO4 N against the floor (ADR-021 SO4-05) | the golden-set count N = scored held-out golden instances (matched + missed) against the registered 80–120 floor; with `--golden-registered 85` the catalogue's registered total at k = 2 (the 85-vs-80 margin); the overall row carries the ADR-019 item 1 statement (k frozen, actual N, any shortfall a Ch7 deviation, no other lever) | the count per stage (in the case, rejected as a pair, not applicable, site invalid, scored); every seed and every manifest rejection with its stage and reason (the coverage table, MAT-12 step 1) | `golden_instances.csv`, `seed_coverage.csv` |
| SO4 FP / FN analysis | weighted counts per `RC-*` root cause (P1, P2, missed seeds; P3 is not labelled, §4) | mechanical vs labeller FN causes | `fp_fn_taxonomy.csv` |
| SO3 report | per project, the AHS field named by `scoring.verdictSource` of the run's mode, with its verdict | the other AHS fields present; per-dimension AVR; leave-one-dimension-out deltas; sensitivity-only sweeps | `ahs_by_project.csv`, `rescore_*.csv` |
| SO3 neural | judge vs panel agreement on P4 E1 units (weighted, judges of another model family; `headline = true`; ADR-020 item 7) | the same agreement per source (`e1`, `fixture`) and pooled, per E1 generator model, and with `uncertain` kept as a category; run vs run (order sensitivity, §10 B3); panel vs audit (sanity check, B6); judge repetition reliability; judge-probe detection conditional on selection | `agreement.csv`, `judge_probe.csv` |
| SO2 | parse coverage and resolution counts per run; the H13 latency gate decision per plan, from `so2-metrics tables` `gate.json` (the only registered gate source; every RunRecord counts, rejected ones included: a cycle-query timeout is `fallback-required`, an unreadable run `inconclusive`; ADR-021 SO2-1) | per-run latency (`so2/latency.csv`, both cycle queries apart) and the NFR-07 table (`so2/nfr07_latency.csv`, with `profile.csv`); graph size per project by node and edge type and `FLOWS_TO` edges per resolved import (`so2/graph_coverage.csv`, `flows_to_stores.csv`; ADR-021 SO2-4, X-4); the APG-full vs AST-only ablation (`apg_ablation.csv`, `apg_ablation_summary.csv`, descriptive: functions that lose detection; pre-run check `apg_arms.csv`); stage times (aggregate `latency.csv`, descriptive); FLOWS_TO evidence per MO-DF01 seed and twin | `results/<plan>/so2/*` (`scripts/so2-metrics-cli.ts`), `coverage.csv`, `latency.csv`, `edge_evidence.csv` |
| SO1 | denominators per run (declared, ADR-derived, compiled, disabled, dropped, skipped by mode, executed, failed), identities I1 and I2 | per-style P/R/F1 rows: the `style-<s>` strata rows of the `prf_*` files, `s` = the spec's `architecture.style` (the style the instrument evaluates with); the corpus style is a column of `denominators.csv`, `prf_by_project.csv`, `seed_coverage.csv` and `golden_instances.csv`, so the style mismatches (`zhuravlevma__nestjs-active-record`: corpus `layered`, spec `nestjs`) are reported, not hidden (ADR-021 SO1-C, item 9) | `denominators.csv`, `prf_*.csv` |
| SO1 instrument (ADR-021 SO1-E, X-7) | per spec group (corpus, fixture, preset): validator first-pass rate with its Wilson 95 % interval; per built-in style library: template coverage (declared functions with a template ÷ declared) | current pass rate; first-failure error codes; compiled ÷ declared per spec style (ratio of sums); spec line counts (total, blank, comment, content), descriptive only | `so1-metrics-<sha>.json` (`scripts/so1-metrics-cli.ts`) |
| SO5 (E1) | the `verdictSource` AHS of each valid cell (§6); for the model effect, `ahsDeterministic` is co-primary (ADR-020 item 7) | the directional self-preference check (§6, registered); other AHS fields, per-dimension AVR, `FPAT-*` weighted family counts (rule-family profile), valid-generation yield, judge fail share, deterministic violations per KLOC (exploratory, ADR-021 SO5-07, X-3); descriptive per-cell columns: LOC, all violations per KLOC, generation time, turns and cost, instrument time; the open-coding input (§6, exploratory) | `so5_grid.csv`, `so5_patterns.csv`, `so5_tests.csv`; `open-coding-input.json`, `open-coding-key.csv` |
| ADR-016 b | one pass / fail per SP-* probe; exclusion only after a failed probe and a recorded fix attempt | line confirmation | `function_sensitivity.csv` |

SO1 instrument definitions (ADR-021 SO1-E, X-7; `scripts/lib/so1-metrics.ts`). The population is every committed
spec of the BR-U5b-51 spec patterns: `corpus/specs/*.yaml` (group corpus, the registered population of the first-pass
rate), the two fixture specs and `presets/*.yaml`. The *validate check* is the spec part of `validate`: parse and
schema, non-strict business rules, template references, and compilation without errors. The layer-directory check
needs the project checkout and is left out. A spec passes *first time* when the version in the commit that added it
passes the check of the registered instrument; a spec not yet committed counts by its working-tree text. A function
*has a template* when it has a Cypher template (symbolic), a rubric (neuronal), or both (hybrid). A *content line* is a
non-blank line that is not only a YAML comment. These are descriptive SO1 outcomes; no test is run on them.

SO5 size, density and latency definitions (ADR-021 SO5-07, X-3; amended 2026-10-09 for P-U6;
`scripts/lib/so5-size.ts`). The proposal's SO5 metrics "violation density per 1K LOC" and "latency per generated
project" are exploratory columns of `so5_grid.csv`. *LOC* (`loc`) is the number of non-blank lines (a line with at
least one non-whitespace character; comments count) of the `src/**/*.ts` files that `file_count` counts (BR-U5a-48),
measured by `run-experiment` over the tree it evaluates and stored in the cell. *Density* is violations × 1000 / LOC:
`violations_per_kloc` on the deterministic violations of the report (`Violation.deterministic`), the exploratory
secondary family `secondary:violations_per_kloc` of `so5_tests.csv` (§6); `violations_total_per_kloc` on all report
violations, judge violations included, descriptive only. Both are empty for a cell without a report or with LOC 0.
*Generation latency* is `generation_ms` (`generation.json` `durationMs`, the harness wall time of the cell), with
`generation_turns` and `generation_cost_usd` from the CLI envelope; *instrument latency* is `eval_total_ms` (the
report's `timings.totalMs`, the sum of the pipeline stage times). The latency columns are descriptive; no test is run
on them.

SO2 sources and definitions (ADR-021 SO2, item 8; registered 2026-10-09 for P-U6). The SO2 tables are written by
`scripts/so2-metrics-cli.ts` from harness output directories and the extractor, never by hand: `tables --run-dir
results/latency-gate` gives `latency.csv` (one row per RunRecord, rejected and not-run included), `graph_coverage.csv`
and `gate.json`. **The NFR-07 table** is `nfr07_latency.csv` of `tables --run-dir results/latency-gate --run-dir
results/apg-ablation` (B&T plan Step 25): both plans are symbolic-only and run right after P-U6; the full-APG arm of
`apg-ablation` covers the three in-scope bases (≤ 300 files), the AST-only arm is left out (`nfr07Rows`), and the
PROFILE timings (`profile.csv`) give the per-query split. **The gate source** is `results/latency-gate/so2/gate.json`
only. The aggregate's `latency.csv` is descriptive: accepted runs only, one row per report stage, `total_ms` the
pipeline total (`timings.totalMs`), the universal cycle metric's sub-stage row marked `within_stage = compute-scores`
(it is inside that stage, never summed with it), `cycle_queries_sum_ms` the sum of both cycle queries, and
`gate_result_unregistered` a per-run indication that is not the H13 gate. **Graph size** counts the evaluated graph:
every extraction applies the spec's `default_exclude_paths` (`readSpecExcludePaths`), as the pipeline does.
**`FLOWS_TO` per resolved import** = `FLOWS_TO` edges ÷ `importResolution.resolvedInternal`, descriptive. **The
ablation** compares, per base, the violations of the full arm and the `ast-only` arm (the IMPORTS / DECLARES /
CONTAINS edges and the Package nodes they target, a post-filter over the unchanged full extraction; import
resolution and the counts are the full extraction's), and lists the functions that lose detection; descriptive, no
test. `so2-metrics arms` exits 1 before the run when any base's pair of arms is identical. **Type-resolution rate**
(X-4): not defined as a separate metric. The APG records import resolution (`coverage.csv`: resolved internal,
external, out-of-root alias, unresolved, dropped, dynamic) and the type-checker edges (CALLS, EXTENDS, IMPLEMENTS,
CONSTRUCTOR_INJECTS) without a per-reference resolution outcome, so a rate would have no measured denominator; the
proposal's rate is declared dropped and replaced by the import-resolution counts (`Docs/threats-to-validity.md` §3).

Probe rows (`split = probe`) never enter a P/R/F1 table (BR-U5b-20, 78). `dev` is never pooled with `held-out`; the
headline SO4 table is `held-out`, reported per `baseKind` (`corpus`, `generated`), per corpus tier (`corpus-core`,
`corpus-e7`) and as a held-out total. The core corpus was seen during development (`Docs/corpus.md`; ADR-015 item 7,
ADR-017 item 4), so E7 is the only unseen stratum and its pooled row is reported next to the all-bases figure
(ADR-020 item 8). The E7 specs come from the registered mechanical directory-to-layer rule
(`Docs/e7-spec-rule.md`), fixed before any feasibility count and never edited afterwards; the domain-layer remap and
the E7 specs are declared floor-motivated (ADR-020 item 4).

## 4. Labelling populations, caps and budget

The labeller (`scripts/llm-label.ts`, Gemini with a pinned id of a different family from the judge) labels the
populations below; each sampled item stores its inclusion probability p = min(1, cap / stratum size), and sampling
uses the plan's `sampling` seed (BR-U5b-33, 63).

| Population | Items | Stratum | Cap |
|---|---|---|---|
| P1 | FP-strict and twin-FP violations of seeded copies | — | exhaustive |
| P2 | corpus baseline violations | (project, function) | 20 |
| P3 | E1 generated-project violations (out of live labelling since P-U6, ADR-021 item 8.1) | (cell, function) | 20 (live: 0) |
| P4 | judge units of run index 0 of every valid E1 cell and of the five fixtures in full mode | (cell, dimension) | 10 |
| missed seed | FN seeds that no mechanical rule (`Docs/matching-rule.md` §7) resolves | — | exhaustive |

**Budget (OI-7).** `labellingBudgetCalls = 4000` (2 000 items × 2 runs), registered in `corpus/prereg.json`. P1 and
missed seeds are labelled first; the remaining capacity goes to P2–P4 by lowering their caps by one common factor
(BR-U5b-34). Reasoning, from the cap-derived bound because no report exists at registration: P4 is at most
(18 run-0 cells + 5 fixtures) × 2 dimensions × 10 = 460 items; P1 plus missed seeds is planned at no more than
360 items for 80–120 held-out instances (up to two unexplained new violations and one unresolved FN each); the
remaining 1 180 items or more go to P2 and P3. `llm-label --estimate` is run on the real label plan before any live
call; it refuses (exit 1) when P1 and missed seeds alone exceed the capacity, and a larger budget is then a version
bump with a reason, before live labelling.

**P4 judge verdicts (ADR-020 item 7).** The judge verdicts compared with the panel are derived from the stored runs,
never typed by hand: `llm-label --agreement --judge-runs results/e1-grid,results/fixtures`
(`scripts/lib/judge-verdicts.ts`). A run counts when it is `accepted` with a stored report; an E1 run counts only as
run index 0 of a cell with `generationStatus = 'ok'` and gives `source = 'e1'` and `generator_model` = the cell's
`requestedModelId`; a run of the `fixtures` plan gives `source = 'fixture'`; no other run is a P4 source. Each
`neuralResults[]` unit with `status = 'valid'` and verdict `pass` or `fail` is one verdict, its judge model the
report's `judge.model`. A hand-supplied `--judge-verdicts` file is refused (`LABEL_VERDICT_SOURCE_MISSING`) when any
verdict lacks `source`, so the E1 headline row and the B3 row never fall back to the pooled set silently.

**Registered live sizes (ADR-021 items 6 and 8, amended 2026-10-09 for P-U6).** The agy route
(`Docs/labeller-route.md`) allows about 180 label calls a week, so the live plan is sized explicitly by
`corpus/label-plan-config.json` (version 2, a registered artefact) instead of by the cap-derived bound above; the 4000
calls of `corpus/prereg.json` stay a ceiling, not a target.

| Item | Registered value |
|---|---|
| Call ceiling, both runs, re-asks and retries included | 300 (`budgetCalls`), of which 30 are held back for the one re-ask per answer and the provider retries; the budget counts **agy invocations**, retries included (item 8.7), and no call is sent unless two invocations still fit |
| P4 | 1 unit per (cell, dimension) stratum, at most 46 items: (18 run-0 cells + 5 fixtures) × 2 dimensions; stratum draw SRS when they do not all fit |
| P2 | 1 violation per (project, function) stratum, at most 30 items (P3's 10 calls moved here, item 8.1); stratum draw **PPS by stratum size** (item 8.3) |
| P3 | 0: out of live labelling (item 8.1); its strata stay in the plan with their sizes |
| P1 + missed seeds | exhaustive, planned at no more than 59 items: (46 + 30 + 0 + 59) × 2 + 30 = 300. Basis (item 8.2): the FR-24 freeze gate on the fixture (22 positive and 11 twin rows on `correct-reference`) gave 0 new keys outside the expected keys and declared collateral, so 0 FP-strict items per fixture instance; no corpus FP count exists before the so4-heldout run; 59 allows 0.69 items per held-out instance (85) |
| Escalation (item 8.2) | if P1 + MS exceed the 135 items of 300 calls, the budget becomes the smallest whole number of weeks × 180 calls (from 2 weeks, 360 calls) whose capacity holds P1 + MS and the sampled ceilings, at most `maxWeeks` = 4 (720 calls); only then are sampled ceilings lowered; past 4 weeks P1 + MS are thinned by one seeded simple random sample with p = capacity / (P1 + MS) and the gap is a limitation. No plan is refused for its size |
| Priority when the budget binds | P4, then P2, then P3: ceilings are lowered in the order P3, P2, P4 (ADR-021 item 7); P4 (judge-vs-panel agreement) takes priority over P2, and P2 over P3 |
| Context ceiling per item kind (item 8.6) | violation and missed-seed items 6 000 characters (the 31-line window, the rule text, the options); judge units 32 000 characters (the judge's `codeSnippet` budget of 8 000 tokens × 4 characters: the unit source and the rubric); `build-label-plan` reports `context.cut` by kind |
| Quota schedule | at least 2 weeks at 180 calls a week |
| Seeds | stratum draw 6101, run-1 order and option permutations 6103, agreement bootstrap 6102, blinded audit draw 6105 (`seeds.audit`, item 8.5) |

When a population has more strata than its ceiling allows, `m = ⌊maxItems / perStratum⌋` of its `M` strata are
drawn, then `min(perStratum, N_h)` items inside each drawn stratum by the within-stratum draw of BR-U5b-33 under the
`sampling` seed of the plan that produced the run (`e7-corpus` for P2, `e1-grid` for E1 units, `fixtures` for
fixture units; P1 and missed seeds are censuses and are not sampled). The stratum draw is SRS (seed 6101, `pi_h =
m / M`) for P4 and **PPS** for P2: strata with `m N_h / N ≥ 1` are taken with certainty, the others are drawn by
systematic PPS over a seeded order with `pi_h = m' N_h / N'`, so with one item per stratum every non-certain P2 item
has the same inclusion probability `m' / N'` and the sample is self-weighting. The inclusion probability is `p = pi_h
· min(perStratum, N_h) / N_h`. **Precision stated before any run (item 8.3).** `build-label-plan` prints, per row, the
nominal n, the Kish effective n `n_eff = (Σw)² / Σw²` of the design weights w = 1 / p, and the Wilson 95 % half-width
at `n_eff` (at p = 0.5 and 0.85; counts only when `n_eff < 10`): the P4 judge-vs-panel E1 headline (the E1 units, at
most 36 = 18 run-0 cells × 2 dimensions; with equal weights n_eff = 36 gives ±0.155 at p = 0.5 and ±0.116 at
p = 0.85), the P4 fixtures (at most 10), P4 per E1 generator model (at most 12 each), P2 overall (30: n_eff ≤ 30 when
every stratum is kept with p = 1 / N_h, = 30 for a PPS draw without certainty strata: ±0.168 at p = 0.5), and the P1
and MS censuses. Unequal weights lower n_eff, so the printed widths are those of the real plan, not lower bounds.
The FP/FN taxonomy and the agreement statistics are reported with these widths.

**Plan producer (ADR-021 SO3-2, SO4-02, SO3-3).** `scripts/build-label-plan-cli.ts` builds the label plan from stored
outputs only: P1 items and the `missed` instances from `score-golden --label-items` on the `so4-heldout` case; the
mechanical FN causes of `Docs/matching-rule.md` §7 (written to `fn-causes.json`, the remainder becoming missed-seed
items); P2 from the accepted `e7-corpus` runs; P3 and P4 from the accepted `e1-grid` runs and P4 also from the
`fixtures` runs; and the P4 judge verdicts (`judge-verdicts.json`, the `--judge-verdicts` input, with `source` and
`generator_model` as above). Contexts are read from the stored source trees; no project is re-extracted and no
model is called. `llm-label` reads the plan's labeller route (`agy`, `gemini-3.1-pro-high`), its permutation seed and
its budget, stops at the budget (`LABEL_BUDGET_STOP`), and `llm-label --usage` reports the measured input tokens per
call from the recorded cassettes. Its output (`ReconciledLabel[]`) is read directly by `score-golden --labels` (P1;
every P1 item of the score must carry a label, `SCORE_LABELS_MISSING`) and by `aggregate --labels` (P3, keyed by the
E1 run id; a label that matches no E1 record is refused; a labels file without P3 labels gives no row, so the
label-dependent FPAT values are N/A, item 8.1). `instances.csv` `fn_root_cause` / `fn_cause_source` take the mechanical cause, else the
reconciled missed-seed label (`labeller`).

The 30-item blinded audit, its floor of 3 per stratum and its round-robin allocation are `Docs/matching-rule.md` §8.
Since P-U6 (item 8.8) it is drawn from the label plan before the live labelling run, stratified by item kind ×
population, with the registered audit seed 6105 (`llm-label --allocate-audit` refuses another seed and refuses
labels); `uncertain` items are no longer excluded.

## 5. Interval rule

Clusters are projects (E1: generation cells). With 10 or more clusters, the cluster percentile bootstrap (10 000
resamples, the plan's `bootstrap` seed) is primary for P, R, F1 and the weighted P2–P4 estimates; with fewer than 10
clusters, Wilson 95 % intervals on instances are primary (Clopper–Pearson exact when the count is 0 or n), and the
cluster bootstrap is a sensitivity column. Every interval column names its method (`ci_method`). A cell with
n < 10 reports counts only. Per-project values are always reported (BR-U5b-61). Stored figures keep full precision;
CSV floats are written with six decimals and rounding happens only at display (BR-U5b-63).

**SO4 recall (amended 2026-10-08, ADR-020 item 3).** The k copies of one operator on one base are not independent,
so the recall interval unit is the **(project, operator) cell**, with cell recall = detected / k. Primary
(`ci_low`, `ci_high`, `ci_method`, `n_clusters` = cells): with 10 or more cells the cluster percentile bootstrap over
cells (`cell-bootstrap`); with fewer, Wilson on the pooled recall with n = the number of cells (`wilson-cells`;
`clopper-pearson-cells` when the pooled recall is 0 or 1). The project cluster bootstrap (`ci_project_*`) is
reported from 2 projects and is **co-primary only with 10 or more projects**, the cluster floor of the rule above;
with 2 to 9 projects a percentile bootstrap over so few clusters does not reach 95 % coverage (2 projects give a
three-point resampling distribution), so the column is **descriptive** and flagged `ci_project_descriptive = true`
(`false` when co-primary, empty without an interval). With the five core projects, and with fewer than 10 projects
in any stratum, the cell interval is the only primary recall interval. The instance Wilson interval (`ci_independent_*`) is reported only as the
"if independent" bound. Per-function rows use the seeds for which the function is applicable. The n < 10 rule
applies to instances.

**SO4 precision and F1 (ADR-021 SO4-06, item 9; registered 2026-10-09 for P-U6).** The unit is the (project,
operator) cell, not the project. A row with 10 or more cells gets the cell percentile bootstrap as its primary
interval for both precision (`precision_ci_*`) and F1 (`f1_ci_*`); this is expected for the overall held-out row
(about 40 cells at k = 2, 85 instances) and for most dimension and tag rows. A row with fewer than 10 cells (the
per-project rows and some per-function rows) gets Wilson on the pooled precision with n = cells (Clopper–Pearson at
0 or 1) and no primary F1 interval: F1 is not a binomial proportion and never gets a Wilson interval. With 7 held-out
projects the project cluster bootstrap stays descriptive in every row. Wilson on the TP + FP violations is reported
only as the "if independent" bound of precision. Precision counts the cells with TP + FP > 0 and F1 the cells with
TP + FP + FN > 0; below n = 10 cells, counts only. The basis is the labelled mode (FP-labelled) when labels exist,
on every row including the per-project rows (rebuilt from the instances' item labels), else strict
(`precision_f1_ci_basis`).

**Weighted proportions (ADR-020 item 1, B3).** The baseline precision and the weighted P2–P4 estimates are
Horvitz–Thompson ratios Σ w·y / Σ w with w = 1 / p. With 10 or more project clusters the cluster bootstrap is primary;
with fewer, Wilson on the Kish effective size n_eff = (Σw)² / Σw² (`wilson-kish`; `clopper-pearson-kish` on ⌊n_eff⌋
at 0 or 1), the bootstrap as sensitivity. The judge-vs-panel and panel-vs-audit agreement CIs are a weighted item
bootstrap (ADR-021 THR-6, amended 2026-10-09 for P-U6): items are resampled with replacement (10 000 resamples, the
label plan's bootstrap seed 6102), the statistic is the weighted agreement Σ w·[a = b] / Σ w, and the interval is
the 2.5 and 97.5 percentiles (`weighted-item-bootstrap`); a row with fewer than 10 pairs reports counts only
(`counts-only`). The unweighted run-vs-run row keeps Wilson. **κ and AC1 intervals (ADR-021 item 8.4,
P-U6):** every pairwise agreement row with 10 or more pairs (run vs run, judge vs panel, panel vs audit) gets 95 %
percentile intervals of Cohen's κ and Gwet's AC1 from the same item bootstrap (the bootstrap seed 6102, 10 000
resamples, each resample's weighted table; a resample whose κ is undefined is skipped): `kappa_ci_low`,
`kappa_ci_high`, `ac1_ci_low`, `ac1_ci_high`. The labeller validity criterion (ADR-021 SO3) is judged on the run-vs-run
κ **point estimate**: κ ≥ 0.60 keeps the FP/FN taxonomy as registered, κ < 0.60 makes it descriptive only
(`taxonomy_rule` = `as-registered` / `descriptive-only`); the interval is reported beside it. Judge repetition reliability groups cassette entries by
(function, project, unit, request hash), so units of different projects never pool (ADR-021 SO3-5).

## 6. SO5 factors, tests and Holm families

- **Unit of analysis**: one valid E1 cell (an `accepted` run of a generation with `status = 'ok'`).
- **Primary outcome**: the AHS field named by the E1 plan mode's `scoring.verdictSource` (`ahsCombined` in `full`
  mode). The other AHS fields are reported as values and analysed as secondary outcomes (BR-U5b-65).
- **Factors**: model (3 levels) and spec level (3 levels); task is a blocking factor; the three runs are replicates.
  The generator (Claude Code headless) has no temperature or seed setting, so the proposal's "fixed temperature and
  seed" cannot hold: the three runs are replicates of a stochastic generator and their spread is part of the
  within-cell variance (declared deviation, ADR-021 SO5-07; `Docs/threats-to-validity.md` TV-78).
- **Tests**: permutation tests, 10 000 permutations with the plan's `permutation` seed, for the model main effect, the
  spec-level main effect and the model × spec-level interaction. **Strata (amended 2026-10-09 for P-U6, ADR-021
  THR-4)**: each main effect permutes its labels within the strata of task × the other factor, model labels within
  (task, spec level) and spec-level labels within (task, model), so an unequal number of valid replicates across the
  18 cells cannot carry one factor's effect into the other factor's test. The statistic is unchanged (the
  between-level sum of squares of the tested factor). The interaction test keeps task as its only block (was: every
  test restricted within task).
- **Holm families**: the primary outcome's three tests form one family (Holm-corrected, confirmatory). Each
  secondary outcome (each other AHS field, each per-dimension AVR, each `FPAT-*` weighted family count, the
  valid-generation yield, the judge fail share) forms its own family of three tests, Holm-corrected within that
  family and labelled exploratory (`so5_tests.csv` `exploratory = true`).
- **Co-primary (ADR-020 item 7)**: for the model effect, `ahsDeterministic` is co-primary with the verdict-source
  field (`ahsCombined` in `full` mode): its three tests form their own Holm family, the model test is confirmatory
  (`so5_tests.csv` family `co-primary:ahsDeterministic`, `exploratory = false`), the other two exploratory. The judge
  is a Claude model judging Claude-generated code, so a model effect seen only in the judge-bearing field is not read
  as a model effect.
- **Directional self-preference check (registered, ADR-020 item 7)**: per valid cell d = `ahsNeuronal` −
  `ahsDeterministic`; statistic = mean(d | model = the judge model `claude-opus-5-5`) − mean(d | other models);
  one-sided permutation test (greater), model labels permuted within (task, spec level) (THR-4; was: within task), 10 000 permutations with the plan's
  `permutation` seed, α = 0.05, a family of one; Cliff's δ of the two d samples. A positive significant result is
  reported as evidence of judge self-preference; `so5_tests.csv` family `directional:ahsNeuronal-minus-ahsDeterministic`.
- **Effect sizes**: pairwise mean-AHS differences between factor levels with cluster-bootstrap 95 % intervals
  (resampling runs within cells) and Cliff's δ. The pairwise intervals resample three replicates within each cell and
  have no multiplicity control, so they are **descriptive only** (`descriptive = true`, ADR-020 item 6); inference
  rests on the Holm-corrected permutation p-values and Cliff's δ.
- **Significance level**: α = 0.05 after Holm.
- **Family counts** (`FPAT-*`, §1): TP-class violations (`TP`, `unseeded-TP`) weighted by 1 / p of P3 (ADR-020 item 2;
  was: `TP` weight 1), failing judge units by dimension. No labeller assigns a pattern code. **P3 is out of live
  labelling (ADR-021 item 8.1, P-U6):** without P3 labels the label-dependent families (the eight template families)
  are **N/A** per cell (an empty `so5_grid.csv` `fpat_*` value, never 0) and enter no test; the two judge families
  are counted as before. Ch9 reports the FPAT profile from the **symbolic counts**: `so5_patterns.csv` rows with
  `basis = symbolic` count every symbolic violation of a cell in its function's family, unlabelled and unweighted
  (`basis` is `labelled`, `judge`, `symbolic` or `gen`).
- **Exploratory open coding (registered 2026-10-09 for P-U6, ADR-021 SO5-07; Fable B4).** A data-derived failure
  taxonomy beside the FPAT profile, **exploratory only**: it never enters a test, a Holm family or a confirmatory
  claim, and it never changes the FPAT counts.
  1. *Input.* `scripts/so5-open-coding-cli.ts --labels <reconciled.json> --runs results/e1-grid --out <dir>` prepares
     it from stored outputs only (`scripts/lib/so5-open-coding.ts`). Items: the reconciled labeller items of E1 runs
     whose label says a violation is present, P3 violations labelled `TP` or `unseeded-TP` and P4 judge units labelled
     `fail`; each gives its rule (template name, else function id), its kind and the non-empty rationales of the two
     labeller runs. The items are blind to the condition: model, spec level, task, run, project and item ids are not
     in the input; inside the rationales every E1 model id, task id and spec level (except the word `none`) and the
     item's run and project ids are replaced by `[redacted]`; the order is a seeded shuffle (seed 6104) of the items
     sorted by item id, and the coding ids `OC-0001…` follow it. `open-coding-key.csv` maps each coding id to its
     item, run, cell, rule, FPAT family and weight 1 / p.
  2. *Proposal.* The agy panel (the labeller route, `Docs/labeller-route.md`) reads the input and proposes short
     failure-pattern codes with a one-line definition and the coding ids each covers. The proposal is recorded as
     produced; it uses calls of the registered label budget (§4) only if budget remains after P1–P4.
  3. *Consolidation.* The author merges, splits and names the proposed codes into a final code book and assigns every
     item one or more codes. The author has seen the rules and the E1 design, so is **declared non-blind**; the key is
     read only after the code book is fixed.
  4. *Reporting.* Code frequencies, raw and weighted by 1 / p, per model and spec level, descriptive only, next to
     the FPAT profile and labelled exploratory. No interval and no test.

## 7. Flag columns

Flags are recorded on every row and never exclude it by themselves:

- E1 cells (`so5_grid.csv`): `file_count`, `file_count_in_range`, `permission_denials`. An `ok` cell out of range is
  evaluated and flagged (BR-U5b-64).
- Seeds (`instances.csv`): `line_confirmed` (confirmatory only, never changes TP / FN), `collateral_keys`,
  `undeclared_new`, `fn_cause_source` (`mechanical` or `labeller`).
- Functions (`prf_by_function.csv`): `not_applicable`, `collateral`, `metric_key_excluded` (empty at registration:
  both U3 metric-key readiness flags are true, `corpus/frozen-instrument.json`).
- Runs (`runs.csv`): `attempt` (a transport-error retry), `reason_code`, every registered hash.
- Labels: `uncertain` with its reason (`disagree`, `invalid-run`); on agreement rows `sameFamily`, `source`,
  `generator_model`, `headline` and `uncertain_as_category` (ADR-020 item 7, B3).
- Seeds also carry `corpus_tier` (`instances.csv`); functions carry `neural_new` and `precision_baseline`
  (`prf_by_function.csv`); `so5_tests.csv` rows carry `descriptive`; every P/R/F1 row carries
  `ci_project_descriptive` (§5).
- Probes (`function_sensitivity.csv`): `excluded_after_fail`, `fix_attempt_ref`.

## 8. Missingness and exclusions

- Every planned entry produces a `RunRecord` (`accepted`, `rejected`, `not-run`, `incomplete`); nothing is dropped
  (BR-U5b-46). `runs.csv` lists all of them.
- **Rejected runs** (`schema-invalid`, `function-failed`, `function-timeout`, `function-truncated`, `metric-failed`,
  `judge-model-mismatch`, `transport-error` after the one retry) give no score. They are declared as excluded runs with
  counts per reason and are never imputed (BR-U5b-45, 47).
- **Not-run cells** carry their `GEN-*` code (§1); they count in the valid-generation yield and in the per-cell
  missingness, never in an AHS analysis.
- **Incomplete runs** (usage limit, unissued judge calls) are resumed from cassettes and are not reported until
  complete.
- **AHS analyses** use valid cells or projects only; the number of valid replicates per (model, spec level, task)
  cell is reported beside every SO5 test. No cell is re-generated to replace a failed one, and no imputation is
  done.
- **Selection on generation success (registered threat, ADR-021 THR-4; `Docs/threats-to-validity.md` TV-30).** AHS
  exists only for generated projects that type-check and are accepted, so every AHS effect is conditional on
  successful generation: a model or spec level that fails more often is compared on its surviving projects only. The
  mitigation is the valid-generation yield family (§6, every coordinate in the denominator, `GEN-*` codes included),
  reported beside every AHS effect, and the stratified permutations of §6.
- **SO4**: a seed pair whose baseline or seeded report is rejected yields no score and is listed with its reason in
  `rejectedPairs` and in `seed_coverage.csv` (stage `pair`; ADR-021 SO4-03); the other pairs are still scored, and the
  case is refused only when every pair is rejected or the operator collateral is unkeyed. Not-applicable and
  site-invalid seeds are kept out of recall (`Docs/matching-rule.md`).
- **Functions**: a function is excluded from a table only after a failed SP-* probe and a recorded fix attempt, with
  the function disabled in a later registered spec version (BR-U5b-78); ghostfolio is never excluded or stratified
  for latency; a failed latency gate triggers the Tarjan fallback in Build and Test (BR-U5b-49).

## 9. Fixed by registration

The registration (`corpus/prereg.json`) fixes this file, `Docs/matching-rule.md` (1.0.0 in v1, 1.1.0 from P-2), the labeller prompts, the
corpus files and specs (after the domain-layer remap), the registered plan files with their seeds, the frozen
instrument export, the labelling budget and the E1 grid shape (3 × 3 × 2 × 3). `run-experiment` refuses a plan when
any registered artefact differs from its registered hash, or when the registration is not older than the plan's
first run (BR-U5b-50).

## 10. Reporting duties (ADR-020 item 9, review B1–B7)

These statements are registered: every report of the corresponding figure carries them.

- **B1 Construct sensitivity and coverage.** The operators are literal negations of the templates, realised as
  synthetic constructs at feasible sites, and the dev declaration gate guarantees the key match. SO4 recall is
  reported as **construct sensitivity** (does the Cypher match the canonical construct), not as detection of
  naturally occurring violations. Every SO4 report states the template coverage (templates with at least one
  operator out of the compiled templates), the structural in-coverage n before and after E7, and that every core
  project is `nestjs`. The P2 items labelled TP-class are named as the only naturally occurring positives.
- **B2 Twin specificity is by construction.** Twin preconditions (controller-or-entity, threshold arithmetic;
  `Docs/operator-catalogue.md`) select sites where the rule should stay silent; specificity is reported as a check
  of those preconditions, not as a false-alarm rate on real code (that is the baseline precision, §3).
- **B3 The panel is one model run twice.** The panel is one Gemini model, two runs at temperature 0 with permuted
  option order; run-vs-run agreement is reported as **order sensitivity**, not inter-rater reliability. Agreement is
  reported with `uncertain` kept as a category beside the row that drops it, and weighted agreement CIs are labelled
  approximate (`wilson-weighted-approximate`).
- **B4 FPAT is a rule-family profile.** The `FPAT-*` counts are a fixed function-to-family map (§1), with judge fails
  counted from the judge's own verdict at weight 1: a **pre-specified rule-family profile**, not a derived taxonomy.
  A derived taxonomy needs an exploratory coding of the labeller rationales, pre-registered with this file, with the
  author declared as a non-blind coder; it is registered in §6 ("Exploratory open coding", P-U6) and is reported as
  exploratory, never as a confirmatory taxonomy.
- **B5 Spec-level and tier confounds.** In `full-aac` the generator receives the evaluator spec verbatim
  (`scripts/generator/prompts/full-aac.md`), so the spec level is confounded with knowledge of the test and with
  prompt length; the model tier is confounded with the model generation (`claude-haiku-4-5` vs the `-5-5` models);
  all generators and the judge are from one vendor. These are stated beside every SO5 effect.
- **B6 The audit is a sanity check.** The 30-item author audit gives 3 to 10 items per stratum and the author sees the
  function id, so it is not blind to the rule. Panel-vs-audit agreement is reported as a sanity check, not as a
  validity estimate.
- **B7 Housekeeping.** Reported once in the methods: `remapLine` is not called by the scorer (`Docs/matching-rule.md`
  MAT-04 note); prereg v1 hashed a DRAFT operator catalogue with `sitesPerOperator` TBD, superseded by the frozen
  catalogue of a later registration; the judge pre-registration stays DRAFT until SEN-01 passes on
  `correct-reference`, and the fixture units it judges are also P4 items; the ghostfolio repair was post-hoc; the
  number of pairs rejected under MAT-25 because a cycle function was truncated is reported (`runs.csv` reason
  counts); every secondary SO5 family is exploratory.

## 11. Amendments

| Date | Section | Change | Source |
|---|---|---|---|
| 2026-10-08 | §3 | SO4 baseline precision registered as a secondary outcome; the differential figure named seeded differential precision; pooled E7 row; neural column | ADR-020 items 1, 5, 8 |
| 2026-10-08 | §1, §6 | TP-class labels (`TP`, `unseeded-TP`) weighted 1 / p in the FPAT counts | ADR-020 item 2 |
| 2026-10-08 | §5 | Recall interval unit = (project, operator) cell; project bootstrap co-primary; instance Wilson as the "if independent" bound; Kish-Wilson for weighted proportions | ADR-020 items 1, 3 |
| 2026-10-08 | §2 | `so4-heldout` mode `symbolic-only` (was `full`) | ADR-020 item 5 |
| 2026-10-08 | §6 | Pairwise CIs descriptive; `ahsDeterministic` co-primary for the model effect; directional self-preference check | ADR-020 items 6, 7 |
| 2026-10-08 | §3, §7 | Judge-vs-panel rows per source (E1 headline) and per generator model; `uncertain` as a category | ADR-020 item 7, B3 |
| 2026-10-08 | §3 | E7 the only unseen stratum; E7 specs from the registered rule, declared floor-motivated | ADR-020 items 4, 8 |
| 2026-10-08 | §10 | Reporting duties B1–B7 | ADR-020 item 9 |
| 2026-10-09 | §4 | P4 judge verdicts derived from the run records (`source`, `generator_model`); verdict files without `source` refused | ADR-020 item 7, B3 |
| 2026-10-09 | §5, §7 | Project cluster bootstrap co-primary only with ≥ 10 projects, else descriptive (`ci_project_descriptive`) | ADR-020 item 3; BR-U5b-61 |
| 2026-10-09 (P-U6) | §4 | Registered live label sizes (`corpus/label-plan-config.json`, 300 calls), two-stage sampling, the plan producer and the label-shape adapters | ADR-021 item 6; SO3-2, SO3-3, SO4-01, SO4-02, SO5-01 |
| 2026-10-09 (P-U6) | §5 | Weighted agreement CIs: weighted item bootstrap, counts only below 10 pairs; reliability subjects keyed by project | ADR-021 THR-6, SO3-5 |
| 2026-10-09 (P-U6) | §1 | Join codes `GEN-MISSING`, `GEN-PROTOCOL-MISMATCH` documented beside the table (the block is unchanged) | ADR-021 SO5-03, SO5-05 |
| 2026-10-09 (P-U6) | §3 | SO5 LOC, violations per KLOC (deterministic: exploratory secondary; all: descriptive), generation and instrument latency columns | ADR-021 SO5-07, X-3 |
| 2026-10-09 (P-U6) | §6 | Main-effect permutations within task × the other factor; directional check within (task, spec level) | ADR-021 THR-4 |
| 2026-10-09 (P-U6) | §6, §10 | Exploratory open coding of the E1 rationales (agy panel proposes, author consolidates, declared non-blind); generator temperature and seed deviation | ADR-021 SO5-07; Fable B4 |
| 2026-10-09 (P-U6) | §8 | Selection on generation success registered as a threat, the valid-generation yield as its mitigation | ADR-021 THR-4 |
| 2026-10-09 (P-U6) | §2 | `so4-heldout` names the seven held-out bases; `e7-corpus` adds the three E7 bases; `apg-ablation` registered (18 entries, MO-DF01 seeds not added); the seeded-entry form | ADR-021 item 5 (Major 1), items 8, 9; SO2-5, X-2, SO4-04 |
| 2026-10-09 (P-U6) | §3 | SO2: `gate.json` the only gate source, the NFR-07 source, graph size, `FLOWS_TO` per resolved import, the ablation, the aggregate `latency.csv` columns; type-resolution rate declared dropped | ADR-021 SO2-1..5, X-2, X-4, item 8 |
| 2026-10-09 (P-U6) | §3 | SO4 N against the floor (`golden_instances.csv`, `seed_coverage.csv`); SO1 per-style rows are the spec-style strata, corpus style a column | ADR-021 SO4-05, SO1-C, item 9 |
| 2026-10-09 (P-U6) | §4 | Label-size corrections: P3 out of live labelling (P2 30, PPS), escalation by whole weeks up to 4 (no refusal), stated P1 + MS basis, Kish effective n per row, per-kind context ceilings, agy invocations counted, registered audit seed, the audit drawn from the plan | ADR-021 items 8.1–8.3, 8.5–8.8 |
| 2026-10-09 (P-U6) | §5 | κ and AC1 intervals from the item bootstrap, the κ < 0.60 rule on the point estimate; SO4 precision and F1 intervals per cell count | ADR-021 item 8.4, SO4-06, item 9 |
| 2026-10-09 (P-U6) | §6 | Label-dependent FPAT values N/A without P3 labels; the profile from symbolic counts (`so5_patterns.csv` `basis`) | ADR-021 item 8.1 |
| 2026-10-09 (P-U6) | §8 | Rejected pairs listed and the rest scored | ADR-021 SO4-03 |
