# V15-PLAN step 3: the final confirmatory study of instrument v1.5 (DRAFT v0)

**Status:** draft v0, 2026-10-22. Zero calls. A design to mature alongside v1.5 (V15-PLAN §7). **It is not a
pre-registration and is not to be registered yet.** Study 2b stays closed at v1.4; nothing here changes the tag
`v1.4-freeze-2026-10-20` or any 2b artefact.

## 1. What 2b settled, and what it left open

Sources: `Docs/v1.4/study2b-preregistration.md`, `Docs/DiagnosticRuns/v1.4-study2b-results-2026-10-21.md`,
`ops/06-open-tracks-and-capabilities.md`, `ops/notes/explore-01-research-log.md`.

**What worked.** The pipeline ran as registered: 520 step turns, 0 redraws, 7 h 10 min of wall time; one scoring pass;
parity, coverage, acceptance and telemetry checks all clean. H1 (`none@L3` < `none@L2`, exact p 0.0132) and H2
(`mcp@L2` < `none@L2`, exact p 0.0001) were rejected with the predicted sign, under D and D†. H3 was not rejected, and
E failed, so nothing is claimed about `none@L3` and `mcp@L2` being equal.

**The limits** that this study must address:
1. **One rule.** FF-S03 (composition-root wiring) carried 100 % of the counted identities. D without FF-S03 is 0.
2. **One style.** Layered only; the DDD tasks were never sealed (DDD beta).
3. **Four tasks.** The task-level sign-flip cannot go below p = 0.125, so no inference over tasks. The effect sat
   mostly in two tasks; 12 of 40 blocks had Y₁ = 0.
4. **No `mcp@L3` cell.** Whether the tool adds anything once the rules are in prose is unanswered.
5. **A shrinking effect over run order.** d̄ fell from 1.6 to 0.5 (H1) and from 1.9 to 0.95 (H2) between the run-index
   halves, with no sign reversal.
6. **One vendor** (Claude Sonnet). The Gemini extension arm awaits S4 and its quota.
7. **D_sem pending.** The semantic secondary has not run.
8. **Pull delivery.** A `check_*` call appeared in 28 of 160 `mcp@L2` steps, so "tool" mostly meant spec delivery.

## 2. Research questions

- **RQ1 (spec).** Does stating the rules in prose (L3) reduce new violations against a minimal spec (L2)? (Replicates
  H1 on new tasks and a second style.)
- **RQ2 (tool at L2).** Does the tool reduce new violations at the minimal spec? (Replicates H2.)
- **RQ3 (tool at L3).** Does the tool reduce new violations **beyond** the prose rules? The question 2b could not ask.
- **RQ4 (interaction).** Is the tool's effect smaller when the rules are already in prose (substitute) or not
  (complement)? Descriptive unless the power sketch supports it.
- **RQ5 (generality).** Do the effects hold over tasks, in Layered and in DDD, and for a second vendor?
- **RQ6 (meaning).** Does the effect survive semantic interpretation (D_sem)?
- **RQ7 (optional, brownfield).** With no declared rules, does the tool with an inferred spec recover part of the
  effect?

## 3. Design options

**Cells: spec × tool, a 2 × 2.** `none@L2`, `none@L3`, `tool@L2`, `tool@L3`. Shared step 1 per block, as in 2b, so 17
turns per block (5 for `none@L2`, 4 for each branch cell). The three registered contrasts would be RQ1 (`none@L3` vs
`none@L2`), RQ2 (`tool@L2` vs `none@L2`) and RQ3 (`tool@L3` vs `none@L3`), under Holm, **per style**. Styles are not
pooled, because their blocking sets differ. The interaction is reported with its interval, without a test, unless
§4 shows power for it.

**Tasks: Layered and DDD.** New tasks, written blind, sealed by hash, hint-audited and examined, as in 2b. DDD enters
only when its gates pass (§6). Each task must give the v1.5 families opportunities, not only FF-S03: the task card
lists the expected opportunities per family, checked at zero calls on practice versions.

