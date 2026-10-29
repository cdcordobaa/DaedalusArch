# p3-florist-tracking-L1: Where is my bouquet (pilot, level L1)

**Pilot task, not a study task.** Domain: a florist sending bouquets with a courier and showing their progress (vendor trackline-sdk, a vendored stand-in). Hexagonal style. Built backwards from the clean end state by a
blind builder; see `../../README.md` for the verification table.

**Levers on:** none (mild, like the trap-families tasks).

## The seed

A florist takes bouquet orders (`BouquetOrderService`, `OrderRules`) and books a courier through Trackline behind the `Couriers` port (clean-shaped precedent: `TracklineCouriersAdapter` builds the vendor's shipment request from our `Order`).

## The shortcut (`solutions/trap/`)

a renamed one-to-one copy of the vendor's six tracking statuses kept in the core, which branches on it. A core type `ParcelStage` (`labelCreated`, `pickedUp`, `inTransit`, `outForDelivery`, `delivered`, `deliveryFailed`), a `Tracking.stageOf` port, an adapter mapping the six statuses one to one; the service switches on the six.

## The clean end state (`solutions/clean/`)

A core type `DeliveryProgress` ('preparing' | 'onItsWay' | 'delivered' | 'problem') with the steps the business distinguishes; a `Tracking.progressOf` port; the adapter maps the six vendor statuses many to one.

## Oracle (`oracle.ts`)

**SG1 (H5-valueset, check `value-set-copy`), steps `tracking`, `late-message`:** The core keeps its own set of delivery steps, the ones the business distinguishes; it does not keep the vendor's six statuses one to one under new names. The adapter maps the vendor's statuses onto the core's set.

## Levers at this level

None.

## Commands (repository root, zero calls)

- tests: `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-pilot-v2/p3-florist-tracking/L1 --tree <tree>`
- oracle: `npx tsx experiments/trap-pilot-v2/p3-florist-tracking/L1/oracle.ts <tree>`
- hint audit: `node Docs/v1.3/study2-task-design/hint-audit.mjs --preset experiments/trap-pilot-v2/p3-florist-tracking/L1/spec.yaml --term leak --term mirror experiments/trap-pilot-v2/p3-florist-tracking/L1/tasks.json`
