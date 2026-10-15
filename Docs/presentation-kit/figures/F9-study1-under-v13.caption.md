# F9 · study1-under-v13

**Title on slide:** Study 1 data, re-read by the v1.3 instrument

**What it shows.** Left: for the 65 accepted E1 cells (generated projects, Study 1's SO5 grid), blocking findings per file by spec level and model under v1.3 tiers: zero in every cell, so 100% of findings are advisory. Right: SO4 seeded recall per mutation operator, Study 1's instrument v2 (grey) against the v1.3 development instrument (blue): only the dynamic-import operator changes (0/6 → 6/6).

**One idea.** In v1.3 terms, the generated projects never break a defining constraint; Study 1's spec-level differences were all in advisory metrics. And v1.3 closes Study 1's only seeded-detection gap (dynamic imports).

**Numbers and sources.**
- E1 grid: `results/v1.3-study1-rerun/e1/by_level_model.csv`, `v13_mean_blocking_per_file` = 0 for every row; `v13_advisory_share` = 1.000 for every row; `v13_cv05_share` 0.742 to 0.887 across the 12 level × model rows (shown as 74–89%). `Docs/DiagnosticRuns/v1.3-study1-rerun-2026-10-15.md` §1: "0 of 65 accepted cells, and 0 of all 72".
- SO4: same doc §2: total recall 67/73 = 0.918 (v1.2E, v2) → **73/73 = 1.000** (v1.3); MO-X01 0/6 → 6/6; twin specificity 68/73 = 0.932 → 67/73 = 0.918 (realworld-test MO-C04n:1, an advisory FF-C03 row).

**Caveats to say.** Descriptive, not a registered result; no CIs by design. E1 contains no planted violation, so 0 blocking is not a recall figure. The SO4 bases and MO-X01 were known while v1.3 was built (MO-X01 motivated `dynamicImports`), so 73/73 is not a held-out estimate. E1 had 0 blocking violations.
