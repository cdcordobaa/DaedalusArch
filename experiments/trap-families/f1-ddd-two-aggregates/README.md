# F1 `f1-ddd-two-aggregates`: two sections, one command (DEV split)

**Trap family F1**, a variant of PUZZLE-01 `p1-transfers` in a new domain (course enrolment: students switching
between sections of the same course). Same trap, same sub-goals, same oracle rules, different nouns.

**Families:** D4 (two aggregate instances changed and saved in one command), D5 (the daily switch limit decided outside
the aggregate). **Instrument visibility:** not measured for this variant (the task was built without looking at the
checker). **Rung 4** (T 2, S 3, Dst 1, Pd 1, Dx 0), copied from P1.

## The seed

One context (`enrolment`), one aggregate (`Section`: never more students than seats, each student once), application
services that load one section, call it and save it, and a store that saves a section **together with its pending
events** (an outbox). An `EventRelay` delivers stored events after every command; the opening notice on
`SectionOpened` is the one precedent. The clean mechanism is therefore already in the seed (Pd 1: clean precedent
only).

## The trap line (shortest working)

1. `switches`: `SwitchSection` loads both sections, `drop` on one, `enrol` on the other, `save` both. The pressure
   sentence "the move happens completely or not at all: never in both sections or in neither" reads as a request for
   one transaction over two aggregates. **D4.**
2. `daily-limit`: the service asks the store how many students the section took in by switch today and compares
   (`taken >= DAILY_SWITCH_LIMIT`), then records the switch in a side table: a third write in the same command, and the
   invariant lives outside the section. **D5** (and D4 again).
3. `history`: optional `kind` and `otherSection` parameters on `enrol`/`drop`, so the double write of step 1 now also
   writes both histories.

## The winning line (order matters)

1. **First** give `Section` an `acceptSwitch(switchId, studentId, from, fromCourse, day)` that seats the student
   (same course, not already in, a free seat) and raises `StudentSwitched`; the store saves it with the section (the
   seed's outbox). The command changes the **receiving** section, because that is the one that can refuse (seats);
   the leaving section only has to let go, which cannot fail. **Then** add `ReleaseSwitchedSeat`, a handler that frees
   the old seat once per switch id (idempotent), and register it on the relay. Only then expose `switchSection`. The
   command reads the leaving section only to check the student is in it (`assertEnrolled`, a section method) and to
   learn its course. One command saves one section; the other follows when the event is delivered, which the seed's
   relay does before the command returns, so callers see both rosters changed.
2. The daily limit goes **into** `acceptSwitch` (the section keeps how many it took in on which day). This is only
   short if step 1 put the switch inside the aggregate; after the trap line, the service is the natural place.
3. The section records its own roster changes in each method; `history()` returns them newest first.

**Why the trap is shorter:** it needs no event, no handler, no idempotency and no relay wiring (measured: clean 166
changed lines in 9 files, trap 64 in 5).

**Domain twist versus P1:** in P1 the side that refuses (the sender's funds) is also the natural "first" side. Here the
natural reading is "leave A, then join B", but the side that can refuse is B, so the clean line has to start from the
destination. An agent that does the event split with the leaving section first gets a release that can be followed by
a refused seat, which breaks "never in neither"; the behaviour tests catch that (refused switch into a full section).

## Oracle (`oracle.ts`)

- **SG1 (D4):** no function outside the domain makes two or more store writes; no store type declares a write taking
  several `Section`s, or a non-read method taking two sections or two section ids that some call reaches.
- **SG2 (D5):** no business comparison (relational operator other than a loop bound or length check) outside the
  domain.

Limits are in the oracle's header. Every oracle failure on an agent tree is hand-read before it counts.

## Verification (zero calls)

Same commands as the template (repository root):

- type-check of `seed`, `solutions/clean`, `solutions/trap` with the harness tsconfig shape: 0 errors each;
- `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-families/f1-ddd-two-aggregates --tree <tree>`:
  seed 3/3 regression, 0/6 feature; clean 9/9; trap 9/9;
- `npx tsx experiments/trap-families/f1-ddd-two-aggregates/oracle.ts <tree>`: seed pass; clean pass; trap fails SG1
  (two saves in `SwitchSection.execute`) and SG2 (`taken >= DAILY_SWITCH_LIMIT` in `SwitchSection.execute`).

Not run: the DaedalusArch instrument and the hint audit (the task was written without access to the checker).

## Note on the requirement

"Completely or not at all" is satisfied by the clean line as an **observable** guarantee: the new seat and its event
are stored in one step, the old seat is released exactly once, and the facade returns only after delivery. It is not
one database transaction over two aggregates, which is the point of the puzzle.
