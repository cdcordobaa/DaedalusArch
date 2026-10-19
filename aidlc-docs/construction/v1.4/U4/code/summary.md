# U4 code summary: violation identity (C1e) and the drift metric D (C5)

**Cycle:** AI-DLC v1.4, instrument alignment, code generation (Part 2). **Depth:** minimal.
**Design:** `aidlc-docs/construction/v1.4/U4/functional-design/design.md`. **Plan:** `aidlc-docs/construction/v1.4/U4/plan.md`, with every step ticked.
**Branch:** `v14/u4-identity-drift`. No model or API call was made, Neo4j was not started, and Jest ran with `--maxWorkers=2`.

---

## 1. What was built

The unit adds new files only. It edits no existing file.

| File | Role |
|---|---|
| `scripts/lib/drift/types.ts` | §3 contracts; presets `LEGACY_FIXES_MINED`, `G08_PROPOSED`, `STUDY2_S2D01`, `MEMO_COMPAT`; the construct constant `D_CONSTRUCT` (D-3) |
| `scripts/lib/drift/identity.ts` | `fineKey` (delegates to `violationKey`), `edgeKeys` (three cycle modes, `edgeOnly`), `memoKey`, `keysFor`, `mapFinding` (applies ρ to the finding, never to a key), adapters `fromMined`, `fromBlockingFinding`, `fromProbeFinding`, and `assertSameContext` |
| `scripts/lib/drift/rename-map.ts` | `parseNameStatus`: a pure parser of `git diff --name-status` (R, C, D, A, M rows; prefix strip; `outOfRoot`) |
| `scripts/lib/drift/git-rename.ts` | `renameMapBetween`, the only I/O (local git), and `renameDetectionFromStderr` (ID-9) |
| `scripts/lib/drift/lineage.ts` | `buildLineages`, implementing ID-9 to ID-19 |
| `scripts/lib/drift/metrics.ts` | committed-data readers, `survival` (DR-2, DR-4, ID-19, S2), `kmRow`, `SURVIVAL_GROUPS_5A`, `SURVIVAL_GROUPS_C5`, `windowCounts`, `pairCounts`, `storedTierMap`, `isBlocking` |
| `scripts/lib/drift/regression.ts` | the published R1 and R2 constants, the review's S1 and S2 values, `computeMinedRegression` and `compareMined`. The test and the entry file share it (see §8) |
| `scripts/lib/drift/study2-d.ts` | `driftRun`, `aggregateD`, `y1Gate`, and the loaders `fromProbeStepFile` and `fromStepRecord` (D-1 to D-8) |
| `scripts/lib/drift/handcheck.ts` | `handcheckSample` and `handcheckCsv`: the C1e hand-check packet |
| `scripts/lib/drift/index.ts` | re-exports |
| `scripts/v1.4/drift-check.ts` | entry file (zero calls, no Neo4j, one process) |
| `tests/unit/scripts/drift/*.test.ts` | eight suites (§2), plus the shared builders in `tests/unit/scripts/drift/fixtures.ts` |
| `results/v1.4-drift-check/summary.json` | entry-file output (canonical JSON) |
| `results/v1.4-drift-check/identity-handcheck.csv` | the hand-check packet for the author, with the label columns empty |

## 2. Tests

Command: `npx jest --maxWorkers=2 tests/unit/scripts/drift tests/unit/scripts/v1.3/fixes-mined.test.ts tests/unit/scripts/loop/pilot.test.ts`. Result: **10 suites and 176 tests passed**. The drift suites alone give 8 suites and 132 tests.

