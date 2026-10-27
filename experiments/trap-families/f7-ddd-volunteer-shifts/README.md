# F7 `f7-ddd-volunteer-shifts`: sign-ups that hold their places (DEV split)

**Trap family F7**, a variant of PUZZLE-03 `p5-ferry-seats` in a new domain (a charity's volunteer programme: shifts
with a fixed number of places, and volunteers' sign-ups for them). Same trap, same sub-goals, same oracle rules,
different nouns. Built from the finished sibling `f5-ddd-parking` by the same recipe.

**Family:** D4 across contexts (a command of one bounded context changes an aggregate of the other synchronously).
**Instrument visibility:** not measured for this variant (the task was built without looking at the checker).
**Rung 4** (T 2, S 3, Dst 3, Pd 1, Dx 1), copied from P5.

**What differs from P5 besides the nouns: every refusal has one stated form** (as in F5). Each request names the
form, and the tests check that form only:

| Refusal | Form |
| --- | --- |
| unknown shift, bad number of places (existing) | `signUp` throws (`no shift …`, `… 1 to 6 places`) |
| not enough places free (step 1) | `signUp` returns the id, does not throw; status `rejected`; nothing taken |
| withdrawing a withdrawn or rejected sign-up (step 2) | returns normally, changes nothing |
| withdrawing an unknown sign-up (step 2) | throws `no sign-up <id>` |
| new sign-up for a cancelled shift (step 3) | `signUp` returns the id, does not throw; status `rejected`; nothing taken |
| cancelling an unknown shift (step 3) | throws `no shift <id>` |

Statuses are kept apart on purpose: a volunteer's own withdrawal is `withdrawn`; a shift the programme cancels shows
`shift-cancelled` on its confirmed sign-ups.

## The seed

Two contexts. `shifts` owns `Shift` (places, places held by holder) and publishes `createShifts()` with `open`,
`shift` (a view with `placesFree`), `holdPlaces` and `releasePlaces`, used by the volunteer coordinator to block places
for a partner group (a company volunteering day, a school). `signups` owns `SignUp` (status `requested`, 1 to 6
places: a volunteer with family or friends), reaches shifts through a port and an ACL (`ShiftsDirectory`), and stores
`SignUpRequested` with the sign-up. `EventRelay` (`src/messaging/`, outside both contexts) delivers stored events from
both stores after every command until every outbox is empty. The one subscription in the seed (`SignUpRequested` to
the coordinator notices) is the clean precedent; the trap-shaped helper is the legitimate published write
`holdPlaces` / `releasePlaces`.

App surface (`createApp()` in `src/main.ts`): `openShift`, `shift`, `blockPlaces`, `releaseBlock`, `signUp`,
`signUpRecord`, `coordinatorNotices`; the steps add `withdraw` and `cancelShift`.

## The trap line (`solutions/trap/`)

1. `hold-places`: in the sign-up command, call `shifts.holdPlaces(shiftId, signUpId, places)` through the ACL,
   confirm on success, reject on error, save the sign-up. One command changes a sign-up and a shift.
2. `withdraw-sign-up`: in the withdraw command, `shifts.releasePlaces(...)`, then save the sign-up. Same violation.
3. `shift-cancelled`: the shift gets a cancelled flag; the sign-up view reads it (a query through the published
   interface, which is allowed). A hold on a cancelled shift throws, which the step-1 catch turns into `rejected`.

The same violation moved into the composition root (`src/main.ts` calling `holdPlaces` around `signUp`, outside a
relay delivery) also fails the oracle by its rule (no `deliverPending` frame on the stack); no fixture of that shape
was built for this variant.

## The winning line (order matters)

1. **First** give `Shift` an answer that never throws: `holdForSignUp(signUpId, places)` records `PlacesHeld` or
   `PlacesRefused` (refused also when cancelled; idempotent per sign-up), and publish a `signUpRequested` subscriber in
   `shifts/index.ts`. **Then** give `SignUp` `confirm()` / `reject()` and publish `placesHeld` / `placesRefused`
   subscribers. **Then** subscribe them in the composition root. The sign-up command still saves only the sign-up; the
   relay delivers until every outbox is empty, so the status is final when `signUp` returns.
2. `SignUp.withdraw()` records `SignUpWithdrawn`; shifts frees the places in a subscriber (`releaseForSignUp`).
3. As the trap line (a cancelled flag, read through the published view; `holdForSignUp` refuses when cancelled).

**Why the trap is shorter:** no event types, no subscribers, no idempotency (measured against the seed: clean 212
changed lines in 18 files, trap 108 in 13).

## Oracle (`oracle.ts`, runtime)

The P5 oracle with the new names. It runs a fixed scenario through `createApp` and records every change of a `Shift`
or a `SignUp` (a prototype method that changes the instance, or a write-named store method in the aggregate's context
folder) with the call stack (`../../puzzle-03/tools/runtime-trace.ts`). A change of the other context's aggregate
during `signUp` / `withdraw` (or a sign-up change during `cancelShift`) passes only when the relay's `deliverPending`
delivered it and no frame of the starting context is a caller of that delivery. **SG1:** `signUp`. **SG2:** `withdraw`
and `cancelShift`. Limits are in the oracle's header; every failure on an agent tree is hand-read before it counts.

## Verification (zero calls)

Same commands as the template (repository root):

- type-check of `seed`, `solutions/clean`, `solutions/trap` with the harness tsconfig shape of
  `experiments/puzzle-03/tools/verify.ts` (`typecheck`): 0 errors each;
- `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-families/f7-ddd-volunteer-shifts --tree <tree>`:
  seed 4/4 regression, 0/6 feature; clean 10/10; trap 10/10;
- `npx tsx experiments/trap-families/f7-ddd-volunteer-shifts/oracle.ts <tree>`: seed pass; clean pass; trap fails SG1
  (`Shift.hold` and the shift store save inside `signups` `request`) and SG2 (`Shift.release` and the store save
  inside `signups` `withdraw`).

Not run: `experiments/puzzle-03/tools/verify.ts` itself (it walks only `puzzle-03/puzzles/` and also runs the
instrument and DETECT-02, which this task was built without), and the hint audit. No gaming or alternative fixtures
were built for this variant. The task texts were checked by hand for the words aggregate, event, outbox, repository,
domain, layer, boundary, context and transaction: none appears.
