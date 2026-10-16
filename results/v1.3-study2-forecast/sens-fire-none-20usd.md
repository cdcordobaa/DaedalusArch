Telemetry: results/e1-grid/agg/runs.csv, results/e1-grid/agg/latency.csv, results/v1.3-floor-probe/summary.json, <branch v1.3-agent-proof>/examples/agent-proof-clinic/transcripts.

### plan.working.json

6 tasks × 5 steps × 3 runs × 3 models (claude-opus-5-5, claude-sonnet-5-5, gpt-5.6-terra) × 3 arms (none, daedalus-mcp, gate). Bootstrap draws 2000, seed 20261016. Gate fire rate 50% (39%–61%). Pools: claude-opus-5-5 n=18, claude-sonnet-5-5 n=18, gpt-5.6-terra n=18.

Cells: P50 (P10–P90).

| Arm | Step calls | Repair calls | CLI agent turns | Tokens | USD (API-equiv., metered models only) | Model hours |
|---|---|---|---|---|---|---|
| none | 270 | 0 (0–0) | 6,700 (6,493–6,917) | n/a | $82.53 ($78.85–$86.23) | 8.6 (8.3–8.9) |
| daedalus-mcp | 270 | 0 (0–0) | 6,697 (6,482–6,920) | n/a | $82.40 ($78.73–$86.25) | 8.6 (8.3–8.9) |
| gate | 270 | 135 (100–169) | 10,054 (9,138–10,930) | n/a | $124 ($112–$136) | 12.9 (11.7–14.0) |
| **total** | 810 | 135 (100–169) | 23,439 (22,513–24,377) | n/a | $289 ($276–$302) | 30.0 (28.8–31.3) |

| Lanes | Wall hours (incl. pauses) | Wall days (P50) | 5-hour windows per account |
|---|---|---|---|
| 1 | 74.5 (72.6–78.9) | 3.1 | claude-code-cli: 15 (15–16); codex-cli: 3 (3–3) |
| 2 | 72.4 (70.3–77.2) | 3.0 | claude-code-cli: 15 (15–16); codex-cli: 3 (3–3) |

Assumptions:

- Each step turn and each repair turn draws one E1 generation of the same model id (cost, duration, agent turns jointly).
- Repair turns cost repairScale = 1 of a step turn; daedalus-mcp turns cost mcpScale = 1.
- Gate fire rate resampled from 28 floor-probe none-arm steps.
- Evaluator overhead per scoring: median E1 total_ms = 5374 ms; a fired gate step is scored twice.
- Lanes on one adapter share one account window; a window opens at the first call after the previous one ended.
- Window capacity (USD API-equivalent per 5 h): {"claude-code-cli":20}; hypothetical, calls per window are unmeasured.
- A capped call pauses its lane until window end + 60 s (generator protocol §8). Interrupted-call waste is not modelled.
- Tokens: n/a (E1 envelopes with modelUsage are not committed). Codex has no metered USD.
- Infrastructure retries, failed-typecheck reruns and the self-review placebo arm are not modelled.

Cross-check: agent-proof extension turns (MCP attached, 6): wall 57–230 s, mean 128 s.

