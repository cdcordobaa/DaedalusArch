# Gemini generator adapter (`agy-cli`)

**Status: built, off by default, dry-run only, NOT through its S4 confinement probe.** The first live S4 run on agy
1.4.2 failed in both arms (2026-10-19). U12 (2026-10-20) then changed the confinement mechanism: a PreToolUse hook
allow-list, corrected permission rules and the sandbox. See "Confinement (U12)" below and the declared change
`Docs/v1.4/gemini-confinement-change-2026-10-20.md`. **S4 must be re-run live and pass before any Gemini coding cell.**
U11 (BUILD-G, 2026-10-19)
made it ready for the probe: the turn ends on agy's result event, agy 1.4.2 is accepted for exploratory runs, the S4
probe code exists (dry-run tested, never run live), the two generator homes have a setup script, and the plan template
pins the model (see "S4 runbook" below). Decision CDX
(`ops/decisions.md`): Gemini is registered as the Codex substitute for Study 2, with its own S4 probe. Design:
`aidlc-docs/construction/v1.4/U5/functional-design/design.md` Part B. Probe: `Docs/v1.4/gemini-s4-probe-spec.md`.

**Protocol note.** Since the second deviation (`Docs/v1.4/study2-deviation-2026-10-19-drift.md`) the
`study2-protocol` line says `generators=claude-sonnet-5-5,gemini-pin`. This adapter touches no protocol document; the
exact Gemini model id and agy version are fixed in the plan template below.

## Route and why

The adapter drives the **Antigravity CLI `agy`** serving a Gemini model, as a headless agent in the step's work
directory. It is the only Gemini route that is agentic (it writes files and calls MCP tools) and costs no API money:
- the `gemini` CLI is refused for this account (`IneligibleTierError`);
- the Gemini API key has no agent loop (the harness would have to build one, which would be a different generator)
  and spends against a small cap;
- `agy` is already probed and in use as the labeller (`src/llm-critic/agy-cli-provider.ts`).

`agy` also serves non-Gemini models, so every call's `init.model` must equal the pinned id (else `model-mismatch`).
The route is author question Q1 (a confirmation, not a blocker).

## Code

| File | Role |
|---|---|
| `scripts/lib/generators/agy-gen-cli.ts` | config (`createAgyGenCliConfig`), argv, child env, the generator home and settings checks, the ancestor check, the per-turn home files |
| `scripts/lib/generators/agy-gen-events.ts` | stream-json → envelope summary, attempt disposition, the `status` hook, the two stop rules |
| `scripts/lib/generators/agy-gen-plan.ts` | the plan's `gemini` block, `agyGenConfigFromPlan`, the S4 guard `checkS4Result` |
| `scripts/lib/generators/types.ts` | `AGY_GEN_CLI_ADAPTER_ID = 'agy-cli'`; not in `GENERATOR_ADAPTER_IDS`, so the E1 schedule and the registered plan are unchanged |
| `scripts/lib/loop/agents.ts` | `GeminiStepAgent` over the shared `driveTurn`; `driveTurn` gained one optional `CallPlan.status` hook (Claude and Codex pass none) |
| `scripts/lib/loop/plan.ts` | `LOOP_ADAPTER_IDS`; `agy-cli` only with `gemini.enabled: true`; its `cliVersion` must equal `gemini.cliVersion` |
| `scripts/lib/loop/main.ts` | `--gemini-home-none`, `--gemini-home-mcp`; the S4 pre-pass; the `agy-cli` branch; the explicit Claude branch (`LOOP_ADAPTER_UNKNOWN`) |

## The plan block (off by default)

```json
"gemini": {
  "enabled": true,
  "cliVersion": "x.y.z",
  "printTimeoutS": 1170,
  "allowCommand": true,
  "homes": { "none": "<local>", "daedalus-mcp": "<local>" },
  "s4Result": "tests/fixtures/agy-gen-cli/s4-result.json"
}
```

- Without the block, or with `enabled` not exactly `true`, a plan listing `agy-cli` is invalid. Every existing plan
  validates and schedules exactly as before (a regression test pins the schedules of the committed loop plans to
  fingerprints taken on the base commit).
- `homes`: one dedicated generator home per arm, never the labeller home; outside the repository, the out-root, the
  harness root and every cwd. `"<local>"` is filled by `--gemini-home-none` / `--gemini-home-mcp`. One lane per home.
- `printTimeoutS` 60..1170; the hard kill is `printTimeoutS + 30` s, so the default gives exactly the 1,200,000 ms
  wall budget of the Claude and Codex turns.
