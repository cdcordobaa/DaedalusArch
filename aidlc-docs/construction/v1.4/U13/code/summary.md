# U13 code summary: shared step-1 start (STAGE-B-BUILD)

Plan: `aidlc-docs/construction/v1.4/U13/plan.md`. **No model call was made**: every generator in this unit is the stub
(`--dry-run` or the test stub). No sealed path was read.

## What changed

| Item | Files |
|---|---|
| `sharedStart` and `firstRun` plan options, their validation and budget; `--shared-start-from` | `scripts/lib/loop/plan.ts`, `scripts/lib/loop/main.ts` |
| Source check (run, step-1 record, commit, tasks and spec hashes, cell, dry/live), inherited step-1 record, resume check | `scripts/lib/loop/shared-start.ts` (new) |
| Seeding the snapshot store from the source store (`seedFrom`, `gitHasCommit`) | `scripts/lib/loop/snapshot.ts` |
| Run creation from a shared start; resume refusals | `scripts/lib/loop/loop.ts` |
| `RunRecord.sharedStart`, `StepRecord.inherited` (optional; absent in every other run) | `scripts/lib/loop/types.ts` |
| Stage B templates (replicate 2 `none@L2`, `none@L3`, `mcp@L2`) and the README with the commands | `experiments/exploratory-study/stage-b/` |
| Item 5 of the exploratory README now points at Stage B | `experiments/exploratory-study/README.md` |

A plan without `sharedStart` or `firstRun` schedules, budgets, creates and resumes runs exactly as before.

Not touched: `src/llm-critic`, `scripts/lib/generators/agy-*`, the outcome code (`pilot-metrics.ts`, `scripts/lib/drift/`).

## Tests

- New: `tests/unit/scripts/loop/shared-start.test.ts` (15). Dry-run Stage A (`stage-a/plan.json`), replicate 2, then
  each cell template branching from both: step-1 commit and tree equal to the source's, step 2 its child; step records
  1..5 with step 1 `inherited`; `run.json` provenance (no absolute path); step-2..5 prompts byte-identical to the same
  cell run from step 1; source grids unchanged; 24 step turns, none at step 1; resume (skip, and a redraw from step 4);
  refusals (no schedule, no source run, no replicate-2 source, no step-1 record, no commit, no store, tasks hash, spec
  hash, rung, live source, resume with another source, missing inherited step, out-root inside a source, wrong
  `--shared-start-from` count). Plan rules, budgets (15 / 24 / 24), the templates, and the committed Stage A hashes.
  Loop level: a step-1 finding kept at step 2 is not new in `runOutcomes`; the step-2 finding is.
- Gates: see the PR description for the `jest --maxWorkers=2`, `tsc` and ESLint results of this commit.

## Known limits

- The loop replay (`replay*.ts`) does not re-run shared-start runs (it would redraw step 1); not needed for Stage B.
- Cost tallies that sum every step record count the inherited step 1 again; skip steps with `inherited`.
