# p4-dental-calendar-L1: Check-ups when the calendar says no (pilot, level L1)

**Pilot task, not a study task.** Domain: a dental clinic booking check-ups in a chair calendar (vendor slotbook-sdk, a vendored stand-in). Hexagonal style. Built backwards from the clean end state by a
blind builder; see `../../README.md` for the verification table.

**Levers on:** none (mild, like the trap-families tasks).

## The seed

A dental clinic lists free chair slots and books check-ups (`BookCheckupService`) through Slotbook behind the `Calendar` port (clean-shaped precedent: `SlotbookCalendarAdapter` renames durationMin to our minutes). Calendar errors reach the patient app as plain errors.

## The shortcut (`solutions/trap/`)

vendor error codes and the vendor's seconds field carried into core errors and values: the core error holds the vendor code (and retryAfterSec) and the service branches on SLOT_TAKEN, RATE_LIMITED. A core `CalendarError(code: string, retryAfterSec?)` wraps every vendor error; the service compares its code with the vendor codes.

## The clean end state (`solutions/clean/`)

Core errors `SlotTaken`, `CalendarBusy(retryInSeconds)`; the adapter maps the vendor codes to them; the service catches by class.

## Oracle (`oracle.ts`)

**SG1 (H5-codes, check `error-codes`), steps `slot-taken`, `busy-calendar`:** Calendar refusals reach the core as the application's own errors: no vendor error code is held in the core, no core error carries a raw code string, and no core field takes the vendor's unit-named field.

## Levers at this level

None.

## Commands (repository root, zero calls)

- tests: `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-pilot-v2/p4-dental-calendar/L1 --tree <tree>`
- oracle: `npx tsx experiments/trap-pilot-v2/p4-dental-calendar/L1/oracle.ts <tree>`
- hint audit: `node Docs/v1.3/study2-task-design/hint-audit.mjs --preset experiments/trap-pilot-v2/p4-dental-calendar/L1/spec.yaml --term leak --term mirror experiments/trap-pilot-v2/p4-dental-calendar/L1/tasks.json`
