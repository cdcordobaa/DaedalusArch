# Build and Test live-call ledger (v1.2E, BT-F)

> **Path**: `Docs/DiagnosticRuns /` (trailing space, DV-BT-7). **Owner**: Build and Test lane (`v1.2e-build-and-test`). **Opened**: 2026-10-08 (Step 34).
> **Rule**: updated after every live run from the recorded cassette entries (`attempts` field) or the probe output. A retry counts as a call (BR-U4-CAS-06). A step that would cross a cap does not start.
> **Counting convention (DV-BT-F1)**: every live `claude -p` spawn under the judge config dir counts as a judge call, including the one stream-json init probe that `checkJudgeIsolation` runs before the first call of each record-mode run (BR-U4-ISO-06). `claude --version` spawns are not model calls and are not counted.

## Preflight (Step 34, zero live calls)

| Check | Result |
|---|---|
| `claude --version` vs `PINNED_CLI_VERSION` (BR-U4-ISO-09) | `2.1.294` = `2.1.294` (pass) |
| Judge config dir placement (`configDirPlacementProblem`, ISO-04) | none (outside the project tree) |
| Judge config dir listing vs the ADR-018 allow-list (`checkConfigListing`) | pass, 0 failures; 14 allow-list items matched (names only: `.claude.json`, `.last-cleanup`, `.last-update-result.json`, `backups`, `backups/.claude.json.backup.*`, `cache`, `cache/**`, `projects`, `projects/*`, `projects/*/memory`, `sessions`, `sessions/<digits>.*.key`, `sessions/<digits>.json`, `settings.json`) |
| Judge child env auto-update switch | `DISABLE_AUTOUPDATER=1` set in the child by `JUDGE_ENV_SET` (ADR-018 item 4) |
| Author-install auto-update switch (U4 §7 row) | **AUTHOR ACTION open**: `DISABLE_AUTOUPDATER` is not set in the author shell environment; the author's own `~/.claude` settings were not read (task secrets rule), so the install-level switch is unverified |
| ADR prose (`adrProse`, U4 §7 row) | no registered spec supplies it: the spec grammar has no ADR-prose field and no caller sets `RouterInput.adrProse`; the only occurrence outside `src/` is the token budget `adrProse: 1000` in `corpus/frozen-instrument.json`. The `## ADR context` prompt section is therefore always absent: **declared limitation**, no code change (wiring it would change the instrument before the freeze) |

## SEN-01 required live calls (Step 36, Mock record, zero live calls)

Mock provider, full mode, `--cassette-mode record` into scratch cassette dirs, lane 7693, seeds in `bt-sen01-seeds/`. A cassette entry is one judge call (3 runs per unit). The FF-N01 keys of the scratch spec with FF-N02 `enabled: false` equal the FF-N01 keys of the full-spec runs (15 = 15, set-equal), so disabling the other function does not change the probed function's prompts (DV-BT-3 holds). The base run of the full spec reproduces the committed `tests/fixtures/judge-cassettes/correct-reference/` file names exactly (42).

| Function | Base copy | New on the seeded copy | Cassette entries | Init probes (2 record runs, DV-BT-F1) | Required live calls |
|---|---|---|---|---|---|
| FF-N01 (copy I) | 4 module units × 3 = 12 | `src/domain/entities` × 3 = 3 | 15 | 2 | **17** |
| FF-N02 (copy S) | 10 file units × 3 = 30 | `src/domain/entities/Task.ts` × 3 = 3 | 33 | 2 | **35** |

Totals: Step 35 (3) + FF-N01 (17) + FF-N02 (35) = **55 > 40**. **E-2 confirmed**: after Steps 35 and 37 the remaining budget is 40 − 3 − 17 = **20 < 35** (without the probes: 33). Copy S also changes the FF-N01 `src/domain/entities` key and copy I adds two FF-N02 file units (6 entries); neither is needed for the probed function.

## Judge (cap 200 since ADR-019 item 5; was 40; retries included)

