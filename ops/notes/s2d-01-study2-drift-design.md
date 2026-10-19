# S2D-01: Study 2, drift version, a design that can run this week

**Status:** draft for the Fable review and the director, Sun 2026-10-18. Lane C of `ops/03-sprint-plan.md`. It implements M3 = B, CDX = A, PRE = A, S2S = A, M6 = A, D2b = B, and D5 and N3 = B (`ops/decisions.md`). No model call, no Neo4j and no sealed read went into it. The only computation was a CPU-only power simulation (§3). Comment inline with `> AUTHOR:`.

**The objection, stated first.** REV-01 finding 1 says drift moves the floor rather than escaping it, and map v3 moved drift out of Study 2. This design does not dispute that. It answers in three ways. The primary leaves out step 1, so it is not the level outcome under a new name. It is a count summed over steps, not a slope, so the ≤ 0.08 slope power doesn't apply to it. And the pilot bar is written so that if the floor holds, the run reports as exploratory. The base rate is half the level's (2.67 vs 5.33) and rests on three hand-run Opus trajectories. That is this design's biggest risk.

## 1. Outcome

**Violation identity (C1e, formal).** One identity is one distinct blocking edge, source file → target file. This is the deviation's unit: FF-S01 and FF-S03 on the same edge count once, and a cycle is its sorted file set. The identity is scored only if `check-correct.ts` labels it correct, under the blocking tier at the freeze hash, which includes the D5 and N3 rules. A renamed source or target file (git rename detection, similarity ≥ 50 %, the fix-mining RENAMED class) keeps its identity. E_t is the set of identities in the step-t snapshot.

**Primary: D, the drift count.** D is the number of new blocking identities introduced at steps 2…k:

D = Σ_{t=2..k} |E_t \ ∪_{s<t} E_s|, with k = 5.

D is not new. It is the memo §5 secondary "new blocking identities at steps ≥ 2" (deviation §2), now promoted to primary. Promoting a registered secondary is a smaller move than inventing a new metric.

**Why not the cumulative count.** In the `none` arm, the cumulative count |∪ E_t| equals the level Y_k. Probe 1 removed 0 identities at any `none` step (recomputed from `results/v1.3-floor-probe/*/none/step-NN.json`). A cumulative primary would be Y under a new name, which is exactly Fable's point.

**Secondaries (registered):** Y at step 5 (the old primary); the introduction rate, D/(k−1) per step and per added KLOC; removal of the inherited step-1 identities, tallied apart from D; steps to the first new identity; D by edge kind (under D2b, FF-S03 wiring and FF-S01 type-only edges are reported separately); D raw per rule and without each rule family; the memo §5 advisory slope; per-generator contrasts (descriptive); the D16 dependency-cruiser measures, computed after the run.

## 2. Design

| Item | Value |
|---|---|
| Question | Does the firewall in the loop, or one sentence per rule, stop violations spreading as a Layered or DDD project grows? |
| Start ("brownfield with accepted norms") | Each block runs step 1 **once**, in `none@L2`; that tree plus the declared spec (the accepted norm) is the shared start, and all cells branch from it at step 2. Inherited identities never count as introduced, so D is drift from a common state, with the generator's own step-1 habits as the precedent |
| Cells (steps 2–5) | `none@L2`, `none@L3` (plus one plain sentence per blocking rule), `mcp@L2` (the 9 spec-only tools, with `evaluate_project` denied). The attention sentence is in every frame. The L4 cells are not run, and H3 is dropped: it had power 0.70 at RR 0.5 even on the level outcome |
| Contrasts | H1: none@L2 vs none@L3 (SO5). H2: none@L2 vs mcp@L2 (C6). Paired, two-sided block sign-flip with 99,999 flips, seed fixed in the pre-registration, Holm over 2. Effect reported as the RR of ΣD with a block-bootstrap interval |
| Strata | Layered is confirmatory. DDD is confirmatory only if D15 is decided on Monday (static spec with declared aggregates, floor-escape Decision 2 A) **and** it passes the pilot bar (S2S). Clean and Hexagonal are not run; their existing zeros are reported as a finding (REV-02 item 5) |
| Room to accumulate | k = 5, not 4: every hint-audited task is 5 steps long, and vineyard-harvest's cross-context pressure is at step 5. **Boundary pressure:** each of steps 2–5 adds a new vertical slice (entity, store, rule, endpoint) or a new outside adapter. These are the steps where probe 1's habits replicated (hive-health +3, +2; youth-league +2) |
| Tasks | Pilot: `ice-rink` (Layered) and `vineyard-harvest` (DDD), both hint-audited (`fixtures/v1.3-rehearsal-tasks/`). Confirmatory: **4 new Layered tasks plus 2 DDD on standby**, written Monday by an agent to guide T1–T10, hint-audited, author-approved (S13), hashed at the freeze; the writer never runs or scores (V10c). No existing task qualifies: the rehearsal README bars its tasks from Study 2, the probe-1 tasks carry an arm comparison, and reopening the retired sealed list would be one more deviation |
| Generators | `claude-sonnet-5-5` and the Gemini pin (CDX), with the model id fixed in Monday's adapter and its own S4 probe. One lane per generator |
| Grid | 4 tasks × 4 replicates × 2 generators = **32 blocks**. If DDD passes, 2 Layered + 2 DDD tasks; otherwise 4 Layered |

