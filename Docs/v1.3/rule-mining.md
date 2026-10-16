# Rule mining: the implicit rules of a codebase with no spec (exploratory)

Branch `v1.3-rule-mining`, cut from `origin/v1.3`. **Exploratory.** Nothing here is pre-registered and the AI-DLC
workflow was not run. ISE (`Docs/DiagnosticRuns/ise-*`, `src/ise/`) infers the *layer map* of a brownfield project.
Rule mining goes one step further: it infers the **implicit rules** the team follows, the dependency constraints that
hold almost everywhere, and flags the few places that break them as **candidate violations**.

Every mined rule is a **proposal**. The CLI (`daedalus mine-rules`, i.e. `firewall mine-rules`) and the MCP tool
(`propose_rules`) label their output that way.

## 1. Method (fixed before the evaluation ran)

This section was committed with the miner, before the evaluation script ran on any reference variant. The
thresholds below were not changed after the results were seen.

### 1.1 Input

`proposeRules(<project>)` (`src/rule-mining/propose.ts`) reads the project only through ISE's neutral snapshot
(`src/` and `tsconfig.json`):

1. ISE (`inferFromGraph`, preset-first): the style and a layer for every file. Its emitted spec is the base.
2. APG v2 extraction of the snapshot (`V13_APG2_OPTIONS`) with the inferred DDD contexts as `module` components and
   one `folder` component per top-level folder (as `scripts/v1.3/wild-run.ts` does): the components, their entry
   files (declared public API, else the root `index` file and the barrels it re-exports) and the literal import view.
3. The miner (`src/rule-mining/miner.ts`), then the emitter (`emit.ts`).

Deterministic and offline: no LLM, no Neo4j.

### 1.2 Rule kinds

For an ordered layer pair (A, B): `n_A` files of A, `e(A,B)` file import edges A → B, `f(A,B)` distinct files of A
that import B. `absence = 1 − f(A,B)/n_A`, `direction = e(B,A) / (e(A,B) + e(B,A))`.

| Kind | Proposed when | Statement | Exceptions | Confidence (smoothed) |
|---|---|---|---|---|
| `layer-direction` | `e(B,A) ≥ 1`, `direction ≥ 0.75`, `absence ≥ 0.75` | A must not depend on B | the A → B edges | `e(B,A)/(e(A,B)+e(B,A)+1) · (n_A − f)/(n_A + 1)` |
| `layer-rare-edge` | `e(B,A) = 0`, `f(A,B) = 1`, `n_A ≥ 3` | A should not depend on B | the A → B edges | `0.5 · (n_A − 1)/(n_A + 1)` (never above 0.5) |
| `layer-unobserved` | `e(A,B) = e(B,A) = 0` | A must not depend on B (closed world) | none by construction | `0.5 · n_A/(n_A+1) · n_B/(n_B+1)` |
| `acyclic-files` | ≤ 10% of files lie on an import cycle | no file lies on a cycle | the edges inside a cycle | `(files − on cycle)/(files + 1)` |
| `component-direction` | as `layer-direction`, over APG v2 `module` and `folder` components | component C must not depend on D | the C → D imports | as `layer-direction` |
| `public-api` | a component with entry files, ≥ 2 imports from outside (test files and composition roots excluded), ≥ 75% through an entry file | imports go through the entry files | the deep imports | `via entry/(incoming + 1)` |
| `port-implementation` | classes grouped by (layer, last PascalCase word); ≥ 2 classes, ≥ 75% implement an interface of another layer | every `*Suffix` in L implements a port | the classes that do not | `implementing/(classes + 1)` |
| `inject-abstractions` | cross-layer constructor injections of a layer (not the composition layer); ≥ 2, ≥ 75% to interfaces | L injects interfaces | the concrete injections | `to interfaces/(injections + 1)` |
| `core-package-free` | a layer the mined allowed graph lets import no other layer; a package another layer imports and ≤ 10% of its files import | the core imports none of these packages | the core files that import one | min over packages of `(core − importing)/(core + 1)` |

Levels: high ≥ 0.75, medium ≥ 0.5, low below.

