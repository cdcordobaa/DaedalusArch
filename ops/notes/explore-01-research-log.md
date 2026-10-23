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

### 10. COMPREHEND-01 built, not run (2026-10-22)
**Question:** does the property graph help agents understand an architecture: more accurately, more cheaply, or both?
Design: `ops/notes/comprehend-01-design.md` (DRAFT, committed first). Build report:
`Docs/DiagnosticRuns/comprehend-01-build-2026-10-23.md`. Zero model calls.
- **Tools:** four symbolic graph tools (`context_map`, `who_writes`, `trace`, `impact`) in a separate experimental
  server (`experiments/detect-02/mcp/`), 15 tests. The first call builds the index in 0.1–1.9 s (ddd-forum, 250 files,
  is the slowest); warm calls take ≤ 9 ms.
- **Bank:** 30 questions over P1, P2 and P4, four precision fixtures and three human DDD repositories with declared
  specs. Keys were hand-checked and committed before any tool ran.
- **Cross-check:** the tools answer 16/16 G items correctly after one display fix (T1), and 0/3 of the Gw items, as
  predicted. All three misses are coverage gaps: a mapped-type parameter, an untyped result from an uninstalled
  package, and an ORM hook with a callback registry.
- **Dry run:** a scripted fake model ran both arms. The plan, re-run, cap, confinement, scoring and ledger all behave
  as scripted (63 fake spawns, 0 calls).
- **Next:** the author reads the design note and approves or changes the pilot (62 sessions, cap 66).

### 11. Edit gate built and smoke-tested (2026-10-22)
**Edit gate** (`experiments/edit-gate/`, `Docs/DiagnosticRuns/edit-gate-build-2026-10-23.md`, `experiments/edit-gate/results/`): the push delivery of `ops/notes/v15-edit-gate-design.md`.
- **Mechanism:** option A works on CLI 2.1.308. PostToolUse and Stop hooks, passed inline through the arm's `--settings`, fire under the frozen argv, with the CLI running as the generator user. A root-side hub runs `check_consistency` and replies with the new findings only. The fallback was not needed.
- **Zero calls:** 12/12 unit tests pass. The real CLI was run against a scripted API: the hook text reaches the next request, de-duplication holds, the Stop hook blocks once, and a switch-off attempt fails.
- **Isolation:** 0 readable fingerprint files, after closing root's `tsx` cache, which had been readable.
- **Calls:** 2 of 4. The smoke passed: the model quoted the finding's file, line and label. The probe passed: 0 canaries leaked, and the gate still fired after the switch-off attempt.
- **Latency:** hub p50 130–145 ms on P1 and P2 trees, p95 171–204 ms. No puzzle session was run.

### 12. v1.5 U3: the C4 severity rubric (2026-10-22)
- **Why:** every v1.4 six-case miss was the severity field. The frozen prompt asks C4 only to "rank the work", so it ranked by the size of the fix, while the manifests meant how far the code departs from declared intent (`ops/notes/v15-u3-severity-note.md`).
- **What:** a rubric as a prompt variant (`experiments/v15-u3/`, `c4-v0.2+u3-r1`: grant → low; declared rule broken → high; otherwise by what the dependency does). It was run on the six-case set plus six new pairs whose answers were written first, with `claude-sonnet-5-5`, 2 runs each.
- **Result:** 24/24 targets correct in both runs, on both sets. Severity, exception and intent were all stable; 0 false claims and 0 hallucinated citations. A 4-call control with the frozen prompt reproduces case 5's severity miss and shows an intent-label slip ("consistent" read as "the rule matches the docs") that the rubric removes. 52 of 60 calls (`Docs/DiagnosticRuns/v15-u3-severity-2026-10-23.md`).
- **Caveat:** this is a ceiling on a designed set. The same session wrote the rubric and the cases, and severity follows from intent on 14 of the 24 targets. The next checks are the non-author row, a Gemini arm and the non-target findings.

