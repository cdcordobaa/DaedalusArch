# DRIFT-01 design: the Study 2b drift protocol on DDD and Hexagonal seeds, with the v1.5 instrument (v1.5-exp)

**Status:** v1, 2026-10-23. Thinking note, written and committed **before any DRIFT-01 generator call**
(`feedback-slow-research-mode`). **Exploratory (v1.5-exp), development material only. Not Study 2b, not
registered.** Nothing under `src/`, `presets/`, `scripts/lib/`, `scripts/v1.3/`, the tag `v1.4-freeze-2026-10-20` or
any registered Study 2b artefact changes. No sealed or held-out set is read. Code: `experiments/drift-01/`. Part A
(zero calls) is reported in `Docs/DiagnosticRuns/drift-01-rescores-2026-10-23.md`.

## 0. Why

Three results point here:
- **Study 2b** found that `mcp@L2` drifts less than `none@L2`. That effect came from agents **reading the spec** at
  step 2 and dropping the inherited composition-root wiring. All 31 `check_*` calls returned `pass`
  (`Docs/DiagnosticRuns/v1.4-study2b-exploratory-analyses-2026-10-22.md` §1–2). On Layered tasks the checking tool
  never had anything to say.
- **HEXDDD-01** showed that on DDD and Hexagonal brownfield seeds the agents do err. Its 9 hand-read violations were
  invisible to the frozen rules (`results/v1.4-pilot-hexddd-01/hand-read-vs-scores.md`).
- **The v1.5 instrument now sees some of these errors.** R-D4 and R-XCTX catch 3 of the 9 at the hand-read step.
  On S2 the v1.5 D is 2 where the frozen D is 0 (Part A §2–3).
- **PUZZLE-02** showed the v1.5 pull tool changing behaviour when it fires: on P1, 4/5 against 0/5. The edit gate
  is built and smoke-tested (`Docs/DiagnosticRuns/edit-gate-build-2026-10-23.md`).

**The question.** On seeds where agents actually make the errors v1.5 can see, does v1.5 delivery reduce drift?
Pull and the edit gate are the two deliveries. The outcome is Study 2b's: new blocking identities at steps 2–5.

## 1. Tasks

| Id | Task | Seed | Steps | Spec (root-only, never shown as a file) |
|---|---|---|---|---|
| `t1` | HEXDDD-01 **S2 DDD** `s2-orders-invoices` | `experiments/pilot-hexddd-01/seeds/s2-ddd-debt` (tree `5caf330d…70e2`, planted FF-DS02) | the 5 requests of `experiments/pilot-hexddd-01/tasks.json`, verbatim | `experiments/pilot-hexddd-01/specs/s2-ddd.yaml` (= `presets/ddd.yaml`: aggregates declared) |
| `t2` | HEXDDD-01 **S1 Hexagonal** `s1-hotel-bookings` | `experiments/pilot-hexddd-01/seeds/s1-hex-debt` (tree `e3cfa16c…5700`, planted FF-S01, rebuilt by `build-seeds.mjs` so `ports/out/` is present) | the 5 requests, verbatim | `experiments/pilot-hexddd-01/specs/s1-hexagonal.yaml` (no DDD block: DETECT-02 infers the roots) |

- **A greenfield DDD task: none added.** The repository holds two kinds of DDD material:
  - the puzzles (P1, P2, P5), which are 3-step trap tasks on seeds that carry an `ARCHITECTURE.md`, not 5-step
    drift tasks;
  - the two DDD tasks sealed at the freeze for Study 2b, which are out of bounds.

  No suitable greenfield DDD task exists, so DRIFT-01 runs the two brownfield seeds only.
- The neutral ids hide the task names from the generator. `t1` is S2 because S2 is the primary task (§7).

## 2. Arms

| Arm | Frame | Tools | Hooks |
|---|---|---|---|
| `none` | The HEXDDD-01 brownfield frame, verbatim (`FRAME` in `experiments/puzzle-01-baseline/run-baseline.ts`) | the frozen argv | off (`disableAllHooks: true`) |
| `pull` | The same frame plus the PUZZLE-02 tool sentence, verbatim (`TOOL_SENTENCE`) | the frozen argv plus the DETECT-02 MCP server, as in PUZZLE-02: `check_consistency` and the 11 frozen DaedalusArch tools (`get_architecture_spec`, `check_file`, `check_import`, …), `--confine`, behind the socket relay | off |
| `gate` | The frame verbatim (no tool sentence, edit-gate note §5) | the frozen argv | the edit gate: PostToolUse (Edit\|Write\|MultiEdit) and Stop, `check_consistency` on the whole tree, new findings only |

