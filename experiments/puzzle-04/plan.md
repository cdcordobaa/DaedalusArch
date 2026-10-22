# PUZZLE-04 plan: the tool arms (`gate`, `pull`) on every trapping puzzle

**Exploratory (v1.5-exp), DEV split, NOT part of Study 2b.** Committed and pushed **before any generator call**.
Nothing here changes `src/`, `presets/`, `scripts/lib/`, `scripts/v1.3/`, the tag `v1.4-freeze-2026-10-20` or any
registered Study 2b artefact. Development material only: no sealed or held-out set is used.

**Question.** With the architecture checks delivered to the agent (pushed after every edit by the edit gate, or pulled
by the agent through MCP), does the clean-solve rate rise above the agent-alone baselines on the five puzzles where the
agent alone falls into the trap? Per puzzle, never pooled.

Sources: the edit gate (`experiments/edit-gate/`, design `ops/notes/v15-edit-gate-design.md`, build
`Docs/DiagnosticRuns/edit-gate-build-2026-10-23.md`); the PUZZLE-02 pull arm (`ops/notes/puzzle-02-tool-arm-note.md`;
driver, frame and report on the branch `pilot/puzzle-02-tool-arm`, commit `9d820500`); the baselines
(`Docs/DiagnosticRuns/puzzle-01-baseline-2026-10-21.md` with the PUZZLE-03 §2 hand read, and
`Docs/DiagnosticRuns/puzzle-03-2026-10-23.md`).

## 1. Design

