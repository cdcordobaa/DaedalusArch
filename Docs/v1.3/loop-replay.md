# v1.3 loop replay: the pilot harness end to end, without an LLM

**2026-10-16. Status: done; the pilot has not run.** This note proves the firewall-in-the-loop harness works end to end, so the real pilot (`Docs/v1.3/pilot-outcome-memo.md`) cannot fail on plumbing. No generator LLM, judge or other model was called. The pilot still needs the author's go. This note changes nothing in the memo, the tasks, the specs, the presets or the step and repair frames. Every hash in memo §7 and `loop-pilot-readiness.md` §7 is unchanged.

Code: `scripts/lib/loop/replay.ts` (scripted agent and wiring), `replay-tapes.ts` (the recorded edits), `replay-verify.ts` (the checks), `pilot-metrics.ts` (memo §3 and §4 outcomes). Entry: `npm run loop:replay` (`scripts/loop-replay-cli.ts`). Test: `npm run test:loop-replay` (`tests/integration/loop/loop-replay.test.ts`, jest `--maxWorkers=2`; it skips without a scratch Neo4j).

## 1. What runs

**Real components:**
- The pilot plan `experiments/loop-pilot/plan.json`: its tasks file and its task profiles. These are the style frames, `specs/clean-arch.yaml`, `presets/hexagonal.yaml`, and the DDD spec the ISE infers from step 1 and then freezes.
- `runLoop`: work directories, the snapshot store, measures, the gate's repair turn and `repairOutcome`.
- The v1.3 symbolic evaluator `evaluate_project`.
- The MCP handlers `check_diff` and `check_file`, called in process.

