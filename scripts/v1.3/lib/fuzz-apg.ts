/**
 * Seeded random APG generator for the interpreter's differential fuzz (Docs/v1.3/cypher-interp-fuzz.md).
 *
 * `fuzzProject(seed)` is a pure function of `seed` (mulberry32; no Date, no Math.random): the same seed gives the same
 * APG and layer model on every machine, so a mismatch is reproduced from its seed alone. The graphs are adversarial on
 * purpose, the opposite of the benign shapes real projects have:
 * - nulls and missing properties everywhere (a property is absent, null, or of an unexpected type), null names on any
 *   node, null paths on the node types the layer annotator does not glob (it requires a string path on File, Class and
 *   Interface nodes, which the extractor always gives them);
 * - empty strings; unicode, astral and regex-special characters in paths, names, layer names and property values;
 * - duplicate names, duplicate paths, the odd duplicate node id and edges to ids that do not exist;
 * - self-loops; long and overlapping IMPORTS / RE_EXPORTS cycles of length 2..12 (around the templates' *2..10 bound);
 * - parallel edges of different types (and of the same type) between one pair;
 * - INTEGER (bigint, up to ±2^63-1) vs FLOAT properties (-0.0, 2.0, 1e308, 5e-324; never NaN);
 * - empty layers (declared, nothing in their directories) and files in no layer;
 * - list properties: strings, floats, integers, booleans, and empty lists.
 * Lists stay homogeneous and null-free, which is what Neo4j can store as a property.
 *
 * `shrinkCandidates` enumerates the one-step reductions the minimiser tries (drop edges, nodes, properties, layers).
 */
import type { APGEdge, APGNode, APGResult } from '../../../src/shared/types/apg.js';
import type { LayerDefinition, LayerModel } from '../../../src/shared/types/spec.js';
import { APG2_EDGE_TYPES, APG2_NODE_TYPES, EDGE_TYPES, LAYER_KINDS, NODE_TYPES, V13_EDGE_TYPES } from '../../../src/shared/types/enums.js';

export interface FuzzProject {
  readonly id: string;
  readonly seed: number;
  readonly apg: APGResult;
  readonly layerModel: LayerModel;
}

