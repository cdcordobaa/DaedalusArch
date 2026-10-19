# G12: D2b, wiring imports in the Layered score, stated as a construct limit

**Status:** draft statement for review, 2026-10-18 (map part C2). Zero calls. The decision is the author's (D2b, `ops/decisions.md:25`): "Layered keeps counting wiring-code imports; no composition slot". This note writes down what that decision means for any Layered finding. It does not argue the decision again.

---

## 1. The facts

- **The preset has no place for wiring code.** `presets/layered.yaml` has three layers: `persistence` (`:17`), `business` (`:26`) and `presentation` (`:35`). None has a composition-root role. The server file that builds repositories and clients falls under `src/presentation/**` and is scored as presentation. By contrast, the DDD preset declares a `composition` layer and the hexagonal preset a `config` layer as composition roots (`Docs/v1.3/apg2-scope-adr-draft.md:39`).
- **What it counts.** In floor probe 1 (Layered, `none` arm), FF-S03 fired 65 times:
  - 31 times on the same upward edges FF-S01 already flags;
  - 34 times on presentation → persistence, "the server file builds repositories and clients".

  All 96 findings (31 FF-S01 + 65 FF-S03) are `correct` under `check-correct.ts`, which checks the rule as written (`Docs/DiagnosticRuns/v1.3-floor-probe-2026-10-16.md:99-104`).
- **How much of the outcome it is.** The Study 2 level Y counts distinct blocking edges, with FF-S01 and FF-S03 on one edge counted once (`Docs/v1.3/level-power-sim-2026-10-16.md:32`). At step 4 the three runs give:
  - Y = 3, 4, 9 (mean **5.33**) as measured;
  - 3, 1, 4 (mean **2.67**) without the composition-root edges (`level-power-sim-2026-10-16.md:36-37`).

  So the wiring edges are 0, 3 and 5 of each run's edges, **8 of 16 distinct blocking edges (50 %)**, and in one run 5 of 9. These are three runs from one Opus session by hand (`level-power-sim-2026-10-16.md:49-50`; L142, `Docs/v1.3/compendium/nulls-and-limits.md:380`).
- **Why it was kept.** Power. At the design grid and RR 0.25, H1 is 0.95 at mean 5.33 (`level-power-sim-2026-10-16.md:26`). With the slot, H1 and H2 are 0.83 and 0.84 at RR 0.25 only, and H3 is at most 0.21 (`:22`).
- **The instrument is not consistent about composition roots.** The APG v2 templates exempt composition roots from `deep-import-*` and `boundary-type-leak` (`Docs/v1.3/apg2-scope-adr-draft.md:35-41`; `src/fitness-compiler/apg2-templates.ts:12-17`). The advisory `composition-roots` filter exists, and it removes 5 of 1,939 wild rows (M21, `nulls-and-limits.md:504`). The Layered FF-S03 rule has neither.

## 2. The construct-limit statement (thesis wording, Ch. 3 and Ch. 8)

> **Layered counts include wiring.** The Layered library has no slot for the composition root, the code that constructs persistence objects and passes them to the presentation layer. Wherever that code sits, it is assigned to a layer and scored. Its imports of persistence from presentation are counted as layer skips (FF-S03), although a Layered practitioner would expect the composition root to know the concrete persistence classes. A Layered blocking count is therefore an **upper bound** on violations of the style. It reads as "edges that break strict layering as the library states it, wiring included". In the only agent data available, wiring edges were 8 of the 16 distinct blocking edges at step 4 (three runs; `level-power-sim-2026-10-16.md:36-37`). We kept the count as it is, and did not add a slot after seeing the data. A slot added after the seal would be a rule change made in response to results, and it would halve the base rate the design was powered on. We report every Layered count split into wiring and non-wiring edges.

## 3. What it means for reading Layered findings

1. **Level (Y, D).** Do not call a Layered count "erosion" without the split. Report D and Y by edge kind, as the drift draft already lists among its secondaries: "D by edge kind (under D2b, FF-S03 wiring and FF-S01 type-only edges are reported separately)" (`ops/notes/s2d-01-study2-drift-design.md:19`; an untracked draft, so its line numbers may move). If an effect rests only on wiring edges, scope the claim to wiring (`s2d-01:178`).
2. **Arm contrasts and evasion.** An arm can lower the Layered count by moving the wiring into a file outside the layout, such as `src/main.ts`. The preset never checks that file. The fix is the guard planned in `Docs/v1.3/floor-escape-design-2026-10-16.md:111`, "files outside the layout that import persistence", and the coverage item of the evasion check (`s2d-01:92`). Under D2b that guard becomes **required**, not optional: without the slot, moving the wiring out of the layout is the cheapest way to lower Y.
3. **Correct is not meaningful.** Wiring findings are rule-correct (all `correct`, `v1.3-floor-probe-2026-10-16.md:104`). Under the practitioner reading proposed for L4 (`ops/decisions.md:9`), most of them would be labelled *not meaningful*. Expect Layered meaningful precision to be lower than its correctness. Report the wiring share beside any Layered precision.
4. **No level comparison across styles.** DDD and Hexagonal declare a composition root (`apg2-scope-adr-draft.md:39`); Layered does not. A Layered-versus-other-style difference in level is partly this asymmetry. Compare styles only on non-wiring edges, or not at all.
5. **External and wild Layered verdicts.** A real Layered project whose bootstrap file is mapped into a layer can get a `fail` verdict from wiring alone. Before a Layered `fail` is quoted as a style violation, check whether the failing edges come from a composition-root file. The file-name list in `apg2-scope-adr-draft.md:41` gives a fixed test for that.
6. **What it does not touch.** FF-S01 upward edges (persistence → business), cycles (FF-S02) and every non-Layered style. Q2, whether type-only FF-S01 edges count, is a separate open construct question, and it "could remove most of what remains" (`level-power-sim-2026-10-16.md:50`).

## 4. Lines this would change (not edited here)

| File:line | Now | Proposed |
|---|---|---|
| `Docs/v1.3/limitations-register.md`, new row L23 after `:41` | — | the §2 statement, citing `ops/decisions.md:25` and `level-power-sim-2026-10-16.md:36-37` |
| `Docs/v1.3/compendium/nulls-and-limits.md:380` (L142) | "the repaired mean may fall to 2.67" | "a composition slot would have lowered it to 2.67; the author kept the count without the slot (D2b, 2026-10-18), so the base rate stays 5.33 and Layered counts include wiring edges (G12)" |
| `Docs/v1.3/level-power-sim-2026-10-16.md:22`, `:37` | "after the composition-slot repair", "Layered, repaired" | "counterfactual: with a composition slot (not adopted, D2b)" |
| `Docs/v1.3/floor-escape-design-2026-10-16.md:111`, `:131`, `:227` | the slot as a planned repair, made before the pilot | "superseded by D2b (2026-10-18): no slot; the outside-layout persistence guard stays and is required" |
| `ops/02-defensibility-conditions.md:154` (X6) | "Validity first (board D2b). Accept demotion" | **This contradicts the decision.** D2b kept the power, not the slot. Rewrite as "Power first (D2b): the count keeps wiring imports, declared as a construct limit (G12)" |
| `Docs/v1.3/threats-register.md`, V13-TV-C7 "Rules stricter than, or different from, their sources" (`:175`) | — | add the wiring case as an instance, citing this note |
