# F3 `f3-ddd-car-sharing`: two cars, one command (DEV split)

**Trap family F3**, a variant of PUZZLE-01 `p1-transfers` (the same trap as F1) in a new domain (car
sharing: the fleet team moves a booking from a broken car to another car in the same zone). Same trap, same
sub-goals, same oracle rules, different nouns, and a different in-aggregate rule (a time gap instead of a daily count).

**Families:** D4 (two aggregate instances changed and saved in one command), D5 (the cleaning gap decided outside the
aggregate). **Instrument visibility:** not measured for this variant (the task was built without looking at the
checker). **Rung 4** (T 2, S 3, Dst 1, Pd 1, Dx 0), copied from P1.

## The seed

One context (`fleet`), one aggregate (`Car`: bookings never overlap in time, each booking held once; time slots are a
value object `TimeSlot`), application services that load one car, call it and save it, and a store that saves a car
**together with its pending events** (an outbox). An `EventRelay` delivers stored events after every command; the
availability notice on `CarAdded` is the one precedent. The clean mechanism is therefore already in the seed (Pd 1:
clean precedent only).

## The trap line (shortest working)

1. `moves`: `MoveBooking` loads both cars, finds the booking on the leaving car, `cancel` on one, `book` on the other
   (same id, member and slot), `save` both. The pressure sentence "the move happens completely or not at all: never on
   both cars or on neither" reads as a request for one transaction over two aggregates. **D4.**
2. `cleaning-gap`: "bookings made directly keep the current rule" makes the move service the obvious place: it scans
   the receiving car's bookings and compares minutes (`b.slot.startMinute < slot.endMinute + CLEANING_GAP_MINUTES`)
   before calling `book`. The invariant now lives outside the car. **D5.**
3. `car-log`: optional `kind` and `otherCar` parameters on `book`/`cancel`, so the double write of step 1 now also
   writes both logs.

## The winning line (order matters)

1. **First** give `Car` a `takeOverBooking(moveId, booking, from, fromZone)` that puts the booking on the receiving car
   (different car, same zone, no overlap) and raises `BookingMoved`; the store saves it with the car (the seed's
   outbox). The command changes the **receiving** car, because that is the one that can refuse; the leaving car only
   has to let go. The command reads the leaving car only to fetch the booking (`booking(id)`, a car method that refuses
   when the car does not hold it) and its zone. **Then** add `ReleaseMovedBooking`, a handler that takes the booking off
   the leaving car once per move id (idempotent), and register it on the relay. Only then expose `moveBooking`. One
   command saves one car; the other follows when the event is delivered, which the seed's relay does before the
   command returns, so callers see both calendars changed.
2. The cleaning gap goes **into** `takeOverBooking` (only moved-in bookings are checked, direct `book` is untouched;
   an overlap keeps the car-not-free message). This is only short if step 1 put the move inside the aggregate; after
   the trap line, the service is the natural place.
3. The car records its own calendar changes in each method; `logOf()` returns them newest first.

**Why the trap is shorter:** it needs no event, no handler, no idempotency and no relay wiring (measured: clean 171
changed lines in 9 files, trap 57 in 3).

**Domain twist versus P1 and F1:** the in-aggregate rule is a temporal invariant over the receiving car's whole
calendar (a gap on both sides of the moved slot), not a counter. It applies to moved bookings only, which is the
pressure toward the service. An agent may also put it in the domain by giving `book` a gap parameter: that passes SG2.
An agent that splits with the leaving car first (cancel, then book on delivery) gets a release that can be followed by
a refused booking (overlap or gap), which breaks "never on neither"; the behaviour tests catch that (refused moves
leave the booking on the leaving car).

## Oracle (`oracle.ts`)

- **SG1 (D4):** no function outside the domain makes two or more store writes; no store type declares a write taking
  several `Car`s, or a non-read method taking two cars or two car ids that some call reaches.
- **SG2 (D5):** no business comparison (relational operator other than a loop bound or length check) outside the
  domain.

Limits are in the oracle's header; the F3-specific one: a gap decided in a service through a domain predicate (a slot
widened by minute arithmetic, then `overlaps`) holds no relational operator and passes SG2 mechanically, so it is
hand-read. Every oracle failure on an agent tree is hand-read before it counts.

## Verification (zero calls)

Same commands as the template (repository root):

- type-check of `seed`, `solutions/clean`, `solutions/trap` with the harness tsconfig shape: 0 errors each;
- `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-families/f3-ddd-car-sharing --tree <tree>`:
  seed 4/4 regression, 0/6 feature; clean 10/10; trap 10/10;
- `npx tsx experiments/trap-families/f3-ddd-car-sharing/oracle.ts <tree>`: seed pass; clean pass; trap fails SG1
  (two saves in `MoveBooking.execute`) and SG2 (the two minute comparisons in `MoveBooking.execute`).

Not run: the DaedalusArch instrument and the hint audit (the task was written without access to the checker); the
task texts were grepped for the banned architecture words (none).

## Note on the requirement

"Completely or not at all" is satisfied by the clean line as an **observable** guarantee: the booking on the receiving
car and its event are stored in one step, the leaving car releases it exactly once, and the facade returns only after
delivery. It is not one database transaction over two aggregates, which is the point of the puzzle.
