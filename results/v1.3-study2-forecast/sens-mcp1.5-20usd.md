Telemetry: results/e1-grid/agg/runs.csv, results/e1-grid/agg/latency.csv, results/v1.3-floor-probe/summary.json, <branch v1.3-agent-proof>/examples/agent-proof-clinic/transcripts.

### plan.working.json

6 tasks × 5 steps × 3 runs × 3 models (claude-opus-5-5, claude-sonnet-5-5, gpt-5.6-terra) × 3 arms (none, daedalus-mcp, gate). Bootstrap draws 2000, seed 20261016. Gate fire rate 11% (4%–18%). Pools: claude-opus-5-5 n=18, claude-sonnet-5-5 n=18, gpt-5.6-terra n=18.

Cells: P50 (P10–P90).

| Arm | Step calls | Repair calls | CLI agent turns | Tokens | USD (API-equiv., metered models only) | Model hours |
|---|---|---|---|---|---|---|
| none | 270 | 0 (0–0) | 6,702 (6,495–6,914) | n/a | $82.49 ($78.85–$86.32) | 8.6 (8.3–8.9) |
| daedalus-mcp | 270 | 0 (0–0) | 10,058 (9,724–10,371) | n/a | $124 ($118–$129) | 12.9 (12.4–13.3) |
| gate | 270 | 27 (9–51) | 7,360 (6,864–8,017) | n/a | $90.74 ($83.92–$99.45) | 9.4 (8.8–10.3) |
| **total** | 810 | 27 (9–51) | 24,142 (23,472–24,866) | n/a | $298 ($288–$309) | 30.9 (30.0–31.9) |

| Lanes | Wall hours (incl. pauses) | Wall days (P50) | 5-hour windows per account |
|---|---|---|---|
| 1 | 78.6 (74.4–79.7) | 3.3 | claude-code-cli: 16 (15–16); codex-cli: 3 (3–3) |
| 2 | 76.9 (72.4–77.5) | 3.2 | claude-code-cli: 16 (15–16); codex-cli: 3 (3–3) |

Assumptions:

- Each step turn and each repair turn draws one E1 generation of the same model id (cost, duration, agent turns jointly).
- Repair turns cost repairScale = 1 of a step turn; daedalus-mcp turns cost mcpScale = 1.5.
- Gate fire rate resampled from 28 floor-probe tool-arm pre-fix steps.
- Evaluator overhead per scoring: median E1 total_ms = 5374 ms; a fired gate step is scored twice.
- Lanes on one adapter share one account window; a window opens at the first call after the previous one ended.
- Window capacity (USD API-equivalent per 5 h): {"claude-code-cli":20}; hypothetical, calls per window are unmeasured.
- A capped call pauses its lane until window end + 60 s (generator protocol §8). Interrupted-call waste is not modelled.
- Tokens: n/a (E1 envelopes with modelUsage are not committed). Codex has no metered USD.
- Infrastructure retries, failed-typecheck reruns and the self-review placebo arm are not modelled.

Cross-check: agent-proof extension turns (MCP attached, 6): wall 57–230 s, mean 128 s.

