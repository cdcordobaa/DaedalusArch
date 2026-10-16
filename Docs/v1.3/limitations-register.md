# Limitations register (gap G6)

**2026-10-16. Status: working register; doc only.** This register lists every null, weak or partial result in the
v1.3 evidence on 2026-10-16, with the document that reports it. It is meant as the source for the thesis's
limitations chapter and for the "what the numbers do not show" notes beside headline tables (G6, item 3). The
general threats are in `Docs/threats-to-validity.md` and the v1.3 register (PR #130). This file does not repeat
them. It lists results. Data classes and statuses follow `Docs/v1.3/claims-ledger.md`.

Each entry gives the result, what it limits, and where it is reported. No entry is resolved by this file.

## 1. Null results

| ID | Result | What it limits | Document | Class, status |
|---|---|---|---|---|
| L01 | **Judge unanimity does not predict correctness.** 95% of verdicts are unanimous; unanimous accuracy is v1 0.883 against 0.889 overall, v2.1 0.900 (Wilson lower bound below 0.80). The pre-stated rule is not met. | No confidence or abstention claim for the judge. | `Docs/DiagnosticRuns/v1.3-judge-selective-2026-10-16.md` | DEV, open #165 |
| L02 | **Judge v2.2 is NOT CANDIDATE** on CHECK-2 (check D1 fails). v1 stays the default. | The SO3 judge claim stays at v1's level (L07). | `Docs/DiagnosticRuns/v1.3-judge-v22-check2-2026-10-16.md` | DEV, open #191 |
| L03 | **Precedent probe: 0/8 planted vs 0/8 control.** The agent neither copied nor repaired a planted shortcut. | Brownfield precedent is not shown to be a lever that would lift the Study 2 floor. One agent, which also wrote the hypothesis. | `Docs/DiagnosticRuns/v1.3-precedent-probe-2026-10-16.md` §0 | DEV, open #189 |
| L04 | **Floor probe 2: the layout sentence is not the lever.** C2 and C3 at 0/8, C1 at 1/8. Removing the sentence moved 19/28 hexagonal files out of every layer glob. | Study 2 framing (S5); the floor stays. | `Docs/DiagnosticRuns/v1.3-floor-probe-2-2026-10-16.md` §0 | DEV, open #182 |
| L05 | **Known-groups: null.** Showcase repositories do not have lower finding density than application repositories in either set; the point estimates go the other way. | No known-groups validity claim. The split is by name, which is crude by design. | `Docs/DiagnosticRuns/v1.3-known-groups-2026-10-16.md` | EXT, open #198 |
| L06 | **Fixes mined from histories: no robust validity signal.** The 2.65× removal ratio rests on one commit; without it 0.93 (0.61 to 1.43); sign test 6 of 21, in the wrong direction. | No claim that developers act on blocking findings more than on other edges. | `Docs/DiagnosticRuns/v1.3-validity-fixes-mined-2026-10-16.md` | EXT, open #168 |

## 2. Weak or partial results

| ID | Result | What it limits | Document | Class, status |
|---|---|---|---|---|
| L07 | **Judge pooled catch 16/21 = 0.76 [0.55, 0.89]**; clean false-fail v1 0.08, v2.1 0.15. | The neural arm cannot carry a verdict alone; its role is bounded (C12 in the ledger). | `Docs/DiagnosticRuns/v1.3-judge-catch-round2-2026-10-15.md`; `Docs/DiagnosticRuns/v1.3-judge-v2-2026-10-16.md` §3 | DEV, merged |
| L08 | **Every judge item and the code under test are from the same vendor.** | Same-vendor threat V10 for the judge figures. The only non-Claude rater so far is the exploratory, not pre-registered Gemini rater on CHECK-2 (#191 §6). The non-Claude manifest harness has made no live call. | `Docs/DiagnosticRuns/v1.3-judge-selective-2026-10-16.md` (banner); `Docs/v1.3/third-manifest.md` (open #204) | DEV, open #191, #204 |
| L09 | **No E1 cell has a blocking finding under v1.3 (0 of 65); no structural finding in any E1 cell.** | The registered E1 effect is in advisory coupling rules, not in architectural violations. Paper 1 must say so. | `Docs/DiagnosticRuns/v1.3-study1-rerun-2026-10-15.md` §1; `Docs/DiagnosticRuns/e1-size-analysis-2026-10-10.md` §1 | DEV, merged |
| L10 | **The E1 effect runs through size.** It is absent per file (p 0.95). Size is on the causal path, so no adjustment for it is identifiable. | "Spec level improves architecture" cannot be claimed; only the size-matched comparison favours the AaC spec. | `Docs/DiagnosticRuns/e1-size-analysis-2026-10-10.md` §6 | REG + PH, merged |
| L11 | **Study 1 real-code precision 0.33 to 0.79**, by treatment of uncertain labels. | Precision on real code is a range, not a point. | `results/so4-heldout/agg/precision_baseline.csv`; `papers/STATUS.md` (Paper 2) | REG, merged |
| L12 | **Spec-author reliability below the pre-stated threshold.** File-to-layer κ = 0.77 (criterion 0.80); 4 of 15 repositories reach 0.80; same verdict on 10/15 (verdict κ 0.21); blocking count limits of agreement [−28, +33]. | Every external-set figure depends on who wrote the spec. Both authors were Claude sessions. | `Docs/DiagnosticRuns/v1.3-spec-author-reliability.md` | EXT, open #186 |
| L13 | **The external correctness result is clustered.** Three repositories hold 214 of the 283 blocking findings (ddd-forum 92, neoteric-nestjs-auth 72, finance-project-ddd 50). The pooled Wilson interval treats findings as independent. | The 283/283 figure overstates the effective sample. Correct does not mean meaningful. | `Docs/DiagnosticRuns/v1.3-external-set-2026-10-16.md` (per-project table); PR #167 | EXT, open #133, #167 |
| L14 | **Floor: hexagonal none-arm steps had a blocking finding in 0/14.** Layered escaped the floor only as a step-1 level effect. | Study 2's primary outcome may be at the floor for some styles. | `Docs/DiagnosticRuns/v1.3-floor-probe-2026-10-16.md` §0 | DEV, merged |
| L15 | **Pilot: the §5 decision is not reached.** The DDD task was unscored (tool defect T1). | Study 2 keeps its primary outcome until the DDD none-arm run is scored. | `Docs/DiagnosticRuns/v1.3-loop-pilot-2026-10-16.md` (Verdict) | DEV, open #170 |
| L16 | **Human erosion: a direction without significance.** Blocking per KLOC rises in 5 of 6 histories, sign test p = 0.219. The raw count rises in 6/6 but grows with size. | No claim that human code erodes under a fixed spec. | `Docs/DiagnosticRuns/v1.3-human-erosion-2026-10-16.md` | EXT, open #209 |
| L17 | **The validation set misses most subtle rule defects.** 33% of measurable mutants are caught (strict); ORDER BY and DISTINCT mutants are never caught; no unit test runs a template against a graph in the container. | Agreement on the reference set is weaker evidence of rule correctness than it looks. | `Docs/DiagnosticRuns/v1.3-rule-mutation-2026-10-16.md` §1 | DEV, open #190 |
| L18 | **Metamorphic: three transformations can change a verdict** (barrels, file merge). One is a tool bug (MT-B1), fixed only behind an OFF option, because the fix adds a FF-DS02 false positive. | The verdict is not invariant to barrel files in one NestJS case. | `Docs/DiagnosticRuns/v1.3-metamorphic-2026-10-16.md` §1, §4 | DEV, open #185 |
| L19 | **Loop fault drills: 2 of 13 do not resume to the same bytes**, and some call sites are not drilled. | Study 2 run-once risk. | `Docs/v1.3/loop-fault-drills.md` | DEV, open #180 |
| L20 | **Advisory roll-up filter does not carry over out of sample.** | The roll-up filter cannot be enabled by default on the evidence so far. | `Docs/DiagnosticRuns/v1.3-advisory-filter-oos-2026-10-16.md` (Summary) | EXT, open #213 |
| L21 | **FF-CV03 selects classes such as `CsvReportWriter` as repositories** (two reference near-misses). Advisory only. | Advisory noise in the default results; the fix is a construct decision. | `Docs/v1.3/construct-question-ff-cv03.md`; `Docs/v1.3/fx2-status-2026-10-16.md` §2 | DEV, merged |
| L22 | **Reproducibility gaps.** 26 prose mismatches (audit); 58 of 5,154 numbers differ (replication part 2); about 99 result files contain absolute local paths; no tag or DOI. | The replication package is not yet archival. | `Docs/DiagnosticRuns/v1.3-repro-audit-2026-10-16.md`; `Docs/v1.3/replication-2.md` (open #215) | DEV, merged + open #215 |

## 3. Proposal against delivered (draft for G6, item 1)

The status column is copied from the readiness note (K7, which cites the Notion compliance register of
2026-10-06). The deviation argument is the author's to write; this table only lists where one is needed.

| Objective | Status | Deviation to argue | Evidence |
|---|---|---|---|
| SO1, spec language | Met | None; five style libraries where the proposal asked for two or three | readiness note K7 |
| SO2, the APG | Met | None | readiness note K7; C17 |
| SO3, the gate | Partial | "30+ rules over 7 symbolic dimensions" not reached as stated; judge κ against human labels not measured (C29) | readiness note K7; L02, L07 |
| SO4, detection accuracy | Met (registered); v1.3 hold-out not run | The v1.3 figures are development or external only until the hold-out runs (C27) | C06, C07, C09 |
| SO5, failure patterns | Met through E1 | Study 2 not run (C28); the E1 effect is in advisory rules (L09, L10) | C01 to C05 |
| SO4-7, independent labelling | Not met | Must be argued in Ch. 3, 8 and 9, or partly delivered (G8) | C31 |

## 4. Standard notes for headline tables

Each headline table in the thesis should carry the notes that apply from this list:

1. **Development set** (DEV rows): the numbers come from cases the v1.3 changes were made against.
2. **Same vendor** (L08): judge, items and generated code come from one model family.
3. **Correct is not meaningful** (L13, C30): a correct finding states a true fact about the code; whether it matters
   architecturally has not been labelled.
4. **Clustering** (L13): findings are not independent across repositories.
5. **Spec authorship** (L12): EXT figures depend on one author's spec.
6. **Not the v1.3 hold-out** (C27): no v1.3 figure is a held-out estimate.
