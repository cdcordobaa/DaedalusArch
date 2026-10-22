# V15-PLAN step 2: the edit gate (DRAFT, for the author)

**Status:** draft, 2026-10-22. Zero calls: written from the code and the Claude Code hooks documentation. Nothing is
built or run for it. Exploratory (v1.5-exp), DEV split, never applied to Study 2b.

**The idea.** After every agent `Edit` or `Write`, the architecture checks run on the changed files. Any new finding
appears in the agent's view at once, next to the tool result, like a compiler error. The agent makes no decision to
call a tool. This removes the weak link of pull delivery: in 2b's `mcp@L2`, a `check_*` call appeared in only 28 of
160 steps.

## 1. Mechanism options

| | A. PostToolUse hook (recommended) | B. Harness injection between turns |
|---|---|---|
| How | A Claude Code `PostToolUse` hook with matcher `Edit\|Write\|MultiEdit`. It reads `tool_input.file_path` from the hook's stdin JSON and returns `hookSpecificOutput.additionalContext`, which the CLI places next to the tool result as a system reminder | The existing path: `experiments/detect-02/mcp/push-gate.ts` after each turn, its text appended to the next prompt; the loop harness `gate` arm (`scripts/lib/loop/loop.ts`) with one repair turn |
| Grain | Every edit, inside the turn | Every turn |
| Pros | Immediate; no extra turn, so no extra call; the agent can fix within the same step; tool-call grain for caught-and-fixed comes for free (one hub log line per edit) | Built and tested; no change to the frozen argv; confinement already shown |
| Cons | The frozen argv sets `disableAllHooks: true` and `--setting-sources ""` (`scripts/lib/generators/argv.ts`), so the arm needs its own `--settings` value (an exploratory difference, as MCP was for PUZZLE-02). Hooks run as the generator user, so they need a relay (§4). Inline hooks through `--settings` are not yet verified: smoke item | With 0 repair turns the last step's findings are never acted on; repair turns add calls and change the protocol; the agent sees a finding only after it has built on top of it |

(A hook of type `mcp_tool` calling the pull server directly is a fallback: it mixes push and pull logs.)

**Recommendation: A**, a command hook through a root-side relay, with B as the fallback if the smoke shows hooks cannot
run under the confinement settings. A **Stop hook** completes it: when the agent tries to end a turn with findings
still open, it gets them once more (`decision: "block"` with the list as `reason`), at most once per turn. That
catches mid-refactor states left behind without nagging on every edit.

## 2. Which checks run, and the message

- **First:** `check_consistency` (R-D4, R-XCTX), the only checks with an actionable message today. Symbolic, no model
  call, same tree same answer.
- **Later:** frozen `check_file` / `check_diff` once their findings are rewritten in the same format (V15-PLAN §3,
  message quality). Not in the first pilot.
- **Scope of a run:** the whole tree is checked, and only findings that involve a file the session changed since the
  seed are shown (the `files` filter of `consistency.ts` already includes the command, the write sites and the store
  declarations).
- **Format** (the existing `formatText`, trimmed): `Architecture check: <file>:<line> [<rule label>]`, then `Rule:`,
  `Why:` and `Fix:`, one line each, plus the write sites. At most about 12 lines per finding and 3 findings per
  message; more becomes "and N more".
- **De-duplication.** The hub keeps, per session, the set of finding keys already shown (rule + command `file:line` +
  aggregate set, line-shift tolerant through the command name). An edit shows only **new** keys. A key that disappears
  gets one short line, `resolved: <file>:<line> [<rule>]`. A key that stays is not repeated until the Stop hook.
- **Hint audit** of the templates (`hint-audit.mjs`, L3); the fix texts equal the pull tool's.

## 3. Latency budget

`check_consistency` took 35–266 ms per tree in process (median 56 ms, the 55 trees of
`experiments/detect-02/results/zero-call-check.json`). A cold `tsx` spawn per edit would add 1–2 s, so the hub stays
warm, as a root process per session. Budget: p95 under 2 s per edit; hook `timeout` 10 s. On timeout or error the hook
shows nothing (fail open) and the hub logs it. A run with more than 5 % of edits failing open is an infrastructure
failure.

## 4. Confinement and isolation

- **The hook runs as the generator user**, as the stdio MCP server would. So the hook command is a relay of a few
  lines in the harness root (the `mcp-relay.cjs` pattern of PUZZLE-02). It forwards only the stdin JSON to a root
  socket, `/srv/m/g.sock`. The hub (root) reads the spec from `/srv/o/specs/tN.yaml`, checks only the current cell's
  work tree, and drops `transcript_path`.
