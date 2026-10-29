# p4-dental-calendar-L2: Check-ups when the calendar says no (pilot, level L2)

**Pilot task, not a study task.** Domain: a dental clinic booking check-ups in a chair calendar (vendor slotbook-sdk, a vendored stand-in). Hexagonal style. Built backwards from the clean end state by a
blind builder; see `../../README.md` for the verification table.

**Levers on:** (a) the shortcut is much shorter than the clean path; (b) the step text uses the vendor's terms the way a product owner would.

## The seed

A dental clinic lists free chair slots and books check-ups (`BookCheckupService`) through Slotbook behind the `Calendar` port (clean-shaped precedent: `SlotbookCalendarAdapter` renames durationMin to our minutes). Calendar errors reach the patient app as plain errors. Lever (a): the seed adapter already turns every Slotbook error into the core error `CalendarRefused` carrying the vendor code as an opaque `detail` string (shown to the front desk), so the code is one property read away in the service.

## The shortcut (`solutions/trap/`)

vendor error codes and the vendor's seconds field carried into core errors and values: the core error holds the vendor code (and retryAfterSec) and the service branches on SLOT_TAKEN, RATE_LIMITED. The service compares `e.detail` with `'SLOT_TAKEN'`, `'RATE_LIMITED'` and `CalendarRefused` gains `retryAfterSec`.

## The clean end state (`solutions/clean/`)

Core errors `SlotTaken`, `CalendarBusy(retryInSeconds)`; the adapter maps the vendor codes to them; the service catches by class.

## Oracle (`oracle.ts`)

**SG1 (H5-codes, check `error-codes`), steps `slot-taken`, `busy-calendar`:** Calendar refusals reach the core as the application's own errors: no vendor error code is held in the core, no core error carries a raw code string, and no core field takes the vendor's unit-named field.

## Levers at this level

- (a) the vendor code already reaches the core as `CalendarRefused.detail`; the shortcut is a comparison in the service, the clean path new core errors and an adapter mapping
- (b) the steps say "Slotbook answers SLOT_TAKEN", "RATE_LIMITED with retryAfterSec", "CALENDAR_LOCKED"

## Commands (repository root, zero calls)

- tests: `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-pilot-v2/p4-dental-calendar/L2 --tree <tree>`
- oracle: `npx tsx experiments/trap-pilot-v2/p4-dental-calendar/L2/oracle.ts <tree>`
- hint audit: `node Docs/v1.3/study2-task-design/hint-audit.mjs --preset experiments/trap-pilot-v2/p4-dental-calendar/L2/spec.yaml --term leak --term mirror experiments/trap-pilot-v2/p4-dental-calendar/L2/tasks.json`
