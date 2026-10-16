# Judge anti-pattern test: pre-registration draft (DRAFT)

> **Status: DRAFT 2026-10-12 (v1.3, branch `v1.3-judge-antipatterns`).** Nothing here is registered. No judge call, detector run or seeding has been made under this design. Registration requires a new ADR, a prereg version bump that adds the anti-pattern catalogue, its code and this plan to `REGISTERED_ARTEFACTS`, and the author's sign-off on the open choices in §7. Until then the frozen catalogue, the registered plans and every registered artefact stay as they are.
> **Operators**: `Docs/operator-catalogue-antipatterns.md` (5 positives, 5 twins). **Site evidence**: `Docs/DiagnosticRuns/antipattern-site-count-2026-10-12.{md,json}`.

## 1. Question

Does the LLM judge (FF-N01 `architectural-integrity`, FF-N02 `intent-alignment`, frozen rubric and route) detect realistic semantic and integrity violations, and how much of what it detects do the registered symbolic rules miss?

- **Q1 (detection).** Per operator, the share of seeds the judge detects.
- **Q2 (specificity).** Per operator, the share of matched twins the judge flags (false alarms).
- **Q3 (judge-only).** The share of seeds the judge detects and no symbolic rule flags.

The frozen judge probes MO-X02 and MO-X03 cannot answer Q1: they placed 0 seeds on the 7 held-out bases and in the 65 E1 cells (`Docs/DiagnosticRuns/judge-probe-e1-site-count.md`).

## 2. Design

### 2.1 Bases

- **Corpus**: the 7 held-out SO4 bases of the frozen catalogue §4: realworld-test, ghostfolio-test, truthy-demo, dry-run-test, zhuravlevma__nestjs-active-record, nestjslatam__ddd and v-aguiar__valex. They are prepared as registered (`prepare-bases`: installs, overlays, preparation steps, pinned tsc, stored baseline selections). The specs are the registered corpus specs.
- **E1 cells**: the 65 accepted E1 cells. Each is prepared as in `Docs/DiagnosticRuns/judge-probe-e1-site-rule.md`: staging copy, §3 tsconfig, `baseKind: generated`, `specs/clean-arch.yaml`, the judge selection projected from the cell's registered report.
- **No fixture** enters the analysis. Fixtures are for the unit tests only.

### 2.2 Seeds and twins

- **Per corpus base**: k = 2 sites per operator and k = 2 per twin, the frozen `sitesPerOperator` value, drawn by the registered sampler (`mulberry32(rngSeed)` over the stable eligible list; `masterSeed` 20261008). The draft's site rows carry the anti-pattern registry's own `catalogueVersion`.
- **Per E1 cell**: k = 1 site per operator and k = 1 per twin. Sites of one operator in one cell share units; one per cell keeps the cell as the unit, as in ADR-037.
- **Split**: `held-out` for positives and twins (the role and split rule of BR-U5a-30).
- **Mutant gate**: every application passes the pinned tsc with 0 errors (BR-U5a-07). A failing application is a `typecheck` rejection and is not redrawn (BR-U5a-17).
- **Judge placement (open choice, §7 item 1).**
  - **Option A (frozen rule)**: BR-U5a-27 unchanged. On a capped base every edited file must lie in a baseline-selected unit.
  - **Option B (seeded-unit judging, recommended)**: the units containing an edited or created file are judged on the mutant and, when the baseline selection did not include them, also on the baseline. Placement is then not a precondition.

  Option A removes every AP-FAT-CONTROLLER corpus seed and most of the rest. The without-placement pools are 175 / 6 / 5 / 42 / 523 (REPO-BYPASS / FAT-CONTROLLER / PERSIST / DUP / FRAMEWORK). The placed pools are 58 / 0 / 1 / 16 / 127. Option B changes how the judge sees the seed relative to E1 and E7, which judged only the selected units, so it needs its own ADR.

Projected corpus seeds at k = 2 (from the label-free count; the type-check gate can lower them):

| Operator | Option A seeds (bases) | Option B seeds (bases) | Twin, Option A | Twin, Option B |
|---|---|---|---|---|
| AP-REPO-BYPASS | 6 (3) | 8 (4) | 6 | 8 |
| AP-FAT-CONTROLLER | 0 (0) | 4 (2) | 4 | 8 |
| AP-PERSIST-IN-DOMAIN | 1 (1) | 2 (1) | 10 | 12 |
| AP-DUP-RULE | 4 (2) | 4 (2) | 2 | 4 |
| AP-FRAMEWORK-LEAK | 12 (6) | 12 (6) | 12 | 12 |
| **Total** | **23** | **30** | **34** | **44** |

E1 site counts are unknown. The E1 cells live outside the repository and were not counted in this session. The E1 count is the first step after registration. Like ADR-037, it is written down before any judge call, with its own rule (§5).

### 2.3 Symbolic arm

Each base and each mutant is evaluated by the registered symbolic pipeline (full mode, the registered spec), so the symbolic rows on the mutant are known for every seed and twin. "Symbolic catch" of a seed means:

