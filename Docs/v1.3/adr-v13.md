# v1.3 Architectural Decision Records

These are development-cycle decisions for v1.3. They do not change Study 1 (v1.2E, frozen).

## ADR-V13-01: Record both literal and resolved edges for re-exports (barrels)

**Date**: 2026-10-15. **Status**: Accepted (author: "yes A").

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
