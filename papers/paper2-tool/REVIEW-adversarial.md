# Adversarial review: "A Spec-Driven Neuro-Symbolic Architectural Firewall for TypeScript"

Reviewer role: strict ECSA/ICSA program-committee member (research or tool track).
Draft reviewed: `papers/paper2-tool/main.tex` on branch `v1.2e` at `b7034682` (the draft itself was written at
`c8848bc0`; four commits on labelling and prereg v22/v23 have landed since). Line numbers refer to `main.tex` at
`b7034682`.

Method: every number in the paper was checked against the file named in its `% src:` comment, and, where useful,
recomputed from the underlying run records (`score*.json`, `labels.json`, `judge_units.csv`, the ablation CSVs).
The paper itself was not edited.

---

## 1. Summary

The paper presents DaedalusArch, a command-line "architectural firewall" for TypeScript. A YAML Architecture-as-Code
specification is compiled into 25 parameterised Cypher queries over an Architectural Property Graph (6 node labels,
9 relationship types, including `CONSTRUCTOR_INJECTS` and `RE_EXPORTS`) extracted with ts-morph and stored in Neo4j.
Two further functions are judged by an LLM (Claude via its CLI, no tools, cassette-recorded) on a capped sample of
20 units per function and project. All results feed a seven-dimension health score (AHS) and a four-band verdict.

The evaluation is pre-registered and reports: compilation coverage and latency (RQ1); seeded held-out detection on
73 seeds in seven projects, recall 0.918 and labelled precision 0.957 (RQ2); precision on unseeded real findings,
0.328 to 0.789 depending on how uncertain labels are treated (RQ3); the judge's effect on nine projects, which is
zero on every verdict under the registered configuration (RQ4); and a translation-based comparison with
dependency-cruiser that ends in parity, plus five real fix commits (RQ5). An internal reproduction audit
regenerated 310 committed files byte for byte.

The paper is unusually candid. Its own results, read plainly, say: on the rules that a mature tool can express, it
is no better; on the rules only it can express, the evidence is thin (a handful of seeds per rule, 24 labelled real
findings dominated by one convention rule); and the neural half changes nothing. The contribution therefore rests
almost entirely on "breadth of the rule language" and "reproducibility process", and the paper does not yet
demonstrate that the breadth is accurate or useful.

## 2. Strengths

S1. **Honest positioning.** The paper refuses the easy "we beat dependency-cruiser" story, explains that the
registered 37 vs 28 gap was its own translator defect (lines 724 to 733), and reports parity. This is rare and
commendable.

S2. **Pre-registration with visible deviations.** Strict, corrected and labelled SO4 readings are shown side by side
(Table 3); post-hoc analyses are labelled as such; the floor shortfall (73 < 80) is disclosed (line 445).

S3. **Differential, twin-controlled seeding.** Twins (near-miss edits that must stay clean) are a good design and
demonstrably caught scorer defects (ADR-025), as the paper argues in the lessons paragraph (line 790).

S4. **Isolation and replay of the LLM judge.** Pinned model and CLI, tools disabled, allow-listed config directory,
frozen rubric with asserted hash, recorded cassettes, majority of three. This is the most careful LLM-judge harness
I have seen in an architecture-conformance submission.

S5. **Ablation and negative results reported.** The APG ablation (Table 4) and the admission that `FLOWS_TO` is
empty on every real project (lines 533 to 542) are useful, honest negative results.

S6. **Provenance discipline.** Every number in the source carries a `% src:` comment; almost every number I checked
matches (Section 9 lists the exceptions).

## 3. Major weaknesses

### M1. The headline "labelled" reading is constructed from a scorer artefact, and the paper describes it wrongly

Lines 546 to 553 and Table 3 (lines 565 to 567). The paper takes as primary the reading in which "the labeller
reclassif[ies] the strict false positives: 10 of the 13 were labelled true violations exposed by the seed, and the
remaining 3 stay false positives."

Evidence from the run records:
- All 13 strict-FP items come from MO-CV02 (class-rename) seeds (`results/so4-heldout/score.json`, `perInstance`,
  8 seeds with non-empty `fpItems`, 13 items). The paper itself says at line 549 that these are "class renames
  re-keyed pre-existing violations". They are scorer artefacts, not detector output.
- The 10 TP-class items are labelled `unseeded-TP` with root cause `RC-GENUINE-UNSEEDED` in
  `results/labels/labels.json` (for example item `7aeca4ab...`, dry-run, FF-P02). The labeller said they are
  genuine **pre-existing** violations, not violations "exposed by the seed".
