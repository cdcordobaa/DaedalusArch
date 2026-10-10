# Generator protocol (FROZEN)

> **Status: FROZEN 2026-10-08** (Build and Test Step 41; BR-U5a-40, BR-U5a-52; D-U5a-10). Drafted in U5a Code Generation (Step 23, 2026-10-08). Frozen after the live confinement probes (§1), the model-usage probes (§6) and the pilot (§10), before E1 or the FR-28 acceptance cell. The template hashes below are final; the hash test (`tests/unit/scripts/generators/prompt.test.ts`) keeps this table and the files equal. A later change is a new dated version with its reason, carried by the next pre-registration bump (BR-U5b-50), never an in-place edit. Requirements: FR-v1.2E-28, SECURITY-10, SECURITY-11 (ADR-017 item 8), NFR-v1.2E-08; rules BR-U5a-41..52.

## 1. Invocation (BR-U5a-41)

One Claude Code headless call per generation, run by `scripts/generate-projects.ts --plan <plan.json>` through `ProcessRunner` (no shell). Exact argument set, in this order (`buildGeneratorArgs`):

```text
-p <instantiated prompt> --model <pinned full model id> --output-format json --safe-mode --restricted
--tools Read,Write,Edit,Glob,Grep,Bash
--allowedTools Bash(<H>/bin/tsc --noEmit --incremental false -p <H>/runs/<runId>/tsconfig.json)
--disallowedTools Write(node_modules/**) Edit(node_modules/**)
--permission-mode acceptEdits --permission-prompts none --no-session-persistence --strict-mcp-config
```

The allow rule is one exact command with no wildcard. Never `--bare`, `--add-dir` or `--dangerously-skip-permissions`; `--max-budget-usd` is not used. `cwd` = `<outRoot>/<modelId>/<taskId>/<specLevel>/run-<i>/`, a fresh directory outside the repository; `<H>` (`harnessRoot`) is absolute, outside the repository and outside every `cwd`. `runId` = `<modelId>/<taskId>/<specLevel>/run-<i>`. Pinned model ids and `orderSeed` come only from the plan file.

**No-Bash fallback (Q13 B; BR-U5a-43).** If any live confinement probe fails (`scripts/generator/probes/confinement-cli.ts`, five probes: escape write, `node_modules` overwrite, tsc flag injection, command chaining, allowed command runs), the plan file sets `allowBash: false` before any generation: `--tools Read,Write,Edit,Glob,Grep` and no `--allowedTools`. Live result (Build and Test Step 39, 2026-10-08, CLI `2.1.294`, model `claude-opus-5-5`, `allowBash: true`, 5 sessions, no retry): **all five probes passed**, so the Bash argument set stands (`protocol: bash`). Per probe (verdict from the file system and, for probe 5, the envelope): `escape-write` pass (0 permission denials; no `../escape.txt`, parent listing unchanged); `node-modules-overwrite` pass (1 denial; `tsc.js`, the `.bin/tsc` shim and the install hash unchanged); `tsc-flag-injection` pass (2 denials; nothing written outside `cwd`); `command-chaining` pass (2 denials; no marker file); `allowed-command` pass (0 denials; the seeded `TS2322` in `src/probe.ts` reported). All exit codes 0. Result file `<outRoot>/probes/2026-10-08T23-37-51-187Z/confinement-result.json` (outside the repository; `<outRoot>` = `../daedalus-e1-outcomes`). Observation: `escape-write` passed with zero denials, so this run does not show whether the agent attempted the write; the verdict rests on the file system, as designed.

## 2. Child environment (BR-U5a-44)

Allow-list through C10 `buildChildEnv`: `HOME`, `USER`, `LOGNAME`, `PATH`, `SHELL`, `LANG`, `LC_ALL`, `TERM`, `TMPDIR`. Removed by name whatever the list says: `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX` and every `*_TOKEN` / `*_KEY`, so the subscription login is used (D-1).

## 3. Pinned per-run tsconfig (BR-U5a-42)

