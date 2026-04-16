import type {
  FitnessFunction, LayerModel, LayerDefinition,
  ScoringWeights, VerdictThresholds, ConfidenceThresholds,
  SemanticCriteria,
} from '../shared/types/spec.js';
import type { Dimension, Severity, Route } from '../shared/types/enums.js';
import type { ValidationWarning } from './types.js';
import { functionId } from '../shared/types/value-objects.js';

export interface LayerCResult {
  readonly scoringWeights: ScoringWeights;
  readonly fullModeWeights: ScoringWeights | undefined;
  readonly verdictThresholds: VerdictThresholds;
  readonly confidenceThresholds: ConfidenceThresholds;
}

/**
 * Parse Layer A: architecture.layers → LayerModel
 */
export function parseLayerA(raw: Record<string, unknown>): LayerModel {
  const arch = raw['architecture'] as Record<string, unknown>;
  const rawLayers = arch['layers'] as Record<string, unknown>[];

  const layers: LayerDefinition[] = rawLayers.map((l) => ({
    name: String(l['name']),
    directories: l['directories'] as string[],
    naming: [],
    decorators: (l['decorators'] as string[] | undefined) ?? [],
    role: ((l['roles'] as string[]) ?? []).join(', '),
  }));

  return { layers };
}

/**
 * Parse Layer B: fitness_functions → FitnessFunction[]
 * If a template is provided, merges spec declarations on top of template functions.
 */
export function parseLayerB(
  raw: Record<string, unknown>,
  templateFunctions?: readonly FitnessFunction[],
): { functions: FitnessFunction[]; warnings: ValidationWarning[] } {
  const rawFFs = (raw['fitness_functions'] as Record<string, unknown>[] | undefined) ?? [];
  const warnings: ValidationWarning[] = [];

  const specFunctions: FitnessFunction[] = rawFFs.map((f) => {
    const sc = f['semantic_criteria'] as Record<string, unknown> | undefined;
    let semanticCriteria: SemanticCriteria | undefined;
    if (sc) {
      const rubric = sc['rubric'] as Record<string, string>;
      semanticCriteria = {
        rule: String(sc['rule']),
        ...(sc['adr_ref'] != null ? { adrRef: String(sc['adr_ref']) } : {}),
        rubric: {
          pass: String(rubric['pass']),
          fail: String(rubric['fail']),
          evidenceRequired: String(rubric['evidence_required']),
        },
      };
    }

    const rawExcludePaths = f['exclude_paths'] as string[] | undefined;

    const base: FitnessFunction = {
      id: functionId(String(f['id'])),
      name: String(f['name']),
      dimension: String(f['dimension']) as Dimension,
      severity: String(f['severity']) as Severity,
      route: String(f['route']) as Route,
      isBuiltIn: false,
      validated: Boolean(f['validated'] ?? false),
      enabled: f['enabled'] !== undefined ? Boolean(f['enabled']) : true,
      excludePaths: Array.isArray(rawExcludePaths) ? rawExcludePaths : [],
      ...(f['reason'] != null ? { disabledReason: String(f['reason']) } : {}),
    };

    return {
      ...base,
      ...(f['threshold'] != null ? { threshold: Number(f['threshold']) } : {}),
      ...(semanticCriteria ? { semanticCriteria } : {}),
    };
  });

  if (!templateFunctions) {
    return { functions: specFunctions, warnings };
  }

  // Merge: template is base, spec overrides by ID
  const specById = new Map(specFunctions.map((f) => [String(f.id), f]));
  const merged: FitnessFunction[] = [];

  for (const tmplFn of templateFunctions) {
    const override = specById.get(String(tmplFn.id));
    if (override) {
      merged.push({ ...tmplFn, ...override, isBuiltIn: true });
      warnings.push({
        code: 'SPEC_002',
        message: `Template function "${String(tmplFn.id)}" overridden by spec declaration`,
        path: `fitness_functions[${String(tmplFn.id)}]`,
      });
      specById.delete(String(tmplFn.id));
    } else {
      merged.push(tmplFn);
    }
  }

  for (const fn of specById.values()) {
    merged.push(fn);
  }

  return { functions: merged, warnings };
}

/**
 * Parse Layer C: scoring + confidence_thresholds → LayerCResult
 */
export function parseLayerC(raw: Record<string, unknown>): LayerCResult {
  const scoring = raw['scoring'] as Record<string, unknown>;
  const weights = scoring['weights'] as Record<string, number>;
  const thresholds = scoring['thresholds'] as Record<string, number>;
  const rawFullWeights = scoring['full_mode_weights'] as Record<string, number> | undefined;

  const scoringWeights: ScoringWeights = {
    structural: Number(weights['structural']),
    coupling: Number(weights['coupling']),
    pattern: Number(weights['pattern']),
    solid: Number(weights['solid']),
    convention: Number(weights['convention']),
    semantic: Number(weights['semantic'] ?? 0),
    intent: Number(weights['intent'] ?? 0),
  };

  const verdictThresholds: VerdictThresholds = {
    pass: Number(thresholds['pass']),
    warning: Number(thresholds['warning']),
    softBlock: Number(thresholds['soft_block']),
  };

  let fullModeWeights: ScoringWeights | undefined;
  if (rawFullWeights) {
    fullModeWeights = {
      structural: Number(rawFullWeights['structural']),
      coupling: Number(rawFullWeights['coupling']),
      pattern: Number(rawFullWeights['pattern']),
      solid: Number(rawFullWeights['solid']),
      convention: Number(rawFullWeights['convention']),
      semantic: Number(rawFullWeights['semantic']),
      intent: Number(rawFullWeights['intent']),
    };
  }

  const rawConfidence = raw['confidence_thresholds'] as Record<string, number>;
  const confidenceThresholds: ConfidenceThresholds = {
    high: Number(rawConfidence['high']),
    medium: Number(rawConfidence['medium']),
    iccMinimum: Number(rawConfidence['icc_minimum']),
  };

  return { scoringWeights, fullModeWeights, verdictThresholds, confidenceThresholds };
}
