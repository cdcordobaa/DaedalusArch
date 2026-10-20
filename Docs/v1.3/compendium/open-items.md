# Open items: before Study 2 and before the defence

**Compiled 2026-10-16 at 15:10 UTC; refreshed 2026-10-17, 2026-10-19 and 2026-10-20 by the daily thesis sync (the 2026-10-20 refresh is §6, which overrides §1–§5 where they differ) (the 2026-10-19 refresh reads the author's decision board record `ops/decisions.md`, the deviation list `ops/notes/deviations-v14.md`, the defensibility register `ops/02-defensibility-conditions.md` and the build list `ops/03-build-list.md`; the readiness dashboard has not changed since 2026-10-16)** (after merge train MT7, #247 and #248; the dashboard itself has not been re-rated since 12:00Z, so the "state now" cells below are this page's reading of the merged evidence, not gate statuses) from the readiness dashboard (`Docs/v1.3/study2-readiness-dashboard.md`, statuses taken at 12:00Z, amended after 13:50Z), the readiness gate (`Docs/v1.3/study2-readiness-gate.md`), the deviation record (`Docs/v1.3/study2-deviation-2026-10-16.md`), the MT6 report (`Docs/v1.3/merge-train-mt6.md`), the distinction-readiness memo (`Docs/v1.3/research/distinction-readiness.md`) and the GitHub list of open PRs at 15:10Z.

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

