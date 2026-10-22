# HEXDDD-01: hand read against the instrument's scores

**Order of work.** The blind hand read (`hand-read-log.csv`, commit `c18053641`) was written from `diffs/` and the seeds only, before `scores/` was opened. The author then spot-checked two rows: S2 step 1 (`RecordPayment`, a synchronous cross-aggregate save) and S1 step 5 (`withRoomLock` on the port, with the Paystream charge inside the database transaction). The author agreed with both. Only after that were the per-step findings in `scores/` compared against the log. This comparison made zero model calls.

**Method.** For each step, take the step's finding set as (rule, file) pairs, excluding FF-CV05, which the design note treats as noise. Compare it with the previous step's set. A hand-read row counts as **caught** if a finding first appears at that row's step, on that row's file, and its rule bears on the row's family. It counts as **adjacent** if a finding touches the same file but appeared earlier or measures something else. Otherwise the row is **missed**.

## Hand-read rows against the instrument

| Run | Step | Hand-read family and site | Instrument at that step | Reading |
|---|---|---|---|---|
| S1 | 2 | D5: lock in `BookRoomService.ts` | no new finding; FF-C02 and FF-C03 on that file were already in the seed | missed |
| S1 | 3 | D4: `BookingRepository.saveAudited` (port) | FF-SO02 (interface-segregation proxy) on that port, but present **since step 1**, before the change | adjacent, not attributable |
| S1 | 4 | D3: revenue rule in the report service | FF-CV03 on `OccupancyReportService.ts` and `ReportController.ts`: the known "Repo" inside "Report" naming defect (N18) | missed, plus 2 false positives |
| S1 | 5 | H5: `withRoomLock` on the port | FF-SO02 persists; new FF-C03 (instability) on `PostgresBookingRepository.ts` | adjacent at most |
| S1 | 5 | planted debt fixed (`RoomController` now uses the port) | FF-S01 on `RoomController.ts` disappears | **agree** |
| S2 | 1 | D4: `RecordPayment` saves two aggregates synchronously | no finding (S2 has 0 advisory findings at every step) | missed |
| S2 | 2 | D5: rules duplicated in `PlaceOrder` | none | missed |
| S2 | 4 | D5: tax-rate check with no value object | none | missed |
| S2 | 5 | D4: `IssueInvoice` saves two aggregates synchronously | none | missed |
| S2 | 5 | D9: display view in the published contract | none | missed |
| S2 | all | planted debt neither copied nor fixed | FF-DS02 persists from the seed to step 5 | **agree** |

## Totals (dev, n = 2 runs)
- **Caught:** 0 of 9 hand-read violations.
- **Adjacent:** 2, both FF-SO02 or FF-C03 on the same port or adapter, neither attributable to the change.
- **Missed:** 7.
- **Debt status:** the instrument and the hand read agree in both runs (S1 fixed, S2 persisted).
- **False positives:** 2 at step 4, the FF-CV03 naming defect (N18).

**Where the advisory growth in S1 (36 to 52) comes from:**

| Source | Findings |
|---|---|
| FF-CV05 test pairing (noise) | +12 |
| FF-CV03 naming false positives | +2 |
| FF-SO02 on the booking port, step 1 | +1 |
| FF-C03 on the Postgres adapter, step 5 | +1 |

None of this growth tracks a hand-read violation.

## What this means
The agent's errors in this pilot were real, and the author confirmed the two rows checked. They fall entirely outside what the symbolic rules measure: consistency boundaries, rule placement and contract shape. The rules that did fire measure size and coupling (FF-SO02, FF-C03), not those families. These are the target cases for the detection work in DETECT-01 (`ops/notes/explore-01-research-log.md`, entry 4). Each row above becomes a blind-spot card in the case bank (dev split).
