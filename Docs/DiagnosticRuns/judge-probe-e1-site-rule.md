# Judge-probe sites in the E1 cells: the pre-stated count and k rule (ADR-037, written before the count)

**Date**: 2026-10-11. **Status**: written and committed **before** any site count on an E1 cell (author decision of 2026-10-11, relayed by the coordinator: use the frozen MO-X02/MO-X03 operators and their twins, with the E1 generated projects as the base population, because the seven held-out corpus bases hold no site). It is label-free: no detector output, no judge verdict and no model call is read or made. The only judge-related input is the label-free baseline unit selection (unit ids and their files), the stated BR-U5a-06 exception.

## Why the base population changed

The registered SO4 mutate run (`../daedalus-so4/manifest.json`, k = 2, 2026-10-09) placed **0 MO-X02 and 0 MO-X03 seeds** on the seven held-out bases. All 14 were `no-site`: five bases had 0 candidates, and nestjslatam's 112 MO-X02 and 7 MO-X03 candidates were all `not-removable-guard`. MO-X03n placed 0 twins and MO-X02n 8. A label-free count on the five fixtures gives 3 seeds and 9 twins. The frozen operators target a pattern the corpus does not have: an entity boolean guard method used only as the condition of a guard statement.

## Population

The **65 accepted E1 cells** of the registered `e1-grid` run (`results/e1-grid/runs/*.run.json`, status `accepted`): 54 Claude cells and the Codex cells that were accepted. The tree is the cell directory under `../daedalus-e1-outcomes`, which is never written.

## Base preparation (one per cell; `scripts/judge-probe.ts prepare`)

- **Staging copy** `../daedalus-judgeprobe/bases/<cellId>/`: the cell's `src/` and `package.json`, plus the `node_modules` symlink to the pinned skeleton install. The generation transcripts `envelope.json` and `generation.json` are not copied.
- **`tsconfig.json`**: the generator-protocol §3 tsconfig (ADR-032) with relative paths (`include` `src/**/*.ts`, `typeRoots` `./node_modules/@types`). It holds the same options and the same file set as the absolute §3 file the E1 evaluation used. An agent-written `tsconfig.json` (9 haiku cells) is replaced in the staging copy only, as ADR-032 ignores it.
- **PreparedBase**: `baseKind` `generated`. `baseGenerationTreeSha` is the sha1 over the sorted (path, sha1 of content) lines of `src/**`. `tscPath` is the skeleton's `typescript/lib/tsc.js` (5.9.3, the type-check of record), and `specPath` is `specs/clean-arch.yaml` (the E1 evaluator spec). `judgeSelection` is the cell's registered E1 report projected by `store-baseline-selection` (BR-U5a-27).

## The count (`scripts/judge-probe.ts count`)

For every cell and each of **MO-X02, MO-X02n, MO-X03, MO-X03n** (frozen catalogue, unchanged): `mutate.ts --base <prepared.json> --spec specs/clean-arch.yaml --operator <op> --manifest ../daedalus-judgeprobe/manifest.json --out ../daedalus-judgeprobe/copies --split held-out --k 1`. The registered site sampling and preconditions apply, including the mutant type-check gate and the BR-U5a-27 placement rule. The result is one row or one rejection per (cell, operator).

## k rule (fixed now)

- **k = 1** site per operator per cell. Sites of one operator in one cell share units, so they are not independent; one per cell keeps the cell as the unit.
- **Projected judge calls of a row** = 1 (the judge init probe of the run) + 3 × Σ over FF-N01 and FF-N02 of (the baseline-selected units that contain an edited file + the created files). Unchanged units replay from the E1 cassettes at no cost.
- **Cap 300.** If the projected total over all placed rows is at most 300, every row is taken. Otherwise **whole cells** (all their placed rows together) are taken in a seeded order. Within each vendor (`openai` = Codex, `anthropic` = Claude) the cells with at least one placed row are shuffled with mulberry32(**9501**), in sorted order first. The vendors are then taken alternately, Codex first. A cell is added when the running projected total stays at most 300; a cell that does not fit is skipped and the next one is tried, until no cell fits. This keeps the two vendors as balanced as the sites allow.
- The count, the rejections by reason and the chosen sample are recorded in `Docs/DiagnosticRuns/judge-probe-e1-site-count.md` and in the plan, before registration (ADR-037).
