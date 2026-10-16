# Study 2 dress rehearsal: one small, complete run

**2026-10-16. Status: plan; nothing has run.** This plan describes **one** small rehearsal of Study 2, end to end. It uses real agents, every arm, every pipeline stage and the final analysis script, on tasks that are not sealed. Its job is to turn the operational lines of `Docs/v1.3/study2-readiness-gate.md` green, so that Study 2 itself cannot fail on plumbing, budget or telemetry. It is not a pilot: it estimates no arm effect, and it informs nothing about erosion. It is not a pre-registration, and it does not create one. No sealed directory was opened to write it.

**Amendment, 2026-10-16.** The arms are now `none` and `daedalus-mcp`, crossed with the five cells none@L2, none@L3, none@L4, mcp@L2 and mcp@L4, and the generators are Sonnet 5.5 and the Codex pin (`Docs/v1.3/study2-deviation-2026-10-16.md`). The rehearsal exercises every cell type and both generators, with 0 evaluation errors (S7). It runs at k = 4, the Study 2 horizon (k = 4 also leaves the per-run slope, now a registered secondary, a residual). Its size is re-stated below; the original three-arm and five-arm figures are kept and marked superseded. In Study 2's canonical order the rehearsal comes after the freeze and the hold-out and before the pre-registration.

<!-- study2-protocol: primary=Y-distinct-blocking-edges-at-step-k; k=4; arms=none,daedalus-mcp; unit=distinct-edge; fallback=do-not-run; order=freeze,hold-out,dress-rehearsal,pre-registration,gate,run; generators=claude-sonnet-5-5,codex-pin -->

## 1. When it runs

1. **After the loop pilot** (`Docs/v1.3/pilot-outcome-memo.md`). The pilot decides the primary outcome (gate D1) and gives θ and the slope SD (gate D3). The rehearsal does not replace it.
2. **After these decisions and code exist** (entry conditions; the rehearsal cannot test what is not yet built):
   - the arm set (gate D11) and the no-hint decision (S5);
   - the DDD freeze failure rule (D15);
   - PR #142 (loop replay: tsconfig fix, `advisoryByRule`, uncapped findings, reproducible snapshots) merged into `v1.3`;
   - the per-task spec for `daedalus-mcp` (D11 c) and the hexagonal and DDD rules in `check_file` / `check_diff` (V9);
   - the Claude CLI version pin (S2) and the dedicated Claude config dir and HOME (S3);
   - the MCP call log (D6) and pause-duration field (S1);
   - the telemetry checker (D6), the analysis script (D9), and the guard and Q4 measures (D13, D16);
   - the Study 2 model list with pinned ids and CLI versions;
   - acceptance checks, if adopted (D12), written for the rehearsal steps.
3. **At the candidate run commit.** The rehearsal runs at the commit intended to run Study 2, with only the tasks file and the grid size different. Any later change under `src/`, `scripts/lib/loop/`, `scripts/lib/generators/`, `presets/`, `specs/`, the frames or the MCP tool descriptions turns every rehearsal-derived gate line red again. A second rehearsal is then needed. This is why the entry list is long: one rehearsal should be enough.

## 2. Tasks (not sealed)

The rehearsal reuses the three loop-pilot tasks, **steps 1 to 3 only**, as a separate tasks file, `experiments/study2-rehearsal/rehearsal-tasks.json`, with its own sha256 recorded before the first call.

Why these tasks:
- They are already excluded from Study 2 forever (`pilot-outcome-memo.md:74`), and the author has already checked them against the sealed list without disclosing it (`pilot-tasks.md:8`).
- They were written in plain product language without layer or pattern names (`pilot-tasks.md:10`), so the hint audit procedure (gate D2) can be rehearsed on text that is allowed to be read.
- They cover the three styles the loop supports: Clean (`market-vendors`, static `specs/clean-arch.yaml`), Hexagonal (`shelter-adoptions`, static `presets/hexagonal.yaml`) and DDD (`relief-volunteers`, ISE-frozen spec). Each style takes a different scoring path, and the DDD freeze is its own failure point (D15).
- Step 1 already contains an external integration, and steps 2 and 3 add a cross-module feature and a second adapter (`pilot-tasks.md:9`), so the gate's repair turn has something to fire on.

