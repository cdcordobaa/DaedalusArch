import type { ParsedSpec, ScoringWeights } from '../shared/types/spec.js';
import type { ValidationResult, ValidationError, ValidationWarning } from './types.js';
import type { ValidationReport, ValidationError as V11ValidationError } from '../shared/types/validation.js';
import { SPEC_SCHEMA_V1 } from './spec-schema.js';
import { CYPHER_TEMPLATES } from '../fitness-compiler/cypher-templates.js';
import { HEXAGONAL_TEMPLATES } from '../fitness-compiler/hexagonal-templates.js';
import { v13ExtensionCatalogueOf } from '../fitness-compiler/extension-templates.js';
import { EXTENSION_TEMPLATES } from './template-registry.js';
import { globToRegex } from '../fitness-compiler/glob-to-regex.js';
import { existsSync, readdirSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import picomatch from 'picomatch';

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
      message: `Verdict thresholds must satisfy pass > warning > soft_block > 0 (got ${String(t.pass)}, ${String(t.warning)}, ${String(t.softBlock)})`,
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
  // FR-22 (BR-U1-21): `intent` is always 0 internally and no longer counted.
  return w.structural + w.coupling + w.pattern + w.solid + w.convention + w.semantic + w.integrity;
}

/** Which rule set the template check accepts (FR-V6, U-D). */
export type SpecRuleSet = 'v1.2e' | 'v1.3';

export interface SpecValidationOptions {
  /**
   * `v1.2e` (default, unchanged): `CYPHER_TEMPLATES` plus `HEXAGONAL_TEMPLATES`. `v1.3`: also every v1.3 extension
   * catalogue (`V13_EXTENSION_TEMPLATE_CATALOGUES`: hexagonal, module wiring, DDD) and every function name of
   * an extension style library (`EXTENSION_TEMPLATES`).
   */
  readonly rules?: SpecRuleSet;
}

function templateCheckFor(rules: SpecRuleSet): (name: string) => boolean {
  const v12e = (name: string): boolean => CYPHER_TEMPLATES.has(name) || HEXAGONAL_TEMPLATES.has(name);
  if (rules === 'v1.2e') return v12e;
  const extensionNames = new Set([...EXTENSION_TEMPLATES.values()].flatMap((t) => t.functions.map((f) => f.name)));
  return (name) => v12e(name) || v13ExtensionCatalogueOf(name) !== undefined || extensionNames.has(name);
}

/** Project-relative paths (forward slashes) of every file under `projectPath`, skipping node_modules and .git. */
function projectFiles(projectPath: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const abs = resolve(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else out.push(relative(projectPath, abs).split(sep).join('/'));
    }
  };
  walk(projectPath);
  return out;
}

/**
 * The v1.3 layer-directory check. A layer's `directories` are globs, matched against the project's files the way the
 * layer annotator matches them (picomatch, `dot: true`): an inner wildcard (`src/*\/domain/**`) is a pattern, not a
 * literal directory, and a preset may list alternative directories for several project shapes (presets/nestjs.yaml),
 * with `file_patterns` as the fallback. So:
 * - error `LAYER_DIR_NOT_FOUND` when no directory glob and no file pattern of the layer matches any project file
 *   (the layer would be empty: a typo or a wrong project);
 * - warning `LAYER_DIR_NOT_FOUND` for each directory glob that matches nothing while the layer matches something
 *   (an unused alternative).
 * A glob that names a file or directory literally (`src/main.ts`) also matches when that path exists.
 */
function checkLayerGlobsV13(
  spec: ParsedSpec,
  projectPath: string,
  errors: V11ValidationError[],
  warnings: import('../shared/types/validation.js').ValidationWarning[],
): void {
  let files: string[] | undefined;
  const filesOf = (): string[] => (files ??= projectFiles(projectPath));
  const matches = (glob: string): boolean => {
    const literal = glob.replace(/\/?\*\*.*$/, '').replace(/\/?\*$/, '');
    if (!literal.includes('*') && literal.length > 0 && existsSync(resolve(projectPath, literal))) return true;
    const m = picomatch(glob, { dot: true });
    return filesOf().some((f) => m(f));
  };
  for (const layer of spec.layerModel.layers) {
    const field = `architecture.layers.${layer.name}.directories`;
    const dirs = layer.directories.filter((d) => d.replace(/\/?\*\*.*$/, '').replace(/\/?\*$/, '').length > 0);
    if (dirs.length === 0) continue;
    const missing = dirs.filter((d) => !matches(d));
    const byPattern = (layer.filePatterns ?? []).some((p) => matches(p));
    if (missing.length === dirs.length && !byPattern) {
      errors.push({
        code: 'LAYER_DIR_NOT_FOUND',
        message: `Layer "${layer.name}" matches no file of ${projectPath}: no directory glob (${dirs.join(', ')})${(layer.filePatterns ?? []).length > 0 ? ' and no file pattern' : ''} matches`,
        field,
        suggestion: `Create the directory or update the layer mapping`,
      });
      continue;
    }
    for (const d of missing) {
      warnings.push({ code: 'LAYER_DIR_NOT_FOUND', message: `Layer "${layer.name}" directory glob "${d}" matches no file (the layer matches through its other globs)`, field });
    }
  }
}

/**
 * Pass 3: Filesystem + project-level validation.
 * Checks that layer directories exist, glob patterns are valid, template refs resolve, etc.
 */
export function validateSpecAgainstProject(
  spec: ParsedSpec,
  projectPath: string,
  options: SpecValidationOptions = {},
): ValidationReport {
  const knownTemplate = templateCheckFor(options.rules ?? 'v1.2e');
  const errors: V11ValidationError[] = [];
  const warnings: import('../shared/types/validation.js').ValidationWarning[] = [];

  // Check layer directories exist (v1.3: glob semantics, see checkLayerGlobsV13; v1.2E: unchanged literal check)
  if (options.rules === 'v1.3') checkLayerGlobsV13(spec, projectPath, errors, warnings);
  else for (const layer of spec.layerModel.layers) {
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
    if ((ff.route === 'symbolic' || ff.route === 'hybrid') && !knownTemplate(ff.name)) {
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

  // `!== false` (not a plain truthiness test): a function object built without `enabled` counts as enabled.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-boolean-literal-compare
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
