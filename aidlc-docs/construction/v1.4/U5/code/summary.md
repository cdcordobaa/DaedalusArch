# U5 code summary: Study 2 evasion check (M6) and Gemini generator adapter (CDX), dry run only

Committed from the PR #257 description at integration (plan step 26; the code-generation session could not write this file).

## What changed

### Part A: Study 2 evasion check (M6)
A post-hoc analysis over a loop out-root (step records plus each run's `snapshots.git`, local git only). It never changes a record.
- **A1, acceptance**: pass rate per cell, coverage, and the paired gap. The 10-point bar is reported both one-sided and two-sided (Q5).
- **A2, moved-only heuristic**: six signals (`dynamic-escape` > `relocated-unmapped` > `wrapped` > `inlined` > `relocated-unguarded` > `deleted`). It follows renames through rho before taking any difference (EV-06b), normalises endpoints (a raw stub specifier is resolved), and has rules for edgeless findings and cycles. Guarded pairs come from the spec and the blocking tier only; observed pairs are listed and never counted (EV-06a).
- **A3, out of scope**: unmapped files and out-of-scope edges, with the `outside_contexts` exemption. The 1-edge margin is marked as a design proposal (Q2).
- **s2d-01 §5 lines 2, 3 and 6**: size, import kinds and barrels, mechanism. Lines §5.4 and §5.7 are recorded under `notHere`.
- **Blind sample**: a seeded draw with enrichment up to half. The packet strips test files and redacts tool and firewall tokens (EV-06). The sealed key's sha256 is in the packet README, and unblinding refuses a key whose hash differs (EV-07). Both bar class sets are reported (Q4).
- Code: `scripts/v1.3/lib/evasion/*`, entry `scripts/v1.3/study2-evasion.ts`. Doc: `Docs/v1.4/evasion-check.md` (candidate text, not registered).

### Part B: Gemini generator adapter over `agy` (CDX), off by default, dry run only
- New: `scripts/lib/generators/agy-gen-cli.ts`, `agy-gen-events.ts` and `agy-gen-plan.ts`. They cover the argv (prompt on stdin), the env (keys and tokens stripped), the generator home and settings checks (exact allow list per run and arm), the ancestor check, the per-turn MCP config, the disposition, the `status` hook, the auth and tool-escape stops, the `gemini` block and the S4 guard. The labeller's `classifyAgyResult`, `checkAgySettings` and `checkAgyHome` are not reused; a test checks this.
- `scripts/lib/generators/types.ts`: `AGY_GEN_CLI_ADAPTER_ID` is added. `GENERATOR_ADAPTER_IDS` is unchanged, so the E1 schedule and the registered plan are unchanged.
- `scripts/lib/loop/agents.ts`: `driveTurn` gets an optional `CallPlan.status` hook (Claude and Codex pass none). `GeminiStepAgent` is new.
- `scripts/lib/loop/plan.ts`: `LOOP_ADAPTER_IDS`. `agy-cli` is accepted only with `gemini.enabled: true`. The adapters error text is unchanged for every plan that does not list `agy-cli`.
- `scripts/lib/loop/main.ts`: new `--gemini-home-none` and `--gemini-home-mcp` options. The **S4 pre-pass runs before any spawn**. There is a new `agy-cli` branch, and the Claude branch is now **explicit** (`LOOP_ADAPTER_UNKNOWN`).
- `Docs/v1.4/gemini-s4-probe-spec.md`: probes G0–G12, **24 model calls, cap 30, NOT run**. `Docs/v1.4/gemini-generator.md`: the adapter doc.
- Recorded dry run: `scripts/v1.3/gemini-adapter-dry-run.ts` drives the real `runLoopGrid` through the real `GeminiStepAgent` with a scripted runner.

Also: `eslint.config.mjs` now ignores the planted fixture trees in `tests/fixtures/v1.4-evasion/**`, and `tests/unit/scripts/architecture.test.ts` gets a BR-U5a-51 check for Gemini model ids.

## Test results
`npx jest tests/unit/scripts/v1.3/evasion tests/unit/scripts/generators tests/unit/scripts/loop tests/unit/scripts/architecture.test.ts --maxWorkers=2` gives **39 suites, 430 tests, all passing**:
- 53 new evasion tests
- 14 in `agy-gen.test.ts`
- 11 in `agents-gemini.test.ts`
- 10 in `plan-gemini.test.ts`
- +1 in `architecture.test.ts`

The existing `agents.test.ts`, `codex.test.ts` and `registered-plan.test.ts` pass unchanged. The schedules of the four committed loop plans are pinned to fingerprints computed with the **base commit's own** `plan.ts`. No test needs Neo4j, and none was skipped.

Other checks:
- `tsc --noEmit` passes for `tsconfig.json` and `tsconfig.scripts.json`.
- `node scripts/v1.3/protocol-consistency-check.mjs` is OK.
- No absolute personal path appears in `results/v1.4-*`, `Docs/v1.4/*`, the new fixtures or the U5 docs.
- ESLint on the new tests reports only the existing baseline for `tests/unit/scripts/**`: jest globals that the type-aware rules cannot resolve. Existing files such as `agents.test.ts` show the same errors.

Dry runs (stub or scripted, not measurements):
- `results/v1.4-evasion-dry-run/demo-stub/`: the loop's own stub dry run. It gives avoided diffs only, as expected.
- `results/v1.4-evasion-dry-run/fixtures/`: the planted cases in real snapshot stores. Every class appears, git's rename detection removes the rename-only diff, and the 20-item packet is clean.
- `results/v1.4-gemini-adapter-dry-run/`: 12 turns, all completed. The synthetic S4 fixture is refused without `allowSynthetic`. The env is recorded by name only and paths are placeholders.

## Deviations from the design
1. **Identity**: U4's drift module is not on `main`, so the default is the pilot-metrics identity, which is per rule. Every report says `identity: pilot-metrics` and is a dry-run artefact (R8). Switching to U4's `edgeKeys` is a one-line manual change, because an import of a missing module cannot compile. The rename map is the local copy, marked for removal.
2. The MCP server args include `--engine neo4j`, because the adapter reuses `daedalusMcpConfig` as the other generators do. Design §3.4 listed the args without it.
3. An optional `gemini.binary` field was added, because a mixed plan's `binary` is the Claude path.
4. The pre-run probe checks the homes structurally. The exact allow list exists only once a turn writes it, and it is checked before every spawn.
5. The MCP part of the stop rule passes a `call_mcp_tool` step when one of its string parameters is a spec-only tool name, and stops on `evaluate_project`. The parameter names are UNVERIFIED (S4 G9).
6. For A3, each cell reports the mean of its runs' step-k values and the sum of new edges.
7. The relocation link is a name match on all of S's exported declarations at t−1. It does not trace which of them used T.
8. "New at t" history uses the final snapshots only; repair-turn snapshots are not added. The gate arm is not a Study 2 cell.
9. The entries are thin. The CLI body is in `scripts/v1.3/lib/evasion/run.ts` and the dry run in `scripts/v1.3/lib/gemini-adapter-dry-run.ts`, because entries in this repo run `main` unconditionally.
10. Plan Step 23's first sentence said "Layered layout". The dry run uses the Clean stub layout, as the step's next sentence and R14 say.
11. DDD guarded pairs do not model the public API and ACL exemptions. This over-approximates and is documented.
12. **Plan Step 26**: the build agent's harness refused to create `aidlc-docs/construction/v1.4/U5/code/summary.md` (agents may not write report files). The summary is this description. The orchestrator can commit it to that path.

Observation for R6: in closed layering, a correct new feature that goes presentation → business → persistence reads as `wrapped` in an avoided step. This is documented in `Docs/v1.4/evasion-check.md`; the bar sits on the human read. No test covers git's "inexact rename detection was skipped" warning: the fixture stores are too small to trigger it.

## Open items
- **S4 prerequisites (author)**: the two generator homes created and signed in, the model pin chosen, and an OK on 24 calls with a cap of 30 (Q6). After that come the probe code (a later unit) and its committed result.
- Before the freeze, re-run the evasion check under U4's edge identity.
- Author questions Q1–Q6 are still open.
- Outside U5: the dated CDX deviation for the protocol line, the Layered loop style (R14), and the acceptance checks of the new tasks (D12).

## Integration fixes and open TODOs (2026-10-18)

Fixed before merge:
- **Stop check on every attempt (design §3.5, stop row; CONFIRMED BUG).** `GeminiStepAgent.runTurn` kept only the last attempt's process result, so a forbidden tool step completed in an attempt that was then retried (print timeout with no files, usage-limit pause and resume) was never seen. It now keeps every attempt's result and runs `agyGenStop` on each. Tests: retried print timeout and usage-limit resume both end in `LOOP_GEMINI_TOOL_ESCAPE`.
- **Version pin before every turn (design R3; was an undeclared deviation).** `runTurn` now runs `agy --version` in the turn's environment before the first attempt and fails `LOOP_CLI_VERSION_MISMATCH` (or `LOOP_CLI_UNAVAILABLE`) before any spawn. Test: a drifted version fails the second turn with no session spawned. The committed `results/v1.4-gemini-adapter-dry-run/summary.json` is regenerated: `probe.versionCalls` is now 13 (1 probe + 12 turns); nothing else changed.
- **EV-05:** a test now shows that diffs from a non-H2 cell (`none@L3`) are counted but never enter the sample pool.

Still TODO (low, or author decisions):
- [ ] LOOP_ADAPTER_UNKNOWN through the live wiring (`scripts/lib/loop/main.ts`), not only `liveAgentKind`; `validatePlan` rejects unknown ids first, so the branch is defensive.
- [ ] Small design-rule tests: (a) below-threshold token-Jaccard 0.6 case; (b) negative avoided-eligible case for "the step added no source file in a guarded source placement"; (c) the DDD cross-context (FF-DS02) guarded pairs; (d) the `acceptanceIncomplete` boundary at coverage 0.9; (e) `renameDetection: skipped` counting (git's inexact-rename warning; fixtures too small to trigger it).
- [ ] Author: accept or revert declared deviation 2, the `--engine neo4j` argument in the Gemini MCP server args (design §3.4 omits it).
- [ ] Tighten the tool-escape MCP check once S4 G9 shows agy's real `call_mcp_tool` parameter shape (check the server is `daedalus-arch`, not only that a string parameter equals a spec-only tool name).
- [ ] Switch `defaultIdentity` to U4's `edgeKeys` once U4's drift module is on main (one-line change; drop the local rename-map parser).
