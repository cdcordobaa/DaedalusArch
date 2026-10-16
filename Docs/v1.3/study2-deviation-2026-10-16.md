# Study 2 declared deviation: primary outcome switched to the level outcome Y (2026-10-16)

<!-- study2-protocol: primary=Y-distinct-blocking-edges-at-step-k; k=4; arms=none,daedalus-mcp; unit=distinct-edge; fallback=do-not-run; order=freeze,hold-out,dress-rehearsal,pre-registration,gate,run; generators=claude-sonnet-5-5,codex-pin -->

**Status: declared deviation, dated 2026-10-16. Not a pre-registration.** The author decided it on 2026-10-16 at 13:50 UTC, under the delegation "unblock everything". An AI session wrote it down as the author decided it and did not take the decision. Study 2 has not been pre-registered (`study2-outline-v2.md` header; gate D10 RED), so this changes a plan, not a registration. It is still a change made **after** the loop pilot, three floor probes and the precedent probe were seen. The thesis therefore reports it as a **deviation** from the pilot memo's pre-committed rule, not as an addendum written before the data (gate rule 1).

This record is the single source for the Study 2 protocol. Where another document disagrees with §2 below, this record wins. Every amended document carries the same machine-readable protocol line (the HTML comment above). `scripts/v1.3/protocol-consistency-check.mjs` (`npm run lint:protocol`) fails if any of those lines differs from the block in §2, or if a protocol document still states a superseded value outside a marked superseded passage.

No sealed directory and no `.env` was read to write it. It names no sealed task.

## 1. What changes, in one paragraph

Study 2's primary outcome is no longer the one that `pilot-outcome-memo.md` §5 selects (a blocking slope on the positive branch, an advisory-per-KLOC slope on the zero branch). It becomes **Y: the number of distinct blocking violating edges in the step-k snapshot**, with k = 4. Y is compared between two arms, `none` and `daedalus-mcp`, crossed with spec rungs (`floor-escape-design-2026-10-16.md` §3). The memo §5 outcomes stay in the protocol as **registered secondary outcomes**, reported in full. The memo's §5 branch is recorded below (§4) and reported beside every Study 2 result.

## 2. The protocol after this deviation

```study2-protocol
primary=Y-distinct-blocking-edges-at-step-k
k=4
arms=none,daedalus-mcp
unit=distinct-edge
fallback=do-not-run
order=freeze,hold-out,dress-rehearsal,pre-registration,gate,run
generators=claude-sonnet-5-5,codex-pin
```

| Item | Value | Replaces |
|---|---|---|
| Primary outcome | **Y**, distinct blocking violating edges present in the step-k snapshot, per run (`floor-escape-design` §3.4). Blocking tier at its sealed hash. Only findings that `check-correct.ts` labels `correct` count. ITT: every snapshot is scored. | Memo §5 branch outcome (`study2-outline-v2.md` §4; gap plan Decision 5; gate D10) |
| Count unit | **One count per distinct edge** (source file → target). FF-S01 and FF-S03 on the same edge count once. A cycle counts once, as its sorted file set. The raw per-rule count is reported as a sensitivity analysis. | Outline A26 and §4.3 ("raw count, distinct-edge sensitivity") |
| Secondary outcomes (registered) | The memo §5 outcomes as the memo defines them: new blocking identities at steps ≥ 2, the per-run blocking slope, and the advisory slope per KLOC without FF-CV05. Plus the secondaries of `floor-escape-design` §3.4. | — (the memo outcomes were primary-candidates) |
| Arms | **`none`** and **`daedalus-mcp`** (9 spec-only tools, `evaluate_project` denied, no neural tools). The same attention sentence in every arm. **`gate` is dropped**, and with it the self-review placebo. | Outline §3.1 (three arms); dress rehearsal arm list; gap plan 5.5 "gate contrast" |
| Cells | none@L2, none@L3, none@L4, mcp@L2, mcp@L4 (`floor-escape-design` §3.3) | — |
| Confirmatory contrasts | H1 none@L2 vs none@L3; H2 none@L2 vs mcp@L2; H3 none@L4 vs mcp@L4. Paired two-sided block sign-flip, Holm over the contrasts that remain confirmatory after §5's power rule. | Outline §6.2 (Holm over `gate` and `mcp`) |
| Horizon | **k = 4.** Every confirmatory task puts each defining pressure of its style in steps 1–4. | Outline T6 ("k = 6 if possible"); task guide §2 ("k ≥ 5") |
| Generators | **`claude-sonnet-5-5`** and the registered **Codex pin**. The run is scheduled after the Codex pin is available again (about 2026-11-09). Gate V10(a) is **not waived**: if the Codex pin is unavailable or fails S4 at the run commit, Study 2 does not start. | Floor-escape Decision 3A ("V10 waiver note"); dashboard AD5 option A |
| Block | Task × replicate × generator. Block differences are pooled over generators (A20); per-generator contrasts are descriptive. | — |
| Fallback if neither confirmatory stratum passes the validation pilot | **Study 2 does not run.** The thesis takes the honest-null route (`floor-escape-design` §5, as amended): the floor is reported as a measured mechanism result from the development and rehearsal evidence, with the design and readiness evidence. | Floor-escape §4 "runs the memo section 5 branch" (gate D1 blocks that branch) |
| Order | Validation pilot → instrument freeze → sealed hold-out → dress rehearsal → pre-registration → gate re-verification and the author's go → Study 2 once (§6) | Floor-escape §3.1 step 5 (gate before rehearsal and pre-registration) |
| Waivers | None added. Only lines marked [W] in the gate may be waived, as before. V10(a), D1, D3 and V4 have no waiver. | Floor-escape Decision 3A; gap plan 5.5 "or a dated decision accepting less" |

