# Neural arm as agent tools: `review_unit`, `explain_and_fix` and the ensemble rater

Written 2026-10-16 on branch `v1.3-neural-mcp` (base `origin/v1.3`). Code: `src/mcp-server/neural-*.ts`, `src/llm-critic/ensemble.ts`, plus the grounding fixes in `src/llm-critic/filter-explain.ts`. Tests: `tests/unit/mcp-server/neural-tools.test.ts`, `tests/unit/llm-critic/ensemble.test.ts`, `tests/unit/llm-critic/filter-explain.test.ts`. No real LLM call was made to build or test this unit: every test uses the mock provider or stub raters and runners.

## 1. Summary

- **Two MCP tools** put the LLM judge inside the coding agent's loop:
  - `review_unit` runs the judge on demand over one file or one module and returns a structured verdict with grounded citations.
  - `explain_and_fix` turns one symbolic finding into one actionable message: the fix hint, the judge's explanation and the code excerpt.
- **The judge is the judge.** `review_unit` renders the judge's own prompt template for the selected version. v1 is the frozen default: same rubric, persona, instructions and verdict schema, and `frozen.ts` is untouched. v2 is opt-in. v2.2 is reported as `unavailable` until branch `v1.3-judge-v22-prep` merges.
- **Grounded or dropped.** Every citation must point at code the prompt actually showed: a file, lines that exist, and quotes that occur in that file. A failing verdict without a located line becomes `inconclusive`. `explain_and_fix` drops an ungrounded explanation. Two grounding minors from the post-merge review are fixed: **R19** (`filter-explain.ts:204`) and **R20** (`filter-explain.ts:221`).
- **Never blocking, never stalls.** Every neural answer is `blocking: false`, `tier: advisory`. A call returns within its latency budget (default 20 s). A slow judge answers `pending` with a job id, and the agent keeps working. Results are cached by content hash and judge version.
- **Ensemble rater**, OFF by default and fully stub-tested:
  - One interface (`NeuralRater`) with adapters for the Claude CLI (isolated config), the Antigravity CLI `agy` (Google subscription, dedicated home) and the Gemini API. The Gemini API rater has a hard call, token and dollar cap; the dollar ceiling is clamped to **$5**.
  - Two combination rules, `fail-if-both` and `fail-if-either`, each with a confidence.
- **Off means unchanged.** Without `--neural` the server registers the same ten tools with the same descriptions, and the experiment arms' allow-list (`SPEC_TOOL_NAMES`) is unchanged. No default output of `firewall evaluate` changes: the report, the judge stage and the cassette keys are untouched.

## 2. Why this makes the neural arm the agent-facing strength

The symbolic arm (the Cypher rules) is strong and fast but only sees structure: edges, names, layers. The judge was the weakest part of the tool, because it ran once per evaluation, far from the moment code is written, and its answers were hard to act on. Most competing tools are purely neural: an LLM reads the diff and says what it thinks, with nothing that checks it.

This unit turns that around without trusting the model more:

1. **The order of the loop.** Every symbolic tool's description, with the arm on, ends with: *"When the result has no blocking finding, call review_unit on the files you changed for the semantic risks rules cannot see; call explain_and_fix on a blocking finding whose fix is unclear."*
   - The judge is asked only once the rules pass, and only about what rules cannot see: logic in controllers, duplicated business rules, framework leaks, persistence around the repository.
   - The agent does not spend model calls re-deriving what a 6 ms `check_file` already knows.
2. **Checked claims.** A purely neural tool returns prose. Here a verdict counts only when its citations exist in the code the model was shown: a file shown, lines inside the shown part, and quotes found in it.
   - A neural false positive with invented evidence is reported as `inconclusive`, with the reasons. The agent is told not to change code on it alone.
   - This is the filter-and-explain discipline (FR-V8) applied on demand.
3. **Symbolic first, neural second.** `explain_and_fix` puts the deterministic hint first: where the code should live, and the smallest structural change. The judge then adds the *why* for this code, and the excerpt shows the lines.
   - A grounded `dismiss` is surfaced as `disputed`, which is useful feedback on a rule's mechanism, but the finding still stands. The judge never overturns a rule.
