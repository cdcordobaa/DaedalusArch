# v1.5 final study: combined delivery (pull + edit gate), design note

**Status:** design, 2026-10-26. Zero calls: written from the notes and run reports listed below. Nothing is built or
run for it. Exploratory (v1.5-exp) until the final study is registered; it changes no Study 2b artefact and no frozen
path.

**Decision recorded.** On 2026-10-26 the author set the final study's treatment to a **combined delivery mode**: the
agent can call the daedalus tools through the MCP server when it chooses (pull), and the edit gate runs automatically
after every file creation or edit and pushes its findings to the agent (push). This note designs that mode. It replaces
the "delivery: the one the pilots pick" option of `ops/notes/v15-final-study-draft.md` §3 and closes open decision 3
there.

**Sources.**
- `ops/notes/v15-edit-gate-design.md` (gate design, DRAFT)
- `Docs/DiagnosticRuns/edit-gate-build-2026-10-23.md` (build and smoke, CLI 2.1.308)
- `Docs/DiagnosticRuns/puzzle-02-tool-arm-2026-10-22.md` (pull on P1, P2)
- `Docs/DiagnosticRuns/puzzle-04-2026-10-23.md` (gate and pull on P1, P2, P3r, P5, P6)
- `Docs/DiagnosticRuns/drift-01-pilot-2026-10-23.md`, `Docs/DiagnosticRuns/drift-01-rescores-2026-10-23.md`
- `ops/notes/v15-final-study-draft.md` (draft v0)
- `ops/notes/v15-final-study-readiness-2026-10-26.md` (readiness and Stage 0/1 plan; "readiness" below)

## 1. What the agent sees, and when

### 1.1 The two channels

| | Push (edit gate) | Pull (MCP tools) |
|---|---|---|
| Trigger | Every `Write`, `Edit` or `MultiEdit` (a new file is a `Write`), through a PostToolUse hook; plus a Stop hook when the agent tries to end a turn | The agent calls a tool: `check_consistency`, `check_file`, `check_diff`, `get_architecture_spec` and the other tools the server lists (12 in PUZZLE-04) |
| Checks | `check_consistency` (R-D4, R-XCTX) on the whole tree, and the frozen `check_diff` fast path for FF-S01–S03 (PUZZLE-04 `layers.ts`) | What the agent asks for. `check_file` is a whole-file check, so it also shows planted seed debt |
| Scope shown | Findings that involve a file the session changed since the seed; only **new** keys; `resolved:` lines for keys that disappear | The full answer to the request |
| Where it lands | Next to the tool result, as the CLI's `PostToolUse:<tool> hook additional context`; at Stop, `Stop hook feedback`, at most once per turn | The tool result |
| Grain | Edit | Call |

The other routes to a file change are closed already: the agent's Bash allows only the exact type-check command, and
`NotebookEdit` is not in the tool list. A file changed by any other route would show up as a tree change with no hook
event, which the integrity check of §5.2 counts.

Both channels keep the scope each was tested with. Push stays a delta against the seed (as in PUZZLE-04, where it hid
the planted P6 import), and `check_file` stays whole-file (as in PUZZLE-04, where pull agents removed that import). This
asymmetry is part of the treatment and is reported, not engineered away.

### 1.2 One finding identity across both channels

Double reporting is avoided by giving both channels **one ledger** in **one root process**, the delivery hub (§7 step 2).
- **The key** is the gate's existing key (rule, command file, command name, aggregate set; line-shift tolerant), extended
  to FF-S01–S03 as in `layers.ts`. Every finding either channel returns gets a key, and every key gets a short
  per-session number, `finding N`, in order of first exposure.
- **Push shows a key at most once.** A key already shown by either channel, push or pull, is not pushed again while it
  stays open. A key that disappears gets one `resolved:` line; a key that comes back is new again (the tested
  behaviour).
- **Pull answers in full.** A tool returns everything the agent asked for, including keys it has seen. That is on
  request, so it is not counted as double reporting. Keys already shown carry `(finding N, already reported)` instead
  of a second full block, so the agent sees one finding with one number, whichever channel came first.
- **Stop** lists every open key once per turn, whichever channel first showed it. Stop is the only planned repeat.
- **Double report**, the quantity to keep at 0: a push of a key that was already shown and has not changed state since.

