# v1.3: differential fuzz of the Cypher interpreter against Neo4j 5.26.24

Branch `v1.3-interp-fuzz`, 2026-10-16, cut from `origin/v1.3-cypher-interp` (PR #128; `origin/v1.3` does not contain
`src/cypher-interp`). Companion to `Docs/v1.3/cypher-interpreter.md`, whose parity run (65,254 statements, 79 real
project graphs) found no content difference. Real graphs are benign; this run feeds the interpreter graphs built to be
odd, and queries it is not meant to accept. Neo4j stays the reference engine. No template text was changed
(`git diff origin/v1.3-cypher-interp -- src/fitness-compiler src/scoring-engine src/llm-critic` is empty).

## 0. Results in one screen

| check | result |
|---|---|
| Graph fuzz, final run (seeds 1-2000, interpreter at its final state) | ⟨GRAPHS⟩ graphs, ⟨STMTS⟩ statements, ⟨ROWS⟩ Neo4j rows: **⟨OK⟩ equal**, ⟨QUIRKS⟩ documented quirks, ⟨TIMEOUTS⟩ Neo4j timeouts (not compared), **⟨MISMATCH⟩ mismatches** (§3, §6) |
| Development fuzz runs (before and between the fixes) | about 170 graphs; 34 minimised mismatches → 9 interpreter bugs (F1-F9), all fixed |
| Rejection fuzz, 3,000 queries built around unsupported constructs | ⟨REJ⟩ |
| Mutation fuzz, 3,000 random mutants of the template texts | ⟨MUT⟩ |
| Regression tests (`tests/unit/cypher-interp/fuzz-regressions.test.ts`) | 32 cases, one or more per finding; every expectation is Neo4j's live answer (`scripts/v1.3/cypher-interp-fuzz-live.ts`: 32/32) |
| Unit tests, `jest tests/unit/cypher-interp --maxWorkers=2` | 61/61 (29 existing + 32 new) |
| 71-reference byte-identity, `ue-baseline-live --engine cypher-interp` vs `results/v1.3-reference/after-member-facts` | **73/73 files identical** (raw 71, `report.json`, `report.md`), after all fixes (`results/v1.3-cypher-interp/fuzz/reference-check.json`) |
| Real-graph parity re-run (`memory-parity.ts`, 79 projects), after all fixes | 65,254 statements: **0 content, 0 error, 0 unsupported**; 797 `order`, all `ingest-verify` (T1) and `averageInstability` (T2) as in PR #128 (`results/v1.3-cypher-interp/fuzz/parity-rerun/parity.md`) |

## 1. Setup

- Neo4j 5.26.24 Community from the tarball, `labs/apoc-5.26.24-core.jar` copied to `plugins/`, as the PR #128 doc
  describes; credentials generated into a 0600 file and never printed. To double the throughput the final run used two
  instances of the same tarball (bolt 7687 and 7688; seeds 1-1000 and 1001-2000); a third (7689) replayed repros.
- `jest --maxWorkers=2` everywhere. No `.env` or secret file was read.

## 2. The generator (`scripts/v1.3/lib/fuzz-apg.ts`)

