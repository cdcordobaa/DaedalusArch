# Validity strategy for the instrument (methods memo)

**2026-10-16. Status: proposal for the author and director. Documentation only.** This memo says how the thesis can
argue that DaedalusArch measures what it claims to measure, with as little reliance on human raters as possible. The
author and director are not practising developers, so their labels would carry little authority. It is a methods
memo, not a literature review: each precedent is cited only to show that a method has been accepted before for
validating a static-analysis or architecture-conformance tool.

**What "the instrument" means here.** The instrument is the YAML spec compiled to Cypher rules over the APG code graph
(the *symbolic* part), plus the LLM judge (the *neural* part). The claim to be validated is: *a blocking finding marks
code that breaks a defining constraint of the declared style, and the absence of a finding means no such break of a
covered constraint*. The judge is validated separately and more weakly (§2.7).

**Rules for reading this memo.**
- Every repository number names its source file. Numbers marked *[dev]* come from development data that the v1.3
  changes were tuned on. They are not validity estimates (`papers/STATUS.md`).
- Every citation below was checked on 2026-10-16 against its Crossref (DOI), arXiv, USENIX or dblp record: title,
  first author, venue and year. The full texts were not re-read for this memo, so each one-line "what it did" note
  rests on the abstract. Anything not confirmed is marked **UNVERIFIED**.
- The framework follows the unified view of validity (Messick 1995; Kane 2013): validity is an *argument* about one
  interpretation of the scores, built from several kinds of evidence. It is not a list of separate validities that
  each pass or fail. The classical labels below (content, construct, criterion…) are used because examiners expect
  them. Each one is read as "a strand of evidence for the one interpretation above".

---

## 1. Summary table

Strength scale: **strong** (an examiner would accept it as stated), **moderate** (accepted with stated limits),
**weak** (suggestive only), **absent** (planned, no data).

| # | Validity strand | Evidence in this project | State | Strength today | Main attack | Human piece that closes it |
|---|---|---|---|---|---|---|
| 2.1 | Content | Rule-source traceability (`rule-source-verification.md`, errata) | done | moderate | 5 of 13 rows only partly supported; 8 rules have no source row; books not read in print | 3 architects rate rule–source fit (≈ 25 rules) |
| 2.2 | Construct: mechanical correctness | 0 incorrect of 2,669 checkable findings *[dev]* | done | strong (for "correct", not "meaningful") | correctness is checked against the tool's own definitions | none needed |
| 2.3 | Construct / criterion (concurrent): seeded detection | SO4 seeded recall 0.918; v1.3 dev set; hold-out pre-specified | SO4 done; hold-out not run | moderate → strong after the hold-out | seeds written by the tool's designer and a same-vendor model; mutants ≠ real violations | the blind union sheet on the hold-out (`human-labelling-protocol.md`) |
| 2.4 | Criterion (concurrent): developer-fix mining | 5 real fix-commit pairs, 2 detected | done, n = 5 | weak | n = 5, one repository, author-mined | none; enlarge the mined set instead |
| 2.5 | Criterion (predictive): bug-fix churn | none yet | absent | absent | — | none needed |
| 2.6 | Convergent / discriminant | dependency-cruiser on SO4 seeds, 7 bases, 14 wild repositories; ArchUnitTS and eslint-plugin-boundaries **not run** | partly done | moderate (one tool) | agreement on import-direction rules only; the comparison's translation was written by the author | none |
| 2.7 | Judge validity (cross-vendor panel) | P4 34/36 agreement, κ = 0; same-vendor model swap κ = 0.766 | done | weak | the judge passed every item, so κ cannot show discrimination; panel models are not humans | 50–100 items rated by paid practising architects |
| 2.8 | Reliability: engine parity | interpreter vs Neo4j: 65,254 statements, 0 content differences | done | strong | — | none |
| 2.9 | Reliability: reproduction | internal audit: 310 committed result files byte-identical; v1.3 audit: 482 of 531 headline rows match, 0 overturned | done | moderate | internal; 310 are files, not tables; predates the ADR-033 corrections | none; an external artefact evaluation would help |