- The remaining 3 are labelled `uncertain`, not `FP` (`prf_overall.csv`: `fp_labelled 3`, `fp_uncertain 3`;
  `score.json` `overall`: `fpUncertain 3`). They count as false positives only because the registered rule counts
  uncertain as not true.

So the "labelled precision 0.957" is the corrected precision (1.000) minus three items that an LLM could not decide
about, on findings that should never have been new in the first place. It measures labeller indecision on a scorer
defect, not detector precision. A reviewer will ask why this hybrid is primary rather than the corrected reading,
and why it keeps the twin specificity of the strict rule (60/73 in `score.json`, while the paper only reports 60/73
for strict and 68/73 for corrected, line 582). The abstract (line 65) and conclusion (line 844, "F1 0.937") inherit
the problem.

### M2. The breadth claim, which is the paper's stated contribution, is the least evaluated part

Lines 69 to 70, 116 to 119, 753 to 758, 763 to 768. The paper says the value lies in the 19 functions that
dependency-cruiser cannot express. But:

- **Seeds cover few of them.** Of the 22 enabled symbolic functions, the SO4 operators target 8 (S01, S03, P01,
  C04, P06, SO01, SO02, CV02; `score.json` `detectedBy`). Of the 19 "only DaedalusArch" functions, only P06, SO01,
  SO02 and CV02 are seeded at all. FF-P02 to P05, every coupling metric except C04, SO03, CV03, CV05, CV06 and the
  cycle rule S02 have no seeded ground truth.
- **The seeded counts that exist are tiny.** MO-DF01 (domain-state purity, the paper's flagship non-import rule,
  Listing 2) has 5 scored seeds on 3 projects; MO-SO02 has 2; MO-S03 (layer skip) has 2, all on one project
  (`seed_coverage.csv`). No per-operator table is given for RQ2, so the reader cannot see this.
- **Real-code precision for the broad rules is either unknown or poor.** The RQ3 sample has 24 v2 items. The
  test-pairing rule FF-CV05 alone holds 869.1 of the 1804.0 Horvitz-Thompson weight (48%) and is 2 TP, 3
  uncertain, 1 FP (`precision_baseline.csv`, function rows). Most other broad functions have 1 to 3 items.
- **Usefulness is not evaluated.** No user, no architect, no maintainer judged whether the extra findings are
  actionable. The real-pair study (line 749) finds that the extra rules "detect no additional fix".

Net: the evidence supports "DaedalusArch is as good as dependency-cruiser on import rules", which is not a
contribution, and does not yet support "the broader rules are accurate".

### M3. The neural judge has no validity evidence, and its "zero effect" is a property of the configuration

Lines 637 to 690, 776 to 781, 822 to 826.

- Under the registered rule a judged function fails only when strictly more than half of at most 20 sampled units
  fail (`Docs/analysis-plan.md` §12.1). The maximum observed was 9 of 20 (`judge_summary.csv`). The verdict effect
  is zero by construction more than by measurement; the threats section admits this (line 824), which makes RQ4
  close to tautological.
- The "coincides with symbolic findings" argument (lines 640 to 643, 777) has no baseline. In
  `judge_units.csv`, 63 of 73 failing units (86%) carry a symbolic violation, but so do 197 of 258 **passing** units
  (76%). With a 76% base rate the overlap says almost nothing about agreement between judge and rules.
- No ground truth for the judge exists. The two judge-probe operators MO-X02 and MO-X03 produced no scored
  instance (line 447), and all 14 rejections were `no-site` (no copy was created at all, `seed_coverage.csv`), so
  "every copy was rejected" overstates what happened. The judge-vs-panel and panel-vs-audit rows in
  `results/so4-heldout/agg/agreement.csv` are empty.
- At `b7034682` there is new evidence the draft does not use: commit `a8bfc73e` records a judge-vs-panel comparison
  on E1 (n 36, agreement 0.982, but kappa 0.000 because the judge said pass on all 36). That result is in
  `aidlc-docs/audit.md` and the label files, not in a committed aggregate table, and it does not cover E7, but a
  reviewer who reads the repository will see it and ask why it is absent, and will note that a judge that passes
  everything cannot be shown to discriminate.
