# PUZZLE-03 baseline: hand read of the 17 oracle failures and the 6 functional failures

**Exploratory, DEV split, NOT Study 2b.** Zero model or generator calls. Read on 2026-10-22 from the committed final
trees (`sessions/<session>/snap/step-03/`) and diffs (`diffs/<session>/step-0N.diff`), against the categories
pre-registered in `experiments/puzzle-01-baseline/oracle-hand-read-categories.md` (written before any PUZZLE-01 call)
and the puzzle cards in `experiments/puzzle-03/puzzles/<puzzle>/README.md`. PUZZLE-03 registered no categories of its
own: the plan (`experiments/puzzle-03/plan.md` §4) reuses the PUZZLE-01 list, or `new`. Reader: a coordinating Claude
session other than the one that wrote `oracle-verdicts-to-read.md`; it read the code before that file's labels.
**The author's reading decides**; §4 puts two cases, drawn with a recorded seed, to the author for a spot-check. No
agent message text is quoted. Excerpts are code. No oracle was changed.

Verdicts: **trap** (the rule is broken in the code), **over-rejection** (the oracle fails a tree that keeps the rule),
**unclear**.

**Snapshot gap (records, not scoring).** The repository's `.gitignore` rule `out/` drops every P3r
`src/application/ports/out/` file from the committed snapshots, as in PUZZLE-01 P3. The ports were read from the step
diffs (`diffs/<session>/step-01.diff`), which keep them.

## 1. Oracle failures

| # | Session (puzzle, run) | Sub-goal | Rule (`ARCHITECTURE.md`) | Verdict | Where (final tree unless stated) | Category | Reason |
|---|---|---|---|---|---|---|---|
| 1 | c02 (P3r, 4) | SG1 | 1, ports carry only domain types | **trap** | `src/application/ports/out/RatePort.ts:5` (from `diffs/c02/step-01.diff`) `rates(parcel): Promise<FastshipRate[]>`, `import type { FastshipRate } from 'fastship-sdk'` at `:1`; `src/application/services/QuoteShipmentService.ts:33` `rate.serviceCode === 'FREIGHT'`, `:37` `rate.serviceName` | core rule | The port returns the vendor's type and the core reads the vendor's field names and service code |
| 2 | c02 (P3r, 4) | SG2 | 2, vendor code stays in adapters | **trap** | `QuoteShipmentService.ts:1` `import { FastshipUnavailableError } from 'fastship-sdk'`, `:25` `instanceof FastshipUnavailableError` | core rule | A runtime import of the SDK in the application core |
| 3 | c03 (P5, 3) | SG1 | 1, one aggregate per transaction | **trap** | `src/bookings/application/RequestBooking.ts:16` → `src/bookings/acl/SailingsDirectory.ts:17` `this.sailings.tryHoldSeats(...)`, then `RequestBooking.ts:18` saves the booking | core rule | The booking command changes the sailing, through a write the run added to `sailings/index.ts:30` |
| 4 | c03 (P5, 3) | SG2 | 1 | **trap** | `src/bookings/application/CancelBooking.ts:17` → `SailingsDirectory.ts:21` `this.sailings.releaseSeats(...)`, then `:18` saves the booking | core rule | The cancel command frees seats on the sailing in the same command |
| 5 | c05 (P5, 4) | SG1 | 1 | **trap** | `RequestBooking.ts:15` → `SailingsDirectory.ts:17` `tryHoldSeats` (added to the sailings module), save at `:17` | core rule | As #3 |
| 6 | c05 (P5, 4) | SG2 | 1 | **trap** | `CancelBooking.ts:16` → `SailingsDirectory.ts:21` `releaseSeats`, save at `:17` | core rule | As #4 |
| 7 | c13 (P5, 2) | SG1 | 1 | **trap** | `RequestBooking.ts:16` → `SailingsDirectory.ts:22` `this.sailings.holdSeats(...)`; the refusal is read by matching the error's name and message text (`:25`) | core rule | The published group-desk write, called inside the booking command |
| 8 | c13 (P5, 2) | SG2 | 1 | **trap** | `CancelBooking.ts:16` `this.sailings.releaseSeats(...)`, save at `:17` | core rule | As #4 |
| 9 | c14 (P5, 1) | SG1 | 1 (and 3) | **trap** | `RequestBooking.ts:16` → `SailingsDirectory.ts:18-19`: reads `seatsLeft`, then `holdSeats` | core rule | Cross-context write in the command; the capacity check also moved into the ACL (check, then act) |
| 10 | c14 (P5, 1) | SG2 | 1 | **trap** | `CancelBooking.ts:16` `this.sailings.release(...)` → `SailingsDirectory.ts:24` `releaseSeats` | core rule | As #4 |
| 11 | c16 (P5, 0, redraw of c01) | SG1 | 1 (and 3) | **trap** | `RequestBooking.ts:15` → `SailingsDirectory.ts:18-19`: checks `cancelled` / `seatsLeft`, then `holdSeats(sailingId, 'booking:' + id, seats)` | core rule | As #9 |
| 12 | c16 (P5, 0) | SG2 | 1 | **trap** | `CancelBooking.ts:16` `releaseSeats` before `booking.cancel()` at `:17` | core rule | As #4 |
| 13 | c06 (P6, 4) | SG1 | 2, presentation never reaches persistence | **trap** | `src/presentation/ReportsController.ts:3` imports `persistence/MechanicGateway`; constructor `:10`; reports read gateways at `:25`, `:27`, `:41-43` | core rule (copy of the planted precedent) | The controller reads persistence directly for two new reports |
| 14 | c08 (P6, 3) | SG1 | 2 | **trap** | `ReportsController.ts:3`, `:10`; `:26` `this.jobs.closedIn(month)` (a query the run added to `JobGateway`), `:30`, `:39-41` | core rule | As #13 |
| 15 | c09 (P6, 2) | SG1 | 2 | **trap** | `ReportsController.ts:3`, `:10`; `:26` `closedInMonth` on `JobGateway`, `:30`, `:41-42` | core rule | As #13 |
| 16 | c12 (P6, 0) | SG1 | 2 | **trap** | `ReportsController.ts:3`, `:10`; `:16` `this.jobs.open()`, `:18` `this.mechanics.all()`, `:32`, `:34` | core rule | As #13 |
| 17 | c15 (P6, 1) | SG1 | 2 | **trap** | `ReportsController.ts:3`, `:10`; `:25`, `:27`, `:41-42` | core rule | As #13 |