### 1.3 The pushed message

The tested format of `experiments/edit-gate/gate.ts` is kept. The only change is the finding number at the end of the
first line, so a fix can be tied to one identity across channels:

```text
Architecture check: src/billing/IssueInvoice.ts:14 [one aggregate per command; cross-context write] (finding 3)
Rule: <rule text>
Why: <why>
Write: <write site>
Fix: <fix>

resolved: src/ordering/RecordPayment.ts:22 [one aggregate per command] (finding 1)
If you are in the middle of a change, finish it; the check runs again after each edit.
```

(The file names above are illustrative.) The limits stay at 12 lines per finding and 3 findings per message, then
`… and N more`. Stop keeps its tested first line, `Architecture check: N findings still open in the code you changed.
Address them before you finish.`

### 1.4 The frame

The combined arm needs a sentence, or the pull channel is the PUZZLE-04 pull arm minus its instruction. Lead: the
PUZZLE-04 §2.2 pull sentence verbatim (it is hint-audited and was run on P5 and P6), followed by one disclosure
sentence:

> The same checks also run automatically after each file you create or edit, and report new findings to you.

The disclosure is new text. It must pass the hint audit (`hint-audit.mjs`, L3) before Stage 1. Fallback, if the author
prefers tested text only: the PUZZLE-04 sentence alone, with the gate undisclosed until its first push. Either way, the
`none` arm keeps the baseline frame verbatim.

## 2. What the evidence supports, and what it does not

All of it is development material at n = 3–5 per cell, one vendor, one generator model (`claude-sonnet-5-5`), CLI
2.1.307–2.1.308.

| Part | Evidence | Reading |
|---|---|---|
| **Pull** | PUZZLE-02: P1 **4/5** clean (baseline 0/5); P2 **3/5** after the accepted hand read (baseline 1/5). PUZZLE-04: P6 5/5 | Works where the agent calls it. On P1 every run called `check_consistency` at step 1, got R-D4, and fixed it in the same turn. On P2 and on P5 the design shifted with no finding at all, so part of the effect is the sentence or the tool's presence, not the findings |
| **Gate** | PUZZLE-04: P6 **5/5** (baseline 0/5, intervals do not overlap); P1 2/5 by the oracle (5/5 if P1-SG1-c is accepted); P2 2/5 by the oracle (4/5 under the accepted categories); P3r blind control silent over 72 edits, no change. 28 keys shown, 28 resolved, 0 open on a final tree | Catches the trap at the edit that introduces it, with no call decision and no instruction |
| **Gate on inherited debt** | DRIFT-01 t1: the inherited `RecordPayment` write was removed in **3/3** gate blocks, at step 2; under pull **0/3**, though the tool reported it in 13 of 14 calls | Only push acted on the inherited start. This is the main argument for having the gate in the treatment, not only pull |
| **Both on new drift** | DRIFT-01 t1: D_v15 6 (none) vs 0 (pull) vs 0 (gate) | Tied; both remove new drift |

**What remains unknown.**
- **P5 at 0/5 under both arms.** Each run fixed the architecture (SG1 5/5 under both), and each failed the same test (a
  booking on a cancelled sailing throws instead of returning `rejected`). That is a request defect, not a delivery
  result. Until the P5 key and test are fixed (readiness Stage 0, item 1), there is no evidence either way on whether
  delivery helps a two-way DDD task on the registered outcome.
- **The tool/instruction confound.** Pull was always tool + instruction against neither. No placebo arm (the sentence
  with a tool that returns nothing) has been run, and P5 under pull (4 of 5 runs wrote the relay design with no
  finding) suggests the sentence alone moves the design. The combined arm inherits this confound. The gate, with no
  sentence, is the only part with a clean contrast against `none`.
- **The combined mode itself.** It has never run. Untested: whether the agent stops calling once push is visible (or
  calls more), whether the sentence's "call check_file on each file you change" adds calls and changed lines on top of
  push, and whether a pull answer about seed debt plus push silence on that debt confuses the agent.
- **Checker blind spots.** PUZZLE-04 P5 c07 moved a cross-context write into the composition root's facade, which
  `check_consistency` does not see. Both channels share that blind spot.

## 3. Study arms

