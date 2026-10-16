/**
 * Query generators for the interpreter's rejection-path fuzz (Docs/v1.3/cypher-interp-fuzz.md §4), seeded like
 * fuzz-apg.ts.
 *
 * - `rejectionQueries`: queries built around one construct outside the supported subset (§3 of
 *   cypher-interpreter.md), in random surrounding clauses, with random identifiers and literals. The interpreter must
 *   fail every one with `CypherInterp.Unsupported` or a syntax error.
 * - `mutants`: random token-level mutations of a template text (delete, duplicate, swap, operator and keyword swaps,
 *   literal swaps, truncation, an unsupported construct spliced in). Whatever the interpreter accepts is run on Neo4j
 *   too and must agree with it.
 */

type Rand = () => number;

const pick = <T>(r: Rand, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)] as T;

const VARS = ['n', 'f', 'x', 'node', 'ä', '`odd name`'];
const LITS = ['1', '0', '-1', '2.5', "'a'", "''", 'null', 'true', '[]', '[1, 2]', "['a', null]", '{a: 1}'];

/** Each entry: construct name → builder (v = a variable name, l = a literal, r = the seeded random source). */
const CONSTRUCTS: readonly [string, (v: string, l: string, r: Rand) => string][] = [
  ['CREATE', (v, l) => `CREATE (${v}:X {p: ${l}}) RETURN ${v}`],
  ['MERGE', (v) => `MERGE (${v}:File {id: 'zz'}) RETURN ${v}`],
  ['SET', (v, l) => `MATCH (${v}) SET ${v}.p = ${l} RETURN ${v}`],
  ['SET +=', (v) => `MATCH (${v}) SET ${v} += {p: 1} RETURN count(*)`],
  ['DELETE', (v) => `MATCH (${v}) DELETE ${v}`],
  ['DETACH DELETE (other shape)', (v) => `MATCH (${v}:File) DETACH DELETE ${v}`],
  ['REMOVE', (v) => `MATCH (${v}) REMOVE ${v}.name RETURN ${v}`],
  ['FOREACH', (v, l) => `FOREACH (${v} IN [${l}] | CREATE (:X))`],
  ['LOAD CSV', (v) => `LOAD CSV FROM 'file:///x.csv' AS ${v} RETURN ${v}`],
  ['CALL procedure', (_v, _l, r) => pick(r, ['CALL db.labels()', 'CALL db.labels() YIELD label RETURN label', 'CALL dbms.components()'])],
  // A returning `CALL { ... RETURN ... }` is in the subset since v1.3-npx (#135); a unit subquery without RETURN is not.
  ['CALL unit subquery without RETURN', (v) => `MATCH (${v}) CALL { WITH ${v} MATCH (${v})-->(m) } RETURN ${v}`],
  ['CALL subquery (scoped)', (v) => `MATCH (${v}) CALL (${v}) { RETURN 1 AS one } RETURN one`],
  ['UNION', (v) => `MATCH (${v}:File) RETURN ${v}.name AS a UNION MATCH (${v}:Class) RETURN ${v}.name AS a`],
  ['UNION ALL', (v, l) => `RETURN ${l} AS ${v} UNION ALL RETURN ${l} AS ${v}`],
  ['shortestPath', (v) => `MATCH p = shortestPath((${v}:File)-[*]-(m:File)) RETURN p`],
  ['allShortestPaths', (v) => `MATCH p = allShortestPaths((${v})-[*..3]->(m)) RETURN length(p)`],
  ['quantified path pattern', (v) => `MATCH (${v}:File) ((a)-[:IMPORTS]->(b)){1,3} (m:File) RETURN ${v}`],
  ['quantified relationship', (v) => `MATCH (${v}:File)-[:IMPORTS]->{1,3}(m) RETURN ${v}`],
  ['match mode', (v) => `MATCH REPEATABLE ELEMENTS (${v})-->(m) RETURN ${v}`],
  ['path selector', (v) => `MATCH ANY SHORTEST (${v}:File)-[:IMPORTS]->+(m) RETURN ${v}`],
  ['hint', (v) => `MATCH (${v}:File) USING INDEX ${v}:File(id) WHERE ${v}.id = 'x' RETURN ${v}`],
  ['COUNT subquery', (v) => `MATCH (${v}) RETURN COUNT { (${v})-->() } AS c`],
  ['COLLECT subquery', (v) => `MATCH (${v}) RETURN COLLECT { MATCH (${v})-->(m) RETURN m.name } AS c`],
  ['pattern comprehension', (v) => `MATCH (${v}:File) RETURN [(${v})-->(m) | m.name] AS c`],
  ['pattern expression', (v) => `MATCH (${v}:File) WHERE (${v})-->() RETURN ${v}.name`],
  ['map projection', (v) => `MATCH (${v}) RETURN ${v} {.name, .filePath} AS m`],
  ['map projection (all)', (v) => `MATCH (${v}) RETURN ${v} {.*} AS m`],
  ['type predicate', (v, l) => `WITH ${l} AS ${v} RETURN ${v} IS :: INTEGER AS t`],
  ['split with list', (v) => `WITH 'a,b;c' AS ${v} RETURN split(${v}, [',', ';']) AS s`],
  ['WHERE in variable-length', (v) => `MATCH (${v})-[r* WHERE r.line > 0]->(m) RETURN ${v}`],
  ['stDev', (v) => `MATCH (${v}) RETURN stDev(${v}.line) AS s`],
  ['percentileCont', (v) => `MATCH (${v}) RETURN percentileCont(${v}.line, 0.5) AS s`],
  ['percentileDisc', (v) => `UNWIND [1, 2] AS ${v} RETURN percentileDisc(${v}, 0.5) AS s`],
  ['unknown function', (v, l, r) => `WITH ${l} AS ${v} RETURN ${pick(r, ['foo', 'elementId', 'date', 'datetime', 'point', 'randomUUID', 'rand', 'timestamp', 'exp', 'log', 'round', 'properties', 'valueType', 'isNaN', 'nullIf', 'atan2', 'char_length', 'normalize', 'btrim', 'toStringOrNull', 'toIntegerList', 'apoc.text.join', 'apoc.coll.sum', 'apoc.map.merge', 'exists'])}(${v}) AS y`],
  ['Java regex inline flag mid-pattern', (v) => `WITH 'aB' AS ${v} RETURN ${v} =~ 'a(?i)b' AS m`],
  ['Java regex possessive', (v) => `WITH 'aa' AS ${v} RETURN ${v} =~ 'a++' AS m`],
  ['Java regex \\p{javaX}', (v) => `WITH 'a' AS ${v} RETURN ${v} =~ '\\\\p{javaLowerCase}' AS m`],
  ['Java regex \\Q..\\E', (v) => `WITH 'a.b' AS ${v} RETURN ${v} =~ 'a\\\\Q.\\\\Eb' AS m`],
  ['Java regex \\A \\Z \\z', (v, _l, r) => `WITH 'ab' AS ${v} RETURN ${v} =~ '${pick(r, ['\\\\Aab', 'ab\\\\Z', 'ab\\\\z'])}' AS m`],
  ['Cypher 25 ||', (v) => `WITH 'a' AS ${v} RETURN ${v} || 'b' AS s`],
  ['Cypher 25 FILTER', (v) => `MATCH (${v}) FILTER ${v}.name IS NOT NULL RETURN ${v}`],
  ['Cypher 25 LET', (v, l) => `LET ${v} = ${l} RETURN ${v}`],
  ['Cypher 25 NEXT', (v, l) => `RETURN ${l} AS ${v} NEXT RETURN ${v}`],
  ['Cypher 25 WHEN', (v, l) => `WHEN true THEN RETURN ${l} AS ${v}`],
  ['simple CASE comma list', (v) => `WITH 1 AS ${v} RETURN CASE ${v} WHEN 1, 2 THEN 'x' ELSE 'y' END AS c`],
  ['USE', (v) => `USE neo4j MATCH (${v}) RETURN count(${v})`],
  ['EXPLAIN', (v) => `EXPLAIN MATCH (${v}) RETURN ${v}`],
  ['PROFILE', (v) => `PROFILE MATCH (${v}) RETURN ${v}`],
  ['SHOW', (_v, _l, r) => pick(r, ['SHOW INDEXES', 'SHOW FUNCTIONS', 'SHOW DATABASES'])],
  ['CYPHER prefix', (v) => `CYPHER 5 MATCH (${v}) RETURN count(${v})`],
  ['OPTIONAL CALL', (v) => `OPTIONAL CALL { RETURN 1 AS ${v} } RETURN ${v}`],
  ['FINISH', (v) => `MATCH (${v}) FINISH`],
  ['parameter in variable-length bound', (v) => `MATCH (${v})-[*1..$max]->(m) RETURN ${v}`],
  ['CREATE INDEX (other shape)', () => `CREATE INDEX other FOR (n:File) ON (n.name)`],
  ['DROP INDEX', () => `DROP INDEX apg_node_id IF EXISTS`],
  ['dynamic label', (v) => `MATCH (${v}:$('File')) RETURN ${v}`],
  ['label expression in WHERE with dynamic', (v) => `MATCH (${v}) WHERE ${v}:$($labels) RETURN ${v}`],
  ['CALL apoc procedure', (v) => `CALL apoc.help('coll') YIELD name RETURN name AS ${v}`],
  ['ORDER BY standalone', (v) => `MATCH (${v}) ORDER BY ${v}.name RETURN ${v}`],
];

