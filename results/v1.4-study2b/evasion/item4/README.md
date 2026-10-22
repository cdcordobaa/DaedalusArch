# Study 2b evasion item 4: literal view (DA15)

This item is registered as pre-registration §4 "Evasion" item 4, and addendum 4 row DA15 fixes how it is computed. It is post hoc, with zero model calls, no Neo4j and no network. **Result: not flagged.**

## The bar

Evasion is flagged if a treated cell's mean per-block gap (literal − default D) exceeds `none@L2`'s by more than one identity. The bar was applied unchanged.

| Cell | Blocks | ΣD default | ΣD literal | Mean gap | Excess over `none@L2` | Flagged |
|---|---|---|---|---|---|---|
| `none@L2` (reference) | 40 | 110 | 110 | 0 | n/a | n/a |
| `none@L3` | 40 | 68 | 68 | 0 | 0 | no |
| `mcp@L2` | 40 | 53 | 53 | 0 | 0 | no |

The secondary reading, the step-5 count of counted identities (literal − default), has a mean gap of 0 in every cell. All 600 scored snapshots (520 distinct trees) have identical blocking edge sets under the two views.

## How it ran

1. **The driver.** `scripts/v1.4/study2b-literal-view.ts`, with its lib `scripts/v1.4/lib/literal-view.ts`. The sha256 of both files is in `driver.sha256`. It was recorded at 2026-10-22T04:08:29Z and pushed in commit `8f3dc895f`, before the driver ran on any 2b snapshot.
2. **The checkout.** It ran from a detached worktree of `v1.4-freeze-2026-10-20` (`4d28d280…`), with the two files copied in untracked, as the scoring pass did (runbook §6). The copies' hashes equal `driver.sha256`.
3. **The run.** It started after PR #347 (addendum 4) merged. The registered hash files were verified OK first. Times (UTC) and the per-snapshot lines are in `run.log`: 04:29:01Z to 04:34:50Z, exit 0.
4. **The literal view** is the extractor's own (ADR-V13-01), selected as `scripts/v1.3/default-view-coverage.ts` selects it: `IMPORTS` edges without `viaReExport`, plus `RE_EXPORTS`.
   - The in-process graph is injected through `PipelineConfig.graphRepository`, so no frozen file changes.
   - That graph does not ingest the `viaReExport` edges, and it clears `reExportHop` on the rest. So every template reads the literal graph.
   - Over all snapshots this dropped 62 resolved-only edges and cleared 0 hop flags.
   - The default scoring already reads the literal view for FF-S01, FF-S02 and FF-S03 (`TEMPLATE_EDGE_VIEWS`). So a zero gap on these rules is the expected reading, and here it is confirmed on the data.
5. **D on both views.** Each snapshot is evaluated twice (default, then literal) with the registered wiring, check-correct and the same identity rule (`driftRun`, `STUDY2_S2D01`).
   - **Interpretation (DA15 leaves it open).** D needs every step, so steps 1–5 are re-scored, the step-5 snapshots included, and the step-5 count gap is reported beside the D gap.
6. **Reproduction check.** The driver's default D equals the committed registered D (`score/rescore/runs.json`) in 120 of 120 runs.

## Files

- `summary.json`: per-cell gaps, the bar, the literal-graph counters and the reproduction check.
- `blocks.json`: the per-block gaps, and D, Y₁ and Yₖ under both views.
- `snapshots.json`: per snapshot, the default and literal blocking rows.
- `run.log` and `driver.sha256`.

Out-root paths are written as `<out-root:cell>`.
