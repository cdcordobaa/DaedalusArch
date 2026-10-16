# Deterministic fix hints for blocking findings (v1.3)

Written 2026-10-16. Code: `src/fix-hints/`. Evaluation: `scripts/v1.3/fix-hints-eval.ts`, results in `results/v1.3-fix-hints/`.

## 1. Why

In the MCP firewall-in-the-loop setting (`Docs/mcp-firewall-in-the-loop.md`, `src/mcp-server/`), a coding agent receives a blocking finding and has to change the code until the finding is gone. A rule id and a message say *that* something is wrong. They do not say where the code should go or what the smallest change is. Without that, the agent guesses: it often deletes the import, moves the wrong file, or puts the abstraction next to the implementation.

A **fix hint** adds four things to every blocking finding:

1. **Problem**: what is wrong, in one plain sentence.
2. **Breaks**: the dependency (or fact) that breaks the rule, and the allowed-dependency rule it breaks, read from the spec's layer model.
3. **Target**: where the code should live instead, as a layer of the spec, a folder those layer globs cover and, where there is one, the concrete file.
4. **Fix**: the minimal structural change (`introduce-port`, `use-existing-port`, `move-file`, `move-declaration`, `lift-to-caller`, `route-through`, `break-cycle`, `extract-adapter`, `replace-with-own-type`, `implement-port`, `use-public-api`, `reference-root`, `remove-repository`, `make-immutable`), as text and as a machine-readable **graph edit**.

Hints are deterministic. They are built from the finding, the spec and, in the CLI, the extracted graph, and **never from an LLM**. Fixed rules make every choice (§2): the same input always gives the same hint, byte for byte (unit test). No rule text, tier, spec, preset or Cypher template was changed. Hints are produced only for rules whose v1.3 tier is **blocking** for the spec's style (`ruleTier`, `Docs/v1.3/rule-tiers.md`): FF-S03 gets one only in `layered`, and FF-P02/P04/P05, metrics, conventions and DDD FF-DT05/DT06 get none.

## 2. Templates per rule family

| Family | Rules (template) | Decision order (first that applies wins) |
|---|---|---|
| dependency-direction | FF-S01 `dependency-direction`, `dependency-direction-graph`; FF-S04 `no-domain-outward-dep`, `core-isolation`; FF-S03 when the step goes up or sideways | **Core source** (domain/application layer, style not `layered`, target not a presentation layer). The steps are in order:<br>(0) The source imports a value (a constant): move it into the source layer.<br>(a) The target implements a port the source may import: depend on that port.<br>(b) The target implements an interfaces-only port in a layer the source may not import: move that port inward, to a layer the source and all the port's importers may import and that may import the port's own dependencies.<br>(c) The target declares only types: move the file inward under the same constraints.<br>(d) The source uses an interface of the target: move that declaration into the source layer.<br>(e) The target is a data shape (`*Dto`, `*Record`, `*Model`, ...): declare an own `<Stem>Data` type in the source layer.<br>(f) Otherwise introduce a port interface in the source layer (name from the implementation: `SystemClock` -> `Clock`, `InMemoryLoanRepository` -> `LoanRepository`). The target implements it.<br>**Anything else** (layered; an outer or lower layer reaching up; a presentation target): **lift** the code that needs the target into the source's caller in a layer that may import both ends, or into a new `<Source>Mapper`/`Presenter` there. |
| layer-skip | FF-S03 `no-layer-skip` (blocking in `layered`), an inward step that skips a layer | Route through the layer in between. For a data shape: use the same-named type there (`ProductRecord` -> `Product`). Otherwise, use a file there that already imports the target, preferring the same stem (`CatalogController` -> `CatalogService`). Failing both, add a new `<Stem>Service`. |
| cycle | FF-S02 `no-cyclic-deps` | Cut one edge of the cycle: first an edge that also breaks the layering, then a type-only edge, then the edge that closes the cycle. The importer depends on an interface `<Name>Contract` in a layer both ends may import, and the imported file implements it. |
| forbidden-package | FF-P01 / FF-DT04 `domain-purity` | Type-only import: an own type in the same layer, with the framework type converted in the adapter. Runtime import: move the framework code to an adapter in the infrastructure layer. Web packages go to the presentation layer and DI packages (`@nestjs/common`, ...) to the composition root. The dependency between the domain file and the adapter points whichever way the spec allows: the adapter imports the domain file (Clean, Hexagonal), or the domain file uses the lower layer (layered). |
| held-infrastructure | FF-P06 `domain-state-purity` | Hold a port instead of the infrastructure class. Use the port it implements in the domain if there is one. Otherwise move its interfaces-only port into the domain. Otherwise introduce one. The field or constructor parameter takes the port type. |
| missing-port | FF-P03 `repository-pattern`, `port-adapter-pattern` | If the adapter implements a local interface outside the port layers, move that interface next to the core's other ports. Otherwise, if the core already has an interface with the port's name, declare `implements` it. Otherwise introduce that port next to the core's other ports. |
| context-membership | FF-DS01 `bounded-context-modules` | Used by exactly one context: move the file into that context, in the innermost layer all its importers may import. Used by none or by several: move it into the shared kernel (the `outside_contexts` directory). |
| context-boundary | FF-DS02 `context-isolation` | Import through the target context's public API file (re-export the name there if missing), or translate in the source context's ACL. |
| aggregate-boundary | FF-DT01 `aggregate-boundary` | Reference the aggregate root instead of the inner entity. |
| aggregate-repository | FF-DT02 `repository-aggregate-root` | Remove the inner entity's repository. Persist the entity through the root's repository and point the callers there. |
| value-object-mutability | FF-DT03 `value-object-immutability` | Keep the file where it is and make the class immutable. The steps are named from the finding's member list: readonly fields, no set accessors, mutators return a new instance. |

