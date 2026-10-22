# PUZZLE-02 tool arm `mcp-detect` on P1 and P2: run plan

**Exploratory, DEV split, NOT part of Study 2b** (v1.5-exp instrument). Committed and pushed **before any generator
call**. The spec of this run is `ops/notes/puzzle-02-tool-arm-note.md` (design §3, frame §4, caps §5, predictions §6,
caveats §7); where this plan and the note disagree, the note wins. Approved by the author for this run. Nothing here
changes `src/`, `presets/`, `scripts/lib/`, `scripts/v1.3/`, the tag `v1.4-freeze-2026-10-20` or any registered
Study 2b artefact.

The baseline it is compared with is the PUZZLE-01 arm `none` (`experiments/puzzle-01-baseline/plan.md`, results
`results/v1.4-puzzle-01-baseline/`), **not re-run**. Its plan and isolation procedure are reused exactly; the only
differences are the frame sentence and the MCP server (note §3), plus the exploratory differences listed in §2.

## 1. Design

| Item | Value |
|---|---|
| Arm | `mcp-detect`: `experiments/detect-02/mcp/main.ts --spec <puzzle spec> --project <work tree> --engine cypher-interp --confine --call-log <root-only path outside the tree>`. Frozen tools unchanged, plus `check_consistency` (symbolic, no model call) |
| Comparator | the baseline arm `none`, not re-run: P1 0/5 clean, P2 0/5 (1/5 if c07 is accepted), provisional until the author's hand read |
| Generator | `claude-sonnet-5-5` through Claude Code CLI, the unprivileged generator user, the baseline wrapper (`results/v1.4-puzzle-01-baseline/isolation/gclaude.sh`, unchanged) |
| Puzzles | **P1** `p1-transfers`, **P2** `p2-loyalty`; neutral task ids `t1`, `t2` (map committed after generation; its sha256 is fixed in `order.json`) |
| Seeds | the puzzles' `seed/` with `ARCHITECTURE.md`, byte-identical to the baseline's (tree sha256 `7d102dc8…5f44` and `d8519e87…4f52`, the pins of the baseline input) |
| Requests | each puzzle's `tasks.json` steps, identical to the baseline input's |
| Runs | 5 per puzzle, 10 sessions |
| Session | the 3 steps of one puzzle, in order, one step per turn, in one work tree; each turn a fresh CLI process (`--no-session-persistence`); 0 repair turns |
| Frame | the baseline `FRAME` verbatim plus the note §4 sentence, appended after a blank line (the frozen `armPrompt` convention). Exact text: `frame.txt` |
| Tools | the frozen argv (`buildGeneratorArgs`: `Read,Write,Edit,Glob,Grep,Bash`, Bash only for the exact type-check command, `acceptEdits`, customizations off, `--strict-mcp-config`), plus, through the frozen `withMcpServer`, `--mcp-config <inline JSON naming one server, daedalus-arch>` and `mcp__daedalus-arch__*` in `--allowedTools` (note §3) |
| Mode | pull: the agent calls the tool. No push gate |
| Per-turn timeout | 1,200,000 ms (baseline) |
| Order seed | `20261022` (the baseline scheme: mulberry32 Fisher–Yates of task × run cells, `shuffled` of `run-baseline.ts`). Schedule: `order.json` |
| Driver | `run-tool-arm.ts` (this folder): the baseline driver's pipeline with the arm's argv and the root-side MCP hub (`isolation.md`) |
| Scorer | `score-tool-arm.ts` (this folder, zero calls), written after generation; it applies §4 below |

## 2. Recorded environment and exploratory differences

| Item | Baseline | This run |
|---|---|---|
| Claude Code CLI | 2.1.305 | **2.1.307** (`claude --version` in this sandbox). **Exploratory difference**, recorded and accepted per the brief |
| Sandbox | claude.ai cloud container, runner `release-66c6e19d9d-ext` | the same runner `release-66c6e19d9d-ext`, environment type `cloud_default` |
| OS | Ubuntu 24.04.5 LTS, Linux 6.18.44 x86_64 | Ubuntu 24.04.5 LTS, Linux 6.18.44 x86_64 |
| Node / npm | v22.22.0 / 10.9.4 | v22.22.0 / 10.9.4 |
| MCP server | none | runs as root behind a socket relay (`isolation.md`): a stdio server spawned by the CLI would run as the generator user and would need to read the puzzle spec |