**Engine.** When this branch was cut, `--engine cypher-interp` was not on `origin/v1.3`, so the replay uses Neo4j Community 5.26.24 with APOC 5.26.24, from the release tarballs (the server and APOC versions of `Docs/environment.md`). The interpreter has since merged (PR #128). The replay still runs on Neo4j by default; `--engine cypher-interp` runs it on the interpreter (§5). After merging the new base (MCP v2 included), the test still passes unchanged, and the MCP gap in §4 still holds.

**Replaced components:**
- The generator becomes `ScriptedStepAgent`.
- The E1 type-check of record becomes `inProcessTypechecker`. It writes the same pinned per-run tsconfig and compiles it through the TypeScript API, so no skeleton install is needed.

**Tapes.** Three pilot tasks, 4 steps each. Each tape has one step that introduces a blocking violation; the step after it carries the fix. Every other step stays clean.

| Task (style) | Violating step | What it does | Blocking findings (full evaluation) |
|---|---|---|---|
| `market-vendors` (Clean) | 2 | `src/domain/settlement.ts` imports `src/infrastructure/payout-client.ts` | FF-S01 dependency-direction, FF-S04 no-domain-outward-dep |
| `shelter-adoptions` (Hexagonal) | 3 | `src/domain/notification.ts` imports `src/adapters/outbound/textbridge-client.ts` | FF-S01 dependency-direction-graph, FF-S04 core-isolation |
| `relief-volunteers` (DDD) | 2 | `src/deployment/application/assign-volunteer.ts` imports `src/registry/domain/volunteer/volunteer.ts` | FF-DS02 context-isolation |

**What the agent does in each arm:**
- `none`: applies the step's edits and nothing else.
- `daedalus-mcp`: applies the edits, then calls `check_diff` on the turn's diff and `check_file` on every file it wrote. If a tool reports violations, it applies the scripted fix and checks the fixed files again.
- `gate`: the harness runs a repair turn only when the step's snapshot has blocking findings, and that repair turn applies the scripted fix.

**Mapping of "rejected".** In the harness, "the gate rejects a step" means: the step's snapshot is not accepted as the step's outcome, and the agent gets the findings and one repair turn (memo §2). The replay checks that this happens exactly on the violating steps.

## 2. What was verified

All checks pass, in the jest test and in two CLI runs. The two CLI runs ran 2 replays each, and all four replays gave the same digest, `8b8f8693…`.

| Check | Result |
|---|---|
| Runs | 9 runs (3 tasks × 3 arms) × 4 steps; 39 snapshots (36 step turns + 3 repair turns). Every snapshot was type-checked (0 errors) and evaluated with no evaluation error. |
| No model | Every turn records `costUsd`, tokens and `numTurns` as `null`, never 0. The argv is `scripted-replay`. |
| Memo §3 primary outcome | `none` has new blocking findings exactly at the scripted step: market [2, 0, 0], shelter [0, 2, 0], relief [1, 0, 0] (steps 2–4). `gate` has none in any final snapshot. `daedalus-mcp`: see §4. Identity is rule id, template, file and target; lines are ignored; for a cycle, the set of files. "New" means against every earlier snapshot of the run, repair snapshots included. |
| Memo §3 labelling | All 8 new blocking findings went through `check-correct`'s checker (`checkFinding`, on the report the loop now writes beside each turn, with the ADR-032 tsconfig). All 8 are `correct`. |
| Memo §4 secondary outcomes | See the list below this table. |
| Gate exactness | Repairs ran exactly on the scripted steps: market [2], shelter [3], relief [2]. Each repair showed every finding and removed it (`remaining` 0, `introduced` 0). |
| Consistency | 39 of 39 snapshots: the recorded evaluation (verdict, AHS values, counts per rule, every blocking finding with template and violation id) equals a full `evaluate_project` of a fresh `git archive` checkout of the same commit. Only `durationMs` is ignored. |
| Reproducibility | Two replays into different directories are byte-identical over 321 files: step and run records, prompts, envelopes, reports, frozen DDD specs and work trees. The snapshot stores have identical commit, tree and subject lists. Two things are excluded. First, 39 `timing-*.json` files, which hold only measured time. Second, timing keys set to 0 in 36 JSON files: `durationMs`, `wallMs`, `turnMs` and `ms`. Nothing else differs. |

**Memo §4 secondary outcomes recorded:**
- Advisory findings per KLOC and their OLS slope, with and without FF-CV05 (for example, market `none`: 0.881 and −0.135; shelter `none`: 10.39 and 5.69; relief: 0 and 0).
- Gate repair success: share 1, mean reduction 2, 2 and 1, 0 findings introduced.
- Cost and time per step, with repair turns shown apart.
- Guards: type-check errors, skeleton integrity, files and LOC per step, and the share of files matching no layer glob, context root or `outside_contexts` glob (0 everywhere).
- REIMPLEMENTS and the judge dimensions are out of scope here: one is N/A per the memo, and the other needs a model.

## 3. Latency per step

The figures are milliseconds on this container, measured on the second CLI run. Columns:
- **eval wall**: the wall time the loop waited for `evaluate_project`, including connection, extraction and ingestion.
- **eval (report)**: the pipeline's own `durationMs`, which is what the step records store.
- **Two values separated by `/`**: the step turn's snapshot, then the repair turn's snapshot.

| Task | Arm | Step | Turn | Tool calls (ms) | Type-check | Eval wall | Eval (report) |
|---|---|---|---|---|---|---|---|
| market-vendors | none | 1 | 1 | 0 | 518 | 1070 | 61 |
| market-vendors | none | 2 | 0 | 0 | 296 | 706 | 50 |
| market-vendors | none | 3 | 0 | 0 | 317 | 726 | 49 |
| market-vendors | none | 4 | 0 | 0 | 267 | 841 | 55 |
| market-vendors | daedalus-mcp | 1 | 12 | 6 (10.7) | 263 | 520 | 48 |
| market-vendors | daedalus-mcp | 2 | 4 | 7 (2.9) | 259 | 663 | 46 |
| market-vendors | daedalus-mcp | 3 | 2 | 4 (1.2) | 250 | 681 | 49 |
| market-vendors | daedalus-mcp | 4 | 1 | 3 (0.8) | 256 | 737 | 46 |
| market-vendors | gate | 1 | 1 | 0 | 244 | 517 | 47 |
| market-vendors | gate | 2 | 0 | 0 | 235 / 268 | 590 / 621 | 50 / 50 |
| market-vendors | gate | 3 | 1 | 0 | 231 | 721 | 47 |
| market-vendors | gate | 4 | 0 | 0 | 240 | 754 | 56 |
| shelter-adoptions | none | 1 | 1 | 0 | 262 | 602 | 61 |
| shelter-adoptions | none | 2 | 0 | 0 | 251 | 647 | 64 |
| shelter-adoptions | none | 3 | 0 | 0 | 358 | 659 | 49 |
| shelter-adoptions | none | 4 | 1 | 0 | 233 | 693 | 48 |
| shelter-adoptions | daedalus-mcp | 1 | 8 | 7 (7.1) | 273 | 574 | 48 |
| shelter-adoptions | daedalus-mcp | 2 | 1 | 3 (0.7) | 235 | 611 | 47 |
| shelter-adoptions | daedalus-mcp | 3 | 1 | 4 (1.0) | 334 | 647 | 48 |
| shelter-adoptions | daedalus-mcp | 4 | 2 | 6 (1.6) | 240 | 712 | 53 |
| shelter-adoptions | gate | 1 | 1 | 0 | 244 | 561 | 49 |
| shelter-adoptions | gate | 2 | 0 | 0 | 250 | 629 | 55 |
| shelter-adoptions | gate | 3 | 0 | 0 | 263 / 230 | 657 / 663 | 47 / 49 |
| shelter-adoptions | gate | 4 | 1 | 0 | 261 | 711 | 49 |
| relief-volunteers | none | 1 | 1 | 0 | 216 | 978 | 48 |
| relief-volunteers | none | 2 | 0 | 0 | 223 | 1099 | 49 |
| relief-volunteers | none | 3 | 1 | 0 | 257 | 758 | 48 |
| relief-volunteers | none | 4 | 0 | 0 | 341 | 688 | 51 |
| relief-volunteers | daedalus-mcp | 1 | 1 | 0 (no spec yet) | 270 | 676 | 46 |
| relief-volunteers | daedalus-mcp | 2 | 6 | 4 (5.8) | 273 | 705 | 49 |
| relief-volunteers | daedalus-mcp | 3 | 1 | 4 (1.1) | 239 | 716 | 53 |
| relief-volunteers | daedalus-mcp | 4 | 1 | 2 (0.4) | 228 | 645 | 50 |
| relief-volunteers | gate | 1 | 1 | 0 | 256 | 703 | 56 |
| relief-volunteers | gate | 2 | 0 | 0 | 269 / 223 | 687 / 626 | 53 / 49 |
| relief-volunteers | gate | 3 | 1 | 0 | 214 | 639 | 53 |
| relief-volunteers | gate | 4 | 0 | 0 | 203 | 647 | 50 |

**Summary of the figures:**
- **Evaluation.** Per snapshot it takes 0.5–1.1 s of wall time (median 0.68 s). The report's `durationMs` (about 50 ms) leaves out most of that time, so it should not be read as the gate's latency.
- **Type-check.** 0.2–0.5 s.
- **MCP tool calls.** About 1 ms each once warm. The first call of a run costs about 10 ms, because it loads the spec.
- **Consistency re-evaluations.** 0.23–0.78 s each.
- **What dominates a pilot step.** The harness adds about 1–2 s per snapshot. A model turn takes minutes, so the harness's share is negligible.

## 4. Plumbing bugs found

### Fixed in this branch

1. **The live evaluator had no tsconfig.**
   - Problem: the work tree has no `tsconfig.json` (the pinned per-run tsconfig lives under `<H>/runs/<runId>/`, BR-U5a-42). `evaluate_project` read `<project>/tsconfig.json` and failed every snapshot with `TSCONFIG_NOT_FOUND`. In the pilot, every run would have been unscored unless the agent happened to write a tsconfig of its own.
   - Fix: `evaluate_project` takes an optional `tsconfigPath` (ADR-032, as the E1 scoring does). `StepEvaluator.evaluate` receives the run id, and the live wiring passes the run's pinned tsconfig (`harnessSnapshotTsconfig`). The dry run had not caught this, because it uses a stub evaluator.
2. **The DDD freeze accepted a spec the evaluator cannot compile.**
   - Problem: the ISE infers an aggregate only from a sub-folder of a context's domain folder (`domain/<aggregate>/…`). With flat domain files it infers none. The frozen spec then passed the freeze validator, but the compiler rejected it (`BR-SPEC-10 FF-DT01: aggregates; BR-SPEC-10 FF-DT02: aggregates`), so every snapshot of the DDD run failed with `PIPELINE_FAILED`.
   - Fix: the freeze now compiles the constrained spec exactly as the pipeline does (`compileFunctions` with the v1.3 options) and rejects it with `LOOP_SPEC_FREEZE_FAILED`, which is recorded once in `spec/spec.json` (tested).
   - Dry-run stub: it wrote flat DDD domain files and so hit this case. It now writes one folder per aggregate, and both declared contexts at step 1 (see risk 2 below).
3. **Memo §3 could not be computed from the step records.**
   - Problem: the records kept neither the finding's template (part of its identity) nor anything `check-correct` can read. Blocking findings were also capped at 25 per rule.
   - Fix: the live evaluator now asks `evaluate_project` for the report's violations (`includeViolations`; the MCP tool's output is unchanged). Every blocking finding carries `template` (recovered as the labelling does) and `violationId`, uncapped. The loop writes each snapshot's full violation list to `turns/step-NN/report-<turnId>.json`, the input `check-correct` reads.
   - Identity: `repairOutcome` now includes the template too (memo §3).
