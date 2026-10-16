# Full-grid stub replay at Study 2 scale (S4)

> **Tooling, development set.** Stub generator, made-up demo tasks, no model call. Nothing here is a measurement of
> any arm, model or task; no arm difference is computed or reported. The Study 2 tasks (sealed) were never read and the
> pilot tasks were not used.

Backlog job #22 (S4), objective "Study 2 runs once" (D4, D7, D9, S9). The dry run and the loop replay (#142) covered
3 tasks × 4 steps. This run drives the loop harness at the volume `Docs/v1.3/study2-outline.md` §6 plans (162 runs),
to find scheduling, disk, resume and analysis-runtime problems before any real run.

## 1. Plan (committed before any run)

- **Grid.** `experiments/grid-scale/plan.json`: 6 made-up tasks (`experiments/grid-scale/tasks.json`: todo-list,
  recipe-box, book-club, gym-log, plant-care, chore-chart; k = 5 steps each) × 3 fake model ids (two
  `claude-code-cli`, one `codex-cli`) × 3 replicates × arms `none`, `gate`, `daedalus-mcp`; `orderSeed` 20261016.
  54 blocks, 162 runs, 810 step turns, at most 270 repair turns (the plan's `callBudget`, checked by the harness).
- **Generator.** Stub (`gridStubScript`, `scripts/v1.3/lib/grid-scale.ts`): per step a domain entity and an
  application service under the Clean layout; step 3 also writes an infrastructure store and makes the domain entity
  import it (one planted dependency violation); the gate's repair turn rewrites the entity without the import. The
  `daedalus-mcp` arm behaves like `none` (the stub calls no tool); it is here for volume and schedule only.
- **Evaluator.** The real v1.3 firewall (`firewallEvaluator`, `evaluate_project`, `specs/clean-arch.yaml`) on the
  in-process Cypher interpreter (`graphEngine: cypher-interp`), no Neo4j. Type-check: the stub type-check (the trees
  are trivial; the E1 type-check needs the skeleton install).
- **Lanes.** Two lanes in parallel, each with its own harness root and out-root (outside the repository, not nested).
  Block b of the seeded schedule goes to lane `b mod 2 + 1`; each lane runs its blocks in schedule order through
  `runLoop`, the harness's own resume included.
- **Kill and resume.** Lane 1 is killed with SIGKILL when about 40 % of its runs are complete, then started again
  with the same arguments.
- **Merge and analysis.** A merged out-root (full schedule, one symlink per run) is read by the Study 2 analysis
  script of #160 (`scripts/v1.3/study2-analyse.ts` on `origin/v1.3-study2-analysis-rehearsal`, read-only, run from a
  separate worktree) with `--primary blocking --reason "<stub scale test>"`. Only its exit code, runtime and missing-run
  warning are reported; its tables are stub artefacts and are not committed.

## 2. Pass criterion (fixed before any run)

The run passes when every line holds (`grid-scale-replay.ts verify`):

| Id | Check |
|---|---|
| P1 | All 162 scheduled runs have `run.json` with `completedAt` and 5 step records. |
| P2 | The two lanes' run lists partition the seeded schedule; each lane's `schedule.json` equals its share of the seeded order; each lane executed its runs in that order (by `run.json` `createdAt`). |
| P3 (S9) | No lane root (harness or out) equals or contains another; no lane's run or step record names another lane's root; each run's pinned tsconfig lies in its own lane's harness root. |
| P4 | After the kill and resume, every step has exactly one step turn and at most one repair turn, no turn id repeats within a run, and each turn has exactly one envelope on disk. |
| P5 | All 9 runs (3 models × 3 replicates) of each task × arm have identical per-step content (source files, LOC, diff, blocking and advisory counts by rule, repair), the interrupted run included. |
| P6 | Every snapshot has an evaluation (no evaluator error). Gate runs: a repair turn at step 3 only, which clears it; no blocking finding at other steps. Other arms: blocking > 0 exactly from step 3 on. |
| P7 | The analysis script exits 0 on the merged out-root with no missing-run warning. |

Reported without a threshold: wall time per lane and for the kill/resume, disk (snapshot store per snapshot and per
run, lane out-roots, harness roots), step record size, `evaluate_project` duration, analysis runtime, and the same
figures extrapolated to the live grid.

## 3. Results

Pending (filled after the run).
