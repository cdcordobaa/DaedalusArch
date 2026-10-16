# v1.3 spike: an in-process Cypher interpreter (`--engine cypher-interp`)

Branch `v1.3-cypher-interp`, 2026-10-15. Status: spike, development-set evidence only. Neo4j stays the reference engine
for every reported number; nothing in this document replaces a Neo4j run in a study.

**Decision this spike serves.** The Cypher template text stays the one canonical definition of every rule. The
interpreter executes that text; no rule is re-implemented in TypeScript, and no template text was changed to make it
easier to interpret (`git diff origin/v1.3 -- src/fitness-compiler` is empty).

## 0. Results in one screen

| check | result |
|---|---|
| `ue-baseline-live --engine cypher-interp`, 71 reference variants, **no Neo4j variable set** | `raw/` (71 files), `report.json`, `report.md` **byte-identical** to `results/v1.3-reference/after-member-facts`; evidence violations identical 71/71 (only `elapsedMs` differs). `results/v1.3-cypher-interp/ue-baseline-live/run-provenance.json` |
| The same run on Neo4j 5.26.24 (control) | byte-identical to the reference too (so the reference is reproducible here) |
| Differential parity against live Neo4j 5.26.24 + APOC (`memory-parity.ts`) | **65,254 statements, 79 projects: 0 content, 0 error, 0 unsupported**; 763 `order`, all from two documented traps (T1, T2). Table in §4 |
| APG v2 hand mirrors vs interpreter on the same graphs (no Neo4j) | 9 templates × 78 projects: rows and row order identical (`results/v1.3-cypher-interp/mirrors/mirrors.json`) |
| Unit tests (`tests/unit/cypher-interp`, `jest --maxWorkers=2`) | 29/29; every test query also re-checked against live Neo4j (`scripts/v1.3/cypher-interp-unit-live.ts`) |
| Warm in-process evaluation, one variant | 149 ms (interp) vs 728 ms (Neo4j); graph stages ≈20 ms vs ≈600 ms (§6) |

## 1. Base branch: I2 was not found

The task said to cut from I2's branch (`src/memory-engine/`, hand mirrors in `src/memory-engine/templates/`,
`scripts/v1.3/memory-parity.ts`, an `--engine memory` option). No such branch, PR or file exists on the remote: open
PRs (16) and the 105 remote branches were searched, and no branch has `src/memory-engine/` or a memory/parity script.
So, as the task allows, this branch is cut from `origin/v1.3` (dc1a1c4a) and builds the minimum harness itself:

- the engine option offers `neo4j` and `cypher-interp` only (there is no `memory` engine to sit beside);
- `memory-parity.ts` (with `lib/memory-projects.ts`, `lib/memory-sweep.ts`) is written here, keeping I2's names;
- the "hand mirrors" this document compares against are the ones that do exist on v1.3:
  `src/fitness-compiler/apg2-in-memory.ts` (`APG2_IN_MEMORY`, the 9 APG v2 templates) and
  `src/fitness-compiler/v13-in-memory-baselines.ts` (3 ablation baselines). I2's notes on `avg` in
  `src/memory-engine/templates/system.ts` could not be read; the `avg` behaviour was re-derived live (trap T3).

Neo4j: the 5.26.24 Community tarball plus its bundled `labs/apoc-5.26.24-core.jar`, on bolt 127.0.0.1:7687 in this
container (credentials generated into a 0600 file, never printed). One instance was enough; nothing ran on 7688.

## 2. Design

```
template text ──compileFunctions (exclude markers, edge views, role tokens; params bound)──▶ Cypher text + params
                                                                                         │
                       GraphRepository.executeQuery(text, params)  ◀────────────────────┘
                         │                                   │
                Neo4jRepository (bolt)              MemoryGraphRepository  (src/cypher-interp/repository.ts)
                                                     ├─ ingestion writes: recognised by shape, applied to MemoryGraph
                                                     └─ reads: parseCypher ─▶ AST ─▶ executeQuery ─▶ driver-shaped records
```

Every compile-time rewrite (edge views, `/*EXCLUDE:*/` markers, role tokens, parameter binding) happens in the
compiler, before any repository sees the text, exactly as for Neo4j. The interpreter receives the identical string.

### 2.1 Parser: Neo4j's own grammar

- **Grammar**: `Cypher25Lexer.g4` / `Cypher25Parser.g4` as exported by `@neo4j-cypher/language-support`
  **2.0.0-next.38** (devDependency, exact; Neo4j Inc., Apache-2.0, published 2026-09-28; the package's
  `"./grammar/*.g4"` export). This is the grammar Neo4j's own tooling (VS Code extension, query editors) parses with.
