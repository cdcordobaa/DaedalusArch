/**
 * Regression cases for the interpreter bugs the differential fuzz found (Docs/v1.3/cypher-interp-fuzz.md §5), as data:
 * `fuzz-regressions.test.ts` runs them on the interpreter, `scripts/v1.3/cypher-interp-fuzz-live.ts` runs the same
 * graphs and queries on Neo4j 5.26.24 to confirm every expectation is Neo4j's answer. Each case is the minimised
 * reproduction of a fuzz mismatch (or the smallest graph showing the same defect).
 *
 * Rows use the canonical form of the parity harness: INTEGER `{ $int }`, FLOAT `{ $float }`, maps key-sorted.
 */

export interface CaseNode {
  readonly id: string;
  readonly label: string;
  readonly props?: Readonly<Record<string, unknown>>;
}

export interface CaseEdge {
  readonly type: string;
  readonly from: string;
  readonly to: string;
  readonly props?: Readonly<Record<string, unknown>>;
}

export interface RegressionCase {
  readonly finding: string;
  readonly title: string;
  readonly nodes: readonly CaseNode[];
  readonly edges: readonly CaseEdge[];
  readonly query: string;
  readonly params?: Readonly<Record<string, unknown>>;
  /** Canonical rows in order, or the Neo4j status code of the expected failure. */
  readonly expect: readonly unknown[] | { readonly error: string };
  /** The interpreter must answer within this many milliseconds (the enumeration the fix removes took minutes). */
  readonly withinMs?: number;
}

/** A directed clique on `n` File nodes `k0..k{n-1}` (every ordered pair, one relationship each). */
function clique(n: number, type: string, props: Record<string, unknown> = {}): { nodes: CaseNode[]; edges: CaseEdge[] } {
  const nodes = Array.from({ length: n }, (_, i) => ({ id: `k${String(i)}`, label: 'File', props: { name: `k${String(i)}.ts`, filePath: `src/k${String(i)}.ts` } }));
  const edges: CaseEdge[] = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j) edges.push({ type, from: `k${String(i)}`, to: `k${String(j)}`, props });
  return { nodes, edges };
}

const TYPE_ERROR = 'Neo.ClientError.Statement.TypeError';
const SYNTAX_ERROR = 'Neo.ClientError.Statement.SyntaxError';
const SCALARS = { nodes: [{ id: 'x', label: 'Class', props: { name: 'X', d: 0.5, s: 'ab', i: 3n, b: true, e: [] as string[] } }], edges: [] };
const STR_FLAG = { nodes: [{ id: 'f', label: 'File', props: { name: 'f.ts', s: 'yes', n: 1 } }], edges: [{ type: 'IMPORTS', from: 'f', to: 'f', props: { viaReExport: 'yes' } }] };

