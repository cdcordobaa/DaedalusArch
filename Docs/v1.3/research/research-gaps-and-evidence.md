# Research gaps and evidence: published precedents, gap analysis and scope (master's vs doctoral)

**2026-10-16. Status: research memo for the author and director. Documentation only; no code, rule, preset, template,
result or registered artefact was changed, and no LLM judge or rater call was made.** Do not merge without the
author's review.

**What this memo is for.** Section 1 maps each validity and backlog job onto published software-engineering studies
that used the same method, and says what each precedent implies for our design. Section 2 lists the open problems the
literature names and says which ones this thesis addresses. Section 3 separates what the **master's thesis** can claim
now (3a) from a **doctoral agenda** (3b). Section 3b is kept apart on purpose, so that it never inflates a master's
claim. Section 4 gives draft paragraphs for the "Related work" and "Future work" chapters.

**How the references were verified (read before citing anything).**
- **[V-DOI]**: title, first author, venue and year confirmed on 2026-10-16 against the Crossref record of the DOI given.
- **[V-arXiv]**: title, first author and first-submission date confirmed against the arXiv API record. **An arXiv
  preprint is not peer-reviewed** unless a venue is also confirmed. Where a venue is named only from memory or a search
  snippet, it is marked *(venue not checked against a record)*.
