# CI gate: diff-aware architecture checks on pull requests

Branch `v1.3-ci-action`, cut from `origin/v1.3` at `2c64d1d5`. This adds a `check` command that compares two commits and reports only what a pull request introduces. It also adds a GitHub Action that runs `check` and posts a summary comment.

**Status in one paragraph.** `check --base <ref> --head <ref>` evaluates both commits with the same spec and engine. It sorts findings into new, fixed and unchanged, matching on rule + file + target and tolerating line drift. It exits 1 only when a NEW finding is blocking. There are synthetic pull requests for all 71 reference variants. With the Neo4j engine, the gate reports exactly the manifest's blocking findings in 197 of 203 cases. It finds 108 of 114 expected blocking findings and raises 0 false alarms. The 6 inexact cases are the 3 FF-P06 findings that arrive as FLOWS_TO rows. v1.3 tiered scoring counts those rows as N/A, so the gate reports them in tier `not-applicable` rather than `blocking` (§5.2). The drift cases shift every source line by two and leave the code unchanged. All 71 of them report nothing new and nothing fixed. The Action runs the in-process `lexical` engine, which needs no database. On the same cases it has 100 % precision and 51 % blocking recall (§5.3).

## 1. Command

```
daedalus-arch check --base <ref> --head <ref> --spec <path> [--project <dir>] [--engine neo4j|lexical]
                    [--spec-from base|head] [--format human|markdown|json] [--out <file>] [--json-out <file>]
                    [--repo <path>] [--neo4j-uri <uri>] [--verbose]
# from a checkout of this repository:
npx tsx bin/firewall.ts check --base origin/v1.3 --head HEAD --spec presets/clean-architecture.yaml --project app --engine lexical
```

| Option | Default | Meaning |
|---|---|---|
| `--base`, `--head` | required | Any commit-ish (branch, tag, SHA). A ref that starts with `-` is refused. |
| `--spec` | required | Spec path relative to the repository root. |
| `--spec-from` | `base` | Which commit the spec is read from. With `base`, a pull request that loosens the spec does not loosen its own gate. Use `head` for a PR that is meant to change the spec. |
| `--project` | `.` | Project directory relative to the repository root. |
| `--engine` | `neo4j` | See §3. |
| `--format` | `human` | `human` goes to stderr, as `evaluate` does. `markdown` and `json` go to stdout, or to `--out`. |
| `--json-out` | none | Also writes the JSON result (the Action writes Markdown and JSON in one run). |

Exit codes: **0** means no new blocking finding, **1** means at least one new blocking finding, **2** means a usage, git, spec or engine error.

How it works (`src/ci-gate/run-check.ts`):
1. Resolve both refs to commits.
2. Write each commit's tree to a temporary directory through a temporary index (`git read-tree` + `checkout-index`, so `export-ignore` attributes cannot drop sources). The repository's own work tree and index are never touched.
3. Parse the spec from the `--spec-from` commit and evaluate the project directory of each commit.
4. Read renames from `git diff -M`.
5. Classify the findings and delete the temporary trees.

## 2. Matching (new / fixed / unchanged)

`src/ci-gate/match.ts`, pure.

- **Key: rule id + file + target.** The line is not part of the key, so a finding whose line moved is unchanged. Files and targets are project-relative.
- **Cycles (FF-S02)** are keyed by the set of files in the cycle, as in the reference scoring (`scripts/v1.3/lib/compare.ts`). The same cycle reported from another starting file is unchanged.
- **Several rows with one key** (one rule, file and target on different lines) are paired same-line first, then in line order. Surplus rows on the head side are new; surplus rows on the base side are fixed.
- **Renames.** Base findings are re-keyed through the renames git reports inside the project, so moving a file does not report its findings as fixed + new. A rename that changes the file's layer is evaluated on the head as usual. If the move creates a violation, the new finding has a different rule, file or target, so it is new.
- **Verdict:** `fail` if and only if a NEW finding is `blocking`. The tier comes from the v1.3 tier table (`ruleTier`, `Docs/v1.3/rule-tiers.md`, by style), as `evaluate --scoring v1.3` computes it.
  - FF-P06 rows of its N/A part (FLOWS_TO) are tier `not-applicable`, as `computeTieredScoring` does. They are reported but never blocking.
  - Advisory and not-applicable rows are listed and never change the exit code.
  - Tiers are not edited here.

## 3. Engines

