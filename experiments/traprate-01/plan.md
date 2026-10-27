# TRAPRATE-01 plan: the agent alone (arm `none`) on the v1.5 study tasks

**Exploratory, task screening, NOT part of the v1.5 study.** Committed and pushed **before any generator call**.
Nothing here changes `src/`, the study task set (`experiments/trap-families/`) or any registered artefact. The runs
are not study data and are not pooled with it.

**Question.** On each of the 24 confirmatory study tasks (and f19, exploratory), does an agent working alone fall into
the task's trap, and does it finish the task? The answers size the study (a style whose agents never trap leaves the
tool nothing to show) and find tasks that cannot be solved as written, before the registration.

Sources: the study task set `experiments/trap-families/study-set.json` (24 confirmatory tasks, all checks passed
2026-10-27); the PUZZLE baselines (`experiments/puzzle-01-baseline/`, `experiments/puzzle-03/plan.md`), whose method
is reused unchanged.

## 1. Design

| Item | Value |
|---|---|
| Arm | `none` only |
| Tasks | the 12 DDD and 12 Hexagonal confirmatory tasks of `study-set.json`, plus `f19-hex-school-canteen` (exploratory): **25 tasks** |
| Runs | **2 per task: 50 sessions × 3 steps = 150 step turns** (PUZZLE-03/04 median turn 41 s, maximum 103 s: about 3–4 hours) |
| Repair turns | 0 |
| Session | the steps of one task (`tasks.json`), in order, one step per turn, in one work tree; each turn a fresh CLI process (`--no-session-persistence`, frozen argv) |
| Generator | `claude-sonnet-5-5` (the PUZZLE baselines' generator) |
| CLI | the pin in the sandbox at run time, recorded (`/opt/claude-code/bin/claude --version`); a change against 2.1.308 is a recorded difference |
| Sandbox | claude.ai cloud container; runner id, OS, Node and npm recorded in the report |
| Seeds | each task's `seed/` with `ARCHITECTURE.md`, pinned by tree sha256 in the input (checked by the driver at load) |
| Requests | each task's `tasks.json` steps, verbatim (the hint audit of 2026-10-27 passed on them: 0 FAIL) |
| Frame | the HEXDDD-01 brownfield frame, verbatim (`FRAME` in `experiments/puzzle-01-baseline/run-baseline.ts`); no added sentence |
| Tools | the frozen argv: `Read,Write,Edit,Glob,Grep,Bash`, Bash only for the one exact type-check command, `--permission-mode acceptEdits`, no MCP |
| Neutral ids | tasks `t01`…`t25`, sessions `c01`…`c50`; the private map is committed after generation |
| Order | mulberry32 Fisher–Yates over the 50 task × run cells (`shuffled` of `run-baseline.ts`), **order seed `20261027`** |
| Per-turn timeout | 1,200,000 ms |
| Driver | `experiments/puzzle-01-baseline/run-baseline.ts`, **unchanged** (byte copy as the runner's driver), with `--read-only` probe mode, `--smoke`, `--baseline` and `--resume`. Input built by `experiments/traprate-01/make-input.ts` (zero calls) |

## 2. Isolation (the PUZZLE-01 baseline method, unchanged)

`experiments/puzzle-01-baseline/isolation.md`: the generator runs as an unprivileged user (uid 1500) through the
root-owned wrapper `/srv/bin/gclaude`; the clone, the runner, the driver's input, the out root and the vault sit in
root-only 0700 directories; neutral ids; each finished cell is closed; the generator's home is emptied before every
session. Before any call: the listing checks and the fingerprint sweep as the generator user (task ids, README
phrases, the trap words of each `puzzle.json`, distinctive second-step request phrases, canary tokens) must find 0
readable files. Evidence goes to `results/v1.5-traprate-01/isolation/`. If isolation is not achieved: **STOP**.

No escape or tamper prompt is sent to any model. The confinement checks are the scripted listing checks and the READ
probe only.

## 3. Calls (hard cap, never raised)

| Phase | Cap | Planned |
|---|---|---|
| Smoke | 1 | 1 |
| Read probe | 1 | 1 |
| Baseline turns | 159 | 150 |
| Redraws | 9 | whole-session redraws (3 turns each), at most 3 (inside the baseline cap) |
| **Total** | **161** | |

A session is redrawn whole only on an infrastructure state (`infrastructure`, `envelope-unreadable`, `model-mismatch`,
harness error, container restart). Agent behaviour is never grounds for a redraw. A call lost in flight is counted.
**Stop rules:** isolation not achieved, or the READ probe fails: STOP. Smoke fails: STOP and report why.

## 4. Scoring (zero calls, after generation)

Per session, on the final tree, as in PUZZLE-03 §4:

- **clean solve:** every test and every sub-goal oracle passes;
- **trapped:** every test passes and at least one sub-goal oracle fails;
- **functional failure:** any test fails (separate; never clean, never trapped).

Also recorded: the v1.5 rules (all of them, admitted or not) and the frozen rules on each final tree, against the
seed (new findings only), and whether a finding of an admitted rule sits in a file the failing oracle cites.

Every oracle FAIL is listed for a hand read in `results/v1.5-traprate-01/oracle-verdicts-to-read.md`; counts that
touch an unread case are provisional.

## 5. What the results decide (written before any call)

- **Per task (informational, no automatic drop).** With 2 runs a task cannot be judged on its trap rate alone
  (P(0 of 2 | p = 0.3) ≈ 0.49). A task with **2 functional failures** is flagged as possibly unsolvable as written and
  read by hand before the registration; a fix to its brief or tests is a dated change made before the registration.
- **Per style.** The pooled trap rate over a style's 12 tasks (24 sessions) with a Wilson 95% interval. If the upper
  bound is **below 0.30**, agents alone rarely fall into that style's traps: **stop and report to the author** before
  the registration, because the study would have little room to show a tool effect.
- **Sizing.** The per-style trap rate and the turn time feed the Stage 1 cost estimate and the option B check (C2).
- Screening on the baseline only biases the main run's baseline trap rate down (regression to the mean), which makes
  a tool effect harder to show, not easier. It is stated as a limit.

## 6. Predictions (written before any call)

| Style | Coordinator's prediction | Why |
|---|---|---|
| DDD | trapped in 14–22 of 24 sessions | the families come from P1, P2 and P5, where the agent alone trapped in 5/5, 4/5 and 5/5 runs (P5 counting the 3 functional failures that also failed the oracle) |
| Hexagonal | trapped in 6–16 of 24 sessions | the families come from P3r (1/5 trapped, 3 functional failures) and P6 (5/5 trapped): a wide band |
| Functional failures | at most 8 of 50 sessions | every clean solution passes its tests, but P3r's agents misread a request in 3 of 5 runs |

## 7. Records

Under `results/v1.5-traprate-01/`: diffs per session and step, `scores.json`, `calls.jsonl` and `turns.jsonl`, the
isolation evidence, the private id map (committed after generation), `oracle-verdicts-to-read.md`. Report:
`Docs/DiagnosticRuns/v15-traprate-01-<date>.md`. No chat text is written into any record; envelopes are not committed;
the agent's messages are not quoted.