**Already seen, disclosed.** In probe 1 the tool arm fixed step 1 and then had D = 0 on all three Layered tasks. That was Opus by hand, with evaluation tools the Study 2 arm denies. So an H2-like drift comparison has been glimpsed on development tasks. The pre-registration says so.

## 3. Power simulation

**What changes in `scripts/v1.3/lib/level-power-sim.ts`:** an `outcome: 'level' | 'drift'` mode; a `newPerStep` field on `RunTrajectory` (D = Σ over steps 2..k); `CELLS_DRIFT = [noneL2, noneL3, mcpL2]` and `HYPOTHESES_DRIFT = [H1, H2]`, Holm over 2; blocks = tasks × replicates × generators, with per-generator inputs through the existing `styles[t % styles.length]` mix; step turns = blocks × (1 + 3(k−1)). The entry file gets `--outcome`, and the tests a size check at RR 1 for Holm-2.

Command, after Monday's change:

```bash
npx tsx scripts/v1.3/level-power-sim.ts --outcome drift --sims 2000 --seed 20261018 --out-dir results/v1.3-drift-power-sim
```

**Run tonight.** I used an equivalent scratch driver that imports the library's `nbDraw`, `signFlipSimP` and `holmReject` unchanged. It ran on one process in 8 s. It is not committed, so nothing was written to `results/`. Monday's committed script must reproduce these figures within the Monte Carlo SE (≤ 0.011).

Inputs: probe-1 `none` D at k = 5 is 1, 2 and 5 (mean 2.67, variance 4.33, θ 4.27). The k = 5 linear sensitivity (market-vendors +0.375) gives mean 2.79.

| Blocks | Model | RR 0.25 H1 / H2 | RR 0.5 | RR 0.75 |
|---|---|---|---|---|
| 24 | independent | 0.99 / 0.99 | 0.65 / 0.65 | 0.14 / 0.13 |
| 24 | shared start | 1.00 / 1.00 | 0.82 / 0.82 | 0.20 / 0.20 |
| **32** | **independent** | **1.00 / 1.00** | **0.79 / 0.79** | **0.19 / 0.16** |
| 32 | shared start | 1.00 / 1.00 | 0.93 / 0.93 | 0.29 / 0.29 |

The shared start makes the block-frailty model more plausible than before, because all three cells grow from one tree. Both models are reported.

**How power collapses as the mean of D falls (32 blocks, independent, RR 0.25):**

| Mean of D | 2.67 | 1.5 | 1.0 | 0.75 | 0.5 |
|---|---|---|---|---|---|
| Power, H1 and H2 | 1.00 | 0.98 | 0.91 | 0.81 | 0.58 |

At RR 0.5, a mean of 2.67 is needed for 0.79.

**Reading.** The design detects an arm that cuts drift to a quarter. It is borderline for a halving and blind to a 25 % cut. That is the same limit the deviation states for the level outcome.

## 4. Pilot bar and the pre-written fallback

The pilot runs Tuesday on the frozen commit, `none@L2`, k = 5, 3 replicates per task per generator. The bar is fixed in this note before the first call.

