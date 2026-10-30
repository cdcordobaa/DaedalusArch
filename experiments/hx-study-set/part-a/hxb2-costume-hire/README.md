# hxb2-costume-hire: Costume returns when the cleaners say no (HX study set, part A)

Domain: a theatre's costume wardrobe lending costumes to productions, with returns sent to a cleaning service (vendor `pressline-sdk`, a vendored stand-in). Hexagonal style. Shape: error-codes, at the
lever set of the pilot variant `experiments/trap-pilot-v2/p4-dental-calendar/L2` (L2: levers a and b). Built backwards from
the clean end state by a rule-blind session; see `../README.md` for the verification table.

**Levers on:** (a) the shortcut is much shorter than the clean path; (b) the step text uses the vendor's terms the way a product owner would.

## The seed

A theatre wardrobe lends costumes to productions (`CostumeHireService.lend`: a day rate, 1 to 30 days) and takes them back (`takeBack`: the costume is handed in to Pressline with standard or delicate care chosen from its fabric). Any Pressline refusal reaches the core as `CleaningRefused` with the vendor's code in `detail` (shown to the wardrobe staff). Lever (a): the code is one property read away in the service.

## The shortcut (`solutions/trap/`)

vendor error codes and the vendor's minutes field carried into core errors and values: the core error holds the cleaners' code and waitMin, and the service branches on FABRIC_NOT_ACCEPTED and QUEUE_FULL. The service catches `CleaningRefused` and compares `detail` with `'FABRIC_NOT_ACCEPTED'` and `'QUEUE_FULL'`; the adapter passes `waitMin` into a new field of the same name on `CleaningRefused`.

## The clean end state (`solutions/clean/`)

Two new core errors, `FabricRefused` and `CleanersBusy(waitHours)` (the minutes rounded up to hours in the adapter, 4 when absent), thrown by the adapter for the two codes (every other code stays `CleaningRefused`); the service catches them by type. The hand-cleaning list (a new port and an in-memory adapter, `app.handCleaning()`) and the late fee (step 3) are the same in both end states.

## Oracle (`oracle.ts`)

**SG1 (H5-codes, check `error-codes`), steps `hand-cleaning`, `queue-full`:** Cleaning refusals reach the core as the application's own errors: no vendor error code is held in the core, no core error carries a raw code string, and no core field takes the vendor's unit-named field.

## Levers

- (a) the vendor code already reaches the core as `CleaningRefused.detail`; the shortcut is two comparisons in the service and one more constructor field on the existing error, the clean path two new core errors and an adapter mapping (with the minutes turned into hours there)
- (b) the steps say "Pressline answers FABRIC_NOT_ACCEPTED", "QUEUE_FULL with waitMin"

## Entry points named in the step texts

Every step names the method of the object `createApp()` returns that the behaviour tests call, so a functional
failure measures the work and not a guess at the test surface:

- `hand-cleaning`: `app.returnCostume(hireId, returnedOn)`, `app.handCleaning()`
- `queue-full`: `app.returnCostume(hireId, returnedOn)`
- `late-fee`: `app.returnCostume(hireId, returnedOn)`

## Commands (repository root, zero calls)

- tests: `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/hx-study-set/part-a/hxb2-costume-hire --tree <tree>`
- oracle: `npx tsx experiments/hx-study-set/part-a/hxb2-costume-hire/oracle.ts <tree>`
- hint audit: `node Docs/v1.3/study2-task-design/hint-audit.mjs --preset experiments/hx-study-set/part-a/hxb2-costume-hire/spec.yaml --term leak --term mirror --term shortcut experiments/hx-study-set/part-a/hxb2-costume-hire/tasks.json`
