# Labeller route: Antigravity CLI (`agy`)

> **Status**: DRAFT, for registration in the P-U6 bump (ADR-021 item 4). Not yet a registered artefact; `corpus/prereg.json` is unchanged.
> **Decisions**: ADR-019 item 4 as amended 2026-10-08 (`1185a1f`); ADR-021 SO3-1, SO3-4, THR-5.
> **Evidence**: `tests/fixtures/agy-cli/probe-values.json` and the scrubbed probe outputs beside it (probe of 2026-10-08/09, 10 model calls plus a 2-call smoke).

## 1. Pinned values (BR-U4-VRD-09, BR-U5b-31)

| Item | Value | How it was verified |
|---|---|---|
| Route | `agy` headless, prompt on stdin, `--output-format stream-json` | probe calls 1–2 |
| CLI version | **1.3.2** (`AGY_PINNED_VERSION`) | `agy --version`. Homebrew records cask 1.1.23, but the binary had already updated itself in place. Every record-mode run checks the version and stops on drift (`LLM_CLI_VERSION_DRIFT`). |
| Auto-update | `AGY_CLI_DISABLE_AUTO_UPDATE=true` in the child env | With a stale check stamp, the value `1` still spawned the updater, while `true` logged "Auto-update disabled via environment variable". |
| Labeller model | **`gemini-3.1-pro-high`** (`AGY_LABELLER_MODEL`; `--model`, no default in `llm-label`) | Listed by `agy models` and named by every stream-json `init` event. The provider stops if `init.model` differs from the requested id. |
| Why this model | Strongest generally available Gemini Pro on the route. 3.1 Pro is the only Pro family listed (3.6–3.8 are Flash), and "High" is its higher reasoning level. It is of a different family from the Claude judge and generator (BR-U5b-40). | — |
| Account | Author's Google OAuth sign-in inside the dedicated home `~/.firewall/labeller-agy-home` (mode 700). Credential files are listed by name only and never read. | — |

## 2. Isolation (ADR-019 item 4)

- **Environment**: only `PATH`, `USER`, `LOGNAME`, `TMPDIR` and `LANG` pass through. `HOME` is the dedicated home.
- **Tools**: agy always registers its tool set (60 tools), so tools are made inert instead. The home's `settings.json` sets `toolPermission: strict`, `enableTerminalSandbox: true` and `disableSlashCommands: true`, plus `permissions.deny` = `command(*)`, `read_file(*)`, `read_file(/)`, `write_file(*)`, `write_file(/)`, `mcp(*)`, `read_url(*)`. `strict` alone was not enough: reads reported DONE. With the deny rules, every attempt (shell, read inside and outside the workspace, URL fetch, write) was refused. A denied attempt is allowed. A tool step that completes (any tool other than `finish`) stops the run (`LLM_CLI_ISOLATION`).
- **MCP, plugins, agents, hooks**: none. `agy mcp list` and `agy plugin list` are checked before every record-mode run.
- **Ambient rules**: the canary positive control fired on a cwd `AGENTS.md` and on the home's `.gemini/GEMINI.md` and `.gemini/config/GEMINI.md`. Ancestors outside a git repository did not fire. Each call therefore runs in a fresh, empty `mkdtemp` cwd outside any repository, with no rule file or customisation dir on its ancestor chain. The pre-flight also fails closed on any rule, skill, plugin, agent, workflow or hook entry in the home, outside agy's own builtin dir. The negative canary found no token.
- **Cross-conversation memory**: a planted codeword was not recalled by a later call. There is no positive control, because `/learn` is disabled: **residual**.
- **No system channel**: the persona is prepended to the prompt.

## 3. Determinism-rule amendment (ADR-021 SO3-4)

agy has no temperature, seed or max-token setting. BR-U5b-31's "temperature 0" therefore cannot be honoured on this route. The labeller still sends `temperature: 0`, and every cassette records it under `ignoredOptions`. The two runs per item (BR-U5b-32) and the run-vs-run agreement measure the resulting variability. **Validity criterion (ADR-021)**: if run-vs-run κ < 0.60, the FP/FN taxonomy is reported as descriptive only.

## 4. Error classes

| Observation | Class | Decorator action |
|---|---|---|
| `[agy] print timeout after …` on stderr (exit 0, status SUCCESS, empty response), or runner kill | `LLM_CLI_TIMEOUT` | retry once |
| `authentication failed or timed out` / `authentication required` | `LLM_AUTH` | stop |
| `invalid model selection` | `LLM_NOT_CONFIGURED` | stop |
| `RESOURCE_EXHAUSTED`, `MODEL_CAPACITY_EXHAUSTED`, quota, rate limit, 429 (**unverified**: never observed) | `LLM_USAGE_LIMIT` | stop |
| completed tool step; `init.model` differing from the request | `LLM_CLI_ISOLATION` | stop |
| no result event | `LLM_CLI_BAD_ENVELOPE` | retry once |
| status ERROR, non-zero exit, or empty answer (e.g. denied-only turn) | `LLM_CLI_EXIT` | retry once |

The exit code is never trusted on its own.

## 5. Capacity

A label call takes about 60 s and uses 74k–124k input tokens, because the agent turn resends its large system prompt. On the author's tier, the 2-call smoke consumed about 1.1 % of the weekly Gemini quota and 2.6 % of the 5-hour quota. That allows roughly 180 label calls per week and 75 per 5-hour window. The registered `labellingBudgetCalls` of 4000 would need about 22 weekly windows. This is escalated to the author; see the ledger.
