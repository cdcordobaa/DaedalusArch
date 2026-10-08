import type {
  FitnessFunction, LayerModel, LayerDefinition,
  ScoringWeights, VerdictThresholds, ConfidenceThresholds,
  SemanticCriteria,
} from '../shared/types/spec.js';
import type { Dimension, Severity, Route, LayerKind, JudgeUnitKind } from '../shared/types/enums.js';
import type { ValidationWarning } from './types.js';
import { functionId } from '../shared/types/value-objects.js';
import { resolveLayerKinds } from './layer-kind-resolver.js';
import { mapFunctionSpecificFields, FUNCTION_FIELD_KEYS } from './function-fields.js';
import { normaliseDimension } from './dimension-alias.js';
import { CYPHER_TEMPLATES } from '../fitness-compiler/cypher-templates.js';

export interface LayerCResult {
  readonly scoringWeights: ScoringWeights;
  readonly fullModeWeights: ScoringWeights | undefined;
  readonly verdictThresholds: VerdictThresholds;
  readonly confidenceThresholds: ConfidenceThresholds;
  readonly warnings: readonly ValidationWarning[]; // SPEC_004 for the legacy full_mode_weights.intent key (BR-U1-21)
}

/**
 * Parse Layer A: architecture.layers → LayerModel.
 * Reads the optional layer `kind` and resolves every layer's kind (FR-19, BR-U1-12); duplicate scalar
 * kinds add SPEC_005 to `warnings` (BR-U1-13).
 */
export function parseLayerA(raw: Record<string, unknown>, warnings: ValidationWarning[] = []): LayerModel {
  const arch = raw['architecture'] as Record<string, unknown>;
  const rawLayers = arch['layers'] as Record<string, unknown>[];

  const declared: LayerDefinition[] = rawLayers.map((l) => {
    const { kind } = l as { kind?: LayerKind };
    return {
      name: String(l['name']),
      directories: (l['directories'] as string[] | undefined) ?? [],
      naming: [],
      decorators: (l['decorators'] as string[] | undefined) ?? [],
      filePatterns: (l['file_patterns'] as string[] | undefined) ?? [],
      role: ((l['roles'] as string[]) ?? []).join(', '),
      ...(kind != null ? { kind } : {}),
    };
  });

  const { layers, warnings: kindWarnings } = resolveLayerKinds(declared);
  warnings.push(...kindWarnings);
  return { layers };
}

/**
 * Parse Layer B: fitness_functions → FitnessFunction[]
 * Each declaration's dimension goes through `normaliseDimension` (`intent` → `semantic` with SPEC_004,
 * FR-22, BR-U1-20). Each declaration's FR-07 keys are mapped to typed fields (absent keys omitted, BR-U1-03); a key whose
 * parameter the function's template does not use raises SPEC_001 and is still carried (BR-U1-05).
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
    const { judge_unit: judgeUnit } = f as { judge_unit?: JudgeUnitKind };
    const id = String(f['id']);
    const name = String(f['name']);
    const { fields } = mapFunctionSpecificFields(f, `fitness_functions[${id}]`);
    warnings.push(...unusedFieldWarnings(id, name, fields));
    const { dimension, warning: dimensionWarning } = normaliseDimension(String(f['dimension']) as Dimension, id);
    if (dimensionWarning) warnings.push({ ...dimensionWarning, path: `fitness_functions[${id}].dimension` });

    const base: FitnessFunction = {
      id: functionId(id),
      name,
      dimension,
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
      ...(judgeUnit != null ? { judgeUnit } : {}), // FR-33 (BR-U1-26); the schema has checked the value
      ...fields,
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
 * SPEC_001 for each FR-07 key whose mapped parameter is not in the template's
 * `requiredParams ∪ optionalParams` (BR-U1-05). A function without a template uses no FR-07 key.
 */
function unusedFieldWarnings(id: string, name: string, fields: object): ValidationWarning[] {
  const template = CYPHER_TEMPLATES.get(name);
  const used = new Set([...(template?.requiredParams ?? []), ...(template?.optionalParams ?? [])]);
  const warnings: ValidationWarning[] = [];
  for (const [yamlKey, field] of Object.entries(FUNCTION_FIELD_KEYS)) {
    if (!(field in fields) || used.has(field)) continue;
    warnings.push({
      code: 'SPEC_001',
      message: `Field "${yamlKey}" of ${id} not used by template ${name}`,
      path: `fitness_functions[${id}].${yamlKey}`,
    });
  }
  return warnings;
}

/**
 * Parse Layer C: scoring + confidence_thresholds → LayerCResult.
 * FR-22 (BR-U1-21): `scoring.weights` carries the five symbolic keys only, so `semantic`, `integrity` and
 * `intent` are 0. `full_mode_weights` takes `integrity` from `integrity` or from the legacy `intent` key
 * (SPEC_004; the schema admits exactly one of them); `intent` is always 0.
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
    semantic: 0,
    integrity: 0,
    intent: 0,
  };

  const verdictThresholds: VerdictThresholds = {
    pass: Number(thresholds['pass']),
    warning: Number(thresholds['warning']),
    softBlock: Number(thresholds['soft_block']),
  };

  const warnings: ValidationWarning[] = [];
  let fullModeWeights: ScoringWeights | undefined;
  if (rawFullWeights) {
    const legacyIntent = rawFullWeights['intent'];
    if (legacyIntent != null) {
      warnings.push({
        code: 'SPEC_004',
        message: 'full_mode_weights.intent is deprecated; mapped to integrity',
        path: 'scoring.full_mode_weights.intent',
      });
    }
    fullModeWeights = {
      structural: Number(rawFullWeights['structural']),
      coupling: Number(rawFullWeights['coupling']),
      pattern: Number(rawFullWeights['pattern']),
      solid: Number(rawFullWeights['solid']),
      convention: Number(rawFullWeights['convention']),
      semantic: Number(rawFullWeights['semantic']),
      integrity: Number(rawFullWeights['integrity'] ?? legacyIntent),
      intent: 0,
    };
  }

  const rawConfidence = raw['confidence_thresholds'] as Record<string, number>;
  const confidenceThresholds: ConfidenceThresholds = {
    high: Number(rawConfidence['high']),
    medium: Number(rawConfidence['medium']),
    iccMinimum: Number(rawConfidence['icc_minimum']),
  };

  return { scoringWeights, fullModeWeights, verdictThresholds, confidenceThresholds, warnings };
}
