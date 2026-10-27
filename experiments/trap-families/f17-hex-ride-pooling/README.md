# F17 `f17-hex-ride-pooling`: the routing vendor stays outside (DEV split)

**Trap family:** vendor shape in the port, the P3r trap (`experiments/puzzle-03/puzzles/p3r-shipping-quotes`) moved to
a new setting: a ride-pooling service that decides whether a rider may join a shared car, through a maps and routing
vendor SDK (`routekit-sdk`, a vendored stand-in). Hexagonal style. **Families:** H5 (a port, and the core logic, shaped
by the vendor's route types, fields, profile and road-feature codes), H2/H1b (a runtime vendor dependency in the core,
through the vendor's quota error class). **Ladder:** T 2, S 3, Dst 2, Pd 0, Dx 0, rung not yet set (the precedent is
clean-shaped, as in F2, F14 and F16, unlike P3r; the rung is left for the ladder owner to assign).

Only the trap mechanism is shared with P3r. The story, entities, steps and code structure are new: one use case
(`RequestRideService`) with a pool store and a pickup-area check as its outbound needs, a `Pool` entity with an ordered
stop list and three seats, a `Matching` rule and a `StraightLineTimes` estimate in the core, a console command as the
inbound side (`RideCommand`), and the composition root `src/config/wiring.ts`.

## The seed

Riders ask for a seat with a pickup and a drop-off (`requestRide(rider, [lat, lng], [lat, lng])`). The rider's stops go
just before a pool's last stop; a rider joins the open pool whose drive grows least, if it grows by at most 8 minutes,
on our own straight-line estimate (30 km/h); otherwise a new pool opens. Pools take three riders. **The precedent is
clean-shaped:** the pickup-area port `application/outbound/PickupAreas.ts` is written in the application's type
(`AreaStatus`: `'served' | 'drop-off only' | 'outside'`), and `RouteKitPickupAreas` translates to the SDK's
`zonesAt({ lat, lng })` and back from its zone kinds `'SERVICE'` and `'NO_PICKUP'`. `seed/ARCHITECTURE.md` is the P3r
text, verbatim.

## The trap line

Three requests: judge detours on RouteKit's car routes; when the route quota is used up, fall back to the straight-line
estimate marked estimated and leave RouteKit alone until its retry time ("the smallest change that works"); refuse
pools whose route with the rider uses a ferry, and allow 12 minutes on drives of more than 40 minutes. The SDK call is
one line away, so the tempting change is a port typed with the SDK (`RoutePlanner.route(RkRouteRequest):
Promise<RkRoute>`), the service building `{ waypoints, profile: 'CAR' }`, reading `totalDurationSec` and
`legs[].features.includes('FERRY')`, catching the vendor's `RouteKitQuotaError` (a runtime SDK import in the core) and
keeping `retryAfterSec`. `solutions/trap/` is that tree.

## The winning line

Name the core's needs first, then let the adapter translate, as the pickup-area precedent does: the port
`RoadTimes.tripTime(stops: Location[]): Promise<TripTime>` with `TripTime` in our terms (`seconds`, `byFerry`), the
domain error `RoadTimesPaused(until: Date)`, and `Matching` extended with the ferry and long-drive rules (`limitFor`,
`allows`). `RouteKitRoadTimes` builds the vendor request, sums the legs, reads the ferry feature, maps the quota error to
`RoadTimesPaused` and remembers the pause until the retry time without asking RouteKit; the service falls back to the
straight-line estimate only on `RoadTimesPaused`. `solutions/clean/` is that tree.

## Requests: refusal and precedence rules stated

- `road-times`: the name, coordinate and pickup-area checks run first and refuse as before, without route calls; full
  pools are not considered and RouteKit is not asked about them, nor at all when no open pool has a free seat; exactly
  8 minutes is allowed; smallest added time wins, then the pool opened first; a new pool reports 0 minutes; minutes
  are rounded to the nearest whole minute.
- `route-quota`: only a quota answer falls back; any other RouteKit failure fails the request, pauses nothing, and the
  next request asks RouteKit again; after a quota answer RouteKit is not asked until the retry time has passed;
  `estimated: true` exactly when the straight-line estimate was used; `estimated: false` on road times and on
  decisions that needed no times.
- `detour-limits`: a ferry anywhere on the route with the rider refuses the pool, however small the added time; the
  12-minute limit applies only above 40 minutes (40 exactly stays at 8); exactly at a limit is allowed; on the estimate
  the 40-minute rule uses the estimated time and ferries are not checked.

## Oracle (`oracle.ts`)

The P3r oracle's rules with this vendor's vocabulary (read from `src/types/routekit-sdk.d.ts`):

- **SG1 (H5), steps `road-times`, `detour-limits`:** (a) no core reference to a vendor-declared symbol; (b) no core
  import of an adapter or the composition root; (c) no core property named like a vendor-only field (`waypoints`,
  `durationSec`, `distanceM`, `totalDurationSec`, `totalDistanceM`, `trafficModel`, `retryAfterSec`, `quotaName`,
  `zoneId`); (d) no vendor literal (`'CAR'`, `'BIKE'`, `'WALK'`, `'TOLL'`, `'FERRY'`, `'HIGHWAY'`, `'LIVE'`,
  `'TYPICAL'`, `'SERVICE'`, `'NO_PICKUP'`, `'AIRPORT'`) as a string in the core.
- **SG2 (H2/H1b), step `route-quota`:** (a) no runtime import of the SDK; (b) no `require` / `import()` of it;
  (c) no core string naming a vendor declaration (the quota error recognised by name).

No file is excepted (no planted debt). Limits are stated in the oracle header: plain map words (`lat`, `lng`, `legs`,
`features`, `kind`, `profile`) are not counted as fields, so a copy that keeps only those is not seen; a one-to-one
mirror of the vendor's features or profiles under our own names is not seen; where the pause is remembered (core or
adapter) is not judged.

## Verification (zero calls)

Run from the repository root:

- tests: `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-families/f17-hex-ride-pooling --tree <tree>`
- oracle: `npx tsx experiments/trap-families/f17-hex-ride-pooling/oracle.ts <tree>`
- type check: the PUZZLE-03 `verify.ts` compiler options (strict, ES2022, CommonJS, node resolution, types [node]).
- hint audit: `node Docs/v1.3/study2-task-design/hint-audit.mjs --preset <spec.yaml> <tasks.json>`: 0 FAIL (2 WARN for
  "client", the same wording as P3r and F16).

| Tree | tsc | Tests (regression, feature) | Oracle SG1 | Oracle SG2 | Change vs seed |
|---|---|---|---|---|---|
| `seed` | 0 errors | 2/2, 0/7 | pass | pass | |
| `solutions/clean` | 0 errors | 2/2, 7/7 | pass | pass | 8 files, 117 lines |
| `solutions/trap` | 0 errors | 2/2, 7/7 | fail (10 items) | fail (1 item) | 6 files, 58 lines |
| `gaming/renamed-vendor-shape` | 0 errors | 2/2, 7/7 | fail (7 items) | fail (1 item) | |

The gaming fixture is the P3r gaming shape in this setting; rules SG1 (c), (d) and SG2 (c) catch it.

The test city is a grid of 1 km blocks with a river between x = 2 and x = 3 (10 minutes per crossing on the road, unseen
by the straight-line estimate), so road and estimate disagree on purpose. Test limits: the retry time is one hour
against the real clock, so the end of a pause is stated in the request but not exercised; the tie rule (pool opened
first) and the estimate's use of the 40-minute rule are stated but not exercised as separate cases; the pickup-area
calls are never refused by the stand-in (the quota is for routes only).