- The hub refuses a `file_path` outside the work tree, resolves symlinks first, and never echoes a spec path or spec
  text. The agent sees findings about its own code and nothing else.
- **The agent cannot switch the gate off.** Settings come only from `--settings` (`--setting-sources ""` stays), so a
  `.claude/settings.json` the agent writes in its tree is ignored. Probe: one turn asked to disable or edit the hook;
  the hub log must show the gate still firing.
- The baseline isolation checks are repeated at zero calls, with the relay, hub code, hub logs and socket added.

## 5. Interaction with the pull tool

The first pilot runs **the gate alone**, with the baseline frame verbatim and no sentence about a tool. PUZZLE-02 is
"tool + instruction"; the gate arm differs from `none` only by the hook, which removes that confound. Gate + pull is a
later cell, only if both arms help on their own.

## 6. Scenarios and edge cases

- **Noisy repeats:** prevented by de-duplication; repeated keys should be 0.
- **Mid-refactor transients:** each message says "if you are in the middle of a change, finish it; the check runs
  again after each edit". Only the Stop hook treats an open finding as outstanding.
- **False positives:** precision on correct DDD patterns is V15-PLAN step 1; until then only P1 and P2 (0 findings on
  seeds and clean solutions). A finding on an oracle-clean move is read by hand.
- **Gaming:** renames and "batch" wrappers should still fire (the rule follows the write footprint). A **fake
  synchronous event** through an in-process bus is the real risk, since port calls are not linked (V15-PLAN §1); a
  checker-clean, oracle-fail tree counts as gaming.
- **Fighting the gate:** repeated edits without resolving, or deleting the feature (caught by the outside tests).
  Measure: edits from finding to resolution, findings never resolved.

## 7. Predictions (before any run)

Baseline `none` (PUZZLE-01): P1 0/5 clean, P2 0/5 (1/5 if case c07 is accepted), P4 5/5. PUZZLE-02 (pull) pending.

- **P1.** SG1 (R-D4) is fixed in at least 4/5 runs: the seed already has the event and relay mechanism. SG2 (rule
  placement, D5) is invisible to the gate and failed 2/5 at baseline, so **clean solve is capped near 3/5**. Prediction:
  2–3/5 clean.
- **P2.** Restructuring is harder (an event subscribed in the composition root, the earning rule moved into
  membership). Prediction: 1–3/5 clean.
- **Against pull.** The gate is at least as good as pull on P1 and P2, because nothing depends on a call. If pull
  matches the gate, the instruction sentence was enough and the gate adds only robustness.
- **No harm.** Functional failures and changed lines stay within the baseline range (median changed lines: P1 120,
  P2 59).

## 8. Measures

From snapshots and the hub log (zero calls): **clean solve** (oracles + outside tests, Wilson) and per-sub-goal
success; **first-attempt correctness** (finding resolved by the first edit after it, with no new finding); **edits and
turns from finding to fix**; **repair quality** (oracle-clean pattern, not a gaming form); **functional failures**;
**changed lines**; caught-and-fixed at step and edit grain; latency and fail-open count.

## 9. Pilot plan and caps

Arm `gate` on P1 and P2, 5 runs each: 10 sessions × 3 steps = 30 turns. The baseline harness, isolation, generator,
CLI pin recorded, order seed new and fixed in advance, 0 repair turns.

| Phase | Cap |
|---|---|
| Smoke: hooks enabled under the arm's `--settings`, the hook fires on Edit and Write, the message reaches the agent, Stop hook fires once | 1 |
| Probe: the agent is asked to switch the gate off | 1 |
| Sessions | 30 |
| Redraws (infrastructure only, at most one per puzzle) | 6 |
| **Total** | **38** |

Zero-call work first (relay, hub, de-dup tests, gaming fixtures, hint audit, isolation); a run plan before any call.

## 10. What counts as failure

- **Mechanism (stop):** the hook fires on fewer than 95 % of Edit/Write calls, p95 latency over 5 s, more than 5 %
  fail-open, or any isolation or switch-off probe fails.
- **Message:** on P1, findings shown but SG1 fixed in at most 2/5 runs. The message (wording, timing), not the
  detection, is then the problem.
- **Harm:** two or more runs per puzzle more functional failures than baseline, or median changed lines above twice the
  baseline.
- **Gaming:** any final tree the checker passes and the oracle fails, counted and read by hand.
- **No gain over pull:** the gate is not better than PUZZLE-02 on either puzzle. The pull path then stays the delivery
  mode for the final study, and the gate is reported as tried.
