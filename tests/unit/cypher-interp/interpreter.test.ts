/**
 * Semantics of the in-process Cypher interpreter (src/cypher-interp; Docs/v1.3/cypher-interpreter.md). Expected values
 * are Neo4j 5.26.24's answers to the same text (checked live while building the interpreter).
 */
import neo4j from 'neo4j-driver';
import { MemoryGraphRepository } from '../../../src/cypher-interp/repository.js';
import { parseCypher, CypherSyntaxError, CypherUnsupportedError } from '../../../src/cypher-interp/parse.js';
import { javaDoubleToString } from '../../../src/cypher-interp/values.js';

type Rec = Record<string, unknown>;

/** Driver values → plain JSON (Integer → `{int}`) so INTEGER vs FLOAT stays visible in assertions. */
function plain(v: unknown): unknown {
  if (neo4j.isInt(v)) return { int: (v as { toNumber(): number }).toNumber() };
  if (Array.isArray(v)) return v.map(plain);
  if (v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    return Object.fromEntries(Object.entries(v as Rec).map(([k, x]) => [k, plain(x)]));
  }
  return v;
}

async function rows(repo: MemoryGraphRepository, cypher: string, params: Rec = {}): Promise<Rec[]> {
  const r = await repo.executeQuery(cypher, params);
  if (!r.success) throw new Error(r.errors.map((e) => `${e.code}: ${e.message}`).join('; '));
  return r.data.records.map((x) => plain(x) as Rec);
}

async function failure(repo: MemoryGraphRepository, cypher: string, params: Rec = {}): Promise<{ code: string; message: string }> {
  const r = await repo.executeQuery(cypher, params);
  if (r.success) throw new Error('expected a failure');
  return r.errors[0] as { code: string; message: string };
}

/** p1 -> p2, p1 -> p3, p1 -> p4, p2 -> p1, p5 -> p1 (IMPORTS); p1 -> p5, p3 -> p1 (RE_EXPORTS); classes on p1. */
async function sampleGraph(): Promise<MemoryGraphRepository> {
  const repo = new MemoryGraphRepository();
  const node = 'UNWIND $batch AS node\n      CREATE (n:APGNode:File)\n      SET n = node\n    ';
  const files = [1, 2, 3, 4, 5].map((i) => ({ id: `f${String(i)}`, type: 'File', name: `p${String(i)}.ts`, filePath: `src/p${String(i)}.ts`, layer: i <= 2 ? 'domain' : i === 5 ? null : 'infrastructure', isBarrel: false }));
  expect((await repo.executeQuery(node, { batch: files })).success).toBe(true);
  const cls = 'UNWIND $batch AS node\n      CREATE (n:APGNode:Class)\n      SET n = node\n    ';
  await repo.executeQuery(cls, { batch: [{ id: 'c1', type: 'Class', name: 'A', filePath: 'src/p1.ts' }, { id: 'c2', type: 'Class', name: 'B', filePath: 'src/p1.ts' }, { id: 'c3', type: 'Class', name: 'C', filePath: 'src/p2.ts' }] });
  const edge = (type: string): string => `
      UNWIND $batch AS edge
      MATCH (src:APGNode {id: edge.sourceId})
      MATCH (tgt:APGNode {id: edge.targetId})
      CREATE (src)-[r:${type}]->(tgt)
      SET r = edge.props
    `;
  const imports = [[1, 2, 1], [1, 3, 2], [1, 4, 3], [2, 1, 4], [5, 1, 5]].map(([s, t, k]) => ({ sourceId: `f${String(s)}`, targetId: `f${String(t)}`, props: { id: `e${String(k)}`, line: k } }));
  const r1 = await repo.executeQuery(edge('IMPORTS'), { batch: imports });
  expect(r1.success && r1.data.summary.counters.relationshipsCreated).toBe(5);
  await repo.executeQuery(edge('RE_EXPORTS'), { batch: [{ sourceId: 'f1', targetId: 'f5', props: { id: 'e6', line: 6 } }, { sourceId: 'f3', targetId: 'f1', props: { id: 'e7', line: 7 } }] });
  await repo.executeQuery(edge('EXTENDS'), { batch: [{ sourceId: 'c1', targetId: 'c2', props: { id: 'x1' } }, { sourceId: 'c2', targetId: 'c3', props: { id: 'x2' } }] });
  return repo;
}

