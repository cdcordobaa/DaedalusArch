# V15-CALLS-THROUGH-PORTS: CALLS_VIA_PORT in the extractor (instrument v1.5.6)

**Status:** v1, 2026-11-01. Engineering note for `ops/notes/v15-plan.md` row 21 and `ops/01-instrument-map.md` §5
step 1b. Zero model calls. No rule reads the relation yet, and no rule changed. It belongs to v1.5.6; the draft PR
is not merged before the HX main run has started (`src/v15-instrument/graph.ts` is one of the 45 files of the HCAL-07
rules-frozen root, so the root changes when it merges).

## 1. The gap

The frozen graph had no edge from a call made through a port to the adapter behind it. CALLS
(`src/apg-extractor/edge-extractor.ts`) keeps a call only when the checker resolves it to a class method declaration.
A use case calls `this.orders.save(…)` on an `OrderRepository` interface, which resolves to a method signature, so the
call left no edge. Rules could not follow a use case through its out-port to the concrete adapter.

DETECT-02 works around this in two places. Neither reaches the graph:
- `src/v15-instrument/facts.ts` (from `experiments/detect-02/lib/facts.ts`): the `impls` map (interface or abstract
  member to the implementing units, classes and object literals) feeds `targetsOf`, so the write-footprint walk behind
  R-D4, R-XCTX and R-D5 goes through ports. The result is a fact on Command nodes, not a call edge.
- `experiments/detect-02/mcp/comprehend/` (`callers`, `memberCalls`): receiver-aware call sites for the comprehension
  tools (`Docs/DiagnosticRuns/graph-scale-2026-10-23.md`).

## 2. The relation

`CALLS_VIA_PORT` (Method → Method), written by `src/apg-extractor/port-calls.ts` behind the extractor option
`portCalls`.
- **Off** in `V12E_DEFAULT_OPTIONS`, `V13_DEFAULT_OPTIONS` and `V13_APG2_OPTIONS`, so every frozen graph is
  byte-identical (`v12e-byte-identity.test.ts` passes).
- **On** in `V15_APG_OPTIONS` (= `V13_APG2_OPTIONS` + `portCalls`), which the v1.5 graph build now passes
  (`src/v15-instrument/graph.ts`).
- The edges are added after every other non-import edge, so with the option on, every other edge is unchanged and in
  the same order.

**Source.** A class method (the CALLS scope) holding a call `x.m(…)`, where:
- `m` resolves to a port member: an interface method signature or an abstract method;
- the static type of the receiver `x` is an extracted interface or abstract class. A union receiver gives each member
  type; a type parameter gives its constraint.

**Targets.** For each such port type `P`, every class that implements `P`, found with the type checker:
- directly (`implements P`);
- through a sub-interface (`implements Q`, where `Q extends P`);
- as a subclass of an implementer;
- for an abstract class `P`, as a subclass of `P`.

The target on each class is the method that runs there: the class's own declaration of `m` with a body, else the
nearest base class's. The receiver type narrows the set: a call on a `Q` receiver reaches only `Q`'s
implementations, even when `m` is declared on `P`. This is the receiver rule GRAPH-SCALE used for Novu.

**Properties.** `callCount` (call sites), `lines`, `ports` (`Name@file`), `member`. There is one edge per pair
(caller method, implementation method).

**Resolution.** Everything is resolved by the checker, so aliased imports (`import { P as Q }`), aliased heritage
(`implements Q`) and barrel re-exports reach the declaration. The frozen IMPLEMENTS edge still looks up the alias
text and misses aliased heritage; CALLS_VIA_PORT does not depend on it.

**Never a guess.** When the port, an implementation or the target method is not an extracted node, no edge is
written. The same holds when the receiver's type does not resolve to an extracted interface or abstract class (`any`,
a structural object type). A call on a concrete class writes CALLS as before and no CALLS_VIA_PORT.

## 3. Evidence

