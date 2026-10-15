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