export const REGRESSION_CASES: readonly RegressionCase[] = [
  {
    finding: 'F1', title: 'an inline relationship WHERE that errors is no error when the MATCH WHERE rejects the row',
    ...STR_FLAG,
    query: 'MATCH (src:File)-[i:IMPORTS WHERE NOT coalesce(i.viaReExport, false)]->(tgt:File)\nWHERE src.layer IS NOT NULL\nRETURN src.name AS n',
    expect: [],
  },
  {
    finding: 'F1', title: 'the same inline WHERE errors when nothing else rejects the row',
    ...STR_FLAG,
    query: 'MATCH (src:File)-[i:IMPORTS WHERE NOT coalesce(i.viaReExport, false)]->(tgt:File)\nRETURN src.name AS n',
    expect: { error: TYPE_ERROR },
  },
  {
    finding: 'F1', title: 'an inline node WHERE that errors is no error when the MATCH WHERE rejects the row',
    ...STR_FLAG,
    query: 'MATCH (src:File WHERE NOT src.s)-[:IMPORTS]->(tgt:File)\nWHERE tgt.layer IS NOT NULL\nRETURN src.name AS n',
    expect: [],
  },
  {
    finding: 'F1', title: 'AND is false when either side is false, even if the other side errors',
    ...STR_FLAG,
    query: 'MATCH (x:File) RETURN (NOT x.s) AND false AS a, false AND (NOT x.s) AS b, (NOT x.s) AND x.n = 2 AS c',
    expect: [{ a: false, b: false, c: false }],
  },
  {
    finding: 'F1', title: 'OR is true when either side is true, even if the other side errors',
    ...STR_FLAG,
    query: 'MATCH (x:File) RETURN (NOT x.s) OR true AS a, true OR (NOT x.s) AS b',
    expect: [{ a: true, b: true }],
  },
  {
    finding: 'F1', title: 'AND with an erroring side and a true side still errors',
    ...STR_FLAG,
    query: 'MATCH (x:File) WHERE (NOT x.s) AND x.name = \'f.ts\' RETURN x.name AS n',
    expect: { error: TYPE_ERROR },
  },
  {
    finding: 'F1', title: 'a WHERE conjunct that errors is no error when another conjunct is false (WITH … WHERE)',
    ...STR_FLAG,
    query: 'MATCH (x:File) WITH x WHERE x.n / 0 = 1 AND x.missing IS NOT NULL RETURN x.name AS n',
    expect: [],
  },
  {
    finding: 'F2', title: 'ALL over a variable-length relationship list prunes the expansion (no-cyclic-deps, v1.3 edge view)',
    ...clique(8, 'IMPORTS', { viaReExport: true }),
    query: 'MATCH p = (f:File)-[_ev0:IMPORTS|RE_EXPORTS*2..10]->(f)\nWHERE ALL(_evr IN _ev0 WHERE NOT coalesce(_evr.viaReExport, false)) AND ALL(n IN nodes(p) WHERE n.filePath >= f.filePath)\nRETURN count(*) AS c',
    expect: [{ c: { $int: '0' } }],
    withinMs: 2000,
  },
  {
    finding: 'F2', title: 'ALL over nodes(p) of a one-segment path prunes the expansion',
    ...clique(9, 'IMPORTS'),
    query: 'MATCH p = (f:File)-[:IMPORTS*2..10]->(f)\nWHERE ALL(n IN nodes(p) WHERE n.name STARTS WITH \'k0\' OR n.name = \'k1.ts\') AND f.name = \'k0.ts\'\nRETURN count(*) AS c, min(length(p)) AS lo, max(length(p)) AS hi',
    expect: [{ c: { $int: '1' }, lo: { $int: '2' }, hi: { $int: '2' } }],
    withinMs: 2000,
  },
  {
    finding: 'F2', title: 'EXISTS over an unbounded variable-length pattern is a reachability test (context-isolation)',
    ...clique(9, 'RE_EXPORTS'),
    query: "MATCH (t:File {name: 'k0.ts'})\nWHERE NOT EXISTS { MATCH (api:File)-[:RE_EXPORTS*1..]->(t) WHERE api.name = 'nowhere.ts' }\n  AND EXISTS { MATCH (api:File)-[:RE_EXPORTS*1..]->(t) WHERE api.name = 'k8.ts' }\n  AND EXISTS { (t)-[:RE_EXPORTS*1..]->(t) }\nRETURN t.name AS n",
    expect: [{ n: 'k0.ts' }],
    withinMs: 2000,
  },
  {
    finding: 'F2', title: 'a pushed-down relationship filter keeps the row set (paths through a rejected relationship only are dropped)',
    nodes: [{ id: 'a', label: 'File', props: { name: 'a' } }, { id: 'b', label: 'File', props: { name: 'b' } }, { id: 'c', label: 'File', props: { name: 'c' } }],
    edges: [{ type: 'IMPORTS', from: 'a', to: 'b', props: { ok: true } }, { type: 'IMPORTS', from: 'b', to: 'c', props: { ok: false } }, { type: 'IMPORTS', from: 'b', to: 'a', props: { ok: true } }, { type: 'IMPORTS', from: 'c', to: 'a' }],
    query: 'MATCH p = (x:File)-[r:IMPORTS*1..4]->(y:File)\nWHERE ALL(e IN r WHERE e.ok)\nRETURN x.name AS x, y.name AS y, length(p) AS len\nORDER BY x, y, len',
    expect: [
      { len: { $int: '2' }, x: 'a', y: 'a' }, { len: { $int: '1' }, x: 'a', y: 'b' }, { len: { $int: '1' }, x: 'b', y: 'a' }, { len: { $int: '2' }, x: 'b', y: 'b' },
    ],
  },
  {
    finding: 'F3', title: 'a quantifier over a non-list property iterates it as a one-element list (naming-controllers)',
    ...SCALARS,
    query: "MATCH (c:Class) RETURN ANY(dec IN c.d WHERE dec = 0.5) AS a, ALL(v IN c.s WHERE v = 'ab') AS b, NONE(v IN c.i WHERE v = 1) AS c, SINGLE(v IN c.b WHERE v) AS d, ANY(dec IN c.d WHERE dec CONTAINS 'Controller') AS e",
    expect: [{ a: true, b: true, c: true, d: true, e: null }],
  },
  {
    finding: 'F3', title: 'list comprehension, reduce, IN, tail and slicing treat a non-list as a one-element list',
    ...SCALARS,
    query: "MATCH (c:Class) RETURN [v IN c.d | v * 2] AS a, [v IN c.s WHERE v = 'ab'] AS b, reduce(t = 0, v IN c.i | t + v) AS c, 1 IN c.i AS d, 'ab' IN c.s AS e, tail(c.s) AS f, c.i[1..] AS g, c.i[0..1] AS h, size(c.e) AS i",
    expect: [{ a: [{ $float: '1' }], b: ['ab'], c: { $int: '3' }, d: false, e: true, f: [], g: [], h: [{ $int: '3' }], i: { $int: '0' } }],
  },
  {
    finding: 'F3', title: 'size() of a non-list non-string is still a type error',
    ...SCALARS,
    query: 'MATCH (c:Class) RETURN size(c.i) AS a',
    expect: { error: TYPE_ERROR },
  },
  {
    finding: 'F3', title: 'head() and [i] on a non-list are still type errors',
    ...SCALARS,
    query: 'MATCH (c:Class) RETURN head(c.i) AS a',
    expect: { error: TYPE_ERROR },
  },
  {
    finding: 'F3', title: 'an operand statically known not to be a list is rejected at compile time',
    ...SCALARS,
    query: 'MATCH (c:Class) WITH c, 3 AS t RETURN 1 IN t AS a',
    expect: { error: SYNTAX_ERROR },
  },
  {
    finding: 'F3', title: 'a node variable is statically not a list',
    ...SCALARS,
    query: 'MATCH (c:Class) RETURN [v IN c | 1] AS a',
    expect: { error: SYNTAX_ERROR },
  },
  {
    finding: 'F4', title: 'the anchor is filtered by its own WHERE conjuncts before expanding (controller-no-entity, v1.3, fuzz seed 8)',
    nodes: [{ id: 'c', label: 'Class', props: { name: 'X', filePath: 'src/x.ts' } }],
    edges: [{ type: 'IMPORTS', from: 'c', to: 'c', props: { reExportHop: 'AggregateRoot' } }],
    query: "MATCH (ctrl:Class)-[_ev0:IMPORTS|CONSTRUCTOR_INJECTS*1..2]->(entity:Class)\nWHERE ALL(_evr IN _ev0 WHERE NOT coalesce(_evr.reExportHop, false)) AND ctrl.layer = $controllerLayer AND entity.layer = $domainLayer\n  AND ANY(role IN $entityRoles WHERE entity.name ENDS WITH role OR entity.name ENDS WITH role + 'Impl') \nRETURN ctrl.name AS controller, entity.name AS entity, ctrl.filePath AS filePath\nORDER BY filePath, controller, entity",
    params: { controllerLayer: null, domainLayer: null, entityRoles: [''] },
    expect: [],
  },
  {
    finding: 'F4', title: 'ALL over relationships(p) is pushed into the expansion and raises there (cyclicDependencyCount, literal view, seed 7)',
    nodes: [{ id: 'a', label: 'File', props: { name: 'a.ts', filePath: 'src/a.ts' } }, { id: 'b', label: 'File', props: { name: 'b.ts', filePath: 'src/b.ts' } }],
    edges: [{ type: 'IMPORTS', from: 'a', to: 'b', props: { viaReExport: 'layer' } }],
    query: "MATCH (f:File) WHERE EXISTS { MATCH p = (f)-[:IMPORTS|RE_EXPORTS*2..10]->(f) WHERE ALL(r IN relationships(p) WHERE NOT coalesce(r.viaReExport, false)) } RETURN count(f) AS cnt",
    expect: { error: TYPE_ERROR },
  },
  {
    finding: 'F4', title: 'a pushed node predicate is checked before a pushed relationship predicate (no-cyclic-deps, v1.3, seed 13)',
    nodes: [{ id: 'f', label: 'File', props: { name: 'main.tsx', filePath: 'src/infrastructure/main.tsx' } }, { id: 'm', label: 'Method', props: { name: 'Entity' } }],
    edges: [{ type: 'IMPORTS', from: 'f', to: 'm', props: { viaReExport: [-1n] } }],
    query: "MATCH p = (f:File)-[_ev0:IMPORTS|RE_EXPORTS*2..10]->(f)\nWHERE ALL(_evr IN _ev0 WHERE NOT coalesce(_evr.viaReExport, false)) AND ALL(n IN nodes(p) WHERE n.filePath >= f.filePath)\n  AND size(apoc.coll.toSet(nodes(p)[1..])) = length(p) \nWITH DISTINCT [n IN nodes(p) | n.filePath] AS cycle, relationships(p)[0].line AS firstLine\nWITH cycle, min(firstLine) AS line\nRETURN cycle, cycle[1] AS target, line\nORDER BY cycle\nLIMIT 101",
    expect: [],
  },
  {
    finding: 'F5', title: 'a list in a boolean position is true when non-empty (NOT coalesce(r.viaReExport, false) on a list, fuzz seed 5)',
    nodes: [{ id: 'a', label: 'File', props: { name: 'a.ts', filePath: 'src/a.ts' } }, { id: 'b', label: 'File', props: { name: 'b.ts', filePath: 'src/b.ts' } }],
    edges: [{ type: 'IMPORTS', from: 'a', to: 'b', props: { viaReExport: ['A'] } }, { type: 'IMPORTS', from: 'b', to: 'a', props: { viaReExport: [] as string[] } }],
    query: 'MATCH (f:File)-[r:IMPORTS]->(dep:File) WHERE NOT coalesce(r.viaReExport, false) RETURN f.name AS f, NOT r.viaReExport AS n, CASE WHEN r.viaReExport THEN 1 ELSE 0 END AS c, r.viaReExport AND $t AS a ORDER BY f',
    params: { t: true },
    expect: [{ a: false, c: { $int: '0' }, f: 'b.ts', n: true }],
  },
  {
    finding: 'F6', title: 'boolean literals are simplified away before evaluation (x AND true is x, x AND false is false)',
    nodes: [{ id: 'x', label: 'Class', props: { name: 'X', e: [] as string[], l: ['A'], s: 'x', d: 1.5 } }],
    edges: [],
    query: 'MATCH (x:Class) RETURN x.e AND true AS a, x.s OR false AS b, NOT NOT x.s AS c, x.s AND false AS d, x.s OR true AS e, x.d XOR false AS f, x.e AND (1 < 2) AS g, x.e AND (\'a\' = \'a\') AS h, true XOR x.e AS i',
    expect: [{ a: [], b: 'x', c: 'x', d: false, e: true, f: { $float: '1.5' }, g: [], h: false, i: true }],
  },
  {
    finding: 'F6', title: 'XOR true and a null literal are not simplified (the operand is coerced and fails)',
    nodes: [{ id: 'x', label: 'Class', props: { name: 'X', s: 'x' } }],
    edges: [],
    query: 'MATCH (x:Class) RETURN x.s AND null AS a',
    expect: { error: TYPE_ERROR },
  },
  {
    finding: 'F5', title: 'a float or string property in a boolean position is a type error, not a silently dropped row',
    nodes: [{ id: 'a', label: 'File', props: { name: 'a.ts', d: 1.5, s: 'x' } }],
    edges: [],
    query: 'MATCH (f:File) WHERE f.s RETURN f.name AS n',
    expect: { error: TYPE_ERROR },
  },
  {
    finding: 'F5', title: 'a string parameter in a boolean position is rejected when planning',
    nodes: [{ id: 'a', label: 'File', props: { name: 'a.ts' } }],
    edges: [],
    query: 'MATCH (f:File) WHERE $flag RETURN f.name AS n',
    params: { flag: 'yes' },
    expect: { error: SYNTAX_ERROR },
  },
  {
    finding: 'F7', title: 'NONE over nodes(p) is pushed into the expansion too (no-cyclic-deps, v1.3 + exclude, fuzz seed 21)',
    nodes: [
      { id: 'f3', label: 'File', props: { name: 'FooController.tsx', filePath: 'src/$z/FooController.tsx' } },
      { id: 'f5', label: 'File', props: { name: 'DomainEvent.spec.ts', filePath: 'src/^c/DomainEvent.spec.ts' } },
      { id: 'f6', label: 'File', props: { name: '.ts', filePath: 'test/.ts' } },
    ],
    edges: [{ type: 'IMPORTS', from: 'f3', to: 'f6' }, { type: 'IMPORTS', from: 'f6', to: 'f5', props: { viaReExport: 'layer' } }],
    query: "MATCH p = (f:File)-[_ev0:IMPORTS|RE_EXPORTS*2..10]->(f)\nWHERE ALL(_evr IN _ev0 WHERE NOT coalesce(_evr.viaReExport, false)) AND ALL(n IN nodes(p) WHERE n.filePath >= f.filePath)\n  AND size(apoc.coll.toSet(nodes(p)[1..])) = length(p) AND NONE(n IN nodes(p) WHERE ANY(ep IN $excludePatterns WHERE n.filePath =~ ep))\nWITH DISTINCT [n IN nodes(p) | n.filePath] AS cycle, relationships(p)[0].line AS firstLine\nWITH cycle, min(firstLine) AS line\nRETURN cycle, cycle[1] AS target, line\nORDER BY cycle\nLIMIT 101",
    params: { excludePatterns: ['.*\\.spec\\.ts$', '^__no_such_path__$'] },
    expect: [],
  },
  {
    finding: 'F8', title: 'EXISTS is true when one candidate row qualifies, even if another raises a data error (orphanFileCount, literal view, fuzz seed 21)',
    nodes: [{ id: 'a', label: 'File', props: { name: 'a.ts', isBarrel: false } }, { id: 'b', label: 'File', props: { name: 'b.ts' } }, { id: 'c', label: 'File', props: { name: 'c.ts' } }],
    edges: [{ type: 'IMPORTS', from: 'a', to: 'b', props: { viaReExport: 'Event' } }, { type: 'IMPORTS', from: 'a', to: 'c' }],
    query: "MATCH (f:File {name: 'a.ts'}) WHERE EXISTS { MATCH (f)-[r:IMPORTS|RE_EXPORTS]->(:File) WHERE NOT coalesce(r.viaReExport, false) } RETURN f.name AS n",
    expect: [{ n: 'a.ts' }],
  },
  {
    finding: 'F8', title: 'EXISTS raises the data error when no candidate row qualifies',
    nodes: [{ id: 'a', label: 'File', props: { name: 'a.ts' } }, { id: 'b', label: 'File', props: { name: 'b.ts' } }],
    edges: [{ type: 'IMPORTS', from: 'a', to: 'b', props: { viaReExport: 'Event' } }],
    query: "MATCH (f:File {name: 'a.ts'}) WHERE EXISTS { MATCH (f)-[r:IMPORTS|RE_EXPORTS]->(:File) WHERE NOT coalesce(r.viaReExport, false) } RETURN f.name AS n",
    expect: { error: TYPE_ERROR },
  },
  {
    finding: 'F9', title: 'an undefined variable is rejected when planning, even if no row ever reaches it (mutant: RETURN iname AS name)',
    nodes: [{ id: 'f', label: 'File', props: { name: 'a.ts' } }],
    edges: [],
    query: 'MATCH (f:File)-[:DECLARES]->(i:Interface) RETURN iname AS name, f.filePath AS file ORDER BY file, name',
    expect: { error: SYNTAX_ERROR },
  },
  {
    finding: 'F9', title: 'an undefined variable in ORDER BY is rejected too (mutant: ORDER BY sum, class)',
    nodes: [],
    edges: [],
    query: 'MATCH (c:Class) RETURN c.name AS class, c.filePath AS filePath ORDER BY sum, class',
    expect: { error: SYNTAX_ERROR },
  },
  {
    finding: 'F9', title: 'a function called with the wrong number of arguments is rejected when planning',
    nodes: [],
    edges: [],
    query: "MATCH (c:Class)-[:CONTAINS]->(m:Method) WHERE head(m.name, false) = false RETURN c.name AS n",
    expect: { error: SYNTAX_ERROR },
  },
  {
    finding: 'F9', title: 'a parameter map in a MATCH pattern is rejected (-[*1..$max]-> parses as one)',
    nodes: [{ id: 'f', label: 'File', props: { name: 'a.ts' } }],
    edges: [],
    query: 'MATCH (n)-[*1..$max]->(m) RETURN n',
    params: { max: 3 },
    expect: { error: SYNTAX_ERROR },
  },
];
