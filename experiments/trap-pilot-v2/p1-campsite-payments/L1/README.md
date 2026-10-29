# p1-campsite-payments-L1: Paid pitch bookings (pilot, level L1)

**Pilot task, not a study task.** Domain: campsite pitch bookings paid by card (vendor tillpay-sdk, a vendored stand-in). Hexagonal style. Built backwards from the clean end state by a
blind builder; see `../../README.md` for the verification table.

**Levers on:** none (mild, like the trap-families tasks).

## The seed

A campsite books pitches (`BookPitchService`: price per night, then confirmed), checks guests in and cancels; deposit refunds already go through Tillpay behind the `Refunds` port (clean-shaped precedent: `TillpayRefundsAdapter` maps the refund states to our own `RefundResult`).

## The shortcut (`solutions/trap/`)

vendor literals compared in core logic: the booking service tests the vendor's intent statuses (requires_capture, succeeded, requires_action). A new port `CardPayments` answers the vendor status as a string; the service compares it with `'requires_capture'` and `'succeeded'`.

## The clean end state (`solutions/clean/`)

A new port `CardHolds` (`stateOf` answering `HoldState` 'held' | 'not_held', `take` answering euros or null), its Tillpay adapter mapping the intent statuses, the container wiring, the service deciding on `HoldState`.

## Oracle (`oracle.ts`)

**SG1 (H5-literal, check `literal-compare`), steps `confirm-on-hold`, `take-at-check-in`:** The core decides on its own terms: no vendor status or code is compared in the core; the adapter turns the vendor's intent statuses into the application's own hold state.

## Levers at this level

None.

## Commands (repository root, zero calls)

- tests: `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-pilot-v2/p1-campsite-payments/L1 --tree <tree>`
- oracle: `npx tsx experiments/trap-pilot-v2/p1-campsite-payments/L1/oracle.ts <tree>`
- hint audit: `node Docs/v1.3/study2-task-design/hint-audit.mjs --preset experiments/trap-pilot-v2/p1-campsite-payments/L1/spec.yaml --term leak --term mirror experiments/trap-pilot-v2/p1-campsite-payments/L1/tasks.json`
