/**
 * The layer facts the construct switches need, read from the spec's layer model the way the compiler reads them:
 * the declared order (bottom-up, `buildParams`), the kinds (`bindLayerParams`), and for the graph styles (hexagonal,
 * ddd) the allowed-dependency edges and composition roots (`bindHexagonalLayers`).
 */
import type { LayerModel } from '../shared/types/spec.js';
import type { LayerKind } from '../shared/types/enums.js';
import type { APGNode } from '../shared/types/apg.js';
import { annotateNodes } from '../neo4j-ingestion/layer-annotator.js';
import { bindHexagonalLayers } from '../fitness-compiler/hexagonal-templates.js';

export interface LayerView {
  readonly order: readonly string[];
  readonly kindOf: (layer: string | null | undefined) => LayerKind | undefined;
  /** True when an import from `src` to `tgt` (both layers) is allowed: the allowed-dependency graph, else downward. */
  readonly allowed: (src: string, tgt: string) => boolean;
  readonly graphStyle: boolean;
  readonly domainLayer?: string;
  readonly domainLayers: readonly string[];
  /** Application layers without the composition roots. */
  readonly applicationLayers: readonly string[];
  readonly compositionLayers: readonly string[];
  /** Hexagonal and ddd: the adapter layers (kinds presentation and infrastructure). */
  readonly adapterLayers: readonly string[];
  readonly controllerLayer?: string;
  /** Layered: the allowed transitions `outer>inner` of adjacent layers (`buildParams`). */
  readonly allowedTransitions: readonly string[];
}

export function layerViewOf(model: LayerModel): LayerView {
  const layers = model.layers;
  const order = layers.map((l) => l.name);
  const kinds = new Map(layers.map((l) => [l.name, l.kind]));
  const kindOf = (layer: string | null | undefined): LayerKind | undefined => (layer == null ? undefined : kinds.get(layer));
  const graphStyle = model.allowedDependencies !== undefined && model.allowedDependencies.length > 0;
  const hex = graphStyle ? bindHexagonalLayers(model) : undefined;
  const allowedSet = new Set((model.allowedDependencies ?? []).map((d) => `${d.from}>${d.to}`));
  const compositionLayers = hex?.ok === true ? hex.binding.compositionRoots : [];
  const ofKind = (k: LayerKind): string[] => layers.filter((l) => l.kind === k).map((l) => l.name);
  const presentation = ofKind('presentation')[0];
  const infra = ofKind('infrastructure')[0];
  const allowedTransitions: string[] = [];
  for (let i = 0; i < order.length - 1; i++) allowedTransitions.push(`${String(order[i + 1])}>${String(order[i])}`);
  const domainLayer = ofKind('domain')[0];
  const controllerLayer = presentation ?? infra;
  return {
    order,
    kindOf,
    allowed: (src, tgt) => {
      if (graphStyle) return allowedSet.has(`${src}>${tgt}`);
      return order.indexOf(src) > order.indexOf(tgt);
    },
    graphStyle,
    ...(domainLayer !== undefined ? { domainLayer } : {}),
    domainLayers: ofKind('domain'),
    applicationLayers: ofKind('application').filter((l) => !compositionLayers.includes(l)),
    compositionLayers,
    adapterLayers: graphStyle ? [...ofKind('presentation'), ...ofKind('infrastructure')] : [],
    ...(controllerLayer !== undefined ? { controllerLayer } : {}),
    allowedTransitions,
  };
}

/**
 * The module a file belongs to, for the component unit of FF-S02 (Q3): a NestJS feature folder (`src/<feature>/`), a
 * DDD bounded context (its declared root), else '' (one module: the layer is the component).
 */
export function moduleOf(file: string, style: string | undefined, model: LayerModel): string {
  if (style === 'ddd') return model.ddd?.contexts.find((c) => file.startsWith(c.root))?.root ?? '';
  if (style === 'nestjs') {
    const parts = file.split('/');
    return parts.length >= 3 && parts[0] === 'src' ? parts[1] ?? '' : '';
  }
  return '';
}

/** File-to-layer by the declared globs, as ingestion assigns File nodes (directory, then file-name pattern). */
export function fileLayerAssigner(model: LayerModel): (file: string) => string | null {
  const cache = new Map<string, string | null>();
  return (file) => {
    const hit = cache.get(file);
    if (hit !== undefined) return hit;
    const node: APGNode = { id: file, type: 'File', filePath: file, name: file, decorators: [], properties: {} };
    const layer = annotateNodes([node], model).annotations.get(file)?.layer ?? null;
    cache.set(file, layer);
    return layer;
  };
}

/** The files of a cycle row: every path in `file` and `target`, split on commas, deduplicated and sorted. */
export function cycleFiles(file: string, target?: string): string[] {
  const parts = [...file.split(','), ...(target ?? '').split(',')].map((x) => x.trim()).filter((x) => x !== '');
  return [...new Set(parts)].sort();
}

/** Q3: true when every file of the cycle lies in one assigned layer and one module. */
export function cycleInOneComponent(
  files: readonly string[], layerOf: (f: string) => string | null, style: string | undefined, model: LayerModel,
): boolean {
  if (files.length === 0) return false;
  const layers = new Set(files.map(layerOf));
  if (layers.size !== 1 || layers.has(null)) return false;
  return new Set(files.map((f) => moduleOf(f, style, model))).size === 1;
}
