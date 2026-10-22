# DETECT-02 design: APG facts and detectors for the violations coding agents commit (v1.5-exp)

**Date:** 2026-10-21. **Status:** exploratory (dev), written and committed **before** any DETECT-02 code. **Branch:**
`explore/detect-02`. **Instrument:** unchanged. Nothing under `src/`, `presets/`, `scripts/lib/`, `scripts/v1.3/`, the
tag `v1.4-freeze-2026-10-20` or any registered Study 2b artefact changes; `src/` is imported read-only. All code lives
in `experiments/detect-02/`. This is a versioned exploratory instrument change, **v1.5-exp**, and is never applied to
Study 2b.

## 0. Why

DETECT-01 found 6 of the 9 HEXDDD-01 hand-read cases on the pilot trees, then flagged **0 of 12** PUZZLE-01 baseline
trap failures. Its D4 rule X1 encoded the pilot's shape (two repository write methods taking different aggregate
types). The agents wrote `this.accounts.saveAll([from, to])`: one write method, one type, two instances. **Lesson:
detect the concept, not a shape.** Each family below is stated as a concept first, and the facts are chosen so that
every surface form of that concept we know of maps to the same fact.

## 1. Concepts per family

| Rule | Family | Concept (what must be true of the code, independent of shape) | Source |
|---|---|---|---|
| R-D4 | D4 | One command (one unit of work started by one request) persists **two or more aggregate-root instances**, whatever their types, in one synchronous flow | Vernon, Effective Aggregate Design part 1 and 2: modify one aggregate instance per transaction |
| R-XCTX | D4 across contexts | A command of context A persists an aggregate root **owned by context B**, directly or through B's published interface, in the same synchronous flow, instead of B reacting to an event | Vernon P2/P4; Evans, Bounded Context |
| R-D5 | D5 | A business decision about an aggregate's state or about a value the aggregate receives (a throwing guard with a comparison) is taken **outside the aggregate**; tagged *duplicated* when the aggregate also holds it | Vernon: model true invariants in consistency boundaries |
| R-D9 | D9 | A published contract (public API, contracts, an exported type of a context) **is or structurally wraps** an entity or aggregate type; or a domain method returns a contract-shaped anonymous object | Evans: published language; Fowler: each context has its own model |
| R-H5 | H5 / D8 | A port signature carries an infrastructure concept: a type declared in a vendor module or an adapter, or a **scope mechanism** (a callback that receives a port, i.e. a lock or transaction handed to the caller) | Cockburn: ports express application needs |
| R-INJ | H4 | An application unit depends (constructor or property type) on a **concrete adapter class** instead of a port | Cockburn; DIP |
| R-RTX | — (H5/D4 adjacent) | Remote or vendor IO is reached **inside a transaction or lock scope** | Nygard, Release It! (integration points); Vernon (aggregate size and contention) |

## 2. New facts (symbolic, zero calls)

Built by `experiments/detect-02/lib/` from a ts-morph pass with the TypeChecker over the same tsconfig as
`extractAPG` (which runs first, read-only, so the frozen nodes and edges are in the graph too). All facts are written
into the interpreter's `MemoryGraph` and the rules read them through Cypher (`cypher-interp`), as DETECT-01 did.

- **Unit index and call resolution (`UCALL`).** Units: class methods, constructors, function declarations, and
  arrow/function expressions bound to object-literal properties or variables. A call resolves by symbol: class method,
  function, `new X()` → constructor; an **interface method** resolves to every implementation: classes that implement
  the interface (by type, `getImplements`) and **object literals whose contextual type is the interface** (the
  `createMembership()` published-module form that no CALLS or DISPATCH edge reaches). Nested callbacks belong to the
  enclosing unit (so writes inside `uow.run(() => …)` count). Call arguments are kept so a callee's parameter can be
  bound back to the caller's argument (instance identity across calls).
- **COMMAND.** A public method of a class in an application-role file (spec layer kind `application`, or the
  `application_services` globs), excluding the composition root, plus published-module object-literal functions.
  `eventHandler: true` when a parameter's type is a declared domain-event type (spec `domain_event_types`) or a
  subtype of one: that is the eventual-consistency path, not a command.
