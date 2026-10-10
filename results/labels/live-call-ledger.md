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

No quota pause occurred. Replay of the cassettes is byte-identical to `labels.json`. `--usage`: 139 entries, input tokens min 0, median 14 024, max 124 846, mean 24 246; output 329 569 in total.