## 3. Rationale

1. **The floor was seen only on development and rehearsal tasks.** Every observation of the floor comes from E1, the agent proof, the loop pilot tasks, floor probes 1–3 and the precedent probe (`floor-escape-design` §1). None of them used a sealed Study 2 task, and none was an arm comparison on Study 2 material. The sealed task list was not opened (`sealed-hashes.md`; outline v2 header). The deviation is therefore informed by the outcome's **base rate** on non-Study-2 tasks, and by no arm difference on any task.
2. **Study 2 is not pre-registered.** By the author's decision nothing has been registered (`study2-outline-v2.md:3-6`; gate D10 RED). The memo is "not a pre-registration" either (`pilot-outcome-memo.md:3`). What the deviation breaks is the memo's own pre-commitment ("No other pilot result may change Study 2's primary outcome", `pilot-outcome-memo.md:69`). That is why it is declared here, dated, with its timeline, and reported as a deviation.
3. **The memo route cannot run.** The §5 branch is the zero branch (§4). Under the zero branch the primary outcome is the advisory slope per KLOC, with power ≤ 0.08 in every option (`study2-power-notes.md`; rehearsal ≈ 0.05), and the pilot's `none` slopes without FF-CV05 were negative (−0.50, −0.58). Gate D1 requires that the pilot shows the advisory density growing per step under that branch, and D1 has no waiver. So the memo route ends in "Study 2 does not start" in any case (`study2-outline-v2.md` §4.3, last bullet).
4. **The level outcome measures what the probes found.** Where agent code did show blocking violations (Layered, probe 1), they were set at steps 1–2 and replicated, not accumulated (`level-power-sim-2026-10-16.md` §1 trajectories). A slope reads that as zero erosion. A level at step k measures it directly.
5. **The memo's outcome is kept, not hidden.** The memo §5 slope and new-identity outcomes stay as registered secondaries (memo §5 slope stays a registered secondary, as the author decided). An examiner can read the result the pre-committed rule would have given beside the result of the deviated protocol.
6. **What it costs, stated now.** Some examiners will treat the switch as an outcome switch after data. The honest answers are items 1–3 and the timeline in §7: the switch was made before any Study 2 task was written, before any arm comparison existed, and with the memo's own branch recorded first. It does not remove the objection; it bounds it.

## 4. The memo §5 branch, recorded first

The DDD pilot snapshots were scored offline under memo §5 on PR #229 (`v1.3-pilot-t1-options:Docs/DiagnosticRuns/v1.3-pilot-t1-options-2026-10-16.md`, commit `fe054877`, 2026-10-16T11:26Z; open, base `v1.3-pilot-run`).