- Full texts were **not** re-read. Each "what it did" line rests on the abstract (read for the arXiv items and for the
  2025–2026 papers) or on the citing memo `Docs/v1.3/validity-strategy.md` (branch `v1.3-validity-strategy`, PR #147),
  whose references were checked the same way. Any sample size quoted below comes from an abstract. Re-read the paper
  before quoting a number in the thesis.
- Items that could not be confirmed are in §5.3 and marked **UNVERIFIED**. Nothing in §1, §2 or §4 depends on them.
- Grey literature (vendor docs, blogs, tool READMEs) is never used as a precedent.

**Project status used here** (sources: the night backlog `Docs/v1.3/night-backlog-2026-10-16.md`, the validity memo,
PR titles into `v1.3` as of 2026-10-16, and the Notion roadmap / compliance register / long-term ideas pages). Every
v1.3 number is development data *[dev]* unless stated otherwise. Several numbers come from **open, unreviewed PRs** and
are marked *(open PR)*.

| Objective | State | Main evidence | Main gap |
|---|---|---|---|
| SO1 specs and style libraries | objective text met; content-validity gap open | 5 style libraries; rule-source verification (8 verbatim, 5 partial) | 8 blocking rules without a source row |
| SO2 property graph | reframed; real-world value pending | graph fidelity vs tsc and dependency-cruiser; 15-repository external set (#133, open PR) | value on human code is not yet shown beyond correctness |
| SO3 neuro-symbolic | 16/21 = 0.76 [0.55, 0.89] vs the 0.80 target | judge catch test; P4 panel 34/36 with κ = 0; model swap κ = 0.766 | below target; selective prediction failed its rule (#165, open PR) |
| SO4 validity (non-human evidence, by the author's decision) | pending | 0 incorrect of 2,669 checkable *[dev]*; SO4 seeded recall 0.918; 283/283 blocking findings correct on human code (#167, open PR) | sealed hold-out not run; fix mining shows no robust signal (#168, open PR); no predictive evidence |
| SO5 spec level vs generated architecture | floor effect | hexagonal none-arm 0/14 steps blocking (#161, open PR); E1 0 blocking at any spec level | agents rarely break defining rules in greenfield, so the outcome has little variance |

Study 2 runs **exactly once**. Nothing in this memo reads, names or infers a Study 2 task or the sealed hold-out.

---

## 1. Evidence map: each job against its published precedents

Summary first; detail per job below. "Strength once run" uses the scale of the validity memo §1.

| # | Job (backlog / memo id) | Objective | Closest published method | What the precedent sets for us | Status here |
|---|---|---|---|---|---|
| 1.1 | Developer-fix mining (memo 2.4) | SO4 | Kim & Ernst 2007; Liu et al. 2021; SZZ (Śliwerski et al. 2005) | many projects, fixed classification rules, SZZ error as a stated threat | 36 histories, 14 fix commits; no robust signal (#168, open PR) |
| 1.2 | Predictive validity on bug-fix churn (memo 2.5) | SO4 | Khomh et al. 2012; Xiao et al. 2016; Mo et al. 2015, 2021 | size and churn controls; misclassified bugs (Herzig et al. 2013) | absent |
| 1.3 | Convergent agreement with established checkers (memo 2.6) | SO4 | Arcelli Fontana et al. 2012; Paiva et al. 2017; Campbell & Fiske 1959 | low agreement is normal and is reported; MTMM layout | dc, boundaries, ArchUnitTS (#166, open PR) |
| 1.4 | Mutation analysis of the rules (memo 2.3; #162) | SO4 | Groce et al. 2021; Ami et al. 2021; Just et al. 2014 | mutant–real-fault link is unproven for architecture | SO4 seeds; hex/DDD operators drafted (#162, open PR) |
| 1.5 | Metamorphic testing of the analyser | SO4 (reliability) | Chen et al. 2018/2019; Segura et al. 2016; Zhang et al. 2023 (Statfier); Klinger et al. 2018 | relations must be semantics-preserving by construction; report each relation separately | not run (no PR found) |
| 1.6 | Cross-vendor LLM panel (memo 2.7; #153) | SO3, SO4 | Verga et al. 2024; Ahmed et al. 2025; Wang et al. 2025 | panel is a calibration aid, not ground truth; needs a human subsample | harness + fake dry run (#153, open PR); P4 κ = 0 |
| 1.7 | Selective prediction for the judge (N1; #165) | SO3 | Geifman & El-Yaniv 2017; Jung et al. 2024; Spiess et al. 2024 | fix the risk target before computing; report coverage | unanimity did not meet the rule (#165, open PR) |
| 1.8 | Floor and precedent probes (F1, F2; #161) | SO5 | Dinh et al. 2023; Asare et al. 2023; Dente et al. 2026 | context code steers agents; constraint load lowers success | floor probe done (#161, open PR); F1/F2 not run |
| 1.9 | LLM-as-judge reliability | SO3 | Zheng et al. 2023; Wang P. et al. 2023; Panickssery et al. 2024; Wang R. et al. 2025 | position, verbosity and self-preference biases must be tested | swap κ = 0.766; same vendor |
| 1.10 | MCP agent-loop evaluation (Study 2; #142, #156, #157) | SO3, SO5 | Yang et al. 2024 (SWE-agent); Blyth et al. 2025; Huang et al. 2023 | the interface itself is a treatment; self-correction without an external signal is weak | replay harness and proof run only |
| 1.11 | External human-written set (#133, #167) | SO2, SO4 | Lenarduzzi et al. 2019 (TD dataset); Le et al. 2018; Baltes & Ralph 2022 | sampling frame and selection rule must be stated before the run | 15 repos; 283/283 correct (#167, open PR) |

### 1.1 Developer-fix mining

**Precedents.**
- Kim, S., Ernst, M. D. "Which warnings should I fix first?". *ESEC/FSE 2007*. https://doi.org/10.1145/1287624.1287633 [V-DOI]
  Uses the project's own history (warnings removed by fix changes) as the oracle for warning importance.
- Liu, K. et al. "Mining Fix Patterns for FindBugs Violations". *IEEE TSE* 47, 2021. https://doi.org/10.1109/tse.2018.2884955 [V-DOI]
  Mines violations that developers fixed versus ones they left, across many projects, and treats "fixed" as evidence of
  a real problem.
- Śliwerski, J., Zimmermann, T., Zeller, A. "When do changes induce fixes?". *MSR 2005*. https://doi.org/10.1145/1083142.1083147 [V-DOI];
  threat: Rosa, G. et al. "Evaluating SZZ Implementations Through a Developer-Informed Oracle". *ICSE 2021*.
  https://doi.org/10.1109/icse43902.2021.00049 [V-DOI]

**What it implies for our design.**
- *Sample size.* The precedents mine across many projects, not a handful of hand-picked pairs. The first pilot (n = 5,
  four from one repository) was a case description. #168 (open PR, not reviewed) scales it to 36 histories and finds
  only 14 distinct commits that removed a blocking finding. Its pooled rate ratio against unflagged edges is driven by
  one commit; without that commit the ratio is about 1. Read at face value, this is the null the precedents warn
  about: findings are removed at a lower rate than ≥ 50 independent fixes would need, so per-commit credit and
  per-repository analysis (as #168 does) are mandatory. A 95 % Wilson interval at p = 0.5 has a half-width of about
  ±0.13 with 50 pairs and ±0.10 with 100.
- *Controls.* Fix the commit-selection rule before mining: config-change commits in repositories that already enforce
  boundaries, plus a fixed keyword list. Add a **non-fix control**: commits of similar size that are not fixes, to
  check that findings do not disappear through churn alone.
- *Pitfalls.* Fix identification has measurable error (Rosa et al. 2021). Big refactors "fix" findings by deleting
  files. The spec must be pinned per repository *before* mining, or the spec is fitted to the fixes.

### 1.2 Predictive validity on bug-fix churn

**Precedents.**
- Khomh, F. et al. "An exploratory study of the impact of antipatterns on class change- and fault-proneness".
  *Empirical Software Engineering* 17, 2012. https://doi.org/10.1007/s10664-011-9171-y [V-DOI]
- Xiao, L. et al. "Identifying and quantifying architectural debt". *ICSE 2016*. https://doi.org/10.1145/2884781.2884822 [V-DOI];
  Mo, R. et al. "Hotspot Patterns: The Formal Definition and Automatic Detection of Architecture Smells". *WICSA 2015*.
  https://doi.org/10.1109/wicsa.2015.12 [V-DOI]; Mo, R. et al. "Architecture Anti-Patterns: Automatically Detectable
  Violations of Design Principles". *IEEE TSE*, 2021. https://doi.org/10.1109/tse.2019.2910856 [V-DOI]
- Balance and threat: Lenarduzzi, V. et al. "Are SonarQube Rules Inducing Bugs?". *SANER 2020*.
  https://doi.org/10.1109/saner48275.2020.9054821 [V-DOI]; Herzig, K., Just, S., Zeller, A. "It's not a bug, it's a
  feature: How misclassification impacts bug prediction". *ICSE 2013*. https://doi.org/10.1109/icse.2013.6606585 [V-DOI]

**What it implies for our design.**
- *Unit and outcome.* The precedents use files (or file groups) as the unit and bug-fix or change counts in the
  project's history as the outcome. That matches the memo's design: exposure = "file has ≥ 1 blocking finding"; outcome
  = bug-fix commits touching the file in the next 12 months.
- *Controls.* Size (LOC) and prior churn are mandatory covariates; without them any structural metric "predicts" bugs.
  Repository is a random effect. The keyword list and model are fixed before the run.
- *Pitfalls.* Issue misclassification (Herzig et al. 2013) and SZZ noise bias the outcome. SonarQube-rule studies found
  weak or null effects for many rules, so a **null result for single-edge import violations is likely** and must be
  reported as such. The architecture-smell studies found effects for multi-file structures (hotspots, unstable
  interfaces), not for single dependency edges. If our blocking rules are mostly single edges, say so before running.
- *Sample size.* The 14 wild + 15 external repositories give thousands of files but few repositories. Effects must be
  read per repository first and pooled second.

### 1.3 Convergent agreement with established checkers

**Precedents.**
- Arcelli Fontana, F., Braione, P., Zanoni, M. "Automatic detection of bad smells in code: An experimental assessment".
  *Journal of Object Technology* 11(2), 2012. https://doi.org/10.5381/jot.2012.11.2.a5 [V-DOI]
- Paiva, T. et al. "On the evaluation of code smells and detection tools". *JSERD*, 2017.
  https://doi.org/10.1186/s40411-017-0041-1 [V-DOI]
- Campbell, D. T., Fiske, D. W. "Convergent and discriminant validation by the multitrait-multimethod matrix".
  *Psychological Bulletin*, 1959. https://doi.org/10.1037/h0046016 (verified in the validity memo)

**What it implies for our design.**
- Detector studies report **low inter-tool agreement as a finding**, not as a failure. Our high agreement on
  import-direction rules is expected, because all the tools read the same import graph. It shows the graph is right, not
  that a violation matters.
- *Control.* Use rules **written by each repository's own maintainers** (existing `.dependency-cruiser.*`,
  `eslint-plugin-boundaries` or ArchUnit configs). This removes the "the author translated the rules" attack.
- *Layout.* Rows = rule family (direction, cycles, purity, member facts); columns = tool. Fill the cells where a tool
  cannot express a rule with "n/a", so the table shows discriminant as well as convergent cells.

### 1.4 Mutation analysis of the rules

**Precedents.**
- Groce, A. et al. "Evaluating and Improving Static Analysis Tools Via Differential Mutation Analysis". *IEEE QRS 2021*.
  https://doi.org/10.1109/qrs54544.2021.00032 [V-DOI]
- Ami, A. S. et al. "Systematic Mutation-Based Evaluation of the Soundness of Security-Focused Android Static Analysis
  Techniques". *ACM TOPS*, 2021. https://doi.org/10.1145/3439802 [V-DOI]
- Just, R. et al. "Are mutants a valid substitute for real faults in software testing?". *FSE 2014*.
  https://doi.org/10.1145/2635868.2635929 [V-DOI]

**What it implies for our design.**
- Mutation-based evaluation of a static analyser is a published method (Ami et al.; Groce et al.). Seeding
  **architecture** violations to evaluate an **architecture** checker has no peer-reviewed precedent that we found, so
  the thesis should say the method is *transferred*.
- *Controls.* Every mutant needs a near-miss twin that must not fire (we have twins: 2/42 fired). Mutation operators
  are fixed and hashed before the run (the hold-out does this).
- *Pitfalls.* Just et al. show that the mutant–real-fault link holds for test suites under conditions. Nobody has shown
  it for architecture violations, so seeded recall says nothing directly about recall on real violations. That is why
  1.1 and 1.11 matter. Operators written by the rule designer measure agreement with the designer (circularity).

### 1.5 Metamorphic testing of the analyser

**Precedents.**
- Chen, T. Y. et al. "Metamorphic Testing: A Review of Challenges and Opportunities". *ACM Computing Surveys* 51(1),
  2019 (online 2018). https://doi.org/10.1145/3143561 [V-DOI]; Segura, S. et al. "A Survey on Metamorphic Testing".
  *IEEE TSE*, 2016. https://doi.org/10.1109/tse.2016.2532875 [V-DOI]
- Zhang, H. et al. "Statfier: Automated Testing of Static Analyzers via Semantic-Preserving Program Transformations".
  *ESEC/FSE 2023*. https://doi.org/10.1145/3611643.3616272 [V-DOI]
- Klinger, C., Christakis, M., Wüstholz, V. "Differentially Testing Soundness and Precision of Program Analyzers".
  arXiv:1812.05033, 2018 [V-arXiv] *(venue not checked against a record)*; also Kapus, T., Cadar, C. "Automatic testing
  of symbolic execution engines via program generation and differential testing". *ASE 2017*.
  https://doi.org/10.1109/ase.2017.8115669 [V-DOI]

**What it implies for our design.**
- Statfier is the direct analogue: apply semantics-preserving transformations to code and require the analyser's
  warnings to stay the same. Our relations are architectural: renaming a folder together with its spec entry, moving a
  file within its layer, adding a re-export barrel, reordering imports or declarations, or adding an unrelated file must
  leave the blocking set unchanged (up to the renaming). Adding a forbidden import must add exactly one finding.
- *Controls.* Each relation is reported separately with its violation count; a relation that is only "usually"
  semantics-preserving (for example barrels, which caused ADR-V13-01) is reported apart.
- *Pitfalls.* The oracle is only as good as the relation. Relations derived from the tool's own definitions share its
  construct, so metamorphic testing is **reliability and robustness evidence, not validity evidence**. Say so.
- The in-process interpreter vs Neo4j parity (65,254 statements, 0 content differences) is the differential-testing
  side of the same idea (Hua et al. 2023, https://doi.org/10.1145/3597926.3598046; Kamm et al. 2023,
  https://doi.org/10.1145/3597926.3598044 [V-DOI]).

### 1.6 Cross-vendor LLM panel

**Precedents.**
- Verga, P. et al. "Replacing Judges with Juries: Evaluating LLM Generations with a Panel of Diverse Models".
  arXiv:2404.18796, 2024 [V-arXiv].
- Ahmed, T. et al. "Can LLMs Replace Manual Annotation of Software Engineering Artifacts?". *MSR 2025*.
  https://doi.org/10.1109/msr66628.2025.00086 [V-DOI]
- Wang, R. et al. "Can LLMs Replace Human Evaluators? An Empirical Study of LLM-as-a-Judge in Software Engineering".
  *Proc. ACM Softw. Eng.* 2 (ISSTA), 2025. https://doi.org/10.1145/3728963 [V-DOI]

**What it implies for our design.**
- Ahmed et al. use **inter-model agreement as a signal of when model labels can stand in for humans**, and calibrate
  against human labels on a subset. Without that subset, a panel shows reliability across models, not validity.
- *Pitfalls.* κ is undefined or zero when one class is empty; our P4 judge passed all 36 items, so κ = 0 says nothing
  about discrimination. Item pools need ≥ 30 % expected "no" (decoys, twins, known fails). Models of different vendors
  can still share blind spots.
- *Sample size.* For κ with a useful interval (half-width ≈ 0.15) at moderate prevalence, plan 80–100 items, as in the
  memo's recommendation.

### 1.7 Selective prediction for the judge

**Precedents.**
- Geifman, Y., El-Yaniv, R. "Selective Classification for Deep Neural Networks". arXiv:1705.08500, 2017 [V-arXiv]
  *(venue not checked against a record)*: fix a target risk, report the coverage that achieves it.
- Jung, J., Brahman, F., Choi, Y. "Trust or Escalate: LLM Judges with Provable Guarantees for Human Agreement".
  arXiv:2407.18370, 2024 [V-arXiv] *(venue not checked against a record)*: the judge abstains when its confidence is
  low, with a guaranteed agreement level on the items it keeps.
- Spiess, C. et al. "Calibration and Correctness of Language Models for Code". arXiv:2402.02047, 2024 [V-arXiv]
  *(venue not checked against a record)*; Wang, X. et al. "Self-Consistency Improves Chain of Thought Reasoning in
  Language Models". arXiv:2203.11171, 2022 [V-arXiv] (agreement across samples as a confidence signal).

**What it implies for our design.**
- The method is sound only when the risk target and the confidence signal are **fixed before computing**, as N1 did.
  #165 reports (open PR) that 3-run unanimity does not meet the pre-stated rule. That is a valid negative result: say
  "3-sample unanimity is not an informative confidence signal for this judge at this n" and **do not** look for another
  signal on the same data. That would be a garden-of-forking-paths search.
- *Pitfalls.* With 3 samples per item, unanimity is a coarse signal (only two levels). Code-model calibration work
  (Spiess et al.) finds that raw model confidence is often poorly calibrated. Coverage must be reported beside accuracy,
  or abstention hides failures.
- *Sample size.* Wilson bounds on the unanimous subset need roughly ≥ 40 items in it before a lower bound of 0.80 is
  reachable at observed accuracy 0.92.

### 1.8 Floor and precedent probes

**Precedents.**
- Dinh, T. et al. "Large Language Models of Code Fail at Completing Code with Potential Bugs". arXiv:2306.03438, 2023
  [V-arXiv] *(venue not checked against a record)*: buggy context makes code models produce buggy completions. This is
  the closest published mechanism for **precedent propagation** (F2).
- Asare, O., Nagappan, M., Asokan, N. "Is GitHub's Copilot as bad as humans at introducing vulnerabilities in code?".
  *Empirical Software Engineering*, 2023. https://doi.org/10.1007/s10664-023-10380-1 [V-DOI]: replays real
  vulnerability-introducing contexts.
- Dente, F., Satriani, D., Papotti, P. "Constraint Decay: The Fragility of LLM Agents in Backend Code Generation".
  arXiv:2605.06445, 2026 [V-arXiv] *(venue not checked against a record)*. The abstract reports 80 greenfield and 20
  feature tasks over 8 web frameworks, with success falling as structural constraints accumulate.

**What it implies for our design.**
- The floor is consistent with the literature: greenfield prompts with a style sentence give agents little reason to
  break a layer rule, while **existing code** strongly steers what they write (Dinh et al.; Asare et al.). F2 (planted
  precedent vs clean control, same step text) is therefore the design most likely to lift the floor. It is also a
  realistic erosion mechanism, not an artificial "harder task".
- *Controls.* Matched pairs: same step text, planted vs clean tree, all code written before any scoring (as in #161).
  The planted shortcut must be a single, known blocking identity so that "copying" is measurable.
- *Pitfalls.* Probes with one agent session and n ≈ 16 steps are feasibility evidence; never report them as effect
  sizes. Probe tasks must not leak into Study 2 (rule 2 of the backlog).

### 1.9 LLM-as-judge reliability

**Precedents.**
- Zheng, L. et al. "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena". *NeurIPS 2023 (Datasets and Benchmarks)*.
  https://doi.org/10.52202/075280-2020 [V-DOI]
- Wang, P. et al. "Large Language Models are not Fair Evaluators". arXiv:2305.17926, 2023 [V-arXiv] (position bias);
  Panickssery, A., Bowman, S. R., Feng, S. "LLM Evaluators Recognize and Favor Their Own Generations".
  arXiv:2404.13076, 2024 [V-arXiv] (self-preference). Venues for both not checked against a record.
- Wang, R. et al. 2025 (above); He, J. et al. "From Code to Courtroom: LLMs as the New Software Judges".
  arXiv:2503.02246, 2025 [V-arXiv] (survey and agenda for LLM judges in SE).

**What it implies for our design.**
- The named biases are position, verbosity and self-preference. Self-preference is the relevant one for us: a Claude
  judge scoring code written by Claude agents. E1 already found an apparent "self-preference" that could not be
  separated from Haiku-project quality. Report it as confounded, as the roadmap says.
- *Controls.* The registered model-swap check (Opus ↔ Sonnet, κ = 0.766) is same-vendor. A different-vendor judge on
  the same units is the minimum control for self-preference. #153 is the harness; it has not run with real models.
- *Pitfalls.* Run-to-run variance must be reported (3 runs per item exist). The judge's weight in the verdict
  (inert at 8 %; decisive at 2/7 with any-fail aggregation) changes what reliability means. State the configuration.

### 1.10 MCP agent-loop evaluation

**Precedents.**
- Yang, J. et al. "SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering". arXiv:2405.15793, 2024
  [V-arXiv] *(venue not checked against a record)*: the design of the tool interface itself changes agent success.
- Blyth, S., Licorish, S. A., Treude, C., Wagner, M. "Static Analysis as a Feedback Loop: Enhancing LLM-Generated Code
  Beyond Correctness". arXiv:2508.14419, 2025 [V-arXiv] *(venue not checked against a record)*. The abstract reports
  that analyser findings (Bandit, Pylint) fed back over iterations sharply reduce the issues found.
- Huang, J. et al. "Large Language Models Cannot Self-Correct Reasoning Yet". arXiv:2310.01798, 2023 [V-arXiv]: without
  an external signal, self-correction does not reliably help. Also Chen, X. et al. "Teaching Large Language Models to
  Self-Debug", arXiv:2304.05128 [V-arXiv]; Ravi, R. et al. "LLMLOOP", arXiv:2603.23613 [V-arXiv] (comment field: ICSME
  2025, not checked against a record).

**What it implies for our design.**
- The three arms (no tool / context-only tool / DaedalusArch MCP) follow SWE-agent's logic: the interface is the
  treatment. A **context-only arm is the necessary control**, so that the effect of *enforcement* is separated from the
  effect of *more information*.
- Blyth et al. measure the same tool that gives the feedback. That is the circularity Study 2 must avoid: the outcome
  measure must be **frozen and separate** from the in-loop signal (D16 "independent measures per snapshot"), and gaming
  guards are needed (deleting features to pass, D12 acceptance checks).
- *Pitfalls.* Huang et al. show that the gain comes from the external signal, not from extra turns, so match turn and
  token budgets across arms. Agent nondeterminism needs repeated runs per cell. The floor effect (1.8) can make every
  arm look perfect; that is why F1/F2 matter before the single Study 2 run.

### 1.11 External human-written set

**Precedents.**
- Lenarduzzi, V., Saarimäki, N., Taibi, D. "The Technical Debt Dataset". *PROMISE 2019*.
  https://doi.org/10.1145/3345629.3345630 [V-DOI]: a public, pinned multi-project dataset for tool evaluation.
- Le, D. M. et al. "An Empirical Study of Architectural Decay in Open-Source Software". *ICSA 2018*.
  https://doi.org/10.1109/icsa.2018.00027 [V-DOI]; Behnamghader, P. et al. "A large-scale study of architectural
  evolution in open-source software systems". *Empirical Software Engineering*, 2017.
  https://doi.org/10.1007/s10664-016-9466-0 [V-DOI]
- Baltes, S., Ralph, P. "Sampling in software engineering research: a critical review and guidelines". *Empirical
  Software Engineering*, 2022. https://doi.org/10.1007/s10664-021-10072-8 [V-DOI]

**What it implies for our design.**
- *Sampling.* State the sampling frame (TypeScript backends that claim a style, pinned before 2023) and the selection
  rule as purposive, per Baltes & Ralph. Do not call the 15 repositories representative.
- *Controls.* The spec for each repository is a degree of freedom: K2 (second blind spec author) measures it. Known-
  groups (K1: showcase vs application) and size-proxy checks are the discriminant side.
- *What #167 shows (open PR).* 283/283 blocking findings are *correct* statements about human code. Once #167 is reviewed, this
  would be the project's first correctness figure on code not written by Claude. It does not show the findings *matter*; 1.1, 1.2 and M1 (erosion trajectories,
  following Le et al. and Behnamghader et al.) are the routes to that without raters.

---

## 2. Gap analysis: open problems in the literature

### 2.1 Open problems this thesis addresses

| Open problem named in the literature | Where it is named | What DaedalusArch contributes | Strength of our answer |
|---|---|---|---|
| Architecture erosion is common and costly, and conformance checking is rarely used in practice because it is costly to set up and keep current | de Silva & Balasubramaniam 2012; Ali et al. 2018; Li et al. 2021, 2022 | a ~30-line YAML spec compiled to executable fitness functions; inferred specs (`--from-inferred`, open PR #150) | moderate: authoring cost is reported by line count, not measured with users |
| Conformance checkers express mostly dependency rules (reflexion models, DCL) | Murphy et al. 1995/2001; Knodel & Popescu 2007; Passos et al. 2010; Terra & Valente 2009 | style libraries (clean, layered, hexagonal, DDD, NestJS) with member facts, DI edges and metric rules beyond import direction | moderate: content validity traced to sources, 8 rules unsourced |
| LLM-generated code is judged on functional correctness (pass@k), not on architecture | Slater 2025 (preprint); Schmid et al. 2025 (SLR) | per-rule blocking findings on agent output across spec levels (E1, Study 2) | moderate: E1 done; the floor limits what it can show |
| Coding agents need external, checkable feedback; self-critique alone is weak | Huang et al. 2023; Blyth et al. 2025; Yang et al. 2024 | architecture conformance as an MCP tool in the agent loop | weak today: proof runs only (#156); Study 2 not run |
| LLM judges need chance-corrected agreement, bias checks and human calibration in SE | Zheng et al. 2023; Wang R. et al. 2025; Ahmed et al. 2025 | judge with registered robustness and panel checks; a symbolic layer that does not depend on the judge for blocking verdicts | weak for the judge (0.76 < 0.80); strong for "the symbolic verdict does not need the judge" |
| How the format of an architecture spec given to an agent changes the outcome | Canedo 2026 (preprint); Feng et al. 2026 (preprint) | spec levels (none / prose / AaC) in E1 and Study 2 | moderate: E1 shows precise AaC beats vague prose among comparable projects (Cliff's δ 0.52) |
| Spec-driven development evidence comes mostly from tool vendors | Agarwal et al. 2026 (preprint) | a spec that is *executable* as a gate, not only prose guidance | descriptive only |

### 2.2 Open problems this thesis does NOT address (state them as limits)

1. **Whether conformance findings predict maintenance cost.** The architecture-debt literature (Xiao et al. 2016;
   Verdecchia et al. 2020; Besker et al. 2018) links debt to cost. We have no cost or effort data. 1.2 is a proxy at best.
2. **Practitioner adoption and trust.** Erosion studies ask practitioners (Li et al. 2021). The thesis has no human
   participants by design (compliance register X-1).
3. **A benchmark of real, labelled architecture violations.** We found none for TypeScript in a non-systematic search (validity memo §2.3). We do not
   build one; we use seeds, fixes and correctness checks instead.
4. **Generalisation across languages and paradigms.** The APG is TypeScript-only. Code property graphs (Yamaguchi et al.
   2014) show multi-language graphs are feasible, but we do not test that.
5. **Long-horizon erosion under agent development.** Studies of agent PRs in the wild (Watanabe et al. 2025; Li H. et al.
   2025 AIDev; Kraishan 2026; Ogenrwot & Businge 2026, all preprints) measure acceptance, size and churn, not
   architectural conformance over months. Study 2 is a few steps per task, not a longitudinal study.
6. **Causal claims about developer productivity or quality.** Field and RCT studies (Peng et al. 2023; Becker et al.
   2025, preprints) measure productivity; we do not.
7. **Formal semantics of the spec language.** The spec → Cypher compilation is tested (differential parity, unit tests),
   not proven correct. Cypher has a published semantics basis (Francis et al. 2018), but we do not use it formally.

---

## 3. Scope separation

### 3a. Master's thesis: in scope and achievable now (ranked)

Ranked by (contribution to an objective sentence) × (feasibility before the freeze) ÷ (risk to the single Study 2 run).
Nothing here needs a human rater; item 9 is the one optional human piece.

| Rank | Work | Objective | Why this rank | Precedent (§1) | Claim it allows |
|---|---|---|---|---|---|
| 1 | **Run the sealed hold-out once**, at the freeze, with the pre-specified analysis | SO4 | only non-development estimate of detection; pre-specified | 1.4 | "seeded recall/precision on unseen cases is X [CI]" |
| 2 | **Consolidate the human-code correctness and convergent results** (#167, #166) after review; add maintainer-written configs | SO4, SO2 | already computed (open PRs); first evidence on non-Claude code | 1.3, 1.11 | "findings on human code are correct statements; agreement with independent tools where constructs overlap" |
| 3 | **Review and report developer-fix mining** (#168, open PR: 36 histories, no robust signal) as a pre-specified negative or rule-specific (cycles) result; do not re-mine to find a signal | SO4 | the only rater-free route to "findings developers act on"; a null is still evidence | 1.1 | "developers do not remove blocking findings faster than unflagged edges, except possibly cycles" (if #168 survives review) |
| 4 | **F2 precedent probe, then F1** (layout sentence), before Study 2 design is locked | SO5 | the floor is the biggest threat to SO5; brownfield seeding is the most promising lever | 1.8 | design justification only, never an effect size |
| 5 | **Predictive churn study** with size and prior-churn controls, null result reported | SO4 | widely accepted, but likely null for single-edge rules | 1.2 | "blocking files do / do not attract more bug fixes after controlling for size" |
| 6 | **SO3 framing**: report 0.76 [0.55, 0.89] against 0.80 as *not met*; report the symbolic–neural complementarity matrix (N2); report #165 as a negative result | SO3 | honest reporting beats a post-hoc rescue; the neuro-symbolic claim can rest on complementarity | 1.7, 1.9 | "the judge adds catches the rules cannot express; on its own it is below target" |
| 7 | **Metamorphic relations** (5–6 relations, each reported separately) | SO4 (reliability) | cheap and deterministic; reviewers expect robustness | 1.5 | "the verdict is invariant under N semantics-preserving transformations" |
| 8 | **Erosion trajectories in human projects** (M1) and **K2 spec-author reliability** | SO2, SO5 | shows erosion is real outside agents and bounds the spec-author degree of freedom | 1.11 | "blocking counts grow over history in k of 6 repositories"; "file-to-layer κ between two spec authors" |
| 9 | *(optional, the only human piece)* 2 paid architects × 80 items | SO3, SO4 | the only way to say "meaningful", not just "correct" | 1.6 | "panel labels calibrated against architects" |
| 10 | **Study 2, exactly once**, with the context-only control arm, frozen outcome, gaming guards, matched budgets | SO3, SO5 | the thesis's in-loop claim; irreversible, so last | 1.10 | whatever the pre-specified analysis says, null included |

**Out of master's scope** (each one goes to 3b or to the limitations): practitioner studies, multi-language graphs, a
public violation benchmark, causal claims about agents beyond Study 2's own design, longitudinal agent development,
formal proofs of the compiler.

**Wording guard.** The thesis may not cite any item of §3b as a contribution, may not use "will show" about it, and
may not count any of it towards SO1–SO5.

### 3b. Doctoral-level research agenda (SEPARATE; not a master's claim)

> Everything in this subsection is a proposal for work **after** the master's thesis. None of it has been started as
> research, none of it is evidence for SO1–SO5, and none of it should appear in the master's results or conclusions
> except as one "Future work" paragraph (§4.2).

**RQ-D1. Can one architecture property graph and one fitness-function language serve several languages without losing
detection power?**
- *Why doctoral-scale:* it needs extractors for 2–3 languages (e.g. TypeScript, Java, Python), a language-neutral schema
  and a cross-language validity study. That is years of engineering plus evaluation.
- *Method:* define a core APG schema with per-language extensions; port the style libraries; differential evaluation
  against language-native checkers (ArchUnit for Java, import-linter-type tools for Python) on matched projects.
- *Data:* pinned open-source projects per language with declared or enforced architectures.
- *Related open problems:* multi-language code graphs (Yamaguchi et al. 2014); generality of conformance checking
  (Knodel & Popescu 2007; Passos et al. 2010).

**RQ-D2. Can semantic architecture rules (responsibilities, aggregate invariants, "business logic in the domain") be
made checkable through learned or ontology-grounded models with measured validity?**
- *Why doctoral-scale:* it needs a labelled corpus of semantic violations that does not exist, an ontology of style
  concepts, and calibration of a neural component against experts.
- *Method:* ontology of style concepts (ports, adapters, aggregates) linked to APG nodes; neural classifiers or LLM
  judges constrained by that ontology; selective prediction with guaranteed risk (Jung et al. 2024); comparison to the
  symbolic rules.
- *Data:* an expert-labelled corpus (≥ 2 architects, κ reported); the cheap-proxy and anti-pattern operators as seeds.
- *Related open problems:* LLMs in architecture are mostly simple prompting (Schmid et al. 2025); LLM-judge reliability
  in SE (Wang R. et al. 2025; He et al. 2025).

**RQ-D3. What is the causal effect of architectural feedback, delivered in the agent loop, on the architecture agents
produce, and through which mechanism (information, enforcement, or repair)?**
- *Why doctoral-scale:* it needs a factorial design across vendors, interfaces and task types, many repeated runs, and
  mediation analysis. That is beyond a single pre-registered study.
- *Method:* randomised arms (no tool / context only / advisory feedback / blocking feedback / feedback with fix hints),
  matched budgets, several vendors, pre-registered mediation (does the effect go through fewer violations introduced or
  through more repairs?).
- *Data:* brownfield tasks with planted precedents (to escape the floor), agent traces, frozen outcome measures.
- *Related open problems:* agent–computer interfaces (Yang et al. 2024); feedback loops from analysers (Blyth et al.
  2025); self-correction limits (Huang et al. 2023); spec format × model capability (Canedo 2026, preprint).

**RQ-D4. How does architecture erode over months of agent-driven development in real repositories, compared with
human-driven development?**
- *Why doctoral-scale:* longitudinal mining over many repositories, provenance attribution of agent commits, and
  causal-inference controls for project type.
- *Method:* repositories with agent-provenance labels (AIDev-type datasets); pinned specs per repository; erosion
  trajectories per commit window; matched human-only repositories; difference-in-differences around agent adoption.
- *Data:* agent-PR datasets (Li H. et al. 2025, preprint), repository histories, inferred or declared specs.
- *Related open problems:* erosion symptoms and causes (Li et al. 2021, 2022); architectural decay (Le et al. 2018;
  Behnamghader et al. 2017); post-merge quality of agent code (Kraishan 2026, preprint).

**RQ-D5. Can the compilation from an architecture spec to fitness functions be given a formal semantics and proven
sound and complete with respect to a model of the style?**
- *Why doctoral-scale:* a formal model of styles, a formal semantics of the spec language, and proofs (or certified
  compilation) over a fragment of Cypher.
- *Method:* define the style as constraints over a graph schema; define the spec language's denotation; prove that
  compiled queries return exactly the violating subgraphs; validate empirically by metamorphic and differential testing.
- *Data:* the existing template library; a mechanised proof assistant development.
- *Related open problems:* reflexion models as a formal basis (Murphy et al. 2001); Cypher semantics (Francis et al.
  2018); dependency constraint languages (Terra & Valente 2009).

**RQ-D6. How should humans and agents share governance of architecture: who writes, changes and waives rules, and
with what effect on trust, workload and erosion?**
- *Why doctoral-scale:* it needs field studies with teams, mixed methods and ethics approval.
- *Method:* multi-site case studies or a field experiment in which teams adopt the gate; interviews; waiver and
  rule-change logs; measures of trust and workload.
- *Data:* industrial or open-source teams using coding agents; spec-change histories.
- *Related open problems:* how developers interact with code models (Barke et al. 2023); spec-driven development as
  practised (Agarwal et al. 2026, preprint); architectural debt as a socio-technical decision (Verdecchia et al. 2020;
  Besker et al. 2018); productivity effects (Becker et al. 2025, preprint).

**RQ-D7. Can a public benchmark of real, developer-confirmed architecture violations be built, and does mutant recall
predict recall on it?**
- *Why doctoral-scale:* it needs large-scale mining, adjudication by several experts and a maintained release. It also
  answers the open "are architectural mutants valid?" question that Just et al. 2014 answered for tests.
- *Method:* mine fixes in boundary-enforcing repositories (1.1) across languages; expert adjudication; correlate
  per-operator mutant recall with per-category real recall across several tools.
- *Data:* hundreds of repositories; ≥ 2 expert raters per item.
- *Related open problems:* mutant validity (Just et al. 2014); detection-tool disagreement (Paiva et al. 2017); fix
  mining (Liu et al. 2021); SZZ reliability (Rosa et al. 2021).

---

## 4. Thesis wording (verified citations only)

### 4.1 Related work (positioning paragraph)

> Architecture erosion, the growing divergence between the intended and the implemented architecture, is a long-standing
> problem (de Silva and Balasubramaniam, 2012; Li et al., 2022), and practitioners report that conformance checking is
> seldom applied because it is costly to set up and keep current (Ali et al., 2018; Li et al., 2021). Static conformance
> checking has a mature lineage, from reflexion models (Murphy et al., 1995, 2001) to dependency-constraint languages
> (Terra and Valente, 2009) and comparative overviews (Knodel and Popescu, 2007; Passos et al., 2010). A parallel line
> detects architecture smells and links them to change- and fault-proneness (Mo et al., 2015; Xiao et al., 2016; Mo et
> al., 2021). Large language models now write much of this code. Studies of LLM-assisted architecture are still mostly
> exploratory and rely on simple prompting (Schmid et al., 2025), while agent benchmarks score functional correctness
> (Jimenez et al., 2023) and give little attention to structure. Two findings motivate putting a checker *in* the agent
> loop: the design of the agent's tool interface changes what it achieves (Yang et al., 2024), and analyser feedback
> can improve generated code where self-critique alone does not (Blyth et al., 2025; Huang et al., 2023). For the
> neural part, we follow the SE literature on LLM judges, which accepts them only with chance-corrected agreement, bias
> checks and calibration (Zheng et al., 2023; Wang R. et al., 2025; Ahmed et al., 2025). DaedalusArch differs from prior
> conformance checkers in compiling a short, style-level specification into graph queries that both gate code and answer
> an agent's questions during generation. It differs from LLM-review approaches in that every blocking verdict is a
> deterministic, checkable graph fact.

*Note.* Jimenez et al. 2023, Yang et al. 2024, Blyth et al. 2025, Huang et al. 2023 and Schmid et al. 2025 are cited from
their arXiv records. Before submission, confirm each published venue against a record, or cite them as arXiv preprints.

### 4.2 Future work (chapter paragraph)

> This thesis evaluated the instrument on TypeScript backends, on seeded and mined violations, and in a single
> pre-specified agent-loop study. Several questions it raises are beyond its scope. First, the architecture property
> graph is single-language; code property graphs show that multi-language program graphs are feasible (Yamaguchi et al.,
> 2014), and porting the fitness-function language would test its generality. Second, the semantic rules that resist
> structural analysis were handled by an LLM judge below its target; ontology-grounded rules, or judges that abstain
> with guaranteed agreement (Jung et al., 2024), could make them checkable with measured validity. Third, the causal
> effect of architectural feedback on coding agents, and its mechanism, calls for factorial designs across vendors and
> interfaces (Yang et al., 2024), ideally on brownfield tasks, where existing code is known to steer generation (Dinh et
> al., 2023). Fourth, erosion under months of agent-driven development can now be studied with agent-provenance
> datasets, extending studies of architectural decay (Le et al., 2018; Behnamghader et al., 2017). Fifth, we found no
> public benchmark of real, developer-confirmed architecture violations for TypeScript (our search was not
> systematic); building one would also test whether seeded
> architectural mutants stand in for real violations, as Just et al. (2014) showed for test suites. Finally, the
> compilation from specification to fitness functions was tested, not proven; a formal semantics grounded in reflexion
> models (Murphy et al., 2001) and Cypher (Francis et al., 2018), together with field studies of how teams and agents
> share architectural governance, would turn the instrument into a theory of architectural control for agent-written
> software.

---

## 5. References

### 5.1 Verified against Crossref (DOI) [V-DOI]

- Ahmed, T. et al. Can LLMs Replace Manual Annotation of Software Engineering Artifacts? MSR 2025. https://doi.org/10.1109/msr66628.2025.00086
- Ali, N. et al. Architecture consistency: State of the practice, challenges and requirements. EMSE 2018. https://doi.org/10.1007/s10664-017-9515-3
- Ami, A. S. et al. Systematic Mutation-Based Evaluation of the Soundness of Security-Focused Android Static Analysis Techniques. ACM TOPS 2021. https://doi.org/10.1145/3439802
- Arcelli Fontana, F., Braione, P., Zanoni, M. Automatic detection of bad smells in code: An experimental assessment. JOT 2012. https://doi.org/10.5381/jot.2012.11.2.a5
- Arcelli Fontana, F. et al. Arcan: A Tool for Architectural Smells Detection. ICSA Workshops 2017. https://doi.org/10.1109/icsaw.2017.16
- Asare, O., Nagappan, M., Asokan, N. Is GitHub's Copilot as bad as humans at introducing vulnerabilities in code? EMSE 2023. https://doi.org/10.1007/s10664-023-10380-1
- Azadi, U., Arcelli Fontana, F., Taibi, D. Architectural Smells Detected by Tools: a Catalogue Proposal. TechDebt 2019. https://doi.org/10.1109/techdebt.2019.00027
- Baltes, S., Ralph, P. Sampling in software engineering research: a critical review and guidelines. EMSE 2022. https://doi.org/10.1007/s10664-021-10072-8
- Barke, S., James, M. B., Polikarpova, N. Grounded Copilot: How Programmers Interact with Code-Generating Models. PACMPL (OOPSLA) 2023. https://doi.org/10.1145/3586030
- Behnamghader, P. et al. A large-scale study of architectural evolution in open-source software systems. EMSE 2017. https://doi.org/10.1007/s10664-016-9466-0
- Besker, T., Martini, A., Bosch, J. Managing architectural technical debt: A unified model and systematic literature review. JSS 2018. https://doi.org/10.1016/j.jss.2017.09.025
- Chen, T. Y. et al. Metamorphic Testing: A Review of Challenges and Opportunities. ACM CSUR 2019 (online 2018). https://doi.org/10.1145/3143561
- de Silva, L., Balasubramaniam, D. Controlling software architecture erosion: A survey. JSS 2012. https://doi.org/10.1016/j.jss.2011.07.036
- Francis, N. et al. Cypher: An Evolving Query Language for Property Graphs. SIGMOD 2018. https://doi.org/10.1145/3183713.3190657
- Groce, A. et al. Evaluating and Improving Static Analysis Tools Via Differential Mutation Analysis. QRS 2021. https://doi.org/10.1109/qrs54544.2021.00032
- Herzig, K., Just, S., Zeller, A. It's not a bug, it's a feature: How misclassification impacts bug prediction. ICSE 2013. https://doi.org/10.1109/icse.2013.6606585
- Hua, Z. et al. GDsmith: Detecting Bugs in Cypher Graph Database Engines. ISSTA 2023. https://doi.org/10.1145/3597926.3598046
- Just, R. et al. Are mutants a valid substitute for real faults in software testing? FSE 2014. https://doi.org/10.1145/2635868.2635929
- Kamm, M. et al. Testing Graph Database Engines via Query Partitioning. ISSTA 2023. https://doi.org/10.1145/3597926.3598044
- Kapus, T., Cadar, C. Automatic testing of symbolic execution engines via program generation and differential testing. ASE 2017. https://doi.org/10.1109/ase.2017.8115669
- Khomh, F. et al. An exploratory study of the impact of antipatterns on class change- and fault-proneness. EMSE 2012. https://doi.org/10.1007/s10664-011-9171-y
- Kim, S., Ernst, M. D. Which warnings should I fix first? ESEC/FSE 2007. https://doi.org/10.1145/1287624.1287633
- Kitchenham, B., Pfleeger, S. L., Fenton, N. Towards a framework for software measurement validation. IEEE TSE 1995. https://doi.org/10.1109/32.489070
- Knodel, J., Popescu, D. A Comparison of Static Architecture Compliance Checking Approaches. WICSA 2007. https://doi.org/10.1109/wicsa.2007.1
- Le, D. M. et al. An Empirical Study of Architectural Decay in Open-Source Software. ICSA 2018. https://doi.org/10.1109/icsa.2018.00027
- Lenarduzzi, V., Saarimäki, N., Taibi, D. The Technical Debt Dataset. PROMISE 2019. https://doi.org/10.1145/3345629.3345630
- Lenarduzzi, V. et al. Are SonarQube Rules Inducing Bugs? SANER 2020. https://doi.org/10.1109/saner48275.2020.9054821
- Li, R., Liang, P., Soliman, M., Avgeriou, P. Understanding Architecture Erosion: The Practitioners' Perceptive. ICPC 2021. https://doi.org/10.1109/icpc52881.2021.00037
- Li, R., Liang, P., Soliman, M., Avgeriou, P. Understanding software architecture erosion: A systematic mapping study. JSEP 2022. https://doi.org/10.1002/smr.2423
- Liu, K. et al. Mining Fix Patterns for FindBugs Violations. IEEE TSE 2021. https://doi.org/10.1109/tse.2018.2884955
- Mo, R. et al. Hotspot Patterns: The Formal Definition and Automatic Detection of Architecture Smells. WICSA 2015. https://doi.org/10.1109/wicsa.2015.12
- Mo, R. et al. Architecture Anti-Patterns: Automatically Detectable Violations of Design Principles. IEEE TSE 2021. https://doi.org/10.1109/tse.2019.2910856
- Murphy, G. C., Notkin, D., Sullivan, K. Software reflexion models: bridging the gap between source and high-level models. FSE 1995. https://doi.org/10.1145/222124.222136
- Murphy, G. C., Notkin, D., Sullivan, K. J. Software reflexion models: bridging the gap between design and implementation. IEEE TSE 2001. https://doi.org/10.1109/32.917525
- Paiva, T. et al. On the evaluation of code smells and detection tools. JSERD 2017. https://doi.org/10.1186/s40411-017-0041-1
- Palomba, F. et al. On the diffuseness and the impact on maintainability of code smells. EMSE 2018. https://doi.org/10.1007/s10664-017-9535-z
- Passos, L. et al. Static Architecture-Conformance Checking: An Illustrative Overview. IEEE Software 2010. https://doi.org/10.1109/ms.2009.117
- Pearce, H. et al. Asleep at the Keyboard? Assessing the Security of GitHub Copilot's Code Contributions. IEEE S&P 2022. https://doi.org/10.1109/sp46214.2022.9833571
- Rosa, G. et al. Evaluating SZZ Implementations Through a Developer-Informed Oracle. ICSE 2021. https://doi.org/10.1109/icse43902.2021.00049
- Sas, D., Avgeriou, P., Arcelli Fontana, F. Investigating Instability Architectural Smells Evolution: An Exploratory Case Study. ICSME 2019. https://doi.org/10.1109/icsme.2019.00090
- Segura, S. et al. A Survey on Metamorphic Testing. IEEE TSE 2016. https://doi.org/10.1109/tse.2016.2532875
- Śliwerski, J., Zimmermann, T., Zeller, A. When do changes induce fixes? MSR 2005. https://doi.org/10.1145/1083142.1083147
- Terra, R., Valente, M. T. A dependency constraint language to manage object-oriented software architectures. SPE 2009. https://doi.org/10.1002/spe.931
- Verdecchia, R., Kruchten, P., Lago, P. Architectural Technical Debt: A Grounded Theory. ECSA 2020 (LNCS). https://doi.org/10.1007/978-3-030-58923-3_14
- Wang, R. et al. Can LLMs Replace Human Evaluators? An Empirical Study of LLM-as-a-Judge in Software Engineering. PACMSE (ISSTA) 2025. https://doi.org/10.1145/3728963
- Xiao, L. et al. Identifying and quantifying architectural debt. ICSE 2016. https://doi.org/10.1145/2884781.2884822
- Yamaguchi, F. et al. Modeling and Discovering Vulnerabilities with Code Property Graphs. IEEE S&P 2014. https://doi.org/10.1109/sp.2014.44
- Zhang, C. et al. Finding and understanding bugs in software model checkers. ESEC/FSE 2019. https://doi.org/10.1145/3338906.3338932
- Zhang, H. et al. Statfier: Automated Testing of Static Analyzers via Semantic-Preserving Program Transformations. ESEC/FSE 2023. https://doi.org/10.1145/3611643.3616272
- Zheng, L. et al. Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena. NeurIPS 2023 D&B. https://doi.org/10.52202/075280-2020
- Campbell & Fiske 1959, Messick 1995, Kane 2013, Meneely et al. 2012, Ralph & Tempero 2018, Sjøberg & Bergersen 2023: verified in `Docs/v1.3/validity-strategy.md` §7 (PR #147).

### 5.2 Verified against arXiv [V-arXiv] (preprint unless a venue is confirmed)

Venues in brackets were **not** checked against a record; confirm them before citing a venue.

- Agarwal, S. et al. Spec-Driven Development as Prescribed and as Practiced. arXiv:2608.25202 (2026).
- Becker, J. et al. Measuring the Impact of Early-2025 AI on Experienced Open-Source Developer Productivity. arXiv:2507.09089 (2025).
- Blyth, S. et al. Static Analysis as a Feedback Loop: Enhancing LLM-Generated Code Beyond Correctness. arXiv:2508.14419 (2025) [SCAM 2025 per search snippet].
- Canedo, A. Architecture as Capability Equalizer for Coding Agents. arXiv:2608.21747 (2026). **Closest related work**; read in full before the defence.
- Chen, X. et al. Teaching Large Language Models to Self-Debug. arXiv:2304.05128 (2023).
- Dente, F., Satriani, D., Papotti, P. Constraint Decay: The Fragility of LLM Agents in Backend Code Generation. arXiv:2605.06445 (2026) [COLM 2026 per EURECOM listing].
- Dhar, R., Vaidhyanathan, K., Varma, V. Can LLMs Generate Architectural Design Decisions? arXiv:2403.01709 (2024).
- Dinh, T. et al. Large Language Models of Code Fail at Completing Code with Potential Bugs. arXiv:2306.03438 (2023).
- Endres, M. et al. Can Large Language Models Transform Natural Language Intent into Formal Method Postconditions? arXiv:2310.01831 (2023).
- Fan, A. et al. Large Language Models for Software Engineering: Survey and Open Problems. arXiv:2310.03533 (2023).
- Feng, S. et al. LLM-Assisted Repository-Level Generation with Structured Spec-Driven Engineering. arXiv:2605.02455 (2026).
- Geifman, Y., El-Yaniv, R. Selective Classification for Deep Neural Networks. arXiv:1705.08500 (2017).
- He, J. et al. From Code to Courtroom: LLMs as the New Software Judges. arXiv:2503.02246 (2025).
- Hou, X. et al. Model Context Protocol (MCP): Landscape, Security Threats, and Future Research Directions. arXiv:2503.23278 (2025).
- Huang, J. et al. Large Language Models Cannot Self-Correct Reasoning Yet. arXiv:2310.01798 (2023).
- Jimenez, C. E. et al. SWE-bench: Can Language Models Resolve Real-World GitHub Issues? arXiv:2310.06770 (2023).
- Jung, J., Brahman, F., Choi, Y. Trust or Escalate: LLM Judges with Provable Guarantees for Human Agreement. arXiv:2407.18370 (2024).
- Kadavath, S. et al. Language Models (Mostly) Know What They Know. arXiv:2207.05221 (2022).
- Klinger, C., Christakis, M., Wüstholz, V. Differentially Testing Soundness and Precision of Program Analyzers. arXiv:1812.05033 (2018).
- Kraishan, O. Not All Agents Are Equal: Code Quality and Post-Merge Maintenance Across Five Autonomous Coding Agents in the Wild. arXiv:2609.17598 (2026).
- Li, H., Zhang, H., Hassan, A. E. The Rise of AI Teammates in Software Engineering (SE) 3.0 (AIDev dataset). arXiv:2507.15003 (2025).
- Madaan, A. et al. Self-Refine: Iterative Refinement with Self-Feedback. arXiv:2303.17651 (2023).
- Ogenrwot, D., Businge, J. How AI Coding Agents Modify Code: A Large-Scale Study of GitHub Pull Requests. arXiv:2601.17581 (2026).
- Panickssery, A., Bowman, S. R., Feng, S. LLM Evaluators Recognize and Favor Their Own Generations. arXiv:2404.13076 (2024).
- Panda, S. Citation Discipline in Spec-Driven Development. arXiv:2606.30689 (2026).
- Peng, S. et al. The Impact of AI on Developer Productivity: Evidence from GitHub Copilot. arXiv:2302.06590 (2023).
- Ravi, R. et al. LLMLOOP: Improving LLM-Generated Code and Tests through Automated Iterative Feedback Loops. arXiv:2603.23613 (2026) [arXiv comment: accepted at ICSME].
- Sallou, J., Durieux, T., Panichella, A. Breaking the Silence: the Threats of Using LLMs in Software Engineering. arXiv:2312.08055 (2023).
- Schmid, L. et al. Software Architecture Meets LLMs: A Systematic Literature Review. arXiv:2505.16697 (2025).
- Shinn, N. et al. Reflexion: Language Agents with Verbal Reinforcement Learning. arXiv:2303.11366 (2023).
- Slater, T. Quantitative Analysis of Technical Debt and Pattern Violation in Large Language Model Architectures. arXiv:2512.04273 (2025). Pilot, very small n.
- Spiess, C. et al. Calibration and Correctness of Language Models for Code. arXiv:2402.02047 (2024).
- Sun, C. et al. Clover: Closed-Loop Verifiable Code Generation. arXiv:2310.17807 (2023).
- Tufano, M. et al. Grounding AI Agents in Contracts: An Empirical Evaluation of Spec-Driven Test Generation. arXiv:2608.17177 (2026).
- Verga, P. et al. Replacing Judges with Juries. arXiv:2404.18796 (2024).
- Wadhwa, N. et al. Frustrated with Code Quality Issues? LLMs can Help! arXiv:2309.12938 (2023).
- Wagner, S. et al. Towards Evaluation Guidelines for Empirical Studies involving LLMs. arXiv:2411.07668 (2024).
- Wang, P. et al. Large Language Models are not Fair Evaluators. arXiv:2305.17926 (2023).
- Wang, X. et al. Self-Consistency Improves Chain of Thought Reasoning in Language Models. arXiv:2203.11171 (2022).
- Wang, Y. et al. Are "Solved Issues" in SWE-bench Really Solved Correctly? arXiv:2503.15223 (2025).
- Watanabe, M. et al. On the Use of Agentic Coding: An Empirical Study of Pull Requests on GitHub. arXiv:2509.14745 (2025) [TOSEM per search snippet].
- Yang, J. et al. SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering. arXiv:2405.15793 (2024).
- Zhuo, T. Y. ICE-Score: Instructing Large Language Models to Evaluate Code. arXiv:2304.14317 (2023).
- Aleithan, R. et al. SWE-Bench+: Enhanced Coding Benchmark for LLMs. arXiv:2410.06992 (2024).
- Agrawal, L. A. et al. Guiding Language Models of Code with Global Context using Monitors. arXiv:2306.10763 (2023).
- Bouzenia, I. et al. RepairAgent: An Autonomous, LLM-Based Agent for Program Repair. arXiv:2403.17134 (2024).

### 5.3 UNVERIFIED or not used

- A DOI tried for Kapus & Cadar (10.1109/ase.2017.8115671) resolves to a different paper. It was replaced by the
  verified 10.1109/ase.2017.8115669 above.
- "Spec-Driven Development: From Code to Contract in the Age of AI Coding Assistants" (arXiv, Feb 2026): seen only as a
  search mention. **UNVERIFIED**; not cited.
- Ford, N., Parsons, R., Kua, P. *Building Evolutionary Architectures* (O'Reilly, 2017), the source of "fitness
  functions": a book with no DOI checked here. Cite it from the project's existing bibliography only.
- The Model Context Protocol specification and vendor SDD tools (GitHub Spec Kit, Kiro, OpenSpec, AWS AI-DLC): grey
  literature; mention only as artefacts, never as evidence.

---

## 6. What was not done

- No full-text reading. All method notes rest on abstracts or on the validity memo. Sample sizes quoted from 2025–2026
  preprints come from their abstracts.
- No precedent search beyond the topics listed in the task; the lists are not systematic reviews and must not be
  described as such in the thesis.
- No repository numbers were recomputed. Numbers from open PRs (#161, #165, #166, #167) are their titles' or the
  backlog's claims, not reviewed results.
- No Study 2 or hold-out material was read, named or inferred.
