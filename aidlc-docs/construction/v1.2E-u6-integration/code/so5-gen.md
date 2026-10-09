# U6 lane SO5-gen (ADR-021)

**Date**: 2026-10-08. **Branch**: `v1.2e-u6-so5gen`. **Findings closed**: SO5-03, THR-8, SO5-04, SO5-05, SO5-08 (`Docs/DiagnosticRuns/so-readiness-audit-2026-10-08.json`). No live LLM call, no generation, no E1/E7/SO4 or labelling run.

## What changed

| Finding | Change |
|---|---|
| THR-8, SO5-03 (plan) | `experiments/e1-grid/generator-plan.json` is committed: adapters `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-4-5` (schedule order), both tasks, three levels, `runs` 3, `orderSeed` 20261008, `outRoot` `../daedalus-e1-outcomes`, `timeoutMs` 1 200 000, `allowBash` true. `binary` and `harnessRoot` are `"<local>"`, and `generate-projects.ts --binary --harness-root` fills them. The file pattern is in `REGISTERED_ARTEFACTS` (`scripts/lib/prereg.ts`). `corpus/prereg.json` is not touched. |
| SO5-03 (generator check) | `guardE1Plan` (`scripts/lib/generators/registered-plan.ts`) runs in `generate-main`. A grid whose `outRoot` lies in the E1 root (the grid or its pilot) must start from the registered file, every frozen field must match, and once `corpus/prereg.json` lists the file its hash must match. Otherwise the run stops with `GEN_PLAN_UNREGISTERED`, exit 2. Until P-U6 the run is allowed with a warning. `schedule.json` records `generatorPlan {path, sha256}`. |
| SO5-03 (run-experiment check) | For an E1 grid, `run-experiment.ts` looks for `generator-plan.json` beside the plan. If it is not in the gate's `frozenHashes`, every entry gets `prereg-refused (plan-unregistered)`. If it differs from the `e1` block, the run stops with `E1_GENERATOR_PLAN_MISMATCH`. `joinOutcome` checks each outcome's `orderSeed`, `pilot`, `adapterId`, coordinates, `promptTemplateId` and template sha (taken from the committed template), plus `schedule.json`. A breach makes the entry a not-run cell with `generationStatus: protocol-mismatch`, code `GEN-PROTOCOL-MISMATCH`, and the reason names the field. |
| SO5-04 | `scripts/lib/generators/cell-restart.ts`. Each cell runs in `<outRoot>/.staging/<runId>/`. `generation.json` is written atomically (temp file, then rename), and one rename commits the cell. On every start, `recoverCell` does one of three things: keeps a complete cell, promotes a finished staging directory, or moves the partial state (staging, an old in-place partial cell, its `interruptions/`) to `restarts/<runId>/<k>/` and regenerates the cell. Each event is logged to `restarts.jsonl`. |
| SO5-05 | A coordinate without `generation.json` becomes a not-run record with a `cell` (`generationStatus: missing`, `GEN-MISSING`), so every E1 grid record carries a cell. Helpers for lane SO5-agg are `scripts/lib/e1-cells.ts`, `completeE1Cells(records, grid)` and `missingE1Cell`, plus `cellGenCode` in `scripts/lib/so5-codes.ts`. **`aggregate.ts` is not edited.** SO5-agg must replace its `records.filter((r) => r.cell !== undefined)` with `completeE1Cells(...).cells` and take GEN codes from `cellGenCode`. |
| SO5-08 | `scripts/e1-judge-volume.ts` and `scripts/e1-judge-volume-cli.ts` (with `--self-test`) produce `Docs/DiagnosticRuns/e1-judge-volume-estimate.md`. U4's own unit builders run over the fixture and the three pilot trees. The fixture cross-check matches the SEN-01 record exactly (10 file units, 4 module units). Calls per evaluation: pilots 49, 100 and 97; fixture 43. E1 estimates: low 2646, central 4428, high 5400, cap ceiling 6534. At 6.6 s (6570 ms median) the central figure is 8.1 h sequential, or 2.7 h at concurrency 3. A table shows usage windows needed at 50, 100, 200 and 400 calls per window. |

## Files

- New: `experiments/e1-grid/generator-plan.json`, `scripts/lib/generators/registered-plan.ts`, `scripts/lib/generators/cell-restart.ts`, `scripts/lib/e1-cells.ts`, `scripts/e1-judge-volume.ts`, `scripts/e1-judge-volume-cli.ts`, `Docs/DiagnosticRuns/e1-judge-volume-estimate.md`.
- Changed: `scripts/lib/generators/{grid,generate-main,schedule,outcome}.ts`, `scripts/run-experiment.ts`, `scripts/lib/prereg.ts`, `scripts/lib/report-io.ts`, `scripts/lib/so5-codes.ts`, `scripts/lib/schemas/run-record.schema.json` (`generationStatus` gains `missing` and `protocol-mismatch`), `Docs/generator-protocol.md` (new §11 "Dated changes"; §1–§10 untouched).
- Tests: new `tests/unit/scripts/generators/cell-restart.test.ts` (8), `tests/unit/scripts/generators/registered-plan.test.ts` (8), `tests/unit/scripts/u5b/e1-cells.test.ts` (6) and `tests/unit/scripts/u5b/e1-judge-volume.test.ts` (9). Updated `grid.test.ts` (cwd is now the staging dir), `run-experiment.test.ts` (an E1 temp repo with a registered generator plan, plus 4 new cases: missing, protocol mismatch, schedule mismatch, unregistered/mismatched plan) and `prereg.test.ts` (registry list).

## Registered artefacts touched (the P-U6 bump must cover them)

1. `experiments/e1-grid/generator-plan.json`: new, matched by the new `REGISTERED_ARTEFACTS` entry, and not yet in `corpus/prereg.json`. Until it is registered, `run-experiment` refuses the E1 plan (`plan-unregistered`), and `generate-projects` warns.
2. `Docs/generator-protocol.md`: §11 added. Its hash changes, so until the bump the gate refuses every plan with `artefact-changed`. The P-1 bump will pick it up if P-1 is registered after this merge.
3. `REGISTERED_ARTEFACTS` (code, `scripts/lib/prereg.ts`) gains `experiments/e1-grid/generator-plan.json`.

## Open items

- `Docs/analysis-plan.md` (owned by P-M) should document the two join codes, `GEN-MISSING` and `GEN-PROTOCOL-MISMATCH`, beside its `genCodes` table in the P-U6 text. The registered table itself is unchanged, so `parseSo5Codes` still requires exactly the seven U5a codes.
- Lane SO5-agg must call `completeE1Cells` and `cellGenCode` in `aggregate.ts`. Without that, so5_grid keeps every record that has a cell, but a missing cell's GEN code shows as undefined.
- SO5-08 residual: the measured calls per usage window and the dated comparison line in `Docs/judge-preregistration.md` stay open. They need live calls, which are out of scope here. The judge pre-registration's own registration (the finding's last clause) is also not in this lane.
- The existing pilot outcomes under `../daedalus-e1-outcomes/pilot/` carry `orderSeed` 0 and were written by the scratch plan. They are pilot data, never joined, so they need no action. A re-run of the pilot must use the registered plan.
