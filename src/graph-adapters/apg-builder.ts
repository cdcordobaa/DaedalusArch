import { posix } from 'node:path';
import { generateEdgeId, generateNodeId } from '../apg-extractor/id-generator.js';
import { PackageNodeRegistry, builtinRoot, isBuiltinSpecifier, packageRootFromSpecifier } from '../apg-extractor/package-node-factory.js';
import type { APGEdge, APGNode, ImportEdgeProperties } from '../shared/types/apg.js';
import { EDGE_TYPES } from '../shared/types/enums.js';
import type { EdgeType, NodeType } from '../shared/types/enums.js';
import { FORMAT_CAPABILITIES } from './capabilities.js';
import type { AdapterOptions, AdapterResult, ExternalFormat, NormEdge, NormNode, NormalizedGraph } from './types.js';
import { baseName, field, isSourceFile, normPath } from './util.js';

const RESOLVE_SUFFIXES = ['', '.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];
const BARREL_NAMES = new Set(['index.ts', 'index.tsx', 'index.js']);

interface ImportSlot {
  readonly source: string;
  readonly target: string;
  readonly specifiers: Set<string>;
  readonly lines: Set<number>;
}

/** Resolve a relative specifier against the files of the export (no tsconfig `paths`, no `baseUrl`). */
function resolveRelative(fromFile: string, specifier: string, files: ReadonlySet<string>): string | undefined {
  const base = posix.normalize(posix.join(posix.dirname(fromFile), specifier));
  const stripped = base.replace(/\.(?:[cm]?js|jsx)$/i, '');
  for (const stem of stripped === base ? [base] : [base, stripped]) {
    for (const suffix of RESOLVE_SUFFIXES) {
      const candidate = stem + suffix;
      if (files.has(candidate)) return candidate;
    }
  }
  return undefined;
}

function bump(counter: Record<string, number>, key: string): void {
  counter[key] = (counter[key] ?? 0) + 1;
}

/**
 * Convert a normalised external graph into APG nodes and edges (the shared half of every adapter).
 * Node ids come from the extractor's `generateNodeId`, so an adapter node and an extractor node for the same
 * declaration have the same id. Whatever the export cannot express is counted in the report, never invented.
 */
export function buildApg(format: ExternalFormat, graph: NormalizedGraph, options: AdapterOptions = {}): AdapterResult {
  const minConfidence = options.minConfidence ?? 0;
  const warnings: string[] = [];
  const dropped: Record<string, number> = {};
  const unmapped: Record<string, number> = {};
  const byExt = new Map<string, NormNode>(graph.nodes.map((n) => [n.id, n]));

  // ── owners: fill a missing declaring file / owning class from parent→child edges ───────────────────────
  const parentOf = new Map<string, string>();
  const isTypeKind = (id: string): boolean => {
    const k = byExt.get(id)?.kind;
    return k === 'class' || k === 'interface';
  };
  for (const e of graph.edges) {
    if (e.rel !== 'contains' || e.target === undefined) continue;
    const prior = parentOf.get(e.target);
    // A method's owner is its class or interface, not the file that also lists it.
    if (prior === undefined || (!isTypeKind(prior) && isTypeKind(e.source))) parentOf.set(e.target, e.source);
  }
  const fileOf = (n: NormNode, depth = 0): string | undefined => {
    if (n.filePath !== undefined) return normPath(n.filePath);
    if (depth > 3) return undefined;
    const pid = n.ownerId ?? parentOf.get(n.id);
    const parent = pid === undefined ? undefined : byExt.get(pid);
    return parent === undefined ? undefined : fileOf(parent, depth + 1);
  };
  const ownerOf = (n: NormNode): NormNode | undefined => {
    const pid = n.ownerId ?? parentOf.get(n.id);
    const parent = pid === undefined ? undefined : byExt.get(pid);
    return parent !== undefined && (parent.kind === 'class' || parent.kind === 'interface') ? parent : undefined;
  };

  // ── nodes ─────────────────────────────────────────────────────────────────────────────────────────────
  const apgNodes = new Map<string, APGNode>();
  const apgIdOf = new Map<string, string>(); // external id → APG id (non-package nodes)
  const filePaths = new Set<string>();
  const add = (n: APGNode, ext: string): void => {
    if (!apgNodes.has(n.id)) apgNodes.set(n.id, n);
    apgIdOf.set(ext, n.id);
  };
  const mk = (type: NodeType, filePath: string, name: string, decorators: readonly string[], properties: Record<string, unknown>): APGNode =>
    ({ id: generateNodeId(type, filePath, name), type, filePath, name, decorators, properties });

  for (const n of graph.nodes) {
    if (n.kind === 'file') {
      const fp = fileOf(n);
      if (fp === undefined || !isSourceFile(fp)) { bump(dropped, 'non-source-file-node'); continue; }
      filePaths.add(fp);
      add(mk('File', fp, baseName(fp), [], { isBarrel: false }), n.id);
    }
  }
  const methodNodes: NormNode[] = [];
  const methodOwners: [string, string][] = [];
  for (const n of graph.nodes) {
    if (n.kind === 'class' || n.kind === 'interface' || n.kind === 'function') {
      const fp = fileOf(n);
      if (fp === undefined || !filePaths.has(fp)) { bump(dropped, `${n.kind}-without-file-node`); continue; }
      const type: NodeType = n.kind === 'class' ? 'Class' : n.kind === 'interface' ? 'Interface' : 'Function';
      add(mk(type, fp, n.name, n.decorators ?? [], {}), n.id);
    } else if (n.kind === 'method') methodNodes.push(n);
  }
  for (const n of methodNodes) {
    const owner = ownerOf(n);
    const ownerApg = owner === undefined ? undefined : apgNodes.get(apgIdOf.get(owner.id) ?? '');
    if (owner === undefined || ownerApg === undefined) { bump(dropped, 'method-without-owner'); continue; }
    const qualified = n.name.includes('.') ? n.name : `${owner.name}.${n.name}`;
    add(mk('Method', ownerApg.filePath, qualified, n.decorators ?? [], {}), n.id);
    methodOwners.push([ownerApg.id, n.id]);
  }

  // ── edges ─────────────────────────────────────────────────────────────────────────────────────────────
  const packages = new PackageNodeRegistry();
  const apgEdges = new Map<string, APGEdge>();
  const imports = new Map<string, ImportSlot>();
  const edge = (type: EdgeType, s: string, t: string, properties: Record<string, unknown>): void => {
    const id = generateEdgeId(type, s, t);
    const prior = apgEdges.get(id);
    if (prior === undefined) apgEdges.set(id, { id, type, sourceId: s, targetId: t, properties });
    else if (type === 'CALLS') {
      const n = (field(prior.properties, 'callCount') as number | undefined) ?? 1;
      apgEdges.set(id, { ...prior, properties: { callCount: n + 1 } });
    }
  };
  const apgNode = (ext: string | undefined): APGNode | undefined =>
    ext === undefined ? undefined : apgNodes.get(apgIdOf.get(ext) ?? '');
  const fileNodeOf = (n: APGNode | undefined): APGNode | undefined =>
    n === undefined ? undefined : n.type === 'File' ? n : apgNodes.get(generateNodeId('File', n.filePath, baseName(n.filePath)));

  const addImport = (src: APGNode, targetId: string, specifier: string, line: number | undefined): void => {
    if (src.id === targetId) return;
    const key = `${src.id}>${targetId}`;
    const slot = imports.get(key) ?? { source: src.id, target: targetId, specifiers: new Set<string>(), lines: new Set<number>() };
    if (specifier !== '') slot.specifiers.add(specifier);
    if (line !== undefined) slot.lines.add(line);
    imports.set(key, slot);
  };
  const packageFor = (specifier: string): APGNode | undefined => {
    if (isBuiltinSpecifier(specifier)) return packages.getOrCreate(builtinRoot(specifier));
    const root = packageRootFromSpecifier(specifier);
    return root === undefined ? undefined : packages.getOrCreate(root);
  };

  // Ownership is a CONTAINS edge whether or not the export lists a class→method edge.
  for (const [owner, method] of methodOwners) {
    const m = apgNode(method);
    if (m !== undefined) edge('CONTAINS', owner, m.id, {});
  }
  for (const e of graph.edges) {
    if (e.confidence !== undefined && e.confidence < minConfidence) { bump(dropped, 'below-min-confidence'); continue; }
    if (e.rel === 'unmapped') { bump(unmapped, e.originalType); continue; }
    const src = apgNode(e.source);
    switch (e.rel) {
      case 'imports': mapImport(e, src); break;
      case 'contains': mapContains(e, src); break;
      case 'calls': mapCalls(e, src); break;
      default: mapInheritance(e, src); break;
    }
  }

  function mapImport(e: NormEdge, src: APGNode | undefined): void {
    const srcFile = fileNodeOf(src);
    if (srcFile === undefined) { bump(dropped, 'import-source-not-extracted'); return; }
    const target = e.target === undefined ? undefined : byExt.get(e.target);
    const tgtFile = fileNodeOf(apgNode(e.target));
    if (tgtFile !== undefined) { addImport(srcFile, tgtFile.id, '', e.line); return; }
    const spec = e.targetSpecifier ?? (target?.filePath === undefined || target.kind === 'package' || target.kind === 'other' ? target?.name : undefined);
    if (spec === undefined) { bump(dropped, 'import-target-unknown'); return; }
    if (spec.startsWith('.')) {
      const resolved = resolveRelative(srcFile.filePath, spec, filePaths);
      const rf = resolved === undefined ? undefined : apgNodes.get(generateNodeId('File', resolved, baseName(resolved)));
      if (rf === undefined) bump(dropped, 'relative-import-unresolved');
      else addImport(srcFile, rf.id, spec, e.line);
      return;
    }
    const pkg = packageFor(spec);
    if (pkg === undefined) bump(dropped, 'import-alias-not-package-shaped');
    else addImport(srcFile, pkg.id, spec, e.line);
  }

  function mapContains(e: NormEdge, src: APGNode | undefined): void {
    const tgt = apgNode(e.target);
    if (src === undefined || tgt === undefined) { bump(dropped, 'contains-endpoint-not-extracted'); return; }
    if (src.type === 'File' && (tgt.type === 'Class' || tgt.type === 'Interface' || tgt.type === 'Function')) {
      edge('DECLARES', src.id, tgt.id, {});
    } else if ((src.type === 'Class' || src.type === 'Interface') && tgt.type === 'Method') {
      edge('CONTAINS', src.id, tgt.id, {});
    } else bump(dropped, `contains-${src.type}-to-${tgt.type}`);
  }

  function mapCalls(e: NormEdge, src: APGNode | undefined): void {
    const tgt = apgNode(e.target);
    if (src?.type === 'Method' && tgt?.type === 'Method') edge('CALLS', src.id, tgt.id, { callCount: 1 });
    else bump(dropped, `calls-${src?.type ?? 'unextracted'}-to-${tgt?.type ?? 'unextracted'}`);
  }

  function mapInheritance(e: NormEdge, src: APGNode | undefined): void {
    const tgt = apgNode(e.target);
    if (src === undefined || tgt === undefined || src.type === 'File') { bump(dropped, 'inheritance-endpoint-not-extracted'); return; }
    const classToClass = src.type === 'Class' && tgt.type === 'Class';
    const toInterface = tgt.type === 'Interface';
    if (e.rel === 'extends' || e.rel === 'inherits') {
      if (classToClass) { edge('EXTENDS', src.id, tgt.id, {}); return; }
      if (e.rel === 'inherits' && src.type === 'Class' && toInterface) { edge('IMPLEMENTS', src.id, tgt.id, {}); return; }
    }
    if (e.rel === 'implements' && src.type === 'Class' && toInterface) { edge('IMPLEMENTS', src.id, tgt.id, {}); return; }
    bump(dropped, `inheritance-${src.type}-to-${tgt.type}`);
  }

  for (const slot of imports.values()) {
    const lines = [...slot.lines].sort((a, b) => a - b);
    const specifiers = [...slot.specifiers].sort();
    const properties: ImportEdgeProperties = {
      specifier: specifiers[0] ?? '', specifiers, line: lines[0] ?? 0, lines, isTypeOnly: false, importedNames: [],
    };
    edge('IMPORTS', slot.source, slot.target, { ...properties });
  }

  // isBarrel: a heuristic, as no export carries it. `index.*` with imports and no declaration.
  const declaring = new Set([...apgEdges.values()].filter((e) => e.type === 'DECLARES').map((e) => e.sourceId));
  const importing = new Set([...apgEdges.values()].filter((e) => e.type === 'IMPORTS').map((e) => e.sourceId));
  for (const n of apgNodes.values()) {
    if (n.type === 'File' && BARREL_NAMES.has(n.name) && importing.has(n.id) && !declaring.has(n.id)) {
      apgNodes.set(n.id, { ...n, properties: { ...n.properties, isBarrel: true } });
    }
  }

  const nodes = [...apgNodes.values(), ...packages.nodes()];
  const edges = [...apgEdges.values()];
  const nodeCountByType: Partial<Record<APGNode['type'], number>> = {};
  for (const n of nodes) nodeCountByType[n.type] = (nodeCountByType[n.type] ?? 0) + 1;
  const edgeCountByType: Partial<Record<APGEdge['type'], number>> = {};
  for (const e of edges) edgeCountByType[e.type] = (edgeCountByType[e.type] ?? 0) + 1;
  const caps = FORMAT_CAPABILITIES[format];
  return {
    nodes,
    edges,
    report: {
      format,
      nodeCountByType,
      edgeCountByType,
      missingEdgeTypes: EDGE_TYPES.filter((t) => edgeCountByType[t] === undefined),
      unavailableEdgeTypes: EDGE_TYPES.filter((t) => caps.edges[t] === 'absent'),
      dropped,
      unmappedRelations: unmapped,
      warnings,
    },
  };
}
