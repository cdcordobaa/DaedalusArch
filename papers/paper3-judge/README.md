# Paper 3 (workshop): When the Judge Cannot Rule

Working title: *When the Judge Cannot Rule: Lessons from Using an LLM-as-Judge inside an Architectural Conformance
Gate*. Draft of 2026-10-11, written from the committed files at `v1.2e` (`b7034682`). Target: LLM4Code or another
AI-for-SE workshop, about 6 pages. Plain `article` class, 10 pt, A4. Not compiled yet: the drafting container had
no TeX installation.

```
pdflatex main && bibtex main && pdflatex main && pdflatex main
```

## Files

- `main.tex`: the paper. Every number carries a `% src:` comment naming the committed file it came from. Derived
  numbers (sums, differences, counts of rows, joins) say so and say how. One source is a file at an earlier commit
  (`git show 9eda300a:results/e7-corpus/judge-diagnostics/judge_criteria.csv`, the frame 1.0.0 counts).
- `refs.bib`: bibliography, written from general knowledge. Entries cited with `\citeneeded{}` render with a red
  "[verify]" mark. The six cited with a plain `\cite{}` are well known but still need a page and DOI check.

## The ten lessons and their main sources

| Lesson | Claim | Main sources |
|---|---|---|
| 1 | The judge fails 73 of 331 E7 units, yet changes no verdict; bound `[-W_n, 0]`, judge-blind decomposition | `results/e7-corpus/judge-diagnostics/judge_summary.csv`; `results/e7-corpus/agg-proportional/ahs_by_aggregation.csv`; `Docs/analysis-plan.md` §12.3; ADR-028 |
| 2 | Registered vs proportional vs any-fail at 0.08 vs 2/7: 0 to 8 moved verdicts | both `ahs_by_aggregation.csv` files (E7, E1); `Docs/analysis-plan.md` §12.2, §12.5 |
| 3 | Dilution: a clean judge dimension adds `W_n (1 - AHS_det)` | `delta_dilution`, `dilution_identity` columns; §12.3 |
| 4 | Frame 1.0.0 coded negations; frame 1.1.0 codes violation messages only | `Docs/analysis-plan.md` §12.4; `judge_criteria.csv` at `9eda300a` and now; `judge_discrimination.csv` (E7, E1) |
| 5 | 63 of 73 E7 judge fails (55 of 55 on E1) are also flagged by rules | `judge_summary.csv`; `results/e1-grid/judge-diagnostics/judge_units.csv` |
| 6 | Directional self-preference p 0.014, driven by the smallest Claude tier | `results/e1-grid/agg/so5_tests.csv`; `results/e1-grid/agg/so5_grid.csv`; E1 `judge_units.csv` |
| 7 | Panel: 98.2 % agreement, AC1 0.98, kappa 0; lenient errors; fail detection untested on E1 | `results/e1-grid/label-plan-p4-api/labelling.json`, `labels.json`; `results/e1-grid/label-plan-p4/label-plan-summary.json`; `results/labels/live-call-ledger.md` |
| 8 | Judge model robustness: top vs middle Claude tier on 100 recorded units, agreement 0.94, kappa 0.766, 0 verdict changes; the top tier fails 18 vs 12 (slightly stricter) | ADR-038; `results/judge-robustness/` (`summary.json`, `agreement.csv`, `transition.csv`, `fail-rates.csv`, `units.csv`) |
| 9 | Construct validity of synthetic judge probes: MO-X02/MO-X03 place no seed on the 7 held-out bases or the 65 E1 cells | `Docs/DiagnosticRuns/judge-probe-e1-site-count.md`; `results/so4-heldout/agg/seed_coverage.csv`; ADR-038 status (ADR-037 on hold) |
| 10 | CLI isolation, unblockable `search_web`, fail-closed guard plus stop rule | ADR-018, ADR-034, ADR-035; `Docs/judge-preregistration.md`; `Docs/labeller-route.md` §7, §8 |

## Open items

1. **Verify every `\citeneeded{}` entry** (authors, venue, year, pages, DOI) and drop the red mark once checked. Most
   likely to need correction: `thakur2024judging` and `gu2024survey` (author lists), `wataoka2024selfpref`,
   `ahmed2025annotation` (venue and year), `zhuo2024icescore`.
2. **Related work on LLMs for architecture conformance or erosion** (2024 to 2026) is missing (`\todo` in Section 3).
3. **Model identifiers.** The text names models by tier only ("a pinned Claude model at the top tier", "the smallest
   Claude tier", "one OpenAI model", "a Gemini Pro model"). Decide whether to name the exact identifiers; they are in
   `Docs/judge-preregistration.md`, `Docs/labeller-route.md` and `results/e1-grid/agg/so5_grid.csv`. Lesson 6 reads
   more naturally with names.
4. **Compile and fit the page limit.** Body text is about 3 800 words with 3 tables; it should land near 6 pages in
   this class. If the venue uses the ACM or IEEE two-column template, Table 1 (11 columns) will need `\resizebox` or
   a `table*`.
5. **Judge-only units (Lesson 5).** Add a qualitative reading of the 10 E7 judge failures with no rule finding
   (`results/e7-corpus/judge-diagnostics/judge_units.csv`, `rules_also_flag` false), `\todo` in Section 4.5.
6. **Post-hoc status.** Every E7 reading beyond the registered rule, frame 1.1.0 on E7 and the judge-weighted
   variant on E7 are post hoc (marked in the text and in Table 1's caption). The E1 readings are pre-registered.
   Keep this distinction if numbers are moved around.
7. **Derived numbers to double-check:**
   - reachability under the bound: 1 of 9 E7 projects at `W_n = 0.08` (judge-blind 0.547 against the 0.50
     threshold), 4 of 65 E1 cells (judge-blind below 0.88), 8 of 9 E7 projects at 2/7;
   - largest E1 judge drop at 0.08 under any-fail, 0.068 (`ahs_combined_any_fail` minus `ahs_combined_judge_blind`);
   - 7 of 9 E7 verdicts moved upward by reweighting alone at 2/7 (`verdict_changed_jw_registered`), judge-blind JW
     score 0.079 to 0.240 above `ahs_deterministic`;
   - per-tier means of `ahs_neuronal - ahs_deterministic` (+0.083, +0.088, -0.144) and of `ahs_deterministic`
     (0.917, 0.912, 0.921) from `so5_grid.csv`;
   - judge fails by generator (33/209, 2/450, 2/344, 18/230) from E1 `judge_units.csv`;
   - the P4 judge-vs-panel cross-tab (E1: 34 agree pass, 2 judge pass / panel fail, 1 judge fail / panel uncertain,
     1 judge pass / panel uncertain; fixtures 2 fail, 6 pass), a join of `labels.json` with E1 `judge_units.csv`.
8. **Overlap with paper 2.** `papers/paper2-tool` reports the E7 decomposition table (its RQ4). This workshop paper
   reuses it as Table 1; check the venues' dual-submission rules and cite paper 2 once it has a venue.
9. **Authors, affiliations and data availability** (`\todo` in the title block and the conclusion).