The **allowed layer graph** is every observed pair `e(A,B) > 0` minus the pairs a layer rule forbids.

### 1.3 Spec emission: existing templates only

`emitMinedSpec` starts from the ISE spec and changes only what the rules decide. It never writes Cypher:

| Rule | Hexagonal / DDD | Clean, NestJS | Layered |
|---|---|---|---|
| layer-direction | `allowed_dependencies` → `dependency-direction-graph` | layer order → `dependency-direction` | layer order → `dependency-direction` |
| layer-rare-edge, layer-unobserved | `allowed_dependencies` → `layer-skip-graph` | **not representable** (a total order allows every inward import; `no-layer-skip` is layered-only) | layer order → `no-layer-skip` |
| acyclic-files | `no-cyclic-deps` (hexagonal); not representable for ddd | `no-cyclic-deps` | `no-cyclic-deps` |
| port-implementation | `port-adapter-pattern` (suffix ∈ Repository, Repo, Adapter, Gateway; the infrastructure-kind layer) | `repository-pattern` (Repository, Repo) | same |
| inject-abstractions | `port-dependency-inversion` (application-kind layer) | `dependency-inversion` | same |
| core-package-free | `domain-purity` with `forbidden_imports` (domain-kind layer) | same | same |
| component-direction | APG v2 `component-adp-cycle` | same | same |
| public-api | `context-isolation` (ddd, declared public API), else APG v2 `deep-import-*-api` | APG v2 | APG v2 |

For a linear style the layer order is a topological order of the mined allowed graph (ties keep the inferred order);
whatever the order cannot say is written as a note. Functions no rule backs are switched off (`enabled: false`), so
the style's built-in template does not add them back. Each kept function carries a comment with its rule ids,
confidence and exception count; the header lists every rule, its exceptions and, for a rule no template expresses,
why. The emitted spec is parsed, validated against the project (`--rules v1.3`) and compiled with
`V13_COMPILE_OPTIONS`.

### 1.4 Evaluation protocol

Targets: the five v1.3 reference projects (71 variants), the ISE development rename probe P1–P5, and the held-out
probes N1, N2 and S (`scripts/v1.3/lib/ise-targets.ts`; renamed directories, inserted levels, scrambled suffixes).

**(A) Clean variants: mined graph against the true spec.** On each target's `clean` variant (primary) and its
`near-miss` variants (secondary), mine the rules and compare the mined allowed layer graph M with the true spec's
allowed-dependency graph T:

- T for hexagonal and ddd is `allowed_dependencies`; for clean-architecture and nestjs every outer → inner pair of
  the layer order; for layered the adjacent pairs only. T is restricted to the layers that hold at least one file of
  the clean variant under the true spec.
- Edge precision `|M ∩ T|/|M|` and recall `|M ∩ T|/|T|`, pooled over targets (micro) and per target.
- Two layer maps: **end to end** (ISE's layers) and **oracle** (the true spec's layers, which isolates the miner).
- Three rule sets: **observed** (M = every observed pair: the frozen-allowlist baseline), **strict** (direction and
  unobserved rules forbid) and **full** (rare-edge rules also forbid; the default emission).
- Forbidding-rule precision per kind: the share of "A must not depend on B" rules with A → B ∉ T.
- False alarms: the exceptions mined on clean variants (every one is a false candidate violation).

**(B) Violating variants: do the planted violations surface as exceptions?** Each violating variant is mined on its
own (brownfield: no clean version is used). A planted expected finding surfaces **exactly** when a mined rule has an
exception with the finding's file and, when the finding has a target, the same target (for a class-level rule, the
class's file). It surfaces **at file level** when an exception names the finding's file. Also: the kind and level of
the rule that surfaced it, and the exceptions that match no planted finding (noise).

**(C) Robustness.** (A) and (B) on the rename probes, end to end.

**(D) Other projects.** E1 cells and the external (`results/v1.3-wild`) projects, if present: descriptive only (no
ground truth): style, rule counts by kind and level, exceptions, spec validity.

## 2. Commit order and provenance

