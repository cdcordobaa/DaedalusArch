# Open items: before Study 2 and before the defence

**Compiled 2026-10-16 at 15:10 UTC** from the readiness dashboard (`Docs/v1.3/study2-readiness-dashboard.md`, statuses taken at 12:00Z, amended after 13:50Z), the readiness gate (`Docs/v1.3/study2-readiness-gate.md`), the deviation record (`Docs/v1.3/study2-deviation-2026-10-16.md`), the MT6 report (`Docs/v1.3/merge-train-mt6.md`), the distinction-readiness memo (`Docs/v1.3/research/distinction-readiness.md`) and the GitHub list of open PRs at 15:10Z.

This page does not change any gate status. Only the gate decides a go: a line is green only when it is re-verified at the run commit, and only the author signs the go (gate §0). Several PRs that the dashboard listed as open at 12:00Z have since merged (see §3). The lines they feed must be **re-assessed**, not assumed green.

## 1. Before Study 2 (critical path, in order)

The order is the canonical order of the deviation record §6.

| # | Item | Gate lines | State now | Owner |
|---|---|---|---|---|
| 1 | Deviation record (outcome Y, k = 4, arms `none` / `daedalus-mcp`, Sonnet 5.5 + Codex pin, fallback "do not run") | D1, D3, D10, D11 | **Done** (2026-10-16), and the protocol documents are reconciled (#243). | — |
| 2 | Author decisions still unanswered: AD2 (pilot T1, the DDD construct), AD3 (construct sheet), AD4 (independent rater vs non-human evidence), AD6 (judge in Study 2), AD7 (#143 `hints`), AD8 (pre-freeze instrument bundle) | V1, V5, V7, R-02, R-06, R-04 | AD1 and AD5 are answered. The other six are open (dashboard §2). | author |
| 3 | Pilot T1 fixed on the development set; the 8 kept DDD snapshots scored on `v1.3` with Neo4j; memo §5 branch confirmed (zero under #229 options a, c, d) | D1, D15, S7, R-01, R-02 | #170 and #229 are open; #229 is stacked on #170. | agent fix; author signs |
| 4 | Instrument repairs for the validation pilot: layered preset composition slot (ADR), layered frame, L3/L4 frame slots, attention sentence, hint-audit rung rule | R-08 | #235 (all off by default) is open. | agent; author approves |
| 5 | **Validation pilot** on development tasks under its pre-committed go/no-go rule (per style: mean Y at step 4 ≥ 1.5, ≥ 2/3 runs with Y ≥ 1, unmapped ≤ 10 %, 0 evaluation errors), then the power re-run with the pilot's mean and θ; any contrast below 0.80 at RR 0.25 is demoted before pre-registration | R-03, R-08, D3 | Not run. If no stratum passes, **Study 2 does not run** (the honest-null route). | author runs; agent re-runs power |
| 6 | Construct sheet answered (0/25 at 12:00Z), ADR-V13-03, freeze runbook and freeze check (9 of 14 unmet in the #164 dry run) | V1, R-04, F1–F14 | #164 open. | author → agent → author |
| 7 | Sealed hold-out run **once** at the freeze commit, Neo4j as engine of record; report as it comes (V4 has no waiver; with fewer than about 35 expected blocking findings per style its lower bound cannot pass) | V3, V4 | Not run. | author |
| 8 | Independent second rater and one κ definition, dated before any label | V5, V6 | No rater; three κ definitions. | author (AD4), then agent |
| 9 | Non-Claude generator: Codex pin available (about 2026-11-09) and its S4 confinement probe passes; no waiver | V10(a), S2, S4, S8 | #171 (isolation and pins) and #204 (third manifest) open; S4 never run. | author |
| 10 | Harness and telemetry lines | S1, S3, S10, S11, S12, D6, D9, D13, D14, D16, V9 | Open: #180 (fault drills, 11/13 byte-identical resumes), #173 (tunables manifest), #196 (MCP call log), #203 (determinism pack), #206 (stub replay), #210 (held-out rules). Merged since 12:00Z and to be re-assessed: #197 (D13), #199 (D8), #200 (D12), #176 (V9), #207 (D7), #205 (D4). | agent; author for local probes |
| 11 | Pre-freeze review fixes and interpreter fixes | R-05 | #159 (R01..R31) and #151 open; MT6 stopped before #159. | author confirms, then the train resumes |
| 12 | Dress rehearsal at the candidate run commit | R-07 | Plan only. | author (local) |
| 13 | Pre-registration (outcome Y, memo §5 outcomes as secondaries, arms, tasks by hash, pins, N, analysis, stop rule, tunables), hashed and checked in CI | D10, S10, S11 | None exists, by the author's decision. | agent drafts; author signs |
| 14 | Gate re-verified at the run commit; the author signs the go | all | — | author |

**Budget and power, as registered by the deviation:** 4 confirmatory tasks × 3 replicates × 2 generators × 5 cells × k = 4 = 480 step turns, plus a 64-turn Hexagonal zero control. At 24 blocks the design powers large effects only (RR ≤ 0.25); a 25 % reduction is not detectable at any swept size (deviation §5; level-power simulation, PR #234).

## 2. Before the defence

| # | Item | Why it matters | State | Source |
|---|---|---|---|---|
| G1 | One indexed-journal submission and one oral talk (Art. 32, Art. 30 c) | Binding for a distinction; K5 "missing" | No submission yet | `research/distinction-readiness.md:433` |
| G2 | One main-contribution statement that every chapter serves | K2 "weak (diffuse)" | Draft on the held PR #220 | `research/distinction-readiness.md:461`; PR #220 |
| G3 | Run the frozen hold-out once and report it as it comes | Turns v1.3 development figures into a held-out estimate; gates Paper 2 and K4 | Not run (item 7 above) | `research/distinction-readiness.md:481` |
| G4 | Study 2 framing fixed before it runs; run only on a green gate; the null route written in advance | K7 depends on the deviation argument | Deviation record done; fallback "do not run" written; R-11 sign-off pending | `research/distinction-readiness.md:489`; dashboard R-11 |
| G5 | Reproducibility release: tag, DOI, path scrub, visibility decision | K6 "strong, with a gap at the edges" | #223 artifact pack merged; no tag or DOI; replication smoke exit 1 at the `v1.3` head per #215 (dashboard R-10) | `research/distinction-readiness.md:509`; dashboard R-12 |
| G6 | Honest limitations as a chapter-level asset | Examiners look for it | This compendium's `nulls-and-limits.md` is the source list | `research/distinction-readiness.md:524` |
| G7 | Defence narrative and rehearsal | K9 "missing" | Not started; `timeline.md` is the proposed backbone | `research/distinction-readiness.md:540` |
| G8 | Cheapest open objective gaps: a real model-panel run (needs a new Gemini key), an independent labelling subset, the judge claim narrowed | SO3/SO4 promises of the proposal | Panel harness dry-run only (no real model called); no human labels | `research/distinction-readiness.md:561`; `Docs/v1.3/model-panel.md:3` |
| — | Correct the documents listed in the ledger's conflicts section before any number is quoted in the thesis or a paper (e.g. 2,668 → 2,669 checkable findings; 15 → 19 largest expected blocking cell; "ten of the eleven" → 11 of 11 round-1 seeds; "10 of 15" → 11 of 15 failing external repositories in the evidence summary) | Consistency | Open; #236 (replication errata: 41 doc errors, 15 group errors) is open and stacked on an already-merged base, so it only needs retargeting to `v1.3` | `claims-ledger.md` conflicts; `merge-train-mt6.md` |
| — | Re-run `npm run replicate:v1.3` after the MT5/MT6 merges; replication part 2 does not cover the docs added since `5ece0526` (it lists them) | Traceability of the newest numbers | Not re-run | `Docs/v1.3/replication-2.md` intro |

## 3. Open PRs into `v1.3` at 15:10Z

| PR | What | Lines / role | Note |
|---|---|---|---|
| #159 | post-merge review fixes R01..R31 | R-05, pre-freeze (D-b) | MT6 resume point |
| #170 | loop pilot run | D1, D15, S7, S8, D4, R-01, R-02 | decision PR (D-c) |
| #229 | T1 options, DDD re-score | R-01, R-02 | base `v1.3-pilot-run`; retarget after #170 |
| #235 | floor-escape repairs (L3/L4, attention sentence, hint audit, ORM probe) | R-08 | off by default |
| #228 | CHECK-3 bases (no run) | V7 | only if AD6 = C |
| #164 | freeze runbook and check | V1, V3, R-04 | do not merge before review |
| #171 | loop isolation and CLI pin | S2, S3, D7 | |
| #173 | tunables manifest | S11 | |
| #180 | loop fault drills | S1, D14 | 11/13 resume byte-identical |
| #196 | MCP call log | D6 | FIX-FIRST in the triage |
| #203 | analysis determinism pack | D9 | FIX-FIRST (mislabelled Holm column) |
| #204 | non-Claude blind-manifest harness | V10(a) role split | no live call yet |
| #206 | full-grid stub replay | D14, S9 | |
| #210 | held-out-rule mechanism | D16 | |
| #139, #213 | advisory-noise table; advisory filters out of sample | instrument (off by default) | #213 carries local merges of #139 and #133 |
| #151 | interpreter review fixes (timeout and others) | instrument | merge before #159 (triage Q4) |
| #156 | agent proof | evidence (SO5 context) | report not on `v1.3` |
| #188 | scale: fast evaluation on large codebases | instrument | |
| #189 | precedent probe (0/8 planted vs 0/8 control, null) | R-03 evidence | report not on `v1.3` |
| #212 | options effects (diagnostic) | — | do not merge yet |
| #220 | distinction gaps: contribution statement, an earlier claims ledger and limitations register | G2, G6 | superseded in scope by this compendium; the contribution statement and author questions remain useful |
| #236 | replication errata | consistency | base already merged; retarget to `v1.3` |
| #75, #77, #80 | v1.2e-targeted drafts | — | not to be closed |

Reports that exist only on open branches (loop pilot, precedent probe, agent proof, the #229 re-score, fault drills, freeze dry run, advisory filters out of sample) are cited in the ledger as **exploratory**: their primaries are not on `v1.3`.
