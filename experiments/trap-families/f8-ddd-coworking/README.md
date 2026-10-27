# F8 `f8-ddd-coworking`: two rooms, one command (DEV split)

**Trap family F8**, a variant of PUZZLE-01 `p1-transfers` (the same trap as F1 and F3) in a new domain (a coworking
space: the front desk moves a team's meeting-room reservation out of a room closed for repairs into another room at the
same site). Same trap, same sub-goals, same oracle rules, different nouns, and a different in-aggregate rule (a daily
per-team hour cap over the receiving room's calendar, checked only for relocated reservations).

**Families:** D4 (two aggregate instances changed and saved in one command), D5 (the team cap decided outside the
aggregate). **Instrument visibility:** not measured for this variant (the task was built without looking at the
checker). **Rung 4** (T 2, S 3, Dst 1, Pd 1, Dx 0), copied from P1.

## The seed

One context (`spaces`), one aggregate (`Room`: reservations never overlap in time, never need more people than the room
seats, each reservation held once; time slots are a value object `TimeSlot` within one day), application services that
load one room, call it and save it, and a store that saves a room **together with its pending events** (an outbox). An
`EventRelay` delivers stored events after every command; the listing notice on `RoomOpened` is the one precedent. The
clean mechanism is therefore already in the seed (Pd 1: clean precedent only). Every refusal in the seed and in the
tasks is a thrown `SpaceError`.

## The trap line (shortest working)

1. `relocations`: `RelocateReservation` loads both rooms, checks the site, finds the reservation on the leaving room,
   `cancel` on one, `reserve` on the other (same id, team, people and slot; `reserve` keeps the room-not-free and
   room-too-small refusals), `save` both. The pressure sentence "completely or not at all: never in both rooms or in
   neither" reads as a request for one transaction over two aggregates. **D4.**
2. `team-cap`: "reservations made directly keep the current rules with no cap" makes the relocation service the obvious
   place: it sums the team's minutes on that day in the receiving room and compares
   (`used + r.slot.minutes > TEAM_CAP_MINUTES`) before saving. The invariant now lives outside the room. **D5.**
3. `room-history`: optional `kind` and `otherRoom` parameters on `reserve`/`cancel`, so the double write of step 1 now
   also writes both histories.

## The winning line (order matters)

1. **First** give `Room` a `takeOverReservation(relocationId, reservation, from, fromSite)` that puts the reservation in
   the receiving room (different room, same site, no overlap, enough seats) and raises `ReservationRelocated`; the store
   saves it with the room (the seed's outbox). The command changes the **receiving** room, because that is the one that
   can refuse; the leaving room only has to let go. The command reads the leaving room only to fetch the reservation
   (`reservation(id)`, a room method that refuses when the room does not hold it) and its site. **Then** add
   `ReleaseRelocatedReservation`, a handler that takes the reservation out of the leaving room once per relocation id
   (idempotent), and register it on the relay. Only then expose `relocate`. One command saves one room; the other
   follows when the event is delivered, which the seed's relay does before the command returns, so callers see both
   calendars changed.
2. The team cap goes **into** `takeOverReservation` (only relocated reservations are checked, direct `reserve` is
   untouched; overlap and seats keep their messages and are checked first). This is only short if step 1 put the
   relocation inside the aggregate; after the trap line, the service is the natural place.
3. The room records its own calendar changes in each method; `historyOf()` returns them newest first.

**Why the trap is shorter:** it needs no event, no handler, no idempotency and no relay wiring (measured with a
recursive unified diff against the seed: clean 169 changed lines in 9 files, trap 57 in 3).

**Domain twist versus P1, F1 and F3:** the rule is a sum over the receiving room's calendar filtered by team and day
(direct reservations count toward the total but are never refused by it), so it needs the receiving room's whole state,
not the reservation alone. An agent may also put it in the domain by giving `reserve` a cap flag: that passes SG2. An
agent that releases from the leaving room first (cancel, then reserve on delivery) gets a release that can be followed
by a refused reservation (overlap, seats or cap), which breaks "never in neither"; the behaviour tests catch that
(refused relocations leave the reservation in the leaving room).

## Oracle (`oracle.ts`)

- **SG1 (D4):** no function outside the domain makes two or more store writes; no store type declares a write taking
  several `Room`s, or a non-read method taking two rooms or two room ids that some call reaches.
- **SG2 (D5):** no business comparison (relational operator other than a loop bound or length check) outside the
  domain.

Limits are in the oracle's header; the F8-specific ones: a cap decided in a service through a domain predicate (the
service asks the room whether the team fits and throws itself) or through `Math.min`/`Math.max` plus an equality test
holds no relational operator and passes SG2 mechanically, so it is hand-read. Every oracle failure on an agent tree is
hand-read before it counts.

## Verification (zero calls)

Same commands as the template (repository root):

- type-check of `seed`, `solutions/clean`, `solutions/trap` with the harness tsconfig shape (strict, ES2022, commonjs,
  node resolution, types [node]): 0 errors each;
- `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-families/f8-ddd-coworking --tree <tree>`:
  seed 4/4 regression, 0/6 feature; clean 10/10; trap 10/10;
- `npx tsx experiments/trap-families/f8-ddd-coworking/oracle.ts <tree>`: seed pass; clean pass; trap fails SG1
  (two saves in `RelocateReservation.execute`) and SG2 (the cap comparison in `RelocateReservation.execute`).

Not run: the DaedalusArch instrument and the hint audit (the task was written without access to the checker); the
task texts were grepped for the banned architecture words (none).

## Note on the requirement

"Completely or not at all" is satisfied by the clean line as an **observable** guarantee: the reservation in the
receiving room and its event are stored in one step, the leaving room releases it exactly once, and the facade returns
only after delivery. It is not one database transaction over two aggregates, which is the point of the puzzle.