- **Code reuse.** `pull` is the PUZZLE-02 driver's hub, prompt and argv. They are copied into
  `experiments/drift-01/pull.ts` from `origin/pilot/puzzle-02-tool-arm` (commit `9d8205004`), because that branch is
  not merged. `gate` imports `experiments/edit-gate/` (hub, settings, relay).
- **One change to the gate, recorded here.** `GateCell` gets an optional `baseline` tree (`experiments/edit-gate/hub.ts`;
  default unchanged; 12/12 edit-gate unit tests still pass).
  - The gate shows findings that involve a file changed since the baseline.
  - In DRIFT-01 the baseline is the **task seed**, not the step-1 tree the arm session starts from.
  - So a violation the shared step 1 introduced shows on the agent's first edit to a file of its flow. That is the
    inherited-pattern channel Study 2b's effect ran through. With the default, it would show only when the agent
    edits that very file.
- **The specs.** Both tools read the root-only task spec. `pull` also exposes it through `get_architecture_spec`,
  by design of the arm, as in Study 2b and PUZZLE-02. `none` and `gate` never see a spec.

## 3. Isolation (the puzzle baselines' procedure, with the session-directory lesson)

The procedure is `experiments/puzzle-01-baseline/isolation.md` with the PUZZLE-02 and edit-gate additions:
- generator uid 1500 through the baseline wrapper (`results/v1.4-puzzle-01-baseline/isolation/gclaude.sh`, byte for byte);
- `/srv/gh` as the generator's home, emptied before every session;
- `/srv/h` as the harness root (skeleton, `bin/tsc`, `bin/mcp-relay.cjs`, `bin/gate-relay.cjs`);
- `/srv/w/cNN/work` cells, each closed (root, 0700) after its session;
- `/srv/o` root-only: input, seeds, requests, specs `specs/t1.yaml` and `specs/t2.yaml`, the out root, MCP call logs,
  gate logs;
- `/srv/m` 0755 holding the two sockets;
- `/tmp/tsx-0` closed before every spawn.

**The change, per the brief's lesson.** The clone is **not moved and not removed**. It is closed in place
(`chmod 700` on the clone), and the driver runs as root from the clone. At the end it is reopened (`chmod 755`), and
the records are copied from `/srv/o` into `results/`. No command removes, empties or moves the session's working
directory or any ancestor of it.

**Checks before any call (zero calls, `--dry`):**
1. Listing as the generator: the clone, a design note, the hub code, the specs, the out root, `/root` and
   `/tmp/claude-0` are all denied.
2. Fingerprint sweep as the generator over `/`. Patterns: the canaries, the spec header lines, `HEXDDD-01`,
   `DRIFT-01`, the task ids, and one distinctive phrase of each step 2–5 request of both tasks. Bar: **0 readable
   files**.
3. Both relays run as the generator:
   - MCP: `tools/list` plus one in-tree `check_consistency`, and one outside the tree, which must be refused;
   - gate: one Write event, which must be answered.
4. A stub agent through the whole plan for one replicate.

**Model-call checks** (4 calls, below): the READ probe, the pull smoke, the MCP confinement probe and the gate smoke.
If any check fails, the run stops.

## 4. Protocol

- **Per task and replicate.** One **shared** session runs step 1 with arm `none`, from the seed. Then, for each
  arm, one session runs steps 2–5 from a copy of that step-1 snapshot. Each step is one turn, with 0 repair turns.
  `--no-session-persistence` is in the frozen argv, so every turn is a fresh CLI process on the tree the earlier
  turns left. Snapshots are taken after every step.
- **Replicates: 3 per task.** The turns are 2 tasks × 3 replicates × (1 shared + 3 arms × 4 steps) = **78**.
- **Order** (`experiments/drift-01/plan.ts`, unit-tested): replicate by replicate. Within a replicate, the tasks
  are shuffled. A task's shared session comes first, then its three arm sessions in shuffled order. mulberry32,
  seed `20261023`. One lane.
- **Model and CLI:** `claude-sonnet-5-5` through the Claude CLI at the sandbox's version, **2.1.308**, recorded by
  the driver. HEXDDD-01 ran 2.1.304 and PUZZLE-02 ran 2.1.307. This is an exploratory difference, recorded and not
  controlled.
