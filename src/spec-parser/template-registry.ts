import type { FitnessFunction, SemanticCriteria, ScoringWeights, VerdictThresholds, ConfidenceThresholds } from '../shared/types/spec.js';
import type { BuiltInTemplate } from './types.js';
import { functionId } from '../shared/types/value-objects.js';

function ff(
  id: string,
  name: string,
  dimension: FitnessFunction['dimension'],
  severity: FitnessFunction['severity'],
  route: FitnessFunction['route'],
  validated: boolean,
  extra?: { threshold?: number; semanticCriteria?: SemanticCriteria },
): FitnessFunction {
  const base: FitnessFunction = {
    id: functionId(id),
    name,
    dimension,
    severity,
    route,
    isBuiltIn: true,
    validated,
    enabled: true,
    excludePaths: [],
  };
  if (extra?.threshold != null) {
    return { ...base, threshold: extra.threshold, ...(extra.semanticCriteria ? { semanticCriteria: extra.semanticCriteria } : {}) };
  }
  if (extra?.semanticCriteria) {
    return { ...base, semanticCriteria: extra.semanticCriteria };
  }
  return base;
}

const CLEAN_ARCH_FUNCTIONS: readonly FitnessFunction[] = [
  // ── Structural ──
  ff('FF-S01', 'dependency-direction', 'structural', 'critical', 'symbolic', true),
  ff('FF-S02', 'no-cyclic-deps', 'structural', 'critical', 'symbolic', true),
  ff('FF-S03', 'no-layer-skip', 'structural', 'critical', 'symbolic', false),
  ff('FF-S04', 'no-domain-outward-dep', 'structural', 'major', 'symbolic', false),
  // ── Pattern ──
  ff('FF-P01', 'domain-purity', 'pattern', 'critical', 'symbolic', true),
  ff('FF-P02', 'dependency-inversion', 'pattern', 'critical', 'symbolic', true, { threshold: 0.85 }),
  ff('FF-P03', 'repository-pattern', 'pattern', 'critical', 'symbolic', true),
  ff('FF-P04', 'use-case-isolation', 'pattern', 'major', 'symbolic', true),
  ff('FF-P05', 'controller-no-entity', 'pattern', 'major', 'symbolic', false),
  // ── Coupling ──
  ff('FF-C01', 'domain-stability', 'coupling', 'major', 'symbolic', true, { threshold: 0.3 }),
  ff('FF-C02', 'module-fan-out', 'coupling', 'major', 'symbolic', true, { threshold: 10 }),
  ff('FF-C03', 'component-instability', 'coupling', 'major', 'symbolic', true),
  ff('FF-C04', 'no-orphan-files', 'coupling', 'minor', 'symbolic', false),
  ff('FF-C05', 'max-fan-in', 'coupling', 'minor', 'symbolic', false, { threshold: 15 }),
  ff('FF-C06', 'abstraction-ratio', 'coupling', 'advisory', 'symbolic', false, { threshold: 0.3 }),
  // ── SOLID ──
  ff('FF-SO01', 'single-responsibility-proxy', 'solid', 'major', 'symbolic', true),
  ff('FF-SO02', 'interface-segregation-proxy', 'solid', 'major', 'symbolic', true),
  ff('FF-SO03', 'inheritance-depth', 'solid', 'minor', 'symbolic', false),
  // ── Convention ──
  ff('FF-CV01', 'naming-conventions', 'convention', 'minor', 'symbolic', true),
  ff('FF-CV02', 'naming-services', 'convention', 'minor', 'symbolic', false),
  ff('FF-CV03', 'naming-repos', 'convention', 'minor', 'symbolic', false),
  ff('FF-CV04', 'naming-controllers', 'convention', 'minor', 'symbolic', false),
  ff('FF-CV05', 'test-file-pairing', 'convention', 'advisory', 'symbolic', false),
  ff('FF-CV06', 'no-index-logic', 'convention', 'advisory', 'symbolic', false),
  // ── Neuronal ──
  ff('FF-N01', 'srp-semantic', 'solid', 'major', 'hybrid', false, {
    semanticCriteria: {
      rule: 'A class should have exactly one reason to change',
      rubric: {
        pass: 'Class responsibilities are cohesive and serve a single purpose',
        fail: 'Class mixes unrelated concerns (data access + business logic, etc.)',
        evidenceRequired: 'Cite specific methods that indicate mixed responsibilities',
      },
    },
  }),
  ff('FF-N02', 'layering-intent', 'intent', 'major', 'neuronal', false, {
    semanticCriteria: {
      rule: 'Code should respect the documented architectural intent',
      rubric: {
        pass: 'File is in the correct layer and dependencies respect layer boundaries',
        fail: 'File logic or dependencies contradict the architectural layer it lives in',
        evidenceRequired: 'Cite the specific import or logic that violates the intent',
      },
    },
  }),
];

const SYMBOLIC_WEIGHTS: ScoringWeights = {
  structural: 0.35,
  coupling: 0.20,
  pattern: 0.30,
  solid: 0.10,
  convention: 0.05,
  semantic: 0,
  intent: 0,
};

const FULL_MODE_WEIGHTS: ScoringWeights = {
  structural: 0.32,
  coupling: 0.18,
  pattern: 0.27,
  solid: 0.10,
  convention: 0.05,
  semantic: 0.04,
  intent: 0.04,
};

const DEFAULT_VERDICT_THRESHOLDS: VerdictThresholds = {
  pass: 0.80,
  warning: 0.65,
  softBlock: 0.50,
};

const DEFAULT_CONFIDENCE_THRESHOLDS: ConfidenceThresholds = {
  high: 0.85,
  medium: 0.60,
  iccMinimum: 0.70,
};

const CLEAN_ARCHITECTURE_TEMPLATE: BuiltInTemplate = {
  style: 'clean-architecture',
  version: '1.0.0',
  functions: CLEAN_ARCH_FUNCTIONS,
  defaultWeights: SYMBOLIC_WEIGHTS,
  defaultFullModeWeights: FULL_MODE_WEIGHTS,
  defaultVerdictThresholds: DEFAULT_VERDICT_THRESHOLDS,
  defaultConfidenceThresholds: DEFAULT_CONFIDENCE_THRESHOLDS,
};

export const TEMPLATE_REGISTRY: ReadonlyMap<string, BuiltInTemplate> = new Map([
  ['clean-architecture', CLEAN_ARCHITECTURE_TEMPLATE],
]);

export function resolveTemplate(style: string): BuiltInTemplate | undefined {
  return TEMPLATE_REGISTRY.get(style.toLowerCase());
}
