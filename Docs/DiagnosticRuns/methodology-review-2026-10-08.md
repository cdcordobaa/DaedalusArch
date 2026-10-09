> Fable adversarial review at 1185a1f; dispositions in ADR-020

## Adversarial methodology review — v1.2E evaluation (origin/v1.2e @ 1185a1f)

Overall: the registration machinery (hash gate, closed code lists, seeds, exclusion logging) is unusually careful. The weaknesses are in what the registered numbers mean. Ranked by damage to the thesis figures.

### A. Change a registered artefact NOW

A1 CRITICAL — SO4 precision is differential-only; the instrument's precision on real code is not a registered outcome. Evidence: Docs/matching-rule.md:62 (MAT-03 new violations = seeded − baseline), :72 (every predicted collateral key neutral), :74-76 (FP = leftover new violations only); scripts/lib/mutation/collateral.ts:97-151 predicts cycles, metric crossings, test-pairing and project-metric firings and neutralises them; Docs/analysis-plan.md:152 registers precision only on seeded instances. P2 (baseline violations, analysis-plan.md:173) feeds only fp_fn_taxonomy.csv (scripts/llm-label.ts:886); no P2 precision estimate exists. Objection: a one-line import edit almost never makes an unrelated rule fire, so headline precision will be ~1.0 by construction. Fix: register SO4 secondary outcome baseline precision per function and overall = Horvitz–Thompson-weighted share of P2 items labelled TP or unseeded-TP, with the BR-U5b-61 interval rule, reported beside the differential figure wherever precision is quoted.

A2 CRITICAL — P1 label semantics incoherent. scripts/score-golden.ts:807-808 subtracts only unseeded-TP; a P1 item labelled TP (Docs/labeller-prompts/violation.md:57) stays a false positive. The labeller sees a 31-line window (scripts/lib/label-context.ts:273-283) and cannot know whether a construct was deliberately introduced. In SO5 P3 nothing is seeded, yet scripts/aggregate.ts:365 weights unseeded-TP by 1/p and TP by 1 (analysis-plan.md:24-25), so family counts are not a valid HT estimate. Fix: MAT-10 FP-labelled = FP-strict minus {TP, unseeded-TP}; every TP-class label weighted 1/p.

A3 CRITICAL — k = 3 copies of the same operator on the same base treated as independent. scripts/lib/mutation/freeze-gates.ts:227-249; analysis-plan.md:191-194 and scripts/lib/stats.ts:490-502: with < 10 clusters Wilson on instances is primary; scripts/aggregate.ts:198 passes empty clusters for per-function rows so they are always Wilson. Effective N ~ number of (project x operator) cells (~25-40), not 80-120; Wilson anti-conservative by ~sqrt(3). Fix: register the (project, operator) cell as the recall unit for intervals (cell recall = detected/k), project cluster bootstrap co-primary, instance Wilson shown as the 'if independent' bound.

A4 MAJOR — E7 specs are an unregistered lever on N and recall (ADR-019 items 1 and 3; eligibility is a pure function of the domain glob, e.g. MO-S01: 0 on realworld/ghostfolio, 120 on dry-run-test). Fix: registered mechanical directory-to-layer mapping rule for E7 specs written before any feasibility count; one count; no spec edit afterwards; declare remap and E7 specs floor-motivated.

A5 MAJOR — Full-mode SO4 pools judge rows into symbolic precision. experiments/so4-heldout/plan.json mode full; scripts/score-golden.ts:641 adds every non-collateral neural new violation as FP and :912-919 pushes it into overall. Fix: run so4-heldout symbolic-only, or amend MAT-19 so neural new violations go to their own column.

A6 MAJOR — SO5 pairwise CIs degenerate (scripts/aggregate.ts:436-464 resamples 3 replicates within each cell); three pairwise rows per factor with no multiplicity control (:487-502). Fix: pairwise CIs descriptive only; inference on Holm-corrected permutation p and Cliff's delta.

A7 MAJOR — Self-preference statistic not registered. business-rules.md:157 (U4); scripts/llm-label.ts:799-803 stratifies judge-vs-panel by judge model only; P4 pools five dev fixtures with E1 cells (analysis-plan.md:175); primary SO5 outcome ahsCombined (:201). Fix: agreement rows per generator model and per source, E1-only headline; pre-register the directional check (opus advantage on ahsNeuronal vs ahsDeterministic) or make ahsDeterministic co-primary.

A8 MAJOR — Held-out core corpus is not unseen; no core/E7 stratum (Docs/corpus.md:30-33, ADR-015 item 7, ADR-017 item 4; scripts/lib/mutation/types.ts:18 BaseKind has no core vs E7). Fix: E7 the only unseen stratum; pooled E7 row.

### B. Reporting duties

B1 MAJOR — Circularity/coverage: operators are literal negations of templates realised as synthetic constructs (Docs/operator-catalogue.md:41-51), site preconditions select feasible sites, dev declaration gate (freeze-gates.ts:284-302) guarantees key match. Recall measures 'the Cypher matches the author's canonical construct'. ~8 operators cover ~8 of 24 templates; structural in-coverage n ~ 6 before E7; every core project is nestjs. Frame as construct sensitivity, report template coverage, name P2 TP labels as the only naturally occurring positives.
B2 MAJOR — Twin specificity is by construction (preconditions controller-or-entity, threshold-arithmetic; catalogue :14,:20).
B3 MAJOR — The panel is one Gemini model, two runs at temperature 0 with permuted option order (llm-label.ts:4-9): run-vs-run kappa is order sensitivity; uncertain items dropped from agreement pairs (:796,:809) inflate agreement; Wilson on a weighted proportion (:755-758) ignores weight variance. Report agreement with uncertain as a category and label the CI approximate.
B4 MAJOR — SO5 taxonomy not derived: FPAT is a fixed function-to-family map (analysis-plan.md:22-25); judge fails counted from the judge's own verdict at weight 1 (aggregate.ts:369-370). Call it a pre-specified rule-family profile; for a derived taxonomy pre-register an exploratory coding of labeller rationales with the author as a non-blind coder.
B5 MAJOR — full-aac hands the generator the evaluator spec (specs/clean-arch.yaml ~ presets/clean-architecture.yaml; scripts/generator/prompts/full-aac.md says 'evaluated against this specification, reproduced verbatim'). Spec level confounded with test knowledge and prompt length; tier confounded with generation (haiku-4-5 vs *-5-5); single vendor.
B6 MINOR — Audit: 30 items across >=3 kinds x labels (llm-label.ts:609-650) gives 3-10 per stratum; author sees the function id. Report as a sanity check.
B7 MINOR — remapLine (score-golden.ts:250) never called; catalogue DRAFT with sitesPerOperator TBD yet hashed in prereg v1; v1 already fails --check-prereg; judge prereg DRAFT until SEN-01 passes on correct-reference, also a P4 item; ghostfolio repair is post-hoc; a truncated cycle function rejects a whole pair (MAT-25) - report the count; secondary SO5 families exploratory.

Bottom line: without A1–A3, headline SO4 = precision ~1.0 not measuring false alarms on real code, recall CI ~sqrt(3) too narrow, and a P1 label rule moving real violations into FP.
