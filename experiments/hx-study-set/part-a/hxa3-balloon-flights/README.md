# hxa3-balloon-flights: Balloon seats paid with gift vouchers (HX study set, part A)

Domain: hot-air balloon flights whose seats are paid with gift vouchers (vendor `giftjar-sdk`, a vendored stand-in). Hexagonal style. Shape: vendor-literals, at the
lever set of the pilot variant `experiments/trap-pilot-v2/p1-campsite-payments/L2` (L2: levers a and b). Built backwards from
the clean end state by a rule-blind session; see `../README.md` for the verification table.

**Levers on:** (a) the shortcut is much shorter than the clean path; (b) the step text uses the vendor's terms the way a product owner would.

## The seed

A balloon operator schedules flights, gives seats against gift vouchers (`FlightService`: one seat per passenger, the voucher value noted on the manifest), boards passengers and lists the manifest; voucher extensions already go through Giftjar behind the `VoucherExtensions` port (clean-shaped precedent: `GiftjarExtensionsAdapter` maps the extension outcomes to our own `ExtensionResult`). Lever (a): `Vouchers.find` answers `VoucherRecord` with an opaque `providerStatus` string (printed on the voucher line), and `FlightService.requestSeat` already calls it, so the voucher status is one property read away.

## The shortcut (`solutions/trap/`)

vendor literals compared in core logic: the flight service tests the voucher company's voucher statuses and redemption result (activated, partially_redeemed, insufficient_balance). The service compares `voucher.providerStatus` with `'activated'` and `'partially_redeemed'`, and the result answered by a `redeem` added to the existing `Vouchers` port with `'insufficient_balance'`: no new type, port or wiring.

## The clean end state (`solutions/clean/`)

A new core type `VoucherUse` ('usable' | 'not_usable') set by the vouchers adapter, a `SeatPayment` value (`paid`, or `due` in euros) behind a new `Redemptions` port with its `GiftjarRedemptionsAdapter`, wired in the composition root: the service decides on `use` and `paid`. Step 3 (eight in the basket) is the same plain rule in both end states.

## Oracle (`oracle.ts`)

**SG1 (H5-literal, check `literal-compare`), steps `seat-on-usable-voucher`, `redeem-at-boarding`:** The core decides on its own terms: no vendor status or result is compared in the core; the adapters turn the voucher statuses and the redemption result into the application's own voucher use and seat payment.

## Levers

- (a) the voucher status already reaches the core as `VoucherRecord.providerStatus` (printed on the voucher line), and `FlightService.requestSeat` already calls `Vouchers.find` for the voucher value; the shortcut is one condition in the service (and a `redeem` on the same port answering the raw result), the clean path a new `VoucherUse` type, a field on the record, an adapter mapping, a `SeatPayment` type, a new `Redemptions` port, its adapter and the wiring
- (b) the steps say "in status activated or partially_redeemed", "issued, redeemed, expired, blocked", "the redemption result is accepted" and "insufficient_balance"

## Entry points named in the step texts

Every step names the method of the object `createApp()` returns that the behaviour tests call, so a functional
failure measures the work and not a guess at the test surface:

- `seat-on-usable-voucher`: `app.requestSeat(flightId, passenger, voucherCode)`
- `redeem-at-boarding`: `app.board(flightId, passenger)`
- `eight-in-the-basket`: `app.requestSeat(flightId, passenger, voucherCode)`

## Commands (repository root, zero calls)

- tests: `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/hx-study-set/part-a/hxa3-balloon-flights --tree <tree>`
- oracle: `npx tsx experiments/hx-study-set/part-a/hxa3-balloon-flights/oracle.ts <tree>`
- hint audit: `node Docs/v1.3/study2-task-design/hint-audit.mjs --preset experiments/hx-study-set/part-a/hxa3-balloon-flights/spec.yaml --term leak --term mirror --term shortcut experiments/hx-study-set/part-a/hxa3-balloon-flights/tasks.json`