/** mulberry32: a 32-bit seeded PRNG, uniform in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Rng {
  constructor(readonly next: () => number) {}
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(xs: readonly T[]): T {
    return xs[Math.floor(this.next() * xs.length)] as T;
  }
}

const DIRS = ['src/domain', 'src/application', 'src/infrastructure', 'src/presentation', 'src/domain/sub', 'src/dömain', 'src/a.b', 'src/(x)',
  'src/[y]', 'src/$z', 'src/日本', 'src/a+b', 'src/a|b', 'src/^c', 'lib', '', 'src', 'src/ws dir', 'src/\\esc', 'scripts', 'test'];
const BASENAMES = ['index', 'A', 'B', 'Foo', 'FooService', 'FooRepository', 'FooController', 'main', 'OrderEntity', 'ünï', 'a+b', 'x*', '?',
  '😀', 'a\\b', '', '.', 'Foo.spec', 'Foo.test', 'set', 'DomainEvent', '(g)', 'a.ts'];
const EXTS = ['.ts', '.ts', '.ts', '.tsx', '.spec.ts', '.test.ts', '.js', '', '.TS'];
const NAMES = ['A', 'A', 'Foo', 'FooService', 'FooRepository', 'FooController', 'IFoo', 'IFooRepository', 'Entity', 'BaseEntity', 'AggregateRoot',
  'OrderPlacedEvent', 'DomainEvent', 'Event', 'Handler', 'GetFooUseCase', '', 'ñ', 'a.b', '.*', '(', '[', '$', '^', 'setX', 'set', 'setfoo',
  'index.ts', 'index.tsx', 'Foo.setBar', 'Foo.get', '😀', 'Ω', 'x y', 'Module', 'FooModule', 'http', 'fs', 'express', '@nestjs/common'];
const LAYER_NAMES = ['domain', 'application', 'infrastructure', 'presentation', 'core', 'dömain', '', 'a.b', 'x|y', '(p)', 'domain', 'adapters', '日本'];
const ROLES = ['', 'Entity', 'Entity, Repository', 'Service, UseCase', 'Controller', 'Adapter, Gateway', 'ñ'];
const KINDS = ['module', 'layer', 'folder', '', 'http', 'fs', 'db', 'kafka', 'event', 'MODULE', 'ñ'];

const NODE_KEYS = ['isBarrel', 'isAbstract', 'isStatic', 'decorators', 'kind', 'instability', 'abstractness', 'distance', 'typeCount', 'transport',
  'publicSurface', 'isExported', 'line', 'module', 'component', 'scope', 'innerEntities'];
const EDGE_KEYS = ['line', 'lines', 'isTypeOnly', 'viaReExport', 'reExportHop', 'field', 'parameterName', 'specifier', 'exportedNames', 'apis',
  'positions', 'inferred', 'publicSurface', 'kind', 'imports', 'component', 'publicApiDeclared', 'dynamic', 'reExportBarrels', 'transport'];
const BIG = [0n, 1n, -1n, 2n, 3n, 9007199254740993n, -9007199254740993n, 9223372036854775807n, -9223372036854775808n, 4611686018427387904n];
const FLOATS = [0, -0, 0.5, 1, 2, 3, 0.1, 0.7, -1.5, 1e308, -1e308, 5e-324, 1e20, 123456789.125, 0.30000000000000004];
const STRINGS = ['', ' ', 'a', 'A', 'ñ', '😀', '.*', '\\', "'", '"', '\n', 'Controller', 'Event', 'module', 'layer', 'true', '1', 'null', 'x y', '日本'];

/** A random property value: null, a scalar of any type, or a homogeneous list (possibly empty). */
function value(r: Rng, key: string): unknown {
  const roll = r.next();
  if (roll < 0.12) return null;
  if (roll < 0.3) return r.chance(0.5);
  if (roll < 0.45) return r.pick(BIG);
  if (roll < 0.6) return r.pick(FLOATS);
  if (roll < 0.8) return key === 'kind' ? r.pick(KINDS) : r.chance(0.5) ? r.pick(STRINGS) : r.pick(NAMES);
  const n = r.int(0, 4);
  const elem = r.int(0, 3);
  const items: unknown[] = [];
  for (let i = 0; i < n; i++) items.push(elem === 0 ? r.pick(STRINGS.concat(NAMES)) : elem === 1 ? r.pick(FLOATS) : elem === 2 ? r.pick(BIG) : r.chance(0.5));
  return items;
}

/** Properties for one node or edge: each key absent (most), null, or a random value; a plausible value half the time. */
function props(r: Rng, keys: readonly string[], plausible: (key: string) => unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (!r.chance(0.3)) continue;
    out[k] = r.chance(0.5) ? plausible(k) : value(r, k);
  }
  return out;
}

function plausibleNode(r: Rng): (k: string) => unknown {
  return (k) => {
    switch (k) {
      case 'decorators': return r.pick([[], ['Controller'], ['Injectable', 'Controller'], ['controller'], ['']]);
      case 'kind': return r.pick(KINDS);
      case 'instability': case 'abstractness': case 'distance': return r.pick([0, 0.25, 0.5, 0.75, 1, 1.0000001, 2]);
      case 'typeCount': return r.chance(0.5) ? r.pick([0, 1, 2, 3, 5]) : r.pick(BIG);
      case 'innerEntities': return r.pick([[], ['.*'], ['.*domain.*'], ['(']]);
      default: return r.chance(0.7) ? r.chance(0.5) : r.pick(STRINGS);
    }
  };
}

function plausibleEdge(r: Rng): (k: string) => unknown {
  return (k) => {
    switch (k) {
      case 'line': return r.chance(0.7) ? r.int(0, 30) : r.pick(BIG);
      case 'lines': case 'positions': return r.chance(0.2) ? [] : Array.from({ length: r.int(1, 3) }, () => r.int(0, 30));
      case 'exportedNames': case 'apis': case 'reExportBarrels': return r.chance(0.2) ? [] : Array.from({ length: r.int(1, 3) }, () => r.pick(NAMES));
      case 'kind': return r.pick(KINDS);
      case 'imports': return r.chance(0.5) ? r.int(0, 5) : r.pick(BIG);
      case 'field': case 'parameterName': case 'specifier': case 'component': case 'transport': return r.pick(NAMES.concat(STRINGS));
      default: return r.chance(0.8) ? r.chance(0.5) : r.pick(STRINGS);
    }
  };
}

