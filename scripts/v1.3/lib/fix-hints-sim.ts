/**
 * Mechanical check of fix hints (Docs/v1.3/fix-hints.md §4): a hint's graph edit as Cypher writes, and the spec check
 * of its target. Pure; `fix-hints-eval.ts` runs the writes inside a transaction it rolls back.
 *
 * The spec check is written here again, apart from `src/fix-hints/spec-model.ts`, so the hint builder does not grade
 * itself: layering is read straight from the spec (allowed_dependencies, or the layer order with FF-S01 inward only,
 * FF-S04 nothing out of the domain in clean-architecture and nestjs, FF-S03 adjacent steps only in layered).
 */
import * as path from 'node:path';
import picomatch from 'picomatch';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';
import type { GraphEditOp } from '../../../src/fix-hints/types.js';
import type { FixHint } from '../../../src/fix-hints/types.js';

export interface CypherWrite {
  readonly cypher: string;
  readonly params: Record<string, unknown>;
}

/** Layer of a path by the spec's globs: directories first in layer order, then file patterns (the annotator's order). */
export function specLayerOf(spec: ParsedSpec, file: string): string | null {
  for (const l of spec.layerModel.layers) if (l.directories.some((g) => picomatch(g, { dot: true })(file))) return l.name;
  for (const l of spec.layerModel.layers) if ((l.filePatterns ?? []).some((g) => picomatch(g, { dot: true })(file))) return l.name;
  return null;
}

let seq = 0;
const newId = (): string => `hint-${String((seq += 1))}`;

/** The Cypher writes of one edit, in order. */
export function editToCypher(spec: ParsedSpec, edit: readonly GraphEditOp[]): readonly CypherWrite[] {
  const out: CypherWrite[] = [];
  const fileNode = (alias: string, param: string): string =>
    `MERGE (${alias}:APGNode:File {filePath: $${param}}) ON CREATE SET ${alias}.id = $${param}Id, ${alias}.type = 'File', ${alias}.name = $${param}Name, ${alias}.layer = $${param}Layer, ${alias}.isBarrel = false, ${alias}.role = null`;
  const fileParams = (param: string, file: string): Record<string, unknown> => ({
    [param]: file, [`${param}Id`]: newId(), [`${param}Name`]: path.posix.basename(file), [`${param}Layer`]: specLayerOf(spec, file),
  });
  const ifaceNode = `MERGE (i:APGNode:Interface {filePath: $interfaceFile, name: $interfaceName}) ON CREATE SET i.id = $ifaceId, i.type = 'Interface', i.layer = $ifaceLayer, i.role = null`;
  for (const op of edit) {
    switch (op.op) {
      case 'remove-import':
        out.push({
          cypher: op.package === true
            ? 'MATCH (a:File {filePath: $from})-[r:IMPORTS|RE_EXPORTS]->(b:Package {name: $to}) DELETE r'
            : 'MATCH (a:File {filePath: $from})-[r:IMPORTS|RE_EXPORTS]->(b:File {filePath: $to}) DELETE r',
          params: { from: op.from, to: op.to },
        });
        break;
      case 'add-import': {
        const rel = op.reExport === true ? 'RE_EXPORTS' : 'IMPORTS';
        const props = {
          id: newId(), line: 0, lines: [0], isTypeOnly: op.typeOnly === true,
          ...(op.viaReExport === true ? { viaReExport: true } : {}),
          ...(op.reExportHop === true ? { reExportHop: true } : {}),
        };
        out.push(
          op.package === true
            ? {
                cypher: `MATCH (a:File {filePath: $from}) MERGE (b:APGNode:Package {name: $to}) ON CREATE SET b.id = $pkgId, b.type = 'Package', b.filePath = '' CREATE (a)-[r:${rel}]->(b) SET r = $props`,
                params: { from: op.from, to: op.to, pkgId: newId(), props },
              }
            : {
                cypher: `${fileNode('a', 'from')} WITH a ${fileNode('b', 'to')} WITH a, b CREATE (a)-[r:${rel}]->(b) SET r = $props`,
                params: { ...fileParams('from', op.from), ...fileParams('to', op.to), props },
              },
        );
        break;
      }
      case 'add-file':
        out.push({ cypher: fileNode('f', 'file'), params: { ...fileParams('file', op.path), fileLayer: op.layer } });
        if (op.declares !== undefined) {
          out.push({
            cypher: `MATCH (f:File {filePath: $file}) MERGE (d:APGNode:${op.declares.kind} {filePath: $file, name: $name}) ON CREATE SET d.id = $id, d.type = $kind, d.layer = $layer, d.role = null MERGE (f)-[:DECLARES]->(d)`,
            params: { file: op.path, name: op.declares.name, id: newId(), kind: op.declares.kind, layer: op.layer },
          });
        }
        break;
      case 'move-file':
        out.push({
          cypher: 'MATCH (n:APGNode {filePath: $from}) SET n.filePath = $to, n.layer = $layer WITH n WHERE n:File SET n.name = $name',
          params: { from: op.from, to: op.to, layer: op.layer, name: path.posix.basename(op.to) },
        });
        break;
      case 'remove-file':
        out.push({ cypher: 'MATCH (n:APGNode {filePath: $path}) DETACH DELETE n', params: { path: op.path } });
        break;
      case 'add-implements':
        out.push({
          cypher: `MATCH (c:Class {filePath: $classFile, name: $className}) ${ifaceNode} WITH c, i MERGE (c)-[:IMPLEMENTS]->(i)`,
          params: { classFile: op.classFile, className: op.className, interfaceFile: op.interfaceFile, interfaceName: op.interfaceName, ifaceId: newId(), ifaceLayer: specLayerOf(spec, op.interfaceFile) },
        });
        break;
      case 'redirect-holding':
        out.push({
          cypher: `MATCH (c:Class {filePath: $classFile, name: $className})-[e:CONSTRUCTOR_INJECTS|FLOWS_TO]->(t) WHERE t.filePath = $fromFile
${ifaceNode}
WITH c, e, i
CALL apoc.create.relationship(c, type(e), properties(e), i) YIELD rel
DELETE e`,
          params: { classFile: op.classFile, className: op.className, fromFile: op.fromFile, interfaceFile: op.interfaceFile, interfaceName: op.interfaceName, ifaceId: newId(), ifaceLayer: specLayerOf(spec, op.interfaceFile) },
        });
        break;
      case 'make-immutable':
        out.push({
          cypher: `MATCH (c:Class {filePath: $classFile, name: $className})
SET c.readonlyFields = coalesce(c.publicFields, []), c.setAccessors = [], c.mutatorMethods = []
WITH c OPTIONAL MATCH (c)-[:CONTAINS]->(m:Method)
WHERE coalesce(m.isStatic, false) = false AND last(split(m.name, '.')) =~ 'set[A-Z].*'
DETACH DELETE m`,
          params: { classFile: op.classFile, className: op.className },
        });
        break;
    }
  }
  return out;
}

