# Architecture

The resort code is organised with Domain-Driven Design, in two bounded contexts: `passes` (lift passes and their
credit) and `school` (ski-school lessons and their places). Changes keep the following rules.

1. **A command changes one aggregate.** Each command loads, changes and stores a single aggregate instance. If
   another aggregate has to follow, the command writes a domain event to its journal and the other side reacts to it
   later; the command never changes that other aggregate itself, and neither does the composition root.
2. **Each context is used only through what it publishes.** Outside a context, code uses only its `index.ts` and its
   `contracts.ts`; internal folders (`domain`, `application`, `infrastructure`) stay private.
3. **Rules sit in the domain model.** Checks and invariants belong to the aggregates, not to application functions,
   stores or `src/main.ts`.

How events travel: a store writes an aggregate and the events it returned in one step (`put`). The mailroom in
`src/wiring/` reads every journal after a call has finished and hands each event to the reactions a context
published (for example, the school reacts to `PassIssued` by noting the holder's name).