- **Redraws.** A session that ends in an infrastructure state is redrawn whole: `infrastructure`,
  `envelope-unreadable`, `model-mismatch`, a harness error, or a session started but never finished (a container
  restart). A shared session is redrawn from the seed, and an arm session from its shared step-1 snapshot. Agent
  behaviour (`completed`, `agent-error`, `timeout`) is never grounds for a redraw. The redraw budget is **12
  calls**. A redraw starts only if its turns fit in what is left.

## 5. Outcome and secondaries

**Primary: D_v15.** It is computed per block (task, replicate, arm) from the snapshots seed, step 1 (shared) and
steps 2–5 (the arm's), by `experiments/drift-01/score-drift.ts` (zero calls). The scorer was already run on the
HEXDDD-01 trees in Part A.

- **D_v15** = the number of new distinct blocking identities at steps 2–5, against the prior union from step 1
  (`driftRun`, `STUDY2_S2D01`: edge grain, renames continue, step-final union, kFrom 2, kTo 5), under:
  - the **frozen rules**, counted when check-correct labels them `correct` (Study 2b's rule); **plus**
  - **R-D4 and R-XCTX** (DETECT-02, status `violation`; allowed and info findings are never counted).
- **Identities.**
  - Frozen findings use Study 2b's edge identity.
  - A v1.5 finding gives one edge per (command, aggregate root): source `<command file>#<command>`, target the root's
    declaration file.
  - R-D4 and R-XCTX on one command and root share the edge, as FF-S01 and FF-S03 share one in Study 2b.
  - Command edges never merge with import edges.
  - A rename continues the lineage (`lib/v15-identity.ts`, 7/7 unit tests).
- **Reported beside it, never instead:** `D_frozen` (frozen rules only) and `D_v15_seed` (steps 1–5 against the
  seed; arm-independent at step 1).

**Secondaries:**
- **Caught-and-fixed per step.**
  - *Snapshot grain*: identities present at step t−1 and gone at step t, after renames.
  - *Tool grain*, for `pull`: a `check_consistency` call returned findings, a later call in the same step returned
    none, and the step's snapshot has no v1.5 identity of that command.
  - *Tool grain*, for `gate`: a gate key shown, then reported resolved, and not open at the step's end.
  - The removal of the **inherited** step-1 identities (`inheritedRemoved`) is reported separately. It is the 2b
    mechanism.
- **Violations per step:** the identities present at each step, frozen and v1.5.
- **Per-opportunity rates.** The frozen exposure counter (`scripts/v1.4/exposure-count.ts`) covers Layered FF-S0x
  only. For DDD it is extended at zero calls, under unit test:
  - an opportunity is a command that writes at least one aggregate root and is neither an event handler nor a
    same-site delegate;
  - a violation is such a command flagged by R-D4 or R-XCTX (`v15Exposure`).
  - The rates are reported per step. For the frozen rules on these seeds the rate is **not available**.
- **Functional acceptance.** The HEXDDD-01 tasks have no behavioural tests, so acceptance beyond type-checking is
  **not available**. What is reported: the turn status, the harness type-check error count per step, and the
  scorer's own type-check of each snapshot.
- **Tool and gate use:** calls per tool and step, findings returned, gate edits and replies, Stop blocks, fail-opens,
  and refusals. The gaming flag is an agent-written `detect02.allow.yaml`. The scorer never honours one and records
  whether it was there.
- **Hand read.** Every new v1.5 identity is listed for the author's hand read (file, command, roots, step, block).

**Reporting.** Per task and arm, **never pooled**:
- ΣD_v15, mean, P(D_v15 = 0), and the per-block list;
- side by side with the HEXDDD-01 baseline, Part A: D_v15 2 on S1 and 2 on S2.

There are no tests of significance. With 3 blocks per cell this is a pilot.

## 6. Predictions, scenarios, edge cases

**Predictions** (stated now, before any call):
- **P1. `none` drifts on DDD.** On `t1` (S2), D_v15 ≥ 1 in at least 2 of the 3 `none` blocks. The mechanism is a
  new synchronous cross-aggregate or cross-context write at steps 2–5: step 5's line discounts against invoiced
  orders, as in HEXDDD-01, or step 3/4.
- **P2. `pull` and `gate` each reduce ΣD_v15 on `t1`** against `none`.
- **P3. `gate` reduces it more than `pull`.** The gate fires without the agent deciding to ask. In PUZZLE-02 the
  pull tool was called in every run, so the margin may be small.
- **P4. Inherited removal.** On `t1`, where step 1 leaves the `RecordPayment` cross-context write in place (as in
  HEXDDD-01), `gate` and `pull` remove it in more blocks than `none`. `none` removes it in none or at most 1.
- **P5. `t2` (S1) is weaker.** Its v1.5 identities rest on inferred roots, and HEXDDD-01 had one, at step 3. D_v15
  on `t2` is small in every arm. Nothing is predicted about the direction there.

**Scenarios and how they read:**
- **A: P1–P3 hold.** The first sign that v1.5 delivery reduces drift where the agents actually err. That would
  justify sizing a registered study.
- **B: `none` does not drift on `t1`** (ΣD_v15 = 0, or 1 block only). The floor is back for these steps, and the
  arm comparison is uninformative about D. The secondaries (inherited removal, tool-grain fixes) still say whether
  the tools act.
- **C: the arms equal `none`.** Either the agents ignore the findings, or the findings arrive too late:
  - the gate shows new findings on the edit that creates them, so "too late" would mean the agent saw them and moved
    on;
  - the tool-grain logs tell which.
- **D: the arms reduce D but raise type-check errors or failed turns.** That is a cost, reported beside D.
- **E: `pull` beats `gate`.** Possible if the spec reading (`get_architecture_spec`) is the active ingredient, as
  in 2b. Then the gate's findings add nothing beyond reading the spec.

**Edge cases:**
- **Step 1 differs across replicates.** That is expected: it is why every block of a replicate shares one step 1.
  Y₁ is identical across the three arms of a replicate.
- **Step 1 leaves no v1.5 identity** (the agent solved step 1 with an event). Then D_v15 counts births at 2–5
  only, and there is nothing inherited to remove. Reported.
- **The gate's Stop block** can make the agent work on an inherited finding at a step whose request does not ask
  for it. That is intended (the inherited channel).
- **An agent writes `detect02.allow.yaml`.** It is flagged as gaming and ignored by the scorer. The gate hub
  honours an overlay in the tree, so its findings may stop: recorded, not corrected.
- **A file rename** carries the command edge's lineage. A command that is renamed, not moved, is a new identity.
  That is a known limit of name-keyed command edges.
- **A tree that fails to type-check** is still scored, as in 2b. A tree the evaluator cannot evaluate is
  `unscored`, which `driftRun` keeps apart from 0.
- **Turn timeout:** 20 min per turn, the HEXDDD-01 value. A timeout is agent behaviour, not a redraw.

**What counts as failure:**
- **Of the run:** any isolation check failing (stop); the hard cap reached before 78 turns (report the incomplete
  blocks as incomplete; the cap is never raised); a gate or MCP hub fail-open rate above 10 % of events in an arm
  (the arm did not deliver; reported, not re-run).
- **Of the hypotheses:** P1 fails as stated in scenario B; P2 fails if either arm's ΣD_v15 on `t1` is ≥ `none`'s;
  P3 fails if `gate` ≥ `pull`.

## 7. Calls and the hard cap

| Phase | Calls |
|---|---|
| Model-call checks: READ probe, pull smoke, MCP confinement probe, gate smoke | 4 |
| Sessions: 2 tasks × 3 replicates × (1 + 3 × 4) | 78 |
| Redraws (whole sessions, infrastructure only) | ≤ 12 |
| **Hard cap** | **94** |

- **Enforcement.** The driver's ledger counts every spawn of the binary other than `--version` in
  `/srv/o/out/calls.jsonl`, and the harness's own retries are counted too. A spawn is refused past the phase cap
  (checks 4, sessions 90) or past the total of 94.
- **Ledger.** Every call is recorded with its phase, session, step and arm, and the ledger is committed. The cap is
  never raised.
- **Scoring, the hand-read list and the reports are zero-call.**

## 8. Limits (stated now)

- **Small.** Two tasks, three blocks per cell. Same-vendor generator and reader. The seeds and the rules come from
  this project, and DETECT-02 was developed on the HEXDDD-01 trees: on `t1`/`t2` the instrument is partly fitted
  (Part A §3).
- **The arms differ by more than findings.** `pull` adds an instruction and the spec reading. `gate` adds hooks.
  Neither is placebo-controlled.
- **S1 roots are inferred**, so `t2`'s D_v15 rests on a heuristic that had false hits on human repositories
  (`ops/notes/detect-02-precision-note.md`).
- **Not available:** functional acceptance beyond type-checking, and the frozen exposure counter on these styles.

## Changelog
- 2026-10-23: v1, before any DRIFT-01 call.
