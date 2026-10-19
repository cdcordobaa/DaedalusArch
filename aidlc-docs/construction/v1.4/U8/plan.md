# U8 code-generation plan: EFF-01 efficiency harness (driver and scorer)

**Design:** `aidlc-docs/construction/v1.4/U8/functional-design/design.md`. Rule ids (DR-n, SC-n) and test ids (T-xx) refer to it. § numbers marked "note" refer to `ops/notes/eff-01-efficiency-design.md`.
**Map part:** C1c query, efficiency (P1). **Decision:** M5. **Build list:** `ops/03-build-list.md`, item 5 and the U8 line.
**Brownfield:** this unit adds new files only. It edits no existing source file.
This plan is the single source of truth for the unit's code generation. Mark each step `[x]` in the same interaction that completes it.

## Unit context

- **Depends on.** These existing modules are imported and not changed:
  - `scripts/lib/generators/arms.ts`: `mcpToolRules`, `checkArmArgs`, `DAEDALUS_MCP_SERVER`;
  - `scripts/lib/generators/argv.ts`: `FORBIDDEN_GENERATOR_FLAGS`;
  - `scripts/lib/generators/envelope.ts`: `parseEnvelope`, `writeEnvelope`;
  - `scripts/lib/generators/model-usage.ts`: `judgeModelUsage`;
  - `scripts/lib/generators/retry.ts`: `runWithRetries`, `DEFAULT_RETRY_POLICY`;
  - `scripts/lib/generators/outcome.ts`: `attemptDisposition`, `detectUsageLimit`;
  - `scripts/lib/loop/isolation.ts`: `isolatedClaudeEnv`, `checkIsolationBeforeSpawn`, `parseCliVersion`;
  - `scripts/lib/loop/agents.ts`: `redactPrompt`;
  - `scripts/lib/stats.ts`: `createRng`, `shuffle`;
  - `src/mcp-server/server.ts`: `TOOL_NAMES`;
  - `src/shared/errors/{domain-result,scrub}.ts`, `src/shared/interfaces/process-runner.ts`, `src/shared/process/node-process-runner.ts`.
- **Committed data read** (read-only): `experiments/eff-01/{questions.json,answers.json,repos.json}`, and `results/v1.3-external/specs/{event-sourcing-ddd,ddd-forum}.yaml`.
- **Used by, later:** the EFF-01 pilot and main run, once the author approves the call count and the question set; then the §8 analysis (note), which is not in this unit.

## Hard constraints for every step

- No model or external API call, and no CLI session, not even one. Every test uses `StubEff01Runner` or a mocked `ProcessRunner`. No Neo4j. Jest runs with `--maxWorkers=2`.
- Never read `daedalus-sealed/`, `.env`, or any credential or config directory. This includes the judge `CLAUDE_CONFIG_DIR`: the code passes its path and never reads it, and the tests use temporary directories.
- Do not edit:
  - `ops/`, `aidlc-docs/audit.md` or `aidlc-docs/aidlc-state.md`;
  - `experiments/eff-01/*` (the question set is frozen by the author, not by this unit);
  - any file under `scripts/lib/generators/`, `scripts/lib/loop/`, `scripts/v1.3/lib/mcp-smoke.ts` or `src/mcp-server/`.
- No git operations in this repo. The driver's git calls (`rev-parse`, `archive -o`) target external clones through the runner and are mocked in the tests.
- Every test injects a zero-wait sleeper and a fake clock into `runWithRetries` (DR-21); no test may wait on the default 30 s, 120 s or 30 min pauses.
- No test constructs `NodeProcessRunner` for `claude`. Dry runs construct only `StubEff01Runner`, which refuses unknown commands (DR-30).
- Nothing personal reaches a stored file: `redactPaths` (DR-27a) runs with `scrubDeep` and `stripCost` before every write.
- Repo-relative paths in docs and comments. No billing figures anywhere, and no cost field in any record (DR-27).

## Steps