| Commit | Content |
|---|---|
| `cdb2e8b8` | The miner, the emitter, their unit tests and §1 of this document. No evaluation had run. |
| `+1` | `analyseSnapshot` / `proposeFromAnalysis` split out of `proposeRules` (no behaviour change), the CLI command, the MCP tool, the evaluation scripts, the offline and external results and §2–§7. |
| `+2` | The live Neo4j downstream results and §4. |

`src/rule-mining/miner.ts`, `emit.ts` and `types.ts` were not changed after the first evaluation run; no threshold was
tuned. The evaluator was changed once after its first run, only to list every exception and to restrict the
"by planted rule" table to the five reference projects (it pooled all 25 targets).

Outputs are in `results/v1.3-rule-mining/2026-10-16/`:

| File | Content |
|---|---|
| `eval.md`, `eval.json` | (A)–(C), offline, 355 variants (25 targets), about 2 minutes. `scripts/v1.3/rule-mining-eval.ts --set all`. |
| `specs/<target>.mined.yaml` | The spec mined from each target's clean variant. |
| `downstream.md`, `downstream.json`, `downstream-raw/` | The live Neo4j check (§4). `scripts/v1.3/rule-mining-downstream.ts`; `--from-raw` replays it. |
| `wild.md`, `wild.json`, `wild/<id>.{json,mined.yaml}` | The external projects (§5). `scripts/v1.3/rule-mining-wild.ts --repos <clones>`. |

**Engine.** No `cypher-interp` engine exists in this repository, so the live check used Neo4j 5.26.24 community with
APOC 5.26.24, run from the official tarball (the container has no Docker daemon). The rule miner itself never needs
an engine.

## 3. Results on the reference set

### 3.1 (A) Clean variants: the mined allowed graph against the true spec

Precision / recall of the allowed layer edges, pooled over the five targets of each row (one clean variant each).

| Targets | Layer map | observed (frozen allowlist) | strict | full (default emission) |
|---|---|---|---|---|
| 5 reference projects | ISE | 100% / 86% (25/25, 25/29) | 100% / 86% | 100% / 79% (23/23, 23/29) |
| 5 reference projects | oracle | 100% / 86% | 100% / 86% | 100% / 79% |
| P1–P5 (development rename probe) | ISE | 100% / 86% | 100% / 86% | 100% / 79% |
| N1, N2 (held out) | ISE | 100% / 86% | 100% / 86% | 100% / 79% |
| S (held out, scrambled suffixes) | ISE | 96% / 86% (25/26) | 96% / 83% | 96% / 76% (22/23, 22/29) |
| S | oracle | 100% / 86% | 100% / 86% | 100% / 79% |

On the 14 near-miss variants of each target set the figures are the same within one edge (reference projects: 100% /
87% observed, 100% / 82% full).

Per project (clean variant, ISE layers, full):

| Project | True edges | Mined | Precision | Recall | True edges not mined |
|---|---|---|---|---|---|
| clean-architecture | 3 | 3 | 100% | 100% | — |
| layered | 2 | 2 | 100% | 100% | — |
| nestjs | 6 | 5 | 100% | 83% | application → infrastructure |
| hexagonal | 9 | 7 | 100% | 78% | adapters-inbound → domain, config → domain |
| ddd | 9 | 6 | 100% | 67% | api → domain, composition → domain, infrastructure → application |

Reading:

- **Every mined edge is a true edge** (precision 100%) on all targets except the scrambled S probe, where one nestjs
  edge (infrastructure → application) comes from ISE's layer map, not from the miner: with the oracle layers it
  disappears.
- **Recall is limited by what the code does, not by the miner.** The true spec allows edges the clean code never
  uses (nestjs application → infrastructure, hexagonal config → domain, ddd composition → domain): a closed-world
  miner cannot propose an allowance nobody exercises. The rare-edge rule removes two more true edges (hexagonal
  adapters-inbound → domain: one controller imports one domain error; ddd infrastructure → application: one ACL file
  imports one port). That is the full set's recall cost (86% → 79%).
