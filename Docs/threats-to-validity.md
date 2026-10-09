# Threats-to-validity register — v1.2E evaluation (SO1–SO5)

> **Status**: written 2026-10-08 in U6 (lane Docs; ADR-021 item 2, finding THR-9), before any so4-heldout, e7-corpus,
> e1-grid or live-labelling run. It is meant to be a registered artefact. The P-U6 bump (ADR-021 item 4) adds it to
> `REGISTERED_ARTEFACTS` in `corpus/prereg.json`. Until then it is a draft and is not hash-checked. After
> registration, any change is a pre-registration version bump with a reason (BR-U5b-50), and earlier runs keep their
> own `preregVersion`.
> **Purpose**: one place that maps every known threat to validity to (a) its mitigation, which is a registered rule
> enforced by code or by a frozen artefact, or (b) a reporting duty, which is what the thesis must print, and to (c)
> the Ch7–9 section that reports it. The register is also the registered home of the deviation entries that BR-U5b-50
> and ADR-015 item 2 require (§3), and of the governing rules of the judge degradation ladder (§4).
> **Authority**: if a duty is also registered in `Docs/analysis-plan.md` (for example its "Reporting duties" section,
> ADR-020 item 9) or in `Docs/matching-rule.md`, that file is authoritative for *how* the number is computed. This
> register is authoritative for the *threat → handling → section* mapping.

Sections: §1 keys; §2 the register; §3 deviation entries; §4 judge degradation ladder rules; §5 source trace.

## 1. Keys

**Type**: `C` construct validity; `I` internal validity (researcher degrees of freedom, confounding, selection);
`E` external validity (generalisation); `S` statistical-conclusion validity; `R` reliability and reproducibility.

**Handling**: `M:` a mitigation, meaning a registered rule and where it is enforced. `D:` a reporting duty, meaning
what Ch7–9 must state, and with which output. A row may have both.

