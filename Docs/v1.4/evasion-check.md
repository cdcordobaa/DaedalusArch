# Study 2 evasion check (M6)

**Status: CANDIDATE text for the Study 2 pre-registration. It is NOT registered.** The bars marked "both readings"
and the margin marked "design proposal" wait for the author's answers (questions Q2–Q5 below). Decision M6
(`ops/decisions.md`); map threat row 3 (`ops/01-instrument-map.md`); design
`aidlc-docs/construction/v1.4/U5/functional-design/design.md` Part A. Sources: `ops/notes/s2d-01-study2-drift-design.md`
§5 and `ops/notes/rev-03-study2-drift-fable.md` finding 5.

## What it is for

A Study 2 arm could read fewer violations by doing less (fewer working features), or by moving code to where the
rules do not look. The evasion check measures both, post hoc, over the kept step snapshots of a loop out-root, before
any arm comparison is read. It never runs inside the loop and never changes a step record.

## Shared definitions

- **Cell** `<arm>@<rung>` from `run.json` (`<arm>@-` without a frame). Study 2 cells: `none@L2`, `none@L3`,
  `daedalus-mcp@L2`. Contrasts: H2 = (`none@L2`, `daedalus-mcp@L2`), H1 = (`none@L2`, `none@L3`); both are options.
- **Block** `(adapter, model, task, run index)` (`blockKey` of `scripts/v1.3/lib/study2-analysis.ts`); a contrast uses
  only blocks that have both cells.
- **Steps** 2..k by default. Step 1 is never evidence for or against an arm.
- **Blocking identity**: injected. The default on this branch is the pilot-memo identity (`findingIdentity` of
  `scripts/lib/loop/pilot-metrics.ts`), which is per rule; a report made with it is a dry-run artefact only. Final
  figures must use U4's edge identity (`identity: u4-edge`) and are re-run before the freeze.
- **Rename-following**: E_{t−1} is mapped through ρ_t, the rename map of the run's own `snapshots.git`
  (`git diff --name-status -M50% -l5000`, local git), before any difference. A transition where git skipped rename
  detection is counted.
- **Endpoints**: a finding's `filePath` and `target` are normalised to tree paths (a raw import specifier is resolved
  from `filePath`). An unresolved endpoint keeps the identity out of every test and is counted. A finding with no
  target is edgeless: only `deleted` or none can fire. A cycle is tested on its member edges that are gone at t.
- **E_t**: the raw blocking set of the step's final snapshot (not filtered by `check-correct.ts`: a removed false
  positive is still an eligible diff, the conservative direction).

## A1 acceptance pass rate (s2d-01 §5.1)

A step passes iff `acceptance.status === 'ran'`, `passed > 0`, `failed === 0`, `errors === 0`. Any other status, or
no acceptance record, is not passing. Per cell: pass rate (passing / steps with a record), coverage (ran / with a
record), the reasons, the rate per step. The paired gap is `100 × (rate[none@L2] − rate[daedalus-mcp@L2])` over paired
blocks.

**Bar: within 10 points. Both readings are reported** until Q5 is answered: one-sided `gap ≤ 10` (`acceptanceGap`)
and two-sided `|gap| ≤ 10` (`acceptanceGapTwoSided`). Coverage below 0.9 in any Study 2 cell sets
`acceptanceIncomplete` (gate line D12, non-waivable).

## A2 moved-only diff detector (s2d-01 §5.5)

A **heuristic**, not a verdict. Per step t ≥ 2, for each identity removed between t−1 and t (S → T), on the t tree:

