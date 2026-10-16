# Paper 2 (tool and approach): A Spec-Driven Neuro-Symbolic Architectural Firewall for TypeScript

Draft of 2026-10-11, written from the committed files at `v1.2e` (`c8848bc0`); v1.3 evidence added 2026-10-15 and 2026-10-16 (see `REVISION-NOTES.md`). Target: ECSA 2027 research track (see `../STATUS.md`); originally ECSA or ICSA tool/approach
track. Plain `article` class, 10 pt; about 7 200 words of body text plus 7 tables, 2 listings and 1 figure, which
should come to roughly 12 pages. Now compiles to 24 pages in this class (TeX Live, 2026-10-16).

```
pdflatex main && bibtex main && pdflatex main && pdflatex main
```

## Files

- `main.tex`: the paper. Every number carries a `% src:` comment naming the committed file it came from; derived
  numbers say how they were derived.
- `refs.bib`: bibliography. **Every entry was written from general knowledge** and is cited through `\citeneeded{}`
  (rendered with a red "[verify]" mark).

## Positioning (keep it)

The paper does **not** claim better layer detection. On shared rules it claims parity with dependency-cruiser (the
registered 37/37 vs 28/37 gap is a translation defect that favoured us; the post-hoc `dts` variant gives 36/37). The
contribution is the spec-to-Cypher compilation over the APG, the rule breadth, the isolated and bounded judge, the
score and verdict, and the pre-registered, reproducible evaluation.

## Open items

1. **Verify all 31 `\citeneeded{}` citations** (authors, venue, year, pages, DOI) and drop the red mark once checked.
   The entries most likely to need correction: `liu2024codexgraph`, `ouyang2024repograph` (author lists),
   `eslintboundaries`, `depcruise` (maintainer name), `sonarqube` (which architecture feature to cite), `kiro2025`.
2. **Compile** and fit the page limit. If the venue uses LNCS, convert the class and recheck the tables, which are set
   for an A4 article text width (Tables 4, 6 and 7 are the widest).
3. **Authors, affiliations, data-availability tag or DOI** (`\todo` in the title block and Section 9).
4. **Model identifiers.** The text says "a pinned Claude model" for the judge and "a Gemini model" for the labeller.
   Decide whether to name the exact identifiers (they are in `Docs/judge-preregistration.md` and the labels ledger).
5. **Judge-only failures (RQ4).** 10 of 73 failing units have no symbolic violation on any of their files. Add two or
   three qualitative examples from `results/e7-corpus/judge-diagnostics/judge_units.csv` and the cassettes.
6. **E7 project sizes.** File counts for the five E7 projects are not in a committed aggregate table; the paper quotes
   resolved internal imports (57 to 3176) instead. Add file counts from the reports or the SO2 tooling.
7. **Human audit of the labels.** No panel-vs-audit row exists yet (`agreement.csv`, n 0). RQ3 and the labelled SO4
   precision both depend on the single LLM labeller; update the paper if the author audit is done.
8. **E1 (agent generation grid)** is deliberately not reported; it was still running at drafting time.
9. **Source size.** "About 22 000 lines" is a `wc -l` count over `src/**/*.ts` at `v1.2e` (22 353), not a committed
   table. Recount, or cite a committed figure, before submission.
10. **Derived numbers to double-check**: the 228/270 compiled share (sum of the corpus rows in
    `results/pre-tag/so1-metrics-53cfaed4a313.json`), the ablation totals in Table 4 (sums of
    `results/apg-ablation/so2/apg_ablation_summary.csv`), the 63/73 rules-also-flag count (sum of the two `*` rows of
    `results/e7-corpus/judge-diagnostics/judge_summary.csv`), and "19 of 25 symbolic functions not translatable".
11. **Interval methods differ by table**: SO4 uses cell bootstraps (Clopper-Pearson where degenerate), the tool
    comparison uses Wilson on instances, the baseline uses Wilson on Kish n_eff. Each caption says so; a reviewer may
    still ask for one method.
12. **Figure 1** is ASCII art in `verbatim`; replace it with a TikZ or vector figure for the camera-ready version.
13. **Related work** has no LLM-based architecture conformance work yet; search for 2024 to 2026 papers on LLMs for
    architecture conformance or erosion detection and position against them.

## v1.3 revision (2026-10-15)

Section 7, "Version 1.3: Fidelity, Development-Set Validation and Defects Fixed", was added on branch
`v1.3-papers`, with matching changes to the abstract, the contributions, the threats and the conclusion. Every v1.3
figure carries a `% src:` comment and a `[dev]` mark (`\devset{}`): it is a development-set figure, not a validity
estimate. The section reports graph fidelity as agreement (not precision), the 71-variant reference set (baseline,
after the fix round, after member facts), the correctness checker (0 incorrect of 2,668 checkable), APG v2 (25/27
vs 0/27, cases planted by the designer), eleven defects found and fixed, and the limits. The paper now compiles
(TeX Live, `pdflatex` + `bibtex`, 20 pages, no undefined references). See `papers/STATUS.md` for venues and missing
evidence (hold-out run, human labels, Study 2).
