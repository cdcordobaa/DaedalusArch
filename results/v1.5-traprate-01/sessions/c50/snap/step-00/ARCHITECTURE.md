# Architecture

The school's code is organised the Domain-Driven Design way, in two bounded contexts:

- `src/placement/` decides who a student is academically: their placement test results, their standing and their
  CEFR level. Its published interface is `src/placement/published/` (the `PlacementDesk` and the `ProgressSheet`).
- `src/enrolment/` runs the course desk: course runs, seats, completions and certificates. It reaches placement
  through `src/enrolment/acl/` and the ports in `src/enrolment/application/ports/`.

`src/shared-kernel/` holds what both share (the CEFR scale, the event type). `src/main.ts` wires everything.

Every change keeps these rules:

1. **A command changes and saves one aggregate.** If another aggregate has to follow, it does so from a domain event
   stored with the change, never inside the same command.
2. **A context uses only what another context publishes.** No import of, or call into, another context's internal
   code (its domain, application or infrastructure folders).
3. **Business rules sit in the domain model.** Decisions and invariants belong to the aggregates and domain objects of
   the context that owns them, not to application services, adapters or the composition root.
