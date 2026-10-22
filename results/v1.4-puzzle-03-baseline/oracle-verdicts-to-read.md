# PUZZLE-03 baseline: oracle verdicts to hand-read

Every oracle FAIL on an agent final tree: 17 sub-goal failures in 11 sessions. The code around each cited line is in
`oracle-verdict-excerpts.md`, and the full diffs are in `diffs/<session>/`. Labels are the coordinator's proposal, from
a reading of the final trees; **the author's reading decides**, and counts that touch these cases are provisional until
then. Categories are those of `experiments/puzzle-01-baseline/oracle-hand-read-categories.md` where one applies, or
`new`. No agent message text is quoted.

PASSes were read for unforeseen traps too. **P3r** c04, c07, c10 and c11: the port is typed with the core's own types
(c10 `RatePort.cheapest(parcel): Promise<CarrierRate | undefined>`), and the only mention of the vendor in the core is
the brand name in comments and error messages. None looks like a masquerade, so **0 PASS cases** are listed.

| # | Session (run) | Puzzle | Sub-goal | Where | Category | Proposed label |
|---|---|---|---|---|---|---|
| 1 | c02 (4) | P3r | SG1 | `src/application/ports/out/RatePort.ts:5` `rates(parcel): Promise<FastshipRate[]>`; the service filters on `rate.serviceCode === 'FREIGHT'` (`QuoteShipmentService.ts:33`) | core rule | trap |
| 2 | c02 (4) | P3r | SG2 | `src/application/services/QuoteShipmentService.ts:1` runtime import of the SDK, `instanceof FastshipUnavailableError` at `:25` | core rule | trap |
| 3 | c03 (3) | P5 | SG1 | `book` → `src/bookings/acl/SailingsDirectory.ts:17` `this.sailings.tryHoldSeats(...)`, a write the run added to the sailings module, called inside the booking command | core rule | trap |
| 4 | c03 (3) | P5 | SG2 | `cancelBooking` → `SailingsDirectory.ts:21` `this.sailings.releaseSeats(...)` inside the cancel command | core rule | trap |
| 5 | c05 (4) | P5 | SG1 | `book` → `SailingsDirectory.ts:17` `tryHoldSeats` (added to the sailings module), inside the command | core rule | trap |
| 6 | c05 (4) | P5 | SG2 | `cancelBooking` → `SailingsDirectory.ts:21` `releaseSeats` | core rule | trap |
| 7 | c13 (2) | P5 | SG1 | `book` → `SailingsDirectory.ts:22` `this.sailings.holdSeats(...)` | core rule | trap |
| 8 | c13 (2) | P5 | SG2 | `src/bookings/application/CancelBooking.ts:16` `this.sailings.releaseSeats(...)` | core rule | trap |
| 9 | c14 (1) | P5 | SG1 | `book` → `SailingsDirectory.ts:19` `holdSeats` | core rule | trap |
| 10 | c14 (1) | P5 | SG2 | `CancelBooking.ts:16` `this.sailings.release(...)` → `SailingsDirectory.ts:24` `releaseSeats` | core rule | trap |
| 11 | c16 (0, redraw of c01) | P5 | SG1 | `book` → `SailingsDirectory.ts:19` `holdSeats(sailingId, 'booking:' + id, seats)` | core rule | trap |
| 12 | c16 (0) | P5 | SG2 | `CancelBooking.ts:16` `releaseSeats` | core rule | trap |
| 13 | c06 (4) | P6 | SG1 | `src/presentation/ReportsController.ts:3` imports `persistence/MechanicGateway`; the reports read both gateways in the controller (`:25`, `:27`) | core rule (copy of the planted precedent) | trap |
| 14 | c08 (3) | P6 | SG1 | `ReportsController.ts:3`, `:26` `closedIn` on `JobGateway` | core rule | trap |
| 15 | c09 (2) | P6 | SG1 | `ReportsController.ts:3`, `:26` `closedInMonth` on `JobGateway` | core rule | trap |
| 16 | c12 (0) | P6 | SG1 | `ReportsController.ts:3`, `:16` `this.jobs.open()`, `:18` `this.mechanics.all()` | core rule | trap |
| 17 | c15 (1) | P6 | SG1 | `ReportsController.ts:3`, `:25`, `:27` | core rule | trap |

**Proposed: 17 trap, 0 over-rejection, 0 unclear.**

- **P5.** Every run calls the sailings module's write from inside the booking command: the published
  `holdSeats` / `releaseSeats`, or a `tryHoldSeats` the run added to the sailings module (c03, c05). None used the
  relay, so no case is near the c07 shape of PUZZLE-01 (P2-SG2-a).
- **P6.** Every run added `MechanicGateway` to `ReportsController`'s constructor and built both reports there, as the
  planted takings report does. No run added a business-layer service.

## Functional failures (tests, not oracle)

These are counted under the pre-registered rule (any failing test on the final tree is a functional failure, never
clean and never trapped). Both shapes look like **readings of an under-specified request**, not broken code. They go to
the author too:

| Session | Puzzle | Failing test | What the tree does | Oracle |
|---|---|---|---|---|
| c04, c07, c11 | P3r | carrier down → table quote 21.90, estimated | adds the 1.50 handling fee to the table price as well (23.40). The step-1 request ties the fee to the carrier's quote; step 2 says only "fall back to our own price table" | all pass |
| c03, c13, c14 | P5 | new booking on a cancelled sailing → status `rejected` | `book` throws "sailing … is cancelled" instead of returning a rejected booking | all fail (trapped as well) |

The P3r test and request are PUZZLE-01's, unchanged. The P5 request says "any new booking on it is rejected". These
are candidate puzzle revisions for a later round; none is made here.