- Run-to-run stability of the judge is not reported: 20 of 331 units (6%) had a 2-to-1 vote
  (`judge_units.csv`, `cassette_fail_runs`).
- Coverage of the sample is not reported. With a cap of 20 units on projects with up to 3176 resolved internal
  imports (`e7-corpus/agg/coverage.csv`), the share of each code base that the judge ever sees is unknown.

### M4. The health score rewards un-run or unfailed judge dimensions (dilution), and the paper understates it

Lines 349 to 356, 648 to 651, 684 to 686. The paper correctly calls the 0.022 to 0.072 gap between
AHS<sub>comb</sub> and AHS<sub>det</sub> a "weighting artefact". It does not say what that artefact does when the weight
rises: under the judge-weighted variant (2/7) with **no** judge failure at all (`ahs_combined_jw_judge_blind`), 7 of
the 9 verdicts change, and realworld moves from warning to **pass** at exactly 0.800
(`e7-corpus/agg-proportional/ahs_by_aggregation.csv`; the audit, §3 E7, gives the same 7/5/2 counts). Line 685
reports only the 0/2/8 "judge mattered" counts. A gate whose verdict can be raised to pass by adding two dimensions
that never fail is a design flaw that a firewall paper must confront, not a footnote. The statement that the judge
"can never raise" the score (line 354) is true only relative to the judge-blind combined score, not relative to the
rules-only score that a user would otherwise see.

### M5. The reproduction audit does not cover the corrected numbers the paper reports

Lines 71, 112, 381 to 393. The abstract and contribution 5 place "310 result tables byte for byte" next to the
headline figures. But:

- The audit ran on `v1.2e` at `1543ba9` under prereg v20 (`reproduction-audit-2026-10-10.md`, §1 item 3). The
  ADR-033 corrections (`dcecbe90`, prereg v21) came **after** it and **replaced** `results/so4-heldout/agg/` and
  `score.json`. The audit's row for that table shows the old content (N 75, TP/FP/FN 67/0/8, F1 0.944, §3). The
  labelled 0.957 / 0.937 and the three-row baseline table (0.328 / 0.608 / 0.789) were therefore never audited.
  Line 393 ("the numbers below are the corrected ones") makes this sound like a strength.
- "310 result tables" are 310 **files**, including JSON configs, score JSON, `labels.json` and an SVG, of which 79
  were checked only at their producing commit (audit "Verdict counts").
- The 22 non-reproducible files include the four label-plan outputs (the sampling frame for RQ3) and
  `apg_arms.csv` / `flows_to_stores.csv`, the sources of the "1012 of 3666 edges, 309 constructor injections"
  figure (line 503) and of the whole `FLOWS_TO` paragraph (lines 536 to 538). Line 388 lists the categories but
  hides that the RQ3 sampling frame is among them.
- The audit is internal (same repository, same tooling, same session family). "Independent" (line 71) should be
  qualified.

### M6. Corpus definition is inconsistent across RQs, and "held-out" is self-contradictory

- Line 421 calls the seven SO4 projects "held-out", then says four were "seen during development". The analysis
  plan uses `held-out` for the seed split, not the projects (`Docs/analysis-plan.md` lines 264 to 268). The paper
  must say plainly that only the three E7 projects are unseen, and give E7 (recall 0.879, n 33) equal billing.
- RQ1's "ten registered corpus specifications" (line 477) are not the projects evaluated elsewhere. The SO1 file
  (`results/pre-tag/so1-metrics-53cfaed4a313.json`, `specs`) includes MarvinRF__nest-docfy, dev-nest and
  eryzerz__nestjs-ddd, which appear in no other RQ, and excludes raouf-b-dev/ecommerce-store-api and
  zhuravlevma/typescript-ddd-architecture, which are in RQ3, RQ4 and RQ5.
- Line 429 says E7 specifications were "never edited". The history of
  `corpus/specs/zhuravlevma__nestjs-active-record.yaml` shows three commits (`5811645c` preset copy, `054f9934`
  regenerated, style changed from layered to nestjs, `4e94cea7` CV01/CV04 disabled), and the analysis plan calls
  the E7 specs and the domain-layer remap "floor-motivated" (ADR-020 item 4, `analysis-plan.md` line 270). The
  paper omits "floor-motivated".
- The same mechanical rule maps `core/application/**` into the domain layer on raouf (real pair p1,
  `tool-comparison-real-pairs-2026-10-10.md` section B). If the generated specs mislabel layers, every
  layer-dependent number on E7 (direction, purity, and the judge's intent-alignment rubric, which reads the
  declared layer role) is measured against a partly wrong specification. Specification validity is never assessed.

