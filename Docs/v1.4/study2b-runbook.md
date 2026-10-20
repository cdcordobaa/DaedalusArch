# Study 2b (confirmatory) runbook

<!-- study2-protocol: primary=D-new-blocking-identities-steps-2-to-k; k=5; arms=none,daedalus-mcp; cells=none@L2,none@L3,mcp@L2; start=shared-step-1; unit=distinct-edge; tasks=new-4-layered-2-ddd-sealed-at-freeze; fallback=run-exploratory; order=freeze,hold-out,pilot-and-rehearsal,pre-registration,gate,run; generators=claude-sonnet-5-5,gemini-pin -->

**2026-10-20. Written before the run. The confirmatory run is not started by this document.** It starts only on the author's go, after the readiness gate is green (`ops/decisions.md` GO-2B). The protocol is the drift record, `Docs/v1.4/study2-deviation-2026-10-19-drift.md` §2 (the block above). 2b is Claude-only (`ops/05-plan-to-friday-2026-10-23.md`). The dress rehearsal of these commands, on practice tasks, is `Docs/DiagnosticRuns/v1.4-study2b-rehearsal-2026-10-20.md`.

**Run-once rule.** The sealed tasks run once, in §5 of this runbook, and never for practice. No agent session opens, prints or reads `<sealed>/` or the acceptance files. The harness and `study2b-plans.ts` read them as scripts, and their output names no task (task ids become `<task-N>`). The filled plans hold the task ids, so they are not opened either.

## 1. What runs

| Phase | Plan template | Cell | Steps | Runs | Step turns (R replicates, 4 tasks) | R = 2 |
|---|---|---|---|---|---|---|
| (a) | `experiments/study2b/plan-none-L2.template.json` | `none@L2` | 1 | 4R | 4R | 8 |
| (b) | the same plan, same invocation | `none@L2` | 2–5 | (same runs) | 16R | 32 |
| (c) | `experiments/study2b/plan-none-L3.template.json` | `none@L3`, `sharedStart` from (a) | 2–5 | 4R | 16R | 32 |
| (d) | `experiments/study2b/plan-mcp-L2.template.json` | `mcp@L2`, `sharedStart` from (a) | 2–5 | 4R | 16R | 32 |
| | | | | | **52R** | **104** |

- **R is set by the pre-registration: R = 10 (N = 40 blocks, 520 step turns; DELEG7).** The plans are filled **per replicate** (`--replicate r`, r = 1..10; §3, §5; pre-registration §2, DELEG9), not once with `--replicates R`. The `callBudget` of each plan is recomputed by the harness's own `planCallBudget`, and `loadLoopPlan` refuses a plan whose budget differs. No repair turns (no `gate` arm). Count for any R: `npx tsx scripts/v1.4/study2b-plans.ts --count --replicates R`.
- **Why (a) and (b) are one plan.** The harness at the freeze tag has no "stop after step 1" setting, and adding one would change `scripts/` after the freeze. So `none@L2` runs steps 1–5 in one invocation, as Stage A did in 2a. Its step-1 tree is the block's shared step 1 (`start=shared-step-1`). The step 2–5 prompts of a run that continues from its own step 1 are byte-identical to those of a run that branches there (`tests/unit/scripts/loop/shared-start.test.ts`), so `none@L2` is the same cell either way.
- **The blocks.** Block = task × replicate. Replicate r of `none@L3` and `mcp@L2` branches from replicate r's own `none@L2` out-root (`--shared-start-from`, once), where its run index is r − 1.
- **The order (pre-registration §2, DELEG9; Fable review finding 4).** For r = 1..10: fill replicate r's three R = 1 plans; run `none@L2` replicate r (20 turns); then `none@L3` r and `mcp@L2` r at once, in two lanes (16 turns each). Lane A runs `none@L3` for odd r and `mcp@L2` for even r; lane B the other. So a block's three cells run hours apart, and no cell sits on one lane. The frozen harness runs this with its own `firstRun` (zero-call check: `results/v1.4-study2b-prereg/per-replicate-dry-run.md`).

