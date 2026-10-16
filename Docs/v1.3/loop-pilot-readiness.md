# v1.3 loop pilot: harness readiness

**2026-10-15. Status: ready for the freeze; no pilot run has started.** This note records the harness changes that close the gap named in `Docs/v1.3/pilot-tasks.md` §3 ("Harness gap, to close before the pilot"), the pilot plan, its call budget and the command that runs the pilot. It changes nothing in the pilot memo or the tasks: `Docs/v1.3/pilot-outcome-memo.md` (outcomes, decision, leakage controls) and `Docs/v1.3/pilot-tasks.md` (task text and hashes) are fixed. The values this note produces for memo §7 are listed in §7 below; entering them in the memo is the freeze step, done before the first run.

Code: `scripts/lib/loop/` (`style.ts`, `specs.ts`, changes in `prompts.ts`, `plan.ts`, `loop.ts`, `main.ts`, `stub.ts`). Tests: `tests/unit/scripts/loop/pilot.test.ts` (the existing loop tests are unchanged and pass).

## 1. Style slot in the step frames

A plan can give each task a target style (`taskProfiles.<taskId>.style`: `clean | hexagonal | ddd`). The task file stays as hashed; the style lives in the plan, next to the task's spec. A styled task's frames carry two sentences in place of the fixed "Clean Architecture" wording:

- **Style sentence**, word for word from `pilot-tasks.md` §3. The DDD sentence is built from the plan's declared contexts: "Organise the code following Domain-Driven Design, with one bounded context per part: src/registry/ for the volunteer registry and src/deployment/ for deployment planning." Later steps say "follow the architecture the project already uses (<style name>)", and for DDD the style name restates the contexts.
- **Folder-layout sentence**, derived from the style's canonical preset, the way the E1 templates carry the Clean layout (`Docs/generator-protocol.md` §5):

| Style | Preset | Layout sentence |
|---|---|---|
| Clean | `presets/clean-architecture.yaml` | "Organise the source code under src/ in exactly three folders: src/domain, src/application and src/infrastructure." (the E1 sentence, byte for byte; a test checks it against `scripts/generator/prompts/none.md`) |
| Hexagonal | `presets/hexagonal.yaml` | "Organise the source code under src/ in exactly five folders: src/domain, src/application, src/adapters/inbound, src/adapters/outbound and src/config." |
| DDD | `presets/ddd.yaml` | "Inside each bounded context folder, organise the source code in the folders domain, application, infrastructure, acl and api (for example src/registry/domain), and put the composition root in src/main.ts." |

The DDD sentence names the preset's per-context folders (`src/*/<folder>/**`) and its composition-root file. It does not name the preset's `src/shared-kernel/**`. The pilot spec declares only the two contexts, and where the agent puts shared code at step 4 is part of the pressure (`pilot-tasks.md` §3 and §4, FF-DS01).

What does not change:
- A task with no profile (the demo plan, every existing test) gets `FIRST_STEP_TEMPLATE` and `NEXT_STEP_TEMPLATE` byte for byte.
- The argv is unchanged. The style slot is in the prompt value only. For the `none` arm, the Claude argv of a styled prompt equals the E1 argv with that prompt (`pilot.test.ts`), and the existing `none` and `gate` wiring tests (`agents.test.ts`) pass unchanged.
- The frame is the same in every arm of a task. Each arm adds only its own tool sentence, as before.

Every turn's full prompt is now written beside its envelope (`turns/step-NN/prompt-<turnId>.txt`), so the frame actually sent is on record next to its `promptSha256`.

## 2. Gate repair turn: plain language and its outcome

The repair prompt now opens with one plain-language line per blocking rule among the listed findings (`RULE_PLAIN` in `prompts.ts`), for example "code in an inner layer imports code from an outer layer; dependencies must point inward, towards the domain (2 places; rule FF-S01 dependency-direction)". The findings follow, one per line in the existing format (rule, file, line, target, message, at most 40). A test checks that every blocking rule of the three pilot specs has a plain line. A rule with no plain line falls back to its first finding's message. The wording describes the rule and never names a fix.

Each gate step record still has `repair` (`attempted`, `blockingBefore`, `blockingAfter`, `cleared`), unchanged, and now also `repairOutcome`, which follows the findings one by one. A finding is identified by its rule id, file and target. Line numbers are ignored, as in memo §3. For each identity before the repair, the record says whether the prompt listed it (`shown`) and whether the repair removed it (`removed`). It also counts `remaining` findings, and lists the identities the repair `introduced`. These are the inputs of memo §4 "Gate repair success". `repairOutcome` is absent when there was no repair, or when either snapshot could not be evaluated.

## 3. Per-task evaluator specs

A plan can give each task its own spec (`taskProfiles.<taskId>.specMode`):

| Task | Style | Spec | Mode |
|---|---|---|---|
| `market-vendors` | Clean | `specs/clean-arch.yaml` | `static` |
| `shelter-adoptions` | Hexagonal | `presets/hexagonal.yaml` | `static` |
| `relief-volunteers` | DDD | inferred by the ISE from the run's step-1 snapshot, then frozen | `ise-step1` |