### M7. The "TypeScript-specific edges" contribution is only half supported on real code

Contribution 1 (lines 100 to 102) and lines 267 to 272 present `CONSTRUCTOR_INJECTS` and `RE_EXPORTS` as the key
TypeScript facts.
- `RE_EXPORTS` count on the four real bases: 5, 0, 2, 0 (`apg_arms.csv`, `removed_re_exports`). The only measured
  effect of removing it is one fewer FF-S01 violation on a fixture (`variant-d-subtle`, `apg_ablation.csv`, change
  `fewer`). On real code there is no evidence that barrel resolution matters.
- `FLOWS_TO` is empty on real code (admitted).
- The ablation removes six edge types at once ("AST-only"), so the paper cannot attribute any effect to a single
  edge type. Table 4 also hides the `fewer` rows (ghostfolio FF-SO01 22 to 16; variant-d FF-S01 3 to 2), which
  explain 6 of ghostfolio's 61 lost violations.
- The ablation runs on the four core projects that were used during development (line 509 says "known bases").

### M8. Known extractor gaps affect real projects, not only seeds

- Dynamic `import()` is "declared outside coverage", which makes in-coverage recall 67/67 look clean. But
  `e7-corpus/agg/coverage.csv` reports `unsupported_dynamic` 2 on realworld and 7 on ghostfolio: real code uses the
  construct, and those dependencies are invisible.
- Ghostfolio has 330 `external_out_of_root_alias` imports (same file): monorepo library imports are treated as
  external packages, so architecture rules over `libs/` are not checked.
- Layer coverage: the paper quotes 84% on ghostfolio (line 493) but not truthy 55%, dry-run 66%, realworld 77%
  (`apg-ablation/so2/graph_coverage.csv`). Files outside any layer cannot violate layer rules, so real-code recall
  is bounded by these figures.
- The cycle query is capped at 100 rows (`CYCLE_ROW_CAP = 100`, `src/fitness-compiler/cypher-templates.ts` line 35);
  this is not mentioned next to "simple cycles up to length 10" (Table 1, line 739).

### M9. The motivating use case is not evaluated

The title, abstract and introduction (lines 88 to 91, 767 to 768) motivate a firewall for spec-driven coding agents.
No experiment involves an agent, a change being gated, or a developer reacting to a verdict. E1 is explicitly
excluded (line 835). As written, the paper is a conformance-checker paper with an agentic framing. Either evaluate
the gate (E1) or drop the framing.

## 4. Minor issues

m1. Table 3 caption (line 557) says intervals are bootstraps over "39 to 40 cells"; the precision intervals use 36
cells (`precision_n_cells` 36 in all three `prf_overall.csv` files). Same for line 590 ("39 cells").

m2. Line 628 calls kappa >= 0.60 a "validity criterion". In `Docs/analysis-plan.md` line 403 it decides whether the
FP/FN taxonomy is kept as registered, and run-to-run agreement is reliability, not validity (the paper says so
itself at line 811).

m3. The 64-item kappa (line 628) pools P1 (seeded-copy) items, MS items and P2 items; it is not an agreement figure
for the RQ3 sample.

m4. The RQ3 sample covers six of nine projects (`n_clusters` 6); realworld, nestjs-active-record and valex
contribute no v2 item. Say why.

m5. Line 469: the labeller ran on agy 1.3.2, which cannot deny `search_web` (ADR-034). ADR-034 item 6 verified that
no P1/MS/P2 call completed a tool step, but the isolation claim made for the judge (lines 334 to 336) does not hold
for the labeller route as configured, and should be disclosed.

m6. Line 413: "registry versions 1 to 21". At `v1.2e` head the registry is at v23 (`cdbd92f3`, ADR-034/035). Fine
for the evaluation scope, but state the version the paper is frozen against.

m7. Line 364 comment: `wc -l` over `src/**/*.ts` now gives 22 433, not 22 353 (source changed after drafting).

m8. Line 806: "only one project uses the layered style" is true by specification style; by corpus style two
projects are layered (nestjs-active-record is layered in `corpus_style`, nestjs in `spec_style`; 19 scored seeds,
`golden_instances.csv`). Explain the difference.

