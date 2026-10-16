# DDD project, devset-b copy (v1.3)

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

`variants/<id>/` uses the overlay format of `tests/fixtures/v1.3-reference/ddd/` (`overlay/`, `variant.json`,
`expected-findings.json`). The devset-b variants, their roles and their counts are listed in `devset-b.json` and in
`../README.md`. `clean/` is a byte copy of the reference project's `clean/`.
