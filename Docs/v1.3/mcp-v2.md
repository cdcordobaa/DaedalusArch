# MCP v2: v1.3-aware agent tools

Written 2026-10-15 on branch `v1.3-mcp2` (base `origin/v1.3`). Code: `src/mcp-server/`. Results: `results/v1.3-reference/mcp-v2/`. Live smoke: `Docs/v1.3/mcp-smoke.md`.

This unit upgrades the DaedalusArch MCP server, which coding agents call while they write code, from the v1.2E rule view to the v1.3 one. It changes no frozen artefact: no template text, no tier, no spec, no preset, no pre-registration (`Docs/prereg-drafts/` untouched), and nothing under `aidlc-docs/`.

## 1. Summary

- **Every finding carries** its v1.3 tier (blocking or advisory, by the spec's style), its rule id, the construct it encodes, a literature source line (`Docs/v1.3/style-rule-sources.md`), `file:line`, the reason and a concrete fix. The answer an agent acts on is the new `blockingVerdict` (`block` / `pass` / `unknown`).
- **check_file and check_diff** now decide every v1.3 rule that a changed file and the spec (plus, when the server has a project root, the files around it) can decide: the allowed-dependency layering of hexagonal and DDD, the DDD rules, repository and port placement, infrastructure injected into the domain, domain purity through a barrel, and import cycles. They follow ADR-V13-01 (literal edge to the barrel or resolved `viaReExport` edge, per `Docs/v1.3/edge-views.md`) and the v1.3 style applicability.
- **Hints** from three APG v2 templates and two cheap proxies are reported apart, always ADVISORY.
- **Two new tools**: `infer_spec` (zero-config onboarding with the ISE prototype; returns a proposal to confirm) and `explain_finding`.
- **Consistency with the full evaluation** on the 71 reference variants of the five styles: with a project root, check_diff's blocking answer and its set of blocking rules agree with the saved full evaluation on **71/71** variants, and every finding is in the right file. Without a project root (spec-only), 64/71 agree, and the 7 disagreements are two documented limits: cycles (5) and DDD value-object mutability in a modified file (2). This is a development set (§4.4).
- **Latency**: check_file p50 6 ms / p95 16 ms, check_diff p50 14 ms / p95 40 ms in process; over stdio from an MCP client, p95 13 ms and 36 ms. The target was under 1 s.
- The loop harness's `daedalus-mcp` arm exposes the v2 tool list; the `none` arm is byte-identical.

## 2. The tools

Ten tools. The eight v1 tools keep their names and argument shapes; every v1 field keeps its meaning, and v2 fields are added. Two tools are new.

| Tool | v1 | v2 additions |
|---|---|---|
| `get_architecture_spec` | layers, rules with status | per rule: `v13Status` (the v1.3 compiler's applicability), `tier`, `construct`, `source`, `edgeView`, `checkedByFastPath` |
| `which_layer` | layer of a path | unchanged |
| `check_import` | one import against the four import rules | each violation: `tier`, `construct`, `source`, `edgeView`; result: `blockingVerdict` |
| `evaluate_project` | full symbolic evaluation (Neo4j) | unchanged |
| `explain_violation` | intent and fix of a rule | unchanged |
| `check_file` | imports and class names of one file | `findings` (every v1.3 spec-rule finding), `blockingVerdict`, `blockingCount`, `advisoryCount`, `blockingSummary`, `hints`, `notChecked`, `projectAware`; every violation gets the per-finding fields of §3 |
| `check_diff` | check_file over a unified diff | as check_file per file, plus `basis` per file and the blocking fields overall; with a project root a modified file is rebuilt and reported as a delta (§5.2) |
| `suggest_placement` | where new code belongs | unchanged |
| **`infer_spec`** | | §7 |
| **`explain_finding`** | | §8 |

**Backward compatibility.** `verdict`, `summary` and `violations` of check_file and check_diff keep their v1 meaning: the four import rules and the naming rules, under the v1.2E applicability. The two existing tests that pin this (`check_file` agrees with `check_import` on the fixtures; every placement `suggest_placement` proposes passes `check_file`) pass unchanged. The v1.3 answer is in the added fields: `findings` is a superset of `violations`, and `blockingVerdict` is computed from `findings`. A v1 client keeps working; a v2 client reads `blockingVerdict` and `findings`. `parseUnifiedDiff` returns the same records as before; `parseUnifiedDiffWithHunks` is new. Only two existing tests were edited, both for the added tools: the exact tool list in `tests/unit/mcp-server/server.test.ts`, and the exact arm argv in `tests/unit/scripts/loop/agents.test.ts`.

## 3. The fields of a finding

Every element of `violations`, `findings`, `advisories` and `hints`:

| Field | Meaning |
|---|---|
| `rule` / `ruleId` | spec id (`FF-S01`, `FF-DS02`), or `APG2.<template>` / `CHEAP.<proxy>` for a hint |
| `ruleName` | template name (`dependency-direction-graph`) |
| `tier` | `blocking` or `advisory`, from `ruleTier(ruleId, style)` (`src/scoring-engine/rule-tiers.ts`, the sealed `Docs/v1.3/rule-tiers.md`). FF-S03 is blocking only in `layered`. Hints are always advisory. |
| `tierSource` | `table`, `untiered-default` (an id the sealed table does not list: advisory) or `hint` |
| `candidateTier` | APG v2 hints only: the tier `APG2_TEMPLATE_TIERS` proposes, not in force until an ADR adds the template to the sealed table |
| `construct` | the architectural construct (`Core isolation of state: the domain holds no infrastructure object`) |
| `source` | the literature line. For a rule with a row in `style-rule-sources.md` under the spec's style, that row (source and constraint, verbatim). For a style without its own row, the row of the style its preset composes (nestjs: Clean; ddd's composed layering: Hexagonal), marked as such. Otherwise the source named in the tier table or the APG v2 / cheap-proxy design. `STYLE_RULE_SOURCES` holds the table as data, and a unit test parses the document and fails when the two differ. |
| `edgeView` | the view the full evaluation reads: `literal`, `resolved` or `none` |
| `check` | `spec`, `apg2` or `cheap` |
| `file`, `line`, `location` | project-relative file, 1-based line (the new-file line in a diff), `file:line` |
| `subject`, `reason`, `fix` | what was flagged, why, and the concrete change that clears it |
| `target`, `viaBarrels` | the imported file or package; the barrels an import went through (resolved view) |

`notChecked` lists every v1.3-active rule the fast path does not decide, with its tier and why (a metric over the whole graph, a ratio over every injection, an LLM judge dimension, cycles without a project root). For those, run `evaluate_project`.

## 4. Consistency with the full evaluation

### 4.1 Method

`scripts/v1.3/mcp-consistency.ts` (logic in `scripts/v1.3/lib/mcp-consistency.ts`):

1. For every variant of the five reference projects (`tests/fixtures/v1.3-reference`: 14 clean-architecture, 13 layered, 14 nestjs, 15 hexagonal, 15 DDD; the clean, violation and near-miss variants), the clean and the variant project are materialised with the reference harness (`materialiseVariant`), and the variant's diff against the clean project is taken with `git diff --no-index`.
2. The diff goes to the **check_diff tool handler** (`checkDiffTool`, with the spec loader a server uses), in three configurations:
   - `after-write`: project root = the variant. The agent has written the change and checks `git diff`.
   - `before-write`: project root = the clean project. The agent checks a proposed diff before writing it.
   - `spec-only`: no project root.
3. The **full-evaluation reference** for the variant is read from the saved live run `results/v1.3-reference/after-member-facts/` (v1.3 extractor and compile options, Neo4j): the variant's findings whose rule is blocking under the v1.3 tiers for the style, minus the rows a partial rule reports N/A (FF-P06's FLOWS_TO rows, rule-tiers.md finding 9; the relation type is read from the evidence file's discriminator), minus the same blocking findings of the clean variant. The raw and evidence files of each variant were checked to hold the same (rule, file, target) rows; they do (0 problems).
4. Compared per variant: the blocking answer (block or pass); the set of blocking rule ids; and the locations (every reference finding has a tool finding of the same rule in the same file; for a cycle, in one of the cycle's files).
5. Every disagreement must be explained by a documented limit (`DOCUMENTED_LIMITS`), or it counts as unexplained and `--check` fails. The unit test `tests/unit/scripts/v1.3/mcp-consistency.test.ts` runs the whole check over the 66 non-clean variants in all three modes.

### 4.2 Agreement per style

| Style | Variants | after-write: answer / rules / locations | before-write | spec-only: answer / rules | Clean and near-misses silent |
|---|---|---|---|---|---|
| clean-architecture | 14 | 14 / 14 / 14 | 14 / 14 / 14 | 13 / 13 | 4/4 |
| layered | 13 | 13 / 13 / 13 | 13 / 13 / 13 | 11 / 11 | 4/4 |
| nestjs | 14 | 14 / 14 / 14 | 14 / 14 / 14 | 13 / 13 | 4/4 |
| hexagonal | 15 | 15 / 15 / 15 | 15 / 15 / 15 | 14 / 14 | 4/4 |
| ddd | 15 | 15 / 15 / 15 | 15 / 15 / 15 | 13 / 15 | 3/3 |
| **all** | **71** | **71 / 71 / 71** | **71 / 71 / 71** | **64 / 64** | **19/19** |

(The spec-only DDD row reads 13/15: the two disagreements are both FF-DT03.) Unexplained disagreements: 0 in every mode.

### 4.3 Agreement per rule

Variants where the rule blocks, with a project root (after-write and before-write are identical). The tool never blocked on a rule the full evaluation did not.

| Style | Rules (variants where both block) |
|---|---|
| clean-architecture | FF-S01 5, FF-S04 3, FF-P01 2, FF-P03 1, FF-S02 1 |
| layered | FF-S03 5, FF-S01 2, FF-S02 2, FF-P01 2 |
| nestjs | FF-S01 4, FF-S04 2, FF-P01 2, FF-P03 1, FF-S02 1 |
| hexagonal | FF-S01 5, FF-S04 3, FF-P03 2, FF-P01 1, FF-S02 1 |
| ddd | FF-DS02 2, FF-DT03 2, FF-DS01 1, FF-DT01 1, FF-DT02 1, FF-DT04 1, FF-S01 1 |

Spec-only, the full-only rows are FF-S02 (clean 1, layered 2, nestjs 1, hexagonal 1) and FF-DT03 (ddd 2). The full table, per variant and mode, is `results/v1.3-reference/mcp-v2/consistency.md`.

### 4.4 What the agreement does and does not show

- **It is a development set.** The fast-path rules were written for this unit with the reference variants at hand: an early probe of the v1 tools on the variants showed which rules the fast path missed (the hexagonal and DDD rules, FF-P03, cycles), and the checks were written and rerun against the same variants. Nothing was tuned to a variant (no variant or file name appears in the code), but an agreement measured on the set used during development is not an independent estimate. Hold-out projects would be.
- **It measures agreement, not correctness.** The reference is the full evaluation's answer. Where the full evaluation is wrong, agreeing with it is wrong too. The full evaluation's known mismatches on this set are all advisory (FF-P05 missed in clean v07 and nestjs v09; FF-P02 and FF-P04 unexpected in nestjs), so they are outside the blocking comparison.
- **Some blocking rules have no planted case here.** FF-P06's constructor-injection half (the half v1.3 counts) has no reference row: the three FF-P06 plants are all field-held (FLOWS_TO, N/A in v1.3). The fast check is covered by unit tests only, as is a cycle closed through a barrel.
- **The clean variants agree trivially** (an empty diff); they are counted in the totals and the silent column.
- **Locations** are checked at file level. Lines are not compared, because the full evaluation reports some rules without a line (FF-P03, FF-DS01).

### 4.5 Disagreements and their explanation

| Limit | Mode | Rule | Variants | Reason |
|---|---|---|---|---|
| L1 cycles need the graph | spec-only | FF-S02 | clean v03, layered v05 and v06, nestjs v04, hexagonal v11 | A cycle is a property of the whole import graph. Without a project root the fast path sees only the changed files; FF-S02 is then listed in `notChecked`. |
| L2 added lines only | spec-only | FF-DT03 | ddd g01, v03 | Without a project root a modified file is checked on its added lines only. A value object made mutable by an added setter or field is a fact about the class declaration, and the added lines alone do not parse as one. |

No defect was left open. Defects found and fixed during the unit: the v1 tools did not check the hexagonal and DDD layering or the DDD rules (their templates are not in the frozen catalogue v1 read), nor FF-P03 and FF-P06; and the first version of the reference counted FF-P06's field rows as blocking (they are N/A in v1.3).

## 5. The fast checks

### 5.1 What is decided, per rule

Which rules run is the v1.3 compiler's decision: `compileFunctions(spec, V13_COMPILE_OPTIONS)` (style applicability, ADR-V13-02 draft); a rule it disables is not checked. FF-P06 is therefore not checked in `layered`.

| Template (id in the presets) | Styles | View | What the fast path reads |
|---|---|---|---|
| dependency-direction (FF-S01), no-layer-skip (FF-S03), no-domain-outward-dep (FF-S04) | clean, layered, nestjs | literal | each import specifier resolved lexically, both ends placed in layers by the spec globs (unchanged from v1) |
| dependency-direction-graph (FF-S01), layer-skip-graph (FF-S03), core-isolation (FF-S04) | hexagonal; ddd's composed layering | literal | the same, against `architecture.allowed_dependencies` (`bindHexagonalLayers`) |
| domain-purity (FF-P01, FF-DT04) | all | resolved | package imports of a domain file against `forbidden_imports`; with a project root, names imported through a barrel are followed to their declaring package |
| no-cyclic-deps (FF-S02) | clean, layered, nestjs, hexagonal | literal | with a project root: the project's literal import graph with the proposed content, searched for a path back from each imported file, bounded at the template's length (`MAX_CYCLE_LENGTH`) |
| domain-state-purity (FF-P06), constructor half | clean, nestjs, hexagonal | none | constructor parameter types of domain classes, through their import (and barrels) to the declaring file; a class or interface of the infrastructure layer is reported |
| repository-pattern (FF-P03) | clean, nestjs | none | infrastructure classes whose name ends with `Repository`/`Repo` (`Impl`) and that implement nothing |
| port-adapter-pattern (FF-P03) | hexagonal | none | outbound-adapter classes ending with `Repository`/`Repo`/`Adapter`/`Gateway` (`Impl`); each implemented name is followed to its declaring file, which must be an interface in a port layer |
| bounded-context-modules (FF-DS01) | ddd | none | the path against the declared context roots and `outside_contexts` |
| context-isolation (FF-DS02) | ddd | literal | each cross-context import against the target context's public-API globs, unless the file is in a declared ACL (the literal-view text without the M1 clause, as `DDD_LITERAL_VIEW_TEMPLATES`) |
| aggregate-boundary (FF-DT01), repository-aggregate-root (FF-DT02) | ddd | resolved | each import's declaring file against the aggregates' inner entities (and, for FF-DT02, files matching the repository globs) |
| value-object-immutability (FF-DT03) | ddd | none | class member facts of files matching `value_objects`, extracted by the extractor's own `extractClassMemberFacts` |
| domain-event-placement (FF-DT05), application-service-thin (FF-DT06) | ddd | none | advisory: direct extends/implements of a domain-event type outside the domain; method count over the threshold |
| naming-services, naming-repos, naming-controllers (FF-CV02..04) | all | none | unchanged from v1 (substring selection is the convention's construct, as v1.3 keeps it) |

**ADR-V13-01.** A literal-view rule judges the module the import names: an import of a barrel ends at the barrel, wherever the name is declared (so a presentation file importing the business layer's barrel is judged on the barrel's layer). A resolved-view rule judges the file that declares the name, reached through `export { } from` and `export * from` chains (`ProjectView.resolveNames`), and reports the barrels in `viaBarrels`. Without a project root the barrel cannot be read, so the resolved view falls back to the literal one (said in `notes`).

**Role names (v1.3).** FF-P03 selects classes by the last camel-case token(s), as `v13-role-names.ts` does: `CsvReportWriter` is not a repository and `GatewayRetryPolicy` is not a gateway.

### 5.2 check_diff: three bases

- **whole-file**: an added file is checked whole.
- **delta**: a modified file, with a project root. The project holds either the old content (the agent has not written yet) or the new one (it has). The diff is applied forward to the old content, or in reverse to the new content, strictly (every context line must match). The file is checked twice, old and new, in a project view that holds the old or the new contents of every file in the diff, and the result is what the new content has that the old does not (matched on rule, subject and target, not on line, so a moved line is not a new finding).
- **added-lines**: a modified file without a project root, or when the hunks fit neither side. Only the added lines are checked, as in v1.

## 6. Hints: APG v2 and cheap proxies (advisory)

| Hint | Construct | Fast form | candidateTier |
|---|---|---|---|
| `APG2.boundary-type-leak` | information hiding at a layer boundary (Parnas 1972; Martin 2017 ch. 22) | annotated parameter and return types of exported public methods and functions in controller and application layers, followed to an infrastructure file; composition roots and test code exempt (scope ADR changes 1 and 3) | blocking |
| `APG2.io-outside-adapters` | I/O at the edges (Cockburn 2005) | calls on values imported from the `IO_PACKAGES` db, http and fs packages, and global `fetch`, in domain and application files | blocking |
| `APG2.nondeterminism-in-core` | deterministic core | `Date.now()`, `new Date()`, `performance.now()`, `Math.random()`, crypto random functions, `process.*` reads in domain and application files | advisory |
| `APG2.deep-import-declared-api` | information hiding (Parnas 1972) | an import into another component's file outside its declared public API (DDD contexts); composition roots, tests and, for modules, declared ACLs exempt | blocking |
| `APG2.deep-import-inferred-api` | information hiding, by convention | with a project root: an import into another layer past its root `index.ts` (and the barrels it re-exports, scope change 6) | advisory |
| `CHEAP.repository-bypass` | persistence through the repository (Evans 2003 ch. 6) | outside infrastructure and repository-named classes: ORM accessors imported from a db package, or calls on a field typed with a raw DB client type | |
| `CHEAP.framework-in-core` | frameworks are details (Martin 2017 ch. 32) | annotated parameter and return types of application and domain functions naming a transport type (express, fastify, koa, Nest HTTP, node http), or in the domain a db type | |

All hints are advisory. The APG v2 templates are not in the sealed tier table, and the scoring engine gives them the untiered default, so the tool does too. The cheap proxies propose candidate sites, not verdicts (`Docs/v1.3/cheap-semantics-design.md`). On the reference set the hints fired on 8 violation variants and on no clean or near-miss variant (`consistency.md`, per-variant table).

The full forms of these checks read the type checker (`SIGNATURE_USES`, `originOfValue`). The fast forms read annotations and import bindings only. An inferred return type, a value reached through an untyped parameter, or a package re-exported by a project wrapper is invisible to them.

## 7. infer_spec

`infer_spec { project?, style?, mode? }` runs the ISE prototype (`src/ise`) on a snapshot of the project's `src/` and `tsconfig.json` (`snapshotSource`). Nothing else of the project is read, and nothing is written to it. It returns:

- `status: "proposed"`;
- the style, `styleSource` (`classified` or `forced`), the classifier's `confidence`, `lowConfidence` (under 0.5, or the runner-up within 0.1), and every style ranked with its points and **evidence**;
- the layer mapping (`layers`) and, per source unit, the layer, how it was decided and its confidence;
- for DDD, the inferred `architecture.ddd` block;
- `specYaml`, the proposal: the canonical preset parameterised with the inferred globs;
- `validation`, the repository's spec validator on the proposal against the project;
- `ruleCandidates`, the style-free majority-vote rules the project follows;
- `review`, what to check before confirming.

The agent or a human must confirm the proposal before it is saved and used as the spec. The tool does not save it. On the five reference projects it classifies each style correctly (confidence 0.75 to 1.00), and every proposal passes the validator. The reference projects are part of the ISE measurement set (`scripts/v1.3/ise-measure.ts`), so this is not an accuracy estimate. Presets come from `DAEDALUS_PRESETS`, else `presets/` next to the package the server runs from.

## 8. explain_finding

`explain_finding { rule, location? | file?, line?, spec? }` accepts a finding's `ruleId` (spec id, `APG2.*`, `CHEAP.*`), a template name or a violation type. It returns the construct, the literature (with the row it came from), the tier, what the rule detects (the template's description), intent and fix, a minimal violating and compliant **example**, and **how the firewall checks it**: the full evaluation's template, tag and edge view (with the reason from `TEMPLATE_EDGE_VIEWS`), and what check_file and check_diff read, or that they leave the rule to `evaluate_project`. With a location it adds the file's layer and, with a project root, the source line.

## 9. Latency

`scripts/v1.3/mcp-latency.ts --runs 5 --infer-runs 3 --stdio`, on the five reference projects (every changed file of every variant; every variant diff in two modes; every import; every blocking finding explained). Machine: 4 vCPU Xeon 2.1 GHz, Node 22. Warm calls (the first call of each tool per project is reported apart as cold). Full table: `results/v1.3-reference/mcp-v2/latency.md`.

| Tool | Calls | p50 ms | p95 ms | Cold max ms |
|---|---|---|---|---|
| check_file | 455 | 6.0 | 15.7 | 15.6 |
| check_diff (before-write) | 325 | 14.2 | 39.6 | 56.0 |
| check_diff (after-write) | 325 | 19.2 | 45.2 | 27.8 |
| check_import | 1875 | 0.1 | 0.4 | 0.8 |
| get_architecture_spec | 20 | 5.4 | 8.0 | 25.9 |
| explain_finding | 285 | 0.1 | 0.3 | 1.1 |
| suggest_placement | 70 | 0.8 | 1.6 | 3.3 |
| infer_spec | 10 | 152.9 | 334.6 | 450.2 |
| stdio: check_file | 455 | 6.5 | 13.2 | 23.0 |
| stdio: check_diff | 325 | 13.3 | 35.8 | 130.1 |
| stdio: server start-up to listTools | 5 | 776.8 | 787.7 | |

check_file and check_diff are about two orders of magnitude under the 1 s target, cold calls included. The cost grows with the project when a project root is given: the cycle check and the delta read every source file of the project once per call (cached per call, not across calls). The reference projects have 27 to 31 source files. A project of thousands of files was not measured. `evaluate_project` was not measured (no Neo4j here).

## 10. Limits of the fast path

1. **Whole-graph rules are not decided.** Metrics (FF-C01..C06), ratios over every injection (FF-P02, port-dependency-inversion), proxies over the class graph (FF-SO01..03), use-case isolation and controller-no-entity (FF-P04, FF-P05: CONSTRUCTOR_INJECTS paths across files), whole-project conventions (FF-CV01, CV05, CV06) and the judge (FF-N01, N02). They are listed in `notChecked`. Of these, only FF-S02 is blocking, and it is decided when the server has a project root.
2. **Without a project root** (L1, L2 in §4.5): no cycles; a modified file is checked on its added lines only, so a class-level fact needs the class in the added lines; barrels are not followed (the resolved view equals the literal one); an implemented name cannot be checked to be an interface in a port layer (a class that implements anything passes FF-P03); inferred entry files are unknown.
3. **Lexical module resolution.** Relative specifiers and bare project paths are resolved; tsconfig `paths` aliases are not (they come back in `unresolved`, as in v1). `.js` specifiers are read as their `.ts` sources.
4. **Annotations only.** Constructor parameter types, signature types and field types are read from annotations, not inferred, so an untyped parameter carries no type.
5. **FF-P06 field half.** Field-held infrastructure (FLOWS_TO) is N/A in v1.3 and is not checked (rule-tiers.md, finding 9). The `nondeterminism-in-core` and `io-outside-adapters` hints see a `new SystemClock()` only if the clock is an I/O package or a global.
6. **One hop for class hierarchies.** domain-event-placement sees a class that extends or implements a domain-event type directly; the full rule follows chains.
7. **Only the changed files are judged.** A change that makes an *unchanged* file violate a rule (for example, removing an export a barrel relied on) is not reported.
8. **A modified file's delta** is matched on rule, subject and target: a violation that existed before and is moved is not re-reported, and two identical findings in one file count by multiplicity.

## 11. Harness

`DAEDALUS_ARM_TOOLS` (`scripts/lib/generators/arms.ts`) is the server's `SPEC_TOOL_NAMES`: the seven v1 spec-only tools, then `infer_spec` and `explain_finding`, allowed by exact name. `evaluate_project` is still denied. The Codex arm's `enabled_tools` follow. The exact-argv tests (`tests/unit/scripts/loop/agents.test.ts`, `tests/unit/scripts/generators/arms.test.ts`) pin the new list, and the `none` arm stays byte-identical to the E1 argv (unchanged tests). `infer_spec` reads only a snapshot of the cwd's `src/` and writes nothing to it.

## 12. Reproduce

```bash
npx tsx scripts/v1.3/mcp-consistency.ts --check     # consistency.{json,md}
npm run build && npx tsx scripts/v1.3/mcp-latency.ts --runs 5 --infer-runs 3 --stdio --check   # latency.{json,md}
npx tsx scripts/v1.3/mcp-smoke.ts --dry-run          # Docs/v1.3/mcp-smoke.md; live run on the local machine
npx jest tests/unit/mcp-server tests/unit/scripts/v1.3/mcp-consistency.test.ts tests/unit/scripts/v1.3/mcp-smoke.test.ts
```

Code map: `source-ast.ts` (syntax facts, ts-morph in memory), `project-files.ts` (project view, barrels, import graph), `fast-context.ts` (literal and resolved edges of one file), `fast-rules.ts` (spec rules), `fast-hints.ts` (APG v2 and cheap hints), `rule-meta.ts` (tier, construct, source, edge view, v1.3 status), `infer-spec.ts`, `explain-finding.ts`; `file-check.ts` and `diff-check.ts` combine them.