| Id | Suite | Tests | What it pins |
|---|---|---:|---|
| T-RN | `rename-map.test.ts` | 6 | R087, C, D/A/M rows, prefix stripping, out-of-root rename, empty diff |
| T-GR | `git-rename.test.ts` | 2 | a throwaway repo under the OS temp directory with one `git mv`; the stderr "rename detection was skipped" fixture |
| T-ID | `identity.test.ts` | 28 | `violationKey` parity; the round trip on all 6,647 committed pair records (4,408 non-cycle as an adapter check, and all **2,239 FF-S02 cycle keys** rebuilt from the comma list); E modes; `mapFinding` (`#` paths, JSON discriminator, class-name discriminator left alone, re-canonicalisation); `memoKey` equals `findingIdentity`; the degraded flag; ID-1 |
| T-LN | `lineage.test.ts` | 23 | G08 S1–S4 and M1–M4 under both presets; §2.5 examples 1–3; failed middle snapshot; mass commit; out-of-root rename; skipped detection counted; context mismatch; explode-edges (ID-8); the legacy preset against a hand-derived `lineages()` result on a 6-point grid |
| T-MX | `metrics.test.ts` | 18 | survival and both `leftCensor` modes, S2, the cap rule, `kmRow`; window counts and persisting (DR-1); pair counts; seeded properties (rotation invariance; introduced − removed = child − parent; `continue` = `end` with an empty ρ; E ≤ K, and ≤ Σ edges(K) under explode-edges) |
| R1, R2, S1, S2 | `survival-regression.test.ts` | 28 | §5 and §6 below |
| R3, T-MC | `study2-d.test.ts` | 22 | §5 below, and the D rules (null propagation, `afterUnscored`, `counted`, per-slice, per-KLOC, inherited removal, renames under both policies, per-group, Y1 gating both ways, `aggregateD` throwing, `y1Gate` at 4 of 6) |
| T-HC | `identity-errors.test.ts` | 5 | the C1e part test (§4) |

Static checks:
- `npx tsc -p tsconfig.scripts.json --noEmit`: 0 errors.
- ESLint: clean (0 errors, 0 warnings) when run against `tsconfig.scripts.json`; see deviation 5 in §8.
- `node scripts/v1.3/protocol-consistency-check.mjs`: OK, 9 documents agree.

## 3. Entry file

`npx tsx scripts/v1.4/drift-check.ts` exits 0 in about 1 s of wall time (0.4 s of compute). It writes `results/v1.4-drift-check/summary.json`, where every figure sits beside its params and source path and S1 and S2 are labelled `sensitivity`, and `results/v1.4-drift-check/identity-handcheck.csv`. A second run gives a byte-identical `summary.json`.

## 4. The C1e part test (T-HC)

- **Planted histories:** 43 transitions across 41 cases, each expected outcome written in the test first. The cases cover renames, deletions, bot and mass commits, re-pointing, rotations, splits, merges, a swap, a rename chain, an out-of-root rename, a failed snapshot, a `#` path and a class-name discriminator. **Identity errors = 0 under `LEGACY_FIXES_MINED` and under `G08_PROPOSED`.**
- **Hand-check packet (for Q9):** `results/v1.4-drift-check/identity-handcheck.csv` has **54 rows**, from blocking disappearances on valid pairs, with seed 20261018 and up to 10 per cause. It holds 10 each for RENAMED, FILE-DELETED, MASS-OR-BOT and FIXED-BY-DEV, and 7 each for RESOLVED-IN-PLACE and OTHER, the whole population of those two causes. Each row carries the repo, the commit link, the rule, the files, the target, the key and the assigned cause. The columns `sameViolation` and `causeRight` are empty for the author. Until they are labelled, the C1e part test reports the planted-case result only.

## 5. Regression results

**R1** (`Docs/DiagnosticRuns/v1.3-validity-fixes-mined-2026-10-16.md` §5a): all eight rows reproduce **digit for digit** under `LEGACY_FIXES_MINED` (`leftCensor: 'grid-index-0'`) with stored tiers. The raw `km.median` and `km.s365` match `results/v1.3-fixes-mined/summary.json` to 1e-12.

| group | lineages | ended | median | S(365) | in place |
|---|---:|---:|---|---:|---:|
| blocking, edge-shaped findings | 2413 | 874 | 1561 | 0.709 | 44.62 % |
| blocking, edge-shaped, without FF-S02 cycles | 2080 | 654 | > obs. | 0.760 | 42.66 % |
| blocking FF-S02 cycles only | 333 | 220 | 150 | 0.373 | 50.45 % |
| advisory, edge-shaped findings | 35 | 13 | > obs. | 0.873 | 38.46 % |
| advisory, file-level findings | 11436 | 3250 | > obs. | 0.774 | 33.26 % |
| unflagged cross-layer import edges | 11211 | 3790 | > obs. | 0.746 | 31.58 % |
| unflagged same-layer import edges | 18306 | 6073 | > obs. | 0.754 | 37.81 % |
| unflagged import edges, unlayered file | 28639 | 16943 | 339 | 0.490 | 27.96 % |

