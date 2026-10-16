# Validity evidence summary (night of 2026-10-16)

**2026-10-16. Documentation only.** This page collects the validity evidence that the overnight jobs produced without human raters. No experiment was run to write it. Every number below is copied from its source and cited as `file:line`. A job that is missing or unfinished is marked as such, and it contributes no number.

## How to read the citations

Most of the evidence is on branches that are not merged. A citation in the form `[tag] path:line` points at the file on that branch. A citation without a tag points at `origin/v1.3` at `5f52a9f6`.

| Tag | Branch | PR | State on 2026-10-16 | Job status |
|---|---|---|---|---|
| — | `v1.3-validity-convergent` | #166 | merged into v1.3 (`db75b708`) | finished |
| — | `v1.3-model-panel` | #153 | merged into v1.3 (`e46aa6b8`) | harness only, fake-rater dry run, **no result** |
| — | `v1.3-blind-misses` | #134 | merged into v1.3 (`a893b0eb`) | finished (development set) |
| — | `v1.3-floor-probe` | #161 | merged into v1.3 (`6384b821`) | finished (one-session feasibility probe) |
| [FM] | `v1.3-validity-fixes-mined` | #168 open | not merged | finished (exploratory) |
| [PV] | `v1.3-validity-predictive` | **no PR** | not merged, tip `e37ef23e` | **unfinished**: no outcome analysis |
| [VS] | `v1.3-validity-strategy` | #147 open | not merged | methods memo |
| [EX] | `v1.3-external-set` | #133 open | not merged | tool runs finished, **nothing labelled** |
| [FA] | `v1.3-fidelity-adjudication` | #131 open | not merged | proposals only, **0 human verdicts** |
| [RG] | `v1.3-study2-readiness` | #146 open | not merged | gate and dress-rehearsal plan |
| [AR] | `v1.3-study2-analysis-rehearsal` | #160 open | not merged | finished, **synthetic data only** |

Main source files:

- Convergent: `Docs/DiagnosticRuns/v1.3-validity-convergent-2026-10-16.md` (CV).
- Model panel: `Docs/v1.3/model-panel.md` (MP).
- Blind misses: `Docs/DiagnosticRuns/v1.3-blind-misses-2026-10-16.md` (BM).
- Floor probe: `Docs/DiagnosticRuns/v1.3-floor-probe-2026-10-16.md` (FP).
- Fixes mined: [FM] `Docs/DiagnosticRuns/v1.3-validity-fixes-mined-2026-10-16.md` (FMR).
- Predictive: [PV] `Docs/v1.3/predictive-validity-prespec.md` (PVP).
- Strategy memo: [VS] `Docs/v1.3/validity-strategy.md` (VSM).
- External set: [EX] `Docs/DiagnosticRuns/v1.3-external-set-2026-10-16.md` (EXR).
- Fidelity adjudication: [FA] `Docs/DiagnosticRuns/v1.3-fidelity-adjudication-prep-2026-10-16.md` (FAR).
- Analysis rehearsal: [AR] `Docs/v1.3/study2-analysis-rehearsal.md` (ARD) and `results/v1.3-study2-rehearsal/summary.md` (ARS).
- Readiness: [RG] `Docs/v1.3/study2-readiness-gate.md` (GATE) and `Docs/v1.3/study2-dress-rehearsal.md` (DRP).

**What "Data" means in the tables.** *Dev* is data the v1.3 rules were tuned on: the 71-case reference set and the E1/SO4 corpora. *Independent* is code the rules were not tuned on: the external set and the wild set. Independent code still has one AI analyst's layer mapping, and that is noted where it applies. *Synthetic* is generated telemetry, not data.

**Strength** is this summary's grading:
- **strong**: clear result, adequate n, no major confound;
- **moderate**: clear result with a named confound or small n;
- **weak**: small, confounded or driven by one event;
- **null / negative**: no support, or evidence against;
- **none**: nothing measured.

---

## 1. Evidence by validity type

### 1.1 Content validity: do the rules cover the style's defining constraints?

