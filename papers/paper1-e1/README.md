# Paper 1 (empirical): Do Specifications Make LLMs Better Architects?

*A Pre-Registered Factorial Study of Architectural Conformance in LLM-Generated TypeScript*

Draft of 2026-10-11, written from the committed files at `v1.2e` (`b7034682`); refreshed on 2026-10-16 with the
v1.3 evidence (branch `v1.3-paper1-4-refresh`, see below). Target: MSR, ESEM or EMSE. Plain `article` class, 10 pt,
2.0 cm margins. It compiles to 16 pages (pdflatex + bibtex, TeX Live from the container's apt, no undefined
references): body text with 8 tables and 2 figures, then the references. For a venue template (IEEE for MSR, ACM
`acmart` for ESEM, Springer `svjour3` for EMSE), convert the class and check the page count again.

```
python3 papers/paper1-e1/figures/make_figures.py      # from the repository root; stdlib only
cd papers/paper1-e1 && pdflatex main && bibtex main && pdflatex main && pdflatex main
```

Needs `pgfplots` (with the `patterns` TikZ library) and `lmodern`.

## Files

- `main.tex`: the paper. Every number has a `% src:` comment that names the committed file it came from. Derived
  numbers say how they were derived. The abbreviations used in those comments are listed at the top of the file.
- `refs.bib`: the bibliography. Entries copied from `papers/paper2-tool/refs.bib`, and entries added here, were
  all written from general knowledge. Each one is cited through `\citeneeded{}`, which prints a red "[verify]" mark.
  The one exception is the companion tool paper (`daedalus2026tool`), which is the draft in `papers/paper2-tool/`.
- `figures/make_figures.py`: builds the three pgfplots files from `results/e1-grid/agg/so5_grid.csv` and
  `results/e1-grid/agg-size/size_functions.csv`. Its output is deterministic. The palette is Okabe-Ito, and the
  series also differ by marker or pattern.
- `figures/fig-*.tex`: the generated figures. Do not edit them by hand.

## v1.3 refresh (2026-10-16)

- **New Section 7, "The Floor"** (post-hoc): under the v1.3 tiers, 0 of 65 accepted cells (0 of 72) has a blocking
  finding; the RQ1 effect lies entirely in advisory metrics (`Docs/DiagnosticRuns/v1.3-study1-rerun-2026-10-15.md`).
  The section gives the evidence that the zero is not a blind spot, and frames the floor as the motivation for
  Study 2 (`Docs/v1.3/study2-outline.md` §4).
