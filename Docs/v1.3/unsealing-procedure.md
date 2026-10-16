# v1.3 unsealing procedure for the Study 2 task list (tooling)

**2026-10-16. Tooling, not a pre-registration.** This file describes the one-shot tool that verifies, audits and converts the sealed Study 2 task list (`Docs/v1.3/sealed-hashes.md`, row 1), and the exact command sequence the author runs once, locally. The tool was built and tested only on the pilot tasks (`Docs/v1.3/pilot-tasks.md` §2) and on a made-up fixture. It was never run on, pointed at, or written with any knowledge of the sealed directory. Readiness-gate lines: D2 (tasks audited for hidden structure hints) and S14 (sealed list intact).

## 1. Term list and pass criteria (committed before the tool)

**Term list.** `scripts/v1.3/schemas/unseal-terms.json`, revision `unseal-terms-1`. Three lists:

- `banned`: the words of `pilot-tasks.md` §1 ("never name a layer, a port, an interface or a pattern") as listed in the job: layer, port, adapter, interface, repository pattern, use case, entity, aggregate, bounded context, domain, infrastructure, presentation, controller, service layer, hexagonal, clean architecture, DDD, dependency inversion; the preset layer names that are not ordinary product words (`adapters-inbound`, `adapters-outbound`; `domain`, `infrastructure`, `presentation` are already in); and a few pattern names the same rule covers (layered, ports and adapters, onion architecture, value object, domain event, anti-corruption layer, shared kernel, dependency injection, MVC, model-view-controller, CQRS).
- `review`: preset layer names that are also ordinary product words (`application`, `api`, `composition`, `config`, `persistence`, `business`) and `repository`. A hit is listed for the unsealer to judge; it does not fail a step on its own.
- `allow`: product phrases in which a hit is ignored (`domain name`, `legal entity`, `http api`, `rest api`, `web api`, `business name`, `business hours`). `service` alone is not a term (only `service layer` is), so a product "service" needs no entry.

Matching is case-insensitive and whole-word; multi-word terms also match across a hyphen, an underscore or no separator (`use-case`, `usecase`); plurals match (`entities`, `ports`, `APIs`). A hit inside a longer hit is folded into it (`repository pattern` is one banned hit, not also a `repository` review hit).

**Per-step verdict.** `FAIL` if the step has at least one banned hit outside an allow phrase; else `REVIEW` if it has a review hit; else `PASS`.

**Audit pass criterion (D2, task part).** No step is `FAIL`, and the unsealer has marked every `REVIEW` hit in the sheet as `product` (an ordinary product word) rather than `structure` (a hint at a layer or pattern). A `structure` mark counts as a `FAIL`. A `FAIL` is never overridden by the tool; the step is reworded or the task replaced, outside the repository, before any run, and the hashes are recomputed.

**Tool pass criterion (this job).** The tool is accepted when its tests show all of:

1. On `Docs/v1.3/pilot-tasks.md` it reproduces the block hash and the three task hashes recorded in `Docs/v1.3/pilot-outcome-memo.md` §7.
2. It refuses (exit 2, nothing written) when the file's sha256 differs from `--expected-sha256`, and when the file has no JSON block or more than one.
3. On a made-up fixture with planted terms it reports every planted banned term, folds contained hits, ignores allow phrases, and gives the expected per-step verdicts.
4. Its standard output never contains a task id, a task title, the description, or any run of four consecutive words of any request; only counts, indices and hashes.
5. The converted tasks file passes `validateTasks` (`scripts/lib/loop/plan.ts`) and is byte-for-byte the same tasks as the source.

The pilot tasks' own audit verdicts are reported as they come out, whatever they are; they are not part of the tool's pass criterion.

## 2. The tool

`scripts/v1.3/unseal-tasks.ts` (logic in `scripts/v1.3/lib/unseal.ts`, tests in `tests/unit/scripts/v1.3/unseal.test.ts`, fixture `tests/fixtures/v1.3/unseal/planted.md`).

```bash
npx tsx scripts/v1.3/unseal-tasks.ts --file <tasks.md|tasks.json> --expected-sha256 <hex> \
  --out <tasks.json> --audit <sheet.csv> [--terms <terms.json>]
```

In order, it:

