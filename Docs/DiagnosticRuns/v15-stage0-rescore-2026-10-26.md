# v1.5 Stage 0: answer-key fixes, the v1.5 code in `src/`, and the regression on old outputs (2026-10-26)

**Exploratory (v1.5), development material only. NOT Study 2b, not registered.** Zero model calls: no generator,
judge, labeller or API call, and no Neo4j. Plan: `ops/notes/v15-final-study-readiness-2026-10-26.md` §5, Stage 0
items 1 and 2. AI-DLC plan: `aidlc-docs/construction/plans/v1.5-stage0-src-move-code-generation-plan.md`. The author
asked to proceed (2026-10-26).

**Unchanged:** the frozen v1.4 path (`src/` outside `src/v15-instrument/`, `presets/`, `scripts/lib/`, `scripts/v1.3/`),
the tag `v1.4-freeze-2026-10-20`, every Study 2b artefact, and every registered count in the earlier reports. No sealed
or held-out set was read. The DETECT-02 held-out is scored in the study, not here. Stage 0 item 3 (the scripted S4
confinement check) is not part of this change. v1.5 is **not** tagged: the combined pull + edit-gate delivery mode
comes first.

## 1. The answer-key fixes

Only categories the hand reads already accepted are encoded. Categories still waiting for the author's ruling are not:
P1-SG1-c and P2-SG1-e (legit-clean proposals) and P5-SG2-a (a trap proposal, which the P5 oracle already fails).

| Key | What was wrong | Fix |
|---|---|---|
| **P2 oracle** (`experiments/puzzle-01/puzzles/p2-loyalty/oracle.ts`, revision R5) | SG2's text clause ("sales never calls a membership write") failed the sales-side event handler that calls membership's published write after the relay delivers the stored `OrderPlaced`. That is P2-SG2-a, accepted as legit-clean in research-log entry 15. SG1's "sales never compares points" clause failed a guard on the points an order earned (`placed.pointsEarned <= 0`), which is P2-SG1-b, also accepted | SG2's clause is judged at run time, with the runtime tracer the P5 oracle uses. A fixed scenario runs through `createApp`. A `Member` change (or a write-named call on a membership store) during `placeOrder` passes only when `EventRelay.deliverPending` delivered it and no sales frame is a caller of that delivery. A plain points name compared with the literal 0 is exempt from SG1. Every other comparison that mentions points still fails |
| **P5 test** (`experiments/puzzle-03/puzzles/p5-ferry-seats/tests/behaviour.ts`, revision R1) | The step-3 request says a new booking on a cancelled sailing "is rejected", but names no form. The test accepted only a returned status `'rejected'`, so a refusal by a thrown error failed it. The PUZZLE-03 and PUZZLE-04 hand reads class this as the request inviting the throw. The test also stopped at the throw, so its last line was never checked | A refusal by a thrown error counts as well as the status `'rejected'`. Either way, no seat may be taken, and the next booking on another sailing must still be confirmed. The P5 oracle is unchanged |

**Checks on the puzzle fixtures** (zero calls):
- **P2:** the clean line passes both sub-goals and all 8 tests. The trap and trap-alt lines fail both sub-goals and pass
  all 8 tests. The seed passes the oracle and fails the 5 feature tests.
- **P5:** the clean line and the handler-in-bookings alternative pass the oracle and all 10 tests. The trap and both
  gaming fixtures (sync event handler, batch unit of work) fail both sub-goals. The seed fails the 6 feature tests.

The revisions are logged in each puzzle's README and in the `REVISIONS` list of `tools/verify.ts`.

The full `verify.ts` runs were not re-recorded. In this worktree they fail their type-check step for every puzzle
("Cannot find type definition file for 'node'", since there is no local `node_modules`). This is a property of the
environment, not of the change. The committed `verification.json` files are left as they were.

## 2. Re-score of the existing puzzle runs (before / after)

The script is `experiments/v15-stage0/rescore-keys.ts`. Records: `experiments/v15-stage0/results/rescore-before.json`
and `rescore-after.json`.
- **Trees:** the final step snapshots of every run each results folder counted. No new run was made.
- **Clean:** every behaviour test and every sub-goal oracle passes. This is the registered outcome of PUZZLE-01 to
  PUZZLE-04.
- **"Before"** is the unchanged keys in this checkout. It reproduces every recorded verdict (30 of 30 runs).