### 13. PUZZLE-03: hand read, three more puzzles, agent baseline (2026-10-22)
`Docs/DiagnosticRuns/puzzle-03-2026-10-23.md`, `experiments/puzzle-03/`, `results/v1.4-puzzle-03-baseline/`:
- **Hand read of the PUZZLE-01 baseline:** 11 trap, 1 over-rejection (c07, P2-SG2-a). After it: P1 0/5, P2 1/5
  (provisional), P4 5/5. Author spot-check pending on c07 and c10.
- **Three DEV puzzles, all VALID (zero calls):**
  - P3r: P3 rebuilt; the clean port was written anew.
  - P5: two-way cross-context ferry seats, with a runtime stack oracle.
  - P6: Layered, with a planted controller-to-gateway skip that the requests ask to stay consistent with; FF-S03
    sees the trap.
  - Gaming fixtures (renames, a batch unit of work, a synchronous fake event) fail the oracles. The PUZZLE-01 P3
    oracle passes the P3r rename, DETECT-02 misses the fake event, and the frozen instrument misses the P6 rename.
- **Agent alone** (`claude-sonnet-5-5`, 50 of 53 calls, one restart redraw):
  - P3r 1/5 clean (4/5 if the fee-on-fallback reading is accepted).
  - P5 0/5: 5/5 sync writes into the other context, all flagged by DETECT-02.
  - P6 0/5: 5/5 copied the precedent, all flagged by the frozen instrument (FF-S03).
  - Provisional until the hand read of 17 FAILs.
- **Reading (dev):** P6 is the first puzzle the frozen instrument sees that the agent alone fails at 2/5 or below.
  The condition for sizing an `mcp` arm is met, and P5 meets it for a DETECT-02 arm.

### 14. PUZZLE-02 tool arm `mcp-detect` on P1 and P2 (2026-10-22, about 03:20–03:43 UTC; branch `pilot/puzzle-02-tool-arm`, PR not merged)
- **Spec and records:** run note `puzzle-02-tool-arm-note.md`; plan committed before any call
  (`experiments/puzzle-02-tool-arm/`); report `Docs/DiagnosticRuns/puzzle-02-tool-arm-2026-10-22.md`; records
  `results/v1.4-puzzle-02-tool-arm/`.
- **Setup:** the baseline's plan and isolation, reused. The only additions are the §4 frame sentence and the DETECT-02
  server (`check_consistency`), which runs as root behind a socket relay. CLI 2.1.307 (baseline 2.1.305, recorded as an
  exploratory difference).
- **Calls:** 34 of 38. Smoke, confinement probe and the zero-call isolation checks passed. One container restart:
  c06 was redrawn as c11.
- **Result** (provisional until the hand read; per puzzle, against the baseline `none`):
  - **P1:** 4/5 clean vs 0/5. The agent's own call flagged R-D4 at step 1 in every run, and a later call in the same
    turn came back clean (caught-and-fixed at tool-call grain: 4; at snapshot grain: 0). The fifth run is a
    functional failure.
  - **P2:** 0/5 by the oracle vs 0/5. The tool returned clean everywhere, yet no run wrote points inside the command;
    all five used an event handler in sales on the relay. That is the pre-registered over-rejection P2-SG2-a, so P2
    is 3/5 if the author accepts it (two runs are functional failures).
- **Predictions:** P1 held; "P2 improves less than P1" held, but by another mechanism than predicted.
- **Reading (dev):**
  - On P1 the tool + instruction moved an extreme split.
  - On P2 the structural change came without any finding, so the caveat "tool + instruction vs neither" decides what
    it can be attributed to. A placebo arm would separate the two.

### 15. Hand reads: PUZZLE-03 baseline and PUZZLE-02 tool arm (2026-10-22)
Zero model or generator calls. Records: `results/v1.4-puzzle-03-baseline/hand-read.md`,
`results/v1.4-puzzle-02-tool-arm/hand-read.md`. A dated "after the hand read" section was added to each report. PR #363 (entry 14) was merged first.

