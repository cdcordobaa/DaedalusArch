/**
 * The interpreter's boundary (Docs/v1.3/cypher-interpreter.md §3): every construct outside the supported subset fails
 * with `CypherInterp.Unsupported` and a message naming the construct, never with a guessed answer; and the per-query
 * timeout (NFR-07, `QueryOptions.timeoutMs`) is honoured.
 */
import { DEFAULT_INTERP_QUERY_TIMEOUT_MS, MemoryGraphRepository } from '../../../src/cypher-interp/repository.js';
import { QUERY_TIMEOUT_CODE } from '../../../src/cypher-interp/eval.js';

async function rejection(cypher: string): Promise<{ code: string; message: string }> {
  const repo = new MemoryGraphRepository();
  const r = await repo.executeQuery(cypher);
  if (r.success) throw new Error(`expected ${cypher} to be rejected, got ${String(r.data.records.length)} row(s)`);
  return r.errors[0] as { code: string; message: string };
}

const UNSUPPORTED: readonly (readonly [string, string, RegExp])[] = [
  // Writes: the interpreter is read-only (the ingestion's fixed shapes aside, tested in interpreter.test.ts).
  ['MERGE', 'MERGE (n:X {id: 1}) RETURN n', /MERGE \(write clause\)/],
  ['MERGE on a relationship', 'MATCH (a), (b) MERGE (a)-[:R]->(b) RETURN a', /MERGE \(write clause\)/],
  ['SET a property', 'MATCH (n) SET n.x = 1 RETURN n', /SET \(write clause\)/],
  ['SET a label', 'MATCH (n) SET n:Y RETURN n', /SET \(write clause\)/],
  ['SET +=', 'MATCH (n) SET n += {a: 1} RETURN n', /SET \(write clause\)/],
  ['CREATE', 'CREATE (n:X) RETURN n', /CREATE \(write clause\)/],
  ['CREATE without RETURN', 'CREATE (a)-[:R]->(b)', /CREATE \(write clause\)/],
  ['DELETE', 'MATCH (n) DELETE n', /DELETE \/ DETACH DELETE \(write clause\)/],
  ['DETACH DELETE with RETURN', 'MATCH (n) DETACH DELETE n RETURN count(*) AS c', /DETACH DELETE \(write clause\)/],
  ['REMOVE', 'MATCH (n) REMOVE n.x RETURN n', /REMOVE \(write clause\)/],
  ['FOREACH', 'FOREACH (x IN [1] | CREATE (:X))', /FOREACH/],
  ['LOAD CSV', "LOAD CSV FROM 'file:///x' AS row RETURN row", /LOAD CSV/],
  // Subquery expressions.
  ['COUNT { } in RETURN', 'MATCH (n) RETURN COUNT { (n)-->() } AS c', /COUNT \{ \} subquery/],
  ['COUNT { } in WHERE', 'MATCH (n) WHERE COUNT { (n)-->() } > 1 RETURN n', /COUNT \{ \} subquery/],
  ['COLLECT { }', 'MATCH (n) RETURN COLLECT { MATCH (n)-->(m) RETURN m } AS c', /COLLECT \{ \} subquery/],
  // Map projections.
  ['map projection of properties', 'MATCH (n) RETURN n {.name, .id} AS m', /map projection/],
  ['map projection with .*', 'MATCH (n) RETURN n {.*} AS m', /map projection/],
  ['map projection with a literal entry', 'WITH {a: 1} AS m RETURN m {.a, b: 2} AS x', /map projection/],
  // Cypher 25 only (the grammar is Cypher 25, Neo4j 5.26 runs Cypher 5).
  ['|| string concatenation', "RETURN 'a' || 'b' AS x", /operator \|\|/],
  ['|| list concatenation', 'RETURN [1] || [2] AS x', /operator \|\|/],
  ['WHEN … THEN query branches', 'WHEN true THEN RETURN 1 AS x ELSE RETURN 2 AS x', /WHEN query/],
  ['NEXT', 'RETURN 1 AS x NEXT RETURN x', /NEXT/],
  ['FILTER', 'UNWIND [1, 2] AS x FILTER x > 1 RETURN x', /FILTER \(Cypher 25 only\)/],
  ['LET', 'LET x = 1 RETURN x', /LET \(Cypher 25 only\)/],
  ['comma list in a simple CASE', "RETURN CASE 1 WHEN 1, 2 THEN 'a' ELSE 'b' END AS x", /CASE WHEN with several values/],
  ['type predicate', 'MATCH (n) WHERE n.x IS :: INTEGER RETURN n', /type or normalization predicate/],
  // Java-only regular expression constructs: rejected, not approximated with a JS RegExp.
  ['possessive quantifier', "RETURN 'aa' =~ 'a++' AS x", /Java-only regular expression/],
  ['\\p{javaX} class', "RETURN 'a' =~ '\\\\p{javaLowerCase}' AS x", /Java-only regular expression/],
  ['\\Q…\\E quoting', "RETURN 'a.b' =~ '\\\\Qa.b\\\\E' AS x", /Java-only regular expression/],
  ['\\A anchor', "RETURN 'a' =~ '\\\\Aa' AS x", /Java-only regular expression/],
  ['\\Z anchor', "RETURN 'a' =~ 'a\\\\Z' AS x", /Java-only regular expression/],
  ['\\z anchor', "RETURN 'a' =~ 'a\\\\z' AS x", /Java-only regular expression/],
  ['inline flag after the start', "RETURN 'aB' =~ 'a(?i)b' AS x", /Java-only regular expression/],
  ['\\p{Lu} class (post-merge review R15)', "RETURN 'Order' =~ '\\\\p{Lu}.*' AS x", /Java-only regular expression/],
  ['\\h class', "RETURN 'a' =~ '\\\\h' AS x", /Java-only regular expression/],
  ['\\x{41} escape', "RETURN 'A' =~ '\\\\x{41}' AS x", /Java-only regular expression/],
  ['class intersection &&', "RETURN 'x' =~ '[a-z&&[^e]]' AS x", /Java-only regular expression/],
  // (?i) over non-ASCII letters is no longer rejected: v1.3's translator folds ASCII only, as Java does
  // (java-regex.test.ts, 'R15: (?i) is ASCII-only unless (?u) is given').
  // CALL: no procedure at all (the three apoc.coll functions are built-ins, not procedures); of the CALL { } subqueries
  // only the returning unit form (importing WITH allowed, merged from v1.3's npx branch) runs.
  ['CALL db.labels()', 'CALL db.labels() YIELD label RETURN label', /CALL procedure/],
  ['CALL apoc.help()', "CALL apoc.help('coll')", /CALL procedure/],
  ['CALL of an apoc.coll function name', 'CALL apoc.coll.sort([2, 1])', /CALL procedure/],
  ['CALL { } subquery ending in RETURN *', 'MATCH (n) CALL { MATCH (m) RETURN * } RETURN n', /does not end in RETURN with named columns/],
  ['scoped CALL subquery', 'MATCH (n) CALL (n) { RETURN 1 AS one } RETURN one', /scoped CALL \( \) \{ \} subquery/],
  ['OPTIONAL CALL subquery', 'OPTIONAL CALL { RETURN 1 AS one } RETURN one', /OPTIONAL CALL \{ \} subquery/],
  ['CALL subquery in transactions', 'CALL { MATCH (n) RETURN n.x AS x } IN TRANSACTIONS RETURN x', /CALL \{ \} IN TRANSACTIONS/],
  ['another APOC function', "RETURN apoc.text.join(['a'], ',') AS x", /function apoc\.text\.join\(\)/],
  ['an apoc.coll function outside the three', 'RETURN apoc.coll.sum([1, 2]) AS x', /function apoc\.coll\.sum\(\)/],
  ['a GDS function', 'RETURN gds.version() AS x', /function gds\.version\(\)/],
  // Other read forms outside the subset.
  ['UNION outside CALL { }', 'MATCH (n) RETURN n UNION MATCH (n) RETURN n', /UNION outside a CALL \{ \} subquery/],
  ['quantified path pattern', 'MATCH (a)((x)-->(y)){1,3}(b) RETURN a', /quantified path pattern/],
];

