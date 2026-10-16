# Paper 2 revision notes (2026-10-12)

Revision of `main.tex` against `REVIEW-adversarial.md` (review of `b7034682`; `main.tex` was unchanged between that
commit and `v1.2e` at `8fbe079e`, so the review's line numbers still applied). Every number added or changed carries
a `% src:` comment naming a committed file. No em dashes were introduced. The paper has not been compiled (no TeX in
the revision container); a script checked environment, brace and math-mode balance and cross-references.

Besides the review items, two sections were added on request:

- **Section 6.7, "Why not just ask an LLM? An exploratory pilot"** (ADR-036;
  `Docs/DiagnosticRuns/llm-review-pilot-2026-10-11.md`): seed detection in 9 of 10 seed-runs (every seed found in at
  least one run), mean pairwise Jaccard 0.727 over the 11 trees with two runs, 26.5 % of the firewall's run-paired
  keys listed, about 6 credits (5.92) and 3 minutes (3.2) per review. Labelled exploratory throughout, with its
  threats (TV-111 to TV-113). Note: the source counts seed-*runs*, not seeds, so the text says "9 of the 10
  seed-runs", not "9 of 10 seeds".
- **Section 6.5, "Robustness of the judge to its model"** (ADR-038; `results/judge-robustness/`): agreement 0.94,
  kappa 0.766, AC1 0.931, all 6 disagreements Opus fail / Sonnet pass, 0 function or verdict changes in 41 reports.
  ADR-038 itself holds the registration; the numbers come from `results/judge-robustness/*.csv` and `summary.json`.

Both are reflected in the abstract, the contributions, the Discussion, the Threats and the Conclusion.

## Addressed

Numbering follows the review's Section 11 (prioritised list), with the Section 3, 4, 5 and 9 items each one covers.

| Item | Review refs | What changed |
|---|---|---|
| 1 | N1, N2 | RQ2 now says the 10 items were labelled `unseeded-TP` / `RC-GENUINE-UNSEEDED` (pre-existing), and the 3 are `uncertain`, counted as FP only by the registered rule; none labelled FP. |
| 1 | N3, m1 | SO4 table caption and "Reading the numbers": recall and F1 over 39 or 40 cells, precision over 36. |
| 1 | N11 | Judge-probe sentence: all 14 rejections are `no-site`; no copy was ever produced. |
| 1 | N14, m2 | Kappa 0.60 is described as the rule that keeps the FP/FN taxonomy, and run-to-run agreement as reliability. |
| 1 | N15, m7 | Line count comment updated to 22 433 (`find src -name '*.ts' \| xargs cat \| wc -l` at `8fbe079e`). |
| 1 | N16, m6 | Registry versions stated: RQ1 to RQ5 on v1 to v21, added studies v24 and v25, paper frozen at v25. |
| 1 | N17, m8 | Threats: one project by spec style (7 seeds), two by corpus style (19 seeds), and why. |
| 2 | N5, M2, Section 5 rows 625 and 771 | FF-P02 example removed. RQ3 and Discussion now say test pairing (FF-CV05) is the weak rule (48 % of HT weight, 4 of 13 non-true labels) and FF-P02 got 3 of 3 true. |
| 3 | N10, M6 | "Never edited" removed; E7 specs are mechanical, floor-motivated, unvalidated, the nestjs-active-record style change and the `core/application/**` mapping are named; new "Specification validity" threat. |
| 4 | M6 | "Held-out" now refers to the seed split; only E7 is unseen; E7 recall 0.879 repeated in "Reading the numbers". |
| 5 | N6, N7, N8, M5, m14 | Abstract, contribution 5 and Section 4: "internal", "310 files", the 22 non-reproducible files listed (including the 4 label-plan outputs), audit predates ADR-033, corrected tables not re-audited; run date vs file date explained. |
| 6 | N12, M4, Section 5 row 354 | "Can never raise" qualified (relative to the judge-blind score); dilution explained in Section 3.5; RQ4 reports the 7/5/2 verdict changes from reweighting alone and realworld to pass at 0.800. |
| 7 | M3, Section 5 rows 640 and 777 | Base rate added (197 of 258 passing units, 76 %, also carry a symbolic finding); "coincides" argument removed from Discussion. |
| 8 | M8, m5 | RQ1 and Threats: dynamic imports (2, 7), 330 out-of-root alias imports, layer coverage 55 % to 84 %, cycle row cap 100; labeller `search_web` (ADR-034) disclosed in Section 5.5 and Threats. |
| 9 | N13, M7 | Ablation text and the ablation table gain the two `fewer` rows; RE_EXPORTS counts (5, 0, 2, 0) and the six-edges-at-once caveat added; contribution 1 qualified. |
| 11 (part) | M1 | Labelled reading kept as headline, with an explicit justification (it retains the registered matching rule), marked POST-HOC (ADR-033 says all readings but strict are post hoc), with the corrected reading beside it in the abstract and conclusion; twin specificity for every reading (60/73, 68/73, 60/73); new per-operator table. |
| 12 (part) | M2 | Per-function RQ3 composition and the FF-CV05 weight share reported. |
| 13 (part) | M3 | Judge run-to-run stability (20 of 331 units with a two-to-one vote) and the E1 judge-vs-panel result (98.2 %, AC1 0.982, kappa 0) added from the committed `results/e1-grid/label-plan-p4-api/labelling.json`. |
| 14 | N9 | RQ1 states which ten specifications SO1 covers and how they differ from the evaluated set. |
| m4 | | RQ3 names the three projects with no sampled item and says the reason is not in a committed table. |
| m9 | | Thresholds and weights described as uncalibrated defaults; 0 of 9 projects pass. |
| m10 | | Latency stages described as nested (compute-scores 1.4 s contains the 1.3 s cycle metric). |
| m15 | | Specification effort (median 299 content lines) discussed. |
| m16 | | The two layered MO-S01 twins are called an operator defect. |
| M9, Section 5 row 90 | | "Fails a change before it lands" softened; the paper says it evaluates the checker, not the agentic gate (E1 is a separate study). |
| Section 5 rows 116, 687, 843, 845 | | Breadth-vs-accuracy caveat in the introduction; "works as a process" removed; conclusion rewritten without "honestly reported" and with the CV05 driver. |
| Section 8 | | New threats: specification validity, extractor gaps, sample composition and development exposure, labeller and audit, model-family overlap, conclusion validity, and the LLM-review pilot. |

## Not addressed, with reasons

| Item | Review refs | Reason |
|---|---|---|
| 10 (part) | m12, Section 6 | Bibliography not verified and missing related work not added. Every new entry would be written from memory and unverifiable in this container; adding unverified references would raise, not lower, the desk-reject risk the review names. Left for the authors. |
| 10 (part) | m13 | Five `\todo`s remain because they need author input or uncommitted data: author list, labeller model name (author decision), E7 per-project file counts (no committed table), qualitative reading of the 10 judge-only units (needs reading the cassettes, a qualitative task), tag or DOI. The judge-model `\todo` was resolved by naming `claude-opus-5-5`, which the judge-robustness section required anyway. |
| 11 (part) | M1 | The corrected reading was not made primary. That is an author decision about the headline; the text now justifies the labelled choice and shows both. |
| 12 (part) | M2 | "Precision without CV05" is not reported: it is not in a committed table, and computing it would be a new post-hoc analysis. |
| 13 (part) | M3 | Share of each code base covered by the 20-unit cap: not in a committed table; the text says it was not measured. |
| m3 | | The pooled 64-item kappa is now described as pooled across P1, MS and P2, but no RQ3-only kappa is given: none is committed. |
| m11 | | No screenshot or report excerpt added and Figure 1 is still ASCII art; this needs a new artefact from a tool run. |
| 15 to 20 | Section 7, M2, M3, M7, M9 | New experiments (human audit of labels and judge, per-edge ablation, seeds for untested rules, architect-written specs, a second semantic baseline, scale run, E1 gate). Out of scope for a text revision; their absence is now stated in the text and threats. The LLM-review pilot (Section 6.7) is a partial answer to the "why not an LLM" question but not to item 19. |
| M2 (usefulness) | | No user or architect study exists; the conclusion now names accuracy and usefulness of the broader rules as the open question. |

## Revision of 2026-10-16 (branch `v1.3-paper2-update`)

Brings the paper to the later v1.3 evidence. Every new number carries a `% src:` comment. Reports on unmerged pull
requests are cited as `origin/<branch>:<path>` with the PR number; their numbers must be re-checked after merge.
(Later on 2026-10-16 these were pinned: open PRs as `git show <sha>:<path>` at the branch tip, merged ones by their
v1.3 path. See the submission gate in `papers/STATUS.md`.)

| Change | Source |
|---|---|
| Section 7.7, one rule text, two engines: byte-identity on 71 variants, 65,254-statement parity, 836,000-statement differential fuzz, ten interpreter defects found | #128, #183 (merged) |
| Section 7.8, convergent agreement with dependency-cruiser, eslint-plugin-boundaries and ArchUnitTS (Table `tab:v13-convergent`) | #166 (merged) |
| Section 7.9, correctness on 15 human-written projects (283/283, negative control 500/500); wave 2 fidelity and the spec-author caveat | #167, #181 (not merged) |
| Section 7.10, metamorphic invariance 637/655 | #185 (merged into v1.3 later on 2026-10-16) |
| Section 7.11, rule mutation as a limit of the test oracle | #190 (not merged) |
| Section 7.12, replication package (audit, smoke run, number-level part 2 and its finding that the smoke script drifted) | #117 (merged), #215 (not merged) |
| Section 7.13, null results: developer-fix mining and known groups | #168, #198 (not merged) |
| Abstract, contribution 7, limits list, a new threats paragraph, conclusion | as above |
| New marker `\explor{}` for exploratory figures on human-written code | |

Compiles with TeX Live (`pdflatex`, `bibtex`): 24 pages, no errors, no undefined references. Target venue recorded
in `papers/STATUS.md` (ECSA 2027 research track, verified dates); the paper must come down to 16 + 2 LNCS pages.