| Run set | Puzzle | Before: clean / trapped / functional | **After** | Runs that changed | Hand-read reading it now matches |
|---|---|---|---|---|---|
| PUZZLE-01 baseline (`none`) | P2 | 0 / 5 / 0 (0/5 [0, .43]) | **1 / 4 / 0** (1/5 [.04, .62]) | c07: SG2 FAIL → pass | "1/5 after the hand read" (c07 = P2-SG2-a) |
| PUZZLE-02 tool arm (pull) | P2 | 0 / 3 / 2 | **3 / 0 / 2** (3/5 [.23, .88]) | c01, c03, c04, c10: SG2 → pass; c05: SG1 and SG2 → pass. c01 and c03 still fail a test (total before the discount) | "P2 3/5" (entry 15) |
| PUZZLE-03 baseline (`none`) | P5 | 0 / 2 / 3 | **0 / 5 / 0** (0/5 [0, .43]) | c03, c13, c14: the one failing test now passes; all three also fail both oracles, so they move from functional to trapped | "P5 0/5", 10 of 10 sub-goal failures a trap |
| PUZZLE-04 `gate` | P2 | 2 / 3 / 0 (2/5 [.12, .77]) | **4 / 1 / 0** (4/5 [.38, .96]) | c09, c16: SG1 and SG2 → pass. c18 stays trapped: SG1 fails on P2-SG1-e, not encoded | "4/5 under the accepted P2-SG2-a + P2-SG1-b" |
| PUZZLE-04 `gate` | P5 | 0 / 0 / 5 | **4 / 1 / 0** (4/5 [.38, .96]) | c05, c10, c17, c21: the step-3 test passes. c07: the test passes and SG2 still fails (P5-SG2-a, the composition-root facade) | "4/5 (throw accepted; c07 stays trapped)" |
| PUZZLE-04 `pull` | P5 | 0 / 0 / 5 | **5 / 0 / 0** (5/5 [.57, 1]) | c01, c05, c06, c09, c10: the step-3 test passes | "5/5" |

Wilson 95% intervals in brackets.

- **Every change goes in one direction:** a sub-goal or a test from FAIL to pass, in the shape the hand reads named.
  No verdict went from pass to FAIL.
- **The two earlier clean P2 gate runs (c14, c25) stay clean.**
- **The P5 tool effect is now in the registered outcome.** Gate 0/5 → 4/5 and pull 0/5 → 5/5, against a baseline of
  0/5 that does not move. Before, it showed only in the oracle columns.
- **The P2 counts are now the hand-read counts.** PUZZLE-02 pull 3/5 against baseline 1/5; PUZZLE-04 gate 4/5. At
  n = 5 none of these separates from its baseline (R5).
- **Only final-tree outcomes are re-scored.** The per-step and event-grain figures of the earlier reports
  (caught-and-fixed, findings then trapped) are not recomputed. The reports' registered counts stay as published. The
  figures above are the counts under the fixed keys, for the final study's planning.

## 3. The v1.5 code in `src/`

New module: `src/v15-instrument/`. The logic is copied unchanged from the prototypes. Only the import paths, a header
line and the location of the rule files changed. The prototypes stay in `experiments/` as the record of the
exploratory runs.

| Part | `src/v15-instrument/` | From |
|---|---|---|
| APG-V15 graph build | `graph.ts`, `facts.ts`, `spec.ts`, `import-types.ts`, `conventions.ts` | `experiments/detect-02/lib/`, `experiments/detect-01/lib/layers.ts` |
| RULES-V15 | `rules/*.cypher`: R-D4, R-D5, R-D9, R-H5, R-INJ, R-RTX, R-XCTX (byte-identical) | `experiments/detect-02/rules/` |
| `check_consistency` and the v1.5 MCP server | `consistency.ts`, `mcp/server.ts`, `mcp/main.ts` | `experiments/detect-02/mcp/` |
| S3 ownership facts (deterministic part) | `s3-ownership.ts`: the reader's listing, the answer check, citation grounding, grounded roots as a spec `aggregates` block | `experiments/v15-u4/s3.ts` (the provider `llm.ts` and its cassettes stay in the experiment; `src/` makes no model call) |
| Edit gate | `edit-gate/gate.ts`, `hub.ts`, `layers.ts`, `settings.ts` (hook settings only), `gate-relay.cjs` | `experiments/edit-gate/` (`editGateArgs` stays there, since it needs `scripts/lib/`) |

**Choosing an instrument.** The frozen v1.4 path is unchanged and stays the default:
- the `daedalus` CLI, `src/mcp-server/main.ts` and `npm run mcp` are v1.4;
- v1.5 is chosen explicitly, through `src/v15-instrument` or `npm run mcp:v15` (the frozen server plus
  `check_consistency`);
- `INSTRUMENTS` and `selectedInstrument()` (environment variable `DAEDALUS_INSTRUMENT=v1.5`) name the two paths, and
  anything else selects v1.4.

The rule files are found from `__dirname` under CommonJS (jest), or else from the working directory or the entry
script. The npm package ships `dist/**/*.js` only, so the npx form does not carry the `.cypher` files yet. Packaging is
part of the v1.5 tag, not of Stage 0.

**Tests.**
- `tests/unit/v15-instrument/`: 3 suites, 25 tests, all passing with `jest --maxWorkers=2`.
  - The rules are byte-identical to the prototype's.
  - The 10 DETECT-02 precision fixtures (legit and positive twins, with declared and with inferred roots) give exactly
    the rows recorded in `experiments/detect-02/results/precision.json`: 0 of 20 false-positive runs, 12 of 12
    positives flagged.
  - The edit-gate tests are ported from the prototype's own: hook format, message caps, de-duplication, refusals,
    fail-open, hook settings, the real checker on the dummy project, and the P6 layer replay.
  - S3 grounding: shape check, listing, citation resolution, grounded roots read as declared roots.
