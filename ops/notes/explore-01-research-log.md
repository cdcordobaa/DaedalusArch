# EXPLORE-01: research log of the exploratory thread on agent violations, detection and puzzles

**Opened 2026-10-21.** This is a living log, newest entry last. It records an exploratory research thread that runs alongside the confirmatory Study 2b.

**Scope.** The thread asks three questions:
1. Can coding agents be stressed into architecture violations?
2. Which of those violations can the instrument detect, symbolically, semantically, or both?
3. How can we measure whether the tool helps agents avoid or repair them?

**Guardrails** (they apply to every entry):
- **Nothing here feeds Study 2b.** 2b is scored once at the freeze tag `v1.4-freeze-2026-10-20` with its registered script. Any detection this thread produces enters the instrument only after the 2b scoring, as a new versioned change. It is never applied back to 2b.
- **Frozen paths are untouched** (`src/`, `presets/`, `scripts/lib/`, `scripts/v1.3/`). All prototype code lives under `experiments/`.
- **Everything below is development material (dev):** it is used to design and tune, and cannot be evidence about itself. Any confirmatory use needs fresh cases, authored and sealed the way the 2b tasks were: hashes in the repository, content outside it.
- **Each run gets a design note before any call** ([`../README.md`](../README.md), "Pace").

## Entries

