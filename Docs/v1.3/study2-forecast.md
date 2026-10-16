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

## 4. Numbers (computed after §1–§3 were committed)

> Exploratory budget aid, development telemetry only. No recommendation beyond the numbers.

**Run.** Base `origin/v1.3` `dffb1db8`, branch `v1.3-study2-forecast`. Telemetry: `results/e1-grid/agg/runs.csv`
(72 generations, 18 per model), `results/e1-grid/agg/latency.csv`, `results/v1.3-floor-probe/summary.json` (28 steps),
and the six agent-proof `.meta` files from `origin/v1.3-agent-proof` `4e83ed1f` (extracted with `git archive`;
cross-check only). Outputs: `results/v1.3-study2-forecast/*.md|json`. Plans: `experiments/study2-forecast/` (counts
only; the model pins are E1's, as placeholders, not a decision). Command (reproduces every file):

```
git archive origin/v1.3-agent-proof examples/agent-proof-clinic/transcripts | tar -x -C <scratch>
npx tsx scripts/v1.3/study2-forecast.ts --plan experiments/study2-forecast/plan.working.json \
  --plan experiments/study2-forecast/plan.2models.json --plan experiments/study2-forecast/plan.2models-k4.json \
  --telemetry results/e1-grid,results/v1.3-floor-probe,<scratch>/examples/agent-proof-clinic \
  [--backtest] [--window-usd claude-code-cli=40|20] [--fire-source none] [--mcp-scale 1.5]
```

### 4.1 Back-test (the pass criterion)

| Quantity (held-out half of E1) | Actual | Forecast P50 (P10–P90) | Error of P50 | In [P10, P90] |
|---|---|---|---|---|
| USD, Claude pooled | $10.35 | $9.61 ($8.83–$10.41) | −7.1 % | yes |
| generation hours, all four models | 1.24 | 1.19 (1.09–1.29) | −4.2 % | yes |

**Pass: yes.** 82 % of 200 further random splits also pass. Per model the P50 error ranges from −20 % (Opus hours)
to +39 % (Haiku USD), and 6 of 7 per-model actuals fall **outside** [P10, P90]: with 9 training generations per model
the bootstrap band is too narrow. Read every P10–P90 below as resampling noise only, a lower bound on the real
uncertainty.

### 4.2 Working grid and two smaller grids (no usage cap: windows spanned only)

P50 (P10–P90). USD is API-equivalent and covers the Claude pins only (Codex has no metered cost).

| Grid | Calls (step + repair) | USD | Model hours | Wall h, 1 lane | Wall h, 2 lanes | Claude windows, 1 / 2 lanes |
|---|---|---|---|---|---|---|
| Working: 6 × k=5 × 3 models × 3 runs × 3 arms | 810 + 27 (9–51) | $256 ($247–$266) | 26.6 (25.8–27.5) | 27.9 (27.0–28.8) | 14.0 (13.6–14.4) | 6 / 3 |
| 2 Claude models, k=5 | 540 + 18 (5–35) | $256 ($247–$266) | 19.2 (18.5–19.9) | 20.0 (19.3–20.8) | 10.0 (9.7–10.4) | 4 / 2 |
| 2 Claude models, k=4 | 432 + 15 (5–28) | $205 ($197–$214) | 15.3 (14.8–16.0) | 16.0 (15.4–16.7) | 8.0 (7.7–8.4) | 4 / 2 |

Per arm (working grid): `none` $82.49, `daedalus-mcp` $82.54, `gate` $90.74 (repair turns at an 11 % fire rate,
4–18 %). Full per-arm tables: `results/v1.3-study2-forecast/unbounded.md`.

### 4.3 Under a usage cap (hypothetical capacities: calls per window are unmeasured)

| Grid | Cap per 5-h window | Wall h, 1 lane | Wall h, 2 lanes | Claude windows |
|---|---|---|---|---|
| Working | $40 | 36.1 | 32.3 | 7 |
| Working | $20 | 67.7 | 65.3 | 14 |
| 2 models, k=5 | $40 / $20 | 31.8 / 62.1 | 31.0 / 65.2 | 7 / 13–14 |
| 2 models, k=4 | $40 / $20 | 25.7 / 50.9 | 25.4 / 50.6 | 6 / 11 |

When the cap binds, a second lane on the **same** account does not help: the window, not the lane, is the limit. On the 2-model k=5 grid at $20 it is even slower (65.2 h against 62.1 h), because two lanes exhaust each window together and both wait out the pause.

### 4.4 Sensitivities (working grid, $20 cap)

| Change | Total USD P50 | Wall h, 1 lane | Claude windows |
|---|---|---|---|
| Gate fire rate from the floor probe's `none` arm (50 %) instead of the tool arm (11 %) | $289 | 74.5 | 15 |
| `daedalus-mcp` turns cost 1.5 × a plain turn | $298 | 78.6 | 16 |

### 4.5 Reading

- E1's observed cost per generation is **$0.66 (Opus) and $0.26 (Sonnet)**, mean. The outline §6 guess of 2–6 USD per
  step turn is about 3–23 × higher, so the working grid's forecast ($256) sits far below the outline's 1.5k–6k USD.
- The largest unmodelled risk is the **step-turn shape**: an E1 generation is one greenfield project; a step 2..k turn
  reads a growing tree. The agent-proof extension turns (MCP attached) took 57–230 s, mean 128 s, against E1's
  163 s (Opus) and 84 s (Sonnet) per generation, so durations look comparable; their cost is not committed. A loop
  pilot's per-step envelopes (cost, tokens) would replace this assumption; that needs the author's login.
- Wall time is set by the usage windows once a cap binds; the cap in USD per window is the single input to measure
  first (one window of the pilot gives it).
