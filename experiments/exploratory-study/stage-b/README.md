# Exploratory study, Stage B plan templates (U13; registration Amendment 1)

**2026-10-20. Templates only. No model was called to write them, and nothing here has run live.** They were exercised in
dry runs only (stub generator, stub firewall; `tests/unit/scripts/loop/shared-start.test.ts`).

Stage B, as the registration's §6 table and Amendment 1 item 6 define it (`Docs/v1.4/exploratory-study-registration.md`):

1. **Replicate 2 of `none@L2`, steps 1–5** (3 tasks × 5 steps = 15 turns). Its step-1 trees are the shared starts of the
   three replicate-2 blocks. A block is task × replicate, so replicate 2 draws its own step 1.
2. **`none@L3` and `mcp@L2` branch at step 2** from the `none@L2` step-1 tree of every block: replicate 1 from Stage A,
   replicate 2 from item 1 (6 blocks × 2 cells × 4 steps = 48 turns). This is `start=shared-step-1`
   (`Docs/v1.4/study2-deviation-2026-10-19-drift.md` §2).

Core total with Stage A: 15 + 15 + 48 = 78 turns, as in Amendment 1 item 6.

| File | Cell | Runs | Calls (`callBudget.maxCalls`) |
|---|---|---|---|
| `plan-none-L2-rep2.template.json` | `none@L2`, replicate 2 (`firstRun: 1`, `runs: 1`), steps 1–5 | 3 | 15 |
| `plan-none-L3.template.json` | `none@L3`, replicates 1–2, `sharedStart` from `none@L2`, steps 2–5 | 6 | 24 |
| `plan-mcp-L2.template.json` | `mcp@L2` (arm `daedalus-mcp`), replicates 1–2, `sharedStart` from `none@L2`, steps 2–5 | 6 | 24 |