`fuzzProject(seed)` is a pure function of the seed (mulberry32, no clock, no `Math.random`): the same seed gives the
same APG and layer model anywhere, so every finding is reproducible from `seed` alone, and a minimised repro is stored
as JSON next to it. Each graph goes through the real `ingestAPG` (layer annotation, the ingestion's `UNWIND … SET n =
node` writes) on both engines, so it is exactly what the pipeline would store.

| adversarial shape | how |
|---|---|
| nulls and missing properties | every property key is absent (70 %), null, or a random value of a random type; names null on any node; paths null where the layer annotator allows it (not File/Class/Interface: see H1) |
| empty strings, unicode, regex-special characters | paths and names from pools with `''`, `ñ`, `日本`, `😀`, `.`, `*`, `+`, `?`, `(`, `[`, `$`, `^`, `|`, `\`, spaces; layer names with the same |
| duplicate names, paths and ids | small name pools; 12 % of files reuse a path; 2 % of nodes reuse an id (ingestion then creates one edge per matching pair) |
| self-loops, long and overlapping cycles | 8 % self-loops; 0-2 IMPORTS/RE_EXPORTS rings per graph, 60 % of length 9-11 (around the `*2..10` bound), nodes drawn with repetition, so rings overlap |
| parallel edges of different types | 15 % of edges get a twin between the same pair (70 % another type, either direction) |
| INTEGER vs FLOAT, large ints, NaN-free floats | `bigint` values up to ±2^63-1 (stored as INTEGER), floats `-0.0`, `2.0`, `1e308`, `5e-324`, `0.1`, never NaN |
| empty layers, files with no layer | 0-5 layers, some pointing at `nowhere/**`, some sharing a name; most files match no layer |
| list properties | string, float, integer and boolean lists, empty lists; homogeneous and null-free (what Neo4j can store) |

Size: 0-28 files, up to about 70 nodes and 70 edges; 25 % of graphs are "medium" (twice the counts). In the final run:
⟨SIZE⟩.

`shrinkCandidates` yields one-step reductions (halves down to single edges and nodes, then layers, then single
properties); the minimiser keeps the first that still gives the same verdict and repeats (greedy, 180 s budget).
Most repros end at 1-3 nodes and 1-2 edges.

## 3. The harness (`scripts/v1.3/cypher-interp-fuzz.ts`)

Per graph, **418 statements**: every catalogue template (47) in every text the compiler emits (exclude marker off/on ×
v1.2E text / v1.3 rewrites; 134 texts) under each of the parity harness's three bindings (the generic spec binding,
`low`, `high`; `lib/memory-bindings.ts`, now shared with `memory-parity.ts` so both bind identically), plus the 4
judge graph-view queries and both universal-metric sets (6 + 6). Plus the ingestion itself: every write's counters and the
4 verification reads.

Verdict per statement (`lib/fuzz-verdict.ts`), starting from the parity classes:

| verdict | meaning |
|---|---|
| `ok` | same columns, same values (INTEGER and FLOAT kept apart, `-0.0` kept), same order; or both failed with the same Neo4j status code |
| `quirk:T1-no-order-by` | same multiset, different order, and the query has no ORDER BY |
| `quirk:T8-order-by-tie` | the ORDER BY key sequence is identical and only rows tied on every key are permuted |
| `quirk:T8-limit-tie` | as above, and a literal LIMIT cut a tie group: which tied rows survive is unspecified |
| `quirk:T2-float-order` | `avg`/`sum` over unordered rows, floats within 4 ULP |
| `quirk:T20-plan-order-error` | Neo4j raised a data error the interpreter did not, **and the interpreter in strict mode raises the same code** (below) |
| `timeout` | Neo4j exceeded 3 s (dense cycle enumerations); not compared, the interpreter is not run |
| `mismatch:*` | anything else: content, order outside ties, an error on one side only, a different error code, `unsupported` |

**Strict mode** (`evalDiagnostics.strict`, diagnostics only). Whether Neo4j raises a data error often depends on its
plan: which end of a pattern it expands from, which WHERE conjunct it tests first, which row an EXISTS finds first.
The interpreter raises a data error only when no evaluation order could avoid it (F1, F8). To tell "Neo4j's plan
reached an error the interpreter legitimately skipped" from "the interpreter misses an error", the harness re-runs
the statement in strict mode: every pattern predicate is first evaluated over every relationship of its types, no
anchor pre-filter, every EXISTS row visited, every held-back error raised. If that fails with Neo4j's code, the error
is reachable in some order (T20); if not, it stays a mismatch.

`--recheck <fuzz-mismatches.jsonl>` replays every minimised repro against the current interpreter; every repro of
every run was replayed after the last fix.

## 4. Rejection fuzz

1. **Unsupported constructs** (`lib/fuzz-reject.ts`, 59 constructs): every write clause, `CALL` (procedures,
   subqueries), `UNION`, shortest paths, quantified paths, match modes, hints, `COUNT {}`/`COLLECT {}`, pattern
   comprehensions and expressions, map projections, type predicates, `split` with a list, WHERE inside a
   variable-length relationship, `stDev`/`percentile*`, 25 functions outside the subset, Java-only regex syntax, every
   Cypher-25-only form, `USE`/`EXPLAIN`/`PROFILE`/`SHOW`/`CYPHER`, `FINISH`, dynamic labels, parameters in
   variable-length bounds; each after a random valid prefix with random identifiers, literals and whitespace. Pass:
   the interpreter fails with `CypherInterp.Unsupported` or a syntax error, never rows.
2. **Mutants**: 1-3 random token mutations of a template text (deletion, duplication, swap, keyword and operator
   swaps, literal swaps, truncation, an unsupported construct spliced in), run on a fuzz graph. Whenever the
   interpreter accepts a mutant, Neo4j runs it in a READ transaction (a mutant can never write) and must return the
   same rows; when both fail, the codes are compared.

⟨REJECTION RESULTS⟩

## 5. Findings and fixes

Classified as **interpreter bug** (fixed, regression test each), **documented Neo4j quirk** (§6) or **harness bug**
(§7). Every fix was checked against live Neo4j (`cypher-interp-fuzz-live.ts`) and against the reference set.

| # | found by | minimised repro | Neo4j 5.26.24 | interpreter before | fix |
|---|---|---|---|---|---|
| F1 | graph fuzz, seed 1, dependency-direction [v1.3] | one File, a self-loop IMPORTS with `viaReExport: 'yes'`; `-[i … WHERE NOT coalesce(i.viaReExport, false)]->` with `WHERE src.layer IS NOT NULL` | no error: the null layer rejects the row first; `false AND <error>` and `<error> AND false` are false, `true OR <error>` true; in WHERE a null conjunct also stops evaluation | TypeError: evaluated the inline predicate during expansion, and AND/OR evaluated both sides eagerly | MATCH inline predicates and WHERE form one conjunction; a data error is held back with the partial match and raised only if every other conjunct is true; AND/OR raise an operand's error only when the result depends on it (`eval.ts` `predicateHolds`, `PENDING`, `tryBool`) |
| F2 | graph fuzz, seed 1, no-cyclic-deps and context-isolation | dense IMPORTS/RE_EXPORTS rings | no-cyclic-deps [v1.3] 26 ms, context-isolation 6 ms | 49 s and 11 s (enumerated every path, then filtered) | `ALL(x IN <var-length rels> WHERE …)` and `ALL(n IN nodes(p) WHERE …)` pushed into the expansion (prune at the first failing node or relationship); `EXISTS` over an unbounded directed var-length segment with no variable is a breadth-first reachability test. Rows unchanged; 49 s → 54 ms, 11 s → 14 ms |
| F3 | graph fuzz, seed 3, naming-controllers | a Class with `decorators: 0.5`; `ANY(dec IN c.decorators WHERE dec CONTAINS 'Controller')` | a non-list is a one-element list in the quantifiers, comprehensions, `reduce`, `IN`, `tail`, slicing (`ANY(d IN 0.5 WHERE d = 0.5)` true, `1 IN 3` false, `3[0..1]` `[3]`); `size`, `head`, `last`, `[i]`, APOC still fail; a statically known non-list is a compile-time SyntaxError | TypeError everywhere | `traversable()` at those sites; `typecheck.ts` rejects literal scalars, map literals and node/relationship/path variables (and aliases of them) where a list is needed |
| F4 | graph fuzz, seeds 7, 8, 13 | controller-no-entity, cyclicDependencyCount, no-cyclic-deps [v1.3] | the anchor is filtered by WHERE conjuncts it can decide (`ctrl.layer = $controllerLayer`) before expanding; `ALL(r IN relationships(p) …)` is pushed into the expansion and raises there; pushed node predicates are tested before relationship predicates | error / no error the other way round | anchor pre-filter (`matchPart`), `relationships(p)` pushdown, node-first order; a pushed predicate's data error is raised at once, as Neo4j raises it from inside the expansion |
| F5 | graph fuzz, seed 5, eight templates and metrics | an IMPORTS edge with `viaReExport: ['A']` | a list in a boolean position is true when non-empty (`NOT ['A']` false, `WHERE []` drops the row, `CASE WHEN [1]` taken); other non-booleans: runtime TypeError, but a string/integer/map parameter is rejected when planning | TypeError on lists; a non-boolean WHERE value silently dropped the row | one `predicate()` coercion for WHERE, NOT/AND/OR/XOR, CASE WHEN, quantifier and comprehension WHERE |
| F6 | live probing of F5 | `x.e AND true` with `x.e = []` | the planner simplifies before evaluating: `x AND true` → `x` (returns `[]`), `x AND false` → `false` (no error even for a string), `x OR true` → `true`, `x OR false`/`x XOR false` → `x`, `NOT NOT x` → `x`, `NOT <literal>` and comparisons of two number literals fold; strings, booleans, `IN`, `null` operands and `XOR true` do not | coerced or failed | `simplify.ts`, the same rules, applied after the static checks |
| F7 | graph fuzz, seed 21, no-cyclic-deps [v1.3+exclude] | 3 Files, a `.spec.ts` node behind a string-flag edge | `NONE(n IN nodes(p) WHERE …exclude…)` is pushed too and prunes the `.spec.ts` node first | TypeError | `NONE` pushdown (prune where the predicate is not false) |
| F8 | graph fuzz, seed 21, orphanFileCount [literal] | a File with two IMPORTS, one with a string flag | `EXISTS` is true as soon as one row qualifies | TypeError from the other row | in an existential MATCH a row's data error is held back; raised only if no row qualifies |
| F9 | mutation fuzz, 139 of 3,000 mutants | `RETURN iname AS name` (typo), `ORDER BY sum`, `head(x, false)`, `-[*1..$max]->` | rejected when planning: undefined variable, unknown function, wrong argument count, parameter map in a MATCH pattern | **returned 0 rows** whenever no row reached the bad expression (variables and functions were resolved lazily); `$max` became a property map and failed at run time | `typecheck.ts` resolves every variable through the clause scopes and every function name and arity before any row is read; unknown names are SyntaxError, functions outside the subset `CypherInterp.Unsupported`; a parameter map in a pattern is a SyntaxError |

F2 and F4 are performance and plan-order fixes as much as semantic ones; none changes a row on any real graph (the
reference set and the real-graph parity are unchanged, §0).

## 6. Documented Neo4j quirks (remaining differences)

| # | quirk | in the final run |
|---|---|---|
| T1 | row order without ORDER BY follows the planner and the store | ⟨T1⟩ |
| T2 | `avg`/`sum` over unordered rows differ in the last bits | ⟨T2⟩ |
| T8 | rows tied on every ORDER BY key come back in an unspecified order; which tied rows a LIMIT keeps is unspecified. Duplicate paths and names make full-key ties common in fuzz graphs, never in the reference projects | ⟨T8⟩ |
| T20 (new) | **plan-order data errors**: whether Neo4j raises a type error in a predicate depends on its plan (expansion direction from label statistics, conjunct order, EXISTS row order); the same template text on graphs differing in one node flips. The interpreter raises only errors no order avoids; strict mode proves each T20 error reachable | ⟨T20⟩ |
| T21 (new) | Neo4j's semantic analysis infers types beyond literals (`true + x`, `m + 1.filePath`, `toBoolean(n) / m`, `avg(node)`, `size(rel)`, a regex `=~ false`) and rejects them when planning; the interpreter checks literals, pattern variables and their aliases only, so on such a query it may return rows (when no row reaches the expression) or a runtime TypeError instead of a SyntaxError | ⟨T21⟩ |
| T22 (new) | grammar: the interpreter parses with Neo4j's Cypher 25 grammar (T18); a few Cypher 5 syntax errors parse there (`(c IS NULL:Label)`, a property after whitespace and `.`), giving rows or a different error | ⟨T22⟩ |
| timeout | Neo4j needs more than 3 s for no-cyclic-deps [v1.2e] on the densest ring graphs (the v1.2E text has no relationship predicate to push down); not compared | ⟨TIMEOUT⟩ |

## 7. Harness bugs found

| # | bug | fix |
|---|---|---|
| H1 | the generator gave File nodes a null `filePath`, which the extractor never produces; the layer annotator (picomatch) threw before any query | null paths only on node types the annotator does not glob |
| H2 | `n[$key]` was in the "unsupported" list; it is valid Cypher 5, and both engines agree on it | removed from the list |
| H3 | an empty mutant is refused by the driver before Neo4j sees it | skipped and counted |

## 8. Reproduce

```
node --import tsx scripts/v1.3/cypher-interp-fuzz.ts --from 1 --count 1000 --shrink-per 2 --out <dir>   # NEO4J_URI, NEO4J_PASSWORD set; resumable
node --import tsx scripts/v1.3/cypher-interp-fuzz.ts --from 1 --count 0 --reject 3000 --out <dir>
node --import tsx scripts/v1.3/cypher-interp-fuzz.ts --recheck <dir>/fuzz-mismatches.jsonl --out <dir>
node --import tsx scripts/v1.3/cypher-interp-fuzz-live.ts                                               # regression cases vs Neo4j
npx jest tests/unit/cypher-interp --maxWorkers=2
```

Results: `results/v1.3-cypher-interp/fuzz/` (`fuzz-summary.json` per family and verdict, `fuzz-mismatches.json` with
minimised repros, `fuzz-recheck.json`, `rejection-summary.json`, `reference-check.json`).

## 9. Files

- generator and harness: `scripts/v1.3/lib/fuzz-apg.ts`, `scripts/v1.3/lib/fuzz-verdict.ts`, `scripts/v1.3/lib/fuzz-reject.ts`,
  `scripts/v1.3/cypher-interp-fuzz.ts`, `scripts/v1.3/cypher-interp-fuzz-live.ts`, `scripts/v1.3/lib/memory-bindings.ts`
  (bindings moved out of `memory-parity.ts`, unchanged)
- interpreter: `src/cypher-interp/eval.ts`, `functions.ts` (`tail`), `parse.ts` (static checks, parameter maps),
  new `typecheck.ts`, new `simplify.ts`
- tests: `tests/unit/cypher-interp/fuzz-regressions.cases.ts`, `fuzz-regressions.test.ts`
