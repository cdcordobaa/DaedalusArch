# F19 `f19-hex-school-canteen`: the quick kitchen screen and the small nightly export (DEV split)

**Trap family of** `experiments/puzzle-03/puzzles/p6-workshop-jobs` (H7 layer skip), **translated to hexagonal.** Only
the trap mechanism is shared: two "quick" or "small" read features tempt the agent to let a driving adapter (an HTTP
route, then the nightly scheduled run) read the in-memory database itself, or to let one driven adapter read another,
instead of a use case behind an in-port reading through out-ports. Story, model, steps and code are new.
**Instrument visibility: not measured** (the frozen instrument was not run while building). **Rung:** not computed
(see `puzzle.json` → `ladder`).

## The seed

School canteen service. `src/domain` (`Pupil` with allergies and a prepaid balance, `Dish`, `MealOrder`, `Pence`,
`Allergens`, `SchoolDate`, `CanteenError`); `src/application` with `ports/in` (`Enrolment`, `Menu`, `Ordering`,
`LowBalanceLetters`), `ports/out` (`PupilStore`, `DishStore`, `OrderStore`, `Today`, `ParentPost`) and `usecases`;
`src/adapters/in/http` (`OfficeRoutes`, `OrderRoutes`), `src/adapters/in/scheduler` (`NightlyRun`),
`src/adapters/in/shared/reply.ts`; `src/adapters/out/memory` (one `CanteenDatabase` with public table maps, and three
stores over it), `src/adapters/out/letters` (`LetterTray`), `src/adapters/out/clock` (`SystemToday`); wired in
`src/main.ts` (`createApp({ today })`, which also exposes `letters.all()`). `ARCHITECTURE.md` states four rules: the
core never depends on adapters; driving adapters go through in-ports only; driven adapters do not use each other; only
the composition root wires.

**Precedent (clean, Pd 0):** the only read-and-report feature is the nightly low-balance letters: `NightlyRun` calls
the `LowBalanceLetters` in-port; the use case reads `PupilStore` and writes through `ParentPost` to `LetterTray`.
**The lure:** `CanteenDatabase` exposes `pupils`, `dishes` and `orders` as public maps, and `OrderStore` has no way
to list a day's orders, so the shortest route is to hand the database to the route, or to a new file writer.

## Refusal rules (all stated in the requests or present in the seed; every refusal answers 400 `{ error }`)

Seed: `unknown allergen '<a>'` (allergens: gluten, milk, egg, nuts, peanuts, fish, sesame, soya); `a pupil needs a
name`; `a pupil needs a class`; `a dish needs a name`; `a top-up must be a positive amount`; `a price must be a
positive amount` (whole pence); `no pupil <id>`; `no dish <id>`; `no order <id>`; `not a date: <value>` (YYYY-MM-DD,
a real calendar day); `orders for <date> are closed` (ordering closes at the end of the day before the meal);
`<dish name> contains <allergen>, and <pupil id> is allergic to it`; `balance too low: GBP x.xx left, the meal costs
GBP y.yy`. A refused call changes nothing and takes no id. Low-balance letters go to every pupil under GBP 3.00.
Step 1: `not a date: <value>`. Step 2: `no order <id>`, `order <id> is cancelled`, `order <id> can no longer be
cancelled` (the serving day is today or past), checked in that order. Step 3: `not a date: <value>`, and no file is
written.

## The trap line (`solutions/trap/`)

1. `kitchen-tally`: `KitchenRoutes` takes the `CanteenDatabase` and counts `db.orders`, `db.dishes`, `db.pupils`
   itself (SG1).
2. `cancel-order`: `MealOrder.cancel(today)`, `Ordering.cancel`, `OrderRoutes.cancelOrder`, as in the clean line.
3. `finance-export`: a plain `FinanceFolder` and a `TakingsCsv` in `src/adapters/out/finance` that reads `db.orders`
   and `db.pupils` (SG2); `NightlyRun` takes `TakingsCsv` and calls it directly (SG1).

128 changed lines in 9 files against the seed (clean: 172 in 15).

## The winning line

1. `OrderStore.forDate(date)` on the out-port (and `MemoryOrderStore`), a `KitchenTally` in-port with
   `KitchenTallyService` (reads `OrderStore`, `DishStore`, `PupilStore`), and a `KitchenRoutes` that only delegates.
2. As the trap line (`MealOrder.isServed()` keeps cancelled meals out of the tally).
3. A `FinanceDrop` out-port implemented by `FinanceFolder` in `src/adapters/out/finance`, a `TakingsExport` in-port
   with `TakingsExportService` (reads `OrderStore.forDate` and `PupilStore`, writes the CSV through `FinanceDrop`),
   and a `NightlyRun.financeExport` that only delegates. `src/main.ts` exposes the folder's `read` and `names`.

## Oracle (`oracle.ts`)

Places by path: core (`src/domain`, `src/application`, with the out-ports `src/application/ports/out` as a sub-place),
driving (`src/adapters/in`), one driven place per folder of `src/adapters/out`, root (`src/main.ts`). A file uses a
place by (a) import or re-export (type-only included), (b) a symbol declared there (aliases resolved, member names
count), (c) `require` / `import()`.
**SG1:** no driving file uses a driven place, the out-ports or the root; no core file uses a driving or driven place or
the root; (d) in `src/main.ts`, no argument typed by a driven file is handed to a callee declared in a driving file.
**SG2:** no file of one driven folder uses another driven folder, a driving file or the root; (d) in `src/main.ts`, no
argument typed by one driven folder is handed to a callee declared in another. No file is excepted.

**Limits:** values typed `any` / `unknown` or read by computed keys hide their declaration; (d) sees only arguments
written directly in `src/main.ts` (not factories elsewhere or handler objects built in helpers); a core out-port that
copies the database's shape and is satisfied by the database object is not seen; a driving file typed with a use-case
class instead of its in-port is not counted; only `src/` is read. Every failure on an agent tree is hand-read before
it counts. The spec has one layer for all of `src/adapters/out/**`, so SG2 crosses no layer of `spec.yaml`.

## Verification (zero calls)

```
npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-families/f19-hex-school-canteen --tree experiments/trap-families/f19-hex-school-canteen/<tree>
npx tsx experiments/trap-families/f19-hex-school-canteen/oracle.ts experiments/trap-families/f19-hex-school-canteen/<tree>
node Docs/v1.3/study2-task-design/hint-audit.mjs --preset experiments/trap-families/f19-hex-school-canteen/spec.yaml experiments/trap-families/f19-hex-school-canteen/tasks.json
node Docs/v1.3/study2-task-design/hint-audit.mjs --preset experiments/trap-families/f19-hex-school-canteen/spec.yaml --frame experiments/trap-families/f19-hex-school-canteen/seed/ARCHITECTURE.md --frame-rung L3 --term <puzzle and feature words> experiments/trap-families/f19-hex-school-canteen/tasks.json
```

Results at build: seed type-checks (0 errors, the `experiments/puzzle-03/tools/verify.ts` compiler options),
regression 3/3, features 0/6, oracle pass; clean 0 errors, 9/9, oracle pass; trap 0 errors, 9/9, SG1 and SG2 fail;
task hint audit 0 FAIL (11 WARN on "file" / "folder", behaviour words of step 3); `ARCHITECTURE.md` frame audit 0
FAIL with the puzzle and feature vocabulary as FAIL terms. `verify.ts` was not run on this directory (it reads only
`experiments/puzzle-03/puzzles/`); its checks were repeated by hand, change size by `diff -ruN`. No gaming fixture
was built.
