# hxb3-observatory-evenings: Stargazing evening answers for the booking page (HX study set, part B)

**Study task (draft, not sealed, not registered).** Domain: a public observatory selling seats for stargazing
evenings under its dome, against an HTTP-shaped seat-booking service (vendor `nightdome-sdk`, a vendored stand-in).
Hexagonal style. Shape: HTTP detail in the core, built at the TRAP-PILOT-v2 p6 **L2** lever set (a, b). Built
backwards from the clean end state by a rule-blind builder; see `../README.md` for the verification table.

## The seed

Visitors list a month's evenings and book seats (`EveningBookingService`, `VisitPolicy`) behind the `SeatPlanner`
port (clean-shaped precedent: `NightdomeSeatPlanner` reads the vendor's HTTP-shaped reply and answers our `Evening`).
`EveningController` turns a refused booking into a 400 and sets `Content-Language: en` on every answer. Lever (a): the
controller already copies an optional numeric `statusCode` from any refusal it catches, so a status code on the core
error is all the shortcut needs.

## The shortcut (`solutions/trap/`)

`BookingRefused` gains `statusCode` and `headers`; the adapter throws it with the vendor's status and headers; the
service rethrows 409 as 409 and 423 as 423 with `Next-Clear-Evening` taken from `x-next-clear-evening`; the controller
copies the header bag.

## The clean end state (`solutions/clean/`)

Core errors `EveningFull` and `SkyClosed(nextClearEvening?)`; the adapter maps the vendor's 409 / `dome_full` and
423 / `clouded_out` to them; the controller maps them to 409 and 423 with `Next-Clear-Evening`. The core holds no
number from 100 to 599 and no header name. Step 3 (adults only after 22:00) is a plain rule in `VisitPolicy`.

## Entry points the tests call

`evenings` and `book` exist on the seed's app; every step text names `book(evening, adults, children)`.

## Commands (repository root, zero calls)

- tests: `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/hx-study-set/part-b/hxb3-observatory-evenings --tree <tree>`
- oracle: `npx tsx experiments/hx-study-set/part-b/hxb3-observatory-evenings/oracle.ts <tree>`
- all checks: `npx tsx experiments/hx-study-set/part-b/verify.ts hxb3`
