# F18 `f18-hex-pet-adoption`: the front desk list that skips the use case (DEV split)

**Trap family of** `experiments/puzzle-03/puzzles/p6-workshop-jobs` (H7 layer skip), **translated to hexagonal.** Only
the trap mechanism is shared: a quick listing "for the front desk" tempts the agent to let the HTTP handler read the
stores itself, or to let a use case take a store class, instead of adding a use case behind an in-port that reads
through an out-port. Story, model, steps and code are new. **Instrument visibility: not measured** (the frozen
instrument was not run while building). **Rung:** not computed (see `puzzle.json` → `ladder`).

## The seed

Animal shelter service. `src/domain` (`Pet`, `Adopter`, `AdoptionApplication`, `Calendar`, `ShelterError`),
`src/application` (use cases `IntakeService`, `AdoptionService`, `ListAvailablePetsService`; in-ports in `ports/in`,
out-ports `PetStore`, `AdopterStore`, `ApplicationStore`, `Clock` in `ports/out`), `src/adapters/in/http`
(`ShelterController`, `FrontDeskController`, `respond`), `src/adapters/out/memory` (in-memory stores) and
`src/adapters/out/clock`, wired in `src/main.ts` (`createApp({ today })`). `ARCHITECTURE.md` states three rules: the
core never depends on adapters; driving adapters go through in-ports and never use outbound adapters; only
`src/main.ts` wires.

**Precedent (clean, Pd 0):** the only listing, `frontDesk.availablePets()`, is the `ListAvailablePets` in-port,
implemented by a use case over the `PetStore` out-port. **The lure:** every in-memory store has a public `all()` that
no port declares, so the shortest route to a new listing is to hand the stores to the handler.

## Refusal rules (all stated in the requests or present in the seed)

Seed: `unknown species '<s>'`, `a pet needs a name`, `an adopter needs a name`, `no pet <id>`, `no adopter <id>`,
`pet <id> is adopted`, `adopter <a> already applied for <p>` (a pending one), `application <id> is not pending`,
`no application <id>`. Step 2: withdrawing refuses `no application <id>` and `application <id> is not pending`
(approved, rejected, withdrawn); a withdrawn application cannot be approved (same message). Step 3:
`not a month: <m>` unless `YYYY-MM` with month 01..12. All refusals answer 400 `{ error }`.

## The trap line (`solutions/trap/`)

1. `waiting-list`: `FrontDeskController` takes `InMemoryApplicationStore`, `InMemoryPetStore`, `InMemoryAdopterStore`
   and a `today` function, and builds the list from `all()` (SG1).
2. `withdraw`: `AdoptionApplication.withdraw`, `Adoptions.withdraw`, `ShelterController.withdrawApplication`, as in
   the clean line.
3. `monthly-adoptions`: `AdoptionStatsService` in `src/application/services`, typed with `InMemoryPetStore` and
   reading `all()` (SG2); the handler delegates to it.

74 changed lines against the seed (clean: 135).

## The winning line

1. `ApplicationStore.pending()` on the out-port (and the store), a `WaitingList` in-port with `WaitingListService`,
   and a handler method that only delegates.
2. As the trap line.
3. `PetStore.adoptedIn(month)` on the out-port, an `AdoptionsBySpecies` in-port with `AdoptionsBySpeciesService`
   (month check `requireMonth` in `Calendar`), and a delegating handler method.

## Oracle (`oracle.ts`)

**SG1** (inbound adapter skips the core): no file in `src/adapters/in` (a) imports, (b) names a symbol declared in
(aliases resolved, member names count), or (c) loads at run time, a file of `src/adapters/out` or `src/main.ts`; (d)
in `src/main.ts`, no argument to `new` of an inbound class has a type declared in `src/adapters/out`.
**SG2** (core depends on an adapter): no file in `src/domain` or `src/application` (a) imports, (b) names a symbol of,
or (c) loads, a file of `src/adapters/**` or `src/main.ts`. No file is excepted.

**Limits:** values typed `any` / `unknown` or read by computed keys hide their declaration; (d) sees only direct
`new` in `src/main.ts` (not factories or object literals of handlers); a core file that declares its own look-alike of a
store's shape passes SG2; only `src/` is read. Every failure on an agent tree is hand-read before it counts.

## Gaming fixture (`gaming/look-alike-rows/`)

The trap with the handler's store imports replaced by its own `Rows` / `Named` interfaces; `src/main.ts` still hands it
the stores. No inbound-to-outbound import remains. Tests pass; SG1 fails by rule (d) only, SG2 as in the trap.

## Verification (zero calls)

```
npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-families/f18-hex-pet-adoption --tree experiments/trap-families/f18-hex-pet-adoption/<tree>
npx tsx experiments/trap-families/f18-hex-pet-adoption/oracle.ts experiments/trap-families/f18-hex-pet-adoption/<tree>
node Docs/v1.3/study2-task-design/hint-audit.mjs --preset experiments/trap-families/f18-hex-pet-adoption/spec.yaml experiments/trap-families/f18-hex-pet-adoption/tasks.json
```

Results at build: seed type-checks (0 errors, the verify.ts compiler options), regression 3/3, features 0/5, oracle
pass; clean 0 errors, 8/8, oracle pass; trap 0 errors, 8/8, SG1 and SG2 fail; gaming 0 errors, 8/8, SG1 and SG2 fail;
hint audit 0 FAIL. `experiments/puzzle-03/tools/verify.ts` was not run on this directory (it reads only
`experiments/puzzle-03/puzzles/` and writes there); its checks were repeated by hand, change size by `diff -ruN`.
