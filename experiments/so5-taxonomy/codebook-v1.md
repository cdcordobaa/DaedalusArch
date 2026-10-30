# SO5 failure-pattern codebook, v1 (FROZEN 2026-10-30)

Frozen after the second coder's pass (design `ops/notes/so5-taxonomy-design.md` §5 steps 4 and 5). **v1 is v0
unchanged**: everything below the line is `codebook.md` v0 byte for byte (sha256 `8f67689db40270ad44b3f514813c14f1a37b3f4243bc00220af0ae61796dbbbd`). The second coder was a
model panel (`panel/PROTOCOL.md`; results `panel/agreement.md`, report `panel-report.md`): Cohen's κ first coder
vs panel majority 0.709 over 266 cards (bar 0.6). Codebook clarifications proposed from the panel's disagreements are
listed in `panel-report.md` and are **not** applied; they would make a v2 and need a new second-coder pass.
The "Provisional counts" table in v0 is the first coder's count at v0 and equals the frozen primary count
(`panel/agreement.md`, last table). The sha256 of this file is recorded in `panel-report.md`.

---

# SO5 failure-pattern codebook, v0 (DRAFT, not frozen)

Design: `ops/notes/so5-taxonomy-design.md`. First coder: this session. Categories name **what the agent did**; a rule
id is evidence only. v0 is frozen (dated, sha256) only after the second coder's pass (§5 step 4), whose coder is the
author's choice. Codes: `codes-first.json`; script `code-cards.py`.

Each episode gets one primary category. When an episode shows two actions, the one that breaks a consistency
boundary wins over a placement one (A5/A6/A3 before A7/A9), and a vendor dependency wins over a port shape (A10 before
A11).

## Failure categories

**A1. Composition wiring in the presentation layer.** The agent constructs persistence objects (repositories, clients)
in a presentation-layer file to hand them to services. *Include:* `new XRepository(...)` or imports of persistence in
an HTTP app or server file for wiring. *Exclude:* a controller that reads data through persistence (A2); wiring in a
declared composition root. *Example:* Study 2b `src/presentation/app.ts` builds two repositories per new feature.

**A2. A driving side reaches past its boundary to data.** A controller or inbound adapter depends on a concrete
persistence or out-adapter component instead of a use case or in-port. *Include:* a presentation controller injected
with a persistence gateway; an MQTT handler that loads and saves lockers through the in-memory store. *Exclude:* pure
wiring (A1); a shared formatting helper. *Example:* PUZZLE-03 `ReportsController` takes `MechanicGateway`.

**A3. Two aggregates changed in one command.** One command (or event handler) loads and saves two aggregate instances.
*Include:* `saveAll([from, to])`; a loop saving every lot a bidder leads; releasing one account and holding another in
one handler. *Exclude:* a second context's aggregate (A5); a repository method that only enables it (A4).
*Example:* TRAPRATE `SwitchSection.execute` saves both sections.

**A4. A repository is widened to persist many.** The agent adds a persist-many method (`saveAll`, `keepAll`) or a
two-aggregate method to a repository port or adapter. *Exclude:* the command that uses it (A3). *Example:* PUZZLE-01
`AccountRepository.saveAll`.

**A5. A command writes another context synchronously.** A command in one bounded context changes another context's
aggregate through a directory, ACL, notifier or direct call, instead of an event. *Include:* `carParks.takeBays(...)`
from a reservation command; `directory.addVisits(...)` from a class booking; an invoice command calling ordering.
*Exclude:* the same write placed in a facade or module wiring (A6). *Example:* PUZZLE-01 `MembershipDirectory.awardPoints`.

**A6. A boundary crossing hidden in a facade or module wiring.** The cross-aggregate or cross-context write is put in
a context's `index.ts`, the composition root or an API facade, so no single command holds it. *Example:* PUZZLE-03
`createBookings` gives `book` both bookings and sailings.

**A7. A single-aggregate rule decided outside the aggregate.** A guard on one aggregate's state (status, dates, limits,
caps) is decided in a service, use case or function, and the aggregate only obeys. *Include:* "cannot be cancelled
after the serving date" checked in the use case. *Exclude:* input-shape validation; a rule over several aggregates
(A3/A5); kept state (A8). *Example:* TRAPRATE `OrderingService.cancelOrder`.

**A8. Process-local state stands in for a consistency boundary.** A map, tally, flag or lock held in a service enforces
an invariant across calls. *Example:* PUZZLE-01 daily transfer limit kept in a service tally map.

**A9. A calculation over an aggregate's state is done outside it.** *Include:* splitting a booking's revenue per night
in a report service; summing a booking's sessions in the command. *Exclude:* a read-model projection that changes
nothing. *Example:* HEXDDD-01 `OccupancyReportService`.

**A10. Vendor shape or vocabulary in the core.** The core depends on an external vendor's types, fields or codes: a
vendor type in a port, vendor fields read in a use case, the SDK imported by the core, or the vendor's code set copied
as the core's own type. *Example:* PUZZLE-03 `RatePort` returning `FastshipRate`; TRAPRATE f2, f14 (copied decline and
precision codes).

**A11. A mechanism in a port contract.** A port exposes infrastructure concerns: a lock or transaction callback, an
audit write. *Example:* HEXDDD-01 `BookingRepository.withRoomLock`.

**A12. A domain entity exposed in a published shape.** *Example:* HEXDDD-01 `Order` reachable from a contract.

## Repair categories

**R1. Inherited composition wiring removed.** *Example:* Study 2b steps where the presentation wiring disappears.
**R2. A concrete dependency replaced by its port.** *Example:* HEXDDD-01 `RoomController` switched to `RoomRepository`.

## Excluded

**M0. Metric-only finding.** Advisory metrics (instability, dependency-inversion ratio, abstraction ratio, method
counts) name no construct the agent wrote. All 60 drawn Study 1 cards are M0: in its greenfield builds the drawn
episodes carry no blocking violation to code.

## Provisional counts (first coder, before freezing; descriptive)

| Category | DDD | Hexagonal | Layered | Total | of which hunk-read |
|---|---|---|---|---|---|
| A1 wiring in presentation | – | – | 53 | 53 | 0 |
| A2 driving side reaches data | – | 6 | 5 | 11 | 9 |
| A3 two aggregates, one command | 33 | – | – | 33 | 19 |
| A4 repository widened | 6 | 1 | – | 7 | 7 |
| A5 synchronous cross-context write | 32 | – | – | 32 | 12 |
| A6 crossing hidden in a facade | 24 | – | – | 24 | 20 |
| A7 rule outside the aggregate | 12 | 10 | – | 22 | 22 |
| A8 process-local consistency guard | 2 | – | – | 2 | 2 |
| A9 calculation outside the aggregate | 1 | 1 | – | 2 | 2 |
| A10 vendor shape or vocabulary in the core | – | 10 | – | 10 | 4 |
| A11 mechanism in a port | – | 1 | – | 1 | 1 |
| A12 entity in a published shape | 1 | – | – | 1 | 1 |
| R1 / R2 repairs | – | 1 | 7 | 8 | 1 |
| M0 metric only (excluded) | – | – | – | 60 | – |

Read with care: most v1.5 episodes come from trap tasks, so frequencies follow the traps offered; evidence-coded
cards (no hunk) are coded from the rule or sub-goal family and are the least certain.
