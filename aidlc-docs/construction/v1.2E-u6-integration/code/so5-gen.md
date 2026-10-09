# U6 lane SO5-gen (ADR-021)

**Date**: 2026-10-08. **Branch**: `v1.2e-u6-so5gen`. **Findings closed**: SO5-03, THR-8, SO5-04, SO5-05 (PR #18 plus the follow-ups below); SO5-08 closed for the ADR-021 work item (the pre-run E1 estimate) only, its residual stays open (see Open items) (`Docs/DiagnosticRuns/so-readiness-audit-2026-10-08.json`). No live LLM call, no generation, no E1/E7/SO4 or labelling run.

## What changed

| Finding | Change |
|---|---|
| THR-8, SO5-03 (plan) | `experiments/e1-grid/generator-plan.json` is committed: adapters `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-4-5` (schedule order), both tasks, three levels, `runs` 3, `orderSeed` 20261008, `outRoot` `../daedalus-e1-outcomes`, `timeoutMs` 1 200 000, `allowBash` true. `binary` and `harnessRoot` are `"<local>"`, and `generate-projects.ts --binary --harness-root` fills them. The file pattern is in `REGISTERED_ARTEFACTS` (`scripts/lib/prereg.ts`). `corpus/prereg.json` is not touched. |
| SO5-03 (generator check) | `guardE1Plan` (`scripts/lib/generators/registered-plan.ts`) runs in `generate-main`. A grid whose `outRoot` lies in the E1 root (the grid or its pilot) must start from the registered file, every frozen field must match, and once `corpus/prereg.json` lists the file its hash must match. Otherwise the run stops with `GEN_PLAN_UNREGISTERED`, exit 2. Until P-U6 the run is allowed with a warning. `schedule.json` records `generatorPlan {path, sha256}`. |
| SO5-03 (run-experiment check) | For an E1 grid, `run-experiment.ts` looks for `generator-plan.json` beside the plan. If it is not in the gate's `frozenHashes`, every entry gets `prereg-refused (plan-unregistered)`. If it differs from the `e1` block, the run stops with `E1_GENERATOR_PLAN_MISMATCH`. `joinOutcome` checks each outcome's `orderSeed`, `pilot`, `adapterId`, coordinates, `promptTemplateId` and template sha (taken from the committed template), plus `schedule.json`. A breach makes the entry a not-run cell with `generationStatus: protocol-mismatch`, code `GEN-PROTOCOL-MISMATCH`, and the reason names the field. |
| SO5-04 | `scripts/lib/generators/cell-restart.ts`. Each cell runs in `<outRoot>/.staging/<runId>/`. `generation.json` is written atomically (temp file, then rename), and one rename commits the cell. On every start, `recoverCell` does one of three things: keeps a complete cell, promotes a finished staging directory, or moves the partial state (staging, an old in-place partial cell, its `interruptions/`) to `restarts/<runId>/<k>/` and regenerates the cell. Each event is logged to `restarts.jsonl`. |
| SO5-05 | A coordinate without `generation.json` becomes a not-run record with a `cell` (`generationStatus: missing`, `GEN-MISSING`), so every E1 grid record carries a cell. Helpers: `scripts/lib/e1-cells.ts` (`completeE1Cells(records, grid)`, `missingE1Cell`) and `cellGenCode` in `scripts/lib/so5-codes.ts`. `aggregate.ts` consumes them since the follow-up below. |
| SO5-08 | `scripts/e1-judge-volume.ts` and `scripts/e1-judge-volume-cli.ts` (with `--self-test`) produce `Docs/DiagnosticRuns/e1-judge-volume-estimate.md`. U4's own unit builders run over the fixture and the three pilot trees. The fixture cross-check matches the SEN-01 record exactly (10 file units, 4 module units). Calls per evaluation: pilots 49, 100 and 97; fixture 43. E1 estimates: low 2646, central 4428, high 5400, cap ceiling 6534. At 6.6 s (6570 ms median) the central figure is 8.1 h sequential, or 2.7 h at concurrency 3. A table shows usage windows needed at 50, 100, 200 and 400 calls per window. |

## Files

- New: `experiments/e1-grid/generator-plan.json`, `scripts/lib/generators/registered-plan.ts`, `scripts/lib/generators/cell-restart.ts`, `scripts/lib/e1-cells.ts`, `scripts/e1-judge-volume.ts`, `scripts/e1-judge-volume-cli.ts`, `Docs/DiagnosticRuns/e1-judge-volume-estimate.md`.
- Changed: `scripts/lib/generators/{grid,generate-main,schedule,outcome}.ts`, `scripts/run-experiment.ts`, `scripts/lib/prereg.ts`, `scripts/lib/report-io.ts`, `scripts/lib/so5-codes.ts`, `scripts/lib/schemas/run-record.schema.json` (`generationStatus` gains `missing` and `protocol-mismatch`), `Docs/generator-protocol.md` (new §11 "Dated changes"; §1–§10 untouched).
- Tests: new `tests/unit/scripts/generators/cell-restart.test.ts` (8), `tests/unit/scripts/generators/registered-plan.test.ts` (8), `tests/unit/scripts/u5b/e1-cells.test.ts` (6) and `tests/unit/scripts/u5b/e1-judge-volume.test.ts` (9). Updated `grid.test.ts` (cwd is now the staging dir), `run-experiment.test.ts` (an E1 temp repo with a registered generator plan, plus 4 new cases: missing, protocol mismatch, schedule mismatch, unregistered/mismatched plan) and `prereg.test.ts` (registry list).

## Registered artefacts touched (the P-U6 bump must cover them)

1. `experiments/e1-grid/generator-plan.json`: new, matched by the new `REGISTERED_ARTEFACTS` entry, and not yet in `corpus/prereg.json`. Until it is registered, `run-experiment` refuses the E1 plan (`plan-unregistered`), and `generate-projects` warns.
2. `Docs/generator-protocol.md`: §11 added. Its hash changes, so until the bump the gate refuses every plan with `artefact-changed`. P-1 (prereg v2, a258db0) merged first and hashed the pre-§11 text, so P-U6 must re-hash it.
3. `REGISTERED_ARTEFACTS` (code, `scripts/lib/prereg.ts`) gains `experiments/e1-grid/generator-plan.json`. After the merge with P-1 the list also keeps P-1's `Docs/e7-spec-rule.md` and `scripts/generate-e7-specs.ts`.

## Open items

- `Docs/analysis-plan.md` (owned by P-M) should document the two join codes, `GEN-MISSING` and `GEN-PROTOCOL-MISMATCH`, beside its `genCodes` table in the P-U6 text. The registered table itself is unchanged, so `parseSo5Codes` still requires exactly the seven U5a codes.
- SO5-08 residual: the measured calls per usage window, the dated comparison line in `Docs/judge-preregistration.md` (its "Dated lines" still reads "None yet" and does not yet reference `Docs/DiagnosticRuns/e1-judge-volume-estimate.md`) and an E7 estimate stay open. They need live calls, which are out of scope here. The judge pre-registration's own registration (the finding's last clause) is also not in this lane.
- The existing pilot outcomes under `../daedalus-e1-outcomes/pilot/` carry `orderSeed` 0 and were written by the scratch plan. They are pilot data, never joined, so they need no action. A re-run of the pilot must use the registered plan.

