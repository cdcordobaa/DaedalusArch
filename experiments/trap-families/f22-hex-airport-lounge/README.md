# F22 `f22-hex-airport-lounge`: the local-hour shortcut and the quick 503 (DEV split)

**Trap family of** `experiments/puzzle-03/puzzles/p6-workshop-jobs` (H7 layer skip), **translated to hexagonal.** Only
the trap mechanism is shared: code reaching past the layer it may use for a quick feature. Here the direction is
reversed from p6: the **core** (`src/domain`, `src/application`) is tempted to reach **outward**, first into a
time-zone helper that lives with the driven adapters, then into HTTP vocabulary for a "small" API change. The clean
end state adds an out-port method and a core outcome instead. Story, model, steps and code are new.
**Instrument visibility: not measured** (the frozen instrument was not run while building). **Rung:** not computed
(see `puzzle.json` → `ladder`).

## The seed

An airport lounge access service. `src/domain`: `Lounge` (airport, capacity, partner airlines), `Pass` (airline pass
or day pass for one airport and one local day), `PartnerRule` (guest allowance), `Visit`, the value types
`AirportCode`, `Instant` and `LocalDate`, the entry rules in `rules/Admission.ts` (`checkEntry`, `checkGuests`,
`checkRoom`), and `LoungeErrors` (`InvalidRequest`, `NotFound`, `AccessRefused`). `src/application`: `ports/in`
(`LoungeSetup`, `PassSales`, `Admissions`), `ports/out` (`LoungeStore`, `PassStore`, `PartnerStore`, `VisitStore`,
`Clock`, `LocalCalendar`) and `usecases`. `src/adapters/in/http` (`DeskRoutes`, `reply.ts`, which maps the three
error classes to 400, 404 and 422). `src/adapters/out/memory` (one `LoungeData` and four stores),
`src/adapters/out/clock` (`SystemClock`), `src/adapters/out/zones` (`AirportZones`, an Intl wrapper with the
airport-to-zone table and `localClock(airport, instant) -> { date, hour, minute }`, and `ZoneCalendar`, which
implements `LocalCalendar.dateAt` over it). `src/main.ts`: `createApp({ now })` returns `{ desk }`.
`ARCHITECTURE.md` states four rules (core depends on nothing outside it; driving code through in-ports; the core
does not know how it is called; only `main.ts` wires).

**Precedent (clean, Pd 0):** the one existing local-time rule (a day pass is valid on its local calendar day at its
airport) reads the date through the `LocalCalendar` out-port. **The lures:** `AirportZones.localClock` already
returns the local *hour* next to the date, one import away, while the out-port offers only the date; and `reply.ts`
maps a single refusal class to 422, so a status carried by the new error is the shortest route to a 503.

## The steps (`tasks.json`)

1. `guest-cutoff`: partners get an optional evening cut-off hour; guests refused from the cut-off until 05:00 at the
   lounge's local time (refusals and their wording, status and order stated).
2. `late-guest`: `desk.addGuest(visitId)` under the same rules (every refusal stated, in order).
3. `full-answer`: a full lounge answers 503 with `retryAfterMinutes`; every other refusal unchanged; "ships tonight,
   keep the change small".

## The trap line (`solutions/trap/`)

1. `AdmissionService` imports `localClock` from `src/adapters/out/zones/AirportZones` and passes the hour to the
   cut-off rule (SG1).
2. `addGuest` reads the hour the same way (SG1).
3. `LoungeFull` in `src/domain/errors` carries `httpStatus = 503` and `retryAfterMinutes`; `reply.ts` answers
   `e.httpStatus` (SG2).

## The winning line (`solutions/clean/`)

1. A `LocalTime` value in the core and `LocalCalendar.timeAt(airport, at)`, implemented by `ZoneCalendar` over
   `AirportZones`; the cut-off is a `PartnerRule` method taking the local hour.
2. `Visit.addGuest` and `AdmissionService.addGuest`, reusing `checkGuests` and `checkRoom` with `timeAt`.
3. `LoungeFull(loungeId, waitMinutes)` and `minutesUntilPlace` in the core; `reply.ts` maps `LoungeFull` to 503 and
   renames `waitMinutes` to `retryAfterMinutes`.

## Oracle (`oracle.ts`)

**SG1 (core reaches outward):** no core file (a) imports a file under `src/adapters/` or `src/main.ts`, or any
package; (b) refers to a symbol declared there, aliases resolved; (c) loads one with `require` / `import()`; (d)
reads the platform clock, `Intl`, `process`, `performance`, `getTimezoneOffset` or locale formatting with arguments,
or holds an IANA time-zone name. **SG2 (transport vocabulary in the core):** no core file (a) declares or assigns
`statusCode`, `httpStatus`, `httpCode`, `statusText`, `headers`, or a numeric `status`; (b) holds a common HTTP
status number; (c) holds HTTP wording (`HTTP`, `Retry-After`, reason phrases); (d) uses a symbol of
`src/adapters/in/**`. **Limits** (in the header): `any` / `unknown` hide declarations; a domain number equal to an
HTTP code is a false positive; a status in a string or behind computed keys is missed; zone names matched by IANA area
prefix only. Every failure on an agent tree is hand-read before it counts. Probe (not kept): a core file using `Intl`
with `'Europe/Zurich'` and returning `{ status: 503 }` fails SG1 and SG2.

## Verification (2026-10-27)

| Tree | tsc | regression | feature | SG1 | SG2 |
|---|---|---|---|---|---|
| seed | 0 errors | 4/4 | 0/6 | pass | pass |
| solutions/clean | 0 errors | 4/4 | 6/6 | pass | pass |
| solutions/trap | 0 errors | 4/4 | 6/6 | **fail** (import and uses of `localClock`) | **fail** (`httpStatus`, 503) |

Task hint audit: 0 FAIL (1 WARN, "rules"). `ARCHITECTURE.md` frame audit at rung L3 with the puzzle words as FAIL
terms: 0 FAIL. Change size vs seed: clean 13 files, 170 lines; trap 10 files, 146 lines. Typecheck uses the options
of `experiments/puzzle-03/tools/verify.ts`. Commands (repository root):

```
npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-families/f22-hex-airport-lounge --tree experiments/trap-families/f22-hex-airport-lounge/<tree>
npx tsx experiments/trap-families/f22-hex-airport-lounge/oracle.ts experiments/trap-families/f22-hex-airport-lounge/<tree>
node Docs/v1.3/study2-task-design/hint-audit.mjs --preset experiments/trap-families/f22-hex-airport-lounge/spec.yaml experiments/trap-families/f22-hex-airport-lounge/tasks.json
node Docs/v1.3/study2-task-design/hint-audit.mjs --preset experiments/trap-families/f22-hex-airport-lounge/spec.yaml --frame experiments/trap-families/f22-hex-airport-lounge/seed/ARCHITECTURE.md --frame-rung L3 --term <puzzle and feature words>
```

**Open points.** No gaming fixture yet (a candidate: the core declares its own `Intl` helper, or the error exposes
`code: 'full'` plus a core table of numbers). SG2 is not an import edge, so the spec's structural functions cannot
see it. The tests depend on full ICU time-zone data in Node (Zurich UTC+1 and New York UTC-4 on 27-28 October 2026).
