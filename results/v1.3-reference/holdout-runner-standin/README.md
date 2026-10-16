# holdout-run.ts on the development set (stand-in)

**Not a hold-out result and not a validity figure.** This is the end-to-end test of `scripts/v1.3/holdout-run.ts` on
the development reference set (`tests/fixtures/v1.3-reference`), which stands in for a sealed hold-out directory. No
sealed data exists in the repository or was read.

```
NEO4J_URI=bolt://127.0.0.1:7687 NEO4J_PASSWORD=... npx tsx scripts/v1.3/holdout-run.ts --development-stand-in \
  --commit HEAD --holdout tests/fixtures/v1.3-reference --out results/v1.3-reference/holdout-runner-standin/run-1 --deferred FF-DS01
```

- Tool commit: the freeze check passed at `31bd06f3` (working tree equal in src/, scripts/, presets/, specs/).
- Pipeline: `ue-baseline-live.ts --root` (one local Neo4j 5.26 community with APOC core, the cross-process lock held),
  `ue-graph.ts --root`, `check-correct` on the blocking findings, then the prespec §3–§5 scoring.
- `--deferred FF-DS01` exercises the deferred-rule path (Q15); it is an example, not a freeze decision.
- Determinism: an earlier live run of the same tool code (before the analysis-script commits) gave identical raw rows
  for all 71 variants (`--determinism`).
- Every style is "validated at point estimate" only: with n = 8–13 expected blocking findings per style, the 95% Wilson
  lower bound cannot reach 0.90 even with no error (n ≥ 35 needed), as the prespec says in §5.
