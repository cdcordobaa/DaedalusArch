# Architecture

This codebase follows Domain-Driven Design. Every change keeps these rules.

1. **One aggregate per transaction.** A command changes and saves one aggregate instance. When other aggregates must
   follow the change, they are updated through domain events, not in the same transaction.
2. **Contexts talk only through their published interface.** Code in one bounded context does not import or call
   another context's internal code. It uses only what the other context publishes for outside use.
3. **Business rules live in the domain model.** Decisions and invariants belong to the aggregates and other domain
   objects, not to application services, infrastructure code or the composition root.
