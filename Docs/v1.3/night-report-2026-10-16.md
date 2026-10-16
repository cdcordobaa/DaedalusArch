# v1.3 night report, 2026-10-16 (11:00 UTC)

Written by the round-4 (final) foreman. **Documentation only.** Every number below is quoted exactly from the doc named next to it, or comes from a gate this run executed. Nothing was recomputed by hand. When a doc lives on an unmerged PR branch, the branch head SHA is given; that number is not yet on `v1.3`.

`origin/v1.3` when the gates ran: `f66564ef`. At publication it is `9a6c2655`. The commits since are #219, #226, #218, #130 and #230, which change only `Docs/v1.3/*.md`, `papers/*` and `aidlc-docs/audit.md`. The gates were re-run on the merged result before #224 was merged.

## 1. What the foreman did in round 4

- **Unblock pass.** Of the 64 open PRs into `v1.3`, 63 are titled `[hold]`. The only other one, #215 (replication part 2), merges cleanly, but its body says "**Do not merge without review.**" Following the rules of earlier rounds, the foreman pushed nothing to `[hold]` PRs and did not merge #215. No conflict was resolved and no branch was pushed this round.
- **Merges.** No PR met the merge rule (fully green, not hold, no do-not-merge mark). **Nothing was merged into `v1.3` by this round**, except this report's own docs-only PR (#224).
- **Opened during this run, not merged:**
  - #223 (artifact-eval readiness): body says "Do not merge without review". #218 (hold-queue triage) had the same line, and was merged through the GitHub UI at 11:27.
  - #220: titled `[hold]`.
  - #222 (MT-B1 barrel fix, off by default): its base is `v1.3-metamorphic`, not `v1.3`.
  - #221 (APG v2 fixes-mined): not titled hold and has no do-not-merge line. It copies `scripts/v1.3/lib/fixes-mined.ts`, `results/v1.3-fixes-mined/corpus.json` and `specs/` verbatim from #168, which the author marked do-not-merge. Merging #221 would land part of #168 unreviewed, the same reason the overnight review held #212 and #213. It was also opened after the last review sweep. **Left for the author.**
- **Gates on `v1.3` itself at `f66564ef`:**
  - `npx tsc --noEmit`, `-p tsconfig.scripts.json` and `-p tsconfig.u0-tests.json`: all three clean (fresh `npm ci`).
  - **Offline re-score:** `scripts/v1.3/validate-reference.ts --from-raw results/v1.3-reference/after-member-facts/raw` gives "No mismatch." Its `report.json` and `report.md` equal the committed ones, except for the header line, which names the mode ("from saved outputs in …" vs "live run").
  - **`ue-baseline-live.ts --engine cypher-interp`**, with no Neo4j variables set: `raw/` has 71 files, and `raw/`, `report.json` and `report.md` are **byte-identical** to `results/v1.3-reference/after-member-facts`.
  - `jest --maxWorkers=2 tests/unit`: 6 failures in 5 suites, all known from round 1. No new failures (§6).

## 2. What merged overnight (2026-10-16, 00:00–11:00 UTC)

Taken from `git log origin/v1.3 --merges --first-parent`.

