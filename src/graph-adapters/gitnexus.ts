import type { NormEdge, NormKind, NormNode, NormRel, NormalizedGraph } from './types.js';
import { isRec, slashPath, num, ownerIdByName, parseJson, pick, recField, arrField, field } from './util.js';

/**
 * GitNexus (abhigyanpatwari/GitNexus) knowledge-graph reader. GitNexus keeps its graph in an embedded database
 * (`CodeRelation` edges with a `type` property) and does not document a file export; this reader takes the
 * graph's in-memory shape, `{ nodes: [{ id, label, properties }], relationships: [{ sourceId, targetId, type,
 * confidence, reason }] }`, which a `MATCH` dump of the database or a one-line patch of its pipeline produces.
 * That shape is an assumption to confirm against a real index before the experiment.
 *
 * Labels read: File, Class, Interface, Function, Method, Struct (as class). Types read: DEFINES, CONTAINS,
 * HAS_METHOD, IMPORTS, CALLS, EXTENDS, IMPLEMENTS. MEMBER_OF and STEP_IN_PROCESS (community and process
 * membership) have no APG counterpart.
 */

const KINDS: Readonly<Record<string, NormKind>> = {
  file: 'file', class: 'class', struct: 'class', interface: 'interface', function: 'function', method: 'method',
};

const RELATIONS: Readonly<Record<string, NormRel>> = {
  DEFINES: 'contains', CONTAINS: 'contains', HAS_METHOD: 'contains',
  IMPORTS: 'imports', CALLS: 'calls', EXTENDS: 'extends', IMPLEMENTS: 'implements',
};

export function readGitNexus(input: unknown): NormalizedGraph {
  const doc = parseJson(input);
  const rels = isRec(doc) ? (field(doc, 'relationships') ?? field(doc, 'edges')) : undefined;
  if (!isRec(doc) || !Array.isArray(field(doc, 'nodes')) || !Array.isArray(rels)) {
    throw new Error('gitnexus graph: expected an object with "nodes" and "relationships" arrays');
  }
  const nodes: NormNode[] = [];
  for (const r of arrField(doc, 'nodes').filter(isRec)) {
    const id = pick(r, 'id');
    const label = pick(r, 'label');
    const props = recField(r, 'properties');
    const name = pick(props, 'name');
    if (id === undefined || label === undefined || name === undefined) continue;
    const kind = KINDS[label.toLowerCase()] ?? 'other';
    const path = pick(props, 'filePath');
    nodes.push({ id, kind, name, ...(path !== undefined ? { filePath: slashPath(path) } : {}) });
  }
  // A method named `Class.method`, or one with a `className` property, belongs to that class of its file.
  const withOwners = nodes.map((n): NormNode => {
    if (n.kind !== 'method' || !n.name.includes('.')) return n;
    const ownerId = ownerIdByName(nodes, n.filePath, n.name.slice(0, n.name.lastIndexOf('.')));
    return ownerId === undefined ? n : { ...n, ownerId };
  });
  const edges: NormEdge[] = [];
  for (const r of rels.filter(isRec)) {
    const source = pick(r, 'sourceId', 'source');
    const target = pick(r, 'targetId', 'target');
    const type = pick(r, 'type');
    if (source === undefined || target === undefined || type === undefined) continue;
    const confidence = num(field(r, 'confidence'));
    edges.push({ source, target, rel: RELATIONS[type] ?? 'unmapped', originalType: type, ...(confidence !== undefined ? { confidence } : {}) });
  }
  return { nodes: withOwners, edges };
}
