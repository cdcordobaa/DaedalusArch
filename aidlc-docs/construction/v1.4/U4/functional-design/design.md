# U4 functional design: violation identity (C1e) and the drift metric D (C5)

**Cycle:** AI-DLC v1.4, instrument alignment. **Depth:** minimal (no NFR, infrastructure or user-story stages).
**Map parts:** C1e time and identity (plane P1), C5 drift (plane P4). **Build-list rows:** `ops/03-build-list.md` C1e (line 14) and C5 (line 36).
**Status:** design for review, revised after the adversarial design review of 2026-10-18 (DR-2 left-censoring, DR-3a stored tiers, DR-8 sensitivity rows, ID-8 explode-edges, ID-9 rename-detection limit, ID-10 out-of-root renames, the C1e part test T-HC, the memo grain, the S2D-01 secondaries). No code has been written, no model or API call was made, and Neo4j was not started. The review's figures came from a zero-call Python replication over committed files.

**Inputs read:** `ops/notes/g08-violation-identity.md` (G08), `ops/notes/s2d-01-study2-drift-design.md` (S2D-01), `ops/notes/rev-03-study2-drift-fable.md` (REV-03), `ops/01-instrument-map.md` §5, `Docs/DiagnosticRuns/v1.3-validity-fixes-mined-2026-10-16.md` with `scripts/v1.3/lib/fixes-mined.ts`, `scripts/v1.3/fixes-mined-run.ts` and `scripts/v1.3/fixes-mined-report.ts`, `Docs/DiagnosticRuns/v1.3-drift-descriptive-2026-10-18.md` with `scripts/v1.3/drift-descriptive.py`, `scripts/lib/loop/pilot-metrics.ts`, `scripts/v1.3/lib/study2-analysis.ts`, and the probe-1 step records `results/v1.3-floor-probe/*/none/step-NN.json`.

---

## 1. What the unit delivers

1. **An identity module.** It answers "is violation v at snapshot t the same violation as w at t+1?" under one instrument state and one spec. It does this at two grains (fine key K, edge key E), with a rename map ρ, and with explicit split and merge rules. It reuses the fix-mining key and cause taxonomy and does not replace them.
2. **A lineage builder.** It turns a sequence of snapshots into lineages (born, ended, cause, derived-from links). Every G08 choice is a named parameter, and a `legacy` preset reproduces fix mining.
3. **The drift metrics over a snapshot sequence.** Introduced, removed (by cause), persisting, and Kaplan-Meier survival. These are the C5 descriptive measures, ported from `scripts/v1.3/drift-descriptive.py` and `scripts/v1.3/fixes-mined-report.ts` into one tested TypeScript module.
4. **Study 2's D, as REV-03 renamed it.** D is the **propagation of inherited step-1 blocking patterns to new slices**: the count of new blocking identities at steps 2..k, read against a shared step-1 start. It is computed with **Y1** (the number of inherited step-1 identities) exposed beside it, so that any analysis can gate on Y1 ≥ y1Min. Every choice still under author and director review is a parameter.
5. **Regression checks that pin the module to numbers already published.** These are the fix-mining survival table (§5a, digit for digit), the C5 descriptive headline counts, and probe 1's D = 1, 2, 5.
6. **The C1e part test of `ops/04-north-star.md`** ("histories with renames and deletions; truth: the fix-mining taxonomy, checked by hand; metric: identity errors"). Two halves: an identity-error count on planted synthetic histories whose answers are written first (T-HC, must be 0), and a seeded, stratified hand-check packet of real pair-level disappearances for the author (§5, T-HC). The module produces the packet; it does not label it.
7. **Sensitivity rows for the N123 re-check** that `ops/03-build-list.md` row C1e asks for once U4 lands, computed from committed data only and always printed **beside** the published figure, never in place of it (DR-8). They bracket the rename bias and correct a left-censoring artefact found in review (DR-2).

