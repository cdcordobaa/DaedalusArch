import type { ParsedSpec, ScoringWeights } from '../shared/types/spec.js';
import type { ValidationResult, ValidationError, ValidationWarning } from './types.js';
import type { ValidationReport, ValidationError as V11ValidationError } from '../shared/types/validation.js';
import { SPEC_SCHEMA_V1 } from './spec-schema.js';
import { CYPHER_TEMPLATES } from '../fitness-compiler/cypher-templates.js';
import { globToRegex } from '../fitness-compiler/glob-to-regex.js';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { Ajv, type ErrorObject } from 'ajv';
const ajv = new Ajv({ allErrors: true, verbose: true });
const validateSchema = ajv.compile(SPEC_SCHEMA_V1);

/**
 * Pass 1: Ajv structural validation.
 * Optionally maps JSON pointer errors to YAML line numbers if lineMap is provided.
 */
export function validateSpecSchema(
  raw: unknown,
  lineMap?: ReadonlyMap<string, { line: number; column: number }>,
): ValidationResult {
  const valid = validateSchema(raw);

  if (valid) {
    return { valid: true, errors: [], warnings: [] };
  }

  const errors: ValidationError[] = (validateSchema.errors ?? []).map((err: ErrorObject) => {
    const path = err.instancePath || '/';
    const pos = lineMap?.get(path);
    const base = {
      path,
      message: err.message ?? 'Unknown validation error',
      rule: 'BR-SCHEMA-01',
    };
    if (pos) {
      return { ...base, line: pos.line, column: pos.column };
    }
    return base;
  });

  return { valid: false, errors, warnings: [] };
}

/**
 * Pass 2: Business rule validation on a fully parsed ParsedSpec.
 */
export function validateBusinessRules(spec: ParsedSpec): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // BR-SPEC-01: spec version
  if (spec.specVersion !== '1.0.0') {
    errors.push({
      path: 'spec_version',
      message: `Unsupported spec version "${spec.specVersion}" — only "1.0.0" is supported`,
      rule: 'BR-SPEC-01',
    });
  }

  // BR-SPEC-06: weights sum to 1.0
  const weightSum = sumWeights(spec.scoringWeights);
  if (Math.abs(weightSum - 1.0) > 0.001) {
    errors.push({
      path: 'scoring.weights',
      message: `Weights must sum to 1.0 (got ${weightSum.toFixed(4)})`,
      rule: 'BR-SPEC-06',
    });
  } else if (weightSum !== 1.0) {
    warnings.push({
      code: 'SPEC_003',
      message: `Weights sum ${weightSum.toFixed(4)} auto-corrected to 1.0`,
      path: 'scoring.weights',
    });
  }

  // BR-SPEC-07: full mode weights
  if (spec.fullModeWeights) {
    const fmSum = sumWeights(spec.fullModeWeights);
    if (Math.abs(fmSum - 1.0) > 0.001) {
      errors.push({
        path: 'scoring.full_mode_weights',
        message: `Full mode weights must sum to 1.0 (got ${fmSum.toFixed(4)})`,
        rule: 'BR-SPEC-07',
      });
    }
  }

  // BR-SPEC-08: verdict threshold ordering
  const t = spec.verdictThresholds;
  if (!(t.pass > t.warning && t.warning > t.softBlock && t.softBlock > 0)) {
    errors.push({
      path: 'scoring.thresholds',
      message: `Verdict thresholds must satisfy pass > warning > soft_block > 0 (got ${t.pass}, ${t.warning}, ${t.softBlock})`,
      rule: 'BR-SPEC-08',
    });
  }

  // BR-SPEC-09: confidence threshold ordering
  const c = spec.confidenceThresholds;
  if (!(c.high > c.medium && c.medium > 0 && c.iccMinimum > 0)) {
    errors.push({
      path: 'confidence_thresholds',
      message: `Confidence thresholds must satisfy high > medium > 0 and icc_minimum > 0`,
      rule: 'BR-SPEC-09',
    });
  }

  // BR-SPEC-05: route/semantic_criteria consistency
  for (const ff of spec.fitnessFunctions) {
    if ((ff.route === 'neuronal' || ff.route === 'hybrid') && !ff.semanticCriteria) {
      errors.push({
        path: `fitness_functions[${String(ff.id)}]`,
        message: `Function "${ff.name}" has route "${ff.route}" but missing semantic_criteria`,
        rule: 'BR-SPEC-05',
      });
    }
    if (ff.route === 'symbolic' && ff.semanticCriteria) {
      errors.push({
        path: `fitness_functions[${String(ff.id)}]`,
        message: `Function "${ff.name}" has route "symbolic" but declares semantic_criteria`,
        rule: 'BR-SPEC-05',
      });
    }
  }

  // BR-SPEC-04: unique function IDs
  const ids = new Set<string>();
  for (const ff of spec.fitnessFunctions) {
    const id = String(ff.id);
    if (ids.has(id)) {
      errors.push({
        path: `fitness_functions[${id}]`,
        message: `Duplicate function ID "${id}"`,
        rule: 'BR-SPEC-04',
      });
    }
    ids.add(id);
  }

  // BR-SPEC-03: unique layer names
  const layerNames = new Set<string>();
  for (const layer of spec.layerModel.layers) {
    if (layerNames.has(layer.name)) {
      errors.push({
        path: `architecture.layers[${layer.name}]`,
        message: `Duplicate layer name "${layer.name}"`,
        rule: 'BR-SPEC-03',
      });
    }
    layerNames.add(layer.name);
  }

  return { valid: errors.length === 0, errors, warnings };
}