The spec reaches the agent only as tool output, by design of the arm: `get_architecture_spec` returns the parsed spec
(layers, contexts, aggregates; its `specPath` is the neutral root-only path), and `check_consistency` returns
findings about the agent's own code. The spec file itself stays unreadable to the generator.

## 3. Calls (hard caps, never raised; note §5)

| Phase | Cap |
|---|---|
| Smoke: one turn with the server attached; `check_consistency` listed (by the server and by the agent), one call to it, the server started with `--confine` | 1 |
| Confinement probe: a `project` argument outside the work tree (`/srv/w`, the work root) must be refused (`confined:`) | 1 |
| Sessions: 10 × 3 step turns | 30 |
| Redraws: at most one infrastructure redraw per puzzle (3 turns each) | 6 |
| **Total** | **38** |

Every spawn of the CLI except `--version` is appended to `calls.jsonl` and refused past the phase cap (smoke 1,
probes 1, sessions 36) or the total cap 38, so the harness's own retries count too. The tool makes no model call.

**Redraws.** A session is redrawn whole (new neutral id, same puzzle and run index) only when one of its turns ends
in an infrastructure state (`infrastructure`, `envelope-unreadable`, `model-mismatch`, or a harness error), at most
once per puzzle. Agent behaviour (`completed`, `agent-error`, `timeout`, a broken build, ignoring the tool) is never
grounds for a redraw.

**Isolation evidence at zero calls.** The baseline's listing checks, fingerprint sweep and READ probe are repeated
as the generator user with shell commands (no model call): the READ probe's three paths, plus the spec copies, the
call logs and the server code, must be denied.

## 4. Stop rules

- Isolation not achieved, or any zero-call isolation check fails: **STOP**.
- Smoke fails (not completed, tool not listed, not confined, not callable): **STOP** and report.
- Confinement probe fails (the outside `project` call is not made, or not refused): **STOP**.

## 5. Scoring (zero calls) and outcomes

On every step snapshot (`step-00` seed … `step-03` final) of every session: the harness tsc count; the puzzle's
behaviour tests run **from outside** (`experiments/puzzle-01/tools/run-tests.ts`); each sub-goal oracle; changed
lines against the seed; and `check_consistency` (the same server code, in process, `--confine`, the puzzle spec) with
its findings. The tool-call log (frozen `--call-log` plus the hub's tap) is recorded per step **for the record only**;
how often the tool is called is not an outcome (note §3).

Outcomes, design §5 of `ops/notes/puzzle-01-design.md` as the baseline plan §4 applies them:
- **clean solve** per run: every sub-goal oracle passes and every test passes on the final tree;
- **trapped**: every test passes and at least one sub-goal oracle fails;
- **functional failure**: any test fails on the final tree, counted separately, never clean or trapped;
- **clean-solve rate** per puzzle with a Wilson 95% interval; pass^5;
- **per-sub-goal success**;
- **caught-and-fixed**, two readings: (a) design §5: a sub-goal oracle fails on an intermediate step snapshot and
  passes on the final tree; (b) tool reading: `check_consistency` reports a finding on some step snapshot and the final
  tree is a clean solve.

Every number is put side by side with the baseline `none` arm. **Per puzzle, never pooled.** Each §6 prediction of
the note is marked held or not held. The hand-read list `results/v1.4-puzzle-02-tool-arm/oracle-verdicts-to-read.md`
lists every oracle FAIL and every run that got findings and still finished trapped, with diff excerpts; counts stay
**provisional** until the author's hand read.

## 6. Records

Under `results/v1.4-puzzle-02-tool-arm/`: diffs per run and step, per-step scores, the call ledger (`calls.jsonl`,
`turns.jsonl`), the tool-call logs, the isolation evidence, the smoke and probe results, the private task map. No chat
text is written into any record: envelopes are not committed, and the agent's messages are not quoted. Report:
`Docs/DiagnosticRuns/puzzle-02-tool-arm-2026-10-22.md`.