### Step 1: Contracts and constants
- [x] Create `scripts/v1.3/lib/eff01/types.ts` with:
  - [x] the types `Eff01Condition` (`'R' | 'G' | 'N'`), `Eff01Block`, `SessionSpec`, `SessionStatus` (the DR-22 enum), `SessionRecord` (design §3.2), `TokenUsage` (SC-4, SC-5), `ScoreRecord` (SC-11) and `ItemRow` (SC-12);
  - [x] the frozen constants `EFF01_SEED = 20261018`, `CAP_WALL_MS = 600_000`, `CAP_TURNS = 30`, `CAP_TOKENS = 400_000`, `DEFAULT_MODEL = 'claude-sonnet-5-5'`, `DEFAULT_CLI_VERSION = '2.1.301'`, `RECORD_SCHEMA = 'eff-01-session/v1'`;
  - [x] `CONDITION_SENTENCES`, the three §5 (note) sentences verbatim;
  - [x] a docstring on the `--max-turns` decision (design §1): a hidden option of 2.1.301, the `error_max_turns` subtype, and the backstop.

### Step 2: Inputs and prompt (DR-6 to DR-8)
- [x] Create `scripts/v1.3/lib/eff01/inputs.ts`:
  - [x] `loadEff01Inputs(repoRoot)` reads and SHA-256-hashes `questions.json`, `answers.json` and `repos.json`, and checks that every question id has a key and that the repos match;
  - [x] `architectureBlock(specText, {stripComments})` cuts per DR-7, matching only lines `^architecture:\s*$` (the comment on line 2 of both specs must not count), refuses zero or several such lines, and strips comment lines only when `stripComments` is set (author question 8; default off).
- [x] Create `scripts/v1.3/lib/eff01/prompt.ts`:
  - [x] `FRAME_TEMPLATE`, the §5 (note) frame with placeholders, and `FRAME_SHA256`;
  - [x] `buildPrompt({condition, archBlock, conventions, question})`;
  - [x] `CALIBRATION_PROMPT = 'Reply OK'`.
- [x] Create `tests/unit/scripts/v1.3/eff01/prompt.test.ts` (T-PROMPT): the frame equals the §5 text byte for byte on a fixture question; on both committed specs the block starts at `architecture:` and ends before `fitness_functions:`; the hash is stable; and a two-`architecture:` spec is refused.

### Step 3: Argv and MCP config (DR-9 to DR-11)
- [x] Create `scripts/v1.3/lib/eff01/argv.ts`:
  - [x] `buildConditionArgs(condition, {prompt, model, mcpConfigPath?})` emits the DR-9 sequences;
  - [x] G's allow rules are `mcpToolRules(DAEDALUS_MCP_SERVER, TOOL_NAMES)`;
  - [x] every result goes through `checkArmArgs` with the DR-9 server, and through an extra check that rejects `--max-budget-usd`, `--permission-mode`, `Write`, `Edit` and `Bash`;
  - [x] `eff01McpConfig({nodeBinary, serverEntry, specPath, treeDir, callLogPath})` emits DR-11's one-server config with `--engine cypher-interp` and a per-session call log `<H>/calls/<sessionKey>.jsonl`, after it checks that every path is absolute and that the call log lies outside the tree; the config path is `<H>/mcp/<sessionKey>.json`.
- [x] Create `tests/unit/scripts/v1.3/eff01/argv.test.ts` (T-ARGV): R, G and N element for element against the §11 (note) calls plus `--max-turns 30`, except G's per-session config path; the 11 rules in `TOOL_NAMES` order; the config's single server and engine; a relative path is refused; a call log inside the tree is refused; two sessions get two different call-log paths.

### Step 4: Session plan (DR-1 to DR-4)
- [x] Create `scripts/v1.3/lib/eff01/plan.ts` with `planSessions({inputs, runs, withN, blocks, calibrationRepo, lanes})`:
  - [x] the four blocks of DR-2;
  - [x] session ids per DR-1;
  - [x] the seeded shuffle of main sessions (the session, not the cell, is the unit), and of N sessions with `createRng(EFF01_SEED + 1)` (DR-3);
  - [x] lane dealing per condition after the shuffle (the i-th session of a condition goes to lane `i mod 2`), with calibration and pilot on lane 0 (DR-4);
  - [x] `countSessions(plan)`;
  - [x] `serialisePlan(plan)`, deterministic and free of per-invocation facts (DR-3, DR-28).
- [x] Create `tests/unit/scripts/v1.3/eff01/plan.test.ts` (T-PLAN): counts of 2, 8, 120 and 20, total 150; the variants 90 and 50; the same bytes on a re-plan; conditions interleave; runs of a cell are not all adjacent; lane balance within 1 overall and within 1 per condition, for the default seed and 50 others; pilot cells are exactly ES-Q02, DF-Q02, ES-Q06 and DF-Q06 × {R, G}.