describe('cypher-interp: parsing', () => {
  it('rejects invalid Cypher with a syntax error', () => {
    expect(() => parseCypher('MATCH (n WHERE RETURN n')).toThrow(CypherSyntaxError);
  });
  it('rejects valid Cypher outside the subset instead of guessing', () => {
    expect(() => parseCypher('MATCH (n) RETURN n UNION MATCH (m) RETURN m AS n')).toThrow(CypherUnsupportedError);
    expect(() => parseCypher('CREATE (n:X) RETURN n')).toThrow(CypherUnsupportedError);
    expect(() => parseCypher('CALL db.labels() YIELD label RETURN label')).toThrow(CypherUnsupportedError);
    expect(() => parseCypher('MATCH (a)((x)-->(y)){1,3}(b) RETURN a')).toThrow(CypherUnsupportedError);
  });
  it('rejects an unknown function at run time with the unsupported code', async () => {
    const repo = new MemoryGraphRepository();
    expect((await failure(repo, 'RETURN gds.similarity.cosine([1], [1]) AS x')).code).toBe('CypherInterp.Unsupported');
  });
});

describe('cypher-interp: three-valued logic and null', () => {
  const repo = new MemoryGraphRepository();
  it('propagates null through comparison, IN and boolean operators', async () => {
    const [r] = await rows(repo, `RETURN null = null AS a, null <> 1 AS b, [1, null] = [1, null] AS c, [1, 2] = [1, null, 3] AS d,
      null IN [1] AS e, 2 IN [1, null] AS f, 1 IN [1, null] AS g, true AND null AS h, false AND null AS i, true OR null AS j,
      NOT null AS k, null IS NULL AS l, 1 < 'a' AS m, null STARTS WITH 'a' AS n`);
    expect(r).toEqual({ a: null, b: null, c: null, d: false, e: null, f: null, g: true, h: null, i: false, j: true, k: null, l: true, m: null, n: null });
  });
  it('keeps only rows whose WHERE is true (null filters out)', async () => {
    const g = await sampleGraph();
    expect(await rows(g, 'MATCH (f:File) WHERE f.layer <> \'domain\' RETURN f.name AS n ORDER BY n')).toEqual([{ n: 'p3.ts' }, { n: 'p4.ts' }]);
    expect(await rows(g, 'MATCH (f:File) WHERE NOT f.missing RETURN count(*) AS c')).toEqual([{ c: { int: 0 } }]);
  });
  it('evaluates ALL/ANY/NONE/SINGLE with nulls as Neo4j does', async () => {
    const [r] = await rows(repo, 'RETURN ALL(x IN [1, null] WHERE x > 0) AS a, ANY(x IN [null, 2] WHERE x > 1) AS b, NONE(x IN [null] WHERE x > 1) AS c, SINGLE(x IN [1, 2] WHERE x > 0) AS d, ALL(x IN [] WHERE false) AS e');
    expect(r).toEqual({ a: null, b: true, c: null, d: false, e: true });
  });
});

describe('cypher-interp: numbers', () => {
  const repo = new MemoryGraphRepository();
  it('keeps INTEGER and FLOAT apart and divides like Java', async () => {
    const [r] = await rows(repo, 'RETURN 7 / 2 AS a, -7 / 2 AS b, -7 % 2 AS c, 2 ^ 2 AS d, 1 + 2.0 AS e, toFloat(3) / 2 AS f, toInteger(12.7) AS g, toInteger(\'12.7\') AS h, 1 = 1.0 AS i');
    expect(r).toEqual({ a: { int: 3 }, b: { int: -3 }, c: { int: -1 }, d: 4, e: 3, f: 1.5, g: { int: 12 }, h: { int: 12 }, i: true });
  });
  it('treats a JS number parameter as a FLOAT, as the driver does', async () => {
    const [r] = await rows(repo, 'RETURN $x AS x, $x + 1 AS y, $i + 1 AS z', { x: 3, i: neo4j.int(3) });
    expect(r).toEqual({ x: 3, y: 4, z: { int: 4 } });
  });
  it('fails integer division by zero', async () => {
    expect((await failure(repo, 'RETURN 1 / 0 AS x')).code).toBe('Neo.ClientError.Statement.ArithmeticError');
  });
  it('renders floats in strings like Java', async () => {
    const [r] = await rows(repo, 'RETURN toString(1.0) AS a, \'x\' + 1.0 AS b, toString(1e20) AS c, toString(0.1 + 0.2) AS d');
    expect(r).toEqual({ a: '1.0', b: 'x1.0', c: '1.0E20', d: '0.30000000000000004' });
    expect(javaDoubleToString(1e-5)).toBe('1.0E-5');
  });
});

