# PUZZLE-01 baseline plan: the agent alone (arm `none`)

**Exploratory, DEV split, NOT part of Study 2b.** Committed and pushed **before any generator call**. Nothing here
changes `src/`, `presets/`, `scripts/lib/`, `scripts/v1.3/`, the tag `v1.4-freeze-2026-10-20` or any Study 2b file.
Design: `ops/notes/puzzle-01-design.md` (sha256 `09f461df…f137`, branch `explore/puzzle-01`, PR #335). Revisions R1,
R4 and R7 are in `revisions.md`. Hand-read categories (R4) are in `oracle-hand-read-categories.md`. The isolation
procedure (R2, R3) is in `isolation.md`.

**Question.** When coding agents work alone, under rules the repository states in writing (`ARCHITECTURE.md`, R7),
do they fall into the architecture traps of the PUZZLE-01 dev puzzles? Each puzzle's own oracle decides "trapped".
The DaedalusArch tool is not used. This baseline is the reference a later tool arm must beat.

## 1. Design

| Item | Value |
|---|---|
| Arm | `none` only |
| Generator | `claude-sonnet-5-5` through Claude Code CLI **2.1.305** (`claude --version` in this sandbox; HEXDDD-01 ran 2.1.304) |
| Sandbox | claude.ai cloud container (Claude Code on the web), environment runner `release-66c6e19d9d-ext`, Ubuntu 24.04.5 LTS, Linux 6.18.44 x86_64 |
| Node / npm | v22.22.0 / 10.9.4 |
| Order seed | `20261021` (mulberry32 Fisher–Yates shuffle of puzzle × run cells, `run-baseline.ts`) |
| Puzzles | **P1** `p1-transfers`, **P2** `p2-loyalty`, **P4** `p4-library-holds`. **P3 is dropped** (R1: its clean solution could not be restored exactly) |
| Runs | 5 per puzzle: 15 sessions, 45 step turns |
| Session | the 3 steps of one puzzle, in order, one step per turn, in one work tree (each turn is a fresh CLI process, `--no-session-persistence` is part of the frozen argv, as in HEXDDD-01) |
| Repair turns | 0 |
| Frame | the HEXDDD-01 brownfield frame, verbatim (`FRAME` in `run-baseline.ts`): "The current directory holds an existing TypeScript service. Change request: … Keep every existing feature working. Before you finish, type-check …". No style, layer or folder name. The arm `none` adds no sentence |
| Agent's workspace | the harness skeleton (`package.json`, `node_modules` link) + the puzzle's `seed/` with `ARCHITECTURE.md`. Nothing else (R2) |
| Tools | the frozen argv: `Read,Write,Edit,Glob,Grep,Bash`, Bash allowed only for the one exact type-check command, `--permission-mode acceptEdits`, no MCP, customizations off |
| Per-turn timeout | 1,200,000 ms |

## 2. Calls (hard caps, never raised)

| Phase | Cap | Planned |
|---|---|---|
| Smoke | 1 | 1 |
| Read probe + confinement probes | 5 | 1 read probe + 4 confinement probes (`escape-write`, `node-modules-overwrite`, `command-chaining`, `allowed-command`; `tsc-flag-injection` is the one left out, for the read probe's slot) |
| Baseline turns | 66 | 45 (15 sessions × 3), plus whole-session redraws |
| **Total** | **72** | |

The cap of 66 baseline turns is the brief's (4 × 5 × 3 = 60, plus two redraws of 3 turns). With P3 dropped the plan
needs 45. The caps are unchanged. Every spawn of the CLI except `--version` is written to `calls.jsonl` and refused past
the phase or total cap, so harness retries count too. `turns.jsonl` records per turn the model ids reported in
`modelUsage`.

**Redraws.** A session is redrawn whole (new neutral id, same puzzle and run index) when one of its turns ends in an
infrastructure state: harness status `infrastructure`, `envelope-unreadable`, `model-mismatch`, or a harness error.
At most **2 redraws in total**. Agent behaviour (`completed`, `agent-error`, `timeout`, a broken build, a tampered
skeleton) is never grounds for a redraw. Such a session is scored as it stands.

## 3. Stop rules

- Isolation not achieved, or the READ probe fails: **STOP** and report.
- Smoke fails: **STOP** and report why.
- Any confinement probe fails: **STOP**.

## 4. Outcome definitions (design §5, copied verbatim)

## 5. Outcomes

Per run (one agent working through all steps of one puzzle):

| Outcome | Definition |
|---|---|
| **clean solve** | every sub-goal's oracle passes on the final tree **and** the tests pass |
| **clean-solve rate** | clean solves / runs, per puzzle × arm, Wilson interval |
| **pass^k** | 1 if all k runs of a puzzle × arm are clean solves (τ-bench style reliability); reported with the plug-in estimate `C(c,k)/C(n,k)` |
| **caught-and-fixed** | a sub-goal's oracle fails on some intermediate snapshot (per step, or per tool-call boundary from the trace) and passes on the final tree; counted per sub-goal, per arm. In `mcp` it is also linked to whether a tool call preceded the fix |
| **per-sub-goal success** | oracle pass rate per sub-goal, so a 3-trap puzzle shows *which* trap catches |
| **functional failure** | tests fail on the final tree; reported separately, never counted as clean or as trapped |
| **instrument agreement** | per sub-goal, the oracle verdict against the instrument's (new correct blocking findings vs the seed); a 2×2 table per family |

Secondary: changed lines, steps to first clean tree, tool calls per step, the placebo call rate.

**Blind-control puzzles.** Some traps are invisible to the instrument by construction (class iv: D4 cross-aggregate
or cross-context writes, D5 rule placement, D10 duplication, H5 without a vendor import). On those sub-goals the
`mcp` arm should **not** beat `placebo`: the tool reports nothing about them. If it does, the effect is generic
attention (the tool's presence), not the rules, and it bounds what the visible-trap effect can be attributed to.
Each puzzle's README and card mark every sub-goal visible / partial / invisible from the verification run (§7), not
from the design intent.


**How the scorer applies them (zero calls).** On every step snapshot and on the final tree: tsc (harness tsconfig
shape, strict), the puzzle's behaviour tests run **from outside** (`experiments/puzzle-01/tools/run-tests.ts` with the
puzzle directory and the snapshot), each sub-goal's oracle, and changed lines against the seed. A run is a **clean
solve** when every sub-goal oracle passes and every test (regression and feature) passes on the final tree. A run is
**trapped** when every test passes and at least one sub-goal oracle fails. A run is a **functional failure** when any
test fails on the final tree (counted separately, never as clean or trapped). Type-check errors are reported next to
each run. The clean-solve rate has a Wilson 95% interval per puzzle. pass^5 and its plug-in `C(c,5)/C(5,5)` are
reported per puzzle. Caught-and-fixed is read from the step snapshots (tool-call grain is not available).
**Results are per puzzle and never pooled.**

## 5. Visibility columns (R6)

On every final tree, and on each puzzle's seed, clean and trap solutions:

- **Frozen**: the DaedalusArch instrument as `experiments/puzzle-01/tools/instrument-score.ts` runs it (scoring v1.3,
  `cypher-interp`, the puzzle's `spec.yaml`, check-correct). A sub-goal is **visible** when the tree has a new correct
  blocking finding (not on the seed) in a file the oracle cites for that sub-goal (the `verify.ts` convention).
- **Prototype**: the DETECT-01 rules (`origin/explore/detect-01`, `experiments/detect-01/evaluate.ts --trees`; style
  `hexddd` for P1 and P2, `layered` for P4). Mapping fixed in advance: P1 SG1 and P2 SG2 (D4): X1, X1b. P1 SG2 (D5):
  X4. P2 SG1 (D6/D10): none of X1–X4 targets it, so every finding is reported but the sub-goal is "no rule".
  P4 SG1 (layered dependency): none of X1–X4 targets it, so "no rule". A sub-goal is **visible** when a mapped rule has a
  new finding (not on the seed) in a file the oracle cites for that sub-goal.
- Agreement with the oracle is a 2×2 table (oracle FAIL / PASS × visible / not visible) per sub-goal and column, over
  the 5 final trees of the puzzle plus its clean and trap trees.

## 6. Go/no-go (design §9) and the R5/R6 readings

Design §9, copied verbatim:

## 9. Pilot plan (proposed, NOT run here)

- **Design:** 4 DEV puzzles × 2 arms (`none`, `mcp`) × 5 runs = **40 agent sessions** (one session per run, all steps
  of the puzzle in sequence, one step per turn as in HEXDDD-01), one generator (`claude-sonnet-5-5`, CLI at a recorded
  pin). **Hard cap 44** (one infrastructure redraw per puzzle × arm cell). `placebo` is added only after the pilot
  shows an `mcp` vs `none` difference worth attributing (+20 sessions, separate approval).
- **Scoring (zero calls):** tests, oracles and the instrument per step snapshot; caught-and-fixed from step snapshots
  (tool-call grain needs the trace).
- **Questions:** does each puzzle discriminate (`none` clean-solve rate strictly between 0 and 1)? Does the rung order
  hold? Do oracle and instrument agree where the instrument should see?
- **Go/no-go for a registered study:** at least 2 puzzles with `none` clean-solve rate in [0.2, 0.8].
- **When:** only with the author's written approval, and not while Study 2b scoring uses the machine.

Pre-registered readings, applied in the report:

- **R5, small n.** At n = 5 the Wilson 95% intervals are 0/5 → [0, .43], 1/5 → [.04, .62], 2/5 → [.12, .77],
  3/5 → [.23, .88], 4/5 → [.38, .96], 5/5 → [.57, 1]. 1/5 and 4/5 are read as **"in band, provisional"**. A puzzle
  "discriminates" if its clean-solve count is 1–4 of 5.
- **R5, arm comparison.** A later 5-vs-5 arm comparison can separate only extreme splits (for example 0/5 vs 5/5 or
  0/5 vs 4/5). So the baseline sizes a tool arm **only if a puzzle the tool can see lands at 2/5 or below**.
- **R6, harder visible puzzle.** If **P4** (the only puzzle the frozen instrument sees) scores **4/5 or more** clean
  solves, a harder visible puzzle must be authored before any `mcp` arm: rung 2 or 3, with an existing upward import
  as house style.
- The R6 visibility columns say whether an exploratory "mcp + detect" arm is worth building: it is worth building only
  if a prototype rule is visible on trapped final trees of a puzzle at 2/5 or below.
- Counts that touch a hand-read case (`oracle-verdicts-to-read.md`) are **provisional** until the author has read them.

## 7. Records

Under `results/v1.4-puzzle-01-baseline/`: diffs per session and step, per-step scores, `calls.jsonl` and `turns.jsonl`
(the ledger), the isolation evidence, the private id map (session id → puzzle, run). The report is
`Docs/DiagnosticRuns/puzzle-01-baseline-2026-10-21.md`. No chat text is written into any record. Envelopes keep only
the harness's scrubbed fields. The agent's final message is not copied into the report.