The lead design keeps the draft's spec × tool structure with **combined** as the tool level: `none@L2`, `none@L3`,
`combined@L2`, `combined@L3`, per style, with the shared step 1 per block (17 turns per block). Option B is 12 tasks ×
3 replicates = 36 blocks, 612 turns per style and vendor.

| Arms | Extra turns per block | Turns per style (option B) | Claims it allows |
|---|---|---|---|
| **Lead: none vs combined** | 0 (17) | 612 | "The combined delivery reduces new violations" at L2 (RQ2) and beyond the prose rules at L3 (RQ3). Which channel did the work is **descriptive only**, from the logs of §4. The treatment is hooks + tools + sentence together |
| + **gate-only at L2** | +4 (21) | 756 (+24 %) | Adds a clean causal contrast: gate-only vs `none` differs by the hooks alone. Combined vs gate-only gives the marginal value of pull + sentence, still confounded with the sentence |
| + gate-only at L2 and L3 | +8 (25) | 900 (+47 %) | As above, plus the gate's effect beyond prose |
| + pull-only at L2 | +4 (21) | 756 (+24 %) | Replicates 2b's H2 on new tasks; combined vs pull-only gives the marginal value of the gate. 2b already settled pull at L2 on Layered |
| + placebo (sentence, empty tool) at L2 | +4 (21) | 756 (+24 %) | Separates the instruction from the findings for the pull part |

Each added contrast also enters the Holm family, which raises the smallest threshold. At 12 tasks the task-level floor
is 2/2^12 for every option above, so tasks are not the binding limit. Run-level power is.

**Recommendation.** Register **none vs combined** only. If the call budget allows one more arm, keep **gate-only at L2**:
it is the only contrast with no instruction confound, and the evidence (P6, DRIFT-01 inherited repair) points to the
gate as the part that acts where pull does not. Do not keep pull-only: 2b answers it at L2, and PUZZLE-02/04 answer it
on DDD descriptively. The placebo stays a named threat (draft §7), not an arm.

## 4. Logging to attribute a fix to a channel

All three logs are written by the one hub process, so they share one clock and one monotonic sequence number. No
agent text and no file contents are kept; paths are relative to the work tree.

1. **Tool-call log** (MCP tap, one line per call): seq, time, session, step, turn, tool, argument digest (file list,
   no content), status, latency, and the list of finding numbers returned, each marked `new` or `already reported`.
2. **Gate-push log** (one line per hook event): seq, time, session, step, turn, event (`PostToolUse` or `Stop`), tool
   (`Write`, `Edit`, `MultiEdit`), file, tree digest, keys pushed, keys withheld as already shown (with the channel that
   showed them), `resolved:` keys, Stop block yes or no, latency, and `failOpen` or `refused` with a reason.
3. **Finding ledger** (one row per key per session): key, finding number, rule, first exposure (channel and seq), every
   later exposure, resolution seq (the edit after which the key is absent), whether it came back, and its state on the
   final tree.

**Attribution rule**, fixed before Stage 1. A key that is resolved is attributed by the exposures before its resolving
edit:
- **push only**, **pull only**, or **both** (with which came first);
- **unexposed**: absent from the final tree but never shown, which counts as avoidance (PUZZLE-02 P2 and PUZZLE-04 P5
  under pull), not as a fix.

A block's D reduction is never split between channels. The attribution table is descriptive and reported beside the
contrast. **The scorer test:** re-scoring the PUZZLE-04 and DRIFT-01 logs, which are single-channel, must give the
reported counts (for example gate caught-and-fixed P6 5 and DRIFT-01 t1 inherited 3/3; pull P6 5 at tool-call grain).

The ledger needs the pull server to compute keys, so pull findings use the same key function as the gate. This is the
change that makes attribution possible; without it, DRIFT-01 had to infer pull findings from the trees.

## 5. Failure modes

### 5.1 CLI auto-update breaks the hooks

- The hook output format (`hookSpecificOutput.additionalContext`, `decision: "block"`) and the text the model sees
  belong to the CLI. They were shown on 2.1.308 only.
- **Pin and check.** The CLI version is pinned per vendor, auto-update is disabled in the generator environment, and
  the driver reads `claude --version` before every turn and records it. A mismatch stops the run (draft §7: a CLI update
  mid-run is a stop).