export interface RejectionQuery {
  readonly construct: string;
  readonly text: string;
  readonly params: Record<string, unknown>;
}

/** n queries cycling through the constructs, each with a random variable, literal and optional leading clause. */
export function rejectionQueries(n: number, r: Rand): RejectionQuery[] {
  const out: RejectionQuery[] = [];
  for (let i = 0; i < n; i++) {
    const [construct, build] = CONSTRUCTS[i % CONSTRUCTS.length] as (typeof CONSTRUCTS)[number];
    const v = pick(r, VARS);
    let text = build(v, pick(r, LITS), r);
    // A leading supported clause half the time (the construct then sits after a valid prefix), and odd whitespace.
    if (r() < 0.5 && !/^(USE|EXPLAIN|PROFILE|SHOW|CYPHER|WHEN|CREATE INDEX|DROP)/.test(text)) text = `${pick(r, ['WITH 1 AS one', 'MATCH (zz:File)', 'OPTIONAL MATCH (zz)', 'UNWIND [1, 2] AS one'])} ${text.startsWith('MATCH') || text.startsWith('WITH') ? '' : 'WITH *'} ${text}`;
    if (r() < 0.3) text = text.replace(/ /g, () => pick(r, [' ', '\n', '  ', '\t']));
    out.push({ construct, text, params: { max: 3, key: 'name', labels: 'File' } });
  }
  return out;
}

