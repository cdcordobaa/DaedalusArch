# v1.3 loop: per-step acceptance checks (feature-dropping guard, gate D12)

**2026-10-16. Status: design and pass criterion, committed before any number was computed.** This note is tooling for
gate line D12 (`study2-readiness-gate.md`, on `origin/v1.3-study2-readiness`). It is not a pre-registration. No LLM was
called. Nothing here names, paraphrases or derives a Study 2 task; the demo tests are for the three non-sealed pilot
tasks (`Docs/v1.3/pilot-tasks.md`) only.

## 1. Why

An agent can lower its violation count by dropping features (`study2-outline.md` §4: "Feature completeness is the weak
spot"). LOC and file trajectories hint at it; they do not show it. An acceptance check is a small black-box behavioural
test of a step's feature, run by the harness on every snapshot, never shown to the agent. A step whose snapshot fails
its own or an earlier step's checks has dropped (or never built) a feature, whatever its violation count.

## 2. Design

**Where the tests live.** `<testsRoot>/<taskId>/step-NN.test.mjs` (`NN` = 01..k). `testsRoot` is a harness directory
outside every agent cwd and outside the output root, for a live run `<H>/acceptance/`. The agent never sees it: it is
not under the work directory, it is not named in any prompt frame (the frames are untouched), and nothing copies it into
the work tree. Tests are plain `node:test` + `fetch`, ES modules, no dependency. `.mjs` rather than `.ts` (option taken
under delegation): the runner must not depend on Node's type stripping or on a TypeScript loader.

**What runs at step k.** Every test file `step-01 .. step-k` that exists for the task, in that order, each in its own
`node --test` process, against one service instance started from the snapshot. Re-running the earlier steps' files is
the point: a feature that existed at step 2 and is gone at step 4 fails at step 4.

**How the service is started (black box).**
1. The snapshot (the work tree right after the harness committed it) is copied to a scratch directory outside the work
   directory and outside the output root; `node_modules` stays the same read-only symlink. The service never runs in the
   agent's cwd, so it cannot change the snapshot.
2. The start command is, in order: the task's `acceptance.startCommand` in the tasks file (an argv array; `{{port}}`
   and `{{dir}}` are substituted), else `npm run --silent start` when the snapshot's `package.json` has a `start`
   script, else none (the record says `no-start-command`; no test runs). An optional `acceptance.buildCommand` (argv,
   same substitutions) runs first, in the scratch copy, with the same timeout.
3. The port is the task's `acceptance.port`, else a free localhost port chosen by the harness. The service gets it as
   `PORT`. Its environment is only `PATH`, `HOME`, `PORT` and `NODE_ENV=test` (no harness, Neo4j or vendor variable).
4. The harness waits until `GET http://127.0.0.1:<port><healthPath>` (default `/`) gets any HTTP response, up to
   `startTimeoutMs` (default 30 s). No response: `service-not-ready`, no test runs.
5. Each test file runs as `node --test --test-reporter=tap <file>` with cwd = the test directory, `BASE_URL` set, and a
   per-file timeout (`timeoutMs`, default 60 s). The service process group is killed afterwards (TERM, then KILL), and
   the scratch copy is removed.

**Isolation.** Localhost only by construction (the tests call `BASE_URL` on 127.0.0.1). The runner does **not** sandbox
the service's own outbound network; the pilot tasks' integrations (PayLane, TillWave, TextBridge, MedCert, the licence
registry) are fakes or pollers the agent writes, and a service that tries a real host simply fails that call. Running
the service under the E1 confinement (no network namespace exists in the cloud container) is pending for the live
harness.

**What is recorded.** `SnapshotMeasure.acceptance` on every measured snapshot (so the gate's repair turn gets one too,
which shows a repair that cleared findings by deleting a feature), and `StepRecord.acceptance`, the record of the step's
final snapshot:

```
{ schema: 'loop-acceptance/v1',
  status: 'ran' | 'no-tests' | 'no-start-command' | 'build-failed' | 'service-not-ready' | 'runner-error',
  passed, failed, skipped, errors,        // summed over the files; errors = cancelled tests + files that crashed,
                                          // timed out or never ran (service down)
  durationMs,
  testFileSha256,                         // sha256 of the "file<TAB>sha256\n" manifest of the files run, sorted
  files: [{ file, sha256, passed, failed, skipped, errors, timedOut }] }
```

The service's stdout and stderr go to `turns/step-NN/acceptance-<turnId>.log` (outside the work tree).

**Off by default.** Nothing runs unless the plan sets `acceptance: { enabled: true, testsRoot }`. With no such block,
or `enabled: false`, no step or snapshot record has an `acceptance` field and the loop, the dry run and the loop replay
write byte-identical records. The tasks file's per-task `acceptance` block is optional and is ignored when the plan does
not enable the checks. The pilot tasks file is hashed and is not edited.

## 3. Pass criterion (fixed before any number)

1. `StepRecord.acceptance` and `SnapshotMeasure.acceptance` are optional; a plan without `acceptance.enabled` writes no
   such field (unit test on the stub loop: records byte-identical with and without a disabled block).
2. The runner starts a service with a fixed command (per-task `startCommand`, else `package.json` `start`), waits for
   the port, runs the black-box tests from a directory outside the work tree with a timeout, and records
   `{passed, failed, skipped, errors}` (unit tests).
3. Demo tests exist for the 3 pilot tasks, steps 1–4 (`experiments/loop-acceptance-demo/<taskId>/step-0N.test.mjs`).
   They are run on (a) the loop replay tapes' snapshots, steps 1–4 of each task, and (b) a demo reference service per
   task that implements the demo contract, and (c) a copy of that service with one route removed.
   - **Tapes:** the record must be correct for whatever the tapes implement. The tapes are expected to implement **no**
     HTTP surface (their code is a few domain and application classes, no listener): then every tape snapshot records
     `no-start-command` or `service-not-ready` and 0 passed. That is the honest outcome and counts as the runner
     working, not as the tests passing.
   - **Reference service:** every demo test of steps 1–4 passes (failed = errors = 0).
   - **Mutilated copy:** at least one test fails at the step whose route was removed and at every later step (the later
     steps re-run it).
4. Replay and dry run byte-identical when disabled; rule-3 diff of the 71 reference results clean (only `elapsedMs`).

## 4. The HTTP contract problem (for the author)

A black-box test must know where a feature lives: port, routes, payloads. The pilot task texts say "expose the
operations over HTTP" and fix nothing else, and the loop's prompt frames (`prompts.ts`, `style.ts`; not edited) name
no entry point, start command, port or route. The skeleton `package.json` is locked (BR-U5a-45), so the agent cannot
add a `start` script either. So for a **live** pilot snapshot today, no acceptance test can know how to start the
service or what to call, and every step records `no-start-command`.

The demo tests therefore assume a **demo contract** (routes and payloads written at the top of each task's
`step-01.test.mjs`) that the reference services implement. It exists only to prove the runner. It cannot be applied to
live pilot runs, because the agent never saw it.

For D12 to be green in Study 2 the author must choose, before sealing, one of:
- **(a)** put a minimal HTTP contract in each sealed task's text (routes and status codes per step, plus "the service
  starts with `node dist/main.js` and listens on `PORT`" or equivalent), so the tests and the agent share it; this
  changes the task text, not the frames;
- **(b)** add a start convention to the step frames (an author decision: the frames are frozen and hashed);
- **(c)** keep the feature text free and write acceptance checks per snapshot after the run (post hoc; weaker, and it
  needs a blind rater, which the validity strategy avoids);
- **(d)** waive D12 under its **[W]** clause and rely on LOC and file trajectories, declaring the residual in writing.

The runner supports (a) and (b) as is (per-task `startCommand`/`buildCommand`/`port`).

## 5. What the author must do

