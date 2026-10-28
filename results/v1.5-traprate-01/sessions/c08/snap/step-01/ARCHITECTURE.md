# Architecture

The cellar code follows Domain-Driven Design. Every change keeps these rules.

1. **One aggregate per transaction.** A command changes and keeps one aggregate instance (one lot or one batch). When
   another aggregate has to follow, it reacts to a domain event that was kept with the first change; it is not
   changed in the same command. The goods-in book reacting to `lot-received` is the existing example.
2. **Contexts talk only through their published interface.** Code in one bounded context does not import or call
   another context's internal code.
3. **Business rules live in the domain model.** Decisions and invariants (quantities, dates, statuses) belong to the
   aggregates and value objects under `domain/`, not to application code, stores or the composition root.

Layout: `src/cellar/domain` (aggregates `IngredientLot` and `BrewBatch`, their store interfaces, value objects, the
`CellarEvent` facts), `src/cellar/application` (commands, readings, reactions, the relay and its ports),
`src/cellar/infrastructure` (in-memory stores and mailbox), `src/main.ts` (composition root).
