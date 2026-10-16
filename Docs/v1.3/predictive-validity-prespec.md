# v1.3 predictive validity: pre-specified analysis (2026-10-16)

**Committed before the tool has run on any corpus project and before any per-file outcome has been computed.** The corpus and specs were committed one commit earlier (`b5cf8a85`, `results/v1.3-validity-predictive/selection.json`, `.../specs/`). The only outcome-adjacent numbers seen so far are project-level commit counts touching each analysis root, used by the inclusion rule (selection.json). No file-level count of bug fixes, churn or co-change, and no tool finding, had been looked at when this file was written.

Changes after this commit are allowed only as dated addenda at the end of this file, each with its reason. The analysis reports the pre-specified version first.

## Question

Do files that the tool flags at snapshot T attract more bug-fix commits, and more churn, in the 12 months after T than comparable unflagged files? This is the standard architecture-smell / defect-proneness design. No human raters are used for the outcome.

## Corpus and snapshot

- 27 projects, `selection.json`: inclusion rule there, applied to metadata only.
- **T = 2025-04-01T00:00:00Z.** Snapshot = the last first-parent commit on the default branch with committer date before T.
- Outcome window W = [T, T + 12 months). Prior window P = [T − 12 months, T).
- Robustness snapshot T_alt = 2024-10-01T00:00:00Z with its own W and P, the same specs.

## Units

A **file** is a non-test, non-`.d.ts` `.ts`/`.tsx` file in the project's source directory at T (selection.json `sourceDir`), in the harness program, excluding paths under `migrations/`, `seeds/`, `seed/` folders, `__tests__`, `__mocks__`, `test/`, `tests/`, and `*.spec.ts`, `*.test.ts`, `*.e2e-spec.ts`.

- **Primary analysis set:** files that the spec maps to a layer (the tool reports a layer for them), because only those can carry a layer-rule violation. Unflagged mapped files are the comparison group.
- **Sensitivity set:** all files.

## Tool run (exposure)

`firewall evaluate --project <snapshot>/<root> --spec results/v1.3-validity-predictive/specs/<id>.yaml --tsconfig <harness> --symbolic-only --engine cypher-interp --format json`, v1.3 scoring (defaults), instrument v2, graph mode full. The harness tsconfig is the project's own tsconfig flattened by `flattenTsconfig` (`scripts/v1.3/lib/wild.ts`) with `include` = the source directory and the exclusions above. No dependencies are installed. Tiers come from each report's `tiers` block (`Docs/v1.3/rule-tiers.md`); no tier or template is edited.

Per file:

- **E1 (primary exposure):** 1 if the file is the `filePath` of at least one **blocking-tier** violation, else 0.
- E1n: number of blocking violations with that `filePath` (secondary, as log1p).
- E1t: 1 if the file is the `filePath` **or the `target`** of a blocking violation, or a member named in a cycle message (sensitivity).
- E2: 1 if the file is the `filePath` of at least one **advisory** violation (secondary); E2n its count.
- Per-rule indicators for each blocking rule that fires on at least 20 files pooled (secondary).

## Controls (at T)

- **LOC:** non-blank lines.
- **fan-in / fan-out:** distinct files of the program that import the file / that it imports, from the tool's APG (`extractAPG`, default options, the same harness tsconfig), `IMPORTS` and `RE_EXPORTS` file→file edges.
- **age:** days from the first commit that created the file's lineage (rename-aware, see below) to T.
- **prior churn:** lines added + deleted to the file's lineage in P.
- prior bug fixes (H1 commits touching the file in P): used in robustness R6 only.

All enter models as log1p, age as log(1 + days).

## Outcomes (in W)

Commits are taken from `git log --no-merges -M` over the source directory. Commits authored by bots are dropped: author name or e-mail matching `bot]`, `renovate`, `dependabot`, `github-actions`, `[bot]`, `-bot@`. File identity follows renames (git `-M` similarity default) forward from T. A file deleted in W keeps the outcomes it collected and gets exposure time up to its deletion (offset below).

- **Y1 (primary): bug-fix commits** touching the file, by heuristic H1.
- Y2: churn, lines added + deleted.
- Y3: co-change breadth, the number of distinct other source-directory files changed in the same commits, over commits that touch the file and change at most 50 files.

### Bug-fix heuristics

On the commit subject (first line), lower-cased:

- **H1 (primary):** matches `\b(fix|fixes|fixed|fixing|bug|bugs|bugfix|hotfix|defect|regression|crash|crashes|crashed|broken|repair)\b` or a conventional `fix` type (`^fix(\(.*\))?!?:`); **and** does not match a conventional `chore|docs|test|tests|ci|build|style` type, and does not match `\b(typo|typos|lint|linter|linting|eslint|prettier|formatting|deps|dependency|dependencies|bump)\b`.
- **H2 (strict):** conventional `fix` type only, same exclusions.
- **H3 (broad):** the H1 keyword pattern on subject **and body**, no exclusions.

