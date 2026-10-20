# v1.3 Architectural Decision Records

These are development-cycle decisions for v1.3. They do not change Study 1 (v1.2E, frozen).

## ADR-V13-01: Record both literal and resolved edges for re-exports (barrels)

**Date**: 2026-10-15. **Status**: Accepted (author decision: option A).

**Context.** The graph-fidelity harness (PR #81, `Docs/DiagnosticRuns/v1.3-graph-fidelity-2026-10-14.md`) and the DDD unit (PR #83, probe E1) found the same defect independently. When a file imports a name through a re-export file (a barrel), the extractor routes the IMPORTS edge to the file that declares the name and drops the edge to the re-export file. Verified on source: in `opus/order-fulfilment/full-aac/run-1`, `infrastructure/persistence/InMemoryOrderRepository.ts` imports `../../application/ports/persistence`, which only re-exports `domain/` types, and the graph records only infrastructure → domain. This can cause false positives (for example, a controller importing an application barrel appears to import a domain entity) and false negatives (a dependency on the barrel's layer is invisible).

**Options.** (A) Record both edges. (B) Keep resolved edges only, as today. (C) Keep literal edges only.

**Decision.** A.
- The extractor emits the **literal** IMPORTS edge to the file the specifier resolves to, which is the import statement's real module dependency.
- Where that file re-exports the imported name, it also emits a **resolved** edge to the declaring file, marked `viaReExport: true` with the barrel path recorded.
- Every v1.3 template states which view it reads:
  - *literal* for layer-direction, layer-skip, cycle, context-isolation and public-API rules;
  - *resolved* for usage rules (domain purity by symbol, controller-no-entity, aggregate boundary).

  Each template's choice is recorded with its reason, *before* the reference validation is rerun.
- v1.2E reproduction keeps today's behaviour under `V12E_DEFAULT_OPTIONS`.

**Consequences.**
- The fidelity harness must compare both views (literal against dependency-cruiser and tsc; resolved against the hand-written viaReExport edges).
- The reference-validation rerun after this change is the measurement of the fix's effect.
- Cycle detection on literal edges may find barrel-induced cycles that resolved edges hide. These are reported as findings.

## ADR-V13-02: FF-P06 domain-state-purity applies only to styles with an isolated domain

**Date**: 2026-10-15. **Status**: Accepted under the author's delegation (DELEG2, 2026-10-20). Accepted under delegation, not signed: the author answered Q1 A, "sign ADR-V13-02 as drafted" (decision desk, 2026-10-19), and delegated the remaining signatures to the coordinator (`ops/decisions.md` DELEG2). The Q13 wording correction below was made before the move. Implemented on `v1.3-fixes` as a v1.3 style-applicability rule (`V13_COMPILE_OPTIONS.styleApplicability`); the v1.2E compile is unchanged. Written before the reference validation was rerun with the change.

This is a development-cycle decision for v1.3. It does not change Study 1 (v1.2E, frozen), the sealed tier table (`Docs/v1.3/rule-tiers.md`) or any manifest.

### Context

FF-P06 (`domain-state-purity`, blocking, partial) reports a class in the layer of kind `domain` that holds a class or interface of the layer of kind `infrastructure`, through a constructor-injected parameter (`CONSTRUCTOR_INJECTS`; the `FLOWS_TO` half is reported N/A). Its sealed construct is "core isolation of state" (`rule-tiers.md`).

The rule binds layers by **kind**. The layered preset (`presets/layered.yaml`, closed layering after Buschmann et al. 1996) declares three layers, bottom-up: `persistence` (kind `infrastructure`), `business` (kind `domain`) and `presentation`. FF-P06 therefore reads "a business class holds a persistence class".

In the U-E baseline (`Docs/DiagnosticRuns/v1.3-reference-baseline-2026-10-15.md`) FF-P06 produced **53 of the 60 blocking false positives** in `layered` (5 distinct rows, repeated on every variant): `OrderService -> {Customer,Order,Product}Gateway`, `CatalogService -> ProductGateway`, and `SalesReportService -> Database` on n02. It also failed the layered clean variant, which both manifests and the reference notes judge clean. The reference notes had predicted this before the tool ran (RDQ-1, `Docs/v1.3-reference-notes.md`): "In closed layering, a business service holding a persistence gateway is the intended dependency, so there is nothing to plant."

### The construct

- **Layered.** Fowler (2002, ch. 1 "Layering") and the POSA Layers pattern (Buschmann et al. 1996): a higher layer uses the services of the layer below it; the lower layer does not use the upper one. Under closed layering the business layer's use of the persistence layer is the defining *allowed* dependency, not a breach. Nothing in the layered style requires the business layer to be free of persistence state: holding a gateway or a table data gateway is how the business layer reaches the layer below (Fowler 2002, ch. 10 "Data Source Architectural Patterns"). `Docs/v1.3/style-rule-sources.md` lists no isolated-domain rule for Layered.
- **Clean, Hexagonal, DDD, NestJS.** Each requires an isolated domain whose dependencies on infrastructure are inverted:
  - Clean: the Dependency Rule; entities and use cases do not depend on databases (Martin 2017, ch. 22).
  - Hexagonal: the core reaches the outside only through ports and does not depend on adapters (Cockburn 2005).
  - DDD: "Isolating the Domain" (Evans 2003, ch. 4).
  - NestJS: the repo's NestJS preset (`presets/nestjs.yaml`) is not a Clean Architecture layering. Its order, inner to outer, is domain → infrastructure → application → presentation, and application services call the repositories in the infrastructure layer directly (Controller → Service → Repository). The preset does keep an isolated domain at the bottom. The innermost layer is `domain` (kind `domain`: entities, value objects, domain services and repository interfaces). The preset declares `no-domain-outward-dep`, `domain-purity` and `domain-state-purity` for that layer. So the isolated-domain reasoning applies to the `domain` layer, while the Clean ordering of the outer layers does not.

  In these styles, a domain class that holds an infrastructure object is exactly the breach FF-P06 names.

The rule's construct is therefore style-dependent: it exists only where the style requires an isolated domain. In `layered`, "a business class holding a persistence class" is not a violation of the style. It is not a weaker violation either: the style permits it.

### Options

- **(A) Applicability.** FF-P06 is not applicable in `layered`. It is disabled with the reason "not applicable to style layered" (`COMPILER_004`, listed under `disabledFunctions`, as the Clean-Architecture-only templates are). Its tier is untouched: wherever it applies it stays blocking, partial.
- **(B) Rebind.** Keep FF-P06 in `layered` but exclude the adjacent lower layer from its target. In the three-layer preset that excludes the only infrastructure layer, so the rule would select nothing: (A) with extra machinery.
- **(C) Tier change.** Make FF-P06 advisory in `layered`, like FF-S03's style-dependent tier. This would still report a dependency that the style defines as correct, now as advice. A tier is for how strongly a constraint binds; here no constraint exists. A tier change also needs the sealed-file ADR route, and the reason would rest on a precision observation, which `rule-tiers.md` does not accept on its own.

### Decision (accepted under delegation, 2026-10-20)

**A.** In v1.3, FF-P06 applies only where the style requires an isolated domain: `clean-architecture`, `hexagonal`, `ddd` and `nestjs`. In `layered` it is not applicable. A spec without a declared style keeps the rule, as before.

This works like FF-S03's style dependence: the style decides whether the construct exists, and the tiers are not touched. FF-S03's dependence is in the tier table (blocking only for `layered`); FF-P06's is in applicability, because in `layered` the construct does not exist at all, rather than existing with a weaker force.

### Implementation (v1.3 only)

- `src/fitness-compiler/v13-applicability.ts`: `V13_STYLE_APPLICABILITY` maps `domain-state-purity` to the four styles. `compileFunctions` checks it when `CompileOptions.styleApplicability` is set. `V13_COMPILE_OPTIONS` sets it, so the pipeline's `CompileCommand` and `validate --rules v1.3` apply it.
- The frozen catalogue (`CYPHER_TEMPLATES`, its `applicableStyles`) is not edited. `compileFunctions(input)` without the option compiles exactly as before, so the v1.2E compile output is byte-identical (asserted by a test).
- `RULE_TIERS` and `Docs/v1.3/rule-tiers.md` are not edited.

### Consequences

- **Expected on the reference set** (written before the rerun): the 53 FF-P06 rows in `layered` disappear, the layered clean variant passes, and layered blocking precision rises. No layered manifest expects FF-P06 (`reference.json`: `noViolatingVariant`), so no recall is lost. The other styles are unaffected.
- A layered project whose business layer holds infrastructure state *without* going through the layer below cannot be expressed with the current three-layer binding anyway; if a Study 2 spec author wants such a check, it needs its own rule over a declared "data source" boundary, not FF-P06.
- The thesis reports FF-P06 per style with "n/a (layered)", and the applicability table is an instrument fact to report next to the tier table.

### Note: factual correction (v1.3 fix batch)

The NestJS bullet under "The construct" used to call the NestJS preset "a Clean Architecture layering inside Nest modules". That contradicts `presets/nestjs.yaml`: in the preset, services call repositories directly, with infrastructure as an inner data-access layer (`Docs/v1.3/construct-decisions.md` Q13, action item). The bullet now describes the preset as it is. The decision does not change. FF-P06 still applies to `nestjs`, because the preset's `domain` layer is innermost and isolated, and FF-P06 reads a domain class that holds an infrastructure object. This correction does not answer Q13 (the layer order and FF-P04).

## ADR-V13-03: Construct decisions Q1–Q25

**Date**: 2026-10-19 (draft written 2026-10-20 from the signed answers; accepted 2026-10-20). **Status**: Accepted under the author's delegation (DELEG2, 2026-10-20). Accepted under delegation, not signed: the construct **answers** are the author's (decision desk, 2026-10-19; Q10 D delegated, §Q10), and the author delegated this ADR's acceptance to the coordinator once the Q10 = D re-run was merged (`ops/decisions.md` DELEG2; PR #305 merged at `b86ffefb`). The fresh checks ran first, as the U6 plan requires (Steps 10, 11, 11b). The tier reason strings in `src/construct-switches/tiers.ts` read "accepted under delegation DELEG2 2026-10-20" instead of "unsigned" (freeze-check F5).

This is a development-cycle decision for v1.3. It does not change Study 1 (v1.2E, frozen), the sealed tier table (`Docs/v1.3/rule-tiers.md`), the presets, the frozen template text or any manifest. Under `--scoring v1.2e` no switch applies.

**Form (G0.7 = A, signed 2026-10-19 by the author via the decision desk).** One ADR, one entry per answered question that owes one, entered in the G14 dated deviation list now.

**With sight of development effects.** The questions were written in `Docs/v1.3/construct-decisions.md` (revision 1, 2026-10-15) with sight of development-set effects, and this ADR says so. Every answer below was signed on its construct source (the author's principle, `ops/decisions.md` U6: "rules are never hand-written and never tuned to the misses"). Development figures appear only as consequences.

### Inputs

- Answers file: `Docs/v1.3/construct-answers.json` (sha256 `c0c70b2802c8965c3c4593fce8b329a11ce724342e2322caf53cc5ac67782e25` after the Q10 D re-apply of 2026-10-20; the draft's `dc5daabd…` was the Q10 C file), 25 of 25 answered.
- Switch block: `src/shared/construct-switches.ts` (file sha256 `1af1c53e74ce55c3a76932c61b9f3afb2cd5c00d4fc6a7a9883d29a7b4d7155c` after the Q10 D re-apply), rewritten by `scripts/v1.3/apply-construct-answers.ts`.
- Source of the answers: `ops/review/2026-10-19/decision-desk/answers.json` (61 answers: 56 signed by the author, 5 delegated to the coordinator by the author, `ops/decisions.md` DELEG).
- Principles: P1 = A, P2 = A, Precedence = A (the source wins through a declared ADR), signed 2026-10-19 by the author via the decision desk.

### Answers

| Q | Answer | Q | Answer | Q | Answer | Q | Answer | Q | Answer |
|---|---|---|---|---|---|---|---|---|---|
| Q1 | A | Q6 | B | Q11 | A | Q16 | B | Q21 | B |
| Q2 | A | Q7 | A | Q12 | B | Q17 | A | Q22 | B |
| Q3 | C | Q8 | B | Q13 | B | Q18 | B | Q23 | B |
| Q4 | A | Q9 | A | Q14 | C | Q19 | A | Q24 | A |
| Q5 | C | Q10 | D | Q15 | B | Q20 | A | Q25 | B |

Every answer: signed 2026-10-19 by the author via the decision desk. Exception: Q10 was signed C (provisional until the G0.9 Q10 check); the criterion was met, and on 2026-10-20 the move to D was delegated to the coordinator, criterion applied as written (§Q10).

### Sign-off lines printed by `apply-construct-answers.ts --dry-run` (U6 plan Step 6)

Tier ADRs (a tier move needs an ADR with a construct reason; the switch applies an override until then):
- Q3 C: FF-S02 split: in-component file cycles advisory (proxy for ADP), crossing cycles blocking (Martin 2017, ch. 13-14).
- Q15 B: FF-DS01 bounded-context-modules advisory (own row).
- Q21 B: FF-DT05 domain-event-placement blocking (Vernon ch. 8; Evans, *DDD Reference* 2015 pp. 10 and 13, by Precedence).

ADR-V13-03 "construct decisions" entries:
- Q1 A [applicability]: sign ADR-V13-02 as drafted (`Docs/v1.3/adr-v13-02-draft.md`).
- Q5 C [rule]: adapter → adapter edges are FF-S01 findings in hexagonal and ddd (P2: FF-S03 drops them). §Q5 below.
- Q6 B [rule]: hexagonal FF-S04 binds the application core (domain + application layers). §Q6 below.
- Q8 B [policy]: N/A-half policy (with Q14): sealed tier kept, FLOWS_TO half N/A, recall unestimated.
- Q10 D [applicability]: FF-P01 not applicable to layered (P1). §Q10 below. (Re-applied 2026-10-20; the first apply printed Q10 C [applicability] and Q10 C [rule]: FF-S01 reads a declared package-to-layer mapping.)
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

### Scorer alignment (G0.8 = b)

Delegated to the coordinator 2026-10-19 (recommended answer). The registered scorers (`scripts/v1.3/lib/reference-model.ts`, `scripts/v1.3/ue-score.ts`, `scripts/v1.3/lib/holdout-score.ts`) are **not** changed, and the registered figures are reported as computed. So:
- Q5 is C, not D: FF-S01 is the blind reader's own id for these edges, so the blocking gain is scored natively. No FF-S05 row is needed in `blind-rule-mapping.json`.
- Under Q10 D (as under C), FF-P01 stays in the layered scope of the committed descriptor, so the author-manifest FF-P01 rows in layered are misses in the author view. This is reported, not fixed.
- No scoring deviation enters the G14 list.

### Refutation criteria (G0.9), dated 2026-10-19, before any fresh check ran

Delegated to the coordinator 2026-10-19 (recommended answer: as drafted on `ops/notes/signing-sheet-2026-10-19.md` §5). A met criterion may only send a question back to A, or Q10 from C to D. It never adds an option or changes a list. The criteria are applied as written, not reinterpreted.

| Switch | Fresh check | The result that withdraws it |
|---|---|---|
| Q5 C | MO-H03 seeds and twins (hexagonal; ddd has no seeded check); correctness read of the adapter-pair rows on the real hex/ddd projects | any MO-H03 seed missed, **or** any twin gains a blocking row, **or** any listed real-code row is judged incorrect by the C3 correctness procedure and is not also reported by FF-S01 → Q5 back to A |
| Q6 B | MO-H02 seeds with FF-S04 expected; twins | any MO-H02 seed missed, **or** any twin gains a blocking row → Q6 back to A |
| Q10 C | FF-P01 and new FF-S01 package rows on the 5 external Layered repos | any listed row judged incorrect by the C3 procedure and not also reported by FF-S01 → Q10 goes to D |
| Q12 B | adjacent-upward FF-S03 rows on the 5 external Layered repos | any adjacent-upward edge that Q12 B stops reporting under FF-S03 is not reported by FF-S01 either → Q12 back to A |

### §Q5: adapter → adapter is an FF-S01 finding (hexagonal, ddd)

**Context.** In hexagonal v05 and v06 an adapter imports another adapter, and the status-quo tool reports it as FF-S03 `layer-skip-graph`, which is advisory. The blind manifest reports the edge as FF-S01 (blocking).

**Sources.** Cockburn (2005), "Intent" and "Nature of the Solution": every actor interacts with the application through a port. Verification note (2026-10-16, `construct-decisions.md`): Cockburn never says adapters must not talk to each other, and in his sample the primary FIT adapter calls the secondary adapter factory. **The blocking rule is an inference from the port concept, not a quotation.**

**Decision: C.** In hexagonal and ddd, every FF-S03 row whose source and target are both adapter layers moves to FF-S01 `dependency-direction`, which is blocking: the edge breaks the spec's declared allowed dependencies. FF-S03 no longer reports it (P2). Composition layers are not adapter layers. C rather than D because of G0.8 (b): the registered scorers know FF-S01 and not FF-S05.

**Consequences (development set, offline re-score).** Hexagonal +2 and ddd +1 blocking rows. Every human hexagonal or ddd project with adapter → adapter imports gains blocking findings; their precision is checked by the fresh check below.

**Implementation (exists).** `src/construct-switches/rows.ts` `q5AdapterEdges`.

### §Q6: in hexagonal, core isolation (FF-S04) binds domain plus application

**Context.** In hexagonal v03 and v04 an application service imports an adapter. The tool reports FF-S01; the blind manifest reports FF-S04.

**Sources.** Cockburn (2005): the hexagon is the application, not split into domain and application. Verification note (2026-10-16): the phrase "application core", quoted in revision 1, **does not appear** in Cockburn's article; the answer rests on "Intent" and "Nature of the Solution". Q11 A keeps domain → application forbidden by FF-S01.

**Decision: B.** In hexagonal, FF-S04's core is the union of the declared `domain` and `application` layers (composition roots excluded). An edge from a core file to a layer outside the core is an FF-S04 finding; an edge inside the core is not.

**P2 exception (declared).** An application → adapter edge is reported by both FF-S01 and FF-S04, as domain → adapter edges already are. Both are named owners.

**Consequences (development set).** The change finds **no new edge**: FF-S01 already blocks every edge it adds; the gain is in the rule-id key only. It drops the agreed hex v02 FF-S04 row (now inside the core); the author ruled that row `spec` (adjudication N1).

**Implementation (exists).** `src/construct-switches/rows.ts` `q6ApplicationCore`.

### §Q10: FF-P01 is not applicable to layered, with no replacement

**Context.** Layered v07 has a `typeorm` decorator on a business model; v08 has a business service typed on `express`.

**Sources.** [SRS: Layered] states no purity rule (P1). Fowler (2002) ch. 10, Active Record, puts persistence in domain objects. Fowler (2002) ch. 1: the domain should not depend on the presentation (recalled; page to be checked before signing).

**Decision: D (2026-10-20; was C, provisional until the G0.9 Q10 check).** FF-P01 `domain-purity` is disabled for `layered` (P1), and a package import is outside what the layered rules check. The G0.9 Q10 criterion was met (2 new FF-S01 `express` rows on the external layered set judged incorrect by the C3 procedure, not also reported by FF-S01), so Q10 moved from C to D, the one fallback the criterion allows. Decided by the coordinator under the author's standing delegation for gate-level and protocol calls: a pre-dated criterion is applied as written; overriding it on a suspected checker defect would move the goalposts after seeing data.

**Limitation (reported, not acted on).** The C3 checker's reason was "the statement(s) at that line do not reach express (literal view)", and the same imports were labelled correct as FF-P01 rows. The checker appears not to handle a package target for a direction rule, so the refutation may be a checker artefact. The recommendation itself said that, with no declared package-to-layer mapping, C reduces to D; D is that reduction without the new mechanism.

**Consequence.** Layered v08 (`express` in a business service) is no longer reported. Development set (second run): layered blind blocking recall 7/10 (C: 8/10), adjudicated 7/8 (C: 8/8). See the run note, section "Q10 → D".

**Implementation (exists).** `src/construct-switches/compile.ts` (C or D disables FF-P01 in layered). The C mapping (`rows.ts` `q10PackageLayers`, `overlays.ts` `CONSTRUCT_PACKAGE_LAYERS`) stays in code but is not in force.

### §Q12: in layered, FF-S03 reports only downward edges that pass over a layer

**Sources.** [SRS: Layered, FF-S01/S03]: "lower layers do not use upper ones" (FF-S01) and strict layering "also forbids skipping a layer" (FF-S03) are two clauses; an adjacent upward edge breaks only the first (P2).

**Decision: B.** In layered, an FF-S03 row is dropped when the reverse of its transition is allowed (an adjacent upward edge). An upward edge across two or more layers is kept. The rule only removes rows.

**Implementation (exists).** `src/construct-switches/rows.ts` `q12UpwardNotSkip`.

### Fresh-check results (U6 plan Steps 10 and 11)

Recorded in `Docs/DiagnosticRuns/v1.4-u6-applied-2026-10-19.md` §2 (2026-10-20, after the criteria were dated). Evidence: `results/v1.4-u6-fresh-checks/`.
- **Q5 C: not met.** MO-H03 seeds 10/10 detected; twins 0/6. On the real hex/ddd projects, 14 adapter-pair rows move to FF-S01, and all 14 are correct by the C3 checker.
- **Q6 B: not met.** MO-H02 seeds 10/10 detected with FF-S04 in the key; twins 0/6. On real code, all 23 new FF-S04 rows are on edges FF-S01 already reports, so no new edge.
- **Q12 B: not met.** 11 adjacent-upward FF-S03 rows were removed, and all 11 are still reported by FF-S01.
- **Q10 C: met, read as written.** The 2 new FF-S01 `express` rows were judged incorrect by the C3 checker ("the statement(s) at that line do not reach express (literal view)"), and no other FF-S01 row covers them. The checker appears not to handle a package target for a direction rule; the same imports are labelled correct as FF-P01 rows. Reported per plan Step 11. **Applied as written on 2026-10-20 (delegated to the coordinator): Q10 = D.** The suspected checker defect is a limitation (§Q10).

### Acceptance (under delegation)

Accepted 2026-10-20 by the coordinator under the author's standing delegation for gate-level and protocol calls (`ops/decisions.md` DELEG2). No signature was made or invented. The Q13 action item is resolved by the corrected NestJS wording in ADR-V13-02 (its "Note: factual correction"); FF-P06 and FF-P07 are read on the preset's own order (ADR-V14-02 Q-C). Draft source: `Docs/v1.3/adr-v13-03-draft.md` (kept for history).

## ADR-V13-N4: Fragmentation inside one declared context; the A2 facts contract v1; ontology prompt v0.2; case-06 retired

**Date**: 2026-10-18. **Status**: Proposed (v1.4 U3; the id is a placeholder, assigned by the orchestrator at merge). Author approval is the review of the U3 pull request.

**Context.** Decisions N1 and M4 (the model supplies facts, not verdicts; interpretation happens before detection, as facts) and N4 (the fragmentation check works within one declared bounded context) were taken for the v1.4 instrument-alignment cycle. NS-02 (`ops/notes/ns-02-facts-contract-and-cases.md`) specified the A2 facts contract, the C3 Sem rules and the K3/K2m case set. Ontology v0 still produced verdicts itself, fragmented across directory components, and its rule pass could not label an input check. Design: `aidlc-docs/construction/v1.4/U3/functional-design/design.md`.

**Decision.**
- **Fragmentation inside one declared context (N4).** A concept-fragmentation finding needs at least 2 differently-named defining classes inside one declared bounded context (`ddd.contexts`); definers with no declared context never count. `minFragmentClasses` changes from 3 to 2. Concept pairs are also proposed inside one declared context. Concept identity across contexts is recorded as a fact with no finding. Two registered Ontology v0 mock figures change: `g-onto-min-fragment` (3 to 2) and `g-onto-found` (3 of 3 to 2 of 3: case-03 has no declared context). Both are declared as `known` in `replication/v1.3/groups/g-ontology.mjs`; `Docs/v1.3/ontology-v0-design.md` §1 to §12 are unchanged and §13 records the v0.2 baseline.
- **A2 facts contract v1.** `facts.json` is written per run (facts only; the four NS-02 invariants plus unique, sorted, content-hash ids). Two changes to NS-02 §1.3: `embodiesConcept` and `enforcesRule` carry the deterministic cluster id (`conceptId`, `ruleId`), and `inContext` is an object `{ context, declared }`. The fact policy (`agreed-only`, the default, or `any`) is run-level and recorded in `producer.factPolicy`. The Sem rules (SEM-MISPLACED, SEM-DUP, SEM-FRAG) read A1 + A2 through the query layer.
- **`PROMPT_VERSION` 0.2.** The rule pass also extracts limits checked on incoming data, each rule labelled `business` or `input-validation`; only business rules are clustered.
- **Case-06 retired.** The case-06 / case-06t pair stays on disk unchanged, marked retired in `tests/fixtures/v1.3-ontology/ns02/set.json` (the cheap role proxy separates it, NS-01 §7 falsifier 1). Pair 2 is now case-09 / case-09t, on which every cheap proxy gives the same output.

**Consequences.**
- Claims-ledger row C0215 ("3 of 3") and the min-fragment default are superseded under N4; the ledger is regenerated by its own process.
- The mock cassettes were re-recorded for the prompt bump (zero model calls); the record still makes 110 calls and the replay still accepts 128 assertions.
- A live run (the pilot and the six-case run) is still to be approved; the Gemini routes are mock-tested only.
