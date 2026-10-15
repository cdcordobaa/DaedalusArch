# Every number in the presentation kit, with its source

Each row: the number as it appears on a figure, what it means, which figure uses it, and the exact source (document and section, or data file). Intervals are 95% Wilson unless the source says otherwise. **Dev** = v1.3 development set (not a validity estimate); **S1** = Study 1 (registered or declared post-hoc); **S1→v1.3** = Study 1 data read by the v1.3 instrument (descriptive); **Design** = a planned or working figure, nothing measured.

No hash values appear in this kit. Sealed material (the hold-out manifests, the blind manifests, the Study 2 tasks) was not opened; only committed scores derived from it are quoted.

## Graph

| Number | Meaning | Set | Figures | Source |
|---|---|---|---|---|
| 30 files, 74 file-to-file IMPORTS edges | hexagonal reference project, clean variant, as extracted | Dev | A1 | `Docs/presentation-kit/data/hexagonal.clean.json` (made by `tools/extract.ts`: `extractAPG`, `V13_DEFAULT_OPTIONS`) |
| 110 nodes, 195 edges | the same graph, every node and edge type | Dev | A1 caption | same file |
| 1 extra IMPORTS edge (PriceCalculator → FakePaymentGateway) | the planted edge of hexagonal v01 | Dev | A2, B0 | `Docs/presentation-kit/data/hexagonal.v01-domain-uses-outbound-adapter-constant.json`; `tests/fixtures/v1.3-reference/hexagonal/variants/v01-domain-uses-outbound-adapter-constant/variant.patch` |
| FF-S01 and FF-S04 rows on v01 | the tool's findings for that edge | Dev | A2, B0 | `results/v1.3-reference/after-member-facts/evidence/hexagonal/v01-domain-uses-outbound-adapter-constant.json` |
| 6 files, 6 import arrows; IMPLEMENTS 2, CONSTRUCTOR_INJECTS 2, CALLS 1, SIGNATURE_USES 1 (drawn) | the "cancel a booking" slice | Dev | A3 | `Docs/presentation-kit/data/hexagonal.clean.apg2.json` (`V13_APG2_OPTIONS`) |
| CONSTRUCTOR_INJECTS 5, IMPLEMENTS 1, FLOWS_TO 2, DECLARES 1, BELONGS_TO 1 | BookRoomService's neighbourhood | Dev | A5 | same file |
| 6 node / 9 edge types (v1.2E); 3 MODULE_* edge types (v1.3); 3 node / 8 edge types (APG v2) | the APG schema | — | A4 | `src/shared/types/enums.ts` |
| 269/269 edges, 115/115 layers | author expected graphs of the four patch styles vs the tool, clean variants | Dev | A1 caption | `Docs/DiagnosticRuns/v1.3-reference-after-fixes-2026-10-15.md` §1, "Graph, including the barrel edges" |

## Graph fidelity (F1, F2, D3)