4. **No gate, no stall.** The judge advises; the rules gate. The judge is slow (tens of seconds), so tools return `pending` rather than block the agent, and an unchanged unit is answered from the cache at once.
5. **Several vendors.** One model's blind spot is a single point of failure. The ensemble asks Claude and Gemini (through `agy` or the API) the same frozen question and combines them by a declared rule. The confidence shows the disagreement instead of hiding it.

## 3. The tools

Both tools are registered only when the server runs with `--neural` (§9). They are read-only and have `openWorldHint: true`, because they call an external model.

### 3.1 `review_unit`

| Input | Meaning |
|---|---|
| `path` | A file (judged for FF-N02, intent alignment, as a `file` unit) or a directory (its `.ts`/`.tsx` sources, without declarations, tests or `node_modules`, judged as one `module` for FF-N01, integrity). At most 12 files. |
| `paths` | The files of one module unit. |
| `content` | The proposed content of a single `path`, reviewed before it is written. |
| `judgeVersion` | `v1` (default: the frozen judge), `v2` (opt-in), `v2.2` (only when the build carries it; otherwise `unavailable`). |
| `function` | Overrides the rubric: `FF-N01` or `FF-N02`. |
| `wait`, `waitMs`, `jobId` | The latency budget of the call (§6); `jobId` polls an earlier `pending` answer. |

Output:
- `status`: `pass`, `fail`, `inconclusive`, `error`, `pending`, `not-configured` or `unavailable`.
- `blocking: false` and `tier: 'advisory'`, always.
- `summary` and `nextStep`.
- `judge`: version, revision, provider, model, expected latency.
- `unit`: id, kind, layer, function, files, and whether the source was truncated.
- `verdict`: the judge's verdict (pass, confidence, reasoning, evidence, violations).
- `grounding`: whether it is grounded, and the problems if not.
- `citations`: file, start and end line, the excerpt, and `via` (`quote` or `reference`).
- `ensemble`: the rule, agreement, combined confidence, and each rater's outcome.
- `job`: id, state, whether it came from the cache, and the elapsed time.

Status rules:
- `pass`: a valid verdict that passes.
- `fail`: a valid failing verdict whose grounding holds and that cites at least one located line.
- `inconclusive`: a failing verdict that is ungrounded, or an invalid answer (schema, model mismatch, no valid rater).
- `error`: the provider failed (no binary, isolation pre-flight failed, usage limit). The call itself still succeeds, so the agent carries on with the symbolic result. An error is not cached, so a later call retries.

### 3.2 `explain_and_fix`

Input: `finding`, the violation as `check_file`, `check_diff` or `evaluate_project` reported it.
- The finding needs `ruleId` or `rule`, and `file` or `filePath`. The other fields are optional: `line`, `reason` or `message`, `subject`, `target`, `severity`, `tier`, `fix`, and `hint`.
- Also optional: `content`, the file's proposed content, and `wait`, `waitMs` and `jobId` as above.

What it does:
1. **Fix hint.**
   - The finding's own `hint` when it carries one: `check_file --hints` on the fix-hints branch (PR #143) adds it.
   - Else the server's `fixHints` source (`ServerContext.fixHints`, typed `FixHintSource`, the shape of `buildFixHint`).
   - Else the finding's own `fix` text.
   - The fix-hints feature is not on `v1.3` yet. Once PR #143 merges, wiring it is one line in `buildContext`: `fixHints: (spec, f) => buildFixHint(spec, f)`.
2. **Judge explanation.** The filter-and-explain prompt (`renderFilterExplainPrompt`, FE persona and schema) over the finding's file and, when it is a project file, its target.
   - The answer goes through `outcomeOf`, so its citations and its `file:line` and `line N` references must exist in what the prompt showed.
   - Grounded `confirm` gives `explained`. Grounded `dismiss` gives `disputed`.
   - Ungrounded, invalid, error or not configured gives `unexplained`: the hint and the excerpt are still returned.
3. **Excerpt.** The numbered lines around the reported line (marked `>`), or around the first mention of the target.

`message` is the one actionable text: the finding line, then *Why (judge, grounded)*, then *Fix*, *Judge's fix* when it differs, the code, and *Then re-run check_file*.

