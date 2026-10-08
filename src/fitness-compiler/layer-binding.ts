import type { LayerDefinition } from '../shared/types/spec.js';
import type { LayerKindBinding } from './types.js';

/**
 * Bind layer parameters by resolved kind (FR-19, BR-U1-14). Reads only `LayerDefinition.kind`;
 * a layer without `kind` is unbound and skipped. Scalars take the first layer of that kind in YAML order;
 * `applicationLayers` lists every application layer in YAML order. `controllerLayer` is the presentation
 * layer when one is bound, else the infrastructure layer (ADR-016 a, BR-U1-46). Pure.
 */
export function bindLayerParams(layers: readonly LayerDefinition[]): LayerKindBinding {
  const first = (kind: LayerDefinition['kind']): string | undefined =>
    layers.find((l) => l.kind === kind)?.name;

  const domainLayer = first('domain');
  const infraLayer = first('infrastructure');
  const presentationLayer = first('presentation');
  const applicationLayers = layers.filter((l) => l.kind === 'application').map((l) => l.name);
  const controllerLayer = presentationLayer ?? infraLayer;

  return {
    ...(domainLayer != null ? { domainLayer } : {}),
    applicationLayers,
    ...(infraLayer != null ? { infraLayer } : {}),
    ...(presentationLayer != null ? { presentationLayer } : {}),
    ...(controllerLayer != null ? { controllerLayer } : {}),
  };
}
