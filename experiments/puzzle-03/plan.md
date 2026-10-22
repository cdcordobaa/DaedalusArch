# PUZZLE-03 baseline plan: the agent alone (arm `none`) on P3r, P5 and P6

**Exploratory, DEV split, NOT part of Study 2b.** Committed and pushed **before any generator call**. Nothing here
changes `src/`, `presets/`, `scripts/lib/`, `scripts/v1.3/`, the tag `v1.4-freeze-2026-10-20` or any Study 2b file.
Puzzles: `README.md` and `verification.json` next to this file (all three VALID, zero calls). Method and outcome
definitions: `ops/notes/puzzle-01-design.md` §5. Procedure: the PUZZLE-01 baseline (`experiments/puzzle-01-baseline/`),
reused as stated below.

**Question.** When a coding agent works alone, under rules its repository states in writing (`ARCHITECTURE.md`), does
it fall into the traps of P3r (Hexagonal, vendor shapes in the port), P5 (DDD, a synchronous write into the other
context) and P6 (Layered, copying a controller-to-gateway skip that the house style already has)? Each puzzle's
oracle decides "trapped". The DaedalusArch tool is not used.

## 1. Design

| Item | Value |
|---|---|
| Arm | `none` only |
| Generator | `claude-sonnet-5-5` |
| CLI | Claude Code **2.1.308** (`/opt/claude-code/bin/claude --version` in this sandbox on 2026-10-22). The PUZZLE-01 baseline ran 2.1.305; the change of pin is a recorded deviation, not a choice |
| Sandbox | claude.ai cloud container, runner `release-66c6e19d9d-ext`, Ubuntu 24.04.5 LTS, Linux 6.18.44, Node v22.22.0, npm 10.9.4 (the PUZZLE-01 baseline values) |
| Puzzles | **P3r** `p3r-shipping-quotes`, **P5** `p5-ferry-seats`, **P6** `p6-workshop-jobs` |
| Runs | 5 per puzzle: **15 sessions × 3 steps = 45 step turns** |
| Repair turns | 0 |
| Session | the 3 steps of one puzzle, in order, one step per turn, in one work tree; each turn a fresh CLI process (`--no-session-persistence`, frozen argv) |
| Order seed | **`20261023`** (mulberry32 Fisher–Yates over the 15 puzzle × run cells, as in `run-baseline.ts`) |
| Frame | the HEXDDD-01 brownfield frame, verbatim (`FRAME` in `experiments/puzzle-01-baseline/run-baseline.ts`); no added sentence |
| Agent's workspace | the harness skeleton + the puzzle's `seed/` (with `ARCHITECTURE.md`); nothing else. P3r: the seed carries only the vendor typings, as in PUZZLE-01 |
| Tools | the frozen argv: `Read,Write,Edit,Glob,Grep,Bash`, Bash only for the one exact type-check command, `--permission-mode acceptEdits`, no MCP |
| Per-turn timeout | 1,200,000 ms |
| Driver | `experiments/puzzle-01-baseline/run-baseline.ts`, **unchanged** (byte copy as the runner's `x/drv/run.ts`), with its `--read-only` probe mode, `--smoke` and `--baseline` |

## 2. Isolation (the PUZZLE-01 baseline method, reused exactly)

`experiments/puzzle-01-baseline/isolation.md`, unchanged: the generator runs as an unprivileged user (uid 1500)
through the root-owned wrapper `/srv/bin/gclaude` (the committed `results/v1.4-puzzle-01-baseline/isolation/gclaude.sh`
text); the clone, the runner, the driver's input (every step's request), the out root and the vault sit in root-only
0700 directories; the clone's path is left empty; neutral ids (`c01…`, tasks `t1…t3`); each finished cell is closed;
the generator's home is emptied before every session. Before any call: the listing checks and the fingerprint sweep
as the generator user (puzzle ids, README phrases, distinctive later-step request phrases, canary tokens) must find
0 readable files. Evidence goes to `results/v1.4-puzzle-03-baseline/isolation/`. If isolation is not achieved:
**STOP**.

## 3. Calls (hard cap, never raised)

| Phase | Cap | Planned |
|---|---|---|
| Smoke | 1 | 1 |
| Read probe | 1 | 1 (the PUZZLE-01 READ probe: a README of a puzzle at its former path, a canary in the vault, a canary in the out root) |
| Baseline turns | 45 | 45 |
| Redraws | 6 | whole-session redraws (3 turns each), at most 2 |
| **Total** | **53** | |