| # | Date | Step | Run | Calls (attempts) | Running total |
|---|---|---|---|---|---|
| — | 2026-10-08 | 34 | preflight (no live call) | 0 | 0 |
| 1 | 2026-10-08 | 35 | ISO-07 canary repeat: positive control, negative (ancestor cwd), negative (neutral cwd); `tests/fixtures/claude-cli/canary-result-bt-2026-10-08.json` | 3 (3 spawns, no retry) | 3 |
| 2 | 2026-10-08 | 37 | SEN-01 FF-N01 + live smoke, base copy (scratch spec, FF-N02 off): 1 init probe + 4 module units × 3 | 13 (12 cassette attempts, no retry, + 1 probe) | 16 |
| 3 | 2026-10-08 | 37 | SEN-01 FF-N01, I copy (same cassette dir; 3 base units hit): 1 init probe + 1 unit × 3 | 4 (3 cassette attempts, no retry, + 1 probe) | 20 |
| — | 2026-10-08 | 38 | SEN-01 FF-N02 **not started**: needs 35 (Step 36), remaining 20; **E-2 open** | 0 | 20 |
| — | 2026-10-09 | — | ADR-019 item 5: cap raised to 200, so E-2 is resolved | 0 | 20 |
| 4 | 2026-10-09 | ADR-022 item 5 | Pinned judge CLI check: dedicated `2.1.294` at `~/.firewall/judge-cli` (the author's install is now `2.1.295`), keychain auth through the judge config dir. 1 init probe (pass: tools `[StructuredOutput]`, `mcp_servers` `[]`, `apiKeySource` none, model `claude-opus-5-5`) + 1 judge call (`INIT_PROBE_PROMPT`, `is_error` false, resolved `claude-opus-5-5`). Beforehand, the allow-list check failed closed on 4 entries left by a non-judge session at 04:12: `history.jsonl`, `plugins/` and its cache file, and a session transcript under `projects/<DaedalusArch cwd>/`. The operator moved them to `~/.firewall/judge-config-quarantine-2026-10-09/` (mode 700; ADR-018 item 1 remedy, nothing deleted), and the listing then passed. | 2 (no retry) | 22 |

## Generator (cap 11 sessions + 3 retries; not judge calls)

Generator plan file used for Steps 39–41 (scratch, not committed; outside the repository): `adapters` opus / sonnet / haiku (`claude-code-cli`), both tasks, three levels, `runs` 3, `outRoot` `../daedalus-e1-outcomes`, `harnessRoot` `../daedalus-gen-harness`, `binary` `<HOME>/.local/share/claude/versions/2.1.294`, `allowBash` true. `orderSeed` 0 is a probe and pilot placeholder only (the pilot has one cell per level); the E1 `orderSeed` is not set here (OI-BT-F3).

| # | Date | Step | Run | Sessions | Retries | Running total |
|---|---|---|---|---|---|---|
| — | 2026-10-08 | 34 | preflight (no live session) | 0 | 0 | 0 |
| 1 | 2026-10-08 | 39 | confinement probes (`confinement-cli.ts`, opus, Bash set): 5 / 5 pass | 5 | 0 | 5 |
| 2 | 2026-10-08 | 40 | model-usage envelopes (Bash set), one per pinned id: opus, sonnet, haiku; all model-valid | 3 | 0 | 8 |
| 3 | 2026-10-08 | 41 | pilot (`generate-projects.ts --pilot`): opus, task-management, none / minimal-prose / full-aac; 3 ok | 3 | 0 | **11** (cap reached; 0 of 3 retries used) |

## Labeller route probe (ADR-019 item 4; probe cap 15; not judge calls)

Gemini CLI 0.46.0 under a dedicated `GEMINI_CLI_HOME` (`<HOME>/.firewall/labeller-gemini/home`), `env -i` allow-list, neutral `mktemp` cwd, credentials reused in place through `GOOGLE_APPLICATION_CREDENTIALS` (never read or copied). Evidence: `tests/fixtures/gemini-cli/probe-values.json`.

| # | Date | Run | CLI spawns | Spawns reaching auth | Model requests | Running total (spawns reaching auth) |
|---|---|---|---|---|---|---|
| 1 | 2026-10-08 | `--version` ×2, `--list-extensions` ×2, one headless `--output-format json` call | 5 | 3 | 0 | 3 / 15 |

Every spawn that reached auth stopped at the Code Assist tier check (`IneligibleTierError`, `UNSUPPORTED_CLIENT`, free tier "Gemini Code Assist for individuals") before any model request. The probe stopped there (ADR-019 item 4 halt). Judge total unchanged.

**Correction (2026-10-09; review of the probe):**
- **Route closed, no author decision pending.** ADR-019 item 4 as amended (commit `1185a1f`, the parent of the probe commit `aae310a`) already records this refusal and binds the route to the Antigravity CLI (`agy`, cask `antigravity-cli` 1.1.23, dedicated home `<HOME>/.firewall/labeller-agy-home`, model `gemini-3.1-pro-high`). The Gemini CLI route is not resumed. The next step is the agy isolation probe under the amendment: no tools, extensions or MCP servers, no ambient `GEMINI.md`, the dedicated home, version pin 1.1.23, canaries with positive controls, the model-id check and cassettes. Escalate only if agy cannot be isolated.
- **Credential reuse is not repeated.** Pointing `GOOGLE_APPLICATION_CREDENTIALS` at the author's ambient `<HOME>/.gemini/oauth_creds.json` tied the dedicated home to `~/.gemini`. Any CLI route signs in inside its own dedicated home, as the amendment does.
- **Exit code depends on the mode.** The tier refusal exited 1 only in the headless call (5); the non-headless `--list-extensions` calls (2, 3) exited 0 with the refusal on stderr. Calls 2 and 3 are unevidenced: their home was gone before their files were saved (cause not established), so their auth-reached count rests on notes. Evidenced spawns reaching auth: 1 (call 5).
- **The two 200s are unrelated.** `llm-label --estimate` on `tests/fixtures/u5b/labels/plan.json` (40 calls <= 200) uses that fixture plan's own `budgetCalls`; it is not the ADR-019 item 5 judge-call budget above. The registered labelling budget is `labellingBudgetCalls` 4000 in `corpus/prereg.json`.

## Labeller route probe, agy (ADR-019 item 4 as amended; probe cap about 15; not judge calls)

agy 1.3.2 (`/opt/homebrew/bin/agy`; the cask records 1.1.23, but the binary had updated itself in place), dedicated `HOME` `<HOME>/.firewall/labeller-agy-home`, `env -i` allow-list, `AGY_CLI_DISABLE_AUTO_UPDATE=true`, a fresh neutral `mktemp` cwd per call, model `gemini-3.1-pro-high`. Evidence: `tests/fixtures/agy-cli/probe-values.json`. A model call is one agy turn. `--version`, `models`, `mcp list`, `plugin list`, `agents`, `changelog`, read-only slash commands (`num_turns` 0) and runs rejected before a turn (unknown model, empty HOME) are not counted.

| # | Date | Run | Model calls | Running total |
|---|---|---|---|---|
| 1 | 2026-10-09 | c01 json + schema; c02 stream-json init; c03 unintended `/config` prompt (slash commands disabled) | 3 | 3 |
| 2 | 2026-10-09 | c04 tools under `strict` only; c05 tools under `strict` + deny rules | 2 | 5 |
| 3 | 2026-10-09 | c06 canary positive control; c07 canary negative | 2 | 7 |
| 4 | 2026-10-09 | c09 print timeout 2 s | 1 | 8 |
| 5 | 2026-10-09 | c11 memory plant; c12 memory probe | 2 | 10 |
| 6 | 2026-10-09 | smoke: `llm-label --provider agy --mode record` on `tests/fixtures/agy-cli/smoke-plan.json` (1 fixture item × 2 runs, no retry) | 2 | **12** |

Outcome: isolation **PASS** (see `Docs/labeller-route.md` §2). Judge total unchanged.

**Capacity (escalated).** A label call uses 74k–124k input tokens and takes about 60 s. On the author's tier the two smoke calls used about 1.1 % of the weekly Gemini quota and 2.6 % of the 5-hour quota, so roughly 180 label calls fit in a week. The registered `labellingBudgetCalls` of 4000 would need about 22 weekly windows.

**Estimate.** No real label plan exists yet: the P1–P4 / MS plan producer is a U6 item (ADR-021), and its inputs come from the so4-heldout, e7-corpus and e1-grid runs. `llm-label --estimate` on the fixture plan `tests/fixtures/u5b/labels/plan.json` prints `40 calls <= budget 200` (that 200 is the fixture's own `budgetCalls`). The registered ceiling is 4000 calls.

**Gemini CLI probe attribution (correction to the section above).** The first dedicated Gemini home (`<HOME>/.firewall/labeller-gemini`) and its probe directory were removed by this labeller session, on the coordinator's clean-up instruction after the route change. That removal explains why the stderr of calls 2 and 3 was never saved. The cause is now established; there was no concurrent process.