// ── Independent spec check ──────────────────────────────────────────────────────────────────────────────────────

function domainLayerOf(spec: ParsedSpec): string | undefined {
  return spec.layerModel.layers.find((l) => l.kind === 'domain')?.name;
}

/** May a file in `from` import a file in `to`, read straight from the spec (see the file comment)? */
export function specAllows(spec: ParsedSpec, from: string | null, to: string | null): boolean {
  if (from === null || to === null || from === to) return true;
  const edges = spec.layerModel.allowedDependencies;
  if (edges !== undefined && edges.length > 0) return edges.some((e) => e.from === from && e.to === to);
  const names = spec.layerModel.layers.map((l) => l.name);
  const fi = names.indexOf(from);
  const ti = names.indexOf(to);
  const enabled = (name: string): boolean => spec.fitnessFunctions.some((f) => f.name === name && f.enabled);
  const style = (spec.style ?? '').toLowerCase();
  if (enabled('dependency-direction') && fi < ti) return false;
  if (enabled('no-domain-outward-dep') && ['clean-architecture', 'nestjs'].includes(style) && from === domainLayerOf(spec)) return false;
  if (enabled('no-layer-skip') && style === 'layered' && !(fi === ti + 1)) return false;
  return true;
}

/** Is importing `pkg` from layer `from` forbidden by domain-purity? */
function packageForbidden(spec: ParsedSpec, from: string | null, pkg: string): boolean {
  if (from === null || from !== domainLayerOf(spec)) return false;
  return spec.fitnessFunctions
    .filter((f) => f.name === 'domain-purity' && f.enabled)
    .flatMap((f) => f.forbiddenImports ?? [])
    .some((p) => pkg === p || (p.endsWith('/*') && pkg.startsWith(p.slice(0, -1))));
}