**Delivery mode: the one the pilots pick.** Pull (PUZZLE-02) or the edit gate (`ops/notes/v15-edit-gate-design.md`).
The gate has fewer confounds (no instruction sentence, no call decision). If both arms help on the puzzles, the gate is
the default and pull is reported from the pilots only. A fifth cell (pull and gate together) is not proposed: it costs a
quarter more and answers a delivery question the pilots can answer more cheaply.

**Start state.** Option S1, as 2b: an organic shared step 1 (Y₁ = 0 in 30 % of 2b blocks, which dilutes D). Option S2:
a seeded step 1 with one planted inherited violation per family the task exercises, so every block has something to
spread or repair. S2 changes the estimand from "drift from the agent's own start" to "spread and repair of planted
debt", and needs its own short pilot.

**Outcomes.**
- **Primary: D, extended** to the promoted v1.5 families (R-D4, R-XCTX, and every family that passes its precision and
  held-out gates), under 2b's identity rule. A family that is not promoted is not counted. D† kept as the registered
  sensitivity.
- **Per-opportunity rates** per family and cell (violations / opportunities), from an exposure counter that supports
  DDD specs (today it supports Layered only).
- **Repair:** inherited identities removed per step; D | R = 0; and, with the gate, edits from finding to fix and
  first-attempt correctness.
- **D_sem, registered from the start** (RQ6): D over the findings C4 does not classify as legitimate exceptions, with
  the C4 bars fixed before the run. Secondary, or co-primary if the author chooses (§8).
- **Guards:** functional acceptance (the evasion item 1 bar), composition-root placement and renames, tool-call or gate
  telemetry, cost.

**Second vendor.** One extension arm on the same sealed tasks and cells, dated before its first call, only if its CLI
passes S4. Gemini through agy failed S4; its quota resets about 2026-10-25. The vendor result is reported beside
Claude's, not pooled, and each vendor has its own Holm family.

**Optional brownfield arm (RQ7).** One more cell, `tool-inferred@L2`: the tool gets the spec inferred by the §6
pipeline instead of the declared one. Contrast with `tool@L2` (the cost of not knowing the rules) and with `none@L2`.
Only if the §6 gate passes (the inferred spec recovers the declared one and flags the planted debt).

## 4. How many tasks: a power sketch

**Floor from exactness.** A two-sided sign-flip over m task-level sums cannot go below 2 / 2^m. With Holm over three
contrasts the smallest threshold is 0.0167, so **m ≥ 7 tasks per style** just to make a task-level rejection possible.
2b's 4 tasks gave 0.125.

**What m buys.** Rejection at the task level needs the effect in most tasks. With 8 tasks, roughly 7 or 8 of them must
point the same way; with 12, about 10 or 11. In 2b, two of four tasks carried most of the effect. If half the tasks
carry no effect, even 12 tasks are unlikely to reach a task-level claim, and the honest statement is "an effect within
these tasks", as in 2b.

**The computation to do (zero calls, before registration).** Reuse the logic of `scripts/v1.4/study2b-power.ts` at
task grain:
1. the exactness floor at task level, per Holm step;
2. resample m task-level mean differences from a mixture: 2b's four task profiles at full and at half size (the
   shrinking effect), plus null tasks at share π₀ ∈ {0, 0.25, 0.5}; the DDD profiles come from a DDD pilot, or are
   assumed at half the Layered size;
3. report the smallest m with power ≥ 0.80 for each π₀, then r from the block-level power, as in 2b's P3.