| Evidence | Numbers as reported | Source | Data | Strength |
|---|---|---|---|---|
| Rule–source traceability | "8 rows VERIFIED-VERBATIM, 5 PARTIALLY SUPPORTED, none contradicted"; eight rules have no source row | [VS] VSM:56-58 | self-assessment | moderate ([VS] VSM:70) |
| Expressibility in independent tools | "of the 89 rule×style rows the v1.3 presets compile, **57 rows (21 distinct rules) cannot be expressed in any of the three tools**. Four of those rules are blocking in v1.3, in 7 style rows" (FF-P03 ×2 templates, FF-P06, FF-DT03) | CV:34-38 | n/a (static analysis of the rule set) | descriptive; shows the scope beyond import-graph tools, not that those rules are right |
| Blind reader vs construct answers | "The blind key is not the reading of any one consistent set of construct answers. That is the main finding of this unit." Class (b) rule/construct gap: **14** misses, **4** false alarms. Class (a) extractor gap: 0 / 0. Class (d) layer mapping: 0 / 0 | BM:164-165, BM:16-21 | dev (71-case reference set; "**not** validity estimates", BM:3-5) | **negative** for a single coherent construct reading; it locates every gap in Q4–Q25 decisions (BM:97-119) |
| Every switch the blind reading implies | Blind recall 62/65, but blind precision 62/86 and author recall 51/55. The best set that adds no blind false alarm (Q5 C + Q6 B + Q10 C + Q12 B) gives 55/65 and 55/55 | BM:146, BM:159, BM:145 | dev | trade-off shown; no answer chosen |
| Human source-fit rating | not done | [VS] VSM:80-82 (proposed: 3 architects × ~25 rules, about 2 h each) | — | none |

### 1.2 Construct validity: mechanical correctness, graph fidelity, seeded detection

| Evidence | Numbers as reported | Source | Data | Strength |
|---|---|---|---|---|
| Mechanical correctness (earlier v1.3 work, restated in the memo) | "all 2,668 checkable findings are correct", corrected to "**2,669**"; "423 of 3,091 findings (about 14 %) are not checkable" | [VS] VSM:87, :90, :105-106 | dev | strong for the narrow claim ([VS] VSM:102) |
| Correctness in the floor probe | "96 / 96 `correct`" (deterministic `check-correct.ts`) | FP:18 | one-session generated code | strong for the narrow claim, n = 96 |
| Graph fidelity vs tsc, external set, default graph (the one `evaluate` uses) | Pooled "**3443/3717 = 0.926 coverage, 3443/3810 = 0.904 confirmation**". Literal view "3717/3717 = 1.000 / 1.000". "On the 9 projects that import through barrels, it agrees at 0.67 to 0.89" | [EX] EXR:170, :174 | **independent** (15 human-written pre-2023 projects; specs committed before any tool ran, EXR:79) | strong for the literal view; **negative** for the default graph against V8's 0.95 bar |
| Graph fidelity, development corpora, **proposed** edge figures | E1: precision "1.0000 (3334/3334)", strict "0.9916 (3306/3334)", recall "0.9967 (3306/3317)". SO4: precision "1.0000 (2432/2432)", strict "0.9433 (2294/2432)", recall "0.9663 (2294/2374)". Opus task-management `none` default view: recall "**0.7000** (21/30)"; v13-literal 1.0000 | [FA] FAR:84-89 | dev; "**PROPOSED, NOT ADJUDICATED**" by an agent (FAR:3, :91) | weak until a human confirms; agent proposers "could read `author_reason`" (FAR:109) |
| Edge-level bug search | "**No edge-level tool-bug or reference-bug.**" Agreement samples: "all 171 were confirmed". One extractor gap: type-position `import('x').T` is never modelled | [FA] FAR:63, :79, :162 | dev, agent-proposed | weak (proposed) |
| Seeded detection on the reference set (corrected baseline) | "the tool finds **50/64** expected blocking violations and has **50/54** blocking precision" (blind view). Author view 54/54, 54/54 | BM:13-14, BM:131 | dev | moderate; "read every count as a count" (BM:4) |
| Proposed reference finding-level figures | after-member-facts: TP / FP / FN "61 / 7 / 7", precision 0.897, recall 0.897. "**These equal the author-literal figures exactly.**" | [FA] FAR:101, :103 | dev, agent-proposed | weak (proposed) |
| Seeded detection on the sealed hold-out | "207 sealed cases … **not yet run**" | [VS] VSM:120 | independent (sealed) | **none**: the decisive measurement has not been made |
| Findings on human code | 283 blocking and 955 advisory candidates on 15 projects (10 fail, 5 pass) | [EX] EXR:128 | independent | **none** for validity: "**No labels yet** … no precision, recall or meaningfulness can be stated" (EXR:196) |

