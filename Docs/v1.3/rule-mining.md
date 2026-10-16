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
