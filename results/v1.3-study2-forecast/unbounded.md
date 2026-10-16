Telemetry: results/e1-grid/agg/runs.csv, results/e1-grid/agg/latency.csv, results/v1.3-floor-probe/summary.json, <branch v1.3-agent-proof>/examples/agent-proof-clinic/transcripts.

### plan.working.json

6 tasks × 5 steps × 3 runs × 3 models (claude-opus-5-5, claude-sonnet-5-5, gpt-5.6-terra) × 3 arms (none, daedalus-mcp, gate). Bootstrap draws 2000, seed 20261016. Gate fire rate 11% (4%–18%). Pools: claude-opus-5-5 n=18, claude-sonnet-5-5 n=18, gpt-5.6-terra n=18.

Cells: P50 (P10–P90).

| Arm | Step calls | Repair calls | CLI agent turns | Tokens | USD (API-equiv., metered models only) | Model hours |
|---|---|---|---|---|---|---|
| none | 270 | 0 (0–0) | 6,702 (6,495–6,914) | n/a | $82.49 ($78.85–$86.32) | 8.6 (8.3–8.9) |
| daedalus-mcp | 270 | 0 (0–0) | 6,705 (6,483–6,914) | n/a | $82.54 ($78.86–$86.31) | 8.6 (8.3–8.9) |
| gate | 270 | 27 (9–51) | 7,360 (6,864–8,017) | n/a | $90.74 ($83.92–$99.45) | 9.4 (8.8–10.3) |
| **total** | 810 | 27 (9–51) | 20,790 (20,172–21,479) | n/a | $256 ($247–$266) | 26.6 (25.8–27.5) |

| Lanes | Wall hours (incl. pauses) | Wall days (P50) | 5-hour windows per account |
|---|---|---|---|
| 1 | 27.9 (27.0–28.8) | 1.2 | claude-code-cli: 6 (5–6); codex-cli: 3 (3–3) |
| 2 | 14.0 (13.6–14.4) | 0.6 | claude-code-cli: 3 (3–3); codex-cli: 3 (3–3) |

### plan.2models.json

6 tasks × 5 steps × 3 runs × 2 models (claude-opus-5-5, claude-sonnet-5-5) × 3 arms (none, daedalus-mcp, gate). Bootstrap draws 2000, seed 20261016. Gate fire rate 11% (4%–18%). Pools: claude-opus-5-5 n=18, claude-sonnet-5-5 n=18.

Cells: P50 (P10–P90).

| Arm | Step calls | Repair calls | CLI agent turns | Tokens | USD (API-equiv., metered models only) | Model hours |
|---|---|---|---|---|---|---|
| none | 180 | 0 (0–0) | 5,429 (5,219–5,631) | n/a | $82.49 ($78.76–$86.29) | 6.2 (5.9–6.5) |
| daedalus-mcp | 180 | 0 (0–0) | 5,430 (5,220–5,627) | n/a | $82.49 ($78.84–$86.26) | 6.2 (5.9–6.5) |
| gate | 180 | 18 (5–35) | 5,968 (5,550–6,531) | n/a | $90.85 ($83.99–$99.47) | 6.8 (6.3–7.4) |
| **total** | 540 | 18 (5–35) | 16,824 (16,295–17,455) | n/a | $256 ($247–$266) | 19.2 (18.5–19.9) |

| Lanes | Wall hours (incl. pauses) | Wall days (P50) | 5-hour windows per account |
|---|---|---|---|
| 1 | 20.0 (19.3–20.8) | 0.8 | claude-code-cli: 4 (4–5) |
| 2 | 10.0 (9.7–10.4) | 0.4 | claude-code-cli: 2 (2–3) |

### plan.2models-k4.json

6 tasks × 4 steps × 3 runs × 2 models (claude-opus-5-5, claude-sonnet-5-5) × 3 arms (none, daedalus-mcp, gate). Bootstrap draws 2000, seed 20261016. Gate fire rate 11% (4%–18%). Pools: claude-opus-5-5 n=18, claude-sonnet-5-5 n=18.

Cells: P50 (P10–P90).

| Arm | Step calls | Repair calls | CLI agent turns | Tokens | USD (API-equiv., metered models only) | Model hours |
|---|---|---|---|---|---|---|
| none | 144 | 0 (0–0) | 4,345 (4,159–4,532) | n/a | $66.02 ($62.75–$69.42) | 4.9 (4.7–5.2) |
| daedalus-mcp | 144 | 0 (0–0) | 4,346 (4,152–4,525) | n/a | $66.02 ($62.68–$69.53) | 4.9 (4.7–5.2) |
| gate | 144 | 15 (5–28) | 4,786 (4,425–5,239) | n/a | $72.68 ($66.86–$79.83) | 5.4 (5.0–6.0) |
| **total** | 432 | 15 (5–28) | 13,476 (13,030–14,012) | n/a | $205 ($197–$214) | 15.3 (14.8–16.0) |

| Lanes | Wall hours (incl. pauses) | Wall days (P50) | 5-hour windows per account |
|---|---|---|---|
| 1 | 16.0 (15.4–16.7) | 0.7 | claude-code-cli: 4 (4–4) |
| 2 | 8.0 (7.7–8.4) | 0.3 | claude-code-cli: 2 (2–2) |

Assumptions:

- Each step turn and each repair turn draws one E1 generation of the same model id (cost, duration, agent turns jointly).
- Repair turns cost repairScale = 1 of a step turn; daedalus-mcp turns cost mcpScale = 1.
- Gate fire rate resampled from 28 floor-probe tool-arm pre-fix steps.
- Evaluator overhead per scoring: median E1 total_ms = 5374 ms; a fired gate step is scored twice.
- Lanes on one adapter share one account window; a window opens at the first call after the previous one ended.
- Window capacity (USD API-equivalent per 5 h): unbounded (windows spanned only); hypothetical, calls per window are unmeasured.
- A capped call pauses its lane until window end + 60 s (generator protocol §8). Interrupted-call waste is not modelled.
- Tokens: n/a (E1 envelopes with modelUsage are not committed). Codex has no metered USD.
- Infrastructure retries, failed-typecheck reruns and the self-review placebo arm are not modelled.

Cross-check: agent-proof extension turns (MCP attached, 6): wall 57–230 s, mean 128 s.

### Back-test on E1 (held-out half)

| Quantity (held-out half) | Actual | Forecast P50 (P10–P90) | Error of P50 | Actual in [P10, P90] |
|---|---|---|---|---|
| USD (Claude pooled) | $10.35 | $9.61 ($8.83–$10.41) | -7.1% | yes |
| generation hours (all pooled) | 1.24 | 1.19 (1.09–1.29) | -4.2% | yes |
| USD claude-haiku-4-5 | $1.45 | $2.01 ($1.65–$2.44) | 39.0% | no |
| generation hours claude-haiku-4-5 | 0.31 | 0.39 (0.33–0.47) | 25.9% | no |
| USD claude-opus-5-5 | $6.43 | $5.46 ($4.79–$6.08) | -15.0% | no |
| generation hours claude-opus-5-5 | 0.45 | 0.36 (0.32–0.40) | -20.3% | no |
| USD claude-sonnet-5-5 | $2.47 | $2.18 ($1.88–$2.46) | -12.0% | no |
| generation hours claude-sonnet-5-5 | 0.22 | 0.20 (0.17–0.22) | -11.0% | no |
| generation hours gpt-5.6-terra | 0.25 | 0.23 (0.18–0.27) | -8.4% | yes |

**Pass (pre-declared split, seed 20261016): yes** (the first two rows within ±20 %). Robustness: 82% of 200 further random splits pass.

