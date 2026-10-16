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
