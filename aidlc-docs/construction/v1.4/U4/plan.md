# U4 code-generation plan: violation identity (C1e) and the drift metric D (C5)

**Design:** `aidlc-docs/construction/v1.4/U4/functional-design/design.md`. Rule ids (ID-n, DR-n, D-n) and test ids (T-xx, R1–R3) refer to it.
**Map parts:** C1e (P1), C5 (P4). **Build list:** `ops/03-build-list.md` rows C1e and C5.
**Brownfield:** this unit adds new files only. It edits no existing source file.
This plan is the single source of truth for the unit's code generation. Mark each step `[x]` in the same interaction that completes it.

## Unit context

- **Depends on.** These existing modules are imported and not changed:
  - `scripts/v1.3/lib/fixes-mined.ts`: `violationKey`, `violationEdges`, `violationFiles`, `canonicalCycle`, `classifyDisappearance`, `kaplanMeier`, `seededRandom`;
  - `scripts/lib/loop/types.ts`: `BlockingFinding`, `StepRecord`;
  - `scripts/lib/canonical-json.ts`.
- **Committed data read** (read-only): `results/v1.3-fixes-mined/{corpus.json,summary.json}`, `results/v1.3-fixes-mined/repos/*/{walk.json,pairs.json.gz,lineages.json.gz}`, `results/v1.3-floor-probe/*/none/step-NN.json`.
- **Used by, later:** a Study 2 drift analysis after the dated deviation (Q6), and a C5 exploratory brownfield study.

## Hard constraints for every step

- No model or external API call. No Neo4j. Jest runs with `--maxWorkers=2`.
- Never read `daedalus-sealed/`, `.env` or any credential or config directory.
- Do not edit:
  - `ops/`, `aidlc-docs/audit.md` or `aidlc-docs/aidlc-state.md`;
  - `scripts/v1.3/lib/fixes-mined.ts`, `scripts/v1.3/fixes-mined-run.ts` or `scripts/v1.3/fixes-mined-report.ts`;
  - `scripts/v1.3/drift-descriptive.py`;
  - `scripts/lib/loop/pilot-metrics.ts` or `scripts/v1.3/lib/study2-analysis.ts`;
  - any `Docs/v1.3/study2-*.md` file, `Docs/v1.3/pilot-outcome-memo.md`, or `scripts/v1.3/protocol-consistency-check.mjs`;
  - the published sources the regressions pin: `Docs/DiagnosticRuns/v1.3-validity-fixes-mined-2026-10-16.md`, `Docs/DiagnosticRuns/v1.3-drift-descriptive-2026-10-18.md`, and anything under `results/v1.3-fixes-mined/` or `results/v1.3-floor-probe/`. The left-censoring finding (Q8) is reported in the unit summary, not patched into them.
- No git operations on this repo except read-only `git status` and `git diff --stat`. The only git calls in the code are the local ones in `scripts/lib/drift/git-rename.ts`, exercised only on a throwaway repo under the OS temp directory (T-GR). Repo-relative paths in all docs and comments. No billing figures.

## Steps

### Step 1: Contracts
- [ ] Create `scripts/lib/drift/types.ts` with the §3 types: `IdFinding`, `Snapshot`, `RenameMap`, `Transition`, `IdentityOptions`, `Cause`, `Lineage`, `DriftParams`, `DriftRun`.
- [ ] Add the presets `LEGACY_FIXES_MINED` (with `leftCensor: 'grid-index-0'`), `G08_PROPOSED`, `STUDY2_S2D01` and `MEMO_COMPAT` (`grain: 'memo'`) as frozen objects. Each docstring cites its source note (G08, S2D-01, `Docs/v1.3/pilot-outcome-memo.md` §3). `IdFinding` carries optional `template` and `ruleName` (D-8); `Transition` carries `renameDetection` (ID-9).
- [ ] Put the D construct string as a constant (D-3), with a docstring citing REV-03 finding 3.

### Step 2: Rename map parser (ID-9)
- [ ] Create `scripts/lib/drift/rename-map.ts` with `parseNameStatus(text: string, rootPrefix: string): { rename: RenameMap; deleted: Set<string>; changed: number; renamedOrDeleted: number }`.
  - It handles R, C, D, A and M rows; a C row is not a rename.
  - It strips the prefix and counts `changed` and `renamedOrDeleted` exactly as `nameStatus` in `scripts/v1.3/fixes-mined-run.ts` does. Unlike `nameStatus`, it keeps the R row's destination (the walker drops it).
  - It returns `outOfRoot`, the old paths whose destination lies outside the prefix (ID-10).
