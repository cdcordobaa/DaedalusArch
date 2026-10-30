# Open items: before Study 2 and before the defence

**Compiled 2026-10-16 at 15:10 UTC; refreshed 2026-10-17, 2026-10-19, 2026-10-20 and 2026-10-21 by the daily thesis sync (the 2026-10-21 refresh is §7, which overrides §1–§6 where they differ) (the 2026-10-19 refresh reads the author's decision board record `ops/decisions.md`, the deviation list `ops/notes/deviations-v14.md`, the defensibility register `ops/02-defensibility-conditions.md` and the build list `ops/03-build-list.md`; the readiness dashboard has not changed since 2026-10-16)** (after merge train MT7, #247 and #248; the dashboard itself has not been re-rated since 12:00Z, so the "state now" cells below are this page's reading of the merged evidence, not gate statuses) from the readiness dashboard (`Docs/v1.3/study2-readiness-dashboard.md`, statuses taken at 12:00Z, amended after 13:50Z), the readiness gate (`Docs/v1.3/study2-readiness-gate.md`), the deviation record (`Docs/v1.3/study2-deviation-2026-10-16.md`), the MT6 report (`Docs/v1.3/merge-train-mt6.md`), the distinction-readiness memo (`Docs/v1.3/research/distinction-readiness.md`) and the GitHub list of open PRs at 15:10Z.

This page does not change any gate status. Only the gate decides a go: a line is green only when it is re-verified at the run commit, and only the author signs the go (gate §0). Several PRs that the dashboard listed as open at 12:00Z have since merged (see §3). The lines they feed must be **re-assessed**, not assumed green.

## 1. Before Study 2 (critical path, in order)

The order is the canonical order of the deviation record §6.

