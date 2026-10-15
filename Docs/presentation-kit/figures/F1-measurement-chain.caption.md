# F1 · measurement-chain

**Title on slide:** The measurement chain: what is measured, what is not yet

**What it shows.** The four links a finding must pass to mean "this code breaks the architecture" (code → graph, spec/ground truth, rules, meaning), and the seven pieces of evidence behind them, each with a status chip and its backing file. Green = done on the development set; orange = defined or pending (not run, or waiting for the author's adjudication); grey with a lock = sealed, not opened.

**One idea.** Links 1 to 3 have development-set evidence; link 4 (meaning) is the least measured, and the hold-out has not run.

**Numbers and sources (row by row).**
- Graph fidelity: E1 72 projects, refCoveredByApg 0.996684 and apgConfirmedByRef 0.991602 against tsc (= dependency-cruiser on E1); SO4 scoped against tsc 0.966302 / 0.943257; extractor-bug (unexplained) 0 / 0. `Docs/DiagnosticRuns/v1.3-graph-fidelity-2026-10-14.md`, "Headline" and "Disagreement classes". The `human_verdict` column is still empty ("What to fix", item 5).
- Reference set: 5 projects, 71 variants; 5 clean, 14 near-misses, 52 planted (`results/v1.3-reference/after-member-facts/report.md`: variants 14+13+14+15+15 = 71; planted detected denominators 10+9+10+11+12 = 52). `Docs/v1.3-reference-notes.md`, `Docs/v1.3-ddd-notes.md`.
- Rules, author view: pooled blocking recall 54/54, precision 54/54, with the 3 FF-P06 FLOWS_TO rows N/A by `Docs/v1.3/rule-tiers.md` (was 57/57; after-member-facts doc, "Correction (2026-10-16)"); 5/5 clean variants pass; 0/14 near-misses with a blocking false positive. `Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md` §3.
- Rules, blind view: pooled blocking recall 50/64, precision 50/54 (blind, expanded; FF-P06 FLOWS_TO rows N/A, was 53/67 and 53/57); adjudication rows 39. Same doc §3 and `results/v1.3-reference/after-member-facts/adjudication.csv`.
- APG v2: ablation recall after scope 25/27; blocking rows on the 19 clean and near-miss variants 29 → 0. `Docs/DiagnosticRuns/apg2-scope-2026-10-15.md`, "Summary".
- LLM judge: pooled seeds 30/35 = 0.86 [0.71, 0.94], which includes 9 DUP-RULE seeds whose construct is confounded with the twin's cue (round 2 §3; duprule-v2 doc), and DDD was never judged. Defensible: FRAMEWORK-LEAK + PERSIST-IN-DOMAIN, round 2 13/16 = 0.81 [0.57, 0.93]; both rounds 16/21 = 0.76 [0.55, 0.89] (`results/v1.3-judge-catch/{scores.json,round2/scores.json}`); twin false fail with v2 in place 4/50 = 0.08 [0.03, 0.19]. `Docs/DiagnosticRuns/v1.3-duprule-v2-2026-10-15.md` §3, "Pooled across rounds".
- Labelling: all 2,668 checkable findings correct; "meaningful" not measured (labeller hit its usage limit). `Docs/DiagnosticRuns/v1.3-labelling-2026-10-15.md`, "Summary". Human protocol "defined; nothing labelled yet": `Docs/v1.3/human-labelling-protocol.md`. Hold-out "draft, to be frozen", run once: `Docs/v1.3/holdout-prespec.md`.

**Caveats to say.** The development set is AI-written; no human labels exist yet; the hold-out has not run; the judge figures rest on n = 35 seeds.
