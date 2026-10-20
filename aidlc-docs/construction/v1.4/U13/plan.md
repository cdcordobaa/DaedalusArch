# U13 code-generation plan: shared step-1 start (STAGE-B-BUILD)

**Single source of truth for U13's Code Generation.** Depth: minimal (one harness option; the design is the drift
record's `start=shared-step-1` and the exploratory registration's Stage B). Requested as job STAGE-B-BUILD (scheduled
routine, 2026-10-20). All steps executed in one session; no step was approved interactively (the routine's stored
prompt is the approval of scope).

**Unit context**
- Brownfield TypeScript repo. Loop harness: `scripts/lib/loop/` (`plan.ts`, `main.ts`, `loop.ts`, `snapshot.ts`,
  `types.ts`). Outcomes that read step records: `scripts/lib/loop/pilot-metrics.ts` (`runOutcomes`),
  `scripts/lib/drift/study2-d.ts` (D).
- Read: `Docs/v1.4/exploratory-study-registration.md` (§6 Stage B table, Amendment 1 items 1, 2, 6),
  `Docs/v1.4/study2-deviation-2026-10-19-drift.md` §2 (`start=shared-step-1`, D), `experiments/exploratory-study/README.md`
  (item 5: not a harness feature yet), `experiments/exploratory-study/stage-a/plan.json`, the committed Stage A step
  records in `results/v1.4-exploratory/stage-a/`.
- Constraints: ZERO model calls (stub generator, `--dry-run` only); no `*sealed*` path read; `jest --maxWorkers=2`; tsc
  clean; ESLint clean on changed files; no edit to `src/llm-critic` or `scripts/lib/generators/agy-*`.
- Out of scope: running Stage B; S3 (per-run HOME isolation); loop replay of shared-start runs; merging.

## Decisions taken here (flagged for the author)

| Item | Decision | Why |
|---|---|---|
| Replicate 2 of `none@L2` | Runs steps 1–5 from scratch (`firstRun: 1`); it is not branched from Stage A | Registration §6 ("Replicate 2 of none@L2, steps 1–5") and Amendment 1 item 6 (15 turns); a block is task × replicate. The build request's wording could be read as branching it too; the registration wins |
| Step 1 in a branched run | Copied in as `steps/step-01.json` with an `inherited` block (and `turns/step-01/`) | Resume, `runOutcomes` and D then see step 1 unchanged, so inherited identities never count as new with no change to any outcome code |
| Source per replicate | `fromOutRoot` is one path or a list indexed by run index; `--shared-start-from` fills `"<local>"` entries | Replicate 1's source is Stage A, replicate 2's is the replicate-2 grid |
| Refusals | Missing source run / step-1 record / commit; tasks sha256 (source `schedule.json`) or step-1 spec sha256 differs; source arm, rung or attention not the plan's; dry vs live; L4 frame; out-root inside a source | The request's refusal list, plus the cases that would make the frames differ in more than the cell |
| Isolation | As Stage A (pin on, HOME isolation off) | The request; the registration's "S3 is fixed before Stage B" is left to the author (README item 2) |

## Steps

- [x] **Step 1. Plan option.** `sharedStart: { fromOutRoot, fromCell, step: 1 }` and `firstRun` in `plan.ts`
  (validation, static profile for every task, L4 refused, budget counts steps 2..k, `firstRun` keeps the longer plan's
  arm order, out-root outside every source); `--shared-start-from` in `main.ts`.
- [x] **Step 2. Source check and seeding.** `scripts/lib/loop/shared-start.ts` (`checkSharedStartSource`,
  `inheritedStepRecord`, `sharedStartMatches`); `WorkTreeSnapshots.seedFrom` and `gitHasCommit` in `snapshot.ts`.
- [x] **Step 3. Loop.** `loop.ts` `create()` checks the source before touching the run directory, seeds the store, writes
  the inherited step 1 and `run.json` `sharedStart`; `run()` refuses a different source on resume
  (`LOOP_SHARED_START_MISMATCH`) and a missing inherited step 1 (`LOOP_SHARED_START_BROKEN`). `types.ts`: `RunRecord.sharedStart`,
  `StepRecord.inherited`.
- [x] **Step 4. Tests** (`tests/unit/scripts/loop/shared-start.test.ts`): dry-run Stage A with the committed plan, replicate
  2, both cells from the templates; step-1 snapshots identical, numbering, provenance, frames equal to a from-step-1 run,
  sources untouched, resume, every refusal; loop-level inherited-identity check; committed Stage A hashes match.
- [x] **Step 5. Templates and README** in `experiments/exploratory-study/stage-b/`; README item 5 of
  `experiments/exploratory-study/README.md` updated.
- [x] **Step 6. Records.** Code summary, audit entry, state line; PR to main (not merged).