function sumWeights(w: ScoringWeights): number {
  return w.structural + w.coupling + w.pattern + w.solid + w.convention + w.semantic + w.intent;
}

/**
 * Pass 3: Filesystem + project-level validation.
 * Checks that layer directories exist, glob patterns are valid, template refs resolve, etc.
 */
export function validateSpecAgainstProject(spec: ParsedSpec, projectPath: string): ValidationReport {
  const errors: V11ValidationError[] = [];
  const warnings: import('../shared/types/validation.js').ValidationWarning[] = [];

  // Check layer directories exist
  for (const layer of spec.layerModel.layers) {
    for (const dir of layer.directories) {
      // Strip glob suffixes for directory existence check
      const cleanDir = dir.replace(/\/?\*\*.*$/, '').replace(/\/?\*$/, '');
      if (cleanDir.length > 0) {
        const fullPath = resolve(projectPath, cleanDir);
        if (!existsSync(fullPath)) {
          errors.push({
            code: 'LAYER_DIR_NOT_FOUND',
            message: `Layer "${layer.name}" directory "${cleanDir}" not found at ${fullPath}`,
            field: `architecture.layers.${layer.name}.directories`,
            suggestion: `Create the directory or update the layer mapping`,
          });
        }
      }
    }
  }

  // Check for duplicate function IDs
  const ids = new Set<string>();
  for (const ff of spec.fitnessFunctions) {
    const id = String(ff.id);
    if (ids.has(id)) {
      errors.push({
        code: 'DUPLICATE_FUNCTION_ID',
        message: `Duplicate fitness function ID: ${id}`,
        field: `fitness_functions.${id}`,
      });
    }
    ids.add(id);
  }

  // Per-function validation
  for (const ff of spec.fitnessFunctions) {
    const ffId = String(ff.id);

    // Template reference check for symbolic/hybrid functions
    if ((ff.route === 'symbolic' || ff.route === 'hybrid') && !CYPHER_TEMPLATES.has(ff.name)) {
      errors.push({
        code: 'INVALID_TEMPLATE_REF',
        message: `No Cypher template found for function "${ff.name}" (${ffId})`,
        field: `fitness_functions.${ffId}.name`,
        suggestion: `Check available templates or switch route to "neuronal"`,
      });
    }

    // Threshold validation
    if (ff.threshold !== undefined && (typeof ff.threshold !== 'number' || ff.threshold < 0)) {
      errors.push({
        code: 'INVALID_THRESHOLD',
        message: `Invalid threshold ${String(ff.threshold)} for function ${ffId}`,
        field: `fitness_functions.${ffId}.threshold`,
      });
    }

    // Glob pattern validation
    for (const pattern of ff.excludePaths) {
      try {
        globToRegex(pattern);
      } catch {
        errors.push({
          code: 'INVALID_GLOB_PATTERN',
          message: `Invalid glob pattern "${pattern}" in exclude_paths for ${ffId}`,
          field: `fitness_functions.${ffId}.exclude_paths`,
        });
      }
    }
  }

  const enabledCount = spec.fitnessFunctions.filter((f) => f.enabled !== false).length;
  const disabledCount = spec.fitnessFunctions.length - enabledCount;

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      totalFunctions: spec.fitnessFunctions.length,
      enabledFunctions: enabledCount,
      disabledFunctions: disabledCount,
      totalLayers: spec.layerModel.layers.length,
      totalErrors: errors.length,
      totalWarnings: warnings.length,
    },
  };
}
