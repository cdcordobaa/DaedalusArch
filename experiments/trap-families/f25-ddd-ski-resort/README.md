# f25 `f25-ddd-ski-resort`: ski lessons paid from the pass (DEV split, trap family of P5)

**Variant of:** PUZZLE-03 `p5-ferry-seats` (the trap mechanism only; story, code and layout are new).
**Family:** D4 across contexts (a command of one bounded context changes an aggregate of the other synchronously).
**Rung:** 4 by analogy with P5 (estimated, not rated). Frozen instrument and DETECT-02 not run on this tree.

## The seed

Two contexts. `passes` owns `SkiPass` (holder, credit in whole euros) and publishes `openPassOffice()` with `issue`,
`load` (ticket office), `pay` (mountain kiosks) and `pass`. `school` owns `Lesson` (day, price, places, a place per
pass) and publishes `openSchool()` with `offer`, `enrol`, `withdraw` (the desk), `lesson`, `placeOf`, `pupils`, plus
`schoolReactions()`. Aggregate methods return the events they caused; a store's `put` writes the aggregate and those
events into its append-only journal. The `Mailroom` (`src/wiring/mailroom.ts`) reads every journal from a cursor after
each call (`drain`) and hands events to the reaction maps the contexts publish. **Precedent (clean):** the school
already reacts to `PassIssued` (it notes the holder's name on its own pupil cards), so enrol never asks the pass office.

## The trap line (`solutions/trap/`)

1. `pay-from-credit`: the enrol function calls the pass office's `pay` through a `Wallet` port, declines on error.
2. `weather-call-off`: the call-off function calls `load` on each paying pass.
3. `lost-pass`: the composition root blocks the pass, calls the school to release the places, loads the refund.
Each step is short, passes every test, and changes the other context's aggregate inside the call.

## The winning line (`solutions/clean/`)

1. **First** give `SkiPass` an answer that never throws, `payForLesson` (records `LessonPaid` or
   `LessonPaymentRefused`, once per lesson, refuses a blocked pass), and publish `passReactions()` (`PlaceReserved`).
   `Lesson.enrol` now reserves (`awaiting`) and records `PlaceReserved`; `Lesson.settle` turns the answer into `paid` or
   `declined`. The mailroom drains until every journal is read, so the status is final when `enrol` returns.
2. `Lesson.callOff` records `LessonCalledOff` with the refunds owed; passes refunds each once (`refundLesson`).
3. `SkiPass.block` records `PassBlocked`; the school gives up the places (`giveBack`, `PlaceGivenBack` with the euros
   owed) and passes puts the price back. Three hops, all delivered by the mailroom.

## Oracle (`oracle.ts`, runtime)

It runs a fixed scenario through `createApp` and records every change of a `SkiPass` or a `Lesson` (a prototype
method that changes the instance, or a write-named method such as `put` of a store class in the context folder),
with the call stack (`experiments/puzzle-03/tools/runtime-trace.ts`). A change of the other context's aggregate
during `enrol` / `callOff` (initiator school) or `reportLost` (initiator passes) passes only when `Mailroom.drain`
delivered it and no frame of the initiating context is a caller of that drain. **SG1** `enrol`, **SG2** `callOff`,
**SG3** `reportLost`. Stated limits are in the oracle's header (scenario paths only; a delivery started from
`src/wiring/` on a command's behalf, or a mailroom that delivers before the command stores, is not separated;
moving the mailroom or renaming `drain` fails and must be hand-read).

## Verification (zero calls)

```
npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-families/f25-ddd-ski-resort --tree experiments/trap-families/f25-ddd-ski-resort/<tree>
npx tsx experiments/trap-families/f25-ddd-ski-resort/oracle.ts experiments/trap-families/f25-ddd-ski-resort/<tree>
```

| Tree | Regression | Feature | Oracle | tsc |
|---|---|---|---|---|
| seed | 4/4 | 0/7 | pass (SG1-SG3) | 0 |
| solutions/clean | 4/4 | 7/7 | pass (SG1-SG3) | 0 |
| solutions/trap | 4/4 | 7/7 | fails SG1, SG2, SG3 | 0 |

Change size against the seed (changed lines, `diff -r`): clean 197, trap 101. Hint audit of `tasks.json` with
`spec.yaml`: 0 FAIL, 0 WARN. No gaming fixtures or alternatives yet.
