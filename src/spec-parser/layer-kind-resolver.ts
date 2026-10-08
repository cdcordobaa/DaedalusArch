import { LAYER_KINDS } from '../shared/types/enums.js';
import type { LayerKind } from '../shared/types/enums.js';
import type { LayerDefinition } from '../shared/types/spec.js';
import type { ValidationWarning } from './types.js';

/** Kinds bound as a single layer; a second holder is reported with SPEC_005 (BR-U1-13). */
const SCALAR_KINDS: readonly LayerKind[] = ['domain', 'infrastructure', 'presentation'];

function isLayerKind(name: string): name is LayerKind {
  return (LAYER_KINDS as readonly string[]).includes(name);
}

function positionalKind(i: number, n: number): LayerKind {
  if (i === 0) return 'domain';
  if (i === n - 1) return 'infrastructure';
  return 'application';
}

/**
 * Resolve every layer's kind (FR-19, BR-U1-12): explicit `kind` -> exact name in LAYER_KINDS -> position
 * (index 0 domain, last infrastructure, every middle index application; presentation never positional).
 * A `kind` already present on an input layer is the declared (explicit) kind. Pure: returns new layers.
 */
export function resolveLayerKinds(
  layers: readonly LayerDefinition[],
): { layers: LayerDefinition[]; warnings: ValidationWarning[] } {
  const n = layers.length;
  const resolved: LayerDefinition[] = layers.map((layer, i) => {
    if (layer.kind != null) return { ...layer, kind: layer.kind, kindSource: 'explicit' as const };
    if (isLayerKind(layer.name)) return { ...layer, kind: layer.name, kindSource: 'name' as const };
    return { ...layer, kind: positionalKind(i, n), kindSource: 'position' as const };
  });

  const warnings: ValidationWarning[] = [];
  for (const kind of SCALAR_KINDS) {
    const holders = resolved.filter((l) => l.kind === kind).map((l) => l.name);
    if (holders.length > 1) {
      warnings.push({
        code: 'SPEC_005',
        message: `Layer kind "${kind}" resolved for layers ${holders.join(', ')}; binding uses ${String(holders[0])}`,
      });
    }
  }

  return { layers: resolved, warnings };
}