**Clean.** The spec is `specs/clean-arch.yaml`, the E1 spec, as `pilot-tasks.md` §3 and memo §7 name it. It is the E1 instance of the clean-architecture preset: the same three layer globs (`src/domain/**`, `src/application/**`, `src/infrastructure/**`). The layout sentence is read from the preset itself.

**Hexagonal.** The spec is `presets/hexagonal.yaml`, as it is. Its layers match the layout sentence the agent is given.

**DDD: an ISE-assisted spec, frozen after step 1.** A DDD spec has to declare where the aggregates, layers and public APIs are. Those are the agent's own choices, so the spec cannot be written before the run. What it can be written from is the agent's step-1 tree. For each DDD run the harness:

1. Copies the step-1 snapshot's `src/` into a neutral temporary directory (the ISE anti-leakage boundary), runs the ISE (`src/ise`, `inferSpec`, style forced to `ddd`), and so gets a spec parameterised from the agent's folders: layer folders, contexts, aggregate roots and repositories.
2. Constrains it to the declared contexts (`constrainDddSpec`):
   - **Contexts.** Exactly `src/registry/` and `src/deployment/`. An inferred context that is not declared is dropped, so its files lie outside every context (FF-DS01). A declared context the agent has not created yet is still declared. Each context keeps its inferred public API and ACL, plus the preset conventions `<root>index.ts`, `<root>contracts/**` and `<root>acl/**`.
   - **`outside_contexts`.** Only the preset's composition root, `src/main.ts`. An inferred `src/shared/**` is dropped.
   - **Aggregates.** The inferred aggregates of the declared contexts.
   - **Layer folders.** The inferred folders that lie inside a declared context, plus the preset's per-context globs, so that folders created at steps 2 to 4 are still mapped.
   - **Value objects, repositories, application services and event types.** The inferred ones plus the preset conventions.
3. Validates the result with the repository's spec validator. `LAYER_DIR_NOT_FOUND` is kept as a warning, because folders for later steps cannot exist yet; the evaluator does not require them. Any other error rejects the spec.
4. Freezes it: `spec/frozen-spec.yaml`, the ISE's raw output in `spec/ise-raw.yaml`, and `spec/spec.json` (source commit, sha256, the ISE classification, the constraint report and the validation result).

Every snapshot of the run is evaluated against that one frozen file, including step 1, its repair and steps 2 to 4. It is never inferred again. Each step record names the spec it used (`evaluatorSpec`: kind, path, sha256). Static specs are recorded the same way, with the sha256 of the file.

**Why this choice.**
- It is the smallest spec that fits the agent's own layout and still declares only the two contexts, as `pilot-tasks.md` §3 requires.
- It is frozen before any of the steps it scores could tune it.
- It never treats a later step's folders as legitimate. The constraint only ever removes contexts and outside entries, and adds the generic per-context conventions; erosion at steps 2 to 4 still shows.

**What it costs.**
- Each DDD run, `none` and `gate`, has its own spec, frozen from its own step-1 tree, so the two arms are scored against specs that can differ in their aggregate and public-API declarations. The pilot estimates no arm effect (memo §6), so this is recorded, not corrected. Both specs and their constraint reports are on disk.
- If step 1 is bad enough that no spec can be inferred (no `src/`, or a validator error), the freeze fails. The failure is recorded in `spec/spec.json`, and every snapshot of the run carries `evaluationError` `LOOP_SPEC_FREEZE_FAILED`. The commits are kept, so the run can be scored later.
- On resume, a spec frozen on a step 1 that was discarded is discarded with it and frozen again from the rerun step 1.

The `daedalus-mcp` arm serves one spec through its MCP server, so a plan with `taskProfiles` refuses that arm. This matches the pilot: memo §2 adds `daedalus-mcp` only if it is cheap, and a per-task MCP spec would be new engineering.

## 4. Pilot plan

`experiments/loop-pilot/plan.json`:

| Field | Value |
|---|---|
| `tasksFile` | `experiments/loop-pilot/pilot-tasks.json`: the JSON block of `pilot-tasks.md` §2 byte for byte. A test checks that its sha256 is the memo §7 block hash `5b72d118…dce22f`, and that each task's hash is in the memo. |
| `adapters` | `claude-code-cli` / `claude-sonnet-5-5` (the E1 pin) |
| `arms` | `none`, `gate` |
| `runs` | 1 |
| k | 4 (each task has 4 steps) |
| `orderSeed` | 20261015. This is the value to enter in memo §7 at freeze. |
| `timeoutMs`, `allowBash` | 1 200 000, true (as in the E1 generator plan) |
| `outRoot`, `binary`, `harnessRoot` | `"<local>"`, supplied by `--out-root`, `--binary`, `--harness-root` |
| `taskProfiles` | §3 |
| `callBudget` | `{ runs: 6, stepTurns: 24, maxRepairTurns: 12, maxCalls: 36 }` |

