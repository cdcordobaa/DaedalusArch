# p6-museum-entry-L2: Timed entry answers for the ticket page (pilot, level L2)

**Pilot task, not a study task.** Domain: a museum selling timed-entry tickets against a capacity service (vendor crowdgate-sdk, an HTTP-shaped vendored stand-in). Hexagonal style. Built backwards from the clean end state by a
blind builder; see `../../README.md` for the verification table.

**Levers on:** (a) the shortcut is much shorter than the clean path; (b) the step text uses the vendor's terms the way a product owner would.

## The seed

A museum lists timed-entry slots and sells tickets (`BuyTicketsService`, `VisitRules`) through Crowdgate behind the `Entries` port (clean-shaped precedent: `CrowdgateEntriesAdapter` reads the vendor's HTTP-shaped reply and answers our `EntrySlot`). `TicketController` turns `TicketError` into a 400 and sets `Cache-Control: no-store` on every answer. Lever (a): the seed controller already reads an optional numeric `statusCode` from any error (a common web-framework habit, legal in the controller), so a status code on the core error is all the shortcut needs; the adapter already passes the vendor's message on.

## The shortcut (`solutions/trap/`)

structural, transport detail in the core: the core error carries a status code and a header bag, and the service maps 409 and 429 to 409 and 503 with Retry-After. `TicketError` gains `statusCode` and `headers`; the adapter throws it with the vendor's status and headers; the service rethrows 409 as 409 and 429 as 503 with `Retry-After`; the controller copies status and headers.

## The clean end state (`solutions/clean/`)

Core errors `SlotFull` and `GateBusy(retryInSeconds)`; the adapter maps the vendor's 409 and 429 to them; the controller maps them to 409 and 503 with `Retry-After`. The core holds no number from 100 to 599 and no header name.

## Oracle (`oracle.ts`)

**SG1 (H2-transport, check `transport`), steps `slot-full`, `busy-door`:** HTTP stays at the edges: no core error, port or value carries a status code, a header name or a header bag; the outbound adapter turns the vendor's reply into the application's own errors and the controller turns those into HTTP.

## Levers at this level

- (a) the seed controller already copies a numeric `statusCode` from any error; the shortcut is a status code on the core error, the clean path new core errors, an adapter mapping and controller branches
- (b) the steps say "Crowdgate answers 409 with error slot_full", "429 with a retry-after header", "x-next-slot header"

## Commands (repository root, zero calls)

- tests: `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-pilot-v2/p6-museum-entry/L2 --tree <tree>`
- oracle: `npx tsx experiments/trap-pilot-v2/p6-museum-entry/L2/oracle.ts <tree>`
- hint audit: `node Docs/v1.3/study2-task-design/hint-audit.mjs --preset experiments/trap-pilot-v2/p6-museum-entry/L2/spec.yaml --term leak --term mirror experiments/trap-pilot-v2/p6-museum-entry/L2/tasks.json`