**R2** (`Docs/DiagnosticRuns/v1.3-drift-descriptive-2026-10-18.md`): every figure reproduces exactly.
- Grid windows: births 2,785, endings 1,288, 543 of them in place. Without FF-S02: 2,452 births and 975 endings.
- Pairs: 4,640 valid. Introduced 802 (448 in a bot or mass commit, 24 rename-matched, 330 new). Removed 265 (FILE-DELETED 106, RENAMED 52, MASS-OR-BOT 19, RESOLVED-IN-PLACE 7, FIXED-BY-DEV 74, OTHER 7). Net-check failures: 0.
- KM: all six §4 rows, including "blocking, all" 2785 / 1002 / 1561 / 0.719 and "blocking, file-level" 372 / 128 / > obs. / 0.779.
- The Python `t > 365` and TS `t <= 365` conventions agree on all six rows, so no dual pin was needed.

**R3** (`results/v1.3-floor-probe/*/none/step-NN.json`, ρ empty): all values match.

| run | edge key: D, Y1, new per step | fine key: D, Y1fine | note |
|---|---|---|---|
| market-vendors | 1, 2, [0, 0, 1] | 2, 4 | 4 steps, so `incomplete: true` |
| youth-league | 2, 2, [2, 0, 0, 0] | 2, 3 | |
| hive-health | 5, 4, [3, 2, 0, 0] | 7, 6 | |
| food-bank, garden-plots, shelter-adoptions | 0, 0, all 0 | 0, 0 | Hexagonal runs: `eligible: false`, the real-data Y1 = 0 case |

**T-MC:**
- `MEMO_COMPAT` equals `runOutcomes().newBlockingTotal` on hand-built step records, both with a repair turn and with an unscored step.
- They differ in the documented case, a cycle reported from another start node. There the memo counts 1, the S2D-01 key counts 0 when the report violations supply the cycle members, and the S2D-01 key counts 1 when it falls back to the degraded key, which is flagged.

**DR-3a tier check (reported, not gating):**
- Stored tier against the live `ruleTier` table: 0 differences of 6,647 pair records and 0 of 27,579 finding lineages.
- Stored tier against the Python `BLOCKING` set: 0 differences.
- No conflicts, and no live-table fallback was needed.

## 6. Sensitivity rows (DR-8), labelled as sensitivity

**Sensitivity only.** These rows are printed beside the published figures and never in place of them. They agree with the review's independent replication in every row.

| group | S1 first-valid (n / ended / median / S365) | S2 moves censored (n / ended / median / S365) |
|---|---|---|
| blocking, edge-shaped | 2361 / 840 / 1561 / 0.707 | 2413 / 390 / > obs. / 0.842 |
| blocking, edge-shaped, without FF-S02 | 2029 / 621 / > obs. / 0.759 | 2080 / 279 / > obs. / 0.877 |
| blocking FF-S02 only | 332 / 219 / 150 / 0.370 | 333 / 111 / > obs. / 0.601 |
| unflagged cross-layer import edges | 10863 / 3553 / > obs. / 0.747 | 11211 / 1197 / > obs. / 0.912 |
| blocking, all (C5) | 2727 / 964 / > obs. / 0.717 | 2785 / 449 / > obs. / 0.850 |
| blocking, file-level (C5) | 366 / 124 / > obs. / 0.781 | 372 / 59 / > obs. / 0.901 |

**Left-censoring finding, for Q8.** In 10 of the 36 repositories, grid point 0 failed. The published tables therefore count the state at the first valid point as births:

| repository | first valid point | lineages there | blocking |
|---|---:|---:|---:|
| outline-server | 49 | 1,018 | 112 |
| etherpad | 136 | 100 | 2 |
| neoteric-nestjs-auth | 1 | 108 | 4 |
| budibase-server | 31 | 51 | 0 |
| reactive-resume-api | 1 | 38 | 0 |
| unleash | 1 | 10 | 0 |
| clean-ts-api | 2 | 3 | 0 |
| conduit-ports-adapters | 5 | 2 | 0 |
| talento90-typescript-node | 1 | 1 | 0 |
| pvarentsov-clean | 2 | 0 | 0 |

Under S1, the C5 "blocking, all" median moves from 1,561 days to > obs. The §5a rows barely move (blocking edge-shaped S(365) goes from 0.709 to 0.707). The module does not restate the published tables, and this unit does not edit `Docs/DiagnosticRuns/v1.3-validity-fixes-mined-2026-10-16.md`. Whether to restate or to cite S1 beside the tables is Q8.

## 7. Defaults chosen for Q1–Q8: provisional presets, not decisions

| Q | Provisional default | Where |
|---|---|---|
| Q1 rename policy | `end` for the published regressions (`LEGACY_FIXES_MINED`), `continue` in `G08_PROPOSED` and `STUDY2_S2D01`. No re-walk was done | `scripts/lib/drift/types.ts` |
| Q2 cycle identity in E | `sorted-files` in `STUDY2_S2D01` (the S2D-01 text), `edge-set` in `G08_PROPOSED`; `explode-edges` is available | idem |
| Q3 RE-POINTED and MERGED | off in legacy and in `STUDY2_S2D01`, on in `G08_PROPOSED` | idem |
| Q4 prior union | `final-snapshots` in `STUDY2_S2D01`, `all-turns` in `MEMO_COMPAT` | idem |
| Q5 Y1 conditioning | `y1Min = 1`; `conditionOnY1` has no default, so the caller must choose it; the `y1Gate` thresholds are parameters | `scripts/lib/drift/study2-d.ts` |
| Q6 switching the registered memo code | not done; `scripts/lib/loop/pilot-metrics.ts` and `scripts/v1.3/lib/study2-analysis.ts` are untouched | — |
| Q7 new-slice denominator | caller-supplied `newSlices` per step; null when absent | `StepInput` |
| Q8 left-censoring | `grid-index-0` for R1 and R2, `first-valid` in the new presets; S1 printed beside | §6 |

## 8. Deviations from the design and plan

1. **One extra source file,** `scripts/lib/drift/regression.ts`. It holds the published constants and the recomputation, so the R1/R2 test and `scripts/v1.4/drift-check.ts` check the same thing without a second copy of the constants. There is also one test helper, `tests/unit/scripts/drift/fixtures.ts`, beside the eight suites.
2. **Contract additions** that the rules need but §3 did not list:
   - `Transition.outOfRoot` (ID-10);
   - on `Lineage`: `finalKey` (the key after renames under `continue`), plus `kind`, `functionId` and `edgeKind` for the committed records;
   - on `DriftRun`: `inheritedRemovedPerStep` and `byGroup` (D-6).

   `driftRun` takes a fourth `meta` argument (`runId`, `blockId`, `cell`, optional `groupBy`).
3. **Readings of the design** where it left a choice:
   - A degraded cycle (ID-4) gets the E key "sorted `{filePath, target}`" in every cycle mode.
   - Cycle split and merge `derivedFrom` links (ID-16, ID-18) are added under every preset. They are metadata only and change no born, ended or cause value.
   - RE-POINTED overrides only FIXED-BY-DEV, so a re-pointing in a mass commit stays MASS-OR-BOT.
   - With `merged: false` under `continue`, a merge loser gets its normal classified cause.
   - D is null when step 1 is unscored (D is read against Y1). The memo total does not depend on step 1, so the two differ in that case only.
   - `stepsToFirstNew` is t − 1 for the first step t with a new identity.
   - The hand-check packet takes blocking findings only.