**Validation of H1.** 200 H1-positive and 100 H1-negative commits in W touching some source file, drawn with seed 20261016, stratified by project (proportional, at least 3 per project where available). Linked-issue labels cannot be fetched: the GitHub API for these repositories is outside this session's scope (HTTP 403), so the rater is the analyst (Claude), reading subject, body and changed-file list, judging "corrective change: yes / no / unclear" without seeing any tool output for the files. Report precision (yes / (yes + no)) and the negative-sample miss rate with Wilson 95% CIs. Where a commit message itself references an issue labelled as a bug in its text, that is used as evidence; nothing else from issue trackers is.

## Models

Python 3.11, statsmodels 0.14.4, pandas 2.2.3, numpy 2.1.3, scipy 1.14.1 (pinned, `scripts/v1.3/predictive/requirements.txt`).

Covariate vector X = log1p(LOC), log1p(prior churn), log1p(fan-in), log1p(fan-out), log(1 + age). Offset: log(exposure years in W), 1 for files alive all of W.

- **M1 (primary):** pooled negative binomial (NB2, `statsmodels.discrete.NegativeBinomial`) of Y1 on E1 + X + project fixed effects, with cluster-robust standard errors by project. Report the IRR of E1 = exp(β) with a 95% CI.
- **M2:** the same model per project without fixed effects. A project with fewer than 10 flagged or fewer than 10 unflagged files, or fewer than 10 files with Y1 ≥ 1, is reported but marked underpowered and left out of the meta-analysis. If NB2 fails to converge, Poisson with HC1 standard errors, flagged in the table.
- **M2-meta:** DerSimonian–Laird random-effects meta-analysis of the per-project log IRRs; report the pooled IRR, CI and I².
- **M3:** M1 with Y2 (churn) and with Y3 (co-change breadth) as outcomes.
- **M4 (secondary exposures):** M1 with E1n, E2, and per-rule indicators (each blocking rule as its own binary, all in one model; Holm-adjusted p for those).
- **Mixed model (robustness R8):** Poisson GLMM with a random intercept per project (`PoissonBayesMixedGLM`, variational Bayes), E1 + X; report the posterior mean and 95% interval of the E1 coefficient.

### Matched pairs

Within each project, each flagged mapped file is matched to one unflagged mapped file without replacement, by nearest Mahalanobis distance on (log1p LOC, log1p prior churn), with a caliper of 0.25 pooled SD on each; flagged files without a match inside the caliper are dropped and counted. Processing order: flagged files sorted by descending LOC, ties by path. Outcome: Y1 difference per pair. Report the number of pairs, the mean difference with a paired bootstrap 95% CI (2,000 resamples, seed 20261016), the Wilcoxon signed-rank p, and the share of pairs with flagged > unflagged, flagged < unflagged, equal. Sensitivity: exact match on project and layer.

## Decision rule

Primary hypothesis: the IRR of E1 in M1 is above 1.

- **Supported:** 95% CI lower bound > 1.
- **Contrary:** 95% CI upper bound < 1.
- **Null:** otherwise. The smallest effect of interest is IRR 1.2: a CI wholly inside (0.83, 1.2) is reported as "no meaningful effect"; a CI that includes 1 but extends beyond 1.2 is "inconclusive".

Every secondary analysis is exploratory and is reported as such, with its CI, whatever its direction.

## Robustness (all pre-specified)

- R1: T_alt = 2024-10-01 (re-run the tool at that snapshot with the same specs).
- R2: 6-month window [T, T + 6 months).
- R3: H2 and H3 instead of H1.
- R4: exposure E1t (source, target or cycle member).
- R5: all files instead of mapped files.
- R6: add log1p(prior bug fixes) to X.
- R7: leave-one-project-out range of the M1 IRR.
- R8: Poisson GLMM (above).
- R9: Y1 as a binary (any bug fix in W), pooled logistic regression with project fixed effects and cluster-robust SEs, odds ratio of E1.

## Known threats, stated in advance

- The specs are one analyst's layer maps; they were written blind to outcomes but by the same analyst who runs the analysis.
- The heuristic rater is the analyst, not an independent human; precision is an estimate with that caveat.
- File size and churn dominate defect counts in this literature; the controls may not remove all confounding (e.g. central "god" files are both flagged and edited).
- Projects that squash-merge and projects that keep branch commits count commits differently; the project fixed effects absorb level differences only.
- 27 projects is a convenience corpus of popular open-source backends, not a random sample.