describe('cypher-interp: aggregation', () => {
  const repo = new MemoryGraphRepository();
  it('groups implicitly by the non-aggregate items, in first-seen order, 1 and 1.0 in one group', async () => {
    expect(await rows(repo, 'UNWIND [1.0, 1, 2] AS x RETURN x, count(*) AS c')).toEqual([{ x: 1, c: { int: 2 } }, { x: { int: 2 }, c: { int: 1 } }]);
    expect(await rows(repo, "UNWIND ['b', 'a', 'b'] AS t RETURN t, count(*) AS c")).toEqual([{ t: 'b', c: { int: 2 } }, { t: 'a', c: { int: 1 } }]);
  });
  it('returns one row for a global aggregate over no rows, none for a grouped one', async () => {
    expect(await rows(repo, 'UNWIND [] AS x RETURN count(x) AS c, collect(x) AS l, min(x) AS m, avg(x) AS a, sum(x) AS s')).toEqual([{ c: { int: 0 }, l: [], m: null, a: null, s: { int: 0 } }]);
    expect(await rows(repo, 'UNWIND [] AS x RETURN x, count(*) AS c')).toEqual([]);
  });
  it('skips nulls and supports DISTINCT inside count and collect', async () => {
    const [r] = await rows(repo, 'UNWIND [1, null, 1, 2] AS x RETURN count(x) AS c, count(DISTINCT x) AS d, collect(DISTINCT x) AS l, count(*) AS s');
    expect(r).toEqual({ c: { int: 3 }, d: { int: 2 }, l: [{ int: 1 }, { int: 2 }], s: { int: 4 } });
  });
  it('computes avg as Neo4j\'s incremental mean, not sum / count', async () => {
    const xs = [0.1, 0.7, 0.3333333333333333, 0.6666666666666666, 0.2, 0.9, 0.125, 0.55, 0.45, 0.123456789];
    const [r] = await rows(repo, 'UNWIND $xs AS x RETURN avg(x) AS a, sum(x) AS s', { xs });
    expect(r?.a).toBe(0.41484567889999996); // Neo4j 5.26.24; sum / count gives 0.4148456789
    expect(r?.s).toBe(4.148456789);
  });
  it('orders min/max across types by orderability', async () => {
    expect(await rows(repo, "UNWIND [1, 'a', 2.0] AS x RETURN min(x) AS mn, max(x) AS mx")).toEqual([{ mn: 'a', mx: 2 }]);
  });
  it('evaluates expressions over aggregates and grouping keys', async () => {
    const g = await sampleGraph();
    expect(await rows(g, `MATCH (f:File) OPTIONAL MATCH (f)-[:IMPORTS]->(o:File)
      WITH f, count(DISTINCT o) AS fo WHERE fo > 0 RETURN f.name AS n, toFloat(fo) / 3 AS r ORDER BY n`)).toEqual([
      { n: 'p1.ts', r: 1 }, { n: 'p2.ts', r: 1 / 3 }, { n: 'p5.ts', r: 1 / 3 },
    ]);
  });
});

