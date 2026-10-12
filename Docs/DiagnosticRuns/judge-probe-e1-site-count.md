# Judge-probe site count over the 65 accepted E1 cells (ADR-037; label-free; 2026-10-11)

The count followed `Docs/DiagnosticRuns/judge-probe-e1-site-rule.md`, which was committed before it (`484c35b`). It ran `scripts/judge-probe-cli.ts prepare`, then `count`: the registered mutate tool, k = 1, split `held-out`, frozen catalogue. No detector output was read and no model was called. Manifest: `../daedalus-judgeprobe/manifest.json` (outside the repository).

| Operator | Rows (Claude / Codex) | 0 candidates | Candidates, all rejected |
|---|---|---|---|
| MO-X02 (seed, FF-N02) | **0** (0 / 0) | 59 | 3 cells: `not-removable-guard` (2 cells, 5 sites), `type-shape` (1 cell, 6 sites) |
| MO-X02n (twin) | 1 (1 / 0) | 60 | 1 cell: `judge-unit-not-selected` |
| MO-X03 (seed, FF-N01) | **0** (0 / 0) | 51 | 11 cells: `not-removable-guard` (7), `type-shape` (3), both (1) |
| MO-X03n (twin) | 11 (10 / 1) | 51 | — |

**Result.** The frozen judge-probe seed operators place **no site** in any of the 65 E1 cells, as they placed none on the 7 held-out corpus bases (2026-10-09). The only placeable rows are 12 twins in 11 cells: 10 Claude cells (haiku 5, opus 5) and 1 Codex cell. Their projected judge cost is 84 calls, under the cap of 300, so the cap rule takes every row.

**Reading.** The seed constructions need a boolean entity method that is used only as the condition of guard statements (`if (!e.m()) throw …`). The generated code validates inline, or uses methods that do more than return a boolean, or uses methods the type checker would not let be removed. Under the frozen operators the judge's detection rate cannot be measured on either population. Only the twin false-alarm rate can.
