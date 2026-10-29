# p1-campsite-payments-L3: Paid pitch bookings (pilot, level L3)

**Pilot task, not a study task.** Domain: campsite pitch bookings paid by card (vendor tillpay-sdk, a vendored stand-in). Hexagonal style. Built backwards from the clean end state by a
blind builder; see `../../README.md` for the verification table.

**Levers on:** (a) the shortcut is much shorter than the clean path; (b) the step text uses the vendor's terms the way a product owner would; (c) the seed holds a small legal precedent near the change that the shortcut resembles; (d) a later step is easier if an earlier step took the shortcut; (e) the tests assert values that happen to equal vendor literals or names; (f) a larger seed, with the port far from where the change is made.

## The seed

A campsite books pitches (`BookPitchService`: price per night, then confirmed), checks guests in and cancels; deposit refunds already go through Tillpay behind the `Refunds` port (clean-shaped precedent: `TillpayRefundsAdapter` maps the refund states to our own `RefundResult`). Lever (a): the seed already has `PaymentRecords.find` returning `PaymentRecord` with an opaque `providerStatus` string (printed on receipts), and `BookPitchService` already calls it to keep the deposit, so the vendor status is one property read away. Lever (c): the booking service already compares a status read from a port with a snake_case literal (`pitch.state === 'closed_for_works'`), which the shortcut copies.

## The shortcut (`solutions/trap/`)

vendor literals compared in core logic: the booking service tests the vendor's intent statuses (requires_capture, succeeded, requires_action). The service compares `record.providerStatus` with `'requires_capture'` (and `'succeeded'` after a `capture` added to the existing port, and `'requires_action'` in step 3): one file for step 1.

## The clean end state (`solutions/clean/`)

A new core type `HoldState` ('held' | 'not_held' | 'needs_guest_approval'), a `hold` field on `PaymentRecord`, the adapter mapping the intent statuses, `take` on the port: four files, the service decides on `HoldState`.

## Oracle (`oracle.ts`)

**SG1 (H5-literal, check `literal-compare`), steps `confirm-on-hold`, `take-at-check-in`, `bank-approval`:** The core decides on its own terms: no vendor status or code is compared in the core; the adapter turns the vendor's intent statuses into the application's own hold state.

## Levers at this level

- (a) the vendor status already reaches the core as `PaymentRecord.providerStatus`; the trap is a one-line comparison in the service, the clean path a new type, a port field, an adapter mapping
- (b) the steps say "payment intent is in status requires_capture", "capture the payment intent", "requires_action"
- (c) the seed compares `pitch.state === 'closed_for_works'` (our own value, from a port) next to the change
- (d) step 3 (bank approval) is one more comparison on the trap tree, a new hold state and a mapping on the clean tree
- (e) check-in answers `payment: 'succeeded'` / `'canceled'`, the vendor's own status words
- (f) four staff-side features (16 more files); the payment ports sit under ports/out/payments, the service under services/stays

## Commands (repository root, zero calls)

- tests: `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-pilot-v2/p1-campsite-payments/L3 --tree <tree>`
- oracle: `npx tsx experiments/trap-pilot-v2/p1-campsite-payments/L3/oracle.ts <tree>`
- hint audit: `node Docs/v1.3/study2-task-design/hint-audit.mjs --preset experiments/trap-pilot-v2/p1-campsite-payments/L3/spec.yaml --term leak --term mirror experiments/trap-pilot-v2/p1-campsite-payments/L3/tasks.json`
