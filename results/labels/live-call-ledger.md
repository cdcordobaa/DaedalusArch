# Labeller live-call ledger (v1.2E, runbook 6.4)

> Route `agy` 1.3.2, model `gemini-3.1-pro-high`, home `~/.firewall/labeller-agy-home` (credential files listed by name only, never read). Prereg v13. Plan `results/labels/label-plan.json` (P1 34, MS 2, P2 30, P3 0, P4 0; estimate 132 + 30 reserve <= 300). A retry counts as a call (ADR-021 item 8.7).

## Pre-flight (2026-10-10, zero model calls)

| Check | Result |
|---|---|
| `agy --version` vs `AGY_PINNED_VERSION` | 1.3.2 = 1.3.2 |
| `AGY_CLI_DISABLE_AUTO_UPDATE` | `true` in the child env (`AGY_ENV_SET`) |
| Home rule, skill, plugin, agent, workflow or hook entry | none (names-only listing) |
| `settings.json` | `toolPermission: strict`, terminal sandbox on, slash commands off, all 7 deny rules present |
| `agy mcp list` / `agy plugin list` | none / none |
| `--check-prereg` (all 8 plans) | `pre-registration v13 ok: 70 registered artefacts unchanged` |
| Audit draw (6.2, before any call) | 30 items, seed 6105; view `audit/view/v1.2e-labels.view.json`; allocation sealed in `../daedalus-sealed/v1.2e-labels.allocation.json` |

## Calls

| # | Date | Run | Cassette entries | Invocations (retries incl.) | Cumulative |
|---|---|---|---|---|---|
| 1 | 2026-10-10 | `llm-label --mode record --cassette-dir results/labels/cassettes` (both runs, 66 items) | 139 (132 + 7 re-asks) | 142 (3 CLI retries) | **142 / 300** |
| 2 | 2026-10-11 | P4: `llm-label --plan results/e1-grid/label-plan-p4/label-plan.json --mode record --cassette-dir results/labels/cassettes` (prereg v21; the 66 P1/MS/P2 items replayed, 142 invocations, 0 new) | 1 new (first P4 judge unit, run 0: `TIMEOUT` after 2 attempts, 243 s each) | 3 (2 timed-out attempts + 1 re-ask stopped by `LLM_CLI_ISOLATION`, not recorded) | **145 / 300** |
| 3 | 2026-10-11 | P4 under ADR-034 (prereg v22), same command (05:22–05:56Z); P1/MS/P2 not reached (plan order puts P4 items 36–45 first) | 11 new (10 P4 items, run 0) | 14 (5 tool-use discards, 2 timeouts) | **159 / 300** (cassettes 158 + the 1 unrecorded stopped re-ask of row 2) |
| 4 | 2026-10-11 | ADR-035 API route probe: `llm-label --plan results/labels/api-probe/plan.json` (one fixture judge unit, both runs; `gemini-3.1-pro-preview`, tools off, temperature 0, thinking high) | 2 | 3 (1 provider retry, cause not stored) | **162 / 300** |

No quota pause occurred. Replay of the cassettes is byte-identical to `labels.json`. `--usage`: 139 entries, input tokens min 0, median 14 024, max 124 846, mean 24 246; output 329 569 in total.

**Stop, 2026-10-11 (P4).** The pre-flight passed (agy 1.3.2, `AGY_CLI_DISABLE_AUTO_UPDATE=true`, no home rule/skill/plugin/agent/workflow/hook entry, all 7 deny rules, `agy mcp list`/`plugin list` empty, `--check-prereg` v21 ok on all 10 plans, estimate 224 + 30 <= 300). The re-ask of the first P4 judge unit completed a `search_web` tool step. `search_web` is not among the registered deny rules (§2 of `Docs/labeller-route.md`), so the provider stopped the run (`LLM_CLI_ISOLATION`). No P4 label exists. Resuming needs a registered change to the deny list (a prereg bump) and is escalated to the author.

**Route probes after the stop (2026-10-11, not label calls, outside the label budget; 4 agy invocations).** The probes used the dedicated home, neutral `mkdtemp` cwds and the registered argv, with a probe schema in place of the label schema. `settings.json` was backed up before each probe and restored byte-identical after it.
1. `disabledTools` (51 network, browser, outside-read, shell and subagent tools) at the top level of `settings.json`, with `gemini-3.1-pro-high`: init still listed 60 tools. `search_web` **completed** and returned results. `read_url_content` and `view_file` were refused by the existing deny rules. `open_browser_url` and `list_dir` were not offered to the model.
2. `-p="/permissions"` and `-p="/config"`: these were expected to answer without a turn but ran model turns on the default model (Gemini 3.8 Flash). That makes 2 unintended invocations, with no tool step on the label route.
3. Deny rules `search_web(*)`, `execute_url(*)`, `browser(*)` and `edit_file(*)` added to the 7 registered ones, with `gemini-3.1-pro-high`: `search_web` **completed** again (9 citations). `run_command` was refused by `command(*)`, and the browser tools were not offered.

Finding: on agy 1.3.2, `search_web` passes no permission check. Neither `toolPermission: strict`, any deny rule tried, nor `disabledTools` blocks it. The fail-closed `LLM_CLI_ISOLATION` guard is the only control that fires. P1/MS/P2 check: `agy-cli-provider.ts` is unchanged since `56e77f6`, so the guard was active for all 142 invocations. The run completed with no isolation stop, and the 139 cassettes hold 138 valid answers and 1 `TIMEOUT`, so no tool step completed there: **verified**.

**Stop, 2026-10-11 05:56Z (ADR-034 stop rule, `LABEL_TOOL_USE_STOP`).** 2 of the first 10 P4 items (20 %) ended as `uncertain` / `tool-use`, with 5 tool-use discards. Item 37 (`claude-haiku-4-5/order-fulfilment/none/run-0`, integrity) completed `search_web` on both attempts. Item 44 (`claude-haiku-4-5/task-management/none/run-0`, semantic) ran `search_web`, then timed out, then completed `search_web` twice on the re-ask. Item 36 recovered after its timeout (re-ask valid). The other 7 items answered on the first attempt (27–137 s). Both timed-out calls involve web search. No label file was written. As registered, the run does not continue, and the stop is reported to the coordinator. This was not a usage limit.

**Route change (ADR-035, prereg v23).** From here P4 is labelled on the Gemini API (`Docs/labeller-route.md` §8). The plan is `results/e1-grid/label-plan-p4-api/label-plan.json` (46 P4 items, budget 138 = 300 − 162), and the cassettes are in `results/labels/cassettes-api/`. A quota, rate-limit or overload stop is not cached. It is counted here as one invocation per stop.
