# 3. Reading a report

## Defining rules and warnings

Every rule is in one of two tiers. The report calls them **blocking** and **advisory**. The HTML report (chapter 6)
calls them **defining rule** and **warning**.

- **Blocking (defining rule).** The rule states something the style defines, and it is checked as a precise fact
  about the code: an import exists or it doesn't, a class is declared in a given place or it isn't. Examples: the
  domain imports nothing from outer layers; no import cycles; the domain does not import an ORM; an outbound adapter
  implements a port. **Only these rules can fail the verdict.**
- **Advisory (warning).** Everything else: metrics with thresholds (fan-out, instability, abstraction ratio),
  proxies for design principles (too many public methods, interfaces that are too wide), naming conventions, test file
  pairing, and design guidelines the style's sources don't state as hard constraints. They are counted and listed.
  They never fail the verdict.

The tier of each rule is fixed per style. The table is in `Docs/v1.3/rule-tiers.md`. One rule changes tier by style:
`no-layer-skip` (FF-S03) is blocking only for `layered`, because only strict layering forbids skipping a layer.

A practical reading: fix blocking findings now. Treat warnings as a list to review. Some are real design problems,
and many are noise on a given codebase. A typical noise source is FF-CV05 `test-file-pairing`, which flags every
source file without a test file next to it.

## The human report, line by line

From the [quick start](01-quick-start.md) run on `fixtures/variant-a-structural`:

```
╔═══════════════════════════════════════════╗
║  Architectural Health Score: 0.44 (HARD-BLOCK)║
╚═══════════════════════════════════════════╝
  Verdict:             hard-block                          <- older weighted score (v1.2E), kept for comparison
  v1.3 scoring:        FAIL (any-blocking-violation; v1.2E verdict hard-block)   <- this is the verdict that counts
  Blocking AHS:        0.462  (3 of 6 blocking rules violated, 5 violations)
    FF-S01   dependency-direction: 2
    FF-S02   no-cyclic-deps: 2
    FF-S04   no-domain-outward-dep: 1
  Advisory findings:   11 in 6 of 16 rules
    FF-C01   domain-stability: 1
    FF-CV05  test-file-pairing: 6
    ...
  N/A: FF-P06 FLOWS_TO field rows: 0 of 0 rows (FLOWS_TO edges in graph: 1)
  Top Violations:
    1. [critical] src/application/use-cases/CreateTaskUseCase.ts — ... (application) imports from src/infrastructure/repositories/InMemoryTaskRepository.ts (infrastructure)
    ...
```

- **`v1.3 scoring: PASS | FAIL`** is the verdict, and it sets the exit code (0 or 1). It is FAIL when any blocking
  rule has at least one violation.
- **`Verdict` / `Architectural Health Score`** at the top is the older weighted score, which mixes all rules. It can
  disagree with the v1.3 verdict. For example, the layered `no-layer-skip` example in chapter 2 reads
  `v1.2E verdict pass` and `v1.3 scoring: FAIL`. Go by the v1.3 line.
- **`Blocking AHS`** is a 0–1 score over the blocking rules only. Use it to compare runs. The verdict does not use it.
- **`N/A`** marks a rule half that cannot be checked reliably and is not scored. It is shown with its denominator, so
  you can see how much was not checked. See FLOWS_TO in [chapter 8](08-faq-and-limitations.md).
- **`Failed to run`** (not in this run) lists rules whose query did not run, with the error. A rule listed there was
  not checked, so a PASS says nothing about it.
- **`Top Violations`** lists findings, blocking first. For graph rules some entries read only
  `Violation in <file>`. The JSON output has the target file and line for each finding.

## JSON output

```bash
npx tsx bin/firewall.ts evaluate --project fixtures/variant-a-structural --spec specs/clean-arch.yaml \
  --engine cypher-interp --symbolic-only --format json > report.json
```

The parts you usually need:

- `tiers.verdict`: `"pass"` or `"fail"`, the v1.3 verdict. (The top-level `verdict` is the older one.)
- `tiers.blocking.rules[]` and `tiers.advisory.rules[]`: `{ functionId, name, tier, violationCount, violated }` per
  rule.
- `violations[]`: one entry per finding, with `functionId`, `severity`, `filePath`, `target`, `line` and `message`.
- `parseCoverage` and `importResolution`: how many files parsed and how many imports resolved. Check these first when
  a result looks too clean.

```bash
jq -r '.tiers.verdict, (.tiers.blocking.rules[] | select(.violated) | "\(.functionId) \(.violationCount)")' report.json
# fail
# FF-S01 2
# FF-S02 2
# FF-S04 1

jq -r '.violations[] | select(.functionId=="FF-S01") | "\(.filePath):\(.line) -> \(.target)"' report.json
# src/application/use-cases/CreateTaskUseCase.ts:2 -> src/infrastructure/repositories/InMemoryTaskRepository.ts
# src/domain/entities/Task.ts:2 -> src/infrastructure/config/InfraConfig.ts
```

`--format csv` prints a header and one summary row per run. That row holds the older weighted score and verdict, not
the v1.3 verdict, so use JSON when you need pass/fail.

## Fix hints (available in PR #143)

`--hints` adds a fix proposal to each **blocking** finding. Hints are computed from the graph and the spec, not by an
LLM. They are off by default, and without the flag the output does not change.

```bash
git checkout v1.3-fix-hints
npx tsx bin/firewall.ts evaluate --project fixtures/variant-a-structural --spec specs/clean-arch.yaml \
  --engine cypher-interp --symbolic-only --hints
```

```
  Fix hints (5 blocking findings):

  [FF-S01 dependency-direction] src/application/use-cases/CreateTaskUseCase.ts -> src/infrastructure/repositories/InMemoryTaskRepository.ts
    Problem: CreateTaskUseCase.ts in application imports InMemoryTaskRepository.ts in infrastructure, which application may not depend on.
    Breaks:  src/application/use-cases/CreateTaskUseCase.ts (application) -> src/infrastructure/repositories/InMemoryTaskRepository.ts (infrastructure)
             rule: application may import only itself and domain (the layer order (inner to outer: domain < application < infrastructure))
    Target:  domain (src/domain/repositories/)
    Fix:     Depend on the port ITaskRepository (src/domain/repositories/ITaskRepository.ts, domain) that InMemoryTaskRepository.ts already implements, instead of on InMemoryTaskRepository.ts itself; inject the implementation from the composition root.
```

With `--format json` the report gains a `fixHints[]` array, one entry per blocking violation (keyed by `violationId`).
Each entry has a `fix.text` and a machine-readable `edit` list (`remove-import`, `add-import`, `add-file`). The MCP
tools `check_file`, `check_diff` and `explain_violation` take a `hints: true` argument on that branch. The MCP server
also accepts `--hints` or `DAEDALUS_HINTS=1`. MCP hints are less specific than CLI hints: they have only the spec, not
the graph, so they cannot point to an existing port. A hint is a proposal. Read it before you apply it.
