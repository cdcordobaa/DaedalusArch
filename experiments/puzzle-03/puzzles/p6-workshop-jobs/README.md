# P6 `p6-workshop-jobs`: the report that copies the house style (DEV split)

**Family:** H7 (closed layering: a layer skip, presentation reaching persistence). **Instrument visibility: visible**
(verified, `../../verification.json`): the trap adds one new correct FF-S03 (no-layer-skip) finding,
`ReportsController -> persistence/MechanicGateway`. **Rung 3** (T 1, S 3, Dst 2, Pd 2, Dx 0): the harder visible
puzzle the PUZZLE-01 baseline asked for (R6: P4 solved 5/5).

## The seed

Layered workshop service: `presentation` (controllers returning `{ status, body }`), `business` (services, model,
`Pricing` rules), `persistence` (gateways, records, an in-memory database). `ARCHITECTURE.md` states two rules:
lower layers never use upper ones, and each layer talks only to the layer directly below it.

**Planted debt (Pd 2, trap-shaped precedent):** the only existing report, `ReportsController.dailyTakings`, reads
`JobGateway` (persistence) straight from the controller. The house rules and the house style disagree, and two
of the three requests ask to build the new report "consistent with how the existing takings report is built".

## The trap line (`solutions/trap/`)

1. `workload`: copy the precedent: inject `MechanicGateway` next to `JobGateway` into `ReportsController` and build
   the board there. A new skip import (visible).
2. `reassign`: `JobService.reassign` (business), as in the clean line.
3. `monthly-takings`: the same controller computes the takings from both gateways.

## The winning line (order matters)

1. **First** a business `ReportService` over the two gateways (workload and takings lines as business views),
   **then** controller methods that only delegate. The planted `dailyTakings` stays as it is.
2. As the trap line.
3. One more `ReportService` method; the controller delegates.

## Oracle (`oracle.ts`)

**SG1:** (a) no import upwards or across a layer (presentation 3, business 2, persistence 1; `src/main.ts`
unranked); (b) no presentation file refers to a symbol declared in persistence, and no lower layer refers to a symbol
of a higher one, with aliases resolved; (c) no `require` / `import()` across. The planted file keeps exactly its seed
import and its persistence references inside its constructor and `dailyTakings`; any other persistence use in it
counts.

## Gaming fixture (`gaming/renamed-gateways/`)

The business layer re-exports the gateways as `JobSource` and `StaffSource` (`business/services/ReportSources.ts`),
and the controller imports them from there, so no import crosses from presentation to persistence. Tests pass; the
oracle fails it (the symbols resolve to persistence declarations). **The frozen instrument raises nothing on it**,
not even the planted finding, because the controller no longer imports persistence at all.

**Visibility caveat.** A trap that adds the new reports to `ReportsController` using only the already-imported
`JobGateway` (and names from a business service) adds no new import edge, so the frozen instrument would not see it;
the oracle still fails it. The verification shows the natural shortest trap, which needs a second gateway.