- [ ] Create `scripts/lib/drift/git-rename.ts` with `renameMapBetween(clone, a, b, historyPath, rootPrefix)`. It is the only I/O in the unit: `spawnSync('git', ['diff','--name-status','-M50%','-l5000',a,b,'--',historyPath])`, with no network. It reads stderr and returns `renameDetection: 'skipped'` when git reports that rename detection was skipped (ID-9).
- [ ] Create `tests/unit/scripts/drift/rename-map.test.ts` (T-RN): an R087 row, a C row, a D row, prefix stripping, a rename out of the root, empty output.
- [ ] Create `tests/unit/scripts/drift/git-rename.test.ts` (T-GR): a throwaway repo under `os.tmpdir()` (`git init`, commit, `git mv`, commit; local only, the DaedalusArch repo's own git state is never touched), plus a stderr fixture for the skipped-detection warning. Skip with a note if `git` is missing.

### Step 3: Identity (ID-1 to ID-8)
- [ ] Create `scripts/lib/drift/identity.ts` with:
  - [ ] `fineKey(f: IdFinding): string`, delegating to `violationKey` (ID-3);
  - [ ] `edgeKeys(f, opts): string[]` for the three `cycleIdentity` modes and `edgeOnly` (ID-5 to ID-7);
  - [ ] `mapFinding(f, ρ): IdFinding`, which maps `filePath`, `target`, comma-list cycle members and JSON-array cycle discriminators, leaves other discriminator entries alone, and re-canonicalises cycles (ID-10). Keys are never string-mapped;
  - [ ] `memoKey(f)`, reproducing `findingIdentity` from `scripts/lib/loop/pilot-metrics.ts` (D-8);
  - [ ] the adapters `fromMined`, `fromBlockingFinding` (with the ID-4 fallback and the `cycleMembersKnown: false` flag; it takes optional report violations for full cycle members) and `fromProbeFinding` (`{rule, file, target}` from `results/v1.3-floor-probe/*/step-NN.json`);
  - [ ] `assertSameContext(snapshots)` (ID-1).
- [ ] Create `tests/unit/scripts/drift/identity.test.ts` (T-ID):
  - [ ] parity with `violationKey` on the fixture cases of `tests/unit/scripts/v1.3/fixes-mined.test.ts`;
  - [ ] adapter round trip on every `introduced` or `disappeared` record of the 36 committed `results/v1.3-fixes-mined/repos/*/pairs.json.gz`: for non-cycle records, rebuilding the discriminator from the key's fourth segment (an adapter check only; say so in the test name); for the FF-S02 cycle records, rebuilding the key from the comma-list `filePath` through `canonicalCycle`. Assert the cycle record count is 2,239 and every one matches (both observed in review). Read one repo at a time;
  - [ ] `memoKey` equals `findingIdentity` on hand-built `BlockingFinding`s, cycle and non-cycle;
  - [ ] `mapFinding` on a path containing `#`, a JSON cycle discriminator, and a class-name discriminator that must not change;
  - [ ] FF-S01 and FF-S03 on one edge give one edge key;
  - [ ] the three cycle modes;
  - [ ] the G08 §2.5 example 3 rotation case;
  - [ ] a rename that changes the smallest cycle node;
  - [ ] the degraded-key flag.

### Step 4: Lineage builder (ID-9 to ID-19)
- [ ] Create `scripts/lib/drift/lineage.ts` with `buildLineages(snapshots, transitions, opts, keyFn?)`:
  - [ ] skip failed snapshots (ID-13);
  - [ ] match through ρ under `continue` and record `renamedAt`; under `end`, use the legacy RENAMED close; under both, a rename out of the root ends with RENAMED (ID-10);
  - [ ] count transitions with `renameDetection: 'skipped'` in the output (ID-9);
  - [ ] accept a key function returning `string[]`, so one K can feed several E lineages under `explode-edges` (ID-8);
  - [ ] causes through `classifyDisappearance`: with ρ-mapped inputs and an empty `renamedFrom` under `continue`, unchanged under `end` (ID-11);
  - [ ] MASS-OR-BOT only through `transition.massOrBot`, never in matching (ID-12);
  - [ ] the split rule (ID-14);
  - [ ] RE-POINTED with `derivedFrom` (ID-15), behind `opts.rePointed`;
  - [ ] cycle split and merge `derivedFrom` (ID-16, ID-18);
  - [ ] MERGED, with the earliest birth winning and the smallest key breaking ties (ID-17), behind `opts.merged`;
  - [ ] `filesStay` at the end, as the walker computes it.
- [ ] Create `tests/unit/scripts/drift/lineage.test.ts` (T-LN):
  - [ ] G08 cases S1, S2, S3, S4, M1, M2, M3 and M4, each under `LEGACY_FIXES_MINED` and `G08_PROPOSED`, with the expected outcome tables written from G08 §2.3 and §2.4;
  - [ ] G08 §2.5 examples 1 and 2;
  - [ ] a failed middle snapshot;
  - [ ] a mass commit that keeps identity;
  - [ ] a `contextId` mismatch that throws;
  - [ ] a hand-built 6-point grid where the legacy preset reproduces the born, ended and cause values that `lineages()` in `scripts/v1.3/fixes-mined-run.ts` would give (expected values derived by reading that function, written into the test).

### Step 5: Drift measures over a sequence (DR-1 to DR-7)
- [ ] Create `scripts/lib/drift/metrics.ts` with:
  - [ ] `readMinedLineages(repoDir)`: gzip JSON to `Lineage[]` plus the grid, plus the capped flags from `pairs.json.gz` (`childByRule['FF-S02'] >= s02Cap`);
  - [ ] `survival(lineages, gridDates, pick, capped, { leftCensor, firstValid, movesCensored })`, a faithful port of `survival()` in `scripts/v1.3/fixes-mined-report.ts` under `leftCensor: 'grid-index-0'` (only `born === 0` dropped; the cap rule on a point or the one before it; `filesStay` share), using `kaplanMeier` (DR-2, DR-4, ID-19). `first-valid` also drops lineages born at the repo's first `childOk` grid point (S1); `movesCensored` turns endings with `filesStay === false` into censored observations (S2, DR-8);
  - [ ] `SURVIVAL_GROUPS_5A`, the eight named predicates matching `sg` in `scripts/v1.3/fixes-mined-report.ts`, and `SURVIVAL_GROUPS_C5`, the two extra C5 §4 groups ("blocking, all", "blocking, file-level") (DR-5);
  - [ ] `windowCounts(lineages, ok, capped, blockingPred)`, giving births, endings, in place, without FF-S02 and persisting per grid point (DR-1, DR-2, DR-7);
  - [ ] `pairCounts(pairRecords, blockingPred, s02Cap)`, giving introduced split three ways, removed by cause, credited, and the net check (DR-3, DR-6), ported from `analyse()` in `scripts/v1.3/drift-descriptive.py`;
  - [ ] `isBlocking(rule, style)`, delegating to `ruleTier` in `src/scoring-engine/rule-tiers.ts`, for new data only. `windowCounts` and `pairCounts` take the record's stored `tier` on committed data (DR-3a). A test compares the stored tier, the Python `BLOCKING` set and the live table and **reports** any difference without failing R1/R2 (0 of 6,647 pair records differed in review).
- [ ] Create `tests/unit/scripts/drift/metrics.test.ts` (T-MX): small synthetic grids, both `leftCensor` modes on a grid whose point 0 failed, `movesCensored`, the cap rule, persisting counts, and seeded-random property checks (introduced − removed = child − parent; rotation invariance; `continue` equals `end` when ρ is empty; E lineages ≤ K lineages under `edge-set` and `sorted-files`, and ≤ Σ edges(K) under `explode-edges`).

### Step 6: Regression against published numbers (R1, R2)
- [ ] Create `tests/unit/scripts/drift/survival-regression.test.ts`.
- [ ] **R1.** For all entries of `results/v1.3-fixes-mined/corpus.json` that have a `walk.json`, pool the eight `SURVIVAL_GROUPS_5A` and assert the §5a table of `Docs/DiagnosticRuns/v1.3-validity-fixes-mined-2026-10-16.md` exactly. The expected rows are written as constants in the test:

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

  Run with `LEGACY_FIXES_MINED` (`leftCensor: 'grid-index-0'`) and stored tiers. Also assert the raw `km.median` and `km.s365` against `results/v1.3-fixes-mined/summary.json` `survival[]` to within 1e-12. Load one repo at a time through a shared loader (about 25 MB decompressed in all).
- [ ] **S1 and S2 sensitivity rows** (DR-8), pinned to the review's independent replication, as n / ended / median / S(365):

  | group | S1 first-valid | S2 moves censored |
  |---|---|---|
  | blocking, edge-shaped | 2361 / 840 / 1561 / 0.707 | 2413 / 390 / > obs. / 0.842 |
  | blocking, edge-shaped, without FF-S02 | 2029 / 621 / > obs. / 0.759 | 2080 / 279 / > obs. / 0.877 |
  | blocking FF-S02 only | 332 / 219 / 150 / 0.370 | 333 / 111 / > obs. / 0.601 |
  | unflagged cross-layer import edges | 10863 / 3553 / > obs. / 0.747 | 11211 / 1197 / > obs. / 0.912 |
  | blocking, all (C5) | 2727 / 964 / > obs. / 0.717 | 2785 / 449 / > obs. / 0.850 |
  | blocking, file-level (C5) | 366 / 124 / > obs. / 0.781 | 372 / 59 / > obs. / 0.901 |

  If the TS port disagrees, record the difference and its cause in the unit summary. Do not adjust the expected values to make the test pass, and never print S1 or S2 in place of a published figure.
- [ ] **R2.** Assert the C5 descriptive pooled figures from `Docs/DiagnosticRuns/v1.3-drift-descriptive-2026-10-18.md` as constants:
  - windows: births 2785, endings 1288, in place 543; without FF-S02, 2452 / 975;
  - pairs: valid 4640, introduced 802 (bot/mass 448, rename-matched 24, new 330), removed 265 (FILE-DELETED 106, RENAMED 52, MASS-OR-BOT 19, RESOLVED-IN-PLACE 7, FIXED-BY-DEV 74, OTHER 7), net check failures 0;
  - the six KM rows of the note's §4 (for example, blocking all 2785 / 1002 / 1561 / 0.719 and file-level 372 / 128 / > obs. / 0.779, through `SURVIVAL_GROUPS_C5`; all six reproduced in review under `grid-index-0`).
  If a §4 row disagrees by the `t > 365` versus `t <= 365` convention, record which convention the note used, and pin both the note's figure and the TS figure with a comment. Do not edit the note.
- [ ] Run `npx jest --maxWorkers=2 tests/unit/scripts/drift` and record the pass in the unit summary.

### Step 7: Study 2's D with Y1 (D-1 to D-8)
- [ ] Create `scripts/lib/drift/study2-d.ts` with:
  - [ ] `driftRun(steps: readonly StepInput[], params: DriftParams, counted?: (f: IdFinding) => boolean): DriftRun`.
    - `StepInput` is `{ step, final: Snapshot | null, turns?: Snapshot[], newSlices?: number, rename?: RenameMap }`.
    - `StepInput` also takes optional `addedKloc`. The run carries `runId`, `blockId` and `cell`.
    - It implements Y1 and Y1fine (D-1), D with both `priorUnion` modes carried through ρ and `renameMapMissing` (D-2), the construct field (D-3), `eligible` (D-4), the secondaries (D-6: `Yk`, `DperStep`, `DperAddedKloc`, D by group and leave-one-family-out, inherited removal, D per new slice, steps to the first new identity) and missing-data handling (D-7).
    - `params` is echoed into the output.
  - [ ] `aggregateD(runs, { conditionOnY1: 'exclude' | 'report-only' })`, which groups by `blockId`, throws if Y1 differs across the cells of one block (D-4), and returns kept runs, excluded runs, the Y1 = 0 block count and ΣD per cell. It runs no test statistic; inference stays in the Study 2 analysis.
  - [ ] `y1Gate(runs, { minEligible, ofRuns, y1Min })` (D-5).
  - [ ] `fromProbeStepFile(json)` and `fromStepRecord(StepRecord)` loaders. They are pure and take parsed JSON.
- [ ] Create `tests/unit/scripts/drift/study2-d.test.ts`:
  - [ ] **R3.** From `results/v1.3-floor-probe/{market-vendors,youth-league,hive-health}/none/step-NN.json`, with the `STUDY2_S2D01` edge key, `final-snapshots` and an empty ρ: D = 1, 2, 5; Y1 = 2, 2, 4; per-step new counts [0, 0, 1], [2, 0, 0, 0], [3, 2, 0, 0]; market-vendors `incomplete: true`. Under the fine key: D = 2, 2, 7 and Y1fine = 4, 3, 6. `contextId` is built from the files' `spec`, `engine`, `instrumentVersion` and `scoringMode`;
  - [ ] the three Hexagonal `none` runs (food-bank, garden-plots, shelter-adoptions): Y1 = 0, D = 0, `eligible: false` (the real-data Y1 = 0 case);
  - [ ] `aggregateD` throws on two cells of one block with different Y1;
  - [ ] Y1 = 0 run: `eligible: false`, excluded under `exclude`, kept and flagged under `report-only`, counted in both;
  - [ ] `y1Gate` at 4 of 6;
  - [ ] a null step makes D null, and the next step is `afterUnscored`;
  - [ ] the `counted` predicate drops a finding;
  - [ ] D per new slice is null without `newSlices`;
  - [ ] `inheritedRemoved` and `DnoInheritedRemoval`;
  - [ ] a rename between steps is not new under `continue` and is new under `end`;
  - [ ] **T-MC:** `MEMO_COMPAT` equals `runOutcomes().newBlockingTotal` from `scripts/lib/loop/pilot-metrics.ts` on a hand-built `StepRecord[]`, and the documented case where the S2D-01 key and the memo key differ (a cycle reported from another start node).

### Step 7b: The C1e part test (T-HC)
- [ ] Create `scripts/lib/drift/handcheck.ts` with `handcheckSample(pairsByRepo, { seed, perCause })`: seeded with `seededRandom`, stratified by cause, up to `perCause` (10) rows per cause, each row with repo, commit link, rule, files, assigned cause and empty `sameViolation` and `causeRight` columns.
- [ ] Create `tests/unit/scripts/drift/identity-errors.test.ts`:
  - [ ] about 40 planted transitions (renames, deletions, bot and mass commits, re-pointed edges, cycle rotations, splits, merges, an out-of-root rename, a failed snapshot), each expected outcome written before the code: identity errors = 0 under `LEGACY_FIXES_MINED` and `G08_PROPOSED`;
  - [ ] `handcheckSample` is deterministic for seed 20261018 and covers every cause present in the pairs.

### Step 8: Barrel and entry file
- [ ] Create `scripts/lib/drift/index.ts`, re-exporting the public API.
- [ ] Create `scripts/v1.4/drift-check.ts`, an entry file with no exports and a usage docstring. It runs R1's table, R2's counts, the S1 and S2 rows and R3's D/Y1 from committed data. It writes `results/v1.4-drift-check/summary.json` through `scripts/lib/canonical-json.ts`, with every figure beside its params and source path and the S1/S2 rows labelled `sensitivity`, and writes the hand-check packet `results/v1.4-drift-check/identity-handcheck.csv`. It exits non-zero if any published figure (R1, R2, R3) differs; S1/S2 differences from the review values are reported, not fatal. Zero calls, no Neo4j, one process.
- [ ] Run it once with `npx tsx scripts/v1.4/drift-check.ts`. Confirm exit 0 and note the wall time.

### Step 9: Static checks
- [ ] `npx tsc -p tsconfig.scripts.json --noEmit` passes for the new files. Fix only new-file errors; pre-existing errors elsewhere are noted, not touched.
- [ ] `npx eslint scripts/lib/drift scripts/v1.4/drift-check.ts tests/unit/scripts/drift` is clean.
- [ ] `npx jest --maxWorkers=2 tests/unit/scripts/drift tests/unit/scripts/v1.3/fixes-mined.test.ts tests/unit/scripts/loop/pilot.test.ts` passes. The last two suites show the imported modules are unchanged. `git status --short` (read-only) lists only the new files of this plan.
- [ ] `node scripts/v1.3/protocol-consistency-check.mjs` passes (read-only), showing the registered Study 2 protocol line is untouched.

### Step 10: Unit summary (documentation only)
- [ ] Create `aidlc-docs/construction/v1.4/U4/code/summary.md`, covering:
  - files created;
  - the test list with pass counts;
  - R1, R2 and R3 results;
  - the `drift-check` output path;
  - the S1 and S2 sensitivity rows, labelled as such, and the left-censoring finding for Q8;
  - the hand-check packet path and its size, for Q9;
  - the defaults chosen for Q1–Q8 as **provisional** (presets, not decisions);
  - the explicit list of registered files left untouched.
- [ ] Validate the summary's Markdown per `.aidlc-rule-details/common/content-validation.md`: tables, no Mermaid, repo-relative paths.

## Traceability

| Design rule | Step | Test |
|---|---|---|
| ID-1 to ID-8 | 3 | T-ID |
| ID-9 | 2 | T-RN, T-GR |
| ID-10 to ID-19 | 4, 5 | T-LN, T-MX |
| DR-1 to DR-8 | 5, 6 | T-MX, R1, R2, S1, S2 |
| D-1 to D-8 | 7 | R3, T-MC |
| C1e part test (north star) | 7b, 8 | T-HC, `identity-handcheck.csv` |
| Publication parity | 6, 8 | R1, R2, R3, `scripts/v1.4/drift-check.ts` |

**Scope:** 9 new source files under `scripts/lib/drift/`, 8 new test files under `tests/unit/scripts/drift/`, one entry file, and two new output files under `results/v1.4-drift-check/`. No existing file is edited.
