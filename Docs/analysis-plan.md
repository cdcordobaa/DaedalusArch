# Analysis plan — v1.2E evaluation (SO1–SO5)

> **Status**: registered with `corpus/prereg.json` version 1 (U5b Step 32). Written in U5b Code Generation
> (Step 14: the SO5 code tables; Step 31: the rest, 2026-10-08), before the FR-18 re-baseline, any corpus run and the
> first E1 run (BR-U5b-50, 51, 64; OI-6). This file is a registered artefact: after registration any change to it is a
> pre-registration version bump with a reason (BR-U5b-50), and every earlier run keeps its own `preregVersion`.
> **Requirements**: FR-v1.2E-25, 27, 36; SO1–SO5 (ADR-017 items 1–3, 6, 7); ADR-015 items 1, 2, 5, 10; ADR-016 b, e.
> **Design source**: `aidlc-docs/construction/v1.2E-u5b-scoring-harness/functional-design/business-rules.md`
> (BR-U5b-20, 30, 33, 34, 45..49, 53, 54, 61..65, 78). The matching of seeds to violations is `Docs/matching-rule.md`
> (version 1.0.0); this plan does not restate it. The code lists (`RC-*` there, `FPAT-*` / `GEN-*` here) are disjoint
> (BR-U5b-30).

Sections: §1 the SO5 code tables (machine block); §2 registered plans and seeds; §3 outcomes per objective; §4
labelling populations, caps and budget; §5 interval rule; §6 SO5 factors, tests and Holm families; §7 flag columns;
§8 missingness and exclusions; §9 what is fixed by registration.

## 1. SO5 code tables (frozen at registration)

Two closed code sets describe E1 outcomes. They are disjoint from each other and from the instrument root-cause
codes `RC-*` of `Docs/matching-rule.md` (BR-U5b-30).

**Failure-pattern families (`FPAT-*`)**. Every compiled template id maps to exactly one family; the two judge
dimensions map to their own family. Families are counted per E1 cell on violations labelled `TP` (weight 1) and
`unseeded-TP` (weighted by the inverse of their P3 inclusion probability), and on failing judge units, by
dimension. No labeller assigns a pattern code; the family is a function of the function id only (BR-U5b-64).

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
| `so4-heldout` | SO4 | `full` | none yet | 4101 / 4102 / 4103 |
| `e1-grid` | E1 | `full` | the `e1` block: 3 models × 3 spec levels × 2 tasks × 3 runs = 54 cells | 5101 / 5102 / 5103 |
| `e7-corpus` | E7 | `full` | the four core projects whose corpus spec exists (`realworld-test`, `ghostfolio-test` `apps/api`, `truthy-demo`, `dry-run-test`) | 7101 / 7102 / 7103 |

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

**Entries added later.** The SO4 seeded and baseline entries (`seed` references to U5a manifests and baseline
reports) and the SP-* probe entries of `sensitivity` exist only after Build and Test has run the FR-18 re-baseline,
`prepare-bases` and `mutate`. The E7 entries of `dev-nest` and the added projects need their corpus specs (OI-12).
Each addition is registered as a new `corpus/prereg.json` version with a reason before the first run of that plan;
it adds entries and changes no other field of a registered plan.

## 3. Outcomes per objective

| Objective | Primary outcome | Secondary outcomes (exploratory unless stated) | Output |
|---|---|---|---|
| SO4 instrument validity | precision (FP-labelled), recall and F1 on `split = held-out` seeded instances, overall and per function, dimension, tag (with the `structural / data-flow` sub-row) and project | precision FP-strict and incl. twins; recall in coverage; twin specificity; `dev` rows (never pooled with held-out) | `prf_*.csv`, `instances.csv`, `twins.csv` |
| SO4 FP / FN analysis | weighted counts per `RC-*` root cause (P1–P3, missed seeds) | mechanical vs labeller FN causes | `fp_fn_taxonomy.csv` |
| SO3 report | per project, the AHS field named by `scoring.verdictSource` of the run's mode, with its verdict | the other AHS fields present; per-dimension AVR; leave-one-dimension-out deltas; sensitivity-only sweeps | `ahs_by_project.csv`, `rescore_*.csv` |
| SO3 neural | judge vs panel agreement on P4 (weighted, headline row from a judge of another model family) | run vs run; panel vs audit; judge repetition reliability; judge-probe detection conditional on selection | `agreement.csv`, `judge_probe.csv` |
| SO2 | parse coverage and resolution counts per run; latency gate result | stage times; FLOWS_TO evidence per MO-DF01 seed and twin | `coverage.csv`, `latency.csv`, `edge_evidence.csv` |
| SO1 | denominators per run (declared, ADR-derived, compiled, disabled, dropped, skipped by mode, executed, failed), identities I1 and I2 | per-style P/R/F1 rows | `denominators.csv` |
| SO1 instrument (ADR-021 SO1-E, X-7) | per spec group (corpus, fixture, preset): validator first-pass rate with its Wilson 95 % interval; per built-in style library: template coverage (declared functions with a template ÷ declared) | current pass rate; first-failure error codes; compiled ÷ declared per spec style (ratio of sums); spec line counts (total, blank, comment, content), descriptive only | `so1-metrics-<sha>.json` (`scripts/so1-metrics-cli.ts`) |
| SO5 (E1) | the `verdictSource` AHS of each valid cell (§6) | other AHS fields, per-dimension AVR, `FPAT-*` weighted family counts, valid-generation yield, judge fail share | `so5_grid.csv`, `so5_patterns.csv`, `so5_tests.csv` |
| ADR-016 b | one pass / fail per SP-* probe; exclusion only after a failed probe and a recorded fix attempt | line confirmation | `function_sensitivity.csv` |

