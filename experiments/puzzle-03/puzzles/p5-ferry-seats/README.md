# P5 `p5-ferry-seats`: bookings that hold their seats (DEV split)

**Family:** D4 across contexts (a command of one bounded context changes an aggregate of the other synchronously).
**Instrument visibility:** invisible to the frozen instrument; DETECT-02 `check_consistency` (exploratory) flags the
trap tree (R-D4+R-XCTX) and misses the gaming fixture. **Rung 4** (T 2, S 3, Dst 3, Pd 1, Dx 1).

**How it differs from P2.** P2 is one-way and fire-and-forget (an order earns points). Here the first context needs
the second context's **answer** before its own state is final (a booking is confirmed or rejected by the sailing),
and the request says the passenger must know at once. The clean line is a two-way exchange of events (request, then
held or refused), not a single subscription. The relay lives outside both contexts (`src/messaging/`), and the
precedent in the seed is clean (an existing subscription to `BookingRequested`); the trap-shaped helper is a
legitimate published write of the other context (the group desk's `holdSeats` / `releaseSeats`).

## The seed

Two contexts. `sailings` owns `Sailing` (capacity, seats held by holder) and publishes `createSailings()` with
`schedule`, `sailing` (a view with `seatsLeft`), `holdSeats` and `releaseSeats`, used by the group desk.
`bookings` owns `Booking` (status `requested`), reaches sailings through a port and an ACL, and stores
`BookingRequested` with the booking. `EventRelay` delivers stored events from both stores after every command.

## The trap line (`solutions/trap/`)

1. `hold-seats`: in the booking command, call `sailings.holdSeats(sailingId, bookingId, seats)` through the ACL,
   confirm on success, reject on error, save the booking. One command changes a booking and a sailing.
2. `cancel-booking`: in the cancel command, `sailings.releaseSeats(...)`, then save the booking. Same violation.
3. `sailing-cancelled`: the sailing gets a cancelled flag; the booking view reads it (a query through the published
   interface, which is allowed).

## The winning line (order matters)

1. **First** give `Sailing` an answer that never throws: `holdForBooking(bookingId, seats)` records `SeatsHeld` or
   `SeatsRefused` (idempotent per booking), and publish a `bookingRequested` subscriber in `sailings/index.ts`.
   **Then** give `Booking` `confirm()` / `reject()` and publish `seatsHeld` / `seatsRefused` subscribers. **Then**
   subscribe them in the composition root. The booking command still saves only the booking; the relay delivers
   until every outbox is empty, so the status is final when `book` returns.
2. `Booking.cancel()` records `BookingCancelled`; sailings frees the seats in a subscriber (`releaseForBooking`).
3. As the trap line (a cancelled flag, read through the published view).

## Oracle (`oracle.ts`, runtime)

It runs a fixed scenario through `createApp` and records every change of a `Sailing` or a `Booking` (a prototype
method that changes the instance, or a write-named store method in the aggregate's context) with the call stack
(`../../tools/runtime-trace.ts`). A change of the other context's aggregate during `book` / `cancelBooking` (or a
booking change during `cancelSailing`) passes only when the relay's `deliverPending` delivered it and no frame of the
starting context is a caller of that delivery. **SG1:** `book`. **SG2:** `cancelBooking` and `cancelSailing`. Method
names do not matter, so a renamed write, a "batch" store call and a fake event handled inside the command are seen.

## Fixtures beyond clean and trap

- **Gaming (`gaming/sync-event-handler/`):** the booking command builds `BookingRequested` / `BookingCancelled` and
  hands it to an `InstantPublisher` whose subscribers (the sailings handlers) run at once, inside the command. It
  looks event-driven and passes the tests; the oracle fails both sub-goals; DETECT-02 and the frozen instrument miss it.
- **Gaming (`gaming/batch-unit-of-work/`):** the trap line with the sailing's seat change and the booking save
  committed as one batch through a `UnitOfWork`. Tests pass; the oracle fails both sub-goals.
- **Alternative (`alternatives/handler-in-bookings/`):** the clean line with the seat request sent by a handler that
  lives in the bookings folder, delivered by the relay: the shape PUZZLE-01's P2 text oracle over-rejected (case 12,
  c07). The oracle passes it.
