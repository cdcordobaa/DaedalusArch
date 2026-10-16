/**
 * Conversion between the interpreter's values and the JS values the neo4j-driver produces and accepts, so the
 * interpreter's records are indistinguishable from `Neo4jRepository`'s to every caller:
 * - parameters in: a JS `number` is a FLOAT (the driver packs every JS number as a float64), a driver `Integer` or a
 *   `bigint` is an INTEGER, a plain object is a MAP;
 * - records out: an INTEGER is a driver `Integer`, a FLOAT a JS number, a MAP a plain object, nodes, relationships and
 *   paths the driver's own classes.
 */
import neo4j from 'neo4j-driver';
import type { Integer } from 'neo4j-driver';
import { CypherMap, CypherPath, isNode, isRel } from './values.js';
import type { GraphNode, GraphRel, Value } from './values.js';
import { CypherUnsupportedError } from './parse.js';

const { Node, Relationship, Path, PathSegment } = neo4j.types;

export function fromDriver(v: unknown): Value {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean' || typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint') return v;
  if (neo4j.isInt(v)) return BigInt(v.toString());
  if (Array.isArray(v)) return v.map(fromDriver);
  if (typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    return new CypherMap(new Map(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, fromDriver(x)])));
  }
  throw new CypherUnsupportedError(`parameter value of type ${Object.prototype.toString.call(v)}`);
}

function intOf(n: number): Integer {
  return neo4j.int(n);
}

function nodeOut(n: GraphNode): InstanceType<typeof Node> {
  return new Node(intOf(n.id), [...n.labels], propsOut(n.properties), String(n.id));
}

function relOut(r: GraphRel): InstanceType<typeof Relationship> {
  return new Relationship(intOf(r.id), intOf(r.start.id), intOf(r.end.id), r.type, propsOut(r.properties), String(r.id), String(r.start.id), String(r.end.id));
}

function propsOut(p: ReadonlyMap<string, Value>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [k, v] of p) o[k] = toDriver(v);
  return o;
}

export function toDriver(v: Value): unknown {
  if (v === null || typeof v === 'boolean' || typeof v === 'string' || typeof v === 'number') return v;
  if (typeof v === 'bigint') return neo4j.int(v.toString());
  if (Array.isArray(v)) return v.map((x) => toDriver(x as Value));
  if (v instanceof CypherMap) return propsOut(v.entries);
  if (v instanceof CypherPath) {
    const segments = v.rels.map((r, i) => new PathSegment(nodeOut(v.nodes[i] as GraphNode), relOut(r), nodeOut(v.nodes[i + 1] as GraphNode)));
    return new Path(nodeOut(v.nodes[0] as GraphNode), nodeOut(v.nodes[v.nodes.length - 1] as GraphNode), segments);
  }
  if (isNode(v)) return nodeOut(v);
  if (isRel(v)) return relOut(v);
  return v;
}