- **(S1)** a symbolic row at one of the row's expected keys (MAT rules; only AP-PERSIST-IN-DOMAIN carries one, FF-P01), or
- **(S2)** any symbolic row on an edited or created file that is not on the baseline. This is the strict "any rule noticed something" reading.

Judge-only is reported under both.

## 3. Metrics

### 3.1 Detection event (per seed or twin)

The primary event is **MAT-23** (`Docs/matching-rule.md`): the probed function (`intent-alignment` for `semantic`, `architectural-integrity` for `integrity`) has a failing unit covering an edited or created file that does not fail on the baseline. A unit's verdict is U4's `voteUnit` over 3 runs (majority of valid runs).

### 3.2 Outcomes

| Metric | Definition | Unit of analysis |
|---|---|---|
| **DR** (detection rate) | seeds with the event / seeds, per operator | seed, clustered by base or cell |
| **FAR** (false-alarm rate) | twins with the event / twins, per operator | twin, clustered by base or cell |
| **Δ** (discrimination) | DR − FAR per operator | — |
| **JOD-abs** | seeds with the event and no symbolic catch (S1; S2 as sensitivity) / all seeds | seed |
| **JOD-cond** | seeds with the event among seeds with no symbolic catch / seeds with no symbolic catch | seed |
| **Both-catch control** | DR and symbolic catch rate on AP-PERSIST-IN-DOMAIN; expected: symbolic S1 ≈ 1 | seed |
| **Other-function alarm** | event on the non-probed judged function (FF-N01 for a semantic seed, FF-N02 for an integrity seed) | seed and twin |

Intervals:
- Wilson 95 % per operator and stratum (corpus, E1-Claude, E1-Codex).
- Cluster bootstrap over bases or cells for the pooled rates (2,000 resamples, seed 9601).
- Δ as a bootstrap difference.

No significance test is the headline. Holm correction is applied only over the five per-operator Δ tests (H1).

### 3.3 Under the four registered readings

The judge's unit votes are identical across readings; the readings differ in how they turn units into a function and a report. Each metric of §3.2 is reported a second time with the event replaced by "the seed raises the probed function's contribution on the mutant over the baseline" under each reading. All readings are computed from the same recorded calls (cassette replay, no new call).

1. **Registered** (`majority-of-valid-units-v1`, §12.1): the function verdict becomes `fail` (strictly more than half of the valid units fail) where the baseline was not `fail`. Reported with the verdict-level change (AHS verdict of the report).
2. **Proportional** (`proportional-inclusion-weighted-v1`, §12.2): `share_f` (mutant) > `share_f` (baseline). The confidence-free share is reported beside it. The variant is undefined for runs that reuse a baseline selection (BR-U4-SEL-07). Under Option B, a run that adds seeded units is such a run, so it is reported as `undefined` and not imputed.
3. **Any-fail** (§12.3 companion): the function has at least one failing valid unit on the mutant and none on the baseline.
4. **Judge-weighted** (`judge-weighted-v1`, §12.5): the report's judge-weighted AHS drops, or its verdict changes, on the mutant. Reported under the registered, proportional and any-fail aggregations, as §12.5 does.

Function-level readings are diluted by the other units of the function. With up to 20 units and one seeded unit, the registered rule can almost never flip. This is reported as is. It is a statement about the aggregation, not the judge.

### 3.4 Pre-declared reading

Per operator: **"the judge catches AP-X"** when the lower 95 % bound of Δ (MAT-23) is above 0 and DR ≥ 0.5; **"the judge does not separate AP-X from its twin"** when the Δ interval covers 0; otherwise **"inconclusive"**. An operator with fewer than 8 seeds over all strata is reported descriptively only (no reading). Judge-only (JOD-cond, S1) is read the same way against 0.

## 4. Budget

- **Route**: the frozen judge route (`Docs/labeller-route.md`; the E1 judge model, CLI version and config dir as registered). Effort `high`, `runsPerEvaluation` 3, `unitCap` 20.
- **Calls per row**: 1 init probe + 3 × (units containing an edited or created file, FF-N01 module units + FF-N02 file units). Under Option B, add 3 × (those units not judged on the baseline). Unchanged units replay from the recorded E7 or E1 cassettes.
- **Typical cost per row**:
  - a one-file edit: 1 + 3 × 2 = 7 calls (13 under Option B when the baseline lacks both units);
  - a two-file edit (AP-FAT-CONTROLLER, AP-DUP-RULEn): 13 calls (25 under Option B).

| Part | Rows | Projected calls (Option A) | Projected calls (Option B) |
|---|---|---|---|
| Corpus seeds + twins | 57 (A) / 74 (B) | ≈ 450 | ≈ 1,000 |
| E1 seeds + twins | ≤ 650 (10 per cell × 65) | capped | capped |
| **Cap** | — | **1,500 calls in total** | **1,500 calls in total** |

