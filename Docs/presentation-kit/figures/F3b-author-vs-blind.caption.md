# F3b · author-vs-blind

**Title on slide:** Same tool, two answer keys: author vs blind manifests

**What it shows.** The current tool run (after member facts) scored against two answer keys: the author-manifests (blue), written by the people who could see the rules, and the blind manifests (purple), written by a separate agent that saw only the source, the style sources and the rule names (validation protocol §1). Blocking recall and precision per style and pooled, 95% Wilson whiskers.

**One idea.** Against an independent answer key the tool looks weaker (recall 53/67), and most of the gap is a disagreement about what the style means, which the author must adjudicate.

**Numbers and sources.** `Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md` §3:
- Author: recall and precision 13/13, 11/11, 11/11, 13/13, 9/9; pooled 57/57 and 57/57.
- Blind (expanded): recall 13/15, 7/10, 11/14, 13/19, 9/9, pooled **53/67 = 0.79 [0.68, 0.87]**; precision 13/13, 7/11, 11/11, 13/13, 9/9, pooled **53/57 = 0.93 [0.83, 0.97]**.
- 39 adjudication rows: same doc §3 table ("adjudication rows 40 → 39") and `results/v1.3-reference/after-member-facts/adjudication.csv` (the `adjudication` column is empty).
- The reading gaps named in `Docs/DiagnosticRuns/v1.3-reference-after-fixes-2026-10-15.md` §5: hexagonal adapter-to-adapter as FF-S01 or FF-S03; layer cycles under FF-S02; FF-P01 or FF-S01 for `express` in layered. Q5: `Docs/v1.3/construct-decisions.md`.

**Caveats to say.** Both manifests are AI-written; neither is human ground truth. The blind manifests are sealed outside the repository and were read only through the scoring script; nothing from them is shown here beyond the committed scores.