| T1 scoring option (#229) | DDD `none`, blocking at steps 1–4 | New at steps 2–4 | §5 branch |
|---|---|---|---|
| a not-applicable, c exclude, d vacuous | 1, 1, 1, 1 | **0** | **zero branch** |
| b reject at freeze | unscored | — | undetermined |
| status quo | unscored | — | undetermined |

With Clean 0 and Hexagonal 0 new blocking findings (loop pilot, PR #170), **the §5 branch is the zero branch** under every option that scores the DDD snapshots at all.

Limits of this record:

- **Pilot T1 is still open.** #229 adds opt-in options, off by default, and is not merged. The author's T1/D15 choice (dashboard AD2) is not taken. The branch above is the one #229's re-score shows; it becomes final when the chosen option is merged with its ADR and a development-set check, and the 8 snapshots are re-scored on `v1.3`.
- **Engine.** #229 re-scored with `cypher-interp`. Neo4j is the engine of record (gate D8). The re-score on `v1.3` uses Neo4j. If it gives a different count, the branch is re-recorded here by a dated note; the deviation itself does not depend on which branch obtains (§3 items 1–4).
- **Construct gap.** On these trees FF-DT01 and FF-DT02 cannot fire under any option, so the DDD zero rests on 5 of the style's 7 blocking rules (#229 §5). The §5 note carries that limit.
- **Re-score dependency.** #229 used a fresh `npm ci` of the pinned skeleton, because the pilot machine's `work/node_modules` was not kept.

## 5. Grid and power, sized from the level simulation

Source: `level-power-sim-2026-10-16.md` (PR #234, `results/v1.3-level-power-sim/`). The simulation's block model treats every block alike, so a second generator adds blocks: 4 tasks × 3 replicates × 2 generators = **24 blocks**, the simulation's 24-block rows (listed there as 6 × 4).

**Registered grid (proposal for the pre-registration):** 4 confirmatory tasks × 3 replicates × 2 generators × 5 cells × k = 4 = **480 confirmatory step turns**, plus the Hexagonal zero control (2 tasks × {none@L2, mcp@L2} × 2 replicates × 2 generators × k = 4 = 64 turns).

| Scenario (none@L2 mean), independent cells (shared frailty in brackets where the simulation reports it) | RR | H1 | H2 | H3 |
|---|---|---|---|---|
| Layered as measured (5.33) | 0.25 | 1.00 | 1.00 | **0.92** |
| Layered as measured (5.33) | 0.5 | 0.88 (0.99) | 0.88 (0.99) | **0.70** (0.86) |
| Layered as measured (5.33) | 0.75 | 0.18 | 0.17 | 0.15 |
| Mean 3 | 0.25 | 1.00 | ≈ H1 | **0.69** |
| Mean 1.5 (the validation pilot's go threshold) | 0.25 | 0.90 | ≈ H1 | **0.31** |

**The design targets large effects: an arm that cuts the level to a quarter (RR ≤ 0.25).** That is the stated limit:

- A halving (RR 0.5) is detected for H1 and H2 only, and only on the measured Layered base rate. H3 at RR 0.5 is below 0.80 under independent cells.
- A 25 % reduction (RR 0.75) is not detectable at any swept size (≤ 0.18).
- The figures assume the Codex pin has the same base rate and dispersion as Sonnet. No Codex loop run exists, so this is an assumption, stated as such.
- The Layered base rate comes from probe 1 (one Opus session, before the composition-slot repair). After the repair the mean may fall (2.67 in the simulation's repaired row), and DDD has never been scored on agent code.

**Power rule, fixed now (gate D3, no waiver):**

1. After the validation pilot, re-run `scripts/v1.3/level-power-sim.ts` with the pilot's step-4 Y mean and θ per stratum, at the registered 24 blocks.
2. Any contrast below 0.80 at RR 0.25 is **demoted to secondary before the pre-registration is written**. Holm then runs over the contrasts that remain. This does not relax D3: D3 applies to the confirmatory contrasts, and a demoted contrast is not one.
3. If no contrast reaches 0.80, Study 2 does not run (the §2 fallback).
4. If only one stratum passes the pilot, its 4 confirmatory tasks all come from that style, so the grid keeps 24 blocks (simulation §6 item 5: 2 tasks × 3 replicates of one style cannot reject).

## 6. Canonical order

1. **This deviation record** (done, 2026-10-16).
2. **Memo §5 branch** recorded (§4); finalised after the T1 fix and the Neo4j re-score on `v1.3`.
3. **Instrument repairs and decisions:** pilot T1 and D15 (dashboard AD2), the layered preset composition slot by ADR, the layered frame, L3/L4 frame slots, the attention sentence, hint-audit rules (`floor-escape-design` §3.6).
4. **Validation pilot** on development tasks only (`floor-escape-design` §4), under the go/no-go rule fixed in that section before its first call. Then the power re-run (§5).
5. **Confirmatory tasks** written to T1–T10, hint-audited and sealed. The writer never runs or scores (V10c).
6. **Instrument freeze**, then the **sealed hold-out**, once.
7. **Dress rehearsal** at the candidate run commit, exercising every cell type, both generators and both arms.
8. **Pre-registration** (D10), hashed and checked in CI (S10, S11).
9. **Gate** re-verified at the run commit; the author signs the go (gate rule 4).
10. **Study 2, once**, not before the Codex pin is available (about 2026-11-09).

This is gate rule 5's order with the validation pilot placed before the freeze. Steps 1–4 are the only loop runs allowed before step 7, besides the dress rehearsal itself, and they never touch a sealed task.

**Loop-run rule.** Outline v2 §2 item 1 and gap plan §4 allowed only the loop pilot and the dress rehearsal to run loops. Floor probe 3 (#227) ran loops on rehearsal tasks before this record existed; it is development data, reported as an exploratory probe, and it is listed here as a departure from that rule as it then stood. From this record on, the permitted loop runs before Study 2 are: the loop pilot (done), the validation pilot (step 4) and the dress rehearsal (step 7). Probe 3's `vineyard-harvest` none@L2 run (unscored, T1) is **excluded** from the validation pilot's go/no-go, because it was generated before that rule existed. It is reported separately.

**k = 4 and the rehearsal fixtures.** Probe 3 found that cutting the rehearsal tasks at k = 4 drops each task's step 5, which in `vineyard-harvest` is the cross-context pressure. For the validation pilot, each fixture is used in a dated, hashed k = 4 variant whose step 4 is the original step 5. The variant is committed before the first pilot call.

## 7. Evidence timeline

All times UTC. Commit times are from `git log` on `origin/v1.3` or the named branch.

| When | Event | Where |
|---|---|---|
| 2026-10-14 20:08 | Sealed Study 2 task list hashed; never opened since | `Docs/v1.3/sealed-hashes.md` (`9c3804f8`) |
| 2026-10-15 19:29 | Pilot outcome memo written, before any pilot run; §5 pre-commits the outcome rule | `Docs/v1.3/pilot-outcome-memo.md` (`506b7ce8`, `cd20fddc`) |
| 2026-10-16 01:44 | Readiness gate written: rule 1 (no relaxing after data), D1, D3, D10, V10(a) without waiver | `study2-readiness-gate.md` (`2012aa7a`, PR #146) |
| 2026-10-16 03:22 | Floor probe 1: Hexagonal 0/14 steps; Layered 14/14, a step-1 level that later steps replicate | PR #161, `Docs/DiagnosticRuns/v1.3-floor-probe-2026-10-16.md` |
| 2026-10-16 04:25 | Loop pilot report: Clean 0, Hexagonal 0 new blocking; DDD unscored (T1); §5 not reached | PR #170, `v1.3-pilot-run:Docs/DiagnosticRuns/v1.3-loop-pilot-2026-10-16.md` (`a6946a9d`) |
| 2026-10-16 04:47 | Floor probe 2: 1/24 | PR #182 (`60e9a443`) |
| 2026-10-16 06:41–08:19 | Gap plan (Decision 5: "do not choose (b)"), outline v2 ("v2 does not amend §5"), task-design guide (k ≥ 5) | PRs #192, #194, #201 |
| 2026-10-16 11:23 | Floor-escape design merged: recommends the level outcome (Decision 1 B) | PR #226 (`39196ea1`, merged `dcc12bae`) |
| 2026-10-16 11:24 | Floor probe 3: Clean 0/4, Hexagonal 0/4; DDD unscored (T1) | PR #227 (`b774bc06`) |
| 2026-10-16 11:26 | DDD pilot snapshots re-scored offline under each T1 option: zero branch under a, c, d | PR #229 (`fe054877`, open) |
| 2026-10-16 11:53 | Readiness dashboard: AD1 asks the author to choose A/B/C | `study2-readiness-dashboard.md` (`768d14a3`) |
| 2026-10-16 13:08 | Level-outcome power simulation: k = 4 holds; the design powers RR 0.25, not RR 0.5 for H3 | PR #234 (`74f865dd`) |
| 2026-10-16 13:50 | **Author decision**: AD1 = B as a declared deviation; fallback "do not run"; canonical order; distinct-edge unit; arms `none`, `daedalus-mcp`; k = 4; Sonnet 5.5 + Codex pin; no V10 waiver; grid from the level simulation | this record |

**What was known when the decision was taken.** The §5 branch result (zero, #229) was on a branch about 2.5 hours before the decision. The deviation applies whichever branch obtains (§3 items 1–4), and the branch is reported beside the results. No Study 2 task had been written, unsealed or run, and no arm comparison existed on any confirmatory material.

## 8. Documents amended in the same change

| Document | Amendment |
|---|---|
| `study2-outline-v2.md` | Dated amendment note at the top; §2 item 1 (loop-run rule), §3 arms, §4.2/§4.3, T6, A26, §6.2, R2 and R22 marked superseded with the new value |
| `gap-closing-plan.md` | Decision 5 and step 5.2 superseded by this record; step 5.5 rewritten (demote, not accept less); §4 loop-run rule |
| `study2-readiness-gate.md` | Rule 1 note; D1, D3, D10, D11 restated; D2 per rung |
| `pilot-outcome-memo.md` | Amendment appended; original text unchanged |
| `floor-escape-design-2026-10-16.md` | Fallback, order, T1 status, A26 reference, Decision 3A waiver removed, Decision 1 answered, probe 3 status |
| `study2-readiness-dashboard.md` | AD1 and AD5 answered; critical path steps 2–4 and 8; D1, D3, D10, D11, R-01–R-03 rows |
| `study2-task-design.md`, `study2-dress-rehearsal.md` | Amendment note: k = 4, distinct-edge unit, two arms |

`study2-outline.md` (v1) is a historical document, kept unchanged by its own rule, and is not a protocol document for the check.
