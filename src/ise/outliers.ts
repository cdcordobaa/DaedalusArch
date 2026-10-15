/**
 * ISE Option 3: deviation clustering without a spec. On the judged graph alone, infer the layer order (style
 * classification and layer mapping of that same graph), then flag the outlier edges:
 * - against-order: an import from a layer to a layer of higher rank (outward), or between two different layers of the
 *   same rank (e.g. inbound -> outbound adapter);
 * - minority: an import in the minority direction (share < 1 - threshold) of a unit pair that has edges both ways.
 * Composition-root and unassigned files are never sources. Nothing is learned from another version of the project.
 */
import type { IseGraph } from './graph-view.js';
import { inferLayerMapping } from './layer-mapper.js';
import { layerRank } from './preset.js';
import type { IsePreset } from './preset.js';
import { classifyStyle } from './style-classifier.js';
import type { IseStyle } from './style-classifier.js';
import { MAJORITY_THRESHOLD } from './majority-vote.js';

export interface OutlierEdge {
  readonly file: string;
  readonly target: string;
  readonly reason: 'against-order' | 'minority';
  readonly fromLayer: string | null;
  readonly toLayer: string | null;
}

export interface OutlierResult {
  readonly style: IseStyle;
  readonly outliers: readonly OutlierEdge[];
}

export function findOutliers(graph: IseGraph, presetOf: (style: IseStyle) => IsePreset, threshold = MAJORITY_THRESHOLD): OutlierResult {
  const style = classifyStyle(graph).best;
  const preset = presetOf(style);
  const mapping = inferLayerMapping(graph, style, preset, 'preset-first');
  const layerOf = new Map(mapping.files.map((f) => [f.file, f.layer]));
  const s = mapping.structure;
  const cnt = new Map(s.edges.map((e) => [`${e.from}\n${e.to}`, e.count]));
  const out: OutlierEdge[] = [];
  for (const e of graph.edges) {
    const la = layerOf.get(e.from) ?? null;
    const lb = layerOf.get(e.to) ?? null;
    const ua = s.unitOf.get(e.from);
    const ub = s.unitOf.get(e.to);
    let reason: OutlierEdge['reason'] | undefined;
    if (la !== null && lb !== null && la !== lb) {
      const ra = layerRank(style, la, preset.layers);
      const rb = layerRank(style, lb, preset.layers);
      if (ra >= 0 && rb >= 0 && (rb > ra || rb === ra)) reason = 'against-order';
    }
    if (reason === undefined && ua !== undefined && ub !== undefined && ua !== ub && la !== null) {
      const fwd = cnt.get(`${ua}\n${ub}`) ?? 0;
      const back = cnt.get(`${ub}\n${ua}`) ?? 0;
      if (back > 0 && fwd / (fwd + back) < 1 - threshold) reason = 'minority';
    }
    if (reason !== undefined) out.push({ file: e.from, target: e.to, reason, fromLayer: la, toLayer: lb });
  }
  return { style, outliers: out };
}