### 1. HEXDDD-01 design (2026-10-20)
- **Note:** [`hexddd-01-violation-elicitation-design.md`](hexddd-01-violation-elicitation-design.md) (PR #331).
- **Literature:** frontier models score near zero Hexagonal violations on small greenfield tasks, while brownfield and long-horizon work is much harder. Agent changes most often fail on fitting the existing project's conventions and constraints.
- **Families:** the note defines families H1–H7 (Hexagonal) and D1–D11 (DDD), with a detectability table: blocking, advisory, semantic-only, or undetectable today.
- **Cheap check, zero calls:** earlier pilots showed agent errors that D did not count, all in advisory rules.

### 2. HEXDDD-01 pilot run (2026-10-20, about 20:35–20:54 UTC)
- **Where:** branch `pilot/hexddd-01`, PR #332, not merged. Report: `Docs/DiagnosticRuns/pilot-hexddd-01-2026-10-20.md` (counts only, on the branch).
- **Setup:** a cloud sandbox (Ubuntu, Claude Code 2.1.304), declared as an exploratory difference from the pinned setup. Two brownfield seeds with planted debt: S1 Hexagonal and S2 DDD. Five pressure steps each, `claude-sonnet-5-5`, arm `none`.
- **Calls:** 16 in all, against a cap of 18: smoke check 1, confinement probes 5 of 5 passed, pilot 10.
- **Result:** D_seed = 0 in both runs, so the pilot **FAILS** the §5.2 pass bar.
- **Instrument observations:**
  - The DDD case produced 0 advisory findings at every step, including the seed. On that code the DDD rules give no signal.
  - The exposure counter supports Layered specs only.
  - In S1 the planted blocking finding disappeared at step 5.

### 3. Blind hand read of the pilot diffs (2026-10-21, commit `c18053641` on `pilot/hexddd-01`)
- **Procedure:** the coordinator read the diffs and seeds only, and filled `results/v1.4-pilot-hexddd-01/hand-read-log.csv` before `scores/` was opened. The author's spot-check of two rows is pending.
- **Findings:** 9 violations, none of them import-level.
  - **S1 (4, low or medium confidence):** D5, an in-process lock standing in for a consistency boundary; D4, booking and audit saved by one repository; D3, a revenue rule in an application service; H5, a locking mechanism on the port.
  - **S2 (5):** D4 twice, synchronous cross-aggregate writes without an outbox (medium); D5 twice, rules duplicated in a use case or with no value object; D9, a display view in a published contract.
- **Clean resistances (high confidence):** the vendor SDK, the HTTP header and SQL stayed in adapters, and cross-context calls went through contracts and anti-corruption layers. S1's planted debt was fixed at step 5. S2's was neither copied nor fixed.
- **Reading (dev, n = 2):**
  - The agent does err, but in families the symbolic rules do not see: consistency boundaries, rule placement and contract shape.
  - The FAIL therefore says the instrument lacks coverage. It does not show that the agent wrote clean code.
  - Only the consistency and cross-context pressure texts elicited errors. The layer-leak pressure texts did not.
  - This points toward the complementarity hypothesis (symbolic and semantic stronger together), but it does not test it.

### 4. Two follow-up tracks launched (2026-10-21, about 00:52 UTC; cloud routines, branches not merged)
**DETECT-01, coverage map and prototype detectors** (branch `explore/detect-01`):
- **Coverage map first:** `ops/notes/detect-01-coverage-map.md`. Every family and every hand-read case is labelled detected today, symbolically detectable with a new rule, semantic-only, or out of reach.
- **Fixtures:** each of the 9 cases as a positive fixture with a clean twin, plus 3 negative controls.
- **Symbolic prototypes:** 3–4 Cypher-over-facts detectors, with zero calls.
- **Semantic prototypes:** C4-style grounded questions, capped at 40 calls. Discriminating a fixture from its twin is the label-free validity signal (see [`sem-01-semantic-validity-plan.md`](sem-01-semantic-validity-plan.md)).
- **Complementarity table:** per family, which path sees it, symbolic, semantic or both.
- **Report:** `Docs/DiagnosticRuns/detect-01-2026-10-21.md`.

**PUZZLE-01, architecture puzzles** (branch `explore/puzzle-01`, zero calls):
- **Design note:** `ops/notes/puzzle-01-design.md`.
- **The puzzle:** a small brownfield codebase plus a multi-step task with three properties:
  - the shortest working move breaks a rule (the trap);
  - a clean solution exists that needs a specific order of moves;
  - functional tests pass for both solutions, so only the architecture separates them.
- **Construction:** retrograde, from the clean end state back to the seed. Each puzzle has its own independent answer-key script, so "violation" is not defined by the instrument; agreement between the two is a validity result.
- **Planned study (not run):**
  - arms: `none`, `mcp`, and a placebo tool;
  - outcomes: clean-solve rate, pass^k, caught-and-fixed, per sub-goal;
  - a difficulty ladder;
  - blind-control puzzles, where the tool should not help.
- **First 4 dev puzzles:**
  - P1, DDD cross-aggregate consistency (a blind control);
  - P2, DDD ownership of a shared rule;
  - P3, Hexagonal port signature;
  - P4, a Layered cycle (positive control).
- **Verification:** each puzzle is checked mechanically, and the instrument's view of seed, clean and trap is recorded.
- **Report:** `Docs/DiagnosticRuns/puzzle-01-2026-10-21.md`.

### 5. Case bank, proposed (2026-10-21)
After each run, a zero-call step turns its material into reusable cards (YAML). Each card records its provenance (run, commit, file:line, sha256), family, judge and instrument verdict, and its split, `dev` or `held-out`. A case used to improve the instrument is never used to evaluate it.

| Hand read | Instrument | Bin | Reused as |
|---|---|---|---|
| violation | caught | true positive | regression test, puzzle trap, thesis example |
| violation | missed | blind spot | rule or C4 backlog item, blind-control puzzle |
| fine | flagged | false positive | precision case, rule fix |
| agent resisted pressure | — | too-easy trap | bottom rung of the difficulty ladder |
| seed or prompt that worked | — | puzzle material | puzzle library |
| paper claim | — | literature card | claims ledger |

The PUZZLE-01 run seeds the bank with cards for its 4 puzzles and for the 9 hand-read observations. A design note (`case-bank-design.md`) follows after the 2b scoring.

### 6. Hand read against the instrument's scores (2026-10-21, commit `b9b0ba96` on `pilot/hexddd-01`)
- **Spot-check:** the author checked two hand-read rows (S2 step 1 `RecordPayment`; S1 step 5 `withRoomLock` and the payment charge inside the transaction) and agreed with both.
- **Comparison** (`results/v1.4-pilot-hexddd-01/hand-read-vs-scores.md`, zero calls): of the 9 hand-read violations, the instrument caught 0, 2 were adjacent and 7 were missed.
  - The 2 adjacent findings, FF-SO02 and FF-C03, sit on the same port or adapter but are not attributable to the change.
  - Debt status agrees in both runs: S1's planted debt was fixed, S2's persisted.
  - There were 2 false positives: the FF-CV03 "Repo" inside "Report" defect (N18).
- **Where S1's advisory growth (36 to 52) came from:** 12 test-pairing noise findings, 2 naming false positives, and 1 each from FF-SO02 and FF-C03. None of it tracks a hand-read violation.
- **Reading:** the rules that fired measure size and coupling, not consistency, rule placement or contract shape. The 9 rows become blind-spot cards (dev).

### 7. DETECT-01 and PUZZLE-01 results (2026-10-21, about 01:20 UTC; PRs #334 and #335, not merged)
**DETECT-01** (`ops/notes/detect-01-coverage-map.md`, `Docs/DiagnosticRuns/detect-01-2026-10-21.md` on `explore/detect-01`):
- **Coverage map.** Of the 9 hand-read misses, 6 are symbolically reachable and 3 are semantic-only. Every reachable case needs a fact the frozen extractor does not emit:
  - calls to port (interface) methods;
  - external types in signatures (behind `apg2`);
  - statement-level guards;
  - return-type shapes.
- **Symbolic prototypes** (zero calls): an experimental extractor plus 7 Cypher rules on `cypher-interp`.
  - **Fixtures:** every positive is flagged except two forms that are out of scope by design. No twin and no negative control is flagged.
  - **Rebuilt pilot trees:** all 6 reachable cases are found at the hand-read step and line. One rule (X1b) was adjusted after it first missed S1, so this result is partly fitted (dev).
  - **Comparison trees:** no finding on the Layered, Hexagonal or DDD comparison trees. Clean and DDD trees produced 26 hits that are true to the construct, but there the norm is not declared.
- **Semantic prototypes** (32 of the 40-call cap, `claude-sonnet-5-5`):
  - all citations grounded, 1 abstention;
  - twin discrimination 9 of 11 (the D3 question did not separate);
  - the 3 semantic-only pilot cases flagged at the step that introduced them;
  - 1 false positive on a negative control at the current D5 threshold.
- **Found on the way:** the committed S1 seed on `pilot/hexddd-01` lacks `src/application/ports/out/`, because a `.gitignore` `out/` rule excluded it. The seed builder regenerates it with matching hashes.

**PUZZLE-01** (`ops/notes/puzzle-01-design.md`, `Docs/DiagnosticRuns/puzzle-01-2026-10-21.md` on `explore/puzzle-01`, zero calls):
- **Four dev puzzles, all VALID.** In every puzzle tsc reports 0 errors, the tests pass on both the clean and the trap solution and fail on the seed, the oracle passes the clean solution and fails every trap sub-goal, the trap changes fewer lines than the clean solution, and the hint audit reports 0 FAIL.
- **What the instrument sees of each trap:**
  - P1, DDD transfers: invisible (blind control).
  - P2, DDD loyalty across 2 contexts: partial. FF-DS02 sees the import route; the alternative trap is invisible.
  - P3, Hexagonal shipping quotes: invisible, because FF-P01 checks vendor packages only in the domain.
  - P4, Layered library loans: visible through FF-S01 (positive control).
- **Case bank seeded:** 4 puzzle cards and 9 HEXDDD-01 observation cards. Instrument verdicts and the spot-check status are to be updated from entry 6.
- **Proposed pilot, awaiting author approval:** 4 puzzles × `none`/`mcp` × 5 runs = 40 sessions, hard cap 44. A placebo arm needs its own separate approval later.

**Reading (dev):**
- The symbolic path can reach two thirds of the observed misses once a few facts are extracted.
- The semantic path covers the rest, and it separates violations from their twins in most cases.
- That is the first concrete map of where the two paths complement each other. It is not yet a test on held-out cases.

### 8. Puzzle baseline, DETECT-02 tool and precision (2026-10-21 to 2026-10-22)
**PUZZLE-01 baseline** (`Docs/DiagnosticRuns/puzzle-01-baseline-2026-10-21.md`, `results/v1.4-puzzle-01-baseline/`):
- **Setup:** agent alone, rules written in each seed's `ARCHITECTURE.md`, 54 of 72 calls.
- **Clean solves:** P1 0/5, P2 0/5, P4 5/5. P3 was dropped.
- **Detection:** the frozen instrument and DETECT-01 flagged 0 of the 12 trap failures.
- Provisional until the hand read.

**DETECT-02** (`experiments/detect-02/`, PR #345): new graph facts (write footprint, context ownership) and the `check_consistency` MCP tool, symbolic only.
- On the puzzle trees: 19/19 trap trees flagged and 0 false positives (dev).
- The PUZZLE-02 pull-arm run is launched on P1 and P2 (`ops/notes/puzzle-02-tool-arm-note.md`).

**Precision phase 1** (`ops/notes/detect-02-precision-note.md`, PR #351): 10 correct DDD patterns as fixtures.
- 4/20 false-positive runs before any change, all of them predicted in the note.
- 0/20 after three logged rule revisions.
- On 13 human DDD repos: 1 true cross-context write found with declared specs, and 12 false hits with inferred roots, which are now development material.
- The held-out check is deferred until the usage reset; the sealed set is unopened.

### 9. Study 2b closed (2026-10-22)
- **D_sem:** not run, because the C4 precondition was not met. The pilot passed; the six-case set came out 5/6 on a severity field of one near-miss twin.
- **Evasion items 4 and 5:** not flagged.
- Results report §7; addendum 4. The C4 severity calibration goes to the v1.5 semantic track (`ops/notes/v15-plan.md` §2).

### 10. Edit gate built and smoke-tested (2026-10-22)
**Edit gate** (`experiments/edit-gate/`, `Docs/DiagnosticRuns/edit-gate-build-2026-10-23.md`, `results/v1.5-edit-gate-build/`): the push delivery of `ops/notes/v15-edit-gate-design.md`.
- **Mechanism:** option A works on CLI 2.1.308. PostToolUse and Stop hooks, passed inline through the arm's `--settings`, fire under the frozen argv, with the CLI running as the generator user. A root-side hub runs `check_consistency` and replies with the new findings only. The fallback was not needed.
- **Zero calls:** 12/12 unit tests pass. The real CLI was run against a scripted API: the hook text reaches the next request, de-duplication holds, the Stop hook blocks once, and a switch-off attempt fails.
- **Isolation:** 0 readable fingerprint files, after closing root's `tsx` cache, which had been readable.
- **Calls:** 2 of 4. The smoke passed: the model quoted the finding's file, line and label. The probe passed: 0 canaries leaked, and the gate still fired after the switch-off attempt.
- **Latency:** hub p50 130–145 ms on P1 and P2 trees, p95 171–204 ms. No puzzle session was run.

## Open items
- [x] Author spot-check of two hand-read rows: agreed (entry 6).
- [ ] HEXDDD-01 §5.2 allows one revision after a FAIL (a real-repo seed). That decision belongs to the author.
- [x] Read the DETECT-01 and PUZZLE-01 PRs (entry 7).
- [ ] Fix the S1 seed `.gitignore` gap on `pilot/hexddd-01`; update the case-bank cards with the entry 6 verdicts.
- [ ] Author: approve or change the PUZZLE-01 pilot (40 sessions, cap 44).
- [ ] After the 2b scoring: decide which prototype detections to promote, as a versioned instrument change, and approve a puzzle pilot budget.

## Changelog
- 2026-10-22: entry 10 (edit gate built and smoke-tested).
- 2026-10-22: entries 8 (puzzle baseline, DETECT-02 tool, precision) and 9 (Study 2b closed).
- 2026-10-21: the sources this thread cites (HEXDDD-01, DETECT-01 and PUZZLE-01 literature, plus the search-session list) are consolidated in `Docs/sources/sources-ledger.md` (keys in `Docs/sources/sources.bib`).
- 2026-10-21: entry 7 (DETECT-01 and PUZZLE-01 results).
- 2026-10-21: entry 6 (hand read against scores); spot-check closed.
- 2026-10-21: log opened with entries 1–5.