| UTC | PR | Branch |
|---|---|---|
| 00:01 | #108 | v1.3-fixbatch |
| 00:07 | #112 | v1.3-papers |
| 00:10 | #117 | v1.3-replication |
| 00:14 | #113 | v1.3-pilot-ready |
| 00:18 | #110 | v1.3-cheap2 |
| 00:22 | #106 | v1.3-ontology |
| 00:26 | #105 | v1.3-ise-robust |
| 00:32 | #121 | v1.3-fieldstate |
| 00:36 | #114 | v1.3-wild |
| 00:41 | #119 | v1.3-analysis-ready |
| 00:47 | #127 | v1.3-ap-hosts |
| 01:07 | #132 | merge of origin/v1.3 into the train |
| 01:12 | #122 | v1.3-mcp2 |
| 01:19 | #128 | v1.3-cypher-interp |
| 01:26 | #129 | v1.3-construct-blind |
| 01:34 | #126 | v1.3-judge-v2 |
| 01:50 | #148 | v1.3-night-plan |
| 01:58 | #152 | v1.3-post-merge-review |
| 04:01 | #163 | v1.3-night-backlog |
| 04:31 | #153 | v1.3-model-panel |
| 04:44 | #142 | v1.3-loop-replay |
| 05:01 | #184 | v1.3-tracker-0500 |
| 05:06 | #157 | v1.3-neural-mcp |
| 05:18 | #158 | v1.3-fix-cli-cv03 |
| 05:30 | #161 | v1.3-floor-probe |
| 05:43 | #135 | v1.3-npx |
| 05:56 | #166 | v1.3-validity-convergent |
| 06:25 | #134 | v1.3-blind-misses |
| 06:38 | #138 | v1.3-ci-action |
| 06:52 | #137 | v1.3-devset-expansion |
| 07:07 | #140 | v1.3-html-report |
| 07:22 | #150 | v1.3-init-infer |
| 07:36 | #183 | v1.3-interp-fuzz |
| 07:52 | #143 | v1.3-fix-hints |
| 08:06 | #135 follow-up | v1.3-npx (`includeViolations` on cypher-interp) |
| 08:20 | #138 | v1.3-ci-action (foreman re-merge) |
| 08:21 | #193 | v1.3-foreman-log (round 1) |
| 08:35 | #202 | v1.3-overnight-review |
| 08:49 | #211 | v1.3-foreman-log (round 2) |
| 09:42 | #214 | v1.3-overnight-review (pre-train sweep) |
| 10:33 | #216 | v1.3-tracker-1030 |
| 11:04 | #219 | v1.3-paper3-update (papers only; merged during this run, not by the foreman) |
| 11:24 | #226 | v1.3-floor-escape-design (docs; GitHub UI merge) |
| 11:27 | #218 | v1.3-hold-triage (docs; GitHub UI merge) |
| 11:29 | #130 | v1.3-threats (docs; was `[hold]`; GitHub UI merge) |
| 11:31 | #230 | v1.3-paper1-4-refresh (papers; GitHub UI merge) |

The round-3 foreman log (`9286f705` on `v1.3-foreman-log`) has no PR yet and is not on `v1.3`.

## 3. What is still open, and why

