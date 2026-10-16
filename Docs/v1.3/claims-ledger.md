# Claims ledger (gaps G2, G6, G7)

**2026-10-16. Status: working register; doc only.** Each row is one claim the thesis or the papers make or could
make: its value, the file that holds the evidence, the data class, and the status of that evidence on 2026-10-16.
Companion files: `Docs/v1.3/contribution-statement.md` (G2) and `Docs/v1.3/limitations-register.md` (G6). No number
was recomputed for this ledger. Each value is copied from the cited file. Where two files disagree, both are given
and the row is marked **inconsistent**.

## Legend

**Data class.**
- **REG**: registered analysis (Study 1, `corpus/prereg.json`, `Docs/analysis-plan.md`).
- **REG-HO**: registered, on the SO4 held-out seeds of Study 1 (v1.2E instrument). This is not the v1.3 hold-out.
- **PH**: post-hoc reading of registered data.
- **DEV**: v1.3 development data (the 71 reference variants, devset-b, judge-catch items, E1 cells, probes written
  by the same session that reports them).
- **EXT**: external human-written repositories (PR #133 and #181) or wild repositories (PR #114). These are not
  development data and not a hold-out. The specs were written after the repositories were chosen.
- **HO13**: the frozen v1.3 hold-out (`Docs/v1.3/holdout-prespec.md`). **It has not been run.**

**Status.** **merged**: on `origin/v1.3`. **open #N**: on an open `[hold]` PR, not merged. **not run**: the
evidence does not exist yet.

## 1. Contribution claims (F1 to F3 of the statement)

| ID | Claim | Value | Evidence file | Class | Status |
|---|---|---|---|---|---|
| C01 | The specification level affects the AHS of generated projects, in the reverse direction (`none` best) | Holm p = 0.0003 | `results/e1-grid/agg/so5_tests.csv`; `Docs/DiagnosticRuns/e1-size-analysis-2026-10-10.md` §1 | REG | merged |
| C02 | No model effect in E1 | p = 0.44 | same, §1 | REG | merged |
| C03 | The spec effect runs through project size: it survives density per KLOC and an ln LOC adjustment, and it is absent per file | per KLOC Holm p 0.0003; per file p 0.95 | `Docs/DiagnosticRuns/e1-size-analysis-2026-10-10.md` §6 | REG (per KLOC, exploratory family); PH (rest) | merged |
| C04 | At equal size, the architecture-as-code spec scores better than the prose spec | δ 0.52 (0.47 after LOC adjustment) | same, §6 | PH | merged |
| C05 | Under v1.3 scoring, no E1 cell has a blocking finding | 0 of 65 | `Docs/DiagnosticRuns/v1.3-study1-rerun-2026-10-15.md` §1 | DEV (descriptive) | merged |
| C06 | Seeded detection recall on the SO4 held-out seeds, registered strict rule | 0.893 [0.787, 0.974]; precision 0.838 [0.719, 0.970] | `papers/paper2-tool/main.tex` (Table `tab:so4`) | REG-HO | merged |
| C07 | The same, labelled reading | recall 0.918 [0.818, 1.000]; precision 0.957 [0.893, 1.000] | `results/so4-heldout/agg/prf_overall.csv`; `papers/paper2-tool/main.tex` | PH | merged |
| C08 | Study 1 real-code precision | 0.33 to 0.79, by treatment of uncertain labels | `results/so4-heldout/agg/precision_baseline.csv`; `papers/STATUS.md` | REG | merged |
| C09 | Blocking findings on human-written code are correct (deterministic check) | 283/283, Wilson [0.987, 1.000]; negative control 500/500 rejected | `Docs/DiagnosticRuns/v1.3-external-correctness-2026-10-16.md` §3 (branch `v1.3-external-correctness`) | EXT | open #167 |
| C10 | Agreement with three independent tools on the rules they can express | κ vs dependency-cruiser 1.000 / 0.961 / 0.913 (reference / external / wild); eslint-plugin-boundaries 1.000 / 0.930 / 1.000; ArchUnitTS 1.000 / 0.918 / 0.950; 0 disagreements classed as our bug | `Docs/DiagnosticRuns/v1.3-validity-convergent-2026-10-16.md` §0 | DEV + EXT | merged |
| C11 | Rules the three tools cannot express | 57 of 89 rule×style rows (21 rules) | same, §2.2 | DEV (catalogue count) | merged |
| C12 | The judge catches planted seeds that the rules do not flag | 22/26 = 0.85 [0.66, 0.94]; false fail on symbolic-pass units 2/48 = 0.04 [0.01, 0.14] | `Docs/DiagnosticRuns/v1.3-complementarity-2026-10-16.md` §2 (branch `v1.3-complementarity-matrix`) | DEV | open #179 |
| C13 | Judge pooled catch on the headline seeds | 16/21 = 0.76 [0.55, 0.89] | `Docs/DiagnosticRuns/v1.3-judge-catch-round2-2026-10-15.md` | DEV | merged |

## 2. Supporting and instrument claims

| ID | Claim | Value | Evidence file | Class | Status |
|---|---|---|---|---|---|
| C14 | Reference-set blocking recall, author view | **inconsistent**: 54/54 after the FF-P06 N/A correction; 57/57 is still quoted in `papers/STATUS.md` and in the readiness note | `Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md` (Correction, top) | DEV | merged |
| C15 | Reference-set blocking recall, blind view | 53/67 | same, §3 | DEV | merged |
| C16 | No incorrect checkable finding on the reference set and E1 | 0 incorrect of 2,668 checkable | `Docs/DiagnosticRuns/v1.3-labelling-2026-10-15.md` | DEV | merged |
| C17 | Graph fidelity against the compiler | Jaccard 0.988 (E1), 0.913 (SO4, tsc); 0 unexplained disagreements | `Docs/DiagnosticRuns/v1.3-graph-fidelity-2026-10-14.md` | DEV | merged |
| C18 | The in-process interpreter reproduces the Neo4j reference results | 71/71 byte-identical | `Docs/v1.3/cypher-interpreter.md` | DEV | merged |
| C19 | The reference results do not depend on the Neo4j version | 73/73 identical on 5.26.24 and 2025.12.1 | `Docs/DiagnosticRuns/v1.3-neo4j-version-2026-10-16.md` | DEV | open #207 |
| C20 | Surface form does not move the verdict | 6 of 9 transformations invariant on 71/71; 1 tool bug (MT-B1), fixed behind an OFF option | `Docs/DiagnosticRuns/v1.3-metamorphic-2026-10-16.md` §1 | DEV | open #185 |
| C21 | Sensitivity of the validation set to rule defects | 90 of 273 measurable mutants change an expected result (33%); 130 (48%) counting false positives; 106 survive sets and unit tests | `Docs/DiagnosticRuns/v1.3-rule-mutation-2026-10-16.md` §1 | DEV | open #190 |
| C22 | External set verdicts | **inconsistent**: 11 fail, 4 pass, 283 blocking in the PR's own table; the night backlog says "10 of 15 fail" | `Docs/DiagnosticRuns/v1.3-external-set-2026-10-16.md` (branch `v1.3-external-set`, Total row); `Docs/v1.3/night-backlog-2026-10-16.md` §0 | EXT | open #133 |
| C23 | Reproducibility audit of headline numbers | 531 rows, 482 match, 26 prose mismatches, no headline overturned | `Docs/DiagnosticRuns/v1.3-repro-audit-2026-10-16.md` | DEV | merged |
| C24 | Every number in the v1.3 docs regenerated | 5,154 numbers; 4,587 reproduce; 58 differ | `Docs/v1.3/replication-2.md` (branch `v1.3-replication-2`) | DEV | open #215 |
| C25 | Loop resumes byte-identically after faults | 11 of 13 drills | `Docs/v1.3/loop-fault-drills.md` (branch `v1.3-loop-fault-drills`) | DEV | open #180 |
| C26 | Advisory post-filters leave blocking rows unchanged out of sample | 15/15 external, 11/14 wild byte-identical; the roll-up filter does not carry over | `Docs/DiagnosticRuns/v1.3-advisory-filter-oos-2026-10-16.md` | EXT | open #213 |

## 3. Claims with no evidence yet

| ID | Claim the thesis needs | Why it is missing | Gap |
|---|---|---|---|
| C27 | Any v1.3 figure on the frozen hold-out | The hold-out has not been run; the freeze dry run found that the recorded sealed tree hash could never match (`Docs/v1.3/freeze-runbook.md` on `v1.3-freeze-dryrun`, open #164) | G3 |
| C28 | Study 2 effect of the gate on erosion | Not run; readiness gate not green; pilot §5 decision not reached (open #170) | G4 |
| C29 | Judge agreement with human labels (κ) | No human labels; author audit sheets unanswered (`papers/STATUS.md`) | G8 |
| C30 | Findings are architecturally meaningful (not only correct) | No meaningful labels; the labeller stopped after one answer (`Docs/DiagnosticRuns/v1.3-labelling-2026-10-15.md` §4) | G8 |
| C31 | Independent labelling of a subset (proposal promise SO4-7) | Not done | G6, G8 |
| C32 | A publication product (Art. 30 c, Art. 32) | No submission exists | G1 |

## 4. Predictable attacks and the rows that answer them (G7)

| Attack | Rows that answer it | Rows that limit the answer |
|---|---|---|
| "Your seeds test your own templates" | C09, C10, C16 (checks on human code and against other tools) | C21 (the set misses two thirds of mutants), C30 |
| "Everything is Claude" | C09, C10 (human-written code; non-Claude tools) | C12, C13 (judge and items same vendor); register L08 |
| "These are development numbers" | C01 to C08 (registered) | C27 (v1.3 hold-out not run) |
| "The judge is 0.76" | C12 (bounded, complementary role) | register L07, L08 (unanimity null; v2.2 NOT CANDIDATE) |
| "What about the proposal's promises?" | `Docs/v1.3/limitations-register.md` §3 | C29 to C31 |

## 5. Stale references found while building the ledger

- `papers/STATUS.md` cited the October director report (`director-report-2026-10.md`, internal). That file was moved out of the public repo
  (commit `18c7382c`), and the citation has since been removed from `papers/STATUS.md`. The E1 figures it supports are also in `Docs/DiagnosticRuns/e1-size-analysis-2026-10-10.md`.
- `papers/STATUS.md` and `Docs/v1.3/research/distinction-readiness.md` quote 57/57 author-view recall; the source
  report corrects this to 54/54 (C14).
- The night backlog's "10 of 15 human-written repos fail" disagrees with PR #133's table, which gives 11 fail
  (C22). One of the two needs a correction before either is quoted.