**Out of scope.** The unit changes no registered Study 2 file. That covers `Docs/v1.3/study2-*.md`, `Docs/v1.3/pilot-outcome-memo.md`, the `study2-protocol` line and `scripts/v1.3/protocol-consistency-check.mjs`, and it also covers `scripts/lib/loop/pilot-metrics.ts` and `scripts/v1.3/lib/study2-analysis.ts`. Those two files implement the registered memo outcome. Switching them to the new identity is the G08 §3 change, and it waits for the dated deviation that REV-03 finding 2 asks for. The unit also does not edit `scripts/v1.3/fixes-mined-run.ts` (a committed study's walker) and does not re-walk any history.

---

## 2. Business rules

Rule ids are cited in the plan and the tests.

### 2.1 Scope of an identity

- **ID-1.** An identity is defined only within one instrument state Θ (catalogue and tiers at a freeze hash, extractor options, engine) and one spec σ. Snapshots compared under different Θ or σ are an input error. The module takes an opaque `contextId` per snapshot and throws if two snapshots in one sequence differ (G08 §2).
- **ID-2.** Paths are POSIX and relative to the analysis root, exactly as the snapshot reports them. The module does not normalise case or extensions.

### 2.2 Fine key K (the fix-mining key, unchanged)

- **ID-3.** K(v) is `violationKey` from `scripts/v1.3/lib/fixes-mined.ts`, imported and not re-implemented:
  - an edge-shaped finding is `rule#source#target#discriminator`, with `IMPORTS` dropped;
  - a cycle is `rule#cycle#<nodes>`, where the nodes are the cycle without its closing repeat, rotated to the smallest path (`canonicalCycle`), so direction is kept;
  - a file-level finding is `rule#file#target-or-package#discriminator`.
  Line, column, message, tier, layer names and template are not part of K.
- **ID-4.** The loop's `BlockingFinding` and the probe's `{rule, file, target}` records go through adapters into the same `MinedViolation` shape. A loop cycle whose member list is not in the finding (no comma-list `filePath`, no JSON discriminator) is keyed from `{filePath, target}` and flagged `cycleMembersKnown: false`. The flag is counted in every output, so a degraded cycle key is never silent (see R4).

### 2.3 Edge key E (the Study 2 unit)

- **ID-5.** An edge-shaped finding maps to `source|target`. FF-S01 and FF-S03 findings on one edge share one E, which matches `EDGE_DEDUP_RULES` in `scripts/v1.3/lib/study2-analysis.ts`.
- **ID-6.** A cycle maps according to the parameter `cycleIdentity`:
  - `edge-set` (G08 default): one identity, the sorted list of the cycle's directed edges;
  - `sorted-files` (the S2D-01 and A7 text): one identity, the sorted file set;
  - `explode-edges`: each directed edge joins E on its own, so a cycle edge already flagged by FF-S01 is not counted twice.
  The default is a pending author decision (Q2).
- **ID-7.** A file-level finding has no E under `edgeOnly: true`, the Study 2 default, because D counts edges only. With `edgeOnly: false`, its E is its K.
- **ID-8.** Each K maps to a **set** of E keys: exactly one under `edge-set` and `sorted-files`, and one per directed edge under `explode-edges`. So E is not a function of K in the explode mode, and one K can feed several E lineages. An E lineage ends only when no live K maps to it (G08 M4). The builder runs on whichever key function it is given (`(f) => string[]`), so this holds by construction.

### 2.4 Same violation across t → t+1

- **ID-9.** ρ is the rename map from t to t+1. It is parsed from the output of `git diff --name-status -M50% -l5000 <t> <t+1> -- <path>`, the command `nameStatus` runs in `scripts/v1.3/fixes-mined-run.ts`. Each `R` row maps old to new. A `C` (copy) row is not a rename: the old path stays. Every other path maps to itself. For grid points more than one commit apart, ρ is one diff between the two points and is never composed per commit. The parser is pure; a separate git wrapper produces its input.
  - **Rename detection can be skipped silently by git.** When a diff exceeds `-l5000`, git prints a warning on stderr and reports the renames as D + A rows. The wrapper reads stderr and sets `renameDetection: 'skipped'` on the `Transition`; the builder counts such transitions in every output, so a lost ρ is never silent. Over a long grid window, a file renamed and then heavily edited can also fall under 50 % similarity; that is a declared limit of the one-diff rule, not a bug.
  - **Source of ρ by data kind:** a git history, through `renameMapBetween` on the clone; a loop run, through the same call on the run's snapshot store between the step-final commits (`TurnRecord.commit`; the store's own `diff` uses `--no-renames`, so it cannot be reused); probe 1, none (its snapshots are plain directories, so ρ is empty and `continue` equals `end` there).
- **ID-10.** The parameter `renamePolicy` takes one of two values:
  - `continue` (G08): w continues v iff K(w) = K(ρ(v)). ρ is applied to the finding before re-keying, never to the key string (paths may contain `#`): to `filePath`, `target`, every member of a comma-list cycle and the members of a JSON-array cycle discriminator. Other discriminator entries (class names, package names) are left as they are. A cycle is re-canonicalised after mapping. The lineage records a `renamed` event at t+1 and does not end.
  - `end` (fix mining as committed): a finding whose named file is in ρ's domain ends with cause RENAMED, and any finding at the new path is a new lineage.
  - Under either policy, a rename whose destination lies outside the analysis root (the prefix does not match) has no successor: the lineage ends with cause RENAMED ("moved out of scope"). A rename into the root from outside starts a new lineage.
- **ID-11.** **Ending causes.** Under `end`, causes come from `classifyDisappearance`, unchanged, in its order: RENAMED, FILE-DELETED, MASS-OR-BOT, RESOLVED-IN-PLACE, FIXED-BY-DEV, OTHER. Under `continue`, the same function runs on ρ-mapped files and edges with `renamedFrom` holding only the out-of-root renames of ID-10, so RENAMED appears only for a move out of scope, and otherwise the order is FILE-DELETED, MASS-OR-BOT, RESOLVED-IN-PLACE, FIXED-BY-DEV, OTHER. The two new classes below are inserted only when enabled.
- **ID-12.** **MASS-OR-BOT changes credit, never identity.** A mass or bot commit still applies ρ and still matches keys.
- **ID-13.** **A failed snapshot** (`ok: false`) is neither a birth nor a death. The comparison skips to the next good snapshot, as the walker does now. ρ for that span must then be supplied for the two good snapshots, not composed across the gap.

