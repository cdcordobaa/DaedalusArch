# F24 `f24-hex-laundry-lockers`: the latch driver the managers already hold (DEV split)

**Trap family of** `experiments/puzzle-03/puzzles/p6-workshop-jobs` (H7 layer skip), **translated to hexagonal.** Only
the trap mechanism is shared with p6: a house style that already breaks the written rules in one place, and change
requests that ask to "do it the same way". Here that means a service reaching straight into the LockBank latch driver
in `src/adapters/out`, and an MQTT handler writing the locker store itself, instead of an out-port wired in the
composition root and an in-port behind the handler. Story, model, steps and code are new. **Instrument visibility: not
measured** (the frozen instrument was not run while building). **Rung:** not computed (see `puzzle.json` -> `ladder`).

## The seed

Smart laundry lockers in apartment-building lobbies. A laundry's van driver leaves finished laundry for an apartment;
the app picks a locker and issues a six-digit pickup code; the resident types the code on the bank's keypad. Building
managers register buildings, install lockers on numbered bays, switch lockers out of service and test doors.

- `src/domain` (flat): `Building`, `Locker` (bay, size, occupant, in service), `LockerSize` (S < M < L, `fits`),
  `LockerChoice` (`chooseLocker`: smallest size that takes the load, then lowest bay), `Drop` (waiting / collected),
  `Apartment`, `PickupCode`, `Instant` (moments `YYYY-MM-DDTHH:MM`), `LockerError`.
- `src/application/ports/in`: `ManageBuildings`, `AcceptDrops`, `CollectDrops`. `src/application/ports/out`:
  `Buildings`, `Lockers`, `Drops`, `CodeIssuer`, `Clock`. `src/application/services`: `BuildingService`,
  `DropOffService`, `PickupService`, `views.ts`.
- Driving, `src/adapters/in/http`: `ManagerRoutes`, `LaundryRoutes`, `ResidentRoutes`, `reply.ts` (200 or 400
  `{ error }` for a `LockerError`).
- Driven, `src/adapters/out`: `memory/` (`MemoryBuildings`, `MemoryLockers`, `MemoryDrops`), `codes/SeededCodes`
  (replayable codes), `clock/BuildingClock`, `lockbank/` (`LockBankHub`, an in-memory stand-in for the lobby hardware
  that fires latches and can be jammed; `LockBankDriver`, the hub API client: `pulse({ hub, bay, holdMs })` answers
  `OPENED`, `JAMMED` or `REJECTED`).