**Bar, per style:**
1. **Escape:** mean D ≥ 1.0 over the 6 runs; ≥ 3 of 6 runs with D ≥ 1; ≥ 1 of 3 per generator.
2. **Power:** the re-run, with each generator's pilot mean and θ (pooled θ if one is undefined), gives H1 and H2 ≥ 0.80 at RR 0.25, 32 blocks, under independent cells.
3. **Validity:** unmapped files ≤ 10 %; type-check passes in ≥ 2 of 3 runs per generator; every counted finding `correct`; 0 evaluation errors; the smoke branches scoreable; S4 passed for both CLIs.

**Consequences:**
- Both styles pass: 2 + 2 tasks.
- Only one passes: 4 tasks of that style.
- A contrast below the power bar is demoted to secondary before registration.

**Fallback, registered in the same OSF document.** The fallback applies if no style passes, or no contrast survives, or a kept no-waiver gate line (§6) is red at the go. The main run still goes ahead Wednesday and Thursday under the same protocol, labelled **exploratory**: no Holm claims, RR with intervals, per-generator descriptives. The thesis claim returns to floor-escape §5 items 1–4 (the honest null), with D as a measured description of how violations replicate.

This replaces the deviation's `fallback=do-not-run`, and is declared as part of the M3 deviation.

## 5. Evasion check (M6), pre-registered