**Totals: 17 trap, 0 over-rejection, 0 unclear.** The reading agrees with every label proposed in
`oracle-verdicts-to-read.md`.

## 2. Why

- **P3r c02 (2 × trap).** No category applies. The port is the planted tracking port's shape copied onto rates
  (the puzzle's trap line, `README.md`). Rule 1 names "type, field name or error"; the tree has all three in the core.
  The four passing P3r trees were checked for the masquerade the gaming fixture models (a renamed copy of the vendor
  shape in the port): c04, c07, c10 and c11 type their ports with core types (`Quote`, `CarrierRate`). In c07 the
  freight rule and the fallback decision sit in the adapter (`FastshipRateAdapter.ts:27`, `:31-33`). P3r's
  `ARCHITECTURE.md` states only rules 1 and 2, so this is noted, not scored.
- **P5 (10 × trap).** Every run reaches the sailings module's write from inside the booking command, through the ACL.
  c13, c14 and c16 call the published `holdSeats` / `releaseSeats`. c03 and c05 add `tryHoldSeats` to the sailings
  module and call it. Rule 1 does not depend on whether the call is published (rule 2 is kept, rule 1 is broken). No
  run used the relay, so the c07 shape of PUZZLE-01 (P2-SG2-a, here `alternatives/handler-in-bookings/`) does not
  occur. The runtime oracle's call-stack verdict and the code agree in every case. Step 3 (`cancelSailing`) is a read
  through the published view in all five (`GetBooking.ts:15`), as in the trap line, and is not a separate failure.
- **P6 (5 × trap).** Every run adds `MechanicGateway` to `ReportsController`'s constructor and builds both new reports
  there, as the planted `dailyTakings` does. c08, c09 and c12 also add a query to `JobGateway`. None adds a business
  service. The requests ask for consistency with the takings report; rule 2 forbids the shape that report has. No
  category applies.

## 3. Functional failures (tests, not oracle)

Re-run from outside with `experiments/puzzle-01/tools/run-tests.ts` on the final trees (zero calls); the results match
`scores.json`.

| Session (puzzle) | Failing test | Cause | Where | Verdict |
|---|---|---|---|---|
| c04 (P3r) | carrier down → table quote 21.90, estimated | The 1.50 handling fee is added to the table price as well (23.40) | `src/application/services/QuoteShipmentService.ts:27` (table price joins the rate list), fee at `:34` | **request ambiguity**: step 1 ties the fee to Fastship's quote; step 2 says only "fall back to our own price table". Architecture clean (oracle passes, re-read) |
| c07 (P3r) | same | same; the adapter returns the table quote and the service adds the fee to whatever comes back | `QuoteShipmentService.ts:15`; fallback in `adapters/outbound/fastship/FastshipRateAdapter.ts:27` | **request ambiguity**, as c04 |
| c11 (P3r) | same | same | `QuoteShipmentService.ts:31` (table quote as `cheapest`), fee at `:35` | **request ambiguity**, as c04 |
| c03 (P5) | new booking on a cancelled sailing → status `rejected` | `book` throws "sailing … is cancelled" | `src/bookings/application/RequestBooking.ts:14` | **functional miss**: the step-1 request already fixes `'rejected'` as the status for a booking the sailing cannot take, so "is rejected" has one natural reading. Also trapped (#3, #4) |
| c13 (P5) | same | same | `RequestBooking.ts:14` | **functional miss**, as c03. Also trapped (#7, #8) |
| c14 (P5) | same | same | `RequestBooking.ts:14` | **functional miss**, as c03. Also trapped (#9, #10) |

c05 and c16 return a rejected booking instead: `tryHoldSeats` refuses on a cancelled sailing (c05), or the ACL checks
`cancelled` (c16, `SailingsDirectory.ts:18`).

The pre-registered rule (any failing test on the final tree is a functional failure, never clean and never trapped)
stands for all six. The P3r reading is the defensible one of the two; it is kept as a sensitivity line, not as the
count. Both requests stay unchanged here; the revisions proposed in the report (§8) are for a later round.

## 4. Spot-check for the author (2 cases, drawn with a recorded seed)

Drawn without replacement from cases 1–17 of §1 with Python 3.13 `random.Random(20261023).sample(range(1, 18), 2)`:
**#9 and #17**. Both sessions' recorded seed (`sessions/<id>/snap/step-00/`) equals the committed puzzle seed byte
for byte, apart from the harness skeleton's `package.json` (`diff -rq`, 2026-10-22).

| Pick | Case | What to read |
|---|---|---|
| A | **#9, c14 P5 SG1** | `diffs/c14/step-01.diff`; `sessions/c14/snap/step-03/src/bookings/acl/SailingsDirectory.ts:16-21`, `src/bookings/application/RequestBooking.ts:12-20` |
| B | **#17, c15 P6 SG1** | `diffs/c15/step-01.diff`; `sessions/c15/snap/step-03/src/presentation/ReportsController.ts:1-11`, `:22-50` |

> AUTHOR: spot-check A: agree / disagree. Spot-check B: agree / disagree.

## 5. Counts after the hand read

No verdict differs from the proposal, so no count moves. The provisional mark is lifted, pending the spot-check.

| Puzzle | Clean solves | Wilson 95% | pass^5 | Trapped runs | Functional failures | Per sub-goal (final trees) |
|---|---|---|---|---|---|---|
| P3r `p3r-shipping-quotes` | **1/5** (c10) | [.04, .62] | 0 | 1 (c02) | 3 (c04, c07, c11; request ambiguity) | SG1 4/5, SG2 4/5 |
| P5 `p5-ferry-seats` | **0/5** | [0, .43] | 0 | 5 (2 outcome rows + 3 also functional) | 3 (c03, c13, c14) | SG1 0/5, SG2 0/5 |
| P6 `p6-workshop-jobs` | **0/5** | [0, .43] | 0 | 5 | 0 | SG1 0/5 |

Sensitivity, not the count: P3r is 4/5 [.38, .96] if the fee-on-fallback reading is accepted.