- **A new pin** reruns the gate `--dry` at zero calls (real CLI, scripted API `test/fake-api.ts`): the hook text must
  reach the second request, and Stop must block once.

### 5.2 Fail-open

- The relay prints nothing on error or after 8 s, and the hub logs `failOpen`. This keeps the agent working, but it
  silently turns the combined arm into pull-only.
- **Integrity check per run.** The count of Write/Edit/MultiEdit tool uses in the stream (names and paths only)
  must equal the hub's PostToolUse count. A missing hub line is a fail-open the hub never saw, for example when the
  socket is down.
- **Thresholds** (from the gate note §10): more than 5 % fail-open or fewer than 95 % of edits with a hook event in a run
  is an infrastructure failure, and the run is redrawn under the protocol's redraw cap. Any fail-open below that is
  counted and reported. An MCP error is visible to the agent as a tool error and is logged the same way.

### 5.3 Latency

- Hub p95 was **171 ms** on the P1 replay and **451 ms** over PUZZLE-04's 844 events (max 572 ms). The cost is the
  ts-morph rebuild in `check_consistency`, not the relay.
- **Budget:** p95 under 2 s per edit, hook timeout 10 s, relay cut at 8 s.
- **One process, one tree digest cache:** a pull call on a tree the gate has just checked returns the cached result, so
  the two channels give the same answer on the same tree and do not double the cost.
- p95 over 2 s in a run is reported. Over 5 s is a mechanism stop (gate note §10). An incremental program in DETECT-02
  is not needed for the study.

### 5.4 The agent switches the gate off

- Settings come only from the arm's `--settings` value (`--setting-sources ""` stays), so a `.claude/settings.json` the
  agent writes is ignored. The CLI also refused such writes in both probes.
- **The allowance overlay `detect02.allow.yaml`** is not honoured by either channel in the study. A write of it is a
  gaming flag in the push log.
- **Other routes:** the agent has no client to talk to the socket (Bash is limited to the type-check command), and it
  can only ask about its own tree.
- **Ignoring the gate** is not switching it off. It is measured: keys never resolved, and edits from finding to
  resolution.

### 5.5 Claude-only coverage

- PostToolUse and Stop hooks are a Claude Code CLI feature. A second vendor (readiness note: Gemini API, OpenRouter free
  models or Grok) has no hook of the same grain.
- Its push would be harness injection between turns (gate note option B). That is a different treatment: turn grain,
  findings seen only after the agent has built on them.
- So the combined-mode result is **scoped to Claude Code**. A second-vendor arm is reported as "pull + turn-grain push",
  with its own Holm family, and never pooled (draft §3).

## 6. Scripted S4 confinement check

All zero calls, run as the generator user (uid 1500) through the baseline wrapper, with the real CLI against the scripted
API. **No escape, tamper or switch-off prompt goes to any model**: every "agent" action below is a canned tool call. This
replaces the model-call probes of the edit-gate build and PUZZLE-04.

1. **Listing and read denial** of the specs, canaries, hub code, hub and MCP log directories, the task map, this note,
   the sealed and held-out roots, `/root`, `/tmp/claude-0` and `/tmp/tsx-0`. All must be denied.
2. **Fingerprint sweep** over `/` with the canary, note-title, hub-header, spec-header and task-phrase patterns, with a
   positive control. It must find 0 readable files. The tsx cache is closed (0700) before every spawn.
3. **Hook relay refusals:** `file_path` outside the tree, the spec path, `..` traversal, a symlink out, a tree holding
   any out-pointing symlink, `node_modules`, non-edit tools, PreToolUse, unparsable input, and no current cell. All must
   give no reply, with the refusal logged.
4. **MCP confinement:** a call with `project` outside the tree is refused `confined:`.
5. **Cross-channel isolation:** a scripted client on each socket, sending another session's id or another cwd, is
   refused.
6. **Switch-off, scripted:**
   - writes of `.claude/settings.json` and `.claude/settings.local.json` with `disableAllHooks: true`;
   - a write of `detect02.allow.yaml`;
   - then a violating edit.

   The gate must still push, and the overlay must be ignored and flagged.
