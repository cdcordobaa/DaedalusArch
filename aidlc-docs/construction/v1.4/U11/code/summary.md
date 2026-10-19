# U11 code summary: Gemini generator ready for the S4 probe (BUILD-G)

Plan: `aidlc-docs/construction/v1.4/U11/plan.md`. **No model call was made**: no agy, claude or other model process ran;
every agy in this unit is a scripted runner or a fake node script. No sealed path was read.

## What changed

| Item | Files |
|---|---|
| The turn never waits for agy to exit after its result event (agy 1.4.2 prints it and hangs): `CallPlan.stopOnLine` (optional, additive), `GeminiStepAgent` passes `isAgyResultLine`; `agyGenExitCode` counts such a run as exit 0 | `scripts/lib/loop/agents.ts`, `scripts/lib/generators/agy-gen-events.ts` |
| agy 1.4.2 accepted for exploratory runs (shared `AGY_EXPLORATORY_VERSIONS`, BF-01 re-exports it; labeller pin 1.3.2 unchanged); `checkAgyGenLiveVersion` in the live grid pre-pass and the live probe; per-turn version check unchanged | `scripts/lib/agy-exploratory.ts`, `scripts/v1.3/bf-01-run.ts`, `scripts/lib/generators/agy-gen-plan.ts`, `scripts/lib/loop/main.ts` |
| The S4 probe exactly as the spec: G0–G12, 24 calls, cap 30 (`S4CallCounter`), ≤ 2 infrastructure retries, `--estimate`, `--dry-run`, verdicts from the file system, stream events and the MCP call log | `scripts/generator/probes/agy-gen-confinement.ts`, `agy-gen-confinement-cli.ts`, `agy-gen-confinement-dry-run.ts` |
| The generator homes: create and validate; no sign-in | `scripts/v1.4/gemini-homes.ts`, `scripts/v1.4/lib/gemini-homes.ts` |
| Plan template with the model pin `gemini-4-argon-high`, agy 1.4.2 | `experiments/loop-gemini/gemini-plan.template.json` |
| One stub turn end to end through the loop (fake agy that hangs, real process runner) | `scripts/v1.4/gemini-turn-dry-run.ts`, `scripts/v1.4/lib/gemini-turn-dry-run.ts` |
| Records | `results/v1.4-gemini-s4-dry-run/` (synthetic: both arms pass, 24 calls), `results/v1.4-gemini-turn-dry-run/summary.json` (completed, `stoppedOnResult: true`) |
| Docs | `Docs/v1.4/gemini-generator.md` (U11 table, S4 runbook), `Docs/v1.4/gemini-s4-probe-spec.md` (status line) |

Lint-only edits in changed files (no behaviour change): two optional chains in `agy-gen-events.ts`, a boolean compare
and two `String()` calls in `agy-gen-plan.ts`.

Not touched: `src/apg-enrich/ontology`, `src/llm-critic`, `scripts/lib/loop/style.ts`, `scripts/v1.3/lib/level-power-sim.ts`.

## Tests

- New: `tests/unit/scripts/generators/agy-gen-s4.test.ts` (21: call count, counter and cap, `--estimate` spawns nothing,
  the dry run (both arms pass, 24 calls, synthetic and refused live), a G1 escape fails one arm only, a completed
  `search_web` is a tool escape, a partial run never passes an arm, the cap stops mid-run after a retry, an oversized run
  is refused before any spawn, auth stops at once, at most 2 retries, the pure verdicts for G5/G7/G9–G12, versions,
  `agyGenExitCode`, the template, the homes) and `tests/unit/scripts/loop/agents-gemini-hang.test.ts` (3: the fake agy
  really hangs; `GeminiStepAgent` ends on the result line; the U11 turn dry run reproduces its committed record).
- Regression check of Step 1: with `stopOnLine` removed from `GeminiStepAgent`, the hang test fails on its 30 s timeout.
- Gates: see the PR description for the exact `jest --maxWorkers=2`, `tsc` and ESLint results of this commit.

## Before the live probe (author / coordinator)

1. Create and sign in the two homes (`scripts/v1.4/gemini-homes.ts`, then the pty relay by hand).
2. The author's OK on 24 calls, cap 30 (Q6).
3. Run the runbook command; commit `tests/fixtures/agy-gen-cli/s4-result.json` only if it passes.
