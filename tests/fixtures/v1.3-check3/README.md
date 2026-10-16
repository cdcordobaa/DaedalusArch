# CHECK-3 layered bases (judge evaluation, rebuilt clean controls)

CHECK-3 is CHECK-2 (`tests/fixtures/v1.3-check2/`) with the six layered bases rebuilt so that the clean base and the twin carry no repository bypass. Plan and decision rule: `Docs/v1.3/judge-check3-plan.md`. What changed and why: `Docs/DiagnosticRuns/v1.3-judge-check3-bases-2026-10-16.md`.

**The CHECK-2 defect.** Every CHECK-2 layered base had one business service that held the persistence layer's `PrismaService` and called `prisma.<model>.create/findMany` itself, next to services that go through gateways. The service was there on purpose: it is the only shape on which `AP-REPO-BYPASS` places a site in closed layering. But it made every clean FF-N01 business unit a bypass already, so every judge failed it, and the REPO-BYPASS seeds and twins on those bases were not attributable (`Docs/DiagnosticRuns/v1.3-judge-v22-check2-2026-10-16.md` §0, §3).

**What is different here.** Only these six bases, and in each only the one service and its wiring:

| Base | Service | New persistence class |
|---|---|---|
| `layered-library` | `LoanHistoryService` | `LoanEventGateway` |
| `layered-clinic` | `VisitNotesService` | `VisitNoteDao` (+ `rows/VisitNoteRow.ts`) |
| `layered-fleet` | `MileageService` | `MileageTable` (+ `MileageRecord` in `records/index.ts`) |
| `layered-ticketing` | `GateLog` | `ScanStore` (+ `schema/ScanData.ts`) |
| `layered-payroll` | `PayrollAuditService` | `PayrollAuditRepository` |
| `layered-warehouse` | `CycleCountService` | `tables/StockCountTable` |

- The service now injects the new persistence class, as the base's other services do, and keeps its class name, method names, signatures and behaviour. `main.ts` wires the new class. The new persistence class follows the naming and file layout of the base's other persistence classes.
- `seed-overlay/` holds the CHECK-2 version of the service and of `main.ts`, byte for byte. It is used **only** to build the `AP-REPO-BYPASS` seed: the seeder lays it over a copy of the base, draws the site there and applies the unchanged operator. The `AP-REPO-BYPASSn` twin is applied to the clean base, on the same class and method, to the gateway field. So the bypass exists only in the seeded variant.
- `spec.yaml` and `seed-spec.yaml` are unchanged. The sources still carry no comment.

The four non-layered bases (`clean-subscriptions`, `nestjs-courses`, `hexagonal-parking`, `ddd-insurance`) are not copied: CHECK-3 reads them from `tests/fixtures/v1.3-check2/`, unchanged.

Regenerate: `npx tsx scripts/v1.3/judge-v22-check2.ts seed --set check3 --out <work>`. Static check: `npx tsx scripts/v1.3/judge-check3-selfcheck.ts`.