| Engine | Needs | Rules | Fix hints |
|---|---|---|---|
| `neo4j` | Neo4j 5.26 + APOC (`NEO4J_URI`, `NEO4J_PASSWORD`; scratch instance, because ingestion clears it) | Every compiled symbolic rule, as `evaluate --symbolic-only` runs them (same pipeline and defaults: instrument v2, v1.3 scoring) | `check_file`'s concrete fix when the lexical scan reports the same rule + file + target, else the report catalogue's fix (`formatActionableViolation`, the text `report` prints) |
| `lexical` | nothing (in process) | `check_file`'s rules, run on every source file of each commit (`checkSource`, the MCP server's lexical scan): FF-S01, FF-S03, FF-S04, FF-P01 and the naming rules | `check_file`'s concrete fix (for example "Declare an interface for what you need in domain, implement it in infrastructure, …") |

**Why the Action defaults to `lexical`.** The brief asked for the in-process engine with no database, `--engine cypher-interp` if it is on v1.3. It is not: `cypher-interp` exists only on the unmerged branch `v1.3-cypher-interp`. The only in-process evaluator on v1.3 is the MCP server's lexical check, so `lexical` is the in-process engine here. The MCP tool `check_diff` checks added lines only, so it cannot report fixed or unchanged findings. Its rule logic (`checkSource`) is reused on whole files of both commits instead.

The `lexical` engine does not see rules that need the graph:
- cycles;
- constructor injection;
- `implements`;
- held state;
- the DDD tactical and strategic rules;
- hexagonal's graph-variant FF-S01/FF-S04 (`dependency-direction-graph`, `core-isolation`).

When `cypher-interp` lands on v1.3, it can join as a third value of `--engine` (`GateEngine` in `src/ci-gate/engines.ts`) without changes to the matching, the formats or the Action. Until then, use `engine: neo4j` with a Neo4j service container for the full rule set (§4).

## 4. GitHub Action

- `action.yml` (repository root, composite).
- Example workflow: `Docs/examples/architecture-gate.yml`. It is **not** active on this repository. Copy it to `.github/workflows/` in the repository to be gated. It is under `Docs/examples/` rather than `docs/examples/` because the repository's docs directory is `Docs/`, and a second case-variant directory would collide on case-insensitive file systems.

What the Action does:
1. Sets up Node 22 and runs `npm ci` in the action directory.
2. Runs `check --format markdown --json-out …` from the action directory, so the checked-out repository's `.env` is never loaded.
3. Appends the Markdown to the job summary.
4. Posts or updates one pull request comment, found by the marker `<!-- daedalus-ci-gate -->`.
5. Fails the job when the verdict is `fail` and `fail-on-new-blocking` is true.

Inputs reach the shell through `env:` only. No `${{ }}` expression is interpolated into a script.

| Input | Default | |
|---|---|---|
| `spec` | required | Spec path, relative to the repository root. |
| `project` | `.` | |
| `base`, `head` | PR base / head SHA | Required outside `pull_request` events. |
| `engine` | `lexical` | `neo4j` needs a Neo4j service and `NEO4J_URI` / `NEO4J_PASSWORD` in the job environment (commented job in the example). |
| `spec-from` | `base` | |
| `comment` | `true` | Needs `pull-requests: write`. On fork PRs the token is read-only: the comment step warns and the summary still has the report. |
| `fail-on-new-blocking` | `true` | |
| `repository-path` | `.` | Check out with `fetch-depth: 0`, so both commits are present. |

Outputs: `verdict`, `new-blocking`, `new`, `fixed`, `unchanged`, `report-path`, `json-path`.

The comment has:
- the verdict;
- counts of new, fixed and unchanged findings (blocking in brackets);
- a table of new findings with tier, rule, `file:line -> target`, message and **fix hint**;
- a table of fixed findings;
- unchanged findings grouped by rule in a collapsed block.

The tables list at most 50 rows each, and the JSON has every row.

Validation done here (no GitHub run; the workflow is not active on this repository):
- Both YAML files parse.
- The gate step's script was run locally with bash, a fake `RUNNER_TEMP` / `GITHUB_OUTPUT` / `GITHUB_STEP_SUMMARY` and a two-commit repository. It wrote the outputs (`verdict=fail`, `new-blocking=2`) and the summary.
- The comment step (`actions/github-script`) has not run.

## 5. Accuracy on synthetic diffs from the 71 reference variants

### 5.1 Method

Script: `scripts/v1.3/ci-gate-synthetic.ts`, library `scripts/v1.3/lib/ci-gate-synthetic.ts`. The cases go through `runCheck`, the CLI's code path. Per style, one git repository holds `spec.yaml` (the reference spec) and `project/`:
- commit `clean`;
- commit `drift`: two comment lines prepended to every source file, no code change;
- one child commit of `clean` per violation or near-miss variant (the reference patch or overlay applied by `materialiseVariant`);
- one line-drift child of each variant commit.