The honest overall reading: **the instrument's reliability and mechanical correctness are strongly evidenced; its
construct and criterion validity are moderately evidenced and depend on one unrun step (the sealed hold-out); its
predictive validity and the judge's validity are not yet evidenced.**

---

## 2. Strand by strand

### 2.1 Content validity: do the rules cover the styles' defining constraints, and only those?

**Evidence.** `Docs/v1.3/rule-source-verification.md` checks the 13 rows of `style-rule-sources.md` against
accessible primary text (Martin's 2012 blog, Cockburn 2005, Evans's *DDD Reference* 2015, Vernon 2011, the NestJS
docs, Fowler's bliki). Result: 8 rows VERIFIED-VERBATIM, 5 PARTIALLY SUPPORTED, none contradicted.
`style-rule-sources-errata.md` corrects the chapter locators and lists the gaps: FF-P02, FF-P04, FF-P05, FF-P06,
FF-DT05, FF-DS01, FF-DS02 and FF-S04 (in DDD) have no source row. `rule-tiers.md` gives the blocking/advisory principle:
only a precise structural fact that states a defining constraint may block.

**Precedents.** Content validity in software measurement is argued by tracing each measure to an accepted definition
of the attribute (Kitchenham, Pfleeger and Fenton 1995). Tool papers that catalogue architecture smells do the same,
mapping each detector to its literature definition before any empirical check (Azadi, Arcelli Fontana and Taibi 2019).

- Kitchenham, B., Pfleeger, S. L., Fenton, N. "Towards a framework for software measurement validation". *IEEE TSE*,
  1995. https://doi.org/10.1109/32.489070
- Azadi, U., Arcelli Fontana, F., Taibi, D. "Architectural Smells Detected by Tools: a Catalogue Proposal".
  *TechDebt 2019*. https://doi.org/10.1109/techdebt.2019.00027

**Strength: moderate.** The method is right and the trace exists. The gaps are real, but they are listed by the
project itself, which an examiner will credit.

**Attacks.** (a) Five rows are stricter than their source (Evans allows transient inner references; POSA has a relaxed
layered variant; Cockburn states no dependency rule at all). (b) Eight rules have no source. (c) Wording marked
*(recalled)* was not read in print. (d) The traceability shows the rules are *licensed* by the sources, not that the
rule set *covers* the styles (no coverage argument for what the tool omits, such as dynamic `import()`).

**Close it without humans.** Before the freeze, give every blocking rule a source row or demote it to advisory; check
the recalled wording in print; add a short "known omissions" table (constructs the styles define that no rule covers).
**Minimal human piece (optional):** three practising architects each rate, for about 25 blocking rules, "Does this
rule follow from the cited text? yes / stricter / no". About 2 hours each. This is the cheapest human step in the memo
and turns a self-assessment into an expert-panel content check.

### 2.2 Construct validity, part 1: mechanical correctness

**Evidence.** Every checkable finding is re-checked by an independent checker against the graph and the source text:
all 2,669 checkable findings are correct (1,485 of 1,663 reference findings, 1,184 of 1,428 E1 findings) *[dev]*
(`Docs/DiagnosticRuns/v1.3-labelling-2026-10-15.md`). **Correction to carry into the thesis:** the labelling doc prints 2,668 (1,484 reference); the v1.3
reproducibility audit (finding E-7, `Docs/DiagnosticRuns/v1.3-repro-audit-2026-10-16.md`) recomputes the reference
row as 1,485 correct and 178 not checkable, so the total is **2,669**. Zero incorrect still stands. Graph fidelity
against the TypeScript compiler and dependency-cruiser is agreement-based: Jaccard 0.988 (E1) and 0.913 (SO4, scoped),
0 unexplained disagreements *[dev]* (`v1.3-graph-fidelity-2026-10-14.md`); on 14 public repositories the v1.3 literal
view agrees exactly with both references (`v1.3-wild-2026-10-16.md` §4).

**Precedents.** Building a mechanical oracle in place of human labels is the norm in differential and metamorphic
testing of query engines (Rigger and Su 2020); comparing two independent extractors of the same graph is the same
idea.

- Rigger, M., Su, Z. "Testing Database Engines via Pivoted Query Synthesis". *OSDI 2020*.
  https://www.usenix.org/conference/osdi20/presentation/rigger

**Strength: strong, for the narrow claim** "the finding is a true statement about the code". Not for "the finding
matters".

**Attacks.** The checker and the tool share the project's definitions of a layer and an edge. 422 of 3,091 findings (about
14 %) are not checkable. "Correct" is not "meaningful", and the meaningful labeller stopped at a usage limit after one
answer (`v1.3-labelling-2026-10-15.md`).