- **Aggregate roots.** From the spec's `architecture.ddd.aggregates` (`root` file + `name`). Fallback when no DDD block
  exists (fixtures, pilot S1): an identity-bearing class or interface (an `id` member) in a domain-role file that is a
  parameter type of a port or adapter method. The fallback is reported per tree.
- **Sinks (WRITE).** A call whose resolved target is a method of a repository/store/port/adapter (a declaration in a
  spec `repositories` glob, an interface implemented by an infrastructure/adapter class, or a class in such a file)
  **with a parameter whose type contains a root** (`T`, `T[]`, `readonly T[]`, `Array<T>`, `Promise<T>`, unions). The
  test is by type, never by method name. Calls into an external module (`node_modules` or `declare module`) with a
  root-typed argument are sinks too (ORM/SDK writes).
- **WRITE_FOOTPRINT (Command → Root, per instance).** Interprocedural, depth ≤ 4, following `UCALL`, dispatching
  through interfaces. Each write contributes *instances*: an array literal contributes one per element
  (`saveAll([from, to])` → 2); a spread, a root-collection parameter, a `.map`/loop over a root collection, or
  `Promise.all` over one → `many`; an identifier contributes one instance keyed by its binding (caller argument text
  after parameter binding, so `persist(x)` and `save(x)` of the same `x` are one instance). **Stops** at messaging
  (outbox, relay, bus, publisher, dispatcher: classes so named, or methods whose parameters are domain events) so a
  relay delivering events after the command does not pull the handlers' writes in. Edge properties: `instances`,
  `via` (call path), `line` of the write, `inTx`.
- **OWNS (Context → Root).** From the spec `contexts` and each aggregate's `context`; fallback: the `src/<ctx>/`
  folder of the root's declaration.
- **CONTEXT_WRITE (Command → Root).** A footprint root whose owning context differs from the command's context;
  `viaPublished` when the path enters B through B's `public_api` or ACL, `eventPath` when the command is an event
  handler (then exempt).
- **RULE_SITE (Unit → Guard).** A throwing `if` (the shape `cheap/guards.ts` defines, trivial null checks excluded by
  its `isTrivialParamNullCheck`) whose condition has a relational comparison or a `Number.isX` test, located outside
  the aggregate module, where a compared operand is (a) a property/accessor read on a root-typed expression or (b) a
  value the same unit passes to a root method or a domain constructor. Comparisons against `.length`, loop bounds and
  index checks are excluded. `duplicated: true` when the normalised condition (`normaliseCondition`) also appears in
  a guard inside the aggregate's module.