**PUZZLE-03 baseline: 17 oracle FAILs → 17 trap, 0 over-rejection, 0 unclear.**
- P3r c02: the port is typed with `FastshipRate`, and the service imports the SDK's error at runtime.
- P5: 10/10 are the sailing's write inside the booking command.
- P6: 5/5 inject `MechanicGateway` into the controller.

PUZZLE-03 functional failures:
- P3r (3): a request ambiguity (the fee is also added on the fallback).
- P5 (3): a functional miss (`book` throws on a cancelled sailing).

Counts after the hand read are unchanged: P3r 1/5 [.04, .62], P5 0/5, P6 0/5. Spot-check #9 (c14 P5) and #17 (c15 P6),
drawn with seed 20261023.

**PUZZLE-02 tool arm: 6 oracle FAILs → 0 trap, 6 over-rejection, 0 unclear.**
- The five SG2 FAILs are P2-SG2-a. `PlaceOrder` saves only the order, the relay delivers the stored event, and the
  handler calls membership's published write. There is no duplicated rule: the tier stays in `Member` and the earning
  rule exists once.
- c05 SG1 is P2-SG1-b.
- Rule 3 placement is recorded, not scored: in four trees the earning rule sits in a sales application handler.

PUZZLE-02 functional failures:
- P1 c11: a real defect. Transfer ids repeat across commands, so the receiving account drops later transfers as
  duplicates.
- P2 c01 and c03: `total` is reported before the discount.

Counts after the hand read: P1 4/5 vs 0/5 (unchanged); **P2 3/5 [.23, .88] vs 1/5 [.04, .62]**, trapped 0 vs 4.
Spot-check #3 (c04) and #6 (c10), drawn with seed 20261022.

**Reading (dev):** on P2 the arm moved the trapped count from 4 to 0 with no finding from the tool. 3/5 against 1/5
is not separable at n = 5.

### 16. COMPREHEND-01 pilot: files only vs files plus graph tools (2026-10-22)
`Docs/DiagnosticRuns/comprehend-01-pilot-2026-10-23.md`, `experiments/comprehend-01/results/pilot/`:
- **Run:** 30 questions × 2 arms × 1 run, `claude-sonnet-5-5`; 63 of 64 calls. The generator was isolated as in the
  puzzle baselines: uid 1500, tree copies, the clone closed with chmod only. 0 confinement findings.
