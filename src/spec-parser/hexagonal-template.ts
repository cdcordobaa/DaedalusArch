import type { FitnessFunction } from '../shared/types/spec.js';
import type { BuiltInTemplate } from './types.js';
import { functionId } from '../shared/types/value-objects.js';

/**
 * `hexagonal` library (v1.3). Registered through `EXTENSION_TEMPLATES` rather than `TEMPLATE_REGISTRY`, which stays
 * the frozen v1.2E set of three styles. Derived from the layered library: the functions that need a total layer order
 * or a Clean-Architecture layout are replaced by graph-based ones (see src/fitness-compiler/hexagonal-templates.ts).
 */
function hexFn(id: string, name: string, dimension: FitnessFunction['dimension'], severity: FitnessFunction['severity'], threshold?: number): FitnessFunction {
  return {
    id: functionId(id), name, dimension, severity, route: 'symbolic', isBuiltIn: true, validated: false, enabled: true, excludePaths: [],
    ...(threshold != null ? { threshold } : {}),
  };
}

/** Layered ids replaced by a hexagonal function (same id) or dropped (no hexagonal counterpart). */
const REPLACED: Readonly<Record<string, FitnessFunction | null>> = {
  'FF-S01': hexFn('FF-S01', 'dependency-direction-graph', 'structural', 'critical'),
  'FF-S03': hexFn('FF-S03', 'layer-skip-graph', 'structural', 'critical'),
  'FF-S04': hexFn('FF-S04', 'core-isolation', 'structural', 'major'),
  'FF-P02': hexFn('FF-P02', 'port-dependency-inversion', 'pattern', 'critical', 0.85),
  'FF-P03': hexFn('FF-P03', 'port-adapter-pattern', 'pattern', 'critical'),
  'FF-P04': null, // use-case-isolation: covered by the allowed-dependency graph
  'FF-P05': null, // controller-no-entity: inbound adapters may use domain types in hexagonal
  'FF-C01': null, // domain-stability: Clean-Architecture-only
};

/** The hexagonal library, built from the layered one (passed in so this module does not import the registry). */
export function buildHexagonalTemplate(layered: BuiltInTemplate): BuiltInTemplate {
  return {
    style: 'hexagonal',
    version: '1.0.0',
    functions: layered.functions.flatMap((f) => {
      const key = String(f.id);
      if (!(key in REPLACED)) return [f];
      const replacement = REPLACED[key];
      return replacement ? [replacement] : [];
    }),
    defaultWeights: layered.defaultWeights,
    defaultFullModeWeights: layered.defaultFullModeWeights,
    defaultVerdictThresholds: layered.defaultVerdictThresholds,
    defaultConfidenceThresholds: layered.defaultConfidenceThresholds,
  };
}
