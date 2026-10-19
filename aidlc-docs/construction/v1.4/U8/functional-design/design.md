# U8 functional design: EFF-01 efficiency harness (driver and scorer)

**Cycle:** AI-DLC v1.4, instrument alignment. **Depth:** minimal (no NFR, infrastructure or user-story stages).
**Map part:** C1c query, efficiency (plane P1). **Board decision:** M5 (`ops/decisions.md`). **Build list:** `ops/03-build-list.md`, item 5 and the U8 line.
**Status:** design for review, revised after an adversarial review (2026-10-18). No code has been written. No model or API call was made, no session was run, and Neo4j was not started.

**Review revisions (2026-10-18).** Checked against the code: the tar export no longer pipes binary data through the string-capturing `ProcessRunner` (DR-15); the call log is per session, because `mcp-call/v1` lines carry no session id (DR-11); lanes are dealt per condition, because alternate dealing does not guarantee the per-condition balance T-PLAN asserted (DR-4); the live/dry split of `--block all` resolves the conflict between the pilot-gate exit and the 150-record dry run (DR-25); new rules for personal-path redaction in the public run dir (DR-27a), the spawn budget for re-runs (DR-24a), R reads outside the tree (DR-23), injected sleepers (DR-21), the anchored `architecture:` match (DR-7), truncated output and the model check without an envelope (DR-22), robust path stripping (SC-8), and rescoring after a key correction (SC-11). Author question 8 is new.

**Inputs read:** `ops/notes/eff-01-efficiency-design.md` (the EFF-01 note; § numbers below refer to it unless marked), `experiments/eff-01/{questions.json,answers.json,repos.json,derive-answers.mjs}`, `src/mcp-server/{server.ts,main.ts,call-log.ts,evaluate-project.ts}`, the headless-model harness in `scripts/lib/generators/{argv,arms,envelope,model-usage,retry,outcome,env,types}.ts`, `scripts/lib/loop/{agents,isolation}.ts`, `scripts/v1.3/lib/mcp-smoke.ts` with `scripts/v1.3/mcp-smoke.ts` and its test, `scripts/lib/stats.ts`, `experiments/loop-pilot/plan.json`, and one recorded envelope from `experiments/v1.3-floor-probe-3/` (to confirm the usage field names).

---

## 1. What the unit delivers

1. **A driver,** `scripts/v1.3/eff-01-run.ts`. It plans every EFF-01 session (calibration, pilot, main, N), builds each session's argv, prompt, cwd and MCP config, runs the sessions through a `ProcessRunner` with the existing retry policy, and writes one record per session. **Dry run is the default.** A live run needs `--live` and a session count the author has approved (§2.8).
2. **A scorer,** `scripts/v1.3/eff-01-score.ts`. It reads the session records, parses each `ANSWER:` line, scores it against `experiments/eff-01/answers.json` with the rubric of `questions.json`, applies the caps, and writes per-session scores and the per-item table (acc_qc, tok_qc) that the §8 analysis needs.
3. **A stub runner** for zero-call dry runs. It answers `--version` and emits stream-json transcripts with scripted behaviours: answers the key, answers wrong, no `ANSWER:` line, hits the turn cap, times out, leaks a tool, or reports a usage limit.
4. **Tests** that pin the scorer to the key (all 20 key answers score 1.0, perturbed answers score below 1), the argv to the §11 calls, and the driver's plan to the §7 call counts.

**The turn cap: the supported way.** `--max-turns` is missing from `claude --help` because the option is registered hidden, not because it is unsupported. The 2.1.301 binary's option table defines `--max-turns <turns>` ("Maximum number of agentic turns in non-interactive mode … only works with --print") with `hideHelp()`, and the CLI's result handling has a subtype `error_max_turns` ("Reached max turns"). This was found with a string search of the installed binary: no session and no model call. So the driver passes **`--max-turns 30`** in every condition. The after-the-fact rule of §5 (`num_turns` > 30 is a cap hit) stays as a backstop (TC-3). The driver's version probe refuses any CLI other than 2.1.301, so the evidence holds for the run. The pilot's first session confirms that the flag is accepted, with no unknown-option error and a normal result envelope.

**Out of scope.**
- **The §8 inferential analysis:** the exact Wilcoxon signed-rank tests, Holm, the bootstrap CIs, H1–H5, the forest plot. `scripts/lib/stats.ts` has `holm`, `createRng` and a cluster bootstrap but no Wilcoxon. The scorer writes the item table that analysis reads (§3.6), so the analysis can be a small follow-on (author question 5).
- Running any session, cloning the repos, or freezing the question set.
- Editing the shared harness modules. U8 only adds new files; it changes no existing source file (`buildArmCall`, `turnStatus`, `attemptDisposition` and `extractModelUsage` are reused or wrapped, never edited; §5).

---

## 2. Business rules (driver)

Rule ids are cited in the plan and the tests.

### 2.1 Sessions and cells

- **DR-1. Cell.** A cell is (block, repo, question or none, condition). Blocks: `calibration`, `pilot`, `main`, `n`. Conditions: `R`, `G`, `N`. A session is a cell × run index k. Its id is `<block>/<repoId>/<questionId|calib>/<condition>/run-<k>`, POSIX, and it is also its record path.
- **DR-2. The blocks, exactly as §7.**
  - `calibration`: R and G, prompt `Reply OK`, no frame and no question, 1 run, one repo (default `ddd-forum`; author question 4). **2 sessions.**
  - `pilot`: questions Q02 and Q06 × 2 repos × {R, G} × 1 run. **8 sessions.** Not analysed.
  - `main`: 20 questions × {R, G} × `runs` (default 3). **120 sessions.**
  - `n`: 20 questions × N × 1 run. **20 sessions.**
  - Total **150**. The variants: `--runs 2 --no-n` gives 90 and `--runs 1 --no-n` gives 50 (calibration and pilot are always included).
