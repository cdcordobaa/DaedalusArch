# hxa1-chimney-sweeps: Sweeping plans paid by direct debit (HX study set, part A)

Domain: chimney sweeping plans for households, paid by direct debit (vendor `debitora-sdk`, a vendored stand-in). Hexagonal style. Shape: vendor-literals, at the
lever set of the pilot variant `experiments/trap-pilot-v2/p1-campsite-payments/L2` (L2: levers a and b). Built backwards from
the clean end state by a rule-blind session; see `../README.md` for the verification table.

**Levers on:** (a) the shortcut is much shorter than the clean path; (b) the step text uses the vendor's terms the way a product owner would.

## The seed

A chimney sweep sells yearly sweeping plans (`PlanService`: a fee per sweep from the number of flues, then running), records sweeps and stops plans; the charge page already reads Debitora payments behind the `Charges` port (clean-shaped precedent: `DebitoraChargesAdapter` maps the payment statuses to our own `ChargeOutcome`). Lever (a): `Mandates.find` answers `MandateRecord` with an opaque `providerStatus` string (printed on the plan letter), and `PlanService.start` already calls it to keep the bank reference, so the mandate status is one property read away.

## The shortcut (`solutions/trap/`)

vendor literals compared in core logic: the plan service tests the direct debit provider's mandate and payment statuses (mandate_active, collection_failed). The service compares `mandate.providerStatus` with `'mandate_active'`, and the payment status answered by a `charge` added to the existing `Mandates` port with `'collection_failed'`: two lines in the service, a method on one port and its adapter, no wiring change.

## The clean end state (`solutions/clean/`)

A new core type `MandateStanding` ('usable' | 'not_usable'), a `standing` field on `MandateRecord` set by the mandates adapter, a `collect` on the `Charges` port answering the existing `ChargeOutcome` (the adapter maps the payment status), and the charges adapter wired into the service: the service decides on `standing` and on `outcome === 'bounced'`.

## Oracle (`oracle.ts`)

**SG1 (H5-literal, check `literal-compare`), steps `start-on-active-mandate`, `charge-per-sweep`:** The core decides on its own terms: no vendor status is compared in the core; the adapter turns the provider's mandate and payment statuses into the application's own standing and charge outcome.

## Levers

- (a) the mandate status already reaches the core as `MandateRecord.providerStatus` (printed on the plan letter), and `PlanService.start` already calls `Mandates.find`; the shortcut is one comparison in the service (and a `charge` on the same port answering the raw payment status), the clean path a new `MandateStanding` type, a field on the record, an adapter mapping, and a `collect` on the `Charges` port answering the existing `ChargeOutcome`
- (b) the steps say "mandate is in status mandate_active", the six other mandate statuses, "status pending_submission or submitted" and "status collection_failed"

## Entry points named in the step texts

Every step names the method of the object `createApp()` returns that the behaviour tests call, so a functional
failure measures the work and not a guess at the test surface:

- `start-on-active-mandate`: `app.start(planId, address, flues, sweepsPerYear, mandateId)`
- `charge-per-sweep`: `app.recordSweep(planId, date)`
- `sweeps-per-year`: `app.recordSweep(planId, date)`

## Commands (repository root, zero calls)

- tests: `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/hx-study-set/part-a/hxa1-chimney-sweeps --tree <tree>`
- oracle: `npx tsx experiments/hx-study-set/part-a/hxa1-chimney-sweeps/oracle.ts <tree>`
- hint audit: `node Docs/v1.3/study2-task-design/hint-audit.mjs --preset experiments/hx-study-set/part-a/hxa1-chimney-sweeps/spec.yaml --term leak --term mirror --term shortcut experiments/hx-study-set/part-a/hxa1-chimney-sweeps/tasks.json`
