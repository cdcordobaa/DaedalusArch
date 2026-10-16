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

## 3. Results (2026-10-16, this container)

**Pass: P1–P7 all hold** (`grid-scale-replay.ts verify`, exit 0; the analysis script exit 0). Recorded after one
defect was fixed (F1) and the kill was redone (F3); both are below.

| Id | Result |
|---|---|
| P1 | 162 / 162 runs complete, 5 step records each (810 steps, 864 snapshots: 810 step turns + 54 repair turns). |
| P2 | 54 blocks, 81 runs per lane; both lanes' `schedule.json` equal their share of the seeded order and both executed in that order. |
| P3 (S9) | No nested or shared root; 0 records name another lane's root; every run's pinned tsconfig is in its own lane's harness root. |
| P4 | 0 turn problems. One run was cut mid-run by the kill (`book-club/daedalus-mcp/run-1`, one `restarts.jsonl` line: killed inside step 1, resumed at step 1 from the base commit); its snapshot history is the base commit plus exactly its recorded turns. |
| P5 | 18 task × arm groups, each with one signature across its 9 runs (the interrupted run included). |
| P6 | 0 evaluator errors; gate: a repair at step 3 only, always cleared; `none` and `daedalus-mcp`: blocking (FF-S01, FF-S04) from step 3 on. |
| P7 | Analysis script (#160 branch, read-only) exit 0 in **3.0 s** on the merged out-root; it saw 162 runs, 54 blocks, 0 missing steps, and flagged the input `synthetic: true` (dry-run records). |

Measures (no threshold; stub trees of 14–80 LOC, so the sizes are a floor, not a forecast):

| Measure | Value |
|---|---|
| Wall time, lane 2 (81 runs, uninterrupted, parallel to lane 1) | 64.8 s |
| Wall time, lane 1 | 27.3 s to the kill (32 runs complete) + 40.4 s resume (32 skipped, 1 resumed, 48 fresh) |
| Harness cost per run / per snapshot (generator, git, interpreter, records) | about 0.8 s / about 0.15 s |
| Out-roots | 6.84 MB + 6.88 MB = 13.7 MB for 162 runs (about 85 KB per run) |
| Snapshot stores (`snapshots.git`) | 5.6 MB total; 6.5 KB per snapshot; 34.6 KB per run |
| Step records | 2.56 MB total; median 2.75 KB, max 6.27 KB (the gate's repaired step, which carries the findings) |
| Harness roots | 61 KB each (pinned per-run tsconfigs) |
| `evaluate_project` reported duration | median 1 ms, p95 6 ms (the evaluation stage only; extraction is in the 0.15 s per snapshot) |
| Analysis runtime | 3.0 s; output 87 KB (report and figures, not committed) |

What this says for the live grid: harness overhead is about 2 minutes for all 162 runs, negligible next to model
turns, and disk is not a constraint at any plausible tree size (100 times the stub's per-snapshot size would still be
under 1 GB of snapshot stores). Not exercised: the interruption archive (`interruptions/`, a full copy of the work
tree per interrupted turn), the skeleton install and E1 type-check, real MCP tool calls in the `daedalus-mcp` arm, and
the Neo4j evaluator.

## 4. Defects and gaps found

**F1, fixed behind an opt-in (test added).** `evaluate_project` on `cypher-interp` dropped `tsconfigPath`
(`src/mcp-server/evaluate-project.ts`, `interp-evaluator.ts`); the Neo4j path honours it. A loop work tree has no
tsconfig of its own (the pinned one lies in the harness root), so on the interpreter **every snapshot failed with
`PIPELINE_FAILED: No tsconfig.json found`**, the gate never fired, and every run still "completed". The pass-through
is gated by a new `EvaluateDeps.interpTsconfig` flag, **off by default** (standard rule 3): with it off,
`evaluate_project` on the interpreter behaves exactly as before; this driver turns it on. When on, the tsconfig path
and mtime join the interpreter's cache key. Test: `tests/unit/mcp-server/npx-mode.test.ts` (default off still fails as
before; on evaluates). Whether the loop harness's own live wiring (`main.ts`) should turn it on for a
`cypher-interp` loop is the author's decision; this branch does not change that wiring. `includeViolations` was dropped
on the same path too; `v1.3` fixed that independently (`bba3cfc8`, merged in `cd0762c2`).

**F2, not fixed (proposal).** An evaluator that fails on every snapshot does not stop or warn the grid: by design the
loop records the error on the snapshot and goes on (`loop.ts` header). At Study 2 scale a misconfigured evaluator
(F1 was one) would burn the whole grid with no outcome. Proposal for the author: the grid summary counts
`evaluationError` snapshots, and the grid stops after N consecutive ones (N set before the run). Behaviour change of
the harness, so left to the author.

**F3, not fixed (proposal).** Nothing stops two processes from running on the same out-root. The first kill of this
run signalled the `npx`/`tsx` process, but `tsx` runs the script in a child `node`, which kept going; the "resume"
then ran beside it. Both exited as if complete, and one run (`fake-model-b/todo-list/none/run-1`) came out corrupted:
its snapshot history holds steps 3–5 twice and its step-2 record carries a later tree's evaluation. Only the history
check of `verify` caught it (P4, P5, P6 all failed on that copy). Proposals: (a) an exclusive lock file in the out-root
(`O_EXCL`, pid inside, refused while that pid lives); (b) operator note in the runbook: stop a lane by its process
group (`kill -- -<pgid>`, start it under `setsid`), never by the `npx` pid. The redone kill used (b).

**F4, gap (tooling here, not in the harness).** The harness has no lane concept. Cutting the plan file into lane plans
(say one per model) would change the arm orders, because the seeded generator is consumed block by block over the
whole schedule. The driver here keeps the seeded order (block b to lane `b mod n`) and adds the merge step the analysis
needs. If Study 2 runs two lanes, `--lane i/n` and a merge could move into `loop-harness-cli.ts` (author decision).

**F5, note.** Turn ids are fixed per step (`step-03`, `step-03-repair`), and a turn that runs again overwrites its
envelope, so envelopes cannot show a duplicate turn. The snapshot history can, and `verify` checks it.

## 5. How to reproduce

```
G=<scratch dir outside the repo>
npx tsx scripts/v1.3/grid-scale-replay.ts run --plan experiments/grid-scale/plan.json --lane 2/2 --harness-root $G/h2 --out-root $G/o2 &
setsid npx tsx scripts/v1.3/grid-scale-replay.ts run --plan experiments/grid-scale/plan.json --lane 1/2 --harness-root $G/h1 --out-root $G/o1 &
# at ~32 completed runs of lane 1: kill -9 -- -<pgid of lane 1>; then rerun the lane-1 command (it resumes)
npx tsx scripts/v1.3/grid-scale-replay.ts merge --plan experiments/grid-scale/plan.json --lanes $G/o1,$G/o2 --out $G/merged
npx tsx scripts/v1.3/grid-scale-replay.ts verify --plan experiments/grid-scale/plan.json --lanes $G/o1,$G/o2 --harness-roots $G/h1,$G/h2 --merged $G/merged
# analysis: from a worktree of origin/v1.3-study2-analysis-rehearsal
npx tsx scripts/v1.3/study2-analyse.ts --out-root $G/merged --out $G/analysis --primary blocking --reason "stub scale test"
```

The author still has to confirm that the six made-up task domains do not overlap the sealed list (backlog §3); this
session never read that list.
