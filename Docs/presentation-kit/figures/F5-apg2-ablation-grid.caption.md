# F5 · apg2-ablation-grid

**Title on slide:** APG v2 ablation: 27 planted cases × 6 representations

**What it shows.** The full case grid behind C4: each of the 27 planted APG v2 cases (type flow TF, components CP, public API PA, async coupling AS, I/O IO) against six representations: APG v2, the same template on the v1.3 graph, the nearest v1.3 rules, dependency-cruiser with translated rules, dependency-cruiser with the best hand-written rules, and graphify (read from its export schema: "derivable" = by post-processing its import edges, "partial" = sees the import, not the use). CP4 and CP5 are marked "dropped": the scope fix's a-priori minimum of 4 types per component removed them.

**One idea.** Only the APG v2 column is filled; the import tools reach the cases that are about imports (component cycles, public API, imported I/O packages) and nothing else.

**Sources.** Per case: `Docs/DiagnosticRuns/apg2-ablation-2026-10-15/ablation.json` (fields `apg2`, `v13Graph`, `v13Rules`, `dcTranslated`, `dcHand`); graphify column from the case table of `Docs/DiagnosticRuns/apg2-ablation-2026-10-15.md` (adapter notes; graphify was not run). CP4/CP5: `Docs/DiagnosticRuns/apg2-scope-2026-10-15.md` §1. Column totals after the scope fix: 25, 0, 0, 0, 10, 0 (graphify 0 as a rule).

**Caveats to say.** Planted by the enrichment's author: expressiveness, not prevalence. Development data. The 19 near-misses and the control are all silent under APG v2 (not drawn).