| Case | Variants | Exact when |
|---|---|---|
| clean → variant | 66 violations and near-misses | NEW blocking = the manifest's blocking findings (none for a near-miss) |
| variant → clean | 66 | FIXED blocking = the manifest's blocking findings, and nothing NEW blocking |
| clean → drift | the 5 clean variants (the clean → clean case) | nothing new and nothing fixed, in any tier |
| variant → drift | 66 | nothing new and nothing fixed, in any tier |

"Manifest's blocking findings" means the expected findings whose rule is `blocking` under the style (`scopeRules[].blockingCandidate`, from `ruleTier`). Matching against the manifest is the reference runner's (`compareVariant`: rule + file, target when both carry one, cycles by file set). A blocking row outside the compared rules counts as unexpected. The manifests were not edited.

Environment:
- **Neo4j 5.26.24 Community and APOC 5.26.24 core, from the official tarball** (`neo4j-community-5.26.24-unix.tar.gz`, `apoc-5.26.24-core.jar`), on bolt 127.0.0.1:7687. This environment has no Docker. `--engine cypher-interp` is not on v1.3.
- OpenJDK 21, Node 22.
- Run 2026-10-16. Neo4j run 143 s. Each commit is evaluated once (cache by SHA).

### 5.2 Neo4j engine (full rule set)

From `results/v1.3-ci-gate/neo4j/report.md`:

| Style | Direction | Cases | Exact | Expected | TP | FN | FP | Recall | Precision |
|---|---|---|---|---|---|---|---|---|---|
| clean-architecture | clean→variant | 13 | 12/13 | 13 | 12 | 1 | 0 | 92.3 % | 100.0 % |
| clean-architecture | variant→clean | 13 | 12/13 | 13 | 12 | 1 | 0 | 92.3 % | 100.0 % |
| clean-architecture | clean→drift | 1 | 1/1 | 0 | 0 | 0 | 0 | n/a | n/a |
| clean-architecture | variant→drift | 13 | 13/13 | 0 | 0 | 0 | 0 | n/a | n/a |
| layered | clean→variant | 12 | 12/12 | 11 | 11 | 0 | 0 | 100.0 % | 100.0 % |
| layered | variant→clean | 12 | 12/12 | 11 | 11 | 0 | 0 | 100.0 % | 100.0 % |
| layered | clean→drift | 1 | 1/1 | 0 | 0 | 0 | 0 | n/a | n/a |
| layered | variant→drift | 12 | 12/12 | 0 | 0 | 0 | 0 | n/a | n/a |
| nestjs | clean→variant | 13 | 12/13 | 11 | 10 | 1 | 0 | 90.9 % | 100.0 % |
| nestjs | variant→clean | 13 | 12/13 | 11 | 10 | 1 | 0 | 90.9 % | 100.0 % |
| nestjs | clean→drift | 1 | 1/1 | 0 | 0 | 0 | 0 | n/a | n/a |
| nestjs | variant→drift | 13 | 13/13 | 0 | 0 | 0 | 0 | n/a | n/a |
| hexagonal | clean→variant | 14 | 13/14 | 13 | 12 | 1 | 0 | 92.3 % | 100.0 % |
| hexagonal | variant→clean | 14 | 13/14 | 13 | 12 | 1 | 0 | 92.3 % | 100.0 % |
| hexagonal | clean→drift | 1 | 1/1 | 0 | 0 | 0 | 0 | n/a | n/a |
| hexagonal | variant→drift | 14 | 14/14 | 0 | 0 | 0 | 0 | n/a | n/a |
| ddd | clean→variant | 14 | 14/14 | 9 | 9 | 0 | 0 | 100.0 % | 100.0 % |
| ddd | variant→clean | 14 | 14/14 | 9 | 9 | 0 | 0 | 100.0 % | 100.0 % |
| ddd | clean→drift | 1 | 1/1 | 0 | 0 | 0 | 0 | n/a | n/a |
| ddd | variant→drift | 14 | 14/14 | 0 | 0 | 0 | 0 | n/a | n/a |
| **all** | clean→variant | 66 | 63/66 (95.5 %) | 57 | 54 | 3 | 0 | 94.7 % | 100.0 % |
| **all** | variant→clean | 66 | 63/66 (95.5 %) | 57 | 54 | 3 | 0 | 94.7 % | 100.0 % |
| **all** | clean→drift | 5 | 5/5 | 0 | 0 | 0 | 0 | n/a | n/a |
| **all** | variant→drift | 66 | 66/66 | 0 | 0 | 0 | 0 | n/a | n/a |
| **all** | **all** | 203 | **197/203 (97.0 %)** | 114 | 108 | 6 | **0** | 94.7 % | 100.0 % |

- **Variants with every case exact:** 68/71.
- **Near-misses:** no new blocking finding on any of them.
- **Drift cases:** 1663 findings were matched as unchanged, 53 of them reported on a different line in head than in base. Most Neo4j rows carry no line.