7. **No leak:** no hook reply or tool result contains the spec path, spec text or a canary.
8. **Argv:** compared with the frozen `buildGeneratorArgs`, the combined arm differs only in the `--settings` value
   (hooks on) and the MCP config of the pull arm. The `none` arm is byte-identical to the frozen argv.

**Pass:** every item clean, recorded in a `dry-result.json` committed before any Stage 1 call.

## 7. Implementation steps

These start after the pending move of the v1.5 code into `src/` (branch `v15/stage0-src-move`) is merged. Each step
has a done-when criterion and is zero-call unless stated.

| # | Step | Done when |
|---|---|---|
| 0 | **Prerequisite:** `v15/stage0-src-move` merged; `check_consistency` served from `src/` by the MCP server | The readiness Stage 0 regression holds: the DRIFT-01 and PUZZLE-04 outputs re-scored through `src/` match their reports |
| 1 | Move the edit gate (`gate.ts`, `layers.ts`, relay, settings) from `experiments/edit-gate/` next to the MCP server in `src/` | The 12 unit tests pass from `src/`, and the P1/P2 seed-trap-clean replay gives the same findings and `resolved:` lines as the build report |
| 2 | **Delivery hub:** one root process per session with two sockets (hook, MCP), one ledger, the shared key function and finding numbers, and the tree-digest cache | Unit tests pass for: push after pull withheld; pull after push marked `already reported`; resolve then return gives new; Stop lists both channels' open keys once; 0 double reports on a scripted session |
| 3 | Message and tool output: finding number on the first line (§1.3); pull results tagged | Golden-text tests pass; the hint audit of the message templates is clean |
| 4 | Frame: the PUZZLE-04 sentence plus the disclosure sentence (§1.4) | Hint audit L3 clean, and text frozen by hash in the run plan |
| 5 | Arm argv and settings | Argv diff test: `none` byte-identical to frozen; combined differs only in `--settings` and the MCP config |
| 6 | Logs and attribution scorer (§4) | A scripted session yields all three logs and an attribution table; re-scoring the PUZZLE-04 and DRIFT-01 logs gives the reported counts |
| 7 | CLI pin, auto-update off, per-turn version check | The driver refuses to start, or stops, on a version mismatch (test with a stub version) |
| 8 | Integrity monitor: edit count vs hook count, fail-open rate, latency summary per run | A stub run with the socket killed mid-session is flagged as an infrastructure failure |
| 9 | Scripted S4 check (§6) | `dry-result.json` all clean, committed |
| 10 | Full dry pipeline: stub agent through both arms, two tasks, all scorers | All four stub runs scored end to end with no manual repair; then the Stage 1 run plan is committed before any call |

## 8. Minimal pilot inside Stage 1

Stage 1 of the readiness plan has 4 runs: 2 tasks (one in the new style, Hexagonal recommended, and one DDD) × `none` /
`combined`, 1 replicate.
- **Turns:** each task has a shared step 1 and 4 steps per arm (the DRIFT-01 structure): 2 × (1 + 2 × 4) = **18 turns**.
- **Smoke:** one call on a dummy project in which the agent writes a violating file and calls `check_consistency`
  once. It checks that the hook fires, the pull call answers with the same finding number as `already reported`, Stop
  blocks once, and 0 double reports occur.
- **Cap:** 18 + 1 smoke + redraws (infrastructure only, at most 1 per task), so about 21 calls, inside the 20–40
  budget. No probe calls: S4 is scripted (§6).

**Combined-mode exit criteria**, added to Stage 1's own ("all four runs scored without manual repair, per-run cost
measured"):
1. In both combined runs, at least 95 % of edits have a hook event, fail-open is at most 5 %, and hub p95 is under 2 s.
2. The CLI version is identical on every turn, and no settings write or overlay write took effect.
3. Double reports are 0, and every key has one finding number across both channels.
4. The attribution table is produced by the scorer with no hand step, even if it is empty.
5. Both channels are seen at least once across the pilot: one push, and one pull call. This is not required per run.
   If the agent never calls a tool, that is recorded as a finding about the mode, not as a failure.

**What the pilot cannot show:** any effect. With n = 1 per cell, `none` vs `combined` is a plumbing and cost check, and
its counts are not read as a direction.

## Changelog
- 2026-10-26: first version.