## Follow-up (2026-10-09, branch `v1.2e-u6-so5gen-followup`)

A review of PR #18 found SO5-05 only half closed end to end: `aggregate.ts` still filtered on `r.cell !== undefined` and took GEN codes from `genCodeOf`, so a `missing` or `protocol-mismatch` cell had an empty `gen_code` in `so5_grid.csv` and no row in `so5_patterns.csv`, and a coordinate with no RunRecord at all was absent. No lane "SO5-agg" existed, and P-M (PR #22) no longer holds `aggregate.ts`, so this follow-up closes it here.

| Finding | Change |
|---|---|
| SO5-05 (aggregate) | `aggregate.ts`: new `so5Records(input)`. For a plan with an `e1` block it returns one record per grid coordinate in coordinate order (`completeE1Cells`), synthesising a not-run record (`missingE1Record`: `runId` as `run-experiment.ts` assigns it, `reasonCode` `generation-failed`, detail `GEN-MISSING: ...`) for a coordinate no record carries, then the off-grid record cells (nothing is dropped). Without an `e1` block it keeps every record with a `cell`, as before. `so5Cells` reads it, so the valid-generation-yield denominator counts every coordinate. `so5_grid.csv` `gen_code` and the `so5_patterns.csv` GEN rows come from `cellGenCode`, so `GEN-MISSING` and `GEN-PROTOCOL-MISMATCH` appear in both. |
| BR-U5b-51 | The rule row in `aidlc-docs/construction/v1.2E-u5b-scoring-harness/functional-design/business-rules.md` now lists `experiments/e1-grid/generator-plan.json`, `Docs/e7-spec-rule.md` and `scripts/generate-e7-specs.ts`, so it equals `REGISTERED_ARTEFACTS` again (not a registered artefact itself). |