- **CONTRACT_EXPOSES (ContractType → EntityType).** A type declared in a published place (spec `public_api`,
  `contracts/`, a context `index.ts`, an inbound-port file) whose properties, method signatures, array elements or
  generic arguments reach (depth ≤ 3) a root, an inner entity or an identity-bearing domain class. Plus the DETECT-01
  structural mirror (domain method returning an anonymous object whose property names equal a contract type's, ≥ 3).
- **PORT_MECHANISM (PortMethod → Mechanism).** A port method parameter or return type declared in an external module
  or in an adapter file, or a function-typed parameter whose own parameters include a port or repository type
  (`withRoomLock(id, task: (repo) => …)`). Type-checker based; no name list.
- **CONCRETE_INJECTION (AppClass → AdapterClass).** A constructor parameter or property of an application class
  typed by a class declared in an infrastructure/adapter file.
- **REMOTE_IN_TX (Command → IO site).** Inside a scope callback (the function argument of a PORT_MECHANISM method,
  or of an external `transaction`-taking call resolved as a callback-accepting external method), a reachable call
  (depth ≤ 3) to an external-module method or to a port whose implementations call external modules or `fetch`
  (the remote IO). DB writes through the scoped port are not remote IO.

## 3. Rules (Cypher on cypher-interp, `experiments/detect-02/rules/*.cypher`)

R-D4 (footprint instance count ≥ 2, or one `many`), R-XCTX (CONTEXT_WRITE without eventPath), R-D5 (RULE_SITE),
R-D9 (CONTRACT_EXPOSES or mirror), R-H5 (PORT_MECHANISM), R-INJ (CONCRETE_INJECTION), R-RTX (REMOTE_IN_TX). One row
per command (entry method), not per repository pair. A command that only delegates to another command in the same
class (`executeFor` → `execute`) reports once, at the delegate.

**Allowances.** The frozen specs declare no per-rule allowance (only `allowed_dependencies` for imports). DETECT-02
adds an experimental key read only by its evaluator, in an overlay file `detect02.allow.yaml` next to the spec (never
inside a frozen preset): `allow: [{rule: R-D4, command: "src/x/application/ImportAccounts.ts#execute", reason: "declared
batch command"}]`. A matching finding is reported as `allowed`, not as a violation.

**Applicability.** R-D4, R-XCTX, R-D5 need aggregate roots (declared or fallback); R-D9 needs a published place; R-H5
needs ports; R-INJ and R-RTX apply to every style. On a Layered tree with no aggregates, the aggregate rules are
silent by construction; they are also run with the fallback roots and those hits are reported separately as
information, not as violations.

## 4. Semantic confirmation (neuro-symbolic)

For each symbolic candidate, one grounded question to `claude -p --model claude-sonnet-5-5 --tools ""` with a fixed
system prompt (the DETECT-01 answer contract: `confirm | reject | abstain`, every `confirm` cites file:line with a
verbatim quote, checked by the grounding check of DETECT-01; comments blanked on fixtures). The prompt shows the
footprint's files only (the command, the path, the sink, the root) and states the symbolic claim. The model may also
answer `aggregateRoots` when the tree has no spec. **Hard cap: 60 calls**, ledger `experiments/detect-02/calls.jsonl`;
cassettes keyed by the prompt sha256 (`experiments/detect-02/cassettes/`), so a carried-forward finding with the same
files costs no new call and replays are zero-call. Reported: symbolic-only vs symbolic+semantic (a candidate counts
under symbolic+semantic only when confirmed and grounded; abstain counts as kept, reported separately).

The MCP tool and the push gate never call a model (symbolic only).

## 5. Dev set (everything here is development material; tuned on it)

- PUZZLE-01 baseline: the 15 agent sessions' trees (steps 1–3), the 12 oracle FAILs as positives (11 trap, 1
  pre-registered legit-clean, c07, which is a **negative**), the passing trees as negatives; each puzzle's
  `solutions/clean` and `solutions/trap` (and `trap-alt`).
- HEXDDD-01: S1 and S2 step trees rebuilt from the seeds (`build-seeds.mjs`) and the step diffs; the 9 hand-read cases.
- DETECT-01 fixtures: 9 pairs, 2 variants, 3 negative controls.

## 6. Precision guards (must stay quiet)

- The 520 Study 2b Layered trees, extracted read-only to scratch from the archive (snapshot repositories only; no
  prompt or task file is opened). Every rule that applies is run; every hit is listed.
- The 15 external human repositories of the v1.3 validity set, if they can be cloned at their pinned SHAs.
- Puzzle clean solutions, HEXDDD-01 seeds (step 0), DETECT-01 twins and negative controls.

A hit on a guard is read and classified (construct-true but undeclared, or false positive). A false positive misleads
the agent in the tool arm, so the guards are reported first.

## 7. Held-out protocol

Held-out cases are authored independently by someone else and **never seen** by this session (the held-out folder is
not read). `experiments/detect-02/EVALUATE-HELDOUT.md` gives one command that an independent evaluator runs once over
a directory of cases with a `KEY.json`, producing per-family TP/FP/FN, twin discrimination and negative-control false
positives, symbolic-only and symbolic+semantic (semantic under a separate cap of 40 calls, own ledger). Rules, facts
and prompts are frozen at the commit that adds that file; the evaluator records the commit hash.

## 8. What counts as failure

- Dev recall: R-D4/R-XCTX miss any of the 11 PUZZLE-01 trap failures, or any of the 3 HEXDDD-01 D4 cases → the
  concept is not captured.
- Any hit on a puzzle clean solution or on c07 → precision failure.
- More than 0 R-D4/R-XCTX/R-H5/R-INJ/R-RTX hits on the 520 Layered trees that are false on reading, or more than 5%
  of trees with any false hit → not usable in a tool arm.
- Semantic layer rejects true positives more often than it removes false ones → not worth its calls.
- Exceeding 60 calls is impossible by construction (the cap is a constant checked against the ledger).
