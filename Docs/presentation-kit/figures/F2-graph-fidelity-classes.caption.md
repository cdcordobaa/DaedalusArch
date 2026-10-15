# F2 · graph-fidelity-classes

**Title on slide:** Graph fidelity: every disagreement with the compiler is explained

**What it shows.** For each comparison of the APG's file-to-file import edges against a second extractor, the disagreeing edges split by cause (each bar is 100% of that comparison's disagreements; the count is on the right). tsc (the TypeScript compiler's own resolution) is the primary reference; dependency-cruiser is secondary because it does not expand `${configDir}` path aliases. No disagreement is unexplained. Below: the effect of the barrel fix on the two E1 cells that disagreed.

**One idea.** The graph agrees with the compiler; the remaining differences are by design (excluded tests, code outside the root, declaration files), and the one real defect class, barrels, was fixed.

**Numbers and sources.** `Docs/DiagnosticRuns/v1.3-graph-fidelity-2026-10-14.md`:
- Headline, E1 (72) vs tsc: both 3306, APG 3334, ref 3317; refCoveredByApg 0.996684, apgConfirmedByRef 0.991602, Jaccard 0.988341 (dependency-cruiser identical on E1). SO4 (7) vs tsc, scoped: 2294 / 2432 / 2374; 0.966302 / 0.943257 / 0.913217.
- Classes (missing-in-APG + missing-in-ref): E1 vs tsc re-export/barrel 11 + 28 = 39. SO4 vs tsc: barrel 80 + 138 = 218; excluded-file 202; out-of-root 329; .d.ts 2 (total 751 = 613 + 138, matching the raw headline). SO4 vs dependency-cruiser: barrel 218; path-alias 0 + 829; excluded-file 308; out-of-root 639; .d.ts 2. extractor-bug (unexplained): 0 / 0.
- Barrel fix: `aidlc-docs/construction/v1.3-barrels/barrels-notes.md` §4: task-management/none/run-1 Jaccard 0.3962 → 1.0000; order-fulfilment/full-aac/run-1 0.9435 → 1.0000 (v1.3 literal view). "The other 70 E1 cells and SO4 were not rerun"; those 70 already agreed exactly (fidelity doc, "Per project").

**Caveats to say.** Agreement with other extractors, not precision: the human adjudication sheet (`human_verdict`) is still empty. E1 is AI-generated code; SO4 bases were known while v1.3 was built.