| Number | Meaning | Set | Figures | Source |
|---|---|---|---|---|
| 0.996684 (99.7%) / 0.991602 (99.2%) / Jaccard 0.988341 | E1, 72 projects: share of tsc edges found by the APG / share of APG edges confirmed by tsc (dependency-cruiser identical on E1) | Dev (E1 is dev data for v1.3) | F1, F2, D3 | `Docs/DiagnosticRuns/v1.3-graph-fidelity-2026-10-14.md`, "Headline"; `results/v1.3-fidelity/e1/aggregate.json` |
| 3306 / 3334 / 3317 | E1 edges: both / APG / reference | Dev | F2 | same, "Headline" |
| 0.966302 (96.6%) / 0.943257 (94.3%) / 0.913217 | SO4, 7 bases, scoped, vs tsc | Dev | F1, F2 | same, "Headline"; `results/v1.3-fidelity/so4/aggregate.json` |
| 2294 / 2432 / 2374 | SO4 scoped edges vs tsc: both / APG / reference | Dev | F2 | same |
| 39 (11 + 28) | E1 disagreements vs tsc, all re-export/barrel | Dev | F2 | same, "Disagreement classes" |
| 218 (80 + 138), 202, 329, 2; total 751 | SO4 vs tsc: barrel, excluded file, out-of-root, .d.ts | Dev | F2 | same |
| 218, 308, 639, 2, 829; total 1996 | SO4 vs dependency-cruiser: barrel, excluded, out-of-root, .d.ts, path alias | Dev | F2 | same (1996 = "SO4 (1996 disagreement rows)") |
| 0 / 0 | unexplained (extractor-bug) disagreements | Dev | F1, F2 | same, "Disagreement classes" and "Unexplained extractor bugs" |
| 70 of 72 | E1 cells that agree perfectly | Dev | F2 | same, "Per project" |
| Jaccard 0.3962 → 1.0000; 0.9435 → 1.0000 | the two disagreeing E1 cells, v1.2E graph → v1.3 literal view (barrel fix) | Dev | F2 | `aidlc-docs/construction/v1.3-barrels/barrels-notes.md` §4; `results/v1.3-barrels/fidelity/` |

## Development set: rules (F1, F3, F3b, B2, D3)

| Number | Meaning | Set | Figures | Source |
|---|---|---|---|---|
| 13/13, 11/11, 11/11, 13/13, 7/9; pooled 55/57 = 0.96 [0.88, 0.99] | blocking recall before (U-E baseline, author view, cycle-normalised) | Dev | F3 | `Docs/DiagnosticRuns/v1.3-reference-after-fixes-2026-10-15.md` §1, "Blocking recall", column "Author: before" |
| 13/14, 11/64, 11/11, 13/14, 7/7; pooled 55/110 = 0.50 [0.41, 0.59] | blocking precision before (same view) | Dev | F3 | same, "Blocking precision" |
| 50/110 = 0.45 | the same baseline's precision in the runner's literal-key view | Dev | F3 caption/footer | same, "The other two views"; `Docs/DiagnosticRuns/v1.3-reference-baseline-2026-10-15.md` |
| 13/13, 11/11, 11/11, 13/13, 9/9; pooled 57/57 = 1.00 [0.94, 1.00] | blocking recall and precision now (after fixes + member facts), author view | Dev | F1, F3, F3b, D3 | `Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md` §3, "Per style, author view" |
| 13/15, 7/10, 11/14, 13/19, 9/9; pooled 53/67 = 0.79 [0.68, 0.87] | blocking recall now, blind (expanded) manifests | Dev | F1, F3b | same §3, "Per style, blind (expanded), blocking" and the pooled table |
| 13/13, 7/11, 11/11, 13/13, 9/9; pooled 53/57 = 0.93 [0.83, 0.97] | blocking precision now, blind (expanded) | Dev | F1, F3b | same |
| 39 | adjudication rows (disagreements awaiting the author) | Dev | F1, F3b | same §3 ("adjudication rows 40 → 39"); `results/v1.3-reference/after-member-facts/adjudication.csv` |
| 4/5 → 5/5 | clean variants passing the blocking verdict | Dev | F1, F3 | after-fixes doc §1, "Negative control, near-misses, planted rule"; unchanged after member facts (§3) |
| 5/14 → 0/14 | near-misses with a blocking false positive | Dev | F1, F3 | same |
| 6/14 → 1/14 | near-misses with any scored false positive (left: nestjs n03, FF-P02, advisory) | Dev | F3 | same |
| −53 rows; 11/64 → 11/11 | FF-P06 made not applicable in layered (fix 3) | Dev | F3 caption | after-fixes doc §3, fix 3 |
| 8/9 → 9/9 (ddd), 56/57 → 57/57 (pooled) | effect of member facts (g01 found) | Dev | B2 | after-member-facts doc §3 |
| 71 variants; 5 clean, 14 near-miss, 52 planted; 146 files | the reference set | Dev | F1, D4, reference-projects.md | `results/v1.3-reference/after-member-facts/report.md` (variants, planted); after-fixes doc §1 (clean, near-miss); `Docs/DiagnosticRuns/cheap-semantics-2026-10-15.md` §5 (files) |
| 2,668 / 2,668 | checkable findings labelled "correct" | Dev | F1 | `Docs/DiagnosticRuns/v1.3-labelling-2026-10-15.md`, "Summary" |