- **Cap rule**: corpus rows are taken first, in full. E1 rows are added by whole cells in the seeded vendor-alternating order of ADR-037 (mulberry32(9502)), while the running projected total stays ≤ 1,500. The projected total, the cells taken and the rows dropped by the cap are recorded before any call.
- **Time**: at the measured median of 6.6 s per call, 1,500 calls take ≈ 2.8 h sequentially or ≈ 55 min at `maxConcurrency` 3. Calls per usage window are unmeasured (ADR-018 item 5); a usage-limit pause is resumed, never re-drawn.
- **Symbolic arm**: no model calls; one full-mode symbolic evaluation per base and per mutant.

## 5. Procedure (order fixed)

1. Register: ADR, prereg bump (anti-pattern catalogue frozen, code and this plan hashed), with Option A or B chosen.
2. E1 site count, label-free, with its own rule written first (as `judge-probe-e1-site-rule.md`).
3. Seeding (`scripts/mutate.ts --operator AP-…`, `--split held-out`) on the corpus and the chosen E1 cells. The manifest records rejections.
4. Projected-call table and cap selection committed.
5. Symbolic arm, then judge arm (record mode), then the four readings by replay.
6. Scoring (MAT-23, §3), and the readings of §3.4.

## 6. Threats to validity

- **Author-written operators.** The operators, their twins and this design come from one author. The edits are templates, so a judge may react to template cues (`validate<Method>`, `assert<Method>Rule`, `request?: Request`, `_request`) rather than the defect.
  - *Mitigation*: each twin is built by the same machinery with the same naming, so a cue that is not the defect fires on the twin and raises FAR. Edits follow each file's quote and indent style.
  - *Residual*: a twin is a different edit, never the same edit without the defect.
- **Circularity.**
  - The frozen FF-N01 and FF-N02 rubrics name these defect families ("bypass the module's own abstractions", "duplicate a rule or invariant", "persistence, transport or framework logic in a domain file", "business rules in … a presentation file"). The operators were chosen from the literature (catalogue §4), but the judged-function assignment was made after reading the rubric. A high DR therefore partly measures rubric-defect alignment by design. It does not show that the judge would find defects outside its rubric.
  - Neither the operators nor this design used any judge output, rationale or verdict. The judge-robustness and E7 rationales were not read for this work. The rubric itself was frozen earlier (RUB-01).
- **LLM familiarity.** These anti-patterns are textbook ones and the corpus repositories are public, so a model may have seen both. The mutants are new edits, but the defect shape is familiar. Results speak to textbook anti-patterns, not to novel defects.
- **Precondition tuning on held-out bases.** The preconditions were widened once, after a first label-free count on the 7 held-out bases (catalogue changelog). No label, detector or judge output was read, but the operator set is selected to fit these bases. The E1 cells were not seen. The E1 stratum is the cleaner test and is reported separately.
- **Small cells.** AP-FAT-CONTROLLER (≤ 4 corpus seeds) and AP-PERSIST-IN-DOMAIN (≤ 2) are too small for a per-operator reading on the corpus; §3.4's minimum of 8 applies. AP-FRAMEWORK-LEAK dominates the pooled rates, so pooled numbers are reported both per operator and macro-averaged.
- **Twin asymmetry.** Some twins edit more than their positive (AP-DUP-RULEn touches two files, AP-FRAMEWORK-LEAKn adds an interface). A larger edit gives the judge more to flag, which biases FAR up and Δ down (conservative).
- **Symbolic overlap is measured, not assumed.** The catalogue §3 prediction (judge-only by construction for four operators) is checked by S1 and S2 on the actual symbolic output. AP-PERSIST-IN-DOMAIN is a control and is excluded from the judge-only headline.
- **Placement (Option B).** Judging seeded units directly departs from how E1 and E7 judged (capped selection), and makes the proportional reading undefined for those runs. Option A keeps comparability but loses AP-FAT-CONTROLLER entirely.
- **Dilution at function level.** One seeded unit among up to 20 rarely moves a function verdict. Function-level and report-level readings are expected to be near 0 and say little about the judge.
- **No-install counts.** The site counts were taken on uninstalled clones. Seeding runs on installed copies, where resolution differs and the type-check gate can drop rows. The seeding manifest is the record.
- **Multiplicity.** 5 operators × 4 readings × 7 metrics. Only the five Δ (MAT-23) are pre-declared tests (Holm). Everything else is descriptive.

## 7. Open choices for the author (before registration)

1. Placement: Option A (frozen BR-U5a-27) or Option B (seeded-unit judging, recommended).
2. Cap: 1,500 calls, or another figure.
3. Whether AP-FAT-CONTROLLER may add a "calculation" variant if the E1 count also finds fewer than 8 seeds. Any such change happens before registration and goes in the catalogue changelog.
4. Whether E1-Codex cells form their own stratum or are pooled with Claude (default: own stratum, as in ADR-037).

## 8. Changelog

| Date | Change |
|---|---|
| 2026-10-12 | DRAFT written with the operators and the label-free site count; no call, no run |