const rx = (glob: string): boolean => /[*?{[]/.test(glob);

export interface TargetCheck {
  readonly ok: boolean;
  readonly reasons: readonly string[];
}

/**
 * The hint's target is allowed by the spec: its path lies in its layer (or, for the DDD context families, in the declared
 * public API / a context root / the outside-context paths), and every dependency the edit adds or moves is allowed by
 * the spec's layering; no added package import is forbidden.
 */
export function checkTarget(spec: ParsedSpec, hint: FixHint): TargetCheck {
  const reasons: string[] = [];
  const t = hint.target;
  const ddd = spec.layerModel.ddd;
  if (hint.family === 'context-boundary') {
    const ctx = ddd?.contexts.find((c) => t.path?.startsWith(c.root) === true);
    if (t.path === undefined || !(ctx?.publicApi.some((g) => (rx(g) ? picomatch(g, { dot: true })(t.path ?? '') : g === t.path)) ?? false)) {
      reasons.push(`target ${t.path ?? '?'} is not in the declared public API of its context`);
    }
  } else if (hint.family === 'context-membership') {
    const inside = ddd !== undefined && t.path !== undefined && (ddd.contexts.some((c) => (t.path ?? '').startsWith(c.root)) || ddd.outsideContexts.some((g) => picomatch(g, { dot: true })(t.path ?? '')));
    if (!inside) reasons.push(`target ${t.path ?? '?'} lies in no context root and no outside_contexts path`);
    if (t.path !== undefined && specLayerOf(spec, t.path) !== t.layer) reasons.push(`target ${t.path} is in ${String(specLayerOf(spec, t.path))}, not ${String(t.layer)}`);
  } else {
    if (t.layer === null || !spec.layerModel.layers.some((l) => l.name === t.layer)) reasons.push(`target layer ${String(t.layer)} is not a layer of the spec`);
    if (t.path !== undefined && specLayerOf(spec, t.path) !== t.layer) reasons.push(`target ${t.path} is in ${String(specLayerOf(spec, t.path))}, not ${String(t.layer)}`);
  }
  // Every dependency the edit adds (or carries along by moving a file) must be allowed.
  const moved = new Map<string, string>();
  for (const op of hint.edit) if (op.op === 'move-file') moved.set(op.from, op.to);
  const layerAfter = (file: string): string | null => specLayerOf(spec, moved.get(file) ?? file);
  for (const op of hint.edit) {
    if (op.op === 'add-import' && op.viaReExport !== true) {
      if (op.package === true) {
        if (packageForbidden(spec, layerAfter(op.from), op.to)) reasons.push(`added import of ${op.to} from ${String(layerAfter(op.from))} is forbidden`);
      } else if (!specAllows(spec, layerAfter(op.from), layerAfter(op.to))) {
        reasons.push(`added edge ${op.from} (${String(layerAfter(op.from))}) -> ${op.to} (${String(layerAfter(op.to))}) is not allowed`);
      }
    }
    if (op.op === 'add-implements' && !specAllows(spec, layerAfter(op.classFile), layerAfter(op.interfaceFile))) {
      reasons.push(`${op.className} (${String(layerAfter(op.classFile))}) may not implement ${op.interfaceName} (${String(layerAfter(op.interfaceFile))})`);
    }
    if (op.op === 'move-file' && specLayerOf(spec, op.to) !== op.layer) reasons.push(`moved file ${op.to} is in ${String(specLayerOf(spec, op.to))}, not ${String(op.layer)}`);
  }
  return { ok: reasons.length === 0, reasons };
}

/**
 * Control 2: the hint with every file it creates or moves put in the violating target's folder instead (the mistake of
 * placing the abstraction next to the implementation). Undefined when the hint creates or moves no file, or the finding
 * has no file target. The mutant states its real layer, so only the spec and the re-run decide whether it passes.
 */
export function wrongLayerMutant(spec: ParsedSpec, hint: FixHint, target: string | undefined): FixHint | undefined {
  if (target?.includes('/') !== true) return undefined;
  const dir = `${path.posix.dirname(target)}/`;
  const remap = new Map<string, string>();
  for (const op of hint.edit) {
    if (op.op === 'add-file' && path.posix.dirname(op.path) !== path.posix.dirname(target)) remap.set(op.path, `${dir}${path.posix.basename(op.path)}`);
    if (op.op === 'move-file') remap.set(op.to, `${dir}${path.posix.basename(op.to)}`);
  }
  if (remap.size === 0) return undefined;
  const r = (p: string): string => remap.get(p) ?? p;
  const edit = hint.edit.map((op): GraphEditOp => {
    switch (op.op) {
      case 'add-file': return { ...op, path: r(op.path), layer: specLayerOf(spec, r(op.path)) };
      case 'move-file': return { ...op, to: r(op.to), layer: specLayerOf(spec, r(op.to)) };
      case 'add-import': return op.package === true ? { ...op, from: r(op.from) } : { ...op, from: r(op.from), to: r(op.to) };
      case 'add-implements': return { ...op, interfaceFile: r(op.interfaceFile) };
      case 'redirect-holding': return { ...op, interfaceFile: r(op.interfaceFile) };
      default: return op;
    }
  });
  const newPath = hint.target.path === undefined ? undefined : r(hint.target.path);
  return {
    ...hint,
    target: { layer: newPath === undefined ? null : specLayerOf(spec, newPath), folder: dir, ...(newPath !== undefined ? { path: newPath } : {}) },
    edit,
  };
}