- `tsc --noEmit` is clean.
- The full suite result is given in §5.

## 4. Regression: the old outputs through the `src/` version

Each check scores the recorded trees with `src/v15-instrument` and compares with the recorded results.

| Records | What is compared | Result |
|---|---|---|
| **DRIFT-01 pilot**: `results/v1.4-drift-01/score/scores.json` (18 blocks, 108 step trees, rebuilt from the seeds and the recorded diffs; seeds hash-checked) | Per step: the v1.5 identity keys and the raw R-D4 / R-XCTX findings. Per block: D_v15 (v1.5 part) and D_v15_seed, with the same renames and the Study 2b drift parameters | **Match: 0 mismatches.** t1 `none` ΣD_v15 = 6 (2, 2, 2), `pull` 0, `gate` 0. t2 `none` 1 (0, 1, 0), `pull` 0, `gate` 0. ΣD_v15_seed: t1 12 / 6 / 6, t2 1 / 0 / 0. These are the figures of `Docs/DiagnosticRuns/drift-01-pilot-2026-10-23.md` §1–§2 (D_frozen = 0 in every cell, so D_v15 is its v1.5 part) |
| **DRIFT-01 Part A**: `results/v1.4-drift-01/rescore-hexddd/scores.json` (the two HEXDDD-01 runs, 12 step trees) | As above | **Match: 0 mismatches.** S1 D_v15 2, D_v15_seed 2; S2 D_v15 2, D_v15_seed 4 (`Docs/DiagnosticRuns/drift-01-rescores-2026-10-23.md`) |
| **PUZZLE-04**: `results/v1.4-puzzle-04/{gate,pull}/scores.json` (35 sessions, 140 step snapshots) | Per step: `check_consistency` status and findings on the whole tree, and the edit gate's layer checks FF-S01–S03 against the session's seed | **Match: 0 mismatches** |
| **PUZZLE-04 hub replay**: `experiments/puzzle-04/zero-call/hub-baseline-trees.json` (the gate hub, layers on, over 25 baseline sessions) | Per step: the keys the hub shows and keeps open; per session: the Stop block, the final open keys and the P6 `check_file` answer | **Match: 0 mismatches in 150 comparisons.** The hub flags the final trees P1 5/5, P2 4/5, P3r 0/5, P5 5/5 and P6 5/5, as in `Docs/DiagnosticRuns/puzzle-04-2026-10-23.md` (research-log entry 18). Hub p50 99 ms, p95 179 ms on this machine (timings are not compared) |

**What this does not cover.**
- The frozen half of the DRIFT-01 scorer (D_frozen) is not re-run. It needs the skeleton install, and it is not what
  moved. Its recorded identities enter D_v15 only through the frozen ∪ v1.5 union, and are 0 in every cell.
- The PUZZLE-04 gate's live event log (keys shown edit by edit) cannot be replayed. Only step snapshots are stored.
- The S3 facts are not re-derived on the 13 human DDD repositories, whose clones live outside the repository. They are
  covered by the unit tests only.

Scripts: `experiments/v15-stage0/regress-drift01.ts` (`--set pilot|rescore`, `--engine src|prototype`),
`regress-puzzle04.ts` and `zero-call-check-src.ts` (the PUZZLE-04 hub replay with the `src/` imports). Records:
`experiments/v15-stage0/results/`.

## 5. Status

- Stage 0 items 1 and 2: done on this branch.
- Stage 0 item 3 (the scripted S4 confinement check on the edit gate): open.
- v1.5 tag: not made, by instruction. It follows the combined delivery mode and the packaging of the rule files.
- Pending author rulings, unchanged: P1-SG1-c, P2-SG1-e, P5-SG2-a. Under P2-SG1-e, the PUZZLE-04 gate P2 count would
  be 5/5.
- Full jest suite (`jest --maxWorkers=2`): see §6.

## 6. Full suite

`jest --maxWorkers=2` over the whole repository, in this worktree:
- **Suites:** 524 pass, 32 fail, 3 skipped.
- **Tests:** 7,156 pass, 186 fail, 59 skipped.

**The 3 new suites (25 tests) pass.**

**None of the 32 failing suites imports or reads anything this change touches.** Their names are under
`tests/unit/scripts/mutation/`, `scripts/v1.3/`, `scripts/u5b/`, `scripts/sdd/`, `scripts/generators/`, `cli/`,
`ddd/`, `post-seal/` and `shared/process/`. Those test files contain no reference to `p2-loyalty`, `p5-ferry`,
`puzzle-0`, `v15-instrument` or `mcp:v15`.

**The failures look like this worktree's environment.** The sampled ones fail on a missing `node_modules` path. This
worktree has no local `node_modules`: modules resolve from a parent directory, and type roots do not. That is the same
cause as the `verify.ts` type-check failure in §1. This is not confirmed by a run on `main` in the same worktree. The
CI run on the pull request is the check.