## APG v2 (B4, C4, F5, F1)

| Number | Meaning | Set | Figures | Source |
|---|---|---|---|---|
| 27/27 → 25/27 | planted cases APG v2 detects, before → after the scope fix (lost CP4, CP5) | Dev (planted) | C4, F5, F1 | `Docs/DiagnosticRuns/apg2-ablation-2026-10-15.md`, "Results"; `Docs/DiagnosticRuns/apg2-scope-2026-10-15.md`, "Summary" |
| 0/27 | same templates on the v1.3 graph; v1.3 rules at the locus; dependency-cruiser translated | Dev | C4, F5 | ablation doc, "Results" |
| 10/27 | dependency-cruiser, best hand-written rules | Dev | C4, F5 | same |
| 0/27 as a rule, 6 derivable | graphify (from its schema; not run) | Dev | C4, F5 | same |
| 17 of 27 | cases reported by APG v2 and by no other arm | Dev | C4 | same |
| 29 → 0; 40 → 21 | blocking / advisory rows on the 19 clean and near-miss variants, before → after scope | Dev | C4, F1 | scope doc, "Summary" and §2.1 |
| 63/63; 639/639 | live Cypher runs equal to the in-memory mirrors (fixtures; dev set) | Dev | C4 | scope doc, "Summary" |
| 5 rows (live 5 = mirror 5); TF1 row `UserController.get` → `UserRecord`, return, inferred | boundary-type-leak on the type-flow fixture | Dev | B4 | `Docs/presentation-kit/data/type-flow.boundary-type-leak.json`; `Docs/DiagnosticRuns/apg2-scope-2026-10-15/fixtures-live.json` |

## Judge and cheap proxies (F1, F6, F7, D3)

| Number | Meaning | Set | Figures | Source |
|---|---|---|---|---|
| 4/4, 1/1, 1/1, 1/1, 2/4; pooled 9/11 = 0.82 [0.52, 0.95] | round 1 catch per operator (REPO-BYPASS, DUP-RULE, FAT-CONTROLLER, PERSIST-IN-DOMAIN, FRAMEWORK-LEAK) | Dev | F6, F7 | `Docs/DiagnosticRuns/v1.3-judge-catch-2026-10-15.md` §3 |
| 3/33 = 0.09 [0.03, 0.24]; 2/24 | round 1 twin false fails; clean-unit false fails | Dev | F6 | same §3 |
| 8/8; 10/13 = 0.77 [0.50, 0.92] (E1 6/8, hand 4/5); 3/3; pooled 21/24 = 0.88 [0.69, 0.96] | round 2 catch (DUP-RULE E1, FRAMEWORK-LEAK combined, PERSIST-IN-DOMAIN hand-planted, pooled) | Dev | F6 | `Docs/DiagnosticRuns/v1.3-judge-catch-round2-2026-10-15.md` §3 |
| 5/14 = 0.36 [0.16, 0.61]; 1/24 = 0.04 [0.01, 0.20] | round 2 twin false fails; clean-unit false fails | Dev | F6 | same |
| 9/9 = 1.00 [0.70, 1.00]; 2/9 = 0.22 [0.06, 0.55]; 2/14 = 0.14 [0.04, 0.40] | DUP-RULE v2: seeds caught; twin false fails; clean units | Dev | F6, F7 | `Docs/DiagnosticRuns/v1.3-duprule-v2-2026-10-15.md` §3 |
| 30/35 = 0.86 [0.71, 0.94] | pooled seeds caught, all rounds | Dev | F1, F6, D3 | same, "Pooled across rounds" |
| 8/47 = 0.17 [0.09, 0.30] → 4/50 = 0.08 [0.03, 0.19] | pooled twin false fails, v1 twin → v2 twin | Dev | F1, F6 | same |
| 12/17 | FRAMEWORK-LEAK pooled over rounds | Dev | F6 caption | same, "Pooled across rounds" |
| 11/11 = 1.00 [0.74, 1.00]; 9/11; 0/11 | round-1 seeds: cheap proxy (primary) / judge / symbolic rules | Dev | F7 | `Docs/DiagnosticRuns/cheap-semantics-2026-10-15.md` §2–3 |
| 2/42 raw, 0/42 paired | proxy twin false flags | Dev | F7 caption | same §3 |
| 6/6 [0.61, 1.00] | hand-written analogues flagged by the proxies | Dev | F7 | same §4 |
| 14 flags on 146 files (101 before one revision) | proxy defect flags on the 5 clean reference projects | Dev | F7 | same §5 (Total), §6 |
| 1/9, 2/9, either 2/9; 0/9 | DUP-RULE v2: `clones`, `shared-literals`, either; symbolic rules | Dev | F7, D3 | v2 doc §5 |
| 50–130 ms | proxy runtime per reference project | Dev | D3 | `Docs/v1.3/cheap-semantics-design.md`, "Purpose" |