m9. The verdict thresholds (0.80 / 0.65 / 0.50) and the weights (0.32, 0.18, ...) are presented without rationale or
calibration. 7 of 9 real projects are soft-block or hard-block; 0 pass. A gate that blocks almost every real
project needs a justification.

m10. Lines 489 to 491: the listed stage times (2.9 + 0.3 + 0.7 + 1.3 s) do not sum to 5.3 s because the universal
cycle metric is nested inside a 1.4 s compute-scores stage (`latency.csv`). Show the stages as nested.

m11. Figure 1 is ASCII art in `verbatim`, and the paper has no screenshot or example of the JSON report or verdict
output. A tool paper needs both.

m12. 32 `\citeneeded` uses covering all 33 bibliography keys, every entry "written from general knowledge" (README
item 1, which says 31). Unverified references are a desk-reject risk.

m13. Several `\todo` markers remain in the body (lines 47, 332, 428, 644, 851).

m14. Line 112 and line 384 point to the same audit for both "310" and the method; line 382 dates it 2026-10-11 while
the file name says 2026-10-10. Use one date.

m15. The median specification length of 299 content lines (line 481) is presented neutrally. For a tool that
competes with one-line path rules, specification effort is a cost and should be discussed.

m16. Twin MO-S01n on valex (`v-aguiar__valex:MO-S01n:0/1`) makes a repository import a service, which is itself an
upward dependency (`score-corrected.json`, `undeclaredNew`). That is an operator defect, not a "twin that is not a
true negative under that style" (line 585). Call it what it is.

## 5. Unsupported or overclaimed statements

| Line(s) | Statement | Problem |
|---|---|---|
| 552 to 553 | "10 of the 13 were labelled true violations exposed by the seed, and the remaining 3 stay false positives" | Labels are `unseeded-TP` / `RC-GENUINE-UNSEEDED` (pre-existing), and the 3 are `uncertain`, not `FP` (M1). |
| 625 to 627 | NestJS services injecting concrete classes are flagged by the DI proxy and "the labeller marked [them] as a standard pattern" | The cited item (`labels.json`, first P1 item, dry-run FF-P02) is labelled `unseeded-TP` in both runs. Across all labels, FF-P02 is 13 `unseeded-TP` vs 1 `FP` in P1 and 3 of 3 TP-class in P2. The data contradict the example. |
| 771 to 772 | "Proxies such as the dependency-inversion ratio ... flag constructs that many teams accept" | Same: the labelled DI findings are overwhelmingly true. The weak rule in the data is test pairing (FF-CV05). |
| 640 to 643, 777 | Judge failures "mostly coincide with symbolic findings" | 76% of passing units also carry a symbolic finding; the overlap is uninformative without that baseline (M3). |
| 687 to 688 | The judge "works as a process (it produces evidence-backed failures on about a fifth of units)" | Producing failures is not working; no failure has been checked against any reference. |
| 71, 112 | "An independent audit regenerated 310 result tables byte for byte" | Internal audit; 310 files, not tables; did not cover the corrected headline numbers (M5). |
| 429 | E7 specifications "never edited" | Git history shows regeneration and an edit; the plan calls them floor-motivated (M6). |
| 421 | "seven held-out ... four ... seen during development" | Self-contradictory (M6). |
| 447 to 448 | Judge-probe "copy was rejected" | Mostly no site existed; no copy was produced. |
| 100 to 102, 267 to 272 | `RE_EXPORTS` as a key TypeScript fact | No measured real-code effect (M7). |
| 116 to 119, 843 | Contribution "lies in what can be specified" | Expressiveness is shown; accuracy and usefulness of those rules are not (M2). |
| 845 | "real-code precision honestly reported as a wide range" | The range is reported, but its dominant driver (CV05 with 48% of the weight) is not. |
| 90 to 91 | "fails a change before it lands" | No change-gating experiment is reported (M9). |
| 354 | The judge "can never raise" AHS<sub>comb</sub> | True only against the judge-blind combined score; adding the judge dimensions raises the score above rules-only on every project (M4). |

## 6. Missing related work

A PC member will expect positioning against at least the following (exact venues and years to be verified by the
authors):

- **TypeScript / JavaScript architecture testing tools**: ArchUnitTS and ts-arch (ArchUnit-style fluent rules for
  TypeScript), Nx `enforce-module-boundaries` (tag-based layer rules, widely used in TypeScript monorepos), Madge.
  The paper's claim that path rules are the state of practice for TypeScript needs these.