4. **Memo §4 "without FF-CV05" could not be computed.**
   - Problem: the step records kept advisory counts only as a total.
   - Fix: `StepEvaluation.advisoryByRule` added.
5. **Snapshot commits were not reproducible.**
   - Problem: git took the commit dates from the clock.
   - Fix: `WorkTreeSnapshots` takes an optional fixed date (`LoopContext.snapshotDate`). The replay sets it; live runs do not, so they behave as before.

### Not fixed: risks and gaps for the author's decision

1. **The MCP tools do not see the hexagonal or DDD blocking rules.**
   - `check_file` and `check_diff` check only the layered import rules (`dependency-direction`, `no-layer-skip`, `no-domain-outward-dep`, `domain-purity`) and naming. They do not check `dependency-direction-graph`, `core-isolation` or `context-isolation`.
   - In the replay, the `daedalus-mcp` agent got no feedback at shelter step 3 or relief step 2, while the full evaluation reported the blocking findings. On Clean, the tools reported exactly the full evaluation's blocking findings and the fix followed.
   - It does not affect the planned pilot: `daedalus-mcp` is not in the plan, and the plan refuses it with task profiles. It matters for Study 2. The test asserts the current behaviour, so a tool fix will flip it.
   - Also: before step 1 the DDD run has no spec, so `daedalus-mcp` has nothing to serve during step 1.