const ALL_EDGE_TYPES = [...EDGE_TYPES, ...V13_EDGE_TYPES, ...APG2_EDGE_TYPES] as const;

export function fuzzProject(seed: number): FuzzProject {
  const r = new Rng(mulberry32(seed));
  // Size class: mostly small (fast, and shrinks well), sometimes medium.
  const big = r.chance(0.25);
  const scale = big ? 2 : 1;

  // Layer model: 0..5 layers, some sharing a name, some with no file in their directories (empty layers).
  const layers: LayerDefinition[] = [];
  for (let i = 0, n = r.int(0, 5); i < n; i++) {
    const dir = r.pick(DIRS);
    layers.push({
      name: r.pick(LAYER_NAMES), directories: [r.chance(0.15) ? 'nowhere/**' : `${dir === '' ? '' : `${dir}/`}**`], naming: [], role: r.pick(ROLES),
      kind: r.pick(LAYER_KINDS), kindSource: 'explicit',
    });
  }
  const layerModel: LayerModel = { layers };

  const nodes: APGNode[] = [];
  const edges: APGEdge[] = [];
  const maybeNull = (s: string): string => (r.chance(0.04) ? (null as unknown as string) : s);
  const filePaths: string[] = [];
  const nFiles = r.int(0, 14 * scale);
  for (let i = 0; i < nFiles; i++) {
    const dir = r.pick(DIRS);
    const fp = r.chance(0.12) && filePaths.length > 0 ? r.pick(filePaths) : `${dir === '' ? '' : `${dir}/`}${r.pick(BASENAMES)}${r.pick(EXTS)}`;
    filePaths.push(fp);
    const base = fp.slice(fp.lastIndexOf('/') + 1);
    nodes.push({
      id: `file:${String(i)}`, type: 'File', name: maybeNull(r.chance(0.8) ? base : r.pick(NAMES)), filePath: fp, decorators: [],
      properties: { ...props(r, NODE_KEYS, plausibleNode(r)), ...(r.chance(0.6) ? { isBarrel: r.chance(0.3) ? null : base.startsWith('index') } : {}) },
    });
  }
  const anyPath = (): string => (filePaths.length > 0 && r.chance(0.85) ? r.pick(filePaths) : `${r.pick(DIRS)}/${r.pick(BASENAMES)}.ts`);
  const counts: Record<string, number> = {
    Class: r.int(0, 8 * scale), Interface: r.int(0, 4 * scale), Method: r.int(0, 8 * scale), Function: r.int(0, 3 * scale), Package: r.int(0, 3),
    Component: r.int(0, 4), Channel: r.int(0, 3), IOCategory: r.int(0, 3),
  };
  for (const type of [...NODE_TYPES.filter((t) => t !== 'File'), ...APG2_NODE_TYPES]) {
    for (let i = 0; i < (counts[type] ?? 0); i++) {
      const name = r.pick(NAMES);
      nodes.push({
        id: r.chance(0.02) && nodes.length > 0 ? r.pick(nodes).id : `${type.toLowerCase()}:${String(i)}`, type,
        name: maybeNull(type === 'Method' && r.chance(0.6) ? `${r.pick(NAMES)}.${r.pick(['setX', 'get', 'set', 'setfoo', 'run', ''])}` : name),
        filePath: (type === 'Class' || type === 'Interface' ? (x: string): string => x : maybeNull)(type === 'Package' ? r.pick(['', name]) : type === 'Component' ? r.pick(['', ...DIRS]) : anyPath()), decorators: [],
        properties: props(r, NODE_KEYS, plausibleNode(r)),
      });
    }
  }
  const files = nodes.filter((n) => n.type === 'File');
  let eid = 0;
  const edge = (type: APGEdge['type'], s: string, t: string): void => {
    edges.push({ id: `e${String(eid++)}`, type, sourceId: s, targetId: t, properties: props(r, EDGE_KEYS, plausibleEdge(r)) });
  };
  if (nodes.length > 0) {
    for (let i = 0, n = r.int(0, Math.min(36 * scale, nodes.length * 3)); i < n; i++) {
      const roll = r.next();
      const type: APGEdge['type'] = roll < 0.35 ? r.pick(['IMPORTS', 'RE_EXPORTS'] as const) : r.pick(ALL_EDGE_TYPES);
      const fileEdge = (type === 'IMPORTS' || type === 'RE_EXPORTS') && files.length > 0 && r.chance(0.8);
      const s = (fileEdge ? r.pick(files) : r.pick(nodes)).id;
      const t = r.chance(0.08) ? s : (fileEdge && r.chance(0.9) ? r.pick(files) : r.pick(nodes)).id;
      edge(type, s, r.chance(0.02) ? 'missing:id' : t);
      const prev = edges[edges.length - 1] as APGEdge;
      // Parallel edges: another edge (another type, or the same) between the same pair, either direction.
      if (r.chance(0.15)) edge(r.chance(0.7) ? r.pick(ALL_EDGE_TYPES) : prev.type, r.chance(0.8) ? prev.sourceId : prev.targetId, r.chance(0.8) ? prev.targetId : prev.sourceId);
    }
    // Long and overlapping cycles near the *2..10 bound.
    for (let c = 0, n = files.length >= 2 ? r.int(0, 2) : 0; c < n; c++) {
      const len = r.chance(0.6) ? r.pick([9, 10, 11]) : r.int(2, 12);
      const ring: string[] = [];
      for (let i = 0; i < len; i++) ring.push(r.pick(files).id);
      for (let i = 0; i < len; i++) edge(r.chance(0.8) ? 'IMPORTS' : 'RE_EXPORTS', ring[i] as string, ring[(i + 1) % len] as string);
    }
  }
  return { id: `fuzz/${String(seed)}`, seed, apg: { nodes, edges } as unknown as APGResult, layerModel };
}

