# U8 code summary: EFF-01 efficiency harness (driver and scorer), with amendment A1

Committed from the PR #259 description at integration (plan step 12; the code-generation session could not write this file).

## Summary

**What was built:** the driver, scorer and local-check entries over `scripts/v1.3/lib/eff01/` (types, inputs, prompt, argv, plan, trees, transcript, tokens, redact, session, driver, stub-runner, score, cli, local-check), plus the fixture tree, 11 test suites with 87 tests, and the committed EFF-01 data.

**The `--max-turns` finding:** `--max-turns` is a hidden but registered option of Claude Code 2.1.301, and the CLI has an `error_max_turns` result subtype.
- The driver passes `--max-turns 30` in every condition.
- It pins the CLI version at the start of an invocation, and marks drift at the end.
- `num_turns` > 30 stays as a backstop.
- The pilot gate fails if stderr shows that the flag was rejected.

The tests, the deviations, the open risks and the questions are as listed above.

## What changed (new files only; no existing source file was edited)

- **Driver** `scripts/v1.3/eff-01-run.ts` over `scripts/v1.3/lib/eff01/` (`driver`, `session`, `plan`, `argv`, `prompt`, `inputs`, `trees`, `transcript`, `tokens`, `redact`, `stub-runner`, `cli`).
  - It plans 150 sessions: calibration 2, pilot 8, main 120, N 20. The variants give 90 and 50.
  - It builds the R, G and N argv with `--max-turns 30`, and checks each one with `checkArmArgs`. Each G session gets its own MCP config and call log, with `--engine cypher-interp`.
  - Each session runs through `runWithRetries`, with an EFF-01 disposition: a timeout counts as final (`cap-wall`). The status follows the DR-22 order.
  - Every stored file is scrubbed and has its cost fields and personal paths removed.
  - **Dry run is the default.** A live run needs all of `--live`, `--confirm-sessions <n>` and `--questions-sha256`. It also needs a passing `local-check.json` on the same trees. For `--block main` or `--block n`, it also needs a passing `pilot-gate.json`.
  - A live run never takes `--block all`. A spawn budget (n plus a re-run allowance) limits the model-reaching attempts.
- **Scorer** `scripts/v1.3/eff-01-score.ts` (`lib/eff01/score.ts`):
  - It reads the last `ANSWER:` line and normalises the key and the values (SC-8 paths, with a strict variant).
  - It has 10 template rubrics, and the cap and validity rules.
  - It writes `scores.json`, `items.json`, `items.csv` and `pilot-scores.json`.
  - `--rescore-with-current-key` writes `*-key-<hash8>` files next to the originals. `--self-test` scores the key against itself.
- **Local check** `scripts/v1.3/eff-01-local-check.ts` (design §6). It exports the trees the way the driver does, runs evaluate_project in process, and requires 23 and 102 violations.
- **Amendment A1 (the graph complements reading).** G is files plus graph: Read, Grep and Glob, the tree as cwd, and R's reading sentence plus a sentence on checking and quantifying with the graph. There is no graph-only arm.
  - Confinement allows only the file tools inside the tree, plus `daedalus-arch`.
  - The scorer records `graphEvidence = {toolCalls, cited}` for each G session. The item table gains `graphUnusedRuns` and `graphUncitedRuns`.
  - The call count is unchanged (150).
- **Data:** `experiments/eff-01/{questions,answers,repos}.json` and `derive-answers.mjs`. These files are on `ops/working-surface-2026-10-18`, not on `main`. They are copied byte-identical from commit `26cb9685`, and none was edited.
- **Tests:** `tests/unit/scripts/v1.3/eff01/` (11 suites), and the fixture tree `tests/fixtures/eff01/tree-mini/`.

## Test results

- `npx jest --maxWorkers=2 tests/unit/scripts/v1.3/eff01`: **11 suites, 87 tests, all pass** (about 4 s).
- `npx tsc -p tsconfig.v13-fidelity.json --noEmit`: passes.
- `npx tsx scripts/v1.3/eff-01-score.ts --self-test`: **20 of 20 key answers score 1.0.**
- CLI dry run (`--block all`, stub, fixture tree): **150 valid records.** The scorer gives **acc = 1.000 on all 60 item rows**, and the pilot gate passes.
  - Nothing was written to `experiments/`.
  - A grep of the run dir, with the gz files decompressed, finds no `HOME`, no repo root, no temp root and no cost field.
- Optional local check, run on the clones at their pins: **event-sourcing-ddd 23, ddd-forum 102. Pass.**
- ESLint: no findings in the new files except two classes that existing v1.3 files have too (`tests/unit/scripts/v1.3/mcp-smoke.test.ts`, `scripts/v1.3/mcp-smoke.ts`):
  - `expect` is reported as an unresolved type (`no-unsafe-call`);
  - the entry files are outside the ESLint project.

