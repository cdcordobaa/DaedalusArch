# Floor-escape repairs that need no author decision (2026-10-16)

Implements the items of `Docs/v1.3/floor-escape-design-2026-10-16.md` §3.2, §3.3 and §3.6 that do not wait on an
author decision. Every change is **off by default**: a plan without the new `frame` option runs today's L2 frame,
byte for byte (unit tests, and the loop replay `tests/integration/loop` still reproduces its recorded runs).
No model call and no Neo4j were used.

Not touched (they need author decisions, design §6 and §3.6): `presets/layered.yaml` (composition slot, Q2, Q12),
the DDD spec handling (D15), any Cypher template, any rule tier, the per-task MCP `specPath` (A25) and the layered
style frame.

## 1. Spec rungs L3 and L4 (§3.3)

Plan option, absent by default:

```json
"frame": { "specRung": "L2" | "L3" | "L4", "attention": true | false }
```

- **L2** (default): today's frame.
- **L3**: after the layout sentence, `The architecture has these rules:` and one line per blocking rule of the task's
  evaluator spec. The blocking rules are the spec's enabled symbolic fitness functions whose tier
  (`src/scoring-engine/rule-tiers.ts`, read only, at the spec's `architecture.style`) is blocking, in spec order.
  Each line is `It is a violation when <first clause of RULE_PLAIN>`, plus the later clauses that state the rule
  ("dependencies must point inward"); clauses that give a fix ("break the cycle…", "go through a port…", "keep the
  domain free…") are left out (`ruleStatement` in `scripts/lib/loop/prompts.ts`). Example (Hexagonal):

  ```text
  The architecture has these rules:
  - It is a violation when a module imports a layer it may not depend on; adapters may depend on the application and the domain, the application only on the domain, and the domain on nothing outside it.
  - It is a violation when some files import each other in a circle.
  - It is a violation when the core (domain or application) imports an adapter or outside code; the core must depend on nothing outside it.
  - It is a violation when the domain imports a framework, an HTTP library or an I/O module.
  - It is a violation when an outbound adapter does not implement a port (an interface) declared in the domain or the application.
  - It is a violation when a domain class receives an infrastructure or framework object through its constructor.
  ```

- **L4**: L3 plus `The file architecture-spec.yaml in the current directory is the architecture specification the
  code is checked against.` The harness copies the task's evaluator spec into the cwd before the base commit
  (`scripts/lib/loop/rungs.ts`), so it never shows in a step diff (it does count in `treeFileCount`, +1).
  `run.json` records the rung, the spec source and its sha256.
- **File-read log (L4)**: after every turn, `specRead { method, read, present, intact }` in the turn record and one
  line in `spec-reads.jsonl`. Method: the file's access time, primed before each turn so the first read updates it
  (works under `relatime`; an L4 run's snapshot git ignores change times so the harness's own `git status` does not
  read the file). A self-test at run creation records `method: "unavailable"` and `read: null` on a `noatime` file
  system. A "read" is any opening of the file during the turn (the Read tool, a grep over the directory, …); it says
  the agent had the content in front of it, not that it used it.
- L3 and L4 need a static spec for every task. A DDD profile with `specMode: ise-step1` is refused by the plan
  check, because that spec does not exist before step 1 (decision D15).

The wording of the lead, the rule lines and the L4 sentence is DRAFT; every prompt is hashed into the turn record.

## 2. Attention sentence (§3.2)

`"attention": true` adds `Check your work against the architecture described here as you go.` as the last line
before the type-check sentence, in every step frame, for every arm and rung. The arms still differ only by their
own tool sentence, which `armPrompt` appends after the frame (tested for `none` and `daedalus-mcp`).

## 3. hint-audit.mjs (§3.3, §3.6)

- Vocabulary: `orm`, `orms`, `typeorm` FAIL; `database(s)`, `table(s)`, `column(s)` WARN (an ordinary product sense
  exists: a league table, a report column).
- Frame rule: `--frame-rung L2|L3|L4`. L2 equals `--frame-may-name-layout`. L3/L4 frames may name layers, imports,
  role words and the spec file (WARN, for the identity check across arms), and **FAIL on any fix instruction**
  (`move`, `relocate`, `restructure`, `refactor`, `rewrite`, `extract`, `break the cycle`, `go through a port`,
  `keep the domain free`, `fix these violations`).
- The L3 and L4 frames (with the attention sentence) of the rehearsal Clean (`school-bus`) and Hexagonal
  (`repair-cafe`) tasks give **0 FAIL** at every step under `--frame-rung`; the same frames audited as no-hint
  frames FAIL, as they must (`tests/unit/scripts/loop/frame-rungs.test.ts`). The DDD and Layered rehearsal tasks
  have no L3/L4 frame yet (D15; no layered style in the harness).

### Changed verdicts on existing inputs

Old (origin/v1.3) vs new script, every command of `fixtures/v1.3-rehearsal-tasks/README.md` (own preset, all four
presets, layout frames, no-hint frames) and the calibration inputs of `calibration/run.sh`: 269 audit units.

| Input | Units | Verdict changes | FAIL count changes |
|---|---|---|---|
| Rehearsal tasks (requests, 4 tasks, own preset and all four presets) | 100 | 0 | 0 |
| Rehearsal frames (layout arm and no-hint) | 8 | 0 | 0 |
| Calibration: pilot tasks, planted hint | 49 | 0 | 0 |
| Calibration: floor-probe tasks, 4 presets | 112 | 4 (one step under each preset) | 0 |

The one changed step is `hotfix-correct-result` of the floor-probe tasks: OK -> WARN, two new WARN hits on
"tables" ("the tables are wrong": football league tables). Verdict: ordinary product language. Two other steps of
the same task file gain WARN hits on "table"/"tables" without a verdict change. The calibration outputs were
re-generated with `calibration/run.sh`; every FAIL total is unchanged (pilot 0, probe 0, hexagonal layout frame 0,
no-hint frame 21, planted sentence 10).

## 4. Stage-0 instrument probe (§3.6)

Zero model cost. See `Docs/DiagnosticRuns/v1.3-stage0-orm-probe-2026-10-16.md`.

## 5. How to check

```bash
npx jest --maxWorkers=2 tests/unit/scripts/loop tests/integration/loop
bash Docs/v1.3/study2-task-design/calibration/run.sh
```
