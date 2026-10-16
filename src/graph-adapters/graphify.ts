import type { NormEdge, NormKind, NormNode, NormRel, NormalizedGraph } from './types.js';
import { baseName, isRec, slashPath, parseJson, parseLine, pick, str, num, arrField, field } from './util.js';
import type { Rec } from './util.js';

/**
 * graphify (safishamsi/graphify) export readers: `graphify-out/graph.json` (networkx node-link data, edges under
 * `links`; `edges` accepted) and the `to_graphml` export (the same attributes as GraphML `<data>`).
 *
 * Node attributes read: `id`, `label`, `file_type`, `source_file`, `source_location` ("L42") and, when a
 * producer adds one, `kind` / `node_type`. Edge attributes read: `source`, `target`, `relation`,
 * `confidence` (EXTRACTED | INFERRED | AMBIGUOUS) and `confidence_score`. graphify's TypeScript extraction is
 * generic tree-sitter extraction: it has no interface node kind and no implements relation.
 */

const EXPLICIT_KINDS: Readonly<Record<string, NormKind>> = {
  file: 'file', module: 'file', class: 'class', interface: 'interface', function: 'function', method: 'method',
};

const RELATIONS: Readonly<Record<string, NormRel>> = {
  imports: 'imports', imports_from: 'imports', import: 'imports',
  calls: 'calls',
  inherits: 'inherits', extends: 'extends', implements: 'implements',
  contains: 'contains', method: 'contains', defines: 'contains', declares: 'contains',
};

const CONFIDENCE: Readonly<Record<string, number>> = { EXTRACTED: 1, INFERRED: 0.5, AMBIGUOUS: 0.2 };

function nodeKind(r: Rec, label: string, sourceFile: string | undefined): NormKind {
  const explicit = (pick(r, 'kind', 'node_type') ?? '').toLowerCase();
  const mapped = EXPLICIT_KINDS[explicit];
  if (mapped !== undefined) return mapped;
  if (sourceFile === undefined) return 'other';
  if (label === baseName(sourceFile)) return 'file';
  if (label.endsWith('()')) return label.startsWith('.') ? 'method' : 'function';
  return (str(field(r, 'file_type')) ?? 'code') === 'code' ? 'class' : 'other';
}

function cleanName(label: string): string {
  return label.replace(/^\./, '').replace(/\(\)$/, '');
}

export function normalizeGraphifyRecords(nodeRecs: readonly Rec[], linkRecs: readonly Rec[]): NormalizedGraph {
  const nodes: NormNode[] = [];
  for (const r of nodeRecs) {
    const id = pick(r, 'id');
    const label = pick(r, 'label') ?? id;
    if (id === undefined || label === undefined) continue;
    const sourceFile = pick(r, 'source_file');
    const kind = nodeKind(r, label, sourceFile);
    const filePath = sourceFile === undefined ? undefined : slashPath(sourceFile);
    nodes.push({ id, kind, name: kind === 'file' ? baseName(label) : cleanName(label), ...(filePath !== undefined ? { filePath } : {}) });
  }
  const edges: NormEdge[] = [];
  for (const r of linkRecs) {
    const source = pick(r, 'source');
    const target = pick(r, 'target');
    if (source === undefined || target === undefined) continue;
    const relation = (pick(r, 'relation') ?? '').toLowerCase();
    const confidence = num(field(r, 'confidence_score')) ?? CONFIDENCE[pick(r, 'confidence') ?? ''];
    const line = parseLine(field(r, 'source_location'));
    edges.push({
      source, target, rel: RELATIONS[relation] ?? 'unmapped', originalType: relation,
      ...(line !== undefined ? { line } : {}), ...(confidence !== undefined ? { confidence } : {}),
    });
  }
  return { nodes, edges };
}

export function readGraphifyJson(input: unknown): NormalizedGraph {
  const doc = parseJson(input);
  if (!isRec(doc) || !Array.isArray(field(doc, 'nodes'))) throw new Error('graphify graph.json: expected an object with a "nodes" array');
  const links = Array.isArray(field(doc, 'links')) ? arrField(doc, 'links') : arrField(doc, 'edges');
  return normalizeGraphifyRecords(arrField(doc, 'nodes').filter(isRec), links.filter(isRec));
}

// ── GraphML ──────────────────────────────────────────────────────────────────────────────────────────────

const ENTITIES: Readonly<Record<string, string>> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };

function unescapeXml(s: string): string {
  return s.replace(/&(?:amp|lt|gt|quot|apos);/g, (m) => ENTITIES[m] ?? m);
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    const k = m[1];
    if (k !== undefined) out[k] = unescapeXml(m[2] ?? m[3] ?? '');
  }
  return out;
}

/** Minimal GraphML reader for the shape `networkx.write_graphml` writes: `<key>`, `<node>`, `<edge>`, `<data>`. */
export function readGraphifyGraphml(xml: string): NormalizedGraph {
  const keyName = new Map<string, string>();
  for (const m of xml.matchAll(/<key\b([^>]*?)\/?>/g)) {
    const a = attrs(m[1] ?? '');
    const id = field(a, 'id');
    if (id !== undefined) keyName.set(id, field(a, 'attr.name') ?? id);
  }
  const data = (body: string): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const m of body.matchAll(/<data\b([^>]*)>([\s\S]*?)<\/data>/g)) {
      const k = attrs(m[1] ?? '').key;
      if (k !== undefined) out[keyName.get(k) ?? k] = unescapeXml((m[2] ?? '').trim());
    }
    return out;
  };
  const nodeRecs: Rec[] = [];
  for (const m of xml.matchAll(/<node\b([^>]*?)(?:\/>|>([\s\S]*?)<\/node>)/g)) {
    const id = attrs(m[1] ?? '').id;
    if (id !== undefined) nodeRecs.push({ id, ...data(m[2] ?? '') });
  }
  const linkRecs: Rec[] = [];
  for (const m of xml.matchAll(/<edge\b([^>]*?)(?:\/>|>([\s\S]*?)<\/edge>)/g)) {
    const a = attrs(m[1] ?? '');
    if (field(a, 'source') !== undefined && field(a, 'target') !== undefined) linkRecs.push({ source: field(a, 'source'), target: field(a, 'target'), ...data(m[2] ?? '') });
  }
  if (nodeRecs.length === 0) throw new Error('graphify GraphML: no <node> elements found');
  return normalizeGraphifyRecords(nodeRecs, linkRecs);
}