describe('cypher-interp: ordering and DISTINCT', () => {
  const repo = new MemoryGraphRepository();
  it('sorts by Neo4j orderability: map < list < string < boolean < number < null', async () => {
    const r = await rows(repo, "UNWIND [1, 'a', null, 2.5, [1], true, {a: 1}, [0, 1], -1] AS x RETURN x ORDER BY x");
    expect(r.map((x) => x.x)).toEqual([{ a: { int: 1 } }, [{ int: 0 }, { int: 1 }], [{ int: 1 }], 'a', true, { int: -1 }, { int: 1 }, 2.5, null]);
  });
  it('puts null first when descending and limits after ordering (ties are unordered in Neo4j: none here)', async () => {
    const r = await rows(repo, 'UNWIND [[2, \'b\'], [null, \'n\'], [3, \'a\'], [1, \'c\']] AS p RETURN p[0] AS k, p[1] AS v ORDER BY k DESC LIMIT 3');
    expect(r).toEqual([{ k: null, v: 'n' }, { k: { int: 3 }, v: 'a' }, { k: { int: 2 }, v: 'b' }]);
  });
  it('deduplicates lists with DISTINCT and orders lists lexicographically', async () => {
    const r = await rows(repo, 'UNWIND [[1, 2], [1], [1, 2], [0, 9]] AS l RETURN DISTINCT l ORDER BY l');
    expect(r).toEqual([{ l: [{ int: 0 }, { int: 9 }] }, { l: [{ int: 1 }] }, { l: [{ int: 1 }, { int: 2 }] }]);
  });
  it('lets ORDER BY read a variable that is not projected (no aggregation)', async () => {
    const g = await sampleGraph();
    expect(await rows(g, 'MATCH (f:File) RETURN f.name AS n ORDER BY f.filePath DESC LIMIT 2')).toEqual([{ n: 'p5.ts' }, { n: 'p4.ts' }]);
  });
});