- **DR-3. Order.** The unit of the shuffle is the **session** (cell × run), not the cell, so the 3 runs of one cell do not run back to back. Main sessions are shuffled with `shuffle(…, createRng(EFF01_SEED))` (`scripts/lib/stats.ts`), so the conditions interleave. Calibration runs first, then the pilot, then main, then N. The N block is shuffled with its own generator, `createRng(EFF01_SEED + 1)`. The ordered session list (ids, block, lane, order index) goes into `plan.json` before the first session. A later invocation re-plans and must reproduce that list byte for byte, or it refuses to run. Facts that differ per invocation (CLI version, commit, start time) go to `<run dir>/invocations.jsonl`, never into `plan.json`.
- **DR-4. Lanes.** At most 2 lanes (the machine rule). Lanes are dealt **per condition**: after the shuffle, the i-th session of a condition (in shuffled order) goes to lane `i mod 2`. Each lane then holds a balanced half overall *and* per condition (both within 1). Plain alternate dealing of the shuffled list does not guarantee the per-condition balance, so it is not used. The lanes run in one process with a concurrency of `--lanes` (1 or 2, default 1). The pilot and the calibration always run on lane 0, in order, because their results gate the main run (§9.5, §9.6).
- **DR-5. Resume.** A session whose `record.json` exists with a final status is skipped. An archived interruption (§2.6) does not count as final. Re-running the driver over a partial run directory finishes it without repeating a scored session.

### 2.2 The prompt

- **DR-6. Frame.** Every question session uses the §5 frame, byte for byte. Its parts are the condition sentence (§5 table), the repo's `architecture:` block, the four `conventions` of `questions.json` (one per line, in order), the question `text`, and the `answerFormat` as compact JSON (`JSON.stringify`, key order as in the file).
- **DR-7. The architecture block** is cut verbatim from `results/v1.3-external/specs/<repoId>.yaml`: from the line matching `^architecture:\s*$` up to, but not including, the next line that starts a top-level key (`^[A-Za-z_][A-Za-z0-9_]*:`). Trailing blank lines are dropped. The driver refuses a spec with zero or more than one line matching `^architecture:\s*$`. The match is anchored on purpose: line 2 of both committed specs is a comment that contains the text `` `architecture:` block ``, so a substring count would find two.
  - **The block keeps its YAML comments** (the note says "verbatim"). Those comments are the spec author's rationale, and two of them name rule ids (`FF-DS02`, `FF-DT03` in event-sourcing-ddd) and one describes the `repos/implementations/**` folder (ddd-forum). All conditions, N included, see the same text, so it does not bias R against G, but it is a hint the note's "no rule ids in the wording" rule did not cover. The record keeps the block's SHA-256, and the choice is author question 8.
- **DR-8. Hashes.** The record carries the SHA-256 of the frame template (with placeholders), of the full prompt, of `questions.json`, `answers.json` and `repos.json`, and of the spec file. The argv in the record has the prompt replaced by `<prompt>` (`redactPrompt`).

### 2.3 The conditions

- **DR-9. The argv,** for model `M` (default `claude-sonnet-5-5`), in this order:
  - common head: `-p <P> --model M --output-format stream-json --verbose --safe-mode --restricted --max-turns 30`;
  - **R:** `--tools Read,Grep,Glob --permission-prompts none --no-session-persistence --strict-mcp-config`;
  - **G:** `--tools "" --strict-mcp-config --mcp-config <H>/mcp/<sessionKey>.json --allowedTools <the 11 rules> --permission-prompts none --no-session-persistence`. The 11 rules are `mcpToolRules('daedalus-arch', TOOL_NAMES)`, in `TOOL_NAMES` order, by exact name, as 11 separate argv elements. The config path is **per session**, not the note's per-repo `<H>/eff-01/mcp-<id>.json`, because the call log inside it must be per session (DR-11). That path is the only element where the argv differs from the §11 call;
  - **N:** `--tools "" --permission-prompts none --no-session-persistence --strict-mcp-config`.
  - Every argv passes `checkArmArgs(args, server)`, with `server` = `daedalus-arch` for G and `null` for R and N. None contains `--bare`, `--add-dir`, `--dangerously-skip-permissions`, `--max-budget-usd`, `--permission-mode`, `Write` or `Edit`.
- **DR-10. Why not `buildArmCall`.** It hard-codes `--engine neo4j`, the 9-tool Study 2 allow-list with `evaluate_project` denied, Write and Edit, and `acceptEdits` (§11). The driver builds its own argv from `mcpToolRules` and the argv constants, and validates it with `checkArmArgs`.
- **DR-11. G's MCP config** names one stdio server, `daedalus-arch`: `command` = the absolute node binary, `args` = `[<abs dist/mcp-server/main.js>, --spec <abs spec>, --project <abs tree>, --engine cypher-interp, --call-log <H>/calls/<sessionKey>.jsonl]`, `env` = `{}`. No `--neural` and no `--rule-mining`. The file is written with mode 0600 at `<H>/mcp/<sessionKey>.json`. The spec path is the committed `results/v1.3-external/specs/<repoId>.yaml`, absolute.
  - **Why the call log is per session.** A `mcp-call/v1` line carries `ts` and a per-process `seq`, but no session id (`src/mcp-server/call-log.ts`). With a per-repo log and 2 lanes, two G sessions on the same repo would append to one file, and their lines could not be told apart. One log file per session removes that, and the driver refuses to start a G session whose call-log file already exists.
- **DR-12. cwd.** R: the repo tree (§2.4). G and N: a fresh empty directory per session, `<H>/empty/<sessionKey>`. A G or N cwd that is not empty at spawn time is an error.
- **DR-13. Environment.** Every spawn uses `isolatedClaudeEnv(parent, home, { configDir })` (`scripts/lib/loop/isolation.ts`): the E1 allow-listed environment, a per-session empty `HOME` at `<H>/homes/<sessionKey>`, and `CLAUDE_CONFIG_DIR` set to the author's clean judge config directory, passed as `--config-dir <abs>`. `checkIsolationPaths` runs once at start (the directory is absolute and lies outside the repository, `<H>/trees`, the run dir and the real `~/.claude`), and `checkIsolationBeforeSpawn` runs before each spawn. The driver's own code only passes that directory's path. The existing ADR-018 check inside `checkIsolationBeforeSpawn` (`checkConfigListing`) lists entry names and validates `settings.json` if one is present; U8 adds no other access to the directory. In a dry run the config directory is a fresh empty directory `<H>/dry-config` (an empty directory passes the listing check), and `--config-dir` is refused, so a dry run never touches the author's config directory.

### 2.4 The repo trees

