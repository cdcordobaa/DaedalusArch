# FF-P05 controller-no-entity through type edges (v1.3 fix batch)

## Construct reason

Martin (2017, ch. 22, "Clean Architecture", *What data crosses the boundaries*): the data that crosses a boundary is
simple data structures. "We don't want to cheat and pass Entity objects or database rows." A controller is the
boundary between the delivery mechanism and the application. When an entity crosses that boundary as it is, the
delivery format is coupled to the domain model. A change to the entity then changes the API, and the reverse holds
too. The usual remedy is a DTO at the boundary: the controller takes and returns request and response models, and
the use case or service maps them to entities.

The boundary of a controller is its public surface: the parameter and return types of its public methods. So the
construct fact is **"a public method of an exported controller class names a domain entity class in its parameter
or return type"**. The type checker resolves this fact. It counts an inferred return type, a `Promise<T>`, an array,
a union and a type alias. A barrel that re-exports the entity changes nothing, because the edge points to the
declaring class.

FF-P05 stays **advisory** (`Docs/v1.3/rule-tiers.md`: "Guideline (DTOs at boundaries); styles differ on it"). This
change adds a second way of observing the same construct. It does not change the tier.

## What the frozen template sees, and what it misses

The frozen v1.2E template walks `(ctrl:Class)-[:IMPORTS|CONSTRUCTOR_INJECTS*1..2]->(entity:Class)`. IMPORTS edges
join File nodes, so only the CONSTRUCTOR_INJECTS part can match (`Docs/v1.3/edge-views.md`). A controller that
*returns* an entity it received from a service has no such edge. Two dev-set misses follow from this
(`Docs/DiagnosticRuns/apg2-live-2026-10-15.md`, `Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md`):

- nestjs v09: `WorkshopsController.findOne(): Promise<Workshop>`. The APG v2 graph holds the edge
  `WorkshopsController.findOne -SIGNATURE_USES-> Workshop` (return position, public surface).
- clean-architecture v07: `LoanController.show` reads a `Loan` only in its body (a local variable's annotation). Its
  signature is `(HttpRequest) => Promise<HttpResponse>`, so no signature edge names `Loan`.

## The v1.3 extension

Under v1.3 only (`CompileOptions.signatureTypes`, set in `V13_COMPILE_OPTIONS`), the compiled FF-P05 query gets a
second branch over SIGNATURE_USES. The two branches are joined with `UNION` inside `CALL { }`, and the result is
ordered as before:

```cypher
MATCH (ctrl:Class)-[:CONTAINS]->(:Method)-[u:SIGNATURE_USES]->(entity:Class)
WHERE u.publicSurface = true
  AND ctrl.layer = $controllerLayer AND entity.layer = $domainLayer
  AND ctrl.name ENDS WITH 'Controller'
RETURN ctrl.name AS controller, entity.name AS entity, ctrl.filePath AS filePath
```

- **Edge.** SIGNATURE_USES is the only type edge the APG holds: a checker-resolved edge from a Method or Function
  to the Class or Interface its signature names. The v1.3 default graph has no resolved type edge. `Method.returnType`
  is unresolved text, so it is not read. On a graph without APG v2 (`apg2` is off in `V13_DEFAULT_OPTIONS`), the
  branch returns no rows, and FF-P05's rows are those of the frozen branch.
- **Controller.** The controller-layer class must be a controller. Its name must end with `Controller`, which is the
  v1.3 role-token reading (`v13-role-names.ts`). Without this check, every repository adapter in a Clean
  `infrastructure` layer that returns an entity would be reported. The `@Controller` decorator is not read, because
  the ingestion does not write `decorators` to Neo4j (`graph-ingester.ts`). A decorator test would always be false
  live, and it would disagree with the in-memory mirror.
- **Entity.** A Class in the domain layer, not an Interface. A domain interface in a controller signature is a port or
  a type contract, not an entity. The frozen branch keeps its name-suffix selection (`$entityRoles`). The signature
  branch reads the layer instead. The reason is the construct itself: a domain class in a controller's public signature
  is what crosses the boundary, whatever its name. This narrows nothing in the frozen branch, and it does not answer
  `construct-decisions.md` Q23 for the frozen branch. Q23 asks whether the import and injection branch should select
  entities by layer.
- **Public surface.** `u.publicSurface` = the method is public and its class is exported. A private mapper inside the
  controller is not the boundary.

## Expected effect on the dev set (in-memory mirror, `tests/unit/fitness-compiler/v13-ffp05-signature.test.ts`)

- nestjs v09: caught (`WorkshopsController` → `Workshop`) on an APG v2 extraction.
- clean-architecture v07: **still missed**. The entity is used only in the method body, and no type edge names it.
  An import-only fallback (the resolved IMPORTS edge from the controller file to the entity file) would catch it. The
  same fallback would also report a controller that imports a domain class for another reason (nestjs n01 catches
  `DomainError`), so it is not part of this change.
- No other variant produces a signature-branch row. A scan of all 56 variants of the clean-architecture, nestjs,
  layered and hexagonal reference projects with the mirror (APG v2 extraction) gives exactly one row, nestjs v09. The
  unit test pins the clean projects, the near-misses (clean n03, nestjs n01 to n03) and clean v07.

The live reference run uses `V13_DEFAULT_OPTIONS`, without APG v2, so its figures do not move until a run extracts
with APG v2.