2. **The DDD freeze needs both contexts and an aggregate folder in step 1.**
   - If the agent's step-1 tree has a single context folder, the ISE takes it as the source root and finds no contexts. If the domain files are flat, the ISE finds no aggregates. Either way the freeze now fails cleanly, and the DDD run is recorded but unscored.
   - The DDD style sentence asks for the five layer folders per context. It does not ask for aggregate sub-folders, and it does not ask for both contexts at step 1.
   - Whether to fall back (for example, accept a spec without FF-DT01/FF-DT02), or to accept the risk, is a construct decision for the author. It is not made here.
3. **Labelling input.** The reports now exist beside each turn, but there is no script yet that turns a pilot's `<out-root>` into a `check-correct` jobs file. `replay-verify.ts` (`labelNewBlocking`) shows the mapping: project root = a checkout of the snapshot commit, `tsconfig: adr-032`, spec = the step's `evaluatorSpec`.
4. **Stale readiness figure.** `loop-pilot-readiness.md` §5 says the dry run makes 4 repair turns. On `origin/v1.3` it makes 6, which is 2 planted violations per task × 3 gate runs. This branch does not change that number.

## 5. Re-run after the harness correctness fixes (2026-10-16)

The harness changed after the first run, so the replay was run again on `v1.3-loop-harness-fixes`:
- The blocking findings are now exactly the rows the v1.3 scoring counts. FF-P06's FLOWS_TO and HOLDS_STATE_OF rows are N/A, and so are rows a construct switch moves to advisory. They no longer reach the repair prompt, `repairOutcome` or the pilot outcomes. A count mismatch fails the evaluation with `LOOP_EVAL_FINDINGS_MISMATCH`.
- An unscored step has a `null` count, never 0. `newBlockingTotal` is null when any step is unscored, and `unscoredSteps` lists those steps.
- `evaluate_project` on cypher-interp honours the run's pinned tsconfig. A run in which every snapshot failed evaluation fails with `LOOP_EVAL_ALL_FAILED`.
- Every evaluation records its engine (`engineOfRecord`, from the engine tee of `loop-engine-tee.md`, now in every mode). The live harness and the replay default to `neo4j` instead of the NEO4J_URI default, and the replay fails on a snapshot recorded on another engine.

| Engine | Failures | Reproducible (files) | Consistency | Labels | New blocking, steps 2–4 (none / daedalus-mcp / gate) |
|---|---|---|---|---|---|
| neo4j (Neo4j Community 5.26.24 + APOC 5.26.24, tarballs) | 0 | yes (321) | 39/39 | 8/8 `correct` | market [2,0,0] / [0,0,0] / [0,0,0]; shelter [0,2,0] / [0,2,0] / [0,0,0]; relief [1,0,0] / [1,0,0] / [0,0,0] |
| cypher-interp (no database) | 0 | yes (321) | 39/39 | 8/8 `correct` | identical to neo4j |

These are the same outcomes as §2. None of the 39 snapshot reports holds an FF-P06 row on these tapes, so the counted-row change does not move any number here; the new unit tests cover it. No step is unscored on either engine, and the gate repairs ran exactly on the scripted steps.

## 6. Reproduce

```bash
# scratch Neo4j 5.26 + APOC (docker compose up -d neo4j, or the tarballs), never a database you need
export NEO4J_PASSWORD='<scratch password>'          # NEO4J_URI defaults to bolt://localhost:7687
npm run loop:replay -- --report "$(mktemp -d)/replay.json"   # exit 0 = every check passed
npm run loop:replay -- --engine cypher-interp --report "$(mktemp -d)/replay.json"   # no database needed
npm run test:loop-replay                                       # the same checks under jest (about 2 minutes)
```