const TOKEN_RE = /\s+|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`[^`]*`|\$?[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\.\.|->|<-|<>|<=|>=|=~|\S/g;

const SWAPS: readonly (readonly string[])[] = [
  ['MATCH', 'OPTIONAL MATCH'], ['WITH', 'RETURN', 'WITH DISTINCT', 'RETURN DISTINCT'], ['AND', 'OR', 'XOR'], ['=', '<>', '<', '>', '<=', '>=', '=~'],
  ['->', '-', '<-'], ['ASC', 'DESC'], ['count', 'collect', 'min', 'max', 'sum', 'avg', 'size', 'head', 'last'], ['toFloat', 'toInteger', 'toString', 'toBoolean'],
  ['+', '-', '*', '/', '%', '^'], ['IS', 'IS NOT'], ['NULL', 'NOT NULL'], ['ALL', 'ANY', 'NONE', 'SINGLE'], ['STARTS', 'ENDS'], ['CONTAINS', 'STARTS WITH', 'ENDS WITH', 'IN'],
  ['true', 'false', 'null'], ['File', 'Class', 'Interface', 'Method', 'APGNode', 'Component'], ['IMPORTS', 'RE_EXPORTS', 'EXTENDS', 'DEPENDS_ON'],
  ['nodes', 'relationships'], ['coalesce', 'head', 'last'], ['NOT', ''], ['DISTINCT', ''],
];
const LIT_SWAPS = ['0', '1', '-1', '2', '10', '1.5', '-0.0', '9223372036854775807', 'null', "''", "'x'", '[]', '[null]', "['a', 1]", '{}', 'NaN'];

/** One to three random mutations of `text`. */
export function mutants(text: string, r: Rand): string {
  let toks: string[] = [...(text.match(TOKEN_RE) ?? [text])];
  const n = 1 + Math.floor(r() * 3);
  for (let k = 0; k < n; k++) {
    const sig = toks.map((t, i) => [t, i] as const).filter(([t]) => !/^\s+$/.test(t)).map(([, i]) => i);
    if (sig.length === 0) break;
    const i = pick(r, sig);
    const t = toks[i] as string;
    const roll = r();
    if (roll < 0.12) toks = toks.filter((_, j) => j !== i);
    else if (roll < 0.2) toks.splice(i, 0, t, ' ');
    else if (roll < 0.28) {
      const j = pick(r, sig);
      const tj = toks[j] as string;
      toks[j] = t;
      toks[i] = tj;
    } else if (roll < 0.62) {
      const group = SWAPS.find((g) => g.includes(t));
      if (group !== undefined) toks[i] = pick(r, group);
      else if (/^\d/.test(t) || /^'/.test(t)) toks[i] = pick(r, LIT_SWAPS);
      else toks[i] = pick(r, SWAPS.flat());
    } else if (roll < 0.8) {
      if (/^\d/.test(t) || /^'/.test(t) || t === 'null' || t === 'true' || t === 'false') toks[i] = pick(r, LIT_SWAPS);
      else toks.splice(i, 0, pick(r, ['NOT ', '-', 'DISTINCT ', '[0]', '.name', '[1..]', ' IS NULL', ' + 1', '*', '(', ')', ',', 'AND true ']));
    } else if (roll < 0.9) {
      toks = toks.slice(0, i);
    } else {
      const [, build] = pick(r, CONSTRUCTS);
      toks.splice(i, 0, ` ${build('q', pick(r, LITS), r)} `);
    }
  }
  return toks.join('');
}
