# v1.3 spike: an in-process Cypher interpreter (`--engine cypher-interp`)

Branch `v1.3-cypher-interp`, 2026-10-15 (merged into `v1.3` as #128); review fixes on `v1.3-interp-review-fixes`,
2026-10-16 (an adversarial review found the parity claim held with caveats; §0, "What may be claimed", §2.1, §3, §4
and §5 are updated). All numbers below are for `v1.3` at `f94eb251` merged with the review fixes, which includes the
seven `cheap2` templates and the FF-P05 signature-types rewrite that arrived after the spike's base `dc1a1c4a`. Status:
spike, development-set evidence only. Neo4j stays the reference engine for every reported number; nothing in this
document replaces a Neo4j run in a study.

**Decision this spike serves.** The Cypher template text stays the one canonical definition of every rule. The
interpreter executes that text; no rule is re-implemented in TypeScript, and no template text was changed to make it
easier to interpret (`git diff origin/v1.3 -- src/fitness-compiler` is empty).

## 0. Results in one screen

| check | result |
|---|---|
| `ue-baseline-live --engine cypher-interp --keep-cli`, 71 reference variants, **no Neo4j variable set** | outputs committed in `results/v1.3-cypher-interp/ue-baseline-live/` (`raw/`, `evidence/`, `cli/`, `report.json`, `report.md`). `raw/` (71 files), `report.json`, `report.md` **byte-identical** to `results/v1.3-reference/after-member-facts` and to a Neo4j control run (73/73); evidence violations identical 71/71 (only `elapsedMs` differs) |
| Scores and universal metrics, cypher-interp vs Neo4j control (`cypher-interp-compare-runs.ts`, §4.3) | the whole CLI JSON result identical 71/71 field by field: `ahsDeterministic`, `tiers.blockingAhs`, verdicts, per-dimension scores, universal metrics, tier counts, function results, graph stats, warnings. `engine-comparison.md`; control in `results/v1.3-cypher-interp/neo4j-control/` |
| Differential parity against live Neo4j 5.26.24 + APOC (`memory-parity.ts`) | **72,388 statements, 81 projects: 0 content, 0 error, 0 unsupported**; 360 `order` (all the ingestion verification counts, trap T1), 206 `float-drift` (only the two named `averageInstability` texts, ≤ 5 ULP observed, bound 16 ULP, both values recorded; T2). Table in §4
| Coverage | per template, statements non-empty on both engines, per binding (§4.2). 14 catalogue templates were **thin** (< 50 non-empty) in the first run, and the 7 `cheap2` templates (merged from `v1.3`) have no rows on any real graph; two synthetic graphs now give each of these 21 ≥ 4 non-empty comparisons per binding, but 19 stay under 50 in total and stay flagged |
| Order guard (`tests/unit/cypher-interp/template-order.test.ts`) | every catalogue template, every compiled text: ends in `RETURN … ORDER BY` over projected columns; no ORDER BY key tie on any row of the synthetic and APG v2 fixture graphs under the three bindings. One stated precondition: the aggregate templates need non-overlapping aggregates (§4.4) |
| Unsupported syntax (`tests/unit/cypher-interp/unsupported-and-timeout.test.ts`) | 45 forms (writes, `COUNT { }`, `COLLECT { }`, map projections, Cypher-25-only forms, Java-only regex, every CALL procedure, correlated / OPTIONAL / IN TRANSACTIONS subqueries) fail with `CypherInterp.Unsupported` and a message naming the construct |
| Query timeout (NFR-07) | honoured: `timeoutMs` (else 30 s, the Neo4j repository's default) bounds every read; past it the query fails with `Neo.ClientError.Transaction.TransactionTimedOutClientConfiguration` (§3.1) |
| APG v2 hand mirrors vs interpreter on the same graphs (no Neo4j) | 9 templates × 78 projects: rows and row order identical (`results/v1.3-cypher-interp/mirrors/mirrors.json`; not re-run by the review fixes) |
| `CALL { … UNION … }` (§3) | supported, uncorrelated form only: `v1.3` compiles FF-P05 `controller-no-entity` into it (a82c3bb5), which the spike rejected, so on `v1.3` before this fix `--engine cypher-interp` failed FF-P05 in the pipeline on 28 projects (56 `unsupported` in a first parity run of the merged state) |
| Unit tests (`jest --maxWorkers=2`) | `tests/unit/cypher-interp` 234, `tests/unit/scripts/memory-sweep.test.ts` 7 |
| Licence | generated parser keeps Neo4j's Apache-2.0 header plus attribution; `NOTICE`, `licenses/Apache-2.0.txt`; `LICENSE` (MIT, matching `package.json`) added (§2.1) |
| Warm in-process evaluation, one variant | 149 ms (interp) vs 728 ms (Neo4j); graph stages ≈20 ms vs ≈600 ms (§6; not re-measured) |

## What may be claimed

On the evidence in this document, and only on the development set:

1. **The interpreter reproduces the reference-set results.** For the 71 v1.3 reference variants, `--engine cypher-interp`
   produces byte-identical tool outputs and reports, and an identical CLI result in every field (AHS, verdicts,
   per-dimension scores, universal metrics as the CLI reports them, i.e. rounded to 3 decimals), to Neo4j 5.26.24.
2. **The interpreter returns Neo4j's rows for every statement the harness issues, in Neo4j's order, for every catalogue
   template.** 72,388 statements over 81 graphs: no content difference, error or unsupported construct. Every
   catalogue template statement is `equal` (values and row order), the FF-P05 `CALL { … UNION … }` form included.
3. **Two documented differences remain, both outside the templates:** row order of the ingestion's un-ordered
   verification counts (`order`, T1; the pipeline reads them as a map) and the last bits of `averageInstability`
   (`float-drift`, T2: ≤ 5 ULP observed; every value Neo4j returns is the incremental mean of its own row order, and
   Neo4j itself returns different last bits for the same graph after a re-ingestion).

What may **not** be claimed:

- **General Cypher or Neo4j equivalence.** Parity holds for the statements the pipeline and the sweep issue, on these
  graphs. Constructs outside §3 are rejected, not emulated; a new template that uses one fails loudly, but a new
  template inside the subset is covered only once the harness has run on it.
- **Strong evidence for the thin templates.** `boundary-type-leak`, `component-adp-cycle`, `deep-import-declared-api`,
  `deep-import-inferred-api`, `domain-event-placement`, `inheritance-depth`, `io-outside-adapters`,
  `module-domain-imports-infrastructure`, `naming-controllers`, `no-index-logic`, `no-orphan-files` and
  `undeclared-async-coupling` are compared on 16-48 non-empty statements each, most of them on hand-built synthetic
  graphs; their `equal` rate rests largely on empty-vs-empty comparisons. The seven `cheap2` templates
  (`framework-exception-in-core`, `endpoint-bypasses-application`, `vendor-sdk-outside-adapters`, `untested-component`,
  `env-read-outside-config`, `hidden-coupling`, `agent-reimplementation`) are compared on rows only on the synthetic
  graphs (12 non-empty statements each): no persistence unit writes their facts yet, so the synthetic graphs write
  them in the layout `cheap2-templates.ts` specifies; if the eventual persistence unit chooses another layout, that
  comparison does not carry over.
- **Bit-exact floats for `avg` in general.** The float tolerance is restricted by exact text to the two
  `averageInstability` metrics; within it, the harness cannot tell an accumulation-order difference from a 1-16 ULP
  algorithm difference (the `avg` algorithm itself, T3, is checked by the unit tests and a live check, not by parity).
  Any other text, a future `avg`/`sum` template included, is compared bit for bit.
- **Row order without ORDER BY, or under ORDER BY ties.** The interpreter's order is deterministic (creation order,
  stable sort); Neo4j's is not (T1, T8). Downstream code (report top-10, the cycle cap) is safe because every template
  orders on keys unique at the row grain, under the preconditions of §4.4.
- **Parity on a later `v1.3`.** The evidence is for `v1.3` at `f94eb251` plus these fixes. A template or compiler
  rewrite added later is covered only after the harness and the order guard run on it (the order guard fails until
  every catalogue template returns rows on some test graph; that is how the `cheap2` gap was found).
- **Anything about a study.** Reported numbers still come from Neo4j; nothing here is a validity estimate.
- **Performance beyond §6** (single-threaded, in memory, measured on the reference projects only; a long query blocks
  the event loop until its timeout).

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
- **Licence**: the grammar is Copyright (c) "Neo4j", Neo4j Sweden AB, Apache License 2.0, and the generated parser is
  a derivative of it. The generator script now copies the grammar's copyright and licence header verbatim into both
  generated files and adds an attribution line (source package and version, the one modification); before the review
  fix the script dropped it. `NOTICE` lists the third-party Apache-2.0 material (the upstream package has no NOTICE of
  its own) and `licenses/Apache-2.0.txt` carries the licence text. The repository had no `LICENSE` file although
  `package.json` says MIT: `LICENSE` (MIT, copyright `cdcordobaa`, as `package.json` has an empty `author`) is added.
- **Why a prerelease (2.0.0-next.38).** `@neo4j-cypher/language-support` has never published a non-prerelease
  version. Its `latest` dist-tag is 2.0.0-next.6 (2024-05), which ships only the Cypher 5 era `CypherParser.g4` and
  does not export the grammar files; the Cypher 25 grammar and the `./grammar/*.g4` export exist only on the `next`
  line. next.38 (2026-09-28) was the newest `next` when the parser was generated (next.39 has appeared since). The
  exact pin makes regeneration reproducible, and since the generated parser is checked in, the prerelease is never
  installed at run time. Moving the pin means regenerating and re-running the parity harness.

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
[LIMIT] [WHERE]`, `RETURN [DISTINCT] … [ORDER BY] [SKIP] [LIMIT]`, `UNWIND`, `WITH *` / `RETURN *`, and the uncorrelated
subquery `CALL { q [UNION [ALL] q]... }` (each branch a read query ending in RETURN that sees no outer variable; added
by the review fixes for the v1.3 FF-P05 rewrite; UNION keeps the first of equivalent rows, as Neo4j's Distinct does).

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

**Rejected with `CypherUnsupportedError`** (never a silent answer): every write clause (CREATE, MERGE, SET, DELETE,
REMOVE, FOREACH, LOAD CSV) outside the recognised ingestion shapes, `CALL` of any procedure (GDS included), correlated
(`CALL (x) { }`, importing `WITH`), `OPTIONAL` and `IN TRANSACTIONS` subqueries, `UNION` outside `CALL { }`,
quantified path patterns and `shortestPath`, match modes, hints, `COUNT { }` / `COLLECT { }` subqueries, pattern
comprehensions and pattern expressions, map projections, type predicates, `split` with a list of delimiters, WHERE
inside a variable-length relationship, `stDev`/`percentile*`, any function outside the table above, Java-only regex
syntax (inline flags after the start, possessive quantifiers, `\p{javaX}`, `\Q…\E`, `\A \Z \z`), and every
Cypher-25-only form listed in §2.1. Undefined variables, missing parameters, type errors and arithmetic errors fail
with Neo4j's error codes.

Each rejection is pinned by `tests/unit/cypher-interp/unsupported-and-timeout.test.ts` (45 forms: MERGE, SET, CREATE,
DELETE / DETACH DELETE, REMOVE, FOREACH, LOAD CSV, `COUNT { }`, `COLLECT { }`, three map projections, `||`, `WHEN`
branches, `NEXT`, `FILTER`, `LET`, comma lists in `CASE`, type predicates, seven Java-only regex constructs, CALL of
`db.labels`, `apoc.help` and of the name `apoc.coll.sort` (the three apoc.coll built-ins are functions, never
procedures), correlated, OPTIONAL and IN TRANSACTIONS subqueries, other APOC and GDS functions, UNION outside
`CALL { }`, quantified path patterns); the supported `CALL { … UNION … }` form and its three syntax errors (mixed
UNION / UNION ALL, different column names, an outer variable redeclared) have tests with Neo4j's answers: the error code
is `CypherInterp.Unsupported` and the message names the construct (`MERGE (write clause)`, `COUNT { } subquery`, `map
projection`, ...), not the grammar rule alone.

### 3.1 Query timeout (NFR-07)

`QueryOptions.timeoutMs` is honoured. `MemoryGraphRepository` bounds every read (parsing included) by the caller's
`timeoutMs`, else by its constructor option `queryTimeoutMs` (default 30,000 ms, the Neo4j repository's config
default, BR-U2-38; `<= 0` disables it). Past the deadline the query fails with Neo4j's code
`Neo.ClientError.Transaction.TransactionTimedOutClientConfiguration`. Evaluation is synchronous, so the check is
cooperative: `eval.ts` counts node-scan steps, relationship expansions and input rows, and reads the clock every 1,024
of them. Limits: one long sort or one huge function call (`range(0, 1e9)`) is not interrupted; the query blocks the
event loop until it finishes or times out; the ingestion writes are not timed (they are linear in the batch).

## 4. Parity against Neo4j 5.26.24 + APOC

`node --import tsx scripts/v1.3/memory-parity.ts --engine cypher-interp --out results/v1.3-cypher-interp/parity`
(4.5 min; holds the Neo4j lock). A `ParityTee` repository sends every statement to Neo4j and to the interpreter,
classes the pair and hands Neo4j's answer back, so the pipeline under test runs exactly as on Neo4j.

- **Projects (81)**: the 71 reference variants (materialised in the OS temp directory as the live run does), the 7
  APG v2 fixture projects (`tests/fixtures/v1.3-apg2`), and three synthetic APGs (`lib/memory-projects.ts`
  `syntheticProjects`): `synthetic/shapes` with the shapes no real project has (EXTENDS chains, MODULE_IMPORTS,
  decorators, a barrel that declares code), and `synthetic/thin-a`, `synthetic/thin-b`, built by the review fix for
  the thin templates (§4.2).
- **Both arms**: the full in-process pipeline per reference variant under `v1.3` (`--scoring v1.3 --instrument v2`,
  the CLI default) and `v1.2e` (`--scoring v1.2e --instrument v1`, the registered Study 1 instrument). Every statement
  the pipeline issues is compared: ingestion writes (counters), verification counts, the compiled templates, the
  universal metrics (frozen set under v1.2E, literal set under v1.3).
- **Catalogue sweep**: every catalogue template in each compiled form, with the spec's own parameters, then with two
  permissive bindings (`low`: thresholds and counts at their minimum, names that never match, roles that always match;
  `high`: ratio thresholds at 2), on the v1.3 graph and on the same project's APG v2 graph; plus the judge's graph view
  and both universal-metric sets on every graph.
- **Bindings**: `pipeline` (the two arms and the ingestion), and for the sweep `spec` (the spec's compiled parameters
  plus generic values), `low` and `high` (`lib/memory-bindings.ts`).
- **Classes** (`lib/memory-sweep.ts`):
  - `equal`: same columns, same values (INTEGER and FLOAT kept apart), same row order;
  - `order`: the same multiset of rows in a different order, values bit-identical: a genuine row-order difference of a
    query without a complete ORDER BY (T1);
  - `float-drift`: same rows in the same order, every value bit-identical except FLOATs within **16 ULP** (a true
    units-in-the-last-place distance), and **only** for a text in `FLOAT_DRIFT_TEMPLATES`, which names the two
    `averageInstability` metric texts by exact text. Both values of every drifting cell are recorded
    (`parity-float-drift.json`: row, column, Neo4j value, interpreter value, ULPs);
  - `content` (anything else), `error` (one side failed), `unsupported`, `both-error`.

  Before the review fix, `order` also absorbed float differences, by the rule `|a - b| <= 4 · ε · max(|a|, |b|)` on
  any text matching `/\b(avg|sum)\s*\(/`: a future `avg`/`sum` template would have been tolerated silently, and the
  rule, documented as "4 ULP", allows up to 8 ULP for values in [0.25, 0.5). The bound is now measured (§4.1).

Result: **72,388 statements: equal 71,822, order 360, float-drift 206, content 0, error 0, unsupported 0, both-error 0**
(`results/v1.3-cypher-interp/parity/`, Neo4j 5.26.24 Community tarball plus its bundled `labs/apoc-5.26.24-core.jar` in
`plugins/`, 5m11s). The `order` count moves between runs with Neo4j's node-id reuse (T1): 763 `order` in the spike's run
counted both families together. Earlier runs of this fix: on the spike's base, 315 `order` + 283 `float-drift` + 4
`content` (`averageInstability` at 5 ULP under the first bound tried, 4 ULP, which §4.1 resolves), then 66,212
statements all clean; on the merged `v1.3`, 56 `unsupported` (FF-P05's `CALL { … UNION … }`, pipeline arms only), which
the subquery support resolves. The sweep also emits FF-P05's signature-types text (`v1.3+signature`).

Columns: classes per statement; `Neo4j rows` = rows Neo4j returned; `non-empty` = statements that returned rows on
**both** engines; `p/s/l/h` = non-empty per binding (pipeline / spec / low / high); `synthetic s/l/h` = non-empty per
binding on the synthetic graphs only; `thin` = fewer than 50 non-empty (writes are never thin: they compare counters).

| template / query family | statements | projects | equal | order | float-drift | content | error | unsupported | both-error | Neo4j rows | non-empty | non-empty p/s/l/h | synthetic s/l/h | thin |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|
| abstraction-ratio | 882 | 81 | 882 | 0 | 0 | 0 | 0 | 0 | 0 | 494 | 494 | 28 / 304 / 0 / 162 | 6 / 0 / 6 |  |
| agent-reimplementation | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 24 | 12 | 0 / 4 / 4 / 4 | 4 / 4 / 4 | thin |
| aggregate-boundary | 1570 | 81 | 1570 | 0 | 0 | 0 | 0 | 0 | 0 | 434 | 326 | 2 / 128 / 128 / 68 | 8 / 8 / 8 |  |
| application-service-thin | 800 | 81 | 800 | 0 | 0 | 0 | 0 | 0 | 0 | 2076 | 548 | 2 / 190 / 298 / 58 | 4 / 4 / 0 |  |
| boundary-type-leak | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 156 | 48 | 0 / 10 / 32 / 6 | 4 / 4 / 4 | thin |
| bounded-context-modules | 800 | 81 | 800 | 0 | 0 | 0 | 0 | 0 | 0 | 176 | 158 | 2 / 62 / 62 / 32 | 0 / 0 / 0 |  |
| component-adp-cycle | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 78 | 24 | 0 / 8 / 8 / 8 | 4 / 4 / 4 | thin |
| component-instability | 1652 | 81 | 1652 | 0 | 0 | 0 | 0 | 0 | 0 | 17132 | 1055 | 103 / 360 / 592 / 0 | 12 / 12 / 0 |  |
| component-main-sequence-distance | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 130 | 50 | 0 / 4 / 42 / 4 | 4 / 4 / 4 |  |
| component-sdp-violation | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 118 | 82 | 0 / 38 / 38 / 6 | 4 / 4 / 4 |  |
| context-isolation | 1570 | 81 | 1570 | 0 | 0 | 0 | 0 | 0 | 0 | 35316 | 1252 | 4 / 492 / 492 / 264 | 12 / 12 / 12 |  |
| controller-no-entity | 2366 | 81 | 2366 | 0 | 0 | 0 | 0 | 0 | 0 | 2450 | 698 | 0 / 8 / 684 / 6 | 6 / 0 / 6 |  |
| core-isolation | 1570 | 81 | 1570 | 0 | 0 | 0 | 0 | 0 | 0 | 3154 | 482 | 6 / 188 / 188 / 100 | 12 / 12 / 12 |  |
| deep-import-declared-api | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 50 | 26 | 0 / 10 / 10 / 6 | 4 / 4 / 4 | thin |
| deep-import-inferred-api | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 30 | 18 | 0 / 6 / 6 / 6 | 4 / 4 / 4 | thin |
| dependency-direction | 1622 | 81 | 1622 | 0 | 0 | 0 | 0 | 0 | 0 | 454 | 418 | 22 / 156 / 156 / 84 | 12 / 12 / 12 |  |
| dependency-direction-graph | 1600 | 81 | 1600 | 0 | 0 | 0 | 0 | 0 | 0 | 352 | 316 | 12 / 120 / 120 / 64 | 8 / 8 / 8 |  |
| dependency-inversion | 826 | 81 | 826 | 0 | 0 | 0 | 0 | 0 | 0 | 582 | 202 | 6 / 76 / 0 / 120 | 0 / 0 / 2 |  |
| domain-event-placement | 800 | 81 | 800 | 0 | 0 | 0 | 0 | 0 | 0 | 44 | 26 | 2 / 8 / 10 / 6 | 4 / 6 / 4 | thin |
| domain-purity | 1682 | 81 | 1682 | 0 | 0 | 0 | 0 | 0 | 0 | 200 | 188 | 16 / 68 / 68 / 36 | 4 / 4 / 4 |  |
| domain-stability | 1596 | 81 | 1596 | 0 | 0 | 0 | 0 | 0 | 0 | 5238 | 598 | 6 / 0 / 592 / 0 | 0 / 12 / 0 |  |
| domain-state-purity | 856 | 81 | 856 | 0 | 0 | 0 | 0 | 0 | 0 | 578 | 172 | 6 / 66 / 66 / 34 | 2 / 2 / 2 |  |
| endpoint-bypasses-application | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 24 | 12 | 0 / 4 / 4 / 4 | 4 / 4 / 4 | thin |
| env-read-outside-config | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 24 | 12 | 0 / 4 / 4 / 4 | 4 / 4 / 4 | thin |
| framework-exception-in-core | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 24 | 12 | 0 / 4 / 4 / 4 | 4 / 4 / 4 | thin |
| hidden-coupling | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 24 | 12 | 0 / 4 / 4 / 4 | 4 / 4 / 4 | thin |
| ingest | 4212 | 81 | 4212 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 |  |
| ingest-verify | 892 | 81 | 532 | 360 | 0 | 0 | 0 | 0 | 0 | 3750 | 892 | 568 / 324 / 0 / 0 | 12 / 0 / 0 |  |
| inheritance-depth | 882 | 81 | 882 | 0 | 0 | 0 | 0 | 0 | 0 | 100 | 18 | 0 / 6 / 6 / 6 | 6 / 6 / 6 | thin |
| interface-segregation-proxy | 882 | 81 | 882 | 0 | 0 | 0 | 0 | 0 | 0 | 1312 | 244 | 0 / 2 / 240 / 2 | 2 / 2 / 2 |  |
| io-outside-adapters | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 48 | 18 | 0 / 6 / 6 / 6 | 4 / 4 / 4 | thin |
| judge-graph:classes | 385 | 81 | 385 | 0 | 0 | 0 | 0 | 0 | 0 | 7386 | 385 | 0 / 152 / 152 / 81 | 3 / 3 / 3 |  |
| judge-graph:edges | 385 | 81 | 385 | 0 | 0 | 0 | 0 | 0 | 0 | 33233 | 385 | 0 / 152 / 152 / 81 | 3 / 3 / 3 |  |
| judge-graph:files | 385 | 81 | 385 | 0 | 0 | 0 | 0 | 0 | 0 | 10775 | 385 | 0 / 152 / 152 / 81 | 3 / 3 / 3 |  |
| judge-graph:interfaces | 385 | 81 | 385 | 0 | 0 | 0 | 0 | 0 | 0 | 3685 | 370 | 0 / 147 / 147 / 76 | 0 / 0 / 0 |  |
| layer-skip-graph | 1600 | 81 | 1600 | 0 | 0 | 0 | 0 | 0 | 0 | 8424 | 746 | 6 / 292 / 292 / 156 | 12 / 12 / 12 |  |
| max-fan-in | 1652 | 81 | 1652 | 0 | 0 | 0 | 0 | 0 | 0 | 29506 | 1418 | 0 / 504 / 608 / 306 | 12 / 12 / 10 |  |
| module-domain-imports-infrastructure | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 24 | 18 | 0 / 6 / 6 / 6 | 6 / 6 / 6 | thin |
| module-fan-out | 1652 | 81 | 1652 | 0 | 0 | 0 | 0 | 0 | 0 | 25632 | 1458 | 44 / 504 / 608 / 302 | 12 / 12 / 8 |  |
| naming-controllers | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 20 | 16 | 0 / 6 / 4 / 6 | 6 / 4 / 6 | thin |
| naming-conventions | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 5626 | 490 | 0 / 126 / 296 / 68 | 6 / 6 / 6 |  |
| naming-repos | 882 | 81 | 882 | 0 | 0 | 0 | 0 | 0 | 0 | 1522 | 518 | 4 / 176 / 250 / 88 | 0 / 6 / 0 |  |
| naming-services | 856 | 81 | 856 | 0 | 0 | 0 | 0 | 0 | 0 | 584 | 182 | 0 / 0 / 182 / 0 | 0 / 6 / 0 |  |
| no-cyclic-deps | 1652 | 81 | 1652 | 0 | 0 | 0 | 0 | 0 | 0 | 226 | 178 | 10 / 64 / 64 / 40 | 12 / 12 / 12 |  |
| no-domain-outward-dep | 1596 | 81 | 1596 | 0 | 0 | 0 | 0 | 0 | 0 | 3158 | 486 | 10 / 188 / 188 / 100 | 12 / 12 / 12 |  |
| no-index-logic | 882 | 81 | 882 | 0 | 0 | 0 | 0 | 0 | 0 | 18 | 18 | 0 / 6 / 6 / 6 | 6 / 6 / 6 | thin |
| no-layer-skip | 1566 | 81 | 1566 | 0 | 0 | 0 | 0 | 0 | 0 | 19678 | 1330 | 10 / 524 / 524 / 272 | 12 / 12 / 12 |  |
| no-orphan-files | 1652 | 81 | 1652 | 0 | 0 | 0 | 0 | 0 | 0 | 210 | 48 | 0 / 16 / 16 / 16 | 12 / 12 / 12 | thin |
| nondeterminism-in-core | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 308 | 174 | 0 / 86 / 86 / 2 | 0 / 0 / 0 |  |
| port-adapter-pattern | 1570 | 81 | 1570 | 0 | 0 | 0 | 0 | 0 | 0 | 1382 | 606 | 4 / 152 / 368 / 82 | 8 / 12 / 8 |  |
| port-dependency-inversion | 800 | 81 | 800 | 0 | 0 | 0 | 0 | 0 | 0 | 578 | 198 | 2 / 76 / 0 / 120 | 0 / 0 / 2 |  |
| repository-aggregate-root | 1570 | 81 | 1570 | 0 | 0 | 0 | 0 | 0 | 0 | 106 | 58 | 2 / 20 / 20 / 16 | 12 / 12 / 12 |  |
| repository-pattern | 1596 | 81 | 1596 | 0 | 0 | 0 | 0 | 0 | 0 | 90 | 90 | 4 / 32 / 32 / 22 | 8 / 8 / 8 |  |
| single-responsibility-proxy | 882 | 81 | 882 | 0 | 0 | 0 | 0 | 0 | 0 | 5000 | 398 | 0 / 64 / 300 / 34 | 0 / 6 / 0 |  |
| test-file-pairing | 882 | 81 | 882 | 0 | 0 | 0 | 0 | 0 | 0 | 23368 | 858 | 112 / 296 / 296 / 154 | 6 / 6 / 6 |  |
| undeclared-async-coupling | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 66 | 18 | 0 / 6 / 6 / 6 | 4 / 4 / 4 | thin |
| universal-literal:averageInstability | 456 | 81 | 351 | 0 | 105 | 0 | 0 | 0 | 0 | 456 | 456 | 71 / 152 / 152 / 81 | 3 / 3 / 3 |  |
| universal-literal:cyclicDependencyCount | 456 | 81 | 456 | 0 | 0 | 0 | 0 | 0 | 0 | 456 | 456 | 71 / 152 / 152 / 81 | 3 / 3 / 3 |  |
| universal-literal:maxFanIn | 456 | 81 | 456 | 0 | 0 | 0 | 0 | 0 | 0 | 456 | 456 | 71 / 152 / 152 / 81 | 3 / 3 / 3 |  |
| universal-literal:maxFanOut | 456 | 81 | 456 | 0 | 0 | 0 | 0 | 0 | 0 | 456 | 456 | 71 / 152 / 152 / 81 | 3 / 3 / 3 |  |
| universal-literal:orphanFileCount | 456 | 81 | 456 | 0 | 0 | 0 | 0 | 0 | 0 | 456 | 456 | 71 / 152 / 152 / 81 | 3 / 3 / 3 |  |
| universal:abstractionRatio | 912 | 81 | 912 | 0 | 0 | 0 | 0 | 0 | 0 | 912 | 912 | 142 / 304 / 304 / 162 | 6 / 6 / 6 |  |
| universal:averageInstability | 456 | 81 | 355 | 0 | 101 | 0 | 0 | 0 | 0 | 456 | 456 | 71 / 152 / 152 / 81 | 3 / 3 / 3 |  |
| universal:cyclicDependencyCount | 456 | 81 | 456 | 0 | 0 | 0 | 0 | 0 | 0 | 456 | 456 | 71 / 152 / 152 / 81 | 3 / 3 / 3 |  |
| universal:maxFanIn | 456 | 81 | 456 | 0 | 0 | 0 | 0 | 0 | 0 | 456 | 456 | 71 / 152 / 152 / 81 | 3 / 3 / 3 |  |
| universal:maxFanOut | 456 | 81 | 456 | 0 | 0 | 0 | 0 | 0 | 0 | 456 | 456 | 71 / 152 / 152 / 81 | 3 / 3 / 3 |  |
| universal:orphanFileCount | 456 | 81 | 456 | 0 | 0 | 0 | 0 | 0 | 0 | 456 | 456 | 71 / 152 / 152 / 81 | 3 / 3 / 3 |  |
| untested-component | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 24 | 12 | 0 / 4 / 4 / 4 | 4 / 4 / 4 | thin |
| use-case-isolation | 1596 | 81 | 1596 | 0 | 0 | 0 | 0 | 0 | 0 | 76 | 76 | 4 / 28 / 28 / 16 | 4 / 4 / 4 |  |
| value-object-immutability | 800 | 81 | 800 | 0 | 0 | 0 | 0 | 0 | 0 | 2224 | 306 | 4 / 6 / 292 / 4 | 2 / 6 / 2 |  |
| vendor-sdk-outside-adapters | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 30 | 12 | 0 / 4 / 4 / 4 | 4 / 4 / 4 | thin |

Every catalogue template is `equal` on every statement. `order` is only the ingestion verification `n.type, count(*)` /
`type(r), count(*)` (360: group order follows Neo4j's label-scan order, T1; the pipeline reads them into a map).
`float-drift` is only `averageInstability` in both universal-metric sets (206). Files: `parity.md`,
`parity-by-template.json` (classes and coverage per template, timings per project and phase), `parity-nonequal.json`
(every statement not `equal`, with its detail), `parity-float-drift.json` (both values of every drifting cell),
`avg-order-spread.json` (§4.1).

### 4.1 The float-drift bound

`scripts/v1.3/cypher-interp-avg-order.ts` takes the graph where the largest drift occurred
(`hexagonal/v11-domain-model-cycle`, APG v2 graph, 30 averaged values), reads `averageInstability` and the same values
through `collect()` on each engine, and folds 300,000 seeded random permutations of them through Neo4j's incremental
mean. Result (`results/v1.3-cypher-interp/parity/avg-order-spread.json`): the interpreter's `avg` and every one of
Neo4j's (three ingestions) equal the fold of that engine's own row order; the permutations give 11 distinct doubles,
-2..+8 ULP around the interpreter's answer (an unseeded run gave -3..+9); Neo4j returned 0, +3, +4 and +5 ULP for this
graph on different ingestions. So the drift is accumulation order only, and the spread on this graph alone exceeds 4
ULP. The bound is 16 ULP (≈ 3.6e-15 relative here); observed drift: 1 ULP × 98 cells, 2 × 75, 3 × 27, 4 × 2, 5 × 4.

### 4.2 Coverage and the thin templates

A parity that only compares empty results proves little, so the harness reports, per template, how many statements
returned rows on both engines, per binding. The first run of this fix found 14 catalogue templates under 50:
`boundary-type-leak` 36, `component-adp-cycle` 12, `component-main-sequence-distance` 38, `deep-import-declared-api`
14, `deep-import-inferred-api` 6, `domain-event-placement` 14, `inheritance-depth` 6, `io-outside-adapters` 6,
`module-domain-imports-infrastructure` 6, `naming-controllers` 4, `no-index-logic` 6, `no-orphan-files` 24,
`repository-aggregate-root` 34, `undeclared-async-coupling` 6. They read shapes the reference projects rarely have (APG
v2 components, channels, I/O categories, deep imports, decorators, inheritance chains).

`synthetic/thin-a` and `synthetic/thin-b` (`thinTemplateProject`) are APGs, ingested by the real `ingestAPG`, on which
each of the 14 returns rows under each of the three sweep bindings (≥ 4 non-empty statements per template per binding
on the synthetic graphs; asserted by the order-guard test); they also give `aggregate-boundary` and
`dependency-direction-graph` their first synthetic rows. One value is deliberately outside the extractor's range:
component `Shipping` has `distance` 2.5 (the extractor's is in [0, 1]) so that `component-main-sequence-distance`
returns a row under the `high` binding (threshold 2). Their aggregates are given explicitly and do not overlap.

The seven `cheap2` templates read facts no persistence unit writes yet (edges `THROWS`, `REACHES`, `READS_ENV`,
`CO_CHANGES_WITH`, `REIMPLEMENTS`; virtual nodes `EntryPoint`, `EnvKey`, `ErrorType`; node facts `cheap.<key>`), so they
return no rows on any real graph. The thin graphs carry such facts in the layout `cheap2-templates.ts` specifies: node
facts as APG node properties through `ingestAPG`, the rest written by `writeCheapFacts` with the ingester's own
statement shapes (`UNWIND $batch … CREATE (n:APGNode:<Kind>) SET n = node`, and the edge form), which Neo4j runs and the
interpreter's adapter applies, so both engines receive identical writes.

After the re-run, 2 of the 14 are above 50 (`component-main-sequence-distance` 50, `repository-aggregate-root` 58); 12
stay **thin** (16-48 non-empty), as do the 7 `cheap2` templates (12 each), and are flagged in the table and in "What may be claimed". Not thin, but with a binding
that never returns rows (by the binding's meaning): `abstraction-ratio`, `dependency-inversion`,
`port-dependency-inversion` (low), `domain-stability`, `naming-services` (spec, high), `component-instability` (high).

### 4.3 Reference set: byte identity, scores and universal metrics

`ue-baseline-live --keep-cli` writes, besides `raw/` (the findings the reference comparison reads), `evidence/` (every
column of every violation) and `report.*`, the CLI's whole JSON result per variant under `cli/`, without the run-volatile
`runId`, `durationMs`, `executionTimeMs` and `timings`, and with the temporary project path replaced by `<project>`.
The interpreter's run is committed (`results/v1.3-cypher-interp/ue-baseline-live/`), as is a Neo4j control run of the
same command (`results/v1.3-cypher-interp/neo4j-control/`). `scripts/v1.3/cypher-interp-compare-runs.ts` compares them:

| check | identical |
|---|---:|
| bytes: `raw/` + `report.json` + `report.md`, interp vs Neo4j control | 73/73 |
| bytes: interp vs `results/v1.3-reference/after-member-facts` | 73/73 |
| bytes: Neo4j control vs `after-member-facts` | 73/73 |
| evidence violations, every column (`elapsedMs` aside) | 71/71 |
| CLI: `ahsDeterministic` / `tiers.blockingAhs` / verdicts | 71/71 each |
| CLI: per-dimension scores / universal metrics / tiers | 71/71 each |
| CLI: function execution and results / graph stats / violations / warnings | 71/71 each |
| CLI: the whole result | 71/71 |

The CLI rounds the universal metrics to 3 decimals, so T2 cannot show there; the unrounded values are compared by the
parity harness (§4, `universal:*`). Wall time: 2m54.5s (interp), 3m18.8s (Neo4j control).

### 4.4 Order guard

Downstream code reads violation rows in query order (the report formatter's top-10, the `no-cyclic-deps` cap
`ORDER BY cycle LIMIT 101`), so a template whose ORDER BY ties would let Neo4j's planner (T1) and unstable Top-N (T8)
pick the surviving rows. `tests/unit/cypher-interp/template-order.test.ts` asserts, for every catalogue template in
every compiled text (54 templates, 150 texts): the query ends in `RETURN … ORDER BY`, every key is a projected column, no SKIP; and,
running every text under the three bindings on the three synthetic graphs and the seven APG v2 fixture graphs, no two
rows share their ORDER BY key, and every template returns rows on at least one of them. The keys rely on preconditions
the extractor guarantees and the test states: one edge per (source, target, type) between two files, single class
inheritance, and, for `aggregate-boundary` and `repository-aggregate-root`, aggregates whose `innerEntities` do not
claim the same file: their rows are per aggregate but their ORDER BY is (source, target, relType), so overlapping
aggregates tie (pinned by a test). That precondition is on the spec, not on the extractor; it is recorded here, not
fixed (template text is not edited by this work).

## 5. Semantic traps found

| # | trap | what Neo4j 5.26.24 does | interpreter |
|---|---|---|---|
| T1 | row order without ORDER BY | follows the planner (it may start an expand at either end: `MATCH (a:File)-[r]->(b:File)` came back grouped by `b`) and the store (label scans by node id; after the ingestion's wipe, ids are reused, so the same graph scans in a different order run to run: verified with three re-ingestions) | creation order, deterministic. Not reproducible in general; parity classes it `order`. Every template ends in an ORDER BY whose keys are unique at the row grain (asserted, §4.4), so no template is affected |
| T2 | an aggregate over unordered rows is order-sensitive in floats | `avg` over the same graph returned `0.4556650246305418` after one ingestion and `0.45566502463054187` after another (id reuse, T1). Neo4j's own answer is history-dependent in the last bits | the fresh-database answer. Parity classes it `float-drift`, only for the two `averageInstability` texts, within 16 ULP, both values recorded (§4.1; the spike's "≤ 4 ULP" was misstated and applied to any `avg`/`sum` text). The CLI report rounds it to 3 decimals |
| T3 | `avg` is not `sum / count` | an incremental mean, `m += (x - m) / n`: 200/200 random float lists matched bit for bit; `sum/count` matched 93/200 | the incremental mean (`eval.ts` `aggState('avg')`). `sum` accumulates in row order |
| T4 | JS numbers are FLOATs | the driver packs every JS `number` as float64, so an ingested `line: 12` is stored as `12.0`, `$threshold: 3` is a FLOAT, while `count()` returns an INTEGER (a driver `Integer`) | parameters and ingested properties are FLOATs, aggregates and integer literals INTEGERs; records go back as driver `Integer`s, so downstream `String()`, `Number()` and evidence formatting see the same objects |
| T5 | grouping and DISTINCT treat `1` and `1.0` as one value | first-seen value kept (`UNWIND [1.0, 1, 2] AS x RETURN x, count(*)` → `1.0, 2` then `2, 1`); groups and DISTINCT rows in first-seen order (slotted runtime) | equivalence keys; first seen kept; insertion-ordered maps |
| T6 | `apoc.coll.indexOf` compares numerically across types | `indexOf([1, 2], 2.0)` = 1 (the first draft assumed Java `Long.equals(Double)` = false, i.e. -1; the live check caught it) | equivalence equality |
| T7 | `apoc.coll.sort(null)` | `[]`, not null; a null element raises `ProcedureCallFailed` (NullPointerException); `apoc.coll.toSet(null)` is null; `indexOf(null, x)` is -1 | the same |
| T8 | `ORDER BY … LIMIT` is not stable on ties | the Top-N operator returned tied rows in a different order from their input | stable sort: ties keep input order. No template has a tie on its full key on any graph run (§4.4), given the preconditions stated there |
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
| T20 | transaction timeout | a query past its `timeout` fails with `TransactionTimedOutClientConfiguration` | the same code, cooperatively (§3.1) |

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
- `scripts/v1.3/ue-baseline-live.ts` (`--engine`, `--keep-cli`), `scripts/v1.3/memory-parity.ts`,
  `scripts/v1.3/lib/memory-projects.ts`, `scripts/v1.3/lib/memory-sweep.ts`, `scripts/v1.3/lib/memory-bindings.ts`,
  `scripts/v1.3/cypher-interp-compare-runs.ts`, `scripts/v1.3/cypher-interp-avg-order.ts`,
  `scripts/v1.3/cypher-interp-unit-live.ts`, `scripts/v1.3/cypher-interp-mirrors.ts`, `scripts/v1.3/cypher-interp-bench.ts`
- `tests/unit/cypher-interp/` (`interpreter.test.ts`, `unsupported-and-timeout.test.ts`, `template-order.test.ts`),
  `tests/unit/scripts/memory-sweep.test.ts`
- `results/v1.3-cypher-interp/` (`parity/`, `ue-baseline-live/` with the committed interpreter outputs,
  `neo4j-control/`, `mirrors/`, `bench.md`)
- `LICENSE`, `NOTICE`, `licenses/Apache-2.0.txt`

No file under any other `results/` directory, no frozen v1.2E artefact and no template text was changed
(`git diff origin/v1.3 -- src/fitness-compiler` is empty).
