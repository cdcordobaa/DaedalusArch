# V15-PLAN step 3: the final confirmatory study of instrument v1.5 (DRAFT v0)

**Status:** draft v0, 2026-10-22. Zero calls. A design to mature alongside v1.5 (V15-PLAN §7). **It is not a
pre-registration and is not to be registered yet.** Study 2b stays closed at v1.4; nothing here changes the tag
`v1.4-freeze-2026-10-20` or any 2b artefact.

## 1. What 2b settled, and what it left open

Sources: `Docs/v1.4/study2b-preregistration.md`, `Docs/DiagnosticRuns/v1.4-study2b-results-2026-10-21.md`,
`ops/06-open-tracks-and-capabilities.md`, `ops/notes/explore-01-research-log.md`.

**What worked:** 520 turns, 0 redraws, 7 h 10 min, one scoring pass, all checks clean. H1 (exact p 0.0132) and H2
(0.0001) rejected with the predicted sign under D and D†; H3 not rejected; E failed.

**Limits to address:** (1) one rule, FF-S03, carried 100 % of identities; (2) Layered only; (3) 4 tasks, so the
task-level p cannot go below 0.125, with the effect mostly in 2 tasks and Y₁ = 0 in 12 of 40 blocks; (4) no `mcp@L3`
cell; (5) the effect shrank over run order (H1 d̄ 1.6 → 0.5, H2 1.9 → 0.95); (6) one vendor; (7) D_sem not run;
(8) pull delivery: a `check_*` call in only 28 of 160 `mcp@L2` steps.

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

**Outcomes.** Primary: **D extended** to the promoted v1.5 families (R-D4, R-XCTX and any family that passes its
precision and held-out gates), 2b's identity rule, D† as sensitivity. Secondary: **per-opportunity rates** per family
(the exposure counter needs DDD support); **repair** (inherited removals, D | R = 0, edits from finding to fix,
first-attempt correctness); **D_sem registered from the start**, C4 bars fixed before the run. Guards: functional
acceptance, composition-root placement and renames, telemetry, cost.

**Second vendor:** an extension arm on the same tasks and cells, dated before its first call, only if its CLI passes
S4 (Gemini via agy failed S4; quota resets about 2026-10-25). Reported beside Claude, own Holm family, not pooled.

**Optional brownfield arm (RQ7):** a cell `tool-inferred@L2` where the tool gets the V15-PLAN §6 inferred spec;
contrasts with `tool@L2` and `none@L2`. Only if the §6 gate passes.

## 4. How many tasks: a power sketch

**Floor from exactness.** A two-sided sign-flip over m task-level sums cannot go below 2 / 2^m. With Holm over three
contrasts the smallest threshold is 0.0167, so **m ≥ 7 tasks per style** just to make a task-level rejection possible.
2b's 4 tasks gave 0.125.

**What m buys.** A task-level rejection needs the effect in most tasks (about 7–8 of 8, or 10–11 of 12). If half the
tasks carry no effect, as 2b hints, even 12 tasks are unlikely to reach a task-level claim.

**To compute before registration (zero calls):** `scripts/v1.4/study2b-power.ts` logic at task grain: the task-level
exactness floor per Holm step; resampling m task-level differences from 2b's four task profiles at full and half size
plus null tasks at share π₀ ∈ {0, 0.25, 0.5} (DDD profiles from a pilot or assumed at half size); the smallest m with
power ≥ 0.80 per π₀, then r as in 2b's P3.

**Candidate grids** (17 turns per block; 2b's rate of about 73 turns an hour on two lanes):

| Option | Tasks × r per style | Blocks | Turns per style and vendor | Wall time per style and vendor |
|---|---|---|---|---|
| A | 8 × 5 | 40 | 680 | about 9.5 h |
| **B (lead)** | **12 × 3** | **36** | **612** | **about 8.5 h** |
| C | 16 × 2 | 32 | 544 | about 7.5 h |

B leads: budget into tasks, not replicates, with r ≥ 3 for within-task intervals.

## 5. Rough cost (option B)

| Part | Turns | Wall time |
|---|---|---|
| Claude, Layered + DDD | 1,224 | about 17 h |
| Second vendor, both styles | 1,224 | unknown; about 17 h at Claude's rate |
| Redraw allowance (1.5 ×, as 2b) | cap 3,672 | — |
| Brownfield cell (optional), both styles and vendors | + 576 | + about 8 h |
| C4 for D_sem | about 1,000–2,000 calls (2b had 1,392 blocking findings over 600 snapshots; one call per distinct identity) | a few hours |
| Practice-task dress rehearsal, smoke, S4, probes | about 40 | — |

Human cost: 24 new sealed tasks (blind authoring, hint audit, examiner), the critical path.

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

- **Run-order decay:** per-replicate interleaving, model and CLI recorded per turn, a time-half sensitivity; a CLI
  update mid-run is a stop.
- **One-rule concentration:** per-family share of D reported; the claim scoped to the carrying families.
- **Y₁ = 0 dilution:** option S2 or a drop-blocks sensitivity.
- **Same-vendor authoring:** second vendor and an independent task author.
- **Dev contamination:** held-out checks for counted families; tasks sealed before the detectors freeze.
- **Gaming:** 2b's evasion bars plus puzzle answer keys (renames, batch wrappers, fake synchronous events).
- **Construct:** D is symbolic; D_sem and the functional guard bound it. **Delivery confound:** the gate removes the
  instruction sentence pull needs.

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
