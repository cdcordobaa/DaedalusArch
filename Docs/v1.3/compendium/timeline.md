# v1.3 timeline, 2026-10-14 to 2026-10-16

**Compiled 2026-10-16 at 15:10 UTC from `git log origin/v1.3` (tip `81933889`), the decision chronology (`Docs/v1.3/decision-chronology.md`), the merge-train reports and the deviation record.** Times are UTC commit or merge times. A PR number means the PR that carried the work into `v1.3`. "Open" means the PR was not merged at the time of writing. Each result is given as its primary report states it; the claims ledger holds the cited line for every number.

The story has five phases. They can serve as the backbone of the v1.3 chapter and of the director deck.

## Phase 0: before v1.3 (context, up to 2026-10-14)

| When | Event | Where |
|---|---|---|
| 2026-10-09 17:14 | Judge v1 rubric frozen for Study 1 (prereg P-4). Delegated decision; no full-mode run existed. | decision chronology row 1 |
| 2026-10-10 | Study 1 (E1 grid, v1.2E instrument) analysed. Registered result: the spec level affects the Architectural Health Score, in the reverse direction (`none` best; Holm p = 0.0003); no model effect (p = 0.44). | `Docs/DiagnosticRuns/e1-size-analysis-2026-10-10.md:20-21` |

## Phase 1: the validation protocol and the instrument (2026-10-14 evening to 2026-10-15 early morning)

| When | Event | Where |
|---|---|---|
| 10-14 20:03 | v1.3 validity cycle opened (inception: questions answered under delegation, requirements, plan). | commit `c63fa0d0` |
| 10-14 20:04–20:05 | Extractor fixes, MCP loop prototype, hexagonal style and judge anti-patterns merged. | PRs #69, #74, #76, #79 |
| 10-14 20:08 | Validation protocol rev 1: a-priori rule tiers, rule sources, blind manifests, adjudicated fidelity; the Study 2 task list hashed (sealed, never opened since). The tiers come after the Study 1 data and before any v1.3 data. | `9c3804f8`; `Docs/v1.3/sealed-hashes.md`; chronology row 2 |
| 10-14 20:35 | Graph-fidelity harness and the first result on E1 and SO4. It found the barrel (re-export) defect. | `5b5be04e`; `Docs/DiagnosticRuns/v1.3-graph-fidelity-2026-10-14.md` |
| 10-14 20:39 | DDD style library (the fifth style). | `6c60bcd4`, PR #83 |
| 10-15 00:41 | ADR-V13-01 accepted by the author ("yes A"): record literal and resolved re-export edges, one view per template. This is the one human decision taken before the reference data it affects. | `Docs/v1.3/adr-v13.md:7`; chronology row 3 |
| 10-15 00:42–02:09 | Reference set, tiers, DDD, barrels, the unified evaluation (UE) and the first fix batch merged. Reference baseline run (71 variants). The hold-out was first sealed (62 cases) on `v1.2e` after this baseline. | PRs #82–#87; chronology row 4 |

## Phase 2: development evidence (2026-10-15)

| When | Event | Where |
|---|---|---|
| 10-15 17:00–17:13 | Construct decisions (rev 0, rev 1) and the loop harness merged. The hold-out was enlarged from 62 to 207 cases after the after-fixes run, under delegation (after data). | PRs #88, #89, #91; chronology rows 5–6 |
| 10-15 17:13 | Member facts; the after-member-facts reference run. | PR #90 |
| 10-15 17:21 | Judge catch, round 1. | PR #92 |
| 10-15 17:30–17:55 | Deterministic labelling of every checkable finding; live labels; label scrub; ISE. | PRs #93–#97 |
| 10-15 18:15–18:16 | ISE on E1, cheap semantics, APG v2, judge catch round 2 (pooled catch 16/21 = 0.76 [0.55, 0.89]), descriptive Study 1 rerun under v1.3 (no accepted E1 cell has a blocking finding, 0 of 65). | PRs #98–#102 |
| 10-15 18:43–19:07 | APG v2 live and scope ADR. | PRs #103, #104 |
| 10-15 19:29–19:35 | Pilot outcome memo written before any pilot run; its §5 pre-commits the outcome rule. DUP-RULE v2. | PRs #107, #109, #111 |
| 10-15 20:28–21:11 | Presentation kit, rule-source errata, review fixes (the FF-P06 N/A correction: author-view blocking recall 54/54, not 57/57), construct switches. | PRs #115–#125; chronology row 7 |

## Phase 3: night and morning merge trains (2026-10-16, 00:00 to 11:00)

