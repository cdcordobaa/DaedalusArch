# F3 · devset-before-after

**Title on slide:** Development set: before and after the fix round

**What it shows.** Blocking recall (left) and blocking precision (right) per reference style and pooled, against the author-written manifests, for the first run (grey: the U-E baseline, before the barrel fix and the fix round) and the current run (blue: after the fix round and the extractor's member facts). Bars are proportions, whiskers 95% Wilson intervals. The strip below gives the false alarms on code that should pass: the 5 clean variants and the 14 near-misses.

**One idea.** On the development set, the fixes removed every blocking false alarm without losing a planted violation. It is not a validity estimate: these are the cases the fixes were made against.

**Numbers and sources.**
- **Correction (2026-10-16).** The 3 FF-P06 FLOWS_TO rows (clean v08, nestjs v10, hexagonal v10) are N/A under the sealed `Docs/v1.3/rule-tiers.md` and are out of every count here; recall for that half is unestimated. Before the correction the figures were 55/57 and 55/110 (before) and 57/57 (after). Source: `Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md`, "Correction (2026-10-16)"; `scripts/v1.3/ffp06-na-recount.mjs`.
- Before, author view (cycle-normalised): recall 12/12, 11/11, 10/10, 12/12, 7/9, pooled 52/54 = 0.96 [0.87, 0.99]; precision 12/13, **11/64**, 10/10, 12/13, 7/7, pooled **52/107 = 0.49** [0.39, 0.58]. `Docs/DiagnosticRuns/v1.3-reference-after-fixes-2026-10-15.md` §1, "Blocking recall" and "Blocking precision", column "Author: before".
- The often-quoted **0.45** is the same baseline in the runner's literal-key view: 50/110, or 47/107 = 0.44 with the FF-P06 rows N/A (same doc §1, "The other two views"; also `Docs/DiagnosticRuns/v1.3-reference-baseline-2026-10-15.md`). The chart uses the cycle-normalised view on both sides so that before and after are comparable.
- After: recall 12/12, 11/11, 10/10, 12/12, 9/9, pooled **54/54 = 1.00 [0.93, 1.00]**; precision the same, pooled **54/54 = 1.00 [0.93, 1.00]**. `Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md` §3, "Per style, author view".
- Clean variants passing 4/5 → 5/5; near-misses with a blocking false positive 5/14 → 0/14; with any scored false positive 6/14 → 1/14. after-fixes §1, "Negative control, near-misses, planted rule"; unchanged after member facts (after-member-facts §3, "The unchanged rows").
- What changed: layered precision 11/64 → 11/11 is fix 3 (FF-P06 not applicable in layered, −53 rows); ddd recall 7/9 → 8/9 is fix 6 (barrel literal edge), 8/9 → 9/9 is member facts (B2).

**Caveats to say.** The development set is AI-written; the manifests are the author's (F3b shows the blind view); no style has more than 15 expected blocking findings, so no per-style Wilson lower bound reaches 0.90.