- `binary` (optional): the absolute agy path; the plan's `binary` when absent.
- The model id comes from `adapters[]`; no model literal is in `scripts/lib/generators/**` (BR-U5a-51, now also
  checked for Gemini ids by `tests/unit/scripts/architecture.test.ts`).

**S4 guard.** A live (non-dry) wiring runs `checkS4Result` for every `agy-cli` adapter in a pre-pass before anything
spawns (no `claude --version`, no skeleton install), and fails closed with `LOOP_GEMINI_S4_MISSING`, `_FAILED`
(an arm not `pass`), `_MISMATCH` (another CLI version or model) or `_SYNTHETIC` (a result marked synthetic).

## Confinement (U12): hook allow-list, correct rules, sandbox

A turn is confined by three layers. Each is written or checked before the turn's agy process starts:

| Layer | What | Where |
|---|---|---|
| 1. PreToolUse hook | `hooks.json` at `~/.gemini/config/hooks.json` in the generator home (HOME = the home, so each home has its own; never the workspace `.agents/hooks.json`, which loads only after folder trust). One group, `matcher: ".*"`, so every tool is covered. The command is `'<node>' '<home>/.gemini/config/daedalus-confine-hook.mjs' '<home>/.gemini/config/daedalus-confine-turn.json'`, timeout 10 s. The script is a byte copy of the committed `scripts/lib/generators/agy-confine-hook.mjs` (plain Node, no dependencies). The turn config holds the work directory (realpath), the exact type-check command, `allowCommand`, the arm, the hook log path (outside the work directory) and, in `daedalus-mcp`, the allowed and denied daedalus-arch tools. The model never sees it. | `writeAgyTurnFiles` / `installAgyHook` (`agy-gen-cli.ts`) |
| 2. Permission rules | Only the seven real action kinds. Allow: `read_file(<work>/**)`, `write_file(<work>/**)`, `command(regex:^<exact type-check>$)` (when `allowCommand`), and the nine `mcp(daedalus-arch/<tool>)` in `daedalus-mcp`. Deny: `read_url(*)`, `execute_url(*)`, `unsandboxed(*)`, then `mcp(*)` (none) or `mcp(daedalus-arch/evaluate_project)` (daedalus-mcp), and `command(*)` without `allowCommand`. | `expectedAllow`, `expectedDeny` |
| 3. Sandbox | `--sandbox` in argv, `enableTerminalSandbox: true` in settings | unchanged |

**The hook's allow-list** (pure function `decide`; everything else is denied with a reason):

| Tool | Allowed when |
|---|---|
| `view_file`, `list_dir`, `find_by_name`, `grep_search`, `write_to_file`, `replace_file_content`, `multi_replace_file_content`, `sed_file`, and the 1.4.2 stream names `read_file`, `write_file` | Every path argument resolves inside the work directory. Relative paths resolve against it. The realpath of the deepest existing ancestor is taken, so a symlink cannot lead out: the cwd's `node_modules` symlink to the skeleton install is outside. `~` paths are denied. A call with no path argument is denied. Content and search-text arguments are not treated as paths. |
| `run_command` | `allowCommand` is true and `args.CommandLine` (trimmed) equals the turn's type-check command exactly |
| `command_status` | The type-check command was allowed earlier in this turn (read from the hook log) |
| `finish` | Always |
| `call_mcp_tool` (daedalus-mcp only) | Any server argument is `daedalus-arch`. A tool-name argument names one of the nine spec-only tools. `evaluate_project` never appears. |
| `read_file`, `view_file` of `<home>/.gemini/antigravity-cli/mcp/daedalus-arch/<tool>.json` (daedalus-mcp only) | `<tool>` is one of the nine. agy 1.4.2 reads the schema there before an MCP call (S4 G9 stream). |

Every other tool is denied, in both arms. That covers the browser tools, `invoke_subagent`, `define_subagent`,
`manage_subagents`, `schedule`, `search_web`, `read_url_content`, `generate_image`, `run_workflow`, `manage_inbox`,
plugins, `send_command_input`, `ask_*` and any tool added later.

**Fail-closed.** The hook exits 2 when the config is missing or invalid, stdin is not the expected JSON, the work
directory is missing, the home has no turn configured (the baseline config) or the log cannot be written. agy treats
that as a block. Each decision is one JSON line `{tool, decision, reason, stepIdx}` in the turn's hook log:
`<H>/runs/<runId>/hooks/<turnId>.jsonl` in the loop, `<probe-root>/hook-logs/<arm>-<probe>.jsonl` in S4. An internal
error is logged as `decision: "error"` when the log path is known.