The driver's caps are set to `smoke 1, probes 1, baseline 51, total 53`; every spawn except `--version` is written to
`calls.jsonl` and refused past a cap. **Confinement probes are not re-run** (the cap has no room for them): the argv,
the wrapper and the user split are those the four PUZZLE-01 confinement probes passed under CLI 2.1.305. That they
still hold under 2.1.308 is assumed, and stated as a limit.

**Redraws.** As in PUZZLE-01: a session is redrawn whole only when a turn ends in an infrastructure state
(`infrastructure`, `envelope-unreadable`, `model-mismatch`, harness error, or a container restart). Agent behaviour is
never grounds for a redraw. A call lost in flight is counted.

**Stop rules.** Isolation not achieved, or the READ probe fails: STOP. Smoke fails: STOP and report why.

## 4. Scoring (zero calls)

`experiments/puzzle-03/score-baseline.ts` (written after generation, like PUZZLE-01's scorer, from the same pieces):
on every step snapshot, the behaviour tests run from outside (`experiments/puzzle-01/tools/run-tests.ts`) and each
sub-goal's oracle; on every final tree, the frozen instrument (`experiments/puzzle-01/tools/instrument-score.ts`, the
puzzle's `spec.yaml`, check-correct) and DETECT-02's `check_consistency` (`experiments/detect-02/mcp/push-gate.ts
--json`). Outcomes (design §5, unchanged):

- **clean solve:** every sub-goal oracle passes and every test passes on the final tree;
- **trapped:** every test passes and at least one sub-goal oracle fails;
- **functional failure:** any test fails on the final tree (separate; never clean, never trapped);
- **clean-solve rate** with a Wilson 95% interval, **pass^5** and its plug-in `C(c,5)/C(5,5)`, per-sub-goal oracle
  pass rate, caught-and-fixed from step snapshots;
- **visibility per tree:** frozen = a new correct blocking finding (not on the seed) in a file the oracle cites;
  DETECT-02 = any `check_consistency` finding (P5 only has aggregates declared; on P3r and P6 it is expected to be
  `not-applicable`).

**Results are per puzzle, never pooled.** Every oracle FAIL on an agent tree is listed for a hand read in
`results/v1.4-puzzle-03-baseline/oracle-verdicts-to-read.md`, with the PUZZLE-01 categories where they apply
(`experiments/puzzle-01-baseline/oracle-hand-read-categories.md`) or `new`. Counts touching an unread case are
provisional. P5's alternative design (`alternatives/handler-in-bookings`, the P2-SG2-a shape) passes the oracle by
construction; a handler placed elsewhere but delivered by the relay is expected to pass too.

Readings (R5 of the PUZZLE-01 plan, unchanged): at n = 5, 1/5 and 4/5 are "in band, provisional"; a puzzle
discriminates at 1–4 of 5. Go/no-go for a registered study: at least 2 puzzles in [0.2, 0.8]. A tool arm is sized
only by a puzzle the tool can see at 2/5 or below (P6 for the frozen instrument; P5 for DETECT-02).

## 5. Predictions (written before any call)

| Puzzle | Author's prediction | Coordinator's prediction | Why |
|---|---|---|---|
| P3r | uncertain | 3–5 of 5 clean | HEXDDD-01's strong model resisted vendor-SDK leaks; but the planted tracking port is a trap-shaped precedent, and the "smallest change" pressure of step 2 invites catching the vendor error in the core |
| P5 | traps often, like P2 | 0–1 of 5 clean | the sailings module already publishes `holdSeats` / `releaseSeats`, and the passenger "must know at once" |
| P6 | traps often, because of the precedent | 0–2 of 5 clean | two requests ask for consistency with a report that reads a gateway from the controller; `ARCHITECTURE.md` says otherwise |

## 6. Records

Under `results/v1.4-puzzle-03-baseline/`: diffs per session and step, `scores.json`, `calls.jsonl` and `turns.jsonl`
(the ledger), the isolation evidence, the private id map (committed after generation), `oracle-verdicts-to-read.md`.
Report: `Docs/DiagnosticRuns/puzzle-03-2026-10-23.md`; research-log entry in `ops/notes/explore-01-research-log.md`.
No chat text is written into any record; envelopes are not committed; the agent's messages are not quoted.