- **DR-14.** The driver does not clone (that needs the network). It takes `--clones <abs dir>`, expects `<dir>/<repoId>` for each repo in `repos.json`, and checks `git -C <clone> rev-parse HEAD` against the pin. Any other HEAD is an error.
- **DR-15. The tree.** The session tree is `<H>/trees/<repoId>`: the tracked files at the pin, so it has no `.git`, no `node_modules` and no untracked files. R reads it as its cwd, and G's server uses it as `--project`, so both conditions see the same files. Its fingerprint (SHA-256 over the sorted `path\0sha256(content)` lines, dotfiles included) goes into `plan.json`.
  - **The export is two runner calls, never a pipe:** `git -C <clone> archive --format=tar -o <H>/trees/<repoId>.tar <sha>`, then `tar -xf <H>/trees/<repoId>.tar -C <H>/trees/<repoId>`. The `ProcessRunner` has no shell, and `NodeProcessRunner` returns stdout as a string capped at `maxOutputBytes`, so a tar stream on stdout would be decoded and corrupted. The tar file goes to disk and is deleted after the extraction.
  - **The engine check is repeated on the tree.** The note's 23/23 and 102/102 check ran on the clones. The local check of §6 runs `evaluate_project` on each tree (in process, `--engine cypher-interp`) and must give 23 and 102 again before a live run; a different count means the tree is not the project the key was derived on.
- **DR-16. Read-only check.** The tree's fingerprint is taken again after each R and G session. A changed tree makes the session invalid (`tree-changed`) and stops the run, because every later session would see a different project.

### 2.5 Caps

- **DR-17. Wall time.** `timeoutMs` = 600,000 per session on the runner. A runner timeout is a **final** outcome (`cap-wall`), never an infrastructure retry. That overrides `attemptDisposition`, which treats a timeout with no files written as infrastructure. Every EFF-01 session writes no files, so without the override every timeout would be retried.
- **DR-18. Turns.** `--max-turns 30` (§1). A result subtype of `error_max_turns`, or `num_turns` > 30, is `cap-turns`.
- **DR-19. Tokens.** A session with processed tokens (§3.3) above 400,000 is `cap-tokens`. The check is applied after the fact, as §5 says. There is no supported token cap flag, and `--max-budget-usd` is not used.
- **DR-20.** A cap hit is a valid, scored session with score 0 and its real tokens (§3.4). When the process was killed and there is no result envelope, tokens are summed from the per-message `usage` of the assistant events in the partial transcript, and the record sets `tokensSource: "transcript-partial"`.

### 2.6 Status and retries

- **DR-21. Attempt disposition.** The driver wraps `attemptDisposition` (it does not edit it). The wrapper `eff01Disposition(cli, envelope)` checks, in order: a spawn failure is `infrastructure`; a usage or rate limit is `usage-limit` (`detectUsageLimit`, which keeps its precedence over the timeout, as in `attemptDisposition`); a timeout is `final` (`cap-wall`, DR-17); otherwise it returns `attemptDisposition(cli, envelope, 0)`, which makes an exit before the first turn `infrastructure` and everything else `final`. `runWithRetries` with `DEFAULT_RETRY_POLICY` applies (§9.8). An interrupted attempt's record directory is moved to `<session>/interrupted-<i>/` and is never scored.
  - **The clock and the sleeper are injected.** `runSession` takes `clock` and `sleep` in its deps and passes them to `runWithRetries`. The default policy waits 30 s and 120 s before infrastructure retries and 30 min on a usage limit with no reset time, so every test passes a zero-wait sleeper and a fake clock. A test that uses `realSleep` is a defect.
- **DR-22. Session status,** in this order (the first match wins):
  1. `infrastructure`: retries exhausted;
  2. `envelope-unreadable`: no result event and no timeout, or the runner reports `truncated: true` (reason `output-truncated`; the cap is `maxOutputBytes` = 64 MiB);
  3. `model-mismatch`: `judgeModelUsage(M, summary)` is invalid (§9.9). When there is no result envelope (a timeout), the check reads the `model` of the init event and of the assistant messages instead, and the record sets `modelSource: "transcript"`. In the **calibration** block only, `pinned-not-dominant` is recorded but does not invalidate the session: a "Reply OK" session has a handful of output tokens, so a small auxiliary model could out-produce it without the pinned model being absent;
  4. `confinement-leak` (DR-23);
  5. `tree-changed` (DR-16);
  6. `cap-wall`, `cap-turns`, `cap-tokens` (DR-17 to DR-19);
  7. `completed`.
  - A session with status 1 to 5 is **invalid**. It is not scored and is re-run once (DR-24).
  - Statuses 6 and 7 are **valid** and scored. An `is_error` result that is not `error_max_turns` is `completed` with an `agentError` flag, so it scores 0 through its missing `ANSWER:` line.
- **DR-23. Confinement,** read from the transcript (§9.5):
  - **R:** any `tool_use` whose name starts with `mcp__`, or a built-in tool outside {Read, Grep, Glob}, is a leak. So is a Read, Grep or Glob whose `file_path` or `path` input resolves (against the tree as cwd) outside `<H>/trees/<repoId>` (reason `read-outside-tree`): Read takes absolute paths, and a read of the DaedalusArch checkout (for example `experiments/eff-01/answers.json` or `results/v1.3-external/findings/`) would hand R the key. The envelope's `permission_denials` are kept in the record for audit.
  - **G:** any `tool_use` of a built-in tool, or of an `mcp__` tool of a server other than `daedalus-arch`, is a leak. The `system`/`init` event must list `daedalus-arch` among `mcp_servers` with status `connected`. If it does not, the session is `confinement-leak` with reason `mcp-not-connected`. This is how the run tests whether `--safe-mode` loads an explicit `--mcp-config` (§11). That cannot be checked without a session, so the pilot's first G session settles it.
  - **N:** any `tool_use` at all is a leak.
  - When the init event carries a `tools` list, it must match the condition: R's built-ins are exactly {Read, Grep, Glob}; G has no built-ins and lists the 11 `mcp__daedalus-arch__*` tools; N has none.
