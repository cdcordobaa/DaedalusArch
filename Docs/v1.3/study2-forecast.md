# Study 2 budget forecaster: model and pass criterion

> **Status**: tooling, 2026-10-16 (night backlog #25, C1; D4, NFR-V4 escalation). A budget aid for the author, **not
> a pre-registration and not a result**. It reads committed telemetry only, makes no model call and reads nothing
> sealed: the task count and the steps per task are numbers in the forecast plan, never read from a task file.
> This section (§1–§3) was committed before the forecaster computed any number. §4 holds the numbers.

## 1. Telemetry it reads

| Source | What it gives | Used for |
|---|---|---|
| `results/e1-grid/agg/runs.csv` (`cell` column) | per generation: `resolvedModelId`, `adapterId`, `totalCostUsd` (Claude only, API-equivalent), `generationDurationMs`, `numTurns` (CLI agent turns), `generationStatus` | the per-turn bootstrap pool, by model id |
| `results/e1-grid/agg/latency.csv` | `total_ms` per evaluated run | evaluator overhead per scoring (median) |
| `results/v1.3-floor-probe/summary.json` | per step: blocking findings before the tool arm's fix (`toolPre.blocking`) and in the `none` arm | the gate fire rate (share of steps with a blocking finding) |
| `examples/agent-proof-clinic/transcripts/*.meta` (branch `v1.3-agent-proof`, read-only) | agent wall seconds per extension turn, MCP attached | a cross-check of step duration only (no model id, no cost) |

**Not available in committed telemetry: token counts.** E1's `envelope.json` files (with `modelUsage`) live outside
the repository (`../daedalus-e1-outcomes`). The forecaster therefore prints USD, calls, CLI agent turns and time, and
prints tokens as `n/a`. The floor probe was one Opus session acting as the agent, so it has no per-turn cost or time.
Codex (`gpt-5.6-terra`) has no metered cost: its USD is `n/a` and its account windows are unbounded unless a capacity
is given.

## 2. Model

- **Unit.** One model call = one step turn, plus one repair turn for each `gate` step whose score has a blocking
  finding (outline §3). Calls per arm and model = tasks × steps per task × runs.
- **Per-call draw.** Each call draws one E1 generation of the **same model id** with replacement (cost, duration and
  agent turns drawn jointly). A step 2..k turn and a repair turn are treated like an E1 greenfield generation
  (`repairScale` = 1, `mcpScale` = 1: assumptions, listed in every output).
- **Gate fire rate.** Primary: the floor probe's tool-arm pre-fix steps (the agent saw findings after each step and
  fixed them, as the gate does), resampled with replacement in every bootstrap draw. Sensitivity: the `none` arm
  (no feedback ever), printed as a second gate row.
- **Evaluator overhead.** Each scoring adds the median E1 `total_ms`; a fired gate step is scored twice.
- **Schedule and pauses.** Runs (one task's k steps in order) go to the earliest free lane (1 or 2 lanes). Lanes on
  the same adapter share one account. A 5-hour window opens at the first call after the previous window ended. When
  a call would take the window past its capacity (USD API-equivalent per window, hypothetical: calls per window are
  unmeasured), the lane pauses until the window's end plus 60 s (the E1 pause policy, generator protocol §8: reset
  plus 60 s) and opens a new window. With no capacity the count is the number of windows the run spans.
- **Bootstrap.** B = 2000 draws, seed 20261016. P10/P50/P90 are percentiles of the B totals.

## 3. Pass criterion (fixed before any number)

**Back-test on E1.** Split E1's generations per model into two halves with the committed seed (20261016; shuffle,
first half = training). Forecast the held-out half's totals from the training half alone.

- **Pass**: for total USD (Claude models pooled) and for total generation time (all four models pooled), the
  forecast P50 is within **±20 %** of the held-out actual total.
- Reported but not part of the pass: whether each actual lies in [P10, P90]; per-model errors; the share of 200
  further random splits that pass (robustness).
- Wall time under pauses is not back-tested: E1's own wall clock with pauses is not in committed telemetry.

The result is reported whether it passes or not.
