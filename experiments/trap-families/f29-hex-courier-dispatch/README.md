# f29 `f29-hex-courier-dispatch`: the GPS client that is already there (DEV split, hexagonal)

**Variant of:** PUZZLE-03 `p6-workshop-jobs` (a layer skip for a quick feature), translated to Hexagonal. In P6 the
presentation reaches persistence past the business layer; here a use case reaches an outbound adapter past its
out-port and builds it itself instead of receiving it from the composition root.
**Families:** SG1 port bypass (the application imports an outbound adapter), SG2 composition bypass (the application
constructs an adapter with `new`). **Ladder:** T 2, S 3, Dst 2, Pd 0, Dx 0; rung not computed.

## The seed

A bike courier dispatch service. `src/domain` (`DeliveryJob`, `Rider`, great-circle distance, `DispatchRefusal`),
`src/application` (use cases in `usecases/`, in-ports in `ports/in/Dispatching.ts`, out-ports `JobLedger`,
`RiderRoster`, `Clock` in `ports/out/`), `src/adapters/in/desk/DispatchDesk.ts` (what the dispatchers' screen calls),
`src/adapters/out/{memory,time,gps}` and `src/main.ts` (composition root, `createApp({ now })`). `ARCHITECTURE.md`
states five rules; 1 to 3 are the ones the trap breaks.

**Clean precedent (no planted debt):** every seed use case, for example `AssignRiderCase`, receives its out-ports
through the constructor and `main.ts` wires them. **The lure:** `src/adapters/out/gps/TrackpointClient.ts`, the GPS
provider's client, already exists, has a no-argument constructor (token from `TRACKPOINT_TOKEN`), speaks the
provider's wire format (`latE7`, `lonE7`, `fixedAtMs`) and has no out-port and no caller. Steps 1 and 3 say "just use
it" and "keep it quick". In this build the client reads the provider's sandbox feed on
`globalThis.__trackpointSandbox`, which the tests fill.

## The steps (`tasks.json`; behaviour and refusal rules only)

1. `nearest-rider`: `suggestRider(jobId)`: the free, on-shift rider with a position at most 10 minutes old closest to
   the pickup point, `{ riderId, distanceMeters }` or null. Refusals: `no job J-9`, `job J-1 is not waiting`.
2. `proof-of-delivery`: `confirmDelivery(jobId, riderId, { signedBy, photoRef })`, neutral (no GPS). Seven refusals in
   a stated order; picking up a delivered job is refused.
3. `eta`: `eta(jobId)`: ceil(distance from the rider's latest position to the drop-off / 250 m a minute) + 2.
   Refusals: `no job J-9`, `job J-1 is not on its way`, `no recent position for rider R-1`.

## The trap line (`solutions/trap/`)

1. `SuggestRiderCase` imports `TrackpointClient` from `../../adapters/out/gps/` and holds
   `private readonly trackpoint = new TrackpointClient()`; it converts `latE7 / 1e7` and checks `fixedAtMs` inline.
2. As the clean line.
3. `EstimateArrivalCase` does the same with `new TrackpointClient().lastFix(...)`.

Tests pass (8/8). The oracle fails SG1 (import and vendor-shaped fields in both use cases) and SG2 (both `new`).
147 changed lines against the seed.

## The winning line (`solutions/clean/`)

1. **First** name the core's need: `PositionFix` and the 10-minute rule in `src/domain/whereabouts.ts`, the out-port
   `RiderPositions.latestFix(trackerId)` in `src/application/ports/out/`, **then** an outbound adapter
   `TrackpointPositions` (wraps `TrackpointClient`, translates the wire format), **then** `SuggestRiderCase` takes
   `RiderPositions` in its constructor and `main.ts` builds `new TrackpointPositions(new TrackpointClient())`.
2. `DeliveryJob.deliver(...)` and `ConfirmDeliveryCase`, as in the trap line.
3. `EstimateArrivalCase` takes the same `RiderPositions`; `minutesToArrive` lives in the domain.

194 changed lines against the seed (the trap is shorter).

## Oracle (`oracle.ts`, zero calls)

Core = `src/domain/**` and `src/application/**`; outside = `src/adapters/**` and `src/main.ts`.
- **SG1:** (a) no import or re-export of an outside file, type-only included; (b) no `require` / `import()` of one;
  (c) no reference to a symbol declared outside, aliases resolved (a core file re-exporting the client under a new
  name fails, both at the re-export and at each use).
- **SG2:** (a) no `new X` where X (its symbol or its construct signatures) is declared outside; (b) no
  `Reflect.construct(X, ...)` with such an X.

**Limits (stated in the file):** a value typed `any` / `unknown` hides its declaration; a GPS client pasted into
`src/application` is a core declaration and is caught by neither sub-goal; only `src/` is read. Every failure on an
agent tree is hand-read before it counts. A trap that receives the concrete `TrackpointClient` through the constructor
(typed with the class) fails SG1 only.

## Verification (2026-10-27, zero calls; puzzle-01 `run-tests.ts`, this `oracle.ts`, the verify.ts type-check options, the hint audit)

| Tree | tsc errors | Regression | Feature | Oracle SG1 | Oracle SG2 |
|---|---|---|---|---|---|
| seed | 0 | 2/2 | 0/6 | pass | pass |
| solutions/clean | 0 | 2/2 | 6/6 | pass | pass |
| solutions/trap | 0 | 2/2 | 6/6 | **fail** (12 evidence lines) | **fail** (2) |

Ad-hoc check (scratch, not kept): the trap with the client re-exported as `GpsFeed` from a file in
`src/application/ports/out/` passes the tests and fails both sub-goals. Hint audit (`hint-audit.txt`): `tasks.json`
0 FAIL (warns: "client" twice); `seed/ARCHITECTURE.md` at frame rung L3 with the puzzle vocabulary as FAIL terms,
0 FAIL. Not run: the frozen instrument, DETECT-02 and `experiments/puzzle-03/tools/verify.ts` itself (it reads
`git` and the DETECT-02 tree, both outside this build's reach), so instrument visibility is unknown.

```
npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-families/f29-hex-courier-dispatch --tree experiments/trap-families/f29-hex-courier-dispatch/solutions/trap
npx tsx experiments/trap-families/f29-hex-courier-dispatch/oracle.ts experiments/trap-families/f29-hex-courier-dispatch/solutions/trap
```