describe('cypher-interp: patterns', () => {
  it('matches type alternatives, both directions and inline WHERE', async () => {
    const g = await sampleGraph();
    expect(await rows(g, 'MATCH (a:File)-[r:IMPORTS|RE_EXPORTS]->(b:File) WHERE a.name = \'p1.ts\' RETURN type(r) AS t, b.name AS b ORDER BY b, t')).toEqual([
      { t: 'IMPORTS', b: 'p2.ts' }, { t: 'IMPORTS', b: 'p3.ts' }, { t: 'IMPORTS', b: 'p4.ts' }, { t: 'RE_EXPORTS', b: 'p5.ts' },
    ]);
    expect(await rows(g, 'MATCH (f:File {name: \'p1.ts\'})<-[i:IMPORTS WHERE i.line > 4]-(x) RETURN x.name AS x')).toEqual([{ x: 'p5.ts' }]);
    expect(await rows(g, 'MATCH (f:File {name: \'p4.ts\'})-[:IMPORTS]-(x) RETURN x.name AS x')).toEqual([{ x: 'p1.ts' }]);
  });
  it('binds variable-length paths with nodes(), relationships(), length() and slicing', async () => {
    const g = await sampleGraph();
    const r = await rows(g, `MATCH p = (f:File)-[:IMPORTS|RE_EXPORTS*2..10]->(f)
      WHERE ALL(n IN nodes(p) WHERE n.filePath >= f.filePath) AND size(apoc.coll.toSet(nodes(p)[1..])) = length(p)
      WITH DISTINCT [n IN nodes(p) | n.filePath] AS cycle, relationships(p)[0].line AS firstLine
      WITH cycle, min(firstLine) AS line
      RETURN cycle, cycle[1] AS target, line ORDER BY cycle LIMIT 101`);
    expect(r).toEqual([
      { cycle: ['src/p1.ts', 'src/p2.ts', 'src/p1.ts'], target: 'src/p2.ts', line: 1 },
      { cycle: ['src/p1.ts', 'src/p3.ts', 'src/p1.ts'], target: 'src/p3.ts', line: 2 },
      { cycle: ['src/p1.ts', 'src/p5.ts', 'src/p1.ts'], target: 'src/p5.ts', line: 6 },
    ]);
  });
  it('never uses one relationship twice in a MATCH (relationship isomorphism)', async () => {
    const g = await sampleGraph();
    // p4 has one relationship: the undirected 2-hop pattern cannot walk it out and back.
    expect(await rows(g, "MATCH (a:File {name: 'p4.ts'})-[:IMPORTS]-(b)-[:IMPORTS]-(c) RETURN c.name AS c ORDER BY c")).toEqual([
      { c: 'p2.ts' }, { c: 'p2.ts' }, { c: 'p3.ts' }, { c: 'p5.ts' },
    ]);
    expect(await rows(g, 'MATCH (c:Class)-[:EXTENDS*]->(b) RETURN c.name AS c, b.name AS b ORDER BY c, b')).toEqual([
      { c: 'A', b: 'B' }, { c: 'A', b: 'C' }, { c: 'B', b: 'C' },
    ]);
  });
  it('evaluates EXISTS subqueries with outer variables, and OPTIONAL MATCH nulls', async () => {
    const g = await sampleGraph();
    expect(await rows(g, 'MATCH (f:File) WHERE NOT EXISTS { MATCH (f)-[:IMPORTS|RE_EXPORTS]->(:File) } RETURN f.name AS n ORDER BY n')).toEqual([{ n: 'p4.ts' }]);
    expect(await rows(g, 'MATCH (f:File) WHERE EXISTS { (f)-[:IMPORTS|RE_EXPORTS*2..10]->(f) } RETURN count(f) AS c')).toEqual([{ c: { int: 4 } }]);
    expect(await rows(g, "MATCH (f:File {name: 'p4.ts'}) OPTIONAL MATCH (f)-[:IMPORTS]->(o:File) RETURN f.name AS f, o.name AS o, o AS node")).toEqual([{ f: 'p4.ts', o: null, node: null }]);
  });
  // v1.3 npx branch: CALL { } subqueries (FF-P05's signature-types text on v1.3). Not re-checked live (no Neo4j where
  // this was written): expected values follow the Neo4j 5.26 manual (UNION = distinct, UNION ALL keeps duplicates,
  // importing WITH, no rebinding of an outer variable). Re-run scripts/v1.3/cypher-interp-unit-live.ts with Neo4j.
  it('runs CALL { ... UNION ... } subqueries: distinct union, UNION ALL, per outer row, importing WITH', async () => {
    const g = await sampleGraph();
    expect(await rows(g, `CALL {
        MATCH (a:File)-[:IMPORTS]->(b:File) WHERE a.name = 'p1.ts' RETURN b.name AS n
        UNION
        MATCH (a:File)-[:RE_EXPORTS]->(b:File) RETURN b.name AS n
      }
      RETURN n ORDER BY n`)).toEqual([{ n: 'p1.ts' }, { n: 'p2.ts' }, { n: 'p3.ts' }, { n: 'p4.ts' }, { n: 'p5.ts' }]);
    expect(await rows(g, `CALL { MATCH (a:File)-[:IMPORTS]->(:File {name: 'p1.ts'}) RETURN a.name AS n UNION ALL MATCH (a:File)-[:IMPORTS]->(:File {name: 'p1.ts'}) RETURN a.name AS n }
      RETURN n, count(*) AS c ORDER BY n`)).toEqual([{ n: 'p2.ts', c: { int: 2 } }, { n: 'p5.ts', c: { int: 2 } }]);
    expect(await rows(g, `MATCH (f:File) WHERE f.layer = 'domain'
      CALL { WITH f MATCH (f)-[:IMPORTS]->(t:File) RETURN count(t) AS out }
      RETURN f.name AS f, out ORDER BY f`)).toEqual([{ f: 'p1.ts', out: { int: 3 } }, { f: 'p2.ts', out: { int: 1 } }]);
    expect(await rows(g, `CALL { MATCH (n:Nothing) RETURN n.x AS x UNION MATCH (n:Nothing) RETURN n.x AS x } RETURN x`)).toEqual([]);
  });
  it('rejects the CALL forms outside the subset and the errors Neo4j raises', async () => {
    const g = await sampleGraph();
    expect(() => parseCypher('CALL { MATCH (n) RETURN n } IN TRANSACTIONS RETURN n')).toThrow(CypherUnsupportedError);
    expect(() => parseCypher('MATCH (f) CALL (f) { MATCH (f)-->(x) RETURN x } RETURN x')).toThrow(CypherUnsupportedError);
    expect(() => parseCypher('OPTIONAL CALL { MATCH (n) RETURN n } RETURN n')).toThrow(CypherUnsupportedError);
    expect(() => parseCypher('CALL { MATCH (n) RETURN n AS a UNION ALL MATCH (n) RETURN n AS a UNION MATCH (n) RETURN n AS a } RETURN a')).toThrow(CypherSyntaxError);
    expect((await failure(g, 'CALL { MATCH (n:File) RETURN n.name AS a UNION MATCH (n:File) RETURN n.name AS b } RETURN a')).code).toBe('Neo.ClientError.Statement.SyntaxError');
    expect((await failure(g, 'MATCH (a:File) CALL { MATCH (x:File) RETURN x AS a } RETURN a')).code).toBe('Neo.ClientError.Statement.SyntaxError');
  });
  it('counts per label and type like the ingestion verification', async () => {
    const g = await sampleGraph();
    expect(await rows(g, 'MATCH (n:APGNode) RETURN n.type AS type, count(*) AS cnt')).toEqual([{ type: 'File', cnt: { int: 5 } }, { type: 'Class', cnt: { int: 3 } }]);
    expect(await rows(g, 'MATCH ()-[r]->() RETURN count(r) AS cnt')).toEqual([{ cnt: { int: 9 } }]);
  });
});