### Settings (identical in the three plans except arm, rung, `sharedStart` and `daedalus`; unit test `study2b-plans.test.ts`)

| Setting | Value |
|---|---|
| Generator | `claude-code-cli`, `claude-sonnet-5-5`, `cliVersion` **2.1.304** (the version installed, auto-update off). The live plan probes `claude --version` and stops on a mismatch (`LOOP_CLI_VERSION_MISMATCH`). Record `claude --version` in the run log. The freeze did not re-pin the Claude CLI (D1; rehearsal finding F4), so the pre-registration states this pin |
| Generator argv | the freeze tag's `buildGeneratorArgs`: `--setting-sources ""`, `--settings {autoMemoryEnabled:false, disableAllHooks:true}`, `--disable-slash-commands`, `--strict-mcp-config` (DELEG3; PR #311, merged at `2c1d5576`, inside the tag) |
| Isolation | per-run HOME isolation **off**, as declared for 2a (no `generatorIsolation` block; S3) |
| MCP (`mcp@L2` only) | the server built at the freeze tag (§2), started with `--confine`, outside every cwd; only `daedalus-arch` through `--strict-mcp-config`; the spec-only tools allowed by exact name; `evaluate_project` denied (`--disallowedTools`) |
| Tasks | the sealed `tasks.json`, by absolute path at fill time; sha256 checked twice (§3) |
| Profiles | every task: `layered`, static spec `presets/layered.yaml`, plan pin `specSha256` `f0d9045d…` |
| Frame | `none@L2`, `mcp@L2`: L2; `none@L3`: L3; attention sentence on |
| Acceptance (D12, no waiver) | on: `<testsRoot>/<taskId>/step-NN.test.mjs`, outside every out-root |
| Engine | `cypher-interp` (no Neo4j); scoring v1.3 |
| Other | `allowBash` true, `timeoutMs` 1,200,000, `orderSeed` 20261019 (the harness's seeded task order within a plan), `--call-log` on |

## 2. Layout and the frozen instrument (once, before §3)

`<shared>` is the macOS Shared folder under `/Users/`. `<repo>` is a checkout of `main`. `<sealed>` is the sealed folder beside the repository (`daedalus-sealed/`).

```text
<shared>/daedalus-study2b/
  instrument-4d28d280/        git archive of the freeze tag + npm ci: the generation cwd
  daedalus-build/4d28d280/    the MCP server built at the tag (node, dist/, presets/, production node_modules)
  run/
    plans/r01..r10/           the filled plans per replicate (0600; never opened) and plans.json (hashes, budgets)
    l2/r01..  l3/r01..  mcp/r01..   one out-root per cell and replicate
    h-l2/  h-a/  h-b/         one harness root for the none@L2 phase and one per lane
    order.jsonl               one line per cell, replicate and lane: start and end (UTC)
    logs/                     one log per command
    score/                    rescore/, exposure/<cell>/, telemetry/<cell>.json, mcp-telemetry/
  rehearsal/                  the dress rehearsal (practice tasks only)
```

The out-roots, harness roots and the MCP build never contain one another; `testsRoot` lies outside every out-root (`loadLoopPlan` checks it).

```sh
S=<shared>/daedalus-study2b; TAG=v1.4-freeze-2026-10-20
# 2.1 The instrument tree: the tag, byte for byte, with its own install (prepare builds dist/).
mkdir -p $S/instrument-4d28d280 && git -C <repo> archive $TAG | tar -x -C $S/instrument-4d28d280
npm --prefix $S/instrument-4d28d280 ci --no-audit --no-fund
# 2.2 The MCP server at the tag, outside every cwd.
B=$S/daedalus-build/4d28d280; mkdir -p $B
cp -R $S/instrument-4d28d280/{dist,presets,package.json,package-lock.json} $B/ && cp "$(command -v node)" $B/node
npm --prefix $B ci --omit=dev --ignore-scripts --no-audit --no-fund
shasum -a 256 $B/presets/layered.yaml   # f0d9045de2364b8dae1ca56b584efd67fb035d9807b983ce4e6f8a7e334eade8
# 2.3 Checks: the tag is X and holds the explicit flags; the CLI is the pinned one.
git -C <repo> rev-parse $TAG^{commit}    # 4d28d2803bec018e48f848e6a0f27ff87b3babf2
git -C <repo> merge-base --is-ancestor 2c1d5576 $TAG && echo "PR #311 inside the tag"
grep -c -- '--disable-slash-commands' $S/instrument-4d28d280/scripts/lib/generators/argv.ts   # >= 1
claude --version                          # 2.1.304 (Claude Code)
```

The rehearsal built both trees on 2026-10-20 and the run reuses them. Re-check the four lines of 2.3 on the day.

## 3. Sealed tasks: hash check and plan filling

```sh
shasum -a 256 <sealed>/v14-confirmatory/tasks.json
# must print 6ac2107916d40b2b8b261613828211f71f39f9581927a6a7286c629ce444c5fc. Anything else: STOP, tell the author.
cd <repo>
npx tsx scripts/v1.4/study2b-plans.ts --tasks <sealed>/v14-confirmatory/tasks.json \
  --expect-tasks-sha256 6ac2107916d40b2b8b261613828211f71f39f9581927a6a7286c629ce444c5fc \
  --replicate r --acceptance-root <sealed acceptance root> --daedalus-build $S/daedalus-build/4d28d280 \
  --out $S/run/plans/r$(printf %02d r) | tee $S/run/logs/plans-r$(printf %02d r).log
# Run it for r = 1..10 (one plans folder per replicate).
```

Read only the lines it prints. They must be:
- `tasks: 4; steps per task: 5; replicates R = 1; replicate r alone (run index r − 1)`;
- `acceptance files present: 20 of 20; tasks with every step file: 4 of 4`;
- `tasks with acceptance.startCommand: 4 of 4` (see the rehearsal report, finding F2: the skeleton `package.json` has no `start` script and must stay byte-identical, so without a task `startCommand` every acceptance record is `no-start-command`);
- three plans with `maxCalls` 20, 16 and 16, and `total maxCalls 52`, for each of the 10 replicates (520 in all); exit 0. (`tasks with acceptance.startCommand` is read under the DELEG6 addendum below.)

Any other line is a red gate item: STOP and tell the author. Do not open the sealed folder to look. If the start-block count is below 4, D12 cannot be met as the plans stand. The ways out are listed in the rehearsal report, finding F2. Choosing one is the author's or the coordinator's decision, recorded as a dated deviation before the run.

## 4. Zero-call dry run of the real plans (no model)

Run §5 once with `--dry-run`, into `$S/run-dry/{l2,l3,mcp,h-*}`. It needs no model and no Neo4j. All three grids must report `completed` = `runs` and `turnsThisInvocation.step` = `maxCalls`. A dry `sharedStart` must come from a dry source. Then delete `$S/run-dry/`: its stub snapshots are not data.

## 5. The run (on the author's go only)

Run from the instrument tree. Each command resumes when re-run.

```sh
I=$S/instrument-4d28d280; C=$S/bin/claude-2.1.304   # the pinned binary (DELEG6 addendum)
cd $I
log() { printf '{"cell":"%s","replicate":%d,"lane":"%s","%s":"%s"}\n' "$1" "$2" "$3" "$4" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> $S/run/order.jsonl; }
cell() { # cell, replicate, lane, plan, out-root, harness root, extra flags
  log "$1" "$2" "$3" start
  npx tsx scripts/loop-harness-cli.ts --plan "$4" --out-root "$5" --binary $C --harness-root "$6" --call-log ${7:-} 2>&1 | tee -a $S/run/logs/$1-r$2.log
  log "$1" "$2" "$3" end
}
for n in $(seq 1 10); do
  r=$(printf %02d $n); P=$S/run/plans/r$r
  # none@L2 replicate r, steps 1-5: 20 turns.
  cell none@L2 $n l2 $P/plan-none-L2.json $S/run/l2/r$r $S/run/h-l2
  # none@L3 r and mcp@L2 r branch at step 2 from replicate r's none@L2 out-root: 16 turns each, two lanes at once.
  if [ $((n % 2)) -eq 1 ]; then A=(none@L3 $P/plan-none-L3.json $S/run/l3/r$r); B=(mcp@L2 $P/plan-mcp-L2.json $S/run/mcp/r$r)
  else A=(mcp@L2 $P/plan-mcp-L2.json $S/run/mcp/r$r); B=(none@L3 $P/plan-none-L3.json $S/run/l3/r$r); fi
  cell ${A[0]} $n A ${A[1]} ${A[2]} $S/run/h-a "--shared-start-from $S/run/l2/r$r" &
  cell ${B[0]} $n B ${B[1]} ${B[2]} $S/run/h-b "--shared-start-from $S/run/l2/r$r" &
  wait
done
```

- Each command resumes when re-run: a partial step is redrawn, logged in `restarts.jsonl` and counted (pre-registration §4). Re-run the same `cell` line; never re-run a finished replicate.
- A usage-limit pause resumes and is not a stop. Its duration is in the step records and `order.jsonl`.
- The harness log lines name the task ids. The run session may see them: this is the run.
- The two branch cells of replicate r start only after `none@L2` replicate r has finished all its runs.

## 6. Scoring at the freeze tag (zero model calls, no Neo4j)

Score in a checkout of the tag with the post-freeze scoring files copied in, untracked, so `git rev-parse HEAD` (recorded as `runCommit`) is X.

```sh
W=$S/score-4d28d280
git -C <repo> worktree add --detach $W v1.4-freeze-2026-10-20
ln -s <repo>/node_modules $W/node_modules     # package files are identical at the tag and on main
for f in scripts/v1.4/stage-c-rescore.ts scripts/v1.4/lib/stage-c.ts scripts/v1.4/mcp-telemetry.ts scripts/v1.4/lib/mcp-telemetry.ts \
         scripts/v1.4/d-dagger.ts scripts/v1.4/lib/d-dagger.ts scripts/v1.4/lib/exposure.ts; do
  git -C <repo> show main:$f > $W/$f; done
cd $W && test "$(git rev-parse HEAD)" = 4d28d2803bec018e48f848e6a0f27ff87b3babf2
NM=$S/run/h-l2/skeleton-install/node_modules; O=$S/run/score
# 6.1 Re-score every snapshot at the tag, check-correct every blocking finding, and D, Y1, Yk per run (driftRun, STUDY2_S2D01).
CELLS=$(for r in $(seq -w 1 10); do printf -- '--cell none@L2=%s --cell none@L3=%s --cell mcp@L2=%s ' $S/run/l2/r$r $S/run/l3/r$r $S/run/mcp/r$r; done)
npx tsx scripts/v1.4/stage-c-rescore.ts $CELLS --node-modules $NM --out $O/rescore --tag v1.4-freeze-2026-10-20
# 6.1b D† (no composition-root exemption) and the evasion bar's inputs (pre-registration §1, §4).
npx tsx scripts/v1.4/d-dagger.ts $CELLS --node-modules $NM --out $O/d-dagger
# 6.2 Exposure per rule, one out-root at a time.
for c in l2 l3 mcp; do npx tsx scripts/v1.4/exposure-count.ts --steps $S/run/$c --node-modules $NM --out $O/exposure/$c; done   # each walks its r01..r10
# 6.3 Telemetry completeness (D6) per out-root, and the MCP tool-call table.
for c in l2 l3 mcp; do for r in $(seq -w 1 10); do npx tsx scripts/v1.4/loop-telemetry-check.ts $S/run/$c/r$r --json $O/telemetry/$c-r$r.json; done; done
for r in $(seq -w 1 10); do npx tsx scripts/v1.4/mcp-telemetry.ts --out-root $S/run/mcp/r$r --out $O/mcp-telemetry/r$r; done
```

What each gives, and the check:
- `rescore/analysis.json`: `snapshots.evaluationFailures` must be 0. `findings.byVerdict` gives the check-correct labels; the registered D counts `correct` only. `summaries.registered` is D per cell; `ratios` are against `none@L2`. `runs.json` has D, Y₁, Yₖ and the inherited-removal counts per run, in three readings. The `stopCheck` and `semanticSample` fields are 2a items and are not 2b outcomes.
- `exposure/<cell>/exposure.json`: opportunities and violations per rule; exit 0 means every row check passed and every recorded count matched.
- `telemetry/<cell>.json`: 0 problems for `none@L2` and `none@L3`. For `mcp@L2`, exactly 2 lines per run, both `step-01` ("no process block", "call log missing"): that is the inherited step-1 record, which has no MCP turn (rehearsal finding F3). Any other line is a problem. `mcp-telemetry/telemetry.json`: calls per tool, turns that used each tool, check verdicts, and `logMismatches` (must be 0).
- The confirmatory contrasts (H1, H2, H3, E), V4 and the sensitivity lines are computed by the registered analysis script (pre-registration §4; sha256 in P8): `npx tsx scripts/v1.4/study2b-analyse.ts --runs $O/rescore/runs.json --analysis $O/rescore/analysis.json --dagger $O/d-dagger/runs.json --recall <cell>=<seeded-recall run.json> ... --telemetry $O/mcp-telemetry/r01/telemetry.json ... (one per replicate) --order <order file> --acceptance <post-run acceptance file> --out $O/analysis`.

Afterwards: copy the step records, call logs and score files into `results/v1.4-study2b/` with no absolute path (`npm run lint:citations`), and remove the worktree (`git -C <repo> worktree remove $W`).

## 7. Stop rules during the run

- **Never re-run a finished sealed run for any reason.** A resume of an unfinished run is allowed: it is the harness's own restart.
- A harness exit 1 (CLI missing or version mismatch) or 2 (plan or harness error) stops the run: record the message, then tell the author.
- No `HEAVY_ADMISSION_BYPASS`, no Neo4j, at most two lanes, `jest --maxWorkers=2`.

## Addendum 2026-10-20 (DELEG6, before any 2b call)

- **Generator binary.** Use the private copy `<shared>/daedalus-study2b/bin/claude-2.1.304` as `--binary`, not the `claude` symlink, which the auto-updater can switch to a newer version. Before step 1, check `claude-2.1.304 --version` = `2.1.304 (Claude Code)` and its sha256 = `b9ac5374839f14abf3f1f45610637c332b5daee5ce0d1634726cef87aab78e6a`. Any mismatch stops the run.
- **Acceptance (D12).** The fill-time line "tasks with `acceptance.startCommand`: 4 of 4" is **replaced** by the DELEG6 rule (`ops/decisions.md`): acceptance runs after the run on the stored snapshots, with zero calls, under the fixed start rule. The run itself goes ahead with in-loop acceptance recording `no-start-command`, which is expected and not a failure.

## Addendum 2026-10-20 (Fable review answers, before any 2b call)

- **Run order per replicate (finding 4, DELEG9).** §1, §3 and §5 above fill and run replicate by replicate, with the lanes alternating. §4's dry run is run the same way, into `$S/run-dry/`.
- **Acceptance after the run (DELEG6, entry rule refined by DELEG8).** Pre-registration §4, "Post-run acceptance". In-loop acceptance stays on; its `no-start-command` records are expected.
- **Scoring adds D† and the analysis script** (§6).
- **D14.** A live kill-and-resume passed on a practice task (`results/v1.4-study2b-prereg/d14-kill-resume.md`).

## Changelog
- 2026-10-20: the Fable review's run-order, acceptance and scoring answers (addendum above).
- 2026-10-20: first version, with the rehearsal's findings applied (§3 acceptance lines).