describe('cypher-interp: unsupported syntax is rejected with a clear error', () => {
  it.each(UNSUPPORTED)('%s', async (_name, cypher, message) => {
    const e = await rejection(cypher);
    expect(e.code).toBe('CypherInterp.Unsupported');
    expect(e.message).toMatch(/^cypher-interp: unsupported: /);
    expect(e.message).toMatch(message);
  });

  it('runs an uncorrelated CALL { … UNION … } subquery (the v1.3 FF-P05 rewrite) as Neo4j does', async () => {
    const repo = new MemoryGraphRepository();
    const run = async (q: string): Promise<unknown[]> => {
      const r = await repo.executeQuery(q);
      if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
      return r.data.records.map((x) => Object.values(x).map((v) => String(v)).join(','));
    };
    // Expected rows: Neo4j 5.26.24's answers to the same text.
    expect(await run('CALL { UNWIND [1, 2, 2, 1.0] AS x RETURN x UNION UNWIND [2, 3, 1] AS x RETURN x } RETURN x')).toEqual(['1', '2', '3']);
    expect(await run('CALL { UNWIND [1, 2, 2] AS x RETURN x UNION ALL UNWIND [2, 3] AS x RETURN x } RETURN x')).toEqual(['1', '2', '2', '2', '3']);
    expect(await run('CALL { RETURN 1 AS a, 2 AS b UNION RETURN 2 AS b, 1 AS a UNION RETURN 3 AS a, 4 AS b } RETURN a, b')).toEqual(['1,2', '3,4']);
    expect(await run('UNWIND [10, 20] AS o CALL { UNWIND [1, 2] AS x RETURN x UNION UNWIND [2] AS x RETURN x } RETURN o, x')).toEqual(['10,1', '10,2', '20,1', '20,2']);
    expect(await run('CALL { UNWIND [3, 1, 2] AS x RETURN x ORDER BY x DESC LIMIT 2 UNION UNWIND [5] AS x RETURN x } RETURN x ORDER BY x')).toEqual(['2', '3', '5']);
  });

  it('fails a malformed CALL { } UNION with Neo4j\'s syntax errors', async () => {
    for (const [q, msg] of [
      ['CALL { RETURN 1 AS a UNION RETURN 2 AS b } RETURN a', /same return column names/],
      ['CALL { RETURN 1 AS a UNION RETURN 2 AS a UNION ALL RETURN 3 AS a } RETURN a', /Invalid combination of UNION and UNION ALL/],
      ['WITH 1 AS a CALL { RETURN 2 AS a } RETURN a', /already declared in outer scope/],
    ] as const) {
      const e = await rejection(q);
      expect(e.code).toBe('Neo.ClientError.Statement.SyntaxError');
      expect(e.message).toMatch(msg);
    }
  });

  it('matches regexes as Java Pattern.matches: whole input under (?m), escaped backslashes are literals', async () => {
    const repo = new MemoryGraphRepository();
    // Expected values: Neo4j 5.26.24's answers.
    for (const [str, re, expected] of [
      ['a\nb', '(?m)b', false], ['a\nb', '(?m)a\nb', true], ['ab', '(?m)^ab$', true], ['\\Q', '\\\\Q', true], ['\\z', '\\\\z', true],
    ] as const) {
      const r = await repo.executeQuery('RETURN $s =~ $r AS m', { s: str, r: re });
      expect(r.success && r.data.records[0]?.m).toBe(expected);
    }
  });

  it('runs the three apoc.coll built-ins as functions', async () => {
    const repo = new MemoryGraphRepository();
    const r = await repo.executeQuery('RETURN apoc.coll.sort([2, 1]) AS a, apoc.coll.toSet([1, 1]) AS b, apoc.coll.indexOf([1, 2], 2) AS c');
    expect(r.success).toBe(true);
  });
});