| Rule | Test |
|---|---|
| DR-1 to DR-4, DR-A1-6 | T-PLAN `plan.test.ts`: counts, variants, pilot cells, determinism, lane balance per condition (default seed and 50 others) |
| DR-6 to DR-8, DR-A1-1 | T-PROMPT `prompt.test.ts` |
| DR-9 to DR-11, DR-A1-2 | T-ARGV `argv.test.ts` |
| DR-14 to DR-16 | T-TREE `trees.test.ts`: exactly two runner calls, and no stdout used as data |
| DR-20, SC-4 to SC-6 | T-TOK `tokens.test.ts` |
| DR-23, DR-27, DR-A1-4 | T-CONF `transcript.test.ts` |
| DR-27a, SC-8 | T-REDACT `redact.test.ts` |
| DR-12, DR-13, DR-17 to DR-22, DR-24a, DR-A1-3 | T-ISO and the status order `session.test.ts` |
| SC-1 to SC-12, DR-A1-5 | T-KEY, T-PERT, T-NORM, T-PARSE, T-CAP, T-A1 `score.test.ts` |
| DR-5, DR-24, DR-25, DR-28 to DR-30 | T-DRY, T-GUARD `driver.test.ts`: guard failures exit 2 with no spawn, and the spawn budget exits 1 |
| design §6 | `local-check.test.ts`, and the live gate in `driver.test.ts` |

## Deviations from the design

1. **A1 is built here.** The design copy gains §2.9 and the plan gains step 10a. R's condition sentence also gains the reading instruction, so its text differs from the note's §5 wording.
2. **The EFF-01 data is added to this branch** (see "Data" above).
3. **The local-check files and the live gate on `local-check.json` are new.** Design §6 requires them, but the §4 file table did not list them.
4. **Extra record and score fields:** `statusReason`, `finalText`, `agentError`, `maxTurnsRejected`, and `scoreStrict`/`accStrict`. The stub also has two extra behaviours, `tree-write` and `no-graph`.
5. **`--block` takes a comma list**, so the live pilot (`calibration,pilot`) is one invocation. A live run refuses `all`, and refuses the pilot together with main or n.
6. **The plan always deals sessions to two lanes**, so `plan.json` does not depend on `--lanes`.
7. **In the pilot, a `confinement-leak` is not re-run**, because the gate stops the run anyway. A `tree-changed` session stops the run on its first occurrence (DR-16), with no re-run.
8. **SC-8:** dropping a leading `./` counts as `pathPrefixStripped`, and the strict variant keeps the `./`. This follows T-NORM.
9. **Run indices are 1-based.** The tests were written next to each module, not strictly before it.
10. **`aidlc-docs/construction/v1.4/U8/code/summary.md` is not in this PR.** The code-generation session's file tool refused it as a report file. Plan step 12 is left unticked, and its text is in the section below, ready to commit.

## Open risks and author questions

- **Risk 1** (`--safe-mode` with `--mcp-config`): settled by the first G pilot session, through its init event. The fallback is author question 3.
- **Risk 3** (path format): handled by SC-8, with the strict variant scored next to the primary. Under A1, both arms can report absolute paths. This is author question 2.
- **Risk 13** (rationale comments in the architecture block): the block's hash is recorded, and `--strip-spec-comments` exists. This is author question 8.
- **Author questions 1 to 8 in design §9 are all still open:** the call count and the freeze, path normalisation, the safe-mode fallback, the calibration repo, the analysis unit, the cwd, `--max-turns 30`, and the spec comments.
- **The live pilot commands are in the plan's completion notes. They have not been run and need the author's OK.**

## Integration fixes and open test TODOs (2026-10-18)

A1 check: the design (§2.9) and the driver match A1. R is files only (Read, Grep, Glob, tree as cwd); G is the same files, the same reading sentence and cwd, plus the 11 daedalus-arch MCP tools with the graph sentence; N is the no-tools baseline, not a graph-only arm. The A1 status line now says it is built.

Tests added at integration (`tests/unit/scripts/v1.3/eff01/driver.test.ts`, 94 tests in 11 suites now pass):
- DR-16: a `tree-write` session stops the run with exit 1 on the first occurrence, with no re-run.
- DR-25 / DR-A1-4: `leak-builtin-in-G` and `mcp-not-connected` in pilot G sessions fail the gate before main.
- DR-25: a session whose stderr shows `unknown option '--max-turns'` fails the pilot gate.
- DR-22: an `is_error` result with a subtype other than `error_max_turns` is `completed` with `agentError: true`.
- DR-29: a `claude --version` other than the pin exits 2 with no session; a version change by the end marks every record `cliDrift: true`.
- `wrong` scores below 1; `no-graph` shows in `graphUnusedRuns` and `graphUncitedRuns` (DR-A1-5), which stay `null` for R.

Still TODO (low, no code defect known):
- [ ] DR-22: assert that the `agentError` session scores 0 in `scores.json`.
- [ ] DR-13: negative tests of `checkIsolationPaths` (config dir inside the repo, the real `~/.claude`).
- [ ] DR-28: a live run refused when `dist/mcp-server/main.js` is missing.
- [ ] SC-6 / SC-12: the `usageMismatches` count (stub `model-mismatch`), and the item columns `tokUncachedMedian`, `tokAuxMedian`, `turnsMedian`, `wallMedianMs`, `toolCallsMedian`.
- [ ] SC-11 / DR-28: the scorer refuses to score a dry run into `experiments/`.
- [ ] Stub `max-turns` (`error_max_turns`) at driver level.
- [ ] Author: reconcile `ops/notes/eff-01-efficiency-design.md` §5 and H1-H5 with A1 before the freeze (G is now files plus graph); the A1 date (2026-10-19) differs from the plan notes (2026-10-18).