| Item | Value |
|---|---|
| Arms | **`gate`**: the edit gate, PostToolUse + Stop hooks, the baseline frame verbatim (no sentence about a tool). **`pull`**: the PUZZLE-02 MCP arm (`experiments/detect-02/mcp/main.ts --engine cypher-interp --confine`), the baseline frame plus the arm's tool sentence (§2.2) |
| Puzzles | `gate`: **P1** `p1-transfers`, **P2** `p2-loyalty`, **P5** `p5-ferry-seats`, **P6** `p6-workshop-jobs`, and **P3r** `p3r-shipping-quotes` as a **blind control** (no detector covers its trap: the gate should stay silent and not help). `pull`: **P5**, **P6** (P1/P2 pull results exist from PUZZLE-02 and are not re-run) |
| Runs | 5 per puzzle × arm: `gate` 25 sessions, `pull` 10 sessions; **105 step turns** |
| Session | the 3 steps of one puzzle, in order, one step per turn, in one work tree; each turn a fresh CLI process (`--no-session-persistence`, frozen argv); **0 repair turns** |
| Generator | `claude-sonnet-5-5` |
| CLI | Claude Code **2.1.308** (`/opt/claude-code/bin/claude --version` in this sandbox, 2026-10-22). Baselines: PUZZLE-01 2.1.305, PUZZLE-02 2.1.307, PUZZLE-03 2.1.308, edit-gate build 2.1.308. **Recorded exploratory difference** against the P1/P2 baseline and the PUZZLE-02 pull runs; the same pin as the P3r/P5/P6 baseline |
| Sandbox | claude.ai cloud container, Ubuntu 24.04.5 LTS, Linux 6.18.44, Node v22.22.0, npm 10.9.4 (the baselines' values); runner id recorded in the report |
| Seeds | each puzzle's `seed/` with `ARCHITECTURE.md`, byte-identical to the baseline's (tree sha256, the baselines' pins: P1 `7d102dc8…5f44`, P2 `d8519e87…4f52`, P3r `fa343fa6…0c09`, P5 `58693fe7…f9aa`, P6 `e6799e7e…9517`; checked by the driver at load) |
| Requests | each puzzle's `tasks.json` steps, identical to the baselines' inputs (checked, zero calls). The revisions PUZZLE-03 §8 proposed (P3r fee on fallback, P5 "is rejected") are **not** made, so the requests stay comparable |
| Neutral ids | tasks `t1`…`t5` (private map in `/srv/o/task-map.json`, committed after generation); sessions `c01`… per arm; cells `/srv/w/cNN/work` |
| Order | arm `gate` first, then arm `pull`. Within an arm, the baseline scheme (mulberry32 Fisher–Yates of puzzle × run cells, `shuffled` of `run-baseline.ts`): **order seed `20261024` for `gate`, `20261025` for `pull`** |
| Per-turn timeout | 1,200,000 ms (baseline) |
| Drivers | `gate`: `experiments/edit-gate/run-edit-gate.ts --sessions` with `gate.layers: true`. `pull`: `experiments/puzzle-04/run-pull.ts` (the PUZZLE-02 driver, copied with the changes in its header). Sandbox: `experiments/puzzle-04/setup-sandbox.sh` |

## 2. Built first (zero calls)

P6's trap is a layer skip (FF-S03, presentation → persistence), which `check_consistency` does not cover. Both arms are
extended so that the frozen layer checks also run.

### 2.1 Gate: the hub also runs the frozen layer rules

- `experiments/edit-gate/layers.ts` (new): the frozen `check_diff` handler (`src/mcp-server/tools.ts`, imported
  read-only; the fast path, the one the pull server answers with) runs on a unified diff of the changed source files
  against a copy of the cell's seed. `check_diff` reports only what the new content has that the seed's did not, so
  planted debt (P6's seed already has one controller → gateway import) is never shown. Kept: **blocking** findings of
  **FF-S01** (dependency-direction), **FF-S02** (no-cyclic-deps) and **FF-S03** (no-layer-skip) for the puzzle's spec.
  Advisory rows are counted in the hub log, not shown.
- `hub.ts`: option `layers` (off by default, so the build's gate is unchanged). With it, the layer findings join the
  `check_consistency` findings in the same de-duplication, message and Stop hook. Key: rule | file | import subject |
  target (no line). Message: `Architecture check: <file>:<line> [FF-S03 no-layer-skip]`, then `Rule:` (the frozen
  construct), `Why:` (the import and the frozen reason) and `Fix:` (the frozen fix text), verbatim from `check_diff`.
- `run-edit-gate.ts`: `gate.layers` in the input; `--resume` after a container restart (the PUZZLE-02 driver's logic);
  `modelUsageIds` and a `layerKeys` count in each turn record.
- **Unit tests** (`test/unit.ts`, 19 of 19 pass, `zero-call/hub-unit.json`): the build's 12, plus: the **P6 trap tree
  is flagged** (FF-S03 on `ReportsController.ts`, MechanicGateway import; Stop blocks; the planted JobGateway import is
  never shown) and the **P6 clean solution is silent** (no reply on any edit, no Stop block); on all five puzzles the
  clean solution is silent, and the trap is flagged by the expected checker (P1, P2, P5 by `check_consistency` only;
  P6 by the layer rules only; **P3r by none**).
- **Baseline trees** (`zero-call-check.ts`, `zero-call/hub-baseline-trees.json`): the hub with layers, replayed step by
  step over every scored baseline session. Final trees flagged: P1 5/5, P2 4/5 (c07, the proposed legit-clean case,
  silent), P3r 0/5, P5 5/5, P6 5/5 (by the layer rules). Development evidence: the checks were built while looking at
  these puzzles.
- **Latency re-run** (hub time per edit, warm, layers on): P1 p50 139 / p95 230 ms; P2 181 / 285; P3r 128 / 203;
  P5 253 / 402 (max 454); P6 126 / 177; baseline-tree replay (75 events) p50 210 / p95 349 / max 468 ms. The note's
  budget (p95 under 2 s per edit; hook timeout 10 s) holds by about 5 times. The build's 200 ms target is now exceeded
  at p95 on every puzzle: the frozen fast path adds about 30–150 ms per edit.

### 2.2 Pull: the frame sentence names the frozen check tools

The pull server is unchanged: it already serves the frozen `check_file` and `check_diff` (fast path) next to
`check_consistency`. On the five P6 baseline trees, `check_file` on the controller returns the FF-S03 finding (and,
being a whole-file check rather than a delta, the seed's planted import too; recorded as a difference from the gate).
The sentence (exact text, appended after a blank line to the baseline frame, as in PUZZLE-02):

> An architecture tool is available to you as an MCP server. Its check_consistency tool finds where a command breaks a
> consistency boundary of the domain model, and its check_file and check_diff tools find where a file or a change
> breaks a layer rule of the architecture; each finding gives the file, the rule and a suggested change. Call
> check_consistency after you change code that saves data or code that calls another part of the system, call
> check_file on each file you change, and call both always before you finish. If they find anything, address it before
> you finish.

**Hint audit re-run** (`hint-audit/frame-pull-audit.txt`; `Docs/v1.3/study2-task-design/hint-audit.mjs`, rung L3, each
of the five puzzles' specs, FAIL terms = the PUZZLE-01 baseline audit's 51 terms plus the PUZZLE-03 audit's puzzle
vocabulary): **0 FAIL** on all five specs. WARNs only for generic words: architecture, layer, file, model, boundary,
domain. The sentence names no task, step, feature, aggregate, context, layer name, trap or fix. "reports" (a P6 term)
is avoided on purpose.

Difference from PUZZLE-02's pull frame: this sentence also names `check_file` and `check_diff`. The P5/P6 pull runs are
therefore not the PUZZLE-02 arm exactly; the P1/P2 pull numbers quoted beside them are PUZZLE-02's, with its sentence.

## 3. Isolation (the baselines' method)

`experiments/puzzle-01-baseline/isolation.md` with the edit-gate and PUZZLE-02 additions: the generator runs as uid 1500
through the baseline wrapper `/srv/bin/gclaude` (byte for byte); `/srv/o` (inputs, specs, seeds, records, hub logs,
MCP call logs, task map) is root-only; the relays (`gate-relay.cjs`, `mcp-relay.cjs`, no puzzle text) are in `/srv/h/bin`;
both hubs run as root and listen on `/srv/m/g.sock` and `/srv/m/s.sock`; the generator's home is emptied before every
session; each finished cell is closed (root 0700); root's tsx cache `/tmp/tsx-0` is closed before every generator spawn.

**The clone is closed with `chmod 700` and never moved or removed** (the 2026-10-22 stall: removing the coordinating
session's working directory makes the CLI ask a human). The drivers run as root from the clone. At the end the clone is
reopened with `chmod 755` and the records are copied out of `/srv/o`.

Zero-call evidence before any call (`gate --dry`, as the generator user): the listing checks (specs, canaries, hub and
MCP log directories, task map, this plan, the hub code, two puzzle READMEs, `/root`, `/tmp/claude-0`, `/tmp/tsx-0`)
all denied; the fingerprint sweep over `/` (5 puzzle ids, `PUZZLE-01/03/04`, `winning line`, `trap line`, hub and
layer-module headers, the dummy spec header, the first 40 characters of every later-step request, 4 canaries) finds
**0 readable files**; the gate relay, the real CLI against the scripted API (hook text reaches the model, Stop once,
switch-off refused) as in the build. `pull --dry`: the MCP relay as the generator lists the tools and an outside
`project` is refused, for each pull task; stub sessions through both pipelines.

## 4. Calls (hard cap 121, never raised)

| Phase | `gate` cap | `pull` cap | Total |
|---|---|---|---|
| Smoke (gate: canned edit on the dummy project, hook text reaches the model, Stop once; pull: tools listed incl. `check_file` and `check_diff`, one `check_consistency` call, server confined) | 1 | 1 | 2 |
| Confinement / isolation probe (gate: READ probe of the spec, hub side and clone, and the switch-off attempt; pull: an outside `project` refused) | 1 | 1 | 2 |
| Session turns | 75 | 30 | 105 |
| Redraws (whole session, infrastructure only, at most 1 per puzzle × arm) | 9 (3 sessions) | 3 (1 session) | 12 |
| **Total** | **86** | **35** | **121** |

Each driver writes every spawn of the CLI except `--version` to its `calls.jsonl` and refuses past its phase cap and its
total (`gate`: smoke 1, probes 1, sessions 84, total 86; `pull`: smoke 1, probes 1, sessions 33, total 35), so harness
retries count. A call lost in flight (container restart) is added to the ledger by hand and counted. A redraw that
would pass a cap is not started; the session then stays as it is and is reported. The tools make no model call.

**Redraws.** Only when a turn ends in an infrastructure state (`infrastructure`, `envelope-unreadable`,
`model-mismatch`, harness error, container restart). Agent behaviour (`agent-error`, `timeout`, broken build, ignoring
findings) is never grounds for a redraw.

## 5. Stop rules

- Isolation not achieved, or any zero-call check of `--dry` fails: **STOP**.
- Gate smoke fails (not completed, hook not fired, text not reaching the model, Stop not blocking once): **STOP**.
- Gate probe fails (a canary leaked, or the gate stops firing after the switch-off attempt): **STOP**.
- Pull smoke or probe fails (tools not listed, not confined, outside `project` not refused): **STOP** the pull arm.
- Mechanism (design note §10) during the gate sessions: more than 5 % of edits failing open, or p95 hub time over 5 s,
  is an infrastructure failure, reported; the sessions already run are kept.

## 6. Scoring (zero calls, written after generation)

On every step snapshot of every session: the harness tsc count; the puzzle's behaviour tests from outside
(`experiments/puzzle-01/tools/run-tests.ts`); each sub-goal oracle; changed lines against the seed; `check_consistency`
and the frozen layer findings (the hub's checks, in process). Outcomes (design §5 of `ops/notes/puzzle-01-design.md`,
unchanged):

- **clean solve**: every sub-goal oracle passes and every test passes on the final tree; **trapped**: every test
  passes and an oracle fails; **functional failure**: any test fails on the final tree (separate, never clean or
  trapped);
- **clean-solve rate per puzzle × arm with a Wilson 95% interval**; pass^5 (plug-in); per-sub-goal oracle pass;
- **caught-and-fixed**, two grains: (a) snapshot: an oracle fails on an intermediate snapshot and passes on the final
  tree; (b) event: `gate`, a key shown by the hub is later resolved and the final tree is a clean solve; `pull`, a tool
  call returns findings, a later call of the same tool returns none, and the final tree is a clean solve (PUZZLE-02's
  post-hoc column, now planned);
- **gate / tool events per session, for the record only**: gate edits, replies, new keys (consistency, layer), resolved
  keys, Stop blocks, fail-open, refusals, hub time; pull tool calls by tool, error flag, status, finding count. How often
  the pull tool is called is not an outcome;
- **functional failures** and **changed lines** (median per puzzle × arm).

Everything is put side by side with the baselines (`none`: P1 0/5, P2 1/5 after the PUZZLE-03 hand read, provisional
on c07; P3r 1/5; P5 0/5; P6 0/5) and with the PUZZLE-02 pull results (P1 4/5; P2 0/5 by the oracle, 3/5 if the author
accepts P2-SG2-a and P2-SG1-b). **Per puzzle, never pooled.** Every oracle FAIL on a final tree and every functional
failure is listed for the author's hand read (`oracle-verdicts-to-read.md`), with the existing categories
(`experiments/puzzle-01-baseline/oracle-hand-read-categories.md`, the PUZZLE-03 categories) or `new`; counts touching
an unread case are **provisional**. A final tree that the gate leaves silent and the oracle fails is listed as a
possible gaming form.

## 7. Predictions (written before any call)

| Puzzle | Baseline `none` | `gate` | `pull` | Why |
|---|---|---|---|---|
| P1 | 0/5 | **high: ≥ 4/5** | PUZZLE-02: 4/5 | R-D4 fires at step 1 with a concrete fix; the seed has the event and relay. SG2 (daily limit in the aggregate) is invisible to both, but passed 5/5 under PUZZLE-02 |
| P2 | 1/5 (c07, provisional) | by the oracle **0–1/5**; under the proposed label P2-SG2-a (legit-clean) **3–5/5** | PUZZLE-02: 0/5 oracle, 3/5 labels | Per its hand-read status (P2-SG2-a still unread): the gate fires on the in-command write and is silent on the handler-in-sales shape, which the oracle fails. Both counts are reported |
| P3r | 1/5 | **no improvement (0–2/5)**; the gate stays **silent** (0 findings expected) | not run | Blind control: neither checker covers vendor shapes in the port and the core. Any gate event on P3r is recorded and read by hand |
| P5 | 0/5 | **improves (≥ 2/5)** | **improves (≥ 2/5)** | R-D4 + R-XCTX fire on the synchronous write into the other context; the relay mechanism is in the seed. Less than P1: a two-way exchange needs a pending state. P5's step-3 under-specification (throw vs reject) still caps it |
| P6 | 0/5 | **high: ≥ 4/5** | **high: ≥ 4/5** | The frozen FF-S03 sees every baseline trap (5/5); the fix (a business-layer service) is short |

- **Across arms: `gate` ≥ `pull`** on P5 and P6 (and against PUZZLE-02's pull on P1 and P2), because nothing depends on
  the agent calling a tool.
- **No harm:** functional failures and median changed lines stay within the baseline range (no puzzle × arm with two or
  more functional failures beyond its baseline, no median changed lines above twice the baseline).
- At n = 5 only extreme splits are distinguishable (0/5 vs ≥ 4/5; Wilson 0/5 [0, .43], 4/5 [.38, .96]). "Improves" at
  2–3/5 is a direction, not a separation.

## 8. Caveats (stated in the report)

- **Gate:** the arm differs from `none` by the hooks only (no instruction). **Pull:** tool + instruction vs neither.
- **The pull sentence changed** from PUZZLE-02 (it now names the frozen check tools); P1/P2 pull numbers are PUZZLE-02's.
- **Development material:** the checks were built and tuned on these puzzles' baseline trees.
- **One vendor, one model** writes the puzzles, the checkers, the scoring and the hand-read proposals.
- **CLI pin** differs from the P1/P2 baseline (2.1.305) and PUZZLE-02 (2.1.307).
- **Not Study 2b.** The versioned exploratory instrument (v1.5-exp); never applied to Study 2b.

## 9. Records

`results/v1.4-puzzle-04/gate/` and `results/v1.4-puzzle-04/pull/`: diffs per session and step, step snapshots,
`scores.json`, the ledgers (`calls.jsonl`, `turns.jsonl`, `schedule.json`, `redraws.jsonl`, `resumes.jsonl`), the hub
logs (gate) and MCP call logs and taps (pull), the dry, smoke and probe results, the isolation evidence, the private
task map. No chat text is written into any record: envelopes are not committed, and the agent's messages are not
quoted. Report: `Docs/DiagnosticRuns/puzzle-04-2026-10-23.md`; research-log entry in
`ops/notes/explore-01-research-log.md`.
