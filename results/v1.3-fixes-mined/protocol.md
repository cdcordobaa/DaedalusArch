# v1.3 validity-fixes-mined: protocol (fixed before the run)

Committed 2026-10-16 together with `corpus.json` and `specs/`, **before any tool run on a corpus project**. The only
tool run before this commit was a runtime calibration on ToolJet `server/` (excluded from the corpus by the size rule
below) and on the repository's own `fixtures/`.

## Question

Without human raters: do maintainers remove the dependencies the tool flags? If the project's own developers later
delete the exact edge a finding rests on, in a commit that keeps both files in place, is not a mass change and is not
by a bot, the finding pointed at something they also acted on. The validity signal: **blocking-tier (defining-rule)
findings are removed this way more often and sooner than internal import edges the tool does not flag**, and more than
advisory-tier findings.

## Corpus (`corpus.json`)

- Every pinned project of `results/v1.3-wild/selection.json` (14) and `results/v1.3-external/selection.json` (15,
  branch `v1.3-external-set`, not merged into v1.3), at their pinned SHAs, whatever their history length.
- Plus 7 long-history TypeScript backends with a recognisable structure, pinned to their default-branch HEAD on
  2026-10-16: ghostfolio `apps/api`, directus `api`, outline `server`, logto `packages/core`, unleash `src/lib`,
  budibase `packages/server`, amplication `packages/amplication-server`. Inclusion rule for added projects: at least 300
  first-parent commits touching the analysis path, at most 1,000 non-test source files at the pin (runtime: the walk
  evaluates up to 400 snapshots per project). Infisical `backend` (4,011 files), activepieces `packages/server/api`
  (1,302) and ToolJet `server` (1,241) were candidates and fail the size rule.
- Pinned projects under 300 commits are kept (the task requires them) and reported with their history length; the
  primary tables also show the 300-commit subset.

## Walk (`scripts/v1.3/fixes-mined-run.ts`)

- Commits: `git rev-list --first-parent <pin> -- <path>`, oldest first, commits without a parent removed; up to 200
  evenly spaced (index `round(i * (N-1) / 199)`).
- At each sampled commit C and its first parent P: sparse checkout, harness tsconfig flattened from the project's own
  chain (`flattenTsconfig`, `src/` production code, tests excluded), `firewall` pipeline in process with
  `evaluationMode: symbolic-only`, `graphEngine: cypher-interp`, v1.3 scoring (tiers from `Docs/v1.3/rule-tiers.md`),
  instrument v2, the committed spec. No dependency installed.
- Harness repository (`scripts/v1.3/lib/fast-cycles.ts`): the two variable-length cycle query texts (the FF-S02
  template and the `cyclicDependencyCount` universal metric) are answered by an equivalent bounded search; everything
  else by the interpreter. Parity with the interpreter is checked on every snapshot of at most 100 files.
- One snapshot per (tree of the walked path, tsconfig blob); identical trees are evaluated once.

## Definitions

- **Finding identity**: rule id + file + target (+ non-IMPORTS discriminator); a cycle by its node set, rotation-free.
  Lines are not part of the identity.
- **Edge-shaped finding**: one that rests on file edges (a `target` file; a cycle's consecutive pairs). Other findings
  (metrics, proxies, conventions, package imports) are file-level.
- **Disappearance at P -> C** (finding at P, absent at C), first matching cause:
  1. RENAMED: a file the finding names is a rename source in `git diff -M50% P C`;
  2. FILE-DELETED: a named file is absent at C;
  3. MASS-OR-BOT: the commit is by a bot (`isBotAuthor`) or a mass change: >= 100 files or >= 25% of the root's files
     changed, or >= 20 files or >= 10% renamed or deleted;
  4. RESOLVED-IN-PLACE: a file-level finding whose file stays;
  5. **FIXED-BY-DEV**: an edge-shaped finding, files in place, and at least one of its file edges has no APG relation
     at C (the dependency itself was removed);
  6. OTHER: files and edges still there (a layer, metric or a cycle elsewhere changed).
- **Baseline (a), random edges**: every internal file-to-file IMPORTS / RE_EXPORTS edge at P that no finding at P rests
  on; the same classification (files [s, t], edge s|t). Reported for all such edges, for edges with both files in a
  declared layer, and for cross-layer edges (both files layered, different layers) - the closest comparison, since
  every dependency-direction finding is cross-layer.
- **Baseline (b)**: advisory-tier findings, the same statistics.
- **Fix rate** (pair level): FIXED-BY-DEV disappearances / exposures (finding-or-edge x sampled pair, present at P),
  with Wilson 95% intervals; effect sizes: rate ratio against the baseline (log-normal 95% CI and a repository-cluster
  bootstrap CI), Cohen's h, and a per-repository sign test.
- **Survival** (grid level): the sampled commits in order form a grid; a lineage starts at the first grid point a
  finding (or unflagged edge) is present and ends at the first grid point it is absent; lineages present at the first
  grid point are left-censored and excluded; still present at the last grid point = right-censored. Time in days by
  committer date; Kaplan-Meier median and one-year survival. Ending with every named file still at its path = an
  in-place removal.
- **Architecture words** in the commit message (subject + body; for a merge, the PR title in the body):
  layer, dependenc*, decoupl*, refactor*, port(s) as a whole word, adapter*, domain*.
- **FF-S02 truncation**: the template returns at most 100 cycles; a pair where P or C has 100 cycle findings is
  excluded from the FF-S02 statistics (a cycle can vanish from a capped list without changing).

## Outputs

`repos/<id>/walk.json`, `pairs.json.gz` (per sampled pair: commit metadata, findings that disappeared with their
cause, findings introduced, baseline counts), `lineages.json.gz`; `summary.json` and the report
`Docs/DiagnosticRuns/v1.3-validity-fixes-mined-2026-10-16.md` from `scripts/v1.3/fixes-mined-report.ts`. Third-party
source is never committed: clones and the snapshot cache live in a scratch directory.