- **The layer map does not matter here** (ISE = oracle on 4 of 5 target sets): ISE's layer accuracy on these
  targets is 100% except S-nestjs (`Docs/DiagnosticRuns/ise-robustness-2026-10-15.md`).

Forbidding rules on the clean variants, share the true spec also forbids (both layer maps agree except where noted):

| Kind | Reference projects | All 25 targets (ISE) |
|---|---|---|
| layer-direction | 25/25 | 124/125 (the S-nestjs miss above) |
| layer-rare-edge | 0/2 | 0/10 |
| layer-unobserved | 10/14 | 50/70 |

The direction rules are reliable. The two rare-edge rules on clean code are both wrong (each is the single legitimate
use of an allowed edge), and a third of the unobserved-pair rules forbid an edge the spec allows but the code does
not use. Both kinds are emitted at low confidence for that reason.

**False alarms.** On the 19 clean and near-miss variants of the reference projects, the miner reports 6 exceptions,
all from the two rare-edge rules above (hexagonal `BookingController → BookingError`, ddd
`OrderingAcl → OrderSource`); 13 of 19 variants have none. With renamed directories the count is 8 (one P3 near-miss
adds a rare edge and a port exception); with scrambled suffixes it is 14 (S-nestjs, from ISE's layer map).

### 3.2 (B) Violating variants: planted violations as exceptions

Each of the 52 violating variants is mined on its own, with no clean version.

| Targets | Planted findings | Exact (ISE) | Exact (oracle) | Variants with ≥ 1 exact | Other exceptions per variant |
|---|---|---|---|---|---|
| 5 reference projects | 68 | 44 (65%) | 44 | 28/52 | 0.6 |
| P1–P5 | 68 | 44 (65%) | 44 | 28/52 | 0.6 |
| N1, N2 (held out) | 68 | 44 (65%) | 44 | 28/52 | 0.6 |
| S (held out) | 68 | 41 (60%) | 44 | 25/52 | 0.9 |

"Exact" means a mined rule's exception has the finding's file and target. No planted finding matched at file level
only. By planted rule (reference projects; the rule shown is the highest-confidence one that surfaced it):

| Planted rule | Findings | Surfaced | By |
|---|---|---|---|
| FF-S01 dependency direction | 17 | 17 | layer-direction 9, component-direction 5, acyclic, rare-edge, injection 1 each |
| FF-S02 cycles | 5 | 5 | acyclic-files (high) |
| FF-S03 layer skip / sideways | 8 | 7 | rare-edge 4, layer-direction 2, injection 1 |
| FF-S04 core outward | 8 | 8 | layer-direction 5, component-direction 3 |
| FF-P06 domain state (via an import) | 3 | 3 | layer-direction / component-direction |
| FF-P02, FF-P04 concrete injection | 4 | 4 | inject-abstractions 3, component-direction 1 |
| FF-P01 framework in the core | 7 | 0 | — |
| FF-P03 repository / adapter without port | 4 | 0 | — |
| FF-P05 controller returns entity | 2 | 0 | — |
| DDD tactical and context rules (FF-DS01–02, FF-DT01–06) | 12 | 0 | — |

**Dependency-shaped plants surface almost always: 44/45** (FF-S01–S04, FF-P06 through an import, and the
injection rules); every exact match is one of them. The one miss is ddd v10 (`api` imports `infrastructure`): the `api` layer has 2 files, under the
rare-edge minimum of 3, and nothing goes back, so no rule covers the pair. Most surfacing rules are **medium**
confidence: the planted edge is itself counted in the evidence and lowers it.

**The other plants do not surface**, for reasons that are properties of the method, not bugs:

- *FF-P01 (typeorm, express, @nestjs in the core).* The core-package rule lists only packages *another layer
  already imports*. In these projects the planted package is used nowhere else, so its single import is the only
  evidence and nothing marks it as foreign. Absence of a package elsewhere is not evidence that it is forbidden.
- *FF-P03 (a repository or adapter without a port).* Each project has three repositories; with one of them broken,
  2/3 = 67% is under the 75% pattern threshold, so no rule is proposed at all. The hexagonal gateway is the only
  `*Gateway`, a group of one.
- *FF-P05 and the DDD tactical rules* (aggregates, value objects, events, module placement) are not dependency
  constraints and no miner kind looks at them. *FF-DS02* (cross-context deep import) would need the public-API rule,
  but the contexts receive one cross-context import in the clean code, under the minimum of two.

### 3.3 (C) Robustness to renaming

Renamed layer directories (P1–P5), an inserted root wrapper (N1) or an inner level (N2) change **nothing**: every
figure equals the reference projects', because the miner reads layers and edges, not names. Scrambled class and file
suffixes (S) cost 3 planted findings (nestjs v02, v03, v07), one wrong and one missing mined edge, and 8 false
exceptions, all on S-nestjs, where ISE itself loses 10 of 29 files
(the NestJS file patterns no longer match); with the oracle layer map the S figures equal the others.

### 3.4 Rules mined on the clean variants (25 targets)

| Kind | Rules | high / medium / low | Compile to an existing template |
|---|---|---|---|
| layer-direction | 125 | 69 / 40 / 16 | 125 |
| layer-unobserved | 70 | 0 / 0 / 70 | 60 (not under clean / nestjs: a total order cannot forbid a sideways pair) |
| layer-rare-edge | 10 | 0 / 0 / 10 | 10 |
| component-direction | 65 | 36 / 9 / 20 | 65 (APG v2 `component-adp-cycle`) |
| acyclic-files | 25 | 25 / 0 / 0 | 20 (not under ddd) |
| inject-abstractions | 21 | 20 / 1 / 0 | 10 (only the application-kind layer; not ddd) |
| port-implementation | 20 | 19 / 1 / 0 | 12 (only the infrastructure-kind layer and the bound role names; not ddd) |
| core-package-free | 5 | 5 / 0 / 0 | 5 |

All 355 emitted specs parse, validate against their project (`--rules v1.3`) and compile with
`V13_COMPILE_OPTIONS`; ISE classified the style correctly on all 355.

## 4. Live check: the mined spec on the real engine

`scripts/v1.3/rule-mining-downstream.ts` mines each of the 71 reference variants on its own (brownfield), then runs
`firewall evaluate --symbolic-only` (Neo4j 5.26.24 + APOC, v1.3 scoring) on the variant under the spec mined from it,
and under the true spec for comparison (142 evaluations per target set; the P1–P5 probes were run too). "Rule-exact"
is the reference comparison of `validate-reference` (`compareVariant`): the planted rule's expected finding is
reported.

| Target | Evaluation errors | Planted rule-exact, true spec | Planted rule-exact, mined spec | Expected findings, true / mined | Clean + near-miss with a blocking finding, true / mined |
|---|---|---|---|---|---|
| clean-architecture | 0 | 9/10 | 5/10 | 15 / 7 of 16 | 0 / 0 of 4 |
| layered | 0 | 9/9 | 7/9 | 11 / 9 of 11 | 0 / 0 of 4 |
| nestjs | 0 | 9/10 | 4/10 | 12 / 5 of 13 | 0 / 0 of 4 |
| hexagonal | 0 | 11/11 | 7/11 | 16 / 9 of 16 | 0 / 0 of 4 |
| ddd | 0 | 12/12 | 1/12 | 12 / 1 of 12 | 0 / 0 of 3 |
| **total** | **0** | **50/52** | **24/52** | 66 / 31 of 68 | 0 / 0 of 19 |

P1–P5 give exactly the same figures (`downstream.md`).

- **Every mined spec runs on the real engine** through the existing templates: 0 evaluation errors in 142 runs.
- **No false alarm at the verdict level:** none of the 19 clean or near-miss variants has a blocking finding under
  the spec mined from it. The two rare-edge false alarms of §3.1 do reach the engine (hexagonal and ddd clean each
  report one FF-S03 `layer-skip-graph` row), but FF-S03 is advisory outside the layered style.
- **On dependency plants (FF-S01–S04) the mined spec is nearly as good as the hand-written one: 21/23 against
  23/23.** The two misses: nestjs v02 (surfaced by the miner as a rare edge, but a total layer order cannot forbid
  it, §1.3) and ddd v10 (no rule, §3.2).
- **Everything else is the true spec's advantage**, as expected from §3.2: purity, ports, controllers and the DDD
  tactical rules are not mined, so their functions are switched off in the mined spec. FF-P06 plants are reported
  only as the import half (FF-S01) of the planted field.


## 5. Other projects

**E1 cells: not run.** The 65 accepted E1 cells live in `../daedalus-e1-outcomes`, which is not in this container,
and this session has no access to a repository of that name. `scripts/v1.3/rule-mining-wild.ts` takes any directory
of clones; an E1 run needs only a list of cell paths in place of the selection file.

**External projects: all 14 of `results/v1.3-wild/selection.json`**, cloned at their pinned commits (blobless, sparse
on the analysis root) and read through the same harness tsconfig as `wild-run.ts`. There is no ground truth, so this
is descriptive (`results/v1.3-rule-mining/2026-10-16/wild.md`):

| Project | Group | Files | ISE style | Rules (high / medium / low) | Exceptions | Spec valid | s |
|---|---|---|---|---|---|---|---|
| hoppscotch-backend | nestjs | 189 | nestjs | 140 (20 / 75 / 45) | 21 | yes | 5 |
| immich-server | nestjs | 458 | nestjs | 40 (24 / 8 / 8) | 78 | yes | 11 |
| podkrepi-api | nestjs | 576 | nestjs | 199 (8 / 107 / 84) | 172 | yes | 4 |
| hedgedoc-backend | nestjs | 203 | nestjs | 116 (11 / 43 / 62) | 45 | yes | 2 |
| awesome-nest-boilerplate | nestjs | 98 | nestjs | 37 (7 / 11 / 19) | 14 | yes | 1 |
| mikro-orm-realworld | nestjs | 39 | nestjs | 16 (3 / 3 / 10) | 2 | yes | 0 |
| clean-ts-api | clean | 180 | clean-architecture | 19 (13 / 4 / 2) | **0** | yes | 1 |
| standardnotes-auth | clean | 469 | clean-architecture | 13 (9 / 4 / 0) | 224 | yes | 4 |
| domain-driven-hexagon | hexagonal | 82 | *nestjs* | 11 (7 / 1 / 3) | 18 | yes | 1 |
| bitloops-ddd-backend | ddd | 164 | *nestjs* | 17 (6 / 5 / 6) | 14 | yes | 1 |
| medplum-server | express-layered | 491 | layered | 82 (15 / 35 / 32) | 174 | yes | 9 |
| ts-express-starter-prisma | express-layered | 34 | clean-architecture | 26 (4 / 13 / 9) | 1 | yes | 0 |
| reactive-resume-api | other | 115 | layered | 8 (4 / 3 / 1) | 2 | yes | 3 |
| etherpad | express-layered | 133 | layered | 5 (5 / 0 / 0) | 52 | yes | 3 |

What it shows:

- **It runs and emits a valid, compiling spec on every project**, in at most 11 s per project (up to 576 files; the graph is extracted twice).
- **A disciplined codebase mines clean.** `clean-ts-api` (the textbook Clean Architecture project) gives 19 rules,
  13 of them high, and **no exception**: the three layer-direction rules hold with 56, 18 and 111 supporting edges.
- **Exceptions concentrate on recognisable conventions, which need a human call.** In `standardnotes-auth`, 39 of
  338 domain files import `src/Bootstrap/Types.ts` (the Inversify DI token table), against 325 edges the other way:
  a high-confidence "domain must not depend on infrastructure" rule with 39 exceptions that are a deliberate team
  convention, not 39 bugs. In `immich-server`, 47 of 272 "infrastructure" files import application DTOs (starting with
  `src/database.ts`). In `etherpad`, two `db/` files import the message handler, against 55 edges the other way.
- **Volume grows with folder count.** Feature-module NestJS apps produce many `component-direction` rules (134 in
  hoppscotch, 189 in podkrepi), mostly medium or low; `--min-confidence` keeps them out of the spec.
- **Wrong style in, wrong layers out.** ISE classifies `domain-driven-hexagon` and `bitloops-ddd-backend` as NestJS
  (as in `Docs/DiagnosticRuns/v1.3-wild-2026-10-16.md`), so their rules are mined over NestJS layers.

## 6. Interfaces

**CLI** (`src/cli/cli.ts`; the program is `firewall`, installed as `daedalus-arch`):

```sh
npx tsx bin/firewall.ts mine-rules --project <dir> [--out proposed.yaml] [--format human|json]
                                  [--min-confidence 0.5] [--style <style>] [--max-exceptions 5]
```

The human output starts with the proposal label, then the style, the allowed layer graph, and every rule with its
level, confidence, the template it compiles to (or why none does) and its candidate violations. `--out` writes the
proposed spec; `firewall validate --spec proposed.yaml --project <dir>` accepts it. Exit code 0, or 2 on bad
arguments or an extraction failure.

**MCP** (`src/mcp-server/server.ts`): `propose_rules` with `project`, `minConfidence`, `includeSpec` (default true)
and `maxExceptions` (default 20). It returns `label` ("PROPOSED rules: … not a reviewed spec"), the style, the
allowed graph, every rule with `status: "proposal"`, counts and the spec with its validation result. It is
read-only, needs no Neo4j, and is **not** in `SPEC_TOOL_NAMES`, so the experiment arms' allow-list is unchanged.

## 7. Limitations

1. **Closed world.** An allowance the code never exercises cannot be mined: recall of the allowed graph is 79–86%
   on clean code for that reason alone. "Unobserved" rules are low confidence, and a third of them are wrong.
2. **Rare legitimate edges look like violations.** Both rare-edge rules on the clean references are false alarms.
   They are the price of catching sideways imports with no direction evidence (4 of the 8 FF-S03 plants).
3. **Small projects starve the pattern rules.** With three repositories, one broken one drops the pattern below
   75% and the rule disappears instead of flagging it (FF-P03 0/4). A layer with two files gets no rare-edge rule
   (ddd v10). The thresholds were fixed in advance and not tuned; lowering them would trade these misses for more
   false alarms, which this study did not measure.
4. **A framework seen only once is invisible.** The core-package rule needs another layer to use the package
   (FF-P01 0/7). On real projects it also lists Node built-ins (`assert`, `crypto`, `path`) used outside the core;
   it has no notion of which packages are frameworks.
5. **Brownfield exceptions lower their own rule's confidence.** A planted edge is part of the evidence, so the rules
   that surface violations are mostly medium confidence. Filtering at "high" would hide most of them.
6. **Not every mined rule has a template.** A total layer order (clean, nestjs) cannot forbid a sideways pair;
   `port-adapter-pattern` binds fixed role names; the injection and port templates bind one layer kind; the ddd
   style compiles only its own library. These rules are reported with the reason and left out of the spec.
7. **APG v2 rules are declared, not executed, by `firewall evaluate`.** `component-adp-cycle` and the
   `deep-import-*` functions validate, but the CLI pipeline does not extract APG v2 and the style compilers do not
   select them; they run through the in-memory mirrors (`apg2-in-memory.ts`) as in `wild-run.ts`.
8. **Inherits ISE's layer map.** On the references this costs nothing (end to end = oracle), but a wrong style or
   lost file patterns (S-nestjs, the two misclassified external projects) put the rules on the wrong layers.
9. **Reference projects are small** (27–31 files) and were written to have clean dependency structure; the external
   projects show the method on real code but give no accuracy figure. No E1 run.

## 8. Test status

`jest --maxWorkers=2 tests/unit`: 4764 passed, 6 failed in 5 suites (`mutation/expected`, `llm-critic/replay-no-binary`,
`generators/skeleton`, `u5b/guards`, `u5b/score-golden-acceptance`). The same 6 fail on a clean `origin/v1.3`
checkout in this container (shallow clone, root user, a pre-existing script outside the static-call rule), so none is
caused by this branch. The new suites (`tests/unit/rule-mining/`, `propose_rules` in `mcp-server/server.test.ts`) pass.