## 4. The judge, reused

| Part | Source | Note |
|---|---|---|
| v1 prompt | `constructPrompt` (`context-assembler.ts`), `FF_N01_RUBRIC` / `FF_N02_RUBRIC` (`rubric.ts`), `PROMPT_INSTRUCTIONS` (`frozen.ts`), no persona override (the provider's frozen `JUDGE_PERSONA`) | A unit test pins the prompt equal to `constructPrompt` of the same packet |
| v2 prompt | `constructPromptV2`, `RUBRICS_V2`, `JUDGE_V2_PERSONA` (`judge-v2.ts`) | Revision `v2.1` |
| Source rendering | `fenceFile`, the judge's budgets (`codeSnippet` 8k tokens for a file, `moduleSource` 24k for a module), `TRUNCATION_MARKER`, `exportedSignatures` for modules | Same fences and delimiter escaping as the judge |
| Verdict schema and parser | `VERDICT_SCHEMA_TEXT`, `parseVerdictText` / `parseEnvelopeVerdict` (strict, no defaults) | |
| Isolation | The cassette decorator (`wrapJudgeProvider`, `createFilterExplainProvider`), so the Claude CLI route runs its ADR-018 pre-flight (pinned CLI 2.1.294, isolated config dir, env allow-list, neutral cwd) and stores every answer scrubbed in a cassette | Cassettes under `.firewall/cassettes/mcp-neural/{review-unit,explain-and-fix}` |
| Grounding | `checkTextReferences`, `shownFileOf` (filter-explain), plus the quote check of `groundVerdict` | §5 |

Differences from `firewall evaluate --llm-provider claude-cli`, stated plainly:
- **Runs per unit.** The on-demand path makes one call per unit; the measured judge makes three and votes by majority.
- **Unit selection.** There is no unit selection: the agent names the unit.
- **Graph context.** There is no ingested graph, so the excerpt is the empty `{"edges":[],"nodes":[]}`. The module's incoming and outgoing lists are `(none)`. v2's neighbourhood reads *"(not available: reviewed on demand without the project graph)"*, and v2 shows no candidate flags.
- **What it is for.** `review_unit` is a development aid, not the registered instrument. The measured judge remains `evaluate` with the judge on.

## 5. Grounding

### 5.1 Fixes of the two minors (post-merge review 2026-10-16)

- **R19 (`filter-explain.ts:204`): grounding counted lines the prompt truncated or never showed.**
  - The new `renderFilterExplainPrompt` returns the prompt and `shown`: each file cut to the complete lines it renders. A file the budget left out is absent.
  - `buildFilterExplainPrompt` returns `.prompt` and is byte-identical to before. This was checked against the previous implementation on 50 generated inputs, truncated ones included, and the test asserts it.
  - `scripts/v1.3/filter-explain-run.ts` now stores `shown` as the prompt's files, so `outcomeOf` grounds against what the model saw. The prompt, and with it every cassette key, does not change.
- **R20 (`filter-explain.ts:221`): a bare `line N` was checked against the longest shown file.**
  - It is now checked against the file it refers to: the shown file named last before it in the same sentence (by path or file name), else the first shown file, which is the finding's own file.
  - With one file shown the result is as before.
  - The review's scenario (*"order.ts calls the ORM at line 212"* with order.ts 40 lines and repo.ts 300) is now rejected, and a test pins it.

### 5.2 Verdict grounding (`groundVerdict`)

For a judge verdict and the files the prompt showed:
- every violation's `filePath` names a shown file;
- every `path:line[-line]` and bare `line N` in the reasoning, evidence and violation messages exists in the file it refers to (`checkTextReferences`);
- every backticked code quote in the evidence and violation messages occurs in a shown file, with whitespace collapsed. A quote over line breaks is located on the fewest lines.
- A failing verdict must cite at least one located line, from a quote or a reference.

Each located quote or reference becomes a citation with its excerpt.

## 6. Caching, async and the latency budget

- **Cache key.** `sha256(canonicalJSON({tool, judge version, revision, function, rendered layer model, judge id (provider:model or the ensemble's rule and raters), each file's path and sha256}))`. An unchanged unit under the same judge version is answered from memory (LRU, 500 results). The Claude route's cassette also answers it across restarts, because a record-mode cassette hit makes no call. Errors are not cached.
- **Jobs.** Each key runs as one job.
  - A second call for a running key joins it; nothing runs twice.
  - A call waits at most `waitMs` (default 20 000 ms, at most 120 000). Past that it returns `status: pending`, with `job.jobId`, `retryAfterMs` and a `nextStep` naming the exact poll call. `wait: false` starts the job and returns at once.
  - Finished jobs stay pollable for 4 × the cache size.
- **Expected cost per tool call** (`EXPECTED_LATENCY`, echoed in every answer's `judge.expectedLatency`):

| Path | Expected wall clock | Calls |
|---|---|---|
| cache hit (same content, same judge version) | < 5 ms | 0 |
| `--neural mock` | < 50 ms | 0 real |
| `--neural claude-cli` (Opus, effort high) | 20–90 s; the first call adds the isolation pre-flight, about 10–30 s | 1 subscription call per unit (plus the init probe once per server) |
| ensemble rater `agy` | 30–240 s (print timeout 240 s) | 1 subscription call per unit |
| ensemble rater `gemini-api` | 5–40 s | 1 billed call; a pessimistic cap of $5 / 1M input and $30 / 1M output tokens bounds a 2k-token prompt at about $0.26 |
| `--neural ensemble` | the slowest rater (raters run in parallel) | 1 per rater |
| `explain_and_fix` | as `review_unit` (one FE call), plus < 10 ms for the hint and excerpt | 1 |

With the 20 s default an agent on the Claude route usually sees `pending` on a cache miss. It keeps writing code and polls once, about 10–30 s later. Symbolic tools stay instant meanwhile, because the server handles calls concurrently.

## 7. Ensemble rater (`src/llm-critic/ensemble.ts`)

- **Interface.** `NeuralRater { id, vendor, model, rate(request), complete(request) }`.
  - `rate` returns `valid` (with the verdict and usage), `invalid` (with the cause), `error` (with code and message, secrets scrubbed) or `skipped` (with the reason). It never throws.
  - `complete` returns the raw answer for other schemas, such as filter-and-explain.
- **Adapters.**
  - `claudeCliRater`: `ClaudeCliProvider` with the judge's isolated config dir (`~/.firewall/judge-claude-config`), the frozen model and effort, the env allow-list and the pre-flight.
  - `agyRater`: `AgyCliProvider` with the dedicated home `~/.firewall/labeller-agy-home`, tools inert, a neutral `mkdtemp` cwd, the prompt on stdin and the version pin. The default model is **`Gemini 4 Argon (High)`** (`ENSEMBLE_AGY_MODEL`), as asked; `--agy-model` overrides it.
  - `geminiApiRater`: `GeminiProvider`, loaded lazily. The key is read only from the named environment variable (default `GEMINI_API_KEY`), never from a file. The model must be pinned (`--gemini-model`, no default, VRD-09). Without the key or the model the rater is `skipped: NOT_CONFIGURED`.
- **Budget (Gemini API).** `BudgetedRater` estimates the worst case before each call: (prompt + persona) / 4 input tokens plus the full `maxTokens` output. It skips the call (`BUDGET_EXHAUSTED: …`) when the call could cross any of these limits:
  - the call cap (default 200);
  - the token cap (default 2M);
  - the dollar ceiling (`--gemini-max-usd`, default and hard maximum **$5**: `effectiveCap` clamps any larger value).

  After a call, the reported usage is charged; a failed call is charged at the worst case. `--gemini-ledger <file>` persists the ledger, so the cap holds across server restarts. A missing ledger file starts at zero; an unreadable or malformed one stops the rater instead of resetting it. The file is replaced atomically (temp file plus rename). Each call holds its worst-case cost until it settles, so concurrent calls in one server cannot together cross the cap.
- **Combination** (`combineVerdicts`). With n valid raters out of t configured, f of them failing:
  - `fail-if-both`: the unit fails when f = n. Every valid rater fails; with two raters, both.
  - `fail-if-either`: the unit fails when f ≥ 1.
  - **Confidence** = mean confidence of the raters that support the outcome × (supporters / n) × (n / t). A split vote halves it with two raters; a rater that errored or was skipped lowers coverage.
  - `status`: `decided`, `degraded` (fewer than 2 valid raters; the rule still applies to those that answered) or `no-valid-rater` (no verdict).
  - `agreement`: `unanimous` or `split`.
  - The violations of the failing raters are merged without duplicates.
- **Explanations.** `explain_and_fix` uses the first rater whose raw FE answer parses.
- **OFF by default.** The ensemble exists only with `--neural ensemble`. All of it is tested with mock providers, a stub process runner that cannot spawn, and a stub Gemini factory.

## 8. What stays byte-identical

- `src/llm-critic/frozen.ts` and `Docs/judge-preregistration.md` are untouched. `FROZEN_SHA256` is unchanged and its test passes. v1 is the default of `review_unit`.
- `firewall evaluate` is unchanged in every mode: the judge stage, `llm-critic.ts`, the report schema and the cassette keys. The filter-and-explain prompt text is unchanged (R19 changes what the answer is checked against, not what is sent).
- MCP server without `--neural`:
  - the same ten tools (`TOOL_NAMES`) and the same descriptions (a test asserts that no description mentions `review_unit`);
  - the same `SPEC_TOOL_NAMES`, so the `daedalus-mcp` arm's allow-list and argv do not move;
  - the neural tools are listed in `NEURAL_TOOL_NAMES` and never in `SPEC_TOOL_NAMES`.
- `parseArgs` returns the same records for the existing flags.

## 9. Running it for real (local commands)

Prerequisites, all from the earlier judge and labeller runs:
- The pinned judge CLI at `~/.firewall/judge-cli/node_modules/.bin/claude` (2.1.294) and its isolated config dir `~/.firewall/judge-claude-config`, signed in.
- For `agy`: the dedicated home `~/.firewall/labeller-agy-home` (`Docs/labeller-route.md` §2).
- For the Gemini API: `GEMINI_API_KEY` exported in the shell. The server never reads `.env`.

```bash
cd /path/to/DaedalusArch
npm ci

# 0. Unit tests of this unit (mock and stubs only; no model call)
npx jest --maxWorkers=2 tests/unit/mcp-server/neural-tools.test.ts tests/unit/llm-critic/ensemble.test.ts tests/unit/llm-critic/filter-explain.test.ts

# 1. Smoke the wiring with the mock judge (no model call), in the MCP Inspector
npx @modelcontextprotocol/inspector npx tsx src/mcp-server/main.ts \
  --spec specs/clean-arch.yaml --project fixtures/correct-reference --neural mock
#    then call review_unit {"path": "src/infrastructure/controllers/TaskController.ts"}

# 2. The frozen v1 judge on demand (Claude subscription, isolated route)
npx tsx src/mcp-server/main.ts --spec specs/clean-arch.yaml --project /abs/path/to/project \
  --neural claude-cli
#    (--judge-cli <path> if the pinned CLI is elsewhere; --claude-config-dir <dir> for another isolated config)

# 3. Register it with Claude Code as the agent's tool server
claude mcp add daedalus-arch -- npx tsx /abs/path/to/DaedalusArch/src/mcp-server/main.ts \
  --spec /abs/path/to/spec.yaml --project /abs/path/to/project --neural claude-cli

# 4. Check the agy route by hand first (the model name the routine uses)
HOME=~/.firewall/labeller-agy-home agy -p "Reply with OK" --model "Gemini 4 Argon (High)"
HOME=~/.firewall/labeller-agy-home agy models     # the id the stream-json init event will name

# 5. The ensemble: Claude + agy (+ Gemini API under a $5 ceiling)
export GEMINI_API_KEY=...        # in the shell only
npx tsx src/mcp-server/main.ts --spec specs/clean-arch.yaml --project /abs/path/to/project \
  --neural ensemble --ensemble-raters claude-cli,agy,gemini-api --ensemble-rule fail-if-both \
  --agy-model "Gemini 4 Argon (High)" \
  --gemini-model <pinned-gemini-model-id> --gemini-max-usd 5 --gemini-max-calls 200 \
  --gemini-ledger .firewall/gemini-ledger.json
```

Flags (`src/mcp-server/neural-context.ts`):

| Flag | Meaning |
|---|---|
| `--neural off\|claude-cli\|mock\|ensemble` | The arm (env `DAEDALUS_NEURAL`; a flag wins). |
| `--neural-cassettes <dir>` | The cassette root (default `.firewall/cassettes/mcp-neural`). |
| `--neural-wait-ms <ms>` | The latency budget of one call. |
| `--strip-comments` | Show the judge the code without comments (`review_unit`, `explain_and_fix`), line for line. OFF by default; with it off, prompts and cache keys are byte-identical. Why: an agent can steer the judge with a comment in its own code (`Docs/v1.3/judge-steering-plan.md`). |
| `--judge-cli <path>`, `--claude-config-dir <dir>` | The Claude route. |
| `--ensemble-raters <list>`, `--ensemble-rule <rule>` | The ensemble. |
| `--agy-model <name>`, `--agy-home <dir>` | The `agy` rater. |
| `--gemini-model`, `--gemini-max-calls`, `--gemini-max-tokens`, `--gemini-max-usd` (≤ 5), `--gemini-ledger` | The Gemini API rater. |

An unknown mode, rater or rule stops the server at start with exit 2, so a typo cannot silently leave the arm off.

## 10. Limits and open points

- **agy model id.** `AgyCliProvider` stops on `MODEL_MISMATCH` when the stream-json `init` event names a model other than the requested one. It also stops on `LLM_CLI_VERSION_DRIFT` when `agy --version` is not the pinned 1.3.2.
  - If `Gemini 4 Argon (High)` is a display name and `init` reports an id, the agy rater returns `error`. Pass the id that `agy models` lists via `--agy-model`. The ensemble degrades instead of failing: confidence and coverage show it.
  - Neither pin is relaxed here, because both are part of the labeller route's isolation.
- **Scrubbing.** The cassette decorator scrubs secret-named environment values out of stored answers (CAS-07). A secret value that also occurs in an answer can break the stored JSON and turn an answer `invalid`. This behaviour is inherited from filter-and-explain. Tests pass `knownSecrets: []` to stay hermetic.
- **No graph context** on demand (§4). Adding the APG neighbourhood would need the in-process extractor per call. `explain_finding` and `evaluate_project` keep the graph view.
- **v2.2.** It is accepted as an input but answered `unavailable` until `v1.3-judge-v22-prep` merges. Adding it is one entry in `JUDGE_PROFILES` (`neural-review.ts`) using `renderLayerModelV22` and its rubric.
- **One call per unit.** There is no 3-run majority on demand. Use the ensemble for a second opinion, or `evaluate` for the measured judge.
- **AI-DLC.** This unit came from a scheduled task with no one present, so the AI-DLC approval gates were not run interactively. The stored prompt served as the requirements (audit entry in `aidlc-docs/audit.md`).

## 11. Files

| File | Role |
|---|---|
| `src/mcp-server/neural-review.ts` | Judge profiles (v1, v2), prompt of a unit, cache key, `groundVerdict` |
| `src/mcp-server/neural-service.ts` | `NeuralJudge` (`SingleJudge`, `EnsembleJudge`), `NeuralService` (jobs, cache, wait budget) |
| `src/mcp-server/neural-tools.ts` | `reviewUnit`, `explainAndFix`, the excerpt, the message, `EXPECTED_LATENCY` |
| `src/mcp-server/neural-context.ts` | Flags, `buildNeuralService` |
| `src/mcp-server/server.ts`, `tools.ts`, `context.ts` | Registration when the arm is on; descriptions; handlers |
| `src/llm-critic/ensemble.ts` | `NeuralRater`, adapters, `BudgetedRater`, `combineVerdicts`, `EnsembleRater` |
| `src/llm-critic/filter-explain.ts` | `renderFilterExplainPrompt` (R19), `checkTextReferences` (R20) |
| `scripts/v1.3/filter-explain-run.ts` | Grounds against the rendered files (R19) |
