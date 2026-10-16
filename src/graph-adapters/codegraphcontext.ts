import type { NormEdge, NormKind, NormNode, NormRel, NormalizedGraph } from './types.js';
import { isRec, slashPath, num, ownerIdByName, parseLine, pick, strList, recField, field } from './util.js';
import type { Rec } from './util.js';

/**
 * CodeGraphContext (CodeGraphContext/CodeGraphContext) `.cgc` bundle reader. A bundle is a ZIP of
 * `nodes.jsonl` (`_id`, `_labels`, `name`, `path`, `line_number`, ...) and `edges.jsonl`
 * (`from`, `to`, `type`, `properties`). Unzipping is the caller's job; this reader takes the two JSONL texts.
 *
 * Labels read: File, Class, Interface, Function, Module (an import target, named by its specifier), plus the
 * structural Repository / Directory / Variable, which have no APG node. Types read: CONTAINS, IMPORTS, CALLS,
 * INHERITS. Methods are Function nodes carrying a class context (`class_context`, or `context` with
 * `context_type: "class"`), or the target of a Class CONTAINS edge.
 */

const KINDS: Readonly<Record<string, NormKind>> = {
  file: 'file', class: 'class', interface: 'interface', function: 'function', module: 'package',
};

const RELATIONS: Readonly<Record<string, NormRel>> = {
  CONTAINS: 'contains', IMPORTS: 'imports', CALLS: 'calls', INHERITS: 'inherits', IMPLEMENTS: 'implements',
};

function parseJsonl(text: string): Rec[] {
  return text.split('\n').map((l) => l.trim()).filter((l) => l !== '').map((l) => JSON.parse(l) as unknown).filter(isRec);
}

export function readCodeGraphContext(nodesJsonl: string, edgesJsonl: string): NormalizedGraph {
  const nodes: NormNode[] = [];
  for (const r of parseJsonl(nodesJsonl)) {
    const id = pick(r, '_id', 'id');
    const name = pick(r, 'name');
    if (id === undefined || name === undefined) continue;
    const label = strList(field(r, '_labels')).map((l) => l.toLowerCase()).find((l) => l in KINDS);
    const kind = label === undefined ? 'other' : KINDS[label] ?? 'other';
    const path = pick(r, 'path');
    nodes.push({
      id, kind, name,
      ...(path !== undefined && kind !== 'package' ? { filePath: slashPath(path) } : {}),
      ...(strList(field(r, 'decorators')).length > 0 ? { decorators: strList(field(r, 'decorators')) } : {}),
    });
  }
  // Methods: a Function with a class context is a method of that class in the same file.
  const classContext = new Map<string, string>();
  for (const r of parseJsonl(nodesJsonl)) {
    const id = pick(r, '_id', 'id');
    const ctx = pick(r, 'class_context') ?? (pick(r, 'context_type') === 'class' ? pick(r, 'context') : undefined);
    if (id !== undefined && ctx !== undefined) classContext.set(id, ctx);
  }
  const resolved = nodes.map((n): NormNode => {
    const ctx = classContext.get(n.id);
    if (n.kind !== 'function' || ctx === undefined) return n;
    const ownerId = ownerIdByName(nodes, n.filePath, ctx);
    return { ...n, kind: 'method', name: `${ctx}.${n.name}`, ...(ownerId !== undefined ? { ownerId } : {}) };
  });
  const edges: NormEdge[] = [];
  for (const r of parseJsonl(edgesJsonl)) {
    const source = pick(r, 'from');
    const target = pick(r, 'to');
    const type = pick(r, 'type');
    if (source === undefined || target === undefined || type === undefined) continue;
    const props = recField(r, 'properties');
    const line = parseLine(field(props, 'line_number')) ?? num(field(props, 'line'));
    edges.push({ source, target, rel: RELATIONS[type] ?? 'unmapped', originalType: type, ...(line !== undefined ? { line } : {}) });
  }
  return { nodes: resolved, edges };
}
