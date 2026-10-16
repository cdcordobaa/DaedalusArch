# Study 2 budget forecast (tooling output, not a result)

Written by `scripts/v1.3/study2-forecast.ts` from committed telemetry; model, pass criterion and reading in
`Docs/v1.3/study2-forecast.md`. No model call, no sealed input: the task count and steps are plan numbers.

| File | Plans | Options |
|---|---|---|
| `unbounded.md/json` | working, 2models, 2models-k4 | no cap; with `--backtest` |
| `window-40usd.md/json` | same | `--window-usd claude-code-cli=40` |
| `window-20usd.md/json` | same | `--window-usd claude-code-cli=20` |
| `sens-fire-none-20usd.md/json` | working | `--fire-source none --window-usd claude-code-cli=20` |
| `sens-mcp1.5-20usd.md/json` | working | `--mcp-scale 1.5 --window-usd claude-code-cli=20` |

Agent-proof `.meta` paths are recorded as `<branch v1.3-agent-proof>/…` (extracted to a scratch dir with `git archive`).
