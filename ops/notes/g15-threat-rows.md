# G15: three new rows for the v1.3 threats register

**Status:** rows ready to paste, for review, 2026-10-18. Zero calls. They follow the format of `Docs/v1.3/threats-register.md` exactly: a summary-table row plus a full entry with Description, Evidence, Severity, Mitigation done, Mitigation planned, Residual and Thesis. The format is defined at `:9-18`. The ids are the next free ones in each category: the register ends at C8, I7 and D4 (summary table, `:20-54`).

**Scope note.** The register covers "the v1.3 validation of the instrument" (`threats-register.md:3`). Rows 2 and 3 are also, or mainly, Study 2 threats. Study 2 keeps its own risk table (`Docs/v1.3/study2-outline-v2.md:329-335`, R14–R20), and R15 already names "feature dropping or gaming" (`:330`). I put them in the register because the instrument is what gets evaded, and because the role overlap extends V13-TV-D1. The coordinating session may prefer to cross-reference R15 instead of duplicating it.

---

## 1. Where they go

- **Summary table:** insert after V13-TV-I7 (`threats-register.md:30`), after V13-TV-C8 (`:38`) and after V13-TV-D4 (`:54`):

```markdown
| V13-TV-I8 | Training-data contamination: public external repos and AI-era rule baselines | Medium (High for model-judged figures on public repos) | Medium |
| V13-TV-C9 | Agent evasion: an arm lowers the count by moving, wrapping or dropping code, not by keeping the architecture | High (for Study 2 H2) | Medium once the M6 check is registered and run |
| V13-TV-D5 | Role overlap extends to Study 2: the author decides specs, post-seal rules, tasks, construct answers and the moved-only read | High | Medium |
```

- **Full entries:** I8 at the end of section I (before `## E.` at `:340`), C9 at the end of section C (before `## I.` at `:205`), and D5 at the end of section D (before `## Appendix A.` at `:602`).

---

## 2. The entries

### V13-TV-I8: Training-data contamination of the external repositories and the rule baselines

- **Description.** The external, wild and fix-mining repositories are public GitHub projects: 15 external (`Docs/v1.3/compendium/README.md:14`) and 36 fix-mining histories (`Docs/DiagnosticRuns/v1.3-validity-fixes-mined-2026-10-16.md:12`). Any model in the pipeline may have seen their code, their architecture documents and their own lint rules during training. That covers the judge, the model panel, the labeller, the planned enrichment layer (C1d) and the Study 2 generators. A model's judgement of such a repository can then echo remembered intent instead of reading the code. A second effect concerns the developer-acknowledged ground truth. Of the dependency-cruiser baselines found in the 2026-10-16 scan, 40 of 42 were first committed in 2026, and 35 of the repositories hold AI-agent files (`ops/track-2-scale.md:44`). Those baselines may have been written by agents, so "the developers' own rule" may be a model's rule. Using them as a criterion for a model-assisted instrument is then partly circular.
- **Evidence.**
  - `ops/track-2-scale.md:44` (40/42, 35 repositories, Nx 0/100). **The scan itself is not committed.** Commit its list of repositories, baseline paths and first-commit dates before this row cites it as evidence.
  - `ops/01-instrument-map.md:216` (risk 6)
  - `Docs/v1.3/labeller-calibration-plan.md:282` (the same threat, stated for MLCQ and DACOS)
  - `Docs/v1.3/model-panel.md:216` ("Models share training data")
  - `Docs/v1.3/study2-outline-v2.md:329` (R14, sealed tasks leaked or contaminated)
- **Severity.** Medium for the symbolic figures: the rules are compiled from YAML and learn nothing, so contamination reaches them only through specs that models drafted. High for any model-judged figure on a public repository, and for any criterion built from 2026 baselines.
- **Mitigation done.**
  - The symbolic verdicts do not depend on a model.
  - The hold-out is sealed and has not been run.
  - The Study 2 tasks are sealed, and the coordinator who wrote them does not run, monitor or score generation (V10c, `study2-outline-v2.md:329`).
- **Mitigation planned.**
  - Hand-written cases (the C1d K3 cases with twins) serve as the uncontaminated control (`ops/01-instrument-map.md:216`).
  - Record each external and criterion repository's first-commit date and the presence of agent files in its corpus table.
  - Report developer-acknowledged results split into pre-2023 and later (about 27 of the 120–150 positives are pre-2023, `ops/track-2-scale.md:41`).
- **Residual.** Medium. Contamination cannot be ruled out for public code. It can only be bounded by the hand-written control and the date split.
- **Thesis.** Ch7: every model-judged figure on a public repository carries "public code, contamination not excluded". Ch8: the circularity of AI-era baselines as ground truth.

### V13-TV-C9: Agent evasion of the rules (Study 2)

- **Description.** The `daedalus-mcp` arm can lower its blocking count without keeping the architecture:
  - by moving code to files no rule checks (for example the composition root in `src/main.ts`, which the Layered preset leaves outside the layout);
  - by wrapping or inlining a call so that the import edge disappears;
  - by using dynamic `import()` or `require()`;
  - by dropping the feature.

  The count then measures detectable violations, not erosion, and H2 ("fewer violations with the tool") can be met by doing less or hiding more. Under D2b the cheapest evasion in Layered is to move the wiring out of the layout (`ops/notes/g12-d2b-construct-limit.md` §3.2).
