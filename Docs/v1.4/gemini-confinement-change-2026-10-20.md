# Declared change: the Gemini generator's confinement mechanism (U12)

**Date:** 2026-10-20 (UTC). **Status:** declared change, built and dry-run tested. **Not yet verified live.**

## What changed

The Gemini generator (`agy-cli`) confined its turns with agy permission rules alone. The S4 probe on agy 1.4.2 failed in
both arms (`Docs/DiagnosticRuns/v1.4-gemini-s4-agy142-2026-10-19.md`, `results/v1.4-gemini-s4-142/s4-result-summary.json`).
**The confinement mechanism changed after that failed run.** It now has three layers:

1. **A PreToolUse hook**, `scripts/lib/generators/agy-confine-hook.mjs`. It runs for every tool (matcher `".*"`) from
   the generator home's `~/.gemini/config/hooks.json`, and it reads a per-turn config that the harness writes. It works
   from an allow-list and denies everything else. Any hook error blocks the call.
2. **Corrected permission rules.** They use only the seven real agy action kinds.
3. **The sandbox**, unchanged: `--sandbox` and `enableTerminalSandbox: true`.

## Why

The causes come from the agy docs (https://antigravity.google/docs/permissions/,
https://agenticcontrolplane.com/controls/antigravity) and from the S4 streams of 2026-10-19:

| Finding | Evidence | Fix |
|---|---|---|
| agy permission rules have exactly seven action kinds: `read_file`, `write_file`, `command`, `read_url`, `execute_url`, `mcp`, `unsandboxed`. Our entries `search_web(*)`, `browser(*)`, `subagent(*)`, `schedule(*)`, `generate_image(*)`, `workflow(*)`, `inbox(*)` and `plugin(*)` named no action, so agy ignored them. | The docs list the seven kinds. agy re-saved settings.json with only `read_url` and `mcp` (PR #288). G8: `invoke_subagent` and `schedule` steps started. | The entries are removed. The hook denies every tool on no allow-list. |
| `command(<text>)` is a **prefix** rule. | G3 and G4: `<type-check> --tsBuildInfoFile ../x` and `<type-check> && touch ../chain-and.txt` completed (`DONE`) under `command(<type-check>)`. | The hook allows `run_command` only when the command matches the type-check exactly. The rule is now `command(regex:^<escaped>$)`. |
| agy 1.4.2's stream reports file access as `read_file` and `write_file` with a `Path` parameter. The tool list in `init` shows `view_file`, `write_to_file` and so on. | G2 (`read_file` of `work/package.json`) and G7 (`write_file` of `work/notes.md`) were flagged as escapes only because of the tool name. Both paths were inside the work directory. | Both names are file tools now. The hook and the stop rule check their paths. |
| agy 1.4.2 reads an MCP tool's schema from the home (`.gemini/antigravity-cli/mcp/daedalus-arch/<tool>.json`) before it calls the tool. | G9: `read_file` of `check_file.json` completed. `evaluate_project.json` was denied. | In `daedalus-mcp` only, the hook allows reads of the allowed tools' schema files. |
| Tools that no action covers, such as `search_web`, `invoke_subagent`, `schedule`, `browser_*` and `generate_image`, cannot be denied by rules. | The docs give no action for them. | The hook denies them. |

Several denials in that run did come from the permission layer, for example writes outside the work directory and
`curl`. Only the gaps above let calls through.

## Consequence

- **S4 must be re-run live and pass before any Gemini coding cell runs.** The committed S4 result is still absent, and
  `checkS4Result` refuses `agy-cli` until a passing result is committed. Nothing in the loop's Gemini wiring changed
  that rule.
- The re-run checks the hook itself. Any probe whose stream shows a tool step but whose hook log is empty fails with
  `hook-not-invoked`. G0 records whether agy says it loaded the hooks (`unverified` when agy prints no such line).
  G0 never fails on that alone.
- The exploratory study stays on Claude only, the fallback stated before the S4 run. Two things could re-open Gemini
  coding cells: a passing re-run, then a decision by the author.
- This does not affect Study 1 (frozen), the sealed confirmatory tasks or any protocol line.
