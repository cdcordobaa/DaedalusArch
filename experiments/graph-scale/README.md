# GRAPH-SCALE (v1.5-exp, U1 groundwork, zero model calls)

The DETECT-02 comprehension graph made complete and precise on large real trees, measured against compiler truth.
Plan: `aidlc-docs/construction/v1.5/u1-graph-scale-plan.md`. Report: `Docs/DiagnosticRuns/graph-scale-2026-10-23.md`.

The fixes live in `experiments/detect-02/` (the comprehension index and tools; the DETECT-02 rules still read
`lib/facts.ts`, unchanged):

| Fix | Where |
|---|---|
| (a) factory and callback units | `mcp/comprehend/index.ts` (`factoryCall`) |
| (b) receiver-aware calls, overloads to the implementation | `mcp/comprehend/index.ts` (`memberCalls`, `CallEdge.receiver`) |
| (c) `callers(port_or_method)` | `mcp/comprehend/tools.ts` (`callers`, `callerSites`); `mcp/comprehend-server.ts` with `withCallers` / `--with-callers` |
| (d) inferred entities, populated `who_writes` | `mcp/comprehend/entities.ts`; `tools.ts` (`whoWrites`, `entityWriteSites`) |
| (e) inline `import('./X').X` types | `lib/import-types.ts`; the index's import graph; `coverage.ts` here |

Unit tests: `npx tsx --test experiments/detect-02/mcp/comprehend/graph-scale.test.ts` (fixture tree
`experiments/detect-02/fixtures/graph-scale/tree`) and `.../tools.test.ts`.

This folder holds the measurement:

| File | What |
|---|---|
| `questions/<repo>.json` | 3 new questions per repository (callers of a port; writers of an entity), committed before any fix |
| `compare.ts` | truth (`experiments/repo-scout/truth.ts`, unchanged) against the index, `callers`, `who_writes`, `impact`, `trace`; runs on any checkout (a missing tool is `n/a`) |
| `coverage.ts` | frozen extractor literal view against tsc, before and after the import-type edges |
| `table.mjs` | the before/after tables and `results/summary.json` |
| `results/` | `before-<repo>.json` (base commit `4d800850`, from a worktree), `after-<repo>.json`, `coverage-<repo>.json`, `regression.json` |

Clones (outside this repository, never committed) at the scout's pins in `experiments/repo-scout/candidates-new.json`
(Backstage `d72327203d5d`, Novu `894d63ff5252`, Medusa `6cc1a4acab6d`), with the scout's harness tsconfigs
(`experiments/repo-scout/measure.ts` with `SCOUT_NO_TSC=1`; Novu's root tsconfig as in `experiments/repo-scout/README.md`).
Medusa needs `yarn install --mode=skip-build` and `turbo run build --filter=@medusajs/product --filter=@medusajs/core-flows`
(as the scout did; without them its truth for MD-C1 drops from 33 to 22 sites).

```bash
C=<scratch>/clones
for r in backstage novu medusa; do
  ts=tsconfig.scout.json; [ $r = novu ] && ts=tsconfig.scout-root.json
  NODE_OPTIONS=--max-old-space-size=7000 npx tsx experiments/graph-scale/compare.ts --tree $C/$r --tsconfig $C/$r/$ts \
    --spec experiments/repo-scout/specs/$r.yaml \
    --questions experiments/repo-scout/questions/$r.json,experiments/graph-scale/questions/$r.json \
    --out experiments/graph-scale/results/after-$r.json
  npx tsx experiments/graph-scale/coverage.ts $C/$r $C/$r/$ts experiments/graph-scale/results/coverage-$r.json
done
# before: the same compare.ts copied into a worktree of 4d800850, --out .../before-$r.json
node experiments/graph-scale/table.mjs
```