| When | Event | Where |
|---|---|---|
| 00:01–01:34 | Merge train: fix batch, papers, replication package part 1, pilot readiness, cheap semantics 2, ontology, ISE robustness, fieldstate, wild run (14 public repositories), analysis readiness, ap-hosts, MCP v2, the in-process Cypher interpreter, construct blind sheet, judge v2. | PRs #108, #112, #117, #113, #110, #106, #105, #121, #114, #119, #127, #122, #128, #129, #126 |
| 01:50–04:01 | Night plan (every new behaviour OFF by default; the 71 reference results byte-identical), post-merge review, night backlog. | PRs #148, #152, #163; chronology row 9 |
| 04:31–08:49 | Late train: model panel harness (dry run only), loop replay, neural MCP tools, floor probe 1 (hexagonal `none` 0/14 steps blocking; layered at a step-1 level), npx mode, convergent validity, blind misses, CI action, devset expansion, HTML report, init-infer, interpreter fuzz, fix hints. | PRs #153, #142, #157, #158, #161, #135, #166, #134, #138, #137, #140, #150, #183, #143 |
| 04:25–05:59 | Opened and held: loop pilot (#170: Clean 0 and Hexagonal 0 new blocking; DDD unscored, tool defect T1), floor probe 2 (#182), precedent probe (#189). | open or later merged |
| 09:42–11:04 | Overnight review sweep, tracker, Paper 3 update. | PRs #214, #216, #219 |

## Phase 4: merge train MT5, Study 2 design, and the deviation (2026-10-16, 11:00 to 14:12)

| When | Event | Where |
|---|---|---|
| 11:23–11:55 | MT5: floor-escape design (recommends the level outcome), hold-queue triage, threats register, gap plan, outline v2, readiness gate, validity strategy and synthesis, research memos, rule mutation, default-view coverage, adjudication prep, analysis rehearsal, hex/DDD operators, judge selective prediction (null), fix mining (no robust signal), fixture leakage, complementarity, floor probe 2 (1/24), spec-author reliability (κ 0.77, below 0.80), floor probe 3 (Clean 0/4, Hexagonal 0/4). | PRs #226, #218, #130, #192, #194, #146, #147, #195, #169, #172, #177, #178, #154, #190, #149, #131, #155, #160, #162, #165, #168, #175, #179, #182, #186, #227 |
| 11:26 | DDD pilot snapshots re-scored offline under each T1 option: zero branch under options a, c and d. | PR #229 (open) |
| 11:53 / 12:00 | Readiness dashboard: Study 2 NO; 1 of 42 gate lines GREEN, 11 AMBER, 30 RED. | `Docs/v1.3/study2-readiness-dashboard.md:3` |
| 12:59–13:52 | Night report, artifact-evaluation pack, Paper 2 update, level-power simulation (designs for RR 0.25), APG v2 fixes mined, Neo4j version independence (73/73), forecast, human erosion (5 of 6, p = 0.219), snapshot measures, replication part 2 (5,154 numbers), spec ladder, semantic mutation tests (strict kill 90 → 164 of 273), judge v2.2 prep and CHECK-2 (NOT CANDIDATE), rule gaps, rule mining, MCP–interpreter parity, metamorphic testing, MT-B1 barrel fix, judge steering prep, engine tee, acceptance runner, npx readiness, external labelled datasets survey, claims privacy hygiene, instrument hardening, unsealer, external correctness (283/283, negative control 500/500), refactor PRs, known groups (null). | PRs #224, #223, #217, #234, #221, #207, #205, #209, #197, #215, #231, #225, #141, #191, #144, #145, #176, #185, #222, #208, #199, #200, #237, #241, #240, #238, #174, #167, #239, #198 |
| 13:50 | **Author decision**, as a declared deviation: Study 2's primary outcome becomes Y (distinct blocking edges at step k = 4); arms `none` and `daedalus-mcp`; Sonnet 5.5 plus the Codex pin; no V10(a) waiver; if no stratum passes the validation pilot, Study 2 does not run. The author also delegated "unblock everything". | `Docs/v1.3/study2-deviation-2026-10-16.md` §7 |
| 14:06–14:12 | Merge train MT6: external set 1–3 (15 human-written repositories; D-a keeps `conduit` with a limitation), protocol reconciliation (the deviation record and amended documents), loop harness fixes. The train stopped after #232 at a permission refusal; the held PRs were left untouched. | PRs #133, #181, #232, #243, #242; `Docs/v1.3/merge-train-mt6.md` |
| 15:10 | Labeller calibration against published human labels: pre-registration and harness; no model call. | PR #244; `Docs/v1.3/labeller-calibration-plan.md` |
| 15:19 | Jury fixes from a mock defence. A5: a blocking rule that fails to execute now gives `incomplete` and the CI gate fails on it, ON by default, with the 71 reference results byte-identical. A6: the clustered statement of the external correctness result. B1–B3: FF-S02 cycle sensitivity. | PR #245; `Docs/DiagnosticRuns/v1.3-jury-fixes-2026-10-16.md` |
| 15:08 onward | This compendium, merged with `v1.3` after #245. | branch `v1.3-compendium` |

## What the timeline shows for the thesis

1. **The order of decisions and data is on record.** The rule tiers were fixed before any v1.3 data, but after Study 1. ADR-V13-01 is the only human decision taken before the data it affects. The hold-out was sealed and then enlarged after development results existed (chronology rows 4 and 6). The Study 2 outcome switch is a declared deviation, made after the pilot and the probes and before any Study 2 task was written or any arm comparison existed.
2. **Most v1.3 evidence is less than 48 hours old and was produced by AI sessions under delegation.** The audit trail (commits, PR numbers, the replication package) is what makes it checkable. The independent human checks the protocol asks for (second rater, adjudication) have not been done.
3. **The two runs that would turn development evidence into confirmatory evidence have not happened:** the sealed hold-out and Study 2.
