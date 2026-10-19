# Gemini generator adapter (`agy-cli`)

**Status: built, off by default, dry-run only, NOT yet through its S4 confinement probe.** Decision CDX
(`ops/decisions.md`): Gemini is registered as the Codex substitute for Study 2, with its own S4 probe. Design:
`aidlc-docs/construction/v1.4/U5/functional-design/design.md` Part B. Probe: `Docs/v1.4/gemini-s4-probe-spec.md`.

**Protocol note.** The `study2-protocol` line still says `generators=claude-sonnet-5-5,codex-pin`, and
`scripts/v1.3/protocol-consistency-check.mjs` enforces it. This adapter touches no protocol document. The substitution
of Gemini for Codex is carried by the dated M3/CDX deviation (orchestrator lane), not by this code.

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

## Confinement design (what S4 must confirm)

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
| network, browser, sub-agents, schedule, image, workflows, inbox, plugins, `evaluate_project` denied | deny rules in the home settings; the enforced backstop is the tool-escape stop | **UNVERIFIED** (G6, G8, G9) |
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