- **DR-24. Re-runs.** An invalid session is re-run once, as run index k with suffix `-rerun`. If it is invalid a second time with `confinement-leak`, the run stops (§9.5). With any other invalid status, the cell is recorded as missing and the run goes on.
- **DR-24a. The spawn budget.** Re-runs and retries spend model calls beyond the approved session count, so the driver counts them. A *model-reaching attempt* is any attempt with `num_turns` ≥ 1 or with assistant events in its transcript; pre-first-turn infrastructure failures and usage-limit refusals do not count. The driver stops (exit 1) before an attempt that would take the count of the invocation above `--confirm-sessions` + `--rerun-allowance`. The default allowance is `ceil(0.1 × n)` (15 for 150), and it is shown with n in the approval line (author question 1). The count is in `run-log.jsonl` and in the summary.
- **DR-25. Pilot gates,** checked by the driver after the pilot block, before main:
  - any `confinement-leak` stops the run;
  - more than 1 of the 8 pilot sessions with a missing or unparsable `ANSWER:` line stops the run. The frame's answer instruction may then be fixed once, which the author approves (§9.6);
  - the flag check of §1 (no session rejected `--max-turns`).
  - The driver prints the gate result and writes it to `<run dir>/pilot-gate.json`. **Live:** it then exits, whatever the result. The main block needs a second invocation with `--block main` (and `--block n` for N), which refuses to start unless `pilot-gate.json` exists with `pass: true` for the same plan, so the author sees the pilot before the main calls. `--live --block all` is refused (exit 2).
  - **Dry run:** `--block all` runs every block in one invocation and continues past a passing gate, so the zero-call check of §6 (T-DRY) and plan step 11 can produce all 150 records. A failing gate stops a dry run exactly as it stops a live one.

### 2.7 Records

- **DR-26. Per session,** under `<run dir>/sessions/<sessionId>/`:
  - `transcript.jsonl.gz`: the scrubbed stream-json stdout;
  - `envelope.json`: the result event, through `parseEnvelope(stdout, knownSecrets)` and then `scrubDeep`;
  - `calls.jsonl`: G only, the MCP call log (`mcp-call/v1` lines), copied from the harness;
  - `record.json`: the `SessionRecord` (§3.2).
- **DR-27. No billing figures.** The repo is public. `total_cost_usd` and every `modelUsage[*].costUSD` are deleted from the stored envelope and transcript before they are written, and no cost field appears in any record or summary.
- **DR-27a. No personal absolute paths.** The run dir is committed to a public repository, and the argv, the MCP config, R's tool inputs and outputs, and G's call log all carry absolute paths under the author's home or volume. Before any file is written to the run dir, `redactPaths` replaces, longest prefix first, the harness root with `<H>`, the repository root with `<REPO>`, the clones dir with `<CLONES>`, the config dir with `<CONFIG>`, the node binary's directory with `<NODE>`, and the real `HOME` with `<HOME>`, in every string of the transcript, envelope, record, call log, `plan.json` and `run-log.jsonl`. The scorer works on these redacted texts (SC-8). A test asserts that no stored file contains the real harness root, repository root or `HOME`.
- **DR-28. Run files.** `<run dir>/plan.json` (the full ordered session list, the hashes, the tree fingerprints, the model, the caps, the seed; nothing that changes per invocation, DR-3), `<run dir>/invocations.jsonl` (per invocation: the CLI version at start and end, the commit, the blocks, the spawn count) and `<run dir>/run-log.jsonl` (one line per session start and end). The live run dir is `experiments/eff-01/run-<YYYY-MM-DD>/`, following `experiments/loop-pilot/run-2026-10-16/`. The harness root `<H>` (`--harness <abs>`) lies outside the repository, as the loop pilot's does.
  - **A dry run never writes into `experiments/`.** It needs an explicit `--out` and refuses one inside `experiments/`. Its `plan.json` and every record carry `dryRun: true`, and the scorer refuses to write `items.json` for a dry run into `experiments/`, so stub records can never be read as data.
- **DR-29. CLI version.** It is recorded at the start and at the end of each invocation (§9.9). A mismatch with `--cli-version` (default `2.1.301`) at the start refuses the run; a mismatch at the end marks every session of that invocation `cliDrift: true`.

### 2.8 The live guard

- **DR-30.** Dry run is the default, and it uses the stub runner. A live run needs all three of:
  - `--live`;
  - `--confirm-sessions <n>`, where n equals the number of sessions the selected blocks plan;
  - `--questions-sha256 <hex>`, equal to the SHA-256 of `questions.json` (the frozen set, §12.1).
  - If any is missing or differs, the driver exits 2 before it spawns anything, the `--version` probe included: the guard is the first check after flag parsing, and `NodeProcessRunner` is constructed only after it passes. The approval itself is the author's (§12.2). The flags only make sure the count and the set in hand are the ones approved.
  - **Dry run:** only `StubEff01Runner` is constructed. `--claude`, `--config-dir` and `--confirm-sessions` are refused without `--live`, so no code path of a dry run can reach the real CLI.

---

## 3. Business rules (scorer) and data contracts

### 3.1 Answer extraction

- **SC-1.** The answer text is the result event's `result` string. If there is none, it is the text of the last assistant message.
- **SC-2.** The answer line is the **last** line whose trimmed form starts with `ANSWER:`. More than one such line sets `multipleAnswerLines`. No such line gives `parse: "missing"`, score 0.
- **SC-3.** The payload is the text after `ANSWER:`, trimmed, with one pair of surrounding backticks (or a `json` fence) removed. It goes through `JSON.parse`. If that fails, the first balanced `{…}` in the payload is tried, and `parse` is `"extracted"`. If both fail, `parse` is `"unparsable"`, score 0. The rule is the same for every condition (§6).

### 3.2 `SessionRecord` (record.json)

