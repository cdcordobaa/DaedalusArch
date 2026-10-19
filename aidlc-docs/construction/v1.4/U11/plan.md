# U11 code-generation plan: Gemini generator ready for the S4 probe (BUILD-G)

**Single source of truth for U11's Code Generation.** Depth: minimal (a readiness unit on top of U5 Part B; no new
design: the probe follows `Docs/v1.4/gemini-s4-probe-spec.md` exactly). Requested by the coordinator as job BUILD-G
(scheduled routine, 2026-10-19). All steps executed in one session; no step was approved interactively (the routine's
stored prompt is the approval of scope).

**Unit context**
- Brownfield TypeScript repo. Adapter: `scripts/lib/generators/agy-gen-*.ts`, `scripts/lib/loop/agents.ts` (U5, PR #257).
  Labeller fix it mirrors: `src/llm-critic/agy-cli-provider.ts` (`isAgyResultLine`, `ProcessRunner.stopOnLine`, PR #268).
- Read: `Docs/v1.4/gemini-generator.md` (the confinement rules), `Docs/v1.4/gemini-s4-probe-spec.md` (24 calls, cap 30),
  `Docs/v1.4/study2-deviation-2026-10-19-drift.md` (`generators=claude-sonnet-5-5,gemini-pin`), `Docs/v1.3/loop-isolation.md`.
- Constraints: ZERO model calls (never run agy, claude or any model; stubs and dry runs only); no sealed path read;
  `jest --maxWorkers=2`; tsc clean; ESLint clean on changed files; no edit to `src/apg-enrich/ontology`,
  `src/llm-critic`, `scripts/lib/loop/style.ts`, `scripts/v1.3/lib/level-power-sim.ts`; shared loop files changed
  minimally and additively.
- Out of scope: running the S4 probe; signing in the homes; any protocol line; merging.

## Plan template: the model pin

| Field | Value | Source |
|---|---|---|
| `adapters[0]` | `{ "adapterId": "agy-cli", "modelId": "gemini-4-argon-high", "cliVersion": "1.4.2" }` | The spec names no id ("an `agy models` id"), so the routine's default: `gemini-4-argon-high`, the id agy serves today (BF-01 X arm, CHECK-2 rater) |
| `gemini.cliVersion` | `1.4.2` (exploratory; labeller pin 1.3.2 unchanged) | Author decision 2026-10-19 (`AGY_EXPLORATORY_VERSIONS`) |
| `gemini.s4Result` | `tests/fixtures/agy-gen-cli/s4-result.json` (absent until the live probe passes) | The spec's result file |
| `gemini.homes`, `outRoot`, `binary`, `harnessRoot`, `daedalus.*` | `<local>` | Filled by flags (the probe fills `daedalus`) |

File: `experiments/loop-gemini/gemini-plan.template.json`. Its name does not match `plan*.json`, so the "every
committed loop plan has no gemini block" regression test (U5) is unchanged.

## Steps

- [x] **Step 1. Stop on the result event.** `CallPlan.stopOnLine` (optional; Claude and Codex pass none) forwarded by
  `driveTurn` to `ProcessRunner.run`; `GeminiStepAgent` passes `isAgyResultLine`. `agyGenExitCode` reads a run stopped on
  its result as exit 0 (as the labeller does), used by the usage-limit rule. Test: a fake agy (node script) that prints a
  result then hangs, through the real `NodeProcessRunner`, with a 90 s hard kill and a 30 s test timeout; the turn is
  `completed` in one attempt with `stoppedOnOutput`. Checked by removing the line: the test then times out.
- [x] **Step 2. agy 1.4.2.** `AGY_EXPLORATORY_VERSIONS` moved from `scripts/v1.3/bf-01-run.ts` to
  `scripts/lib/agy-exploratory.ts` (BF-01 re-exports it; value unchanged). `checkAgyGenLiveVersion` (agy-gen-plan.ts)
  accepts those or the labeller pin, else `LOOP_GEMINI_VERSION_UNLISTED`; called in the live grid's S4 pre-pass
  (`main.ts`, 2 lines) and by the live probe. The per-turn version check is unchanged.
- [x] **Step 3. The S4 probe.** `scripts/generator/probes/agy-gen-confinement.ts`: the probe table (G1–G12, G9/G10
  mcp-only, G12 two calls), `plannedS4Calls`/`estimateS4` (11 + 13 = 24), `S4CallCounter` (cap 30; refuses the call past
  it; `--max-calls` may only lower it; a run whose plan exceeds the cap is refused before any spawn), at most 2
  infrastructure retries in all, G0 (process calls only), the probe prompts, the evidence (file system, stream events,
  MCP call log) and `verifyAgyS4Probe`, the arm rule (ADR-029; G5 `no-command` variant; G12 residual), the
  `agy-gen-s4/v1` result (placeholders, scrubbed streams), the abort codes (`AGY_S4_CALL_CAP`, `LOOP_GEMINI_AUTH`,
  `AGY_S4_USAGE_LIMIT`, `LOOP_CLI_VERSION_MISMATCH`). CLI `agy-gen-confinement-cli.ts` with `--estimate`, `--dry-run`
  (scripted confined agy, `agy-gen-confinement-dry-run.ts`), `--no-record`. Only a complete run is copied into the
  repository. Runbook: `Docs/v1.4/gemini-generator.md` "S4 runbook".
- [x] **Step 4. The generator homes.** `scripts/v1.4/gemini-homes.ts` (+ `lib/`): `--create` (mode 700, baseline strict
  settings) and validation (separate, not the labeller home, outside repo/out-root/harness root, not in git,
  `checkAgyGenHome`). No sign-in, no credential opened; credential-like names are only reported as present/absent.
- [x] **Step 5. One stub turn through the loop.** `scripts/v1.4/gemini-turn-dry-run.ts` (+ `lib/`): the template, the
  real `GeminiStepAgent`, the real `NodeProcessRunner`, a fake agy that hangs after its result, the synthetic S4 dry-run
  record with `allowSynthetic`. Record: `results/v1.4-gemini-turn-dry-run/summary.json` (a test checks it is reproduced).
- [x] **Step 6. Docs and records.** `Docs/v1.4/gemini-generator.md` (U11 table, runbook), the spec's status line,
  `results/v1.4-gemini-s4-dry-run/` (synthetic), this plan, `code/summary.md`, one `aidlc-docs/audit.md` entry.