## Study 1 (C7) and Study 1 under v1.3 (F9)

| Number | Meaning | Set | Figures | Source |
|---|---|---|---|---|
| 0.893 (0.787 to 0.974), N = 75 | SO4 recall, strict, registered | S1 | C7 | `Docs/reports/director-report-2026-10.md` §1 item 1; `results/so4-heldout/agg-strict/prf_overall.csv` |
| 0.838 (0.719 to 0.970) | SO4 seeded differential precision, strict | S1 | C7 | same |
| 0.918 (0.818 to 1.000), precision 1.000, F1 0.957, N = 73 | SO4 corrected reading (post-hoc, ADR-025) | S1 | C7 | same; `results/so4-heldout/agg-corrected/prf_overall.csv` |
| 0.918 (0.818 to 1.000), precision 0.957 (0.893 to 1.000), F1 0.937 | SO4 labelled reading (post-hoc, ADR-033) | S1 | C7 | same; `results/so4-heldout/score.json`, `agg/prf_overall.csv` |
| 0.328 (0.132 to 0.609); 0.608 (0.351 to 0.816); 0.789 (0.500 to 0.933); n = 24, effective n 11.5 | real-code precision under three "uncertain" rules (registered, post-hoc, post-hoc) | S1 | C7 | same item 3; `results/so4-heldout/agg/precision_baseline.csv` |
| Holm p = 0.0003; means 0.951 / 0.887 / 0.920 | E1 spec-level effect; mean AHS none / minimal-prose / full-aac (Claude, n = 47) | S1 | C7 | same item 8; `results/e1-grid/agg/so5_tests.csv` |
| Cliff's δ 0.52 (0.47 LOC-adjusted) | full-aac vs minimal-prose at equal size | S1 (post-hoc) | C7 | same item 8; `results/e1-grid/agg-size/size_tests.csv` |
| 0.982 (0.949 to 1.000), AC1 0.982, κ 0, n = 36 | judge P4 agreement with the Gemini panel, E1 | S1 | C7 | same item 9; `results/e1-grid/label-plan-p4-api/labelling.json` |
| v25, 85 artefacts | pre-registration version and registered artefacts | S1 | D4 | same §1, "What was built and frozen" |
| 0 blocking per file in all 65 cells (0 of all 72); advisory share 1.000; CV05 share 0.742–0.887 | E1 under v1.3 tiers | S1→v1.3 | F9, F11 | `results/v1.3-study1-rerun/e1/by_level_model.csv`; `Docs/DiagnosticRuns/v1.3-study1-rerun-2026-10-15.md` §1 |
| 67/73 = 0.918 → 73/73 = 1.000; MO-X01 0/6 → 6/6 | SO4 recall, Study 1 v2 → v1.3 | S1→v1.3 | F9 | same doc §2; `results/v1.3-study1-rerun/so4/score.json` |
| 68/73 → 67/73 | SO4 twin specificity | S1→v1.3 | F9 | same §2 |

