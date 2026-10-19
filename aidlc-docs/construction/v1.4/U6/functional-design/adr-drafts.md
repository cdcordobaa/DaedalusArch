# U6 ADR drafts: ADR-V13-03 "construct decisions", the sections for Q5, Q6, Q10 and Q12

**Status: DRAFT, 2026-10-18. Not signed.**

These are sections of one ADR, because the code TODOs already name ADR-V13-03 (`src/construct-switches/tiers.ts`, "ADR-V13-03, unsigned"). The author may split them into four ADRs. When signed, the text moves to `Docs/v1.3/adr-v13-03-draft.md` and then to `Docs/v1.3/adr-v13.md` §ADR-V13-03, which is the `ADR_FILE` of `scripts/v1.3/lib/freeze-check.ts`.

**Common context.** These are post-seal construct changes. Each one is a declared deviation in the G14 dated list. Each was argued from the style-rule sources in `Docs/v1.3/construct-decisions.md` (revision 1, 2026-10-15) before any score target was set. That file was written **with sight of development effects**, and this ADR says so. They do not change Study 1 (v1.2E, frozen), `Docs/v1.3/rule-tiers.md`, the presets, the frozen template text or any manifest. Under `--scoring v1.2e`, no switch applies.

**Common procedure.**
1. Answer in `Docs/v1.3/construct-answers.json`.
2. Run `scripts/v1.3/apply-construct-answers.ts`.
3. Preview offline.
4. Run the fresh checks below.
5. Do one development re-run.
6. Freeze. There is no second tuning loop (`Docs/v1.3/construct-switches.md:23-24`).

All figures below are development-set figures (71 cases, `after-member-facts`, Q8 B), not validity estimates.

---

## §Q5: adapter → adapter is its own blocking rule, FF-S05 `adapter-isolation` (hexagonal, ddd)

**Context.** In hexagonal v05 and v06 an adapter imports another adapter, and the tool reports it as FF-S03 `layer-skip-graph`, which is advisory. The sealed FF-S03 tier reason ("hexagonal does not define strict layering") is about skipping a ring, which is not what this template reports on that edge. The blind manifest reports the edge as FF-S01 (blocking).

**Sources.**
- Cockburn (2005), "Intent" and "Nature of the Solution": every actor interacts with the application through a port.
- Verification note (2026-10-16, `construct-decisions.md`): Cockburn never says adapters must not talk to each other. In his sample the primary FIT adapter calls the secondary adapter factory. **The blocking rule is an inference from the port concept, not a quotation.**

**Options considered.**
- A: keep FF-S03, advisory.
- B: make FF-S03 blocking in hexagonal and ddd.
- C: move the rows to FF-S01.
- D: new id FF-S05.

**Decision (proposed): D.**
- FF-S05 `adapter-isolation` is a carrier rule in the hexagonal library and the ddd composed layering. It is blocking in hexagonal and ddd.
- It owns every edge between two adapter layers that have no allowed edge in either direction. FF-S03 no longer reports those edges (P2: one edge, one rule).
- Composition layers are not adapter layers.

**Why D and not B or C.**
- B would give FF-S03 two constructs with opposite tier logic.
- C puts a port-isolation construct under the direction rule.
- D keeps each id to one construct, and the tier row can be stated on its own.

**Consequences (development set).**
- Hexagonal blind R goes from 12/18 to 14/18 = 0.78 [0.55, 0.91].
- ddd goes from 9/9 to 10/10, because the agreed ddd v10 api → infrastructure row becomes blocking.
- The other styles are unchanged. Author view: 57/57.
- **Real code:** every human hexagonal or ddd project with adapter → adapter imports gains blocking findings. Their precision has not been measured.

**Fresh checks required before signing.**
1. Re-score the MO-H03 seeds (10 reference, 30 real). FF-S05 is expected on every seed, and on none of the twins (0/6 and 0/18).
2. List the baseline FF-S03 adapter-pair rows on the unmodified real projects (`experiments/v1.3-operators-hexddd/projects.json`), and check each one for correctness.

If a row that should not block appears, record it here. Do not change the rule.

**Implementation (exists).** `src/construct-switches/compile.ts` (carrier), `rows.ts` `q5AdapterEdges`, `tiers.ts` (the FF-S05 tier), `overlays.ts` `ADAPTER_ISOLATION_ID`.

**Status:** draft. Signed: ______ Date: ______

---

## §Q6: in hexagonal, core isolation (FF-S04) binds domain plus application

**Context.** In hexagonal v03 and v04 an application service imports an adapter. The tool reports it as FF-S01. The blind manifest reports it as FF-S04. Today the FF-S04 template binds only the `domain` layer.

**Sources.**
- Cockburn (2005): the hexagon is the application, and it does not split domain from application.
- Verification note (2026-10-16): the phrase "application core", quoted in revision 1, **does not appear** in Cockburn's article. The argument rests on "Intent" and "Nature of the Solution", which state no explicit source-dependency rule.
- On the other side, Q11 A keeps domain → application forbidden by FF-S01 (Evans 2003 ch. 4; the *DDD Reference* 2015 places the domain below the application).

**Options considered.**
- A: the core is the domain only.
- B: the core is domain plus application.

**Decision (proposed): B.**
- In hexagonal, FF-S04's core is the union of the declared `domain` and `application` layers.
- An edge from a core file to a non-core, non-composition layer is an FF-S04 finding.
- An edge inside the core is not an FF-S04 finding. Direction inside the core stays with FF-S01.

