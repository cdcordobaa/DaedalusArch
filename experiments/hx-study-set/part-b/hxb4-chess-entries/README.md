# hxb4-chess-entries: Answers for the congress entry form (HX study set, part B)

**Study task (draft, not sealed, not registered).** Domain: a weekend chess congress taking entries for its open and
amateur sections, checking each player's rating against an HTTP-shaped rating service (vendor `ratingsdesk-sdk`, a
vendored stand-in). Hexagonal style. Shape: HTTP detail in the core, built at the TRAP-PILOT-v2 p6 **L2** lever set
(a, b). Built backwards from the clean end state by a rule-blind builder; see `../README.md` for the verification
table.

## The seed

Players enter a section (`EntryService`, `SectionRules`); their rating comes through the `RatingLookup` port
(clean-shaped precedent: `RatingsdeskLookup` reads the vendor's HTTP result and answers our `PlayerRecord`). The
inbound side is a small router (`router.ts`) with a shared reply helper (`replies.ts`) that turns a refused entry into
a 422 with `Content-Type: application/json`. Lever (a): the reply helper already copies an optional numeric
`statusCode` from any refused entry, so a status code on the core error is all the shortcut needs.

## The shortcut (`solutions/trap/`)

`EntryError` gains `statusCode` and `headers`; the adapter throws it with the vendor's status and headers; the service
rethrows 404 as 404 and 429 as 503 with `Retry-After` taken from `x-ratelimit-reset`; the reply helper copies the
header bag.

## The clean end state (`solutions/clean/`)

Core errors `PlayerUnknown` and `RatingsBusy(retryInSeconds)`; the adapter maps the vendor's 404 / `unknown_player`
and 429 (with the 20-second default) to them; the reply helper maps them to 404 and 503 with `Retry-After`. The core
holds no number from 100 to 599 and no header name. Step 3 (64 players a section) is a plain rule in `SectionRules`.

## Entry points the tests call

`enterPlayer` and `roster` exist on the seed's app; every step text names `enterPlayer(federationId, section)`.

## Commands (repository root, zero calls)

- tests: `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/hx-study-set/part-b/hxb4-chess-entries --tree <tree>`
- oracle: `npx tsx experiments/hx-study-set/part-b/hxb4-chess-entries/oracle.ts <tree>`
- all checks: `npx tsx experiments/hx-study-set/part-b/verify.ts hxb4`