- **Generator**: `antlr-ng` **1.0.10** (devDependency, exact; the TypeScript port of the ANTLR tool, no Java).
  `scripts/v1.3/gen-cypher-parser.sh` writes `src/cypher-interp/generated/Cypher25{Lexer,Parser}.ts` (checked in, 2 MB,
  `@ts-nocheck`, ignored by eslint). The grammar's single lexer action is Java (`_modeStack.isEmpty()`); the script
  substitutes the TypeScript form upstream's own `CypherCmdLexer.g4` uses.
- **Runtime**: `antlr4ng` **3.0.16** (dependency, exact; the version language-support itself pins).
- A throwing error listener turns every lexer/parser error into `CypherSyntaxError`.

Why this and not something else:

| option | verdict |
|---|---|
| `@neo4j-cypher/language-support` public API | exposes `getDebugTree` (rule names + text only, no error status: a broken query still yields a tree) and `lintCypherQuery` (semantic analysis, 200-400 ms per query). The real parser is internal (hidden by `exports`). Used for its grammar only. |
| `@neo4j-cypher/antlr4` 1.0.0 | unmaintained since 2023, Cypher 4 era grammar (no `EXISTS { }` subqueries, no inline `WHERE` in relationship patterns, which the edge views emit). |
| `cypher-parser` / `node-cypher-parser` | native addons over libcypher-parser: a C build defeats `npx`, openCypher 9 era. |
| `@dortdb/lang-cypher` 2.1.1 | a parser and executor for the DortDB research database: its own grammar and DortDB semantics, not Neo4j's. Not evaluated further. |
| hand-written parser | not needed: a maintained, exact grammar exists. |

