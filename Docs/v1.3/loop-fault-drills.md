# v1.3 loop fault drills: 11 of 13 scripted faults resume to the same bytes; 2 do not, and some call sites are not drilled

**2026-10-16. Status: done; development evidence only. 11 of 13 drills pass; the two that do not are reported below and not fixed.** Backlog job #7 (S1). No LLM, judge or other model was called. The pilot and the dress rehearsal have not run. Nothing under the sealed directory was read, and no Study 2 task is named or derived here: the drills use only the three pilot replay tapes of PR #142.

Code: `scripts/v1.3/loop-fault-drills.ts` (entry: `npm run loop:fault-drills -- [--only D1a,D3a] [--report <file>]`). Results: `results/v1.3/loop-fault-drills/drills.json` (after the fixes) and `drills-before-fix.json` (the same drills before the fixes). Tests: `tests/unit/scripts/loop/loop.test.ts`.

**Base.** PR #142 (`origin/v1.3-loop-replay`) was not merged into `origin/v1.3` when this ran. This branch merges it locally (merge commit on this branch) and builds on top of it. If #142 changes before it merges, this branch needs a merge from it.

## 1. Method

**Order of work (rule 11).** The drill list and the pass criterion were committed first (`0279d65c`), before any drill ran. The implementation was added afterwards and changed neither.

**Engine.** `cypher-interp`, the in-process interpreter. No Neo4j server was started. On this engine the full clean replay (3 tasks × 3 arms) gives digest `8b8f8693…`, the same digest #142 reported on Neo4j 5.26.24.

**One drill.**
- Each drill runs one (task, arm) of the replay tapes in a fresh outRoot, in child processes (`node --import tsx`).
- Phase 1 runs with the fault armed. Phases 2 and later run with no fault until the run completes. Each phase is a fresh process, as when an operator reruns the same command.
- The undisturbed reference is the same (task, arm, agent shape), replayed twice. The two replays must be byte-identical, which shows the clean path is unchanged.
- Every replay runs at the same absolute path, because the CLI-shaped records name the harness root in their argv.

**Agent shapes.**
- `direct`: the `ScriptedStepAgent` of #142.
- `cli`: the real `ClaudeStepAgent`, with the E1 argv, `runWithRetries`, envelope parsing and `attemptDisposition`. It runs over a scripted `ProcessRunner` that plays the CLI: the edits come from the same tapes and stdout is a CLI envelope. The usage-limit drills need this shape, because the classification lives on that path.

**Fault injection.** Through two optional hooks added to `runReplay`, `decorate.agent` and `decorate.typechecker`. Both are absent in the replay itself. Faults can also come through the injected `evaluateDeps`.

**Pass criterion (`loop-fault-drills/pass/v1`).** A drill passes when all three of these hold:
- **(i) Classified.** The fault is visible in what phase 1 leaves.
- **(ii) Byte-identical after resume.** After the resume, the outRoot equals the reference under #142's comparer (`compareReplays`), apart from the fault record itself:
  - `restarts.jsonl`;
  - `discarded/**`;
  - `interruptions/**`;
  - for D3a only, the faulted turn's `result.interruptions`.
- **(iii) Same trajectory.** No duplicated turn, no skipped step and no arm conversion: every step has the same turn kinds, repair record and final commit as the reference.

## 2. Results (after the fixes)

