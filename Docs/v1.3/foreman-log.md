# v1.3 night foreman log

## 2026-10-16, 04:40–06:50 UTC (scheduled run)

The foreman checked out each open PR into `v1.3` that the merge trains had skipped. For each one it merged `origin/v1.3` into the PR branch, resolved the conflicts, re-ran the gates and pushed a normal (non-force) push. It did not merge anything into `v1.3`, and it did not touch `main` or `v1.2e`. It did not edit any Cypher template text, rule tier, frozen v1.2E artefact, `src/llm-critic/frozen.ts` or `Docs/judge-preregistration.md`. No PR title said "hold".

### Gates (every pushed head)

- `npx tsc --noEmit` and `tsc -p tsconfig.scripts.json` (plus `tsconfig.u0-tests.json` for MCP PRs).
- jest with `--maxWorkers` set to 2 or 3, on the suites the PR touches. #159 got the full suite.
- `scripts/v1.3/ue-baseline-live.ts --engine cypher-interp` with no Neo4j variables set. Then `raw/` (71 files), `report.json` and `report.md` were diffed against `results/v1.3-reference/after-member-facts`. **Every pushed head was byte-identical.**

The full jest run on origin/v1.3 itself (d65fddbb) gives 6 failures in 5 suites:
- `llm-critic/replay-no-binary`
- `scripts/generators/skeleton` (npm offline)
- `scripts/mutation/expected` (BR-U5a-19: `scripts/v1.3/lib/construct-rescore.ts` calls `compileFunctions` without `compilerInputFromSpec`)
- `scripts/u5b/guards`
- `scripts/u5b/score-golden-acceptance` (shallow history)

The foreman counted none of these against a PR.

### Pushed (merge of origin/v1.3, gates green)

| PR | Head | What was resolved |
|---|---|---|
| #150 init-infer | 22364608 | MCP: `propose_spec` kept next to `infer_spec`, `explain_finding` and the `--neural` tools (11 `TOOL_NAMES`). **Decide:** keep both `infer_spec` and `propose_spec`, or fold one into the other. |
| #143 fix-hints | 4623b986 | Fix hints threaded through the MCP v2 file-check (`BaseViolation.hint`), the delta `check_diff`, `--hints` with `--engine` and `--neural`. No test yet covers hints in delta mode. |
| #156 agent-proof | 4e83ed1f | The per-call `tsconfigPath` wins over the server-wide `--tsconfig`. `--engine`, `--tsconfig` and `--neural` all parse. |
| #135 npx | dd32e060 | **Race:** the train merged fe02977e while the foreman pushed. The only commit not yet in v1.3 is bba3cfc8, which makes the cypher-interp path of `evaluate_project` honour `includeViolations`. v1.3 currently has this gap. |
| #159 review-fixes-2 | d7a9fbb0 | R01 snapshot tsconfig kept, with #142's `includeViolations` added. Full jest: only the 6 failures above. **Blocked since then; see below.** |
| #134 blind-misses, #131 fidelity-adjudication | b1430f96, f787ea9a | audit.md only. Both have since been merged by the train. |
| #168, #141, #155, #138, #130 | 4245179a, e853a8ba, fecf704f, 32763d1f, 468f645b | audit.md only. |
| #140 html-report, #139 advisory-noise | 5f7b6741, f904d16a | CLI options kept on top of v1.3's positional-project `evaluate` signature. `PipelineConfig` keeps `advisoryFilter` and `graphEngine`. |
| #137 devset-expansion | 6445749f | `ue-baseline-live.ts`: `--engine` stripping combined with `--set devset-b`. The eslint ignores are the union of both sides. |
| #160 study2-analysis-rehearsal | 962c228a | One test fix: #142 added `advisoryByRule` to harness step records, so the format test now runs with the existing `advisoryByRule: true` option. The default and the committed rehearsal are unchanged. **Decide:** whether the default should now be on. |

### Not pushed

- **#159 review-fixes-2, and #170 pilot-run, which contains it.** After #157 landed, both sides had implemented R19 and R20 in `src/llm-critic/filter-explain.ts` independently.
  - R19 is equivalent on both sides.
  - R20 is not. v1.3 (#157) changed the **default** grounding of bare `line N` references (`checkTextReferences`, always on). #159 keeps "longest file" as the default and makes the new check **opt-in** (`bareLines`).
  - The author has to pick one; the options are listed on #159. The foreman aborted the merge.
- **#162 operators-hexddd and #170 pilot-run:** another session merged `v1.3` into them while the foreman worked. The foreman's duplicate commits were dropped.

### State at 06:50 UTC (v1.3 at a893b0eb, after the late train merged #157, #158, #161, #135, #134, #166)

- **Merges cleanly:** #175, #174, #173, #172, #169, #167, #165, #164, #162, #154, #150, #149, #147, #146, #144, #139, #136, #135, #133, #131.
- **audit.md conflict only:** #177, #176, #171, #168, #160, #155, #151, #141, #140, #138, #137, #130.
- **Code conflicts:**
  - #170 and #159: filter-explain R20, author decision needed.
  - #156: `src/mcp-server/context.ts`, `src/mcp-server/evaluate-project.ts`, against #135.
  - #145: `src/mcp-server/server.ts`, `src/mcp-server/tools.ts`.
  - #143: `src/cli/cli.ts`, `src/mcp-server/context.ts`, `src/mcp-server/server.ts`, `src/mcp-server/tools.ts`, against #135.

### Recommendation

Every train merge appends to `aidlc-docs/audit.md`, so almost every open PR conflicts again after each train. In this run, most of the re-merges were needed only because of that file.

Each run's resolution has been "keep both sides' entries". A `.gitattributes` line `aidlc-docs/audit.md merge=union` would let git do that automatically. Alternatively, each job could write its own file under `aidlc-docs/audit/`. Either way, merge trains would stop skipping documentation-only PRs. Both options are left to the author.
