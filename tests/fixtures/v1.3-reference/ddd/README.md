# DDD reference project (v1.3, FR-V3 / FR-V4)

A small TypeScript project (31 files in `clean/src`, compiles with `tsc -p clean/tsconfig.json`) with two bounded
contexts, `ordering` and `billing`, a shared kernel (`src/shared-kernel`) and a composition root (`src/main.ts`).
It is evaluated with `presets/ddd.yaml` unchanged; the preset's `ddd:` block declares exactly this project.

- `ordering`: aggregates `Order` (root `Order.ts`, inner entity `OrderLine.ts`) and `Customer` (no inner entity);
  value objects `OrderId`, `CustomerId`, `Quantity`; event `OrderPlaced`; services `PlaceOrder`, `GetOrderSummary`.
  Public API: `index.ts` and `contracts/` (the `OrderSummary` published language).
- `billing`: aggregate `Invoice` (inner entity `InvoiceLine.ts`); event `InvoiceIssued`; service `IssueInvoice`
  depending on the port `application/ports/OrderSource.ts`, implemented by the anti-corruption layer
  `acl/OrderingAcl.ts`, which reads ordering through ordering's public API only.

Layers per context: `domain/`, `application/`, `infrastructure/` and `acl/` (infrastructure), `api/`; the public-API
files carry no layer.

## Variants

`variants/<id>/` holds an overlay: `overlay/` files replace or add files of `clean/`, `variant.json` names the rule,
describes the plant and lists files to delete. A variant is materialised by copying `clean/`, deleting the listed
files and copying the overlay on top (`tests/unit/ddd/reference-project.ts`). Each `v..` variant plants exactly one
violation of a different rule; `n01` is a negative control that exercises the ACL exception and must produce nothing.

| Variant | Rule | Plant |
|---|---|---|
| v01-aggregate-boundary | FF-DT01 | an application service names the inner entity `OrderLine` |
| v02-repository-for-inner-entity | FF-DT02 | `OrderLineRepository` inside the Order module |
| v03-mutable-value-object | FF-DT03 | `Quantity` gets a mutable field and `setValue` |
| v04-framework-in-domain | FF-DT04 | `InvoiceId` imports `class-transformer` |
| v05-event-outside-domain | FF-DT05 | `InvoiceIssued` moves to billing's application layer |
| v06-fat-application-service | FF-DT06 | `IssueInvoice` holds discount, tax-exemption and rounding helpers |
| v07-module-outside-context | FF-DS01 | an undeclared top-level module `src/utils` |
| v08-cross-context-internal-import | FF-DS02 | billing's service imports ordering's `Order` directly |
| v09-domain-imports-application | FF-S01 | ordering's `Customer` imports an application type |
| v10-api-imports-infrastructure | FF-S03 | `OrderController` imports `InMemoryOrderRepository` |
| n01-acl-internal-import | none | billing's ACL imports ordering's internal `OrderId` (allowed) |

## Manifests

`expected-graph.json` (layer and context of every clean file, the key edges, the edges that must be absent) and
every `expected-findings.json` were written from the rule definitions in `Docs/v1.3-ddd-notes.md` §1 **before** the
templates existed. They are not edited to match the tool; differences are recorded in the notes, §6.

`v04` imports `class-transformer`, which resolves from the repository's `node_modules` (a transitive dependency); the
variant is not required to compile elsewhere.
