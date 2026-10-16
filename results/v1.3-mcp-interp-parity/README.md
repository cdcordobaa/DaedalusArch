# MCP blocking parity through the interpreter (backlog V1): evidence

Development set, exploratory. Design and pass criterion: `Docs/v1.3/mcp-interp-parity.md`.

- `consistency-interp/`: `npx tsx scripts/v1.3/mcp-consistency.ts --fast-rules-engine cypher-interp --check --out results/v1.3-mcp-interp-parity/consistency-interp` (exit 0).
- `latency/`: `npx tsx scripts/v1.3/mcp-interp-latency.ts --reps 10 --out results/v1.3-mcp-interp-parity/latency`.
- `replay-142/`: the `daedalus-mcp` feedback rows (`mcpFeedback` of `scripts/lib/loop/replay-verify.ts`) of the #142 scripted replay, fast path (`mcp-feedback-fast.json`) and option on (`mcp-feedback-interp.json`). It was run in a scratch merge of `origin/v1.3-loop-replay` (#142, unmerged) and this branch, with the evaluator injected on the interpreter (no Neo4j here). `probe.patch.txt` holds the two uncommitted probe changes: the replay's tool context reads `DAEDALUS_FAST_RULES_ENGINE`, and the driver script. Reproduce: merge both branches, apply the patch, then run `npx tsx probe-replay.ts` with and without `DAEDALUS_FAST_RULES_ENGINE=cypher-interp`.