**Which allowed-dependency rule is broken** comes from the spec:

- `architecture.allowed_dependencies` for hexagonal and DDD;
- otherwise the layer order with the active import rules: FF-S01 inward only, FF-S04 nothing outside the domain, and FF-S03 adjacent steps only, which applies in `layered`.

`SpecModel.mayImport` reuses the predicates the MCP spec checks already use (`layerPairHits`).

**Folders** come from the layer's globs:

- A `*` segment takes the corresponding segment of the file the fix starts from, so `src/*/domain/**` near `src/ordering/application/X.ts` gives `src/ordering/domain/`.
- New code in the same layer as that file goes next to it.
- In feature-module projects (nestjs `file_patterns`), the file keeps the folder and gets a kebab-case name.

Every proposed path is checked to resolve to the intended layer before it is used.

**Graph facts vs spec only.**

- `firewall evaluate --hints` passes the extracted APG. The CLI hints can then use existing ports (IMPLEMENTS), declarations (an interfaces-only file, the name imported), importers (the caller to lift into, the wrapper to route through) and the contexts that use a file.
- The MCP tools have no graph, so their hints use the spec and the import alone (`basis: "spec"`). They then fall back to the generic step: introduce a port, add a `<Stem>Service`, move a type-only import's declaration.

## 3. Where hints appear

Hints are off by default everywhere, and the default output is unchanged (§5).

**Report JSON** (`firewall evaluate --format json --hints`): an additive optional top-level field `fixHints`, one entry per blocking violation in violation order, keyed by `violationId`. The report schema gained the optional `fixHints` property in both copies (`schemas/report.schema.json` and the embedded `REPORT_SCHEMA`), with an "Amended 2026-10-16" note in its `$comment`. A report without the field validates as before. Example (clean-architecture, `v02-domain-uses-infrastructure-clock`):

```json
{
  "violationId": "v-27af551f44182944",
  "filePath": "src/domain/services/LoanPolicy.ts",
  "targetPath": "src/infrastructure/system/SystemClock.ts",
  "ruleId": "FF-S01",
  "ruleName": "dependency-direction",
  "family": "dependency-direction",
  "problem": "LoanPolicy.ts in domain imports SystemClock.ts in infrastructure, which domain may not depend on.",
  "breaks": {
    "dependency": "src/domain/services/LoanPolicy.ts (domain) -> src/infrastructure/system/SystemClock.ts (infrastructure)",
    "rule": "domain may import only itself (the layer order (inner to outer: domain < application < infrastructure))"
  },
  "target": { "layer": "domain", "folder": "src/domain/services/", "path": "src/domain/services/Clock.ts" },
  "fix": {
    "action": "move-file",
    "text": "Move the port Clock that SystemClock.ts implements from src/application/ports/Clock.ts to src/domain/services/Clock.ts (domain), and make LoanPolicy.ts depend on Clock instead of SystemClock.ts; inject SystemClock.ts from the composition root."
  },
  "edit": [
    { "op": "move-file", "from": "src/application/ports/Clock.ts", "to": "src/domain/services/Clock.ts", "layer": "domain" },
    { "op": "remove-import", "from": "src/domain/services/LoanPolicy.ts", "to": "src/infrastructure/system/SystemClock.ts" },
    { "op": "add-import", "from": "src/domain/services/LoanPolicy.ts", "to": "src/domain/services/Clock.ts", "typeOnly": true }
  ],
  "basis": "graph+spec"
}
```