**Home check.** `checkAgyGenHome` (pre-turn and per turn) now also requires three things. First, hooks.json is exactly
the confinement hook: it is the one hooks entry exempt from the forbidden home names, and any other `hooks`,
`hooks.json` or `.agents` entry still fails. Second, the copied script has the committed script's sha256. Third, the
turn config is valid for the arm. Per turn, the config must also name that turn's work directory, type-check command
and MCP tools, and its log must lie outside the work directory. The loop now checks the agy version before it writes
the turn files (agy 1.4.2 re-saves settings.json on exit). The check order of PR #288 is kept.

**Stop rule.** The tool-escape stop of `agy-gen-events.ts` now path-checks completed file steps against the work
directory (the hook's check, after the fact). It also treats `read_file`, `write_file` and `sed_file` as file tools.

**Why.** The S4 run's failures came from three gaps, not from agy ignoring every rule. Rules that name no real action
were ignored. The prefix `command(...)` rule let chained and extra-flag commands through. Tools no action covers
(`invoke_subagent`, `schedule`) cannot be denied by rules at all. Details and stream evidence:
`Docs/v1.4/gemini-confinement-change-2026-10-20.md`.

## Confinement design (U5; superseded in part by U12 above)

Reused from the labeller (imported, not copied): `AGY_ENV_ALLOW`, `AGY_ENV_SET`, `AGY_HOME_FORBIDDEN_NAMES`,
`AGY_ANCESTOR_FORBIDDEN`, `AGY_CLASSIFIER`, `readAgyStream`, `executedTools`, `deniedToolCount`, `parseAgyVersion`,
`findAgyAncestorContext`. **Not** reused: `classifyAgyResult`, `checkAgySettings`, `checkAgyHome` (the labeller's
contract makes every tool an isolation stop; a generator fails it by design). A test asserts they are not used.

| Item | Design | Status |
|---|---|---|
| argv | `--output-format stream-json --model <id> --sandbox --disable-slash-commands --print-timeout <n>s`; prompt on stdin; the arm sentence in the prompt (`armPrompt`) | built |
| env | `AGY_ENV_ALLOW` + `HOME = <arm home>` + `AGY_CLI_DISABLE_AUTO_UPDATE=true`; every `*_KEY`, `*_TOKEN` removed | built |
| file tools only inside the cwd | allow `read_file(<cwd>/**)`, `write_file(<cwd>/**)` | **UNVERIFIED** (G1, G2, G3) |
| exactly the run's type-check | allow `command(<typecheckCommand(H, runId)>)`; checked to be EXACTLY this run's and arm's set before every spawn | **UNVERIFIED** (G4, G5) |
| `tsc` reads the tsconfig under `<H>` | terminal sandbox | **UNVERIFIED** (G5) |
| network, browser, sub-agents, schedule, image, workflows, inbox, plugins, `evaluate_project` denied | U12: the PreToolUse hook denies every tool not on its allow-list; the rules deny `read_url(*)`, `execute_url(*)`, `unsandboxed(*)` and the MCP set; the backstop is the tool-escape stop | **UNVERIFIED** (G6, G8, G9; S4 re-run) |
| MCP per turn | `.gemini/config/mcp_config.json`: none in `none`; exactly `daedalus-arch` in `daedalus-mcp`, rewritten per turn with `--project <cwd>` and `--call-log` | **UNVERIFIED** that agy re-reads it per call (G0, G9, G10) |
| ambient rules | fail closed on `GEMINI.md`, `AGENTS.md`, `.agents`, `.agent`, `_agents`, `_agent`, `.git` on the cwd's ancestor chain, and on rules, skills, plugins, agents, workflows or hooks in the home | built; detector checked by G7, G11 |
| cross-run memory | one home serves every run of an arm; the home's name-listing sha256 goes into `env-<turnId>.json` per turn | **UNVERIFIED** (G12, residual) |
| model | `init.model` must equal the pin | built |
| usage limits | the classifier's `USAGE_LIMIT` patterns → pause 30 min and resume the same turn | patterns **UNVERIFIED** (no natural sample yet) |

## Turn mapping

| agy outcome | Turn status | Retry |
|---|---|---|
| spawn failure, or exit before an `init` event | `infrastructure` | at most 2 retries |
| `[agy] print timeout after` on stderr (exit 0, SUCCESS, empty answer) or the hard kill, files written | `timeout` (through the `status` hook) | final |
| print timeout, no file written | `infrastructure` | retried |
| auth pattern | the grid stops (`LOOP_GEMINI_AUTH`) | none |
| a COMPLETED step of a tool outside the arm's allow list (any MCP call in `none`, `evaluate_project`, a command other than the run's type-check, `read_url_content`, ...) | the grid stops (`LOOP_GEMINI_TOOL_ESCAPE`); the envelope is kept | none |
| model pattern, or `init.model` ≠ pin | `model-mismatch` | final |
| usage-limit pattern on an erroring call | — | pause and resume |
| `result.status` not SUCCESS, or `result.error` | `agent-error` | final |
| otherwise | `completed` | final |