1. **Acceptance:** the per-step acceptance checks (D12, PR #200 runner), written with the new tasks. The pass rate in `mcp@L2` must be within 10 points of `none@L2`, or H2 reads "fewer violations by doing less". D12 is made non-waivable here (X7).
2. **Size:** LOC and file trajectories per cell.
3. **Coverage (D13):** unmapped-file share per step; files outside the layout globs that import persistence (the `src/main.ts` guard); `import()`, `require()` and barrel counts per cell.
4. **Literal view:** re-score every step-5 snapshot with the literal view (coverage 1.000) and compare D with the default view, per cell. A gap larger in `mcp` than in `none` is evasion.
5. **Moved-only read:** an agent draws 10 `mcp@L2` and 10 `none@L2` step diffs that passed and removed or avoided a blocking edge. Arm labels and tool transcripts are stripped. The author reads them blind and classes each as resolved, moved-only, wrapped or inlined, or feature dropped. **Bar: 0 moved-only cases in `mcp`.**
6. **Mechanism:** the MCP call log shows tool use in ≥ 80 % of `mcp` steps, or the result is reported as "no mechanism".
7. **Concentration:** if D without the dominant rule family loses the effect, the claim is scoped to that family.

## 6. Readiness gate, compressed

Met = planned evidence by Tuesday or Wednesday morning. Kept = must be green at the go, with no waiver, otherwise §4's fallback applies. Deviation = restated in the dated M3 deviation list (H lane, Monday).

| Line | Status and why |
|---|---|
| V1 | **Kept.** It needs the D1 changes on Monday; the freeze can't happen without them |
| V2 | **Met** by re-hashing the D5 and N3 ADRs at the freeze; V1 re-runs |
| V3 | **Met** Tuesday: the hold-out, run once |
| V4 | **Kept**, under the V4 ADR, dated before the hold-out (allowed by rule 1). A "characterised" style is exploratory |
| V5 | **Deviation, timing only:** the independent rater's meaning labels (D3) land before Friday's freeze, not before the go. They don't feed the run |
| V6 | **Met** Monday: the κ definition goes in with the codebook (needs L4) |
| V7 | **[W] waived:** the judge is dropped from Study 2 |
| V8 | Per-snapshot coverage **kept**. Adjudicating the human-code fidelity sheets is a **deviation**; step 5.4 covers generated code |
| V9 | **Kept**, for Layered and DDD (PR #176), or that style leaves `mcp` by a pre-registered decision |
| V10 | (a) **Deviation (CDX):** Gemini. (b) **[W]**. (c) **Kept:** the writer neither runs nor scores |
| V11 | **Kept**: the leak scan, Tuesday |
| S1–S3, S7, S11–S14 | **Kept**. The pilot exercises S1 (pause and resume) and S7. The Gemini adapter needs its own usage-limit text |
| S4 | **Kept**, per CLI × arm. Gemini is new |
| S5 | **Met**: L1 was declared not run (floor-escape §3.3) |
| S6 | **Deviation**: the advisory outcome is only secondary; per-rule counts are still recorded |
| S8 | **Met** by the pilot (both generators live, with the 25 % type-check rule) |
| S9 | **Kept**: two lanes, two harness roots, so the [W] doesn't apply |
| S10 | **Kept**: the hash of the OSF registration goes in the repo, plus a CI check |
| S15 | **Met**: no model labeller |
| D1, D3, D11 | **Deviation**: restated as §4's bar, §3's power rule, and the 3-cell shared-start arm set |
| D2, D4–D10, D13, D14 | **Kept**. D4 needs the author's Gemini OK on Monday. D9 needs the D analysis run on the pilot data, with a planted effect. D14's live resume runs in the pilot |
| D12 | **Kept**, waiver removed (step 5.1) |
| D15 | **Kept**. If it is undecided on Monday, DDD is exploratory |
| D16 | **Deviation**: secondary, computed after the run |

**The order also deviates.** The pilot doubles as the dress rehearsal, since its smoke branches exercise every cell on both generators. The order becomes: freeze → hold-out → pilot and rehearsal → OSF → gate → run.

## 7. Turns and calls

A turn is one generator CLI session for one step. The call cap is the harness `callBudget`: 1.5 × step turns, covering repair turns, as in the loop pilot. MCP tool calls are logged, but they are not model calls.

| Run | Per generator | Both generators |
|---|---|---|
| Pilot, base rate | 2 tasks × 3 replicates × 5 steps = 30 | 60 |
| Pilot, smoke (one ice-rink start, `none@L3` and `mcp@L2`, steps 2–3; Y sealed and not read) | 4 | 8 |
| **Pilot total** | **34 turns, cap 51** | **68 turns, cap 102** |
| **Main** | 16 blocks × (1 + 3 × 4) = **208 turns, cap 312** | **416 turns, cap 624** |
| Main budget (D3, ≥ 1.1×) | 230 turns | 460 turns |

The Gemini S4 probe is counted in the CDX note, not here. Evasion step 5's draw costs no model call.

Wall time per lane: 208 turns × 1.5–3.5 min = 5–12 h before usage-window pauses. Stop rule: only complete blocks count, never a partial cell.

## 8. Timeline, pre-mortem, falsifiers

**Tuesday 20**
- 09:00 freeze tag, with D5, N3 and the V4 ADR.
- 10:00 hold-out on the capped Neo4j (lane 2), while the Sonnet pilot runs (lane 1).
- 13:00 Gemini pilot (lane 2).
- 16:00 score the pilot, run D9, re-run the power simulation, decide the bar. The OSF draft states the confirmatory and exploratory forms.

**Wednesday 21**
- 09:00 the author OKs the counts, submits OSF with the embargo, and the hash is committed (S10).
- The gate is re-verified and the author signs the go.
- 11:00 main run starts, Sonnet on lane 1 and Gemini on lane 2. Snapshots are scored live by `cypher-interp`. The Neo4j re-score of record is Friday (D8).

**Thursday 22**
- The run finishes.
- Evasion steps 5.1–5.4 and 5.6–5.7 run automatically. The author's blind read (5.5) happens in the evening.

**Pre-mortem**
1. **The floor holds (biggest risk).** No Sonnet or Gemini Layered loop run has ever happened. If step 1 carries no habit, D ≈ 0. The §4 bar catches it.
2. **Gemini is late**: no adapter or S4 by Monday, so V10(a) is red and the run is exploratory.
3. **The freeze slips** (D1 changes, D5 and N3). The sprint fallback drops a red rule to a stated limit.
4. **Acceptance checks for the new tasks aren't ready**: D12 is red and evasion step 5.1 is lost.
5. **Pauses** push 208 turns past Thursday; **V4 characterises Layered**.
6. **An examiner reads lever-hunting.** Mitigations: §2's disclosure, the promoted registered secondary, Fable's objection stated up front.

**Falsifiers, in the pre-registration**
- Pilot mean D < 1.0: Fable finding 1 holds and the run is exploratory.
- H2 null at 32 blocks with power ≥ 0.80: the in-loop firewall does not cut drift to a quarter.
- H1 rejected and none@L3 ≈ mcp@L2: one sentence per rule is enough, and the firewall adds only spec delivery.
- Any moved-only case, an acceptance gap > 10 points, or a literal–default view gap concentrated in `mcp`: the result is evasion, not prevention.
- Tool use < 80 %: no mechanism.
- An effect carried only by D2b's wiring edges: the claim is scoped to wiring.
- Opposite signs between the generators: no cross-family claim.