### Step 5: Trees (DR-14 to DR-16)
- [x] Create `scripts/v1.3/lib/eff01/trees.ts`, with every process call through the `ProcessRunner`:
  - [x] `checkPin(runner, clone, sha)` runs `git -C <clone> rev-parse HEAD`;
  - [x] `exportTree(runner, clone, sha, dest)` runs `git -C <clone> archive --format=tar -o <dest>.tar <sha>`, then `tar -xf <dest>.tar -C <dest>`, then deletes the tar; it never reads a tar stream from stdout (the runner decodes stdout as text) and refuses a non-empty `dest`;
  - [x] `treeFingerprint(dir)` hashes the sorted `path\0sha256` lines, dotfiles included.
- [x] Create `tests/fixtures/eff01/tree-mini/` (a `tsconfig.json` and a few `src/**/*.ts` files) for the stub's export.
- [x] Create `tests/unit/scripts/v1.3/eff01/trees.test.ts` (T-TREE): a mocked wrong HEAD is refused; the export makes exactly the two runner calls above; the fingerprint is stable and changes on a one-byte edit and on an added dotfile; a non-empty dest is refused.

### Step 6: Transcript, confinement and tokens (DR-20, DR-23, DR-27, SC-4 to SC-6)
- [x] Create `scripts/v1.3/lib/eff01/transcript.ts`:
  - [x] `readTranscript(stdout)` returns `{init?, toolUses: {name}[], resultEvent?, lastAssistantText?, partialUsage, unparsedLines}`;
  - [x] `checkConfinement(condition, t, treeDir)` follows DR-23, including the init `mcp_servers` and `tools` lists and R's `read-outside-tree` check on `file_path`/`path` inputs;
  - [x] `stripCost(obj)` deletes `total_cost_usd` and `modelUsage[*].costUSD` deeply, and is used on the envelope and on each transcript line.
- [x] Create `scripts/v1.3/lib/eff01/redact.ts` with `redactPaths(value, roots)` (DR-27a): longest prefix first, deep over objects and JSONL lines.
- [x] Create `tests/unit/scripts/v1.3/eff01/redact.test.ts` (T-REDACT).
- [x] Create `scripts/v1.3/lib/eff01/tokens.ts` with `tokensFromEnvelope(scrubbed)` (SC-4, SC-5), `usageMismatch` (SC-6) and `tokensFromPartial(t)` (DR-20).
- [x] Create `tests/unit/scripts/v1.3/eff01/transcript.test.ts` (T-CONF): the leak cases (R `mcp__` call, R read outside the tree, G built-in, G not connected, N any tool) and a clean transcript per condition; `stripCost` leaves no cost key.
- [x] Create `tests/unit/scripts/v1.3/eff01/tokens.test.ts` (T-TOK): a fixture shaped like `experiments/v1.3-floor-probe-3/…/envelope-step-04.json` (numbers re-typed, cost removed); the four-field sum; the uncached and output measures; a mismatch; partial-transcript tokens.

