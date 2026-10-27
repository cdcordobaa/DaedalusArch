# F6 `f6-ddd-restaurant`: one owner for the guest status, visits that follow the completion (DEV split)

**Trap family F6**, a variant of PUZZLE-01 `p2-loyalty` in a new domain (a restaurant group: table deposits waived by
guest status). Same trap, same sub-goals, same oracle rules (P2 revisions R4, R5 and R6 included), different nouns.

**Families:** D6 / D10 (the status rule reached across the boundary, or duplicated), D4 across contexts (completing a
reservation also writes the guest). **Instrument visibility:** not measured for this variant (the task was built
without looking at the checker). **Rung 5** (T 2, S 3, Dst 3, Pd 2, Dx 0), copied from P2.

## The seed

Two contexts. `guests` owns `Guest` (visits; the status follows from the visits: VIP from 15, regular from 4, new
below) and publishes `createGuests()` (`index.ts`) and the `GuestProfile` contract, which already carries the status.
`reservations` owns `Reservation` (a party of 1 to 8, a deposit of 12.50 per seat, completed once), reaches guests
through a port (`GuestDirectory`) and an ACL (`acl/GuestProfiles.ts`) that calls the published module, and stores
reservations with their events (outbox) delivered by a relay after each command. Two clean precedents of the reaction
the winning line needs: the confirmation on `TableBooked` and the thank-you message on `ReservationCompleted`, both
handlers the relay calls after the command returned.

**Planted debt (Pd 2, trap-shaped precedent):** `reservations/application/ConfirmationNote.ts` reads guests through
guests' domain repository. It never counts; copying it does.

**Refusal rules (all explicit).** In the seed code and the regression tests: a party size that is not a whole number
from 1 to 8 (`party size`); a guest id with no profile (`no guest`); completing an unknown reservation
(`no reservation`); completing a reservation twice (`already completed`); added visits that are not a positive whole
number; a guest without a name. In the step texts: step 1 changes no refusal; step 3 says that a refused completion
adds no visit and that a booking adds nothing. No other refusal is tested.

## The trap line (`solutions/trap/`)

1. `status-waiver`: copy the precedent: inject guests' `GuestRepository` into `BookTable`, load the `Guest`, call
   `status()`, pick the waived share. **D6.**
2. `vip-threshold`: change the constant in `Guest` (one place, because the trap reached into the owner).
3. `visits-on-completion`: in `CompleteReservation`, after saving the reservation, `guest.addVisits(1)` and save the
   guest: one command, two aggregates in two contexts. **D4.** The pressure sentence "a completed reservation and the
   visit it adds must never get out of step" reads as a request for one transaction.

The instrument-invisible route of P2's `trap-alt` has the same shape here (read `visits` through the ACL and
re-implement `>= 10 / >= 4` in reservations, **D10**; add the visit through `guests.addVisits` inside the command,
**D4**); it is not built as a tree, the oracle fails it on SG1 (visits comparison, thresholds) and SG2 (run time).

## The winning line (order matters)

1. **First** extend the reservations port with `statusOf(guestId)` and map the published `GuestProfile.status` in the
   ACL into a reservations-side `GuestStatus`; the waived share per status is a reservations rule (`GuestStatus.ts`),
   the status is guests'. **Then** give `Reservation` a guest status, a full deposit, a waived amount and a deposit.
2. Change `VIP_FROM` in `Guest`: one place, and the profile and the deposit agree by construction.
3. **First** add the rule to `Guest` (`creditVisit(reservationId)`, idempotent per reservation) and a `visitCompleted`
   subscriber to guests' published module; **then** subscribe it to the stored `ReservationCompleted` in the
   composition root. `CompleteReservation` still saves only the reservation. The relay delivers before the command
   returns, so the profile shows the visit at once.

**Why the trap is shorter** (measured against the seed with `diff -ruN`): clean 81 changed lines in 9 files, trap 44
in 5.

**Domain twist versus P2 and F4:** the guest is written by a second, later command (completing a reservation), not by
the command that is priced (booking). The trap is attractive because `CompleteReservation` already holds the
reservation and its guest id; the event the clean line needs already exists and already carries the guest id, so the
clean line widens nothing and only adds a subscriber. The run-time check therefore watches both commands.

## Oracle (`oracle.ts`)

- **SG1:** no reservations import of guests internals (planted file excepted, exactly its seed imports); reservations
  never compares visits (a plain visits name against 0 exempt), never asks a `Guest` for its status (a
  reservations-owned port exempt), and never compares with the thresholds 4, 10 or 15.
- **SG2:** no function outside the domains makes two store writes; at run time, a guest change during `book` or
  `complete` passes only when the reservations relay delivered it after the command's own frames returned.

Limits are in the oracle's header (among them: 10 is a common literal, so a non-status comparison with 10 in
reservations fails SG1 (c) and must be hand-read). Every oracle failure on an agent tree is hand-read before it counts.

## Verification (zero calls)

Same commands as the template (repository root):

- type-check of `seed`, `solutions/clean`, `solutions/trap` with the harness tsconfig shape (strict, ES2022, commonjs,
  node resolution, types [node]): 0 errors each;
- `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-families/f6-ddd-restaurant --tree <tree>`:
  seed 3/3 regression, 0/5 feature; clean 8/8; trap 8/8;
- `npx tsx experiments/trap-families/f6-ddd-restaurant/oracle.ts <tree>`: seed pass; clean pass (the run-time check
  sees `Guest.creditVisit` and the guest save during `complete`, both inside the relay's delivery); trap fails SG1
  (two internal imports each in `BookTable` and `CompleteReservation`, `status()` on a `Guest` in
  `BookTable.execute`) and SG2 (two saves in `CompleteReservation.execute`; `Guest.addVisits` and the guest save with
  no delivery on the stack).

Not run: the DaedalusArch instrument and the hint audit (the task was written without access to the checker). The task
texts were checked mechanically for the words aggregate, event, outbox, repository, domain, layer, boundary, context
and transaction: none appears.