## ISE (C6)

| Number | Meaning | Set | Figures | Source |
|---|---|---|---|---|
| 14/14, 13/13, 14/14, 15/15, 15/15 | variants with the style classified correctly, reference projects | Dev | C6 | `Docs/DiagnosticRuns/ise-prototype-2026-10-15.md` §2 (a) |
| P1 14/14, P2 13/13, P3 14/14, P4 0/15, P5 0/15 | same, rename probes | Dev | C6 | same |
| 146/146; 29/29, 27/27, 28/29, 20/30, 6/31 | files given the right layer, reference projects and probes P1–P5 | Dev | C6 | same (b) |
| P4 5/11, P5 0/12 | planted violations touched under the inferred spec | Dev | C6 | same (d) |

## Construct questions (F4)

| Number | Meaning | Set | Figures | Source |
|---|---|---|---|---|
| Q3 0/4, Q5 5/1, Q10 3/0, Q2 0/12, Q8+Q14 1/4 (Q8 0/3, Q14 1/1), Q6 2/1, Q13 3/1 | sheet rows / other rows each question moves | Dev | F4 | `Docs/v1.3/construct-decisions.md`, "Summary" |
| 40 | rows of the adjudication sheet the questions were written from (after-fixes) | Dev | F4 | same, "Summary" note |

## Design figures (D4, F8, F10, F11): working values, nothing measured

| Number | Meaning | Figures | Source |
|---|---|---|---|
| 3 tasks × 2 arms, k = 4, 1 replicate, 6 runs, 24 step turns | loop pilot design | F8, F11 | `Docs/v1.3/pilot-outcome-memo.md` §2 |
| 7 tools; at most 40 findings; one repair turn | Study 2 arms | F10 | `Docs/v1.3/study2-outline.md` §3 |
| 6 tasks × 2–3 models × 3 replicates × 3 arms; 54 blocks; 162 runs; d_z ≈ 0.42 (0.51 with 36 blocks) | Study 2 working grid and power intuition | F10 | same §6 |
| κ ≥ 0.60 | labeller validity threshold against the author audit | F8 | `Docs/v1.3/validation-protocol.md` §3 |
| k ≈ 4–6 | steps per Study 2 task | F10 | `Docs/v1.3/study2-outline.md` §6 |

## Caveats to state on slides

- **The development set is AI-written.** The five reference projects, their variants and both kinds of manifest were written by AI agents, and the v1.3 fixes were made against them. Development numbers show that the fixes do what they say; they are not validity estimates.
- **There are no human labels yet.** "Correct" was checked by a deterministic checker; "meaningful" has not been measured (the model labeller hit its usage limit); the two-human protocol is defined but nothing is labelled; the author's adjudication sheet is empty.
- **The hold-out has not been run.** It is sealed, will be run exactly once on a frozen tool, and only it gives validity figures.
- **E1 had 0 blocking violations.** Under v1.3 tiers every finding on the 65 E1 projects is advisory; that is not a recall figure (E1 has no planted violation).
- **The judge figures rest on n = 35 seeds**, 10 of round 1 on one 8-file fixture; the DUP-RULE catch is confounded with a "foreign method" cue; this is construct sensitivity, not a detection rate.
- **The ontology is not built live.** The grounded-ontology layer of the neuro-symbolic design (D3) has no committed implementation or run.
- Also worth saying where relevant: the APG v2 cases were planted by the enrichment's author (expressiveness, not prevalence); no style has more than 15 expected blocking findings, so no per-style Wilson lower bound reaches 0.90; Study 2 is an informal outline, not a pre-registration.