**Human piece:** none for correctness. Meaningfulness is handled in 2.3 and 2.7.

### 2.3 Construct and concurrent criterion validity: seeded detection

**Evidence.**
- Study 1 SO4 held-out seeds: recall 0.918 [0.818, 1.000] on 73 seeds, all six misses dynamic `import()`;
  corrected precision 1.000 [CP 0.946, 1.000] (`results/so4-heldout/agg-corrected/prf_overall.csv`; paper 2, Table at
  line 643). Twins (near-miss controls that should not fire): 2/42 fired
  (`Docs/DiagnosticRuns/tool-comparison-real-pairs-2026-10-10.md` §A).
- v1.3 development reference set: pooled blocking recall 54/54 (author view; 3 FF-P06 field-initialiser rows
  reported N/A, recall unestimated; PR #120), 50/64 (blind view) *[dev]*
  (`v1.3-reference-after-member-facts-2026-10-15.md`, "Correction (2026-10-16)").
- v1.3 hold-out: 207 sealed cases, pre-specified in `Docs/v1.3/holdout-prespec.md`, **not yet run**.

**Precedents.** Injecting known faults to obtain ground truth for detector recall is accepted when real labelled
violations are scarce (Dolan-Gavitt et al. 2016). Its validity rests on mutants behaving like real faults, which has
been tested for test suites (Just et al. 2014). The closest analogue for static analysers is differential mutation
analysis (Groce et al. 2021). No peer-reviewed paper was found that seeds *architecture* violations to evaluate an
architecture checker, so the thesis should say the method is transferred, not standard, for this tool class.

- Dolan-Gavitt, B. et al. "LAVA: Large-Scale Automated Vulnerability Addition". *IEEE S&P 2016*.
  https://doi.org/10.1109/sp.2016.15
- Just, R. et al. "Are mutants a valid substitute for real faults in software testing?". *FSE 2014*.
  https://doi.org/10.1145/2635868.2635929
- Groce, A. et al. "Evaluating and Improving Static Analysis Tools Via Differential Mutation Analysis". *IEEE QRS 2021*.
  https://doi.org/10.1109/qrs54544.2021.00032

**Strength: moderate today; strong if the hold-out runs clean.** SO4 was registered before it ran, which is the
project's best single piece of evidence.

**Attacks.** (a) **Circularity:** the designer of the rules also designed the seeds, so recall measures agreement with
the designer's own reading. (b) **Same vendor:** the hold-out was written by a model of the same vendor as the judge
and the blind annotator, and enlarged from 62 to 207 after tuning (`holdout-prespec.md`, "Known limitations"). (c)
**Representativeness:** seeds are single-edit mutants; real violations are often diffuse. (d) The blind-view recall
50/64 (after the FF-P06 N/A correction, PR #120) shows the score depends on who writes the manifest.

**Close it without humans.** Run the hold-out once at the freeze; add the recommended external arm (one
non-Claude-authored project per style, rules written by someone outside the project, e.g. dependency-cruiser
`forbidden` rules already in a repository); report the twin/decoy false-fire rate as the discriminant side.
**Minimal human piece:** the blind union sheet of `human-labelling-protocol.md` (manifest ∪ tool ∪ decoys,
source-blind), answered by a paid practising architect as the *second rater*. This is the same item pool as 2.7, so
one paid session can serve both.

### 2.4 Concurrent criterion validity: developer-fix mining

**Evidence.** Five real fix-commit pairs (`results/real-pairs/`, `tool-comparison-real-pairs-2026-10-10.md` §B):
DaedalusArch and dependency-cruiser each detect 2 of 5, the same two, through the same import-direction rules. The
three misses are explained (spec granularity, intra-layer imports, NestJS wiring). TV-106 records the limits.
`v1.3-rule-mining` (unmerged, exploratory) mines implicit rules from brownfield code; it is not fix mining.

**Precedents.** Treating a warning that developers removed in a fix as evidence that it was real is an established,
rater-free oracle (Kim and Ernst 2007; Liu et al. 2021). SZZ links fixes to the changes that caused them
(Śliwerski et al. 2005); its own error rate is documented (Rosa et al. 2021), which the thesis should cite as a threat.

- Kim, S., Ernst, M. D. "Which warnings should I fix first?". *ESEC/FSE 2007*.
  https://doi.org/10.1145/1287624.1287633
- Liu, K. et al. "Mining Fix Patterns for FindBugs Violations". *IEEE TSE* 47, 2021 (online 2018).
  https://doi.org/10.1109/tse.2018.2884955
- Śliwerski, J., Zimmermann, T., Zeller, A. "When do changes induce fixes?". *MSR 2005*.
  https://doi.org/10.1145/1083142.1083147
- (threat) Rosa, G. et al. "Evaluating SZZ Implementations Through a Developer-Informed Oracle". *ICSE 2021*.
  https://doi.org/10.1109/icse43902.2021.00049

**Strength: weak** (case description, not an estimate).

**Attacks.** n = 5, four from one repository, author-picked from commit messages, scored with a spec written for a
later commit; large refactors can "resolve" findings by churn alone.

**Close it without humans.** Scale it mechanically: in repositories that *already enforce* boundaries (the corpus
criteria list `.dependency-cruiser.*`, `eslint-plugin-boundaries`, `tsarch`, `archunit`), take every commit that
changes the enforcement config or whose message matches a fixed keyword list, and record whether a DaedalusArch
finding on a touched file disappears. Fix the keyword list, the window and the "strict" rule before running. Target
≥ 50 pairs from ≥ 10 repositories, so a Wilson interval is meaningful. **Human piece:** none; the developers who
made the fix are the raters.

### 2.5 Predictive criterion validity: do findings predict bug-fix churn?

**Evidence.** None yet. `threats-to-validity.md` mentions churn only as a confound of 2.4.

**Precedents.** This is the most widely accepted rater-free validation for architecture and design smell detectors:
files that a detector flags are shown to attract more bug fixes and changes in the project's own history.

- Mo, R. et al. "Hotspot Patterns: The Formal Definition and Automatic Detection of Architecture Smells". *WICSA 2015*.
  https://doi.org/10.1109/wicsa.2015.12
- Xiao, L. et al. "Identifying and quantifying architectural debt". *ICSE 2016*.
  https://doi.org/10.1145/2884781.2884822
- Khomh, F. et al. "An exploratory study of the impact of antipatterns on class change- and fault-proneness".
  *Empirical Software Engineering* 17, 2012 (online 2011). https://doi.org/10.1007/s10664-011-9171-y
- Also usable: Le, D. M. et al. "An Empirical Study of Architectural Decay in Open-Source Software", *ICSA 2018*,
  https://doi.org/10.1109/icsa.2018.00027; Lenarduzzi, V. et al. "Are SonarQube Rules Inducing Bugs?", *SANER 2020*,
  https://doi.org/10.1109/saner48275.2020.9054821 (a negative-leaning result worth citing for balance).

**Proposed design (no humans).** On the 14 wild repositories plus the E7 corpus, at a pinned SHA per repository:
(1) run the instrument with ISE-inferred or repository-declared specs; (2) per file, the exposure is "has ≥ 1
blocking finding"; (3) the outcome is the number of bug-fix commits touching the file in the next 12 months (keyword
or issue-label classification, SZZ-style, rules fixed in advance); (4) a negative-binomial model with file size
(LOC) and prior churn as covariates, repository as a random effect. Pre-register the model and the keyword list.
Size control is mandatory: without it any structural metric "predicts" bugs.

**Strength once run:** moderate. **Attacks:** bug classification noise (Rosa et al. 2021); size and age confounding;
a null result is likely for single-edge import violations and should be reported, not hidden. **Human piece:** none.

### 2.6 Convergent and discriminant validity: agreement with other tools

**Evidence.**
- dependency-cruiser 18.4.0 on the SO4 seeds (registered, prereg v19): in coverage DA 37/37, dc 28/37 (36/37 in the
  post-hoc `dts` variant); on the 6 dynamic-import seeds DA 0/6, dc 6/6. Twins 2/42 for both
  (`tool-comparison-real-pairs-2026-10-10.md` §A).
- Seven unseeded bases: the tools agree on FF-S01, FF-S03 and FF-P01 on five bases; differences are explained by
  alias resolution (ghostfolio) and by different cycle units (§A volume table).
- 14 wild repositories: the v1.3 literal view agrees exactly with tsc and dependency-cruiser on file edges
  (`v1.3-wild-2026-10-16.md`).
- **ArchUnitTS and eslint-plugin-boundaries have not been run.** They appear only as corpus selection criteria
  (`Docs/corpus-criteria.md`) and in `e7-candidate-research-2026-10-09.md`.

**Discriminant side.** The thesis can claim discriminant evidence where the tools *should* disagree and do: rules
dependency-cruiser cannot express (member facts, DI edges, aggregate boundaries, metric rules) produce DA-only
findings, and dynamic `import()` produces dc-only findings, each explained by a documented construct difference.
Twins and decoys that do not fire are the second discriminant check.

**Precedents.** Agreement between independent detectors is a standard way to check smell detectors without a gold
standard, and the low agreement usually found is itself a reported result (Arcelli Fontana et al. 2012; Paiva et al.
2017). The multitrait–multimethod logic (Campbell and Fiske 1959) is the formal basis for reading "same trait,
different method" as convergent and "different trait" as discriminant.

- Arcelli Fontana, F., Braione, P., Zanoni, M. "Automatic detection of bad smells in code: An experimental
  assessment". *Journal of Object Technology* 11(2), 2012. https://doi.org/10.5381/jot.2012.11.2.a5
- Paiva, T. et al. "On the evaluation of code smells and detection tools". *JSERD* 2017.
  https://doi.org/10.1186/s40411-017-0041-1
- Campbell, D. T., Fiske, D. W. "Convergent and discriminant validation by the multitrait-multimethod matrix".
  *Psychological Bulletin*, 1959. https://doi.org/10.1037/h0046016

**Strength: moderate** (one tool, import-direction rules only).

**Attacks.** (a) The rule translation into dependency-cruiser was written by the author (TV-104), and one translation
defect was found post hoc. (b) All tools share the same import-graph construct, so agreement shows the graph is right,
not that a violation matters. (c) Only one comparison tool.

**Close it without humans.** Add ArchUnitTS and eslint-plugin-boundaries on the same seeds and bases, and, more
valuable, use **rules already written by each repository's own maintainers** (the existing `.dependency-cruiser.*` or
boundaries config in enforced repositories). That removes the author-translation attack. Present the result as a small
MTMM table: rows = rule family (direction, cycles, purity), columns = tool. **Human piece:** none.