### 1.3 Convergent validity: agreement with independent tools

These figures come from merged PR #166. The doc reports that "No LLM was called" (CV:3).

| Evidence | Numbers as reported | Source | Data | Strength |
|---|---|---|---|---|
| κ vs dependency-cruiser | reference "**1.000** (55 shared findings, 0 disagreements)"; external "**0.961** (301 / 21 / 3)"; wild "**0.913** (663 / 123 / 0)" | CV:17 | reference = dev; external and wild = **independent** | moderate: strong agreement on the keys compared, but the translation is the tool author's (CV:355) and the disagreement classes are post hoc (CV:361) |
| κ vs eslint-plugin-boundaries | reference "**1.000** (46 / 0 / 0)"; external "**0.930** (211 / 27 / 4)"; wild "**1.000** (439 / 0 / 0)" | CV:18 | as above | moderate (same caveats) |
| κ vs ArchUnitTS | reference "**1.000** (48 / 0 / 0)"; external "**0.918** (221 / 39 / 0)"; wild "**0.950** (348 / 36 / 0)" | CV:19 | as above | moderate (same caveats) |
| Import-direction rules (FF-S01, S03, S04, DS02) against the tool without a defect there | 1.000 / 1.000 / 1.000 | CV:20 | all three | moderate (same caveats) |
| Disagreements | "0 / 94 / 159"; classed our bug "0 / **0** / **0**". "**Every one of the 253 disagreements has a mechanical cause outside our rule logic.**" | CV:21-22, :27 | — | moderate: "**The disagreement classes are post hoc**" (CV:361) |
| Tool placement | "Our tool sits **inside** the cluster of external tools … ours~ArchUnitTS (0.918) lies between depcruise~ArchUnitTS (0.912) and boundaries~ArchUnitTS (0.923)" | CV:257 | external | moderate (an MTMM-style reading; same caveats) |
| Low per-rule κ (negative rows) | external FF-S02 vs ArchUnitTS **0.382**; FF-C04 vs dc **0.218**; FF-S01 graph vs boundaries **0.823**. Wild FF-S02 vs ArchUnitTS **0.611**; FF-C04 vs dc **0.279** | CV:263-284 | independent | explained as re-export and translation gaps (CV:338-344) |
| Defects the run exposed | "**Our FF-S02 cycle rule did not finish** on the 3 largest wild repositories (immich, medplum, podkrepi)"; "**A blocking rule silently drops out of the v1.3 verdict on large, densely cyclic code.** … This is our defect"; "**FF-P05 fails on cypher-interp** on all 36 clean and nestjs projects" | CV:40, :330, :41 | wild, all | **negative** (instrument defects) |
| Null findings | "**No view-choice disagreement.** … on this evidence the view choice is untested, not confirmed" | CV:348 | — | null |
| Stated limits | "**Agreement is not correctness.**"; "**The translation was written by the author of the tool under test** (TV-104)"; "Most items are negatives, so observed agreement is near 1 by construction" | CV:354, :355, :362 | — | — |
| Earlier dc comparison on SO4 (restated) | "DA 37/37, dc 28/37 (36/37 in the post-hoc `dts` variant); on the 6 dynamic-import seeds DA 0/6, dc 6/6" | [VS] VSM:213-214 | registered SO4 | moderate; this is the known dynamic-import gap |

### 1.4 Criterion validity, from developer behaviour (fixes mined) and predictive (bug-fix churn)

