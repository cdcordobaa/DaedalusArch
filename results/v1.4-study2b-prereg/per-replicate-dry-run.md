# Per-replicate run order on the frozen harness: zero-call dry run (2026-10-20)

Pre-registration `Docs/v1.4/study2b-preregistration.md` §2 (Fable review finding 4, DELEG9). **Practice task only (the rehearsal's `ice-rink`), `--dry-run`: no model, no Neo4j.**

**Question.** Can the frozen harness run 2b replicate by replicate (fill R = 1 plans for replicate r; `none@L2` r; then `none@L3` r and `mcp@L2` r in two lanes, branching from replicate r's `none@L2` out-root) with no change under `scripts/` except the additive plan filler?

**How.** `study2b-plans.ts --replicate r` sets the harness's own `firstRun` (present at the tag in `scripts/lib/loop/plan.ts`: "a plan can run replicate 2 alone") to r − 1, `runs` to 1, and gives `sharedStart.fromOutRoot` its single-string form (one root for the replicate). Each replicate gets fresh out-roots (`claimSchedule` refuses an out-root that belongs to another plan). Then, for r = 1 and 2, `loop-harness-cli.ts --dry-run`: `none@L2` into `l2/r<r>`, then `none@L3` and `mcp@L2` at once into `l3/r<r>` and `mcp/r<r>`, each with `--shared-start-from l2/r<r>`.

**Result.**

| Replicate | Plan | `runs` | `firstRun` | `sharedStart.fromOutRoot` | maxCalls |
|---|---|---|---|---|---|
| 1 | none-L2 / none-L3 / mcp-L2 | 1 | 0 | — / `<local>` / `<local>` | 5 / 4 / 4 |
| 2 | none-L2 / none-L3 / mcp-L2 | 1 | 1 | — / `<local>` / `<local>` | 5 / 4 / 4 |

| Out-root | Run id | Run index | Shared start from |
|---|---|---|---|
| `l2/r1` | `…/ice-rink/none/run-0` | 0 | — |
| `l2/r2` | `…/ice-rink/none/run-1` | 1 | — |
| `l3/r1` | `…/ice-rink/none/run-0` | 0 | `…/ice-rink/none/run-0` |
| `l3/r2` | `…/ice-rink/none/run-1` | 1 | `…/ice-rink/none/run-1` |
| `mcp/r1` | `…/ice-rink/daedalus-mcp/run-0` | 0 | `…/ice-rink/none/run-0` |
| `mcp/r2` | `…/ice-rink/daedalus-mcp/run-1` | 1 | `…/ice-rink/none/run-1` |

All six dry runs completed. The run index (and so the replicate `rep = runIndex + 1` that `stage-c-rescore.ts` and `d-dagger.ts` read) is distinct per replicate, and each branch cell takes its step 1 from the same replicate. Scoring takes the ten out-roots of a cell as repeated `--cell <cell>=<out-root>` arguments, as Stage C already did for `none@L2`. **Yes: no `scripts/` change beyond the additive `--replicate` option.**