| Drill | Fault (target: market-vendors/gate unless noted) | Classification observed | Resume | Bytes identical | Gate lines |
|---|---|---|---|---|---|
| D1a | SIGKILL inside the step-3 turn, edits on disk, no commit | process killed (SIGKILL); restart line `resumeAtStep 3`, `discardedChanges 3` | phase 2 completes | yes | D14 |
| D1b | SIGKILL inside the step-2 repair turn | SIGKILL; restart `resumeAtStep 2`, `discardedHead` = the step-2 step-turn commit | yes | yes | D14 |
| D2a | SIGKILL after the step-2 commit, before type-check and scoring | SIGKILL; restart `resumeAtStep 2`, `discardedHead` = the unscored commit | yes | yes | D14, D7 |
| D2b | relief-volunteers (DDD)/gate: SIGKILL after the step-1 evaluation; spec frozen, no step record | SIGKILL; restart `resumeAtStep 1`; the spec is frozen again from the rerun step 1, same bytes | yes | yes | D14, D7 |
| D3a | `cli` shape: the first step-2 call writes part of the step, then returns the E1 limit envelope (exit 1, `You've hit your limit · resets …`) | turn records 1 interruption, `movedTo interruptions/<runId>/step-02/0` (archive present); no attempt consumed; same turn resumes in-process | phase 1 completes | yes (only `result.interruptions` differs) | S1 |
| D3b | `cli` shape: limit persists past the policy (`maxInterruptions` 1, two limits in a row) at step 3 | phase 1 `GEN_USAGE_LIMIT_PERSISTS`, no step-3 record; restart `resumeAtStep 3` | yes | yes | S1, D14 |
| D4a | the pipeline throws on the step-2 step-turn snapshot (the step the gate must repair) | **before the fix:** recorded as `PIPELINE_FAILED`, then the gate skipped the repair and the run went on (defect F1). **After:** `LOOP_GATE_UNSCORED (PIPELINE_FAILED …)`; the run stops | yes | yes | D7, D14 |
| D4b | graph unreachable on the step-2 snapshot (`NEO4J_UNREACHABLE`, the `--engine neo4j` failure mode, simulated without a server) | as D4a, with `NEO4J_UNREACHABLE` | yes | yes | D7, D14 |
| D4c | market-vendors/**none**: the pipeline throws on step 2 | `evaluationError PIPELINE_FAILED` on the step-2 snapshot; the run completes | resume skips the completed run | **no** (`steps/step-02.json`, and `report-step-02.json` missing) | D7 |
| D5a | type-check of record exits 2 with no diagnostics at step 3 (E1 `harnessTypechecker` mapping) | the step-3 snapshot has typecheck codes `["TSC_EXIT_2"]`; the run completes | resume skips the completed run | **no** (`steps/step-03.json`) | D7 |
| D5b | type-check of record cannot be spawned at step 3 | phase 1 `PROCESS_SPAWN_FAILED`, no step-3 record; restart `resumeAtStep 3` | yes | yes | D14 |
| D6 | snapshot store on a full tmpfs (real ENOSPC) when step 3 commits; filler removed before resume | phase 1 `LOOP_SNAPSHOT_GIT: git add failed: fatal: unable to write loose object file: No space left on device`; restart `resumeAtStep 3`; no stale lock left | yes | yes | D14 |
| D7 | completed run, `steps/step-02.json` cut to half its bytes | **before the fix:** restart line said "resume at step 2", but not why. **After:** `records: [{steps/step-02.json, unreadable}, {steps/step-03.json, after-gap}, {steps/step-04.json, after-gap}]`, `setAside: discarded/restart-1` | yes | yes | D14, D7 |

**Before the fixes:** 8 of 13 passed (`drills-before-fix.json`). D4a, D4b, D4c, D5a and D7 failed.

**Other checks.**
- The references were self-identical for all four (task, arm, shape) pairs.
- The full 9-run clean replay is byte-identical before and after this branch's loop changes: 321 files, digest `8b8f8693…`.
- No drill duplicated a turn or skipped a step. After the fix, no drill converted an arm.

## 3. Defects

### Fixed (each with a failing test first)

**F1, blocking (R01 family): on an unscored step, the gate arm silently became `none`.**
- What happened: the gate needs an evaluation to decide on a step. When the evaluation of the step turn's snapshot failed (D4a: the pipeline threw; D4b: Neo4j unreachable), the loop recorded the error, ran no repair turn, and went on to the next step from the unrepaired tree. The run then completed normally.
- Effect in D4a and D4b: the step-2 violation was never repaired, and every later commit differed from the reference.
- Fix: in the gate arm only, an evaluation failure on the step turn's snapshot is now a harness failure, `LOOP_GATE_UNSCORED`, whose message carries the underlying code. The run stops with no step record, and a resume reruns the step. The `none` and `daedalus-mcp` arms keep the old behaviour: the error is recorded and the run goes on.
- Unchanged cases:
  - A failed evaluation of the *repair* snapshot is still recorded and the run goes on, because the gate has already acted.
  - A spec that could not be frozen (`LOOP_SPEC_FREEZE_FAILED` / `LOOP_SPEC_NOT_FROZEN`) is excluded on purpose. It is #142's risk 2 and an author decision (see §4).
- Tests: `gate: an unscored step-turn snapshot stops the run…` and `gate: an unscored repair snapshot is recorded…`.
- Behaviour change: the old test asserted the old gate behaviour. It now covers the `none` arm only.

**F2: a resume did not say why it reran, and could leave stale turn records.**
- D7: when a step record was unreadable, the restart line said "resume at step 2" with no reason. The rerun then overwrote the readable later records (steps 3–4), and that evidence was lost.
- A discarded partial step also left its turn files in `turns/step-NN/` (prompt, report, envelope). A real model's rerun can take a different path, for example no repair turn, and a stale `prompt-step-02-repair.txt` would then sit beside the new records.
- Fix:
  - The restart line now lists every step record at or after the gap, with its state (`unreadable` or `after-gap`).
  - Those records, and the turn records of every step that reruns, are moved to `discarded/restart-<n>/`.
  - The clean path is unaffected: nothing is moved when no restart happens.
- Tests: `a truncated step record: …` and `turn records of a discarded partial step do not survive into its rerun`.

**F3 (in #142's comparer): `canonicalTree` threw on a `.json` file that is not JSON.** After F2, the truncated record is kept under `discarded/`, and the comparer crashed on it. It now hashes such a file raw.

### Not fixed (reported for the author)

**R1 (D4c): an unscored snapshot in `none` or `daedalus-mcp` is never re-scored.**
- The design records the error and keeps the commit "so it can be re-scored". But no tool re-scores it, and a resume skips the completed run.
- The step's memo §3/§4 outcome stays missing. The trajectory is not affected.
- Options:
  - (a) An opt-in re-score of unscored snapshots on resume.
  - (b) The F1 stop rule for every arm. This costs one rerun turn per failure.
  - (c) Accept the gap and re-score offline before analysis.
- Not chosen here.

**R2 (D5a): a type-check crash is recorded as the agent's type-check result.**
- When the type-check of record exits non-zero with no diagnostics, or times out, the snapshot gets the synthetic code `TSC_EXIT_<n>` / `TSC_TIMEOUT` as one "error", and the run goes on.
- The code is distinguishable, but the guard metric "type-check errors per step" counts it, and nothing re-runs it.
- This is the E1 mapping (`runHarnessTypecheck`), which the loop shares with the E1 grid. Changing it is a semantic change, not a pure bug fix.
- Suggested: in the loop, treat a result made only of synthetic codes as a harness failure (stop and resume), or retry it once.

**R3 (S1 gap): pause times are not recorded.**
- D3a shows that a usage-limit interruption records only `{at, subtype, movedTo}` (`GenerationInterruption`). It has no pause end or duration.
- `wallMs` includes the pause, so the gate's S1 "pause time recorded" is not met. This branch does not change that.
- S1 also names the judge and labeller call sites, which were not drilled here.

**R4: a failed gate step reruns the agent turn.** The F1 stop discards the step turn's commit on resume, so a transient evaluator outage costs one more model turn per affected gate step. Re-evaluating the kept commit on resume would avoid that. It is a larger change and was not made.

## 4. What this does to the readiness gate (lines named, status not changed here)

- **D14 (live resume).**
  - A run killed mid-step (D1a, D1b, D2a, D2b), stopped by a persisting limit (D3b), a spawn failure (D5b), a full disk (D6), or a corrupted record (D7) resumes from its last snapshot, with no duplicated or lost step. It ends byte-identical to an undisturbed run.
  - This is the scripted-agent half of the check. The gate's "live" part still needs the rehearsal with a real CLI.
- **S1 (usage limits).**
  - The step-turn path classifies a limit, consumes no attempt, archives the partial tree, restores, pauses and resumes the same turn (D3a). A persisting limit stops the run cleanly, and the run resumes (D3b).
  - Still missing: pause times (R3), the repair-turn, judge, labeller and init-probe call sites, and a real CLI envelope from the rehearsal.
- **D7 (reproducibility).** The deterministic replay holds under faults. An unscored snapshot is still not re-scored (R1), and a type-check crash stays in the record (R2).
- **Author decision still open (#142 risk 2).** A DDD gate run whose spec cannot be frozen still runs every step without a gate. The freeze failure is recorded once, in `spec/spec.json`. F1 deliberately leaves this case alone.

## 5. Reproduce

```bash
npm ci
npm run loop:fault-drills -- --report "$(mktemp -d)/drills.json"   # about 5 minutes; exit 1 while D4c or D5a fail
npx jest --maxWorkers=2 tests/unit/scripts/loop
```

D6 mounts a tmpfs, so it needs root, or mount rights, in a disposable container. The other drills need neither.
