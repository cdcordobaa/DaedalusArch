# Merge train MT7 (v1.3), 2026-10-16

This train ran in a live session. The author approved it explicitly on 2026-10-16 at about 15:55 UTC, so that the completed work is merged. The standing rule also applies: non-critical PRs are merged into v1.3. MT7 resumed where MT6 stopped (`Docs/v1.3/merge-train-mt6.md`) and used the MT6 order: #159, #170, #229 (retargeted to `v1.3`), #139, #213, then the rest, and finally #236 (retargeted to `v1.3`).

**Result: all 23 PRs were merged. None was skipped.** The compendium PR (#246) was already merged before MT7 began.

**How each PR was handled:**
- `origin/v1.3` was fetched fresh and merged into the PR branch, in a scratch worktree.
- Both tsc configs were run: `tsc --noEmit` and `-p tsconfig.scripts.json`.
- jest (`--maxWorkers=2`) was run on the PR's tests and on the tests of every module it touched.
- When the PR touched `src/`, or the reference script itself, the reference check was run: `ue-baseline-live --engine cypher-interp` with every `NEO4J_*` variable unset, compared byte for byte with `results/v1.3-reference/after-member-facts`. `raw/` had to match 71/71, and `report.json` and `report.md` had to match too.

**Constraints:** one build/test lane at a time, and no Neo4j.

**The reference output never changed.** The baseline before the train, every per-PR run and the final run on the tip (`22e6436a`) were all byte-identical.

## Merged

| PR | Branch | Merge | Checks | Notes |
|---|---|---|---|---|
| #159 | `v1.3-review-fixes-2` | `14772a03` | tsc ✓/✓; jest 126 suites (1,679 tests) ✓ after one fix; ref 71/71 ✓ | **D-b** applied (row 11 of `decision-chronology.md`). 9 conflicts:<br>• eslint ignores, report-schema `$comment`, CLI options: both sides kept.<br>• `ExtractCommand` takes `resolvedEdgesInLiteralView` before the extractor defaults.<br>• Loop `main`: v1.3's engine-tee evaluator, which carries its own R01 tsconfig fix, plus `gateEvaluationFailures`.<br>• The `loop.test` R01 summary case was updated for `LOOP_EVAL_ALL_FAILED` (F24), which landed on v1.3 first. |
| — | `v1.3` (direct commit `b20dca1f`) | — | tsc ✓ | Follow-up to the #159 merge. `checkImportTool` passes the confined paths (`ToolOutcome`, R05) to the interp call. This fix was in the tree when the checks ran, but it was left out of the merge commit, so for a few minutes v1.3 failed tsc. |
| #170 | `v1.3-pilot-run` | `c0329357` | tsc ✓ | The two loop conflicts came only from an older #159 that the branch had merged locally, so v1.3's versions were kept. The pilot outputs and the report are unchanged. |
| #229 | `v1.3-pilot-t1-options` | `f9def925` | tsc ✓; jest 92 suites ✓; ref ✓ | Base retargeted to `v1.3`. **D-c** applied (row 12). The T1 options were re-applied on v1.3's engine-default CLI. They are all off by default (`--empty-aggregates fail`). |
| #139 | `v1.3-advisory-noise` | `6ec942c0` | tsc ✓; jest 108 suites ✓; ref ✓ | Schema `$comment`, CLI and `PipelineConfig`: both sides kept. `--advisory-filter` defaults to `none`. |
| #213 | `v1.3-advisory-filter-oos` | `52c41de3` | tsc ✓ | The `src/` conflicts came from the branch's local merges of #139 and #133, so v1.3's versions were kept. The PR merged its criterion, script, results and report only. |
| #151 | `v1.3-interp-review-fixes` | `d0b5f792` | tsc ✓; jest 12 suites (339 tests) ✓; ref ✓ | `functions.ts`: v1.3's Java-regex translator was kept. It has a fuller R15, with ASCII `(?i)` folding instead of rejection, so the PR's test that expected the non-ASCII `(?i)` rejection was dropped.<br>Parity classifier: v1.3's ORDER BY tie rule (R17) is combined with this PR's `float-drift` class (16 ULP, named `averageInstability` texts only). It replaces the old 4-ULP rule on any `avg`/`sum` text.<br>`fuzz-verdict` maps `float-drift` to `quirk:T2-float-order`. |
| #156 | `v1.3-agent-proof` | `d23c5ad9` | tsc ✓; jest mcp-server 22 suites ✓; ref ✓ | v1.3 already had MCP `--engine` and the in-process path. This PR's server-wide `--tsconfig` / `DAEDALUS_TSCONFIG` was re-applied, with the per-call tsconfig winning, on both engines. |
| #164 | `v1.3-freeze-dryrun` | `4478d663` | tsc ✓; jest 4 suites ✓ | `holdout-run-main`: v1.3's dependency/lockfile provenance, plus this PR's engine-aware `neo4j` field. |
| #171 | `v1.3-loop-isolation-pins` | `729e6a6b` | tsc ✓; jest loop 11 suites ✓ (1 worker SIGSEGV, re-run ✓) | `--claude-config-dir` and `--engine` both kept.<br>The order is now: v1.3's R23 MCP spec check, then the isolation checks, then a pinned probe before the install. |
| #173 | `v1.3-tunables-manifest` | `7fb8b9d4` | tsc ✓; jest 12 suites ✓ | Both sides kept: the CI steps, the plan fields, and the opt-in `specSha256` pin next to v1.3's always-on `mcpSpecCheck`. |
| #180 | `v1.3-loop-fault-drills` | `2736a4a7` | tsc ✓; jest loop + integration ✓ | **The same gate defect was fixed in #159 (R01) and in #180 (F1); see "For the author".** The two fixes were combined:<br>• An unscored step-turn snapshot in the gate arm stops the run with `LOOP_GATE_UNSCORED`, and a resume reruns the step.<br>• A spec that was never frozen keeps R01's `repair.skipped = 'evaluation-failed'`.<br>The two v1.3 tests were adapted to this. A merge rename (`records` → `out`) was also fixed for `LOOP_EVAL_ALL_FAILED`. |
| #188 | `v1.3-scale` | `cf41da7e` | tsc ✓; jest 105 suites ✓ apart from the pre-existing `v12e-byte-identity` pinned-list case; ref ✓ | `extractAPG(…, sourceOverrides, limits)`: the scale limits are the 5th parameter, and the overrides are applied before the checker is built.<br>The cycle-query accelerator wraps **only the Neo4j repository**. It is on by default; `--query-engine neo4j` bypasses it.<br>Test call shapes were updated. |
| #189 | `v1.3-precedent-probe` | `8e144944` | tsc ✓ | Clean merge: docs, examples and results. |
| #196 | `v1.3-mcp-call-log` | `e28caacd` | tsc ✓; jest 35 suites ✓ (1 SIGSEGV, re-run ✓); ref ✓ | MCP and loop `--call-log` sit next to v1.3's flags. Both are off by default. |
| #203 | `v1.3-analysis-determinism` | `58facb10` | tsc ✓; jest 5 suites ✓ | Only `audit.md` conflicted; both entries were kept. |
| #204 | `v1.3-third-manifest-harness` | `b43d1bfd` | tsc ✓; jest 21 tests ✓ | Clean merge. |
| #206 | `v1.3-grid-scale-replay` | `b862c664` | tsc ✓; jest 2 suites ✓ | F1 (`tsconfigPath` dropped on cypher-interp) is already fixed on v1.3 by default (`89c9b5b3`). v1.3's `evaluate-project` was kept, and the opt-in `interpTsconfig` switch was dropped, so this PR changes nothing in `src/`. |
| #210 | `v1.3-gate-heldout-rules` | `acec7b8a` | tsc ✓; jest loop 13 suites ✓ (1 SIGSEGV, re-run ✓) | Shown-rule repair (off by default), combined with v1.3's unscored-gate stop and R01 skip. One unused test parameter was removed so tsc passes. |
| #212 | `v1.3-options-effects` | `827cb03e` | tsc ✓; ref ✓ | Merged as **diagnostic evidence**. No default changes: the `src/` conflicts came from local merges, so v1.3's versions were kept. `ue-baseline-live` gains an opt-in `--advisory-filter` pass-through; when the flag is not passed, the output is unchanged. |
| #220 | `v1.3-distinction-gaps` | `d6d240e8` | — | Clean merge, docs only. |
| #228 | `v1.3-check3-bases` | `f729a847` | tsc ✓; jest 2 suites ✓ | Clean merge. |
| #235 | `v1.3-floor-escape-repairs` | `b60e10c6` | tsc ✓; jest loop + integration (with the byte-for-byte loop replay) ✓, stage0 ✓ | Plan frame rungs sit next to gate, engine, specSha256 and acceptance. The spec-read log sits next to the held-out rules and the call log. The loop options are off by default; **correction (2026-10-16, post-merge review item 5):** not all of #235 is off by default. Its hint-audit default word lists changed (`orm`/`orms`/`typeorm` FAIL, `database`/`table`/`column` WARN), recorded as row 15 of `decision-chronology.md`. |
| #236 | `v1.3-replication-errata` | `22e6436a` | tsc ✓; `replicate:v1.3 --fast` (see below) | Base retargeted to `v1.3`. #159 (R25, R27, R28) and this PR corrected the same three lines. This PR's in-place corrections were kept, and so were #159's dated notes, whose "left as written" tail now says that the line was corrected in place by #236. |

**Final check on the v1.3 tip (`22e6436a`):**
- tsc passes in both configs.
- The reference check is byte-identical.
- jest was run over loop, integration/loop, mcp-server, pipeline, cli, cypher-interp, apg-extractor, scoring-engine, advisory-filter, graph-accelerator, ddd and scripts/v1.3: 170 suites, 2,403 tests passed. One test failed, the pre-existing `v12e-byte-identity` case described below. One worker SIGSEGV was re-run and passed.

## Skipped

None.

## Decisions applied

- **D-b (#159), row 11 of `Docs/v1.3/decision-chronology.md`.** #159's default-behaviour fixes and its R04 report-schema amendment are accepted as pre-freeze corrections. The four fixes that change results (R02, R14, R20 and R26) stay opt-in and off.
- **D-c (#170, #229), row 12.** A DDD task whose tree has no inferred aggregate is evaluated with a static spec, whose aggregates the author declares per task. #229's T1 options are accepted as opt-in switches only; the default stays `fail`. #229's recommendation (option a) is **not** adopted.
  - **Not done here:** writing the per-task aggregate declarations, then re-scoring or re-running the DDD runs. Memo §5 is still open.
- **#212:** merged as diagnostic evidence. It changes no default.

## For the author

- **#180 vs #159, the gate on an unscored snapshot.** This is a merge-time integration of two parallel fixes:
  - Default behaviour: the gate arm now stops with `LOOP_GATE_UNSCORED` on any evaluation failure other than a spec-freeze failure.
  - Under #159 alone, the run would have continued, with the failure recorded as `skipped`.
  - Please confirm this is the intended Study 2 harness behaviour.
- **#188, the accelerator is on by default on Neo4j.** The reference check runs on cypher-interp, so it does not exercise the accelerator. #188's own golden and unit tests pass. A Neo4j reference run with and without `--query-engine neo4j` would confirm "same rows" on the 71 cases.
- **`tests/unit/apg-extractor/v12e-byte-identity.test.ts` fails, and the failure is pre-existing.** The "pinned list covers every fixture project" case fails because fixtures added on v1.3 are not in `tests/fixtures/v1.3-byte-identity/v12e-hashes.json`. These are the MT-B1, CHECK-2 and, with #228, CHECK-3 fixtures. The list needs regenerating; it was not edited here.
- **The replication harness (#236) has drifted from the current docs.** `node replication/v1.3/run.mjs --fast` on the merged tree gives PASS 3,629, FAIL 278, ERROR 40.
  - Almost all of these are numbers registered against older text of docs that changed on v1.3 after registration: `v1.3/cypher-interpreter.md` (about 300, after #151), the repro audit (9), judge-v2 (5), the night backlog (2) and fieldstate-cheapfix (2).
  - None of them comes from the three docs that MT7 resolved.
  - The groups need re-registering against the current docs before `replicate:v1.3` can gate again.
- **jest worker SIGSEGVs.** Six suites crashed once each, on different suites, under `--maxWorkers=2`, and each passed when run alone. This looks like a machine or worker issue, not a test failure.
- **PRs #75, #77 and #80** (v1.2e drafts) were left open and untouched, as instructed.
