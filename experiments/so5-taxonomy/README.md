# SO5 episode cards (step 1 of the failure-pattern taxonomy)

Built by `build-cards.ts` (zero model calls, deterministic; mulberry32 seed 20261029, cap 60 episodes per capped source).
Design: `ops/notes/so5-taxonomy-design.md` sections 2 to 5. Output: `cards.json` (266 cards). Run: `npx tsx experiments/so5-taxonomy/build-cards.ts`.

The cards are **not coded or categorised**. Fields per card: `id` (E001..), `source`, `facets` (model, specLevel, style, arm,
cell, step, neutral session and task ids), `file`, `hunk` (at most 40 lines including the header; `diffRef` points to the committed diff),
`enclosingType` (from the committed tree where one exists, else the identity subject, hunk text or the file name; `derivedFrom` says which),
`evidence` (rule ids, or oracle sub-goal, or hand-read family; no interpretation), `kind` (failure or repair), `multiplicity`.
Task names are replaced by neutral ids (S1-T*, S2-T*, S1/S2 for HEXDDD-01, P1..P6 for puzzles, t01.. for TRAPRATE-01). Hunks and file paths are
agent code and naturally contain domain words; agent chat text and spend fields are in no card. The final-study lanes, the MEAN-01 sample,
`daedalus-sealed` and every sealed or calibration set were not opened.

## Counts per source

| Source | Episodes found | Cards drawn | Not drawn | Failure | Repair | With a hunk |
|---|---|---|---|---|---|---|
| study1 | 220 | 60 | 160 | 60 | 0 | 0 |
| study2b | 176 | 60 | 116 | 53 | 7 | 0 |
| hexddd01 | 10 | 10 | 0 | 9 | 1 | 10 |
| puzzle01 | 11 | 11 | 0 | 11 | 0 | 11 |
| puzzle02 | 0 | 0 | 0 | 0 | 0 | 0 |
| puzzle03 | 17 | 17 | 0 | 17 | 0 | 17 |
| puzzle04 | 3 | 3 | 0 | 3 | 0 | 2 |
| traprate01 | 105 | 105 | 0 | 105 | 0 | 60 |
| **total** | 542 | 266 | 276 | 258 | 8 | 100 |

"Not drawn" is the stratified cap for Study 1 and Study 2b (water-filling over the strata, seeded shuffle inside each stratum) and, for the other
sources, zero by design. Oracle failures adjudicated as not a violation are listed below instead (they are not episodes).

### Excluded before counting
- puzzle01/none: 1 x oracle FAIL adjudicated over-rejection or legit-clean in the committed hand read (not a violated rule)
- puzzle01/none: 1 x oracle FAIL in an incomplete session (infrastructure failure, superseded by its redraw session)
- puzzle02/mcp-detect: 6 x oracle FAIL adjudicated over-rejection or legit-clean in the committed hand read (not a violated rule)
- puzzle03/none: 2 x oracle FAIL in an incomplete session (infrastructure failure, superseded by its redraw session)
- puzzle04/gate: 8 x oracle FAIL adjudicated over-rejection or legit-clean in the committed hand read (not a violated rule)

### Builder notes
- Study 1: 65 accepted cells; 1184 FF-CV05 test-pairing findings (noise per the HEXDDD-01 comparison and the design note) excluded before grouping.
- Study 2b: edge identities (rule|file|target) per step reconcile with the registered per-step D for 120 of 120 runs (the builder asserts all).
- TRAPRATE-01: 1 session(s) have no oracle record at the final step (no sub-goal episodes possible for them).
- TRAPRATE-01: 0 admitted identities appeared in a step and were absent at the next step (self-repairs within a session); not carded because the seeds carry no violation and the design defines repairs as inherited violations removed.

## Strata (drawn and not drawn)

### Study 1 (model x spec level; cap 60)
| Stratum | Episodes | Drawn | Not drawn |
|---|---|---|---|
| claude-haiku-4-5 x full-aac | 16 | 5 | 11 |
| claude-haiku-4-5 x minimal-prose | 11 | 5 | 6 |
| claude-haiku-4-5 x none | 8 | 5 | 3 |
| claude-opus-5-5 x full-aac | 41 | 5 | 36 |
| claude-opus-5-5 x minimal-prose | 35 | 5 | 30 |
| claude-opus-5-5 x none | 14 | 5 | 9 |
| claude-sonnet-5-5 x full-aac | 25 | 5 | 20 |
| claude-sonnet-5-5 x minimal-prose | 29 | 5 | 24 |
| claude-sonnet-5-5 x none | 8 | 5 | 3 |
| gpt-5.6-terra x full-aac | 14 | 5 | 9 |
| gpt-5.6-terra x minimal-prose | 8 | 5 | 3 |
| gpt-5.6-terra x none | 11 | 5 | 6 |

