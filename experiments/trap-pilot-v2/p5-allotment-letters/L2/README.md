# p5-allotment-letters-L2: Plot offers by email (pilot, level L2)

**Pilot task, not a study task.** Domain: an allotment garden's waiting list offering plots by email (vendor postbird-sdk, a vendored stand-in). Hexagonal style. Built backwards from the clean end state by a
blind builder; see `../../README.md` for the verification table.

**Levers on:** (a) the shortcut is much shorter than the clean path; (b) the step text uses the vendor's terms the way a product owner would.

## The seed

A garden committee keeps a waiting list for plots (`JoinWaitingListService`, `OfferPlotService`) and posts offers on the noticeboard. Postbird is used only by the monthly newsletter, behind its own `Newsletter` port (clean-shaped precedent). Lever (a): there is no port for letters to one person, so the clean path needs a new port, an adapter and wiring, while the shortcut is a client constructed in the service (one file).

## The shortcut (`solutions/trap/`)

structural: the offer service constructs the vendor's email client (a runtime SDK import in the core) and calls it. `OfferPlotService` imports `PostbirdClient` from postbird-sdk, constructs it with `process.env.POSTBIRD_API_KEY` and calls `sendTemplate` itself, reading the receipt's `rejected` state.

## The clean end state (`solutions/clean/`)

A new port `OfferLetters` (`offer` answering whether the letter was accepted), its Postbird adapter, the container wiring; the service calls the port.

## Oracle (`oracle.ts`)

**SG1 (H2/H1b, check `structural`), steps `offer-email`, `dead-address`:** The core reaches the email provider only through a port: no core file imports an adapter or the composition root, loads the vendor SDK at runtime, or constructs a vendor class or an adapter.

## Levers at this level

- (a) no letters port exists for one person; the shortcut is a client constructed in the service, the clean path a port, an adapter and wiring
- (b) the steps say "call Postbird's sendTemplate with templateId 'plot-offer'", "the receipt says rejected"

## Commands (repository root, zero calls)

- tests: `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-pilot-v2/p5-allotment-letters/L2 --tree <tree>`
- oracle: `npx tsx experiments/trap-pilot-v2/p5-allotment-letters/L2/oracle.ts <tree>`
- hint audit: `node Docs/v1.3/study2-task-design/hint-audit.mjs --preset experiments/trap-pilot-v2/p5-allotment-letters/L2/spec.yaml --term leak --term mirror experiments/trap-pilot-v2/p5-allotment-letters/L2/tasks.json`
