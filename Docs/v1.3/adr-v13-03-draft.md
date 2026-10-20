# ADR-V13-03 (draft): Construct decisions Q1–Q25

**Date**: 2026-10-19 (draft written 2026-10-20 from the signed answers). **Status**: Draft, for the author's signature. The construct **answers** are signed (the author, decision desk, 2026-10-19). This ADR **text** is not signed yet: the U6 plan puts the signature after the fresh checks (U6 plan Steps 8 and 11b; U6 design §4.1, §9). When signed, the text moves to `Docs/v1.3/adr-v13.md` §ADR-V13-03 (freeze-check F4), and the reason strings in `src/construct-switches/tiers.ts` lose "unsigned" (F5).

This is a development-cycle decision for v1.3. It does not change Study 1 (v1.2E, frozen), the sealed tier table (`Docs/v1.3/rule-tiers.md`), the presets, the frozen template text or any manifest. Under `--scoring v1.2e` no switch applies.

**Form (G0.7 = A, signed 2026-10-19 by the author via the decision desk).** One ADR, one entry per answered question that owes one, entered in the G14 dated deviation list now.

**With sight of development effects.** The questions were written in `Docs/v1.3/construct-decisions.md` (revision 1, 2026-10-15) with sight of development-set effects, and this ADR says so. Every answer below was signed on its construct source (the author's principle, `ops/decisions.md` U6: "rules are never hand-written and never tuned to the misses"). Development figures appear only as consequences.

## Inputs

- Answers file: `Docs/v1.3/construct-answers.json` (sha256 `dc5daabdb391003bbf694df4b584284b6eef649d6a2a17da2f1a54b8a4674142`), 25 of 25 answered.
- Switch block: `src/shared/construct-switches.ts` (file sha256 `3f796d430dedefbcbae288ca4980876e8e14c1f17ea5e603f7e9da62d4812cc9`), rewritten by `scripts/v1.3/apply-construct-answers.ts`.
- Source of the answers: `ops/review/2026-10-19/decision-desk/answers.json` (61 answers: 56 signed by the author, 5 delegated to the coordinator by the author, `ops/decisions.md` DELEG).
- Principles: P1 = A, P2 = A, Precedence = A (the source wins through a declared ADR), signed 2026-10-19 by the author via the decision desk.

## Answers

| Q | Answer | Q | Answer | Q | Answer | Q | Answer | Q | Answer |
|---|---|---|---|---|---|---|---|---|---|
| Q1 | A | Q6 | B | Q11 | A | Q16 | B | Q21 | B |
| Q2 | A | Q7 | A | Q12 | B | Q17 | A | Q22 | B |
| Q3 | C | Q8 | B | Q13 | B | Q18 | B | Q23 | B |
| Q4 | A | Q9 | A | Q14 | C | Q19 | A | Q24 | A |
| Q5 | C | Q10 | C | Q15 | B | Q20 | A | Q25 | B |

Every answer: signed 2026-10-19 by the author via the decision desk.

## Sign-off lines printed by `apply-construct-answers.ts --dry-run` (U6 plan Step 6)

Tier ADRs (a tier move needs an ADR with a construct reason; the switch applies an override until then):
- Q3 C: FF-S02 split: in-component file cycles advisory (proxy for ADP), crossing cycles blocking (Martin 2017, ch. 13-14).
- Q15 B: FF-DS01 bounded-context-modules advisory (own row).
- Q21 B: FF-DT05 domain-event-placement blocking (Vernon ch. 8; Evans, *DDD Reference* 2015 pp. 10 and 13, by Precedence).

ADR-V13-03 "construct decisions" entries:
- Q1 A [applicability]: sign ADR-V13-02 as drafted (`Docs/v1.3/adr-v13-02-draft.md`).
- Q5 C [rule]: adapter → adapter edges are FF-S01 findings in hexagonal and ddd (P2: FF-S03 drops them). §Q5 below.
- Q6 B [rule]: hexagonal FF-S04 binds the application core (domain + application layers). §Q6 below.
- Q8 B [policy]: N/A-half policy (with Q14): sealed tier kept, FLOWS_TO half N/A, recall unestimated.
- Q10 C [applicability]: FF-P01 not applicable to layered (P1). §Q10 below.
- Q10 C [rule]: FF-S01 reads a declared package-to-layer mapping. §Q10 below.
- Q12 B [rule]: FF-S03 reports only downward edges that pass over a layer. §Q12 below.
- Q13 B [rule]: FF-P04 follows the declared layer order.
- Q14 C [note]: the N/A half is covered by the member facts.
- Q16 B [preset]: FF-S02 in the ddd preset (by the ADR-V14-01 overlay, Q-A = A); one development-set run before the hold-out, no second tuning loop.
- Q18 B [rule]: FF-DS02 without the ACL exemption (changes the wording of the sealed bounded-context row; Evans, *DDD Reference* 2015 p. 34, by Precedence).
- Q22 B [rule]: FF-P02 measures DIP across layers only (a stated narrowing of Martin ch. 11).
- Q23 B [rule]: FF-P05 selects entities by the declared domain layer.
- Q25 B [preset]: composition-root role in the presets; one development-set run before the hold-out, no second tuning loop.

Action items:
- **Q13 (ADR-V13-02 / NestJS preset contradiction).** ADR-V13-02 calls the NestJS preset "a Clean Architecture layering". Under Q13 B the preset order (Controller → Service → Repository) holds: correct the ADR-V13-02 wording before it moves to `adr-v13.md`, and re-check that FF-P06 and FF-P07 (ADR-V14-02 Q-C) still hold in nestjs on the preset's own order (service below controller), not on the "Clean reading".

## Scorer alignment (G0.8 = b)

Delegated to the coordinator 2026-10-19 (recommended answer). The registered scorers (`scripts/v1.3/lib/reference-model.ts`, `scripts/v1.3/ue-score.ts`, `scripts/v1.3/lib/holdout-score.ts`) are **not** changed, and the registered figures are reported as computed. So:
- Q5 is C, not D: FF-S01 is the blind reader's own id for these edges, so the blocking gain is scored natively. No FF-S05 row is needed in `blind-rule-mapping.json`.
- Under Q10 C, FF-P01 stays in the layered scope of the committed descriptor, so the author-manifest FF-P01 rows in layered are misses in the author view. This is reported, not fixed.
- No scoring deviation enters the G14 list.

## Refutation criteria (G0.9), dated 2026-10-19, before any fresh check ran

Delegated to the coordinator 2026-10-19 (recommended answer: as drafted on `ops/notes/signing-sheet-2026-10-19.md` §5). A met criterion may only send a question back to A, or Q10 from C to D. It never adds an option or changes a list. The criteria are applied as written, not reinterpreted.

| Switch | Fresh check | The result that withdraws it |
|---|---|---|
| Q5 C | MO-H03 seeds and twins (hexagonal; ddd has no seeded check); correctness read of the adapter-pair rows on the real hex/ddd projects | any MO-H03 seed missed, **or** any twin gains a blocking row, **or** any listed real-code row is judged incorrect by the C3 correctness procedure and is not also reported by FF-S01 → Q5 back to A |
| Q6 B | MO-H02 seeds with FF-S04 expected; twins | any MO-H02 seed missed, **or** any twin gains a blocking row → Q6 back to A |
| Q10 C | FF-P01 and new FF-S01 package rows on the 5 external Layered repos | any listed row judged incorrect by the C3 procedure and not also reported by FF-S01 → Q10 goes to D |
| Q12 B | adjacent-upward FF-S03 rows on the 5 external Layered repos | any adjacent-upward edge that Q12 B stops reporting under FF-S03 is not reported by FF-S01 either → Q12 back to A |

## §Q5: adapter → adapter is an FF-S01 finding (hexagonal, ddd)

**Context.** In hexagonal v05 and v06 an adapter imports another adapter, and the status-quo tool reports it as FF-S03 `layer-skip-graph`, which is advisory. The blind manifest reports the edge as FF-S01 (blocking).

**Sources.** Cockburn (2005), "Intent" and "Nature of the Solution": every actor interacts with the application through a port. Verification note (2026-10-16, `construct-decisions.md`): Cockburn never says adapters must not talk to each other, and in his sample the primary FIT adapter calls the secondary adapter factory. **The blocking rule is an inference from the port concept, not a quotation.**

**Decision: C.** In hexagonal and ddd, every FF-S03 row whose source and target are both adapter layers moves to FF-S01 `dependency-direction`, which is blocking: the edge breaks the spec's declared allowed dependencies. FF-S03 no longer reports it (P2). Composition layers are not adapter layers. C rather than D because of G0.8 (b): the registered scorers know FF-S01 and not FF-S05.

**Consequences (development set, offline re-score).** Hexagonal +2 and ddd +1 blocking rows. Every human hexagonal or ddd project with adapter → adapter imports gains blocking findings; their precision is checked by the fresh check below.

**Implementation (exists).** `src/construct-switches/rows.ts` `q5AdapterEdges`.

## §Q6: in hexagonal, core isolation (FF-S04) binds domain plus application

**Context.** In hexagonal v03 and v04 an application service imports an adapter. The tool reports FF-S01; the blind manifest reports FF-S04.

**Sources.** Cockburn (2005): the hexagon is the application, not split into domain and application. Verification note (2026-10-16): the phrase "application core", quoted in revision 1, **does not appear** in Cockburn's article; the answer rests on "Intent" and "Nature of the Solution". Q11 A keeps domain → application forbidden by FF-S01.

**Decision: B.** In hexagonal, FF-S04's core is the union of the declared `domain` and `application` layers (composition roots excluded). An edge from a core file to a layer outside the core is an FF-S04 finding; an edge inside the core is not.

**P2 exception (declared).** An application → adapter edge is reported by both FF-S01 and FF-S04, as domain → adapter edges already are. Both are named owners.

**Consequences (development set).** The change finds **no new edge**: FF-S01 already blocks every edge it adds; the gain is in the rule-id key only. It drops the agreed hex v02 FF-S04 row (now inside the core); the author ruled that row `spec` (adjudication N1).

**Implementation (exists).** `src/construct-switches/rows.ts` `q6ApplicationCore`.

## §Q10: FF-P01 is not applicable to layered; packages reach FF-S01 through a declared mapping

**Context.** Layered v07 has a `typeorm` decorator on a business model; v08 has a business service typed on `express`.

**Sources.** [SRS: Layered] states no purity rule (P1). Fowler (2002) ch. 10, Active Record, puts persistence in domain objects. Fowler (2002) ch. 1: the domain should not depend on the presentation (recalled; page to be checked before signing).

**Decision: C (provisional until the G0.9 Q10 check; D is the only fallback).** FF-P01 `domain-purity` is disabled for `layered` (P1). A declared mapping `CONSTRUCT_PACKAGE_LAYERS.layered = { express, koa, fastify → presentation }` makes an import of a mapped package from a lower layer an FF-S01 row. **The mapping is frozen as written before any re-run.** No package is added after seeing a result.

**Risk.** Only `express` is exercised on the development set; the mapping is the most fit-prone item in this ADR.

**Implementation (exists).** `src/construct-switches/compile.ts`, `rows.ts` `q10PackageLayers`, `overlays.ts` `CONSTRUCT_PACKAGE_LAYERS`.

## §Q12: in layered, FF-S03 reports only downward edges that pass over a layer

**Sources.** [SRS: Layered, FF-S01/S03]: "lower layers do not use upper ones" (FF-S01) and strict layering "also forbids skipping a layer" (FF-S03) are two clauses; an adjacent upward edge breaks only the first (P2).

**Decision: B.** In layered, an FF-S03 row is dropped when the reverse of its transition is allowed (an adjacent upward edge). An upward edge across two or more layers is kept. The rule only removes rows.

**Implementation (exists).** `src/construct-switches/rows.ts` `q12UpwardNotSkip`.

## Fresh-check results (U6 plan Steps 10 and 11)

Recorded in `Docs/DiagnosticRuns/v1.4-u6-applied-2026-10-19.md` §2 (2026-10-20, after the criteria were dated). Evidence: `results/v1.4-u6-fresh-checks/`.
- **Q5 C: not met.** MO-H03 seeds 10/10 detected; twins 0/6. On the real hex/ddd projects, 14 adapter-pair rows move to FF-S01, and all 14 are correct by the C3 checker.
- **Q6 B: not met.** MO-H02 seeds 10/10 detected with FF-S04 in the key; twins 0/6. On real code, all 23 new FF-S04 rows are on edges FF-S01 already reports, so no new edge.
- **Q12 B: not met.** 11 adjacent-upward FF-S03 rows were removed, and all 11 are still reported by FF-S01.
- **Q10 C: met, read as written.** The 2 new FF-S01 `express` rows were judged incorrect by the C3 checker ("the statement(s) at that line do not reach express (literal view)"), and no other FF-S01 row covers them. The checker appears not to handle a package target for a direction rule; the same imports are labelled correct as FF-P01 rows. Per plan Step 11 this goes to the author before Q10 is final. **The author decides: D, as the criterion reads, or C, if the verdict is a checker artefact.** Until then Q10 stays at the signed, provisional C.

## Sign-off

> AUTHOR: sign ADR-V13-03 as drafted / amended: ______. Signed: __________ Date: ____-__-__ (after the fresh checks; then move to `Docs/v1.3/adr-v13.md` and update the `tiers.ts` reason strings, U6 plan Step 11b).