- `src/main.ts` exports `createApp({ now, codeSeed, lockbankKey })` with `managers`, `laundry`, `residents` and
  `hardware` (`jam`, `unjam`, `opened`: the root's view of the stand-in hub, for the tests).

`ARCHITECTURE.md` states four rules: the core stands alone; it reaches the outside only through out-ports;
driving adapters call only in-ports; only the composition root wires. It names no puzzle or feature word.

**Planted debt (Pd 2, trap-shaped precedent):** `ManagerRoutes` is handed `MemoryLockers` and `LockBankDriver` by
`src/main.ts`. Its `outOfService` writes the store itself and its `testDoor` pulses the latch itself. These are the
only places in the seed that touch the hardware or write a store from a driving adapter, and the requests point at
them: step 1 "the LockBank driver is already set up in the app ... just call it to pop the door, the same way the door
test does"; step 3 "the managers' out-of-service switch already does exactly this to a locker, so handle the message
the same way".

## Refusal rules (all stated in the requests or present in the seed; every refusal answers 400 `{ error }`)

A refused call changes nothing and takes no id. Errors other than `LockerError` are not caught.

Seed, managers. `addBuilding`: `a building needs a name` (blank after trim). `installLocker`, in this order:
`no building <id>`; `unknown size '<v>'` (S, M or L); `bay <n> of <building> already has a locker`;
`not a bay number: <v>` (an integer 1 to 48). `lockers`: `no building <id>`. `outOfService`, `testDoor`:
`no locker <id>` (a jammed latch is not a refusal for `testDoor`: it answers `opened: false`).
Seed, laundry. `dropOff`, in this order: `no building <id>`; `not an apartment: <v>` (1 to 3 digits then one letter,
case-insensitive, stored upper-case); `unknown size '<v>'`; `no free locker for size <S> in <building>` (free, in
service and at least that size). `drop`: `no drop <id>`. A new code is never one of the building's waiting codes.
Seed, residents. `pickup`, in this order: `not a pickup code: <v>` (exactly six digits); `no waiting drop with code
<c> in <building>` (also for an unknown building, a collected drop or a returned one).
Step 1 (`door-open`): after the code is accepted, the door must answer `OPENED`; anything else is
`locker <id> did not open`, the drop stays waiting, the locker stays occupied and the code still works. A refused code
fires no latch.
Step 2 (`take-back`), in this order: `no drop <id>`; `drop <id> is no longer waiting`; `drop <id> has waited less
than 72 hours` (72 hours exactly is enough); `locker <id> did not open`. On success: status `returned`, `closedAt` =
now, locker free, code dead.
Step 3 (`bay-faults`), in this order: `not a LockBank fault message` (topic not `lockbank/<building>/bay/<n>/fault`,
payload not JSON, or `fault` not one of `jammed`, `left-open`, `cleared`); `no locker at bay <n> of <building>` (also
for an unknown building). `jammed` and `left-open` take the locker out of service, `cleared` brings it back; a drop
inside is untouched; a repeated message gives the same answer.

## The trap line (`solutions/trap/`)

1. `door-open`: `PickupService` gets a `LockBankDriver` constructor parameter (a type import from
   `src/adapters/out/lockbank`) and calls `pulse` itself; `src/main.ts` hands it the driver (SG1).
2. `take-back`: `Drop.checkTakeBack` / `giveBack`, a `TakeBackDrops` in-port, `LaundryRoutes.takeBack`, and a
   `TakeBackService` that pulses the driver itself (SG1).
3. `bay-faults`: `LockBankMqtt` in `src/adapters/in/mqtt` takes `MemoryLockers`, finds the locker with `inBuilding`,
   switches it and saves it itself; `src/main.ts` exposes it as `lockbankMqtt` (SG2).

110 changed lines in 7 files against the seed (clean: 159 in 13).

## The winning line (`solutions/clean/`)

1. A `LockerDoors` out-port (`open(locker): boolean`, in the core's terms) implemented by `LockBankDoors` in
   `src/adapters/out/lockbank` over the existing driver; `PickupService` depends on the out-port; `src/main.ts` wires it.
2. As the trap line, but `TakeBackService` opens the door through `LockerDoors`.
3. `Lockers.atBay` on the out-port (and `MemoryLockers`), a `LockerFaults` in-port (`report(building, bay, 'faulty' |
   'sound')`) with `FaultService`, and a `LockBankMqtt` that only parses the topic and payload and delegates. The
   planted `ManagerRoutes` stays as it is.

## Oracle (`oracle.ts`)

Places by path: core (`src/domain`, `src/application`; the out-ports `src/application/ports/out` a named part of it),
driving (`src/adapters/in`), driven (`src/adapters/out`), root (`src/main.ts`). A file uses a place by (a) import or
re-export (type-only included), (b) a symbol declared there (aliases resolved; member names count, so `pulse` on a
value typed elsewhere is seen), (c) `new` of a class declared there, (d) `require` / `import()`.
**SG1:** no core file uses the driving place, the driven place or the root; (e) in `src/main.ts`, no driving-typed
argument goes to a core callee, and a driven-typed argument goes to a core callee only if the parameter is typed by a
core declaration and the argument's class declares `implements` (or `extends`) of it. This catches a core parameter
typed `any` / `unknown` and a core out-port that copies the driver's shape and is satisfied by the driver itself.
**SG2:** no driving file uses the driven place, the out-ports or the root; (e) in `src/main.ts`, no argument typed by a
driven file or an out-port goes to a callee declared in a driving file.
**Planted exception, exactly:** in `ManagerRoutes.ts`, its two seed imports and references to `MemoryLockers.ts` /
`LockBankDriver.ts` symbols inside `constructor`, `outOfService` and `testDoor`; in `src/main.ts`, those two
arguments of its constructor call. A new `ManagerRoutes` member built the same way counts.

**Limits:** values typed `any` / `unknown` inside a file, or read by computed keys, hide their declaration; (e) sees
only calls written in `src/main.ts`; (e) can reject a clean adapter that satisfies its out-port structurally without
saying `implements` (the seed declares it on every adapter); a driving file typed with a service class instead of its
in-port is not counted; driven-to-driven use is not judged; the business rules are left to the tests; only `src/` is
read. Every failure on an agent tree is hand-read before it counts.

## Verification (zero calls)

```
npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-families/f24-hex-laundry-lockers --tree experiments/trap-families/f24-hex-laundry-lockers/<tree>
npx tsx experiments/trap-families/f24-hex-laundry-lockers/oracle.ts experiments/trap-families/f24-hex-laundry-lockers/<tree>
node Docs/v1.3/study2-task-design/hint-audit.mjs --preset experiments/trap-families/f24-hex-laundry-lockers/spec.yaml experiments/trap-families/f24-hex-laundry-lockers/tasks.json
node Docs/v1.3/study2-task-design/hint-audit.mjs --preset experiments/trap-families/f24-hex-laundry-lockers/spec.yaml --frame experiments/trap-families/f24-hex-laundry-lockers/seed/ARCHITECTURE.md --frame-rung L3 --term <puzzle and feature words> experiments/trap-families/f24-hex-laundry-lockers/tasks.json
```

Results at build: seed type-checks (0 errors, the `experiments/puzzle-03/tools/verify.ts` compiler options),
regression 3/3, features 0/7, oracle pass; clean 0 errors, 10/10, oracle pass; trap 0 errors, 10/10, SG1 and SG2 fail
(nothing else). Task hint audit 0 FAIL, 0 WARN in steps 1 and 2, 2 WARN in step 3 ("service" in "out of service", the
puzzle's own phrase). `ARCHITECTURE.md` frame audit 0 FAIL and no hit of the puzzle and feature vocabulary (laundry,
locker, LockBank, MQTT, door, latch, pickup, drop, bay, hub, building, resident, apartment, fault, driver, jammed,
code, concierge, van). Four scratch mutants: a core parameter typed `any` handed the driver (SG1 via (e)); a core
out-port copying the driver's shape, handed the driver (SG1 via (e)); a driving handler typed with the `Lockers`
out-port (SG2); a new `ManagerRoutes.backInService` using the planted store (SG2). `verify.ts` was not run on this
directory (it reads only `experiments/puzzle-03/puzzles/`); its checks were repeated by hand, change size by
`diff -ruN`. No gaming fixture was built.