- **Corrected figures**: reference-set blocking recall is quoted as 54/54 with 3 FF-P06 field-initialiser rows N/A,
  not 57/57 (PR #120, `scripts/v1.3/ffp06-na-recount.mjs`); the judge claim is the defensible 16/21 = 0.76
  [0.55, 0.89] (`Docs/DiagnosticRuns/v1.3-judge-catch-round2-2026-10-15.md` header note).
- **Study 1 addendum A1** (`Docs/v1.3/study1-addenda.md`): the `none` level carries the three-folder sentence; stated
  in Section 3.2 and in the threats.
- **Threats**: a new paragraph on the v1.3 validity evidence (convergent #166, external correctness #167,
  metamorphic #185) and the two nulls (fixes mined #168, known groups #198).
- **Dependency on open PRs.** #167 and #198 are on hold for the author's review; their `% src:` comments
  use `git show <sha>:<path>`, pinned to each branch tip on 2026-10-16 (`23adb369`, `ba1c6327`). If one changes in
  review, re-check the sentence; if one closes unmerged, remove it. #120, #134, #166, #168 and #185 are merged
  (#168 and #185 are now cited by their v1.3 paths). See the submission gate in `papers/STATUS.md`.

## Framing (keep it)

- The registered spec-level effect is real (Holm p 0.0003), but its direction runs through project size. The paper
  must **not** claim that specifications make architecture worse.
- Every reading is tagged `[reg-conf]`, `[reg-expl]` or `[post-hoc]`. The size analysis, the per-file and
  LOC-adjusted readings, the function-level decomposition and the Codex spec-level test are all post-hoc. The
  `full-aac − minimal-prose` difference is a registered descriptive contrast, but calling it *the* size-matched
  comparison is a post-hoc choice, and the text says so.
- The floor (Section 7) is post-hoc and descriptive. Do not read it as a test, and do not compare v1.3 verdicts
  with the registered scores.
- The judge's self-preference result is reported in the registered wording, together with the confound: the Haiku
  cells carry it, and Opus and Sonnet both have `ahsNeuronal` = 1.000 in every cell.

## Open items

1. **Verify every `\citeneeded{}` citation** (authors, venue, year, pages, DOI) and remove the red mark once it is
   checked. These entries are the most likely to need correction: `siddiq2024quality` (venue and track),
   `jahic2024practice`, `wataoka2024selfpref`, `ralph2020standards` (author list), `chen2021codex` (author list
   truncated), `speckit2025` and `kiro2025`.
2. **Related work is thin on 2025–2026 work.** Search for studies of architecture-level quality in agent-generated
   code, and for studies that treat the prompt or specification form as a factor. Check the priority claim in
   Section 9 (`\todo` there).
3. **Authors, affiliations, archive DOI.** See the `\todo` in the title block and in Section 10. Also decide whether
   to publish the generated project trees. They sit outside the repository (`../daedalus-e1-outcomes`), and the
   paper identifies them only by tree hash.
4. **Instrument version and the judge unit cap in E1.** The paper says "instrument version 2" (source: the size
   note's header). It does not state the E1 judge unit cap, because no committed E1 file states it explicitly. Add
   it from `Docs/judge-preregistration.md` or the E1 RunRecords if a reviewer needs it.
5. **The P4 sample has one judge-fail E1 unit, and it is `uncertain`.** The derivation joins
   `results/e1-grid/label-plan-p4/judge-verdicts.json` to the P4 labels on (projectId, functionId, unitId). It is
   not a committed table. Consider adding it to the aggregation output, or drawing a judge-fail-stratified
   supplement.
6. **Derived numbers to double-check** (each is computed from committed CSVs, not read from a summary table):
   - the Haiku failure split by level (3/2/2) and the min/max AHS (0.852/0.988), both from `so5_grid.csv`;
   - mean d by model (+0.083, +0.088, −0.144), from `so5_grid.csv`;
   - the per-generator judge fail counts (33/209, 18/230, 2/450, 2/344), from `judge_summary.csv`;
   - the Claude-arm family sums (1 003, 154, 51), from `so5_patterns.csv`;
   - the per-level file ranges (4–15, 16–40, 15–50);
   - the template line counts (21, 25, 637) and the 307-line preset (`wc -l`);
   - the claim that `presets/clean-architecture.yaml` and `specs/clean-arch.yaml` differ only in comments, quoting
     and the `spec_version` line (a diff with comment and blank lines removed).
7. **Open coding has not run.** It needs the P3 labels, which were dropped by ADR-021 item 8.1. The FPAT profile is
   therefore unlabelled and unweighted. If the registered open coding runs, add it to RQ3.
8. **Author audit.** No panel-vs-audit row exists yet (`agreement.csv` and P4 `panel-vs-audit`, n 0). The panel is
   an LLM, so RQ4's validation is LLM against LLM, across vendors.
9. **The "knowing the test" confound** (full-aac shows the evaluator spec) is the main threat to the AaC-beats-prose
   reading. The Discussion proposes a fourth level as future work; a reviewer may ask for it now.
10. **Venue fit.** ESEM and MSR favour shorter papers (MSR 2027: 10 pages plus 2 of references, IEEE template,
    double-anonymous, checked on 2027.msrconf.org on 2026-10-16; ESEM full papers have had a 10-page limit plus
    references in `acmart`). Shortening candidates: the timeline table (Table 2), the per-model P4 rows (Table 6) and the
    Related Work paragraph on method. For EMSE the length is fine, and the Codex arm could get an appendix with the
    per-cell table.
11. **Model identifiers are named in the text** (Claude, GPT and Gemini model ids, CLI versions), because the
    experiment is about models. Confirm this is acceptable for the venue and for the providers' naming rules.
12. **Interval methods differ by row**: cluster bootstrap for the pairwise contrasts (descriptive), weighted item
    bootstrap for P4, and Wilson for run-vs-run. Each caption says which it uses.