1. Refuses if `--out` or `--audit` lies inside the repository, or both name the same file.
2. Hashes the whole file and refuses on a mismatch with `--expected-sha256`, before parsing anything.
3. Takes the JSON: a `.json` file as is, or the single ```` ```json ```` block of a markdown file (the `pilot-tasks.md` §2 layout; the block hash follows `pilot-tasks.md` §5). Zero or several blocks: refused.
4. Validates it as a `LoopTasksFile` with the harness's own `validateTasks`. Parser and validation messages are withheld (they would quote ids or text); only the number of problems is printed.
5. Prints the task count, the steps per task, the sha256 of `JSON.stringify(task)` per task (the memo's method) and of `JSON.stringify(step)` per step, by index only.
6. Audits every step request against the term list (§1), and every task title (the title reaches the agent through `TASK_TITLE` in `scripts/lib/loop/prompts.ts`) and task id.
7. Writes the audit sheet (CSV: a `step` row with the verdict per step, a `hit` row per hit with the term and the hit's context cut to three words either side, `title-hit` rows, and a `signature` row) and the tasks file (`JSON.stringify(tasks, null, 2)`), both with mode 0600.
8. Prints the sha256 of both outputs and the verdict.

Exit codes: 0 no banned term (REVIEW hits may still need marks); 2 refused (nothing written); 3 a banned term is present (both outputs are written so the unsealer can see where).

**Standard output never contains task text**: no id, no title, no description, no request words; only counts, indices and hashes. The audit sheet does contain short fragments, so it never enters the repository.

## 3. The author's command sequence (once, locally, never by an agent)

Run from the repository root, at a clean checkout of the commit that will run Study 2. `$SEALED` is the sealed directory; `$OUT` is a directory outside the repository and outside every agent work directory (for example `$SEALED/unsealed-2026-xx-xx/`).

```bash
# 0. S14: the plain hash, independent of the tool. Must print 82a2f512e50d4eafb4ce6a42335adc2b6c2f882a6238e298a747303d0090169c.
sha256sum "$SEALED/v1.3-study2-tasks.md"

# 1. Verify, audit and convert in one shot.
npx tsx scripts/v1.3/unseal-tasks.ts \
  --file "$SEALED/v1.3-study2-tasks.md" \
  --expected-sha256 82a2f512e50d4eafb4ce6a42335adc2b6c2f882a6238e298a747303d0090169c \
  --out "$OUT/study2-tasks.json" --audit "$OUT/study2-audit.csv" | tee "$OUT/unseal-stdout.txt"

# 2. Open the sheet; mark each REVIEW hit `product` or `structure` in unsealer_mark; sign the last row.
# 3. Hash the signed sheet.
sha256sum "$OUT/study2-audit.csv"
```

**If step 1 refuses with "N json blocks".** The sealed file predates this tool and may not use the `pilot-tasks.md` layout. Then: write the tasks by hand as a `LoopTasksFile` JSON in `$OUT`, without changing any request text; hash it with `sha256sum`; run step 1 with `--file "$OUT/<that file>.json"` and that hash. The commit (§4) then records both the sealed file's hash (step 0) and the hand-made JSON's hash, and says the conversion was by hand.

**If the verdict is FAIL**, or a REVIEW hit is marked `structure`: reword the step or replace the task outside the repository, before any run; record the new hashes in the same commit as the reason ("step reworded after the D2 audit"), never the words.

## 4. What gets committed afterwards (and what never does)

Committed, in one commit to `Docs/v1.3/sealed-hashes.md` or the Study 2 run record (author's choice, after the pre-registration exists):

- the output of step 0 and the full standard output of step 1 (`unseal-stdout.txt`): file, block, task and step hashes, counts, verdict;
- the sha256 of the signed audit sheet, the number of REVIEW hits marked `product` and `structure`, and the term-list revision and its sha256;
- the plan's `tasksFile` path stated as outside the repository (S14).

Never committed: the tasks file, the audit sheet, any request text, task title or task id, any allow phrase added because of a sealed task (it would quote the task; a needed product-word exception is a `product` mark in the signed sheet instead).

## 5. Result on the pilot tasks (development check, not a gate result)

`Docs/v1.3/pilot-tasks.md`, terms `unseal-terms-1`: block hash and the three task hashes equal the memo's §7 values; 3 tasks, 12 steps; PASS 9, REVIEW 3, FAIL 0; banned hits 0, review hits 7 (six of `application(s)` in the shelter task, each meaning an adoption application, one of `API` in "has no API"); no title or id hit; the converted tasks file is byte-identical to the §2 block (its sha256 equals the block hash). Exit 0, "PASS pending the unsealer's marks on REVIEW hits".

## 6. Not done here

- The tool has never been run on the sealed file; S14 and D2 stay UNKNOWN until the author runs §3.
- The step and repair frames and the tool sentence are not audited by this tool (D2's frame part is `tests/unit/scripts/loop/pilot.test.ts`).
- Acceptance-check text (D12) does not exist yet and is not audited.
- Whether the sealed file uses the one-JSON-block layout is unknown by design; §3 gives the fallback.
