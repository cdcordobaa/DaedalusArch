# C7 · study1-headline

**Title on slide:** Study 1 in one chart

**What it shows.** The headline numbers of Study 1 (the frozen v1.2E study) on one 0-to-1 axis: SO4 seeded detection (recall and precision in three readings), real-code precision under three treatments of "uncertain" labels, the E1 mean AHS by spec level (Claude arm), and the judge's P4 agreement with the Gemini panel. Filled dots are registered analyses; open dots are declared post-hoc readings. Whiskers are the intervals printed in the report.

**One idea.** Study 1 shows strong seeded detection, uncertain real-code precision, a reversed spec-level effect explained by project size, and a judge that agrees with a panel but was barely tested on failing code.

**Numbers and sources** (all from `Docs/reports/director-report-2026-10.md` §1, "Main findings"):
- Item 1, SO4: strict recall 0.893 (0.787 to 0.974), seeded differential precision 0.838 (0.719 to 0.970), N = 75 [results/so4-heldout/agg-strict/prf_overall.csv]; corrected recall 0.918 (0.818 to 1.000), precision 1.000, F1 0.957, N = 73 [agg-corrected]; labelled recall 0.918 (0.818 to 1.000), precision 0.957 (0.893 to 1.000), F1 0.937 [results/so4-heldout/score.json; agg/prf_overall.csv].
- Item 3, real-code precision: 0.328 (Kish-Wilson 0.132 to 0.609), 0.608 (0.351 to 0.816), 0.789 (0.500 to 0.933); n = 24 labelled items, effective n 11.5 [results/so4-heldout/agg/precision_baseline.csv].
- Item 8, E1: spec level Holm p = 0.0003; model p = 0.438; interaction p = 0.026; means none 0.951, minimal-prose 0.887, full-aac 0.920 [results/e1-grid/agg/so5_tests.csv]; at equal size full-aac beats minimal-prose, Cliff's δ 0.52 (0.47 after LOC adjustment) [results/e1-grid/agg-size/size_tests.csv].
- Item 9, judge P4: n = 36, agreement 0.982 (0.949 to 1.000), Gwet's AC1 0.982, Cohen's κ 0 [results/e1-grid/label-plan-p4-api/labelling.json].

**Caveats to say.** The golden set is below its registered floor (N = 75 vs 80, item 2). Real-code precision rests on 24 items and depends on the "uncertain" rule. κ = 0 is a prevalence effect; the panel is one model, not ground truth. E1 is one vendor arm, two tasks.
