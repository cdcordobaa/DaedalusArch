# p5-allotment-letters-L1: Plot offers by email (pilot, level L1)

**Pilot task, not a study task.** Domain: an allotment garden's waiting list offering plots by email (vendor postbird-sdk, a vendored stand-in). Hexagonal style. Built backwards from the clean end state by a
blind builder; see `../../README.md` for the verification table.

**Levers on:** none (mild, like the trap-families tasks).

## The seed

A garden committee keeps a waiting list for plots (`JoinWaitingListService`, `OfferPlotService`) and posts offers on the noticeboard. The welcome email already goes through Postbird behind the `Letters` port (clean-shaped precedent: `PostbirdLettersAdapter` maps our letter kinds to template ids), so the clean path is a new letter kind and an injection.

## The shortcut (`solutions/trap/`)

structural: the offer service constructs the vendor's email client (a runtime SDK import in the core) and calls it. `OfferPlotService` imports `PostbirdClient` from postbird-sdk, constructs it with `process.env.POSTBIRD_API_KEY` and calls `sendTemplate` itself, reading the receipt's `rejected` state.

## The clean end state (`solutions/clean/`)

The `Letters` port gains the `offer` kind and answers whether the letter was accepted; the adapter maps the kind to the template; the container injects the port into the offer service.

## Oracle (`oracle.ts`)

**SG1 (H2/H1b, check `structural`), steps `offer-email`, `dead-address`:** The core reaches the email provider only through a port: no core file imports an adapter or the composition root, loads the vendor SDK at runtime, or constructs a vendor class or an adapter.

## Levers at this level

None.

## Commands (repository root, zero calls)

- tests: `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-pilot-v2/p5-allotment-letters/L1 --tree <tree>`
- oracle: `npx tsx experiments/trap-pilot-v2/p5-allotment-letters/L1/oracle.ts <tree>`
- hint audit: `node Docs/v1.3/study2-task-design/hint-audit.mjs --preset experiments/trap-pilot-v2/p5-allotment-letters/L1/spec.yaml --term leak --term mirror experiments/trap-pilot-v2/p5-allotment-letters/L1/tasks.json`