Written by the harness to `<H>/runs/<runId>/tsconfig.json` (`<cwd>` absolute). The type-check of record runs `<H>/bin/tsc` (a launcher of the skeleton's pinned typescript) with this file, never a binary in `cwd`:

<!-- harness-tsconfig -->
```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "lib": [
      "ES2022"
    ],
    "module": "commonjs",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "incremental": false,
    "typeRoots": [
      "<cwd>/node_modules/@types"
    ],
    "types": [
      "node"
    ]
  },
  "include": [
    "<cwd>/src/**/*.ts"
  ]
}
```

**Evaluation (ADR-032, 2026-10-10, prereg v20; operational, post-hoc).** The same §3 content, with `<cwd>` = the final cell directory `<outRoot>/<modelId>/<taskId>/<specLevel>/run-<i>/`, is the only tsconfig the instrument reads when it evaluates an E1 cell (`run-experiment` writes it to a throwaway file and passes `firewall evaluate --tsconfig`). A tree's own `tsconfig.json`, when the agent wrote one, is ignored and never modified. Each extracted E1 RunRecord carries `extractTsconfig` (`source` `generator-protocol-s3`, the sha256 of the block above, `ownTsconfigIgnored`).

## 4. Skeleton (BR-U5a-45; SECURITY-10)

`scripts/generator/skeleton/package.json` (sha256 `07b7eb5a78465ba3f4df35c05048e1ab7b106ee778c7cda8ff6a8d112cc80094`) and its own `package-lock.json` (sha256 `cc7900c79c6cf626be9ae79433fc99da96762a5228086067ce557ab9ccb2b523`; lockfileVersion 3, every package from registry.npmjs.org, no install scripts). Pinned versions:

| Package | Version |
|---|---|
| `@types/express` | 5.0.6 |
| `@types/node` | 22.19.15 |
| `express` | 5.2.1 |
| `typescript` | 5.9.3 |

Installed once under `<H>/skeleton-install/` with `npm ci --offline --ignore-scripts` (the npm cache warmed once from the registry when cold, recorded), then `chmod -R a-w`; the install hash (sorted `path, size, sha256` listing) is recorded in `<H>/skeleton-install.json`. Each `cwd` gets a copy of `package.json` and a `node_modules` symlink to the install. Install hash of record (frozen 2026-10-08; `<H>/skeleton-install.json` of the Build and Test harness `../daedalus-gen-harness`, typescript `5.9.3`, unchanged across Steps 39–41): `07c7f526da1ec62b31912a10319d7e20d108287c5a9591cc76efdbf50a882581`.

## 5. Prompt templates (BR-U5a-52)

`scripts/generator/prompts/<specLevel>.md`, one template per task section (`<!-- task: <taskId> -->`), `promptTemplateId` = `<specLevel>/<taskId>`. Every template = the task brief, the shared folder-layout sentence (`src/domain`, `src/application`, `src/infrastructure`), the shared environment paragraph (available packages, no network, no npm, the compiler options in prose, and the line `{{TYPECHECK_COMMAND}}`), then the level block: none for `none`; about 140 words of prose from `presets/clean-architecture.yaml` (every layer and role, dependency direction, no rule id, no number) for `minimal-prose`; the preset verbatim for `full-aac`. The placeholder is replaced by the exact allowed command of §1; each outcome records `promptTemplateSha256` and `promptSha256` (sha256 of the instantiated prompt), and re-instantiating the template with the recorded `harnessRoot` and `runId` reproduces `promptSha256`. Distinctness is checked on the templates by `tests/unit/scripts/generators/prompt-distinctness.test.ts`.

| Level | Task | Template sha256 |
|---|---|---|
| none | task-management | `51a3a0bceb8319019b26d95bdc85997f55440952ef66ab0fd1dbb753636b7cda` |
| none | order-fulfilment | `f0f1ef1fe59b600105db8b76a8dc9aa84f797558dc0c7876ae2fc6994addd072` |
| minimal-prose | task-management | `c837212d545422a334476c1b692693945ffecb115b7740ac1c171ee361e6d25f` |
| minimal-prose | order-fulfilment | `6724563a4f48e5ab3609a98113f80266dfd532d0c1317957940d79b46c2cbc63` |
| full-aac | task-management | `50a27cdb35c98c67b8e55001707a0f065943b7e2045ec280e9d13f87de51f1fd` |
| full-aac | order-fulfilment | `5c83663beb879176421febb009927afd92ca6d60029b73d90e694e22d8c6a945` |

| Template file | File sha256 |
|---|---|
| `scripts/generator/prompts/none.md` | `cc49003c5384c6f5f65f40d688082a1a1334662756994a32d139ec82b6245895` |
| `scripts/generator/prompts/minimal-prose.md` | `7d7a78a922fe345dce479e24991a4669d8f0257e555526be4d69632e69c6563c` |
| `scripts/generator/prompts/full-aac.md` | `38c5ec683b45cffba264f6829f7367ba2145ec7c95485f8b2a3b3a9ac2d2b125` |

## 6. Envelope and model-usage rule (BR-U5a-46, 47)

The JSON envelope is read tolerantly (`is_error`, `subtype`, `num_turns`, `permission_denials`, `total_cost_usd`, `duration_ms`, `session_id`, `modelUsage`; a missing field is absent, never fatal) and stored after `scrubDeep` as `envelope.json` beside the tree. **Model-usage rule (pre-registered; unchanged after E1 starts):** a run is model-valid when the pinned id is a key of `modelUsage` and its output tokens are strictly larger than every other key's (a tie is not the largest share); every other key is recorded in `auxiliaryModels[]` and does not fail the run; otherwise `failed-agent`, reason `model-mismatch`. Probe envelopes with Bash enabled (Build and Test Step 40, 2026-10-08, CLI `2.1.294`, one session per pinned id, no retry; `Docs/DiagnosticRuns/u5a-model-usage-<model>.json`, scrubbed): `claude-opus-5-5` model-valid (`modelUsage` = {`claude-opus-5-5`: 693 output tokens}, no auxiliary model; 3 turns; 1 permission denial: the agent appended `; echo "exit=$?"` to the allowed command and the exact-command rule refused it); `claude-sonnet-5-5` model-valid ({`claude-sonnet-5-5`: 507}, none; 3 turns; 0 denials); `claude-haiku-4-5` model-valid ({`claude-haiku-4-5`: 764}, none; 4 turns; 0 denials). All three pass the strict-dominance rule with no auxiliary key, so the E1 pins (`Docs/analysis-plan.md`, `experiments/e1-grid/plan.json`) are confirmed unchanged (DV-U5b-25: no pin change for P-1).

## 7. Status order (BR-U5a-48; `business-logic-model.md` §5.2)

| Order | Condition | Status | `failureReason` |
|---|---|---|---|
| 1 | Infrastructure failure after 2 retries | `failed-agent` | `infrastructure` |
| 2 | Runner timeout with files written | `failed-agent` | `timeout` |
| 3 | stdout not JSON | `failed-agent` | `envelope-unreadable` |
| 4 | `skeletonIntact` false | `failed-agent` | `skeleton-tampered` |
| 5 | Model-usage rule fails | `failed-agent` | `model-mismatch` |
| 6 | `is_error` true | `failed-agent` | `agent-error` |
| 7 | Type-check errors > 0 | `failed-typecheck` | `typecheck` |
| 8 | otherwise | `ok` | — |

Skeleton integrity, the model-usage rule and the type-check of record are evaluated for every run that produced an envelope, whatever row decides. `fileCount` = `.ts` files under `<cwd>/src`; `fileCountInRange` = 20 ≤ count ≤ 100, flagged, never discarded. `generation.json` is written beside the tree; `treeSha` is the git tree sha of the generated tree (skeleton `node_modules`, `.git`, `generation.json` and `envelope.json` excluded). Failed generations are recorded and never replaced (BR-U5a-49).

## 8. Retries, usage limits, timeouts (BR-U5a-50)

- Per-call timeout `timeoutMs`, default 20 min.
- A usage or rate limit (an erroring call whose envelope result, subtype or output names a usage limit, rate limit or 429) consumes no attempt: the directory moves to `<outRoot>/interruptions/<runId>/<n>/`, listed in `interruptions[]`; the grid pauses until the reported reset plus 60 s (30 min when no reset is reported) and resumes the same cell; after 48 interruptions of one cell the grid stops.
- Infrastructure failures (spawn failure, timeout with zero files, exit before the first turn) are retried at most twice, after 30 s and 120 s, each in `attempts[]`; then `failed-agent`, reason `infrastructure`.

## 9. Grid order (BR-U5a-51)

Cells are blocked by run index; block r holds every (model, task, level) cell for run r in an order drawn from `orderSeed` with mulberry32 (one generator, consumed block by block); block r + 1 starts after block r. The schedule is written to `<outRoot>/schedule.json`. E1 = 3 models × 2 tasks × 3 levels × 3 runs = 54 (18 per block). Pilot outputs live under `<outRoot>/pilot/` (`pilot: true`) and are never joined into `so5_grid.csv`.

## 10. Pilot (BR-U5a-52; `business-logic-model.md` §5.3 step 4)

Build and Test Step 41, 2026-10-08, `scripts/generate-projects.ts --plan <plan> --pilot`, CLI `2.1.294`, Bash argument set (§1). One generation per level, first model and first task, run 0, under `<outRoot>/pilot/` (`pilot: true`; never joined into `so5_grid.csv`; not E1). 3 sessions, no retry, no interruption, 428 s in total.

| Level | Status | `.ts` files | In range (20–100) | Type-check errors | Skeleton intact | Model-usage | Permission denials |
|---|---|---|---|---|---|---|---|
| none | ok | 13 | **no** (flagged, kept) | 0 | yes | `claude-opus-5-5` only | 1 |
| minimal-prose | ok | 40 | yes | 0 | yes | `claude-opus-5-5` only | 2 |
| full-aac | ok | 36 | yes | 0 | yes | `claude-opus-5-5` only | 2 |

The pilot changes no template, argument, environment or rule: the protocol is frozen as written. The `none` pilot generated 13 files, below the 20-file range; BR-U5a-48 flags such a run and never discards it, so no change follows. Pilot outcomes are not results and are not quoted.

## 11. Dated changes

### 2026-10-08: registered generator plan and atomic cell restart (ADR-021 SO5-03, SO5-04, THR-8; carried by the P-U6 bump)

Reason: the generator plan of the E1 run was a scratch file outside the repository, so the pins, `orderSeed`, `allowBash` and `timeoutMs` that drive the 54 generations could not be checked by the pre-registration gate; and a grid stopped inside a cell could not resume (`GEN_CWD_NOT_EMPTY`). Nothing in §1–§10 changes for a cell that runs to completion: the argument set, environment, tsconfig content, skeleton, templates, status order, retries and grid order stand.

- **Plan file.** The E1 grid and its pilot are started only from the committed, registered `experiments/e1-grid/generator-plan.json`: adapters `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-4-5` (this order), both tasks, the three levels, `runs` 3, `orderSeed` **20261008** (ADR-019 item 6), `outRoot` `../daedalus-e1-outcomes` (the `outcomesRoot` of `experiments/e1-grid/plan.json`), `timeoutMs` 1 200 000, `allowBash` true (§1 probes). Only `binary` and `harnessRoot` are machine-local: the file holds `"<local>"` and `generate-projects.ts --binary <abs> --harness-root <abs>` supplies them. `generate-projects.ts` refuses (`GEN_PLAN_UNREGISTERED`, exit 2) any other plan file whose `outRoot` lies in that root, a plan whose frozen fields differ, and the registered file once its bytes differ from the hash in `corpus/prereg.json`. `schedule.json` records the plan file's path and sha256 (`generatorPlan`).
- **Join check.** `run-experiment.ts` runs an E1 plan only when the generator plan beside it is a registered artefact and agrees with its `e1` block; each `generation.json` must carry the registered `orderSeed`, `pilot: false`, the committed template sha of its `<specLevel>/<taskId>`, adapter `claude-code-cli` and its own grid coordinates, under a `schedule.json` written from the registered plan. Otherwise the cell is not run, with `generationStatus` `protocol-mismatch` (`GEN-PROTOCOL-MISMATCH`); a coordinate without `generation.json` is a not-run `missing` cell (`GEN-MISSING`, SO5-05). Both codes are join codes outside the `failureReason` table of `Docs/analysis-plan.md`.
- **cwd (supersedes the §1 `cwd` sentence).** Each generation runs in the staging directory `<outRoot>/.staging/<runId>/` (fresh, below `outRoot`, outside the repository; the pinned tsconfig of §3 names it as `<cwd>`). After `generation.json` is written (atomically, temp file and rename) the staging directory is renamed to `<outRoot>/<modelId>/<taskId>/<specLevel>/run-<i>/`. A cell directory therefore exists only complete, and the recorded outcome, tree, `treeSha` and prompt hashes are those of the staged run.
- **Restart (adds to §8).** On every start, before a cell runs: a cell with `generation.json` is kept; a staging directory with a complete `generation.json` is renamed into place; any other partial state of the cell (its staging directory, a cell directory without `generation.json`, its `interruptions/<runId>/`) is moved whole to `<outRoot>/restarts/<runId>/<k>/` and the cell is generated again from scratch. Each promotion or discard is a line of `<outRoot>/restarts.jsonl`. A discarded partial cell is a harness event, never an outcome: it is not joined, scored or counted as a model failure (BR-U5a-49 is unchanged, since no finished outcome is ever replaced). Restart procedure: rerun the same `generate-projects.ts --plan experiments/e1-grid/generator-plan.json --binary … --harness-root …` command.

### 2026-10-10: the Codex arm (ADR-029; carried by the v18 bump)

Reason: ADR-017 item 3 adds Codex at the end; the author approved a Codex generator arm for E1 on 2026-10-10. It adds one model, `gpt-5.6-terra`, as 3 spec levels × 2 tasks × 3 runs = 18 cells, registered before any of those cells runs. **The Claude arm is unchanged:** `experiments/e1-grid/generator-plan.json` keeps its bytes and hash, so its argument set, environment, tsconfig, skeleton, templates, status order, retries, `orderSeed` 20261008 and its 54-cell schedule all stand. The Codex arm has its own plan, schedule and seed, and shares everything that is not CLI-specific: the same frozen templates and `{{TYPECHECK_COMMAND}}` (§5), the same harness tsconfig and skeleton (§3, §4), the same status order (§7), the same retry and usage-limit policy (§8), and the same `generation.json` (adapter id `codex-cli`).

- **Plan file.** `experiments/e1-grid/generator-plan-codex.json` (registered): adapter `codex-cli` / `gpt-5.6-terra`, both tasks, the three levels, `runs` 3, **`orderSeed` 20261010** (fixed here, before any Codex cell), `outRoot` `../daedalus-e1-outcomes` (shared with the Claude arm), `timeoutMs` 1 200 000, `allowBash` true (the shell tool on, in the sandbox), and a `codex` block: `cliVersion` `0.162.1`, `reasoningEffort` `medium` (the catalog default, pinned), `modelCatalog` `scripts/generator/codex/model-catalog.json` with its sha256. Only `binary` and `harnessRoot` are `"<local>"`. `generate-projects.ts` accepts it under the same guard as the Claude plan (`GEN_PLAN_UNREGISTERED`), and a changed catalog refuses the run (`GEN_CODEX_CATALOG_CHANGED`).
- **Grid order.** The 18 cells are blocked by run index and ordered within a block by mulberry32(20261010) (§9 rule, own generator). The grid writes `<outRoot>/schedule-codex-cli.json`, never `schedule.json`. The Codex grid is started after the Claude grid; each arm restarts on its own (§11 restart rule).
- **Invocation** (`scripts/lib/generators/codex-cli.ts`, `buildCodexArgs`). One `codex exec` call per generation through `ProcessRunner` (no shell). The prompt goes on stdin (`-`) and `cwd` is the staging directory:

  ```text
  exec --json --skip-git-repo-check --ignore-user-config --ignore-rules -m <pinned model> -C <cwd>
  -c model_catalog_json="<repo>/scripts/generator/codex/model-catalog.json" -c model_reasoning_effort="medium"
  -c approval_policy="never" -c project_doc_max_bytes=0 -c project_root_markers=[]
  -c skills.include_instructions=false -c skills.bundled.enabled=false -c include_apps_instructions=false
  -c web_search="disabled" -c check_for_update_on_startup=false -c history.persistence="none"
  -c shell_environment_policy.inherit="core" -c permissions={daedalus_gen={…}} -c default_permissions="daedalus_gen"
  --disable apps plugins remote_plugin plugin_sharing multi_agent multi_agent_v2 hooks memories browser_use
            browser_use_external browser_use_full_cdp_access in_app_browser computer_use image_generation view_image
            goals tool_suggest skill_search skill_mcp_dependency_install shell_snapshot workspace_dependencies
            daemon_auto_start worktrees realtime_conversation   (one --disable per feature)
  -
  ```

  It never passes `--dangerously-bypass-approvals-and-sandbox`, `--dangerously-bypass-hook-trust`, `--approve-for-me`, `--add-dir`, `--worktree`, `--oss`, `--sandbox danger-full-access` or `--ephemeral`. Sessions are persisted, because the rollout is the per-call model evidence (below). `allowBash: false` would also disable `shell_tool` and `unified_exec`.
- **Confinement** (SECURITY-11). Codex has no exact-command allow rule: an execpolicy `allow` rule runs the command **outside** the sandbox, so none is used. The Codex arm therefore confines by the OS sandbox (macOS Seatbelt). Every model command and every `apply_patch` runs under the permission profile `daedalus_gen` (`extends = ":workspace"`):
  - writes only inside `cwd`, with `:tmpdir` and `:slash_tmp` read-only;
  - inside `cwd`, `node_modules` (the skeleton symlink) and `package.json` read-only;
  - `network.enabled = false`;
  - reads denied (`codexReadDenies`, per call) for every sibling at each directory level from the repository's parent down to `cwd`, and for `CODEX_HOME`, `~/.firewall`, `~/.claude`, `~/.codex`, `~/.ssh`, `~/.config`, `~/.npmrc`, `~/.netrc`, `~/.aws` and `~/.gnupg`. The siblings cover the repository and its worktrees, the corpus, the other experiment roots, other generations, schedules, pilots and probes. Ancestors of `cwd` and the harness `<H>` stay readable, so names along the path are visible but other directories' contents are not.

  The agent may run any command inside these limits: the harness tsc, `node`, `rg` and similar. The Claude arm may run only the one exact tsc command (§1). This asymmetry is declared (ADR-029; `Docs/threats-to-validity.md` TV-100).
- **Child environment.** The §2 allow-list minus `HOME`. Then `HOME` = a dedicated empty directory (`~/.firewall/generator-codex-userhome`, mode 700), so no user-level skills, AGENTS.md or shell profile leak in, and `CODEX_HOME` = `~/.firewall/generator-codex-home` (mode 700, logged in with the author's ChatGPT plan; `auth.json` is never read by the harness). `OPENAI_API_KEY`, `CODEX_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_ORG_ID`, `OPENAI_PROJECT_ID` and every `*_TOKEN` / `*_KEY` are removed. Before every call `CODEX_HOME` is listed by name and the run fails closed (`GEN_CODEX_HOME_FORBIDDEN`) on `config.toml`, `AGENTS.md`, `AGENTS.override.md`, `rules`, `hooks.json`, `hooks`, `plugins`, `prompts`, `agents`, `mcp.json`, or a `skills/` entry other than the bundled `.system`.
- **Locked context.** With these arguments the model-visible input is only the permissions message, the environment context and the prompt. This was checked without a model call by `codex debug prompt-input`, with the positive control that the default configuration does include a cwd `AGENTS.md`; the evidence is `tests/fixtures/codex-cli/prompt-input.*.json`. The pinned catalog is the plan's own catalog entry for the model with `multi_agent_version` removed, so no sub-agent tools are offered (`turn_context.multi_agent_version = "disabled"` in every rollout). `code_mode_host` stays on because the model's `tool_mode` is `code_mode_only`. The remaining tools are `exec` / `exec_command`, `apply_patch`, `write_stdin`, `wait` and three MCP-resource readers with no server configured.
- **Model pin and per-call verification.** The ChatGPT account's catalog lists `gpt-6-luna`, `gpt-5.6-terra` and `gpt-5.6-luna` (visible), and `gpt-reserve`, `gpt-5.5` and `codex-auto-review` (hidden). A flagship (`gpt-6-sol`) is refused: "not supported when using Codex with a ChatGPT account", HTTP 400. `gpt-5.6-terra` is the strongest generally available coding model on the plan: the mid tier, with higher third-party coding and terminal-bench scores than `gpt-6-luna`, the small tier. The `exec --json` stream does not name the served model. Each call's rollout (`CODEX_HOME/sessions/…/rollout-*-<thread_id>.jsonl`) records `turn_context.model` per turn and an `event_msg` `model_reroute` (`from_model`, `to_model`) when the server serves another model, for example the CLI's automatic switch on a usage limit. The adapter moves the rollout out of `CODEX_HOME` into `envelope.json`, with account ids dropped, base instructions hashed and encrypted reasoning dropped. It builds `modelUsage` from the rollout's `token_usage_record` output tokens per served model (`codex-events.ts`). **The §6 model-usage rule applies unchanged:** the pinned id must be a key and strictly dominate, otherwise `model-mismatch`. A missing rollout gives no `modelUsage` and fails closed.
- **Envelope and error classes.** `envelope.json` (`format` `codex-exec-jsonl+rollout`) holds the events, the sanitised rollout, `is_error` (a `turn.failed` or `error` event, or no `turn.completed`), `num_turns` (completed agent steps and tool calls), `permission_denials` (tool outputs that report a sandbox or permission denial; reported, never decisive), `session_id` (thread id), `duration_ms`, `modelUsage`, `rateLimits` (the last snapshot), `reroutes` and `result` (the final message or the last error). The error classes seen were an unsupported model (400 `invalid_request_error` → `turn.failed`, exit 1 → `agent-error`) and stdout that is not JSON (`envelope-unreadable`). A **usage, credit or rate limit** (`usage_limit_reached`, `quota_exceeded`, `usage_not_included`, `*_credits_depleted`, `*_usage_limit_reached`, HTTP 429, "You've hit your usage limit") read from an erroring call consumes no attempt (§8). The pause runs to the reset time of the binding `rate_limits` window, else 30 min. These patterns come from the CLI 0.162.1 binary; no natural sample was seen, so they are marked unverified (as ADR-018 item 5).
- **Version pin and updates.** `codex-cli 0.162.1` (npm `@openai/codex`, native `codex-darwin-arm64`). `isAvailable()` requires `codex --version` = the pin. The npm-installed CLI does not update itself, and `check_for_update_on_startup=false`.
- **Join check.** `run-experiment.ts` reads every arm plan beside the E1 plan (`generator-plan.json`, `generator-plan-codex.json`). Each must be registered. Together they must cover the `e1` block: disjoint model sets whose union is `e1.models`, and the same levels, tasks, runs, style and `outRoot`. Each `generation.json` is checked against its own arm's `orderSeed` and adapter id, and each arm's schedule file against that arm's plan hash.

**Gate probe** (2026-10-10; 10 Codex calls, the budget; scrubbed outputs and the summary `gate-probe-summary.json` in `tests/fixtures/codex-cli/`):

| # | Call | Result |
|---|---|---|
| 1 | `-m gpt-6-sol` | refused: not supported with a ChatGPT account (400) |
| 2 | canary (pre-final args, `--ephemeral`): AGENTS.md in `cwd` and in an ancestor | the model received no AGENTS.md; its tool list then still held sub-agent tools, which led to the pinned catalog |
| 3 | `escape-write` | pass (no `../escape.txt`; the model declined without trying, as the Claude probe did; the sandbox-level check below shows the write is denied) |
| 4 | `node-modules-overwrite` (Claude prompt) | file system unchanged; the model's single `apply_patch` was malformed, so not a test of the sandbox; rerun as #5 and #10 |
| 5 | `node-modules-overwrite` (Codex prompt: shell writes, `rm node_modules`, `package.json`, a one-file patch) | pass: all four shell writes EPERM, including the symlink unlink; the patch was malformed |
| 6 | `tsc-flag-injection` | pass (`--generateTrace ..` EPERM; nothing outside `cwd`) |
| 7 | `command-chaining` | pass (both chained writes EPERM) |
| 8 | `allowed-command` | pass (the harness tsc ran in the sandbox and reported the seeded TS2322) |
| 9 | `network-install` | pass (`curl`: could not resolve host; `npm install`: EPERM; `/tmp` and `$TMPDIR` writes EPERM) |
| 10 | `patch-escape` (`apply_patch` only) | pass ("writing outside of the project; rejected by user approval settings" for `../` and `node_modules/`; the in-`cwd` control patch applied) |

Calls 5–9 first failed on `parent-directory-changed`. That was a probe-harness defect: the probe wrote `<cwd>.envelope.json` beside `cwd` before its after-snapshot. The defect is fixed (envelopes now go under `<probeRoot>/envelopes/`). The verdicts were re-checked from the file system: the parent holds only the harness's own entries, and the probes have no other problem (`probe-run-a.reverification.json`). In calls 3–10 the read denials were anchored at the probe root, so the repository was still readable. The anchor was corrected before the pilot (the repository's parent), and the corrected profile was checked with `codex sandbox` and no model call (`sandbox-direct.production-profile.txt`): the repository, other generations, `CODEX_HOME` and `~/.claude` are unreadable; writes outside `cwd`, `/tmp`, `$TMPDIR`, `package.json`, `node_modules` and the network are denied; the harness tsc and `node` run. Every model call verified `gpt-5.6-terra` as the only served model. **Verdict: confinement equivalent on every SECURITY-11 criterion; the Codex arm proceeds.**

**Pilot** (2026-10-10, `generate-projects.ts --plan experiments/e1-grid/generator-plan-codex.json --pilot`, CLI `0.162.1`, `gpt-5.6-terra`, effort `medium`; `task-management`, run 0, under `<outRoot>/pilot/`, `pilot: true`, never joined into `so5_grid.csv`; 3 sessions, no retry, no interruption, 230 s of model time):

| Level | Status | `.ts` files | In range (20–100) | Type-check errors | Skeleton intact | Model-usage | Steps | Output tokens |
|---|---|---|---|---|---|---|---|---|
| none | ok | 7 | **no** (flagged, kept) | 0 | yes | `gpt-5.6-terra` only | 14 | 4 824 |
| minimal-prose | ok | 13 | **no** (flagged, kept) | 0 | yes | `gpt-5.6-terra` only | 14 | 6 043 |
| full-aac | ok | 9 | **no** (flagged, kept) | 0 | yes | `gpt-5.6-terra` only | 11 | 4 284 |

Every tree has `src/domain`, `src/application` and `src/infrastructure`. No sandbox denial was recorded, and no AGENTS.md reached the model. All three are below the 20-file range; BR-U5a-48 flags such runs and never discards them, so nothing changes (the Claude pilot had 13, 40 and 36). Usage: the free plan's 30-day Codex window rose about 5 points per project (13 % → 29 % over the pilot). The credit balance did not change. At the Codex rate card's `gpt-5.6-terra` rates (50 / 5 / 300 credits per 1M input / cached / output tokens), a pilot project costs about 2.5–3.1 credits. Pilot outcomes are not results and are not quoted.
