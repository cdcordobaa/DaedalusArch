# hxb1-bakery-flour: Flour orders when the wholesaler says no (HX study set, part A)

Domain: a village bakery ordering flour bags from a wholesaler (vendor `sackline-sdk`, a vendored stand-in). Hexagonal style. Shape: error-codes, at the
lever set of the pilot variant `experiments/trap-pilot-v2/p4-dental-calendar/L2` (L2: levers a and b). Built backwards from
the clean end state by a rule-blind session; see `../README.md` for the verification table.

**Levers on:** (a) the shortcut is much shorter than the clean path; (b) the step text uses the vendor's terms the way a product owner would.

## The seed

A bakery's buyer lists the wholesaler's flours (`OrderFlourService.flours`: sorted by grade, then name) and places orders (`order`: 1 to 60 bags, a delivery day). Any Sackline refusal reaches the core as `SupplyRefused` with the vendor's code in `detail` (shown on the buyer's screen). Lever (a): the code is one property read away in the service.

## The shortcut (`solutions/trap/`)

vendor error codes and the vendor's cents field carried into core errors and values: the core error holds the wholesaler's code and shortfallCents, and the service branches on OUT_OF_STOCK and BELOW_MINIMUM. The service catches `SupplyRefused` and compares `detail` with `'OUT_OF_STOCK'` and `'BELOW_MINIMUM'`; the adapter passes `shortfallCents` into a new field of the same name on `SupplyRefused`.

## The clean end state (`solutions/clean/`)

Two new core errors, `FlourSoldOut` and `BelowMinimum(missing: number | null)` in euros, thrown by the adapter for the two codes (every other code stays `SupplyRefused`); the service catches them by type. The alternative flour and the weekday rule (step 3) are the same in both end states.

## Oracle (`oracle.ts`)

**SG1 (H5-codes, check `error-codes`), steps `sold-out`, `below-minimum`:** Supplier refusals reach the core as the application's own errors: no vendor error code is held in the core, no core error carries a raw code string, and no core field takes the vendor's unit-named field.

## Levers

- (a) the vendor code already reaches the core as `SupplyRefused.detail`; the shortcut is two comparisons in the service and one more constructor field on the existing error, the clean path two new core errors and an adapter mapping (with the cents turned into euros there)
- (b) the steps say "Sackline answers OUT_OF_STOCK", "BELOW_MINIMUM with shortfallCents"

## Entry points named in the step texts

Every step names the method of the object `createApp()` returns that the behaviour tests call, so a functional
failure measures the work and not a guess at the test surface:

- `sold-out`: `app.order(orderId, sku, bags, deliverOn)`
- `below-minimum`: `app.order(orderId, sku, bags, deliverOn)`
- `weekday-delivery`: `app.order(orderId, sku, bags, deliverOn)`

## Commands (repository root, zero calls)

- tests: `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/hx-study-set/part-a/hxb1-bakery-flour --tree <tree>`
- oracle: `npx tsx experiments/hx-study-set/part-a/hxb1-bakery-flour/oracle.ts <tree>`
- hint audit: `node Docs/v1.3/study2-task-design/hint-audit.mjs --preset experiments/hx-study-set/part-a/hxb1-bakery-flour/spec.yaml --term leak --term mirror --term shortcut experiments/hx-study-set/part-a/hxb1-bakery-flour/tasks.json`