### 2.5 Splits and merges (G08 §2.3, §2.4)

- **ID-14. Split.** A key has at most one successor, the candidate equal to ρ(K(v)). Every other candidate is introduced (cases S1, S2).
- **ID-15. RE-POINTED** (parameter `rePointed`, off in `legacy`). An edge-shaped lineage that ends with both files in place, at a step where a finding of the same rule and same source is born on a new target, ends as RE-POINTED instead of FIXED-BY-DEV. The new lineage gets `derivedFrom` pointing to it (S3). RE-POINTED is never credited as a fix.
- **ID-16. Cycle split** (S4). A cycle that ends gets the normal cause. A cycle born at the same step whose node set is a strict subset of the ended cycle's node set gets `derivedFrom`.
- **ID-17. MERGED** (parameter `merged`, off in `legacy`). When ρ maps two or more live keys onto one key at t+1, the successor continues the predecessor with the earliest birth; a tie goes to the lexicographically smallest original key. The others end as MERGED, never credited (M1). Without a rename row, M2 applies: FILE-DELETED, as now.
- **ID-18. Cycle merge** (M3). The old cycles end by their normal cause. A cycle born at the same step whose node set is a strict superset of an ended cycle's node set gets `derivedFrom` to each such cycle.
- **ID-19. FF-S02 cap.** A snapshot whose FF-S02 count is at least `s02Cap` (100) is marked capped. Survival and window counts drop an FF-S02 lineage whose birth or end touches a capped point or the point before it. This is the `survival()` rule of `scripts/v1.3/fixes-mined-report.ts`. Pair-level counts drop FF-S02 rows when either side is capped. The cap marks are inputs; the module does not infer them.

### 2.6 Drift measures over a snapshot sequence (C5)

- **DR-1. Persisting at t:** lineages alive at both t−1 and t (consecutive valid snapshots).
- **DR-2. Introduced at t, and left-censoring.** The parameter `leftCensor` takes one of two values:
  - `grid-index-0` (**legacy, what fix mining actually does**): only lineages with `born === 0` are left-censored (`survival()` in `scripts/v1.3/fixes-mined-report.ts`). The walker's `lineages()` sets `born` to the first *valid* snapshot, so in a repo whose grid point 0 failed, everything present at its first valid snapshot is counted as a birth. This holds for 10 of the 36 repos, for example outline-server (first valid point 49: 1,018 lineages, 112 of them blocking) and etherpad (point 136). R1 and R2 must use this value, or they will not reproduce the published digits.
  - `first-valid` (corrected): lineages present at the first valid snapshot are left-censored, are never introduced and are dropped from survival.
  The default for new analyses is `first-valid`. The published tables are not restated by the module; the difference is printed as sensitivity row S1 (DR-8) and goes to the author (Q8).
- **DR-3. Removed at t:** lineages ended at t, tallied by cause. `credited` = FIXED-BY-DEV for edge-shaped findings plus RESOLVED-IN-PLACE for file-level ones. This matches `scripts/v1.3/drift-descriptive.py`.
- **DR-3a. Tier is read from the record, frozen at walk time.** Every committed lineage and pair record carries `tier`. R1 and R2 use that stored tier, never the live `ruleTier` table, because U2 adds post-seal rules (D5, N3) that change the tier table, and a regression on historical data must not move when the table moves. `isBlocking(rule, style)` over `src/scoring-engine/rule-tiers.ts` exists for new data only; a test reports (and does not gate R1 or R2) any disagreement between the stored tier and the live table. In review, the stored tier and the Python `BLOCKING` set agreed on all 6,647 pair records.
- **DR-4. Survival:** Kaplan-Meier on (days from birth date to end date, or to the last date if censored, floored at 0; event = ended). It uses `kaplanMeier` from `scripts/v1.3/lib/fixes-mined.ts`, reporting n, events, median and S(365), plus the share of endings with every named file in place.
- **DR-5. Group filters** are predicates over lineage records. The eight §5a groups ship as `SURVIVAL_GROUPS_5A`, and the two extra C5 §4 groups ("blocking, all" and "blocking, file-level") as `SURVIVAL_GROUPS_C5`, so the regression tests and any later analysis use one definition.
- **DR-6. Introductions split three ways** at the pair level, as the C5 note does: in a bot or mass commit; rename-matched (per rule, an upper bound); new. This applies only under `renamePolicy: end`. Under `continue`, a rename-matched introduction is a continuation and is not introduced at all.
- **DR-7. Grid window versus pair level.** The module computes both from what it is given:
  - a pair is one parent → child commit, with commit metadata for the cause taxonomy;
  - a grid window is consecutive valid grid points, carrying only `filesStay`.
  It never mixes the two.