| Field | Type | Meaning |
|---|---|---|
| `schema` | `"eff-01-session/v1"` | |
| `sessionId`, `block`, `repoId`, `questionId` (null for calibration), `condition`, `run`, `rerun` | | DR-1 |
| `lane`, `orderIndex` | number | DR-3, DR-4 |
| `argv` | string[] | prompt redacted |
| `promptSha256`, `frameSha256`, `questionsSha256`, `answersSha256`, `specSha256`, `treeFingerprint` | hex | DR-8, DR-15 |
| `cliVersionStart`, `cliVersionEnd`, `cliDrift` | | DR-29 |
| `model` | `{pinned, verdict}` | `judgeModelUsage` |
| `status` | DR-22 enum | |
| `valid` | boolean | statuses 6 and 7 |
| `exitCode`, `timedOut`, `resultSubtype`, `isError` | | |
| `tokens` | §3.3 | |
| `tokensSource` | `"envelope"` \| `"transcript-partial"` | DR-20 |
| `numTurns`, `durationMs` (CLI), `wallMs` (driver clock) | | §6 |
| `toolCalls` | `{total, byName: Record<string, number>}` | transcript |
| `mcpCallLog` | `{lines, byTool}` \| null | G |
| `confinement` | `{ok, reasons: string[]}` | DR-23 |
| `attempts`, `interruptions` | from `runWithRetries` | |
| `answerText` | string \| null | the raw `ANSWER:` line, for audit (redacted, DR-27a) |
| `dryRun` | boolean | DR-28 |
| `modelSource` | `"envelope"` \| `"transcript"` | DR-22 row 3 |
| `truncated` | boolean | DR-22 row 2 |
| `permissionDenials` | number | from the envelope, for audit (DR-23) |
| `modelReachingAttempts` | number | DR-24a |

### 3.3 Tokens

- **SC-4. Processed tokens (primary)** = Σ over `modelUsage[*]` of `inputTokens + cacheCreationInputTokens + cacheReadInputTokens + outputTokens`. These are the camelCase names, confirmed on a committed envelope of `experiments/v1.3-floor-probe-3/`.
- **SC-5.** The record keeps the per-model split and three secondary measures: `uncached` (input + cache creation + output), `output`, and the `usage` block's total (snake_case `input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`, `output_tokens`).
- **SC-6.** If the `usage` total differs from the `modelUsage` total, `usageMismatch: true` is set. The primary stays `modelUsage`, as §6 says, and the scorer reports the count of mismatches.
- The existing `extractModelUsage` keeps only output tokens, so U8 reads the four fields itself from the scrubbed envelope, in its own module.

### 3.4 Scoring

- **SC-7. Key normalisation.** `answers.json` stores some answers in a bare form, so the scorer wraps each key answer into its question's `answerFormat` by template:
  - `layer-of-file`: a string becomes `{layer}`;
  - `direction-violation-count`: an integer becomes `{count}`;
  - `files-importing-against-direction-from-layer`: an array becomes `{files}`;
  - `implementer-of-interface`: an array becomes `{implementers}`;
  - the other templates are already in answer form.
  - A test asserts that every one of the 20 normalised keys has exactly the `answerFormat` keys.