describe('cypher-interp: functions', () => {
  const repo = new MemoryGraphRepository();
  it('implements the string and list built-ins', async () => {
    const [r] = await rows(repo, `RETURN split('a.b.', '.') AS a, substring('hello', 1, 2) AS b, left('ab', 5) AS c, replace('a.ts.ts', '.ts', '.spec.ts') AS d,
      last(split('A.setX', '.')) AS e, head([]) AS f, tail([1]) AS g, [1, 2, 3][-1] AS h, [1, 2, 3][5] AS i, [1, 2, 3][-2..] AS j,
      reduce(s = 0, x IN [1, 2, 3] | s + x) AS k, [x IN [1, 2, 3] WHERE x > 1 | x * 10] AS l, coalesce(null, 'z') AS m, size('ab') AS n,
      CASE 'IMPORTS' WHEN 'IMPORTS' THEN 'imports' ELSE 're-exports' END AS o, 'Repo' =~ 'Re.*' AS p, 'aRepo' =~ 'Re.*' AS q`);
    expect(r).toEqual({
      a: ['a', 'b', ''], b: 'el', c: 'ab', d: 'a.spec.ts.spec.ts', e: 'setX', f: null, g: [], h: { int: 3 }, i: null, j: [{ int: 2 }, { int: 3 }],
      k: { int: 6 }, l: [{ int: 20 }, { int: 30 }], m: 'z', n: { int: 2 }, o: 'imports', p: true, q: false,
    });
  });
  it('implements the APOC collection functions with APOC 5.26 semantics', async () => {
    const [r] = await rows(repo, "RETURN apoc.coll.indexOf([1, 2], 2.0) AS a, apoc.coll.indexOf(null, 1) AS b, apoc.coll.indexOf(['x', 'y'], 'y') AS c, apoc.coll.toSet([1, 1.0, 2, null]) AS d, apoc.coll.sort(['b', 'a']) AS e, apoc.coll.sort(null) AS f");
    expect(r).toEqual({ a: { int: 1 }, b: { int: -1 }, c: { int: 1 }, d: [{ int: 1 }, { int: 2 }, null], e: ['a', 'b'], f: [] });
    expect((await failure(repo, "RETURN apoc.coll.sort(['b', null]) AS x")).code).toBe('Neo.ClientError.Procedure.ProcedureCallFailed');
  });
  it('fails on a missing parameter', async () => {
    expect((await failure(repo, 'RETURN $nope AS x')).code).toBe('Neo.ClientError.Statement.ParameterMissing');
  });
});

describe('cypher-interp: ingestion adapter', () => {
  it('drops null properties, skips edges to unknown ids and wipes on DETACH DELETE', async () => {
    const g = await sampleGraph();
    expect(await rows(g, "MATCH (f:File {name: 'p5.ts'}) RETURN f.layer AS l, f.isBarrel AS b")).toEqual([{ l: null, b: false }]);
    const edge = `
      UNWIND $batch AS edge
      MATCH (src:APGNode {id: edge.sourceId})
      MATCH (tgt:APGNode {id: edge.targetId})
      CREATE (src)-[r:CALLS]->(tgt)
      SET r = edge.props
    `;
    const r = await g.executeQuery(edge, { batch: [{ sourceId: 'f1', targetId: 'nope', props: { id: 'z' } }] });
    expect(r.success && r.data.summary.counters.relationshipsCreated).toBe(0);
    expect((await g.clearGraph()).success).toBe(true);
    expect(await rows(g, 'MATCH (n) RETURN count(n) AS c')).toEqual([{ c: { int: 0 } }]);
  });
});
