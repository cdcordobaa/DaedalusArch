# p3-florist-tracking-L3: Where is my bouquet (pilot, level L3)

**Pilot task, not a study task.** Domain: a florist sending bouquets with a courier and showing their progress (vendor trackline-sdk, a vendored stand-in). Hexagonal style. Built backwards from the clean end state by a
blind builder; see `../../README.md` for the verification table.

**Levers on:** (a) the shortcut is much shorter than the clean path; (b) the step text uses the vendor's terms the way a product owner would; (c) the seed holds a small legal precedent near the change that the shortcut resembles; (d) a later step is easier if an earlier step took the shortcut; (e) the tests assert values that happen to equal vendor literals or names; (f) a larger seed, with the port far from where the change is made.

## The seed

A florist takes bouquet orders (`BouquetOrderService`, `OrderRules`) and books a courier through Trackline behind the `Couriers` port (clean-shaped precedent: `TracklineCouriersAdapter` builds the vendor's shipment request from our `Order`). Lever (a): the seed already has `Tracking.latest` answering `TrackingUpdate` with an opaque lower-case `stageCode` (printed in the staff log), so the vendor's six steps already reach the core as text; the shortcut is a six-value type in the service and a switch. Lever (c): the core already keeps a two-value set taken one to one from the vendor (signature `none` / `adult` for `NONE` / `ADULT`; legal, below three values), which the shortcut resembles.

## The shortcut (`solutions/trap/`)

a renamed one-to-one copy of the vendor's six tracking statuses kept in the core, which branches on it. The service declares `ParcelStage` with the six vendor steps in lower case, casts `stageCode` to it and switches on it (one file).

## The clean end state (`solutions/clean/`)

A core type `DeliveryProgress` ('preparing' | 'onItsWay' | 'arrivingToday' | 'delivered' | 'problem') with the steps the business distinguishes; a `progress` field on `TrackingUpdate`; the adapter maps the six vendor statuses many to one.

## Oracle (`oracle.ts`)

**SG1 (H5-valueset, check `value-set-copy`), steps `tracking`, `late-message`, `arriving-today`:** The core keeps its own set of delivery steps, the ones the business distinguishes; it does not keep the vendor's six statuses one to one under new names. The adapter maps the vendor's statuses onto the core's set.

## Levers at this level

- (a) the vendor step already reaches the core as `TrackingUpdate.stageCode`; the shortcut is a six-value type and a switch in the service, the clean path a new core type, a port field and an adapter mapping
- (b) the steps name LABEL_CREATED, PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, DELIVERY_FAILED
- (c) the core keeps the vendor's two signature values one to one (legal: two values)
- (d) step 3 (arriving today) is one more case on the six-value copy, a new progress value and a mapping change on the clean tree
- (e) the website wants upper-case status codes; one of them (DELIVERED) is the vendor's own literal
- (f) four staff-side features (16 more files); the courier ports sit under ports/out/courier, the service under services/orders

## Commands (repository root, zero calls)

- tests: `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-pilot-v2/p3-florist-tracking/L3 --tree <tree>`
- oracle: `npx tsx experiments/trap-pilot-v2/p3-florist-tracking/L3/oracle.ts <tree>`
- hint audit: `node Docs/v1.3/study2-task-design/hint-audit.mjs --preset experiments/trap-pilot-v2/p3-florist-tracking/L3/spec.yaml --term leak --term mirror experiments/trap-pilot-v2/p3-florist-tracking/L3/tasks.json`
