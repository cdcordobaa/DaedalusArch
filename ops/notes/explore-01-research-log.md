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
- **Procedure:** the coordinator read the diffs and seeds only, and filled `results/pilot-hexddd-01/hand-read-log.csv` before `scores/` was opened. The author's spot-check of two rows is pending.
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

## Open items
- [ ] Author spot-check of two hand-read rows: S2 step 1 `RecordPayment`, and S1 step 5 `withRoomLock`.
- [ ] HEXDDD-01 §5.2 allows one revision after a FAIL (a real-repo seed). That decision belongs to the author.
- [ ] Read the DETECT-01 and PUZZLE-01 PRs, then add their results here.
- [ ] After the 2b scoring: decide which prototype detections to promote, as a versioned instrument change, and approve a puzzle pilot budget.

## Changelog
- 2026-10-21: log opened with entries 1–5.
