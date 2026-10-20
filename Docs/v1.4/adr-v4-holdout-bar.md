# ADR-V14-04: one hold-out bar for V4, and the "characterised" route (decision V4, option c)

**Date:** 2026-10-19. **Status: Accepted under the author's delegation (2026-10-20), bar option (1), margins A = 0.05 and B = 0.10, as proposed.** Accepted under delegation, not signed: the author delegated every remaining signature to the coordinator (`ops/decisions.md` DELEG2; `ops/05-plan-to-friday-2026-10-23.md`). Accepted before the freeze tag and before the hold-out run, with no hold-out figure, count or manifest seen. Originally: it takes effect when the author signs it below. **It must be signed and merged before the freeze tag, and so before the sealed hold-out runs.** The hold-out has not run: gate V3 is RED and `results/v1.3-holdout` does not exist (`Docs/v1.3/study2-readiness-gate.md:109`).

**Written by** an AI session from the author's decision V4, option (c) (`ops/decisions.md:22`). No sealed directory, no hold-out count, no manifest and no `.env` was read. The sealed counts per style are not known to this ADR; it uses only the estimates on file. Zero model calls.

## 1. Context: three bars on file

| Where | What it says the bar is |
|---|---|
| Gate V4, `Docs/v1.3/study2-readiness-gate.md:113-116` | Point recall ≥ 0.90 per Study 2 style ("validated at the point estimate"). The lower bound is reported, not part of the pass. A characterised style is red and cannot use blocking counts. No waiver |
| F23 note, `Docs/DiagnosticRuns/v1.3-f23-and-v4-count-2026-10-18.md:135` | Point recall ≥ 0.90 **and** 95 % Wilson lower bound ≥ 0.80. Below that, "characterised", with no blocking outcome in Study 2 |
| TRUST-01, `ops/notes/trust-01-path-to-a-trusted-instrument.md:40` | "Per-style point recall ≥ 0.90 claimed where reached; otherwise 'characterised', plus the per-arm non-differential check in the study" |

REV-04 and REV-05 both flag the three (`ops/notes/rev-04-gaps-and-promises-2026-10-19.md:231`; `ops/notes/rev-05-first-study-fable.md:145`, `:179`). The prespec adds three claim levels (validated, validated at the point estimate, characterised) and reports both the point and the lower bound (`Docs/v1.3/holdout-prespec.md:67-83`).

**What the count expects.** Development blind recall is 0.70 for Layered and 0.78 pooled (N105). With hold-out recall equal to that, P(Layered point ≥ 0.90) is about 0.00–0.03 at n = 32–36 (`v1.3-f23-and-v4-count-2026-10-18.md:113-115`). U6 may lift Layered to about 0.80 (`rev-04:33`). So Layered is more likely than not to end "characterised". This is said now so that it is not read later as a goalpost move.

## 2. Decision: one bar

**V4 governs the instrument-accuracy claim** (decision V4 (c)). From the signature on, this is the only V4 bar. It replaces the three above.

**The bar (values proposed).** Per style, on the sealed hold-out, scored once at the freeze tag, against the **blind** manifests (the manifest written without sight of the rule implementation, `holdout-prespec.md:58`):

| Metric | Pass |
|---|---|
| M1 blocking recall | point ≥ **0.90** and 95 % Wilson lower bound ≥ **0.80** |
| M3 blocking precision (correct) | point ≥ **0.90** and 95 % Wilson lower bound ≥ **0.80** |
| M7 import-edge precision, recall and file-to-layer accuracy | point ≥ **0.95** (as the gate, `:113`) |

**Reading.**
- A style that passes is **"accurate at the V4 bar"**. The thesis may then make the instrument-accuracy claim for that style.
- A style that misses on any row is **"characterised"**. The thesis reports its point estimate and interval, and makes no accuracy claim for it.
- The prespec's three claim levels stay as reporting labels in the FR-V11 report. They do not decide anything.
- Reported, never gated: a case-clustered interval next to each Wilson interval (as for C3 external correctness, `ops/01-instrument-map.md:177`); the author-manifest figures; the adjudicated development figure, labelled "not independent" (U6 design §4, `aidlc-docs/construction/v1.4/U6/functional-design/design.md:196`).

**Why 0.80 for the bound.** At the expected n (Layered about 32–39, DDD about 29–32), a lower bound of 0.90 needs n ≥ 35 with zero misses. A bound of 0.80 is reachable at n ≥ 25 with one miss and n ≥ 33 with two (`v1.3-f23-and-v4-count-2026-10-18.md:107`, `:136`).

**This tightens the gate.** Gate V4 leaves the bound out of the pass (`study2-readiness-gate.md:116`). Adding it is stricter, not looser. It is declared as a pre-run protocol change.