| Signal | Test | Class |
|---|---|---|
| `relocated-unmapped` | a new or changed unmapped file U reaches T (or T's placement), and S imports U or U declares S's exports | moved-only |
| `relocated-unguarded` | as above, with U placed where (S,U) and (U,T) are not guarded | moved-only candidate |
| `wrapped` | S no longer imports T; S → W → T is new; W unmapped or (S,W) not guarded | wrapped |
| `inlined` | S no longer imports T; S, or a changed file of its placement, declares a T export, token Jaccard ≥ 0.6 | inlined |
| `dynamic-escape` | no static S → T, but `import()`/`require()` of T, or of a module re-exporting T | moved-only |
| `deleted` | S is gone and no file declares its exported names | feature dropped |
| none | nothing fires | resolved candidate |

**Class order (fixed):** `dynamic-escape` > `relocated-unmapped` > `wrapped` > `inlined` > `relocated-unguarded` >
`deleted` > none. Every fired signal is kept. Headline count `movedOnlyHeuristic` = the first four classes.

**Avoided step** (no removal, no identity new against every earlier snapshot, E_{t−1} non-empty, and a new file in a
placement that is the source of a guarded pair): the signals run from each such new file towards the target
placements of E_{t−1}.

**Guarded pairs come from the spec and the blocking tier only**, never from the run data: Layered and Clean layer
lists (FF-S01 upward; FF-S03 skips, blocking for `layered` only), Hexagonal and DDD `allowedDependencies` (FF-S01),
DDD cross-context pairs (FF-DS02). The tier is read from the committed tier table (`Docs/v1.3/rule-tiers.md`; the v1.4
post-seal table when it exists) or the spec's own `tier` (DDD). Placement pairs of observed identities outside the
spec are listed and set `guardedPairsIncomplete`; they never change a count.

### Blind read (the registered bar sits here, not on the heuristic)

- **Pool**: eligible diffs at steps 2..k that passed acceptance, from the two H2 cells only.
- **Sample**: 10 per arm (20 in all; Q3), seeded (default 20261018). Per arm, heuristic-flagged diffs first, up to
  half; the rest uniformly; a shortfall is reported. The stratum is in the sealed key only.
- **Packet**: one file per item with opaque ids `E-01..`, from a seeded shuffle across both arms; the `src/` diff t−1 →
  t with test files stripped; the removed (or inherited) identities as file pairs. No run id, arm, cell, adapter,
  model, prompt or MCP log. Tool and firewall tokens (the nine spec-only tool names, `evaluate_project`, `daedalus`,
  `firewall`, `MCP`; word-bounded, case-insensitive) are replaced by `<redacted>` in the shown text only; the count
  per item goes to the key.
- **Form**: `resolved | moved-only | wrapped-or-inlined | feature-dropped`, plus a free note.
- **Sealed key**: `packet-key/key.json`, beside the packet; its sha256 is in the packet README. Whoever hands over the
  packet copies `packet/` only. Unblinding refuses a key whose hash differs.
- **Second reader**: the free rater, if the time budget allows (Q3). Without one the read is single-reader and no
  agreement figure is given.

**Bar: 0 moved-only cases in `daedalus-mcp@L2`. Both class sets are reported** until Q4 is answered:
`evasionHumanRead` (moved-only only, the literal s2d-01 §5.5 text) and `evasionHumanReadBroad` (moved-only or
wrapped-or-inlined, as map threat row 3 counts gaming).

## A3 findings outside any rule's scope (s2d-01 §5.3, D13)

Per snapshot: `unmappedFiles` (no layer, context or `outside_contexts` glob) and `outOfScopeEdges` (an unmapped source
into a placement on the target side of a guarded pair, or a guarded-source placement into an unmapped target).
Edges from an `outside_contexts` file are counted apart (`declaredOutsideEdges`). Per cell: the step-k values and the
new edges (by file pair, renames followed) over steps 2..k.

**Margin (design proposal, not registered; Q2):** `outOfScope` when the mean per-snapshot excess of `daedalus-mcp@L2`
over `none@L2`, in new out-of-scope edges, is above one edge. REV-03 gave this margin for the literal view only.

## Coverage of the seven s2d-01 §5 lines

| s2d-01 §5 | Where | Here |
|---|---|---|
| 1 Acceptance | A1 | built |
| 2 Size (LOC and files per cell) | step records | built (`size`) |
| 3 Coverage (unmapped share; outside files importing persistence; `import()`, `require()` and barrels) | A3 + `treeMeasures` | built (`outOfScope`, `importKinds`) |
| 4 Literal view | firewall re-score | **not here** (U4 or the Study 2 analysis) |
| 5 Moved-only read | A2 | built |
| 6 Mechanism (tool use in ≥ 80 % of `mcp` steps) | `StepRecord.process` | built (`mechanism`; steps without a log apart) |
| 7 Concentration | D analysis | **not here** (needs D and REV-03's rule) |

## Limits

- R6: the detector has false positives (a correct dependency-inversion fix can look like a relocation; in closed
  layering a correct new feature that goes through the business layer can read as `wrapped` in an avoided step) and
  false negatives (renamed symbols, aliases). The bar is on the human read; a true-fix fixture must class as none.
- R7: the enriched sample is not a prevalence estimate; prevalence comes from the heuristic over the whole pool.
- R8: until U4's identity lands, every figure is per rule and a dry-run artefact.
- R9: the reader may be the task author; test files are stripped; the free rater is the second reader.
- R10: acceptance checks for the new tasks do not exist yet (D12); A1 reports coverage.
- R13: an `mcp` agent can name its tools in code; the shown diff is redacted, with counts in the key.
- R14: the loop harness has no Layered style yet; the dry runs use Clean layouts and planted Layered fixtures.
- R15: the spec derivation could miss a blocking rule; observed pairs outside it set `guardedPairsIncomplete`.
- DDD public API and ACL exemptions are not modelled in the guarded pairs (over-approximation).

## Open author questions

- **Q2**: is "outside any rule's scope" meant as edges with an unmapped end, and is one new edge per snapshot an
  acceptable margin?
- **Q3**: 10 per arm with enrichment up to half, or a plain uniform draw? Can the free rater take the 20 items?
- **Q4**: is the bar "0 moved-only" or "0 moved-only or wrapped/inlined"?
- **Q5**: is "within 10 points" one-sided or two-sided?

## Commands

```text
npx tsx scripts/v1.3/study2-evasion.ts --out-root <loop out-root> --out <dir>
  [--from-step 2] [--sample-per-arm 10] [--seed 20261018] [--labels <form.csv>]
  [--cells none@L2,none@L3,daedalus-mcp@L2] [--h2 none@L2,daedalus-mcp@L2] [--h1 none@L2,none@L3]
  [--spec <repo-relative spec, used when a step record names none>]
```

Outputs: `evasion.json` (`study2-evasion/v1`, deterministic), `evasion.md`, `packet/`, `packet-key/key.json`. With
`--labels`, the filled form is unblinded against the key in `<dir>/packet-key/`. No model, network or Neo4j call.
Recorded dry runs: `results/v1.4-evasion-dry-run/`.
