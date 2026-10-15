# C4 · apg2-uniqueness

**Title on slide:** What only the APG can express: APG v2 against import and code graphs

**What it shows.** Left: of 27 planted cases, how many each representation detects: APG v2 (after and before the scope fix), the same templates on the v1.3 graph, the nearest v1.3 rules, dependency-cruiser with translated rules and with the best hand-written rules, and graphify read from its export schema. Right: APG v2 false alarms on the 19 clean and near-miss variants of the development set, before and after the a-priori scope fix.

**One idea.** APG v2 states facts an import graph cannot hold (inferred type flow, named channels, global I/O calls); a hand-written import rule gets 10 of 27, the translated rules none.

**Numbers and sources.**
- `Docs/DiagnosticRuns/apg2-ablation-2026-10-15.md`, "Results" summary: APG v2 27/27; APG v1.3 graph (same template) 0/27; v1.3 rules at locus 0/27; dependency-cruiser translated 0/27; hand-written 10/27; graphify 0/27 as a rule, 6 derivable by post-processing (CP1–CP3, CP6, PA1, PA2). 17 of 27 reported by APG v2 alone (TF1–TF4, CP4–CP6, AS1–AS5, IO1–IO5).
- `Docs/DiagnosticRuns/apg2-scope-2026-10-15.md`, "Summary": after the scope fixes 25/27 (lost CP4 and CP5, 2 types each, under the a-priori minimum of 4); live Cypher equals the mirrors 63/63; blocking rows on the 19 clean and near-miss variants 29 → **0**; advisory rows 40 → **21**.

**Caveats to say.** Planted by the enrichment's author (expressiveness, not prevalence); development data; the hand-written dependency-cruiser rules are "our best effort"; graphify was not run (schema reading).