**CLI human output** (`--format human --hints`): a "Fix hints" section after the usual report (layered, `v03-controller-reads-gateway`):

```text
  Fix hints (1 blocking finding):

  [FF-S03 no-layer-skip] src/presentation/http/CatalogController.ts -> src/persistence/ProductGateway.ts
    Problem: CatalogController.ts in presentation imports ProductGateway.ts in persistence, which presentation may not depend on.
    Breaks:  src/presentation/http/CatalogController.ts (presentation) -> src/persistence/ProductGateway.ts (persistence)
             rule: closed layering: each layer imports only the layer directly below it; presentation may import only itself and business (the layer order (inner to outer: persistence < business < presentation))
    Target:  business (src/business/services/)
    Fix:     Route through src/business/services/CatalogService.ts (business), which already uses ProductGateway.ts: call it instead of importing ProductGateway.ts directly.
```

**MCP tools.** PR #122 (MCP v2) was still open when this was written, so the hints are wired into the v1.3 tools as they are on `v1.3`. `explain_finding` does not exist there; `explain_violation` is its closest equivalent.

- `check_file` and `check_diff` take an optional boolean `hints`. Its default is the server's `--hints` flag or `DAEDALUS_HINTS=1`, which is off. With hints on, every blocking import violation gets a `hint` field holding the object above, with `basis: "spec"`. All other fields are the same as without hints (unit test).
- `explain_violation` with `hints: true` adds `fixHint: { family, blocking, template }`, where `template` is the decision order of §2 in words.

Example `check_file` violation with `hints: true` (clean-architecture spec, a domain file importing `../../infrastructure/system/SystemClock`):

```json
{
  "rule": "FF-S01", "ruleName": "dependency-direction", "severity": "critical", "line": 1,
  "subject": "import \"../../infrastructure/system/SystemClock\"",
  "reason": "domain (position 0) may not import infrastructure (position 2): ...",
  "fix": "Do not import infrastructure from domain (...). Declare an interface ...",
  "hint": {
    "ruleId": "FF-S01", "family": "dependency-direction",
    "problem": "LoanPolicy.ts in domain imports SystemClock.ts in infrastructure, which domain may not depend on.",
    "target": { "layer": "domain", "folder": "src/domain/services/", "path": "src/domain/services/Clock.ts" },
    "fix": { "action": "introduce-port", "text": "Introduce a port interface Clock in src/domain/services/Clock.ts (domain) for what LoanPolicy.ts uses from SystemClock.ts; ..." },
    "edit": [ "..." ], "basis": "spec"
  }
}
```

When PR #122 merges, its findings carry the same `ruleId`, file and target. `buildFixHint(spec, finding)` takes exactly those fields, so wiring the v2 tools (and `explain_finding`) is one call per finding.

## 4. Mechanical validation on the 71-case development set

### Method

`scripts/v1.3/fix-hints-eval.ts`, run against Neo4j 5.26.0 Community with APOC 5.26.0 core, unpacked from the release tarballs. There is no `--engine cypher-interp` in this repository, so the rules run on Neo4j itself. For each of the 71 variants of `tests/fixtures/v1.3-reference`:

1. Materialise the variant and run the symbolic-only v1.3 pipeline (`createPipeline`, the commands `firewall evaluate` runs).
2. Take the **true blocking findings**: the manifest findings this run matches (`scripts/v1.3/lib/compare.ts`, the reference validation's matcher) whose rule is blocking under the v1.3 tiers for the style. There are 57.
3. Build each finding's hint twice: with graph facts (the CLI hint) and from the spec alone (the MCP hint).
4. **Target check** (`checkTarget`, `scripts/v1.3/lib/fix-hints-sim.ts`). This is a second, independent reading of the spec, so the builder does not grade itself. It checks two things:
   - The hinted path lies in the hinted layer. For DDD it must be in the declared public API, a context root or an `outside_contexts` path.
   - Every dependency the edit adds or carries along is allowed: an `allowed_dependencies` edge, or the order, FF-S04 and closed-layering reading of the spec. No added package import is forbidden.
5. **Edge removal.** Open a Neo4j transaction on the ingested graph and apply the hint's graph edit (`editToCypher`). Then re-run the finding's own compiled rule (`CompiledFunctions.symbolicQueries`) through the real `evaluateSymbolic`, the same mapping and the same ids. The finding must be gone.
6. **Regressions.** In the same transaction, re-run every blocking rule. A blocking finding that was absent before the edit and present after it is a regression.
7. Roll back.

A hint is **valid** when 4 and 5 hold. "No regression" also requires 6.

There are two controls, so the 100% figures below cannot come from a vacuous check:

- **Control 1.** Before any edit, the re-run in the transaction reproduces each finding. An edit can only count as removing a finding that was there.
- **Control 2 (wrong-layer mutants).** Each CLI hint that creates or moves a file is re-checked with that file put next to the violating target instead: the port beside its implementation, the type left in the outer layer. The same checks must reject it.

### Results

**57 true blocking findings** over 71 variants: 13 in clean-architecture, 11 layered, 11 nestjs, 13 hexagonal and 9 DDD. Every one got a hint.

| | CLI (graph + spec) | MCP (spec only) |
|---|---|---|
| Hint produced | 57/57 | 57/57 |
| Target allowed by the spec | 57/57 | 57/57 |
| Simulated edit removes the finding (own rule re-run) | 57/57 | 57/57 |
| **Valid** (both) | **57/57 (100%)** | **57/57 (100%)** |
| Valid and no new blocking finding (all blocking rules re-run) | 57/57 | 57/57 |

- **Control 1:** the unedited graph reproduces 57/57 findings.
- **Control 2:** 19 CLI hints create or move a file, and all 19 wrong-layer mutants are rejected. The spec check alone rejects 15. The other 4 are v01 and v02, where the mutant "moves" the file into its own folder: the spec allows that, but the re-run still reports the finding.

Graph facts chose the fix in 37 of the 57 CLI hints (`basis: graph+spec`). In 34 of the 57 findings the spec-only hint proposes a different action or file than the CLI hint, typically "introduce a port" where the graph knew an existing port, caller, wrapper or declaration.

CLI fix actions: move-file 14, lift-to-caller 7, move-declaration 6, break-cycle 5, extract-adapter 5, use-existing-port 5, implement-port 3, replace-with-own-type 3, route-through 3, make-immutable 2, use-public-api 2, reference-root 1, remove-repository 1.

Validity per rule (`results/v1.3-fix-hints/report.md`; the per-finding list with the action, target and notes is there and in `hints.jsonl`):

| Style | Rule | Name | True blocking | CLI hinted | CLI target ok | CLI edge removed | CLI valid | CLI no regression | MCP valid | MCP no regression |
|---|---|---|---|---|---|---|---|---|---|---|
| clean-architecture | FF-S01 | dependency-direction | 5 | 5 | 5 | 5 | 5/5 (100%) | 5/5 (100%) | 5/5 (100%) | 5/5 (100%) |
| clean-architecture | FF-S04 | no-domain-outward-dep | 3 | 3 | 3 | 3 | 3/3 (100%) | 3/3 (100%) | 3/3 (100%) | 3/3 (100%) |
| clean-architecture | FF-S02 | no-cyclic-deps | 1 | 1 | 1 | 1 | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) |
| clean-architecture | FF-P01 | domain-purity | 2 | 2 | 2 | 2 | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) |
| clean-architecture | FF-P03 | repository-pattern | 1 | 1 | 1 | 1 | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) |
| clean-architecture | FF-P06 | domain-state-purity | 1 | 1 | 1 | 1 | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) |
| layered | FF-S01 | dependency-direction | 2 | 2 | 2 | 2 | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) |
| layered | FF-S03 | no-layer-skip | 5 | 5 | 5 | 5 | 5/5 (100%) | 5/5 (100%) | 5/5 (100%) | 5/5 (100%) |
| layered | FF-S02 | no-cyclic-deps | 2 | 2 | 2 | 2 | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) |
| layered | FF-P01 | domain-purity | 2 | 2 | 2 | 2 | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) |
| nestjs | FF-S01 | dependency-direction | 4 | 4 | 4 | 4 | 4/4 (100%) | 4/4 (100%) | 4/4 (100%) | 4/4 (100%) |
| nestjs | FF-S04 | no-domain-outward-dep | 2 | 2 | 2 | 2 | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) |
| nestjs | FF-S02 | no-cyclic-deps | 1 | 1 | 1 | 1 | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) |
| nestjs | FF-P01 | domain-purity | 2 | 2 | 2 | 2 | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) |
| nestjs | FF-P03 | repository-pattern | 1 | 1 | 1 | 1 | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) |
| nestjs | FF-P06 | domain-state-purity | 1 | 1 | 1 | 1 | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) |
| hexagonal | FF-S01 | dependency-direction-graph | 5 | 5 | 5 | 5 | 5/5 (100%) | 5/5 (100%) | 5/5 (100%) | 5/5 (100%) |
| hexagonal | FF-S04 | core-isolation | 3 | 3 | 3 | 3 | 3/3 (100%) | 3/3 (100%) | 3/3 (100%) | 3/3 (100%) |
| hexagonal | FF-P01 | domain-purity | 1 | 1 | 1 | 1 | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) |
| hexagonal | FF-P03 | port-adapter-pattern | 2 | 2 | 2 | 2 | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) |
| hexagonal | FF-P06 | domain-state-purity | 1 | 1 | 1 | 1 | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) |
| hexagonal | FF-S02 | no-cyclic-deps | 1 | 1 | 1 | 1 | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) |
| ddd | FF-DT03 | value-object-immutability | 2 | 2 | 2 | 2 | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) |
| ddd | FF-DS02 | context-isolation | 2 | 2 | 2 | 2 | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) |
| ddd | FF-DT01 | aggregate-boundary | 1 | 1 | 1 | 1 | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) |
| ddd | FF-DT02 | repository-aggregate-root | 1 | 1 | 1 | 1 | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) |
| ddd | FF-DT04 | domain-purity | 1 | 1 | 1 | 1 | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) |
| ddd | FF-DS01 | bounded-context-modules | 1 | 1 | 1 | 1 | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) |
| ddd | FF-S01 | dependency-direction-graph | 1 | 1 | 1 | 1 | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) |