**The 6 inexact cases are 3 findings, each missed in both directions:**
- clean v08 FF-P06 `LoanPolicy.ts → SystemClock.ts`
- nestjs v10 FF-P06 `registration-policy.ts → in-memory-registration.repository.ts`
- hexagonal v10 FF-P06 `AvailabilityChecker.ts → InMemoryBookingRepository.ts`

The gate does report each of them, as NEW and FIXED, in tier **`not-applicable`**. They are FF-P06 field rows with relType FLOWS_TO (`Docs/v1.3/labelling.md` names the same 3). v1.3 scoring reports these rows N/A, so `evaluate --scoring v1.3` does not fail on them either. The gate follows the scoring rather than the manifest, because changing a tier needs an ADR (`rule-tiers.md`). With "reported in any tier" as the criterion, all 114 expected findings are found.

Each of those variants also plants FF-S01 and FF-S04 findings, which are blocking. So the gate still fails these three PRs: the verdict is right in 66/66 clean → variant cases.

### 5.3 Lexical engine (the Action's default, no database)

Full table: `results/v1.3-ci-gate/lexical/report.md`. Summary:

| Direction | Cases | Exact | Expected | TP | FN | FP | Recall | Precision |
|---|---|---|---|---|---|---|---|---|
| clean→variant | 66 | 42/66 (63.6 %) | 57 | 29 | 28 | 0 | 50.9 % | 100.0 % |
| variant→clean | 66 | 42/66 (63.6 %) | 57 | 29 | 28 | 0 | 50.9 % | 100.0 % |
| clean→drift | 5 | 5/5 | 0 | 0 | 0 | 0 | n/a | n/a |
| variant→drift | 66 | 66/66 | 0 | 0 | 0 | 0 | n/a | n/a |
| **all** | 203 | 155/203 (76.4 %) | 114 | 58 | 56 | **0** | 50.9 % | 100.0 % |

Blocking recall by style:

| Style | Recall |
|---|---|
| clean-architecture | 76.9 % |
| layered | 81.8 % |
| nestjs | 72.7 % |
| hexagonal | 7.7 % |
| DDD | 11.1 % |

Every miss is a rule the lexical scan does not evaluate (§3): cycles, FF-P03, FF-P06, the DDD rules and hexagonal's graph-variant FF-S01/FF-S04. There are no false alarms. In the drift cases, all 31 lexical findings (they carry lines) moved by two lines and were matched as unchanged.

So the in-process gate is **safe to block on**, because it raises no false alarm. It is **not complete**: on hexagonal and DDD projects it catches little. For those, run the `neo4j` engine (§4).

### 5.4 Reproduce

```
npx tsx scripts/v1.3/ci-gate-synthetic.ts --engine lexical            # no database, ~20 s
NEO4J_URI=bolt://127.0.0.1:7687 NEO4J_PASSWORD=… \
  npx tsx scripts/v1.3/ci-gate-synthetic.ts --engine neo4j            # scratch Neo4j 5.26 + APOC; holds the Neo4j lock
```

Outputs: `results/v1.3-ci-gate/<engine>/report.md` and `cases.json`.

## 6. Tests

`tests/unit/ci-gate/` (`npx jest --maxWorkers=2 tests/unit/ci-gate`), 34 tests, no database:

- **`match.test.ts`:** key, line drift, surplus rows, same-line pairing, cycles, renames, ordering.
- **`format-engines.test.ts`:** Markdown marker, counts, escaping and fix hints; human and JSON output; tiers including the FF-P06 N/A split; project-relative paths; concrete-fix preference; rename parsing; refusal of option-like refs.
- **`run-check.test.ts`:**
  - real git commits through `runCheck` with the lexical engine: NEW, FIXED, rename-only PR, branch names, spec read from base, files under `export-ignore`, path escapes, unknown ref;
  - the synthetic harness on the clean-architecture variants: v01, v02, v04 and v09 exact both ways, no false alarm, drift cases exact.

## 7. Compatibility and limits

- **Existing commands.** Default outputs are unchanged. Checked on the clean-architecture reference project against the same commands without this branch:
  - `evaluate --symbolic-only --format json` is byte-identical apart from `runId` and timings;
  - `evaluate` human output, `validate` and `evaluate --help` are byte-identical.

  `check` is a new subcommand, so the top-level `--help` lists it. No Cypher template text and no rule tier was edited.
- **Cost.** Each commit is evaluated in full, which is two evaluations per PR. There is no incremental evaluation.
- **Spec changes.** With the default `--spec-from base`, a PR that changes the spec is gated by the old spec. Use `spec-from: head` for a PR that is meant to change it.
- **Neo4j concurrency.** The `neo4j` engine clears the database before each ingestion, so two gates must not share one instance. A service container per job, as in the example, gives each its own.