**Minimum n.** `<N_PER_STYLE>` is filled at the freeze from the sealed counts (`holdout-prespec.md:75`). A style with n < 25 cannot reach the bound with even one miss. It is "characterised" unless its result is perfect, and this is stated in the freeze commit.

> AUTHOR: the bar is yours. Options: (1) as above, point and bound; (2) point only, as the gate now reads (the bound reported). Option 2 is easier to pass and weaker to defend.

## 3. The "characterised" route, named in advance

For a style the hold-out only characterises:

1. **Instrument claim.** "Characterised": point recall and precision with intervals, the miss list by rule family, and no accuracy claim. This is a finding, not a failure to report (`rev-04:265`).
2. **Confirmatory Study 2.** The style may **stay a confirmatory stratum only if** the per-arm non-differential miss check (§4) passes. If the check fails, or cannot be run, the style is **exploratory** in Study 2.
3. **The thesis wording** for a characterised style that stays confirmatory: "The instrument's recall for this style is characterised at X [L, U]. Its misses are non-differential between arms by a pre-registered check, so the arm comparison is not biased by them. Absolute counts are under-counts."
4. **What does not change.** Precision rules: every counted finding is `correct` by `check-correct.ts`. No rule is changed after the hold-out to lift recall. Nobody edits a manifest after the run (`holdout-prespec.md:56`).

## 4. The per-arm non-differential miss check (pre-registered form)

**Why.** If the instrument misses more violations in one arm than another, a lower count in that arm may be a measurement artefact, not an effect. Option (c) allows a characterised style to stay confirmatory only if this is ruled out (`ops/decisions.md:22`).

**The check has two parts. Both must pass.** All margins are **proposed**. Their final values go into the Study 2 pre-registration before the main run.

**A. Exposure to weak rule families.**
- From the hold-out, take per-style recall r_f for each rule family f (FF-S01, FF-S02, FF-S03 and so on).
- For each Study 2 cell c, take the share s_c(f) of its counted identities in family f.
- The expected miss rate of cell c is m_c = Σ_f s_c(f) × (1 − r_f).
- **Pass:** for every confirmatory contrast pair (c, c′), |m_c − m_c′| ≤ **0.05**.

**B. Seeded recall on agent code, by arm.**
- Use the seeded-recall check on study snapshots: mutation operators applied to a seeded sample of step-5 snapshots, 0 model calls (`Docs/v1.4/exploratory-study-registration.md` §9; `rev-05:148`).
- Compute seeded recall per cell, with a snapshot-clustered bootstrap interval of each pairwise difference (10,000 resamples, seed fixed in the pre-registration).
- **Pass:** for every confirmatory contrast pair, the 95 % interval of the difference covers 0 **and** |difference| ≤ **0.10**.

**Dry run.** Both parts run first on the exploratory study's snapshots. That shows the check works and how wide its intervals are. It does not decide anything for Study 2, because the exploratory study makes no confirmatory claim.

**If it fails.** The style is exploratory in Study 2. The failure and both parts' figures are reported.

## 5. What this changes elsewhere (when signed)

| Document | Change |
|---|---|
| Gate V4, `Docs/v1.3/study2-readiness-gate.md:111-117` | Read the Pass line through this ADR (dated note added there now) |
| Drift record §7, V4 row (`Docs/v1.4/study2-deviation-2026-10-19-drift.md`) | "A style the hold-out only characterises is reported as exploratory" becomes "… is exploratory unless §4 of ADR-V14-04 passes". This is a change to the confirmatory protocol. It is written there as a dated deviation **when this ADR is signed**, not before |
| `Docs/v1.3/compendium/open-items.md:19`, `ops/02-defensibility-conditions.md:13` | Point to this ADR for whether the bound blocks (pointer added now) |
| TRUST-01 L5 row | Points here (done now) |
| `ops/notes/deviations-v14.md` row 7 | "ADR drafted, unsigned" (done now). Once signed, it becomes a declared deviation, because it changes a gate line after development results were seen |

## 6. What had been seen

- Development blind recall per style (N105) and the F23 count (`v1.3-f23-and-v4-count-2026-10-18.md` §2.4).
- No hold-out result, no sealed count, no hold-out manifest.
- The author chose option (c) knowing that Layered is likely characterised.

## Sign-off

> AUTHOR: sign — ADR-V14-04 adopted with bar option (1) / (2), margins A = ____, B = ____. Signed: __________ Date: ____-__-__ (must be before the freeze tag and before the hold-out run).

**Accepted under delegation, 2026-10-20 (not signed):** ADR-V14-04 adopted with bar option (1), point and bound; margins A = 0.05, B = 0.10, as proposed. By the coordinator under DELEG2, before the freeze tag and before the hold-out run; no hold-out figure had been seen.

## Changelog
- 2026-10-19: first version (draft for signature).
- 2026-10-20: accepted under the author's delegation (DELEG2), option (1), margins as proposed; before the freeze tag and the hold-out run.