### 2.7 The judge: cross-vendor model panel

**Evidence.** On 36 decided E1 items a panel model of another vendor (Gemini 3.1 Pro, API route) agreed with the judge
on 34 (weighted agreement 0.982, AC1 0.982), but Cohen's κ = 0 because the judge passed all 36
(`results/e1-grid/label-plan-p4-api/labelling.json`; paper 2 §"judge"). A registered model-swap check (ADR-038,
Opus → Sonnet, same vendor) agreed on 94/100 units, κ = 0.766 [0.565, 0.926], AC1 0.931, with no project verdict
changed (`results/judge-robustness/`). The v1.3 judge-catch audit (finding D-3) shows the judge names missed constructs
and rules them out of scope.

**Precedents.** LLM-as-judge is accepted when agreement with a reference is reported with chance-corrected statistics
and known biases are tested (Zheng et al. 2023). A panel of models from different families reduces single-judge bias
(Verga et al. 2024). In SE, recent studies report that LLM labels can replace humans only on some tasks, and use
inter-model agreement as the signal for when (Ahmed et al. 2025; Wang et al. 2025). Both conclude that human
calibration is still needed.

- Zheng, L. et al. "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena". *NeurIPS 2023 (Datasets and
  Benchmarks)*. https://doi.org/10.52202/075280-2020
