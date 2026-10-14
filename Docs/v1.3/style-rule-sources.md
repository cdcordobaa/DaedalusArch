# v1.3 Style Rule Sources

**2026-10-14 (Fable review, finding 6).** For each blocking rule: the canonical source and the constraint it encodes. The constraints are **paraphrased** with a chapter reference. The author should verify the exact wording against the books before thesis use, and add page-exact quotes in the thesis. This table is the only rule input the blind manifest writer receives (see `Docs/v1.3/validation-protocol.md`).

| Style | Rule | Source | Constraint (paraphrase) |
|---|---|---|---|
| Clean | Dependency direction (FF-S01) | Martin, *Clean Architecture* (2017), ch. 22 "The Clean Architecture", the Dependency Rule | Source-code dependencies point only inward. Nothing in an inner circle knows anything about an outer circle. |
| Clean | Domain purity (FF-P01) | Martin 2017, ch. 22; ch. 32 "Frameworks are details" | Entities and use cases do not depend on frameworks, databases or the UI. |
| Clean | Repository / gateway placement (FF-P03) | Martin 2017, ch. 22 (interface adapters); ch. 11 (DIP) | The data-access interface is owned by the inner layer, and the implementation lives in the outer layer (dependency inversion across the boundary). |
| Clean, Layered | Acyclic dependencies (FF-S02) | Martin 2017, ch. 14 "Component Coupling", ADP | The component dependency graph has no cycles. |
| Layered | Downward-only, no skipping when strict (FF-S01, FF-S03) | Fowler, *Patterns of Enterprise Application Architecture* (2002), ch. 1 "Layering"; Buschmann et al., *POSA vol. 1* (1996), Layers pattern | A higher layer uses services of lower layers, and lower layers do not use upper ones. Strict layering also forbids skipping a layer. |
| Hexagonal | Core isolation, dependency direction (FF-S04, dependency-direction-graph, core-isolation) | Cockburn, "Hexagonal Architecture" (2005) | The application core communicates with the outside only through ports. It does not depend on adapters, UI or databases. |
| Hexagonal | Port-adapter (port-adapter-pattern) | Cockburn 2005 | Each external actor talks to the application through a port. Adapters convert between the port and the technology; secondary (driven) adapters implement ports the core defines. |
| DDD | Aggregate boundary | Evans, *Domain-Driven Design* (2003), ch. 6 "Aggregates"; Vernon, *Implementing DDD* (2013), ch. 10 | Objects outside the aggregate may hold references only to the root. Inner entities are reached through the root. |
| DDD | Repository only for aggregate roots | Evans 2003, ch. 6 "Repositories"; Vernon 2013, ch. 12 | Repositories are provided only for aggregate roots that actually need direct access. |
| DDD | Value-object immutability | Evans 2003, ch. 5 "Value Objects"; Vernon 2013, ch. 6 | A value object is treated as immutable. Replace it rather than modify it. |
| DDD | Isolated domain (framework-free) | Evans 2003, ch. 4 "Isolating the Domain" (Layered Architecture) | Domain code is separated from UI, application and infrastructure concerns. |
| DDD | Bounded-context isolation | Evans 2003, ch. 14 "Maintaining Model Integrity" (Bounded Context, Context Map, Anticorruption Layer); Vernon 2013, ch. 2–3 | Each model applies within an explicit boundary. Integration across contexts is explicit, through a published interface, or translated by an anticorruption layer. |
| NestJS | Module boundaries and DI (style preset) | NestJS documentation, "Modules", "Providers" | Providers are encapsulated in modules. Other modules use only what a module exports. |