If acceptance checks are adopted (D12), they are written for these 9 steps, hashed and kept out of every agent's cwd, exactly as the Study 2 checks would be.

## 3. Grid: the smallest one that exercises everything

| Factor | Value | Why this is the minimum |
|---|---|---|
| Steps per task | **k = 4** (amended 2026-10-16, the Study 2 horizon; the superseded value was k = 3, for the reason that follows) | k = 1 exercises only the first-step frame and the DDD freeze. k = 2 adds the next-step frame and "new finding" identity across steps, but the per-run OLS slope then fits 2 points exactly: its residual variance, the slope variance of the GLMM and every bootstrap interval are degenerate, so the analysis script is not really tested. k = 3 is the first k with a residual. It also leaves a step after a resumed step (§4.3). |
| Styles / tasks | **3** (one per style) | Every style has its own spec path. |
| Models | **every Study 2 model** (working list: 2 Claude pins and 1 Codex pin, `study2-outline.md:112`) | Each adapter and model has its own failure modes: Haiku failed type-check in E1 (gate S8), and the Codex MCP wiring is untested live (S4). |
| Model × task | **Latin square**: each model gets one task, each task one model | This exercises every model with every arm and every style with every arm in 3 blocks, instead of 9. Model × style pairs are not needed for plumbing. |
| Arms | **every Study 2 arm and cell**: `none` and `daedalus-mcp` across the five cells, with both generators (amended 2026-10-16; the superseded text listed `gate`, the placebo and a no-hint arm) | All cells in every block, as in Study 2. |
| Replicates | **1** | Replicates add no new code path. |
| Blocks | 3 (task × model) | Enough for the paired test and the task-level variant to run (3 clusters), not to mean anything. |

**Runs and turns.**
- Amended 2026-10-16: 3 tasks × 2 generators (6 blocks) × 5 cells = **30 runs**, 120 step turns at k = 4, no repair turns. The two lines below are the superseded three-arm and five-arm sizes.
- (Superseded) With 3 arms: 3 blocks × 3 arms = **9 runs**, 27 step turns, at most 9 gate repair turns: **at most 36 model turns**.
- (Superseded) With 5 arms (placebo and no-hint): **15 runs**, 45 step turns, at most 9 repair turns and at most 9 placebo turns: **at most 63 model turns**.
- The plan's `callBudget` states the exact figure, and `loadLoopPlan` refuses a plan whose budget does not match (`loop-pilot-readiness.md:92`).

## 4. Every pipeline stage, in order

Each stage lists the gate lines it produces evidence for. Outputs go to an out-root outside the repository; summaries without absolute paths go to `results/v1.3-study2-rehearsal/`.

### 4.1 Before the first model call

| # | Stage | Command or artefact | Gate lines |
|---|---|---|---|
| 1 | Hash every frozen tunable and compare with the candidate pre-registration table | the S11 hash script | S11 (rehearsed) |
| 2 | Hint audit of the rehearsal tasks, frames, repair text and tool sentence | the D2 audit sheet; `npx jest tests/unit/scripts/loop/pilot.test.ts` | D2 (procedure), V11 (rehearsal inputs) |
| 3 | Unseal drill with a **dummy** sealed file (made for the drill, outside the repo) | `sha256sum` by the person who will unseal; tasks path outside every cwd | S14 (procedure) |
| 4 | CLI and model pins; auto-update off | the harness refuses a wrong `--version` | S2 |
| 5 | Isolation canary for both CLIs with the production env | `scripts/generator/probes/confinement-cli.ts`, `codex-confinement-cli.ts` | S3 |
| 6 | Confinement probes with `daedalus-mcp` attached, per CLI × arm | same probes, MCP config of the plan | S4, V10 (a) |
| 7 | Dry run of the rehearsal plan | `npx tsx scripts/loop-harness-cli.ts --plan experiments/study2-rehearsal/plan.json --dry-run --out-root <tmp>` | D14 |
| 8 | Scratch Neo4j at the pinned digest | `docker compose up -d neo4j` (`Docs/environment.md:30-32`) | D7, D8 |