- Verga, P. et al. "Replacing Judges with Juries: Evaluating LLM Generations with a Panel of Diverse Models". arXiv
  2024. https://arxiv.org/abs/2404.18796
- Ahmed, T. et al. "Can LLMs Replace Manual Annotation of Software Engineering Artifacts?". *MSR 2025*.
  https://doi.org/10.1109/msr66628.2025.00086
- Wang, R. et al. "Can LLMs Replace Human Evaluators? An Empirical Study of LLM-as-a-Judge in Software Engineering".
  *Proc. ACM Softw. Eng.* 2 (ISSTA), 2025. https://doi.org/10.1145/3728963

**Strength: weak** for validity; moderate for reliability (the swap check).

**Attacks.** (a) κ = 0: the panel cannot show the judge discriminates. (b) Model agreement is not truth; models can
share blind spots. (c) The swap check is same-vendor. (d) The judge does not move verdicts under the registered
configuration, so its validity matters less for the thesis's main claim; say so.

**Minimal human piece (the one recommended in this memo).** **50 to 100 items rated by 2 paid practising
architects**, drawn from the hold-out union sheet (2.3) and from judge units, stratified so that at least 30 % are
expected "no" (decoys, twins, judge fails). Report κ and AC1 for architect–architect, architect–panel and
architect–tool, with the existing κ ≥ 0.60 gate (`human-labelling-protocol.md`). With 2 raters × 80 items at about
1 minute per item plus calibration, this is roughly 2 × 3 hours. It gives the panel a human anchor, so that the larger
model-labelled sets can be reported as "panel labels, calibrated against architects on a subsample" (the design of
Ahmed et al. 2025). Recruit through a paid platform or the director's industry contacts; architects must not see the
tool's verdict or the item's source. The author and director stay out of the rating.

