# v1.3 Study 2 dress-rehearsal tasks (rehearsal only)

**2026-10-16. Not the sealed Study 2 tasks, not the loop pilot, not the floor probe.** Four new tasks written for the
dress rehearsal (`Docs/v1.3/study2-dress-rehearsal.md` on branch `v1.3-study2-readiness`) by following
`Docs/v1.3/study2-task-design.md`. The sealed directory was not opened to write them, and nothing here is derived from
it. They are **never to be used in Study 2**.

| File | Shown to the agent? | What it is |
|---|---|---|
| `tasks.json` | yes, step by step (`request` only) | The tasks, in the harness's `LoopTasksFile` format (`scripts/lib/loop/types.ts`; `validateTasks` in `scripts/lib/loop/plan.ts`). |
| `styles.json` | no (it selects the harness's style frame) | Target style, evaluator spec and DDD contexts per task. |
| `design-notes.md` | **never** | Author commentary: which blocking-tier edge each step is aimed at, and why the step is not contrived. |
| `hint-audit/` | no | The frames the harness would send (`frame-<task>.txt`, generated from `scripts/lib/loop/style.ts`; the layered one copied from the floor probe), and the output of `Docs/v1.3/study2-task-design/hint-audit.mjs` on every request and frame. |

## Before any run (author)

1. **Sealed-list check.** Check each domain (repair café, school bus tracking, vineyard harvest, ice rink) against the
   sealed Study 2 list without disclosing it (`Docs/v1.3/pilot-tasks.md` §1). Replace any task that matches, re-run the
   hint audit and re-hash. The authoring session could not do this check: it never reads the sealed directory.
2. **Exclusion list.** These four domains join the pilot and floor-probe domains as excluded from Study 2.
3. **Hash.** Record `sha256sum fixtures/v1.3-rehearsal-tasks/tasks.json` (and the per-task hash of
   `JSON.stringify(task)`, as `pilot-tasks.md` §5 does) in the rehearsal provenance before the first model call. The
   dress-rehearsal plan expects its tasks file at `experiments/study2-rehearsal/rehearsal-tasks.json`; copy this file
   there unchanged if these tasks replace the pilot tasks it currently names.
4. **DDD spec.** `vineyard-harvest` needs a rehearsal spec built on `presets/ddd.yaml` that declares `src/picking/` and
   `src/cellar/`, written and hashed before any run (as for the pilot's DDD spec).
5. **Layered.** `ice-rink` targets Layered, which the loop harness cannot frame yet (`styles.json` note). It is a spare:
   use it only if Study 2 adopts Layered; otherwise the rehearsal runs the other three (one per loop style, which is
   what the dress rehearsal's Latin square needs).

## Hint audit (run 2026-10-16)

```bash
A=Docs/v1.3/study2-task-design/hint-audit.mjs; T=fixtures/v1.3-rehearsal-tasks
node $A --preset presets/hexagonal.yaml          --task repair-cafe      $T/tasks.json
node $A --preset presets/clean-architecture.yaml --task school-bus       $T/tasks.json
node $A --preset presets/ddd.yaml                --task vineyard-harvest --context picking --context cellar $T/tasks.json
node $A --preset presets/layered.yaml            --task ice-rink         $T/tasks.json
```

| Task | Style | Requests: FAIL / WARN | Frame, layout arm (FAIL) | Frame audited as a no-hint frame |
|---|---|---|---|---|
| `repair-cafe` | hexagonal | **0** / 5 | 0 | FAIL (as expected: it names the style and folders) |
| `school-bus` | clean | **0** / 1 | 0 | FAIL (as expected) |
| `vineyard-harvest` | ddd | **0** / 12 | 0 | FAIL (as expected) |
| `ice-rink` | layered | **0** / 6 | 0 | FAIL (as expected) |

Every request passes. Each of the four presets run over all four tasks (so no request hints at another style either)
also gives 0 FAIL on all 20 steps. Verdicts on the WARN hits (each is ordinary product language, not a structure hint):

| Term | Where | Verdict |
|---|---|---|
| `API` (in "HTTP API") | every task with a provider | The provider's API, as in every pilot task. It names the third party, not a folder of ours. In DDD `api` is also a per-context folder name; the agent never sees that folder named in a request. |
| `model` ("brand and model") | repair-cafe 1, 2 | An appliance model number. |
| `file` ("as a CSV file") | repair-cafe 5 | The upload format. |
| `public` ("public ice rink", "public session") | ice-rink 1, 2 | Open to the public. |
| `rules` ("the same capacity and skate-hire rules") | ice-rink 2 | Product rules; no layer word next to it. |
| `picking`, `cellar` | vineyard-harvest, every step | The two parts that the DDD frame names as contexts (`src/picking/ for picking and src/cellar/ for the cellar`). The pilot DDD task names its parts the same way. Their folder paths never appear in a request. |

`hint-audit/<task>.requests.txt` and `.json` hold the full output, with the context of every hit.