**P2 exception (author's choice; proposed: both).** Under B, an application → adapter edge is reported by both FF-S01 and FF-S04, as domain → adapter edges already are. This ADR records it as a declared exception to P2. Making FF-S04 the only owner would need a new switch built after seeing the data, and it is not taken.

**Consequences (development set).**
- Hexagonal blind R goes from 12/18 to 13/18 = 0.72 [0.49, 0.88]: it gains #9 and #11 and loses the agreed hex v02 FF-S04, a domain → application edge that is now inside the core. FF-S01 still reports that edge.
- Author view: 53/54, 53/55.
- **The change finds no new edge.** FF-S01 already blocks every edge it adds. The gain is in the rule-id key only. A by-edge metric would show none.

**Fresh check required before signing.** Re-score the MO-H02 seeds (a use case injects a concrete outbound adapter) with FF-S04 added to the expected rules. FF-S04 is expected on every seed, and the MO-H02n twins should show no new rows.

**Implementation (exists).** `src/construct-switches/rows.ts` `q6ApplicationCore`.

**Status:** draft. Signed: ______ Date: ______

---

## §Q10: FF-P01 domain purity is not applicable to layered; packages reach FF-S01 through a declared mapping

**Context.**
- Layered v07 has a `typeorm` decorator on a business model, and layered v08 has a business service typed on `express`. The tool and the author manifest report FF-P01 on both.
- The blind manifest skips FF-P01 in layered. It treats v07 as a near miss ("the layered sources do not require a framework-free business layer") and files v08 under FF-S01.

**Sources.**
- [SRS: Layered] states no purity rule.
- Fowler (2002) ch. 10, Active Record, puts persistence in domain objects.
- [SRS: Layered, FF-S01/S03]: lower layers do not use upper ones, so a business service typed on a web framework reaches upward.
- The source wins over the rule's wording (P1, as in ADR-V13-02 for FF-P06).

**Options considered.**
- A: FF-P01 forbids every declared framework.
- B: FF-P01 forbids web/UI packages only.
- C: not applicable, plus a package-to-layer mapping for FF-S01.
- D: not applicable, with no replacement.

**Decision (proposed): C, with D as the fallback.** Select it by the fresh check below, not by development recall.
- FF-P01 `domain-purity` is disabled for `layered`, with the reason "not applicable to style layered (P1)" (`COMPILER_004`, listed under `disabledFunctions`).
- Under C, a declared mapping `CONSTRUCT_PACKAGE_LAYERS.layered = { express, koa, fastify → presentation }` makes an import of a mapped package from a lower layer an FF-S01 `dependency-direction` row. Re-export package edges are skipped, and so are type-only edges under Q2 B.
- **The mapping is frozen as written before any re-run.** No package is added after seeing a result.

**Why not B.** B would invent a layered-specific package list that no source states.

**Consequences (development set).**
- C: layered blind R goes from 7/10 to 8/10 = 0.80 [0.49, 0.94], and P from 7/11 to 8/10. Author view: 52/52, 52/53.
- D: layered blind R stays at 7/10, and P becomes 7/9. Author view: 52/52, 52/52.
- With §Q12: C gives 8/10 and 8/8, while D gives 7/10 and 7/7.
- **Risk:** only `express` is exercised on the development set. The mapping is the most fit-prone item in this ADR.

**Fresh check required before choosing C or D.** Re-run the 5 external layered repositories (`Docs/DiagnosticRuns/v1.3-external-set-3-2026-10-16.md:54-58`) at their pinned SHAs.
1. List the FF-P01 rows that disappear: q00-api-server 2, bymi15-express-typeorm 4 and firmanjs-express-template 2.
2. List every new FF-S01 package-layer row.
3. Choose C only if the new rows are correct and the removed rows were not judged correct and meaningful. Otherwise choose D.

**Implementation (exists).** `src/construct-switches/compile.ts:103`, `rows.ts` `q10PackageLayers`, `overlays.ts` `CONSTRUCT_PACKAGE_LAYERS`.

**Status:** draft. Chosen: C / D. Signed: ______ Date: ______

---

## §Q12: in layered, FF-S03 reports only downward edges that pass over a layer

**Context.** `no-layer-skip` fires on every edge outside the allowed set, upward ones included. In layered v01 (persistence → business) and v02 (business → presentation), the tool reports both FF-S01 and FF-S03 on one adjacent upward edge.

**Sources.**
- [SRS: Layered, FF-S01/S03]: "lower layers do not use upper ones" is FF-S01, and strict layering "also forbids skipping a layer" is FF-S03.
- A skip passes over an intermediate layer, and an adjacent upward use passes over none.
- Verification note: Fowler calls layering "mostly opaque", and POSA has a relaxed variant. That bears on whether FF-S03 blocks at all, not on what it reports.

**Options considered.**
- A: report both rules.
- B: FF-S03 reports downward skips only.

**Decision (proposed): B.**
- In layered, an FF-S03 row is dropped when the reverse of its transition is an allowed transition. That is an adjacent upward edge.
- An upward edge across two or more layers is kept, because its reverse is not allowed under strict layering.
- The rule only removes rows (P2).

**Consequences (development set).**
- Layered blind R is unchanged at 7/10. Blind P goes from 7/11 to 7/9.
- Author view: 52/54, 52/52. The author manifests list FF-S03 on the two upward edges; under this decision those entries read the construct wrongly.

**Fresh check.** On the 5 external layered repositories, count the adjacent-upward FF-S03 rows that are removed and are not also FF-S01 rows. Each one judged correct by the external correctness labels counts against this decision, and is recorded here.

**Implementation (exists).** `src/construct-switches/rows.ts` `q12UpwardNotSkip`.

**Status:** draft. Signed: ______ Date: ______
