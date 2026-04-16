import * as fs from 'node:fs';
import * as path from 'node:path';
import YAML from 'yaml';
import type { ParsedSpec } from '../shared/types/spec.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import type { DomainWarning } from '../shared/errors/domain-result.js';
import { parseLayerA, parseLayerB, parseLayerC } from './layer-parsers.js';
import { validateSpecSchema } from './spec-validator.js';

/**
 * Directory where built-in presets live.
 * Resolved relative to the package root (two levels up from src/spec-parser/).
 */
function presetsDir(): string {
  // In compiled output (dist/spec-parser/), go up to package root
  // In source (src/spec-parser/), go up to package root
  const candidates = [
    path.resolve(__dirname, '..', '..', 'presets'),
    path.resolve(__dirname, '..', '..', '..', 'presets'),
    path.resolve(process.cwd(), 'presets'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return path.resolve(process.cwd(), 'presets');
}

/**
 * List available preset style names by scanning the presets/ directory.
 */
export function listPresets(): string[] {
  const dir = presetsDir();
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
    .map((f) => f.replace(/\.ya?ml$/, ''));
}

/**
 * Load a preset template by style name and parse it into a ParsedSpec.
 */
export function loadPreset(styleName: string): DomainResult<ParsedSpec> {
  const dir = presetsDir();
  const yamlPath = path.join(dir, `${styleName}.yaml`);
  const ymlPath = path.join(dir, `${styleName}.yml`);

  const filePath = fs.existsSync(yamlPath) ? yamlPath : fs.existsSync(ymlPath) ? ymlPath : undefined;

  if (!filePath) {
    const available = listPresets();
    const suggestion = available.length > 0
      ? ` Available presets: ${available.join(', ')}`
      : ' No presets found in presets/ directory.';
    return DomainResult.fail<ParsedSpec>([{
      code: 'PRESET_NOT_FOUND',
      message: `Preset "${styleName}" not found.${suggestion}`,
    }]);
  }

  let raw: Record<string, unknown>;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    raw = YAML.parse(content) as Record<string, unknown>;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return DomainResult.fail<ParsedSpec>([{
      code: 'PRESET_PARSE_ERROR',
      message: `Failed to parse preset "${styleName}": ${msg}`,
    }]);
  }

  // Validate schema
  const schemaResult = validateSpecSchema(raw);
  if (!schemaResult.valid) {
    return DomainResult.fail<ParsedSpec>([{
      code: 'PRESET_INVALID',
      message: `Preset "${styleName}" failed schema validation: ${schemaResult.errors.map((e) => e.message).join('; ')}`,
    }]);
  }

  // Parse layers
  const layerModel = parseLayerA(raw);
  const { functions, warnings: mergeWarnings } = parseLayerB(raw);
  const { scoringWeights, fullModeWeights, verdictThresholds, confidenceThresholds } = parseLayerC(raw);

  const warnings: DomainWarning[] = mergeWarnings.map((w) => ({ code: w.code, message: w.message }));

  const spec: ParsedSpec = {
    specVersion: raw['spec_version'] as string,
    layerModel,
    fitnessFunctions: functions,
    scoringWeights,
    ...(fullModeWeights ? { fullModeWeights } : {}),
    verdictThresholds,
    confidenceThresholds,
    adrRules: [],
  };

  return DomainResult.ok(spec, warnings.length > 0 ? warnings : undefined);
}

/**
 * Override interface for merging project-specific values on top of a preset.
 */
export interface SpecOverrides {
  readonly layers?: readonly LayerOverride[];
  readonly fitness_functions?: readonly FFOverride[];
  readonly exclude_paths?: readonly string[];
}

export interface LayerOverride {
  readonly name: string;
  readonly directories?: readonly string[];
}

export interface FFOverride {
  readonly id: string;
  readonly threshold?: number;
  readonly enabled?: boolean;
  readonly reason?: string;
  readonly exclude_paths?: readonly string[];
  readonly severity?: string;
}

/**
 * Merge a preset ParsedSpec with project-specific overrides.
 * Project values win on conflict.
 */
export function mergeSpecs(preset: ParsedSpec, overrides: SpecOverrides): DomainResult<ParsedSpec> {
  const warnings: DomainWarning[] = [];

  // Merge layers: override directories by layer name
  let layerModel = preset.layerModel;
  if (overrides.layers && overrides.layers.length > 0) {
    const overrideMap = new Map(overrides.layers.map((l) => [l.name, l]));
    const mergedLayers = preset.layerModel.layers.map((layer) => {
      const override = overrideMap.get(layer.name);
      if (!override) return layer;
      return {
        ...layer,
        ...(override.directories ? { directories: override.directories } : {}),
      };
    });
    layerModel = { layers: mergedLayers };
  }

  // Merge fitness functions: override by ID
  let functions = [...preset.fitnessFunctions];
  if (overrides.fitness_functions && overrides.fitness_functions.length > 0) {
    const overrideMap = new Map(overrides.fitness_functions.map((f) => [f.id, f]));
    functions = functions.map((ff) => {
      const override = overrideMap.get(String(ff.id));
      if (!override) return ff;
      warnings.push({ code: 'MERGE_001', message: `Preset function "${String(ff.id)}" overridden by project` });
      return {
        ...ff,
        ...(override.threshold !== undefined ? { threshold: override.threshold } : {}),
        ...(override.enabled !== undefined ? { enabled: override.enabled } : {}),
        ...(override.reason !== undefined ? { disabledReason: override.reason } : {}),
        ...(override.exclude_paths !== undefined ? { excludePaths: override.exclude_paths } : {}),
        ...(override.severity !== undefined ? { severity: override.severity as import('../shared/types/enums.js').Severity } : {}),
      };
    });
  }

  // Apply global exclude_paths to all functions
  if (overrides.exclude_paths && overrides.exclude_paths.length > 0) {
    const globalExcludes = overrides.exclude_paths;
    functions = functions.map((ff) => ({
      ...ff,
      excludePaths: [...ff.excludePaths, ...globalExcludes],
    }));
  }

  const merged: ParsedSpec = {
    ...preset,
    layerModel,
    fitnessFunctions: functions,
  };

  return DomainResult.ok(merged, warnings.length > 0 ? warnings : undefined);
}
