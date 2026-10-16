# v1.3 Validation Protocol (revision 1, after the Fable review)

**2026-10-14.** This file amends `aidlc-docs/inception/requirements/v1.3-validity-requirements.md`, and wins where they differ. Each section names the review finding it addresses.

## 1. Blind manifests for reference projects (finding 1, BLOCKING)

- The cloud units U-C1 and U-C2 write the reference projects. Their own manifests are kept and labelled **author-manifest**, because their authors could see the rule implementation.
- **Blind re-derivation.** A separate agent receives only:
  - the project source;
  - `Docs/v1.3/style-rule-sources.md`;
  - `Docs/v1.3/rule-tiers.md` (rule names and constructs only).

  It never sees the Cypher, the preset YAML or the author-manifest. It writes a **blind-manifest** with the expected findings and the expected graph.
- **Comparison.**
  - Where the author-manifest and the blind-manifest disagree, the case goes to adjudication.
  - Where the tool disagrees with an agreed manifest entry, the case goes to adjudication.
  - The author (the human) adjudicates every such case and classifies it as a rule defect, a manifest defect, or an ambiguous construct.
- **External check.** One public project per style is added as a sanity check and declared brownfield (for example the DDD specs on `origin/v1.3-hexagonal` under `corpus/specs/*ddd*.yaml`, and the hexagonal E7 projects).
- **Generated projects.** Reviewed generated projects (the other half of option D) come from the U-G pilot. They are labelled with §3.

## 2. Graph fidelity is agreement plus adjudication (finding 2, BLOCKING)

- dependency-cruiser and the TypeScript compiler are other extractors. We report **agreement** with them, not precision or recall.
- **Adjudicated precision and recall** come from an adjudication of every disagreement, plus a seeded random sample of 50 agreement edges stratified by reason class. The ≥ 0.95 target applies to the adjudicated figure.
- On reference projects, the hand-written expected graph (blind-manifest) is the reference.

## 3. Labelling (finding 3, MAJOR)

- **Correct** (the condition holds) is checked deterministically, or by an agent that sees only the finding's claim and the code, not the rule text.
- **Meaningful** goes to the Gemini labeller (tools off).
- **Per-rule sample size**, fixed now: every finding if a rule has fewer than 40, otherwise a seeded random 40. A Wilson lower bound is reported per rule.
- **Author audit:** at least 30 items, shuffled and blind to the rule id. The labeller is valid if κ ≥ 0.60 between the author and Gemini on *meaningful*.
- **Director:** ask for 30 items rated independently.

## 4. Study 2 sealing (finding 4, MAJOR)

- The Study 2 task list is written now and sealed outside the repo (`../daedalus-sealed/v1.3-study2-tasks.md`). Its sha256 is recorded in `Docs/v1.3/sealed-hashes.md`. No v1.3 generation uses these tasks.
- The Study 2 pre-registration will list the frozen tunables with hashes: templates, tiers, extractor flags, judge prompts, spec presets.

## 5. Tiers (finding 5, MAJOR)

`Docs/v1.3/rule-tiers.md` was committed before any v1.3 labelling (2026-10-14). It was not committed before any labelling: the Study 1 labels, including P4 (2026-10-10/11), already existed. See `Docs/v1.3/decision-chronology.md`. Its hash is sealed.

## 6. Judge (finding 7, MAJOR)

- The #79 anti-pattern operators are frozen (hashed) before any judge prompt is revised. Catch rate is reported as **construct sensitivity**.
- The clean reference variants are the **negative control**, giving a judge false-fail rate.

## 7. Seed counts (finding 8)

At least 20 planted violations per style, using variants plus the existing mutation operators. Results are reported as counts with intervals.

## 8. Order and gates (finding 10)

- Gate 2 (the first fidelity result) is a **human gate**: the author sees it before U-E runs.
- U-G (the spec-influence pilot) is deferred until U-F has first numbers.

## 9. Development set and sealed hold-out set (added 2026-10-15, after the U-E baseline)

- The 71 reference cases (PRs #82, #83) are now the **development set**. Tuning is measured on them and labelled as development-set numbers.
- A **hold-out reference set** is written blind (another model, inputs limited to the rule sources, the tiers, the layer declarations and the schemas) and stored sealed in `../daedalus-sealed/v1.3-holdout`. No tuning agent may read it.
- When v1.3 tuning freezes, the tool's commit is recorded. The hold-out set is then run **once**, and those numbers are the v1.3 validity figures. Any fix made after that run starts a new development round, and needs a new hold-out set before a validity claim.