**Planned call budget.** There are 3 tasks × 2 arms = 6 runs, each of 4 step turns: 24 step turns. The `gate` arm adds at most one repair turn per step: 3 tasks × 4 steps = at most 12 repair turns. That makes at most **36 model calls**, matching memo §2. Usage-limit pauses take no attempt. An infrastructure failure is retried at most twice from the last snapshot (E1 policy), and these retries are the only calls beyond the 36. The ISE freeze makes no model call (2 freezes, one per DDD run), and the symbolic evaluator makes none either. `loadLoopPlan` refuses the plan if `callBudget` differs from what the plan implies (`planCallBudget`), so the recorded figure cannot drift. Every run, dry or live, prints the budget next to the turns it actually ran. At the memo's 2 to 6 USD API-equivalent per turn, the pilot comes to about 48 to 216 USD API-equivalent (24 to 36 turns), under the subscription login.

## 5. Dry run (proof that the whole plan executes)

```bash
npx tsx scripts/loop-harness-cli.ts --plan experiments/loop-pilot/plan.json --dry-run \
  --out-root "$(mktemp -d)/loop-pilot-dry"
```

The dry run uses stub generators, the stub firewall and the stub type-check, so it makes no model call and needs no Neo4j. It runs the real schedule, work directories, snapshots, measures, styled prompts, gate repair turns and resume logic. The stub writes each task's style layout: the Clean folders; Hexagonal with `src/adapters/outbound`; DDD alternating `src/registry/` and `src/deployment/`. It plants one domain-to-infrastructure import on steps 2 and 4. The static spec files are read and hashed. The DDD spec is really inferred by the ISE from each DDD run's step-1 stub tree, then constrained, validated and frozen. Result on this commit: 6 runs complete, 24 step turns, 6 repair turns (all 6 cleared, `repairOutcome` removed 1, introduced 0), and both DDD specs frozen with the two declared contexts. The summary prints `callBudget` `{ runs: 6, stepTurns: 24, maxRepairTurns: 12, maxCalls: 36 }`. `pilot.test.ts` runs the same dry run and checks it run by run. The stub results are not measurements.

## 6. Running the pilot (local machine, Claude CLI route as in E1)

Prerequisites, as for E1 (`Docs/generator-protocol.md` §1 and §9, `Docs/environment.md`):
- The `claude` CLI is logged in with the subscription and `claude-sonnet-5-5` is available.
- A scratch Neo4j is running. The evaluator replaces the graph, so never point it at data you need.
- The E1 harness root is prepared: `ensureHarness` installs the skeleton on the first live run.
- Both roots lie outside the repository, and outside any agent cwd.

```bash
docker compose up -d neo4j                      # scratch graph (Docs/environment.md)
export NEO4J_PASSWORD='<scratch password>'      # NEO4J_URI / NEO4J_USER optional
npx tsx scripts/loop-harness-cli.ts --plan experiments/loop-pilot/plan.json \
  --binary "$(command -v claude)" \
  --harness-root "$HOME/daedalus-harness" \
  --out-root "$HOME/daedalus-loop-pilot"
```

The same command resumes. Complete runs are skipped, and a run stopped mid-step restarts that step from its last snapshot. A different plan or tasks file on the same `--out-root` is refused. Exit codes are 0 (grid completed), 1 (the CLI is not available) and 2 (usage, plan or harness error). The outputs are `<out-root>/runs/<runId>/` (`steps/step-NN.json`, `turns/`, `spec/` for DDD) and `<out-root>/schedule.json`.

## 7. Values for memo §7, from this commit

| Input | Value |
|---|---|
| Tool commit | the merge commit of this branch (fill at freeze) |
| `STYLED_FIRST_STEP_TEMPLATE` sha256 | `54e815ddf472515b55b1c839a4ee417f711ee5817222ea5e23d758814c5b0911` |
| `STYLED_NEXT_STEP_TEMPLATE` sha256 | `93161c32c3cebcb6a1b2cebc5fc6d7de253282b0becfe59de7e5389bb6818626` |
| `REPAIR_TEMPLATE` sha256 | `2a06bf712219964ff682e77d827620d0a7db3d62fbc457bb3de94367660acec0` |
| `specs/clean-arch.yaml` | `91bd152e0ae58dcc28a35f2ebc6fe264bf9ff7cd11a2fa6a8094ef54fcd6f6a8` |
| `presets/hexagonal.yaml` | `d085d6b9badca2e79ade19b12fcfff96d1317df139d646772871266f0ed20ab7` |
| `presets/ddd.yaml` (base of the frozen DDD specs; each frozen spec's own sha256 is in its run's `spec/spec.json`) | `ce28a78582a92571c5c8ff2c9144eb2161c580e140db3af880d451737b6260f7` |
| `orderSeed` | 20261015 |

Each instantiated prompt's `promptSha256` is in every turn record, and its full text is in `turns/`. The template hashes above are the frames before the slots are filled. A wording change after the freeze changes these hashes, and memo §6 then applies.