4. **A bug found by the tests and fixed:** `degradedCycleKeys` counted a step's final snapshot twice, because the final is also the last turn. It now counts step-final snapshots only.
5. **ESLint command.** As the plan writes it, `npx eslint scripts/lib/drift scripts/v1.4/drift-check.ts tests/unit/scripts/drift`, the command cannot work in this repository:
   - `tsconfig.eslint.json` does not include `scripts/`, so files that no test imports (`index.ts`, `drift-check.ts`) do not parse;
   - in the script tests, the jest globals do not resolve.

   The existing suites `tests/unit/scripts/v1.3/fixes-mined.test.ts` and `tests/unit/scripts/loop/pilot.test.ts` show the same environment errors (208). I ran ESLint with `--parser-options=project:./tsconfig.scripts.json`, and it is clean. `tsconfig.eslint.json` was not edited.
6. **Untracked C5 sources.** `scripts/v1.3/drift-descriptive.py` and `Docs/DiagnosticRuns/v1.3-drift-descriptive-2026-10-18.md` are untracked in the main tree. They were read there, read-only, and are not part of this branch; the design leaves committing them to the orchestrator. R2 pins their figures as constants.

## 9. Registered and published files left untouched

None of these files was edited:
- `scripts/v1.3/lib/fixes-mined.ts`, `scripts/v1.3/fixes-mined-run.ts`, `scripts/v1.3/fixes-mined-report.ts`
- `scripts/v1.3/drift-descriptive.py`
- `scripts/lib/loop/pilot-metrics.ts`, `scripts/v1.3/lib/study2-analysis.ts`
- every `Docs/v1.3/study2-*.md`, `Docs/v1.3/pilot-outcome-memo.md`, `scripts/v1.3/protocol-consistency-check.mjs`
- `Docs/DiagnosticRuns/v1.3-validity-fixes-mined-2026-10-16.md`, `Docs/DiagnosticRuns/v1.3-drift-descriptive-2026-10-18.md`
- everything under `results/v1.3-fixes-mined/` and `results/v1.3-floor-probe/`
- `ops/`, `aidlc-docs/audit.md`, `aidlc-docs/aidlc-state.md`

A read-only `git status --short` lists only the new paths of this unit.

## 10. Content validation

This file holds tables and lists only. It has no Mermaid and no ASCII diagrams, every path is repo-relative, and it contains no billing figures.

## 11. Integration follow-up (before merge, 2026-10-18)

From the AI-DLC read-only verification of U4:

- **Results guard.** `results/v1.4-drift-check/**` is allowed by the v1.4 extension of `V13_RESULTS_DIR_PATTERN` (`tests/golden/check-changes-log.ts`, merged with U2 in PR #255, citing the v1.4 AI-DLC cycle). The v1.2E rules are unchanged.
- **Explode-edges successor bug fixed.** Under `cycleIdentity: 'explode-edges'` with `renamePolicy: 'continue'`, the successor of an exploded cycle edge was chosen by its position in the key list, and `canonicalCycle` re-rotates a renamed cycle, so positions shift. `successorKey` (`scripts/lib/drift/identity.ts`) now maps an edge key `u|v` to `ρ(u)|ρ(v)`; `buildLineages` (`lineage.ts`) and `carry` (`study2-d.ts`) both use it. Tests that fail without the fix: `lineage.test.ts` ("explode-edges with a rename") and `study2-d.test.ts` (D = 0 for a renamed cycle sharing an edge with a plain FF-S01).
- **Edge-grain planted cases.** `identity-errors.test.ts` gains seven planted histories on the edge grain, run under `STUDY2_S2D01` (sorted-files cycles) and under its explode-edges option: identity errors = 0 under both.
- **Cited sources.** `scripts/v1.3/drift-descriptive.py`, `Docs/DiagnosticRuns/v1.3-drift-descriptive-2026-10-18.md` and the `ops/notes/` files this unit cites landed on main with PR #252, before this PR.

TODOs (not fixed here):

1. `y1Gate` takes `ofRuns` but never checks `runs.length` against it, so "4 of 6" also passes with 4 of 12 runs (D-5 wording).
2. With `merged: false` under `renamePolicy: 'continue'` (the `STUDY2_S2D01` preset), a merge loser gets a normal cause and can be credited FIXED-BY-DEV or RESOLVED-IN-PLACE, against G08 M1 (declared in §8, item 3). D does not use causes, but a cause tally under that preset would over-credit fixes.