**64 open PRs into `v1.3` at `f66564ef`** (#218, #220, #221 and #223 opened during this run; #130 and #218 have since been merged; the mergeability list below is for the original 64 at `f66564ef`). 63 of the 64 are titled `[hold]`. Round 3 found that each of #130–#201 is held at least partly because the author marked it do-not-merge-before-review. #203–#213 and #217 also carry `[hold]` in their titles. #215 is not titled hold, but its body says "Do not merge without review".

Mergeability against `f66564ef` (`git merge-tree`):

- **Merges cleanly (39):** #217, #215, #212, #201, #200, #199, #197, #195, #194, #192, #190, #189, #187, #186, #182, #181, #179, #178, #177, #176, #175, #174, #172, #169, #167, #165, #164, #162, #155, #154, #149, #147, #146, #145, #144, #139, #136, #133, #131.
- **`aidlc-docs/audit.md` conflict only (18):** #213, #210, #209, #208, #207, #206, #205, #204, #198, #191, #185, #180, #173, #171, #168, #151, #141, #130.
- **Night-plan file conflict only (2):** #203, #160 (`aidlc-docs/construction/plans/v1.3-night-2026-10-16-plan.md`).
- **Code conflicts (5):**
  - #196: `src/mcp-server/context.ts` (plus `audit.md`).
  - #188: `apg-extractor.ts`, `cli.ts`, `extract-command.ts`, `pipeline-factory.ts`, `pipeline/types.ts` (plus `audit.md`).
  - #170: 10 files, including `filter-explain.ts`, `report-schema.ts` and `schemas/report.schema.json`.
  - #159: `schemas/report.schema.json`, `cli.ts`, `mcp-server/tools.ts`, `report-schema.ts`.
  - #156: `src/mcp-server/context.ts`, `src/mcp-server/evaluate-project.ts`.

The foreman did not resolve these conflicts, because every one of these PRs is on hold. Where the decisions behind a hold were already written down, they are in `Docs/v1.3/foreman-log.md` (rounds 1–3, branch `v1.3-foreman-log`) and in `Docs/v1.3/overnight-pr-review.md`.

## 4. Key results (exact quotes)

### Validity evidence

- `Docs/v1.3/validity-evidence-summary.md`, branch `v1.3-validity-synthesis` @ `32cba511` (PR #195), line 161:
  > **Bottom line.** The instrument is reliable on engine parity, but it has no human inter-rater or repeat-run reliability yet, and two engine defects are open (CV:40-41, :331). It is mechanically correct, mostly on development data, and it agrees with independent tools. Whether its findings are *meaningful* is still unshown. One behavioural test came back null.
- Same doc, line 149:
  > **It reads code the way other tools do.** On 29 real open-source projects (15 pre-2023 human-written, 14 wild), the tool was compared with three established architecture checkers. Agreement was high: κ 0.913–1.000 (CV:15-19).
- Same doc, line 158:
  > **We have no validity figure on data the tool was not tuned on, yet.** The sealed hold-out has not been run ([VS] VSM:120). The 283 findings on human code are unlabelled ([EX] EXR:196).
- `Docs/DiagnosticRuns/v1.3-known-groups-2026-10-16.md`, `v1.3-known-groups` @ `ba1c6327` (PR #198), line 30:
  > **Null result.** In neither set do showcase repos have lower finding density; the point estimates go the other way
- `Docs/DiagnosticRuns/v1.3-validity-fixes-mined-2026-10-16.md`, `v1.3-validity-fixes-mined` @ `7e5db9e6` (PR #168), lines 9 and 11:
  > **No robust validity signal.** The pooled blocking-tier removal rate is 2.65× the cross-layer baseline (74 vs 110 credited removals, 95% CI 1.97–3.56). That ratio rests on **one commit**: amplication PR #93, "Lint Imports".

  > - **Without that commit:** the ratio is 0.93 (0.61–1.43).
- Caveats from the overnight review: the summary's line 72 says "15 projects (10 fail, 5 pass)", but the #133 report at its head says "11 fail, 4 pass". `overnight-pr-review.md` line 90 says #195's "director summary overclaims "reliable"".

### Floor probe

- Floor probe 1, merged: `Docs/DiagnosticRuns/v1.3-floor-probe-2026-10-16.md` on `v1.3` (PR #161), lines 15 and 183:
  > | Share of `none`-arm steps with ≥ 1 blocking (defining) violation | **14 / 28 (50 %)**: hexagonal **0 / 14**, layered **14 / 14** |

  > **Study 2's primary outcome is at real risk of a floor effect.**
- Floor probe 2: `Docs/DiagnosticRuns/v1.3-floor-probe-2-2026-10-16.md`, `v1.3-floor-probe-2` @ `e6d8b3de` (PR #182), lines 16–18 and 20–21:
  > | C1 style + layout (replicates #161) | **1 / 8** | 0 / 4 | 1 / 4 | 1 (FF-S02 cycle) | 0/19, 0/10 |
  > | C2 style only | **0 / 8** | 0 / 4 | 0 / 4 | 0 | **19/28**, 2/21 |
  > | C3 spec only (`spec.yaml`) | **0 / 8** | 0 / 4 | 0 / 4 | 0 | 0/16, 1/19 |

  > **Pre-stated reading (plan §6): neither C2 nor C3 reaches 3 / 8, and C1 stays at ≤ 1 / 8, so the recommendation is to
  > keep the frame and move the lever to task design (W3-3), not S5 = "no-layout-hint arm or frame".**
- Caveat (same doc, line 5): "n = 24 steps from one agent, so every number here is a count, not an estimate."

### Pilot

- `Docs/DiagnosticRuns/v1.3-loop-pilot-2026-10-16.md`, `v1.3-pilot-run` @ `f2de162f` (PR #170), lines 7 and 11–13:
  > **The §5 decision is not reached. Study 2's primary outcome is unchanged by this run.**

  > | `market-vendors` (Clean) | **0** | yes, 4/4 steps |
  > | `shelter-adoptions` (Hexagonal) | **0** | yes, 4/4 steps |
  > | `relief-volunteers` (DDD) | **unknown** | **no**, 0/4 steps (tool defect T1, below) |
- `Docs/v1.3/pilot-outcome-memo.md` on `v1.3`, line 3, is still the pre-run text: "**2026-10-15. Status: defined; no pilot run has started.**"

### Judge v2.2

- `Docs/DiagnosticRuns/v1.3-judge-v22-check2-2026-10-16.md`, `v1.3-judge-v22-run` @ `f7e1d6de` (PR #191), lines 9 and 14:
  > **Pre-fixed decision rule (plan §5): NOT CANDIDATE.** Check D1 fails. v1 stays the frozen default judge, and v2.2 does not go forward to a confirmation run.

  > | **D1** | layered business clean units: v2.2 false fails ≤ 1, and ≤ v1's | 10/21 | **7/21** | **NO** |
- Caveat (line 5): "**§6 (Gemini, both ensemble rules) is EXPLORATORY and was NOT pre-registered.**"

### Agent proof

- `Docs/v1.3/agent-proof-2026-10-16.md`, `v1.3-agent-proof` @ `4e83ed1f` (PR #156), lines 19–20 and 24–26:
  > - The independent `evaluate` CLI found **zero blocking (defining) violations** after each of the five tasks,
  >     and `tsc` passed each time.

  > - The agent ran `evaluate_project` and got `hard-block` (AHS 0.612).
  > - It fixed all three in 4 edits.
  > - It re-ran `evaluate_project` and got `pass` (AHS 0.787). The independent CLI agrees.
- Caveat (line 6): "**Status: illustrative.** This is one run with one agent and one toy domain."

### Mutation and metamorphic testing

- `Docs/DiagnosticRuns/v1.3-operators-hexddd-2026-10-16.md`, `v1.3-operators-hexddd` @ `63581b52` (PR #162), lines 94 and 96:
  > - **Recall:** 431/441 = 0.977 [0.959, 0.988]. On the real projects alone it is 312/322 = 0.969 [0.944, 0.983].

  > - **Twins:** 0 false fires in 297 rows [0.000, 0.013]; on the real projects 0/214 [0.000, 0.018].
- `Docs/DiagnosticRuns/v1.3-rule-mutation-2026-10-16.md`, `v1.3-rule-mutation` @ `39a84bd4` (PR #190), lines 9 and 14:
  > The reference set and devset-b together change an expected-violation result for **90 of the 273 (33%)**.

  > - **Never caught:** ORDER BY (0/59) and DISTINCT (0/2).
- `Docs/DiagnosticRuns/v1.3-metamorphic-2026-10-16.md`, `v1.3-metamorphic` @ `6efd7520` (PR #185), lines 21 and 27:
  >   So is split (one file into two in the same layer). That makes 7 × 71 = 497 transformed cases, all invariant on (rule, layer pair) and on (rule, file, target).

  >   - **1 tool bug (MT-B1).** A barrel that belongs to no layer hides what it re-exports from the literal-view layer rules (1 case, NestJS).
- Caveat (#185, line 3): "**DEVELOPMENT-SET NUMBERS.**"

### External sets

- Wave 1: `Docs/DiagnosticRuns/v1.3-external-set-2026-10-16.md`, `v1.3-external-set` @ `49c7e6c7` (PR #133), lines 132 and 174:
  > | **Total** | | 11 fail, 4 pass | **283** | **955** | | |

  > | **Pooled** | **3443/3717 = 0.926 coverage, 3443/3810 = 0.904 confirmation** | **3717/3717 = 1.000 / 1.000** | |
- Wave 2: `Docs/DiagnosticRuns/v1.3-external-set-2-2026-10-16.md`, `v1.3-external-set-2` @ `b1d05f7a` (PR #181), lines 243 and 252:
  > | **Pooled** | **35** | **2,883** | **30** | **0.857 (0.706 to 0.937)** | **625** | **17.9 / 6 / 165** | **21.7** | **2,304** |

  > - **A failing verdict is the norm, not a signal.** 30 of 35 human-written, style-claiming projects fail the v1.3 verdict, and every style fails 6 of 7.
- Correctness: `Docs/DiagnosticRuns/v1.3-external-correctness-2026-10-16.md`, `v1.3-external-correctness` @ `23adb369` (PR #167), line 44:
  > | all blocking | 283 | 283 | 0 | 0 | 1.000 | [0.987, 1.000] |
- Caveats: "**No labels yet.**" (#133 line 200, #181 line 296), and "Correct is not meaningful; nothing here claims validity on its own." (#167 line 3).

### Replication part 2

- `Docs/v1.3/replication-2.md`, `v1.3-replication-2` @ `4c1d34eb` (PR #215), lines 103–104 and 111:
  > | **yes** (reproduced, equal) | **4,587** |
  > | **no** (reproduced, different) | **58**, of which **35 are new** (not in the PR #117 audit) |

  > **No headline result is overturned.** None of the 58 mismatches changes a conclusion.

## 5. Readiness gate status

- `Docs/v1.3/study2-readiness-gate.md`, `v1.3-study2-readiness` @ `2012aa7a` (PR #146, on hold), line 3:
  > **2026-10-16. Status: NO-GO. 1 of 42 lines is green (V2), 1 is partly green (D14), 32 are red and 8 unknown.**
- Re-assessed after the night: `Docs/v1.3/validity-evidence-summary.md` (PR #195), line 218:
  > **Gate total after the night.** The gate's own count is unchanged: 1 green (V2), 1 partial (D14), 32 red, 8 unknown. **NO-GO.** No line changes colour.
- Night plan tracker, `aidlc-docs/construction/plans/v1.3-night-2026-10-16-plan.md` on `v1.3`, line 3:
  > **Status 2026-10-16T10:30Z (scheduled tracker update):** 28 `[x]` · 4 `[~]` · 0 `[ ]` · 63 `[!]` (62 point at an open PR titled `[hold]`; 1 is the author-only score-free sheet gate).

**The gate is NO-GO. Study 2 cannot start.**

## 6. Gate results on `v1.3` @ `f66564ef` (this run)

| Gate | Result |
|---|---|
| tsc (root, scripts, u0-tests) | clean |
| Offline re-score (`--from-raw` after-member-facts) | No mismatch; reports equal apart from the mode header line |
| `--engine cypher-interp` live, no Neo4j | byte-identical: raw 71/71, `report.json`, `report.md` |
| jest `--maxWorkers=2 tests/unit` | 5138 passed, 6 failed, 40 skipped (5 failed suites). The 6 failures are the same 5 suites as round 1's v1.3 baseline: `replay-no-binary`, `generators/skeleton`, `mutation/expected`, `u5b/guards`, `u5b/score-golden-acceptance`. **No new failures.** |

## 7. Decision list for the author (today)

1. **Holds.** All 63 `[hold]` PRs are waiting on your review. #215 is clean and needs your review before it can merge. `Docs/v1.3/hold-queue-triage-2026-10-16.md` (#218, now merged) proposes a merge order for clearing the hold queue (its PR body: 40 MERGE-NOW, 18 AUTHOR-DECISION, 4 FIX-FIRST, 1 PARK). Also decide on #221 (it carries #168's files) and #223. Nothing can enter a train until you clear the holds.
2. **#143 is already on `v1.3`.** Agent-settable MCP `hints` work without `--hints`, and `fixHints` is in the frozen report schema. Revert it or gate it (round 3).
3. **#159 / #170, filter-explain R20.** Choose `v1.3`'s default grounding or #159's opt-in `bareLines`. Both PRs conflict again (in 4 and 10 files).
4. **#188 scale.** `--query-engine accelerated` is the ungated default, and the title claims "outputs byte-identical". Gate it or retitle it. The PR conflicts in 5 `src` files.
5. **#156 agent proof.** Commit the transcripts, remove the local paths, test `DAEDALUS_ENGINE` / `DAEDALUS_TSCONFIG`, and decide whether "proof" fits N = 1. The PR conflicts with #135's `evaluate-project.ts`.
6. **Floor effect.** Floor probe 2 recommends keeping the frame and moving the lever to task design (W3-3). Accept or reject that. `v1.3-floor-probe-3` (`495a3987`, `Docs/v1.3/study2-task-design.md`) has no open PR into v1.3 in the current list.
7. **Pilot.** The §5 decision is not reached because DDD is unscored (tool defect T1). Decide whether to fix T1 and re-run DDD.
8. **Judge.** v2.2 is NOT CANDIDATE, so v1 stays the frozen default. Decide whether to plan a v2.3 / CHECK-3.
9. **#195 wording.** Correct "10 fail, 5 pass" to the #133 head's "11 fail, 4 pass", and soften "reliable" before merging.
10. **`audit.md` union merge.** Add `aidlc-docs/audit.md merge=union` in `.gitattributes`, or switch to per-job audit files. 18 of the open PRs conflict on that file alone.
11. **Housekeeping.** The round-3 foreman log (`9286f705` on `v1.3-foreman-log`) has not been opened as a PR.
