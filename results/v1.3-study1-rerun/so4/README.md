# v1.3 descriptive re-run of the SO4 held-out seeded evaluation

**descriptive, v1.3 development instrument, not a registered result.** The registered SO4 numbers are in `results/so4-heldout/` (instrument v2: `results/so4-heldout/v2/`) and stay frozen. See `Docs/DiagnosticRuns/v1.3-study1-rerun-2026-10-15.md`.

- `case/`: the Study 1 v2 case's `manifest.json` and `case-rows.json`, with v1.3 symbolic-only reports (volatile fields fixed) and copies of the Study 1 run records (`cliCommit` = the measured commit, `note` = this label). No registration machinery was used.
- `score.json`: `scripts/score-golden-cli.ts --case case` (unchanged scorer, registered matching rule).
- `by_operator.csv`, `seed_changes.csv`, `summary.json`: recall per operator and twin specificity, v1.2E (v2) beside v1.3.