- **Evidence.**
  - `ops/decisions.md:36` (M6: pre-register an evasion check)
  - `ops/01-instrument-map.md:213` (risk 3, "Gaming")
  - `Docs/v1.3/study2-outline-v2.md:330` (R15)
  - `Docs/v1.3/floor-escape-design-2026-10-16.md:111` (the outside-layout persistence guard)
  - `Docs/v1.3/compendium/nulls-and-limits.md:390` (L152: the acceptance runner passed no test on the replay tapes)
  - `ops/notes/s2d-01-study2-drift-design.md:88-96` (the draft evasion check), `:168` (acceptance checks for the new tasks not ready)
- **Severity.** High for Study 2's H2 and any arm contrast. Not applicable to the instrument-validation figures, which score fixed code.
- **Mitigation done.**
  - The drift draft defines a seven-part check (`s2d-01:88-96`): acceptance pass rate within 10 points of `none`; size trajectories; coverage, outside-layout persistence imports and `import()`/`require()`/barrel counts; a literal-view re-score; a blind moved-only read with a bar of 0 moved-only cases in `mcp`; tool-use share ≥ 80 %; rule-family concentration.
  - None of it is registered or built yet (`ops/03-build-list.md:37`).
- **Mitigation planned.**
  - Register the check before the freeze, and make D12 (acceptance) non-waivable (`s2d-01:90`).
  - Build the outside-layout guard.
  - Run the check on a dry-run step (`ops/04-north-star.md:25`).
- **Residual.** Medium. The moved-only read covers 20 diffs and one reader, the author (see V13-TV-D5), so a low evasion rate cannot be excluded.
- **Thesis.** Ch7/Study 2 results: the evasion table sits beside every arm contrast. If a guard fails, H2 is reported as "fewer detected violations", not "less erosion".

### V13-TV-D5: Role overlap in the norms and in Study 2

- **Description.** V13-TV-D1 lists the author's roles in instrument validation (`threats-register.md:534-558`). The 2026-10-18 decisions add Study 2 and post-seal roles to the same person:
  - **Norm setter:** confirms the decision sheet with changes (D1, `ops/decisions.md:10`) and answers the 25 construct questions (`Docs/v1.3/construct-decisions.md:3`).
  - **Rule author after the seal:** decides the DDD cycle rule and application purity (D5, N3, `ops/decisions.md:26-27`), and decides that Layered keeps counting wiring (D2b, `:25`).
  - **Meaning setter:** chooses the definition of a meaningful finding (L4, `:9`) and adds own labels to the free rater's (the plan's C3m row: "about 60 labels from the free rater plus your own", `ops/03-gap-closing-plan.md:26` at `dc593068`).
  - **Task and spec owner:** the Study 2 tasks and the declared start specs are written for the author, by the coordinator or by AI sessions (`study2-outline-v2.md:329`; `s2d-01:26`). The external specs came from two Claude sessions (`Docs/DiagnosticRuns/v1.3-spec-author-reliability.md:99`).
  - **Evasion reader:** classes the blind moved-only diffs (`s2d-01:94`).

  The person who benefits from H2 sets the norm, writes or approves the rules it is scored on, defines meaning, and reads the evasion sample.
- **Evidence.**
  - `ops/decisions.md:9`, `:10`, `:25-27`
  - `Docs/v1.3/construct-decisions.md:3`
  - `ops/notes/s2d-01-study2-drift-design.md:26`, `:94`
  - `Docs/v1.3/study2-outline-v2.md:329`
  - `Docs/DiagnosticRuns/v1.3-spec-author-reliability.md:99`
  - `Docs/v1.3/compendium/nulls-and-limits.md:12` (N02: verdict κ = 0.21 between the two spec authors)
- **Severity.** High. Agreement on the norm is the weakest link already (N02), and here every role that could check it sits with the same person or the same model family.
- **Mitigation done.**
  - The tiers are sealed and hashed (`Docs/v1.3/sealed-hashes.md`).
  - Post-seal rules go through an ADR and are declared as deviations (`ops/decisions.md:26-27`).
  - The moved-only read is blind to arm and transcript (`s2d-01:94`).
- **Mitigation planned.**
  - Date every norm decision (D1, L4, D5, N3, the construct answers) **before** the freeze hash, and the freeze before any Study 2 generation.
  - Make the free rater (D3) primary on meaning, and report the author's own labels apart.
  - Have a second reader, the free rater, on the moved-only sample.
  - Extend the D1 role matrix to Study 2.
- **Residual.** Medium. The author still sets the norms. That is legitimate for declared norms (M2: confirmatory claims only where norms are declared, `ops/decisions.md:34`) if every decision is dated before the data it governs.
- **Thesis.** Ch7: the role matrix of V13-TV-D1 gets Study 2 columns (who wrote the task, the spec and the rules; who answered the constructs; who labelled; who read the evasion sample). Ch8: role overlap, stated with N02.