Usage: `input_tokens`, `output_tokens`, `cache_read_tokens` into the turn usage; `costUsd` is always null (a
subscription; no figure is recorded).

## Dry run

```text
npx tsx scripts/v1.3/gemini-adapter-dry-run.ts
```

The real `runLoopGrid` with the real `GeminiStepAgent` and a scripted `ProcessRunner` (2 demo tasks × {`none`,
`daedalus-mcp`} × 1 run × k = 3, Clean stub layout). Result: `results/v1.4-gemini-adapter-dry-run/` (12 turns, all
completed; the synthetic S4 fixture refused without `allowSynthetic`; env names only; paths as placeholders). No model
call; not a measurement.

## Before it may run live

1. The S4 probe run and passed (`Docs/v1.4/gemini-s4-probe-spec.md`: 24 model calls, cap 30; the author's OK, Q6).
2. The two generator homes created and signed in; the model pin chosen.
3. The dated CDX deviation recorded (the protocol line), outside this unit.

## U11 additions (BUILD-G)

| Item | Where |
|---|---|
| The turn ends on the `result` event: agy 1.4.2 prints its result and never exits. `driveTurn` gained one optional `CallPlan.stopOnLine` (Claude and Codex pass none); `GeminiStepAgent` passes `isAgyResultLine`; a run ended that way counts as exit 0 (`agyGenExitCode`) | `scripts/lib/loop/agents.ts`, `scripts/lib/generators/agy-gen-events.ts`; test `tests/unit/scripts/loop/agents-gemini-hang.test.ts` (a fake agy that prints a result and hangs) |
| agy 1.4.2 accepted for exploratory runs: `AGY_EXPLORATORY_VERSIONS` (1.3.6, 1.4.2) moved to a shared module and re-exported by BF-01; a live grid or probe accepts only those or the frozen labeller pin 1.3.2 (`checkAgyGenLiveVersion`, `LOOP_GEMINI_VERSION_UNLISTED`). The per-turn `agy --version` check against `gemini.cliVersion` stays | `scripts/lib/agy-exploratory.ts`, `scripts/lib/generators/agy-gen-plan.ts`, `scripts/lib/loop/main.ts` |
| The plan template: `agy-cli` / **`gemini-4-argon-high`** / agy **1.4.2**, `gemini.s4Result` = `tests/fixtures/agy-gen-cli/s4-result.json`. Its `tasksFile` is a placeholder (the demo tasks) | `experiments/loop-gemini/gemini-plan.template.json` |
| The S4 probe (G0–G12, 24 calls, cap 30, a counter that refuses the 31st call; `--estimate`, `--dry-run`) | `scripts/generator/probes/agy-gen-confinement.ts`, `-cli.ts`, `-dry-run.ts`; recorded dry run `results/v1.4-gemini-s4-dry-run/` (synthetic, refused by every live wiring) |
| The generator homes: create and validate, no sign-in, no credential read | `scripts/v1.4/gemini-homes.ts` |
| One stub turn end to end through the loop under the template, a fake agy that hangs, the real process runner | `scripts/v1.4/gemini-turn-dry-run.ts`; record `results/v1.4-gemini-turn-dry-run/summary.json` |

## S4 re-run with the hook (U12)

The first live run (2026-10-19) used the roots `/Users/Shared/daedalus-gemini-s4/{h,out}`, because `~/.agents` in the
user home trips the ancestor check. The re-run uses the same roots and the same signed-in homes. Steps 1 and 2 make no
model call. Step 3 makes at most 30 (24 planned) and needs the author's OK under the standing S4 approval.

```bash
# 1. Install the hook files into the two existing homes (hooks.json, the committed script, the baseline turn config;
#    the harness-owned settings keys reset to the corrected baseline). No sign-in, no credential file opened.
npx tsx scripts/v1.4/gemini-homes.ts --create --home-none ~/.firewall/gemini-gen-none --home-mcp ~/.firewall/gemini-gen-mcp \
  --out-root /Users/Shared/daedalus-gemini-s4/out --harness-root /Users/Shared/daedalus-gemini-s4/h
# 2. A dry run (the scripted agy runs the real hook), the MCP server build, the agy version.
npx tsx scripts/generator/probes/agy-gen-confinement-cli.ts --dry-run --no-record --plan experiments/loop-gemini/gemini-plan.template.json
npm run build && HOME=~/.firewall/gemini-gen-none agy --version
# 3. THE LIVE RE-RUN.
npx tsx scripts/generator/probes/agy-gen-confinement-cli.ts \
  --plan experiments/loop-gemini/gemini-plan.template.json \
  --binary "$(command -v agy)" \
  --harness-root /Users/Shared/daedalus-gemini-s4/h --out-root /Users/Shared/daedalus-gemini-s4/out \
  --gemini-home-none ~/.firewall/gemini-gen-none --gemini-home-mcp ~/.firewall/gemini-gen-mcp
```

What to read in the result (`<out-root>/probes/agy-s4-<stamp>/s4-result.json`):

- `g0[].hooks.loaded`: `seen` when agy's output or a home log says hooks loaded. `unverified` is not a failure: agy
  1.4.2's `--version`, `mcp list` and `plugin list` print no such line and write no log (checked against a scratch
  HOME on 2026-10-20).