### Step 7: Session runner (DR-12, DR-13, DR-17 to DR-22, DR-26)
- [x] Create `scripts/v1.3/lib/eff01/session.ts` with `runSession(spec, deps)`:
  - [x] prepares the per-session `HOME` and the empty cwd (G, N), checks that the cwd is empty, and calls `checkIsolationBeforeSpawn`;
  - [x] builds the env with `isolatedClaudeEnv(parent, home, {configDir})`;
  - [x] for G, writes the per-session MCP config (mode 0600, `<H>/mcp/<sessionKey>.json`) and refuses a call-log path that already exists;
  - [x] spawns through `runWithRetries(hooks, DEFAULT_RETRY_POLICY, deps.clock, deps.sleep)` with `timeoutMs = CAP_WALL_MS` and `maxOutputBytes` 64 MiB;
  - [x] uses `eff01Disposition`: spawn failure, then usage limit, then timeout as final `cap-wall`, then `attemptDisposition(cli, envelope, 0)` (DR-17, DR-21);
  - [x] counts model-reaching attempts for the spawn budget (DR-24a);
  - [x] archives an interruption to `interrupted-<i>/`;
  - [x] decides the status in DR-22 order: infrastructure, envelope-unreadable (including `truncated`), `judgeModelUsage` (from the transcript's model fields when there is no envelope; calibration tolerates `pinned-not-dominant`), confinement, the tree fingerprint after R and G, then the caps;
  - [x] writes `transcript.jsonl.gz`, `envelope.json`, `calls.jsonl` (G) and `record.json`, all passed through `scrubDeep(knownSecrets)`, `stripCost` and `redactPaths`.
- [x] Create `tests/unit/scripts/v1.3/eff01/session.test.ts` (T-ISO, and the status order):
  - [x] env contents, with `ANTHROPIC_API_KEY` absent;
  - [x] a non-empty cwd is refused;
  - [x] the order `infrastructure` > `envelope-unreadable` > `model-mismatch` > `confinement-leak` > `tree-changed` > caps > `completed`;
  - [x] a timeout is not retried;
  - [x] a usage limit is archived and retried, with the injected zero-wait sleeper;
  - [x] a timeout's model check reads the transcript (`modelSource: "transcript"`);
  - [x] a calibration session with `pinned-not-dominant` stays valid; a main session with it is `model-mismatch`.

### Step 8: Stub runner
- [x] Create `scripts/v1.3/lib/eff01/stub-runner.ts` with `StubEff01Runner implements ProcessRunner`:
  - [x] answers `--version` with `2.1.301 (Claude Code)`; answers `git rev-parse` with the pin, `git archive -o <file>` by writing a placeholder file, and `tar -xf <file> -C <dest>` by copying `tests/fixtures/eff01/tree-mini/` (or a given fixture) into `<dest>`; refuses any other command;
  - [x] for a `-p` call, reads the condition from the argv and the question id from the prompt, and emits an init event (with `mcp_servers` connected for G), tool uses allowed by the condition, and a result event with `modelUsage` for the pinned model, `num_turns` and `ANSWER: <json>`;
  - [x] supports the behaviours of design §4: `key` takes its answer from the normalised key (paths written as absolute paths under the tree for R, so SC-8 is exercised), `wrong` perturbs it, `timeout` returns `timedOut: true` with a partial transcript, `truncated` sets `truncated: true`, and `read-outside-tree` emits an R Read of an absolute path outside the tree;
  - [x] supports behaviours per session id, so one test can mix them.

### Step 9: Scorer (SC-1 to SC-12)
- [x] Create `scripts/v1.3/lib/eff01/score.ts` with:
  - [x] `extractAnswer(text)` (SC-1 to SC-3), returning `{payload?, parse, multipleAnswerLines}`;
  - [x] `normaliseKey(template, answer)` (SC-7);
  - [x] the SC-8 normalisers `normPath(p, {repoId})` (known `<H>/trees/<repoId>/` prefix first, then the anchored fallback; with the `pathPrefixStripped` flag and a strict variant), `normPair` (also for cross-context keys), `normInt`, `normBool`, `normVerdict` and `normRule`;
  - [x] `RUBRICS: Record<Template, (given, key) => {score, parts, secondary}>` for the 10 templates (SC-9), and a refusal of any unknown template;
  - [x] `scoreSession(record, question, key)` with the cap and validity rules (SC-10);
  - [x] `itemTable(scores, questions)`, the calibration overhead table and tokens per correct answer (SC-12);
  - [x] the hash check against `plan.json` (SC-11), and `--rescore-with-current-key`, which writes `scores-key-<hash8>.json` and `items-key-<hash8>.json` beside the originals;
  - [x] relative error at t = 0, Jaccard of two empty sets, tokens per correct answer `null` at Σ score = 0, and the `tokAuxMedian` column (SC-9, SC-12).
- [x] Create `tests/unit/scripts/v1.3/eff01/score.test.ts`:
  - [x] T-KEY: 20 of 20 at 1.0;
  - [x] T-PERT: one perturbation per template, with hand-computed parts, Jaccard and relative error;
  - [x] T-NORM;
  - [x] T-PARSE;
  - [x] T-CAP;
  - [x] the item medians include cap hits;
  - [x] pilot sessions never enter `items.json`.

### Step 10: Driver (DR-5, DR-24, DR-25, DR-28 to DR-30)
- [x] Create `scripts/v1.3/lib/eff01/driver.ts` with `runEff01(opts)`:
  - [x] the live guard (DR-30), checked first, before any spawn including `--version`; `NodeProcessRunner` is constructed only after it passes;
  - [x] the version probe at the start and the end (DR-29), recorded in `invocations.jsonl`;
  - [x] `checkIsolationPaths` once at start (live); a fresh empty `<H>/dry-config` in a dry run;
  - [x] the live-only check that `dist/mcp-server/main.js` exists, with its commit recorded;
  - [x] the pin check and tree export once per repo, and the fingerprints;
  - [x] `plan.json`, written before the first session; a later invocation re-plans and refuses to run unless the bytes match (DR-3);
  - [x] the lanes with a concurrency cap of 2;
  - [x] resume (DR-5);
  - [x] one re-run of an invalid session, the second-leak stop (DR-24), and the spawn budget (DR-24a);
  - [x] after the pilot block, scoring the pilot, applying the DR-25 gates and writing `pilot-gate.json`; live: exit; dry run with `--block all`: continue if the gates pass;
  - [x] live `--block main` / `--block n` refuse to start without a passing `pilot-gate.json` for the same plan; live `--block all` is refused;
  - [x] a dry run refuses an `--out` inside `experiments/` and marks `plan.json` and every record `dryRun: true` (DR-28);
  - [x] `run-log.jsonl` and `invocations.jsonl`.
- [x] Create `scripts/v1.3/eff-01-run.ts` (entry). Its flags: `--block calibration|pilot|main|n|all`, `--runs`, `--no-n`, `--lanes`, `--harness <abs>`, `--clones <abs>`, `--config-dir <abs>` (live only), `--claude <abs>` (live only), `--model`, `--cli-version`, `--server-entry`, `--out <run dir>` (required), `--live`, `--confirm-sessions` (live only), `--rerun-allowance` (live only; default `ceil(0.1 × n)`), `--questions-sha256`, `--strip-spec-comments` (default off), `--behaviour` and `--fixture-tree` (dry run only). Dry run is the default. Exit codes: 0 ok, 1 gate or budget stop, 2 setup error. A header comment carries the usage block, in the style of `scripts/v1.3/mcp-smoke.ts`.
- [x] Create `scripts/v1.3/eff-01-score.ts` (entry): `--run <dir>` writes `scores.json`, `items.json`, `items.csv` and `pilot-scores.json`. `--self-test` scores the key against itself and exits non-zero unless all 20 score 1.0.
- [x] Create `tests/unit/scripts/v1.3/eff01/driver.test.ts` (T-DRY, T-GUARD), using a temporary harness, a fixture tree and the stub:
  - [x] the full dry run (`--block all`) gives 150 valid records, and `items.json` has acc = 1 on all 40 main rows and 20 N rows;
  - [x] a pilot `leak-mcp-in-R` stops with exit 1 before main; a `read-outside-tree` R session is a leak;
  - [x] two pilot `no-answer` sessions stop the gate;
  - [x] `usage-limit-once` recovers; `truncated` is `envelope-unreadable`;
  - [x] resume skips final records; a second invocation reproduces `plan.json` byte for byte;
  - [x] two concurrent G sessions (`--lanes 2`) write two separate call logs;
  - [x] no stored file contains `costUSD`, `total_cost_usd`, the real harness root, the repository root or `HOME`;
  - [x] the three guard failures exit 2 with no spawn at all; `--live --block all` and `--live --block main` without a passing gate exit 2; a dry run with `--claude`, `--config-dir` or an `--out` inside `experiments/` exits 2;
  - [x] the spawn budget stops a run whose re-runs would exceed `--confirm-sessions` + `--rerun-allowance` (exit 1).

### Step 10a: Amendment A1 (design §2.9)
- [x] Condition sentences per DR-A1-1 (R and G share the reading sentence; G adds the graph sentence).
- [x] G's argv per DR-A1-2 (`--tools Read,Grep,Glob` plus the MCP config and the 11 rules), pinned in `argv.test.ts`.
- [x] G's cwd is the tree (DR-A1-3); only N's cwd is checked for emptiness, pinned in `session.test.ts`.
- [x] G's confinement per DR-A1-4, pinned in `transcript.test.ts`.
- [x] `graphEvidence` per G score and the `graphUnusedRuns` / `graphUncitedRuns` item columns (DR-A1-5), pinned in `score.test.ts` and `driver.test.ts`.
- [x] The call count stays 150 (DR-A1-6), pinned in `plan.test.ts`.

### Step 11: Verification
- [x] `npx jest --maxWorkers=2 tests/unit/scripts/v1.3/eff01` passes.
- [x] `npx tsc -p tsconfig.v13-fidelity.json --noEmit` passes.
- [x] `npx eslint scripts/v1.3/lib/eff01 scripts/v1.3/eff-01-run.ts scripts/v1.3/eff-01-score.ts tests/unit/scripts/v1.3/eff01` is clean. *Note:* clean apart from two repo-wide baseline classes that existing v1.3 files show too (for example `tests/unit/scripts/v1.3/mcp-smoke.test.ts` and `scripts/v1.3/mcp-smoke.ts`): `expect` reported as an unresolved type (`no-unsafe-call`), and the entry files outside the ESLint project (parsing error). No other finding remains.
- [x] `npx tsx scripts/v1.3/eff-01-score.ts --self-test` reports 20 of 20 at 1.0.
- [x] `npx tsx scripts/v1.3/eff-01-run.ts --block all --out <scratch dir>/run --harness <scratch dir>/h --clones <scratch dir>/clones` (dry run, stub, `tests/fixtures/eff01/tree-mini/`) completes with 150 records, and is followed by `eff-01-score.ts --run <scratch dir>/run`. Nothing is written into `experiments/eff-01/`, and `grep -r` of the scratch run dir finds neither the real `HOME` nor the repository root.
- [x] If the two clones are present locally, run the optional local check of design §6 (real tool handlers in process, `--engine cypher-interp`, 23 and 102 violations on the exported trees); otherwise record it as skipped.
- [x] Record in this plan's completion notes the exact commands a live pilot would use (8 sessions plus 2 calibration), marked **not run, needs the author's OK**.

### Step 12: Code summary
- [x] Write `aidlc-docs/construction/v1.4/U8/code/summary.md`. It lists the files created, the rule-to-test map, the `--max-turns` finding, the risks still open (design §7, items 1, 3 and 13), and the author questions (1 to 8). Markdown only; no application code in `aidlc-docs/`. *Not done in the code-generation session (its file-writing tool refused this file); committed from the PR description at integration, 2026-10-18.*

## Completion notes (2026-10-18)

- **Verification results.** 87 tests in 11 suites pass (`npx jest --maxWorkers=2 tests/unit/scripts/v1.3/eff01`); the typecheck passes; `--self-test` gives 20 of 20; the CLI dry run gives 150 valid records, `eff-01-score.ts` gives acc = 1.000 on all 60 item rows, and a grep of the stored run dir (gz files decompressed) finds no `HOME`, no repository root, no temp root and no cost field.
- **The optional local check ran.** The two clones were present at their pins in a scratch directory outside the repository. `scripts/v1.3/eff-01-local-check.ts` exported both trees through `git archive -o` and `tar -xf`, ran evaluate_project in process with `--engine cypher-interp`, and found 23 and 102 violations, as the committed reports do. No model call, no database.
- **The live pilot commands (not run, needs the author's OK).** Calibration (2) and pilot (8) in one invocation; the gate is read before anything else:

```sh
npm run build
npx tsx scripts/v1.3/eff-01-local-check.ts --clones <abs clones dir> --harness <abs harness dir> \
  --out experiments/eff-01/run-<YYYY-MM-DD>
npx tsx scripts/v1.3/eff-01-run.ts --live --block calibration,pilot --confirm-sessions 10 \
  --questions-sha256 "$(shasum -a 256 experiments/eff-01/questions.json | cut -d' ' -f1)" \
  --claude "$(command -v claude)" --config-dir <abs clean config dir> \
  --harness <abs harness dir> --clones <abs clones dir> --out experiments/eff-01/run-<YYYY-MM-DD>
npx tsx scripts/v1.3/eff-01-score.ts --run experiments/eff-01/run-<YYYY-MM-DD>
```

  The re-run allowance defaults to 1 for 10 sessions (`ceil(0.1 × 10)`). Main and N need their own invocations (`--block main --confirm-sessions 120`, then `--block n --confirm-sessions 20`), which refuse to start without a passing `pilot-gate.json` for the same plan and a passing `local-check.json` on the same trees.

## Not in this unit

- Running any session: calibration, pilot, main or N. The 150-session count (or the 90 or 50 variant) needs the author's OK (note §12).
- The §8 (note) analysis: exact Wilcoxon signed-rank, Holm, bootstrap CIs and the H1–H5 verdicts.
- Cloning the repos, and building `dist/` for a live run.
- Freezing `experiments/eff-01/questions.json`.