### 4.2 The live grid

```bash
npx tsx scripts/loop-harness-cli.ts --plan experiments/study2-rehearsal/plan.json \
  --binary <pinned claude> --codex-home <abs> --codex-user-home <abs> \
  --harness-root <abs, one per lane> --out-root <abs>
```

Per step and arm this runs the real stages: work directory, the agent turn (with MCP for `daedalus-mcp`), the snapshot commit, the type-check with the pinned per-run tsconfig, the symbolic evaluation on Neo4j, the DDD spec freeze after step 1, and for `gate` the repair turn and its re-evaluation. One lane per harness root, or strictly sequential (S9).

### 4.3 Fault drills (deliberate, each once)

| Drill | How | Expected | Gate lines |
|---|---|---|---|
| Usage limit | For one designated turn, `--binary` points to a thin shim that prints the recorded real usage-limit text and exits; every other call passes straight through to the pinned CLI. | Classified `usage-limit`, no attempt consumed, pause and resume, pause duration in the record. | S1 |
| Infrastructure failure | The shim exits non-zero once on another turn. | One retry from the last snapshot (`scripts/lib/generators/retry.ts:35-41`). | S1, D14 |
| Harness kill | `kill -9` the harness during step 2 of one run, then re-run the same command. | The partial step is discarded to `restarts.jsonl`, step 2 reruns, step 3 follows; no duplicated or missing step. | D14 (live resume) |
| DDD freeze failure | Only if it happens naturally; if not, it is shown by the replay test. | The D15 rule applies and is recorded. | D15 |

The shim is used in the rehearsal only. Its use is recorded in the run provenance, and it never appears in the Study 2 plan.

### 4.4 After the grid

| # | Stage | Command or artefact | Gate lines |
|---|---|---|---|
| 9 | Telemetry completeness | the D6 checker on the out-root, exit 0 | D6, S1, S6, D13 |
| 10 | MCP latency from the call log | p95 per call and tool time share per step | D5 |
| 11 | Evaluation errors | `jq` for `evaluationError` over all step records | S7 |
| 12 | New blocking findings labelled | `scripts/v1.3/check-correct.ts` on each new blocking finding (memo §3 rule); `not-checkable` items listed for the author | memo §3 path |
| 13 | Graph fidelity on every snapshot | `scripts/v1.3/graph-fidelity.ts project --views` | V8 (snapshot part) |
| 14 | MCP vs full evaluation on every snapshot | `scripts/v1.3/mcp-consistency.ts` | V9 (snapshot part) |
| 15 | Q4 measures | held-out rules and dependency-cruiser on every snapshot | D16 |
| 16 | Judge dimensions, offline, if Study 2 keeps them (V7) | frozen judge version, pinned CLI, cassettes recorded | V7 (operational part), S15 |
| 17 | Re-score determinism | re-evaluate every snapshot from its commit; `diff -r` ignoring timing keys | D7 |
| 18 | Scripted replay at the same commit | `npm run loop:replay`, `npm run test:loop-replay` | D7 |
| 19 | Interpreter parity, if the interpreter is used anywhere | `scripts/v1.3/memory-parity.ts --engine cypher-interp` on the snapshots | D8 |
| 20 | Archive | tar of the out-root and snapshot stores, sha256 committed; path and secret scan | S12 |
| 21 | **Analysis script, end to end** | the D9 script on the rehearsal out-root, producing every final table of the planned report; then on a synthetic out-root with a planted effect, which it must recover | D9 |
| 22 | Cost and time table | per model, arm and turn kind; pauses apart | D4, S8 |
| 23 | CI hash gate | a throw-away PR that changes a registered artefact is refused | S10 |

## 5. What the rehearsal must not do