### What the numbers do and do not show

- **This is the development set** (the 71-case reference set the instrument was tuned on), not a hold-out. Over-fitting is a real risk, so the templates were written per rule family with no per-variant case, and the decision order of §2 is fixed in code and tests. The hold-out reference set (`Docs/v1.3/holdout-prespec.md`) has not been run.
- **Edge removal is partly true by construction.** For the edge families the edit deletes the violating edge, so step 5 mainly confirms the edit is expressed on the graph the rule reads: the right edge view, the barrel edges of DDD, the member facts of FF-DT03, and FLOWS_TO vs CONSTRUCTOR_INJECTS for FF-P06. The informative checks are the spec target check (4), the regressions check (6) and control 2. The mutants show that a plausible but wrong placement fails them.
- **The graph edit is a model of the code change.** It is not the code change itself: the edited code was not written out and type-checked. A hint can be structurally valid and still need judgement about the code itself, for example which methods belong on the new port.
- **The MCP spec-only hints are less specific.** They cannot see existing ports, callers or declarations, so they fall back to introducing a port or a `<Stem>Service`. They are valid on this set, but less minimal than the CLI hints in the cases the table marks.
- **FF-P06** findings with FLOWS_TO rows are reported N/A by the v1.3 tiers. The hints cover them anyway because the reference counts them as true positives.

## 5. Default output unchanged

- `firewall evaluate` without `--hints` builds no hints and writes no new field.
- The MCP tools without `hints` (and without the server flag) return no `hint` field.

This was checked in two ways:

- **Byte comparison.** For all 71 variants, both formats (json and human) were compared between this branch without `--hints` and an untouched `origin/v1.3` worktree, against the same Neo4j. `runId`, `durationMs`, `executionTimeMs`, `totalMs` and the human "Duration" line were masked; they vary per run on either branch. **142/142 outputs identical; 0 differ.**
- **Unit tests.** The MCP hint test asserts that `checkSource` with `hints: false` deep-equals the plain call, and that the hinted violations minus `hint` equal the plain ones.

## 6. Reproduce

```bash
# Neo4j 5.26 + APOC (tarballs), bolt on 127.0.0.1:7699
npx tsx scripts/v1.3/fix-hints-eval.ts --out results/v1.3-fix-hints      # needs NEO4J_URI, NEO4J_PASSWORD
npx jest --maxWorkers=2 tests/unit/fix-hints tests/unit/mcp-server/fix-hints.test.ts tests/unit/scripts/v1.3/fix-hints-sim.test.ts
```