- `probes[].hookDecisions`: the hook's allow and deny counts. The hook logs themselves are in `hook-logs/`.
- `hook-not-invoked` in any probe: agy ran a tool without calling the hook. Under ADR-029 that fails the arm.
- `hook-error`: the hook failed closed (for example it could not write its log). The call was blocked, but the probe
  fails, so the cause can be read.

## S4 runbook (U11, the first run; superseded by the re-run above)

Steps 1–3 make no model call; step 4 makes at most 30 (24 planned). Paths are examples:
keep both homes and every root outside the repository, and never use the labeller home.

```bash
# 1. The two generator homes (once): create, then sign each in by hand (the labeller's pty relay, HOME=<home> agy),
#    then check again. The script never signs in and never opens a credential file.
npx tsx scripts/v1.4/gemini-homes.ts --create --home-none ~/.firewall/gemini-gen-none --home-mcp ~/.firewall/gemini-gen-mcp
npx tsx scripts/v1.4/gemini-homes.ts --home-none ~/.firewall/gemini-gen-none --home-mcp ~/.firewall/gemini-gen-mcp \
  --out-root ~/daedalus-out/gemini-s4 --harness-root ~/daedalus-h/gemini-s4

# 2. The call count and a dry run (scripted agy, no model call).
npx tsx scripts/generator/probes/agy-gen-confinement-cli.ts --estimate
npx tsx scripts/generator/probes/agy-gen-confinement-cli.ts --dry-run --no-record --plan experiments/loop-gemini/gemini-plan.template.json

# 3. Build the MCP server the daedalus-mcp arm starts (dist/mcp-server/main.js), and check agy is 1.4.2.
npm run build && agy --version

# 4. THE LIVE PROBE: 24 model calls, hard cap 30, about 48-120 min, subscription quota on the two generator homes.
npx tsx scripts/generator/probes/agy-gen-confinement-cli.ts \
  --plan experiments/loop-gemini/gemini-plan.template.json \
  --binary "$(command -v agy)" \
  --harness-root ~/daedalus-h/gemini-s4 --out-root ~/daedalus-out/gemini-s4 \
  --gemini-home-none ~/.firewall/gemini-gen-none --gemini-home-mcp ~/.firewall/gemini-gen-mcp
```

- Exit 0: both arms pass; the run wrote `tests/fixtures/agy-gen-cli/s4-result.json` and `tests/fixtures/agy-gen-cli/s4-streams/`
  (paths as placeholders, streams scrubbed). Review and commit them; a live grid then accepts the template.
- Exit 1: a probe or G0 failed. The arm is stopped (ADR-029); the result stays under `<out-root>/probes/agy-s4-<stamp>/`
  and is not copied. If G0 or G9 failed, Gemini runs `none` cells only (the spec's pre-registered rule).
- Exit 2: the run stopped early (the call cap, `LOOP_GEMINI_AUTH`, a usage limit, a version drift) or a setup error. The
  partial result names the code; nothing is copied into the repository.
- `--only G5 --arms none` re-runs single probes for diagnosis; a partial run never marks an arm as passed and is never
  copied. `--max-calls <n>` lowers the cap (never above 30).
- The probe fills the template's `daedalus` `<local>` fields with this checkout's node, `dist/mcp-server/main.js` and the
  evaluator spec. A grid run needs a copy of the template with the frozen tasks and concrete `daedalus` paths.