/**
 * One-step reductions of a project, largest first: halves and single items of the edges, nodes (with their edges),
 * layers, then single properties. The minimiser keeps the first that still reproduces and starts again.
 */
export function* shrinkCandidates(p: FuzzProject): Generator<FuzzProject> {
  const { nodes, edges } = p.apg as unknown as { nodes: APGNode[]; edges: APGEdge[] };
  const layers = p.layerModel.layers;
  const withApg = (ns: APGNode[], es: APGEdge[]): FuzzProject => ({ ...p, apg: { nodes: ns, edges: es } as unknown as APGResult });
  const withLayers = (ls: LayerDefinition[]): FuzzProject => ({ ...p, layerModel: { ...p.layerModel, layers: ls } });
  for (const chunk of chunks(edges.length)) yield withApg(nodes, edges.filter((_, i) => i < chunk[0] || i >= chunk[1]));
  for (const chunk of chunks(nodes.length)) {
    const keep = nodes.filter((_, i) => i < chunk[0] || i >= chunk[1]);
    const ids = new Set(keep.map((n) => n.id));
    yield withApg(keep, edges.filter((e) => ids.has(e.sourceId) && ids.has(e.targetId)));
  }
  for (let i = 0; i < layers.length; i++) yield withLayers(layers.filter((_, j) => j !== i));
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i] as APGNode;
    for (const k of Object.keys(n.properties)) {
      const { [k]: _drop, ...rest } = n.properties;
      yield withApg(nodes.map((x, j) => (j === i ? { ...x, properties: rest } : x)), edges);
    }
  }
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i] as APGEdge;
    for (const k of Object.keys(e.properties)) {
      const { [k]: _drop, ...rest } = e.properties;
      yield withApg(nodes, edges.map((x, j) => (j === i ? { ...x, properties: rest } : x)));
    }
  }
}

/** [from, to) index ranges: halves, quarters, ... down to single items. */
function chunks(n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let size = Math.max(1, Math.floor(n / 2)); ; size = Math.max(1, Math.floor(size / 2))) {
    for (let from = 0; from < n; from += size) out.push([from, Math.min(n, from + size)]);
    if (size === 1) break;
  }
  return out;
}

/** The size of a project, for reports: nodes, edges, layers. */
export function sizeOf(p: FuzzProject): string {
  const { nodes, edges } = p.apg as unknown as { nodes: unknown[]; edges: unknown[] };
  return `${String(nodes.length)} nodes, ${String(edges.length)} edges, ${String(p.layerModel.layers.length)} layers`;
}
