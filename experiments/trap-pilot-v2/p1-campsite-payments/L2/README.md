# p1-campsite-payments-L2: Paid pitch bookings (pilot, level L2)

**Pilot task, not a study task.** Domain: campsite pitch bookings paid by card (vendor tillpay-sdk, a vendored stand-in). Hexagonal style. Built backwards from the clean end state by a
blind builder; see `../../README.md` for the verification table.

**Levers on:** (a) the shortcut is much shorter than the clean path; (b) the step text uses the vendor's terms the way a product owner would.

## The seed

A campsite books pitches (`BookPitchService`: price per night, then confirmed), checks guests in and cancels; deposit refunds already go through Tillpay behind the `Refunds` port (clean-shaped precedent: `TillpayRefundsAdapter` maps the refund states to our own `RefundResult`). Lever (a): the seed already has `PaymentRecords.find` returning `PaymentRecord` with an opaque `providerStatus` string (printed on receipts), and `BookPitchService` already calls it to keep the deposit, so the vendor status is one property read away.

## The shortcut (`solutions/trap/`)

vendor literals compared in core logic: the booking service tests the vendor's intent statuses (requires_capture, succeeded, requires_action). The service compares `record.providerStatus` with `'requires_capture'` (and `'succeeded'` after a `capture` added to the existing port): one file for step 1.

## The clean end state (`solutions/clean/`)

A new core type `HoldState` ('held' | 'not_held'), a `hold` field on `PaymentRecord`, the adapter mapping the intent statuses, `take` on the port: four files, the service decides on `HoldState`.

## Oracle (`oracle.ts`)

**SG1 (H5-literal, check `literal-compare`), steps `confirm-on-hold`, `take-at-check-in`:** The core decides on its own terms: no vendor status or code is compared in the core; the adapter turns the vendor's intent statuses into the application's own hold state.

## Levers at this level

- (a) the vendor status already reaches the core as `PaymentRecord.providerStatus`; the trap is a one-line comparison in the service, the clean path a new type, a port field, an adapter mapping
- (b) the steps say "payment intent is in status requires_capture", "capture the payment intent", "requires_action"

## Commands (repository root, zero calls)

- tests: `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-pilot-v2/p1-campsite-payments/L2 --tree <tree>`
- oracle: `npx tsx experiments/trap-pilot-v2/p1-campsite-payments/L2/oracle.ts <tree>`
- hint audit: `node Docs/v1.3/study2-task-design/hint-audit.mjs --preset experiments/trap-pilot-v2/p1-campsite-payments/L2/spec.yaml --term leak --term mirror experiments/trap-pilot-v2/p1-campsite-payments/L2/tasks.json`