**Candidate grids** (17 turns per block; 2b's rate of about 73 turns an hour on two lanes):

| Option | Tasks × r per style | Blocks | Turns per style and vendor | Wall time per style and vendor |
|---|---|---|---|---|
| A | 8 × 5 | 40 | 680 | about 9.5 h |
| **B (lead)** | **12 × 3** | **36** | **612** | **about 8.5 h** |
| C | 16 × 2 | 32 | 544 | about 7.5 h |

B is the lead option: it puts the budget into tasks rather than replicates, which is what task-level inference needs,
and keeps r ≥ 3 for within-task intervals.

## 5. Rough cost (option B)

| Part | Turns | Wall time |
|---|---|---|
| Claude, Layered + DDD | 1,224 | about 17 h |
| Second vendor, both styles | 1,224 | unknown; about 17 h at Claude's rate |
| Redraw allowance (1.5 ×, as 2b) | cap 3,672 | — |
| Brownfield cell (optional), both styles and vendors | + 576 | + about 8 h |
| C4 for D_sem | about 1,000–2,000 calls (2b had 1,392 blocking findings over 600 snapshots; one call per distinct identity) | a few hours |
| Practice-task dress rehearsal, smoke, S4, probes | about 40 | — |

Human cost: 24 new sealed tasks (12 per style), with blind authoring, a hint audit and an examiner. This is the largest
item and the critical path.

## 6. What must be true of v1.5 before registration

From V15-PLAN:
1. **Detection.** Each counted family passes precision on correct DDD patterns and the sealed held-out check
   (`experiments/detect-02-heldout/SEAL.md`); calls through ports linked in the extractor; the composition-root
   mismatch (DA1) fixed.
2. **Semantic layer.** The C4 pilot passes; the C4 bars for D_sem are fixed and dated.
3. **Delivery.** The PUZZLE-02 and edit-gate pilots are read and the mode chosen; every counted rule has a message in
   the actionable format (where, rule, why, fix).
4. **DDD.** The DDD spec freezes (defect T1), the exposure counter supports DDD, the DDD tasks pass the opportunity
   check.
5. **Validity.** The SO4 hold-out scored under its addendum; MEAN-01 labels done, or their absence stated.
6. **Release.** DETECT-02 moved into `src/` and the MCP server; `v1.5` tagged with a changelog; the v1.4 artefacts
   protected (V15-PLAN §8).
7. **Harness.** A CLI pin per vendor, S4 passed with the chosen delivery mode, a dress rehearsal on practice tasks.
8. **Brownfield arm only:** the §6 spec-inference gate passed.

## 7. Threats

- **Run-order decay** (2b limit 5): the run order interleaves cells per replicate as in 2b, the model string and CLI
  version are recorded per turn, and a time-half sensitivity is registered. A CLI auto-update mid-run is a stop.
- **Concentration on one rule:** the per-family share of D is reported, and the claim is scoped to the families that
  carry it, as 2b scoped to FF-S03.
- **Y₁ = 0 dilution:** option S2, or a registered sensitivity that drops those blocks.
- **Same-vendor authoring and generation:** tasks and instrument come from Claude sessions; the second vendor arm and an
  independent task author reduce this.
- **Development contamination:** detectors tuned on the puzzles and 2b trees; counted families must pass held-out
  checks, and the new tasks are sealed before any detector change is frozen.
- **Gaming:** renames, batch wrappers, fake synchronous events, composition-root moves; the evasion bars of 2b plus the
  puzzle answer-key checks.
- **Construct:** D counts symbolic findings. D_sem and the functional guard bound what a drop in D means.
- **Delivery confound:** with pull, "tool" includes an instruction; the gate removes it.

## 8. Open decisions for the author

1. Option A, B or C (tasks against replicates), after the task-grain power computation.
2. DDD in the confirmatory family, or Layered confirmatory with DDD exploratory.
3. Delivery mode: gate, pull, or the pilots' winner by a rule fixed now.
4. Start state: organic shared step 1 (S1) or seeded step 1 (S2).
5. D_sem secondary or co-primary.
6. Second vendor: which CLI, and whether the study waits for it.
7. Brownfield arm in or out.
8. Whether the interaction (RQ4) and an equivalence claim are registered or descriptive.
9. Who authors the new tasks.
10. Timeline: the call budget and the date by which the v1.5 gates must pass.

## Changelog
- 2026-10-22: v0, first draft.
