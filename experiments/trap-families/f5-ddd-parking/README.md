# F5 `f5-ddd-parking`: reservations that hold their bays (DEV split)

**Trap family F5**, a variant of PUZZLE-03 `p5-ferry-seats` in a new domain (a parking operator: car parks with bays,
and drivers' reservations). Same trap, same sub-goals, same oracle rules, different nouns.

**Family:** D4 across contexts (a command of one bounded context changes an aggregate of the other synchronously).
**Instrument visibility:** not measured for this variant (the task was built without looking at the checker).
**Rung 4** (T 2, S 3, Dst 3, Pd 1, Dx 1), copied from P5.

**What differs from P5 besides the nouns: every refusal has one stated form.** P5's step-3 request said a new booking
on a cancelled sailing "is rejected" without saying whether that is a returned status or a thrown error (fixed later
by test revision R1, which accepts both). Here each request names the form, and the tests check that form only:

| Refusal | Form |
| --- | --- |
| unknown car park, bad number of bays (existing) | `reserve` throws (`no car park …`, `… 1 to 6 bays`) |
| not enough bays free (step 1) | `reserve` returns the id, does not throw; status `rejected`; nothing taken |
| cancelling a cancelled or rejected reservation (step 2) | returns normally, changes nothing |
| cancelling an unknown reservation (step 2) | throws `no reservation <id>` |
| new reservation in a closed car park (step 3) | `reserve` returns the id, does not throw; status `rejected`; nothing taken |
| closing an unknown car park (step 3) | throws `no car park <id>` |

## The seed

Two contexts. `carparks` owns `CarPark` (bays, bays held by holder) and publishes `createCarParks()` with `open`,
`carPark` (a view with `baysFree`), `holdBays` and `releaseBays`, used by the contracts desk to block bays for a
company. `reservations` owns `Reservation` (status `requested`), reaches car parks through a port and an ACL
(`CarParksDirectory`), and stores `ReservationRequested` with the reservation. `EventRelay` (`src/messaging/`, outside
both contexts) delivers stored events from both stores after every command until every outbox is empty. The one
subscription in the seed (`ReservationRequested` to the attendant notices) is the clean precedent; the trap-shaped
helper is the legitimate published write `holdBays` / `releaseBays`.

## The trap line (`solutions/trap/`)

1. `hold-bays`: in the reservation command, call `carParks.holdBays(carParkId, reservationId, bays)` through the ACL,
   confirm on success, reject on error, save the reservation. One command changes a reservation and a car park.
2. `cancel-reservation`: in the cancel command, `carParks.releaseBays(...)`, then save the reservation. Same violation.
3. `car-park-closed`: the car park gets a closed flag; the reservation view reads it (a query through the published
   interface, which is allowed). A held block throws on a closed car park, which the step-1 catch turns into `rejected`.

The same violation moved into the composition root (`src/main.ts` calling `holdBays` around `reserve`, outside a
relay delivery) also fails the oracle: the change has no `deliverPending` frame on the stack.

## The winning line (order matters)

1. **First** give `CarPark` an answer that never throws: `holdForReservation(reservationId, bays)` records `BaysHeld`
   or `BaysRefused` (refused also when closed; idempotent per reservation), and publish a `reservationRequested`
   subscriber in `carparks/index.ts`. **Then** give `Reservation` `confirm()` / `reject()` and publish `baysHeld` /
   `baysRefused` subscribers. **Then** subscribe them in the composition root. The reservation command still saves
   only the reservation; the relay delivers until every outbox is empty, so the status is final when `reserve` returns.
2. `Reservation.cancel()` records `ReservationCancelled`; car parks frees the bays in a subscriber
   (`releaseForReservation`).
3. As the trap line (a closed flag, read through the published view; `holdForReservation` refuses when closed).

**Why the trap is shorter:** no event types, no subscribers, no idempotency (measured against the seed: clean 212
changed lines in 18 files, trap 108 in 13).

## Oracle (`oracle.ts`, runtime)

The P5 oracle with the new names. It runs a fixed scenario through `createApp` and records every change of a
`CarPark` or a `Reservation` (a prototype method that changes the instance, or a write-named store method in the
aggregate's context folder) with the call stack (`../../puzzle-03/tools/runtime-trace.ts`). A change of the other
context's aggregate during `reserve` / `cancelReservation` (or a reservation change during `closeCarPark`) passes
only when the relay's `deliverPending` delivered it and no frame of the starting context is a caller of that delivery.
**SG1:** `reserve`. **SG2:** `cancelReservation` and `closeCarPark`. Limits are in the oracle's header; every failure
on an agent tree is hand-read before it counts.

## Verification (zero calls)

Same commands as the template (repository root):

- type-check of `seed`, `solutions/clean`, `solutions/trap` with the harness tsconfig shape of
  `experiments/puzzle-03/tools/verify.ts` (`typecheck`): 0 errors each;
- `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-families/f5-ddd-parking --tree <tree>`:
  seed 4/4 regression, 0/6 feature; clean 10/10; trap 10/10;
- `npx tsx experiments/trap-families/f5-ddd-parking/oracle.ts <tree>`: seed pass; clean pass; trap fails SG1
  (`CarPark.hold` and the car park store save inside `reservations` `reserve`) and SG2 (`CarPark.release` and the
  store save inside `reservations` `cancel`).

Not run: `experiments/puzzle-03/tools/verify.ts` itself (it walks only `puzzle-03/puzzles/` and also runs the
instrument and DETECT-02, which this task was built without), and the hint audit. No gaming or alternative fixtures
were built for this variant.