| Check | Result |
|---|---|
| Unit tests `tests/unit/apg-extractor/v156-port-calls.test.ts` (one adapter; two adapters; aliased imports and a barrel; no implementation; concrete receiver; abstract class port; inherited body and subclass override; sub-port receiver narrowing; object-literal implementation; option defaults) | 11/11 |
| FR-1 fidelity `tests/unit/apg-extractor/v156-port-calls-fidelity.test.ts`: the HEXDDD-01 S2 seed against a hand-checked list (6 port calls, each to its one adapter), and 3 committed trees against the language-service truth (`port-call-truth.ts`: find-all-references on port members, go-to-implementation) | 4/4 |
| Language-service truth on all 91 DETECT-02 dev trees (scratch run) | 732 of 732 edges, 0 missing, 0 extra |
| tsc parity and frozen extractor (`tests/unit/apg-extractor/`, `tests/unit/scripts/v1.3/graph-fidelity.test.ts`, including the v1.2E byte-identity pin and the correct-reference snapshot) | 26 suites, 473/473 |
| Dev regression, `experiments/detect-02/evaluate.ts --dev` on the 91 trees (HEXDDD-01 step trees rebuilt from seeds and diffs) | identical to the committed `results/dev.json` apart from timings: D4 33/0/0, D5 11/0/5, D9 3/0/0, H5 4/0/0, H4 0/0/0, RTX 0/0/0 |
| The same 91 trees through `src/v15-instrument` `runTree` with all 22 RULES-V15 rules, before (origin/main `07d0224e6`) and after | 157 findings, identical tree by tree; only `stats.apgEdges` and `stats.relationships` differ, by the 732 new edges |
| `tests/unit/v15-instrument/` | 13 suites, 128/128 |

## 4. Precision limits

- **Classes only.** An implementation by object literal (`const repo: P = { … }`) or a factory function is not a
  class, so it gives no edge. The DETECT-02 `impls` map covers object literals by contextual type, and this relation
  does not.
- **Static receiver types.** Dispatch is over-approximated to every implementation of the receiver's type in the
  tree. The edge says which adapters *can* run, not which one the composition root wires. Narrowing to the injected
  adapter needs the wiring facts (DA1, row 22).
- **Call scope.** Calls in class methods only, as for CALLS. Calls in constructors, accessors, top-level functions
  and factory callbacks are not sources. The GRAPH-SCALE factory units (fix a) are not in the extractor.
- **Members.** Method signatures and abstract methods only. A function-typed property signature (`save: (o) => …`)
  and element-access calls (`x['save']()`) are not port members here.
- **Extracted set.** Ports or adapters in excluded files (`node_modules`, `*.d.ts`, tests) give no edge.
- **Not human-adjudicated at scale.** The truth is the language service plus one hand-checked tree (as L29 says for
  the other edge rows). On the 91 dev trees, receiver narrowing never changed an edge.

## 5. Which rules could use it next

No rule reads CALLS_VIA_PORT in v1.5.6. The candidates:
- **R-D4, R-XCTX, R-D5** (write footprint): the walk could follow CALLS + CALLS_VIA_PORT in the graph, in place of
  the `impls` map in `facts.ts`. This would retire the DETECT-02 workaround for class implementations. Object-literal
  implementations would need the map, or a later extension of the relation.
- **R-RTX** (remote call inside a transaction): a call through a port inside a lock or transaction scope could be
  followed to an adapter that performs I/O (`PERFORMS_IO` from APG v2).
- **R-H5** (mechanism in a port) and **R-INJ** (concrete injection): they could check that a use case reaches an
  adapter only through a port edge and never through CALLS to a concrete adapter class.
- **The comprehension `callers` tool** (`experiments/detect-02/mcp/comprehend/`) could read the edge, not recompute
  receiver-aware calls.

Any such change is a rule change. It needs its own precision fixtures and the dev regression, and it gets a new
instrument version.
