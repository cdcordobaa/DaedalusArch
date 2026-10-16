# v1.3 loop generator isolation and pins (S2, S3; TV-95)

**2026-10-16. Status: design and pass criterion, committed before the code.** Tooling for readiness gate lines S2 and S3 of `Docs/v1.3/study2-readiness-gate.md` (on `origin/v1.3-study2-readiness`, PR #146). No model was called. Nothing here runs a pilot or a Study 2 call, and no sealed artefact is read.

## 1. The gap

- **S2.** The Claude loop adapter checks only that `claude --version` answers (`ClaudeStepAgent.isAvailable`, `scripts/lib/loop/agents.ts`). The CLI version is not in the loop plan and is never compared. The Codex adapter is already pinned (`codex.cliVersion`, `CodexStepAgent.isAvailable`). The model id is pinned per adapter and checked against the envelope (`turnStatus` → `model-mismatch`).
- **S3.** The Claude generator child gets `buildGeneratorChildEnv(process.env)`: the allow-list of `GENERATOR_ENV_ALLOW`, the real `HOME`, no `CLAUDE_CONFIG_DIR` and no auto-update switch. Ambient `~/.claude` content (user `CLAUDE.md`, hooks, skills, plugins, settings) can reach every turn (TV-95). The judge already solved this (`src/llm-critic/claude-cli-provider.ts`: a dedicated `CLAUDE_CONFIG_DIR`, `DISABLE_AUTOUPDATER=1`, the ADR-018 config-dir listing, the pinned version). The Codex adapter uses a dedicated `CODEX_HOME` and an empty `HOME`.

## 2. Design (all OFF by default)

Rule 3 of the night: every new behaviour is opt-in. A plan without the new fields runs exactly as today: same argv, same env, same records, same bytes. Dry run and replay never spawn a CLI, so they are untouched.

1. **Version pin per adapter.** New optional plan field `adapters[].cliVersion` (`x.y.z`). When set on a `claude-code-cli` adapter, the pre-run probe runs `<binary> --version` in the same child environment the turns use, parses the first `x.y.z` token (the judge's `parseCliVersion`), and the grid refuses to start on a mismatch (`LOOP_CLI_VERSION_MISMATCH`, exit 1, before any turn). On a `codex-cli` adapter it must equal `codex.cliVersion` (plan error otherwise); the Codex probe already enforces that value.
2. **Isolation block.** New optional plan block `generatorIsolation: { claudeConfigDir }` (`"<local>"` filled from `--claude-config-dir`). It requires `cliVersion` on every `claude-code-cli` adapter (isolation without a pin is half a control). When present, every Claude spawn of the loop (the version probe, every step turn and every repair turn) runs with:
   - the E1 allow-listed environment (`buildGeneratorChildEnv`: credentials, `*_TOKEN`, `*_KEY` removed);
   - `HOME` = `<H>/runs/<runId>/home` (created empty, mode 0700, per run; the probe uses `<H>/probe-home`);
   - `CLAUDE_CONFIG_DIR` = `claudeConfigDir`: a dedicated directory the author logs in once, outside the repository, outside `outRoot`, not the real `~/.claude`;
   - `DISABLE_AUTOUPDATER=1` (the judge's switch, `JUDGE_ENV_SET`).
3. **Fail-closed checks before every isolated turn.** The config dir passes the judge's ADR-018 listing check (`checkConfigListing`: no `CLAUDE.md`, `.mcp.json`, `agents`, `commands`, `hooks`, `plugins`, `settings.local.json` or `skills` on any path; `settings.json` keys limited to `env`/`theme` and env to `DISABLE_AUTOUPDATER`; names only, never contents). The per-run `HOME` holds no `.claude`, `.claude.json` or `CLAUDE.md`. A failure stops the turn before the CLI is spawned (`LOOP_ISOLATION`). The judge's allow-list is reused unchanged (`src/llm-critic/frozen.ts` is not edited).
4. **Env record.** An isolated turn writes `env-<turnId>.json` beside its envelope: the env variable *names*, the values of `HOME`, `CLAUDE_CONFIG_DIR` and `DISABLE_AUTOUPDATER`, the probed CLI version and the config listing sha256. No other value is written. Gate S2's "auto-update off shown in the run env record" reads this file.
5. **MCP server child.** The Claude CLI spawns the `daedalus-mcp` stdio server from the strict MCP config (`env: {}`), so the server inherits the CLI's already isolated environment. No separate spawn site exists in the harness. Whether the server really sees only that env needs the live confinement probe with the server attached (S4); that is the author's.
6. **Usage limits (S1).** Step and repair turns both go through the one `driveTurn` with the E1 classifier (`attemptDisposition`, `runWithRetries`). The version probe makes no model call. This job adds tests that the repair turn and an isolated turn classify the recorded usage-limit text, pause and resume without consuming an attempt. Recording pause durations (the other half of S1) is not done here.

## 3. Pass criterion (fixed before any code)

- P1. A plan with `adapters[].cliVersion` refuses to start when the stub binary prints a different version, and starts when it prints the pinned one. Unit test.
- P2. A Codex adapter `cliVersion` different from `codex.cliVersion` is a plan error; `generatorIsolation` without a Claude `cliVersion` is a plan error; an isolation config dir inside the repository or `outRoot` is refused. Unit tests.
- P3. With `generatorIsolation`, the probe, a step turn and a repair turn each spawn with `HOME` under `<H>/runs/<runId>/home` (probe: `<H>/probe-home`), `CLAUDE_CONFIG_DIR` = the plan dir, `DISABLE_AUTOUPDATER=1`, no name outside the allow-list plus those two, and no credential. A config dir holding `hooks/` or `CLAUDE.md`, or a run `HOME` holding `.claude`, stops the turn before any spawn. Unit tests; a test fails if any of these regress.
- P4. Without the new fields, the argv and the child env of a turn equal today's exactly (the existing agent tests stay green unchanged), and `env-*.json` is not written.
- P5. The repair turn and an isolated turn classify the recorded usage-limit text as a pause with no attempt consumed. Unit tests.
- P6. Rule 3: `ue-baseline-live --engine cypher-interp` is byte-identical to `results/v1.3-reference/after-member-facts` (timing excepted); the loop dry run and the loop replay test pass as before.

A null or failing result is reported as such in the PR.

## 4. What stays with the author

- Log in once into the dedicated config dir (`CLAUDE_CONFIG_DIR=<dir> claude`), set `generatorIsolation.claudeConfigDir` and `adapters[].cliVersion` in the pilot and Study 2 plans. The demo and pilot plans are not edited here.
- Credential location: on macOS the CLI login lives in the Keychain; on Linux in `<config dir>/.credentials.json`, which the judge's frozen allow-list does not list, so on Linux the listing check would refuse a logged-in dir. Study 2 runs on the author's Mac; a Linux run would need an allow-list decision (not taken here).
- The live confinement probes with the MCP server attached, per CLI and arm (S4), and the first live turn authenticating under the exact production env (S3 pass) need a real login.
- Auto-update verified off on the machine that runs Study 2 (S2 pass).

## 5. Result (2026-10-16, after the code)

Code: `scripts/lib/loop/isolation.ts` (new), `agents.ts` (`ClaudeStepAgent.probe`, isolated env, `before` check, `env-<turnId>.json`), `plan.ts` (`adapters[].cliVersion`, `generatorIsolation`, `--claude-config-dir` fill), `main.ts` (for a plan with a pin or isolation only: the probe runs before the skeleton install and a mismatch exits 1; a plan without them keeps the E1 order, the E1 `isAvailable` check and prints nothing new). Tests: `tests/unit/scripts/loop/isolation.test.ts` (19 tests).

| Criterion | Result |
|---|---|
| P1 version pin | PASS. A stub `claude` printing `2.1.300` against the pin `2.1.294`: `LOOP_CLI_VERSION_MISMATCH` from the probe, and `main` exits 1 with no skeleton install and no `schedule.json`. The pinned version passes. Unpinned plans accept any answering binary, as before. |
| P2 plan validation | PASS. Malformed pin, Codex pin ≠ `codex.cliVersion`, isolation without a Claude pin, a bad block shape, and a config dir inside the repository, `outRoot`, `<H>/runs`, the real `~/.claude` or the real `HOME` are refused. |
| P3 isolated spawns | PASS. The stub binary, really spawned, sees only the E1 allow-list names plus `CLAUDE_CONFIG_DIR` and `DISABLE_AUTOUPDATER`, with `HOME` = `<H>/probe-home`, and no credential. Step and repair turns spawn with `HOME` = `<H>/runs/<runId>/home` (0700). `env-<turnId>.json` is written for both. A `hooks/` dir, a `CLAUDE.md`, a `settings.json` with `hooks`, a `.claude` in the run `HOME`, or a missing config dir each stop the turn (or the probe) before any spawn. |
| P4 OFF by default | PASS. Without the fields, the probe and turn env equal `buildGeneratorChildEnv(parent)` exactly (real `HOME` kept), no `env-*.json`, no run `HOME`. The existing agent, loop, pilot and plan tests pass unchanged. |
| P5 usage limits | PASS. The recorded usage-limit text at a repair turn (E1 env), an isolated step turn and an isolated repair turn: one interruption, one pause, attempts `['completed']`. |
| P6 bytes | See the PR body for the rule 3 reference diff. The loop dry run on the demo plan equals the `origin/v1.3-loop-replay` dry run in every file except timing fields and the commit shas that carry commit times. The Neo4j loop replay test skips here (no scratch Neo4j); `replay.ts` does not reach the changed code (its agent is the scripted one). |

**Not done here.** Pause durations in the turn record (other half of S1); the live probes with the MCP server attached (S4); a real login under the isolated env (S3 pass); the pilot and Study 2 plans are not given `cliVersion` or `generatorIsolation` (author's values); the Linux credential-file allow-list question (§4).

**Review follow-up (2026-10-16, owner review on PR #171).** The first version broke the line 12 promise for live runs without the new fields: it probed every adapter before the skeleton install, routed `isAvailable()` through the new probe, and printed a `LOOP_UNPINNED` warning. The fix: the warning is removed; `isAvailable()` is the E1 code again; a plan without `cliVersion` or `generatorIsolation` runs `ensureHarness` first and the E1 availability check exactly as on `origin/v1.3`; only a pinned or isolated plan probes before the install. Unit test: an unpinned live plan with an unavailable binary still installs first and exits 1 with `LOOP_CLI_UNAVAILABLE` and no new stderr line.
