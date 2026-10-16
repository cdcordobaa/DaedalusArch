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
| #134 blind-misses, #131 fidelity-adjudication | b1430f96, f787ea9a | audit.md only. #134 has since been merged by the train; #131 is still open (do not merge until the author has reviewed it). |
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

## 2026-10-16, 06:07–08:55 UTC (scheduled run, round 2)

Round 2 overlapped the end of round 1 (until 06:50) and the late merge train, which merged ten PRs during the run. v1.3 moved from 3292ebed to f0939a48. Round 2 merged nothing into `v1.3`, did not force-push, and did not touch `main` or `v1.2e`. It edited no Cypher template text, tier, frozen v1.2E artefact or frozen judge file, and read no `.env`, secret or sealed directory.

**Hold.** Between about 08:20 and 08:37 UTC, every open PR from #130 to #201 was retitled `[hold] …`. From then on the foreman pushed nothing more to those PRs and stopped its workers. The only non-hold PRs left are #202–#210.

**Review comments.** No open PR has a review, a review comment, or an issue comment listing concrete defects. The only comments are foreman status notes. So no defect fixes were made under step 2.

### Gates

- `tsc --noEmit`, `-p tsconfig.u0-tests.json` and `-p tsconfig.scripts.json`.
- `jest --maxWorkers=2` on the affected suites.
- `ue-baseline-live --engine cypher-interp` (no Neo4j variables), with `raw/` (71 files), `report.json` and `report.md` diffed against `results/v1.3-reference/after-member-facts`.

**v1.3 itself at 60a4fed1:** tsc clean and byte-identical (71/71).

**Environment fix.** `playwright-core` (a devDependency #140 added) was missing from the shared `node_modules`, so `tsc -p tsconfig.scripts.json` failed on `scripts/v1.3/html-report-screenshots.ts` on v1.3 too. After `npm install --no-save playwright-core@1.56.1` it is clean. CI and local checkouts need a fresh `npm ci`.

### Pushed in round 2 (gates green on the pushed head)

| PR | Head | What was resolved |
|---|---|---|
| #206 grid-scale-replay | eb5567a8 | `evaluate-project.ts`: v1.3's #135 follow-up and this branch both pass `includeViolations` on the cypher-interp path. Kept the branch's version, which also forwards `tsconfigPath`. jest 311/311; bytes 71/71. |
| #151 interp-review-fixes | 2f3e79a8 | Two `CALL { … UNION … }` implementations, reduced to one, based on v1.3's: it supports importing `WITH` and dedups only with 2 or more parts. Kept the branch's per-row `tick` timeout, the uncorrelated-once optimisation and the parse-time column check. jest cypher-interp 255/255; bytes 71/71. **Decide:** whether importing `WITH` should be rejected again; that would be a v1.3 change. The branch has moved since (3ff49656). |
| #135 npx | 48b8ca98 | The PR now carries only bba3cfc8 (`includeViolations` on cypher-interp). The train merged that as cd0762c2. **#135 can be closed.** |
| #150 init-infer | d37ef196 | `cli.ts`: optional `--spec`/`--from-inferred` on top of v1.3's positional project; the stdio test now expects 11 tools. The train merged it (5f52a9f6). **Check:** v1.3's `--html` with `--from-inferred` (`specPath` may be undefined). |
| #159 review-fixes-2 | d2c932b1 | R19: took v1.3's #157 API. R20: kept v1.3's default and added `GroundingOptions.bareLines` (`attributed` default, `longest`, `finding-file`). **Decide:** rescoring the committed filter-explain plan with the new default changes 3 rows (same summary); `longest` reproduces `scores.json`. #159 now conflicts again after #143; that is unresolved and left alone under hold. |
| #139 advisory-noise | afb44917 | `cli.ts`, `pipeline/types.ts`, `shared/types/evaluation.ts`: kept both sides. The frozen report schema `$comment` now lists both 2026-10-16 amendments. **Confirm** that wording. jest 483/483; bytes 71/71 on d28455e8; the last merge was clean and touched only `evaluate-project.ts`. |

### Resolved but not pushed (superseded, merged by the train, or put on hold)

- **#143, #140, #137, #138, #183:** the train merged them while they were being resolved. #138's branch adds only a 6-line `audit.md` entry beyond v1.3, so **#138 can be closed**.
- **#176:** round 1 or another session pushed an equivalent resolution. Nothing to add.
- **#156 agent-proof (621a2b40, gates green, not pushed, now on hold):** keeps v1.3's engine resolution, so the branch's `DAEDALUS_ENGINE` is no longer read. Keeps `--tsconfig` / `DAEDALUS_TSCONFIG` on both paths (needs `tsconfigPath` in `interp-evaluator.ts`), plus `--hints`.
- **#145 rule-mining (9031d4e8, not fully gated, now on hold):** `propose_rules` is registered after v1.3's 11 tools, and only with `--rule-mining`. The schema is renamed `proposeRulesShape`.
- **#188 scale (192b69ba, bytes 71/71 on an earlier head, now on hold):** `extractAPG(..., limits, sourceOverrides)`. **Decide:** the graph accelerator is not stacked on the in-process interpreter.
- **#170, #185:** same resolutions as #159 / `ExtractCommand` argument order. Gated on earlier v1.3 tips; not pushed (on hold).
- **audit.md-only re-merges** (#130, #141, #155, #160, #168, #171, #177, #180, #186, #189): dropped. Round 1 and author sessions pushed newer heads, and all are now on hold.

### Incidents

- **Race with round 1.** Round 1 was still running and pushed audit-only merges at 06:47 to the same branches. Round 2's duplicate local merges were discarded, and no non-fast-forward push was attempted.
- **Killed gates.** A worker ran `pkill -f ue-baseline-live` at about 07:50 and killed other byte-gate runs. All of them were re-run before any push that relied on them.
- **Trailer formatting.** On some merge commits, `# Conflicts` lines follow the `Co-Authored-By` trailer. None were amended.

### State at 08:50 UTC (v1.3 at f0939a48)

Non-hold PRs #202–#210 all merge cleanly. #206 conflicted and is fixed above. Every `[hold]` PR was left as it is.

The `audit.md` recommendation above still stands: almost every re-merge tonight was caused by that file alone.