- Files: `scripts/aggregate.ts`, `scripts/lib/e1-cells.ts` (doc comment), `tests/unit/scripts/u5b/aggregate.test.ts`, `tests/unit/scripts/u5b/e1-cells.test.ts` (header), the BR-U5b-51 row, this note.
- Tests: new describe "SO5 grid completeness over the registered E1 grid" in `aggregate.test.ts` (4 cases, hand-computed: a 4-coordinate grid with one ok, one `missing` record, one `protocol-mismatch` record, one coordinate without a record, plus one off-grid cell and one record without a cell; checks `so5_grid.csv` rows and `gen_code`, the three `so5_patterns.csv` GEN rows incl. the synthesised run id `e1t-003-m2_task-management_none_run-1`, the yield denominator, and the no-`e1` path).
- Registered artefacts touched: none. Golden unchanged (no CHANGES.md line).
- Still for P-U6 (unchanged from above): register `experiments/e1-grid/generator-plan.json`, re-hash `Docs/generator-protocol.md`, and add `GEN-MISSING` / `GEN-PROTOCOL-MISMATCH` beside the `genCodes` table of `Docs/analysis-plan.md` (the seven-code registered table stays as is).
- Still for P-U6 or the pilot: the SO5-08 residual (measured calls per usage window, the dated comparison line, registering `Docs/judge-preregistration.md` in `corpus/prereg.json`). No change here.
- Housekeeping: the merged branch `v1.2e-u6-so5gen` was deleted locally and on origin.

## Follow-up 2 (2026-10-09, branch `v1.2e-u6-so5gen-fix`)

A second review found that a `generation.json` declaring another coordinate (task, model, level or run) produced a `protocol-mismatch` cell carrying the outcome's own fields. `completeE1Cells` then saw it as an off-grid extra and synthesised `GEN-MISSING` for the real coordinate, so `so5_grid.csv` had 55 rows for the 54-cell grid and the mismatch was reported at the wrong cell.

| Finding | Change |
|---|---|
| SO5-03, SO5-05 (coordinate mismatch) | `joinOutcome` (`scripts/run-experiment.ts`): every `protocol-mismatch` cell now starts from `missingE1Cell` at the grid entry's coordinate (`requestedModelId`, `taskId`, `specLevel`, `runIndex`, `promptTemplateId`, `style`, `adapterId`, outcome path) and copies only the outcome's counts (`fileCount`, `fileCountInRange`, `permissionDenials`) as evidence; the outcome's `resolvedModelId` and `failureReason` are not carried. |
| Gate L | `scripts/e1-judge-volume.ts`: the two new-lane eslint errors (`prefer-optional-chain`, `no-unnecessary-template-expression`) are fixed; the generated estimate text is unchanged. |

- Tests: `run-experiment.test.ts` gains "an outcome declaring another task, model or run is a mismatch cell at its directory's own coordinate" (three outcomes declaring task `order-fulfilment`, model `m9`, run 0; each cell equals the grid coordinate with counts 25 / true / 2). `aggregate.test.ts` gains a describe over the 54-cell synthetic grid with the mismatched outcome under `m1/task-management/none/run-0`, joined through `joinOutcome`: 54 `so5_grid.csv` rows, `GEN-PROTOCOL-MISMATCH` at that coordinate, no `GEN-MISSING`, patterns `GEN-PROTOCOL-MISMATCH` and `GEN-TIMEOUT`, 52 valid cells. Both fail on the previous code.
- Registered artefacts touched: none. Golden unchanged (no CHANGES.md line).
- Known flake, not in this lane: `aggregate.test.ts` "the same CSV renders to byte-identical SVG through the CLI" failed once under `--maxWorkers=2` in the review run (it already has a 120 s timeout); it passed in this lane's full run.