| Evidence | Numbers as reported | Source | Data | Strength |
|---|---|---|---|---|
| Fix mining: verdict | "**No robust validity signal.** The pooled blocking-tier removal rate is 2.65× the cross-layer baseline (74 vs 110 credited removals, 95% CI 1.97–3.56). That ratio rests on **one commit**" (amplication PR #93, "Lint Imports") | [FM] FMR:9 | **independent** histories: 36 projects, 7,904 snapshots (FMR:34, :71); protocol committed before any corpus run (FMR:5) | **null / negative** |
| Without that commit / one credit per commit / bootstrap | "0.93 (0.61–1.43)"; "1.00 (0.56–1.80). Only 14 distinct commits removed a blocking finding in 36 histories"; "0.37–7.54" | [FM] FMR:11-13 | independent | null |
| Sign test | "only 6 of 21 non-tied repositories remove blocking findings faster than their own baseline (two-sided p = 0.078, in the *wrong* direction)" | [FM] FMR:14 | independent | negative (not significant) |
| Dependency-direction family | "removed **less** often than unflagged cross-layer edges (rate ratios 0.65, 0.38 and 0)". The table gives FF-S04 RR "0.16 [0.01, 2.50]" with 0 removals | [FM] FMR:15, :204 | independent | negative |
| Survival | "one-year survival 0.76 without cycles vs 0.75 for unflagged cross-layer edges" | [FM] FMR:16 | independent | null |
| Commit messages | "fix commits mention architecture words no more often than baseline-removal commits (5/14 vs 21/55)" | [FM] FMR:17 | independent | null |
| FF-S02 cycles, the only signal | per-rule RR "14.62 [10.66, 20.05]". After length adjustment "about 3.9×". "Without the "Lint Imports" commit it is 2.7× (1.5–5.1) per exposure and below the length-adjusted expectation" | [FM] FMR:202, :19 | independent | weak: "weak, one-commit-driven evidence for the cycle rule" (FMR:26) |
| FF-DT01 / FF-DT02 | RR "9.61 [2.38, 38.87]" and "28.15 [6.97, 113.63]"; "come from n = 2" | [FM] FMR:195-196, :279 | independent | weak (n = 2) |
| Authors' reading | "developer behaviour does not validate the dependency-direction rules". The method cannot separate "findings wrong" from "findings right, debt tolerated" | [FM] FMR:26, :21-24 | — | — |
| Predictive (churn) | **No outcome result.** Prespec committed before any corpus run (PVP:3). Addendum 5: "18 of 27 T runs done, no T_alt run started, before any outcome model". Only 13 T exposure files and 3 history files are committed. Disclosed leak: one GLMM debug coefficient on 3 projects, "−0.01, SD 0.20" | [PV] PVP:3, :135, :121 | independent (27 active backends; external set excluded, `results/v1.3-validity-predictive/selection.json:716-717`) | **none** (unfinished) |
| Predictive: pre-fixed decision rule | "**Supported:** 95% CI lower bound > 1"; "**Contrary:** 95% CI upper bound < 1"; smallest effect of interest IRR 1.2 | [PV] PVP:86-88 | — | — |

### 1.5 Judgment validity of the "meaningful" label (model panel)

| Evidence | Numbers as reported | Source | Data | Strength |
|---|---|---|---|---|
| Cross-vendor panel | "**Status: harness built and dry-run with fake raters. No real model has been called, and nothing here is a result.**" Authority rule `panel-authority-v1` fixed "before any data" (MP:80). It needs ≥ 2 qualified vendors, decoy accuracy ≥ 0.85 and Fleiss κ ≥ 0.60 (MP:88, :98, :107) | MP:3 | — | **none** |
| Earlier same-vendor judge numbers (restated) | "agreed with the judge on 34 (weighted agreement 0.982, AC1 0.982), but Cohen's κ = 0" | [VS] VSM:253-254 | models | weak for validity ([VS] VSM:275) |

The dry-run figures (fake raters at 0.96 / 0.94 / 0.70, `results/v1.3-panel/dry-run/report.md`) test the harness only. They are deliberately not entered as evidence. A small inconsistency in them: the per-rater call counts 84 / 84 / 80 (`results/v1.3-panel/dry-run/report.md:122-124`) sum to 248, while commit `93d58d5c` says 240 calls.

### 1.6 Reliability

| Evidence | Numbers as reported | Source | Data | Strength |
|---|---|---|---|---|
| Engine parity, earlier work restated | "65,254 statements over 79 projects, 0 content differences"; "71/71 variants" | [VS] VSM:293, :295 | dev | strong ([VS] VSM:308) |
| Engine parity in the convergent run | "269/269, 208/208 and 235/235". "97 of 100 projects ran on cypher-interp" | CV:66, :62 | all three corpora | strong, but see the FF-P05 cypher-interp failure (CV:41), which "contradicts the cypher-interp note's parity claim at the current v1.3 head" (CV:331) |
| Fast cycle search vs reference implementation | "5,175 checks, 0 mismatches, 0 fallbacks" | [FM] FMR:64 | independent histories (parity checked only at ≤ 100 files, FMR:292) | strong for that bound |
| MCP `check_diff` vs full graph | "`check_diff` reported exactly the graph's blocking findings on all 31 step and fix diffs". But `check_import` "does not apply the hexagonal graph rules" | FP:140, :170 | one-session generated code | mixed |
| Reproduction audit, restated | "531 headline rows … 482 match, 26 mismatch … 7 ambiguous, 16 not checkable" | [VS] VSM:314-315 | internal | moderate ([VS] VSM:330) |
| Inter-rater reliability (human) | none: no independent human rater | — | — | **none** |
| Repeat runs on the external set | "One run per project, recorded. ... A repeat run was not made." | [EX] EXR:197 | — | none |

### 1.7 Outcome sensitivity and analysis readiness for Study 2

This is not a validity type, but it decides whether Study 2's outcome can show anything.

| Evidence | Numbers as reported | Source | Data | Strength |
|---|---|---|---|---|
| Floor probe, `none` arm | Steps with a blocking finding: "**14 / 28 (50 %)**: hexagonal **0 / 14**, layered **14 / 14**". New findings after step 1: "**4 / 22**, all layered". "None of the targeted pressures … caused a violation in either style" | FP:15-16, :19 | one Claude session wrote both the tasks and the code; "not blind to the rules" (FP:222-224) | **negative**: "**Study 2's primary outcome is at real risk of a floor effect.**" (FP:183) |
| Analysis script on synthetic telemetry | "30/30 checks pass at seed 20261016" (commit `83caae9c`); all CIs cover the planted values | [AR] ARS:9-38 | **synthetic** | strong for the script, says nothing about the instrument |
| Power at the planned N | expected effect: gate 0.54, mcp 0.17 (blocking); floor fallback 0.05 / 0.02 | [AR] ARS:42-47 | synthetic | **negative**: "At the planned N, Study 2 is underpowered for the expected effect" (ARD:152-153) |
| Seed sensitivity | mcp rejection: "Holm p 0.0461–0.0526 over 8 analysis seeds … The decision flips on 3 of 8 seeds" | [AR] ARD:117 | synthetic | — |
| Fallback outcome | FF-CV05 "about 80 % of the advisory total"; "The fallback outcome has no power (≈ 0.05)" | [AR] ARD:155-160 | synthetic | negative |

---

## 2. One-page summary for the director

**The question.** When DaedalusArch reports a blocking architecture violation, is it real, and does it matter? Last night several automated jobs tested this without any human rater.

**What held up**

1. **It reads code the way other tools do.** On 29 real open-source projects (15 pre-2023 human-written, 14 wild), the tool was compared with three established architecture checkers. Agreement was high: κ 0.913–1.000 (CV:15-19). In all 253 disagreements, none was traced to a fault in our rules (CV:22, :27). We sit inside the cluster of established tools, not outside it (CV:257). That classification was made after the fact, by the tool's author.
2. **Its findings are mechanically correct.** Every checkable finding points at code that really breaks the stated rule. This rests mostly on development data: 2,669 findings earlier ([VS] VSM:90) and 96/96 in last night's probe (FP:18).
3. **Its import graph is exact in the literal view.** On 15 independent human-written projects it matched the TypeScript compiler at 1.000 ([EX] EXR:170).

**What did not hold up, or is not yet known**

4. **Developers do not behave as if the findings matter.** Over 36 project histories, flagged dependencies were not removed faster than ordinary ones ([FM] FMR:9-17). The single exception, dependency cycles, rests mostly on one commit ([FM] FMR:19, :26). This is an honest null result, and the method cannot tell "the rule is wrong" from "the debt is tolerated" ([FM] FMR:21-24).
5. **The graph that scoring actually uses loses edges through "barrel" files.** Coverage is 0.926 on human code, below our own 0.95 bar ([EX] EXR:170). This is fixable, either by scoring on the literal view or by fixing routing.
6. **The rules do not match any single consistent reading of the architecture styles.** An independent reader's expectations cannot be reproduced by any one set of construct decisions (BM:164-165). The author must decide the 25 construct questions; the trade-offs are now quantified (BM:132-146).
7. **We have no validity figure on data the tool was not tuned on, yet.** The sealed hold-out has not been run ([VS] VSM:120). The 283 findings on human code are unlabelled ([EX] EXR:196). The cross-vendor model panel and the bug-churn study are not finished (MP:3; [PV] PVP:135).
8. **Study 2, as designed, risks measuring nothing.** In a probe, hexagonal-style code never produced a blocking violation (FP:15). At the planned size, the study has about 54 % power for the main contrast and 17 % for the MCP arm ([AR] ARS:45).

**Bottom line.** The instrument is reliable on engine parity, but it has no human inter-rater or repeat-run reliability yet, and two engine defects are open (CV:40-41, :331). It is mechanically correct, mostly on development data, and it agrees with independent tools. Whether its findings are *meaningful* is still unshown. One behavioural test came back null. Four steps would close the main gaps:
- run the sealed hold-out once;
- have one independent developer label the external-set findings;
- run the model panel;
- finish the churn study.

Of these four, only the labelling needs a person, for about 3–5 hours ([VS] VSM:360). The gap table in §3 lists further human steps: G3, G12 and the optional G13.

---

## 3. Remaining gaps and the cheapest way to close each

| # | Gap | Why it matters | Cheapest way to close | Needs a human? |
|---|---|---|---|---|
| G1 | No validity figure on data the tool was not tuned on | Every v1.3 figure is development data ([VS] VSM:349) | Fill the hold-out prespec placeholders after V1, then run `scripts/v1.3/holdout-run.ts` once at the freeze commit (GATE:99-103) | author decision only |
| G2 | The 283 external blocking findings are unlabelled | It is the only independent precision measurement within reach | One professional TypeScript developer labels `results/v1.3-external/labelling-sheet.csv` (313 rows, [EX] EXR:141) under `human-labelling-protocol.md`. Alternatively, run the panel on the same sheet first | yes, one rater |
| G3 | Fidelity adjudication is agent-proposed only | V8 needs adjudicated rows | The author or the rater confirms or rejects the 235-row `review-sheet.csv` ([FA] FAR:136-141), then copies verdicts to `human_verdict` (FAR:189) | yes |
| G4 | Default graph coverage 0.926 < 0.95 on human code | The score may miss barrel-routed violations | Decide (ADR) to score on the literal view, which is 1.000 ([EX] EXR:173), or fix routing and re-run `graph-fidelity.ts --views` on the 15 projects (seconds per project, EXR:101) | author decision |
| G5 | The construct questions are unanswered, and the blind key fits no single answer set | Blocking rows move with each answer | The author answers Q1–Q25 using BM:132-146 as the trade-off table; the "no added blind false alarm" set gives 55/65, 55/55 (BM:145) | author only |
| G6 | Model panel never run | No judgment reference for "meaningful" | Run on the author's machine with Gemini and OpenAI keys. Expect about 210 calls per vendor; illustrative cost ≈ $0.7–$33 per vendor depending on price tier (MP:194, :204-206) | author runs it |
| G7 | Predictive study unfinished | No predictive evidence at all | Finish the 9 remaining T runs and all T_alt runs within the pre-set caps (4 h at T, 1 h at T_alt; [PV] PVP:133, :137). Then run `analyze.py` unchanged | no |
| G8 | Developer-fix evidence is null | Weakens the "meaningful" claim | Report it as is. Optional: re-run on repositories that enforce rules in CI (maintainer-written rules, [VS] VSM:246-249), where removals are not incidental | no |
| G9 | FF-S02 drops out on large cyclic code; FF-P05 fails on cypher-interp | Silent loss of a blocking rule (CV:330) | Fix both defects before the freeze commit. Neo4j stays the engine of record (GATE:355-356) | no |
| G10 | Hexagonal floor effect in Study 2's outcome | The primary contrast may be unmeasurable | Wait for the loop pilot; FP:214-216 already states the rule ("If its hexagonal `none` run is also all zeros, redesign or drop the hexagonal tasks") | author decision |
| G11 | Study 2 underpowered (gate 0.54, mcp 0.17) | D3 cannot pass | Re-run the power simulation with pilot θ; consider fewer arms or more replicates ([AR] ARD:152-153) | author decision |
| G12 | Same-vendor threat in specs and adjudication | All layer maps and proposals are Claude-made ([EX] EXR:185; [FA] FAR:3) | A blind human-written spec for the 15 external pins ([EX] EXR:186). This could be done together with G2 | yes |
| G13 | Content: eight blocking rules have no source row | Content validity is unsupported for those rules | Add source rows or demote them to advisory ([VS] VSM:78-79). The optional architect rating takes about 2 h each (VSM:80-82) | optional |

---

## 4. Readiness-gate lines affected by the night's work

`study2-readiness-gate.md` exists only on [RG] (PR #146, unmerged). Its statuses were taken at `4339bad5` (GATE:5). This table updates only the lines that the night's jobs touch. Per gate rule 3 (GATE:22), nothing turns green until the check is re-run on the run commit, and evidence on unmerged branches does not count (GATE:5).

| Line | Gate status (GATE) | Status after the night | What changed |
|---|---|---|---|
| V1 Construct decisions | RED (GATE:31) | **RED** | BM maps all 14 misses and 4 false alarms to Q4, Q5, Q6, Q7, Q10, Q12, Q13, Q20 and Q25. It shows that no consistent answer set reproduces the blind key (BM:97-119, :164-165). Still 0/25 answered |
| V4 Hold-out claim level | RED (GATE:34) | **RED** | Proposed dev-corpus edge figures exist ([FA] FAR:84-89), not adjudicated (FAR:3) and not hold-out (FAR:91). No file-to-layer figure from FA. Hold-out not run |
| V5 Independent human rater | RED (GATE:35) | **RED** | The panel replaces authority, not a human rater (MP:7, :16). No rater named |
| V6 One κ definition | RED (GATE:36) | **RED, more definitions** | The night added two more κ uses: pooled-key Cohen κ (CV:188-207) and the panel's Fleiss κ ≥ 0.60 among vendors (MP:107). The human-label κ still has three definitions |
| V8 Graph fidelity | RED (GATE:38) | **RED** | External default graph 0.926 pooled is unchanged ([EX] EXR:170). The 39 E1 disagreement rows now carry agent proposals, but 0 of 89 rows have a `human_verdict` ([FA] FAR:9, :3). New gap: type-position `import('x').T` is not modelled (FAR:162). No loop-snapshot fidelity run |
| V9 MCP agrees with full evaluation | RED (GATE:39) | **RED** | Floor probe: `check_diff` matched the graph on 31/31 diffs (FP:140), but `check_import` misses the hexagonal graph rules (FP:170) |
| V10 Same-vendor threat | RED (GATE:40) | **RED** | (a) No non-Claude generator was run. (b) External set still unlabelled ([EX] EXR:147). The panel's leave-one-vendor-out reading (MP:132) covers raters only, and has not run. (c) Unchanged |
| V11 Label leakage | UNKNOWN (GATE:41) | **UNKNOWN** | The panel's blinding check passed on the dry run, 40/40 items (MP:51), but no real data has gone through it. `Docs/v1.3/night-backlog-2026-10-16.md:531` notes it is unrecorded whether the blind-manifest writer saw scrubbed source |
| S5 No-layout-hint arm | RED (GATE:47) | **RED** | The floor probe always gave the folder sentence (FP:50-55). Floor probe 2 (PR #182, unmerged) studies layout sentences as levers; it is not summarised here |
| S6 FF-CV05 excluded; per-rule advisory | RED (GATE:48) | **RED, prerequisite merged** | PR #142 is now in v1.3 (`c4076100`), and `advisoryByRule` is written by `scripts/lib/loop/evaluator.ts:39-41`. [AR] confirms the fallback is not computable without it, and computable with it ([AR] `results/v1.3-study2-rehearsal/floor/report.md:25`). It still needs rehearsal step records |
| S7 Live evaluator, zero errors | RED (GATE:49) | **RED** | The tsconfig fix landed with PR #142. The floor probe scored hand-written snapshots with `evaluate` (FP:62-63), but these were not loop snapshots, and a zero error count is not stated |
| S8 Every model tier live | RED (GATE:50) | **RED** | The floor probe used one session, "no second model" (FP:220-221) |
| S15 Model labeller routes | UNKNOWN (GATE:57) | **UNKNOWN** | The panel design sets tools off per route (MP:61-74) and states quota and resume rules (MP:187, :208). No route was probed live |
| D1 Outcome variance (no floor) | RED (GATE:59) | **RED, negative evidence** | Hexagonal `none` 0/14 steps with a blocking finding (FP:15). Layered shows a step-1 level effect, not a slope (FP:22). No slope SD or θ. The pilot still decides (FP:214-216) |
| D3 Power | RED (GATE:61) | **RED, confirmed** | [AR] reproduces power 0.54 for gate and 0.17 for mcp at the working grid ([AR] ARS:45; ARD:152-153). The task-level test "can never reject" (ARD:182) |
| D6 Telemetry incl. MCP call log | RED (GATE:65) | **RED** | [AR] lists "MCP tool calls per step" as not computable |
| D9 Analysis script end to end | RED (GATE:68) | **RED, synthetic half done** | `scripts/v1.3/study2-analyse.ts` produces T0–T11 and F1–F2 on synthetic out-roots, with planted effects recovered (30/30, [AR] ARS:9-38). It is unmerged (PR #160), and DRP:103 also requires the real rehearsal out-root. 7 items are not computable (GLMM, Q4 measures, D13 guards, MCP calls, acceptance checks, judge dimensions) |
| D11 Arm set | RED (GATE:69) | **RED** | [AR] flags D11b and D11c ambiguities among its 25 listed ambiguities (ARD:179-205) |
| D13 Gaming guards | RED (GATE:71) | **RED** | Not computable in [AR]. Floor probe: FF-S03 double-counts upward edges, "31 of the 65" (FP:177-179) |
| D16 Q4 independent measures | RED (GATE:74) | **RED** | dependency-cruiser now agrees with the tool on every import-direction key in three corpora ("722 shared findings, 0 disagreements", CV:290). This supports using it as the independent measure, but nothing computes it per step, and [AR] lists it as not computable |

**Gate total after the night.** The gate's own count is unchanged: 1 green (V2), 1 partial (D14), 32 red, 8 unknown. **NO-GO.** No line changes colour. D9 and S6 moved from "nothing exists" to "half built". D1 and D3 now have evidence pointing the wrong way.

Some status sentences cite a PR that has since been merged: PR #142 for S6, S7 and D7, and PR #135 for D8. Those lines keep their colour. Gate rule 3 requires them to be re-verified on `v1.3`.

---

## Sources not used, and why

- `v1.3-validity-predictive` has no PR and no outcome result. Only its pre-fixed design and status are cited.
- `results/v1.3-panel/dry-run/` contains fake-rater output, which is not evidence (MP:237).
- Related open PRs that the night's jobs did not list are not summarised here: #167 external correctness, #181 external set wave 2, #182 floor probe 2, #185 metamorphic, #186 spec-author reliability and #190 rule mutation. Some of them may change the convergent, reliability and V8/V10 rows once they are read.