**Status**:
- `in place`: the rule is on `v1.2e` in code or in a registered artefact.
- `P-M`: implemented and registered by the ADR-020 bump (named P-M by ADR-021 item 2). P-M is merged (PR #17, #22; prereg v3), so its rows read `in place (P-M, prereg v3)`.
- `pending <id>`: owned by U6 under ADR-021 and registered by P-U6. The id is the audit finding in
  `Docs/DiagnosticRuns/so-readiness-audit-2026-10-08.json`. When the lane that closes it merges, the row reads `in place (PR #n)`, and
  its registration half is still P-U6.
- `P-4`: carried by that Build and Test bump. P-1 is committed (prereg v2, `a258db0`), so its rows read `in place (P-1, …)`.
- `P-U6`: decided by ADR-021 item 5 (the Fable verification of P-1) and registered by the P-U6 bump.
- `residual`: there is no mitigation, so the reporting duty is the whole handling.
- `open`: needs an author decision.

**Report section** (the thesis skeleton in `Kap7`–`Kap9`, 2026-10-08):

| Key | Section |
|---|---|
| 7.1 | Golden-dataset construction and violation taxonomy |
| 7.2 | Instrument calibration and threshold derivation |
| 7.3 | Factorial benchmark (LLM × specification quality; E1) |
| 7.5 | Statistical and thematic analysis methods |
| 8.1 | Detection accuracy and AHS validity |
| 8.2 | Cross-model failure-pattern taxonomy |
| 8.4 | Threats to validity |
| 8.5 | Discussion: answering the research questions |
| 9.2 | Limitations |
| 9.3 | Future work |

Rule for §8.4: every row whose status is `residual` or `open` at the time of writing is named in §8.4, even when its
main section is elsewhere.

## 2. The register

### 2.1 Registration and process

| ID | Type | Threat | Sources | Handling | Output / evidence | Status | Report |
|---|---|---|---|---|---|---|---|
| TV-01 | I | Analysis choices are changed after results are seen. | ADR-015 items 1, 2; BR-U5b-50, 51; BR-U5a-40 | M: hash-gated pre-registration. `run-experiment` refuses a plan when a registered artefact changed, when `prereg.json` is uncommitted, or when it is newer than the first run. The catalogue and the generator protocol are frozen before the first run. D: each result names its `preregVersion`; each bump is listed with its reason (§3). | `corpus/prereg.json` `previous[]`; `runs.csv` `prereg_version` | in place | 7.5 |
| TV-02 | I | A threats or deviation entry has no registered home, and the ladder's governing rules are unregistered, so a post-hoc ladder step would be checked only by its values. | THR-9; BR-U5b-50; ADR-015 item 2 | M: this register (§3 deviation entries, §4 ladder rules), registered by P-U6. The ladder values (`judge.effort`, `selection.unitCap`) are already pinned by `corpus/frozen-instrument.json`. | this file; `corpus/prereg.json` | in place (PR #19); registered by P-U6 | 7.5; 8.4 |
| TV-03 | I | The bump label "P-2" has two meanings (the cycle-strategy flip and ADR-020), so a bump can be skipped or committed with the wrong reason. | X-6; ADR-020; ADR-021 item 2 | M: the B&T plan glossary. P-2 is the conditional cycle-strategy flip; the ADR-020 bump is P-M; the order P-1, P-M, P-U6 is fixed. | B&T plan, "Pre-registration bumps" | in place | 7.5 |
| TV-04 | R | The E1 generator plan (pinned full model ids, `orderSeed` 20261008, `allowBash`, `timeoutMs`) is not committed or hashed, so the schedule and the pins cannot be checked. | THR-8; SO5-03; ADR-019 item 6 | M: commit and hash the generator plan (ADR-021 SO5). | `experiments/e1-grid/generator-plan.json` | in place (THR-8, SO5-03, PR #18); hashed by P-U6 | 7.3 |
| TV-05 | R | The labeller route, model id and CLI version are not registered. agy has no temperature setting, so the registered determinism rule (temperature 0) cannot hold. | THR-5; SO3-4; ADR-019 item 4; ADR-021 SO3 | M: register the route `agy`, model `gemini-3.1-pro-high`, CLI 1.1.23 and the determinism amendment. D: run-vs-run agreement under default sampling measures stochastic consistency, not validity. | `corpus/prereg.json`; agreement rows | pending SO3-4 | 7.5; 8.4 |
| TV-06 | I | The ghostfolio-test repair is post hoc. | ADR-019 item 2; Fable B7 | M: only a documented, deterministic preparation step that changes no source file, before the catalogue freeze; the base stays excluded if it still fails its type-check (BR-U5a-07). D: declared as post hoc. | `Docs/corpus.md` "Fetched and prepared bases" | in place | 7.1 |
| TV-07 | I | Specs were corrected after the fixtures were seen: the FF-CV02 pattern, `repository-pattern`, the NestJS controller binding and the domain-layer remap. | U1 §8 items 7, 8, 12; ADR-015 item 1; ADR-017 item 4 | M: the fix/observe rule. Each correction is dated before the first corpus run, scripted, and applied uniformly to every corpus spec. D: reported as construct corrections, not tuning; the remap is declared floor-motivated (ADR-020 item 4). | `Docs/corpus.md` §5; git dates | in place | 7.1 |
| TV-08 | I | E7 specs are an unregistered lever on N and recall: eligibility is a function of the domain glob alone. | Fable A4; ADR-019 item 3; ADR-020 item 4 | M: a registered, mechanical directory-to-layer rule, committed before a single feasibility count; one count; no spec edit afterwards. D: the E7 specs are declared floor-motivated. | `Docs/e7-spec-rule.md`; `Docs/corpus.md` | in place (P-M, prereg v3; P-1, prereg v2) | 7.1 |
| TV-09 | I | Registered artefacts hold draft text: the catalogue (`sitesPerOperator` TBD) is hashed in v1, and the judge pre-registration stays DRAFT until SEN-01 passes. | Fable B7 | M: the catalogue freeze (P-1); the judge freeze dated after a passing SEN-01 (P-4, BR-U4-POL-01). | `Docs/operator-catalogue.md`; `Docs/judge-preregistration.md` "Dated lines" | in place (catalogue, P-1, prereg v2); P-4 | 7.5 |

### 2.2 SO4 construct validity (golden dataset)

| ID | Type | Threat | Sources | Handling | Output / evidence | Status | Report |
|---|---|---|---|---|---|---|---|
| TV-10 | C | Seeded differential precision is close to 1.0 by construction, because a one-line seed rarely makes an unrelated rule fire. It does not measure false alarms on real code. | Fable A1; ADR-020 item 1 | M: baseline precision is a registered SO4 secondary outcome: the HT-weighted share of P2 items labelled TP or unseeded-TP, with the BR-U5b-61 interval rule. D: the differential figure is always named "seeded differential precision" and is shown beside baseline precision. | `prf_*.csv`; the baseline-precision table (P-M) | in place (P-M, prereg v3) | 8.1 |
| TV-11 | C | The P1 label rule moved real violations into FP, and the HT weights were inconsistent across TP classes. | Fable A2; ADR-020 item 2 | M: MAT-10 FP-labelled = FP-strict minus {TP, unseeded-TP}; every TP-class label is weighted 1/p. | `Docs/matching-rule.md` MAT-10 | in place (P-M, prereg v3) | 7.5 |
| TV-12 | C | Circularity: operators are literal negations of templates, realised as synthetic constructs at feasible sites. Recall measures whether the Cypher matches the author's canonical construct. | Fable B1; ADR-020 item 9 | D: frame recall as construct sensitivity; report template coverage (about 8 operators for about 8 of 25 templates) and that the whole core is nestjs; name P2 TP labels as the only naturally occurring positives. | `prf_by_function.csv`; `Docs/operator-catalogue.md` | residual | 8.1; 9.2 |
| TV-13 | C | Twin specificity holds by construction (preconditions, threshold arithmetic). | Fable B2; ADR-020 item 9 | D: state it beside every twin figure. | `twins.csv` | residual | 8.1 |
| TV-14 | C | Correlated checks: one domain-to-infrastructure injection fires FF-S01, FF-S04 and FF-P06. | U3 §11 item 1 | M: SO4 counts the seeded instance once. D: AHS penalises it two or three times, and this is stated with the AHS figures. | `instances.csv`; `ahs_by_project.csv` | in place | 8.1 |
| TV-15 | C | Predicted collateral firings (cycles, metric crossings, test pairing, project metrics) are neutralised, so the FP count depends on the collateral predictor. | Fable A1 evidence; `Docs/matching-rule.md` | D: collateral and metric-key exclusions are reported per function. | `prf_by_function.csv` `collateral`, `metric_key_excluded` | in place | 8.1 |
| TV-16 | S | One rejected or incomplete seed pair stops the whole SO4 score; a truncated cycle function rejects a whole pair (MAT-25). | SO4-03; Fable B7 | M: a rejected pair is listed with its reason and does not stop the run (ADR-021 SO4). D: MAT-25 rejection counts. | `runs.csv`; `instances.csv` | pending SO4-03 | 8.1 |
| TV-17 | S | The SO4 floor of 80–120 held-out instances may not be met (69 at k = 3 before E7). After E7 and the P-1 freeze (prereg v2) the catalogue is frozen at k = 2 with 85 held-out instances, so the floor is met. | ADR-019 item 1; SO4-05; BR-U5a-37 | M: freeze E7 at its maximum and recount under BR-U5a-37 as written. No k = 4 and no relaxed counting. D: an N-vs-floor output; any shortfall is a deviation (§3). | N-vs-floor output (ADR-021 SO4) | pending SO4-05 | 7.1; 8.4 |
| TV-18 | C | In full mode, new neural-judge violations enter symbolic P/R/F1 as FP-strict, but can never be TP. | Fable A5; SO4-07; ADR-020 item 5 | M: `so4-heldout` runs symbolic-only; neural results go in their own column. | `experiments/so4-heldout/plan.json` | in place (P-M, prereg v3) | 8.1 |
| TV-19 | E | The held-out core corpus is not unseen: it shaped the specs and the remap. | Fable A8; ADR-020 item 8 | M: E7 is the only unseen stratum. D: a pooled E7 row beside the all-bases figure. | `prf_overall.csv` (E7 stratum) | in place (P-M, prereg v3) | 8.1; 9.2 |
| TV-20 | E | The `layered` style library has held-out P/R only if an E7 project is layered. | U5a §6 SO1 row; SO1-B; SO1-C | M: the FR-20 layered acceptance run on a public layered E7 project, and a style column in the strata (ADR-021 SO1). | `results/pre-tag/`; `denominators.csv` style column | pending SO1-B, SO1-C | 8.1 |
| TV-21 | C | The judge-probe base is shared with SEN-01 (`correct-reference`). | U4 §11 "Judge-probe base"; B&T summary §8 | D: MO-X02 and MO-X03 detection is reported as dev-split figures only, never pooled with held-out results, and the shared base is declared. | `judge_probe.csv` | in place | 8.1 |

### 2.3 Statistical-conclusion validity

| ID | Type | Threat | Sources | Handling | Output / evidence | Status | Report |
|---|---|---|---|---|---|---|---|
| TV-22 | S | The k copies (k = 2 since the P-1 freeze) of an operator on one base are treated as independent, so the instance Wilson interval is about √k too narrow. | Fable A3; ADR-020 item 3 | M: the (project, operator) cell is the recall unit (cell recall = detected / k), and the cell interval is the sole primary recall interval. The project cluster bootstrap is co-primary only from 10 projects; with the 7 held-out projects it is descriptive (`ci_project_descriptive`; ADR-020 item 3 amendment, ADR-021 item 7), and no cluster-robust t or BCa interval is added. The instance Wilson interval is shown only as the "if independent" bound. D: `so4-prf-*.svg` draws the cell interval solid and the project interval dashed. | `prf_*.csv` `ci_*`, `ci_project_*`, `ci_independent_*`; `so4-prf-*.svg` | in place (P-M, prereg v3) | 7.5; 8.1 |
| TV-23 | S | Only recall has an interval; precision and F1 have none. | SO4-06 | M: cluster bootstrap intervals, with Wilson for precision as the "if independent" bound (ADR-021 SO4). Since P-M, `precision_figure.csv` carries an interval for the seeded differential precision (Wilson / Clopper-Pearson on items) and for the baseline precision, drawn by `so4-precision.svg`; the P/R/F1 files and F1 still have none. D: a figure draws an interval only where the CSV carries one. | `prf_*.csv`; `precision_figure.csv`; `so4-precision.svg`, `so4-prf-*.svg` | pending SO4-06 | 8.1 |
| TV-24 | S | SO5 pairwise bootstrap CIs are degenerate (3 replicates per cell), and the pairwise rows have no multiplicity control. | Fable A6; ADR-020 item 6 | M: pairwise CIs are descriptive only; inference rests on Holm-corrected permutation p-values and Cliff's δ. | `so5_tests.csv` | in place (P-M, prereg v3) | 7.5; 8.2 |
| TV-25 | S | The SO5 permutation test permutes within task only. Unbalanced valid cells leak the spec-level effect into the model test, and the reverse. | THR-4 | M: permute within the strata of the other factor (ADR-021 SO5). | `so5_tests.csv` | pending THR-4 | 7.5 |
| TV-26 | S | Weighted P4 agreement CIs are Wilson intervals on a rounded weighted proportion at nominal n. They ignore the weights and the clustering. | THR-6; Fable B3 | M: a weighted item bootstrap (ADR-021 SO3). D: until then, any such CI is labelled approximate. | `agreement.csv` | in place (PR #26); registered by P-U6 | 8.1 |
| TV-27 | S | Multiple comparisons across the SO5 outcomes and families. | `Docs/analysis-plan.md` §6; Fable B7 | M: Holm across the three main tests; secondary families are Holm-corrected within their own family and marked exploratory. | `so5_tests.csv` `p_holm`, `exploratory` | in place | 7.5 |
| TV-28 | S | Small samples: 54 E1 projects with 3 runs per cell, 8–10 corpus projects, and few clusters. | ADR-017 items 1, 3; BR-U5b-61 | M: the interval rule (Wilson or Clopper–Pearson below 10 clusters; counts only below n = 10). D: n and the CI method on every row; effect sizes with intervals. | `ci_method`, `n_clusters` columns | in place | 8.4 |
| TV-29 | S | An E1 cell without `generation.json` silently drops out of every SO5 output. | SO5-05 | M: a missing cell is recorded as not-run with a GEN code (ADR-021 SO5). | `so5_grid.csv` `status`, `gen_code` | in place (SO5-05, PR #18) | 8.2 |
| TV-30 | I | Selection on generation success: AHS exists only for generated projects that type-check. | THR-4 | M: the valid-generation yield test (a registered secondary outcome) is named as the mitigation. D: yield per model × spec level, shown beside the AHS grid (the heatmap prints n valid / n cells). | `so5_tests.csv`; `so5-grid-heatmap.svg` | pending THR-4 | 8.2 |

### 2.4 Labelling (SO3 panel and author audit)

| ID | Type | Threat | Sources | Handling | Output / evidence | Status | Report |
|---|---|---|---|---|---|---|---|
| TV-31 | C | Single labeller: one Gemini model, run twice. There is no labeller-vs-labeller agreement. | ADR-017 item 7; THR-5; Fable B3 | M: a labeller validity criterion: if run-vs-run κ < 0.60, the FP/FN taxonomy is reported as descriptive only (ADR-021 SO3); the author's 30-item audit. D: `uncertain` stays a category; FP-strict is shown beside FP-labelled wherever precision is quoted. | `agreement.csv`; `fp_fn_taxonomy.csv` | pending SO3 (ADR-021) | 8.1; 8.4 |
| TV-32 | C | The blinded audit view leaks the panel label (grouped by stratum, next to the allocation file). | THR-3 | M: the audit view hides panel labels and is shuffled with a seed (ADR-021 SO3). | `audit_allocation.csv`; audit view | in place (PR #26); registered by P-U6 | 8.4 |
| TV-33 | C | The author audit is not blind to the rule or the function id, and has 3–10 items per stratum. | Fable B6; ADR-020 item 9 | D: reported as a sanity check, not a validation. | `agreement.csv` (panel vs audit) | residual | 8.4 |
| TV-34 | C | The labeller sees a 31-line window and cannot know whether a construct was deliberately introduced. | Fable A2 evidence | D: state the context limit. | `Docs/labeller-prompts/` | residual | 8.4 |

### 2.5 Neural judge (U4)

| ID | Type | Threat | Sources | Handling | Output / evidence | Status | Report |
|---|---|---|---|---|---|---|---|
| TV-35 | I | Judge self-preference: `claude-opus-5-5` judges Claude-generated E1 projects, Opus among them, and this is confounded with the SO5 model main effect. The U4 §11 mitigation cites a "Phase 5 Gemini cross-check" that is not planned. | U4 §11 "Judge model"; THR-1; SO5-06; ADR-020 item 7 | M: `ahsDeterministic` is co-primary with `ahsCombined` for the model effect; judge-vs-panel agreement per generator model and per source (E1 the headline); the directional check (an Opus advantage on `ahsNeuronal` relative to `ahsDeterministic`) is pre-registered. This row replaces the U4 §11 mitigation text. | `so5_tests.csv`; `agreement.csv`; `so5-*.svg` (both outcomes) | in place (P-M, prereg v3) | 8.2; 8.4 |
| TV-36 | R | Isolation canary residuals: the user-level `CLAUDE.md` and the `UserPromptSubmit` hook channels were not positively controlled, and the ancestor `CLAUDE.md` channel is closed only by the ISO-05 neutral-cwd check. | ADR-018 items 1–3, 6; ADR-019 item 6; OI-BT-F1; B&T summary §8 | M: the ADR-018 allow-list and the per-run init probe (ISO-02..06) fail closed. D: §8.4 names the uncontrolled channels and the per-run ISO-05 result. | run manifests; `tests/fixtures/claude-cli/canary-result*.json` | residual | 8.4 |
| TV-37 | R | Claude CLI version drift, or an auto-update during a study. | U4 §11 "CLI version"; ADR-018 item 4 | M: `PINNED_CLI_VERSION` 2.1.294; `DISABLE_AUTOUPDATER=1` in the judge env; record mode stops on drift. D: the author-install switch is unverified (B&T summary §7). Cassettes from two versions are reported as mixed provenance. | manifest CLI version | in place; author-install switch open | 7.5 |
| TV-38 | R | The USAGE_LIMIT classifier patterns and the calls per usage window are unverified. | ADR-018 item 5; B&T summary §8 | D: every usage-limit stop and resume is reported. | run manifests | residual | 8.4 |
| TV-39 | C | Effort affects verdicts, and `JUDGE_MAX_TOKENS` is ignored by the CLI. | U4 §11 "Effort", "`JUDGE_MAX_TOKENS`" | M: effort frozen at `high`; it changes only by ladder step 3, with a full re-record (§4). | `corpus/frozen-instrument.json` | in place | 7.5 |
| TV-40 | C | Persona, verdict-schema, rubric and prompt wording define the construct. | U4 §11 "Persona…", "Rubric text…"; ADR-019 item 5 | M: frozen and hashed (`FROZEN_SHA256`); the rubric freezes only after SEN-01 runs in full, with no function excluded. | `src/llm-critic/frozen.ts`; `corpus/frozen-instrument.json` | P-4 | 7.5 |
| TV-41 | S | Aggregation choices: a majority over 3 runs, the unit-validity rule, the > 1/2 fail threshold, the instability thresholds, and LLM confidence that is not calibrated. | U4 §11 rows `runsPerEvaluation` to "Confidence weights" | M: frozen. The any-fail and share variants are recomputed offline as sensitivity only (BR-U5b-60). D: within-run agreement. | `rescore_sensitivity.csv`; `threshold-sensitivity.svg` | in place | 8.1 |
| TV-42 | C | Judge coverage is bounded by selection (`unitCap` 20), the candidate filter, module coalescing, token budgets and the 1-hop excerpt. | U4 §11 rows `unitCap` to "Excerpt" | D: detection is reported overall and conditional on selection, with the truncation rate and the exclusion counts. | `judge_probe.csv` `in_selection`, `coverage_share` | in place | 8.1 |
| TV-43 | C | Dropped verdict paths become FN, and timeouts become invalid runs. | U4 §11 "Verdict consistency…", "Concurrency / retry / timeout" | D: counted per function. | report `neuralResults`; `denominators.csv` | in place | 8.1 |
| TV-44 | I | Cassette reuse: unchanged units are judged once per experiment, so judge noise on them is removed from differential scores. | U4 §11 "Cassette reuse" (CAS-08) | D: caching is declared. | `experiments/*/cassettes` | residual | 7.5 |
| TV-45 | R | Judge repetition reliability merges different projects' units (cassette entries carry no projectId). | SO3-5 | M: `projectId` is added to the repetition keys (ADR-021 SO3). | reliability rows of `agreement.csv` | in place (PR #26); registered by P-U6 | 8.1 |
| TV-46 | I | The degradation ladder could be applied post hoc, or to part of an experiment. | U4 §11 "Degradation ladder" (OPS-04); THR-9 | M: the governing rules in §4, registered with this file. D: every applied step is reported with its trigger and dated line. | `Docs/judge-preregistration.md` "Dated lines" | in place on P-U6 | 7.5; 8.4 |
| TV-47 | C | ADR prose never reaches the judge prompt: no registered spec supplies `adrProse`. | B&T summary §8 | D: declared limitation. | — | residual | 9.2 |
| TV-48 | R | Mock cassette entries store `resolvedModel: "mock-model"`. | B&T summary §8 | D: Mock cassettes are never cited as evidence of a resolved judge model. | `tests/fixtures/judge-cassettes*` | residual | 8.4 |
| TV-49 | I | In `full-aac` the generator sees the evaluator spec, so the spec level is confounded with test knowledge and prompt length. Tier is confounded with generation (haiku-4-5 vs the 5-5 models), and there is one vendor. | U4 §11 "E1 evaluator spec" (CTX-07); Fable B5; ADR-020 item 9 | D: state all three confounds wherever the spec-level effect or the model effect is interpreted. | `so5_tests.csv`; `so5-*.svg` | residual | 8.2; 8.4 |
| TV-50 | I | Interim neural figures (the SEN-01 verdicts, the live smoke) could be quoted as results. | BR-U4-POL-02; B&T summary §8 | M: never quoted; they are instrument checks. | `Docs/DiagnosticRuns /bt-sen01.md` | in place | 7.2 |
| TV-51 | I | No pre-run judge-volume estimate exists for E1, so the ladder trigger has nothing to compare against. | SO5-08 | M: a pre-run judge-volume estimate for E1 (ADR-021 SO5). | `Docs/DiagnosticRuns/e1-judge-volume-estimate.md` | in place (SO5-08, PR #18) | 7.3 |

### 2.6 Symbolic engine (U1, U3)

| ID | Type | Threat | Sources | Handling | Output / evidence | Status | Report |
|---|---|---|---|---|---|---|---|
| TV-52 | C | Cycles longer than 10 files are not detected (`MAX_CYCLE_LENGTH` = 10). | U1 §8 item 1; BR-U1-28 | M: the SCC fallback (no length bound). D: the long-cycle measurement on the corpus. | latency-gate run (moved to U6, ADR-021 item 3) | pending latency-gate run (code in place, PR #23, #24) | 8.4 |
| TV-53 | C | Tag classification is the author's, including the reading notes R1–R3. | U1 §8 items 2, 11 | M: definitions frozen before results (BR-U1-27). D: declared. | U1 §4.1 tag table | in place | 7.5 |
| TV-54 | C | The `pattern` grammar reading sits near the 0.80 cut-off (0.794 / 0.802 / 0.807); variant-d crosses 0.50 at about 0.505. | U1 §8 item 3 | D: cut-off sensitivity is reported, as sensitivity only. | `rescore_sensitivity.csv`; `threshold-sensitivity.svg` | in place | 7.2 |
| TV-55 | C | The `layered` applicability table is the author's. | U1 §8 item 4 | M: frozen with citations. D: declared. | U1 §3.1 | in place | 7.5 |
| TV-56 | C | Self-spec deviations from the preset defaults. | U1 §8 item 5 | D: listed. | BR-U1-16 | residual | 7.5 |
| TV-57 | C | FF-S03 is disabled for clean-architecture and nestjs, so no corpus result contains FF-S03. | U1 §8 item 6; BR-U1-43 | D: reported as a construct correction, not a tuning. | `denominators.csv` `disabled` | in place | 7.1 |
| TV-58 | C | Vacuous or cannot-fire checks (FF-P01 until U3; FF-CV01, FF-CV04, FF-CV06) until the sensitivity check fixes or excludes them. | U1 §8 item 9; ADR-016 b; B&T summary §8 | M: fix-or-exclude by the SP-* sensitivity run, registered in P-3. D: the sensitivity results per function. | `function_sensitivity.csv` | P-3 (BT-E) | 7.2 |
| TV-59 | C | The full-mode window. | U1 §8 item 10; BR-U1-24 | D: declared. | — | residual | 7.5 |
| TV-60 | C | Merged rows keep the first row's identity and line; evidence is the per-column maximum. | U3 §11 item 2 | D: declared. | — | residual | 7.5 |
| TV-61 | C | The SCC fallback has no length bound, gives one violation per component, and keys differ from the Cypher strategy. | U3 §11 item 3 | M: a strategy flip applies to the whole experiment; keys are never compared across strategies. | `latency.csv` `gate_result` | in place | 7.5 |
| TV-62 | C | Individual warnings above 50 per (stage, code) are hidden. | U3 §11 item 4 | D: totals are kept in `REPORT_001`. | report warnings | in place | 7.5 |
| TV-63 | C | Verdict thresholds were calibrated on symbolic-only runs and are reused unchanged in the full and neuronal-only modes. | U3 §11 item 5 | D: AHS values beside verdicts; threshold sweeps are sensitivity only (TV-72). | `ahs_by_project.csv`; `so5_grid.csv` | in place | 7.2 |
| TV-64 | C | Metric empty-result definitions (`null` ratios, max degree 0). | U3 §11 item 6 | D: definitions chosen before the first run, declared. | — | residual | 7.5 |
| TV-65 | C | FF-P06 is tagged `structural` but checks a data-flow edge. | U3 §11 item 7 | D: its own row inside `structural`. | `prf_by_tag.csv` `sub_row` | in place | 8.1 |
| TV-66 | C | `CONSTRUCTOR_INJECTS` violations of FF-P06 carry no line. | U3 §11 item 8 | D: matched by file, target and discriminator. | `Docs/matching-rule.md` | in place | 7.5 |
| TV-67 | C | Evidence and id conventions are researcher choices. | U3 §11 item 9; BR-U3-70 | M: frozen. | — | in place | 7.5 |
| TV-68 | C | In full mode a violating symbolic half suppresses the neural half, so the `semantic` AVR rests on symbolic evidence for that function. | U3 §11 item 10 | D: declared. | — | residual | 8.1 |
| TV-69 | C | A dropped dimension has no `perDimensionScores` row. | U3 §11 item 11 | D: readers use `droppedDimensions`. | `ahs_by_project.csv` `dropped_dimensions` | in place | 8.1 |
| TV-70 | C | A generated project with no judge units drops `semantic` and `integrity`, so `ahsCombined` uses fewer dimensions. | U3 §11 item 12 | D: drop count per E1 cell beside the AHS values. | `so5_grid.csv` | in place | 8.2 |
| TV-71 | C | In full mode, row weights are the `ahsCombined` weights. | U3 §11 item 13 | D: `ahsDeterministic` effective weights are recomputed offline; the CSV header names the source. | `rescore_ablation.csv` | in place | 7.5 |
| TV-72 | I | Thresholds or aggregation rules could be tuned on the swept results. | BR-U5b-60; ADR-015 item 1 | M: sweeps and neural-aggregation variants are labelled "sensitivity-only, not tuning" in the CSV and in the figure caption; the shipped 0.80 / 0.65 / 0.50 are never replaced in a reported table. | `rescore_sensitivity.csv` `purpose`; `threshold-sensitivity.svg` | in place | 7.2 |

### 2.7 Graph extractor and SO2

| ID | Type | Threat | Sources | Handling | Output / evidence | Status | Report |
|---|---|---|---|---|---|---|---|
| TV-73 | C | Decorators are not ingested; duplicates from declaration merging are not detected; dashboard totals count the new node and edge types without golden coverage. | B&T summary §8 (U2) | D: declared limitations (FF-CV04 needs its own FR). | — | residual | 9.2 |
| TV-74 | C | SO2 structural coverage is measured only through parse coverage and import resolution. `FLOWS_TO` coverage and per-project graph size are not output. | SO2-4; X-4 | M: a registered `FLOWS_TO`-per-resolved-import metric and per-project graph-size rows (ADR-021 SO2). | `coverage.csv`; `so2-coverage.svg` | in place (PR #23, #24); registered by P-U6 | 8.1 |
| TV-75 | C | The proposal's APG-full vs AST-only ablation was dropped without a deviation. | SO2-5; X-2 | M: `--graph-mode ast-only` is the register's definition: only IMPORTS, DECLARES and CONTAINS edges, as a post-filter over the unchanged full extraction (ADR-021 item 8), with the `so2-metrics arms` pre-run check that each pair of arms differs; the violation difference on the corpus and the fixtures. D: whether `apg-ablation` adds the so4-heldout MO-DF01 seeded copies is decided at P-U6. | `apg_ablation.csv`, `apg_ablation_summary.csv`, `apg_arms.csv` | in place (PR #23, #24); registered by P-U6 | 8.1 |
| TV-76 | C | The H13 latency gate cannot output `fallback-required`; the universal cycle metric is not timed; latency is not written by script. | SO2-1, SO2-2, SO2-3; ADR-021 item 3 | M: a cycle-query timeout counts as `fallback-required`; the cycle metric is timed; `latency.csv` and the NFR-07 table are written by script. | so2-metrics `latency.csv`, `nfr07_latency.csv`, `gate.json`; `so2-latency.svg` | in place (PR #23, #24); registered by P-U6 | 8.1 |

### 2.8 SO5 / E1

| ID | Type | Threat | Sources | Handling | Output / evidence | Status | Report |
|---|---|---|---|---|---|---|---|
| TV-77 | C | FPAT is a pre-specified rule-family profile, not a taxonomy derived from the data. | Fable B4; SO5-07; ADR-020 item 9 | M: an exploratory open-coding procedure: the agy panel proposes codes from the rationales, and the author, declared non-blind, consolidates them. It is never confirmatory (ADR-021 SO5). D: FPAT is called a profile. | `so5_patterns.csv` | pending SO5-07 | 8.2 |
| TV-78 | C | Violation density per KLOC and latency per E1 cell (proposal SO5 metrics) cannot be produced. | X-3; SO5-07 | M: LOC, density per KLOC and per-project latency (ADR-021 SO5). | `so5_grid.csv` | pending X-3 | 8.2 |
| TV-79 | R | The generator cannot resume after a stop in the middle of a cell. | SO5-04 | M: an atomic restart of the cell (ADR-021 SO5). | `restarts.jsonl`, generation logs | in place (SO5-04, PR #18) | 7.3 |
| TV-80 | E | E1 uses one vendor (Claude, three models); other adapters come at the end. | ADR-017 item 3; Fable B5 | D: the model effect is a within-vendor effect. | — | residual | 9.2; 9.3 |
| TV-81 | R | LLM non-determinism in generation, judging and labelling. | ADR-019 item 6; BR-U5b-63 | M: registered seeds (sampling, bootstrap, permutation, `orderSeed`); byte-identical aggregation over the same inputs; cassette replay of judge and labeller calls. D: 3 runs per cell are reported, not pooled away. | `runs.csv`; cassettes | in place | 7.5 |

### 2.9 Corpus, scope and environment

| ID | Type | Threat | Sources | Handling | Output / evidence | Status | Report |
|---|---|---|---|---|---|---|---|
| TV-82 | E | Small corpus (5 frozen core + up to 5 E7 projects), and every core project is nestjs. | ADR-017 item 1; ADR-019 item 1; Fable B1 | D: generalisation is limited to TypeScript layered/NestJS back ends of this size. | `Docs/corpus.md` | residual | 9.2 |
| TV-83 | R | Corpus licences are unclear (dev-nest, realworld-test); install is not reproducible for realworld-test (unreachable lock mirror) and truthy-demo (install-dependent tree hash); ghostfolio-test is excluded from the mutation inputs. | B&T summary §8; OI-BT-C1, C2, C3; ADR-019 item 6 | D: declared, with the registered tree hashes. | `corpus/corpus.json`; `Docs/corpus.md` | residual | 7.1; 9.2 |
| TV-84 | E | The proposal's controlled developer study (thesis 7.4 and 8.3) is not in the v1.2E scope, and no ADR records its removal. | thesis skeleton `Kap7`, `Kap8`; ADR-017 | D: report the removal as a scope deviation (§3) or plan it; the author decides. | — | open | 9.2; 9.3 |
| TV-85 | R | Engineering residuals that do not change results: the lint ratchet (497), the `braces` advisory (accepted), a local Jest-worker `SIGSEGV` under Node 24.5.0, and the unused `remapLine`. | B&T summary §8; Fable B7 | D: none in the thesis; listed for completeness. | `Docs/DiagnosticRuns /bt-audit-triage.md` | residual | — |
| TV-86 | I | The registered SO4 and E7 plans do not name the held-out set, so a run could choose its bases after the fact. | ADR-021 item 5 (Major 1); P-1 verification | M: the seven held-out `{projectId, path, specPath}` entries (realworld, ghostfolio, truthy-demo, dry-run-test, zhuravlevma, nestjslatam, valex) in `experiments/so4-heldout/plan.json`; the three E7 bases in `experiments/e7-corpus/plan.json`; the run list in `Docs/analysis-plan.md`. | registered plans | P-U6 | 7.1 |
| TV-87 | R | The inputs of the single feasibility count are not registered, so N = 85 cannot be re-derived from hashed inputs. | ADR-021 item 5 (Major 2, minor); P-1 verification | M: register, without a recount, the `--bases` list or the exact command lines, `Docs/DiagnosticRuns/u5a-site-feasibility.json`, `u5a-base-typecheck.json`, `e7-spec-generation.json`, `corpus/selections/*.json`, `presets/*.yaml`, `scripts/generate-e7-specs-cli.ts` and the three chain tools. | `corpus/prereg.json` | P-U6 | 7.1 |
| TV-88 | I | The SO4 N was reached by floor-motivated decisions taken after the projects were known (the remap; the ghostfolio repair, +10; the E7 specs, +38), and the margin is small (85 vs 80). | ADR-021 item 5 (Ch7 duties 1–9); P-1 verification | D: the capacity history 29/42, 47/69, 85/126; the three decisions with their arithmetic; the counterfactual N = 111 at k = 3 on six bases without the ghostfolio repair; the vocabulary written after the projects were known; the 85-vs-80 margin; the catalogue hashed as DRAFT in v1; the post-hoc items. These duties are binding. | Ch7 corpus section; `Docs/corpus.md` | residual | 7.1; 8.4 |
| TV-89 | E | The held-out set is unbalanced by style (5 nestjs, 1 clean, 1 layered), with rule-vs-`corpus.json` style mismatches, and MarvinRF is excluded (suspected zero-judge-units report-schema defect). | ADR-021 item 5; ADR-020 item 4; P-1 verification | M: MarvinRF stays excluded from SO4 for good; re-admission would need a second count; if the defect is fixed it may be reported only as an exploratory extra. D: the exclusions by name, the style mismatches and the imbalance. | `Docs/corpus.md` | in place | 7.1; 9.2 |
| TV-90 | S | The live labelling budget (at most 300 calls, about 180 a week on the agy route) gives wide intervals for the FP/FN taxonomy and for agreement, and may not support the FR-27 precision. | ADR-021 item 6; ADR-021 item 7 | M: registered stratum sizes in `corpus/label-plan-config.json` (300 calls including a 30-call re-ask reserve, at least two weeks of quota); a trimmed context (the 31-line window, the rule text, the verdict schema); a plan over budget is refused (`LABEL_PLAN_OVER_BUDGET`) and `llm-label` stops at the plan budget. D: the interval half-widths the registered sizes give (P4 n = 46: ±0.139 at p = 0.5), stated before any run; the measured input tokens per call; if 300 calls cannot support FR-27, the gap is a limitation, with priority P4 over P2 over P3. | `corpus/label-plan-config.json`; `label_budget.csv`; `Docs/labeller-route.md` §6 | in place (PR #26); sizes registered by P-U6 | 7.5; 9.2 |
| TV-91 | I | A registered plan could run on unregistered artefacts: `--check-prereg` refuses all six plans (`Docs/generator-protocol.md` changed after v3; `experiments/e1-grid/generator-plan.json` is not registered), and no CI step runs the check. | ADR-021 item 7 | M: P-U6 registers both files with reasons and bumps the version; every plan must print "pre-registration v<N> ok"; then a CI step runs `--check-prereg` on every `experiments/*/plan.json` for PRs to v1.2e; BT-B, BT-E and BT-F resume only after P-U6. | `corpus/prereg.json`; CI | P-U6 | 7.5 |
| TV-92 | C | The SO2 numbers could describe another graph or another gate than the evaluated ones: `so2-metrics` extracted without the spec's `default_exclude_paths`; the aggregate's `latency.csv` reads accepted runs only, its `cycle_query_ms` sums both cycle queries, its `stage_ms` rows double-count the universal cycle sub-stage, and its `gate_result` cannot be `fallback-required` for a rejected run. | ADR-021 item 8; SO2-3, SO2-4, X-4 | M: one C3 rule, `readSpecExcludePaths`, gives the excludes to the pipeline and to every `so2-metrics` extraction; the registered H13 gate source is `results/latency-gate/so2/gate.json`; `so2-latency.svg` reads the `so2-metrics` `latency.csv` (every run, both queries apart), never the aggregate's. D: P-U6 or P-M marks or excludes the sub-stage row, renames or documents `cycle_query_ms` and drops or labels the aggregate `gate_result` as non-registered; P-U6 names the NFR-07 source (`--run-dir results/latency-gate --run-dir results/apg-ablation`) in analysis-plan §3 SO2. | `gate.json`; so2-metrics `latency.csv`, `nfr07_latency.csv`; `so2-latency.svg` | in place (PR #24); P-U6 | 8.1 |

## 3. Deviation entries

BR-U5b-50 requires a threats-to-validity deviation entry for every pre-registration version bump that happens after a
run. ADR-015 item 2 requires one for each frozen choice. This section is their registered home. An entry is appended,
never edited, and needs its own bump.

Entry format: `DV-TV-<n> | date | prereg version (from → to) | reason | runs affected (ids, kept under their own
version) | threat rows (TV-…) | report section`.

| ID | Date | Version | Reason | Runs affected | Rows | Report |
|---|---|---|---|---|---|---|
| — | — | — | No run has happened yet, so no post-run bump exists. | — | — | — |

**Declared pre-run deviations from the proposal** (each reported in Ch7–9; none needs a post-run entry):

| Deviation | Decided by | Rows | Report |
|---|---|---|---|
| The 3×3 / 135-project design is replaced by the 54-project parametric E1 grid | ADR-017 item 3 (ADR-011 superseded) | TV-28, TV-80 | 7.3 |
| A single labeller, so no labeller-vs-labeller agreement | ADR-017 item 7 | TV-31 | 7.5 |
| The labeller route is agy with no temperature setting | ADR-019 item 4; ADR-021 SO3 | TV-05 | 7.5 |
| SO4 is run with the actual N if the floor is not met (not triggered: P-1 froze k = 2 with N = 85 ≥ 80) | ADR-019 item 1 (conditional) | TV-17 | 7.1; 8.4 |
| FPAT is a profile; open coding is exploratory | ADR-020 item 9; ADR-021 SO5 | TV-77 | 8.2 |
| The controlled developer study is not run | none yet (open) | TV-84 | 9.2 |

## 4. Judge degradation ladder: governing rules (registered here)

The ladder's values are pinned by `corpus/frozen-instrument.json` (`judge.effort` `high`, `selection.unitCap` 20). A
step therefore changes a hashed artefact and needs a pre-registration bump. The rules below govern *when* a step may be
taken. They are registered with this file (THR-9). `Docs/judge-preregistration.md` keeps the dated lines.

1. Allowed steps, in this order only: (1) reduce the reliability sub-study to repetitions 0 and 1, on the fixtures
   only; (2) E7 `unitCap` 20 → 10, for both judge functions, on every E7 project; (3) effort `high` → `medium`, with
   a full re-record of every experiment recorded at `high`.
2. Trigger: only measured calls per usage window, compared against the pre-run volume estimate (TV-51).
3. Timing: a step is decided at a usage-window boundary, before any affected score is viewed.
4. Scope: a step is applied to a whole experiment, never to part of one.
5. Record: each applied step gets a dated line in `Docs/judge-preregistration.md`, older than the first run it
   affects, and a §3 entry here when it follows a run.
6. Never changed mid-study: the judge model, `runsPerEvaluation`, the rubric, the E1 `unitCap` and the aggregation
   thresholds.

## 5. Source trace

Every item of every source maps to at least one row. The arrows are machine-checked by
`tests/unit/scripts/u6/threats-register.test.ts`.

| Source | Items → rows |
|---|---|
| U1 §8 | 1 → TV-52; 2 → TV-53; 3 → TV-54; 4 → TV-55; 5 → TV-56; 6 → TV-57; 7 → TV-07; 8 → TV-07; 9 → TV-58; 10 → TV-59; 11 → TV-53; 12 → TV-07 |
| U3 §11 | 1 → TV-14; 2 → TV-60; 3 → TV-61; 4 → TV-62; 5 → TV-63; 6 → TV-64; 7 → TV-65; 8 → TV-66; 9 → TV-67; 10 → TV-68; 11 → TV-69; 12 → TV-70; 13 → TV-71 |
| U4 §11 | judge-model → TV-35; effort → TV-39; max-tokens → TV-39; isolation → TV-36; cli-version → TV-37; persona-schema → TV-40; verdict-paths → TV-43; runs-per-evaluation → TV-41; unit-validity → TV-41; aggregation-threshold → TV-41; unstable-threshold → TV-41; confidence-weights → TV-41; selection → TV-42; candidate-filter → TV-42; coalescing → TV-42; token-budgets → TV-42; excerpt → TV-42; rubric → TV-40; judge-probe-base → TV-21; e1-evaluator-spec → TV-49; timeouts → TV-43; cassette-reuse → TV-44; ladder → TV-46; frozen-bundle → TV-40 |
| B&T summary §8 | canary → TV-36; usage-limit → TV-38; mock-model → TV-48; adr-prose → TV-47; probe-base → TV-21; sen01-scope → TV-40; long-cycles → TV-52; u3-list → TV-14; u1-list → TV-53; cannot-fire → TV-58; extractor → TV-73; licences → TV-83; install → TV-83; lint-audit-sigsegv → TV-85; interim-figures → TV-50 |
| ADR-018 | 1 → TV-36; 2 → TV-36; 3 → TV-36; 4 → TV-37; 5 → TV-38; 6 → TV-36 |
| ADR-019 | 1 → TV-17; 2 → TV-06; 3 → TV-08; 4 → TV-05; 5 → TV-40; 6 → TV-04, TV-36, TV-81, TV-83 |
| ADR-020 | 1 → TV-10; 2 → TV-11; 3 → TV-22; 4 → TV-08; 5 → TV-18; 6 → TV-24; 7 → TV-35; 8 → TV-19; 9 → TV-12, TV-13, TV-31, TV-33, TV-49, TV-77 |
| ADR-021 | 1 → TV-35, TV-05; 2 → TV-02, TV-03, TV-16, TV-20, TV-23, TV-25, TV-26, TV-29, TV-31, TV-32, TV-74, TV-75, TV-77, TV-78; 3 → TV-76; 4 → TV-02; 5 → TV-86, TV-87, TV-88, TV-89; 6 → TV-90; 7 → TV-22, TV-91; 8 → TV-75, TV-76, TV-92 |
| Fable review | A1 → TV-10, TV-15; A2 → TV-11, TV-34; A3 → TV-22; A4 → TV-08; A5 → TV-18; A6 → TV-24; A7 → TV-35; A8 → TV-19; B1 → TV-12, TV-82; B2 → TV-13; B3 → TV-26, TV-31; B4 → TV-77; B5 → TV-49, TV-80; B6 → TV-33; B7 → TV-09, TV-16, TV-27, TV-85 |
| Other rules | ADR-015 item 2 → TV-01; BR-U5a-40 → TV-01; BR-U5b-50 → TV-01, TV-02; BR-U5b-60 → TV-72; BR-U5b-61 → TV-28; BR-U5b-63 → TV-81; ADR-017 → TV-28, TV-31, TV-80, TV-82, TV-84 |
| Audit THR | THR-1 → TV-35; THR-3 → TV-32; THR-4 → TV-25, TV-30; THR-5 → TV-05, TV-31; THR-6 → TV-26; THR-8 → TV-04; THR-9 → TV-02, TV-46 |

The Fable review is `Docs/DiagnosticRuns/methodology-review-2026-10-08.md` (review at `1185a1f`; dispositions in
ADR-020). The audit is `Docs/DiagnosticRuns/so-readiness-audit-2026-10-08.json`. The P-1 verification behind ADR-021 item 5 is `Docs/DiagnosticRuns/p1-verification-2026-10-09.md`.