describe('cypher-interp: query timeout (NFR-07)', () => {
  /** A chain of n files, each importing every later one: `[*]` enumerates exponentially many trails. */
  async function denseGraph(n: number, options?: ConstructorParameters<typeof MemoryGraphRepository>[0]): Promise<MemoryGraphRepository> {
    const repo = new MemoryGraphRepository(options);
    const nodes = Array.from({ length: n }, (_, i) => ({ id: `f${String(i)}`, type: 'File', name: `f${String(i)}` }));
    await repo.executeQuery('UNWIND $batch AS node CREATE (n:APGNode:File) SET n = node', { batch: nodes });
    const edges = nodes.flatMap((a, i) => nodes.slice(i + 1).map((b) => ({ sourceId: a.id, targetId: b.id, props: {} })));
    await repo.executeQuery('UNWIND $batch AS edge MATCH (src:APGNode {id: edge.sourceId}) MATCH (tgt:APGNode {id: edge.targetId}) CREATE (src)-[r:IMPORTS]->(tgt) SET r = edge.props', { batch: edges });
    return repo;
  }
  const EXPLOSIVE = 'MATCH p = (a:File)-[:IMPORTS*]->(b:File) RETURN count(p) AS c';

  it('aborts a query that runs past options.timeoutMs with Neo4j\'s timeout code', async () => {
    const repo = await denseGraph(40);
    const started = performance.now();
    const r = await repo.executeQuery(EXPLOSIVE, {}, { timeoutMs: 50 });
    const elapsed = performance.now() - started;
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.errors[0]?.code).toBe(QUERY_TIMEOUT_CODE);
    expect(r.errors[0]?.message).toMatch(/configured timeout of 50 ms/);
    expect(elapsed).toBeLessThan(5_000);
  });

  it('applies the repository default when the caller passes no timeout', async () => {
    const repo = await denseGraph(40, { queryTimeoutMs: 50 });
    const r = await repo.executeQuery(EXPLOSIVE);
    expect(!r.success && r.errors[0]?.code).toBe(QUERY_TIMEOUT_CODE);
  });

  it('queryTimeoutMs 0 disables the repository default (reference runs); the default is DEFAULT_INTERP_QUERY_TIMEOUT_MS', async () => {
    expect(DEFAULT_INTERP_QUERY_TIMEOUT_MS).toBe(30_000);
    const repo = await denseGraph(6, { queryTimeoutMs: 0 });
    const r = await repo.executeQuery(EXPLOSIVE);
    expect(r.success).toBe(true);
  });

  it('does not affect a query that finishes in time', async () => {
    const repo = await denseGraph(6);
    const r = await repo.executeQuery(EXPLOSIVE, {}, { timeoutMs: 10_000 });
    expect(r.success).toBe(true);
  });
});
