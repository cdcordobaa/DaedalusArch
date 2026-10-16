# Merge train MT6 (v1.3), 2026-10-16

Scheduled run, under the author's instruction of 2026-10-16 13:50 UTC ("Yes please unblock everything. We need to start aggregating everything we have."). **The train stopped early.** After the third merge, the agent's permission layer refused to merge v1.3 into the next held PR (#159), on the ground of merging without review. The agent did not work around the refusal. All other PRs were left as they were, so the author can confirm and run the rest of the train.

## Merged

| PR | Branch | Merge | Checks | Notes |
|---|---|---|---|---|
| — | `v1.3` (direct commit `f8e77081`) | — | `tsc -p tsconfig.scripts.json` went from 7 errors to 0; the 4 affected suites pass (37 tests) | This fixed scripts-tsc errors already on v1.3: `snapshot-measures.ts` (#197; `import.meta` under CommonJS, tuple reduce), `unseal-tasks.ts` (`import.meta`), `known-groups.ts` (an unused parameter) and the `external-correctness` test fixtures (`exactOptionalPropertyTypes`). It changed no behaviour. The two entry scripts now take the repository root from `process.cwd()`, like the other `scripts/v1.3` entry scripts. |
| #133 | `v1.3-external-set` | `8be52f11` | app and scripts tsc pass; jest `tests/unit/scripts/v1.3/external*` 9/9; no `src/` change | **D-a** applied: `conduit` stays in the set and is added to §5 Limitations, and the #149 §9 errata 1–2 are applied to §4 (`evaluate` uses `V13_DEFAULT_OPTIONS`, so the literal-view templates read the exact graph; the §3 findings are not from the routed graph). `[hold]` was removed from the title. |
| #181 | `v1.3-external-set-2` | `ea527b03` | tsc passes; jest 9/9; no `src/` change | It needed #133, which was merged first. `[hold]` was removed. |
| #232 | `v1.3-external-set-3` | `14a36095` | tsc passes; jest 9/9; no `src/` change | One add/add conflict, in `tests/unit/scripts/v1.3/external-correctness.test.ts`: both sides fixed the same tsc error, and the PR's version was kept. |

#167 (an ordering dependency of #133) was already merged before MT6. #197, #135 and #138 were already merged too, so there was nothing to close.

No `src/` change was merged, so no 71/71 reference diff was needed. The baseline run on v1.3 before the train (`ue-baseline-live --engine cypher-interp`, Neo4j variables unset) was byte-identical to `results/v1.3-reference/after-member-facts`: `raw/` 71/71, plus `report.json` and `report.md`.

## Not merged: left open, untouched by MT6

None of these got a merge, a comment or a title change.

- **Decision PRs:** #159 (D-b, review fixes R01..R31), #170 (pilot run) and #229 (T1 options, stacked on `v1.3-pilot-run`; D-c).
- **Stacked:** #236 (base `v1.3-replication-2`, which is already fully merged into v1.3, so it only needs to be retargeted to `v1.3`) and #213 (it carries local merges of #139 and #133; #133 is now in).
- **Held:** #139, #151, #156, #164, #171, #173, #180, #188, #189, #196, #203, #204, #206, #210, #212, #220, #228 and #235.
- **v1.2e-targeted drafts**, not to be closed: #75, #77 and #80.

## Decisions

- **D-a was applied** (#133) and is recorded as row 10 of `Docs/v1.3/decision-chronology.md`.
- **D-b and D-c were not applied.** They are delegated, but their PRs were not reached. Nothing in the frozen report schema, the filter-explain default or the T1 options was changed.

## To resume

Confirm, in a live session, that the held PRs may be merged without a further review. Then re-run the train from #159, in the order set in the MT6 prompt: #159, then #170 and #229 (retarget #229 to `v1.3`), then #139 and #213, then the rest, ending with #236 retargeted to `v1.3`.
