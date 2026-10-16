/**
 * MT-B1 (Docs/DiagnosticRuns/v1.3-mtb1-fix-2026-10-16.md), OFF by default: a graph-build step between extraction and
 * ingestion that lets the literal view see through a barrel that belongs to no layer.
 *
 * Under `reExportEdges: 'both'` an import through a barrel gives a literal edge to the barrel (`reExportHop`) and a
 * resolved edge to the declaring file (`viaReExport`); the literal-view templates drop the second. When the barrel has
 * no layer (a feature folder's `index.ts` under file-name-pattern layers, as in NestJS), the literal edge ends at a
 * layerless file and every layer rule reading that view goes blind to the import. The extractor cannot decide this: it
 * has no layer model. Here the layers are known (`annotateNodes`), so the step drops the `viaReExport` mark of a
 * resolved edge when
 *
 *  - every barrel it crosses (`reExportBarrels`) is a File with no layer,
 *  - none of those barrels is a declared DDD public API or ACL (`architecture.ddd.contexts[].public_api|acl`): such a
 *    barrel is the boundary context-isolation checks, and must stay one (MT-B3, probe g02), and
 *  - the declaring file has a layer (otherwise no layer rule could see the edge anyway).
 *
 * The edge keeps `reExportBarrels` and gains `literalThroughLayerlessBarrel: true`, so its origin stays visible. The
 * barrel edge, its `reExportHop` mark and the resolved view are unchanged. No template text is touched: the literal
 * view's predicate (`NOT coalesce(r.viaReExport, false)`) simply admits the edge.
 */
import picomatch from 'picomatch';
import type { APGEdge, APGNode } from '../shared/types/apg.js';
import type { LayerModel } from '../shared/types/spec.js';
import type { LayerAnnotation } from './types.js';

export interface LayerlessBarrelLiftResult {
  readonly edges: readonly APGEdge[];
  /** Ids of the edges whose `viaReExport` mark was dropped. */
  readonly lifted: readonly string[];
}

/** Globs of the barrels that are declared boundaries (DDD public APIs and ACLs); empty outside the DDD style. */
export function declaredBoundaryGlobs(layerModel: LayerModel): string[] {
  return (layerModel.ddd?.contexts ?? []).flatMap((c) => [...c.publicApi, ...c.acl]);
}

export function liftLayerlessBarrelEdges(
  nodes: readonly APGNode[],
  edges: readonly APGEdge[],
  annotations: ReadonlyMap<string, LayerAnnotation>,
  layerModel: LayerModel,
): LayerlessBarrelLiftResult {
  const layerByPath = new Map<string, string | null>();
  const layerById = new Map<string, string | null>();
  for (const n of nodes) {
    if (n.type !== 'File') continue;
    const layer = annotations.get(n.id)?.layer ?? null;
    layerByPath.set(n.filePath, layer);
    layerById.set(n.id, layer);
  }
  const globs = declaredBoundaryGlobs(layerModel);
  const isBoundary = globs.length > 0 ? picomatch(globs, { dot: true }) : (): boolean => false;
  // A barrel path the graph has no File for is not known to be layerless: the edge is left alone.
  const layerless = (barrel: string): boolean =>
    layerByPath.has(barrel) && layerByPath.get(barrel) === null && !isBoundary(barrel);

  const lifted: string[] = [];
  const out = edges.map((e): APGEdge => {
    if (e.type !== 'IMPORTS') return e;
    const props = e.properties;
    if (props.viaReExport !== true) return e;
    const barrels = props.reExportBarrels;
    if (!Array.isArray(barrels) || barrels.length === 0) return e;
    if (!barrels.every((b) => typeof b === 'string' && layerless(b))) return e;
    if ((layerById.get(e.targetId) ?? null) === null) return e;
    const { viaReExport: _dropped, ...rest } = props;
    lifted.push(e.id);
    return { ...e, properties: { ...rest, literalThroughLayerlessBarrel: true } };
  });
  return { edges: out, lifted };
}