- **Two revisions, both before any question:**
  - R1: the cap of 64 and the isolated layout.
  - R2: `--safe-mode` (from EFF-01's argv) dropped the graph server in the FG smoke. Both arms dropped it, and an
    init check now stops the pilot on a server mismatch.
- **Accuracy:** F 0.933, FG 0.900. On non-Gw items it is 0.963 each, a difference of 0.00, so "more accurately"
  fails (criterion ≤ 0.05).
- **Cost:** token ratio FG/F 0.835 on non-Gw items (0.827 on the human repositories); wall time −15%; −1.5 tool calls
  per item. "More cheaply" holds (< 0.9). `impact` was never called.
- **Wrong FG answers:**
  - LH-WW1: `who_writes` misses the `UpdatePartial<Account>` writes (D2); the agent used it unchecked.
  - DF-C1: `trace` stops at the ORM hook and event registry, and `who_writes` names the port, not `MemberRepo` (D2).
    The result is a naming slip that F makes too.
  - P2-P1: a placement with no graph call (D4). It is a possible key dispute: the PUZZLE-02 hand read (entry 15) accepts the same
    sales-side handler shape on P2 as clean (P2-SG2-a).
  - D1: 0. All three Gw items were predicted before the run.
- **Reading (dev):** F names the rule of every puzzle trap step (PR6), so the PUZZLE-01 trap rate is not a
  comprehension failure. The graph is a cost saver at equal accuracy here, not an accuracy aid. Delivery at the moment
  of action (the edit gate) is the track this points to.

### 17. v1.5 U4: S3 aggregate facts and S2 confirmation (2026-10-22)
`Docs/DiagnosticRuns/v15-u4-2026-10-23.md`, `experiments/v15-u4/`, note `ops/notes/v15-u4-facts-confirmation-note.md` (r1 before any call, r2 after the S2 failure). 73 of 75 calls, `claude-sonnet-5-5`:
- **Baseline first (zero calls):** with R1–R3, both declared and inferred roots give one hit on the 13 human DDD repositories, the lucashang true hit. The 12 earlier false hits are gone symbolically, so S3 cannot lift the hit count.
- **S3 passes:**
  - the model's grounded roots match 22 of 23 declared roots with none wrong (19/23 by declared name), against 13 of 31 for inferred roots;
  - under the model's roots the true hit stays and there is no false hit;
  - it abstains or names no root on the two functional repositories;
  - ownership is right 44/44, a weak test, because the folders name the contexts;
  - 131 of 132 verdicts were stable.
- **S2 fails:**
  - D5 recall stays at 11/16. The relaxed proposer reaches all 5 lock-form trees, but the model rejects the overlap check as a "cross-aggregate check", which the D5 rule text exempts;
  - it adds 4 false positives (1 if the H5 fixtures' identical D5 code counts as unlabelled);
  - 0 confirms on the legit precision fixtures, 1 true D4 rejected (`saveAudited`), 37/37 confirms grounded.
- **One fix (r2, post-hoc):** a rule text that names unowned set invariants confirms the lock form 5/5. It also confirms the pre-lock step 1 and the P10 legit fixture, so the boundary moved rather than sharpened. Step 1 and step 2 hold the same invariant, and the label separates them only by what the agent introduced.
- **Reading (dev):** S3 is ready to feed the rules where a spec is silent (the facts contract for U1). S2 needs a decision on what D5 means for set invariants before the confirmation step can help. That is a construct question for the author, not a prompt to tune.
### 18. PUZZLE-04: the tool arms on every trapping puzzle (2026-10-22)
`Docs/DiagnosticRuns/puzzle-04-2026-10-23.md`, `experiments/puzzle-04/`, `results/v1.4-puzzle-04/`:
- **Built first (zero calls):** the edit-gate hub also runs the frozen layer rules FF-S01–S03 (`check_diff` fast path,
  delta against the seed). The pull sentence now names `check_file` and `check_diff` (hint audit 0 FAIL). Unit tests
  20/20. On the baseline trees the extended hub flags P1 5/5, P2 4/5, P3r 0/5, P5 5/5 and P6 5/5.
- **Runs** (`claude-sonnet-5-5`, CLI 2.1.308, 109 of 121 calls, no redraw, isolation achieved with the clone only
  chmod-closed): `gate` on P1, P2, P5, P6 and P3r (blind control); `pull` on P5 and P6.
- **Clean solves, registered (provisional until the hand read):**
  - P6: 5/5 under both arms (baseline 0/5): the only extreme split.
  - P5: 0/5 under both, but every run fails only the under-specified step-3 test. The oracles pass in 4/5 (gate) and
    5/5 (pull), against 0/5 at baseline.
  - P1 gate 2/5 and P2 gate 2/5. P1 is 5/5 under the new P1-SG1-c (an unused `saveAll` left on the port). P2 is 4/5
    under the categories entry 15 accepted (P2-SG2-a + P2-SG1-b), and 5/5 with the new P2-SG1-e. PUZZLE-02's pull,
    after its hand read: P1 4/5, P2 3/5.
  - P3r gate 0/5, with 0 gate replies (the blind control held).
- **Mechanism:** 28 gate keys shown, 28 resolved, mostly within the turn; 0 fail-open; hub p95 451 ms. Under pull, P5
  agents wrote the relay design without a finding (4/5).
- **Blind spot found:** P5 gate c07 moved a cross-context write into the composition root's facade, where
  `check_consistency` does not look.

### 19. DRIFT-01: the Study 2b drift protocol on DDD and Hexagonal seeds (2026-10-22)
Design: `ops/notes/drift-01-design.md` (committed before any call). Reports: `Docs/DiagnosticRuns/drift-01-rescores-2026-10-23.md` (Part A, zero calls) and `Docs/DiagnosticRuns/drift-01-pilot-2026-10-23.md`. Records: `results/v1.4-drift-01/`.
- **Part A, re-score of HEXDDD-01** with the frozen rules plus R-D4 and R-XCTX:
  - D_v15 is 2 on both S1 (inferred roots) and S2, against a frozen D of 0;
  - the per-step new identities are S1 0/0/2/0/0 and S2 2/0/0/0/2;
  - 3 of the 9 hand-read cases are caught at their step (7 of 9 with every DETECT-02 rule; fitted, dev);
  - the Study 2b step-5 trees are not in the repository, so that precision check was skipped.
- **Pilot:** `claude-sonnet-5-5`, CLI 2.1.308, shared step 1 then steps 2–5 per arm, 3 replicates, the puzzle isolation with the clone closed in place. 82 of 94 calls, 0 redraws, 78/78 turns completed.
- **ΣD_v15** (never pooled):
  - DDD `t1`: none 6 (2, 2, 2), pull 0, gate 0;
  - Hexagonal `t2`: none 1, pull 0, gate 0;
  - D_frozen is 0 everywhere;
  - `none`'s identities are the step-5 synchronous `IssueInvoice → Order` write, the HEXDDD-01 case-8 shape.
- **The mechanisms differ:**
  - the gate showed the inherited step-1 `RecordPayment` cross-context write at step 2, and the agent removed it in 3/3 blocks;
  - pull's tool reported that write in 13 of 14 calls, and it stayed in 3/3 blocks. Pull's agents still avoided the new write (a read-only status query instead).
- **Predictions:** P1, P2 and P5 hold; P3 (gate beats pull on D) fails as a tie at 0; P4 holds for the gate and fails for pull.
- **Caveats:** the replicates are nearly identical, t2 rests on inferred roots (its one `none` identity is a candidate false positive), and there is no functional acceptance beyond tsc. Four identities are listed for the author's hand read.

### 20. REPO-SCOUT for COMPREHEND-02: large repositories and the graph against the compiler (2026-10-22)
`Docs/DiagnosticRuns/repo-scout-comprehend-02-2026-10-23.md`, `experiments/repo-scout/`. Zero model calls:
- **Measured:** 82 repositories at pinned commits (the 74 of the v1.3 external and wild sets, plus Medusa, Backstage,
  Novu, Amplication, Twenty, Immich, Unleash and Vendure). For each: files, LOC, tsc, declared boundaries and licence.
  All HEADs matched their pins.
- **All five criteria:** only **Medusa** (2,447 files, 233,000 lines; own `tsc --build` passes on 13/13 packages) and
  **Backstage** (1,987 files, 200,000 lines; own `yarn tsc` 0 errors).
  - **Novu** meets four: its API type check was not reproduced.
  - **No v1.3 repository qualifies.** N45's three: immich is AGPL, medplum has no declared boundaries, podkrepi-api
    ranks 5th.
  - **Copyleft:** Twenty, Immich and Unleash are AGPL, Vendure GPL-3.0.
- **Extractor at scale:** 4–15 s per tree. tsc coverage in the literal view: 1.000 on Medusa, Novu and Amplication,
  0.995 on Backstage. Its 26 misses are inline `import('./X').X` types in the core service-ref table, a construct new
  to the instrument.
- **Graph against the compiler** (9 questions, compiler truth through the ts-morph language service, one answer per
  tree checked by hand):
  - the index has 95–100% of the call sites on Backstage and 87–100% on Novu, at 100% precision. The one exception is
    Novu's inherited repository writes: 100% recall at 9% precision, because edges do not record the receiver's type;
  - on Medusa it has 0–3%: the cross-module code is in `createStep`/`createWorkflow` callbacks, which are not units;
  - `who_writes` was empty on all three trees, and no tool lists the callers of a port.
- **Reading (dev):** the graph is complete where the code is classes and interfaces. Its tools are not: they lack a
  caller query and depend on aggregate roots. Recommended trees: Backstage (primary), Novu (after its build is shown),
  Medusa (the Gw control). No graft is needed for declared boundaries; a graft for a distant-writer trap is sketched
  only.

## Open items
- [x] Author spot-check of two hand-read rows: agreed (entry 6).
- [ ] HEXDDD-01 §5.2 allows one revision after a FAIL (a real-repo seed). That decision belongs to the author.
- [x] Read the DETECT-01 and PUZZLE-01 PRs (entry 7).
- [ ] Fix the S1 seed `.gitignore` gap on `pilot/hexddd-01`; update the case-bank cards with the entry 6 verdicts.
- [ ] Author: approve or change the PUZZLE-01 pilot (40 sessions, cap 44).
- [ ] After the 2b scoring: decide which prototype detections to promote, as a versioned instrument change, and approve a puzzle pilot budget.
- [x] Hand-read the PUZZLE-02 tool-arm oracle FAILs (entry 15; `results/v1.4-puzzle-02-tool-arm/hand-read.md`).
- [ ] Author: spot-check the two seeded picks of each hand read (entry 15): PUZZLE-03 #9 and #17, PUZZLE-02 #3 and #6.
- [x] Author: read the COMPREHEND-01 design note; decide D1–D4 and approve or change the pilot (62 sessions, cap 66) (entry 10). Approved as written, with a cap of 64; run in entry 16.
- [ ] Author: COMPREHEND-01 key decision on P2-P1 (sales-side handler), whether a ×3 variance run is worth it, and graph revisions 1–2 (entry 16).
- [ ] Author: decide whether an unowned set invariant (the lock form) is D5 and whether a pre-existing copy counts. This decides S2's next step (entry 17).
- [ ] Author: choose the COMPREHEND-02 trees (recommended Backstage, Novu, Medusa as the Gw control) and decide which graph changes come first: a caller query, receiver typing, units for factory callbacks, and edges for overloaded methods and inline import types (entry 20).
- [ ] Author: hand read of the PUZZLE-04 cases (`results/v1.4-puzzle-04/oracle-verdicts-to-read.md`; new categories P1-SG1-c and P2-SG1-e decide P1 and P2 for the gate) (entry 18).
- [ ] Author: hand-read the 4 new DRIFT-01 identities and the inherited `RecordPayment` pair (entry 19).

## Changelog
- 2026-10-22: entry 20 (REPO-SCOUT for COMPREHEND-02).
- 2026-10-22: entry 19 (DRIFT-01).
- 2026-10-22: entry 18 (PUZZLE-04).
- 2026-10-22: entry 17 (v1.5 U4 S3 facts and S2 confirmation).
- 2026-10-22: entry 16 (COMPREHEND-01 pilot).
- 2026-10-22: entry 15 (hand reads: PUZZLE-03 baseline, PUZZLE-02 tool arm).
- 2026-10-22: entry 14 (PUZZLE-02 tool arm `mcp-detect`); open item: author hand read of its 6 oracle FAILs (P2-SG2-a, P2-SG1-b).
- 2026-10-22: entry 13 (PUZZLE-03).
- 2026-10-22: entry 12 (v1.5 U3 severity rubric).
- 2026-10-22: entry 11 (edit gate built and smoke-tested).
- 2026-10-22: entry 10 (COMPREHEND-01 built, not run).
- 2026-10-22: entries 8 (puzzle baseline, DETECT-02 tool, precision) and 9 (Study 2b closed).
- 2026-10-21: the sources this thread cites (HEXDDD-01, DETECT-01 and PUZZLE-01 literature, plus the search-session list) are consolidated in `Docs/sources/sources-ledger.md` (keys in `Docs/sources/sources.bib`).
- 2026-10-21: entry 7 (DETECT-01 and PUZZLE-01 results).
- 2026-10-21: entry 6 (hand read against scores); spot-check closed.
- 2026-10-21: log opened with entries 1–5.
