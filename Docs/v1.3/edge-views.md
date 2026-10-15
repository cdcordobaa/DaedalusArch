# v1.3 edge views per template (ADR-V13-01)

Written 2026-10-14, before any reference validation was rerun with the change (ADR-V13-01: "each template's choice is recorded with its reason, *before* the reference validation is rerun"). Nothing in this table was chosen from a measured result.

## The two views

With `reExportEdges: 'both'` (the v1.3 default, `V13_DEFAULT_OPTIONS`) an import of a name through a re-export file (a barrel) gives two IMPORTS edges:

- the **literal** edge, from the importing file to the file the specifier resolves to (the barrel). When every name on it is re-exported rather than declared there, it carries `reExportHop: true`;
- the **resolved** edge, from the importing file to the file that declares the name, with `viaReExport: true` and the barrel path(s) in `reExportBarrels`.

An edge is marked only when no other occurrence reaches the same target: a file that imports `Order` both from the barrel and from `Order.ts` directly has an unmarked edge to `Order.ts`, which both views keep.

| View | IMPORTS edges read | RE_EXPORTS edges | Equals |
|---|---|---|---|
| literal | not `viaReExport` | all | the module graph tsc and dependency-cruiser report |
| resolved | not `reExportHop` | all | the `'resolved-only'` (v1.2E) graph |
| none | the template reads no IMPORTS edge | | |

`V12E_DEFAULT_OPTIONS` has `reExportEdges: 'resolved-only'`: the v1.2E graph is unchanged, byte for byte, and neither property appears in it.

## How a template reads its view