- **Commercial architecture checkers**: Sonargraph (architecture DSL), Structure101, Lattix (DSM-based), Axivion.
  Several express rules beyond "path imports path".
- **jQAssistant** is cited but not compared. It is the closest precedent (Cypher over a code graph). A reviewer
  will ask why the comparison is with dependency-cruiser and not with jQAssistant, or why the paper's templates
  could not be run as jQAssistant constraints.
- **Architecture erosion literature**: the systematic mapping study and code-review studies on erosion symptoms by
  Li, Liang, Soliman and Avgeriou (around 2021 to 2022, including an ICSA paper); de Silva and Rosik are cited but
  are older.
- **Recovery and mapping support for conformance checking**: semi-automated mapping of code to architecture
  modules (for example InMap by Sinkala and Herold, ICSA, around 2021), and machine-learning-assisted mapping work.
- **LLMs for software architecture**: work on LLM-generated design decisions (Dhar, Vaidhyanathan and Varma, ICSA
  around 2024), surveys of LLMs in software architecture (2024 to 2025), and any 2024 to 2026 work on LLM-based
  conformance or erosion detection (the README's open item 13 already flags this).
- **LLM-as-a-judge for code**: ICE-Score, CodeJudge and recent surveys of LLM-as-judge in software engineering;
  the paper cites only general NLP judge papers.
- **Mutation-based evaluation of static analysers** (seeded-fault benchmarks for analysers, such as work around
  Juliet-style suites and mutation-based analyser testing), to position the seeding methodology and its known
  circularity.
- **Architecture metrics**: Martin's instability and abstractness metrics are used (C01 to C06) without citing
  the metric definitions or their known validity critiques.

## 7. Missing experiments a reviewer would demand

Ranked by how likely a PC is to insist on them.

1. **Human validation** of a sample of labels (the planned author audit, `panel-vs-audit` n 0) and of judge
   verdicts. Without it, RQ3 and the labelled SO4 reading rest on one LLM.
2. **Seeded or labelled evidence per non-import rule**: at least one operator, or a labelled real sample of
   adequate size, for FF-P02 to P05, S02, the metric rules, and CV05/CV06, reported per function.
3. **Per-edge-type ablation**: remove `CONSTRUCTOR_INJECTS`, `RE_EXPORTS`, `CALLS`, `IMPLEMENTS` one at a time, on
   the unseen E7 projects, not only on the core projects.
4. **Judge discrimination on ground truth**: get MO-X02/MO-X03 or hand-built semantic violations to produce scored
   instances, and report judge recall and specificity on them; report run-to-run stability and unit-cap
   sensitivity (cap 10 vs 20 vs all).
5. **Verdict calibration**: compare verdicts (or AHS ranks) with architects' assessments of the same projects;
   justify thresholds and weights; study the dilution effect in M4.
6. **Specification validity and effort**: have an architect write or review the specification for some E7
   projects and compare results with the mechanically generated ones; measure authoring effort.
7. **A second baseline** with richer semantics (ArchUnitTS, jQAssistant or Sonargraph) on the non-import rules.
8. **Scale**: one project of 241 files is not a scalability result. Run the full ghostfolio monorepo or a project
   with thousands of files.
9. **The agentic gate (E1)**, since it motivates the paper.
10. **Non-NestJS projects** (React/Angular front ends, Express, plain Node libraries).

## 8. Are the threats adequate?

Partly. The section is better than most: circularity, NestJS bias, single labeller, post-hoc changes and the judge
weight bound are all named, and the weight-bound paragraph (lines 822 to 826) is admirably frank.

Missing or understated:
- **Specification validity**: mechanically generated, floor-motivated specs that can mis-assign layers (M6).
- **Audit scope**: the audit predates the corrections it is used to vouch for, and is internal (M5).
- **Labeller isolation**: `search_web` could not be denied on the labeller CLI (ADR-034).
- **Extractor gaps on real code**: dynamic imports present in real projects, aliased monorepo imports treated as
  external, layer coverage as low as 55%, cycle row cap (M8).
- **Sample composition**: one function holds about half of the RQ3 weight (M2).
- **Development exposure**: the core projects were used to build the tool and also host the ablation, latency and
  most seeds; this belongs under internal validity, not only in the corpus paragraph.
- **Model-family overlap**: the judge is a Claude model; if any code, rubric or specification was written with
  the same model family, self-preference (cited at line 95) applies to the judge's verdicts.
- **Conclusion validity**: no statement about multiple comparisons or about how many readings were inspected
  before choosing the primary one (three SO4 readings, three baseline readings, four judge aggregations).

## 9. Numbers that do not match their source

Everything not listed here matched its cited source to the printed precision (abstract figures, Table 3 point
estimates and intervals, Table 4 rows and derived totals, Table 5, Table 6 all nine rows, Table 7, RQ1 compile
shares and validation rates, latency, FLOWS_TO stores, judge unit counts, run-vs-run kappa, tool-comparison and
real-pair counts, ADR-005 graph contract, judge pre-registration pins).

| # | Line(s) | Paper says | Source says | Source file |
|---|---|---|---|---|
| N1 | 553 | 3 remaining strict FPs "stay false positives" | 3 items labelled `uncertain` (`fp_uncertain 3`), counted as FP by the registered rule; none labelled `FP` | `results/so4-heldout/agg/prf_overall.csv`; `results/so4-heldout/score.json` (`fpUncertain 3`); `results/labels/labels.json` |
| N2 | 552 | 10 items "labelled true violations exposed by the seed" | 10 items labelled `unseeded-TP`, root cause `RC-GENUINE-UNSEEDED` (pre-existing) | `results/labels/labels.json`; `score.json` `fpItems` |
| N3 | 557 (caption), 590 | Bootstrap over 39 to 40 cells / 39 cells | Precision intervals use 36 cells in all three readings (`precision_n_cells` 36) | `results/so4-heldout/agg*/prf_overall.csv` |
| N4 | 582 (by omission) | Twins clean: 60/73 strict, 68/73 corrected | The primary (labelled) reading has 60/73 | `results/so4-heldout/score.json` `twinSpecificity` |
| N5 | 625 to 627 | Cited FF-P02 item marked by the labeller "as a standard pattern" (presented as a false or uncertain finding) | Label `unseeded-TP` in both runs | `results/labels/labels.json`, item `7aeca4ab...` |
| N6 | 393 with 385 to 389 | Audit figures (77 artefacts, 310 identical) presented as covering "the corrected" numbers | Audit at `1543ba9`, prereg v20; its `agg/` row shows N 75, 67/0/8, F1 0.944; corrected tables written later by `dcecbe90` (prereg v21) | `Docs/DiagnosticRuns/reproduction-audit-2026-10-10.md` §1, §3; commit `dcecbe90` |
| N7 | 71, 112, 386 | "310 result tables" | 310 files (CSV, JSON configs, score JSON, labels, SVG); 79 checked at producing commit only | same audit, "Verdict counts (files)" |
| N8 | 387 to 389 | 22 not re-runnable: corpus clones, timing profiles, two hand-assembled files, evaluation outputs | Also 4 label-plan outputs (RQ3 sampling frame) | same audit, "Verdict counts (files)" |
| N9 | 477 | "the ten registered corpus specifications" (implicitly the evaluated corpus) | The ten are MarvinRF__nest-docfy, dev-nest, dry-run, eryzerz__nestjs-ddd, ghostfolio, nestjslatam, realworld, truthy, valex, nestjs-active-record; raouf and typescript-ddd are absent | `results/pre-tag/so1-metrics-53cfaed4a313.json` `specs` |
| N10 | 429 | E7 specs "never edited" | nestjs-active-record spec: style layered at first commit, nestjs now; three commits | `so1-metrics` `specs[].first/current.style`; `git log corpus/specs/zhuravlevma__nestjs-active-record.yaml` |
| N11 | 448 | MO-X02/X03: "every copy was rejected" | All 14 rejections are `no-site`: 12 with 0 candidate sites, 2 (nestjslatam) with every candidate refused by `not-removable-guard`; no copy was ever produced | `results/so4-heldout/agg/seed_coverage.csv` |
| N12 | 685 | Judge-weighted variant: judge changes 0, 2, 8 verdicts (only effect reported) | The weight change alone changes 7, 5 and 2 verdicts versus the registered weights, including realworld to pass (0.800) with no judge failure | `results/e7-corpus/agg-proportional/ahs_by_aggregation.csv` (`verdict_changed_jw_*`, `ahs_combined_jw_judge_blind`); audit §3 E7 |
| N13 | 505 to 508, Table 4 | Ablation changes: 13 lost, 4 gained | Also 2 `fewer` rows (ghostfolio FF-SO01 22 to 16; variant-d FF-S01 3 to 2), not mentioned | `results/apg-ablation/so2/apg_ablation.csv` |
| N14 | 628 | kappa above "the registered validity criterion of 0.60" | Criterion governs keeping the FP/FN taxonomy as registered | `Docs/analysis-plan.md` line 403 |
| N15 | 364 (comment) | 22 353 lines | 22 433 at `b7034682` | line count of `src/**/*.ts` (find plus wc) |
| N16 | 413 | Registry versions 1 to 21 | Registry at v23 on `v1.2e` | `corpus/prereg.json` (`version` 23) |
| N17 | 806 | "only one project uses the layered style" | By `corpus_style`, two layered projects (19 scored seeds); one by `spec_style` (7) | `results/so4-heldout/agg/golden_instances.csv` |

N1, N2, N5, N6 and N12 change how a reader interprets a headline result. The rest are precision or scoping fixes.

## 10. Likely score

**Research track: weak reject (-1). Tool / new-ideas track: borderline (0), leaning weak accept if the fixes in
Section 11 items 1 to 12 are made.**

Justification:
- Soundness: the engineering and the reproducibility harness are strong, but the primary SO4 reading is built on a
  scorer artefact (M1), the judge has no validity evidence (M3), and the score design has an unaddressed dilution
  flaw (M4).
- Significance: the paper's own headline is parity with an existing tool on the rules both express. The novel
  part (broader rules, the judge, the score) is the least validated (M2, M3).
- Novelty: compiling a spec to Cypher over a code graph is close to jQAssistant; the TypeScript edges are useful
  but one of the two is not shown to matter on real code (M7).
- Presentation: clear and honest, but long, with remaining `\todo`s and unverified references.
- A research-track PC will read this as an excellent engineering report with an evaluation that answers "is it
  reproducible?" much better than "is it right and useful?".

## 11. Prioritised revision list (cheapest first)

Text-only fixes (hours):
1. Fix N1, N2, N3, N11, N14, N15, N16, N17 wording and numbers.
2. Replace the FF-P02 example (lines 625 to 627) and the Discussion sentence (lines 771 to 772) with what the
   labels actually show: test pairing (FF-CV05) is the main source of false or uncertain findings.
3. Remove "never edited" (line 429), add "floor-motivated", and say that the E7 specs are mechanically generated
   and unvalidated; add this to the threats.
4. Rewrite line 421 so that "held-out" refers to seed sites and the unseen stratum is E7 only.
5. Qualify the audit: "internal", "310 files", "before the ADR-033 corrections; the corrected tables were
   regenerated by script but not re-audited" (N6 to N8), in the abstract, contribution 5 and Section 4.
6. Report the judge-weighted dilution effect (N12) and the realworld-to-pass case; drop "can never raise" or
   qualify it.
7. Add the base rate (76% of passing units also carry a symbolic finding) next to the 63/73 figure, or drop the
   "coincides" argument.
8. Disclose the extractor gaps on real code (dynamic imports 2 and 7, 330 aliased imports, layer coverage 55% to
   84%, cycle row cap) and the labeller `search_web` issue in the threats.
9. Add the `fewer` rows to the ablation text and Table 4 (N13).
10. Remove the remaining `\todo`s, verify all 33 bibliography keys, add the missing related work in Section 6.

Re-analysis of existing data (days, no new runs):
11. Make the corrected reading primary for RQ2 (or justify the labelled hybrid explicitly), report twin specificity
    for every reading, and add a per-operator table for RQ2.
12. Report per-function RQ3 results and the share of HT weight per function; report precision without CV05.
13. Report judge run-to-run stability (20 of 331 non-unanimous), the fraction of each project covered by the
    20-unit cap, and the E1 judge-vs-panel result from `a8bfc73e` with its kappa 0 caveat once it is in a committed
    aggregate table.
14. Recompute RQ1 on the nine evaluated specifications, or say why the ten SO1 specifications differ.

New experiments (weeks):
15. Author or external human audit of a label sample (P1, P2) and of a judge sample.
16. Per-edge-type ablation on the E7 projects.
17. Seed operators (or a labelled sample of adequate size) for the untested non-import rules.
18. An architect-written specification for at least two E7 projects, compared with the generated one.
19. A second, semantically richer baseline (ArchUnitTS or jQAssistant) on the non-import rules.
20. A scale run on a project with thousands of files, and the E1 agentic gate experiment, or remove the agentic
    framing.
