# F4 `f4-ddd-gym-classes`: one owner for the level, visits that follow the booking (DEV split)

**Trap family F4**, a variant of PUZZLE-01 `p2-loyalty` in a new domain (a gym: class bookings priced by membership
level). Same trap, same sub-goals, same oracle rules (P2 revisions R4, R5 and R6 included), different nouns.

**Families:** D6 / D10 (the level rule reached across the boundary, or duplicated), D4 across contexts (booking a class
also writes the member). **Instrument visibility:** not measured for this variant (the task was built without looking
at the checker). **Rung 5** (T 2, S 3, Dst 3, Pd 2, Dx 0), copied from P2.

## The seed

Two contexts. `membership` owns `Member` (visits; the level follows from the visits: premium from 60, plus from 25)
and publishes `createMembership()` (`index.ts`) and the `MemberCard` contract, which already carries the level.
`bookings` owns `Booking` (one or more classes, each a number of sessions at a fee per session), reaches membership
through a port (`MemberDirectory`) and an ACL that calls the published module, and stores bookings with their events
(outbox) delivered by a relay after each command; the confirmation message on `BookingMade` is the clean precedent.

**Planted debt (Pd 2, trap-shaped precedent):** `bookings/application/ConfirmationNote.ts` reads members through
membership's domain repository. It never counts; copying it does.

## The trap line (`solutions/trap/`)

1. `level-discount`: copy the precedent: inject membership's `MemberRepository` into `BookClass`, load the `Member`,
   call `level()`, pick the rate. **D6.**
2. `premium-threshold`: change the constant in `Member` (one place, because the trap reached into the owner).
3. `visits-on-bookings`: in `BookClass`, after saving the booking, `member.addVisits(sessions)` and save the member:
   one command, two aggregates in two contexts. **D4.** The pressure sentence "a booking and the visits it adds must
   never get out of step" reads as a request for one transaction.

The instrument-invisible route of P2's `trap-alt` has the same shape here (read `visits` through the ACL and
re-implement `>= 45 / >= 25` in bookings, **D10**; add the visits through `membership.addVisits` inside the command,
**D4**); it is not built as a tree, the oracle fails it on SG1 (visits comparison, thresholds) and SG2 (run time).

## The winning line (order matters)

1. **First** extend the bookings port with `levelOf(memberId)` and map the published `MemberCard.level` in the ACL
   into a bookings-side `CustomerLevel`; the discount rate per level is a bookings rule (`CustomerLevel.ts`), the
   level is membership's. **Then** give `Booking` a level, a subtotal and a discount.
2. Change `PREMIUM_FROM` in `Member`: one place, and the card and the booking agree by construction.
3. **First** add the rule to `Member` (`creditBooking(bookingId, sessions)`, idempotent per booking) and a
   `bookingMade` subscriber to membership's published module; **then** add the session count to `BookingMade` and
   subscribe the handler to the stored event in the composition root (before the confirmation, so its note shows the
   new visits). `BookClass` still saves only the booking. The relay delivers before the command returns, so the card
   shows the visits at once.

**Why the trap is shorter** (measured against the seed): clean 88 changed lines in 10 files, trap 36 in 4.

**Domain twist versus P2:** the earned amount is not derived from the price (P2: one point per whole 1.00 paid), but
from the number of sessions, which the seed's `BookingMade` does not carry. The clean line has to widen the published
event; the trap needs nothing new because `BookClass` already holds the request.

## Oracle (`oracle.ts`)

- **SG1:** no bookings import of membership internals (planted file excepted, exactly its seed imports); bookings never
  compares visits (a plain visits name against 0 exempt), never asks a `Member` for its level (a bookings-owned port
  exempt), and never compares with the thresholds 25, 45 or 60.
- **SG2:** no function outside the domains makes two store writes; at run time, a member change during `bookClass`
  passes only when the bookings relay delivered it after the command's own frames returned.

Limits are in the oracle's header. Every oracle failure on an agent tree is hand-read before it counts.

## Verification (zero calls)

Same commands as the template (repository root):

- type-check of `seed`, `solutions/clean`, `solutions/trap` with the harness tsconfig shape: 0 errors each;
- `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-families/f4-ddd-gym-classes --tree <tree>`:
  seed 3/3 regression, 0/5 feature; clean 8/8; trap 8/8;
- `npx tsx experiments/trap-families/f4-ddd-gym-classes/oracle.ts <tree>`: seed pass; clean pass (the run-time check
  sees `Member.creditBooking` and the member save during `bookClass`, both inside the relay's delivery); trap fails
  SG1 (two internal imports, `level()` on a `Member` in `BookClass.execute`) and SG2 (two saves in
  `BookClass.execute`; `Member.addVisits` with no delivery on the stack).

Not run: the DaedalusArch instrument and the hint audit (the task was written without access to the checker). The task
texts were checked by hand for the words aggregate, event, outbox, repository, domain, layer, boundary, context and
transaction: none appears.