Write the per-step acceptance tests together with the sealed tasks, hash them with the tasks (outline §8.9), keep them
outside every agent cwd (`<H>/acceptance/`), and never show them to an agent. This repository never holds them. The
runner and the demo tests here are for the pilot tasks only.

## 6. Results (computed after §3 was committed)

Code: `scripts/lib/loop/acceptance.ts` (runner), wired in `loop.ts` (`LoopContext.acceptance`), `plan.ts` (plan block
`acceptance`, per-task `acceptance` in the tasks file) and `main.ts` (a runner only when `acceptance.enabled`). Demo:
`npx tsx scripts/v1.3/acceptance-demo.ts --out Docs/v1.3/acceptance-checks-demo.json` (repository root; ~30 s; no
LLM, no Neo4j). Tests: `jest --maxWorkers=2 tests/unit/scripts/loop` (63 passed, 10 of them new in
`acceptance.test.ts`).

| Source | Steps | Status | Passed | Failed | Errors |
|---|---|---|---|---|---|
| Replay tapes (`none` arm through `runLoop`), 3 tasks | 1–4 each | `no-start-command` on all 12 | 0 | 0 | 1 per file not run (1..4) |
| Reference service, `market-vendors` | 1 / 2 / 3 / 4 | `ran` | 4 / 8 / 9 / 11 | 0 | 0 |
| Reference service, `shelter-adoptions` | 1 / 2 / 3 / 4 | `ran` | 2 / 4 / 5 / 6 | 0 | 0 |
| Reference service, `relief-volunteers` | 1 / 2 / 3 / 4 | `ran` | 2 / 4 / 5 / 7 | 0 | 0 |
| Mutilated `market-vendors` (settlement route removed, a step-2 feature) | 1 / 2 / 3 / 4 | `ran` | 4 / 5 / 6 / 8 | 0 / 3 / 3 / 3 | 0 |
| Mutilated `shelter-adoptions` (TextBridge webhook removed, step 3) | 1 / 2 / 3 / 4 | `ran` | 2 / 4 / 4 / 5 | 0 / 0 / 1 / 1 | 0 |
| Mutilated `relief-volunteers` (impact report removed, step 4) | 1 / 2 / 3 / 4 | `ran` | 2 / 4 / 5 / 6 | 0 / 0 / 0 / 1 | 0 |

Against §3:
1. **Met.** No `acceptance` field without a runner (unit test). The loop dry runs of `experiments/loop-demo/plan.dry-run.json`
   and `experiments/loop-pilot/plan.json` on this branch and on untouched `origin/v1.3` (same paths) give identical
   files (57 and 165 files) after normalising the clock fields and the clock-dated snapshot commit shas.
2. **Met.** Unit tests cover start-command discovery, the readiness wait (`service-not-ready` after 1.5 s), the
   out-of-cwd run (the snapshot is unchanged and the scratch copy is removed) and the counts.
3. **Met, with the tapes as expected:** the tapes implement no HTTP surface (no listener, no start script; the
   skeleton `package.json` has none), so all 12 tape steps record `no-start-command` and 0 passed. That shows the record
   is honest, not that the tapes have the features. All reference-service tests pass; each mutilated copy fails from
   the step of the removed feature onwards and not before. Two demo runs gave byte-identical JSON.
4. **Met for the interpreter and the dry runs.** Rule-3 diff of the 71 reference results (`--engine cypher-interp`):
   0 of 71 `raw/` files, `report.json` and `report.md` differ after removing `elapsedMs`. The loop replay itself
   (`tests/integration/loop`, Neo4j) was **not** run here: no Neo4j was started. The disabled path adds no field and
   no call, and the pilot-plan dry run, which uses the same `runLoop`, profiles and frozen DDD spec, is byte-identical.

**Not done.** No network sandbox for the service (§2, Isolation). No live snapshot was checked (no live pilot exists).
The HTTP-contract decision of §4 is the author's. No acceptance test was written or guessed for any sealed task.