SO1 instrument definitions (ADR-021 SO1-E, X-7; `scripts/lib/so1-metrics.ts`). The population is every committed
spec of the BR-U5b-51 spec patterns: `corpus/specs/*.yaml` (group corpus, the registered population of the first-pass
rate), the two fixture specs and `presets/*.yaml`. The *validate check* is the spec part of `validate`: parse and
schema, non-strict business rules, template references, and compilation without errors. The layer-directory check
needs the project checkout and is left out. A spec passes *first time* when the version in the commit that added it
passes the check of the registered instrument; a spec not yet committed counts by its working-tree text. A function
*has a template* when it has a Cypher template (symbolic), a rubric (neuronal), or both (hybrid). A *content line* is a
non-blank line that is not only a YAML comment. These are descriptive SO1 outcomes; no test is run on them.

Probe rows (`split = probe`) never enter a P/R/F1 table (BR-U5b-20, 78). `dev` is never pooled with `held-out`; the
headline SO4 table is `held-out`, reported per `baseKind` (`corpus`, `generated`) and as a held-out total.

## 4. Labelling populations, caps and budget

The labeller (`scripts/llm-label.ts`, Gemini with a pinned id of a different family from the judge) labels the
populations below; each sampled item stores its inclusion probability p = min(1, cap / stratum size), and sampling
uses the plan's `sampling` seed (BR-U5b-33, 63).

| Population | Items | Stratum | Cap |
|---|---|---|---|
| P1 | FP-strict and twin-FP violations of seeded copies | — | exhaustive |
| P2 | corpus baseline violations | (project, function) | 20 |
| P3 | E1 generated-project violations | (cell, function) | 20 |
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

The 30-item blinded audit, its floor of 3 per stratum and its round-robin allocation are `Docs/matching-rule.md` §8.

## 5. Interval rule

Clusters are projects (E1: generation cells). With 10 or more clusters, the cluster percentile bootstrap (10 000
resamples, the plan's `bootstrap` seed) is primary for P, R, F1 and the weighted P2–P4 estimates; with fewer than 10
clusters, Wilson 95 % intervals on instances are primary (Clopper–Pearson exact when the count is 0 or n), and the
cluster bootstrap is a sensitivity column. Every interval column names its method (`ci_method`). A cell with
n < 10 reports counts only. Per-project values are always reported (BR-U5b-61). Stored figures keep full precision;
CSV floats are written with six decimals and rounding happens only at display (BR-U5b-63).

## 6. SO5 factors, tests and Holm families

- **Unit of analysis**: one valid E1 cell (an `accepted` run of a generation with `status = 'ok'`).
- **Primary outcome**: the AHS field named by the E1 plan mode's `scoring.verdictSource` (`ahsCombined` in `full`
  mode). The other AHS fields are reported as values and analysed as secondary outcomes (BR-U5b-65).
- **Factors**: model (3 levels) and spec level (3 levels); task is a blocking factor; the three runs are replicates.
- **Tests**: permutation tests, 10 000 permutations with the plan's `permutation` seed, permutations restricted
  within task, for the model main effect, the spec-level main effect and the model × spec-level interaction.
- **Holm families**: the primary outcome's three tests form one family (Holm-corrected, confirmatory). Each
  secondary outcome (each other AHS field, each per-dimension AVR, each `FPAT-*` weighted family count, the
  valid-generation yield, the judge fail share) forms its own family of three tests, Holm-corrected within that
  family and labelled exploratory (`so5_tests.csv` `exploratory = true`).
- **Effect sizes**: pairwise mean-AHS differences between factor levels with cluster-bootstrap 95 % intervals
  (resampling runs within cells) and Cliff's δ.
- **Significance level**: α = 0.05 after Holm.
- **Family counts** (`FPAT-*`, §1): labelled `TP` violations weight 1, `unseeded-TP` weighted by 1 / p of P3, failing
  judge units by dimension. No labeller assigns a pattern code.

## 7. Flag columns

Flags are recorded on every row and never exclude it by themselves:

- E1 cells (`so5_grid.csv`): `file_count`, `file_count_in_range`, `permission_denials`. An `ok` cell out of range is
  evaluated and flagged (BR-U5b-64).
- Seeds (`instances.csv`): `line_confirmed` (confirmatory only, never changes TP / FN), `collateral_keys`,
  `undeclared_new`, `fn_cause_source` (`mechanical` or `labeller`).
- Functions (`prf_by_function.csv`): `not_applicable`, `collateral`, `metric_key_excluded` (empty at registration:
  both U3 metric-key readiness flags are true, `corpus/frozen-instrument.json`).
- Runs (`runs.csv`): `attempt` (a transport-error retry), `reason_code`, every registered hash.
- Labels: `uncertain` with its reason (`disagree`, `invalid-run`); `sameFamily` on agreement rows.
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
- **SO4**: a seed pair whose baseline or seeded report is rejected yields no score and is listed with its reason;
  not-applicable and site-invalid seeds are kept out of recall (`Docs/matching-rule.md`).
- **Functions**: a function is excluded from a table only after a failed SP-* probe and a recorded fix attempt, with
  the function disabled in a later registered spec version (BR-U5b-78); ghostfolio is never excluded or stratified
  for latency; a failed latency gate triggers the Tarjan fallback in Build and Test (BR-U5b-49).

## 9. Fixed by registration

The registration (`corpus/prereg.json`) fixes this file, `Docs/matching-rule.md` 1.0.0, the labeller prompts, the
corpus files and specs (after the domain-layer remap), the registered plan files with their seeds, the frozen
instrument export, the labelling budget and the E1 grid shape (3 × 3 × 2 × 3). `run-experiment` refuses a plan when
any registered artefact differs from its registered hash, or when the registration is not older than the plan's
first run (BR-U5b-50).