All three are Stage A's plan (`../stage-a/plan.json`) with only these changes: the cell (arm, `frame.specRung`), the
runs, and `firstRun` or `sharedStart`. So they share its tasks file (`../stage-a/tasks.json`, sha256
`680c7471…662e`, the hash in Stage A's `schedule.json`), Layered tasks `ice-rink`, `youth-league`, `hive-health`,
`claude-sonnet-5-5` only, Claude CLI **2.1.304** (D1 exploratory allowance), `orderSeed`, `engine: cypher-interp`, the
`presets/layered.yaml` profiles, the attention sentence, and **Stage A's isolation: CLI pin on, per-run HOME isolation
off** (no `generatorIsolation` block; the E1 environment plus `--safe-mode`).

## How the shared start works (`scripts/lib/loop/shared-start.ts`)

`sharedStart: { "fromOutRoot": [<rep-1 source>, <rep-2 source>], "fromCell": "none@L2", "step": 1 }`. For run index r,
the source run is `claude-code-cli/claude-sonnet-5-5/<task>/none/run-<r>` under `fromOutRoot[r]`. Before the run
directory is created the harness refuses (`LOOP_SHARED_START_SOURCE`, exit 2) when the source run, its step-1 record
or its step-1 `finalCommit` in the source's `snapshots.git` is missing, when the source `schedule.json` tasks sha256 or
its step-1 spec sha256 differs from this plan's, when the source is not `none@L2` with the same attention flag, or when
a dry run would branch from a live one. Then:

- the new `snapshots.git` fetches the step-1 commit (and its ancestry) from the source store; the work tree is reset to
  it. The step-1 commit sha is the source's;
- `steps/step-01.json` is the source's step-1 record under the new run id, with an `inherited` block; the source's
  `turns/step-01/` (prompt, envelope, report) is copied beside it;
- `run.json` records `sharedStart`: source run id, `sourceCommit`, `sourceBaseCommit`, the step-1 record's sha256, the
  tasks and spec hashes (no absolute path);
- the loop resumes at step 2. The step-2..5 prompts are byte-identical to those of the same cell run from step 1
  (tested), and every outcome from the step records (`runOutcomes`, the drift D) sees the step-1 identities in step 1,
  so an inherited identity never counts as new.

The source grids are only read. A resume needs only the new run, and refuses a different source
(`LOOP_SHARED_START_MISMATCH`). The out-root must lie outside every source out-root.

## Before any run (the author confirms)

1. **The Stage A out-root** must be the one Stage A ran in, with its `snapshots.git` stores. The committed copies in
   `results/v1.4-exploratory/stage-a/` have no `snapshots.git`, so they cannot be a source (they would be refused).
2. **Isolation.** The registration changelog says "S3 is fixed before Stage B"; these templates keep Stage A's setting
   (HOME isolation off), as the build request asked. If S3 is fixed first, add Stage A's `generatorIsolation` block back
   (and `--claude-config-dir`) to all three plans: the cells of a block should then share one environment.
3. **The `daedalus` block** of `plan-mcp-L2` holds `/opt/daedalus/...` placeholders. Point it at a build of the MCP
   server at the run commit, outside every cwd (the per-task spec is the profile's `presets/layered.yaml`).
   **Blocked (2026-10-20):** the Claude S4 probe with MCP failed. `--safe-mode` keeps the server from loading, so
   this cell would run with no MCP tool (`Docs/DiagnosticRuns/v1.4-claude-s4-mcp-2026-10-20.md`). It needs an argv
   decision and an S4 re-run first.
4. Approval of the 63 calls (cap per Amendment 1 item 6).

## Commands (repository root; fill the `<…>` paths, all absolute and outside the repository)

Let `A` be the Stage A out-root, and `R2`, `L3`, `MCP` three fresh out-roots.

```sh
# 0. Dry runs first (no model call): a dry-run Stage A source, then the same three steps with --dry-run.
npx tsx scripts/loop-harness-cli.ts --plan experiments/exploratory-study/stage-a/plan.json --dry-run \
  --out-root <A-dry> --binary <claude> --harness-root <H-dry>
#    ... then steps 1-3 below with --dry-run and the -dry out-roots.

# 1. Replicate 2 of none@L2, steps 1-5 (15 turns).
npx tsx scripts/loop-harness-cli.ts --plan experiments/exploratory-study/stage-b/plan-none-L2-rep2.template.json \
  --out-root <R2> --binary <claude> --harness-root <H-r2> --call-log

# 2. none@L3 from both replicates' step-1 trees (24 turns). --shared-start-from fills fromOutRoot in order: rep 1, rep 2.
npx tsx scripts/loop-harness-cli.ts --plan experiments/exploratory-study/stage-b/plan-none-L3.template.json \
  --out-root <L3> --binary <claude> --harness-root <H-l3> --call-log \
  --shared-start-from <A> --shared-start-from <R2>

# 3. mcp@L2 the same way (24 turns), after filling the daedalus block.
npx tsx scripts/loop-harness-cli.ts --plan experiments/exploratory-study/stage-b/plan-mcp-L2.template.json \
  --out-root <MCP> --binary <claude> --harness-root <H-mcp> --call-log \
  --shared-start-from <A> --shared-start-from <R2>
```

Step 1 must finish before steps 2 and 3 (its step-1 trees are their replicate-2 sources); 2 and 3 are independent.
Re-running a command resumes it. Copy the step records into `results/v1.4-exploratory/stage-b/` afterwards, as for
Stage A.

**Give each grid its own harness root** (`<H-r2>`, `<H-l3>`, `<H-mcp>`, none of them Stage A's). The pinned type-check
tsconfig lives at `<H>/runs/<runId>/tsconfig.json` and names the run's work tree. The `none@L3` run ids are the
`none@L2` ones (`…/<task>/none/run-0` is both Stage A's run and an L3 run), so a shared harness root would rewrite
Stage A's and replicate 2's tsconfig to point at the L3 work trees. Each harness root installs its own skeleton (no
model call).
