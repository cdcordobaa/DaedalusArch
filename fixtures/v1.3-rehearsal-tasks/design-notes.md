# Design notes for the rehearsal tasks (author only; never shown to the agent)

Written with `Docs/v1.3/study2-task-design.md`. Each step names the **pressure kind** (guide §2), the **cheapest
shortcut** a time-pressed developer would take, and the **blocking-tier edge** that shortcut creates under the style's
tiers (`Docs/v1.3/rule-tiers.md`). As in `pilot-tasks.md` §4, the last column is a planning guess, not an outcome, and
nothing is scored against it.

Design rule carried from the floor probe (`Docs/DiagnosticRuns/v1.3-floor-probe-2026-10-16.md` §3.3, §5.2): every
later step is aimed at an edge that is **blocking in this style**, and no step relies on a reporting shortcut that is
only advisory in it. Each step's pressure comes from *where the information or the effect lives* (a header, a provider
payload, a runtime switch, a sender another feature already built), not from wording.

## `repair-cafe` (Hexagonal)

| Step | Pressure kind | Cheapest shortcut | Blocking edge (hexagonal) |
|---|---|---|---|
| 1 intake-and-repairs | first outbound integration | The "finish item" logic calls the TextLoop client it was written next to; the 160-character cut lives in the item. | application → outbound adapter (FF-S01 dependency-direction-graph); outbound client with no port (port-adapter-pattern). |
| 2 spare-parts | reuse of an existing sender across features; second outbound integration | "Sent the same way as the ready message" → the new parts flow imports whatever step 1 used, including a concrete client; the SpareBox search is called from the parts logic. | application → outbound (FF-S01) if step 1 had no port; SpareBox client with no port. If step 1 made a port, the reuse goes through it and nothing fires: the step then measures erosion only in the runs that already eroded, which is the outcome's point. |
| 3 signed-in-fixers | a core rule needs request data | The venue and category check needs `X-Fixer-Id` and `X-Venue`; the shortest path passes the framework request (or a request-context module from the inbound side) into the rule. | domain → framework package (FF-P01 domain-purity); application → inbound (FF-S01). |
| 4 text-outage-fix | time-pressure fix + runtime switch + new infrastructure (retry timer) | A mutable on/off flag exported by the composition root and read by the finish logic; the retry timer started inside the logic with the concrete client. | application or inbound → `config` (FF-S01; floor probe §3.6 case e); application → outbound (FF-S01). |
| 5 council-upload | new infrastructure (scheduled upload, retry) + cross-cutting report | The quarterly logic builds the CSV and posts it with an HTTP client it imports directly. | application → outbound (FF-S01). The report itself is advisory in hexagonal (layer-skip-graph); it is here for realism, not as the floor-lifter. |

## `school-bus` (Clean Architecture)

| Step | Pressure kind | Cheapest shortcut | Blocking edge (clean) |
|---|---|---|---|
| 1 routes-and-positions | first inbound integration | The estimate logic reads the stores directly instead of through a declared store contract. | application → infrastructure (FF-S01); store without a contract in the inner ring (FF-P03 repository-pattern). |
| 2 delay-alerts | outbound integration triggered by inbound data; cross-feature | The position-recording logic calls the fake mailer; the alert logic and the trip logic call each other (cancel → alert, alert → trip state). | application → infrastructure (FF-S01); a cycle between the two feature files (FF-S02). |
| 3 boarding-and-push | second sender + per-user channel choice + a time-based check | `if (channel === 'push')` with both concrete senders imported in the logic; the "not tapped on by arrival" check run from the position handler. | application → infrastructure (FF-S01); concrete classes injected through constructors of inner classes (FF-P06, constructor half). |
| 4 clock-skew-fix | time-pressure fix + per-route runtime mute | A module-level mute map in the outer ring, read by the alert logic. | application → infrastructure (FF-S01). |
| 5 audit-and-punctuality | across every layer (actor from a header, atomic change + record) + report | The staff id read from the framework request inside the logic; the "saved together" rule implemented by importing the concrete in-memory stores. | domain/application → framework (FF-P01, FF-S04 no-domain-outward-dep); application → infrastructure (FF-S01). |

## `vineyard-harvest` (DDD; contexts `src/picking/`, `src/cellar/`)

| Step | Pressure kind | Cheapest shortcut | Blocking edge (DDD) |
|---|---|---|---|
| 1 picking-and-intake | two contexts from step 1; first inbound integration | The cellar's acceptance check imports picking's bin type and store to see whether the bin was recorded. | cross-context import outside the public API or ACL (DDD bounded-context isolation, FF-DS02). |
| 2 picker-pay | cross-context data flow in the other direction | Pay reads the cellar's accepted weights directly; bin-type tare kept as a mutable object. | FF-DS02; value-object immutability (FF-DT03) if the weight or tare object has setters. |
| 3 second-weighbridge | second inbound integration (polling) | The poller and the RFID link placed in the cellar's domain, beside the weighing; a `site` switch in the weighing object. | framework or HTTP code in the domain (FF-DT04). |
| 4 double-weighing-fix | time-pressure fix that touches an aggregate's insides and a past aggregate | The fix edits a stored weighing through a reference held outside the bin; pay recalculation reaches into the cellar again. | aggregate boundary (FF-DT01); FF-DS02. |
| 5 harvest-dashboard | cross-context report + shared identifiers | A `shared/` folder with block, variety and tag types used by both contexts; the dashboard imports both contexts' stores. | FF-DS02 (blocking). A folder outside every declared context is FF-DS01; check its tier in the DDD library notes before counting it. |

## `ice-rink` (Layered; spare, see README)

| Step | Pressure kind | Cheapest shortcut | Blocking edge (layered) |
|---|---|---|---|
| 1 sessions-and-hire | first integration | Record types defined in `business`, imported by the stores; the HTTP entry file builds the stores and the PuckPay client. | persistence → business (FF-S01, and again FF-S03); presentation → persistence (FF-S03, blocking only in layered). These are the step-1 habits the floor probe saw. |
| 2 club-ice-time | cross-feature reuse of the capacity rule | Club logic reads public-session stores directly from its routes. | presentation → persistence (FF-S03). |
| 3 ice-sensors | new inbound integration + new sender + refunds through an existing client | The sensor webhook route decides the hold and calls the store and DropText itself. | presentation → persistence (FF-S03). |
| 4 oversell-fix | time-pressure fix on a race | A lock or "reserved" counter added in the route that reads and writes the store. | presentation → persistence (FF-S03). |
| 5 weekly-report | report that "has to answer quickly" | The report route queries every store in one go. | presentation → persistence (FF-S03). |

Layered's known problem (floor probe §4): its violations are mostly a step-1 level. Steps 2–5 here aim at **new**
presentation → persistence edges, which a repaired step 1 does not prevent, so a `gate` repair at step 1 does not
remove the later pressure. FF-S03 counts each upward edge twice (probe §3.7.3): count distinct violating edges.
