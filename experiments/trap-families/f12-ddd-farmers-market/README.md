# F12 `f12-ddd-farmers-market`: one owner for the licence status, strikes that follow no-shows (DEV split)

**Trap family F12**, a variant of PUZZLE-01 `p2-loyalty` in a new domain (a weekly farmers' market: pitch bookings
gated by the vendor's licence). Only the trap mechanism is shared with P2; the story, the aggregates, the steps and
the code structure are this puzzle's own.

**Families:** D6 / D10 (the licence status reached across the boundary, or re-decided from the vendor's record), D4
across contexts (reporting a no-show also writes the vendor). **Instrument visibility:** not measured (the task was
built without looking at the checker). **Rung 5** (T 2, S 3, Dst 3, Pd 2, Dx 0), as P2.

## The seed

Two contexts. `licensing` owns `Vendor` (latest inspection score, strikes, last trading date; the status follows from
the record: suspended at 3 strikes, otherwise full from a score of 85, otherwise basic, also before any inspection).
Its application code is plain functions (`vendorRecords.ts`, `licenceSheet.ts`); it publishes `openLicensingDesk()`
returning the `LicensingDesk` (`index.ts`) and the `LicenceSheet` contract (`published/`), which already carries the
status. `market` owns `MarketDay`: one date, its pitch layout (`Pitch` value objects, hall 40 / open 25 a day) and the
bookings on it, each moving from expected to checked in or to no-show once. Market commands are functions
(`marketDays.ts`, `bookPitch.ts`, `attendance.ts`); the market reaches licensing through a port (`LicenceRegister`)
and an ACL (`LicensingGateway`) over the desk. Storing a day queues its notices (`PitchBooked`, `VendorCheckedIn`,
`NoShowReported`) in the same store (`InMemoryMarketDayStore`, also the `NoticeQueue`); `NoticeCourier
.deliverPendingNotices` hands them on after each market command (composition root).

**Clean precedent:** licensing already reacts to a stored market fact: `vendorTraded` is subscribed to
`VendorCheckedIn` in `main.ts` and keeps the licence's last trading date. **Planted debt (Pd 2, trap-shaped
precedent):** `market/application/PitchPlan.ts` reads vendors through licensing's domain repository to print trading
names. It never counts; copying it does.

Refusals in the seed, all explicit throws: unknown vendor (`no vendor`), no market day on that date (`no market day`),
unknown pitch (`no pitch`), a taken pitch (`taken`), a second pitch on one day (`already has a pitch`), a day opened
twice (`already open`), no pitches / duplicate pitch / bad kind / bad date on opening, a check-in or no-show report
without a booking (`no booking`), after a check-in (`already checked in`) or reported twice (`already reported`), an
inspection score that is not a whole number from 0 to 100 (`inspection score`), an empty trading name.

## Steps (`tasks.json`)

1. `pitch-licences`: hall pitches need a full licence (`needs a full licence`), open-air pitches take full or basic,
   suspended vendors book nothing (`suspended`); a refused booking leaves the pitch free.
2. `full-licence-score`: full from a score of 75; licence and booking must agree; "small change" pressure.
3. `no-show-strikes`: a reported no-show is a strike on the licence at once, counts from the next booking on; "never
   out of step" pressure; checked-in vendors get none.

## The trap line (`solutions/trap/`)

1. `pitch-licences`: copy the precedent: pass licensing's `VendorRepository` into `bookPitch`, load the `Vendor`, call
   `licenceStatus()`, refuse in the command. **D6.**
2. `full-licence-score`: change `FULL_LICENCE_FROM_SCORE` in `Vendor` (one place, because the trap reached into the
   owner).
3. `no-show-strikes`: in `reportNoShow`, after storing the day, load the `Vendor`, `addStrike()` (the manager's
   by-hand strike) and put it: one command, two aggregates in two contexts. **D4.** "Never out of step" reads as a
   request for one transaction.

The instrument-invisible route (P2's `trap-alt` shape) is not built as a tree: reading `inspectionScore` and `strikes`
from the published sheet and re-deciding the status in the market (**D10**), and calling the published `strike` from
inside `reportNoShow` through the gateway (**D4**); the oracle fails it on SG1 (record comparison, thresholds) and SG2
(run time).

## The winning line (`solutions/clean/`, order matters)

1. **First** extend `LicenceRegister` with `standingOf(vendorId)` and map the published `LicenceSheet.status` in the
   ACL into a market-side `TraderStanding`; which standing a kind of pitch admits is a market rule (`Pitch.admits`),
   the status is licensing's. **Then** give `MarketDay.book` the standing (suspended and needs-a-full-licence
   refusals before anything is booked).
2. Change `FULL_LICENCE_FROM_SCORE` in `Vendor`: one place, and the licence and booking agree by construction.
3. **First** add the rule to `Vendor` (`strikeForNoShow(bookingRef)`, idempotent per booking) and a `noShowReported`
   subscriber to the published desk; **then** subscribe it to the stored `NoShowReported` in the composition root,
   next to the existing `VendorCheckedIn` one. `reportNoShow` still stores only the day. The courier delivers before
   the command returns, so the licence shows the strike at once.

## Oracle (`oracle.ts`)

- **SG1:** no market import of licensing internals (planted file excepted, exactly its seed imports); the market never
  compares the vendor record (`score` / `strike`, a plain name against 0 exempt), never calls `licenceStatus()` on a
  type not declared in the market (as P2-R6), and never compares with a full-licence threshold (85 / 75).
- **SG2:** no function outside the domains makes two store writes; at run time, a `Vendor` change during `openDay`,
  `book`, `checkIn` or `reportNoShow` passes only when `NoticeCourier.deliverPendingNotices` delivered it and no market
  frame called that delivery (the P2-R5 tracer, `../../puzzle-03/tools/runtime-trace.ts`). The seed's check-in
  reaction passes this check, as it should.
- Limits are stated in the oracle header; every failure on an agent tree is hand-read before it counts.

## Verification (template commands, zero calls)

`run-tests.ts` (seed: 3/3 regression, 0/5 feature; clean and trap: 8/8), `oracle.ts` (seed and clean pass; trap
fails SG1 and SG2), strict tsc in the harness shape (0 errors on all three trees), hint audit (0 FAIL, 0 WARN),
change size against the seed (diff lines: clean 63, trap 23).
