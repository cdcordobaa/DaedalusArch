# hxpb1-pottery-kiln: Is my piece out of the kiln (HX study set, part B)

**Study task (draft, not sealed, not registered).** Domain: a pottery studio firing students' pieces in a kiln
watched by a cloud kiln controller (vendor `kilnwise-sdk`, a vendored stand-in). Hexagonal style. Shape: a renamed
copy of the vendor's value set in the core, built at the TRAP-PILOT-v2 p3 **L3** lever set without lever (e) (a–d, f; lever (e) excluded before the seal, pre-registration D2). Built backwards
from the clean end state by a rule-blind builder; see `../README.md` for the verification table.

## The seed

Students drop pieces off (`PieceService`, `FiringRules`); staff load a firing, which Kilnwise schedules behind the
`KilnBookings` port (clean-shaped precedent: `KilnwiseBookingsAdapter` builds the vendor's request from our terms).
Lever (a): `KilnReadings.newest` already answers `KilnReading` with an opaque lower-case `phaseCode` (printed in the
studio log), so the vendor's seven phases already reach the core as text. Lever (c): the core keeps the vendor's two
firing programs one to one (`bisque` / `glaze` for `BISQUE` / `GLAZE`; legal, two values). Lever (f): four
studio-side features (clay stock, punch cards, damp-room shelves, glaze book; 16 files); the kiln ports sit under
`ports/out/kiln`, the service under `services/pieces`.

## The shortcut (`solutions/trap/`)

The service declares `KilnPhase` with the seven vendor phases in lower case, casts `phaseCode` to it and switches on
it (step 1 is one file; steps 2 and 3 are one more comparison and one more case).

## The clean end state (`solutions/clean/`)

A core type `FiringProgress` (`waiting | firing | cooling | finished | failed`, five values) with the steps the studio
distinguishes; a `progress` field on `KilnReading`; the adapter maps the seven phases many to one.

## Entry points the tests call

`dropOff`, `loadKiln`, `pieceStatus`, `kilnLog` exist on the seed's app; `withdrawPiece(pieceId)` is new in step 2 and
the step text names it (the pilot's p3 facade defect).

## Commands (repository root, zero calls)

- tests: `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/hx-study-set/part-b/hxpb1-pottery-kiln --tree <tree>`
- oracle: `npx tsx experiments/hx-study-set/part-b/hxpb1-pottery-kiln/oracle.ts <tree>`
- all checks: `npx tsx experiments/hx-study-set/part-b/verify.ts hxpb1`