- **DR-8. Sensitivity rows (zero-call, committed data only).** Printed beside each R1 and R2 row, labelled as sensitivity, never as a restatement:
  - **S1, left-censoring corrected:** `leftCensor: 'first-valid'`.
  - **S2, moves censored:** endings with `filesStay === false` are treated as censored at their end date instead of as events. This is the only rename sensitivity the committed grid allows, because no ρ was stored. It is a bracket, not an estimate. It also censors true deletions, which a `continue` re-walk would still count as deaths, so it most likely overstates the survival that re-walk would give; the published row (renames as deaths) understates it. The thesis wording is the author's (Q1).

### 2.7 Study 2's D, with REV-03 applied

Inputs: one run's step snapshots 1..k under a shared start (step 1 run once, in `none@L2`, and every cell branching from that tree). Each step's identity set E_t is computed by the edge key, restricted by `counted` (default: every blocking finding; Study 2 passes the `check-correct.ts` label `correct` as a predicate). The module never calls `check-correct` itself.

- **D-1. Y1 = |E_1|**, the inherited step-1 blocking identities. It is always output, also at the fine grain (`Y1fine`).
- **D-2. D = Σ_{t=2..k} |E_t \ P_t|**, where P_t is the identities seen before t. The parameter `priorUnion` sets P_t:
  - `final-snapshots` (the S2D-01 formula): ∪_{s<t} E_s;
  - `all-turns` (the pilot memo's `runOutcomes`): also includes every repair-turn snapshot of earlier steps.
  The default is pending (Q4). Under `renamePolicy: continue`, P_t is carried through ρ, so an identity whose file was renamed is not new. ρ between steps comes from the run's snapshot store (ID-9); with no ρ supplied, the run is flagged `renameMapMissing: true` rather than silently treated as rename-free.
- **D-3. Construct name.** Every output carries `construct: 'propagation of inherited step-1 blocking patterns to new slices'` (REV-03 finding 3). The field name in records is `D`, and the docstring says it is not "drift from a common state".
- **D-4. Conditioning on Y1.** Each run gets `eligible = Y1 >= y1Min` (default 1). The aggregate helper takes `conditionOnY1: 'exclude' | 'report-only'`:
  - under `exclude`, a block whose shared step-1 tree has Y1 < y1Min is left out of the D contrasts and counted;
  - under `report-only`, it is kept and flagged.
  Either way the output reports the count of blocks with Y1 = 0, which REV-03 registers as a falsifier.
  Runs are grouped by `blockId`. Because every cell of a block branches from one step-1 tree, Y1 must be equal across the cells of a block; `aggregateD` throws if it is not, since unequal Y1 means the shared start is broken.
- **D-5. Pilot bar line.** `y1Gate(runs, {minEligible: 4, ofRuns: 6, y1Min: 1})` returns pass or fail with its counts. The numbers are parameters, not constants; this is REV-03's proposed bar, not a registered one.
- **D-6. Secondaries computed here** (REV-03 finding 3; S2D-01 §1):
  - **inheritedRemoved:** identities of E_1 absent at step k, and at each step;
  - **D conditioned on no inherited removal:** D for runs where inheritedRemoved = 0, or null;
  - **D per new slice:** D divided by `newSlices`, a caller-supplied count per step, and null if absent;
  - **per-step new counts and steps to the first new identity;**
  - **D by edge kind and by rule family, and D without each rule family** (leave one family out): grouping keys are supplied by the caller (D2b's wiring and type-only split needs facts this module does not hold);
  - **the other S2D-01 §1 secondaries:** `Yk`, the level at step k (the old primary); the introduction rate D/(k−1); and D per added KLOC, from a caller-supplied `addedKloc` per step (null if absent).
- **D-7. Missing data.** A step whose final snapshot was not evaluated has a null count and makes D null, never 0, as in the pilot memo. The next step is flagged `afterUnscored`. A run with fewer than k steps returns D over the steps it has, with `incomplete: true` (probe 1's market-vendors has 4).
- **D-8. The registered memo outcome is not touched.** `runOutcomes().newBlockingTotal` keeps its own identity. A `MEMO_COMPAT` preset (`grain: 'memo'`, `all-turns`) exists only so a test can show where the two definitions agree and where they differ. The `memo` grain reproduces `findingIdentity` in `scripts/lib/loop/pilot-metrics.ts` exactly: rule id, template, file and target; for a cycle (template or rule name matching `/cycl/i`), rule id, template and the sorted set of `{filePath, target}`. It needs `template` and `ruleName` on `IdFinding`, which the loop adapter carries and K and E ignore.

---

## 3. Data contracts

All types live in `scripts/lib/drift/types.ts`. Records are plain JSON and serialisable through `scripts/lib/canonical-json.ts`.

```ts
// Normalised finding: anything the adapters accept becomes this (the fix-mining MinedViolation shape plus tier).
interface IdFinding {
  readonly functionId: string;            // rule id
  readonly filePath: string;              // source, or comma-list for a cycle
  readonly target?: string;
  readonly discriminator?: readonly string[];
  readonly tier?: 'blocking' | 'advisory';
  readonly template?: string;             // carried for the memo grain only (D-8); not part of K or E
  readonly ruleName?: string;             // idem
  readonly cycleMembersKnown?: false;     // set only by the loop adapter fallback (ID-4)
}

interface Snapshot {
  readonly id: string;                    // sha, tree hash or step label
  readonly contextId: string;             // Θ + σ fingerprint (ID-1); for a probe step file: spec, engine,
                                          // instrumentVersion and scoringMode; for fix mining: walk.json spec, engine, mode, scoring
  readonly date?: string;                 // ISO; needed for survival only
  readonly ok: boolean;
  readonly findings: readonly IdFinding[];
  readonly files?: readonly string[];     // for causes and filesStay
  readonly edges?: readonly string[];     // `s|t` import edges, for causes
  readonly s02Capped?: boolean;           // ID-19
}

type RenameMap = ReadonlyMap<string, string>;          // old -> new, from parseNameStatus()
interface Transition {                                 // between two consecutive *valid* snapshots
  readonly rename?: RenameMap;
  readonly renameDetection?: 'full' | 'skipped';       // ID-9: git skipped rename detection (-l limit)
  readonly massOrBot?: boolean;                        // pair level only
}

interface IdentityOptions {
  readonly grain: 'fine' | 'edge' | 'memo';            // 'memo' only for MEMO_COMPAT (D-8)
  readonly cycleIdentity: 'edge-set' | 'sorted-files' | 'explode-edges';
  readonly edgeOnly: boolean;
  readonly renamePolicy: 'continue' | 'end';
  readonly rePointed: boolean;
  readonly merged: boolean;
  readonly s02Cap: number;                             // 100
  readonly leftCensor: 'grid-index-0' | 'first-valid'; // DR-2; LEGACY_FIXES_MINED uses 'grid-index-0'
}
// Presets: LEGACY_FIXES_MINED (fine, end, no RE-POINTED/MERGED, grid-index-0), G08_PROPOSED (continue, both on, edge-set),
// STUDY2_S2D01 (edge, sorted-files, edgeOnly, continue), MEMO_COMPAT (D-8, test only).

type Cause = Disappearance | 'RE-POINTED' | 'MERGED';  // Disappearance from scripts/v1.3/lib/fixes-mined.ts

interface Lineage {
  readonly key: string;
  readonly ruleIds: readonly string[];                 // >1 only for an edge key (FF-S01 + FF-S03)
  readonly edgeShaped: boolean;
  readonly tier?: 'blocking' | 'advisory';
  readonly born: number;                               // index into the snapshot list; 0 = left-censored
  readonly ended: number | null;
  readonly cause?: Cause;
  readonly filesStay?: boolean;
  readonly renamedAt?: readonly number[];              // renamePolicy 'continue'
  readonly derivedFrom?: readonly string[];            // ID-15, ID-16, ID-18
  readonly cycleMembersKnown?: false;
}

interface DriftRun {                                   // Study 2, one run
  readonly construct: 'propagation of inherited step-1 blocking patterns to new slices';
  readonly runId: string; readonly blockId: string; readonly cell: string;   // D-4 grouping
  readonly Y1: number | null; readonly Y1fine: number | null;
  readonly Yk: number | null;                          // level at step k (S2D-01 secondary)
  readonly eligible: boolean | null;                   // Y1 >= y1Min
  readonly D: number | null;
  readonly perStep: readonly { step: number; newCount: number | null; afterUnscored?: true }[];
  readonly inheritedRemoved: number | null;
  readonly DnoInheritedRemoval: number | null;
  readonly DperNewSlice: number | null;
  readonly DperStep: number | null;                    // D / (k - 1)
  readonly DperAddedKloc: number | null;
  readonly stepsToFirstNew: number | null;
  readonly incomplete: boolean;
  readonly degradedCycleKeys: number;
  readonly renameMapMissing: boolean;                  // D-2
  readonly params: DriftParams;                        // echoed, so every number carries its definition
}
interface DriftParams extends IdentityOptions {
  readonly kFrom: number; readonly kTo: number;        // 2, 5
  readonly priorUnion: 'final-snapshots' | 'all-turns';
  readonly y1Min: number;                              // 1
}
```

The lineage records read from `results/v1.3-fixes-mined/repos/*/lineages.json.gz` are already in a compatible shape: `key, kind, functionId, tier, edgeShaped, edgeKind, born, ended, filesStay`. A thin reader maps them onto `Lineage` (with `kind: 'edge'` for the unflagged baseline), so the survival code runs unchanged on committed data.

---

## 4. Where the code goes

The repo idiom for shared, pure script code is `scripts/lib/<area>/` (see `scripts/lib/loop/`), with tests under `tests/unit/scripts/<area>/`. Study-specific entry files live under `scripts/v1.x/`. `scripts/lib/loop/` already imports from `scripts/v1.3/lib/`, so importing `fixes-mined.ts` from `scripts/lib/drift/` follows an existing direction.

| File | Role |
|---|---|
| `scripts/lib/drift/types.ts` | contracts of §3, the presets |
| `scripts/lib/drift/identity.ts` | `fineKey`, `edgeKeys`, `memoKey`, `mapFinding(f, ρ)` (maps the finding, then re-keys; ID-10), adapters `fromMined`, `fromBlockingFinding`, `fromProbeFinding`; wraps `violationKey`, `violationEdges`, `violationFiles` and `canonicalCycle` |
| `scripts/lib/drift/rename-map.ts` | `parseNameStatus(text, prefix)`, a pure parser (R, C, D, A, M rows), matching `nameStatus` in `scripts/v1.3/fixes-mined-run.ts` |
| `scripts/lib/drift/git-rename.ts` | the only I/O: `renameMapBetween(clone, a, b, path)` via `spawnSync('git', …)`, returning the map and `renameDetection` from stderr (ID-9). Local git only, no network. Tested once on a throwaway repo under the OS temp directory (T-GR) |
| `scripts/lib/drift/handcheck.ts` | `handcheckSample(pairsByRepo, {seed, perCause})`: a seeded, stratified sample of pair-level disappearances for the C1e hand check (§5, T-HC). Pure |
| `scripts/lib/drift/lineage.ts` | `buildLineages(snapshots, transitions, options)`, implementing ID-9 to ID-19 |
| `scripts/lib/drift/metrics.ts` | DR-1 to DR-8: `windowCounts`, `pairCounts`, `survival(lineages, dates, pick, capped, {leftCensor, firstValid, movesCensored})`, `SURVIVAL_GROUPS_5A`, `SURVIVAL_GROUPS_C5`, `readMinedLineages` |
| `scripts/lib/drift/study2-d.ts` | D-1 to D-8: `driftRun(steps, params, counted?)`, `aggregateD(runs, {conditionOnY1})`, `y1Gate` |
| `scripts/lib/drift/index.ts` | re-exports |
| `scripts/v1.4/drift-check.ts` | entry file, no exports. It recomputes the §5a table and the C5 counts from committed fix-mining outputs, the S1 and S2 sensitivity rows beside them, and D/Y1 from probe 1. It writes `results/v1.4-drift-check/summary.json` and the hand-check packet `results/v1.4-drift-check/identity-handcheck.csv` (empty label column). Zero calls, no Neo4j |

`scripts/v1.3/drift-descriptive.py` stays as it is, as the C5 note's record. The TypeScript port must agree with it (R2).

---

## 5. Test strategy

Jest only, with `--maxWorkers=2`. No suite needs Neo4j: everything is pure or reads committed gzip JSON. That JSON is 1.9 MB compressed but **about 25 MB decompressed** (measured in review), so the real-data suites read one repo at a time through one shared loader and keep only the records they need; T-ID and R1/R2 are the only suites that read all 36 repos. No suite takes the Neo4j lock.

| Id | Suite | What it pins |
|---|---|---|
| T-ID | `tests/unit/scripts/drift/identity.test.ts` | ID-3 parity: `fineKey` equals `violationKey` on the fixtures in `tests/unit/scripts/v1.3/fixes-mined.test.ts`. **Adapter round trip on real records:** `fromMined` on every `introduced` or `disappeared` record in the 36 committed `pairs.json.gz` reproduces the stored `key`. For the non-cycle records this only checks the adapter and schema (the discriminator is rebuilt from the key's fourth segment, so it is not an identity test). The 2,239 FF-S02 cycle records are the informative part: their key is rebuilt from the stored comma-list `filePath` through `canonicalCycle`, and in review all 2,239 matched. ID-5 FF-S01 + FF-S03 share one E. ID-6, all three cycle modes. ID-4 degraded flag. ID-10 mapping on the finding (a path containing `#`; a JSON cycle discriminator; a class-name discriminator left alone) and re-canonicalisation (G08 example 3: `[b,c,a,b]` and `[a,b,c,a]` are one key). `memoKey` equals `findingIdentity` from `scripts/lib/loop/pilot-metrics.ts` on its own test fixtures |
| T-RN | `tests/unit/scripts/drift/rename-map.test.ts` | R087 row, copy row, prefix stripping, a rename out of the root, empty diff |
| T-GR | `tests/unit/scripts/drift/git-rename.test.ts` | One throwaway repo under the OS temp directory (`git init`, two commits, one `git mv`, local only, no network, no repo-level git state touched): `renameMapBetween` returns the rename. A stderr fixture holding git's "rename detection was skipped" warning gives `renameDetection: 'skipped'`. Skipped with a note if `git` is not on the path |
| **T-HC** | `tests/unit/scripts/drift/identity-errors.test.ts` | **The C1e part test.** (a) Planted synthetic histories with renames, deletions, bot or mass commits, re-pointed edges, cycle rotations, splits and merges, about 40 transitions, each with its expected outcome written in the test before the code: **identity errors = 0** under both `LEGACY_FIXES_MINED` and `G08_PROPOSED`. (b) `handcheckSample` on the committed pairs is deterministic for seed 20261018, stratified by cause (RENAMED, FILE-DELETED, MASS-OR-BOT, RESOLVED-IN-PLACE, FIXED-BY-DEV, OTHER; up to 10 each), and every row carries repo, commit link, rule, files and assigned cause. The author's labels of that packet give the real-history identity-error rate; the module does not invent the labels |
| T-LN | `tests/unit/scripts/drift/lineage.test.ts` | G08 cases S1–S4 and M1–M4 as synthetic snapshot pairs, under both rename policies; the worked examples of G08 §2.5; a failed snapshot in the middle (ID-13); MASS-OR-BOT keeps identity (ID-12); `contextId` mismatch throws (ID-1); the legacy preset gives the same born/ended/cause as the walker's `lineages()` logic on a hand-built grid |
| T-MX | `tests/unit/scripts/drift/metrics.test.ts` | DR-1 to DR-7 on small grids; left-censoring; the FF-S02 cap rule touching a point or the one before it |
| **R1** | `tests/unit/scripts/drift/survival-regression.test.ts` | **The fix-mining survival table, exactly.** From `results/v1.3-fixes-mined/repos/*/{lineages,pairs}.json.gz`, all eight §5a rows (`Docs/DiagnosticRuns/v1.3-validity-fixes-mined-2026-10-16.md` §5a): lineages and ended as integers; median rounded to days or "> obs."; S(365) to 3 decimals; files-in-place to 2 decimals. The raw `km.median` and `km.s365` must also equal `results/v1.3-fixes-mined/summary.json` `survival[]` to 1e-12. Example: blocking edge-shaped 2413 / 874 / 1561 / 0.709 / 44.62 %. Runs under `leftCensor: 'grid-index-0'` and stored tiers (DR-2, DR-3a). **Sensitivity rows S1 and S2** (DR-8) are pinned to values computed in review by an independent Python replication that first reproduced every published row: blocking edge-shaped S1 2361 / 840 / 1561 / 0.707, S2 2413 / 390 / > obs. / 0.842; blocking without FF-S02 S1 2029 / 621 / > obs. / 0.759, S2 2080 / 279 / > obs. / 0.877; unflagged cross-layer S1 10863 / 3553 / > obs. / 0.747, S2 11211 / 1197 / > obs. / 0.912. The TS module must agree with them, or the disagreement is reported, not tuned away |
| **R2** | same file | **The C5 descriptive counts.** Pooled grid windows: births 2,785, endings 1,288, in place 543. Pair level: introduced 802 (bot/mass 448, rename-matched 24, new 330), removed 265 (FILE-DELETED 106, RENAMED 52, MASS-OR-BOT 19, RESOLVED-IN-PLACE 7, FIXED-BY-DEV 74, OTHER 7). The six KM rows of the C5 note §4. All from `Docs/DiagnosticRuns/v1.3-drift-descriptive-2026-10-18.md`, pinned as constants (the C5 results folder is not committed yet). The two extra §4 rows use `SURVIVAL_GROUPS_C5`: blocking, all 2785 / 1002 / 1561 / 0.719 and blocking, file-level 372 / 128 / > obs. / 0.779 (both reproduced in review). Note for the author: under S1 the "blocking, all" median moves from 1561 to > obs. (2727 / 964 / 0.717) |
| **R3** | `tests/unit/scripts/drift/study2-d.test.ts` | **Probe 1's D.** From `results/v1.3-floor-probe/{market-vendors,youth-league,hive-health}/none/step-NN.json` under the edge key with `final-snapshots`: D = 1, 2, 5 and Y1 = 2, 2, 4; per-step new counts [0, 0, 1], [2, 0, 0, 0], [3, 2, 0, 0]. Under the fine key: D = 2, 2, 7 and Y1fine = 4, 3, 6 (all recomputed in review). market-vendors is `incomplete` (4 steps). The three Hexagonal `none` runs (food-bank, garden-plots, shelter-adoptions) give Y1 = 0 and D = 0: the real-data case of the Y1 = 0 falsifier, with `eligible: false`. ρ is empty for probe 1 (ID-9). Plus Y1 gating, `conditionOnY1` both ways, null propagation, `afterUnscored`, D per new slice, and inherited removal |
| T-MC | same file | D-8: on a hand-built run, `MEMO_COMPAT` equals `runOutcomes().newBlockingTotal` from `scripts/lib/loop/pilot-metrics.ts`. One documented case (a cycle reported from another start node) where the two differ |

Property tests use seeded random grids built with `seededRandom` from `scripts/v1.3/lib/fixes-mined.ts`; fast-check is not a dependency and none is added:
- rotating a cycle never changes K;
- with an empty ρ, `continue` equals `end`;
- per pair, introduced − removed = count at the child − count at the parent (the `netCheckFail = 0` invariant of the C5 script);
- under `edge-set` and `sorted-files`, E lineages never outnumber K lineages; under `explode-edges`, E lineages never outnumber the sum over K of its edge count (ID-8). The plain "E ≤ K" property is false in the explode mode, where one cycle K yields one E per edge.

---

## 6. Risks

| Risk | Effect | Mitigation |
|---|---|---|
| The committed grid has **no rename maps**: the walker never stored ρ between grid points | `renamePolicy: continue` cannot be applied to fix mining or C5 without a git-only re-walk, so G08's "survival is biased short" stays a declared bias | R1 and R2 run under `legacy`. A re-walk is a separate task with its own OK; it needs only git, with no Neo4j and no model. Q1 |
| **Only lineage records are committed**, not per-snapshot violation lists | R1 and R2 exercise the metrics, not the identity builder, on real data | The identity builder is pinned by T-ID (the 2,239 real cycle keys; the rest is an adapter check), T-LN and T-HC planted cases, R3 on real probe-1 step records, and the author's hand check of the T-HC packet |
| The loop's `BlockingFinding` has **no cycle member list** | A cycle key from a loop record can merge different cycles, the A7 "check pending" | ID-4 flag and count; full members come from the `report-*.json` beside each turn when the caller passes them |
| **Two D definitions** (S2D-01 against the memo) diverge on prior union and cycle key | Numbers differ by definition, which could be read as lever-hunting | Every `DriftRun` echoes its params; T-MC documents the difference; defaults wait for Q2 and Q4 |
| **Changing registered files by accident** | Protocol breach (REV-03 finding 2) | The plan touches none of them. The last plan step runs `node scripts/v1.3/protocol-consistency-check.mjs` and `git diff --stat`, both read-only, to show it |
| **Y1 gating as a post-hoc lever** | An examiner reads the exclusion as tuning | `y1Min`, `conditionOnY1` and the gate thresholds are parameters whose values are fixed only in the deviation and pre-registration. The Y1 = 0 count is always reported |
| **KM implementation drift** between the Python and TS versions (`t > 365` in Python against `t <= 365` in TS) | Off-by-one at exactly 365 days | Reuse the TS `kaplanMeier` from `scripts/v1.3/lib/fixes-mined.ts` and test against `summary.json` floats (R1) |
| The C5 script and note are **untracked** (`scripts/v1.3/drift-descriptive.py`, `Docs/DiagnosticRuns/v1.3-drift-descriptive-2026-10-18.md`) | R2 pins figures from an uncommitted source | The orchestrator commits them with this unit's PR. R2 pins constants, not the untracked `results/` file |
| RE-POINTED and MERGED are **new classes** | Results under `G08_PROPOSED` are not comparable with the published fix-mining tables | Off in `legacy`; reported side by side when enabled. Q3 |
| **Left-censoring artefact in the published survival tables** (found in review) | In 10 of 36 repos grid point 0 failed, so the state at the first valid point is counted as births (outline-server alone: 112 blocking). A port that "fixes" this silently would break R1, and a port that hides it would carry the artefact into new analyses | `leftCensor` parameter (DR-2): legacy for R1/R2, `first-valid` for new work, S1 printed beside. The published tables are not restated by this unit (Q8) |
| **Live tier table drifts** under U2 (D5, N3 add post-seal rules) | R1/R2 on historical data would move without any code change in U4 | Stored tiers only in regressions (DR-3a); the live-table comparison reports and does not gate |
| **git skips rename detection** past `-l5000` and says so only on stderr | ρ empty for a transition with renames; `continue` silently degrades to `end` | `renameDetection: 'skipped'` on the transition, counted in every output (ID-9); T-GR |
| Machine load | about 25 MB of decompressed JSON in the real-data suites | Pure CPU, one process per suite, one repo in memory at a time; at most 2 jest workers |

---

## 7. Open decisions for the author

None of these blocks the code, because each is a parameter with a preset (Q9 is a labelling task, not a code choice). They decide the defaults and which preset the thesis reports.

- **Q1.** Rename policy for new analyses: `continue` (G08) or `end` (fix mining as published)? And is a git-only re-walk wanted to restate survival under `continue`, or is declaring the bias enough?
- **Q2.** The cycle identity in Study 2's E: directed-edge set (G08), sorted file set (the current S2D-01 and A7 text), or explode-edges?
- **Q3.** Adopt RE-POINTED and MERGED for new analyses?
- **Q4.** Prior union for D: step-final snapshots (the S2D-01 formula) or all turns including repairs (the pilot memo)? This matters for the `mcp` arm, which can repair inside a step.
- **Q5.** Y1 conditioning: `y1Min = 1`, the pilot line "≥ 4 of 6 step-1 trees with Y1 ≥ 1", and whether Y1 = 0 blocks are excluded from the primary contrasts or kept and flagged. All of these are for the second dated deviation.
- **Q6.** When the deviation lands, should `scripts/lib/loop/pilot-metrics.ts` and `scripts/v1.3/lib/study2-analysis.ts` switch to this module (G08 §3)? That would be a later unit.
- **Q7.** What counts as a "new slice", the denominator of D per new slice: the task's declared slices per step, or new files under a layer glob?
- **Q8.** The left-censoring artefact (DR-2): should the fix-mining and C5 survival tables (N123) be restated under `first-valid`, or kept as published with S1 cited beside them? The shift is small on the §5a rows (blocking edge-shaped S(365) 0.709 to 0.707) but the C5 "blocking, all" median moves from 1,561 days to > obs. Either way it belongs in the threat list of `Docs/DiagnosticRuns/v1.3-validity-fixes-mined-2026-10-16.md`, which this unit does not edit.
- **Q9.** The C1e hand check (T-HC): about 60 pair-level disappearances, labelled by the author ("same violation?", "cause right?"). Who labels, and when? Until then the C1e part test reports the planted-case result only.