### 2.8 Reliability: interpreter parity with Neo4j

**Evidence.** A differential harness sends every statement to Neo4j 5.26.24 + APOC and to the in-process Cypher
interpreter: 65,254 statements over 79 projects, 0 content differences, 0 errors, 0 unsupported; 763 `order`
differences, all from two documented traps (row order without ORDER BY; float aggregation order), neither affecting a
template. The reference run is byte-identical under both engines (71/71 variants)
(`Docs/v1.3/cypher-interpreter.md` §1, §4).

**Precedents.** Differential testing across implementations is a standard oracle (McKeeman 1998), and it is the
accepted method for finding bugs in Cypher engines specifically (Hua et al. 2023; Kamm et al. 2023).

- McKeeman, W. M. "Differential Testing for Software". *Digital Technical Journal* 10(1), 1998. Citation confirmed in
  dblp (https://dblp.org/pid/40/4856); **no working full-text URL found**.
- Hua, Z. et al. "GDsmith: Detecting Bugs in Cypher Graph Database Engines". *ISSTA 2023*.
  https://doi.org/10.1145/3597926.3598046
- Kamm, M., Rigger, M., Zhang, C., Su, Z. "Testing Graph Database Engines via Query Partitioning". *ISSTA 2023*.
  https://doi.org/10.1145/3597926.3598044

**Strength: strong.** This is engine-independence (a form of inter-method reliability), not validity.

### 2.9 Reliability: deterministic reproduction

**Evidence.** An internal audit regenerated **310 committed result files** byte for byte (231 at the audited head,
79 only at their producing commit) (`Docs/DiagnosticRuns/reproduction-audit-2026-10-10.md`). The v1.3 audit
re-derived 531 headline rows across 15 docs: 482 match, 26 mismatch (typos and stale numbers), 7 ambiguous, 16 not
checkable; no headline result overturned (`v1.3-repro-audit-2026-10-16.md` §1). `replication/README.md` regenerates the
offline deterministic results byte for byte.

**Wording warning.** `papers/paper2-tool/REVIEW-adversarial.md` (N6, N7) already flags that "310 result tables" is
wrong: they are 310 **files** (CSV, JSON configs, score JSON, labels, an SVG), and the audit **predates the ADR-033
corrections**, so it does not cover the corrected SO4 tables. The thesis must say "an internal audit regenerated 310
committed result files … before the post-hoc corrections".

**Precedents.**
- Collberg, C., Proebsting, T. A. "Repeatability in computer systems research". *CACM*, 2016.
  https://doi.org/10.1145/2812803
- ACM, "Artifact Review and Badging", v1.1. https://www.acm.org/publications/policies/artifact-review-and-badging-current
  — **partly verified**: the page returned 403 when fetched; https://www.acm.org/publications/badging-terms confirms
  v1.1 and that "Reproduced" and "Replicated" swapped meanings in 2020. Quote the ACM terms only after reading the page.

**Strength: moderate.** Strong as a determinism claim; weaker as independent evidence because the audits are
internal and some inputs (E1 outcomes, SO4 checkouts, sealed manifests) are outside the repository.
**Close it:** submit the replication package to an artifact track (ICSA/ECSA artifact evaluation) for an external
"Results Reproduced" badge. No human rating needed.

---

## 3. What an examiner will attack first (ranked)

1. **"Your ground truth is you."** The rules, the seeds, the manifests and the comparison translation all come from the
   author or a model the author directed. Answer: the hold-out (sealed, pre-specified), maintainer-written rules in
   enforced repositories (2.6), developer fixes (2.4) and churn (2.5) are the four sources the author did not write.
   Today only the first exists, and it is not run.
2. **"Same vendor everywhere."** Judge, hold-out author and blind annotator are one vendor. Answer: the cross-vendor
   panel (2.7) and non-LLM criteria (2.4, 2.5); state the residual threat.
3. **"Correct is not meaningful."** 2,669 correct findings say nothing about whether an architect would act on them.
   Answer: only the paid-architect subsample (2.7) closes this. No rater-free method does.
4. **"Seeds are not real violations."** Answer: Just et al. 2014 for the general argument; 2.4 and 2.5 for real ones;
   admit that no architecture-specific mutant-validity study exists.
5. **"Development numbers."** Every v1.3 figure is *[dev]*. Answer: the hold-out, once.

## 4. Minimal human component (recommendation)

One paid session, run after the hold-out outputs are committed:

| What | Who | Size | Closes |
|---|---|---|---|
| Blind union sheet + judge units, three-way answer, source-blind | 2 paid practising architects (≥ 5 years, have enforced a layered/hexagonal/DDD codebase) | 80 items each (range 50–100), ≥ 30 % expected "no", plus the 20-case "anything else?" pass by one of them | 2.3 circularity, 2.7 κ = 0, "correct ≠ meaningful" |
| Rule–source fit | 3 architects (may be the same people) | about 25 blocking rules | 2.1 |

Budget order of magnitude: 2–3 people × 3–5 hours. Everything else in this memo is rater-free. If no architect can be
paid, the thesis must state that meaningfulness is supported only by model-panel agreement and say that this is a
limitation, not evidence.

## 5. Proposed structure of the thesis validity chapter

Proposed title: **Chapter N — Validity of the Instrument**

> N.1 **The interpretation being validated.** One paragraph stating the claim from the head of this memo, and that
> validity is argued as one evidence-based case (Messick 1995; Kane 2013), using the SE measurement-validation
> framing of Kitchenham et al. 1995 and Meneely et al. 2012, and the construct-validity guidance of Ralph and Tempero
> 2018 and Sjøberg and Bergersen 2023.
>
> N.2 **Content: tracing rules to the style literature.** Rule-source verification, errata, tiering principle, known
> omissions.
>
> N.3 **Construct: does a finding state a true fact about the code?** Mechanical correctness (0 incorrect of 2,669
> checkable), graph fidelity against tsc and dependency-cruiser.
>
> N.4 **Criterion (concurrent): does the instrument find known violations?** N.4.1 Seeded violations (SO4,
> registered; v1.3 hold-out, sealed). N.4.2 Violations developers fixed (mined pairs).
>
> N.5 **Criterion (predictive): do findings precede bug fixes?** Churn study, or "not done" with the reason.
>
> N.6 **Convergent and discriminant evidence.** MTMM-style table against dependency-cruiser (and ArchUnitTS,
> eslint-plugin-boundaries if run), twins and decoys, and an explanation of every systematic disagreement.
>
> N.7 **The neural component.** Judge vs cross-vendor panel, model-swap robustness, and the architect subsample if
> obtained. State plainly that the judge does not move verdicts under the registered configuration.
>
> N.8 **Reliability.** Engine parity (interpreter vs Neo4j), determinism, the reproduction audits and replication
> package.
>
> N.9 **The validity argument and its limits.** The summary table of §1 of this memo, with strength ratings and the
> attacks of §3 answered or conceded. Close with what a user of the tool may and may not conclude from a pass and from a
> block.

Suggested opening sentence for N.1: *"Because no independent body of expert-labelled architecture violations exists
for TypeScript, and because the author and director are not practising architects, the validity of the instrument is
argued from evidence sources that do not depend on their judgement: traceability to the style literature, mechanical
oracles, sealed seeded cases, developers' own fixes, agreement with independent tools, and the instrument's
determinism. A small paid panel of practising architects is used only where no rater-free method can answer the
question, namely whether a finding is one an architect would act on."*

## 6. Action list (in order)

1. Correct 2,668 → 2,669 and "310 tables" → "310 files, before the ADR-033 corrections" wherever cited.
2. Give every blocking rule a source row or demote it; check recalled wording in print.
3. Freeze and run the hold-out once; add the external non-Claude arm.
4. Run ArchUnitTS and eslint-plugin-boundaries, and maintainer-written configs, on the SO4 seeds and the bases.
5. Scale fix mining to ≥ 50 pairs in enforced repositories, rules fixed first.
6. Pre-register and run the churn study on the wild + E7 repositories.
7. Commission the 2-architect, 80-item rating.
8. Submit the replication package to an artifact track.

## 7. Further verified references cited above

- Messick, S. "Validity of psychological assessment: Validation of inferences from persons' responses and performances
  as scientific inquiry into score meaning". *American Psychologist* 50(9), 1995. https://doi.org/10.1037/0003-066x.50.9.741
- Kane, M. T. "Validating the Interpretations and Uses of Test Scores". *Journal of Educational Measurement*, 2013.
  https://doi.org/10.1111/jedm.12000
- Meneely, A., Smith, B., Williams, L. "Validating software metrics: A spectrum of philosophies". *ACM TOSEM*, 2012.
  https://doi.org/10.1145/2377656.2377661
- Ralph, P., Tempero, E. "Construct Validity in Software Engineering Research and Software Metrics". *EASE 2018*.
  https://doi.org/10.1145/3210459.3210461
- Sjøberg, D. I. K., Bergersen, G. R. "Construct Validity in Software Engineering". *IEEE TSE*, 2023.
  https://doi.org/10.1109/tse.2022.3176725
- Wohlin, C. et al. *Experimentation in Software Engineering*. Springer, 2012.
  https://doi.org/10.1007/978-3-642-29044-2

Verified but not cited in the strands above (available if needed): Xiao, Cai, Kazman, "Design rule spaces", ICSE 2014,
https://doi.org/10.1145/2568225.2568241; Palomba et al., "On the diffuseness and the impact on maintainability of code
smells", EMSE 23, 2018 (online 2017), https://doi.org/10.1007/s10664-017-9535-z; Habib and Pradel, "How many of all
bugs do we find? A study of static bug detectors", ASE 2018, https://doi.org/10.1145/3238147.3238213; Lenarduzzi,
Saarimäki, Taibi, "Some SonarQube issues have a significant but small effect on faults and changes", JSS 2020,
https://doi.org/10.1016/j.jss.2020.110750; Arcelli Fontana et al., "Comparing and experimenting machine learning
techniques for code smell detection", EMSE 2016 (online 2015), https://doi.org/10.1007/s10664-015-9378-4; Ami et al.,
"Systematic Mutation-Based Evaluation of the Soundness of Security-Focused Android Static Analysis Techniques", ACM
TOPS 2021, https://doi.org/10.1145/3439802; He et al., "From Code to Courtroom: LLMs as the New Software Judges",
arXiv 2025, https://arxiv.org/abs/2503.02246.
