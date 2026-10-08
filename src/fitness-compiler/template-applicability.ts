import type { LayerKind } from '../shared/types/enums.js';
import type { LayerModel } from '../shared/types/spec.js';
import type { CypherTemplate, LayerKindBinding } from './types.js';

export type Applicability =
  | { readonly applicable: true }
  | { readonly applicable: false; readonly reason: string };

function isKindBound(kind: LayerKind, binding: LayerKindBinding): boolean {
  switch (kind) {
    case 'domain': return binding.domainLayer != null;
    case 'application': return binding.applicationLayers.length > 0;
    case 'infrastructure': return binding.infraLayer != null;
    case 'presentation': return binding.presentationLayer != null;
  }
}

/**
 * Template applicability (BR-U1-10, BR-U1-15, BR-U1-18; business-logic-model.md §3.1 C5).
 * Fixed check order; the first failing check gives the reason:
 * (a) style — skipped when `style` is undefined or the template has no `applicableStyles`;
 * (b) the first `requiredLayerKinds` entry with no bound layer -> `no <kind> layer`;
 * (c) the `no-layer-skip` layer-count rule (fewer than 3 layers and no `file_patterns`).
 */
export function isTemplateApplicable(
  template: CypherTemplate,
  style: string | undefined,
  binding: LayerKindBinding,
  layerModel: LayerModel,
): Applicability {
  if (style !== undefined && template.applicableStyles !== undefined && !template.applicableStyles.includes(style)) {
    return { applicable: false, reason: `not applicable to style ${style}` };
  }

  const missing = template.requiredLayerKinds.find((kind) => !isKindBound(kind, binding));
  if (missing !== undefined) {
    return { applicable: false, reason: `no ${missing} layer` };
  }

  if (template.functionName === 'no-layer-skip') {
    const layerCount = layerModel.layers.length;
    const hasFilePatterns = layerModel.layers.some((l) => (l.filePatterns ?? []).length > 0);
    if (layerCount < 3 && !hasFilePatterns) {
      return {
        applicable: false,
        reason: `Auto-disabled: only ${String(layerCount)} layer(s) defined with no file_patterns — no intermediate layer to skip`,
      };
    }
  }

  return { applicable: true };
}