### Study 2b (cell x step; cap 60)
| Stratum | Episodes | Drawn | Not drawn |
|---|---|---|---|
| mcp@L2 x step 2 | 27 | 5 | 22 |
| mcp@L2 x step 3 | 11 | 5 | 6 |
| mcp@L2 x step 4 | 10 | 5 | 5 |
| mcp@L2 x step 5 | 6 | 5 | 1 |
| none@L2 x step 2 | 22 | 5 | 17 |
| none@L2 x step 3 | 18 | 5 | 13 |
| none@L2 x step 4 | 13 | 5 | 8 |
| none@L2 x step 5 | 14 | 5 | 9 |
| none@L3 x step 2 | 32 | 5 | 27 |
| none@L3 x step 3 | 10 | 5 | 5 |
| none@L3 x step 4 | 6 | 5 | 1 |
| none@L3 x step 5 | 7 | 5 | 2 |

### Other sources (taken whole)
**hexddd01**

| Stratum | Episodes | Drawn | Not drawn |
|---|---|---|---|
| S1 failure | 4 | 4 | 0 |
| S1 repair | 1 | 1 | 0 |
| S2 failure | 5 | 5 | 0 |

**puzzle01**

| Stratum | Episodes | Drawn | Not drawn |
|---|---|---|---|
| P1 none | 7 | 7 | 0 |
| P2 none | 4 | 4 | 0 |

**puzzle02**

| Stratum | Episodes | Drawn | Not drawn |
|---|---|---|---|

**puzzle03**

| Stratum | Episodes | Drawn | Not drawn |
|---|---|---|---|
| P3r none | 2 | 2 | 0 |
| P5 none | 10 | 10 | 0 |
| P6 none | 5 | 5 | 0 |

**puzzle04**

| Stratum | Episodes | Drawn | Not drawn |
|---|---|---|---|
| P3r gate | 2 | 2 | 0 |
| P5 gate | 1 | 1 | 0 |

**traprate01**

| Stratum | Episodes | Drawn | Not drawn |
|---|---|---|---|
| DDD new identity | 51 | 51 | 0 |
| DDD oracle sub-goal | 33 | 33 | 0 |
| Hexagonal new identity | 13 | 13 | 0 |
| Hexagonal oracle sub-goal | 8 | 8 | 0 |

## Episode definitions as built

- **Study 1** (greenfield, v1.3 symbolic reports of the 65 accepted cells): one episode per run and file, all non-FF-CV05 findings of that file merged
  (multiplicity = number of findings, rule ids and their v1.3 tier in the evidence). The step is `final`.
- **Study 2b**: edge identities (rule, file, target) per step from `score/rescore/snapshots.json`; a failure episode is the new identities of one run,
  step and source file (multiplicity = edges); a repair episode is the inherited (step 1) identities of one file first absent at a step.
  Steps 2 to 5; the builder asserts the per-step new counts equal the registered ones for all 120 runs.
- **HEXDDD-01**: the ten rows of `hand-read-log.csv` (nine violations, one row recording the planted-debt fix as a repair). Evidence is the hand-read
  family code and the cited site only; the log's notes are not copied.
- **PUZZLE-01..04**: one episode per session and oracle sub-goal failing on the final step whose committed hand read (PUZZLE-04: the committed
  proposal) is trap or unclear; the step is the start of the trailing run of failures; the hunk is chosen in that step's diff from the cited files by
  identifier overlap with the oracle evidence text.
- **TRAPRATE-01**: per session, new admitted or exploratory identities first present at a step, grouped by step and file (rule class in the evidence),
  plus one episode per oracle sub-goal failing at the final step.

## Not reconstructable from committed records (evidence only)

- **Study 1**: no hunk. The greenfield trees are generated outside the repository and not committed (the reports point to an outcomes directory that is not
  in the records), and a greenfield build has no diff. All Study 1 cards are evidence only.
- **Study 2b**: no hunk. The step snapshots are in tarballs referenced by `archive/` manifests and `pointers.json`; the tarballs are not committed. Cards carry the rule,
  file, edge targets and edge kind from the committed score records.
- **TRAPRATE-01 oracle sub-goal episodes**: the oracle records carry only the sub-goal id and pass flag, no location; the card gives the introducing-step diff path.
- **Any card with `hunk: null`** lists the reason in `hunkNote` (for example the cited file is not in that step's diff). The TRAPRATE-01, PUZZLE and HEXDDD-01
  snapshots omit directories named `out/` (a `.gitignore` rule); those hunks come from the step diffs, which keep them, and the enclosing type then falls back to the diff text or file name.
- HEXDDD-01 `diffRef` paths show `<task-dir>` in place of the task directory name (s1-* and s2-* under `diffs/`).
- Enclosing types without a committed tree (HEXDDD-01, Study 1, Study 2b) fall back to the hunk text or the file name; `derivedFrom` marks it.

## Limits to carry into coding

- PUZZLE-04 adjudications are the coordinator's committed proposals, not the author's decisions; the sensitivity of the PUZZLE-04 cards to them is the 8 excluded gate-arm failures above (plus 3 trap proposals kept).
- PUZZLE sources are trap tasks, so frequencies reflect the traps offered (design section 6).
- Study 1 cards include advisory-tier coupling findings (for example instability), which are metric findings, not necessarily a construct; the tier is in the evidence.

## Second coder and freeze (2026-10-30)

A model panel coded all 266 cards (`panel/PROTOCOL.md`); Cohen's κ first coder vs panel majority 0.709, 0 unresolved.
Codebook v1 = v0 unchanged, frozen in `codebook-v1.md`. Report and counts: `panel-report.md`.