- **No arm effect is read.** The analysis tables contain arm contrasts because the script must produce them, but no rehearsal contrast is quoted, plotted outside the rehearsal report, or used to choose R, k, arms, tiers, prompts or rules. The rehearsal report prints "not an estimate" on every contrast table.
- **No tuning.** As in pilot memo §6: a defect found by the rehearsal is fixed and tested on development data or the replay, never on rehearsal outputs. A fix to frozen code triggers §1.3.
- **No sealed material.** The sealed task list is not opened; the unseal drill uses a dummy file.
- **No outputs inside any agent's cwd** (as in E1 and the pilot).

## 6. Expected cost and time

At the outline's 2 to 6 USD API-equivalent per model turn (`study2-outline.md:137`):

| Arm set | Model turns (max) | Cost, API-equivalent |
|---|---|---|
| 5 cells × 3 tasks × 2 generators (6 blocks), k = 4 (amended 2026-10-16) | 120 step turns | about 18 to 50 USD at the loop pilot's 0.15–0.42 USD per Sonnet turn; Codex per-turn cost unmeasured |
| 3 arms with `gate` (superseded) | 36 | **72 to 216 USD** |
| 5 arms (with placebo and no-hint) | 63 | **126 to 378 USD** |

Plus, outside that range:
- **Infrastructure retries:** at most 2 per turn (E1 policy), expected none or few.
- **Fault drills:** the usage-limit and failure drills cost no model call; the resume drill repeats at most one step turn.
- **Confinement probes:** a handful of short calls per CLI × arm.
- **Judge (only if kept, V7):** about 2 dimensions × 3 votes per snapshot, so roughly 220 to 380 judge calls for 36 to 63 snapshots. They run under the subscription with cassettes; the call count is the budget figure to approve.
- **No model calls** for evaluation, `check-correct`, fidelity, Q4 measures, parity, replay or analysis.

**Wall time.** At 5 to 15 minutes per model turn (the turn timeout is 20 minutes, `loop-pilot-readiness.md:87`), 36 turns take about 3 to 9 hours sequentially and 63 turns about 5 to 16 hours, plus usage-window pauses. Plan **two calendar days** for the grid and one for §4.4. Under the subscription login, the limiting factor is the usage window, not money; the rehearsal measures exactly that (gate D4).

The rehearsal costs about one tenth of the working Study 2 grid (36 to 63 turns against 650 to 970 step turns, `study2-outline.md:117-118`). Its purpose is to make sure that the expensive run only has to happen once.

## 7. Gate lines it turns green

If every stage passes, the rehearsal provides the evidence for these lines. Each must still be re-verified at the final run commit (gate rule 3).

| Turned green by the rehearsal | Turned green only in part |
|---|---|
| S1 (loop call sites), S3, S4, S6, S7, S8, S9, S12, D4, D5, D6, D7, D8, D9, D13, D14 (live resume), D15 (behaviour shown), D16 | V8 (snapshot fidelity; the adjudication is separate), V9 (snapshot agreement; the reference-set run is separate), V10 (a) (non-Claude generator passes probes), V11 (rehearsal inputs; the sealed tasks need the unsealer), D2 (procedure; the sealed audit needs the unsealer), S14 (drill only), S10 (if the CI change is in), V7 (operational part only) |

**Lines the rehearsal cannot turn green.** These need the pilot, the hold-out, people or decisions: V1, V2 (already green), V3, V4, V5, V6, V7 (the decision), V10 (b, c), S2 (the code, though the rehearsal exercises it), S5, S11 (the final table), S13, S15, D1, D3 (it needs the pilot's θ; the rehearsal supplies only cost), D10, D11, D12.

## 8. Exit

The rehearsal is complete when stages 1 to 23 have run, the rehearsal report `Docs/DiagnosticRuns/v1.3-study2-rehearsal-<date>.md` lists each stage with its result, and each gate line in §7 has its evidence file in `results/v1.3-study2-gate/`. A failed stage is fixed under §5, and then only the affected stages are re-run, unless the fix touches frozen code (§1.3), in which case the whole rehearsal is run again.