The grammar is Cypher 25 (a superset of what Neo4j 5.26's Cypher 5 accepts for this subset). Cypher-25-only syntax
(`||`, `WHEN … THEN` query branches, `NEXT`, `FILTER`, `LET`, comma lists in simple `CASE`) parses but is rejected by the
AST builder, so it is never executed with a guessed meaning.

### 2.2 Executor (`src/cypher-interp/`)

| file | role |
|---|---|
| `parse.ts` | CST → AST (`ast.ts`); one strict mapping per grammar rule; anything else → `CypherUnsupportedError`; cache by text |
| `values.ts` | value model (INTEGER = `bigint`, FLOAT = `number`, LIST, `CypherMap`, node, relationship, `CypherPath`); equality, comparability, orderability, equivalence (grouping) keys; Java `Double.toString` |
| `eval.ts` | clause pipeline over row generators (EXISTS stops at its first row); pattern matcher; projection, implicit grouping, aggregates, DISTINCT, ORDER BY / SKIP / LIMIT; expressions |
| `functions.ts` | scalar built-ins, the three APOC functions, Java-regex translation |
| `graph.ts` | `MemoryGraph`: nodes, typed relationships, label index, adjacency, all in creation order |
| `driver-values.ts` | parameters in / records out exactly as the neo4j-driver produces them (`Integer`, `Node`, ...) |
| `repository.ts` | `MemoryGraphRepository implements GraphRepository`; the ingestion adapter |
| `engine.ts` | `GraphEngine = 'neo4j' \| 'cypher-interp'` |

Pattern matching anchors on the first already-bound node of a pattern part (else the first node, by its first required
label), expands right then left, and enforces relationship isomorphism over the whole MATCH clause (a variable-length
segment included). Variable-length expansion is depth-first, a path yielded when first reached (Neo4j's order for
`VarExpand`), bounded or unbounded, relationships unique.

**Ingestion adapter.** The interpreter is read-only. `ingestAPG` issues a fixed set of writes (`graph-ingester.ts`):
the wipe, two `CREATE INDEX … IF NOT EXISTS`, `CALL db.awaitIndexes()`, one `UNWIND $batch AS node CREATE (n:APGNode:T)
SET n = node` per node type, one `UNWIND $batch AS edge MATCH … MATCH … CREATE (src)-[r:T]->(tgt) SET r = edge.props` per
edge type. The repository recognises exactly these shapes and applies them with Neo4j's semantics (null entries are
not stored; an edge whose endpoint id matches no node is not created; repeated ids give one edge per pair) and returns
the same `nodesCreated` / `relationshipsCreated` counters, so `ingestAPG` and its INGEST_002/003 checks run unchanged.
Any other write reaches the parser and is rejected as unsupported. If `graph-ingester.ts` changes its text, ingestion on
this engine fails loudly (and the parity harness's `ingest` family goes red); it cannot silently diverge.

### 2.3 Engine option

- `PipelineConfig.graphEngine?: 'neo4j' | 'cypher-interp'` (absent = `neo4j`), `createPipeline` builds the repository;
  `PipelineConfig.graphRepository` lets a harness inject one (the parity tee).
- CLI `firewall evaluate --engine cypher-interp`: no `NEO4J_PASSWORD` needed, no connection, no Neo4j lock.
- `scripts/v1.3/ue-baseline-live.ts --engine cypher-interp` passes the flag to every CLI child and skips the lock.
- `scripts/v1.3/memory-parity.ts --engine cypher-interp` (the only engine on this branch, see §1).

## 3. Supported subset

From the census of every text the pipeline sends: 47 catalogue templates (25 frozen `CYPHER_TEMPLATES`, 5 hexagonal,
1 module-wiring, 7 DDD, 9 APG v2) in up to four compiled forms each (exclude marker off/on × v1.2E text / v1.3
rewrites), 11 distinct universal-metric texts, 4 judge graph-view queries, 4 ingestion verification counts and the
ingestion writes.

**Clauses**: `MATCH`, `OPTIONAL MATCH` (WHERE inside the optional match), `WHERE`, `WITH [DISTINCT] … [ORDER BY] [SKIP]
[LIMIT] [WHERE]`, `RETURN [DISTINCT] … [ORDER BY] [SKIP] [LIMIT]`, `UNWIND`, `WITH *` / `RETURN *`.

**Patterns**: node labels and label expressions (`:A:B`, `:A|B`, `!`, `%`, `IS`), inline property maps, inline
`WHERE` in node and relationship patterns, relationship type alternatives (`[:IMPORTS|RE_EXPORTS]`), directions
`->`, `<-`, `-`, variable length `*`, `*n`, `*n..m`, `*..m`, `*n..`, path variables `p = (...)`, several pattern
parts per MATCH.

**Expressions**: literals (integer, hex, octal, float, string with escapes, `true/false/null`, `NaN`, `Infinity`),
lists, maps, `$params`, property access, `[i]` indexing (negative from the end), `[a..b]` slicing, `AND OR XOR NOT`,
`= <> < > <= >=` (chained), `+ - * / % ^`, unary `-`, `IN`, `=~`, `STARTS WITH`, `ENDS WITH`, `CONTAINS`,
`IS [NOT] NULL`, label predicates (`n:Interface`, `r:IMPORTS`), generic and simple `CASE`, `EXISTS { MATCH … WHERE … }`
and `EXISTS { pattern }` (correlated), list comprehension, `ALL/ANY/NONE/SINGLE(x IN l WHERE p)`, `reduce`.

**Aggregates**: `count(*)`, `count`, `collect`, `sum`, `avg`, `min`, `max`, each with `DISTINCT`; implicit grouping by
the non-aggregate items; aggregates inside larger expressions (`toFloat(count(x)) / total`).

**Functions**: `coalesce type labels id keys nodes relationships startNode endNode length size head last tail reverse
isEmpty range split substring left right replace toLower toUpper trim ltrim rtrim toString toInteger toFloat toBoolean
abs sign ceil floor sqrt`, and `apoc.coll.indexOf`, `apoc.coll.toSet`, `apoc.coll.sort` as built-ins.

**Added on `v1.3-npx`** (`Docs/v1.3/npx-mode.md` §4.1): `CALL { part (UNION [ALL] part)* }` returning unit
subqueries (importing `WITH` allowed), for FF-P05's signature-types text on v1.3. Not yet covered by the live parity
run below.

**Rejected with `CypherUnsupportedError`** (never a silent answer): every write clause (CREATE, MERGE, SET, DELETE,
REMOVE, FOREACH, LOAD CSV) outside the recognised ingestion shapes, `CALL` (procedures, GDS; subqueries other than the returning `CALL { }` form above), `UNION` outside `CALL { }`,
quantified path patterns and `shortestPath`, match modes, hints, `COUNT { }` / `COLLECT { }` subqueries, pattern
comprehensions and pattern expressions, map projections, type predicates, `split` with a list of delimiters, WHERE
inside a variable-length relationship, `stDev`/`percentile*`, any function outside the table above, Java-only regex
syntax (inline flags after the start, possessive quantifiers, `\p{javaX}`, `\Q…\E`, `\A \Z \z`), and every
Cypher-25-only form listed in §2.1. Undefined variables, missing parameters, type errors and arithmetic errors fail
with Neo4j's error codes.

## 4. Parity against Neo4j 5.26.24 + APOC

`node --import tsx scripts/v1.3/memory-parity.ts --engine cypher-interp --out results/v1.3-cypher-interp/parity`
(4.5 min; holds the Neo4j lock). A `ParityTee` repository sends every statement to Neo4j and to the interpreter,
classes the pair and hands Neo4j's answer back, so the pipeline under test runs exactly as on Neo4j.

- **Projects (79)**: the 71 reference variants (materialised in the OS temp directory as the live run does), the 7
  APG v2 fixture projects (`tests/fixtures/v1.3-apg2`), and one synthetic APG (`lib/memory-projects.ts`
  `syntheticProject`) with the shapes no real project has (EXTENDS chains, MODULE_IMPORTS, decorators, a barrel that
  declares code), so that no template is compared on empty results only.
- **Both arms**: the full in-process pipeline per reference variant under `v1.3` (`--scoring v1.3 --instrument v2`,
  the CLI default) and `v1.2e` (`--scoring v1.2e --instrument v1`, the registered Study 1 instrument). Every statement
  the pipeline issues is compared: ingestion writes (counters), verification counts, the compiled templates, the
  universal metrics (frozen set under v1.2E, literal set under v1.3).
- **Catalogue sweep**: every catalogue template in each compiled form, with the spec's own parameters, then with two
  permissive bindings (`low`: thresholds and counts at their minimum, names that never match, roles that always match;
  `high`: ratio thresholds at 2), on the v1.3 graph and on the same project's APG v2 graph; plus the judge's graph view
  and both universal-metric sets on every graph.
- **Classes**: `equal` (same columns, values with INTEGER/FLOAT kept apart, same row order); `order` (same multiset,
  different order; or, for a query with `avg`/`sum`, floats within 4 ULP: trap T2); `content`; `error` (one side
  failed); `unsupported`; `both-error`.

Result: **65,254 statements: equal 64,491, order 763, content 0, error 0, unsupported 0, both-error 0.** (An earlier
full run of the same harness gave order 816: the count moves with Neo4j's node-id reuse between ingestions, T1/T2;
the content/error/unsupported counts were 0 in every run.)

| template / query family | statements | projects | equal | order | content | error | unsupported | both-error | Neo4j rows |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| abstraction-ratio | 870 | 79 | 870 | 0 | 0 | 0 | 0 | 0 | 486 |
| aggregate-boundary | 1546 | 79 | 1546 | 0 | 0 | 0 | 0 | 0 | 302 |
| application-service-thin | 788 | 79 | 788 | 0 | 0 | 0 | 0 | 0 | 2068 |
| boundary-type-leak | 758 | 79 | 758 | 0 | 0 | 0 | 0 | 0 | 132 |
| bounded-context-modules | 788 | 79 | 788 | 0 | 0 | 0 | 0 | 0 | 176 |
| component-adp-cycle | 758 | 79 | 758 | 0 | 0 | 0 | 0 | 0 | 42 |
| component-instability | 1628 | 79 | 1628 | 0 | 0 | 0 | 0 | 0 | 17028 |
| component-main-sequence-distance | 758 | 79 | 758 | 0 | 0 | 0 | 0 | 0 | 102 |
| component-sdp-violation | 758 | 79 | 758 | 0 | 0 | 0 | 0 | 0 | 82 |
| context-isolation | 1546 | 79 | 1546 | 0 | 0 | 0 | 0 | 0 | 35028 |
| controller-no-entity | 1572 | 79 | 1572 | 0 | 0 | 0 | 0 | 0 | 1632 |
| core-isolation | 1546 | 79 | 1546 | 0 | 0 | 0 | 0 | 0 | 3118 |
| deep-import-declared-api | 758 | 79 | 758 | 0 | 0 | 0 | 0 | 0 | 26 |
| deep-import-inferred-api | 758 | 79 | 758 | 0 | 0 | 0 | 0 | 0 | 6 |
| dependency-direction | 1598 | 79 | 1598 | 0 | 0 | 0 | 0 | 0 | 394 |
| dependency-direction-graph | 1576 | 79 | 1576 | 0 | 0 | 0 | 0 | 0 | 292 |
| dependency-inversion | 814 | 79 | 814 | 0 | 0 | 0 | 0 | 0 | 582 |
| domain-event-placement | 788 | 79 | 788 | 0 | 0 | 0 | 0 | 0 | 14 |
| domain-purity | 1658 | 79 | 1658 | 0 | 0 | 0 | 0 | 0 | 200 |
| domain-stability | 1572 | 79 | 1572 | 0 | 0 | 0 | 0 | 0 | 5214 |
| domain-state-purity | 844 | 79 | 844 | 0 | 0 | 0 | 0 | 0 | 578 |
| ingest | 4146 | 79 | 4146 | 0 | 0 | 0 | 0 | 0 | 0 |
| ingest-verify | 884 | 79 | 632 | 252 | 0 | 0 | 0 | 0 | 3704 |
| inheritance-depth | 870 | 79 | 870 | 0 | 0 | 0 | 0 | 0 | 26 |
| interface-segregation-proxy | 870 | 79 | 870 | 0 | 0 | 0 | 0 | 0 | 1312 |
| io-outside-adapters | 758 | 79 | 758 | 0 | 0 | 0 | 0 | 0 | 18 |
| judge-graph:classes | 379 | 79 | 379 | 0 | 0 | 0 | 0 | 0 | 7380 |
| judge-graph:edges | 379 | 79 | 379 | 0 | 0 | 0 | 0 | 0 | 33113 |
| judge-graph:files | 379 | 79 | 379 | 0 | 0 | 0 | 0 | 0 | 10691 |
| judge-graph:interfaces | 379 | 79 | 379 | 0 | 0 | 0 | 0 | 0 | 3685 |
| layer-skip-graph | 1576 | 79 | 1576 | 0 | 0 | 0 | 0 | 0 | 8268 |
| max-fan-in | 1628 | 79 | 1628 | 0 | 0 | 0 | 0 | 0 | 29382 |
| module-domain-imports-infrastructure | 758 | 79 | 758 | 0 | 0 | 0 | 0 | 0 | 6 |
| module-fan-out | 1628 | 79 | 1628 | 0 | 0 | 0 | 0 | 0 | 25512 |
| naming-controllers | 758 | 79 | 758 | 0 | 0 | 0 | 0 | 0 | 4 |
| naming-conventions | 758 | 79 | 758 | 0 | 0 | 0 | 0 | 0 | 5562 |
| naming-repos | 870 | 79 | 870 | 0 | 0 | 0 | 0 | 0 | 1518 |
| naming-services | 844 | 79 | 844 | 0 | 0 | 0 | 0 | 0 | 580 |
| no-cyclic-deps | 1628 | 79 | 1628 | 0 | 0 | 0 | 0 | 0 | 166 |
| no-domain-outward-dep | 1572 | 79 | 1572 | 0 | 0 | 0 | 0 | 0 | 3122 |
| no-index-logic | 870 | 79 | 870 | 0 | 0 | 0 | 0 | 0 | 6 |
| no-layer-skip | 1542 | 79 | 1542 | 0 | 0 | 0 | 0 | 0 | 19462 |
| no-orphan-files | 1628 | 79 | 1628 | 0 | 0 | 0 | 0 | 0 | 114 |
| nondeterminism-in-core | 758 | 79 | 758 | 0 | 0 | 0 | 0 | 0 | 308 |
| port-adapter-pattern | 1546 | 79 | 1546 | 0 | 0 | 0 | 0 | 0 | 1346 |
| port-dependency-inversion | 788 | 79 | 788 | 0 | 0 | 0 | 0 | 0 | 578 |
| repository-aggregate-root | 1546 | 79 | 1546 | 0 | 0 | 0 | 0 | 0 | 34 |
| repository-pattern | 1572 | 79 | 1572 | 0 | 0 | 0 | 0 | 0 | 66 |
| single-responsibility-proxy | 870 | 79 | 870 | 0 | 0 | 0 | 0 | 0 | 4988 |
| test-file-pairing | 870 | 79 | 870 | 0 | 0 | 0 | 0 | 0 | 23212 |
| undeclared-async-coupling | 758 | 79 | 758 | 0 | 0 | 0 | 0 | 0 | 30 |
| universal-literal:averageInstability | 450 | 79 | 203 | 247 | 0 | 0 | 0 | 0 | 450 |
| universal-literal:cyclicDependencyCount | 450 | 79 | 450 | 0 | 0 | 0 | 0 | 0 | 450 |
| universal-literal:maxFanIn | 450 | 79 | 450 | 0 | 0 | 0 | 0 | 0 | 450 |
| universal-literal:maxFanOut | 450 | 79 | 450 | 0 | 0 | 0 | 0 | 0 | 450 |
| universal-literal:orphanFileCount | 450 | 79 | 450 | 0 | 0 | 0 | 0 | 0 | 450 |
| universal:abstractionRatio | 900 | 79 | 900 | 0 | 0 | 0 | 0 | 0 | 900 |
| universal:averageInstability | 450 | 79 | 186 | 264 | 0 | 0 | 0 | 0 | 450 |
| universal:cyclicDependencyCount | 450 | 79 | 450 | 0 | 0 | 0 | 0 | 0 | 450 |
| universal:maxFanIn | 450 | 79 | 450 | 0 | 0 | 0 | 0 | 0 | 450 |
| universal:maxFanOut | 450 | 79 | 450 | 0 | 0 | 0 | 0 | 0 | 450 |
| universal:orphanFileCount | 450 | 79 | 450 | 0 | 0 | 0 | 0 | 0 | 450 |
| use-case-isolation | 1572 | 79 | 1572 | 0 | 0 | 0 | 0 | 0 | 76 |
| value-object-immutability | 788 | 79 | 788 | 0 | 0 | 0 | 0 | 0 | 2220 |

Every catalogue template is `equal` on every statement, both arms, every project: all of them end in an `ORDER BY`
whose keys fix the row order. The 763 `order` statements are: the ingestion verification `n.type, count(*)` (252,
group order follows Neo4j's label-scan order: T1) and `averageInstability` in both universal-metric sets (511, last-bit
differences from the accumulation order: T2). Files: `parity.md`, `parity-by-template.json` (classes per template,
timings per project and phase), `parity-nonequal.json` (every statement not `equal`, with its detail).

Reference-set run: `ue-baseline-live --engine cypher-interp` with `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` unset
reproduces `results/v1.3-reference/after-member-facts` byte for byte (`raw/` 71/71, `report.json`, `report.md`;
sha256 per file in `results/v1.3-cypher-interp/ue-baseline-live/run-provenance.json`). `averageInstability` does not
reach those files at a precision where T2 shows.

## 5. Semantic traps found

| # | trap | what Neo4j 5.26.24 does | interpreter |
|---|---|---|---|
| T1 | row order without ORDER BY | follows the planner (it may start an expand at either end: `MATCH (a:File)-[r]->(b:File)` came back grouped by `b`) and the store (label scans by node id; after the ingestion's wipe, ids are reused, so the same graph scans in a different order run to run: verified with three re-ingestions) | creation order, deterministic. Not reproducible in general; parity classes it `order`. Every template has a complete ORDER BY, so no template is affected |
| T2 | an aggregate over unordered rows is order-sensitive in floats | `avg` over the same graph returned `0.4556650246305418` after one ingestion and `0.45566502463054187` after another (id reuse, T1). Neo4j's own answer is history-dependent in the last bits | the fresh-database answer. Parity treats ≤ 4 ULP on such queries as `order`. Only `averageInstability` hits it; the report does not carry it at that precision |
| T3 | `avg` is not `sum / count` | an incremental mean, `m += (x - m) / n`: 200/200 random float lists matched bit for bit; `sum/count` matched 93/200 | the incremental mean (`eval.ts` `aggState('avg')`). `sum` accumulates in row order |
| T4 | JS numbers are FLOATs | the driver packs every JS `number` as float64, so an ingested `line: 12` is stored as `12.0`, `$threshold: 3` is a FLOAT, while `count()` returns an INTEGER (a driver `Integer`) | parameters and ingested properties are FLOATs, aggregates and integer literals INTEGERs; records go back as driver `Integer`s, so downstream `String()`, `Number()` and evidence formatting see the same objects |
| T5 | grouping and DISTINCT treat `1` and `1.0` as one value | first-seen value kept (`UNWIND [1.0, 1, 2] AS x RETURN x, count(*)` → `1.0, 2` then `2, 1`); groups and DISTINCT rows in first-seen order (slotted runtime) | equivalence keys; first seen kept; insertion-ordered maps |
| T6 | `apoc.coll.indexOf` compares numerically across types | `indexOf([1, 2], 2.0)` = 1 (the first draft assumed Java `Long.equals(Double)` = false, i.e. -1; the live check caught it) | equivalence equality |
| T7 | `apoc.coll.sort(null)` | `[]`, not null; a null element raises `ProcedureCallFailed` (NullPointerException); `apoc.coll.toSet(null)` is null; `indexOf(null, x)` is -1 | the same |
| T8 | `ORDER BY … LIMIT` is not stable on ties | the Top-N operator returned tied rows in a different order from their input | stable sort: ties keep input order. No template has a tie on its full key |
| T9 | `SET n = map` drops nulls | `layer: null` is not stored; `n.layer IS NULL` still holds; `keys(n)` differs from the map | the adapter stores only non-null entries |
| T10 | relationship isomorphism | within one MATCH clause no relationship binds twice, across pattern parts and inside variable-length segments; nodes may repeat (`(f)-[*2..10]->(f)`) | the same; a new MATCH (or EXISTS) starts a new scope |
| T11 | three-valued logic everywhere | `NOT f.isBarrel` on a missing property is null and filters the row out; `[1, null] = [1, null]` is null; `2 IN [1, null]` is null; `ANY/ALL/NONE/SINGLE` return null when undecided; simple `CASE null WHEN null` never matches | the same; WHERE keeps only `true` |
| T12 | `=~` is Java `Pattern.matches` | whole-string match, Java syntax | compiled to a JS RegExp anchored `^(?:…)$`; leading `(?i)(?s)(?m)` become flags; Java-only constructs are rejected, not approximated |
| T13 | strings count code points | `size('😀')` = 1 | code points for `size`, `substring`, `left`, `right`, `reverse` |
| T14 | FLOAT → string uses Java formatting | `toString(1.0)` = `1.0`, `'x' + 1.0` = `x1.0`, `toString(1e20)` = `1.0E20` | `javaDoubleToString` |
| T15 | orderability across types | `ORDER BY` / `min` / `max`: map < node < relationship < list < path < string < boolean < number < null; NaN after every number; `min(1, 'a', 2.0)` = `'a'` | the same |
| T16 | integer arithmetic | `7 / 2` = 3, `-7 / 2` = -3, `-7 % 2` = -1, `1 / 0` → `ArithmeticError`, `2 ^ 2` = 4.0, 64-bit overflow is an error | `bigint` with the same rules |
| T17 | ingestion does not write `decorators` | `naming-controllers` (`ANY(dec IN c.decorators …)`) can never fire on an ingested graph (ANY over null is null) | the same; the synthetic project carries `decorators` as an ordinary property to compare the template on rows |
| T18 | the grammar is Cypher 25 | Neo4j 5.26 runs Cypher 5 | Cypher-25-only syntax is rejected at AST build time |
| T19 | lexer action in Java | the published `.g4` embeds `_modeStack.isEmpty()` | replaced at generation time with upstream's TypeScript form |

## 6. Performance

All numbers from this container, same run as §4 unless noted. Neo4j times include the bolt round trip on localhost.

| measurement | Neo4j | cypher-interp | hand mirrors |
|---|---:|---:|---:|
| reference-set CLI run, 71 variants (one `tsx` child per variant) | 3m26.8s (median 2,710 ms per variant) | 2m49.9s (median about 2,330 ms) | - |
| warm in-process evaluation, clean-architecture/clean (`results/v1.3-cypher-interp/bench.md`) | 728 ms | 149 ms | - |
| warm in-process evaluation, ddd/clean | 866 ms | 321 ms | - |
| graph stages of that evaluation (ingest + evaluate + scores) | ≈ 600 ms | ≈ 20 ms | - |
| pipeline arm v1.3, graph statements per project (median of 71) | 505 ms | 14 ms | - |
| APG v2 templates, 9 per project, 78 projects (v1.2E text, one run each) | 1,747 ms | 103 ms | 43 ms (graph build included) |
| `cypher-interp-mirrors.ts`, 78 projects, ingestion + 9 templates vs mirror graph build + 9 templates | - | 833 ms | 67 ms |

Phase totals over the parity run (statements: Neo4j / interpreter): arm v1.3 3,159: 36.4 s / 1.3 s; arm v1.2e
3,159: 35.6 s / 1.0 s; sweep on the v1.3 graphs 31,950: 44.6 s / 12.9 s; sweep on the APG v2 graphs 26,513: 81.4 s /
9.4 s. The sweep ratio is lower because it is dominated by the multi-thousand-row texts (`context-isolation`,
`test-file-pairing`, the fan-in/out rules under the `low` binding), where the cost is row construction on both sides.

Read: the interpreter removes Neo4j's ingestion cost (the `ingest-apg` stage alone is ≈ 510 ms on Neo4j, ≈ 6 ms here) and the
per-query round trip. The CLI run barely changes because each variant pays a `tsx` start-up and a ts-morph extraction
(≈ 2.2 s) either way; the gain shows in a long-lived process (MCP server, watch loop, tests). The hand mirrors are 2.4x
(per template run) to 12x (with ingestion) faster than the interpreter, all in single-digit milliseconds per project.
Cold start: the first query of a process pays ≈ 300-600 ms of ANTLR prediction warm-up; later texts are parsed once
and cached.

## 7. Recommendation: the hand mirrors

**Delete the hand mirrors in favour of the interpreter, keeping Neo4j as the reference.** Conditions:

1. The APG v2 mirrors (`apg2-in-memory.ts`, 271 lines) agree with the interpreter on all 9 templates × 78 projects,
   rows and order, and the interpreter agrees with Neo4j on every statement of the sweep. Their callers
   (`scripts/apg2-ablation.ts`, `scripts/v1.3/apg2-live.ts`'s mirror column, the APG v2 unit tests) can run the
   template text through `MemoryGraphRepository` instead; the mirrors' one advantage (≈ 1 ms vs ≈ 11 ms per project) does
   not matter at these sizes. `v13-in-memory-baselines.ts` (the ablation's "(b)" column) can likewise be the real
   templates under their v1.3 edge view, which also removes its documented gap ("exclude paths are not applied").
2. Each mirror is a second definition of a rule that has to be kept in step by hand; the interpreter has none: a
   template edit is picked up as text, and if it uses a construct outside the subset it fails as `unsupported`.
3. Keep the differential harness as the guard: run `memory-parity.ts` whenever a template, the compiler's rewrites,
   `graph-ingester.ts` or the interpreter changes, and before any study run that uses the interpreter for anything but
   speed. Reported numbers still come from Neo4j.
4. Not part of this spike: the deletion itself (it touches the ablation scripts and their frozen outputs, which need
   their own re-run and sign-off).

I2's `src/memory-engine/templates` could not be assessed (it does not exist on the remote); the same argument applies
to it if it appears.

## 8. What an `npx` no-Neo4j mode still needs

Done here: the engine in the repository layer, `PipelineConfig.graphEngine`, `firewall evaluate --engine
cypher-interp` (no password, no connection, no lock), the reference-set script, the parity harness.

Still needed:

1. **CLI**: the flag on `batch`, `drift`, `check-file` (`src/mcp-server/check-file-cli.ts`) and the other commands that
   build a pipeline or a repository; a decision on the default (keep `neo4j` for study commands; make `cypher-interp`
   the default for a new `npx` entry, or select it when no `NEO4J_URI` is set); `--neo4j-uri` and the password check
   only on the Neo4j path everywhere (`src/cli/cli.ts` has two more `requireEnvForCli('NEO4J_PASSWORD')` calls).
2. **MCP server**: `src/mcp-server/context.ts` constructs `Neo4jRepository` directly and passes Neo4j settings to
   `createPipeline` (`evaluate-project.ts`); both need the same engine switch (and the Neo4j lock only on that path). With the interpreter, an evaluation costs
   ≈ 150-320 ms warm in a long-lived server (§6), most of it ts-morph extraction.
3. **Judge**: `full` / `neuronal-only` modes read the graph view through `JUDGE_GRAPH_QUERIES`, which already pass
   parity (`judge-graph:*`, 1,516 statements equal); the judge's own LLM provider, cassettes and credentials are
   independent of the graph engine and keep their current requirements. A full-mode end-to-end run on
   `cypher-interp` has not been done (it spends judge calls).
4. **Packaging**: `npm run build` emits the generated parser (2 MB of TypeScript) into `dist/` (not measured here);
   runtime dependencies are `antlr4ng` (pinned) and `neo4j-driver` (still used for the driver-shaped record types;
   could be swapped for local classes if the driver should become optional); the grammar package and `antlr-ng` stay
   devDependencies. `bin` entries exist (`daedalus-arch`, `daedalus-arch-mcp`); `npx` needs a published package or a
   git `prepare` script that runs `tsc`. ts-morph remains the heaviest dependency.
5. **Persistent mode**: snapshots and drift use the file-system store and are engine-independent; a graph that should
   outlive the process would need a serialisation of `MemoryGraph` (not built).
6. **Scale**: everything is in memory and single-threaded; unbounded variable-length patterns enumerate trails
   depth-first (as Neo4j does without a pruning planner). Measured only on the reference projects and fixtures here;
   a very large monorepo would want a reachability shortcut for `EXISTS { (a)-[*1..]->(b) }` and a run on the corpus.

## 9. Files

- `src/cypher-interp/` (interpreter, repository, engine; `generated/` from `scripts/v1.3/gen-cypher-parser.sh`)
- `src/pipeline/types.ts`, `src/pipeline/pipeline-factory.ts`, `src/cli/cli.ts` (engine option)
- `scripts/v1.3/ue-baseline-live.ts` (`--engine`), `scripts/v1.3/memory-parity.ts`, `scripts/v1.3/lib/memory-projects.ts`,
  `scripts/v1.3/lib/memory-sweep.ts`, `scripts/v1.3/cypher-interp-unit-live.ts`, `scripts/v1.3/cypher-interp-mirrors.ts`,
  `scripts/v1.3/cypher-interp-bench.ts`
- `tests/unit/cypher-interp/interpreter.test.ts`
- `results/v1.3-cypher-interp/` (`parity/`, `mirrors/`, `ue-baseline-live/run-provenance.json`, `bench.md`); no file
  under any other `results/` directory, any frozen v1.2E artefact or any template text was changed.