| # | Item | Gate lines | State now | Owner |
|---|---|---|---|---|
| 1 | Deviation record (outcome Y, k = 4, arms `none` / `daedalus-mcp`, Sonnet 5.5 + Codex pin, fallback "do not run") | D1, D3, D10, D11 | **Done** (2026-10-16), and the protocol documents are reconciled (#243). | — |
| 2 | Author decisions still unanswered: AD2 (pilot T1, the DDD construct), AD3 (construct sheet), AD4 (independent rater vs non-human evidence), AD6 (judge in Study 2), AD7 (#143 `hints`), AD8 (pre-freeze instrument bundle) | V1, V5, V7, R-02, R-06, R-04 | AD1 and AD5 are answered. On 2026-10-18 the author's decision board settled D1 (construct sheet as written), D2a, D2b, D3, D5, D6, D7, L4, M1–M6, N1–N4, V4, CDX, PRE and S2S (chronology rows 22–31). Still open: the AD items the board did not cover, Q-A to Q-E of ADR-V14-01/02 (Proposed), and **the dated deviation record for M3** (Study 2 redesigned around drift), without which the design in force stays the 2026-10-16 deviation. | author |
| 3 | Pilot T1 fixed on the development set; the 8 kept DDD snapshots scored on `v1.3` with Neo4j; memo §5 branch confirmed (zero under #229 options a, c, d) | D1, D15, S7, R-01, R-02 | #170 and #229 merged (MT7). D-c (chronology row 12) chose per-task declared DDD aggregates; #229's options are opt-in and off, option a not adopted. The per-task declarations and the DDD re-score are **not done**; memo §5 is still not decided (the deviation has already moved the primary outcome to Y). | agent fix; author signs |
| 4 | Instrument repairs for the validation pilot: layered preset composition slot (ADR), layered frame, L3/L4 frame slots, attention sentence, hint-audit rung rule | R-08 | #235 merged (MT7): L3/L4 rungs and attention sentence off by default; hint-audit word lists **on by default** (row 15). L3/L4 have no DDD or Layered frame yet. **D2b (2026-10-18) cancels the layered composition slot**: Layered keeps counting wiring imports, the base rate stays 5.33, and this is stated as a construct limit (`ops/notes/g12-d2b-construct-limit.md`). | agent; author approves |
| 5 | **Validation pilot** on development tasks under its pre-committed go/no-go rule (per style: mean Y at step 4 ≥ 1.5, ≥ 2/3 runs with Y ≥ 1, unmapped ≤ 10 %, 0 evaluation errors), then the power re-run with the pilot's mean and θ; any contrast below 0.80 at RR 0.25 is demoted before pre-registration | R-03, R-08, D3 | Not run. If no stratum passes, **Study 2 does not run** (the honest-null route). | author runs; agent re-runs power |
| 6 | Construct sheet answered (0/25 at 12:00Z), ADR-V13-03, freeze runbook and freeze check (9 of 14 unmet in the #164 dry run) | V1, R-04, F1–F14 | Construct sheet **confirmed as written** (D1, 2026-10-18; chronology row 30). The runbook and freeze check are on `main`; the #164 dry run still shows 9 of 14 checks unmet. Post-seal rules FF-S02 in DDD and FF-P07 are built (#255) and must enter the frozen bundle with their ADRs signed. Neo4j is the hold-out engine of record, the interpreter the cross-check. | author → agent → author |
| 7 | Sealed hold-out run **once** at the freeze commit, Neo4j as engine of record; report as it comes (V4 has no waiver. V4 gates the point estimate; the Wilson lower bound is reported but is not part of the pass (`study2-readiness-gate.md:114`). The count of 2026-10-18 expects about 25–32 DDD and 32–39 Layered blocking findings, so the "Validated" claim level (lower bound ≥ 0.90, about 35 or more findings) is out of reach for DDD; this triggered the V4 ADR of decision V4, drafted 2026-10-19 and unsigned: `Docs/v1.4/adr-v4-holdout-bar.md`, which settles whether the lower bound is part of the pass) | V3, V4 | Not run. | author |
| 8 | Independent second rater and one κ definition, dated before any label | V5, V6 | No rater; three κ definitions. | author (AD4), then agent |
| 9 | Non-Claude generator: Codex pin available (about 2026-11-09) and its S4 confinement probe passes; no waiver | V10(a), S2, S4, S8 | CDX (2026-10-18): Gemini is to replace the Codex pin, with its own S4 probe. The adapter is built and dry-run only (#257); the S4 probe is specified (24 calls, cap 30) but **not run**; CDX is **not yet on the dated deviation list**. #171 and #204 merged earlier; no live non-Claude generator call yet. | author |
| 10 | Harness and telemetry lines | S1, S3, S10, S11, S12, D6, D9, D13, D14, D16, V9 | All merged and to be re-assessed: #180 (fault drills: 11/13 byte-identical resumes; D4c and D5a open; pause times not recorded), #173 (tunables manifest tool; `Docs/v1.3/study2-tunables.json` not yet written), #196 (MCP call log, off by default; D6 checker missing), #203 (determinism pack; author slots A1, A3, A12 open), #206 (stub replay at Study 2 scale; defects F1, F3), #210 (held-out-rule mechanism; the subset G1 is the author's), and earlier #197 (D13), #199 (D8), #200 (D12), #176 (V9), #207 (D7), #205 (D4). The gate-arm stop on an unscored step (row 18) awaits the author's confirmation. | agent; author for local probes |
| 11 | Pre-freeze review fixes and interpreter fixes | R-05 | **Done**: #159 and #151 merged in MT7 (D-b, row 11); #247 and #248 re-tested everything (reference output byte-identical on all engine set-ups; replication `--fast` PASS 4,366, FAIL 0). R15 against live Neo4j and R23 (spec hash in run.json) remain. | — |
| 12 | Dress rehearsal at the candidate run commit | R-07 | Plan only. | author (local) |
| 13 | Pre-registration (outcome Y, memo §5 outcomes as secondaries, arms, tasks by hash, pins, N, analysis, stop rule, tunables), hashed and checked in CI | D10, S10, S11 | None exists, by the author's decision. | agent drafts; author signs |
| 14 | Gate re-verified at the run commit; the author signs the go | all | — | author |

**Budget and power, as registered by the deviation:** 4 confirmatory tasks × 3 replicates × 2 generators × 5 cells × k = 4 = 480 step turns, plus a 64-turn Hexagonal zero control. At 24 blocks the design powers large effects only (RR ≤ 0.25); a 25 % reduction is not detectable at any swept size (deviation §5; level-power simulation, PR #234).

## 2. Before the defence

| # | Item | Why it matters | State | Source |
|---|---|---|---|---|
| G1 | One indexed-journal submission and one oral talk (Art. 32, Art. 30 c) | Binding for a distinction; K5 "missing" | No submission yet | `research/distinction-readiness.md:433` |
| G2 | One main-contribution statement that every chapter serves | K2 "weak (diffuse)" | Draft merged (#220, `Docs/v1.3/contribution-statement.md`); pending author questions Q2 and Q3 (`Docs/v1.3/distinction-author-questions.md`) | `research/distinction-readiness.md:461`; PR #220 |
| G3 | Run the frozen hold-out once and report it as it comes | Turns v1.3 development figures into a held-out estimate; gates Paper 2 and K4 | Not run (item 7 above) | `research/distinction-readiness.md:481` |
| G4 | Study 2 framing fixed before it runs; run only on a green gate; the null route written in advance | K7 depends on the deviation argument | Deviation record done; fallback "do not run" written; R-11 sign-off pending | `research/distinction-readiness.md:489`; dashboard R-11 |
| G5 | Reproducibility release: tag, DOI, path scrub, visibility decision | K6 "strong, with a gap at the edges" | #223 artifact pack merged; no tag or DOI; replication `--fast` green after #248, but `smoke.sh` still exits 1 on the ISE-measure and cheap-proxy outputs (two real defects, fix proposed only; errata class c) | `research/distinction-readiness.md:509`; dashboard R-12 |
| G6 | Honest limitations as a chapter-level asset | Examiners look for it | This compendium's `nulls-and-limits.md` is the source list | `research/distinction-readiness.md:524` |
| G7 | Defence narrative and rehearsal | K9 "missing" | Not started; `timeline.md` is the proposed backbone | `research/distinction-readiness.md:540` |
| G8 | Cheapest open objective gaps: a real model-panel run (needs a new Gemini key), an independent labelling subset, the judge claim narrowed | SO3/SO4 promises of the proposal | Panel harness dry-run only (no real model called); no human labels | `research/distinction-readiness.md:561`; `Docs/v1.3/model-panel.md:3` |
| — | Correct the documents listed in the ledger's conflicts section before any number is quoted in the thesis or a paper (e.g. 2,668 → 2,669 checkable findings; 15 → 19 largest expected blocking cell; "ten of the eleven" → 11 of 11 round-1 seeds; "10 of 15" → 11 of 15 failing external repositories in the evidence summary) | Consistency | Mostly done: #236 merged (41 doc errors corrected in place). `papers/` keeps the old figures by design (the author's wording) and must be corrected before submission; the earlier ledger of #220 repeats some old values (conflicts K179, K181, K182) | `claims-ledger.md` conflicts; `merge-train-mt6.md` |
| — | Re-run `npm run replicate:v1.3` after the MT5/MT6 merges; replication part 2 does not cover the docs added since `5ece0526` (it lists them) | Traceability of the newest numbers | Partly done: #236 full run exits 0 with 2 known; after #248 `--fast` is PASS 4,366, FAIL 0. The full non-fast run after MT7 has not been made. | `Docs/v1.3/replication-2.md` intro |

## 3. Open PRs

On 2026-10-19 there is **no open PR** in DaedalusArch apart from the sync PR; PRs #252–#263 merged on 2026-10-18/19 (see `timeline.md` phase 6). On 2026-10-17 there was no open PR either. MT7 (2026-10-16) merged every PR listed here at 15:10Z (#159, #170, #229, #235, #228, #164, #171, #173, #180, #196, #203, #204, #206, #210, #139, #213, #151, #156, #188, #189, #212, #220, #236, #75, #77), and #247 and #248 followed. The reports that were cited as **exploratory** because they lived on open branches (loop pilot, precedent probe, agent proof, the #229 re-score, fault drills, freeze dry run, advisory filters out of sample) are now on `main`; the ledger rows whose values they confirm were updated in the 2026-10-17 sync.

## 4. Author decisions recorded as open after MT7

| Item | Source |
|---|---|
| Confirm the gate-arm stop on an unscored step (`LOOP_GATE_UNSCORED`) and the resume re-score | `Docs/v1.3/merge-train-mt7.md`, "For the author" (a); chronology row 18 |
| Which advisory filters, if any, become default at the freeze (options-effects D1–D3, AD8 Q2) and sign-off of the `advisoryFilter` report-schema amendment | `Docs/DiagnosticRuns/v1.3-options-effects-2026-10-16.md` |
| Confirm the 9-tool `daedalus-mcp` arm | `Docs/v1.3/replication-errata-2026-10-16.md` |
| Per-task declared DDD aggregates and the DDD re-score (D-c follow-up) | chronology row 12 |
| The held-out rule subset (G1, A-G1a/b/c) and the grid proposals F2–F4, drill options R1/R2 | `Docs/v1.3/gate-heldout-rules.md`; `Docs/v1.3/grid-scale-replay.md`; `Docs/v1.3/loop-fault-drills.md` |
| FF-CV03 selection fix (option B, Q10) | `Docs/v1.3/fx2-status-2026-10-16.md`; `Docs/v1.3/distinction-author-questions.md` |
| Run CHECK-3 (only if AD6 = C) and the K-G third manifest with a non-Claude writer | `Docs/v1.3/judge-check3-plan.md`; `Docs/v1.3/third-manifest.md` |
| Author questions Q1–Q10 (distinction gaps) | `Docs/v1.3/distinction-author-questions.md` |

## 5. Opened by the 2026-10-18 board and the v1.4 units (refresh of 2026-10-19)

The defensibility register (`ops/02-defensibility-conditions.md`, 2026-10-18) tallies 27 conditions: 5 green, 8 amber, 5 red, 9 not started. Done since 2026-10-17: extractor fixes N33/N38 (#253); post-seal rules FF-S02 in DDD and FF-P07 (#255, #260); A2 facts, semantic rules and N4 (#254, A1 in #263); violation identity and drift D (#256); evasion check and Gemini adapter, dry run (#257); meaning analysis script (#258); efficiency harness (#259); blind-recall root cause, mined baseline, BF-01 pilot and partial re-pilot (9 of 18 sessions).

| Item | Owner | Source |
|---|---|---|
| **M3 dated deviation record** (Study 2 around drift): new primary D, new power simulation, deviation record and readiness gate updates, director at design stage. Until it exists, the thesis describes the 2026-10-16 deviation (Y at step 4, `none` vs `daedalus-mcp`). | agent drafts; author and director | `ops/notes/deviations-v14.md:16`; `ops/notes/s2d-01-study2-drift-design.md` |
| CDX entry on the dated deviation list, and the Gemini S4 probe | agent; author runs | `Docs/v1.4/gemini-s4-probe-spec.md` |
| V4 ADR (pass per Study 2 style; the count triggered it) | agent drafts; author signs | `Docs/DiagnosticRuns/v1.3-f23-and-v4-count-2026-10-18.md` |
| ~~F23: compare the 18 candidate domains with the sealed list (agents may not)~~ **Done 2026-10-19** (two demo tasks replaced) | author | same report, Part 3 |
| Adjudicate the 9 spec–manifest disagreement rows (U6 sheet) | author | `aidlc-docs/construction/v1.4/U6/functional-design/adjudication-sheet.md` |
| Q-A to Q-E of ADR-V14-01/02 (mechanism, FF-P07 list and tiers, MCP fast path, hold-out scope) | author | `Docs/v1.4/adr-v14.md` |
| MEAN-01 sign-off (dated κ definition, R3–R5), rater booked and checked against V5; 0 labels so far | author | `ops/notes/mean-01-codebook-and-sample.md` |
| Counted runs with a standing OK, not started: NS pilot (26 calls, cap 40), efficiency test EFF-01 (150 sessions); BF-01 full run (90 sessions) needs a new OK; the re-pilot's Gemini arm ran 6 of 6 on 2026-10-19 (report §10; it shows no added value from the graph) | author runs | `ops/decisions.md`; `Docs/DiagnosticRuns/v1.3-brownfield-llm-repilot-2026-10-19.md` |
| Re-run the extractor fixes on the real repositories (msc29-clean, felixle-node-core) to confirm the expected 99/99 and 884/884 | agent | `Docs/DiagnosticRuns/v1.3-extractor-fixes-n33-n38-2026-10-18.md` |
| Correct the V4 report's DDD count (8/10 → 7/10 variants; about 25–32, not 29–32) and the stale status lines of `ops/03-build-list.md` | agent | claims-ledger conflicts K189–K194, K228 |

## 6. State on 2026-10-20 (refresh after PRs #266–#318)

**This section overrides §1 and §2 where they differ.** The readiness dashboard (`Docs/v1.3/study2-readiness-dashboard.md`) was not re-tallied: it now carries a "Protocol superseded 2026-10-19" banner pointing to the drift record, and its gate count of 2026-10-16 (1 of 42 green) is stale. The latest tally on file is REV-04's of 2026-10-19: 1 GREEN, 1 PARTIAL, 20 AMBER, 20 RED (nulls M171). The plan to Friday (`ops/05-plan-to-friday-2026-10-23.md`) sets a deadline of 2026-10-23 for the Study 2b run and its scoring.

**Overtaken items of §1 and §2.** Item 1: the design in force is now the drift record of 2026-10-19 (`Docs/v1.4/study2-deviation-2026-10-19-drift.md`; primary D over steps 2–5, k = 5, three cells, fallback "run, labelled exploratory"), not the outcome-Y record. Item 6: the construct sheet is answered and signed (2026-10-19), ADR-V13-03 is accepted under delegation, and the freeze is done (tag `v1.4-freeze-2026-10-20`, F1–F14 OK). Item 7 and G3: the hold-out was **attempted twice and not scored**; its one scoring run is unspent, and fallback F-RF applies. Item 9: Gemini failed S4 (runs 1–3) and has no coding cell; Study 2b is Claude-only. Item 12: a dress rehearsal on practice tasks ran (findings F1–F7). Item 13: a Study 2b pre-registration is drafted (PR #316, open). Item 14: the author gave a conditional go (GO-2B: run if the gate is green).

| Item | Owner | Source |
|---|---|---|
| **Study 2b confirmatory run** (4 sealed Layered tasks × 3 cells, Claude Sonnet, about 104 turns) after the readiness gate is re-verified at the run commit; score at the freeze tag. Not run. | coordinator under GO-2B | `ops/05-plan-to-friday-2026-10-23.md`; `Docs/v1.4/study2b-runbook.md` |
| Merge or revise the Study 2b pre-registration (PR #316) before any 2b call | coordinator | `Docs/v1.3/holdout-prespec-addendum-2-2026-10-20.md` §2 |
| ADR-V14-04 §4 parts A (with F-RF, r_f from the development record run; n = 3, 2 and 3 per family) and B must both pass, or Layered drops to exploratory in 2b | coordinator | `Docs/v1.4/adr-v4-holdout-bar.md`; addendum 2 §2 |
| Hold-out: decide whether any later attempt is made (a loader for the patch-format layout, and a disclosure that 34 sealed file paths and the per-style counts were seen by the coordinator) or whether the thesis reports it as not scored | author | `Docs/DiagnosticRuns/v1.4-holdout-2026-10-20.md` |
| The 2 DDD confirmatory tasks are not sealed; DDD stays a beta instrument (D15 open) | author | `Docs/v1.4/confirmatory-tasks-seal.md:25`; `ops/decisions.md:40` |
| Gemini S4 run 4 after the quota reset (about 2026-10-25); Gemini is a dated extension arm only if it passes | coordinator | `Docs/v1.4/gemini-s4-probe-spec.md` |
| Semantic paths C4 and C1d: C4 never run; C1d at smoke level only (a full run needs more than the registered 30 calls per snapshot) | coordinator | `Docs/DiagnosticRuns/v1.4-exploratory-report-2026-10-20.md`; `ops/notes/c4-01-interpretation-design.md` |
| MEAN-01 rater labels (0 so far; field A dated 2026-11-30) and MEAN-02 (sample raised to 18 by D6) | author; rater | `ops/notes/mean-01-codebook-and-sample.md`; `ops/decisions.md:36` |
| Correct the stale lines found by this sync: `ops/notes/deviations-v14.md` (row 7 V4 and X-1/SO3-a still "drafted, unsigned"), `ops/02-defensibility-conditions.md:88` and `:154` (cite `decisions.md:50` for D2b; it is now DELEG5), `Docs/v1.4/adr-v4-holdout-bar.md:41` (`<N_PER_STYLE>` "filled at the freeze"), the garbled "Commit Y fills" line of the prespec, and the conflicts K229–K262 | agent | this sync's conflicts block in `claims-ledger.md` |


## 7. State on 2026-10-21 (refresh after PRs #319–#339)

**This section overrides §1–§6 where they differ.** The readiness dashboard was not re-tallied; the Study 2b gate was re-taken instead (`Docs/v1.4/study2b-gate-verdict.md`, GO-READY-FOR-AUTHOR, deviations DA1–DA7), and the author gave the go (GO-2B-RUN). **Done since §6:** the 2b pre-registration was registered (PR #316) and deposited on OSF (osf.io/wctnh); Study 2b ran (40 of 40 blocks per cell) and had its one registered scoring pass (`Docs/DiagnosticRuns/v1.4-study2b-results-2026-10-21.md`: H1, H2 supported; H3 not rejected; E fails); ADR-V14-04 part B passed, so Layered stayed confirmatory; hold-out attempt 3 was made (aborted, not spent, DELEG-H4). The 2b deadline of Friday 2026-10-23 is met for the run and its primary scoring.

| Item | Owner | Source |
|---|---|---|
| **C4 / D_sem on 2b**: the C4 pilot (pairs 1–2) and then the six-case set must pass with the Claude configuration before any C4 call on 2b; then `dsem-provenance.ts` and the `--dsem` analysis (descriptive). If the bars fail, D_sem is reported "not run" | coordinator | results report §5 item 1; `ops/notes/sem-01-semantic-validity-plan.md` |
| C1d on the 12-snapshot seeded 2b sample, with its cap fixed and dated first | coordinator | results report §5 item 2 |
| Evasion item 5 (blind read of moved-only code, a human read) and item 4 (literal view, only if a tool is registered) | author (item 5); coordinator | results report §5 item 3; addendum 3 DA11 |
| V5 independent labels after the study; MEAN-01 rater labels (field A dated 2026-11-30) | author; rater | `Docs/v1.4/study2b-gate-verdict.md:29`; `ops/notes/mean-01-codebook-and-sample.md` |
| Commit the full per-file archive manifests once their sealed task ids can be shown | coordinator | `Docs/DiagnosticRuns/v1.4-study2b-collection-2026-10-20.md:68` |
| Gemini extension arm (same sealed tasks and cells, N = 40) only if its S4 passes after the quota reset (about 2026-10-25), with its addendum dated before its first call | coordinator | `Docs/v1.4/study2b-preregistration.md:83` |
| Hold-out: any later attempt needs a spec-format fix under a content-change delegation and its own addendum, and would count as the first scoring run; otherwise the thesis reports it as not scored | author | `ops/decisions.md:44` |
| HEXDDD-01: use its one allowed revision after the FAIL (a real-repo seed)? Approve or change the PUZZLE-01 pilot (40 sessions, cap 44); decide which DETECT-01 prototypes to promote as a versioned instrument change (after the 2b scoring, now possible) | author | `ops/notes/explore-01-research-log.md:133-137` |
| Correct the stale lines found by this sync: conflicts K263–K272 (gate verdict summary counts and D10 text, the D_sem classifier line, the plan-to-Friday turn budget, the hold-out "spent" wording in the run note and the decisions changelog, the HEXDDD-01 timing and cap, the MEAN-02 size in SEM-01), the stale anchors `ops/notes/sem-01-semantic-validity-plan.md:24` (DELEG6 is now `decisions.md:47`) and `ops/review/2026-10-20/fable-2b-prereg-recheck-2.md:32` (DELEG11 is now `:52`), and `ops/00-overview.md:14` (DETECT-01 and PUZZLE-01 have reported) | agent | this sync's conflicts block in `claims-ledger.md` |
| Thesis: the private thesis sync PRs of 2026-10-17, 2026-10-19 and 2026-10-20 are still open and were each branched from `main`; they and the 2026-10-21 PR need to be reconciled by the author | author | private repository |

## 8. State on 2026-10-22 (refresh after PRs #340–#361)

**This section overrides §1–§7 where they differ.** The readiness dashboard was not re-tallied (it is historical since the 2b gate was re-taken). **Done since §7:** the Study 2b registered secondaries are closed (addendum 4): D_sem not run (precondition not met), C1d not run (DA14), evasion items 4 and 5 not flagged; the post hoc exploratory 2b analyses; the HEXDDD-01, DETECT-01, PUZZLE-01 and PUZZLE-01 baseline primaries are on `main`, with the baseline hand read; PUZZLE-03 puzzles built; v1.5 inception, COMPREHEND-01, the edit gate, DETECT-02 and U3 built or piloted as exploratory work. The §7 rows on C4 / D_sem, C1d and evasion items 4–5 are closed.

| Item | Owner | Source |
|---|---|---|
| Hold-out: choose between a spec-format fix under a content-change delegation (its own addendum, first scoring run) and reporting it as not scored | author | `Docs/DiagnosticRuns/v1.4-holdout-2026-10-20.md:181` |
| Spot-check two of the item-5 diffs (DA16); the committed record does not yet show it | author | `Docs/v1.4/study2b-preregistration-addendum-4.md:19` |
| Spot-check the deciding PUZZLE-01 baseline case (P2, 0/5 versus 1/5); the counts stay provisional until then | author | `Docs/DiagnosticRuns/puzzle-01-baseline-2026-10-21.md:30` |
| HEXDDD-01: use its one allowed revision (a real-repository seed) or close the pilot | author | `Docs/DiagnosticRuns/pilot-hexddd-01-2026-10-20.md:19` |
| V5 independent labels after the study; MEAN-01 rater labels (field A dated 2026-11-30) | author; rater | `Docs/v1.4/study2b-gate-verdict.md:29` |
| Gemini extension arm only if its S4 passes after the quota reset, with its addendum dated before its first call | coordinator | `Docs/v1.4/study2b-preregistration.md:83` |
| v1.5 units in order U3 → U4 → U6 → U1 → U2 → U5 → U7 (U3 done, U4 note only); PUZZLE-03 baseline (planned, cap 53); COMPREHEND-01 live sessions; edit-gate puzzle sessions; DETECT-02 phases 2–3 (deferred to the usage reset). All exploratory | coordinator | `aidlc-docs/inception/v1.5/workflow-plan.md:24`; `experiments/puzzle-03/plan.md`; `ops/notes/detect-02-precision-note.md:143` |
| If the DETECT-02 held-out check is run, record it as a dated change to the v1.5 constraint "no held-out evaluation in this cycle" (M223) | author | `aidlc-docs/inception/v1.5/requirements.md:29` |
| Correct the stale lines found by this sync: conflicts K273–K283 (addendum 4 changelog "deferred", item 5 "not yet done", HEXDDD-01 hand-read status, the COMPREHEND-01 behaviour-link count, the replication "re-derived" figure, the P2 baseline counts in three `ops/` notes, the HEXDDD-01 family counts in the PUZZLE-01 design); also stale status text in `ops/00-overview.md:17`, `:24`, `:63`, `ops/03-build-list.md:39`, `ops/04-north-star.md:25`, `ops/06-open-tracks-and-capabilities.md:35`–`:36`, `:47` and `ops/notes/v15-plan.md:26` | coordinator | `claims-ledger.md` conflicts (2026-10-22 block) |
| Before citing any literature figure, check its row in the sources ledger (15 of 308 read in full) | author | `Docs/sources/sources-ledger.md:477` |
| Thesis: the private thesis sync PRs of 2026-10-17 to 2026-10-21 are still open, each branched from `main`; the 2026-10-22 PR adds slot files that depend on the 2026-10-21 PR's Study 2b section | author | private repository |

## 9. State on 2026-10-23 (refresh after PRs #362–#371)

**This section overrides §1–§8 where they differ.** The readiness dashboard was not re-tallied (it is historical since the 2b gate was re-taken). **Done since §8:** the PUZZLE-03 baseline, the PUZZLE-02 and PUZZLE-03 hand reads, the PUZZLE-04 gate and pull arms, the COMPREHEND-01 pilot, U4 (S3 pass, S2 fail), DRIFT-01 and its re-scores, the COMPREHEND-02 repo scout and the v1.5 exploratory synthesis, all exploratory. The §8 row on "PUZZLE-03 baseline; COMPREHEND-01 live sessions; edit-gate puzzle sessions" is closed. The §8 rows on the hold-out, DA16 spot-check, V5/MEAN-01 labels, the Gemini arm (now also bound by CONFINE), the DETECT-02 held-out constraint and the sources ledger still stand.

| Item | Owner | Source |
|---|---|---|
| Spot-check the hand reads: PUZZLE-01 baseline c07 (P2 0/5 vs 1/5), PUZZLE-02 draws #3 c04 and #6 c10 (P2 3/5 vs 0/5), PUZZLE-03 picks; all puzzle counts stay provisional until then | author | `Docs/DiagnosticRuns/puzzle-02-tool-arm-2026-10-22.md:186`; `Docs/DiagnosticRuns/puzzle-03-2026-10-23.md:232` |
| Hand read of the PUZZLE-04 trees, and rule on the proposed answer-key categories P1-SG1-c, P2-SG1-e, P5-SG2-a (the gate's P1 and P2 counts depend on them) | author | `Docs/DiagnosticRuns/puzzle-04-2026-10-23.md:30`, `:228` |
| Hand read of the four DRIFT-01 identities | author | `Docs/DiagnosticRuns/drift-01-pilot-2026-10-23.md:184` |
| U4 S2: decide whether the lock form (an unowned set invariant) is D5; S2 waits for this | author | `Docs/DiagnosticRuns/v15-u4-2026-10-23.md:187` |
| COMPREHEND-01: the key revision on P2-P1 | author | `Docs/DiagnosticRuns/comprehend-01-pilot-2026-10-23.md:226` |
| Placebo pull arm (instruction with a tool that returns nothing), proposed by PUZZLE-02 and PUZZLE-04, not run; needs its own approval | author | `Docs/DiagnosticRuns/puzzle-04-2026-10-23.md:270` |
| Fix the P5 step-3 functional test (under-specified) and the P3r/P5 request revisions before any further puzzle run | coordinator | `Docs/DiagnosticRuns/puzzle-04-2026-10-23.md:37`, `:258` |
| Graph facts at scale (GRAPH-SCALE): a caller query, `who_writes` on repositories without declared roots, functional composition (Medusa); before any COMPREHEND-02 run | coordinator | `Docs/DiagnosticRuns/repo-scout-comprehend-02-2026-10-23.md:39` |
| Gates before any v1.5 study: v1.5 code into `src/`; at least 7 tasks per style with behaviour tests; the final-study decisions (incl. the scripted confinement check for any second-vendor arm, CONFINE); the hold-out; meaning labels | author; coordinator | `Docs/DiagnosticRuns/v1.5-exploratory-synthesis-2026-10-23.md:64`–`:71` |
| Correct the lines found by this sync: conflicts K284–K295 (v1.5 synthesis P2 0/5, "0 of 12 trap failures", "n = 3 to 5", the open "12 false hits"; COMPREHEND-01 "-16%"; repo-scout file and LOC ranges and "66"; PUZZLE-04 plan "19 of 19" and the per-puzzle latency; U4 "111 trees") | coordinator | `claims-ledger.md` conflicts (2026-10-23 block) |
| Thesis: the per-task mean D sentence for Study 2b (build desk Q-20261023-1) has no source line to cite: the exploratory analyses report gives sums (ΣD) only. A line stating the means is needed in the report before the ledger can carry them | coordinator | `Docs/DiagnosticRuns/v1.4-study2b-exploratory-analyses-2026-10-22.md:19`–`:22` |

## 10. State on 2026-10-23, second refresh (after PRs #373–#375)

**This section overrides §1–§9 where they differ.** The readiness dashboard was not re-tallied (it is historical since the 2b gate was re-taken). **Done since §9:** GRAPH-SCALE (U1 groundwork, zero calls), which answers the §9 row "Graph facts at scale" on development material; the Study 2b per-task mean D addendum, which closes the §9 row on build desk Q-20261023-1 (ledger C10194–C10201; the private thesis cites the addendum since its PR #31); and the full-text check of the four closest works (sources read in full now 19 of 308, which updates the §8 row on the sources ledger). The other §9 rows still stand.

| Item | Owner | Source |
|---|---|---|
| GRAPH-SCALE: whether `callers` should count base-interface members on base-typed receivers (BS-C3), and whether truth revision R1 becomes the truth for class ports in COMPREHEND-02 | author | `ops/notes/explore-01-research-log.md:393` |
| U1 proper: promote the GRAPH-SCALE fixes from `experiments/detect-02/` into `src/` and run FR-1's fidelity test | coordinator | `aidlc-docs/aidlc-state.md:154` |
| COMPREHEND-02: choose the trees (recommended Backstage, Novu, Medusa) now that the graph changes the scout asked for exist | author | `ops/notes/explore-01-research-log.md:394` |
| Correct K296: the GRAPH-SCALE summary gives `who_writes` precision on Novu as 95–100%; its table gives 63–95% | coordinator | `Docs/DiagnosticRuns/graph-scale-2026-10-23.md:20` |
| `aidlc-docs/audit.md` on `main` carries unresolved merge-conflict markers from the GRAPH-SCALE merge (both sides' entries are present; only the `<<<<<<<`, `=======` and `>>>>>>>` lines need removing, as an append-only correction note) | coordinator | `aidlc-docs/audit.md:3124`, `:3138`, `:3144` |
| Tech-talk material: the banner "100% test coverage. Zero architectural compliance." beside the ImpossibleBench citation is not a figure from that paper; drop the attribution before the deck is reused | author | `Docs/sources/sources-ledger.md:481` |

## 11. State on 2026-10-25 (refresh after PRs #377–#378)

The readiness dashboard (`Docs/v1.3/study2-readiness-dashboard.md`) did not change in this window; §1–§10 stand. One item is added and one is confirmed still open.

| Item | Owner | Source |
|---|---|---|
| zod GHSA-mrhx-c7xc-m3w5 accepted as a residual risk: migrating to zod 4 is deferred to a dated instrument revision; decide whether that revision happens before any v1.5 study or the artifact deposit | author | `Docs/DiagnosticRuns/bt-audit-triage.md:5`; `scripts/lib/audit-allowlist.json` |
| `aidlc-docs/audit.md` merge-conflict markers (§10): still present on `main` at `07da8fdb` (3 marker lines) | coordinator | `aidlc-docs/audit.md:3124`, `:3138`, `:3144` |

## 12. State on 2026-10-27 (refresh after PRs #381–#398)

The readiness dashboard (`Docs/v1.3/study2-readiness-dashboard.md`) did not change in this window. The design in force moved: the v1.5 final-study register (`ops/decisions.md:12`) and the admission results of 2026-10-27 define a Hexagonal + DDD study that is not yet registered. §1–§11 stand for the v1.3 gate items. New or changed items:

| Item | Owner | Source |
|---|---|---|
| Confirmatory families fixed by admission: DDD on 7 of 16 rows (CAL-02), Hexagonal on H01, H02, H04, H05 (HCAL-02); everything else is exploratory. Check that the thesis states which rows are confirmatory | agent / author | `Docs/DiagnosticRuns/v15-cal02-admission-2026-10-27.md:40`; `v15-hcal02-admission-2026-10-27.md:36` |
| The nine non-admitted DDD rows need a fresh sealed set (CAL-03) before any can be admitted; no CAL-03 is planned in the repository | author | `v15-cal02-admission-2026-10-27.md:59` |
| H06 (business rules in an adapter) and K12 (calculation outside the aggregate) have no working rule: neural-path candidates and Kap9 roadmap items | author | `v15-hcal01-2026-10-27.md:44` |
| R-D5S (declared-invariant rule) stays exploratory; changes need a new unseen set and are a Kap9 item | author | `v15-d5s-unseen-2026-10-26.md:46` |
| Stage 1 pilot (week of 2026-11-02), freeze and registration by 2026-11-09, run 2026-11-09 to 2026-11-20, scored by 2026-11-27. The chain slips if the sealed tasks are not ready by 2026-11-06 | author / agent | `ops/decisions.md:34` (C12) |
| The 24-task study set (12 DDD, 12 Hexagonal) is committed (`experiments/trap-families/study-set.json`) without a report; the C7 deviation (blind-built trap-family tasks instead of author briefs) is recorded | author | `ops/decisions.md:144` |
| Stage 0 item 3 (scripted S4 confinement check on the edit gate) is open; v1.5 is not tagged | agent | `Docs/DiagnosticRuns/v15-stage0-rescore-2026-10-26.md:129` |
| Full jest suite: 32 suites failed in the Stage 0 worktree, attributed to the environment and not confirmed on `main`; check CI | coordinator | `v15-stage0-rescore-2026-10-26.md:150` |
| Hold-out: one more attempt under a dated addendum (D1); rater booking by 2026-11-30 (D2) | author | `ops/decisions.md:35` |
| `ops/01-instrument-map.md` was rewritten (PR #382); the earlier draft v3 is archived verbatim for the ledger rows that cite it | coordinator | `Docs/v1.3/compendium/archive/instrument-map-v3-2026-10-18.md` |


## 13. State on 2026-10-28 (refresh after PRs #399–#403)

The readiness dashboard did not change in this window. Changes to the items in section 12:

| Item | Owner | Source |
|---|---|---|
| CAL-03 is now designed (160 cases, 2 new domains, 16 rows scored including the 7 admitted by CAL-02) but not built or scored; the confirmatory DDD family is open until it runs. Check that the thesis does not present the CAL-02 rows as the final family | author / agent | `ops/notes/cal-03-admission-design.md:25` |
| CN-02 revised the DDD rules after reading the CAL-02 misses; CAL-02 is development evidence from now on. K06, K11, K13 still miss | agent | `Docs/DiagnosticRuns/v15-cn02-dev-2026-10-27.md:60` |
| The pre-flight check of the frozen schema was changed (PR #403) without a report; the sealed rule hash changes with CN-02 | agent | `Docs/DiagnosticRuns/v15-cn02-dev-2026-10-27.md:73` |

## 14. State on 2026-10-29 (refresh after PRs #404–#429)

The readiness dashboard did not change in this window. Changes to the items in section 13:

| Item | Owner | Source |
|---|---|---|
| CAL-03 has run: 9 of 16 DDD rows admitted (36/36), K07 out. The thesis must not present the CAL-02 family (7 rows) or the CN-02 figure "13 of 16" as the DDD family | author / agent | `Docs/DiagnosticRuns/v15-cal03-admission-2026-10-28.md:49` |
| The Hexagonal family is 9 rows (H01 to H05, H07 to H10); H06 and H11 stay exploratory | agent | `Docs/DiagnosticRuns/v15-hcal05-admission-2026-10-29.md:50` |
| The v1.5 final study has run: H1 (DDD) supported, H2 (Hexagonal) not rejected. Check that the thesis states the Study 2 design as the v1.5 registration and not as the 2026-10-16 deviation or the three-arm plan | author | `Docs/DiagnosticRuns/v15-final-study-2026-10-29.md:23` |
| H2 tested an arm that did not deliver the Hexagonal admitted rules (hub: R-D4, R-XCTX and layer rules only). A new registered study is needed to test delivery of those families | author | `Docs/DiagnosticRuns/v15-final-study-2026-10-29.md:47` |
| N1(b) not run (snapshots not retained, DEV-2); N2 not run (pilot 16/21 against 0.80). Decide whether to repeat N2 with a human reference | author | `Docs/DiagnosticRuns/v15-n2-dsem-pilot-2026-10-29.md:3` |
| The N2 reference is a model panel (DEV-1) that shares a model family with the interpreter; a human spot-check is not done | author | `Docs/v1.5/final-study-preregistration.md:169` |
| The lane `run/*.jsonl` records were not committed; consider adding them (or their summaries) to the replication package | agent | `Docs/DiagnosticRuns/v15-final-study-2026-10-29.md:101` |
| DETECT-02 held-out is spent (10 of 14, descriptive); no numeric bar was registered. Any later use is development material | agent | `Docs/DiagnosticRuns/detect-02-heldout-2026-10-29.md:114` |
| The sealed v1.3 hold-out of the original Study 2 design is still unscored; the SO5 taxonomy codebook is a first-coder draft (no second coder yet) | author | `experiments/so5-taxonomy/README.md:26` |

## 15. State on 2026-10-30 (refresh after PRs #430–#454)

The readiness dashboard did not change in this window. New or changed items:

| Item | Owner | Source |
|---|---|---|
| H11 failed to be admitted a second time (HCAL-06 13/16, HCAL-07 14/16); H11-SEM met the bar on 6 positives in total; H03 had 1/6 false positives on HCAL-06 and 0/6 on HCAL-07; H07 3/3. `ADMITTED_HEX_ROWS` is unchanged. Decide whether H11-SEM, H03 and H07 stay or enter the Hexagonal family and what to write for H11 | author | `Docs/DiagnosticRuns/v15-hcal07-admission-2026-10-30.md:168` |
| The thesis must not describe the Hexagonal family as 9 rows confirmed again on HCAL-06 or HCAL-07: those rounds did not change the family | agent | `Docs/DiagnosticRuns/v15-hcal06-admission-2026-10-30.md:121` |
| DEV-3: the thesis must state that the final study's arm delivered only R-D4, R-XCTX and layer rules, and that the drop-no-trap sensitivity is one-arm-conditioned | agent | `Docs/v1.5/final-study-preregistration.md:194` |
| A Hexagonal delivery study is being drafted (draft PR 451, not merged): the counted set sees 16 of 19 trap failures (0.84) with R-MIRROR2, 4 of 19 without; planning q about 0.7. The renamed-copy tasks are unseen by the counted set | author | `Docs/DiagnosticRuns/v15-hx-trap-coverage-2026-10-30.md:3` |
| Pilot ladder: p2, p5 and p6 have no level in the band, and p3 and p5 variants fail functionally because of a missing facade entry point; repair before reuse | agent | `Docs/DiagnosticRuns/v15-pilot-ladder-2026-10-30.md:86` |
| The SO5 taxonomy codebook is frozen as v1 (kappa 0.709, model panel); six clarifications are proposed and not applied; a human second coder is not done | author | `Docs/DiagnosticRuns/so5-taxonomy-panel-2026-10-30.md:21` |