The frozen template text (`CYPHER_TEMPLATES`, `cypher-templates.ts`) is not edited. With `CompileOptions.edgeViews` (`V13_COMPILE_OPTIONS`; the pipeline's `CompileCommand` and `validate --rules v1.3` pass it), `applyEdgeView` (`src/fitness-compiler/edge-views.ts`) rewrites the compiled query of each template, selected by its name in `TEMPLATE_EDGE_VIEWS`:

- a fixed-length relationship pattern over `IMPORTS` gets an inline `WHERE NOT coalesce(r.viaReExport, false)` (literal) or `WHERE NOT coalesce(r.reExportHop, false)` (resolved); an unnamed one is named `_evN`;
- a variable-length one (`no-cyclic-deps`, `controller-no-entity`) is bound to a list, and the clause's `WHERE` gets `ALL(_evr IN list WHERE …) AND` in front.

On a graph without the two properties every added predicate is true, so a v1.2E graph gives the same rows. `compileFunctions` without the option compiles the frozen text unchanged.

## Table

| Catalogue | Template | View | Reason |
|---|---|---|---|
| CYPHER_TEMPLATES | dependency-direction | literal | layer-direction rule: the module an import statement depends on is what crosses the layer boundary |
| CYPHER_TEMPLATES | no-cyclic-deps | literal | cycle rule: a cycle is between modules as imported; barrel-induced cycles are findings (ADR-V13-01) |
| CYPHER_TEMPLATES | no-layer-skip | literal | layer-skip rule: importing a non-adjacent layer's barrel is the skip, wherever the name is declared |
| CYPHER_TEMPLATES | no-domain-outward-dep | literal | layer-direction rule (as dependency-direction) |
| CYPHER_TEMPLATES | domain-purity | resolved | domain purity by symbol: the forbidden package a name comes from counts even when a barrel re-exports it |
| CYPHER_TEMPLATES | controller-no-entity | resolved | usage rule: a controller uses the entity it names, through a barrel or not |
| CYPHER_TEMPLATES | domain-stability | literal | coupling metric over module dependencies: counts the import statements' real targets, as tsc and dependency-cruiser do |
| CYPHER_TEMPLATES | module-fan-out | literal | coupling metric (as domain-stability) |
| CYPHER_TEMPLATES | component-instability | literal | coupling metric (as domain-stability) |
| CYPHER_TEMPLATES | max-fan-in | literal | coupling metric (as domain-stability) |
| CYPHER_TEMPLATES | no-orphan-files | literal | connectivity of modules as imported: in the resolved view a barrel imported only by name looks unused |
| CYPHER_TEMPLATES | domain-state-purity | none | reads FLOWS_TO and CONSTRUCTOR_INJECTS only |
| CYPHER_TEMPLATES | dependency-inversion | none | reads CONSTRUCTOR_INJECTS only |
| CYPHER_TEMPLATES | repository-pattern | none | reads IMPLEMENTS only |
| CYPHER_TEMPLATES | use-case-isolation | none | reads CONSTRUCTOR_INJECTS only |
| CYPHER_TEMPLATES | abstraction-ratio | none | reads no edge |
| CYPHER_TEMPLATES | single-responsibility-proxy | none | reads CONTAINS and CONSTRUCTOR_INJECTS only |
| CYPHER_TEMPLATES | interface-segregation-proxy | none | reads CONTAINS only |
| CYPHER_TEMPLATES | inheritance-depth | none | reads EXTENDS only |
| CYPHER_TEMPLATES | naming-conventions, naming-services, naming-repos, naming-controllers | none | read no edge |
| CYPHER_TEMPLATES | test-file-pairing | none | reads no import edge (file names only) |
| CYPHER_TEMPLATES | no-index-logic | none | reads DECLARES only |
| HEXAGONAL_TEMPLATES | dependency-direction-graph | literal | layer-direction rule (as dependency-direction) |
| HEXAGONAL_TEMPLATES | layer-skip-graph | literal | layer rule (no allowed edge either way): the imported module's layer is the sideways step |
| HEXAGONAL_TEMPLATES | core-isolation | literal | layer-direction rule (as dependency-direction) |
| HEXAGONAL_TEMPLATES | port-adapter-pattern | none | reads IMPLEMENTS only |
| HEXAGONAL_TEMPLATES | port-dependency-inversion | none | reads CONSTRUCTOR_INJECTS only |
| V13_CYPHER_TEMPLATES | module-domain-imports-infrastructure | none | reads MODULE_IMPORTS only (not IMPORTS) |
| DDD_TEMPLATES (PR #83) | context-isolation | literal | context-isolation / public-API rule: whether the import goes through the published barrel is the question |
| DDD_TEMPLATES | aggregate-boundary | resolved | usage rule: reaching an aggregate's inner entity is about the symbol used, through a barrel or not |
| DDD_TEMPLATES | repository-aggregate-root | resolved | usage rule: which entity a repository stores is the symbol it imports, wherever re-exported |
| DDD_TEMPLATES | bounded-context-modules | none | reads no import edge (file placement only) |
| DDD_TEMPLATES | value-object-immutability | none | reads CONTAINS only |
| DDD_TEMPLATES | domain-event-placement | none | reads IMPLEMENTS and EXTENDS only |
| DDD_TEMPLATES | application-service-thin | none | reads CONTAINS only |

Counts over the 38 names: 13 literal (9 frozen, 3 hexagonal, 1 DDD), 4 resolved (2 frozen, 2 DDD), 21 none (14 frozen, 2 hexagonal, 1 module-wiring, 4 DDD).

## Notes on particular choices

- **Metrics read the literal view.** The ADR names the rule families; the five coupling metrics are not among them. They are put on the literal view because Martin's fan-in, fan-out and instability are defined over module dependencies, and the literal view is the one the second extractors measure. A consequence to expect: a widely imported barrel gains fan-in, and its importers lose fan-out to the files behind it.
- **domain-purity reads the resolved view.** The ADR's "domain purity by symbol" is this template: a domain file that imports a framework name through a domain barrel still depends on the framework. Under the literal view the edge would end at the barrel File, not at the Package node, and the rule would miss it.
- **controller-no-entity's IMPORTS hop.** The template walks `IMPORTS|CONSTRUCTOR_INJECTS*1..2` between Class nodes. IMPORTS edges join File nodes, so in practice only the CONSTRUCTOR_INJECTS part matches; the view is set for the day an IMPORTS step can match.
- **DDD templates.** The DDD library (PR #83) was not on `v1.3` when this table was written; its views were recorded with the rest, from the rule definitions. After `v1.3` merged #83, `ddd-compiler.ts` was wired to `applyEdgeView` in the same way as `hexagonal-compiler.ts`, and no view was changed. `context-isolation` counts a file re-exported by a public-API barrel as published (the M1 fix). Under the literal view the edge to the barrel is in the graph, so the template could test the barrel hop directly and close M2. That needs a change to the template, which is outside this unit.
- **ADR-derived rules** (`adr:` symbolic rules written by a spec author) are not in the table and are not rewritten.
- **The SCC cycle path** (`scc-cycles.ts`, off: `CYCLE_STRATEGY = 'cypher'`) builds its graph from every IMPORTS and RE_EXPORTS edge. If it is switched on for v1.3 it must drop `viaReExport` edges to match `no-cyclic-deps`.

## Addendum 2026-10-15: the IMPORTS readers outside the templates (fix round)

Written on branch `v1.3-fixes` before the reference validation was rerun with these choices. The barrels unit left four readers that read every IMPORTS edge, so under the v1.3 defaults they saw both views at once (`aidlc-docs/construction/v1.3-barrels/barrels-notes.md` §5). Each now reads one view. In every case the filter is "drop the IMPORTS edges marked `viaReExport`" (`src/shared/apg-edge-view.ts` for the in-memory readers, `NOT coalesce(r.viaReExport, false)` in Cypher). On a v1.2E graph no edge carries the mark, so each reader's output is unchanged there.

| Reader | File | View | Reason |
|---|---|---|---|
| Universal metrics (scoring engine): cycle count, max fan-out, max fan-in, average instability, orphan count | `src/scoring-engine/universal-metrics.ts` (`UNIVERSAL_METRIC_QUERIES_LITERAL`; the SCC path filters the same edges) | literal | Structural metrics and cycles over module dependencies, as for the five coupling templates and `no-cyclic-deps` above: Martin's fan-in, fan-out and instability count the modules an import statement depends on, and the literal view is the graph the second extractors (tsc, dependency-cruiser) measure. Reading both views counted a barrel import twice. Used in the v1.3 scoring mode (`scoringMode: 'v1.3'`); the v1.2E mode keeps the frozen query text. `abstractionRatio` reads no edge and is unchanged. |
| Drift detector: cross-layer dependency groups, per-layer fan-out, top fan-out contributors | `src/neo4j-ingestion/drift-detector.ts` | literal | Drift compares coupling between two snapshots, so it measures the same thing as the coupling metrics. With both views, a barrel import added between two commits would count as two new dependencies. |
| Judge source context: the graph excerpt and the cross-module incoming/outgoing lists | `src/llm-critic/judge-graph.ts` (`JUDGE_GRAPH_QUERIES.edges`) | literal | The judge reads the unit's source next to the excerpt. The literal edges are the dependencies its import statements state, so the excerpt agrees with the code the judge sees. Where a name comes from stays visible: the barrel's RE_EXPORTS edge to the declaring file is kept, one hop further. The resolved edge would add a dependency that no line of the source states. |
| Report graph (the HTML dashboard's file graph) | `src/report/graph-data-builder.ts` | literal | A picture of the module graph, which a reader checks against the import statements. Drawing both views would draw two arrows for one import. |

Consequences:

- The judge's prompt text changes on a v1.3 graph with barrel imports. It does not change on a v1.2E graph, or on any golden fixture: none of them has an import that hops a barrel (barrels notes §1). The v1.3 judge is reported and non-blocking.
- No finding changes. These readers feed metrics, drift, the judge's context and the report picture, not the templates.

### Template text: context-isolation in the literal view (DDD, M2)

The table above already gave `context-isolation` the literal view. Under that view the M1 workaround in its frozen text is no longer needed: a file one of B's public-API barrels re-exports counts as published. With the edge views on, `ddd-compiler.ts` therefore compiles the template text without that clause (`DDD_LITERAL_VIEW_TEMPLATES`). An import through B's barrel ends at the barrel, which is public. A deep import that bypasses the barrel ends at the internal file, and is reported (probe g03, M2). The compile without the option keeps the frozen text and its M1 clause, because a v1.2E graph has no literal barrel edge.