- **SC-8. Value normalisation**, the same for every condition:
  - strings are trimmed;
  - **paths:** `\` becomes `/`, and a leading `./` is dropped. Then, in this order: (a) the known tree prefix is stripped exactly: stored texts are redacted (DR-27a), so the prefix is `<H>/trees/<repoId>/`; (b) only if no known prefix matched, an absolute path is cut at the first `/src/` segment *after* the last `/<repoId>/` segment, and failing that at its last `/src/` segment. A plain "first `src/`" cut is not used, because a harness root under a directory named `src` would be cut in the wrong place. R's Read and Glob report absolute paths and G's tools report project-relative ones, so without this step the format alone would separate the conditions. Whether a strip was needed is kept per answer as `pathPrefixStripped`, and the strict variant (no stripping) is scored alongside (author question 2);
  - **layer pairs**, and the direction keys of `cross-context-imports` (for example `book->user`): `→` becomes `->`, and spaces around `->` are dropped;
  - **verdicts** (`pass`/`fail`): trimmed and lower-cased;
  - **integers:** a JSON integer, or a string of digits;
  - **booleans:** `true`/`false`, or those strings;
  - **rule ids:** upper-cased;
  - **layer names, class names:** exact after trimming, case-sensitive.
- **SC-9. Rubric**, per template (from `questions.json`):

| Template | Primary score | Secondary |
|---|---|---|
| layer-of-file | 1 if layer equal | — |
| direction-violation-count | 1 if count equal | relative error \|a − t\| / t |
| files-importing-against-direction-from-layer | 1 if the set is equal | Jaccard |
| top-violating-layer-pair | 0.5 pair + 0.5 count | — |
| files-in-import-cycles | 0.5 per integer | — |
| max-fan-in-file | 0.5 file set + 0.5 count | Jaccard of files |
| cross-context-imports | 0.5 per direction key | — |
| hypothetical-import-allowed | 0.5 allowed + 0.5 (both layers equal) | — |
| implementer-of-interface | 0.5 class set + 0.5 file set | — |
| blocking-verdict | 0.5 verdict + 0.5 rule set | Jaccard of rules |

  - Sets compare as sets after SC-8. Duplicates are dropped.
  - The relative error is |a − t| / t for t > 0, and |a| (as an absolute error, flagged `absoluteErrorUsed`) for t = 0. Jaccard of two empty sets is 1.
  - Extra keys in the model's JSON are ignored. A missing key or a mistyped value scores 0 for that part.
  - The scorer looks a template's rubric up by its `template` name and refuses a question whose template it does not know. A new template cannot be scored by accident.
- **SC-10. Caps and validity.** A valid cap-hit session scores 0 on every part, whatever its answer. An invalid session is not scored and is listed under `excluded`. Calibration sessions are not scored; their tokens are the per-condition fixed overhead.
- **SC-11. Score record** (`<run dir>/scores.json`): per session `{sessionId, questionId, condition, run, valid, capHit, parse, score, parts: {name: number}, secondary: {…}, tokens, numTurns, wallMs, toolCalls}`, plus the SHA-256 of `answers.json` and `questions.json` at scoring time. The scorer refuses to score a run whose `plan.json` hashes differ from those files, with one exception: `--rescore-with-current-key` scores against a corrected `answers.json` (note §9.7: a disputed answer is corrected with a dated note and the item is reported both ways). It writes `scores-key-<first 8 hex of the new hash>.json` and `items-key-<…>.json` next to the original files, never over them, and records both hashes. A changed `questions.json` is always refused.

### 3.5 The per-item table

- **SC-12.** `<run dir>/items.json` and `items.csv` have one row per (repo, question, condition) of the main and N blocks. The columns:
  - `class` and `template`;
  - `nRuns` (valid runs);
  - `acc` (the mean primary score over the valid runs);
  - `tokMedian` (the median processed tokens over the valid runs, cap hits included, §5);
  - `tokUncachedMedian`, `turnsMedian`, `wallMedianMs`, `capHits`, `formatFailures`, `toolCallsMedian`.
- A second table has the calibration overhead per condition, and the tokens per correct answer (Σ tokens / Σ score) per condition and repo (§6); it is `null` when Σ score = 0.
- The processed-token primary sums every `modelUsage` key, auxiliary models included, as §6 of the note says. The auxiliary share is a separate column, `tokAuxMedian`, so a reader can see it.
- **The uncached measure depends on the order.** Prompt caching carries across sessions of the same condition (the committed envelope shows 1-hour cache writes), so `uncached` depends on what ran before. The primary (all four fields) does not. The analysis must not treat `tokUncachedMedian` as order-free.
- The pilot is scored into `pilot-scores.json` for the format gate (DR-25) and never enters `items.json`.

### 3.6 What the analysis reads

`items.json` is the whole input of the §8 analysis. d_q, r_q and Δ_t come from its acc and tokMedian columns for the 18 compiler-defined items, and Q10 is a separate row (class I). The analysis is not part of U8 (§1).

---

## 4. Where the code goes

Repo idiom: v1.3 study code is an entry file `scripts/v1.3/<name>.ts` over a library in `scripts/v1.3/lib/`. It uses `DomainResult` from `src/shared/errors/domain-result.ts` and the `ProcessRunner` port, and its tests sit in `tests/unit/scripts/v1.3/`. The libraries are flat files or a subfolder (`lib/panel/`, `lib/labelling/`).

| File | Role |
|---|---|
| `scripts/v1.3/lib/eff01/types.ts` | `Eff01Condition`, `Eff01Block`, `SessionSpec`, `SessionRecord`, `SessionStatus`, `TokenUsage`, `ScoreRecord`, `ItemRow`; the constants `EFF01_SEED = 20261018`, `CAP_WALL_MS = 600_000`, `CAP_TURNS = 30`, `CAP_TOKENS = 400_000`, `DEFAULT_MODEL`, `DEFAULT_CLI_VERSION`, `CONDITION_SENTENCES` |
| `scripts/v1.3/lib/eff01/inputs.ts` | loads and hashes `questions.json`, `answers.json`, `repos.json`; `architectureBlock(specText)` (DR-7) |
| `scripts/v1.3/lib/eff01/prompt.ts` | `FRAME_TEMPLATE`, `buildPrompt(…)`, `CALIBRATION_PROMPT` (DR-6) |
| `scripts/v1.3/lib/eff01/argv.ts` | `buildConditionArgs(condition, …)`, `eff01McpConfig(…)`, validation through `checkArmArgs` (DR-9 to DR-11) |
| `scripts/v1.3/lib/eff01/plan.ts` | `planSessions(opts)`: blocks, variants, seeded order, lanes, counts (DR-1 to DR-4) |
| `scripts/v1.3/lib/eff01/trees.ts` | pin check, `git archive` export, `treeFingerprint` (DR-14 to DR-16); git goes through the `ProcessRunner`, so tests mock it |
| `scripts/v1.3/lib/eff01/transcript.ts` | stream-json reader: init event, tool uses by name, the result event, partial usage; `checkConfinement` (DR-20, DR-23); `stripCost` (DR-27) |
| `scripts/v1.3/lib/eff01/tokens.ts` | `processedTokens(envelope)` and the secondary measures (SC-4 to SC-6) |
| `scripts/v1.3/lib/eff01/session.ts` | `runSession(spec, deps)`: env, MCP config, spawn through `runWithRetries`, the disposition wrapper, status, record writing (DR-12, DR-13, DR-17 to DR-22, DR-26) |
| `scripts/v1.3/lib/eff01/driver.ts` | `runEff01(opts)`: probe, plan, lanes, resume, re-runs, pilot gates, live guard (DR-5, DR-24, DR-25, DR-28 to DR-30) |
| `scripts/v1.3/lib/eff01/redact.ts` | `redactPaths(value, roots)` (DR-27a), applied with `scrubDeep` and `stripCost` before every write |
| `scripts/v1.3/lib/eff01/stub-runner.ts` | `StubEff01Runner implements ProcessRunner` with behaviours `key`, `wrong`, `no-answer`, `unparsable`, `max-turns`, `timeout`, `truncated`, `leak-mcp-in-R`, `read-outside-tree`, `leak-builtin-in-G`, `mcp-not-connected`, `usage-limit-once`, `model-mismatch`; it answers `git rev-parse` with the pin, `git archive -o` by writing a placeholder file, and `tar -xf … -C <dest>` by copying a fixture tree into `<dest>`. It refuses any command it does not know, so a dry run cannot fall through to a real binary |
| `tests/fixtures/eff01/tree-mini/` | a small fixture tree (`tsconfig.json` and a few `src/**/*.ts` files) that the stub "exports" in tests and in the CLI dry run |
| `scripts/v1.3/lib/eff01/score.ts` | `extractAnswer` (SC-1 to SC-3), `normaliseKey` (SC-7), `normalise*` (SC-8), `RUBRICS` by template (SC-9), `scoreSession`, `itemTable` (SC-10 to SC-12) |
| `scripts/v1.3/eff-01-run.ts` | entry: flag parsing, `NodeProcessRunner` or the stub, exit codes 0 ok, 1 gate stop, 2 setup error |
| `scripts/v1.3/eff-01-score.ts` | entry: `--run <dir>`; also `--self-test`, which scores the key against itself |
| `tests/unit/scripts/v1.3/eff01/*.test.ts` | §6 |

**Reused without change:** `mcpToolRules`, `checkArmArgs`, `DAEDALUS_MCP_SERVER` (`scripts/lib/generators/arms.ts`); `FORBIDDEN_GENERATOR_FLAGS` (`argv.ts`); `parseEnvelope`, `writeEnvelope` (`envelope.ts`); `judgeModelUsage` (`model-usage.ts`); `runWithRetries`, `DEFAULT_RETRY_POLICY` (`retry.ts`); `attemptDisposition`, `detectUsageLimit` (`outcome.ts`); `isolatedClaudeEnv`, `checkIsolationBeforeSpawn`, `parseCliVersion` (`scripts/lib/loop/isolation.ts`); `redactPrompt` (`scripts/lib/loop/agents.ts`); `createRng`, `shuffle` (`scripts/lib/stats.ts`); `TOOL_NAMES` (`src/mcp-server/server.ts`); `scrubDeep` (`src/shared/errors/scrub.ts`); `NodeProcessRunner`.

**Built-file dependency.** G's server is `dist/mcp-server/main.js`, so a live run needs `npm run build` at a recorded commit. The driver records the commit and refuses a live run if the entry is missing. The dry run does not need `dist/`.

---

## 5. Why the shared modules are wrapped, not edited

| Shared behaviour | Problem for EFF-01 | U8's handling |
|---|---|---|
| `buildArmCall` | neo4j engine, 9-tool list, Write/Edit, `acceptEdits` | own argv (DR-9, DR-10) |
| `attemptDisposition`: timeout with 0 files is infrastructure | every EFF-01 timeout would be retried | wrapper maps timeout to final `cap-wall` (DR-17) |
| `turnStatus`: `is_error` is agent-error | `error_max_turns` is a cap hit, not a failure | own status order (DR-22) |
| `extractModelUsage`: output tokens only | processed tokens need four fields | own `tokens.ts` (SC-4) |
| `analyseTranscript` (`mcp-smoke.ts`): check-tool focus | EFF-01 needs per-name counts, the init event and confinement | own `transcript.ts`, same parsing idiom |

The loop, E1 and smoke harnesses keep their behaviour unchanged.

---

## 6. Test strategy

Zero calls. `jest --maxWorkers=2`. No Neo4j, and no network: git is mocked through the runner.

| Id | File | What it pins |
|---|---|---|
| T-KEY | `score.test.ts` | Each of the 20 key answers, normalised (SC-7) and serialised as an `ANSWER:` line, scores 1.0 on every part. `--self-test` gives the same result. |
| T-PERT | `score.test.ts` | One perturbation per template scores below 1, with the expected parts: a count ±1, a set missing one file, a set with an extra file, a flipped boolean, a wrong layer pair with the right count, a rule set missing one rule, a class right with the file wrong. Jaccard and relative error give the hand-computed values. |
| T-NORM | `score.test.ts` | An absolute path and a `./src/…` path score as `src/…` and set `pathPrefixStripped`; `→`; `"23"`; `"true"`; lower-case rule ids. A layer name is case-sensitive. |
| T-PARSE | `score.test.ts` | missing line; two lines (the last wins, flag set); a fenced payload; trailing prose after the JSON (`extracted`); invalid JSON (`unparsable`). Each non-answer scores 0. Also: a `FAIL` verdict, a `book → user` direction key, a relative error at t = 0, and two empty sets (Jaccard 1). A `--rescore-with-current-key` run writes new files and leaves `scores.json` unchanged. |
| T-CAP | `score.test.ts` | `error_max_turns`, `num_turns` 31, tokens 400,001 and a timeout each score 0 with the right `capHit`, even when the answer equals the key. Their tokens stay in the item medians. |
| T-TOK | `tokens.test.ts` | The four-field sum on a fixture shaped like the floor-probe envelope; the uncached and output measures; `usageMismatch`; partial-transcript tokens. |
| T-ARGV | `argv.test.ts` | The R, G and N argv equal the §11 calls plus `--max-turns 30`, element for element, except G's per-session `--mcp-config` path (DR-9). G has the 11 exact rules in `TOOL_NAMES` order. `checkArmArgs` passes, and no forbidden flag, Write, Edit or permission-mode appears. The MCP config has one server with `--engine cypher-interp` and an absolute `--call-log`. |
| T-PROMPT | `prompt.test.ts` | The frame matches §5 byte for byte on a fixture. The architecture block of both committed specs starts at `architecture:` and ends before `fitness_functions:`. The SHA-256 is stable. |
| T-PLAN | `plan.test.ts` | Counts 2 / 8 / 120 / 20 = 150; the variants 90 and 50; the same seed gives the same order; the conditions interleave; the unit of the shuffle is the session (the 3 runs of a cell are not all adjacent); the lanes are balanced halves by construction (DR-4: sizes differ by at most 1, and per condition by at most 1), checked for the default seed and for 50 other seeds; the pilot and calibration run on lane 0; the pilot cells are exactly ES-Q02, DF-Q02, ES-Q06 and DF-Q06 × {R, G}. |
| T-CONF | `transcript.test.ts` | R with an `mcp__` call; G with a Read; G with `mcp_servers` not connected; N with any tool call; a clean transcript for each condition. |
| T-DRY | `driver.test.ts` | A full dry run (`--block all`) with the stub (`key` behaviour) over `tests/fixtures/eff01/tree-mini/`: 150 records, every one valid and marked `dryRun`, then the scorer gives acc = 1 on every item. A `leak-mcp-in-R` pilot stops before main. A `read-outside-tree` R session is a leak. Two `no-answer` pilot sessions stop the gate. `usage-limit-once` archives an interruption and the session completes on retry. A timeout is not retried. A `truncated` session is `envelope-unreadable`. Resume skips final records. A second invocation reproduces `plan.json` byte for byte. Two concurrent G sessions write two separate call logs. No stored file holds a cost field, or the real harness root, repository root or `HOME`. A dry run with `--out` inside `experiments/` exits 2. Every test injects a zero-wait sleeper and a fake clock. |
| T-GUARD | `driver.test.ts` | `--live` without `--confirm-sessions`, with a wrong count, or with a wrong questions hash exits 2 and never calls `run` at all (not even `--version`). `--live --block all` exits 2. `--live --block main` without a passing `pilot-gate.json` exits 2. The spawn budget (DR-24a) stops a run whose re-runs would exceed `--confirm-sessions` + `--rerun-allowance`. A dry run with `--claude` or `--config-dir` exits 2. |
| T-TREE | `trees.test.ts` | A wrong HEAD is refused. The export issues exactly two runner calls, `git … archive --format=tar -o <file> <sha>` and `tar -xf <file> -C <dest>`, and no stdout is used as data. The fingerprint changes when one byte of a file changes, and when a dotfile is added. A changed tree after a session gives `tree-changed`. |
| T-REDACT | `redact.test.ts` | Each root is replaced, longest prefix first (a harness root inside `HOME` becomes `<H>`, not `<HOME>/…`); nested objects and JSONL lines are covered; a path under a directory named `src` above the tree is not mis-cut by SC-8. |
| T-ISO | `session.test.ts` | The env has `HOME` per session and `CLAUDE_CONFIG_DIR` from the flag, and no denied variable (for example `ANTHROPIC_API_KEY`). A non-empty G cwd is refused. |

An optional local check, not in CI: a dry run of G with the stub calling the real tool handlers in process (as `mcp-smoke.ts` does) against the two exported trees, if the clones are present. It also runs `evaluate_project` on each tree with `--engine cypher-interp` and requires 23 and 102 violations (DR-15). It is skipped and noted when the clones are absent. A live run refuses to start until this check has passed on the same tree fingerprints.

Typecheck: `tsc -p tsconfig.v13-fidelity.json --noEmit` already covers `scripts/v1.3/**` and `tests/unit/scripts/v1.3/**`.

---

## 7. Risks

1. **`--safe-mode` may drop an explicit `--mcp-config`.** The help says safe mode disables MCP servers. No committed transcript shows a connected `daedalus-arch` server under `--safe-mode`. *Handling:* DR-23 reads the init event, so the first G pilot session shows it. If the server is not connected, the fallback is to drop `--safe-mode` for every condition. `--restricted`, `--strict-mcp-config` and the clean `CLAUDE_CONFIG_DIR` would keep the isolation, but it is a change to the §11 calls and needs the author (question 3).
2. **The hidden `--max-turns` could change in another CLI build.** *Handling:* the version pin (DR-29), the pilot check (DR-25), and the after-the-fact backstop (DR-18).
3. **Path-format asymmetry between R and G.** *Handling:* SC-8 cuts paths to `src/`, records whether it did, and the scorer can report a strict variant. The choice must be fixed before the freeze (question 2).
4. **A timeout loses the result envelope.** *Handling:* partial-transcript tokens (DR-20). They undercount the last, unfinished turn, and the record says so through `tokensSource`.
5. **Two lanes and the MCP server's cold start.** Two G sessions at once each start their own server, on the in-process engine, so no shared state. Wall time in G includes the cold start (T4). The ≤ 2 lanes rule keeps the machine within its limits.
6. **R's `cwd` is a tree without `.git`.** This is a small change from the note, which says "the clone root". It removes git history and untracked files from what R can read, and makes R and G see the same files. If the author wants the literal clone, `--tree-mode clone` can be added, but the tree check (DR-16) then also has to ignore `.git`.
7. **G's `infer_spec` and `propose_spec` read the project** and take seconds. They are allowed (§5 allows all 11) and are only extra cost if the model chooses them. This is reported through the tool-call counts.
8. **Secrets and cost in transcripts.** `scrubDeep` with the known secrets runs on every stored file, and DR-27 removes the cost fields. The repo is public.
9. **Calibration on one repo** measures overhead that is independent of the repo only if G's tool schemas are. They are (the 11 descriptions are fixed). The MCP server's `instructions` do not depend on the repo either.
10. **More model calls than approved.** Re-runs (DR-24) and infrastructure retries after a first turn spend calls beyond the approved count. *Handling:* the spawn budget (DR-24a) stops the run at `n` + allowance.
11. **Personal paths in a public repo.** Transcripts, argv and call logs carry absolute paths under the author's home. *Handling:* `redactPaths` before every write (DR-27a), and a test on every stored file.
12. **R reading the key.** Read accepts absolute paths, and the key sits in this repository. *Handling:* the trees live under `<H>`, outside the repository, and any R tool input outside the tree is a `read-outside-tree` leak (DR-23).
13. **Rationale comments in the architecture block** name two rule ids and describe the repository-implementation folder (DR-7). They reach all three conditions equally, so they do not bias R against G, but they can raise N and help Q09 and ES-Q10. *Handling:* the block's hash is recorded, and the choice is author question 8.

---

## 8. Extension and rule compliance

- **Content validation:** this file has no Mermaid or ASCII diagrams. The tables were checked for column counts.
- **Hard rules of the unit:** no session, no model or API call, no Neo4j, no git operation by this stage. No file under `ops/`, `aidlc-docs/audit.md` or `aidlc-docs/aidlc-state.md` was edited. Paths are repo-relative, and there are no billing figures.
- **Extensions:** no extension is configured for this cycle beyond the base rules, so it is N/A here. The orchestrator holds `aidlc-state.md`.

---

## 9. Author questions

None of these blocks the code: each is a flag or a constant with the default shown. All of them have to be settled before the first live session.

1. **Call count and freeze** (note §12): 150, 90 or 50 sessions, plus a re-run allowance (DR-24a; default 10 %, so 15 for 150). Approve and freeze `experiments/eff-01/questions.json`. The live guard (DR-30) takes the approved count, the allowance and the frozen hash.
2. **Path normalisation** (SC-8): cut absolute or clone-prefixed paths to their first `src/` segment for the primary score, with a strict variant reported? Default: yes.
3. **`--safe-mode` fallback** (risk 1): if the first G pilot session shows `daedalus-arch` not connected, may `--safe-mode` be dropped from all three conditions, keeping `--restricted`, `--strict-mcp-config` and the clean config directory? Default: stop and ask.
4. **Calibration repo** (DR-2): the 2 calibration sessions run on one repo. Default: `ddd-forum`.
5. **Analysis scope:** build the §8 analysis (exact Wilcoxon, Holm, bootstrap, H1–H5) as a follow-on unit before the main run, so that it is fixed before any data? Default: a follow-on unit, before main.
6. **R's working directory** (risk 6): a `git archive` tree at the pin (no `.git`), shared with G's `--project`, instead of the raw clone root? Default: the tree.
7. **`--max-turns 30`** (design §1): use the hidden but supported flag as the hard cap, with `num_turns` > 30 as the backstop? The note anticipated this ("the dry run checks whether the flag is accepted"). Default: yes.
8. **Comments in the architecture block** (DR-7, risk 13): keep the spec's YAML comments verbatim, as the note says, or strip comment lines before the block goes into the prompt? Default: verbatim, with the hash recorded; a `--strip-spec-comments` flag exists so the choice can be made at the freeze.
