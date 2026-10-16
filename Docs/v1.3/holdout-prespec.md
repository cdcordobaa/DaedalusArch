# v1.3 hold-out run: pre-specification

**2026-10-15. Status: draft, to be frozen.** This file fixes, before the run, how the one-time hold-out run is done, scored and read. At freeze time its placeholders are filled, and its sha256 is recorded in `Docs/v1.3/sealed-hashes.md`. After that it does not change. Any later note goes into a separate addendum, which is dated and hashed on its own.

It is not a pre-registration of Study 2. It covers only the validation of the tool (FR-V11).

## 1. What is frozen

| Item | Value |
|---|---|
| Tool commit | `<FREEZE_SHA>` |
| Hold-out manifests (sealed outside the repository) | path `<HOLDOUT_PATH>`, sha256: see the row "../daedalus-sealed/v1.3-holdout (directory manifest)" in `Docs/v1.3/sealed-hashes.md`, section "Hold-out and blind manifests (recorded late, 2026-10-15T20:38Z)" (`1379b561…`; the author's own `out.sha256` value is `cddec14a…`). The blind manifests are hashed in the same section. |
| Rule tiers | `Docs/v1.3/rule-tiers.md` at its sealed hash, plus the tier ADRs merged at `<FREEZE_SHA>` |
| Defaults | the v1.3 extractor and compile defaults at `<FREEZE_SHA>` (`V13_DEFAULT_OPTIONS`, `V13_COMPILE_OPTIONS`) |
| Presets, templates, specs | as at `<FREEZE_SHA>`, sha256 of each listed in the freeze commit |
| Matching | `scripts/v1.3/lib/compare.ts` at `<FREEZE_SHA>` |

**How the freeze works.** Commit X holds the tool. Commit Y fills `<FREEZE_SHA>` = X in this file and records the file's hash. The run uses the code at X. Before the run, `git diff X Y -- src scripts presets specs` must be empty. Construct decisions that change code (`Docs/v1.3/construct-decisions.md`) must be merged before X, including their single development-set runs (Q16, Q25). Nothing merges between X and the run.

### Known limitations of the hold-out (added 2026-10-16, after the adversarial review)

- **Same vendor.** The hold-out was written by a Fable model, the same vendor as the tool's judge (`claude-opus-5-5`), the blind-manifest annotator and the coordinating agent. It is independent of tuning, not independent of the vendor.
- **Enlarged after tuning.** It was enlarged from 62 to 207 cases on 2026-10-15 (commit `3e69928f` on v1.2e), after the after-fixes development measurement (`b35bf172`) and after `construct-decisions.md` (`be17c4d9`) listed the contested constructs. The enlargement was done by the AI under the author's "max progress" delegation, without an explicit author decision, and the enlarging agent had access to the development-set results. Its hashes were recorded late (see `sealed-hashes.md`).
- **Unverified rule input.** The hold-out author's rule input was `Docs/v1.3/style-rule-sources.md`, a paraphrase of the sources that had not been checked against the books. `Docs/v1.3/rule-source-verification.md` and `Docs/v1.3/style-rule-sources-errata.md` have since found rows that are only partly supported and rules with no source row.
- **No human check of its construct distribution.** No human has checked whether the 207 cases' construct distribution mirrors the development set's contested list or the tool's implemented constructs.

**Recommended mitigation.** Score, alongside the hold-out, one external, non-Claude-authored project per style, with rules written by someone outside the project (for example dependency-cruiser `forbidden` rules or Nx boundaries). Report it as a separate arm.

## 2. The run

1. The author unseals the hold-out projects into a temporary directory outside the repository and outside any `node_modules` ancestry.
2. One live run at X, with the same pipeline as the development runs: `scripts/v1.3/ue-baseline-live.ts`, then `ue-graph.ts`, then `ue-score.ts --base results/v1.3-holdout/run-1 --blind <hold-out manifests>`. One capped Neo4j, holding the cross-process lock (NFR-V2). The exact commands are `Docs/v1.3/freeze-runbook.md` §B (`scripts/v1.3/holdout-run.ts`, which runs this pipeline and the scoring of §3–§5). **Engine:** every reported figure comes from Neo4j 5.26.x with APOC core; the in-process interpreter (`--engine cypher-interp`) runs once afterwards as an engine cross-check (runbook §C). A difference is a defect under §6, and the Neo4j figures stand.
3. **A repeat is allowed only to check determinism.** If a second run differs from the first in any finding, that is a defect, recorded under §6. The first run stands.
4. The outputs are committed unchanged, with `holdout-run-provenance.json` (the runner's provenance file), before anyone labels anything (§7).

## 3. Metrics

Every proportion is reported as x/n with a 95% Wilson interval. Every figure is given per style (clean-architecture, layered, nestjs, hexagonal, ddd) and pooled.

| # | Metric | Definition |
|---|---|---|
| M1 | **Blocking recall** | Expected blocking findings that the tool reports, divided by all expected blocking findings. |
| M2 | **Blocking precision (manifest)** | Reported blocking findings that the manifest expects, divided by all reported blocking findings. |
| M3 | **Blocking precision (correct)** | Reported blocking findings that `scripts/v1.3/check-correct.ts` labels `correct`, divided by its checkable findings. `not-checkable` findings are listed with their reason. |
| M4 | **Advisory figures** | Recall, precision and counts for the advisory rules, per rule and style. They are **reported separately** and never enter a pass or fail. |
| M5 | **Negative control** | The clean variant of each project. Every blocking finding there is a false alarm, unless the manifest expects it. Reported as false alarms per clean variant, and as clean variants with at least one false alarm out of all clean variants. |
| M6 | **Near-miss false alarms** | Near-miss variants with at least one unexpected blocking finding, divided by all near-miss variants, with each false alarm listed. |
| M7 | **Graph agreement** | Import-edge precision and recall against the hand-written expected graph, and file-to-layer accuracy. Both are given literally first, then after adjudication of every disagreement (validation protocol §2). Agreement with dependency-cruiser and the TypeScript compiler is reported as agreement, not as precision. |

Also reported, without a target: per-rule recall and precision, which are descriptive only because per-rule n is small, and every miss and false alarm with its file and reason.

## 4. Scoring against the hold-out manifests

- **The reference is the sealed manifest, as sealed.** Nobody edits a manifest after the run. A manifest that looks wrong is recorded under §6. It is not corrected in the figures.
- **Matching** is that of `compare.ts`: rule, file, target, and the file set for cycles. The two declared normalisations of `ue-score.ts` are reported next to the literal figures. **The literal figures are primary.**
- **Two manifests.** If a hold-out project carries both an author-manifest and a blind manifest, each is scored on its own and both are reported. The pass decision uses the manifest written without sight of the rule implementation, because the author-manifest's writers could see it (validation protocol §1).
- **Construct decisions.** A rule whose tier is still deferred at X, such as FF-DS01 under Q15, has its findings reported separately and kept out of M1 and M2. This is listed in the freeze commit.

## 5. Pass thresholds

These are the exit targets of `aidlc-docs/inception/requirements/v1.3-validity-requirements.md` (amended by `Docs/v1.3/validation-protocol.md`).

| Metric | Target |
|---|---|
| M1 blocking recall, **per style** | ≥ 0.90 |
| M2 and M3 blocking precision, per style and pooled | ≥ 0.90 |
| M7 adjudicated import-edge precision and recall, and file-to-layer accuracy | ≥ 0.95 |

Each target is checked twice, and **both results are reported**:
- **against the point estimate**;
- **against the 95% Wilson lower bound.**

**What the lower bound can show.** With no misses at all, the 95% Wilson lower bound of a proportion reaches 0.90 only at n ≥ 35. With one miss, it needs n ≥ 53, and with two, n ≥ 69. If a style has fewer than 35 expected blocking findings in the hold-out (n = `<N_PER_STYLE>`, filled at freeze from the sealed counts), its lower-bound check **cannot pass, even with a perfect result**. This is stated now so that it is not read as a failure later.

**Claim levels**, decided per metric and per style:

| Level | Condition |
|---|---|
| **Validated** | point estimate and lower bound both meet the target |
| **Validated at the point estimate** | the point estimate meets the target, and the lower bound does not; the report gives the bound |
| **Characterised** | the point estimate misses the target |

M5 and M6 have no numeric target. Their false alarms enter M2 and are also reported on their own.

## 6. No tuning, and what happens on failure

- **No tuning on the hold-out, of any kind.** No rule, tier, template, preset, spec, extractor option or matching rule changes because of a hold-out result. No hold-out case is moved, dropped or re-labelled. The hold-out is run once; after that it is spent.
- **Results are reported as they come out**, at every claim level, including failures.
- **Defects go to an ADR.** Each miss, false alarm or graph disagreement is classified by the author as a rule defect, a manifest defect, an extractor defect or an ambiguous construct, and recorded in one ADR (`ADR-V13-xx: hold-out defects`). The classification never changes a figure.
- **On failure, the claim becomes "characterised"** for that metric and style: the thesis reports what the tool does, its errors, and their classes. It does not say "validated".
- **Fixes are for later versions.** A fix may be made after the ADR, but it is evaluated on new data (Study 2's fresh projects or a new hold-out). It is never re-scored on this hold-out as a validity figure.

## 7. Labelling only after the run

- The human raters and the Gemini labeller see **nothing** of the hold-out until the run's outputs are committed (§2, step 4).
- Then the blind union labelling of `Docs/v1.3/human-labelling-protocol.md` runs, and the Gemini *meaningful* labeller runs as in `Docs/v1.3/labelling.md`.
- Their figures are a **separate human reference**, reported beside §3. They do not change §5, and they are not used to tune anything.
- Disagreements between raters on the hold-out are reported as disagreements. The author does not adjudicate them (protocol §4).

## 8. Report

`Docs/DiagnosticRuns/v1.3-holdout-<date>.md` and `results/v1.3-holdout/run-1/`. The report gives every metric of §3, the claim level of every target in §5 with both checks, the negative control, the near-miss false alarms, the defect ADR's link, and the hashes of §1. The FR-V11 validation report cites these figures and no development-set figure as validity.
