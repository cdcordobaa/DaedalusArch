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
| 15:08–16:03 | This compendium, merged with `v1.3` after #245. | PR #246 |

## Phase 5: merge train MT7, one-branch consolidation, post-merge verification (2026-10-16, 16:03 to 19:52)

The author confirmed live at about 15:55 UTC that everything should be merged ("I obviously need everything merged"). From 17:30 UTC, `main` is the default and working branch; `v1.3` and `v1.2e` are read-only reference snapshots.

| When | Event | Where |
|---|---|---|
| 16:31–16:42 | MT7 opens with the held decision PRs. D-b: the post-merge review fixes R01..R31 are accepted as pre-freeze corrections, and the result-changing ones stay opt-in. D-c: tool defect T1 is handled with per-task declared DDD aggregates; #229's options are merged off by default and its option a is not adopted. Advisory-noise table and out-of-sample filters (the roll-up does not transfer: 0.07 external, 0.00 wild). | PRs #159, #170, #229, #139, #213; chronology rows 11–12 |
| 16:48–17:29 | MT7 main train: interpreter review fixes (float-drift class), agent proof (N = 1), freeze runbook and dry run (9 of 14 checks unmet), loop isolation and pins, tunables manifest, fault drills (11/13 resume byte-identical), scale (cycle-query accelerator, on by default on Neo4j), precedent probe (0/8 planted vs 0/8 control, null), MCP call log, analysis determinism pack, third-manifest harness (no vendor run), full-grid stub replay, held-out-rule mechanism, options effects (no option changes blind-key recall), distinction gaps (contribution statement, earlier claims ledger, limitations register), CHECK-3 bases (not run), floor-escape repairs (hint-audit word lists on by default), replication errata (41 doc errors and 15 group errors corrected). | PRs #151, #156, #164, #171, #173, #180, #188, #189, #196, #203, #204, #206, #210, #212, #220, #228, #235, #236; `Docs/v1.3/merge-train-mt7.md`; chronology row 15 |
| 18:04–18:11 | Graph adapter and pnpm/yarn support (v1.2e-targeted drafts brought in through main). One-branch consolidation without PRs: v1.2e log commits, the foreman log, the declared-rules scripts (code only, no report) and the predictive-validity pre-specification with its result files (no outcome report yet). | PRs #75, #77; merges `5f28cbd4`, `f475a3ae`, `25d85d20`, `1551d430` |
| 18:34 | Post-merge verification of MT7: tests, the 71-case reference output byte-identical on Neo4j with and without the accelerator and on the interpreter, replication `--fast` re-registered (5 FAIL left, all from the judge-stage grounding default), ledger citations refreshed. | PR #247; `Docs/DiagnosticRuns/v1.3-post-merge-verification-2026-10-16.md` |
| 19:52 | Post-review fixes and final re-test. D-e: the grounding default returns to `bareLines: 'longest'`, so the committed judge-v2 figures (65/66, 114/114) reproduce; under the R20 opt-in they are 62/66 and 111/114. Results-path guard by folder pattern. Gate-arm resume re-scores the kept commit. Replication `--fast`: PASS 4,366, FAIL 0. | PR #248; `Docs/DiagnosticRuns/v1.3-post-review-fixes-2026-10-16.md`; chronology rows 13–14 |
| 2026-10-17 | Daily thesis sync: claims ledger extended with 994 claims from 49 MT7 documents (C4953–C5946), 9 new conflicts (K178–K186) and 7 revisited conflict rows after the errata (KR01–KR07); nulls M01–M31; open items refreshed; decision-chronology rows 16–21. The private thesis draft (Kap8/Kap9) was updated from the ledger in a separate PR, left open for the author because it changes three existing claims (loop-pilot DDD re-score reading, cycle-rule defect status). | PR [#249](https://github.com/cdcordobaa/DaedalusArch/pull/249) (merged); this entry |
| 2026-10-18 | Daily thesis sync: no new evidence. Only the 2026-10-17 sync PRs (#249, #250) merged since #248; no report under `Docs/DiagnosticRuns/`, `Docs/v1.3/` or `papers/` changed outside the compendium. The private thesis PR #8 is still open for the author. | PRs #249, #250 |

## Phase 6: the decision board, the brownfield track and the v1.4 units (2026-10-18 to 2026-10-19)

Times are UTC (the merge commits carry −05:00). Claims: ledger parts `claims-ledger/v14-*.md` (C5947–C6816); nulls M32–M82; conflicts K187–K228; chronology rows 22–33.

| When | Event | Where |
|---|---|---|
| 2026-10-18 | The 2026-10-18 sync PR merged (no new evidence). Working surface `ops/` written: instrument map v3, defensibility conditions register (27 rows: 5 green, 8 amber, 5 red, 9 not started), build list, design notes NS-01 to NS-03, BF-01, EFF-01, MEAN-01, S2D-01, G07–G15, and three external-model reviews. | PR #251; `ops/` (merged later in #252) |
| 2026-10-18, 23:06 | **Decision board** (author). Against the agent's recommendation: **M3, Study 2 to be redesigned around drift** (no dated deviation record yet), M5 (efficiency test becomes a thesis result), D2b (Layered keeps wiring imports; base rate stays 5.33), D5 (DDD gains FF-S02) and N3 (application purity FF-P07), both as post-seal rules. Matching it: D2a (F23 now), D3, M1, M2, M4, M6 (evasion check), N1, N2, N4, V4 (ADR if the count shows a shortfall), CDX (Gemini as the Codex substitute), PRE, S2S, D6, D7. Later that night: D1 (decision sheet confirmed as written), L4 (practitioner reading of "meaningful"), standing OKs for three counted runs. | `ops/decisions.md`; `28f3babe`, `26cb9685`; chronology rows 22–31 |
| 2026-10-18 (reports) | Zero-call analyses: **blind-recall gap** (14 misses: 5 rule or template gaps, 9 spec–manifest disagreements; reachable 55/65 = 0.85 after the admissible fixes, Layered stops at 0.80); **drift in 36 human histories** (blocking findings 404 → 1,824, mostly growth; density 0.232 → 0.199); **F23 blocked** (author-only) and **V4 count** (DDD about 25–32, Layered 32–39 expected blocking findings; V4 ADR triggered); **mined-rule baseline** on the 15 external repositories (6/273 declared blocking findings recovered). | `Docs/DiagnosticRuns/v1.3-*-2026-10-18.md`; PRs #252, #253 |
| 2026-10-19, 01:49 | Extractor fixes N33/N32 and N38 (G04, G05), behind options off in v1.2E and on in v1.3; seeded MO-H06 optional form 0/40 → 40/40; real repositories not re-run. | PR #253 |
| 2026-10-19, 02:33–03:20 | v1.4 U2: declared post-seal rules (ADR-V14-01 FF-S02 in DDD; ADR-V14-02 FF-P07; ADR-V14-03 report schema); fixture delta 1 row of 83, no verdict change; replication `--fast` PASS 4,366 / FAIL 0 before and after. U7: MEAN-01 meaning analysis script (dry run on simulated sheets; 0 labels). | PRs #255, #258, #260 |
| 2026-10-19, 03:33 | `ops/` working surface merged with the brownfield and drift results files; BF-01 LLM norm-derivation pilot (2 repos × 3 runs per arm; files-only arm 27/27 declared findings, graph arm unused) and re-pilot v2 (9 of 18 sessions; Gemini arm 0 of 6). | PR #252; `Docs/DiagnosticRuns/v1.3-brownfield-llm-*-2026-10-19.md` |
| 2026-10-19, 03:56–04:56 | v1.4 U3 (A2 facts contract, semantic rules, N4 fragmentation, mock only), U4 (violation identity and drift metric D; fix-mining survival reproduced; D on three floor-probe runs 1, 2, 5), CI self-evaluation fix, dated list of the v1.4 post-seal deviations (three declared, M3 pending). | PRs #254, #256, #261, #262 |
| 2026-10-19, 05:26–06:08 | v1.4 U8 efficiency harness (stub runs only), U5 Study 2 evasion check (M6, candidate text, dry run) and Gemini generator adapter (dry run; S4 probe not run), amendment A1 "the graph complements reading" (author, after the brownfield pilot). | PRs #259, #257, #263 |
| 2026-10-19 | Daily thesis sync: 870 claims from the reports, the v1.4 documents and the `ops/` surface (C5947–C6816, four parts `v14-*`), conflicts K187–K228, nulls M32–M82, chronology rows 22–33, open items refreshed. The private thesis draft was updated from the ledger in a separate PR. | this entry; sync PRs listed in `.sync-state.json` |

## What the timeline shows for the thesis

1. **The order of decisions and data is on record.** The rule tiers were fixed before any v1.3 data, but after Study 1. ADR-V13-01 is the only human decision taken before the data it affects. The hold-out was sealed and then enlarged after development results existed (chronology rows 4 and 6). The Study 2 outcome switch is a declared deviation, made after the pilot and the probes and before any Study 2 task was written or any arm comparison existed.
2. **Most v1.3 evidence is less than 48 hours old and was produced by AI sessions under delegation.** The audit trail (commits, PR numbers, the replication package) is what makes it checkable. The independent human checks the protocol asks for (second rater, adjudication) have not been done.
3. **The two runs that would turn development evidence into confirmatory evidence have not happened:** the sealed hold-out and Study 2.
4. **The Study 2 design is moving again.** The author decided on 2026-10-18 to redesign Study 2 around drift (M3) and to add two post-seal blocking rules (D5, N3). Until M3 has its dated deviation record, the design in force is the declared deviation of 2026-10-16; the thesis should describe that design and name M3 as pending.
